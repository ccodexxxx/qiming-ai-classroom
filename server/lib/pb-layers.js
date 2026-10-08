/**
 * AI 绘本 · 五层画面编排
 *
 * 每一页都必须同时具备五层，缺一层即不合格（由 pb-engine.validate() 强制检查）：
 *   1) 前景层 — 靠近镜头的小物件：飘落的树叶、飞过的蝴蝶、散落的玩具、冒出的气泡、伸向镜头的手
 *   2) 中景层 — 主角与互动对象，占画面 40%～60%，有明确动作、表情、道具、互动关系
 *   3) 背景层 — 生活化场景，含 2～3 个可辨识物件
 *   4) 氛围层 — 光线、色彩、天气、情绪
 *   5) 彩蛋层 — 1～2 个让孩子找的小细节
 *
 * 同时规定镜头（禁止每页平视居中）与动势特效。
 * 节奏由 validate() 检查：每 2 页换镜头、每 3 页有视觉惊喜、每 4 页色彩明显变化。
 */
'use strict';

const A = require('./pb-art');
const cast = require('./pb-cast');
const P = cast.prop || null;   /* 道具在 pb-scenes 里定义，这里只写描述与位置 */

/* 说明：LAYERS 只负责「这一页有哪些层、镜头是什么、彩蛋藏哪」，
   具体绘制交给 pb-scenes，两边用同一个 scene 名对齐。 */

