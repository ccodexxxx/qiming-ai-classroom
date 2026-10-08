/**
 * 多模态内容 · 原理动画
 *
 * 做法：服务端只生成「绘图指令」（JSON），浏览器把指令渲染成 SVG。
 * 好处：1) 画面是真正的矢量图，可缩放、可交互；2) 传输体积极小；3) 指令可读可测。
 *
 * 指令集（每条是一个数组，第 0 位是类型）：
 *   ['rect', x, y, w, h, {fill,stroke,rx,opacity}]
 *   ['circle', cx, cy, r, {fill,stroke,opacity}]
 *   ['line', x1, y1, x2, y2, {stroke,width,dash}]
 *   ['path', d, {stroke,width,fill,dash}]
 *   ['text', x, y, str, {size,fill,anchor,weight}]
 *   ['poly', [[x,y],...], {stroke,width,fill,dash}]
 */
'use strict';

const content = require('../content');

const W = 460, H = 280;

/* ---------------- 绘图助手 ---------------- */
const rect = (x, y, w, h, o) => ['rect', x, y, w, h, o || {}];
const circle = (cx, cy, r, o) => ['circle', cx, cy, r, o || {}];
const line = (x1, y1, x2, y2, o) => ['line', x1, y1, x2, y2, o || {}];
const path = (d, o) => ['path', d, o || {}];
const text = (x, y, s, o) => ['text', x, y, String(s), o || {}];
const poly = (pts, o) => ['poly', pts, o || {}];

function seeded(seed) {
  let x = (seed || 1) * 9301 + 49297;
  return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
}

function cloud(seed, n, cA, cB, spread) {
  const rnd = seeded(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const c = i % 2 === 0 ? cA : cB;
    pts.push({
      x: Math.min(0.94, Math.max(0.06, c[0] + (rnd() - 0.5) * (spread || 0.22))),
      y: Math.min(0.94, Math.max(0.06, c[1] + (rnd() - 0.5) * (spread || 0.22))),
      cls: i % 2
    });
  }
  return pts;
}

/* ================= 画面构造器（必须先于 ANIMATIONS 定义） ================= */
const CONV_CELLS = [
  [0.18, 0.20, 0.30, 0.82, 0.92, 0.90],
  [0.20, 0.28, 0.42, 0.86, 0.90, 0.82],
  [0.30, 0.32, 0.52, 0.80, 0.86, 0.84],
  [0.34, 0.42, 0.72, 0.50, 0.42, 0.40],
  [0.40, 0.60, 0.82, 0.30, 0.28, 0.30],
  [0.48, 0.70, 0.86, 0.28, 0.24, 0.26]
];

function pixelGrid(n, cell, x0, y0, withNumbers) {
  const cmds = [];
  const rnd = seeded(7);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = Math.round(rnd() * 255);
      cmds.push(rect(x0 + c * cell, y0 + r * cell, cell - 2, cell - 2, { rx: 3, fill: 'rgb(' + v + ',' + v + ',' + v + ')', opacity: 0.92 }));
      if (withNumbers) cmds.push(text(x0 + c * cell + 4, y0 + r * cell + 16, v, { size: 8.5, fill: v > 140 ? '#243044' : '#f7f4ec' }));
    }
  }
  cmds.push(text(24, 240, withNumbers ? '每个数字 0~255，越大越亮' : '6×6 的像素格子', { size: 12.5, fill: '#2b7fb8' }));
  return cmds;
}

function conv(px, py, full) {
  const S = 26, X0 = 24, Y0 = 30;
  const cmds = [];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
    const v = Math.round(CONV_CELLS[r][c] * 255);
    cmds.push(rect(X0 + c * S, Y0 + r * S, S - 2, S - 2, { rx: 3, fill: 'rgb(' + v + ',' + v + ',' + v + ')' }));
  }
  if (px >= 0) {
    cmds.push(rect(X0 + px * S - 2, Y0 + py * S - 2, S * 3, S * 3, { rx: 6, fill: 'none', stroke: '#c98a1b', width: 3 }));
    cmds.push(text(X0, Y0 + 6 * S + 24, '黄框 = 当前卷积窗口', { size: 12, fill: '#c98a1b' }));
  } else {
    cmds.push(text(X0, Y0 + 6 * S + 24, '6×6 的像素矩阵', { size: 12, fill: '#8494a6' }));
  }
  const OX = 252;
  cmds.push(text(OX, 44, '卷积输出（特征图）', { size: 12.5, fill: '#2b7fb8', weight: 'bold' }));
  const out = [[0, 0, 0, 1], [0, 0, 1, 0], [1, 1, 0, 0], [1, 0, 0, 0]];
  const OS = 30;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const on = full ? out[i][j] : (px === i && py === j);
    cmds.push(rect(OX + j * OS, 56 + i * OS, OS - 3, OS - 3, { rx: 4, fill: on ? '#c98a1b' : 'rgba(36,48,68,.05)', stroke: 'rgba(36,48,68,.15)' }));
  }
  cmds.push(text(OX, 200, full ? '越亮 = 该位置越像「边缘」' : '每滑一次得到 1 个输出值', { size: 12, fill: '#8494a6' }));
  return cmds;
}

function boundary(w, showHint) {
  const pts = cloud(5, 26, [0.32, 0.36], [0.7, 0.68], 0.22);
  const cmds = [];
  for (let i = 0; i <= 4; i++) cmds.push(line(30, 24 + i * 46, 430, 24 + i * 46, { stroke: 'rgba(36,48,68,.07)' }));
  let correct = 0;
  pts.forEach(p => {
    const py = 24 + p.y * 190;
    const pred = py > 30 + w * 190 ? 0 : 1;
    if (pred === p.cls) correct++;
    cmds.push(circle(p.x * 400 + 30, py, 7, { fill: p.cls ? '#d4637f' : '#2b7fb8', stroke: pred === p.cls ? '#1f6f5c' : '#c2566f', width: 2.4 }));
  });
  cmds.push(line(30, 30 + w * 190, 430, 30 + w * 190, { stroke: '#c98a1b', width: 3, dash: '8 5' }));
  cmds.push(text(36, 258, '黄线 = 决策边界　准确率 ' + Math.round(correct / pts.length * 100) + '%', { size: 12.5, fill: '#c98a1b' }));
  if (showHint) cmds.push(text(250, 44, '绿圈=判断正确，红圈=判断错误', { size: 11.5, fill: '#8494a6' }));
  return cmds;
}

function linfit(w, b, showErr) {
  const rnd = seeded(11);
  const pts = [];
  for (let i = 0; i < 12; i++) {
    const x = 0.08 + rnd() * 0.84;
    pts.push({ x, y: Math.min(0.88, Math.max(0.12, 0.72 - x * 0.46 + (x - 0.5) * 0.22 + (rnd() - 0.5) * 0.1)) });
  }
  const cmds = [
    line(46, 230, 430, 230, { stroke: 'rgba(36,48,68,.25)' }),
    line(46, 30, 46, 230, { stroke: 'rgba(36,48,68,.25)' }),
    text(370, 254, '面积 →', { size: 11.5, fill: '#8494a6' }),
    text(52, 46, '房价', { size: 11.5, fill: '#8494a6' })
  ];
  const lineY = x => Math.min(226, Math.max(28, 230 - (w * (x - 0.06) + (b - 0.30)) * 190));
  pts.forEach(p => {
    const px = 46 + p.x * 370, py = 230 - p.y * 190;
    cmds.push(circle(px, py, 4.8, { fill: '#2b7fb8' }));
    if (showErr) cmds.push(line(px, py, px, lineY(p.x), { stroke: '#c2566f', width: 2, dash: '3 3' }));
  });
  cmds.push(line(66, lineY(0.06), 430, lineY(0.94), { stroke: '#c98a1b', width: 3 }));
  cmds.push(text(210, 40, '预测线：房价 = w × 面积 + b', { size: 12.5, fill: '#c98a1b', weight: 'bold' }));
  if (showErr) cmds.push(text(210, 62, '粉色竖线 = 每个样本的误差', { size: 12, fill: '#c2566f' }));
  return cmds;
}

function lossCurve(cur, moving) {
  const cmds = [path('M50 50 Q230 250 410 66', { stroke: '#7c5cd6', width: 3 })];
  const x = 50 + Math.min(1, Math.max(0, cur)) * 355;
  const t = Math.min(1, Math.abs(cur - 0.46) / 0.54);
  const y = Math.min(234, Math.max(48, 52 + Math.pow(t, 1.7) * 176));
  cmds.push(circle(x, y, 10, { fill: '#c98a1b' }));
  cmds.push(circle(x, y, 17, { fill: 'none', stroke: 'rgba(201,138,27,.35)', width: 2 }));
  cmds.push(text(50, 258, '损失（越小越好）→', { size: 11.5, fill: '#8494a6' }));
  cmds.push(text(340, 44, '参数 w →', { size: 11.5, fill: '#8494a6' }));
  cmds.push(text(224, 196, '小球高度 = 当前模型的损失', { size: 12, fill: '#7c5cd6' }));
  if (moving) cmds.push(path('M' + (x + 22) + ' ' + (y - 4) + ' l-18 14', { stroke: '#1f6f5c', width: 2.6 }));
  return cmds;
}

function overfit(mode) {
  const train = [{ x: 0.12, y: 0.3 }, { x: 0.25, y: 0.52 }, { x: 0.4, y: 0.4 }, { x: 0.56, y: 0.68 }, { x: 0.72, y: 0.52 }, { x: 0.88, y: 0.74 }];
  const test = [{ x: 0.2, y: 0.42 }, { x: 0.62, y: 0.6 }, { x: 0.8, y: 0.64 }];
  const P = p => [46 + p.x * 370, 226 - p.y * 186];
  const cmds = [line(46, 226, 430, 226, { stroke: 'rgba(36,48,68,.25)' }), line(46, 36, 46, 226, { stroke: 'rgba(36,48,68,.25)' })];
  if (mode === 1) {
    const a = P(train[0]), b = P(train[5]);
    cmds.push(line(a[0], a[1], b[0], b[1], { stroke: '#c98a1b', width: 3 }));
    cmds.push(text(180, 44, '欠拟合：连训练点都没贴近', { size: 12.5, fill: '#c98a1b' }));
  }
  if (mode === 2 || mode === 3) {
    let d = '';
    train.forEach((p, i) => {
      const q = P(p);
      if (i === 0) { d += 'M' + q[0] + ' ' + q[1]; return; }
      const prev = P(train[i - 1]);
      d += ' Q' + ((prev[0] + q[0]) / 2) + ' ' + (prev[1] - 34) + ' ' + q[0] + ' ' + q[1];
    });
    cmds.push(path(d, { stroke: '#c98a1b', width: 3 }));
    cmds.push(text(150, 44, '过拟合：每个训练点都穿过，曲线却很"神经质"', { size: 12, fill: '#c2566f' }));
  }
  train.forEach(p => { const q = P(p); cmds.push(circle(q[0], q[1], 6, { fill: '#2b7fb8', stroke: '#f7f4ec', width: 2 })); });
  if (mode === 3) {
    test.forEach(p => { const q = P(p); cmds.push(circle(q[0], q[1], 6.5, { fill: '#c98a1b', stroke: '#f7f4ec', width: 2 })); });
    cmds.push(text(150, 66, '黄点 = 新样本（以前没见过）', { size: 12, fill: '#c98a1b' }));
  }
  if (mode === 0) cmds.push(text(200, 44, '蓝点 = 训练样本', { size: 12.5, fill: '#2b7fb8' }));
  return cmds;
}

function kmeansScene(centers, round) {
  const pts = cloud(21, 28, [0.3, 0.33], [0.69, 0.68], 0.16);
  const cmds = [];
  const colors = ['#2b7fb8', '#d4637f'];
  pts.forEach(p => {
    let g = -1;
    if (centers) {
      const d0 = Math.pow(p.x - centers[0][0], 2) + Math.pow(p.y - centers[0][1], 2);
      const d1 = Math.pow(p.x - centers[1][0], 2) + Math.pow(p.y - centers[1][1], 2);
      g = d0 < d1 ? 0 : 1;
    }
    cmds.push(circle(p.x * 380 + 30, p.y * 190 + 30, 5.6, { fill: g < 0 ? 'rgba(36,48,68,.35)' : colors[g], opacity: g < 0 ? 1 : 0.78 }));
  });
  if (centers) {
    centers.forEach(c => {
      const cx = c[0] * 380 + 30, cy = c[1] * 190 + 30;
      cmds.push(poly([[cx, cy - 10], [cx + 10, cy + 8], [cx - 10, cy + 8]], { fill: '#c98a1b', stroke: '#f7f4ec', width: 1.5 }));
    });
    cmds.push(text(30, 252, '第 ' + round + ' 轮：黄色三角是聚类中心', { size: 12.5, fill: '#c98a1b' }));
  } else {
    cmds.push(text(30, 252, '没有标签的数据（无监督学习）', { size: 12.5, fill: '#8494a6' }));
  }
  return cmds;
}

