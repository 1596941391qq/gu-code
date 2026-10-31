// 蛊码 GuCode · 秘境（纯逻辑：地图、房间、血量延续、永久死亡、撤退与全灭、战利品、蛊性）。种子随机，不碰 DOM。
// 规则正本：docs/design.md 第 2 节。界面在 trip-ui.js。战斗引擎归战斗一侧：秘境给出场蛊带 hpNow，读回 res.hpEnd（每只剩血，0 = 倒下）
// 和 res.statA（每只这一场的经历，判蛊性用）；引擎还没给 hpEnd 时，用最后一帧快照兜底（hpFromLog）。
// 资源只有元气（= 消耗的 token）：房间路程、坊市、奇遇里要花的都按元气算，先花洞府攒着的（purse.bank），不够就等实时 token。
import { makeRng, hashStr, SP, poolFor, baseRank, RANK, SLOTS, XING, fmtTok, statFor, daoOf, NORMAL_SPECIES, autoPlace, arrangeTeam, QUOTA, REALMS, driveCap, PRICE } from './core.js';   // QUOTA（各境界额度）定义在 core，洞府也用
import { FOODS, FOOD } from './foods.js';
import { DAO } from './daos.js';
import { SKIES, SKY, MECHS, MECH, BLESSES, BLESS, blessLast, JIE, JIE_MAX, JIE_NAMES, jieRules, skyEff, blessRules } from './trip-mods.js';

// ───────────── 蛊性：秘境里打出来的经历。每只蛊最多 1 个；数值按进场攻血的百分比，后期不贬值 ─────────────
// 顺序 = 坐标码里的下标（只能往后加）。prio 越小越优先（同一场同时达成几个时取一个）。get = 怎么得到，d = 效果（界面原样显示）
// eff = 战斗效果，格式见 docs/battle-spec.md 第 6 节（{ when, op, … }，按攻血百分比）；引擎触发时发 trig { uid, xg }
Object.assign(XING, {
  jianren:  { n: '坚韧', prio: 1, get: '残血（不到四分之一）活过一场', d: '每场第一次受到致命伤时，留 1 血', eff: [{ when: 'lethal', op: 'endure', v: 0, max: 1 }] },
  shisha:   { n: '嗜杀', prio: 2, get: '一场里斩杀三只', d: '每斩杀一只，攻 +20%（按进场时的攻算）', eff: [{ when: 'kill', op: 'buff', tg: 'self', atk: 0.2 }] },
  ruiqi:    { n: '锐气', prio: 4, get: '第一轮就斩杀一只', d: '每场第一次出手，伤害 ×1.5', eff: [{ when: 'deal', op: 'mul', v: 1.5, if: 'first' }] },
  zhanshou: { n: '斩首', prio: 3, get: '一下打倒一只满血的敌蛊', d: '打满血的敌蛊，伤害 ×1.3', eff: [{ when: 'deal', op: 'mul', v: 1.3, if: 'tg.full' }] },
  tongpao:  { n: '同袍', prio: 5, get: '相邻的友蛊倒下了，自己撑到打赢', d: '相邻友蛊倒下时，回满血的 25%', eff: [{ when: 'allyDeath', op: 'heal', tg: 'self', mx: 0.25, up: 0, if: 'dead.adj' }] },
  zhenyue:  { n: '镇岳', prio: 6, get: '站最前挨了 4 下还活着', d: '开战时站最前，得满血 25% 的护体', eff: [{ when: 'start', op: 'shield', tg: 'self', mx: 0.25, up: 0, if: 'front' }] },
  yuxue:    { n: '浴血', prio: 7, get: '一场里掉的血超过自己满血，还活着', d: '每被普攻打中一次还活着，攻 +10%', eff: [{ when: 'hit', op: 'buff', tg: 'self', atk: 0.1, if: 'kind=hit' }] },
  zhefu:    { n: '蛰伏', prio: 8, get: '身前的友蛊倒下了，自己撑到打赢', d: '身前友蛊倒下时，攻和血 +15%', eff: [{ when: 'allyDeath', op: 'buff', tg: 'self', atk: 0.15, hp: 0.15, if: 'dead.ahead' }] },
});
const XORDER = () => Object.keys(XING).sort((a, b) => (XING[a].prio || 99) - (XING[b].prio || 99));
// 一场打完，这只蛊达成了哪个蛊性（只看活下来的；已经有的那个不算新的）。st 见战斗结果的 statA
export function xingEarned(st, won, cur) {
  if (!st || !(st.hp > 0) || !st.mx) return null;
  const ok = { jianren: st.hp / st.mx <= 0.25, shisha: st.kills >= 3, ruiqi: !!st.killT1, zhanshou: !!st.oneShot, tongpao: won && !!st.adjFell,
    zhenyue: !!st.front && st.hits >= 4, yuxue: st.taken >= st.mx, zhefu: won && !!st.frontFell };
  return XORDER().find(k => ok[k] && k !== cur) || null;
}

// ───────────── 调参总表（贡献者只改这里）─────────────
export const TRIP_CFG = {
  depth: 10,                                   // 第 1–9 层普通房间，第 10 层是首领（渡劫）
  // 房间路程，单位「千」：乘 TokenSource.unit 得到元气（插件 8000，网页 200）。真实画像中位数约 21 万 token/分钟（缓存读取 ×0.1 折算），
  // base 90 ≈ 72 万元气 ≈ 3.4 分钟，越深越远，首领约 5.3 分钟；整趟约 44 分钟。节奏表见 tools/trip-test.mjs
  cost: { base: 90, per: 6, jit: 0.12 },
  w: { fight: 50, event: 16, elite: 12, camp: 8, market: 8, bless: 8 },   // 房间权重
  from: { event: 1, market: 2, elite: 3, camp: 3, bless: 1 },             // 第几层（从 0 数）起出现
  rowMax: { elite: 1, camp: 1, market: 1, event: 1, bless: 1 },           // 同一层最多几个
  // 敌阵只按额度配，不看玩家的蛊池（见 foeByBudget）：额度 = 上阵蛊转数总和的上限。敌蛊攻血一律用正常的转数表，不打折、不暗加。
  // 难度只靠「用掉几成额度」调：普通战斗 frac[0] + frac[1]×(层数 − ramp)；精英 elite；首领 boss × 每个秘境的 bk；斗幽灵 ghost 满额。
  // 规则是「赢了救回，输了全死」，所以目标是输的概率：浅层每场 < 5%，精英 15%–20%，首领 35%–45%（配队一般，见 tools/trip-test.mjs）
  foe: { frac: [0.4, 0.04], ramp: 2, elite: 0.64, boss: 0.85, ghost: 1, maxN: 7, daoP: 0.65 },
  camp: 0.5,                                   // 篝火：全队回满血的 50%
  // 战利品只有新蛊和食物，越深越多、越稀有：数量 = 基数 + 每层 × 层数（小数部分按几率）；新蛊升一转的几率 up[0] + up[1]×层数，
  // 第 rare 层起一半几率出自高一档蛊池；食物按价钱算稀有，越深越偏向贵的
  loot: {
    fight: { food: [0.25, 0.04], gu: [0.12, 0.03] },
    elite: { food: [1, 0.05], gu: [0.6, 0.04] },
    boss: { food: [1, 0], gu: [0, 0] },        // 首领另有「渡劫成功必掉」二选一（bossReward）
    up: [0.05, 0.05], rare: 5,
  },
  // 坊市价格（千，乘 unit 得元气）。蛊和食物按洞府蛊市的价钱（core.PRICE）再加秘境溢价，免得坊市成了便宜货源：
  //   蛊 = 20 × 3^(这只的转数 − 1) × gu；食物 = 价格档 × 7 × food；药汤 = heal 价 × (1 + 境界 × realm)。劫数涨价、祝福「熟客」半价另乘
  market: { heal: 0.4, price: { heal: 35 }, prem: { gu: 1.25, food: 2 }, realm: 0.25 },
  pay: { realm: 0.25, gu: 0.75 },              // 奇遇里要花的元气，每高一境 +25%；拿元气换蛊的（payGu）= 这个境界最高转数的蛊在蛊市的价钱 × gu
  bless: 3,                                    // 祝福一次给几个选（灵台房间、打赢精英后）
};
// n 名字、ch 地图上的单字、k 图例里的一句用途、tip 地图格子悬停的一句话（是什么、能得到什么）、d 进房间后的说明
export const ROOMS = {
  fight:  { n: '战斗', ch: '斗', k: '打野蛊', tip: '战斗：一伙野蛊拦路。打赢可能掉食物和新蛊，倒下的都能救回', d: '一伙野蛊拦路。赢了倒下的都能救回，还可能掉食物和新蛊' },
  elite:  { n: '精英', ch: '精', k: '强敌，必掉东西', tip: '精英：强敌。打赢必掉食物、常有新蛊，还能选一个祝福；输了全队永久死亡', d: '强敌，开打前能看阵容。赢了必得食物，常有新蛊，还能选一个祝福' },
  event:  { n: '奇遇', ch: '遇', k: '二选一的小事', tip: '奇遇：一段小事，两个选择，结果都先写明（回血、食物、新蛊、蛊性……）', d: '一段小事，两个选择，结果都先写明' },
  camp:   { n: '篝火', ch: '火', k: '歇脚回血', tip: '篝火：歇脚的地方，全队回血（不是炎道）', d: '歇脚，全队回满血的一半' },
  market: { n: '坊市', ch: '市', k: '花元气买东西', tip: '坊市：秘境里的小货摊，花元气买药汤、食物或新蛊', d: '小货摊：花元气买回血、食物或新蛊' },
  bless:  { n: '灵台', ch: '福', k: '选一个祝福', tip: '灵台：三个祝福选一个，只在这一趟有效', d: '三个祝福选一个，只在这一趟有效，出秘境清零' },
  boss:   { n: '首领', ch: '劫', k: '渡劫', tip: '首领：打赢就是渡劫成功，必掉一样东西（二选一），带着全部战利品回洞府', d: '秘境最深处的首领。打赢就是渡劫成功：必掉一样东西（二选一），带着全部战利品回洞府；本境界的秘境第一次渡过，境界加一' },
};

