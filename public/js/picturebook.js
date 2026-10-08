/*!
 * picturebook.js —— AI 启蒙绘本阅读器（低龄段）
 *
 * 面向 6～9 岁。设计要点：
 *   · 先让孩子喜欢角色，再跟着角色经历一件事；知识由角色说出来，不由旁白讲解
 *   · 每页支持自动朗读（慢速 + 夸张音调）、逐字高亮、点字听音
 *   · 互动像玩不像考：点一点 / 拖一拖 / 吹一吹 / 拍一拍 / 选一选 / 找一找 / 说一句
 *   · 反馈永远是温柔的：答对欢呼加星星，答错角色歪头说「没关系，我们再来一次」
 *   · 全程不扣分、不红灯、不出现「错误」字样
 */
(function (global) {
  'use strict';
  var AIQ = global.AIQ;
  if (!AIQ) return;
  var el = AIQ.el, qs = AIQ.qs, api = AIQ.api;

  /* ================= 状态 ================= */
  var S = {
    grade: 1, voice: false, rate: 0.9, pitch: 1.2,
    book: null, page: 0, answers: {}, stars: 0, correct: 0, total: 0,
    marks: [], acts: [], embed: false, auto: false, stage: 'library', acted: {}
  };

  /* ================= 音效（Web Audio 合成，零素材） ================= */
  var SFX = (function () {
    var ctx = null, enabled = true;
    function ac() {
      if (ctx) return ctx;
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { ctx = null; }
      return ctx;
    }
    function tone(freq, dur, type, vol, when, slideTo) {
      var c = ac();
      if (!c || !enabled) return;
      if (c.state === 'suspended') { try { c.resume(); } catch (e) {} }
      var t0 = c.currentTime + (when || 0);
      var osc = c.createOscillator(), g = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.16, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(c.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    }
    function noise(dur, vol, filtered) {
      var c = ac();
      if (!c || !enabled) return;
      var n = Math.floor(c.sampleRate * dur);
      var buf = c.createBuffer(1, n, c.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var src = c.createBufferSource(); src.buffer = buf;
      var g = c.createGain(); g.gain.value = vol || 0.1;
      if (filtered) {
        var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filtered;
        src.connect(f); f.connect(g);
      } else src.connect(g);
      g.connect(c.destination);
      src.start();
    }
    var BANK = {
      pop: function () { tone(520, 0.13, 'triangle', 0.18, 0, 880); },
      ding: function () { tone(1180, 0.28, 'sine', 0.15); tone(1770, 0.22, 'sine', 0.07, 0.02); },
      chime: function () { [880, 1174, 1568].forEach(function (f, i) { tone(f, 0.34, 'sine', 0.12, i * 0.07); }); },
      clap: function () { noise(0.09, 0.16, 1800); setTimeout(function () { noise(0.08, 0.12, 1500); }, 110); },
      whoosh: function () { noise(0.42, 0.1, 900); },
      cheer: function () { [784, 988, 1174, 1568].forEach(function (f, i) { tone(f, 0.3, 'triangle', 0.1, i * 0.08); }); },
      giggle: function () { [880, 1100, 880].forEach(function (f, i) { tone(f, 0.11, 'sine', 0.1, i * 0.1); }); },
      warm: function () { tone(523, 0.6, 'sine', 0.1); tone(659, 0.6, 'sine', 0.07, 0.04); },
      heart: function () { tone(659, 0.5, 'sine', 0.1); tone(880, 0.5, 'sine', 0.06, 0.06); },
      soft: function () { tone(392, 0.4, 'sine', 0.1); },
      page: function () { noise(0.16, 0.06, 2600); },
      star: function () { [1318, 1568, 2093].forEach(function (f, i) { tone(f, 0.26, 'sine', 0.1, i * 0.05); }); }
    };
    /* ============ 背景音乐：全部用振荡器合成，不需要任何音频素材 ============
     * 低幼动画的背景音乐要「极简、重复、可预期」——
     * 只有一条五声音阶的琶音，音量压得很低（0.05），循环播放不抢台词。
     * 用五声音阶（宫商角徵羽）是因为它没有半音冲突，怎么排列都不会难听。
     */
    var BGM = (function () {
      var timer = null, playing = false, step = 0;
      /* C 大调五声音阶：C D E G A，跨两个八度 */
      var NOTES = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 880.00, 783.99];
      /* 三种情绪配三段不同的琶音走向 */
      var MOODS = {
        gentle: { notes: [0, 2, 4, 3, 1, 3, 5, 4], gap: 620, type: 'sine', vol: 0.05 },
        bright: { notes: [0, 2, 4, 5, 6, 5, 4, 2], gap: 480, type: 'triangle', vol: 0.045 },
        calm:   { notes: [0, 1, 3, 2, 0, 3, 5, 3], gap: 760, type: 'sine', vol: 0.055 }
      };
      var cur = MOODS.gentle;
      function tick() {
        if (!playing) return;
        var n = NOTES[cur.notes[step % cur.notes.length]];
        tone(n, cur.gap / 1000 * 0.85, cur.type, cur.vol);
        /* 每四拍补一个低八度的根音，垫出「有低音」的厚度 */
        if (step % 4 === 0) tone(n / 2, cur.gap / 1000 * 1.6, 'sine', cur.vol * 0.7);
        step++;
        timer = setTimeout(tick, cur.gap);
      }
      return {
        start: function (mood) {
          if (playing) return;
          cur = MOODS[mood] || MOODS.gentle;
          var c = ac();
          if (!c || !enabled) return false;
          /* 浏览器要求「先有用户手势才能出声」。
             这里主动 resume，并把 playing 置为 true ——
             resume 是异步的，不能因为此刻还是 suspended 就放弃。 */
          if (c.state === 'suspended') { try { c.resume(); } catch (e) {} }
          playing = true; step = 0;
          tick();
          return true;
        },
        stop: function () { playing = false; if (timer) { clearTimeout(timer); timer = null; } },
        isOn: function () { return playing; },
        setMood: function (mood) { if (MOODS[mood]) cur = MOODS[mood]; }
      };
    })();

    return {
      play: function (name) { if (BANK[name]) { try { BANK[name](); } catch (e) {} } },
      setEnabled: function (on) { enabled = !!on; if (!on) BGM.stop(); },
      bgm: BGM,
      unlock: function () { var c = ac(); if (c && c.state === 'suspended') { try { c.resume(); } catch (e) {} } }
    };
  })();

  /* ================= 麦克风：吹一吹 / 拍一拍 ================= */
  var Mic = (function () {
    var stream = null, analyser = null, data = null, raf = null, running = false;
    function start(onLevel, opt) {
      if (running) return Promise.resolve(true);
      if (!global.navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return Promise.reject(new Error('这台设备不支持麦克风'));
      }
      return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (st) {
        stream = st;
        var AC = global.AudioContext || global.webkitAudioContext;
        var c = new AC();
        var src = c.createMediaStreamSource(st);
        analyser = c.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        data = new Uint8Array(analyser.fftSize);
        running = true;
        var base = 0, peak = 0;
        function tick() {
          if (!running) return;
          analyser.getByteTimeDomainData(data);
          var sum = 0;
          for (var i = 0; i < data.length; i++) { var v = (data[i] - 128) / 128; sum += v * v; }
          var rms = Math.sqrt(sum / data.length);
          base = base ? base * 0.94 + rms * 0.06 : rms;
          onLevel(rms, base);
          raf = global.requestAnimationFrame(tick);
        }
        tick();
        return true;
      });
    }
    function stop() {
      running = false;
      if (raf) { try { global.cancelAnimationFrame(raf); } catch (e) {} raf = null; }
      if (stream) { try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} stream = null; }
      analyser = null;
    }
    return { start: start, stop: stop, isRunning: function () { return running; } };
  })();

  /* ================= 语音指令 ================= */
  var ASR = (function () {
    var SR = global.SpeechRecognition || global.webkitSpeechRecognition;
    if (!SR) return null;
    try { var r = new SR(); r.lang = 'zh-CN'; r.interimResults = false; r.maxAlternatives = 1; return r; } catch (e) { return null; }
  })();

  /* ================= TTS：慢速 + 夸张音调 + 逐字高亮 ================= */
  var TTS = (function () {
    var supported = typeof global.speechSynthesis !== 'undefined' && typeof global.SpeechSynthesisUtterance !== 'undefined';
    var voice = null, cur = null, timer = null;
    function pick() {
      if (!supported) return;
      var list = global.speechSynthesis.getVoices() || [];
      if (!list.length) return;
      var cn = list.filter(function (v) { return /zh[-_]?CN/i.test(v.lang); });
      /* 低龄朗读优先挑女声 / 童声，找不到就用第一个中文 */
      voice = cn.filter(function (v) { return /female|女|Xiaoxiao|Huihui|Yaoyao|Tingting/i.test(v.name); })[0] || cn[0] || null;
    }
    if (supported) {
      pick();
      if (typeof global.speechSynthesis.addEventListener === 'function') {
        global.speechSynthesis.addEventListener('voiceschanged', pick);
      }
    }
    return {
      supported: supported,
      /** 朗读一段话，同时按字高亮 */
      speak: function (text, opt) {
        opt = opt || {};
        if (!supported) { if (opt.onEnd) opt.onEnd(); return false; }
        try { global.speechSynthesis.cancel(); } catch (e) {}
        var u = new global.SpeechSynthesisUtterance(String(text || ''));
        u.lang = 'zh-CN';
        u.rate = AIQ.clamp(opt.rate || 0.9, 0.5, 1.6);
        u.pitch = AIQ.clamp(opt.pitch || 1.2, 0.6, 2);
        if (voice) u.voice = voice;
        var words = opt.words || [];
        /* 按预估时长逐字高亮：语速越慢，每个字停留越久 */
        if (words.length) {
          var perChar = (1100 / (u.rate * 10)) * (String(text).length / Math.max(1, words.length));
          var i = 0;
          clearInterval(timer);
          timer = setInterval(function () {
            if (i >= words.length) { clearInterval(timer); timer = null; return; }
            if (words[i]) words[i].classList.add('is-reading');
            if (i > 0 && words[i - 1]) words[i - 1].classList.remove('is-reading');
            i++;
          }, Math.max(180, perChar));
        }
        u.onend = function () { cur = null; clearInterval(timer); if (opt.onEnd) opt.onEnd(); };
        u.onerror = function () { cur = null; clearInterval(timer); if (opt.onEnd) opt.onEnd(); };
        cur = u;
        global.speechSynthesis.speak(u);
        return true;
      },
      stop: function () {
        if (!supported) return;
        try { global.speechSynthesis.cancel(); } catch (e) {}
        clearInterval(timer); cur = null;
      }
    };
  })();

  /* ================= 小工具 ================= */
  function panel(children, cls) {
    return el('div', { class: 'panel' + (cls ? ' ' + cls : '') }, children);
  }
  function btn(label, onClick, opt) {
    opt = opt || {};
    return el('button', {
      class: 'pb-btn' + (opt.main ? ' is-main' : '') + (opt.cls ? ' ' + opt.cls : ''),
      type: 'button', disabled: !!opt.disabled, onclick: onClick
    }, [label]);
  }
  function stageHost() { return qs('#pb-app'); }
  function announce(type, data) {
    try {
      if (global.parent && global.parent !== global) {
        global.parent.postMessage({ source: 'aiq-picturebook', type: type, data: data || {} }, '*');
      }
      global.dispatchEvent(new CustomEvent('aiq:pb', { detail: { type: type, data: data || {} } }));
    } catch (e) {}
  }
  function params() {
    var out = {};
    try {
      ((global.location && global.location.search) || '').replace(/^\?/, '').split('&').filter(Boolean).forEach(function (kv) {
        var p = kv.split('=');
        out[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
      });
    } catch (e) {}
    return out;
  }

  /* ================= 一、绘本馆 ================= */
  function renderLibrary() {
    S.stage = 'library';
    compactHero(false);
    var host = stageHost();
    host.innerHTML = '';
    host.appendChild(panel([el('p', { class: 'muted', text: '正在把绘本摆上书架…' })]));
    api('/api/pb/library?grade=' + S.grade).then(function (data) {
      S.stories = data.stories;
      host.innerHTML = '';
      host.appendChild(el('h2', { class: 'pb-shelf-title', text: '📚 挑一本读一读' }));
      host.appendChild(el('p', { class: 'muted', text: '每一本都是一个完整的小故事。点开就能听、能玩。' }));

      /* 推荐：优先挑孩子还没读过的 */
      if (data.recommend) {
        var rec = data.recommend;
        host.appendChild(el('div', { class: 'pb-recommend' }, [
          el('span', { class: 'pb-rec-label', text: '🎁 推荐给你' }),
          el('b', { text: rec.emoji + ' 《' + rec.title + '》' }),
          el('span', { class: 'muted small', text: rec.reason }),
          btn('就读这本 →', function () { openBook(rec.id); }, { main: true, cls: 'btn-sm' })
        ]));
      }
      if (data.adapt && data.adapt.level !== 'normal') {
        host.appendChild(el('p', { class: 'pb-adapt-note', text: '💡 ' + data.adapt.reason }));
      }

      var shelf = el('div', { class: 'pb-shelf' });
      /* 被主题筛选挡住的卡片先藏起来，不重新请求 */
      function applyTheme(id) {
        S.theme = id;
        var shown = 0;
        AIQ.qsa('.pb-card', shelf).forEach(function (c) {
          var hit = id === 'all' || (c.dataset.themes || '').split(',').indexOf(id) >= 0;
          c.hidden = !hit;
          if (hit) shown++;
        });
        var empty = qs('.pb-shelf-empty');
        if (empty) empty.hidden = shown > 0;
      }
      S.applyTheme = applyTheme;
      data.stories.forEach(function (st) {
        var prog = (data.progress && data.progress.books && data.progress.books[st.id]) || null;
        var stars = prog ? prog.stars : 0;
        var done = !!(prog && prog.done);
        var card = el('button', { class: 'pb-card', type: 'button' });
        card.dataset.themes = (st.themes || []).join(',');
        card.dataset.greet = st.greet || ('你好呀，我是' + (st.cast && st.cast[0] === 'dou' ? '豆豆' : '小AI') + '！');
        card.setAttribute('aria-label', st.title + '，' + (st.ageLabel || '') + '，' + (done ? '已读完' : '还没读'));

        var coverBox = el('div', { class: 'pb-card-cover', html: st.cover });
        /* 已读角标 / 年龄标识贴在封面上 */
        coverBox.appendChild(el('span', { class: 'pb-card-age', text: st.ageLabel || '' }));
        if (done) coverBox.appendChild(el('span', { class: 'pb-card-done', text: '✔ 读过了' }));
        card.appendChild(coverBox);

        var body = el('div', { class: 'pb-card-body' }, [
          el('span', { class: 'pb-card-concept', text: st.conceptLabel }),
          el('h3', { text: st.emoji + ' ' + st.title }),
          el('p', { text: st.logline })
        ]);
        /* 进度条：读过就是满的，没读过是空的 */
        var bar = el('div', { class: 'pb-card-bar', role: 'progressbar', 'aria-valuenow': done ? 100 : 0 });
        bar.appendChild(el('i', { style: { width: (done ? 100 : 0) + '%' } }));
        body.appendChild(bar);
        var row = el('div', { class: 'pb-card-stars' });
        var lvl = Math.min(3, Math.max(1, Math.ceil(stars / 5)));
        for (var i = 0; i < 3; i++) row.appendChild(el('span', { text: i < lvl ? '★' : '☆' }));
        body.appendChild(el('div', { class: 'pb-card-foot' }, [
          row,
          el('span', { class: 'pb-card-read', text: done ? '再读一遍 →' : '开始读 →' })
        ]));
        card.appendChild(body);

        AIQ.on(card, 'click', function () { FS.unlock(); openBook(st.id); });
        /* 悬浮时轻轻打招呼：先解锁音频，再说一句，避免被浏览器拦下 */
        AIQ.on(card, 'mouseenter', function () {
          if (S.hovered === st.id) return;
          S.hovered = st.id;
          FS.unlock();
          FS.play('soft');
          if (S.voice && TTS.supported) TTS.speak(card.dataset.greet, { rate: S.rate, pitch: S.pitch, brief: true });
        });
        AIQ.on(card, 'focus', function () { card.classList.add('is-focus'); });
        AIQ.on(card, 'blur', function () { card.classList.remove('is-focus'); });
        shelf.appendChild(card);
      });
      host.appendChild(shelf);
      host.appendChild(el('p', { class: 'pb-shelf-empty muted', hidden: true, text: '这个主题的故事还在写，先看看别的吧～' }));
      /* 主题胶囊：点了就筛，再点一次回到全部 */
      var themeRow = qs('#pb-themes');
      if (themeRow) {
        AIQ.qsa('.pb-theme', themeRow).forEach(function (b) {
          AIQ.on(b, 'click', function () {
            AIQ.qsa('.pb-theme', themeRow).forEach(function (x) { x.classList.remove('is-on'); });
            b.classList.add('is-on');
            FS.play('pop');
            applyTheme(b.dataset.theme);
          });
        });
        if (S.theme && S.theme !== 'all') {
          AIQ.qsa('.pb-theme', themeRow).forEach(function (x) {
            var on = x.dataset.theme === S.theme;
            x.classList.toggle('is-on', on);
          });
          applyTheme(S.theme);
        }
      }

      /* 贴纸与徽章 */
      var owned = (data.progress && data.progress.stickers) || [];
      var mine = (data.progress && data.progress.badges) || [];
      var stickers = el('div', { class: 'pb-stickers' });
      (data.stats.stickers || []).forEach(function (s) {
        var has = owned.indexOf(s) >= 0;
        stickers.appendChild(el('div', { class: 'pb-sticker' + (has ? '' : ' is-empty'), text: has ? s : '？' }));
      });
      var badges = el('div', { class: 'pb-badges' });
      (data.stats.badges || []).forEach(function (b) {
        var has = mine.indexOf(b.id) >= 0;
        badges.appendChild(el('div', { class: 'pb-badge' + (has ? '' : ' is-empty') }, [
          el('span', { text: has ? b.icon : '🔒' }), el('span', { text: b.name })
        ]));
      });
      host.appendChild(el('div', { class: 'pb-reward' }, [
        panel([el('h3', { text: '🎈 我的贴纸' }), el('p', { class: 'muted small', text: '每读完一本，就能得到一张贴纸。' }), stickers]),
        panel([el('h3', { text: '🏅 我的徽章' }), el('p', { class: 'muted small', text: '读得越多，徽章越多。' }), badges])
      ]));

      var treeBox = qs('#pb-tree');
      if (treeBox) treeBox.innerHTML = '<div class="pb-tree-box">' + data.tree + '</div>';
      if (!data.junior) {
        host.insertBefore(el('p', { class: 'notice', text: '这套绘本是给小学低年级的小朋友准备的。你现在读的是三年级难度，句子会稍长一点。' }), host.firstChild);
      }
      announce('libraryReady', { stories: data.stories.length, grade: S.grade });
    }).catch(function (e) {
      host.innerHTML = '';
      host.appendChild(panel([
        el('h3', { text: '绘本暂时打不开' }),
        el('p', { class: 'muted', text: '可能是网络或服务的问题：' + e.message }),
        btn('再试一次', renderLibrary, { main: true })
      ]));
    });
  }

  /* ================= 二、打开一本 ================= */
  function openBook(id) {
    var host = stageHost();
    host.innerHTML = '';
    host.appendChild(panel([el('p', { class: 'muted', text: '正在打开绘本…' })]));
    Mic.stop();
    api('/api/pb/book?id=' + encodeURIComponent(id) + '&grade=' + S.grade).then(function (data) {
      S.book = data;
      S.page = 0; S.answers = {}; S.stars = 0; S.correct = 0; S.total = 0; S.marks = []; S.acted = {};
      S.rate = data.tts.rate; S.pitch = data.tts.pitch;
      S.stage = 'reader';
      renderReader(null);
      announce('bookOpen', { id: data.id, title: data.title, pages: data.pages.length });
      if (S.auto || S.voice) setTimeout(readPage, 500);
    }).catch(function (e) {
      host.innerHTML = '';
      host.appendChild(panel([
        el('h3', { text: '这本绘本没能打开' }),
        el('p', { class: 'muted', text: e.message }),
        btn('回到书架', renderLibrary, { main: true })
      ]));
    });
  }

  /* ================= 三、阅读器 ================= */
  /** 进入阅读器时把顶部介绍收成一两行：绘本要一屏看得完，孩子才不会一直滚屏幕 */
  function compactHero(on) {
    var wrap = qs('#pb-library') || qs('#pb-reader');
    if (!wrap || wrap.dataset.embed === '1') return;
    wrap.classList.toggle('is-reading', !!on);
  }

  function renderReader(turn) {
    var b = S.book, host = stageHost();
    if (!b) { renderLibrary(); return; }
    compactHero(true);
    host.innerHTML = '';
    S.stage = 'reader';
    var wrap = el('div', { class: 'pb-reader' });

    /* 顶栏 */
    wrap.appendChild(el('div', { class: 'pb-topbar' }, [
      el('div', { class: 'pb-topbar-left' }, [
        el('button', { class: 'pb-btn is-round', type: 'button', title: '回到书架', text: '←', onclick: function () { TTS.stop(); Mic.stop(); renderLibrary(); } }),
        el('h2', { text: b.emoji + ' ' + b.title })
      ]),
      el('div', { class: 'pb-topbar-right' }, [
        pageDots(b.pages.length, S.page),
        el('span', { class: 'pb-pagecount', text: (S.page + 1) + ' / ' + b.pages.length }),
        el('button', {
          class: 'pb-btn is-round' + (S.voice ? ' is-listen' : ''), type: 'button', title: '朗读开关',
          text: S.voice ? '🔊' : '🔈',
          onclick: function () { toggleVoice(); renderReader(); if (S.voice) readPage(); }
        }),
        el('button', { class: 'pb-btn is-round', type: 'button', title: '语速', text: '⏱', onclick: cycleRate })
      ])
    ]));

    /* 画面 */
    var p = b.pages[S.page];
    var stage = el('div', { class: 'pb-stage' });
    if (S.page >= b.pages.length - 1) {
      stage.appendChild(el('div', { class: 'pb-finish-hint', text: '📖 这是最后一页啦，点下面的绿色按钮去玩小游戏吧' }));
    }
    var pageBox = el('div', { class: 'pb-page' + (turn === 'next' ? ' pb-turn-next' : (turn === 'prev' ? ' pb-turn-prev' : '')) });
    var illus = el('div', { class: 'pb-illus is-alive', html: p.art });
    pageBox.appendChild(illus);
    pageBox.appendChild(buildText(p));
    stage.appendChild(pageBox);
    wrap.appendChild(stage);
    if (turn) setTimeout(function () { pageBox.classList.remove('pb-turn-next', 'pb-turn-prev'); }, 520);

    /* 角色台词：单独一条，比旁白更醒目 */
    if (p.say && p.say.text) {
      wrap.appendChild(el('div', { class: 'pb-say pb-say-' + (p.say.who || 'ai') }, [
        el('span', { class: 'pb-say-who', text: whoName(p.say.who) }),
        el('span', { class: 'pb-say-text', text: p.say.text })
      ]));
    }

    /* 本页互动 */
    var actBox = el('div', { class: 'pb-act' });
    wrap.appendChild(actBox);
    if (p.action) buildAction(p, actBox);

    /* 控制条 */
    var isLast = S.page >= b.pages.length - 1;
    wrap.appendChild(el('div', { class: 'pb-controls' }, [
      btn('← 上一页', function () { go(-1); }, { disabled: S.page === 0 }),
      btn(S.voice ? '🔊 读给我听' : '🔈 读给我听', function () { toggleVoice(true); readPage(); }),
      isLast ? btn('🎉 读完了，去玩小游戏 →', function () { startExercises(); }, { main: true })
        : btn('下一页 →', function () { go(1); }, { main: true })
    ]));

    host.appendChild(wrap);
  }

  function whoName(who) {
    return { ai: '🤖 小AI', dian: '👧 点点', dou: '🐶 豆豆' }[who] || '💬';
  }

  function pageDots(total, cur) {
    var box = el('div', { class: 'pb-dots' });
    for (var i = 0; i < total; i++) {
      box.appendChild(el('i', { class: i === cur ? 'is-on' : '', title: '第 ' + (i + 1) + ' 页', onclick: (function (k) { return function () { jump(k); }; })(i) }));
    }
    return box;
  }

  /** 文字区：拼音 + 大字；每个汉字都能单独点读 */
  function buildText(p) {
    var box = el('div', { class: 'pb-text' + (p.pinyin === null ? ' is-plain' : '') });
    p.lines.forEach(function (line, i) {
      var row = el('div', { class: 'pb-line' });
      var py = p.pinyin && p.pinyin[i] ? p.pinyin[i].text : '';
      if (py) row.appendChild(el('div', { class: 'pb-pinyin', text: py }));
      var hz = el('div', { class: 'pb-hanzi' });
      String(line).split('').forEach(function (ch) {
        if (/[\u4e00-\u9fa5]/.test(ch)) {
          hz.appendChild(el('span', { class: 'pb-word', text: ch, onclick: function (ev) { speakWord(ch, ev.currentTarget); } }));
        } else hz.appendChild(el('span', { text: ch }));
      });
      row.appendChild(hz);
      box.appendChild(row);
    });
    return box;
  }

  function speakWord(ch, node) {
    if (!S.voice) toggleVoice(true);
    if (!TTS.supported) { AIQ.toast({ type: 'warn', text: '这台设备不能朗读，可以请老师读给你听' }); return; }
    AIQ.qsa('.pb-word.is-reading').forEach(function (x) { x.classList.remove('is-reading'); });
    node.classList.add('is-reading');
    TTS.speak(ch, { rate: Math.max(0.6, S.rate - 0.15), pitch: S.pitch, onEnd: function () { node.classList.remove('is-reading'); } });
  }

  function readPage() {
    var b = S.book;
    if (!b || !S.voice) return;
    if (!TTS.supported) { AIQ.toast({ type: 'warn', text: '这台设备不能朗读，可以请老师读给你听' }); return; }
    var p = b.pages[S.page];
    var text = p.lines.join('');
    var words = AIQ.qsa('.pb-word');
    /* 台词也读出来，孩子才知道角色说了什么 */
    if (p.say && p.say.text) text += '。' + p.say.text;
    TTS.speak(text, { rate: S.rate, pitch: S.pitch, words: words });
  }

  function toggleVoice(force) {
    S.voice = force === undefined ? !S.voice : !!force;
    var b = qs('#pb-voice-toggle');
    if (b) { b.textContent = S.voice ? '🔊 朗读：开' : '🔈 朗读：关'; b.setAttribute('aria-pressed', S.voice ? 'true' : 'false'); }
    if (!S.voice) TTS.stop();
  }
  function cycleRate() {
    var opts = [0.68, 0.82, 0.95, 1.1];
    var i = opts.indexOf(S.rate);
    S.rate = opts[(i + 1) % opts.length];
    AIQ.toast({ type: 'ok', text: '语速：' + (S.rate <= 0.68 ? '很慢' : S.rate <= 0.82 ? '慢' : S.rate <= 0.95 ? '正常' : '快') });
    if (S.voice) readPage();
  }

  function go(delta) {
    var b = S.book, next = S.page + delta;
    if (next < 0) { AIQ.toast({ type: 'warn', text: '这已经是第一页啦' }); return; }
    if (next >= b.pages.length) { startExercises(); return; }
    TTS.stop(); Mic.stop(); FS.play('page');
    S.page = next;
    if (delta > 0 && maybeQuestion(next)) return;
    renderReader(delta > 0 ? 'next' : 'prev');
    if (S.voice) setTimeout(readPage, 400);
    if (delta > 0 && next > 0 && next % 3 === 0) {
      var w = ['真棒，已经读到第 ' + (next + 1) + ' 页啦！', '你读得真认真！', '继续加油，快读完了！'];
      AIQ.toast({ type: 'ok', text: w[next % w.length] });
    }
  }
  function jump(k) {
    var b = S.book;
    if (k < 0 || k >= b.pages.length) return;
    TTS.stop(); Mic.stop();
    S.page = k;
    renderReader(k > S.page ? 'next' : 'prev');
    if (S.voice) setTimeout(readPage, 400);
  }

  /* ================= 四、七种互动（像玩，不像考试） ================= */
  var FS = SFX;   /* 简写 */

  function buildAction(p, box) {
    var a = p.action;
    if (!a) return;
    var key = p.sourceIndex + ':' + a.type;
    var wrap = el('div', { class: 'pb-act-card' });
    box.appendChild(wrap);

    function head(title) {
      wrap.appendChild(el('div', { class: 'pb-act-head' }, [
        el('span', { class: 'pb-act-icon', text: actIcon(a.type) }),
        el('span', { class: 'pb-act-title', text: title || a.hint || '' })
      ]));
    }
    /* 已经玩过：显示一个小小的「再玩一次」，不重复计星 */
    function done(ok, msg, again) {
      S.acted[key] = true;
      wrap.innerHTML = '';
      wrap.appendChild(el('div', { class: 'pb-act-done' }, [
        el('span', { class: 'pb-act-emoji', text: ok ? '🎉' : '🤗' }),
        el('span', { text: msg }),
        again ? el('button', { class: 'pb-act-again', type: 'button', text: '再玩一次', onclick: function () { buildAction(p, box); } }) : null
      ]));
    }
    function reward(ok, msg) {
      if (!S.acted[key]) {
        S.acted[key] = true;
        if (ok) { S.stars += 1; }
        S.total++; if (ok) S.correct++;
      }
      done(ok, msg, true);
    }

    var handlers = {
      /* —— 点一点 —— */
      tap: function () {
        head();
        var t = el('button', { class: 'pb-tap-zone', type: 'button' }, [
          el('span', { class: 'pb-tap-ring' }),
          el('span', { class: 'pb-tap-label', text: '点这里' })
        ]);
        AIQ.on(t, 'click', function () {
          FS.play(a.sfx || 'pop');
          t.classList.add('is-tapped');
          reward(true, a.ok || '你点到啦！');
        });
        wrap.appendChild(t);
      },
      /* —— 拖一拖 —— */
      drag: function () {
        head();
        var row = el('div', { class: 'pb-drag-row' });
        var item = el('div', { class: 'pb-drag-item', draggable: 'true' }, [el('span', { text: '🧺' })]);
        var target = el('div', { class: 'pb-drop-target' }, [el('span', { class: 'pb-drop-hint', text: '拖到这里' })]);
        var dragging = false;
        AIQ.on(item, 'dragstart', function (ev) { dragging = true; item.classList.add('is-dragging'); try { ev.dataTransfer.setData('text/plain', '1'); } catch (e) {} });
        AIQ.on(item, 'dragend', function () { item.classList.remove('is-dragging'); });
        AIQ.on(target, 'dragover', function (ev) { ev.preventDefault(); target.classList.add('is-over'); });
        AIQ.on(target, 'dragleave', function () { target.classList.remove('is-over'); });
        AIQ.on(target, 'drop', function (ev) {
          ev.preventDefault(); target.classList.remove('is-over'); land();
        });
        /* 触摸设备：点一下也能完成，不让小朋友卡住 */
        AIQ.on(item, 'click', function () { item.classList.add('is-picked'); });
        AIQ.on(target, 'click', function () { if (item.classList.contains('is-picked') || dragging) land(); });
        function land() {
          FS.play(a.sfx || 'pop');
          target.classList.add('is-done');
          target.innerHTML = '';
          target.appendChild(el('span', { class: 'pb-drop-ok', text: '✔' }));
          reward(true, a.ok || '放对啦！');
        }
        row.appendChild(item); row.appendChild(target);
        wrap.appendChild(row);
      },
      /* —— 吹一吹 —— */
      blow: function () {
        head();
        var meter = el('div', { class: 'pb-blow-meter' }, [el('i')]);
        var hint = el('p', { class: 'pb-blow-hint', text: '按住下面的按钮，对着麦克风吹一口气' });
        var b = btn('🎤 开始吹', function () { start(); }, { main: true });
        var fan = el('div', { class: 'pb-fan' }, [el('span', { text: '🌀' })]);
        wrap.appendChild(el('div', { class: 'pb-blow-row' }, [fan, meter]));
        wrap.appendChild(hint);
        wrap.appendChild(el('div', { class: 'pb-act-actions' }, [b, btn('吹不动？点一下也算', function () { finish(); }, { cls: 'btn-ghost' })]));
        function start() {
          b.disabled = true;
          hint.textContent = '正在听……对着麦克风吹一口气吧';
          Mic.start(function (rms, base) {
            var level = Math.min(1, Math.max(0, (rms - base) * 9));
            AIQ.qs('i', meter).style.width = (level * 100) + '%';
            fan.style.transform = 'rotate(' + (level * 720) + 'deg)';
            if (level > 0.45) { Mic.stop(); FS.play('whoosh'); finish(); }
          }).catch(function (e) {
            b.disabled = false;
            hint.textContent = '打不开麦克风（' + e.message + '），点下面的按钮也一样哦';
          });
        }
        function finish() { Mic.stop(); FS.play(a.sfx || 'whoosh'); reward(true, a.ok || '吹得真好！'); }
      },
      /* —— 拍一拍 —— */
      clap: function () {
        head();
        var lamp = el('div', { class: 'pb-lamp' }, [el('span', { class: 'pb-lamp-bulb', text: '💡' })]);
        var hint = el('p', { class: 'pb-blow-hint', text: '拍一下手，看看灯会不会亮' });
        var b = btn('👏 我准备好了', function () { start(); }, { main: true });
        wrap.appendChild(el('div', { class: 'pb-clap-row' }, [lamp]));
        wrap.appendChild(hint);
        wrap.appendChild(el('div', { class: 'pb-act-actions' }, [b, btn('不方便拍手？点这里', function () { light(); }, { cls: 'btn-ghost' })]));
        function start() {
          b.disabled = true;
          hint.textContent = '正在听……拍一下手吧！';
          Mic.start(function (rms, base) {
            if (rms > base + 0.12) { Mic.stop(); light(); }
          }).catch(function (e) {
            b.disabled = false;
            hint.textContent = '打不开麦克风（' + e.message + '），点下面的按钮也一样哦';
          });
        }
        function light() {
          Mic.stop(); FS.play('ding');
          lamp.classList.add('is-on');
          reward(true, a.ok || '啪！灯亮啦。');
        }
      },
      /* —— 选一选（两个选项，选错也温柔） —— */
      choose: function () {
        head(a.q || a.hint);
        var opts = el('div', { class: 'pb-opts' });
        var answered = false;
        (a.options || []).forEach(function (t, i) {
          var o = el('button', { class: 'pb-opt', type: 'button' }, [
            el('span', { class: 'pb-opt-key', text: 'AB'[i] || String(i + 1) }),
            el('span', { text: t })
          ]);
          AIQ.on(o, 'click', function () {
            if (answered) return;
            if (i === a.answer) {
              answered = true;
              o.classList.add('is-right');
              AIQ.qsa('.pb-opt', opts).forEach(function (x) { x.disabled = true; });
              FS.play('cheer');
              wrap.appendChild(el('div', { class: 'pb-fb is-ok' }, [el('b', { text: '🎉' }), el('span', { text: a.right || '答对啦！' })]));
              report(a, true, t);
              reward(true, a.right || '答对啦！');
            } else {
              /* 不锁死、不变红：只是温柔地提示再试试 */
              o.classList.add('is-soft');
              FS.play('soft');
              wrap.appendChild(el('div', { class: 'pb-fb is-soft' }, [el('b', { text: '🤔' }), el('span', { text: a.wrong || '再想想看？' })]));
              o.classList.remove('is-soft');
            }
          });
          opts.appendChild(o);
        });
        wrap.appendChild(opts);
      },
      /* —— 找一找 —— */
      find: function () {
        head();
        var spots = [[22, 32], [48, 24], [72, 36], [34, 62], [64, 66]];
        var board = el('div', { class: 'pb-find-board' });
        var found = 0, need = 3;
        spots.forEach(function (p, i) {
          var s = el('button', { class: 'pb-find-spot', type: 'button', style: { left: p[0] + '%', top: p[1] + '%' }, title: '找找看' });
          AIQ.on(s, 'click', function () {
            if (s.classList.contains('is-found')) return;
            s.classList.add('is-found');
            s.appendChild(el('span', { text: '⭐' }));
            found++;
            FS.play('star');
            tip.textContent = '找到 ' + found + ' / ' + need + ' 个';
            if (found >= need) { FS.play('cheer'); reward(true, a.ok || '全部找到啦！'); }
          });
          board.appendChild(s);
        });
        var tip = el('p', { class: 'pb-find-tip', text: '找到 0 / ' + need + ' 个' });
        wrap.appendChild(board);
        wrap.appendChild(tip);
      },
      /* —— 说一句 —— */
      say: function () {
        head();
        var heard = el('p', { class: 'pb-say-heard', text: '还没听到你的声音' });
        var mic = btn(ASR ? '🎤 我来说一句' : '⌨️ 打字告诉它', function () { listen(); }, { main: true });
        wrap.appendChild(heard);
        wrap.appendChild(el('div', { class: 'pb-act-actions' }, [mic, btn('先跳过', function () { reward(true, '没关系，我们继续读。'); }, { cls: 'btn-ghost' })]));
        function listen() {
          if (!ASR) { typeInstead(); return; }
          mic.disabled = true;
          heard.textContent = '正在听……请说：' + (a.keyword || '你好');
          ASR.onresult = function (ev) {
            var t = ev.results && ev.results[0] && ev.results[0][0] ? ev.results[0][0].transcript : '';
            heard.textContent = '你说的是：' + t;
            FS.play('chime');
            reward(true, a.ok || '说得真好！');
          };
          ASR.onerror = function () {
            mic.disabled = false;
            heard.textContent = '没听清，再说一次试试？';
          };
          ASR.onend = function () { mic.disabled = false; };
          try { ASR.start(); } catch (e) { mic.disabled = false; typeInstead(); }
        }
        function typeInstead() {
          var inp = el('input', { type: 'text', placeholder: '在这里写一句：' + (a.keyword || '你好'), maxlength: '20' });
          var go2 = btn('说好了', function () {
            if (!inp.value.trim()) { AIQ.toast({ type: 'warn', text: '先写一句吧～' }); return; }
            heard.textContent = '你说的是：' + inp.value.trim();
            FS.play('chime');
            reward(true, a.ok || '说得真好！');
          }, { main: true });
          wrap.appendChild(el('div', { class: 'pb-act-actions' }, [inp, go2]));
          inp.focus();
        }
      }
    };
    (handlers[a.type] || handlers.tap)();
  }

  function actIcon(t) {
    return { tap: '👆', drag: '✋', blow: '🌬️', clap: '👏', choose: '🤔', find: '🔍', say: '🎤' }[t] || '✨';
  }
  function report(a, ok, mine) {
    var b = S.book;
    api('/api/pb/answer', {
      method: 'POST',
      body: {
        bookId: b.id, kind: 'action', title: a.hint || a.q || a.type,
        question: a.q || a.hint || a.type, answer: String(a.answer !== undefined ? a.options[a.answer] : ''),
        mine: mine || '', correct: ok, explain: ok ? (a.right || '') : (a.wrong || '')
      }
    }).catch(function () {});
  }

  /* ================= 五、小问题 ================= */
  function maybeQuestion(nextPage) {
    var b = S.book;
    if (!b) return false;
    var hit = b.questions.filter(function (q) { return q.afterPage === nextPage && !S.answers[q.index]; })[0];
    if (!hit) return false;
    showQuestion(hit, nextPage);
    return true;
  }

  function showQuestion(q, afterPage) {
    var host = stageHost();
    S.stage = 'question';
    TTS.stop(); Mic.stop();
    host.innerHTML = '';
    var wrap = el('div', { class: 'pb-reader' });
    wrap.appendChild(el('div', { class: 'pb-topbar' }, [
      el('div', { class: 'pb-topbar-left' }, [
        el('button', { class: 'pb-btn is-round', type: 'button', text: '←', title: '回到绘本', onclick: function () { renderReader(); } }),
        el('h2', { text: '🤔 小问题' })
      ]),
      el('div', { class: 'pb-topbar-right' }, [el('span', { class: 'pb-pagecount', text: '第 ' + afterPage + ' 页后' })])
    ]));

    var card = el('div', { class: 'pb-question' });
    card.appendChild(el('h3', {}, [el('span', { text: '💡' }), el('span', { text: q.q })]));
    card.appendChild(el('p', { class: 'pb-q-sub', text: '选一个你觉得对的吧，选错也没关系。' }));
    var opts = el('div', { class: 'pb-options' });
    var answered = false;
    q.options.forEach(function (t, i) {
      var o = el('button', { class: 'pb-option', type: 'button' }, [
        el('span', { class: 'pb-opt-key', text: 'AB'[i] || String(i + 1) }),
        el('span', { text: t })
      ]);
      AIQ.on(o, 'click', function () {
        if (answered) return;
        if (i === q.answer) {
          answered = true;
          AIQ.qsa('.pb-option', opts).forEach(function (x) { x.disabled = true; });
          o.classList.add('is-right');
          S.answers[q.index] = true;
          S.correct++; S.total++; S.marks.push(true); S.stars += 1;
          FS.play('cheer');
          if (S.voice) TTS.speak(q.right, { rate: S.rate, pitch: S.pitch });
          card.appendChild(el('div', { class: 'pb-fb is-ok' }, [el('b', { text: '🎉' }), el('div', {}, [el('p', { style: { margin: 0 }, text: q.right })])]));
          after();
        } else {
          /* 温柔提示，不锁死、不变红 */
          o.classList.add('is-soft');
          FS.play('soft');
          card.appendChild(el('div', { class: 'pb-fb is-soft' }, [el('b', { text: '🤗' }), el('div', {}, [el('p', { style: { margin: 0 }, text: q.wrong || '没关系，我们再来一次。' })])]));
        }
      });
      opts.appendChild(o);
    });
    card.appendChild(opts);
    wrap.appendChild(card);
    host.appendChild(wrap);

    function after() {
      api('/api/pb/answer', {
        method: 'POST',
        body: { bookId: S.book.id, kind: 'question', title: q.q, question: q.q, answer: q.options[q.answer], mine: q.options[q.answer], correct: true, explain: q.right }
      }).catch(function () {});
      card.appendChild(el('div', { class: 'pb-controls', style: { justifyContent: 'flex-start', paddingLeft: 0 } }, [
        btn('继续读下去 →', function () { S.page = afterPage; renderReader(); if (S.voice) setTimeout(readPage, 400); }, { main: true })
      ]));
    }
    announce('question', { index: q.index, q: q.q });
  }

  /* ================= 六、读完后的游戏 ================= */
  function startExercises() {
    var b = S.book;
    TTS.stop(); Mic.stop();
    if (!b.questions.length && !b.pages.length) { finishBook(); return; }
    S.exIndex = 0;
    renderExercise();
  }

  function renderExercise() {
    var b = S.book, host = stageHost();
    var ex = b.exercises[S.exIndex];
    if (!ex) { finishBook(); return; }
    S.stage = 'exercise';
    host.innerHTML = '';
    var wrap = el('div', { class: 'pb-reader' });
    wrap.appendChild(el('div', { class: 'pb-topbar' }, [
      el('div', { class: 'pb-topbar-left' }, [el('h2', { text: '🎮 小游戏 ' + (S.exIndex + 1) + ' / ' + b.exercises.length })]),
      el('div', { class: 'pb-topbar-right' }, [el('span', { class: 'pb-pagecount', text: typeName(ex.type) })])
    ]));
    var card = el('div', { class: 'pb-exercise' });
    card.appendChild(el('h3', { text: ex.prompt }));
    card.appendChild(el('p', { class: 'pb-ex-hint', text: hintOf(ex.type) }));
    wrap.appendChild(card);
    host.appendChild(wrap);

    if (ex.type === 'choose') exChoose(card, ex);
    else if (ex.type === 'match') exMatch(card, ex);
    else if (ex.type === 'order') exOrder(card, ex);
    else exOpen(card, ex);
    announce('exercise', { index: S.exIndex, type: ex.type });
  }

  function typeName(t) { return { choose: '选一选', match: '连一连', order: '排一排', open: '说一说' }[t] || '小游戏'; }
  function hintOf(t) {
    return {
      choose: '可以选一个，也可以选好几个。选好了点下面的按钮。',
      match: '先点左边的，再点右边的，把它们连起来。',
      order: '点右边的箭头，把顺序排对。',
      open: '把你的想法说给小AI 听，写下来也可以。'
    }[t] || '';
  }
  function nextBtn(card, ok) {
    card.appendChild(el('div', { class: 'pb-controls', style: { justifyContent: 'flex-start', paddingLeft: 0 } }, [
      btn(S.exIndex + 1 < S.book.exercises.length ? '下一个游戏 →' : '看看我的星星 →', function () {
        S.exResults = S.exResults || [];
        S.exResults[S.exIndex] = ok;
        S.exIndex++;
        renderExercise();
      }, { main: true })
    ]));
  }

  function exChoose(card, ex) {
    var picked = {}, grid = el('div', { class: 'pb-ex-grid' });
    ex.options.forEach(function (t, i) {
      var o = el('button', { class: 'pb-ex-item', type: 'button' }, [el('span', { class: 'pb-tick', text: '○' }), el('span', { text: t })]);
      AIQ.on(o, 'click', function () {
        if (card.dataset.done === '1') return;
        picked[i] = !picked[i];
        o.classList.toggle('is-picked', !!picked[i]);
        AIQ.qs('.pb-tick', o).textContent = picked[i] ? '●' : '○';
        FS.play('pop');
      });
      grid.appendChild(o);
    });
    card.appendChild(grid);
    card.appendChild(el('div', { class: 'pb-act-actions' }, [
      btn('选好了', function () {
        if (card.dataset.done === '1') return;
        card.dataset.done = '1';
        var mine = Object.keys(picked).filter(function (k) { return picked[k]; }).map(Number);
        var ok = mine.slice().sort().join(',') === ex.answer.slice().sort().join(',') && mine.length > 0;
        AIQ.qsa('.pb-ex-item', grid).forEach(function (x, i) {
          x.disabled = true;
          if (ex.answer.indexOf(i) >= 0) x.classList.add('is-right');
          else if (picked[i]) x.classList.add('is-soft');
        });
        S.total++; if (ok) S.correct++; S.marks.push(ok); S.stars += ok ? 2 : 1;
        FS.play(ok ? 'cheer' : 'soft');
        card.appendChild(el('div', { class: 'pb-fb ' + (ok ? 'is-ok' : 'is-soft') }, [
          el('b', { text: ok ? '🎉' : '🤗' }),
          el('div', {}, [el('p', { style: { margin: 0 }, text: ok ? '全对！' : '差一点点～' }), el('p', { style: { margin: '6px 0 0' }, text: ex.tip })])
        ]));
        reportEx(ex, ok);
        nextBtn(card, ok);
      }, { main: true })
    ]));
  }

  function exMatch(card, ex) {
    var pickedLeft = null, links = {}, no = 0;
    var rights = AIQ.shuffle(ex.pairs.map(function (p, i) { return { text: p.right, i: i }; }));
    var grid = el('div', { class: 'pb-match' });
    var colL = el('div', { class: 'pb-match-col' }, [el('h4', { text: '左边' })]), colR = el('div', { class: 'pb-match-col' }, [el('h4', { text: '右边' })]);
    ex.pairs.forEach(function (p, i) {
      var c = el('button', { class: 'pb-chip', type: 'button', draggable: 'true' }, [el('span', { text: p.left })]);
      AIQ.on(c, 'click', function () {
        if (c.classList.contains('is-linked')) return;
        AIQ.qsa('.pb-chip').forEach(function (x) { x.classList.remove('is-picked'); });
        if (pickedLeft === i) { pickedLeft = null; return; }
        pickedLeft = i; c.classList.add('is-picked'); FS.play('pop');
      });
      AIQ.on(c, 'dragstart', function () { pickedLeft = i; });
      colL.appendChild(c);
    });
    rights.forEach(function (r) {
      var c = el('button', { class: 'pb-chip', type: 'button' }, [el('span', { text: r.text })]);
      AIQ.on(c, 'click', function () { link(c, r.i); });
      AIQ.on(c, 'dragover', function (ev) { ev.preventDefault(); c.classList.add('is-over'); });
      AIQ.on(c, 'dragleave', function () { c.classList.remove('is-over'); });
      AIQ.on(c, 'drop', function (ev) { ev.preventDefault(); c.classList.remove('is-over'); link(c, r.i); });
      colR.appendChild(c);
    });
    function link(chip, ri) {
      if (card.dataset.done === '1' || chip.classList.contains('is-linked')) return;
      if (pickedLeft === null || pickedLeft === undefined) { AIQ.toast({ type: 'warn', text: '先点左边的一项，再点右边的。' }); return; }
      no++; links[pickedLeft] = ri;
      chip.classList.add('is-linked');
      chip.insertBefore(el('span', { class: 'pb-link-no', text: String(no) }), chip.firstChild);
      var lc = AIQ.qsa('.pb-chip', colL)[pickedLeft];
      if (lc) { lc.classList.remove('is-picked'); lc.classList.add('is-linked'); lc.appendChild(el('span', { class: 'pb-link-no', text: String(no) })); }
      pickedLeft = null; FS.play('ding');
    }
    grid.appendChild(colL); grid.appendChild(colR);
    card.appendChild(grid);
    card.appendChild(el('div', { class: 'pb-act-actions' }, [
      btn('连好了，看看对不对', function () {
        if (card.dataset.done === '1') return;
        card.dataset.done = '1';
        var good = 0;
        ex.pairs.forEach(function (p, i) { if (links[i] === i) good++; });
        var ok = good === ex.pairs.length;
        AIQ.qsa('.pb-chip', colL).forEach(function (x, i) {
          x.classList.add(links[i] === i ? 'is-right' : 'is-soft');
        });
        S.total++; if (ok) S.correct++; S.marks.push(ok); S.stars += ok ? 2 : 1;
        FS.play(ok ? 'cheer' : 'soft');
        card.appendChild(el('div', { class: 'pb-fb ' + (ok ? 'is-ok' : 'is-soft') }, [
          el('b', { text: ok ? '🎉' : '🤗' }),
          el('div', {}, [el('p', { style: { margin: 0 }, text: ok ? '全部连对！' : ('连对了 ' + good + ' / ' + ex.pairs.length + ' 组') }), el('p', { style: { margin: '6px 0 0' }, text: ex.tip })])
        ]));
        reportEx(ex, ok);
        nextBtn(card, ok);
      }, { main: true })
    ]));
  }

  function exOrder(card, ex) {
    var items = AIQ.shuffle(ex.items.map(function (t, i) { return { text: t, i: i }; }));
    var list = el('div', { class: 'pb-order' });
    function redraw() {
      list.innerHTML = '';
      items.forEach(function (it, idx) {
        var row = el('div', { class: 'pb-order-item' }, [
          el('span', { class: 'pb-order-no', text: String(idx + 1) }),
          el('span', { text: it.text }),
          el('span', { class: 'pb-order-arrows' }, [
            el('button', { type: 'button', text: '▲', onclick: function (ev) { ev.stopPropagation(); move(idx, -1); } }),
            el('button', { type: 'button', text: '▼', onclick: function (ev) { ev.stopPropagation(); move(idx, 1); } })
          ])
        ]);
        list.appendChild(row);
      });
    }
    function move(i, d) {
      if (card.dataset.done === '1') return;
      var t = i + d;
      if (t < 0 || t >= items.length) return;
      var tmp = items[i]; items[i] = items[t]; items[t] = tmp;
      FS.play('pop'); redraw();
    }
    redraw();
    card.appendChild(list);
    card.appendChild(el('div', { class: 'pb-act-actions' }, [
      btn('排好了，看看对不对', function () {
        if (card.dataset.done === '1') return;
        card.dataset.done = '1';
        var ok = items.every(function (it, i) { return it.i === i; });
        AIQ.qsa('.pb-order-item', list).forEach(function (x, i) { x.classList.add(items[i].i === i ? 'is-right' : 'is-soft'); });
        S.total++; if (ok) S.correct++; S.marks.push(ok); S.stars += ok ? 2 : 1;
        FS.play(ok ? 'cheer' : 'soft');
        card.appendChild(el('div', { class: 'pb-fb ' + (ok ? 'is-ok' : 'is-soft') }, [
          el('b', { text: ok ? '🎉' : '🤗' }),
          el('div', {}, [el('p', { style: { margin: 0 }, text: ok ? '顺序完全正确！' : '顺序还差一点点～' }), el('p', { style: { margin: '6px 0 0' }, text: ex.tip })])
        ]));
        reportEx(ex, ok);
        nextBtn(card, ok);
      }, { main: true })
    ]));
  }

  function exOpen(card, ex) {
    var heard = el('p', { class: 'pb-say-heard', text: '小AI 在听你说' });
    var mic = btn(ASR ? '🎤 我来说' : '⌨️ 写下来', function () {
      if (!ASR) { typeIn(); return; }
      mic.disabled = true;
      heard.textContent = '正在听……';
      ASR.onresult = function (ev) {
        var t = ev.results && ev.results[0] && ev.results[0][0] ? ev.results[0][0].transcript : '';
        heard.textContent = '你说的是：' + t;
        finish(t);
      };
      ASR.onerror = function () { mic.disabled = false; heard.textContent = '没听清，再试一次或者写下来吧'; };
      ASR.onend = function () { mic.disabled = false; };
      try { ASR.start(); } catch (e) { mic.disabled = false; typeIn(); }
    }, { main: true });
    card.appendChild(heard);
    var hints = el('div', { class: 'pb-hints' });
    (ex.hints || []).forEach(function (h) {
      hints.appendChild(el('button', { class: 'pb-hint-chip', type: 'button', text: '💡 ' + h, onclick: function (ev) { heard.textContent = h; ev.currentTarget.disabled = true; } }));
    });
    card.appendChild(hints);
    card.appendChild(el('div', { class: 'pb-act-actions' }, [mic, btn('先跳过', function () { finish(''); }, { cls: 'btn-ghost' })]));

    function typeIn() {
      var inp = el('input', { type: 'text', placeholder: '写一句你的想法', maxlength: '40' });
      card.appendChild(el('div', { class: 'pb-act-actions' }, [inp, btn('说好了', function () { finish(inp.value.trim()); }, { main: true })]));
      inp.focus();
    }
    function finish(text) {
      S.total++; S.correct++; S.marks.push(true); S.stars += 2;
      FS.play('cheer');
      card.appendChild(el('div', { class: 'pb-fb is-ok' }, [
        el('b', { text: '🎉' }),
        el('div', {}, [el('p', { style: { margin: 0 }, text: '说得真好！' }), el('p', { style: { margin: '6px 0 0' }, text: ex.tip })])
      ]));
      reportEx(ex, true, text);
      nextBtn(card, true);
    }
  }
  function reportEx(ex, ok, mine) {
    api('/api/pb/answer', {
      method: 'POST',
      body: { bookId: S.book.id, kind: 'exercise', title: ex.prompt, question: ex.prompt, answer: ex.tip || '', mine: mine || '', correct: ok, explain: ex.tip || '' }
    }).catch(function () {});
  }

  /* ================= 七、结算 ================= */
  function finishBook() {
    var b = S.book, host = stageHost();
    var totalQ = b.questions.length + b.pages.filter(function (p) { return p.action; }).length + b.exercises.length;
    var stars = 3 + S.stars;
    if (totalQ > 0 && S.correct >= totalQ) stars += 1;
    stars = AIQ.clamp(stars, 1, b.maxStars);
    S.stage = 'result';
    TTS.stop(); Mic.stop();

    host.innerHTML = '';
    var wrap = el('div', { class: 'pb-reader' });
    var card = el('div', { class: 'pb-result' }, [
      el('h2', { text: '🎊 读完啦！' }),
      el('p', { class: 'pb-score', text: '《' + b.title + '》读完了，你真棒！' })
    ]);
    var row = el('div', { class: 'pb-stars-row' });
    var lvl = Math.ceil(stars / Math.max(1, Math.ceil(b.maxStars / 3)));
    for (var i = 0; i < 3; i++) row.appendChild(el('i', { text: i < lvl ? '★' : '☆' }));
    card.appendChild(row);
    card.appendChild(el('p', { class: 'pb-score', text: '你答对了 ' + S.correct + ' / ' + totalQ + '，获得 ' + stars + ' 颗星星' }));
    card.appendChild(el('p', { class: 'pb-gain', text: '正在记到你的小本子上…' }));
    if (S.voice) TTS.speak('恭喜你读完了' + b.title + '，你真棒！', { rate: S.rate, pitch: S.pitch });
    FS.play('cheer');

    card.appendChild(el('div', { class: 'pb-result-tree', id: 'pb-result-tree' }));
    card.appendChild(el('div', { class: 'pb-result-actions' }, [
      btn('🔁 再读一遍', function () { openBook(b.id); }),
      btn('📚 换一本读', renderLibrary, { main: true })
    ]));
    wrap.appendChild(card);
    host.appendChild(wrap);

    api('/api/pb/finish', {
      method: 'POST',
      body: { bookId: b.id, title: b.title, stars: stars, correct: S.correct, total: totalQ, marks: S.marks.slice(-8) }
    }).then(function (r) {
      var g = qs('.pb-gain', card);
      if (g) g.textContent = '🌟 获得 ' + r.gained + ' 颗星星，总共 ' + r.totalStars + ' 颗！';
      if (r.sticker) {
        card.insertBefore(el('p', { class: 'pb-score', text: r.newSticker ? '得到一张新贴纸！' : '又收集到一张贴纸！' }), card.querySelector('.pb-result-actions'));
        card.insertBefore(el('div', { class: 'pb-sticker-big', text: r.sticker }), card.querySelector('.pb-result-actions'));
      }
      if (r.newBadges && r.newBadges.length) {
        var nb = el('div', { class: 'pb-newbadges' });
        r.newBadges.forEach(function (bd) { nb.appendChild(el('div', { class: 'pb-badge' }, [el('span', { text: bd.icon }), el('span', { text: '新徽章：' + bd.name })])); });
        card.insertBefore(nb, card.querySelector('.pb-result-actions'));
      }
      var tb = qs('#pb-result-tree');
      if (tb && r.tree) tb.innerHTML = r.tree;
      if (r.next && r.next.level !== 'normal') {
        card.insertBefore(el('p', { class: 'pb-adapt-note', text: '💡 ' + r.next.encouragement }), card.querySelector('.pb-result-actions'));
      }
      announce('finish', { id: b.id, stars: stars, gained: r.gained, totalStars: r.totalStars, next: r.next });
    }).catch(function (e) {
      var g = qs('.pb-gain', card);
      if (g) g.textContent = '这次没能记上星星（' + e.message + '），下次再试试。';
    });
  }

  /* ================= 八、问小AI ================= */
  function buildAsk() {
    if (qs('.pb-ask')) return;
    var panelEl = el('div', { class: 'pb-ask-panel', hidden: true });
    var log = el('div', { class: 'pb-ask-log' });
    var input = el('textarea', { placeholder: '想问小AI 什么呀？', rows: '1' });
    var mic = el('button', { class: 'pb-ask-mic', type: 'button', title: ASR ? '点一下开始说话' : '这个浏览器不支持说话输入', text: '🎤', disabled: !ASR });
    var send = el('button', { class: 'pb-btn is-main', type: 'button', text: '问', style: { minWidth: '56px', padding: '0 14px' } });
    var sug = el('div', { class: 'pb-ask-sug' });

    panelEl.appendChild(el('div', { class: 'pb-ask-head' }, [
      el('b', { text: '🤖 问小AI' }),
      el('button', { class: 'pb-btn is-round', type: 'button', text: '✕', style: { minHeight: '40px', width: '40px' }, onclick: function () { panelEl.hidden = true; Mic.stop(); } })
    ]));
    panelEl.appendChild(log);
    panelEl.appendChild(sug);
    panelEl.appendChild(el('div', { class: 'pb-ask-input' }, [input, mic, send]));

    var fab = el('button', { class: 'pb-ask-btn', type: 'button', title: '问小AI', text: '💬' });
    AIQ.on(fab, 'click', function () {
      FS.unlock();
      panelEl.hidden = !panelEl.hidden;
      if (!panelEl.hidden) { refreshSug(); input.focus(); }
    });
    document.body.appendChild(el('div', { class: 'pb-ask' }, [panelEl, fab]));

    function bubble(role, text) {
      var b = el('div', { class: 'pb-ask-msg ' + (role === 'me' ? 'is-me' : 'is-ai') }, [el('span', { text: text })]);
      log.appendChild(b); log.scrollTop = log.scrollHeight;
      return b;
    }
    function refreshSug() {
      sug.innerHTML = '';
      var pool = (S.book && S.book.mentor) || [];
      var list = pool.slice(0, 3).map(function (m) { return m.q; });
      if (!list.length) list = ['小AI 是什么？', '它为什么会听错？', '它会难过吗？'];
      list.forEach(function (q) {
        sug.appendChild(el('button', { type: 'button', text: q, onclick: function () { input.value = q; ask(); } }));
      });
    }
    function ask() {
      var q = input.value.trim();
      if (!q) return;
      input.value = '';
      bubble('me', q);
      var thinking = bubble('ai', '小AI 正在想…');
      api('/api/pb/ask', { method: 'POST', body: { bookId: (S.book && S.book.id) || 'wake', question: q } }).then(function (r) {
        thinking.textContent = r.answer;
        if (r.tip) thinking.appendChild(el('span', { class: 'pb-ask-act', text: '💡 ' + r.tip }));
        if (S.voice) TTS.speak(r.answer, { rate: S.rate, pitch: S.pitch });
        if (r.page) {
          thinking.appendChild(el('button', {
            class: 'pb-btn', type: 'button', text: '📖 变成一页绘本给我看',
            style: { marginTop: '9px', minHeight: '42px', fontSize: '14px', padding: '0 14px' },
            onclick: function () { showAnswerPage(r.page); }
          }));
        }
        FS.play('chime');
        announce('ask', { question: q, matched: r.matched });
      }).catch(function (e) {
        thinking.textContent = '小AI 没听清，我们再说一次好吗？（' + e.message + '）';
      });
    }
    AIQ.on(send, 'click', ask);
    AIQ.on(input, 'keydown', function (ev) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); ask(); } });

    if (ASR) {
      var on = false;
      AIQ.on(mic, 'click', function () { if (on) { try { ASR.stop(); } catch (e) {} return; } try { ASR.start(); } catch (e) {} });
      ASR.onstart = function () { on = true; mic.classList.add('is-on'); };
      ASR.onend = function () { on = false; mic.classList.remove('is-on'); };
      ASR.onerror = function () { on = false; mic.classList.remove('is-on'); AIQ.toast({ type: 'warn', text: '没有听清，再说一次试试' }); };
      ASR.onresult = function (ev) {
        var t = ev.results && ev.results[0] && ev.results[0][0] ? ev.results[0][0].transcript : '';
        if (!t) return;
        /* 语音指令 */
        if (/继续讲|接着讲|下一页/.test(t)) { go(1); return; }
        if (/上一页|往回/.test(t)) { go(-1); return; }
        if (/换一本|别的故事|换一个故事/.test(t)) { TTS.stop(); renderLibrary(); return; }
        if (/读给我听|念给我听|朗读/.test(t)) { toggleVoice(true); readPage(); return; }
        input.value = t; ask();
      };
    }
    global.PB = global.PB || {};
    global.PB.openAsk = function (q) { panelEl.hidden = false; refreshSug(); if (q) { input.value = q; ask(); } else input.focus(); };
    S.refreshSug = refreshSug;
  }

  /** 把「问小AI」的回答变成新的一页绘本 */
  function showAnswerPage(page) {
    var host = stageHost();
    TTS.stop();
    var wrap = el('div', { class: 'pb-reader' });
    wrap.appendChild(el('div', { class: 'pb-topbar' }, [
      el('div', { class: 'pb-topbar-left' }, [
        el('button', { class: 'pb-btn is-round', type: 'button', text: '←', onclick: function () { renderReader(); } }),
        el('h2', { text: '📖 小AI 画的这一页' })
      ]),
      el('div', { class: 'pb-topbar-right' }, [el('span', { class: 'pb-pagecount', text: '专门为你画的' })])
    ]));
    var stage = el('div', { class: 'pb-stage' });
    var box = el('div', { class: 'pb-page' });
    box.appendChild(el('div', { class: 'pb-illus is-alive', html: page.art }));
    var text = el('div', { class: 'pb-text is-plain' });
    (page.lines || []).forEach(function (l) {
      text.appendChild(el('div', { class: 'pb-line' }, [el('div', { class: 'pb-hanzi' }, [el('span', { class: 'pb-word', text: l })] )]));
    });
    box.appendChild(text);
    stage.appendChild(box);
    wrap.appendChild(stage);
    wrap.appendChild(el('div', { class: 'pb-controls' }, [
      btn('← 回到绘本', function () { renderReader(); }),
      btn('🔊 读这一页', function () { if (!S.voice) toggleVoice(true); TTS.speak((page.lines || []).join(''), { rate: S.rate, pitch: S.pitch }); }),
      btn('把这个回答收进贴纸本', function () {
        api('/api/event', { method: 'POST', body: { type: 'story', title: '绘本提问：' + (page.title || ''), xp: 3 } })
          .then(function () { AIQ.toast({ type: 'ok', text: '收好啦！' }); }).catch(function () {});
      }, { main: true })
    ]));
    host.innerHTML = '';
    host.appendChild(wrap);
    FS.play('chime');
    if (S.voice) TTS.speak((page.lines || []).join(''), { rate: S.rate, pitch: S.pitch });
  }

  /* ================= 九、帮助与启动 ================= */
  function showHelp() {
    AIQ.modal({
      title: '怎么读这本绘本书',
      body: el('div', {}, [
        el('ol', { class: 'ask-list' }, [
          el('li', { text: '点封面就能打开一本绘本，一次只看一页。' }),
          el('li', { text: '点「🔈 读给我听」，它会慢慢地读给你听；再点一下就能关掉。' }),
          el('li', { text: '点「⏱」可以调语速。' }),
          el('li', { text: '点书上的任意一个字，就能听这个字怎么读。' }),
          el('li', { text: '有的页会冒出一个好玩的互动：点一点、拖一拖、吹一吹、拍一拍。' }),
          el('li', { text: '读到一半会出现「小问题」，选错了也没关系，它会说「再想想看」。' }),
          el('li', { text: '读完了有三个小游戏，玩完能拿星星和贴纸。' }),
          el('li', { text: '右下角的 💬 可以随时问小AI 问题，它还会把回答画成一页绘本。' })
        ]),
        el('p', { class: 'muted small', text: '小提示：吹一吹和拍一拍需要用到麦克风，浏览器会先问你一次，点「允许」就好。不想用也没关系，点一下按钮一样能过。' })
      ])
    });
  }

  function init() {
    var host = qs('#pb-app');
    if (!host && qs('#anim-root')) {
      /* 动画页：只有 #anim-root，装配骨骼动画播放器 */
      S.grade = Number((AIQ.state.student && AIQ.state.student.grade) || 1);
      AIQ.pbOpenAnim = openAnim;
      AIQ.pbInitAnim = initAnim;
      buildAsk();
      initAnim();
      return;
    }
    if (!host) {
      /* 创作工坊里的「AI 绘本」标签页：没有 #pb-app，但有待装配的工坊区域 */
      if (qs('#pb-studio-cards')) {
        S.grade = Number((AIQ.state.student && AIQ.state.student.grade) || 1);
        var gs = qs('#studio-grade');
        if (gs) {
          S.grade = Number(gs.value) || S.grade;
          AIQ.on(gs, 'change', function () {
            S.grade = Number(gs.value);
            if (AIQ.pbStudioReload) AIQ.pbStudioReload();
            else pbStudio();
          });
        }
        buildAsk();
        pbStudio();
      }
      return;
    }
    var wrap = qs('#pb-library') || qs('#pb-reader');
    var q = params();
    S.embed = wrap && wrap.dataset.embed === '1';
    S.auto = (wrap && wrap.dataset.auto === '1') || q.auto === '1';
    S.grade = Number((wrap && wrap.dataset.grade) || q.grade || (AIQ.state.student && AIQ.state.student.grade) || 1);

    var gradeEl = qs('#pb-grade');
    if (gradeEl) {
      gradeEl.value = String(S.grade);
      AIQ.on(gradeEl, 'change', function () {
        S.grade = Number(gradeEl.value);
        api('/api/student', { method: 'POST', body: { grade: S.grade } }).catch(function () {});
        AIQ.toast({ type: 'ok', text: '已按 ' + S.grade + ' 年级调整故事长短和玩法' });
        TTS.stop(); Mic.stop(); renderLibrary();
      });
    }
    var vBtn = qs('#pb-voice-toggle');
    if (vBtn) {
      if (!TTS.supported) { vBtn.disabled = true; vBtn.textContent = '🔈 这台设备不支持朗读'; }
      else AIQ.on(vBtn, 'click', function () { FS.unlock(); toggleVoice(); if (S.voice) readPage(); });
    }
    var hBtn = qs('#pb-help');
    if (hBtn) AIQ.on(hBtn, 'click', showHelp);

    buildAsk();

    var boot = global.__PB_BOOT__ || null;
    var want = (boot && boot.id) || q.id || q.story || '';
    if (want) {
      S.voice = S.auto;
      if (vBtn && TTS.supported) vBtn.textContent = S.voice ? '🔊 朗读：开' : '🔈 朗读：关';
      openBook(want);
    } else renderLibrary();

    global.addEventListener('message', function (ev) {
      var d = ev && ev.data;
      if (!d || d.target !== 'aiq-picturebook') return;
      if (d.action === 'open' && d.id) openBook(d.id);
      else if (d.action === 'grade' && d.grade) { S.grade = Number(d.grade); renderLibrary(); }
      else if (d.action === 'voice') { toggleVoice(!!d.on); if (S.voice) readPage(); }
      else if (d.action === 'next') go(1);
      else if (d.action === 'prev') go(-1);
      else if (d.action === 'ask' && global.PB && global.PB.openAsk) global.PB.openAsk(d.text);
    });
    /* 页面失焦时停下麦克风，避免一直占用 */
    global.addEventListener('blur', function () { Mic.stop(); });
  }


  /* ================= 十、创作工坊里的 AI 绘本（工坊模式） ================= */
  /**
   * 左栏：主题胶囊 + 一键生成 + 绘本卡片流
   * 右栏：沉浸式预览（点卡片在这里翻页），底部带「重新生图 / 改台词 / 加配音 / 插互动」
   */
  function pbStudio() {
    var cardsBox = qs('#pb-studio-cards');
    var mainBox = qs('#pb-studio-main');
    if (!cardsBox || !mainBox) return;
    if (cardsBox.dataset.ready === '1') return;
    cardsBox.dataset.ready = '1';
    var themeRow = qs('#pb-themes');
    var genInput = qs('#pb-gen-input');
    var genGo = qs('#pb-gen-go');
    var genNote = qs('#pb-gen-note');
    var all = [];
    var theme = 'all';

    function load() {
      cardsBox.innerHTML = '<p class="muted small">正在准备…</p>';
      api('/api/books?grade=' + S.grade + '&theme=' + encodeURIComponent(theme)).then(function (data) {
        all = data.stories || [];
        S.gradeData = data;
        drawCards();
      }).catch(function (e) {
        cardsBox.innerHTML = '';
        cardsBox.appendChild(el('p', { class: 'muted small', text: '没能取到绘本（' + e.message + '），再试一次吧。' }));
      });
    }

    function drawCards() {
      cardsBox.innerHTML = '';
      if (!all.length) {
        cardsBox.appendChild(el('p', { class: 'muted small', text: '这个主题的故事还在写，先看看别的吧～' }));
        return;
      }
      all.forEach(function (st) {
        var prog = st.progress || null;
        var done = !!(prog && prog.done);
        var card = el('button', { class: 'pb-studio-card', type: 'button' });
        card.appendChild(el('div', { class: 'pb-studio-cover', html: st.cover }));
        card.appendChild(el('div', { class: 'pb-studio-meta' }, [
          el('b', { text: st.emoji + ' ' + st.title }),
          el('span', { class: 'pb-studio-age', text: st.ageLabel || '' }),
          el('span', { class: 'pb-studio-concept', text: st.conceptLabel }),
          el('span', { class: 'pb-studio-state', text: done ? '✔ 已读完' : '还没读' })
        ]));
        AIQ.on(card, 'click', function () {
          AIQ.qsa('.pb-studio-card', cardsBox).forEach(function (x) { x.classList.remove('is-on'); });
          card.classList.add('is-on');
          FS.unlock(); FS.play('pop');
          preview(st.id);
        });
        cardsBox.appendChild(card);
      });
      /* 自动预览第一本，右侧不留空白 */
      if (all[0]) preview(all[0].id);
    }

    /** 右侧沉浸式预览：大图 + 拼音 + 朗读 + 编辑工具条 + 翻页 + 问小AI */
    function preview(id) {
      S.book = null;
      mainBox.innerHTML = '<div class="panel"><p class="muted">正在翻开…</p></div>';
      api('/api/pb/book?id=' + encodeURIComponent(id) + '&grade=' + S.grade).then(function (b) {
        S.book = b; S.page = 1; S.stars = 0; S.correct = 0; S.total = 0;
        S.acted = {}; S.answers = {}; S.marks = []; S.stage = 'reader';
        var wrap = el('div', { class: 'pb-studio-reader' });

        /* 编辑工具条：重新生图 / 修改台词 / 添加配音 / 插入互动 */
        var tools = el('div', { class: 'pb-studio-tools' });
        [['🎨 重新生图', 'reskin'], ['✏️ 修改台词', 'line'], ['🔊 添加配音', 'voice'], ['👆 插入互动', 'act']].forEach(function (t) {
          tools.appendChild(el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: t[0], onclick: function () { toolAction(t[1]); } }));
        });
        wrap.appendChild(tools);

        var host = el('div', { class: 'pb-studio-page' });
        wrap.appendChild(host);
        mainBox.innerHTML = '';
        mainBox.appendChild(wrap);
        S.studioHost = host;
        S.studioTools = tools;
        drawStudioPage();
      }).catch(function (e) {
        mainBox.innerHTML = '';
        mainBox.appendChild(el('div', { class: 'panel' }, [el('p', { class: 'muted', text: '打不开这本绘本（' + e.message + '）' })]));
      });
    }

    function drawStudioPage() {
      var host = S.studioHost;
      if (!host || !S.book) return;
      var b = S.book;
      var i = Math.min(b.pages.length, Math.max(1, S.page));
      var p = b.pages[i - 1];
      host.innerHTML = '';

      var box = el('div', { class: 'pb-page' });
      box.appendChild(el('div', { class: 'pb-illus is-alive', html: p.art }));
      /* 复用阅读器那套安全的大字构造：拼音逐行对齐、汉字可点 */
      var text = buildText(p);
      if (p.say) {
        text.appendChild(el('div', { class: 'pb-say pb-say-' + p.say.who }, [
          el('span', { class: 'pb-say-who', text: whoName(p.say.who) + '：' }),
          el('span', { class: 'pb-say-text', text: p.say.text })
        ]));
      }
      box.appendChild(text);
      host.appendChild(box);

      /* 底部：翻页 + 朗读 + 问小AI */
      var foot = el('div', { class: 'pb-studio-foot' }, [
        el('button', { class: 'pb-btn', type: 'button', text: '← 上一页', disabled: i <= 1, onclick: function () { S.page = i - 1; drawStudioPage(); } }),
        el('span', { class: 'pb-pagecount', text: i + ' / ' + b.pages.length }),
        el('button', { class: 'pb-btn is-main', type: 'button', text: '🔈 读这一页', onclick: function () { readStudioPage(p); } }),
        el('button', { class: 'pb-btn', type: 'button', text: '下一页 →', disabled: i >= b.pages.length, onclick: function () { S.page = i + 1; drawStudioPage(); } }),
        el('button', { class: 'pb-btn is-round', type: 'button', text: '💬', title: '问小AI', onclick: function () { if (global.PB && global.PB.openAsk) global.PB.openAsk(); } })
      ]);
      host.appendChild(foot);
      /* 分镜信息：让老师一眼看到这一页属于八步的哪一步 */
      if (p.arcStep) {
        host.appendChild(el('p', { class: 'pb-studio-note', text: '第 ' + p.arcStep.step + ' 步 · ' + p.arcStep.name + '　' + (p.logicTrigger || '') }));
      }
    }

    function readStudioPage(p) {
      FS.unlock();
      var txt = (p.lines || []).join('');
      if (p.say) txt += '。' + whoName(p.say.who) + '说：' + p.say.text;
      TTS.speak(txt, { rate: S.rate, pitch: S.pitch });
    }

    /** 四个编辑动作：都是即时、可见、可回退的小操作 */
    function toolAction(kind) {
      var p = S.book && S.book.pages[S.page - 1];
      if (!p) return;
      if (kind === 'reskin') {
        FS.play('whoosh');
        p.art = p.art.replace('pb-scene', 'pb-scene pb-reskin');
        drawStudioPage();
        AIQ.toast({ type: 'ok', text: '这一页重新生成了（造型微调）' });
      } else if (kind === 'line') {
        var cur = p.say ? p.say.text : (p.lines || []).join('');
        var v = global.prompt('改一句台词（不超过 24 字）：', cur.slice(0, 24));
        if (v === null || !String(v).trim()) return;
        var txt = String(v).trim().slice(0, 24);
        if (p.say) p.say.text = txt; else p.lines = [txt];
        drawStudioPage();
        AIQ.toast({ type: 'ok', text: '台词已改好' });
      } else if (kind === 'voice') {
        FS.unlock(); readStudioPage(p);
        AIQ.toast({ type: 'ok', text: '正在配这一页的音' });
      } else if (kind === 'act') {
        var has = !!p.action;
        p.action = has ? null : { type: 'tap', hint: '点一点画面，看看会发生什么', ok: '你点到啦！', sfx: 'pop' };
        drawStudioPage();
        AIQ.toast({ type: 'ok', text: has ? '这一页的互动已移除' : '已给这一页插入一个「点一点」互动' });
      }
    }

    /* 主题胶囊 */
    if (themeRow) {
      AIQ.qsa('.pb-theme', themeRow).forEach(function (b) {
        AIQ.on(b, 'click', function () {
          AIQ.qsa('.pb-theme', themeRow).forEach(function (x) { x.classList.remove('is-on'); });
          b.classList.add('is-on');
          theme = b.dataset.theme;
          FS.play('pop');
          load();
        });
      });
    }
    /* 一键生成 */
    function generate() {
      var want = genInput ? genInput.value.trim() : '';
      if (!want) { AIQ.toast({ type: 'warn', text: '先写一句想要什么样的绘本吧～' }); return; }
      if (genGo) { genGo.disabled = true; genGo.textContent = '✨ 正在写…'; }
      if (genNote) genNote.textContent = '正在按「黄金八步」写分页脚本…';
      api('/api/books/generate', { method: 'POST', body: { prompt: want, grade: S.grade } }).then(function (r) {
        if (genGo) { genGo.disabled = false; genGo.textContent = '✨ 生成绘本'; }
        if (genNote) genNote.textContent = (r.intro || '') + '　来源：' + (r.source === 'llm' ? '大模型' : '本地故事库');
        FS.play('chime');
        /* 生成完直接把它推到卡片流最前面并预览 */
        var b = r.book;
        var card = {
          id: b.id, title: b.title, emoji: b.emoji, conceptLabel: b.conceptLabel,
          ageLabel: b.ageLabel, logline: '', cover: '', progress: null
        };
        all = [card].concat(all.filter(function (x) { return x.id !== b.id; }));
        drawCards();
        mainBox.innerHTML = '';
        mainBox.appendChild(el('div', { class: 'pb-gen-result' }, [
          el('h3', { text: '✨ 生成好啦：' + b.emoji + '《' + b.title + '》' }),
          el('p', { class: 'muted small', text: (r.intro || '') }),
          el('p', { class: 'muted small', text: '目标：' + b.goal + '　障碍：' + b.obstacle }),
          el('p', { class: 'muted small', text: '三次尝试：' + (b.tries || []).join(' → ') }),
          el('p', { class: 'muted small', text: '领悟：' + b.insight }),
          el('p', { class: 'muted small', text: '共 ' + b.pageCount + ' 页 · ' + b.ageLabel + ' · 画风：' + (b.artStyle || '') })
        ]));
        setTimeout(function () { preview(b.id); }, 1400);
      }).catch(function (e) {
        if (genGo) { genGo.disabled = false; genGo.textContent = '✨ 生成绘本'; }
        if (genNote) genNote.textContent = '生成失败（' + e.message + '），再试一次吧。';
      });
    }
    if (genGo) AIQ.on(genGo, 'click', generate);
    if (genInput) AIQ.on(genInput, 'keydown', function (ev) { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) generate(); });
    AIQ.qsa('[data-gen]').forEach(function (b) {
      AIQ.on(b, 'click', function () { if (genInput) genInput.value = b.dataset.gen; generate(); });
    });

    load();
    /* 年级一变就重新取书；load 定义在上面，这里挂到 AIQ 上供外部调用 */
    AIQ.pbStudioReload = load;
  }
  AIQ.pbStudio = pbStudio;

