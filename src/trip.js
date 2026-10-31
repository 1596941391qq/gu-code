// 蛊码 GuCode · 秘境（纯逻辑：地图、房间、血量延续、永久死亡、撤退与全灭、战利品、蛊性）。种子随机，不碰 DOM。
// 规则正本：docs/design.md 第 2 节。界面在 trip-ui.js。战斗引擎归战斗一侧：秘境给出场蛊带 hpNow，读回 res.hpEnd（每只剩血，0 = 倒下）
// 和 res.statA（每只这一场的经历，判蛊性用）；引擎还没给 hpEnd 时，用最后一帧快照兜底（hpFromLog）。
// 资源只有元气（= 消耗的 token）：房间路程、坊市、奇遇里要花的都按元气算，先花洞府攒着的（purse.bank），不够就等实时 token。
import { makeRng, hashStr, SP, poolFor, baseRank, RANK, SLOTS, XING, fmtTok, statFor, daoOf, NORMAL_SPECIES, autoPlace, arrangeTeam, QUOTA } from './core.js';   // QUOTA（各境界额度）定义在 core，洞府也用
import { FOODS } from './foods.js';

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
  w: { fight: 52, event: 18, elite: 12, camp: 9, market: 9 },      // 房间权重
  from: { event: 1, market: 2, elite: 3, camp: 3 },                 // 第几层（从 0 数）起出现
  rowMax: { elite: 1, camp: 1, market: 1, event: 1 },               // 同一层最多几个
  // 敌阵只按额度配，不看玩家的蛊池（见 foeByBudget）：额度 = 上阵蛊转数总和的上限。
  // 用掉的额度：普通战斗 frac[0] + frac[1]×(层数 − ramp)（前 3 层 60%，第 6 层 80%，第 9 层满额）；精英满额；首领 = 额度 × boss（多 20%）。
  // st = 敌蛊攻血按转数表的几成算（秘境里的是没人喂养的野蛊；斗幽灵 ghost 按 1，和玩家一样）：普通战斗 st.room[0] + st.room[1]×(层数 − ramp)；
  //   再乘 1 − qk×(最高转数 − 1)：高转的蛊技能觉醒、出手更狠，同样几成攻血打得更凶，所以额度越高打得越折。首领的领头攻血再 +lead
  foe: { frac: [0.6, 0.067], ramp: 2, elite: 1, boss: 1.2, ghost: 1, maxN: 7, daoP: 0.65, st: { room: [0.28, 0.07], elite: 0.7, boss: 0.42, ghost: 1 }, qk: { room: 0.15, elite: 0.15, boss: 0.08 }, lead: 0.3 },
  camp: 0.5,                                   // 篝火：全队回满血的 50%
  // 战利品只有新蛊和食物，越深越多、越稀有：数量 = 基数 + 每层 × 层数（小数部分按几率）；新蛊升一转的几率 up[0] + up[1]×层数，
  // 第 rare 层起一半几率出自高一档蛊池；食物按价钱算稀有，越深越偏向贵的
  loot: {
    fight: { food: [0.25, 0.04], gu: [0.12, 0.03] },
    elite: { food: [1, 0.05], gu: [0.6, 0.04] },
    boss: { food: [2, 0], gu: [1, 0] },
    up: [0.05, 0.05], rare: 5,
  },
  market: { heal: 0.4, price: { heal: 35, food: 45, gu: 70 }, realm: 0.25 },   // 坊市价格（千，乘 unit 得元气），每高一境 +25%
  pay: { realm: 0.25 },                        // 奇遇里要花的元气，每高一境 +25%
};
export const ROOMS = {
  fight:  { n: '战斗', ch: '斗', d: '一伙野蛊拦路。赢了可能掉食物和新蛊' },
  elite:  { n: '精英', ch: '精', d: '强敌，开打前能看阵容。赢了必得食物，常有新蛊' },
  event:  { n: '奇遇', ch: '遇', d: '一段小事，两个选择，结果都先写明' },
  camp:   { n: '篝火', ch: '火', d: '歇脚，全队回满血的一半' },
  market: { n: '坊市', ch: '市', d: '小货摊：花元气买回血、食物或新蛊' },
  boss:   { n: '首领', ch: '劫', d: '秘境最深处的首领。赢了带着全部战利品回洞府；打赢本境界秘境的首领就是渡劫成功，境界加一' },
};

