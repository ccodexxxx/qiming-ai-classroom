/**
 * AI 动画 · 动作时间轴
 *
 * 核心区别：
 *   以前的「视频」= 一张静态图 + 平移缩放（Ken Burns），本质还是 PPT。
 *   这里的「动画」= 角色被拆成可独立运动的部件（头 / 身体 / 双臂 / 双腿 / 呆毛 / 眼睛 / 嘴），
 *                  按动作时间轴逐帧驱动，遵守迪士尼十二法则里的挤压拉伸、预备动作、跟随动作。
 *
 * 每一个动作输出一条时间轴：
 *   loop   循环动作（走路 / 呼吸 / 摇尾巴），可以一直演
 *   acts   一次性动作（跳 / 摔倒 / 转圈），有明确的起止
 *   每帧写明「秒数 + 各部件状态」，前端据此生成 CSS 关键帧。
 */
'use strict';

/* ================= 迪士尼十二法则的最小可用子集 ================= */
/**
 * 挤压与拉伸：起跳前压缩、腾空时拉长；落地时再压缩一次。
 * 预备动作：跳之前先蹲一下，伸手之前先后仰。
 * 跟随动作：身体停下后，呆毛与手臂还多晃两下。
 */
/* ================= 摄像机 ================= */
/**
 * 动画片和 PPT 的第二个分界线：**镜头是活的**。
 * 每一帧可以带 camX / camY / camZoom / camRotate，作用在最外层的 x-camera 上。
 * 角色跑向边缘时镜头跟随；惊讶时快速推进；摔倒时轻微震动。
 *
 * 注意：摄像机的位移是「镜头动」，所以背景要走反方向，而且三层速度不同（视差）。
 */
const PARALLAX = {
  front: 1.55,   /* 前景：虚化的叶子、光晕 —— 离镜头最近，走得最快 */
  mid:   0.85,   /* 中景：桌子、盒子、角色站的地方 */
  back:  0.22    /* 远景：窗外树影、墙 —— 几乎不动，制造纵深 */
};
/** 每个动作自带的默认运镜，让「谁的镜头在动」有章法 */
/**
 * 摄像机安全框。
 *
 * 画布只有 640×400，角色从 y=150（头顶）到 y=353（脚底）已经占了 200 单位。
 * 镜头一旦推得太近或移得太远，头顶和脚就会被切出画面 —— 这就是「歪了」的来源。
 * 所以这里给死上限：放大不超过 1.18，位移不超过 ±22，真正的画面完整性优先。
 */
/* 画面只有 640×400，角色高约 190 单位（y 156~346）。
   scale 取 s 时可见高度是 400/s —— 要装下 190 单位还留余量，
   s 超过 1.15 就会开始切脚。所以上限压在 1.12。 */
const CAM_SAFE = { maxZoom: 1.12, minZoom: 0.96, maxShift: 22, maxShake: 4 };

const CAM_BY_ACTION = {
  breathe: { zoom: [1.0, 1.04], y: [0, -3] },             // 呼吸时极缓地推近
  walk:    { x: [18, -18], zoom: [1.04, 1.05] },          // 跟拍：角色往右走，镜头往左让
  run:     { x: [22, -22], zoom: [1.06, 1.1] },           // 快速跟拍并推近
  jump:    { y: [0, -14], zoom: [1.0, 1.1] },             // 起跳时镜头上摇并推近
  reach:   { zoom: [1.0, 1.1] },                         // 伸手时推近
  cover:   { zoom: [1.04, 1.12], y: [0, 5] },             // 缩起来时贴近
  spin:    { zoom: [1.02, 1.1] },
  fall:    { y: [0, 12], zoom: [1.08, 1.02], shake: 1 },  // 摔倒：镜头下沉 + 震一下
  tiptoe:  { zoom: [1.03, 1.1], y: [0, -5] },
  lie:     { zoom: [1.06, 1.12], y: [-4, 2] },
  back:    { zoom: [1.0, 1.1], x: [0, 12] }               // 后退时镜头跟退
};
/** 把摄像机值夹进安全框，超出的部分直接砍掉 */
function clampCam(v) {
  return {
    camX: Math.max(-CAM_SAFE.maxShift, Math.min(CAM_SAFE.maxShift, v.camX)),
    camY: Math.max(-CAM_SAFE.maxShift, Math.min(CAM_SAFE.maxShift, v.camY)),
    camZoom: Math.max(CAM_SAFE.minZoom, Math.min(CAM_SAFE.maxZoom, v.camZoom)),
    camRotate: Math.max(-3, Math.min(3, v.camRotate)),
    camShake: Math.min(CAM_SAFE.maxShake, v.camShake)
  };
}

