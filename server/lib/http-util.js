/**
 * HTTP 服务 · 通用工具（请求解析、响应封装、会话、模板渲染）
 * 零依赖：只用 Node 内置模块。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

/** 读取请求体（限制大小，防滥用） */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > (limit || 512 * 1024)) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** 解析 JSON 请求体 */
async function readJson(req) {
  const raw = await readBody(req);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (e) { throw new Error('请求体不是合法 JSON'); }
}

/** 解析 cookie */
function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  raw.split(';').forEach(pair => {
    const i = pair.indexOf('=');
    if (i < 0) return;
    const k = pair.slice(0, i).trim();
    const v = pair.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

/** 发送 JSON */
function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

/** 发送 HTML */
function sendHtml(res, status, html, extraHeaders) {
  const headers = Object.assign({
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-cache'
  }, extraHeaders || {});
  res.writeHead(status, headers);
  res.end(html);
}

/** 发送文本 */
function sendText(res, status, text, type) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(text);
}

/** 重定向 */
function redirect(res, location, headers) {
  res.writeHead(302, Object.assign({ Location: location }, headers || {}));
  res.end();
}

/** 静态文件服务 */
/**
 * 从一个指定根目录提供文件。
 * 支持 Range 断点续传——视频拖动进度条要靠它，没有的话浏览器只能整段下载。
 */
function serveFrom(req, res, rootDir, relPath) {
  let rel = decodeURIComponent(String(relPath || '').replace(/^\/+/, ''));
  if (!rel) return false;
  const full = path.resolve(rootDir, rel);
  /* 防目录穿越：解析后必须仍在根目录里 */
  if (full !== rootDir && !full.startsWith(rootDir + path.sep)) { sendText(res, 403, 'Forbidden'); return true; }
  let stat = null;
  try { stat = fs.statSync(full); } catch (e) { return false; }
  if (stat.isDirectory()) return false;
  const ext = path.extname(full).toLowerCase();
  const etag = '"' + stat.mtimeMs.toString(36) + '-' + stat.size.toString(36) + '"';
  const base = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    ETag: etag,
    'Cache-Control': 'no-cache, must-revalidate',
    'Accept-Ranges': 'bytes'
  };
  /* 断点续传：视频拖动进度条全靠这一段 */
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
      if (isNaN(start) || start < 0) start = 0;
      if (isNaN(end) || end >= stat.size) end = stat.size - 1;
      if (start > end) { res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size }); res.end(); return true; }
      res.writeHead(206, Object.assign({}, base, {
        'Content-Range': 'bytes ' + start + '-' + end + '/' + stat.size,
        'Content-Length': end - start + 1
      }));
      if (req.method === 'HEAD') { res.end(); return true; }
      fs.createReadStream(full, { start: start, end: end }).pipe(res);
      return true;
    }
  }
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' });
    res.end();
    return true;
  }
  const headers = Object.assign({}, base, { 'Content-Length': stat.size });
  if (req.method === 'HEAD') { res.writeHead(200, headers); res.end(); return true; }
  res.writeHead(200, headers);
  fs.createReadStream(full).pipe(res);
  return true;
}

function serveStatic(req, res, urlPath) {
  return serveFrom(req, res, PUBLIC_DIR, urlPath);
}

/** 会话 id 生成 */
function newSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

/** 设置 cookie */
function setCookie(res, name, value, maxAgeSec) {
  const parts = [name + '=' + encodeURIComponent(value), 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (maxAgeSec) parts.push('Max-Age=' + maxAgeSec);
  const prev = res.getHeader('Set-Cookie');
  const list = prev ? (Array.isArray(prev) ? prev : [prev]) : [];
  list.push(parts.join('; '));
  res.setHeader('Set-Cookie', list);
}

/** HTML 转义 */
function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * 极简模板渲染
 * 支持 {{key}}（自动转义）、{{{key}}}（原样插入）、{{#if key}}...{{/if}}、{{#each list}}...{{/each}}
 */
function render(tpl, data) {
  let out = String(tpl);
  // each
  out = out.replace(/\{\{#each\s+([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (m, key, body) => {
    const list = pick(data, key);
    if (!Array.isArray(list) || !list.length) return '';
    return list.map((item, i) => render(body, Object.assign({}, data, { this: item, '@index': i + 1, '@first': i === 0, '@last': i === list.length - 1 }, typeof item === 'object' ? item : { value: item }))).join('');
  });
  // if
  out = out.replace(/\{\{#if\s+([\w.!]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, key, body) => {
    let neg = false, k = key;
    if (k.charAt(0) === '!') { neg = true; k = k.slice(1); }
    const v = pick(data, k);
    const truthy = Array.isArray(v) ? v.length > 0 : !!v;
    return (neg ? !truthy : truthy) ? render(body, data) : '';
  });
  // 原样插入
  out = out.replace(/\{\{\{([\w.@]+)\}\}\}/g, (m, key) => {
    const v = pick(data, key);
    return v === undefined || v === null ? '' : String(v);
  });
  // 自动转义
  out = out.replace(/\{\{([\w.@]+)\}\}/g, (m, key) => {
    const v = pick(data, key);
    return v === undefined || v === null ? '' : esc(v);
  });
  return out;
}

/** 从对象按路径取值（支持 a.b.c 与 @index 这类键） */
function pick(obj, keyPath) {
  if (!obj) return undefined;
  if (keyPath in obj) return obj[keyPath];
  const parts = String(keyPath).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[p];
  }
  return cur;
}

/** 读取模板文件并渲染 */
let tplCache = new Map();
function renderFile(name, data) {
  const file = path.join(PUBLIC_DIR, 'templates', name + '.html');
  let tpl = tplCache.get(file);
  if (tpl === undefined) {
    tpl = fs.readFileSync(file, 'utf8');
    if (process.env.NODE_ENV !== 'development') tplCache.set(file, tpl);
  }
  return render(tpl, data);
}

/** 静态布局：页面外壳 */
function layout(title, bodyHtml, opt) {
  opt = opt || {};
  return renderFile('layout', {
    title: title,
    body: bodyHtml,
    nav: opt.nav || '',
    active: opt.active || '',
    extraHead: opt.extraHead || '',
    extraScripts: opt.extraScripts || '',
    student: opt.student || null,
    llmActive: opt.llmActive ? 1 : 0
  });
}

module.exports = {
  PUBLIC_DIR, MIME,
  readBody, readJson, parseCookies, sendJson, sendHtml, sendText, redirect,
  serveStatic, serveFrom, newSessionId, setCookie, esc, render, renderFile, layout
};
