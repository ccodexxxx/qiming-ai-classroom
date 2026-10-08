/**
 * 端到端接口冒烟测试：启动服务、逐个调用真实接口、校验返回结构。
 * 用法：node tests/api.test.js
 */
'use strict';

const { spawn } = require('child_process');
const path = require('path');

const PORT = 8099;
const BASE = 'http://127.0.0.1:' + PORT;

const results = [];
let failures = 0;
function check(name, cond, detail) {
  results.push((cond ? '  ✓ ' : '  ✗ ') + name + (detail ? '  → ' + detail : ''));
  if (!cond) failures++;
}

function req(pathname, options) {
  options = options || {};
  const init = { method: options.method || 'GET', headers: {} };
  if (options.cookie) init.headers.Cookie = options.cookie;
  if (options.body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }
  return fetch(BASE + pathname, init).then(async res => {
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) {}
    const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const rawCookie = setCookie.length ? setCookie[0] : (res.headers.get('set-cookie') || '');
    const m = rawCookie.match(/aiq_sid=([^;]+)/);
    return { status: res.status, json, text, sid: m ? m[1] : null, headers: res.headers };
  });
}

(async function main() {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
    env: Object.assign({}, process.env, { PORT: String(PORT), HOST: '127.0.0.1' }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  server.stdout.on('data', d => { serverLog += d.toString(); });
  server.stderr.on('data', d => { serverLog += d.toString(); });

  // 等待服务就绪
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try { const r = await req('/api/health'); if (r.status === 200) { ready = true; break; } } catch (e) {}
    await new Promise(r => setTimeout(r, 150));
  }
  if (!ready) {
    console.log('服务未启动：\n' + serverLog);
    server.kill();
    process.exit(1);
  }

  try {
    /* 1. 健康检查与内容库 */
    const health = await req('/api/health');
    check('GET /api/health 返回 ok', health.json && health.json.ok === true,
      health.json ? (health.json.topics + ' 个知识点 / ' + health.json.questions + ' 道题') : '无返回');

    /* 2. 会话与 cookie */
    const home = await req('/');
    check('GET / 返回 200 且带会话 cookie', home.status === 200 && !!home.sid, home.sid ? ('sid=' + home.sid.slice(0, 8) + '…') : '无 cookie');
    const cookie = 'aiq_sid=' + home.sid;
    check('首页含站点标题', /启明 AI 课堂/.test(home.text));

    const session = await req('/api/session', { cookie });
    check('GET /api/session 返回学生与学段', session.json && session.json.student && session.json.level,
      session.json ? ('年级 ' + session.json.student.grade + ' / ' + session.json.level.name) : '无返回');

    /* 3. 更新画像 */
    const upd = await req('/api/student', { method: 'POST', cookie, body: { name: '测试同学', grade: 8, avatar: '🦊' } });
    check('POST /api/student 更新年级', upd.json && upd.json.ok && upd.json.level.id === 'middle',
      upd.json ? ('学段=' + upd.json.level.name) : '无返回');

    /* 4. 对话（同步） */
    const chat = await req('/api/chat', { method: 'POST', cookie, body: { message: '什么是机器学习' } });
    check('POST /api/chat 返回讲解', chat.json && chat.json.text && chat.json.text.length > 60,
      chat.json ? ('意图=' + chat.json.intent + ' 知识点=' + chat.json.topicId + ' 长度=' + chat.json.text.length) : '无返回');
    check('对话回答含追踪问题', chat.json && /想一想/.test(chat.json.text));
    check('对话回答带快捷动作', chat.json && Array.isArray(chat.json.actions) && chat.json.actions.length > 0);

    /* 5. 对话（SSE 流式） */
    const sseRes = await fetch(BASE + '/api/chat/stream', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ message: '再深入讲讲' })
    });
    const sseText = await sseRes.text();
    check('POST /api/chat/stream 返回事件流', sseRes.status === 200 && /text\/event-stream/.test(sseRes.headers.get('content-type') || ''));
    check('流内含 meta 与 delta 事件', /"type":"meta"/.test(sseText) && /"type":"delta"/.test(sseText));
    check('流以 done 结束并带来源', /"type":"done"/.test(sseText), (sseText.match(/"source":"(\w+)"/) || [])[1] || '');
    const deltaCount = (sseText.match(/"type":"delta"/g) || []).length;
    check('流式分片数量合理', deltaCount >= 2, deltaCount + ' 个分片');

    /* 6. 抽题与判题 */
    const quiz = await req('/api/quiz?topic=ml-what&count=3', { cookie });
    check('GET /api/quiz 返回题目', quiz.json && quiz.json.questions && quiz.json.questions.length === 3,
      quiz.json ? (quiz.json.questions.length + ' 题，首题：' + quiz.json.questions[0].q.slice(0, 16) + '…') : '无返回');
    const q0 = quiz.json.questions[0];
    check('题目结构完整', !!(q0.id && q0.topicId && q0.q && q0.options && q0.options.length === 4 && q0.answer >= 0 && q0.explain));

    const wrongAnswer = await req('/api/answer', {
      method: 'POST', cookie,
      body: {
        topicId: q0.topicId, question: q0.q, answer: q0.options[q0.answer],
        mine: q0.options[(q0.answer + 1) % 4], correct: false, explain: q0.explain, score: 0, title: '接口测试'
      }
    });
    check('POST /api/answer 判错并给反馈', wrongAnswer.json && wrongAnswer.json.correct === false && !!wrongAnswer.json.feedback,
      wrongAnswer.json ? wrongAnswer.json.feedback.slice(0, 24) + '…' : '无返回');

    const weakQuiz = await req('/api/quiz?mode=weak&count=3', { cookie });
    check('GET /api/quiz?mode=weak 可用', weakQuiz.json && weakQuiz.json.questions.length > 0,
      weakQuiz.json ? (weakQuiz.json.questions.length + ' 题') : '无返回');

    /* 7. 错题本与订正 */
    const gamesPage = await req('/games', { cookie });
    check('GET /games 渲染出游戏卡', gamesPage.status === 200 && /data-play="quiz"/.test(gamesPage.text) && /data-play="match"/.test(gamesPage.text));
    check('GET /games 渲染出错题本容器', /id="wrong-book"/.test(gamesPage.text));
    const wm = gamesPage.text.match(/data-fix="([^"]+)"/);
    if (wm) {
      const fix = await req('/api/wrong/fix', { method: 'POST', cookie, body: { id: wm[1] } });
      check('POST /api/wrong/fix 订正错题', fix.json && fix.json.ok === true);
    } else {
      check('POST /api/wrong/fix 订正错题', false, '页面没有可订正的错题');
    }

    /* 8. 游戏数据 */
    for (const kind of ['label', 'net', 'match']) {
      const r = await req('/api/games/data?kind=' + kind, { cookie });
      let ok = false, detail = r.status !== 200 ? ('HTTP ' + r.status + ' ' + (r.json && r.json.error || '')) : '';
      if (r.status === 200) {
        if (kind === 'label') { ok = !!(r.json.samples && r.json.samples.length === 8 && r.json.labels.length === 2 && r.json.test.length === 3); detail = ok ? ('样本 ' + r.json.samples.length + ' / 测试 ' + r.json.test.length + ' / 二分类 ' + r.json.labels.join('|')) : '结构不符'; }
        if (kind === 'net') { ok = !!(r.json.tasks && r.json.tasks.length === 3 && r.json.tasks[0].points.length === 4); detail = ok ? ('任务 ' + r.json.tasks.map(t => t.id).join('/')) : '结构不符'; }
        if (kind === 'match') { ok = !!(r.json.cards && r.json.cards.length === r.json.target && r.json.pairs >= 4); detail = ok ? ('卡片 ' + r.json.cards.length + ' / 配对 ' + r.json.pairs) : '结构不符'; }
      }
      check('GET /api/games/data?kind=' + kind, ok, detail);
    }

    /* 9. 学习行为上报 */
    const ev = await req('/api/event', { method: 'POST', cookie, body: { type: 'game', game: 'label', score: 88, title: '标注测试' } });
    check('POST /api/event 记录并更新最高分', ev.json && ev.json.ok && ev.json.best && ev.json.best.label === 88,
      ev.json ? ('best.label=' + ev.json.best.label) : '无返回');

    /* 10. 动画与绘本 */
    const anims = await req('/api/anims', { cookie });
    check('GET /api/anims 返回动画清单', anims.json && anims.json.animations && anims.json.animations.length >= 12,
      anims.json ? (anims.json.animations.length + ' 个动画') : '无返回');
    const anim = await req('/api/anim?id=decision-boundary', { cookie });
    check('GET /api/anim 返回帧与指令', anim.json && anim.json.phases && anim.json.phases.length >= 2 && anim.json.phases[0].cmds.length > 10,
      anim.json ? (anim.json.title + ' / ' + anim.json.phases.length + ' 帧 / 交互=' + anim.json.interactive) : '无返回');
    /* /api/books 现在归低龄绘本，旧口径的实践小本子挪到 /api/workbooks */
    const books = await req('/api/workbooks', { cookie });
    check('GET /api/workbooks 返回实践小本子清单', books.json && books.json.books && books.json.books.length === 5,
      books.json ? (books.json.books.length + ' 本') : '无返回');
    const book1 = await req('/api/book?topic=book-cat&grade=1&pages=4', { cookie });
    const book9 = await req('/api/book?topic=book-cat&grade=9&pages=4', { cookie });
    check('GET /api/book 按年级生成', book1.json && book9.json && book1.json.pages[0].text !== book9.json.pages[0].text,
      book1.json ? ('G1：' + book1.json.pages[0].text.slice(0, 14) + '… / G9：' + book9.json.pages[0].text.slice(0, 14) + '…') : '无返回');
    check('绘本页面含 SVG 插图', book1.json.pages.every(p => /<svg/.test(p.art)));

    /* 11. 页面渲染 */
    const pages = ['/', '/chat', '/courses', '/topic/ml-what', '/ai-cartoon', '/code', '/games', '/dashboard', '/about'];
    for (const p of pages) {
      const r = await req(p, { cookie });
      const bad = /页面不存在/.test(r.text) || r.status !== 200;
      check('页面 ' + p, !bad, 'HTTP ' + r.status + ' / ' + r.text.length + ' 字节');
    }

    /* 12. 静态资源 */
    for (const asset of ['/css/base.css', '/css/components.css', '/css/pages.css', '/js/app.js', '/js/chat.js']) {
      const r = await req(asset, { cookie });
      check('静态资源 ' + asset, r.status === 200 && r.text.length > 500, r.text.length + ' 字节');
    }

    /* 13. 学习报告 */
    const report = await req('/api/report', { cookie });
    check('GET /api/report 生成报告', report.status === 200 && /AI 通识学习报告/.test(report.text) && /知识点掌握明细/.test(report.text));

    /* 14. 检索接口 */
    const search = await req('/api/search?q=' + encodeURIComponent('什么是神经网络'), { cookie });
    check('GET /api/search 命中正确知识点', search.json && search.json.results.length && /机器怎么看图|神经网络/.test(search.json.results[0].title),
      search.json && search.json.results[0] ? search.json.results[0].title : '无结果');

    /* 15. AI 绘本模块（低龄段） */
    const pbLib = await req('/api/pb/library?grade=1', { cookie });
    check('GET /api/pb/library 返回书目与进度', pbLib.json && pbLib.json.stories.length >= 8 && pbLib.json.band.grade === 1 && !!pbLib.json.recommend && !!pbLib.json.adapt,
      pbLib.json ? (pbLib.json.stories.length + ' 本 / 档位 ' + pbLib.json.band.name + ' / 推荐「' + (pbLib.json.recommend ? pbLib.json.recommend.title : '无') + '」/ 成长树 ' + pbLib.json.tree.length + ' 字节') : '无返回');
    check('绘本馆返回低龄段判定', pbLib.json && pbLib.json.junior === true);

    const pbBook1 = await req('/api/pb/book?id=eye&grade=1', { cookie });
    const pbBook3 = await req('/api/pb/book?id=eye&grade=3', { cookie });
    check('GET /api/pb/book 按年级生成绘本', pbBook1.status === 200 && pbBook3.status === 200 && pbBook1.json && pbBook1.json.pages.length >= 4 && pbBook3.json && pbBook3.json.pages.length >= 4,
      pbBook1.json ? ('1 年级 ' + pbBook1.json.pages.length + ' 页 / 3 年级 ' + pbBook3.json.pages.length + ' 页') : '无返回');
    check('同一页在不同年级文字不同', pbBook1.json.pages[0].lines.join('') !== pbBook3.json.pages[0].lines.join(''),
      'G1：「' + pbBook1.json.pages[0].lines.join('') + '」');
    check('每页带拼音且能对齐文字', pbBook1.json.pages.every(p => p.pinyin && p.pinyin.length === p.lines.length),
      pbBook1.json.pages[0].pinyin.map(x => x.text).join(' / '));
    check('每页插图是 SVG', pbBook1.json.pages.every(p => /<svg/.test(p.art) && p.art.length > 400),
      '首图 ' + pbBook1.json.pages[0].art.length + ' 字节');
    check('绘本含小问题', pbBook1.json.questions.length >= 2,
      'G1 问题 ' + pbBook1.json.questions.length + ' 个 / 每页互动 ' + pbBook1.json.pages.filter(p => p.action).length + ' 个');
    const acts1 = pbBook1.json.pages.filter(p => p.action).map(p => p.action.type);
    const acts3 = pbBook3.json.pages.filter(p => p.action).map(p => p.action.type);
    check('低年级互动以点拖吹拍为主', acts1.every(t => ['tap', 'drag', 'blow', 'clap'].indexOf(t) >= 0),
      'G1 互动：' + acts1.join('、'));
    check('高年级出现更多互动类型', acts3.length > acts1.length,
      'G3 互动：' + acts3.join('、'));
    check('每页都有角色台词', pbBook1.json.pages.every(p => p.say && p.say.text), '共 ' + pbBook1.json.pages.length + ' 页');
    check('每页都有情绪标记', pbBook1.json.pages.every(p => p.mood), pbBook1.json.pages.map(p => p.mood).slice(0, 4).join('、') + ' …');

    const pbAsk = await req('/api/pb/ask', { method: 'POST', cookie, body: { bookId: 'us', question: '小AI 会难过吗' } });
    check('POST /api/pb/ask 命中伴读问答', pbAsk.json && pbAsk.json.answer.length > 10 && !!pbAsk.json.matched,
      pbAsk.json ? ('命中「' + pbAsk.json.matched + '」') : '无返回');
    check('伴读回答可转成一页绘本', pbAsk.json && pbAsk.json.page && pbAsk.json.page.lines.length >= 1 && /<svg/.test(pbAsk.json.page.art),
      pbAsk.json ? (pbAsk.json.page.lines.length + ' 行 / 插图 ' + pbAsk.json.page.art.length + ' 字节') : '');
    const pbAsk2 = await req('/api/pb/ask', { method: 'POST', cookie, body: { bookId: 'us', question: '今天天气怎么样' } });
    check('课程外提问给出引导而非胡编', pbAsk2.json && /一起想一想|问.*老师/.test(pbAsk2.json.answer));

    const pbAns = await req('/api/pb/answer', {
      method: 'POST', cookie,
      body: { bookId: 'eye', kind: 'question', title: '小启会认猫吗', question: '小启会认猫吗', answer: '不会', mine: '不会', correct: true, explain: '要人教' }
    });
    check('POST /api/pb/answer 答对时返回正确判定', pbAns.json && pbAns.json.ok === true && pbAns.json.correct === true,
      pbAns.json ? pbAns.json.feedback : '无返回');
    const pbWrong = await req('/api/pb/answer', {
      method: 'POST', cookie,
      body: { bookId: 'eye', kind: 'question', title: '小启天生会认猫吗', question: '小启天生会认猫吗', answer: '不会', mine: '会', correct: false, explain: '要人教才会' }
    });
    check('POST /api/pb/answer 答错时记入错题本', pbWrong.json && pbWrong.json.ok === true && pbWrong.json.correct === false,
      pbWrong.json ? pbWrong.json.feedback : '无返回');
    const pbAskAfter = await req('/api/pb/ask', { method: 'POST', cookie, body: { bookId: 'us', question: '小AI 会难过吗' } });
    check('伴读问答能命中相近说法', pbAskAfter.json && !!pbAskAfter.json.matched,
      pbAskAfter.json ? ('命中「' + pbAskAfter.json.matched + '」') : '无返回');

    const pbFin = await req('/api/pb/finish', {
      method: 'POST', cookie, body: { bookId: 'eye', title: '小启学认猫', stars: 8, correct: 3, total: 3 }
    });
    check('POST /api/pb/finish 结算星星与贴纸', pbFin.json && pbFin.json.ok && pbFin.json.gained > 0 && !!pbFin.json.sticker,
      pbFin.json ? ('+' + pbFin.json.gained + ' 星 / 贴纸 ' + pbFin.json.sticker + ' / 徽章 ' + pbFin.json.newBadges.map(b => b.name).join('、')) : '无返回');
    check('结算返回成长树', pbFin.json && /<svg/.test(pbFin.json.tree));
    const pbFin2 = await req('/api/pb/finish', {
      method: 'POST', cookie, body: { bookId: 'eye', title: '小启学认猫', stars: 5, correct: 1, total: 3 }
    });
    check('重读拿更少星不倒扣', pbFin2.json && pbFin2.json.gained === 0 && pbFin2.json.totalStars === pbFin.json.totalStars,
      '再次结算 +' + (pbFin2.json ? pbFin2.json.gained : '?') + ' 星，总 ' + (pbFin2.json ? pbFin2.json.totalStars : '?') + ' 星');

    /* 16. 绘本模块页面 */
    const bookPage = await req('/book?grade=1', { cookie });
    check('GET /book 渲染绘本馆', bookPage.status === 200 && /小AI的奇妙世界/.test(bookPage.text) && /picturebook.js/.test(bookPage.text),
      bookPage.text.length + ' 字节');
    /* 独立路由 /ai-picture-book：低龄绘本馆，与 /book 等同 */
    const shelfPage = await req('/ai-picture-book?grade=1', { cookie });
    check('GET /ai-picture-book 独立路由可用',
      shelfPage.status === 200 && /pb-banner-art/.test(shelfPage.text) && /pb-theme/.test(shelfPage.text),
      ((shelfPage.text.match(/class="pb-theme/g) || []).length) + ' 个主题胶囊');
    check('绘本馆不含硬核术语', !/卷积核|梯度下降|过拟合/.test(shelfPage.text), '无卷积核 / 梯度下降 / 过拟合');

    /* 创作工坊：AI 绘本标签页必须彻底顶掉左侧算法列表 */
    const studioBook = await req('/studio?tab=book', { cookie });
    const animHidden = /id="studio-region-anim" hidden/.test(studioBook.text);
    check('创作工坊「AI 绘本」标签隐藏知识点列表', studioBook.status === 200 && animHidden &&
      /id="studio-region-book"/.test(studioBook.text) && /pb-studio-cards/.test(studioBook.text),
      animHidden ? '算法列表已收起' : '算法列表仍在页面上');
    const studioAnim = await req('/studio?tab=anim', { cookie });
    check('创作工坊「原理动画」标签隐藏绘本区',
      /id="studio-region-book" hidden/.test(studioAnim.text) && !/id="studio-region-anim" hidden/.test(studioAnim.text));
    /* 低龄绘本列表接口 */
    const bookList = await req('/api/books?grade=1&theme=see', { cookie });
    check('GET /api/books 按主题取绘本',
      bookList.json && bookList.json.stories && bookList.json.stories.length >= 1 && !!bookList.json.stories[0].ageLabel,
      bookList.json ? (bookList.json.stories.map(s => s.title).join('、') + ' / ' + bookList.json.stories[0].ageLabel) : '无返回');
    /* 一键生成绘本 */
    const gen = await req('/api/books/generate', { method: 'POST', cookie, body: { prompt: '生成一本适合1年级的AI认猫绘本', grade: 1 } });
    const gb = gen.json && gen.json.book;
    check('POST /api/books/generate 生成完整分页脚本',
      !!(gb && gb.pages && gb.pages.length >= 5 && gb.pages[0].image_prompt && gb.pages[0].logicTrigger && gb.pages[0].arcStep && gb.goal && gb.insight),
      gb ? ('《' + gb.title + '》' + gb.pageCount + ' 页 / 主题 ' + gen.json.themeLabel + ' / 第1页属「' + gb.pages[0].arcStep.name + '」') : '无返回');
    const genHard = await req('/api/books/generate', { method: 'POST', cookie, body: { prompt: '关于过拟合和死记硬背', grade: 1 } });
    /* AI 动画：真正的骨骼动画分镜 */
    const animPage = await req('/animation', { cookie });
    check('GET /animation 渲染骨骼动画页',
      animPage.status === 200 && /anim-root/.test(animPage.text) && /anim\.css/.test(animPage.text));
    const sb = await req('/api/anim/storyboard?id=wake&grade=2', { cookie });
    const sj = sb.json;
    check('动画分镜含动作时间轴与场景动态',
      !!(sj && sj.shots && sj.shots.length >= 5 && sj.shots[0].timeline && sj.shots[0].timeline.length >= 3 &&
        sj.shots[0].ambient && sj.shots[0].ambient.length >= 1 && sj.shots[0].art),
      sj && sj.shots ? (sj.shots.length + ' 镜 / 首镜动作 ' + sj.shots[0].action + '（' + sj.shots[0].actionLabel + '，' +
        sj.shots[0].timeline.length + ' 关键帧）/ 动态 ' + (sj.shots[0].ambient || []).map(a => a.name).join('、')) : '无返回');
    check('骨骼动画含独立部件分组与关键帧 CSS',
      !!(sj && /k0-body/.test(sj.shots[0].art) && /k0-armL/.test(sj.shots[0].art) && /k0-legR/.test(sj.shots[0].art) &&
        /@keyframes k0-body/.test(sj.css) && /translateY/.test(sj.css) && /scale\(/.test(sj.css)),
      sj ? ('CSS ' + (sj.css || '').length + ' 字节 / 含挤压拉伸 ' + /scale\(/.test(sj.css)) : '');

    /* AI 视频：渲染能力与任务接口 */
    const vidList = await req('/api/video/list', { cookie });
    check('GET /api/video/list 报告渲染能力',
      vidList.json && vidList.json.available && typeof vidList.json.available.ffmpeg === 'boolean',
      vidList.json ? ('ffmpeg=' + vidList.json.available.ffmpeg + ' chrome=' + vidList.json.available.chrome + ' 配音=' + vidList.json.available.tts) : '无返回');
    const vidPage = await req('/video/export', { cookie });
    check('GET /video/export 渲染导出页',
      vidPage.status === 200 && /AI 视频/.test(vidPage.text) && /video-books/.test(vidPage.text) && /video\.js/.test(vidPage.text));
    check('主导航已换成 AI 动画', /AI 动画/.test(vidPage.text) && !/创作工坊/.test(vidPage.text), '');
    /* 统一入口 */
    const toon = await req('/ai-cartoon', { cookie });
    check('GET /ai-cartoon 统一入口渲染动画播放器',
      toon.status === 200 && /AI 动画片/.test(toon.text) && /anim-root/.test(toon.text) && /anim\.css/.test(toon.text));
    const oldVideo = await req('/video', { cookie });
    check('旧 /video 链接指向 AI 动画片', oldVideo.status === 200 && /AI 动画片/.test(oldVideo.text),
      'HTTP ' + oldVideo.status + ' / ' + (/AI 动画片/.test(oldVideo.text) ? '已指向动画播放器' : '内容不对'));

    check('硬核说法能映射到「犯错啦」主题',
      genHard.json && genHard.json.theme === 'oops',
      genHard.json ? ('过拟合 → ' + genHard.json.themeLabel + ' / 《' + genHard.json.book.title + '》') : '无返回');
    /* 对话智能体入口 */
    const agent = await req('/api/agent/ask', { method: 'POST', cookie, body: { question: '小AI 是什么', grade: 1 } });
    check('POST /api/agent/ask 返回低龄化回答与新绘本页',
      agent.json && agent.json.ok && agent.json.answer.length > 10 && agent.json.junior === true && agent.json.page && agent.json.page.lines.length >= 1 && /<svg/.test(agent.json.page.art),
      agent.json ? ('「' + agent.json.answer.slice(0, 20) + '…」/ ' + agent.json.page.lines.length + ' 行 + 插图 ' + agent.json.page.art.length + ' 字节') : '无返回');
    const libBooks = await req('/api/pb/library?grade=2', { cookie });
    const withTheme = libBooks.json ? libBooks.json.stories.filter(s => s.themes && s.themes.length && s.ageLabel) : [];
    check('书目接口带主题与年龄标识', withTheme.length === (libBooks.json ? libBooks.json.stories.length : -1),
      withTheme.length + ' 本都有主题与年龄标识');
    const readerPage = await req('/book/read?id=ear&grade=2', { cookie });
    check('GET /book/read 渲染阅读器', readerPage.status === 200 && readerPage.status === 200 && /__PB_BOOT__/.test(readerPage.text) && /ear/.test(readerPage.text));
    const embedPage = await req('/book/read?id=ear&embed=1&grade=2&auto=1', { cookie });
    check('嵌入模式去除站点外壳', embedPage.status === 200 && !/site-nav/.test(embedPage.text) && /pb-embed-body/.test(embedPage.text) && /__PB_BOOT__/.test(embedPage.text));
    const pbCss = await req('/css/picturebook.css', { cookie });
    const pbJs = await req('/js/picturebook.js', { cookie });
    check('绘本静态资源可访问', pbCss.status === 200 && pbJs.status === 200 && pbJs.text.length > 20000,
      pbCss.text.length + ' 字节 CSS / ' + pbJs.text.length + ' 字节 JS');

    /* 17. 主对话智能体与绘本模块的联动 */
    await req('/api/student', { method: 'POST', cookie, body: { grade: 2 } });
    const chatStory = await req('/api/chat', { method: 'POST', cookie, body: { message: '我想看绘本' } });
    check('低龄学生说「看绘本」被正确识别', chatStory.json && chatStory.json.intent === 'story',
      chatStory.json ? ('意图=' + chatStory.json.intent) : '无返回');
    check('回答给出绘本模块入口', chatStory.json && (chatStory.json.actions || []).some(a => /^\/book/.test(a.payload || '')),
      chatStory.json ? (chatStory.json.actions || []).map(a => a.payload).join(' | ') : '');
  } catch (err) {
    console.log('测试过程异常：' + err.message);
    failures++;
  }

  server.kill();
  console.log(results.join('\n'));
  console.log('');
  console.log(failures === 0 ? ('全部通过（' + results.length + ' 项）') : (failures + ' 项失败 / 共 ' + results.length + ' 项'));
  process.exit(failures === 0 ? 0 : 1);
})();
