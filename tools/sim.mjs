// node tools/sim.mjs —— v2 平衡与正确性自检（口径见 docs/design.md 第 0、8 节；战斗规格 docs/battle-spec.md）。任何一项不过就退出码 1。
// 对局一律双方在同一额度下组队（4、9、15、22 点四档，敌阵生成用秘境的 foeByBudget，和斗幽灵同口径）。
// 查：战斗跑得完且可复现、坐标码往返、站位差、单种蛊/杀招/道胜率上限、前 10 阵容的道数、本命技区分度、速度、主动技区分度、
//     同额度下「一只高转带几只低转」对「几只中转」两种思路都有赢面、合成与蛊市。
import { makeRng, encodeTeam, decodeTeam, newGu, placeGu, rollShop, statFor, SP, poolFor, COMBOS, daoOf, baseRank, autoPlace, arrangeTeam, NORMAL_SPECIES } from '../src/core.js';
import { DAOS } from '../src/daos.js';
import * as CORE from '../src/core.js';
import { battle as battle0, synergyOf, battleProfile, TUNE } from '../src/battle.js';
// 数值放大十倍（design 2.8）：core.statFor 还没乘 STAT_SCALE 时，模拟这里先把攻血乘 10，和引擎里放大后的固定数对上
const SK = CORE.STAT_SCALE ? 1 : 10, up = T => SK === 1 || !Array.isArray(T) ? T : T.map(g => g && ({ ...g, atk: g.atk * SK, hp: g.hp * SK, ...(g.hpNow != null ? { hpNow: g.hpNow * SK } : {}) }));
const battle = (A, B, s, o) => battle0(up(A), up(B), s, o);
if (process.env.GU_TUNE) Object.assign(TUNE, JSON.parse(process.env.GU_TUNE));   // 调参用：GU_TUNE='{"burn":0.6}' node tools/sim.mjs
import { foeByBudget, rankCapOf, TRIP_CFG } from '../src/trip.js';

const fails = [], t0 = Date.now(), Q = process.argv.includes('--quick') ? 0.4 : 1;
const BUD = [4, 9, 15, 22], MAXN = (TRIP_CFG && TRIP_CFG.foe && TRIP_CFG.foe.maxN) || 7;
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const pc = x => Math.round(x * 100);
const sc = (A, B, seed, o) => { const w = battle(A, B, seed, { lite: true, ...o }).winner; return w === 'A' ? 1 : w === 'draw' ? 0.5 : 0; };
const clone = t => t.map(g => ({ ...g, pos: g.pos ? { ...g.pos } : undefined }));
const team = (r, b, o = {}) => foeByBudget(r, b, { kind: 'ghost', frac: 1, ...o });   // 用满额度的一队
// 胜率：A 对一组敌阵，每个敌阵打两颗种子
const rateVs = (A, foes, tag, o) => { let w = 0; foes.forEach((f, j) => { w += sc(A, f, tag + ':' + j, o) + sc(A, f, tag + ':' + j + 'b', o); }); return w / (2 * foes.length); };
const foesOf = (tag, b, k = 30) => Array.from({ length: Math.round(k * Q) || 8 }, (_, j) => team(makeRng(tag + j), b));
const POOL = NORMAL_SPECIES.map(s => s.id).filter(sp => baseRank(sp) <= 3);
const quota = T => T.reduce((a, g) => a + (g.rank || 1), 0);
// 按给定转数组队（随机蛊种，攻血按转数表），摆法同秘境
const byRanks = (r, ranks) => autoPlace(arrangeTeam(ranks.map((rk, i) => { const ok = NORMAL_SPECIES.filter(s => baseRank(s.id) <= rk).map(s => s.id), sp = r.pick(ok), st = statFor(sp, rk); return { uid: 'h' + i, sp, rank: rk, atk: st.atk, hp: st.hp, food: null, xing: null }; })));

