// 蛊码 GuCode · 成就道途（第三版：50 个节点，入门 / 境界 / 渡劫 / 养蛊 / 杀招 / 劫数 / 挑战七组）。纯数据 + 两个纯函数，不 import 任何文件。由 tools/gen-timeline.mjs 生成，改道途改那边再跑一次。
// 格式：TIMELINE[i] = { id, n 名, g 分组, d 怎么达成（一句话）, need { 事件计数名: 次数 }, after 前置节点 id（可无）, unlock [{ k, id, n }] 解锁什么 }
// 成就本身不给数值，只解锁东西（design 第 4 节、2.7 节）。
//
// 事件计数名（metaEmit 的 k）：
//   原有：trips 渡劫次数（进秘境一趟，打完回来就算）、realm 境界（set 取最大）、merges 合成次数、combos 杀招成形过的种数、buys 买蛊次数、feeds 喂食次数
//   clears 秘境通关次数：每通关一次都 +1（哪个秘境、第几劫都算，不只渡劫那一次）——请改用下面的 clearEvents，别只在渡劫时加
//   以下都在通关时由 clearEvents 算出来（set 取最大，值 = 这次通关的秘境额度）：
//     r1q 出场全是一转 · r2q 出场全是一转二转 · no5q 没有五转和仙蛊 · few3q 出场不超过 3 只 · monoq 出场全属同一道
//     flawq 一只都没倒下 · nocomboq 一个杀招都没成形
//   d_<道 id>（+1）这次通关的主力道（出场只数最多的道，并列都算）；daos（set）当过主力通关的道一共几个
//   kalpa（set）通关过的最高劫数（任意秘境）
// unlock.k：'species' 新蛊进蛊市（仙蛊 = 仙茧里才可能开出它）| 'food' 新食物进蛊市 | 'combo' 杀招能成形 | 'trip' 新秘境 | 'feature' 新玩法（kalpa = 劫数）
//   锁住的杀招在蛊典里照样能看到配方线索，只是凑齐了也不成形，界面写「道途解锁」。
export const TIMELINE = [
  { id: 'first_buy', n: '开张', g: '入门', d: '在蛊市买下第一只蛊', need: { buys: 1 }, unlock: [{ k: 'species', id: 'jingzhe', n: '惊蛰蛊' }] },
  { id: 'first_trip', n: '初入秘境', g: '入门', d: '第一次渡劫（进秘境打完回来就算，输了也算）', need: { trips: 1 }, unlock: [{ k: 'species', id: 'snowflea', n: '雪蚤蛊' }, { k: 'species', id: 'will', n: '鬼火蛊' }] },
  { id: 'first_merge', n: '三蛊归一', g: '入门', d: '第一次把三只同种同转的蛊合成一只', need: { merges: 1 }, unlock: [{ k: 'species', id: 'tick', n: '蜱蛊' }, { k: 'species', id: 'bloodant', n: '血蚁蛊' }] },
  { id: 'first_combo', n: '杀招初成', g: '入门', d: '第一次让一个杀招成形', need: { combos: 1 }, after: 'first_merge', unlock: [{ k: 'species', id: 'jiuchong', n: '酒虫' }] },
  { id: 'feeder', n: '养蛊人', g: '入门', d: '喂食 5 次（各类食物都算）', need: { feeds: 5 }, unlock: [{ k: 'food', id: 'map', n: '寻路图' }] },
  { id: 'buyer10', n: '蛊市熟客', g: '入门', d: '买蛊 10 次', need: { buys: 10 }, after: 'first_buy', unlock: [{ k: 'species', id: 'strider', n: '水黾蛊' }, { k: 'food', id: 'yuelan', n: '月兰花瓣' }] },
  { id: 'realm1', n: '一转蛊师', g: '境界', d: '渡劫成功一次（打赢本境界任一秘境最深处的首领）', need: { realm: 1 }, after: 'first_trip', unlock: [{ k: 'species', id: 'wasp', n: '胡蜂蛊' }, { k: 'species', id: 'spider', n: '蛛母蛊' }, { k: 'species', id: 'qingfu', n: '青蚨蛊' }, { k: 'species', id: 'bomb', n: '爆囊蛊' }] },
  { id: 'realm2', n: '二转蛊师', g: '境界', d: '境界到二转', need: { realm: 2 }, after: 'realm1', unlock: [{ k: 'species', id: 'qant', n: '蚁后蛊' }, { k: 'species', id: 'flea', n: '跳蚤蛊' }, { k: 'species', id: 'bfly', n: '比翼蛊' }, { k: 'species', id: 'sleep', n: '眠虫蛊' }, { k: 'food', id: 'juqi', n: '聚气珠' }] },
  { id: 'realm3', n: '三转蛊师', g: '境界', d: '境界到三转', need: { realm: 3 }, after: 'realm2', unlock: [{ k: 'species', id: 'mirror', n: '镜甲蛊' }, { k: 'species', id: 'hive', n: '蜂巢蛊' }, { k: 'species', id: 'fly', n: '尸蝇蛊' }, { k: 'species', id: 'bury', n: '葬甲蛊' }, { k: 'food', id: 'duji', n: '毒棘甲' }, { k: 'food', id: 'zhenshi', n: '镇石' }] },
  { id: 'realm4', n: '四转蛊师', g: '境界', d: '境界到四转', need: { realm: 4 }, after: 'realm3', unlock: [{ k: 'species', id: 'xiongli', n: '熊力蛊' }, { k: 'species', id: 'magma', n: '熔岩蛊' }, { k: 'species', id: 'hail', n: '雹甲蛊' }, { k: 'species', id: 'cordy', n: '虫草蛊' }] },
  { id: 'realm5', n: '五转蛊师', g: '境界', d: '境界到五转', need: { realm: 5 }, after: 'realm4', unlock: [{ k: 'species', id: 'thunder', n: '雷甲蛊' }, { k: 'species', id: 'tortoise', n: '玄龟蛊' }, { k: 'species', id: 'puppet', n: '傀儡蛛' }, { k: 'species', id: 'hairworm', n: '铁线蛊' }] },
  { id: 'trips3', n: '三进三出', g: '渡劫', d: '渡劫 3 次', need: { trips: 3 }, after: 'first_trip', unlock: [{ k: 'species', id: 'silk', n: '蚕茧蛊' }, { k: 'species', id: 'mosq', n: '赤蚊蛊' }] },
  { id: 'trips6', n: '常走秘境', g: '渡劫', d: '渡劫 6 次', need: { trips: 6 }, after: 'trips3', unlock: [{ k: 'species', id: 'click', n: '叩甲蛊' }, { k: 'species', id: 'sheli', n: '舍利蛊' }, { k: 'species', id: 'bat', n: '夜蝠蛊' }, { k: 'food', id: 'zhuanggu', n: '壮骨汤' }] },
  { id: 'trips10', n: '十进秘境', g: '渡劫', d: '渡劫 10 次', need: { trips: 10 }, after: 'trips6', unlock: [{ k: 'species', id: 'cloud', n: '积云蛊' }, { k: 'species', id: 'shine', n: '照夜蛊' }, { k: 'species', id: 'amber', n: '血珀蛊' }, { k: 'species', id: 'ring', n: '年轮蛊' }, { k: 'food', id: 'duwu', n: '毒雾瓶' }, { k: 'food', id: 'siwei', n: '四味酒' }] },
  { id: 'trips15', n: '识途老蛊', g: '渡劫', d: '渡劫 15 次', need: { trips: 15 }, after: 'trips10', unlock: [{ k: 'species', id: 'xueyue', n: '血月蛊' }, { k: 'species', id: 'widow', n: '寡妇蛛' }, { k: 'species', id: 'blink', n: '瞬移蛊' }] },
  { id: 'trips20', n: '踏遍山河', g: '渡劫', d: '渡劫 20 次', need: { trips: 20 }, after: 'trips15', unlock: [{ k: 'species', id: 'orchid', n: '兰螳蛊' }, { k: 'species', id: 'taisui', n: '太岁蛊' }, { k: 'species', id: 'yue', n: '镇岳蛊' }, { k: 'species', id: 'jinchan', n: '金蟾蛊' }] },
  { id: 'clears2', n: '再下一城', g: '渡劫', d: '通关秘境 2 次（打赢最深处的首领，哪个秘境、第几劫都算）', need: { clears: 2 }, after: 'realm1', unlock: [{ k: 'species', id: 'stag', n: '锹甲蛊' }, { k: 'species', id: 'glut', n: '饕虫蛊' }, { k: 'species', id: 'toad', n: '毒蟾蛊' }] },
  { id: 'clears4', n: '连破四关', g: '渡劫', d: '通关秘境 4 次', need: { clears: 4 }, after: 'clears2', unlock: [{ k: 'species', id: 'flint', n: '燧石蛊' }, { k: 'species', id: 'coldcicada', n: '寒蝉蛊' }, { k: 'species', id: 'baiyu', n: '白玉蛊' }, { k: 'food', id: 'yinhun', n: '引魂香' }, { k: 'food', id: 'jinggu', n: '净蛊水' }] },
  { id: 'clears6', n: '六关在握', g: '渡劫', d: '通关秘境 6 次', need: { clears: 6 }, after: 'clears4', unlock: [{ k: 'species', id: 'moveshan', n: '搬山蛊' }, { k: 'species', id: 'magstorm', n: '磁暴蛊' }, { k: 'species', id: 'eclipse', n: '月蚀蛊' }, { k: 'food', id: 'baibao', n: '百宝囊' }] },
  { id: 'clears8', n: '八方来朝', g: '渡劫', d: '通关秘境 8 次', need: { clears: 8 }, after: 'clears6', unlock: [{ k: 'species', id: 'urn', n: '瓮王蛊' }, { k: 'species', id: 'hex', n: '魇蛾蛊' }, { k: 'species', id: 'saw', n: '天牛蛊' }, { k: 'species', id: 'dfly', n: '霆蜓蛊' }] },
  { id: 'clears10', n: '十关无阻', g: '渡劫', d: '通关秘境 10 次', need: { clears: 10 }, after: 'clears8', unlock: [{ k: 'food', id: 'dinghun', n: '定魂香' }] },
  { id: 'merges5', n: '合蛊五次', g: '养蛊', d: '合成 5 次', need: { merges: 5 }, after: 'first_merge', unlock: [{ k: 'species', id: 'rhino', n: '犀角蛊' }, { k: 'species', id: 'gold', n: '金龟蛊' }] },
  { id: 'merges12', n: '炼蛊有成', g: '养蛊', d: '合成 12 次', need: { merges: 12 }, after: 'merges5', unlock: [{ k: 'species', id: 'pyre', n: '焚翅蛊' }, { k: 'species', id: 'icesnail', n: '冰蜗蛊' }, { k: 'species', id: 'lockarm', n: '锁甲蛊' }] },
  { id: 'merges25', n: '炼蛊大家', g: '养蛊', d: '合成 25 次', need: { merges: 25 }, after: 'merges12', unlock: [{ k: 'species', id: 'frost', n: '霜蛉蛊' }, { k: 'species', id: 'lure', n: '迷蝶蛊' }, { k: 'species', id: 'antlion', n: '蚁狮蛊' }, { k: 'species', id: 'mayfly', n: '蜉蝣蛊' }] },
  { id: 'merges40', n: '千炼成器', g: '养蛊', d: '合成 40 次', need: { merges: 40 }, after: 'merges25', unlock: [{ k: 'species', id: 'glacier', n: '玄冰蛊' }, { k: 'species', id: 'fusang', n: '扶桑蛊' }, { k: 'species', id: 'solar', n: '曜日蛊' }] },
  { id: 'feeds12', n: '投喂有方', g: '养蛊', d: '喂食 12 次', need: { feeds: 12 }, after: 'feeder', unlock: [{ k: 'food', id: 'huorong', n: '火绒草' }] },
  { id: 'feeds20', n: '百味蛊厨', g: '养蛊', d: '喂食 20 次', need: { feeds: 20 }, after: 'feeds12', unlock: [{ k: 'food', id: 'bingpo', n: '冰魄珠' }, { k: 'food', id: 'yeming', n: '夜明砂' }, { k: 'food', id: 'lingxi', n: '灵犀角' }] },
  { id: 'feeds30', n: '食谱齐全', g: '养蛊', d: '喂食 30 次', need: { feeds: 30 }, after: 'feeds20', unlock: [{ k: 'food', id: 'taoya', n: '饕餮牙' }, { k: 'food', id: 'shanjiao', n: '撞山角' }, { k: 'food', id: 'chuanxin', n: '穿心簇' }] },
  { id: 'buys30', n: '常客', g: '养蛊', d: '买蛊 30 次', need: { buys: 30 }, after: 'buyer10', unlock: [{ k: 'species', id: 'cricket', n: '促织蛊' }, { k: 'species', id: 'locust', n: '蝗群蛊' }, { k: 'species', id: 'char', n: '炭甲蛊' }] },
  { id: 'buys60', n: '蛊市贵客', g: '养蛊', d: '买蛊 60 次', need: { buys: 60 }, after: 'buys30', unlock: [{ k: 'food', id: 'huotan', n: '火炭心' }, { k: 'food', id: 'lingzhi', n: '灵芝片' }, { k: 'food', id: 'leizao', n: '雷击枣' }, { k: 'food', id: 'xuejing', n: '血精丸' }] },
  { id: 'combos3', n: '三招在手', g: '杀招', d: '让 3 种不同的杀招成形过', need: { combos: 3 }, after: 'first_combo', unlock: [{ k: 'species', id: 'vine', n: '藤蔓蛊' }, { k: 'species', id: 'earthworm', n: '地龙蛊' }, { k: 'food', id: 'yingu', n: '引蛊香' }] },
  { id: 'combos6', n: '推演进阶', g: '杀招', d: '让 6 种不同的杀招成形过', need: { combos: 6 }, after: 'combos3', unlock: [{ k: 'species', id: 'diting', n: '地听肉耳草' }, { k: 'species', id: 'hourglass', n: '沙漏蛊' }, { k: 'combo', id: 'sanzhu2', n: '焚原三豕' }] },
  { id: 'combos10', n: '十招融会', g: '杀招', d: '让 10 种不同的杀招成形过', need: { combos: 10 }, after: 'combos6', unlock: [{ k: 'combo', id: 'jinjia2', n: '万钧金身' }, { k: 'combo', id: 'pojian2', n: '化蝶三生' }, { k: 'food', id: 'zhujiu', n: '青竹酒' }] },
  { id: 'combos15', n: '招中有招', g: '杀招', d: '让 15 种不同的杀招成形过', need: { combos: 15 }, after: 'combos10', unlock: [{ k: 'combo', id: 'leigu2', n: '雷霆万钧' }] },
  { id: 'combos20', n: '万法归宗', g: '杀招', d: '让 20 种不同的杀招成形过', need: { combos: 20 }, after: 'combos15', unlock: [{ k: 'species', id: 'styx', n: '冥蝶蛊' }, { k: 'species', id: 'boneflute', n: '骨笛蛊' }, { k: 'species', id: 'instant', n: '刹那蛊' }, { k: 'combo', id: 'bingfeng2', n: '冰火同炉' }] },
  { id: 'kalpa_open', n: '渡劫之后', g: '劫数', d: '通关任意一个秘境，打开劫数', need: { clears: 1 }, unlock: [{ k: 'feature', id: 'kalpa', n: '劫数' }] },
  { id: 'kalpa1', n: '初历一劫', g: '劫数', d: '通关任意秘境的劫一', need: { kalpa: 1 }, after: 'kalpa_open', unlock: [{ k: 'food', id: 'jingleifu', n: '惊雷符' }, { k: 'food', id: 'fengxingfu', n: '风行符' }] },
  { id: 'kalpa3', n: '三劫不死', g: '劫数', d: '通关任意秘境的劫三', need: { kalpa: 3 }, after: 'kalpa1', unlock: [{ k: 'species', id: 'nirvana', n: '涅火蛾' }, { k: 'combo', id: 'suanwu2', n: '算尽天机' }, { k: 'food', id: 'duanhun', n: '断魂针' }] },
  { id: 'kalpa5', n: '五劫加身', g: '劫数', d: '通关任意秘境的劫五', need: { kalpa: 5 }, after: 'kalpa3', unlock: [{ k: 'species', id: 'guangyin', n: '春秋蝉' }, { k: 'food', id: 'guangyinxiang', n: '光阴香' }, { k: 'food', id: 'houtufu', n: '厚土符' }] },
  { id: 'kalpa7', n: '七劫过尽', g: '劫数', d: '通关任意秘境的劫七', need: { kalpa: 7 }, after: 'kalpa5', unlock: [{ k: 'species', id: 'fate', n: '织命蛛' }] },
  { id: 'kalpa10', n: '十劫圆满', g: '劫数', d: '通关任意秘境的劫十', need: { kalpa: 10 }, after: 'kalpa7', unlock: [{ k: 'species', id: 'jiuxiao', n: '九霄蛊' }, { k: 'combo', id: 'zhichi2', n: '神游万里' }] },
  { id: 'ch_r1q7', n: '一转亦能', g: '挑战', d: '只用一转蛊，通关额度 7 及以上的秘境', need: { r1q: 7 }, after: 'realm1', unlock: [{ k: 'species', id: 'qingtian', n: '擎天蛊' }, { k: 'combo', id: 'maodu', n: '毛蜱吮毒' }, { k: 'combo', id: 'xiaobing', n: '小卒推山' }] },
  { id: 'ch_r2q10', n: '低转为本', g: '挑战', d: '只用一转、二转蛊，通关额度 10 及以上的秘境', need: { r2q: 10 }, after: 'realm2', unlock: [{ k: 'combo', id: 'baiyi2', n: '火蚁燎原' }, { k: 'combo', id: 'yingxue', n: '萤雪映书' }, { k: 'food', id: 'shengzhuan', n: '升转露' }] },
  { id: 'ch_no5q14', n: '不仗高转', g: '挑战', d: '不带五转和仙蛊，通关额度 14 及以上的秘境', need: { no5q: 14 }, after: 'realm3', unlock: [{ k: 'species', id: 'dingxian', n: '定仙游' }, { k: 'combo', id: 'yiri2', n: '一梦千秋' }] },
  { id: 'ch_few3', n: '三蛊破阵', g: '挑战', d: '出场不超过 3 只，通关额度 10 及以上的秘境', need: { few3q: 10 }, after: 'realm2', unlock: [{ k: 'species', id: 'chiba', n: '赤魃蛊' }] },
  { id: 'ch_mono', n: '一道到底', g: '挑战', d: '出场的蛊全属同一道，通关额度 10 及以上的秘境', need: { monoq: 10 }, after: 'realm2', unlock: [{ k: 'trip', id: 'maigu', n: '埋骨荒原' }, { k: 'combo', id: 'wudu2', n: '万毒归宗' }] },
  { id: 'ch_flawless', n: '全身而退', g: '挑战', d: '一只蛊都没倒下，通关额度 14 及以上的秘境', need: { flawq: 14 }, after: 'realm3', unlock: [{ k: 'combo', id: 'richu2', n: '凤栖扶桑' }] },
  { id: 'ch_nocombo', n: '不靠杀招', g: '挑战', d: '一个杀招都没成形，通关额度 10 及以上的秘境', need: { nocomboq: 10 }, after: 'realm2', unlock: [{ k: 'combo', id: 'xuanwu2', n: '玄武负山' }] },
  { id: 'ch_daos4', n: '四道皆通', g: '挑战', d: '用 4 个不同的道当主力各通关一次（主力 = 出场只数最多的道，并列都算）', need: { daos: 4 }, after: 'clears2', unlock: [{ k: 'combo', id: 'jiutian2', n: '九霄雷劫' }, { k: 'trip', id: 'tianting', n: '天庭' }] },
  { id: 'ch_daos16', n: '十六道归一', g: '挑战', d: '十六个道都当过一次主力通关', need: { d_li: 1, d_yan: 1, d_bing: 1, d_jin: 1, d_mu: 1, d_tu: 1, d_lei: 1, d_guang: 1, d_an: 1, d_xue: 1, d_du: 1, d_zhi: 1, d_hun: 1, d_nu: 1, d_yu: 1, d_zhou: 1 }, after: 'ch_daos4', unlock: [{ k: 'species', id: 'zhihui', n: '智慧蛊' }] },
];
// 一开始就锁着、要靠道途解锁的东西（不在这里的默认可用）。开局能买的蛊 34 种：
//   boar tiger fire fireant snowsilk iron yupi thorn stick shengji dung stonecase static firefly yueguang ink leech hairy cent webspider bone twin ant aphid inch asahi mantis queen cicada mole gecko scorp drum moth
export const LOCKED = {
  species: [
    'wasp', 'spider', 'qingfu', 'bomb', 'silk', 'mosq', 'rhino', 'gold', 'qant', 'flea', 'bfly', 'sleep',
    'stag', 'glut', 'toad', 'cricket', 'locust', 'mirror', 'hive', 'fly', 'bury', 'frost', 'lure', 'antlion',
    'mayfly', 'thunder', 'tortoise', 'puppet', 'hairworm', 'urn', 'hex', 'saw', 'dfly', 'orchid', 'taisui', 'yue',
    'jinchan', 'guangyin', 'fate', 'nirvana', 'xiongli', 'qingtian', 'pyre', 'char', 'flint', 'magma', 'snowflea', 'icesnail',
    'coldcicada', 'hail', 'glacier', 'lockarm', 'baiyu', 'vine', 'cordy', 'fusang', 'earthworm', 'moveshan', 'jingzhe', 'click',
    'cloud', 'magstorm', 'jiuxiao', 'sheli', 'shine', 'solar', 'bat', 'eclipse', 'styx', 'tick', 'bloodant', 'amber',
    'xueyue', 'chiba', 'widow', 'jiuchong', 'diting', 'zhihui', 'will', 'boneflute', 'strider', 'blink', 'dingxian', 'hourglass',
    'ring', 'instant',
  ],
  food: ['map', 'yuelan', 'zhujiu', 'huotan', 'lingzhi', 'leizao', 'huorong', 'bingpo', 'yeming', 'taoya', 'shanjiao', 'dinghun', 'jingleifu', 'guangyinxiang', 'houtufu', 'fengxingfu', 'xuejing', 'siwei', 'zhuanggu', 'duwu', 'duanhun', 'lingxi', 'duji', 'zhenshi', 'juqi', 'chuanxin', 'yinhun', 'jinggu', 'baibao', 'yingu', 'shengzhuan'],
  combo: ['yingxue', 'maodu', 'xiaobing', 'sanzhu2', 'jinjia2', 'pojian2', 'xuanwu2', 'leigu2', 'jiutian2', 'wudu2', 'bingfeng2', 'baiyi2', 'suanwu2', 'richu2', 'zhichi2', 'yiri2'],
  trip: ['maigu', 'tianting'],
  feature: ['kalpa'],
};
export const STARTERS = ['boar', 'tiger', 'fire', 'fireant', 'snowsilk', 'iron', 'yupi', 'thorn', 'stick', 'shengji', 'dung', 'stonecase', 'static', 'firefly', 'yueguang', 'ink', 'leech', 'hairy', 'cent', 'webspider', 'bone', 'twin', 'ant', 'aphid', 'inch', 'asahi', 'mantis', 'queen', 'cicada', 'mole', 'gecko', 'scorp', 'drum', 'moth'];

