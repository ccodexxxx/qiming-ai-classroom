/**
 * AI 绘本 · 插画库
 * 全部插画由绘图指令在服务端渲染成 SVG 字符串，零素材、零外部图片。
 * 画面尺寸统一 640×400（16:10），便于投屏与平板阅读。
 */
'use strict';

const W = 640, H = 400;

/* ---------------- 绘图助手 ---------------- */
function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
/**
 * 把绘图指令里嵌套的数组摊平。
 * 场景是 `room([...])`、`sky([...])` 这样拼出来的，角色函数（robot/kid/...）本身也返回指令数组，
 * 所以很容易写出「数组里套数组」。不摊平的话，整组指令会被当成一条非法指令而静默丢掉，
 * 画面看起来「少画了个人」却不报错，因此这里统一兜住。
 */
function flattenCmds(list, out) {
  out = out || [];
  (list || []).forEach(item => {
    if (!item || !Array.isArray(item)) return;
    /* 一条指令的特征：第一个元素是操作名（字符串），且不是 'group'
       （group 自带子指令，要整条保留，交给 drawOne 递归处理）。
       否则它就是一个「指令数组」，需要继续摊平。 */
    if (typeof item[0] === 'string' && item[0] !== 'group') out.push(item);
    else if (item[0] === 'group') out.push(item);
    else flattenCmds(item, out);
  });
  return out;
}

/**
 * 把一条指令画成 SVG 元素。
 * o.class 会原样写到元素的 class 上——角色系统靠这个挂 CSS 动效（眨眼、浮动、摇尾巴），
 * 服务端只画静态的一帧，动起来交给浏览器，这样既有生命感又不会卡。
 */
function drawOne(c, depth) {
  if (!c) return '';
  const t = c[0];
  const o = (c[c.length - 1] && typeof c[c.length - 1] === 'object' && !Array.isArray(c[c.length - 1])) ? c[c.length - 1] : {};
  const cls = o.class ? ' class="' + esc(o.class) + '"' : '';
  const op = o.opacity !== undefined ? ' opacity="' + o.opacity + '"' : '';
  /* style 用来挂 mix-blend-mode：环境色温靠它把整页染上一层光 */
  const sty = o.style ? ' style="' + esc(o.style) + '"' : '';
  switch (t) {
    case 'group': {
      /* ['group', {class:'pb-blink'}, [子指令...]]
         注意：group 的最后一个元素是数组，所以通用取 o 的方式在这里拿不到选项，要直接读 c[1]。 */
      const go = (c[1] && typeof c[1] === 'object') ? c[1] : {};
      const gcls = go.class ? ' class="' + esc(go.class) + '"' : '';
      const gtf = go.transform ? ' transform="' + esc(go.transform) + '"' : '';
      /* filter 用来做景深（背景柔焦、前景虚化），漏掉整层模糊就没了 */
      const gfl = go.filter ? ' filter="' + esc(go.filter) + '"' : '';
      const gop = go.opacity !== undefined ? ' opacity="' + go.opacity + '"' : '';
      return '<g' + gcls + gtf + gfl + gop + '>' +
        flattenCmds(c[2] ? [c[2]] : []).map(x => drawOne(x, (depth || 0) + 1)).join('') + '</g>';
    }
    case 'rect':
      return '<rect x="' + c[1] + '" y="' + c[2] + '" width="' + c[3] + '" height="' + c[4] +
        '" rx="' + (o.rx === undefined ? 10 : o.rx) + '" fill="' + (o.fill || 'none') + '"' +
        (o.stroke ? ' stroke="' + o.stroke + '" stroke-width="' + (o.width || 1.6) + '"' : '') + op + cls + sty + '/>';
    case 'circle':
      return '<circle cx="' + c[1] + '" cy="' + c[2] + '" r="' + c[3] + '" fill="' + (o.fill || 'none') + '"' +
        (o.stroke ? ' stroke="' + o.stroke + '" stroke-width="' + (o.width || 1.6) + '"' : '') + op + cls + '/>';
    case 'ellipse':
      return '<ellipse cx="' + c[1] + '" cy="' + c[2] + '" rx="' + c[3] + '" ry="' + c[4] + '" fill="' + (o.fill || 'none') + '"' +
        (o.stroke ? ' stroke="' + o.stroke + '" stroke-width="' + (o.width || 1.6) + '"' : '') + op + cls + '/>';
    case 'line':
      return '<line x1="' + c[1] + '" y1="' + c[2] + '" x2="' + c[3] + '" y2="' + c[4] + '" stroke="' + (o.stroke || '#333') +
        '" stroke-width="' + (o.width || 1.6) + '"' + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + op + cls + ' stroke-linecap="round"/>';
    case 'path':
      return '<path d="' + c[1] + '" fill="' + (o.fill || 'none') + '" stroke="' + (o.stroke || 'none') +
        '" stroke-width="' + (o.width || 2) + '"' + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + op + cls +
        ' stroke-linecap="round" stroke-linejoin="round"/>';
    case 'poly':
      return '<polygon points="' + c[1].map(p => p[0] + ',' + p[1]).join(' ') + '" fill="' + (o.fill || 'none') +
        '" stroke="' + (o.stroke || 'none') + '" stroke-width="' + (o.width || 1.6) + '"' + op + cls + '/>';
    case 'text':
      return '<text x="' + c[1] + '" y="' + c[2] + '" font-size="' + (o.size || 14) + '" fill="' + (o.fill || '#243044') + '"' +
        (o.anchor ? ' text-anchor="' + o.anchor + '"' : '') + (o.weight ? ' font-weight="' + o.weight + '"' : '') + op + cls +
        ' font-family="inherit">' + esc(c[3]) + '</text>';
    case 'defs':
      return c[1];
    default:
      return '';
  }
}

function toSvg(cmds, w, h, label) {
  const list = flattenCmds(cmds);
  /* 本页渐变由 render 阶段注册，这里直接输出 */
  const built = list.map(c => drawOne(c, 0)).join('');
  /* 整页纸纹永远画在最上层，让画面统一带上手绘纸感 */
  const grain = '<rect width="' + w + '" height="' + h + '" fill="#8a7050" opacity="0.05" pointer-events="none" filter="url(#grain)"/>';
  /* 渐变定义：每个渐变 id 生成一条 linearGradient，让背景不再是平涂 */
  const grads = Object.keys(GRADS).map(function (k) {
    const g = GRADS[k];
    return '<linearGradient id="' + k + '" x1="' + g.x1 + '" y1="' + g.y1 + '" x2="' + g.x2 + '" y2="' + g.y2 + '">' +
      '<stop offset="0%" stop-color="' + g.from + '"/><stop offset="100%" stop-color="' + g.to + '"/></linearGradient>';
  }).join('');
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
    esc(label || '绘本插图') + '">' + painterlyDefs().replace('</defs>', grads + '</defs>') + built + grain + '</svg>';
}