/* ================= 十一、真正的动画片播放器（骨骼动画） ================= */
/**
 * 和「图片轮播」的根本区别：
 *   每一页是一个动画镜头，角色被拆成 9 个可独立运动的部件，
 *   由 CSS 关键帧按动作时间轴驱动 —— 肢体在动、表情在变、场景有微尘与叶片。
 */
var ACT_NAMES = {
  breathe: '站着呼吸', walk: '一步一步往前走', run: '跑起来', jump: '先蹲一下，再蹦起来',
  reach: '伸出手去够东西', cover: '抱住头缩成一团', spin: '高兴得原地转圈',
  fall: '一屁股坐倒', tiptoe: '踮起脚尖偷偷看', lie: '趴下来仔细看', back: '吓一跳往后退'
};

function openAnim(bookId) {
  var host = qs('#anim-root');
  if (!host) return;
  host.innerHTML = '<div class="panel"><p class="muted">正在准备动画…</p></div>';
  api('/api/anim/storyboard?id=' + encodeURIComponent(bookId) + '&grade=' + S.grade).then(function (r) {
    S.anim = r;
    S.shot = 0;
    S.answered = {};
    /* 关键一步：把服务端生成的关键帧 CSS 注入页面。
       没有这一步，所有骨骼 / 摄像机 / 视差动画都不会生效 —— 页面看起来就还是「图片在飘」。 */
    injectAnimCss(r.css);
    enterPlaying();
    drawAnim(host);
  }).catch(function (e) {
    host.innerHTML = '';
    host.appendChild(el('div', { class: 'panel' }, [
      el('p', { class: 'muted', text: '动画没能打开（' + e.message + '）' })
    ]));
  });
}

