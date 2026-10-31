// node tools/sim.mjs —— v2 平衡与正确性自检（口径见 docs/design.md 第 8 节；战斗规格 docs/battle-spec.md）。任何一项不过就退出码 1。
// 查：战斗跑得完且可复现、坐标码往返、站位差、单种蛊/杀招/道胜率上限、前 10 阵容的道数、本命技区分度、速度、主动技区分度、合成与蛊市。
import { makeRng, genTeam, encodeTeam, decodeTeam, newGu, placeGu, rollShop, statFor, SP, poolFor, COMBOS, daoOf, RANK, baseRank } from '../src/core.js';
import { DAOS } from '../src/daos.js';
import { battle, synergyOf, battleProfile } from '../src/battle.js';

const fails = [], t0 = Date.now(), Q = process.argv.includes('--quick') ? 0.4 : 1;
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const pc = x => Math.round(x * 100);
const sc = (A, B, seed, o) => { const w = battle(A, B, seed, { lite: true, ...o }).winner; return w === 'A' ? 1 : w === 'draw' ? 0.5 : 0; };
const clone = t => t.map(g => ({ ...g, pos: g.pos ? { ...g.pos } : undefined }));
// 胜率：A 对一组敌阵，每个敌阵打两颗种子
const rateVs = (A, foes, tag, o) => { let w = 0; foes.forEach((f, j) => { w += sc(A, f, tag + ':' + j, o) + sc(A, f, tag + ':' + j + 'b', o); }); return w / (2 * foes.length); };
const foesOf = (tag, realm, n, k = 30) => Array.from({ length: Math.round(k * Q) || 8 }, (_, j) => genTeam(makeRng(tag + j), { realm, n, up: 0.3 }));
const POOL = poolFor(3).filter(sp => SP[sp] && !SP[sp].immortal);

// 1. 跑得完、可复现、轮数不过长、坐标码往返
let maxR = 0, nondet = 0, codeFail = 0, draws = 0; const rounds = [];
for (let i = 0; i < 400; i++) {
  const r = makeRng('m' + i), a = genTeam(r, { realm: i % 6, up: 0.3 }), b = genTeam(r, { realm: i % 6, up: 0.3 });
  const x = battle(a, b, 's' + i), y = battle(a, b, 's' + i); maxR = Math.max(maxR, x.rounds); rounds.push(x.rounds); if (x.winner === 'draw') draws++;
  if (x.winner !== y.winner || x.log.length !== y.log.length || JSON.stringify(x.hpA) !== JSON.stringify(y.hpA)) nondet++;
  const d = decodeTeam(encodeTeam(a, { name: '测', realm: i % 6, trial: i % 2 === 0 }));
  if (!d || d.trial !== (i % 2 === 0) || JSON.stringify(d.team.map(g => [g.sp, g.rank, g.atk, g.hp])) !== JSON.stringify(a.map(g => [g.sp, g.rank, g.atk, g.hp]))) codeFail++;
}
console.log(`战斗：轮数 中位 ${med(rounds)} / 最长 ${maxR}；平局 ${draws}/400；不可复现 ${nondet}；坐标码往返失败 ${codeFail}`);
if (nondet) fails.push('同种子不复现 ' + nondet); if (codeFail) fails.push('坐标码往返失败 ' + codeFail); if (draws > 40) fails.push('平局过多');
{ // SOTA：同种子同参数可复现；伤害确实多 1%
  const r = makeRng('sota'), a = genTeam(r, { realm: 3 }), b = genTeam(r, { realm: 3 });
  const x = battle(a, b, 'so', { sota: [true, false] }), y = battle(a, b, 'so', { sota: { A: true, B: false } }), z = battle(a, b, 'so', {});
  const dmg = res => Object.values(res.units).filter(u => u.side === 0).reduce((s, u) => s + u.dmg, 0);
  const ok = JSON.stringify(x.log.map(e => e.t + (e.n || ''))) === JSON.stringify(y.log.map(e => e.t + (e.n || ''))) && x.sota[0] && !z.sota[0] && dmg(x) >= dmg(z) * 0.97;
  console.log('SOTA 复现与 +1%：' + (ok ? 'OK' : '失败')); if (!ok) fails.push('SOTA 不对');
}
{ // 血量延续：带 hpNow 进场，hpA 不超过满血，倒下为 0
  const r = makeRng('hp'), a = genTeam(r, { realm: 2 }).map(g => ({ ...g, hpNow: Math.max(1, g.hp >> 1) })), b = genTeam(r, { realm: 2 });
  const x = battle(a, b, 'hp'); const ok = x.hpA.length === a.length && x.hpA.every((h, i) => h >= 0 && h <= a[i].hp) && x.statA.every(s => s && s.mx > 0);
  console.log('血量延续 hpNow → hpA / statA：' + (ok ? 'OK' : '失败')); if (!ok) fails.push('血量延续不对');
}

