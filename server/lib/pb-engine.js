/**
 * AI 绘本 · 引擎（升级版）
 *
 * 面向小学 1～3 年级（6～9 岁）。这一版的重点：
 *   1) 按年级分档：1 年级 8 页 / 每页 1 句；2 年级 10 页 / 每页 2 句；3 年级 12 页 / 每页 2~3 句
 *   2) 互动按年级分级：低年级以「点、拖、吹、拍」为主，中年级加「选、找」，高年级加「说、排序」
 *   3) 自适应：连续答错就降低难度并加大鼓励；正确率高就换更长、互动更多的故事
 *   4) 禁用抽象术语（机器学习、神经网络、算法……），由内容校验强制拦截
 *   5) 校验情绪曲线：每本必须有好奇→问题→着急→想办法→发现→再试→挫折→成功→互动→告别
 */
'use strict';

const { STORIES } = require('../content/pb-index');
const pinyin = require('./pinyin');
const A = require('./pb-art');
const scenes = require('./pb-scenes');
const pbLayers = require('./pb-layers');
const pbStory = require('./pb-story');
const cast = require('./pb-cast');

const ALL = STORIES;

/* ================= 年级分档 ================= */
const BANDS = {
  1: {
    grade: 1, name: '一年级', pageCount: 8, maxLines: 1, maxChars: 13,
    actions: ['tap', 'drag', 'blow', 'clap'], questionEvery: 3, ttsRate: 0.82, ttsPitch: 1.25,
    label: '一句话一页，多动手'
  },
  2: {
    grade: 2, name: '二年级', pageCount: 10, maxLines: 2, maxChars: 15,
    actions: ['tap', 'drag', 'blow', 'clap', 'choose', 'find'], questionEvery: 3, ttsRate: 0.92, ttsPitch: 1.18,
    label: '两句话一页，会选会找'
  },
  3: {
    grade: 3, name: '三年级', pageCount: 12, maxLines: 3, maxChars: 20,
    actions: ['tap', 'drag', 'blow', 'clap', 'choose', 'find', 'say', 'order'], questionEvery: 4, ttsRate: 1.0, ttsPitch: 1.1,
    label: '两三句话一页，还要说一说'
  }
};
function bandOf(grade) {
  const g = Number(grade) || 1;
  if (g <= 1) return BANDS[1];
  if (g === 2) return BANDS[2];
  return BANDS[3];
}
function isJunior(grade) { return (Number(grade) || 1) <= 3; }

/* ================= 低龄化主题胶囊（绘本馆顶部的彩色筛选条） ================= */
/**
 * 每个主题：emoji + 孩子说的话 + 括号里的认知点。
 * 刻意避开「卷积核 / 梯度下降」这类硬核词，全部换成孩子看得懂的说法。
 */
const THEMES = [
  { id: 'see',   emoji: '🐱', name: '认猫猫',  hint: 'AI 能看',     keywords: ['看', '眼睛', '图片', '认出', '猫'] },
  { id: 'hear',  emoji: '🎵', name: '听声音',  hint: 'AI 能听',     keywords: ['听', '耳朵', '声音', '说话', '讲'] },
  { id: 'who',   emoji: '🤖', name: '我是谁',  hint: 'AI 是什么',   keywords: ['是什么', '醒来', '会什么', '在哪里'] },
  { id: 'oops',  emoji: '😢', name: '犯错啦',  hint: 'AI 会犯错',   keywords: ['错', '犯错', '再来一次', '教'] },
  { id: 'play',  emoji: '🤝', name: '一起玩',  hint: '人和 AI 的关系', keywords: ['一起', '朋友', '陪', '照顾'] }
];
/** 同一本书可以属于多个主题；按认知点与故事简介归类 */
function themeIdsOf(story) {
  const hay = (story.conceptLabel || '') + (story.logline || '') + (story.title || '');
  const hit = THEMES.filter(th => th.keywords.some(k => hay.indexOf(k) >= 0)).map(th => th.id);
  return hit.length ? hit : ['who'];
}

/* ================= 强制画风（写进每一条分镜提示词） ================= */
/** 精装绘本的画风关键词，缺一个都算不合格 */
/* ================= 画风基准（低龄去诡异化 v5.0） =================
 * 注意：这一版和「精装绘本 / 皮克斯级光影 / 细节丰富」是**相反**的路线。
 * 低龄（2~6 岁）画面的第一原则是「绝对安全与可爱」：
 * 画面信息越精炼、色彩越明亮、线条越圆润，诡异感越低。
 * 宁可简单到极点，绝不复杂到诡异。
 */
const ART_STYLE = ['极简儿童插画', '高调平涂', '马卡龙色系', '圆润粗描边', '无写实结构', '单一柔和光源', '背景元素极少'];
const ART_PROMPT = '极简儿童插画，高调平涂照明，马卡龙色系，圆润粗描边，无写实结构，单一柔和光源，背景元素极少（不超过 3 个）。';
/** 低龄画面的负面词：写实、复杂光影、畸形、恐怖、信息过载，全部禁止 */
const ART_NEGATIVE = 'uncanny, realistic, 3D render, detailed face, extra fingers, distorted anatomy, missing limbs, ' +
  'creepy, dark shadows, realistic textures, complex background, depth of field, bokeh, cinematic lighting, ' +
  'volumetric light, teeth, eyelashes, pores, wrinkles, harsh contrast, deep colors, horror, sharp edges, ' +
  'multiple limbs, fused body parts, twisted joints, complex perspective, foreshortening';
/** 明令禁止的画风与画面 */
const ART_FORBIDDEN = ['写实结构', '复杂光影', '大面积阴影', '畸形手脚', '多指', '写实背景', '恐怖', '阴暗', '信息过载', '大透视', '深色', '五官写实'];

/**
 * 一键全局系统前缀：加在所有生图 / 生动画指令最前面。
 *
 * 第一段是「绝对安全与可爱」这条最高原则 —— 它压过后面所有的画面要求。
 * 第二段才是故事要求（因果链、弧光、性格缺陷），两者不冲突。
 */