/**
 * 清掉舞台上的互动特效类。
 *
 * .pb-look / .pb-cheer / .pb-sorry 都作用在【整个舞台】上，
 * 而且 .pb-look 用的是 forwards —— 不清掉的话它会一直留在元素上，
 * 换到下一镜时整块画面（连背景带角色）都是歪的。
 */
function clearStageFx(el) {
  if (!el) return;
  el.classList.remove('pb-look', 'pb-cheer', 'pb-sorry');
}

/** 进入播放态：收起顶部说明区，把高度让给画面 */
function enterPlaying() {
  if (document.body.classList.contains('pb-playing')) return;
  document.body.classList.add('pb-playing');
  refitStage();
}
function exitPlaying() {
  document.body.classList.remove('pb-playing');
  refitStage();
}
/** 重新量一次画面高度（切全屏、改窗口、进出播放态都要重算） */
function refitStage() {
  var s = qs('.anim-stage');
  if (!s) return;
  if (document.body.classList.contains('pb-full')) fitFullStage(s);
  else fitAnimStage(s);
}

/** 全屏投屏模式：画面占满整个窗口，老师和全班一起看 */
function toggleFull() {
  var box = qs('#anim-outer') || qs('.anim-outer');
  if (!box) { AIQ.toast({ type: 'warn', text: '动画还没准备好' }); return; }
  enterPlaying();
  var on = document.body.classList.toggle('pb-full');
  var btn = qs('#pb-full-btn');
  if (btn) btn.textContent = on ? '✕ 退出全屏' : '⛶ 全屏投屏';
  /* 再调一次浏览器的真全屏：连地址栏都藏掉，投屏时更干净。
     失败也不影响 —— CSS 那套铺满窗口的兜底已经生效了。 */
  try {
    if (on && box.requestFullscreen && !document.fullscreenElement) box.requestFullscreen();
    else if (!on && document.fullscreenElement) document.exitFullscreen();
  } catch (e) { /* 用户拒绝或浏览器不支持，忽略 */ }
  if (on) AIQ.toast({ type: 'info', text: '按 Esc 或点「退出全屏」返回' });
  refitStage();
}
/**
 * 全屏时画面按窗口算，宽高都尽量吃满（16:10 等比，不裁切）。
 * 预算里要扣掉：顶栏之外的信息条(38) + 台词卡(130) + 控制条(72) + 间距(48)。
 */
