/**
 * AI 绘本 · 画面编排（升级版）
 *
 * 每一页 = 情绪背景 + 角色摆位 + 道具 + 气泡 + 点缀。
 * 构图规则（针对 6～9 岁）：
 *   · 主要角色占画面高度 40%～60%，永远站在 y≈290 的「地面线」上
 *   · 背景不超过三层：底色光晕 / 地面 / 一个简单背景物
 *   · 每页只有一个视觉焦点，不堆信息
 *   · 气泡固定贴左上或右上，不压住角色
 */
'use strict';

const A = require('./pb-art');
const cast = require('./pb-cast');
const { sparkles, motes, sweat, qmark, sayBubble, bubbleText, medal, character, backdrop } = cast;
/* 道具与彩蛋里用到的绘图助手（与 pb-art 同名，直接解构过来用） */
const { rect, circle, ellipse, text, path, line, poly } = A;

const GROUND = 288;     // 角色站位基准（脚底）
const SCALE = 1.72;     // 主角标准缩放：约等于画面高度的 55%

/* ---------- 小道具 ---------- */
const prop = {
  box: (x, y, s) => [
    A.rect(x - 46 * s, y - 40 * s, 92 * s, 46 * s, { rx: 10 * s, fill: '#d9b98c', stroke: 'rgba(120,90,50,.35)', width: 2 }),
    A.poly([[x - 46 * s, y - 40 * s], [x, y - 62 * s], [x + 46 * s, y - 40 * s]], { fill: '#e8cda0', stroke: 'rgba(120,90,50,.35)', width: 2 }),
    A.rect(x - 8 * s, y - 30 * s, 16 * s, 12 * s, { rx: 3 * s, fill: '#b98b52', stroke: 'none' })
  ],
  book: (x, y, s) => [
    A.poly([[x - 34 * s, y - 8 * s], [x, y - 18 * s], [x, y + 6 * s], [x - 34 * s, y + 16 * s]], { fill: '#8fc7e8', stroke: 'rgba(60,110,150,.35)', width: 2 }),
    A.poly([[x + 34 * s, y - 8 * s], [x, y - 18 * s], [x, y + 6 * s], [x + 34 * s, y + 16 * s]], { fill: '#a9d6ee', stroke: 'rgba(60,110,150,.35)', width: 2 }),
    A.line(x, y - 18 * s, x, y + 6 * s, { stroke: 'rgba(60,110,150,.35)', width: 2 })
  ],
  photoWall: (x, y, s, icons) => {
    const out = [A.rect(x - 150 * s, y - 100 * s, 300 * s, 176 * s, { rx: 14 * s, fill: '#fffaf0', stroke: 'rgba(140,110,70,.3)', width: 2 })];
    const list = icons || ['🐱', '🐶', '🌸', '🐱', '🎂', '🐱'];
    list.forEach((ic, i) => {
      const cx = x - 100 * s + (i % 3) * 100 * s, cy = y - 56 * s + Math.floor(i / 3) * 84 * s;
      out.push(A.rect(cx - 36 * s, cy - 30 * s, 72 * s, 60 * s, { rx: 6 * s, fill: '#ffffff', stroke: 'rgba(150,130,100,.3)', width: 1.6 }));
      out.push(A.text(cx, cy + 12 * s, ic, { size: 34 * s, anchor: 'middle' }));
    });
    return out;
  },
  pixelGrid: (x, y, s, on) => {
    const out = [A.rect(x - 76 * s, y - 76 * s, 152 * s, 152 * s, { rx: 12 * s, fill: '#ffffff', stroke: 'rgba(90,140,180,.4)', width: 2 })];
    const lit = on || [[1, 1], [1, 2], [2, 1], [4, 4], [5, 3], [3, 5], [6, 2], [2, 6]];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isOn = lit.some(p => p[0] === r && p[1] === c);
        out.push(A.rect(x - 68 * s + c * 17 * s, y - 68 * s + r * 17 * s, 15 * s, 15 * s, {
          rx: 2.6 * s, fill: isOn ? '#7fb8d8' : 'rgba(70,110,150,.12)', stroke: 'none'
        }));
      }
    }
    return out;
  },
  speaker: (x, y, s) => [
    A.rect(x - 34 * s, y - 56 * s, 68 * s, 96 * s, { rx: 20 * s, fill: '#8fb8e0', stroke: 'rgba(60,110,150,.35)', width: 2 }),
    A.circle(x, y - 6 * s, 24 * s, { fill: 'rgba(255,255,255,.5)', stroke: 'none' }),
    A.circle(x, y - 6 * s, 13 * s, { fill: 'rgba(255,255,255,.92)', stroke: 'none' }),
    A.circle(x, y - 6 * s, 5 * s, { fill: '#5f8cbe', stroke: 'none' }),
    A.rect(x - 20 * s, y + 26 * s, 40 * s, 6 * s, { rx: 3 * s, fill: 'rgba(255,255,255,.6)', stroke: 'none' })
  ],
  camera: (x, y, s) => [
    A.rect(x - 42 * s, y - 26 * s, 84 * s, 56 * s, { rx: 12 * s, fill: '#66788f', stroke: 'none' }),
    A.circle(x, y + 2 * s, 19 * s, { fill: '#3f4c60', stroke: 'none' }),
    A.circle(x, y + 2 * s, 11 * s, { fill: '#9fd0e8', stroke: 'none' }),
    A.circle(x - 4 * s, y - 2 * s, 4 * s, { fill: '#ffffff', opacity: 0.85, stroke: 'none' }),
    A.rect(x - 14 * s, y - 38 * s, 28 * s, 12 * s, { rx: 5 * s, fill: '#66788f', stroke: 'none' }),
    A.circle(x + 30 * s, y - 16 * s, 4.6 * s, { fill: '#ffc94d', stroke: 'none', className: 'pb-twinkle' })
  ],
  phone: (x, y, s) => [
    A.rect(x - 30 * s, y - 54 * s, 60 * s, 108 * s, { rx: 12 * s, fill: '#4a5568', stroke: 'none' }),
    A.rect(x - 25 * s, y - 47 * s, 50 * s, 88 * s, { rx: 6 * s, fill: '#dff0f8', stroke: 'none' }),
    A.text(x, y - 2 * s, '🙂', { size: 30 * s, anchor: 'middle' }),
    A.circle(x, y + 47 * s, 4 * s, { fill: '#8d99ae', stroke: 'none' })
  ],
  vacuum: (x, y, s) => [
    A.ellipse(x, y + 2 * s, 44 * s, 16 * s, { fill: '#e8eef5', stroke: 'rgba(90,120,150,.35)', width: 2 }),
    A.circle(x, y - 4 * s, 30 * s, { fill: '#f3f7fb', stroke: 'rgba(90,120,150,.35)', width: 2 }),
    A.circle(x, y - 4 * s, 12 * s, { fill: '#8fc7e8', stroke: 'none' }),
    A.circle(x - 8 * s, y - 12 * s, 4 * s, { fill: '#ffffff', opacity: 0.9, stroke: 'none' })
  ],
  star: (x, y, s, color) => sparkles([[x, y, s]], color || '#ffc94d'),
  moon: (x, y, s) => [
    A.circle(x, y, 40 * s, { fill: '#fff3cf', stroke: 'none' }),
    A.circle(x - 16 * s, y - 10 * s, 34 * s, { fill: '#3a4566', stroke: 'none' })
  ],
  lamp: (x, y, s) => [
    A.poly([[x - 30 * s, y - 20 * s], [x + 30 * s, y - 20 * s], [x + 18 * s, y + 2 * s], [x - 18 * s, y + 2 * s]], { fill: '#ffd98a', stroke: 'rgba(180,130,40,.35)', width: 2 }),
    A.line(x, y + 2 * s, x, y + 40 * s, { stroke: '#b0a088', width: 5 * s }),
    A.ellipse(x, y + 42 * s, 22 * s, 7 * s, { fill: '#c9b79a', stroke: 'none' }),
    A.ellipse(x, y + 16 * s, 40 * s, 22 * s, { fill: '#fff3cf', opacity: 0.55, stroke: 'none', className: 'pb-glow' })
  ],
  blockTower: (x, y, s, colors) => {
    const cs = colors || ['#f0a94e', '#8fc7e8', '#a8d094', '#e58098'];
    const out = [];
    for (let i = 0; i < cs.length; i++) {
      out.push(A.rect(x - 30 * s, y - (i + 1) * 26 * s, 60 * s, 24 * s, { rx: 6 * s, fill: cs[i], stroke: 'rgba(90,70,40,.2)', width: 1.8 }));
    }
    return out;
  },
  bolt: (x, y, s, on) => [
    A.rect(x - 40 * s, y - 30 * s, 80 * s, 60 * s, { rx: 14 * s, fill: on ? '#ffe6a8' : '#dfe6ee', stroke: 'rgba(150,120,50,.35)', width: 2.4, className: on ? 'pb-glow' : '' }),
    A.poly([[x + 6 * s, y - 18 * s], [x - 12 * s, y + 2 * s], [x - 1 * s, y + 2 * s], [x - 7 * s, y + 20 * s], [x + 13 * s, y - 4 * s], [x + 1 * s, y - 4 * s]], { fill: on ? '#e8890f' : '#9aa8b8', stroke: 'none' }),
    /* 两根插脚 */
    A.line(x - 40 * s, y - 8 * s, x - 52 * s, y - 8 * s, { stroke: '#9aa8b8', width: 5 * s }),
    A.line(x - 40 * s, y + 10 * s, x - 52 * s, y + 10 * s, { stroke: '#9aa8b8', width: 5 * s }),
    /* 电线 */
    A.path('M ' + (x + 40 * s) + ' ' + y + ' q ' + (30 * s) + ' ' + (30 * s) + ' ' + (70 * s) + ' ' + (10 * s), { stroke: '#6b7a8c', width: 4 * s, dash: '1 0' })
  ],
  /* —— 角色小道具（表演用） —— */
  magnifier: (x, y, s) => {
    const k = s || 1;
    return [
      circle(x, y, 20 * k, { fill: 'rgba(200,232,246,.75)', stroke: '#8d99ae', width: 4 * k }),
      circle(x - 6 * k, y - 6 * k, 6 * k, { fill: 'rgba(255,255,255,.85)', stroke: 'none' }),
      line(x + 14 * k, y + 14 * k, x + 34 * k, y + 34 * k, { stroke: '#a97c50', width: 7 * k })
    ];
  },
  remote: (x, y, s) => {
    const k = s || 1;
    return [
      rect(x - 13 * k, y - 26 * k, 26 * k, 52 * k, { rx: 8 * k, fill: '#66788f', stroke: 'none' }),
      circle(x, y - 14 * k, 6 * k, { fill: '#ffc94d', stroke: 'none', class: 'pb-glow' }),
      rect(x - 6 * k, y + 2 * k, 12 * k, 5 * k, { rx: 2 * k, fill: '#cdd7e2', stroke: 'none' }),
      rect(x - 6 * k, y + 11 * k, 12 * k, 5 * k, { rx: 2 * k, fill: '#cdd7e2', stroke: 'none' })
    ];
  },
  mic: (x, y, s) => {
    const k = s || 1;
    return [
      rect(x - 9 * k, y - 34 * k, 18 * k, 30 * k, { rx: 9 * k, fill: '#8d99ae', stroke: 'none' }),
      path('M ' + (x - 15 * k) + ' ' + (y - 16 * k) + ' q ' + (15 * k) + ' ' + (20 * k) + ' ' + (30 * k) + ' 0', { stroke: '#8d99ae', width: 5 * k, fill: 'none' }),
      line(x, y - 2 * k, x, y + 12 * k, { stroke: '#8d99ae', width: 5 * k }),
      ellipse(x, y + 14 * k, 16 * k, 5 * k, { fill: '#66788f', stroke: 'none' })
    ];
  },
  toolbox: (x, y, s) => {
    const k = s || 1;
    return [
      rect(x - 30 * k, y - 20 * k, 60 * k, 34 * k, { rx: 7 * k, fill: '#e8890f', stroke: 'rgba(150,90,20,.4)', width: 2 }),
      path('M ' + (x - 12 * k) + ' ' + (y - 20 * k) + ' q ' + (12 * k) + ' ' + (-12 * k) + ' ' + (24 * k) + ' 0', { stroke: '#b06a10', width: 4 * k, fill: 'none' }),
      rect(x - 30 * k, y - 6 * k, 60 * k, 6 * k, { rx: 0, fill: 'rgba(150,90,20,.25)', stroke: 'none' })
    ];
  },
  balloon: (x, y, s, color) => {
    const k = s || 1;
    return [
      ellipse(x, y - 34 * k, 20 * k, 24 * k, { fill: color || '#e58098', stroke: 'rgba(150,90,110,.35)', width: 2 }),
      path('M ' + (x - 5 * k) + ' ' + (y - 12 * k) + ' l ' + (10 * k) + ' 0 l ' + (-5 * k) + ' ' + (6 * k) + ' Z', { fill: color || '#e58098', stroke: 'none' }),
      path('M ' + x + ' ' + (y - 6 * k) + ' q ' + (10 * k) + ' ' + (18 * k) + ' ' + (-4 * k) + ' ' + (34 * k), { stroke: 'rgba(120,110,100,.5)', width: 1.8 * k, fill: 'none' }),
      ellipse(x - 7 * k, y - 42 * k, 6 * k, 8 * k, { fill: 'rgba(255,255,255,.6)', stroke: 'none' })
    ];
  },
  umbrella: (x, y, s, color) => {
    const k = s || 1;
    return [
      path('M ' + (x - 44 * k) + ' ' + y + ' q ' + (44 * k) + ' ' + (-42 * k) + ' ' + (88 * k) + ' 0 Z', { fill: color || '#8fc7e8', stroke: 'rgba(60,110,150,.4)', width: 2 }),
      line(x, y, x, y + 44 * k, { stroke: '#a97c50', width: 4 * k }),
      path('M ' + x + ' ' + (y + 44 * k) + ' q ' + (10 * k) + ' ' + (10 * k) + ' ' + (16 * k) + ' ' + (-2 * k), { stroke: '#a97c50', width: 4 * k, fill: 'none' })
    ];
  },
  cake: (x, y, s) => {
    const k = s || 1;
    return [
      rect(x - 26 * k, y - 20 * k, 52 * k, 26 * k, { rx: 6 * k, fill: '#ffd9b0', stroke: 'rgba(180,130,80,.4)', width: 2 }),
      rect(x - 26 * k, y - 26 * k, 52 * k, 8 * k, { rx: 4 * k, fill: '#e58098', stroke: 'none' }),
      line(x - 8 * k, y - 32 * k, x - 8 * k, y - 40 * k, { stroke: '#c98a1b', width: 3 * k }),
      line(x + 8 * k, y - 32 * k, x + 8 * k, y - 40 * k, { stroke: '#c98a1b', width: 3 * k }),
      ellipse(x - 8 * k, y - 43 * k, 3.4 * k, 5 * k, { fill: '#ffc94d', stroke: 'none', class: 'pb-twinkle' }),
      ellipse(x + 8 * k, y - 43 * k, 3.4 * k, 5 * k, { fill: '#ffc94d', stroke: 'none', class: 'pb-twinkle' })
    ];
  },
  jar: (x, y, s, color) => {
    const k = s || 1, out = [
      rect(x - 20 * k, y - 34 * k, 40 * k, 46 * k, { rx: 8 * k, fill: 'rgba(226,239,248,.85)', stroke: 'rgba(90,140,180,.45)', width: 2.4 }),
      rect(x - 12 * k, y - 42 * k, 24 * k, 10 * k, { rx: 4 * k, fill: '#a97c50', stroke: 'none' })
    ];
    [[-6, -8], [6, -16], [0, -24], [10, -6]].forEach(p => {
      out.push(circle(x + p[0] * k, y + p[1] * k, 3.4 * k, { fill: color || '#ffc94d', stroke: 'none', class: 'pb-twinkle' }));
    });
    return out;
  },
  basket: (x, y, s) => {
    const k = s || 1;
    return [
      path('M ' + (x - 28 * k) + ' ' + (y - 14 * k) + ' l ' + (56 * k) + ' 0 l ' + (-8 * k) + ' ' + (28 * k) + ' l ' + (-40 * k) + ' 0 Z',
        { fill: '#d9b98c', stroke: 'rgba(120,90,50,.4)', width: 2 }),
      path('M ' + (x - 22 * k) + ' ' + (y - 14 * k) + ' q ' + (22 * k) + ' ' + (-24 * k) + ' ' + (44 * k) + ' 0', { stroke: '#b98b52', width: 3.4 * k, fill: 'none' }),
      line(x - 20 * k, y - 4 * k, x + 20 * k, y - 4 * k, { stroke: 'rgba(120,90,50,.35)', width: 2 * k })
    ];
  },
  leaves: (list, s) => (list || []).map(p => {
    const k = (p[2] || 1) * (s || 1);
    return path('M ' + p[0] + ' ' + p[1] + ' q ' + (9 * k) + ' ' + (-7 * k) + ' ' + (18 * k) + ' 0 q ' + (-9 * k) + ' ' + (7 * k) + ' ' + (-18 * k) + ' 0 Z',
      { fill: '#a8d094', stroke: 'rgba(90,130,70,.4)', width: 1.4, opacity: 0.95, class: 'pb-mote' });
  }),
  bubbles: (list, s) => (list || []).map(p => circle(p[0], p[1], (p[2] || 7) * (s || 1),
    { fill: 'rgba(226,239,248,.7)', stroke: 'rgba(140,180,210,.6)', width: 1.6, class: 'pb-mote' })),
  butterfly: (x, y, s) => {
    const k = s || 1;
    return [
      ellipse(x - 9 * k, y, 9 * k, 12 * k, { fill: '#f5c451', stroke: 'rgba(180,130,40,.4)', width: 1.6, class: 'pb-mote' }),
      ellipse(x + 9 * k, y, 9 * k, 12 * k, { fill: '#f5c451', stroke: 'rgba(180,130,40,.4)', width: 1.6, class: 'pb-mote' }),
      ellipse(x, y, 3 * k, 11 * k, { fill: '#8a6a30', stroke: 'none' })
    ];
  },
  sCard: (x, y, s, txt) => {
    const out = [
      A.rect(x - 46 * s, y - 32 * s, 92 * s, 64 * s, { rx: 10 * s, fill: '#fffdf6', stroke: 'rgba(150,120,70,.4)', width: 2.4 }),
      A.line(x - 46 * s, y - 32 * s, x - 46 * s, y + 32 * s, { stroke: 'rgba(150,120,70,.4)', width: 2.4 })
    ].concat(bubbleText(x - 30 * s, y - 8 * s, 72 * s, txt || '谢谢', 13 * s));
    return out;
  },
  soundWave: (x, y, s, color) => {
    const out = [];
    for (let i = 0; i < 4; i++) {
      out.push(A.path('M ' + (x + i * 14 * s) + ' ' + (y - 14 * s) + ' q ' + (7 * s) + ' ' + (-10 * s) + ' 0 ' + (-18 * s), {
        stroke: color || '#e8890f', width: 3 * s, strokeLinecap: 'round', opacity: 1 - i * 0.16
      }));
    }
    return out;
  },
  fragments: (list, s) => (list || []).map(p => [
    A.rect(p[0] - 20 * s, p[1] - 14 * s, 40 * s, 28 * s, { rx: 8 * s, fill: '#fff3cf', stroke: 'rgba(200,150,60,.4)', width: 2, className: 'pb-mote' }),
    A.text(p[0], p[1] + 6 * s, p[2] || '♪', { size: 17 * s, anchor: 'middle', fill: '#c98a1b' })
  ]),
  grid: (x, y, s) => {
    const out = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      out.push(A.rect(x - 60 * s + c * 32 * s, y - 60 * s + r * 32 * s, 28 * s, 28 * s, { rx: 5 * s, fill: 'rgba(255,255,255,.55)', stroke: 'rgba(120,150,180,.35)', width: 1.6 }));
    }
    return out;
  },
  stars7: (x, y, s) => {
    /* 北斗七星：像一把勺子 */
    const pts = [[-60, -20], [-30, -28], [0, -30], [26, -22], [40, 4], [16, 22], [-12, 20]];
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      out.push(A.line(x + pts[i][0] * s, y + pts[i][1] * s, x + pts[i + 1][0] * s, y + pts[i + 1][1] * s, { stroke: 'rgba(255,240,190,.7)', width: 2 * s, dash: '5 6' }));
    }
    pts.forEach((p, i) => {
      out.push(A.circle(x + p[0] * s, y + p[1] * s, (i === 3 ? 6 : 4.4) * s, { fill: '#fff6db', stroke: 'none', className: 'pb-twinkle' }));
    });
    return out;
  },
  table: (x, y, s, on) => {
    const out = [
      A.rect(x - 90 * s, y, 180 * s, 14 * s, { rx: 6 * s, fill: '#d9b98c', stroke: 'rgba(120,90,50,.3)', width: 2 }),
      A.line(x - 72 * s, y + 14 * s, x - 72 * s, y + 58 * s, { stroke: '#c0a074', width: 8 * s }),
      A.line(x + 72 * s, y + 14 * s, x + 72 * s, y + 58 * s, { stroke: '#c0a074', width: 8 * s })
    ];
    if (on === 'cup') {
      out.push(A.poly([[x - 14 * s, y - 34 * s], [x + 14 * s, y - 34 * s], [x + 10 * s, y], [x - 10 * s, y]], { fill: '#dff0f8', stroke: 'rgba(90,140,180,.4)', width: 2 }));
      out.push(A.ellipse(x, y - 34 * s, 14 * s, 5 * s, { fill: '#bfe0f0', stroke: 'rgba(90,140,180,.4)', width: 1.6 }));
    }
    if (on === 'spill') {
      out.push(A.ellipse(x, y + 26 * s, 66 * s, 16 * s, { fill: '#bfe0f0', opacity: 0.8, stroke: 'none' }));
      out.push(A.poly([[x - 14 * s, y - 14 * s], [x + 14 * s, y - 14 * s], [x + 16 * s, y + 10 * s], [x - 16 * s, y + 10 * s]], { fill: '#dff0f8', stroke: 'rgba(90,140,180,.4)', width: 2 }));
    }
    return out;
  },
  cloth: (x, y, s) => [
    A.rect(x - 26 * s, y - 18 * s, 52 * s, 36 * s, { rx: 8 * s, fill: '#a8d094', stroke: 'rgba(90,130,70,.35)', width: 2 }),
    A.path('M ' + (x - 20 * s) + ' ' + (y - 6 * s) + ' q ' + (20 * s) + ' ' + (8 * s) + ' ' + (40 * s) + ' 0', { stroke: 'rgba(90,130,70,.35)', width: 2 })
  ]
};


