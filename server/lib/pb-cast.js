/**
 * AI 绘本 · 角色系统
 *
 * 三个固定主角，跨页保持形象一致：
 *   小AI —— 圆滚滚、会发光、有点笨笨的 AI 小助手。口头禅「让我试试看！」
 *   点点 —— 6 岁好奇宝宝，代表孩子自己。口头禅「为什么呀？」
 *   豆豆 —— 机器狗，会看会听会跑，但常常理解错。口头禅「汪汪？我猜的对吗？」
 *
 * 设计要点（针对 6～9 岁）：
 *   · 外形圆润：几乎没有尖角，身体用小圆 + 大圆叠出来
 *   · 头大身小：头占身高约一半，是低龄插画的通用比例
 *   · 表情夸张：开心时眼睛弯成月牙、惊讶时星星眼、困惑时歪头加问号
 *   · 会犯错、会害羞：所以有「不好意思」「委屈」这类表情，不是完美的工具
 *
 * 每个角色都带 CSS class（pb-float / pb-blink 等），由浏览器做轻微动效——
 * 服务端只负责画静态的一帧，动效交给 CSS，这样既能动又不卡。
 */
'use strict';

const A = require('./pb-art');
const { rect, circle, ellipse, text, path, line, poly, groupCls, C } = A;

/* ================= 情绪调色板（色彩情绪化） ================= */
/**
 * 每页声明一个情绪，整页的底色、光晕、点缀跟着变。
 * 原则：开心用暖黄橙浅绿，困惑用蓝灰浅紫，成功用金色亮橙，
 * 避免大面积黑、深红、灰暗。
 */
/**
 * 情绪 → 色彩。**色彩必须绑定情绪，不能随便挑**。
 * 每条写明：主色 sky / 辅色 props / 光晕 glow / 点缀 accent / 光斑 star / 光线 light。
 * 禁止大面积黑、深红、灰暗、恐怖色。
 */
/*
 * 情绪 → 色彩。**色彩必须绑定情绪，不能随便挑**。
 * 低幼化：每个情绪严格控制在 5 色以内，全部是马卡龙 / 莫兰迪色，
 * 禁止高饱和红绿紫，禁止深灰 / 暗红 / 深褐 / 深蓝。
 */
const MOODS = {
  happy: { name: '开心', sky: ['#fff8e6', '#ffedc9'], props: ['#cdeec8', '#ffedc9'], glow: '#ffe4b0', accent: '#f0b45e', star: '#f0b45e', light: '#ffe4b0' },
  curious: { name: '好奇', sky: ['#eef8fc', '#dcf0ec'], props: ['#c6e6f4', '#dcf0ec'], glow: '#e4f4ee', accent: '#7fbcd8', star: '#7fbcd8', light: '#e4f4ee' },
  worried: { name: '着急', sky: ['#f2f3f9', '#e2e4f2'], props: ['#d2d7ea', '#e2e4f2'], glow: '#e6e8f6', accent: '#9aa4c4', star: '#9aa4c4', light: '#e6e8f6' },
  focused: { name: '认真', sky: ['#fdf9f0', '#f4eada'], props: ['#e6dcc6', '#f4eada'], glow: '#f8f0e0', accent: '#c8a878', star: '#c8a878', light: '#f8f0e0' },
  puzzled: { name: '困惑', sky: ['#f4f1fb', '#e8e2f7'], props: ['#dcd2f4', '#e8e2f7'], glow: '#eee8fa', accent: '#a894dc', star: '#a894dc', light: '#eee8fa' },
  surprise: { name: '惊喜', sky: ['#fff9e0', '#ffedbe'], props: ['#ffdca0', '#ffedbe'], glow: '#fff2cc', accent: '#f0bc48', star: '#f0bc48', light: '#fff2cc' },
  thinking: { name: '想办法', sky: ['#f5faf2', '#e8f2e4'], props: ['#d4e8ca', '#e8f2e4'], glow: '#ecf6e8', accent: '#94c47c', star: '#94c47c', light: '#ecf6e8' },
  wonder: { name: '发现', sky: ['#fdf8ea', '#f9eed4'], props: ['#ffe8b8', '#f9eed4'], glow: '#fdf2dc', accent: '#e8b455', star: '#e8b455', light: '#fdf2dc' },
  setback: { name: '小挫折', sky: ['#f1f3fa', '#e6e7f4'], props: ['#d8dcec', '#e6e7f4'], glow: '#eceef8', accent: '#a8b0c8', star: '#a8b0c8', light: '#eceef8' },
  success: { name: '成功', sky: ['#fff6e2', '#ffe9bd'], props: ['#ffdca8', '#ffe9bd'], glow: '#fff0d0', accent: '#f0a848', star: '#f0a848', light: '#fff0d0' },
  expect: { name: '期待', sky: ['#f7ecfa', '#efe0f7'], props: ['#e6d4f6', '#efe0f7'], glow: '#f4e8fa', accent: '#b894dc', star: '#b894dc', light: '#f4e8fa' },
  warm: { name: '温暖', sky: ['#fff5f1', '#ffe8e0'], props: ['#ffd8cc', '#ffe8e0'], glow: '#fff0ea', accent: '#f0a894', star: '#f0a894', light: '#fff0ea' },
};
/* ================= 通用小零件 ================= */