function token(step) {
  const words = ['请', '把', '窗户', '关上', '，', '风', '有', '点', '大'];
  const cmds = [
    rect(24, 34, 412, 42, { fill: 'rgba(36,48,68,.05)', stroke: 'rgba(36,48,68,.18)', rx: 10 }),
    text(38, 62, step === 0 ? '"请把窗户关上，风有点大"' : words.join('  '), { size: 14, fill: '#243044' })
  ];
  if (step >= 1) {
    words.forEach((w, i) => {
      cmds.push(rect(26 + i * 45, 96, 40, 32, { rx: 7, fill: 'rgba(43,127,184,.14)', stroke: '#2b7fb8' }));
      cmds.push(text(36 + i * 45, 118, w, { size: 12.5, fill: '#2b7fb8' }));
    });
    cmds.push(text(26, 152, '词元（token）：模型处理的最小单位', { size: 12, fill: '#8494a6' }));
  }
  if (step >= 2) {
    [[0.2, -0.4, 0.7], [0.5, 0.1, -0.3], [-0.2, 0.8, 0.4]].forEach((v, i) => {
      cmds.push(rect(26 + i * 108, 162, 96, 28, { rx: 6, fill: 'rgba(124,92,214,.14)', stroke: '#7c5cd6' }));
      cmds.push(text(34 + i * 108, 181, '[' + v.join(', ') + ']', { size: 10.5, fill: '#7c5cd6' }));
    });
    cmds.push(text(26, 212, '每个词元 → 一串数字（词向量）', { size: 12, fill: '#8494a6' }));
  }
  if (step === 3) {
    cmds.push(rect(26, 226, 200, 36, { rx: 8, fill: 'rgba(31,111,92,.12)', stroke: '#1f6f5c' }));
    cmds.push(text(38, 250, '预测下一个词：「我」', { size: 12.5, fill: '#1f6f5c' }));
    cmds.push(text(242, 250, '概率 0.42', { size: 12.5, fill: '#c98a1b' }));
  }
  return cmds;
}

function tempScene(temp) {
  const seq = ['从前', '有一座', '山', '，', '山里', '有个'];
  const cands = [{ w: '小', p: 0.36 }, { w: '老', p: 0.27 }, { w: '神', p: 0.18 }, { w: '快乐的', p: 0.11 }, { w: '会说话的', p: 0.08 }];
  const cmds = [
    rect(24, 26, 412, 40, { fill: 'rgba(36,48,68,.05)', stroke: 'rgba(36,48,68,.18)', rx: 10 }),
    text(38, 52, seq.join(''), { size: 14, fill: '#243044' }),
    text(24, 92, '模型给出的下一个词概率：', { size: 12.5, fill: '#2b7fb8' })
  ];
  let ps = cands.map(c => Math.pow(c.p, 1 / Math.max(0.15, temp)));
  const sum = ps.reduce((a, b) => a + b, 0);
  ps = ps.map(p => p / sum);
  ps.forEach((p, i) => {
    const y = 108 + i * 26;
    cmds.push(text(28, y + 14, cands[i].w, { size: 12.5, fill: '#243044' }));
    cmds.push(rect(126, y + 2, Math.max(4, p * 190), 15, { rx: 5, fill: '#2b7fb8', opacity: 0.85 }));
    cmds.push(text(330, y + 14, (p * 100).toFixed(0) + '%', { size: 11.5, fill: '#8494a6' }));
  });
  const best = ps.indexOf(Math.max.apply(null, ps));
  cmds.push(text(24, 258, '最可能接的是「' + cands[best].w + '」（温度 ' + temp.toFixed(1) + '）', { size: 12.5, fill: '#c98a1b' }));
  return cmds;
}

function biasScene(mode) {
  const nA = mode === 'biased' ? 22 : 12;
  const nB = mode === 'biased' ? 4 : 12;
  const accA = mode === 'biased' ? 94 : 90;
  const accB = mode === 'biased' ? 51 : 88;
  return [
    text(30, 40, '训练数据里的样本数量', { size: 12.5, fill: '#2b7fb8', weight: 'bold' }),
    text(30, 74, '群体 A（白天照片）', { size: 12.5, fill: '#5b6b7c' }),
    rect(210, 58, nA * 7, 20, { rx: 6, fill: '#2b7fb8' }),
    text(218 + nA * 7, 74, nA + ' 张', { size: 12, fill: '#243044' }),
    text(30, 118, '群体 B（夜间照片）', { size: 12.5, fill: '#5b6b7c' }),
    rect(210, 102, Math.max(8, nB * 7), 20, { rx: 6, fill: '#c98a1b' }),
    text(218 + Math.max(8, nB * 7), 118, nB + ' 张', { size: 12, fill: '#243044' }),
    text(30, 162, '测试表现（准确率）', { size: 12.5, fill: '#2b7fb8', weight: 'bold' }),
    rect(210, 148, accA * 1.6, 18, { rx: 6, fill: 'rgba(31,111,92,.55)' }),
    text(216 + accA * 1.6, 162, 'A ' + accA + '%', { size: 11.5, fill: '#1f6f5c' }),
    rect(210, 176, accB * 1.6, 18, { rx: 6, fill: mode === 'biased' ? 'rgba(194,86,111,.55)' : 'rgba(31,111,92,.55)' }),
    text(216 + accB * 1.6, 190, 'B ' + accB + '%', { size: 11.5, fill: mode === 'biased' ? '#c2566f' : '#1f6f5c' }),
    text(30, 232, mode === 'biased' ? '数据不平衡 → 模型对样本少的群体几乎失灵' : '数据补齐之后 → 两个群体的表现接近了', { size: 12.5, fill: '#c98a1b' })
  ];
}

function maze(steps, note, loopShown) {
  const N = 6, S = 34, X0 = 26, Y0 = 24;
  const walls = { '2,1': 1, '2,2': 1, '2,3': 1, '2,4': 1, '1,3': 1, '4,2': 1 };
  const cmds = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    cmds.push(rect(X0 + c * S, Y0 + r * S, S - 2, S - 2, { rx: 5, fill: walls[c + ',' + r] ? 'rgba(194,86,111,.30)' : 'rgba(36,48,68,.05)', stroke: 'rgba(36,48,68,.12)' }));
  }
  cmds.push(text(X0 + 5.15 * S, Y0 + 1.35 * S, '⭐', { size: 20 }));
  steps.forEach((p, i) => {
    cmds.push(circle(X0 + p.x * S + S / 2 - 1, Y0 + p.y * S + S / 2 - 1, 9, { fill: i === steps.length - 1 ? '#1f6f5c' : 'rgba(43,127,184,.45)', stroke: '#f7f4ec', width: 1.5 }));
  });
  cmds.push(text(26, Y0 + N * S + 26, note, { size: 12.5, fill: '#c98a1b' }));
  if (loopShown) {
    cmds.push(rect(300, 30, 140, 64, { rx: 10, fill: 'rgba(31,111,92,.10)', stroke: '#1f6f5c' }));
    cmds.push(text(312, 54, '重复 10 次 {', { size: 11.5, fill: '#1f6f5c' }));
    cmds.push(text(324, 72, '向前走 1 格', { size: 11.5, fill: '#1f6f5c' }));
    cmds.push(text(312, 90, '}', { size: 11.5, fill: '#1f6f5c' }));
  }
  return cmds;
}

function scatterPoints(pts) {
  const cmds = [];
  for (let i = 0; i <= 4; i++) {
    cmds.push(line(30, 30 + i * 50, 430, 30 + i * 50, { stroke: 'rgba(36,48,68,.06)' }));
    cmds.push(line(30 + i * 100, 30, 30 + i * 100, 230, { stroke: 'rgba(36,48,68,.06)' }));
  }
  pts.forEach(p => {
    cmds.push(circle(p.x * 400 + 30, (1 - p.y) * 200 + 30, 6.5, { fill: p.cls ? '#d4637f' : '#2b7fb8', opacity: 0.9 }));
  });
  return cmds;
}

function scatter1(withLine) {
  const cmds = scatterPoints(cloud(3, 16, [0.32, 0.34], [0.7, 0.68], 0.2));
  if (withLine) {
    cmds.push(line(220, 30, 220, 230, { stroke: '#c98a1b', width: 3, dash: '8 5' }));
    cmds.push(text(232, 60, '只按重量切分：', { size: 12.5, fill: '#c98a1b' }));
    cmds.push(text(232, 82, '重叠区必然分错', { size: 12.5, fill: '#c98a1b' }));
  } else {
    cmds.push(text(240, 60, '每个点 = 一个水果样本', { size: 12.5, fill: '#5b6b7c' }));
  }
  cmds.push(circle(240, 130, 6.5, { fill: '#2b7fb8' }));
  cmds.push(text(254, 135, '类别 A', { size: 11.5, fill: '#2b7fb8' }));
  cmds.push(circle(240, 156, 6.5, { fill: '#d4637f' }));
  cmds.push(text(254, 161, '类别 B', { size: 11.5, fill: '#d4637f' }));
  cmds.push(text(36, 258, '重量 →', { size: 11.5, fill: '#8494a6' }));
  cmds.push(text(360, 258, '颜色深浅 →', { size: 11.5, fill: '#8494a6' }));
  return cmds;
}

/* ---------------- 扩展画面构造器（让原理动画更长、更细） ---------------- */
function whatIsAI(step) {
  const cmds = [];
  if (step === 0) {
    cmds.push(rect(24, 30, 170, 150, { fill: 'rgba(31,111,92,.08)', stroke: '#1f6f5c', rx: 14 }));
    cmds.push(text(60, 110, '🐱', { size: 64 }));
    cmds.push(text(30, 214, '人眼：一眼看懂', { size: 13, fill: '#1f6f5c', weight: 'bold' }));
    cmds.push(text(232, 84, '机器看到的不是猫，', { size: 13, fill: '#5b6b7c' }));
    cmds.push(text(232, 108, '而是一堆数字。', { size: 13, fill: '#5b6b7c' }));
    cmds.push(text(232, 160, '？', { size: 46, fill: '#c98a1b' }));
  } else if (step === 1) {
    cmds.push(text(30, 40, '机器看到的是一堆数字', { size: 13, fill: '#2b7fb8', weight: 'bold' }));
    const rnd = seeded(7);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
      const v = Math.round(rnd() * 255);
      cmds.push(rect(30 + c * 26, 60 + r * 26, 24, 24, { rx: 3, fill: 'rgb(' + v + ',' + v + ',' + v + ')', opacity: 0.92 }));
    }
    cmds.push(text(210, 84, '每个小方格 = 1 个像素，', { size: 12.5, fill: '#5b6b7c' }));
    cmds.push(text(210, 108, '记一个 0~255 的数字。', { size: 12.5, fill: '#5b6b7c' }));
    cmds.push(text(210, 152, '机器没有眼睛，', { size: 12.5, fill: '#c98a1b' }));
    cmds.push(text(210, 176, '它"看"的是一张数字表。', { size: 12.5, fill: '#c98a1b' }));
    cmds.push(text(210, 220, '数字越大，这里越亮。', { size: 12, fill: '#8494a6' }));
  } else if (step === 2) {
    cmds.push(text(30, 40, '第一步：找边缘', { size: 13, fill: '#2b7fb8', weight: 'bold' }));
    cmds.push(text(30, 70, '机器先扫描哪里"亮变暗"，', { size: 12.5, fill: '#5b6b7c' }));
    cmds.push(text(30, 94, '这些突变就是物体轮廓。', { size: 12.5, fill: '#5b6b7c' }));
    cmds.push(rect(40, 128, 140, 100, { fill: 'rgba(36,48,68,.05)', stroke: 'rgba(36,48,68,.3)', rx: 10 }));
    cmds.push(text(84, 184, '🐱', { size: 44 }));
    cmds.push(text(40, 252, '原始图', { size: 12, fill: '#8494a6' }));
    cmds.push(path('M220 178 H250', { stroke: '#c98a1b', width: 2.5 }));
    cmds.push(rect(260, 128, 160, 100, { fill: '#fffdf8', stroke: '#c98a1b', rx: 10 }));
    cmds.push(path('M280 200 Q310 150 350 180 T430 160', { stroke: '#c98a1b', width: 3, fill: 'none' }));
    cmds.push(text(260, 252, '边缘图', { size: 12, fill: '#c98a1b' }));
  } else if (step === 3) {
    cmds.push(text(30, 40, '第二步：把边缘拼成形状', { size: 13, fill: '#7c5cd6', weight: 'bold' }));
    cmds.push(rect(30, 76, 92, 70, { fill: 'rgba(43,127,184,.10)', stroke: '#2b7fb8', rx: 12 }));
    cmds.push(text(58, 118, '边缘', { size: 14, fill: '#2b7fb8' }));
    cmds.push(path('M126 111 H152', { stroke: '#9aa8b6', width: 2 }));
    cmds.push(rect(156, 76, 92, 70, { fill: 'rgba(124,92,214,.12)', stroke: '#7c5cd6', rx: 12 }));
    cmds.push(text(184, 118, '部件', { size: 14, fill: '#7c5cd6' }));
    cmds.push(path('M252 111 H280', { stroke: '#9aa8b6', width: 2 }));
    cmds.push(rect(284, 76, 132, 70, { fill: 'rgba(31,111,92,.12)', stroke: '#1f6f5c', rx: 12 }));
    cmds.push(text(326, 118, '整只猫', { size: 14, fill: '#1f6f5c' }));
    cmds.push(text(30, 210, '一层层往上，从细节拼出整体。', { size: 12.5, fill: '#5b6b7c' }));
  } else {
    cmds.push(text(30, 40, '第三步：靠海量例子"学会"猫', { size: 13, fill: '#1f6f5c', weight: 'bold' }));
    cmds.push(text(30, 70, '给它看很多猫的照片，', { size: 12.5, fill: '#5b6b7c' }));
    cmds.push(text(30, 94, '它自己总结出"猫"的共同规律。', { size: 12.5, fill: '#5b6b7c' }));
    ['🐱', '🐱', '🐱', '🐱', '🐱'].forEach((e, i) => cmds.push(text(70 + i * 66, 168, e, { size: 40 })));
    cmds.push(text(48, 236, '结论：AI 不是魔法，是"看数字 + 找规律"。', { size: 13, fill: '#c98a1b', weight: 'bold' }));
  }
  return cmds;
}