/* ================= 五层渲染：把 LAYERS 的描述画成画面 ================= */
const layersOf = require('./pb-layers');

/** 背景层：一个生活化场景 + 2～3 个可辨识物件 */
const SCENERY = {
  '木桌子': [A.rect(300, 250, 180, 14, { rx: 6, fill: '#d9b98c', stroke: 'rgba(120,90,50,.3)', width: 2 }),
    A.line(320, 264, 320, 320, { stroke: '#c0a074', width: 8 }), A.line(460, 264, 460, 320, { stroke: '#c0a074', width: 8 })],
  '窗户': [A.rect(60, 58, 132, 102, { rx: 8, fill: '#dff0f8', stroke: '#cfe0ee', width: 3 }),
    A.line(126, 58, 126, 160, { stroke: '#cfe0ee', width: 4 }), A.line(60, 109, 192, 109, { stroke: '#cfe0ee', width: 4 })],
  '地垫': A.ellipse(320, 342, 190, 30, { fill: '#f3dfc6', stroke: 'none' }),
  '照片墙': [A.rect(58, 58, 194, 134, { rx: 10, fill: '#fffaf0', stroke: 'rgba(140,110,70,.28)', width: 2 }),
    A.rect(76, 76, 48, 40, { rx: 4, fill: '#fff', stroke: 'rgba(150,130,100,.28)', width: 1.4 }),
    A.rect(134, 76, 48, 40, { rx: 4, fill: '#fff', stroke: 'rgba(150,130,100,.28)', width: 1.4 }),
    A.rect(192, 76, 48, 40, { rx: 4, fill: '#fff', stroke: 'rgba(150,130,100,.28)', width: 1.4 }),
    A.rect(76, 126, 48, 40, { rx: 4, fill: '#fff', stroke: 'rgba(150,130,100,.28)', width: 1.4 }),
    A.rect(134, 126, 48, 40, { rx: 4, fill: '#fff', stroke: 'rgba(150,130,100,.28)', width: 1.4 })],
  '书架': [A.rect(470, 88, 132, 132, { rx: 8, fill: '#e0c9a6', stroke: 'rgba(120,90,50,.3)', width: 2 }),
    A.line(470, 130, 602, 130, { stroke: 'rgba(120,90,50,.28)', width: 3 }),
    A.line(470, 172, 602, 172, { stroke: 'rgba(120,90,50,.28)', width: 3 }),
    A.rect(482, 98, 16, 30, { rx: 3, fill: '#8fc7e8', stroke: 'none' }),
    A.rect(502, 102, 14, 26, { rx: 3, fill: '#e58098', stroke: 'none' }),
    A.rect(520, 98, 16, 30, { rx: 3, fill: '#a8d094', stroke: 'none' })],
  '沙发': [A.rect(372, 198, 214, 92, { rx: 18, fill: '#c8d8c0', stroke: 'rgba(90,130,80,.3)', width: 2 }),
    A.rect(390, 214, 178, 40, { rx: 12, fill: '#d8e6d0', stroke: 'none' })],
  '台灯': [A.poly([[452, 166], [508, 166], [498, 190], [462, 190]], { fill: '#ffd98a', stroke: 'rgba(180,130,40,.35)', width: 2 }),
    A.line(480, 190, 480, 240, { stroke: '#b0a088', width: 5 }),
    A.ellipse(480, 242, 22, 7, { fill: '#c9b79a', stroke: 'none' })],
  '小床': [A.rect(56, 218, 256, 72, { rx: 12, fill: '#f0dfe8', stroke: 'rgba(150,110,130,.28)', width: 2 }),
    A.rect(70, 198, 92, 34, { rx: 10, fill: '#fff', stroke: 'rgba(150,110,130,.28)', width: 2 })],
  '餐桌': [A.rect(240, 234, 280, 16, { rx: 7, fill: '#d9b98c', stroke: 'rgba(120,90,50,.3)', width: 2 }),
    A.line(272, 250, 272, 320, { stroke: '#c0a074', width: 9 }),
    A.line(488, 250, 488, 320, { stroke: '#c0a074', width: 9 })],
  '水杯': [A.poly([[440, 200], [474, 200], [469, 236], [445, 236]], { fill: '#dff0f8', stroke: 'rgba(90,140,180,.4)', width: 2 }),
    A.ellipse(457, 200, 17, 5, { fill: '#bfe0f0', stroke: 'rgba(90,140,180,.4)', width: 1.6 })],
  '抹布': A.rect(150, 318, 56, 36, { rx: 8, fill: '#a8d094', stroke: 'rgba(90,130,70,.35)', width: 2 }),
  '望远镜': [A.rect(92, 208, 28, 72, { rx: 8, fill: '#8d99ae', stroke: 'none' }),
    A.line(106, 208, 130, 164, { stroke: '#8d99ae', width: 10 }),
    A.rect(118, 150, 36, 16, { rx: 6, fill: '#66788f', stroke: 'none' })],
  '躺椅': [A.rect(414, 236, 176, 16, { rx: 7, fill: '#e0c9a6', stroke: 'rgba(120,90,50,.3)', width: 2 }),
    A.poly([[424, 236], [560, 236], [582, 198], [446, 198]], { fill: '#f0dcbc', stroke: 'rgba(120,90,50,.3)', width: 2 })],
  '会回答的音箱': [A.rect(296, 206, 58, 84, { rx: 16, fill: '#8fb8e0', stroke: 'rgba(60,110,150,.35)', width: 2 }),
    A.circle(325, 248, 19, { fill: 'rgba(255,255,255,.72)', stroke: 'none' }),
    A.circle(325, 248, 8, { fill: '#5f8cbe', stroke: 'none' })],
  '摄像头': [A.rect(466, 146, 74, 46, { rx: 10, fill: '#66788f', stroke: 'none' }),
    A.circle(503, 169, 16, { fill: '#9fd0e8', stroke: 'none' }),
    A.circle(498, 164, 5, { fill: '#fff', opacity: 0.85, stroke: 'none' })],
  '扫地的小圆盘': [A.ellipse(200, 320, 50, 18, { fill: '#eef3f8', stroke: 'rgba(90,120,150,.35)', width: 2 }),
    A.circle(200, 310, 32, { fill: '#f7fafd', stroke: 'rgba(90,120,150,.35)', width: 2 }),
    A.circle(200, 310, 13, { fill: '#8fc7e8', stroke: 'none' })],
  '积木城堡': [A.rect(276, 260, 126, 28, { rx: 5, fill: '#f0a94e', stroke: 'rgba(90,70,40,.2)', width: 1.8 }),
    A.rect(290, 234, 98, 26, { rx: 5, fill: '#8fc7e8', stroke: 'rgba(90,70,40,.2)', width: 1.8 }),
    A.rect(304, 208, 70, 26, { rx: 5, fill: '#a8d094', stroke: 'rgba(90,70,40,.2)', width: 1.8 })],
  '充电线': [A.path('M 470 262 q 44 22 96 0', { stroke: '#6b7a8c', width: 5, fill: 'none' }),
    A.rect(458, 250, 30, 20, { rx: 5, fill: '#fff', stroke: 'rgba(120,130,150,.5)', width: 2 })],
  '地上的玩具': [A.EGGS.ball(160, 336, 1.0, '#8fc7e8'), A.rect(220, 320, 34, 24, { rx: 5, fill: '#f0a94e', stroke: 'none' })],
  '夜空': null
};

