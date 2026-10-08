/**
 * 教学引擎 · 讲课编排（服务端"教师大脑"）
 *
 * 核心职责：
 *   1) 学段调适：同一知识点按四个学段给出不同深度、不同互动方式的讲解
 *   2) 脚手架：反复追问时沿「比喻 → 例子 → 拆步骤 → 原理 → 挑战」逐级加深，而不是原地重复
 *   3) 分层降级：学生说「听不懂」时下调一个学段重讲
 *   4) 教学闭环：每次回答都以一个思考问题收尾，并给出可点的下一步动作
 *   5) 知识网络：给出相关知识点，帮助学生建立结构而不是记孤点
 */
'use strict';

const content = require('../content');
const nlu = require('./nlu');

/* ---------------- 话术库（按学段） ---------------- */
const PHRASES = {
  greet: {
    junior: ['嗨，{name}！我是你的 AI 老师小启～', '你好呀{name}，今天想听什么好玩的事？', '{name}来啦！我们一起看看聪明的机器在想什么吧～'],
    senior: ['你好，{name}！我是 AI 启明，你的 AI 通识课学习伙伴。', '{name}你好！今天想探索人工智能的哪个秘密？', '欢迎回来，{name}！我们继续做 AI 探索家。'],
    middle: ['你好{name}，我是 AI 启明。今天想弄懂哪个概念？', '{name}你好，随时可以问我任何 AI 相关的问题。', '欢迎，{name}。想从原理入手，还是先动手试试？'],
    high: ['你好，{name}。我是 AI 启明，可以陪你做概念澄清、技术推演与伦理讨论。', '{name}你好，今天的话题是什么？', '欢迎。需要我展开原理、给出对比，还是做苏格拉底式追问？']
  },
  praise: {
    junior: ['答对啦！🎉', '完全正确！', '厉害！你已经是小专家了。'],
    senior: ['正确！', '答得漂亮！', '完全正确，思路很清晰。'],
    middle: ['正确。', '对的，而且理由也对。', '判断准确。'],
    high: ['正确。', '结论成立。', '判断无误。']
  },
  encourage: {
    junior: ['太棒了！🌟', '你真会动脑筋！', '这个问题问得真好～'],
    senior: ['这个问题很有价值。', '你抓到了关键点。', '想法不错，继续往下想！'],
    middle: ['这个追问很到位。', '你的直觉是对的，我们把它说严谨一点。', '很好，这正是核心问题。'],
    high: ['这是个切中要害的问题。', '你的提问触及了该问题的核心张力。', '值得展开讨论。']
  },
  ask: {
    junior: ['你觉得呢？', '你来猜猜看～', '如果是你，你会怎么做？'],
    senior: ['你觉得这是为什么？', '先猜一猜，再看看答案。', '如果换一个情况，还成立吗？'],
    middle: ['你的判断是什么？为什么？', '如果参数变了，结论会怎样？', '你能举出一个反例吗？'],
    high: ['你的论证路径是什么？', '这个结论的边界条件是什么？', '有没有反例或竞争性解释？']
  },
  next: {
    junior: ['要不要画个动画看看？', '想读一本小绘本吗？', '我们玩个小游戏好不好？'],
    senior: ['想看看动画演示，还是做两道题？', '要不要去动手试试？', '做个练习检验一下？'],
    middle: ['要不上手调一下参数看看变化？', '做一组练习巩固？', '需要我把推导补全吗？'],
    high: ['需要我给出形式化表述吗？', '要做一次对比实验设计吗？', '要不要延伸讨论它的社会影响？']
  }
};

function pick(arr, seed) {
  if (!arr || !arr.length) return '';
  const i = seed === undefined ? Math.floor(Math.random() * arr.length) : Math.abs(seed) % arr.length;
  return arr[i];
}
function say(kind, levelId, seed) {
  const set = PHRASES[kind] || PHRASES.encourage;
  return pick(set[levelId] || set.senior, seed);
}

/* ---------------- 脚手架阶梯 ---------------- */
const LADDER = [
  { id: 'analogy',   label: '打个比方' },
  { id: 'example',   label: '举个生活例子' },
  { id: 'steps',     label: '拆成小步骤' },
  { id: 'principle', label: '讲讲背后的原理' },
  { id: 'challenge', label: '来个挑战任务' }
];