const GLOBAL_PREFIX = '你是一位专门为 2-6 岁幼儿绘制绘本的极简主义插画师。你的画面必须是绝对安全、可爱、明亮的。' +
  '禁止任何写实结构、复杂光影和夸张透视。角色必须 1:1~1:1.5 头身比，五官极简对称（只有圆眼睛和曲线嘴，' +
  '不画鼻子、耳朵、眉毛、牙齿），四肢圆润无关节、连指手套状的手。背景元素不超过 3 个，无复杂遮挡，无框中框。' +
  '采用高调平涂照明，单层柔和光源，马卡龙 / 莫兰迪色系且全画面不超过 5 色，禁止大面积黑影、禁止深色。' +
  '每页角色只做一个动作，关节转动不超过 45 度（手臂）/ 30 度（腿），绝不出现瞬间切换。' +
  '任何带有写实感、恐怖感、畸形感的输出，均视为无效。' +
  '你的故事必须有严谨的因果逻辑链，遵循「目标—障碍—三次尝试—领悟」的儿童故事弧光，每一步都由上一步的事件引起。' +
  '你的角色必须有性格缺陷、有口头禅、有情绪起伏，圆润软萌，会向屏幕外的孩子求助、道歉、分享功劳。' +
  '任何达不到此标准的输出，均视为无效。';

/** 验收红线：逐页自查，返回不达标的页与原因 */
function selfCheck() {
  const problems = [];
  const P = require('./pb-detail');
  ALL.forEach(s => {
    s.pages.forEach(p => {
      const L = pbLayers.LAYERS[p.scene];
      const mid = (L && L.mid) || {};
      const push = w => problems.push({ book: s.id, page: p.index, scene: p.scene, why: w });
      if (!L) { push('没有五层编排'); return; }
      const roomItems = (L.back && L.back.room && P.ROOMS[L.back.room]) || (L.back && L.back.items) || [];
      if (roomItems.length < 5) push('背景细节不足 5 件');
      if (!L.front || !L.front.length) push('没有前景层');
      if (!L.atmos || !L.atmos.source) push('没有指定光源');
      if (!L.atmos || !L.atmos.shadow) push('没有指定阴影');
      if (!mid.pose || mid.pose === 'stand') push('角色站直不动');
      if (!mid.expr) push('没有微表情');
      if (!mid.partner && !mid.prop) push('没有物理接触对象');
      if (!L.egg || !L.egg.length) push('没有彩蛋');
      /* —— 故事逻辑 —— */
      if (!pbStory.arcOf(s.id, p.scene)) push('没有归入黄金八步');
      if (!pbStory.chainOf(s.id, p.scene)) push('没有因果触发点');
    });
  });
  /* —— 整本层面的故事逻辑与孩子视角 —— */
  ALL.forEach(s => {
    const story = pbStory.of(s.id);
    if (!story) { problems.push({ book: s.id, page: 0, why: '没有故事主线' }); return; }
    const steps = s.pages.map(p => story.arc[p.scene]).filter(Boolean);
    pbStory.ARC_IDS.forEach(a => {
      if (steps.indexOf(a) < 0) problems.push({ book: s.id, page: 0, why: '黄金八步缺少「' + pbStory.ARC_NAME[a] + '」' });
    });
    if (!story.goal) problems.push({ book: s.id, page: 0, why: '没有明确目标' });
    if (!story.obstacle) problems.push({ book: s.id, page: 0, why: '没有明确障碍' });
    if (!story.tries || story.tries.length < 3) problems.push({ book: s.id, page: 0, why: '没有三次尝试' });
    if (!story.insight) problems.push({ book: s.id, page: 0, why: '没有领悟' });
    const KID_RE = {
      ask: /你能帮我|帮我看看|你来看看|你帮我|帮帮我|你陪我|再念一遍|再听我讲/,
      sorry: /对不起|我错了|我又错|鼓励我|别生气|原谅/,
      share: /是我们|我们一起|多亏你|幸好有你|功劳|谢谢你|和你一起|是你陪/
    };
    Object.keys(KID_RE).forEach(k => {
      if (!s.pages.some(p => p.say && KID_RE[k].test(p.say.text))) {
        problems.push({ book: s.id, page: 0, why: '缺少「' + pbStory.KID_VIEW[k].name + '」' });
      }
    });
    (s.cast || []).forEach(who => {
      const c = pbStory.CAST[who];
      if (!c) { problems.push({ book: s.id, page: 0, why: '角色未登记人设：' + who }); return; }
      if (!c.flaw) problems.push({ book: s.id, page: 0, why: c.name + ' 没有性格缺陷' });
      if (!c.catch || !c.catch.length) problems.push({ book: s.id, page: 0, why: c.name + ' 没有口头禅' });
      if (!c.growth) problems.push({ book: s.id, page: 0, why: c.name + ' 没有成长弧光' });
    });
  });
  return { ok: problems.length === 0, pages: ALL.reduce((n, s) => n + s.pages.length, 0), problems };
}

/* ================= 禁用词（抽象术语必须转成孩子能懂的话） ================= */
const BANNED = [
  { re: /机器学习/, good: '「AI 看很多很多图片，就学会了」' },
  { re: /深度学习/, good: '「AI 一层一层地看，看得越来越细」' },
  { re: /神经网络/, good: '「AI 身体里有很多很多小开关」' },
  { re: /算法/, good: '「AI 做事的小步骤」' },
  { re: /训练数据|训练集|数据集/, good: '「AI 的学习卡片」' },
  { re: /模型(train|ing)?/, good: '「AI 脑袋里记住的样子」' },
  { re: /参数|权重|梯度/, good: '（低龄段不要出现，换成看得见的动作）' },
  { re: /人工智能/, good: '「一个很会帮忙的聪明朋友」' },
  { re: /语音识别/, good: '「一双会听声音的耳朵」' },
  { re: /图像识别/, good: '「一双会看东西的眼睛」' },
  { re: /标注/, good: '「告诉它哪个对」' },
  { re: /特征提取/, good: '「记住特别的地方」' }
];
/** 检查一段文字里有没有不该出现的抽象词 */
function bannedIn(text) {
  const hits = [];
  BANNED.forEach(b => { if (b.re.test(String(text))) hits.push(b.re.source + ' → 建议改成 ' + b.good); });
  return hits;
}