// ───────────── 地图：三条路，每层三个房间。左路通 左/中，右路通 中/右，中路通 中 + 本层指定的一侧；最深处汇成首领 ─────────────
const ROW_TYPES = ['fight', 'event', 'elite', 'camp', 'market', 'bless'];
export const roomCost = (d, j = 0) => Math.round((TRIP_CFG.cost.base + TRIP_CFG.cost.per * d) * (1 + TRIP_CFG.cost.jit * j));
export function tripMap(seed, realm = 0) {
  const C = TRIP_CFG, rng = makeRng('trip:' + seed + ':' + (realm | 0)), rows = [], D = C.depth;
  for (let d = 0; d < D - 1; d++) {
    const mid = rng() < 0.5 ? 0 : 2, cnt = {}, types = [null, null, null];
    if (d === 0) { types[0] = types[2] = 'fight'; types[1] = 'event'; }        // 第一层平缓：两场小仗、一个奇遇
    if (d === D - 2) types[1] = 'camp';                                      // 首领前一层，中路必有篝火（中路从哪条路都走得到）
    types.forEach(t => { if (t) cnt[t] = (cnt[t] || 0) + 1; });
    for (let l = 0; l < 3; l++) {
      if (types[l]) continue;
      const pool = ROW_TYPES.filter(t => d >= (C.from[t] || 0) && (cnt[t] || 0) < (C.rowMax[t] || 9));
      let x = rng() * pool.reduce((a, t) => a + C.w[t], 0), t = pool[0];
      for (const k of pool) { x -= C.w[k]; if (x < 0) { t = k; break; } }
      types[l] = t; cnt[t] = (cnt[t] || 0) + 1;
    }
    rows.push({ d, mid, rooms: types.map((type, lane) => ({ type, lane, d, cost: roomCost(d, rng() * 2 - 1) })) });
  }
  rows.push({ d: D - 1, mid: 1, boss: true, rooms: [{ type: 'boss', lane: 1, d: D - 1, cost: roomCost(D - 1) }] });
  return rows;
}
// 从第 d 层的 lane 出发，下一层能去哪几条路
export function nextLanes(map, d, lane) {
  const nx = map[d + 1]; if (!nx) return [];
  if (nx.boss) return [1];
  if (lane === 0) return [0, 1]; if (lane === 2) return [1, 2];
  return [1, map[d].mid].sort();
}

// ───────────── 秘境列表：每个境界两三个，同境界额度相同，主道和首领不同。渡过本境界任一秘境的首领 = 渡劫，境界加一 ─────────────
// 额度 = 上阵蛊转数总和的上限；境界 r 能驱使 r+1 转及以下的蛊（敌人也一样）。名字取原著里的大地名，描述是自己写的
export const rankCapOf = q => Math.min(RANK.max, q < 7 ? 1 : q < 10 ? 2 : q < 14 ? 3 : q < 18 ? 4 : 5);   // 额度对应的最高转数（斗幽灵 4/9/15/22 档也按这个）
const LAND_DEF = [   // [id, 名, 境界, 主道, 一句介绍]。首领见下面的 BOSS_DEF
  ['qingmao', '青茅山', 0, 'li', '山寨外的竹林里野蛊成群，蛊师入门的第一道坎。'],
  ['suishi', '碎石滩', 0, 'jin', '河滩上全是碎石，甲壳硬的野蛊躲在石缝里，不好啃。'],
  ['shangjia', '商家城外', 1, 'zhi', '城外的商路上常有劫道的蛊师，阵法摆得比力气重要。'],
  ['zhangze', '南疆瘴泽', 1, 'xue', '泥沼里瘴气终年不散，这里的蛊靠吸血熬人。'],
  ['caohai', '北原草海', 2, 'nu', '草比人高，牧蛊的部族一放就是一群，以多打少。'],
  ['liusha', '西漠流沙', 2, 'jin', '风一起沙就动，披甲的蛊埋在沙下等人踩上来。'],
  ['wangting', '王庭福地', 3, 'li', '北原诸部争了几百年的福地，守在这里的都是硬骨头。'],
  ['jiaodao', '东海礁岛', 3, 'xue', '潮水退了才露出来的礁岛，礁缝里的蛊受了伤反而更凶。'],
  ['maigu', '埋骨荒原', 3, 'hun', '大战之后没人收的战场，倒下的蛊在这里不肯散。'],
  ['langya', '琅琊福地', 4, 'nu', '云上的福地，满山的毛民听一个声音调遣。'],
  ['yitian', '义天山', 4, 'hun', '正魔两道在山上打了一场大仗，山里至今魂火不灭。'],
  ['baohuang', '宝黄天', 5, 'jin', '天下蛊师做买卖的地方，守库的蛊一身金甲。'],
  ['tianting', '天庭', 5, 'zhi', '中洲之上的天庭，一步一阵，算无遗策。'],
];
export const LANDS = LAND_DEF.map(([id, n, realm, dao, d]) => ({ id, n, realm, quota: QUOTA[realm], cap: rankCapOf(QUOTA[realm]), dao, d }));
export const LAND = Object.fromEntries(LANDS.map(l => [l.id, l]));
export const landsOf = realm => LANDS.filter(l => l.realm === realm);
const landOf = x => (x && typeof x === 'object' ? x : LAND[x] || landsOf(Math.max(0, Math.min(5, x | 0)))[0] || LANDS[0]);
export const teamQuota = team => team.reduce((a, g) => a + (g.rank || baseRank(g.sp)), 0);   // 这队占多少额度