/** 描边圆：低龄插画基本都是「粗描边 + 平涂」 */
function blob(cx, cy, r, fill, o) {
  o = o || {};
  return circle(cx, cy, r, { fill: fill, stroke: o.stroke || 'rgba(70,58,45,.16)', width: o.width === undefined ? 2 : o.width });
}
function rrect(x, y, w, h, r, fill, o) {
  o = o || {};
  return rect(x, y, w, h, { rx: r, fill: fill, stroke: o.stroke || 'rgba(70,58,45,.16)', width: o.width === undefined ? 2 : o.width });
}
/** 腮红 */
function blush(x, y, s, color) {
  return [
    ellipse(x, y, 9 * s, 6 * s, { fill: color || 'rgba(240,140,140,.42)', stroke: 'none' })
  ];
}
/** 高光小点：让圆面看起来是「球」而不是「圆」 */
function gloss(x, y, r, o) {
  o = o || {};
  return [
    ellipse(x - r * 0.34, y - r * 0.38, r * 0.3, r * 0.2, { fill: 'rgba(255,255,255,.75)', stroke: 'none' }),
    ellipse(x + r * 0.3, y + r * 0.34, r * 0.16, r * 0.11, { fill: 'rgba(255,255,255,.5)', stroke: 'none' })
  ];
}
/** 会眨眼的眼睛：眼白 + 瞳孔 + 高光，用 pb-blink 做眨眼动效 */
function eye(x, y, size, look, o) {
  o = o || {};
  const out = [circle(x, y, size, { fill: '#ffffff', stroke: 'rgba(70,58,45,.22)', width: 1.6 })];
  const dx = (look === 'left' ? -1 : look === 'right' ? 1 : 0) * size * 0.24;
  const dy = (look === 'up' ? -1 : look === 'down' ? 1 : 0) * size * 0.2;
  out.push(circle(x + dx, y + dy, size * 0.52, { fill: o.ink || '#3b3630' }));
  out.push(circle(x + dx - size * 0.2, y + dy - size * 0.24, size * 0.19, { fill: '#ffffff' }));
  return out;
}
/** 弯月眼（开心） */
function eyeHappy(x, y, size, flip) {
  const d = flip
    ? 'M ' + (x - size) + ' ' + y + ' q ' + size + ' ' + (-size * 0.95) + ' ' + (size * 2) + ' 0'
    : 'M ' + (x - size) + ' ' + y + ' q ' + size + ' ' + (-size * 0.95) + ' ' + (size * 2) + ' 0';
  return [path(d, { stroke: '#3b3630', width: size * 0.5, strokeLinecap: 'round' })];
}
/** 星星眼（惊喜） */
function eyeStar(x, y, size, fill) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + i * Math.PI / 5;
    const r = (i % 2 === 0 ? 1 : 0.42) * size * 1.25;
    pts.push([x + Math.cos(ang) * r, y + Math.sin(ang) * r]);
  }
  return [poly(pts, { fill: fill || '#ffc94d', stroke: 'rgba(232,137,15,.5)', width: 1.2 })];
}
/** 委屈眼（下弯） */
function eyeSad(x, y, size) {
  return [path('M ' + (x - size) + ' ' + (y + size * 0.4) + ' q ' + size + ' ' + (-size * 0.8) + ' ' + (size * 2) + ' 0', { stroke: '#3b3630', width: size * 0.45, strokeLinecap: 'round' })];
}
/**
 * 嘴：微笑 / 张嘴 / 扁嘴 / 圆形。
 *
 * 低幼化：**不画牙齿、不画嘴唇、不画舌头**，只有一条曲线或一个小色块。
 * 张嘴的填充色也从深枣红 #8c4a4a 换成奶油粉 —— 深色在低幼画面里就是「阴暗」。
 */
function mouth(x, y, w, kind) {
  /* 张嘴只有「一个小粉圆」，里面不再叠一层深色（那会看成舌头） */
  if (kind === 'open') return [ellipse(x, y + w * 0.16, w * 0.42, w * 0.36, { fill: '#f2a8a8', stroke: 'none' })];
  if (kind === 'flat') return [line(x - w * 0.42, y, x + w * 0.42, y, { stroke: '#3b3630', width: 2.4 })];
  if (kind === 'sad') return [path('M ' + (x - w * 0.4) + ' ' + (y + w * 0.22) + ' q ' + (w * 0.4) + ' ' + (-w * 0.48) + ' ' + (w * 0.8) + ' 0', { stroke: '#3b3630', width: 2.4, strokeLinecap: 'round' })];
  if (kind === 'o') return [circle(x, y, w * 0.24, { fill: '#f2a8a8', stroke: 'none' })];
  return [path('M ' + (x - w * 0.4) + ' ' + y + ' q ' + (w * 0.4) + ' ' + (w * 0.62) + ' ' + (w * 0.8) + ' 0', { stroke: '#3b3630', width: 2.4, strokeLinecap: 'round' })];
}

/**
 * 表情集合
 * @returns {{eyes:Array, mouth:Array, extra:Array}}
 */
