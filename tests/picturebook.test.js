/**
 * tests/picturebook.test.js —— AI 启蒙绘本模块的真实浏览器验证
 *
 * 用 Chrome DevTools 协议，让一个「一年级小朋友」把整本书走一遍：
 *   绘本馆 → 选书 → 阅读器（拼音/大字/台词/情绪）→ 点一点互动 → 翻页
 *   → 小问题 → 读完 → 小游戏 → 结算 → 问小AI → 回答变绘本页 → 嵌入模式
 */
'use strict';
const { spawn } = require('child_process');
const net = require('net'), crypto = require('crypto'), http = require('http'), fs = require('fs'), path = require('path');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8090';
const PORT = Number(process.env.CDP_PORT || 9955);

function wsConnect(wsUrl) {
  const u = new URL(wsUrl), key = crypto.randomBytes(16).toString('base64');
  const sock = net.connect(Number(u.port), u.hostname);
  let buffer = Buffer.alloc(0); const L = []; let hs = false;
  sock.on('data', c => {
    buffer = Buffer.concat([buffer, c]);
    if (!hs) { const i = buffer.indexOf('\r\n\r\n'); if (i < 0) return; hs = true; buffer = buffer.slice(i + 4); L.forEach(f => f.__r && f.__r()); }
    for (;;) { const m = dec(buffer); if (!m) break; buffer = buffer.slice(m.c); if (m.o === 1) L.forEach(f => f(m.p.toString('utf8'))); }
  });
  const send = t => {
    const p = Buffer.from(t, 'utf8'), mk = crypto.randomBytes(4); let h;
    if (p.length < 126) { h = Buffer.alloc(6); h[0] = 0x81; h[1] = 0x80 | p.length; mk.copy(h, 2); }
    else if (p.length < 65536) { h = Buffer.alloc(8); h[0] = 0x81; h[1] = 0x80 | 126; h.writeUInt16BE(p.length, 2); mk.copy(h, 4); }
    else { h = Buffer.alloc(14); h[0] = 0x81; h[1] = 0x80 | 127; h.writeBigUInt64BE(BigInt(p.length), 2); mk.copy(h, 10); }
    const m = Buffer.alloc(p.length); for (let i = 0; i < p.length; i++) m[i] = p[i] ^ mk[i % 4];
    sock.write(Buffer.concat([h, m]));
  };
  const ready = new Promise(r => { L.push(Object.assign(function () {}, { __r: () => r() })); sock.write('GET ' + u.pathname + ' HTTP/1.1\r\nHost: ' + u.host + '\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ' + key + '\r\nSec-WebSocket-Version: 13\r\n\r\n'); });
  return { ready, on: f => L.push(f), send, close: () => sock.destroy() };
}
function dec(b) {
  if (b.length < 2) return null;
  const b1 = b[1]; let l = b1 & 0x7f, o = 2;
  if (l === 126) { if (b.length < 4) return null; l = b.readUInt16BE(2); o = 4; }
  else if (l === 127) { if (b.length < 10) return null; l = Number(b.readBigUInt64BE(2)); o = 10; }
  const masked = (b1 & 0x80) !== 0; let mk = null;
  if (masked) { if (b.length < o + 4) return null; mk = b.slice(o, o + 4); o += 4; }
  if (b.length < o + l) return null;
  let p = b.slice(o, o + l);
  if (masked) { const out = Buffer.alloc(l); for (let i = 0; i < l; i++) out[i] = p[i] ^ mk[i % 4]; p = out; }
  return { o: b[0] & 15, p, c: o + l };
}
const hj = u => new Promise((res, rej) => http.get(u, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); }).on('error', rej));

let pass = 0, fail = 0;
const bad = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name + (detail ? '  → ' + detail : '')); }
  else { fail++; bad.push(name); console.log('  FAIL  ' + name + (detail ? '  → ' + detail : '')); }
}

