/**
 * 课程内容 · 领域与学段定义
 * 依据《义务教育信息科技课程标准（2022 年版）》与《普通高中信息技术课程标准（2017 年版 2020 年修订）》
 * 中「人工智能」相关模块的知识范畴，按 K12 学段重新组织为 9 个领域。
 */
'use strict';

/** 9 个内容领域（课程地图的一级分类） */
const DOMAINS = [
  { id: 'intro',   name: '人工智能入门',   emoji: '🌱', color: '#2f8f6b', note: 'AI 是什么、能做什么、和我们有什么不同' },
  { id: 'data',    name: '数据与信息',     emoji: '📊', color: '#2b7fb8', note: '数据从哪来、怎么整理、如何保护' },
  { id: 'algo',    name: '算法与编程',     emoji: '🧩', color: '#c98a1b', note: '把问题拆成步骤，用程序让机器执行' },
  { id: 'ml',      name: '机器学习',       emoji: '🧠', color: '#7c5cd6', note: '机器如何从数据中学到规律' },
  { id: 'vision',  name: '计算机视觉',     emoji: '👁️', color: '#c2566f', note: '让机器看懂图像与视频' },
  { id: 'lang',    name: '语言与语音',     emoji: '💬', color: '#2b8fa8', note: '让机器听懂人话、开口说话' },
  { id: 'gen',     name: '生成式人工智能', emoji: '✨', color: '#a4552f', note: '大模型如何写作、绘画、写代码' },
  { id: 'ethics',  name: '人工智能伦理与安全', emoji: '⚖️', color: '#5b7a3a', note: '公平、隐私、责任与人的主体性' },
  { id: 'future',  name: 'AI 与未来',      emoji: '🚀', color: '#8a6d3b', note: '职业变化、项目实践与终身学习' }
];

/**
 * 四个学段：决定讲解深度、语言风格、活动形式与题目难度
 * depth 1~4 越小越基础；minGrade/maxGrade 决定该学段覆盖的年级
 */
const LEVELS = [
  {
    id: 'junior', name: '小学低年级', short: '低年级', minGrade: 1, maxGrade: 2, depth: 1,
    age: '6-8 岁', emoji: '🧸',
    style: '讲故事、打比方、一句话说清',
    sentence: '短句，一句话不超过 15 字',
    vocab: '只用生活常见词，术语必须先用比喻解释',
    activity: '看图、动手、跟读、找一找',
    quizCount: 3
  },
  {
    id: 'senior', name: '小学高年级', short: '小学', minGrade: 3, maxGrade: 6, depth: 2,
    age: '8-12 岁', emoji: '🎒',
    style: '从生活现象出发，先说猜想再做验证',
    sentence: '中等长度，一段讲清一个概念',
    vocab: '可用「数据、算法、模型」等基础术语，出现时当场解释',
    activity: '小组讨论、记录观察、用自然语言描述规则',
    quizCount: 4
  },
  {
    id: 'middle', name: '初中', short: '初中', minGrade: 7, maxGrade: 9, depth: 3,
    age: '12-15 岁', emoji: '🔬',
    style: '讲清「为什么」和「怎么调」，重视实验对比',
    sentence: '完整段落，可引入变量、参数、坐标系',
    vocab: '使用规范术语，如训练、推理、特征、评估指标',
    activity: '参数实验、错误分析、数据对比',
    quizCount: 4
  },
  {
    id: 'high', name: '高中', short: '高中', minGrade: 10, maxGrade: 12, depth: 4,
    age: '15-18 岁', emoji: '🎓',
    style: '系统化、数据驱动，兼顾技术原理与社会影响',
    sentence: '学术化表达，可用公式、复杂度与形式化描述',
    vocab: '梯度、损失函数、向量、概率分布、算力、对齐',
    activity: '项目式学习、实验设计、伦理研讨与方案论证',
    quizCount: 4
  }
];

/** 按年级取学段 */
function levelOfGrade(grade) {
  const g = Number(grade) || 5;
  for (const lv of LEVELS) if (g >= lv.minGrade && g <= lv.maxGrade) return lv;
  return LEVELS[1];
}

/** 按 id 取学段 */
function levelById(id) {
  return LEVELS.find(l => l.id === id) || LEVELS[1];
}

/** 按 id 取领域 */
function domainById(id) {
  return DOMAINS.find(d => d.id === id) || null;
}

module.exports = { DOMAINS, LEVELS, levelOfGrade, levelById, domainById };