function face(kind, cx, cy, s, look, opt) {
  const light = !!(opt && opt.light);
  /* 屏幕脸是深色的，所以豆豆的瞳孔要画成白色才看得见 */
  const inkOf = () => (light ? '#ffffff' : '#3b3630');
  const ex = s * 11;      // 眼距半宽
  const ey = cy;          // 眼睛高度
  const es = s * 7.6;     // 眼睛半径
  const out = { eyes: [], mouth: [], extra: [] };
  switch (kind) {
    case 'happy':
      out.eyes = eye(cx - ex, ey, es * 0.95, 'down').concat(eye(cx + ex, ey, es * 0.95, 'down'));
      out.mouth = mouth(cx, cy + s * 8, s * 15, 'smile');
      break;
    case 'laugh':
      out.eyes = eye(cx - ex, ey, es * 0.95, 'down').concat(eye(cx + ex, ey, es * 0.95, 'down'));
      out.mouth = mouth(cx, cy + s * 7, s * 17, 'open');
      out.extra = blush(cx - s * 17, cy + s * 5, s * 0.8).concat(blush(cx + s * 17, cy + s * 5, s * 0.8));
      break;
    case 'star':
      /* 低幼化：不用星星眼（多尖角图形在低幼画面里显得尖锐、怪异），
     改成「超大圆眼 + 高光」，一样表达惊喜，但形状绝对安全 */
      out.eyes = eye(cx - ex, ey, es * 1.18, look || 'up').concat(eye(cx + ex, ey, es * 1.18, look || 'up'));
      out.mouth = mouth(cx, cy + s * 8, s * 17, 'open');
      break;
    case 'wonder':
      out.eyes = eye(cx - ex, ey, es * 1.12, look || 'up').concat(eye(cx + ex, ey, es * 1.12, look || 'up'));
      out.mouth = mouth(cx, cy + s * 8, s * 14, 'o');
      out.extra = blush(cx - s * 18, cy + s * 5, s * 0.9).concat(blush(cx + s * 18, cy + s * 5, s * 0.9));
      break;
    case 'puzzled':
      out.eyes = eye(cx - ex, ey, es, 'right').concat(eye(cx + ex, ey, es * 0.86, 'right'));
      out.mouth = mouth(cx, cy + s * 8, s * 12, 'flat');
      break;
    case 'worried':
      out.eyes = eye(cx - ex, ey + s * 1.5, es * 0.95, 'down').concat(eye(cx + ex, ey + s * 1.5, es * 0.95, 'down'));
      out.mouth = mouth(cx, cy + s * 8, s * 12, 'sad');
      /* 低幼化：不画眉毛 —— 眉毛是写实结构，低幼角色只留眼睛和嘴 */
      break;
    case 'shy':
      out.eyes = eye(cx - ex, ey + s * 1.2, es * 0.9, 'down').concat(eye(cx + ex, ey + s * 1.2, es * 0.9, 'down'));
      out.mouth = mouth(cx, cy + s * 8, s * 10, 'smile');
      out.extra = blush(cx - s * 17, cy + s * 4, s * 1.2).concat(blush(cx + s * 17, cy + s * 4, s * 1.2));
      break;
    case 'sad':
      out.eyes = eyeSad(cx - ex, ey, es * 0.95).concat(eyeSad(cx + ex, ey, es * 0.95));
      out.mouth = mouth(cx, cy + s * 9, s * 12, 'sad');
      break;
    case 'blink':
      out.eyes = [line(cx - ex - es * 0.8, ey, cx - ex + es * 0.8, ey, { stroke: inkOf(), width: 2.4, strokeLinecap: 'round' }),
        line(cx + ex - es * 0.8, ey, cx + ex + es * 0.8, ey, { stroke: inkOf(), width: 2.4, strokeLinecap: 'round' })];
      out.mouth = mouth(cx, cy + s * 8, s * 14, 'smile');
      break;
    default: /* calm */
      out.eyes = eye(cx - ex, ey, es, look).concat(eye(cx + ex, ey, es, look));
      out.mouth = mouth(cx, cy + s * 8, s * 14, 'smile');
  }
  return out;
}

/* ================= 小AI ================= */
/**
 * 圆滚滚、会发光、有点笨笨的 AI 小助手。
 * @param o { expr, s, glow, antenna, arms, className }
 */
function ai(x, y, s, o) {
  o = o || {};
  s = s || 1;
  const expr = o.expr || 'happy';
  const body = o.body || '#8fd6c0';
  const out = [];
  /* 光晕：小AI 会发光 */
  if (o.glow !== false) {
    out.push(circle(x, y + 6 * s, 62 * s, { fill: '#ffe9b0', opacity: 0.5, stroke: 'none', class: 'pb-glow' }));
    out.push(circle(x, y + 6 * s, 48 * s, { fill: '#fff3cf', opacity: 0.55, stroke: 'none' }));
  }
  /* 地面投影 */
  out.push(ellipse(x, y + 62 * s, 40 * s, 9 * s, { fill: 'rgba(70,58,45,.12)', stroke: 'none' }));
  /* 身体：矮胖的圆角柱（圆滚滚是它的辨识特征，所以比头略宽） */
  out.push(rrect(x - 34 * s, y + 14 * s, 68 * s, 50 * s, 24 * s, body, { stroke: 'rgba(60,120,105,.35)' }));
  out.push(ellipse(x, y + 40 * s, 18 * s, 14 * s, { fill: 'rgba(255,255,255,.42)', stroke: 'none' }));
  /* 小腿 */
  out.push(rrect(x - 19 * s, y + 58 * s, 15 * s, 10 * s, 5 * s, '#6fbfa8', { stroke: 'rgba(60,120,105,.3)' }));
  out.push(rrect(x + 4 * s, y + 58 * s, 15 * s, 10 * s, 5 * s, '#6fbfa8', { stroke: 'rgba(60,120,105,.3)' }));
  /* 手臂 */
  const armUp = o.arms === 'up';
  const armWave = o.arms === 'wave';
  out.push(rrect(x - 46 * s, (armUp ? y - 4 : y + 22) * 1, 16 * s, 13 * s, 6 * s, '#6fbfa8', { stroke: 'rgba(60,120,105,.3)' }));
  out.push(rrect(x + 30 * s, (armWave ? y + 2 : armUp ? y - 4 : y + 22), 16 * s, 13 * s, 6 * s, '#6fbfa8', { stroke: 'rgba(60,120,105,.3)' }));
  /* 天线：顶端一颗会亮的小灯 */
  out.push(line(x, y - 34 * s, x, y - 50 * s, { stroke: '#b9c4d0', width: 3.4 * s }));
  out.push(circle(x, y - 55 * s, 7 * s, { fill: '#ffc94d', stroke: 'rgba(70,58,45,.2)', width: 1.6, class: 'pb-blink-star' }));
  /* 头：大圆，占身高一半 */
  out.push(circle(x, y - 4 * s, 34 * s, { fill: '#ffffff', stroke: 'rgba(60,120,105,.42)', width: 3 * s }));
  out.push(ellipse(x - 12 * s, y - 22 * s, 11 * s, 7 * s, { fill: 'rgba(255,255,255,.9)', stroke: 'none' }));
  /* 屏幕脸 */
  const f = face(expr, x, y - 8 * s, s, o.look);
  out.push(groupCls('pb-blink', f.eyes));
  out.push(f.mouth);
  out.push(f.extra);
  return out;
}