/* ================= 情绪曲线 ================= */
/** 每本必须覆盖的情绪节拍，缺一个就报错 */
const REQUIRED_BEATS = ['curious', 'problem', 'idea', 'clue', 'success'];

/* ================= 互动难度分级 ================= */
const ACTION_LEVEL = { tap: 1, drag: 1, blow: 1, clap: 1, choose: 2, find: 2, say: 3, order: 3 };

/* ================= 读完后的游戏（每本三个，按年级挑） ================= */
const EXERCISES = {
  choose: [
    { id: 'c1', level: 1, prompt: '下面哪些事情，小AI 能做？', options: ['听懂你说话', '帮你找照片', '真的心疼你', '讲一个故事'], answer: [0, 1, 3],
      tip: '小AI 会听、会看、会说话，可是它没有感情，不会真的心疼你。' },
    { id: 'c2', level: 1, prompt: '哪些事情，它们现在做不到？', options: ['认出照片里的小猫', '真的喜欢你', '自己决定要学什么', '把说的话变成字'], answer: [1, 2],
      tip: '它们没有感情，也不能自己决定学什么，这些都要人来定。' },
    { id: 'c3', level: 2, prompt: '哪些事情，它们很擅长？', options: ['很吵的地方也一次听清', '很快看完很多张图片', '记住很多很多资料', '明白你为什么会难过'], answer: [1, 2],
      tip: '它们算得快、记得多；可是太吵就容易听错，也不懂你的心情。' },
    { id: 'c4', level: 2, prompt: '下面说法，哪些是对的？', options: ['它们是叔叔阿姨做出来的', '它们有时候会认错', '它们天生就会认猫', '要人教它们才会'], answer: [0, 1, 3],
      tip: '它们是做出来的，要人教，也会犯错。' }
  ],
  match: [
    { id: 'm1', level: 1, prompt: '把本领和它的「家」连起来', pairs: [
      { left: '👂 听懂说话', right: '🔊 会回答的音箱' },
      { left: '👀 认出照片', right: '📷 门口的摄像头' },
      { left: '🗣️ 会讲故事', right: '📱 妈妈的手机' }
    ], tip: '能听、能看、能说话的本领，住在不同的机器里。' },
    { id: 'm2', level: 2, prompt: '把说法连到对应的意思', pairs: [
      { left: '声音变成波浪', right: '听懂话的第一步' },
      { left: '图片变成小格子', right: '机器看图的方式' },
      { left: '给它看很多图片', right: '它是怎么学会的' }
    ], tip: '听、看、学，各有各的做法，但都要先把世界变成数字。' },
    { id: 'm3', level: 2, prompt: '把能做和不能做分开', pairs: [
      { left: '✅ 帮医生看片子', right: '可以做的好事' },
      { left: '❌ 替你做所有决定', right: '不可以做的事' },
      { left: '✅ 给你读故事', right: '可以做的好事' }
    ], tip: '它们能帮忙，但决定权在我们手里。' }
  ],
  order: [
    { id: 'o1', level: 3, prompt: '把「学会认猫」的步骤排好顺序', items: ['人给它看很多猫的图片', '它慢慢找到猫的样子', '给它一张新图片试试', '它说出了「这是猫」'],
      tip: '先有例子 → 再找规律 → 然后才能认新的图片。' },
    { id: 'o2', level: 3, prompt: '把「听懂一句话」的步骤排好顺序', items: ['我们说话，声音变成波浪', '它把波浪切成一小段', '每一段去找一个字', '连起来就知道意思了'],
      tip: '声音 → 小段 → 找字 → 明白意思。' },
    { id: 'o3', level: 3, prompt: '把「图片进到机器里」的步骤排好顺序', items: ['拍下一张照片', '照片被分成很多小格子', '每格记下一个数字', '它开始看这些数字'],
      tip: '机器眼里的图片，就是一堆数字。' }
  ],
  open: [
    { id: 'p1', level: 3, prompt: '如果你来教小AI 认一种动物，你会怎么做？', hints: ['给它看很多这种动物的图片', '也给它看「不是这种动物」的图片', '它认错了就告诉它哪里不对'],
      tip: '好办法！例子越多、越丰富，它就学得越好。' },
    { id: 'p2', level: 3, prompt: '你觉得小AI 应该学会做哪些好事？为什么？', hints: ['帮人找东西', '给小朋友读故事', '帮医生看片子'],
      tip: '本领要用在帮助别人的地方，这就是「负责任地使用」。' }
  ]
};
/** 按年级挑三个游戏 */
function pickExercises(grade, seed) {
  const g = Number(grade) || 1;
  const out = [];
  const types = g <= 1 ? ['choose'] : g === 2 ? ['choose', 'match'] : ['choose', 'match', 'order'];
  const s = String(seed || 'x');
  types.forEach((t, i) => {
    const pool = (EXERCISES[t] || []).filter(e => e.level <= g);
    if (!pool.length) return;
    out.push(Object.assign({ type: t }, pool[(s.length + i) % pool.length]));
  });
  if (g >= 3) out.push(Object.assign({ type: 'open' }, EXERCISES.open[s.length % EXERCISES.open.length]));
  return out;
}

/* ================= 取书 ================= */
function list() {
  return ALL.map(s => ({
    id: s.id, title: s.title, emoji: s.emoji, concept: s.concept,
    conceptLabel: s.conceptLabel, logline: s.logline, cast: s.cast,
    interests: s.interests || [],
    themes: themeIdsOf(s),
    ageLabel: ageLabelOf(s.pages.length),
    pageCount: s.pages.length,
    cover: scenes.cover(s)
  }));
}
function raw(id) { return ALL.filter(s => s.id === id)[0] || null; }
function get(id) { return raw(id); }
function findByConcept(tag) { return ALL.filter(s => s.concept === tag || s.id === tag)[0] || null; }

