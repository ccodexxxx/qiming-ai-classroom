/**
 * 页面渲染：把内容库渲染成多页面站点
 * 每个函数返回页面正文 HTML，由 http-util.layout 套上外壳。
 */
'use strict';

const content = require('../content');
const { esc, layout } = require('./http-util');
const llm = require('./llm');

/* ---------------- 公共片段 ---------------- */

function navBar(active) {
  const items = [
    { href: '/', key: 'home', label: '首页' },
    { href: '/chat', key: 'chat', label: 'AI 课堂' },
    { href: '/courses', key: 'courses', label: '课程地图' },
    { href: '/book', key: 'book', label: 'AI 绘本' },
    { href: '/ai-cartoon', key: 'video', label: 'AI 动画' },
    { href: '/code', key: 'code', label: '编程实践' },
    { href: '/games', key: 'games', label: '练习中心' },
    { href: '/dashboard', key: 'dashboard', label: '学情看板' }
  ];
  const lis = items.map(i => '<a class="nav-link' + (i.key === active ? ' is-active' : '') + '" href="' + i.href + '">' + esc(i.label) + '</a>').join('');
  return '<nav class="site-nav" id="site-nav" aria-label="主导航">' + lis + '</nav>' +
    '<button class="nav-toggle" id="nav-toggle" type="button" aria-label="展开导航" aria-expanded="false">☰</button>';
}

/** 学段选择控件（复用于首页与看板） */
function gradePicker(grade) {
  let html = '<div class="grade-picker" id="grade-picker">';
  for (let g = 1; g <= 12; g++) {
    const lv = content.levelOfGrade(g);
    html += '<button type="button" class="grade-btn' + (g === grade ? ' is-on' : '') + '" data-grade="' + g + '" style="--lv:' + lvColor(lv.id) + '">' +
      '<b>' + g + '</b><span>' + esc(lv.short) + '</span></button>';
  }
  html += '</div>';
  return html;
}

function lvColor(id) {
  return { junior: '#d4637f', senior: '#c98a1b', middle: '#2b7fb8', high: '#7c5cd6' }[id] || '#2f8f6b';
}

/** 知识点卡片 */
function topicCard(t, opt) {
  opt = opt || {};
  const lv = opt.levelId ? content.levelById(opt.levelId) : content.levelOfGrade(opt.grade || 5);
  const covered = (t.bands || []).indexOf(lv.id) >= 0;
  const prog = opt.progress && opt.progress[t.id] ? opt.progress[t.id] : null;
  const status = prog ? prog.status : 'new';
  const statusText = status === 'done' ? '已掌握' : (status === 'learning' ? '学习中' : '未学习');
  const domain = content.domainById(t.domain) || {};
  return '<a class="topic-card' + (covered ? '' : ' is-off') + '" href="/topic/' + t.id + '" data-topic="' + t.id + '">' +
    '<div class="topic-card-top">' +
      '<span class="topic-emoji" aria-hidden="true">' + t.emoji + '</span>' +
      '<span class="badge badge-' + status + '">' + statusText + '</span>' +
    '</div>' +
    '<h3>' + esc(t.title) + '</h3>' +
    '<p class="topic-know">' + esc(t.objective.know) + '</p>' +
    '<div class="topic-meta">' +
      '<span class="chip chip-tiny" style="--dc:' + (domain.color || '#666') + '">' + (domain.emoji || '') + ' ' + esc(domain.name || '') + '</span>' +
      '<span class="chip chip-tiny">' + t.gradeMin + '–' + t.gradeMax + ' 年级</span>' +
      '<span class="chip chip-tiny">' + t.quiz.length + ' 道练习</span>' +
    '</div>' +
  '</a>';
}

/* ---------------- 首页 ---------------- */
function homePage(student) {
  const stats = content.stats();
  const grade = student ? student.grade : 5;
  const lv = content.levelOfGrade(grade);
  const recs = content.recommend(grade, student ? student.progress : {}, 3);

  const domains = stats.byDomain.map(d =>
    '<a class="domain-card" href="/courses?domain=' + d.id + '" style="--dc:' + d.color + '">' +
      '<span class="domain-emoji" aria-hidden="true">' + d.emoji + '</span>' +
      '<b>' + esc(d.name) + '</b>' +
      '<small>' + d.topics + ' 个知识点 · ' + d.questions + ' 道题</small>' +
    '</a>').join('');

  const body =
  '<section class="hero">' +
    '<div class="wrap hero-inner">' +
      '<div class="hero-copy">' +
        '<p class="hero-eyebrow">K12 人工智能通识课 · 教学助手</p>' +
        '<h1>同一个知识点，<br>一年级听懂，高三也够用</h1>' +
        '<p class="hero-lead">启明 AI 课堂会先了解你的年级，再决定用什么语言、什么例子、什么样的追问来讲。' +
        '它不只会聊天：还能现场生成原理动画、按年级改写绘本、陪你写代码、出题批改，并把学习过程记成一份学情档案。</p>' +
        '<div class="hero-actions">' +
          '<a class="btn btn-primary btn-lg" href="/chat">开始对话上课</a>' +
          '<a class="btn btn-ghost btn-lg" href="/courses">先看课程地图</a>' +
        '</div>' +
        '<ul class="hero-points">' +
          '<li><b>' + stats.topics + '</b> 个知识点</li>' +
          '<li><b>' + stats.questions + '</b> 道分层练习</li>' +
          '<li><b>4</b> 个学段自适应</li>' +
          '<li><b>0</b> 外部依赖</li>' +
        '</ul>' +
      '</div>' +
      '<div class="hero-card">' +
        '<div class="hero-card-head">' +
          '<span class="dot"></span><span class="dot"></span><span class="dot"></span>' +
          '<span class="hero-card-title">AI 课堂 · 实况</span>' +
        '</div>' +
        '<div class="hero-demo">' +
          '<div class="demo-q">什么是机器学习？</div>' +
          '<div class="demo-a">' +
            '<p class="demo-tag">当前学段：' + esc(lv.name) + '（' + esc(lv.style) + '）</p>' +
            '<p>' + esc(lv.depth <= 2
              ? '你看过很多很多狗，慢慢就认得了。机器也一样：给它看很多例子，它自己慢慢学会。'
              : '模型一开始的参数是随机猜的，训练就是不断让「预测与答案的差距」变小。') + '</p>' +
            '<p class="demo-actions"><span>举个例子</span><span>' + (lv.depth <= 2 ? '更简单一点' : '再深入讲讲') + '</span><span>出题练一练</span></p>' +
          '</div>' +
        '</div>' +
        '<div class="hero-grade">' +
          '<p class="muted small">切换年级，看看讲法怎么变：</p>' +
          gradePicker(grade) +
        '</div>' +
      '</div>' +
    '</div>' +
  '</section>' +

  '<section class="wrap section">' +
    '<div class="section-head"><h2>五种形态，一套课程</h2><p class="muted">同一个知识点，可以讲、可以看、可以读、可以写、可以玩。</p></div>' +
    '<div class="feature-grid">' +
      featureCard('💬', '对话讲评', '按学段调整深浅；说「听不懂」会自动降一级重讲，反复追问会沿着「比喻→例子→拆步骤→原理→挑战」逐渐加深。', '/chat') +
      featureCard('🎬', '原理动画', '十二个可交互的可视化：拖动分界线看准确率变化、调节温度看生成概率、切换数据集看偏见如何产生。', '/studio?tab=anim') +
      featureCard('📖', 'AI 绘本馆', '专为 1～3 年级做的五本 AI 启蒙绘本：大图短句带拼音，会读给你听，读完还有小游戏拿星星。', '/book') +
      featureCard('⌨️', '编程实践', '小AI走迷宫：拖积木帮它回家，积木实时变成 Python；代码实验室内置教学用迷你解释器。', '/code') +
      featureCard('🎮', '游戏化练习', '知识闯关、数据标注师、神经网络训练、记忆配对，即时反馈并自动收集错题。', '/games') +
      featureCard('📊', '学情看板', '知识点掌握、正确率、薄弱环节与教学建议，可一键导出学习报告。', '/dashboard') +
    '</div>' +
  '</section>' +

  '<section class="wrap section">' +
    '<div class="section-head"><h2>课程地图</h2><p class="muted">' + stats.domains + ' 个领域，' + stats.topics + ' 个知识点，从「AI 是什么」一直走到「自己做一个 AI 小项目」。</p></div>' +
    '<div class="domain-grid">' + domains + '</div>' +
  '</section>' +

  '<section class="wrap section">' +
    '<div class="section-head"><h2>为你推荐</h2><p class="muted">按 ' + grade + ' 年级与学习进度自动挑选。</p></div>' +
    '<div class="topic-grid">' + recs.map(t => topicCard(t, { grade: grade, progress: student ? student.progress : null })).join('') + '</div>' +
  '</section>' +

  '<section class="wrap section">' +
    '<div class="cta-band">' +
      '<div>' +
        '<h2>先试一个问题：' + esc(recs[0] ? recs[0].title : '什么是人工智能') + '</h2>' +
        '<p class="muted">不用注册，输入框里打字就能开始。学习记录会保存在本机。</p>' +
      '</div>' +
      '<a class="btn btn-primary btn-lg" href="/chat' + (recs[0] ? '?ask=' + encodeURIComponent(recs[0].title) : '') + '">开始上课</a>' +
    '</div>' +
  '</section>';

  return layout('首页', body, { nav: navBar('home'), active: 'home', student: student, llmActive: llm.enabled() });
}

