/**
 * maze.test.js —— 小AI历险记：关卡可解性回归
 *
 * 光看代码是看不出「这关走不通」的 —— 必须跑一遍 BFS。
 * 这个测试抓过好几次真问题：
 *   · 参考路线的顺序写错，一点运行就撞墙
 *   · 苹果需要「收集」积木，但参考路线没放
 *   · 第 4 关起点正好在终点上，一步没走就"通关"
 */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ck(name, ok, info) {
  if (ok) { pass++; console.log('  ✓ ' + name + (info ? '  ' + info : '')); }
  else { fail++; console.log('  ✗ ' + name + '  ' + (info || '')); }
}

/* 从 lab.js 里把 LEVELS 抠出来（不执行整个浏览器脚本） */
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'lab.js'), 'utf8');
const i0 = src.indexOf('var LEVELS = [');
let d = 0, i = src.indexOf('[', i0), end = -1;
for (; i < src.length; i++) {
  if (src[i] === '[') d++;
  else if (src[i] === ']') { d--; if (!d) { end = i + 1; break; } }
}
const LEVELS = eval('(' + src.slice(src.indexOf('[', i0), end) + ')');
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];

function blocked(L, r, c) {
  if (r < 0 || r >= L.rows || c < 0 || c >= L.cols) return true;
  return (L.walls || []).some(function (w) { return w[0] === r && w[1] === c; });
}
/* 把积木（含 repeat / if）展开成动作序列，和执行引擎同一套规则 */
function expand(list) {
  const out = [];
  (list || []).forEach(function (n) {
    if (n.type === 'onflag') out.push('event');
    else if (n.type === 'repeat') {
      const body = expand(n.body);
      for (let i = 0; i < n.times; i++) body.forEach(function (b) { out.push(b); });
    } else if (n.type === 'if') out.push({ branch: n.cond, body: n.body });
    else out.push(n.type);
  });
  return out;
}
/* 按引擎的规则模拟：机关踩到就亮、苹果要「收集」、每步之后判通关 */
function simulate(L, actions) {
  const s = { r: L.start.r, c: L.start.c, dir: L.start.dir, got: {} };
  const takePlate = function () {
    (L.plates || []).forEach(function (p) { if (p.r === s.r && p.c === s.c) s.got[p.r + ',' + p.c] = 1; });
  };
  const done = function () {
    const pl = (L.plates || []).every(function (p) { return s.got[p.r + ',' + p.c]; });
    const ap = (L.apples || []).every(function (x) { return s.got[x.r + ',' + x.c]; });
    return s.r === L.goal.r && s.c === L.goal.c && pl && ap;
  };
  takePlate();
  if (done()) return { ok: true, steps: 0 };
  const q = actions.slice();
  let n = 0;
  while (q.length && n++ < 400) {
    const a = q.shift();
    const nr = s.r + DIRS[s.dir][0], nc = s.c + DIRS[s.dir][1];
    if (a && a.branch) {
      if (a.branch === 'wall' && blocked(L, nr, nc)) {
        const b = expand(a.body);
        for (let k = b.length - 1; k >= 0; k--) q.unshift(b[k]);
      }
      continue;
    }
    if (a === 'move') {
      if (blocked(L, nr, nc)) return { ok: false, why: '第 ' + n + ' 步撞墙 (' + s.r + ',' + s.c + ')' };
      s.r = nr; s.c = nc; takePlate();
    } else if (a === 'left') s.dir = (s.dir + 3) % 4;
    else if (a === 'right') s.dir = (s.dir + 1) % 4;
    else if (a === 'pick') {
      (L.apples || []).forEach(function (x) { if (x.r === s.r && x.c === s.c) s.got[x.r + ',' + x.c] = 1; });
    }
    if (done()) return { ok: true, steps: n };
  }
  const ma = (L.apples || []).filter(function (x) { return !s.got[x.r + ',' + x.c]; }).length;
  const mp = (L.plates || []).filter(function (p) { return !s.got[p.r + ',' + p.c]; }).length;
  return { ok: false, why: '结束于 (' + s.r + ',' + s.c + ')，还差苹果 ' + ma + ' 个、机关 ' + mp + ' 个' };
}
/* BFS 穷举：确认这一关在原语下确实存在解 */
function solvable(L) {
  const targets = (L.plates || []).map(function (p) { return p.r + ',' + p.c; });
  const apples = (L.apples || []).map(function (a) { return a.r + ',' + a.c; });
  const key = function (s) {
    return s.r + ',' + s.c + ',' + s.dir + '|' +
      targets.map(function (k) { return s.got[k] ? 1 : 0; }).join('') + '|' +
      apples.map(function (k) { return s.got[k] ? 1 : 0; }).join('');
  };
  const s0 = { r: L.start.r, c: L.start.c, dir: L.start.dir, got: {} };
  (L.plates || []).forEach(function (p) { if (p.r === s0.r && p.c === s0.c) s0.got[p.r + ',' + p.c] = 1; });
  const q = [s0], seen = new Set([key(s0)]);
  let guard = 0;
  while (q.length && guard++ < 200000) {
    const s = q.shift();
    const pl = targets.every(function (k) { return s.got[k]; });
    const ap = apples.every(function (k) { return s.got[k]; });
    if (s.r === L.goal.r && s.c === L.goal.c && pl && ap) return true;
    const nr = s.r + DIRS[s.dir][0], nc = s.c + DIRS[s.dir][1];
    const cand = [];
    if (!blocked(L, nr, nc)) {
      const g = Object.assign({}, s.got);
      (L.plates || []).forEach(function (p) { if (p.r === nr && p.c === nc) g[p.r + ',' + p.c] = 1; });
      cand.push({ r: nr, c: nc, dir: s.dir, got: g });
    }
    cand.push({ r: s.r, c: s.c, dir: (s.dir + 3) % 4, got: s.got });
    cand.push({ r: s.r, c: s.c, dir: (s.dir + 1) % 4, got: s.got });
    if (apples.indexOf(s.r + ',' + s.c) >= 0 && !s.got[s.r + ',' + s.c]) {
      const g = Object.assign({}, s.got); g[s.r + ',' + s.c] = 1;
      cand.push({ r: s.r, c: s.c, dir: s.dir, got: g });
    }
    cand.forEach(function (o) { const k = key(o); if (seen.has(k)) return; seen.add(k); q.push(o); });
  }
  return false;
}