// ───────────── 地图：三条路，每层三个房间。左路通 左/中，右路通 中/右，中路通 中 + 本层指定的一侧；最深处汇成首领 ─────────────
const ROW_TYPES = ['fight', 'event', 'elite', 'camp', 'market'];
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
const LAND_DEF = [   // [id, 名, 境界, 主道, 一句介绍, 首领强度微调 bk（攻血再乘几倍；由 TUNE=1 node tools/trip-test.mjs 算出，让配队一般时首领每只蛊死亡率约 40%）]
  ['qingmao', '青茅山', 0, 'li', '山寨外的竹林里野蛊成群，蛊师入门的第一道坎。', 0.9],
  ['suishi', '碎石滩', 0, 'jin', '河滩上全是碎石，甲壳硬的野蛊躲在石缝里，不好啃。', 1.19],
  ['shangjia', '商家城外', 1, 'zhi', '城外的商路上常有劫道的蛊师，阵法摆得比力气重要。', 1.3],
  ['zhangze', '南疆瘴泽', 1, 'xue', '泥沼里瘴气终年不散，这里的蛊靠吸血熬人。', 1.3],
  ['caohai', '北原草海', 2, 'nu', '草比人高，牧蛊的部族一放就是一群，以多打少。', 1.06],
  ['liusha', '西漠流沙', 2, 'jin', '风一起沙就动，披甲的蛊埋在沙下等人踩上来。', 0.71],
  ['wangting', '王庭福地', 3, 'li', '北原诸部争了几百年的福地，守在这里的都是硬骨头。', 1.57],
  ['jiaodao', '东海礁岛', 3, 'xue', '潮水退了才露出来的礁岛，礁缝里的蛊受了伤反而更凶。', 1.23],
  ['maigu', '埋骨荒原', 3, 'hun', '大战之后没人收的战场，倒下的蛊在这里不肯散。', 2.26],
  ['langya', '琅琊福地', 4, 'nu', '云上的福地，满山的毛民听一个声音调遣。', 1.52],
  ['yitian', '义天山', 4, 'hun', '正魔两道在山上打了一场大仗，山里至今魂火不灭。', 1.05],
  ['baohuang', '宝黄天', 5, 'jin', '天下蛊师做买卖的地方，守库的蛊一身金甲。', 0.63],
  ['tianting', '天庭', 5, 'zhi', '中洲之上的天庭，一步一阵，算无遗策。', 2.75],
];
export const LANDS = LAND_DEF.map(([id, n, realm, dao, d, bk = 1]) => ({ id, n, realm, quota: QUOTA[realm], cap: rankCapOf(QUOTA[realm]), dao, d, bk }));
export const LAND = Object.fromEntries(LANDS.map(l => [l.id, l]));
export const landsOf = realm => LANDS.filter(l => l.realm === realm);
const landOf = x => (x && typeof x === 'object' ? x : LAND[x] || landsOf(Math.max(0, Math.min(5, x | 0)))[0] || LANDS[0]);
export const teamQuota = team => team.reduce((a, g) => a + (g.rank || baseRank(g.sp)), 0);   // 这队占多少额度

