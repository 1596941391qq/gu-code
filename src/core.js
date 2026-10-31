// 蛊码 GuCode · 纯逻辑：种子随机、数据表、洞府养成（蛊市、合成、食物、道、杀招）、坐标码。不碰 DOM。规则见 docs/design.md
import { NEW_SPECIES, NEW_TRAITS, NEW_COMBOS, NEW_SUMMONS, NEW_POOL, OLD_EXTRA, natMulOf } from './bestiary.js';
import { DAOS, DAO, DAO_BY_SCHOOL } from './daos.js';
import { SPECIES2, PATCH64, NATS, NAT_OF, SUMMONS2 } from './bestiary2.js';
import { COMBOS2, COMBO_SUMMONS } from './combos2.js';
import { FOODS, FOOD } from './foods.js';
export const natMulFor = r => natMulOf(r);   // 本命描述里〔〕数字按转数换算（界面用）
export function hashStr(s) { s = String(s); let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function makeRng(seed) {
  let a = (typeof seed === 'number' ? seed : hashStr(seed)) >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = n => Math.floor(r() * n);
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  return r;
}


export const MAXV = 3, SLOTS = 9;   // MAXV：本命技层数上限（TRAITS.d(v) 用）；SLOTS：阵盘 3×3 共 9 格，上阵几只由秘境额度决定
export const REALMS = ['凡人', '一转', '二转', '三转', '四转', '五转'];
export const SLOT_BY_REALM = [3, 4, 5, 6, 7, 7];   // 只给程序生成阵容当默认只数用；玩家的空窍不再按境界限格数（见 QUOTA）
export const slotCap = r => SLOT_BY_REALM[Math.min(5, Math.max(0, r | 0))];
// 蛊池 6 档（下标 = 境界）：旧 12 种在前三档，蛊典扩充的新蛊按档追加；六转仙蛊不进任何一档
export const POOL_TIERS = [['boar', 'fire', 'twin', 'iron', 'thorn', 'bone'], ['mantis', 'queen', 'cicada'], ['drum', 'scorp', 'moth'], [], [], []].map((t, i) => [...t, ...NEW_POOL[i]]);
export const poolFor = r => POOL_TIERS.slice(0, Math.min(6, (r | 0) + 1)).flat();
// 转数：一转到五转（六转仙蛊另算）。基础转数 = 物种所在蛊池档位 + 1；物种带 rank 字段时以它为准。三只同种同转合成高一转，最高五转。
export const RANK = { names: ['', '一转', '二转', '三转', '四转', '五转', '六转'], ch: ['', '一', '二', '三', '四', '五', '六'], max: 5 };
export const baseRank = sp => (SP[sp] && SP[sp].rank) || (POOL_TIERS.findIndex(t => t.includes(sp)) + 1) || 1;
export const rankOf = g => g.rank || baseRank(g.sp);
export const fuseLv = g => Math.max(0, rankOf(g) - baseRank(g.sp));     // 合成过几次（0 = 原生转数）
export const rankName = g => RANK.names[rankOf(g)] + SP[g.sp].n;          // 「一转野猪蛊」
// 出战额度：每个秘境写明额度，上阵蛊的转数加起来不能超过它（只限转数总和，不限只数）。下标 = 秘境所属境界
export const QUOTA = [4, 7, 10, 14, 18, 22];
export const quotaOf = team => (team || []).reduce((s, g) => s + rankOf(g), 0);
export const driveCap = r => Math.min(RANK.max, (r | 0) + 1);   // 驱使上限：境界 r 只能让 r+1 转及以下的蛊上阵
// 斗幽灵、战帖按额度分场：上阵转数总和不超过这一场的额度就能进（和秘境一样只限总和，不限只数和单只转数）
export const ARENAS = [4, 9, 15, 22];
export const arenaOf = team => ARENAS.find(q => quotaOf(team) <= q) || 0;   // 这队最低能进几点场（超过 22 点返回 0）
// 各转的主色（升转外貌、转数角标用）：一转青铜、二转赤铁、三转白银、四转黄金、五转紫晶
export const ZHENYUAN = { colors: ['#a0703f', '#a0703f', '#a4442c', '#9aa4ab', '#d9a441', '#7d62a8'] };
// 价格（元气 = 消耗的 token）：单位是「千」，乘 tokens.js 的 unit 才是 token 数（插件 8000，网页 200）。数字按真实画像调过，见 tools/econ-sim.mjs：
// 中位数玩家（每天约 120 活跃分钟 × 21.4 万）走一趟秘境之后剩下的元气，大约够养出一只五转。
// gu 一转蛊的价钱，原生 N 转的蛊 × rankK^(N−1)（三只合一只，价钱也按三倍走，买五转原生蛊和自己合出来花的一样多）；
// refresh 转市；sell 卖蛊退回 = sell × rankK^(转数−1)（按现在的转数，约买价的三分之一）；食物的价格 = FOODS[].cost × food
export const PRICE = { gu: 20, rankK: 3, refresh: 8, sell: 7, food: 7 };
export const guCost = sp => PRICE.gu * Math.pow(PRICE.rankK, baseRank(sp) - 1);   // 单位同 PRICE；蛊市里「升转露」多升的那一转不加价
// 蛊囊（场下）：凑合成用，不上场、不跟去渡劫，放在里面绝对安全。固定 8 格
export const BAG = { cap: 8 };
export const bagCap = () => BAG.cap;
// 攻血成长表：同一种蛊每一转的攻血固定。G[r] = 该转相对一转的倍数；物种的 atk/hp 是它基础转数时的数值。
// 物种可带 st: [[攻,血] × 6]（下标 = 转数）直接覆盖这张表。
// 单只蛊封顶（design 第 0 节）：攻血按「每种蛊每一转」的固定表，五转封顶；加攻血的食物每只最多吃 ATE_MAX 次
export const RANK_GROW = [0, 1, 1.8, 3, 4.6, 6.8, 9.6];
// 数值放大十倍（design 2.8）：物种表里的攻血是小数字，statFor 统一乘 STAT_SCALE 再给出去（一转约攻 20、血 40），百分比加成才看得出来。
// 食物加的攻血在 foods.js 里已经是放大后的数，不再乘。
export const STAT_SCALE = 10;
// 血再乘 HP_SCALE：卡面写的血就是战斗里的血（以前战斗里另乘 HPK = 4，跳字和卡面对不上）。食物加的血在 foods.js 里已按这个口径写
export const HP_SCALE = 4;
export const ATE_MAX = 3;
export const ateOf = g => (g && g.ate) || 0;
export const canEat = g => !!g && ateOf(g) < ATE_MAX;
// 这种蛊从原生转数到五转的攻血表：[{ rank, atk, hp }]
export const statTable = sp => { const out = []; for (let r = baseRank(sp); r <= RANK.max; r++) out.push({ rank: r, ...statFor(sp, r) }); return out; };
export function statFor(sp, rank) {
  const s = SP[sp]; if (!s) return { atk: 1, hp: 1 };
  const r = Math.max(1, Math.min(6, rank | 0)), X = STAT_SCALE, XH = STAT_SCALE * HP_SCALE; if (s.st && s.st[r]) return { atk: Math.max(1, Math.round(s.st[r][0] * X)), hp: Math.max(1, Math.round(s.st[r][1] * XH)) };
  const k = RANK_GROW[r] / RANK_GROW[Math.max(1, Math.min(6, baseRank(sp)))];
  return { atk: Math.max(1, Math.round(s.atk * k * X)), hp: Math.max(1, Math.round(s.hp * k * XH)) };
}

// 词条效果表：旧 12 种蛊的本命技（物种的 nat 字段指向这里），v 为层数；数值按本蛊攻血的百分比。v2 不再有副词条，词条只作本命技用。
// 蛊典扩充的本命技在 bestiary.js 的 NEW_TRAITS
export const TRAITS = {
  strike: { n: '开锋', ch: '锋', trig: '开战', dao: '炎', d: v => `开战：对随机敌蛊造成本蛊攻击 ${20 * v}% 的伤害` },
  shell:  { n: '护体', ch: '甲', trig: '开战', dao: '金', d: v => `开战：获得最大血量 ${8 * v}% 的护体（先挡伤害）` },
  thorn:  { n: '反噬', ch: '棘', trig: '受击', dao: '金', d: v => `被敌方打中：把这一下伤害的 ${15 * v}% 反噬回去（至少 1）` },
  frenzy: { n: '狂血', ch: '狂', trig: '受击', dao: '力', d: v => `被打中且还活着：攻击 +${4 * v}%（按开战攻，至少 1）` },
  split:  { n: '分影', ch: '影', trig: '受击', dao: '变化', d: v => `第一次被打中还活着：身后召唤分影（本蛊攻血 ${12 * v}%）` },
  devour: { n: '噬魂', ch: '噬', trig: '击杀', dao: '食', d: v => `击杀：攻血各 +${6 * v}%` },
  legacy: { n: '遗泽', ch: '泽', trig: '亡语', dao: '魂', d: v => `亡语：身后友蛊攻血 +${8 * v}%（按它的开战攻血）` },
  spawn:  { n: '化生', ch: '化', trig: '亡语', dao: '奴', d: v => `亡语：原地召唤蛊蛹（本蛊攻血 ${15 * v}%）` },
  rally:  { n: '应召', ch: '召', trig: '召唤', dao: '奴', d: v => `有友蛊被召唤时：攻血各 +${3 * v}%（至少 1）` },
  war:    { n: '擂鼓', ch: '鼓', trig: '回合开始', dao: '力', d: v => `回合开始：最前方友蛊攻击 +${3 * v}%（至少 1）` },
  // 站位词条（只能往后加：坐标码按序号编码）
  guard:    { n: '护卫', ch: '卫', trig: '开战', dao: '宇', d: v => `开战：获得最大血量 ${6 * v}% 的护体；相邻友蛊第一次挨打时由它代受` },
  link:     { n: '连心', ch: '连', trig: '开战', dao: '宇', d: v => `开战：相邻友蛊攻血各 +${5 * v}%` },
  snipe:    { n: '暗针', ch: '针', trig: '开战', dao: '宇', d: v => `开战：不在最前时，射敌方最末一只本蛊攻击 ${20 * v}% 的伤害` },
  vanguard: { n: '先登', ch: '登', trig: '开战', dao: '宇', d: v => `开战：站最前时攻击 +${4 * v}%、血 +${8 * v}%` },
};
Object.assign(TRAITS, NEW_TRAITS);   // 蛊典扩充的词条接在后面（序号只增不改）
export const TRAIT_ALL = Object.keys(TRAITS);                         // 全部词条：坐标码按这个序号编码

// 物种：每只一个直白词条。ab = 附蛊简字
export const SPECIES = [
  { id: 'boar',   n: '野猪蛊', ab: '豕', atk: 3, hp: 4, t: 'frenzy', v: 1, lore: '越挨打越疯' },
  { id: 'fire',   n: '流火蛊', ab: '火', atk: 2, hp: 3, t: 'strike', v: 1, lore: '开场先放一把火' },
  { id: 'twin',   n: '分身蛊', ab: '影', atk: 2, hp: 3, t: 'split',  v: 1, lore: '挨一下，多一个自己' },
  { id: 'iron',   n: '铁甲蛊', ab: '甲', atk: 2, hp: 5, t: 'shell',  v: 1, lore: '壳比命硬' },
  { id: 'thorn',  n: '荆棘蛊', ab: '棘', atk: 2, hp: 4, t: 'thorn',  v: 1, t2: 'vanguard', v2: 1, lore: '碰我者自伤' },
  { id: 'mantis', n: '噬心蛊', ab: '螳', atk: 4, hp: 2, t: 'devour', v: 1, lore: '吃一只，壮一圈' },
  { id: 'bone',   n: '腐骨蛊', ab: '骨', atk: 2, hp: 2, t: 'spawn',  v: 1, t2: 'guard', v2: 1, lore: '死了还会孵出来' },
  { id: 'queen',  n: '蜂王蛊', ab: '蜂', atk: 2, hp: 3, t: 'rally',  v: 1, t2: 'link', v2: 1, lore: '一呼百应' },
  { id: 'cicada', n: '金蝉蛊', ab: '蝉', atk: 2, hp: 3, t: 'legacy', v: 1, lore: '蜕下的壳留给后人' },
  { id: 'drum',   n: '战鼓蛊', ab: '鼓', atk: 1, hp: 4, t: 'war',    v: 1, lore: '鼓声一响，前锋发狠' },
  { id: 'scorp',  n: '蝎尾蛊', ab: '蝎', atk: 1, hp: 2, t: 'strike', v: 2, t2: 'snipe', v2: 1, lore: '一针定生死' },
  { id: 'moth',   n: '月蛾蛊', ab: '蛾', atk: 1, hp: 2, t: 'legacy', v: 2, lore: '燃尽自己照亮后人' },
];
// 旧 12 种补上转数 / 喂食偏好 / 流派；蛊典扩充的 52 种接在后面（坐标码按下标编码，只能往后加）
SPECIES.forEach(s => { Object.assign(s, OLD_EXTRA[s.id]); });
SPECIES.push(...NEW_SPECIES);
// 蛊典第二卷（120 种）：旧 64 种打补丁（道、速、远近、主动技、每转攻血表、少数换成原著名），基础转数以攻血表为准；新 56 种接在后面
SPECIES.forEach(s => { const p = PATCH64[s.id]; if (!p) return; Object.assign(s, p); s.nat = NAT_OF(s.id) || s.nat; const b = (s.st || []).findIndex(Boolean); if (b > 0) s.rank = b; if (b >= 6) s.immortal = true; });
SPECIES.push(...SPECIES2.filter(s => !SPECIES.some(x => x.id === s.id)));
// 蛊池按基础转数重排（下标 = 境界，基础 r 转进第 r−1 档；六转仙蛊不进任何一档）
POOL_TIERS.forEach((t, i) => { t.length = 0; t.push(...SPECIES.filter(s => !s.immortal && !s.legend && (s.rank || 1) - 1 === i).map(s => s.id)); });
// 120 种的被动技能换成声明式（战斗引擎读 NEW_TRAITS 的 eff / awEff）；keepHooks 的只换描述
Object.entries(NATS).forEach(([k, t]) => {
  if (t.keepHooks && NEW_TRAITS[k]) Object.assign(NEW_TRAITS[k], { n: t.n, ch: t.ch, trig: t.trig, d: t.d, aw: t.aw });
  else NEW_TRAITS[k] = t;
  TRAITS[k] = NEW_TRAITS[k];
});
export const NORMAL_SPECIES = SPECIES.filter(s => !s.immortal);   // 随机池（幽灵、天劫、招蛊）：六转仙蛊只能开茧获得
export const SP = Object.fromEntries(SPECIES.map(s => [s.id, s]));
export const spTraits = id => [];   // 新蛊出生不带副词条：物种的本事在本命技里（natOf），副词条靠突变、炼附、吞噬
// 本命与转数：本命由物种推出；三转、五转各觉醒一次本命
export const natOf = sp => (SP[sp] && SP[sp].nat) || null;
export const guRank = g => { const s = SP[g.sp]; if (!s) return 1; return s.immortal ? 6 : rankOf(g); };
export const awOf = g => { const r = guRank(g); return r >= 5 ? 2 : r >= 3 ? 1 : 0; };
SPECIES.forEach(s => { if (!s.dao) s.dao = DAO_BY_SCHOOL[s.school] || 'li'; });   // 物种属于哪一道（占位口径见 daos.js）
export const SUMMON_NAMES = { pupa: '蛊蛹', shade: '分影', lunar: '月影', ...NEW_SUMMONS, ...SUMMONS2, ...COMBO_SUMMONS };

// 杀招：配方里的几种蛊同时在空窍，杀招就自动成形，挂在配方第一种蛊（站得最靠前的那只）身上
export const COMBOS = [
  { id: 'sanzhu',   n: '烈火三豕冲', need: ['boar', 'fire', 'twin'], d: '开战：冲阵，对敌方前三只各造成本蛊攻击 25% 的伤害' },
  { id: 'jinjia',   n: '金甲不坏身', need: ['iron', 'thorn'],  d: '开战再得最大血量 15% 的护体；护体未破时受击，反噬与荆棘翻倍' },
  { id: 'wangu',    n: '万蛊朝宗',   need: ['queen', 'bone'],  d: '首次受击存活：身后召唤蛊蛹（本蛊攻血 12%）；任一友蛊被召唤时，全体友蛊攻血 +3%' },
  { id: 'tuoke',    n: '金蝉脱壳',   need: ['cicada', 'twin'], d: '首次阵亡时原地蜕生：攻击不变，血回一半' },
  { id: 'duopo',    n: '噬心夺魄',   need: ['mantis', 'scorp'], d: '击杀后，立刻对下一只敌蛊造成等同攻击的伤害（每回合一次）' },
  { id: 'pozhen',   n: '擂鼓破阵',   need: ['drum', 'boar'],   d: '回合开始：全体友蛊攻血 +3%（按开战攻血）' },
  { id: 'shishan',  n: '尸山月影',   need: ['moth', 'bone'],   d: '亡语：再召唤一只月影（本蛊一半攻击、40% 血）' },
  { id: 'fenshen',  n: '焚身诀',     need: ['fire', 'mantis'], d: '击杀：对敌方全体造成本蛊攻击 20% 的伤害' },
  { id: 'jingji',   n: '荆棘王座',   need: ['thorn', 'queen'], d: '被敌方打中：全体友蛊获得本蛊最大血量 4% 的护体' },
  { id: 'liaoyuan', n: '天火燎原',   need: ['fire', 'scorp'],  d: '开战：流火与开锋改为波及敌方全体（流火每只按四分之一算，开锋每只减半）' },
];
COMBOS.push(...NEW_COMBOS);   // 新杀招都是两蛊配方，排在旧配方之后
// 杀招第二版（combos2.js：核心蛊、时机、声明式效果、进阶）整表替换上面的旧配方；配方里有还不存在的物种的先跳过
export const COMBOS_SKIPPED = COMBOS2.filter(c => !c.need.every(x => SP[x])).map(c => c.id);
COMBOS.length = 0; COMBOS.push(...COMBOS2.filter(c => c.need.every(x => SP[x])));
// 道途锁住的杀招（进阶杀招要靠道途解锁）：COMBOS 只放能成形的，COMBOS_ALL 是全表（蛊典照样列出、写「道途解锁」）。
// setComboLocks(on) 按 on(id) 重排 COMBOS；战斗引擎和 synergyOf 读的是 COMBOS。切磋和复盘前设成全开，结果和对方看到的一样
export const COMBOS_ALL = COMBOS.slice();
export function setComboLocks(on = () => true) { COMBOS.length = 0; COMBOS.push(...COMBOS_ALL.filter(c => on(c.id))); }
export const COMBO = Object.fromEntries(COMBOS.map(c => [c.id, c]));

let UIDN = 1;
export function nuid() { return 'g' + (UIDN++).toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
// 一只蛊：物种、转数、攻血（按转数查表）、挂件食物（food，最多 1 个）、蛊性（xing，最多 1 个，秘境里打出来）
export function newGu(sp, rank) { const r = rank || baseRank(sp), st = statFor(sp, r); return { uid: nuid(), sp, rank: r, atk: st.atk, hp: st.hp, food: null, xing: null }; }
export function starterTeam() { return ['boar', 'fire', 'twin'].map(sp => newGu(sp)); }
export const daoOf = sp => (SP[sp] && SP[sp].dao) || 'li';

// ---------- 杀招（队伍级，自动成形） ----------
// 返回 { 下标: 杀招 }：每只蛊最多挂一个杀招，配方按 COMBOS 顺序认领
export function teamCombos(team) {
  const out = {}, sps = new Set(team.map(g => g.sp));
  for (const c of COMBOS) {
    if (!c.need.every(x => sps.has(x))) continue;
    const i = team.findIndex((g, k) => g.sp === c.need[0] && !out[k]); if (i >= 0) out[i] = c;
  }
  return out;
}
export function comboOf(g, team) { if (!team) return null; const i = team.indexOf(g); return i >= 0 ? teamCombos(team)[i] || null : null; }
export function skillOf(g, team) { const c = comboOf(g, team); return c ? { id: c.id, n: c.n, d: c.d, named: true } : null; }
// 配方还差哪几种（蛊典用）：have = 当前空窍物种
export const comboMissing = (c, have) => c.need.filter(x => !have.includes(x));

// ---------- 蛊市 ----------
// 货架：蛊位 n 个、食物位 2 个。罗盘选中的道只让它出现的概率 +daoP（每个货位先以 daoP 的几率从这一道里挑，否则从全部里挑），
// 蛊市照样什么道都会刷，不锁阵容。foeDaoP：程序生成的对手偏向某一道的几率（秘境房间的主题）
// 食物位开局 2 个，随境界加到 4 个（foodSlots[境界]）
export const SHOP = { guSlots: [3, 3, 4, 4, 5, 5], foodSlots: [2, 2, 3, 3, 4, 4], daoP: 0.05, foeDaoP: 0.6 };
export const foodSlotsOf = realm => (Array.isArray(SHOP.foodSlots) ? SHOP.foodSlots[Math.min(SHOP.foodSlots.length - 1, realm | 0)] : SHOP.foodSlots);
export function shopSpecies(realm, unlocked) { return poolFor(realm).filter(sp => SP[sp] && !SP[sp].immortal && (!unlocked || unlocked(sp, 'species'))); }
export function shopFoods(unlocked) { return FOODS.filter(f => !unlocked || unlocked(f.id, 'food')).map(f => f.id); }
function pickDao(rng, list, dao, of, p = SHOP.daoP) { const main = dao ? list.filter(x => of(x) === dao) : []; return main.length && rng() < p ? rng.pick(main) : rng.pick(list); }
export function rollShop(rng, realm, dao, old = [], unlocked) {
  const sps = shopSpecies(realm, unlocked), fds = shopFoods(unlocked), keep = w => w && w.frozen && !w.sold;
  const gu = Array.from({ length: SHOP.guSlots[Math.min(5, realm | 0)] }, (_, i) => { const o = old.filter(w => w.kind === 'gu')[i]; return keep(o) ? o : { kind: 'gu', sp: pickDao(rng, sps, dao, daoOf), frozen: false, sold: false }; });
  const fd = Array.from({ length: foodSlotsOf(realm) }, (_, i) => { const o = old.filter(w => w.kind === 'food')[i]; return keep(o) ? o : (fds.length ? { kind: 'food', id: pickDao(rng, fds, dao, id => FOOD[id].dao), frozen: false, sold: false } : null); }).filter(Boolean);
  return [...gu, ...fd];
}
export const foodCost = id => (FOOD[id] ? FOOD[id].cost : 3) * PRICE.food;   // 单位同 PRICE

// ---------- 阵盘：3 行 × 3 列（列 c：0 前、1 中、2 后），g.pos = { r, c } ----------
export const COL_NAMES = ['前', '中', '后'];
export const cellOf = g => g && g.pos ? g.pos.r * 3 + g.pos.c : -1;
export const cellPos = k => ({ r: Math.floor(k / 3), c: k % 3 });
const CELL_ORDER = [0, 3, 6, 1, 4, 7, 2, 5, 8];   // 自动摆放：先前列（上中下），再中列，再后列
export function freeCell(team) { const used = new Set(team.map(cellOf)); return CELL_ORDER.find(k => !used.has(k)); }
// 没有位置（或位置重复）的蛊按顺序摆进空格；然后按 列、行 排好（旧引擎按数组顺序读站位）
export function autoPlace(team) {
  const used = new Set();
  team.forEach(g => { const k = cellOf(g); if (k < 0 || k > 8 || used.has(k)) g.pos = null; else used.add(k); });
  team.forEach(g => { if (!g.pos) { const k = CELL_ORDER.find(x => !used.has(x)); if (k != null) { g.pos = cellPos(k); used.add(k); } } });
  return sortTeam(team);
}
export function sortTeam(team) { team.sort((a, b) => (a.pos ? a.pos.c * 3 + a.pos.r : 99) - (b.pos ? b.pos.c * 3 + b.pos.r : 99)); return team; }

// ---------- 收蛊与合成 ----------
export const sameRank = (list, sp, rk) => list.filter(g => g.sp === sp && rankOf(g) === rk).length;
const fusable = (team, bag, g) => rankOf(g) < RANK.max && !(SP[g.sp] || {}).immortal && [...team, ...bag].filter(x => x.sp === g.sp && rankOf(x) === rankOf(g)).reduce((n, x) => n + fuseW(x), 0) >= 2;   // 吃过合炼丹的多算几份
// 能否再收一只：空窍或蛊囊有空位，或者它能和已有的同种同转凑成合成
export function canTake(team, bag, g, cap, bc = BAG.cap) { return team.length < cap || bag.length < bc || fusable(team, bag, g); }
export function canBuy(team, sp, cap, bag = [], bc = BAG.cap) { return canTake(team, bag, { sp, rank: baseRank(sp) }, cap, bc); }
// 收下一只蛊：能合成先合成；否则空窍有空位进空窍，再不行进蛊囊。mode 'bag'（战利品）只进蛊囊。返回 { where, merged }
export function placeGu(team, bag, g, cap, bc = BAG.cap, mode = 'shop', pick) {
  if (fusable(team, bag, g)) { bag.push(g); return { where: 'merge', merged: mergeAll(team, bag, pick) }; }
  if (mode === 'shop' && team.length < cap) { g.pos = cellPos(freeCell(team)); team.push(g); sortTeam(team); return { where: 'team', merged: [] }; }
  if (bag.length < bc) { bag.push(g); return { where: 'bag', merged: mergeAll(team, bag, pick) }; }
  return { where: null, merged: [] };
}
// 同种同转三只合成高一转：空窍和蛊囊一起算，结果留在第一只的位置（空窍优先）。攻血直接换成新一转的表值；
// 挂件食物保留第一只的；蛊性从三只里挑一个：pick(候选蛊性数组) → 选中的那个（不给 pick 就取第一个）。返回合成出的蛊
// 三只同种同转合成高一转：攻血换成新一转的表值，再加上三只里吃得最多的那只的食物加成（吃的次数一并继承，所以不会超过 ATE_MAX 次）。
// 蛊性：三只材料里有不同的蛊性时，pick(候选) 同步选一个；没给 pick 就先传第一个，并在新蛊上留 xingAsk = 候选，等界面问玩家。
// 合成：同种同转凑够三份合成高一转。一只蛊算 1 份，吃过合炼丹（g.fz）的再多算 fz 份；五转和仙蛊不合。
// 凑材料时先拿吃过合炼丹的那只当底，再补只算 1 份的，尽量不浪费；合成后 fz 清零（那几份是低一转的材料）
export const fuseW = g => 1 + ((g && g.fz) | 0);
export function mergeAll(team, bag = [], pick) {
  const done = [], rm = x => { const l = team.includes(x) ? team : bag; l.splice(l.indexOf(x), 1); };
  for (let guard = 0; guard < 12; guard++) {
    let grp = null; const all = [...team, ...bag];
    for (const g of all) {
      const rk = rankOf(g); if (rk >= RANK.max || (SP[g.sp] || {}).immortal) continue;
      const same = all.filter(x => x.sp === g.sp && rankOf(x) === rk); if (same.reduce((n, x) => n + fuseW(x), 0) < 3) continue;
      const order = same.slice().sort((x, y) => fuseW(y) - fuseW(x)), base = order[0], pickd = [base]; let w = fuseW(base);
      for (const x of order.slice(1).sort((x, y) => fuseW(x) - fuseW(y))) { if (w >= 3) break; pickd.push(x); w += fuseW(x); }
      grp = pickd; break;
    }
    if (!grp) break;
    const a = grp[0], rest = grp.slice(1), xs = [...new Set(grp.map(x => x.xing).filter(Boolean))];
    const fed = grp.reduce((m, x) => (ateOf(x) > ateOf(m) ? x : m), a);
    const bA = fed.bonusA || 0, bH = fed.bonusH || 0, ate = ateOf(fed);
    a.rank = rankOf(a) + 1; const st = statFor(a.sp, a.rank);
    a.bonusA = bA; a.bonusH = bH; a.ate = ate; a.atk = st.atk + bA; a.hp = st.hp + bH; delete a.fz;
    delete a.xingAsk;
    if (xs.length > 1 && pick) a.xing = pick(xs); else { a.xing = xs[0] || null; if (xs.length > 1) a.xingAsk = xs; }
    a.food = a.food || rest.map(x => x.food).find(Boolean) || null;
    rest.forEach(rm);
    done.push(a);
  }
  return done;
}
export const sellValue = g => PRICE.sell * Math.pow(PRICE.rankK, rankOf(g) - 1);   // 单位同 PRICE

// ---------- 食物 ----------
// 喂加攻血的食物：只喂还没吃满 ATE_MAX 次的，返回真正吃到的。永久加成记在 bonusA/bonusH（合成换表值时保留）
export function feedStat(food, targets) {
  const f = FOOD[food]; if (!f || f.kind !== 'stat') return [];
  const ok = targets.filter(canEat);
  ok.forEach(g => { g.ate = ateOf(g) + 1; g.bonusA = (g.bonusA || 0) + (f.atk || 0); g.bonusH = (g.bonusH || 0) + (f.hp || 0); g.atk += f.atk || 0; g.hp += f.hp || 0; });
  return ok;
}

// ---------- 程序生成阵容（幽灵、秘境的对手） ----------
// realm 境界（决定蛊池与转数），n 只数，up 每只额外升转的几率，dao 偏向的道（可无）
export function genTeam(rng, o = {}) {
  const realm = Math.max(0, Math.min(5, o.realm | 0)), n = Math.max(1, Math.min(SLOTS, o.n || slotCap(realm))), pool = poolFor(realm).filter(sp => SP[sp] && !SP[sp].immortal);
  const team = Array.from({ length: n }, () => { const sp = pickDao(rng, pool, o.dao, daoOf, SHOP.foeDaoP), r = Math.min(RANK.max, baseRank(sp) + (rng() < (o.up || 0) ? 1 : 0) + (rng() < (o.up || 0) / 3 ? 1 : 0)); return newGu(sp, r); });
  return autoPlace(arrangeTeam(team));
}
// 按额度凑一队（占位：秘境专家的 foeFor 交来后以它为准）：先放尽量高转的蛊，余数补一只低转。dao 偏向的道
export function quotaTeam(rng, quota, o = {}) {
  const top = Math.max(1, Math.min(RANK.max, Math.ceil(quota / 4.5))), ranks = [];
  for (let left = Math.max(1, quota | 0); left > 0 && ranks.length < SLOTS;) { const r = Math.min(top, left); ranks.push(r); left -= r; }
  const team = ranks.map(r => { const pool = poolFor(r - 1).filter(sp => SP[sp] && !SP[sp].immortal); return newGu(pickDao(rng, pool, o.dao, daoOf, SHOP.foeDaoP), r); });
  return autoPlace(arrangeTeam(team));
}

// ---------- 布阵：站位效果与敌方排阵 ----------
// 每个下标收到哪些站位效果（界面画箭头/角标用）：[{ to, from, id, txt }]，to = -1 表示作用于敌方
export function posLinks(team) {
  const out = [], n = team.length, tv = (g, id) => natOf(g.sp) === id ? 1 : 0;
  team.forEach((g, i) => {
    let v;
    if ((v = tv(g, 'legacy')) && i + 1 < n) out.push({ to: i + 1, from: i, id: 'legacy', txt: `攻血 +${8 * v}%` });
    if ((v = tv(g, 'war'))) out.push({ to: 0, from: i, id: 'war', txt: `攻 +${3 * v}%/回合` });
    if ((v = tv(g, 'link'))) [i - 1, i + 1].forEach(j => { if (j >= 0 && j < n) out.push({ to: j, from: i, id: 'link', txt: `攻血 +${5 * v}%` }); });
    if (tv(g, 'guard')) [i - 1, i + 1].forEach(j => { if (j >= 0 && j < n) out.push({ to: j, from: i, id: 'guard', txt: '代受一击' }); });
    if ((v = tv(g, 'vanguard')) && i === 0) out.push({ to: 0, from: 0, id: 'vanguard', txt: `攻 +${4 * v}% 血 +${8 * v}%` });
    if ((v = tv(g, 'snipe')) && i > 0) out.push({ to: -1, from: i, id: 'snipe', txt: `射敌末位 ${20 * v}% 攻` });
  });
  return out;
}
// 详情面板里「作用到谁」的一句话
export function posNote(team, i, id) {
  const nm = j => team[j] ? (SP[team[j].sp] ? SP[team[j].sp].n : '') : '';
  const adj = [i - 1, i + 1].filter(j => team[j]).map(nm).join('、');
  switch (id) {
    case 'legacy': return team[i + 1] ? `身后：${nm(i + 1)}` : '身后没有友蛊，暂时落空';
    case 'war': return `最前：${nm(0)}`;
    case 'link': return adj ? `相邻：${adj}` : '没有相邻友蛊';
    case 'guard': return adj ? `护住：${adj}` : '没有相邻友蛊';
    case 'vanguard': return i === 0 ? '正站最前，生效' : '不在最前，暂不生效';
    case 'snipe': return i > 0 ? '在后排，生效' : '站在最前，暂不生效';
    case 'split': return '分影出现在它身后';
    case 'spawn': return '蛊蛹在原位补上';
  }
  return '';
}
// 敌方排阵：给每种排列打分取最高（不跑战斗，够快）
export function formScore(t) {
  let s = 0; const n = t.length;
  t.forEach((g, i) => {
    const k = natOf(g.sp), T = k ? { [k]: 1 } : {}, q = [], A = g.atk / STAT_SCALE, h = g.hp / (STAT_SCALE * HP_SCALE) + 3 * (T.shell || 0) + 2 * (T.guard || 0);   // 攻血按放大前的量级打分，和下面的常数对得上
    if (i === 0) s += h * 1.3 + A * 0.5 + 2.5 * (T.thorn || 0) + 2 * (T.frenzy || 0) + 1.5 * (T.split || 0) + 4 * (T.vanguard || 0) - 4 * (T.snipe || 0) - 2 * (T.war || 0) - 1.5 * (T.legacy || 0) - (q.includes('timid') ? 4 : 0) + (q.includes('lastgasp') ? 2 : 0);
    else s += 3 * (T.snipe || 0) + (n - i) * 0.15 * h;
    if (T.legacy && t[i + 1]) s += T.legacy * (1 + 0.15 * t[i + 1].atk / STAT_SCALE);
    if (T.link) s += 1.5 * T.link * ((i > 0) + (i < n - 1));
    if (T.guard) s += i === 1 ? 4 : i > 1 ? 1 : 0;
  });
  return s;
}
export function arrangeTeam(team) {
  const n = Math.min(team.length, SLOTS); if (n < 2) return team;
  let best = team.slice(), bs = formScore(best);
  const perm = (a, k) => { if (k === a.length) { const sc = formScore(a); if (sc > bs + 1e-9) { bs = sc; best = a.slice(); } return; } for (let i = k; i < a.length; i++) { [a[k], a[i]] = [a[i], a[k]]; perm(a, k + 1); [a[k], a[i]] = [a[i], a[k]]; } };
  if (n <= 5) perm(team.slice(0, n), 0);
  else {   // 6–7 只时全排列太多（5040 种），改为逐对交换的爬山：一直换到没有更好的排法为止
    let cur = team.slice(0, n), cs = formScore(cur), up = true;
    while (up) { up = false; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { [cur[i], cur[j]] = [cur[j], cur[i]]; const sc = formScore(cur); if (sc > cs + 1e-9) { cs = sc; up = true; } else [cur[i], cur[j]] = [cur[j], cur[i]]; } }
    if (cs > bs) { bs = cs; best = cur; }
  }
  team.splice(0, n, ...best); return team;
}

export const GHOST_NAMES = ['夜码人', '零点蛊师', '断点散人', '递归僧', '缓存道人', '并发狂徒', '栈溢出', '空指针', '热重载', '回滚真人', '合并冲突', '无限循环'];

// ---------- 界壁坐标码：阵容 → 位流 → base64url ----------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const SPI = Object.fromEntries(SPECIES.map((s, i) => [s.id, i]));
const FDI = Object.fromEntries(FOODS.map((f, i) => [f.id, i]));
// 蛊性表由秘境一侧维护（XING，顺序只能往后加）；坐标码按下标记
export const XING = {};
export const XING_KEYS = () => Object.keys(XING);
function utf8(s) { return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Buffer.from(s, 'utf8'); }
function unutf8(b) { return typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(new Uint8Array(b)) : Buffer.from(b).toString('utf8'); }
// v1–v4 是旧玩法的码（带词条、怪癖、附蛊、道痕），照旧能读：只取物种和转数，攻血按新表换算。
// v5（v2 玩法）：物种 7 位、转数 3 位、攻血各 10 位、挂件食物 6 位、蛊性 6 位，外加 1 位「试玩」
// v6（阵盘）：v5 每只蛊后面再加 阵盘格 4 位（0–8，15 = 没摆）、速 8 位（0 = 按物种）。v1–v5 解出来按顺序自动摆进阵盘
// v7（额度）：和 v6 一样，只是只数字段从 3 位改成 4 位（阵盘最多 9 只）
// v8（数值放大十倍）：版本字段写 0 再跟 3 位扩展号（8 = 7 + 1），攻血各 12 位；v5–v7 的攻血是放大前的数，解出来乘 STAT_SCALE
// v9（血统一口径）：扩展号 2，攻 12 位、血 14 位；v8 及以前的血是乘 HP_SCALE 之前的数，解出来再乘 HP_SCALE
const OLD_W = { 1: { sp: 4, tr: 4, q: 3, st: 8, mk: 0, rk: 0 }, 2: { sp: 4, tr: 4, q: 3, st: 8, mk: 12, rk: 2 }, 3: { sp: 6, tr: 6, q: 4, st: 10, mk: 16, rk: 3 }, 4: { sp: 6, tr: 6, q: 4, st: 10, mk: 16, rk: 3, fl: 1 } };
const W5 = { sp: 7, rk: 3, st: 10, fd: 6, xg: 6 }, ST8 = 12, HP9 = 14;
export function encodeTeam(team, meta = {}) {
  let bits = ''; const put = (v, n) => { bits += Math.max(0, Math.min(2 ** n - 1, Math.round(v) || 0)).toString(2).padStart(n, '0'); };
  const nm = Array.from(utf8((meta.name || '').slice(0, 8))).slice(0, 31);
  put(0, 3); put(2, 3); put(meta.realm || 0, 3); put(Math.min(SLOTS, team.length), 4); put(nm.length, 5); nm.forEach(b => put(b, 8)); put(meta.trial ? 1 : 0, 1);
  const xk = XING_KEYS();
  for (const g of team.slice(0, SLOTS)) {
    put(SPI[g.sp], W5.sp); put(rankOf(g), W5.rk); put(g.atk, ST8); put(g.hp, HP9);
    put(g.food && FDI[g.food] != null ? FDI[g.food] + 1 : 0, W5.fd); const xi = g.xing ? xk.indexOf(g.xing) : -1; put(xi + 1, W5.xg); put(g.boss ? 1 : 0, 1);
    const k = cellOf(g); put(k >= 0 && k <= 8 ? k : 15, 4); put(g.spd || 0, 8);
  }
  while (bits.length % 6) bits += '0';
  let out = ''; for (let i = 0; i < bits.length; i += 6) out += B64[parseInt(bits.slice(i, i + 6), 2)];
  return out;
}
export function decodeTeam(code) {
  try {
    const m = String(code).match(/[A-Za-z0-9_-]{8,}/); if (!m) return null;
    let bits = ''; for (const ch of m[0]) { const i = B64.indexOf(ch); if (i < 0) return null; bits += i.toString(2).padStart(6, '0'); }
    let p = 0; const get = n => { if (p + n > bits.length) throw 0; const v = parseInt(bits.slice(p, p + n), 2); p += n; return v; };
    let ver = get(3); if (ver === 0) ver = 7 + get(3); if (ver < 1 || ver > 9) return null;
    const realm = get(3), n = get(ver >= 7 ? 4 : 3), nl = get(5), nm = []; for (let i = 0; i < nl; i++) nm.push(get(8));
    const team = []; let trial = false;
    if (ver >= 5) {
      trial = !!get(1); const xk = XING_KEYS(), sw = ver >= 8 ? ST8 : W5.st, hw = ver >= 9 ? HP9 : sw, sx = ver >= 8 ? 1 : STAT_SCALE, hx = sx * (ver >= 9 ? 1 : HP_SCALE);
      for (let i = 0; i < n; i++) {
        const sp = SPECIES[get(W5.sp)]; if (!sp) return null;
        const rank = Math.max(1, Math.min(6, get(W5.rk))), g = { uid: nuid(), sp: sp.id, rank, atk: Math.max(1, get(sw) * sx), hp: Math.max(1, get(hw) * hx), food: null, xing: null };
        const fi = get(W5.fd); if (fi && FOODS[fi - 1]) g.food = FOODS[fi - 1].id; const xi = get(W5.xg); if (xi && xk[xi - 1]) g.xing = xk[xi - 1]; if (get(1)) g.boss = 1;
        if (ver >= 6) { const k = get(4); if (k <= 8) g.pos = cellPos(k); const sp2 = get(8); if (sp2) g.spd = sp2; }
        team.push(g);
      }
    } else {
      const W = OLD_W[ver]; if (W.mk) get(W.mk); if (W.fl) trial = !!get(W.fl);
      for (let i = 0; i < n; i++) {
        const sp = SPECIES[get(W.sp)]; if (!sp) return null;
        get(W.st); get(W.st); get(2);
        const nt = get(3); for (let j = 0; j < nt; j++) { get(W.tr); get(2); }
        const nq = get(2); for (let j = 0; j < nq; j++) get(W.q);
        const na = get(2); for (let j = 0; j < na; j++) get(W.sp);
        get(18); get(7); const boss = get(1); const rk = W.rk ? get(W.rk) : 0;
        const rank = ver >= 3 ? Math.max(1, Math.min(6, rk)) : Math.min(RANK.max, baseRank(sp.id) + rk);
        const g = newGu(sp.id, rank); if (boss) g.boss = 1; team.push(g);
      }
    }
    if (!team.length) return null;
    autoPlace(team);
    return { team, realm, name: unutf8(nm), trial, old: ver < 5 };
  } catch (e) { return null; }
}

// 战斗手感：暴击概率与倍数（种子随机，复盘可复现）
export const BATTLE = { crit: 0.10, critMul: 2 };
// 战斗回放节奏（毫秒，1 倍速基准）。界面按 playMs 自动缩放，使一局约 15–25 秒
export const EV_MS = { begin: 900, turn: 220, clash: 640, hit: 60, dmg: 200, buff: 110, trig: 300, combo: 1700, comboQuiet: 180, summon: 260, faint: 400, status: 160, end: 300 };
export function playMs(log) {
  const seen = new Set(); let t = 0;
  for (const e of log) t += e.t === 'dmg' ? (e.k === 'hit' ? EV_MS.hit : EV_MS.dmg) : e.t === 'combo' ? ((e.quiet || seen.has(e.uid)) ? EV_MS.comboQuiet : (seen.add(e.uid), EV_MS.combo)) : (EV_MS[e.t] || 0);
  return t;
}
export const tempoFor = ms => Math.min(2.3, Math.max(0.6, 20000 / Math.max(1, ms)));
export function fmtNum(n) { n = Math.round(n || 0); const a = Math.abs(n); return a >= 1e8 ? (n / 1e8).toFixed(a >= 1e10 ? 0 : 2) + '亿' : a >= 1e4 ? (n / 1e4).toFixed(a >= 1e6 ? 0 : 1) + '万' : String(n); }
export function fmtTok(n) { n = n || 0; return n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n)); }