/* ================= 点点（6 岁好奇宝宝） ================= */
function dian(x, y, s, o) {
  o = o || {};
  s = s || 1;
  const expr = o.expr || 'happy';
  const dress = o.dress || '#ff9f68';
  const out = [];
  out.push(ellipse(x, y + 64 * s, 30 * s, 8 * s, { fill: 'rgba(70,58,45,.12)', stroke: 'none' }));
  /* 腿 */
  out.push(rrect(x - 15 * s, y + 44 * s, 12 * s, 22 * s, 6 * s, '#7f9bc4', { stroke: 'rgba(70,58,45,.1)' }));
  out.push(rrect(x + 3 * s, y + 44 * s, 12 * s, 22 * s, 6 * s, '#7f9bc4', { stroke: 'rgba(70,58,45,.1)' }));
  out.push(ellipse(x - 9 * s, y + 67 * s, 10 * s, 6 * s, { fill: '#5f6b7c', stroke: 'none' }));
  out.push(ellipse(x + 9 * s, y + 67 * s, 10 * s, 6 * s, { fill: '#5f6b7c', stroke: 'none' }));
  /* 裙子：梯形 */
  out.push(poly([[x - 24 * s, y + 50 * s], [x + 24 * s, y + 50 * s], [x + 17 * s, y + 16 * s], [x - 17 * s, y + 16 * s]], { fill: dress, stroke: 'rgba(70,58,45,.16)', width: 2 }));
  out.push(ellipse(x, y + 32 * s, 13 * s, 9 * s, { fill: 'rgba(255,255,255,.3)', stroke: 'none' }));
  /* 手臂 */
  const up = o.arms === 'up';
  out.push(rrect(x - 30 * s, (up ? y + 4 : y + 26) * 1, 11 * s, 20 * s, 5.5 * s, dress, { stroke: 'rgba(70,58,45,.14)' }));
  out.push(rrect(x + 19 * s, (up ? y + 4 : y + 26), 11 * s, 20 * s, 5.5 * s, dress, { stroke: 'rgba(70,58,45,.14)' }));
  if (up) {
    out.push(circle(x - 25 * s, y + 2 * s, 6.5 * s, { fill: '#f6d0b4', stroke: 'rgba(70,58,45,.14)', width: 1.6 }));
    out.push(circle(x + 25 * s, y + 2 * s, 6.5 * s, { fill: '#f6d0b4', stroke: 'rgba(70,58,45,.14)', width: 1.6 }));
  }
  /* 头 */
  out.push(circle(x, y - 12 * s, 30 * s, { fill: '#fbdcc2', stroke: 'rgba(70,58,45,.16)', width: 2 }));
  /* 头发：刘海 + 两侧小揪 */
  out.push(path('M ' + (x - 31 * s) + ' ' + (y - 14 * s) + ' q ' + (31 * s) + ' ' + (-36 * s) + ' ' + (62 * s) + ' 0 q ' + (-10 * s) + ' ' + (-13 * s) + ' ' + (-31 * s) + ' ' + (-11 * s) + ' q ' + (-21 * s) + ' ' + (-2 * s) + ' ' + (-31 * s) + ' ' + (11 * s) + ' Z', { fill: '#5a4032' }));
  out.push(circle(x - 30 * s, y - 26 * s, 9 * s, { fill: '#5a4032', stroke: 'none' }));
  out.push(circle(x + 30 * s, y - 26 * s, 9 * s, { fill: '#5a4032', stroke: 'none' }));
  out.push(circle(x - 30 * s, y - 26 * s, 3.4 * s, { fill: '#ffb3c1', stroke: 'none' }));
  out.push(circle(x + 30 * s, y - 26 * s, 3.4 * s, { fill: '#ffb3c1', stroke: 'none' }));
  /* 脸 */
  const f = face(expr, x, y - 14 * s, s, o.look);
  out.push(groupCls('pb-blink', f.eyes));
  out.push(f.mouth);
  out.push(f.extra);
  return out;
}

