/**
 * 多模态内容 · AI 绘本
 * 五个主题，每个主题四页；每页文字按学段准备三档（低年级 / 小学高年级 / 初中以上），
 * 插图由绘图指令在服务端渲染成 SVG 字符串后随 API 返回。
 */
'use strict';

const content = require('../content');

/* ---------------- 绘图指令 → SVG ---------------- */
function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function toSvg(cmds, w, h) {
  const parts = [];
  (cmds || []).forEach(c => {
    const t = c[0];
    const o = c[c.length - 1] && typeof c[c.length - 1] === 'object' && !Array.isArray(c[c.length - 1]) ? c[c.length - 1] : {};
    if (t === 'rect') parts.push('<rect x="' + c[1] + '" y="' + c[2] + '" width="' + c[3] + '" height="' + c[4] +
      '" rx="' + (o.rx === undefined ? 8 : o.rx) + '" fill="' + (o.fill || 'none') + '"' +
      (o.stroke ? ' stroke="' + o.stroke + '" stroke-width="' + (o.width || 1.5) + '"' : '') +
      (o.opacity !== undefined ? ' opacity="' + o.opacity + '"' : '') + '/>');
    else if (t === 'circle') parts.push('<circle cx="' + c[1] + '" cy="' + c[2] + '" r="' + c[3] + '" fill="' + (o.fill || 'none') + '"' +
      (o.stroke ? ' stroke="' + o.stroke + '" stroke-width="' + (o.width || 1.5) + '"' : '') +
      (o.opacity !== undefined ? ' opacity="' + o.opacity + '"' : '') + '/>');
    else if (t === 'line') parts.push('<line x1="' + c[1] + '" y1="' + c[2] + '" x2="' + c[3] + '" y2="' + c[4] + '" stroke="' + (o.stroke || '#333') +
      '" stroke-width="' + (o.width || 1.5) + '"' + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + '/>');
    else if (t === 'path') parts.push('<path d="' + c[1] + '" fill="' + (o.fill || 'none') + '" stroke="' + (o.stroke || 'none') +
      '" stroke-width="' + (o.width || 2) + '"' + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + '/>');
    else if (t === 'poly') parts.push('<polygon points="' + c[1].map(p => p[0] + ',' + p[1]).join(' ') + '" fill="' + (o.fill || 'none') +
      '" stroke="' + (o.stroke || 'none') + '" stroke-width="' + (o.width || 1.5) + '"/>');
    else if (t === 'text') parts.push('<text x="' + c[1] + '" y="' + c[2] + '" font-size="' + (o.size || 13) + '" fill="' + (o.fill || '#243044') + '"' +
      (o.anchor ? ' text-anchor="' + o.anchor + '"' : '') + (o.weight ? ' font-weight="' + o.weight + '"' : '') +
      ' font-family="inherit">' + esc(c[3]) + '</text>');
  });
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" role="img">' +
    '<rect width="' + w + '" height="' + h + '" fill="#fdfbf6"/>' + parts.join('') + '</svg>';
}

/* 复用动画模块里的绘图助手风格 */
const rect = (x, y, w, h, o) => ['rect', x, y, w, h, o || {}];
const circle = (cx, cy, r, o) => ['circle', cx, cy, r, o || {}];
const text = (x, y, s, o) => ['text', x, y, String(s), o || {}];
const path = (d, o) => ['path', d, o || {}];
const line = (x1, y1, x2, y2, o) => ['line', x1, y1, x2, y2, o || {}];

const W = 480, H = 300;
const C = { ink: '#243044', muted: '#8494a6', green: '#1f6f5c', blue: '#2b7fb8', amber: '#c98a1b', rose: '#c2566f', violet: '#7c5cd6' };

