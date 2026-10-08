/*!
 * 启明 AI 课堂 · 练习中心（客户端）
 * public/js/games.js —— 四个小游戏：知识闯关 / 数据标注师 / 神经网络训练 / 术语配对
 *
 * 经典脚本（非 ES module）、IIFE、零依赖；优先使用 window.AIQ 的公共工具，
 * AIQ 缺失时自带降级实现，单独打开该脚本也不会抛错。
 * 知识闯关复用 public/js/quiz.js 暴露的 window.AIQQuiz。
 *
 * 服务端接口：
 *   GET  /api/session                          会话与学段
 *   GET  /api/quiz?count=&domain=&mode=         抽题
 *   POST /api/answer                           判题 + 错题入库 + 徽章
 *   POST /api/event                            学习行为与最高分（game=quiz|label|net|match）
 *   POST /api/wrong/fix                        订正错题
 *   GET  /api/games/data?kind=label|net|match  游戏素材
 */
(function () {
  'use strict';

  var W = window;
  var NL = String.fromCharCode(10);

  /* ================================================================== *
   * 1. 工具层（AIQ 优先，缺失时降级）
   * ================================================================== */

  function aiq() { return W.AIQ || null; }

  function qs(sel, root) {
    var a = aiq();
    if (a && typeof a.qs === 'function') return a.qs(sel, root);
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    var a = aiq();
    if (a && typeof a.qsa === 'function') return a.qsa(sel, root);
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function on(node, type, fn) {
    if (!node) return null;
    var a = aiq();
    if (a && typeof a.on === 'function') return a.on(node, type, fn);
    node.addEventListener(type, fn);
    return fn;
  }

  function append(node, children) {
    if (children === null || children === undefined) return node;
    if (!Array.isArray(children)) children = [children];
    children.forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return node;
  }

  function el(tag, attrs, children) {
    var a = aiq();
    if (a && typeof a.el === 'function') return a.el(tag, attrs, children);
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class' || k === 'className') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    return append(node, children);
  }

  function clear(node) {
    if (!node) return node;
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function fix(v, n) { return Number(v).toFixed(n); }

  function api(path, opt) {
    var a = aiq();
    if (a && typeof a.api === 'function') return a.api(path, opt);
    opt = opt || {};
    var init = { method: opt.method || 'GET', headers: { 'Content-Type': 'application/json' } };
    if (opt.body !== undefined && opt.body !== null) init.body = JSON.stringify(opt.body);
    return fetch(path, init).then(function (res) {
      return res.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
        if (!res.ok) {
          var err = new Error((data && (data.error || data.message)) || ('请求失败：' + res.status));
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function toast(opt) {
    if (typeof opt === 'string') opt = { text: opt };
    var a = aiq();
    if (a && typeof a.toast === 'function') { a.toast(opt); return; }
    var box = document.getElementById('gm-toasts');
    if (!box) { box = el('div', { class: 'gm-toasts', id: 'gm-toasts' }); document.body.appendChild(box); }
    var t = el('div', { class: 'gm-toast gm-toast-' + (opt.type || 'info') }, [
      opt.title ? el('b', { text: opt.title }) : null,
      el('span', { text: opt.text || '' })
    ]);
    box.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3400);
  }

  function confirmDialog(msg, onOk) {
    var a = aiq();
    if (a && typeof a.modal === 'function') {
      var m = a.modal({
        title: '请确认', size: 'sm',
        body: el('p', { text: msg }),
        footer: [
          el('button', { class: 'btn btn-ghost', type: 'button', text: '继续游戏', onclick: function () { m.close(); } }),
          el('button', { class: 'btn btn-primary', type: 'button', text: '退出本局', onclick: function () { m.close(); if (onOk) onOk(); } })
        ]
      });
      return;
    }
    if (typeof W.confirm === 'function') { if (W.confirm(msg)) { if (onOk) onOk(); } return; }
    if (onOk) onOk();
  }

  function checkBadges(badges) {
    if (!badges || !badges.length) return;
    if (S.badgeSeen === null) { S.badgeSeen = badges.length; return; }
    if (badges.length > S.badgeSeen) {
      var b = badges[badges.length - 1] || {};
      toast({ type: 'ok', title: '获得新徽章 🏅', text: (b.icon ? b.icon + ' ' : '') + (b.name || '继续保持') });
      S.badgeSeen = badges.length;
    }
  }

  /* ================================================================== *
   * 2. 组件样式（只注入一个 <style id="games-style">，全部 .gm- 前缀）
   * ================================================================== */
  var CSS = [
    '.gm-wrap{display:flex;flex-direction:column;gap:14px;margin-top:14px}',
    '.gm-dim{opacity:.45;pointer-events:none}',
    '.gm-hero{display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:linear-gradient(120deg,#eef7f2,#fbf6ea);border:1px solid rgba(31,111,92,.18);border-radius:16px;padding:16px}',
    '.gm-hero .gm-emoji{font-size:40px;line-height:1}',
    '.gm-hero h3{margin:0 0 4px}',
    '.gm-hero p{margin:0;color:#5b6b64;font-size:14px}',
    '.gm-hero-main{flex:1 1 220px;min-width:180px}',
    '.gm-best{margin-left:auto;text-align:right}',
    '.gm-best small{display:block;color:#7b8a84;font-size:12px}',
    '.gm-best b{font-size:22px;color:#1f6f5c}',
    '.gm-rules{margin:8px 0 0;padding-left:1.3em;color:#4b5a54;font-size:14px;line-height:1.9}',
    '.gm-hud{display:flex;flex-direction:column;gap:10px;background:#f6faf8;border:1px solid rgba(31,111,92,.16);border-radius:14px;padding:12px}',
    '.gm-hud-top{display:flex;flex-wrap:wrap;gap:8px}',
    '.gm-hud .chip b{color:#1f6f5c;font-variant-numeric:tabular-nums}',
    '.gm-barline{display:flex;align-items:center;gap:9px}',
    '.gm-barline>span{font-size:12px;color:#6b7a74;min-width:34px}',
    '.gm-bar{flex:1;height:8px;border-radius:99px;background:rgba(31,111,92,.13);overflow:hidden}',
    '.gm-bar>i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#2f8f6b,#6cc39a);transition:width .25s linear}',
    '.gm-timer>i{background:linear-gradient(90deg,#e8a33d,#d2694a)}',
    '.gm-q{margin:4px 0 12px;font-size:17px;line-height:1.7;color:#22312c}',
    '.gm-opts{display:flex;flex-direction:column;gap:9px}',
    '.gm-opt{display:flex;align-items:center;gap:11px;width:100%;text-align:left;padding:12px 14px;border-radius:13px;border:1px solid rgba(31,111,92,.22);background:#fff;color:#22312c;font:inherit;font-size:15px;cursor:pointer;transition:.16s}',
    '.gm-opt:hover{background:#f3faf6;transform:translateX(3px);border-color:#2f8f6b}',
    '.gm-opt .k{flex:0 0 auto;width:26px;height:26px;border-radius:8px;background:#eef4f1;display:grid;place-items:center;font-weight:700;font-size:13px;color:#2f6f5b}',
    '.gm-opt.ok{background:#e9f8f0;border-color:#2f8f6b}',
    '.gm-opt.no{background:#fdeeee;border-color:#d2694a}',
    '.gm-opt[disabled]{cursor:default;transform:none}',
    '.gm-fb{margin-top:12px;border-radius:13px;padding:12px 14px;font-size:14px;line-height:1.75;border:1px solid rgba(31,111,92,.2);background:#f7fbf9}',
    '.gm-fb.ok{background:#e9f8f0;border-color:#2f8f6b}',
    '.gm-fb.no{background:#fdf0ee;border-color:#d2694a}',
    '.gm-fb b{display:block;margin-bottom:4px}',
    '.gm-stars{display:flex;gap:6px;justify-content:center;font-size:32px;line-height:1;color:#d8ded9;letter-spacing:2px;margin:6px 0}',
    '.gm-stars i{font-style:normal}',
    '.gm-stars i.on{color:#e8a33d}',
    '.gm-score{text-align:center;font-size:44px;font-weight:800;color:#1f6f5c;line-height:1.15}',
    '.gm-score small{font-size:14px;color:#6b7a74;font-weight:600;margin-left:6px}',
    '.gm-list{display:flex;flex-direction:column;gap:9px}',
    '.gm-item{border:1px solid rgba(31,111,92,.16);border-radius:12px;padding:11px 13px;background:#fff}',
    '.gm-item b{display:block;margin-bottom:3px;color:#22312c}',
    '.gm-item small{display:block;color:#6b7a74;font-size:12.5px;line-height:1.7}',
    '.gm-pool{display:flex;flex-wrap:wrap;gap:9px;min-height:66px;padding:12px;border-radius:14px;border:1px dashed rgba(31,111,92,.3);background:#fafcfb}',
    '.gm-sample{display:flex;align-items:center;gap:8px;padding:8px 11px;border-radius:12px;border:1px solid rgba(31,111,92,.22);background:#fff;cursor:pointer;font:inherit;color:#22312c;text-align:left;max-width:100%;transition:.16s}',
    '.gm-sample:hover{transform:translateY(-2px);border-color:#2f8f6b}',
    '.gm-sample.on{border-color:#2f8f6b;box-shadow:0 0 0 2px rgba(47,143,107,.28) inset}',
    '.gm-sample.ok{border-color:#2f8f6b;background:#eef9f3}',
    '.gm-sample.no{border-color:#d2694a;background:#fdf1ef}',
    '.gm-sample .gm-emoji{font-size:22px;line-height:1}',
    '.gm-sample small{display:block;color:#78877f;font-size:11.5px;line-height:1.5}',
    '.gm-bins{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
    '.gm-bin{border-radius:14px;border:2px dashed rgba(31,111,92,.32);padding:12px;min-height:120px;background:#fbfdfc;transition:.18s;cursor:pointer}',
    '.gm-bin.a{border-color:rgba(47,143,107,.5)}',
    '.gm-bin.b{border-color:rgba(210,105,74,.45)}',
    '.gm-bin.over{background:#eef7f2;border-color:#2f8f6b}',
    '.gm-bin h4{margin:0 0 4px;display:flex;align-items:center;gap:7px;font-size:15px}',
    '.gm-bin p{margin:0;font-size:12.5px;color:#78877f}',
    '.gm-bin-items{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px;min-height:30px}',
    '.gm-two{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}',
    '.gm-svg{border:1px solid rgba(31,111,92,.16);border-radius:14px;background:#fbfdfc;padding:6px}',
    '.gm-svg svg{display:block;width:100%;height:auto}',
    '.gm-slider{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}',
    '.gm-slider .top{display:flex;justify-content:space-between;font-size:13px;color:#4b5a54}',
    '.gm-slider .top b{color:#1f6f5c;font-variant-numeric:tabular-nums}',
    '.gm-slider input[type=range]{width:100%;accent-color:#2f8f6b}',
    '.gm-table{width:100%;border-collapse:collapse;font-size:13px}',
    '.gm-table th,.gm-table td{padding:6px 8px;border-bottom:1px solid rgba(31,111,92,.14);text-align:left}',
    '.gm-table th{color:#6b7a74;font-weight:600}',
    '.gm-tag{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:700}',
    '.gm-tag.ok{background:#e9f8f0;color:#1f6f5c}',
    '.gm-tag.no{background:#fdeeee;color:#b3492e}',
    '.gm-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:10px}',
    '.gm-flip{position:relative;aspect-ratio:3/4;perspective:800px;cursor:pointer;background:none;border:0;padding:0;transition:.18s}',
    '.gm-flip .inner{position:absolute;top:0;left:0;right:0;bottom:0;transform-style:preserve-3d;transition:transform .45s cubic-bezier(.2,.8,.2,1)}',
    '.gm-flip.open .inner,.gm-flip.done .inner{transform:rotateY(180deg)}',
    '.gm-flip .face{position:absolute;top:0;left:0;right:0;bottom:0;display:grid;place-items:center;padding:8px;border-radius:13px;backface-visibility:hidden;-webkit-backface-visibility:hidden;border:1px solid rgba(31,111,92,.2);font-size:13px;line-height:1.5;text-align:center;overflow:hidden}',
    '.gm-flip .front{background:linear-gradient(150deg,#dff0e8,#f6f1e3);font-size:26px;color:#2f6f5b}',
    '.gm-flip .back{transform:rotateY(180deg);background:#fff;color:#22312c;font-weight:600}',
    '.gm-flip.done .back{background:#eef9f3;border-color:#2f8f6b}',
    '.gm-flip:hover{transform:translateY(-2px)}',
    '.gm-banner{border-radius:13px;padding:12px 14px;background:#e9f8f0;border:1px solid #2f8f6b;color:#1c4f41;font-weight:600}',
    '.gm-note{font-size:12.5px;color:#78877f;line-height:1.8}',
    '.gm-steps{display:flex;flex-direction:column;gap:7px;margin-top:10px}',
    '.gm-step{font-size:13.5px;color:#9aa8a2}',
    '.gm-step.on{color:#22312c;font-weight:600}',
    '.gm-step.done{color:#2f8f6b}',
    '.gm-legend{display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:#6b7a74;margin-top:8px}',
    '.gm-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:-1px}',
    '.gm-fixed{opacity:.5}',
    '.gm-toasts{position:fixed;right:16px;bottom:16px;z-index:9999;display:flex;flex-direction:column;gap:8px}',
    '.gm-toast{background:#fff;border:1px solid rgba(31,111,92,.24);border-left:4px solid #2f8f6b;border-radius:12px;padding:10px 13px;box-shadow:0 8px 24px rgba(20,40,35,.14);font-size:13px;color:#3c4a45;max-width:320px}',
    '.gm-toast b{display:block;color:#1f6f5c}',
    '.gm-toast-err{border-left-color:#d2694a}',
    '.gm-toast-warn{border-left-color:#e8a33d}',
    '@media(max-width:720px){.gm-two{grid-template-columns:1fr}.gm-bins{grid-template-columns:1fr}.gm-score{font-size:36px}.gm-hero{padding:13px}}'
  ].join(NL);

  /* 与 quiz.js 共用同一个 <style id="games-style">：各自追加规则，先到先得、互不覆盖 */
  var STYLE_MARK = 'aq-games';
  function injectStyle() {
    var node = document.getElementById('games-style');
    if (!node) {
      node = document.createElement('style');
      node.id = 'games-style';
      node.textContent = '';
      (document.head || document.documentElement).appendChild(node);
    }
    if (node.textContent.indexOf(STYLE_MARK) >= 0) return;
    node.textContent = node.textContent + (node.textContent ? NL : '') + '/* ' + STYLE_MARK + ' */' + NL + CSS;
  }

  /* ================================================================== *
   * 3. 运行状态
   * ================================================================== */
  var S = { level: null, domain: 'all', game: null, cleanup: null, badgeSeen: null };

  function level() {
    if (S.level) return S.level;
    var a = aiq();
    if (a) {
      if (a.level) { S.level = a.level; return S.level; }
      if (a.state && a.state.level) { S.level = a.state.level; return S.level; }  /* app.js 也把学段放在 AIQ.state 里 */
    }
    return null;
  }

  function levelDepth() { var lv = level(); return lv && lv.depth ? lv.depth : 2; }

  function levelName() {
    var lv = level();
    return lv ? (lv.short || lv.name || '当前学段') : '当前学段';
  }

  /* 闯关倒计时：低年级不限时；初中 40 秒；高中 45 秒 */
  function timerSeconds() {
    var d = levelDepth();
    if (d <= 2) return 0;
    return d === 3 ? 40 : 45;
  }

  function ensureLevel() {
    if (level()) return Promise.resolve(level());
    return api('/api/session').then(function (res) {
      if (res && res.level) S.level = res.level;
      return S.level;
    }).catch(function () { return null; });
  }

  function Ticker() {
    var ivs = [], tos = [];
    return {
      every: function (ms, fn) { var id = setInterval(fn, ms); ivs.push(id); return id; },
      after: function (ms, fn) { var id = setTimeout(fn, ms); tos.push(id); return id; },
      stop: function (id) {
        clearInterval(id); clearTimeout(id);
        var i = ivs.indexOf(id); if (i >= 0) ivs.splice(i, 1);
        var j = tos.indexOf(id); if (j >= 0) tos.splice(j, 1);
      },
      clear: function () {
        ivs.forEach(function (id) { clearInterval(id); });
        tos.forEach(function (id) { clearTimeout(id); });
        ivs = []; tos = [];
      },
      count: function () { return ivs.length + tos.length; }
    };
  }

  /* ================================================================== *
   * 4. 共用视图
   * ================================================================== */

  function starRow(n) {
    var box = el('div', { class: 'gm-stars', 'aria-label': '获得 ' + n + ' 颗星' });
    for (var i = 1; i <= 3; i++) box.appendChild(el('i', { class: i <= n ? 'on' : '', text: i <= n ? '★' : '☆' }));
    return box;
  }

  function starsOf(score) { return score >= 90 ? 3 : score >= 70 ? 2 : score >= 40 ? 1 : 0; }

  function kpiGrid(items) {
    var box = el('div', { class: 'kpi-grid' });
    (items || []).forEach(function (k) {
      box.appendChild(el('div', { class: 'kpi' }, [
        el('b', { text: String(k.v) }),
        el('small', { text: k.label })
      ]));
    });
    return box;
  }

  function bestOf(id) {
    var card = qs('.game-card[data-game="' + id + '"]');
    if (!card) return 0;
    var chips = qsa('.chip-tiny', card);
    for (var i = 0; i < chips.length; i++) {
      var m = String(chips[i].textContent).match(/[0-9]+/);
      if (m) return Number(m[0]);
    }
    return 0;
  }

  function updateBest(id, score) {
    var card = qs('.game-card[data-game="' + id + '"]');
    if (!card) return;
    var chips = qsa('.chip-tiny', card);
    for (var i = 0; i < chips.length; i++) {
      var txt = String(chips[i].textContent);
      var m = txt.match(/[0-9]+/);
      if (m && Number(m[0]) < score) chips[i].textContent = txt.replace(/[0-9]+/, String(score));
    }
  }

  function introPanel(opt) {
    var rules = el('ol', { class: 'gm-rules' });
    (opt.rules || []).forEach(function (r) { rules.appendChild(el('li', { text: r })); });
    return el('div', { class: 'gm-wrap' }, [
      el('div', { class: 'gm-hero' }, [
        el('span', { class: 'gm-emoji', text: opt.emoji || '🎮' }),
        el('div', { class: 'gm-hero-main' }, [
          el('h3', { text: opt.title }),
          el('p', { text: opt.sub || '' })
        ]),
        opt.best ? el('div', { class: 'gm-best' }, [el('small', { text: '最高分' }), el('b', { text: String(opt.best) })]) : null
      ]),
      el('div', { class: 'panel' }, [
        el('div', { class: 'panel-head' }, [
          el('h3', { text: '玩法说明' }),
          el('span', { class: 'chip chip-tiny', text: opt.badge || levelName() })
        ]),
        rules,
        opt.extra || null
      ]),
      el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn btn-primary', type: 'button', text: opt.startLabel || '开始', onclick: function () { opt.onStart(); } }),
        el('button', { class: 'btn btn-ghost', type: 'button', text: '返回列表', onclick: function () { leave(); } })
      ])
    ]);
  }

  function resultPanel(opt) {
    return el('div', { class: 'gm-wrap' }, [
      el('div', { class: 'panel' }, [
        el('h3', { text: opt.title || '本局成绩' }),
        starRow(opt.stars || 0),
        el('div', { class: 'gm-score' }, [el('span', { text: String(opt.score) }), el('small', { text: '分' })]),
        el('p', { class: 'muted small', text: '正确率 ' + opt.accuracy + '%' }),
        opt.comment ? el('p', { class: 'gm-note', text: opt.comment }) : null,
        opt.kpis ? kpiGrid(opt.kpis) : null,
        el('div', { class: 'btn-row' }, [
          el('button', { class: 'btn btn-primary', type: 'button', text: '再来一局', onclick: function () { opt.onRetry(); } }),
          el('button', { class: 'btn btn-ghost', type: 'button', text: '返回列表', onclick: function () { leave(); } })
        ])
      ]),
      opt.extra || null,
      el('div', { class: 'panel' }, [
        el('h3', { text: opt.reviewTitle || '回顾' }),
        opt.reviewSub ? el('p', { class: 'muted small', text: opt.reviewSub }) : null,
        el('div', { class: 'gm-list' }, opt.review || [])
      ])
    ]);
  }

  function reviewItem(title, lines) {
    var item = el('div', { class: 'gm-item' }, [el('b', { text: title })]);
    (lines || []).forEach(function (l) { item.appendChild(el('small', { text: l })); });
    return item;
  }

  function postEvent(body) {
    return api('/api/event', { method: 'POST', body: body }).then(function (res) {
      checkBadges(res && res.badges);
      return res;
    }).catch(function () { return null; });
  }

  /* ================================================================== *
   * 5. 游戏一：知识闯关（复用 AIQQuiz）
   * ================================================================== */
  function gameQuiz(host) {
    var comp = null;

    function cleanup() {
      if (comp && typeof comp.destroy === 'function') { try { comp.destroy(); } catch (e) {} }
      comp = null;
    }

    function intro() {
      clear(host);
      var secs = timerSeconds();
      host.appendChild(introPanel({
        emoji: '🎯', title: '知识闯关', badge: levelName(), best: bestOf('quiz'),
        sub: '限时快问快答：连击越高得分越高，答错的题立刻看解析并写进错题本。',
        rules: [
          '共 8 道题，每题 4 个选项，题目按你的学段自动选难度。',
          secs ? '每题限时 ' + secs + ' 秒，越快答对时间奖励越高；时间到算未作答。' : '本学段不限时，想清楚再选，答对同样有奖励分。',
          '连续答对累积连击，连击奖励每题最高 +100 分。',
          '答错的题会自动进入错题本，回到列表后可以点「我已订正」。',
          '键盘 1 / 2 / 3 / 4 作答，回车进入下一题。'
        ],
        startLabel: '开始挑战',
        onStart: start
      }));
    }

    function start() {
      clear(host);
      host.appendChild(el('p', { class: 'gm-note', text: '正在取题…' }));
      api('/api/quiz?count=8&domain=' + encodeURIComponent(S.domain)).then(function (res) {
        var list = (res && res.questions) || [];
        if (!list.length) {
          clear(host);
          host.appendChild(el('p', { class: 'notice', text: '这个领域暂时没有题目，换一个领域再试试。' }));
          return;
        }
        if (!W.AIQQuiz || typeof W.AIQQuiz.render !== 'function') {
          clear(host);
          host.appendChild(el('p', { class: 'notice', text: '答题组件没有加载成功，请刷新页面后重试。' }));
          return;
        }
        comp = W.AIQQuiz.render(host, {
          questions: list,
          title: '知识闯关',
          timed: timerSeconds() ? timerSeconds() : 'none',
          onAnswer: reportAnswer,
          onFinish: reportFinish,
          onExit: leave
        });
      }).catch(function (e) {
        clear(host);
        host.appendChild(el('p', { class: 'notice', text: '取题失败：' + (e && e.message ? e.message : '未知错误') }));
      });
    }

    function reportAnswer(info) {
      var q = info.question;
      var lv = level();
      return api('/api/answer', {
        method: 'POST',
        body: {
          topicId: q.topicId || null,
          question: q.q,
          options: q.options,
          answer: q.options[q.answer],
          mine: info.mine,
          correct: info.correct,
          explain: q.explain || '',
          score: info.score,
          mode: 'quiz',
          title: '知识闯关',
          levelId: lv ? lv.id : null
        }
      }).then(function (res) {
        checkBadges(res && res.badges);
        return res && res.feedback ? res.feedback : '';
      }).catch(function () { return ''; });
    }

    function reportFinish(r) {
      postEvent({
        type: 'game', game: 'quiz', title: '知识闯关',
        score: r.score,
        correct: r.correct >= r.total * 0.8,
        xp: 10 + r.correct * 4 + r.stars * 5,
        detail: '答对 ' + r.correct + '/' + r.total + '，正确率 ' + r.accuracy + '%，最高连击 x' + r.maxCombo
      }).then(function () { updateBest('quiz', r.score); });
      if (r.stars >= 3) toast({ type: 'ok', title: '太厉害了', text: '几乎全对，知识掌握得很牢固！' });
    }

    intro();
    return cleanup;
  }

  /* ================================================================== *
   * 6. 游戏二：数据标注师
   * ================================================================== */
  function gameLabel(host) {
    var ticker = Ticker();
    var data = null, assign = {}, selected = null, result = null, phase = 'intro';
    var elapsed = 0, t0 = 0, dragId = null;
    var ui = {};

    function cleanup() { ticker.clear(); }

    function load() {
      clear(host);
      host.appendChild(el('p', { class: 'gm-note', text: '正在准备数据…' }));
      return api('/api/games/data?kind=label').then(function (res) {
        data = res;
        intro();
      }).catch(function (e) {
        clear(host);
        host.appendChild(el('p', { class: 'notice', text: '数据加载失败：' + (e && e.message ? e.message : '未知错误') }));
      });
    }

    function intro() {
      phase = 'intro';
      clear(host);
      host.appendChild(introPanel({
        emoji: '🏷️', title: '数据标注师', badge: '数据 · 模型', best: bestOf('label'),
        sub: data.name + '：' + data.question,
        rules: [
          '把每个样本放进你认为正确的类别桶：可以拖动，也可以先点样本、再点桶。',
          '放错了没关系，点桶里的样本就能把它放回待标注区。',
          '全部标完点「开始训练」，系统用你标注的数据训练一个真实的 1-近邻模型。',
          '训练后会给出：标注一致率（和真实类别比）、模型在 3 个新样本上的准确率。',
          '重点观察：标注错了，模型会不会跟着错？'
        ],
        startLabel: '开始标注',
        onStart: start,
        extra: data.note ? el('p', { class: 'gm-note', text: data.note }) : null
      }));
    }

    function countDone() {
      var n = 0;
      (data.samples || []).forEach(function (s) { if (assign[s.id] !== undefined) n += 1; });
      return n;
    }

    function sampleNode(s, where) {
      var cls = 'gm-sample';
      if (where === 'pool' && selected === s.id) cls += ' on';
      if (where === 'bin' && result) cls += (assign[s.id] === s.label ? ' ok' : ' no');
      var node = el('div', {
        class: cls, role: 'button', tabindex: '0',
        'aria-label': '样本 ' + s.features.join('、'),
        draggable: where === 'pool' ? 'true' : 'false'
      }, [
        el('span', { class: 'gm-emoji', text: s.emoji }),
        el('span', {}, [el('b', { text: s.features[0] || '样本' }), el('small', { text: s.features.join(' · ') })])
      ]);
      if (where === 'bin' && result) {
        node.appendChild(el('span', { class: 'gm-tag ' + (assign[s.id] === s.label ? 'ok' : 'no'), text: (assign[s.id] === s.label ? '标对了' : '应为 ' + data.labels[s.label]) }));
      }
      node.addEventListener('click', function () {
        if (phase !== 'play') return;
        if (where === 'pool') {
          selected = selected === s.id ? null : s.id;
          renderPool();
        } else {
          delete assign[s.id];
          selected = null;
          renderPool();
        }
      });
      node.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { if (e.preventDefault) e.preventDefault(); node.click(); }
      });
      if (where === 'pool') {
        node.addEventListener('dragstart', function (e) {
          dragId = s.id;
          if (e && e.dataTransfer) { try { e.dataTransfer.setData('text/plain', s.id); } catch (err) {} }
        });
        node.addEventListener('dragend', function () { dragId = null; });
      }
      return node;
    }

    function binNode(index) {
      var list = (data.samples || []).filter(function (s) { return assign[s.id] === index; });
      var items = el('div', { class: 'gm-bin-items' });
      list.forEach(function (s) { items.appendChild(sampleNode(s, 'bin')); });
      var node = el('div', {
        class: 'gm-bin ' + (index === 0 ? 'a' : 'b'), role: 'button', tabindex: '0',
        'aria-label': data.labels[index] + ' 类别桶，目前 ' + list.length + ' 个样本'
      }, [
        el('h4', {}, [el('span', { text: index === 0 ? '🅰️' : '🅱️' }), el('span', { text: data.labels[index] }), el('span', { class: 'chip chip-tiny', text: String(list.length) })]),
        el('p', { text: index === 0 ? '放到这一类的样本' : '放到这一类的样本' }),
        items
      ]);
      function put() {
        if (phase !== 'play') return;
        var id = dragId || selected;
        if (!id) { toast({ type: 'info', text: '先点一个样本，再点这个桶' }); return; }
        assign[id] = index;
        selected = null;
        dragId = null;
        renderPool();
      }
      node.addEventListener('click', put);
      node.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { if (e.preventDefault) e.preventDefault(); put(); }
      });
      node.addEventListener('dragover', function (e) { if (e && e.preventDefault) e.preventDefault(); node.className = 'gm-bin ' + (index === 0 ? 'a' : 'b') + ' over'; });
      node.addEventListener('dragleave', function () { node.className = 'gm-bin ' + (index === 0 ? 'a' : 'b'); });
      node.addEventListener('drop', function (e) {
        if (e && e.preventDefault) e.preventDefault();
        node.className = 'gm-bin ' + (index === 0 ? 'a' : 'b');
        put();
      });
      return node;
    }

    function renderPool() {
      var done = countDone();
      var total = (data.samples || []).length;
      clear(ui.pool);
      (data.samples || []).forEach(function (s) {
        if (assign[s.id] === undefined) ui.pool.appendChild(sampleNode(s, 'pool'));
      });
      if (!ui.pool.firstChild) ui.pool.appendChild(el('span', { class: 'muted small', text: '所有样本都标注完啦，点「开始训练」看看模型学得怎么样。' }));
      clear(ui.bins);
      ui.bins.appendChild(binNode(0));
      ui.bins.appendChild(binNode(1));
      ui.set('done', done + '/' + total);
      ui.set('left', total - done);
      ui.prog((total ? done / total : 0));
      if (ui.trainBtn) {
        if (done >= total) ui.trainBtn.removeAttribute('disabled');
        else ui.trainBtn.setAttribute('disabled', '');
      }
    }

    function start() {
      phase = 'play';
      assign = {};
      selected = null;
      result = null;
      elapsed = 0;
      t0 = Date.now();
      var top = el('div', { class: 'gm-hud-top' });
      var chips = {};
      function chip(key, label) {
        var b = el('b', { text: '0' });
        chips[key] = b;
        top.appendChild(el('span', { class: 'chip' }, [el('span', { text: label }), b]));
      }
      chip('done', '已标注 ');
      chip('left', '待标注 ');
      chip('time', '用时 ');
      var progI = el('i', { style: { width: '0%' } });
      ui.pool = el('div', { class: 'gm-pool' });
      ui.bins = el('div', { class: 'gm-bins' });
      ui.set = function (k, v) { if (chips[k]) chips[k].textContent = String(v); };
      ui.prog = function (p) { progI.style.width = (clamp(p, 0, 1) * 100) + '%'; };
      ui.trainBtn = el('button', { class: 'btn btn-primary', type: 'button', text: '开始训练模型', disabled: true, onclick: train });
      var panel = el('div', { class: 'panel' }, [
        el('div', { class: 'panel-head' }, [
          el('h3', { text: '数据集：' + data.name }),
          el('span', { class: 'chip chip-tiny', text: '按真实标签评分' })
        ]),
        el('p', { class: 'gm-note', text: data.question }),
        el('p', { class: 'small muted', text: '待标注样本（拖动，或点样本再点桶）' }),
        ui.pool,
        ui.bins,
        el('div', { class: 'btn-row' }, [
          ui.trainBtn,
          el('button', {
            class: 'btn btn-ghost btn-sm', type: 'button', text: '全部重来',
            onclick: function () { assign = {}; selected = null; renderPool(); }
          }),
          el('button', {
            class: 'btn btn-ghost btn-sm', type: 'button', text: '返回列表',
            onclick: function () {
              confirmDialog('离开后本局标注不会记录，确定返回列表吗？', function () { leave(); });
            }
          })
        ])
      ]);
      clear(host);
      host.appendChild(el('div', { class: 'gm-wrap' }, [
        el('div', { class: 'gm-hud' }, [
          top,
          el('div', { class: 'gm-barline' }, [el('span', { text: '进度' }), el('div', { class: 'gm-bar' }, [progI])])
        ]),
        panel
      ]));
      ticker.every(500, function () {
        elapsed = Math.floor((Date.now() - t0) / 1000);
        ui.set('time', elapsed + 's');
      });
      renderPool();
    }

    /* 真实统计：标注一致率 + 1-近邻（特征集合杰卡德相似度）模型 */
    function jaccard(a, b) {
      var inter = 0;
      a.forEach(function (f) { if (b.indexOf(f) >= 0) inter += 1; });
      var union = a.length + b.length - inter;
      return union > 0 ? inter / union : 0;
    }

    function evaluate() {
      var labeled = (data.samples || []).map(function (s) {
        return { s: s, label: assign[s.id] === undefined ? 0 : assign[s.id] };
      });
      var agree = labeled.filter(function (x) { return x.label === x.s.label; }).length;
      var preds = (data.test || []).map(function (t) {
        var best = null, bestSim = -1;
        labeled.forEach(function (x) {
          var sim = jaccard(t.features, x.s.features);
          if (sim > bestSim) { bestSim = sim; best = x; }
        });
        var shared = best ? t.features.filter(function (f) { return best.s.features.indexOf(f) >= 0; }) : [];
        return { t: t, label: best ? best.label : 0, ref: best, sim: bestSim, shared: shared, ok: !!(best && best.label === t.label) };
      });
      var acc = preds.length ? preds.filter(function (p) { return p.ok; }).length / preds.length : 0;
      return {
        agree: agree, total: labeled.length, labeled: labeled, preds: preds, acc: acc,
        agreeRate: labeled.length ? agree / labeled.length : 0
      };
    }

    function train() {
      if (countDone() < (data.samples || []).length) { toast({ type: 'warn', text: '还有样本没有标注' }); return; }
      phase = 'training';
      ticker.clear();
      var steps = ['读取你标注的数据…', '提取每个样本的特征…', '训练 1-近邻模型并评估…'];
      var box = el('div', { class: 'gm-steps' });
      var nodes = steps.map(function (s) { return el('div', { class: 'gm-step', text: '○ ' + s }); });
      nodes.forEach(function (n) { box.appendChild(n); });
      var barI = el('i', { style: { width: '0%' } });
      clear(host);
      host.appendChild(el('div', { class: 'gm-wrap' }, [
        el('div', { class: 'panel' }, [
          el('h3', { text: '模型训练中' }),
          el('p', { class: 'muted small', text: '用你标注的 ' + (data.samples || []).length + ' 个样本训练一个小模型' }),
          box,
          el('div', { class: 'gm-barline' }, [el('span', { text: '训练' }), el('div', { class: 'gm-bar' }, [barI])])
        ])
      ]));
      var i = 0;
      ticker.every(460, function () {
        if (i < nodes.length) {
          nodes[i].className = 'gm-step done';
          nodes[i].textContent = '● ' + steps[i];
          if (i + 1 < nodes.length) nodes[i + 1].className = 'gm-step on';
        }
        i += 1;
        barI.style.width = Math.min(100, Math.round(i / (nodes.length + 1) * 100)) + '%';
        if (i > nodes.length) {
          ticker.clear();
          showReport();
        }
      });
    }

    function conclusion(r) {
      if (r.agreeRate === 1 && r.acc === 1) return '标注全部正确，模型学到了可靠的规律，新样本也全部判断正确——好数据带来好模型。';
      if (r.agreeRate === 1) return '你的标注完全正确，但新样本里出现了没见过的特征组合，模型还是会犯错，这说明数据覆盖面同样重要。';
      if (r.agreeRate >= 0.75) return '大部分标注是对的，但有几条标错了。模型把这些错误当成正确答案学了进去，新样本上就出现了同样的错误——数据里的错误会传染给模型。';
      return '这次标注和真实类别差距比较大，模型学到的规律也比较混乱。真实项目里，工程师会反复检查、清洗数据再重新训练。';
    }

    function showReport() {
      var r = evaluate();
      result = r;
      phase = 'result';
      var rate = Math.round(r.agreeRate * 100);
      var accPct = Math.round(r.acc * 100);
      var score = clamp(Math.round(r.agreeRate * 60 + r.acc * 40), 0, 100);
      var stars = starsOf(score);
      var xp = 14 + r.agree * 3 + Math.round(r.acc * 10) + stars * 4;
      postEvent({
        type: 'game', game: 'label', title: '数据标注师 · ' + data.name,
        score: score, correct: r.agreeRate >= 0.8 && r.acc >= 0.6, xp: xp,
        detail: '标注一致率 ' + rate + '%，模型在新样本上准确率 ' + accPct + '%'
      }).then(function () { updateBest('label', score); });

      var report = el('div', { class: 'panel' }, [
        el('div', { class: 'panel-head' }, [el('h3', { text: '训练报告' }), el('span', { class: 'chip chip-tiny', text: '1-近邻模型' })]),
        kpiGrid([
          { v: rate + '%', label: '标注一致率' },
          { v: accPct + '%', label: '新样本准确率' },
          { v: (data.test || []).length, label: '新样本数' },
          { v: elapsed + 's', label: '标注用时' }
        ]),
        el('p', { class: 'gm-note', text: conclusion(r) }),
        el('h3', { text: '模型对新样本的判断' }),
        el('div', { class: 'gm-list' }, r.preds.map(function (p) {
          return el('div', { class: 'gm-item' }, [
            el('b', { text: p.t.emoji + ' 模型判断为「' + data.labels[p.label] + '」' + (p.ok ? ' ✅' : ' ❌') }),
            el('small', { text: '真实类别：' + data.labels[p.t.label] + '　依据：和你标注的 ' + (p.ref ? p.ref.s.emoji + ' ' + p.ref.s.features.join('、') : '—') + ' 最像（共同特征 ' + p.shared.length + ' 个）' })
          ]);
        }))
      ]);

      var wrong = r.labeled.filter(function (x) { return x.label !== x.s.label; });
      var review = wrong.map(function (x) {
        return reviewItem(x.s.emoji + ' 你标成了「' + data.labels[x.label] + '」', [
          '真实类别：' + data.labels[x.s.label] + '（' + x.s.features.join(' · ') + '）',
          '这条错误标注会被模型当成正确答案学进去，这就是数据质量的重要性。'
        ]);
      });
      if (!review.length) review.push(reviewItem('所有样本都标注正确 🎉', ['干净的数据让模型学到了可靠的规律，换一套数据再挑战一次吧。']));

      clear(host);
      host.appendChild(resultPanel({
        title: '数据标注师 · 本局成绩',
        score: score, accuracy: rate, stars: stars,
        comment: conclusion(r),
        kpis: [
          { v: r.agree + '/' + r.total, label: '标注正确' },
          { v: accPct + '%', label: '模型准确率' },
          { v: xp, label: '获得经验' },
          { v: elapsed + 's', label: '用时' }
        ],
        extra: report,
        reviewTitle: '标错的样本',
        reviewSub: '看看真实类别，再想想模型会学成什么样',
        review: review,
        onRetry: function () { load(); }
      }));
    }

    load();
    return cleanup;
  }

  /* ================================================================== *
   * 7. 游戏三：神经网络训练（真实前向计算 + 梯度下降）
   * ================================================================== */
  function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }

  function gameNet(host) {
    var ticker = Ticker();
    var tasks = [], ti = 0, w1 = 0.5, w2 = 0.5, b = -0.2, adj = 0, hist = [];
    var elapsed = 0, t0 = 0, running = false, done = false;
    var ui = {};

    function cleanup() { ticker.clear(); }

    function task() { return tasks[ti] || { id: 'AND', name: '逻辑与', desc: '', points: [] }; }

    function points() { return task().points || []; }

    function outputs() {
      return points().map(function (p) {
        var pr = sigmoid(w1 * p[0] + w2 * p[1] + b);
        return { x1: p[0], x2: p[1], y: p[2], p: pr, pred: pr >= 0.5 ? 1 : 0, ok: (pr >= 0.5 ? 1 : 0) === p[2] };
      });
    }

    function correctCount() {
      var n = 0;
      outputs().forEach(function (o) { if (o.ok) n += 1; });
      return n;
    }

    function loss() {
      var ps = points(), sum = 0;
      ps.forEach(function (p) {
        var pr = clamp(sigmoid(w1 * p[0] + w2 * p[1] + b), 1e-6, 1 - 1e-6);
        sum += -(p[2] * Math.log(pr) + (1 - p[2]) * Math.log(1 - pr));
      });
      return ps.length ? sum / ps.length : 0;
    }

    function pushHist() {
      hist.push(loss());
      if (hist.length > 40) hist.shift();
    }

    function gradients() {
      var ps = points(), gw1 = 0, gw2 = 0, gb = 0;
      ps.forEach(function (p) {
        var e = sigmoid(w1 * p[0] + w2 * p[1] + b) - p[2];
        gw1 += e * p[0];
        gw2 += e * p[1];
        gb += e;
      });
      var n = ps.length || 1;
      return { w1: gw1 / n, w2: gw2 / n, b: gb / n };
    }

    function resetWeights() {
      var id = task().id;
      if (id === 'OR') { w1 = 0.4; w2 = 0.4; b = -0.6; }
      else if (id === 'NAND') { w1 = -0.5; w2 = -0.5; b = 0.2; }
      else { w1 = 0.5; w2 = 0.5; b = -0.2; }
      hist = [loss()];
    }

    function load() {
      clear(host);
      host.appendChild(el('p', { class: 'gm-note', text: '正在准备任务卡…' }));
      return api('/api/games/data?kind=net').then(function (res) {
        tasks = (res && res.tasks) || [];
        if (!tasks.length) {
          clear(host);
          host.appendChild(el('p', { class: 'notice', text: '暂时没有可用的任务卡。' }));
          return;
        }
        intro();
      }).catch(function (e) {
        clear(host);
        host.appendChild(el('p', { class: 'notice', text: '任务卡加载失败：' + (e && e.message ? e.message : '未知错误') }));
      });
    }

    function intro() {
      clear(host);
      host.appendChild(introPanel({
        emoji: '🧠', title: '神经网络训练', badge: '算法 · 模型', best: bestOf('net'),
        sub: '一个最小的神经元：2 个输入、2 个权重、1 个偏置。你亲手把它调到能全部分对。',
        rules: [
          '计算方式：把输入乘上权重、加上偏置，再送进 sigmoid 函数，得到 0~1 之间的输出。',
          '输出大于 0.5 判为 1，否则判为 0。目标：让 4 个数据点全部分类正确。',
          '拖动滑块（或点住后用方向键微调），网络图、决策边界和损失值都会实时更新。',
          '损失值表示模型答案和正确答案差多少，越小越好。',
          '也可以点「自动梯度下降」，看模型自己一步步把损失降下来。'
        ],
        startLabel: '开始实验',
        onStart: start,
        extra: el('p', { class: 'gm-note', text: '三个任务：' + tasks.map(function (t) { return t.name; }).join('、') + '（都不需要隐藏层，一个神经元就够）' })
      }));
    }

    function mkSlider(label, value, onChange) {
      var range = el('input', { type: 'range', min: '-4', max: '4', step: '0.1', 'aria-label': label });
      range.value = String(value);
      var valNode = el('b', { text: fix(value, 1) });
      range.addEventListener('input', function () {
        var v = Number(range.value);
        valNode.textContent = fix(v, 1);
        onChange(v);
      });
      return {
        node: el('div', { class: 'gm-slider' }, [
          el('div', { class: 'top' }, [el('span', { text: label }), valNode]),
          range
        ]),
        set: function (v) { range.value = String(v); valNode.textContent = fix(v, 1); }
      };
    }

    function start() {
      done = false;
      running = false;
      adj = 0;
      elapsed = 0;
      t0 = Date.now();
      resetWeights();

      var top = el('div', { class: 'gm-hud-top' });
      var chips = {};
      function chip(key, label) {
        var v = el('b', { text: '0' });
        chips[key] = v;
        top.appendChild(el('span', { class: 'chip' }, [el('span', { text: label }), v]));
      }
      chip('right', '正确 ');
      chip('loss', '损失 ');
      chip('adj', '调整 ');
      chip('time', '用时 ');
      ui.set = function (k, v) { if (chips[k]) chips[k].textContent = String(v); };
      var progI = el('i', { style: { width: '0%' } });
      ui.prog = function (p) { progI.style.width = (clamp(p, 0, 1) * 100) + '%'; };

      ui.netBox = el('div', { class: 'gm-svg' });
      ui.plotBox = el('div', { class: 'gm-svg' });
      ui.tableBox = el('div', {});
      ui.chartBox = el('div', {});
      ui.banner = el('div', { class: 'gm-banner', style: { display: 'none' } });

      ui.s1 = mkSlider('权重 w1（输入 x1 的重要程度）', w1, function (v) { w1 = v; touch(); });
      ui.s2 = mkSlider('权重 w2（输入 x2 的重要程度）', w2, function (v) { w2 = v; touch(); });
      ui.s3 = mkSlider('偏置 b（判断的门槛高低）', b, function (v) { b = v; touch(); });

      var seg = el('div', { class: 'btn-row' }, tasks.map(function (t, i) {
        var btn = el('button', {
          class: 'btn btn-sm ' + (i === ti ? 'btn-primary' : 'btn-ghost'), type: 'button', text: t.name,
          onclick: function () {
            ti = i;
            adj = 0;
            elapsed = 0;
            t0 = Date.now();
            resetWeights();
            syncSliders();
            renderDynamic();
            qsa('button', seg).forEach(function (x, xi) { x.className = 'btn btn-sm ' + (xi === i ? 'btn-primary' : 'btn-ghost'); });
          }
        });
        return btn;
      }));

      clear(host);
      host.appendChild(el('div', { class: 'gm-wrap' }, [
        el('div', { class: 'gm-hud' }, [
          top,
          el('div', { class: 'gm-barline' }, [el('span', { text: '正确' }), el('div', { class: 'gm-bar' }, [progI])])
        ]),
        el('div', { class: 'panel' }, [
          el('div', { class: 'panel-head' }, [el('h3', { text: '任务卡' }), el('span', { class: 'chip chip-tiny', text: '激活函数 sigmoid' })]),
          seg,
          el('p', { class: 'gm-note', text: task().desc })
        ]),
        ui.banner,
        el('div', { class: 'panel' }, [
          el('h3', { text: '实时计算' }),
          el('div', { class: 'gm-two' }, [ui.netBox, ui.plotBox]),
          el('div', { class: 'gm-legend' }, [
            el('span', {}, [el('i', { class: 'gm-dot', style: { background: 'rgba(47,143,107,.45)' } }), el('span', { text: '判断为 1 的区域' })]),
            el('span', {}, [el('i', { class: 'gm-dot', style: { background: 'rgba(210,105,74,.35)' } }), el('span', { text: '判断为 0 的区域' })]),
            el('span', {}, [el('i', { class: 'gm-dot', style: { background: '#e8a33d' } }), el('span', { text: '样本点（绿圈 = 判断正确）' })])
          ])
        ]),
        el('div', { class: 'gm-two' }, [
          el('div', { class: 'panel' }, [
            el('h3', { text: '调节参数' }),
            ui.s1.node, ui.s2.node, ui.s3.node,
            el('div', { class: 'btn-row' }, [
              el('button', { class: 'btn btn-primary btn-sm', type: 'button', text: '自动梯度下降', onclick: autoTrain }),
              el('button', {
                class: 'btn btn-ghost btn-sm', type: 'button', text: '重置参数',
                onclick: function () { adj = 0; resetWeights(); syncSliders(); renderDynamic(); }
              }),
              el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '结束并结算', onclick: function () { finish(correctCount() === points().length); } }),
              el('button', {
                class: 'btn btn-ghost btn-sm', type: 'button', text: '返回列表',
                onclick: function () { confirmDialog('离开后本次实验不会记录，确定返回列表吗？', function () { leave(); }); }
              })
            ])
          ]),
          el('div', { class: 'panel' }, [
            el('h3', { text: '损失与输出' }),
            ui.chartBox,
            ui.tableBox
          ])
        ])
      ]));
      ticker.every(1000, function () {
        elapsed = Math.floor((Date.now() - t0) / 1000);
        ui.set('time', elapsed + 's');
      });
      syncSliders();
      renderDynamic();
    }

    function syncSliders() {
      if (ui.s1) ui.s1.set(w1);
      if (ui.s2) ui.s2.set(w2);
      if (ui.s3) ui.s3.set(b);
    }

    function touch() {
      adj += 1;
      pushHist();
      renderDynamic();
    }

    function autoTrain() {
      if (running) return;
      running = true;
      toast({ type: 'info', text: '开始自动梯度下降…' });
      var lr = 1.4;
      ticker.every(150, function () {
        var g = gradients();
        w1 = clamp(w1 - lr * g.w1, -4, 4);
        w2 = clamp(w2 - lr * g.w2, -4, 4);
        b = clamp(b - lr * g.b, -4, 4);
        adj += 1;
        pushHist();
        syncSliders();
        renderDynamic();
        if (correctCount() === points().length && loss() < 0.12) {
          running = false;
          ticker.clear();
          renderDynamic();
          toast({ type: 'ok', title: '训练完成', text: '损失已经很低，4 个点全部分类正确' });
        }
      });
    }

    function renderDynamic() {
      if (!ui.netBox) return;
      var outs = outputs();
      var cc = correctCount();
      var l = loss();
      ui.set('right', cc + '/' + points().length);
      ui.set('loss', fix(l, 3));
      ui.set('adj', adj);
      ui.prog(points().length ? cc / points().length : 0);
      ui.netBox.innerHTML = netSvg();
      ui.plotBox.innerHTML = plotSvg(outs);
      clear(ui.tableBox);
      ui.tableBox.appendChild(pointTable(outs));
      clear(ui.chartBox);
      ui.chartBox.appendChild(lossChart());
      if (cc === points().length) {
        ui.banner.style.display = '';
        clear(ui.banner);
        ui.banner.appendChild(el('div', {}, [
          el('b', { text: '🎉 4 个点全部分类正确！' }),
          el('span', { class: 'small', text: ' 当前损失 ' + fix(l, 3) + '，调整了 ' + adj + ' 次。' })
        ]));
        ui.banner.appendChild(el('div', { class: 'btn-row' }, [
          el('button', { class: 'btn btn-primary btn-sm', type: 'button', text: '完成实验', onclick: function () { finish(true); } })
        ]));
        if (!done) { done = true; toast({ type: 'ok', text: '全部分类正确，可以点「完成实验」结算' }); }
      } else {
        ui.banner.style.display = 'none';
      }
    }

    function netSvg() {
      var Wd = 420, H = 240, x = 70, ox = 330, y1 = 76, y2 = 164, oy = 120;
      var out = sigmoid(w1 * 0.5 + w2 * 0.5 + b);
      function edge(sy, label, w) {
        var sw = (1.2 + Math.min(3, Math.abs(w)) * 0.9).toFixed(2);
        var col = w >= 0 ? '#2b7fb8' : '#c2566f';
        return '<line x1="' + (x + 26) + '" y1="' + sy + '" x2="' + (ox - 30) + '" y2="' + oy + '" stroke="' + col + '" stroke-width="' + sw + '" stroke-opacity=".75"/>' +
          '<text x="' + ((x + ox) / 2 - 4) + '" y="' + ((sy + oy) / 2 - 8) + '" fill="' + col + '" font-size="12" text-anchor="middle">' + label + '=' + fix(w, 1) + '</text>';
      }
      return '<svg viewBox="0 0 ' + Wd + ' ' + H + '" role="img" aria-label="神经网络结构示意">' +
        edge(y1, 'w1', w1) + edge(y2, 'w2', w2) +
        '<line x1="' + x + '" y1="210" x2="' + (ox - 30) + '" y2="' + (oy + 26) + '" stroke="#e8a33d" stroke-width="1.6" stroke-dasharray="5 4"/>' +
        '<text x="' + ((x + ox) / 2 - 8) + '" y="224" fill="#c98a1b" font-size="12" text-anchor="middle">b=' + fix(b, 1) + '</text>' +
        '<circle cx="' + x + '" cy="' + y1 + '" r="24" fill="#eaf3fb" stroke="#2b7fb8" stroke-width="1.6"/>' +
        '<text x="' + x + '" y="' + (y1 + 5) + '" fill="#22312c" font-size="13" text-anchor="middle">x1</text>' +
        '<circle cx="' + x + '" cy="' + y2 + '" r="24" fill="#eaf3fb" stroke="#2b7fb8" stroke-width="1.6"/>' +
        '<text x="' + x + '" y="' + (y2 + 5) + '" fill="#22312c" font-size="13" text-anchor="middle">x2</text>' +
        '<circle cx="' + x + '" cy="210" r="15" fill="#fdf3e3" stroke="#e8a33d" stroke-width="1.4"/>' +
        '<text x="' + x + '" y="215" fill="#a86f14" font-size="12" text-anchor="middle">1</text>' +
        '<circle cx="' + ox + '" cy="' + oy + '" r="34" fill="#f0ecfa" stroke="#7c5cd6" stroke-width="1.8"/>' +
        '<text x="' + ox + '" y="' + (oy - 2) + '" fill="#5b46a8" font-size="12" text-anchor="middle">输出</text>' +
        '<text x="' + ox + '" y="' + (oy + 15) + '" fill="#22312c" font-size="14" text-anchor="middle">' + fix(out, 2) + '</text>' +
        '<text x="' + ox + '" y="' + (oy + 62) + '" fill="#7b8a84" font-size="11" text-anchor="middle">sigmoid(z)</text>' +
        '</svg>';
    }

    /* 半平面与单位正方形求交（Sutherland-Hodgman 裁剪），真实画出「判断为 1」的区域 */
    function halfPlane() {
      if (Math.abs(w1) < 1e-9 && Math.abs(w2) < 1e-9) return b >= 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [];
      function inside(p) { return w1 * p[0] + w2 * p[1] + b >= 0; }
      function cut(a, c) {
        var va = w1 * a[0] + w2 * a[1] + b;
        var vc = w1 * c[0] + w2 * c[1] + b;
        var t = va / (va - vc);
        return [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
      }
      var poly = [[0, 0], [1, 0], [1, 1], [0, 1]];
      var out = [];
      for (var i = 0; i < poly.length; i++) {
        var cur = poly[i];
        var prev = poly[(i + poly.length - 1) % poly.length];
        var ci = inside(cur), pi = inside(prev);
        if (ci) {
          if (!pi) out.push(cut(prev, cur));
          out.push(cur);
        } else if (pi) {
          out.push(cut(prev, cur));
        }
      }
      return out;
    }

    function plotSvg(outs) {
      var Wd = 420, H = 300, pad = 42;
      function sx(v) { return pad + v * (Wd - pad * 2); }
      function sy(v) { return H - pad - v * (H - pad * 2); }
      var poly = halfPlane().map(function (p) { return sx(p[0]) + ',' + sy(p[1]); }).join(' ');
      var svg = '<svg viewBox="0 0 ' + Wd + ' ' + H + '" role="img" aria-label="决策边界与样本点">';
      svg += '<rect x="' + sx(0) + '" y="' + sy(1) + '" width="' + (sx(1) - sx(0)) + '" height="' + (sy(0) - sy(1)) + '" fill="rgba(210,105,74,.14)" stroke="rgba(0,0,0,.12)"/>';
      if (poly) svg += '<polygon points="' + poly + '" fill="rgba(47,143,107,.22)"/>';
      svg += '<line x1="' + sx(0) + '" y1="' + sy(0) + '" x2="' + sx(1) + '" y2="' + sy(0) + '" stroke="rgba(0,0,0,.25)"/>';
      svg += '<line x1="' + sx(0) + '" y1="' + sy(0) + '" x2="' + sx(0) + '" y2="' + sy(1) + '" stroke="rgba(0,0,0,.25)"/>';
      svg += '<text x="' + sx(1) + '" y="' + (sy(0) + 24) + '" fill="#7b8a84" font-size="12" text-anchor="end">输入 x1</text>';
      svg += '<text x="' + (sx(0) - 12) + '" y="' + (sy(1) - 6) + '" fill="#7b8a84" font-size="12" text-anchor="middle">x2</text>';
      outs.forEach(function (o) {
        var cx = sx(o.x1), cy = sy(o.x2);
        svg += '<circle cx="' + cx + '" cy="' + cy + '" r="11" fill="#e8a33d" stroke="' + (o.ok ? '#2f8f6b' : '#d2694a') + '" stroke-width="3"/>';
        svg += '<text x="' + cx + '" y="' + (cy + 4) + '" fill="#4a3208" font-size="12" font-weight="700" text-anchor="middle">' + o.pred + '</text>';
        svg += '<text x="' + (cx + 16) + '" y="' + (cy - 12) + '" fill="#4b5a54" font-size="11">p=' + fix(o.p, 2) + '</text>';
      });
      svg += '</svg>';
      return svg;
    }

    function pointTable(outs) {
      var t = el('table', { class: 'gm-table' });
      var head = el('tr', {}, [
        el('th', { text: 'x1' }), el('th', { text: 'x2' }), el('th', { text: '答案' }),
        el('th', { text: '输出 p' }), el('th', { text: '判断' }), el('th', { text: '结果' })
      ]);
      t.appendChild(el('thead', {}, [head]));
      var tb = el('tbody', {});
      outs.forEach(function (o) {
        tb.appendChild(el('tr', {}, [
          el('td', { text: String(o.x1) }),
          el('td', { text: String(o.x2) }),
          el('td', { text: String(o.y) }),
          el('td', { text: fix(o.p, 3) }),
          el('td', { text: String(o.pred) }),
          el('td', {}, [el('span', { class: 'gm-tag ' + (o.ok ? 'ok' : 'no'), text: o.ok ? '正确' : '错误' })])
        ]));
      });
      t.appendChild(tb);
      return t;
    }

    function lossChart() {
      var Wd = 420, H = 120, pad = 16;
      var data = hist.length ? hist : [loss()];
      var max = Math.max.apply(null, data.concat([0.1]));
      var step = data.length > 1 ? (Wd - pad * 2) / (data.length - 1) : 0;
      var pts = data.map(function (v, i) {
        var x = pad + i * step;
        var y = H - pad - (v / max) * (H - pad * 2);
        return [x, y];
      });
      var path = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
      var svg = '<svg viewBox="0 0 ' + Wd + ' ' + H + '" role="img" aria-label="损失曲线">';
      svg += '<path d="' + path + '" fill="none" stroke="#7c5cd6" stroke-width="2.2" stroke-linecap="round"/>';
      pts.forEach(function (p) { svg += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.2" fill="#fff" stroke="#7c5cd6" stroke-width="1.6"/>'; });
      svg += '<text x="' + pad + '" y="' + (H - 3) + '" fill="#7b8a84" font-size="11">损失 ' + fix(loss(), 3) + '（曲线越低越好）</text>';
      svg += '</svg>';
      return el('div', { class: 'gm-svg' }, [el('div', { html: svg })]);
    }

    function finish(solved) {
      ticker.clear();
      running = false;
      var cc = correctCount();
      var l = loss();
      var score;
      if (solved && cc === points().length) {
        score = clamp(Math.round(55 + Math.max(0, 30 - Math.round(adj * 0.6)) + Math.round((1 - Math.min(1, l)) * 15)), 0, 100);
      } else {
        score = clamp(Math.round((cc / (points().length || 1)) * 55), 0, 100);
      }
      var stars = starsOf(score);
      var xp = 12 + cc * 5 + stars * 5;
      postEvent({
        type: 'game', game: 'net', title: '神经网络训练 · ' + task().name,
        score: score, correct: cc === points().length, xp: xp,
        detail: 'w1=' + fix(w1, 1) + ' w2=' + fix(w2, 1) + ' b=' + fix(b, 1) + '，损失 ' + fix(l, 3) + '，调整 ' + adj + ' 次'
      }).then(function () { updateBest('net', score); });

      var review = [];
      outputs().forEach(function (o) {
        if (!o.ok) {
          review.push(reviewItem('点 (' + o.x1 + ', ' + o.x2 + ') 判断错了', [
            '模型输出 p=' + fix(o.p, 3) + '，正确答案是 ' + o.y,
            '调整权重和偏置，让这条判断边界挪到正确的位置。'
          ]));
        }
      });
      if (!review.length) {
        review.push(reviewItem('4 个点全部分类正确 🎉', [
          '最终参数：w1=' + fix(w1, 1) + '，w2=' + fix(w2, 1) + '，b=' + fix(b, 1) + '，损失 ' + fix(l, 3),
          '你找到了一条能把两类点分开的直线——这正是神经网络学习的基本原理：不断调整参数，让损失变小。'
        ]));
      }

      clear(host);
      host.appendChild(resultPanel({
        title: '神经网络训练 · 本局成绩',
        score: score, accuracy: Math.round(cc / (points().length || 1) * 100), stars: stars,
        comment: cc === points().length
          ? '任务完成！调整 ' + adj + ' 次把损失降到 ' + fix(l, 3) + '，你已经理解了权重与偏置的作用。'
          : '还没有全部分对。提示：多调几次权重和偏置，注意损失值有没有下降。',
        kpis: [
          { v: cc + '/' + points().length, label: '分类正确' },
          { v: fix(l, 3), label: '最终损失' },
          { v: adj, label: '调整次数' },
          { v: xp, label: '获得经验' }
        ],
        extra: el('div', { class: 'panel' }, [el('h3', { text: '损失曲线回放' }), lossChart()]),
        reviewTitle: cc === points().length ? '实验小结' : '还差一点点',
        review: review,
        onRetry: function () { start(); }
      }));
    }

    load();
    return cleanup;
  }

  /* ================================================================== *
   * 8. 游戏四：术语配对
   * ================================================================== */
  function gameMatch(host) {
    var ticker = Ticker();
    var data = null, cards = [], open = [], steps = 0, matched = 0;
    var combo = 0, maxCombo = 0, mism = [], lock = false, elapsed = 0, t0 = 0, phase = 'intro';
    var ui = {};

    function cleanup() { ticker.clear(); }

    function pairs() { return (data && data.pairs) || 1; }

    function targetTime() { return pairs() * 9; }

    function score() {
      if (!steps) return 0;
      var base = 100 * (pairs() / steps);
      var bonus = Math.min(15, maxCombo * 3);
      return clamp(Math.round(base * 0.85 + bonus), 0, 100);
    }

    function load() {
      clear(host);
      host.appendChild(el('p', { class: 'gm-note', text: '正在准备卡片…' }));
      return api('/api/games/data?kind=match').then(function (res) {
        data = res;
        if (!data || !data.cards || !data.cards.length) {
          clear(host);
          host.appendChild(el('p', { class: 'notice', text: '暂时没有可用的词条。' }));
          return;
        }
        cards = data.cards;
        intro();
      }).catch(function (e) {
        clear(host);
        host.appendChild(el('p', { class: 'notice', text: '卡片加载失败：' + (e && e.message ? e.message : '未知错误') }));
      });
    }

    function intro() {
      phase = 'intro';
      clear(host);
      host.appendChild(introPanel({
        emoji: '🃏', title: '术语配对', badge: '术语 · 概念', best: bestOf('match'),
        sub: '把 AI 术语和它的通俗解释配成一对，用最少的步数全部配对成功。',
        rules: [
          '每次翻开两张卡片：一张是术语，一张是它的通俗解释。',
          '配对成功就留在桌面上；配错了会自动翻回去，记住它们的位置。',
          '连续配对成功会累积连击，连击有额外加分。',
          '得分 = 配对效率 × 85 + 连击奖励：步数越少分越高，理论上配 ' + pairs() + ' 对最少 ' + pairs() + ' 步。',
          '键盘可以用 Tab 移动、回车翻牌；手机直接点卡片。'
        ],
        startLabel: '开始配对',
        onStart: start,
        extra: el('p', { class: 'gm-note', text: '三星目标：' + targetTime() + ' 秒内完成。' })
      }));
    }

    function cardNode(card) {
      var node = el('button', {
        class: 'gm-flip', type: 'button',
        'aria-label': (card.kind === 'term' ? '术语卡片' : '解释卡片') + '，按回车翻开'
      }, [
        el('div', { class: 'inner' }, [
          el('div', { class: 'face front' }, [el('span', { text: '❓' })]),
          el('div', { class: 'face back' }, [el('span', { text: card.text })])
        ])
      ]);
      node.addEventListener('click', function () { flip(card); });
      return node;
    }

    function start() {
      phase = 'play';
      open = [];
      steps = 0;
      matched = 0;
      combo = 0;
      maxCombo = 0;
      mism = [];
      lock = false;
      elapsed = 0;
      t0 = Date.now();
      cards.forEach(function (c) { c.node = null; });

      var top = el('div', { class: 'gm-hud-top' });
      var chips = {};
      function chip(key, label) {
        var b = el('b', { text: '0' });
        chips[key] = b;
        top.appendChild(el('span', { class: 'chip' }, [el('span', { text: label }), b]));
      }
      chip('pairs', '已配对 ');
      chip('steps', '步数 ');
      chip('combo', '连击 ');
      chip('time', '用时 ');
      ui.set = function (k, v) { if (chips[k]) chips[k].textContent = String(v); };
      var progI = el('i', { style: { width: '0%' } });
      var timeI = el('i', { style: { width: '0%' } });
      ui.prog = function (p) { progI.style.width = (clamp(p, 0, 1) * 100) + '%'; };
      ui.timer = function (p) { timeI.style.width = (clamp(p, 0, 1) * 100) + '%'; };

      var board = el('div', { class: 'gm-cards' });
      var order = shuffle(cards.slice());
      order.forEach(function (c) {
        c.node = cardNode(c);
        c.open = false;
        c.done = false;
        board.appendChild(c.node);
      });

      clear(host);
      host.appendChild(el('div', { class: 'gm-wrap' }, [
        el('div', { class: 'gm-hud' }, [
          top,
          el('div', { class: 'gm-barline' }, [el('span', { text: '进度' }), el('div', { class: 'gm-bar' }, [progI])]),
          el('div', { class: 'gm-barline gm-timer' }, [el('span', { text: '计时' }), el('div', { class: 'gm-bar' }, [timeI])])
        ]),
        el('div', { class: 'panel' }, [
          el('div', { class: 'panel-head' }, [
            el('h3', { text: '翻开卡片，把术语和解释配成一对' }),
            el('span', { class: 'chip chip-tiny', text: pairs() + ' 对 · ' + cards.length + ' 张' })
          ]),
          board,
          el('div', { class: 'btn-row' }, [
            el('button', {
              class: 'btn btn-ghost btn-sm', type: 'button', text: '返回列表',
              onclick: function () { confirmDialog('离开后本局成绩不会记录，确定返回列表吗？', function () { leave(); }); }
            })
          ])
        ])
      ]));
      ticker.every(400, function () {
        elapsed = Math.floor((Date.now() - t0) / 1000);
        ui.set('time', elapsed + 's');
        ui.timer(elapsed / targetTime());
      });
      updateHud();
    }

    function updateHud() {
      ui.set('pairs', matched + '/' + pairs());
      ui.set('steps', steps);
      ui.set('combo', combo);
      ui.prog(matched / pairs());
    }

    function flip(card) {
      if (phase !== 'play' || lock || card.open || card.done) return;
      card.open = true;
      if (card.node.classList) card.node.classList.add('open');
      open.push(card);
      if (open.length < 2) return;
      steps += 1;
      var a = open[0], b = open[1];
      if (a.pair === b.pair) {
        a.done = true;
        b.done = true;
        if (a.node.classList) a.node.classList.add('done');
        if (b.node.classList) b.node.classList.add('done');
        matched += 1;
        combo += 1;
        if (combo > maxCombo) maxCombo = combo;
        open = [];
        toast({ type: 'ok', text: '配对成功' + (combo > 1 ? '　连击 x' + combo : ''), duration: 1200 });
        updateHud();
        if (matched === pairs()) finish();
        return;
      }
      combo = 0;
      mism.push({ a: a, b: b });
      lock = true;
      updateHud();
      ticker.after(900, function () {
        lock = false;
        a.open = false;
        b.open = false;
        if (a.node.classList) a.node.classList.remove('open');
        if (b.node.classList) b.node.classList.remove('open');
        open = [];
        updateHud();
      });
    }

    function finish() {
      phase = 'result';
      ticker.clear();
      var sc = score();
      var stars = starsOf(sc);
      var acc = steps ? Math.round(matched / steps * 100) : 100;
      var xp = 12 + matched * 3 + stars * 4;
      postEvent({
        type: 'game', game: 'match', title: '术语配对',
        score: sc, correct: stars >= 2, xp: xp,
        detail: '用 ' + steps + ' 步配对 ' + matched + ' 对，用时 ' + elapsed + ' 秒，最高连击 x' + maxCombo
      }).then(function () { updateBest('match', sc); });

      var review = mism.slice(0, 6).map(function (m) {
        var term = m.a.kind === 'term' ? m.a : m.b;
        var wrong = m.a.kind === 'term' ? m.b : m.a;
        return reviewItem(term.text, [
          '你把它和「' + wrong.text + '」配在了一起',
          '它的正确解释是另一张卡片，再读一遍会记得更牢。'
        ]);
      });
      if (!review.length) review.push(reviewItem('一次都没有配错 🎉', ['记忆力很棒！可以试试更快完成，或者换个领域再来一局。']));

      clear(host);
      host.appendChild(resultPanel({
        title: '术语配对 · 本局成绩',
        score: sc, accuracy: acc, stars: stars,
        comment: stars === 3 ? '又快又准！这些 AI 术语你已经记牢了。'
          : stars === 2 ? '表现不错，再看看记混的那几组，下一局会更快。'
            : '慢慢来，把术语和解释多读两遍，记忆会更牢固。',
        kpis: [
          { v: acc + '%', label: '配对成功率' },
          { v: steps, label: '总步数' },
          { v: 'x' + maxCombo, label: '最高连击' },
          { v: elapsed + 's', label: '用时（目标 ' + targetTime() + 's）' }
        ],
        reviewTitle: '记混过的组合',
        reviewSub: '读一遍正确解释，下次就能秒配',
        review: review,
        onRetry: function () { load(); }
      }));
    }

    load();
    return cleanup;
  }

  /* ================================================================== *
   * 9. 页面装配
   * ================================================================== */

  function play(id) {
    var host = qs('#game-stage');
    if (!host) return;
    if (S.cleanup) { try { S.cleanup(); } catch (e) {} S.cleanup = null; }
    clear(host);
    S.game = id;
    var grid = qs('#game-grid');
    if (grid && grid.classList) grid.classList.add('gm-dim');
    var makers = { quiz: gameQuiz, label: gameLabel, net: gameNet, match: gameMatch };
    var make = makers[id];
    if (!make) return;
    var inner = null;
    try { inner = make(host); } catch (e) {
      clear(host);
      host.appendChild(el('p', { class: 'notice', text: '这个小游戏暂时打不开：' + (e && e.message ? e.message : '未知错误') }));
      return;
    }
    S.cleanup = function () { if (typeof inner === 'function') { try { inner(); } catch (e) {} } };
    if (host.scrollIntoView) {
      try { host.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { try { host.scrollIntoView(); } catch (e2) {} }
    }
  }

  function leave() {
    if (S.cleanup) { try { S.cleanup(); } catch (e) {} S.cleanup = null; }
    var host = qs('#game-stage');
    if (host) clear(host);
    var grid = qs('#game-grid');
    if (grid && grid.classList) grid.classList.remove('gm-dim');
    S.game = null;
    if (host && host.scrollIntoView) {
      try { host.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { try { host.scrollIntoView(); } catch (e2) {} }
    }
  }

  function bumpWrongChip(delta) {
    var panel = qs('#wrong-book');
    if (!panel) return;
    var host = panel.parentNode || panel;
    var chip = qs('.chip-tiny', host);
    if (!chip) return;
    var m = String(chip.textContent).match(/[0-9]+/);
    if (!m) return;
    var n = Math.max(0, Number(m[0]) + delta);
    chip.textContent = String(chip.textContent).replace(/[0-9]+/, String(n));
  }

  function fixWrong(btn) {
    var id = btn.getAttribute('data-fix');
    if (!id) return;
    btn.setAttribute('disabled', '');
    api('/api/wrong/fix', { method: 'POST', body: { id: id } }).then(function (res) {
      if (res && res.ok) {
        var item = btn.parentNode;
        if (item && item.classList) item.classList.add('gm-fixed');
        btn.textContent = '已订正';
        toast({ type: 'ok', text: '订正完成，继续加油' });
        bumpWrongChip(-1);
      } else {
        btn.removeAttribute('disabled');
        toast({ type: 'warn', text: '这道题已经订正过了' });
      }
    }).catch(function (e) {
      btn.removeAttribute('disabled');
      toast({ type: 'err', text: '订正失败：' + (e && e.message ? e.message : '未知错误') });
    });
  }

  function init() {
    injectStyle();
    ensureLevel();

    qsa('[data-play]').forEach(function (btn) {
      on(btn, 'click', function (e) {
        if (e && e.preventDefault) e.preventDefault();
        if (e && e.stopPropagation) e.stopPropagation();
        play(btn.getAttribute('data-play'));
      });
    });

    qsa('.game-card[data-game]').forEach(function (card) {
      on(card, 'click', function (e) {
        var t = e && e.target;
        if (t && t.closest && t.closest('[data-play]')) return;
        play(card.getAttribute('data-game'));
      });
    });

    var sel = qs('#games-domain');
    if (sel) {
      S.domain = sel.value || 'all';
      on(sel, 'change', function () {
        S.domain = sel.value || 'all';
        toast({ type: 'info', text: '领域已切换，下一局按新的领域出题' });
      });
    }

    qsa('[data-fix]').forEach(function (btn) {
      on(btn, 'click', function () { fixWrong(btn); });
    });

    if (W.addEventListener) W.addEventListener('beforeunload', function () { leave(); });
  }

  W.AIQGames = {
    version: '1.0.0',
    play: play,
    leave: leave,
    state: S,
    timerSeconds: timerSeconds
  };

  var started = false;
  function boot() { if (started) return; started = true; init(); }

  if (W.AIQ && typeof W.AIQ.ready === 'function') {
    W.AIQ.ready(boot);
    setTimeout(boot, 2000);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