const rect = (x, y, w, h, o) => ['rect', x, y, w, h, o || {}];
const circle = (cx, cy, r, o) => ['circle', cx, cy, r, o || {}];
const ellipse = (cx, cy, rx, ry, o) => ['ellipse', cx, cy, rx, ry, o || {}];
const text = (x, y, s, o) => ['text', x, y, String(s), o || {}];
const path = (d, o) => ['path', d, o || {}];
const line = (x1, y1, x2, y2, o) => ['line', x1, y1, x2, y2, o || {}];
const poly = (pts, o) => ['poly', pts, o || {}];
const group = arr => arr;
/** 成组显示，可挂 CSS class：group('pb-blink', [眼睛...]) */
const groupCls = (cls, arr) => ['group', { class: cls }, arr];

const C = {
  ink: '#243044', soft: '#5b6b7c', muted: '#9aa8b8',
  green: '#1f6f5c', greenL: '#e3f1ec',
  blue: '#2b7fb8', blueL: '#e2eff8',
  amber: '#c98a1b', amberL: '#fbf0da',
  rose: '#c2566f', roseL: '#fbe6ec',
  violet: '#7c5cd6', violetL: '#eee8fb',
  skin: '#f6d6bd', hair: '#4a3728',
  metal: '#dfe6ee', metalD: '#b9c4d0',
  warm: '#fff4e2', sky: '#eaf4fb', grass: '#e6f2e6'
};

/* ================= 场景底板 ================= */
function sky(extra) {
  const out = [
    rect(0, 0, W, H, { rx: 0, fill: C.sky }),
    circle(560, 62, 34, { fill: '#ffe9b0' }),
    circle(96, 70, 30, { fill: '#ffffff', opacity: 0.85 }),
    circle(130, 76, 22, { fill: '#ffffff', opacity: 0.85 }),
    circle(66, 80, 20, { fill: '#ffffff', opacity: 0.85 }),
    rect(0, 288, W, H - 288, { rx: 0, fill: C.grass })
  ];
  return out.concat(extra || []);
}
function room(extra) {
  const out = [
    rect(0, 0, W, H, { rx: 0, fill: '#fdf6ea' }),
    rect(0, 300, W, H - 300, { rx: 0, fill: '#f0e2cd' }),
    line(0, 300, W, 300, { stroke: '#e2d2b8', width: 2 }),
    rect(74, 84, 126, 96, { rx: 8, fill: C.sky, stroke: '#cfe0ee' }),
    line(137, 84, 137, 180, { stroke: '#cfe0ee', width: 5 }),
    line(74, 132, 200, 132, { stroke: '#cfe0ee', width: 5 }),
    text(228, 62, '🌿', { size: 30 })
  ];
  return out.concat(extra || []);
}
function night(extra) {
  const out = [
    rect(0, 0, W, H, { rx: 0, fill: '#2c3550' }),
    circle(548, 66, 30, { fill: '#fdf3d0' }),
    circle(530, 56, 26, { fill: '#2c3550' })
  ];
  for (let i = 0; i < 22; i++) {
    const x = (i * 97) % 620 + 12, y = (i * 53) % 200 + 18;
    out.push(circle(x, y, i % 3 === 0 ? 2.4 : 1.6, { fill: '#fff8dc', opacity: 0.9 }));
  }
  out.push(rect(0, 310, W, H - 310, { rx: 0, fill: '#3a4566' }));
  return out.concat(extra || []);
}

/* ================= 角色 ================= */
/** 小启：圆头小机器人，情绪用 eyes 控制 */
function robot(x, y, s, o) {
  o = o || {};
  const eyes = o.eyes || 'open';
  const color = o.color || C.green;
  const out = [];
  out.push(ellipse(x, y + 52 * s, 40 * s, 9 * s, { fill: 'rgba(36,48,68,.10)' }));
  out.push(line(x, y - 30 * s, x, y - 44 * s, { stroke: C.metalD, width: 3 * s }));
  out.push(circle(x, y - 49 * s, 6 * s, { fill: C.amber }));
  out.push(rect(x - 26 * s, y + 18 * s, 52 * s, 34 * s, { rx: 12 * s, fill: color }));
  out.push(rect(x - 34 * s, y - 10 * s, 68 * s, 54 * s, { rx: 18 * s, fill: '#ffffff', stroke: color, width: 3 * s }));
  out.push(circle(x - 12 * s, y + 12 * s, 6.5 * s, { fill: eyes === 'closed' ? color : C.ink }));
  out.push(circle(x + 12 * s, y + 12 * s, 6.5 * s, { fill: eyes === 'closed' ? color : C.ink }));
  if (eyes === 'open') {
    out.push(circle(x - 10 * s, y + 10 * s, 2.2 * s, { fill: '#ffffff' }));
    out.push(circle(x + 14 * s, y + 10 * s, 2.2 * s, { fill: '#ffffff' }));
  }
  if (eyes === 'happy') {
    out.push(path('M ' + (x - 19 * s) + ' ' + (y + 12 * s) + ' q ' + (7 * s) + ' ' + (-7 * s) + ' ' + (14 * s) + ' 0', { stroke: C.ink, width: 2.6 * s }));
    out.push(path('M ' + (x + 5 * s) + ' ' + (y + 12 * s) + ' q ' + (7 * s) + ' ' + (-7 * s) + ' ' + (14 * s) + ' 0', { stroke: C.ink, width: 2.6 * s }));
  }
  out.push(path('M ' + (x - 9 * s) + ' ' + (y + 27 * s) + ' q ' + (9 * s) + ' ' + (o.mouth === 'sad' ? -7 * s : 7 * s) + ' ' + (18 * s) + ' 0', { stroke: C.ink, width: 2.4 * s }));
  if (o.wave) {
    out.push(line(x - 30 * s, y + 26 * s, x - 48 * s, y + 2 * s, { stroke: C.metalD, width: 5 * s }));
    out.push(circle(x - 51 * s, y - 3 * s, 7 * s, { fill: C.amber }));
  }
  if (o.hold) {
    out.push(line(x + 30 * s, y + 26 * s, x + 46 * s, y + 30 * s, { stroke: C.metalD, width: 5 * s }));
    out.push(rect(x + 40 * s, y + 22 * s, 20 * s, 26 * s, { rx: 4 * s, fill: '#ffffff', stroke: C.blue, width: 2.4 * s }));
  }
  return out;
}