/* ---------------- 插画 ---------------- */
const ART = {
  catMeet: () => [
    rect(34, 44, 180, 168, { rx: 18, fill: 'rgba(43,127,184,.08)', stroke: C.blue }),
    text(96, 156, '🐱', { size: 76 }),
    text(66, 240, '这是猫', { size: 15, fill: C.blue, weight: 'bold' }),
    rect(266, 44, 180, 168, { rx: 18, fill: 'rgba(212,99,127,.08)', stroke: '#d4637f' }),
    text(328, 156, '🐶', { size: 76 }),
    text(298, 240, '这是狗', { size: 15, fill: '#d4637f', weight: 'bold' }),
    text(240, 140, '＋', { size: 30, fill: C.amber, anchor: 'middle' }),
    text(240, 278, '一张图 + 一个名字 = 一条训练数据', { size: 12.5, fill: C.muted, anchor: 'middle' })
  ],
  catMany: () => {
    const cmds = [rect(24, 30, 432, 200, { rx: 16, fill: 'rgba(36,48,68,.04)', stroke: 'rgba(36,48,68,.12)' })];
    for (let i = 0; i < 24; i++) {
      const gx = 42 + (i % 8) * 52, gy = 48 + Math.floor(i / 8) * 62;
      cmds.push(rect(gx, gy, 46, 52, { rx: 10, fill: 'rgba(43,127,184,.08)', stroke: 'rgba(43,127,184,.25)' }));
      cmds.push(text(gx + 12, gy + 38, i % 2 ? '🐱' : '🐶', { size: 26 }));
    }
    cmds.push(text(240, 262, '看得越多，它认得的越准', { size: 14, fill: C.amber, anchor: 'middle', weight: 'bold' }));
    return cmds;
  },
  catAsk: () => [
    rect(150, 34, 180, 140, { rx: 16, fill: 'rgba(124,92,214,.08)', stroke: C.violet }),
    text(204, 132, '🐱', { size: 62 }),
    text(240, 200, '?', { size: 34, fill: C.amber, anchor: 'middle' }),
    rect(110, 214, 260, 48, { rx: 12, fill: 'rgba(31,111,92,.10)', stroke: C.green }),
    text(140, 245, '机器说：这是猫！92%', { size: 14, fill: C.green }),
    text(240, 288, '它没见过这张新照片，但它学会了判断', { size: 12, fill: C.muted, anchor: 'middle' })
  ],
  catFix: () => [
    text(64, 130, '😿', { size: 58 }),
    rect(140, 56, 310, 48, { rx: 12, fill: 'rgba(194,86,111,.10)', stroke: C.rose }),
    text(156, 86, '认错了：把夜里的猫看成了狗', { size: 13, fill: C.rose }),
    text(156, 142, '因为它只见过白天的照片', { size: 13, fill: C.amber }),
    rect(140, 168, 310, 92, { rx: 12, fill: 'rgba(43,127,184,.08)', stroke: C.blue }),
    text(156, 198, '补救办法：', { size: 12.5, fill: C.blue, weight: 'bold' }),
    text(156, 224, '① 补充夜间的照片', { size: 12.5, fill: C.ink }),
    text(156, 248, '② 检查标签、重新训练', { size: 12.5, fill: C.ink })
  ],
  trashMix: () => [
    text(58, 140, '🍎', { size: 56 }), text(158, 140, '🥫', { size: 56 }),
    text(258, 140, '📰', { size: 56 }), text(358, 140, '🥬', { size: 56 }),
    text(240, 194, '混在一起的垃圾', { size: 14, fill: C.ink, anchor: 'middle' }),
    text(240, 224, '要分成几类才合理？', { size: 13, fill: C.amber, anchor: 'middle' }),
    text(240, 258, '先想清楚"输出是什么"，这就是问题定义', { size: 12, fill: C.muted, anchor: 'middle' })
  ],
  trashBins: () => {
    const bins = [
      { x: 30, fill: 'rgba(31,111,92,.14)', name: '可回收', items: '🥫 📰 🍶', color: C.green },
      { x: 182, fill: 'rgba(201,138,27,.14)', name: '厨余', items: '🍎 🥬 🍌', color: C.amber },
      { x: 334, fill: 'rgba(212,99,127,.14)', name: '其他', items: '🧻 🪥 🧦', color: '#d4637f' }
    ];
    const cmds = [];
    bins.forEach(b => {
      cmds.push(rect(b.x, 40, 116, 158, { rx: 14, fill: b.fill, stroke: 'rgba(36,48,68,.18)' }));
      cmds.push(text(b.x + 58, 74, b.name, { size: 14, fill: b.color, anchor: 'middle', weight: 'bold' }));
      cmds.push(text(b.x + 16, 140, b.items, { size: 26 }));
    });
    cmds.push(text(240, 234, '给每张照片贴上正确标签，就是"数据标注"', { size: 12.5, fill: C.amber, anchor: 'middle' }));
    cmds.push(text(240, 262, '标注错了，模型就会学错', { size: 12, fill: C.muted, anchor: 'middle' }));
    return cmds;
  },
  trashModel: () => [
    rect(50, 40, 150, 150, { rx: 16, fill: 'rgba(43,127,184,.08)', stroke: C.blue }),
    text(100, 128, '🤖', { size: 60 }),
    text(66, 218, '训练好的模型', { size: 12.5, fill: C.blue }),
    path('M214 120 H286', { stroke: C.amber, width: 3 }),
    rect(292, 60, 150, 116, { rx: 16, fill: 'rgba(31,111,92,.10)', stroke: C.green }),
    text(332, 122, '🧦', { size: 46 }),
    text(304, 168, '→ 其他垃圾', { size: 12.5, fill: C.green }),
    text(240, 252, '训练完就可以用来判断新垃圾了', { size: 13, fill: C.amber, anchor: 'middle' })
  ],
  trashCheck: () => [
    rect(30, 40, 200, 140, { rx: 14, fill: 'rgba(31,111,92,.08)', stroke: C.green }),
    text(50, 76, '做得好的地方', { size: 13.5, fill: C.green, weight: 'bold' }),
    text(50, 108, '· 三类都有照片', { size: 12.5, fill: C.ink }),
    text(50, 132, '· 光线、角度多样', { size: 12.5, fill: C.ink }),
    text(50, 156, '· 标签由两人核对', { size: 12.5, fill: C.ink }),
    rect(250, 40, 200, 140, { rx: 14, fill: 'rgba(194,86,111,.08)', stroke: C.rose }),
    text(270, 76, '要改进的地方', { size: 13.5, fill: C.rose, weight: 'bold' }),
    text(270, 108, '· 电池照片只有 3 张', { size: 12.5, fill: C.ink }),
    text(270, 132, '· 全是室内拍摄', { size: 12.5, fill: C.ink }),
    text(270, 156, '· 有 8 张标签标错', { size: 12.5, fill: C.ink }),
    text(240, 226, '数据质量清单，是 AI 项目的第一步检查', { size: 12.5, fill: C.amber, anchor: 'middle' }),
    text(240, 256, '记住：垃圾进，垃圾出', { size: 12, fill: C.muted, anchor: 'middle' })
  ],
  gradStart: () => [
    path('M36 60 Q240 268 444 74', { stroke: C.violet, width: 3 }),
    circle(66, 84, 13, { fill: C.amber }),
    text(102, 78, '一开始，它随便猜了一个答案', { size: 13.5, fill: C.amber }),
    text(40, 268, '错得有多离谱？用"损失"来衡量', { size: 12.5, fill: C.muted })
  ],
  gradSteps: () => {
    const cmds = [path('M36 60 Q240 268 444 74', { stroke: C.violet, width: 3 })];
    [66, 126, 186, 232].forEach((x, i) => {
      const y = 60 + (1 - Math.pow(Math.abs(x - 240) / 204, 1.7)) * 190;
      cmds.push(circle(x, y, 10 - i, { fill: C.amber, opacity: 0.4 + i * 0.18 }));
    });
    cmds.push(text(250, 258, '每次往下挪一小步，错误就少一点', { size: 13, fill: C.amber }));
    cmds.push(text(40, 42, '山的高度 = 错误的大小', { size: 12, fill: C.muted }));
    return cmds;
  },
  gradBottom: () => [
    path('M36 60 Q240 268 444 74', { stroke: C.violet, width: 3 }),
    circle(238, 256, 14, { fill: C.green }),
    path('M264 242 l32 -16', { stroke: C.green, width: 3 }),
    text(304, 232, '最低点 = 错误最小', { size: 13.5, fill: C.green }),
    text(40, 52, '重复很多次以后……', { size: 13, fill: C.amber }),
    text(40, 288, '这就是"梯度下降"：一直往错误更小的方向走', { size: 12.5, fill: C.muted })
  ],
  gradRate: () => [
    rect(30, 40, 420, 96, { rx: 14, fill: 'rgba(43,127,184,.08)', stroke: C.blue }),
    text(50, 76, '生活中的梯度下降', { size: 14, fill: C.blue, weight: 'bold' }),
    text(50, 108, '蒙眼下山：用脚试探哪边更低，就往那边迈一小步。', { size: 12.5, fill: C.ink }),
    text(50, 132, '步子太大 → 跨过山谷；步子太小 → 半天下不去。', { size: 12.5, fill: C.ink }),
    rect(30, 156, 420, 96, { rx: 14, fill: 'rgba(201,138,27,.10)', stroke: C.amber }),
    text(50, 192, '学习率 = 步子的大小', { size: 13.5, fill: C.amber, weight: 'bold' }),
    text(50, 224, '太大：来回震荡甚至发散；太小：训练慢得像蜗牛。', { size: 12.5, fill: C.ink })
  ],
  nnOne: () => [
    circle(110, 150, 36, { fill: 'rgba(43,127,184,.14)', stroke: C.blue, width: 2 }),
    text(94, 162, '🌡️', { size: 30 }),
    text(46, 216, '输入：温度', { size: 12.5, fill: C.blue }),
    path('M150 150 H242', { stroke: C.muted, width: 2.4 }),
    circle(282, 150, 38, { fill: 'rgba(124,92,214,.16)', stroke: C.violet, width: 2 }),
    text(266, 162, '⚙️', { size: 30 }),
    text(228, 216, '加权求和 + 激活', { size: 12, fill: C.violet }),
    path('M322 150 H412', { stroke: C.muted, width: 2.4 }),
    circle(442, 150, 30, { fill: 'rgba(31,111,92,.14)', stroke: C.green, width: 2 }),
    text(432, 162, '☂️', { size: 26 }),
    text(378, 216, '输出：带伞？', { size: 12, fill: C.green })
  ],
  nnLayers: () => {
    const cmds = [];
    [86, 176].forEach(x => [76, 150, 224].forEach(y => {
      cmds.push(circle(x, y, 22, { fill: 'rgba(43,127,184,.12)', stroke: C.blue }));
    }));
    cmds.push(circle(252, 150, 22, { fill: 'rgba(31,111,92,.14)', stroke: C.green }));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      cmds.push(line(108, 76 + i * 74, 154, 76 + j * 74, { stroke: 'rgba(36,48,68,.14)' }));
      cmds.push(line(198, 76 + i * 74, 230, 150, { stroke: 'rgba(36,48,68,.14)' }));
    }
    cmds.push(text(54, 274, '输入层', { size: 12, fill: C.blue }));
    cmds.push(text(156, 274, '隐藏层', { size: 12, fill: C.violet }));
    cmds.push(text(228, 274, '输出层', { size: 12, fill: C.green }));
    cmds.push(text(300, 96, '每一层都在', { size: 13, fill: C.amber }));
    cmds.push(text(300, 122, '寻找更抽象的规律：', { size: 13, fill: C.amber }));
    cmds.push(text(300, 156, '像素 → 边缘 → 部件 → 物体', { size: 12.5, fill: C.ink }));
    return cmds;
  },
  nnFit: () => [
    rect(30, 40, 200, 180, { rx: 14, fill: 'rgba(194,86,111,.08)', stroke: C.rose }),
    text(50, 76, '学得太少', { size: 13.5, fill: C.rose, weight: 'bold' }),
    text(50, 112, '网络太小、数据太少', { size: 12.5, fill: C.ink }),
    text(50, 138, '→ 连训练题都做不对', { size: 12.5, fill: C.ink }),
    text(50, 174, '这叫欠拟合', { size: 12.5, fill: C.amber }),
    rect(250, 40, 200, 180, { rx: 14, fill: 'rgba(201,138,27,.10)', stroke: C.amber }),
    text(270, 76, '学得太多', { size: 13.5, fill: C.amber, weight: 'bold' }),
    text(270, 112, '网络太大、数据太少', { size: 12.5, fill: C.ink }),
    text(270, 138, '→ 训练满分，新题全错', { size: 12.5, fill: C.ink }),
    text(270, 174, '这叫过拟合', { size: 12.5, fill: C.amber }),
    text(240, 258, '合适的复杂度 + 足够多样的数据 = 会举一反三', { size: 12.5, fill: C.green, anchor: 'middle' })
  ],
  nnBike: () => [
    rect(30, 36, 420, 102, { rx: 14, fill: 'rgba(43,127,184,.08)', stroke: C.blue }),
    text(50, 74, '机器学习像学骑车', { size: 14.5, fill: C.blue, weight: 'bold' }),
    text(50, 106, '摔倒 → 调整 → 再试 → 越来越稳', { size: 13, fill: C.ink }),
    text(50, 130, '模型也是这样：预测 → 算误差 → 调参数 → 再预测', { size: 12.5, fill: C.muted }),
    rect(30, 156, 420, 100, { rx: 14, fill: 'rgba(31,111,92,.08)', stroke: C.green }),
    text(50, 192, '但有三点不一样', { size: 13, fill: C.green, weight: 'bold' }),
    text(50, 220, '① 它一秒能试几万次　② 它不会累　③ 目标要由人来定', { size: 12.5, fill: C.ink }),
    text(50, 246, '方向和目标由人定，重复练习交给机器。', { size: 12.5, fill: C.amber })
  ],
  biasPhotos: () => {
    const cmds = [text(34, 56, '我们收集了 100 张"医生"的照片', { size: 14, fill: C.blue })];
    for (let i = 0; i < 10; i++) {
      const x = 34 + (i % 5) * 88, y = 84 + Math.floor(i / 5) * 76;
      cmds.push(rect(x, y, 76, 64, { rx: 12, fill: i < 9 ? 'rgba(43,127,184,.10)' : 'rgba(212,99,127,.14)', stroke: 'rgba(36,48,68,.16)' }));
      cmds.push(text(x + 20, y + 44, i < 9 ? '👨‍⚕️' : '👩‍⚕️', { size: 26 }));
    }
    cmds.push(text(34, 278, '其中 90 位男性，只有 10 位女性', { size: 12.5, fill: C.amber }));
    return cmds;
  },
  biasWrong: () => [
    rect(50, 40, 380, 56, { rx: 12, fill: 'rgba(36,48,68,.05)', stroke: 'rgba(36,48,68,.16)' }),
    text(70, 76, '模型学到的"规律"：医生大多是男性', { size: 13.5, fill: C.rose }),
    text(50, 136, '于是当一位女医生的照片出现时——', { size: 13, fill: C.ink }),
    rect(50, 158, 380, 60, { rx: 12, fill: 'rgba(194,86,111,.10)', stroke: C.rose }),
    text(70, 196, '模型判断：护士（置信度 63%）', { size: 13.5, fill: C.rose }),
    text(50, 258, '机器没有恶意，它只是把"历史"当成了"正确"', { size: 12.5, fill: C.amber })
  ],
  biasFix: () => [
    rect(30, 40, 200, 180, { rx: 14, fill: 'rgba(201,138,27,.10)', stroke: C.amber }),
    text(50, 74, '问题出在哪', { size: 14, fill: C.amber, weight: 'bold' }),
    text(50, 108, '① 数据不均衡', { size: 12.5, fill: C.ink }),
    text(50, 134, '② 历史决定当标准', { size: 12.5, fill: C.ink }),
    text(50, 160, '③ 只看准确率', { size: 12.5, fill: C.ink }),
    text(50, 186, '④ 缺少人工复核', { size: 12.5, fill: C.ink }),
    rect(250, 40, 200, 180, { rx: 14, fill: 'rgba(31,111,92,.10)', stroke: C.green }),
    text(270, 74, '怎么补救', { size: 14, fill: C.green, weight: 'bold' }),
    text(270, 108, '① 补充少数群体样本', { size: 12.5, fill: C.ink }),
    text(270, 134, '② 定义公平性指标', { size: 12.5, fill: C.ink }),
    text(270, 160, '③ 分群体检查错误率', { size: 12.5, fill: C.ink }),
    text(270, 186, '④ 关键决定留给人', { size: 12.5, fill: C.ink }),
    text(240, 258, '公平要主动设计，不会自己出现', { size: 12.5, fill: C.blue, anchor: 'middle' })
  ],
  biasBalance: () => [
    circle(240, 140, 66, { fill: 'rgba(43,127,184,.10)', stroke: C.blue, width: 2 }),
    text(214, 158, '⚖️', { size: 44 }),
    text(112, 64, '公平', { size: 14, fill: C.blue }),
    text(320, 64, '准确', { size: 14, fill: '#d4637f' }),
    text(60, 244, '不同群体基础不同，公平与准确常常需要权衡', { size: 12.5, fill: C.amber }),
    text(60, 272, '这不是技术小事，而是价值选择——需要人来做决定并说明理由。', { size: 12, fill: C.muted })
  ]
};