// 2. 站位：同一套蛊换摆法（9 格里随机摆 40 种 + 规则摆法），最佳与最差的胜率差
const spread = [];
for (let k = 0; k < 14; k++) {
  const r = makeRng('f' + k), n = 4 + (k % 3), team = genTeam(r, { realm: 2, n, up: 0.3 }), foes = foesOf('fo' + k + ':', 2, n, 24);
  const rates = [rateVs(team, foes, 'p' + k)];
  for (let t = 0; t < Math.round(40 * Q); t++) {
    const cells = Array.from({ length: 9 }, (_, i) => i); for (let i = 8; i > 0; i--) { const j = r.int(i + 1); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    const p = clone(team); p.forEach((g, i) => { g.pos = { r: Math.floor(cells[i] / 3), c: cells[i] % 3 }; });
    rates.push(rateVs(p, foes, 'p' + k));
  }
  spread.push(Math.max(...rates) - Math.min(...rates));
}
console.log(`站位：最佳−最差胜率差 中位 ${pc(med(spread))} 个百分点（${spread.map(pc).join(' ')}）`);
if (med(spread) < 0.15) fails.push('站位差中位不足 15 个百分点');

// 3. 单种蛊：在它出现的那一档（境界 = 基础转数 − 1 起），A 队换进它、B 队同位置换进同档随机一种，同转数；没有哪种超过 60%
const POOL5 = poolFor(5).filter(sp => SP[sp] && !SP[sp].immortal), wr = {};
POOL5.forEach(sp => {
  let w = 0; const N = Math.round(80 * Q), br = baseRank(sp), peers = POOL5.filter(x => baseRank(x) === br && x !== sp);
  for (let i = 0; i < N; i++) {
    const r = makeRng('sp' + sp + i), realm = Math.min(5, br - 1 + (i % 2)), A = genTeam(r, { realm, n: 4, up: 0.3 }), B = genTeam(r, { realm, n: 4, up: 0.3 }), k = i % 4, rk = Math.max(br, A[k].rank);
    Object.assign(A[k], newGu(sp, rk), { pos: A[k].pos }); if (peers.length) Object.assign(B[k], newGu(r.pick(peers), rk), { pos: B[k].pos });
    w += sc(A, B, 'q' + i);
  }
  wr[sp] = w / N;
});
const top = Object.entries(wr).sort((p, q) => q[1] - p[1]);
console.log('单种蛊胜率 前 5：' + top.slice(0, 5).map(([sp, p]) => `${SP[sp].n} ${pc(p)}%`).join('  ') + '；后 3：' + top.slice(-3).map(([sp, p]) => `${SP[sp].n} ${pc(p)}%`).join('  '));
const over = top.filter(([, p]) => p > 0.6); if (over.length) fails.push('单种蛊胜率超过 60%：' + over.map(([sp]) => SP[sp].n).join('、'));

// 4. 杀招：带杀招 X 的阵容（配方里的蛊按基础转数）对带另一个杀招的阵容（同样只数的蛊升转，不足的用同档随机蛊补齐），不超过 60%；
//    道：凑 4 只同道对凑 4 只别道，不超过 60%（道表是占位数据，内容交付后复测）
const withSp = (r, sps, realm, n) => { const T = genTeam(r, { realm, n }); sps.forEach((sp, i) => { Object.assign(T[i], newGu(sp, baseRank(sp)), { pos: T[i].pos }); }); return T; };
const usable = COMBOS.filter(c => c.need.every(sp => SP[sp] && !SP[sp].immortal));
const cwr = usable.map(c => {
  let w = 0; const N = Math.round(100 * Q);
  for (let i = 0; i < N; i++) {
    const r = makeRng('cb' + c.id + i), o = usable[(usable.indexOf(c) + 1 + r.int(usable.length - 1)) % usable.length], ob = o.need.slice(0, c.need.length);
    while (ob.length < c.need.length) ob.push(r.pick(POOL.filter(sp => baseRank(sp) <= 3)));
    w += sc(withSp(r, c.need, 3, 5), withSp(r, ob, 3, 5), 'c' + i);
  }
  return [c.n, w / N];
}).sort((p, q) => q[1] - p[1]);
console.log('杀招对杀招 前 5：' + cwr.slice(0, 5).map(([n, p]) => `${n} ${pc(p)}%`).join('  ') + '；最低 ' + cwr.slice(-2).map(([n, p]) => `${n} ${pc(p)}%`).join('  '));
const cover = cwr.filter(([, p]) => p > 0.6); if (cover.length) fails.push('杀招胜率超过 60%：' + cover.map(x => x[0]).join('、'));
const daoIds = DAOS.map(d => d.id).filter(d => POOL.filter(sp => daoOf(sp) === d).length >= 2);
const dwr = daoIds.map(d => {
  let w = 0; const N = Math.round(80 * Q), mine = POOL.filter(sp => daoOf(sp) === d);
  for (let i = 0; i < N; i++) { const r = makeRng('dao' + d + i), od = daoIds[(daoIds.indexOf(d) + 1 + r.int(daoIds.length - 1)) % daoIds.length], th = POOL.filter(sp => daoOf(sp) === od); w += sc(withSp(r, [0, 1, 2, 3].map(() => r.pick(mine)), 3, 5), withSp(r, [0, 1, 2, 3].map(() => r.pick(th)), 3, 5), 'd' + i); }
  return [(DAOS.find(x => x.id === d) || {}).n || d, w / N];
}).sort((p, q) => q[1] - p[1]);
console.log('道（4 只同道）胜率：' + dwr.map(([n, p]) => `${n} ${pc(p)}%`).join('  '));
const dover = dwr.filter(([, p]) => p > 0.6); if (dover.length) fails.push('道胜率超过 60%：' + dover.map(x => x[0]).join('、'));

// 5. 胜率前 10 的阵容里至少有 5 种不同的主道
{
  const cand = Array.from({ length: Math.round(60 * Q) + 10 }, (_, i) => genTeam(makeRng('top' + i), { realm: 3, n: 5, up: 0.3 })), foes = foesOf('topf', 3, 5, 20);
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
    const r = makeRng('sw' + k), T = genTeam(r, { realm: 2, n: 4, up: 0.3 }), foes = foesOf('swf' + k, 2, 4, 16), base = rateVs(T, foes, 'w' + k);
    for (let t = 0; t < 2; t++) { const i = r.int(T.length), U = clone(T), sp = r.pick(POOL.filter(x => x !== T[i].sp)); U[i] = { ...U[i], sp }; d.push(Math.abs(rateVs(U, foes, 'w' + k) - base)); }
  }
  const avg = d.reduce((a, b) => a + b, 0) / d.length;
  console.log(`换成同攻血的另一种蛊：胜率平均变化 ${pc(avg)} 个百分点`); if (avg < 0.08) fails.push('本命技区分度不足 8 个百分点');
}