function bgLayerFor(name) {
  const out = [];
  const isNight = /夜|天台/.test(name || '');
  if (isNight) {
    out.push(A.rect(0, 0, 640, 400, { rx: 0, fill: '#3f4a72', stroke: 'none' }));
    out.push(A.ellipse(505, 94, 172, 122, { fill: '#55628c', opacity: 0.72, stroke: 'none' }));
    out.push(A.ellipse(118, 322, 182, 96, { fill: '#4c5880', opacity: 0.72, stroke: 'none' }));
    out.push(A.rect(0, 288, 640, 112, { rx: 0, fill: '#4a5680', stroke: 'none' }));
  } else {
    out.push(A.rect(0, 0, 640, 400, { rx: 0, fill: '#fff8ec', stroke: 'none' }));
    out.push(A.rect(0, 288, 640, 112, { rx: 0, fill: '#e8d5b8', stroke: 'none' }));
    out.push(A.line(0, 288, 640, 288, { stroke: 'rgba(150,120,80,.22)', width: 2 }));
  }
  return out;
}

/** 氛围层：光斑、星空、雾气、彩虹 */
function atmosOf(atmos) {
  const m = cast.MOODS[atmos.mood] || cast.MOODS.happy;
  const out = [
    A.ellipse(508, 92, 162, 114, { fill: m.glow, opacity: 0.5, stroke: 'none' }),
    A.ellipse(118, 330, 176, 92, { fill: m.props[0], opacity: 0.34, stroke: 'none' })
  ];
  const light = atmos.light || '';
  if (/星空|黄昏/.test(light)) A.starfield([[84, 58, 2.6], [206, 38, 2], [424, 50, 2.4], [562, 38, 2], [300, 24, 1.8]]).forEach(x => out.push(x));
  if (/阳光|暖阳|放射/.test(light)) A.lightSpots([[180, 122, 46], [432, 150, 40], [560, 238, 34]]).forEach(x => out.push(x));
  if (/台灯/.test(light)) A.lightSpots([[482, 220, 72]]).forEach(x => out.push(x));
  if (/阴天/.test(light)) A.mist([[164, 200, 92], [478, 180, 82]]).forEach(x => out.push(x));
  return out;
}

