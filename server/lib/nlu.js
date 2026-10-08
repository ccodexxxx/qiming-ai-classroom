/**
 * 教学引擎 · 中文提问理解
 * 把学生的自然语言问题转换为结构化意图：意图类型 + 知识点 + 期望的讲解层级
 * 纯规则实现，零依赖、可离线运行；命中不了时明确返回 null，由上层决定「不装懂」的回复。
 */
'use strict';

const content = require('../content');

/* 意图模式：顺序敏感，越具体的越靠前 */
const INTENT_PATTERNS = [
  { id: 'greet',    re: /^(你好|您好|hi|hello|嗨|哈喽|在吗|早|早上好|下午好|晚上好|老师好)[!！。~～\s]*$/i },
  { id: 'identity', re: /(你是谁|你叫什么|你是什么|介绍一下你自己|你能做什么|你会干什么|你有什么用|你是人吗|你几岁)/ },
  { id: 'thanks',   re: /(谢谢|多谢|感谢|辛苦|thank)/i },
  { id: 'bye',      re: /(再见|拜拜|下次见|晚安|我走了|结束|不聊了)/ },
  { id: 'help',     re: /(帮助|怎么用|使用说明|不会用|教我玩|功能介绍|怎么开始|能干嘛)/ },
  /* --- 具体诉求类：必须排在 why / how / deeper 这些泛化意图之前，否则会被吞掉 --- */
  { id: 'simpler',  re: /(听不懂|不明白|没懂|不理解|太复杂|太深|简单点|说人话|讲简单|再讲一遍|没听清|好难|太难了|不懂)/ },
  { id: 'example',  re: /(举个例子|举例|例子|比方|比如|生活里|生活中有|有什么用|实际)/ },
  { id: 'quiz',     re: /(出题|做题|练习题|练习一下|测验|考试|考考我|来几道|几道题|测测我|巩固|测试一下|考我)/ },
  { id: 'story',    re: /(绘本|故事|图画书|读一个|画本|睡前故事|讲个故事|读故事)/ },
  { id: 'anim',     re: /(动画|演示|动起来|可视化|动图|小短片)/ },
  { id: 'video',    re: /(视频|视频课|讲一节|上课)/ },
  { id: 'compare',  re: /(区别|不一样|有什么不同|差异|对比|哪个好|相比)/ },
  { id: 'deeper',   re: /(再深入|深入一点|深入讲讲|详细|展开|进阶|难一点|再讲讲|继续说|接着讲|还有吗)/ },
  { id: 'deeper',   re: /^(继续|接着说|继续讲|继续说|接着讲|往下讲|然后呢)[!！。~～\s]*$/ },
  /* --- 泛化问法：放在具体诉求之后 --- */
  { id: 'why',      re: /(为什么|为啥|怎么会|什么原因|原理|背后|凭什么)/ },
  { id: 'how',      re: /(怎么做|怎么用|如何|怎么弄|怎么才能|步骤|流程|方法|怎么实现)/ },
  { id: 'define',   re: /(是什么|什么是|啥是|定义|含义|意思|指的是|解释一下)/ },
  { id: 'code',     re: /(编程|代码|程序|积木|scratch|python|javascript|写个程序|跑一段)/i },
  { id: 'game',     re: /(游戏|闯关|比赛|对战|玩一玩|小游戏)/ },
  { id: 'plan',     re: /(学什么|学习计划|怎么学|从哪开始|推荐|路线|安排|顺序|先学)/ },
  { id: 'ethics',   re: /(伦理|道德|安全|危险|该不该|合不合适|隐私|偏见|公平|责任|合法)/ },
  { id: 'upset',    re: /(学不会|我很笨|我太差|放弃|没意思|无聊|不想学|坚持不住|受不了)/ },
  { id: 'affirm',   re: /^(好的?|嗯|可以|行|要|想|来|开始|试试|ok|OK|是的|对)[!！。~～\s]*$/i },
  { id: 'deny',     re: /^(不用|不要|不用了|算了|不|no|不想)[!！。~～\s]*$/i }
];

/** 识别意图；无法匹配时按问题形态兜底 */
function detectIntent(text) {
  const t = String(text || '').trim();
  if (!t) return 'concept';
  for (const p of INTENT_PATTERNS) if (p.re.test(t)) return p.id;
  return 'concept';
}