/** 记忆对象：由调用方（会话）持有，这里只约定字段 */
function freshMemory() {
  return { lastTopicId: null, lastIntent: null, followUps: 0, usedLevels: {}, recentTopics: [] };
}

/** 取该知识点已用过的脚手架层级中的下一个 */
function nextLadder(memory, topicId) {
  if (!memory.usedLevels) memory.usedLevels = {};
  const used = memory.usedLevels[topicId] || (memory.usedLevels[topicId] = []);
  for (const step of LADDER) {
    if (used.indexOf(step.id) < 0) { used.push(step.id); return step.id; }
  }
  return 'challenge';
}
function resetLadder(memory, topicId) {
  if (memory.usedLevels) memory.usedLevels[topicId] = [];
}

/* ---------------- 相关知识网络 ---------------- */
const RELATED = {
  'ai-what': ['ai-life', 'ai-human', 'ml-what'],
  'ai-life': ['ai-what', 'data-privacy', 'future-career'],
  'ai-human': ['ai-what', 'gen-llm', 'ethics-fair'],
  'data-what': ['data-clean', 'ml-what', 'vision-image'],
  'data-clean': ['data-what', 'data-privacy', 'future-project'],
  'data-privacy': ['data-clean', 'ethics-safe', 'ethics-fair'],
  'algo-think': ['algo-flow', 'algo-func', 'future-project'],
  'algo-flow': ['algo-think', 'algo-func', 'algo-debug'],
  'algo-func': ['algo-flow', 'algo-debug', 'future-project'],
  'algo-debug': ['algo-func', 'algo-flow', 'future-project'],
  'ml-what': ['ml-supervised', 'ml-eval', 'data-what'],
  'ml-supervised': ['ml-what', 'ml-eval', 'ml-cluster'],
  'ml-cluster': ['ml-what', 'ml-supervised', 'data-what'],
  'ml-eval': ['ml-what', 'ml-supervised', 'future-project'],
  'vision-image': ['vision-tasks', 'ml-what', 'data-what'],
  'vision-tasks': ['vision-image', 'ml-supervised', 'ethics-fair'],
  'lang-nlp': ['gen-llm', 'gen-prompt', 'vision-image'],
  'gen-llm': ['gen-prompt', 'lang-nlp', 'ethics-safe'],
  'gen-prompt': ['gen-llm', 'lang-nlp', 'ethics-safe'],
  'ethics-fair': ['ethics-safe', 'ai-human', 'future-project'],
  'ethics-safe': ['ethics-fair', 'data-privacy', 'gen-llm'],
  'future-career': ['ai-human', 'future-project', 'gen-prompt'],
  'future-project': ['ml-eval', 'future-career', 'data-clean']
};

function relatedTopics(topic, limit) {
  return (RELATED[topic.id] || []).map(id => content.getTopic(id)).filter(Boolean).slice(0, limit || 2);
}

/* ---------------- 讲解正文组装 ---------------- */
/**
 * 按学段与脚手架层级组装讲解正文
 * @param topic 知识点
 * @param levelId 学段 id（junior/senior/middle/high）
 * @param step 脚手架层级（analogy/example/steps/principle/challenge）
 */
