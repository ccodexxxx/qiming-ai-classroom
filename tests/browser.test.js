/**
 * browser.test.js —— 用 Chrome DevTools 协议在真实页面里执行断言
 * 不依赖任何 npm 包：手写最小的 WebSocket 客户端（RFC6455）与 CDP 调用。
 * 用法：先启动服务（node server/server.js），再 node tests/browser.test.js
 */
'use strict';

const { spawn } = require('child_process');
const net = require('net');
const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8090';
const DEBUG_PORT = Number(process.env.CDP_PORT || 9222);
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);

function findChrome() {
  for (const p of CHROME_CANDIDATES) if (p && fs.existsSync(p)) return p;
  return null;
}

/* ---------------- 最小 WebSocket 客户端 ---------------- */
function wsConnect(wsUrl) {
  const u = new URL(wsUrl);
  const key = crypto.randomBytes(16).toString('base64');
  const sock = net.connect(Number(u.port), u.hostname);
  let buffer = Buffer.alloc(0);
  const listeners = [];
  let handshaken = false;

  sock.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    if (!handshaken) {
      const idx = buffer.indexOf('\r\n\r\n');
      if (idx < 0) return;
      handshaken = true;
      buffer = buffer.slice(idx + 4);
      listeners.forEach(fn => fn.__ready && fn.__ready());
    }
    for (;;) {
      const msg = decodeFrame(buffer);
      if (!msg) break;
      buffer = buffer.slice(msg.consumed);
      if (msg.opcode === 0x1) {
        const text = msg.payload.toString('utf8');
        listeners.forEach(fn => fn(text));
      } else if (msg.opcode === 0x8) {
        sock.end();
      }
    }
  });

  function send(text) {
    const payload = Buffer.from(text, 'utf8');
    const mask = crypto.randomBytes(4);
    let header;
    if (payload.length < 126) {
      header = Buffer.alloc(6);
      header[0] = 0x81;
      header[1] = 0x80 | payload.length;
      mask.copy(header, 2);
    } else if (payload.length < 65536) {
      header = Buffer.alloc(8);
      header[0] = 0x81;
      header[1] = 0x80 | 126;
      header.writeUInt16BE(payload.length, 2);
      mask.copy(header, 4);
    } else {
      header = Buffer.alloc(14);
      header[0] = 0x81;
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(payload.length), 2);
      mask.copy(header, 10);
    }
    const masked = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
    sock.write(Buffer.concat([header, masked]));
  }

  const ready = new Promise(resolve => {
    listeners.push(Object.assign(function () {}, { __ready: () => resolve() }));
    sock.write(
      'GET ' + u.pathname + (u.search || '') + ' HTTP/1.1\r\n' +
      'Host: ' + u.host + '\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      'Sec-WebSocket-Key: ' + key + '\r\n' +
      'Sec-WebSocket-Version: 13\r\n\r\n'
    );
  });

  return {
    ready,
    onMessage(fn) { listeners.push(fn); },
    send,
    close() { try { sock.destroy(); } catch (e) {} }
  };
}

function decodeFrame(buf) {
  if (buf.length < 2) return null;
  const b0 = buf[0], b1 = buf[1];
  const opcode = b0 & 0x0f;
  let len = b1 & 0x7f;
  let offset = 2;
  if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); offset = 4; }
  else if (len === 127) { if (buf.length < 10) return null; len = Number(buf.readBigUInt64BE(2)); offset = 10; }
  const masked = (b1 & 0x80) !== 0;
  let maskKey = null;
  if (masked) { if (buf.length < offset + 4) return null; maskKey = buf.slice(offset, offset + 4); offset += 4; }
  if (buf.length < offset + len) return null;
  let payload = buf.slice(offset, offset + len);
  if (masked) {
    const out = Buffer.alloc(len);
    for (let i = 0; i < len; i++) out[i] = payload[i] ^ maskKey[i % 4];
    payload = out;
  }
  return { opcode, payload, consumed: offset + len };
}