function rgbScene() {
  return [
    text(30, 44, '彩色照片：一个像素记 3 个数字', { size: 13, fill: '#2b7fb8', weight: 'bold' }),
    text(30, 76, 'R（红）G（绿）B（蓝）各一个数，', { size: 12.5, fill: '#5b6b7c' }),
    text(30, 100, '三个数字拼出屏幕上的颜色。', { size: 12.5, fill: '#5b6b7c' }),
    rect(250, 56, 70, 62, { rx: 10, fill: 'rgb(231,76,60)' }),
    rect(300, 56, 70, 62, { rx: 10, fill: 'rgb(46,204,113)' }),
    rect(350, 56, 70, 62, { rx: 10, fill: 'rgb(52,152,219)' }),
    text(258, 132, 'R 255', { size: 11.5, fill: '#243044' }),
    text(308, 132, 'G 120', { size: 11.5, fill: '#243044' }),
    text(358, 132, 'B 60', { size: 11.5, fill: '#243044' }),
    text(30, 172, '例如橙色 = (255, 120, 60)。', { size: 12.5, fill: '#c98a1b' }),
    text(30, 202, '一张 1080p 图有 200 多万个像素，', { size: 12, fill: '#5b6b7c' }),
    text(30, 224, '每个像素 3 个数 —— 数据量巨大。', { size: 12, fill: '#5b6b7c' })
  ];
}

function mosaicScene() {
  const cmds = [text(30, 40, '放大看：清晰照片是一格一格的小方块', { size: 13, fill: '#c98a1b', weight: 'bold' })];
  const shades = [[42, 42, 42], [92, 92, 92], [150, 150, 150], [214, 214, 214], [52, 52, 52], [112, 112, 112], [178, 178, 178], [232, 232, 232], [30, 30, 30], [74, 74, 74], [132, 132, 132], [196, 196, 196], [20, 20, 20], [64, 64, 64], [118, 118, 118], [172, 172, 172]];
  shades.forEach((v, i) => {
    const x = 30 + (i % 4) * 52, y = 76 + Math.floor(i / 4) * 52;
    cmds.push(rect(x, y, 46, 46, { rx: 4, fill: 'rgb(' + v.join(',') + ')' }));
  });
  cmds.push(text(252, 108, '像素越多，', { size: 12.5, fill: '#5b6b7c' }));
  cmds.push(text(252, 132, '画面越清晰。', { size: 12.5, fill: '#5b6b7c' }));
  cmds.push(text(252, 172, '机器就是这样', { size: 12.5, fill: '#5b6b7c' }));
  cmds.push(text(252, 196, '"看"图的。', { size: 12.5, fill: '#5b6b7c' }));
  return cmds;
}

function convKernel() {
  const cmds = [
    text(30, 40, '卷积核：一个 3×3 的小图案检测器', { size: 13, fill: '#7c5cd6', weight: 'bold' }),
    text(250, 92, '中间是 +8，四周是 -1，', { size: 12.5, fill: '#5b6b7c' }),
    text(250, 116, '正好能找出亮度突变——边缘。', { size: 12.5, fill: '#5b6b7c' }),
    text(250, 156, '这个矩阵就是机器学到的"眼睛"。', { size: 12.5, fill: '#c98a1b' })
  ];
  [[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]].forEach((row, r) => {
    row.forEach((v, c) => {
      const x = 60 + c * 52, y = 76 + r * 52;
      cmds.push(rect(x, y, 46, 46, { rx: 6, fill: v > 0 ? 'rgba(31,111,92,.20)' : 'rgba(194,86,111,.20)', stroke: '#7c5cd6' }));
      cmds.push(text(x + 14, y + 31, String(v), { size: 14, fill: '#243044' }));
    });
  });
  return cmds;
}

function multiKernel() {
  return [
    text(30, 40, '一个卷积核只找一种图案', { size: 13, fill: '#7c5cd6', weight: 'bold' }),
    text(30, 68, '所以一层网络会放很多个卷积核：', { size: 12.5, fill: '#5b6b7c' }),
    rect(40, 108, 80, 54, { rx: 8, fill: 'rgba(43,127,184,.12)', stroke: '#2b7fb8' }),
    text(56, 142, '找竖边', { size: 12.5, fill: '#2b7fb8' }),
    rect(150, 108, 80, 54, { rx: 8, fill: 'rgba(201,138,27,.14)', stroke: '#c98a1b' }),
    text(166, 142, '找横边', { size: 12.5, fill: '#c98a1b' }),
    rect(260, 108, 80, 54, { rx: 8, fill: 'rgba(194,86,111,.14)', stroke: '#c2566f' }),
    text(272, 142, '找角', { size: 12.5, fill: '#c2566f' }),
    rect(370, 108, 60, 54, { rx: 8, fill: 'rgba(124,92,214,.14)', stroke: '#7c5cd6' }),
    text(386, 142, '…', { size: 14, fill: '#7c5cd6' }),
    text(30, 208, '每个核输出一张"特征图"，', { size: 12.5, fill: '#5b6b7c' }),
    text(30, 232, '叠加起来，机器就认识了图案。', { size: 12.5, fill: '#5b6b7c' })
  ];
}

function learnRate(mode) {
  const cmds = [
    path('M50 50 Q230 250 410 66', { stroke: '#7c5cd6', width: 3 }),
    text(50, 258, '损失 →', { size: 11.5, fill: '#8494a6' }),
    text(340, 44, '参数 w →', { size: 11.5, fill: '#8494a6' })
  ];
  if (mode === 'small') {
    cmds.push(text(30, 40, '步长太小：像小碎步，要很久才到最低点', { size: 12.5, fill: '#2b7fb8', weight: 'bold' }));
    cmds.push(circle(82, 104, 9, { fill: '#2b7fb8' }));
    cmds.push(circle(96, 112, 9, { fill: 'rgba(43,127,184,.55)' }));
    cmds.push(circle(110, 120, 9, { fill: 'rgba(43,127,184,.30)' }));
  } else if (mode === 'big') {
    cmds.push(text(30, 40, '步长太大：来回跳，可能错过最低点', { size: 12.5, fill: '#c2566f', weight: 'bold' }));
    cmds.push(circle(120, 96, 9, { fill: '#c2566f' }));
    cmds.push(circle(320, 70, 9, { fill: 'rgba(194,86,111,.60)' }));
    cmds.push(circle(170, 140, 9, { fill: 'rgba(194,86,111,.35)' }));
  } else {
    cmds.push(text(30, 40, '步长适中：又快又稳地滑向最低点', { size: 12.5, fill: '#1f6f5c', weight: 'bold' }));
    cmds.push(circle(90, 100, 9, { fill: 'rgba(31,111,92,.45)' }));
    cmds.push(circle(160, 150, 9, { fill: 'rgba(31,111,92,.65)' }));
    cmds.push(circle(230, 160, 10, { fill: '#1f6f5c' }));
  }
  return cmds;
}

function overfitFixScene() {
  const cmds = [text(30, 40, '怎么避免过拟合', { size: 13, fill: '#1f6f5c', weight: 'bold' })];
  [['更多数据', '见得多，就不容易死记'], ['正则化', '给复杂模型"扣分"'], ['早停', '别练到完美才停']].forEach((row, i) => {
    const y = 76 + i * 58;
    cmds.push(rect(30, y, 400, 44, { rx: 10, fill: 'rgba(31,111,92,.08)', stroke: '#1f6f5c' }));
    cmds.push(text(48, y + 17, row[0], { size: 13, fill: '#1f6f5c', weight: 'bold' }));
    cmds.push(text(150, y + 17, row[1], { size: 12, fill: '#5b6b7c' }));
  });
  return cmds;
}

function kValueScene() {
  return [
    text(30, 40, 'K 取几，结果就分成几组', { size: 13, fill: '#c98a1b', weight: 'bold' }),
    rect(30, 76, 150, 90, { rx: 10, fill: 'rgba(43,127,184,.10)', stroke: '#2b7fb8' }),
    text(48, 100, 'K=2', { size: 13, fill: '#2b7fb8', weight: 'bold' }),
    text(48, 128, '两组：', { size: 12.5, fill: '#5b6b7c' }),
    text(48, 150, '常买蔬菜 / 常买婴儿用品', { size: 11.5, fill: '#5b6b7c' }),
    rect(230, 76, 150, 90, { rx: 10, fill: 'rgba(194,86,111,.10)', stroke: '#c2566f' }),
    text(248, 100, 'K=3', { size: 13, fill: '#c2566f', weight: 'bold' }),
    text(248, 128, '三组：', { size: 12.5, fill: '#5b6b7c' }),
    text(248, 150, '多了一类"零食爱好者"', { size: 11.5, fill: '#5b6b7c' }),
    text(30, 216, 'K 是人工定的，选错会分得很别扭。', { size: 12.5, fill: '#5b6b7c' }),
    text(30, 240, '通常要试几个 K，再选最合理的。', { size: 12.5, fill: '#c98a1b' })
  ];
}

function tokenChoiceScene() {
  return [
    text(30, 40, '词元切多大，是一种取舍', { size: 13, fill: '#7c5cd6', weight: 'bold' }),
    rect(30, 76, 180, 64, { rx: 10, fill: 'rgba(43,127,184,.10)', stroke: '#2b7fb8' }),
    text(48, 100, '按字切：「窗户」→ 窗 + 户', { size: 12, fill: '#2b7fb8' }),
    text(48, 124, '单元少，但容易丢词义', { size: 12, fill: '#5b6b7c' }),
    rect(250, 76, 180, 64, { rx: 10, fill: 'rgba(31,111,92,.10)', stroke: '#1f6f5c' }),
    text(268, 100, '按词切：「窗户」→ 窗户', { size: 12, fill: '#1f6f5c' }),
    text(268, 124, '词义完整，但词表很大', { size: 12, fill: '#5b6b7c' }),
    text(30, 196, '现代大模型常用"子词"：', { size: 12.5, fill: '#c98a1b' }),
    text(30, 220, '既保留词义，又能拆开没见过的词。', { size: 12.5, fill: '#5b6b7c' })
  ];
}

function biasCauseScene() {
  return [
    text(30, 40, '偏见不是机器发明的', { size: 13, fill: '#c2566f', weight: 'bold' }),
    text(30, 68, '它只是从数据里学到了偏见。', { size: 12.5, fill: '#5b6b7c' }),
    rect(30, 104, 400, 46, { rx: 10, fill: 'rgba(194,86,111,.10)', stroke: '#c2566f' }),
    text(48, 132, '训练数据：白天照片 22 张 / 夜间照片 4 张', { size: 12.5, fill: '#c2566f' }),
    text(30, 190, '如果训练数据本身不公平，', { size: 12.5, fill: '#5b6b7c' }),
    text(30, 214, '再聪明的模型也会"学坏"。', { size: 12.5, fill: '#5b6b7c' })
  ];
}

function biasFixScene() {
  const cmds = [text(30, 40, '怎么减少模型偏见', { size: 13, fill: '#1f6f5c', weight: 'bold' })];
  [['补数据', '把样本少的群体补足'], ['换指标', '不只盯总体准确率'], ['做评估', '分组测每个群体的表现']].forEach((row, i) => {
    const y = 76 + i * 62;
    cmds.push(rect(30, y, 400, 48, { rx: 10, fill: 'rgba(31,111,92,.08)', stroke: '#1f6f5c' }));
    cmds.push(text(48, y + 18, row[0], { size: 13, fill: '#1f6f5c', weight: 'bold' }));
    cmds.push(text(150, y + 18, row[1], { size: 12.5, fill: '#5b6b7c' }));
  });
  return cmds;
}

