/**
 * 原理动画「大模型增强讲解」缓存读取
 *
 * tools/enrich-animations.js 用火山豆包 2.1 Pro 生成更详细、更易懂的讲解词后，
 * 写入 data/anim-enriched.json。这里只负责读取，未生成时返回 null，播放器回退内置文案。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'data', 'anim-enriched.json');

let cache = {};
try {
  cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (e) {
  cache = {};
}

function forAnimation(id) {
  const e = cache[id];
  if (!e || !Array.isArray(e.phases)) return null;
  return e;
}

module.exports = { forAnimation, FILE };
