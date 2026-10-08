/**
 * AI 启蒙绘本 · 故事脚本（第四批）
 */
'use strict';

/* ============================================================
 * 七、《小AI 躲在哪里》—— AI 在哪里
 * ============================================================ */
const S7 = {
  id: 'where', title: '小AI 躲在哪里', emoji: '🏠',
  concept: 'ai-where', conceptLabel: 'AI 在哪里',
  interests: ['生活', '动物'],
  logline: '点点以为小AI 只有一个，找了一圈才发现到处都是它的兄弟姐妹。',
  cast: ['dian', 'ai', 'dou'],
  pages: [
    {
      mood: 'curious', beat: 'curious', scene: 'where1',
      title: '小AI 不见了',
      g1: ['点点找不到小AI 了。'], g2: ['点点起床后，', '发现小AI 不见了。'],
      g3: ['点点起床后，发现小AI 不见了。', '桌上只剩一张小纸条：我去串门啦。'],
      py1: 'dian3 dian5 zhao3 bu2 dao4 xiao3 AI le5 .',
      py2: 'dian3 dian5 qi3 chuang2 hou4 , fa1 xian4 xiao3 AI bu2 jian4 le5 .',
      py3: 'dian3 dian5 qi3 chuang2 hou4 , fa1 xian4 xiao3 AI bu2 jian4 le5 . zhuo1 shang4 zhi3 sheng4 yi1 zhang1 xiao3 zhi3 tiao2 : wo3 qu4 chuan4 men2 la1 .',
      say: { who: 'dian', text: '咦？它跑去哪儿了？', expr: 'wonder' },
      action: { type: 'tap', target: '小纸条', hint: '点一点桌上的纸条', ok: '纸条上写着：我去串门啦。', sfx: 'pop' },
      fx: '纸「沙」的一声'
    },
    {
      mood: 'wonder', beat: 'clue', scene: 'where2',
      title: '客厅里的音箱',
      g1: ['客厅的音箱会回答点点。'], g2: ['客厅的音箱听见了，', '居然回答了点点。'],
      g3: ['客厅的音箱听见点点说话，居然回答了。', '点点惊讶地睁大了眼睛。'],
      py1: 'ke4 ting1 de5 yin1 xiang3 hui4 hui2 da2 dian3 dian5 .',
      py2: 'ke4 ting1 de5 yin1 xiang3 ting1 jian4 le5 , ju1 ran2 hui2 da2 le5 dian3 dian5 .',
      py3: 'ke4 ting1 de5 yin1 xiang3 ting1 jian4 dian3 dian5 shuo1 hua4 , ju1 ran2 hui2 da2 le5 . dian3 dian5 jing1 ya4 de5 zheng1 da4 le5 yan3 jing5 .',
      say: { who: 'ai', text: '（音箱里传出声音）我也在呀！', expr: 'happy' },
      action: { type: 'clap', hint: '拍一下手，看音箱有没有反应', ok: '音箱亮了亮：我听见啦。', sfx: 'clap' },
      fx: '「叮」的唤醒音'
    },
    {
      mood: 'curious', beat: 'clue', scene: 'where3',
      title: '门口的摄像头',
      g1: ['门口的摄像头也在看。'], g2: ['门口的摄像头看见点点出来，', '轻轻闪了一下。'],
      g3: ['门口的摄像头看见点点出来，轻轻闪了一下。', '它认出了这是点点，不是别人。'],
      py1: 'men2 kou3 de5 she4 xiang4 tou2 ye3 zai4 kan4 .',
      py2: 'men2 kou3 de5 she4 xiang4 tou2 kan4 jian4 dian3 dian5 chu1 lai2 , qing1 qing1 shan3 le5 yi1 xia4 .',
      py3: 'men2 kou3 de5 she4 xiang4 tou2 kan4 jian4 dian3 dian5 chu1 lai2 , qing1 qing1 shan3 le5 yi1 xia4 . ta1 ren4 chu1 le5 zhe4 shi4 dian3 dian5 , bu2 shi4 bie2 ren2 .',
      say: { who: 'dian', text: '你也在看呀！', expr: 'star' },
      action: { type: 'find', hint: '找出画面里所有会「看」的东西', ok: '找到了！摄像头在看，台灯在听。', sfx: 'ding' },
      fx: '摄像头「嚓」对焦'
    },
    {
      mood: 'happy', beat: 'clue3', scene: 'where4',
      title: '扫地的小圆盘',
      g1: ['扫地的小圆盘自己会转弯。'], g2: ['扫地的小圆盘遇到桌腿，', '自己就转弯了。'],
      g3: ['扫地的小圆盘遇到桌腿，自己就转弯了。', '点点跟着它走了一圈。'],
      py1: 'sao3 di4 de5 xiao3 yuan2 pan2 zi4 ji3 hui4 zhuan3 wan1 .',
      py2: 'sao3 di4 de5 xiao3 yuan2 pan2 yu4 dao4 zhuo1 tui3 , zi4 ji3 jiu4 zhuan3 wan1 le5 .',
      py3: 'sao3 di4 de5 xiao3 yuan2 pan2 yu4 dao4 zhuo1 tui3 , zi4 ji3 jiu4 zhuan3 wan1 le5 . dian3 dian5 gen1 zhe5 ta1 zou3 le5 yi1 quan1 .',
      say: { who: 'dian', text: '它怎么知道前面有桌腿？　对不起，我找不到它了……你能帮我一起找吗？', expr: 'wonder' },
      action: { type: 'drag', hint: '把桌腿拖到小圆盘前面，看它转弯', ok: '它灵活地绕过去了！', sfx: 'whoosh' },
      fx: '小圆盘「嗡嗡」转动'
    },
    {
      mood: 'wonder', beat: 'clue4', scene: 'where5',
      title: '手机里也有',
      g1: ['妈妈的手机里也有小AI。'], g2: ['妈妈的手机里也有一个，', '会说话、会认照片。'],
      g3: ['妈妈的手机里也有一个，会说话、会认照片。', '它还会帮妈妈找出去年拍的图片。'],
      py1: 'ma1 ma1 de5 shou3 ji1 li3 ye3 you3 xiao3 AI .',
      py2: 'ma1 ma1 de5 shou3 ji1 li3 ye3 you3 yi1 ge4 , hui4 shuo1 hua4 , hui4 ren4 zhao4 pian4 .',
      py3: 'ma1 ma1 de5 shou3 ji1 li3 ye3 you3 yi1 ge4 , hui4 shuo1 hua4 , hui4 ren4 zhao4 pian4 . ta1 hai2 hui4 bang1 ma1 ma1 zhao3 chu1 qu4 nian2 pai1 de5 tu2 pian4 .',
      say: { who: 'ai', text: '（手机里）我们是一家人呀！', expr: 'laugh' },
      action: { type: 'tap', target: '手机', hint: '点一点手机屏幕', ok: '屏幕亮起来：你好呀！', sfx: 'chime' },
      fx: '手机「叮咚」提示音'
    },
    {
      mood: 'thinking', beat: 'idea', scene: 'where6',
      title: '原来到处都是',
      g1: ['点点发现到处都是小AI。'], g2: ['点点发现，', '到处都有小AI 的兄弟姐妹。'],
      g3: ['点点发现，到处都有小AI 的兄弟姐妹。', '它们有的会听，有的会看，有的会跑。'],
      py1: 'dian3 dian5 fa1 xian4 dao4 chu4 dou1 shi4 xiao3 AI .',
      py2: 'dian3 dian5 fa1 xian4 , dao4 chu4 dou1 you3 xiao3 AI de5 xiong1 di4 jie3 mei4 .',
      py3: 'dian3 dian5 fa1 xian4 , dao4 chu4 dou1 you3 xiao3 AI de5 xiong1 di4 jie3 mei4 . ta1 men5 you3 de5 hui4 ting1 , you3 de5 hui4 kan4 , you3 de5 hui4 pao3 .',
      say: { who: 'dian', text: '它们长得都不一样，可是都会帮忙！', expr: 'star' },
      action: { type: 'find', hint: '数一数画面里有几个会帮忙的小家伙', ok: '一共找到四个！', sfx: 'ding' },
      fx: '「哇——」的惊叹'
    },
    {
      mood: 'curious', beat: 'problem', scene: 'where7',
      title: '它们都在听吗',
      g1: ['点点有点担心。'], g2: ['点点忽然想：', '它们是不是一直在听我说话？'],
      g3: ['点点忽然想：它们是不是一直在听我说话？', '它有点不放心。'],
      py1: 'dian3 dian5 you3 dian3 dan1 xin1 .',
      py2: 'dian3 dian5 hu1 ran2 xiang3 : ta1 men5 shi4 bu2 shi4 yi1 zhi2 zai4 ting1 wo3 shuo1 hua4 ?',
      py3: 'dian3 dian5 hu1 ran2 xiang3 : ta1 men5 shi4 bu2 shi4 yi1 zhi2 zai4 ting1 wo3 shuo1 hua4 ? ta1 you3 dian3 bu2 fang4 xin1 .',
      say: { who: 'dian', text: '我说的话，它们都记住了吗？', expr: 'worried' },
      action: { type: 'choose', q: '家里的事情，可以随便说给它们听吗？', options: ['不可以，要先问大人', '可以，它们是好朋友'], answer: 0,
        right: '你真懂事！名字、住址、密码都不能随便说。', wrong: '再想想：有些不方便说的话，要先问爸爸妈妈。', sfx: 'soft' },
      fx: '安静下来的「嘀」'
    },
    {
      mood: 'success', beat: 'success', scene: 'where8',
      title: '妈妈告诉它',
      g1: ['妈妈说：它们只在叫它的时候听。'], g2: ['妈妈说：它们只在被叫到的时候听，', '而且不能随便说秘密。'],
      g3: ['妈妈说：它们只在被叫到的时候才会认真听。', '名字、住址、密码，都不要说给它们听。'],
      py1: 'ma1 ma1 shuo1 : ta1 men5 zhi3 zai4 jiao4 ta1 de5 shi2 hou4 ting1 .',
      py2: 'ma1 ma1 shuo1 : ta1 men5 zhi3 zai4 bei4 jiao4 dao4 de5 shi2 hou4 ting1 , er2 qie3 bu4 neng2 sui2 bian4 shuo1 mi4 mi4 .',
      py3: 'ma1 ma1 shuo1 : ta1 men5 zhi3 zai4 bei4 jiao4 dao4 de5 shi2 hou4 cai2 hui4 ren4 zhen1 ting1 . ming2 zi5 , zhu4 zhi3 , mi4 ma3 , dou1 bu4 yao4 shuo1 gei3 ta1 men5 ting1 .',
      say: { who: 'dian', text: '我知道啦，我会小心的。', expr: 'happy' },
      action: { type: 'say', keyword: '我会小心', hint: '跟着说一遍：我会小心', ok: '妈妈摸了摸点点的头。', sfx: 'warm' },
      fx: '温和的「叮」'
    },
    {
      mood: 'wonder', beat: 'clue', scene: 'where8b',
      title: '它们各有各的本领',
      g1: ['音箱会听，摄像头会看。', '小圆盘会跑。'],
      g2: ['音箱会听，摄像头会看，', '小圆盘会自己跑。', '它们各有各的本领。'],
      g3: ['音箱会听，摄像头会看，小圆盘会自己跑。', '它们各有各的本领，', '合起来就能帮我们做很多事。'],
      py1: 'yin1 xiang3 hui4 ting1 , she4 xiang4 tou2 hui4 kan4 . xiao3 yuan2 pan2 hui4 pao3 .',
      py2: 'yin1 xiang3 hui4 ting1 , she4 xiang4 tou2 hui4 kan4 , xiao3 yuan2 pan2 hui4 zi4 ji3 pao3 . ta1 men5 ge4 you3 ge4 de5 ben3 ling3 .',
      py3: 'yin1 xiang3 hui4 ting1 , she4 xiang4 tou2 hui4 kan4 , xiao3 yuan2 pan2 hui4 zi4 ji3 pao3 . ta1 men5 ge4 you3 ge4 de5 ben3 ling3 , he2 qi3 lai2 jiu4 neng2 bang1 wo3 men5 zuo4 hen3 duo1 shi4 .',
      say: { who: 'ai', text: '我们合起来，本事就更大啦！', expr: 'star' },
      action: { type: 'tap', target: '它们', hint: '点一点它们，看看各自的本领', ok: '它们一起亮了起来。', sfx: 'cheer' },
      fx: '「叮叮咚咚」齐声响应'
    },
    {
      mood: 'warm', beat: 'gift', scene: 'where9',
      title: '小AI 回来啦',
      g1: ['小AI 从外面回来了。'], g2: ['小AI 从外面回来了，', '身上还带着一点点灰。'],
      g3: ['小AI 从外面回来了，身上还带着一点点灰。', '它说：我认识了好多兄弟姐妹！'],
      py1: 'xiao3 AI cong2 wai4 mian4 hui2 lai2 le5 .',
      py2: 'xiao3 AI cong2 wai4 mian4 hui2 lai2 le5 , shen1 shang4 hai2 dai4 zhe5 yi1 dian3 dian3 hui1 .',
      py3: 'xiao3 AI cong2 wai4 mian4 hui2 lai2 le5 , shen1 shang4 hai2 dai4 zhe5 yi1 dian3 dian3 hui1 . ta1 shuo1 : wo3 ren4 shi5 le5 hao3 duo1 xiong1 di4 jie3 mei4 !',
      say: { who: 'ai', text: '不过，我还是最喜欢回你家。　找到啦！是我们一起找到的！', expr: 'shy' },
      action: { type: 'tap', target: '小AI', hint: '抱抱回来的小AI', ok: '小AI 蹭了蹭你的手心。', sfx: 'heart' },
      fx: '温柔的收尾'
    }
  ],
  questions: [
    { after: 2, q: '下面哪个地方也有会帮忙的小家伙？', options: ['音箱、摄像头、手机里都有', '只有一个地方有'], answer: 0,
      right: '没错，它们藏在家里好多地方。', wrong: '再想想：点点在几个地方遇到了它们？' },
    { after: 6, q: '家里的事情，可以随便说给它们听吗？', options: ['不可以，要先问大人', '可以随便说'], answer: 0,
      right: '你真懂事！这是保护自己。', wrong: '名字、住址、密码，都不能随便说哦。' }
  ],
  mentor: [
    { q: 'AI 都藏在哪里呀？', a: '家里好多地方都有：会回答的音箱、会看的摄像头、自己会转弯的扫地小圆盘、妈妈的手机里。它们长得不一样，可是都会帮忙。' },
    { q: '它们一直在听我说话吗？', a: '不是的。它们只在被叫到的时候才认真听，比如你叫它一声。平时它们就安安静静待着。' },
    { q: '我能把家里的事告诉它们吗？', a: '不能随便说哦。名字、住址、密码这些都不能说给它们听。如果有人让你说，先去问爸爸妈妈。' }
  ]
};