function loopNestScene() {
  const cmds = [
    text(30, 40, '循环还能套循环：3 行 × 4 个格子', { size: 13, fill: '#1f6f5c', weight: 'bold' }),
    rect(300, 32, 130, 64, { rx: 10, fill: 'rgba(31,111,92,.10)', stroke: '#1f6f5c' }),
    text(312, 56, '重复 3 次 {', { size: 11.5, fill: '#1f6f5c' }),
    text(314, 74, '  重复 4 次 { 画格 }', { size: 11.5, fill: '#1f6f5c' }),
    text(312, 92, '}', { size: 11.5, fill: '#1f6f5c' })
  ];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    cmds.push(rect(30 + c * 52, 124 + r * 52, 46, 46, { rx: 6, fill: 'rgba(43,127,184,.14)', stroke: '#2b7fb8' }));
  }
  cmds.push(text(30, 278, '两个循环配合，就能画出整张网格。', { size: 12, fill: '#c98a1b' }));
  return cmds;
}

function loopBenefitScene() {
  return [
    text(30, 40, '为什么要用循环', { size: 13, fill: '#1f6f5c', weight: 'bold' }),
    rect(30, 76, 180, 90, { rx: 10, fill: 'rgba(194,86,111,.08)', stroke: '#c2566f' }),
    text(48, 104, '不用循环', { size: 13, fill: '#c2566f', weight: 'bold' }),
    text(48, 132, '写 100 遍', { size: 12, fill: '#5b6b7c' }),
    text(48, 154, '又长又容易错', { size: 12, fill: '#5b6b7c' }),
    rect(250, 76, 180, 90, { rx: 10, fill: 'rgba(31,111,92,.08)', stroke: '#1f6f5c' }),
    text(268, 104, '用循环', { size: 13, fill: '#1f6f5c', weight: 'bold' }),
    text(268, 132, '只写 3 行', { size: 12, fill: '#5b6b7c' }),
    text(268, 154, '改一次就全改', { size: 12, fill: '#5b6b7c' }),
    text(30, 212, '循环是"用更少代码做更多事"的关键。', { size: 12.5, fill: '#c98a1b' })
  ];
}

function featureEngineerScene() {
  return [
    text(30, 40, '特征工程：把原始数据变成好特征', { size: 13, fill: '#1f6f5c', weight: 'bold' }),
    rect(30, 76, 180, 72, { rx: 10, fill: 'rgba(36,48,68,.05)', stroke: 'rgba(36,48,68,.25)' }),
    text(48, 104, '原始数据', { size: 13, fill: '#243044', weight: 'bold' }),
    text(48, 128, '价格 9.9、重量 320g', { size: 11.5, fill: '#5b6b7c' }),
    text(48, 146, '颜色 0.7、形状 0.4', { size: 11.5, fill: '#5b6b7c' }),
    path('M216 112 H244', { stroke: '#c98a1b', width: 2.5 }),
    rect(250, 76, 180, 72, { rx: 10, fill: 'rgba(31,111,92,.08)', stroke: '#1f6f5c' }),
    text(268, 104, '好特征', { size: 13, fill: '#1f6f5c', weight: 'bold' }),
    text(268, 128, '单价 = 价格 ÷ 重量', { size: 11.5, fill: '#1f6f5c' }),
    text(268, 146, '综合 = 颜色 × 形状', { size: 11.5, fill: '#1f6f5c' }),
    text(30, 190, '选对特征，简单模型也能很准。', { size: 12.5, fill: '#c98a1b' })
  ];
}

function deepFeatureScene() {
  return [
    text(30, 40, '深度学习：特征让机器自己学', { size: 13, fill: '#7c5cd6', weight: 'bold' }),
    text(30, 68, '不用人手挑特征，网络一层层自动提取。', { size: 12.5, fill: '#5b6b7c' }),
    rect(40, 110, 96, 54, { rx: 8, fill: 'rgba(43,127,184,.12)', stroke: '#2b7fb8' }),
    text(58, 142, '浅层：边缘', { size: 12, fill: '#2b7fb8' }),
    path('M140 137 H166', { stroke: '#9aa8b6', width: 2 }),
    rect(170, 110, 96, 54, { rx: 8, fill: 'rgba(124,92,214,.12)', stroke: '#7c5cd6' }),
    text(186, 142, '中层：部件', { size: 12, fill: '#7c5cd6' }),
    path('M270 137 H296', { stroke: '#9aa8b6', width: 2 }),
    rect(300, 110, 120, 54, { rx: 8, fill: 'rgba(31,111,92,.12)', stroke: '#1f6f5c' }),
    text(320, 142, '深层：整体', { size: 12, fill: '#1f6f5c' }),
    text(30, 220, '这也是深度学习"强"的原因之一。', { size: 12.5, fill: '#c98a1b' })
  ];
}

/* ---------------- 第二轮补充：更多独立画面，让每个动画内容更丰富 ---------------- */
function mlTriad() {
  return [
    text(30, 40, '机器学习要三样东西', { size: 13, fill: '#1f6f5c', weight: 'bold' }),
    rect(30, 76, 118, 84, { rx: 10, fill: 'rgba(43,127,184,.10)', stroke: '#2b7fb8' }),
    text(48, 120, '数据', { size: 14, fill: '#2b7fb8', weight: 'bold' }),
    text(48, 146, '很多例子', { size: 11.5, fill: '#5b6b7c' }),
    rect(168, 76, 118, 84, { rx: 10, fill: 'rgba(201,138,27,.12)', stroke: '#c98a1b' }),
    text(186, 120, '算法', { size: 14, fill: '#c98a1b', weight: 'bold' }),
    text(186, 146, '找规律的公式', { size: 11.5, fill: '#5b6b7c' }),
    rect(306, 76, 124, 84, { rx: 10, fill: 'rgba(124,92,214,.12)', stroke: '#7c5cd6' }),
    text(324, 120, '算力', { size: 14, fill: '#7c5cd6', weight: 'bold' }),
    text(324, 146, '电脑来算', { size: 11.5, fill: '#5b6b7c' }),
    text(30, 212, '数据 + 算法 + 算力 = 一个 AI 模型', { size: 13, fill: '#c98a1b', weight: 'bold' })
  ];
}

function trainInfer() {
  return [
    text(30, 40, '训练和用起来，是两回事', { size: 13, fill: '#1f6f5c', weight: 'bold' }),
    rect(30, 78, 180, 92, { rx: 10, fill: 'rgba(31,111,92,.10)', stroke: '#1f6f5c' }),
    text(48, 108, '训练', { size: 14, fill: '#1f6f5c', weight: 'bold' }),
    text(48, 134, '给它答案，让它学', { size: 12, fill: '#5b6b7c' }),
    text(48, 156, '像平时做题学方法', { size: 12, fill: '#5b6b7c' }),
    rect(250, 78, 180, 92, { rx: 10, fill: 'rgba(43,127,184,.10)', stroke: '#2b7fb8' }),
    text(268, 108, '推理', { size: 14, fill: '#2b7fb8', weight: 'bold' }),
    text(268, 134, '没有答案，自己猜', { size: 12, fill: '#5b6b7c' }),
    text(268, 156, '像考试时独立答题', { size: 12, fill: '#5b6b7c' }),
    text(30, 224, '训练时看答案，使用时靠学到的规律。', { size: 12.5, fill: '#c98a1b' })
  ];
}

function aiApps() {
  const cmds = [text(30, 40, '机器视觉能做什么', { size: 13, fill: '#1f6f5c', weight: 'bold' })];
  [['📖', '认字'], ['🙂', '认脸'], ['🚗', '看路'], ['🩺', '看片子']].forEach((a, i) => {
    const x = 30 + i * 108, y = 78;
    cmds.push(rect(x, y, 92, 70, { rx: 12, fill: 'rgba(31,111,92,.08)', stroke: '#1f6f5c' }));
    cmds.push(text(x + 32, y + 40, a[0], { size: 28 }));
    cmds.push(text(x + 22, y + 62, a[1], { size: 12.5, fill: '#5b6b7c' }));
  });
  cmds.push(text(30, 196, '它们都先把图变成数字，再找规律。', { size: 12.5, fill: '#5b6b7c' }));
  cmds.push(text(30, 220, '但也会认错，所以不能只信机器。', { size: 12.5, fill: '#c98a1b' }));
  return cmds;
}

function visionLimit() {
  return [
    text(30, 40, '机器也会认错', { size: 13, fill: '#c2566f', weight: 'bold' }),
    rect(30, 76, 180, 90, { rx: 12, fill: 'rgba(194,86,111,.08)', stroke: '#c2566f' }),
    text(48, 100, '长得很像的两样东西', { size: 12, fill: '#5b6b7c' }),
    text(70, 142, '🐱 🐯', { size: 34 }),
    text(48, 158, '机器可能分不清', { size: 12, fill: '#c2566f' }),
    rect(250, 76, 180, 90, { rx: 12, fill: 'rgba(201,138,27,.10)', stroke: '#c98a1b' }),
    text(268, 100, '图片糊一点、角度变一点', { size: 12, fill: '#5b6b7c' }),
    text(268, 132, '也可能看走眼', { size: 12, fill: '#5b6b7c' }),
    text(30, 220, '所以 AI 是帮手，不是万能的眼睛。', { size: 12.5, fill: '#c98a1b' })
  ];
}

function grayColorScene() {
  return [
    text(30, 40, '灰度图 vs 彩色图', { size: 13, fill: '#2b7fb8', weight: 'bold' }),
    rect(40, 78, 150, 90, { rx: 10, fill: '#eee', stroke: '#9aa8b6' }),
    text(48, 118, '灰度', { size: 12, fill: '#243044' }),
    text(48, 142, '1 个数字', { size: 12, fill: '#8494a6' }),
    rect(250, 78, 170, 90, { rx: 10, fill: '#fff', stroke: '#c98a1b' }),
    text(258, 100, '彩色', { size: 12, fill: '#243044' }),
    text(258, 124, 'R G B 三个数字', { size: 12, fill: '#8494a6' }),
    text(258, 148, '能表示更多颜色', { size: 12, fill: '#8494a6' }),
    text(30, 212, '黑白只要记亮度，彩色要记颜色。', { size: 12.5, fill: '#c98a1b' })
  ];
}

function resolutionScene() {
  const cmds = [text(30, 40, '分辨率：像素越密越清楚', { size: 13, fill: '#1f6f5c', weight: 'bold' })];
  [0, 1].forEach(col => {
    const ox = 30 + col * 220;
    const size = col === 0 ? 44 : 22;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const v = (r + c) % 3 === 0 ? 70 : ((r + c) % 2 ? 150 : 210);
      cmds.push(rect(ox + c * size, 78 + r * size, size - 3, size - 3, { fill: 'rgb(' + v + ',' + v + ',' + v + ')' }));
    }
    cmds.push(text(ox, 78 + 4 * size + 16, col === 0 ? '像素少 → 模糊' : '像素多 → 清楚', { size: 11.5, fill: col === 0 ? '#c2566f' : '#1f6f5c' }));
  });
  cmds.push(text(30, 220, '同一张脸，像素越多越能看清。', { size: 12.5, fill: '#c98a1b' }));
  return cmds;
}

function videoScene() {
  const cmds = [text(30, 40, '视频，就是很快地翻图片', { size: 13, fill: '#7c5cd6', weight: 'bold' })];
  for (let i = 0; i < 5; i++) {
    const x = 30 + i * 84;
    cmds.push(rect(x, 82, 72, 72, { rx: 10, fill: 'rgba(43,127,184,.10)', stroke: '#2b7fb8' }));
    cmds.push(text(x + 20, 130, '🐱', { size: 30 }));
    if (i < 4) cmds.push(path('M' + (x + 74) + ' 118 L' + (x + 82) + ' 118', { stroke: '#9aa8b6', width: 2 }));
  }
  cmds.push(text(30, 190, '一秒钟翻 24 张，看起来就像在动。', { size: 12.5, fill: '#5b6b7c' }));
  cmds.push(text(30, 214, '机器"看"视频，就是在看一大堆图片。', { size: 12.5, fill: '#c98a1b' }));
  return cmds;
}

function convStride() {
  return [
    text(30, 40, '步长：窗口每次走几步', { size: 13, fill: '#7c5cd6', weight: 'bold' }),
    rect(40, 78, 150, 90, { rx: 10, fill: 'rgba(43,127,184,.08)', stroke: '#2b7fb8' }),
    text(56, 104, '步长 = 1', { size: 13, fill: '#2b7fb8', weight: 'bold' }),
    text(56, 132, '一次挪一格，', { size: 11.5, fill: '#5b6b7c' }),
    text(56, 152, '看得细、算得慢', { size: 11.5, fill: '#5b6b7c' }),
    rect(250, 78, 170, 90, { rx: 10, fill: 'rgba(201,138,27,.08)', stroke: '#c98a1b' }),
    text(266, 104, '步长 = 2', { size: 13, fill: '#c98a1b', weight: 'bold' }),
    text(266, 132, '一次跳两格，', { size: 11.5, fill: '#5b6b7c' }),
    text(266, 152, '快一点、略粗一点', { size: 11.5, fill: '#5b6b7c' }),
    text(30, 210, '步长小更精细，步长大更省时间。', { size: 12.5, fill: '#c98a1b' })
  ];
}