/* ================= 机器狗豆豆 ================= */
function dou(x, y, s, o) {
  o = o || {};
  s = s || 1;
  const expr = o.expr || 'happy';
  const coat = o.coat || '#f0b45e';
  const out = [];
  out.push(ellipse(x, y + 46 * s, 34 * s, 9 * s, { fill: 'rgba(70,58,45,.12)', stroke: 'none' }));
  /* 身体 */
  out.push(rrect(x - 30 * s, y + 6 * s, 60 * s, 38 * s, 16 * s, coat, { stroke: 'rgba(150,100,40,.34)' }));
  out.push(rrect(x - 20 * s, y + 16 * s, 40 * s, 20 * s, 10 * s, '#ffe1b0', { stroke: 'none' }));
  /* 腿 */
  out.push(rrect(x - 26 * s, y + 38 * s, 13 * s, 14 * s, 5 * s, '#d99a4e', { stroke: 'rgba(150,100,40,.3)' }));
  out.push(rrect(x + 13 * s, y + 38 * s, 13 * s, 14 * s, 5 * s, '#d99a4e', { stroke: 'rgba(150,100,40,.3)' }));
  /* 尾巴：会摇 */
  out.push(path('M ' + (x + 30 * s) + ' ' + (y + 12 * s) + ' q ' + (18 * s) + ' ' + (-10 * s) + ' ' + (12 * s) + ' ' + (-20 * s), { stroke: '#d99a4e', width: 6 * s, strokeLinecap: 'round', class: 'pb-tail' }));
  /* 头 */
  out.push(circle(x, y - 22 * s, 27 * s, { fill: coat, stroke: 'rgba(150,100,40,.34)', width: 2 }));
  /* 脸上的小屏幕：豆豆的「机器感」。做成长条，让眼睛正好落在里面。 */
  out.push(rrect(x - 21 * s, y - 32 * s, 42 * s, 16 * s, 8 * s, '#3d4a5c', { stroke: 'rgba(150,100,40,.3)', width: 1.6 }));
  /* 低幼化：不画耳朵、不画鼻子。
     写实的耳廓和鼻梁是「恐怖谷」的主要来源；低幼角色只留眼睛和嘴。
     头顶保留一根呆毛，用来表达情绪（会晃），这比耳朵更有效也更安全。 */
  /* 脸：屏幕是深色的，所以瞳孔画成浅色才看得见 */
  const f = face(expr, x, y - 24 * s, s * 0.62, o.look, { light: true });
  out.push(groupCls('pb-blink', f.eyes));
  out.push(f.extra);
  /* 舌头 / 嘴 */
  if (expr === 'happy' || expr === 'laugh' || expr === 'star') {
    out.push(path('M ' + (x - 7 * s) + ' ' + (y - 14 * s) + ' q ' + (7 * s) + ' ' + (8 * s) + ' ' + (14 * s) + ' 0', { stroke: '#4a3a2c', width: 2, strokeLinecap: 'round' }));
    out.push(ellipse(x + 3 * s, y - 6 * s, 4.6 * s, 6 * s, { fill: '#e58989', stroke: 'none' }));
  } else {
    out.push(f.mouth);
  }
  return out;
}

/* ================= 身体动作（不能只是站着） ================= */
/**
 * 把角色整体按动作做变形：踮脚、趴下、跳起、后退、伸手、抱头、转圈、摔倒。
 * 做法是给角色外面套一个 transform 组，并在需要时补上动势线／灰尘／汗滴，
 * 这样角色函数本身不用改，动作可以自由组合。
 * @returns {{body:Array, fx:Array, dy:number}} dy 是角色基准线的偏移
 */
const POSES = {
  stand:   { name: '站立',   scale: 1,    skew: 0,  rot: 0,   dy: 0,   fx: null },
  tiptoe:  { name: '踮脚',   scale: 1.06, skew: 0,  rot: 0,   dy: -8,  fx: 'up' },
  lie:     { name: '趴下',   scale: 1,    skew: 0,  rot: -78, dy: 34,  fx: null },
  jump:    { name: '跳起',   scale: 1.05, skew: 0,  rot: -6,  dy: -34, fx: 'jump' },
  back:    { name: '后退',   scale: 0.96, skew: -4, rot: 7,   dy: 2,   fx: 'back' },
  reach:   { name: '伸手',   scale: 1.02, skew: 0,  rot: -3,  dy: -4,  fx: 'reach' },
  cover:   { name: '抱头',   scale: 1,    skew: 0,  rot: 0,   dy: 4,   fx: 'shake' },
  spin:    { name: '转圈',   scale: 1.02, skew: 0,  rot: 0,   dy: -6,  fx: 'spin' },
  fall:    { name: '摔倒',   scale: 1,    skew: 0,  rot: -62, dy: 40,  fx: 'fall' }
};
/**
 * @param {Array} body  角色指令
 * @param {string} pose 动作名
 * @param {number} x,y,s 角色位置与缩放（用于画动势线）
 */
function applyPose(body, pose, x, y, s) {
  const p = POSES[pose] || POSES.stand;
  const k = s || 1;
  const t = 'translate(' + x + ' ' + (y + p.dy * k) + ') scale(' + p.scale + ' ' + (1 - Math.abs(p.skew) * 0.01) +
    ') skewX(' + p.skew + ') rotate(' + p.rot + ') translate(' + (-x) + ' ' + (-y) + ')';
  const out = { body: ['group', { transform: t, class: 'pb-pose-' + pose }, body], fx: [] };
  if (p.fx === 'up') out.fx = A.speedLines(x - 30 * k, y + 40 * k, Math.PI / 2, 0.9, 'rgba(190,170,130,.7)');
  if (p.fx === 'jump') out.fx = A.speedLines(x, y + 46 * k, Math.PI / 2, 0.85, 'rgba(190,170,130,.7)')
    .concat(A.dust(x - 26 * k, y + 50 * k, 0.8));
  if (p.fx === 'back') out.fx = A.speedLines(x + 26 * k, y, 0, 1, 'rgba(190,170,130,.75)');
  if (p.fx === 'reach') out.fx = A.motionArc(x + 18 * k, y - 6 * k, 0.9);
  if (p.fx === 'shake') out.fx = A.speedLines(x - 26 * k, y - 30 * k, 0, 0.75, 'rgba(190,170,130,.7)')
    .concat(A.speedLines(x + 26 * k, y - 30 * k, Math.PI, 0.75, 'rgba(190,170,130,.7)'));
  if (p.fx === 'spin') out.fx = A.motionArc(x, y + 6 * k, 1.05);
  if (p.fx === 'fall') out.fx = A.dust(x + 24 * k, y + 40 * k, 1.0).concat(A.speedLines(x + 10 * k, y + 20 * k, -0.5, 0.8, 'rgba(190,170,130,.7)'));
  return out;
}