// ───────────── 敌阵：只按额度生成（纯函数，斗幽灵和战帖分场也用）─────────────
// foeByBudget(rng, budget, { dao, kind: 'room'|'elite'|'boss'|'ghost', depth, maxRank, frac }) → [{ uid, sp, rank, atk, hp, pos, boss? }]
// 用掉几成额度见 TRIP_CFG.foe（frac 可直接指定）；转数不超过额度对应的上限；攻血 = 转数表原值。首领那一队里转数最高的一只标 boss（领头）
const normalPool = r => poolFor(r).filter(id => SP[id] && !SP[id].immortal);
export function foeFrac(kind, depth = 0) {
  const F = TRIP_CFG.foe;
  return kind === 'boss' ? F.boss : kind === 'elite' ? F.elite : kind === 'ghost' ? F.ghost : Math.min(1, F.frac[0] + F.frac[1] * Math.max(0, depth - F.ramp));
}
export function foeByBudget(rng, budget, o = {}) {
  const F = TRIP_CFG.foe, kind = o.kind || 'room', cap = Math.max(1, Math.min(RANK.max, o.maxRank || rankCapOf(budget)));
  let left = Math.max(1, Math.round(budget * (o.frac != null ? o.frac : foeFrac(kind, o.depth || 0)))); const ranks = [];
  while (left > 0 && ranks.length < F.maxN) {   // 多用接近上限的转数，偶尔低一两转，最后的零头用小转数补满
    const hi = Math.min(cap, left), r = hi > 1 && rng() < 0.3 ? hi - 1 - (hi > 2 && rng() < 0.3 ? 1 : 0) : hi;
    ranks.push(r); left -= r;
  }
  const all = NORMAL_SPECIES.map(s => s.id);
  const team = ranks.sort((a, b) => b - a).map((r, i) => {
    const ok = all.filter(id => baseRank(id) <= r), main = o.dao ? ok.filter(id => daoOf(id) === o.dao) : [];
    const sp = rng.pick(main.length && (rng() < F.daoP || (kind === 'boss' && i === 0)) ? main : ok.length ? ok : all), st = statFor(sp, r);
    return { uid: 'f' + i, sp, rank: r, atk: st.atk, hp: st.hp, food: null, xing: null };
  });
  if (kind === 'boss' && team[0]) team[0].boss = 1;
  return autoPlace(arrangeTeam(team));
}
// 首领：每个秘境两三个（首领机制池），每趟随机遇到其中一个，进秘境前就写明。每个首领一伙固定阵容（同一秘境同一编号永远同一伙），
// 领头尽量是主道的蛊，身上带一条专克某种打法的机制（trip-mods.js 的 MECHS）。用掉的额度 = 额度 × boss × bk；bk、bv 每个首领单独调（TUNE=1 node tools/trip-test.mjs）
//   [机制, bk, bv]：bv = 阵容第几版（换一版随机阵容），让配队一般打这个首领（带着机制）输 40% 左右
export const BOSS_DEF = {   // 调参工具会直接改这里的 bk、bv
  qingmao: [['fanzhen', 0.7, 1], ['yinxue', 0.7, 1]],
  suishi: [['tiebi', 1, 1], ['xianfa', 1, 0]],
  shangjia: [['fengli', 1, 2], ['hengsao', 0.9, 0]],
  zhangze: [['yinxue', 0.9, 2], ['baidu', 1.1, 1]],
  caohai: [['hengsao', 0.6, 2], ['kuangbao', 0.6, 2], ['duanhun', 0.6, 2]],
  liusha: [['tiebi', 0.9, 0], ['fanzhen', 0.9, 0], ['xianfa', 1, 0]],
  wangting: [['kuangbao', 0.6, 2], ['zhanruo', 0.9, 3], ['fengli', 1.1, 1]],
  jiaodao: [['yinxue', 1.3, 2], ['baidu', 1.3, 3], ['fanzhen', 1.3, 1]],
  maigu: [['duanhun', 1.1, 0], ['zhanruo', 0.9, 0], ['tiebi', 0.8, 1]],
  langya: [['hengsao', 0.8, 1], ['xianfa', 1.4, 1], ['yinxue', 1, 2]],
  yitian: [['duanhun', 1, 0], ['fengli', 1, 1], ['kuangbao', 1, 0]],
  baohuang: [['tiebi', 1, 0], ['fanzhen', 1.4, 3], ['baidu', 0.8, 1]],
  tianting: [['fengli', 0.9, 3], ['xianfa', 1.3, 0], ['zhanruo', 0.9, 0]],
};
const bossDef = (L, i = 0) => { const B = BOSS_DEF[L.id] || [['zhanruo']], b = B[((i | 0) % B.length + B.length) % B.length]; return { mech: b[0], bk: b[1] || 1, bv: b[2] || 0 }; };
export const bossFrac = (land, i = 0) => TRIP_CFG.foe.boss * bossDef(landOf(land), i).bk;
export function landBoss(land, i = 0, add = 0) {
  const L = landOf(land), b = bossDef(L, i);
  return foeByBudget(makeRng('boss:v5:' + L.id + ':' + (i | 0) + (b.bv ? ':' + b.bv : '')), L.quota, { dao: L.dao, kind: 'boss', maxRank: L.cap, frac: bossFrac(L, i) + add });
}
const bossName = (team, mech) => { const lead = team.find(g => g.boss) || team[0]; return `${MECH[mech] ? MECH[mech].n : ''}·${lead && SP[lead.sp] ? SP[lead.sp].n : '首领'}`; };
const slim = team => team.map(g => ({ sp: g.sp, rank: g.rank, pos: g.pos ? { ...g.pos } : null, boss: g.boss || 0 }));
LANDS.forEach(l => {
  l.bosses = (BOSS_DEF[l.id] || [['zhanruo']]).map((b, i) => { const team = landBoss(l, i); return { i, mech: b[0], n: bossName(team, b[0]), team: slim(team) }; });
  l.boss = l.bosses[0].team;   // 旧接口：第一个首领的阵容
});
// 房间里的敌阵（同一种子、同一层、同一条路永远是同一伙）。o = { boss: 第几个首领, add: 劫数多加的额度比例 }
export function foeTeam(seed, land, d, lane, type, o = {}) {
  const L = landOf(land); if (type === 'boss') return landBoss(L, o.boss || 0, o.add || 0);
  const kind = type === 'elite' ? 'elite' : 'room';
  return foeByBudget(makeRng(`trip:${seed}:foe:${d}:${lane}`), L.quota, { dao: L.dao, kind, depth: d, maxRank: L.cap, frac: o.add ? foeFrac(kind, d) + o.add : undefined });
}
export const foeFor = (seed, quota, opts = {}) => foeByBudget(makeRng('foe:' + seed), quota, opts);   // 给洞府（斗幽灵、战帖分场）

// ───────────── 战利品：新蛊（物种 + 转数，回洞府时变成蛊）和食物 id ─────────────
// 掉落只出道途已解锁的：出征时洞府给的 foods（食物 id）、sp（物种 id）名单，没给就是全部
const foodPoolOf = t => (t && t.foodPool && t.foodPool.length ? t.foodPool : FOODS.filter(f => f.trip !== 'stone').map(f => f.id));
const foodName = id => (FOODS.find(f => f.id === id) || { n: id }).n;
function foodPick(rng, pool, d) {   // 越深越偏向贵的（稀有）
  const w = pool.map(id => Math.pow((FOODS.find(f => f.id === id) || { cost: 3 }).cost || 3, d / 4)), tot = w.reduce((a, b) => a + b, 0); let r = rng() * tot;
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r < 0) return pool[i]; } return pool[pool.length - 1];
}
export function lootGu(rng, realm, d, bump = 0, spPool = null) {
  const L = TRIP_CFG.loot, cap = Math.min(RANK.max, (realm | 0) + 1), rare = d >= L.rare && rng() < 0.5, ok = spPool && spPool.length ? new Set(spPool) : null;
  const all = normalPool(Math.min(5, (realm | 0) + (rare ? 1 : 0))).filter(id => baseRank(id) <= cap), pool = ok ? all.filter(id => ok.has(id)) : all;
  const sp = rng.pick(pool.length ? pool : all.length ? all : normalPool(0));
  const r = Math.min(cap, Math.max(baseRank(sp), baseRank(sp) + bump + (rng() < L.up[0] + L.up[1] * d ? 1 : 0)));   // 不超过这个境界能驱使的转数
  return { sp, rank: r };
}
export function roomLoot(seed, realm, d, lane, type, foodPool, spPool = null, extraFood = 0) {
  const L = TRIP_CFG.loot[type], out = { foods: [], gu: [] }; if (!L) return out;
  const rng = makeRng(`trip:${seed}:loot:${d}:${lane}`), pool = foodPoolOf({ foodPool });
  const roll = ([p, per]) => { const q = p + per * d; let n = Math.floor(q); if (rng() < q - n) n++; return n; };
  for (let i = roll(L.food) + extraFood; i > 0; i--) out.foods.push(foodPick(rng, pool, d));
  for (let i = roll(L.gu); i > 0; i--) out.gu.push(lootGu(rng, realm, d, type === 'boss' ? 1 : 0, spPool));
  return out;
}
export function addLoot(bag, l) { (l.foods || []).forEach(f => bag.foods.push(f)); (l.gu || []).forEach(g => bag.gu.push(g)); return bag; }
export const lootEmpty = l => !l || (!(l.foods || []).length && !(l.gu || []).length);
export const guName = g => RANK.names[g.rank] + (SP[g.sp] ? SP[g.sp].n : g.sp);
export function lootText(l) {
  const a = []; if ((l.gu || []).length) a.push('新蛊：' + l.gu.map(guName).join('、'));
  if ((l.foods || []).length) a.push('食物：' + l.foods.map(foodName).join('、'));
  return a.join('；');
}