/** 适合几年级：按页数反推（页数越多越适合大一点的孩子） */
function ageLabelOf(pageCount) {
  if (pageCount <= 8) return '适合 1-2 年级';
  if (pageCount <= 9) return '适合 2 年级';
  return '适合 2-3 年级';
}
/** 按主题挑书 */
function byTheme(themeId, exclude) {
  const ex = exclude || [];
  const pool = ALL.filter(s => ex.indexOf(s.id) < 0);
  const hit = pool.filter(s => themeIdsOf(s).indexOf(themeId) >= 0);
  return hit.length ? hit : pool;
}
/** 按兴趣标签挑书（动物 / 太空 / 音乐 / 故事 / 生活 ……） */
function byInterest(tag, exclude) {
  const ex = exclude || [];
  const pool = ALL.filter(s => ex.indexOf(s.id) < 0);
  const hit = pool.filter(s => (s.interests || []).indexOf(tag) >= 0);
  return (hit.length ? hit : pool)[0] || ALL[0];
}
/** 已读过的书不再推荐 */
function recommend(progress, interest, grade) {
  const done = (progress && progress.books) ? Object.keys(progress.books).filter(k => progress.books[k].done) : [];
  const pool = ALL.filter(s => done.indexOf(s.id) < 0);
  if (!pool.length) return null;   /* 全读完了 */
  const hit = interest ? pool.filter(s => (s.interests || []).indexOf(interest) >= 0) : [];
  const pick = (hit.length ? hit : pool)[0];
  return { id: pick.id, title: pick.title, emoji: pick.emoji, conceptLabel: pick.conceptLabel, reason: done.length ? '你还没有读过这一本' : '从这一本开始最好' };
}

/* ================= 生成一本可读的绘本 ================= */
/**
 * @param {string} id
 * @param {number} grade
 * @param {object} opt { pages, pinyin, level:'easy'|'normal'|'hard', interest }
 */
function build(id, grade, opt) {
  opt = opt || {};
  const s = raw(id);
  if (!s) return null;
  const band = bandOf(grade);
  const g = band.grade;
  const key = 'g' + g, pyKey = 'py' + g;

  /* 难度微调：孩子连续答错时自动降一档（页数减少、只保留最简单互动） */
  const level = opt.level || 'normal';
  /* 目标页数按年级取，但不能超过故事本身。
     同时保证「三个年级读到的页数确实不一样」——
     否则遇到只有 8 页的故事时，二、三年级会和一年级读一样多。 */
  const full = s.pages.length;
  const ratio = band.grade === 1 ? 0.68 : band.grade === 2 ? 0.85 : 1;
  let want = opt.pages || Math.min(band.pageCount, Math.max(6, Math.round(full * ratio)));
  if (level === 'easy') want = Math.max(6, want - 2);
  if (level === 'hard') want = want + 2;
  want = Math.max(6, Math.min(want, 12, full));

  /* 选页：均匀取样，保证有头有尾，情绪节拍不漏 */
  const src = s.pages;
  const order = [];
  if (want >= src.length) {
    for (let i = 0; i < src.length; i++) order.push(i);
  } else {
    for (let i = 0; i < want; i++) order.push(Math.round(i * (src.length - 1) / (want - 1)));
  }

  const pages = order.map((idx, i) => {
    const p = src[idx];
    const lines = (p[key] || p.g3 || []).slice(0, band.maxLines);
    const pyRaw = p[pyKey] || p.py3 || '';
    const py = opt.pinyin === false ? null : splitPinyin(pyRaw, lines).map(t => {
      const r = pinyin.sentence(t.replace(/[.,;:]+\s*$/, ''));
      return { text: r.text, bad: r.bad };
    });
    const action = p.action && band.actions.indexOf(p.action.type) >= 0 ? p.action : null;
    return {
      index: i + 1,
      sourceIndex: idx,
      title: p.title,
      mood: p.mood || 'happy',
      beat: p.beat || '',
      lines: lines,
      pinyin: py,
      narration: lines.join(''),
      say: p.say || null,
      action: action,
      fx: p.fx || '',
      art: scenes.render(p, p.title),
      scene: p.scene
    };
  });

  /* 小问题 */
  const qs = [];
  (s.questions || []).forEach(q => {
    const pos = Math.min(pages.length - 1, q.after);
    if (pos >= 1) qs.push({ afterPage: pos, index: qs.length + 1, q: q.q, options: q.options, answer: q.answer, right: q.right, wrong: q.wrong });
  });

  return {
    id: s.id, title: s.title, emoji: s.emoji,
    concept: s.concept, conceptLabel: s.conceptLabel, logline: s.logline, cast: s.cast,
    band: { grade: band.grade, name: band.name, maxLines: band.maxLines, maxChars: band.maxChars, label: band.label, pageCount: band.pageCount },
    level: level,
    pages: pages,
    questions: qs,
    exercises: pickExercises(g, s.id),
    mentor: s.mentor || [],
    cover: scenes.cover(s),
    /* 每本书的满星：读完 3 星 + 每个小问题 1 星 + 每个互动 1 星 + 全对 1 星 */
    maxStars: 3 + qs.length + pages.filter(p => p.action).length + 1,
    tts: { rate: band.ttsRate, pitch: band.ttsPitch }
  };
}

/**
 * 拼音按行切分：先看每行汉字数，再按比例分配拼音词。
 * 这样无论哪一档文字，拼音都和文字对齐。
 */
function splitPinyin(raw, lines) {
  const s = String(raw || '').trim();
  const lineArr = Array.isArray(lines) ? lines : new Array(lines || 1).fill('');
  const n = Math.max(1, lineArr.length);
  if (!s) return new Array(n).fill('');
  if (s.indexOf('|') >= 0) {
    const parts = s.split('|').map(x => x.trim()).filter(Boolean);
    while (parts.length < n) parts.push('');
    return parts.slice(0, n);
  }
  const words = s.split(/\s+/).filter(Boolean);
  if (n === 1) return [words.join(' ')];
  const counts = lineArr.map(line => String(line).replace(/[^\u4e00-\u9fa5]/g, '').length);
  const total = counts.reduce((a, b) => a + b, 0) || n;
  const out = [];
  let cursor = 0;
  for (let i = 0; i < n; i++) {
    let take = (i === n - 1) ? (words.length - cursor) : Math.round(words.length * counts[i] / total);
    take = Math.max(0, Math.min(take, words.length - cursor));
    out.push(words.slice(cursor, cursor + take).join(' '));
    cursor += take;
  }
  if (cursor < words.length) out[n - 1] = (out[n - 1] + ' ' + words.slice(cursor).join(' ')).trim();
  return out;
}

