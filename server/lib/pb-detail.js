'use strict';

const A = require('./pb-art');
const { rect, circle, ellipse, text, path, line, poly } = A;
/* 有些细节需要质感助手（木纹、墙面、褶皱） */
const { woodGrain, wallTexture, fabricFold } = A;

/* ================= 环境细节库：每页背景至少 5 个具体物件 ================= */
/**
 * 精装绘本的背景不是一块颜色，而是一间「真的有人住」的房间。
 * 每个场景都列出 8～12 件可辨识的细节物件，渲染时按页面声明取用。
 */
const DET = {
  /* —— 温馨儿童卧室 —— */
  '星星壁纸': [A.rect(0, 0, 640, 292, { rx: 0, fill: '#fdf3e4', stroke: 'none' }),
    A.text(60, 70, '✦', { size: 18, fill: 'rgba(230,190,120,.5)' }), A.text(180, 46, '✧', { size: 14, fill: 'rgba(230,190,120,.45)' }),
    A.text(320, 76, '✦', { size: 16, fill: 'rgba(230,190,120,.5)' }), A.text(470, 44, '✧', { size: 15, fill: 'rgba(230,190,120,.45)' }),
    A.text(570, 84, '✦', { size: 13, fill: 'rgba(230,190,120,.45)' }), A.text(110, 156, '✧', { size: 13, fill: 'rgba(230,190,120,.4)' }),
    A.text(400, 140, '✦', { size: 15, fill: 'rgba(230,190,120,.42)' })],
  '木地板': [A.rect(0, 292, 640, 108, { rx: 0, fill: '#e3c9a4', stroke: 'none' })].concat(A.woodGrain(0, 292, 640, 100)),
  '木桌': A.rect(268, 246, 200, 16, { rx: 7, fill: '#d3a86e', stroke: 'rgba(120,86,44,.35)', width: 2 }),
  '桌腿': [A.rect(286, 262, 12, 58, { rx: 4, fill: '#c0955c', stroke: 'none' }), A.rect(438, 262, 12, 58, { rx: 4, fill: '#c0955c', stroke: 'none' })],
  '窗': [A.rect(56, 52, 140, 112, { rx: 10, fill: '#dff0f8', stroke: '#c8dce8', width: 4 }),
    A.line(126, 52, 126, 164, { stroke: '#c8dce8', width: 5 }), A.line(56, 108, 196, 108, { stroke: '#c8dce8', width: 5 }),
    A.rect(48, 44, 156, 8, { rx: 4, fill: '#e8d5b8', stroke: 'none' }),
    A.rect(48, 164, 156, 10, { rx: 4, fill: '#e8d5b8', stroke: 'none' })],
  '窗外绿树': [A.circle(96, 118, 30, { fill: '#a8d094', opacity: 0.85, stroke: 'none' }),
    A.circle(140, 100, 24, { fill: '#8fc47c', opacity: 0.8, stroke: 'none' }),
    A.rect(114, 130, 10, 30, { rx: 3, fill: '#a97c50', stroke: 'none' })],
  '书架': [A.rect(452, 96, 150, 138, { rx: 8, fill: '#dcbf94', stroke: 'rgba(120,86,44,.35)', width: 2 }),
    A.line(452, 140, 602, 140, { stroke: 'rgba(120,86,44,.3)', width: 3 }),
    A.line(452, 186, 602, 186, { stroke: 'rgba(120,86,44,.3)', width: 3 })],
  '堆着的绘本': [A.rect(466, 104, 18, 34, { rx: 3, fill: '#8fc7e8', stroke: 'none' }),
    A.rect(488, 108, 15, 30, { rx: 3, fill: '#e58098', stroke: 'none' }),
    A.rect(508, 102, 17, 36, { rx: 3, fill: '#a8d094', stroke: 'none' }),
    A.rect(530, 110, 14, 28, { rx: 3, fill: '#ffd98a', stroke: 'none' }),
    A.rect(466, 148, 20, 36, { rx: 3, fill: '#c9a8e0', stroke: 'none' }),
    A.rect(492, 152, 16, 32, { rx: 3, fill: '#8fc7e8', stroke: 'none' })],
  '书架上的玩偶': [A.circle(556, 122, 12, { fill: '#f0b45e', stroke: 'rgba(150,100,40,.3)', width: 1.6 }),
    A.circle(552, 120, 2.6, { fill: '#3b3630', stroke: 'none' }), A.circle(560, 120, 2.6, { fill: '#3b3630', stroke: 'none' }),
    A.poly([[548, 112], [552, 104], [556, 112]], { fill: '#f0b45e', stroke: 'none' }),
    A.poly([[560, 112], [564, 104], [568, 112]], { fill: '#f0b45e', stroke: 'none' })],
  '窗台小绿植': [A.rect(58, 168, 34, 26, { rx: 5, fill: '#d99a4e', stroke: 'none' }),
    A.ellipse(68, 156, 9, 14, { fill: '#8fc47c', stroke: 'none' }),
    A.ellipse(82, 152, 8, 12, { fill: '#a8d094', stroke: 'none' }),
    A.ellipse(74, 144, 7, 11, { fill: '#7fbf6f', stroke: 'none' })],
  '散落的画纸': [A.rect(300, 276, 46, 34, { rx: 3, fill: '#fffdf6', stroke: 'rgba(150,130,100,.35)', width: 1.4 }),
    A.rect(352, 286, 42, 30, { rx: 3, fill: '#fffdf6', stroke: 'rgba(150,130,100,.35)', width: 1.4 }),
    A.line(310, 288, 336, 288, { stroke: 'rgba(150,130,100,.4)', width: 1.6 }),
    A.line(310, 296, 330, 296, { stroke: 'rgba(150,130,100,.4)', width: 1.6 })],
  '毛绒玩具熊': [A.circle(150, 300, 22, { fill: '#d8b48c', stroke: 'rgba(150,110,70,.3)', width: 1.8 }),
    A.circle(138, 286, 9, { fill: '#d8b48c', stroke: 'rgba(150,110,70,.3)', width: 1.6 }),
    A.circle(162, 286, 9, { fill: '#d8b48c', stroke: 'rgba(150,110,70,.3)', width: 1.6 }),
    A.circle(143, 298, 3, { fill: '#4a3a2c', stroke: 'none' }), A.circle(157, 298, 3, { fill: '#4a3a2c', stroke: 'none' }),
    A.ellipse(150, 308, 5, 4, { fill: '#8a6a48', stroke: 'none' })],
  '小床': [A.rect(40, 236, 240, 74, { rx: 14, fill: '#f0dfe8', stroke: 'rgba(150,110,130,.3)', width: 2 }),
    A.rect(56, 214, 96, 34, { rx: 12, fill: '#fffdf6', stroke: 'rgba(150,110,130,.3)', width: 2 }),
    A.rect(30, 226, 20, 92, { rx: 8, fill: '#d9b0c0', stroke: 'none' })],
  '被子': [A.rect(60, 250, 210, 56, { rx: 12, fill: '#bfe0f0', stroke: 'rgba(90,140,180,.3)', width: 2 })]
    .concat(A.fabricFold(70, 256, 190, 46)),
  '床头柜': [A.rect(292, 232, 90, 62, { rx: 8, fill: '#dcbf94', stroke: 'rgba(120,86,44,.35)', width: 2 }),
    A.line(292, 262, 382, 262, { stroke: 'rgba(120,86,44,.28)', width: 2 }),
    A.circle(337, 246, 5, { fill: '#c0955c', stroke: 'none' })],

  /* —— 客厅 —— */
  '客厅墙': [A.rect(0, 0, 640, 292, { rx: 0, fill: '#f6ece0', stroke: 'none' })].concat(A.wallTexture(0, 0, 640, 292)),
  '沙发': [A.rect(368, 194, 224, 100, { rx: 20, fill: '#c2d6bc', stroke: 'rgba(90,130,80,.3)', width: 2 }),
    A.rect(388, 212, 184, 44, { rx: 12, fill: '#d4e4ce', stroke: 'none' }),
    A.rect(380, 244, 200, 26, { rx: 10, fill: '#b6ccb0', stroke: 'none' })],
  '抱枕': [A.rect(400, 210, 46, 40, { rx: 10, fill: '#f0b45e', stroke: 'rgba(150,100,40,.3)', width: 1.8 }),
    A.rect(456, 214, 42, 36, { rx: 10, fill: '#e58098', stroke: 'rgba(150,90,110,.3)', width: 1.8 })],
  '地毯': [A.ellipse(300, 336, 210, 34, { fill: '#f0dcc2', stroke: 'none' }),
    A.ellipse(300, 336, 160, 24, { fill: 'rgba(230,205,175,.7)', stroke: 'none' })],
  '照片墙': [A.rect(52, 48, 210, 146, { rx: 10, fill: '#fffaf0', stroke: 'rgba(140,110,70,.3)', width: 2 }),
    A.rect(72, 66, 52, 44, { rx: 4, fill: '#fff', stroke: 'rgba(150,130,100,.3)', width: 1.4 }),
    A.rect(136, 66, 52, 44, { rx: 4, fill: '#fff', stroke: 'rgba(150,130,100,.3)', width: 1.4 }),
    A.rect(200, 66, 46, 44, { rx: 4, fill: '#fff', stroke: 'rgba(150,130,100,.3)', width: 1.4 }),
    A.rect(72, 122, 52, 44, { rx: 4, fill: '#fff', stroke: 'rgba(150,130,100,.3)', width: 1.4 }),
    A.rect(136, 122, 52, 44, { rx: 4, fill: '#fff', stroke: 'rgba(150,130,100,.3)', width: 1.4 })],
  '挂钟': [A.circle(586, 92, 22, { fill: '#fffdf6', stroke: 'rgba(140,110,70,.4)', width: 3 }),
    A.line(586, 92, 586, 78, { stroke: '#5b6b8c', width: 2.4 }), A.line(586, 92, 596, 96, { stroke: '#5b6b8c', width: 2 })],
  '落地灯': [A.poly([[560, 150], [606, 150], [598, 176], [568, 176]], { fill: '#ffd98a', stroke: 'rgba(180,130,40,.35)', width: 2 }),
    A.line(583, 176, 583, 286, { stroke: '#b0a088', width: 5 }),
    A.ellipse(583, 288, 22, 7, { fill: '#c9b79a', stroke: 'none' })],
  '会回答的音箱': [A.rect(292, 202, 62, 88, { rx: 18, fill: '#8fb8e0', stroke: 'rgba(60,110,150,.35)', width: 2 }),
    A.circle(323, 246, 20, { fill: 'rgba(255,255,255,.72)', stroke: 'none' }),
    A.circle(323, 246, 9, { fill: '#5f8cbe', stroke: 'none' }),
    A.rect(308, 276, 30, 6, { rx: 3, fill: 'rgba(255,255,255,.6)', stroke: 'none' })],
  '摄像头': [A.rect(462, 138, 78, 48, { rx: 12, fill: '#66788f', stroke: 'none' }),
    A.circle(501, 162, 17, { fill: '#9fd0e8', stroke: 'none' }),
    A.circle(495, 156, 5, { fill: '#fff', opacity: 0.85, stroke: 'none' }),
    A.circle(530, 148, 4, { fill: '#ffc94d', stroke: 'none', class: 'pb-twinkle' })],
  '扫地的小圆盘': [A.ellipse(196, 322, 52, 18, { fill: '#eef3f8', stroke: 'rgba(90,120,150,.35)', width: 2 }),
    A.circle(196, 310, 34, { fill: '#f7fafd', stroke: 'rgba(90,120,150,.35)', width: 2 }),
    A.circle(196, 310, 14, { fill: '#8fc7e8', stroke: 'none' })],
  '积木城堡': [A.rect(272, 258, 132, 30, { rx: 5, fill: '#f0a94e', stroke: 'rgba(90,70,40,.22)', width: 1.8 }),
    A.rect(288, 232, 100, 26, { rx: 5, fill: '#8fc7e8', stroke: 'rgba(90,70,40,.22)', width: 1.8 }),
    A.rect(302, 206, 72, 26, { rx: 5, fill: '#a8d094', stroke: 'rgba(90,70,40,.22)', width: 1.8 }),
    A.poly([[302, 206], [374, 206], [338, 180]], { fill: '#e58098', stroke: 'rgba(150,90,110,.22)', width: 1.8 })],
  '地上的玩具': [A.circle(120, 338, 15, { fill: '#8fc7e8', stroke: 'rgba(90,130,160,.3)', width: 1.6 }),
    A.rect(166, 326, 36, 26, { rx: 5, fill: '#f0a94e', stroke: 'none' }),
    A.circle(224, 342, 11, { fill: '#e58098', stroke: 'none' })],
  '绿植': [A.rect(40, 246, 46, 40, { rx: 7, fill: '#c98a5a', stroke: 'none' }),
    A.ellipse(56, 226, 15, 22, { fill: '#8fc47c', stroke: 'none' }),
    A.ellipse(76, 220, 13, 20, { fill: '#a8d094', stroke: 'none' }),
    A.ellipse(64, 206, 12, 19, { fill: '#7fbf6f', stroke: 'none' })],

  /* —— 厨房 / 餐厅 —— */
  '橱柜': [A.rect(0, 60, 190, 232, { rx: 8, fill: '#e6cfa8', stroke: 'rgba(120,86,44,.3)', width: 2 }),
    A.line(95, 60, 95, 292, { stroke: 'rgba(120,86,44,.28)', width: 2.4 }),
    A.line(0, 168, 190, 168, { stroke: 'rgba(120,86,44,.28)', width: 2.4 }),
    A.circle(78, 114, 3.6, { fill: '#b08a5a', stroke: 'none' }), A.circle(110, 114, 3.6, { fill: '#b08a5a', stroke: 'none' }),
    A.circle(78, 226, 3.6, { fill: '#b08a5a', stroke: 'none' }), A.circle(110, 226, 3.6, { fill: '#b08a5a', stroke: 'none' })],
  '瓷砖墙': [A.rect(190, 60, 450, 232, { rx: 0, fill: '#f0f4f6', stroke: 'none' })].concat(A.wallTexture(190, 60, 450, 232, 'rgba(190,214,226,.5)')),
  '餐桌': [A.rect(240, 232, 300, 18, { rx: 8, fill: '#d3a86e', stroke: 'rgba(120,86,44,.35)', width: 2 })].concat(A.woodGrain(240, 232, 300, 16)),
  '餐椅': [A.rect(500, 208, 76, 90, { rx: 10, fill: '#c98a5a', stroke: 'rgba(120,86,44,.3)', width: 2 }),
    A.rect(508, 216, 60, 34, { rx: 8, fill: '#dba876', stroke: 'none' })],
  '吊灯': [A.poly([[286, 40], [392, 40], [370, 74], [308, 74]], { fill: '#ffd98a', stroke: 'rgba(180,130,40,.35)', width: 2 }),
    A.line(339, 40, 339, 16, { stroke: '#b0a088', width: 3 })],
  '水杯': [A.poly([[430, 196], [466, 196], [460, 232], [436, 232]], { fill: '#dff0f8', stroke: 'rgba(90,140,180,.4)', width: 2 }),
    A.ellipse(448, 196, 18, 5.5, { fill: '#bfe0f0', stroke: 'rgba(90,140,180,.4)', width: 1.6 })],
  '抹布': [A.rect(140, 314, 60, 38, { rx: 9, fill: '#a8d094', stroke: 'rgba(90,130,70,.35)', width: 2 })].concat(A.fabricFold(146, 318, 48, 30)),
  '水果篮': [A.path('M 496 276 l 84 0 l -12 40 l -60 0 Z', { fill: '#d9b98c', stroke: 'rgba(120,90,50,.4)', width: 2 }),
    A.circle(518, 272, 13, { fill: '#e58098', stroke: 'none' }), A.circle(546, 268, 15, { fill: '#f0a94e', stroke: 'none' }),
    A.circle(566, 274, 12, { fill: '#a8d094', stroke: 'none' })],
  '窗户厨房': [A.rect(392, 76, 230, 132, { rx: 10, fill: '#dff0f8', stroke: '#c8dce8', width: 4 }),
    A.line(507, 76, 507, 208, { stroke: '#c8dce8', width: 5 }),
    A.line(392, 142, 622, 142, { stroke: '#c8dce8', width: 5 })],

  /* —— 天台 / 夜空 —— */
  '夜空': [A.rect(0, 0, 640, 292, { rx: 0, fill: '#3b4570', stroke: 'none' }),
    A.ellipse(506, 84, 176, 120, { fill: '#55628c', opacity: 0.72, stroke: 'none' }),
    A.ellipse(112, 300, 190, 96, { fill: '#4a5680', opacity: 0.72, stroke: 'none' })],
  '月亮': [A.circle(548, 78, 38, { fill: '#fff3cf', stroke: 'none', filter: 'url(#soft)' }),
    A.circle(530, 68, 34, { fill: '#3b4570', stroke: 'none' })],
  '星星': A.starfield([[70, 52, 2.4], [158, 34, 1.8], [246, 60, 2.2], [352, 30, 2], [430, 66, 2.4], [600, 40, 1.9]]),
  '城市剪影': [A.rect(0, 240, 640, 52, { rx: 0, fill: '#4c5680', stroke: 'none' }),
    A.rect(40, 200, 46, 44, { rx: 3, fill: '#46507a', stroke: 'none' }),
    A.rect(110, 178, 38, 66, { rx: 3, fill: '#46507a', stroke: 'none' }),
    A.rect(180, 210, 54, 34, { rx: 3, fill: '#46507a', stroke: 'none' }),
    A.rect(268, 190, 42, 54, { rx: 3, fill: '#46507a', stroke: 'none' }),
    A.rect(340, 216, 60, 28, { rx: 3, fill: '#46507a', stroke: 'none' }),
    A.rect(430, 186, 40, 58, { rx: 3, fill: '#46507a', stroke: 'none' }),
    A.rect(500, 206, 52, 38, { rx: 3, fill: '#46507a', stroke: 'none' })],
  '天台栏杆': [A.rect(0, 268, 640, 12, { rx: 4, fill: '#8a94b0', stroke: 'none' }),
    A.rect(60, 250, 8, 20, { rx: 3, fill: '#8a94b0', stroke: 'none' }),
    A.rect(180, 250, 8, 20, { rx: 3, fill: '#8a94b0', stroke: 'none' }),
    A.rect(300, 250, 8, 20, { rx: 3, fill: '#8a94b0', stroke: 'none' }),
    A.rect(420, 250, 8, 20, { rx: 3, fill: '#8a94b0', stroke: 'none' }),
    A.rect(540, 250, 8, 20, { rx: 3, fill: '#8a94b0', stroke: 'none' })],
  '望远镜': [A.rect(78, 200, 30, 76, { rx: 9, fill: '#8d99ae', stroke: 'none' }),
    A.line(93, 200, 118, 156, { stroke: '#8d99ae', width: 11 }),
    A.rect(104, 142, 40, 18, { rx: 7, fill: '#66788f', stroke: 'none' })],
  '躺椅': [A.rect(396, 240, 190, 16, { rx: 7, fill: '#c9b08a', stroke: 'rgba(120,90,50,.3)', width: 2 }),
    A.poly([[406, 240], [560, 240], [586, 198], [432, 198]], { fill: '#dcc4a0', stroke: 'rgba(120,90,50,.3)', width: 2 })],
  '星星瓶': [A.rect(228, 216, 44, 52, { rx: 9, fill: 'rgba(226,239,248,.85)', stroke: 'rgba(90,140,180,.45)', width: 2.4 }),
    A.rect(238, 206, 24, 12, { rx: 4, fill: '#a97c50', stroke: 'none' }),
    A.text(250, 250, '✦', { size: 13, fill: '#ffc94d' }), A.text(240, 240, '✧', { size: 10, fill: '#ffe27a' }),
    A.text(260, 246, '✦', { size: 9, fill: '#ffd98a' })]
};
/* 场景 → 默认背景物件组合（每个都 ≥5 件，保证背景不空） */
const ROOMS = {
  bedroom: ['星星壁纸', '木地板', '窗', '窗外绿树', '书架', '堆着的绘本', '书架上的玩偶', '窗台小绿植', '床头柜'],
  bedroomNight: ['星星壁纸', '木地板', '小床', '被子', '床头柜', '窗', '书架', '堆着的绘本'],
  living: ['客厅墙', '木地板', '沙发', '抱枕', '地毯', '照片墙', '挂钟', '绿植', '落地灯'],
  livingWide: ['客厅墙', '木地板', '沙发', '抱枕', '地毯', '照片墙', '挂钟', '绿植', '书架', '堆着的绘本'],
  kitchen: ['瓷砖墙', '橱柜', '木地板', '餐桌', '餐椅', '吊灯', '窗户厨房', '水果篮'],
  rooftop: ['夜空', '月亮', '星星', '城市剪影', '天台栏杆', '躺椅', '望远镜', '星星瓶'],
  rooftopWide: ['夜空', '月亮', '星星', '城市剪影', '天台栏杆', '躺椅', '望远镜']
};
/** 取一套房间细节（自动过滤掉未定义的） */
function room(name) {
  const list = ROOMS[name] || ROOMS.living;
  const out = [];
  list.forEach(k => { if (DET[k]) out.push(DET[k]); });
  return out;
}
module.exports = { DET, ROOMS, room };