const EASE = {
  linear: 'linear',
  /* 预备 → 发力：先慢后快 */
  anticipate: 'cubic-bezier(.4,0,.9,.5)',
  /* 落地缓冲：先快后慢再回弹 */
  settle: 'cubic-bezier(.2,1.5,.5,1)',
  /* 弹性回弹 */
  bounce: 'cubic-bezier(.3,1.6,.4,1)',
  soft: 'ease-in-out'
};

/* ================= 动作库 ================= */
/**
 * 每个动作给出：
 *   dur     动作时长（秒）
 *   loop    是否循环
 *   frames  关键帧数组：{ at: 0..1 进度, body/head/armL/armR/legL/legR/hair/tilt/squash }
 *   ambient 同时发生的场景动态
 *   label   给孩子看的说法
 */
const ACTIONS = {
  breathe: {
    label: '站着呼吸，肚子一鼓一鼓', dur: 2.6, loop: true,
    frames: [
      { at: 0, body: 0, head: 0, squash: 0 },
      { at: 0.5, body: -3, head: -1.4, squash: 0.03 },
      { at: 1, body: 0, head: 0, squash: 0 }
    ],
    ambient: ['dust', 'leaf']
  },
  walk: {
    label: '一步一步往前走', dur: 5.4, loop: true,
    /*
     * 关键是「真的在往前走」：dx 让角色从画面左侧一路走到右侧。
     * 如果整段时间轴只用来走路，循环回起点时会「瞬间闪回」；
     * 所以前面 40% 走路、后面 60% 站着喘口气并淡出，
     * 位移只发生在前半段——观感上就是一条连续的行走。
     */
    frames: [
      { at: 0, armL: -26, armR: 26, legL: 22, legR: -22, body: 0, head: 2, dx: -52, op: 0.2 },
      { at: 0.06, armL: -8, armR: 8, legL: 8, legR: -8, body: -4, head: 1, dx: -20, op: 1 },
      { at: 0.13, armL: 20, armR: -20, legL: -18, legR: 18, body: 0, head: -1, dx: 34, op: 1 },
      { at: 0.19, armL: -26, armR: 26, legL: 22, legR: -22, body: -5, head: 2, dx: 88, op: 1, squash: -0.03 },
      { at: 0.26, armL: -8, armR: 8, legL: 8, legR: -8, body: 0, head: 1, dx: 142, op: 1 },
      { at: 0.33, armL: 20, armR: -20, legL: -18, legR: 18, body: -4, head: -1, dx: 196, op: 1, squash: -0.03 },
      { at: 0.4, armL: 0, armR: 0, legL: 0, legR: 0, body: 0, head: 0, dx: 236, op: 1 },
      /* 站定喘气：位移停住，只留呼吸起伏 */
      { at: 0.6, armL: 0, armR: 0, legL: 0, legR: 0, body: -3, head: -1, dx: 236, op: 1 },
      { at: 0.8, armL: 0, armR: 0, legL: 0, legR: 0, body: 0, head: 0, dx: 236, op: 1 },
      { at: 0.92, armL: 0, armR: 0, legL: 0, legR: 0, body: 0, head: 0, dx: 236, op: 0 },
      { at: 1, armL: -26, armR: 26, legL: 22, legR: -22, body: 0, head: 2, dx: -52, op: 0 }
    ],
    ambient: ['dust', 'leaf', 'light']
  },
  run: {
    label: '跑起来，身体前倾', dur: 3.6, loop: true,
    frames: [
      { at: 0, armL: -34, armR: 34, legL: 26, legR: -26, body: -6, tilt: 5, head: 3, dx: -80, op: 0.2 },
      { at: 0.08, armL: 34, armR: -34, legL: -26, legR: 26, body: -10, tilt: 5, head: -3, squash: -0.05, dx: -10, op: 1 },
      { at: 0.18, armL: -34, armR: 34, legL: 26, legR: -26, body: -6, tilt: 5, head: 3, dx: 66, op: 1 },
      { at: 0.28, armL: 34, armR: -34, legL: -26, legR: 26, body: -10, tilt: 5, head: -3, squash: -0.05, dx: 142, op: 1 },
      { at: 0.38, armL: -34, armR: 34, legL: 26, legR: -26, body: -6, tilt: 5, head: 3, dx: 216, op: 1 },
      { at: 0.46, armL: 0, armR: 0, legL: 0, legR: 0, body: 0, tilt: 3, head: 0, dx: 262, op: 1 },
      { at: 0.66, armL: 0, armR: 0, legL: 0, legR: 0, body: -4, tilt: 3, head: 0, dx: 262, op: 1 },
      { at: 0.84, armL: 0, armR: 0, legL: 0, legR: 0, body: 0, tilt: 3, head: 0, dx: 262, op: 1 },
      { at: 0.94, armL: 0, armR: 0, legL: 0, legR: 0, body: 0, tilt: 3, head: 0, dx: 262, op: 0 },
      { at: 1, armL: -34, armR: 34, legL: 26, legR: -26, body: -6, tilt: 5, head: 3, dx: -80, op: 0 }
    ],
    ambient: ['dust', 'leaf', 'light', 'speed']
  },
  jump: {
    label: '先蹲一下，再蹦起来', dur: 1.5, loop: false,
    frames: [
      /* 预备：蹲下蓄力 */
      { at: 0, body: 0, legL: 0, legR: 0, squash: 0 },
      { at: 0.18, body: 30, legL: 14, legR: 14, squash: 0.16, ease: 'anticipate' },
      /* 发力：拉长腾空 */
      { at: 0.42, body: -40, legL: -10, legR: -10, armL: -38, armR: 38, squash: -0.14, ease: 'settle' },
      /* 顶点：短暂悬停 */
      { at: 0.58, body: -46, legL: -6, legR: -6, armL: -42, armR: 42, squash: -0.06 },
      /* 落地：压缩缓冲 */
      { at: 0.8, body: 22, legL: 12, legR: 12, squash: 0.14, ease: 'settle' },
      /* 跟随：回弹两下 */
      { at: 1, body: 0, legL: 0, legR: 0, squash: 0 }
    ],
    ambient: ['dust', 'leaf']
  },
  reach: {
    label: '伸出手去够东西', dur: 1.2, loop: false,
    frames: [
      { at: 0, armL: 0, armR: 0, body: 0, tilt: 0 },
      /* 预备：先往后仰一点点 */
      { at: 0.2, armL: 8, armR: 18, body: -8, tilt: -4, ease: 'anticipate' },
      /* 伸手：身体前倾，手臂拉长 */
      { at: 0.55, armL: -18, armR: 42, body: -14, tilt: 8, squash: -0.06, ease: 'settle' },
      { at: 0.78, armL: -12, armR: 38, body: -10, tilt: 6 },
      { at: 1, armL: 0, armR: 0, body: 0, tilt: 0 }
    ],
    ambient: ['dust']
  },
  cover: {
    label: '抱住头，缩成一团', dur: 1.1, loop: false,
    frames: [
      { at: 0, armL: 0, armR: 0, body: 0 },
      { at: 0.3, armL: -30, armR: 30, body: 14, squash: 0.1, ease: 'anticipate' },
      { at: 0.6, armL: -42, armR: 42, body: 18, squash: 0.12, shake: 1 },
      { at: 0.8, armL: -40, armR: 40, body: 16, squash: 0.1, shake: -1 },
      { at: 1, armL: -44, armR: 44, body: 18, squash: 0.12 }
    ],
    ambient: ['shake']
  },
  spin: {
    /**
     * 「高兴得转圈」**不能真的整体转 360°**。
     * 骨架是正面对着观众的，整体旋转会让人物侧过去、五官挤在一起，
     * 在低幼观众眼里就是「脸歪了」—— 这正是要杜绝的诡异感。
     * 改成「原地左右摇摆 + 上下轻弹」，一样表达开心，但脸始终朝着观众。
     */
    label: '高兴得左右摇摆', dur: 1.6, loop: false,
    frames: [
      { at: 0, body: 0, tilt: 0, armL: 0, armR: 0, legL: 0, legR: 0 },
      { at: 0.15, body: 12, tilt: 0, squash: 0.1, armL: 16, armR: -16, ease: 'anticipate' },
      { at: 0.35, body: -14, tilt: -9, armL: -26, armR: 26, legL: 10, legR: -10, squash: -0.05 },
      { at: 0.6, body: -10, tilt: 9, armL: 26, armR: -26, legL: -10, legR: 10, squash: -0.05 },
      { at: 0.82, body: 10, tilt: -6, armL: -18, armR: 18, squash: 0.08, ease: 'settle' },
      { at: 1, body: 0, tilt: 0, armL: 0, armR: 0, legL: 0, legR: 0 }
    ],
    ambient: ['sparkle', 'dust']
  },
  fall: {
    /**
     * 「坐倒」也不能整体旋转几十度 —— 那会变成人横着飞出去。
     * 用「身体快速下沉 + 腿折起来 + 大幅挤压」表现屁股着地，
     * 再配一点小角度倾斜（tilt ≤ 12°）就够了。
     */
    label: '一屁股坐倒', dur: 1.3, loop: false,
    frames: [
      { at: 0, body: 0, tilt: 0, legL: 0, legR: 0 },
      /* 预备：往后仰一下 */
      { at: 0.15, body: -14, tilt: -8, legL: -6, legR: -6, ease: 'anticipate' },
      /* 落地：身体下沉、双腿折起、大幅挤压 */
      { at: 0.5, body: 56, tilt: 8, legL: 26, legR: 26, armL: -38, armR: 38, squash: 0.18, ease: 'settle' },
      /* 回弹：上下弹两下 */
      { at: 0.72, body: 46, tilt: 6, legL: 24, legR: 24, armL: -26, armR: 26, squash: 0.1 },
      { at: 1, body: 56, tilt: 7, legL: 26, legR: 26, armL: -34, armR: 34, squash: 0.16 }
    ],
    ambient: ['dust', 'shake']
  },
  tiptoe: {
    label: '踮起脚尖，偷偷往前看', dur: 1.8, loop: true,
    frames: [
      { at: 0, body: -6, legL: -10, legR: -10, head: 0 },
      { at: 0.5, body: -12, legL: -14, legR: -14, head: -3 },
      { at: 1, body: -6, legL: -10, legR: -10, head: 0 }
    ],
    ambient: ['dust', 'leaf']
  },
  lie: {
    /**
     * 「趴下来」**绝对不能靠整体旋转**。
     * 角色的骨架是按站立姿势建的，整体转 -74° 只会让人横过来（看起来就是「歪了」）。
     * 正确做法：把身体往下压、腿折起来、头凑近并轻轻摆动 —— 靠关节做出"趴"的姿态。
     */
    label: '趴下来仔细看', dur: 2.2, loop: true,
    frames: [
      { at: 0, body: 40, legL: 26, legR: 26, head: 16, armL: 26, armR: -26, squash: 0.1 },
      { at: 0.5, body: 44, legL: 26, legR: 26, head: 20, armL: 30, armR: -30, squash: 0.12 },
      { at: 1, body: 40, legL: 26, legR: 26, head: 16, armL: 26, armR: -26, squash: 0.1 }
    ],
    ambient: ['dust', 'leaf']
  },
  back: {
    /**
     * 「往后退」靠的是身体后仰 + 手臂护在身前，
     * 整体倾斜一律压在 10° 以内 —— 超过 12° 人就像要倒了，看起来就是「歪的」。
     */
    label: '吓一跳，往后退半步', dur: 1.0, loop: false,
    frames: [
      { at: 0, body: 0, tilt: 0, armL: 0, armR: 0 },
      { at: 0.2, body: -14, tilt: -6, armL: 18, armR: 18, legL: -10, legR: -10, ease: 'anticipate' },
      { at: 0.55, body: 14, tilt: -10, armL: 44, armR: -44, legL: 16, legR: 16, squash: 0.08, ease: 'settle' },
      { at: 0.8, body: 8, tilt: -7, armL: 38, armR: -38, legL: 12, legR: 12 },
      { at: 1, body: 10, tilt: -8, armL: 40, armR: -40, legL: 14, legR: 14 }
    ],
    ambient: ['dust', 'shake']
  }
};