/** 小雨：低年级小朋友 */
function kid(x, y, s, o) {
  o = o || {};
  const happy = o.happy !== false;
  const out = [];
  out.push(ellipse(x, y + 54 * s, 30 * s, 8 * s, { fill: 'rgba(36,48,68,.10)' }));
  out.push(rect(x - 24 * s, y + 14 * s, 48 * s, 44 * s, { rx: 16 * s, fill: o.dress || C.rose }));
  out.push(line(x - 12 * s, y + 56 * s, x - 12 * s, y + 68 * s, { stroke: '#6b7a8c', width: 5 * s }));
  out.push(line(x + 12 * s, y + 56 * s, x + 12 * s, y + 68 * s, { stroke: '#6b7a8c', width: 5 * s }));
  out.push(circle(x, y - 6 * s, 26 * s, { fill: C.skin }));
  out.push(path('M ' + (x - 27 * s) + ' ' + (y - 10 * s) + ' q ' + (27 * s) + ' ' + (-34 * s) + ' ' + (54 * s) + ' 0 q ' + (-8 * s) + ' ' + (-14 * s) + ' ' + (-27 * s) + ' ' + (-12 * s) + ' q ' + (-19 * s) + ' ' + (-2 * s) + ' ' + (-27 * s) + ' ' + (12 * s), { fill: C.hair }));
  out.push(circle(x - 9 * s, y - 4 * s, 3.4 * s, { fill: C.ink }));
  out.push(circle(x + 9 * s, y - 4 * s, 3.4 * s, { fill: C.ink }));
  if (happy) out.push(path('M ' + (x - 7 * s) + ' ' + (y + 6 * s) + ' q ' + (7 * s) + ' ' + (6 * s) + ' ' + (14 * s) + ' 0', { stroke: C.ink, width: 2.2 * s }));
  else out.push(line(x - 6 * s, y + 7 * s, x + 6 * s, y + 7 * s, { stroke: C.ink, width: 2.2 * s }));
  out.push(circle(x - 18 * s, y + 2 * s, 4 * s, { fill: '#f0a0a8', opacity: 0.7 }));
  out.push(circle(x + 18 * s, y + 2 * s, 4 * s, { fill: '#f0a0a8', opacity: 0.7 }));
  return out;
}

/** 妈妈 */
function mom(x, y, s, o) {
  o = o || {};
  const out = [];
  out.push(ellipse(x, y + 56 * s, 32 * s, 8 * s, { fill: 'rgba(36,48,68,.10)' }));
  out.push(poly([[x - 30 * s, y + 62 * s], [x + 30 * s, y + 62 * s], [x + 22 * s, y + 10 * s], [x - 22 * s, y + 10 * s]], { fill: o.dress || C.violet }));
  out.push(circle(x, y - 12 * s, 25 * s, { fill: C.skin }));
  out.push(path('M ' + (x - 26 * s) + ' ' + (y - 14 * s) + ' q ' + (4 * s) + ' ' + (-30 * s) + ' ' + (52 * s) + ' ' + (-22 * s) + ' q ' + (8 * s) + ' ' + (12 * s) + ' ' + (0 * s) + ' ' + (24 * s) + ' q ' + (-10 * s) + ' ' + (-16 * s) + ' ' + (-52 * s) + ' ' + (-2 * s), { fill: C.hair }));
  out.push(circle(x - 9 * s, y - 10 * s, 3.2 * s, { fill: C.ink }));
  out.push(circle(x + 9 * s, y - 10 * s, 3.2 * s, { fill: C.ink }));
  out.push(path('M ' + (x - 7 * s) + ' ' + (y - 1 * s) + ' q ' + (7 * s) + ' ' + (6 * s) + ' ' + (14 * s) + ' 0', { stroke: C.ink, width: 2.2 * s }));
  return out;
}

/** 小猫 */
function cat(x, y, s, o) {
  o = o || {};
  const out = [];
  out.push(ellipse(x, y + 26 * s, 26 * s, 6 * s, { fill: 'rgba(36,48,68,.10)' }));
  out.push(poly([[x - 20 * s, y + 26 * s], [x + 20 * s, y + 26 * s], [x + 26 * s, y - 2 * s], [x - 26 * s, y - 2 * s]], { fill: o.color || '#f0b45e' }));
  out.push(circle(x, y - 12 * s, 19 * s, { fill: o.color || '#f0b45e' }));
  out.push(poly([[x - 19 * s, y - 22 * s], [x - 8 * s, y - 34 * s], [x - 4 * s, y - 20 * s]], { fill: o.color || '#f0b45e' }));
  out.push(poly([[x + 19 * s, y - 22 * s], [x + 8 * s, y - 34 * s], [x + 4 * s, y - 20 * s]], { fill: o.color || '#f0b45e' }));
  out.push(circle(x - 7 * s, y - 14 * s, 2.8 * s, { fill: C.ink }));
  out.push(circle(x + 7 * s, y - 14 * s, 2.8 * s, { fill: C.ink }));
  out.push(poly([[x - 3 * s, y - 7 * s], [x + 3 * s, y - 7 * s], [x, y - 4 * s]], { fill: C.rose }));
  out.push(path('M ' + (x - 12 * s) + ' ' + (y - 4 * s) + ' L ' + (x - 24 * s) + ' ' + (y - 8 * s), { stroke: C.soft, width: 1.6 * s }));
  out.push(path('M ' + (x + 12 * s) + ' ' + (y - 4 * s) + ' L ' + (x + 24 * s) + ' ' + (y - 8 * s), { stroke: C.soft, width: 1.6 * s }));
  return out;
}

/** 小狗 */
function dog(x, y, s, o) {
  o = o || {};
  const out = [];
  out.push(ellipse(x, y + 26 * s, 26 * s, 6 * s, { fill: 'rgba(36,48,68,.10)' }));
  out.push(rect(x - 22 * s, y - 2 * s, 44 * s, 30 * s, { rx: 12 * s, fill: o.color || '#c99a6b' }));
  out.push(circle(x, y - 14 * s, 18 * s, { fill: o.color || '#c99a6b' }));
  out.push(ellipse(x - 20 * s, y - 16 * s, 7 * s, 13 * s, { fill: '#a97c50' }));
  out.push(ellipse(x + 20 * s, y - 16 * s, 7 * s, 13 * s, { fill: '#a97c50' }));
  out.push(circle(x - 7 * s, y - 16 * s, 2.8 * s, { fill: C.ink }));
  out.push(circle(x + 7 * s, y - 16 * s, 2.8 * s, { fill: C.ink }));
  out.push(ellipse(x, y - 6 * s, 4 * s, 3 * s, { fill: C.ink }));
  out.push(path('M ' + (x - 6 * s) + ' ' + (y + 1 * s) + ' q ' + (6 * s) + ' ' + (6 * s) + ' ' + (12 * s) + ' 0', { stroke: C.ink, width: 1.8 * s }));
  return out;
}