function composeExplanation(topic, levelId, step) {
  const pack = content.contentFor(topic, levelId);
  if (!pack) return '这个知识点我还没有准备好，我们换个话题好吗？';
  const c = pack.content;
  const lv = pack.level;
  const depth = lv.depth;
  const parts = [];

  if (step === 'analogy') {
    parts.push('**先想一想**\n' + c.hook);
    parts.push(c.explain);
    if (depth <= 2) parts.push('🎮 **小任务**：' + c.activity);
  } else if (step === 'example') {
    parts.push('**举个生活里的例子**\n' + c.example);
    if (depth >= 2 && topic.key && topic.key[0]) parts.push('这里的重点是：' + topic.key[0] + '。');
  } else if (step === 'steps') {
    parts.push('**我们一步一步来**');
    parts.push((topic.key || []).slice(0, depth >= 3 ? 4 : 3).map((k, i) => (i + 1) + '. ' + k).join('\n'));
    parts.push(c.explain);
  } else if (step === 'principle') {
    if (depth >= 3) {
      parts.push('**原理层面**\n' + c.explain);
      parts.push('**关键概念**\n' + (topic.terms || []).slice(0, 3).map(t => '- ' + t.term + '：' + t.plain).join('\n'));
      if (topic.standard) parts.push('📎 **课标对应**：' + topic.standard);
    } else {
      parts.push('**为什么呢**\n' + c.example);
      parts.push('简单说，' + ((topic.key && topic.key[1]) || topic.objective.know));
    }
  } else if (step === 'challenge') {
    parts.push('**挑战任务**\n' + c.activity);
    const mm = (topic.misunderstand || [])[0];
    if (mm && depth >= 2) parts.push('**注意一个常见误区**\n有人说「' + mm.wrong + '」，其实' + mm.right);
  } else {
    parts.push(c.explain);
  }

  // 低学段统一补一个可操作的小任务，高学段补术语规范
  if (depth <= 1 && step !== 'analogy' && step !== 'challenge') parts.push('🎮 **小任务**：' + c.activity);
  if (depth >= 3 && step === 'analogy') {
    parts.push('**术语**\n' + (topic.terms || []).slice(0, 2).map(t => '- ' + t.term + '：' + t.plain).join('\n'));
  }
  return parts.filter(Boolean).join('\n\n');
}

/* ---------------- 快捷动作 ---------------- */
function quickActions(topic, levelId) {
  const lv = content.levelById(levelId);
  const out = [];
  if (!topic) {
    return [
      { label: '什么是人工智能', icon: '🤖', action: 'ask', payload: '什么是人工智能' },
      { label: '推荐学习路线', icon: '🧭', action: 'ask', payload: '推荐学习计划' },
      { label: '玩个游戏', icon: '🎮', action: 'goto', payload: '/games' }
    ];
  }
  out.push({ label: '举个例子', icon: '💡', action: 'ask', payload: '举个例子：' + topic.title });
  out.push(lv.depth <= 2
    ? { label: '更简单一点', icon: '🧸', action: 'ask', payload: '再简单一点讲讲：' + topic.title }
    : { label: '再深入讲讲', icon: '🔬', action: 'ask', payload: '深入讲讲：' + topic.title });
  out.push({ label: '出题练一练', icon: '📝', action: 'quiz', payload: topic.id });
  /* 低学段的「读绘本」直接进绘本模块；高学段仍走创作工坊的绘本页 */
  if (lv.depth <= 2) out.push({ label: '读一本绘本', icon: '📖', action: 'goto', payload: '/book?grade=' + (lv.minGrade || 1) });
  out.push({ label: '看动画', icon: '🎬', action: 'goto', payload: '/studio?topic=' + topic.id + '&tab=anim' });
  return out.slice(0, 4);
}

/* ---------------- 主入口 ---------------- */
/**
 * 生成一次回答
 * @param {string} question 学生原话
 * @param {object} ctx { grade, name, memory, history }
 * @returns {object} { text, intent, topicId, topicTitle, levelId, step, actions, media, source, noAnswer }
 */
