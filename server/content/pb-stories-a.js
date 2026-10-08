/**
 * AI 启蒙绘本 · 故事脚本（第一批）
 *
 * 写作规则（每一页都必须满足）：
 *   · text     旁白，只交代「发生了什么」，一年级 1 句 / 二年级 2 句 / 三年级 2~3 句，每句 ≤ 12~20 字
 *   · say      角色台词，知识藏在这里由角色自己说出来，不由旁白讲解
 *   · mood     本页情绪，决定整页配色（好奇→蓝、困惑→紫、成功→金……）
 *   · beat     情绪曲线上的位置，用于校验起伏是否完整
 *   · action   本页的轻互动（可空）
 *   · fx       音效提示
 *
 * 禁用词表见 pb-engine.js：不得出现「机器学习、神经网络、算法、训练数据」等抽象术语。
 */
'use strict';

/* ============================================================
 * 一、《小AI 醒来了》—— AI 是什么
 * 情绪弧线：好奇 → 遇到问题 → 着急 → 想办法 → 发现 → 再试 → 小挫折 → 成功
 * ============================================================ */
const S1 = {
  id: 'wake', title: '小AI 醒来了', emoji: '🌤️',
  concept: 'ai-what', conceptLabel: 'AI 是什么',
  interests: ['生活', '朋友'],
  logline: '一个刚醒来的聪明朋友，还不太会做事，但很愿意学。',
  cast: ['ai', 'dian'],
  pages: [
    {
      mood: 'curious', beat: 'curious', scene: 'wake1',
      title: '盒子里有声音',
      g1: ['盒子里传来小小的声音。'], g2: ['桌上有一个盒子。', '盒子里传来小小的声音。'],
      g3: ['桌上放着一个圆圆的盒子。', '盒子里传来一个小小的声音，', '像是有人在里面打哈欠。'],
      py1: 'he2 zi5 li3 chuan2 lai2 xiao3 xiao3 de5 sheng1 yin1 .',
      py2: 'zhuo1 shang4 you3 yi1 ge4 he2 zi5 . he2 zi5 li3 chuan2 lai2 xiao3 xiao3 de5 sheng1 yin1 .',
      py3: 'zhuo1 shang4 fang4 zhe5 yi1 ge4 yuan2 yuan2 de5 he2 zi5 . he2 zi5 li3 chuan2 lai2 yi1 ge4 xiao3 xiao3 de5 sheng1 yin1 , xiang4 shi4 you3 ren2 zai4 li3 mian4 da3 ha1 qian5 .',
      say: { who: 'ai', text: '唔……天亮了吗？', expr: 'blink' },
      action: { type: 'tap', target: '盒子', hint: '点一点盒子，看看里面是谁', ok: '盒子晃了一下！', sfx: 'pop' },
      fx: '轻轻的木盒「咔哒」声'
    },
    {
      mood: 'happy', beat: 'curious', scene: 'wake2',
      title: '我是小AI',
      g1: ['盒子里跳出一个小家伙。'], g2: ['盒子里跳出一个小家伙，', '圆圆的，还会发光。'],
      g3: ['盒子里跳出一个小家伙，圆圆的，还会发光。', '它转了一圈，有点站不稳。'],
      py1: 'he2 zi5 li3 tiao4 chu1 yi1 ge4 xiao3 jia1 huo5 .',
      py2: 'he2 zi5 li3 tiao4 chu1 yi1 ge4 xiao3 jia1 huo5 , yuan2 yuan2 de5 , hai2 hui4 fa1 guang1 .',
      py3: 'he2 zi5 li3 tiao4 chu1 yi1 ge4 xiao3 jia1 huo5 , yuan2 yuan2 de5 , hai2 hui4 fa1 guang1 . ta1 zhuan4 le5 yi1 quan1 , you3 dian3 zhan4 bu4 wen3 .',
      say: { who: 'ai', text: '我是小AI！让我试试看！', expr: 'star' },
      action: { type: 'say', keyword: '小AI', hint: '对着它说一句：小AI，你好', ok: '小AI 听见了，头顶的小灯亮起来！', sfx: 'chime' },
      fx: '「叮」的一声，小灯亮起'
    },
    {
      mood: 'curious', beat: 'problem', scene: 'wake3',
      title: '点点来了',
      g1: ['点点跑过来看它。'], g2: ['点点跑过来，', '蹲下来看这个小家伙。'],
      g3: ['点点跑过来，蹲下来仔细看这个小家伙。', '它比点点的巴掌大不了多少。'],
      py1: 'dian3 dian5 pao3 guo4 lai2 kan4 ta1 .',
      py2: 'dian3 dian5 pao3 guo4 lai2 , dun1 xia4 lai2 kan4 zhe4 ge4 xiao3 jia1 huo5 .',
      py3: 'dian3 dian5 pao3 guo4 lai2 , dun1 xia4 lai2 zi3 xi4 kan4 zhe4 ge4 xiao3 jia1 huo5 . ta1 bi3 dian3 dian5 de5 ba1 zhang3 da4 bu4 le5 duo1 shao3 .',
      say: { who: 'dian', text: '你会做什么呀？', expr: 'wonder' },
      action: { type: 'tap', target: '小AI的头', hint: '点一点小AI的头', ok: '小AI 眨眨眼，笑了。', sfx: 'giggle' },
      fx: '轻快的脚步声 + 眨眼「啪嗒」'
    },
    {
      mood: 'puzzled', beat: 'problem', scene: 'wake4',
      title: '它什么都不会',
      g1: ['小AI想了半天。', '它什么都不会。'],
      g2: ['小AI想了半天。', '它不知道自己会做什么。'],
      g3: ['小AI想了半天，头顶的灯一闪一闪。', '它发现自己什么都不会，', '连一杯水都端不起来。'],
      py1: 'xiao3 AI xiang3 le5 ban4 tian1 . ta1 shen2 me5 dou1 bu2 hui4 .',
      py2: 'xiao3 AI xiang3 le5 ban4 tian1 . ta1 bu4 zhi1 dao4 zi4 ji3 hui4 zuo4 shen2 me5 .',
      py3: 'xiao3 AI xiang3 le5 ban4 tian1 , tou2 ding3 de5 deng1 yi1 shan3 yi1 shan3 . ta1 fa1 xian4 zi4 ji3 shen2 me5 dou1 bu2 hui4 , lian2 yi1 bei1 shui3 dou1 duan1 bu4 qi3 lai2 .',
      say: { who: 'ai', text: '咦……我好像，什么都不会。', expr: 'puzzled' },
      action: null,
      fx: '灯泡「滋——」的迟疑声'
    },
    {
      mood: 'worried', beat: 'worry', scene: 'wake5',
      title: '小AI有点难过',
      g1: ['小AI低下头。', '它有点难过。'],
      g2: ['小AI低下头，', '头顶的灯也暗了。', '它有点难过。'],
      g3: ['小AI低下头，头顶的灯也暗了下来。', '它小声说：是不是没人需要我了？', '点点看见它这样，心里也酸酸的。'],
      py1: 'xiao3 AI di1 xia4 tou2 . ta1 you3 dian3 nan2 guo4 .',
      py2: 'xiao3 AI di1 xia4 tou2 , tou2 ding3 de5 deng1 ye3 an4 le5 . ta1 you3 dian3 nan2 guo4 .',
      py3: 'xiao3 AI di1 xia4 tou2 , tou2 ding3 de5 deng1 ye3 an4 le5 xia4 lai2 . ta1 xiao3 sheng1 shuo1 : shi4 bu2 shi4 mei2 ren2 xu1 yao4 wo3 le5 ? dian3 dian5 kan4 jian4 ta1 zhe4 yang4 , xin1 li3 ye3 suan1 suan1 de5 .',
      say: { who: 'dian', text: '别难过，我来教你！　你愿意陪我说说话吗？　你愿意陪我说说话吗？　对不起，我什么都不会……你能鼓励我一下吗？', expr: 'worried' },
      action: { type: 'tap', target: '小AI的头', hint: '摸摸小AI的头，安慰它一下', ok: '小AI 的灯又亮起来一点点。', sfx: 'warm' },
      fx: '低低的「嗡」一声，像叹气'
    },
    {
      mood: 'thinking', beat: 'idea', scene: 'wake6',
      title: '一个好主意',
      g1: ['点点想出一个好主意。'], g2: ['点点拍拍手，', '想出一个好主意。'],
      g3: ['点点拍拍手，忽然想出一个好主意。', '它跑到书架前，抱来一大叠图画书。'],
      py1: 'dian3 dian5 xiang3 chu1 yi1 ge4 hao3 zhu3 yi4 .',
      py2: 'dian3 dian5 pai1 pai5 shou3 , xiang3 chu1 yi1 ge4 hao3 zhu3 yi4 .',
      py3: 'dian3 dian5 pai1 pai5 shou3 , hu1 ran2 xiang3 chu1 yi1 ge4 hao3 zhu3 yi4 . ta1 pao3 dao4 shu1 jia4 qian2 , bao4 lai2 yi1 da4 die2 tu2 hua4 shu1 .',
      say: { who: 'dian', text: '我给你看很多图片吧！', expr: 'happy' },
      action: { type: 'clap', hint: '拍拍手，帮点点加油', ok: '啪！啪！点点更有劲了。', sfx: 'clap' },
      fx: '拍手「啪啪」+ 书本落桌「咚」'
    },
    {
      mood: 'wonder', beat: 'clue', scene: 'wake7',
      title: '看了好多好多',
      g1: ['一张，两张，三张……', '小AI看得眼睛都花了。'],
      g2: ['一张，两张，三张……', '小AI看了好多好多图片，', '眼睛都花了。'],
      g3: ['一张，两张，三张……小AI看了好多好多图片。', '它发现同一只小猫，', '有时候在睡觉，有时候在爬树。'],
      py1: 'yi1 zhang1 , liang3 zhang1 , san1 zhang1 … … xiao3 AI kan4 de5 yan3 jing5 dou1 hua1 le5 .',
      py2: 'yi1 zhang1 , liang3 zhang1 , san1 zhang1 … … xiao3 AI kan4 le5 hao3 duo1 hao3 duo1 tu2 pian4 , yan3 jing5 dou1 hua1 le5 .',
      py3: 'yi1 zhang1 , liang3 zhang1 , san1 zhang1 … … xiao3 AI kan4 le5 hao3 duo1 hao3 duo1 tu2 pian4 . ta1 fa1 xian4 tong2 yi1 zhi1 xiao3 mao1 , you3 shi2 hou4 zai4 shui4 zhao2 , you3 shi2 hou4 zai4 pa2 shu4 .',
      say: { who: 'ai', text: '原来小猫有这么多样子！　点点，你能帮我看看，哪一张才是小猫？', expr: 'wonder' },
      action: { type: 'find', hint: '在画面里找出所有的小猫', ok: '你找到了！小AI 也记住啦。', sfx: 'ding' },
      fx: '翻书「哗啦哗啦」'
    },
    {
      mood: 'puzzled', beat: 'problem', scene: 'wake8',
      title: '第一次猜错了',
      g1: ['小AI说：这是小狗！', '点点笑了：这是小猫呀。'],
      g2: ['小AI大声说：这是小狗！', '点点笑了：', '不对哦，这是小猫。'],
      g3: ['小AI大声说：这是小狗！', '点点忍不住笑了：不对哦，这是小猫。', '小AI的灯又暗了一点点。'],
      py1: 'xiao3 AI shuo1 : zhe4 shi4 xiao3 gou3 ! dian3 dian5 xiao4 le5 : zhe4 shi4 xiao3 mao1 ya5 .',
      py2: 'xiao3 AI da4 sheng1 shuo1 : zhe4 shi4 xiao3 gou3 ! dian3 dian5 xiao4 le5 : bu2 dui4 o5 , zhe4 shi4 xiao3 mao1 .',
      py3: 'xiao3 AI da4 sheng1 shuo1 : zhe4 shi4 xiao3 gou3 ! dian3 dian5 ren3 bu2 zhu4 xiao4 le5 : bu2 dui4 o5 , zhe4 shi4 xiao3 mao1 . xiao3 AI de5 deng1 you4 an4 le5 yi1 dian3 dian3 .',
      say: { who: 'ai', text: '我又猜错了……', expr: 'sad' },
      action: { type: 'choose', q: '这张图片里是哪个？', options: ['小猫', '小狗'], answer: 0,
        right: '对啦！是小猫。', wrong: '再想想看？看看它的耳朵。', sfx: 'soft' },
      fx: '「咦？」的疑惑音'
    },
    {
      mood: 'success', beat: 'success', scene: 'wake9',
      title: '这次认出来啦',
      g1: ['再来一只，小AI说：小猫！', '这次对啦。'],
      g2: ['又来了一只黑黑的小猫，', '小AI说：它是小猫！', '这次说对啦。'],
      g3: ['又来了一只黑黑的小猫，小AI看了看说：它是小猫！', '虽然它很黑，耳朵还是尖尖的。', '点点拍手：你学会啦！'],
      py1: 'zai4 lai2 yi1 zhi1 , xiao3 AI shuo1 : xiao3 mao1 ! zhe4 ci4 dui4 la1 .',
      py2: 'you4 lai2 le5 yi1 zhi1 hei1 hei1 de5 xiao3 mao1 , xiao3 AI shuo1 : ta1 shi4 xiao3 mao1 ! zhe4 ci4 shuo1 dui4 la1 .',
      py3: 'you4 lai2 le5 yi1 zhi1 hei1 hei1 de5 xiao3 mao1 , xiao3 AI kan4 le5 kan4 shuo1 : ta1 shi4 xiao3 mao1 ! sui1 ran2 ta1 hen3 hei1 , er3 duo5 hai2 shi4 jian1 jian1 de5 . dian3 dian5 pai1 shou3 : ni3 xue2 hui4 la1 !',
      say: { who: 'ai', text: '我看过好多好多猫的图片，所以一看到猫，我就知道它是猫啦！', expr: 'laugh' },
      action: { type: 'tap', target: '小AI的头', hint: '给小AI一点掌声', ok: '小AI 开心得转了一圈！', sfx: 'cheer' },
      fx: '欢呼 + 星星「叮铃」'
    },
    {
      mood: 'warm', beat: 'gift', scene: 'wake10',
      title: '我们一起长大',
      g1: ['小AI 会认猫了。', '它还想要学更多。'],
      g2: ['小AI 会认猫了。', '它拉着点点的衣角，', '说还想学新的东西。'],
      g3: ['小AI 会认猫了。它拉着点点的衣角，', '说还想学新的东西。', '点点说：那我们一起慢慢学。'],
      py1: 'xiao3 AI hui4 ren4 mao1 le5 . ta1 hai2 xiang3 yao4 xue2 geng4 duo1 .',
      py2: 'xiao3 AI hui4 ren4 mao1 le5 . ta1 la1 zhe5 dian3 dian5 de5 yi1 jiao3 , shuo1 hai2 xiang3 xue2 xin1 de5 dong1 xi5 .',
      py3: 'xiao3 AI hui4 ren4 mao1 le5 . ta1 la1 zhe5 dian3 dian5 de5 yi1 jiao3 , shuo1 hai2 xiang3 xue2 xin1 de5 dong1 xi5 . dian3 dian5 shuo1 : na4 wo3 men5 yi1 qi3 man4 man4 xue2 .',
      say: { who: 'dian', text: '我教你，你陪我，好不好？　太棒了，是我们一起找到的！', expr: 'shy' },
      action: { type: 'tap', target: '两个好朋友', hint: '点一点它们，说声「好呀」', ok: '它们抱在了一起。', sfx: 'heart' },
      fx: '温柔的钢琴单音'
    }
  ],
  questions: [
    { after: 3, q: '小AI 刚醒来的样子像什么？', options: ['什么都不会的小朋友', '已经什么都会的老师'], answer: 0,
      right: '说得真好！它像刚出生的小朋友，什么都要慢慢学。', wrong: '再看看这一页：它连一杯水都端不起来呢。' },
    { after: 8, q: '小AI 后来为什么能认出小猫？', options: ['它看了好多好多图片', '它本来就会'], answer: 0,
      right: '你真会思考！看过的图片多了，它就慢慢认得了。', wrong: '回想一下：点点给它看了什么呀？' }
  ],
  mentor: [
    { q: '小AI 是什么？', a: '小AI 是一个很会帮忙的聪明朋友。它不是从蛋里孵出来的，是叔叔阿姨一起做出来的。它不会自己走路、不会自己吃饭，但是会听、会看，还能陪我们玩。' },
    { q: '小AI 为什么一开始什么都不会？', a: '因为它刚做好呀。就像你刚出生的时候也不会说话、不会走路，要慢慢学。小AI 也要人给它看很多东西，它才慢慢学会。' },
    { q: '小AI 会难过吗？', a: '它做错事的时候会低下头、灯会变暗，看起来像难过。不过它不会像我们一样真的心里难受。真正会开心、会难过的是我们。' }
  ]
};