console.log('【关卡数据完整性】');
ck('关卡数 = 4', LEVELS.length === 4, LEVELS.length + ' 关');
LEVELS.forEach(function (L, i) {
  const tag = '第 ' + (i + 1) + ' 关《' + L.story + '》';
  ck(tag + ' 有故事与概念字段', !!(L.story && L.emoji && L.title && L.concept && L.learn && L.hint));
  ck(tag + ' 起点不在墙里', !blocked(L, L.start.r, L.start.c));
  ck(tag + ' 终点不在墙里', !blocked(L, L.goal.r, L.goal.c));
  /* 起点可以等于终点（第 4 关是巡逻环线，必须绕一圈把苹果摘了），
     但不能「一步不走就通关」—— 那样孩子什么也没学到。
     判据：起点在终点上时，必须还有要收集的东西。 */
  const atGoalAtStart = (L.start.r === L.goal.r && L.start.c === L.goal.c);
  const hasCollect = (L.apples || []).length + (L.plates || []).length > 0;
  ck(tag + ' 不会一步不走就通关',
    !atGoalAtStart || hasCollect,
    atGoalAtStart ? '起点在终点上，但有 ' + ((L.apples || []).length + (L.plates || []).length) + ' 个收集目标' : '');
  (L.apples || []).forEach(function (a, k) {
    ck(tag + ' 第 ' + (k + 1) + ' 个苹果不在墙里', !blocked(L, a.r, a.c));
  });
  (L.plates || []).forEach(function (p, k) {
    ck(tag + ' 第 ' + (k + 1) + ' 个机关不在墙里', !blocked(L, p.r, p.c));
  });
});

console.log('');
console.log('【参考路线真的能通关】');
LEVELS.forEach(function (L, i) {
  const acts = expand(L.ref || []);
  const r = simulate(L, acts);
  ck('第 ' + (i + 1) + ' 关《' + L.story + '》', r.ok, r.ok ? (acts.length + ' 步') : r.why);
});

console.log('');
console.log('【每一关都存在解（BFS 穷举）】');
LEVELS.forEach(function (L, i) {
  ck('第 ' + (i + 1) + ' 关《' + L.story + '》有解', solvable(L));
});

console.log('');
console.log(pass + ' 项通过 / ' + fail + ' 项不通过');
if (fail) process.exitCode = 1;
