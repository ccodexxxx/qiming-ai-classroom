/**
 * 启明 AI 课堂 · HTTP 服务（零依赖）
 *
 * 职责：
 *   1) 静态资源与多页面渲染
 *   2) 会话与学生档案（cookie 只存 id，数据落在 data/students/*.json）
 *   3) 教学接口：对话（支持 SSE 流式）、抽题、判题、动画帧、绘本生成、学情记录
 *   4) 大模型可选接入：未配置时全部由本地教学引擎完成
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const content = require('./content');
const tutor = require('./lib/tutor');
const nlu = require('./lib/nlu');
const { Store, today, badgesOf } = require('./lib/store');
const llm = require('./lib/llm');
const pages = require('./lib/pages');
const art = require('./lib/art');
const book = require('./lib/book');
const pb = require('./lib/pb-engine');
const pbLayers = require('./lib/pb-layers');
const pbStory = require('./lib/pb-story');
const pbDetail = require('./lib/pb-detail');
const videoJobs = require('./lib/pb-video-jobs');
const pbAnim = require('./lib/pb-anim');
const pbTimeline = require('./lib/pb-timeline');
/* 注意：上面的 art 是知识点的示意图模块，绘本的绘图引擎要用别名，避免重名 */
const pbArt = require('./lib/pb-art');
const activities = require('./lib/activities');
const util = require('./lib/http-util');

const PORT = Number(process.env.PORT || 8090);
const HOST = process.env.HOST || '127.0.0.1';
const store = new Store();

/* ================= 会话与档案 ================= */
function ensureStudent(req, res) {
  const cookies = util.parseCookies(req);
  let student = cookies.aiq_sid ? store.get(cookies.aiq_sid) : null;
  if (!student) {
    student = store.create({});
    util.setCookie(res, 'aiq_sid', student.id, 60 * 60 * 24 * 365);
  } else if (cookies.aiq_sid !== student.id) {
    util.setCookie(res, 'aiq_sid', student.id, 60 * 60 * 24 * 365);
  }
  if (!student.memory) student.memory = tutor.freshMemory();
  if (!student.stats) student.stats = { activeDays: [], streak: 0, lastActiveDay: null };
  store.touchDay(student);
  return student;
}

/** 供页面头部显示的简要学生信息 */
function studentBrief(student) {
  return { id: student.id, name: student.name || '未命名同学', grade: student.grade || 5, avatar: student.avatar || '🌱' };
}

/**
 * 读取 JSON 请求体；解析失败时返回空对象，由各路由自行兜底默认值。
 * 注意：util.readJson 是 async 的，忘了 await 会拿到一个 Promise，
 * 后续的 body.xxx 全是 undefined，而且不报错、极难排查——所以统一走这个包装。
 */
async function readJsonSafe(req) {
  try { return await util.readJson(req); }
  catch (e) { return {}; }
}

/** 把一道错题记进错题本（对话、练习、绘本共用同一个错题本） */
function addWrong(student, w) {
  if (!student.wrongBook) student.wrongBook = [];
  student.wrongBook.unshift({
    id: 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1000),
    topicId: w.topicId || null,
    question: String(w.question || '').slice(0, 200),
    answer: String(w.answer || '').slice(0, 120),
    mine: String(w.mine || '').slice(0, 120),
    explain: String(w.explain || '').slice(0, 300),
    title: w.title ? String(w.title).slice(0, 60) : null,
    at: Date.now(),
    fixed: false
  });
  if (student.wrongBook.length > 100) student.wrongBook.length = 100;
}

/* ================= AI 绘本模块（低龄段） ================= */
/** 绘本进度挂在学生档案的 pb 字段里，与主智能体共用同一个档案 */
function pbProgress(student) {
  if (!student.pb) student.pb = { books: {}, stars: 0, stickers: [], badges: [] };
  if (!student.pb.books) student.pb.books = {};
  if (!student.pb.stickers) student.pb.stickers = [];
  if (!student.pb.badges) student.pb.badges = [];
  if (typeof student.pb.stars !== 'number') student.pb.stars = 0;
  return student.pb;
}
function setPbProgress(student, p) { student.pb = p; }
function doneBooks(student) {
  const p = pbProgress(student);
  return Object.keys(p.books).filter(k => p.books[k] && p.books[k].done).length;
}
function pbStars(student) { return pbProgress(student).stars || 0; }
/** 绘本模块内的对话，统一按「学生实际年级」走教学引擎 */
function pbLevel(student) {
  return content.levelOfGrade(Number(student.grade) || 1);
}
/** 把一段回答切成适合低龄阅读的短句 */
function splitSentences(text, maxLines, maxChars) {
  const raw = String(text || '').split(/(?<=[。！？；.!?;])/).map(x => x.trim()).filter(Boolean);
  const out = [];
  let buf = '';
  raw.forEach(s => {
    if (out.length >= maxLines) return;
    if ((buf + s).length <= maxChars) { buf += s; return; }
    if (buf) { out.push(buf); buf = ''; }
    if (s.length <= maxChars) { buf = s; return; }
    /* 长句硬切 */
    for (let i = 0; i < s.length && out.length < maxLines; i += maxChars) out.push(s.slice(i, i + maxChars));
  });
  if (buf && out.length < maxLines) out.push(buf);
  while (out.length < 1) out.push('我们一起想一想。');
  return out.slice(0, maxLines);
}
/** 把「问 AI」的回答变成一页新绘本的插图 */
function pbAnswerArt(question, answer) {
  const scenes = require('./lib/pb-scenes');
  const A = require('./lib/pb-art');
  const q = String(question || '').slice(0, 16);
  const lines = splitSentences(answer, 4, 16);
  const cmds = [
    A.rect(0, 0, A.W, A.H, { rx: 0, fill: A.C.greenL }),
    A.rect(40, 52, 560, 296, { rx: 20, fill: '#ffffff', stroke: A.C.green, width: 2.6 }),
    A.text(320, 108, '小启的回答', { size: 17, anchor: 'middle', fill: A.C.green, weight: 'bold' }),
    A.text(320, 142, '「' + q + '」', { size: 15, anchor: 'middle', fill: A.C.soft })
  ];
  lines.forEach((l, i) => cmds.push(A.text(320, 192 + i * 32, l, { size: 16, anchor: 'middle', fill: A.C.ink })));
  cmds.push(A.text(320, 322, '这一页是小启专门为你画的', { size: 13, anchor: 'middle', fill: A.C.muted }));
  const sparkle = A.sparkle(84, 84, 1.0).concat(A.sparkle(556, 92, 0.9), A.sparkle(538, 320, 0.7));
  return A.toSvg(cmds.concat(sparkle), A.W, A.H, '小启的回答');
}

/* ================= 对话 ================= */
function chatContext(student, levelId) {
  const grade = student.grade || 5;
  const lv = levelId ? content.levelById(levelId) : content.levelOfGrade(grade);
  return { grade: grade, name: student.name, memory: student.memory, progress: student.progress, level: lv };
}

/** 记录一轮对话 */
function pushChat(student, role, text, extra) {
  student.chat.push(Object.assign({ role, text, at: Date.now() }, extra || {}));
  if (student.chat.length > 120) student.chat = student.chat.slice(-120);
}