function convPadding() {
  return [
    text(30, 40, '补边：不让图片越缩越小', { size: 13, fill: '#7c5cd6', weight: 'bold' }),
    rect(40, 78, 150, 90, { rx: 10, fill: 'rgba(194,86,111,.08)', stroke: '#c2566f' }),
    text(56, 104, '不补边', { size: 13, fill: '#c2566f', weight: 'bold' }),
    text(56, 132, '每扫一层', { size: 11.5, fill: '#5b6b7c' }),
    text(56, 152, '图就变小一圈', { size: 11.5, fill: '#5b6b7c' }),
    rect(250, 78, 170, 90, { rx: 10, fill: 'rgba(31,111,92,.08)', stroke: '#1f6f5c' }),
    text(266, 104, '补一圈 0', { size: 13, fill: '#1f6f5c', weight: 'bold' }),
    text(266, 132, '扫完大小不变', { size: 11.5, fill: '#5b6b7c' }),
    text(266, 152, '边上信息也留住', { size: 11.5, fill: '#5b6b7c' }),
    text(30, 210, '补边能让网络叠得又深又不丢信息。', { size: 12.5, fill: '#c98a1b' })
  ];
}

function poolingScene() {
  return [
    text(30, 40, '池化：把图片压小一点', { size: 13, fill: '#7c5cd6', weight: 'bold' }),
    rect(40, 82, 120, 90, { rx: 10, fill: 'rgba(43,127,184,.10)', stroke: '#2b7fb8' }),
    text(56, 108, '原图 4×4', { size: 12, fill: '#2b7fb8' }),
    text(56, 132, '每 2×2 格', { size: 11.5, fill: '#5b6b7c' }),
    text(56, 152, '取最大的数', { size: 11.5, fill: '#5b6b7c' }),
    path('M180 126 H230', { stroke: '#c98a1b', width: 2.5 }),
    rect(250, 82, 120, 90, { rx: 10, fill: 'rgba(201,138,27,.10)', stroke: '#c98a1b' }),
    text(266, 108, '压成 2×2', { size: 12, fill: '#c98a1b' }),
    text(266, 132, '重要的特征', { size: 11.5, fill: '#5b6b7c' }),
    text(266, 152, '留了下来', { size: 11.5, fill: '#5b6b7c' }),
    text(30, 210, '池化让计算更快，也不容易过拟合。', { size: 12.5, fill: '#c98a1b' })
  ];
}

function featureSpaceScene() {
  return [
    text(30, 40, '每个点，就是一个样本的坐标', { size: 13, fill: '#2b7fb8', weight: 'bold' }),
    text(30, 72, '横轴 = 重量，纵轴 = 颜色深浅。', { size: 12.5, fill: '#5b6b7c' }),
    text(30, 98, '把样本画成点，就得到一张"特征图"。', { size: 12.5, fill: '#5b6b7c' }),
    ...scatterPoints(cloud(3, 18, [0.32, 0.34], [0.7, 0.68], 0.2)),
    text(36, 258, '重量 →', { size: 11.5, fill: '#8494a6' }),
    text(360, 258, '颜色 →', { size: 11.5, fill: '#8494a6' })
  ];
}

function nonlinearBoundary() {
  return [
    ...scatterPoints(cloud(7, 26, [0.5, 0.5], [0.5, 0.5], 0.7)),
    path('M60 40 Q240 120 180 200 T360 210', { stroke: '#c98a1b', width: 3, fill: 'none' }),
    text(150, 44, '有时候，直线分不开', { size: 13, fill: '#c98a1b', weight: 'bold' }),
    text(150, 70, '就要用弯弯的曲线来分', { size: 12.5, fill: '#5b6b7c' })
  ];
}

function confidenceScene() {
  return [
    text(30, 40, '离边界越近，越没把握', { size: 13, fill: '#c98a1b', weight: 'bold' }),
    text(30, 72, '边界附近的点，机器最容易犹豫。', { size: 12.5, fill: '#5b6b7c' }),
    line(30, 150, 430, 150, { stroke: '#c98a1b', width: 3, dash: '8 5' }),
    circle(100, 150, 9, { fill: '#2b7fb8', opacity: 0.45 }),
    circle(130, 150, 9, { fill: '#d4637f', opacity: 0.45 }),
    circle(300, 150, 9, { fill: '#2b7fb8' }),
    circle(360, 150, 9, { fill: '#d4637f' }),
    text(40, 210, '近：看不清属于哪边', { size: 12, fill: '#c2566f' }),
    text(260, 210, '远：比较有把握', { size: 12, fill: '#1f6f5c' })
  ];
}

function sgdScene() {
  return [
    text(30, 40, '随机梯度下降：一次只看一个点', { size: 13, fill: '#1f6f5c', weight: 'bold' }),
    path('M50 50 Q230 250 410 66', { stroke: '#7c5cd6', width: 3 }),
    circle(120, 104, 9, { fill: '#2b7fb8' }),
    circle(190, 170, 9, { fill: '#c98a1b' }),
    circle(280, 150, 9, { fill: '#1f6f5c' }),
    text(30, 236, '不用算全部点，每看一个点就挪一小步', { size: 12.5, fill: '#5b6b7c' }),
    text(30, 258, '数据很多时，这样又快又省。', { size: 12, fill: '#c98a1b' })
  ];
}

function localMinima() {
  const cmds = [text(30, 40, '小心：可能卡在"小坑"里', { size: 13, fill: '#c2566f', weight: 'bold' })];
  cmds.push(path('M40 60 Q130 200 170 150 T260 170 T360 60', { stroke: '#7c5cd6', width: 3, fill: 'none' }));
  cmds.push(circle(170, 148, 10, { fill: '#c2566f' }));
  cmds.push(circle(300, 130, 10, { fill: '#c98a1b' }));
  cmds.push(text(60, 220, '小坑 = 局部最低点', { size: 12, fill: '#c2566f' }));
  cmds.push(text(220, 220, '大坑 = 真正的最低点', { size: 12, fill: '#c98a1b' }));
  cmds.push(text(60, 250, '多试几次、换起点，能帮它找到更好的坑。', { size: 12, fill: '#8494a6' }));
  return cmds;
}

function trainValidSplit() {
  return [
    text(30, 40, '怎么知道它学会了？分两堆', { size: 13, fill: '#1f6f5c', weight: 'bold' }),
    rect(40, 80, 160, 90, { rx: 10, fill: 'rgba(31,111,92,.10)', stroke: '#1f6f5c' }),
    text(56, 108, '训练集', { size: 13, fill: '#1f6f5c', weight: 'bold' }),
    text(56, 134, '用来学', { size: 12, fill: '#5b6b7c' }),
    text(56, 154, '像平时练习', { size: 12, fill: '#5b6b7c' }),
    rect(250, 80, 160, 90, { rx: 10, fill: 'rgba(43,127,184,.10)', stroke: '#2b7fb8' }),
    text(266, 108, '验证集', { size: 13, fill: '#2b7fb8', weight: 'bold' }),
    text(266, 134, '用来考试', { size: 12, fill: '#5b6b7c' }),
    text(266, 154, '看会不会举一反三', { size: 12, fill: '#5b6b7c' }),
    text(30, 220, '考得好，才算真的学会。', { size: 12.5, fill: '#c98a1b' })
  ];
}

function crossValidate() {
  const cmds = [text(30, 40, '交叉验证：多考几次更靠谱', { size: 13, fill: '#1f6f5c', weight: 'bold' })];
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < 5; i++) {
      const x = 40 + i * 76, y = 80 + k * 46;
      const isTest = i === k;
      cmds.push(rect(x, y, 66, 32, { rx: 7, fill: isTest ? 'rgba(43,127,184,.22)' : 'rgba(31,111,92,.12)', stroke: isTest ? '#2b7fb8' : '#1f6f5c' }));
    }
    cmds.push(text(414, 102 + k * 46, '第' + (k + 1) + '次', { size: 11, fill: '#8494a6' }));
  }
  cmds.push(text(30, 236, '轮流拿一块当"考试题"，其余当"练习题"。', { size: 12.5, fill: '#c98a1b' }));
  return cmds;
}

function kmeansInit() {
  return [
    text(30, 40, '起点不一样，结果可能不一样', { size: 13, fill: '#c98a1b', weight: 'bold' }),
    rect(40, 80, 170, 90, { rx: 10, fill: 'rgba(194,86,111,.08)', stroke: '#c2566f' }),
    text(56, 108, '起点 A', { size: 13, fill: '#c2566f', weight: 'bold' }),
    text(56, 134, '最后分成 2 组', { size: 12, fill: '#5b6b7c' }),
    text(56, 154, '但不太自然', { size: 12, fill: '#5b6b7c' }),
    rect(250, 80, 170, 90, { rx: 10, fill: 'rgba(31,111,92,.08)', stroke: '#1f6f5c' }),
    text(266, 108, '起点 B', { size: 13, fill: '#1f6f5c', weight: 'bold' }),
    text(266, 134, '同样分 2 组', { size: 12, fill: '#5b6b7c' }),
    text(266, 154, '却更自然', { size: 12, fill: '#5b6b7c' }),
    text(30, 220, '所以常多跑几次，挑最好的那一次。', { size: 12.5, fill: '#c98a1b' })
  ];
}

function elbowScene() {
  const cmds = [
    text(30, 40, '怎么选 K？看"手肘"', { size: 13, fill: '#c98a1b', weight: 'bold' }),
    line(46, 210, 400, 210, { stroke: 'rgba(36,48,68,.25)' }),
    line(46, 40, 46, 210, { stroke: 'rgba(36,48,68,.25)' }),
    path('M80 190 Q150 120 200 96 Q240 84 380 76', { stroke: '#2b7fb8', width: 3, fill: 'none' }),
    text(200, 70, '拐弯处就是"肘部"', { size: 12.5, fill: '#c98a1b' }),
    text(360, 236, 'K 越大', { size: 11.5, fill: '#8494a6' })
  ];
  [[80, 190], [150, 118], [200, 96], [260, 86], [320, 80], [380, 76]].forEach(p => cmds.push(circle(p[0], p[1], 6, { fill: '#2b7fb8' })));
  return cmds;
}

function attentionScene() {
  return [
    text(30, 40, '注意力：机器知道该看哪里', { size: 13, fill: '#7c5cd6', weight: 'bold' }),
    rect(40, 80, 180, 90, { rx: 10, fill: 'rgba(36,48,68,.05)', stroke: 'rgba(36,48,68,.25)' }),
    text(56, 104, '"请把窗户关上"', { size: 12, fill: '#243044' }),
    text(56, 132, '预测下一个词时', { size: 12, fill: '#5b6b7c' }),
    text(56, 154, '重点看"关上"', { size: 12, fill: '#5b6b7c' }),
    rect(250, 80, 170, 90, { rx: 10, fill: 'rgba(124,92,214,.12)', stroke: '#7c5cd6' }),
    text(266, 108, '注意力', { size: 13, fill: '#7c5cd6', weight: 'bold' }),
    text(266, 134, '给相关的词', { size: 12, fill: '#5b6b7c' }),
    text(266, 154, '更高的权重', { size: 12, fill: '#5b6b7c' }),
    text(30, 220, '这样它就不会被不重要的词带跑。', { size: 12.5, fill: '#c98a1b' })
  ];
}

function generationLoop() {
  return [
    text(30, 40, '一句话，是这样"长"出来的', { size: 13, fill: '#1f6f5c', weight: 'bold' }),
    rect(40, 82, 86, 40, { rx: 9, fill: 'rgba(31,111,92,.10)', stroke: '#1f6f5c' }),
    text(52, 108, '请', { size: 14, fill: '#1f6f5c' }),
    path('M130 102 H150', { stroke: '#9aa8b6', width: 2 }),
    rect(154, 82, 86, 40, { rx: 9, fill: 'rgba(31,111,92,.10)', stroke: '#1f6f5c' }),
    text(166, 108, '请把', { size: 14, fill: '#1f6f5c' }),
    path('M244 102 H264', { stroke: '#9aa8b6', width: 2 }),
    rect(268, 82, 112, 40, { rx: 9, fill: 'rgba(31,111,92,.16)', stroke: '#1f6f5c' }),
    text(280, 108, '请把窗户', { size: 14, fill: '#1f6f5c' }),
    text(30, 170, '每生成一个词，就把它接到句尾，', { size: 12.5, fill: '#5b6b7c' }),
    text(30, 194, '再根据新句子继续猜下一个词。', { size: 12.5, fill: '#5b6b7c' }),
    text(30, 230, '这就是"一个字一个字往外蹦"的原理。', { size: 12.5, fill: '#c98a1b' })
  ];
}

