/**
 * AI 视频 · 把绘本渲染成一支真正的 MP4 动画短片
 *
 * 全流程离线、零外部服务：
 *   1) 每一页画成一帧 1280×704 的画面（绘本 SVG 居中 + 底部拼音字幕条 + 角色名）
 *   2) 用无头 Chrome 把每帧截成 PNG
 *   3) 用 Windows 语音合成（Microsoft Huihui，中文女声）把旁白与台词读成 WAV，
 *      并用静音补到与画面等长，拼成一条完整音轨
 *   4) 用 ffmpeg 合成 H.264 + AAC 的 MP4，并生成一张封面
 *
 * 为什么走 Chrome + ffmpeg 而不是纯 Node：两者都是本机自带能力，不引入任何 npm 依赖。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, execFile } = require('child_process');

const W = 1280, H = 704;
const FPS = 25;
const HOLD = 3.6;          /* 每一页停留秒数 */
const WHO = { ai: '小AI', dian: '点点', dou: '豆豆' };

/* ---------- 工具路径：优先环境变量，其次按常见位置探测 ---------- */
function findFfmpeg() {
  const cands = [
    process.env.FFMPEG_PATH,
    'C:/Users/18667/AppData/Local/Programs/Python/Python312/Scripts/ffmpeg.exe',
    'ffmpeg', 'ffmpeg.exe'
  ].filter(Boolean);
  for (const c of cands) {
    try { execFileSync(c, ['-version'], { stdio: 'ignore' }); return c; } catch (e) { /* 继续找 */ }
  }
  return null;
}
function findChrome() {
  const cands = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
  ].filter(Boolean);
  return cands.filter(c => fs.existsSync(c))[0] || null;
}
const FFMPEG = findFfmpeg();
const CHROME = findChrome();
/** 语音合成走 Windows 自带的 System.Speech；找不到 powershell 就退化成「无配音 + 字幕」 */
function findPowershell() {
  const cands = [
    process.env.POWERSHELL_PATH,
    'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
    'powershell.exe', 'pwsh'
  ].filter(Boolean);
  for (const c of cands) {
    try { execFileSync(c, ['-NoProfile', '-Command', 'exit 0'], { stdio: 'ignore', timeout: 15000 }); return c; } catch (e) { /* 继续找 */ }
  }
  return null;
}
const POWERSHELL = findPowershell();
const hasPwsh = !!POWERSHELL;

function available() {
  return {
    ok: !!(FFMPEG && CHROME && hasPwsh),
    ffmpeg: !!FFMPEG, chrome: !!CHROME, tts: hasPwsh,
    /* 缺什么就说清楚，前端好给出准确的提示 */
    reason: !FFMPEG ? '本机没有找到 ffmpeg' : !CHROME ? '本机没有找到 Chrome' : !hasPwsh ? '本机没有找到 PowerShell' : ''
    /* 没有语音合成时仍然能出片：画面 + 字幕照常，只是没有配音 */
  };
}

/* ---------- 第 1 步：把绘本页面变成帧 HTML ---------- */
const FRAME_CSS = [
  '*{margin:0;padding:0;box-sizing:border-box}',
  'body{width:' + W + 'px;height:' + H + 'px;overflow:hidden;background:#2b2620}',
  '.stage{position:relative;width:' + W + 'px;height:' + H + 'px;display:flex;align-items:center;justify-content:center}',
  /* 绘本画面是 16:10，视频是 16:8.8；画面居中留出字幕区，不拉伸也不留黑边 */
  '.art{width:1024px;height:640px;border-radius:4px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.45)}',
  '.art svg{width:100%;height:100%;display:block}',
  '.sub{position:absolute;left:0;right:0;bottom:0;padding:14px 40px 20px;',
  'background:linear-gradient(to top,rgba(30,24,16,.88),rgba(30,24,16,0));',
  'color:#fffdf6;font:600 32px/1.42 "Microsoft YaHei","PingFang SC",sans-serif;text-align:center;',
  'text-shadow:0 3px 12px rgba(0,0,0,.5)}',
  '.who{display:inline-block;margin-right:10px;padding:1px 13px;border-radius:999px;',
  'background:#ffc94d;color:#5b4526;font-size:25px;vertical-align:2px}',
  '.pxy{font-size:21px;opacity:.82;letter-spacing:2px;margin-bottom:2px}'
].join('');

function frameHtml(page, opts) {
  opts = opts || {};
  const sub = (page.lines || []).join('');
  const py = (page.pinyin && page.pinyin[0]) ? page.pinyin[0].text : '';
  const who = (opts.subtitle !== false && page.say) ? (WHO[page.say.who] || '') : '';
  const say = (opts.subtitle !== false && page.say) ? page.say.text : '';
  return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><style>' + FRAME_CSS + '</style></head><body>' +
    '<div class="stage"><div class="art">' + page.art + '</div>' +
    (opts.subtitle === false ? '' :
      '<div class="sub"><div class="pxy">' + py + '</div>' +
      '<div>' + (who ? '<span class="who">' + who + '</span>' : '') +
      (say ? say + '　' : '') + sub + '</div></div>') +
    '</div></body></html>';
}


