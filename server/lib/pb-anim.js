/**
 * AI 动画 · 播放器
 *
 * 把「动作时间轴」翻译成真正的 CSS 关键帧动画：
 *   每个关节独立一条 @keyframes，同时跑，所以角色是在「演戏」而不是「整块平移」。
 *
 * 关键约束（决定了它像不像动画片）：
 *   · transform-box: fill-box + transform-origin 让旋转发生在真正的关节上
 *       armL/armR → 肩（顶部内侧）      legL/legR → 胯（顶部）
 *       body      → 底部中心（蹲下时从脚底压）  head → 脖子（底部中心）
 *       hair      → 根部（底部）
 *   · 每个关节带自己的缓动：预备动作 anticipation、落地 settle、跟随回弹 bounce
 *   · 场景永远在动：微尘上浮、叶子摆动、光斑流动、速度线掠过
 */
'use strict';
const cast = require('./pb-cast');
const art = require('./pb-art');
const tl = require('./pb-timeline');

/* 关节的旋转轴心：写在 CSS 里，浏览器按元素的包围盒算 */
const ORIGIN = {
  'pbA-armL': '76% 22%',
  'pbA-armR': '24% 22%',
  'pbA-legL': '50% 12%',
  'pbA-legR': '50% 12%',
  'pbA-body': '50% 96%',
  'pbA-head': '50% 92%',
  'pbA-hair': '50% 100%',
  'pbA-halo': '50% 60%',
  'pbA-shadow': '50% 50%',
  'pbA-extra': '50% 70%'
};

const EASE_CSS = {
  linear: 'linear', anticipate: 'cubic-bezier(.4,0,.9,.5)',
  settle: 'cubic-bezier(.2,1.5,.5,1)', bounce: 'cubic-bezier(.3,1.6,.4,1)', soft: 'ease-in-out'
};

/**
 * 把一串关键帧合成一条 @keyframes 规则。
 *
 * 注意：同一个元素上如果有两条动画都写 transform，**后一条会整体覆盖前一条**，
 * 所以「位移 + 挤压拉伸」必须在同一个 transform 里一次写全，不能拆成两条动画。
 */
function keyframes(name, frames, build) {
  const steps = frames.map(f => {
    const at = Math.round(f.at * 1000) / 10;
    const e = f.ease ? EASE_CSS[f.ease] : null;
    return '  ' + at + '% { transform: ' + build(f) + (e ? '; animation-timing-function: ' + e : '') + ' }';
  });
  return '@keyframes ' + name + ' {\n' + steps.join('\n') + '\n}';
}


/** 口型同步：朗读时嘴巴一张一合，停下就闭嘴 */
function mouthKeyframes(name) {
  return '@keyframes ' + name + ' { 0%,100% { transform: scaleY(1) } 25% { transform: scaleY(1.9) } ' +
    '50% { transform: scaleY(0.7) } 75% { transform: scaleY(1.6) } }';
}
/**
 * 生成一条只动透明度的关键帧（用于淡入淡出）。
 *
 * 必须逐帧写死 timing-function: linear —— 否则默认的 ease 会让
 * 「0.2 → 1」在整段区间里慢慢爬，20% 处才到 0.44，
 * 角色就成了半透明的「鬼影」（这个 Bug 之前就在 run / walk 上）。
 */
function keyframesOp(name, frames) {
  const steps = frames.map(f => '  ' + (Math.round(f.at * 1000) / 10) + '% { opacity: ' +
    (f.op === undefined ? 1 : f.op) + '; animation-timing-function: linear }');
  return '@keyframes ' + name + ' {\n' + steps.join('\n') + '\n}';
}
/** 挤压拉伸：横向放大时纵向压缩，面积大致守恒，看起来才有弹性 */
function squashPair(v) {
  const k = v || 0;
  return 'scale(' + (1 + k).toFixed(3) + ', ' + (1 - k).toFixed(3) + ')';
}

/**
 * 生成整套动画 CSS
 * @param {object} t  timelineOf() 的结果
 * @param {string} prefix 命名前缀，避免一个页面里多套动画打架
 */
