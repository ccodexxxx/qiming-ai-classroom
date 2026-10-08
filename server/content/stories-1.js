/**
 * AI 绘本 · 故事内容库
 * 五本绘本，一一对应低龄段需要建立的五个 AI 认知：
 *   1) AI 是什么      → 《小启的一天》
 *   2) AI 能做什么    → 《会看图的机器人》
 *   3) AI 怎么听懂话  → 《会说话的小音箱》
 *   4) AI 怎么学会的  → 《小启学认猫》
 *   5) 人和 AI 的关系 → 《我和小启》
 *
 * 每页提供三档文字（g1 / g2 / g3），由引擎按年级自动选档：
 *   g1：1～2 句，每句 ≤ 12 字（一年级，识字量有限）
 *   g2：2～3 句，每句 ≤ 15 字（二年级，开始能读整段）
 *   g3：3 句，每句 ≤ 20 字（三年级，可含简单因果与提问）
 * 拼音用「数字声调」写法（xiao3 qi3），由 lib/pinyin.js 转成带调拼音，
 * 并在内容校验时逐音节检查，避免出现拼错的拼音。
 */
'use strict';

/* ============================================================
 * 一、《小启的一天》—— AI 是什么（能听、能看、能说话、能帮忙的聪明朋友）
 * ============================================================ */