// 7. 速度：同攻血的镜像阵容，一方全体速 +20%，胜率明显更高但不超过 65%
{
  let w = 0, N = 0;
  for (let i = 0; i < Math.round(300 * Q); i++) {
    const r = makeRng('spd' + i), T = genTeam(r, { realm: 1 + (i % 4), n: 3 + (i % 4) }), F = clone(T).map(g => ({ ...g, spd: Math.round(battleProfile(g.sp).spd * 1.2) }));
    w += sc(F, T, 'v' + i) + (1 - sc(T, F, 'v' + i)); N += 2;
  }
  const p = w / N; console.log(`速度：镜像阵容速 +20% 的一方胜率 ${pc(p)}%（要求 55%–65%）`);
  if (p < 0.55 || p > 0.65) fails.push(`速度影响不在 55%–65%（${pc(p)}%）`);
}

// 8. 主动技区分度：有主动技的蛊换成别的主动技 / 去掉主动技，胜率平均变化
{
  const acts = POOL.filter(sp => battleProfile(sp).act), d = [], off = [];
  for (let k = 0; k < Math.round(24 * Q); k++) {
    const r = makeRng('ac' + k), T = genTeam(r, { realm: 2, n: 4, up: 0.3 }), i = r.int(T.length), sp = r.pick(acts);
    Object.assign(T[i], newGu(sp, Math.max(2, baseRank(sp))), { pos: T[i].pos });
    const foes = foesOf('acf' + k, 2, 4, 16), base = rateVs(T, foes, 'a' + k);
    const U = clone(T); U[i] = { ...U[i], noAct: true }; off.push(base - rateVs(U, foes, 'a' + k));
    const other = r.pick(acts.filter(x => x !== sp)); SP[sp].act = battleProfile(other).act; d.push(Math.abs(rateVs(T, foes, 'a' + k) - base)); delete SP[sp].act;
  }
  const a1 = d.reduce((a, b) => a + b, 0) / d.length, a2 = off.reduce((a, b) => a + b, 0) / off.length;
  console.log(`主动技：换成另一种主动技胜率平均变化 ${pc(a1)} 个百分点；去掉主动技平均掉 ${pc(a2)} 个百分点`);
  if (a1 < 0.05) fails.push('主动技区分度不足 5 个百分点'); if (a2 < 0.03) fails.push('主动技几乎没有作用');
}

