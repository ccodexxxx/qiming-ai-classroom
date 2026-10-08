/**
 * 大模型网关（可选能力，默认关闭）
 *
 * 设计：
 *   1) 未配置密钥时完全不参与，教学由本地引擎完成，功能与联网时一致
 *   2) 兼容任意 OpenAI 协议服务（火山方舟 / DeepSeek / 通义 / 智谱 / OpenAI / 本地 Ollama）
 *   3) 支持流式（SSE）与同步两种模式
 *   4) 任何失败都返回 { ok:false, reason }，由调用方静默回退本地引擎，绝不影响上课
 *   5) 配置来源优先级：环境变量 > data/config.json
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', '..', 'data', 'config.json');

/** 服务预设：便于老师一键切换 */
const PRESETS = {
  local: { name: '本地教学引擎（默认）', endpoint: '', model: '', note: '无需联网与密钥，内容来自内置课程库' },
  ark: { name: '火山方舟（豆包 2.1 Pro）', endpoint: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seed-2-1-pro-260628', note: '填入方舟 API Key；模型可直接用豆包 2.1 Pro 模型 ID 或你的接入点 ID（ep-…）' },
  deepseek: { name: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1', model: 'deepseek-chat', note: '填入 DeepSeek 平台 API Key' },
  dashscope: { name: '阿里云百炼（通义千问）', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', note: '百炼兼容模式地址' },
  zhipu: { name: '智谱 GLM', endpoint: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-plus', note: '智谱开放平台' },
  openai: { name: 'OpenAI 兼容服务', endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini', note: '或任意兼容 OpenAI 协议的地址' },
  ollama: { name: '本地 Ollama', endpoint: 'http://localhost:11434/v1', model: 'qwen2.5:7b', note: '本机部署，完全离线' }
};

/** 读取配置：环境变量优先 */
function config() {
  let file = {};
  try { file = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch (e) { file = {}; }
  const env = process.env;
  const provider = env.AIQIMING_PROVIDER || file.provider || 'local';
  const preset = PRESETS[provider] || PRESETS.local;
  return {
    provider,
    endpoint: (env.AIQIMING_ENDPOINT || file.endpoint || preset.endpoint || '').replace(/\/+$/, ''),
    model: env.AIQIMING_MODEL || file.model || preset.model || '',
    apiKey: env.AIQIMING_API_KEY || file.apiKey || '',
    temperature: Number(env.AIQIMING_TEMPERATURE || file.temperature || 0.6),
    maxTokens: Number(env.AIQIMING_MAX_TOKENS || file.maxTokens || 900),
    timeoutMs: Number(env.AIQIMING_TIMEOUT || file.timeoutMs || 25000)
  };
}

/** 是否可用（有密钥且不是本地模式） */
function enabled() {
  const c = config();
  return c.provider !== 'local' && !!c.apiKey && !!c.endpoint;
}

function chatUrl() {
  const c = config();
  if (/\/chat\/completions$/.test(c.endpoint)) return c.endpoint;
  return c.endpoint + '/chat/completions';
}

/** 解析 SSE 数据块中的增量文本 */
function parseSSE(chunk) {
  const out = [];
  String(chunk || '').split(/\r?\n/).forEach(line => {
    const s = line.trim();
    if (!s || s.indexOf('data:') !== 0) return;
    const payload = s.slice(5).trim();
    if (!payload || payload === '[DONE]') return;
    try {
      const j = JSON.parse(payload);
      const delta = j.choices && j.choices[0] && (j.choices[0].delta || j.choices[0].message);
      if (delta && delta.content) out.push(delta.content);
    } catch (e) { /* 忽略半截包 */ }
  });
  return out;
}

/**
 * 同步调用
 * @returns {Promise<{ok:boolean, text?:string, reason?:string, usage?:object}>}
 */
async function complete(messages, opt) {
  opt = opt || {};
  if (!enabled()) return { ok: false, reason: '未配置大模型服务' };
  const c = config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), c.timeoutMs);
  try {
    const res = await fetch(chatUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.apiKey },
      body: JSON.stringify({
        model: opt.model || c.model,
        messages,
        temperature: typeof opt.temperature === 'number' ? opt.temperature : c.temperature,
        max_tokens: opt.maxTokens || c.maxTokens,
        stream: false
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, reason: '接口返回 ' + res.status + '：' + String(detail).slice(0, 160) };
    }
    const json = await res.json();
    const msg = json.choices && json.choices[0] && (json.choices[0].message || json.choices[0].delta);
    if (!msg || !msg.content) return { ok: false, reason: '接口返回内容为空' };
    return { ok: true, text: msg.content, usage: json.usage || null };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, reason: e.name === 'AbortError' ? '请求超时' : String(e.message || e) };
  }
}

/**
 * 流式调用：每收到一段文本就回调 onDelta
 * @returns {Promise<{ok:boolean, text?:string, reason?:string}>}
 */
async function stream(messages, opt) {
  opt = opt || {};
  if (!enabled()) return { ok: false, reason: '未配置大模型服务' };
  const c = config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), c.timeoutMs);
  try {
    const res = await fetch(chatUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.apiKey },
      body: JSON.stringify({
        model: opt.model || c.model,
        messages,
        temperature: typeof opt.temperature === 'number' ? opt.temperature : c.temperature,
        max_tokens: opt.maxTokens || c.maxTokens,
        stream: true
      }),
      signal: controller.signal
    });
    if (!res.ok || !res.body) {
      clearTimeout(timer);
      const detail = await res.text().catch(() => '');
      return { ok: false, reason: '接口返回 ' + res.status + '：' + String(detail).slice(0, 160) };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let full = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      parseSSE(text).forEach(piece => {
        full += piece;
        if (opt.onDelta) { try { opt.onDelta(piece, full); } catch (e) {} }
      });
    }
    clearTimeout(timer);
    return { ok: true, text: full };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, reason: e.name === 'AbortError' ? '请求超时' : String(e.message || e) };
  }
}

/** 连通性测试（供设置页使用） */
async function test() {
  if (!enabled()) return { ok: false, message: '未配置大模型服务（当前使用本地教学引擎）' };
  const t0 = Date.now();
  const r = await complete([{ role: 'user', content: '请只回复两个字：正常' }], { maxTokens: 16, temperature: 0 });
  if (!r.ok) return { ok: false, message: '连接失败：' + r.reason };
  return { ok: true, message: '连接成功（' + (Date.now() - t0) + ' ms）：' + String(r.text).trim().slice(0, 40) };
}

/** 运行状态（给页面显示） */
function status() {
  const c = config();
  return {
    provider: c.provider,
    providerName: (PRESETS[c.provider] || PRESETS.local).name,
    model: c.model,
    endpoint: c.endpoint,
    hasKey: !!c.apiKey,
    active: enabled()
  };
}

module.exports = { PRESETS, config, enabled, complete, stream, test, status, CONFIG_FILE };