/* ================= 物件 ================= */
function phone(x, y, s, o) {
  o = o || {};
  return [
    rect(x - 26 * s, y - 46 * s, 52 * s, 92 * s, { rx: 10 * s, fill: '#39445c' }),
    rect(x - 22 * s, y - 40 * s, 44 * s, 74 * s, { rx: 5 * s, fill: o.screen || '#dff0f8' }),
    circle(x, y + 40 * s, 3.4 * s, { fill: '#8d99ae' }),
    o.icon ? text(x, y - 4 * s, o.icon, { size: 30 * s, anchor: 'middle' }) : null
  ].filter(Boolean);
}
function speaker(x, y, s, o) {
  o = o || {};
  return [
    ellipse(x, y + 40 * s, 30 * s, 7 * s, { fill: 'rgba(36,48,68,.10)' }),
    rect(x - 27 * s, y - 44 * s, 54 * s, 84 * s, { rx: 16 * s, fill: o.color || '#7fa8d8' }),
    circle(x, y - 4 * s, 20 * s, { fill: 'rgba(255,255,255,.55)' }),
    circle(x, y - 4 * s, 11 * s, { fill: 'rgba(255,255,255,.9)' }),
    circle(x, y - 4 * s, 4 * s, { fill: o.color || '#7fa8d8' }),
    rect(x - 16 * s, y + 26 * s, 32 * s, 6 * s, { rx: 3 * s, fill: 'rgba(255,255,255,.6)' })
  ];
}
function camera(x, y, s) {
  return [
    rect(x - 34 * s, y - 22 * s, 68 * s, 48 * s, { rx: 10 * s, fill: '#5b6b8c' }),
    circle(x, y + 2 * s, 16 * s, { fill: '#39445c' }),
    circle(x, y + 2 * s, 9 * s, { fill: '#9fd0e8' }),
    circle(x - 3 * s, y - 1 * s, 3 * s, { fill: '#ffffff', opacity: 0.8 }),
    rect(x - 12 * s, y - 32 * s, 24 * s, 10 * s, { rx: 4 * s, fill: '#5b6b8c' }),
    circle(x + 24 * s, y - 14 * s, 4 * s, { fill: '#f0b45e' })
  ];
}
function robotArm(x, y, s) {
  return [
    rect(x - 30 * s, y + 14 * s, 60 * s, 26 * s, { rx: 8 * s, fill: '#b9c4d0' }),
    line(x, y + 14 * s, x, y - 20 * s, { stroke: '#8d99ae', width: 8 * s }),
    line(x, y - 20 * s, x + 34 * s, y - 20 * s, { stroke: '#8d99ae', width: 8 * s }),
    circle(x, y + 14 * s, 7 * s, { fill: '#5b6b8c' }),
    circle(x, y - 20 * s, 7 * s, { fill: '#5b6b8c' }),
    poly([[x + 30 * s, y - 32 * s], [x + 30 * s, y - 8 * s], [x + 44 * s, y - 12 * s], [x + 44 * s, y - 28 * s]], { fill: '#8d99ae' })
  ];
}
function photo(x, y, s, o) {
  o = o || {};
  return [
    rect(x - 30 * s, y - 24 * s, 60 * s, 48 * s, { rx: 5 * s, fill: '#ffffff', stroke: '#d8cdb8', width: 2 * s }),
    rect(x - 25 * s, y - 19 * s, 50 * s, 38 * s, { rx: 3 * s, fill: o.tint || C.sky }),
    text(x, y + 8 * s, o.icon || '🐱', { size: 24 * s, anchor: 'middle' })
  ];
}
function star(x, y, s, fill) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + i * Math.PI / 5;
    const r = (i % 2 === 0 ? 1 : 0.45) * 13 * s;
    pts.push([x + Math.cos(ang) * r, y + Math.sin(ang) * r]);
  }
  return [poly(pts, { fill: fill || '#f5c451' })];
}
function bubble(x, y, w, h, o) {
  o = o || {};
  return [
    rect(x, y, w, h, { rx: 16, fill: o.fill || '#ffffff', stroke: o.stroke || '#cfd9e6', width: 2.4 }),
    poly([[x + 26, y + h], [x + 52, y + h], [x + 26, y + h + 18]], { fill: o.fill || '#ffffff', stroke: o.stroke || '#cfd9e6', width: 2.4 })
  ];
}
function heart(x, y, s, fill) {
  return [path('M ' + x + ' ' + (y + 8 * s) + ' C ' + (x - 12 * s) + ' ' + (y - 4 * s) + ' ' + (x - 4 * s) + ' ' + (y - 14 * s) + ' ' + x + ' ' + (y - 6 * s) +
    ' C ' + (x + 4 * s) + ' ' + (y - 14 * s) + ' ' + (x + 12 * s) + ' ' + (y - 4 * s) + ' ' + x + ' ' + (y + 8 * s) + ' Z', { fill: fill || '#e58098' })];
}
function sparkle(x, y, s, fill) {
  return [
    path('M ' + x + ' ' + (y - 10 * s) + ' L ' + (x + 3 * s) + ' ' + (y - 3 * s) + ' L ' + (x + 10 * s) + ' ' + y + ' L ' + (x + 3 * s) + ' ' + (y + 3 * s) +
      ' L ' + x + ' ' + (y + 10 * s) + ' L ' + (x - 3 * s) + ' ' + (y + 3 * s) + ' L ' + (x - 10 * s) + ' ' + y + ' L ' + (x - 3 * s) + ' ' + (y - 3 * s) + ' Z',
      { fill: fill || '#f5c451' })
  ];
}
function tree(x, y, s) {
  return [
    rect(x - 9 * s, y, 18 * s, 46 * s, { rx: 5 * s, fill: '#a97c50' }),
    circle(x, y - 6 * s, 30 * s, { fill: '#7fbf7f' }),
    circle(x - 22 * s, y + 12 * s, 20 * s, { fill: '#8fcb8f' }),
    circle(x + 22 * s, y + 12 * s, 20 * s, { fill: '#8fcb8f' })
  ];
}

/**
 * 插图底部的说明文字。
 * 早期版本把说明直接用浅灰画在场景上，在浅色背景里几乎看不见；
 * 这里统一改成「半透明小牌子 + 深色字」，保证对比度。
 */
function captionPlate(y, s, fill) {
  const chars = String(s).length;
  const w = Math.min(560, 40 + chars * 15.5);
  return [
    rect(320 - w / 2, y, w, 32, { rx: 16, fill: fill || 'rgba(255,255,255,.92)', stroke: 'rgba(36,48,68,.12)', width: 1.4 }),
    text(320, y + 22, s, { size: 15, anchor: 'middle', fill: C.ink })
  ];
}

/* ================= 手绘质感：水彩 / 彩铅 / 纸纹 / 柔光（纯代码生成，零素材） ================= */
/**
 * 精装绘本的质感来自四件事，这里全部用 SVG 滤镜与叠色实现，不依赖任何图片素材：
 *   1) 水彩   — 边缘自然扩散、颜色有浓淡（湍流位移 + 分层半透明叠色）
 *   2) 彩铅   — 边缘有颗粒与轻微抖动（高频湍流位移）
 *   3) 纸纹   — 整页叠一层极淡的纸纤维
 *   4) 光影   — 柔光、光柱、落地投影、漂浮微尘
 */
