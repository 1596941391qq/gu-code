// 蛊码 GuCode · 道（流派）。docs/design.md 第 1 节「羁绊分三层」的第一层。纯数据 + 纯函数，不 import 任何文件。
// 每种蛊属于原著里的一个流派（道）。同一道的蛊在空窍里凑到 2、4、6 只时触发共鸣（高档替换低档，不叠加）。
// 共鸣只看阵容、开战时算一次，复盘可复现。异道道痕相冲：DAO_CLASH 里的一对道同时触发共鸣时，两边的共鸣都按 CLASH_MUL 打折。
//
// 格式（docs/battle-spec.md 7.1）：DAOS[i] = { id, n 名, color 道色, d 一句话风格, r2 / r4 / r6 }
//   r* = { d 一句话, atk / hp / spd = 开战时本道的蛊各加百分之几, sh = 开战护体（最大血量百分比）, eff?: [{ when, op, … }] }
//   eff 的施放者是这一道的每只蛊自己；带 once: 1 的条目（作用于全队或敌方全体的）同一道只由站得最靠前的那只放一次，免得只数越多叠得越多。
//   eff 里 up: 0 = 不随转数涨（共鸣是阵容奖励，不吃转数倍率）。
const E = (when, op, tg, o = {}) => ({ when, op, tg, up: 0, ...o });
export const DAOS = [
  { id: 'li', n: '力道', color: '#b5301f', d: '越打越凶，先手爆发',
    r2: { d: '力道的蛊攻 +10%', atk: 10 },
    r4: { d: '力道的蛊攻 +20%，第一次出手伤害 ×1.5', atk: 20, eff: [E('deal', 'mul', 'self', { v: 1.5, if: 'first' })] },
    r6: { d: '力道的蛊攻 +35%，第一次出手伤害翻倍', atk: 35, eff: [E('deal', 'mul', 'self', { v: 2, if: 'first' })] } },
  { id: 'yan', n: '炎道', color: '#d0632a', d: '灼烧与群伤，越烧越旺',
    r2: { d: '炎道的蛊技能伤害 +15%', eff: [E('deal', 'mul', 'self', { v: 1.15, if: 'kind=skill' })] },
    r4: { d: '炎道的蛊技能伤害 +30%；普攻命中让目标灼烧 2 轮（每轮掉该蛊攻击 10%）', eff: [E('deal', 'mul', 'self', { v: 1.3, if: 'kind=skill' }), E('attack', 'st', 'tg', { k: 'burn', n: 2, atk: 0.1 })] },
    r6: { d: '炎道的蛊技能伤害 +50%；每轮开始敌方全体灼烧 2 轮（每轮掉攻击 10%）', eff: [E('deal', 'mul', 'self', { v: 1.5, if: 'kind=skill' }), E('round', 'st', 'foe.all', { k: 'burn', n: 2, atk: 0.1, once: 1 })] } },
  { id: 'bing', n: '冰雪道', color: '#6a9cc0', d: '寒气拖慢对面的出手',
    r2: { d: '开战时敌方全体速 -10%', eff: [E('start', 'buff', 'foe.all', { spd: -0.1, once: 1 })] },
    r4: { d: '开战时敌方全体速 -20%；冰雪道的蛊打中谁，谁的速再 -5%（可叠）', eff: [E('start', 'buff', 'foe.all', { spd: -0.2, once: 1 }), E('attack', 'buff', 'tg', { spd: -0.05 })] },
    r6: { d: '开战时敌方全体速 -30%；打中谁，谁的速再 -8%、行动条推后 20%', eff: [E('start', 'buff', 'foe.all', { spd: -0.3, once: 1 }), E('attack', 'buff', 'tg', { spd: -0.08 }), E('attack', 'push', 'tg', { v: 0.2 })] } },
  { id: 'jin', n: '金道', color: '#a8803e', d: '护体减伤，硬扛到底',
    r2: { d: '金道的蛊开战得到最大血量 10% 的护体', sh: 10 },
    r4: { d: '金道的蛊开战得到 20% 护体，受到的伤害 -10%', sh: 20, eff: [E('take', 'mul', 'self', { v: 0.9 })] },
    r6: { d: '金道的蛊开战得到 30% 护体，受到的伤害 -15%', sh: 30, eff: [E('take', 'mul', 'self', { v: 0.85 })] } },
  { id: 'mu', n: '木道', color: '#5e8a4a', d: '回复与生长，越拖越厚',
    r2: { d: '木道的蛊每轮开始回复最大血量 4%', eff: [E('round', 'heal', 'self', { mx: 0.04 })] },
    r4: { d: '木道的蛊每轮回复 6%，其余友蛊回复 2%', eff: [E('round', 'heal', 'self', { mx: 0.04 }), E('round', 'heal', 'ally.all', { tmx: 0.02, once: 1 })] },
    r6: { d: '全体友蛊每轮回复 6%，木道的蛊另得 4% 护体', eff: [E('round', 'heal', 'ally.all', { tmx: 0.06, once: 1 }), E('round', 'shield', 'self', { mx: 0.04 })] } },
  { id: 'tu', n: '土道', color: '#8a6a3a', d: '厚重稳固，前排难破',
    r2: { d: '土道的蛊血 +15%', hp: 15 },
    r4: { d: '土道的蛊血 +25%，站最前时受到的伤害 -15%', hp: 25, eff: [E('take', 'mul', 'self', { v: 0.85, if: 'front' })] },
    r6: { d: '土道的蛊血 +40%，站最前时受到的伤害 -25%', hp: 40, eff: [E('take', 'mul', 'self', { v: 0.75, if: 'front' })] } },
  { id: 'lei', n: '雷道', color: '#3a6aa8', d: '麻痹与连锁，打乱出手',
    r2: { d: '雷道的蛊普攻时 12% 机会让目标眩晕一次', eff: [E('attack', 'st', 'tg', { k: 'stun', n: 1, chance: 0.12 })] },
    r4: { d: '眩晕机会 25%；普攻时电光溅到随机一只敌蛊（攻击 15%）', eff: [E('attack', 'st', 'tg', { k: 'stun', n: 1, chance: 0.25 }), E('attack', 'dmg', 'foe.rand', { atk: 0.15 })] },
    r6: { d: '眩晕机会 35%；电光溅到随机两只敌蛊（各攻击 20%）', eff: [E('attack', 'st', 'tg', { k: 'stun', n: 1, chance: 0.35 }), E('attack', 'dmg', 'foe.rand:2', { atk: 0.2 })] } },
  { id: 'guang', n: '光道', color: '#c9a53a', d: '快如流光，一击照破',
    r2: { d: '光道的蛊速 +15%', spd: 15 },
    r4: { d: '光道的蛊速 +25%，出手 15% 机会暴击（伤害翻倍）', spd: 25, eff: [E('deal', 'mul', 'self', { v: 2, chance: 0.15 })] },
    r6: { d: '光道的蛊速 +35%，暴击机会 30%', spd: 35, eff: [E('deal', 'mul', 'self', { v: 2, chance: 0.3 })] } },
  { id: 'an', n: '暗道', color: '#3a3346', d: '藏在暗处，偷袭后排',
    r2: { d: '暗道的蛊普攻命中后给目标打上暗印 1 轮（受到的伤害 +25%）', eff: [E('attack', 'st', 'tg', { k: 'mark', n: 1 })] },
    r4: { d: '暗印 2 轮；开战时暗道的蛊先偷袭敌方末位（攻击 50%）', eff: [E('attack', 'st', 'tg', { k: 'mark', n: 2 }), E('start', 'dmg', 'foe.last', { atk: 0.5 })] },
    r6: { d: '暗印 2 轮；开战偷袭末位（攻击 100%）；打带暗印的敌蛊伤害 +20%', eff: [E('attack', 'st', 'tg', { k: 'mark', n: 2 }), E('start', 'dmg', 'foe.last', { atk: 1 }), E('deal', 'mul', 'self', { v: 1.2, if: 'tg.mark' })] } },
  { id: 'xue', n: '血道', color: '#8a1f2b', d: '吸血续命，以伤换伤',
    r2: { d: '血道的蛊血 +8%，普攻后回复伤害的 10%', hp: 8, eff: [E('attack', 'heal', 'self', { n: 0.1 })] },
    r4: { d: '血道的蛊血 +15%，回复伤害的 20%', hp: 15, eff: [E('attack', 'heal', 'self', { n: 0.2 })] },
    r6: { d: '血道的蛊血 +20%，回复伤害的 30%', hp: 20, eff: [E('attack', 'heal', 'self', { n: 0.3 })] } },
  { id: 'du', n: '毒道', color: '#4f7a3a', d: '中毒越深越赚，拖着打',
    r2: { d: '毒道的蛊普攻命中时上毒（每轮掉该蛊攻击 10%）', eff: [E('attack', 'st', 'tg', { k: 'psn', atk: 0.1 })] },
    r4: { d: '上毒 15%；开战时敌方全体中毒（每轮掉各自最大血量 3%）', eff: [E('attack', 'st', 'tg', { k: 'psn', atk: 0.15 }), E('start', 'st', 'foe.all', { k: 'psn', tmx: 0.03, once: 1 })] },
    r6: { d: '上毒 20%；开战时敌方全体中毒（每轮掉各自最大血量 5%）', eff: [E('attack', 'st', 'tg', { k: 'psn', atk: 0.2 }), E('start', 'st', 'foe.all', { k: 'psn', tmx: 0.05, once: 1 })] } },
  { id: 'zhi', n: '智道', color: '#3d5a8a', d: '算计与控制，先削弱对面',
    r2: { d: '开战时敌方攻最高的蛊攻 -10%', eff: [E('start', 'buff', 'foe.top', { atk: -0.1, once: 1 })] },
    r4: { d: '开战时敌方全体攻 -10%，攻最高的那只再 -10%', eff: [E('start', 'buff', 'foe.all', { atk: -0.1, once: 1 }), E('start', 'buff', 'foe.top', { atk: -0.1, once: 1 })] },
    r6: { d: '开战时敌方全体攻 -15%，前 2 轮蛊力不涨', eff: [E('start', 'buff', 'foe.all', { atk: -0.15, once: 1 }), E('start', 'st', 'foe.all', { k: 'seal', n: 2, once: 1 })] } },
  { id: 'hun', n: '魂道', color: '#5a4a7a', d: '倒下也有用，亡语接力',
    r2: { d: '友蛊每倒下一只，魂道的蛊攻血各 +6%', eff: [E('allyDeath', 'buff', 'self', { atk: 0.06, hp: 0.06 })] },
    r4: { d: '友蛊每倒下一只，全体友蛊攻血各 +8%', eff: [E('allyDeath', 'buff', 'ally.all', { atk: 0.08, hp: 0.08, once: 1 })] },
    r6: { d: '友蛊每倒下一只，全体友蛊攻血各 +12%；魂道的蛊倒下时全体友蛊回复 10%', eff: [E('allyDeath', 'buff', 'ally.all', { atk: 0.12, hp: 0.12, once: 1 }), E('death', 'heal', 'ally.all', { tmx: 0.1 })] } },
  { id: 'nu', n: '奴道', color: '#7a5a3a', d: '召唤成群，以多打少',
    r2: { d: '友方召唤物出生时攻血 +20%', eff: [E('summon', 'buff', 'tg', { atk: 0.2, hp: 0.2, once: 1 })] },
    r4: { d: '召唤物攻血 +40%；开战时召来一只兵蚁（本蛊攻血的 25%）', eff: [E('summon', 'buff', 'tg', { atk: 0.4, hp: 0.4, once: 1 }), E('start', 'summon', 'self', { sp: 'antling', atk: 0.25, mx: 0.25, at: 'back', once: 1 })] },
    r6: { d: '召唤物攻血 +60%；开战时召来两只兵蚁（各 25%）', eff: [E('summon', 'buff', 'tg', { atk: 0.6, hp: 0.6, once: 1 }), E('start', 'summon', 'self', { sp: 'antling', atk: 0.25, mx: 0.25, at: 'back', count: 2, once: 1 })] } },
  { id: 'yu', n: '宇道', color: '#4a8a86', d: '挪移站位，后排安稳',
    r2: { d: '宇道的蛊不在最前时受到的伤害 -10%', eff: [E('take', 'mul', 'self', { v: 0.9, if: 'back' })] },
    r4: { d: '不在最前时受到的伤害 -20%；换到最前那一刻得到最大血量 15% 的护体', eff: [E('take', 'mul', 'self', { v: 0.8, if: 'back' }), E('front', 'shield', 'self', { mx: 0.15 })] },
    r6: { d: '不在最前 -30%，换到最前得 25% 护体；开战行动条提前 20%', eff: [E('take', 'mul', 'self', { v: 0.7, if: 'back' }), E('front', 'shield', 'self', { mx: 0.25 }), E('start', 'pull', 'self', { v: 0.2 })] } },
  { id: 'zhou', n: '宙道', color: '#8a7a3a', d: '后劲十足，拖到后面翻盘',
    r2: { d: '第 3 轮起，宙道的蛊攻 +15%', eff: [E('round', 'buff', 'self', { atk: 0.15, if: 'round>=3', max: 1 })] },
    r4: { d: '第 3 轮起，宙道的蛊攻 +25%，其余友蛊攻 +10%', eff: [E('round', 'buff', 'self', { atk: 0.15, if: 'round>=3', max: 1 }), E('round', 'buff', 'ally.all', { atk: 0.1, if: 'round>=3', max: 1, once: 1 })] },
    r6: { d: '第 3 轮起，全体友蛊攻 +25%、速 +15%', eff: [E('round', 'buff', 'ally.all', { atk: 0.25, spd: 0.15, if: 'round>=3', max: 1, once: 1 })] } },
];
export const DAO = Object.fromEntries(DAOS.map(d => [d.id, d]));
export const DAO_KEYS = DAOS.map(d => d.id);
export const DAO_TIERS = [2, 4, 6];