// ───────────── 奇遇：两个选项，两个结果都写明。fx 见 applyFx ─────────────
// heal/hurt = 按满血的比例；Front = 只作用在最前那只活着的蛊；healLow = 只回伤得最重的那只；hurtAll = 全队掉（不会掉到 0）
// shortcut / slow = 下一个房间路程倍数（0.5 = 减半，1.5 = 多走一半）；pay = 花几份元气（×单位×境界系数，先花攒着的，不够就选不了）
// bump = 新蛊更稀有一档。越深的奇遇给的食物越偏贵（foodPick），新蛊转数随层数涨（lootGu）
export const EVENTS = [
  { id: 'yishui', n: '古修遗蜕', s: '崖下坐着一具古修士的遗蜕，衣袍一碰就碎，掌心还托着一团温热的灵光。',
    o: [{ t: '吸了这团灵光', fx: { heal: 0.3 } }, { t: '翻他的遗物', fx: { food: 1 } }] },
  { id: 'yegu', n: '迷路的野蛊', s: '草丛里窸窸窣窣，一只野蛊跟了你们半天，像是想找个主人。',
    o: [{ t: '收下它', fx: { gu: 1 } }, { t: '分它点灵气，打发走', fx: { heal: 0.1 } }] },
  { id: 'lingquan', n: '山泉灵眼', s: '石缝里涌出一眼灵泉，水是凉的，带着淡淡的灵气。',
    o: [{ t: '全队泡一泡', fx: { heal: 0.4 } }, { t: '装一壶带走', fx: { food: 1 } }] },
  { id: 'duanya', n: '断崖窄道', s: '前面是断崖，崖壁上有一条窄道，走过去能省下大半段路。',
    o: [{ t: '走窄道', fx: { shortcut: 0.5, hurtFront: 0.4 } }, { t: '绕远路', fx: {} }] },
  { id: 'guzhen', n: '古阵残影', s: '地上刻着残缺的阵纹，阵里有一道虚影，在等人进来过招。',
    o: [{ t: '让最前的蛊入阵过招', fx: { xing: 'ruiqi', hurtFront: 0.2 } }, { t: '不进阵', fx: {} }] },
  { id: 'guchao', n: '树洞蛊巢', s: '老树洞里结着一个野蛊巢，里面有动静，守巢的那只脾气不好。',
    o: [{ t: '掏巢', fx: { gu: 1, bump: 1, hurtFront: 0.35 } }, { t: '不惊动它', fx: {} }] },
  { id: 'duzhang', n: '毒瘴林', s: '前面一片林子笼着灰绿的瘴气。穿过去最近，绕开要多走不少路。',
    o: [{ t: '屏住气穿过去', fx: { hurtAll: 0.15, shortcut: 0.5 } }, { t: '绕开走', fx: { slow: 1.5 } }] },
  { id: 'shibei', n: '无字石碑', s: '路边立着一块无字石碑，盯久了，碑面像有一座山压下来。',
    o: [{ t: '让最前的蛊对着石碑静坐', fx: { xing: 'zhenyue', slow: 1.3 } }, { t: '不看它，接着走', fx: {} }] },
  { id: 'xuechi', n: '赤水潭', s: '一潭暗红的水冒着热气。泡进去伤口发烫，出来却像换了一身筋骨。',
    o: [{ t: '让伤得最重的蛊泡进去', fx: { healLow: 0.6 } }, { t: '让最前的蛊泡到发烫', fx: { xing: 'yuxue', hurtFront: 0.25 } }] },
  { id: 'luonan', n: '落难修士', s: '一个修士靠着石头喘气，元气耗尽了，身边一只蛊守着他不肯走。',
    o: [{ t: '分他一些元气', fx: { pay: 30, payGu: 1, gu: 1, bump: 1 } }, { t: '问他前面的路', fx: { shortcut: 0.7 } }] },
];
export const EVENT = Object.fromEntries(EVENTS.map(e => [e.id, e]));
export function pickEvent(seed, d, lane, seen = []) {
  const rng = makeRng(`trip:${seed}:ev:${d}:${lane}`), pool = EVENTS.filter(e => !seen.includes(e.id));
  return rng.pick(pool.length ? pool : EVENTS).id;
}
// 一个选项写成人话：结果是什么、放到哪
export const guPrice = rank => PRICE.gu * Math.pow(PRICE.rankK, Math.max(1, rank | 0) - 1);   // 一只 rank 转的蛊在蛊市值多少（千）：买原生的或三合一升上来都是这个价
export const evPay = (t, fx, unit) => !fx || !fx.pay ? 0 : Math.round(unit * (fx.payGu ? guPrice(driveCap(t ? t.realm : 0)) * TRIP_CFG.pay.gu : fx.pay * (1 + (t ? t.realm : 0) * TRIP_CFG.pay.realm)));
export function fxText(fx, pay = 0) {
  const out = [], pc = p => Math.round(p * 100) + '%';
  if (fx.pay) out.push(`花 ${fmtTok(pay || fx.pay)} 元气`);
  if (fx.heal) out.push(`全队回满血的 ${pc(fx.heal)}`);
  if (fx.food) out.push(`食物 ×${fx.food}（进战利品袋）`);
  if (fx.healLow) out.push(`伤得最重的那只回满血的 ${pc(fx.healLow)}`);
  if (fx.gu) out.push(`新蛊 ×${fx.gu}${fx.bump ? '，转数高一档' : ''}（进战利品袋，回洞府放进蛊囊）`);
  if (fx.xing) out.push(`最前的蛊得蛊性「${XING[fx.xing].n}」：${XING[fx.xing].d}`);
  if (fx.shortcut) out.push(`下一个房间少走 ${pc(1 - fx.shortcut)} 的路`);
  if (fx.slow) out.push(`下一个房间多走 ${pc(fx.slow - 1)} 的路`);
  if (fx.hurtFront) out.push(`最前的蛊掉满血的 ${pc(fx.hurtFront)}（不会掉到 0）`);
  if (fx.hurtAll) out.push(`全队掉满血的 ${pc(fx.hurtAll)}（不会掉到 0）`);
  return out.length ? out.join('，') : '什么也不发生';
}

