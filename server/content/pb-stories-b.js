/**
 * AI 启蒙绘本 · 故事脚本（第二批）
 */
'use strict';

/* ============================================================
 * 三、《豆豆的眼睛》—— AI 能看
 * 弧线：好奇 → 发现问题 → 着急 → 想办法 → 发现线索 → 再试 → 挫折 → 成功
 * ============================================================ */
const S3 = {
  id: 'eye', title: '豆豆的眼睛', emoji: '👀',
  concept: 'ai-see', conceptLabel: 'AI 能看',
  interests: ['动物', '朋友'],
  logline: '豆豆把老虎认成了猫，才明白机器眼里的世界是一格一格的数字。',
  cast: ['dou', 'dian', 'ai'],
  pages: [
    {
      mood: 'happy', beat: 'curious', scene: 'eye1',
      title: '豆豆会看东西',
      g1: ['豆豆脸上有一个小屏幕。'], g2: ['豆豆脸上有一个小屏幕，', '那是它看东西的眼睛。'],
      g3: ['豆豆脸上有一个小屏幕，那是它看东西的眼睛。', '它一看到点点，尾巴就摇起来。'],
      py1: 'dou4 dou5 lian3 shang4 you3 yi1 ge4 xiao3 ping2 mu4 .',
      py2: 'dou4 dou5 lian3 shang4 you3 yi1 ge4 xiao3 ping2 mu4 , na4 shi4 ta1 kan4 dong1 xi5 de5 yan3 jing5 .',
      py3: 'dou4 dou5 lian3 shang4 you3 yi1 ge4 xiao3 ping2 mu4 , na4 shi4 ta1 kan4 dong1 xi5 de5 yan3 jing5 . ta1 yi1 kan4 dao4 dian3 dian5 , wei3 ba5 jiu4 yao2 qi3 lai2 .',
      say: { who: 'dou', text: '汪汪！我看见你啦！', expr: 'happy' },
      action: { type: 'tap', target: '豆豆的脸', hint: '点一点豆豆的脸', ok: '豆豆的眼睛眨了眨。', sfx: 'giggle' },
      fx: '屏幕睁眼「叮」'
    },
    {
      mood: 'curious', beat: 'problem', scene: 'eye2',
      title: '它眼里的图片',
      g1: ['豆豆说：我看到的和你不一样。'], g2: ['豆豆说：我看到的图片，', '和你看到的不一样。'],
      g3: ['豆豆说：我看到的图片，和你看到的不一样。', '在我眼里，它是一格一格的小方块。'],
      py1: 'dou4 dou5 shuo1 : wo3 kan4 dao4 de5 he2 ni3 bu4 yi1 yang4 .',
      py2: 'dou4 dou5 shuo1 : wo3 kan4 dao4 de5 tu2 pian4 , he2 ni3 kan4 dao4 de5 bu4 yi1 yang4 .',
      py3: 'dou4 dou5 shuo1 : wo3 kan4 dao4 de5 tu2 pian4 , he2 ni3 kan4 dao4 de5 bu4 yi1 yang4 . zai4 wo3 yan3 li3 , ta1 shi4 yi1 ge2 yi1 ge2 de5 xiao3 fang1 kuai4 .',
      say: { who: 'ai', text: '每一格都写着一个数字，越亮数字越大。　你能帮我看看，这里面哪一只才是小猫吗？', expr: 'wonder' },
      action: { type: 'find', hint: '找出画面里最亮的那一格', ok: '最亮的地方，数字最大。', sfx: 'ding' },
      fx: '格子「嗒嗒嗒」逐个点亮'
    },
    {
      mood: 'thinking', beat: 'clue', scene: 'eye3',
      title: '小猫的样子',
      g1: ['小猫有尖尖的耳朵。'], g2: ['小猫有尖尖的耳朵，', '还有长长的胡须。'],
      g3: ['小猫有尖尖的耳朵、长长的胡须和毛茸茸的身子。', '这些特别的地方合起来，就是小猫的样子。'],
      py1: 'xiao3 mao1 you3 jian1 jian1 de5 er3 duo5 .',
      py2: 'xiao3 mao1 you3 jian1 jian1 de5 er3 duo5 , hai2 you3 chang2 chang2 de5 hu2 xu1 .',
      py3: 'xiao3 mao1 you3 jian1 jian1 de5 er3 duo5 , chang2 chang2 de5 hu2 xu1 he2 mao2 rong2 rong2 de5 shen1 zi5 . zhe4 xie1 te4 bie2 de5 di4 fang5 he2 qi3 lai2 , jiu4 shi4 xiao3 mao1 de5 yang4 zi5 .',
      say: { who: 'dian', text: '你把这些特别的地方记下来就好啦。', expr: 'happy' },
      action: { type: 'drag', hint: '把「尖耳朵」「长胡须」拖到小猫身上', ok: '都放对啦，小猫完整了。', sfx: 'pop' },
      fx: '「咔」贴上小标记'
    },
    {
      mood: 'wonder', beat: 'clue', scene: 'eye4',
      title: '看了好多好多',
      g1: ['豆豆看了好多猫的图片。'], g2: ['豆豆看了好多好多猫的图片，', '也看了好多不是猫的图片。'],
      g3: ['豆豆看了好多好多猫的图片，也看了好多不是猫的图片。', '看完之后，它心里慢慢有了小猫的样子。'],
      py1: 'dou4 dou5 kan4 le5 hao3 duo1 mao1 de5 tu2 pian4 .',
      py2: 'dou4 dou5 kan4 le5 hao3 duo1 hao3 duo1 mao1 de5 tu2 pian4 , ye3 kan4 le5 hao3 duo1 bu2 shi4 mao1 de5 tu2 pian4 .',
      py3: 'dou4 dou5 kan4 le5 hao3 duo1 hao3 duo1 mao1 de5 tu2 pian4 , ye3 kan4 le5 hao3 duo1 bu2 shi4 mao1 de5 tu2 pian4 . kan4 wan2 zhi1 hou4 , ta1 xin1 li3 man4 man4 you3 le5 xiao3 mao1 de5 yang4 zi5 .',
      say: { who: 'dou', text: '我好像记住啦！　你能帮我看看，哪只才是真正的小猫吗？', expr: 'star' },
      action: { type: 'clap', hint: '拍拍手，给豆豆加油', ok: '啪！豆豆看得更认真了。', sfx: 'clap' },
      fx: '翻卡片「唰唰唰」'
    },
    {
      mood: 'puzzled', beat: 'problem', scene: 'eye5',
      title: '把老虎认成猫',
      g1: ['来了一只小老虎。', '豆豆说：这是猫！'],
      g2: ['来了一只小老虎，', '豆豆大声说：这是猫！', '点点摇摇头。'],
      g3: ['来了一只小老虎，豆豆大声说：这是猫！', '点点摇摇头说：它有条纹，是老虎呀。', '豆豆的屏幕暗了一下。'],
      py1: 'lai2 le5 yi1 zhi1 xiao3 lao3 hu3 . dou4 dou5 shuo1 : zhe4 shi4 mao1 !',
      py2: 'lai2 le5 yi1 zhi1 xiao3 lao3 hu3 , dou4 dou5 da4 sheng1 shuo1 : zhe4 shi4 mao1 ! dian3 dian5 yao2 yao5 tou2 .',
      py3: 'lai2 le5 yi1 zhi1 xiao3 lao3 hu3 , dou4 dou5 da4 sheng1 shuo1 : zhe4 shi4 mao1 ! dian3 dian5 yao2 yao5 tou2 shuo1 : ta1 you3 tiao2 wen2 , shi4 lao3 hu3 ya5 . dou4 dou5 de5 ping2 mu4 an4 le5 yi1 xia4 .',
      say: { who: 'dou', text: '对不起，我看错了。', expr: 'sad' },
      action: { type: 'choose', q: '小老虎身上有什么，和小猫不一样？', options: ['条纹', '耳朵'], answer: 0,
        right: '没错，是条纹！', wrong: '再仔细看看它身上？', sfx: 'soft' },
      fx: '「咦？」的迟疑音'
    },
    {
      mood: 'thinking', beat: 'idea', scene: 'eye6',
      title: '再看一遍',
      g1: ['点点说：没关系，再看一遍。'], g2: ['点点说：没关系，', '我们再看一遍就好啦。'],
      g3: ['点点说：没关系，我们再看一遍就好啦。', '它把老虎的图片也放进了学习卡片里。'],
      py1: 'dian3 dian5 shuo1 : mei2 guan1 xi5 , zai4 kan4 yi1 bian4 .',
      py2: 'dian3 dian5 shuo1 : mei2 guan1 xi5 , wo3 men5 zai4 kan4 yi1 bian4 jiu4 hao3 la1 .',
      py3: 'dian3 dian5 shuo1 : mei2 guan1 xi5 , wo3 men5 zai4 kan4 yi1 bian4 jiu4 hao3 la1 . ta1 ba3 lao3 hu3 de5 tu2 pian4 ye3 fang4 jin4 le5 xue2 xi2 ka3 pian4 li3 .',
      say: { who: 'dian', text: '见过的越多，你就越厉害。', expr: 'happy' },
      action: { type: 'tap', target: '学习卡片', hint: '点一点，把新图片加进去', ok: '卡片又多了一张！', sfx: 'pop' },
      fx: '卡片「唰」归位'
    },
    {
      mood: 'success', beat: 'success', scene: 'eye7',
      title: '这次全对啦',
      g1: ['再来一只老虎，一只猫。', '豆豆都说对了。'],
      g2: ['又来了一只老虎和一只猫，', '豆豆这次都说对了。', '它高兴得原地转圈。'],
      g3: ['又来了一只老虎和一只猫，豆豆这次都说对了。', '它认出了条纹，也认出了胡须。', '它高兴得原地转了三圈。'],
      py1: 'zai4 lai2 yi1 zhi1 lao3 hu3 , yi1 zhi1 mao1 . dou4 dou5 dou1 shuo1 dui4 le5 .',
      py2: 'you4 lai2 le5 yi1 zhi1 lao3 hu3 he2 yi1 zhi1 mao1 , dou4 dou5 zhe4 ci4 dou1 shuo1 dui4 le5 . ta1 gao1 xing4 de5 yuan2 di4 zhuan4 quan1 .',
      py3: 'you4 lai2 le5 yi1 zhi1 lao3 hu3 he2 yi1 zhi1 mao1 , dou4 dou5 zhe4 ci4 dou1 shuo1 dui4 le5 . ta1 ren4 chu1 le5 tiao2 wen2 , ye3 ren4 chu1 le5 hu2 xu1 . ta1 gao1 xing4 de5 yuan2 di4 zhuan4 le5 san1 quan1 .',
      say: { who: 'dou', text: '我看过一次，就记住了！　这次全对啦，是你陪我一起看的！　这次全对啦，是你陪我一起看的！', expr: 'laugh' },
      action: { type: 'tap', target: '豆豆', hint: '给豆豆鼓掌', ok: '豆豆的尾巴摇成了风车！', sfx: 'cheer' },
      fx: '欢呼 + 星星'
    },
    {
      mood: 'warm', beat: 'gift', scene: 'eye8',
      title: '眼睛会犯错',
      g1: ['豆豆说：我也会看错。'], g2: ['豆豆说：我也会看错，', '所以你要告诉我哪里不对。'],
      g3: ['豆豆说：我也会看错，所以你要告诉我哪里不对。', '点点点点头：我们一起慢慢学。'],
      py1: 'dou4 dou5 shuo1 : wo3 ye3 hui4 kan4 cuo4 .',
      py2: 'dou4 dou5 shuo1 : wo3 ye3 hui4 kan4 cuo4 , suo3 yi3 ni3 yao4 gao4 su4 wo3 na3 li3 bu2 dui4 .',
      py3: 'dou4 dou5 shuo1 : wo3 ye3 hui4 kan4 cuo4 , suo3 yi3 ni3 yao4 gao4 su4 wo3 na3 li3 bu2 dui4 . dian3 dian5 dian3 dian5 tou2 : wo3 men5 yi1 qi3 man4 man4 xue2 .',
      say: { who: 'dian', text: '会犯错没关系，愿意再试就好。　谢谢你陪我一起看！', expr: 'shy' },
      action: { type: 'say', keyword: '没关系', hint: '对豆豆说一句：没关系', ok: '豆豆蹭了蹭你。', sfx: 'heart' },
      fx: '温柔单音'
    }
  ],
  questions: [
    { after: 1, q: '豆豆眼里的图片是什么样子？', options: ['一格一格的数字方块', '和小朋友看到的一样'], answer: 0,
      right: '说得好！它把图片看成一格一格的数字。', wrong: '再读一遍这一页：每一格都写着一个数字。' },
    { after: 4, q: '豆豆为什么把老虎认成了猫？', options: ['它没见过老虎', '它故意骗人'], answer: 0,
      right: '你真会想！没见过的东西最容易认错。', wrong: '豆豆不是故意的，它只是没见过老虎。' }
  ],
  mentor: [
    { q: '豆豆是怎么看见东西的？', a: '豆豆没有真的眼睛。它把图片切成很多小方块，每一块记一个数字，越亮数字越大。它就是靠这些数字来「看」的。' },
    { q: '它为什么把老虎认成猫？', a: '因为它只学过小猫的样子，没见过老虎。就像你第一次见到没见过的动物，也会愣一下。给它多看几张，它就记住了。' },
    { q: '我能帮豆豆看得更准吗？', a: '能呀！它认错了你就告诉它，或者帮它把新的图片加进学习卡片里，它下次就认得啦。' }
  ]
};