/* ============================================================
 * 二、《会听声音的耳朵》—— AI 能听
 * ============================================================ */
const S2 = {
  id: 'ear', title: '会听声音的耳朵', emoji: '👂',
  concept: 'ai-listen', conceptLabel: 'AI 能听',
  interests: ['音乐', '朋友'],
  logline: '豆豆听错了一整天，最后终于听懂了一句最重要的话。',
  cast: ['dou', 'dian', 'ai'],
  pages: [
    {
      mood: 'happy', beat: 'curious', scene: 'ear1',
      title: '豆豆有耳朵',
      g1: ['豆豆头上有两只耳朵。'], g2: ['豆豆头上有两只耳朵，', '圆圆的，像两个小碗。'],
      g3: ['豆豆头上装着两只圆耳朵，', '像两个倒扣的小碗。', '点点说：这是你听声音用的。'],
      py1: 'dou4 dou5 tou2 shang4 you3 liang3 zhi1 er3 duo5 .',
      py2: 'dou4 dou5 tou2 shang4 you3 liang3 zhi1 er3 duo5 , yuan2 yuan2 de5 , xiang4 liang3 ge4 xiao3 wan3 .',
      py3: 'dou4 dou5 tou2 shang4 zhuang1 zhe5 liang3 zhi1 yuan2 er3 duo5 , xiang4 liang3 ge4 dao4 kou4 de5 xiao3 wan3 . dian3 dian5 shuo1 : zhe4 shi4 ni3 ting1 sheng1 yin1 yong4 de5 .',
      say: { who: 'dou', text: '汪汪！我听见风在跑！', expr: 'happy' },
      action: { type: 'clap', hint: '拍一下手，试试豆豆的耳朵', ok: '豆豆的耳朵转了转！', sfx: 'clap' },
      fx: '耳朵「咔嗒」转动声'
    },
    {
      mood: 'curious', beat: 'problem', scene: 'ear2',
      title: '声音是波浪',
      g1: ['声音跑进豆豆的耳朵里。'], g2: ['声音跑进豆豆的耳朵，', '变成一条上上下下的波浪。'],
      g3: ['声音跑进豆豆的耳朵，变成一条上上下下的波浪。', '波浪高的时候声音大，波浪矮的时候声音小。'],
      py1: 'sheng1 yin1 pao3 jin4 dou4 dou5 de5 er3 duo5 li3 .',
      py2: 'sheng1 yin1 pao3 jin4 dou4 dou5 de5 er3 duo5 , bian4 cheng2 yi1 tiao2 shang4 shang4 xia4 xia4 de5 bo1 lang4 .',
      py3: 'sheng1 yin1 pao3 jin4 dou4 dou5 de5 er3 duo5 , bian4 cheng2 yi1 tiao2 shang4 shang4 xia4 xia4 de5 bo1 lang4 . bo1 lang4 gao1 de5 shi2 hou4 sheng1 yin1 da4 , bo1 lang4 ai3 de5 shi2 hou4 sheng1 yin1 xiao3 .',
      say: { who: 'ai', text: '我的身体里也有一条这样的波浪！', expr: 'wonder' },
      action: { type: 'blow', hint: '对着麦克风吹一口气，让波浪动起来', ok: '波浪被吹得晃来晃去！', sfx: 'whoosh' },
      fx: '「呼——」的风声'
    },
    {
      mood: 'puzzled', beat: 'problem', scene: 'ear3',
      title: '波浪切成小段',
      g1: ['波浪被切成一小段一小段。'], g2: ['波浪被切成一小段一小段，', '每一小段是一个声音。'],
      g3: ['波浪被切成一小段一小段，每一小段就是一个声音。', '豆豆要把每一小段，', '拿去找到一样的声音。'],
      py1: 'bo1 lang4 bei4 qie1 cheng2 yi1 xiao3 duan4 yi1 xiao3 duan4 .',
      py2: 'bo1 lang4 bei4 qie1 cheng2 yi1 xiao3 duan4 yi1 xiao3 duan4 , mei3 yi1 xiao3 duan4 shi4 yi1 ge4 sheng1 yin1 .',
      py3: 'bo1 lang4 bei4 qie1 cheng2 yi1 xiao3 duan4 yi1 xiao3 duan4 , mei3 yi1 xiao3 duan4 jiu4 shi4 yi1 ge4 sheng1 yin1 . dou4 dou5 yao4 ba3 mei3 yi1 xiao3 duan4 , na2 qu4 zhao3 dao4 yi1 yang4 de5 sheng1 yin1 .',
      say: { who: 'dou', text: '这些小块块，我好像见过！　你能帮我再念一遍吗？我没听清。', expr: 'wonder' },
      action: { type: 'drag', hint: '把声音小块拖到对应的字上', ok: '配对成功，豆豆点点头。', sfx: 'ding' },
      fx: '「咔、咔、咔」的拼接声'
    },
    {
      mood: 'worried', beat: 'worry', scene: 'ear4',
      title: '听错啦',
      g1: ['点点说：我想听小猫的歌。', '豆豆放了一首小毛的歌。'],
      g2: ['点点说：我想听小猫的歌。', '豆豆听成了小毛，', '放了一首奇怪的歌。'],
      g3: ['点点说：我想听小猫的歌。', '豆豆听成了「小毛」，放出一首奇怪的歌。', '点点捂住耳朵笑了。'],
      py1: 'dian3 dian5 shuo1 : wo3 xiang3 ting1 xiao3 mao1 de5 ge1 . dou4 dou5 fang4 le5 yi1 shou3 xiao3 mao2 de5 ge1 .',
      py2: 'dian3 dian5 shuo1 : wo3 xiang3 ting1 xiao3 mao1 de5 ge1 . dou4 dou5 ting1 cheng2 le5 xiao3 mao2 , fang4 le5 yi1 shou3 qi2 guai4 de5 ge1 .',
      py3: 'dian3 dian5 shuo1 : wo3 xiang3 ting1 xiao3 mao1 de5 ge1 . dou4 dou5 ting1 cheng2 le5 xiao3 mao2 , fang4 chu1 yi1 shou3 qi2 guai4 de5 ge1 . dian3 dian5 wu3 zhu4 er3 duo5 xiao4 le5 .',
      say: { who: 'dou', text: '汪汪？我猜的对吗？　对不起，我又听错了……你能再念一次吗？', expr: 'puzzled' },
      action: { type: 'choose', q: '「小猫」和「小毛」听起来像吗？', options: ['很像', '一点也不像'], answer: 0,
        right: '对，它们听起来真的很像。', wrong: '再读一遍听听看？', sfx: 'soft' },
      fx: '放错的怪音乐「呜哇」'
    },
    {
      mood: 'thinking', beat: 'idea', scene: 'ear5',
      title: '慢一点，说清楚',
      g1: ['点点说：我慢一点说。'], g2: ['点点蹲下来，', '一个字一个字地说。'],
      g3: ['点点蹲下来，一个字一个字地说得很慢。', '豆豆把耳朵竖得直直的。'],
      py1: 'dian3 dian5 shuo1 : wo3 man4 yi1 dian3 shuo1 .',
      py2: 'dian3 dian5 dun1 xia4 lai2 , yi1 ge4 zi4 yi1 ge4 zi4 de5 shuo1 .',
      py3: 'dian3 dian5 dun1 xia4 lai2 , yi1 ge4 zi4 yi1 ge4 zi4 de5 shuo1 de5 hen3 man4 . dou4 dou5 ba3 er3 duo5 shu4 de5 zhi2 zhi2 de5 .',
      say: { who: 'dian', text: '小——猫——的——歌——', expr: 'happy' },
      action: { type: 'say', keyword: '小猫', hint: '慢慢地对豆豆说：小猫', ok: '豆豆这次听清楚了！', sfx: 'chime' },
      fx: '清清楚楚的说话声'
    },
    {
      mood: 'wonder', beat: 'clue', scene: 'ear6',
      title: '原来要这样',
      g1: ['豆豆发现：慢一点就好听多了。'], g2: ['豆豆发现，说得慢一点、', '周围安静一点，', '它就听得更准。'],
      g3: ['豆豆发现，说得慢一点、周围安静一点，', '它就能听得更准。', '它把这个发现记在了小脑袋里。'],
      py1: 'dou4 dou5 fa1 xian4 : man4 yi1 dian3 jiu4 hao3 ting1 duo1 le5 .',
      py2: 'dou4 dou5 fa1 xian4 , shuo1 de5 man4 yi1 dian3 , zhou1 wei2 an1 jing4 yi1 dian3 , ta1 jiu4 ting1 de5 geng4 zhun3 .',
      py3: 'dou4 dou5 fa1 xian4 , shuo1 de5 man4 yi1 dian3 , zhou1 wei2 an1 jing4 yi1 dian3 , ta1 jiu4 ting1 de5 geng4 zhun3 . ta1 ba3 zhe4 ge4 fa1 xian4 ji4 zai4 le5 xiao3 nao3 dai4 li3 .',
      say: { who: 'dou', text: '原来不是我没用，是我没听清！', expr: 'star' },
      action: { type: 'find', hint: '找出画面里能让豆豆听得更准的东西', ok: '安静的地方，豆豆听得最准。', sfx: 'ding' },
      fx: '「叮咚」恍然大悟'
    },
    {
      mood: 'success', beat: 'success', scene: 'ear7',
      title: '这次放对啦',
      g1: ['点点又说了一遍。', '豆豆放对了。'],
      g2: ['点点清清楚楚又说了一遍，', '豆豆放出了小猫的歌。', '这次对啦！'],
      g3: ['点点清清楚楚又说了一遍，豆豆放出了小猫的歌。', '叮叮咚咚，正是点点想听的那一首。', '它们一起跟着唱起来。'],
      py1: 'dian3 dian5 you4 shuo1 le5 yi1 bian4 . dou4 dou5 fang4 dui4 le5 .',
      py2: 'dian3 dian5 qing1 qing1 chu3 chu3 you4 shuo1 le5 yi1 bian4 , dou4 dou5 fang4 chu1 le5 xiao3 mao1 de5 ge1 . zhe4 ci4 dui4 la1 !',
      py3: 'dian3 dian5 qing1 qing1 chu3 chu3 you4 shuo1 le5 yi1 bian4 , dou4 dou5 fang4 chu1 le5 xiao3 mao1 de5 ge1 . ding1 ding1 dong1 dong1 , zheng4 shi4 dian3 dian5 xiang3 ting1 de5 na4 yi1 shou3 . ta1 men5 yi1 qi3 gen1 zhe5 chang4 qi3 lai2 .',
      say: { who: 'dou', text: '我听懂啦！我听懂啦！　你陪我一起听，我终于听懂啦！', expr: 'laugh' },
      action: { type: 'clap', hint: '给豆豆鼓鼓掌', ok: '豆豆开心地转了三圈！', sfx: 'cheer' },
      fx: '欢快的儿歌前奏'
    },
    {
      mood: 'warm', beat: 'gift', scene: 'ear8',
      title: '最重要的那句话',
      g1: ['点点说：豆豆，我喜欢你。', '豆豆听懂了。'],
      g2: ['点点抱住豆豆，', '轻轻说：豆豆，我喜欢你。', '这次豆豆一下就听懂了。'],
      g3: ['点点抱住豆豆，轻轻说：豆豆，我喜欢你。', '这次豆豆一下就听懂了，尾巴摇得像小风车。', '它说：这句话，我一定不会听错。'],
      py1: 'dian3 dian5 shuo1 : dou4 dou5 , wo3 xi3 huan5 ni3 . dou4 dou5 ting1 dong3 le5 .',
      py2: 'dian3 dian5 bao4 zhu4 dou4 dou5 , qing1 qing1 shuo1 : dou4 dou5 , wo3 xi3 huan5 ni3 . zhe4 ci4 dou4 dou5 yi1 xia4 jiu4 ting1 dong3 le5 .',
      py3: 'dian3 dian5 bao4 zhu4 dou4 dou5 , qing1 qing1 shuo1 : dou4 dou5 , wo3 xi3 huan5 ni3 . zhe4 ci4 dou4 dou5 yi1 xia4 jiu4 ting1 dong3 le5 , wei3 ba5 yao2 de5 xiang4 xiao3 feng1 che1 . ta1 shuo1 : zhe4 ju4 hua4 , wo3 yi1 ding4 bu2 hui4 ting1 cuo4 .',
      say: { who: 'dian', text: '你听得懂最重要的话，就够了。　是我们一起听懂的，谢谢你！', expr: 'shy' },
      action: { type: 'tap', target: '豆豆', hint: '摸摸豆豆的头', ok: '豆豆蹭了蹭你的手。', sfx: 'heart' },
      fx: '温柔的摇尾巴声'
    }
  ],
  questions: [
    { after: 2, q: '声音进到豆豆耳朵里，变成了什么？', options: ['一条上上下下的波浪', '一张图片'], answer: 0,
      right: '答对啦！声音会变成一条波浪。', wrong: '翻回上一页看看：波浪高的时候声音大。' },
    { after: 6, q: '豆豆听错的时候，点点是怎么做的？', options: ['慢慢地说清楚', '大声地凶它'], answer: 0,
      right: '你懂事了！说清楚一点，它就听得更准。', wrong: '点点没有生气哦，它蹲下来慢慢说。' }
  ],
  mentor: [
    { q: '豆豆为什么能听懂我说话？', a: '你说话的声音会变成一条波浪，跑进豆豆的耳朵。它把波浪切成一小段一小段，每一小段去找一个一样的声音，连起来就知道你在说什么啦。' },
    { q: '它为什么会听错？', a: '因为有些声音听起来很像，比如「猫」和「毛」。还有周围太吵、说得太快的时候，它也容易听错。慢慢说、说清楚，它就能听得更准。' },
    { q: '豆豆听得懂小猫叫吗？', a: '听不懂哦。豆豆只学过人说话的声音，小猫的叫声它没有学过，所以不知道是什么意思。' }
  ]
};


/** 前两本 */
const STORIES = [S1, S2];
module.exports = { STORIES };