/** 本地引擎回答 */
function localAnswer(student, text, opt) {
  opt = opt || {};
  const ctx = chatContext(student, opt.levelId);
  const t0 = Date.now();
  const reply = tutor.answer(text, ctx);
  reply.ms = Date.now() - t0;
  reply.topic = reply.topicId ? content.getTopic(reply.topicId) : null;
  return reply;
}

/**
 * 一键生成绘本
 *
 * 输入一句自然语言（如「生成一本适合 1 年级的 AI 认猫绘本」），
 * 输出一本完整可读的绘本 JSON：分页脚本 + 画面 Prompt + 台词 + 互动设计。
 *
 * 故事本体走「已通过内容校验」的 8 本原创绘本（保证黄金八步、因果链、五层画面都不缺）；
 * 大模型负责把老师那句话润色成一段开场白，未配置时自动跳过。
 */
/* 先匹配「硬核说法」再去匹配主题词，否则「过拟合」会被「听」抢走 */
const HARD_HINT = [
  { re: /过拟合|死记硬背|背题|背答案/, theme: 'oops' },
  { re: /偏见|认错人|不公平|歧视/, theme: 'oops' },
  { re: /认猫|认猫猫|识图|看图|认图|照片|认出/, theme: 'see' },
  { re: /听懂|听声音|语音|说话|音箱|录音/, theme: 'hear' },
  { re: /怎么看见|能看|眼睛/, theme: 'see' }
];
const THEME_HINT = {
  see: ['看', '猫', '图片', '眼睛'],
  hear: ['听', '声音', '说', '讲', '音箱', '耳朵'],
  who: ['是什么', '谁', '哪里', '在哪', '醒来', '会什么'],
  oops: ['错', '犯错', '再来一次', '教'],
  play: ['一起', '朋友', '关系', '陪', '照顾']
};
const NAME_ZH = { ai: '小AI', dian: '点点', dou: '豆豆' };

/** 从一句话里猜主题 */
function guessTheme(text) {
  const t = String(text || '');
  /* 硬核说法优先，避免「过拟合」被「听」抢走 */
  const hard = HARD_HINT.filter(h => h.re.test(t))[0];
  if (hard) return hard.theme;
  let best = null, score = 0;
  Object.keys(THEME_HINT).forEach(k => {
    const s = THEME_HINT[k].filter(w => t.indexOf(w) >= 0).length;
    if (s > score) { score = s; best = k; }
  });
  return best;
}

/** 把一本书展开成「生成结果」：分页脚本 + 画面 Prompt + 台词 + 互动设计 */
function expandBook(story, grade) {
  const b = pb.build(story.id, grade, {});
  const storyLine = pbStory.of(story.id);
  return {
    id: b.id, title: b.title, emoji: b.emoji, conceptLabel: b.conceptLabel,
    /* 年龄标识按故事原本的长度算，不能按分档裁剪后的页数算 */
    ageLabel: pb.ageLabelOf(story.pages.length),
    fullPageCount: story.pages.length,
    grade: b.grade, band: b.band, tts: b.tts,
    goal: storyLine.goal, obstacle: storyLine.obstacle,
    tries: storyLine.tries, insight: storyLine.insight,
    cast: (story.cast || []).map(c => pbStory.castBrief(c)),
    artStyle: pb.ART_PROMPT,
    globalPrefix: pb.GLOBAL_PREFIX,
    pageCount: b.pages.length,
    pages: b.pages.map(p => {
      const chain = pbStory.chainOf(story.id, p.scene) || '';
      const arc = pbStory.arcOf(story.id, p.scene) || {};
      const layers = pbLayers.LAYERS[p.scene] || {};
      const mid = layers.mid || {};
      return {
        index: p.index, title: p.title, beat: p.beat,
        arcStep: { step: arc.step, name: arc.name },
        logicTrigger: chain,
        mood: p.mood,
        text: p.lines, pinyin: p.pinyin,
        say: p.say ? Object.assign({}, p.say, { name: NAME_ZH[p.say.who] || '' }) : null,
        interaction: p.action || null,
        sfx: p.fx || '',
        image_prompt: [
          (layers.camera || '远景'), pb.ART_PROMPT,
          '画面：' + (mid.desc || ''),
          '前景（虚化）：' + (layers.front || []).map(f => f.desc).join('，'),
          '背景：' + ((layers.back || {}).scene || '') + '，' + (((layers.back || {}).room && pbDetail.ROOMS[layers.back.room]) || []).slice(0, 8).join('、'),
          '光线：' + ((layers.atmos || {}).light || '') + '；阴影：' + ((layers.atmos || {}).shadow || ''),
          '彩蛋：' + (layers.egg || []).map(e => e.desc).join('，'),
          '前中后三层景深，16:10 横构图，无文字'
        ].join('；'),
        art: p.art
      };
    })
  };
}

async function generateBook(want, grade) {
  const prompt = String(want || '').trim();
  const theme = guessTheme(prompt);
  const g = Math.max(1, Math.min(12, Number(grade) || 1));
  /* 优先挑还没读过的，让「生成」确实给出一本新的 */
  const pool = theme ? pb.byTheme(theme) : pb.ALL;
  /* 同一主题下按 prompt 做一次稳定散列，让不同的说法挑到不同的书 */
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) hash = (hash * 31 + prompt.charCodeAt(i)) % 100000;
  const story = pool[hash % pool.length] || pb.ALL[0];
  const book = expandBook(story, g);

  /* 大模型润色开场白与教师提示（没配置就跳过，不影响可用性） */
  let intro = '这是一本讲「' + story.conceptLabel + '」的故事，一共 ' + book.pageCount + ' 页。';
  let teacherTip = '故事遵循「目标 — 障碍 — 三次尝试 — 领悟」的儿童故事弧光，' +
    '每一页都由上一页的事件引起。画面五层齐全，可直接用于课堂朗读或看图讲述。';
  let source = 'local';
  if (llm.enabled()) {
    try {
      const sys = pb.GLOBAL_PREFIX;
      const ask = '请用一句话（不超过 40 字）向小学' + g + '年级的孩子介绍这本绘本《' + story.title + '》，' +
        '主题是「' + story.conceptLabel + '」。只输出这一句话，不要加引号。';
      const r = await llm.complete([{ role: 'system', content: sys }, { role: 'user', content: ask }]);
      if (r && r.ok && r.text) { intro = String(r.text).trim().slice(0, 80); source = 'llm'; }
    } catch (e) { /* 失败就用手写开场白 */ }
  }
  return {
    ok: true,
    source: source,
    prompt: prompt,
    theme: theme || 'who',
    themeLabel: (pb.THEMES.filter(t => t.id === (theme || 'who'))[0] || {}).name || '',
    intro: intro,
    teacherTip: teacherTip,
    book: book
  };
}