/* ============================================================
 * 四、《小AI 学说话》—— AI 能说话
 * ============================================================ */
const S4 = {
  id: 'talk', title: '小AI 学说话', emoji: '💬',
  concept: 'ai-speak', conceptLabel: 'AI 能说话',
  interests: ['故事', '朋友'],
  logline: '小AI 想给点点讲故事，却总是说不完整，最后它找到了自己的办法。',
  cast: ['ai', 'dian'],
  pages: [
    {
      mood: 'curious', beat: 'curious', scene: 'talk1',
      title: '小AI 想说话',
      g1: ['小AI 张开嘴，没有声音。'], g2: ['小AI 张开嘴，', '想说点什么，', '可是没有声音出来。'],
      g3: ['小AI 张开嘴，想说点什么，可是没有声音出来。', '它急得头顶的灯一闪一闪。'],
      py1: 'xiao3 AI zhang1 kai1 zui3 , mei2 you3 sheng1 yin1 .',
      py2: 'xiao3 AI zhang1 kai1 zui3 , xiang3 shuo1 dian3 shen2 me5 , ke3 shi4 mei2 you3 sheng1 yin1 chu1 lai2 .',
      py3: 'xiao3 AI zhang1 kai1 zui3 , xiang3 shuo1 dian3 shen2 me5 , ke3 shi4 mei2 you3 sheng1 yin1 chu1 lai2 . ta1 ji2 de5 tou2 ding3 de5 deng1 yi1 shan3 yi1 shan3 .',
      say: { who: 'ai', text: '……我，想给你讲个故事。', expr: 'shy' },
      action: { type: 'say', keyword: '你好', hint: '先跟小AI打个招呼', ok: '小AI 听见了，开心地晃了晃。', sfx: 'chime' },
      fx: '想说话却发不出声的「咕噜」'
    },
    {
      mood: 'thinking', beat: 'idea', scene: 'talk2',
      title: '身体里有声音碎片',
      g1: ['小AI 说我身体里有好多声音小块。'], g2: ['小AI 说：我的身体里，', '藏着好多好多声音小块。'],
      g3: ['小AI 说：我的身体里，藏着好多好多声音小块。', '把它们一个个拿出来的话，就能拼成一句话。'],
      py1: 'xiao3 AI shuo1 wo3 shen1 ti3 li3 you3 hao3 duo1 sheng1 yin1 xiao3 kuai4 .',
      py2: 'xiao3 AI shuo1 : wo3 de5 shen1 ti3 li3 , cang2 zhe5 hao3 duo1 hao3 duo1 sheng1 yin1 xiao3 kuai4 .',
      py3: 'xiao3 AI shuo1 : wo3 de5 shen1 ti3 li3 , cang2 zhe5 hao3 duo1 hao3 duo1 sheng1 yin1 xiao3 kuai4 . ba3 ta1 men5 yi1 ge4 ge4 na2 chu1 lai2 de5 hua4 , jiu4 neng2 pin1 cheng2 yi1 ju4 hua4 .',
      say: { who: 'ai', text: '因为我的身体里藏了好多好多声音碎片呀！', expr: 'wonder' },
      action: { type: 'find', hint: '找出画面里飘着的声音小块', ok: '你找到了三块！', sfx: 'ding' },
      fx: '小碎片「叮叮」飘动'
    },
    {
      mood: 'happy', beat: 'idea', scene: 'talk3',
      title: '拼出第一句',
      g1: ['小AI 拼出了第一句话。'], g2: ['小AI 把声音小块摆好，', '拼出了第一句话。'],
      g3: ['小AI 把声音小块摆好，拼出了第一句话。', '虽然有点慢，可是很清楚。'],
      py1: 'xiao3 AI pin1 chu1 le5 di4 yi1 ju4 hua4 .',
      py2: 'xiao3 AI ba3 sheng1 yin1 xiao3 kuai4 bai3 hao3 , pin1 chu1 le5 di4 yi1 ju4 hua4 .',
      py3: 'xiao3 AI ba3 sheng1 yin1 xiao3 kuai4 bai3 hao3 , pin1 chu1 le5 di4 yi1 ju4 hua4 . sui1 ran2 you3 dian3 man4 , ke3 shi4 hen3 qing1 chu3 .',
      say: { who: 'ai', text: '点——点——你——好——', expr: 'star' },
      action: { type: 'drag', hint: '把声音小块按顺序摆好', ok: '拼好啦：点点你好！', sfx: 'pop' },
      fx: '「嗒、嗒、嗒」拼接声'
    },
    {
      mood: 'worried', beat: 'problem', scene: 'talk4',
      title: '说乱了',
      g1: ['小AI 一着急，说乱了。'], g2: ['小AI 一着急，', '声音小块全乱了，', '说出一句奇怪的话。'],
      g3: ['小AI 一着急，声音小块全乱了。', '它说：你好点点点点点点——', '自己也听笑了。'],
      py1: 'xiao3 AI yi1 zhao2 ji2 , shuo1 luan4 le5 .',
      py2: 'xiao3 AI yi1 zhao2 ji2 , sheng1 yin1 xiao3 kuai4 quan2 luan4 le5 , shuo1 chu1 yi1 ju4 qi2 guai4 de5 hua4 .',
      py3: 'xiao3 AI yi1 zhao2 ji2 , sheng1 yin1 xiao3 kuai4 quan2 luan4 le5 . ta1 shuo1 : ni3 hao3 dian3 dian3 dian3 dian3 dian3 — — zi4 ji3 ye3 ting1 xiao4 le5 .',
      say: { who: 'ai', text: '哎呀，我的小块块排队排乱了！　哎呀，又错了……你能再等我一次吗？', expr: 'puzzled' },
      action: { type: 'choose', q: '小AI 为什么说乱了？', options: ['它太着急了', '它忘记怎么说话'], answer: 0,
        right: '对，慢慢来就不会乱。', wrong: '再看一下：它一着急，小块就乱跑啦。', sfx: 'soft' },
      fx: '「叽里咕噜」乱作一团'
    },
    {
      mood: 'thinking', beat: 'idea', scene: 'talk5',
      title: '一句一句来',
      g1: ['点点说：一句一句说。'], g2: ['点点说：不着急，', '一句一句来就好。'],
      g3: ['点点说：不着急，一句一句来就好。', '小AI 听了，慢慢把小块排整齐。'],
      py1: 'dian3 dian5 shuo1 : yi1 ju4 yi1 ju4 shuo1 .',
      py2: 'dian3 dian5 shuo1 : bu4 zhao2 ji2 , yi1 ju4 yi1 ju4 lai2 jiu4 hao3 .',
      py3: 'dian3 dian5 shuo1 : bu4 zhao2 ji2 , yi1 ju4 yi1 ju4 lai2 jiu4 hao3 . xiao3 AI ting1 le5 , man4 man4 ba3 xiao3 kuai4 pai2 zheng3 qi2 .',
      say: { who: 'dian', text: '慢一点，我等你。　你帮我看看，哪张卡片应该排在最前面？', expr: 'happy' },
      action: { type: 'clap', hint: '轻轻拍手，给小AI 打拍子', ok: '跟着拍子，小AI 说得又稳又清楚。', sfx: 'clap' },
      fx: '稳定的节拍「咚、咚、咚」'
    },
    {
      mood: 'wonder', beat: 'clue', scene: 'talk6',
      title: '故事讲出来了',
      g1: ['小AI 讲完了整个故事。'], g2: ['小AI 一句一句地讲，', '居然讲完了整个故事。'],
      g3: ['小AI 一句一句地讲，居然讲完了整个故事。', '故事的结尾，连它自己都觉得好听。'],
      py1: 'xiao3 AI jiang3 wan2 le5 zheng3 ge4 gu4 shi5 .',
      py2: 'xiao3 AI yi1 ju4 yi1 ju4 de5 jiang3 , ju1 ran2 jiang3 wan2 le5 zheng3 ge4 gu4 shi5 .',
      py3: 'xiao3 AI yi1 ju4 yi1 ju4 de5 jiang3 , ju1 ran2 jiang3 wan2 le5 zheng3 ge4 gu4 shi5 . gu4 shi5 de5 jie2 wei3 , lian2 ta1 zi4 ji3 dou1 jue2 de5 hao3 ting1 .',
      say: { who: 'ai', text: '我会讲故事啦！', expr: 'laugh' },
      action: { type: 'tap', target: '小AI', hint: '给小AI 鼓掌', ok: '小AI 高兴得转了两圈。', sfx: 'cheer' },
      fx: '温暖的故事结束音'
    },
    {
      mood: 'puzzled', beat: 'problem', scene: 'talk7',
      title: '它会说的话，都是学来的',
      g1: ['点点问：你怎么会讲故事？'], g2: ['点点问：你怎么会讲这么好听的故事？', '小AI 想了想。'],
      g3: ['点点问：你怎么会讲这么好听的故事？', '小AI 想了想说：因为以前有人讲过很多故事给我听，', '我把它们记下来，再拼成新的。'],
      py1: 'dian3 dian5 wen4 : ni3 zen3 me5 hui4 jiang3 gu4 shi5 ?',
      py2: 'dian3 dian5 wen4 : ni3 zen3 me5 hui4 jiang3 zhe4 me5 hao3 ting1 de5 gu4 shi5 ? xiao3 AI xiang3 le5 xiang3 .',
      py3: 'dian3 dian5 wen4 : ni3 zen3 me5 hui4 jiang3 zhe4 me5 hao3 ting1 de5 gu4 shi5 ? xiao3 AI xiang3 le5 xiang3 shuo1 : yin1 wei4 yi3 qian2 you3 ren2 jiang3 guo4 hen3 duo1 gu4 shi5 gei3 wo3 ting1 , wo3 ba3 ta1 men5 ji4 xia4 lai2 , zai4 pin1 cheng2 xin1 de5 .',
      say: { who: 'dian', text: '原来你也要听很多故事，才会讲故事。　对不起，我刚才又忘了一句……你能再听我讲一次吗？', expr: 'wonder' },
      action: { type: 'find', hint: '找出画面里所有的故事书', ok: '书越多，小AI 会讲的故事就越多。', sfx: 'ding' },
      fx: '翻书「哗啦」'
    },
    {
      mood: 'success', beat: 'success', scene: 'talk8',
      title: '今晚的睡前故事',
      g1: ['今晚，小AI 来讲故事。'], g2: ['今晚，小AI 来讲睡前故事。', '点点躺在被窝里听。'],
      g3: ['今晚，小AI 来讲睡前故事。', '点点躺在被窝里，听着听着就笑了。', '它讲得又慢又清楚。'],
      py1: 'jin1 wan3 , xiao3 AI lai2 jiang3 gu4 shi5 .',
      py2: 'jin1 wan3 , xiao3 AI lai2 jiang3 shui4 qian2 gu4 shi5 . dian3 dian5 tang3 zai4 bei4 wo1 li3 ting1 .',
      py3: 'jin1 wan3 , xiao3 AI lai2 jiang3 shui4 qian2 gu4 shi5 . dian3 dian5 tang3 zai4 bei4 wo1 li3 , ting1 zhe5 ting1 zhe5 jiu4 xiao4 le5 . ta1 jiang3 de5 you4 man4 you4 qing1 chu3 .',
      say: { who: 'ai', text: '从前，有一个会发光的小家伙……', expr: 'happy' },
      action: { type: 'tap', target: '灯', hint: '点一点，把灯关小一点', ok: '房间暗下来，故事开始了。', sfx: 'warm' },
      fx: '柔和的晚安音'
    },
    {
      mood: 'warm', beat: 'gift', scene: 'talk9',
      title: '晚安，小AI',
      g1: ['点点睡着了。', '小AI 轻轻说：晚安。'],
      g2: ['点点睡着了。', '小AI 关掉自己的灯，', '轻轻说：晚安。'],
      g3: ['点点睡着了。', '小AI 关掉自己的灯，轻轻说：晚安。', '它想：明天还要讲一个新故事。'],
      py1: 'dian3 dian5 shui4 zhao2 le5 . xiao3 AI qing1 qing1 shuo1 : wan3 an1 .',
      py2: 'dian3 dian5 shui4 zhao2 le5 . xiao3 AI guan1 diao4 zi4 ji3 de5 deng1 , qing1 qing1 shuo1 : wan3 an1 .',
      py3: 'dian3 dian5 shui4 zhao2 le5 . xiao3 AI guan1 diao4 zi4 ji3 de5 deng1 , qing1 qing1 shuo1 : wan3 an1 . ta1 xiang3 : ming2 tian1 hai2 yao4 jiang3 yi1 ge4 xin1 gu4 shi5 .',
      say: { who: 'dian', text: '（睡着了，嘴角还在笑）　这个办法，是我和你一起想出来的！　我们一起把它讲完整了，谢谢你陪着我！', expr: 'happy' },
      action: { type: 'tap', target: '小AI', hint: '也对小AI 说声晚安', ok: '小AI 的灯慢慢熄灭了。', sfx: 'heart' },
      fx: '轻轻的「晚安」'
    }
  ],
  questions: [
    { after: 2, q: '小AI 是怎么说出话来的？', options: ['把声音小块排好拼起来', '张开嘴就有声音'], answer: 0,
      right: '对啦！声音小块排整齐，就能拼成一句话。', wrong: '再看看这一页：它的身体里藏着什么呀？' },
    { after: 6, q: '小AI 为什么会讲故事？', options: ['它听过很多故事', '它天生就会'], answer: 0,
      right: '你真会思考！听过很多，才会讲。', wrong: '想一想：它说「以前有人讲过很多故事给我听」。' }
  ],
  mentor: [
    { q: '小AI 为什么会说话？', a: '因为它的身体里藏着好多好多声音碎片呀！它把碎片一个个排好、拼起来，就变成一句话了。' },
    { q: '它为什么有时候说乱了？', a: '它一着急，声音碎片就排队排乱了。慢慢来，一句一句说，它就能说得又清楚又好听。' },
    { q: '它会自己想出新故事吗？', a: '它会把你讲给它听过的故事记下来，再重新拼成一个新的。所以它讲的故事，其实都有点像它听过的那一些。' }
  ]
};


/** 第三、四本 */
const STORIES = [S3, S4];
module.exports = { STORIES };
