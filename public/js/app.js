/*!
 * app.js —— 站点通用客户端脚本
 * 提供：DOM 工具、API 封装、提示与弹窗、Markdown 轻量渲染、设置面板、导航、学习画像
 * 暴露 window.AIQ 供各页面脚本使用（经典脚本，零依赖）。
 */
(function (global) {
  'use strict';

  var AIQ = global.AIQ || (global.AIQ = {});
  AIQ.state = { student: null, level: null, llm: null };
  AIQ._ready = [];
  AIQ._readyFired = false;

  /* ---------------- DOM 工具 ---------------- */
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /**
   * 创建元素
   * el('div', { class:'a', text:'内容', onclick: fn, style:{color:'red'}, dataset:{id:1} }, [子节点或字符串])
   */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class' || k === 'className') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k === 'dataset' && typeof v === 'object') Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
        else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, v);
      });
    }
    append(node, children);
    return node;
  }
  function append(node, children) {
    if (children === null || children === undefined) return node;
    (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return node;
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function on(target, type, fn) { target.addEventListener(type, fn); return function () { target.removeEventListener(type, fn); }; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function fmtTime(ts) {
    var d = new Date(ts), p = function (n) { return n < 10 ? '0' + n : String(n); };
    return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function uid(p) { return (p || 'id') + Math.random().toString(36).slice(2, 9); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ---------------- API ---------------- */
  function api(path, opt) {
    opt = opt || {};
    var init = { method: opt.method || 'GET', headers: { 'Content-Type': 'application/json' } };
    if (opt.body !== undefined) init.body = JSON.stringify(opt.body);
    return fetch(path, init).then(function (res) {
      var ct = res.headers.get('content-type') || '';
      var parse = ct.indexOf('application/json') >= 0 ? res.json() : res.text().then(function (t) { return { text: t }; });
      return parse.then(function (data) {
        if (!res.ok) {
          var msg = (data && data.error) || ('请求失败（' + res.status + '）');
          var err = new Error(msg);
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  /* ---------------- 提示与弹窗 ---------------- */
  function toast(opt) {
    if (typeof opt === 'string') opt = { text: opt };
    var stack = qs('#toasts');
    if (!stack) { stack = el('div', { class: 'toast-stack', id: 'toasts' }); document.body.appendChild(stack); }
    var node = el('div', { class: 'toast toast-' + (opt.type || 'ok') }, [
      opt.title ? el('b', { text: opt.title }) : null,
      el('span', { text: opt.text || '' })
    ]);
    stack.appendChild(node);
    setTimeout(function () { node.classList.add('is-in'); }, 10);
    setTimeout(function () {
      node.classList.remove('is-in');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 320);
    }, opt.duration || 3000);
    return node;
  }

  function modal(opt) {
    var mask = el('div', { class: 'modal-mask' });
    function close() {
      if (mask.parentNode) mask.parentNode.removeChild(mask);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    var card = el('div', { class: 'modal' + (opt.size ? ' is-' + opt.size : '') }, [
      el('div', { class: 'modal-head' }, [
        el('h3', { text: opt.title || '' }),
        el('button', { class: 'icon-btn', type: 'button', text: '✕', 'aria-label': '关闭', onclick: close })
      ]),
      el('div', { class: 'modal-body' }, opt.body ? [opt.body] : []),
      opt.footer ? el('div', { class: 'modal-foot' }, opt.footer) : null
    ]);
    mask.appendChild(card);
    mask.addEventListener('mousedown', function (e) { if (e.target === mask && opt.dismissable !== false) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(mask);
    setTimeout(function () { card.classList.add('is-in'); }, 10);
    return { close: close, card: card };
  }

  function confirmDialog(message, onOk) {
    var m = modal({
      title: '请确认', size: 'sm',
      body: el('p', { text: message }),
      footer: [
        el('button', { class: 'btn btn-ghost', type: 'button', text: '取消', onclick: function () { m.close(); } }),
        el('button', { class: 'btn btn-primary', type: 'button', text: '确定', onclick: function () { m.close(); if (onOk) onOk(); } })
      ]
    });
    return m;
  }

  /* ---------------- Markdown 轻量渲染 ---------------- */
  function markdown(src) {
    var lines = String(src || '').split(/\r?\n/);
    var out = [], inList = false, inCode = false, buf = [];
    function closeList() { if (inList) { out.push('</ul>'); inList = false; } }
    function inline(t) {
      return esc(t)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
        .replace(/\x60([^\x60]+)\x60/g, '<code>$1</code>');
    }
    lines.forEach(function (raw) {
      var line = raw.replace(/\s+$/, '');
      if (/^\x60\x60\x60/.test(line)) {
        if (inCode) { out.push('<pre>' + esc(buf.join('\n')) + '</pre>'); buf = []; inCode = false; }
        else { closeList(); inCode = true; }
        return;
      }
      if (inCode) { buf.push(raw); return; }
      if (!line.trim()) { closeList(); return; }
      var h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) { closeList(); var lv = h[1].length + 3; out.push('<h' + lv + '>' + inline(h[2]) + '</h' + lv + '>'); return; }
      var li = line.match(/^\s*[-*]\s+(.*)$/);
      if (li) { if (!inList) { out.push('<ul>'); inList = true; } out.push('<li>' + inline(li[1]) + '</li>'); return; }
      var ol = line.match(/^\s*(\d+)[.、]\s+(.*)$/);
      if (ol) { if (!inList) { out.push('<ul>'); inList = true; } out.push('<li>' + inline(ol[2]) + '</li>'); return; }
      closeList();
      out.push('<p>' + inline(line) + '</p>');
    });
    if (inCode) out.push('<pre>' + esc(buf.join('\n')) + '</pre>');
    closeList();
    return out.join('');
  }

  /** 逐字输出（打字机），返回 { stop } */
  function typewriter(node, text, opt) {
    opt = opt || {};
    var i = 0, done = false, timer = null, plain = String(text || '');
    function finish() { done = true; node.innerHTML = markdown(plain); if (opt.onDone) opt.onDone(); }
    function step() {
      if (done) return;
      i = Math.min(plain.length, i + Math.max(1, Math.round(plain.length / 70)));
      node.innerHTML = markdown(plain.slice(0, i));
      if (i >= plain.length) { finish(); return; }
      if (opt.onTick) opt.onTick();
      timer = setTimeout(step, opt.speed || 16);
    }
    step();
    return { stop: function () { clearTimeout(timer); finish(); } };
  }

  /** 朗读（浏览器内置语音，默认关闭，可在设置里开启） */
  var speakEnabled = false;
  function speak(text) {
    if (!speakEnabled || !global.speechSynthesis) return;
    try {
      global.speechSynthesis.cancel();
      var u = new global.SpeechSynthesisUtterance(String(text).replace(/[*#>\x60]/g, '').slice(0, 200));
      u.lang = 'zh-CN';
      global.speechSynthesis.speak(u);
    } catch (e) {}
  }

  /* ---------------- 导航 ---------------- */
  function initNav() {
    var toggle = qs('#nav-toggle');
    var nav = qs('#site-nav');
    if (toggle && nav) {
      on(toggle, 'click', function () {
        var open = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
  }

  /* ---------------- 设置面板 ---------------- */
  function openSettings() {
    var mask = qs('#settings-mask');
    var body = qs('#settings-body');
    if (!mask || !body) return;
    mask.hidden = false;
    body.innerHTML = '<p class="muted">正在加载…</p>';
    api('/api/config').then(function (data) {
      renderSettings(body, data);
    }).catch(function (e) {
      body.innerHTML = '';
      body.appendChild(el('p', { class: 'muted', text: '配置读取失败：' + e.message }));
    });
    function close() { mask.hidden = true; }
    if (!mask.__bound) {
      mask.__bound = true;
      on(qs('#settings-close'), 'click', close);
      mask.addEventListener('mousedown', function (e) { if (e.target === mask) close(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !mask.hidden) close(); });
    }
  }

  function renderSettings(body, data) {
    var cfg = data.config || {};
    var status = data.status || {};
    var presets = data.presets || {};
    clear(body);

    /* 学习画像 */
    var p = AIQ.state.student || {};
    var nameInput = el('input', { type: 'text', value: p.name || '', placeholder: '你的名字或昵称', maxlength: '16' });
    var gradeSelect = el('select', {}, Array.from({ length: 12 }, function (_, i) { return i + 1; }).map(function (g) {
      return el('option', { value: g, selected: g === (p.grade || 5) }, [g + ' 年级']);
    }));
    var avatarRow = el('div', { class: 'btn-row' }, ['🌱', '🦊', '🐼', '🦉', '🐳', '🚀', '🐨', '🦄', '🐧', '🌟'].map(function (a) {
      var b = el('button', {
        type: 'button', class: 'btn btn-ghost btn-sm' + (a === (p.avatar || '🌱') ? ' btn-primary' : ''),
        text: a, onclick: function () {
          qsa('button', avatarRow).forEach(function (x) { x.classList.remove('btn-primary'); });
          b.classList.add('btn-primary');
          b.__picked = true;
          avatarRow.dataset.pick = a;
        }
      });
      if (a === (p.avatar || '🌱')) avatarRow.dataset.pick = a;
      return b;
    }));
    body.appendChild(el('div', { class: 'settings-section' }, [
      el('h3', { text: '我的学习画像' }),
      el('p', { class: 'muted small', text: '年级决定讲解深度与题目难度，随时可以改。' }),
      el('label', { class: 'field' }, [el('span', { text: '名字' }), nameInput]),
      el('label', { class: 'field' }, [el('span', { text: '年级' }), gradeSelect]),
      el('label', { class: 'field' }, [el('span', { text: '头像' }), avatarRow]),
      el('button', {
        class: 'btn btn-primary btn-sm', type: 'button', text: '保存画像',
        onclick: function () {
          api('/api/student', {
            method: 'POST',
            body: { name: nameInput.value.trim(), grade: Number(gradeSelect.value), avatar: avatarRow.dataset.pick || '🌱' }
          }).then(function (r) {
            AIQ.state.student = r.student;
            AIQ.state.level = r.level;
            toast({ type: 'ok', title: '已保存', text: '讲解将按 ' + r.level.name + ' 的标准进行' });
            setTimeout(function () { location.reload(); }, 600);
          }).catch(function (e) { toast({ type: 'err', text: e.message }); });
        }
      })
    ]));

    /* 语音 */
    var voiceSwitch = el('span', { class: 'switch' + (speakEnabled ? ' is-on' : '') }, [el('i')]);
    body.appendChild(el('div', { class: 'settings-section' }, [
      el('h3', { text: '朗读与无障碍' }),
      el('div', {
        class: 'preset-item', onclick: function () {
          speakEnabled = !speakEnabled;
          voiceSwitch.classList.toggle('is-on', speakEnabled);
          try { global.localStorage.setItem('aiq.voice', speakEnabled ? '1' : '0'); } catch (e) {}
          if (!speakEnabled && global.speechSynthesis) global.speechSynthesis.cancel();
        }
      }, [
        el('div', {}, [el('b', { text: '语音朗读' }), el('small', { text: 'AI 老师与绘本可以读出来（使用浏览器内置语音）' })]),
        el('div', { style: { marginLeft: 'auto' } }, [voiceSwitch])
      ])
    ]));

    /* 大模型 */
    var providerButtons = el('div', { class: 'preset-list' }, Object.keys(presets).map(function (key) {
      var pre = presets[key];
      return el('div', {
        class: 'preset-item' + (key === cfg.provider ? ' is-on' : ''),
        onclick: function () {
          providerSelect.value = key;
          endpointInput.value = pre.endpoint || '';
          modelInput.value = pre.model || '';
          qsa('.preset-item', providerButtons).forEach(function (x) { x.classList.remove('is-on'); });
          this.classList.add('is-on');
        }
      }, [
        el('div', {}, [el('b', { text: pre.name }), el('small', { text: pre.note || '' })])
      ]);
    }));
    var providerSelect = el('select', {}, Object.keys(presets).map(function (key) {
      return el('option', { value: key, selected: key === cfg.provider }, [presets[key].name]);
    }));
    var endpointInput = el('input', { type: 'text', value: cfg.endpoint || '', placeholder: 'https://…/v1' });
    var modelInput = el('input', { type: 'text', value: cfg.model || '', placeholder: '模型或接入点 ID' });
    var keyInput = el('input', { type: 'password', value: '', placeholder: cfg.hasKey ? '已保存（留空则不修改）' : '粘贴 API Key' });
    var testResult = el('p', { class: 'muted small', text: '' });

    body.appendChild(el('div', { class: 'settings-section' }, [
      el('h3', { text: '大模型接入（可选）' }),
      el('p', { class: 'muted small', text: '默认使用本地教学引擎，完全离线可用。接入大模型后，讲解由模型生成，但学段要求与课程片段会一并注入，风格不会跑偏；接口失败会自动回退本地引擎。' }),
      el('p', { class: 'small', text: '当前状态：' + (status.active ? ('已启用 ' + status.providerName + '（' + status.model + '）') : '本地教学引擎') }),
      providerButtons,
      el('label', { class: 'field' }, [el('span', { text: '服务类型' }), providerSelect]),
      el('label', { class: 'field' }, [el('span', { text: '接口地址（OpenAI 兼容）' }), endpointInput]),
      el('label', { class: 'field' }, [el('span', { text: '模型 / 接入点 ID' }), modelInput]),
      el('label', { class: 'field' }, [el('span', { text: 'API Key（只保存在本机 data/config.json）' }), keyInput]),
      el('div', { class: 'btn-row' }, [
        el('button', {
          class: 'btn btn-primary btn-sm', type: 'button', text: '保存并测试连接',
          onclick: function () {
            testResult.textContent = '正在测试…';
            var payload = {
              provider: providerSelect.value,
              endpoint: endpointInput.value.trim(),
              model: modelInput.value.trim()
            };
            if (keyInput.value.trim()) payload.apiKey = keyInput.value.trim();
            api('/api/config', { method: 'POST', body: payload }).then(function (r) {
              testResult.textContent = r.test.message;
              testResult.style.color = r.test.ok ? 'var(--green)' : 'var(--rose)';
              AIQ.state.llm = r.status;
            }).catch(function (e) {
              testResult.textContent = '保存失败：' + e.message;
              testResult.style.color = 'var(--rose)';
            });
          }
        }),
        testResult
      ])
    ]));

    /* 数据 */
    body.appendChild(el('div', { class: 'settings-section' }, [
      el('h3', { text: '学习数据' }),
      el('p', { class: 'muted small', text: '所有数据保存在本机服务端的 data/students/ 目录，不上传到任何第三方。' }),
      el('div', { class: 'btn-row' }, [
        el('a', { class: 'btn btn-ghost btn-sm', href: '/api/report', target: '_blank', rel: 'noopener', text: '查看学习报告' }),
        el('a', { class: 'btn btn-ghost btn-sm', href: '/api/courses', target: '_blank', rel: 'noopener', text: '查看课程数据接口' }),
        el('a', { class: 'btn btn-ghost btn-sm', href: '/api/health', target: '_blank', rel: 'noopener', text: '服务健康检查' })
      ])
    ]));
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    initNav();
    try {
      if (global.localStorage.getItem('aiq.voice') === '1') speakEnabled = true;
    } catch (e) {}
    var btn = qs('#btn-settings');
    if (btn) on(btn, 'click', openSettings);
    api('/api/session').then(function (data) {
      AIQ.state.student = data.student;
      AIQ.state.level = data.level;
      AIQ.state.llm = data.llm;
      AIQ.state.chat = data.chat || [];
      fireReady();
    }).catch(function () {
      // 会话接口失败不阻塞页面（例如静态预览）
      fireReady();
    });
  }

  function fireReady() {
    if (AIQ._readyFired) return;
    AIQ._readyFired = true;
    AIQ._ready.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    AIQ._ready = [];
  }

  function ready(fn) {
    if (AIQ._readyFired || AIQ.state.student) { try { fn(); } catch (e) { console.error(e); } return; }
    AIQ._ready.push(fn);
  }

  AIQ.qs = qs;
  AIQ.qsa = qsa;
  AIQ.el = el;
  AIQ.append = append;
  AIQ.clear = clear;
  AIQ.esc = esc;
  AIQ.on = on;
  AIQ.clamp = clamp;
  AIQ.fmtTime = fmtTime;
  AIQ.uid = uid;
  AIQ.sleep = sleep;
  AIQ.shuffle = shuffle;
  AIQ.api = api;
  AIQ.toast = toast;
  AIQ.modal = modal;
  AIQ.confirm = confirmDialog;
  AIQ.markdown = markdown;
  AIQ.typewriter = typewriter;
  AIQ.speak = speak;
  AIQ.ready = ready;
  AIQ.boot = boot;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