function featureCard(emoji, title, desc, href) {
  return '<a class="feature-card" href="' + href + '">' +
    '<span class="feature-emoji" aria-hidden="true">' + emoji + '</span>' +
    '<h3>' + esc(title) + '</h3>' +
    '<p>' + esc(desc) + '</p>' +
    '<span class="feature-more">进入 →</span>' +
  '</a>';
}

/* ---------------- 课程地图 ---------------- */
function coursesPage(student, query) {
  const stats = content.stats();
  const grade = student ? student.grade : 5;
  const lv = content.levelOfGrade(grade);
  const domain = query && query.domain ? query.domain : 'all';
  const list = content.listTopics({}).filter(t => domain === 'all' || t.domain === domain);

  const filters = '<a class="filter-chip' + (domain === 'all' ? ' is-on' : '') + '" href="/courses">全部领域</a>' +
    stats.byDomain.map(d => '<a class="filter-chip' + (domain === d.id ? ' is-on' : '') + '" href="/courses?domain=' + d.id + '" style="--dc:' + d.color + '">' +
      d.emoji + ' ' + esc(d.name) + '</a>').join('');

  const grouped = content.DOMAINS.map(d => {
    const items = list.filter(t => t.domain === d.id);
    if (!items.length) return '';
    const done = student ? items.filter(t => student.progress[t.id] && student.progress[t.id].status === 'done').length : 0;
    return '<section class="domain-block" id="' + d.id + '">' +
      '<div class="domain-head" style="--dc:' + d.color + '">' +
        '<h2><span aria-hidden="true">' + d.emoji + '</span> ' + esc(d.name) + '</h2>' +
        '<p class="muted">' + esc(d.note) + '</p>' +
        '<span class="chip chip-tiny">' + done + ' / ' + items.length + ' 已掌握</span>' +
      '</div>' +
      '<div class="topic-grid">' + items.map(t => topicCard(t, { grade: grade, progress: student ? student.progress : null })).join('') + '</div>' +
    '</section>';
  }).join('');

  const body =
  '<section class="wrap section">' +
    '<div class="page-head">' +
      '<div>' +
        '<h1>课程地图</h1>' +
        '<p class="muted">' + stats.domains + ' 个领域 · ' + stats.topics + ' 个知识点 · ' + stats.questions + ' 道分层练习。' +
        '当前按 <b>' + grade + ' 年级（' + esc(lv.name) + '）</b> 标注适配情况，点击任意知识点进入课堂。</p>' +
      '</div>' +
      '<div class="page-head-side">' +
        '<label class="field-inline"><span>搜索</span><input type="search" id="course-search" placeholder="例如：过拟合、隐私、卷积"></label>' +
      '</div>' +
    '</div>' +
    '<div class="filter-row">' + filters + '</div>' +
    '<div class="level-legend">' +
      content.LEVELS.map(l => '<span class="chip chip-tiny" style="--dc:' + lvColor(l.id) + '">' + l.emoji + ' ' + esc(l.name) + ' · ' + l.topics + ' 个知识点</span>').join('') +
    '</div>' +
    '<div id="course-list">' + grouped + '</div>' +
  '</section>';

  return layout('课程地图', body, { nav: navBar('courses'), active: 'courses', student: student, llmActive: llm.enabled() });
}

