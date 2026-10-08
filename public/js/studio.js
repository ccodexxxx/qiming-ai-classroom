/*!
 * studio.js —— 创作工坊客户端
 *   1) 原理动画播放器：把服务端下发的绘图指令渲染成 SVG，支持分步播放与可交互参数
 *   2) AI 绘本阅读器：按年级生成文字、逐页阅读、朗读、导出单页
 */
(function (global) {
  'use strict';
  var AIQ = global.AIQ;
  if (!AIQ) return;
  var el = AIQ.el, qs = AIQ.qs, api = AIQ.api;
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ================= 指令 → SVG ================= */
  function svgNode(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    });
    return n;
  }

  /**
   * 渲染一帧绘图指令
   * 指令格式见 server/lib/art.js 顶部注释
   */
  function renderFrame(host, cmds, size) {
    AIQ.clear(host);
    var scale = 1.5;
    var w = Math.round(size.w * scale), h = Math.round(size.h * scale);
    var svg = svgNode('svg', {
      viewBox: '0 0 ' + w + ' ' + h,
      class: 'aiq-svg',
      xmlns: SVGNS,
      role: 'img',
      'aria-label': '原理动画画面'
    });
    svg.appendChild(svgNode('rect', { x: 0, y: 0, width: w, height: h, fill: '#fffdf8' }));
    var g = svgNode('g', { transform: 'scale(' + scale + ')' });
    (cmds || []).forEach(function (c, idx) {
      var t = c[0];
      var o = (c[c.length - 1] && typeof c[c.length - 1] === 'object' && !Array.isArray(c[c.length - 1])) ? c[c.length - 1] : {};
      var node = null;
      if (t === 'rect') {
        node = svgNode('rect', {
          x: c[1], y: c[2], width: c[3], height: c[4],
          rx: o.rx === undefined ? 8 : o.rx,
          fill: o.fill || 'none', stroke: o.stroke || 'none',
          'stroke-width': o.width || 1.5, opacity: o.opacity
        });
      } else if (t === 'circle') {
        node = svgNode('circle', { cx: c[1], cy: c[2], r: c[3], fill: o.fill || 'none', stroke: o.stroke || 'none', 'stroke-width': o.width || 1.5, opacity: o.opacity });
      } else if (t === 'line') {
        node = svgNode('line', { x1: c[1], y1: c[2], x2: c[3], y2: c[4], stroke: o.stroke || '#333', 'stroke-width': o.width || 1.5, 'stroke-dasharray': o.dash || null, 'stroke-linecap': 'round' });
      } else if (t === 'path') {
        node = svgNode('path', { d: c[1], fill: o.fill || 'none', stroke: o.stroke || 'none', 'stroke-width': o.width || 2, 'stroke-dasharray': o.dash || null, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      } else if (t === 'poly') {
        node = svgNode('polygon', { points: c[1].map(function (p) { return p[0] + ',' + p[1]; }).join(' '), fill: o.fill || 'none', stroke: o.stroke || 'none', 'stroke-width': o.width || 1.5 });
      } else if (t === 'text') {
        node = svgNode('text', {
          x: c[1], y: c[2],
          'font-size': o.size || 13,
          fill: o.fill || '#243044',
          'text-anchor': o.anchor || 'start',
          'font-weight': o.weight || null,
          'font-family': 'inherit'
        });
        node.textContent = c[3];
      }
      if (node) {
        node.classList.add('a-el');
        node.style.animationDelay = Math.min(idx * 70, 1000) + 'ms';
        if (t === 'circle') node.classList.add('a-dot');
        if ((t === 'line' || t === 'path') && !o.dash) node.classList.add('a-draw');
        g.appendChild(node);
      }
    });
    svg.appendChild(g);
    host.appendChild(svg);
    return svg;
  }

  /* ================= 动画播放器 ================= */
  function animPlayer(data, mount) {
    var size = data.canvas || { w: 460, h: 280 };
    var grade = Number(data.grade || 5);
    var junior = data.juniorMode !== undefined ? !!data.juniorMode : grade <= 3;
    var voiceOn = junior;
    var i = 0, playing = false, timer = null, swapTimer = null;
    function calcStepMs() {
      var total = junior ? 23000 : 22000;
      return Math.max(junior ? 2200 : 1600, Math.min(junior ? 5600 : 5200, Math.round(total / data.phases.length)));
    }
    var stepMs = calcStepMs();

    var figure = el('div', { class: 'anim-figure' });
    if (junior) figure.classList.add('is-junior');
    var stage = el('div', { class: 'aiq-stage' });
    var subtitle = el('div', { class: 'anim-subtitle' });
    var barFill = el('i', { style: { width: '0%' } });
    var progress = el('div', { class: 'anim-progress' }, [barFill]);
    var counter = el('span', { class: 'small muted' });
    var duration = el('span', { class: 'anim-duration' });
    var playBtn = el('button', { class: 'btn btn-primary btn-sm', type: 'button', text: '⏸ 暂停' });
    var voiceBtn = el('button', { class: 'btn btn-ghost btn-sm' + (voiceOn ? ' is-on' : ''), type: 'button', text: voiceOn ? '🔊 讲解' : '🔈 讲解' });
    var juniorBtn = el('button', { class: 'btn btn-ghost btn-sm' + (junior ? ' is-on' : ''), type: 'button', text: '🧒 低年级' });
    var sliderRow = el('div', { class: 'anim-slider' });

    function captionOf(p) {
      if (!p) return '';
      return (junior && p.junior) ? p.junior : (p.caption || '');
    }
    function pickVoice() {
      if (!global.speechSynthesis) return null;
      var voices = global.speechSynthesis.getVoices() || [];
      var zh = voices.filter(function (v) { return /zh|cmn|chinese/i.test(v.lang); });
      zh.sort(function (a, b) {
        var af = /female|女|xiaoxiao|huihui|yaoyao/i.test(a.name) ? 1 : 0;
        var bf = /female|女|xiaoxiao|huihui|yaoyao/i.test(b.name) ? 1 : 0;
        return bf - af;
      });
      return zh[0] || null;
    }
    function speak(text) {
      if (!voiceOn || !global.speechSynthesis) return;
      try {
        global.speechSynthesis.cancel();
        var u = new global.SpeechSynthesisUtterance(String(text || '').replace(/[「」{}→]/g, ''));
        u.lang = 'zh-CN';
        u.rate = junior ? 0.82 : 0.96;
        u.pitch = junior ? 1.12 : 1.0;
        var v = pickVoice();
        if (v) u.voice = v;
        global.speechSynthesis.speak(u);
      } catch (e) {}
    }
    function stopVoice() { try { if (global.speechSynthesis) global.speechSynthesis.cancel(); } catch (e) {} }

    function render(animate) {
      if (!data.phases[i]) return;
      subtitle.textContent = captionOf(data.phases[i]);
      counter.textContent = (i + 1) + ' / ' + data.phases.length;
      duration.textContent = '约 ' + Math.round(stepMs * data.phases.length / 1000) + ' 秒';
      if (!animate) { renderFrame(stage, data.phases[i].cmds, size); return; }
      clearTimeout(swapTimer);
      stage.classList.add('is-out');
      swapTimer = setTimeout(function () {
        renderFrame(stage, data.phases[i].cmds, size);
        stage.classList.remove('is-out');
        stage.classList.remove('is-cut');
        void stage.offsetWidth;
        stage.classList.add('is-cut');
      }, 220);
    }

    function resetProgress() {
      barFill.style.transition = 'none';
      barFill.style.width = (i / data.phases.length * 100) + '%';
      void barFill.offsetWidth;
      barFill.style.transition = 'width ' + stepMs + 'ms linear';
      barFill.style.width = ((i + 1) / data.phases.length * 100) + '%';
    }
    function stopProgress() {
      barFill.style.transition = 'none';
      barFill.style.width = (i / data.phases.length * 100) + '%';
    }

    function advance() {
      if (i >= data.phases.length - 1) { stop(); fireComplete(); return; }
      i++; render(true); speak(captionOf(data.phases[i])); resetProgress(); restartTimer();
    }
    function restartTimer() { clearTimeout(timer); timer = setTimeout(advance, stepMs); }
    function play() {
      if (playing || data.phases.length < 1) return;
      if (data.phases.length === 1) { render(false); fireComplete(); return; }
      playing = true; playBtn.textContent = '⏸ 暂停';
      speak(captionOf(data.phases[i])); resetProgress(); restartTimer();
    }
    function stop() {
      playing = false; clearTimeout(timer); timer = null; stopProgress();
      playBtn.textContent = '▶ 播放';
    }
    function go(k) {
      i = AIQ.clamp(k, 0, data.phases.length - 1);
      stopVoice();
      render(true);
      if (playing) { speak(captionOf(data.phases[i])); resetProgress(); restartTimer(); }
      else stopProgress();
    }
    function fireComplete() { if (typeof data.onComplete === 'function') data.onComplete(); }

    function toggleVoice() {
      voiceOn = !voiceOn;
      voiceBtn.classList.toggle('is-on', voiceOn);
      voiceBtn.textContent = voiceOn ? '🔊 讲解' : '🔈 讲解';
      if (voiceOn) speak(captionOf(data.phases[i])); else stopVoice();
    }
    function toggleJunior() {
      junior = !junior;
      juniorBtn.classList.toggle('is-on', junior);
      figure.classList.toggle('is-junior', junior);
      stepMs = calcStepMs();
      render(true);
      if (playing) { stopVoice(); speak(captionOf(data.phases[i])); resetProgress(); restartTimer(); }
      else if (voiceOn) speak(captionOf(data.phases[i]));
    }

    playBtn.addEventListener('click', function () { playing ? stop() : play(); });
    voiceBtn.addEventListener('click', toggleVoice);
    juniorBtn.addEventListener('click', toggleJunior);
    progress.addEventListener('click', function (ev) {
      var r = progress.getBoundingClientRect();
      var ratio = (ev.clientX - r.left) / Math.max(1, r.width);
      go(Math.floor(ratio * data.phases.length));
    });

    figure.appendChild(stage);
    figure.appendChild(subtitle);
    figure.appendChild(progress);
    figure.appendChild(el('div', { class: 'anim-controls' }, [
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '⏮', title: '上一步', onclick: function () { go(i - 1); } }),
      playBtn,
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '⏭', title: '下一步', onclick: function () { if (i >= data.phases.length - 1) fireComplete(); else go(i + 1); } }),
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '↺', title: '重播', onclick: function () { stop(); go(0); play(); } }),
      voiceBtn,
      juniorBtn,
      counter,
      duration
    ]));

    /* 可交互模式：把参数滑杆接上服务端重算 */
    if (data.interactive) {
      var label = el('span', { class: 'small muted' });
      var range = el('input', { type: 'range', min: '0', max: '100', value: '50' });
      var hint = el('span', { class: 'small' });
      function refresh() {
        var t = Number(range.value) / 100;
        if (data.interactive === 'boundary') {
          label.textContent = '分界线位置';
          hint.textContent = '拖动看看准确率怎么变';
          renderFrame(stage, boundaryAt(t), size);
        } else if (data.interactive === 'temperature') {
          label.textContent = '温度（创造力）';
          hint.textContent = t < 0.4 ? '低：几乎总挑概率最高的词' : (t > 1.0 ? '高：更有创意但容易跑题' : '适中：稳定又有变化');
          renderFrame(stage, temperatureAt(t), size);
        } else if (data.interactive === 'bias') {
          label.textContent = '数据均衡程度';
          hint.textContent = t < 0.5 ? '不平衡：少数群体几乎失灵' : '均衡：两个群体表现接近';
          renderFrame(stage, biasAt(t), size);
        }
      }
      range.addEventListener('input', refresh);
      sliderRow.appendChild(label);
      sliderRow.appendChild(range);
      sliderRow.appendChild(hint);
      figure.appendChild(el('div', { class: 'anim-slider' }, [
        el('button', {
          class: 'btn btn-ghost btn-sm', type: 'button', text: '🎛 动手试试',
          onclick: function () { sliderRow.hidden = !sliderRow.hidden; if (sliderRow.hidden) render(false); else { stop(); refresh(); } }
        })
      ]));
      figure.appendChild(sliderRow);
      sliderRow.hidden = true;
    }

    render(false);
    mount.appendChild(figure);
    play();

    /* 交互重算：与服务端 art.js 中同名函数保持一致的简化版本 */
    function boundaryAt(t) {
      var pts = cloudLike(5, 26, [0.32, 0.36], [0.7, 0.68], 0.22);
      var cmds = [];
      for (var g = 0; g <= 4; g++) cmds.push(['line', 30, 24 + g * 46, 430, 24 + g * 46, { stroke: 'rgba(36,48,68,.07)' }]);
      var correct = 0;
      pts.forEach(function (p) {
        var py = 24 + p.y * 190;
        var pred = py > 30 + t * 190 ? 0 : 1;
        if (pred === p.cls) correct++;
        cmds.push(['circle', p.x * 400 + 30, py, 7, { fill: p.cls ? '#d4637f' : '#2b7fb8', stroke: pred === p.cls ? '#1f6f5c' : '#c2566f', width: 2.4 }]);
      });
      cmds.push(['line', 30, 30 + t * 190, 430, 30 + t * 190, { stroke: '#c98a1b', width: 3, dash: '8 5' }]);
      cmds.push(['text', 36, 258, '黄线 = 决策边界　准确率 ' + Math.round(correct / pts.length * 100) + '%', { size: 12.5, fill: '#c98a1b' }]);
      return cmds;
    }
    function temperatureAt(t) {
      var temp = 0.15 + t * 1.35;
      var cands = [{ w: '小', p: 0.36 }, { w: '老', p: 0.27 }, { w: '神', p: 0.18 }, { w: '快乐的', p: 0.11 }, { w: '会说话的', p: 0.08 }];
      var cmds = [
        ['rect', 24, 26, 412, 40, { fill: 'rgba(36,48,68,.05)', stroke: 'rgba(36,48,68,.18)', rx: 10 }],
        ['text', 38, 52, '从前 有一座 山 ， 山里 有个', { size: 14, fill: '#243044' }],
        ['text', 24, 92, '模型给出的下一个词概率：', { size: 12.5, fill: '#2b7fb8' }]
      ];
      var ps = cands.map(function (c) { return Math.pow(c.p, 1 / Math.max(0.15, temp)); });
      var sum = ps.reduce(function (a, b) { return a + b; }, 0);
      ps = ps.map(function (p) { return p / sum; });
      ps.forEach(function (p, k) {
        var y = 108 + k * 26;
        cmds.push(['text', 28, y + 14, cands[k].w, { size: 12.5, fill: '#243044' }]);
        cmds.push(['rect', 126, y + 2, Math.max(4, p * 190), 15, { rx: 5, fill: '#2b7fb8', opacity: 0.85 }]);
        cmds.push(['text', 330, y + 14, (p * 100).toFixed(0) + '%', { size: 11.5, fill: '#8494a6' }]);
      });
      var best = ps.indexOf(Math.max.apply(null, ps));
      cmds.push(['text', 24, 258, '最可能接的是「' + cands[best].w + '」（温度 ' + temp.toFixed(2) + '）', { size: 12.5, fill: '#c98a1b' }]);
      return cmds;
    }
    function biasAt(t) {
      var nA = Math.round(4 + (1 - t) * 18);
      var nB = Math.round(4 + t * 18);
      var accA = 92, accB = Math.round(52 + t * 36);
      return [
        ['text', 30, 40, '训练数据里的样本数量', { size: 12.5, fill: '#2b7fb8', weight: 'bold' }],
        ['text', 30, 74, '群体 A（白天照片）', { size: 12.5, fill: '#5b6b7c' }],
        ['rect', 210, 58, nA * 7, 20, { rx: 6, fill: '#2b7fb8' }],
        ['text', 218 + nA * 7, 74, nA + ' 张', { size: 12, fill: '#243044' }],
        ['text', 30, 118, '群体 B（夜间照片）', { size: 12.5, fill: '#5b6b7c' }],
        ['rect', 210, 102, Math.max(8, nB * 7), 20, { rx: 6, fill: '#c98a1b' }],
        ['text', 218 + Math.max(8, nB * 7), 118, nB + ' 张', { size: 12, fill: '#243044' }],
        ['text', 30, 162, '测试表现（准确率）', { size: 12.5, fill: '#2b7fb8', weight: 'bold' }],
        ['rect', 210, 148, accA * 1.6, 18, { rx: 6, fill: 'rgba(31,111,92,.55)' }],
        ['text', 216 + accA * 1.6, 162, 'A ' + accA + '%', { size: 11.5, fill: '#1f6f5c' }],
        ['rect', 210, 176, accB * 1.6, 18, { rx: 6, fill: t < 0.5 ? 'rgba(194,86,111,.55)' : 'rgba(31,111,92,.55)' }],
        ['text', 216 + accB * 1.6, 190, 'B ' + accB + '%', { size: 11.5, fill: t < 0.5 ? '#c2566f' : '#1f6f5c' }],
        ['text', 30, 232, t < 0.5 ? '数据不平衡 → 模型对样本少的群体几乎失灵' : '数据对齐之后 → 两个群体的表现接近了', { size: 12.5, fill: '#c98a1b' }]
      ];
    }
    function cloudLike(seed, n, cA, cB, spread) {
      var x = seed * 9301 + 49297;
      function rnd() { x = (x * 9301 + 49297) % 233280; return x / 233280; }
      var pts = [];
      for (var k = 0; k < n; k++) {
        var c = k % 2 === 0 ? cA : cB;
        pts.push({
          x: AIQ.clamp(c[0] + (rnd() - 0.5) * spread, 0.06, 0.94),
          y: AIQ.clamp(c[1] + (rnd() - 0.5) * spread, 0.06, 0.94),
          cls: k % 2
        });
      }
      return pts;
    }

    return { destroy: function () { stop(); stopVoice(); clearTimeout(swapTimer); } };
  }

  /* ================= 侧栏：知识点说明 ================= */
  function topicAside(data) {
    return el('aside', {}, [
      el('div', { class: 'panel' }, [
        el('h3', { text: '这个动画在讲什么' }),
        el('p', { class: 'small', text: data.topicSummary || data.desc }),
        el('p', { class: 'small muted', text: data.desc })
      ]),
      el('div', { class: 'panel' }, [
        el('h3', { text: '看完想一想' }),
        el('ul', { class: 'ask-list' }, [
          el('li', { text: '动画里每一步分别改变了什么？' }),
          el('li', { text: '如果换一组数据，结果会怎样？' }),
          el('li', { text: '这个原理在生活里哪里能见到？' })
        ])
      ]),
      el('div', { class: 'panel' }, [
        el('h3', { text: '换一种形态' }),
        el('div', { class: 'btn-row' }, [
          el('a', { class: 'btn btn-ghost btn-sm', href: '/topic/' + data.topicId, text: '📚 读知识点' }),
          el('a', { class: 'btn btn-ghost btn-sm', href: '/studio?topic=' + data.topicId + '&tab=book', text: '📖 换绘本讲' })
        ])
      ])
    ]);
  }

  /* ================= 动画工作台 ================= */
  function renderAnimTab(stage, topicId, grade) {
    var playerBox = el('div', { class: 'anim-main' });
    var asideBox = el('div', { class: 'anim-side' });
    stage.appendChild(playerBox);
    stage.appendChild(asideBox);

    var pickerPanel = el('div', { class: 'panel' }, [
      el('h3', { text: '选择原理动画' }),
      el('p', { class: 'small muted', text: '画面由绘图指令生成，可缩放、可交互。' })
    ]);
    var chipRow = el('div', { class: 'anim-picker' });
    pickerPanel.appendChild(chipRow);
    asideBox.appendChild(pickerPanel);
    var detailBox = el('div', {});
    asideBox.appendChild(detailBox);

    api('/api/anims').then(function (data) {
      data.animations.forEach(function (a) {
        chipRow.appendChild(el('button', {
          class: 'filter-chip' + (a.topicId === topicId ? ' is-on' : ''),
          type: 'button', text: a.emoji + ' ' + a.title, title: a.desc,
          onclick: function (ev) {
            AIQ.qsa('.filter-chip', chipRow).forEach(function (x) { x.classList.remove('is-on'); });
            ev.currentTarget.classList.add('is-on');
            load(a.id);
          }
        }));
      });
      var first = data.animations.filter(function (a) { return a.topicId === topicId; })[0] || data.animations[0];
      if (first) load(first.id);
    }).catch(function (e) { AIQ.toast({ type: 'err', text: e.message }); });

    function load(id) {
      api('/api/anim?id=' + encodeURIComponent(id)).then(function (data) {
        var recorded = false;
        AIQ.clear(playerBox);
        AIQ.clear(detailBox);
        var holder = el('div', {});
        playerBox.appendChild(holder);
        animPlayer(Object.assign({}, data, {
          grade: grade,
          onComplete: function () {
            if (recorded) return;
            recorded = true;
            api('/api/event', { method: 'POST', body: { type: 'anim', topicId: data.topicId, title: '观看动画：' + data.title, xp: 6 } })
              .then(function () { AIQ.toast({ type: 'ok', text: '已记录本次学习 +6 经验' }); })
              .catch(function () {});
          }
        }), holder);
        detailBox.appendChild(topicAside(data));
      }).catch(function (e) { AIQ.toast({ type: 'err', text: e.message }); });
    }
  }

  /* ================= 绘本工作台 ================= */
  function renderBookTab(stage, topicId, grade) {
    var readerBox = el('div', {});
    var currentBook = null, page = 0, pageCount = 4, recorded = false;

    var listRow = el('div', { class: 'studio-topic-picker' });
    var pagesRow = el('div', { class: 'mode-picker' }, [4, 6].map(function (n) {
      return el('button', {
        class: 'filter-chip' + (n === 4 ? ' is-on' : ''), type: 'button', text: n + ' 页',
        onclick: function (ev) {
          pageCount = n;
          AIQ.qsa('.filter-chip', pagesRow).forEach(function (x) { x.classList.remove('is-on'); });
          ev.currentTarget.classList.add('is-on');
          if (currentBook) load(currentBook.id);
        }
      });
    }));
    var picker = el('div', { class: 'panel' }, [
      el('h3', { text: '选一本 AI 绘本' }),
      el('p', { class: 'small muted', text: '绘本文字会按你的年级自动改写，插图由代码实时绘制。' }),
      listRow,
      el('div', { class: 'btn-row', style: { marginTop: '10px' } }, [
        el('span', { class: 'small muted', text: '页数：' }), pagesRow
      ])
    ]);

    stage.appendChild(el('div', {}, [picker, readerBox]));

    api('/api/books').then(function (data) {
      data.books.forEach(function (b) {
        listRow.appendChild(el('button', {
          class: 'filter-chip' + (b.topicId === topicId ? ' is-on' : ''),
          type: 'button', text: b.emoji + ' ' + b.title, title: b.topic,
          onclick: function (ev) {
            AIQ.qsa('.filter-chip', listRow).forEach(function (x) { x.classList.remove('is-on'); });
            ev.currentTarget.classList.add('is-on');
            load(b.id);
          }
        }));
      });
      var first = data.books.filter(function (b) { return b.topicId === topicId; })[0] || data.books[0];
      if (first) load(first.id);
    }).catch(function (e) { AIQ.toast({ type: 'err', text: e.message }); });

    function load(id) {
      AIQ.clear(readerBox);
      readerBox.appendChild(el('div', { class: 'panel' }, [el('p', { class: 'muted', text: '正在按 ' + grade + ' 年级改写文字并绘制插图…' })]));
      api('/api/book?topic=' + encodeURIComponent(id) + '&grade=' + grade + '&pages=' + pageCount).then(function (b) {
        currentBook = b;
        page = 0;
        recorded = false;
        draw(b);
      }).catch(function (e) {
        AIQ.clear(readerBox);
        readerBox.appendChild(el('div', { class: 'panel' }, [el('p', { class: 'muted', text: '生成失败：' + e.message })]));
      });
    }

    function draw(b) {
      var p = b.pages[page];
      var figure = el('div', { class: 'book-figure' }, [
        el('div', { html: p.art }),
        el('div', { class: 'book-page-text' }, [
          el('h4', { text: '第 ' + p.index + ' 页 · ' + p.title }),
          el('p', { text: p.text }),
          el('p', { class: 'book-tip', text: '💡 ' + p.tip })
        ]),
        el('div', { class: 'book-nav' }, [
          el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '上一页', onclick: function () { go(b, page - 1); } }),
          el('div', { class: 'book-dots' }, b.pages.map(function (_, k) {
            return el('i', { class: k === page ? 'is-on' : '', title: '第 ' + (k + 1) + ' 页', onclick: function () { go(b, k); } });
          })),
          el('span', { class: 'small muted', text: (page + 1) + ' / ' + b.pages.length }),
          el('button', { class: 'btn btn-primary btn-sm', type: 'button', text: '下一页', onclick: function () { go(b, page + 1); } })
        ]),
        el('div', { class: 'btn-row', style: { padding: '0 18px 16px' } }, [
          el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: '🔊 朗读本页', onclick: function () { AIQ.speak(p.narration); } }),
          el('button', {
            class: 'btn btn-ghost btn-sm', type: 'button', text: '⬇ 导出本页 SVG',
            onclick: function () {
              try {
                var blob = new Blob([p.art], { type: 'image/svg+xml' });
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = b.title + '-第' + p.index + '页.svg';
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
                AIQ.toast({ type: 'ok', text: '已导出本页' });
              } catch (e) { AIQ.toast({ type: 'err', text: '导出失败：' + e.message }); }
            }
          })
        ])
      ]);

      var vocab = el('div', { class: 'panel' }, [
        el('h3', { text: '生词卡' }),
        el('div', { class: 'vocab-list' }, b.vocab.map(function (v) {
          return el('div', { class: 'term-card' }, [el('b', { text: v.term }), el('p', { text: v.plain }), el('small', { text: v.example })]);
        }))
      ]);

      var quizBox = el('div', { class: 'panel' }, [el('h3', { text: '读完做 3 道题' })]);
      b.quiz.forEach(function (q, qi) {
        var answered = false;
        var wrap = el('div', { style: { marginBottom: '16px' } }, [el('b', { class: 'small', text: (qi + 1) + '. ' + q.q })]);
        var opts = el('div', { class: 'quiz-options' });
        q.options.forEach(function (opt, oi) {
          opts.appendChild(el('button', {
            class: 'quiz-option', type: 'button',
            onclick: function (ev) {
              if (answered) return;
              answered = true;
              var mine = oi === q.answer;
              AIQ.qsa('.quiz-option', opts).forEach(function (x, k) {
                x.disabled = true;
                if (k === q.answer) x.classList.add('is-correct');
              });
              if (!mine) ev.currentTarget.classList.add('is-wrong');
              api('/api/answer', {
                method: 'POST',
                body: {
                  topicId: b.topicId, question: q.q, answer: q.options[q.answer], mine: opt,
                  correct: mine, explain: q.explain, score: mine ? 100 : 0, title: '绘本自测：' + b.title
                }
              }).then(function (r) {
                wrap.appendChild(el('div', { class: 'quiz-explain ' + (mine ? 'is-ok' : 'is-bad') }, [
                  el('p', { style: { margin: 0 }, text: (mine ? '✅ ' : '❌ ') + (r.explain || q.explain) })
                ]));
              }).catch(function () {});
            }
          }, [el('span', { class: 'key', text: 'ABC'[oi] || String(oi) }), el('span', { text: opt })]));
        });
        wrap.appendChild(opts);
        quizBox.appendChild(wrap);
      });

      AIQ.clear(readerBox);
      readerBox.appendChild(el('div', { class: 'book-stage' }, [figure, el('div', {}, [vocab, quizBox])]));
    }

    function go(b, k) {
      page = AIQ.clamp(k, 0, b.pages.length - 1);
      draw(b);
      if (page === b.pages.length - 1 && !recorded) {
        recorded = true;
        api('/api/event', { method: 'POST', body: { type: 'story', topicId: b.topicId, title: '读完绘本：' + b.title, xp: 8 } })
          .then(function () { AIQ.toast({ type: 'ok', title: '读完啦', text: '已记录本次阅读 +8 经验' }); })
          .catch(function () {});
      }
    }
  }

  /* ================= 启动 ================= */
  function init() {
    var stage = qs('#studio-stage');
    var tabs = qs('#studio-tabs');
    if (!stage || !tabs) return;
    var topicId = stage.dataset.topic || '';
    var tab = stage.dataset.tab || 'anim';
    var gradeSelect = qs('#studio-grade');
    var grade = gradeSelect ? Number(gradeSelect.value) : ((AIQ.state.student && AIQ.state.student.grade) || 5);

    function render() {
      if (tab === 'book') {
        /* AI 绘本走自己的客户端脚本（picturebook.js 的工坊模式），这里不再渲染动画舞台 */
        if (AIQ.pbStudio) AIQ.pbStudio();
        return;
      }
      AIQ.clear(stage);
      renderAnimTab(stage, topicId, grade);
    }

    AIQ.qsa('.tab', tabs).forEach(function (btn) {
      AIQ.on(btn, 'click', function () {
        tab = btn.dataset.tab;
        AIQ.qsa('.tab', tabs).forEach(function (x) { x.classList.toggle('is-on', x === btn); });
        /* 切到「AI 绘本」时，整个左侧知识点列表与动画舞台一起收起，绝不留在页面上 */
        var animRegion = qs('#studio-region-anim');
        var bookRegion = qs('#studio-region-book');
        if (animRegion) animRegion.hidden = (tab !== 'anim');
        if (bookRegion) bookRegion.hidden = (tab !== 'book');
        render();
      });
    });
    AIQ.qsa('[data-studio-topic]').forEach(function (btn) {
      AIQ.on(btn, 'click', function () {
        topicId = btn.dataset.studioTopic;
        AIQ.qsa('[data-studio-topic]').forEach(function (x) { x.classList.toggle('is-on', x === btn); });
        render();
      });
    });
    if (gradeSelect) {
      AIQ.on(gradeSelect, 'change', function () {
        grade = Number(gradeSelect.value);
        api('/api/student', { method: 'POST', body: { grade: grade } }).catch(function () {});
        render();
      });
    }
    render();
  }

  AIQ.ready(init);
})(window);