// 1. 跑得完、可复现、轮数不过长、坐标码往返
let maxR = 0, nondet = 0, codeFail = 0, draws = 0; const rounds = [];
for (let i = 0; i < 400; i++) {
  const r = makeRng('m' + i), b = BUD[i % 4], a = team(r, b), c = team(r, b);
  const x = battle(a, c, 's' + i), y = battle(a, c, 's' + i); maxR = Math.max(maxR, x.rounds); rounds.push(x.rounds); if (x.winner === 'draw') draws++;
  if (x.winner !== y.winner || x.log.length !== y.log.length || JSON.stringify(x.hpA) !== JSON.stringify(y.hpA)) nondet++;
  const d = decodeTeam(encodeTeam(a, { name: '测', realm: i % 6, trial: i % 2 === 0 }));
  if (!d || d.trial !== (i % 2 === 0) || JSON.stringify(d.team.map(g => [g.sp, g.rank, g.atk, g.hp])) !== JSON.stringify(a.map(g => [g.sp, g.rank, g.atk, g.hp]))) codeFail++;
}
console.log(`战斗：轮数 中位 ${med(rounds)} / 最长 ${maxR}；平局 ${draws}/400；不可复现 ${nondet}；坐标码往返失败 ${codeFail}`);
if (nondet) fails.push('同种子不复现 ' + nondet); if (codeFail) fails.push('坐标码往返失败 ' + codeFail); if (draws > 40) fails.push('平局过多');
{ // SOTA：同种子同参数可复现；伤害确实多 1%
  const r = makeRng('sota'), a = team(r, 15), b = team(r, 15);
  const x = battle(a, b, 'so', { sota: [true, false] }), y = battle(a, b, 'so', { sota: { A: true, B: false } }), z = battle(a, b, 'so', {});
  const dmg = res => Object.values(res.units).filter(u => u.side === 0).reduce((s, u) => s + u.dmg, 0);
  const ok = JSON.stringify(x.log.map(e => e.t + (e.n || ''))) === JSON.stringify(y.log.map(e => e.t + (e.n || ''))) && x.sota[0] && !z.sota[0] && dmg(x) >= dmg(z) * 0.97;
  console.log('SOTA 复现与 +1%：' + (ok ? 'OK' : '失败')); if (!ok) fails.push('SOTA 不对');
}
{ // 血量延续：带 hpNow 进场，hpA 不超过满血，倒下为 0
  const r = makeRng('hp'), a = team(r, 9).map(g => ({ ...g, hpNow: Math.max(1, g.hp >> 1) })), b = team(r, 9);
  const x = battle(a, b, 'hp'); const ok = x.hpA.length === a.length && x.hpA.every((h, i) => h >= 0 && h <= a[i].hp) && x.statA.every(s => s && s.mx > 0);
  console.log('血量延续 hpNow → hpA / statA：' + (ok ? 'OK' : '失败')); if (!ok) fails.push('血量延续不对');
}