// ───────────── 出征状态（S.trip）─────────────
// { v, seed, land, realm, quota, d, lane, pick, prog, order, hp, mx, dead, fallen, saved, loot, log, room, end, kills, seen, short, foodPool, pre }
//   saved = 这一趟倒下过又被救回的蛊（不重复）；dead / fallen = 永久死亡的（只有打输那一场才有）
//   d 当前第几层（0 起）；lane 上一层走的路（第一层前为 null）；pick 这一层选好的路；prog 这个房间已走的元气
//   room 走到后待处理的房间 { type, d, lane, foe?, ev?, wares?, done? }；end 结束结果；short 下一个房间路程倍数（断崖窄道）
// purse：放元气的对象（界面传 S，用 S.bank），选路时先从里面花；等待时进账的 token 也存回去
// opts = { trip: 出征食物 id（S.tripFood）, foods / sp: 道途已解锁的食物、物种 id（掉落只出这些，不给 = 全部）, kalpa: 第几劫（0 = 普通） }
// 天象和首领由种子 + 秘境定（tripPlan），进秘境前就能算出来给玩家看（tripPreview）
export function tripStart(seed, land, team, opts = {}) {   // land = 秘境 id（也认境界数字，取那个境界的第一个秘境）
  const L = landOf(land), fielded = team.slice(0, SLOTS), plan = tripPlan(seed, L), tf = (opts.trip || []).map(id => FOOD[id]).filter(f => f && f.kind === 'trip');
  const t = { v: 2, seed: String(seed), land: L.id, realm: L.realm, quota: L.quota, d: 0, lane: null, pick: null, prog: 0, order: fielded.map(g => g.uid), hp: {}, mx: {}, dead: [], fallen: [],
    loot: { foods: [], gu: [] }, log: [], room: null, end: null, kills: {}, saved: [], seen: [], rooms: 0, short: 1, foodPool: (opts.foods || []).slice(), spPool: opts.sp && opts.sp.length ? opts.sp.slice() : null,
    kalpa: Math.max(0, Math.min(JIE_MAX, opts.kalpa | 0)), sky: plan.sky, boss: plan.boss, bless: [], offer: null, reward: null, got: null,
    map: tripMap(seed, L.realm), path: [],                                                                   // 整张地图进秘境时就生成好存下；path = 每层走的哪条路
    pre: Math.min(1, tf.reduce((a, f) => a + (f.trip === 'heal' ? (f.pct || 0) / 100 : 0), 0)),                 // 回春茶、续命汤：每场开打前全队回的比例
    road: tf.reduce((a, f) => a * (f.trip === 'road' ? 1 - (f.pct || 0) / 100 : 1), 1),                       // 寻路图：路程乘几
    revive: Math.max(0, ...tf.map(f => (f.trip === 'revive' ? (f.pct || 0) / 100 : 0))), revived: null,       // 定魂香：第一只倒下的蛊下一场以几成血站起来
    eff: tf.filter(f => f.trip === 'eff' && f.eff).map(f => f.id) };                                         // 惊雷符等：每场挂给出场蛊
  fielded.forEach(g => { t.hp[g.uid] = g.hp; t.mx[g.uid] = g.hp; t.kills[g.uid] = 0; });
  tlog(t, `进入${L.n}${t.kalpa ? '（' + JIE_NAMES[t.kalpa] + '）' : ''}：${fielded.map(g => SP[g.sp] ? SP[g.sp].n : g.sp).join('、')}。天象「${SKY[t.sky].n}」。共 ${TRIP_CFG.depth} 层，最深处是首领。`);
  return t;
}
const tlog = (t, s) => { t.log.push(s); if (t.log.length > 60) t.log.splice(0, t.log.length - 60); };
const MAPC = new Map();   // 旧存档没存地图时由种子现算
export function tripMapOf(t) { if (t.map) return t.map; const k = t.seed + '|' + t.realm; if (!MAPC.has(k)) { if (MAPC.size > 8) MAPC.clear(); MAPC.set(k, tripMap(t.seed, t.realm)); } return MAPC.get(k); }
export const tripAlive = t => t.order.filter(u => !t.dead.includes(u));
// 这一层能选哪几条路
export function tripReach(t) {
  const map = tripMapOf(t); if (t.end || t.room || t.d >= map.length) return [];
  if (map[t.d].boss) return [1];
  return t.d === 0 || t.lane == null ? [0, 1, 2] : nextLanes(map, t.d - 1, t.lane);
}
export const roomAt = (t, d, lane) => { const row = tripMapOf(t)[d]; return row ? row.rooms.find(r => r.lane === lane) || null : null; };
export const curRoom = t => t.pick != null ? roomAt(t, t.d, t.pick) : null;
// 路程倍数：出征食物（寻路图）× 祝福（风行）× 劫数（路程 +20%）
export const roadOf = t => (t.road || 1) * blessRules(t.bless).road * jieRules(t.kalpa).road;
export const needTok = (t, unit) => { const r = curRoom(t); return r ? Math.round(r.cost * unit * (t.short || 1) * roadOf(t)) : 0; };
export const campOf = t => { const b = blessRules(t.bless).camp, j = jieRules(t.kalpa).camp; return b != null ? b : j != null ? j : TRIP_CFG.camp; };   // 篝火回几成：祝福「篝火旺」优先，其次劫数
// 选路：先花攒着的元气；返回是否当场就走到了
export function tripPick(t, lane, unit, purse) {
  if (!tripReach(t).includes(lane) || t.pick != null) return false;
  t.pick = lane; t.prog = 0; return tripPour(t, unit, purse);
}
export function tripPour(t, unit, purse) {
  if (!curRoom(t) || t.room) return false;
  const take = Math.max(0, Math.min(needTok(t, unit) - t.prog, purse ? purse.bank || 0 : 0));
  if (take) purse.bank -= take; t.prog += take;
  if (t.prog >= needTok(t, unit) - 0.5) { arrive(t); return true; }
  return false;
}
// 实时 token：在走路就推进（多出来的存回 purse），否则全部存回 purse。返回是否刚走到一个房间
export function tripFeed(t, tok, unit, purse) {
  if (!(tok > 0)) return false;
  const add = n => { if (purse && n > 0) purse.bank = (purse.bank || 0) + n; };
  if (!t || t.end || !curRoom(t) || t.room) { add(tok); return false; }
  const take = Math.min(needTok(t, unit) - t.prog, tok); t.prog += take; add(tok - take);
  if (t.prog >= needTok(t, unit) - 0.5) { arrive(t); return true; }
  return false;
}
function arrive(t) {
  const r = curRoom(t), room = { type: r.type, d: t.d, lane: r.lane };
  if (r.type === 'fight' || r.type === 'elite' || r.type === 'boss') room.foe = 1;   // 阵容用 roomFoe(t) 现算（同种子永远相同），不进存档
  if (r.type === 'event') { room.ev = pickEvent(t.seed, t.d, r.lane, t.seen); t.seen.push(room.ev); }
  if (r.type === 'market') room.wares = marketWares(t, r);
  if (r.type === 'bless') room.choices = blessChoices(t, `${t.d}:${r.lane}`);
  t.room = room; t.rooms++; t.short = 1; t.prog = 0;
  tlog(t, `第 ${t.d + 1} 层 · ${ROOMS[r.type].n}`);
}
// 房间里的敌阵，带上这一趟的天象、劫数和首领机制（g.fx，battle-spec 第 11 节）
export function roomFoe(t) {
  if (!t.room || !t.room.foe) return null;
  const type = t.room.type, jr = jieRules(t.kalpa), add = type === 'boss' ? jr.boss : type === 'elite' ? jr.elite : jr.room;
  return foeTeam(t.seed, t.land || t.realm, t.room.d, t.room.lane, type, { boss: t.boss || 0, add }).map(g => ({ ...g, fx: foeFx(t, g, type === 'boss') }));
}
export const tripLand = t => landOf(t.land || t.realm);
function leave(t) {   // 房间处理完：进下一层（首领打完就结束）
  (t.path || (t.path = []))[t.d] = t.pick; t.lane = t.pick; t.pick = null; t.prog = 0; t.room = null; t.d++;
  if (t.d >= tripMapOf(t).length) tripEnd(t, 'clear');
}
// 出战阵容：出征时的站位，去掉倒下的；每只带 hpNow（上一场剩的血）
export function fieldTeam(t, team) {   // 每只带上天象、祝福、出征食物的效果（g.fx）
  const by = Object.fromEntries(team.map(g => [g.uid, g]));
  return tripAlive(t).filter(u => by[u]).map(u => ({ ...by[u], hpNow: t.hp[u], fx: myFx(t, by[u]) }));
}
// 引擎还没给 hpEnd 时：从最后一帧快照读我方剩血（我方出场蛊按顺序登记为 a0, a1 …）
export function hpFromLog(res, n) {
  const last = res.log && res.log[res.log.length - 1], s = last && last.s ? last.s[0] : [], hp = new Array(n).fill(0);
  s.forEach(([uid, , h]) => { const i = /^a(\d+)$/.test(uid) ? +uid.slice(1) : -1; if (i >= 0 && i < n) hp[i] = Math.max(0, h | 0); });
  return hp;
}
// 战斗结果落地（规则：赢了救回，输了全死）：res = battle() 的返回（或 api.playBattle 给的 res），fielded = 开打时的 fieldTeam(t, team)。
//   赢了：这一场倒下的全部救回，剩 1 血继续走；输了：场上的蛊全部永久死亡，出征结束（= 全灭，战利品全丢）；
//   平手（打满轮数）：双方退开，倒下的也救回，这个房间不给战利品；首领平手就带着战利品退回洞府。
//   定魂香：这一趟第一只倒下的蛊不是剩 1 血，而是以 revive 比例的血站起来（只一次）。
//   打赢精英：给三个祝福选一个（t.offer）；打赢首领：渡劫成功，先在两样必掉的东西里选一样（t.reward → tripReward），再回洞府。
// 返回 { win, saved:[uid], dead:[uid], loot, offers:[{uid, xing, old, auto}], revived?, bless?, reward?, wiped?, cleared?, fled? }
export function tripFight(t, team, fielded, res) {
  const room = t.room; if (!room || !room.foe || room.done) return null;
  const win = res.winner === 'A', lost = res.winner === 'B', saved = [], offers = [], by = Object.fromEntries(team.map(g => [g.uid, g]));
  const hpEnd = res.hpEnd || res.hpA || hpFromLog(res, fielded.length), stat = res.statA || [];
  const name = id => (SP[(by[id] || {}).sp] || {}).n || '';
  room.done = true;
  if (lost) {
    fielded.forEach((g, i) => { const st = stat[i]; if (st) t.kills[g.uid] = (t.kills[g.uid] || 0) + (st.kills | 0); });
    const dead = fielded.map(g => g.uid);
    dead.forEach(u => { if (t.dead.includes(u)) return; t.dead.push(u); t.hp[u] = 0; const g = by[u] || fielded.find(x => x.uid === u) || {};
      t.fallen.push({ uid: u, sp: g.sp, rank: g.rank, d: room.d, type: room.type, kills: t.kills[u] || 0, xing: g.xing || null }); });
    tlog(t, `败。场上的蛊全部永久死亡：${dead.map(name).join('、')}`);
    tripEnd(t, 'wipe'); return { win: false, saved, dead, loot: null, offers, wiped: true };
  }
  fielded.forEach((g, i) => {
    const hp = Math.max(0, Math.round(hpEnd[i] || 0)), st = stat[i] || null, real = by[g.uid];
    if (st) t.kills[g.uid] = (t.kills[g.uid] || 0) + (st.kills | 0);
    if (hp <= 0) {   // 倒下了但这一场没输：救回，剩 1 血（定魂香：第一只以几成血站起来）
      saved.push(g.uid); if (!t.saved.includes(g.uid)) t.saved.push(g.uid); t.hp[g.uid] = Math.max(1, Math.round(t.mx[g.uid] * blessRules(t.bless).rescue));   // 祝福「抢救」：救回剩三成
      if (t.revive && !t.revived) { t.revived = g.uid; t.hp[g.uid] = Math.max(1, Math.round(t.mx[g.uid] * t.revive)); }
      return;
    }
    t.hp[g.uid] = Math.min(t.mx[g.uid], hp);
    const k = real ? xingEarned(st, win, real.xing) : null;
    if (k) { if (!real.xing) { real.xing = k; offers.push({ uid: g.uid, xing: k, old: null, auto: true }); } else offers.push({ uid: g.uid, xing: k, old: real.xing }); }
  });
  let loot = null; const revived = saved.includes(t.revived) && t.hp[t.revived] > 1 ? t.revived : null;
  if (win) { loot = roomLoot(t.seed, t.realm, room.d, room.lane, room.type, t.foodPool, t.spPool, blessRules(t.bless).food); addLoot(t.loot, loot); }
  (t.bless || []).forEach(x => { if (x.left > 0) x.left--; });   // 只管几场的祝福（庇佑）少一场
  tlog(t, `${win ? '胜' : '僵持不下，各自退开'}${saved.length ? '。救回：' + saved.map(name).join('、') + '（剩 1 血）' : ''}${revived ? `。定魂香：${name(revived)} 以 ${Math.round(t.revive * 100)}% 血站起来` : ''}${loot && !lootEmpty(loot) ? '。' + lootText(loot) : ''}`);
  offers.filter(o => o.auto).forEach(o => tlog(t, `${name(o.uid)} 得蛊性「${XING[o.xing].n}」`));
  const out = { win, saved, dead: [], loot, offers, revived };
  if (room.type === 'boss') {
    if (win) { t.reward = bossReward(t.seed, t.land, { sp: t.spPool, foods: t.foodPool }); tlog(t, '渡劫成功。首领必掉一样东西，二选一'); return { ...out, cleared: true, reward: t.reward }; }
    tripEnd(t, 'retreat'); return { ...out, fled: true };
  }
  if (win && room.type === 'elite') { t.offer = { from: 'elite', ids: blessChoices(t, `e${room.d}:${room.lane}`) }; out.bless = t.offer.ids; }
  leave(t);
  return out;
}
// 出征食物：每场开打前全队回 t.pre 比例的血。返回回了多少
export const preOf = t => Math.min(1, (t.pre || 0) + blessRules(t.bless).pre);   // 出征食物（回春茶）+ 祝福「庇佑」
export function tripPreFight(t) {
  const p = t ? preOf(t) : 0; if (!p) return 0; let sum = 0;
  tripAlive(t).forEach(u => { const v = Math.min(t.mx[u] - t.hp[u], Math.max(1, Math.round(t.mx[u] * p))); t.hp[u] += v; sum += v; });
  return sum;
}