/** 彩蛋层 */
function eggsOf(list) {
  const out = [];
  (list || []).forEach(e => {
    const fn = A.EGGS[e.kind];
    const at = e.at || [0, 0, 1];
    if (fn) out.push(fn(at[0], at[1], at[2]));
  });
  return out;
}
/** 前景层（最后画，离镜头最近） */
function frontsOf(list) {
  const out = [];
  (list || []).forEach(f => {
    const at = f.at || [];
    if (f.kind === 'leaves') out.push(prop.leaves(at, 1));
    else if (f.kind === 'bubbles') out.push(prop.bubbles(at, 1));
    else if (f.kind === 'bubble') out.push(at.map(p => A.circle(p[0], p[1], p[2], { fill: 'rgba(226,239,248,.62)', stroke: 'rgba(140,180,210,.55)', width: 1.6, class: 'pb-mote' })));
    else if (f.kind === 'butterfly') out.push(prop.butterfly(at[0][0], at[0][1], 1));
    else if (f.kind === 'dust') out.push(A.dust(at[0][0], at[0][1], 1));
    else if (f.kind === 'stars') out.push(A.fallingStars(at, '#ffc94d'));
    else if (f.kind === 'cat') out.push(A.EGGS.cat(at[0][0], at[0][1], at[0][2]));
  });
  return out;
}