/* ---------------- 知识点详情 ---------------- */
function topicPage(topic, student, query) {
  const grade = student ? student.grade : 5;
  const wantLevel = query && query.level ? query.level : content.levelOfGrade(grade).id;
  const pack = content.contentFor(topic, wantLevel);
  const lv = pack ? pack.level : content.levelOfGrade(grade);
  const domain = content.domainById(topic.domain) || {};
  const prog = student && student.progress[topic.id] ? student.progress[topic.id] : null;
  const related = content.search(topic.domain + ' ' + topic.title, 3).filter(x => x.id !== topic.id).slice(0, 2);

  // 四个学段的讲法对照
  const compare = content.LEVELS.filter(l => topic.byLevel[l.id]).map(l => {
    const c = topic.byLevel[l.id];
    const isCur = l.id === lv.id;
    return '<details class="level-block"' + (isCur ? ' open' : '') + '>' +
      '<summary>' +
        '<span class="level-name" style="--dc:' + lvColor(l.id) + '">' + l.emoji + ' ' + esc(l.name) + '</span>' +
        '<span class="level-meta">' + l.minGrade + '–' + l.maxGrade + ' 年级 · 深度 ' + l.depth + '/4 · ' + esc(l.style) + '</span>' +
        (isCur ? '<span class="badge badge-on">当前学段</span>' : '') +
      '</summary>' +
      '<div class="level-body">' +
        '<p class="level-hook">' + esc(c.hook) + '</p>' +
        '<div class="level-explain">' + markdownLite(c.explain) + '</div>' +
        '<p class="level-line"><b>生活例子</b>' + esc(c.example) + '</p>' +
        '<p class="level-line"><b>动手活动</b>' + esc(c.activity) + '</p>' +
        '<p class="level-line"><b>思考问题</b>' + esc(c.ask) + '</p>' +
      '</div>' +
    '</details>';
  }).join('');

  const terms = (topic.terms || []).map(t =>
    '<div class="term-card"><b>' + esc(t.term) + '</b><p>' + esc(t.plain) + '</p><small>' + esc(t.example) + '</small></div>').join('');

  const mis = (topic.misunderstand || []).map(m =>
    '<div class="mis-card"><p class="mis-wrong">✗ ' + esc(m.wrong) + '</p><p class="mis-right">✓ ' + esc(m.right) + '</p></div>').join('');

  const body =
  '<section class="wrap section">' +
    '<nav class="breadcrumb"><a href="/courses">课程地图</a> <span>/</span> <a href="/courses?domain=' + topic.domain + '">' + esc(domain.name || '') + '</a> <span>/</span> <b>' + esc(topic.title) + '</b></nav>' +
    '<div class="topic-head">' +
      '<div class="topic-head-main">' +
        '<span class="topic-emoji-lg" aria-hidden="true">' + topic.emoji + '</span>' +
        '<div>' +
          '<h1>' + esc(topic.title) + '</h1>' +
          '<p class="muted">' + esc(topic.objective.know) + '</p>' +
          '<div class="topic-meta">' +
            '<span class="chip chip-tiny" style="--dc:' + (domain.color || '#666') + '">' + (domain.emoji || '') + ' ' + esc(domain.name || '') + '</span>' +
            '<span class="chip chip-tiny">' + topic.gradeMin + '–' + topic.gradeMax + ' 年级</span>' +
            '<span class="chip chip-tiny">适配学段：' + (topic.bands || []).map(b => content.levelById(b).short).join(' / ') + '</span>' +
            (prog ? '<span class="badge badge-' + prog.status + '">' + (prog.status === 'done' ? '已掌握' : '学习中') + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="topic-head-actions">' +
        '<a class="btn btn-primary" href="/chat?ask=' + encodeURIComponent('讲讲' + topic.title) + '&topic=' + topic.id + '">让 AI 老师讲</a>' +
        '<button class="btn btn-ghost" type="button" data-quiz-start="' + topic.id + '">做练习</button>' +
        '<a class="btn btn-ghost" href="/studio?topic=' + topic.id + '">看动画 / 绘本</a>' +
      '</div>' +
    '</div>' +

    '<div class="topic-body">' +
      '<div class="topic-main">' +
        '<div class="panel">' +
          '<div class="panel-head"><h2>学习内容</h2>' +
          '<div class="panel-tools">' + content.LEVELS.filter(l => topic.byLevel[l.id]).map(l =>
            '<a class="filter-chip' + (l.id === lv.id ? ' is-on' : '') + '" href="/topic/' + topic.id + '?level=' + l.id + '" style="--dc:' + lvColor(l.id) + '">' + l.short + '</a>').join('') +
          '</div></div>' +
          '<div class="lesson">' +
            '<p class="lesson-hook">' + esc(pack ? pack.content.hook : '') + '</p>' +
            '<div class="lesson-explain">' + markdownLite(pack ? pack.content.explain : '') + '</div>' +
            '<div class="lesson-grid">' +
              '<div class="lesson-box"><b>生活里的例子</b><p>' + esc(pack ? pack.content.example : '') + '</p></div>' +
              '<div class="lesson-box"><b>动手做一做</b><p>' + esc(pack ? pack.content.activity : '') + '</p></div>' +
            '</div>' +
            '<div class="lesson-ask"><b>想一想</b><p>' + esc(pack ? pack.content.ask : '') + '</p></div>' +
            (pack && pack.fallback ? '<p class="notice">这个知识点暂未单独编写 ' + esc(content.levelById(wantLevel).name) + ' 的版本，以上为最接近的学段内容。</p>' : '') +
          '</div>' +
        '</div>' +

        '<div class="panel">' +
          '<div class="panel-head"><h2>随堂练习</h2><p class="muted small">答完立刻批改，错题自动进错题本。</p></div>' +
          '<div id="topic-quiz" class="quiz-embedded" data-topic="' + topic.id + '"></div>' +
        '</div>' +

        '<div class="panel">' +
          '<div class="panel-head"><h2>四个学段怎么讲</h2><p class="muted small">同一知识点，语言、例子与要求完全不同。</p></div>' +
          '<div class="level-compare">' + compare + '</div>' +
        '</div>' +
      '</div>' +

      '<aside class="topic-aside">' +
        '<div class="panel">' +
          '<h3>关键要点</h3>' +
          '<ol class="key-list">' + (topic.key || []).map(k => '<li>' + esc(k) + '</li>').join('') + '</ol>' +
          (topic.standard ? '<p class="std">📎 ' + esc(topic.standard) + '</p>' : '') +
        '</div>' +
        '<div class="panel">' +
          '<h3>术语卡</h3>' +
          '<div class="term-list">' + terms + '</div>' +
        '</div>' +
        '<div class="panel">' +
          '<h3>常见误区</h3>' +
          '<div class="mis-list">' + mis + '</div>' +
        '</div>' +
        (related.length ? '<div class="panel"><h3>相关知识</h3><ul class="rel-list">' +
          related.map(r => '<li><a href="/topic/' + r.id + '">' + r.emoji + ' ' + esc(r.title) + '</a></li>').join('') + '</ul></div>' : '') +
        '<div class="panel">' +
          '<h3>学习目标</h3>' +
          '<p class="small"><b>知道</b>：' + esc(topic.objective.know) + '</p>' +
          '<p class="small"><b>会做</b>：' + esc(topic.objective.do) + '</p>' +
        '</div>' +
      '</aside>' +
    '</div>' +
  '</section>';

  const extra = '<script src="/js/quiz.js"></script>';
  return layout(topic.title, body, {
    nav: navBar('courses'), active: 'courses', student: student,
    llmActive: llm.enabled(), extraScripts: extra
  });
}

/** 把纯文本讲解渲染为段落（保留换行语义） */
function markdownLite(text) {
  return String(text || '').split(/\n+/).filter(Boolean)
    .map(line => '<p>' + esc(line).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + '</p>').join('');
}

/* ---------------- AI 课堂（对话页） ---------------- */
function chatPage(student, query) {
  const grade = student ? student.grade : 5;
  const lv = content.levelOfGrade(grade);
  const recs = content.recommend(grade, student ? student.progress : {}, 6);
  const initialAsk = query && query.ask ? query.ask : '';
  const topicId = query && query.topic ? query.topic : '';

  const starters = recs.map(t => '<button class="starter" type="button" data-ask="' + esc('讲讲' + t.title) + '" data-topic="' + t.id + '">' +
    '<span aria-hidden="true">' + t.emoji + '</span><b>' + esc(t.title) + '</b></button>').join('');

  const body =
  '<section class="wrap section chat-section">' +
    '<div class="chat-layout">' +
      '<div class="chat-main">' +
        '<header class="chat-header">' +
          '<div class="chat-teacher">' +
            '<span class="teacher-face" aria-hidden="true">🧑‍🏫</span>' +
            '<div>' +
              '<b>启明老师</b>' +
              '<small id="chat-mode">' + esc(lv.name) + '模式 · 深度 ' + lv.depth + '/4 · ' + (llm.enabled() ? '大模型生成' : '本地教学引擎') + '</small>' +
            '</div>' +
          '</div>' +
          '<div class="chat-header-actions">' +
            '<label class="field-inline small"><span>年级</span>' +
              '<select id="chat-grade">' + Array.from({ length: 12 }, (_, i) => i + 1).map(g =>
                '<option value="' + g + '"' + (g === grade ? ' selected' : '') + '>' + g + ' 年级</option>').join('') +
              '</select></label>' +
            '<button class="btn btn-ghost btn-sm" type="button" id="chat-clear">新对话</button>' +
          '</div>' +
        '</header>' +
        '<div class="chat-log" id="chat-log" aria-live="polite"></div>' +
        '<div class="chat-starters" id="chat-starters">' + starters + '</div>' +
        '<form class="chat-input" id="chat-form">' +
          '<label class="sr-only" for="chat-input">输入你的问题</label>' +
          '<textarea id="chat-input" rows="1" placeholder="问我任何 AI 问题，例如：' +
            esc(lv.depth <= 2 ? '机器人是怎么认字的？' : '神经网络是怎么学习的？') + '"></textarea>' +
          '<button class="btn btn-primary" type="submit" id="chat-send">发送</button>' +
        '</form>' +
        '<p class="chat-hint muted small">按 Enter 发送，Shift+Enter 换行。说的不清楚也没关系，我会追问。</p>' +
      '</div>' +
      '<aside class="chat-aside">' +
        '<div class="panel">' +
          '<h3>你的画像</h3>' +
          '<div class="profile-mini">' +
            '<span class="profile-avatar">' + esc(student ? student.avatar : '🌱') + '</span>' +
            '<div>' +
              '<b>' + esc(student && student.name ? student.name : '未命名同学') + '</b>' +
              '<p class="muted small">' + grade + ' 年级 · ' + esc(lv.name) + '</p>' +
            '</div>' +
          '</div>' +
          '<p class="muted small">我会用「' + esc(lv.style) + '」的方式讲课，句子' + esc(lv.sentence) + '。</p>' +
        '</div>' +
        '<div class="panel">' +
          '<h3>这节课可以这样问</h3>' +
          '<ul class="ask-list">' +
            '<li>「什么是机器学习」</li>' +
            '<li>「为什么要清洗数据」</li>' +
            '<li>「举个例子」/「听不懂」</li>' +
            '<li>「出题考考我」</li>' +
            '<li>「生成一本绘本」</li>' +
          '</ul>' +
        '</div>' +
        '<div class="panel">' +
          '<h3>接下来学什么</h3>' +
          '<ul class="rel-list">' + recs.slice(0, 4).map(t =>
            '<li><a href="/topic/' + t.id + '">' + t.emoji + ' ' + esc(t.title) + '</a></li>').join('') + '</ul>' +
        '</div>' +
      '</aside>' +
    '</div>' +
  '</section>';

  const extraScripts = '<script src="/js/chat.js"></script>' +
    (initialAsk ? '<script>window.__INITIAL_ASK__ = ' + JSON.stringify(initialAsk) + ';window.__INITIAL_TOPIC__ = ' + JSON.stringify(topicId) + ';</script>' : '');
  return layout('AI 课堂', body, {
    nav: navBar('chat'), active: 'chat', student: student,
    llmActive: llm.enabled(), extraScripts: extraScripts
  });
}

/* ---------------- AI 动画：真正的骨骼动画短片 ---------------- */
function animPage(student, query) {
  const grade = Number(query.grade) || (student ? student.grade : 1) || 1;
  const body =
  '<section class="wrap section">' +
    '<div class="page-head">' +
      '<div>' +
        '<h1>🎬 AI 动画片</h1>' +
        '<p class="muted">这不是「图片加配音」。角色被拆成 <b>9 个可以独立运动的部件</b>——头、身体、' +
        '左右手臂、左右腿、呆毛、眼睛、嘴巴，按<b>动作时间轴</b>逐帧驱动：走路时手臂前后摆、跳起来前先蹲一下、' +
        '摔倒了还会回弹两下。<b>镜头是活的</b>（跟拍 / 推近 / 摇晃），背景分<b>三层视差</b>，' +
        '画面里的微尘在飘、叶子在摆、光斑在流动。播到关键节点会停下来，角色<b>转过头来问孩子一句</b>。' +
        '需要带走的话，右上角可以导出成 MP4。</p>' +
      '</div>' +
      '<div class="page-head-side">' +
        '<label class="field-inline small"><span>故事</span><select id="anim-book"></select></label>' +
        '<label class="video-check" style="margin-left:10px"><input type="checkbox" id="anim-auto" checked><span>连播</span></label>' +
      '</div>' +
    '</div>' +
    '<div id="anim-root"><div class="panel"><p class="muted">正在准备动画…</p></div></div>' +
  '</section>';
  return layout('AI 动画 · 启明 AI 课堂', body, {
    nav: navBar('video'), active: 'video', student: student,
    llmActive: llm.enabled(),
    extraHead: '<link rel="stylesheet" href="/css/anim.css">',
    extraScripts: '<script src="/js/picturebook.js"></script><script src="/js/video.js"></script>'
  });
}

/* ---------------- AI 视频：把绘本渲染成一支短片 ---------------- */
function videoPage(student, query) {
  const grade = Number(query.grade) || (student ? student.grade : 1) || 1;
  const body =
  '<section class="wrap section">' +
    '<div class="page-head">' +
      '<div>' +
        '<h1>🎬 AI 视频</h1>' +
      '<p class="muted"><a class="btn btn-primary btn-sm" href="/animation">▶ 看真正的骨骼动画版</a> ' +
          '<span class="small">角色被拆成 9 个可动部件，按动作时间轴逐帧演出</span></p>' +
        '<p class="muted">这里的「AI 视频」是把绘本渲染成可以下载的 MP4：画面、拼音字幕、中文配音，全部在本机生成，' +
        '不需要联网、不依赖任何外部服务。渲染在后台进行，可以边等边看别的。</p>' +
      '</div>' +
      '<div class="page-head-side">' +
        '<label class="field-inline small"><span>年级</span>' +
          '<select id="video-grade">' + Array.from({ length: 12 }, (_, i) => i + 1).map(g =>
            '<option value="' + g + '"' + (g === grade ? ' selected' : '') + '>' + g + ' 年级</option>').join('') +
          '</select></label>' +
      '</div>' +
    '</div>' +
    '<div class="video-layout">' +
      '<aside class="video-side">' +
        '<h2 class="video-h">📚 挑一本故事</h2>' +
        '<div class="video-books" id="video-books"><p class="muted small">正在准备…</p></div>' +
        '<h2 class="video-h">⚙️ 生成设置</h2>' +
        '<div class="video-opts">' +
          '<label class="video-check"><input type="checkbox" id="video-voice" checked><span>加中文配音</span></label>' +
          '<label class="video-check"><input type="checkbox" id="video-sub" checked><span>加拼音字幕</span></label>' +
          '<label class="video-check"><input type="checkbox" id="video-short"><span>只渲染前 3 页（试看）</span></label>' +
        '</div>' +
        '<button class="btn btn-primary" type="button" id="video-go" style="width:100%">🎬 生成视频</button>' +
        '<p class="muted small" id="video-note">大约需要十几秒到一两分钟。</p>' +
      '</aside>' +
      '<section class="video-main">' +
        '<div class="video-stage" id="video-stage">' +
          '<div class="panel"><p class="muted">左边挑一本故事，点「生成视频」，这里就会出现播放器。</p></div>' +
        '</div>' +
        '<h2 class="video-h">🎞️ 我的作品</h2>' +
        '<div class="video-list" id="video-list"><p class="muted small">还没有作品。</p></div>' +
      '</section>' +
    '</div>' +
  '</section>';
  return layout('AI 视频 · 启明 AI 课堂', body, {
    nav: navBar('video'), active: 'video', student: student,
    llmActive: llm.enabled(),
    extraHead: '<link rel="stylesheet" href="/css/video.css">',
    extraScripts: '<script src="/js/video.js"></script>'
  });
}

/* ---------------- 创作工坊（动画 / 绘本） ---------------- */
function studioPage(student, query) {
  const pbEngine = require('./pb-engine');
  const THEMES = pbEngine.THEMES;
  const grade = student ? student.grade : 5;
  const lv = content.levelOfGrade(grade);
  const tab = query && query.tab ? query.tab : 'anim';
  const topicId = query && query.topic ? query.topic : '';
  const topic = topicId ? content.getTopic(topicId) : null;

  const topicsWithArt = content.ALL.filter(t => ['vision-image', 'ml-what', 'ml-eval', 'ethics-fair', 'gen-llm', 'lang-nlp', 'data-what', 'algo-flow'].indexOf(t.id) >= 0);

  const body =
  '<section class="wrap section">' +
    '<div class="page-head">' +
      '<div>' +
        '<h1>创作工坊</h1>' +
        '<p class="muted">同一个知识点，换一种形态再讲一遍：可交互的原理动画，或按年级改写文字的 AI 绘本。' +
        '当前学段 <b>' + esc(lv.name) + '</b>，生成的内容会自动匹配这个深度。</p>' +
      '</div>' +
      '<div class="page-head-side">' +
        '<label class="field-inline small"><span>年级</span>' +
          '<select id="studio-grade">' + Array.from({ length: 12 }, (_, i) => i + 1).map(g =>
            '<option value="' + g + '"' + (g === grade ? ' selected' : '') + '>' + g + ' 年级</option>').join('') +
          '</select></label>' +
      '</div>' +
    '</div>' +
    '<div class="tabs" id="studio-tabs">' +
      '<button class="tab' + (tab === 'anim' ? ' is-on' : '') + '" type="button" data-tab="anim">🎬 原理动画</button>' +
      '<button class="tab' + (tab === 'book' ? ' is-on' : '') + '" type="button" data-tab="book">📖 AI 绘本</button>' +
    '</div>' +

    /* —— 原理动画：知识点选择 + 动画舞台 —— */
    '<div class="studio-region" id="studio-region-anim"' + (tab === 'book' ? ' hidden' : '') + '>' +
      '<div class="studio-topic-picker">' +
        '<span class="muted small">选择知识点：</span>' +
        topicsWithArt.map(t => '<button class="filter-chip' + (topic && topic.id === t.id ? ' is-on' : '') + '" type="button" data-studio-topic="' + t.id + '">' +
          t.emoji + ' ' + esc(t.title) + '</button>').join('') +
      '</div>' +
      '<div id="studio-stage" class="studio-stage" data-topic="' + (topic ? topic.id : '') + '" data-tab="anim">' +
        '<div class="panel"><p class="muted">请选择一个知识点开始。</p></div>' +
      '</div>' +
    '</div>' +

    /* —— AI 绘本：专属界面，左侧生成/选择，右侧沉浸式预览 —— */
    '<div class="studio-region" id="studio-region-book"' + (tab === 'book' ? '' : ' hidden') + '>' +
      '<div class="pb-studio">' +
        '<aside class="pb-studio-side">' +
          '<h2 class="pb-studio-h">📚 挑一个主题</h2>' +
          '<div class="pb-themes pb-themes-vert" id="pb-themes">' +
            '<button class="pb-theme is-on" type="button" data-theme="all">📚 全部故事<span>八个故事随便挑</span></button>' +
            THEMES.map(t => '<button class="pb-theme" type="button" data-theme="' + t.id + '">' +
              t.emoji + ' ' + esc(t.name) + '<span>' + esc(t.hint) + '</span></button>').join('') +
          '</div>' +
          '<h2 class="pb-studio-h">✨ 一键生成绘本</h2>' +
          '<div class="pb-gen">' +
            '<textarea id="pb-gen-input" rows="3" placeholder="例如：生成一本适合 1 年级的 AI 认猫绘本"></textarea>' +
            '<div class="pb-gen-row">' +
              '<button class="btn btn-primary btn-sm" type="button" id="pb-gen-go">✨ 生成绘本</button>' +
              '<button class="btn btn-ghost btn-sm" type="button" data-gen="生成一本适合1年级的AI认猫绘本">认猫</button>' +
              '<button class="btn btn-ghost btn-sm" type="button" data-gen="讲一个机器怎么听懂人话的故事">听声音</button>' +
              '<button class="btn btn-ghost btn-sm" type="button" data-gen="关于过拟合和死记硬背">死记硬背</button>' +
              '<button class="btn btn-ghost btn-sm" type="button" data-gen="小AI为什么认错人">认错人</button>' +
            '</div>' +
            '<p class="muted small" id="pb-gen-note">输入一句话，就会生成完整分页脚本：画面 Prompt、台词、互动设计一应俱全。</p>' +
          '</div>' +
          '<h2 class="pb-studio-h">📖 已生成的绘本</h2>' +
          '<div class="pb-studio-cards" id="pb-studio-cards">' +
            '<p class="muted small">正在准备…</p>' +
          '</div>' +
        '</aside>' +
        '<section class="pb-studio-main" id="pb-studio-main">' +
          '<div class="panel"><p class="muted">点左边任意一本绘本，这里就会翻开它。</p></div>' +
        '</section>' +
      '</div>' +
    '</div>'
  return layout('创作工坊', body, {
    nav: navBar('studio'), active: 'studio', student: student,
    llmActive: llm.enabled(),
    extraScripts: '<link rel="stylesheet" href="/css/picturebook.css">' +
      '<script src="/js/picturebook.js"></script><script src="/js/studio.js"></script>'
  });
}

/* ---------------- 编程实践 ---------------- */
function codePage(student) {
  const grade = student ? student.grade : 5;
  const lv = content.levelOfGrade(grade);
  const labs = [
    { id: 'maze', name: '小AI走迷宫', emoji: '🤖', desc: '小AI迷路了，快用积木帮它回家吧！', levels: '低年级起' },
    { id: 'python', name: 'Python 实验室', emoji: '🐍', desc: '内置教学用迷你解释器，可画图、有死循环保护', levels: '小学高年级起' },
    { id: 'js', name: 'JavaScript 实验室', emoji: '⚡', desc: '沙箱执行，同样的绘图 API', levels: '初中起' },
    { id: 'tasks', name: 'AI 实践任务', emoji: '🎯', desc: '梯度下降、规则分类器、k 近邻投票三个任务卡', levels: '初中起' }
  ];

  const body =
  '<section class="wrap section">' +
    '<div class="page-head">' +
      '<div>' +
        '<h1>编程实践</h1>' +
        '<p class="muted">小AI迷路了，快用积木帮它回家吧！搭积木 → 看小AI 真的走起来 → 旁边魔法书同步变成 Python。' +
        '每通过一关都会记录到你的学习档案；当前学段 <b>' + esc(lv.name) + '</b>，' +
        '推荐从「' + (lv.depth <= 2 ? '小AI走迷宫' : 'Python 实验室') + '」入手。</p>' +
      '</div>' +
    '</div>' +
    '<div class="tabs" id="code-tabs">' +
      labs.map((l, i) => '<button class="tab' + (i === 0 ? ' is-on' : '') + '" type="button" data-lab="' + l.id + '">' + l.emoji + ' ' + esc(l.name) + '</button>').join('') +
    '</div>' +
    '<div class="lab-desc" id="lab-desc"><p class="muted small">' + esc(labs[0].desc) + '</p></div>' +
    /* 把学段传给前端：关卡要按年级自适应（低年级先学顺序和循环，
       高年级才出现条件和进阶循环）。 */
    '<div id="code-stage" class="code-stage" data-depth="' + lv.depth + '" data-grade="' + grade + '"></div>' +
  '</section>';

  return layout('编程实践', body, {
    nav: navBar('code'), active: 'code', student: student,
    llmActive: llm.enabled(), extraScripts: '<script src="/js/lab.js"></script>'
  });
}

/* ---------------- 练习中心 ---------------- */
function gamesPage(student) {
  const grade = student ? student.grade : 5;
  const lv = content.levelOfGrade(grade);
  const games = [
    { id: 'quiz', name: '知识闯关', emoji: '🎯', desc: '限时快问快答，连击加分，答错立刻解析并进错题本', best: student && student.best ? student.best.quiz : 0 },
    { id: 'label', name: '数据标注师', emoji: '🏷️', desc: '亲手标注样本再训练模型，用真实统计看「数据决定模型」', best: student && student.best ? student.best.label : 0 },
    { id: 'net', name: '神经网络训练', emoji: '🧠', desc: '调权重与偏置，用真实计算让四个点全部分类正确', best: student && student.best ? student.best.net : 0 },
    { id: 'match', name: '术语配对', emoji: '🃏', desc: '术语与通俗解释翻牌配对，用最少步数拿三星', best: student && student.best ? student.best.match : 0 }
  ];
  const wrongOpen = student ? (student.wrongBook || []).filter(w => !w.fixed) : [];

  const body =
  '<section class="wrap section">' +
    '<div class="page-head">' +
      '<div>' +
        '<h1>练习中心</h1>' +
        '<p class="muted">四个小游戏，把刚学的概念立刻用一遍。当前学段 <b>' + esc(lv.name) + '</b>，' +
        (lv.depth <= 2 ? '低年级的闯关不限时间，慢慢想没关系。' : '闯关题目按你的学段自动选难度。') + '</p>' +
      '</div>' +
      '<div class="page-head-side">' +
        '<label class="field-inline small"><span>领域</span>' +
          '<select id="games-domain"><option value="all">全部领域</option>' +
          content.DOMAINS.map(d => '<option value="' + d.id + '">' + d.emoji + ' ' + esc(d.name) + '</option>').join('') +
          '</select></label>' +
      '</div>' +
    '</div>' +
    '<div class="game-grid" id="game-grid">' +
      games.map(g =>
        '<article class="game-card" data-game="' + g.id + '">' +
          '<span class="game-emoji" aria-hidden="true">' + g.emoji + '</span>' +
          '<h3>' + esc(g.name) + '</h3>' +
          '<p>' + esc(g.desc) + '</p>' +
          '<div class="game-card-foot">' +
            '<span class="chip chip-tiny">最高分 ' + (g.best || 0) + '</span>' +
            '<button class="btn btn-primary btn-sm" type="button" data-play="' + g.id + '">开始</button>' +
          '</div>' +
        '</article>').join('') +
    '</div>' +
    '<div id="game-stage" class="game-stage"></div>' +
    '<div class="two-col">' +
      '<div class="panel">' +
        '<h3>错题本 <span class="chip chip-tiny">' + wrongOpen.length + ' 道待订正</span></h3>' +
        '<div id="wrong-book">' +
          (wrongOpen.length ? wrongOpen.slice(0, 8).map(w =>
            '<div class="wrong-item" data-wrong="' + esc(w.id) + '">' +
              '<p class="wrong-q">' + esc(w.question) + '</p>' +
              '<p class="muted small">你的答案：' + esc(w.mine) + '　正确答案：' + esc(w.answer) + '</p>' +
              '<p class="small">' + esc(w.explain) + '</p>' +
              '<button class="btn btn-ghost btn-sm" type="button" data-fix="' + esc(w.id) + '">我已订正</button>' +
            '</div>').join('') : '<p class="muted">还没有错题，继续保持。</p>') +
        '</div>' +
      '</div>' +
      '<div class="panel">' +
        '<h3>最近练习记录</h3>' +
        '<ul class="event-list" id="recent-events">' +
          ((student && student.events ? student.events.filter(e => e.type === 'quiz').slice(0, 6) : []).map(e =>
            '<li><span class="ev-time">' + formatTime(e.at) + '</span><span>' + esc(e.title || '练习') + '</span>' +
            (e.score === null ? '' : '<b>' + e.score + ' 分</b>') + '</li>').join('') || '<li class="muted">还没有练习记录。</li>') +
        '</ul>' +
      '</div>' +
    '</div>' +
  '</section>';

  return layout('练习中心', body, {
    nav: navBar('games'), active: 'games', student: student,
    llmActive: llm.enabled(), extraScripts: '<script src="/js/quiz.js"></script><script src="/js/games.js"></script>'
  });
}

function formatTime(ts) {
  const d = new Date(ts);
  const p = n => (n < 10 ? '0' + n : String(n));
  return (d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

/* ---------------- 学情看板 ---------------- */
function dashboardPage(student) {
  const Store = require('./store');
  const grade = student ? student.grade : 5;
  const lv = content.levelOfGrade(grade);
  const sum = student ? new Store.Store().summarize(student) : null;
  const prog = student ? student.progress : {};

  const kpis = sum ? [
    { label: '学习行为', value: sum.totalEvents, unit: '次', icon: '📚' },
    { label: '知识点掌握', value: sum.topicsDone, unit: '/ ' + content.ALL.length, icon: '✅' },
    { label: '答题正确率', value: sum.accuracy, unit: '%', icon: '🎯' },
    { label: '连续学习', value: sum.streak, unit: '天', icon: '🔥' },
    { label: '获得徽章', value: sum.badges, unit: '枚', icon: '🏅' },
    { label: '待订正错题', value: sum.wrongOpen, unit: '道', icon: '📕' }
  ] : [];

  const domainRows = content.stats().byDomain.map(d => {
    const items = content.ALL.filter(t => t.domain === d.id);
    const done = items.filter(t => prog[t.id] && prog[t.id].status === 'done').length;
    const learning = items.filter(t => prog[t.id] && prog[t.id].status === 'learning').length;
    const pct = items.length ? Math.round(done / items.length * 100) : 0;
    return '<div class="meter-row">' +
      '<span class="meter-name" style="--dc:' + d.color + '">' + d.emoji + ' ' + esc(d.name) + '</span>' +
      '<span class="meter-bar"><i style="width:' + pct + '%"></i></span>' +
      '<span class="meter-val">' + done + '/' + items.length + (learning ? ' <em>+' + learning + ' 在学</em>' : '') + '</span>' +
    '</div>';
  }).join('');

  const weak = content.ALL.map(t => {
    const p = prog[t.id];
    if (!p) return null;
    const total = (p.correct || 0) + (p.wrong || 0);
    const acc = total ? Math.round(p.correct / total * 100) : null;
    if (acc === null || acc >= 75) return null;
    return { t, acc, attempts: p.attempts };
  }).filter(Boolean).sort((a, b) => a.acc - b.acc).slice(0, 6);

  const bar = sum ? sum.last7.map(d => {
    const max = Math.max.apply(null, sum.last7.map(x => x.count).concat([1]));
    return '<div class="bar-col" title="' + d.day + '：' + d.count + ' 次"><i style="height:' + Math.max(4, d.count / max * 100) + '%"></i><span>' + d.day + '</span></div>';
  }).join('') : '';

  const events = student && student.events ? student.events.slice(0, 14) : [];
  const typeName = { quiz: '练习答题', game: '游戏练习', code: '编程实践', story: '绘本阅读', anim: '观看动画', train: '模型训练', learn: '知识点学习', chat: '对话提问' };

  const badges = [
    { id: 'first-chat', name: '初次相遇', icon: '👋', desc: '完成第一次对话' },
    { id: 'first-quiz', name: '答题新手', icon: '📝', desc: '完成第一组练习' },
    { id: 'perfect-quiz', name: '满分小达人', icon: '🎯', desc: '一组练习全部答对' },
    { id: 'first-code', name: '代码初体验', icon: '⌨️', desc: '运行成功第一段程序' },
    { id: 'story-lover', name: '绘本阅读家', icon: '📖', desc: '读完三本 AI 绘本' },
    { id: 'animator', name: '动画观察员', icon: '🎬', desc: '看完三个原理动画' },
    { id: 'trainer', name: '模型训练师', icon: '🧠', desc: '完成一次模型训练实验' },
    { id: 'three-topics', name: '三连掌握', icon: '🌱', desc: '掌握三个知识点' },
    { id: 'ten-topics', name: '十全十美', icon: '🏆', desc: '掌握十个知识点' },
    { id: 'streak-3', name: '坚持三天', icon: '🔥', desc: '连续三天来学习' },
    { id: 'streak-7', name: '一周不断', icon: '📅', desc: '连续七天来学习' },
    { id: 'fixer', name: '错题清零', icon: '🤝', desc: '订正三道错题' }
  ];
  const owned = student ? student.badges || [] : [];

  const body =
  '<section class="wrap section">' +
    '<div class="page-head">' +
      '<div>' +
        '<h1>学情看板</h1>' +
        '<p class="muted">' + (student && student.name ? esc(student.name) : '未命名同学') + ' · ' + grade + ' 年级 · ' + esc(lv.name) +
        '。所有数据保存在本机 <code>data/students/</code>，可随时导出。</p>' +
      '</div>' +
      '<div class="page-head-side btn-row">' +
        '<a class="btn btn-ghost" href="/api/report" target="_blank" rel="noopener">导出学习报告</a>' +
        '<button class="btn btn-ghost" type="button" id="btn-reset">重新开始</button>' +
      '</div>' +
    '</div>' +

    (sum ? '<div class="kpi-grid">' + kpis.map(k =>
      '<div class="kpi"><span class="kpi-icon" aria-hidden="true">' + k.icon + '</span>' +
      '<div><b>' + k.value + '</b><small>' + k.unit + '</small></div>' +
      '<p>' + esc(k.label) + '</p></div>').join('') + '</div>' : '') +

    '<div class="two-col">' +
      '<div class="panel">' +
        '<h3>近七天学习活跃度</h3>' +
        '<div class="bar-chart">' + (bar || '<p class="muted">还没有记录。</p>') + '</div>' +
      '</div>' +
      '<div class="panel">' +
        '<h3>各领域掌握进度</h3>' +
        '<div class="meter-list">' + domainRows + '</div>' +
      '</div>' +
    '</div>' +

    '<div class="two-col">' +
      '<div class="panel">' +
        '<h3>需要重点巩固</h3>' +
        (weak.length ? '<ul class="weak-list">' + weak.map(w =>
          '<li><a href="/topic/' + w.t.id + '">' + w.t.emoji + ' ' + esc(w.t.title) + '</a>' +
          '<span class="chip chip-tiny">正确率 ' + w.acc + '% · 练习 ' + w.attempts + ' 次</span></li>').join('') + '</ul>'
          : '<p class="muted">还没有明显的薄弱点。做过练习之后这里会给出提示。</p>') +
      '</div>' +
      '<div class="panel">' +
        '<h3>徽章墙 <span class="chip chip-tiny">' + owned.length + ' / ' + badges.length + '</span></h3>' +
        '<div class="badge-wall">' + badges.map(b =>
          '<span class="badge-item' + (owned.indexOf(b.id) >= 0 ? ' is-owned' : '') + '" title="' + esc(b.desc) + '">' +
            '<b>' + b.icon + '</b><small>' + esc(b.name) + '</small></span>').join('') + '</div>' +
      '</div>' +
    '</div>' +

    '<div class="panel">' +
      '<h3>学习记录</h3>' +
      (events.length ? '<ul class="event-list">' + events.map(e =>
        '<li><span class="ev-time">' + formatTime(e.at) + '</span>' +
        '<span class="ev-type">' + esc(typeName[e.type] || e.type) + '</span>' +
        '<span class="ev-title">' + esc(e.title || '—') + '</span>' +
        (e.score === null || e.score === undefined ? '' : '<b>' + e.score + ' 分</b>') + '</li>').join('') + '</ul>'
        : '<p class="muted">还没有学习记录，去 <a href="/chat">AI 课堂</a> 聊两句吧。</p>') +
    '</div>' +

    '<div class="panel teacher-panel">' +
      '<h3>给老师与家长的建议</h3>' +
      '<ul class="advice-list">' +
        (sum && sum.answered === 0 ? '<li>还没有练习数据，建议先安排一组「知识闯关」建立基线。</li>' : '') +
        (sum && sum.answered > 0 && sum.accuracy < 60 ? '<li>整体正确率 ' + sum.accuracy + '%，建议降低难度、回到概念讲解，并用绘本或动画重建直觉。</li>' : '') +
        (sum && sum.accuracy >= 60 && sum.accuracy < 85 ? '<li>整体正确率 ' + sum.accuracy + '%，可通过错题订正与「讲给别人听」的方式巩固。</li>' : '') +
        (sum && sum.accuracy >= 85 ? '<li>整体正确率 ' + sum.accuracy + '%，可以进入更进阶的主题（模型评估、伦理讨论、项目实践）。</li>' : '') +
        (sum && sum.topicsDone < 3 ? '<li>已掌握知识点较少，建议按课程地图顺序每周推进 2~3 个知识点。</li>' : '') +
        (!sum || !sum.byType.code ? '<li>还没有编程实践记录，建议从「小AI走迷宫」入门，降低门槛。</li>' : '') +
        (!sum || !sum.byType.train ? '<li>建议体验「数据标注师」与「神经网络训练」，建立「数据决定模型」的直觉。</li>' : '') +
        '<li>每天 10~15 分钟、保持连续，比一次学很久更有效。</li>' +
      '</ul>' +
    '</div>' +
  '</section>';

  return layout('学情看板', body, {
    nav: navBar('dashboard'), active: 'dashboard', student: student,
    llmActive: llm.enabled(), extraScripts: '<script src="/js/dashboard.js"></script>'
  });
}

/* ---------------- 关于页 ---------------- */
function aboutPage(student) {
  const stats = content.stats();
  const body =
  '<section class="wrap section narrow">' +
    '<h1>关于「启明 AI 课堂」</h1>' +
    '<p class="lead">这是一个面向 K12 人工智能通识课的教学助手：它把「因材施教」拆成了可以计算的参数——年级决定语言与深度，' +
    '掌握度决定推荐顺序，追问决定讲解层次。</p>' +

    '<h2>为什么按年级分开讲</h2>' +
    '<p>同一句「机器学习」，一年级听到的是「给机器看很多例子，它自己慢慢学会」，高三听到的是「在假设空间中寻找使经验风险最小的函数」。' +
    '内容不是同一段文字的缩写，而是四套独立编写的教学稿：情境、例子、活动、追问都不同。</p>' +
    '<div class="level-cards">' + content.LEVELS.map(l =>
      '<div class="level-card" style="--dc:' + lvColor(l.id) + '">' +
        '<b>' + l.emoji + ' ' + esc(l.name) + '</b>' +
        '<small>' + l.minGrade + '–' + l.maxGrade + ' 年级 · ' + esc(l.age) + '</small>' +
        '<p>' + esc(l.style) + '</p>' +
        '<p class="muted small">' + esc(l.vocab) + '</p>' +
      '</div>').join('') + '</div>' +

    '<h2>它怎么"教"</h2>' +
    '<ol class="how-list">' +
      '<li><b>先建立直觉</b>：用一个问题或比喻开场，不先给定义。</li>' +
      '<li><b>再给生活例子</b>：从学生熟悉的事物出发。</li>' +
      '<li><b>然后才引入术语</b>：术语出现时当场解释。</li>' +
      '<li><b>收尾必提问</b>：每次回答最后都留一个需要思考的问题。</li>' +
      '<li><b>追问会加深</b>：同一知识点反复问，会沿「比喻 → 例子 → 拆步骤 → 原理 → 挑战」递进，而不是重复。</li>' +
      '<li><b>说不懂就降级</b>：一句「听不懂」，立刻换低一个学段的讲法重讲。</li>' +
      '<li><b>不装懂</b>：超出课程库的问题会明确说没有把握，并给出可查的方向。</li>' +
    '</ol>' +

    '<h2>课程内容</h2>' +
    '<p>' + stats.domains + ' 个领域、' + stats.topics + ' 个知识点、' + stats.questions + ' 道分层练习，覆盖从「AI 是什么」到「自己做一个 AI 小项目」的完整路径，' +
    '并对齐《义务教育信息科技课程标准》与《普通高中信息技术课程标准》中人工智能模块的知识范畴。</p>' +

    '<h2>技术形态</h2>' +
    '<div class="tech-grid">' +
      '<div><b>多页面站点</b><p class="muted small">服务端按模板渲染，每个知识点都有独立可分享的网址，便于课堂投屏与课后回顾。</p></div>' +
      '<div><b>服务端教师大脑</b><p class="muted small">讲解编排、题目抽选、学情统计都在服务端完成，浏览器只管展示。</p></div>' +
      '<div><b>大模型可选</b><p class="muted small">不配置密钥时用本地引擎上课；配置后由真实模型生成，但学段约束与课程片段会一并注入，风格不会跑偏。</p></div>' +
      '<div><b>零依赖</b><p class="muted small">只用 Node 内置模块，没有 npm 依赖，拷到机房电脑就能跑。</p></div>' +
    '</div>' +
  '</section>';
  return layout('关于', body, { nav: navBar('about'), active: 'about', student: student, llmActive: llm.enabled() });
}


/* ================= AI 绘本模块（低龄段） ================= */

/**
 * 绘本馆：作为独立网页，也可被 iframe 嵌入。
 * URL 参数：grade / embed / auto
 */
function bookLibraryPage(student, query) {
  const pb = require('./pb-engine');
  const grade = Number(query.grade) || (student ? student.grade : 1) || 1;
  const embed = query.embed === '1';
  const auto = query.auto === '1' ? 1 : 0;
  const band = pb.bandOf(grade);
  /* 顶部温暖插画 Banner：小AI 坐在书堆上 —— 全部用内联 SVG，不依赖任何图片素材 */
  const banner = [
    '<svg viewBox="0 0 640 190" class="pb-banner-art" aria-hidden="true">',
    '<defs><linearGradient id="bn" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0%" stop-color="#fff6e0"/><stop offset="60%" stop-color="#ffe9bd"/>',
    '<stop offset="100%" stop-color="#ffd9c8"/></linearGradient>',
    '<filter id="bs" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="16"/></filter></defs>',
    '<rect width="640" height="190" rx="0" fill="url(#bn)"/>',
    '<ellipse cx="520" cy="52" rx="130" ry="80" fill="#fff3cf" opacity=".55" filter="url(#bs)"/>',
    '<ellipse cx="120" cy="150" rx="120" ry="60" fill="#ffd9c8" opacity=".45" filter="url(#bs)"/>',
    /* 书堆：五本叠在一起 */
    '<g transform="translate(300 62)">',
    '<rect x="0" y="86" width="150" height="26" rx="8" fill="#e58098"/>',
    '<rect x="10" y="62" width="132" height="24" rx="8" fill="#8fc7e8"/>',
    '<rect x="4" y="38" width="142" height="24" rx="8" fill="#a8d094"/>',
    '<rect x="16" y="16" width="118" height="22" rx="8" fill="#ffd98a"/>',
    '</g>',
    /* 小AI 坐在书堆上 */
    '<g transform="translate(360 44)">',
    '<ellipse cx="30" cy="72" rx="30" ry="9" fill="#c9a97a" opacity=".35"/>',
    '<line x1="30" y1="12" x2="30" y2="0" stroke="#b9c4d0" stroke-width="3.4"/>',
    '<circle cx="30" cy="-4" r="7" fill="#ffc94d" class="pb-twinkle"/>',
    '<circle cx="30" cy="30" r="34" fill="#ffffff" stroke="rgba(60,120,105,.42)" stroke-width="3"/>',
    '<ellipse cx="18" cy="16" rx="10" ry="6" fill="rgba(255,255,255,.9)"/>',
    '<path d="M 8 36 q 8 -10 16 0" stroke="#3b3630" stroke-width="3.4" fill="none" stroke-linecap="round"/>',
    '<path d="M 36 36 q 8 -10 16 0" stroke="#3b3630" stroke-width="3.4" fill="none" stroke-linecap="round"/>',
    '<path d="M 22 46 q 8 7 16 0" stroke="#e8894f" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
    '<circle cx="8" cy="42" r="6" fill="#ffc2b0" opacity=".7"/><circle cx="52" cy="42" r="6" fill="#ffc2b0" opacity=".7"/>',
    '<rect x="2" y="60" width="14" height="12" rx="6" fill="#6fbfa8"/>',
    '<rect x="44" y="60" width="14" height="12" rx="6" fill="#6fbfa8"/>',
    '</g>',
    /* 飘着的小星星与纸飞机 */
    '<text x="120" y="60" font-size="20" fill="#ffc94d" class="pb-twinkle">✦</text>',
    '<text x="228" y="34" font-size="15" fill="#ffd98a" class="pb-mote">✧</text>',
    '<text x="556" y="120" font-size="17" fill="#ffd98a" class="pb-twinkle">✦</text>',
    '<path d="M 92 108 l 30 -12 l -10 14 l -6 12 z" fill="#fffdf6" stroke="rgba(150,160,180,.5)" stroke-width="1.6"/>',
    '<circle cx="70" cy="152" r="3" fill="#8fc7e8" opacity=".7" class="pb-mote"/>',
    '<circle cx="580" cy="70" r="4" fill="#a8d094" opacity=".7" class="pb-mote"/>',
    '</svg>'
  ].join('');
  return buildBookShell({
    student: student, embed: embed, auto: auto, grade: grade,
    title: '小AI的奇妙世界',
    sub: '陪孩子读懂人工智能',
    lead: '八个温暖的小故事。每本都有大图、拼音和朗读，还能和小AI 说说话。',
    banner: banner,
    themes: pb.THEMES,
    bodyId: 'pb-library',
    extraScripts: '<script src="/js/picturebook.js"></script>',
    inner: '<div id="pb-app"><div class="panel"><p class="muted">正在准备绘本…</p></div></div>'
  });
}

/** 阅读器页面：直接进入某一本 */
function bookReaderPage(bookData, student, query) {
  const embed = query.embed === '1';
  const auto = query.auto === '1' ? 1 : 0;
  return buildBookShell({
    student: student, embed: embed, auto: auto, grade: bookData.band.grade,
    title: bookData.title,
    sub: bookData.emoji + ' ' + bookData.conceptLabel,
    lead: esc(bookData.intro) + ' 当前按 <b>' + esc(bookData.band.name) + '</b> 生成，共 ' + bookData.pages.length + ' 页。',
    bodyId: 'pb-reader',
    extraScripts: '<script src="/js/picturebook.js"></script>' +
      '<script>window.__PB_BOOT__ = ' + JSON.stringify({ id: bookData.id, grade: bookData.band.grade }) + ';</script>',
    inner: '<div id="pb-app"><div class="panel"><p class="muted">正在打开绘本…</p></div></div>'
  });
}

/** 绘本页面的公共外壳（独立页 / 嵌入页两种形态） */
function buildBookShell(o) {
  const embed = o.embed;
  const head =
    '<section class="pb-hero' + (embed ? ' is-embed' : '') + '">' +
      (o.banner && !embed ? '<div class="pb-banner">' + o.banner +
        '<div class="pb-banner-text">' +
          '<p class="pb-eyebrow">🤖 启明 AI 课堂 · 低年级绘本</p>' +
          '<h1>🌟 ' + esc(o.title) + ' —— ' + esc(o.sub) + '</h1>' +
          '<p class="pb-lead">' + o.lead + '</p>' +
        '</div></div>' : '') +
      '<div class="pb-hero-main' + (o.banner && !embed ? ' is-below' : '') + '">' +
        (o.banner && !embed ? '' : (embed ? '' : '<p class="pb-eyebrow">🤖 启明 AI 课堂 · 低年级绘本</p>')) +
        (o.banner && !embed ? '' : '<h1>' + esc(o.title) + '</h1>') +
        (o.banner && !embed ? '' : '<p class="pb-sub">' + esc(o.sub) + '</p>') +
        (o.banner && !embed ? '' : '<p class="pb-lead">' + o.lead + '</p>') +
        '<div class="pb-quick">' +
          '<label class="field-inline small"><span>年级</span><select id="pb-grade">' +
            Array.from({ length: 12 }, (_, i) => i + 1).map(g =>
              '<option value="' + g + '"' + (g === o.grade ? ' selected' : '') + '>' + g + ' 年级</option>').join('') +
          '</select></label>' +
          '<button class="btn btn-ghost btn-sm" type="button" id="pb-voice-toggle" aria-pressed="false">🔈 朗读：关</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" id="pb-help">❓ 怎么玩</button>' +
        '</div>' +
      '</div>' +
      '<div class="pb-hero-side" id="pb-tree">' +
        '<div class="pb-tree-box"><p class="muted small">成长树</p>' +
        '<p class="muted small">读完一本绘本，就长出一片叶子。</p></div>' +
      '</div>' +
    '</section>' +
    /* 横向主题筛选：彩色胶囊，全部是孩子看得懂的说法 */
    (o.themes && !embed ? '<nav class="pb-themes" id="pb-themes" aria-label="绘本主题">' +
      '<button class="pb-theme is-on" type="button" data-theme="all">📚 全部故事</button>' +
      o.themes.map(t => '<button class="pb-theme" type="button" data-theme="' + t.id + '">' +
        t.emoji + ' ' + esc(t.name) + '<span>' + esc(t.hint) + '</span></button>').join('') +
      '</nav>' : '');

  const body = '<section class="wrap pb-wrap' + (embed ? ' is-embed' : '') + '" id="' + o.bodyId + '" ' +
    'data-grade="' + o.grade + '" data-embed="' + (embed ? '1' : '0') + '" data-auto="' + o.auto + '">' +
    head + o.inner + '</section>';

  if (embed) {
    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + esc(o.title) + ' · AI 绘本</title>' +
      '<link rel="stylesheet" href="/css/base.css">' +
      '<link rel="stylesheet" href="/css/components.css">' +
      '<link rel="stylesheet" href="/css/picturebook.css">' +
      '</head><body class="pb-embed-body" data-auto="' + o.auto + '">' +
      body +
      '<div class="toast-stack" id="toasts" aria-live="polite"></div>' +
      '<script src="/js/app.js"></script>' +
      (o.extraScripts || '<script src="/js/picturebook.js"></script>') +
      '</body></html>';
  }
  return layout(o.title + ' · AI 绘本', body, {
    nav: navBar('book'), active: 'book', student: o.student,
    llmActive: llm.enabled(),
    extraHead: '<link rel="stylesheet" href="/css/picturebook.css">',
    extraScripts: o.extraScripts
  });
}

module.exports = {
  navBar, gradePicker, topicCard, lvColor, formatTime, markdownLite,
  homePage, coursesPage, topicPage, chatPage, studioPage, videoPage, animPage, codePage, gamesPage, dashboardPage, aboutPage,
  bookLibraryPage, bookReaderPage
};