function cssFor(t, prefix) {
  const p = prefix || 'a';
  const out = [];
  const dur = t.dur + 's';
  const iter = t.loop ? 'infinite' : '1';
  const fill = t.loop ? 'none' : 'forwards';
  const F = t.frames;

  const rot = v => 'rotate(' + (v || 0) + 'deg)';

  /* 身体：水平位移、垂直位移与挤压必须在同一条 transform 里
     （脚底为轴心，蹲下才像蹲下；走路时才真的往前走，而不是原地踏步） */
  out.push(keyframes(p + '-body', F, f =>
    'translateX(' + (f.dx || 0) + 'px) translateY(' + (f.body || 0) + 'px) ' + squashPair(f.squash)));
  /* 影子跟着角色走，同时随远近微微缩放 */
  out.push(keyframes(p + '-shadow', F, f => {
    const k = Math.min(1, Math.abs(f.dx || 0) / 260);
    return 'translateX(' + (f.dx || 0) + 'px) scale(' + (1 - k * 0.16).toFixed(3) + ')';
  }));
  /* 走到画面边缘时淡入淡出，省掉「瞬间闪回」的突兀感 */
  /* 透明度：走到画面边缘时淡入淡出 */
  out.push(keyframesOp(p + '-fade', F));

  /* —— 摄像机：镜头是活的 ——
     translateX/Y 是「镜头往哪挪」，scale 是推拉，rotate 是轻微倾斜。
     背景走反方向，而且三层速度不同（视差），这才有纵深。 */
  out.push(keyframes(p + '-camera', F, f =>
    'translate(' + (-(f.camX || 0)).toFixed(2) + 'px, ' + (-(f.camY || 0)).toFixed(2) + 'px) ' +
    'scale(' + (f.camZoom || 1).toFixed(4) + ') rotate(' + (f.camRotate || 0).toFixed(2) + 'deg)'));
  /* 三层视差：镜头移动同样的距离，前景走得快、远景几乎不动 */
  ['front', 'mid', 'back'].forEach(layer => {
    const k = tl.PARALLAX[layer];
    out.push(keyframes(p + '-par-' + layer, F, f =>
      'translate(' + (-(f.camX || 0) * k).toFixed(2) + 'px, ' + (-(f.camY || 0) * k).toFixed(2) + 'px) ' +
      'scale(' + (1 + ((f.camZoom || 1) - 1) * k * 0.6).toFixed(4) + ')'));
  });
  /* 摔一下：镜头短促震动 */
  out.push('@keyframes ' + p + '-camShake { 0%,100% { transform: translate(0,0) } 20% { transform: translate(-4px,3px) } ' +
    '40% { transform: translate(4px,-3px) } 60% { transform: translate(-3px,-2px) } 80% { transform: translate(3px,2px) } }');
  out.push(mouthKeyframes(p + '-talk'));
  out.push('.' + p + '-mouth { transform-box: fill-box; transform-origin: 50% 30% }');
  out.push('.is-talking .' + p + '-mouth { animation: ' + p + '-talk .17s ease-in-out infinite }');
  out.push(keyframes(p + '-head', F, f => rot(f.head)));
  out.push(keyframes(p + '-armL', F, f => rot(f.armL)));
  out.push(keyframes(p + '-armR', F, f => rot(f.armR)));
  out.push(keyframes(p + '-legL', F, f => rot(f.legL)));
  out.push(keyframes(p + '-legR', F, f => rot(f.legR)));
  out.push(keyframes(p + '-spin', F, f => rot(f.rot)));
  out.push(keyframes(p + '-tilt', F, f => rot(f.tilt)));

  /* 跟随动作：身体停下之后，呆毛还要多晃两下 */
  out.push('@keyframes ' + p + '-hair { 0%,100% { transform: rotate(0deg) } ' +
    '22% { transform: rotate(-13deg) } 46% { transform: rotate(9deg) } ' +
    '70% { transform: rotate(-5deg) } 88% { transform: rotate(2deg) } }');
  /* 眨眼：动画里角色要一直在「活着」 */
  out.push('@keyframes ' + p + '-blink { 0%,90%,100% { transform: scaleY(1) } 93%,96% { transform: scaleY(.08) } }');
  /* 光晕呼吸 */
  out.push('@keyframes ' + p + '-halo { 0%,100% { opacity:.75; transform: scale(1) } 50% { opacity:1; transform: scale(1.05) } }');

  /* 场景动态：背景绝不能是死的 */
  out.push('@keyframes ' + p + '-dust { 0% { transform: translateY(0) translateX(0); opacity:.25 } ' +
    '50% { transform: translateY(-16px) translateX(7px); opacity:.9 } ' +
    '100% { transform: translateY(-30px) translateX(-4px); opacity:0 } }');
  out.push('@keyframes ' + p + '-leaf { 0%,100% { transform: rotate(-7deg) } 50% { transform: rotate(9deg) } }');
  out.push('@keyframes ' + p + '-light { 0%,100% { opacity:.42; transform: translateX(0) } 50% { opacity:.72; transform: translateX(14px) } }');
  out.push('@keyframes ' + p + '-sparkle { 0%,100% { opacity:.3; transform: scale(.7) } 50% { opacity:1; transform: scale(1.25) } }');
  out.push('@keyframes ' + p + '-shake { 0%,100% { transform: translate(0,0) } 20% { transform: translate(-3px,2px) } ' +
    '40% { transform: translate(3px,-2px) } 60% { transform: translate(-2px,-1px) } 80% { transform: translate(2px,1px) } }');
  out.push('@keyframes ' + p + '-speed { 0% { opacity:0; transform: translateX(-60px) } 40% { opacity:.7 } ' +
    '100% { opacity:0; transform: translateX(60px) } }');
  /* 把关节和动画连起来：按角色实例前缀生成选择器，同页多角色也不会串 */
  const JOINTS = [
    { key: 'pbA-body',  anim: 'body' },
    { key: 'pbA-head',  anim: 'head' },
    { key: 'pbA-armL',  anim: 'armL' },
    { key: 'pbA-armR',  anim: 'armR' },
    { key: 'pbA-legL',  anim: 'legL' },
    { key: 'pbA-legR',  anim: 'legR' }
  ];
  JOINTS.forEach(j => {
    out.push('.' + p + j.key.slice(3) + ' { transform-box: fill-box; transform-origin: ' + ORIGIN[j.key] +
      '; animation: ' + p + '-' + j.anim + ' ' + dur + ' ' + EASE_CSS.soft + ' ' + iter + ' ' + fill + ' }');
  });
  /* 这些部件不跟动作走，但也有自己的小动：呆毛、眨眼、光晕呼吸 */
  out.push('.' + p + '-hair { transform-box: fill-box; transform-origin: ' + ORIGIN['pbA-hair'] +
    '; animation: ' + p + '-hair ' + (t.dur * 0.9).toFixed(2) + 's ease-in-out infinite }');
  out.push('.' + p + '-eyes { transform-box: fill-box; transform-origin: 50% 50%; animation: ' + p + '-blink 4.4s infinite }');
  out.push('.' + p + '-extra, .' + p + '-mouth { transform-box: fill-box; transform-origin: 50% 70% }');
  out.push('.' + p + '-halo { transform-box: fill-box; transform-origin: 50% 60%; animation: ' + p + '-halo ' +
    (t.dur * 1.3).toFixed(2) + 's ease-in-out infinite }');
  out.push('.' + p + '-shadow { transform-box: fill-box; transform-origin: 50% 50%; animation: ' + p + '-shadow ' +
    dur + ' ' + EASE_CSS.soft + ' ' + iter + ' ' + fill + ' }');
  /* —— 层级：camera → stage → fadeBox → spinBox → body → 关节 ——
     每一层只管一个 transform，互不覆盖。 */
  /* 摄像机轴心 = 画面正中（320,200）。
     角色占 y 156~346，中心 251，比画面中心(200)略低，所以放大时底部先被吃掉；
     轴心取正中，配合 CAM_SAFE 里 scale ≤ 1.18，上下都还留得住。
     —— 视角安全是第一位的：宁可少推一点，也不能把角色切出画面。 */
  out.push('.' + p + '-camera { transform-box: view-box; transform-origin: 320px 200px; animation: ' + p + '-camera ' +
    dur + ' ' + EASE_CSS.soft + ' ' + iter + ' ' + fill + ' }');
  out.push('.' + p + '-par-front { transform-box: view-box; transform-origin: 320px 200px; animation: ' + p + '-par-front ' +
    dur + ' ' + EASE_CSS.soft + ' ' + iter + ' ' + fill + ' }');
  out.push('.' + p + '-par-mid { transform-box: view-box; transform-origin: 320px 200px; animation: ' + p + '-par-mid ' +
    dur + ' ' + EASE_CSS.soft + ' ' + iter + ' ' + fill + ' }');
  out.push('.' + p + '-par-back { transform-box: view-box; transform-origin: 320px 200px; animation: ' + p + '-par-back ' +
    dur + ' ' + EASE_CSS.soft + ' ' + iter + ' ' + fill + ' }');
  out.push('.' + p + '-stage { transform-box: view-box; transform-origin: 320px 368px; animation: ' + p + '-tilt ' +
    dur + ' ' + EASE_CSS.soft + ' ' + iter + ' ' + fill + ' }');
  /* 角色额外放大一点：推近时主角比背景长得快，纵深就出来了 */
  out.push(keyframes(p + '-hero', F, f => 'scale(' + (f.heroZoom || 1).toFixed(4) + ')'));
  out.push('.' + p + '-heroBox { transform-box: view-box; transform-origin: 320px 250px; animation: ' + p + '-hero ' +
    dur + ' ' + EASE_CSS.soft + ' ' + iter + ' ' + fill + ' }');
  out.push('.' + p + '-spinBox { transform-box: view-box; transform-origin: 320px 250px; animation: ' + p + '-spin ' +
    dur + ' ' + EASE_CSS.soft + ' ' + iter + ' ' + fill + ' }');
  /* 走远时淡出，回到起点时淡入，掩盖循环的跳变 */
  out.push('.' + p + '-fadeBox { animation: ' + p + '-fade ' + dur + ' linear ' + iter + ' ' + fill + ' }');
  /* 场景动态：背景绝不能是死的 */
  out.push('.' + p + '-dust { animation: ' + p + '-dust ' + (t.dur * 1.6).toFixed(2) + 's ease-in-out infinite }');
  out.push('.' + p + '-leaf { transform-box: fill-box; transform-origin: 50% 100%; animation: ' + p + '-leaf ' +
    (t.dur * 1.2).toFixed(2) + 's ease-in-out infinite }');
  out.push('.' + p + '-light { animation: ' + p + '-light ' + (t.dur * 1.8).toFixed(2) + 's ease-in-out infinite }');
  out.push('.' + p + '-sparkle { transform-box: fill-box; transform-origin: 50% 50%; animation: ' + p + '-sparkle ' +
    (t.dur * 0.7).toFixed(2) + 's ease-in-out infinite }');
  out.push('.' + p + '-shake { animation: ' + p + '-shake .34s ease-in-out ' + (t.loop ? 'infinite' : '2') + ' }');
  out.push('.' + p + '-speed { animation: ' + p + '-speed ' + (t.dur * 0.8).toFixed(2) + 's linear infinite }');
  return out.join('\n');
}