/** 渐变表：toSvg 会把每条转成 linearGradient，用来替代平涂背景 */
const GRADS = {};
let gradSeq = 0;
let curPage = 0;
/** 开一页：先定页号，再画内容，这样渐变才归属正确 */
function beginPage() {
  curPage++;
  Object.keys(GRADS).forEach(function (k) { if (GRADS[k].page !== curPage) delete GRADS[k]; });
  return curPage;
}
/** 注册一条柔和渐变，返回它的 id（拿去做 fill） */
function gradientBg(from, to, dir) {
  const id = 'g' + (++gradSeq);
  const D = { v: ['0', '0', '0', '1'], h: ['0', '0', '1', '0'], d: ['0', '0', '1', '1'], d2: ['1', '0', '0', '1'] }[dir || 'v'] || ['0', '0', '0', '1'];
  GRADS[id] = { from: from, to: to, x1: D[0], y1: D[1], x2: D[2], y2: D[3], page: curPage };
  return id;
}function painterlyDefs() {
  return '<defs>' +
    '<filter id="wc" x="-20%" y="-20%" width="140%" height="140%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="4" seed="7" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G" result="d"/>' +
      '<feGaussianBlur in="d" stdDeviation="0.5"/>' +
    '</filter>' +
    '<filter id="pc" x="-20%" y="-20%" width="140%" height="140%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="g"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="g" scale="1.6" xChannelSelector="R" yChannelSelector="G"/>' +
    '</filter>' +
    '<filter id="soft" x="-45%" y="-45%" width="190%" height="190%"><feGaussianBlur stdDeviation="14"/></filter>' +
    '<filter id="far" x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur stdDeviation="3.2"/></filter>' +
    '<filter id="near" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>' +
    '<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="11"/>' +
      '<feColorMatrix type="saturate" values="0"/></filter>' +
    /* ============ 低幼化：光影一律砍掉 ============
     * 高调平涂（High-key）才是低幼绘本该有的照明：
     * 画面里不能有任何大面积的深色阴影，角色脸上不能出现半边黑。
     * 所以 feDropShadow / feGaussianBlur 发光 / 内阴影全部移除，
     * 只保留一层「比环境色深一点」的柔和落影，颜色不是黑而是环境色的深色版。 */
    '<filter id="vol" x="-8%" y="-8%" width="116%" height="116%">' +
      /* 极轻的边缘柔化：让矢量边缘不那么「硬」，但不产生任何深色 */
      '<feGaussianBlur stdDeviation="0.35"/>' +
    '</filter>' +
  '</defs>';
}
/** 带质感的形状：给指令的选项加 filter */
function textured(cmd, tex) {
  const o = cmd[cmd.length - 1];
  if (o && typeof o === 'object' && !Array.isArray(o)) o.filter = 'url(#' + (tex || 'wc') + ')';
  return cmd;
}
/**
 * 环境色温：整页叠一层带混合模式的色，画面立刻从「扁平矢量」变成「有空气」。
 * 清晨暖黄、黄昏橙粉、夜晚深蓝，各对应一种 mood。
 */
/**
 * 环境色温。
 * 低幼画面要「绝对明亮」—— multiply 会整体压暗，所以只留极轻的一层；
 * 深蓝的夜晚色（#3f4a72 @0.34）直接删掉，那会变成「阴暗恐怖」。
 */
const TEMP = {
  dawn:   { color: '#ffe9b8', mode: 'screen', op: 0.10 },
  warm:   { color: '#ffe0c4', mode: 'screen', op: 0.09 },
  dusk:   { color: '#ffd8e8', mode: 'screen', op: 0.10 },
  night:  { color: '#d8e4ff', mode: 'screen', op: 0.12 },
  bright: { color: '#fff6d8', mode: 'screen', op: 0.12 },
  cool:   { color: '#e0eefc', mode: 'screen', op: 0.10 }
};
function tempOverlay(kind) {
  const t = TEMP[kind] || TEMP.bright;
  return rect(0, 0, 640, 400, { rx: 0, fill: t.color, stroke: 'none', opacity: t.op, style: 'mix-blend-mode:' + t.mode });
}
/** mood → 色温 */
function tempOfMood(mood) {
  if (mood === 'expect') return 'dusk';
  if (mood === 'success' || mood === 'surprise' || mood === 'wonder') return 'bright';
  if (mood === 'setback' || mood === 'worried') return 'cool';
  if (mood === 'warm') return 'warm';
  return 'dawn';
}

/** 全页纸纹（最后叠一层，透明度极低） */
function paperGrain(op) {
  return rect(0, 0, 640, 400, { rx: 0, fill: '#8a7050', opacity: op || 0.055, stroke: 'none', filter: 'url(#grain)' });
}
/** 投影：角色与道具的落地体积感 */
function groundShadow(x, y, w) {
  return ellipse(x, y, w || 40, (w || 40) * 0.26, { fill: 'rgba(120,96,64,.20)', stroke: 'none', filter: 'url(#near)' });
}
/** 接触阴影：角色扶着／靠着某个物件的接触点 */
function contactShadow(x, y, s) {
  return ellipse(x, y, 16 * (s || 1), 5.5 * (s || 1), { fill: 'rgba(110,88,60,.30)', stroke: 'none' });
}
/** 光柱：从窗户或灯具斜射进来的体积光 */
function lightShaft(x, y, w, h, rot, color) {
  return ['group', { transform: 'rotate(' + (rot || -18) + ' ' + x + ' ' + y + ')', class: 'pb-beam' }, [
    poly([[x, y], [x + w, y], [x + w * 0.62, y + h], [x - w * 0.28, y + h]],
      { fill: color || 'rgba(255,238,190,.34)', stroke: 'none', filter: 'url(#soft)' }),
    poly([[x + w * 0.18, y], [x + w * 0.62, y], [x + w * 0.44, y + h], [x + w * 0.06, y + h]],
      { fill: color || 'rgba(255,246,214,.26)', stroke: 'none', filter: 'url(#soft)' })
  ]];
}

/* ---- 手绘感：轮廓轻微抖动与不均匀涂色 ---- */
/**
 * 纯几何的圆看起来像矢量图标。给轮廓加一点点随机抖动，
 * 线条立刻有「手画出来」的温度。用确定性伪随机，保证每次渲染完全一致（服务端可缓存）。
 */
function jitterPath(pts, amp, seed) {
  const a = amp === undefined ? 1.6 : amp;
  let s = (seed || 1) * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; };
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    out.push([p[0] + rnd() * a * 2, p[1] + rnd() * a * 2]);
  }
  return out;
}
/** 把圆形转成带抖动的闭合路径（手绘轮廓） */
function handCircle(cx, cy, r, o, amp, seed) {
  const pts = [];
  const n = 16;
  for (let i = 0; i < n; i++) {
    const ang = i / n * Math.PI * 2;
    const rr = r * (1 + (((seed || 1) * (i + 3)) % 7 - 3) * 0.006);
    pts.push([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr]);
  }
  const j = jitterPath(pts, amp === undefined ? 1.1 : amp, seed || 1);
  let d = 'M ' + j[0][0].toFixed(2) + ' ' + j[0][1].toFixed(2);
  for (let i = 1; i < j.length; i++) {
    /* 用二次贝塞尔让线条圆润但不完美 */
    const prev = j[i - 1], cur = j[i];
    const mx = (prev[0] + cur[0]) / 2, my = (prev[1] + cur[1]) / 2;
    d += ' Q ' + prev[0].toFixed(2) + ' ' + prev[1].toFixed(2) + ' ' + mx.toFixed(2) + ' ' + my.toFixed(2);
  }
  d += ' Z';
  return path(d, o || {});
}
/** 不均匀涂色：在平涂块上再叠一层同色但更淡、形状略有偏差的色块，模拟水彩的浓淡 */
function wash(base, x, y, r, color) {
  return [base, handCircle(x + r * 0.12, y + r * 0.1, r * 0.72, { fill: color, opacity: 0.5, stroke: 'none', filter: 'url(#wc)' }, 2.2, 5)];
}
/** 按光源方向算投影偏移：光从右上打来，影子就落在左下 */
function shadowFor(source, dist) {
  const d = dist === undefined ? 16 : dist;
  const D = {
    'right-window': [-1, 0.35], 'left-window': [1, 0.35], 'lamp': [0, 0],
    'moon': [-0.7, 0.3], 'center': [0, 0], 'overcast': [0, 0.2]
  }[source] || [0, 0.3];
  return { dx: D[0] * d, dy: D[1] * d * 0.4 };
}

