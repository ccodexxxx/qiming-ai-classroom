/**
 * MiniPy 解释器测试：抽取 public/js/lab.js 中的解释器，在 Node 中运行真实程序。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* 构造一个最小浏览器环境，只为让 lab.js 加载成功 */
const sandbox = {
  console,
  document: {
    createElement: () => ({ setAttribute() {}, appendChild() {}, addEventListener() {}, style: {} }),
    createElementNS: () => ({ setAttribute() {}, appendChild() {}, style: {} }),
    addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], readyState: 'complete'
  },
  window: null,
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
  Blob: function () {}, URL: { createObjectURL: () => '', revokeObjectURL() {} },
  setTimeout, clearTimeout, setInterval, clearInterval, Promise, Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error, parseInt, parseFloat, isNaN
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.AIQ = {
  ready: function () {}, el: () => ({}), qs: () => null, qsa: () => [], api: () => Promise.resolve({}),
  toast: function () {}, on: function () {}, clear: function () {}, uid: () => 'x', clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  speak: function () {}, shuffle: a => a, markdown: s => s, typewriter: () => ({ stop() {} }), state: {}
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'lab.js'), 'utf8'), sandbox, { filename: 'lab.js' });
const MiniPy = sandbox.window.AIQLab && sandbox.window.AIQLab.MiniPy;
if (!MiniPy) { console.log('未能取到 MiniPy'); process.exit(1); }

let pass = 0, fail = 0;
function t(name, code, expect) {
  let out, err = null;
  try { out = MiniPy.run(code).join('\n'); } catch (e) { err = e; }
  const ok = err ? false : out === expect;
  if (ok) { pass++; console.log('  ✓ ' + name); }
  else {
    fail++;
    console.log('  ✗ ' + name);
    console.log('      期望: ' + JSON.stringify(expect));
    console.log('      实际: ' + (err ? ('异常 ' + err.message) : JSON.stringify(out)));
  }
}
function tErr(name, code, re) {
  let err = null;
  try { MiniPy.run(code); } catch (e) { err = e; }
  const ok = err && re.test(err.message);
  if (ok) { pass++; console.log('  ✓ ' + name + '  → ' + err.message); }
  else { fail++; console.log('  ✗ ' + name + '（期望错误 /' + re.source + '/，实际 ' + (err ? err.message : '没有报错') + '）'); }
}

console.log('=== 基础语法 ===');
t('打印字符串', 'print("你好")', '你好');
t('多参数打印', 'print("a", 1, "b")', 'a 1 b');
t('变量与运算', 'a = 3\nb = 4\nprint(a * b + 1)', '13');
t('除法与整除', 'print(7 / 2)\nprint(7 // 2)\nprint(7 % 2)', '3.5\n3\n1');
t('幂运算', 'print(2 ** 10)', '1024');
t('运算优先级', 'print(1 + 2 * 3 ** 2)', '19');
t('字符串拼接', 'print("你好" + "世界")', '你好世界');
t('字符串重复', 'print("ab" * 3)', 'ababab');
t('字符串方法', 's = "  Hello World  "\nprint(s.strip().lower())\nprint("a,b,c".split(","))', 'hello world\n[\'a\', \'b\', \'c\']');
t('中文字符串', 'print("人工智能" + "通识")', '人工智能通识');

console.log('=== 条件与循环 ===');
t('if 分支', 'x = 86\nif x >= 90:\n    print("优")\nelif x >= 60:\n    print("及格")\nelse:\n    print("加油")', '及格');
t('for + range', 'for i in range(3):\n    print(i)', '0\n1\n2');
t('range 三参数', 'for i in range(1, 8, 2):\n    print(i)', '1\n3\n5\n7');
t('while 循环', 'i = 3\nwhile i > 0:\n    print(i)\n    i = i - 1', '3\n2\n1');
t('break 与 continue', 'for i in range(6):\n    if i == 2:\n        continue\n    if i == 5:\n        break\n    print(i)', '0\n1\n3\n4');
t('循环嵌套', 'for i in range(2):\n    for j in range(2):\n        print(i * 10 + j)', '0\n1\n10\n11');
t('遍历列表', 'for x in [3, 1, 2]:\n    print(x)', '3\n1\n2');

