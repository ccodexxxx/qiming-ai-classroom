/**
 * AI 绘本 · 故事总入口
 * 把四批故事按「认知顺序」排好：是什么 → 能听 → 能看 → 能说 → 会犯错 → 需要人教 → 在哪里 → 我和它的关系
 */
'use strict';

const a = require('./pb-stories-a');
const b = require('./pb-stories-b');
const c = require('./pb-stories-c');
const d = require('./pb-stories-d');

const A = (a && a.STORIES) || [];
const B = (b && b.STORIES) || [];
const C = (c && c.STORIES) || [];
const D = (d && d.STORIES) || [];

const STORIES = [].concat(A.slice(0, 1), B.slice(0, 1), B.slice(1, 2), A.slice(1, 2), C.slice(0, 1), C.slice(1, 2), D.slice(0, 1), D.slice(1, 2));

module.exports = { STORIES, RAW: { a: A, b: B, c: C, d: D } };