/** 异步执行：渲染要跑几十秒，绝不能阻塞服务器的事件循环 */
function run(cmd, args, opt) {
  opt = opt || {};
  return new Promise(function (resolve, reject) {
    const child = execFile(cmd, args, {
      timeout: opt.timeout || 300000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true
    }, function (err, stdout, stderr) {
      if (err) { err.stderr = stderr; reject(err); } else resolve({ stdout: stdout, stderr: stderr });
    });
    if (opt.input && child.stdin) child.stdin.end(opt.input);
  });
}
/* ---------- 第 2 步：Chrome 截图 ---------- */
async function shoot(htmlPath, pngPath, profileDir) {
  try {
    await run(CHROME, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--window-size=' + W + ',' + H, '--force-device-scale-factor=1',
      '--virtual-time-budget=3000',
      '--screenshot=' + pngPath,
      '--user-data-dir=' + profileDir,
      'file:///' + htmlPath.replace(/\\/g, '/')
    ], { timeout: 90000 });
  } catch (e) { /* 截图失败交给下面统一判断 */ }
  return fs.existsSync(pngPath) && fs.statSync(pngPath).size > 8000;
}

/* ---------- 第 3 步：语音合成 ---------- */
function speak(text, wavPath, rate) {
  if (!hasPwsh || !text) return false;
  /* 用 pwsh 调 Windows 自带的语音合成，中文女声 Microsoft Huihui */
  const script = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    'try { $s.SelectVoice("Microsoft Huihui Desktop") } catch {}',
    '$s.Rate = ' + Math.round(rate === undefined ? -2 : rate),
    '$s.SetOutputToWaveFile("' + wavPath.replace(/\\/g, '\\\\') + '")',
    '$s.Speak([Console]::In.ReadToEnd())',
    '$s.Dispose()'
  ].join('; ');
  try {
    /* 走管道把文本喂进去，避免中文在命令行参数上被转义搞乱 */
    execFileSync(POWERSHELL, ['-NoProfile', '-Command', script], {
      input: Buffer.from(String(text), 'utf8'), stdio: ['pipe', 'ignore', 'ignore'], timeout: 90000
    });
    return fs.existsSync(wavPath) && fs.statSync(wavPath).size > 2000;
  } catch (e) { return false; }
}
/** 从 WAV 头算时长（避免再依赖 ffprobe） */
function wavSeconds(p) {
  try {
    const b = fs.readFileSync(p);
    const i = b.indexOf(Buffer.from('data'));
    if (i < 0) return 0;
    const byteRate = b.readUInt32LE(28);
    const size = b.readUInt32LE(i + 4);
    return byteRate ? size / byteRate : 0;
  } catch (e) { return 0; }
}

/* ---------- 主流程 ---------- */
/**
 * @param {object} book  pb.build() 的结果
 * @param {object} opt   { dir, subtitle, voice, grade }
 * @param {function} onStep 进度回调 (阶段文字, 百分比)
 */