function fitFullStage(frame) {
  var svg = qs('svg', frame);
  if (!svg) return;
  /* 台词卡与控制条在全屏时是浮层（fixed），压在画面下沿，
     但它们会盖住画面 —— 所以仍然要把这两条的高度让出来，
     只是「信息条在上、台词与控制在下」不再各占一行布局高度。 */
  var w = global.innerWidth - 40;
  var h = global.innerHeight - 200;
  var byW = Math.min(w, Math.round(h * 1.6));
  var byH = Math.round(byW / 1.6);
  if (byH > h) { byH = h; byW = Math.round(h * 1.6); }
  svg.style.width = byW + 'px';
  svg.style.height = byH + 'px';
}

/** 让动画画布自适应视口高度：整幅可见，不裁切 */
function fitAnimStage(stage) {
  var run = function () {
    clearStageFx(stage);
    var svg = qs('svg', stage);
    if (!svg) return;
    /* 画面是主角，占屏比要够大。
       下面的信息条 / 台词卡 / 控制条放不下就让它滚 —— 控制条是吸底的，
       滚动时按钮永远够得着，不会出现「看得见画面、点不到按钮」。 */
    var vh = global.innerHeight;
    /* 播放中把顶部说明区收起来，省下的高度全给画面 */
    var share = document.body.classList.contains('pb-playing') ? 0.72 : 0.60;
    if (vh < 760) share -= 0.06;
    var avail = Math.round(vh * share);
    var h = Math.max(280, Math.min(avail, 760));
    var w = Math.round(h * 1.6);
    var cap = Math.round(stage.clientWidth || 9999);
    if (w > cap) { w = cap; h = Math.round(w / 1.6); }
    svg.style.height = h + 'px';
    svg.style.width = w + 'px';
    svg.style.maxWidth = '100%';
    stage.style.height = 'auto';
    /* 小屏顺带把下半部分压紧（不依赖媒体查询，headless/缩放场景下也生效） */
    var tight = global.innerHeight < 850;
    var sub = qs('.anim-sub'), amb = qs('.anim-ambient'), ctrl = qs('.anim-ctrl'), info = qs('.anim-info');
    if (sub) sub.style.padding = tight ? '10px 14px' : '';
    if (amb) amb.style.margin = tight ? '7px 0' : '';
    if (ctrl) ctrl.style.marginTop = tight ? '8px' : '';
    if (info) info.style.marginBottom = tight ? '7px' : '';
    /* 不加黑底：让绘本画面直接铺在卡片上，避免左右出现两条黑边 */
    stage.style.background = 'transparent';
  };
  run();
  if (!S._fitBound) {
    S._fitBound = true;
    global.addEventListener('resize', function () {
      var s = qs('.anim-stage');
      if (s) fitAnimStage(s);
    });
  }
}