const NAME = { ai: '小AI', dian: '点点', dou: '豆豆' };
function skin(who) { return who === 'ai' ? 62 : 0; }

/** 渲染一页：五层 + 镜头 */
/** 渲染一页：五层 + 强制光影 + 镜头 */
function render(page, title) {
  A.beginPage();   /* 先定页号，再做渐变，保证渐变归属本页 */
  const L = layersOf.of(page.scene, page.mood);
  const atmos = L.atmos || { mood: page.mood || 'happy', light: '柔和光线', source: 'left-window' };
  const mid = L.mid || {};
  const m = cast.MOODS[atmos.mood] || cast.MOODS.happy;
  const P = require('./pb-detail');
  /* 光源方向：决定光柱从哪来、影子往哪落 */
  const SRC = {
    'right-window': { x: 560, y: 60, rot: -22, sx: 1 },
    'left-window': { x: 60, y: 60, rot: 22, sx: -1 },
    'lamp': { x: 480, y: 210, rot: 0, sx: 0 },
    'moon': { x: 548, y: 70, rot: -14, sx: 1 },
    'center': { x: 320, y: 90, rot: 0, sx: 0 },
    'overcast': { x: 320, y: 30, rot: 0, sx: 0 }
  };
  const src = SRC[atmos.source] || SRC['left-window'];

  const back = [];      /* 背景层（最远） */
  const midLayer = [];  /* 中景层 */
  const front = [];     /* 前景层（最近，带虚化） */
  const light = [];     /* 光与氛围 */

  /* —— 背景层：真实房间，至少 5 件细节，整体轻微柔焦建立纵深 —— */
  const roomItems = ((L.back && L.back.items) || []).concat(
    (L.back && L.back.room && P.ROOMS[L.back.room]) || []);
  /* 暗部：让家具「坐」在地上、容器有内壁，而不是浮在画面里 */
  const DARK = {
    '木桌': A.underShadow(368, 320, 96, 14), '餐桌': A.underShadow(380, 320, 130, 15),
    '床头柜': A.underShadow(337, 296, 46, 10), '小床': A.underShadow(160, 312, 110, 15),
    '沙发': A.underShadow(480, 296, 100, 14), '橱柜': A.underShadow(95, 294, 90, 14),
    '书架': A.sideShadow(452, 96, 9, 138), '会回答的音箱': A.sideShadow(292, 202, 7, 88),
    '水杯': A.innerDark(444, 200, 26, 10, 0.16), '星星瓶': A.innerDark(236, 218, 28, 12, 0.14),
    '水果篮': A.innerDark(510, 278, 56, 12, 0.16), '餐椅': A.underShadow(538, 296, 34, 11),
    '积木城堡': A.underShadow(338, 288, 66, 12), '绿植': A.underShadow(63, 288, 24, 8),
    '窗台小绿植': A.underShadow(75, 196, 20, 7), '毛绒玩具熊': A.underShadow(150, 324, 24, 9),
    '躺椅': A.underShadow(480, 288, 76, 13), '望远镜': A.underShadow(93, 288, 22, 8)
  };
  roomItems.forEach(it => { if (DARK[it]) back.push(DARK[it]); });
  P.room(L.back && L.back.room).forEach(x => back.push(x));
  /* 底色用真正的渐变，杜绝任何一块平涂 */
  const night = /夜|天台/.test((L.back && L.back.scene) || '');
  const wallGrad = A.gradientBg(night ? '#2f3a60' : m.sky[0], night ? '#4a5680' : m.glow, 'd');
  const floorGrad = A.gradientBg(night ? '#414c74' : m.props[1], night ? '#2b3457' : m.sky[1], 'v');
  back.unshift(rect(0, 0, 640, 292, { rx: 0, fill: 'url(#' + wallGrad + ')', stroke: 'none' }));
  back.unshift(rect(0, 292, 640, 108, { rx: 0, fill: 'url(#' + floorGrad + ')', stroke: 'none' }));
  /* 墙上再叠一层斜向光晕，模拟自然光的衰减 */
  const glowGrad = A.gradientBg(m.glow, 'rgba(255,255,255,0)', 'd2');
  back.unshift(rect(0, 0, 640, 400, { rx: 0, fill: 'url(#' + glowGrad + ')', stroke: 'none', opacity: 0.4 }));

  /* —— 氛围层：光柱 + 微尘 + 光斑 —— */
  if (/阳光|晨光|暖阳|黄昏/.test(atmos.light || '')) {
    light.push(A.lightShaft(src.x - 60, 40, 200, 300, src.rot, 'rgba(255,240,196,.34)'));
  }
  if (/台灯/.test(atmos.light || '')) {
    light.push(circle(src.x, src.y, 150, { fill: 'rgba(255,222,150,.30)', stroke: 'none', filter: 'url(#soft)' }));
  }
  if (/放射/.test(atmos.light || '')) {
    light.push(circle(320, 130, 210, { fill: 'rgba(255,238,190,.30)', stroke: 'none', filter: 'url(#soft)' }));
  }
  A.dustMotes([[180, 120, 2.4], [300, 88, 1.8], [430, 150, 2.2], [520, 220, 1.6], [240, 240, 2]]).forEach(x => light.push(x));

  /* —— 中景层：角色全身表演 + 落地投影 + 接触阴影 —— */
  /* 景别决定角色大小：远景是小人、特写是大头，
     否则所有镜头看起来都像同一个中景。整体仍受镜头缩放影响。 */
  const SIZE_BY_CAM = {
    '大远景': 0.80, '远景': 0.90, '中景': 1.14, '特写': 1.26, '大特写': 1.34,
    '俯视': 1.00, '仰视': 1.08, '倾斜构图': 1.06, '框中框': 1.02
  };
  const s = SCALE * (SIZE_BY_CAM[L.camera] || 1);
  const who = mid.who || 'ai';
  const cx = 296;
  /* 趴下、摔倒这类动作会把角色甩到画面外，这里按动作算出实际占位并拉回画布内 */
  const POSE_SPAN = {
    lie: { top: 0.45, bottom: 0.30 }, fall: { top: 0.50, bottom: 0.35 },
    jump: { top: 0.30, bottom: 0.40 }, spin: { top: 0.50, bottom: 0.45 }
  };
  const span = POSE_SPAN[mid.pose] || { top: 0.45, bottom: 0.45 };
  const rawY = GROUND - skin(who);
  const bottomMost = rawY + span.bottom * 118 * s;
  const cy = bottomMost > 352 ? rawY - (bottomMost - 352) : rawY;
  /* 投影跟着光源方向走：光从右上来，影子就落在左下 —— 体积感才立得住 */
  const sh = A.shadowFor(atmos.source, 20);
  midLayer.push(A.groundShadow(cx + sh.dx * 1.6, GROUND + 6 + sh.dy, 54));
  /* 手臂跟着动作走：举手、摆手、垂手、抱头、张开，不能永远一个姿势 */
  const ARM_BY_POSE = {
    jump: 'up', reach: 'up', spin: 'wave', tiptoe: 'out',
    lie: 'down', back: 'down', cover: 'up', fall: 'wave', stand: 'down'
  };
  const body = cast.character(who, cx, cy, s, { expr: mid.expr || 'happy', arms: ARM_BY_POSE[mid.pose || 'stand'] || 'down' });
  const posed = cast.applyPose(body, mid.pose || 'stand', cx, cy, s);
  posed.fx.forEach(f => { if (f) midLayer.push(f); });
  midLayer.push(posed.body);
  /* 手绘轮廓：在角色脚下再垫一圈轻微抖动的浅色，让边缘不那么「矢量」 */
  midLayer.push(['group', { class: 'pb-sketch' }, [
    A.handCircle(cx, cy + 6 * s, 40 * s, {
      fill: 'none', stroke: 'rgba(150,120,84,.14)', width: 2.4
    }, 2.4 * s, Math.round(cx) + 7)
  ]]);

  /* 互动对象 */
  const partner = mid.partner;
  if (partner && partner !== '盒子') {
    const px = cx > 320 ? 148 : 486;
    const pwName = { '豆豆': 'dou', '小AI': 'ai', '点点': 'dian' }[partner];
    if (pwName) {
      const py = GROUND - skin(pwName);
      midLayer.push(A.groundShadow(px + sh.dx * 1.3, GROUND + 6 + sh.dy, 44));
      const pb2 = cast.character(pwName, px, py, s * 0.86, { expr: 'happy' });
      const pp = cast.applyPose(pb2, 'stand', px, py, s * 0.86);
      pp.fx.forEach(f => { if (f) midLayer.push(f); });
      midLayer.push(pp.body);
    } else if (partner === '小猫') midLayer.push(A.EGGS.cat(px, GROUND - 8, 1.05));
  }
  /* 角色手里的道具 + 接触阴影 */
  if (mid.prop && prop[mid.prop]) {
    /* 道具必须落在角色手边并留下接触阴影，否则看起来像贴纸 */
    const hx = cx + 46;
    const hy = cy + 22;
    midLayer.push(A.groundShadow(hx, GROUND + 4, 26));
    midLayer.push(A.contactShadow(hx, hy + 26, 1.15));
    midLayer.push(prop[mid.prop](hx, hy, 1.05));
  }

  /* —— 彩蛋层：藏在中景之后，不抢视线 —— */
  eggsOf(L.egg).forEach(x => midLayer.push(x));

  /* —— 前景层：靠近镜头，带虚化，制造景深 —— */
  frontsOf(L.front).forEach(x => {
    front.push(['group', { filter: 'url(#near)' }, x]);
  });

  /* —— 合成：背景柔焦 → 氛围 → 中景 → 彩蛋 → 前景虚化 → 镜头 —— */
  /* —— 遮挡：角色站在家具后面时，家具要挡住角色的下半身，这样才有空间关系 —— */
  const OCCLUDE = {
    '木桌': { y: 246, draw: () => [A.underShadow(368, 320, 96, 14)].concat(P.DET['木桌'] || []) },
    '餐桌': { y: 232, draw: () => [A.underShadow(380, 320, 130, 15)].concat(P.DET['餐桌'] || []) },
    '床头柜': { y: 232, draw: () => P.DET['床头柜'] || [] },
    '沙发': { y: 194, draw: () => P.DET['沙发'] || [] },
    '积木城堡': { y: 258, draw: () => P.DET['积木城堡'] || [] },
    '餐椅': { y: 208, draw: () => P.DET['餐椅'] || [] }
  };
  const occl = [];
  /* 只有「页面本来就写了这件家具」才遮挡，否则会把桌子画到没有桌子的场景里。
     而且遮挡物不能压过角色胸口，不然就变成一条横杠。 */
  const baseItems = (L.back && L.back.items) || [];
  baseItems.forEach(it => {
    const o = OCCLUDE[it];
    if (!o) return;
    if (cy - 40 >= o.y) return;          /* 角色站在家具前面，不需要遮挡 */
    if (o.y > GROUND - 96) return;       /* 家具太高，会挡住脸，放弃遮挡 */
    o.draw().forEach(x => occl.push(x));
  });

  /* —— 地板上的光影：窗户投下的窗格、树叶筛影、台灯光池 ——
        画在中景之后，光才会「落」在角色身上，而不是浮在背景里 —— */
  const floorLight = [];
  if (/阳光|晨光|暖阳/.test(atmos.light || '')) {
    const fromRight = atmos.source === 'right-window';
    floorLight.push(A.windowPattern(fromRight ? 330 : 30, 296, 240, 92, fromRight ? -12 : 12));
    A.dapple(fromRight ? 400 : 40, 300, 210, 84).forEach(x => floorLight.push(x));
  }
  if (/台灯/.test(atmos.light || '')) A.lampPool(470, 300, 110).forEach(x => floorLight.push(x));
  if (/放射/.test(atmos.light || '')) A.lampPool(320, 300, 150).forEach(x => floorLight.push(x));

  const stack = [
    ['group', { filter: 'url(#far)' }, back],
    ['group', {}, light],
    ['group', {}, midLayer],
    ['group', {}, occl],
    ['group', {}, floorLight],
    ['group', {}, front]
  ];
  /* 趴下 / 摔倒时角色贴地，机位要往下压一点，否则身子会被切出画面 */
  const FOCUS_DY = { lie: 78, fall: 66, jump: -14 };
  const framed = A.applyCamera([['group', { class: 'pb-scene' }, stack]], L.camera,
    { x: cx, y: cy - 30 + (FOCUS_DY[mid.pose] || 0) });
  const finalOut = [framed];

  /* 台词气泡固定在页面上，保证永远读得清 */
  if (page.say && page.say.text && page.say.text.indexOf('（') !== 0) {
    const bx = 38;
    const bw = 228;
    const lines = Math.min(3, Math.ceil(page.say.text.length / 11));
    const bh = 30 + lines * 24;
    finalOut.push(cast.sayBubble(bx, 24, bw, bh, 'right', { fill: '#fffdf6' }));
    finalOut.push(cast.bubbleText(bx + 20, 58, bw - 40, page.say.text, 17));
  }
  return A.toSvg(finalOut, 640, 400, title || page.scene);
}
function renderPage(page, title) {
  return render(page, title);
}

