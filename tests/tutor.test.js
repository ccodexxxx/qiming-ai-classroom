/** 引擎冒烟测试：按学段与追问层级验证讲解编排 */
const tutor = require('../server/lib/tutor');
const content = require('../server/content');

const mem = tutor.freshMemory();
const ctx = { grade: 5, name: '小启', memory: mem, progress: {} };

console.log('=== 同一问题在不同年级 ===');
for (const g of [1, 4, 8, 11]) {
  const m = tutor.freshMemory();
  const r = tutor.answer('什么是机器学习', { grade: g, name: '同学', memory: m, progress: {} });
  console.log('G' + String(g).padEnd(3) + ' [' + content.levelOfGrade(g).short + '] 意图=' + r.intent + ' 知识点=' + r.topicId + ' 层级=' + r.step + ' 长度=' + r.text.length + ' 按钮=' + r.actions.length);
}

console.log('\n=== 脚手架递进（同一知识点连续追问） ===');
const m2 = tutor.freshMemory();
['什么是机器学习', '再深入讲讲', '还有吗', '继续'].forEach(q => {
  const r = tutor.answer(q, { grade: 8, name: '同学', memory: m2, progress: {} });
  console.log(q.padEnd(8) + ' → 层级=' + String(r.step).padEnd(11) + ' 长度=' + r.text.length);
});

console.log('\n=== 降级重讲 ===');
const m3 = tutor.freshMemory();
tutor.answer('什么是神经网络', { grade: 11, name: '同学', memory: m3, progress: {} });
const r3 = tutor.answer('听不懂', { grade: 11, name: '同学', memory: m3, progress: {} });
console.log('意图=' + r3.intent + ' 学段降为=' + r3.levelId + '（原 high）长度=' + r3.text.length);
console.log('回答片段：' + r3.text.split('\n').filter(l => l.trim()).slice(0, 3).join(' / ').slice(0, 90));

console.log('\n=== 各类意图 ===');
const cases = [
  ['你好', 'greet'], ['你是谁', 'identity'], ['谢谢老师', 'thanks'], ['再见', 'bye'],
  ['给我出几道题', 'quiz'], ['我想看绘本', 'story'], ['放个动画', 'anim'], ['我要学编程', 'code'],
  ['玩个游戏', 'game'], ['推荐学习计划', 'plan'], ['AI 会不会有偏见', 'ethics'], ['我是不是学不会呀', 'upset'],
  ['过拟合是什么', 'define'], ['量子计算是什么', 'concept']
];
cases.forEach(([q, want]) => {
  const m = tutor.freshMemory();
  const r = tutor.answer(q, { grade: 7, name: '同学', memory: m, progress: {} });
  const mark = r.intent === want ? '✓' : '✗(得 ' + r.intent + ')';
  console.log('  ' + mark + ' ' + q.padEnd(12) + ' 知识点=' + String(r.topicId).padEnd(16) + ' 兜底=' + r.noAnswer);
});

console.log('\n=== 提示词构造 ===');
const t0 = content.getTopic('vision-image');
const sp = tutor.systemPrompt({ grade: 4, topic: t0, related: tutor.relatedTopics(t0, 2), student: { name: '小启', grade: 4, progress: {} } });
console.log('长度=' + sp.length + '，含学段要求=' + /小学高年级/.test(sp) + '，含知识片段=' + /卷积核/.test(sp) + '，含事实约束=' + /不要编造/.test(sp));

console.log('\n=== 判题 ===');
console.log(tutor.judge('ml-what', true, 'junior'));
console.log(tutor.judge('ml-what', false, 'high'));