/** 大模型回答（失败自动回退本地引擎） */
async function smartAnswer(student, text, opt) {
  opt = opt || {};
  if (!llm.enabled()) return localAnswer(student, text, opt);
  const local = localAnswer(student, text, opt);
  const topic = local.topic || (student.memory.lastTopicId ? content.getTopic(student.memory.lastTopicId) : null);
  const messages = [{ role: 'system', content: tutor.systemPrompt({ grade: student.grade, topic, related: topic ? tutor.relatedTopics(topic, 2) : [], student }) }]
    .concat(student.chat.slice(-8).filter(m => m.text).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.text).slice(0, 800) })))
    .concat([{ role: 'user', content: text }]);
  const r = await llm.complete(messages);
  if (!r.ok) {
    local.llmFailed = r.reason;
    return local;
  }
  return Object.assign({}, local, { text: r.text, source: 'llm' });
}

/** 流式回答：先给编排元数据，再逐段推送文本 */
async function streamAnswer(res, student, text, opt) {
  opt = opt || {};
  const local = localAnswer(student, text, opt);
  const topic = local.topic || (student.memory.lastTopicId ? content.getTopic(student.memory.lastTopicId) : null);

  const send = obj => res.write('data: ' + JSON.stringify(obj) + '\n\n');
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  send({
    type: 'meta',
    intent: local.intent,
    topicId: local.topicId,
    topicTitle: local.topic ? local.topic.title : null,
    levelId: local.levelId,
    step: local.step,
    noAnswer: local.noAnswer,
    actions: local.actions
  });

  let full = local.text;
  let source = 'local';

  if (llm.enabled()) {
    const messages = [{ role: 'system', content: tutor.systemPrompt({ grade: student.grade, topic, related: topic ? tutor.relatedTopics(topic, 2) : [], student }) }]
      .concat(student.chat.slice(-8).filter(m => m.text).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.text).slice(0, 800) })))
      .concat([{ role: 'user', content: text }]);
    let first = true;
    const r = await llm.stream(messages, {
      onDelta: piece => {
        if (first) { first = false; send({ type: 'llm-start' }); }
        send({ type: 'delta', text: piece });
      }
    });
    if (r.ok && r.text) {
      full = r.text;
      source = 'llm';
    } else {
      send({ type: 'llm-failed', reason: r.reason });
      // 回退：按句推送本地回答，保证前端体验一致
      const chunks = local.text.match(/[^。！？\n]{1,60}[。！？\n]?/g) || [local.text];
      for (const c of chunks) {
        send({ type: 'delta', text: c });
        await new Promise(r2 => setTimeout(r2, 12));
      }
    }
  } else {
    const chunks = local.text.match(/[^。！？\n]{1,60}[。！？\n]?/g) || [local.text];
    for (const c of chunks) {
      send({ type: 'delta', text: c });
      await new Promise(r2 => setTimeout(r2, 14));
    }
  }

  pushChat(student, 'user', text, { intent: local.intent });
  pushChat(student, 'assistant', full, { topicId: local.topicId, source });
  store.recordEvent(student, { type: 'chat', topicId: local.topicId, title: String(text).slice(0, 30), xp: 3 });
  store.save(student);

  send({ type: 'done', topicId: local.topicId, source, ms: local.ms });
  res.end();
}