/* ---- 与场景呼应的光影图案：窗格、树叶筛影、灯光台面 ---- */
/** 窗格投在地板上的斜格子光斑 */
function windowPattern(x, y, w, h, rot, color) {
  const k = 1, out = [];
  out.push(['group', { transform: 'rotate(' + (rot || -14) + ' ' + x + ' ' + y + ')', class: 'pb-beam' }, [
    poly([[x, y], [x + w, y], [x + w + h * 0.34, y + h], [x + h * 0.34, y + h]],
      { fill: color || 'rgba(255,240,196,.34)', stroke: 'none', filter: 'url(#soft)' })
  ]]);
  /* 中间的窗条：把一整块光切成四格，才像窗户投下来的影子 */
  const bars = [];
  for (let i = 1; i < 3; i++) {
    bars.push(poly([[x + w * i / 3, y], [x + w * i / 3 + 7, y],
      [x + w * i / 3 + h * 0.34 + 7, y + h], [x + w * i / 3 + h * 0.34, y + h]],
      { fill: 'rgba(140,110,70,.22)', stroke: 'none', filter: 'url(#soft)' }));
  }
  bars.push(poly([[x, y + h * 0.5], [x + w, y + h * 0.5], [x + w + h * 0.34, y + h * 0.5 + 6], [x + h * 0.34, y + h * 0.5 + 6]],
    { fill: 'rgba(140,110,70,.22)', stroke: 'none', filter: 'url(#soft)' }));
  out[0][2] = out[0][2].concat(bars);
  return out;
}
/** 树叶筛下来的碎光斑 */
function dapple(x, y, w, h, color) {
  const out = [];
  const pts = [[0.12, 0.22, 1], [0.32, 0.48, 0.8], [0.52, 0.18, 1.1], [0.72, 0.52, 0.9],
    [0.88, 0.28, 0.75], [0.22, 0.72, 0.85], [0.62, 0.78, 0.8], [0.44, 0.36, 0.7]];
  pts.forEach(p => {
    out.push(ellipse(x + w * p[0], y + h * p[1], 15 * p[2], 10 * p[2],
      { fill: color || 'rgba(255,244,208,.42)', stroke: 'none', filter: 'url(#soft)', class: 'pb-mote' }));
  });
  return out;
}
/** 台灯打在桌面上的暖光台面 */
function lampPool(x, y, w) {
  return [
    ellipse(x, y, w || 90, (w || 90) * 0.34, { fill: 'rgba(255,224,160,.42)', stroke: 'none', filter: 'url(#soft)' }),
    ellipse(x, y, (w || 90) * 0.6, (w || 90) * 0.2, { fill: 'rgba(255,238,190,.42)', stroke: 'none', filter: 'url(#soft)' })
  ];
}

/** 漂浮微尘：让房间有空气感 */
function dustMotes(list) {
  return (list || []).map(p => circle(p[0], p[1], p[2] || 2.2,
    { fill: '#fff6d8', opacity: 0.78, stroke: 'none', class: 'pb-mote', filter: 'url(#soft)' }));
}
/** 木纹 */
function woodGrain(x, y, w, h) {
  const out = [];
  for (let i = 0; i < 5; i++) {
    const yy = y + (i + 1) * (h / 6);
    out.push(path('M ' + x + ' ' + yy + ' q ' + (w * 0.3) + ' ' + (i % 2 ? 2.2 : -2.2) + ' ' + (w * 0.6) + ' 0 q ' + (w * 0.3) + ' ' + (i % 2 ? -1.8 : 1.8) + ' ' + (w * 0.4) + ' 0',
      { stroke: 'rgba(150,110,64,.18)', width: 1.6, fill: 'none', strokeLinecap: 'round' }));
  }
  return out;
}
/** 墙面纹理（柔和的方块拼接，消灭纯色墙） */
function wallTexture(x, y, w, h, color) {
  const out = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 6; c++) {
      if ((r + c) % 2) continue;
      out.push(rect(x + c * (w / 6), y + r * (h / 5), w / 6, h / 5, { rx: 0, fill: color || 'rgba(255,255,255,.14)', stroke: 'none' }));
    }
  }
  return out;
}
/** 布料褶皱（被子、窗帘、沙发） */
function fabricFold(x, y, w, h, color) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    out.push(path('M ' + (x + i * (w / 4)) + ' ' + y + ' q ' + (w / 10) + ' ' + (h / 3) + ' 0 ' + (h * 1.3),
      { stroke: color || 'rgba(150,120,90,.15)', width: 2.4, fill: 'none', strokeLinecap: 'round' }));
  }
  return out;
}

/* ================= 镜头语言 + 动势 + 氛围 + 彩蛋 ================= */

/** 九种镜头：对整个画面组做平移、缩放、旋转 */
const CAMERAS = {
  '大远景':   { name: '大远景',   scale: 0.74, tx: 320, ty: 214, rot: 0,  use: '展示场景全貌' },
  '远景':     { name: '远景',     scale: 0.96, tx: 320, ty: 208, rot: 0,  use: '角色全身 + 环境' },
  '中景':     { name: '中景',     scale: 1.24, tx: 320, ty: 210, rot: 0,  use: '角色半身 + 互动对象' },
  /* 特写不放到 2 倍以上：低龄绘本即使特写也要看得见房间，否则就变成「贴纸浮在色块上」 */
  '特写':     { name: '特写',     scale: 1.62, tx: 306, ty: 214, rot: 0,  use: '角色上半身 + 关键道具，背景仍可见' },
  '大特写':   { name: '大特写',   scale: 2.05, tx: 322, ty: 216, rot: 0,  use: '眼睛、按钮、照片局部，保留环境层次' },
  '俯视':     { name: '俯视',     scale: 1.08, tx: 320, ty: 146, rot: -5, use: '从高处往下看' },
  '仰视':     { name: '仰视',     scale: 1.2,  tx: 320, ty: 262, rot: 5,  use: '从低处往上看' },
  '倾斜构图': { name: '倾斜构图', scale: 1.14, tx: 320, ty: 202, rot: -10, use: '制造动感' },
  '框中框':   { name: '框中框',   scale: 1.18, tx: 320, ty: 206, rot: 0,  use: '透过门缝、窗户、屏幕看角色' }
};
function applyCamera(inner, camName, focus) {
  const c = CAMERAS[camName] || CAMERAS['远景'];
  /* 机位默认对着画面中心；传了 focus 就对着角色，
     否则特写会「对到背景上」，角色反而被推出画面。 */
  const fx = (focus && focus.x !== undefined) ? focus.x : c.tx;
  const fy = (focus && focus.y !== undefined) ? focus.y : c.ty;
  const t = 'translate(' + c.tx + ' ' + c.ty + ') scale(' + c.scale + ') rotate(' + c.rot +
    ') translate(' + (-fx) + ' ' + (-fy) + ')';
  return ['group', { transform: t }, inner];
}