(async () => {
  const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (!fs.existsSync(chrome)) { console.log('未找到 Chrome，跳过浏览器测试'); process.exit(0); }
  const shot = process.env.SHOT_DIR || '';
  const profile = path.join(__dirname, '..', '.btest', 'pb-profile');
  const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--window-size=1280,900', '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 40; i++) {
    try { const l = await hj('http://127.0.0.1:' + PORT + '/json/list'); const p = l.find(t => t.type === 'page'); if (p) { wsUrl = p.webSocketDebuggerUrl; break; } } catch (e) {}
    await new Promise(r => setTimeout(r, 250));
  }
  if (!wsUrl) { console.log('无法连接 Chrome'); process.exit(1); }
  const ws = wsConnect(wsUrl); await ws.ready;
  let id = 0; const pend = new Map(); const errors = [];
  ws.on(t => {
    const m = JSON.parse(t);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value || a.description || '').join(' '));
  });
  const call = (M, P) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: M, params: P || {} })); });
  const ev = async e => { const r = await call('Runtime.evaluate', { expression: e, returnByValue: true }); return r && r.result ? r.result.value : null; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const snap = async n => { if (!shot) return; try { const r = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(shot, n + '.png'), Buffer.from(r.data, 'base64')); } catch (e) {} };
  const clickText = async (t, sel) => ev('(function(){var b=Array.prototype.filter.call(document.querySelectorAll("' + (sel || '.pb-btn') + '"),function(x){return x.textContent.indexOf("' + t + '")>=0})[0]; if(b){b.click(); return "ok";} return "miss";})()');
  await call('Page.enable'); await call('Runtime.enable');

  /* 1) 绘本馆 */
  await call('Page.navigate', { url: BASE + '/book?grade=1' });
  await wait(3000);
  const lib = JSON.parse(await ev('JSON.stringify({cards:document.querySelectorAll(".pb-card").length, covers:document.querySelectorAll(".pb-card-cover svg").length, rec:!!document.querySelector(".pb-recommend"), stickers:document.querySelectorAll(".pb-sticker").length, badges:document.querySelectorAll(".pb-badge").length, tree:!!document.querySelector("#pb-tree svg"), ask:!!document.querySelector(".pb-ask-btn")})') || '{}');
  check('绘本馆展示 8 本绘本', lib.cards === 8, lib.cards + ' 本');
  check('每本都有代码绘制的封面', lib.covers === 8, lib.covers + ' 张封面');
  check('显示推荐条目', lib.rec, '');
  check('贴纸与徽章区渲染', lib.stickers > 0 && lib.badges > 0, '贴纸位 ' + lib.stickers + ' / 徽章位 ' + lib.badges);
  check('成长树渲染', lib.tree, '');
  check('问小AI 悬浮按钮存在', lib.ask, '');
  await snap('pb-lib');

  /* 2) 打开第一本 */
  await ev('document.querySelector(".pb-card").click()');
  await wait(2600);
  const rd = JSON.parse(await ev('JSON.stringify({hz:document.querySelectorAll(".pb-hanzi").length, py:document.querySelectorAll(".pb-pinyin").length, words:document.querySelectorAll(".pb-word").length, illus:!!document.querySelector(".pb-illus svg"), say:!!document.querySelector(".pb-say"), sayText:(document.querySelector(".pb-say-text")||{}).textContent, act:!!document.querySelector(".pb-act-card"), count:(document.querySelector(".pb-pagecount")||{}).textContent, compact:!!document.querySelector(".pb-wrap.is-reading")})') || '{}');
  check('阅读器渲染大字与拼音', rd.hz >= 1 && rd.py >= 1, rd.hz + ' 行 / ' + rd.py + ' 行拼音');
  check('汉字逐字可点', rd.words >= 4, rd.words + ' 个可点字');
  check('插图是代码绘制的 SVG', rd.illus, '');
  check('显示角色台词条', rd.say && (rd.sayText || '').length > 0, '「' + (rd.sayText || '') + '」');
  check('本页有互动卡', rd.act, '');
  check('进入阅读器后顶部自动收窄', rd.compact, '');
  await snap('pb-reader');

  /* 3) 点一点互动 */
  await ev('(function(){var z=document.querySelector(".pb-tap-zone"); if(z) z.click();})()');
  await wait(900);
  const actDone = JSON.parse(await ev('JSON.stringify({done:!!document.querySelector(".pb-act-done"), again:!!document.querySelector(".pb-act-again")})') || '{}');
  check('互动完成后给出温柔反馈', actDone.done, '');
  check('互动可以再玩一次', actDone.again, '');
  await snap('pb-act');

  /* 4) 翻页 + 小问题 + 读到练习 */
  let sawQuestion = false, sawExercise = false, sawResult = false;
  for (let i = 0; i < 20; i++) {
    const st = JSON.parse(await ev('JSON.stringify({q:!!document.querySelector(".pb-question"),ex:!!document.querySelector(".pb-exercise"),res:!!document.querySelector(".pb-result")})') || '{}');
    if (st.res) { sawResult = true; break; }
    if (st.q) {
      sawQuestion = true;
      /* 故意先选错的那个，验证「温柔反馈」 */
      await ev('(function(){var o=document.querySelectorAll(".pb-option"); for(var i=o.length-1;i>=0;i--){ o[i].click(); if(document.querySelector(".pb-fb.is-soft")) return "soft"; if(document.querySelector(".pb-fb.is-ok")) return "ok"; } return "none";})()');
      await wait(900);
      const soft = await ev('!!document.querySelector(".pb-fb.is-soft")');
      const ok = await ev('!!document.querySelector(".pb-fb.is-ok")');
      check('小问题给出即时反馈（答错也是温柔提示）', !!(soft || ok), soft ? '温柔提示' : '答对庆祝');
      /* 若答错，继续把正确的那一个也试一遍 */
      if (!ok) {
        await ev('(function(){var o=document.querySelectorAll(".pb-option"); for(var i=0;i<o.length;i++){ if(!o[i].disabled) o[i].click(); }})()');
        await wait(900);
      }
      await clickText('继续读下去');
      await wait(900);
      continue;
    }
    if (st.ex) {
      sawExercise = true;
      const k = JSON.parse(await ev('JSON.stringify({opts:document.querySelectorAll(".pb-ex-item").length,chips:document.querySelectorAll(".pb-chip").length,order:document.querySelectorAll(".pb-order-item").length,ta:!!document.querySelector(".pb-open textarea, .pb-act-actions input")})') || '{}');
      if (k.opts > 0) {
        await ev('Array.prototype.forEach.call(document.querySelectorAll(".pb-ex-item"), function(x){ x.click(); })');
        await wait(300); await clickText('选好了');
      } else if (k.chips > 0) {
        for (let n = 0; n < 4; n++) {
          await ev('(function(){var L=document.querySelectorAll(".pb-chip"); if(L[' + n + ']) L[' + n + '].click();})()');
          await wait(150);
          await ev('(function(){var R=Array.prototype.filter.call(document.querySelectorAll(".pb-chip"),function(x){return !x.classList.contains("is-linked")}); if(R[0]) R[0].click();})()');
          await wait(150);
        }
        await clickText('连好了');
      } else if (k.order > 0) {
        await clickText('排好了');
      } else {
        await clickText('先跳过');
      }
      await wait(1000);
      await clickText('下一个游戏'); await clickText('看看我的星星');
      await wait(1000);
      continue;
    }
    const r = await clickText('下一页'); if (r === 'miss') { const r2 = await clickText('读完了'); if (r2 === 'miss') break; }
    await wait(850);
  }
  check('阅读中出现小问题', sawQuestion);
  check('读完后进入小游戏', sawExercise);
  check('做完游戏进入结算页', sawResult);
  if (sawResult) {
    const rs = JSON.parse(await ev('JSON.stringify({stars:document.querySelectorAll(".pb-stars-row i").length,score:Array.prototype.map.call(document.querySelectorAll(".pb-score"),function(x){return x.textContent}).join(" | "),tree:!!document.querySelector("#pb-result-tree svg"),actions:document.querySelectorAll(".pb-result-actions .pb-btn").length})') || '{}');
    check('结算页显示星星', rs.stars === 3, rs.stars + ' 颗星位');
    check('结算页显示成绩', /答对|获得/.test(rs.score || ''), (rs.score || '').slice(0, 40));
    check('结算页显示成长树', rs.tree, '');
    check('结算页有后续按钮', rs.actions >= 2, rs.actions + ' 个');
    await snap('pb-result');
  }

  /* 5) 问小AI：回答可以变成一页绘本 */
  await ev('(function(){var b=document.querySelector(".pb-ask-btn"); if(b) b.click();})()');
  await wait(600);
  const a1 = JSON.parse(await ev('JSON.stringify({panel:!!document.querySelector(".pb-ask-panel:not([hidden])"),sug:document.querySelectorAll(".pb-ask-sug button").length})') || '{}');
  check('问小AI 面板可以打开', a1.panel, '');
  check('给出建议问题', a1.sug >= 1, a1.sug + ' 个');
  await ev('(function(){var t=document.querySelector(".pb-ask-input textarea"); t.value="小AI 是什么"; document.querySelector(".pb-ask-input .pb-btn").click();})()');
  await wait(1700);
  const a2 = JSON.parse(await ev('JSON.stringify({msgs:document.querySelectorAll(".pb-ask-msg").length,pageBtn:!!Array.prototype.filter.call(document.querySelectorAll(".pb-btn"),function(x){return x.textContent.indexOf("变成一页绘本")>=0}).length})') || '{}');
  check('问小AI 有问答气泡', a2.msgs >= 2, a2.msgs + ' 条');
  check('回答可转成一页绘本', a2.pageBtn, '');
  if (a2.pageBtn) {
    await ev('Array.prototype.filter.call(document.querySelectorAll(".pb-btn"),function(x){return x.textContent.indexOf("变成一页绘本")>=0})[0].click()');
    await wait(1000);
    const pg = JSON.parse(await ev('JSON.stringify({illus:!!document.querySelector(".pb-illus svg"),lines:document.querySelectorAll(".pb-hanzi").length})') || '{}');
    check('生成的绘本页有插图与文字', pg.illus && pg.lines >= 1, '插图=' + pg.illus + ' 行数=' + pg.lines);
    await snap('pb-answer');
  }

  /* 6) 嵌入模式 */
  await call('Page.navigate', { url: BASE + '/book/read?id=ear&embed=1&grade=2' });
  await wait(2600);
  const em = JSON.parse(await ev('JSON.stringify({nav:!!document.querySelector(".site-nav"),footer:!!document.querySelector("footer"),reader:!!document.querySelector(".pb-stage"),hz:document.querySelectorAll(".pb-hanzi").length,cls:document.body.className})') || '{}');
  check('嵌入模式没有站点导航与页脚', !em.nav && !em.footer, '');
  check('嵌入模式阅读器可用', em.reader && em.hz >= 1, '行数=' + em.hz);
  check('嵌入模式带有标记 class', /pb-embed-body/.test(em.cls || ''), em.cls);

  /* 7) 年级切换改变页数 */
  await call('Page.navigate', { url: BASE + '/book?grade=1' });
  await wait(2600);
  await ev('(function(){var s=document.getElementById("pb-grade"); s.value="3"; s.dispatchEvent(new Event("change"));})()');
  await wait(2200);
  const g3 = JSON.parse(await ev('JSON.stringify({cards:document.querySelectorAll(".pb-card").length,grade:(document.getElementById("pb-grade")||{}).value})') || '{}');
  check('切换年级后绘本馆重新生成', g3.grade === '3' && g3.cards === 8, '年级 ' + g3.grade + ' / ' + g3.cards + ' 本');

  ws.close(); try { proc.kill(); } catch (e) {}

  console.log('');
  if (errors.length) {
    console.log('页面 JS 异常（' + errors.length + '）：');
    errors.slice(0, 8).forEach(e => console.log('  - ' + String(e).split('\n')[0].slice(0, 150)));
    fail += errors.length;
  } else console.log('页面控制台无 JS 异常');
  console.log('');
  console.log(fail === 0 ? ('绘本阅读器浏览器端全部通过（' + pass + ' 项）') : (fail + ' 项失败 / 共 ' + (pass + fail) + ' 项：' + bad.join('、')));
  process.exit(fail === 0 ? 0 : 1);
})();