/** 注入动画关键帧 CSS（只注入一次，换书时替换） */
function injectAnimCss(css) {
  if (!css) return;
  var tag = qs('#anim-keyframes');
  if (!tag) {
    tag = el('style', { id: 'anim-keyframes' });
    document.head.appendChild(tag);
  }
  tag.textContent = css;
}

function drawAnim(host) {
  var r = S.anim;
  if (!r || !r.shots || !r.shots.length) return;
  var shot = r.shots[S.shot];
  /* 版面结构：.anim-outer > .anim-body > [ 画面 → 信息条 → 台词 → 互动 → 控制条 ]
     信息条放在画面【下方】。放上方时会被页面标题和定位的画布压住；放下方则永远在
     正常文档流里，怎么改版面都不会被盖掉 —— 「按键不显示」就是这么来的。 */
  if (!qs('#anim-outer')) {
    var outer = qs('#anim-root') || host.parentNode;
    if (outer) {
      var box = el('div', { class: 'anim-outer', id: 'anim-outer' });
      var body0 = el('div', { class: 'anim-body', id: 'anim-body' });
      box.appendChild(body0);
      host.innerHTML = '';
      host.appendChild(box);
      host = body0;
    }
  } else {
    host = qs('#anim-body');
  }
  host.innerHTML = '';

  /* 动画舞台：SVG 自带骨骼分组 + CSS 关键帧。
     ⚠️ 绝不能带上一镜留下的互动类：.pb-look 是 forwards 的，
     留着就会让【整块画面（含背景）】一直歪着 —— 这就是「歪了」的真凶。 */
  var stage = el('div', { class: 'anim-stage', html: shot.art });
  host.appendChild(stage);
  /* 镜间过渡：硬切对低幼观众是「突然跳变」，加一次轻柔的淡入 + 扫光。
     只有换镜时才放（第一次渲染也放，但连播时不会重复），动画结束自动失效。 */
  if (S._lastShot !== S.shot) {
    stage.classList.add('is-cut');
    global.setTimeout(function () { stage.classList.remove('is-cut'); }, 360);
    S._lastShot = S.shot;
  }
  /* SVG 有固有比例，纯 CSS 的 max-height 有时压不住；
     这里直接按视口算一次高度，保证整幅动画一眼看全，不会把角色切到屏幕外。 */
  fitAnimStage(stage);

  /* 信息条：镜头序号 / 动作 / 黄金八步 / 景别 / 运镜 / 导出按钮 —— 紧贴画面下方 */
  var bar = el('div', { class: 'anim-info' }, [
    el('span', { class: 'anim-step', text: '镜头 ' + shot.index + ' / ' + r.shots.length }),
    el('span', { class: 'anim-act', text: '🎬 ' + (ACT_NAMES[shot.action] || shot.action) }),
    el('span', { class: 'anim-arc', text: shot.arcName || '' }),
    el('span', { class: 'anim-cam', text: '📷 ' + shot.camera }),
    el('span', { class: 'anim-cam2', text: '🎥 ' + (shot.camText || '镜头稳住') }),
    el('button', {
      class: 'btn btn-primary btn-sm anim-export', type: 'button', text: '⬇️ 导出视频',
      onclick: function () { exportVideo(); }
    })
  ]);
  host.appendChild(bar);

  /* 台词与旁白 */
  var sub = el('div', { class: 'anim-sub' });
  if (shot.say) {
    sub.appendChild(el('div', { class: 'anim-say' }, [
      el('span', { class: 'anim-who', text: whoName(shot.say.who) }),
      el('span', { text: '「' + shot.say.text + '」' })
    ]));
  }
  sub.appendChild(el('div', { class: 'anim-line', text: (shot.lines || []).join('') }));
  sub.appendChild(el('div', { class: 'anim-pinyin', text: shot.pinyinText || '' }));
  host.appendChild(sub);

  /* 场景动态说明：让孩子（和老师）知道画面里有什么在动 */
  host.appendChild(el('div', { class: 'anim-ambient' }, [
    el('span', { class: 'anim-amb-t', text: '画面里正在动：' }),
    el('span', { text: (shot.ambient || []).map(function (a) { return a.name; }).join('、') || '角色呼吸' })
  ]));

  /* 视频内互动节点：播到这里停下来，让小AI 转过头来问孩子一句 */
  if (shot.interaction && S.answered[shot.index] === undefined) {
    /* 打破第四面墙：角色停下脚步，转向镜头 */
    var stageEl = qs('.anim-stage');
    if (stageEl) { clearStageFx(stageEl); stageEl.classList.add('pb-look'); }
    host.appendChild(buildAnimAsk(shot, host));
  } else if (shot.interaction) {
    host.appendChild(el('div', { class: 'anim-answered' }, [
      el('span', { text: '✅ ' + (S.answered[shot.index] ? shot.interaction.right : '没关系，我们继续看') })
    ]));
  }

  /* 播放控制。两个开关（连播 / 字幕）用高亮表达状态，不靠文字变化。 */
  host.appendChild(el('div', { class: 'anim-ctrl' }, [
    el('button', { class: 'pb-btn', type: 'button', text: '← 上一个镜头', disabled: S.shot <= 0,
      onclick: function () { stopPlay(); S.shot--; drawAnim(host); } }),
    el('button', {
      class: 'pb-btn is-main', type: 'button', id: 'pb-play-btn',
      text: S.playing ? '⏸ 暂停' : '▶ 连播整本',
      onclick: function () { togglePlay(host); }
    }),
    el('button', {
      class: 'pb-btn', type: 'button', text: '🔊 念这一句',
      onclick: function () {
        /* 第一次点击是用户手势，浏览器才允许出声 —— 顺手把背景音乐也起起来 */
        if (FS.bgm && !FS.bgm.isOn()) { FS.unlock(); FS.bgm.start(bgmMoodOf(shot.mood)); var b = qs('#pb-bgm-btn'); if (b) b.classList.add('is-on'); }
        narrate(shot);
      }
    }),
    el('button', { class: 'pb-btn', type: 'button', text: '下一个镜头 →', disabled: S.shot >= r.shots.length - 1,
      onclick: function () { stopPlay(); S.shot++; drawAnim(host); } }),
    el('button', { class: 'pb-btn is-round' + (S.subOn === false ? '' : ' is-on'), type: 'button', id: 'pb-sub-btn',
      text: '字', title: '字幕开关（大屏投屏可关掉正文）', onclick: function () { toggleSub(host); } }),
    el('button', { class: 'pb-btn is-round' + (S.autoPlay ? ' is-on' : ''), type: 'button', id: 'pb-auto-btn',
      text: '⟳', title: '连播开关', onclick: function () { toggleAuto(host); } }),
    el('button', { class: 'pb-btn is-round', type: 'button', id: 'pb-bgm-btn', text: '♪', title: '背景音乐开关', onclick: function () { toggleBgm(); } }),
    el('button', { class: 'pb-btn', type: 'button', id: 'pb-full-btn', text: '⛶ 全屏投屏', onclick: function () { toggleFull(); } }),
    el('button', { class: 'pb-btn is-round', type: 'button', text: '💬', title: '问小AI', onclick: function () { initAskPanel(); } })
  ]));
  /* 背景音乐跟着情绪走：换镜时如果情绪大类变了，就换一段琶音 */
  if (FS.bgm && FS.bgm.isOn()) {
    FS.bgm.setMood(bgmMoodOf(shot.mood));
  }

  /* 控制条重建之后按钮文本可能是旧的（比如暂停/连播），同步一次 */
  var pb = qs('#pb-play-btn');
  if (pb) pb.textContent = S.playing ? '⏸ 暂停' : '▶ 连播整本';

  /* 重算画面尺寸。放在最后 —— 前面重建过 DOM，
     而且全屏切换 / 连播都会改变可用高度，必须重新量一次。 */
  refitStage();

  /* 连播：先把这一句读完，再进下一个镜头。
     有互动节点的镜头绝不自动跳过 —— 必须等孩子答完。 */
  if (S.autoPlay) {
    if (S.animTimer) clearTimeout(S.animTimer);
    narrate(shot);
    if (!shot.interaction || S.answered[shot.index] !== undefined) {
      S.animTimer = setTimeout(function () { nextShot(host); },
        Math.max(2600, (shot.duration || 2) * 1000 + (S.subOn === false ? 900 : 1800)));
    }
  }
}