/* ================= 伴读问答（低龄化） ================= */
function mentorAnswer(bookId, question) {
  const s = raw(bookId);
  const q = String(question || '').trim();
  if (!s) return { text: '我们先挑一本绘本，再来一起读吧。', matched: null };
  const pool = s.mentor || [];
  const nq = norm(q);
  const hit = pool.filter(m => norm(m.q) === nq)[0] ||
    pool.filter(m => nq.indexOf(norm(m.q)) >= 0)[0] ||
    pool.filter(m => {
      const nm = norm(m.q);
      if (nm.length < 3 || nq.length < 3) return false;
      let same = 0; const seen = {};
      for (const ch of nm) { if (!seen[ch] && nq.indexOf(ch) >= 0) { same++; seen[ch] = 1; } }
      return same >= 3 && same / nm.length >= 0.5;
    })[0];
  if (hit) return { text: hit.a, matched: hit.q, tip: '这是绘本里的小知识，读完会更明白哦。' };

  const KEY = [
    { re: /(难过|伤心|哭|感情|喜欢我|开心)/, a: '小AI 会做出难过的样子，可是它心里不难受。真正会开心、会难过的是我们呀。' },
    { re: /(怎么|如何).*(学会|学习|认识|认得)/, a: '人要给它看很多很多图片，还要告诉它哪个对。看得多了，它就慢慢记住了。' },
    { re: /(会|能).*(听|说话|听懂)/, a: '你说话的时候，声音会变成一条波浪，跑进它的耳朵。它把波浪切成一小段一小段，每一段去找一个字，连起来就听懂啦。' },
    { re: /(认错|犯错|错了|不准|搞错)/, a: '它也会认错，因为它只认识自己学过的东西。它认错了，你告诉它哪里不对，它下次就会更好。' },
    { re: /(秘密|密码|地址|住址|安全|隐私)/, a: '名字、住址、密码都不能随便说给它听。有不明白的，先去问爸爸妈妈和老师。' },
    { re: /(厉害|聪明|比我|比人)/, a: '它记得多、算得快，可是它不会心疼别人，也不会自己想做好事。这些是你最厉害的地方。' },
    { re: /(在哪里|哪里|藏在|都有)/, a: '家里好多地方都有：会回答的音箱、会看的摄像头、自己会转弯的小圆盘，还有妈妈的手机里。' },
    { re: /(谁教|谁做的|哪来的|怎么来)/, a: '是叔叔阿姨一起做出来的，还给它看了很多东西。没有人教，它什么都不会。' }
  ];
  const k = KEY.filter(x => x.re.test(q))[0];
  if (k) return { text: k.a, matched: null, tip: '这个问题问得真好，我们一起来找答案。' };
  return {
    text: '这个问题有点难，我陪你一起想一想。你可以先看看绘本里的哪一页和它有关系，也可以去问问老师。',
    matched: null, tip: '想不出来也没关系，会提问就已经很棒了。'
  };
}
const SYN = [
  [/伤心|难过|不开心|哭|掉眼泪/g, '难过'],
  [/厉害|聪明|强|牛/g, '厉害'],
  [/音箱|音响|小喇叭/g, '音箱'],
  [/小启|小AI|机器人|它/g, '小AI'],
  [/学会|学习|认得|认识/g, '学会'],
  [/为啥|怎么会|干吗|干嘛/g, '为什么'],
  [/告知|说给|讲给|告诉/g, '告诉'],
  [/秘密|隐私|密码|住址|地址/g, '秘密'],
  [/会|能/g, '能']
];
function norm(x) {
  let s = String(x || '').replace(/[\s，。！？、；：""''（）《》…~～?]/g, '').replace(/[呀啊呢吧哦嘛啦]/g, '');
  SYN.forEach(p => { s = s.replace(p[0], p[1]); });
  return s;
}

/* ================= 自适应：根据表现调整下一本 ================= */
/**
 * @param {object} progress 学生的绘本进度
 * @returns {{level:string, pageBump:number, reason:string, encouragement:string}}
 */
function adapt(progress) {
  const p = progress || {};
  const recent = p.recent || [];   /* 最近若干次作答：true / false */
  const wrongStreak = (function () {
    let n = 0;
    for (let i = recent.length - 1; i >= 0; i--) { if (recent[i]) break; n++; }
    return n;
  })();
  const total = recent.length;
  const acc = total ? recent.filter(Boolean).length / total : 1;
  if (wrongStreak >= 2) {
    return { level: 'easy', pageBump: -2, reason: '连续答错 ' + wrongStreak + ' 次，下一本会短一点、互动更简单',
      encouragement: '没关系，我们可以读一本简单一点的。你已经很努力啦！' };
  }
  if (total >= 4 && acc >= 0.85) {
    return { level: 'hard', pageBump: 2, reason: '正确率 ' + Math.round(acc * 100) + '%，下一本会长一点、多一个新玩法',
      encouragement: '你太厉害了！下一本我们多读两页，好不好？' };
  }
  return { level: 'normal', pageBump: 0, reason: '按你现在的水平来', encouragement: '我们继续读下去吧！' };
}