function distScene() {
  const cmds = [text(30, 40, '先看：每个词都有个"可能性"', { size: 13, fill: '#2b7fb8', weight: 'bold' })];
  const cands = [{ w: '小', p: 0.36 }, { w: '老', p: 0.27 }, { w: '神', p: 0.18 }, { w: '快乐的', p: 0.11 }, { w: '会说话的', p: 0.08 }];
  cands.forEach((c, i) => {
    const y = 78 + i * 34;
    cmds.push(text(30, y + 16, c.w, { size: 12.5, fill: '#243044' }));
    cmds.push(rect(130, y + 2, Math.max(8, c.p * 250), 20, { rx: 6, fill: '#2b7fb8', opacity: 0.85 }));
    cmds.push(text(390, y + 16, (c.p * 100).toFixed(0) + '%', { size: 11.5, fill: '#8494a6' }));
  });
  cmds.push(text(30, 254, '把所有可能性加在一起，正好是 100%。', { size: 12, fill: '#c98a1b' }));
  return cmds;
}

function sampleScene() {
  return [
    text(30, 40, '按概率"抽签"选下一个词', { size: 13, fill: '#2b7fb8', weight: 'bold' }),
    text(30, 72, '不是每次都选最大的，而是按比例随机挑。', { size: 12.5, fill: '#5b6b7c' }),
    rect(40, 108, 140, 64, { rx: 10, fill: 'rgba(31,111,92,.12)', stroke: '#1f6f5c' }),
    text(52, 136, '可能性大', { size: 12, fill: '#1f6f5c' }),
    text(52, 158, '被选中的机会大', { size: 11.5, fill: '#5b6b7c' }),
    rect(250, 108, 160, 64, { rx: 10, fill: 'rgba(194,86,111,.10)', stroke: '#c2566f' }),
    text(262, 136, '可能性小', { size: 12, fill: '#c2566f' }),
    text(262, 158, '偶尔也会被选中', { size: 11.5, fill: '#5b6b7c' }),
    text(30, 214, '正因为会"抽签"，同一问题才可能有不同答案。', { size: 12.5, fill: '#c98a1b' })
  ];
}

function zeroTemp() {
  const cmds = [text(30, 40, '温度 = 0：永远选最可能的', { size: 13, fill: '#1f6f5c', weight: 'bold' })];
  const cands = [{ w: '小', p: 0.36 }, { w: '老', p: 0.27 }, { w: '神', p: 0.18 }];
  cands.forEach((c, i) => {
    const y = 84 + i * 42;
    cmds.push(rect(40, y, 200, 30, { rx: 7, fill: i === 0 ? 'rgba(31,111,92,.20)' : 'rgba(36,48,68,.05)', stroke: i === 0 ? '#1f6f5c' : 'rgba(36,48,68,.15)' }));
    cmds.push(text(54, y + 20, c.w + '（' + (c.p * 100).toFixed(0) + '%）', { size: 12.5, fill: i === 0 ? '#1f6f5c' : '#8494a6' }));
  });
  cmds.push(text(270, 100, '每次都选', { size: 12.5, fill: '#5b6b7c' }));
  cmds.push(text(270, 124, '「小」这一个词', { size: 12.5, fill: '#5b6b7c' }));
  cmds.push(text(30, 228, '结果很稳定，但少了点惊喜和创意。', { size: 12.5, fill: '#c98a1b' }));
  return cmds;
}

function biasCollect() {
  return [
    text(30, 40, '偏见从哪里来：先看收集', { size: 13, fill: '#c2566f', weight: 'bold' }),
    text(30, 74, '如果只拍白天、只拍城里，', { size: 12.5, fill: '#5b6b7c' }),
    text(30, 98, '收集到的照片就"偏心"了。', { size: 12.5, fill: '#5b6b7c' }),
    rect(40, 130, 170, 66, { rx: 10, fill: 'rgba(43,127,184,.12)', stroke: '#2b7fb8' }),
    text(56, 158, '白天照片：很多', { size: 12, fill: '#2b7fb8' }),
    text(56, 180, '🌞🌞🌞🌞🌞🌞', { size: 13, fill: '#c98a1b' }),
    rect(250, 130, 170, 66, { rx: 10, fill: 'rgba(194,86,111,.10)', stroke: '#c2566f' }),
    text(266, 158, '夜间照片：很少', { size: 12, fill: '#c2566f' }),
    text(266, 180, '🌙', { size: 13, fill: '#5b6b7c' }),
    text(30, 234, '数据一开始就不平衡，模型自然跟着偏。', { size: 12.5, fill: '#c98a1b' })
  ];
}

function biasLabel() {
  return [
    text(30, 40, '偏见也来自"打标签的人"', { size: 13, fill: '#c2566f', weight: 'bold' }),
    text(30, 76, '如果标数据的人带着偏见，', { size: 12.5, fill: '#5b6b7c' }),
    text(30, 100, '标签就会把偏见写进去。', { size: 12.5, fill: '#5b6b7c' }),
    rect(40, 138, 380, 48, { rx: 10, fill: 'rgba(194,86,111,.08)', stroke: '#c2566f' }),
    text(58, 160, '同样一张图，一个人标"微笑"，', { size: 12.5, fill: '#243044' }),
    text(58, 180, '另一个人标"严肃"', { size: 12.5, fill: '#243044' }),
    text(30, 226, '标得越主观，机器学到的偏见就越多。', { size: 12.5, fill: '#c98a1b' })
  ];
}

function fairEval() {
  return [
    text(30, 40, '要公平，就要分开检查', { size: 13, fill: '#1f6f5c', weight: 'bold' }),
    rect(40, 80, 180, 72, { rx: 10, fill: 'rgba(31,111,92,.08)', stroke: '#1f6f5c' }),
    text(56, 108, '总体准确率 90%', { size: 12.5, fill: '#1f6f5c' }),
    text(56, 134, '看起来不错', { size: 11.5, fill: '#5b6b7c' }),
    rect(250, 80, 180, 72, { rx: 10, fill: 'rgba(194,86,111,.08)', stroke: '#c2566f' }),
    text(266, 108, '但某群体只有 55%', { size: 12.5, fill: '#c2566f' }),
    text(266, 134, '就藏住了问题', { size: 11.5, fill: '#5b6b7c' }),
    text(30, 210, '要分组看每个群体的表现，才叫公平。', { size: 12.5, fill: '#c98a1b' })
  ];
}

function loopVar() {
  const cmds = [
    text(30, 40, '循环里常有个"计数器"', { size: 13, fill: '#1f6f5c', weight: 'bold' }),
    rect(300, 32, 140, 76, { rx: 10, fill: 'rgba(31,111,92,.10)', stroke: '#1f6f5c' }),
    text(312, 56, '重复 i = 1 到 5', { size: 11.5, fill: '#1f6f5c' }),
    text(312, 74, '每次 i 加 1', { size: 11.5, fill: '#1f6f5c' }),
    text(312, 92, '做完 5 次就停', { size: 11.5, fill: '#1f6f5c' })
  ];
  for (let k = 1; k <= 5; k++) {
    cmds.push(circle(40 + (k - 1) * 40, 140, 14, { fill: 'rgba(43,127,184,.16)', stroke: '#2b7fb8' }));
    cmds.push(text(34 + (k - 1) * 40, 145, String(k), { size: 12, fill: '#2b7fb8' }));
  }
  cmds.push(text(30, 210, '计数器让机器知道"做到第几次了"。', { size: 12.5, fill: '#c98a1b' }));
  return cmds;
}

function infiniteLoop() {
  return [
    text(30, 40, '没有停止条件，就会一直转', { size: 13, fill: '#c2566f', weight: 'bold' }),
    circle(120, 140, 46, { fill: 'rgba(194,86,111,.10)', stroke: '#c2566f' }),
    text(88, 146, '重复', { size: 14, fill: '#c2566f' }),
    path('M168 168 C210 210 290 210 320 168 C350 120 290 70 240 96', { stroke: '#c2566f', width: 3, fill: 'none' }),
    text(240, 130, '忘了停下', { size: 12.5, fill: '#c2566f' }),
    text(30, 220, '所以要写清"什么时候停"（退出条件）。', { size: 12.5, fill: '#c98a1b' })
  ];
}

function featureScale() {
  return [
    text(30, 40, '特征数值差太大，要先"拉平"', { size: 13, fill: '#1f6f5c', weight: 'bold' }),
    rect(40, 80, 170, 72, { rx: 10, fill: 'rgba(194,86,111,.08)', stroke: '#c2566f' }),
    text(56, 108, '重量：300 克', { size: 12.5, fill: '#c2566f' }),
    text(56, 132, '颜色：0.7', { size: 12.5, fill: '#c2566f' }),
    path('M216 116 H244', { stroke: '#c98a1b', width: 2.5 }),
    rect(250, 80, 170, 72, { rx: 10, fill: 'rgba(31,111,92,.08)', stroke: '#1f6f5c' }),
    text(266, 108, '都缩到 0~1', { size: 12.5, fill: '#1f6f5c' }),
    text(266, 132, '两个特征一样重要', { size: 12.5, fill: '#1f6f5c' }),
    text(30, 206, '否则数值大的特征会"抢戏"。', { size: 12.5, fill: '#c98a1b' })
  ];
}

function featureDim() {
  return [
    text(30, 40, '特征越多，不一定越好', { size: 13, fill: '#c98a1b', weight: 'bold' }),
    rect(40, 80, 130, 72, { rx: 10, fill: 'rgba(31,111,92,.08)', stroke: '#1f6f5c' }),
    text(56, 108, '2 个特征', { size: 12.5, fill: '#1f6f5c' }),
    text(56, 132, '清楚、好懂', { size: 11.5, fill: '#5b6b7c' }),
    rect(240, 80, 190, 72, { rx: 10, fill: 'rgba(194,86,111,.08)', stroke: '#c2566f' }),
    text(256, 108, '100 个特征', { size: 12.5, fill: '#c2566f' }),
    text(256, 132, '又多又乱、还慢', { size: 11.5, fill: '#5b6b7c' }),
    text(30, 206, '要挑有用、相关的特征，去掉噪声。', { size: 12.5, fill: '#c98a1b' })
  ];
}

function featureSelect() {
  const cmds = [text(30, 40, '怎么挑特征：找"最有用"的', { size: 13, fill: '#1f6f5c', weight: 'bold' })];
  [['重量', '跟大小强相关 ✓'], ['颜色', '能分开两类 ✓'], ['购买日期', '和类别无关 ✗'], ['卖家名字', '等于噪声 ✗']].forEach((row, i) => {
    const y = 76 + i * 46, good = row[1].indexOf('✓') >= 0;
    cmds.push(rect(40, y, 380, 36, { rx: 9, fill: good ? 'rgba(31,111,92,.08)' : 'rgba(194,86,111,.08)', stroke: good ? '#1f6f5c' : '#c2566f' }));
    cmds.push(text(56, y + 24, row[0], { size: 12.5, fill: '#243044', weight: 'bold' }));
    cmds.push(text(160, y + 24, row[1], { size: 12, fill: good ? '#1f6f5c' : '#c2566f' }));
  });
  cmds.push(text(30, 270, '留下相关、能区分的好特征。', { size: 12.5, fill: '#c98a1b' }));
  return cmds;
}