/* ---------------- 绘本数据 ---------------- */
const BOOKS = [
  {
    id: 'book-cat', topic: '机器怎么学会认猫', title: '小猫认一认', emoji: '🐱',
    topicId: 'ml-supervised',
    pages: [
      { art: 'catMeet', titles: ['这是猫，这是狗', '给机器看例子', '从例子中学习'], texts: [
        '小朋友，你一眼就认得出猫和狗。\n那机器呢？它一开始什么都不认识。\n我们要教它：拿一张图，告诉它"这是猫"。',
        '你一眼就能分出猫和狗，可机器一开始谁也不认识。\n教它的办法很简单：给它看图片，并告诉它正确答案。\n这样一条"图片 + 答案"的记录，就是一条训练数据。',
        '人类识别图像靠视觉经验，机器靠数据。\n每条样本由输入（像素矩阵）和标签组成。\n这就是监督学习的起点：用带标签的数据定义任务。'
      ] },
      { art: 'catMany', titles: ['看得越多，认得越准', '给很多很多例子', '样本量与多样性决定上限'], texts: [
        '我们给它看一百张、一千张。\n它慢慢就发现了：\n有尖耳朵、有胡须的，多半是猫。',
        '只给两三张是不够的。看几百张、几千张，它才能发现规律。\n例子越多、越丰富，它学得越稳。',
        '模型从大量样本中估计特征与标签之间的统计关系。\n样本量决定可学习的复杂度，多样性决定泛化边界。'
      ] },
      { art: 'catAsk', titles: ['考考它！', '用没见过的图考它', '在测试集上评估'], texts: [
        '现在拿一张它没见过的照片问它：\n"这是什么呀？"\n它说："是猫！我有 92% 的把握。"',
        '关键一步：用一张它没见过的新图片来考它。\n答对了，说明它抓住了规律而不是背答案。\n这就是"预测"，也叫"推理"。',
        '评估必须在未参与训练的数据上进行，否则会高估性能。\n模型输出通常是各类别的概率分布，可以用置信度衡量不确定性。'
      ] },
      { art: 'catFix', titles: ['它会出错，我们帮它改', '出错很正常，改进有办法', '错误分析与迭代'], texts: [
        '如果它认错了，不要怪它。\n它只是还没见过这样的照片。\n我们再给它看几张夜里的猫，它就进步啦！',
        '它也会认错，尤其是没见过的情况。\n怎么改进？① 补充这类照片 ② 检查标签有没有标错 ③ 再训练一次。\n这个过程叫"迭代"。',
        '错误分析是提升模型最有效的手段：把错例归类，找出系统性失败模式，再针对性补数据。\n盲目调参往往不如一次扎实的错例分析。'
      ] }
    ],
    vocab: [
      { term: '训练数据', plain: '带答案的例子', example: '一张猫的照片 + "猫"这个答案' },
      { term: '标签', plain: '我们想让它学会的答案', example: '"猫"或"狗"' },
      { term: '预测', plain: '用学到的本领判断新东西', example: '判断新照片是不是猫' }
    ],
    quiz: [
      { q: '教机器认猫，最重要的是给它什么？', options: ['很多带答案的图片', '一台更贵的电脑', '一本字典', '一根逗猫棒'], answer: 0, explain: '监督学习靠的是"输入 + 正确答案"的样本。' },
      { q: '用什么图片检验它学得好不好？', options: ['训练时用过的图片', '它从没见过的新图片', '最简单的图片', '最模糊的图片'], answer: 1, explain: '只有没见过的数据才能检验真实水平。' },
      { q: '它把夜里的猫认成狗，最好的做法是？', options: ['放弃这个模型', '补充夜间猫咪的照片再训练', '把答案改成狗', '让它多算几遍'], answer: 1, explain: '数据里缺什么就补什么。' }
    ]
  },
  {
    id: 'book-trash', topic: '做一个垃圾分类小助手', title: '垃圾分类小助手', emoji: '♻️',
    topicId: 'future-project',
    pages: [
      { art: 'trashMix', titles: ['先想清楚要分几类', '第一步：定义问题', '问题定义决定一切'], texts: [
        '垃圾桶前面站着四个好朋友：\n香蕉皮、易拉罐、报纸、菜叶。\n它们该住进哪个桶里呢？',
        '做 AI 的第一步不是写代码，而是想清楚要解决什么问题。\n垃圾分成几类——三类还是四类？\n输出定义清楚了，后面才有方向。',
        '问题定义包含三件事：输入、输出、成功标准。\n连输出空间都没界定清楚，模型既无法训练也无法评估。'
      ] },
      { art: 'trashBins', titles: ['给每张照片贴标签', '第二步：收集与标注数据', '标注质量决定模型上限'], texts: [
        '拍照片，然后在照片上贴一张小标签：\n"这是可回收""这是厨余"。\n贴得越准确，小助手越聪明。',
        '拍几百张照片，给每张贴上正确的标签。\n标签必须由人仔细核对，标错了模型就会学错。\n最好让两个人分别标注，不一致的再讨论。',
        '标注是最耗人力也最关键的环节。\n工程上需要标注手册、双人交叉标注与一致性检验。\n一致率低，模型能力上限就被锁死了。'
      ] },
      { art: 'trashModel', titles: ['教它认，然后考考它', '第三步：训练与测试', '训练、验证、测试三分'], texts: [
        '把小助手"教"好以后，\n拿一个它没见过的东西考考它：\n"这只袜子属于哪一类？"',
        '用大部分照片训练，留一部分当考试题。\n考试用的是它完全没见过的照片，这才是真实水平。\n训练好、考试差，说明它可能在"背答案"。',
        '标准做法是训练集、验证集、测试集三分：训练学参数，验证选超参，测试只做最终评估且只用一次。'
      ] },
      { art: 'trashCheck', titles: ['做一份"体检报告"', '第四步：检查数据质量', '数据审计与垃圾进垃圾出'], texts: [
        '看看我们的照片：\n三类都有吗？光够亮吗？有没有贴错标签？\n检查好了，小助手才靠得住。',
        '给数据集做一次体检：\n① 每类照片数量均衡吗？② 拍摄环境多样吗？③ 有没有标错的？\n先修数据，比急着换算法有用得多。',
        '数据审计是工程规范动作：检查分布、缺失、重复、偏差与伦理风险。\n"垃圾进，垃圾出"在机器学习里体现得尤为彻底。'
      ] }
    ],
    vocab: [
      { term: '数据标注', plain: '给数据贴上正确答案', example: '给照片标"可回收"' },
      { term: '类别', plain: '要区分的几种情况', example: '可回收 / 厨余 / 其他' },
      { term: '测试集', plain: '留着考试用的数据', example: '不能提前给它看的照片' }
    ],
    quiz: [
      { q: '做 AI 项目的正确顺序是？', options: ['先训练再想问题', '先定义问题再准备数据', '先买服务器', '先写论文'], answer: 1, explain: '问题定义决定输入输出，数据决定上限。' },
      { q: '为什么标签要两个人核对？', options: ['人多热闹', '减少标注错误', '规定要这样', '为了更快'], answer: 1, explain: '标注错误会被模型当成规律学会。' },
      { q: '"训练满分、测试很差"说明什么？', options: ['模型很棒', '可能过拟合', '测试题太难', '数据太少不能用'], answer: 1, explain: '泛化能力才是真本事。' }
    ]
  },
  {
    id: 'book-grad', topic: '机器怎么一步步变聪明', title: '机器学本领的秘密', emoji: '📉',
    topicId: 'ml-what',
    pages: [
      { art: 'gradStart', titles: ['先猜一个答案', '从随机猜测开始', '参数初始化'], texts: [
        '机器要猜"这个西瓜有多重"。\n它先随便说一个数。\n猜错了没关系，重要的是知道错了多少。',
        '模型一开始的参数是随机猜的，所以预测肯定不准。\n关键是：我们能算出"错得有多离谱"，这个数叫"损失"。',
        '训练的目标是最小化经验风险：寻找使损失函数最小的参数。\n初始参数通常随机初始化，损失值反映当前假设与数据的偏离程度。'
      ] },
      { art: 'gradSteps', titles: ['每次往更好的方向挪一小步', '沿着下坡方向调整', '梯度下降'], texts: [
        '想象你蒙着眼睛站在小山上。\n用脚探一探哪边更低，就往那边迈一小步。\n每迈一步，你就更接近山谷。',
        '机器怎么知道往哪边调？它计算损失对参数的斜率，然后沿着让损失变小的方向调整一小步。\n重复很多次，损失越来越小。',
        '梯度下降的更新规则：θ ← θ − η∇L(θ)。\n梯度给出最陡上升方向，取负号即下降方向；η 是学习率，控制步长。'
      ] },
      { art: 'gradBottom', titles: ['到谷底啦！', '反复迭代直到收敛', '收敛与早停'], texts: [
        '走了好多好多步以后，\n它终于到了最低的地方。\n在这里错误最小——它学会啦！',
        '重复"算误差 → 调参数"很多次，损失越来越小，直到几乎不再下降，这叫"收敛"。\n步子太大，可能会在谷底来回跳过。',
        '学习率过大导致震荡或发散，过小则收敛缓慢。\n工程上常用自适应优化器与学习率调度，并用验证集监控、及时早停。'
      ] },
      { art: 'gradRate', titles: ['步子要大还是要小？', '学习率：步子的大小', '学习率与优化器'], texts: [
        '步子太小：走半天还在山顶。\n步子太大：一下子跨过山谷。\n找到合适的步子，才能又好又快地学会。',
        '机器调节的"步子大小"叫学习率。\n太小：训练慢；太大：跳过最低点，来回震荡。',
        '学习率是超参数，由人设定并用验证集选择。\n常见策略：预热、阶梯衰减、余弦退火；自适应方法按参数维度缩放步长。'
      ] }
    ],
    vocab: [
      { term: '损失', plain: '预测和正确答案差多少', example: '猜 8 斤，实际 10 斤，差 2 斤' },
      { term: '参数', plain: '模型内部可以调整的数字', example: '权重 w 和偏置 b' },
      { term: '学习率', plain: '每次调整的步子大小', example: '太大就会跳过最低点' }
    ],
    quiz: [
      { q: '"损失"衡量的是？', options: ['模型大小', '预测与真实答案的差距', '训练时间', '数据量'], answer: 1, explain: '损失越小说明预测越接近真实答案。' },
      { q: '梯度下降的方向是？', options: ['损失变大的方向', '损失变小的方向', '随机方向', '固定向上'], answer: 1, explain: '沿梯度反方向走，损失下降最快。' },
      { q: '学习率太大最可能导致？', options: ['训练更稳', '震荡甚至发散', '模型变小', '数据变多'], answer: 1, explain: '步子太大会跨过最低点。' }
    ]
  },
  {
    id: 'book-nn', topic: '神经网络怎么思考', title: '会思考的小小网络', emoji: '🧠',
    topicId: 'vision-image',
    pages: [
      { art: 'nnOne', titles: ['一个小小判断器', '单个神经元：加权求和加激活', '从感知机说起'], texts: [
        '今天温度 15℃，会下雨吗？\n小判断器收集信息，算一算，\n然后说："带上伞吧！"',
        '一个"神经元"做的事很简单：把几个输入乘上权重加起来，再经过一个开关，决定要不要"兴奋"。\n很多个连起来，就成了神经网络。',
        '形式化：y = f(Σwᵢxᵢ + b)，f 为非线性激活函数。\n非线性是必要的——没有它，多层网络等价于单层线性变换。'
      ] },
      { art: 'nnLayers', titles: ['很多个小判断器手拉手', '多层网络：从简单到抽象', '表示学习与层次特征'], texts: [
        '把小判断器一层层排好：\n第一层看小细节，第二层看形状，\n最后一层说："这是一只猫！"',
        '把神经元排成好几层：\n第一层看边缘和颜色，第二层组合成眼睛耳朵，更深的层组合成整张脸。',
        '深层网络逐层构建表示：浅层学低级特征，深层学语义概念。\n这正是"表示学习"的威力。'
      ] },
      { art: 'nnFit', titles: ['学太少和学太多', '欠拟合与过拟合', '容量与泛化的权衡'], texts: [
        '网络太小：学不会，做题老是错。\n网络太大：把答案背下来，换新题就傻眼。\n不多不少，刚刚好。',
        '学得太少（欠拟合）连训练题都做不对；学得太多（过拟合）训练全对新题全错。\n办法：多给数据、别让网络太复杂、练一会儿就停下来检查。',
        '容量控制手段：正则化、数据增强、早停、交叉验证与集成。\n理论视角是偏差—方差分解与"双下降"现象。'
      ] },
      { art: 'nnBike', titles: ['它像学骑车一样', '机器学习和人学习很像', '归纳偏置与迭代'], texts: [
        '你学骑车的时候，摔了好多次。\n每次摔倒，你就调整一点点。\n模型也是这样，一次又一次地试。',
        '模型学习像小朋友学骑车：试一试 → 摔一下 → 调一调 → 再来。\n区别是它一秒能试几万次，而且不会累——但目标还是要人来定。',
        '学习是"归纳偏置 + 数据 + 优化"的共同结果。\n理解人与模型的差别，才能判断什么场景可信、什么场景必须由人把关。'
      ] }
    ],
    vocab: [
      { term: '神经元', plain: '一个小小的判断器', example: '收集信息 → 算一算 → 给答案' },
      { term: '权重', plain: '每个信息有多重要', example: '云很黑 → 权重高 → 更可能下雨' },
      { term: '过拟合', plain: '只会背答案，不会举一反三', example: '训练满分，新题全错' }
    ],
    quiz: [
      { q: '一个神经元主要做什么？', options: ['把输入加权求和再判断', '存储所有图片', '给电脑降温', '连接网络'], answer: 0, explain: '加权求和加激活函数，是最基本的计算单元。' },
      { q: '为什么需要非线性激活函数？', options: ['为了好看', '否则多层等价于一层', '为了省电', '为了加速'], answer: 1, explain: '非线性让网络能表达更复杂的映射。' },
      { q: '过拟合的典型表现是？', options: ['训练测试都差', '训练很好但测试很差', '训练很慢', '参数太少'], answer: 1, explain: '记住了噪声，泛化能力下降。' }
    ]
  },
  {
    id: 'book-bias', topic: 'AI 会不公平吗', title: '公平的机器', emoji: '⚖️',
    topicId: 'ethics-fair',
    pages: [
      { art: 'biasPhotos', titles: ['我们收集了一百张照片', '有偏的数据集', '采样偏差'], texts: [
        '我们要教机器认"医生"。\n找了一百张医生的照片——\n咦，怎么大多数都是男医生？',
        '我们要训练一个"识别医生"的模型，收集了一百张照片。\n可是里面 90 张是男性，只有 10 张是女性。\n这份数据本身就带着偏差。',
        '采样偏差会直接进入模型：某一群体占比过低，模型在该群体上的错误率就会显著偏高。\n数据审计的第一步就是统计各子群的样本量。'
      ] },
      { art: 'biasWrong', titles: ['机器学到了一条错规律', '模型会复制并放大偏见', '偏差的传导路径'], texts: [
        '机器不会思考对错，它只会找规律。\n它发现："医生大多是男的。"\n于是它把女医生认成了护士。',
        '模型从数据里总结规律，而不会判断规律是否公平。\n它学到"医生大多是男性"，于是面对女医生时给出错误判断。\n这叫"算法偏见"。',
        '偏见来源：采样偏差、标签偏差、目标函数偏差与代理特征。\n删除敏感字段往往并不能消除偏见。'
      ] },
      { art: 'biasFix', titles: ['找出问题，然后改进', '识别与缓解偏见', '公平性工程手段'], texts: [
        '我们发现问题啦！\n补上女医生的照片，\n再检查一遍：现在它对谁都认得准了。',
        '改进办法：① 补充缺失群体的样本；② 检查标签是否带历史偏见；③ 分群体检查准确率；④ 重要决定留给人复核。',
        '公平性工程：重加权、对抗去偏、公平性约束训练；评估侧使用群体公平指标看板。\n这些指标常常无法同时满足，必须按场景选择并公开取舍。'
      ] },
      { art: 'biasBalance', titles: ['公平要主动设计', '公平是价值选择', '治理与责任'], texts: [
        '机器不会自己变得公平。\n只有我们认真检查、认真改进，\n它才能对每个人都一样好。',
        '公平不会自动出现，需要人主动设计：想一想"谁会被漏掉"，检查"不同人的错误率是不是差不多"。',
        '算法治理需要技术、制度与素养三者配合：影响评估、审计、可解释性、救济机制与法律法规。\n最终问题不是"机器是否公平"，而是"谁来为不公平负责、如何纠正"。'
      ] }
    ],
    vocab: [
      { term: '算法偏见', plain: 'AI 对某些人不公平', example: '只把男性判断为医生' },
      { term: '采样偏差', plain: '数据里没收集到某些人', example: '一百张照片里只有十位女性' },
      { term: '人工复核', plain: '重要决定由人再检查一遍', example: '录取结果不能只看机器打分' }
    ],
    quiz: [
      { q: '算法偏见最主要的来源是？', options: ['电脑太旧', '训练数据或目标设定带偏见', '用户太少', '网络太慢'], answer: 1, explain: '数据与目标决定模型学到什么。' },
      { q: '发现模型对某群体准确率偏低，应该？', options: ['忽略它', '补充该群体样本并做分群体评估', '提高温度', '换服务器'], answer: 1, explain: '缺什么补什么，评估要看子群表现。' },
      { q: '高风险决策中最重要的原则是？', options: ['完全交给模型', '保留人工复核与申诉渠道', '不公开信息', '只追求准确率'], answer: 1, explain: '责任必须可归属，结果必须可救济。' }
    ]
  }
];

