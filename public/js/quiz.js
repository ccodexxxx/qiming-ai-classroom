/*!
 * 启明 AI 课堂 · 通用答题组件（客户端）
 * public/js/quiz.js —— 暴露 window.AIQQuiz，供练习中心与知识点页共用
 *
 * 用法：
 *   var comp = AIQQuiz.render(hostEl, {
 *     questions: [{ id, topicId, q, options:[..], answer, explain }],
 *     title: '知识闯关',
 *     timed: 'none' | 秒数,
 *     onAnswer: function (info) { ... },   // { question, index, correct, mine, score }
 *                                          // 可以返回 Promise<string>，resolve 的文字会作为点评追加显示
 *     onFinish: function (result) { ... }, // { score, correct, total, accuracy, stars, maxCombo, wrongList }
 *     onExit:   function () { ... }        // 可选：结算卡上的「返回」按钮
 *   });
 *   comp.destroy();   // 清理定时器与键盘监听
 *
 * 另外：页面上若存在 <div id="topic-quiz" data-topic="知识点id">，组件会自动取题并上报。
 * 经典脚本（非 ES module）、零依赖；window.AIQ 缺失时自带降级实现。
 */
(function () {
  'use strict';

  var W = window;
  var NL = String.fromCharCode(10);

  /* ---------------------------- 工具层 ---------------------------- */

  function aiq() { return W.AIQ || null; }

  function qs(sel, root) {
    var a = aiq();
    if (a && typeof a.qs === 'function') return a.qs(sel, root);
    return (root || document).querySelector(sel);
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

  /* 组件自用样式：与 games.js 共用同一个 <style id="games-style">，先到先得 */
  var CSS = [
    '.gm-wrap{display:flex;flex-direction:column;gap:14px}',
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
    '.gm-stars{display:flex;gap:6px;justify-content:center;font-size:32px;line-height:1;color:#d8ded9;letter-spacing:2px}',
    '.gm-stars i{font-style:normal}',
    '.gm-stars i.on{color:#e8a33d}',
    '.gm-score{text-align:center;font-size:44px;font-weight:800;color:#1f6f5c;line-height:1.15}',
    '.gm-score small{font-size:14px;color:#6b7a74;font-weight:600;margin-left:6px}',
    '.gm-list{display:flex;flex-direction:column;gap:9px}',
    '.gm-item{border:1px solid rgba(31,111,92,.16);border-radius:12px;padding:11px 13px;background:#fff}',
    '.gm-item b{display:block;margin-bottom:3px;color:#22312c}',
    '.gm-item small{display:block;color:#6b7a74;font-size:12.5px;line-height:1.7}',
    '.gm-note{font-size:12.5px;color:#78877f;line-height:1.8}',
    '.gm-toasts{position:fixed;right:16px;bottom:16px;z-index:9999;display:flex;flex-direction:column;gap:8px}',
    '.gm-toast{background:#fff;border:1px solid rgba(31,111,92,.24);border-left:4px solid #2f8f6b;border-radius:12px;padding:10px 13px;box-shadow:0 8px 24px rgba(20,40,35,.14);font-size:13px;color:#3c4a45;max-width:320px}',
    '.gm-toast b{display:block;color:#1f6f5c}'
  ].join(NL);

  /* quiz.js 与 games.js 共用同一个 <style id="games-style">：各自往里追加自己的规则 */
  var STYLE_MARK = 'aq-quiz';
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

  function toast(opt) {
    if (typeof opt === 'string') opt = { text: opt };
    var a = aiq();
    if (a && typeof a.toast === 'function') { a.toast(opt); return; }
    var box = document.getElementById('gm-toasts');
    if (!box) { box = el('div', { class: 'gm-toasts', id: 'gm-toasts' }); document.body.appendChild(box); }
    var t = el('div', { class: 'gm-toast' }, [opt.title ? el('b', { text: opt.title }) : null, el('span', { text: opt.text || '' })]);
    box.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3200);
  }

  /* ---------------------------- 题目归一化 ---------------------------- */

  function normalize(list) {
    var out = [];
    (list || []).forEach(function (q) {
      if (!q || !q.q || !q.options || q.options.length < 2) return;
      var ans = Number(q.answer);
      if (isNaN(ans) || ans < 0 || ans >= q.options.length) return;
      out.push({
        id: q.id || ('q' + out.length),
        topicId: q.topicId || null,
        topicTitle: q.topicTitle || '',
        q: String(q.q),
        options: q.options.map(String),
        answer: ans,
        explain: q.explain ? String(q.explain) : '',
        difficulty: Number(q.difficulty) || 2
      });
    });
    return out;
  }

  function starsOf(acc) { return acc >= 0.9 ? 3 : acc >= 0.6 ? 2 : acc > 0 ? 1 : 0; }

  function starRow(n) {
    var box = el('div', { class: 'gm-stars', 'aria-label': '获得 ' + n + ' 颗星' });
    for (var i = 1; i <= 3; i++) box.appendChild(el('i', { class: i <= n ? 'on' : '', text: i <= n ? '★' : '☆' }));
    return box;
  }

  /* ---------------------------- 主渲染 ---------------------------- */

  function render(host, opt) {
    opt = opt || {};
    injectStyle();

    var st = {
      list: normalize(opt.questions),
      idx: 0, score: 0, combo: 0, maxCombo: 0, correct: 0, wrongList: [],
      answered: false, remain: 0, limit: 0, tick: null, keys: null, done: false, destroyed: false
    };
    var ui = {};
    var timed = opt.timed === 'none' || opt.timed === 0 || opt.timed === undefined ? 0 : Number(opt.timed);

    if (!st.list.length) {
      clear(host);
      host.appendChild(el('div', { class: 'panel' }, [
        el('h3', { text: '暂时没有题目' }),
        el('p', { class: 'muted small', text: '换一个知识点或稍后再试。' })
      ]));
      return { destroy: function () {} };
    }

    function stopTick() { if (st.tick) { clearInterval(st.tick); st.tick = null; } }

    function hud() {
      var top = el('div', { class: 'gm-hud-top' });
      var chips = {};
      function chip(key, label) {
        var b = el('b', { text: '0' });
        chips[key] = b;
        top.appendChild(el('span', { class: 'chip' }, [el('span', { text: label }), b]));
      }
      chip('prog', '题目 ');
      chip('score', '得分 ');
      chip('combo', '连击 ');
      if (timed) chip('time', '剩余 ');
      var progI = el('i', { style: { width: '0%' } });
      var timeI = el('i', { style: { width: '0%' } });
      var timeRow = el('div', { class: 'gm-barline gm-timer' }, [el('span', { text: '计时' }), el('div', { class: 'gm-bar' }, [timeI])]);
      var node = el('div', { class: 'gm-hud' }, [
        top,
        el('div', { class: 'gm-barline' }, [el('span', { text: '进度' }), el('div', { class: 'gm-bar' }, [progI])]),
        timed ? timeRow : null
      ]);
      ui.chips = chips;
      ui.progI = progI;
      ui.timeI = timeI;
      return node;
    }

    /* 进行中 */
    function buildPlay() {
      clear(host);
      ui.qBox = el('div', { class: 'panel' });
      ui.fbBox = el('div', { class: 'gm-fb', 'aria-live': 'polite' });
      host.appendChild(el('div', { class: 'gm-wrap' }, [
        hud(),
        el('div', { class: 'panel' }, [
          el('h3', { text: opt.title || '练习' }),
          ui.qBox,
          ui.fbBox
        ]),
        el('div', { class: 'btn-row' }, [
          el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '退出练习', onclick: exitNow })
        ])
      ]));
    }

    function setChip(k, v) { if (ui.chips && ui.chips[k]) ui.chips[k].textContent = String(v); }

    function showQuestion() {
      var q = st.list[st.idx];
      st.answered = false;
      clear(ui.qBox);
      clear(ui.fbBox);
      ui.fbBox.className = 'gm-fb';
      ui.qBox.appendChild(el('p', { class: 'gm-q', text: q.q }));
      ui.optWrap = el('div', { class: 'gm-opts' });
      q.options.forEach(function (text, i) {
        var btn = el('button', {
          class: 'gm-opt', type: 'button', 'aria-label': '选项 ' + (i + 1) + '：' + text
        }, [
          el('span', { class: 'k', text: String(i + 1) }),
          el('span', { text: text })
        ]);
        btn.addEventListener('click', function () { answer(i, false); });
        ui.optWrap.appendChild(btn);
      });
      ui.qBox.appendChild(ui.optWrap);
      setChip('prog', (st.idx + 1) + '/' + st.list.length);
      ui.progI.style.width = (st.idx / st.list.length * 100) + '%';
      startTick();
    }

    function startTick() {
      stopTick();
      if (!timed) return;
      st.limit = timed;
      st.remain = timed;
      ui.timeI.style.width = '100%';
      setChip('time', timed + 's');
      st.tick = setInterval(function () {
        st.remain = st.remain - 0.1;
        if (st.remain <= 0) {
          st.remain = 0;
          ui.timeI.style.width = '0%';
          setChip('time', '0s');
          stopTick();
          answer(-1, true);
          return;
        }
        ui.timeI.style.width = (st.remain / st.limit * 100) + '%';
        setChip('time', Math.ceil(st.remain) + 's');
      }, 100);
    }

    function answer(i, byTimeout) {
      if (st.answered || st.done) return;
      st.answered = true;
      stopTick();
      var q = st.list[st.idx];
      var ok = !byTimeout && i === q.answer;
      var nodes = ui.optWrap.childNodes;
      for (var n = 0; n < nodes.length; n++) {
        var b = nodes[n];
        b.setAttribute('disabled', '');
        if (n === q.answer) b.className = 'gm-opt ok';
        if (!byTimeout && n === i && i !== q.answer) b.className = 'gm-opt no';
      }
      var mine = byTimeout ? '超时未作答' : q.options[i];
      var gain = 0;
      if (ok) {
        st.combo += 1;
        if (st.combo > st.maxCombo) st.maxCombo = st.combo;
        st.correct += 1;
        var tb = timed ? Math.round(40 * (st.remain / st.limit)) : 20;
        gain = 100 + Math.min(st.combo, 5) * 20 + tb;
        st.score += gain;
        setChip('score', st.score);
        setChip('combo', st.combo);
        ui.fbBox.className = 'gm-fb ok';
        append(clear(ui.fbBox), [
          el('b', { text: (st.combo > 1 ? '连击 x' + st.combo + '！' : '答对啦！') + ' 本题 +' + gain + ' 分' }),
          el('p', { class: 'small', text: '基础 100 分，时间奖励 +' + tb + '，连击奖励 +' + (Math.min(st.combo, 5) * 20) + '。' }),
          q.explain ? el('p', { class: 'small muted', text: '解析：' + q.explain }) : null
        ]);
      } else {
        st.combo = 0;
        setChip('combo', 0);
        st.wrongList.push({ question: q, mine: mine, answer: q.options[q.answer], explain: q.explain });
        ui.fbBox.className = 'gm-fb no';
        append(clear(ui.fbBox), [
          el('b', { text: byTimeout ? '时间到，本题算未作答' : '答错了，没关系' }),
          el('p', { class: 'small', text: '正确答案：' + q.options[q.answer] }),
          q.explain ? el('p', { class: 'small muted', text: '解析：' + q.explain }) : null
        ]);
      }
      var info = { question: q, index: i, correct: ok, mine: mine, score: st.score, gain: gain };
      var out = null;
      if (typeof opt.onAnswer === 'function') {
        try { out = opt.onAnswer(info); } catch (e) { out = null; }
      }
      if (out && typeof out.then === 'function') {
        out.then(function (extra) {
          if (extra && ui.fbBox && ui.fbBox.parentNode) ui.fbBox.appendChild(el('p', { class: 'small', text: String(extra) }));
        }).catch(function () {});
      } else if (typeof out === 'string' && out && ui.fbBox) {
        ui.fbBox.appendChild(el('p', { class: 'small', text: out }));
      }
      var last = st.idx + 1 >= st.list.length;
      var next = el('button', {
        class: 'btn btn-primary btn-sm', type: 'button', text: last ? '查看成绩' : '下一题',
        onclick: go
      });
      ui.fbBox.appendChild(el('div', { class: 'btn-row' }, [next]));
      if (next.focus) { try { next.focus(); } catch (e) {} }
    }

    function go() {
      if (!st.answered) return;
      if (st.idx + 1 < st.list.length) {
        st.idx += 1;
        showQuestion();
      } else {
        finish();
      }
    }

    function finish() {
      st.done = true;
      stopTick();
      detachKeys();
      var total = st.list.length;
      var acc = total ? st.correct / total : 0;
      var stars = starsOf(acc);
      var result = {
        score: st.score, correct: st.correct, total: total,
        accuracy: Math.round(acc * 100), stars: stars,
        maxCombo: st.maxCombo, wrongList: st.wrongList.slice()
      };
      renderResult(result);
      if (typeof opt.onFinish === 'function') { try { opt.onFinish(result); } catch (e) {} }
    }

    function renderResult(result) {
      var review = el('div', { class: 'gm-list' });
      if (result.wrongList.length) {
        result.wrongList.forEach(function (w) {
          review.appendChild(el('div', { class: 'gm-item' }, [
            el('b', { text: w.question.q }),
            el('small', { text: '你的答案：' + w.mine + '　正确答案：' + w.answer }),
            w.explain ? el('small', { text: '解析：' + w.explain }) : null
          ]));
        });
      } else {
        review.appendChild(el('div', { class: 'gm-item' }, [
          el('b', { text: '全部答对，没有错题 🎉' }),
          el('small', { text: '可以试试提高速度，或者去练习中心挑战带计时的闯关。' })
        ]));
      }
      var actions = el('div', { class: 'btn-row' }, [
        el('button', { class: 'btn btn-primary', type: 'button', text: '再来一局', onclick: restart }),
        typeof opt.onExit === 'function' ? el('button', { class: 'btn btn-ghost', type: 'button', text: '返回', onclick: exitNow }) : null
      ]);
      clear(host);
      host.appendChild(el('div', { class: 'gm-wrap' }, [
        el('div', { class: 'panel' }, [
          el('h3', { text: (opt.title || '练习') + ' · 本局成绩' }),
          starRow(result.stars),
          el('div', { class: 'gm-score' }, [el('span', { text: String(result.score) }), el('small', { text: '分' })]),
          el('p', { class: 'muted small', text: '正确率 ' + result.accuracy + '%　·　答对 ' + result.correct + '/' + result.total + '　·　最高连击 x' + result.maxCombo }),
          actions
        ]),
        el('div', { class: 'panel' }, [el('h3', { text: '错题回顾' }), review])
      ]));
    }

    function restart() {
      st.idx = 0; st.score = 0; st.combo = 0; st.maxCombo = 0; st.correct = 0;
      st.wrongList = []; st.done = false; st.answered = false;
      buildPlay();
      showQuestion();
      attachKeys();
    }

    function exitNow() {
      stopTick();
      detachKeys();
      if (typeof opt.onExit === 'function') opt.onExit();
      else clear(host);
    }

    function onKey(e) {
      if (st.done) return;
      var t = e.target || {};
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      var k = e.key;
      if (!st.answered && k >= '1' && k <= '4') {
        var i = Number(k) - 1;
        if (i < st.list[st.idx].options.length) {
          if (e.preventDefault) e.preventDefault();
          answer(i, false);
        }
        return;
      }
      if (st.answered && (k === 'Enter' || k === ' ' || k === 'Spacebar')) {
        if (e.preventDefault) e.preventDefault();
        go();
      }
    }

    function attachKeys() {
      if (st.keys) return;
      st.keys = onKey;
      document.addEventListener('keydown', st.keys);
    }

    function detachKeys() {
      if (!st.keys) return;
      document.removeEventListener('keydown', st.keys);
      st.keys = null;
    }

    buildPlay();
    showQuestion();
    attachKeys();

    return {
      destroy: function () {
        st.destroyed = true;
        stopTick();
        detachKeys();
        clear(host);
      },
      state: st
    };
  }

  /* ---------------------------- 知识点页自动挂载 ---------------------------- */

  function postAnswer(info, topicId, title) {
    var q = info.question;
    return api('/api/answer', {
      method: 'POST',
      body: {
        topicId: q.topicId || topicId || null,
        question: q.q,
        options: q.options,
        answer: q.options[q.answer],
        mine: info.mine,
        correct: info.correct,
        explain: q.explain || '',
        score: info.score,
        mode: 'quiz',
        title: title || '随堂练习'
      }
    }).then(function (res) { return res && res.feedback ? res.feedback : ''; }).catch(function () { return ''; });
  }

  function autoMount() {
    var box = qs('#topic-quiz');
    if (!box || box.getAttribute('data-quiz-ready') === '1') return;
    var topicId = box.getAttribute('data-topic');
    if (!topicId) return;
    box.setAttribute('data-quiz-ready', '1');
    var title = box.getAttribute('data-title') || '随堂练习';
    var count = Number(box.getAttribute('data-count')) || 4;
    box.appendChild(el('p', { class: 'gm-note', text: '题目加载中…' }));
    api('/api/quiz?topic=' + encodeURIComponent(topicId) + '&count=' + count).then(function (res) {
      var list = (res && res.questions) || [];
      clear(box);
      if (!list.length) {
        box.appendChild(el('p', { class: 'notice', text: '这个知识点暂时没有练习题。' }));
        return;
      }
      render(box, {
        questions: list,
        title: title,
        timed: 'none',
        onAnswer: function (info) { return postAnswer(info, topicId, title); }
      });
    }).catch(function (e) {
      clear(box);
      box.appendChild(el('p', { class: 'notice', text: '题目加载失败：' + (e && e.message ? e.message : '未知错误') }));
    });
  }

  /* ---------------------------- 导出与启动 ---------------------------- */

  W.AIQQuiz = {
    version: '1.0.0',
    render: render,
    normalize: normalize,
    starsOf: starsOf,
    postAnswer: postAnswer,
    autoMount: autoMount
  };

  function start() {
    injectStyle();
    autoMount();
    var a = aiq();
    if (a && typeof a.on === 'function' && document.body) {
      /* 页面内可能出现动态插入的知识点练习容器 */
      a.on(document.body, 'aiq:refresh-quiz', autoMount);
    }
  }

  var started = false;
  function boot() { if (started) return; started = true; start(); }

  if (W.AIQ && typeof W.AIQ.ready === 'function') {
    W.AIQ.ready(boot);
    setTimeout(boot, 2000);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
