/**
 * 练习中心 · 游戏数据
 * 为前端小游戏提供结构化数据：标注样本、神经网络任务、配对词条。
 * 题目类数据统一走 /api/quiz，这里只补充游戏特有的素材。
 */
'use strict';

const content = require('../content');

/* ---------------- 数据标注师：水果/垃圾两套数据集 ---------------- */
const DATASETS = {
  fruit: {
    name: '水果分拣',
    question: '把这些水果分成两类：苹果 / 香蕉',
    labels: ['苹果', '香蕉'],
    samples: [
      { id: 'f1', name: '红苹果', emoji: '🍎', features: ['圆圆的', '红色', '长在树上'], label: 0 },
      { id: 'f2', name: '黄香蕉', emoji: '🍌', features: ['弯弯的', '黄色', '需要剥皮'], label: 1 },
      { id: 'f3', name: '青苹果', emoji: '🍏', features: ['圆圆的', '绿色', '长在树上'], label: 0 },
      { id: 'f4', name: '一串香蕉', emoji: '🍌', features: ['弯弯的', '黄色', '一串一串'], label: 1 },
      { id: 'f5', name: '带柄苹果', emoji: '🍎', features: ['圆圆的', '红色', '有果柄'], label: 0 },
      { id: 'f6', name: '熟香蕉', emoji: '🍌', features: ['弯弯的', '黄色', '软软的'], label: 1 },
      { id: 'f7', name: '脆苹果', emoji: '🍏', features: ['圆圆的', '绿色', '脆脆的'], label: 0 },
      { id: 'f8', name: '热带香蕉', emoji: '🍌', features: ['弯弯的', '黄色', '热带水果'], label: 1 }
    ],
    test: [
      { id: 't1', name: '洗净的苹果', emoji: '🍎', features: ['圆圆的', '红色', '洗干净吃'], label: 0 },
      { id: 't2', name: '早餐香蕉', emoji: '🍌', features: ['弯弯的', '黄色', '早餐常见'], label: 1 },
      { id: 't3', name: '酸苹果', emoji: '🍏', features: ['圆圆的', '绿色', '有点酸'], label: 0 }
    ],
    note: '标注得准，模型才准。试试故意标错几个，看看模型会怎样。'
  },
  trash: {
    name: '垃圾分类',
    question: '把这些垃圾分成两类：可回收 / 厨余',
    labels: ['可回收', '厨余'],
    samples: [
      { id: 'r1', name: '易拉罐', emoji: '🥫', features: ['金属', '洗干净', '能再加工'], label: 0 },
      { id: 'r2', name: '苹果核', emoji: '🍎', features: ['吃剩的', '会腐烂', '果核'], label: 1 },
      { id: 'r3', name: '旧报纸', emoji: '📰', features: ['纸类', '可回收', '干燥'], label: 0 },
      { id: 'r4', name: '菜叶', emoji: '🥬', features: ['菜叶', '会腐烂', '厨房产生'], label: 1 },
      { id: 'r5', name: '玻璃瓶', emoji: '🍶', features: ['玻璃', '可回收', '洗净'], label: 0 },
      { id: 'r6', name: '香蕉皮', emoji: '🍌', features: ['果皮', '会腐烂', '厨房产生'], label: 1 },
      { id: 'r7', name: '纸箱', emoji: '📦', features: ['纸箱', '可回收', '压平'], label: 0 },
      { id: 'r8', name: '剩饭', emoji: '🍚', features: ['剩饭', '会腐烂', '厨房产生'], label: 1 }
    ],
    test: [
      { id: 's1', name: '饮料杯', emoji: '🥤', features: ['塑料', '可回收', '洗净'], label: 0 },
      { id: 's2', name: '过期面包', emoji: '🍞', features: ['过期', '会腐烂', '厨房产生'], label: 1 },
      { id: 's3', name: '空塑料瓶', emoji: '🧴', features: ['塑料瓶', '可回收', '空的'], label: 0 }
    ],
    note: '分类标准来自生活常识——这也说明模型学到的其实是人给出的标准。'
  }
};

/* ---------------- 神经网络训练：任务卡 ---------------- */
const NN_TASKS = [
  { id: 'AND', name: '逻辑与（AND）', desc: '两个条件都满足才输出 1。', points: [[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]] },
  { id: 'OR', name: '逻辑或（OR）', desc: '任一条件满足即输出 1。', points: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 1]] },
  { id: 'NAND', name: '逻辑与非（NAND）', desc: '两个都满足时反而输出 0。', points: [[0, 0, 1], [0, 1, 1], [1, 0, 1], [1, 1, 0]] }
];

/* ---------------- 术语配对：从知识点抽词条 ---------------- */
function matchPairs(grade, count) {
  const lv = content.levelOfGrade(grade);
  const pool = [];
  content.ALL.filter(t => (t.bands || []).indexOf(lv.id) >= 0).forEach(t => {
    (t.terms || []).forEach(x => pool.push({
      term: x.term, plain: x.plain, example: x.example, topicId: t.id, topicTitle: t.title
    }));
  });
  pool.sort(() => Math.random() - 0.5);
  const n = count || (lv.depth <= 1 ? 4 : lv.depth === 2 ? 5 : 6);
  return pool.slice(0, Math.min(n, pool.length));
}

/* ---------------- 汇总接口 ---------------- */
function data(kind, grade) {
  if (kind === 'label') {
    const key = (Number(grade) || 5) <= 4 ? 'fruit' : (Math.random() < 0.5 ? 'fruit' : 'trash');
    const d = DATASETS[key];
    return { kind: 'label', id: key, name: d.name, question: d.question, labels: d.labels, samples: d.samples, test: d.test, note: d.note };
  }
  if (kind === 'net') {
    return { kind: 'net', tasks: NN_TASKS, activation: 'sigmoid' };
  }
  if (kind === 'match') {
    const pairs = matchPairs(grade);
    const cards = [];
    pairs.forEach((p, i) => {
      cards.push({ id: 'term' + i, kind: 'term', text: p.term, pair: i });
      cards.push({ id: 'plain' + i, kind: 'plain', text: p.plain, pair: i });
    });
    cards.sort(() => Math.random() - 0.5);
    return { kind: 'match', pairs: pairs.length, cards, target: pairs.length * 2 };
  }
  return { kind: 'unknown' };
}

module.exports = { DATASETS, NN_TASKS, matchPairs, data };