/* ================= 暗部与投影：让物体「坐」在空间里 ================= */
/**
 * 精装绘本里没有「浮在空中的贴纸」。每样立着的东西都要有三件套：
 *   落地投影（groundShadow） + 接触阴影（contactShadow） + 底面暗部（recess）
 */
/** 桌子、柜子、床底下的暗部 */
function underShadow(x, y, w, h) {
  return ellipse(x, y, w || 60, h || 12, { fill: 'rgba(92,72,50,.24)', stroke: 'none', filter: 'url(#near)' });
}
/** 盒子、杯子、箱子内部的暗部（越往里越暗） */
function innerDark(x, y, w, h, op) {
  return [
    rect(x, y, w, h, { rx: 3, fill: 'rgba(96,72,48,' + (op || 0.22) + ')', stroke: 'none' }),
    rect(x, y, w, Math.max(2, h * 0.4), { rx: 2, fill: 'rgba(70,52,34,' + ((op || 0.22) + 0.12) + ')', stroke: 'none' })
  ];
}
/** 竖直物件（音箱、柜子、书架）靠墙的侧向暗部 */
function sideShadow(x, y, w, h) {
  return rect(x, y, w || 8, h || 40, { rx: 3, fill: 'rgba(92,72,50,.18)', stroke: 'none' });
}
/** 道具的三件套：位置由角色手边推算 */
function propWithShadow(cmdList, x, y, w) {
  const out = [groundShadow(x, y + 34, w || 22), contactShadow(x - 6, y + 26, 0.85)];
  (Array.isArray(cmdList[0]) ? cmdList : [cmdList]).forEach(c => out.push(c));
  return out;
}

/* ---- 动势与特效 ---- */
function speedLines(x, y, dir, s, color) {
  const out = [];
  for (let i = 0; i < 5; i++) {
    const a = dir + (i - 2) * 0.22;
    const len = (26 + (i % 2) * 12) * (s || 1);
    out.push(path('M ' + (x + Math.cos(a) * 12 * (s || 1)) + ' ' + (y + Math.sin(a) * 12 * (s || 1)) +
      ' L ' + (x + Math.cos(a) * (12 + len)) + ' ' + (y + Math.sin(a) * (12 + len)),
      { stroke: color || 'rgba(180,160,120,.75)', width: 3 * (s || 1), strokeLinecap: 'round' }));
  }
  return out;
}
function motionArc(x, y, s, color) {
  const k = s || 1;
  return [path('M ' + (x - 40 * k) + ' ' + (y + 10 * k) + ' q ' + (40 * k) + ' ' + (-46 * k) + ' ' + (80 * k) + ' 0',
    { stroke: color || 'rgba(180,160,120,.6)', width: 3.4 * k, dash: '9 10', strokeLinecap: 'round' })];
}
function splash(x, y, s, color) {
  const k = s || 1, out = [];
  [[-26, -12, 5], [-12, -26, 6.5], [6, -30, 5.5], [22, -16, 6], [34, -4, 4.5], [-34, 2, 4]].forEach(d => {
    out.push(ellipse(x + d[0] * k, y + d[1] * k, d[2] * k, d[2] * 1.35 * k, { fill: color || '#bfe0f0', stroke: 'none', opacity: 0.95 }));
  });
  out.push(ellipse(x, y + 4 * k, 40 * k, 9 * k, { fill: color || '#bfe0f0', opacity: 0.5, stroke: 'none' }));
  return out;
}
function dust(x, y, s) {
  const k = s || 1;
  return [[-30, 0, 12], [-10, -6, 15], [14, -3, 13], [32, 2, 10]].map(d =>
    circle(x + d[0] * k, y + d[1] * k, d[2] * k, { fill: 'rgba(210,192,164,.62)', stroke: 'none', class: 'pb-mote' }));
}
function ripple(x, y, s, color) {
  const k = s || 1;
  return [
    circle(x, y, 22 * k, { stroke: color || 'rgba(200,170,110,.5)', width: 3, fill: 'none' }),
    circle(x, y, 38 * k, { stroke: color || 'rgba(200,170,110,.32)', width: 2.4, fill: 'none' }),
    circle(x, y, 54 * k, { stroke: color || 'rgba(200,170,110,.18)', width: 2, fill: 'none' })
  ];
}

/* ---- 夸张的表情符号 ---- */
function exclaim(x, y, s, color) {
  const k = s || 1;
  return [
    path('M ' + x + ' ' + (y - 14 * k) + ' L ' + (x + 3.4 * k) + ' ' + (y + 5 * k) + ' L ' + (x - 3.4 * k) + ' ' + (y + 5 * k) + ' Z',
      { fill: color || '#e8890f', stroke: 'none', class: 'pb-twinkle' }),
    circle(x, y + 13 * k, 3.2 * k, { fill: color || '#e8890f', stroke: 'none' })
  ];
}
function sweatDrop(x, y, s, color) {
  const k = s || 1;
  return [path('M ' + x + ' ' + (y - 10 * k) + ' q ' + (8 * k) + ' ' + (11 * k) + ' 0 ' + (16 * k) +
    ' q ' + (-8 * k) + ' ' + (-5 * k) + ' 0 ' + (-16 * k) + ' Z',
    { fill: color || '#9fd0e8', stroke: 'rgba(70,120,150,.35)', width: 1.2 })];
}
function strain(x, y, s) {
  const k = s || 1;
  return [path('M ' + (x - 7 * k) + ' ' + y + ' L ' + (x + 7 * k) + ' ' + (y - 7 * k) +
    ' M ' + (x - 7 * k) + ' ' + (y - 7 * k) + ' L ' + (x + 7 * k) + ' ' + y,
    { stroke: '#e07a63', width: 3 * k, strokeLinecap: 'round' })];
}
function radialBurst(x, y, s, color) {
  const k = s || 1, out = [];
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    out.push(line(x + Math.cos(a) * 26 * k, y + Math.sin(a) * 26 * k, x + Math.cos(a) * 52 * k, y + Math.sin(a) * 52 * k,
      { stroke: color || 'rgba(255,201,77,.8)', width: 4 * k }));
  }
  return out;
}

