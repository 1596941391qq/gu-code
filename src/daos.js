// 蛊码 GuCode · 道（流派）。docs/design.md 第 1 节「羁绊分三层」的第一层 + 2.8「道共鸣要有体感」。纯数据 + 纯函数，不 import 任何文件。
// 16 道都是原著里的流派名（canon: true）。同一道的蛊在空窍里凑到 2 只、4 只时触发共鸣（4 只档替换 2 只档，不叠加），没有 6 只档。
// 共鸣要有体感（design 2.8）：每道 2 只、4 只各给一档基础加成（攻、血或护体），2 只在 +12%～+20%、4 只在 +30%～+45% 之间按这一道的特色取值（不低于下限），再加这一道的小特色。
// 基础加成按模拟逐道定（同 tools/sim.mjs 第 4 节：同一底队，A 换进 4 只同道、B 换进 4 只别道，各 400 局、两边各站一次）：16 道都在 45%–59%。
// 小特色强的道取下限（光道、暗道），特色平平的取上限（土道）；还偏强就削特色条款或物种，不削共鸣。改小特色或物种后用 tune/daotune.mjs 重跑。
// 异道道痕相冲：写在道上 clash: { 道id: 倍率 }，两道同时有共鸣时，两边共鸣都打折（只削共鸣，不影响杀招）。
//
// 格式（docs/battle-spec.md 7.1 / 7.2）：DAOS[i] = { id, n, color, d, canon, clash, r2, r4 }
//   r* = { d 一句话（写的是玩家实际拿到的数）, atk / hp / spd / sh / gp, eff?: [{ when, op, … }] }
//   atk / hp / spd / sh / gp 按引擎 RES_K（现为 0.5）折算前写：表里写 30，玩家拿到 15%，d 里写 15%。改 RES_K 要连 d 一起改。
//   eff 的施放者是这一道的每只蛊自己，只作用于自己（不写全队效果，免得只数越多叠得越多）；up: 0 = 不随转数涨。
const E = (when, op, tg, o = {}) => ({ when, op, tg, up: 0, ...o });
export const DAOS = [
  { id: 'li', n: '力道', color: '#b5301f', d: '一身蛮力，打满血的更狠', canon: true,
    r2: { d: '力道的蛊攻 +13%', atk: 26 },
    r4: { d: '力道的蛊攻 +30%；打满血的敌蛊伤害 +5%', atk: 60, eff: [E('deal', 'mul', null, { v: 1.05, if: 'tg.full' })] } },
  { id: 'yan', n: '炎道', color: '#d0632a', d: '普攻带火', canon: true, clash: { bing: 0.5 },
    r2: { d: '炎道的蛊攻 +20%，普攻让目标灼烧 2 轮（攻击 5%）', atk: 40, eff: [E('attack', 'st', 'tg', { k: 'burn', n: 2, atk: 0.05 })] },
    r4: { d: '炎道的蛊攻 +45%，普攻让目标灼烧 2 轮（攻击 8%）', atk: 90, eff: [E('attack', 'st', 'tg', { k: 'burn', n: 2, atk: 0.08 })] } },
  { id: 'bing', n: '冰雪道', color: '#6a9cc0', d: '普攻让敌蛊冰寒', canon: true, clash: { yan: 0.5 },
    r2: { d: '冰雪道的蛊血 +13%，普攻 25% 机会让目标冰寒 1 层', hp: 26, eff: [E('attack', 'st', 'tg', { k: 'chill', n: 1, chance: 0.25 })] },
    r4: { d: '冰雪道的蛊血 +30%，普攻 45% 机会让目标冰寒 1 层', hp: 60, eff: [E('attack', 'st', 'tg', { k: 'chill', n: 1, chance: 0.45 })] } },
  { id: 'jin', n: '金道', color: '#a8803e', d: '开战披甲', canon: true, clash: { mu: 0.5 },
    r2: { d: '金道的蛊开战得到最大血量 19% 的护体', sh: 38 },
    r4: { d: '金道的蛊开战得到最大血量 45% 的护体，受到的伤害 -10%', sh: 90, eff: [E('take', 'mul', null, { v: 0.9 })] } },
  { id: 'mu', n: '木道', color: '#5e8a4a', d: '慢慢回血', canon: true, clash: { jin: 0.5 },
    r2: { d: '木道的蛊血 +12%，每轮回复最大血量 1%', hp: 24, eff: [E('round', 'heal', 'self', { mx: 0.01 })] },
    r4: { d: '木道的蛊血 +30%，每轮回复最大血量 1.5%', hp: 60, eff: [E('round', 'heal', 'self', { mx: 0.015 })] } },
  { id: 'tu', n: '土道', color: '#8a6a3a', d: '皮糙肉厚，站前排更稳', canon: true, clash: { lei: 0.5 },
    r2: { d: '土道的蛊血 +20%', hp: 40 },
    r4: { d: '土道的蛊血 +45%；站在最前时受到的伤害 -10%', hp: 90, eff: [E('take', 'mul', null, { v: 0.9, if: 'front' })] } },
  { id: 'lei', n: '雷道', color: '#3a6aa8', d: '出手快，偶尔麻住对手', canon: true, clash: { tu: 0.5 },
    r2: { d: '雷道的蛊攻 +18%、速 +5%，普攻 5% 机会让目标眩晕一次', atk: 36, spd: 10, eff: [E('attack', 'st', 'tg', { k: 'stun', n: 1, chance: 0.05 })] },
    r4: { d: '雷道的蛊攻 +42%、速 +10%，普攻 15% 机会让目标眩晕一次', atk: 84, spd: 20, eff: [E('attack', 'st', 'tg', { k: 'stun', n: 1, chance: 0.15 })] } },
  { id: 'guang', n: '光道', color: '#c9a53a', d: '光比谁都快，专打被照亮的', canon: true, clash: { an: 0.5 },
    r2: { d: '光道的蛊攻 +12%、速 +5%；普攻 20% 机会照亮目标（打上印记 1 轮）', atk: 24, spd: 10, eff: [E('attack', 'st', 'tg', { k: 'mark', n: 1, chance: 0.2 })] },
    r4: { d: '光道的蛊攻 +30%、速 +10%；普攻照亮目标（印记 1 轮）', atk: 60, spd: 20, eff: [E('attack', 'st', 'tg', { k: 'mark', n: 1 })] } },
  { id: 'an', n: '暗道', color: '#3a3346', d: '先在暗处做好记号', canon: true, clash: { guang: 0.5 },
    r2: { d: '暗道的蛊攻 +12%；开战给敌方攻最高的蛊打上印记（第 1 轮）', atk: 24, eff: [E('start', 'st', 'foe.top', { k: 'mark', n: 2 })] },
    r4: { d: '暗道的蛊攻 +30%，开战给敌方攻最高的蛊打上印记', atk: 60, eff: [E('start', 'st', 'foe.top', { k: 'mark', n: 2 })] } },
  { id: 'xue', n: '血道', color: '#8a1f2b', d: '打出去的伤害吸回来', canon: true,
    r2: { d: '血道的蛊血 +16%，普攻后回复这一下的 15%', hp: 32, eff: [E('attack', 'heal', 'self', { n: 0.15 })] },
    r4: { d: '血道的蛊攻 +10%、血 +37%，普攻后回复这一下的 25%', atk: 20, hp: 74, eff: [E('attack', 'heal', 'self', { n: 0.25 })] } },
  { id: 'du', n: '毒道', color: '#4f7a3a', d: '普攻让敌蛊中毒', canon: true,
    r2: { d: '毒道的蛊攻 +20%，普攻让目标中毒（攻击 6%）', atk: 40, eff: [E('attack', 'st', 'tg', { k: 'psn', atk: 0.06 })] },
    r4: { d: '毒道的蛊攻 +45%，普攻让目标中毒（攻击 10%）；打中毒的敌蛊伤害 +10%', atk: 90, eff: [E('attack', 'st', 'tg', { k: 'psn', atk: 0.1 }), E('deal', 'mul', null, { v: 1.1, if: 'tg.psn' })] } },
  { id: 'zhi', n: '智道', color: '#3d5a8a', d: '谋定而后动，主动技来得早', canon: true,
    r2: { d: '智道的蛊攻、血各 +16%，有主动技的开战蛊力 20', atk: 32, hp: 32, gp: 40 },
    r4: { d: '智道的蛊攻、血各 +34%，有主动技的开战蛊力 40；开战敌方速最快的行动条推后 10%', atk: 68, hp: 68, gp: 80, eff: [E('start', 'delay', 'foe.fast', { v: 0.1 })] } },
  { id: 'hun', n: '魂道', color: '#5a4a7a', d: '同伴倒下，魂气更盛', canon: true,
    r2: { d: '魂道的蛊攻 +19%；有友蛊倒下时再攻 +3%（最多 2 次）', atk: 38, eff: [E('allyDeath', 'buff', 'self', { atk: 0.03, max: 2 })] },
    r4: { d: '魂道的蛊攻 +35%；有友蛊倒下时再攻 +5%、血 +2%（最多 2 次）', atk: 70, eff: [E('allyDeath', 'buff', 'self', { atk: 0.05, hp: 0.02, max: 2 })] } },
  { id: 'nu', n: '奴道', color: '#7a5a3a', d: '驱使召唤物，越多越壮', canon: true,
    r2: { d: '奴道的蛊攻 +7%、血 +19%；每有友蛊被召唤，攻 +4%（最多 5 次）', atk: 14, hp: 38, eff: [E('summon', 'buff', 'self', { atk: 0.04, max: 5 })] },
    r4: { d: '奴道的蛊攻 +14%、血 +45%；每有友蛊被召唤，攻 +6%（最多 6 次）', atk: 28, hp: 90, eff: [E('summon', 'buff', 'self', { atk: 0.06, max: 6 })] } },
  { id: 'yu', n: '宇道', color: '#4a8a86', d: '站位腾挪，后排更安全', canon: true,
    r2: { d: '宇道的蛊血 +18%、速 +5%；身前有友蛊时每轮得到最大血量 6% 的护体', hp: 36, spd: 10, eff: [E('round', 'shield', 'self', { mx: 0.06, if: 'back' })] },
    r4: { d: '宇道的蛊血 +40%、速 +10%；身前有友蛊时每轮得到 10% 护体', hp: 80, spd: 20, eff: [E('round', 'shield', 'self', { mx: 0.1, if: 'back' })] } },
  { id: 'zhou', n: '宙道', color: '#8a7a3a', d: '拖得越久越强', canon: true,
    r2: { d: '宙道的蛊血 +12%；第 3 轮起每轮攻 +2%', hp: 24, eff: [E('round', 'buff', 'self', { atk: 0.02, if: 'round>=3' })] },
    r4: { d: '宙道的蛊血 +30%；第 3 轮起每轮攻 +3%、血 +1.5%', hp: 60, eff: [E('round', 'buff', 'self', { atk: 0.03, hp: 0.015, if: 'round>=3' })] } },
];
export const DAO = Object.fromEntries(DAOS.map(d => [d.id, d]));
export const DAO_KEYS = DAOS.map(d => d.id);
export const DAO_TIERS = [2, 4];