// 2. 站位：同一套蛊换摆法（9 格里随机摆 40 种 + 规则摆法），最佳与最差的胜率差
const spread = [];
for (let k = 0; k < 16; k++) {
  const b = BUD[k % 4], r = makeRng('f' + k), T = team(r, b), foes = foesOf('fo' + k + ':', b, 24), rates = [rateVs(T, foes, 'p' + k)];
  for (let t = 0; t < Math.round(40 * Q); t++) {
    const cells = Array.from({ length: 9 }, (_, i) => i); for (let i = 8; i > 0; i--) { const j = r.int(i + 1); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    const p = clone(T); p.forEach((g, i) => { g.pos = { r: Math.floor(cells[i] / 3), c: cells[i] % 3 }; });
    rates.push(rateVs(p, foes, 'p' + k));
  }
  spread.push(Math.max(...rates) - Math.min(...rates));
}
console.log(`站位：最佳−最差胜率差 中位 ${pc(med(spread))} 个百分点（${spread.map(pc).join(' ')}）`);
if (med(spread) < 0.15) fails.push('站位差中位不足 15 个百分点');

// 3. 单种蛊：在能上它的额度里，两边同一支队伍（镜像），A 队把一只同转数的蛊换成它、B 队同位置换成同基础转数的随机一种；没有哪种超过 60%
const ALL = NORMAL_SPECIES.map(s => s.id), wr = {};
ALL.forEach(sp => {
  let w = 0, N = 0; const br = baseRank(sp), peers = ALL.filter(x => baseRank(x) === br && x !== sp), buds = BUD.filter(b => rankCapOf(b) >= br);
  for (let i = 0; i < Math.round(100 * Q) && buds.length; i++) {   // 配对对打 100 局 × 两边各站一次
    const r = makeRng('sp' + sp + i), b = buds[i % buds.length], A = team(r, b), B = clone(A), k = A.findIndex(g => g.rank >= br); if (k < 0 || !peers.length) continue;
    const rk = A[k].rank; Object.assign(A[k], newGu(sp, rk), { pos: A[k].pos }); Object.assign(B[k], newGu(r.pick(peers), rk), { pos: B[k].pos });
    w += (sc(A, B, 'q' + i) + 1 - sc(B, A, 'q' + i + 'r')) / 2; N++;   // 两边各站一次，抵掉先后手
  }
  if (N) wr[sp] = w / N;
});
const top = Object.entries(wr).sort((p, q) => q[1] - p[1]);
console.log('单种蛊胜率 前 5：' + top.slice(0, 5).map(([sp, p]) => `${SP[sp].n} ${pc(p)}%`).join('  ') + '；后 3：' + top.slice(-3).map(([sp, p]) => `${SP[sp].n} ${pc(p)}%`).join('  '));
const over = top.filter(([, p]) => p > 0.6); if (over.length) fails.push('单种蛊胜率超过 60%：' + over.map(([sp]) => SP[sp].n).join('、'));

// 4. 杀招：15 点额度的队伍里把前几只换成杀招配方（转数不低于基础转数），对另一个杀招同样做法，不超过 60%；道：4 只同道对 4 只别道
// 换进指定的蛊（转数不低于基础转数），再把其余的蛊升降转，让整队转数总和回到额度 b（两边同口径，不白占额度）
const restat = g => { const st = statFor(g.sp, g.rank); g.atk = st.atk; g.hp = st.hp; };
const withSp = (r, sps, b, base) => {
  const T = base ? clone(base) : team(r, b); sps.forEach((sp, i) => { if (T[i]) Object.assign(T[i], newGu(sp, Math.max(baseRank(sp), T[i].rank)), { pos: T[i].pos }); });
  const free = T.slice(sps.length), cap = rankCapOf(b);
  for (let guard = 0; guard < 60 && quota(T) !== b; guard++) {
    const down = quota(T) > b, c = free.filter(g => down ? g.rank > baseRank(g.sp) : g.rank < cap); if (!c.length) break;
    const g = r.pick(c); g.rank += down ? -1 : 1; restat(g);
  }
  return T;
};
const usable = COMBOS.filter(c => c.need.every(sp => SP[sp] && !SP[sp].immortal));
const cwr = usable.map(c => {
  let w = 0; const N = Math.round(80 * Q);
  for (let i = 0; i < N; i++) {
    const okB = [15, 22].filter(x => c.need.every(sp => baseRank(sp) <= rankCapOf(x))), b = okB.length ? okB[i % okB.length] : 22;   // 成员按额度的转数上限，上不了场的额度不测
    const r = makeRng('cb' + c.id + i), oL = usable.filter(x => x !== c && x.need.every(sp => baseRank(sp) <= rankCapOf(b))), o = oL.length ? oL[r.int(oL.length)] : c, ob = o.need.slice(0, c.need.length);
    while (ob.length < c.need.length) ob.push(r.pick(POOL));
    const T = team(r, b), A = withSp(r, c.need, b, T), B = withSp(r, ob, b, T);   // 同一支底队，只换杀招配方那几只（配对比较，噪声小）
    w += (sc(A, B, 'c' + i) + 1 - sc(B, A, 'c' + i + 'r')) / 2;
  }
  return [c.n, w / N];
}).sort((p, q) => q[1] - p[1]);
console.log('杀招对杀招 前 5：' + cwr.slice(0, 5).map(([n, p]) => `${n} ${pc(p)}%`).join('  ') + '；最低 ' + cwr.slice(-2).map(([n, p]) => `${n} ${pc(p)}%`).join('  '));
const cover = cwr.filter(([, p]) => p > 0.6); if (cover.length) fails.push('杀招胜率超过 60%：' + cover.map(x => x[0]).join('、'));
const daoIds = DAOS.map(d => d.id).filter(d => POOL.filter(sp => daoOf(sp) === d).length >= 2);
const dwr = daoIds.map(d => {
  let w = 0; const N = Math.round(60 * Q), mine = POOL.filter(sp => daoOf(sp) === d);
  for (let i = 0; i < N; i++) { const r = makeRng('dao' + d + i), od = daoIds[(daoIds.indexOf(d) + 1 + r.int(daoIds.length - 1)) % daoIds.length], th = POOL.filter(sp => daoOf(sp) === od), b = i % 2 ? 22 : 15, T = team(r, b), A = withSp(r, [0, 1, 2, 3].map(() => r.pick(mine)), b, T), B = withSp(r, [0, 1, 2, 3].map(() => r.pick(th)), b, T); w += (sc(A, B, 'd' + i) + 1 - sc(B, A, 'd' + i + 'r')) / 2; }
  return [(DAOS.find(x => x.id === d) || {}).n || d, w / N];
}).sort((p, q) => q[1] - p[1]);
console.log('道（4 只同道）胜率：' + dwr.map(([n, p]) => `${n} ${pc(p)}%`).join('  '));
const dover = dwr.filter(([, p]) => p > 0.6); if (dover.length) fails.push('道胜率超过 60%：' + dover.map(x => x[0]).join('、'));

// 5. 胜率前 10 的阵容里至少有 5 种不同的主道（15 点额度）
{
  const cand = Array.from({ length: Math.round(60 * Q) + 10 }, (_, i) => team(makeRng('top' + i), 15)), foes = foesOf('topf', 15, 20);
  const ranked = cand.map((T, i) => [T, rateVs(T, foes, 't' + i)]).sort((p, q) => q[1] - p[1]).slice(0, 10);
  const mainDao = T => { const c = {}; T.forEach(g => { const d = daoOf(g.sp); c[d] = (c[d] || 0) + 1; }); return Object.entries(c).sort((p, q) => q[1] - p[1])[0][0]; };
  const ds = new Set(ranked.map(([T]) => mainDao(T)));
  console.log(`胜率前 10 阵容的主道：${ds.size} 种（${[...ds].join('、')}）；前 10 胜率 ${ranked.map(x => pc(x[1])).join(' ')}`);
  if (ds.size < 5) fails.push('前 10 阵容主道不足 5 种');
}

// 6. 本命技区分度：把一只换成同攻血的另一种蛊，胜率平均变化 ≥8 个百分点
{
  const d = [];
  for (let k = 0; k < Math.round(24 * Q); k++) {
    const b = [9, 15][k % 2], r = makeRng('sw' + k), T = team(r, b), foes = foesOf('swf' + k, b, 16), base = rateVs(T, foes, 'w' + k);
    for (let t = 0; t < 2; t++) { const i = r.int(T.length), U = clone(T), sp = r.pick(ALL.filter(x => x !== T[i].sp && baseRank(x) <= T[i].rank)); U[i] = { ...U[i], sp }; d.push(Math.abs(rateVs(U, foes, 'w' + k) - base)); }
  }
  const avg = d.reduce((a, b) => a + b, 0) / d.length;
  console.log(`换成同攻血的另一种蛊：胜率平均变化 ${pc(avg)} 个百分点`); if (avg < 0.08) fails.push('本命技区分度不足 8 个百分点');
}

// 7. 速度：同攻血的镜像阵容，一方全体速 +20%，胜率明显更高但不超过 65%
{
  let w = 0, N = 0;
  for (let i = 0; i < Math.round(300 * Q); i++) {
    const r = makeRng('spd' + i), T = team(r, BUD[i % 4]), F = clone(T).map(g => ({ ...g, spd: Math.round(battleProfile(g.sp).spd * 1.2) }));
    w += sc(F, T, 'v' + i) + (1 - sc(T, F, 'v' + i)); N += 2;
  }
  const p = w / N; console.log(`速度：镜像阵容速 +20% 的一方胜率 ${pc(p)}%（要求 55%–65%）`);
  if (p < 0.55 || p > 0.65) fails.push(`速度影响不在 55%–65%（${pc(p)}%）`);
}

// 8. 主动技区分度：有主动技的蛊换成别的主动技 / 去掉主动技，胜率平均变化
{
  const acts = ALL.filter(sp => battleProfile(sp).act), d = [], off = [];
  for (let k = 0; k < Math.round(24 * Q); k++) {
    const b = [9, 15][k % 2], r = makeRng('ac' + k), T = team(r, b), i = r.int(T.length), sp = r.pick(acts.filter(x => baseRank(x) <= T[i].rank).concat(acts.slice(0, 1)));
    Object.assign(T[i], newGu(sp, Math.max(T[i].rank, baseRank(sp))), { pos: T[i].pos });
    const foes = foesOf('acf' + k, b, 16), base = rateVs(T, foes, 'a' + k);
    const U = clone(T); U[i] = { ...U[i], noAct: true }; off.push(base - rateVs(U, foes, 'a' + k));
    const keep = SP[sp].act, other = r.pick(acts.filter(x => x !== sp)); SP[sp].act = SP[other].act; d.push(Math.abs(rateVs(T, foes, 'a' + k) - base)); SP[sp].act = keep;
  }
  const a1 = d.reduce((a, b) => a + b, 0) / d.length, a2 = off.reduce((a, b) => a + b, 0) / off.length;
  console.log(`主动技：换成另一种主动技胜率平均变化 ${pc(a1)} 个百分点；去掉主动技平均掉 ${pc(a2)} 个百分点`);
  if (a1 < 0.05) fails.push('主动技区分度不足 5 个百分点'); if (a2 < 0.03) fails.push('主动技几乎没有作用');
}

// 9. 同额度两种思路：「一只到顶的高转 + 其余低转」对「全是中转」，任何一种胜率不超过 60%
{
  const plans = b => {
    const cap = rankCapOf(b); if (cap < 3) return null;
    const hi = [cap]; let left = b - cap; for (let n = MAXN - 1; n > 0 && left > 0; n--) { const v = Math.max(1, Math.ceil(left / n)); hi.push(v); left -= v; }
    const m = cap - 1, mid = []; left = b; while (left > 0 && mid.length < MAXN) { const v = Math.min(m, left); mid.push(v); left -= v; }
    return [hi, mid];
  };
  const out = [];
  for (const b of [15, 22]) {
    const P = plans(b); if (!P) continue; let w = 0, N = 0;
    for (let i = 0; i < Math.round(160 * Q); i++) { const r = makeRng('hm' + b + ':' + i), H = byRanks(r, P[0]), M = byRanks(r, P[1]); w += sc(H, M, 'h' + i) + (1 - sc(M, H, 'h' + i)); N += 2; }
    out.push([b, P, w / N]);
  }
  console.log('同额度两种思路（高转带低转 对 全中转）：' + out.map(([b, P, p]) => `${b} 点 [${P[0].join(',')}] 对 [${P[1].join(',')}] 高转方 ${pc(p)}%`).join('；'));
  const bad = out.filter(([, , p]) => p > 0.6 || p < 0.4); if (bad.length) fails.push('同额度两种思路有一边超过 60%：' + bad.map(([b, , p]) => `${b} 点 高转方 ${pc(p)}%`).join('、'));
}
// 9b. 同额度多种分配的循环赛：每种分配对其余各种的平均胜率，任何一种不超过 65%（转数越集中越占便宜的问题在这里看）
{
  const RR = { 9: [[2, 2, 2, 2, 1], [2, 2, 2, 1, 1, 1], [2, 2, 1, 1, 1, 1, 1]], 15: [[4, 4, 4, 3], [4, 3, 3, 3, 2], [3, 3, 3, 3, 3], [4, 2, 2, 2, 2, 2, 1], [3, 2, 2, 2, 2, 2, 2]], 22: [[5, 5, 5, 5, 2], [5, 5, 4, 4, 4], [4, 4, 4, 4, 4, 2], [5, 3, 3, 3, 3, 3, 2], [4, 3, 3, 3, 3, 3, 3]] };
  const lines = [], hot = [];
  for (const [b, L] of Object.entries(RR)) {
    const w = L.map(() => 0), n = L.map(() => 0);
    for (let x = 0; x < L.length; x++) for (let y = x + 1; y < L.length; y++) for (let i = 0; i < Math.round(60 * Q); i++) {
      const r = makeRng(`rr${b}:${x}:${y}:${i}`), X = byRanks(r, L[x]), Y = byRanks(r, L[y]), p = (sc(X, Y, 'r' + i) + 1 - sc(Y, X, 'r' + i + 'b')) / 2;
      w[x] += p; w[y] += 1 - p; n[x]++; n[y]++;
    }
    const res = L.map((a, k) => [a, w[k] / n[k]]); lines.push(`${b} 点 ` + res.map(([a, p]) => `[${a.join('')}] ${pc(p)}%`).join(' '));
    res.filter(([, p]) => p > 0.65).forEach(([a, p]) => hot.push(`${b} 点 [${a.join(',')}] ${pc(p)}%`));
  }
  console.log('同额度分配循环赛：' + lines.join('；')); if (hot.length) fails.push('有分配在循环赛里超过 65%：' + hot.join('、'));
}

// 10. 合成、蛊市、羁绊
{
  const T = [newGu('boar'), newGu('boar')], bag = [], r = placeGu(T, bag, newGu('boar'), 3, 8, 'shop');
  const ok = r.where === 'merge' && T.length === 1 && T[0].rank === baseRank('boar') + 1 && T[0].atk === statFor('boar', T[0].rank).atk;
  console.log('三只合成换成新一转的表值：' + (ok ? 'OK' : '失败')); if (!ok) fails.push('合成不对');
  const sh = rollShop(makeRng(3), 0, 'li'); const ok2 = sh.some(w => w.kind === 'gu') && sh.some(w => w.kind === 'food');
  console.log('蛊市有蛊位和食物位：' + (ok2 ? 'OK' : '失败')); if (!ok2) fails.push('蛊市缺位');
  const c0 = COMBOS[0], sy = synergyOf(c0.need.map(sp => newGu(sp))); const ok3 = sy.combos.length >= 1 && sy.line.length > 0;
  console.log('杀招自动成形（synergyOf）：' + (ok3 ? 'OK ' + sy.line : '失败')); if (!ok3) fails.push('杀招不成形');
}
console.log(`用时 ${Date.now() - t0}ms`);
if (fails.length) { console.log('FAIL: ' + fails.join('；')); process.exit(1); }
console.log('PASS');