const S1 = {
  id: 'day',
  title: '小启的一天',
  emoji: '🤖',
  concept: 'ai-what',
  conceptLabel: 'AI 是什么',
  intro: '小启是一个会听、会看、会说话的聪明朋友。',
  cast: ['小启', '小雨', '妈妈'],
  pages: [
    {
      scene: 'wake', title: '小启醒来了',
      g1: ['小雨家有一个小机器人。', '它的名字叫小启。'],
      g2: ['小雨家来了一个新朋友，', '圆圆的脑袋，亮亮的眼睛，', '它的名字叫小启。'],
      g3: ['小雨家来了一个聪明的新朋友。', '它有一个圆圆的脑袋和亮亮的眼睛，', '大家都叫它「小启」。'],
      py1: 'xiao3 yu3 jia1 you3 yi1 ge4 xiao3 ji1 qi4 ren2 . ta1 de5 ming2 zi5 jiao4 xiao3 qi3 .',
      py2: 'xiao3 yu3 jia1 lai2 le5 yi1 ge4 xin1 peng2 you3 , yuan2 yuan2 de5 nao3 dai4 , liang4 liang4 de5 yan3 jing5 , ta1 de5 ming2 zi5 jiao4 xiao3 qi3 .',
      py3: 'xiao3 yu3 jia1 lai2 le5 yi1 ge4 cong1 ming2 de5 xin1 peng2 you3 . ta1 you3 yi1 ge4 yuan2 yuan2 de5 nao3 dai4 he2 liang4 liang4 de5 yan3 jing5 , da4 jia1 dou1 jiao4 ta1 xiao3 qi3 .'
    },
    {
      scene: 'listen', title: '小启会听',
      g1: ['小雨说：「小启，你好。」', '小启听见了。'],
      g2: ['小雨对着小启说话，', '小启马上就听见了，', '还说：「你好，小雨！」'],
      g3: ['小雨对着小启说了一声「你好」。', '小启马上就听见了，也回了一句：', '「你好呀，小雨！今天想做什么？」'],
      py1: 'xiao3 yu3 shuo1 : xiao3 qi3 , ni3 hao3 . xiao3 qi3 ting1 jian4 le5 .',
      py2: 'xiao3 yu3 dui4 zhe5 xiao3 qi3 shuo1 hua4 , xiao3 qi3 ma3 shang4 jiu4 ting1 jian4 le5 , hai2 shuo1 : ni3 hao3 , xiao3 yu3 !',
      py3: 'xiao3 yu3 dui4 zhe5 xiao3 qi3 shuo1 le5 yi1 sheng1 ni3 hao3 . xiao3 qi3 ma3 shang4 jiu4 ting1 jian4 le5 , ye3 hui2 le5 yi1 ju4 : ni3 hao3 ya5 , xiao3 yu3 ! jin1 tian1 xiang3 zuo4 shen2 me5 ?'
    },
    {
      scene: 'see', title: '小启会看',
      g1: ['小雨拿来一张照片。', '小启一看就认出来了。'],
      g2: ['小雨拿来一张照片，', '照片上有一只小猫。', '小启一看就认出来了。'],
      g3: ['小雨拿来一张照片，上面有一只睡着的小猫。', '小启只看了一下就认出来了，', '它说：「这是一只猫，它睡着了。」'],
      py1: 'xiao3 yu3 na2 lai2 yi1 zhang1 zhao4 pian4 . xiao3 qi3 yi1 kan4 jiu4 ren4 chu1 lai2 le5 .',
      py2: 'xiao3 yu3 na2 lai2 yi1 zhang1 zhao4 pian4 , zhao4 pian4 shang4 you3 yi1 zhi1 xiao3 mao1 . xiao3 qi3 yi1 kan4 jiu4 ren4 chu1 lai2 le5 .',
      py3: 'xiao3 yu3 na2 lai2 yi1 zhang1 zhao4 pian4 , shang4 mian4 you3 yi1 zhi1 shui4 zhao2 de5 xiao3 mao1 . xiao3 qi3 zhi3 kan4 le5 yi1 xia4 jiu4 ren4 chu1 lai2 le5 , ta1 shuo1 : zhe4 shi4 yi1 zhi1 mao1 , ta1 shui4 zhao2 le5 .'
    },
    {
      scene: 'speak', title: '小启会说话',
      g1: ['小启还会讲故事。', '小雨听得笑眯眯。'],
      g2: ['晚上，小启给小雨讲故事。', '小雨躺在床上听，', '听着听着就笑了。'],
      g3: ['晚上，小启给小雨讲了一个关于机器人的故事。', '小雨躺在床上静静地听，', '听着听着就笑了起来。'],
      py1: 'xiao3 qi3 hai2 hui4 jiang3 gu4 shi5 . xiao3 yu3 ting1 de5 xiao4 mi1 mi1 .',
      py2: 'wan3 shang5 , xiao3 qi3 gei3 xiao3 yu3 jiang3 gu4 shi5 . xiao3 yu3 tang3 zai4 chuang2 shang4 ting1 , ting1 zhe5 ting1 zhe5 jiu4 xiao4 le5 .',
      py3: 'wan3 shang5 , xiao3 qi3 gei3 xiao3 yu3 jiang3 le5 yi1 ge4 guan1 yu2 ji1 qi4 ren2 de5 gu4 shi5 . xiao3 yu3 tang3 zai4 chuang2 shang4 jing4 jing4 de5 ting1 , ting1 zhe5 ting1 zhe5 jiu4 xiao4 le5 qi3 lai2 .'
    },
    {
      scene: 'help', title: '小启会帮忙',
      g1: ['妈妈找不到照片了。', '小启一下就说出了位置。'],
      g2: ['妈妈找不到那张小猫的照片。', '小启想了一下，', '一下就告诉了妈妈照片在哪里。'],
      g3: ['妈妈怎么也找不到那张小猫的照片。', '小启想了一下，很快就告诉妈妈：', '「照片在客厅的抽屉里。」'],
      py1: 'ma1 ma1 zhao3 bu4 dao4 zhao4 pian4 le5 . xiao3 qi3 yi1 xia4 jiu4 shuo1 chu1 le5 wei4 zhi4 .',
      py2: 'ma1 ma1 zhao3 bu4 dao4 na4 zhang1 xiao3 mao1 de5 zhao4 pian4 . xiao3 qi3 xiang3 le5 yi1 xia4 , yi1 xia4 jiu4 gao4 su4 le5 ma1 ma1 zhao4 pian4 zai4 na3 li3 .',
      py3: 'ma1 ma1 zen3 me5 ye3 zhao3 bu4 dao4 na4 zhang1 xiao3 mao1 de5 zhao4 pian4 . xiao3 qi3 xiang3 le5 yi1 xia4 , hen3 kuai4 jiu4 gao4 su4 ma1 ma1 : zhao4 pian4 zai4 ke4 ting1 de5 chou1 ti5 li3 .'
    },
    {
      scene: 'friend', title: '聪明的好朋友',
      g1: ['小启会听、会看、会说话。', '它是我们的好朋友。'],
      g2: ['小启会听、会看、会说话，', '还会帮忙做事。', '它真是一个聪明的好朋友。'],
      g3: ['小启会听、会看、会说话，还会帮我们做事。', '它像一个聪明的好朋友。', '不过它也需要人来教它、照顾它。'],
      py1: 'xiao3 qi3 hui4 ting1 , hui4 kan4 , hui4 shuo1 hua4 . ta1 shi4 wo3 men5 de5 hao3 peng2 you3 .',
      py2: 'xiao3 qi3 hui4 ting1 , hui4 kan4 , hui4 shuo1 hua4 , hai2 hui4 bang1 mang2 zuo4 shi4 . ta1 zhen1 shi4 yi1 ge4 cong1 ming2 de5 hao3 peng2 you3 .',
      py3: 'xiao3 qi3 hui4 ting1 , hui4 kan4 , hui4 shuo1 hua4 , hai2 hui4 bang1 wo3 men5 zuo4 shi4 . ta1 xiang4 yi1 ge4 cong1 ming2 de5 hao3 peng2 you3 . bu2 guo4 ta1 ye3 xu1 yao4 ren2 lai2 jiao1 ta1 , zhao4 gu4 ta1 .'
    }
  ],
  questions: [
    {
      after: 2,
      q: '小启能听见小雨说话吗？',
      options: ['能听见', '听不见'],
      answer: 0,
      right: '答对啦！小启有「耳朵」，能听见我们说话。',
      wrong: '再想一想～小雨说完，小启马上就回答了哦。'
    },
    {
      after: 4,
      q: '照片是谁找到的？',
      options: ['小启找到了', '妈妈自己找到了'],
      answer: 0,
      right: '真棒！小启帮妈妈找到了照片。',
      wrong: '再看一眼这一页：妈妈找不到，小启一下就说了出来。'
    }
  ],
  mentor: [
    { q: '小启为什么能找到照片？', a: '因为小启会「看」照片，还会把照片记在心里。你把玩具收在固定的地方，下次也能很快就找到啦。' },
    { q: '小启会累吗？', a: '小启不会像我们一样累。不过小启要用电，没电了就要去充电，就像我们要睡觉一样。' },
    { q: '小启是活的吗？', a: '小启不是活的。它会听、会看，是因为人给它写了程序。真正会饿、会疼、会长大的，是我们和小猫小狗。' }
  ]
};