/* ================= 骨骼绑定：把角色拆成可独立运动的部件 ================= */
/**
 * 动画片和 PPT 的根本区别：角色的**各个部件要能独立运动**。
 * 这里把角色拆成 头 / 身体 / 左臂 / 右臂 / 左腿 / 右腿 / 呆毛 / 眼睛 / 嘴巴，
 * 每一part 包在一个带 class 的 <g> 里，前端用 CSS 关键帧分别驱动它们。
 *
 * 旋转轴心（transform-origin）通过 transform-box:fill-box 在 CSS 里设定，
 * 手臂绕肩、腿绕胯、头绕脖子——这样才是「关节在动」而不是「整块在飘」。
 */
function rigOf(who, x, y, s, o, prefix) {
  o = o || {};
  s = s || 1;
  const expr = o.expr || 'happy';
  const skin = o.skin || (who === 'dou' ? '#f0b45e' : who === 'dian' ? '#ff9f68' : '#8fd6c0');
  const limb = o.limb || (who === 'dou' ? '#d99a3f' : who === 'dian' ? '#f08a52' : '#6fbfa8');
  const outline = o.outline || 'rgba(60,120,105,.35)';
  /* 每个角色实例一套自己的 class 名，避免同页多角色时 CSS 关键帧互相覆盖 */
  const NS = prefix || 'pbA';
  const g = (cls, inner) => groupCls(cls.split(' ').map(function (c) { return c.indexOf('pbA-') === 0 ? NS + c.slice(3) : c; }).join(' '), inner);
  const out = [];
  /* 角色的所有部件都收进 body 组里。
     这一点很关键：走路的水平位移施加在 body 组上，头、手臂、腿必须是它的子节点，
     否则就会出现「身体走了、头还留在原地」的错位。 */
  const here = [];   /* 光晕与投影：跟着角色走，但不参与挤压 */
  const parts = [];  /* 头 / 手臂 / 腿 / 呆毛 / 脸：全部是 body 组的子节点 */
  let bodyRect = null;  /* 身体本身：它是外壳，不是自己的子节点 */

  if (who === 'ai') {
    /* 光晕与投影不参与动作：它们留在地上 */
    if (o.glow !== false) {
      here.push(g('pbA-halo', [
        circle(x, y + 6 * s, 62 * s, { fill: '#ffe9b0', opacity: 0.5, stroke: 'none' }),
        circle(x, y + 6 * s, 48 * s, { fill: '#fff3cf', opacity: 0.55, stroke: 'none' })
      ]));
    }
    here.push(g('pbA-shadow', [ellipse(x, y + 62 * s, 40 * s, 9 * s, { fill: 'rgba(70,58,45,.16)', stroke: 'none' })]));
    /* 后腿 / 前腿分开，走路时才能一前一后 */
    parts.push(g('pbA-legL', [rrect(x - 19 * s, y + 58 * s, 15 * s, 10 * s, 5 * s, limb, { stroke: outline })]));
    parts.push(g('pbA-legR', [rrect(x + 4 * s, y + 58 * s, 15 * s, 10 * s, 5 * s, limb, { stroke: outline })]));
    /* 后臂 */
    parts.push(g('pbA-armL', [rrect(x - 46 * s, y + 22 * s, 16 * s, 13 * s, 6 * s, limb, { stroke: outline })]));
    /* 身体 */
    bodyRect = g('pbA-body', [
      rrect(x - 34 * s, y + 14 * s, 68 * s, 50 * s, 24 * s, skin, { stroke: outline }),
      ellipse(x, y + 40 * s, 18 * s, 14 * s, { fill: 'rgba(255,255,255,.42)', stroke: 'none' })
    ]);
    /* 前臂 */
    parts.push(g('pbA-armR', [rrect(x + 30 * s, y + 22 * s, 16 * s, 13 * s, 6 * s, limb, { stroke: outline })]));
    /* 呆毛天线：跟随动作，身体停下它还在晃 */
    parts.push(g('pbA-hair', [
      line(x, y - 34 * s, x, y - 50 * s, { stroke: '#b9c4d0', width: 3.4 * s }),
      circle(x, y - 55 * s, 7 * s, { fill: '#ffc94d', stroke: 'rgba(70,58,45,.2)', width: 1.6 })
    ]));
    /* 头 */
    const f = face(expr, x, y - 8 * s, s, o.look);
    parts.push(g('pbA-head', [
      circle(x, y - 4 * s, 34 * s, { fill: '#ffffff', stroke: 'rgba(60,120,105,.42)', width: 3 * s }),
      ellipse(x - 12 * s, y - 22 * s, 11 * s, 7 * s, { fill: 'rgba(255,255,255,.9)', stroke: 'none' }),
      g('pbA-eyes pb-blink', f.eyes),
      g('pbA-mouth', [f.mouth]),
      g('pbA-extra', [f.extra])
    ]));
  } else {

  /* 点点与豆豆：结构一致，只是配色与轮廓不同 */
  const isDou = who === 'dou';
  if (o.glow !== false) {
    here.push(g('pbA-halo-d', [circle(x, y + 4 * s, 54 * s, { fill: isDou ? '#ffe0b0' : '#ffd9c8', opacity: 0.35, stroke: 'none' })]));
  }
  here.push(g('pbA-shadow-d', [ellipse(x, y + 62 * s, 36 * s, 9 * s, { fill: 'rgba(70,58,45,.16)', stroke: 'none' })]));
  parts.push(g('pbA-legL', [rrect(x - 16 * s, y + 40 * s, 13 * s, 22 * s, 6 * s, isDou ? '#c98a3a' : '#7f9bc4', { stroke: 'rgba(70,58,45,.12)' })]));
  parts.push(g('pbA-legR', [rrect(x + 4 * s, y + 40 * s, 13 * s, 22 * s, 6 * s, isDou ? '#c98a3a' : '#7f9bc4', { stroke: 'rgba(70,58,45,.12)' })]));
  parts.push(g('pbA-armL', [rrect(x - 30 * s, y + 24 * s, 11 * s, 20 * s, 5.5 * s, skin, { stroke: 'rgba(70,58,45,.14)' })]));
  bodyRect = g('pbA-body', [
    isDou
      ? rrect(x - 26 * s, y + 14 * s, 52 * s, 34 * s, 14 * s, skin, { stroke: 'rgba(150,100,40,.3)' })
      : poly([[x - 24 * s, y + 50 * s], [x + 24 * s, y + 50 * s], [x + 17 * s, y + 16 * s], [x - 17 * s, y + 16 * s]],
        { fill: skin, stroke: 'rgba(70,58,45,.14)', width: 2 }),
    ellipse(x, y + 32 * s, 13 * s, 9 * s, { fill: 'rgba(255,255,255,.3)', stroke: 'none' })
  ]);
  parts.push(g('pbA-armR', [rrect(x + 19 * s, y + 24 * s, 11 * s, 20 * s, 5.5 * s, skin, { stroke: 'rgba(70,58,45,.14)' })]));
  /* 豆豆的小尾巴 / 点点的呆毛 */
  if (isDou) parts.push(g('pbA-hair', [path('M ' + (x + 24 * s) + ' ' + (y + 26 * s) + ' q ' + (22 * s) + ' ' + (-6 * s) + ' ' + (26 * s) + ' ' + (-20 * s),
    { stroke: '#e0a860', width: 6 * s, fill: 'none', strokeLinecap: 'round' })]));
  else parts.push(g('pbA-hair', [path('M ' + (x - 6 * s) + ' ' + (y - 6 * s) + ' q ' + (10 * s) + ' ' + (-18 * s) + ' ' + (4 * s) + ' ' + (-24 * s),
    { stroke: '#6b4a2c', width: 4 * s, fill: 'none', strokeLinecap: 'round' })]));
  /* 头身比：低幼角色必须是 1:1~1:1.5 的超幼态比例。
     头半径 21、身体高 50 → 头身比约 1:1.2，是「幼儿」而不是「小学生」。 */
  /* 头身比：低幼要求 1:1~1:1.5。身体高 50，所以头直径取 48（≈1:1.04）。
     头越大越「幼」，也越不容易看出写实结构 —— 这是最省力的去诡异手段。 */
  const f2 = face(expr, x, y - 6 * s, s * 1.02, o.look);
  parts.push(g('pbA-head', [
    circle(x, y - 6 * s, isDou ? 25 * s : 24 * s, { fill: isDou ? '#f6c98a' : '#f6d0b4', stroke: 'rgba(70,58,45,.18)', width: 2.4 * s }),
    /* 低幼化：豆豆脸上不再画「小屏幕」。
       那块深色长条无论放哪都会读成「眼镜」或「胡子」—— 两条都是写实结构。
       豆豆靠耳朵形状和尾巴颜色区分就够了，脸保持「只有眼睛和嘴」。 */
    g('pbA-eyes pb-blink', f2.eyes),
    g('pbA-mouth', [f2.mouth]),
    g('pbA-extra', [f2.extra])
  ].filter(Boolean)));
  }

  /* 低幼化：不再给身体和头挂投影/内阴影。
     扁平纯色 + 一层极轻的边缘柔化，才是「干净、可预期、无害」的画面。 */

  /* 组装顺序：光晕与投影留在地上 → 角色本体（头 / 手臂 / 腿 / 呆毛 都是它的子节点）
     这样走路的水平位移施加在 body 上时，整个角色一起走，不会出现「身子走了、头还在原地」 */
  here.forEach(x => out.push(x));
  if (bodyRect) {
    /* 把各个关节塞进身体组：头 / 手臂 / 腿 / 呆毛 / 脸 都是它的子节点 */
    bodyRect[2] = [bodyRect[2]].concat(parts);
    out.push(bodyRect);
  } else {
    out.push(g('pbA-body', parts));
  }
  return out;
}