/* ============================================================
 * 八、《我和小AI》—— 人和 AI 的关系
 * ============================================================ */
const S8 = {
  id: 'us', title: '我和小AI', emoji: '🤝',
  concept: 'ai-me', conceptLabel: '人和 AI 的关系',
  interests: ['朋友', '生活'],
  logline: '小AI 病了，点点学会了照顾它，也明白了谁才是要负责的那一个。',
  cast: ['dian', 'ai'],
  pages: [
    {
      mood: 'happy', beat: 'curious', scene: 'us1',
      title: '我们是搭档',
      g1: ['点点和小AI 是搭档。'], g2: ['点点和小AI 是搭档，', '一个想主意，一个帮忙做。'],
      g3: ['点点和小AI 是搭档：一个想主意，一个帮忙做。', '它们配合得刚刚好。'],
      py1: 'dian3 dian5 he2 xiao3 AI shi4 da1 dang4 .',
      py2: 'dian3 dian5 he2 xiao3 AI shi4 da1 dang4 , yi1 ge4 xiang3 zhu3 yi4 , yi1 ge4 bang1 mang2 zuo4 .',
      py3: 'dian3 dian5 he2 xiao3 AI shi4 da1 dang4 : yi1 ge4 xiang3 zhu3 yi4 , yi1 ge4 bang1 mang2 zuo4 . ta1 men5 pei4 he2 de5 gang1 gang1 hao3 .',
      say: { who: 'ai', text: '你想，我做！', expr: 'star' },
      action: { type: 'tap', target: '它们', hint: '点一点它们，打个招呼', ok: '它们一起挥了挥手。', sfx: 'giggle' },
      fx: '轻快的「叮咚」'
    },
    {
      mood: 'happy', beat: 'idea', scene: 'us2',
      title: '一起搭城堡',
      g1: ['它们一起搭积木城堡。'], g2: ['小AI 负责找积木，', '点点负责搭起来。'],
      g3: ['小AI 负责找积木，点点负责搭起来。', '城堡越来越高，都快到桌子边了。'],
      py1: 'ta1 men5 yi1 qi3 da1 ji1 mu4 cheng2 bao3 .',
      py2: 'xiao3 AI fu4 ze2 zhao3 ji1 mu4 , dian3 dian5 fu4 ze2 da1 qi3 lai2 .',
      py3: 'xiao3 AI fu4 ze2 zhao3 ji1 mu4 , dian3 dian5 fu4 ze2 da1 qi3 lai2 . cheng2 bao3 yue4 lai2 yue4 gao1 , kuai4 dou1 dao4 zhuo1 zi5 bian1 le5 .',
      say: { who: 'dian', text: '还差一块红色的！', expr: 'happy' },
      action: { type: 'drag', hint: '把红色积木拖到城堡顶上', ok: '城堡搭好啦！', sfx: 'pop' },
      fx: '积木「咔」扣上'
    },
    {
      mood: 'worried', beat: 'problem', scene: 'us3',
      title: '小AI 不亮了',
      g1: ['小AI 忽然不亮了。'], g2: ['小AI 忽然晃了晃，', '灯灭了，', '一动不动。'],
      g3: ['小AI 忽然晃了晃，灯灭了，一动不动。', '点点叫它，它也没有回答。'],
      py1: 'xiao3 AI hu1 ran2 bu2 liang4 le5 .',
      py2: 'xiao3 AI hu1 ran2 huang4 le5 huang4 , deng1 mie4 le5 , yi1 dong4 bu2 dong4 .',
      py3: 'xiao3 AI hu1 ran2 huang4 le5 huang4 , deng1 mie4 le5 , yi1 dong4 bu2 dong4 . dian3 dian5 jiao4 ta1 , ta1 ye3 mei2 you3 hui2 da2 .',
      say: { who: 'dian', text: '小AI！你怎么了？', expr: 'worried' },
      action: { type: 'tap', target: '小AI', hint: '轻轻摇一摇它，看有没有反应', ok: '它还是不动，好像没电了。', sfx: 'soft' },
      fx: '「嘀——」电量低提示'
    },
    {
      mood: 'puzzled', beat: 'problem', scene: 'us4',
      title: '它是不是生病了',
      g1: ['点点急得团团转。'], g2: ['点点急得团团转：', '它是不是生病了？'],
      g3: ['点点急得团团转：它是不是生病了？', '它摸摸小AI，凉凉的，一点也不烫。'],
      py1: 'dian3 dian5 ji2 de5 tuan2 tuan2 zhuan4 .',
      py2: 'dian3 dian5 ji2 de5 tuan2 tuan2 zhuan4 : ta1 shi4 bu2 shi4 sheng1 bing4 le5 ?',
      py3: 'dian3 dian5 ji2 de5 tuan2 tuan2 zhuan4 : ta1 shi4 bu2 shi4 sheng1 bing4 le5 ? ta1 mo1 mo1 xiao3 AI , liang2 liang2 de5 , yi1 dian3 ye3 bu2 tang4 .',
      say: { who: 'dian', text: '它不烫，那它是怎么了？', expr: 'puzzled' },
      action: null,
      fx: '心跳「咚咚」加快'
    },
    {
      mood: 'thinking', beat: 'idea', scene: 'us5',
      title: '去找妈妈',
      g1: ['点点抱着小AI 去找妈妈。'], g2: ['点点抱着小AI，', '跑去找妈妈。'],
      g3: ['点点抱着小AI，跑去找妈妈。', '妈妈说：它没生病，它是没电了。'],
      py1: 'dian3 dian5 bao4 zhe5 xiao3 AI qu4 zhao3 ma1 ma5 .',
      py2: 'dian3 dian5 bao4 zhe5 xiao3 AI , pao3 qu4 zhao3 ma1 ma5 .',
      py3: 'dian3 dian5 bao4 zhe5 xiao3 AI , pao3 qu4 zhao3 ma1 ma5 . ma1 ma5 shuo1 : ta1 mei2 sheng1 bing4 , ta1 shi4 mei2 dian4 le5 .',
      say: { who: 'dian', text: '原来它要充电呀！　对不起，我让你担心了……', expr: 'star' },
      action: { type: 'drag', hint: '把充电线拖到小AI 身上', ok: '插上啦，小灯开始一闪一闪。', sfx: 'pop' },
      fx: '插头「咔哒」'
    },
    {
      mood: 'wonder', beat: 'clue', scene: 'us6',
      title: '充电的时候',
      g1: ['充电的时候，小AI 慢慢亮了。'], g2: ['充了一会儿，', '小AI 的灯慢慢亮起来。'],
      g3: ['充了一会儿，小AI 的灯慢慢亮起来。', '它小声说：谢谢你没有走开。'],
      py1: 'chong1 dian4 de5 shi2 hou4 , xiao3 AI man4 man4 liang4 le5 .',
      py2: 'chong1 le5 yi1 hui4 er5 , xiao3 AI de5 deng1 man4 man4 liang4 qi3 lai2 .',
      py3: 'chong1 le5 yi1 hui4 er5 , xiao3 AI de5 deng1 man4 man4 liang4 qi3 lai2 . ta1 xiao3 sheng1 shuo1 : xie4 xie5 ni3 mei2 you3 zou3 kai1 .',
      say: { who: 'ai', text: '我睡着的时候，你一直在等我吗？　你能帮我看看，充电线在哪里吗？', expr: 'shy' },
      action: { type: 'tap', target: '小AI', hint: '点一点它，说「我在呢」', ok: '小AI 的眼睛眨了一下。', sfx: 'warm' },
      fx: '充电「嗡——」'
    },
    {
      mood: 'puzzled', beat: 'problem', scene: 'us7',
      title: '它会难过吗',
      g1: ['点点问：你会难过吗？'], g2: ['点点问：你会难过吗？', '小AI 想了很久。'],
      g3: ['点点问：你会难过吗？', '小AI 想了很久，认真地说：', '我会做出难过的样子，可是我心里不难受。'],
      py1: 'dian3 dian5 wen4 : ni3 hui4 nan2 guo4 ma5 ?',
      py2: 'dian3 dian5 wen4 : ni3 hui4 nan2 guo4 ma5 ? xiao3 AI xiang3 le5 hen3 jiu3 .',
      py3: 'dian3 dian5 wen4 : ni3 hui4 nan2 guo4 ma5 ? xiao3 AI xiang3 le5 hen3 jiu3 , ren4 zhen1 de5 shuo1 : wo3 hui4 zuo4 chu1 nan2 guo4 de5 yang4 zi5 , ke3 shi4 wo3 xin1 li3 bu4 nan2 shou4 .',
      say: { who: 'ai', text: '真正会难过、会开心的，是你呀。', expr: 'calm' },
      action: { type: 'choose', q: '谁会真的难过？', options: ['点点会', '小AI 会'], answer: 0,
        right: '你说得对。有感情的是我们。', wrong: '小AI 只是做出样子，它心里不会难受。', sfx: 'soft' },
      fx: '安静的呼吸声'
    },
    {
      mood: 'thinking', beat: 'idea', scene: 'us8',
      title: '谁说了算',
      g1: ['点点说：那我让你做什么都行吗？'], g2: ['点点问：那我让你做什么，', '你都会做吗？'],
      g3: ['点点问：那我让你做什么，你都会做吗？', '小AI 摇摇头：那要看是不是好事。'],
      py1: 'dian3 dian5 shuo1 : na4 wo3 rang4 ni3 zuo4 shen2 me5 dou1 xing2 ma5 ?',
      py2: 'dian3 dian5 wen4 : na4 wo3 rang4 ni3 zuo4 shen2 me5 , ni3 dou1 hui4 zuo4 ma5 ?',
      py3: 'dian3 dian5 wen4 : na4 wo3 rang4 ni3 zuo4 shen2 me5 , ni3 dou1 hui4 zuo4 ma5 ? xiao3 AI yao2 yao5 tou2 : na4 yao4 kan4 shi4 bu2 shi4 hao3 shi4 .',
      say: { who: 'ai', text: '是你说了算，不是我。', expr: 'calm' },
      action: { type: 'choose', q: '下面哪件事，小AI 不应该做？', options: ['帮人做作业骗老师', '帮人找丢失的东西'], answer: 0,
        right: '对，本事要用在好的地方。', wrong: '再想想：哪件事会让别人受伤害？', sfx: 'soft' },
      fx: '认真起来的「叮」'
    },
    {
      mood: 'success', beat: 'success', scene: 'us9',
      title: '一起把城堡搭完',
      g1: ['小AI 充满电，又回来了。'], g2: ['小AI 充满电，又有力气了。', '它们一起把城堡搭完。'],
      g3: ['小AI 充满电，又有力气了。', '它们一起把没搭完的城堡搭完，', '这次比刚才还高。'],
      py1: 'xiao3 AI chong1 man3 dian4 , you4 hui2 lai2 le5 .',
      py2: 'xiao3 AI chong1 man3 dian4 , you4 you3 li4 qi5 le5 . ta1 men5 yi1 qi3 ba3 cheng2 bao3 da1 wan2 .',
      py3: 'xiao3 AI chong1 man3 dian4 , you4 you3 li4 qi5 le5 . ta1 men5 yi1 qi3 ba3 mei2 da1 wan2 de5 cheng2 bao3 da1 wan2 , zhe4 ci4 bi3 gang1 cai2 hai2 gao1 .',
      say: { who: 'dian', text: '你不在的时候，我一个人搭不动。', expr: 'happy' },
      action: { type: 'clap', hint: '为它们鼓掌', ok: '啪！啪！城堡搭好啦。', sfx: 'cheer' },
      fx: '欢呼 + 积木「咔」'
    },
    {
      mood: 'warm', beat: 'gift', scene: 'us10',
      title: '我会照顾你',
      g1: ['点点学会了照顾小AI。'], g2: ['点点学会了照顾小AI：', '记得给它充电，', '也记得让它休息。'],
      g3: ['点点学会了照顾小AI：记得给它充电，也记得让它休息。', '它说：你帮我的时候，我也会照顾你。'],
      py1: 'dian3 dian5 xue2 hui4 le5 zhao4 gu4 xiao3 AI .',
      py2: 'dian3 dian5 xue2 hui4 le5 zhao4 gu4 xiao3 AI : ji4 de5 gei3 ta1 chong1 dian4 , ye3 ji4 de5 rang4 ta1 xiu1 xi5 .',
      py3: 'dian3 dian5 xue2 hui4 le5 zhao4 gu4 xiao3 AI : ji4 de5 gei3 ta1 chong1 dian4 , ye3 ji4 de5 rang4 ta1 xiu1 xi5 . ta1 shuo1 : ni3 bang1 wo3 de5 shi2 hou4 , wo3 ye3 hui4 zhao4 gu4 ni3 .',
      say: { who: 'ai', text: '人做出来的我，要由人来照顾。　是你一直陪着我，我才醒过来的。　是你一直陪着我，我才醒过来的。　我们一起，什么都能学会。', expr: 'shy' },
      action: { type: 'say', keyword: '我会照顾你', hint: '对小AI 说：我会照顾你', ok: '小AI 的灯亮得暖暖的。', sfx: 'heart' },
      fx: '温柔的钢琴'
    }
  ],
  questions: [
    { after: 2, q: '小AI 为什么不动了？', options: ['它没电了', '它生气了'], answer: 0,
      right: '对啦！它不是生病，是没电了。', wrong: '妈妈说它没生病哦，那是什么呢？' },
    { after: 6, q: '谁会真的难过？', options: ['点点会', '小AI 会'], answer: 0,
      right: '你真懂！有感情的是我们。', wrong: '小AI 只是做出样子，它心里不会难受。' }
  ],
  mentor: [
    { q: '小AI 生病了怎么办？', a: '它不会真的生病，它只是没电了。给它插上充电线，等一会儿它就醒了。就像你的玩具没电了要换电池一样。' },
    { q: '小AI 会难过吗？', a: '它会做出难过的样子，但它心里不会真的难受。真正会开心、会难过、会心疼别人的，是我们。' },
    { q: '我能让小AI 做任何事吗？', a: '不能哦。它帮我们做事，可是要由人来决定做什么。如果那件事会让别人受伤害，就不该做。谁用它，谁就要负责。' }
  ]
};

const STORIES = [S7, S8];
module.exports = { STORIES };