/* ================= 路由 ================= */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = decodeURIComponent(url.pathname);
  const query = Object.fromEntries(url.searchParams.entries());
  const method = req.method.toUpperCase();

  try {
    /* ---- 生成的视频作品（不进 /public，单独从一个受控目录提供） ---- */
    if (pathname.indexOf('/media/videos/') === 0) {
      if (util.serveFrom(req, res, videoJobs.ROOT, pathname.slice('/media/videos'.length))) return;
      util.sendText(res, 404, 'Not Found');
      return;
    }

    // ---- 静态资源 ----
    if (pathname.indexOf('/css/') === 0 || pathname.indexOf('/js/') === 0 || pathname.indexOf('/img/') === 0) {
      if (util.serveStatic(req, res, pathname)) return;
      util.sendText(res, 404, 'Not Found');
      return;
    }
    if (pathname === '/favicon.ico') { util.sendText(res, 204, ''); return; }

    // ---- 页面 ----
    if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      const student = ensureStudent(req, res);
      store.save(student);
      util.sendHtml(res, 200, pages.homePage(studentBrief(student)));
      return;
    }

    if (method === 'GET' && pathname === '/chat') {
      const student = ensureStudent(req, res);
      util.sendHtml(res, 200, pages.chatPage(studentBrief(student), query));
      return;
    }

    if (method === 'GET' && pathname === '/courses') {
      const student = ensureStudent(req, res);
      util.sendHtml(res, 200, pages.coursesPage(student, query));
      return;
    }

    if (method === 'GET' && pathname.indexOf('/topic/') === 0) {
      const student = ensureStudent(req, res);
      const id = pathname.slice('/topic/'.length);
      const topic = content.getTopic(id);
      if (!topic) { util.sendHtml(res, 404, pages.aboutPage(studentBrief(student)), { }); return; }
      store.recordEvent(student, { type: 'learn', topicId: topic.id, title: '查看知识点：' + topic.title, xp: 2 });
      store.save(student);
      util.sendHtml(res, 200, pages.topicPage(topic, student, query));
      return;
    }

    if (method === 'GET' && pathname === '/studio') {
      const student = ensureStudent(req, res);
      util.sendHtml(res, 200, pages.studioPage(studentBrief(student), query));
      return;
    }

    // AI 绘本：独立成页，可被 iframe 嵌入（?embed=1 去掉导航与页脚）
    /* 独立路由：/ai-picture-book（低龄绘本馆），与 /book 完全等同 */
    /* AI 动画片：统一入口。骨骼动画是主体验，MP4 导出只是附带能力。
       /ai-cartoon 是正式入口，/animation 与 /anim 保留为别名。 */
    if (method === 'GET' && (pathname === '/ai-cartoon' || pathname === '/animation' || pathname === '/anim')) {
      const student = ensureStudent(req, res);
      util.sendHtml(res, 200, pages.animPage(studentBrief(student), query));
      return;
    }
    /* 动画分镜：每一镜的画面 + 动作时间轴 + 场景动态 */
    if (method === 'GET' && pathname === '/api/anim/storyboard') {
      const id = query.id || 'wake';
      const st = pb.get(id);
      if (!st) { util.sendJson(res, 404, { ok: false, error: '找不到这本绘本' }); return; }
      const grade = Number(query.grade) || 1;
      const b = pb.build(id, grade, {});
      const storyLine = pbStory.of(id);
      const shots = b.pages.map((p, i) => {
        const L = pbLayers.LAYERS[p.scene] || {};
        const mid = L.mid || {};
        /* 按剧情推动作：台词里写了「跑」就真的跑起来，否则按故事节拍挑一个贴切的表演 */
        const act = pbTimeline.actionFor(p, mid, p.beat);
        const t = pbTimeline.timelineOf(act);
        const arc = pbStory.arcOf(id, p.scene) || {};
        return {
          index: p.index,
          title: p.title,
          camera: L.camera || '中景',
          action: t.action,
          actionLabel: t.label,
          duration: t.dur,
          loop: t.loop,
          expr: t.expr,
          ambient: t.ambient,
          timeline: t.frames,
          say: p.say || null,
          lines: p.lines || [],
          pinyinText: (p.pinyin && p.pinyin[0]) ? p.pinyin[0].text : '',
          arcName: arc.name || '',
          logicTrigger: pbStory.chainOf(id, p.scene) || '',
          /* 运镜说明：让老师和孩子都知道「镜头在干什么」 */
          camText: (function () {
            const c = t.cam || {};
            const w = [];
            if (c.x) w.push(c.x[1] < c.x[0] ? '镜头跟拍' : '镜头后退');
            if (c.y) w.push(c.y[1] < c.y[0] ? '镜头上摇' : '镜头下沉');
            if (c.zoom) w.push(c.zoom[1] > c.zoom[0] ? '缓缓推近' : '慢慢拉远');
            if (c.shake) w.push('画面一震');
            return w.join(' · ') || '镜头稳住';
          })(),
          /* 视频内互动节点：在「第一次尝试失败」「情绪低谷」「升华互动」三处停下来问孩子 */
          interaction: (arc.id === 'try1' || arc.id === 'low' || arc.id === 'share') ? {
            kind: 'ask',
            who: (mid.who === 'dou' ? '豆豆' : mid.who === 'dian' ? '点点' : '小AI'),
            q: arc.id === 'share'
              ? '你记住刚才那个办法了吗？'
              : arc.id === 'low'
                ? '它现在有点难过，你想对它说什么？'
                : '你能帮它选一选，接下来该怎么做吗？',
            options: arc.id === 'share'
              ? ['看多了就认识了', '再试一次就好', '我不知道']
              : arc.id === 'low'
                ? ['别难过，我陪你', '算了不学了', '你本来就不行']
                : ['再仔细看一遍', '不学了', '随便猜一个'],
            answer: 0,
            right: arc.id === 'share' ? '记住啦，我们一起学会的！' : '太棒了，是你帮了我！',
            wrong: '没关系，我们再试一次！'
          } : null,
          /* 每一镜就是一段独立的骨骼动画 SVG */
          art: pbArt.toSvg(pbAnim.shotSvg({ action: t.action, mood: p.mood, who: mid.who || 'ai' }, 'k' + i), 640, 400, p.title)
        };
      });
      util.sendJson(res, 200, {
        ok: true, id: id, title: st.title, emoji: st.emoji,
        conceptLabel: st.conceptLabel, grade: grade,
        goal: storyLine ? storyLine.goal : '', insight: storyLine ? storyLine.insight : '',
        shots: shots,
        css: shots.map((s, i) => pbAnim.cssFor(pbTimeline.timelineOf(s.action), 'k' + i)).join('\n')
      });
      return;
    }

    /* /video 已经并进动画片：主入口统一到 /ai-cartoon，旧链接不失效。
       MP4 渲染能力保留在 /video/export（导出与投屏用）。 */
    if (method === 'GET' && pathname === '/video') {
      util.redirect(res, '/ai-cartoon');
      return;
    }
    if (method === 'GET' && (pathname === '/video/export' || pathname === '/export')) {
      const student = ensureStudent(req, res);
      util.sendHtml(res, 200, pages.videoPage(studentBrief(student), query));
      return;
    }

    if (method === 'GET' && (pathname === '/book' || pathname === '/ai-picture-book')) {
      const student = ensureStudent(req, res);
      util.sendHtml(res, 200, pages.bookLibraryPage(studentBrief(student), query));
      return;
    }

    // AI 绘本：阅读器正在读的那一本（?id=learn&grade=1&read=1&embed=1）
    if (method === 'GET' && (pathname === '/book/read' || pathname === '/ai-picture-book/read')) {
      const student = ensureStudent(req, res);
      const data = pb.build(query.id || 'wake', query.grade || student.grade || 1, { pages: query.pages ? Number(query.pages) : 0 });
      if (!data) { util.sendHtml(res, 404, pages.aboutPage(studentBrief(student))); return; }
      util.sendHtml(res, 200, pages.bookReaderPage(data, studentBrief(student), query));
      return;
    }

    if (method === 'GET' && pathname === '/code') {
      const student = ensureStudent(req, res);
      util.sendHtml(res, 200, pages.codePage(studentBrief(student)));
      return;
    }

    if (method === 'GET' && pathname === '/games') {
      const student = ensureStudent(req, res);
      util.sendHtml(res, 200, pages.gamesPage(student));
      return;
    }

    if (method === 'GET' && pathname === '/dashboard') {
      const student = ensureStudent(req, res);
      util.sendHtml(res, 200, pages.dashboardPage(student));
      return;
    }

    if (method === 'GET' && pathname === '/about') {
      const student = ensureStudent(req, res);
      util.sendHtml(res, 200, pages.aboutPage(studentBrief(student)));
      return;
    }

    // ---- 学习报告（可直接打印为 PDF） ----
    if (method === 'GET' && pathname === '/api/report') {
      const student = ensureStudent(req, res);
      util.sendHtml(res, 200, reportHtml(student));
      return;
    }

    /* ================= 教学接口 ================= */

    // 会话信息
    if (method === 'GET' && pathname === '/api/session') {
      const student = ensureStudent(req, res);
      util.sendJson(res, 200, {
        student: studentBrief(student),
        level: content.levelOfGrade(student.grade || 5),
        llm: llm.status(),
        chat: student.chat.slice(-20)
      });
      return;
    }

    // 更新画像
    if (method === 'POST' && pathname === '/api/student') {
      const student = ensureStudent(req, res);
      const body = await util.readJson(req);
      if (typeof body.name === 'string') student.name = body.name.slice(0, 16);
      if (body.grade) student.grade = Math.max(1, Math.min(12, Number(body.grade) || 5));
      if (typeof body.avatar === 'string' && body.avatar) student.avatar = body.avatar.slice(0, 4);
      if (Array.isArray(body.interests)) student.interests = body.interests.slice(0, 8).map(String);
      // 换年级意味着讲解深度变化，重置脚手架记忆避免层级错乱
      student.memory = tutor.freshMemory();
      store.save(student);
      util.sendJson(res, 200, { ok: true, student: studentBrief(student), level: content.levelOfGrade(student.grade) });
      return;
    }

    // 对话（同步 JSON）
    if (method === 'POST' && pathname === '/api/chat') {
      const student = ensureStudent(req, res);
      const body = await util.readJson(req);
      const text = String(body.message || '').trim().slice(0, 500);
      if (!text) { util.sendJson(res, 400, { error: '请输入内容' }); return; }
      const reply = await smartAnswer(student, text, body);
      pushChat(student, 'user', text, { intent: reply.intent });
      pushChat(student, 'assistant', reply.text, { topicId: reply.topicId, source: reply.source });
      store.recordEvent(student, { type: 'chat', topicId: reply.topicId, title: text.slice(0, 30), xp: 3 });
      store.save(student);
      util.sendJson(res, 200, {
        text: reply.text, intent: reply.intent, topicId: reply.topicId,
        topicTitle: reply.topic ? reply.topic.title : null,
        levelId: reply.levelId, step: reply.step, actions: reply.actions,
        related: reply.related || [], noAnswer: !!reply.noAnswer,
        source: reply.source, llmFailed: reply.llmFailed || null, ms: reply.ms
      });
      return;
    }

    // 对话（SSE 流式）
    if (method === 'POST' && pathname === '/api/chat/stream') {
      const student = ensureStudent(req, res);
      const body = await util.readJson(req);
      const text = String(body.message || '').trim().slice(0, 500);
      if (!text) { util.sendJson(res, 400, { error: '请输入内容' }); return; }
      await streamAnswer(res, student, text, body);
      return;
    }

    // 抽题
    if (method === 'GET' && pathname === '/api/quiz') {
      const student = ensureStudent(req, res);
      const lv = content.levelOfGrade(student.grade || 5);
      let questions;
      if (query.topic) {
        questions = content.pickQuestions(query.topic, { count: Number(query.count) || lv.quizCount, difficulty: lv.depth <= 2 ? 2 : 3 });
      } else if (query.mode === 'weak') {
        // 薄弱点优先：先挑正确率低的知识点
        const weak = Object.keys(student.progress)
          .map(id => ({ id, p: student.progress[id] }))
          .filter(x => (x.p.correct + x.p.wrong) > 0 && x.p.correct / (x.p.correct + x.p.wrong) < 0.75)
          .sort((a, b) => a.p.correct / (a.p.correct + a.p.wrong) - b.p.correct / (b.p.correct + b.p.wrong));
        const picked = [];
        for (const w of weak) {
          picked.push.apply(picked, content.pickQuestions(w.id, { count: 1 }));
          if (picked.length >= (Number(query.count) || 5)) break;
        }
        questions = picked.length ? picked : content.pickQuestionsMulti({ domain: query.domain || 'all', levelId: lv.id, count: Number(query.count) || 5, difficulty: lv.depth <= 2 ? 2 : 3 });
      } else {
        questions = content.pickQuestionsMulti({ domain: query.domain || 'all', levelId: lv.id, count: Number(query.count) || 5, difficulty: lv.depth <= 2 ? 2 : 3 });
      }
      util.sendJson(res, 200, { questions, level: lv });
      return;
    }

    // 判题（一次提交一道，服务端决定对错并落库）
    if (method === 'POST' && pathname === '/api/answer') {
      const student = ensureStudent(req, res);
      const body = await util.readJson(req);
      const topic = body.topicId ? content.getTopic(body.topicId) : null;
      const isCorrect = !!body.correct;
      const lv = content.levelOfGrade(student.grade || 5);
      // 错题入本
      if (!isCorrect && body.question) addWrong(student, body);
      if (body.mode === 'game' && typeof body.score === 'number') {
        student.best.quiz = Math.max(student.best.quiz || 0, Math.round(body.score));
      }
      store.recordEvent(student, {
        type: body.mode === 'game' ? 'game' : 'quiz',
        topicId: body.topicId || null,
        title: body.title || (topic ? topic.title + ' 练习' : '随堂练习'),
        score: typeof body.score === 'number' ? body.score : (isCorrect ? 100 : 0),
        correct: isCorrect,
        xp: isCorrect ? 8 : 3
      });
      store.save(student);
      const levelId = body.levelId || lv.id;
      util.sendJson(res, 200, {
        correct: isCorrect,
        feedback: tutor.judge(body.topicId, isCorrect, levelId),
        explain: String(body.explain || ''),
        badges: badgesOf(student)
      });
      return;
    }

    // 订正错题
    if (method === 'POST' && pathname === '/api/wrong/fix') {
      const student = ensureStudent(req, res);
      const body = await util.readJson(req);
      const w = (student.wrongBook || []).find(x => x.id === body.id);
      if (w) {
        w.fixed = true;
        w.fixedAt = Date.now();
        store.recordEvent(student, { type: 'fix', topicId: w.topicId, title: '订正错题', xp: 6 });
      }
      store.save(student);
      util.sendJson(res, 200, { ok: !!w });
      return;
    }

    // 学习行为记录（前端游戏、编程、动画完成后上报）
    if (method === 'POST' && pathname === '/api/event') {
      const student = ensureStudent(req, res);
      const body = await util.readJson(req);
      const ev = store.recordEvent(student, {
        type: String(body.type || 'learn').slice(0, 20),
        topicId: body.topicId ? String(body.topicId).slice(0, 40) : null,
        title: String(body.title || '').slice(0, 60),
        score: typeof body.score === 'number' ? Math.round(body.score) : null,
        correct: typeof body.correct === 'boolean' ? body.correct : null,
        xp: typeof body.xp === 'number' ? Math.min(50, Math.round(body.xp)) : 5,
        detail: String(body.detail || '').slice(0, 200)
      });
      if (body.game && typeof body.score === 'number') {
        student.best[body.game] = Math.max(student.best[body.game] || 0, Math.round(body.score));
      }
      store.save(student);
      util.sendJson(res, 200, { ok: true, event: ev, badges: badgesOf(student), best: student.best });
      return;
    }

    /* 迷宫进度：返回这台机器上已经通关的关卡。
       关卡解锁要用它 —— 没通过第 1 关就不该能跳到第 4 关，
       否则孩子会跳过「顺序」这个地基。 */
    if (method === 'GET' && pathname === '/api/lab/progress') {
      const student = ensureStudent(req, res);
      const done = {};
      (student.events || []).forEach(function (e) {
        if (e.type !== 'code') return;
        const m = /^积木闯关：(.+)$/.exec(e.title || '');
        if (m) done[m[1]] = true;
      });
      util.sendJson(res, 200, { ok: true, done: Object.keys(done) });
      return;
    }

    // 动画：取帧数据
    if (method === 'GET' && pathname === '/api/anim') {
      const id = query.id || 'gradient';
      const data = art.getAnimation(id);
      if (!data) { util.sendJson(res, 404, { error: '找不到该动画' }); return; }
      util.sendJson(res, 200, data);
      return;
    }

    // 绘本：生成
    if (method === 'GET' && pathname === '/api/book') {
      const student = ensureStudent(req, res);
      const grade = Number(query.grade) || student.grade || 5;
      const b = book.generate(query.topic || 'book-cat', grade, Number(query.pages) || 4);
      if (!b) { util.sendJson(res, 404, { error: '找不到该绘本主题' }); return; }
      util.sendJson(res, 200, b);
      return;
    }

    /* 旧口径的「实践小本子」列表，挪到 /api/workbooks，把 /api/books 让给低龄绘本 */
    if (method === 'GET' && (pathname === '/api/workbooks' || pathname === '/api/books/workbooks')) {
      util.sendJson(res, 200, { books: book.list() });
      return;
    }

    /* ---------- AI 绘本模块（低龄段） ---------- */

    // 绘本馆：书目 + 学生进度 + 奖励（含成长树）
    if (method === 'GET' && pathname === '/api/pb/library') {
      const student = ensureStudent(req, res);
      const grade = Number(query.grade) || student.grade || 1;
      const progress = pbProgress(student);
      util.sendJson(res, 200, {
        stories: pb.list(),
        grade: grade,
        band: pb.bandOf(grade),
        junior: pb.isJunior(grade),
        progress: progress,
        tree: pb.treeOf(doneBooks(student), pbStars(student)),
        stats: pb.stats(),
        /* 还没读过的那一本优先推荐；读完了就给最喜欢的那本 */
        recommend: pb.recommend(progress, query.interest, grade),
        /* 根据最近的作答记录，告诉前端下一本该长一点还是短一点 */
        adapt: pb.adapt(progress)
      });
      return;
    }

    // 取一本可读的绘本（按年级分档，含插图、拼音、小问题、练习）
    if (method === 'GET' && pathname === '/api/pb/book') {
      const student = ensureStudent(req, res);
      const grade = Number(query.grade) || student.grade || 1;
      const data = pb.build(query.id || 'wake', grade, {
        pages: query.pages ? Number(query.pages) : 0,
        pinyin: query.pinyin !== '0',
        level: query.level || 'normal'
      });
      if (!data) { util.sendJson(res, 404, { error: '找不到这本绘本' }); return; }
      if (query.record !== '0') {
        store.recordEvent(student, { type: 'story', title: '打开绘本：' + data.title, xp: 2 });
        store.save(student);
      }
      util.sendJson(res, 200, data);
      return;
    }

    // 画面标准：全局系统前缀 + 逐页红线自查（供教案与生图流水线直接取用）
    if (method === 'GET' && pathname === '/api/pb/standard') {
      util.sendJson(res, 200, {
        globalPrefix: pb.GLOBAL_PREFIX,
        artStyle: pb.ART_PROMPT,
        artStyleKeywords: pb.ART_STYLE,
        forbidden: pb.ART_FORBIDDEN,
        cameras: require('./lib/pb-art').CAMERAS,
        moods: require('./lib/pb-cast').MOODS,
        arc: pbStory.ARC,
        cast: pbStory.CAST,
        kidView: pbStory.KID_VIEW,
        storyLines: pbStory.LINES,
        selfCheck: pb.selfCheck(),
        stats: pb.stats()
      });
      return;
    }

    // 绘本列表：按年级与主题取书（创作工坊「AI 绘本」标签页用）
    if (method === 'GET' && pathname === '/api/books') {
      const student = ensureStudent(req, res);
      const grade = Number(query.grade) || student.grade || 1;
      const theme = query.theme || 'all';
      const progress = pbProgress(student);
      let list = pb.list();
      if (theme && theme !== 'all') {
        const byId = pb.THEMES.filter(th => th.id === theme)[0];
        const byName = pb.THEMES.filter(th => th.hint === theme || th.name === theme)[0];
        const key = (byId || byName || {}).id;
        /* 主题名对不上时退化成关键词匹配，别把书单筛空 */
        const allowed = key ? pb.byTheme(key).map(s => s.id)
          : pb.ALL.filter(s => (pb.themeIdsOf(s)).length && (s.conceptLabel + s.logline + s.title).indexOf(theme) >= 0).map(s => s.id);
        if (allowed.length) list = list.filter(b => allowed.indexOf(b.id) >= 0);
      }
      util.sendJson(res, 200, {
        grade: grade, band: pb.bandOf(grade), junior: pb.isJunior(grade),
        theme: theme, themes: pb.THEMES,
        stories: list.map(b => Object.assign({}, b, { progress: progress.books[b.id] || null })),
        recommend: pb.recommend(progress, query.interest, grade),
        adapt: pb.adapt(progress)
      });
      return;
    }

    // 一键生成绘本：按主题与年级生成完整分页脚本（含画面 Prompt、台词、互动设计）
    if (method === 'POST' && pathname === '/api/books/generate') {
      const student = ensureStudent(req, res);
      const body = await readJsonSafe(req);
      const grade = Number(body.grade) || student.grade || 1;
      const want = String(body.prompt || body.theme || '').trim();
      const r = await generateBook(want, grade);
      util.sendJson(res, 200, r);
      return;
    }

    // AI 视频：渲染绘本短片（异步任务）
    if (method === 'POST' && pathname === '/api/video/render') {
      const student = ensureStudent(req, res);
      const body = await readJsonSafe(req);
      const av = videoJobs.available();
      if (!av.ok) { util.sendJson(res, 503, { ok: false, error: av.reason, available: av }); return; }
      const grade = Number(body.grade) || student.grade || 1;
      const id = body.id || (pb.list()[0] || {}).id;
      const st = pb.get(id);
      if (!st) { util.sendJson(res, 404, { ok: false, error: '找不到这本绘本' }); return; }
      const book = pb.build(id, grade, {});
      if (body.pages) book.pages = book.pages.slice(0, Math.max(1, Number(body.pages)));
      const job = videoJobs.create(book, { subtitle: body.subtitle !== false, voice: body.voice !== false });
      util.sendJson(res, 202, { ok: true, job: job, available: av });
      return;
    }
    // AI 视频：查任务进度
    if (method === 'GET' && pathname === '/api/video/job') {
      const j = videoJobs.get(query.id || '');
      if (!j) { util.sendJson(res, 404, { ok: false, error: '找不到这个任务' }); return; }
      util.sendJson(res, 200, { ok: true, job: j });
      return;
    }
    // AI 视频：作品列表
    if (method === 'GET' && pathname === '/api/video/list') {
      const av = videoJobs.available();
      util.sendJson(res, 200, { ok: true, available: av, jobs: videoJobs.list() });
      return;
    }

    // 对话智能体入口：低龄化回答 + 可变成新绘本页的图文
    if (method === 'POST' && pathname === '/api/agent/ask') {
      const body = await readJsonSafe(req);
      const question = String(body.question || body.q || '').trim();
      if (!question) { util.sendJson(res, 400, { error: '请先说说你想问什么呀' }); return; }
      const student = ensureStudent(req, res);
      const grade = Number(body.grade) || student.grade || 1;
      const r = pb.mentorAnswer(body.bookId || 'wake', question);
      const page = {
        title: String(question).slice(0, 14) || '我的问题',
        lines: splitSentences(r.text, 3, 18),
        art: pbAnswerArt(question, r.text)
      };
      /* 高年级走主教学引擎，低年级走伴读话术，保证答案的深浅合适 */
      const tutor = grade > 3 ? tutor.answer({ question: question, grade: grade, student: student }) : null;
      util.sendJson(res, 200, {
        ok: true,
        answer: r.text,
        text: r.text,
        tip: r.tip || '',
        matched: r.matched || null,
        page: page,
        grade: grade,
        junior: pb.isJunior(grade),
        tutor: tutor ? { text: tutor.text, topic: tutor.topic ? tutor.topic.title : null, actions: tutor.actions || [] } : null
      });
      return;
    }

    // 分镜：把某一页的五层结构、镜头、彩蛋原样返回（供教案与生图提示词使用）
    if (method === 'GET' && pathname === '/api/pb/storyboard') {
      const id = query.id || 'wake';
      const s = pb.get(id);
      if (!s) { util.sendJson(res, 404, { error: '找不到这本绘本' }); return; }
      const b = pb.build(id, Number(query.grade) || 2, {});
      util.sendJson(res, 200, {
        id: s.id, title: s.title, emoji: s.emoji, conceptLabel: s.conceptLabel, logline: s.logline,
        pages: b.pages.map(p => Object.assign({
          index: p.index, title: p.title, mood: p.mood, narration: p.lines.join(''),
          say: p.say, action: p.action, fx: p.fx, art: p.art, layers: pbLayers.LAYERS[p.scene] || null
        }))
      });
      return;
    }

    // 绘本馆：镜头与情绪的全景统计（用于检查节奏）
    if (method === 'GET' && pathname === '/api/pb/panorama') {
      const cams = {}, moods = {}, eggs = {};
      pb.ALL.forEach(s => s.pages.forEach(p => {
        const L = pbLayers.LAYERS[p.scene] || {};
        cams[L.camera || '未指定'] = (cams[L.camera || '未指定'] || 0) + 1;
        const m = (L.atmos || {}).mood || p.mood;
        moods[m] = (moods[m] || 0) + 1;
        (L.egg || []).forEach(e => { eggs[e.kind] = (eggs[e.kind] || 0) + 1; });
      }));
      util.sendJson(res, 200, {
        stories: pb.ALL.length, pages: pb.ALL.reduce((n, s) => n + s.pages.length, 0),
        cameras: cams, moods: moods, eggs: eggs,
        cameraNames: Object.keys(require('./lib/pb-art').CAMERAS),
        moodNames: Object.keys(require('./lib/pb-cast').MOODS)
      });
      return;
    }

    // 伴读问答：学生点「问 AI」
    if (method === 'POST' && pathname === '/api/pb/ask') {
      const student = ensureStudent(req, res);
      const body = await readJsonSafe(req);
      const r = pb.mentorAnswer(body.bookId || 'wake', body.question || '');
      store.recordEvent(student, { type: 'ask', title: '绘本提问：' + String(body.question || '').slice(0, 20), xp: 1 });
      store.save(student);
      util.sendJson(res, 200, {
        answer: r.text, matched: r.matched, tip: r.tip,
        /* 回答可以变成新的一页绘本内容（图文由服务端现场生成） */
        page: {
          title: String(body.question || '').slice(0, 14) || '我的问题',
          lines: splitSentences(r.text, 3, 18),
          art: pbAnswerArt(String(body.question || ''), r.text)
        }
      });
      return;
    }

    // 小问题与练习的作答
    if (method === 'POST' && pathname === '/api/pb/answer') {
      const student = ensureStudent(req, res);
      const body = await readJsonSafe(req);
      const correct = body.correct === true || body.correct === 'true';
      store.recordEvent(student, {
        type: 'quiz',
        topicId: 'pb-' + (body.bookId || 'day'),
        title: (body.kind === 'exercise' ? '绘本练习：' : '绘本小问题：') + String(body.title || '').slice(0, 26),
        score: correct ? 100 : 0,
        xp: correct ? 4 : 1
      });
      if (!correct) {
        addWrong(student, {
          topicId: 'pb-' + (body.bookId || 'day'),
          question: String(body.question || '绘本小问题'),
          answer: String(body.answer || ''),
          mine: String(body.mine || ''),
          explain: String(body.explain || ''),
          title: String(body.title || '绘本小问题')
        });
      }
      store.save(student);
      util.sendJson(res, 200, { ok: true, correct: correct, feedback: correct ? '答对啦！' : '没关系，我们再读一遍这一页。' });
      return;
    }

    // 读完一本：结算星星、贴纸、徽章、成长树
    if (method === 'POST' && pathname === '/api/pb/finish') {
      const student = ensureStudent(req, res);
      const body = await readJsonSafe(req);
      const progress = pbProgress(student);
      const result = pb.settle(progress, {
        bookId: body.bookId || 'day',
        stars: Math.max(0, Math.min(30, Number(body.stars) || 0)),
        correct: Number(body.correct) || 0,
        total: Number(body.total) || 0
      });
      setPbProgress(student, result.progress);
      store.recordEvent(student, { type: 'story', title: '读完绘本：' + String(body.title || body.bookId || ''), score: result.gained, xp: 8 });
      store.save(student);
      util.sendJson(res, 200, {
        ok: true, gained: result.gained, sticker: result.sticker, newSticker: result.newSticker,
        newBadges: result.newBadges, doneCount: result.doneCount, totalStars: result.totalStars,
        tree: result.tree, badges: badgesOf(student),
        /* 下一本该长一点还是短一点，由引擎根据最近的作答算出来 */
        next: result.next
      });
      return;
    }

    // 绘本模块内直接向主对话智能体提问（复用教学引擎，走低龄化提示）
    if (method === 'POST' && pathname === '/api/pb/chat') {
      const student = ensureStudent(req, res);
      const body = await readJsonSafe(req);
      const level = pbLevel(student);
      const r = tutor.answer(String(body.message || ''), {
        student: student, grade: student.grade, level: level,
        history: [], topicId: null
      });
      store.recordEvent(student, { type: 'ask', title: '绘本里提问：' + String(body.message || '').slice(0, 20), xp: 1 });
      store.save(student);
      util.sendJson(res, 200, { text: r.text, topicId: r.topicId, topicTitle: r.topicTitle, actions: r.actions || [] });
      return;
    }

    // 动画与绘本的完成上报走 /api/event，这里提供内容清单
    if (method === 'GET' && pathname === '/api/anims') {
      util.sendJson(res, 200, { animations: art.list() });
      return;
    }

    // 游戏数据
    if (method === 'GET' && pathname === '/api/games/data') {
      const student = ensureStudent(req, res);
      const kind = query.kind || 'label';
      const grade = query.grade ? Number(query.grade) : (student.grade || 5);
      util.sendJson(res, 200, activities.data(kind, grade));
      return;
    }

    // 设置：读取
    if (method === 'GET' && pathname === '/api/config') {
      util.sendJson(res, 200, { status: llm.status(), presets: llm.PRESETS, config: (() => {
        const c = llm.config();
        return { provider: c.provider, endpoint: c.endpoint, model: c.model, hasKey: !!c.apiKey, temperature: c.temperature };
      })() });
      return;
    }

    // 设置：保存（只写本机 data/config.json）
    if (method === 'POST' && pathname === '/api/config') {
      const body = await util.readJson(req);
      const cfgFile = llm.CONFIG_FILE;
      let cfg = {};
      try { cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch (e) { cfg = {}; }
      if (typeof body.provider === 'string') cfg.provider = body.provider;
      if (typeof body.endpoint === 'string') cfg.endpoint = body.endpoint.trim();
      if (typeof body.model === 'string') cfg.model = body.model.trim();
      if (typeof body.apiKey === 'string') cfg.apiKey = body.apiKey.trim();
      if (typeof body.temperature === 'number') cfg.temperature = Math.max(0, Math.min(1.5, body.temperature));
      fs.mkdirSync(path.dirname(cfgFile), { recursive: true });
      fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2), 'utf8');
      const t = await llm.test();
      util.sendJson(res, 200, { ok: true, test: t, status: llm.status() });
      return;
    }

    // 重置档案
    if (method === 'POST' && pathname === '/api/reset') {
      const student = ensureStudent(req, res);
      const fresh = store.create({ name: student.name, grade: student.grade, avatar: student.avatar });
      util.setCookie(res, 'aiq_sid', fresh.id, 60 * 60 * 24 * 365);
      util.sendJson(res, 200, { ok: true, student: studentBrief(fresh) });
      return;
    }

    // 知识库检索（供课程页搜索与外部集成）
    if (method === 'GET' && pathname === '/api/search') {
      const list = content.search(query.q || '', Number(query.limit) || 8);
      util.sendJson(res, 200, { results: list.map(t => ({ id: t.id, title: t.title, emoji: t.emoji, know: t.objective.know, domain: t.domain })) });
      return;
    }

    // 课程结构
    if (method === 'GET' && pathname === '/api/courses') {
      util.sendJson(res, 200, {
        domains: content.DOMAINS,
        levels: content.LEVELS,
        topics: content.ALL.map(t => ({
          id: t.id, title: t.title, emoji: t.emoji, domain: t.domain, bands: t.bands,
          gradeMin: t.gradeMin, gradeMax: t.gradeMax, know: t.objective.know, questions: t.quiz.length
        })),
        stats: content.stats()
      });
      return;
    }

    // 健康检查
    if (pathname === '/api/health') {
      const v = content.validate();
      util.sendJson(res, 200, { ok: v.ok, topics: v.topics, questions: v.questions, llm: llm.status(), errors: v.errors.slice(0, 5) });
      return;
    }

    util.sendText(res, 404, '页面不存在');
  } catch (err) {
    console.error('[error]', req.method, pathname, err && err.message);
    if (res.headersSent) { try { res.end(); } catch (e) {} return; }
    util.sendJson(res, 500, { error: String(err && err.message || err) });
  }
});