// 异道道痕相冲（battle-spec 7.2）：[道a, 道b, 倍率]，两道同时有共鸣（各 ≥2 只）时，两边共鸣的数值都乘倍率
export const CLASH_MUL = 0.5;
export const DAO_CLASH = [['yan', 'bing', CLASH_MUL], ['guang', 'an', CLASH_MUL], ['jin', 'mu', CLASH_MUL], ['lei', 'tu', CLASH_MUL]];
export const CLASH_NOTE = { yan: '炎道与冰雪道相冲', bing: '冰雪道与炎道相冲', guang: '光道与暗道相冲', an: '暗道与光道相冲', jin: '金道与木道相冲（金克木）', mu: '木道与金道相冲（金克木）', lei: '雷道与土道相冲（土能引雷入地）', tu: '土道与雷道相冲（土能引雷入地）' };

// 120 种蛊的道（旧 12 + 蛊典 52 + 新 56）；每道 7–8 种，各转数都有
const M = {
  li:    'boar drum tiger stag glut locust ding qingtian',
  yan:   'fire bomb nirvana fireant pyre char flint magma',
  bing:  'frost snowsilk snowflea icesnail coldcicada hail glacier',
  jin:   'iron rhino gold jinchan saw copper lockarm steelwing',
  mu:    'thorn stick silk taisui moss vine cordy fusang',
  tu:    'dung mole antlion tortoise yue stonecase earthworm moveshan',
  lei:   'thunder dfly static jingzhe click cloud magstorm jiuxiao',
  guang: 'moth firefly mirror flash prism shine solar',
  an:    'mantis hex sleep ink bat eclipse styx',
  xue:   'leech mosq urn tick bloodant amber blade chiba',
  du:    'scorp hairy cent wasp toad hairworm widow',
  zhi:   'webspider cricket lure orchid oracle abacus psyche',
  hun:   'bone cicada qingfu fly bury will boneflute',
  nu:    'queen ant aphid spider qant hive puppet twin',
  yu:    'gecko flea bfly strider inch blink mustard',
  zhou:  'mayfly guangyin fate asahi hourglass ring instant',
};
export const DAO_OF = Object.fromEntries(Object.entries(M).flatMap(([d, s]) => s.split(' ').map(id => [id, d])));

