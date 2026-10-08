/*!
 * chat.js —— AI 课堂对话客户端
 * 通过 SSE 与服务端教学引擎流式对话；支持知识点跳转、内联练习、现场生成动画与绘本。
 */
(function (global) {
  'use strict';
  var AIQ = global.AIQ;
  if (!AIQ) return;

  var el = AIQ.el, qs = AIQ.qs, api = AIQ.api;

  function init() {
    var log = qs('#chat-log');
    var form = qs('#chat-form');
    var input = qs('#chat-input');
    if (!log || !form || !input) return;

    var sendBtn = qs('#chat-send');
    var gradeSelect = qs('#chat-grade');
    var starters = qs('#chat-starters');
    var busy = false;
    var lastTopicId = null;
    var disposes = [];

    /* ---------------- 渲染 ---------------- */
    function bubble(role, html) {
      var wrap = el('div', { class: 'msg' + (role === 'user' ? ' is-user' : '') });
      wrap.appendChild(el('div', { class: 'msg-face', text: role === 'user' ? (AIQ.state.student && AIQ.state.student.avatar || '🙂') : '🧑‍🏫' }));
      var body = el('div', { class: 'msg-body' });
      if (html !== undefined) body.innerHTML = html;
      wrap.appendChild(body);
      log.appendChild(wrap);
      scroll();
      return body;
    }
    function scroll() { log.scrollTop = log.scrollHeight; }

    function addTools(body, actions, topicId, plainText) {
      if (!actions || !actions.length) return;
      var row = el('div', { class: 'msg-tools' });
      actions.forEach(function (a) {
        row.appendChild(el('button', {
          class: 'msg-tool', type: 'button', text: (a.icon ? a.icon + ' ' : '') + a.label,
          onclick: function () { runAction(a); }
        }));
      });
      if (plainText) {
        row.appendChild(el('button', { class: 'msg-tool', type: 'button', text: '🔊 朗读', onclick: function () { AIQ.speak(plainText); } }));
      }
      body.appendChild(row);
    }

    /* ---------------- 发送与流式接收 ---------------- */
    function send(text) {
      text = String(text || '').trim();
      if (!text || busy) return;
      busy = true;
      if (sendBtn) sendBtn.disabled = true;
      input.value = '';
      autoGrow();
      if (starters) starters.style.display = 'none';
      bubble('user', AIQ.markdown(text));

      var body = bubble('assistant', '');
      body.appendChild(el('span', { class: 'typing' }, [el('i'), el('i'), el('i')]));

      var full = '';
      var topicId = null;
      var topicTitle = null;
      var actions = [];
      var wrote = false;

      function paint() {
        if (!wrote) { AIQ.clear(body); wrote = true; }
        body.innerHTML = AIQ.markdown(full);
        scroll();
      }

      function finish() {
        AIQ.clear(body);
        body.innerHTML = AIQ.markdown(full);
        if (topicTitle) {
          body.insertBefore(el('div', { class: 'small muted', style: { marginBottom: '6px' }, text: '📚 知识点：' + topicTitle }), body.firstChild);
        }
        addTools(body, actions, topicId, full);
        AIQ.speak(full.slice(0, 80));
        busy = false;
        if (sendBtn) sendBtn.disabled = false;
        scroll();
      }

      function handleEvent(chunk) {
        var line = null;
        chunk.split('\n').forEach(function (l) { if (!line && l.indexOf('data:') === 0) line = l; });
        if (!line) return;
        var payload;
        try { payload = JSON.parse(line.slice(5).trim()); } catch (e) { return; }
        if (payload.type === 'meta') {
          topicId = payload.topicId || null;
          topicTitle = payload.topicTitle || null;
          actions = payload.actions || [];
          if (topicId) lastTopicId = topicId;
          body.dataset.topic = topicId || '';
        } else if (payload.type === 'delta') {
          full += payload.text || '';
          paint();
        } else if (payload.type === 'llm-start') {
          body.insertBefore(el('span', { class: 'chip chip-tiny', text: '大模型生成中' }), body.firstChild);
        } else if (payload.type === 'llm-failed') {
          AIQ.toast({ type: 'warn', title: '已回退本地引擎', text: String(payload.reason || '').slice(0, 60) });
        }
      }

      fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      }).then(function (res) {
        if (!res.ok || !res.body) throw new Error('服务端返回 ' + res.status);
        var reader = res.body.getReader();
        var decoder = new TextDecoder('utf-8');
        var buf = '';
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) { finish(); return; }
            buf += decoder.decode(r.value, { stream: true });
            var parts = buf.split('\n\n');
            buf = parts.pop();
            parts.forEach(handleEvent);
            return pump();
          });
        }
        return pump();
      }).catch(function (err) {
        AIQ.clear(body);
        body.appendChild(el('p', { text: '抱歉，连接出错了：' + err.message }));
        busy = false;
        if (sendBtn) sendBtn.disabled = false;
      });
    }

    /* ---------------- 动作分发 ---------------- */
    function runAction(a) {
      if (!a) return;
      if (a.action === 'ask') { send(a.payload); return; }
      if (a.action === 'topic') { location.href = '/topic/' + a.payload; return; }
      if (a.action === 'goto') { location.href = a.payload; return; }
      if (a.action === 'quiz') { startInlineQuiz(a.payload); return; }
      send(String(a.payload || a.label || ''));
    }

    /* ---------------- 内联练习 ---------------- */
    function startInlineQuiz(topicId) {
      var url = '/api/quiz' + (topicId ? ('?topic=' + encodeURIComponent(topicId) + '&count=3') : '?count=3');
      api(url).then(function (data) {
        var qs_ = data.questions || [];
        if (!qs_.length) { AIQ.toast({ type: 'warn', text: '暂时没有可用题目' }); return; }
        renderQuizCard(qs_[0], 0, qs_, topicId);
      }).catch(function (e) { AIQ.toast({ type: 'err', text: e.message }); });
    }

    function renderQuizCard(q, index, all, topicId) {
      var body = bubble('assistant', '');
      var card = el('div', { class: 'inline-quiz' }, [
        el('div', { class: 'quiz-head' }, [
          el('b', { text: '第 ' + (index + 1) + ' / ' + all.length + ' 题' }),
          el('span', { text: '答对 +8 经验' })
        ]),
        el('p', { style: { margin: '8px 0 0', fontSize: '15.5px' }, text: q.q })
      ]);
      var options = el('div', { class: 'quiz-options' });
      var answered = false;
      q.options.forEach(function (opt, i) {
        var btn = el('button', {
          class: 'quiz-option', type: 'button',
          onclick: function () {
            if (answered) return;
            answered = true;
            var mine = i === q.answer;
            AIQ.qsa('.quiz-option', options).forEach(function (x, k) {
              x.disabled = true;
              if (k === q.answer) x.classList.add('is-correct');
            });
            if (!mine) btn.classList.add('is-wrong');
            api('/api/answer', {
              method: 'POST',
              body: {
                topicId: q.topicId || topicId,
                question: q.q,
                answer: q.options[q.answer],
                mine: opt,
                correct: mine,
                explain: q.explain,
                score: mine ? 100 : 0,
                title: '对话内练习'
              }
            }).then(function (r) {
              card.appendChild(el('div', { class: 'quiz-explain ' + (mine ? 'is-ok' : 'is-bad') }, [
                el('b', { text: mine ? '✅ 答对了' : '❌ 再想一想' }),
                el('p', { style: { margin: '6px 0 0' }, text: r.explain || q.explain }),
                el('p', { class: 'small muted', style: { margin: '6px 0 0' }, text: r.feedback })
              ]));
              var next = all[index + 1];
              var row = el('div', { class: 'btn-row', style: { marginTop: '10px' } });
              if (next) {
                row.appendChild(el('button', { class: 'btn btn-primary btn-sm', type: 'button', text: '下一题', onclick: function () { renderQuizCard(next, index + 1, all, topicId); } }));
              } else {
                row.appendChild(el('a', { class: 'btn btn-primary btn-sm', href: '/games', text: '去练习中心做更多' }));
              }
              row.appendChild(el('button', {
                class: 'btn btn-ghost btn-sm', type: 'button', text: '换个话题继续问',
                onclick: function () { input.focus(); }
              }));
              card.appendChild(row);
              scroll();
            }).catch(function (e) {
              AIQ.toast({ type: 'err', text: '上报失败：' + e.message });
            });
          }
        }, [
          el('span', { class: 'key', text: 'ABCD'[i] || String(i + 1) }),
          el('span', { text: opt })
        ]);
        options.appendChild(el('button', { class: 'quiz-option', type: 'button', disabled: true, style: { display: 'none' } }) && btn);
      });
      card.appendChild(options);
      card.appendChild(el('p', { class: 'small muted', style: { marginTop: '8px' }, text: '提示：键盘 1 / 2 / 3 / 4 也可以作答。' }));
      body.appendChild(card);
      scroll();

      function onKey(e) {
        if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
        if (!/^[1-4]$/.test(e.key)) return;
        var open = AIQ.qsa('.quiz-option:not([disabled])', options);
        if (open[Number(e.key) - 1]) open[Number(e.key) - 1].click();
      }
      document.addEventListener('keydown', onKey);
      disposes.push(function () { document.removeEventListener('keydown', onKey); });
    }

    /* ---------------- 输入区 ---------------- */
    function autoGrow() {
      input.style.height = 'auto';
      input.style.height = Math.min(150, Math.max(48, input.scrollHeight)) + 'px';
    }
    AIQ.on(input, 'input', autoGrow);
    AIQ.on(input, 'keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input.value); }
    });
    AIQ.on(form, 'submit', function (e) { e.preventDefault(); send(input.value); });
    if (sendBtn) AIQ.on(sendBtn, 'click', function (e) { e.preventDefault(); send(input.value); });

    AIQ.qsa('.starter').forEach(function (btn) {
      AIQ.on(btn, 'click', function () {
        var ask = btn.dataset.ask || btn.textContent;
        send(ask);
      });
    });

    AIQ.on(qs('#chat-clear'), 'click', function () {
      AIQ.clear(log);
      greet();
      if (starters) starters.style.display = '';
    });

    if (gradeSelect) {
      AIQ.on(gradeSelect, 'change', function () {
        api('/api/student', { method: 'POST', body: { grade: Number(gradeSelect.value) } }).then(function (r) {
          AIQ.state.student = r.student;
          AIQ.state.level = r.level;
          var mode = qs('#chat-mode');
          if (mode) mode.textContent = r.level.name + '模式 · 深度 ' + r.level.depth + '/4 · ' + ((AIQ.state.llm && AIQ.state.llm.active) ? '大模型生成' : '本地教学引擎');
          AIQ.toast({ type: 'ok', text: '已切换到 ' + r.level.name + '，讲解深度会随之变化' });
        }).catch(function (e) { AIQ.toast({ type: 'err', text: e.message }); });
      });
    }

    /* ---------------- 开场 ---------------- */
    function greet() {
      var lv = AIQ.state.level || { name: '小学高年级', depth: 2 };
      var name = (AIQ.state.student && AIQ.state.student.name) || '同学';
      var recs = [];
      bubble('assistant', AIQ.markdown(
        '**你好，' + name + '！我是启明老师** 🧑‍🏫\n\n' +
        '你的学段是 **' + lv.name + '**，所以我会用这个年龄听得懂的方式讲。\n\n' +
        '直接问我问题就行，也可以点下面的按钮。听不懂就说「听不懂」，我会换一种更简单的说法。'
      ));
    }

    /* ---------------- 首次进入 ---------------- */
    var initialAsk = global.__INITIAL_ASK__;
    // 历史对话
    var history = (AIQ.state.chat || []).slice(-8);
    if (history.length) {
      history.forEach(function (m) {
        bubble(m.role === 'user' ? 'user' : 'assistant', AIQ.markdown(m.text || ''));
      });
      bubble('assistant', AIQ.markdown('我们继续吧。有什么想接着问的？'));
    } else {
      greet();
    }
    if (initialAsk) {
      setTimeout(function () { send(initialAsk); }, 260);
    }
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 300);
  }

  AIQ.ready(init);
})(window);
