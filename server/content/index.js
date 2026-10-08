/**
 * 课程内容 · 索引与查询
 * 汇总各领域知识点、统一题目结构、提供检索与推荐能力。
 */
'use strict';

const { DOMAINS, LEVELS, levelOfGrade, levelById, domainById } = require('./domains');
const introTopics = require('./topics-intro');
const dataTopics = require('./topics-data');
const algoTopics = require('./topics-algo');
const mlTopics = require('./topics-ml');
const restTopics = require('./topics-rest');

/** 全部知识点（按领域顺序排列，便于课程地图展示） */
const DOMAIN_ORDER = DOMAINS.map(d => d.id);
const ALL = [].concat(introTopics, dataTopics, algoTopics, mlTopics, restTopics)
  .map(t => {
    // 统一题目结构：补上 id、所属知识点与规范化难度
    t.quiz = (t.quiz || []).map((q, i) => ({
      id: t.id + '-q' + (i + 1),
      topicId: t.id,
      topicTitle: t.title,
      domain: t.domain,
      q: q.q,
      options: q.options.slice(),
      answer: q.answer,
      explain: q.explain,
      difficulty: q.difficulty || 2
    }));
    // 计算该知识点覆盖的年级范围（由学段推导，用于推荐）
    const bands = t.bands || ['senior'];
    const lvs = bands.map(levelById).filter(Boolean).sort((a, b) => a.depth - b.depth);
    t.gradeMin = lvs.length ? lvs[0].minGrade : 3;
    t.gradeMax = lvs.length ? lvs[lvs.length - 1].maxGrade : 6;
    t.domainName = (domainById(t.domain) || {}).name || t.domain;
    return t;
  })
  .sort((a, b) => DOMAIN_ORDER.indexOf(a.domain) - DOMAIN_ORDER.indexOf(b.domain) || a.gradeMin - b.gradeMin);

const BY_ID = new Map(ALL.map(t => [t.id, t]));
const ALL_QUESTIONS = ALL.reduce((acc, t) => acc.concat(t.quiz), []);

/** 取知识点 */
function getTopic(id) {
  return BY_ID.get(id) || null;
}

/** 取知识点在指定学段的教学内容；学段缺少时回退到最接近的更低学段 */
function contentFor(topicOrId, levelId) {
  const t = typeof topicOrId === 'string' ? getTopic(topicOrId) : topicOrId;
  if (!t) return null;
  const want = LEVELS.find(l => l.id === levelId) || LEVELS[1];
  if (t.byLevel[want.id]) return { levelId: want.id, level: want, content: t.byLevel[want.id], fallback: false };
  // 依次尝试更低学段，再尝试更高学段
  const lower = LEVELS.filter(l => l.depth < want.depth).sort((a, b) => b.depth - a.depth);
  for (const l of lower) if (t.byLevel[l.id]) return { levelId: l.id, level: l, content: t.byLevel[l.id], fallback: true };
  const higher = LEVELS.filter(l => l.depth > want.depth).sort((a, b) => a.depth - b.depth);
  for (const l of higher) if (t.byLevel[l.id]) return { levelId: l.id, level: l, content: t.byLevel[l.id], fallback: true };
  return null;
}

/** 按条件列出知识点 */
function listTopics(filter) {
  filter = filter || {};
  return ALL.filter(t => {
    if (filter.domain && filter.domain !== 'all' && t.domain !== filter.domain) return false;
    if (filter.grade && (t.gradeMin > filter.grade || t.gradeMax < filter.grade)) return false;
    if (filter.band && (t.bands || []).indexOf(filter.band) < 0) return false;
    return true;
  });
}

/**
 * 同义表达表：学生提问常用口语与知识点标题不一致，用这张表做「语义跳转」
 * 命中即给该知识点强加分，保证「神经网络」「换脸」「AI 会不会抢工作」这类问法能定位到正确的知识点
 */