console.log('=== 列表与内置函数 ===');
t('列表操作', 'a = [3, 1, 2]\na.append(4)\nprint(a)\nprint(len(a))\nprint(a[0], a[-1])', '[3, 1, 2, 4]\n4\n3 4');
t('统计函数', 'a = [88, 92, 75]\nprint(sum(a))\nprint(max(a))\nprint(sorted(a))', '255\n92\n[75, 88, 92]');
t('列表方法', 'a = [2, 3]\na.insert(0, 1)\na.sort()\nprint(a)\nprint(a.index(3))', '[1, 2, 3]\n2');

console.log('=== 函数 ===');
t('定义与调用', 'def add(a, b):\n    return a + b\nprint(add(2, 5))', '7');
t('函数内循环', 'def row(n):\n    for i in range(n):\n        print("#")\nrow(3)', '#\n#\n#');
t('递归', 'def fib(n):\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)\nprint(fib(10))', '55');

console.log('=== 绘图 API（无画布时应静默） ===');
t('绘图调用不报错', 'penColor("#1f6f5c")\npenSize(3)\nmoveTo(10, 10)\nlineTo(50, 50)\ncircle(30, 30, 10)\nrect(5, 5, 20, 20)\nclear()\nprint("画完了")', '画完了');

console.log('=== 教学示例程序（实际会用到的代码） ===');
t('示例：梯度下降', 'w = 0.1\nfor step in range(3):\n    error = 10 * (w - 0.8)\n    grad = 20 * (w - 0.8)\n    w = w - 0.12 * grad\n    print("第", step + 1, "步 w =", round(w, 3))\nprint("最终", round(w, 3))',
  '第 1 步 w = 1.78\n第 2 步 w = -0.572\n第 3 步 w = 2.721\n最终 2.721');
t('幂运算优先级', 'print(2 ** 3 ** 2)\nprint(-2 ** 2)\nprint(2 * 3 ** 2)', '512\n-4\n18');
t('round 支持小数位', 'print(round(3.14159, 2))\nprint(round(2.71828, 3))\nprint(round(1.5))', '3.14\n2.718\n2');
t('误差逐轮变小', 'w = 0.1\nfor i in range(5):\n    w = w + (0.8 - w) * 0.5\n    print(round(w, 4))', '0.45\n0.625\n0.7125\n0.7563\n0.7781');
t('示例：规则分类器', 'sms = "恭喜您中奖！点击链接领取大奖"\nkeywords = ["中奖", "点击链接", "免费领取"]\nhit = 0\nfor word in keywords:\n    if word in sms:\n        hit = hit + 1\nif hit >= 2:\n    print("可疑短信")\nelse:\n    print("正常短信")', '可疑短信');
t('示例：最近邻', 'data = [[1, 1, 0], [3, 3, 1]]\nnew = [1.1, 1.2]\nbest = None\nbd = 999\nfor row in data:\n    dx = row[0] - new[0]\n    dy = row[1] - new[1]\n    d = dx * dx + dy * dy\n    if d < bd:\n        bd = d\n        best = row\nprint("类别", best[2])', '类别 0');
t('示例：画螺旋（只验证不报错）', 'size = 6\nfor i in range(20):\n    lineTo(150 + size, 150)\n    size = size + 4\nprint("ok")', 'ok');

console.log('=== 错误处理（必须给出中文提示并带行号） ===');
tErr('未定义变量', 'print(a)', /还没有定义/);
tErr('除以 0', 'x = 1 / 0', /不能除以 0/);
tErr('缩进错误', 'if True:\nprint(1)', /缩进/);
tErr('缺冒号', 'if True\n    print(1)', /看不懂|少了一个/);
tErr('下标越界', 'a = [1, 2]\nprint(a[5])', /超出范围/);
tErr('类型错误', 'print("a" - 1)', /不能把字符串当数字/);
tErr('死循环保护', 'i = 0\nwhile i < 100000:\n    i = i + 1', /步骤太多|时间太长/);
tErr('调用不存在的函数', 'foo()', /还没有定义/);

console.log('');
console.log(pass + ' 项通过，' + fail + ' 项失败');
process.exit(fail === 0 ? 0 : 1);