/* ================= 奖励结算 ================= */
const STICKERS = ['⭐', '🌟', '✨', '🏅', '🎖️', '🌈', '🍀', '🎈', '🦄', '🚀'];
const BADGE_RULES = [
  { id: 'pb-first', name: '第一本绘本', icon: '📖', need: 1, desc: '读完第一本 AI 绘本' },
  { id: 'pb-three', name: '故事小达人', icon: '🎪', need: 3, desc: '读完三本 AI 绘本' },
  { id: 'pb-five', name: '绘本收藏家', icon: '🏆', need: 5, desc: '读完五本 AI 绘本' },
  { id: 'pb-eight', name: '全读完了', icon: '👑', need: 8, desc: '把八本绘本都读完' },
  { id: 'pb-allanswer', name: '全对小手', icon: '🎯', need: 0, desc: '一本绘本里的小问题全部答对' },
  { id: 'pb-star20', name: '星星收集者', icon: '🌟', need: 0, desc: '累计获得 20 颗星星' },
  { id: 'pb-kind', name: '温柔的小朋友', icon: '💛', need: 0, desc: '答错后仍然继续读完一本' }
];
function settle(progress, result) {
  const p = progress || {};
  p.books = p.books || {};
  const b = p.books[result.bookId] || (p.books[result.bookId] = { stars: 0, done: false, correct: 0, total: 0, reads: 0 });
  b.reads = (b.reads || 0) + 1;
  b.done = true;
  b.correct = Math.max(b.correct || 0, result.correct || 0);
  b.total = Math.max(b.total || 0, result.total || 0);
  const want = Math.max(1, Math.min(40, Number(result.stars) || 0));
  const before = b.stars || 0;
  b.stars = Math.max(before, want);
  const delta = b.stars - before;
  p.stars = (p.stars || 0) + delta;

  /* 记录最近作答，供下一本自适应 */
  p.recent = (p.recent || []).concat(Array.isArray(result.marks) ? result.marks : []).slice(-12);

  p.stickers = p.stickers || [];
  const sticker = STICKERS[Math.min(STICKERS.length - 1, Math.max(0, (result.stars || 0) - 1))];
  const isNewSticker = p.stickers.indexOf(sticker) < 0;
  if (isNewSticker) p.stickers.push(sticker);

  p.badges = p.badges || [];
  const doneCount = Object.keys(p.books).filter(k => p.books[k].done).length;
  const newBadges = [];
  BADGE_RULES.forEach(rule => {
    if (p.badges.indexOf(rule.id) >= 0) return;
    let got = false;
    if (rule.id === 'pb-allanswer') got = b.total > 0 && b.correct >= b.total;
    else if (rule.id === 'pb-star20') got = p.stars >= 20;
    else if (rule.id === 'pb-kind') got = b.reads > 0 && (b.correct < b.total);
    else got = doneCount >= rule.need && rule.need > 0;
    if (got) { p.badges.push(rule.id); newBadges.push({ id: rule.id, name: rule.name, icon: rule.icon, desc: rule.desc }); }
  });
  p.updatedAt = Date.now();

  return {
    progress: p, gained: Math.max(0, delta), sticker: sticker, newSticker: isNewSticker,
    newBadges: newBadges, doneCount: doneCount, totalStars: p.stars,
    tree: treeOf(doneCount, p.stars), next: adapt(p)
  };
}
function treeOf(doneCount, stars) {
  const leaves = Math.min(8, doneCount);
  const out = [];
  const x = 320, y = 262;
  out.push(A.rect ? A.rect(x - 11, y - 40, 22, 56, { rx: 7, fill: '#a97c50' }) : null);
  for (let i = 0; i < 8; i++) {
    const ang = -Math.PI / 2 + (i - 3.5) * 0.44;
    const on = i < leaves;
    const lx = x + Math.cos(ang) * 52, ly = y - 46 + Math.sin(ang) * 36;
    out.push(A.ellipse ? A.ellipse(lx, ly, 24, 16, { fill: on ? '#7fbf7f' : 'rgba(36,48,68,.07)', stroke: on ? '#5da55d' : 'rgba(36,48,68,.12)', width: 1.6 }) : null);
  }
  out.push(A.circle ? A.circle(x, y - 46, 15, { fill: leaves >= 8 ? '#f5c451' : 'rgba(36,48,68,.07)' }) : null);
  out.push(A.text(x, y + 46, '成长树：' + doneCount + ' / 8 本　星星：' + (stars || 0), { size: 13, anchor: 'middle', fill: '#5b6b7c' }));
  return A.toSvg(out.filter(Boolean), 640, 400, '成长树');
}

