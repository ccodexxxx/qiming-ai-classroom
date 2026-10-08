/**
 * 数据层 · 学生档案与学习记录（JSON 文件存储，零依赖）
 *
 * 设计要点：
 *   1) 一个学生一个文件：data/students/<id>.json，便于备份、导出与人工查看
 *   2) 写入采用「临时文件 + 重命名」，避免写入中途断电导致档案损坏
 *   3) 读取带内存缓存，但每次写入后失效，保证多请求下数据一致
 *   4) 会话（cookie）只保存学生 id，避免把状态塞进 cookie
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const STUDENT_DIR = path.join(DATA_DIR, 'students');

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STUDENT_DIR)) fs.mkdirSync(STUDENT_DIR, { recursive: true });
}

/** 徽章目录：id → 展示信息（供接口返回中文名与图标） */
const BADGES = {
  'first-chat': { name: '初次相遇', icon: '👋', desc: '完成第一次对话' },
  'first-quiz': { name: '答题新手', icon: '📝', desc: '完成第一组练习' },
  'perfect-quiz': { name: '满分小达人', icon: '🎯', desc: '一组练习全部答对' },
  'first-code': { name: '代码初体验', icon: '⌨️', desc: '运行成功第一段程序' },
  'story-lover': { name: '绘本阅读家', icon: '📖', desc: '读完三本 AI 绘本' },
  'animator': { name: '动画观察员', icon: '🎬', desc: '看完三个原理动画' },
  'trainer': { name: '模型训练师', icon: '🧠', desc: '完成一次模型训练实验' },
  'three-topics': { name: '三连掌握', icon: '🌱', desc: '掌握三个知识点' },
  'ten-topics': { name: '十全十美', icon: '🏆', desc: '掌握十个知识点' },
  'streak-3': { name: '坚持三天', icon: '🔥', desc: '连续三天来学习' },
  'streak-7': { name: '一周不断', icon: '📅', desc: '连续七天来学习' },
  'fixer': { name: '错题清零', icon: '🤝', desc: '订正三道错题' }
};

/** 把徽章 id 数组转成带名称与图标的对象数组 */
function badgesOf(profile) {
  return (profile && profile.badges ? profile.badges : []).map(id => {
    const def = BADGES[id] || { name: id, icon: '🏅', desc: '' };
    return { id: id, name: def.name, icon: def.icon, desc: def.desc };
  });
}

/** 生成一个新的学生档案结构 */
function emptyProfile(opt) {
  opt = opt || {};
  const now = Date.now();
  return {
    id: opt.id || ('s' + now.toString(36) + crypto.randomBytes(3).toString('hex')),
    createdAt: now,
    updatedAt: now,
    name: opt.name || '',
    grade: opt.grade || 5,
    avatar: opt.avatar || '🌱',
    interests: opt.interests || [],
    // 知识点掌握：topicId -> { status, mastery, attempts, correct, wrong, lastAt, scores }
    progress: {},
    // 学习行为流水（保留最近 800 条）
    events: [],
    // 已获得的徽章 id
    badges: [],
    // 错题本：{ id, topicId, question, options, answer, mine, explain, at, fixed }
    wrongBook: [],
    // 对话记忆：脚手架层级、最近话题、追问计数
    memory: { lastTopicId: null, lastIntent: null, followUps: 0, usedLevels: {}, recentTopics: [] },
    // 对话历史（保留最近 60 轮）
    chat: [],
    // 游戏与练习记录
    best: { quiz: 0, label: 0, net: 0, match: 0 },
    stats: { activeDays: [], streak: 0, lastActiveDay: null, minutes: 0, sessions: 0 }
  };
}