/* ---- 氛围层 ---- */
function lightSpots(list) {
  return (list || []).map(p => ellipse(p[0], p[1], p[2] || 40, (p[2] || 40) * 0.7,
    { fill: '#fff3cf', opacity: 0.5, stroke: 'none', class: 'pb-mote' }));
}
function rain(list, s) {
  const k = s || 1;
  return (list || []).map(p => line(p[0], p[1], p[0] - 6 * k, p[1] + 22 * k,
    { stroke: 'rgba(150,190,220,.6)', width: 2.4, dash: '7 9' }));
}
function mist(list) {
  return (list || []).map(p => ellipse(p[0], p[1], p[2] || 70, (p[2] || 70) * 0.34,
    { fill: 'rgba(255,255,255,.5)', stroke: 'none', class: 'pb-mote' }));
}
function rainbow(x, y, s) {
  const cols = ['#f2a2a2', '#f5c451', '#a8d094', '#8fc7e8', '#b8a6e6'];
  const k = s || 1;
  return cols.map((c, i) => path('M ' + (x - 92 * k) + ' ' + y + ' a ' + (92 - i * 11) * k + ' ' + (92 - i * 11) * k +
    ' 0 0 1 ' + (184 - i * 22) * k + ' 0', { stroke: c, width: 11 * k, fill: 'none', opacity: 0.88 }));
}
function starfield(list) {
  return (list || []).map(p => circle(p[0], p[1], p[2] || 2.4, { fill: '#fff8dc', opacity: 0.92, stroke: 'none', class: 'pb-twinkle' }));
}
function fallingStars(list, color) {
  return (list || []).map(p => {
    const x = p[0], y = p[1], k = p[2] || 1, pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const r = (i % 2 === 0 ? 1 : 0.45) * 13 * k;
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
    return poly(pts, { fill: color || '#ffc94d', stroke: 'none', class: 'pb-mote' });
  });
}

/* ---- 彩蛋层 ---- */
const EGGS = {
  cat: (x, y, s) => cat(x, y, s || 0.5, { color: '#f0b45e' }),
  picture: (x, y, s) => {
    const k = s || 1;
    return [
      rect(x - 26 * k, y - 20 * k, 52 * k, 40 * k, { rx: 4 * k, fill: '#fffdf6', stroke: 'rgba(150,120,80,.4)', width: 2 }),
      path('M ' + (x - 18 * k) + ' ' + (y + 10 * k) + ' l ' + (12 * k) + ' ' + (-16 * k) + ' l ' + (10 * k) + ' ' + (11 * k) +
        ' l ' + (8 * k) + ' ' + (-7 * k) + ' l ' + (6 * k) + ' ' + (12 * k) + ' Z', { fill: '#a8d094', stroke: 'none' }),
      circle(x + 10 * k, y - 9 * k, 4 * k, { fill: '#ffd98a', stroke: 'none' })
    ];
  },
  footprints: (x, y, s) => {
    const k = s || 1, out = [];
    for (let i = 0; i < 4; i++) out.push(ellipse(x + i * 22 * k, y + (i % 2 ? 6 : 0) * k, 7 * k, 9 * k, { fill: 'rgba(170,145,110,.42)', stroke: 'none' }));
    return out;
  },
  bird: (x, y, s) => {
    const k = s || 1;
    return [path('M ' + (x - 12 * k) + ' ' + y + ' q ' + (6 * k) + ' ' + (-8 * k) + ' ' + (12 * k) + ' 0 q ' + (6 * k) + ' ' + (8 * k) + ' ' + (12 * k) + ' 0',
      { stroke: '#5b6b8c', width: 2.6 * k, fill: 'none', strokeLinecap: 'round' })];
  },
  sun: (x, y, s) => {
    const k = s || 1, out = [circle(x, y, 11 * k, { fill: '#ffd98a', stroke: 'none', class: 'pb-twinkle' })];
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      out.push(line(x + Math.cos(a) * 14 * k, y + Math.sin(a) * 14 * k, x + Math.cos(a) * 20 * k, y + Math.sin(a) * 20 * k, { stroke: '#ffd98a', width: 2.6 * k }));
    }
    return out;
  },
  ball: (x, y, s, color) => {
    const k = s || 1;
    return [
      circle(x, y, 11 * k, { fill: color || '#e58098', stroke: 'rgba(150,90,110,.35)', width: 1.6 }),
      path('M ' + (x - 9 * k) + ' ' + (y - 4 * k) + ' q ' + (9 * k) + ' ' + (7 * k) + ' ' + (18 * k) + ' 0', { stroke: 'rgba(255,255,255,.75)', width: 2.6 * k, fill: 'none' })
    ];
  },
  plane: (x, y, s) => {
    const k = s || 1;
    return [
      poly([[x, y], [x + 26 * k, y - 11 * k], [x + 9 * k, y + 3 * k]], { fill: '#ffffff', stroke: 'rgba(150,160,180,.6)', width: 1.6 }),
      poly([[x, y], [x + 9 * k, y + 3 * k], [x + 4 * k, y + 13 * k]], { fill: '#eef2f7', stroke: 'rgba(150,160,180,.6)', width: 1.6 })
    ];
  },
  glowButton: (x, y, s, color) => {
    const k = s || 1;
    return [
      circle(x, y, 15 * k, { fill: color || '#ffc94d', stroke: 'rgba(200,140,20,.5)', width: 2.4, class: 'pb-glow' }),
      circle(x, y, 7 * k, { fill: '#fff6db', stroke: 'none' }),
      circle(x, y, 26 * k, { fill: 'none', stroke: color || 'rgba(255,201,77,.5)', width: 2.4, class: 'pb-twinkle' })
    ];
  },
  star: (x, y, s, color) => fallingStars([[x, y, s]], color)
};

module.exports = { W, H, C, toSvg, esc, rect, circle, ellipse, text, path, line, poly, group, groupCls, drawOne, flattenCmds,
  sky, room, night, captionPlate,
  robot, kid, mom, cat, dog, phone, speaker, camera, robotArm, photo, star, bubble, heart, sparkle, tree,
  /* 镜头 · 动势 · 氛围 · 彩蛋 */
  CAMERAS, applyCamera,
  speedLines, motionArc, splash, dust, ripple,
  exclaim, sweatDrop, strain, radialBurst,
  lightSpots, rain, mist, rainbow, starfield, fallingStars,
  EGGS,
  /* 手绘质感：水彩 / 彩铅 / 纸纹 / 光影 */
  painterlyDefs, gradientBg, beginPage, textured, paperGrain, groundShadow, contactShadow,
  underShadow, innerDark, sideShadow, propWithShadow,
  lightShaft, dustMotes, woodGrain, wallTexture, fabricFold,
  windowPattern, dapple, lampPool, TEMP, tempOverlay, tempOfMood,
  jitterPath, handCircle, wash, shadowFor };