const LAYERS = {
  wake1: {
    camera: '特写', focus: '盒子',
    front: [{ kind: 'leaves', at: [[60, 320, 1.1], [560, 300, 0.9]], desc: '窗外飘进来的两片小叶子，慢慢落到桌面' }, { kind: 'bubble', at: [[120, 210, 9]], desc: '盒子缝里冒出的一个小气泡' }],
    mid: { who: 'dian', pose: 'reach', expr: 'wonder', prop: null, partner: '盒子', desc: '点点踮着脚、伸出手想去碰盒子，眼睛睁得圆圆的' },
    back: { scene: '客厅的一角', items: ['木桌子', '窗户', '书架上的图画书'], room: 'livingWide' },
    atmos: { mood: 'curious', light: '柔和晨光', extra: '窗外一条斜斜的阳光落在桌面上', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'cat', at: [560, 350, 0.4], desc: '桌腿旁边露出一只小猫的尾巴' }],
    motion: '盒子轻轻晃了一下，冒出一点灰尘'
  },
  wake2: {
    camera: '仰视', focus: '跳出来的小AI',
    front: [{ kind: 'dust', at: [300, 300], desc: '盒子打开时扬起的灰尘' }, { kind: 'bubble', at: [[400, 150, 10], [440, 120, 6]], desc: '小AI 身边冒出的光泡' }],
    mid: { who: 'ai', pose: 'jump', expr: 'star', prop: null, partner: '点点', desc: '小AI 从盒子里蹦出来，两只手举得高高的，眼睛变成星星' },
    back: { scene: '客厅的一角', items: ['木桌子', '窗户', '地垫'], room: 'livingWide' },
    atmos: { mood: 'happy', light: '明亮阳光', extra: '小AI 头顶的灯把周围照亮了一圈', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'ball', at: [110, 350, 0.8], desc: '地上滚着一颗小皮球' }],
    motion: '速度线从下往上，说明它是「蹦」出来的'
  },
  wake3: {
    camera: '中景', focus: '两个角色对视',
    front: [{ kind: 'butterfly', at: [80, 120], desc: '窗外飞过一只小蝴蝶' }],
    mid: { who: 'dian', pose: 'lie', expr: 'wonder', prop: null, partner: '小AI', desc: '点点趴下来，把脸凑近小AI，好奇地看着它' },
    back: { scene: '客厅的一角', items: ['木桌子', '窗户', '墙上的画'], room: 'livingWide' },
    atmos: { mood: 'curious', light: '柔和晨光', extra: '地毯上有一小块光斑', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'picture', at: [90, 120, 0.7], desc: '墙上挂着一幅小画，画着一棵树' }],
    motion: null
  },
  wake4: {
    camera: '特写', focus: '小AI 的脸',
    front: [{ kind: 'bubble', at: [[150, 250, 8]], desc: '一个慢慢瘪掉的小气泡' }],
    mid: { who: 'ai', pose: 'cover', expr: 'puzzled', prop: null, partner: '点点', desc: '小AI抱住自己的头，头顶的灯一闪一闪，旁边飘着两个问号' },
    back: { scene: '客厅的一角', items: ['木桌子', '窗户'], room: 'livingWide' },
    atmos: { mood: 'puzzled', light: '柔和散射光', extra: '画面右侧的光变暗了一点', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'footprints', at: [520, 350, 0.8], desc: '地上有一串小小的脚印' }],
    motion: '问号轻轻上下浮动'
  },
  wake5: {
    camera: '中景', focus: '小AI 低下的头',
    front: [{ kind: 'butterfly', at: [96, 128], desc: '一只小蝴蝶从镜头前飞过' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'cover', expr: 'sad', prop: null, partner: '点点', desc: '小AI 抱住自己的头，灯暗了下来' },
    back: { scene: '客厅的一角', items: ['木桌子', '窗户', '地垫'], room: 'livingWide' },
    atmos: { mood: 'setback', light: '阴天柔光', extra: '画面整体偏冷，只有一点暖色留在点点身上', source: 'overcast', shadow: '几乎没有硬影，只有柔和的接触阴影' },
    egg: [{ kind: 'bird', at: [560, 90, 0.9], desc: '窗外飞过一只小鸟' }],
    motion: '小AI 两边的速度线表示它在轻轻发抖',
    surprise: '一只小蝴蝶从镜头前飞过'
  },
  wake6: {
    camera: '远景', focus: '点点抱书跑来',
    front: [{ kind: 'bubble', at: [[120, 300, 7], [160, 280, 5]], desc: '桌上水杯里冒出的气泡' }],
    mid: { who: 'dian', pose: 'jump', expr: 'happy', prop: '图画书', partner: '小AI', desc: '点点抱着一叠图画书跳起来，笑得眼睛弯成月牙' },
    back: { scene: '客厅的一角', items: ['木桌子', '窗户', '书架'], room: 'livingWide' },
    atmos: { mood: 'thinking', light: '明亮均匀', extra: '画面亮起来，像有了希望', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'ball', at: [580, 350, 0.7], desc: '书架底下藏着一颗小球' }],
    motion: '点点身后有动势弧线'
  },
  wake7: {
    camera: '俯视', focus: '摊开的照片',
    front: [{ kind: 'stars', at: [[140, 108, 0.85], [520, 92, 0.75]], desc: '飘落的星星' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'reach', expr: 'wonder', prop: '照片', partner: '点点', desc: '小AI 伸手一张张翻看照片，眼睛越睁越大' },
    back: { scene: '客厅的一角', items: ['照片墙', '木桌子', '地垫'], room: 'livingWide' },
    atmos: { mood: 'wonder', light: '暖阳聚焦', extra: '每张照片上都有一小块光斑', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'cat', at: [80, 350, 0.42], desc: '照片墙下面趴着一只真的小猫' }],
    motion: '照片被翻动，边上带一点点扬尘',
    surprise: '飘落的星星'
  },
  wake8: {
    camera: '大特写', focus: '照片里的老虎',
    front: [{ kind: 'bubble', at: [[480, 300, 6]], desc: '小AI 头上冒出的一个小气泡，破掉了' }],
    mid: { who: 'ai', pose: 'back', expr: 'worried', prop: '照片', partner: '点点', desc: '小AI 举着照片往后退了一步，嘴张成圆形' },
    back: { scene: '客厅的一角', items: ['木桌子', '窗户'], room: 'livingWide' },
    atmos: { mood: 'setback', light: '阴天柔光', extra: '光线偏灰，只有照片是亮的', source: 'overcast', shadow: '几乎没有硬影，只有柔和的接触阴影' },
    egg: [{ kind: 'picture', at: [110, 120, 0.6], desc: '墙上的画里藏着一只小猫' }],
    motion: '后退的速度线 + 一点扬尘'
  },
  wake9: {
    camera: '倾斜构图', focus: '欢呼的两个角色',
    front: [{ kind: 'stars', at: [[140, 110, 0.8], [520, 90, 0.7]], desc: '飘落的星星' }],
    mid: { who: 'ai', pose: 'spin', expr: 'laugh', prop: '照片', partner: '点点', desc: '小AI 举着照片原地转圈，点点在一边举手欢呼' },
    back: { scene: '客厅的一角', items: ['照片墙', '木桌子', '窗户'], room: 'livingWide' },
    atmos: { mood: 'success', light: '暖阳 + 光斑', extra: '金色光斑洒满整页', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'glowButton', at: [600, 200, 0.9], desc: '画面右边有一个会发光的小按钮，点它会亮' }],
    motion: '转圈的动势弧线 + 放射光'
  },
  wake10: {
    camera: '中景', focus: '靠在一起的两个朋友',
    front: [{ kind: 'bubbles', at: [[150, 300, 8], [190, 280, 5]], desc: '桌上一杯水里冒出的小气泡' }],
    mid: { who: 'ai', pose: 'reach', expr: 'shy', prop: null, partner: '点点', desc: '小AI伸出手，两个都红了脸' },
    back: { scene: '客厅的一角', items: ['木桌子', '窗户', '墙上的画'], room: 'livingWide' },
    atmos: { mood: 'warm', light: '暖光柔和', extra: '整个画面是橘粉色的', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'cat', at: [580, 340, 0.45], desc: '角落里的小猫也闭上了眼睛' }],
    motion: null
  },
  ear1: {
    camera: '特写', focus: '豆豆有耳朵',
    front: [{ kind: 'butterfly', at: [96, 128], desc: '一只小蝴蝶从镜头前飞过' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dou', pose: 'tiptoe', expr: 'laugh', prop: null, partner: '点点', desc: '豆豆踮起脚尖，张着嘴大笑，说：「汪汪！我听见风在跑！」' },
    back: { scene: '客厅', items: ['会回答的音箱', '沙发', '窗户'], room: 'livingWide' },
    atmos: { mood: 'happy', light: '明亮阳光', extra: '阳光从窗户照进来，画面暖洋洋的', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'footprints', at: [150, 352, 0.8], desc: '地上留着一串小脚印' }, { kind: 'ball', at: [110, 350, 0.75], desc: '地上滚着一颗小球' }],
    motion: '做「clap」互动时带一点动势线',
    surprise: '一只小蝴蝶从镜头前飞过'
  },
  ear2: {
    camera: '仰视', focus: '声音是波浪',
    front: [{ kind: 'butterfly', at: [560, 120], desc: '一只蝴蝶停在窗边' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'reach', expr: 'wonder', prop: '小风车', partner: '点点', desc: '小AI伸出手，眼睛睁得圆圆的，说：「我的身体里也有一条这样的波浪！」，手里拿着小风车' },
    back: { scene: '客厅', items: ['会回答的音箱', '沙发', '窗户'], room: 'livingWide' },
    atmos: { mood: 'curious', light: '柔和晨光', extra: '清晨的光斜斜地铺在地上', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'plane', at: [565, 130, 0.85], desc: '窗台上放着一只纸飞机' }, { kind: 'picture', at: [100, 118, 0.65], desc: '墙上挂着一幅小画' }],
    motion: '做「blow」互动时带一点动势线'
  },
  ear3: {
    camera: '俯视', focus: '波浪切成小段',
    front: [{ kind: 'leaves', at: [[80, 320, 0.95]], desc: '一片小叶子慢慢飘落' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dou', pose: 'cover', expr: 'puzzled', prop: '小篮子', partner: '点点', desc: '豆豆抱住自己的头，歪着头，说：「这些小块块，我好像见过！」，手里拿着小篮子' },
    back: { scene: '客厅', items: ['会回答的音箱', '沙发', '窗户'], room: 'livingWide' },
    atmos: { mood: 'puzzled', light: '柔和散射光', extra: '光变得均匀而安静，右边略暗', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'cat', at: [580, 348, 0.42], desc: '角落里躲着一只小猫' }, { kind: 'bird', at: [575, 85, 0.85], desc: '窗外飞过一只小鸟' }],
    motion: '做「drag」互动时带一点动势线'
  },
  ear4: {
    camera: '倾斜构图', focus: '听错啦',
    front: [{ kind: 'stars', at: [[140, 108, 0.85], [520, 92, 0.75]], desc: '飘落的星星' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dou', pose: 'cover', expr: 'worried', prop: '照片', partner: '点点', desc: '豆豆抱住自己的头，皱着眉头，说：「汪汪？我猜的对吗？」，手里拿着照片' },
    back: { scene: '客厅', items: ['会回答的音箱', '沙发', '窗户'], room: 'livingWide' },
    atmos: { mood: 'worried', light: '阴影略重', extra: '光线变冷了一点，影子被拉长', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'ball', at: [110, 350, 0.75], desc: '地上滚着一颗小球' }, { kind: 'footprints', at: [150, 352, 0.8], desc: '地上留着一串小脚印' }],
    motion: '做「choose」互动时带一点动势线',
    surprise: '飘落的星星'
  },
  ear5: {
    camera: '大特写', focus: '慢一点，说清楚',
    front: [{ kind: 'bubbles', at: [[540, 300, 7]], desc: '桌边冒出两个小气泡' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'jump', expr: 'calm', prop: '话筒', partner: '点点', desc: '点点跳了起来，安安静静地，说：「小——猫——的——歌——」，手里拿着话筒' },
    back: { scene: '客厅', items: ['会回答的音箱', '沙发', '窗户'], room: 'livingWide' },
    atmos: { mood: 'thinking', light: '明亮均匀', extra: '画面重新亮起来，像有了希望', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'picture', at: [100, 118, 0.65], desc: '墙上挂着一幅小画' }, { kind: 'plane', at: [565, 130, 0.85], desc: '窗台上放着一只纸飞机' }],
    motion: '做「say」互动时带一点动势线'
  },
  ear6: {
    camera: '框中框', focus: '原来要这样',
    front: [{ kind: 'leaves', at: [[600, 325, 0.85]], desc: '一片叶子落在画面边角' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dou', pose: 'reach', expr: 'star', prop: '放大镜', partner: '点点', desc: '豆豆伸出手，眼睛变成星星，说：「原来不是我没用，是我没听清！」，手里拿着放大镜' },
    back: { scene: '客厅', items: ['会回答的音箱', '沙发', '窗户'], room: 'livingWide' },
    atmos: { mood: 'wonder', light: '暖阳聚焦', extra: '一束暖光正好落在关键的东西上', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'bird', at: [575, 85, 0.85], desc: '窗外飞过一只小鸟' }, { kind: 'cat', at: [580, 348, 0.42], desc: '角落里躲着一只小猫' }],
    motion: '做「find」互动时带一点动势线'
  },
  ear7: {
    camera: '远景', focus: '这次放对啦',
    front: [{ kind: 'glowButton', at: [588, 188, 0.9], desc: '一个会发光的小按钮，点它会亮' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dou', pose: 'spin', expr: 'laugh', prop: null, partner: '点点', desc: '豆豆原地转圈，张着嘴大笑，说：「我听懂啦！我听懂啦！」' },
    back: { scene: '客厅', items: ['会回答的音箱', '沙发', '窗户'], room: 'livingWide' },
    atmos: { mood: 'success', light: '暖阳 + 光斑', extra: '金色光斑洒满整页', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'footprints', at: [150, 352, 0.8], desc: '地上留着一串小脚印' }, { kind: 'ball', at: [110, 350, 0.75], desc: '地上滚着一颗小球' }],
    motion: '做「clap」互动时带一点动势线',
    surprise: '一个会发光的小按钮，点它会亮'
  },
  ear8: {
    camera: '中景', focus: '最重要的那句话',
    front: [{ kind: 'butterfly', at: [560, 120], desc: '一只蝴蝶停在窗边' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'lie', expr: 'shy', prop: null, partner: '点点', desc: '点点趴下来，脸红了，说：「你听得懂最重要的话，就够了。」' },
    back: { scene: '客厅', items: ['会回答的音箱', '沙发', '窗户'], room: 'livingWide' },
    atmos: { mood: 'warm', light: '暖光柔和', extra: '整个画面是暖暖的橘粉色', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'plane', at: [565, 130, 0.85], desc: '窗台上放着一只纸飞机' }, { kind: 'picture', at: [100, 118, 0.65], desc: '墙上挂着一幅小画' }],
    motion: '做「tap」互动时带一点动势线'
  },
  eye1: {
    camera: '远景', focus: '豆豆脸上的小屏幕',
    front: [{ kind: 'butterfly', at: [110, 130], desc: '一只小蝴蝶从镜头前飞过' }],
    mid: { who: 'dou', pose: 'tiptoe', expr: 'happy', prop: null, partner: '点点', desc: '豆豆踮起脚，尾巴摇得像小风扇' },
    back: { scene: '客厅', items: ['沙发', '窗户', '地上的玩具'], room: 'livingWide' },
    atmos: { mood: 'happy', light: '明亮阳光', extra: '阳光从窗户照进来', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'ball', at: [590, 350, 0.75], desc: '沙发底下滚着一颗球' }],
    motion: '尾巴的摇动线'
  },
  eye2: {
    camera: '大特写', focus: '一格一格的数字方块',
    front: [{ kind: 'leaves', at: [[90, 330, 0.9]], desc: '一片叶子落在格子上' }],
    mid: { who: 'dou', pose: 'reach', expr: 'wonder', prop: '放大镜', partner: '小AI', desc: '豆豆举着放大镜，一格一格地看图片' },
    back: { scene: '客厅', items: ['沙发', '窗户'], room: 'livingWide' },
    atmos: { mood: 'curious', light: '柔和晨光', extra: '格子发出淡淡的蓝光', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'bird', at: [580, 80, 0.85], desc: '窗外停着一只小鸟' }],
    motion: '格子逐个点亮'
  },
  eye3: {
    camera: '特写', focus: '小猫的耳朵和胡须',
    front: [{ kind: 'glowButton', at: [588, 188, 0.9], desc: '一个会发光的小按钮，点它会亮' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'lie', expr: 'happy', prop: '照片', partner: '小猫', desc: '点点趴下来' },
    back: { scene: '客厅', items: ['沙发', '墙上的画'], room: 'livingWide' },
    atmos: { mood: 'thinking', light: '明亮均匀', extra: '照片上有一个明亮的光圈', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'cat', at: [90, 340, 0.4], desc: '真的小猫趴在地上和他对视' }],
    motion: null,
    surprise: '一个会发光的小按钮，点它会亮'
  },
  eye4: {
    camera: '俯视', focus: '摊满一地的照片',
    front: [{ kind: 'leaves', at: [[140, 320, 1], [600, 330, 0.8]], desc: '两片叶子落在照片堆里' }],
    mid: { who: 'dou', pose: 'lie', expr: 'wonder', prop: '照片', partner: '点点', desc: '豆豆趴在一堆照片中间，一张一张看' },
    back: { scene: '客厅', items: ['照片墙', '沙发', '地垫'], room: 'livingWide' },
    atmos: { mood: 'wonder', light: '暖阳聚焦', extra: '每张照片都反着一点光', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'plane', at: [570, 120, 0.9], desc: '窗台上放着一只纸飞机' }],
    motion: '照片被风吹动了一下'
  },
  eye5: {
    camera: '仰视', focus: '小老虎的照片',
    front: [{ kind: 'butterfly', at: [96, 128], desc: '一只小蝴蝶从镜头前飞过' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dou', pose: 'back', expr: 'worried', prop: '照片', partner: '点点', desc: '豆豆看清了照片上的条纹，往后退了半步' },
    back: { scene: '客厅', items: ['沙发', '窗户'], room: 'livingWide' },
    atmos: { mood: 'setback', light: '阴天柔光', extra: '画面偏冷，只有照片是暖色', source: 'overcast', shadow: '几乎没有硬影，只有柔和的接触阴影' },
    egg: [{ kind: 'footprints', at: [110, 350, 0.85], desc: '地上有老虎的小脚印' }],
    motion: '后退的速度线 + 汗滴',
    surprise: '一只小蝴蝶从镜头前飞过'
  },
  eye6: {
    camera: '中景', focus: '新加进去的学习卡片',
    front: [{ kind: 'bubbles', at: [[540, 300, 6]], desc: '一个小气泡' }],
    mid: { who: 'dian', pose: 'reach', expr: 'happy', prop: '学习卡片', partner: '豆豆', desc: '点点把新卡片放进盒子里' },
    back: { scene: '客厅', items: ['沙发', '书架', '地垫'], room: 'livingWide' },
    atmos: { mood: 'thinking', light: '明亮均匀', extra: '卡片边缘有一点高光', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'picture', at: [560, 110, 0.6], desc: '墙上的画换成了一只老虎' }],
    motion: null
  },
  eye7: {
    camera: '倾斜构图', focus: '欢呼的豆豆',
    front: [{ kind: 'stars', at: [[130, 120, 0.9], [540, 100, 0.8]], desc: '飘落的星星' }],
    mid: { who: 'dou', pose: 'spin', expr: 'laugh', prop: null, partner: '点点', desc: '豆豆高兴得原地转圈，点点也举手欢呼' },
    back: { scene: '客厅', items: ['沙发', '窗户', '照片墙'], room: 'livingWide' },
    atmos: { mood: 'success', light: '暖阳 + 光斑', extra: '金色光斑撒满画面', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'glowButton', at: [600, 190, 0.85], desc: '一个会发光的小按钮' }],
    motion: '转圈弧线 + 放射光'
  },
  eye8: {
    camera: '中景', focus: '互相看着的两个朋友',
    front: [{ kind: 'butterfly', at: [90, 150], desc: '蝴蝶停在窗台上' }],
    mid: { who: 'dou', pose: 'tiptoe', expr: 'shy', prop: null, partner: '点点', desc: '豆豆踮起脚尖，点点摸摸它' },
    back: { scene: '客厅', items: ['沙发', '窗户', '墙上的画'], room: 'livingWide' },
    atmos: { mood: 'warm', light: '暖光柔和', extra: '画面是暖暖的橘粉色', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'cat', at: [580, 345, 0.42], desc: '角落里的小猫也靠了过来' }],
    motion: null
  },
  talk1: {
    camera: '特写', focus: '小AI 想说话',
    front: [{ kind: 'bubbles', at: [[540, 300, 7]], desc: '桌边冒出两个小气泡' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'tiptoe', expr: 'wonder', prop: '话筒', partner: '点点', desc: '小AI踮起脚尖，眼睛睁得圆圆的，说：「……我，想给你讲个故事。」，手里拿着话筒' },
    back: { scene: '卧室', items: ['小床', '台灯', '书架'], room: 'bedroomNight' },
    atmos: { mood: 'curious', light: '柔和晨光', extra: '清晨的光斜斜地铺在地上', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'picture', at: [100, 118, 0.65], desc: '墙上挂着一幅小画' }, { kind: 'plane', at: [565, 130, 0.85], desc: '窗台上放着一只纸飞机' }],
    motion: '做「say」互动时带一点动势线'
  },
  talk2: {
    camera: '仰视', focus: '身体里有声音碎片',
    front: [{ kind: 'leaves', at: [[600, 325, 0.85]], desc: '一片叶子落在画面边角' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'jump', expr: 'calm', prop: '放大镜', partner: '点点', desc: '小AI跳了起来，安安静静地，说：「因为我的身体里藏了好多好多声音碎片呀！」，手里拿着放大镜' },
    back: { scene: '卧室', items: ['小床', '台灯', '书架'], room: 'bedroomNight' },
    atmos: { mood: 'thinking', light: '明亮均匀', extra: '画面重新亮起来，像有了希望', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'bird', at: [575, 85, 0.85], desc: '窗外飞过一只小鸟' }, { kind: 'cat', at: [580, 348, 0.42], desc: '角落里躲着一只小猫' }],
    motion: '做「find」互动时带一点动势线'
  },
  talk3: {
    camera: '俯视', focus: '拼出第一句',
    front: [{ kind: 'butterfly', at: [96, 128], desc: '一只小蝴蝶从镜头前飞过' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'back', expr: 'laugh', prop: '小篮子', partner: '点点', desc: '小AI往后退了半步，张着嘴大笑，说：「点——点——你——好——」，手里拿着小篮子' },
    back: { scene: '卧室', items: ['小床', '台灯', '书架'], room: 'bedroomNight' },
    atmos: { mood: 'happy', light: '明亮阳光', extra: '阳光从窗户照进来，画面暖洋洋的', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'footprints', at: [150, 352, 0.8], desc: '地上留着一串小脚印' }, { kind: 'ball', at: [110, 350, 0.75], desc: '地上滚着一颗小球' }],
    motion: '做「drag」互动时带一点动势线',
    surprise: '一只小蝴蝶从镜头前飞过'
  },
  talk4: {
    camera: '倾斜构图', focus: '说乱了',
    front: [{ kind: 'butterfly', at: [560, 120], desc: '一只蝴蝶停在窗边' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'back', expr: 'worried', prop: '照片', partner: '点点', desc: '小AI往后退了半步，皱着眉头，说：「哎呀，我的小块块排队排乱了！」，手里拿着照片' },
    back: { scene: '卧室', items: ['小床', '台灯', '书架'], room: 'bedroomNight' },
    atmos: { mood: 'worried', light: '阴影略重', extra: '光线变冷了一点，影子被拉长', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'plane', at: [565, 130, 0.85], desc: '窗台上放着一只纸飞机' }, { kind: 'picture', at: [100, 118, 0.65], desc: '墙上挂着一幅小画' }],
    motion: '做「choose」互动时带一点动势线'
  },
  talk5: {
    camera: '大特写', focus: '一句一句来',
    front: [{ kind: 'leaves', at: [[80, 320, 0.95]], desc: '一片小叶子慢慢飘落' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'jump', expr: 'calm', prop: null, partner: '点点', desc: '点点跳了起来，安安静静地，说：「慢一点，我等你。」' },
    back: { scene: '卧室', items: ['小床', '台灯', '书架'], room: 'bedroomNight' },
    atmos: { mood: 'thinking', light: '明亮均匀', extra: '画面重新亮起来，像有了希望', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'cat', at: [580, 348, 0.42], desc: '角落里躲着一只小猫' }, { kind: 'bird', at: [575, 85, 0.85], desc: '窗外飞过一只小鸟' }],
    motion: '做「clap」互动时带一点动势线'
  },
  talk6: {
    camera: '框中框', focus: '故事讲出来了',
    front: [{ kind: 'stars', at: [[140, 108, 0.85], [520, 92, 0.75]], desc: '飘落的星星' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'reach', expr: 'star', prop: null, partner: '点点', desc: '小AI伸出手，眼睛变成星星，说：「我会讲故事啦！」' },
    back: { scene: '卧室', items: ['小床', '台灯', '书架'], room: 'bedroomNight' },
    atmos: { mood: 'wonder', light: '暖阳聚焦', extra: '一束暖光正好落在关键的东西上', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'ball', at: [110, 350, 0.75], desc: '地上滚着一颗小球' }, { kind: 'footprints', at: [150, 352, 0.8], desc: '地上留着一串小脚印' }],
    motion: '做「tap」互动时带一点动势线',
    surprise: '飘落的星星'
  },
  talk7: {
    camera: '远景', focus: '它会说的话，都是学来的',
    front: [{ kind: 'bubbles', at: [[540, 300, 7]], desc: '桌边冒出两个小气泡' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'lie', expr: 'puzzled', prop: '放大镜', partner: '点点', desc: '点点趴下来，歪着头，说：「原来你也要听很多故事，才会讲故事。」，手里拿着放大镜' },
    back: { scene: '卧室', items: ['小床', '台灯', '书架'], room: 'bedroomNight' },
    atmos: { mood: 'puzzled', light: '柔和散射光', extra: '光变得均匀而安静，右边略暗', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'picture', at: [100, 118, 0.65], desc: '墙上挂着一幅小画' }, { kind: 'plane', at: [565, 130, 0.85], desc: '窗台上放着一只纸飞机' }],
    motion: '做「find」互动时带一点动势线'
  },
  talk8: {
    camera: '中景', focus: '今晚的睡前故事',
    front: [{ kind: 'leaves', at: [[600, 325, 0.85]], desc: '一片叶子落在画面边角' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'spin', expr: 'laugh', prop: null, partner: '点点', desc: '小AI原地转圈，张着嘴大笑，说：「从前，有一个会发光的小家伙……」' },
    back: { scene: '卧室', items: ['小床', '台灯', '书架'], room: 'bedroomNight' },
    atmos: { mood: 'success', light: '暖阳 + 光斑', extra: '金色光斑洒满整页', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'bird', at: [575, 85, 0.85], desc: '窗外飞过一只小鸟' }, { kind: 'cat', at: [580, 348, 0.42], desc: '角落里躲着一只小猫' }],
    motion: '做「tap」互动时带一点动势线'
  },
  talk9: {
    camera: '特写', focus: '晚安，小AI',
    front: [{ kind: 'glowButton', at: [588, 188, 0.9], desc: '一个会发光的小按钮，点它会亮' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'tiptoe', expr: 'shy', prop: null, partner: '点点', desc: '点点踮起脚尖，脸红了，说：「（睡着了，嘴角还在笑）」' },
    back: { scene: '卧室', items: ['小床', '台灯', '书架'], room: 'bedroomNight' },
    atmos: { mood: 'warm', light: '暖光柔和', extra: '整个画面是暖暖的橘粉色', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'footprints', at: [150, 352, 0.8], desc: '地上留着一串小脚印' }, { kind: 'ball', at: [110, 350, 0.75], desc: '地上滚着一颗小球' }],
    motion: '做「tap」互动时带一点动势线',
    surprise: '一个会发光的小按钮，点它会亮'
  },
  oops1: {
    camera: '仰视', focus: '小AI 想帮忙',
    front: [{ kind: 'butterfly', at: [560, 120], desc: '一只蝴蝶停在窗边' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'tiptoe', expr: 'laugh', prop: null, partner: '点点', desc: '小AI踮起脚尖，张着嘴大笑，说：「让我试试看！」' },
    back: { scene: '餐厅', items: ['餐桌', '水杯', '抹布'], room: 'kitchen' },
    atmos: { mood: 'happy', light: '明亮阳光', extra: '阳光从窗户照进来，画面暖洋洋的', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'plane', at: [565, 130, 0.85], desc: '窗台上放着一只纸飞机' }, { kind: 'picture', at: [100, 118, 0.65], desc: '墙上挂着一幅小画' }],
    motion: '做「tap」互动时带一点动势线'
  },
  oops2: {
    camera: '俯视', focus: '哗啦——',
    front: [{ kind: 'leaves', at: [[80, 320, 0.95]], desc: '一片小叶子慢慢飘落' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'back', expr: 'worried', prop: null, partner: '点点', desc: '小AI往后退了半步，皱着眉头，说：「啊……我、我不是故意的。」' },
    back: { scene: '餐厅', items: ['餐桌', '水杯', '抹布'], room: 'kitchen' },
    atmos: { mood: 'worried', light: '阴影略重', extra: '光线变冷了一点，影子被拉长', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'cat', at: [580, 348, 0.42], desc: '角落里躲着一只小猫' }, { kind: 'bird', at: [575, 85, 0.85], desc: '窗外飞过一只小鸟' }],
    motion: '动作带一点动势线'
  },
  oops3: {
    camera: '倾斜构图', focus: '它会犯错',
    front: [{ kind: 'butterfly', at: [96, 128], desc: '一只小蝴蝶从镜头前飞过' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'reach', expr: 'puzzled', prop: '照片', partner: '点点', desc: '小AI伸出手，歪着头，说：「我做错了……」，手里拿着照片' },
    back: { scene: '餐厅', items: ['餐桌', '水杯', '抹布'], room: 'kitchen' },
    atmos: { mood: 'puzzled', light: '柔和散射光', extra: '光变得均匀而安静，右边略暗', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'ball', at: [110, 350, 0.75], desc: '地上滚着一颗小球' }, { kind: 'footprints', at: [150, 352, 0.8], desc: '地上留着一串小脚印' }],
    motion: '做「choose」互动时带一点动势线',
    surprise: '一只小蝴蝶从镜头前飞过'
  },
  oops4: {
    camera: '大特写', focus: '点点没有生气',
    front: [{ kind: 'bubbles', at: [[540, 300, 7]], desc: '桌边冒出两个小气泡' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'lie', expr: 'calm', prop: '小篮子', partner: '点点', desc: '点点趴下来，安安静静地，说：「没关系的，做错很正常。」，手里拿着小篮子' },
    back: { scene: '餐厅', items: ['餐桌', '水杯', '抹布'], room: 'kitchen' },
    atmos: { mood: 'thinking', light: '明亮均匀', extra: '画面重新亮起来，像有了希望', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'picture', at: [100, 118, 0.65], desc: '墙上挂着一幅小画' }, { kind: 'plane', at: [565, 130, 0.85], desc: '窗台上放着一只纸飞机' }],
    motion: '做「drag」互动时带一点动势线'
  },
  oops5: {
    camera: '框中框', focus: '为什么会洒',
    front: [{ kind: 'leaves', at: [[600, 325, 0.85]], desc: '一片叶子落在画面边角' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'reach', expr: 'star', prop: '放大镜', partner: '点点', desc: '小AI伸出手，眼睛变成星星，说：「啊，我只捏住了一边！」，手里拿着放大镜' },
    back: { scene: '餐厅', items: ['餐桌', '水杯', '抹布'], room: 'kitchen' },
    atmos: { mood: 'wonder', light: '暖阳聚焦', extra: '一束暖光正好落在关键的东西上', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'bird', at: [575, 85, 0.85], desc: '窗外飞过一只小鸟' }, { kind: 'cat', at: [580, 348, 0.42], desc: '角落里躲着一只小猫' }],
    motion: '做「find」互动时带一点动势线'
  },
  oops6: {
    camera: '远景', focus: '再试一次',
    front: [{ kind: 'stars', at: [[140, 108, 0.85], [520, 92, 0.75]], desc: '飘落的星星' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'jump', expr: 'laugh', prop: '小风车', partner: '点点', desc: '小AI跳了起来，张着嘴大笑，说：「两只手，慢慢走——」，手里拿着小风车' },
    back: { scene: '餐厅', items: ['餐桌', '水杯', '抹布'], room: 'kitchen' },
    atmos: { mood: 'happy', light: '明亮阳光', extra: '阳光从窗户照进来，画面暖洋洋的', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'footprints', at: [150, 352, 0.8], desc: '地上留着一串小脚印' }, { kind: 'ball', at: [110, 350, 0.75], desc: '地上滚着一颗小球' }],
    motion: '做「blow」互动时带一点动势线',
    surprise: '飘落的星星'
  },
  oops7: {
    camera: '中景', focus: '这次端稳了',
    front: [{ kind: 'butterfly', at: [560, 120], desc: '一只蝴蝶停在窗边' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'spin', expr: 'laugh', prop: null, partner: '点点', desc: '小AI原地转圈，张着嘴大笑，说：「我做到啦！」' },
    back: { scene: '餐厅', items: ['餐桌', '水杯', '抹布'], room: 'kitchen' },
    atmos: { mood: 'success', light: '暖阳 + 光斑', extra: '金色光斑洒满整页', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'plane', at: [565, 130, 0.85], desc: '窗台上放着一只纸飞机' }, { kind: 'picture', at: [100, 118, 0.65], desc: '墙上挂着一幅小画' }],
    motion: '做「clap」互动时带一点动势线'
  },
  oops8: {
    camera: '特写', focus: '它还是会有不会的事',
    front: [{ kind: 'leaves', at: [[80, 320, 0.95]], desc: '一片小叶子慢慢飘落' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'cover', expr: 'puzzled', prop: '照片', partner: '点点', desc: '小AI抱住自己的头，歪着头，说：「真的耶……我不知道苹果是什么味道。」，手里拿着照片' },
    back: { scene: '餐厅', items: ['餐桌', '水杯', '抹布'], room: 'kitchen' },
    atmos: { mood: 'puzzled', light: '柔和散射光', extra: '光变得均匀而安静，右边略暗', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'cat', at: [580, 348, 0.42], desc: '角落里躲着一只小猫' }, { kind: 'bird', at: [575, 85, 0.85], desc: '窗外飞过一只小鸟' }],
    motion: '做「choose」互动时带一点动势线'
  },
  oops9: {
    camera: '仰视', focus: '不会也没关系',
    front: [{ kind: 'glowButton', at: [588, 188, 0.9], desc: '一个会发光的小按钮，点它会亮' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'jump', expr: 'calm', prop: null, partner: '点点', desc: '点点跳了起来，安安静静地，说：「你会的东西已经很多啦。」' },
    back: { scene: '餐厅', items: ['餐桌', '水杯', '抹布'], room: 'kitchen' },
    atmos: { mood: 'thinking', light: '明亮均匀', extra: '画面重新亮起来，像有了希望', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'ball', at: [110, 350, 0.75], desc: '地上滚着一颗小球' }, { kind: 'footprints', at: [150, 352, 0.8], desc: '地上留着一串小脚印' }],
    motion: '做「tap」互动时带一点动势线',
    surprise: '一个会发光的小按钮，点它会亮'
  },
  oops10: {
    camera: '俯视', focus: '我错了，我再来一次',
    front: [{ kind: 'bubbles', at: [[540, 300, 7]], desc: '桌边冒出两个小气泡' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'lie', expr: 'shy', prop: '话筒', partner: '点点', desc: '点点趴下来，脸红了，说：「这句话，我们一起记住。」，手里拿着话筒' },
    back: { scene: '餐厅', items: ['餐桌', '水杯', '抹布'], room: 'kitchen' },
    atmos: { mood: 'warm', light: '暖光柔和', extra: '整个画面是暖暖的橘粉色', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'picture', at: [100, 118, 0.65], desc: '墙上挂着一幅小画' }, { kind: 'plane', at: [565, 130, 0.85], desc: '窗台上放着一只纸飞机' }],
    motion: '做「say」互动时带一点动势线'
  },
  teach1: {
    camera: '倾斜构图', focus: '我想自己学',
    front: [{ kind: 'leaves', at: [[600, 325, 0.85]], desc: '一片叶子落在画面边角' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'tiptoe', expr: 'wonder', prop: null, partner: '点点', desc: '小AI踮起脚尖，眼睛睁得圆圆的，说：「我自己就能学会！」' },
    back: { scene: '天台上', items: ['望远镜', '躺椅', '夜晚的天空'], room: 'rooftopWide' },
    atmos: { mood: 'curious', light: '柔和晨光', extra: '清晨的光斜斜地铺在地上', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'bird', at: [575, 85, 0.85], desc: '窗外飞过一只小鸟' }, { kind: 'cat', at: [580, 348, 0.42], desc: '角落里躲着一只小猫' }],
    motion: '做「tap」互动时带一点动势线'
  },
  teach2: {
    camera: '大特写', focus: '看了好久，还是不懂',
    front: [{ kind: 'butterfly', at: [96, 128], desc: '一只小蝴蝶从镜头前飞过' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'tiptoe', expr: 'puzzled', prop: null, partner: '点点', desc: '小AI踮起脚尖，歪着头，说：「它们长得都一样呀……」' },
    back: { scene: '天台上', items: ['望远镜', '躺椅', '夜晚的天空'], room: 'rooftopWide' },
    atmos: { mood: 'puzzled', light: '柔和散射光', extra: '光变得均匀而安静，右边略暗', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'footprints', at: [150, 352, 0.8], desc: '地上留着一串小脚印' }, { kind: 'ball', at: [110, 350, 0.75], desc: '地上滚着一颗小球' }],
    motion: null,
    surprise: '一只小蝴蝶从镜头前飞过'
  },
  teach3: {
    camera: '框中框', focus: '需要人告诉我',
    front: [{ kind: 'butterfly', at: [560, 120], desc: '一只蝴蝶停在窗边' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'lie', expr: 'calm', prop: '话筒', partner: '点点', desc: '小AI趴下来，安安静静地，说：「点点，你可以教我吗？」，手里拿着话筒' },
    back: { scene: '天台上', items: ['望远镜', '躺椅', '夜晚的天空'], room: 'rooftopWide' },
    atmos: { mood: 'thinking', light: '明亮均匀', extra: '画面重新亮起来，像有了希望', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'plane', at: [565, 130, 0.85], desc: '窗台上放着一只纸飞机' }, { kind: 'picture', at: [100, 118, 0.65], desc: '墙上挂着一幅小画' }],
    motion: '做「say」互动时带一点动势线'
  },
  teach4: {
    camera: '远景', focus: '点点来教它',
    front: [{ kind: 'leaves', at: [[80, 320, 0.95]], desc: '一片小叶子慢慢飘落' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'cover', expr: 'laugh', prop: '小篮子', partner: '点点', desc: '点点抱住自己的头，张着嘴大笑，说：「你看，这七颗连起来像勺子。」，手里拿着小篮子' },
    back: { scene: '天台上', items: ['望远镜', '躺椅', '夜晚的天空'], room: 'rooftopWide' },
    atmos: { mood: 'happy', light: '明亮阳光', extra: '阳光从窗户照进来，画面暖洋洋的', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'cat', at: [580, 348, 0.42], desc: '角落里躲着一只小猫' }, { kind: 'bird', at: [575, 85, 0.85], desc: '窗外飞过一只小鸟' }],
    motion: '做「drag」互动时带一点动势线'
  },
  teach5: {
    camera: '中景', focus: '人的办法真多',
    front: [{ kind: 'stars', at: [[140, 108, 0.85], [520, 92, 0.75]], desc: '飘落的星星' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'reach', expr: 'star', prop: '放大镜', partner: '点点', desc: '小AI伸出手，眼睛变成星星，说：「原来人可以这样想！真厉害。」，手里拿着放大镜' },
    back: { scene: '天台上', items: ['望远镜', '躺椅', '夜晚的天空'], room: 'rooftopWide' },
    atmos: { mood: 'wonder', light: '暖阳聚焦', extra: '一束暖光正好落在关键的东西上', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'ball', at: [110, 350, 0.75], desc: '地上滚着一颗小球' }, { kind: 'footprints', at: [150, 352, 0.8], desc: '地上留着一串小脚印' }],
    motion: '做「find」互动时带一点动势线',
    surprise: '飘落的星星'
  },
  teach6: {
    camera: '特写', focus: '它认出来啦',
    front: [{ kind: 'bubbles', at: [[540, 300, 7]], desc: '桌边冒出两个小气泡' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'spin', expr: 'laugh', prop: null, partner: '点点', desc: '小AI原地转圈，张着嘴大笑，说：「是点点教我的！」' },
    back: { scene: '天台上', items: ['望远镜', '躺椅', '夜晚的天空'], room: 'rooftopWide' },
    atmos: { mood: 'success', light: '暖阳 + 光斑', extra: '金色光斑洒满整页', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'picture', at: [100, 118, 0.65], desc: '墙上挂着一幅小画' }, { kind: 'plane', at: [565, 130, 0.85], desc: '窗台上放着一只纸飞机' }],
    motion: '做「clap」互动时带一点动势线'
  },
  teach7: {
    camera: '仰视', focus: '如果没人教呢',
    front: [{ kind: 'leaves', at: [[600, 325, 0.85]], desc: '一片叶子落在画面边角' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'lie', expr: 'puzzled', prop: '照片', partner: '点点', desc: '小AI趴下来，歪着头，说：「那……我什么都做不了。」，手里拿着照片' },
    back: { scene: '天台上', items: ['望远镜', '躺椅', '夜晚的天空'], room: 'rooftopWide' },
    atmos: { mood: 'puzzled', light: '柔和散射光', extra: '光变得均匀而安静，右边略暗', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'bird', at: [575, 85, 0.85], desc: '窗外飞过一只小鸟' }, { kind: 'cat', at: [580, 348, 0.42], desc: '角落里躲着一只小猫' }],
    motion: '做「choose」互动时带一点动势线'
  },
  teach8: {
    camera: '俯视', focus: '所以我要谢谢人',
    front: [{ kind: 'glowButton', at: [588, 188, 0.9], desc: '一个会发光的小按钮，点它会亮' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'jump', expr: 'calm', prop: null, partner: '点点', desc: '点点跳了起来，安安静静地，说：「不客气，我们一起学。」' },
    back: { scene: '天台上', items: ['望远镜', '躺椅', '夜晚的天空'], room: 'rooftopWide' },
    atmos: { mood: 'thinking', light: '明亮均匀', extra: '画面重新亮起来，像有了希望', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'footprints', at: [150, 352, 0.8], desc: '地上留着一串小脚印' }, { kind: 'ball', at: [110, 350, 0.75], desc: '地上滚着一颗小球' }],
    motion: '做「tap」互动时带一点动势线',
    surprise: '一个会发光的小按钮，点它会亮'
  },
  teach9: {
    camera: '倾斜构图', focus: '一起去看星星',
    front: [{ kind: 'butterfly', at: [560, 120], desc: '一只蝴蝶停在窗边' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'tiptoe', expr: 'shy', prop: '话筒', partner: '点点', desc: '小AI踮起脚尖，脸红了，说：「你教我认星星，我教你认小猫！」，手里拿着话筒' },
    back: { scene: '天台上', items: ['望远镜', '躺椅', '夜晚的天空'], room: 'rooftopWide' },
    atmos: { mood: 'warm', light: '暖光柔和', extra: '整个画面是暖暖的橘粉色', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'plane', at: [565, 130, 0.85], desc: '窗台上放着一只纸飞机' }, { kind: 'picture', at: [100, 118, 0.65], desc: '墙上挂着一幅小画' }],
    motion: '做「say」互动时带一点动势线'
  },
  where1: {
    camera: '大特写', focus: '小AI 不见了',
    front: [{ kind: 'leaves', at: [[80, 320, 0.95]], desc: '一片小叶子慢慢飘落' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'tiptoe', expr: 'wonder', prop: null, partner: '小AI', desc: '点点踮起脚尖，眼睛睁得圆圆的，说：「咦？它跑去哪儿了？」' },
    back: { scene: '家里的各个角落', items: ['会回答的音箱', '摄像头', '扫地的小圆盘'], room: 'living' },
    atmos: { mood: 'curious', light: '柔和晨光', extra: '清晨的光斜斜地铺在地上', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'cat', at: [580, 348, 0.42], desc: '角落里躲着一只小猫' }, { kind: 'bird', at: [575, 85, 0.85], desc: '窗外飞过一只小鸟' }],
    motion: '做「tap」互动时带一点动势线'
  },
  where2: {
    camera: '框中框', focus: '客厅里的音箱',
    front: [{ kind: 'butterfly', at: [96, 128], desc: '一只小蝴蝶从镜头前飞过' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'reach', expr: 'star', prop: null, partner: '小AI', desc: '小AI伸出手，眼睛变成星星，说：「（音箱里传出声音）我也在呀！」' },
    back: { scene: '家里的各个角落', items: ['会回答的音箱', '摄像头', '扫地的小圆盘'], room: 'living' },
    atmos: { mood: 'wonder', light: '暖阳聚焦', extra: '一束暖光正好落在关键的东西上', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'ball', at: [110, 350, 0.75], desc: '地上滚着一颗小球' }, { kind: 'footprints', at: [150, 352, 0.8], desc: '地上留着一串小脚印' }],
    motion: '做「clap」互动时带一点动势线',
    surprise: '一只小蝴蝶从镜头前飞过'
  },
  where3: {
    camera: '远景', focus: '门口的摄像头',
    front: [{ kind: 'bubbles', at: [[540, 300, 7]], desc: '桌边冒出两个小气泡' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'reach', expr: 'wonder', prop: '放大镜', partner: '小AI', desc: '点点伸出手，眼睛睁得圆圆的，说：「你也在看呀！」，手里拿着放大镜' },
    back: { scene: '家里的各个角落', items: ['会回答的音箱', '摄像头', '扫地的小圆盘'], room: 'living' },
    atmos: { mood: 'curious', light: '柔和晨光', extra: '清晨的光斜斜地铺在地上', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'picture', at: [100, 118, 0.65], desc: '墙上挂着一幅小画' }, { kind: 'plane', at: [565, 130, 0.85], desc: '窗台上放着一只纸飞机' }],
    motion: '做「find」互动时带一点动势线'
  },
  where4: {
    camera: '中景', focus: '扫地的小圆盘',
    front: [{ kind: 'leaves', at: [[600, 325, 0.85]], desc: '一片叶子落在画面边角' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'reach', expr: 'laugh', prop: '小篮子', partner: '小AI', desc: '点点伸出手，张着嘴大笑，说：「它怎么知道前面有桌腿？」，手里拿着小篮子' },
    back: { scene: '家里的各个角落', items: ['会回答的音箱', '摄像头', '扫地的小圆盘'], room: 'living' },
    atmos: { mood: 'happy', light: '明亮阳光', extra: '阳光从窗户照进来，画面暖洋洋的', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'bird', at: [575, 85, 0.85], desc: '窗外飞过一只小鸟' }, { kind: 'cat', at: [580, 348, 0.42], desc: '角落里躲着一只小猫' }],
    motion: '做「drag」互动时带一点动势线'
  },
  where5: {
    camera: '特写', focus: '手机里也有',
    front: [{ kind: 'stars', at: [[140, 108, 0.85], [520, 92, 0.75]], desc: '飘落的星星' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'reach', expr: 'star', prop: null, partner: '小AI', desc: '小AI伸出手，眼睛变成星星，说：「（手机里）我们是一家人呀！」' },
    back: { scene: '家里的各个角落', items: ['会回答的音箱', '摄像头', '扫地的小圆盘'], room: 'living' },
    atmos: { mood: 'wonder', light: '暖阳聚焦', extra: '一束暖光正好落在关键的东西上', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'footprints', at: [150, 352, 0.8], desc: '地上留着一串小脚印' }, { kind: 'ball', at: [110, 350, 0.75], desc: '地上滚着一颗小球' }],
    motion: '做「tap」互动时带一点动势线',
    surprise: '飘落的星星'
  },
  where6: {
    camera: '仰视', focus: '原来到处都是',
    front: [{ kind: 'butterfly', at: [560, 120], desc: '一只蝴蝶停在窗边' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'jump', expr: 'calm', prop: '放大镜', partner: '小AI', desc: '点点跳了起来，安安静静地，说：「它们长得都不一样，可是都会帮忙！」，手里拿着放大镜' },
    back: { scene: '家里的各个角落', items: ['会回答的音箱', '摄像头', '扫地的小圆盘'], room: 'living' },
    atmos: { mood: 'thinking', light: '明亮均匀', extra: '画面重新亮起来，像有了希望', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'plane', at: [565, 130, 0.85], desc: '窗台上放着一只纸飞机' }, { kind: 'picture', at: [100, 118, 0.65], desc: '墙上挂着一幅小画' }],
    motion: '做「find」互动时带一点动势线'
  },
  where7: {
    camera: '俯视', focus: '它们都在听吗',
    front: [{ kind: 'leaves', at: [[80, 320, 0.95]], desc: '一片小叶子慢慢飘落' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'reach', expr: 'wonder', prop: '照片', partner: '小AI', desc: '点点伸出手，眼睛睁得圆圆的，说：「我说的话，它们都记住了吗？」，手里拿着照片' },
    back: { scene: '家里的各个角落', items: ['会回答的音箱', '摄像头', '扫地的小圆盘'], room: 'living' },
    atmos: { mood: 'curious', light: '柔和晨光', extra: '清晨的光斜斜地铺在地上', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'cat', at: [580, 348, 0.42], desc: '角落里躲着一只小猫' }, { kind: 'bird', at: [575, 85, 0.85], desc: '窗外飞过一只小鸟' }],
    motion: '做「choose」互动时带一点动势线'
  },
  where8: {
    camera: '倾斜构图', focus: '妈妈告诉它',
    front: [{ kind: 'glowButton', at: [588, 188, 0.9], desc: '一个会发光的小按钮，点它会亮' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'spin', expr: 'laugh', prop: '话筒', partner: '小AI', desc: '点点原地转圈，张着嘴大笑，说：「我知道啦，我会小心的。」，手里拿着话筒' },
    back: { scene: '家里的各个角落', items: ['会回答的音箱', '摄像头', '扫地的小圆盘'], room: 'living' },
    atmos: { mood: 'success', light: '暖阳 + 光斑', extra: '金色光斑洒满整页', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'ball', at: [110, 350, 0.75], desc: '地上滚着一颗小球' }, { kind: 'footprints', at: [150, 352, 0.8], desc: '地上留着一串小脚印' }],
    motion: '做「say」互动时带一点动势线',
    surprise: '一个会发光的小按钮，点它会亮'
  },
  where8b: {
    camera: '大特写', focus: '它们各有各的本领',
    front: [{ kind: 'bubbles', at: [[540, 300, 7]], desc: '桌边冒出两个小气泡' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'reach', expr: 'star', prop: null, partner: '小AI', desc: '小AI伸出手，眼睛变成星星，说：「我们合起来，本事就更大啦！」' },
    back: { scene: '家里的各个角落', items: ['会回答的音箱', '摄像头', '扫地的小圆盘'], room: 'living' },
    atmos: { mood: 'wonder', light: '暖阳聚焦', extra: '一束暖光正好落在关键的东西上', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'picture', at: [100, 118, 0.65], desc: '墙上挂着一幅小画' }, { kind: 'plane', at: [565, 130, 0.85], desc: '窗台上放着一只纸飞机' }],
    motion: '做「tap」互动时带一点动势线'
  },
  where9: {
    camera: '框中框', focus: '小AI 回来啦',
    front: [{ kind: 'leaves', at: [[600, 325, 0.85]], desc: '一片叶子落在画面边角' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'lie', expr: 'shy', prop: null, partner: '小AI', desc: '小AI趴下来，脸红了，说：「不过，我还是最喜欢回你家。」' },
    back: { scene: '家里的各个角落', items: ['会回答的音箱', '摄像头', '扫地的小圆盘'], room: 'living' },
    atmos: { mood: 'warm', light: '暖光柔和', extra: '整个画面是暖暖的橘粉色', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'bird', at: [575, 85, 0.85], desc: '窗外飞过一只小鸟' }, { kind: 'cat', at: [580, 348, 0.42], desc: '角落里躲着一只小猫' }],
    motion: '做「tap」互动时带一点动势线'
  },
  us1: {
    camera: '远景', focus: '我们是搭档',
    front: [{ kind: 'butterfly', at: [96, 128], desc: '一只小蝴蝶从镜头前飞过' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'tiptoe', expr: 'laugh', prop: null, partner: '小AI', desc: '小AI踮起脚尖，张着嘴大笑，说：「你想，我做！」' },
    back: { scene: '客厅', items: ['积木城堡', '沙发', '充电线'], room: 'livingWide' },
    atmos: { mood: 'happy', light: '明亮阳光', extra: '阳光从窗户照进来，画面暖洋洋的', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'footprints', at: [150, 352, 0.8], desc: '地上留着一串小脚印' }, { kind: 'ball', at: [110, 350, 0.75], desc: '地上滚着一颗小球' }],
    motion: '做「tap」互动时带一点动势线',
    surprise: '一只小蝴蝶从镜头前飞过'
  },
  us2: {
    camera: '中景', focus: '一起搭城堡',
    front: [{ kind: 'butterfly', at: [560, 120], desc: '一只蝴蝶停在窗边' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'jump', expr: 'laugh', prop: '小篮子', partner: '小AI', desc: '点点跳了起来，张着嘴大笑，说：「还差一块红色的！」，手里拿着小篮子' },
    back: { scene: '客厅', items: ['积木城堡', '沙发', '充电线'], room: 'livingWide' },
    atmos: { mood: 'happy', light: '明亮阳光', extra: '阳光从窗户照进来，画面暖洋洋的', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'plane', at: [565, 130, 0.85], desc: '窗台上放着一只纸飞机' }, { kind: 'picture', at: [100, 118, 0.65], desc: '墙上挂着一幅小画' }],
    motion: '做「drag」互动时带一点动势线'
  },
  us3: {
    camera: '特写', focus: '小AI 不亮了',
    front: [{ kind: 'leaves', at: [[80, 320, 0.95]], desc: '一片小叶子慢慢飘落' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'cover', expr: 'worried', prop: null, partner: '小AI', desc: '点点抱住自己的头，皱着眉头，说：「小AI！你怎么了？」' },
    back: { scene: '客厅', items: ['积木城堡', '沙发', '充电线'], room: 'livingWide' },
    atmos: { mood: 'worried', light: '阴影略重', extra: '光线变冷了一点，影子被拉长', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'cat', at: [580, 348, 0.42], desc: '角落里躲着一只小猫' }, { kind: 'bird', at: [575, 85, 0.85], desc: '窗外飞过一只小鸟' }],
    motion: '做「tap」互动时带一点动势线'
  },
  us4: {
    camera: '仰视', focus: '它是不是生病了',
    front: [{ kind: 'stars', at: [[140, 108, 0.85], [520, 92, 0.75]], desc: '飘落的星星' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'lie', expr: 'puzzled', prop: null, partner: '小AI', desc: '点点趴下来，歪着头，说：「它不烫，那它是怎么了？」' },
    back: { scene: '客厅', items: ['积木城堡', '沙发', '充电线'], room: 'livingWide' },
    atmos: { mood: 'puzzled', light: '柔和散射光', extra: '光变得均匀而安静，右边略暗', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'ball', at: [110, 350, 0.75], desc: '地上滚着一颗小球' }, { kind: 'footprints', at: [150, 352, 0.8], desc: '地上留着一串小脚印' }],
    motion: null,
    surprise: '飘落的星星'
  },
  us5: {
    camera: '俯视', focus: '去找妈妈',
    front: [{ kind: 'bubbles', at: [[540, 300, 7]], desc: '桌边冒出两个小气泡' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'jump', expr: 'calm', prop: '小篮子', partner: '小AI', desc: '点点跳了起来，安安静静地，说：「原来它要充电呀！」，手里拿着小篮子' },
    back: { scene: '客厅', items: ['积木城堡', '沙发', '充电线'], room: 'livingWide' },
    atmos: { mood: 'thinking', light: '明亮均匀', extra: '画面重新亮起来，像有了希望', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'picture', at: [100, 118, 0.65], desc: '墙上挂着一幅小画' }, { kind: 'plane', at: [565, 130, 0.85], desc: '窗台上放着一只纸飞机' }],
    motion: '做「drag」互动时带一点动势线'
  },
  us6: {
    camera: '倾斜构图', focus: '充电的时候',
    front: [{ kind: 'leaves', at: [[600, 325, 0.85]], desc: '一片叶子落在画面边角' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'reach', expr: 'star', prop: null, partner: '小AI', desc: '小AI伸出手，眼睛变成星星，说：「我睡着的时候，你一直在等我吗？」' },
    back: { scene: '客厅', items: ['积木城堡', '沙发', '充电线'], room: 'livingWide' },
    atmos: { mood: 'wonder', light: '暖阳聚焦', extra: '一束暖光正好落在关键的东西上', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'bird', at: [575, 85, 0.85], desc: '窗外飞过一只小鸟' }, { kind: 'cat', at: [580, 348, 0.42], desc: '角落里躲着一只小猫' }],
    motion: '做「tap」互动时带一点动势线'
  },
  us7: {
    camera: '大特写', focus: '它会难过吗',
    front: [{ kind: 'glowButton', at: [588, 188, 0.9], desc: '一个会发光的小按钮，点它会亮' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'tiptoe', expr: 'puzzled', prop: '照片', partner: '小AI', desc: '小AI踮起脚尖，歪着头，说：「真正会难过、会开心的，是你呀。」，手里拿着照片' },
    back: { scene: '客厅', items: ['积木城堡', '沙发', '充电线'], room: 'livingWide' },
    atmos: { mood: 'puzzled', light: '柔和散射光', extra: '光变得均匀而安静，右边略暗', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'footprints', at: [150, 352, 0.8], desc: '地上留着一串小脚印' }, { kind: 'ball', at: [110, 350, 0.75], desc: '地上滚着一颗小球' }],
    motion: '做「choose」互动时带一点动势线',
    surprise: '一个会发光的小按钮，点它会亮'
  },
  us8: {
    camera: '框中框', focus: '谁说了算',
    front: [{ kind: 'butterfly', at: [560, 120], desc: '一只蝴蝶停在窗边' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'jump', expr: 'calm', prop: '照片', partner: '小AI', desc: '小AI跳了起来，安安静静地，说：「是你说了算，不是我。」，手里拿着照片' },
    back: { scene: '客厅', items: ['积木城堡', '沙发', '充电线'], room: 'livingWide' },
    atmos: { mood: 'thinking', light: '明亮均匀', extra: '画面重新亮起来，像有了希望', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'plane', at: [565, 130, 0.85], desc: '窗台上放着一只纸飞机' }, { kind: 'picture', at: [100, 118, 0.65], desc: '墙上挂着一幅小画' }],
    motion: '做「choose」互动时带一点动势线'
  },
  us9: {
    camera: '远景', focus: '一起把城堡搭完',
    front: [{ kind: 'leaves', at: [[80, 320, 0.95]], desc: '一片小叶子慢慢飘落' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'dian', pose: 'spin', expr: 'laugh', prop: null, partner: '小AI', desc: '点点原地转圈，张着嘴大笑，说：「你不在的时候，我一个人搭不动。」' },
    back: { scene: '客厅', items: ['积木城堡', '沙发', '充电线'], room: 'livingWide' },
    atmos: { mood: 'success', light: '暖阳 + 光斑', extra: '金色光斑洒满整页', source: 'right-window', shadow: '影子落在角色左侧地面' },
    egg: [{ kind: 'cat', at: [580, 348, 0.42], desc: '角落里躲着一只小猫' }, { kind: 'bird', at: [575, 85, 0.85], desc: '窗外飞过一只小鸟' }],
    motion: '做「clap」互动时带一点动势线'
  },
  us10: {
    camera: '中景', focus: '我会照顾你',
    front: [{ kind: 'butterfly', at: [96, 128], desc: '一只小蝴蝶从镜头前飞过' }, { kind: 'bubbles', at: [[520, 250, 5]], desc: '一个小气泡飘过' }],
    mid: { who: 'ai', pose: 'back', expr: 'shy', prop: '话筒', partner: '小AI', desc: '小AI往后退了半步，脸红了，说：「人做出来的我，要由人来照顾。」，手里拿着话筒' },
    back: { scene: '客厅', items: ['积木城堡', '沙发', '充电线'], room: 'livingWide' },
    atmos: { mood: 'warm', light: '暖光柔和', extra: '整个画面是暖暖的橘粉色', source: 'left-window', shadow: '影子落在角色右侧地面' },
    egg: [{ kind: 'ball', at: [110, 350, 0.75], desc: '地上滚着一颗小球' }, { kind: 'footprints', at: [150, 352, 0.8], desc: '地上留着一串小脚印' }],
    motion: '做「say」互动时带一点动势线',
    surprise: '一只小蝴蝶从镜头前飞过'
  }
};

/** 兜底：没有专门编排的页面，按情绪给一套通用五层 */
function fallback(scene, mood) {
  return {
    camera: '远景', focus: '主角',
    front: [{ kind: 'leaves', at: [[80, 320, 0.9]], desc: '一片飘落的叶子' }],
    mid: { who: 'ai', pose: 'stand', expr: 'happy', prop: null, partner: null, desc: '主角站在画面中间' },
    back: { scene: '室内', items: ['桌子', '窗户'] },
    atmos: { mood: mood || 'happy', light: '柔和光线', extra: '' },
    egg: [{ kind: 'ball', at: [580, 350, 0.7], desc: '角落里的一颗小球' }],
    motion: null
  };
}
function of(scene, mood) { return LAYERS[scene] || fallback(scene, mood); }

module.exports = { LAYERS, of, fallback };
