/**
 * scene-bounds.test.js —— 绘本插画越界检查（可独立运行，也会被 picturebook.test.js 调用）
 * 场景里的说明文字是直接按坐标画在 640×400 画布上的，
 * 一旦坐标超出范围就会被裁掉，而 SVG 不会报任何错——所以用几何估算兜住。
 */
'use strict';
const scenes = require('../server/lib/pb-scenes');
const layers = require('../server/lib/pb-layers');
/* 场景表在 pb-layers.js 里，名字是 LAYERS（早期叫 SCENES） */
const SCENE_IDS = Object.keys(layers.LAYERS);
const W = 640, H = 400;

function textWidth(s, size) {
  let w = 0;
  for (const ch of String(s)) w += /[\u4e00-\u9fa5\uff00-\uffef]/.test(ch) ? size : size * 0.58;
  return w;
}

/** @returns {string[]} 越界问题列表，空数组表示全部正常 */
function check() {
  const problems = [];
  /* 先检查每个场景「画得够不够」——嵌套数组没摊平会导致整组指令静默消失，
     画面只剩背景却不报错，这是本项目真实踩过的坑。 */
  for (const id of SCENE_IDS) {
    const svg = scenes.render(id, id);
    const shapes = (svg.match(/<(rect|circle|ellipse|path|line|polygon|text)[ />]/g) || []).length;
    if (shapes < 10) problems.push(id + ' 图元只有 ' + shapes + ' 个，可能有整组绘图指令被丢弃');
  }
  for (const id of SCENE_IDS) {
    const svg = scenes.render(id, id);
    const re = /<text ([^>]*)>([^<]*)<\/text>/g;
    let m;
    while ((m = re.exec(svg))) {
      const attrs = m[1], txt = m[2];
      const gx = /x="([-\d.]+)"/.exec(attrs);
      const gy = /y="([-\d.]+)"/.exec(attrs);
      const gs = /font-size="([-\d.]+)"/.exec(attrs);
      const ga = /text-anchor="(\w+)"/.exec(attrs);
      if (!gx || !gy || !gs) continue;
      const x = parseFloat(gx[1]), y = parseFloat(gy[1]), size = parseFloat(gs[1]);
      const anchor = ga ? ga[1] : 'start';
      const w = textWidth(txt, size);
      const left = anchor === 'middle' ? x - w / 2 : (anchor === 'end' ? x - w : x);
      const right = left + w;
      if (left < -2 || right > W + 2 || y - size < -4 || y > H + 2) {
        problems.push(id + ' 「' + txt.slice(0, 16) + '」 横向 ' + Math.round(left) + '~' + Math.round(right) + ' y=' + y);
      }
    }
  }
  return problems;
}

if (require.main === module) {
  const p = check();
  if (p.length) {
    console.log('发现 ' + p.length + ' 处越界文字：');
    p.forEach(x => console.log('  ' + x));
    process.exit(1);
  }
  console.log('全部 ' + SCENE_IDS.length + ' 个场景的文字都在画布范围内');
}

module.exports = { check, W, H };