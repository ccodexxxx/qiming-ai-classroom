# AI 视频 · 把绘本渲染成动画短片

> 主导航的「创作工坊」已下线，替换为 **AI 视频（`/video`）**。
> 它做一件具体的事：把一本科普绘本渲染成一支**可以播放、可以下载的 MP4 动画短片**。

---

## 一、为什么是「渲染」而不是「调用文生视频大模型」

| 方案 | 网络 | 稳定性 | 产物 |
| --- | --- | --- | --- |
| 调用云端文生视频 API | 必须联网 | 依赖第三方，排队/失败不可控 | 画面与绘本内容对不上 |
| **本机渲染（本模块）** | **完全离线** | **每次结果一致** | **画面就是绘本本身，字幕台词逐页对齐** |

比赛要求「功能健全、运行稳定」。云端生视频在机房里可能直接不可用，
所以这里选了本机渲染：**零外部服务、零 npm 依赖，断网也能出片。**

## 二、渲染流水线

```
绘本页面 (SVG)
   │
   ├─ ① 切成 1280×704 的帧页面
   │     画面居中 + 底部渐变字幕条（拼音 + 角色名 + 正文）
   │
   ├─ ② 无头 Chrome 逐帧截图 → PNG
   │
   ├─ ③ Windows 语音合成（Microsoft Huihui 中文女声）
   │     把「正文 + 角色台词」读成 WAV，按语音时长决定每页停留多久
   │
   └─ ④ ffmpeg 合成
         concat（每张图配 duration）→ libx264 → AAC → MP4
         再抽一帧做封面 poster.jpg
```

产物规格：**1280×704 / 25fps / H.264 + AAC / 约 1 分钟 / 约 1 MB**。

## 三、页面上有什么

| 区域 | 内容 |
| --- | --- |
| 左栏 · 挑一本故事 | 8 本绘本，带封面、年龄标识、认知点，点一下选中 |
| 左栏 · 生成设置 | ☑ 加中文配音　☑ 加拼音字幕　☑ 只渲染前 3 页（试看） |
| 右侧 · 播放器 | 渲染完成后直接播放，支持拖动进度条 |
| 右侧 · 下载 | ⬇️ 下载 MP4，旁边标注「含中文配音 · 0.9 MB · 1280×704」 |
| 右侧 · 我的作品 | 历史作品缩略图墙，点一下重新播放 |

渲染期间会显示**实时进度**：正在画第 N 帧 → 正在合成画面 → 正在配音 → 正在做封面。

## 四、接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/video` | AI 视频页 |
| GET | `/api/video/list` | 渲染能力探测 + 作品列表 |
| POST | `/api/video/render` | 提交渲染任务，立刻返回 job（HTTP 202） |
| GET | `/api/video/job?id=` | 查询任务进度 |
| GET | `/media/videos/<id>/video.mp4` | 视频文件（**支持 Range 断点续传**） |
| GET | `/media/videos/<id>/poster.jpg` | 封面 |

```jsonc
// POST /api/video/render
{ "id": "wake", "grade": 1, "voice": true, "subtitle": true, "pages": 0 }

// 202 返回
{ "ok": true,
  "job": { "id": "dac2f277f791", "status": "queued", "step": "排队中", "percent": 0 },
  "available": { "ok": true, "ffmpeg": true, "chrome": true, "tts": true } }

// GET /api/video/job?id=...
{ "ok": true,
  "job": { "status": "done", "seconds": 35.6, "bytes": 768000, "pages": 3,
           "withAudio": true,
           "url": "/media/videos/dac2f277f791/video.mp4",
           "poster": "/media/videos/dac2f277f791/poster.jpg" } }
```

## 五、工程上的取舍

| 问题 | 做法 |
| --- | --- |
| 渲染要几十秒，不能卡住 HTTP | **异步任务队列**（一次跑一个，其余排队），提交立刻返回 202 |
| 渲染会阻塞事件循环 | 全部改成 `execFile` 异步执行，渲染期间服务照常响应其他请求 |
| 视频拖动进度条 | `serveFrom()` 支持 **HTTP Range**，返回 206 |
| 连续重复图片只出一帧 | concat 用 `duration` 指令而不是重复列文件（重复列会让 PTS 溢出） |
| concat 清单带 BOM 会报错 | 用 `fs.writeFileSync(..., 'utf8')` 写，不带 BOM |
| 没有语音合成也能用 | 自动降级成「字幕版」，只是没有配音 |
| 缺 ffmpeg / Chrome | 接口返回 503 与明确原因，页面给出中文提示，不白屏 |

## 六、依赖探测

启动时自动探测三样本机能力，缺什么由 `/api/video/list` 如实报告：

```
ffmpeg    → 环境变量 FFMPEG_PATH，或常见安装路径，或 PATH
Chrome    → 环境变量 CHROME_PATH，或 Program Files 下的 chrome.exe
语音合成   → 环境变量 POWERSHELL_PATH，或 Windows 自带的 powershell.exe
```

**没有任何 npm 依赖，没有 package.json。** 所有能力都来自操作系统自带组件。