/* 表情随动作变化：让脸也一起演戏，而不是一张脸演到底 */
const EXPR_BY_ACTION = {
  breathe: 'happy', walk: 'happy', run: 'wonder', jump: 'star', reach: 'wonder',
  cover: 'worried', spin: 'laugh', fall: 'sad', tiptoe: 'wonder', lie: 'wonder', back: 'worried'
};

/** 场景动态：动画片里背景不能是死的 */
const AMBIENT = {
  dust:    { name: '漂浮的微尘', css: 'pbA-dust' },
  leaf:    { name: '叶子轻轻摆动', css: 'pbA-leaf' },
  light:   { name: '光斑缓慢流动', css: 'pbA-light' },
  sparkle: { name: '小星星一闪一闪', css: 'pbA-sparkle' },
  shake:   { name: '画面轻微震动', css: 'pbA-shake' },
  speed:   { name: '速度线掠过', css: 'pbA-speed' }
};

/**
 * 从剧情推出该演什么动作。
 *
 * 页面数据里的 pose 是「静态姿态」（stand / lie / reach），
 * 但动画需要的是「动作」（走 / 跑 / 跳 / 摔 / 转圈 / 抱头）。
 * 这里按故事节拍 + 台词关键词做一次语义推导，让每一镜都演对戏。
 */