// ───────────── 祝福：灵台房间、打赢精英后三选一，只在这一趟有效 ─────────────
// 三个不重复、手里还没有的；同一个地方永远是同样三个
export function blessChoices(t, key) {
  const have = new Set((t.bless || []).map(x => x.id)), pool = BLESSES.filter(b => !have.has(b.id)), rng = makeRng(`trip:${t.seed}:bless:${key}`), out = [];
  while (out.length < TRIP_CFG.bless && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].id);
  return out;
}
function addBless(t, id) { const b = BLESS[id]; if (!b) return false; t.bless = t.bless || []; t.bless.push({ id, left: b.fights || 0 }); tlog(t, `得祝福「${b.n}」：${b.d}（${blessLast(b)}）`); return true; }
// 灵台：选第 i 个
export function tripBless(t, i) {
  const room = t.room; if (!room || room.type !== 'bless' || room.done) return null;
  const id = room.choices[i]; if (!id || !addBless(t, id)) return null;
  room.done = true; leave(t); return { id };
}
// 打赢精英后的三选一：选第 i 个（i < 0 = 不要）
export function tripOffer(t, i) {
  const o = t.offer; if (!o) return null; t.offer = null;
  const id = o.ids[i]; if (id && addBless(t, id)) return { id }; return { id: null };
}
// 这一趟手里的祝福 [{ id, n, d, last, left }]（界面列出来；用完的不列）
export const blessList = t => (t.bless || []).map(x => ({ ...x, b: BLESS[x.id] })).filter(x => x.b && (!x.b.fights || x.left > 0)).map(x => ({ id: x.id, n: x.b.n, d: x.b.d, last: x.b.fights ? `还剩 ${x.left} 场` : '这一趟有效', left: x.left }));