/* ---------------- CDP 调用封装 ---------------- */
function cdpClient(ws) {
  let id = 0;
  const pending = new Map();
  ws.onMessage(text => {
    let msg;
    try { msg = JSON.parse(text); } catch (e) { return; }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
  return function call(method, params) {
    const myId = ++id;
    return new Promise((resolve, reject) => {
      pending.set(myId, { resolve, reject });
      ws.send(JSON.stringify({ id: myId, method, params: params || {} }));
      setTimeout(() => {
        if (pending.has(myId)) { pending.delete(myId); reject(new Error('CDP 调用超时：' + method)); }
      }, 20000);
    });
  };
}

function httpJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

/* ---------------- 页面断言脚本 ---------------- */
function pageProbe(checks) {
  return '(' + function (checks) {
    var text = document.body ? document.body.textContent : '';
    var html = document.documentElement.outerHTML;
    var out = { hits: {}, miss: [], nodes: document.getElementsByTagName('*').length, textLength: text.length, scripts: document.scripts.length };
    checks.forEach(function (c) {
      var hit = text.indexOf(c) >= 0 || html.indexOf(c) >= 0;
      out.hits[c] = hit;
      if (!hit) out.miss.push(c);
    });
    out.hasError = text.indexOf('页面不存在') >= 0;
    out.title = document.title;
    return JSON.stringify(out);
  }.toString() + ')(' + JSON.stringify(checks) + ')';
}

const SPECS = [
  ['首页', '/', ['同一个知识点', '五种形态', '课程地图', '为你推荐']],
  ['AI 课堂', '/chat', ['启明老师', 'chat-input', '这节课可以这样问']],
  ['课程地图', '/courses', ['课程地图', '人工智能入门', '个知识点']],
  ['知识点详情', '/topic/vision-image', ['机器怎么看图', '学习内容', '随堂练习', '术语卡', '四个学段']],
  ['AI 动画', '/ai-cartoon', ['AI 动画片', '故事', '镜头']],
  ['编程实践', '/code', ['编程实践', '小AI走迷宫', 'Python', 'AI 实践任务']],
  ['练习中心', '/games', ['练习中心', '知识闯关', '数据标注师', '神经网络训练', '术语配对']],
  ['学情看板', '/dashboard', ['学情看板', '徽章墙', '学习记录', '给老师与家长的建议']],
  ['关于', '/about', ['关于', '为什么按年级分开讲', '技术形态']]
];

(async function main() {
  const chrome = findChrome();
  if (!chrome) { console.log('未找到 Chrome / Edge，跳过浏览器测试'); process.exit(0); }

  // 服务可用性
  try { await httpJson(BASE + '/api/health'); }
  catch (e) { console.log('服务未启动（' + BASE + '），请先运行 node server/server.js'); process.exit(1); }

  const profile = path.join(__dirname, '..', '.btest', 'profile');
  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + DEBUG_PORT, '--user-data-dir=' + profile, 'about:blank'
  ], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 40; i++) {
    try {
      const list = await httpJson('http://127.0.0.1:' + DEBUG_PORT + '/json/list');
      const page = list.find(t => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) { wsUrl = page.webSocketDebuggerUrl; break; }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 250));
  }
  if (!wsUrl) { console.log('无法连接 Chrome 调试端口'); try { proc.kill(); } catch (e) {} process.exit(1); }

  const ws = wsConnect(wsUrl);
  await ws.ready;
  const call = cdpClient(ws);
  await call('Page.enable');
  await call('Runtime.enable');

  /* 用一个“种子”请求建立会话并设置画像为 8 年级 */
  const seedCookie = await (async () => {
    const res = await fetch(BASE + '/api/student', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '验证同学', grade: 8, avatar: '🦊' })
    });
    const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const raw = setCookie.length ? setCookie[0] : (res.headers.get('set-cookie') || '');
    const m = raw.match(/aiq_sid=([^;]+)/);
    return m ? m[1] : null;
  })();
  if (seedCookie) {
    await call('Network.enable');
    await call('Network.setCookie', { name: 'aiq_sid', value: seedCookie, domain: '127.0.0.1', path: '/' });
  }

  /* 收集页面控制台错误 */
  const consoleErrors = [];
  ws.onMessage(text => {
    let msg; try { msg = JSON.parse(text); } catch (e) { return; }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      consoleErrors.push((d.exception && d.exception.description) || d.text);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map(a => a.value || a.description || '').join(' '));
    }
  });

  const results = [];
  let failures = 0;
  for (const [name, url, checks] of SPECS) {
    await call('Page.navigate', { url: BASE + url });
    await new Promise(r => setTimeout(r, 1400));   // 等待服务端渲染 + 客户端脚本执行
    let probe;
    try {
      const r = await call('Runtime.evaluate', { expression: pageProbe(checks), returnByValue: true });
      probe = JSON.parse(r.result.value);
    } catch (e) {
      probe = { miss: checks, error: e.message, nodes: 0, textLength: 0 };
    }
    const ok = (!probe.miss || probe.miss.length === 0) && !probe.hasError;
    if (!ok) failures++;
    results.push((ok ? '  PASS ' : '  FAIL ') + name.padEnd(8) +
      ' 文本=' + String(probe.textLength).padEnd(6) +
      ' 节点=' + String(probe.nodes).padEnd(5) +
      (probe.miss && probe.miss.length ? ' 缺失=[' + probe.miss.join(',') + ']' : ''));
  }

  /* 额外：验证客户端脚本真的执行了（DOM 被改写） */
  await call('Page.navigate', { url: BASE + '/chat' });
  await new Promise(r => setTimeout(r, 2200));
  const chatProbe = await call('Runtime.evaluate', {
    expression: 'JSON.stringify({bubbles: document.querySelectorAll(".msg").length, hasTyping: !!document.querySelector(".typing"), log: (document.getElementById("chat-log")||{}).children ? document.getElementById("chat-log").children.length : -1})',
    returnByValue: true
  });
  const chatInfo = JSON.parse(chatProbe.result.value);

  await call('Page.navigate', { url: BASE + '/code' });
  await new Promise(r => setTimeout(r, 2000));
  const labProbe = await call('Runtime.evaluate', {
    expression: 'JSON.stringify({svg: document.querySelectorAll("#code-stage svg").length, blocks: document.querySelectorAll(".blk").length, hasEditorOrMaze: !!document.querySelector(".maze-figure")})',
    returnByValue: true
  });
  const labInfo = JSON.parse(labProbe.result.value);

  await call('Page.navigate', { url: BASE + '/video/export' });
  await new Promise(r => setTimeout(r, 2200));
  const videoProbe = await call('Runtime.evaluate', {
    expression: 'JSON.stringify({books: document.querySelectorAll(".video-book").length, opts: document.querySelectorAll(".video-check").length, stage: !!document.querySelector("#video-stage"), go: !!document.querySelector("#video-go")})',
    returnByValue: true
  });
  const videoInfo = JSON.parse(videoProbe.result.value);

  if (chatInfo.bubbles < 1) { failures++; results.push('  FAIL 客户端 chat.js 未渲染消息（bubbles=' + chatInfo.bubbles + '）'); }
  else results.push('  PASS 客户端 chat.js 已渲染对话（' + chatInfo.bubbles + ' 条消息气泡）');
  if (labInfo.svg < 1 && labInfo.blocks < 1) { failures++; results.push('  FAIL 客户端 lab.js 未渲染迷宫（svg=' + labInfo.svg + ', blocks=' + labInfo.blocks + '）'); }
  else results.push('  PASS 客户端 lab.js 已渲染迷宫（积木 ' + labInfo.blocks + ' 块 / SVG ' + labInfo.svg + ' 个）');
  if (videoInfo.books < 1) { failures++; results.push('  FAIL 客户端 video.js 未渲染（books=' + videoInfo.books + '）'); }
  else results.push('  PASS 客户端 video.js 已渲染（故事 ' + videoInfo.books + ' 本 / 设置项 ' + videoInfo.opts + ' 个 / 播放区 ' + videoInfo.stage + '）');

  ws.close();
  try { proc.kill(); } catch (e) {}

  console.log(results.join('\n'));
  console.log('');
  if (consoleErrors.length) {
    console.log('页面 JS 异常（' + consoleErrors.length + '）：');
    consoleErrors.slice(0, 8).forEach(e => console.log('  - ' + String(e).split('\n')[0].slice(0, 140)));
    failures += consoleErrors.length;
  } else {
    console.log('页面控制台无 JS 异常');
  }
  console.log('');
  console.log(failures === 0 ? ('浏览器端全部通过（' + results.length + ' 项）') : (failures + ' 项存在问题'));
  process.exit(failures === 0 ? 0 : 1);
})();