/** 今天的日期字符串（本地时区） */
function today() {
  const d = new Date();
  const p = n => (n < 10 ? '0' + n : String(n));
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

class Store {
  constructor() {
    ensureDirs();
    this.cache = new Map();
  }

  fileOf(id) {
    if (!/^s[a-z0-9]+$/i.test(String(id))) throw new Error('非法的学生 id：' + id);
    return path.join(STUDENT_DIR, id + '.json');
  }

  /** 读取档案（带缓存） */
  get(id) {
    if (!id) return null;
    if (this.cache.has(id)) return this.cache.get(id);
    try {
      const raw = fs.readFileSync(this.fileOf(id), 'utf8');
      const data = JSON.parse(raw);
      this.cache.set(id, data);
      return data;
    } catch (e) {
      return null;
    }
  }

  /** 原子写入 */
  save(profile) {
    if (!profile || !profile.id) throw new Error('档案缺少 id');
    profile.updatedAt = Date.now();
    const file = this.fileOf(profile.id);
    const tmp = file + '.tmp' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(profile, null, 2), 'utf8');
    fs.renameSync(tmp, file);
    this.cache.set(profile.id, profile);
    return profile;
  }

  /** 新建学生档案 */
  create(opt) {
    const p = emptyProfile(opt);
    this.save(p);
    return p;
  }

  /** 删除档案 */
  remove(id) {
    try { fs.unlinkSync(this.fileOf(id)); } catch (e) {}
    this.cache.delete(id);
  }

  /** 列出全部档案（供教师端/看板使用） */
  list() {
    ensureDirs();
    return fs.readdirSync(STUDENT_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const d = JSON.parse(fs.readFileSync(path.join(STUDENT_DIR, f), 'utf8'));
          return { id: d.id, name: d.name, grade: d.grade, updatedAt: d.updatedAt, events: (d.events || []).length };
        } catch (e) { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /* ---------------- 学习记录相关 ---------------- */

  /** 标记当天活跃，维护连续学习天数 */
  touchDay(profile) {
    const t = today();
    const s = profile.stats;
    if (s.lastActiveDay === t) return profile;
    const last = s.lastActiveDay;
    s.lastActiveDay = t;
    if (s.activeDays.indexOf(t) < 0) s.activeDays.push(t);
    if (s.activeDays.length > 400) s.activeDays = s.activeDays.slice(-400);
    if (last) {
      const diff = Math.round((new Date(t) - new Date(last)) / 86400000);
      s.streak = diff === 1 ? (s.streak || 0) + 1 : 1;
    } else {
      s.streak = 1;
    }
    return profile;
  }

  /**
   * 记录一次学习行为，并按需更新知识点掌握度
   * @param {object} profile
   * @param {object} ev { type, topicId, title, score, correct, xp, detail }
   */
  recordEvent(profile, ev) {
    ev = ev || {};
    const event = {
      at: Date.now(),
      type: ev.type || 'learn',
      topicId: ev.topicId || null,
      title: ev.title || '',
      score: typeof ev.score === 'number' ? ev.score : null,
      correct: typeof ev.correct === 'boolean' ? ev.correct : null,
      xp: typeof ev.xp === 'number' ? ev.xp : 5,
      detail: ev.detail || ''
    };
    profile.events.unshift(event);
    if (profile.events.length > 800) profile.events.length = 800;

    if (ev.topicId) {
      const p = profile.progress[ev.topicId] || (profile.progress[ev.topicId] = {
        status: 'new', mastery: 0, attempts: 0, correct: 0, wrong: 0, lastAt: 0, scores: []
      });
      p.attempts += 1;
      p.lastAt = Date.now();
      if (typeof ev.score === 'number') {
        p.scores.push(ev.score);
        if (p.scores.length > 20) p.scores.shift();
        p.mastery = Math.max(p.mastery || 0, ev.score);
      }
      if (ev.correct === true) p.correct += 1;
      if (ev.correct === false) p.wrong += 1;
      if (p.status === 'new') p.status = 'learning';
      // 掌握判定：成绩达标且正确次数足够
      const total = p.correct + p.wrong;
      if (p.mastery >= 80 && p.correct >= 2 && total > 0 && p.correct / total >= 0.6) p.status = 'done';
    }
    this.checkBadges(profile);
    return event;
  }

  /** 徽章判定 */
  checkBadges(profile) {
    const has = id => profile.badges.indexOf(id) >= 0;
    const grant = id => { if (!has(id)) profile.badges.push(id); };
    const ev = profile.events || [];
    const count = t => ev.filter(e => e.type === t).length;
    const doneTopics = Object.keys(profile.progress).filter(k => profile.progress[k].status === 'done');

    if (profile.chat.some(m => m.role === 'user')) grant('first-chat');
    if (count('quiz') >= 1) grant('first-quiz');
    if (ev.some(e => e.type === 'quiz' && e.score >= 100)) grant('perfect-quiz');
    if (count('code') >= 1) grant('first-code');
    if (count('story') >= 3) grant('story-lover');
    if (count('anim') >= 3) grant('animator');
    if (count('train') >= 1) grant('trainer');
    if (doneTopics.length >= 3) grant('three-topics');
    if (doneTopics.length >= 10) grant('ten-topics');
    if (profile.stats.streak >= 3) grant('streak-3');
    if (profile.stats.streak >= 7) grant('streak-7');
    if ((profile.wrongBook || []).filter(w => w.fixed).length >= 3) grant('fixer');
    return profile.badges;
  }

  /** 学习统计（供看板） */
  summarize(profile) {
    const ev = profile.events || [];
    const byType = {};
    ev.forEach(e => { byType[e.type] = (byType[e.type] || 0) + 1; });
    const keys = Object.keys(profile.progress || {});
    let correct = 0, wrong = 0;
    keys.forEach(k => { correct += profile.progress[k].correct || 0; wrong += profile.progress[k].wrong || 0; });
    const answered = correct + wrong;
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const p = n => (n < 10 ? '0' + n : String(n));
      const key = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
      days.push({ day: key.slice(5), count: ev.filter(e => new Date(e.at).toDateString() === d.toDateString()).length });
    }
    return {
      totalEvents: ev.length,
      byType,
      topicsTouched: keys.length,
      topicsDone: keys.filter(k => profile.progress[k].status === 'done').length,
      topicsLearning: keys.filter(k => profile.progress[k].status === 'learning').length,
      accuracy: answered ? Math.round(correct / answered * 100) : 0,
      answered, correct, wrong,
      badges: (profile.badges || []).length,
      streak: profile.stats.streak || 0,
      activeDays: (profile.stats.activeDays || []).length,
      last7: days,
      wrongOpen: (profile.wrongBook || []).filter(w => !w.fixed).length,
      xp: ev.reduce((n, e) => n + (e.xp || 0), 0)
    };
  }
}

module.exports = { Store, emptyProfile, today, DATA_DIR, STUDENT_DIR, BADGES, badgesOf };