// ───────────── 战斗挂件 g.fx：天象（双方）、祝福和出征食物（我方）、劫数和首领机制（敌方）─────────────
const skyFx = (t, g, k) => { const sk = SKY[t.sky], e = sk ? skyEff(sk, daoOf(g.sp), k) : []; return e.length ? [{ id: 'sky_' + sk.id, n: sk.n, kind: 'sky', eff: e }] : []; };
export function myFx(t, g) {
  const out = skyFx(t, g, jieRules(t.kalpa).sky);
  (t.bless || []).forEach(x => { const b = BLESS[x.id]; if (b && b.eff && (!b.fights || x.left > 0)) out.push({ id: 'bless_' + b.id, n: b.n, kind: 'bless', eff: b.eff }); });
  (t.eff || []).forEach(id => { const f = FOOD[id]; if (f && f.eff) out.push({ id: 'food_' + id, n: f.n, kind: 'food', eff: f.eff }); });
  return out;
}
// 这一趟首领带的机制（劫十再多带一条：这个秘境下一个首领的机制）
export function bossMechs(t) {
  const L = landOf(t.land || t.realm), B = BOSS_DEF[L.id] || [['zhanruo']], i = (t.boss || 0) % B.length, ids = [B[i][0]];
  if (jieRules(t.kalpa).mech2) { const m2 = B.map(b => b[0]).find(m => m !== ids[0]) || MECHS.find(m => m.id !== ids[0]).id; ids.push(m2); }
  return ids.map(id => MECH[id]).filter(Boolean);
}
export function foeFx(t, g, isBoss) {
  const jr = jieRules(t.kalpa), out = skyFx(t, g, jr.sky);
  if (jr.foe.length) out.push({ id: 'jie', n: JIE_NAMES[t.kalpa], kind: 'jie', eff: jr.foe });
  if (isBoss) bossMechs(t).forEach(m => { if (m.on === 'team' || g.boss) out.push({ id: 'boss_' + m.id, n: m.n, kind: 'boss', eff: m.eff }); });
  return out;
}

// ───────────── 渡劫成功的奖励：首领必掉，二选一（这个秘境主道的一只高转蛊，或一份稀有食物）─────────────
// 高转 = 这个境界能驱使的最高转数；稀有食物 = 价钱 4 档及以上（道途解锁过的）。同一趟永远是同样两样
export function bossReward(seed, land, o = {}) {
  const L = landOf(land), rng = makeRng(`trip:${seed}:reward:${L.id}`), rank = driveCap(L.realm), ok = o.sp && o.sp.length ? new Set(o.sp) : null;
  const all = NORMAL_SPECIES.map(s => s.id).filter(id => daoOf(id) === L.dao && baseRank(id) <= rank), sps = ok && all.some(id => ok.has(id)) ? all.filter(id => ok.has(id)) : all;
  const w = sps.map(id => baseRank(id) * baseRank(id)), tot = w.reduce((a, b) => a + b, 0); let x = rng() * tot, sp = sps[0];   // 原本就是高转的物种更常出
  for (let i = 0; i < sps.length; i++) { x -= w[i]; if (x < 0) { sp = sps[i]; break; } }
  const fp = foodPoolOf({ foodPool: o.foods }), rare = fp.filter(id => FOOD[id] && (FOOD[id].cost || 0) >= 4);
  return { gu: sp ? { sp, rank: Math.max(baseRank(sp), rank) } : null, food: rng.pick(rare.length ? rare : fp) };
}
// 选一样：k = 'gu' | 'food'。放进战利品袋，然后渡劫成功、回洞府
export function tripReward(t, k) {
  const r = t.reward; if (!r || !(k === 'gu' ? r.gu : r.food)) return null;
  t.reward = null; t.got = k === 'gu' ? { k, gu: { ...r.gu } } : { k, food: r.food };
  if (k === 'gu') t.loot.gu.push({ ...r.gu }); else t.loot.foods.push(r.food);
  tlog(t, `首领掉落：${k === 'gu' ? guName(r.gu) : foodName(r.food)}`);
  leave(t); return t.got;
}
// 给选秘境列表的「渡劫成功可得」：{ pick: [两样二选一的说明], first: [第一次渡过才有的], lines: [全部，一行一条] }
//   o = { realm: 玩家当前境界, best: 这个秘境通关过的最高劫（没通关过 = -1 或不给）, kalpa: 这次打第几劫 }
export function landReward(land, o = {}) {
  const L = landOf(land), rank = driveCap(L.realm), dao = DAO[L.dao] ? DAO[L.dao].n : L.dao, best = o.best == null ? -1 : o.best, k = o.kalpa | 0;
  const pick = [`${dao}的一只${RANK.names[rank]}蛊`, '一份稀有食物'], first = [];
  if (best < 0 && o.realm != null && L.realm === o.realm && o.realm < REALMS.length - 1) first.push(`境界晋一层：${REALMS[o.realm + 1]}`);
  if (best < 0) first.push('这个秘境开放劫一');
  else if (k > best && k < JIE_MAX) first.push(`这个秘境开放${JIE_NAMES[k + 1]}`);
  return { pick, first, lines: [`首领必掉，二选一：${pick.join('，或')}`, ...first, '这一趟的战利品全部带回'] };
}