/* ---------------- 生成逻辑 ---------------- */
/** 按年级选文字档位：0 低年级 / 1 小学高年级 / 2 初中以上 */
function tier(grade) {
  const g = Number(grade) || 5;
  return g <= 2 ? 0 : (g <= 6 ? 1 : 2);
}

function list() {
  return BOOKS.map(b => ({
    id: b.id, topic: b.topic, title: b.title, emoji: b.emoji,
    pages: b.pages.length, topicId: b.topicId,
    topicTitle: (content.getTopic(b.topicId) || {}).title || ''
  }));
}

function generate(bookId, grade, pageCount) {
  const b = BOOKS.find(x => x.id === bookId) || BOOKS[0];
  if (!b) return null;
  const t = tier(grade);
  const lv = content.levelOfGrade(grade);
  let pages = b.pages.map((p, i) => {
    const body = p.texts[t] || p.texts[1];
    return {
      index: i + 1,
      title: p.titles[t] || p.titles[1],
      text: body,
      narration: body.replace(/\n/g, '，'),
      art: toSvg(ART[p.art] ? ART[p.art]() : [], W, H),
      tip: t === 0 ? '读完后，试着用自己的话讲给爸爸妈妈听。'
        : (t === 1 ? '想一想：这一页讲了哪个关键步骤？'
          : '延伸思考：这一步在工程实现上会遇到什么问题？')
    };
  });
  const want = Number(pageCount) || pages.length;
  if (want < pages.length) pages = pages.slice(0, Math.max(2, want));
  const topic = content.getTopic(b.topicId);
  return {
    id: b.id, title: b.title, emoji: b.emoji, topic: b.topic,
    grade: Number(grade) || 5, levelId: lv.id, levelName: lv.name,
    topicId: b.topicId, topicTitle: topic ? topic.title : '',
    pages: pages, vocab: b.vocab.slice(), quiz: b.quiz.slice(),
    canvas: { w: W, h: H }
  };
}

module.exports = { list, generate, BOOKS, toSvg, W, H };
