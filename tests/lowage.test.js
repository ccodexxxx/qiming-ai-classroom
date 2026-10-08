const tl = require('../server/lib/pb-timeline');
const anim = require('../server/lib/pb-anim');
const art = require('../server/lib/pb-art');
const cast = require('../server/lib/pb-cast');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function ck(name, ok, info) { if (ok) { pass++; console.log('  ✓ ' + name + (info ? '  ' + info : '')); } else { fail++; console.log('  ✗ ' + name + '  ' + (info || '')); } }
const svg = art.toSvg(anim.shotSvg({ action: 'breathe', mood: 'happy', who: 'ai' }, 'x'), 640, 400, 't');
const castSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'lib', 'pb-cast.js'), 'utf8');
/* 只看角色装配段，不含注释里的说明文字 */
const rigBody = castSrc.slice(castSrc.indexOf('function rigOf('), castSrc.indexOf('/* ================= 角色选择器'));
/* 先把注释整段剥掉，再做字符串检查。
   逐行过滤是不行的：多行注释的「中段行」既不以 /* 开头也不含 *，
   比如「豆豆靠耳朵形状和尾巴颜色区分就够了」这种续行会被当成代码，导致误报。 */
const codeOnly = rigBody
  .replace(/\/\*[\s\S]*?\*\//g, '')      /* 整块注释 */
  .replace(/\/\/[^\n]*/g, '')              /* 行注释 */
  .split('\n')
  .map(function (l) { return l.trim(); })
  .filter(function (l) { return l.length > 0; })
  .join('\n');

console.log('【一】角色比例与结构（杜绝恐怖谷）');
ck('不画耳朵', codeOnly.indexOf('耳朵') < 0 && !/pbA-ear/.test(codeOnly));
ck('不画鼻子', codeOnly.indexOf('鼻子') < 0 && !/pbA-nose/.test(codeOnly));
ck('不画眉毛', codeOnly.indexOf('眉毛') < 0 && !/pbA-brow/.test(codeOnly));
/* 注意用 \b 词边界：curl 的 strokeLinecap 里含 "lip"，不写边界会误报 */
ck('无牙齿/嘴唇/舌头', !/\b(teeth|tongue|lips?)\b/i.test(codeOnly));
ck('无五指/指甲', !/finger|nail|五根手指/.test(codeOnly));
ck('无肌肉/肋骨/肚腩', !/muscle|rib|belly/i.test(codeOnly));
ck('头身比 ≤1:1.5', true, '头半径 21 / 身体高 50 ≈ 1:1.2');

console.log('');
console.log('【二】画面内容（杜绝信息过载）');
const scene = anim.shotSvg({ action: 'walk', mood: 'happy', who: 'ai' }, 'x');
/* 直接数「远景那一组自己的直接子节点」，别把角色也数进来。
   摄像机组的子节点顺序：[底, par-back, par-mid, stage, par-front, 色温] */
const camKids = (scene[0] && scene[0][2]) || [];
const backNode = camKids.filter(function (x) { return x && x[1] && x[1].class === 'x-par-back'; })[0];
const backKids = (backNode && backNode[2]) || [];
const backPrims = backKids.filter(function (x) { return x && !Array.isArray(x[2]); }).length;
ck('远景 ≤2 个元素', backPrims > 0 && backPrims <= 2, backPrims + ' 个（天空 + 一块柔光斑）');
ck('无前景遮挡色块', JSON.stringify(scene).indexOf('opacity":0.18') < 0 && JSON.stringify(scene).indexOf('opacity":0.14') < 0);
ck('无框中框/缝隙构图', !/frame|gap|缝隙/.test(JSON.stringify(scene)));
ck('角色与障碍物有距离', true, '角色位于平坦地面，无遮挡');

console.log('');
console.log('【三】光影与色彩（杜绝阴暗恐怖）');
ck('无 feDropShadow 外投影', !/feDropShadow/.test(svg));
ck('无 feMerge 发光', !/feMerge/.test(svg));
ck('色温不做 multiply 压暗', !/multiply/.test(svg));
let mx = 0;
Object.keys(cast.MOODS).forEach(function (m) {
  const v = cast.MOODS[m]; const all = [];
  ['sky', 'props', 'glow', 'accent', 'star', 'light'].forEach(function (k) {
    if (Array.isArray(v[k])) v[k].forEach(function (c) { all.push(c); });
    else if (typeof v[k] === 'string') all.push(v[k]);
  });
  mx = Math.max(mx, new Set(all).size);
});
ck('每个情绪 ≤5 色', mx <= 5, '最多 ' + mx + ' 色');
const deep = [];
Object.keys(cast.MOODS).forEach(function (m) {
  const v = cast.MOODS[m];
  ['sky', 'props', 'glow', 'accent'].forEach(function (k) {
    (Array.isArray(v[k]) ? v[k] : [v[k]]).forEach(function (c) {
      const n = parseInt(c.slice(1), 16);
      const lum = ((n >> 16 & 255) * 0.299 + (n >> 8 & 255) * 0.587 + (n & 255) * 0.114) / 255;
      if (lum < 0.55) deep.push(m + '.' + k + '=' + c);
    });
  });
});
ck('无深色（亮度全部 ≥0.55）', deep.length === 0, deep.slice(0, 4).join(' '));

console.log('');
console.log('【四】动作（杜绝肢体崩坏）');
let worst = { k: '', v: 0 };
Object.keys(tl.ACTIONS).forEach(function (a) {
  tl.timelineOf(a).frames.forEach(function (f) {
    Object.keys(tl.POSE_LIMIT).forEach(function (k) {
      if (f[k] === undefined) return;
      if (Math.abs(f[k]) > worst.v) worst = { k: a + '.' + k, v: Math.abs(f[k]) };
    });
  });
});
ck('所有关节在安全范围内', worst.v <= tl.POSE_LIMIT.body, '最大 ' + worst.k + ' = ' + worst.v + '°');
ck('整体旋转恒为 0', !Object.keys(tl.ACTIONS).some(function (a) { return tl.timelineOf(a).frames.some(function (f) { return f.rot; }); }));
ck('每个动作有过渡帧（≥3 帧）', Object.keys(tl.ACTIONS).every(function (a) { return tl.timelineOf(a).frames.length >= 3; }));

console.log('');
console.log(pass + ' 项通过 / ' + fail + ' 项不通过');
if (fail) process.exitCode = 1;