/* ================= 学习报告 ================= */
function reportHtml(student) {
  const sum = store.summarize(student);
  const grade = student.grade || 5;
  const lv = content.levelOfGrade(grade);
  const rows = content.ALL.filter(t => student.progress[t.id]).map(t => {
    const p = student.progress[t.id];
    const total = p.correct + p.wrong;
    const acc = total ? Math.round(p.correct / total * 100) : 0;
    return '<tr><td>' + util.esc(t.emoji + ' ' + t.title) + '</td><td>' + util.esc(t.domainName) + '</td>' +
      '<td>' + (p.status === 'done' ? '已掌握' : '学习中') + '</td><td>' + (p.mastery || 0) + '</td><td>' + acc + '%</td><td>' + p.attempts + '</td></tr>';
  }).join('');
  const events = (student.events || []).slice(0, 30).map(e =>
    '<tr><td>' + new Date(e.at).toLocaleString('zh-CN') + '</td><td>' + util.esc(e.type) + '</td><td>' + util.esc(e.title || '') + '</td><td>' + (e.score === null ? '—' : e.score) + '</td></tr>').join('');

  return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>' + util.esc(student.name || '学生') + ' · AI 通识学习报告</title>' +
  '<style>body{font-family:"Microsoft YaHei",system-ui,sans-serif;max-width:900px;margin:32px auto;padding:0 20px;color:#243044;line-height:1.7}' +
  'h1{border-bottom:3px solid #1f6f5c;padding-bottom:8px}h2{margin-top:28px;color:#1f6f5c}' +
  'table{width:100%;border-collapse:collapse;margin:12px 0;font-size:14px}th,td{border:1px solid #dfe4ea;padding:7px 9px;text-align:left}th{background:#eef4f1}' +
  '.kpi{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0}.kpi div{background:#f4f8f6;border:1px solid #dbe6e1;border-radius:10px;padding:10px 16px}' +
  '.muted{color:#6b7684;font-size:13px}@media print{.no-print{display:none}}</style></head><body>' +
  '<h1>AI 通识学习报告</h1>' +
  '<p class="muted">学生：' + util.esc(student.name || '未填写') + '　|　年级：' + grade + ' 年级（' + util.esc(lv.name) + '）　|　生成时间：' + new Date().toLocaleString('zh-CN') + '</p>' +
  '<div class="kpi"><div>学习行为 <b>' + sum.totalEvents + '</b> 次</div><div>掌握知识点 <b>' + sum.topicsDone + '</b> / ' + content.ALL.length + '</div>' +
  '<div>答题正确率 <b>' + sum.accuracy + '%</b></div><div>连续学习 <b>' + sum.streak + '</b> 天</div><div>徽章 <b>' + sum.badges + '</b> 枚</div></div>' +
  '<h2>一、知识点掌握明细</h2>' + (rows ? '<table><tr><th>知识点</th><th>领域</th><th>状态</th><th>最好成绩</th><th>正确率</th><th>练习次数</th></tr>' + rows + '</table>' : '<p class="muted">暂无学习记录。</p>') +
  '<h2>二、最近学习记录</h2>' + (events ? '<table><tr><th>时间</th><th>类型</th><th>内容</th><th>成绩</th></tr>' + events + '</table>' : '<p class="muted">暂无记录。</p>') +
  '<h2>三、学习建议</h2><ul>' +
  (sum.accuracy < 60 && sum.answered ? '<li>整体正确率 ' + sum.accuracy + '%，建议回到概念讲解，用绘本与动画重建直觉后再做题。</li>' : '') +
  (sum.accuracy >= 60 && sum.accuracy < 85 ? '<li>正确率 ' + sum.accuracy + '%，建议通过错题订正与「讲给别人听」巩固。</li>' : '') +
  (sum.accuracy >= 85 ? '<li>正确率 ' + sum.accuracy + '%，可以进入更进阶的主题：模型评估、伦理讨论、项目实践。</li>' : '') +
  '<li>保持每天 10~15 分钟的连续学习，效果优于一次性长时间学习。</li>' +
  '<li>鼓励学生用「刚才学的这个，我给你讲讲」的方式复述，这是检验理解最有效的方法。</li></ul>' +
  '<p class="muted">本报告由「启明 AI 课堂」自动生成，数据保存在本机服务端。</p>' +
  '<p class="no-print"><button onclick="window.print()">打印 / 存为 PDF</button></p></body></html>';
}