/* ================= 内容校验 ================= */
function validate() {
  const errors = [], warn = [];
  const ids = new Set();
  const layoutKeys = Object.keys(pbLayers.LAYERS);
  const storyIds = new Set();

  ALL.forEach(s => {
    if (ids.has(s.id)) errors.push('绘本 id 重复：' + s.id);
    ids.add(s.id);
    ['title', 'emoji', 'concept', 'conceptLabel', 'logline'].forEach(k => {
      if (!s[k]) errors.push(s.id + ' 缺少字段 ' + k);
    });
    if (!s.pages || s.pages.length < 8) errors.push(s.id + ' 页数不足 8 页（当前 ' + (s.pages ? s.pages.length : 0) + '）');
    if (s.pages.length > 12) errors.push(s.id + ' 页数超过 12 页（当前 ' + s.pages.length + '）');
    if (!s.questions || s.questions.length < 2) errors.push(s.id + ' 至少要 2 个小问题');
    if (!s.mentor || s.mentor.length < 3) errors.push(s.id + ' 至少要有 3 组伴读问答');
    if (!s.cast || !s.cast.length) errors.push(s.id + ' 没有主角');

    /* 情绪曲线 */
    const beats = s.pages.map(p => p.beat).filter(Boolean);
    REQUIRED_BEATS.forEach(b => {
      if (beats.indexOf(b) < 0) errors.push(s.id + ' 情绪曲线缺少「' + b + '」这一段');
    });

    /* —— 画面节奏 —— */
    const cams = s.pages.map(p => (pbLayers.LAYERS[p.scene] || {}).camera).filter(Boolean);
    const kinds = cams.filter((c, i) => i === 0 || c !== cams[i - 1]).length;
    const uniq = Array.from(new Set(cams));
    if (uniq.length < 4) errors.push(s.id + ' 只用了 ' + uniq.length + ' 种镜头，每本至少 4 种');
    if (uniq.indexOf('大远景') < 0 && uniq.indexOf('远景') < 0) errors.push(s.id + ' 缺少远景或大远景');
    if (uniq.indexOf('特写') < 0 && uniq.indexOf('大特写') < 0) errors.push(s.id + ' 缺少特写或大特写');
    if (uniq.indexOf('俯视') < 0 && uniq.indexOf('仰视') < 0) errors.push(s.id + ' 缺少俯视或仰视');
    /* 每 3 页必须出现一次视觉惊喜：按「任意连续 3 页」检查，避免开头误报 */
    const isSurprise = p => {
      const L2 = pbLayers.LAYERS[p.scene] || {};
      const kinds2 = (L2.front || []).map(f => f.kind).concat((L2.egg || []).map(e => e.kind));
      return kinds2.indexOf('glowButton') >= 0 || kinds2.indexOf('stars') >= 0 ||
        kinds2.indexOf('butterfly') >= 0 || p.mood === 'surprise' || p.mood === 'wonder';
    };
    for (let i = 0; i + 2 < s.pages.length; i++) {
      if (!s.pages.slice(i, i + 3).some(isSurprise)) {
        errors.push(s.id + ' 第 ' + (i + 1) + '～' + (i + 3) + ' 页没有任何视觉惊喜');
      }
    }
    /* 每 4 页色彩情绪要有明显变化 */
    let lastMood = null, run = 0;
    s.pages.forEach((p, i) => {
      const M = (pbLayers.LAYERS[p.scene] || {}).atmos || {};
      const mood = M.mood || p.mood;
      if (mood === lastMood) { run++; if (run >= 4) errors.push(s.id + ' 第 ' + (i + 1) + ' 页起连续 4 页色彩情绪未变'); }
      else { run = 0; lastMood = mood; }
    });

    /* —— 故事逻辑：黄金八步必须齐全，且顺序不能乱 —— */
    const story = pbStory.of(s.id);
    if (!story) errors.push(s.id + ' 没有故事主线（目标 / 障碍 / 三次尝试 / 领悟）');
    else {
      const steps = s.pages.map(p => (story.arc || {})[p.scene]).filter(Boolean);
      pbStory.ARC_IDS.forEach((a, idx) => {
        if (steps.indexOf(a) < 0) errors.push(s.id + ' 黄金八步缺少「' + pbStory.ARC_NAME[a] + '」');
      });
      /* 顺序：起于日常、终于升华；前四步不能跑到后两步后面去
         （「学习发现」允许再出现一次，真实的儿童故事里孩子会边学边试） */
      if (steps[0] !== 'daily') errors.push(s.id + ' 黄金八步没有从「日常状态」开始');
      if (steps[steps.length - 1] !== 'share') errors.push(s.id + ' 黄金八步没有以「升华与互动」收尾');
      const EARLY = ['daily', 'break', 'try1', 'low'];
      const LATE = ['solve', 'share'];
      let firstLate = Infinity;
      steps.forEach((a, i) => { if (LATE.indexOf(a) >= 0 && i < firstLate) firstLate = i; });
      steps.forEach((a, i) => {
        if (EARLY.indexOf(a) >= 0 && i > firstLate) {
          errors.push(s.id + ' 黄金八步顺序乱了：「' + pbStory.ARC_NAME[a] + '」排在「最终解决」之后');
        }
      });
      /* 因果链：每页都要写清「因为上一页…所以本页…」 */
      s.pages.forEach(p => {
        if (!story.chain || !story.chain[p.scene]) errors.push(s.id + ' 第 ' + p.index + ' 页缺少因果触发点');
      });
      if (!story.goal || !story.obstacle || !story.insight) errors.push(s.id + ' 故事主线不完整');
    }
    /* —— 角色人设：主角必须有缺陷、口头禅、成长弧光 —— */
    (s.cast || []).forEach(who => {
      const c = pbStory.CAST[who];
      if (!c) { errors.push(s.id + ' 角色未登记人设：' + who); return; }
      if (!c.flaw) errors.push(s.id + ' 角色 ' + c.name + ' 没有性格缺陷');
      if (!c.catch || !c.catch.length) errors.push(s.id + ' 角色 ' + c.name + ' 没有口头禅');
      if (!c.growth) errors.push(s.id + ' 角色 ' + c.name + ' 没有成长弧光');
    });
    /* —— 孩子视角互动：求助 / 道歉 / 分享功劳，每本都要有 —— */
    const KID_RE = {
      ask: /你能帮我|帮我看看|你来看看|你帮我|帮帮我|你陪我|再念一遍|再听我讲/,
      sorry: /对不起|我错了|我又错|鼓励我|别生气|原谅/,
      share: /是我们|我们一起|多亏你|幸好有你|功劳|谢谢你|和你一起|是你陪/
    };
    Object.keys(KID_RE).forEach(k => {
      const hit = s.pages.some(p => p.say && KID_RE[k].test(p.say.text));
      if (!hit) errors.push(s.id + ' 缺少「' + pbStory.KID_VIEW[k].name + '」的孩子视角互动');
    });

    /* 禁止呆滞站立：整本里「站直不动」的页面不能超过三分之一 */
    const standing = s.pages.filter(p => {
      const L3 = pbLayers.LAYERS[p.scene] || {};
      return !L3.mid || !L3.mid.pose || L3.mid.pose === 'stand';
    }).length;
    if (standing > Math.floor(s.pages.length / 3)) {
      errors.push(s.id + ' 有 ' + standing + ' 页角色「站直不动」，超过三分之一上限');
    }
    /* 强制画风关键词 */
    ART_STYLE.forEach(k => {
      if (ART_PROMPT.indexOf(k) < 0) errors.push(s.id + ' 画风关键词缺少「' + k + '」');
    });

    /* 互动覆盖：每本至少 3 个互动页 */
    const actPages = s.pages.filter(p => p.action);
    if (actPages.length < 3) warn.push(s.id + ' 只有 ' + actPages.length + ' 个互动页，建议至少 3 个');

    s.pages.forEach((p, i) => {
      const where = s.id + ' 第 ' + (i + 1) + ' 页';
      if (!p.scene) errors.push(where + ' 缺少场景');
      else if (layoutKeys.indexOf(p.scene) < 0) errors.push(where + ' 场景未编排：' + p.scene);
      if (!p.mood) errors.push(where + ' 缺少情绪');
      else if (!cast.MOODS[p.mood]) errors.push(where + ' 情绪不存在：' + p.mood);
      if (!p.title) errors.push(where + ' 缺少标题');

      /* —— 五层结构：缺一层即不合格 —— */
      const L = pbLayers.LAYERS[p.scene];
      if (!L) errors.push(where + ' 没有五层编排：' + p.scene);
      else {
        if (!L.camera || !A.CAMERAS[L.camera]) errors.push(where + ' 镜头缺失或非法：' + L.camera);
        if (!L.front || !L.front.length) errors.push(where + ' 缺少前景层');
        if (!L.mid || !L.mid.desc) errors.push(where + ' 缺少中景层（角色表演）');
        else {
          if (!L.mid.pose) errors.push(where + ' 中景层没有身体动作');
          if (!L.mid.expr) errors.push(where + ' 中景层没有表情');
        }
        /* 背景层：必须有房间 + 具体物件，且环境细节不少于 5 件（否则就是「一块墙」） */
        if (!L.back || !L.back.scene || !(L.back.items || []).length) errors.push(where + ' 背景层不完整（需要场景 + 物件）');
        else {
          const det = require('./pb-detail');
          const roomKey = L.back.room;
          const count = roomKey && det.ROOMS[roomKey] ? det.ROOMS[roomKey].length : (L.back.items || []).length;
          if (count < 5) errors.push(where + ' 背景细节只有 ' + count + ' 件，精装绘本要求至少 5 件');
        }
        /* 强制光影：光源与影子都要写清楚 */
        if (!L.atmos || !L.atmos.source) errors.push(where + ' 没有指定光源方向');
        else if (!L.atmos.shadow) errors.push(where + ' 没有指定影子落在哪里');
        /* 中景层必须有身体动作与表情（呆滞站立在整本层面另有限制） */
        if (!L.atmos || !L.atmos.mood) errors.push(where + ' 缺少氛围层');
        else if (!cast.MOODS[L.atmos.mood]) errors.push(where + ' 氛围层情绪无配色：' + L.atmos.mood);
        if (!L.egg || !L.egg.length) errors.push(where + ' 缺少彩蛋层');
      }
      if (!p.say || !p.say.text) warn.push(where + ' 没有角色台词（知识应由角色说出）');

      [1, 2, 3].forEach(g => {
        const lines = p['g' + g];
        const band = BANDS[g];
        if (!Array.isArray(lines) || !lines.length) { errors.push(where + ' 缺少 g' + g + ' 文字'); return; }
        if (lines.length > band.maxLines + 1) errors.push(where + ' g' + g + ' 有 ' + lines.length + ' 句，超过上限');
        lines.forEach(line => {
          const n = String(line).replace(/[，。！？、；：「」（）·…\s]/g, '').length;
          if (n > band.maxChars + 4) errors.push(where + ' g' + g + ' 有一句 ' + n + ' 字，太长：' + line);
          bannedIn(line).forEach(x => errors.push(where + ' g' + g + ' 出现抽象术语：' + x));
        });
        const py = p['py' + g];
        if (!py) { errors.push(where + ' 缺少 py' + g + ' 拼音'); return; }
        splitPinyin(py, lines).forEach(c => {
          const r = pinyin.sentence(c);
          r.bad.forEach(b => errors.push(where + ' g' + g + ' 拼音无法识别：' + b));
        });
      });

      /* 台词也要检查禁用词 */
      if (p.say && p.say.text) bannedIn(p.say.text).forEach(x => errors.push(where + ' 台词出现抽象术语：' + x));
    });

    (s.questions || []).forEach((q, i) => {
      if (!q.q) errors.push(s.id + ' 第 ' + (i + 1) + ' 个小问题缺少题干');
      if (!Array.isArray(q.options) || q.options.length < 2) errors.push(s.id + ' 第 ' + (i + 1) + ' 个小问题选项不足');
      if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= (q.options || []).length) errors.push(s.id + ' 第 ' + (i + 1) + ' 个小问题答案越界');
      if (q.after >= s.pages.length) errors.push(s.id + ' 第 ' + (i + 1) + ' 个小问题挂在了不存在的页后');
      bannedIn(q.q).forEach(x => errors.push(s.id + ' 小问题出现抽象术语：' + x));
    });
    (s.mentor || []).forEach((m, i) => {
      bannedIn(m.a).forEach(x => errors.push(s.id + ' 第 ' + (i + 1) + ' 组伴读回答出现抽象术语：' + x));
    });
    storyIds.add(s.id);
  });

  /* 场景编排表里不能有孤儿 */
  layoutKeys.forEach(k => {
    const used = ALL.some(s => s.pages.some(p => p.scene === k));
    if (!used) warn.push('场景「' + k + '」没有被任何页面使用');
  });

  return {
    ok: errors.length === 0,
    stories: ALL.length,
    pages: ALL.reduce((n, s) => n + s.pages.length, 0),
    scenes: layoutKeys.length,
    actions: ALL.reduce((n, s) => n + s.pages.filter(p => p.action).length, 0),
    interactions: Object.keys(ACTION_LEVEL).length,
    errors: errors,
    warnings: warn
  };
}