function answer(question, ctx) {
  ctx = ctx || {};
  const memory = ctx.memory || freshMemory();
  const grade = Number(ctx.grade) || 5;
  let level = content.levelOfGrade(grade);
  const name = (ctx.name || '').trim() || (level.depth <= 1 ? '小朋友' : '同学');
  const text = String(question || '').trim();
  const intent = nlu.detectIntent(text);
  const seed = text.length;

  const plain = (body, extra) => Object.assign({
    text: body, intent, topicId: null, topicTitle: null,
    levelId: level.id, step: null, actions: [], media: null,
    source: 'local', noAnswer: false
  }, extra || {});

  /* --- 会话类意图 --- */
  if (intent === 'greet') {
    const last = memory.lastTopicId ? content.getTopic(memory.lastTopicId) : null;
    let body = say('greet', level.id, seed).replace('{name}', name);
    body += '\n\n' + (last
      ? '上次我们聊到「' + last.title + '」，要不要接着往下？也可以问我任何 AI 相关的问题。'
      : '我可以给你讲原理、放动画、读绘本、陪你写代码、出题练习——试着问我「' + (level.depth <= 2 ? '机器人是怎么认字的' : '神经网络是怎么学习的') + '」。');
    return plain(body, { topicId: last ? last.id : null, actions: quickActions(last, level.id) });
  }

  if (intent === 'identity') {
    return plain([
      '我是 **AI 启明**，一名面向 K12 的人工智能通识课老师。',
      '你的学段是 **' + level.name + '**（' + level.age + '），所以我会用「' + level.style + '」的方式讲解。',
      '',
      '**我能做的事**',
      '- 💬 讲解 AI 概念与原理，并随时按你的理解程度调整深浅',
      '- 🎬 生成原理动画与绘本，把抽象概念变直观',
      '- ⌨️ 陪你做图形化积木与 Python 编程实践',
      '- 🎮 用闯关、标注、训练小游戏帮你巩固知识',
      '- 📊 记录你的学习数据，生成学情报告',
      '',
      '你想从哪一件事开始？'
    ].join('\n'), { actions: quickActions(null, level.id) });
  }

  if (intent === 'thanks') {
    return plain(say('encourage', level.id, seed) + ' 还想继续探索吗？' + say('next', level.id, seed),
      { actions: quickActions(content.getTopic(memory.lastTopicId), level.id) });
  }

  if (intent === 'bye') {
    return plain('好的，' + name + '，今天我们先到这儿。记得明天回来继续，连续学习的效果最好。', { actions: [] });
  }

  if (intent === 'help') {
    return plain([
      '**怎么和我一起学？**',
      '1. 直接把问题打出来，比如「什么是机器学习」「为什么 AI 会认错」。',
      '2. 我讲完会给你按钮：**举个例子 / 更简单一点 / 出题练一练 / 读绘本 / 看动画**。',
      '3. 说「出题」我会出练习并立刻批改；说「生成绘本」「看动画」我会做多媒体内容。',
      '4. 想动手就去「编程实践」，想玩游戏就去「游戏化练习」，想看成长记录就去「学情看板」。',
      '现在，问我第一个问题吧！'
    ].join('\n'), { actions: quickActions(null, level.id) });
  }

  if (intent === 'upset') {
    return plain([
      '别急，' + name + '——**觉得难，说明你正在长本事**。',
      '我们换个方式：我先用最简单的说法讲一遍，你只要记住一句话就够了。',
      '',
      '你想让我从哪个话题开始讲得更简单？（比如「机器学习」「算法」「神经网络」）'
    ].join('\n'), {
      actions: [
        { label: '机器学习', icon: '🧠', action: 'ask', payload: '用最简单的话讲讲什么是机器学习' },
        { label: '算法', icon: '🧩', action: 'ask', payload: '用最简单的话讲讲什么是算法' },
        { label: '我想玩个游戏', icon: '🎮', action: 'goto', payload: '/games' }
      ]
    });
  }

  /* --- 学习计划 --- */
  if (intent === 'plan') {
    const recs = content.recommend(grade, ctx.progress, 4);
    const body = [
      '**为你（' + grade + ' 年级 · ' + level.name + '）定制的学习路线**',
      level.depth <= 1 ? '- 先认识 AI，再玩小游戏，最后动手拖积木。'
        : level.depth === 2 ? '- 先理解概念，再动手验证，最后做一个小项目。'
          : level.depth === 3 ? '- 从原理出发，动手调参数，再用数据说明结论。'
            : '- 概念严谨化 → 实验设计 → 伦理与社会影响研讨。',
      '',
      '**建议接下来学**',
      recs.map((t, i) => (i + 1) + '. ' + t.emoji + ' ' + t.title + '：' + t.objective.know).join('\n'),
      '',
      '想从第几个开始？直接说编号或标题都可以。'
    ].join('\n');
    return plain(body, {
      topicId: recs[0] ? recs[0].id : null,
      actions: recs.slice(0, 3).map(t => ({ label: t.title, icon: t.emoji, action: 'topic', payload: t.id }))
    });
  }

  /* --- 转交其它模块的动作（由前端处理跳转） --- */
  const topicHint = nlu.locate(text, memory);
  const hinted = topicHint.topic;   // 关键词类意图只在真正点名了知识点时才引用它

  if (intent === 'quiz') {
    const target = hinted || content.recommend(grade, ctx.progress, 1)[0];
    return plain('好，我们来练一练' + (target ? '「**' + target.title + '**」' : '') + '。按顺序作答，答完我立刻批改。', {
      topicId: target ? target.id : null,
      actions: [{ label: '开始答题', icon: '📝', action: 'quiz', payload: target ? target.id : '' }]
    });
  }
  if (intent === 'story') {
    /* 低龄段（1～3 年级）直接引导到绘本模块：大图、短句、带拼音、会朗读 */
    const target = hinted || content.recommend(grade, ctx.progress, 1)[0];
    if (Number(grade) <= 3) {
      /* 把知识点映射到最贴近的那本绘本 */
      const PB_MAP = { vision: 'vision', language: 'voice', ml: 'learn', intro: 'day', data: 'learn', algo: 'day', gen: 'day', ethics: 'me', future: 'me' };
      const bookId = (target && PB_MAP[target.domain]) || 'day';
      return plain('好呀！我们读绘本。绘本里有大图、有大字，还会读给你听。\n\n读完了还有小游戏，能拿星星和贴纸哦。', {
        topicId: target ? target.id : null,
        actions: [
          { label: '打开 AI 绘本馆', icon: '📖', action: 'goto', payload: '/book?grade=' + grade },
          { label: '直接读这本', icon: '▶️', action: 'goto', payload: '/book/read?id=' + bookId + '&grade=' + grade }
        ]
      });
    }
    return plain('好的！我用绘本的方式来讲' + (target ? '「**' + target.title + '**」' : '这个主题') + '。', {
      topicId: target ? target.id : null,
      actions: [
        { label: '打开创作工坊', icon: '✨', action: 'goto', payload: '/studio?tab=book' + (target ? '&topic=' + target.id : '') },
        { label: '低年级绘本馆', icon: '📖', action: 'goto', payload: '/book' }
      ]
    });
  }
  if (intent === 'anim' || intent === 'video') {
    const target = hinted || content.recommend(grade, ctx.progress, 1)[0];
    const kind = intent === 'anim' ? '🎬 原理动画' : '📺 视频讲解';
    return plain('好的！我用' + kind + '的方式来讲' + (target ? '「**' + target.title + '**」' : '这个主题') + '。', {
      topicId: target ? target.id : null,
      actions: [{ label: '打开创作工坊', icon: '✨', action: 'goto', payload: '/studio' + (target ? '?topic=' + target.id : '') }]
    });
  }
  if (intent === 'game') {
    return plain('边玩边学效果最好！练习中心有四个小游戏：知识闯关、数据标注师、神经网络训练、记忆配对。', {
      actions: [{ label: '去做练习', icon: '🎮', action: 'goto', payload: '/games' }]
    });
  }
  if (intent === 'code') {
    return plain('动手写代码是理解 AI 最快的方式。编程实践里有图形化积木、Python 迷你实验室，还有 AI 实践任务卡。', {
      actions: [{ label: '打开编程实践', icon: '⌨️', action: 'goto', payload: '/code' }]
    });
  }

  /* --- 表达「听不懂」：下调一个学段重讲 --- */
  if (nlu.wantsSimpler(intent, text)) {
    const target = hinted || (memory.lastTopicId ? content.getTopic(memory.lastTopicId) : null);
    if (!target) {
      return plain('那我们从头开始。你想先弄懂哪个词？比如「数据」「算法」「模型」。', {
        actions: quickActions(null, level.id)
      });
    }
    const order = ['junior', 'senior', 'middle', 'high'];
    const curIdx = order.indexOf(level.id);
    const lowerId = order[Math.max(0, curIdx - 1)];
    const lower = content.levelById(lowerId);
    resetLadder(memory, target.id);
    memory.lastTopicId = target.id;
    const pack = content.contentFor(target, lowerId);
    // 对最低学段再往下就换一种说法：只讲一句话 + 一个比喻
    const body = curIdx === 0
      ? [
        '好，那我用**最简单的一句话**说：',
        '',
        '**' + target.title + '** —— ' + target.objective.know + '。',
        '',
        '就像：' + (pack ? pack.content.example : target.objective.know),
        '',
        '🤔 你只要记住这一句就够了。要我再换个说法吗？'
      ].join('\n')
      : [
        '没问题，我们**换一种更简单的说法**（按' + lower.name + '的水平讲）：',
        '',
        composeExplanation(target, lowerId, 'analogy'),
        '',
        '👀 **一句话记住**：' + target.objective.know,
        '',
        '🤔 ' + ((pack && pack.content.ask) || '你觉得呢？')
      ].join('\n');
    return plain(body, {
      topicId: target.id, topicTitle: target.title, levelId: lowerId, step: 'analogy',
      actions: quickActions(target, lowerId)
    });
  }

  /* --- 追问上一话题但没有点名：延续上下文 --- */
  let topic = hinted;
  if (!topic) {
    // 只有当新问题与上一话题相关且明显是追问时才延续，避免答非所问
    const prevTopic = memory.lastTopicId ? content.getTopic(memory.lastTopicId) : null;
    if (prevTopic && nlu.isFollowUp(text) && nlu.topicRelevance(text, prevTopic) >= 0.4) topic = prevTopic;
  }
  if (!topic) {
    const recs = content.recommend(grade, ctx.progress, 2);
    if (intent === 'concept' || intent === 'define' || intent === 'why') {
      // 完全没命中：诚实说明并给方向，不编造
      const guess = content.search(text.slice(0, 8), 2);
      const alt = guess.length ? guess : recs;
      return plain([
        say('encourage', level.id, seed) + ' 这个问题我暂时没有把握给出可靠的答案——我不想编造内容误导你。',
        '',
        '**我们可以这样做**',
        '1. 换一种说法再问一次，比如加上「是什么」「为什么」「怎么做」。',
        '2. 从我熟悉的知识点里挑一个：' + alt.map(t => t.title).join('、') + '。',
        '3. 想看整体地图，就去「课程地图」；想动手就去「编程实践」。'
      ].join('\n'), {
        noAnswer: true,
        actions: alt.slice(0, 3).map(t => ({ label: t.title, icon: t.emoji, action: 'topic', payload: t.id }))
          .concat([{ label: '打开课程地图', icon: '🗺️', action: 'goto', payload: '/courses' }])
      });
    }
    topic = recs[0];
    if (!topic) return plain('我们换个话题吧，你想聊什么？', { actions: quickActions(null, level.id) });
  }

  /* --- 常规讲解 --- */
  memory.followUps = memory.lastTopicId === topic.id ? (memory.followUps || 0) + 1 : 0;
  memory.lastTopicId = topic.id;
  memory.lastIntent = intent;
  memory.recentTopics = memory.recentTopics || [];
  if (memory.recentTopics.indexOf(topic.id) < 0) memory.recentTopics.push(topic.id);

  let step;
  if (intent === 'example') step = 'example';
  else if (intent === 'how') step = 'steps';
  else if (intent === 'why' || intent === 'compare' || intent === 'ethics') step = level.depth >= 2 ? 'principle' : 'example';
  else if (intent === 'deeper') step = nextLadder(memory, topic.id);
  else if (intent === 'define' || intent === 'concept') step = memory.followUps === 0 ? 'analogy' : nextLadder(memory, topic.id);
  else step = memory.followUps === 0 ? 'analogy' : nextLadder(memory, topic.id);

  const parts = [];
  // 标题与学段标签
  parts.push('**' + topic.emoji + ' ' + topic.title + '**');
  if (intent === 'compare') {
    const rel = relatedTopics(topic, 1)[0];
    if (rel) parts.push('和「' + rel.emoji + ' ' + rel.title + '」放在一起对比着看，会更容易分清。');
  }
  parts.push(composeExplanation(topic, level.id, step));

  // 收尾：追问 + 知识连接
  const pack = content.contentFor(topic, level.id);
  const askText = (pack && pack.content.ask) || say('ask', level.id, seed);
  parts.push('🤔 **想一想**：' + askText);

  if (level.depth >= 3 && (intent === 'concept' || intent === 'define' || intent === 'deeper' || intent === 'why')) {
    const rels = relatedTopics(topic, 2);
    if (rels.length) {
      parts.push('🔗 **知识连接**：' + rels.map(r => r.title + '（' + r.objective.know + '）').join('；'));
    }
  }
  if (level.depth <= 2) {
    parts.push('🎬 想更直观？我可以放一段动画给你看，或者做一本绘本。');
  } else {
    parts.push('🔬 想验证一下？可以去「编程实践」跑一段代码，或者做一组练习。');
  }

  return plain(parts.join('\n\n'), {
    topicId: topic.id, topicTitle: topic.title, step,
    levelId: level.id,
    actions: quickActions(topic, level.id),
    related: relatedTopics(topic, 3).map(t => ({ id: t.id, title: t.title, emoji: t.emoji }))
  });
}

