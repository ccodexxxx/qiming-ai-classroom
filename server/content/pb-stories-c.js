/**
 * AI 启蒙绘本 · 故事脚本（第三批）
 */
'use strict';

/* ============================================================
 * 五、《小AI 也会错》—— AI 会犯错
 * ============================================================ */
const S5 = {
  id: 'oops', title: '小AI 也会错', emoji: '🙈',
  concept: 'ai-mistake', conceptLabel: 'AI 会犯错',
  interests: ['生活', '朋友'],
  logline: '小AI 打翻了一杯水，它学会了说「我错了，我再来一次」。',
  cast: ['ai', 'dian'],
  pages: [
    {
      mood: 'happy', beat: 'curious', scene: 'oops1',
      title: '小AI 想帮忙',
      g1: ['小AI 想帮点点端水。'], g2: ['小AI 看见桌上有一杯水，', '它想帮忙端过去。'],
      g3: ['小AI 看见桌上有一杯水，它想帮忙端过去。', '它说：让我试试看！'],
      py1: 'xiao3 AI xiang3 bang1 dian3 dian5 duan1 shui3 .',
      py2: 'xiao3 AI kan4 jian4 zhuo1 shang4 you3 yi1 bei1 shui3 , ta1 xiang3 bang1 mang2 duan1 guo4 qu4 .',
      py3: 'xiao3 AI kan4 jian4 zhuo1 shang4 you3 yi1 bei1 shui3 , ta1 xiang3 bang1 mang2 duan1 guo4 qu4 . ta1 shuo1 : rang4 wo3 shi4 shi5 kan4 !',
      say: { who: 'ai', text: '让我试试看！', expr: 'star' },
      action: { type: 'tap', target: '小AI 的手', hint: '点一点小AI，让它试试', ok: '小AI 伸出小手，可是有点抖。', sfx: 'pop' },
      fx: '杯子轻轻晃动'
    },
    {
      mood: 'worried', beat: 'problem', scene: 'oops2',
      title: '哗啦——',
      g1: ['杯子掉在地上，水洒了。'], g2: ['杯子没拿稳，', '哗啦一声，', '水全洒在地上。'],
      g3: ['杯子没拿稳，哗啦一声，水全洒在地上。', '小AI 呆住了，一动不动。'],
      py1: 'bei1 zi5 diao4 zai4 di4 shang4 , shui3 sa3 le5 .',
      py2: 'bei1 zi5 mei2 na2 wen3 , hua1 la1 yi1 sheng1 , shui3 quan2 sa3 zai4 di4 shang4 .',
      py3: 'bei1 zi5 mei2 na2 wen3 , hua1 la1 yi1 sheng1 , shui3 quan2 sa3 zai4 di4 shang4 . xiao3 AI dai1 zhu4 le5 , yi1 dong4 ye3 bu2 dong4 .',
      say: { who: 'ai', text: '啊……我、我不是故意的。', expr: 'worried' },
      action: null,
      fx: '「哗啦」摔碎声（不刺耳）+ 心跳「咚」'
    },
    {
      mood: 'puzzled', beat: 'problem', scene: 'oops3',
      title: '它会犯错',
      g1: ['小AI 低下头。'], g2: ['小AI 低下头，', '小声说对不起。'],
      g3: ['小AI 低下头，小声说对不起。', '它想：我是不是很没用？连一杯水都端不好。'],
      py1: 'xiao3 AI di1 xia4 tou2 .',
      py2: 'xiao3 AI di1 xia4 tou2 , xiao3 sheng1 shuo1 dui4 bu4 qi3 .',
      py3: 'xiao3 AI di1 xia4 tou2 , xiao3 sheng1 shuo1 dui4 bu4 qi3 . ta1 xiang3 : wo3 shi4 bu2 shi4 hen3 mei2 yong4 ? lian2 yi1 bei1 shui3 dou1 duan1 bu4 hao3 .',
      say: { who: 'ai', text: '我做错了……', expr: 'sad' },
      action: { type: 'choose', q: '小AI 打翻水，是因为它？', options: ['还不熟练', '故意捣乱'], answer: 0,
        right: '是的，它只是还不会。', wrong: '它是想帮忙哦，只是还没练熟。', sfx: 'soft' },
      fx: '低低的「嗡」'
    },
    {
      mood: 'thinking', beat: 'idea', scene: 'oops4',
      title: '点点没有生气',
      g1: ['点点拿来抹布。'], g2: ['点点没有生气，', '它拿来一块抹布。'],
      g3: ['点点没有生气，它拿来一块抹布。', '它说：没关系，我们一起擦干净。'],
      py1: 'dian3 dian5 na2 lai2 ma1 bu4 .',
      py2: 'dian3 dian5 mei2 you3 sheng1 qi4 , ta1 na2 lai2 yi1 kuai4 ma1 bu4 .',
      py3: 'dian3 dian5 mei2 you3 sheng1 qi4 , ta1 na2 lai2 yi1 kuai4 ma1 bu4 . ta1 shuo1 : mei2 guan1 xi5 , wo3 men5 yi1 qi3 ca1 gan1 jing4 .',
      say: { who: 'dian', text: '没关系的，做错很正常。', expr: 'happy' },
      action: { type: 'drag', hint: '把抹布拖到水渍上，一起擦干净', ok: '地面擦干净啦！', sfx: 'whoosh' },
      fx: '擦地「唰唰」'
    },
    {
      mood: 'wonder', beat: 'clue', scene: 'oops5',
      title: '为什么会洒',
      g1: ['小AI 想：为什么会洒？'], g2: ['小AI 想了好久：', '为什么会洒呢？'],
      g3: ['小AI 想了好久：为什么会洒呢？', '它发现自己拿杯子的时候，手在抖，', '而且只捏住了杯子的一边。'],
      py1: 'xiao3 AI xiang3 : wei4 shen2 me5 hui4 sa3 ?',
      py2: 'xiao3 AI xiang3 le5 hao3 jiu3 : wei4 shen2 me5 hui4 sa3 ne5 ?',
      py3: 'xiao3 AI xiang3 le5 hao3 jiu3 : wei4 shen2 me5 hui4 sa3 ne5 ? ta1 fa1 xian4 zi4 ji3 na2 bei1 zi5 de5 shi2 hou4 , shou3 zai4 dou3 , er2 qie3 zhi3 nie1 zhu4 le5 bei1 zi5 de5 yi1 bian1 .',
      say: { who: 'ai', text: '啊，我只捏住了一边！　对不起，我又闯祸了，你能原谅我吗？', expr: 'star' },
      action: { type: 'find', hint: '找出小AI 拿杯子时的问题', ok: '你找到了：它只捏住了一边。', sfx: 'ding' },
      fx: '「叮咚」想通了'
    },
    {
      mood: 'happy', beat: 'idea', scene: 'oops6',
      title: '再试一次',
      g1: ['小AI 说：我再来一次。'], g2: ['小AI 深呼吸，', '说：我再来一次。'],
      g3: ['小AI 深呼吸，说：我再来一次。', '这次它用两只手，紧紧地捧住杯子。'],
      py1: 'xiao3 AI shuo1 : wo3 zai4 lai2 yi1 ci4 .',
      py2: 'xiao3 AI shen1 hu1 xi1 , shuo1 : wo3 zai4 lai2 yi1 ci4 .',
      py3: 'xiao3 AI shen1 hu1 xi1 , shuo1 : wo3 zai4 lai2 yi1 ci4 . zhe4 ci4 ta1 yong4 liang3 zhi1 shou3 , jin3 jin3 de5 peng3 zhu4 bei1 zi5 .',
      say: { who: 'ai', text: '两只手，慢慢走——', expr: 'happy' },
      action: { type: 'blow', hint: '轻轻吹一口气，帮小AI 稳一稳', ok: '杯子稳稳的，一点也没晃！', sfx: 'whoosh' },
      fx: '轻轻的呼吸声'
    },
    {
      mood: 'success', beat: 'success', scene: 'oops7',
      title: '这次端稳了',
      g1: ['小AI 把水端到了桌上。'], g2: ['小AI 一步一步走，', '把水稳稳地端到了桌上。'],
      g3: ['小AI 一步一步走，把水稳稳地端到了桌上。', '一滴都没有洒出来。'],
      py1: 'xiao3 AI ba3 shui3 duan1 dao4 le5 zhuo1 shang4 .',
      py2: 'xiao3 AI yi1 bu4 yi1 bu4 zou3 , ba3 shui3 wen3 wen3 de5 duan1 dao4 le5 zhuo1 shang4 .',
      py3: 'xiao3 AI yi1 bu4 yi1 bu4 zou3 , ba3 shui3 wen3 wen3 de5 duan1 dao4 le5 zhuo1 shang4 . yi1 di1 dou1 mei2 you3 sa3 chu1 lai2 .',
      say: { who: 'ai', text: '我做到啦！你能为我鼓鼓掌吗？', expr: 'laugh' },
      action: { type: 'clap', hint: '给小AI 鼓掌', ok: '啪！啪！小AI 开心地跳了一下。', sfx: 'cheer' },
      fx: '欢呼 + 星星'
    },
    {
      mood: 'puzzled', beat: 'problem', scene: 'oops8',
      title: '它还是会有不会的事',
      g1: ['点点说：有件事你做不到。'], g2: ['点点说：不过有一件事，', '你做不到哦。'],
      g3: ['点点说：不过有一件事，你做不到哦。', '小AI 问：是什么呀？', '点点说：你尝不出苹果是甜的还是酸的。'],
      py1: 'dian3 dian5 shuo1 : you3 jian4 shi4 ni3 zuo4 bu2 dao4 .',
      py2: 'dian3 dian5 shuo1 : bu2 guo4 you3 yi1 jian4 shi4 , ni3 zuo4 bu2 dao4 o5 .',
      py3: 'dian3 dian5 shuo1 : bu2 guo4 you3 yi1 jian4 shi4 , ni3 zuo4 bu2 dao4 o5 . xiao3 AI wen4 : shi4 shen2 me5 ya5 ? dian3 dian5 shuo1 : ni3 chang2 bu4 chu1 ping2 guo3 shi4 tian2 de5 hai2 shi4 suan1 de5 .',
      say: { who: 'ai', text: '真的耶……我不知道苹果是什么味道。　你能帮我看看，我还会做什么吗？', expr: 'wonder' },
      action: { type: 'choose', q: '下面哪件事小AI 做不到？', options: ['尝出苹果的味道', '认出苹果的图片'], answer: 0,
        right: '对了！它能看图，但尝不出味道。', wrong: '再想想：它有眼睛，可是没有舌头呀。', sfx: 'soft' },
      fx: '「唔……」的思考音'
    },
    {
      mood: 'thinking', beat: 'idea', scene: 'oops9',
      title: '不会也没关系',
      g1: ['小AI 说：那我会别的。'], g2: ['小AI 想了想，', '说：那我做我会的就好啦。'],
      g3: ['小AI 想了想，说：那我做我会的就好啦。', '它帮点点找到了丢失的橡皮，', '还讲了一个故事。'],
      py1: 'xiao3 AI shuo1 : na4 wo3 hui4 bie2 de5 .',
      py2: 'xiao3 AI xiang3 le5 xiang3 , shuo1 : na4 wo3 zuo4 wo3 hui4 de5 jiu4 hao3 la1 .',
      py3: 'xiao3 AI xiang3 le5 xiang3 , shuo1 : na4 wo3 zuo4 wo3 hui4 de5 jiu4 hao3 la1 . ta1 bang1 dian3 dian5 zhao3 dao4 le5 diu1 shi1 de5 xiang4 pi2 , hai2 jiang3 le5 yi1 ge4 gu4 shi5 .',
      say: { who: 'dian', text: '你会的东西已经很多啦。', expr: 'happy' },
      action: { type: 'tap', target: '小AI', hint: '告诉小AI 它很棒', ok: '小AI 的灯亮得暖暖的。', sfx: 'warm' },
      fx: '温暖的「叮」'
    },
    {
      mood: 'warm', beat: 'gift', scene: 'oops10',
      title: '我错了，我再来一次',
      g1: ['小AI 学会了一句话。'], g2: ['小AI 学会了一句话：', '我错了，我再来一次。'],
      g3: ['小AI 学会了一句话：我错了，我再来一次。', '它把这句话写在了自己的小屏幕上。'],
      py1: 'xiao3 AI xue2 hui4 le5 yi1 ju4 hua4 .',
      py2: 'xiao3 AI xue2 hui4 le5 yi1 ju4 hua4 : wo3 cuo4 le5 , wo3 zai4 lai2 yi1 ci4 .',
      py3: 'xiao3 AI xue2 hui4 le5 yi1 ju4 hua4 : wo3 cuo4 le5 , wo3 zai4 lai2 yi1 ci4 . ta1 ba3 zhe4 ju4 hua4 xie3 zai4 le5 zi4 ji3 de5 xiao3 ping2 mu4 shang4 .',
      say: { who: 'dian', text: '这句话，我们一起记住。　你看，我们一起把它端稳了！', expr: 'shy' },
      action: { type: 'say', keyword: '再来一次', hint: '跟着小AI 说一遍：我再来一次', ok: '说得真好！这句话很有用。', sfx: 'heart' },
      fx: '温柔的收尾音'
    }
  ],
  questions: [
    { after: 2, q: '小AI 打翻水的时候，它心里什么感觉？', options: ['害怕、不好意思', '很开心'], answer: 0,
      right: '你能体会到它的心情，真棒。', wrong: '它呆住不动了，心里肯定不好受。' },
    { after: 6, q: '小AI 第二次为什么端稳了？', options: ['它用两只手慢慢走', '它换了一个杯子'], answer: 0,
      right: '没错！找到问题、再试一次就好。', wrong: '回去看看第 7 页：它是怎么拿的？' }
  ],
  mentor: [
    { q: '小AI 为什么会犯错？', a: '因为它也有不会的事情呀。它只学过一部分东西，没见过的、没练过的，就容易做错。就像你第一次拿筷子也会掉。' },
    { q: '它做错了怎么办？', a: '它会说「我错了，我再来一次」。然后想一想哪里不对，再试一遍。你也可以这样。' },
    { q: '它有什么事情做不到？', a: '它尝不出味道，闻不到香味，也感觉不到疼。它不会真的喜欢谁，也不会真的难过。这些是它做不到的。' }
  ]
};

