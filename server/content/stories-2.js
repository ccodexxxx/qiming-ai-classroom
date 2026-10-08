
/* ============================================================
 * 三、《会说话的小音箱》—— AI 怎么听懂话
 * ============================================================ */
const S3 = {
  id: 'voice',
  title: '会说话的小音箱',
  emoji: '🔊',
  concept: 'ai-listen',
  conceptLabel: 'AI 怎么听懂话',
  intro: '说话的声音会变成一串波浪，机器就是从波浪里听出意思的。',
  cast: ['小雨', '小音箱'],
  pages: [
    {
      scene: 'speakerRoom', title: '桌上的小音箱',
      g1: ['桌上有一个小音箱。', '它会回答问题。'],
      g2: ['客厅的桌上放着一个小音箱。', '你问它问题，', '它就会回答你。'],
      g3: ['客厅的桌上放着一个小音箱。', '只要叫它一声，它就会答应，', '还能回答问题、播放儿歌。'],
      py1: 'zhuo1 shang4 you3 yi1 ge4 xiao3 yin1 xiang3 . ta1 hui4 hui2 da2 wen4 ti2 .',
      py2: 'ke4 ting1 de5 zhuo1 shang4 fang4 zhe5 yi1 ge4 xiao3 yin1 xiang3 . ni3 wen4 ta1 wen4 ti2 , ta1 jiu4 hui4 hui2 da2 ni3 .',
      py3: 'ke4 ting1 de5 zhuo1 shang4 fang4 zhe5 yi1 ge4 xiao3 yin1 xiang3 . zhi3 yao4 jiao4 ta1 yi1 sheng1 , ta1 jiu4 hui4 da1 ying5 , hai2 neng2 hui2 da2 wen4 ti2 , bo1 fang4 er2 ge1 .'
    },
    {
      scene: 'wave', title: '声音变成了波浪',
      g1: ['我们说话，声音在空气里跑。', '小音箱把它变成波浪。'],
      g2: ['我们说话的时候，', '声音在空气里一圈一圈地跑。', '小音箱把它变成一条波浪。'],
      g3: ['我们说话的时候，声音像水波一样在空气里跑。', '小音箱把这条波浪收下来，', '再把它画成一条高高低低的线。'],
      py1: 'wo3 men5 shuo1 hua4 , sheng1 yin1 zai4 kong1 qi4 li3 pao3 . xiao3 yin1 xiang3 ba3 ta1 bian4 cheng2 bo1 lang4 .',
      py2: 'wo3 men5 shuo1 hua4 de5 shi2 hou4 , sheng1 yin1 zai4 kong1 qi4 li3 yi1 quan1 yi1 quan1 de5 pao3 . xiao3 yin1 xiang3 ba3 ta1 bian4 cheng2 yi1 tiao2 bo1 lang4 .',
      py3: 'wo3 men5 shuo1 hua4 de5 shi2 hou4 , sheng1 yin1 xiang4 shui3 bo1 yi1 yang4 zai4 kong1 qi4 li3 pao3 . xiao3 yin1 xiang3 ba3 zhe4 tiao2 bo1 lang4 shou1 xia4 lai2 , zai4 ba3 ta1 hua4 cheng2 yi1 tiao2 gao1 gao1 di1 di1 de5 xian4 .'
    },
    {
      scene: 'split', title: '波浪切成小段',
      g1: ['波浪被切成一小段一小段。', '每一段是一个声音。'],
      g2: ['小音箱把波浪切成一小段一小段，', '每一小段就是一个声音，', '像「小」「雨」「你」「好」。'],
      g3: ['小音箱把这条长长的波浪切成一小段一小段，', '每一小段就是一个声音。', '合起来就变成了我们说的话。'],
      py1: 'bo1 lang4 bei4 qie1 cheng2 yi1 xiao3 duan4 yi1 xiao3 duan4 . mei3 yi1 duan4 shi4 yi1 ge4 sheng1 yin1 .',
      py2: 'xiao3 yin1 xiang3 ba3 bo1 lang4 qie1 cheng2 yi1 xiao3 duan4 yi1 xiao3 duan4 , mei3 yi1 xiao3 duan4 jiu4 shi4 yi1 ge4 sheng1 yin1 , xiang4 xiao3 yu3 ni3 hao3 .',
      py3: 'xiao3 yin1 xiang3 ba3 zhe4 tiao2 chang2 chang2 de5 bo1 lang4 qie1 cheng2 yi1 xiao3 duan4 yi1 xiao3 duan4 , mei3 yi1 xiao3 duan4 jiu4 shi4 yi1 ge4 sheng1 yin1 . he2 qi3 lai2 jiu4 bian4 cheng2 le5 wo3 men5 shuo1 de5 hua4 .'
    },
    {
      scene: 'match', title: '找到对应的字',
      g1: ['每一段声音，去找一个朋友。', '找到朋友就变成字。'],
      g2: ['每一段声音都去找一个朋友，', '找到那个朋友，', '声音就变成了字。'],
      g3: ['每一小段声音都要去找一个「朋友」。', '找到朋友，声音就变成了字；', '找错了，就会听错话。'],
      py1: 'mei3 yi1 duan4 sheng1 yin1 , qu4 zhao3 yi1 ge4 peng2 you3 . zhao3 dao4 peng2 you3 jiu4 bian4 cheng2 zi4 .',
      py2: 'mei3 yi1 duan4 sheng1 yin1 dou1 qu4 zhao3 yi1 ge4 peng2 you3 , zhao3 dao4 na4 ge5 peng2 you3 , sheng1 yin1 jiu4 bian4 cheng2 le5 zi4 .',
      py3: 'mei3 yi1 xiao3 duan4 sheng1 yin1 dou1 yao4 qu4 zhao3 yi1 ge4 peng2 you3 . zhao3 dao4 peng2 you3 , sheng1 yin1 jiu4 bian4 cheng2 le5 zi4 ; zhao3 cuo4 le5 , jiu4 hui4 ting1 cuo4 hua4 .'
    },
    {
      scene: 'nonsense', title: '它也会听错',
      g1: ['小雨说的是「小猫」。', '小音箱听成了「小毛」。'],
      g2: ['小雨说的是「我要听小猫」。', '小音箱却听成了「我要听小毛」。', '大家哈哈大笑。'],
      g3: ['小雨说的是「我要听小猫的歌」。', '小音箱却听成了「我要听小毛的歌」。', '它红着脸说：「对不起，我没听清。」'],
      py1: 'xiao3 yu3 shuo1 de5 shi4 xiao3 mao1 . xiao3 yin1 xiang3 ting1 cheng2 le5 xiao3 mao2 .',
      py2: 'xiao3 yu3 shuo1 de5 shi4 wo3 yao4 ting1 xiao3 mao1 . xiao3 yin1 xiang3 que4 ting1 cheng2 le5 wo3 yao4 ting1 xiao3 mao2 . da4 jia1 ha1 ha1 da4 xiao4 .',
      py3: 'xiao3 yu3 shuo1 de5 shi4 wo3 yao4 ting1 xiao3 mao1 de5 ge1 . xiao3 yin1 xiang3 que4 ting1 cheng2 le5 wo3 yao4 ting1 xiao3 mao2 de5 ge1 . ta1 hong2 zhe5 lian3 shuo1 : dui4 bu4 qi3 , wo3 mei2 ting1 qing1 .'
    },
    {
      scene: 'speakBack', title: '它也能说话',
      g1: ['小音箱会回答问题。', '它把字变成声音说出来。'],
      g2: ['小音箱的本领反过来用，', '就能把字变成声音，', '一句一句说给我们听。'],
      g3: ['把本领反过来用，小音箱就能把字变成声音。', '所以它不只会听，还会说话，', '能给我们读故事、报天气。'],
      py1: 'xiao3 yin1 xiang3 hui4 hui2 da2 wen4 ti2 . ta1 ba3 zi4 bian4 cheng2 sheng1 yin1 shuo1 chu1 lai2 .',
      py2: 'xiao3 yin1 xiang3 de5 ben3 ling3 fan3 guo4 lai2 yong4 , jiu4 neng2 ba3 zi4 bian4 cheng2 sheng1 yin1 , yi1 ju4 yi1 ju4 shuo1 gei3 wo3 men5 ting1 .',
      py3: 'ba3 ben3 ling3 fan3 guo4 lai2 yong4 , xiao3 yin1 xiang3 jiu4 neng2 ba3 zi4 bian4 cheng2 sheng1 yin1 . suo3 yi3 ta1 bu4 zhi3 hui4 ting1 , hai2 hui4 shuo1 hua4 , neng2 gei3 wo3 men5 du2 gu4 shi5 , bao4 tian1 qi4 .'
    },
    {
      scene: 'quiet', title: '说话要清楚',
      g1: ['说话慢一点，它听得更清楚。', '我们要好好说话。'],
      g2: ['说话的时候慢一点、清楚一点，', '它就能听得更准。', '我们要好好说话。'],
      g3: ['如果周围很吵，或者说得太快，小音箱就容易听错。', '说话的时候慢一点、清楚一点，', '它就能听得更准啦。'],
      py1: 'shuo1 hua4 man4 yi1 dian3 , ta1 ting1 de5 geng4 qing1 chu3 . wo3 men5 yao4 hao3 hao3 shuo1 hua4 .',
      py2: 'shuo1 hua4 de5 shi2 hou4 man4 yi1 dian3 , qing1 chu3 yi1 dian3 , ta1 jiu4 neng2 ting1 de5 geng4 zhun3 . wo3 men5 yao4 hao3 hao3 shuo1 hua4 .',
      py3: 'ru2 guo3 zhou1 wei2 hen3 chao3 , huo4 zhe3 shuo1 de5 tai4 kuai4 , xiao3 yin1 xiang3 jiu4 rong2 yi4 ting1 cuo4 . shuo1 hua4 de5 shi2 hou4 man4 yi1 dian3 , qing1 chu3 yi1 dian3 , ta1 jiu4 neng2 ting1 de5 geng4 zhun3 la1 .'
    }
  ],
  questions: [
    {
      after: 1,
      q: '小音箱先把声音变成什么？',
      options: ['一条波浪', '一张图画'],
      answer: 0,
      right: '对啦！声音会先变成一条高高低低的波浪。',
      wrong: '再看看这一页：声音在空气里跑，小音箱把它变成……'
    },
    {
      after: 4,
      q: '小音箱为什么会听错？',
      options: ['有的声音听起来太像了', '它不想听'],
      answer: 0,
      right: '你真棒！「猫」和「毛」听起来很像，机器也会搞混。',
      wrong: '它不是不想听哦～是两个声音太像了，机器分不清。'
    }
  ],
  mentor: [
    { q: '为什么小音箱能听懂我说话？', a: '因为你说话的声音会变成一条波浪，小音箱把波浪切成一小段一小段，每一段去找一个对应的字，连起来就知道你在说什么了。' },
    { q: '它为什么有时候听错？', a: '因为有些声音听起来很像，比如「猫」和「毛」。还有周围太吵、说得太快的时候，它也容易听错。' },
    { q: '它听得懂小猫叫吗？', a: '听不懂哦。小音箱只学过人说话的声音。小猫的叫声它没有学过，所以不知道是什么意思。' }
  ]
};