async function render(book, opt, onStep) {
  opt = opt || {};
  const step = (t, p) => { if (onStep) onStep(t, p); };
  const av = available();
  /* ffmpeg 与 Chrome 是硬条件；语音合成没有就降级成字幕版 */
  if (!av.ffmpeg || !av.chrome) return { ok: false, reason: av.reason };

  const dir = opt.dir;
  const framesDir = path.join(dir, 'frames');
  const audioDir = path.join(dir, 'audio');
  fs.mkdirSync(framesDir, { recursive: true });
  fs.mkdirSync(audioDir, { recursive: true });

  const pages = book.pages;
  const subtitle = opt.subtitle !== false;
  const voice = opt.voice !== false && hasPwsh;

  /* 逐页：先截帧，再配旁白 */
  const pngs = [];
  const segments = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    step('正在画第 ' + (i + 1) + ' / ' + pages.length + ' 帧', 5 + Math.round(45 * i / pages.length));
    const htmlPath = path.join(framesDir, 'f' + i + '.html');
    const pngPath = path.join(framesDir, 'f' + i + '.png');
    fs.writeFileSync(htmlPath, frameHtml(p, { subtitle: subtitle }), 'utf8');
    const ok = await shoot(htmlPath, pngPath, path.join(dir, 'chrome', 'p' + (i % 3)));
    if (!ok) return { ok: false, reason: '第 ' + (i + 1) + ' 帧截图失败' };
    pngs.push(pngPath);

    /* 旁白 = 正文 + 角色台词；有语音就按语音长度决定这一页停留多久 */
    let sec = HOLD;
    if (voice) {
      const line = (p.lines || []).join('') + (p.say ? '。' + (WHO[p.say.who] || '') + '说：' + p.say.text : '');
      const wav = path.join(audioDir, 'a' + i + '.wav');
      if (speak(line, wav, opt.rate)) {
        const d = wavSeconds(wav) + 0.7;      /* 留一点呼吸感 */
        sec = Math.max(2.2, Math.min(14, d));
        segments.push({ wav: wav, dur: sec });
      } else {
        segments.push(null);
      }
    } else {
      segments.push(null);
    }
    segments[i] = Object.assign(segments[i] || {}, { dur: sec });
  }

  /* 画面：用 concat 的 duration 指令给每张图定时长。
     不能把同一张图重复列 90 次 —— 那会让 PTS 溢出、只出一帧。 */
  step('正在合成画面…', 55);
  const listFile = path.join(dir, 'list.txt');
  const lines = [];
  pngs.forEach((png, i) => {
    lines.push("file '" + png.replace(/\\/g, '/') + "'");
    lines.push('duration ' + (segments[i].dur || HOLD).toFixed(3));
  });
  /* 最后一张要再列一次，concat 才会把上一段的时长算进去 */
  lines.push("file '" + pngs[pngs.length - 1].replace(/\\/g, '/') + "'");
  fs.writeFileSync(listFile, lines.join('\n') + '\n', 'utf8');

  /* 总时长：每页按自己的秒数累加。
     concat 解复用器会把连续重复的图片当成「同一帧」，所以必须显式给总时长。 */
  const totalSec = segments.reduce((n, s) => n + (s.dur || HOLD), 0);
  const silent = path.join(dir, 'silent.mp4');
  await run(FFMPEG, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0', '-i', listFile,
    '-vf', 'fps=' + FPS + ',format=yuv420p',
    '-t', totalSec.toFixed(3),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22',
    '-pix_fmt', 'yuv420p',
    silent
  ], { timeout: 300000 });
  if (!fs.existsSync(silent)) return { ok: false, reason: '画面合成失败' };

  /* 音轨：把每页的旁白接到时间轴上，空隙补静音 */
  let finalMp4 = silent;
  let withAudio = false;
  if (voice && segments.some(s => s && s.wav)) {
    step('正在配音…', 78);
    const parts = [];
    segments.forEach((s, i) => {
      if (s && s.wav && fs.existsSync(s.wav)) {
        const real = wavSeconds(s.wav);
        parts.push({ wav: s.wav, pad: Math.max(0, (s.dur || HOLD) - real) });
      } else {
        parts.push({ silent: s.dur || HOLD });
      }
    });
    /* 每段先统一成 22050Hz 单声道，再拼接 */
    const segFiles = [];
    for (let i = 0; i < parts.length; i++) {
      const p2 = parts[i];
      const out = path.join(audioDir, 's' + i + '.wav');
      if (p2.wav) {
        const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', p2.wav];
        if (p2.pad > 0.05) args.push('-af', 'apad=pad_dur=' + p2.pad.toFixed(2));
        args.push('-ar', '22050', '-ac', '1', out);
        try { await run(FFMPEG, args, { timeout: 120000 }); } catch (e) { /* 单段失败就跳过 */ }
      } else {
        try { await run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error',
          '-f', 'lavfi', '-i', 'anullsrc=r=22050:cl=mono', '-t', String(p2.silent),
          '-ar', '22050', '-ac', '1', out], { timeout: 120000 }); } catch (e) {}
      }
      if (fs.existsSync(out)) segFiles.push(out);
    }
    if (segFiles.length) {
      const alist = path.join(dir, 'alist.txt');
      fs.writeFileSync(alist, segFiles.map(f => "file '" + f.replace(/\\/g, '/') + "'").join('\n') + '\n', 'utf8');
      const track = path.join(dir, 'track.wav');
      await run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error',
        '-f', 'concat', '-safe', '0', '-i', alist, '-c', 'copy', track],
        { timeout: 180000 });
      if (fs.existsSync(track)) {
        const muxed = path.join(dir, 'video.mp4');
        await run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error',
          '-i', silent, '-i', track,
          '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', muxed],
          { timeout: 180000 });
        if (fs.existsSync(muxed)) { finalMp4 = muxed; withAudio = true; }
      }
    }
  }

  /* 封面 */
  step('正在做封面…', 92);
  const poster = path.join(dir, 'poster.jpg');
  try {
    await run(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error',
      '-i', finalMp4, '-ss', '0.6', '-frames:v', '1', '-q:v', '3', poster],
      { timeout: 60000 });
  } catch (e) { /* 封面失败不影响视频 */ }

  /* 时长与体积 */
  let seconds = 0;
  try {
    /* ffmpeg 只报「没有输出文件」，视频信息在 stderr 里，所以这里必然抛错 */
    await run(FFMPEG, ['-hide_banner', '-i', finalMp4], { timeout: 60000 });
  } catch (e) {
    const txt = String((e.stderr || '') + (e.stdout || ''));
    const m = txt.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
    if (m) seconds = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
  step('完成', 100);
  return {
    ok: true,
    file: finalMp4,
    poster: fs.existsSync(poster) ? poster : null,
    seconds: Math.round(seconds * 10) / 10,
    bytes: fs.statSync(finalMp4).size,
    pages: pages.length,
    withAudio: withAudio,
    width: W, height: H, fps: FPS
  };
}

module.exports = { available, render, frameHtml, findFfmpeg, findChrome, W, H, FPS };