/* ================= 角色选择器 ================= */
/**
 * @param who 'ai' | 'dian' | 'dou'
 */
/**
 * 统一的角色画法。
 * 三个角色的「原生比例」不一样（小AI 头最大、点点最高、豆豆最矮），
 * 所以这里用一个基准系数把它们拉到同一视觉高度，再乘调用方给的 s。
 * 这样故事脚本里只要写 character('ai', x, y, 1.6) 就能让主角占画面高度的四成到六成。
 */
const BASE = { ai: 1.05, dian: 1.0, dou: 1.18 };
function character(who, x, y, s, o) {
  const k = (s === undefined ? 1 : s) * (BASE[who] || 1);
  if (who === 'ai') return ai(x, y, k, o);
  if (who === 'dian') return dian(x, y, k, o);
  if (who === 'dou') return dou(x, y, k, o);
  return [];
}

/* ================= 场景氛围零件 ================= */

/** 情绪化的背景：三层以内，两层渐变 + 一层地面 */
function backdrop(mood, o) {
  o = o || {};
  const m = MOODS[mood] || MOODS.happy;
  const out = [];
  out.push(rect(0, 0, 640, 400, { rx: 0, fill: m.sky[0], stroke: 'none' }));
  /* 柔和的光晕：水彩感的来源 */
  out.push(ellipse(o.gx === undefined ? 500 : o.gx, o.gy === undefined ? 96 : o.gy, 150, 110, { fill: m.glow, opacity: 0.55, stroke: 'none' }));
  out.push(ellipse(o.gx2 === undefined ? 120 : o.gx2, o.gy2 === undefined ? 330 : o.gy2, 170, 90, { fill: m.props[0], opacity: 0.4, stroke: 'none' }));
  /* 地面 */
  out.push(rect(0, 292, 640, 108, { rx: 0, fill: m.props[1], opacity: 0.55, stroke: 'none' }));
  out.push(path('M 0 292 q 160 -16 320 0 q 160 16 320 0 L 640 292 L 0 292 Z', { fill: m.sky[1], opacity: 0.5, stroke: 'none' }));
  return out;
}

