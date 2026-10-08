/**
 * package.js —— 生成交付压缩包
 *
 * 交付包里只放「源码 + 文档 + 测试 + 一份导出样例」。
 * 明确排除运行期垃圾：
 *   .btest/                  测试用的 Chrome 配置（81 MB）
 *   data/videos/<id>/chrome/ 导出 MP4 时 Chrome 留下的临时配置（89 MB）
 *   data/videos/<id>/audio|frames/  可重新生成的中间产物
 *   data/students/*.json     运行时学生档案
 *   __pycache__/
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/* 这个脚本在 tools/ 下，项目根是它的上一级 */
const ROOT = path.join(__dirname, '..');
const DESKTOP = process.env.USERPROFILE + '\\Desktop';
const NAME = '启明AI课堂-K12多模态教学助手-v3.0.0';
const STAGE = path.join(ROOT, '.build', NAME);

/* 递归复制，按相对路径判断是否排除 */
function copy(src, dst, skip) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    if (skip(src)) return;
    fs.mkdirSync(dst, { recursive: true });
    fs.readdirSync(src).forEach(function (n) { copy(path.join(src, n), path.join(dst, n), skip); });
    return;
  }
  if (skip(src)) return;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

const skip = function (p) {
  const rel = path.relative(ROOT, p).replace(/\\/g, '/');
  if (rel.indexOf('.build/') === 0) return true;
  if (rel.indexOf('.btest/') === 0) return true;
  if (rel.indexOf('__pycache__') >= 0) return true;
  if (rel.indexOf('/chrome') >= 0) return true;
  if (rel.indexOf('data/students/') === 0) return true;
  if (rel.indexOf('data/videos/') === 0) {
    /* 视频导出只留最终成片和封面 */
    return !/\/video\.mp4$|\/poster\.jpg$/.test(rel);
  }
  return false;
};

fs.rmSync(path.join(ROOT, '.build'), { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });

['server', 'public', 'docs', 'tests', 'tools', 'README.md'].forEach(function (n) {
  copy(path.join(ROOT, n), path.join(STAGE, n), skip);
});

/* 导出样例：只保留最新的一条，index.json 也精简到同一条 */
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'videos', 'index.json'), 'utf8'));
const newest = idx.slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); })[0];
fs.mkdirSync(path.join(STAGE, 'data', 'videos', newest.id), { recursive: true });
['video.mp4', 'poster.jpg'].forEach(function (f) {
  fs.copyFileSync(path.join(ROOT, 'data', 'videos', newest.id, f),
    path.join(STAGE, 'data', 'videos', newest.id, f));
});
fs.writeFileSync(path.join(STAGE, 'data', 'videos', 'index.json'),
  JSON.stringify([newest], null, 1), 'utf8');

/* 打 zip */
const zip = path.join(DESKTOP, NAME + '.zip');
fs.rmSync(zip, { force: true });
execFileSync('powershell.exe', ['-NoProfile', '-Command',
  'Compress-Archive -Path \'' + STAGE + '\' -DestinationPath \'' + zip + '\' -Force'],
  { stdio: 'inherit' });

const files = [];
(function walk(d) {
  fs.readdirSync(d).forEach(function (n) {
    const p = path.join(d, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p); else files.push([path.relative(STAGE, p), st.size]);
  });
})(STAGE);
const total = files.reduce(function (s, f) { return s + f[1]; }, 0);
console.log('源码包：' + files.length + ' 个文件 / ' + (total / 1024 / 1024).toFixed(2) + ' MB');
console.log('压缩包：' + zip + '  ' + (fs.statSync(zip).size / 1024).toFixed(1) + ' KB');
console.log('');
console.log('顶层结构：');
fs.readdirSync(STAGE).sort().forEach(function (n) {
  const st = fs.statSync(path.join(STAGE, n));
  console.log('  ' + (st.isDirectory() ? '[目录] ' : '       ') + n);
});