const BEAT_ACTION = {
  curious: 'tiptoe', meet: 'reach', problem: 'back', stuck: 'cover',
  worry: 'cover', idea: 'reach', clue: 'lie', setback: 'fall',
  success: 'spin', gift: 'tiptoe'
};
const KEYWORD_ACTION = [
  [/走|跑过来|跑过去|走过去/, 'walk'],
  [/跑|冲过去|飞快/, 'run'],
  [/蹦|跳/, 'jump'],
  [/转圈|转了三圈|转了一圈/, 'spin'],
  [/摔|坐倒|趴倒/, 'fall'],
  [/抱头|捂住|缩成/, 'cover'],
  [/后退|退了一步|退半步/, 'back'],
  [/趴|蹲下|贴/, 'lie'],
  [/踮|探头|偷偷/, 'tiptoe'],
  [/伸|指着|拿起|举着|翻开|够/, 'reach']
];
function actionFor(page, mid, beat) {
  const text = [
    (page.say && page.say.text) || '',
    (mid && mid.desc) || '',
    (page.lines || []).join('')
  ].join('，');
  /* 台词里明确写了动作，就以它为准 */
  for (let i = 0; i < KEYWORD_ACTION.length; i++) {
    if (KEYWORD_ACTION[i][0].test(text)) return KEYWORD_ACTION[i][1];
  }
  /* 否则按故事节拍给一个贴切的表演 */
  return BEAT_ACTION[beat] || 'breathe';
}