/** 星星／闪光点缀：成功页用 */
function sparkles(list, color) {
  return (list || []).map(p => {
    const x = p[0], y = p[1], s = p[2] || 1;
    return path('M ' + x + ' ' + (y - 11 * s) + ' L ' + (x + 3.4 * s) + ' ' + (y - 3.4 * s) + ' L ' + (x + 11 * s) + ' ' + y +
      ' L ' + (x + 3.4 * s) + ' ' + (y + 3.4 * s) + ' L ' + x + ' ' + (y + 11 * s) + ' L ' + (x - 3.4 * s) + ' ' + (y + 3.4 * s) +
      ' L ' + (x - 11 * s) + ' ' + y + ' L ' + (x - 3.4 * s) + ' ' + (y - 3.4 * s) + ' Z',
      { fill: color || '#ffc94d', stroke: 'none', class: 'pb-twinkle' });
  });
}

/** 汗滴（着急） */
function sweat(x, y, s) {
  return [path('M ' + x + ' ' + (y - 9 * s) + ' q ' + (7 * s) + ' ' + (10 * s) + ' 0 ' + (14 * s) + ' q ' + (-7 * s) + ' ' + (-4 * s) + ' 0 ' + (-14 * s) + ' Z',
    { fill: '#9fd0e8', stroke: 'rgba(70,120,150,.3)', width: 1.2 })];
}

/** 问号（困惑） */
function qmark(x, y, s, color) {
  const out = [];
  out.push(path('M ' + (x - 6 * s) + ' ' + (y - 10 * s) + ' q ' + (6 * s) + ' ' + (-12 * s) + ' ' + (12 * s) + ' ' + (-2 * s) +
    ' q ' + (5 * s) + ' ' + (9 * s) + ' ' + (-6 * s) + ' ' + (12 * s) + ' l 0 ' + (6 * s),
    { stroke: color || '#8b76c9', width: 5 * s, strokeLinecap: 'round', fill: 'none' }));
  out.push(circle(x, y + 16 * s, 3.4 * s, { fill: color || '#8b76c9', stroke: 'none' }));
  return out;
}

/** 对话气泡（带小尖角，跟着角色走） */
function sayBubble(x, y, w, h, tail, o) {
  o = o || {};
  const fill = o.fill || '#ffffff';
  const stroke = o.stroke || 'rgba(70,58,45,.16)';
  const out = [rrect(x, y, w, h, 18, fill, { stroke: stroke, width: 2.4 })];
  const tx = tail === 'left' ? x + 26 : (tail === 'right' ? x + w - 46 : x + w / 2 - 10);
  out.push(poly([[tx, y + h - 2], [tx + 26, y + h - 2], [tx + 6, y + h + 20]], { fill: fill, stroke: stroke, width: 2.4 }));
  out.push(rect(tx + 1, y + h - 4, 24, 5, { rx: 0, fill: fill, stroke: 'none' }));
  return out;
}
/** 气泡里的文字，自动按宽度折行 */
function bubbleText(x, y, w, s, size, color) {
  const per = Math.max(4, Math.floor(w / (size * 1.02)));
  const lines = [];
  let buf = '';
  for (const ch of String(s)) {
    buf += ch;
    if (buf.length >= per) { lines.push(buf); buf = ''; }
  }
  if (buf) lines.push(buf);
  return lines.slice(0, 3).map((l, i) => text(x, y + i * (size + 5), l, { size: size, fill: color || '#3b3630', weight: 'bold' }));
}

/** 光点／萤火：让画面有呼吸感 */
function motes(list) {
  return (list || []).map(p => circle(p[0], p[1], p[2] || 3, { fill: '#fff3cf', opacity: 0.85, stroke: 'none', class: 'pb-mote' }));
}

/** 奖杯／星星奖章 */
function medal(x, y, s, kind) {
  const out = [];
  /* 绶带：两条小飘带 */
  out.push(poly([[x - 11 * s, y + 13 * s], [x - 4 * s, y + 13 * s], [x - 8 * s, y + 33 * s], [x - 15 * s, y + 29 * s]], { fill: '#e8890f', stroke: 'none' }));
  out.push(poly([[x + 4 * s, y + 13 * s], [x + 11 * s, y + 13 * s], [x + 15 * s, y + 29 * s], [x + 8 * s, y + 33 * s]], { fill: '#e8890f', stroke: 'none' }));
  out.push(circle(x, y, 16 * s, { fill: kind === 'gold' ? '#ffc94d' : '#cfe0ee', stroke: '#e8890f', width: 2.6 }));
  if (kind === 'gold') {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + i * Math.PI / 5;
      const r = (i % 2 === 0 ? 1 : 0.45) * 8.6 * s;
      pts.push([x + Math.cos(ang) * r, y + Math.sin(ang) * r]);
    }
    out.push(poly(pts, { fill: '#fff6db', stroke: 'none' }));
  }
  return out;
}

/** 过滤掉空片段，避免 undefined 混进绘图指令里 */
function clean(list) {
  return (list || []).filter(x => x && Array.isArray(x) && x.length);
}

module.exports = {
  MOODS, blob, rrect, blush, gloss, eye, eyeHappy, eyeStar, eyeSad, mouth, face, clean, POSES, applyPose,
  ai, dian, dou, character, rigOf,
  backdrop, sparkles, sweat, qmark, sayBubble, bubbleText, motes, medal
};
