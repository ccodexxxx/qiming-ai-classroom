/**
 * AI 视频 · 异步任务队列
 *
 * 一次渲染要跑 Chrome 截图 + 语音合成 + ffmpeg 编码，几十秒到几分钟，
 * 不能卡住 HTTP 请求。这里用最简单的内存队列：一次只跑一个任务，其余排队。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const video = require('./pb-video');
const pb = require('./pb-engine');

const ROOT = path.join(__dirname, '..', '..', 'data', 'videos');
const jobs = new Map();
let running = null;
let runningId = null;

function ensureDir(id) {
  const d = path.join(ROOT, id);
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function publicJob(j) {
  return {
    id: j.id, status: j.status, step: j.step, percent: j.percent,
    title: j.title, theme: j.theme, grade: j.grade,
    createdAt: j.createdAt, finishedAt: j.finishedAt || null,
    seconds: j.seconds || 0, bytes: j.bytes || 0, pages: j.pages || 0,
    withAudio: !!j.withAudio, error: j.error || null,
    url: j.status === 'done' ? '/media/videos/' + j.id + '/video.mp4' : null,
    poster: j.status === 'done' && j.poster ? '/media/videos/' + j.id + '/poster.jpg' : null
  };
}
/** 落盘一份清单，重启后还能看到历史作品 */
function saveIndex() {
  try {
    fs.writeFileSync(path.join(ROOT, 'index.json'),
      JSON.stringify(Array.from(jobs.values()).map(publicJob).slice(-60), null, 1), 'utf8');
  } catch (e) { /* 落盘失败不影响渲染 */ }
}
function loadIndex() {
  try {
    const raw = fs.readFileSync(path.join(ROOT, 'index.json'), 'utf8');
    JSON.parse(raw).forEach(j => { if (j && j.id) jobs.set(j.id, Object.assign({ internal: null }, j)); });
  } catch (e) { /* 首次运行为空 */ }
}

function create(book, opt) {
  const id = crypto.randomBytes(6).toString('hex');
  const dir = ensureDir(id);
  const job = {
    id: id, status: 'queued', step: '排队中', percent: 0,
    title: book.title, theme: book.conceptLabel, grade: book.grade,
    createdAt: Date.now(), dir: dir, book: book,
    subtitle: opt.subtitle !== false, voice: opt.voice !== false
  };
  jobs.set(id, job);
  pump();
  return publicJob(job);
}

function pump() {
  if (runningId) return;
  const next = Array.from(jobs.values()).filter(j => j.status === 'queued')[0];
  if (!next) return;
  runningId = next.id;
  next.status = 'running';
  next.step = '准备中';
  /* 放到下一个事件循环，先把 HTTP 响应发出去 */
  setImmediate(async () => {
    try {
      const r = await video.render(next.book, {
        dir: next.dir, subtitle: next.subtitle, voice: next.voice
      }, function (t, p) {
        next.step = t; next.percent = p;
      });
      if (r.ok) {
        next.status = 'done';
        next.step = '完成';
        next.percent = 100;
        next.seconds = r.seconds; next.bytes = r.bytes;
        next.pages = r.pages; next.withAudio = r.withAudio;
        next.poster = r.poster ? true : false;
      } else {
        next.status = 'failed';
        next.error = r.reason || '渲染失败';
        next.step = '失败';
      }
    } catch (e) {
      next.status = 'failed';
      next.error = String(e.message || e).slice(0, 200);
      next.step = '失败';
    }
    next.finishedAt = Date.now();
    saveIndex();
    runningId = null;
    pump();
  });
}

function get(id) { const j = jobs.get(id); return j ? publicJob(j) : null; }
function list() {
  return Array.from(jobs.values())
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .map(publicJob);
}

loadIndex();
module.exports = { create, get, list, ROOT, available: video.available };