/** 在两个数之间按 t 插值 */
function lerp(a, b, t) { return a + (b - a) * t; }

/**
 * 角色姿态的安全范围。
 *
 * 骨架是按【站立】姿势建的，所以：
 *   · tilt（整体前后倾）超过 12° 人就像要倒 —— 看起来就是「歪的」
 *   · rot （整体旋转）除了刻意的转圈，一律必须是 0；
 *     想表现「趴下 / 倒下」要用关节（body 下沉、腿折起、头凑近），不能用整体旋转
 *
 * 这里在运行时把超标的帧夹回来，以后写新的动作也不会再犯。
 */
const POSE_LIMIT = {
  tilt: 12,        /* 整体前后倾：超过 12° 人就像要倒 */
  rot: 0,          /* 整体旋转：一律 0，想表现「转圈」用左右摇摆 */
  armL: 45, armR: 45,   /* 手臂：超过 45° 肩关节就像脱臼 */
  legL: 30, legR: 30,   /* 腿：超过 30° 髋关节就折了 */
  head: 25,        /* 头：点头/摇头的幅度 */
  hair: 30,        /* 呆毛：晃动幅度 */
  body: 56         /* 身体下沉量：幅度过大就变成「折叠」 */
};
/**
 * 把姿态夹进安全范围。
 *
 * 低幼动画不需要《猫和老鼠》级别的夸张变形 —— 微小的动作才是最可爱的。
 * 关节一旦转过头，观众看到的就是「脱臼 / 骨折」，也就是要杜绝的诡异感。
 * 这里在运行时兜底，以后写新动作也不会再犯。
 */