/** 封面：主角合影的「合家欢」式大图 */
function cover(story) {
  const heroes = (story.cast || ['ai']).slice(0, 3);
  const out = bgLayerFor('客厅');
  out.push(A.ellipse(508, 92, 172, 118, { fill: '#ffe9b0', opacity: 0.5, stroke: 'none' }));
  const xs = heroes.length === 1 ? [320] : heroes.length === 2 ? [232, 442] : [166, 320, 474];
  heroes.forEach((h, i) => {
    const y = GROUND - skin(h);
    const body = cast.character(h, xs[i], y, SCALE * 0.88, { expr: i === 0 ? 'laugh' : 'happy', arms: i === 0 ? 'up' : undefined });
    const posed = cast.applyPose(body, i === 0 ? 'jump' : 'stand', xs[i], y, SCALE * 0.88);
    posed.fx.forEach(f => { if (f) out.push(f); });
    out.push(posed.body);
  });
  A.EGGS.cat(592, 348, 0.42).forEach(x => out.push(x));
  A.EGGS.ball(66, 350, 0.78).forEach(x => out.push(x));
  prop.leaves([[92, 320, 1], [600, 300, 0.8]], 1).forEach(x => out.push(x));
  A.starfield([[122, 68, 2.6], [422, 50, 2.2], [542, 88, 2.4]]).forEach(x => out.push(x));
  A.fallingStars([[240, 118, 0.8], [400, 98, 0.7]], '#ffc94d').forEach(x => out.push(x));
  return A.toSvg(out, 640, 400, story.title);
}

module.exports = { render, renderPage, cover, prop, SCENERY, GROUND, SCALE, bgLayerFor, atmosOf, eggsOf, frontsOf };
