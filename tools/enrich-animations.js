/**
 * 用火山豆包 2.1 Pro 为 12 个原理动画生成「更详细、更易懂」的讲解词。
 *
 * 用法：
 *   node tools/enrich-animations.js                 # 优化全部动画
 *   node tools/enrich-animations.js --id=overfit    # 只优化某一个
 *
 * 前置：已配置火山方舟（provider=ark + apiKey + model=doubao-seed-2-1-pro-260628 或接入点 ID）。
 * 产物：data/anim-enriched.json（服务端读取后，播放器自动使用这些讲解，未生成则回退内置文案）。
 */
'use strict';

const path = require('path');
const fs = require('fs');
const art = require('../server/lib/art');
const llm = require('../server/lib/llm');

const OUT = path.join(__dirname, '..', 'data', 'anim-enriched.json');

function extractJSON(text) {
  let t = String(text || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  try { return JSON.parse(t); } catch (e) { return null; }
}

async function enrichOne(a) {
  const lines = a.phases.map((p, i) =>
    (i + 1) + '. ' + p.caption + '\n   （低年级：' + ((art.JUNIOR[a.id] || [])[i] || '') + '）'
  ).join('\n');
  const sys = '你是一位面向 K12 学生的人工智能通识课老师，特别擅长用准确又通俗的语言讲清楚 AI 原理。';
  const user = [
    '下面是一个原理动画《' + a.title + '》，共有 ' + a.phases.length + ' 帧，每一帧配一句讲解。',
    '请把每一帧的讲解都写得「更详细、更易懂」：',
    '1) caption：面向初高中生，1~2 句话，讲清这一步在做什么、为什么；',
    '2) junior：面向 1~3 年级小朋友，像讲故事一样，一句话，口语、简短、无术语。',
    '现有讲解（按帧顺序）：',
    lines,
    '请只输出 JSON，不要任何其他文字，格式：',
    '{"phases":[{"caption":"...","junior":"..."}, ...]}',
    '帧数必须与上面完全一致。'
  ].join('\n');

  const r = await llm.complete(
    [{ role: 'system', content: sys }, { role: 'user', content: user }],
    { temperature: 0.7, maxTokens: 2400 }
  );
  if (!r.ok) throw new Error(a.id + ' 生成失败：' + r.reason);
  const j = extractJSON(r.text);
  if (!j || !Array.isArray(j.phases) || j.phases.length !== a.phases.length) {
    throw new Error(a.id + ' 返回无法解析或帧数不匹配：' + String(r.text).slice(0, 200));
  }
  return { id: a.id, title: a.title, phases: j.phases };
}

(async () => {
  if (!llm.enabled()) {
    console.error('未配置大模型。请先设置火山方舟 API Key：');
    console.error('  方式一（设置页）：provider=火山方舟（豆包 2.1 Pro）、填入 API Key、model 用 doubao-seed-2-1-pro-260628 或接入点 ID（ep-…）；');
    console.error('  方式二（环境变量）：AIQIMING_PROVIDER=ark AIQIMING_API_KEY=你的Key AIQIMING_MODEL=doubao-seed-2-1-pro-260628');
    console.error('配置好后重新运行本脚本。');
    process.exit(1);
  }

  const only = process.argv.find(a => a.indexOf('--id=') === 0);
  const wantId = only ? only.slice(5) : null;
  const targets = wantId ? art.ANIMATIONS.filter(a => a.id === wantId) : art.ANIMATIONS;
  if (!targets.length) { console.error('未找到动画：' + wantId); process.exit(1); }

  const out = {};
  for (const a of targets) {
    process.stdout.write('正在优化「' + a.title + '」(' + a.phases.length + ' 帧)… ');
    try {
      const r = await enrichOne(a);
      out[a.id] = { title: a.title, generatedAt: new Date().toISOString(), phases: r.phases };
      console.log('完成');
    } catch (e) {
      console.log('失败：' + e.message);
    }
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
  console.log('\n已写入 ' + OUT + '，共 ' + Object.keys(out).length + ' 个动画。');
  console.log('重启服务后，原理动画会自动使用这些更详细的讲解。');
})().catch(e => { console.error(e); process.exit(1); });