function stats() {
  const v = validate();
  const actCount = {};
  ALL.forEach(s => s.pages.forEach(p => { if (p.action) actCount[p.action.type] = (actCount[p.action.type] || 0) + 1; }));
  return {
    stories: v.stories, pages: v.pages, scenes: v.scenes, actions: v.actions,
    actionBreakdown: actCount,
    actionLevels: ACTION_LEVEL,
    concepts: ALL.map(s => s.conceptLabel),
    moods: Object.keys(cast.MOODS).map(k => ({ id: k, name: cast.MOODS[k].name })),
    bands: Object.keys(BANDS).map(g => ({ grade: BANDS[g].grade, name: BANDS[g].name, pages: BANDS[g].pageCount, lines: BANDS[g].maxLines, actions: BANDS[g].actions })),
    stickers: STICKERS, badges: BADGE_RULES,
    banned: BANNED.map(b => b.re.source),
    errors: v.errors.length
  };
}

module.exports = {
  ALL, BANDS, ACTION_LEVEL, EXERCISES, STICKERS, BADGE_RULES, BANNED, REQUIRED_BEATS, ART_STYLE, ART_PROMPT, ART_NEGATIVE, ART_FORBIDDEN, GLOBAL_PREFIX, selfCheck,
  THEMES, themeIdsOf, ageLabelOf, byTheme,
  pickExercises,
  bandOf, isJunior, bannedIn, list, get, raw, findByConcept, byInterest, recommend,
  build, mentorAnswer, adapt, settle, treeOf, stats, validate, norm, splitPinyin
};