/** 场景动态元素：微尘、叶子、光斑、星星、速度线 —— 背景绝不能是死的 */
function ambientArt(t, cls, mood) {
  const out = [];
  const keys = (t.ambient || []).map(a => a.key);
  if (keys.indexOf('dust') >= 0) {
    [[190, 210], [300, 160], [430, 240], [520, 180], [250, 110]].forEach((p, i) => {
      out.push(art.circle(p[0], p[1], 2.4 + (i % 3) * 0.8,
        { fill: '#fff6d8', opacity: 0.75, stroke: 'none', class: cls + '-dust' }));
    });
  }
  if (keys.indexOf('leaf') >= 0) {
    [[90, 300, 1.1], [560, 285, 0.9]].forEach(p => {
      out.push(art.path('M ' + p[0] + ' ' + p[1] + ' q ' + (9 * p[2]) + ' ' + (-7 * p[2]) + ' ' + (18 * p[2]) + ' 0 q ' +
        (-9 * p[2]) + ' ' + (7 * p[2]) + ' ' + (-18 * p[2]) + ' 0 Z',
        { fill: '#a8d094', stroke: 'rgba(90,130,70,.4)', width: 1.4, class: cls + '-leaf' }));
    });
  }
  if (keys.indexOf('light') >= 0) {
    out.push(art.ellipse(200, 130, 52, 34, { fill: '#fff3cf', opacity: 0.45, stroke: 'none', class: cls + '-light' }));
    out.push(art.ellipse(470, 190, 42, 28, { fill: '#fff3cf', opacity: 0.38, stroke: 'none', class: cls + '-light' }));
  }
  if (keys.indexOf('sparkle') >= 0) {
    [[150, 120, 0.9], [500, 100, 1.1], [330, 80, 0.8]].forEach(p => {
      out.push(art.poly(starPts(p[0], p[1], 12 * p[2]), { fill: '#ffc94d', stroke: 'none', class: cls + '-sparkle' }));
    });
  }
  if (keys.indexOf('speed') >= 0) {
    [[120, 250], [520, 230], [300, 280]].forEach(p => {
      out.push(art.line(p[0], p[1], p[0] + 60, p[1], { stroke: 'rgba(255,240,200,.7)', width: 3, class: cls + '-speed' }));
    });
  }
  return out;
}