// ───────────── 敌阵：只按额度生成（纯函数，斗幽灵和战帖分场也用）─────────────
// foeByBudget(rng, budget, { dao, kind: 'room'|'elite'|'boss'|'ghost', depth, maxRank, mul }) → [{ uid, sp, rank, atk, hp, pos, boss? }]（mul = 攻血再乘几倍，默认 1）
// 用掉的额度：room = 额度 × (前 3 层 0.6，之后每层 +0.067，第 9 层满额)；elite / ghost = 满额；boss = 额度 × 1.2 向下取整（首领超额约 20%：7→8、10→12、14→16、18→21、22→26，凡人境 4 不超；领头攻血再 +30%）
const normalPool = r => poolFor(r).filter(id => SP[id] && !SP[id].immortal);
export function foeStat(kind, depth, cap) {   // 敌蛊攻血按转数表的几成（见 TRIP_CFG.foe.st）
  const F = TRIP_CFG.foe, b = kind === 'room' ? F.st.room[0] + F.st.room[1] * Math.max(0, depth - F.ramp) : F.st[kind] ?? 1;
  const qk = typeof F.qk === 'number' ? F.qk : F.qk[kind] ?? F.qk.room;
  return kind === 'ghost' ? b : b * Math.max(0.2, 1 - qk * (cap - 1));
}
export function foeByBudget(rng, budget, o = {}) {
  const F = TRIP_CFG.foe, kind = o.kind || 'room', cap = Math.max(1, Math.min(RANK.max, o.maxRank || rankCapOf(budget)));
  const frac = kind === 'boss' ? F.boss : kind === 'elite' ? F.elite : kind === 'ghost' ? F.ghost : Math.min(1, F.frac[0] + F.frac[1] * Math.max(0, (o.depth || 0) - F.ramp));
  let left = Math.max(1, (kind === 'boss' ? Math.floor : Math.round)(budget * frac + 1e-9)); const ranks = [];   // 首领向下取整：4 点的凡人境不超，22 点超到 26
  while (left > 0 && ranks.length < F.maxN) {   // 多用接近上限的转数，偶尔低一两转，最后的零头用小转数补满
    const hi = Math.min(cap, left), r = hi > 1 && rng() < 0.3 ? hi - 1 - (hi > 2 && rng() < 0.3 ? 1 : 0) : hi;
    ranks.push(r); left -= r;
  }
  const all = NORMAL_SPECIES.map(s => s.id), up = foeStat(kind, o.depth || 0, cap) * (o.mul || 1);
  const team = ranks.sort((a, b) => b - a).map((r, i) => {
    const ok = all.filter(id => baseRank(id) <= r), main = o.dao ? ok.filter(id => daoOf(id) === o.dao) : [];
    const sp = rng.pick(main.length && (rng() < F.daoP || (kind === 'boss' && i === 0)) ? main : ok.length ? ok : all), st = statFor(sp, r);
    return { uid: 'f' + i, sp, rank: r, atk: Math.max(1, Math.round(st.atk * up)), hp: Math.max(1, Math.round(st.hp * up)), food: null, xing: null };
  });
  if (kind === 'boss' && team[0]) { const b = team[0]; b.atk = Math.round(b.atk * (1 + F.lead)); b.hp = Math.round(b.hp * (1 + F.lead)); b.boss = 1; }
  return autoPlace(arrangeTeam(team));
}
// 首领：每个秘境一伙固定的（同一秘境永远同一伙），领头尽量是主道的蛊
export function landBoss(land) {
  const L = landOf(land), team = foeByBudget(makeRng('boss:v4:' + L.id), L.quota, { dao: L.dao, kind: 'boss', maxRank: L.cap, mul: L.bk });
  return team;
}
LANDS.forEach(l => { l.boss = landBoss(l).map(g => ({ sp: g.sp, rank: g.rank, pos: g.pos ? { ...g.pos } : null, boss: g.boss || 0 })); });
// 房间里的敌阵（同一种子、同一层、同一条路永远是同一伙）
export function foeTeam(seed, land, d, lane, type) {
  const L = landOf(land); if (type === 'boss') return landBoss(L);
  return foeByBudget(makeRng(`trip:${seed}:foe:${d}:${lane}`), L.quota, { dao: L.dao, kind: type === 'elite' ? 'elite' : 'room', depth: d, maxRank: L.cap });
}
export const foeFor = (seed, quota, opts = {}) => foeByBudget(makeRng('foe:' + seed), quota, opts);   // 给洞府（斗幽灵、战帖分场）