// 共鸣计数：lineup = 空窍里的蛊（{ sp } 数组）。返回 { 道id: { n 只数, tier 0/2/4/6, eff 生效档, mul 相冲后的倍率, clash 相冲的道 } }
export function daoCount(lineup) {
  const out = {};
  for (const g of lineup || []) { const d = g && DAO_OF[g.sp]; if (d) (out[d] ||= { n: 0 }).n++; }
  for (const [d, o] of Object.entries(out)) { o.tier = o.n >= 6 ? 6 : o.n >= 4 ? 4 : o.n >= 2 ? 2 : 0; o.eff = o.tier ? DAO[d]['r' + o.tier] : null; o.mul = 1; o.clash = null; }
  for (const [a, b, m] of DAO_CLASH) if (out[a] && out[b] && out[a].tier && out[b].tier) { out[a].mul = out[b].mul = m; out[a].clash = b; out[b].clash = a; }
  return out;
}
// 空窍上方的一句话，例：「力道 3/4 · 力道的蛊攻 +10%」「炎道 2/4 · 炎道的蛊技能伤害 +15%（与冰雪道相冲，效果减半）」
export function daoLine(d, info) {
  const o = DAO[d]; if (!o || !info) return '';
  const next = info.n >= 6 ? 6 : info.n >= 4 ? 6 : info.n >= 2 ? 4 : 2;
  return `${o.n} ${info.n}/${next}` + (info.eff ? ` · ${info.eff.d}` : '') + (info.clash ? `（与${DAO[info.clash].n}相冲，效果减半）` : '');
}