/* ============================================================
 * 四、《小启学认猫》—— AI 怎么学会的（需要人教、会犯错）
 * ============================================================ */
const S4 = {
  id: 'learn',
  title: '小启学认猫',
  emoji: '🎓',
  concept: 'ai-learn',
  conceptLabel: 'AI 怎么学会的',
  intro: 'AI 不是天生就会，要人给它看很多例子，它才会。',
  cast: ['小启', '小雨', '猫'],
  pages: [
    {
      scene: 'born', title: '刚出生的小启',
      g1: ['小启刚做好的时候，', '什么都不会。'],
      g2: ['小启刚刚做好的时候，', '它什么都不会。', '连猫是什么都不知道。'],
      g3: ['小启刚刚做好的时候，什么都不会。', '它不认识猫，不认识狗，', '也不认识小雨。'],
      py1: 'xiao3 qi3 gang1 zuo4 hao3 de5 shi2 hou4 , shen2 me5 dou1 bu2 hui4 .',
      py2: 'xiao3 qi3 gang1 gang1 zuo4 hao3 de5 shi2 hou4 , ta1 shen2 me5 dou1 bu2 hui4 . lian2 mao1 shi4 shen2 me5 dou1 bu4 zhi1 dao4 .',
      py3: 'xiao3 qi3 gang1 gang1 zuo4 hao3 de5 shi2 hou4 , shen2 me5 dou1 bu2 hui4 . ta1 bu2 ren4 shi5 mao1 , bu2 ren4 shi5 gou3 , ye3 bu2 ren4 shi5 xiao3 yu3 .'
    },
    {
      scene: 'showCats', title: '看很多猫',
      g1: ['小雨给它看猫的照片。', '一张、两张、三张……'],
      g2: ['小雨给小启看猫的照片，', '一张、两张、三张……', '看了好多好多张。'],
      g3: ['小雨把家里所有猫的照片都翻出来，', '一张一张地给小启看。', '「你看，这就是猫。」'],
      py1: 'xiao3 yu3 gei3 ta1 kan4 mao1 de5 zhao4 pian4 . yi1 zhang1 , liang3 zhang1 , san1 zhang1 … …',
      py2: 'xiao3 yu3 gei3 xiao3 qi3 kan4 mao1 de5 zhao4 pian4 , yi1 zhang1 , liang3 zhang1 , san1 zhang1 … … kan4 le5 hao3 duo1 hao3 duo1 zhang1 .',
      py3: 'xiao3 yu3 ba3 jia1 li3 suo3 you3 mao1 de5 zhao4 pian4 dou1 fan1 chu1 lai2 , yi1 zhang1 yi1 zhang1 de5 gei3 xiao3 qi3 kan4 . ni3 kan4 , zhe4 jiu4 shi4 mao1 .'
    },
    {
      scene: 'guessWrong', title: '第一次猜错了',
      g1: ['小启说：这是狗！', '小雨说：不对，这是猫。'],
      g2: ['小启看着照片说：「这是狗！」', '小雨笑着说：', '「不对哦，这是猫。你看它的耳朵。」'],
      g3: ['小启看着照片大声说：「这是狗！」', '小雨笑着说：「不对哦，这是猫。」', '「你仔细看，猫的耳朵是尖尖的。」'],
      py1: 'xiao3 qi3 shuo1 : zhe4 shi4 gou3 ! xiao3 yu3 shuo1 : bu2 dui4 , zhe4 shi4 mao1 .',
      py2: 'xiao3 qi3 kan4 zhe5 zhao4 pian4 shuo1 : zhe4 shi4 gou3 ! xiao3 yu3 xiao4 zhe5 shuo1 : bu2 dui4 o5 , zhe4 shi4 mao1 . ni3 kan4 ta1 de5 er3 duo5 .',
      py3: 'xiao3 qi3 kan4 zhe5 zhao4 pian4 da4 sheng1 shuo1 : zhe4 shi4 gou3 ! xiao3 yu3 xiao4 zhe5 shuo1 : bu2 dui4 o5 , zhe4 shi4 mao1 . ni3 zi3 xi4 kan4 , mao1 de5 er3 duo5 shi4 jian1 jian1 de5 .'
    },
    {
      scene: 'more', title: '再看一遍',
      g1: ['小雨说：再看一遍。', '这次小启看对了。'],
      g2: ['小雨说：「那再看一遍吧。」', '这次小启认真地看，', '它说：「我知道了，这是猫！」'],
      g3: ['小雨说：「没关系，那再看一遍吧。」', '这一次小启认真地看耳朵和胡须，', '它高兴地说：「我知道了，这是猫！」'],
      py1: 'xiao3 yu3 shuo1 : zai4 kan4 yi1 bian4 . zhe4 ci4 xiao3 qi3 kan4 dui4 le5 .',
      py2: 'xiao3 yu3 shuo1 : na4 zai4 kan4 yi1 bian4 ba5 . zhe4 ci4 xiao3 qi3 ren4 zhen1 de5 kan4 , ta1 shuo1 : wo3 zhi1 dao4 le5 , zhe4 shi4 mao1 !',
      py3: 'xiao3 yu3 shuo1 : mei2 guan1 xi5 , na4 zai4 kan4 yi1 bian4 ba5 . zhe4 yi1 ci4 xiao3 qi3 ren4 zhen1 de5 kan4 er3 duo5 he2 hu2 xu1 , ta1 gao1 xing4 de5 shuo1 : wo3 zhi1 dao4 le5 , zhe4 shi4 mao1 !'
    },
    {
      scene: 'many', title: '看得越多越准',
      g1: ['白猫、黑猫、花猫，', '小启都认识啦。'],
      g2: ['白猫、黑猫、花猫，', '还有胖猫和瘦猫，', '小启都能认出来。'],
      g3: ['白猫、黑猫、花猫，还有胖猫和瘦猫，', '小启都能认出来。', '因为它见过的猫越来越多啦。'],
      py1: 'bai2 mao1 , hei1 mao1 , hua1 mao1 , xiao3 qi3 dou1 ren4 shi5 la1 .',
      py2: 'bai2 mao1 , hei1 mao1 , hua1 mao1 , hai2 you3 pang4 mao1 he2 shou4 mao1 , xiao3 qi3 dou1 neng2 ren4 chu1 lai2 .',
      py3: 'bai2 mao1 , hei1 mao1 , hua1 mao1 , hai2 you3 pang4 mao1 he2 shou4 mao1 , xiao3 qi3 dou1 neng2 ren4 chu1 lai2 . yin1 wei4 ta1 jian4 guo4 de5 mao1 yue4 lai2 yue4 duo1 la1 .'
    },
    {
      scene: 'bias', title: '没见过白猫',
      g1: ['如果只看过黑猫，', '它就不认识白猫了。'],
      g2: ['如果小雨只给它看过黑猫，', '那见到白猫的时候，', '小启就认不出来了。'],
      g3: ['假如小雨只给它看过黑猫，', '那么第一次见到白猫的时候，', '小启就会说：「这是什么呀？我没见过。」'],
      py1: 'ru2 guo3 zhi3 kan4 guo4 hei1 mao1 , ta1 jiu4 bu2 ren4 shi5 bai2 mao1 le5 .',
      py2: 'ru2 guo3 xiao3 yu3 zhi3 gei3 ta1 kan4 guo4 hei1 mao1 , na4 jian4 dao4 bai2 mao1 de5 shi2 hou4 , xiao3 qi3 jiu4 ren4 bu4 chu1 lai2 le5 .',
      py3: 'jia3 ru2 xiao3 yu3 zhi3 gei3 ta1 kan4 guo4 hei1 mao1 , na4 me5 di4 yi1 ci4 jian4 dao4 bai2 mao1 de5 shi2 hou4 , xiao3 qi3 jiu4 hui4 shuo1 : zhe4 shi4 shen2 me5 ya5 ? wo3 mei2 jian4 guo4 .'
    },
    {
      scene: 'together', title: '一起教它',
      g1: ['我们教它，它才会。', '人和小启一起学习。'],
      g2: ['小启不是天生就会的，', '是我们一点一点教它的。', '人和小启一起学习。'],
      g3: ['小启的本领不是天生的，', '是人给它看了很多例子，它才慢慢学会的。', '所以我们能教它，也要对它负责。'],
      py1: 'wo3 men5 jiao1 ta1 , ta1 cai2 hui4 . ren2 he2 xiao3 qi3 yi1 qi3 xue2 xi2 .',
      py2: 'xiao3 qi3 bu2 shi4 tian1 sheng1 jiu4 hui4 de5 , shi4 wo3 men5 yi1 dian3 yi1 dian3 jiao1 ta1 de5 . ren2 he2 xiao3 qi3 yi1 qi3 xue2 xi2 .',
      py3: 'xiao3 qi3 de5 ben3 ling3 bu2 shi4 tian1 sheng1 de5 , shi4 ren2 gei3 ta1 kan4 le5 hen3 duo1 li4 zi5 , ta1 cai2 man4 man4 xue2 hui4 de5 . suo3 yi3 wo3 men5 neng2 jiao1 ta1 , ye3 yao4 dui4 ta1 fu4 ze2 .'
    }
  ],
  questions: [
    {
      after: 1,
      q: '小启刚做好的时候会认猫吗？',
      options: ['不会，要人教它', '天生就会'],
      answer: 0,
      right: '答对啦！小启刚做好的时候什么都不会。',
      wrong: '再读一遍这一页：小启刚做好的时候，连猫是什么都不知道。'
    },
    {
      after: 5,
      q: '如果只给小启看黑猫，它会认白猫吗？',
      options: ['不会，它没见过', '会，它很聪明'],
      answer: 0,
      right: '你太厉害了！AI 只认识它学过的东西。',
      wrong: '想一想～没见过的东西，小启怎么会认识呢？'
    }
  ],
  mentor: [
    { q: 'AI 是怎么学会认猫的？', a: '人给它看了很多猫的照片，也给它看了很多不是猫的照片。看得多了，它就慢慢找到猫的「特别之处」，以后见到新的猫也能认出来。' },
    { q: '为什么 AI 只认识它学过的东西？', a: '因为它学到的就是那些例子。就像你只见过黑色的猫，第一次见到白猫也会愣一下。所以给它看的例子要越多、越丰富越好。' },
    { q: 'AI 会自己偷偷学习吗？', a: '不会哦。它要人给它数据、按下开始，才会学。学什么、学多久，都是人决定的。' }
  ]
};