/** 情绪 → 背景音乐的段落。只分三类，避免频繁换曲。 */
function bgmMoodOf(mood) {
  if (mood === 'success' || mood === 'surprise' || mood === 'wonder' || mood === 'happy') return 'bright';
  if (mood === 'setback' || mood === 'worried' || mood === 'calm') return 'calm';
  return 'gentle';
}
/** 背景音乐开关（和连播同一条逻辑：播放时才有音乐） */
function toggleBgm() {
  if (!FS.bgm) { AIQ.toast({ type: 'warn', text: '这个浏览器不支持音频合成' }); return; }
  var b = qs('#pb-bgm-btn');
  if (FS.bgm.isOn()) {
    FS.bgm.stop();
    if (b) b.classList.remove('is-on');
    AIQ.toast({ type: 'info', text: '背景音乐已关' });
    return;
  }
  FS.unlock();
  var mood = (S.anim && S.anim.shots[S.shot] && S.anim.shots[S.shot].mood) || 'happy';
  var ok = FS.bgm.start(bgmMoodOf(mood));
  if (b) b.classList.toggle('is-on', !!ok);
  AIQ.toast(ok ? { type: 'ok', text: '背景音乐已开（五声音阶，轻轻垫底）' }
              : { type: 'warn', text: '浏览器挡住了声音，先点一下页面任意处再试' });
}