/* ============================================================
 * 六、《谁教小AI 的呀》—— AI 需要人教
 * ============================================================ */
const S6 = {
  id: 'teach', title: '谁教小AI 的呀', emoji: '🎓',
  concept: 'ai-teach', conceptLabel: 'AI 需要人教',
  interests: ['太空', '朋友'],
  logline: '小AI 想自己学会一件事，结果发现所有的本事都是人教它的。',
  cast: ['ai', 'dian'],
  pages: [
    {
      mood: 'curious', beat: 'curious', scene: 'teach1',
      title: '我想自己学',
      g1: ['小AI 想自己学会一件事。'], g2: ['小AI 说：今天我要', '自己学会一件事！'],
      g3: ['小AI 说：今天我要自己学会一件事！', '它想学会认出天上的星星。'],
      py1: 'xiao3 AI xiang3 zi4 ji3 xue2 hui4 yi1 jian4 shi4 .',
      py2: 'xiao3 AI shuo1 : jin1 tian1 wo3 yao4 zi4 ji3 xue2 hui4 yi1 jian4 shi4 !',
      py3: 'xiao3 AI shuo1 : jin1 tian1 wo3 yao4 zi4 ji3 xue2 hui4 yi1 jian4 shi4 ! ta1 xiang3 xue2 hui4 ren4 chu1 tian1 shang4 de5 xing1 xing5 .',
      say: { who: 'ai', text: '我自己就能学会！', expr: 'star' },
      action: { type: 'tap', target: '天空', hint: '点一点天空，找出星星', ok: '星星一闪一闪。', sfx: 'chime' },
      fx: '夜空「叮铃」'
    },
    {
      mood: 'puzzled', beat: 'problem', scene: 'teach2',
      title: '看了好久，还是不懂',
      g1: ['小AI 看了好久。'], g2: ['小AI 看了好久好久，', '还是分不清哪颗是哪颗。'],
      g3: ['小AI 看了好久好久，还是分不清哪颗是哪颗。', '它把北斗七星认成了勺子。'],
      py1: 'xiao3 AI kan4 le5 hao3 jiu3 .',
      py2: 'xiao3 AI kan4 le5 hao3 jiu3 hao3 jiu3 , hai2 shi4 fen1 bu4 qing1 na3 ke1 shi4 na3 ke1 .',
      py3: 'xiao3 AI kan4 le5 hao3 jiu3 hao3 jiu3 , hai2 shi4 fen1 bu4 qing1 na3 ke1 shi4 na3 ke1 . ta1 ba3 bei3 dou4 qi1 xing1 ren4 cheng2 le5 shao2 zi5 .',
      say: { who: 'ai', text: '它们长得都一样呀……', expr: 'puzzled' },
      action: null,
      fx: '「唔……」迷惑音'
    },
    {
      mood: 'thinking', beat: 'idea', scene: 'teach3',
      title: '需要人告诉我',
      g1: ['小AI 明白了：要有人告诉它。'], g2: ['小AI 明白了：', '得有人告诉它，', '它才知道哪颗是哪颗。'],
      g3: ['小AI 明白了：得有人告诉它，它才知道哪颗是哪颗。', '它跑去敲点点的门。'],
      py1: 'xiao3 AI ming2 bai5 le5 : yao4 you3 ren2 gao4 su4 ta1 .',
      py2: 'xiao3 AI ming2 bai5 le5 : dei3 you3 ren2 gao4 su4 ta1 , ta1 cai2 zhi1 dao4 na3 ke1 shi4 na3 ke1 .',
      py3: 'xiao3 AI ming2 bai5 le5 : dei3 you3 ren2 gao4 su4 ta1 , ta1 cai2 zhi1 dao4 na3 ke1 shi4 na3 ke1 . ta1 pao3 qu4 qiao1 dian3 dian5 de5 men2 .',
      say: { who: 'ai', text: '点点，你可以教我吗？', expr: 'shy' },
      action: { type: 'say', keyword: '我教你', hint: '对小AI 说：我教你', ok: '小AI 高兴得跳起来！', sfx: 'chime' },
      fx: '敲门「咚咚咚」'
    },
    {
      mood: 'happy', beat: 'idea', scene: 'teach4',
      title: '点点来教它',
      g1: ['点点拿出好多星星的图片。'], g2: ['点点拿出好多星星的图片，', '一张一张讲给它听。'],
      g3: ['点点拿出好多星星的图片，一张一张讲给它听。', '这是北斗七星，这是北极星。'],
      py1: 'dian3 dian5 na2 chu1 hao3 duo1 xing1 xing5 de5 tu2 pian4 .',
      py2: 'dian3 dian5 na2 chu1 hao3 duo1 xing1 xing5 de5 tu2 pian4 , yi1 zhang1 yi1 zhang1 jiang3 gei3 ta1 ting1 .',
      py3: 'dian3 dian5 na2 chu1 hao3 duo1 xing1 xing5 de5 tu2 pian4 , yi1 zhang1 yi1 zhang1 jiang3 gei3 ta1 ting1 . zhe4 shi4 bei3 dou4 qi1 xing1 , zhe4 shi4 bei3 ji2 xing1 .',
      say: { who: 'dian', text: '你看，这七颗连起来像勺子。　对不起，我学不会……你能鼓励我一下吗？', expr: 'happy' },
      action: { type: 'drag', hint: '把星星连成勺子的形状', ok: '连好了！这就是北斗七星。', sfx: 'pop' },
      fx: '「嗒、嗒」连线声'
    },
    {
      mood: 'wonder', beat: 'clue', scene: 'teach5',
      title: '人的办法真多',
      g1: ['点点还教它别的办法。'], g2: ['点点还教它：', '先看最亮的那一颗。'],
      g3: ['点点还教它：先看最亮的那一颗，再看旁边的形状。', '小AI 把这些都记进了学习卡片。'],
      py1: 'dian3 dian5 hai2 jiao1 ta1 bie2 de5 ban4 fa3 .',
      py2: 'dian3 dian5 hai2 jiao1 ta1 : xian1 kan4 zui4 liang4 de5 na4 yi1 ke1 .',
      py3: 'dian3 dian5 hai2 jiao1 ta1 : xian1 kan4 zui4 liang4 de5 na4 yi1 ke1 , zai4 kan4 pang2 bian1 de5 xing2 zhuang4 . xiao3 AI ba3 zhe4 xie1 dou1 ji4 jin4 le5 xue2 xi2 ka3 pian4 .',
      say: { who: 'ai', text: '原来人可以这样想！真厉害。', expr: 'star' },
      action: { type: 'find', hint: '找出天空中最亮的那一颗', ok: '找到啦，那就是北极星。', sfx: 'ding' },
      fx: '星星「叮」一声变亮'
    },
    {
      mood: 'success', beat: 'success', scene: 'teach6',
      title: '它认出来啦',
      g1: ['小AI 认出了北斗七星。'], g2: ['小AI 看着天空，', '一下就认出了北斗七星。'],
      g3: ['小AI 看着天空，一下就认出了北斗七星。', '它高兴得在天台上转圈。'],
      py1: 'xiao3 AI ren4 chu1 le5 bei3 dou4 qi1 xing1 .',
      py2: 'xiao3 AI kan4 zhe5 tian1 kong1 , yi1 xia4 jiu4 ren4 chu1 le5 bei3 dou4 qi1 xing1 .',
      py3: 'xiao3 AI kan4 zhe5 tian1 kong1 , yi1 xia4 jiu4 ren4 chu1 le5 bei3 dou4 qi1 xing1 . ta1 gao1 xing4 de5 zai4 tian1 tai2 shang4 zhuan4 quan1 .',
      say: { who: 'ai', text: '是点点教我的！', expr: 'laugh' },
      action: { type: 'clap', hint: '拍拍手，庆祝一下', ok: '啪！啪！星星好像也亮了一点。', sfx: 'cheer' },
      fx: '欢呼 + 星星雨'
    },
    {
      mood: 'puzzled', beat: 'problem', scene: 'teach7',
      title: '如果没人教呢',
      g1: ['小AI 忽然想到一个问题。'], g2: ['小AI 忽然想到：', '如果没有人教我呢？'],
      g3: ['小AI 忽然想到：如果没有人教我，我会什么呢？', '它想了半天，发现自己什么都不会。'],
      py1: 'xiao3 AI hu1 ran2 xiang3 dao4 yi1 ge4 wen4 ti2 .',
      py2: 'xiao3 AI hu1 ran2 xiang3 dao4 : ru2 guo3 mei2 you3 ren2 jiao1 wo3 ne5 ?',
      py3: 'xiao3 AI hu1 ran2 xiang3 dao4 : ru2 guo3 mei2 you3 ren2 jiao1 wo3 , wo3 hui4 shen2 me5 ne5 ? ta1 xiang3 le5 ban4 tian1 , fa1 xian4 zi4 ji3 shen2 me5 dou1 bu2 hui4 .',
      say: { who: 'ai', text: '那……我什么都做不了。', expr: 'sad' },
      action: { type: 'choose', q: '如果没人教小AI，它会什么？', options: ['什么都不会', '还是会很多'], answer: 0,
        right: '说对了。它所有的本事，都是人教的。', wrong: '想一想：它刚做好时连水都端不起来。', sfx: 'soft' },
      fx: '「嗡……」的门铃余音'
    },
    {
      mood: 'thinking', beat: 'idea', scene: 'teach8',
      title: '所以我要谢谢人',
      g1: ['小AI 想通了。'], g2: ['小AI 想通了：', '所以我要谢谢教我的人。'],
      g3: ['小AI 想通了：所以我要谢谢教我的人。', '它做了一张小卡片送给点点。'],
      py1: 'xiao3 AI xiang3 tong1 le5 .',
      py2: 'xiao3 AI xiang3 tong1 le5 : suo3 yi3 wo3 yao4 xie4 xie5 jiao1 wo3 de5 ren2 .',
      py3: 'xiao3 AI xiang3 tong1 le5 : suo3 yi3 wo3 yao4 xie4 xie5 jiao1 wo3 de5 ren2 . ta1 zuo4 le5 yi1 zhang1 xiao3 ka3 pian4 song4 gei3 dian3 dian5 .',
      say: { who: 'dian', text: '不客气，我们一起学。', expr: 'happy' },
      action: { type: 'tap', target: '小卡片', hint: '点一点，看看卡片上写了什么', ok: '卡片上写：谢谢教我的人。', sfx: 'warm' },
      fx: '「沙沙」写字声'
    },
    {
      mood: 'warm', beat: 'gift', scene: 'teach9',
      title: '一起去看星星',
      g1: ['它们一起看星星。'], g2: ['它们坐在天台上，', '一起看星星。'],
      g3: ['它们坐在天台上，一起看星星。', '小AI 说：以后你教我，我也教你。'],
      py1: 'ta1 men5 yi1 qi3 kan4 xing1 xing5 .',
      py2: 'ta1 men5 zuo4 zai4 tian1 tai2 shang4 , yi1 qi3 kan4 xing1 xing5 .',
      py3: 'ta1 men5 zuo4 zai4 tian1 tai2 shang4 , yi1 qi3 kan4 xing1 xing5 . xiao3 AI shuo1 : yi3 hou4 ni3 jiao1 wo3 , wo3 ye3 jiao1 ni3 .',
      say: { who: 'ai', text: '你教我认星星，我教你认小猫！　这是请人教我、你陪我练，我才学会的！', expr: 'laugh' },
      action: { type: 'say', keyword: '好呀', hint: '对它们说一声：好呀', ok: '夜空下，两个好朋友笑了。', sfx: 'heart' },
      fx: '温柔的夜空音'
    }
  ],
  questions: [
    { after: 1, q: '小AI 自己能学会认星星吗？', options: ['不能，要人教', '能，它很聪明'], answer: 0,
      right: '说得对！它需要人告诉它。', wrong: '它看了好久，还是分不清呢。' },
    { after: 6, q: '小AI 的本事是哪来的？', options: ['人一点一点教它的', '它生下来就会'], answer: 0,
      right: '你真明白！所有本事都是人教的。', wrong: '想想第 8 页：如果没人教它，它会什么呢？' }
  ],
  mentor: [
    { q: '谁教小AI 的呀？', a: '是叔叔阿姨，还有点点这样的小朋友。人给它看很多东西、告诉它哪个对哪个不对，它才慢慢学会。没有人教，它什么都不会。' },
    { q: '我可以教小AI 吗？', a: '当然可以！你告诉它哪里认错了，或者帮它把新的图片整理好，就是在教它。你教得越多，它越厉害。' },
    { q: '小AI 会不会自己偷偷学？', a: '不会哦。它不会自己决定学什么。要人给它东西看、按下开始，它才会学。' }
  ]
};


/** 第五、六本 */
const STORIES = [S5, S6];
module.exports = { STORIES };