// 道痕相冲：两道同时有共鸣（各 ≥2 只）时，两边共鸣都 ×倍率（数值写在各道的 clash 上；这里列一份给界面和图鉴）
export const CLASH_MUL = 0.5;
export const DAO_CLASH = [['yan', 'bing', CLASH_MUL], ['guang', 'an', CLASH_MUL], ['jin', 'mu', CLASH_MUL], ['lei', 'tu', CLASH_MUL]];
export const CLASH_NOTE = { yan: '炎道与冰雪道相冲（水火不容）', bing: '冰雪道与炎道相冲（水火不容）', guang: '光道与暗道相冲', an: '暗道与光道相冲', jin: '金道与木道相冲（金克木）', mu: '木道与金道相冲（金克木）', lei: '雷道与土道相冲（土能引雷入地）', tu: '土道与雷道相冲（土能引雷入地）' };

// 120 种蛊的道（与 bestiary2.js 的 DAO120 一致，tools/v2-data-check.mjs 会核对）；每道 7–8 种，各转数都有
const M = {
  li:    'boar drum tiger stag glut locust xiongli qingtian',
  yan:   'fire bomb nirvana fireant pyre char flint magma',
  bing:  'frost snowsilk snowflea icesnail coldcicada hail glacier',
  jin:   'iron rhino gold jinchan saw yupi lockarm baiyu',
  mu:    'thorn stick silk taisui shengji vine cordy fusang',
  tu:    'dung mole antlion tortoise yue stonecase earthworm moveshan',
  lei:   'thunder dfly static jingzhe click cloud magstorm jiuxiao',
  guang: 'moth firefly mirror yueguang sheli shine solar',
  an:    'mantis hex sleep ink bat eclipse styx',
  xue:   'leech mosq urn tick bloodant amber xueyue chiba',
  du:    'scorp hairy cent wasp toad hairworm widow',
  zhi:   'webspider cricket lure orchid jiuchong diting zhihui',
  hun:   'bone cicada qingfu fly bury will boneflute',
  nu:    'queen ant aphid spider qant hive puppet twin',
  yu:    'gecko flea bfly strider inch blink dingxian',
  zhou:  'mayfly guangyin fate asahi hourglass ring instant',
};
export const DAO_OF = Object.fromEntries(Object.entries(M).flatMap(([d, s]) => s.split(' ').map(id => [id, d])));
// core.js 现在用 DAO_BY_SCHOOL 给没写 dao 的物种兜底；物种都带 dao 之后用不上，留着兼容旧流派标签
export const DAO_BY_SCHOOL = { 召唤: 'nu', 亡语: 'hun', 成长: 'zhou', 反伤: 'mu', 站位: 'yu', 控制: 'zhi', 毒: 'du', 护体: 'jin', 减伤: 'tu', 开锋: 'li', 群攻: 'lei', 斩杀: 'an', 续航: 'xue', 爆发: 'yan', 破甲: 'jin' };