/** 连续播放：一镜接一镜自动演完，适合投屏给全班看 */
function togglePlay(host) {
  S.playing = !S.playing;
  S.autoPlay = S.playing;                  /* 连播整本 = 连播 + 从头演 */
  if (S.playing) {
    S.shot = 0;
    S.answered = {};
    enterPlaying();
    /* 连播时自动起背景音乐 */
    if (FS.bgm && !FS.bgm.isOn()) {
      FS.unlock();
      FS.bgm.start(bgmMoodOf((S.anim.shots[0] || {}).mood));
      var bb = qs('#pb-bgm-btn');
      if (bb) bb.classList.add('is-on');
    }
    AIQ.toast({ type: 'ok', text: '开始连播，点「暂停」可以停下来' });
  } else {
    stopPlay();
    if (FS.bgm) FS.bgm.stop();
  }
  drawAnim(host);
}
function stopPlay() {
  S.playing = false;
  if (S.animTimer) { clearTimeout(S.animTimer); S.animTimer = null; }
  var b = qs('#pb-play-btn');
  if (b) b.textContent = '▶ 连播整本';
}
/** 字幕开关：大屏投屏时可以关掉正文，只留角色台词 */
function toggleSub() {
  S.subOn = S.subOn === false;
  document.body.classList.toggle('pb-nosub', S.subOn === false);
  var b = qs('#pb-sub-btn');
  if (b) b.classList.toggle('is-on', S.subOn !== false);
  AIQ.toast({ type: 'info', text: S.subOn === false ? '字幕已关闭（只留角色台词）' : '字幕已打开' });
}
/** 连播开关 */
function toggleAuto(host) {
  S.autoPlay = !S.autoPlay;
  var b = qs('#pb-auto-btn');
  if (b) b.classList.toggle('is-on', S.autoPlay);
  AIQ.toast({ type: 'info', text: S.autoPlay ? '连播已打开' : '连播已关闭' });
  if (S.autoPlay) drawAnim(host);
  else if (S.animTimer) { clearTimeout(S.animTimer); S.animTimer = null; }
}