const SYNONYMS = [
  { re: /(神经网络|深度学习|神经元|卷积|特征图|图像识别|识图|看图)/, id: 'vision-image' },
  { re: /(目标检测|图像分割|框出|圈出|识别位置|IoU|交并比)/i, id: 'vision-tasks' },
  { re: /(大模型|大语言模型|生成式|AIGC|聊天机器人|写作文|写代码|幻觉|胡说|编造)/i, id: 'gen-llm' },
  { re: /(提示词|怎么问|提问技巧|提示工程)/i, id: 'gen-prompt' },
  { re: /(机器学习|训练模型|怎么学会|损失|梯度下降|学习率)/, id: 'ml-what' },
  { re: /(分类|回归|监督学习|准确率|精确率|召回率|测试集|验证集)/, id: 'ml-supervised' },
  { re: /(聚类|无监督|分堆|自动分组|K-?means)/i, id: 'ml-cluster' },
  { re: /(过拟合|欠拟合|泛化|早停|正则)/, id: 'ml-eval' },
  { re: /(视觉|图像|照片|像素|摄像头|人脸识别)/, id: 'vision-image' },
  { re: /(自然语言|分词|机器翻译|语音识别|听说|听懂|词向量|NLP)/i, id: 'lang-nlp' },
  { re: /(偏见|歧视|不公平|公平|招聘模型)/, id: 'ethics-fair' },
  { re: /(深度伪造|换脸|假视频|假语音|造谣|学术诚信|抄作业|AI 代写)/, id: 'ethics-safe' },
  { re: /(隐私|个人信息|密码|验证码|泄露|授权|定位)/, id: 'data-privacy' },
  { re: /(数据是什么|特征|标签|样本|数据集)/, id: 'data-what' },
  { re: /(清洗|脏数据|缺失|重复|整理数据|问卷)/, id: 'data-clean' },
  { re: /(算法思维|流程图|伪代码|步骤|拆解)/, id: 'algo-think' },
  { re: /(循环|条件判断|顺序执行|三种结构|for|while|if)/i, id: 'algo-flow' },
  { re: /(函数|模块化|复用|参数|返回值)/, id: 'algo-func' },
  { re: /(调试|报错|bug|找错|程序出错|运行错误)/i, id: 'algo-debug' },
  { re: /(职业|工作|就业|失业|被取代|未来|专业选择)/, id: 'future-career' },
  { re: /(项目|做个东西|实践|作品|比赛|怎么做一个)/, id: 'future-project' },
  { re: /(AI 是什么|人工智能是什么|什么是人工智能)/i, id: 'ai-what' },
  { re: /(身边的|应用|智能音箱|扫地机器人|推荐|导航|刷脸|智能家居)/, id: 'ai-life' },
  { re: /(和人的不同|会不会取代人|AI 有感情|人和机器|谁更聪明)/, id: 'ai-human' }
];

/** 检索：同义词跳转 > 标题 > 术语 > 摘要与要点 > 题目，使用二字组覆盖率与特异度校正 */
function search(query, limit) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const bigrams = s => {
    const out = [];
    for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    return out;
  };
  const qb = bigrams(q);
  const denom = Math.max(1, qb.length);
  const scored = ALL.map(t => {
    const title = t.title.toLowerCase();
    const summary = (t.summary || t.objective.know || '').toLowerCase();
    const terms = (t.terms || []).map(x => (x.term + x.plain).toLowerCase()).join(' ');
    const keys = (t.key || []).join(' ').toLowerCase();
    const quizText = t.quiz.map(x => x.q).join(' ').toLowerCase();
    let score = 0;
    if (title.indexOf(q) >= 0) score += 40;
    else if (q.indexOf(title) >= 0 && title.length >= 3) score += 36;
    // 同义表达直接给强加分，让口语化提问也能命中正确知识点
    SYNONYMS.forEach(s => {
      if (s.id === t.id && s.re.test(q)) score += 34;
      else if (s.re.test(q) && s.id !== t.id) score -= 0.5;  // 轻微抑制误命中
    });
    (t.terms || []).forEach(x => {
      const term = String(x.term).toLowerCase();
      if (term.length >= 2 && q.indexOf(term) >= 0) score += 12 + 3 * Math.min(term.length, 5);
    });
    let nT = 0, nK = 0, nS = 0, nQ = 0;
    qb.forEach(b => {
      if (title.indexOf(b) >= 0) nT++;
      if (terms.indexOf(b) >= 0 || keys.indexOf(b) >= 0) nK++;
      if (summary.indexOf(b) >= 0) nS++;
      if (quizText.indexOf(b) >= 0) nQ++;
    });
    score += (nT / denom) * 18 + (nK / denom) * 12 + (nS / denom) * 6 + (nQ / denom) * 3;
    // 特异度校正：命中词相对标题越长，说明匹配越精准
    if (score > 0) {
      const cands = [];
      (t.terms || []).forEach(x => { const term = String(x.term).toLowerCase(); if (q.indexOf(term) >= 0) cands.push(term); });
      if (title.length >= 2 && q.indexOf(title) >= 0) cands.push(title);
      if (cands.length) {
        const best = Math.max.apply(null, cands.map(x => x.length));
        score *= 0.55 + 0.75 * Math.min(1.2, best / Math.max(3, t.title.length));
      }
    }
    return { topic: t, score };
  });
  // 短问题要求更高的匹配下限，避免靠单个二字组蹭上无关知识点
  const floor = q.length <= 8 ? 9 : 3;
  return scored.filter(x => x.score >= floor).sort((a, b) => b.score - a.score)
    .slice(0, limit || 6).map(x => x.topic);
}

/**
 * 为一个学生推荐下一个知识点
 * 打分考虑：年级匹配、是否学过、掌握度、领域均衡、先修顺序
 */