// ───────────── 进秘境前就能看的：天象、首领、劫数 ─────────────
// 同一个种子、同一个秘境永远是同一个天象和首领（洞府先用 tripPreview 给玩家看，出征时 tripStart 用同一个种子）
export function tripPlan(seed, land) {
  const L = landOf(land), rng = makeRng(`trip:${seed}:plan:${L.id}`), n = (BOSS_DEF[L.id] || [1]).length;
  return { sky: rng.pick(SKIES).id, boss: Math.floor(rng() * n) };
}
export function tripPreview(seed, land, kalpa = 0, o = {}) {
  const L = landOf(land), p = tripPlan(seed, L), t = { seed: String(seed), land: L.id, realm: L.realm, kalpa: Math.max(0, Math.min(JIE_MAX, kalpa | 0)), sky: p.sky, boss: p.boss };
  const B = L.bosses[p.boss], jr = jieRules(t.kalpa), team = jr.boss ? slim(landBoss(L, p.boss, jr.boss)) : B.team, sk = SKY[p.sky];
  return { land: L.id, n: L.n, sky: { id: sk.id, n: sk.n, d: sk.d + (jr.sky !== 1 ? `（劫数加重：数值 ×${jr.sky}）` : '') },
    boss: { i: p.boss, n: B.n, team, mechs: bossMechs(t).map(m => ({ id: m.id, n: m.n, k: m.k, d: m.d })) },
    kalpa: { n: t.kalpa, name: JIE_NAMES[t.kalpa] || '普通', rules: JIE.slice(0, t.kalpa).map(j => j.n) }, reward: landReward(L, { ...o, kalpa: t.kalpa }) };
}
// 一趟里的天象、首领机制、劫数（界面在顶上和开打前写明）
//   boss = { i, mech, n, team }（team 已算上劫数多用的额度）
export function tripMods(t) {
  const L = landOf(t.land || t.realm), B = (L.bosses || [])[t.boss || 0] || null, add = jieRules(t.kalpa).boss;
  return { sky: SKY[t.sky] || null, mechs: bossMechs(t), kalpa: t.kalpa || 0, kalpaName: JIE_NAMES[t.kalpa] || '', rules: JIE.slice(0, t.kalpa || 0).map(j => j.n),
    boss: B && { ...B, team: add ? slim(landBoss(L, t.boss || 0, add)) : B.team } };
}
export function acceptXing(team, uid, key) { const g = team.find(x => x.uid === uid); if (g && XING[key]) { g.xing = key; return true; } return false; }
// 奇遇：选第 i 个选项。返回 { ok, lines, offer? }
export function tripEvent(t, team, i, unit = 0, purse = null) {
  const room = t.room; if (!room || room.type !== 'event' || room.done) return { ok: false };
  const e = EVENT[room.ev], o = e && e.o[i]; if (!o) return { ok: false };
  const pay = evPay(t, o.fx, unit); if (pay) { if (!purse || (purse.bank || 0) < pay) return { ok: false, why: '元气不够' }; purse.bank -= pay; }
  const r = applyFx(t, team, o.fx, room);
  room.done = true; tlog(t, `${e.n}：${o.t}。${r.lines.join('，') || '无事发生'}`); leave(t); return r;
}
function applyFx(t, team, fx, room) {
  const lines = [], al = tripAlive(t), front = al[0], by = Object.fromEntries(team.map(g => [g.uid, g])), nm = u => (SP[(by[u] || {}).sp] || {}).n || '';
  const rng = makeRng(`trip:${t.seed}:fx:${room.d}:${room.lane}`); let offer = null;
  if (fx.heal) { al.forEach(u => { t.hp[u] = Math.min(t.mx[u], t.hp[u] + Math.max(1, Math.round(t.mx[u] * fx.heal))); }); lines.push(`全队回血 ${Math.round(fx.heal * 100)}%`); }
  for (let k = 0; k < (fx.food || 0); k++) { const id = foodPick(rng, foodPoolOf(t), room.d); t.loot.foods.push(id); lines.push(`食物：${foodName(id)}`); }
  if (fx.healLow) { const u = al.slice().sort((a, b) => t.hp[a] / t.mx[a] - t.hp[b] / t.mx[b])[0]; if (u) { const v = Math.min(t.mx[u] - t.hp[u], Math.round(t.mx[u] * fx.healLow)); t.hp[u] += v; lines.push(`${nm(u)} 回 ${v} 血`); } }
  for (let k = 0; k < (fx.gu || 0); k++) { const g = lootGu(rng, t.realm, room.d, fx.bump || 0, t.spPool); t.loot.gu.push(g); lines.push(`新蛊：${guName(g)}`); }
  if (fx.shortcut) { t.short = fx.shortcut; lines.push(`下一个房间少走 ${Math.round((1 - fx.shortcut) * 100)}% 的路`); }
  if (fx.slow) { t.short = fx.slow; lines.push(`下一个房间多走 ${Math.round((fx.slow - 1) * 100)}% 的路`); }
  if (fx.hurtAll) { al.forEach(u => { t.hp[u] -= Math.max(0, Math.min(t.hp[u] - 1, Math.max(1, Math.round(t.mx[u] * fx.hurtAll)))); }); lines.push(`全队掉 ${Math.round(fx.hurtAll * 100)}% 血`); }
  if (fx.hurtFront && front) { const v = Math.max(0, Math.min(t.hp[front] - 1, Math.round(t.mx[front] * fx.hurtFront))); t.hp[front] -= v; lines.push(`${nm(front)} 掉 ${v} 血`); }
  if (fx.xing && front && by[front]) {
    const g = by[front]; if (!g.xing) { g.xing = fx.xing; lines.push(`${nm(front)} 得蛊性「${XING[fx.xing].n}」`); }
    else if (g.xing !== fx.xing) offer = { uid: front, xing: fx.xing, old: g.xing };
  }
  return { ok: true, lines, offer };
}
export function tripCamp(t) {
  const room = t.room; if (!room || room.type !== 'camp' || room.done) return null;
  let sum = 0; const p = campOf(t); tripAlive(t).forEach(u => { const v = Math.min(t.mx[u] - t.hp[u], Math.round(t.mx[u] * p)); t.hp[u] += v; sum += v; });
  room.done = true; tlog(t, `篝火边歇了一阵，全队共回 ${sum} 血`); leave(t); return { healed: sum };
}
// 坊市：三样货，花元气（先花攒着的）
function marketWares(t, r) {   // 价格：每高一境 +25%；劫数涨价、祝福「熟客」半价
  const M = TRIP_CFG.market, rng = makeRng(`trip:${t.seed}:mk:${t.d}:${r.lane}`), k = jieRules(t.kalpa).price * blessRules(t.bless).price;
  const fd = foodPick(rng, foodPoolOf(t), t.d), g = lootGu(rng, t.realm, t.d, 0, t.spPool);
  return [{ k: 'heal', p: M.heal, price: Math.round(M.price.heal * (1 + t.realm * M.realm) * k) },
    { k: 'food', id: fd, price: Math.round(((FOOD[fd] && FOOD[fd].cost) || 3) * PRICE.food * M.prem.food * k) },
    { k: 'gu', g, price: Math.round(guPrice(g.rank) * M.prem.gu * k) }];
}
export const wareTok = (w, unit) => w.price * unit;
export function tripBuy(t, i, unit, purse) {
  const room = t.room; if (!room || room.type !== 'market' || room.done) return { ok: false };
  const w = room.wares[i], c = w ? wareTok(w, unit) : 0; if (!w || w.sold) return { ok: false }; if (!purse || (purse.bank || 0) < c) return { ok: false, why: '元气不够' };
  purse.bank -= c; w.sold = true;
  if (w.k === 'heal') tripAlive(t).forEach(u => { t.hp[u] = Math.min(t.mx[u], t.hp[u] + Math.round(t.mx[u] * w.p)); });
  if (w.k === 'food') t.loot.foods.push(w.id);
  if (w.k === 'gu') t.loot.gu.push(w.g);
  tlog(t, `坊市：${wareText(w)}`); return { ok: true };
}
export const wareText = w => w.k === 'heal' ? `药汤：全队回满血的 ${Math.round(w.p * 100)}%` : w.k === 'food' ? `食物：${foodName(w.id)}（进战利品袋）` : `新蛊：${guName(w.g)}（进战利品袋）`;
export function tripLeaveRoom(t) { const room = t.room; if (!room || room.type !== 'market') return false; room.done = true; tlog(t, '离开坊市'); leave(t); return true; }
// 结束：retreat 退出秘境（带回全部）/ wipe 渡劫失败（全队永久死亡，战利品全丢）/ clear 渡劫成功（带回全部，含首领掉落）
export function tripEnd(t, why) {
  if (t.end) return t.end;
  const wiped = why === 'wipe', copy = l => ({ foods: l.foods.slice(), gu: l.gu.map(g => ({ ...g })) });
  t.end = { why, dead: t.dead.slice(), survivors: tripAlive(t), saved: (t.saved || []).filter(u => !t.dead.includes(u)), loot: wiped ? { foods: [], gu: [] } : copy(t.loot), lost: wiped ? copy(t.loot) : null, cleared: why === 'clear', wiped, depth: t.d, fallen: t.fallen.slice() };
  t.room = null; t.pick = null; t.prog = 0; t.offer = null; t.reward = null;
  tlog(t, wiped ? '渡劫失败，全队永久死亡。这一趟的战利品全部丢在了秘境里。' : why === 'clear' ? '渡劫成功，带着战利品回洞府。' : '退出秘境，带着战利品回洞府。');
  return t.end;
}
// 给 api.onTripEnd 的结果（hooks.js）：新蛊写成 { sp, rank }，洞府放进蛊囊；规则第二版没有元石
//   land 秘境 id、kalpa 这一趟第几劫（道途的「劫数」计数用）、reward 渡劫成功时选的那样（{ k: 'gu', gu } 或 { k: 'food', food }）
export const tripResult = t => t.end ? { dead: t.end.dead, survivors: t.end.survivors, loot: { foods: t.end.loot.foods.slice(), gu: t.end.loot.gu.map(g => ({ sp: g.sp, rank: g.rank })) }, cleared: t.end.cleared, wiped: t.end.wiped,
  land: t.land, kalpa: t.kalpa || 0, reward: t.got || null } : null;
export function epitaph(f) {   // 告别词：死在哪、这一趟斩敌几只、带着什么蛊性
  return `死在第 ${f.d + 1} 层的${ROOMS[f.type] ? ROOMS[f.type].n : ''}${f.kills ? `，这一趟斩敌 ${f.kills} 只` : ''}${f.xing && XING[f.xing] ? `，带着「${XING[f.xing].n}」走了` : ''}。`;
}
export const toBoss = t => Math.max(0, TRIP_CFG.depth - 1 - t.d);
export const tripSeed = (base, n) => (hashStr(String(base) + ':trip:' + n) >>> 0).toString(36);