/* ================= 动画清单 ================= */
const ANIMATIONS = [
  {
    id: 'what-is-ai', title: '机器是怎么「看见」的', emoji: '🤖', topicId: 'ai-what',
    desc: '同一张图，人一眼就懂，机器要一步步算。看完就知道 AI 不是魔法。',
    speed: 1700,
    phases: [
      { caption: '人看图片：一眼认出「这是一只猫」，快到感觉不到思考。', cmds: whatIsAI(0) },
      { caption: '机器没有眼睛，它"看"到的是一堆数字。', cmds: whatIsAI(1) },
      { caption: '第一步：扫描哪里"亮变暗"，找到物体的边缘。', cmds: whatIsAI(2) },
      { caption: '第二步：把边缘一层层拼成形状，认出是猫。', cmds: whatIsAI(3) },
      { caption: '第三步：看过海量猫照片后，它自己总结出"猫"的规律。', cmds: whatIsAI(4) },
      { caption: '机器学习要三样东西：数据、算法、算力。', cmds: mlTriad() },
      { caption: '训练和用起来是两回事：训练看答案，使用时自己猜。', cmds: trainInfer() },
      { caption: '机器视觉还能认字、认脸、看路、看医疗片子。', cmds: aiApps() },
      { caption: '但机器也会认错，它是帮手，不是万能的眼睛。', cmds: visionLimit() }
    ]
  },
  {
    id: 'pixel-matrix', title: '图片在机器眼里是什么', emoji: '🔢', topicId: 'vision-image',
    desc: '同一张图放大后是小方块，每个方块对应一个亮度数字。',
    speed: 1600,
    phases: [
      { caption: '把图切成一个个小方块，每个方块叫一个像素。', cmds: pixelGrid(6, 26, 30, 30, false) },
      { caption: '每个像素记一个 0~255 的数字，越大越亮。', cmds: pixelGrid(6, 26, 30, 30, true) },
      { caption: '整张图就变成了一张数字表 —— 机器只认识数字。', cmds: [
        rect(24, 26, 176, 176, { fill: 'rgba(43,127,184,.08)', stroke: '#2b7fb8', rx: 10 }),
        text(36, 226, '6×6 的像素矩阵', { size: 13, fill: '#2b7fb8', weight: 'bold' }),
        text(226, 60, '真实照片有上千万个像素，', { size: 13, fill: '#5b6b7c' }),
        text(226, 84, '所以机器"看"图，其实就是', { size: 13, fill: '#5b6b7c' }),
        text(226, 108, '在算一大堆数字。', { size: 13, fill: '#5b6b7c' }),
        text(226, 156, '像素值越大 → 这里越亮', { size: 12.5, fill: '#c98a1b' })
      ] },
      { caption: '彩色照片更精细：一个像素要记 R、G、B 三个数字。', cmds: rgbScene() },
      { caption: '把照片放大，看到的就是一格一格的像素。', cmds: mosaicScene() },
      { caption: '灰度图只记亮度，彩色图要记 R、G、B 三个数字。', cmds: grayColorScene() },
      { caption: '分辨率就是像素密度：像素越密，画面越清楚。', cmds: resolutionScene() },
      { caption: '视频，其实是一秒钟快速翻很多张图片。', cmds: videoScene() }
    ]
  },
  {
    id: 'conv-edge', title: '卷积：机器看图的小窗口', emoji: '🪟', topicId: 'vision-image',
    desc: '一个 3×3 的小窗口在图上滑动，找出边缘 —— 卷积网络的基本动作。',
    speed: 1300,
    phases: [
      { caption: '卷积核是一个 3×3 的小窗口，从图的左上角开始滑动。', cmds: conv(0, 0, false) },
      { caption: '窗口里正好是「亮转暗」的突变，输出值很大 —— 检测到边缘了。', cmds: conv(3, 2, false) },
      { caption: '滑完整张图得到一张「特征图」，亮的地方就是原图的边缘。', cmds: conv(0, 0, true) },
      { caption: '多层叠加：浅层看边缘，中层看部件，深层看整体。', cmds: [
        rect(24, 60, 96, 90, { fill: 'rgba(43,127,184,.10)', stroke: '#2b7fb8', rx: 12 }),
        text(58, 112, '边缘', { size: 14, fill: '#2b7fb8' }),
        path('M124 105 H152', { stroke: '#9aa8b6', width: 2 }),
        rect(156, 60, 96, 90, { fill: 'rgba(124,92,214,.12)', stroke: '#7c5cd6', rx: 12 }),
        text(190, 112, '部件', { size: 14, fill: '#7c5cd6' }),
        path('M256 105 H284', { stroke: '#9aa8b6', width: 2 }),
        rect(288, 60, 116, 90, { fill: 'rgba(31,111,92,.12)', stroke: '#1f6f5c', rx: 12 }),
        text(324, 112, '物体', { size: 14, fill: '#1f6f5c' }),
        text(24, 200, '越往深层，看到的东西越"整体"。', { size: 13, fill: '#c98a1b' })
      ] },
      { caption: '这个 3×3 窗口本质是一组数字，专门检测"亮度突变"。', cmds: convKernel() },
      { caption: '一层网络会放很多个卷积核，各自找不同的图案。', cmds: multiKernel() },
      { caption: '步长决定窗口每次走几步：小步精细，大步省时。', cmds: convStride() },
      { caption: '补边能防止图片每扫一层就缩小一圈。', cmds: convPadding() },
      { caption: '池化把图片压小，留下最重要的特征。', cmds: poolingScene() }
    ]
  },
  {
    id: 'decision-boundary', title: '决策边界：分界线画在哪', emoji: '🎯', topicId: 'ml-supervised',
    desc: '可交互：拖动分界线，实时看两个类别被分错几个。',
    speed: 1500, interactive: 'boundary',
    phases: [
      { caption: '两种数据点混在平面上，模型要找一条线把它们分开。', cmds: boundary(0.5, false) },
      { caption: '分界线不是「穿过所有点」，而是让两边的错误都尽量少。', cmds: boundary(0.5, true) },
      { caption: '边界太靠下：蓝色点被分错很多。', cmds: boundary(0.18, true) },
      { caption: '边界太靠上：粉色点被分错很多。', cmds: boundary(0.82, true) },
      { caption: '换个角度看：每个点其实就是一个样本的特征坐标。', cmds: featureSpaceScene() },
      { caption: '如果直线分不开，就用弯弯的曲线来分。', cmds: nonlinearBoundary() },
      { caption: '离边界越近，机器越没把握。', cmds: confidenceScene() }
    ]
  },
  {
    id: 'gradient-descent', title: '梯度下降：一步步减小误差', emoji: '📉', topicId: 'ml-what',
    desc: '以预测房价为例，看模型怎样一步步减小误差 —— 机器学习的核心动作。',
    speed: 1600,
    phases: [
      { caption: '先猜一条线。猜错没关系，关键是知道错多少。', cmds: linfit(0.34, 0.72, false) },
      { caption: '把每个点的误差竖着画出来，误差越大说明线越差。', cmds: linfit(0.34, 0.72, true) },
      { caption: '所有误差加起来就是「损失」，训练的目标是让它尽量小。', cmds: lossCurve(0.9, false) },
      { caption: '沿着曲线往下挪一小步，参数就变好一点 —— 这就是梯度下降。', cmds: lossCurve(0.58, true) },
      { caption: '重复很多次，损失越来越小，模型就「学会」了。', cmds: linfit(0.86, 0.74, false) },
      { caption: '步长（学习率）太小：走得慢，训练要很久。', cmds: learnRate('small') },
      { caption: '步长太大：来回跳，可能错过最低点。', cmds: learnRate('big') },
      { caption: '步长适中：又快又稳地滑向最低点。', cmds: learnRate('ok') },
      { caption: '数据很多时，可以一次只看一个点，这叫随机梯度下降。', cmds: sgdScene() },
      { caption: '下降时可能卡在"小坑"里，要多试几次。', cmds: localMinima() }
    ]
  },
  {
    id: 'overfit', title: '过拟合：背题不等于学会', emoji: '📐', topicId: 'ml-eval',
    desc: '同一组数据，简单曲线与弯曲曲线分别拟合，看谁在新数据上更准。',
    speed: 1600,
    phases: [
      { caption: '六个训练样本（蓝点）。任务是找一条能预测新样本的曲线。', cmds: overfit(0) },
      { caption: '太简单的模型（直线）：训练都不够准，这叫欠拟合。', cmds: overfit(1) },
      { caption: '太复杂的模型：每个训练点都穿过，但这叫过拟合。', cmds: overfit(2) },
      { caption: '来了三个新样本（黄点）：弯曲曲线的预测明显更差。', cmds: overfit(3) },
      { caption: '结论：训练成绩好不等于有真本事，要看没见过的新数据。', cmds: [
        rect(30, 50, 170, 110, { fill: 'rgba(194,86,111,.10)', stroke: '#c2566f', rx: 12 }),
        text(48, 80, '训练集 100 分', { size: 13, fill: '#c2566f' }),
        text(48, 106, '测试集 58 分', { size: 13, fill: '#c2566f' }),
        text(48, 138, '→ 过拟合', { size: 12.5, fill: '#c98a1b' }),
        rect(238, 50, 170, 110, { fill: 'rgba(31,111,92,.10)', stroke: '#1f6f5c', rx: 12 }),
        text(256, 80, '训练集 86 分', { size: 13, fill: '#1f6f5c' }),
        text(256, 106, '测试集 84 分', { size: 13, fill: '#1f6f5c' }),
        text(256, 138, '→ 泛化良好', { size: 12.5, fill: '#c98a1b' }),
        text(30, 206, '对策：更多数据、正则化、早停、降低模型复杂度', { size: 12.5, fill: '#5b6b7c' })
      ] },
      { caption: '三种常用对策：更多数据、正则化、早停。', cmds: overfitFixScene() },
      { caption: '把数据分成"练习"和"考试"两堆，考得好才算学会。', cmds: trainValidSplit() },
      { caption: '交叉验证：轮流拿一块当考题，多考几次更靠谱。', cmds: crossValidate() }
    ]
  },
  {
    id: 'kmeans', title: '聚类：没有答案时自己找规律', emoji: '🧩', topicId: 'ml-cluster',
    desc: 'K-means 的迭代过程：随机选中心 → 分配 → 移动中心 → 重复。',
    speed: 1500,
    phases: [
      { caption: '一堆没有标签的数据点，我们不知道它们属于哪一类。', cmds: kmeansScene(null, 0) },
      { caption: '随机放两个中心点，把每个点分给离它最近的中心。', cmds: kmeansScene([[0.26, 0.74], [0.74, 0.28]], 0) },
      { caption: '把中心点移到本组的平均位置 —— 这是第 1 轮迭代。', cmds: kmeansScene([[0.3, 0.36], [0.68, 0.66]], 1) },
      { caption: '再分配、再移动，中心几乎不动了，聚类完成。', cmds: kmeansScene([[0.31, 0.34], [0.69, 0.67]], 2) },
      { caption: '分完组后由人来解释含义 —— 机器只会算距离，不懂意义。', cmds: [
        circle(110, 100, 42, { fill: 'rgba(43,127,184,.18)', stroke: '#2b7fb8' }),
        text(88, 106, '组 1', { size: 14, fill: '#2b7fb8' }),
        text(36, 176, '≈ 每周常买蔬菜的家庭', { size: 12.5, fill: '#5b6b7c' }),
        circle(320, 140, 42, { fill: 'rgba(212,99,127,.18)', stroke: '#d4637f' }),
        text(298, 146, '组 2', { size: 14, fill: '#d4637f' }),
        text(250, 216, '≈ 常买婴儿用品的家庭', { size: 12.5, fill: '#5b6b7c' }),
        text(30, 252, '聚类结果需要人来命名与使用', { size: 12.5, fill: '#c98a1b' })
      ] },
      { caption: 'K 的值需要人来定：K=2 和 K=3 会得到完全不同的分组。', cmds: kValueScene() },
      { caption: '起点不同，结果可能不同，所以常多跑几次挑最好的。', cmds: kmeansInit() },
      { caption: '怎么选 K？画一条误差曲线，找"手肘"拐点。', cmds: elbowScene() }
    ]
  },
  {
    id: 'tokenize', title: '机器怎么读懂一句话', emoji: '💬', topicId: 'lang-nlp',
    desc: '把句子切成词元、变成数字、再预测下一个词 —— 语言模型的基本流程。',
    speed: 1500,
    phases: [
      { caption: '原始句子：「请把窗户关上，风有点大」。', cmds: token(0) },
      { caption: '第一步：分词，把句子切成一个个可处理的单元。', cmds: token(1) },
      { caption: '第二步：每个词映射成一串数字（词向量）。', cmds: token(2) },
      { caption: '第三步：模型根据前面的词，预测下一个最可能的词。', cmds: token(3) },
      { caption: '大语言模型就是这样：一个词一个词地预测并生成。', cmds: [
        rect(24, 40, 412, 40, { fill: 'rgba(43,127,184,.10)', stroke: '#2b7fb8', rx: 10 }),
        text(38, 66, '"请 把 窗户 关上 ， 风 有 点 大"', { size: 14, fill: '#243044' }),
        path('M230 80 V104', { stroke: '#9aa8b6', width: 2 }),
        rect(24, 104, 190, 46, { fill: 'rgba(124,92,214,.12)', stroke: '#7c5cd6', rx: 10 }),
        text(70, 133, '语言模型', { size: 14, fill: '#7c5cd6' }),
        path('M214 127 H248', { stroke: '#9aa8b6', width: 2 }),
        rect(248, 104, 188, 46, { fill: 'rgba(31,111,92,.12)', stroke: '#1f6f5c', rx: 10 }),
        text(276, 133, '→ 我 来 关 上', { size: 14, fill: '#1f6f5c' }),
        text(24, 200, '它不是在"查答案"，而是在算概率、逐词生成。', { size: 12.5, fill: '#c98a1b' }),
        text(24, 226, '所以它可能编出看似合理但错误的内容。', { size: 12.5, fill: '#c98a1b' })
      ] },
      { caption: '词元切多大是取舍：按字、按词，还是折中的"子词"。', cmds: tokenChoiceScene() },
      { caption: '注意力机制：让机器知道一句话里该重点看哪个词。', cmds: attentionScene() },
      { caption: '一句话是一个词一个词"长"出来的。', cmds: generationLoop() }
    ]
  },
  {
    id: 'temperature', title: '温度：为什么同一问题答案不同', emoji: '🌡️', topicId: 'gen-llm',
    desc: '可交互：拖动滑杆改变温度，看候选词的挑中概率怎么变化。',
    speed: 1400, interactive: 'temperature',
    phases: [
      { caption: '模型对每个候选词都有一个概率，温度决定它有多「敢」选小概率的词。', cmds: tempScene(0.7) },
      { caption: '温度低：几乎总挑概率最高的词，答案稳定但有点死板。', cmds: tempScene(0.2) },
      { caption: '温度高：小概率词也敢选，更有创意但容易跑题。', cmds: tempScene(1.3) },
      { caption: '先看每个词都有一个"可能性"（概率）。', cmds: distScene() },
      { caption: '按概率"抽签"选词，所以同一问题答案可能不同。', cmds: sampleScene() },
      { caption: '温度调到 0，就永远选最可能的词，稳定但少了创意。', cmds: zeroTemp() }
    ]
  },
  {
    id: 'bias-data', title: '偏见是怎么被学到的', emoji: '⚖️', topicId: 'ethics-fair',
    desc: '可交互：切换不平衡与均衡的数据集，看两个群体的准确率变化。',
    speed: 1500, interactive: 'bias',
    phases: [
      { caption: '训练数据里谁多谁少，直接决定模型对谁更准。', cmds: biasScene('biased') },
      { caption: '把数据补齐之后，两个群体的表现就接近了。', cmds: biasScene('balanced') },
      { caption: '偏见不是机器发明的，它只是从数据里学到了偏见。', cmds: biasCauseScene() },
      { caption: '对策：补足数据、换指标、分群体评估，减少偏见。', cmds: biasFixScene() },
      { caption: '偏见来源一：收集数据时就不平衡。', cmds: biasCollect() },
      { caption: '偏见来源二：打标签的人也可能带偏见。', cmds: biasLabel() },
      { caption: '要公平，就要分组检查每个群体的表现。', cmds: fairEval() }
    ]
  },
  {
    id: 'algo-loop', title: '循环：让机器人自己走', emoji: '🔁', topicId: 'algo-flow',
    desc: '同一段指令，用「重复」写只要三行，效果却和十行一样。',
    speed: 1300,
    phases: [
      { caption: '机器人要从左下角走到右上角的星星，每次只能走一格。', cmds: maze([{ x: 0, y: 5 }], '起点在这里', false) },
      { caption: '笨办法：一步一步写十条「向前走」，又长又容易错。', cmds: maze([{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }], '写十条太累', false) },
      { caption: '聪明办法：「重复 10 次 { 向前走 }」，三行就够了。', cmds: maze([{ x: 0, y: 5 }, { x: 2, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 4 }], '循环 = 重复执行', true) },
      { caption: '再加一个条件：「如果前面是墙就转弯」，它就能自己走通迷宫。', cmds: maze([{ x: 4, y: 4 }, { x: 5, y: 3 }, { x: 5, y: 2 }, { x: 5, y: 1 }, { x: 5, y: 0 }], '条件让它会看情况办事', true) },
      { caption: '循环还能套循环：两重循环一次画出整张网格。', cmds: loopNestScene() },
      { caption: '循环让代码更短、更好改，是编程里最重要的思想之一。', cmds: loopBenefitScene() },
      { caption: '循环里常有个计数器，记录做到第几次了。', cmds: loopVar() },
      { caption: '没有停止条件，循环就会一直转，这叫死循环。', cmds: infiniteLoop() }
    ]
  },
  {
    id: 'data-feature', title: '特征：机器靠什么分辨', emoji: '📊', topicId: 'data-what',
    desc: '用两个特征把水果分开，理解「特征选得好，模型才准」。',
    speed: 1500,
    phases: [
      { caption: '每个水果都有「重量」和「颜色深浅」两个特征。', cmds: scatter1(false) },
      { caption: '只看重量：大部分能分开，但中间有重叠，会分错。', cmds: scatter1(true) },
      { caption: '加上颜色之后，画一条斜线就能分得更干净。', cmds: [
        ...scatterPoints(cloud(3, 16, [0.32, 0.34], [0.7, 0.68], 0.2)),
        path('M40 50 L400 220', { stroke: '#1f6f5c', width: 3, dash: '7 5' }),
        text(150, 128, '这条线叫"决策边界"', { size: 13, fill: '#1f6f5c', weight: 'bold' }),
        text(150, 152, '（分类器学到的规律）', { size: 12, fill: '#1f6f5c' }),
        text(36, 258, '重量 →', { size: 11.5, fill: '#8494a6' }),
        text(360, 258, '颜色深浅 →', { size: 11.5, fill: '#8494a6' })
      ] },
      { caption: '特征选得好，模型又快又准；特征选错了，模型再强也没用。', cmds: [
        rect(24, 40, 190, 150, { fill: 'rgba(31,111,92,.08)', stroke: '#1f6f5c', rx: 12 }),
        text(44, 72, '好特征', { size: 14, fill: '#1f6f5c', weight: 'bold' }),
        text(44, 102, '重量、颜色', { size: 12.5, fill: '#243044' }),
        text(44, 126, '形状、纹理', { size: 12.5, fill: '#243044' }),
        text(44, 158, '能把两类明显分开', { size: 12, fill: '#8494a6' }),
        rect(244, 40, 190, 150, { fill: 'rgba(194,86,111,.08)', stroke: '#c2566f', rx: 12 }),
        text(264, 72, '没用的特征', { size: 14, fill: '#c2566f', weight: 'bold' }),
        text(264, 102, '购买日期', { size: 12.5, fill: '#243044' }),
        text(264, 126, '卖家名字', { size: 12.5, fill: '#243044' }),
        text(264, 158, '与类别无关，等于噪声', { size: 12, fill: '#8494a6' })
      ] },
      { caption: '特征工程：把原始数据加工成能"分开类别"的好特征。', cmds: featureEngineerScene() },
      { caption: '深度学习的优势之一：特征也能让网络自己学。', cmds: deepFeatureScene() },
      { caption: '特征数值差太大，要先"拉平"，否则会抢戏。', cmds: featureScale() },
      { caption: '特征不是越多越好，多了会乱、会慢。', cmds: featureDim() },
      { caption: '挑特征：留下相关、能区分的好特征。', cmds: featureSelect() }
    ]
  }
];

