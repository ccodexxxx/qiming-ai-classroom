/**
 * AI 视频 前端
 *
 * 左栏挑故事 + 生成设置，右侧播放器与作品列表。
 * 渲染是后台异步任务，这里只负责提交、轮询进度、把结果播出来。
 */
(function (global) {
  'use strict';
  var AIQ = global.AIQ;
  if (!AIQ) return;

  /* qs / el / toast 都挂在 AIQ 上，这里取成局部函数，读起来更顺 */
  var qs = AIQ.qs, el = AIQ.el, api = AIQ.api, toast = AIQ.toast;

  var S = { grade: 1, book: null, poll: null };

  function init() {
    var books = qs('#video-books');
    if (!books) return;
    var gs = qs('#video-grade');
    S.grade = Number(gs && gs.value) || (AIQ.state.student && AIQ.state.student.grade) || 1;
    if (gs) AIQ.on(gs, 'change', function () { S.grade = Number(gs.value); loadBooks(); });

    AIQ.on(qs('#video-go'), 'click', function () { start(); });
    loadBooks();
    loadList();
  }

  /* ---------- 故事列表 ---------- */
  function loadBooks() {
    var box = qs('#video-books');
    box.innerHTML = '<p class="muted small">正在准备…</p>';
    api('/api/books?grade=' + S.grade + '&theme=all').then(function (data) {
      box.innerHTML = '';
      (data.stories || []).forEach(function (st, i) {
        var card = el('button', { class: 'video-book' + (i === 0 ? ' is-on' : ''), type: 'button' });
        card.appendChild(el('div', { class: 'video-book-cover', html: st.cover }));
        card.appendChild(el('div', { class: 'video-book-meta' }, [
          el('b', { text: st.emoji + ' ' + st.title }),
          el('span', { class: 'video-book-age', text: st.ageLabel || '' }),
          el('span', { class: 'video-book-concept', text: st.conceptLabel })
        ]));
        AIQ.on(card, 'click', function () {
          AIQ.qsa('.video-book', box).forEach(function (x) { x.classList.remove('is-on'); });
          card.classList.add('is-on');
          S.book = st.id;
        });
        box.appendChild(card);
        if (i === 0) S.book = st.id;
      });
    }).catch(function (e) {
      box.innerHTML = '';
      box.appendChild(el('p', { class: 'muted small', text: '取不到故事列表（' + e.message + '）' }));
    });
  }

  /* ---------- 提交渲染 ---------- */
  function start() {
    var go = qs('#video-go');
    var note = qs('#video-note');
    if (!S.book) { toast({ type: 'warn', text: '先挑一本故事吧～' }); return; }
    go.disabled = true;
    go.textContent = '🎬 正在生成…';
    stage(progressCard('正在提交…', 0));
    api('/api/video/render', {
      method: 'POST',
      body: {
        id: S.book, grade: S.grade,
        voice: qs('#video-voice').checked,
        subtitle: qs('#video-sub').checked,
        pages: qs('#video-short').checked ? 3 : 0
      }
    }).then(function (r) {
      if (!r.ok) throw new Error(r.error || '提交失败');
      if (note) note.textContent = '渲染中，可以先去做别的事，好了会自动出现。';
      pollJob(r.job.id);
    }).catch(function (e) {
      go.disabled = false;
      go.textContent = '🎬 生成视频';
      stage(el('div', { class: 'panel' }, [
        el('p', { class: 'muted', text: '没能开始渲染：' + e.message }),
        el('p', { class: 'muted small', text: '视频需要本机的 ffmpeg、Chrome 与 PowerShell 语音合成。' })
      ]));
      note && (note.textContent = '生成失败，看看右边的提示。');
    });
  }

  function progressCard(text, pct) {
    var bar = el('i', { style: { width: pct + '%' } });
    var label = el('p', { class: 'video-step', text: text });
    var pctEl = el('span', { class: 'video-pct', text: pct + '%' });
    return el('div', { class: 'video-progress' }, [
      el('div', { class: 'video-progress-head' }, [label, pctEl]),
      el('div', { class: 'video-bar' }, [bar]),
      el('p', { class: 'muted small', text: '画面逐帧绘制 → 配音 → 编码合成，请不要关掉这个页面。' })
    ]);
  }

  function pollJob(id) {
    if (S.poll) clearTimeout(S.poll);
    api('/api/video/job?id=' + encodeURIComponent(id)).then(function (r) {
      var j = r.job;
      if (j.status === 'done') {
        showVideo(j);
        finish();
        loadList();
        return;
      }
      if (j.status === 'failed') {
        stage(el('div', { class: 'panel' }, [
          el('p', { class: 'muted', text: '渲染失败：' + (j.error || '未知原因') })
        ]));
        finish();
        return;
      }
      stage(progressCard(j.step || '渲染中…', j.percent || 0));
      S.poll = setTimeout(function () { pollJob(id); }, 900);
    }).catch(function () {
      S.poll = setTimeout(function () { pollJob(id); }, 1500);
    });
  }

  function finish() {
    var go = qs('#video-go');
    var note = qs('#video-note');
    if (go) { go.disabled = false; go.textContent = '🎬 生成视频'; }
    if (note) note.textContent = '好了！可以播放，也可以下载。';
  }

  /* ---------- 播放器 ---------- */
  function showVideo(j) {
    var v = el('video', {
      class: 'video-player', controls: 'controls', playsinline: 'playsinline',
      preload: 'metadata', poster: j.poster || ''
    });
    v.appendChild(el('source', { src: j.url, type: 'video/mp4' }));
    stage(el('div', { class: 'video-result' }, [
      el('h3', { text: '🎬 ' + j.title + ' · ' + (j.pages || 0) + ' 页 · ' + (j.seconds || 0) + ' 秒' }),
      v,
      el('div', { class: 'video-actions' }, [
        el('a', { class: 'btn btn-ghost btn-sm', href: j.url, download: j.title + '.mp4', text: '⬇️ 下载 MP4' }),
        el('span', { class: 'muted small', text: (j.withAudio ? '含中文配音' : '无配音（字幕版）') + ' · ' + Math.round((j.bytes || 0) / 1024 / 1024 * 10) / 10 + ' MB · 1280×704' })
      ])
    ]));
  }

  function stage(node) {
    var box = qs('#video-stage');
    box.innerHTML = '';
    box.appendChild(node);
  }

  /* ---------- 作品列表 ---------- */
  function loadList() {
    var box = qs('#video-list');
    if (!box) return;
    api('/api/video/list').then(function (r) {
      box.innerHTML = '';
      var done = (r.jobs || []).filter(function (j) { return j.status === 'done'; });
      if (!done.length) {
        box.appendChild(el('p', { class: 'muted small', text: '还没有作品。' }));
        return;
      }
      done.forEach(function (j) {
        var card = el('button', { class: 'video-thumb', type: 'button' });
        if (j.poster) card.appendChild(el('img', { src: j.poster, alt: j.title }));
        else card.appendChild(el('div', { class: 'video-thumb-empty', text: '🎬' }));
        card.appendChild(el('div', { class: 'video-thumb-meta' }, [
          el('b', { text: j.title }),
          el('span', { text: (j.pages || 0) + ' 页 · ' + (j.seconds || 0) + ' 秒' })
        ]));
        AIQ.on(card, 'click', function () { showVideo(j); });
        box.appendChild(card);
      });
    }).catch(function () { /* 列表失败不影响主流程 */ });
  }

  AIQ.ready(init);
})(window);