/* ---------------- 判题与反馈 ---------------- */
function judge(topicId, correct, levelId) {
  const lv = content.levelById(levelId || 'senior');
  const t = topicId ? content.getTopic(topicId) : null;
  const head = correct ? say('praise', lv.id) : '再想一想。';
  const tail = correct
    ? (lv.depth <= 2 ? '继续保持，我们再加一点难度！' : '可以试一道更难的题，检验能不能迁移。')
    : ('回到「' + (t ? t.title : '这个知识点') + '」的关键点：' + ((t && t.key && t.key[0]) || '先弄清最基本的概念'));
  return head + ' ' + tail;
}

/* ---------------- 给大模型的系统提示词 ---------------- */
/**
 * 构造系统提示词：注入学生画像、学段要求与本次检索到的知识片段
 * 这是「联网后仍然保持年龄自适应」的关键：模型被要求按学段风格讲解，并以检索片段为事实依据
 */
function systemPrompt(ctx) {
  ctx = ctx || {};
  const level = content.levelOfGrade(ctx.grade || 5);
  const limit = level.depth >= 3 ? 2400 : 1600;
  const pieces = [];
  if (ctx.topic) {
    const pack = content.contentFor(ctx.topic, level.id);
    if (pack) {
      const t = ctx.topic;
      pieces.push([
        '【知识点】' + t.title + '（' + t.domainName + '）',
        '【学习目标】' + t.objective.know + '；' + t.objective.do,
        '【面向' + level.name + '的讲解参考】',
        '情境导入：' + pack.content.hook,
        '讲解：' + pack.content.explain,
        '生活例子：' + pack.content.example,
        '思考问题：' + pack.content.ask,
        '动手活动：' + pack.content.activity,
        '【关键要点】' + (t.key || []).join('；'),
        '【术语】' + (t.terms || []).map(x => x.term + '＝' + x.plain).join('；'),
        '【常见误区】' + (t.misunderstand || []).map(x => '有人说「' + x.wrong + '」，其实' + x.right).join('；')
      ].join('\n'));
    }
  }
  if (ctx.related && ctx.related.length) {
    pieces.push('【相关知识点】' + ctx.related.map(t => t.title + '：' + t.objective.know).join('；'));
  }
  if (ctx.student) {
    const s = ctx.student;
    const done = s.progress ? Object.keys(s.progress).filter(k => s.progress[k].status === 'done') : [];
    pieces.push('【学生档案】姓名：' + (s.name || '未填写') + '；年级：' + (s.grade || 5) + ' 年级；已掌握知识点：' + (done.length ? done.join('、') : '暂无'));
  }
  const material = pieces.join('\n\n').slice(0, limit);

  return [
    '你是「AI 启明」，一名面向中国 K12 学生的人工智能通识课老师。',
    '【学生学段】' + level.name + '（' + level.age + '，' + level.depth + '/4 深度）',
    '【讲解风格】' + level.style + '；句子要求：' + level.sentence + '；用词要求：' + level.vocab + '；互动方式：' + level.activity,
    '【教学方法】先建立直觉（提问或比喻），再给生活例子，最后才引入术语；如果学生说听不懂，立刻降一个学段的表达难度重讲；每次回答结尾提一个能引发思考的问题。',
    '【回答长度】' + (level.depth <= 2 ? '150 字以内，句子短、多比喻' : (level.depth === 3 ? '200~350 字，讲清原理与用法' : '300~500 字，可以给形式化表述与边界条件')),
    '【事实依据】下面提供的知识片段是本课程的标准内容，请以它为准；片段没有覆盖的内容，如果你不确定，就明确说不确定，不要编造。',
    '【格式】使用 Markdown：小标题用加粗，列表用 - 或 1.，代码用三个反引号包裹。不要输出 HTML。',
    '',
    '===== 课程知识片段（仅供你参考，不要整段照抄）=====',
    material || '（本次没有检索到相关知识点，请用通用但严谨的方式回答，并在合适时建议学生到课程地图中查找。）'
  ].join('\n');
}

module.exports = {
  LADDER, PHRASES, RELATED,
  freshMemory, nextLadder, resetLadder,
  answer, judge, quickActions, relatedTopics,
  composeExplanation, systemPrompt, say
};