function clampPose(f) {
  const out = Object.assign({}, f);
  ['tilt', 'rot', 'armL', 'armR', 'legL', 'legR', 'head', 'hair', 'body'].forEach(function (k) {
    if (out[k] === undefined) return;
    const lim = POSE_LIMIT[k];
    out[k] = Math.max(-lim, Math.min(lim, out[k]));
  });
  return out;
}

/**
 * 把一个动作名解析成完整的时间轴
 *
 * 返回的 frames 里每帧都带上了摄像机字段（camX / camY / camZoom / camRotate / camShake）。
 * 摄像机值来自 CAM_BY_ACTION 的默认运镜，也可以在动作的 frames 里手写覆盖。
 *
 * @returns {{ action, label, dur, loop, frames, ambient, expr, cam }}
 */
function timelineOf(action) {
  const a = ACTIONS[action] || ACTIONS.breathe;
  const cam = CAM_BY_ACTION[action] || {};
  const frames = a.frames.map(raw => {
    const t = raw.at;
    const f = clampPose(raw);
    const pick = (key) => {
      if (f['cam' + key] !== undefined) return f['cam' + key];      /* 手写优先 */
      const r = cam[key.charAt(0).toLowerCase() + key.slice(1)];
      if (!r) return key === 'Zoom' ? 1 : 0;
      return lerp(r[0], r[1], t);
    };
    const camRaw = {
      camX: pick('X'), camY: pick('Y'), camZoom: pick('Zoom'), camRotate: pick('Rotate'),
      camShake: f.camShake !== undefined ? f.camShake : (cam.shake && t > 0.4 && t < 0.7 ? cam.shake : 0)
    };
    const c = clampCam(camRaw);
    return Object.assign({}, f, c, {
      /* 角色比背景放大得更快：镜头推近时，主角「扑」向观众，纵深才立得起来。
         但角色的额外放大同样受安全框约束，不能把头顶顶出画面。 */
      heroZoom: 1 + (c.camZoom - 1) * 0.5
    });
  });
  return {
    action: action,
    label: a.label,
    dur: a.dur,
    loop: !!a.loop,
    frames: frames,
    ambient: (a.ambient || []).map(k => Object.assign({ key: k }, AMBIENT[k] || {})),
    expr: EXPR_BY_ACTION[action] || 'happy',
    cam: cam
  };
}

/** 一本书 → 一条完整动画分镜（每一页是一个镜头） */
function storyboard(book) {
  return {
    title: book.title,
    emoji: book.emoji,
    conceptLabel: book.conceptLabel,
    cast: book.cast || [],
    shots: (book.pages || []).map(p => {
      const layers = (book.layersOf && book.layersOf(p.scene)) || null;
      const action = (book.actionOf && book.actionOf(p.scene)) || 'breathe';
      const t = timelineOf(action);
      return {
        index: p.index,
        title: p.title,
        camera: (layers && layers.camera) || '中景',
        action: t.action,
        actionLabel: t.label,
        duration: t.dur,
        loop: t.loop,
        timeline: t.frames,
        ambient: t.ambient,
        expr: t.expr,
        say: p.say || null,
        lines: p.lines || []
      };
    })
  };
}

module.exports = { ACTIONS, AMBIENT, EXPR_BY_ACTION, EASE, PARALLAX, CAM_SAFE, CAM_BY_ACTION, POSE_LIMIT, clampCam, clampPose, BEAT_ACTION, KEYWORD_ACTION, actionFor, timelineOf, storyboard, lerp };