/** 判断这句话是否在指代上一轮话题（省略主语的追问） */
function isFollowUp(text) {
  const t = String(text || '').trim();
  if (t.length <= 10 && /^(那|那么|还有|然后|接着|这个|它|他|她|这|其)/.test(t)) return true;
  if (/^(为什么|为啥|怎么说|什么意思|举个例子|听不懂|再讲|继续|详细点|然后呢|还有|接着)/.test(t)) return true;
  if (/(再深入|深入讲讲|详细讲讲|展开讲|再详细|再多讲|再举|再说说|讲讲看)/.test(t)) return true;
  return false;
}

/**
 * 定位知识点
 * @returns { topic, via: 'search' | 'carry' | null, candidates }
 */
function locate(text, memory) {
  const t = String(text || '').trim();
  const mem = memory || {};
  const hits = content.search(t, 4);
  const prev = mem.lastTopicId ? content.getTopic(mem.lastTopicId) : null;

  // 1) 先判断是不是在追问上一话题：与上一话题相关度高，或就是明显省略主语的追问
  if (prev) {
    const relevance = topicRelevance(t, prev);
    const followUp = isFollowUp(t);
    const newTopic = hits.filter(h => h.id !== prev.id);
    // 没有搜到新知识点时，只要是追问就延续；搜到新知识点则要求与旧话题足够相关
    if (followUp && (newTopic.length === 0 ? relevance >= 0.25 : relevance >= 0.5)) {
      return { topic: prev, via: 'carry', candidates: hits };
    }
    if (relevance >= 0.7) return { topic: prev, via: 'carry', candidates: hits };
  }
  // 2) 再按检索结果定位
  if (hits.length) return { topic: hits[0], via: 'search', candidates: hits };
  // 3) 明显是追问但没有相关词：延续上一话题（例如「为什么会这样呢」）
  if (isFollowUp(t) && prev) return { topic: prev, via: 'carry', candidates: [] };
  return { topic: null, via: null, candidates: [] };
}

/** 判断学生是否表达「更简单一点」，用于降级重讲 */
function wantsSimpler(intent, text) {
  if (intent === 'simpler') return true;
  return /(听不懂|太难|不明白|没懂|简单一点|说人话)/.test(String(text || ''));
}

/** 从自由文本里提取年级（如「我是三年级」） */
function extractGrade(text) {
  const t = String(text || '');
  const cn = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  let m = t.match(/([一二三四五六七八九十])年级/);
  if (m) return cn[m[1]] || null;
  m = t.match(/(\d{1,2})\s*年级/);
  if (m) return Math.max(1, Math.min(12, Number(m[1])));
  if (/高一/.test(t)) return 10;
  if (/高二/.test(t)) return 11;
  if (/高三/.test(t)) return 12;
  if (/初一|七年级/.test(t)) return 7;
  if (/初二|八年级/.test(t)) return 8;
  if (/初三|九年级/.test(t)) return 9;
  return null;
}

/**
 * 计算新问题与某个知识点的相关度（0~1）
 * 用问题中的二字组在该知识点标题、术语、要点中命中的比例衡量，
 * 用于区分「这是追问」还是「换了个新问题」。
 */
function topicRelevance(text, topic) {
  if (!topic) return 0;
  const q = String(text || '').toLowerCase();
  if (!q) return 0;
  if (q.indexOf(String(topic.title).toLowerCase()) >= 0) return 1;
  const grams = [];
  for (let i = 0; i < q.length - 1; i++) grams.push(q.slice(i, i + 2));
  if (!grams.length) return 0;
  const title = String(topic.title).toLowerCase();
  const terms = (topic.terms || []).map(t => (t.term + t.plain).toLowerCase()).join(' ');
  const keys = (topic.key || []).join(' ').toLowerCase();
  const summary = ((topic.objective && topic.objective.know) || '').toLowerCase();
  let hit = 0;
  grams.forEach(g => {
    if (title.indexOf(g) >= 0 || terms.indexOf(g) >= 0 || keys.indexOf(g) >= 0 || summary.indexOf(g) >= 0) hit++;
  });
  return hit / grams.length;
}

module.exports = { detectIntent, locate, isFollowUp, topicRelevance, wantsSimpler, extractGrade, INTENT_PATTERNS };