/* 低年级版讲解文案：与 phases 顺序一一对应，供"讲故事模式"朗读与字幕使用 */
const JUNIOR = {
  'what-is-ai': [
    '你一眼就看出，这是一只小猫。',
    '可是机器没有眼睛，它看到的是一堆数字。',
    '机器先找哪里「亮变暗」，这就是边边。',
    '再把边边拼起来，就看出是小猫啦。',
    '给它看很多小猫照片，它就学会认猫了。',
    '机器学习要三样东西：数据、算法、算力。',
    '训练和用起来不一样：一个看答案，一个自己猜。',
    '机器还能认字、认脸、看路、看医生照片。',
    '机器也会认错，它是小帮手，不是万能的。'
  ],
  'pixel-matrix': [
    '把图片切成小方块，每个小方块叫像素。',
    '每个像素有一个数字，数字越大越亮。',
    '整张图片，就变成一张数字表。',
    '彩色图片里，一个像素要记三个数字。',
    '把图片放大，看到的就是一格一格。',
    '黑白图只记亮度，彩色图要记三个数字。',
    '像素越密，画面越清楚。',
    '视频就是很快地翻很多张图片。'
  ],
  'conv-edge': [
    '有个小窗口，在图片上一点点移动。',
    '窗口碰到「亮变暗」，就发现边边了。',
    '窗口扫完整张图，就画出了所有边边。',
    '一层一层往上，先看边，再看形状。',
    '这个小窗口，其实是一串数字。',
    '放很多个窗口，就能找不同的图案。',
    '窗口每次走几步，可以自己定。',
    '给图片补一圈边，就不会越扫越小。',
    '把图片压小一点，留下重要的。'
  ],
  'decision-boundary': [
    '两种点点混在一起，机器要画一条线分开它们。',
    '这条线不是穿过点点，而是让分错的尽量少。',
    '线画得太靠下，蓝色点点就分错了很多。',
    '线画得太靠上，粉色点点就分错了很多。',
    '每个点，就是一个水果的两个数字。',
    '直线分不开，就用弯弯的线。',
    '离这条线越近，机器越拿不准。'
  ],
  'gradient-descent': [
    '先随便猜一条线，猜错没关系。',
    '把每个点差多少画出来，就知道线好不好。',
    '把错误加起来，就叫「损失」，越小越好。',
    '沿着山坡往下走一小步，就会变好一点。',
    '多走几步，错误越来越小，就学会啦。',
    '步子太小，走得慢，要很久。',
    '步子太大，会跳来跳去，容易错过。',
    '步子刚刚好，又快又稳。',
    '数据很多时，一次只看一个点。',
    '有时候会卡在小坑里，要多试几次。'
  ],
  'overfit': [
    '有六个蓝点点，机器要找一条线。',
    '线太简单，连原来的点都没贴好。',
    '线太弯，把每个点都穿过去了，这叫死记硬背。',
    '来了三个新黄点，弯弯的线就猜错了。',
    '所以，只会背题不算学会。',
    '多给点数据、别练过头，就不容易死记。',
    '把数据分成练习和考试两堆。',
    '多考几次，才知道学得好不好。'
  ],
  'kmeans': [
    '一堆没有名字的点点，机器不知道谁和谁一组。',
    '随便放两个中心点，点点跟着最近的中心走。',
    '把中心点移到中间，这是第一轮。',
    '再来几轮，中心点就不动了。',
    '分好组之后，要人来给每组起名字。',
    '分几组要人来定，选错会分得怪怪的。',
    '起点不同，结果可能不一样。',
    '看看曲线拐弯的地方，就知道分几组。'
  ],
  'tokenize': [
    '这是一句话：请把窗户关上。',
    '先把句子切成一块一块的小词。',
    '再把每个词变成一串数字。',
    '机器看着前面的词，猜下一个词。',
    '大语言模型，就是一个词一个词地猜。',
    '切成多大有讲究：按字、按词，还是折中。',
    '机器知道一句话里该重点看哪个词。',
    '一句话是一个词一个词长出来的。'
  ],
  'temperature': [
    '机器对每个词都有一个「可能性」。',
    '温度低，它总选最可能的那个词。',
    '温度高，它就敢选不一样的新词。',
    '每个词都有一个「可能性」。',
    '像抽签一样选词，答案就会不一样。',
    '温度变成 0，就总选最可能的那个。'
  ],
  'bias-data': [
    '有的图片多，有的图片少，机器就偏心。',
    '把图片补一样多，两边就都认得好了。',
    '这不是机器变坏，是数据里本来就有偏心。',
    '补足数据、分开检查，就能减少偏心。',
    '收数据的时候，就可能收得不一样多。',
    '标数据的人，也可能带偏见。',
    '要公平，就要每个群体都检查。'
  ],
  'algo-loop': [
    '机器人要从左下角，走到右上角的小星星。',
    '笨办法：一步一步写十遍，好累。',
    '聪明办法：说「重复十次向前走」就行。',
    '再加一句「前面有墙就转弯」，它就能自己走。',
    '循环还能套循环，一次画出一整张网格。',
    '循环让代码更短，也更好改。',
    '循环里有个小计数器，数着做了几次。',
    '忘了停下，就会一直转。'
  ],
  'data-feature': [
    '每个水果都有「重量」和「颜色」。',
    '只看重量，中间会重叠，分错。',
    '再加上颜色，画条斜线就分开了。',
    '特征选得好，机器就认得准。',
    '把数据加工成好特征，就叫特征工程。',
    '深度学习很厉害，能自己学会找特征。',
    '数字差太大，要先拉平。',
    '特征不是越多越好。',
    '留下有用、能分清楚的特征。'
  ]
};

/* ================= 对外接口 ================= */
function list() {
  return ANIMATIONS.map(a => ({
    id: a.id, title: a.title, emoji: a.emoji, desc: a.desc,
    topicId: a.topicId, interactive: a.interactive || null,
    topic: (content.getTopic(a.topicId) || {}).title || ''
  }));
}

function getAnimation(id) {
  const a = ANIMATIONS.find(x => x.id === id) || ANIMATIONS[0];
  if (!a) return null;
  const topic = content.getTopic(a.topicId);
  const enriched = require('./anim-enrich').forAnimation(a.id);
  return {
    id: a.id, title: a.title, emoji: a.emoji, desc: a.desc,
    canvas: { w: W, h: H },
    speed: a.speed || 1500,
    interactive: a.interactive || null,
    topicId: a.topicId,
    topicTitle: topic ? topic.title : '',
    topicSummary: topic ? topic.objective.know : '',
    phases: a.phases.map((p, idx) => {
      const en = enriched && enriched.phases && enriched.phases[idx];
      return {
        caption: (en && en.caption) || p.caption,
        junior: (en && en.junior) || (JUNIOR[a.id] || [])[idx] || '',
        cmds: p.cmds
      };
    })
  };
}

module.exports = { list, getAnimation, ANIMATIONS, JUNIOR, W, H };