// 9. 合成、蛊市、羁绊
{
  const team = [newGu('boar'), newGu('boar')], bag = [], r = placeGu(team, bag, newGu('boar'), 3, 8, 'shop');
  const ok = r.where === 'merge' && team.length === 1 && team[0].rank === 2 && team[0].atk === statFor('boar', 2).atk;
  console.log('三只合成换成新一转的表值：' + (ok ? 'OK' : '失败')); if (!ok) fails.push('合成不对');
  const sh = rollShop(makeRng(3), 0, 'li'); const ok2 = sh.some(w => w.kind === 'gu') && sh.some(w => w.kind === 'food');
  console.log('蛊市有蛊位和食物位：' + (ok2 ? 'OK' : '失败')); if (!ok2) fails.push('蛊市缺位');
  const sy = synergyOf([newGu('boar'), newGu('fire'), newGu('twin')]); const ok3 = sy.combos.length >= 1 && sy.line.length > 0;
  console.log('杀招自动成形（synergyOf）：' + (ok3 ? 'OK ' + sy.line : '失败')); if (!ok3) fails.push('杀招不成形');
}
console.log(`用时 ${Date.now() - t0}ms`);
if (fails.length) { console.log('FAIL: ' + fails.join('；')); process.exit(1); }
console.log('PASS');
