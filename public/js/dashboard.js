/*!
 * dashboard.js —— 学情看板客户端
 * 负责：重新开始（重置档案）、打印报告、徽章提示等轻交互。
 */
(function (global) {
  'use strict';
  var AIQ = global.AIQ;
  if (!AIQ) return;

  function init() {
    var resetBtn = AIQ.qs('#btn-reset');
    if (resetBtn) {
      AIQ.on(resetBtn, 'click', function () {
        AIQ.confirm('将清空本机的学习画像、进度、徽章与错题记录，且无法恢复。确定要重新开始吗？', function () {
          AIQ.api('/api/reset', { method: 'POST' }).then(function () {
            AIQ.toast({ type: 'ok', title: '已重置', text: '正在回到首页…' });
            setTimeout(function () { location.href = '/'; }, 700);
          }).catch(function (e) { AIQ.toast({ type: 'err', text: e.message }); });
        });
      });
    }

    var reportBtn = AIQ.qs('#btn-report');
    if (reportBtn) {
      AIQ.on(reportBtn, 'click', function () { window.open('/api/report', '_blank', 'noopener'); });
    }

    /* 表格行点击：跳到对应知识点 */
    AIQ.qsa('[data-topic-link]').forEach(function (row) {
      AIQ.on(row, 'click', function () { location.href = '/topic/' + row.dataset.topicLink; });
    });

    /* 新获得的徽章提示 */
    var badges = (AIQ.state.student && AIQ.state.student.badges) || [];
    if (badges.length) {
      var wall = AIQ.qs('.badge-wall');
      if (wall) {
        AIQ.qsa('.badge-item.is-owned', wall).forEach(function (b, i) {
          b.style.transition = 'transform .3s ease ' + (i * 40) + 'ms';
        });
      }
    }
  }

  AIQ.ready(init);
})(window);