/* ============================================================
 * 五、《我和小启》—— 人和 AI 的关系（人创造、人控制、人负责）
 * ============================================================ */
const S5 = {
  id: 'me',
  title: '我和小启',
  emoji: '💛',
  concept: 'ai-me',
  conceptLabel: '我和 AI 的关系',
  intro: 'AI 是人做出来的，人说了算，人也要负责任。',
  cast: ['小雨', '小启', '妈妈'],
  pages: [
    {
      scene: 'made', title: '小启是谁做的',
      g1: ['小启是人做出来的。', '工人叔叔把它装好。'],
      g2: ['小启不是从天上掉下来的，', '是很多叔叔阿姨一起做出来的。', '他们写了程序，小启才会做事。'],
      g3: ['小启不是从天上掉下来的。', '是很多叔叔阿姨一起设计、一起做出来的，', '还给它写了很长很长的程序。'],
      py1: 'xiao3 qi3 shi4 ren2 zuo4 chu1 lai2 de5 . gong1 ren2 shu1 shu5 ba3 ta1 zhuang1 hao3 .',
      py2: 'xiao3 qi3 bu2 shi4 cong2 tian1 shang4 diao4 xia4 lai2 de5 , shi4 hen3 duo1 shu1 shu5 a1 yi2 yi1 qi3 zuo4 chu1 lai2 de5 . ta1 men5 xie3 le5 cheng2 xu4 , xiao3 qi3 cai2 hui4 zuo4 shi4 .',
      py3: 'xiao3 qi3 bu2 shi4 cong2 tian1 shang4 diao4 xia4 lai2 de5 . shi4 hen3 duo1 shu1 shu5 a1 yi2 yi1 qi3 she4 ji4 , yi1 qi3 zuo4 chu1 lai2 de5 , hai2 gei3 ta1 xie3 le5 hen3 chang2 hen3 chang2 de5 cheng2 xu4 .'
    },
    {
      scene: 'command', title: '小启听我们的话',
      g1: ['小雨说：请安静。', '小启马上安静了。'],
      g2: ['小雨说：「小启，请安静。」', '小启马上就安静下来，', '一动也不动。'],
      g3: ['小雨说：「小启，请安静一会儿。」', '小启马上就安静下来，一动也不动。', '它总是听人的话。'],
      py1: 'xiao3 yu3 shuo1 : qing3 an1 jing4 . xiao3 qi3 ma3 shang4 an1 jing4 le5 .',
      py2: 'xiao3 yu3 shuo1 : xiao3 qi3 , qing3 an1 jing4 . xiao3 qi3 ma3 shang4 jiu4 an1 jing4 xia4 lai2 , yi1 dong4 ye3 bu2 dong4 .',
      py3: 'xiao3 yu3 shuo1 : xiao3 qi3 , qing3 an1 jing4 yi1 hui4 er5 . xiao3 qi3 ma3 shang4 jiu4 an1 jing4 xia4 lai2 , yi1 dong4 ye3 bu2 dong4 . ta1 zong3 shi4 ting1 ren2 de5 hua4 .'
    },
    {
      scene: 'noFeeling', title: '小启没有感情',
      g1: ['小启不会真的伤心。', '它只是照着程序做。'],
      g2: ['小启不会真的开心，', '也不会真的难过。', '它只是照着程序做出样子。'],
      g3: ['小启不会真的开心，也不会真的难过。', '它只是照着程序做出样子。', '真正会开心、会难过的，是我们。'],
      py1: 'xiao3 qi3 bu2 hui4 zhen1 de5 shang1 xin1 . ta1 zhi3 shi4 zhao4 zhe5 cheng2 xu4 zuo4 .',
      py2: 'xiao3 qi3 bu2 hui4 zhen1 de5 kai1 xin1 , ye3 bu2 hui4 zhen1 de5 nan2 guo4 . ta1 zhi3 shi4 zhao4 zhe5 cheng2 xu4 zuo4 chu1 yang4 zi5 .',
      py3: 'xiao3 qi3 bu2 hui4 zhen1 de5 kai1 xin1 , ye3 bu2 hui4 zhen1 de5 nan2 guo4 . ta1 zhi3 shi4 zhao4 zhe5 cheng2 xu4 zuo4 chu1 yang4 zi5 . zhen1 zheng4 hui4 kai1 xin1 , hui4 nan2 guo4 de5 , shi4 wo3 men5 .'
    },
    {
      scene: 'goodUse', title: '用来做好事',
      g1: ['小启可以帮我们很多忙。', '我们要用它做好事。'],
      g2: ['小启可以帮我们找东西、讲故事，', '还能帮医生看片子。', '我们要用它做好事。'],
      g3: ['小启可以帮我们找东西、讲故事，', '还能帮医生看片子、帮农民看庄稼。', '本领越大，越要用在好的地方。'],
      py1: 'xiao3 qi3 ke3 yi3 bang1 wo3 men5 hen3 duo1 mang2 . wo3 men5 yao4 yong4 ta1 zuo4 hao3 shi4 .',
      py2: 'xiao3 qi3 ke3 yi3 bang1 wo3 men5 zhao3 dong1 xi5 , jiang3 gu4 shi5 , hai2 neng2 bang1 yi1 sheng1 kan4 pian4 zi5 . wo3 men5 yao4 yong4 ta1 zuo4 hao3 shi4 .',
      py3: 'xiao3 qi3 ke3 yi3 bang1 wo3 men5 zhao3 dong1 xi5 , jiang3 gu4 shi5 , hai2 neng2 bang1 yi1 sheng1 kan4 pian4 zi5 , bang1 nong2 min2 kan4 zhuang1 jia1 . ben3 ling3 yue4 da4 , yue4 yao4 yong4 zai4 hao3 de5 di4 fang5 .'
    },
    {
      scene: 'protect', title: '保护好信息',
      g1: ['家里的事不告诉它。', '名字和地址不能随便说。'],
      g2: ['家里的秘密不能随便告诉它，', '名字、住址、密码', '都不能随便说出来。'],
      g3: ['家里的秘密不能随便告诉它。', '名字、住址、密码这些信息，', '都不能随便说给机器听。'],
      py1: 'jia1 li3 de5 shi4 bu2 gao4 su4 ta1 . ming2 zi5 he2 di4 zhi3 bu4 neng2 sui2 bian4 shuo1 .',
      py2: 'jia1 li3 de5 mi4 mi4 bu4 neng2 sui2 bian4 gao4 su4 ta1 , ming2 zi5 , zhu4 zhi3 , mi4 ma3 dou1 bu4 neng2 sui2 bian4 shuo1 chu1 lai2 .',
      py3: 'jia1 li3 de5 mi4 mi4 bu4 neng2 sui2 bian4 gao4 su4 ta1 . ming2 zi5 , zhu4 zhi3 , mi4 ma3 zhe4 xie1 xin4 xi1 , dou1 bu4 neng2 sui2 bian4 shuo1 gei3 ji1 qi4 ting1 .'
    },
    {
      scene: 'askAdult', title: '有事先问大人',
      g1: ['看不懂的时候，', '去问爸爸妈妈和老师。'],
      g2: ['如果它说的话你看不懂，', '或者觉得有点奇怪，', '就去问爸爸妈妈和老师。'],
      g3: ['如果它说的话你看不懂，或者让你觉得不舒服，', '就停下来，去问爸爸妈妈和老师。', '大人会帮你判断。'],
      py1: 'kan4 bu4 dong3 de5 shi2 hou4 , qu4 wen4 ba4 ba5 ma1 ma5 he2 lao3 shi1 .',
      py2: 'ru2 guo3 ta1 shuo1 de5 hua4 ni3 kan4 bu4 dong3 , huo4 zhe3 jue2 de5 you3 dian3 qi2 guai4 , jiu4 qu4 wen4 ba4 ba5 ma1 ma5 he2 lao3 shi1 .',
      py3: 'ru2 guo3 ta1 shuo1 de5 hua4 ni3 kan4 bu4 dong3 , huo4 zhe3 rang4 ni3 jue2 de5 bu2 shu4 fu5 , jiu4 ting2 xia4 lai2 , qu4 wen4 ba4 ba5 ma1 ma5 he2 lao3 shi1 . da4 ren2 hui4 bang1 ni3 pan4 duan4 .'
    },
    {
      scene: 'handInHand', title: '人和小启一起',
      g1: ['小启帮我们，我们教小启。', '我们一起长大。'],
      g2: ['小启帮我们做事，', '我们教小启变得更聪明，', '人和小启一起长大。'],
      g3: ['小启帮我们做事，我们教小启变得更好。', '谁创造它、谁使用它，', '谁就要对它负责。'],
      py1: 'xiao3 qi3 bang1 wo3 men5 , wo3 men5 jiao1 xiao3 qi3 . wo3 men5 yi1 qi3 zhang3 da4 .',
      py2: 'xiao3 qi3 bang1 wo3 men5 zuo4 shi4 , wo3 men5 jiao1 xiao3 qi3 bian4 de5 geng4 cong1 ming2 , ren2 he2 xiao3 qi3 yi1 qi3 zhang3 da4 .',
      py3: 'xiao3 qi3 bang1 wo3 men5 zuo4 shi4 , wo3 men5 jiao1 xiao3 qi3 bian4 de5 geng4 hao3 . shei2 chuang4 zao4 ta1 , shei2 shi3 yong4 ta1 , shei2 jiu4 yao4 dui4 ta1 fu4 ze2 .'
    }
  ],
  questions: [
    {
      after: 1,
      q: '小启是谁做出来的？',
      options: ['人做出来的', '它自己长出来的'],
      answer: 0,
      right: '说得对！小启是人设计和做出来的。',
      wrong: '再读一遍～小启不是从天上掉下来的哦。'
    },
    {
      after: 2,
      q: '小启会真的难过吗？',
      options: ['不会，它没有感情', '会，它很伤心'],
      answer: 0,
      right: '你真会思考！小启只是照着程序做样子。',
      wrong: '想一想～真正会开心难过的，是我们呀。'
    }
  ],
  mentor: [
    { q: '小启会难过吗？', a: '不会真的难过。它做出难过的样子，是因为程序让它这么做。真正有感情的是我们，所以我们要互相照顾。' },
    { q: '我能把家里的事情告诉小启吗？', a: '不能随便说哦。名字、住址、密码这些都不能说给机器听。如果要告诉它什么，先问问爸爸妈妈。' },
    { q: 'AI 会不会比我厉害？', a: '它算得比你快、记得比你多，但它不会开心、不会心疼别人，也不会自己想做件好事。这些是你最厉害的地方。' }
  ]
};

/** 第三、四、五本（前两本在 stories-1.js） */
const STORIES = [S3, S4, S5];
module.exports = { STORIES };
