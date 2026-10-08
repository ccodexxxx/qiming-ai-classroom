/**
 * 拼音工具
 * 输入不带声调的拼音（如 "xiao3 qi3"），输出带声调符号的拼音（"xiǎo qǐ"）。
 * 之所以不直接写带声调的拼音，是因为手写声调符号极易出错；
 * 用「数字声调 + 字典校验」的方式，任何拼错的音节都会在校验时暴露出来。
 */
'use strict';

/** 全音节表（不含声调，按 ü 写作 v 收录） */
const SYLLABLES = [
  'a','ai','an','ang','ao',
  'ba','bai','ban','bang','bao','bei','ben','beng','bi','bian','biao','bie','bin','bing','bo','bu',
  'ca','cai','can','cang','cao','ce','cen','ceng','cha','chai','chan','chang','chao','che','chen','cheng','chi','chong','chou','chu','chua','chuai','chuan','chuang','chui','chun','chuo','ci','cong','cou','cu','cuan','cui','cun','cuo',
  'da','dai','dan','dang','dao','de','dei','deng','di','dian','diao','die','ding','diu','dong','dou','du','duan','dui','dun','duo',
  'e','ei','en','eng','er',
  'fa','fan','fang','fei','fen','feng','fo','fou','fu',
  'ga','gai','gan','gang','gao','ge','gei','gen','geng','gong','gou','gu','gua','guai','guan','guang','gui','gun','guo',
  'ha','hai','han','hang','hao','he','hei','hen','heng','hong','hou','hu','hua','huai','huan','huang','hui','hun','huo',
  'ji','jia','jian','jiang','jiao','jie','jin','jing','jiong','jiu','ju','juan','jue','jun',
  'ka','kai','kan','kang','kao','ke','ken','keng','kong','kou','ku','kua','kuai','kuan','kuang','kui','kun','kuo',
  'la','lai','lan','lang','lao','le','lei','leng','li','lia','lian','liang','liao','lie','lin','ling','liu','lo','long','lou','lu','luan','lue','lun','luo','lv','lve',
  'ma','mai','man','mang','mao','me','mei','men','meng','mi','mian','miao','mie','min','ming','miu','mo','mou','mu',
  'na','nai','nan','nang','nao','ne','nei','nen','neng','ni','nian','niang','niao','nie','nin','ning','niu','nong','nou','nu','nuan','nue','nuo','nv','nve',
  'o','ou',
  'pa','pai','pan','pang','pao','pei','pen','peng','pi','pian','piao','pie','pin','ping','po','pou','pu',
  'qi','qia','qian','qiang','qiao','qie','qin','qing','qiong','qiu','qu','quan','que','qun',
  'ran','rang','rao','re','ren','reng','ri','rong','rou','ru','ruan','rui','run','ruo',
  'sa','sai','san','sang','sao','se','sen','seng','sha','shai','shan','shang','shao','she','shei','shen','sheng','shi','shou','shu','shua','shuai','shuan','shuang','shui','shun','shuo','si','song','sou','su','suan','sui','sun','suo',
  'ta','tai','tan','tang','tao','te','teng','ti','tian','tiao','tie','ting','tong','tou','tu','tuan','tui','tun','tuo',
  'wa','wai','wan','wang','wei','wen','weng','wo','wu',
  'xi','xia','xian','xiang','xiao','xie','xin','xing','xiong','xiu','xu','xuan','xue','xun',
  'ya','yan','yang','yao','ye','yi','yin','ying','yo','yong','you','yu','yuan','yue','yun',
  'za','zai','zan','zang','zao','ze','zei','zen','zeng','zha','zhai','zhan','zhang','zhao','zhe','zhen','zheng','zhi','zhong','zhou','zhu','zhua','zhuai','zhuan','zhuang','zhui','zhun','zhuo','zi','zong','zou','zu','zuan','zui','zun','zuo'
];
const SET = new Set(SYLLABLES);

/** 声调符号加在哪个元音上：a > o > e > iu/ui 的后者 > 其他第一个元音 */
function toneIndex(base) {
  if (base.indexOf('a') >= 0) return base.indexOf('a');
  if (base.indexOf('o') >= 0) return base.indexOf('o');
  if (base.indexOf('e') >= 0) return base.indexOf('e');
  if (base === 'iu') return 1;
  if (base === 'ui') return 1;
  if (base.indexOf('i') >= 0) return base.indexOf('i');
  if (base.indexOf('u') >= 0) return base.indexOf('u');
  if (base.indexOf('v') >= 0) return base.indexOf('v');
  return 0;
}

const TONE_MAP = {
  a: ['a', 'ā', 'á', 'ǎ', 'à'],
  o: ['o', 'ō', 'ó', 'ǒ', 'ò'],
  e: ['e', 'ē', 'é', 'ě', 'è'],
  i: ['i', 'ī', 'í', 'ǐ', 'ì'],
  u: ['u', 'ū', 'ú', 'ǔ', 'ù'],
  v: ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ']
};

/**
 * 单个音节：拼音 + 声调数字（0/5 表示轻声）
 * @returns {string|null} 无法识别时返回 null
 */
function syllable(raw, tone) {
  const base = String(raw || '').toLowerCase();
  if (!base) return '';
  if (!SET.has(base)) return null;
  const t = Number(tone) || 0;
  if (t < 0 || t > 5) return null;
  if (t === 0 || t === 5) return base.replace(/v/g, 'ü');
  const i = toneIndex(base);
  const ch = base[i];
  const table = TONE_MAP[ch];
  if (!table) return null;
  return base.slice(0, i) + table[t] + base.slice(i + 1).replace(/v/g, 'ü');
}

/**
 * 整句：空格分词，每词形如 "xiao3" 或 "xiao"，标点原样保留
 * @returns {{text:string, bad:string[]}}
 */
function sentence(src) {
  const bad = [];
  const out = String(src || '').split(/\s+/).filter(Boolean).map(word => {
    const m = word.match(/^([A-Za-zü]+)([0-5]?)(.*)$/);
    if (!m) return word;
    const s = syllable(m[1], m[2]);
    if (s === null) { bad.push(m[1]); return word; }
    return s + m[3];
  }).join(' ');
  return { text: out, bad: bad };
}

/** 逐字注音：把「汉字 + 拼音」对齐成 [{hz, py}]，用于页面上方拼音显示 */
function align(hzText, pyText) {
  const chars = String(hzText || '').split('').filter(c => /[\u4e00-\u9fa5]/.test(c));
  const pys = String(pyText || '').split(/\s+/).filter(Boolean).filter(w => /^[A-Za-zü]/.test(w));
  return chars.map((c, i) => ({ hz: c, py: pys[i] || '' }));
}

module.exports = { syllable, sentence, align, SYLLABLES, SET };