// ───────────── 战利品：新蛊（物种 + 转数，回洞府时变成蛊）和食物 id ─────────────
const foodPoolOf = t => (t && t.foodPool && t.foodPool.length ? t.foodPool : FOODS.filter(f => f.trip !== 'stone').map(f => f.id));   // 元石已删，寻宝图不再掉
const foodName = id => (FOODS.find(f => f.id === id) || { n: id }).n;
function foodPick(rng, pool, d) {   // 越深越偏向贵的（稀有）
  const w = pool.map(id => Math.pow((FOODS.find(f => f.id === id) || { cost: 3 }).cost || 3, d / 4)), tot = w.reduce((a, b) => a + b, 0); let r = rng() * tot;
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r < 0) return pool[i]; } return pool[pool.length - 1];
}
export function lootGu(rng, realm, d, bump = 0) {
  const L = TRIP_CFG.loot, cap = Math.min(RANK.max, (realm | 0) + 1), rare = d >= L.rare && rng() < 0.5;
  const pool = normalPool(Math.min(5, (realm | 0) + (rare ? 1 : 0))).filter(id => baseRank(id) <= cap), sp = rng.pick(pool.length ? pool : normalPool(0));
  const r = Math.min(cap, Math.max(baseRank(sp), baseRank(sp) + bump + (rng() < L.up[0] + L.up[1] * d ? 1 : 0)));   // 不超过这个境界能驱使的转数
  return { sp, rank: r };
}
export function roomLoot(seed, realm, d, lane, type, foodPool) {
  const L = TRIP_CFG.loot[type], out = { foods: [], gu: [] }; if (!L) return out;
  const rng = makeRng(`trip:${seed}:loot:${d}:${lane}`), pool = foodPoolOf({ foodPool });
  const roll = ([p, per]) => { const q = p + per * d; let n = Math.floor(q); if (rng() < q - n) n++; return n; };
  for (let i = roll(L.food); i > 0; i--) out.foods.push(foodPick(rng, pool, d));
  for (let i = roll(L.gu); i > 0; i--) out.gu.push(lootGu(rng, realm, d, type === 'boss' ? 1 : 0));
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
    o: [{ t: '分他一些元气', fx: { pay: 30, gu: 1, bump: 1 } }, { t: '问他前面的路', fx: { shortcut: 0.7 } }] },
];
export const EVENT = Object.fromEntries(EVENTS.map(e => [e.id, e]));
export function pickEvent(seed, d, lane, seen = []) {
  const rng = makeRng(`trip:${seed}:ev:${d}:${lane}`), pool = EVENTS.filter(e => !seen.includes(e.id));
  return rng.pick(pool.length ? pool : EVENTS).id;
}
// 一个选项写成人话：结果是什么、放到哪
export const evPay = (t, fx, unit) => fx && fx.pay ? Math.round(fx.pay * unit * (1 + (t ? t.realm : 0) * TRIP_CFG.pay.realm)) : 0;
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
// { v, seed, land, realm, quota, d, lane, pick, prog, order, hp, mx, dead, fallen, loot, log, room, end, kills, seen, short, foodPool, pre }
//   d 当前第几层（0 起）；lane 上一层走的路（第一层前为 null）；pick 这一层选好的路；prog 这个房间已走的元气
//   room 走到后待处理的房间 { type, d, lane, foe?, ev?, wares?, done? }；end 结束结果；short 下一个房间路程倍数（断崖窄道）
// purse：放元气的对象（界面传 S，用 S.bank），选路时先从里面花；等待时进账的 token 也存回去
export function tripStart(seed, land, team, opts = {}) {   // land = 秘境 id（也认境界数字，取那个境界的第一个秘境）
  const L = landOf(land), fielded = team.slice(0, SLOTS);
  const t = { v: 2, seed: String(seed), land: L.id, realm: L.realm, quota: L.quota, d: 0, lane: null, pick: null, prog: 0, order: fielded.map(g => g.uid), hp: {}, mx: {}, dead: [], fallen: [],
    loot: { foods: [], gu: [] }, log: [], room: null, end: null, kills: {}, seen: [], rooms: 0, short: 1, foodPool: (opts.foods || []).slice(),
    pre: Math.min(1, (opts.trip || []).reduce((a, id) => { const f = FOODS.find(x => x.id === id); return a + (f && f.kind === 'trip' && f.trip === 'heal' ? (f.pct || 0) / 100 : 0); }, 0)) };   // pre = 出征食物（回春茶）：每场开打前全队回的比例
  fielded.forEach(g => { t.hp[g.uid] = g.hp; t.mx[g.uid] = g.hp; t.kills[g.uid] = 0; });
  tlog(t, `出征${L.n}：${fielded.map(g => SP[g.sp] ? SP[g.sp].n : g.sp).join('、')}。共 ${TRIP_CFG.depth} 层，最深处是首领。`);
  return t;
}
const tlog = (t, s) => { t.log.push(s); if (t.log.length > 60) t.log.splice(0, t.log.length - 60); };
const MAPC = new Map();   // 地图由种子现算，不进存档
export function tripMapOf(t) { const k = t.seed + '|' + t.realm; if (!MAPC.has(k)) { if (MAPC.size > 8) MAPC.clear(); MAPC.set(k, tripMap(t.seed, t.realm)); } return MAPC.get(k); }
export const tripAlive = t => t.order.filter(u => !t.dead.includes(u));
// 这一层能选哪几条路
export function tripReach(t) {
  const map = tripMapOf(t); if (t.end || t.room || t.d >= map.length) return [];
  if (map[t.d].boss) return [1];
  return t.d === 0 || t.lane == null ? [0, 1, 2] : nextLanes(map, t.d - 1, t.lane);
}
export const roomAt = (t, d, lane) => { const row = tripMapOf(t)[d]; return row ? row.rooms.find(r => r.lane === lane) || null : null; };
export const curRoom = t => t.pick != null ? roomAt(t, t.d, t.pick) : null;
export const needTok = (t, unit) => { const r = curRoom(t); return r ? r.cost * unit * (t.short || 1) : 0; };
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
  t.room = room; t.rooms++; t.short = 1; t.prog = 0;
  tlog(t, `第 ${t.d + 1} 层 · ${ROOMS[r.type].n}`);
}
export const roomFoe = t => t.room && t.room.foe ? foeTeam(t.seed, t.land || t.realm, t.room.d, t.room.lane, t.room.type) : null;
export const tripLand = t => landOf(t.land || t.realm);
function leave(t) {   // 房间处理完：进下一层（首领打完就结束）
  t.lane = t.pick; t.pick = null; t.prog = 0; t.room = null; t.d++;
  if (t.d >= tripMapOf(t).length) tripEnd(t, 'clear');
}
// 出战阵容：出征时的站位，去掉倒下的；每只带 hpNow（上一场剩的血）
export function fieldTeam(t, team) {
  const by = Object.fromEntries(team.map(g => [g.uid, g]));
  return tripAlive(t).filter(u => by[u]).map(u => ({ ...by[u], hpNow: t.hp[u] }));
}
// 引擎还没给 hpEnd 时：从最后一帧快照读我方剩血（我方出场蛊按顺序登记为 a0, a1 …）
export function hpFromLog(res, n) {
  const last = res.log && res.log[res.log.length - 1], s = last && last.s ? last.s[0] : [], hp = new Array(n).fill(0);
  s.forEach(([uid, , h]) => { const i = /^a(\d+)$/.test(uid) ? +uid.slice(1) : -1; if (i >= 0 && i < n) hp[i] = Math.max(0, h | 0); });
  return hp;
}
// 战斗结果落地：res = battle() 的返回（或 api.playBattle 给的 res），fielded = 开打时的 fieldTeam(t, team)。
// 返回 { win, dead:[uid], loot, offers:[{uid, xing, old, auto}] }；全灭时直接结束
export function tripFight(t, team, fielded, res) {
  const room = t.room; if (!room || !room.foe || room.done) return null;
  const win = res.winner === 'A', dead = [], offers = [], by = Object.fromEntries(team.map(g => [g.uid, g]));
  const hpEnd = res.hpEnd || res.hpA || hpFromLog(res, fielded.length), stat = res.statA || [];
  fielded.forEach((g, i) => {
    const hp = Math.max(0, Math.round(hpEnd[i] || 0)), st = stat[i] || null, real = by[g.uid];
    if (st) t.kills[g.uid] = (t.kills[g.uid] || 0) + (st.kills | 0);
    if (hp <= 0) { dead.push(g.uid); t.dead.push(g.uid); t.hp[g.uid] = 0;
      t.fallen.push({ uid: g.uid, sp: g.sp, rank: g.rank, d: room.d, type: room.type, kills: t.kills[g.uid] || 0, xing: real ? real.xing || null : null }); return; }
    t.hp[g.uid] = Math.min(t.mx[g.uid], hp);
    const k = real ? xingEarned(st, win, real.xing) : null;
    if (k) { if (!real.xing) { real.xing = k; offers.push({ uid: g.uid, xing: k, old: null, auto: true }); } else offers.push({ uid: g.uid, xing: k, old: real.xing }); }
  });
  room.done = true;
  const name = id => (SP[(by[id] || {}).sp] || {}).n || '';
  let loot = null;
  if (win) { loot = roomLoot(t.seed, t.realm, room.d, room.lane, room.type, t.foodPool); addLoot(t.loot, loot); }
  tlog(t, `${win ? '胜' : res.winner === 'draw' ? '僵持不下，各自退开' : '败'}${dead.length ? '。永久倒下：' + dead.map(name).join('、') : ''}${loot && !lootEmpty(loot) ? '。' + lootText(loot) : ''}`);
  offers.filter(o => o.auto).forEach(o => tlog(t, `${name(o.uid)} 得蛊性「${XING[o.xing].n}」`));
  if (!tripAlive(t).length) { tripEnd(t, 'wipe'); return { win, dead, loot, offers: [], wiped: true }; }
  if (room.type === 'boss') { if (win) { leave(t); return { win, dead, loot, offers, cleared: true }; } tripEnd(t, 'retreat'); return { win, dead, loot, offers, fled: true }; }   // 首领平手：退回洞府
  leave(t);
  return { win, dead, loot, offers };
}
// 出征食物：每场开打前全队回 t.pre 比例的血。返回回了多少
export function tripPreFight(t) {
  if (!t || !t.pre) return 0; let sum = 0;
  tripAlive(t).forEach(u => { const v = Math.min(t.mx[u] - t.hp[u], Math.max(1, Math.round(t.mx[u] * t.pre))); t.hp[u] += v; sum += v; });
  return sum;
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
  for (let k = 0; k < (fx.gu || 0); k++) { const g = lootGu(rng, t.realm, room.d, fx.bump || 0); t.loot.gu.push(g); lines.push(`新蛊：${guName(g)}`); }
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
  let sum = 0; tripAlive(t).forEach(u => { const v = Math.min(t.mx[u] - t.hp[u], Math.round(t.mx[u] * TRIP_CFG.camp)); t.hp[u] += v; sum += v; });
  room.done = true; tlog(t, `篝火边歇了一阵，全队共回 ${sum} 血`); leave(t); return { healed: sum };
}
// 坊市：三样货，花元气（先花攒着的）
function marketWares(t, r) {
  const M = TRIP_CFG.market, rng = makeRng(`trip:${t.seed}:mk:${t.d}:${r.lane}`), m = 1 + t.realm * M.realm;
  return [{ k: 'heal', p: M.heal, price: Math.round(M.price.heal * m) }, { k: 'food', id: foodPick(rng, foodPoolOf(t), t.d), price: Math.round(M.price.food * m) }, { k: 'gu', g: lootGu(rng, t.realm, t.d), price: Math.round(M.price.gu * m) }];
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
// 结束：retreat 撤退（带回全部）/ wipe 全灭（战利品全丢）/ clear 渡劫成功（带回全部，含首领战利品）
export function tripEnd(t, why) {
  if (t.end) return t.end;
  const wiped = why === 'wipe', copy = l => ({ foods: l.foods.slice(), gu: l.gu.map(g => ({ ...g })) });
  t.end = { why, dead: t.dead.slice(), survivors: tripAlive(t), loot: wiped ? { foods: [], gu: [] } : copy(t.loot), lost: wiped ? copy(t.loot) : null, cleared: why === 'clear', wiped, depth: t.d, fallen: t.fallen.slice() };
  t.room = null; t.pick = null; t.prog = 0;
  tlog(t, wiped ? '全灭。这一趟的战利品全部丢在了秘境里。' : why === 'clear' ? '渡劫成功，带着战利品回洞府。' : '撤退，带着战利品回洞府。');
  return t.end;
}
// 给 api.onTripEnd 的结果（hooks.js）：新蛊写成 { sp, rank }，洞府放进蛊囊；规则第二版没有元石
export const tripResult = t => t.end ? { dead: t.end.dead, survivors: t.end.survivors, loot: { foods: t.end.loot.foods.slice(), gu: t.end.loot.gu.map(g => ({ sp: g.sp, rank: g.rank })) }, cleared: t.end.cleared, wiped: t.end.wiped } : null;
export function epitaph(f) {   // 告别词：倒在哪、这一趟斩敌几只、带着什么蛊性
  return `倒在第 ${f.d + 1} 层的${ROOMS[f.type] ? ROOMS[f.type].n : ''}${f.kills ? `，这一趟斩敌 ${f.kills} 只` : ''}${f.xing && XING[f.xing] ? `，带着「${XING[f.xing].n}」走了` : ''}。`;
}
export const toBoss = t => Math.max(0, TRIP_CFG.depth - 1 - t.d);
export const tripSeed = (base, n) => (hashStr(String(base) + ':trip:' + n) >>> 0).toString(36);