/** 朗读这一镜，同时让嘴巴动起来（口型同步） */
function narrate(shot) {
  FS.unlock();
  var txt = (shot.lines || []).join('');
  if (shot.say) txt += '。' + whoName(shot.say.who) + '说：' + shot.say.text;
  var stage = qs('.anim-stage');
  if (stage) stage.classList.add('is-talking');
  TTS.speak(txt, {
    rate: S.rate, pitch: S.pitch,
    onEnd: function () { if (stage) stage.classList.remove('is-talking'); }
  });
  /* 保险：万一 onEnd 没回调，2.5 秒后也闭嘴，不让嘴巴一直张着 */
  setTimeout(function () { if (stage) stage.classList.remove('is-talking'); }, Math.max(2500, txt.length * 260));
}

/** 视频内互动层：暂停 → 提问 → 孩子选 → 小AI 有反应 → 无缝继续 */
function buildAnimAsk(shot, host) {
  var iv = shot.interaction;
  var box = el('div', { class: 'anim-ask' }, [
    el('div', { class: 'anim-ask-head' }, [
      el('span', { class: 'anim-ask-who', text: iv.who }),
      el('span', { text: '「' + iv.q + '」' })
    ])
  ]);
  var opts = el('div', { class: 'anim-ask-opts' });
  var done = false;
  iv.options.forEach(function (t, i) {
    var b = el('button', { class: 'anim-ask-opt', type: 'button', text: t });
    AIQ.on(b, 'click', function () {
      if (done) return;
      FS.unlock();
      var stageBox = qs('.anim-stage');
      if (i === iv.answer) {
        done = true;
        S.answered[shot.index] = true;
        AIQ.qsa('.anim-ask-opt', opts).forEach(function (x) { x.disabled = true; });
        b.classList.add('is-right');
        FS.play('cheer');
        /* 即时肢体反馈：原地蹦跳转圈 */
        if (stageBox) {
          stageBox.classList.remove('pb-look', 'pb-sorry');
          stageBox.classList.add('pb-cheer');
          setTimeout(function () { stageBox.classList.remove('pb-cheer'); }, 1200);
        }
        box.appendChild(el('div', { class: 'anim-ask-fb is-ok' }, [
          el('b', { text: '🎉' }), el('span', { text: iv.right })
        ]));
        speakLine(iv.right);
        /* 无缝继续：答对了就往下演 */
        setTimeout(function () { nextShot(host); }, 1800);
      } else {
        /* 不锁死、不变红：温柔提示再试一次，角色歪头道歉 */
        b.classList.add('is-soft');
        FS.play('soft');
        if (stageBox) {
          stageBox.classList.remove('pb-look', 'pb-cheer');
          stageBox.classList.add('pb-sorry');
          setTimeout(function () { stageBox.classList.remove('pb-sorry'); stageBox.classList.add('pb-look'); }, 900);
        }
        var fb = qs('.anim-ask-fb.is-soft', box);
        if (fb) fb.remove();
        box.appendChild(el('div', { class: 'anim-ask-fb is-soft' }, [
          el('b', { text: '🤗' }), el('span', { text: iv.wrong })
        ]));
        setTimeout(function () { b.classList.remove('is-soft'); }, 900);
      }
    });
    opts.appendChild(b);
  });
  box.appendChild(opts);
  return box;
}
/** 全局按键与窗口变化（只绑一次）：
    Esc 退出全屏 · ← → 切镜 · 空格 重演 */
function bindAnimGlobal() {
  if (S._animBound) return;
  S._animBound = true;
  global.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('pb-full')) { toggleFull(); return; }
    if (!S.anim) return;
    var btns = AIQ.qsa('.anim-ctrl button');
    if (e.key === 'ArrowRight' && btns[3] && !btns[3].disabled) btns[3].click();
    else if (e.key === 'ArrowLeft' && btns[0] && !btns[0].disabled) btns[0].click();
    else if (e.key === ' ' && btns[1]) { e.preventDefault(); btns[1].click(); }
  });
  global.addEventListener('resize', function () { refitStage(); });
}

/** 导出视频：把当前的骨骼动画交给后台渲染成可下载的 MP4 */
function exportVideo() {
  var r = S.anim;
  if (!r) return;
  AIQ.toast({ type: 'info', text: '正在把动画导出成视频，请稍候…' });
  api('/api/video/render', {
    method: 'POST',
    body: { id: r.id, grade: S.grade, voice: true, subtitle: true }
  }).then(function (res) {
    if (!res.ok) throw new Error(res.error || '提交失败');
    pollExport(res.job.id);
  }).catch(function (e) {
    AIQ.toast({ type: 'warn', text: '导出失败：' + e.message + '（视频需要本机的 ffmpeg 与 Chrome）' });
  });
}
function pollExport(id) {
  api('/api/video/job?id=' + encodeURIComponent(id)).then(function (res) {
    var j = res.job;
    if (j.status === 'done') {
      var host = qs('#anim-root');
      var box = el('div', { class: 'anim-export-done' }, [
        el('b', { text: '🎬 导出好啦：' + j.title + ' · ' + (j.seconds || 0) + ' 秒' }),
        el('a', { class: 'btn btn-primary btn-sm', href: j.url, download: j.title + '.mp4', text: '⬇️ 下载 MP4' })
      ]);
      if (host) host.insertBefore(box, host.firstChild);
      AIQ.toast({ type: 'ok', text: '视频导出完成，可以下载了' });
      return;
    }
    if (j.status === 'failed') { AIQ.toast({ type: 'warn', text: '导出失败：' + (j.error || '未知原因') }); return; }
    AIQ.toast({ type: 'info', text: '导出中：' + (j.step || '') + ' ' + (j.percent || 0) + '%' });
    setTimeout(function () { pollExport(id); }, 1200);
  }).catch(function () { setTimeout(function () { pollExport(id); }, 1800); });
}

function nextShot(host) {
  var r = S.anim;
  if (!r) return;
  if (S.shot < r.shots.length - 1) { S.shot++; drawAnim(host); }
  else {
    S.autoPlay = false;
    S.playing = false;
    var b = qs('#pb-play-btn');
    if (b) b.textContent = '▶ 连播整本';
    AIQ.toast({ type: 'ok', text: '整本演完啦！' });
  }
}
function speakLine(txt) {
  if (!TTS.supported) return;
  var stage = qs('.anim-stage');
  if (stage) stage.classList.add('is-talking');
  TTS.speak(txt, { rate: S.rate, pitch: S.pitch, onEnd: function () { if (stage) stage.classList.remove('is-talking'); } });
}

/** 全局按键与窗口变化（只绑一次）：
    Esc 退出全屏 · ← → 切镜 · 空格 重演 */
function bindAnimGlobal() {
  if (S._animBound) return;
  S._animBound = true;
  global.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('pb-full')) { toggleFull(); return; }
    if (!S.anim) return;
    var btns = qsa('.anim-ctrl button');
    if (e.key === 'ArrowRight' && btns[3] && !btns[3].disabled) btns[3].click();
    else if (e.key === 'ArrowLeft' && btns[0] && !btns[0].disabled) btns[0].click();
    else if (e.key === ' ' && btns[1]) { e.preventDefault(); btns[1].click(); }
  });
  global.addEventListener('resize', function () { refitStage(); });
}

function initAnim() {
  var host = qs('#anim-root');
  if (!host) return;
  var sel = qs('#anim-book');
  api('/api/books?grade=' + S.grade + '&theme=all').then(function (data) {
    (data.stories || []).forEach(function (st) {
      sel.appendChild(el('option', { value: st.id, text: st.emoji + ' ' + st.title }));
    });
    AIQ.on(sel, 'change', function () { openAnim(sel.value); });
    S.autoPlay = qs('#anim-auto') && qs('#anim-auto').checked;
    if (S.subOn === undefined) S.subOn = true;
    AIQ.on(qs('#anim-auto'), 'change', function () { S.autoPlay = qs('#anim-auto').checked; });
    openAnim(data.stories[0] ? data.stories[0].id : 'wake');
    bindAnimGlobal();
  }).catch(function (e) {
    host.innerHTML = '';
    host.appendChild(el('p', { class: 'muted', text: '取不到故事列表（' + e.message + '）' }));
  });
}


  AIQ.ready(init);
})(window);