/* ============================================================
 * 二、《会看图的机器人》—— AI 能做什么（识别图片）
 * ============================================================ */
const S2 = {
  id: 'vision',
  title: '会看图的机器人',
  emoji: '👀',
  concept: 'ai-can',
  conceptLabel: 'AI 能做什么',
  intro: '机器看图片，靠的是一格一格的数字，不是眼睛。',
  cast: ['小雨', '小启'],
  pages: [
    {
      scene: 'photoWall', title: '照片墙',
      g1: ['墙上有很多照片。', '小雨想找那只小白猫。'],
      g2: ['墙上贴满了照片，', '有小猫、小狗，还有花。', '小雨想找到那只小白猫。'],
      g3: ['墙上贴满了照片：小猫、小狗、花和蛋糕。', '小雨想找出所有有小猫的照片，', '可是照片实在太多了。'],
      py1: 'qiang2 shang4 you3 hen3 duo1 zhao4 pian4 . xiao3 yu3 xiang3 zhao3 na4 zhi1 xiao3 bai2 mao1 .',
      py2: 'qiang2 shang4 tie1 man3 le5 zhao4 pian4 , you3 xiao3 mao1 , xiao3 gou3 , hai2 you3 hua1 . xiao3 yu3 xiang3 zhao3 dao4 na4 zhi1 xiao3 bai2 mao1 .',
      py3: 'qiang2 shang4 tie1 man3 le5 zhao4 pian4 : xiao3 mao1 , xiao3 gou3 , hua1 he2 dan4 gao1 . xiao3 yu3 xiang3 zhao3 chu1 suo3 you3 you3 xiao3 mao1 de5 zhao4 pian4 , ke3 shi4 zhao4 pian4 shi2 zai4 tai4 duo1 le5 .'
    },
    {
      scene: 'grid', title: '机器眼里的图片',
      g1: ['小启说：我看图不一样。', '我看到的是数字格子。'],
      g2: ['小启说：「我看图片和你不一样。」', '「在我眼里，图片是一格一格的数字。」', '格子越亮，数字越大。'],
      g3: ['小启说：「我看到的图片和你不一样。」', '「在我眼里，图片被分成很多小格子，', '每格都写着一个数字，格子越亮数字越大。」'],
      py1: 'xiao3 qi3 shuo1 : wo3 kan4 tu2 bu4 yi1 yang4 . wo3 kan4 dao4 de5 shi4 shu4 zi4 ge2 zi5 .',
      py2: 'xiao3 qi3 shuo1 : wo3 kan4 tu2 pian4 he2 ni3 bu4 yi1 yang4 . zai4 wo3 yan3 li3 , tu2 pian4 shi4 yi1 ge2 yi1 ge2 de5 shu4 zi4 . ge2 zi5 yue4 liang4 , shu4 zi4 yue4 da4 .',
      py3: 'xiao3 qi3 shuo1 : wo3 kan4 dao4 de5 tu2 pian4 he2 ni3 bu4 yi1 yang4 . zai4 wo3 yan3 li3 , tu2 pian4 bei4 fen1 cheng2 hen3 duo1 xiao3 ge2 zi5 , mei3 ge2 dou1 xie3 zhe5 yi1 ge4 shu4 zi4 , ge2 zi5 yue4 liang4 shu4 zi4 yue4 da4 .'
    },
    {
      scene: 'features', title: '小猫的样子',
      g1: ['小猫有尖尖的耳朵。', '还有长长的胡须。'],
      g2: ['小猫有尖尖的耳朵，', '圆圆的脸上有长胡须，', '身上还有花纹。'],
      g3: ['小猫有尖尖的耳朵、圆圆的胡须和毛茸茸的身子。', '这些「特别的地方」合起来，', '就成了小猫的样子。'],
      py1: 'xiao3 mao1 you3 jian1 jian1 de5 er3 duo5 . hai2 you3 chang2 chang2 de5 hu2 xu1 .',
      py2: 'xiao3 mao1 you3 jian1 jian1 de5 er3 duo5 , yuan2 yuan2 de5 lian3 shang4 you3 chang2 hu2 xu1 , shen1 shang4 hai2 you3 hua1 wen2 .',
      py3: 'xiao3 mao1 you3 jian1 jian1 de5 er3 duo5 , yuan2 yuan2 de5 hu2 xu1 he2 mao2 rong2 rong2 de5 shen1 zi5 . zhe4 xie1 te4 bie2 de5 di4 fang5 he2 qi3 lai2 , jiu4 cheng2 le5 xiao3 mao1 de5 yang4 zi5 .'
    },
    {
      scene: 'train', title: '看很多很多照片',
      g1: ['小启看过很多猫的照片。', '看得多了，它就学会了。'],
      g2: ['小启看过很多很多猫的照片，', '也看过很多不是猫的照片。', '看得多了，它慢慢就学会了。'],
      g3: ['小启看过成千上万张猫的照片，', '也看过很多「不是猫」的照片。', '看得多了，它慢慢就分得清楚啦。'],
      py1: 'xiao3 qi3 kan4 guo4 hen3 duo1 mao1 de5 zhao4 pian4 . kan4 de5 duo1 le5 , ta1 jiu4 xue2 hui4 le5 .',
      py2: 'xiao3 qi3 kan4 guo4 hen3 duo1 hen3 duo1 mao1 de5 zhao4 pian4 , ye3 kan4 guo4 hen3 duo1 bu2 shi4 mao1 de5 zhao4 pian4 . kan4 de5 duo1 le5 , ta1 man4 man4 jiu4 xue2 hui4 le5 .',
      py3: 'xiao3 qi3 kan4 guo4 cheng2 qian1 shang4 wan4 zhang1 mao1 de5 zhao4 pian4 , ye3 kan4 guo4 hen3 duo1 bu2 shi4 mao1 de5 zhao4 pian4 . kan4 de5 duo1 le5 , ta1 man4 man4 jiu4 fen1 de5 qing1 chu3 la1 .'
    },
    {
      scene: 'guess', title: '小启来试试',
      g1: ['小雨拿出一张新照片。', '小启说：这是猫！'],
      g2: ['小雨拿出一张新照片，', '上面是一只黑猫。', '小启说：「这是猫！」'],
      g3: ['小雨拿出一张从来没见过的黑猫照片。', '小启看了一会儿说：', '「这是猫。虽然它很黑，但耳朵和胡须是一样的。」'],
      py1: 'xiao3 yu3 na2 chu1 yi1 zhang1 xin1 zhao4 pian4 . xiao3 qi3 shuo1 : zhe4 shi4 mao1 !',
      py2: 'xiao3 yu3 na2 chu1 yi1 zhang1 xin1 zhao4 pian4 , shang4 mian4 shi4 yi1 zhi1 hei1 mao1 . xiao3 qi3 shuo1 : zhe4 shi4 mao1 !',
      py3: 'xiao3 yu3 na2 chu1 yi1 zhang1 cong2 lai2 mei2 jian4 guo4 de5 hei1 mao1 zhao4 pian4 . xiao3 qi3 kan4 le5 yi1 hui4 er5 shuo1 : zhe4 shi4 mao1 . sui1 ran2 ta1 hen3 hei1 , dan4 er3 duo5 he2 hu2 xu1 shi4 yi1 yang4 de5 .'
    },
    {
      scene: 'mistake', title: '它也会认错',
      g1: ['这张照片，小启认错了。', '原来是一只小老虎。'],
      g2: ['有一张照片小启认错了，', '它把一只小老虎当成了猫。', '小启说：「对不起，我错了。」'],
      g3: ['可是有一张照片小启认错了，', '它把一只小老虎当成了猫。', '小启说：「对不起，我看错了。老虎的条纹不一样。」'],
      py1: 'zhe4 zhang1 zhao4 pian4 , xiao3 qi3 ren4 cuo4 le5 . yuan2 lai2 shi4 yi1 zhi1 xiao3 lao3 hu3 .',
      py2: 'you3 yi1 zhang1 zhao4 pian4 xiao3 qi3 ren4 cuo4 le5 , ta1 ba3 yi1 zhi1 xiao3 lao3 hu3 dang4 cheng2 le5 mao1 . xiao3 qi3 shuo1 : dui4 bu4 qi3 , wo3 cuo4 le5 .',
      py3: 'ke3 shi4 you3 yi1 zhang1 zhao4 pian4 xiao3 qi3 ren4 cuo4 le5 , ta1 ba3 yi1 zhi1 xiao3 lao3 hu3 dang4 cheng2 le5 mao1 . xiao3 qi3 shuo1 : dui4 bu4 qi3 , wo3 kan4 cuo4 le5 . lao3 hu3 de5 tiao2 wen2 bu4 yi1 yang4 .'
    },
    {
      scene: 'helper', title: '它也能帮大忙',
      g1: ['小启能很快找到所有小猫。', '它真会看图。'],
      g2: ['小启很快找出了所有小猫的照片，', '妈妈再也不用一张一张翻了。', '会看图真有用！'],
      g3: ['小启很快找出了所有有小猫的照片，', '妈妈再也不用一张一张翻了。', '它还会帮医生看片子，帮农民看庄稼有没有生病。'],
      py1: 'xiao3 qi3 neng2 hen3 kuai4 zhao3 dao4 suo3 you3 xiao3 mao1 . ta1 zhen1 hui4 kan4 tu2 .',
      py2: 'xiao3 qi3 hen3 kuai4 zhao3 chu1 le5 suo3 you3 xiao3 mao1 de5 zhao4 pian4 , ma1 ma1 zai4 ye3 bu2 yong4 yi1 zhang1 yi1 zhang1 fan1 le5 . hui4 kan4 tu2 zhen1 you3 yong4 !',
      py3: 'xiao3 qi3 hen3 kuai4 zhao3 chu1 le5 suo3 you3 you3 xiao3 mao1 de5 zhao4 pian4 , ma1 ma1 zai4 ye3 bu2 yong4 yi1 zhang1 yi1 zhang1 fan1 le5 . ta1 hai2 hui4 bang1 yi1 sheng1 kan4 pian4 zi5 , bang1 nong2 min2 kan4 zhuang1 jia1 you3 mei2 you3 sheng1 bing4 .'
    }
  ],
  questions: [
    {
      after: 1,
      q: '在小启眼里，图片是什么？',
      options: ['一格一格的数字', '和小朋友看到的一样'],
      answer: 0,
      right: '没错！机器把图片看成很多小格子，每格是一个数字。',
      wrong: '再想想～小启说它看图和小朋友不一样哦。'
    },
    {
      after: 4,
      q: '小启为什么会认错小老虎？',
      options: ['它看得不够多，也会犯错', '它故意骗人'],
      answer: 0,
      right: '你真会思考！AI 也会犯错，需要我们帮它改正。',
      wrong: '小启不是故意的～它是把没见过的东西认错了。'
    }
  ],
  mentor: [
    { q: '机器是怎么看见东西的？', a: '机器没有眼睛。它把图片切成很多小格子，每格记一个数字，数字大表示那里比较亮。它就是靠这些数字来「看」的。' },
    { q: '为什么 AI 会认错？', a: '因为 AI 只学过它见过的东西。如果它没见过小老虎，就很容易把它当成猫。所以要多给它看好例子。' },
    { q: '我能帮 AI 变得更聪明吗？', a: '能呀！你告诉它哪里认错了，或者帮它把照片分好类，它就会慢慢学得更好。' }
  ]
};

/** 前两本 */
const STORIES = [S1, S2];
module.exports = { STORIES };