// 劫数（design 2.7）：通关一个秘境开它的劫一；劫 N 通关开劫 N+1，最高劫十。要先点亮「渡劫之后」解锁 kalpa 玩法。
// 每个秘境打到第几劫由秘境一侧记在存档里（best = 这个秘境通关过的最高劫，普通难度通关记 0，没通关过记 -1）。
export const KALPA = { max: 10, feature: 'kalpa' };
export const kalpaOpen = best => (best == null || best < 0 ? 0 : Math.min(KALPA.max, (best | 0) + 1));   // 这个秘境现在最高能选第几劫（0 = 只有普通难度）

// 秘境通关时要发的道途事件。info = { quota 秘境额度, ranks [出场蛊转数，仙蛊记 6], daos [出场蛊的道], fallen 这一趟倒下几只（救回的也算）,
//   combos 这一趟成形过的杀招数, kalpa 这次打的第几劫（普通 0）, cnt 道途现有计数 M.cnt }
// 返回 [[计数名, 数, set], …]，按顺序 metaEmit(M, k, n, { set }) 即可（召唤物不算出场蛊）。
export function clearEvents(info = {}) {
  const q = info.quota | 0, rk = info.ranks || [], ds = info.daos || [], cnt = info.cnt || {}, ev = [['clears', 1, false]];
  if (rk.length) {
    if (rk.every(r => r <= 1)) ev.push(['r1q', q, true]);
    if (rk.every(r => r <= 2)) ev.push(['r2q', q, true]);
    if (rk.every(r => r < 5)) ev.push(['no5q', q, true]);
    if (rk.length <= 3) ev.push(['few3q', q, true]);
  }
  if (ds.length && ds.every(d => d === ds[0])) ev.push(['monoq', q, true]);
  if (!(info.fallen > 0)) ev.push(['flawq', q, true]);
  if (!(info.combos > 0)) ev.push(['nocomboq', q, true]);
  const by = {}; ds.forEach(d => { by[d] = (by[d] || 0) + 1; }); const top = Math.max(0, ...Object.values(by)), main = Object.keys(by).filter(d => by[d] === top);
  main.forEach(d => ev.push(['d_' + d, 1, false]));
  const had = new Set(Object.keys(cnt).filter(k => /^d_/.test(k) && cnt[k] > 0)); main.forEach(d => had.add('d_' + d));
  ev.push(['daos', had.size, true]);
  if (info.kalpa > 0) ev.push(['kalpa', info.kalpa | 0, true]);
  return ev;
}