function recommend(grade, progress, limit) {
  const lv = levelOfGrade(grade);
  const prog = progress || {};
  const domainCount = {};
  const scored = ALL.filter(t => t.bands.indexOf(lv.id) >= 0).map(t => {
    const p = prog[t.id];
    let score = 100;
    if (!p) score += 10;                                  // 未学过优先
    else if (p.status === 'learning') score += 25;         // 学了一半更该继续
    else if (p.status === 'done') score -= 55;             // 已掌握往后排
    score -= Math.abs(t.gradeMin - grade) * 1.2;           // 与当前年级更贴近的优先
    if (p && p.wrong > 0 && p.correct < 2) score += 15;    // 做过但错得多的，需要回头
    if (p) domainCount[t.domain] = (domainCount[t.domain] || 0) + 1;
    return { topic: t, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit || 4).map(x => x.topic);
}

/** 按知识点抽题；打乱选项并同步答案下标 */
function pickQuestions(topicId, opt) {
  opt = opt || {};
  const t = getTopic(topicId);
  if (!t) return [];
  let pool = t.quiz.slice();
  if (opt.difficulty) pool = pool.filter(q => q.difficulty <= opt.difficulty);
  if (!pool.length) pool = t.quiz.slice();
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, opt.count || 3);
  if (opt.shuffleOptions === false) return picked;
  return picked.map(q => {
    const correct = q.options[q.answer];
    const options = q.options.slice().sort(() => Math.random() - 0.5);
    return Object.assign({}, q, { options, answer: options.indexOf(correct) });
  });
}

/** 跨知识点抽题（按难度与领域筛选） */
function pickQuestionsMulti(filter) {
  filter = filter || {};
  let pool = ALL_QUESTIONS.slice();
  if (filter.domain && filter.domain !== 'all') pool = pool.filter(q => q.domain === filter.domain);
  if (filter.levelId) {
    const allowed = ALL.filter(t => t.bands.indexOf(filter.levelId) >= 0).map(t => t.id);
    pool = pool.filter(q => allowed.indexOf(q.topicId) >= 0);
  }
  if (filter.difficulty) pool = pool.filter(q => q.difficulty <= filter.difficulty);
  const shuffled = pool.slice().sort(() => Math.random() - 0.5).slice(0, filter.count || 5);
  return shuffled.map(q => {
    const correct = q.options[q.answer];
    const options = q.options.slice().sort(() => Math.random() - 0.5);
    return Object.assign({}, q, { options, answer: options.indexOf(correct) });
  });
}

/** 课程统计 */
function stats() {
  const byDomain = {};
  DOMAINS.forEach(d => { byDomain[d.id] = { id: d.id, name: d.name, emoji: d.emoji, color: d.color, topics: 0, questions: 0 }; });
  ALL.forEach(t => {
    byDomain[t.domain].topics++;
    byDomain[t.domain].questions += t.quiz.length;
  });
  return {
    domains: DOMAINS.length,
    topics: ALL.length,
    questions: ALL_QUESTIONS.length,
    byDomain: Object.keys(byDomain).map(k => byDomain[k]),
    levelCoverage: LEVELS.map(l => ({
      id: l.id, name: l.name, short: l.short,
      topics: ALL.filter(t => t.bands.indexOf(l.id) >= 0).length
    }))
  };
}

/** 内容自检：供测试与启动时校验 */
function validate() {
  const errors = [];
  const ids = new Set();
  ALL.forEach(t => {
    if (ids.has(t.id)) errors.push('知识点 id 重复：' + t.id);
    ids.add(t.id);
    if (!domainById(t.domain)) errors.push(t.id + ' 的领域不存在：' + t.domain);
    if (!t.byLevel || !Object.keys(t.byLevel).length) errors.push(t.id + ' 缺少学段内容');
    Object.keys(t.byLevel).forEach(k => {
      if (!levelById(k)) errors.push(t.id + ' 的学段 id 无效：' + k);
      const c = t.byLevel[k];
      ['hook', 'explain', 'example', 'ask', 'activity'].forEach(f => {
        if (!c[f]) errors.push(t.id + '.' + k + ' 缺少字段 ' + f);
      });
    });
    (t.bands || []).forEach(b => { if (!levelById(b)) errors.push(t.id + ' 的 bands 含无效学段：' + b); });
    if (!t.quiz.length) errors.push(t.id + ' 没有题目');
    t.quiz.forEach(q => {
      if (!Array.isArray(q.options) || q.options.length < 2) errors.push(q.id + ' 选项不足');
      if (!(q.answer >= 0 && q.answer < q.options.length)) errors.push(q.id + ' 答案下标越界');
      if (!q.explain) errors.push(q.id + ' 缺少解析');
    });
  });
  return { ok: errors.length === 0, errors, topics: ALL.length, questions: ALL_QUESTIONS.length };
}

module.exports = {
  DOMAINS, LEVELS, levelOfGrade, levelById, domainById,
  ALL, BY_ID, ALL_QUESTIONS,
  getTopic, contentFor, listTopics, search, recommend,
  pickQuestions, pickQuestionsMulti, stats, validate
};