// 共鸣计数：lineup = 空窍里的蛊（{ sp } 数组，召唤物不算）。返回 { 道id: { n 只数, tier 0/2/4, eff 生效档, mul 相冲后的倍率, clash 相冲的道 } }
export function daoCount(lineup) {
  const out = {};
  for (const g of lineup || []) { const d = g && DAO_OF[g.sp]; if (d) (out[d] ||= { n: 0 }).n++; }
  for (const [d, o] of Object.entries(out)) { o.tier = o.n >= 4 ? 4 : o.n >= 2 ? 2 : 0; o.eff = o.tier ? DAO[d]['r' + o.tier] : null; o.mul = 1; o.clash = null; }
  for (const [a, b, m] of DAO_CLASH) if (out[a] && out[b] && out[a].tier && out[b].tier) { out[a].mul = out[b].mul = m; out[a].clash = b; out[b].clash = a; }
  return out;
}
// 空窍上方的一句话，例：「力道 3/4 · 力道的蛊攻 +6%」「炎道 2/4 · …（与冰雪道相冲，效果减半）」
export function daoLine(d, info) {
  const o = DAO[d]; if (!o || !info) return '';
  return `${o.n} ${info.n}/${info.n >= 2 ? 4 : 2}` + (info.eff ? ` · ${info.eff.d}` : '') + (info.clash ? `（与${DAO[info.clash].n}相冲，效果减半）` : '');
}