function starPts(x, y, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = (i % 2 === 0 ? 1 : 0.44) * r;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  return pts;
}

/**
 * 渲染一个动画镜头：完整的一帧 SVG
 *
 * 图层结构（从远到近）：
 *   x-camera                       ← 摄像机：镜头自己会平移、推拉、旋转
 *     ├─ x-par-back                远景（视差速度 0.22）
 *     ├─ x-par-mid                 中景（0.85）
 *     ├─ x-stage → x-fadeBox → x-spinBox → x-body → 关节
 *     └─ x-par-front               前景（1.55，离镜头最近）
 *
 * 角色的所有关节都在 x-body 里，而 x-body 又在摄像机里 ——
 * 所以镜头一动，角色和背景会以不同速度移动，纵深就出来了。
 *
 * @param {object} shot  storyboard().shots[i]
 * @param {string} prefix
 */
function shotSvg(shot, prefix) {
  const p = prefix || 'a';
  const t = tl.timelineOf(shot.action);
  const who = (shot.who || 'ai');
  const mood = (cast.MOODS && cast.MOODS[shot.mood]) || cast.MOODS.happy;

  /* 站位要落在画面正中。
     rigOf 的 y 是「身体中心」，角色实际占 y-96 ~ y+94（约 190 单位高）。
     取 y = 202 → 角色占 106~296，上下各留 106 / 104，正好居中。
     之前 y 给到 276，角色整体偏下，看起来就像「掉到画面底下了」。 */
  const GROUND_Y = 262;                 /* 地面线：略低于脚底 */
  const FOOT_MARGIN = 34;               /* 脚底与底边的安全距离 */

  /* ---- 远景：只用两块纯色（天空 + 一块柔光斑）。
     低幼化：背景元素必须少于 3 个。写实的树影、楼房、纹理一律不要 ——
     信息密度一高，画面就「看不懂」，看不懂就容易不安。 ---- */
  const back = [
    art.rect(0, 0, 640, 400, { rx: 0, fill: mood.sky[0], stroke: 'none' }),
    art.ellipse(430, 118, 150, 108, { fill: mood.glow, opacity: 0.42, stroke: 'none', class: p + '-light' })
  ];

  /* ---- 中景：地面、桌子、盒子这些角色站的地方 ---- */
  const mid = [
    art.rect(0, GROUND_Y, 640, 400 - GROUND_Y, { rx: 0, fill: mood.props[1], stroke: 'none', opacity: 0.45 }),
    art.line(0, GROUND_Y, 640, GROUND_Y, { stroke: 'rgba(150,120,80,.2)', width: 2 })
  ];

  /* ---- 前景：只留「空气里的微尘」，不加虚化色块 ----
     虚化的前景色块会造成「有什么东西挡住了」的错觉，低幼观众会不安。 */
  const front = ambientArt(t, p, mood);

  /* ---- 角色 ----
     站位要留足余量：脚底离底边太近的话，镜头一推近脚就被切掉。
     画布 400 高、地面线 288，这里让脚底落在 322 附近，底边留 78 的余量。 */
  const heroY = 202;
  const rigParts = cast.rigOf(who, 320, heroY, 1.5, { expr: t.expr }, p);
  const stage = art.groupCls(p + '-stage', [
    art.groupCls(p + '-fadeBox', [
      art.groupCls(p + '-heroBox', [
        art.groupCls(p + '-spinBox', rigParts)
      ])
    ])
  ]);

  /* ---- 环境色温：整页染一层光，从「扁平矢量」变成「有空气」 ---- */
  const temp = art.tempOverlay(art.tempOfMood(shot.mood));

  /* ---- 装进摄像机 ----
     第一件事是铺一张「满画布」的底：transform-box: fill-box 的百分比轴心是
     相对元素包围盒算的，如果摄像机组的包围盒比画布小，轴心就会跑偏，
     缩放时角色会被顶出画面（这就是「歪了」的真正原因）。
     铺满 640×400 之后，50% 42% 才真的等于「画布横向中心、纵向 42% 处」。 */
  const bed = art.rect(0, 0, 640, 400, { rx: 0, fill: 'none', stroke: 'none' });

  return [art.groupCls(p + '-camera', [].concat(
    [bed],
    [art.groupCls(p + '-par-back', back)],
    [art.groupCls(p + '-par-mid', mid)],
    stage,
    [art.groupCls(p + '-par-front', front)],
    [temp]                       /* 色温叠在最上层 */
  ))];
}

/** 完整播放页：SVG + CSS 动画 + 字幕 + 播放控制 */
function playerHtml(book, shots, opt) {
  opt = opt || {};
  const css = shots.map((s, i) => cssFor(tl.timelineOf(s.action), 's' + i)).join('\n');
  return { css: css };
}

module.exports = { cssFor, shotSvg, ambientArt, ORIGIN, playerHtml, starPts, squashPair };