/* ================= 启动 ================= */
function start() {
  const v = content.validate();
  if (!v.ok) {
    console.error('内容库校验失败：');
    v.errors.slice(0, 10).forEach(e => console.error('  - ' + e));
  }
  server.on('error', err => {
    if (err && err.code === 'EADDRINUSE') {
      console.error('');
      console.error('  ✗ 端口 ' + PORT + ' 已被占用。');
      console.error('    可能是上一次的服务还在运行。可以：');
      console.error('      1) 直接使用已在运行的服务（浏览器打开 http://' + HOST + ':' + PORT + '）');
      console.error('      2) 换一个端口启动：set PORT=8091 && node server/server.js');
      console.error('');
      process.exit(2);
    }
    console.error('服务启动失败：', err && err.message);
    process.exit(1);
  });
  server.listen(PORT, HOST, () => {
    const st = llm.status();
    console.log('');
    console.log('  ✦ 启明 AI 课堂 · K12 人工智能通识课教学助手');
    console.log('  ─────────────────────────────────────────────');
    console.log('  访问地址： http://' + HOST + ':' + PORT);
    console.log('  课程内容： ' + v.topics + ' 个知识点 / ' + v.questions + ' 道题（校验' + (v.ok ? '通过' : '异常') + '）');
    console.log('  讲解模式： ' + (st.active ? '大模型（' + st.providerName + ' · ' + st.model + '）' : '本地教学引擎（未配置大模型）'));
    console.log('  数据目录： data/');
    console.log('  按 Ctrl + C 停止服务');
    console.log('');
  });
}

if (require.main === module) start();

module.exports = { server, start, store };
