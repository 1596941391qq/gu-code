// node tools/trip-test.mjs —— 秘境自检：同种子同图、不卡死、撤退/全灭都走得通、各层死亡率、战利品曲线、节奏（真实 token 画像）
import { makeRng, arrangeTeam, autoPlace, XING, NORMAL_SPECIES, baseRank, daoOf, statFor, RANK, QUOTA } from '../src/core.js';
import { battle } from '../src/battle.js';
import * as T from '../src/trip.js';
if (process.env.FOE) Object.assign(T.TRIP_CFG.foe, JSON.parse(process.env.FOE));   // 调参：FOE='{"st":{...},"qk":0.1}' node tools/trip-test.mjs
let bad = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) bad++; };
const pend = (c, m) => console.log((c ? 'OK  ' : '待调') + ' ' + m);
const UNIT = 8000;   // 插件模式：每「千」= 8000 元气
const fight = (f, foe, seed) => battle(f, foe, seed, { lite: true });   // 新引擎：带 hpNow 进场，读 hpA / statA
// 玩家模型（按额度配队，不看境界蛊池）：
//   一般 avg：额度用满，物种随便挑（不管道），默认摆法，喂过一次加攻血的食物（按攻血 +10% 折算）
//   凑合 poor：只用了七成额度，不喂食物
//   配得好 good：额度用满，六成同一道（吃共鸣），食物喂满（按 +25% 折算），默认摆法
function teamBy(rng, quota, style = 'avg') {
  const cap = T.rankCapOf(quota), daos = [...new Set(NORMAL_SPECIES.map(x => x.id).map(daoOf))], main = rng.pick(daos);
  let left = Math.round(quota * (style === 'poor' ? 0.7 : 1)); const ranks = [];
  while (left > 0 && ranks.length < 7) { const hi = Math.min(cap, left), r = hi > 1 && rng() < 0.3 ? hi - 1 : hi; ranks.push(r); left -= r; }
  const team = ranks.map((r, i) => {
    const ok = NORMAL_SPECIES.map(x => x.id).filter(id => baseRank(id) <= r), same = ok.filter(id => daoOf(id) === main);
    const sp = rng.pick(style === 'good' && same.length && i < Math.ceil(ranks.length * 0.6) ? same : ok), st = statFor(sp, r), k = { good: 1.25, avg: 1.1, poor: 1 }[style] || 1.1;
    return { uid: 'p' + i, sp, rank: r, atk: Math.round(st.atk * k), hp: Math.round(st.hp * k), food: null, xing: null };
  });
  return autoPlace(arrangeTeam(team));
}
const player = (rng, r, style) => teamBy(rng, QUOTA[Math.max(0, Math.min(5, r))], style);

console.log('# 1 地图');
{
  const a = JSON.stringify(T.tripMap('seed-1', 2)), b = JSON.stringify(T.tripMap('seed-1', 2)), c = JSON.stringify(T.tripMap('seed-2', 2));
  ok(a === b && a !== c, '同种子两次地图相同，换种子不同');
  let minOpt = 9; for (let k = 0; k < 500; k++) { const m = T.tripMap('m' + k, k % 5); for (let d = 0; d < m.length - 1; d++) for (const r of m[d].rooms) { const nx = T.nextLanes(m, d, r.lane); minOpt = Math.min(minOpt, nx.length); if (!nx.every(l => m[d + 1].rooms.some(x => x.lane === l))) bad++; } }
  ok(minOpt >= 1, `每个房间都有下一步（普通层 2 条，首领前汇成 1 条）`);
  const p = T.foeTeam('s', 'shangjia', 3, 0, 'fight'), q = T.foeTeam('s', 'shangjia', 3, 0, 'fight');
  ok(JSON.stringify(p.map(g => [g.sp, g.atk, g.hp, g.pos])) === JSON.stringify(q.map(g => [g.sp, g.atk, g.hp, g.pos])), '同种子同层同路的敌阵相同（含站位）');
}

console.log('# 1b 秘境列表与按额度出敌');
{
  ok([0, 1, 2, 3, 4, 5].every(r => { const L = T.landsOf(r); return L.length >= 2 && L.length <= 3 && L.every(l => l.quota === QUOTA[r]) && new Set(L.map(l => l.dao)).size === L.length && new Set(L.map(l => JSON.stringify(l.boss))).size === L.length; }),
    `每个境界 2–3 个秘境，额度相同（${QUOTA.join('/')}），主道、首领都不同：${T.LANDS.map(l => l.n).join('、')}`);
  ok(T.LANDS.every(l => l.d && l.boss.length >= 2 && l.boss.every(g => g.rank <= l.cap)), '每个秘境有介绍、首领阵容，转数不超过这个境界能驱使的');
  let over = 0, under = 0, capBad = 0, det = 0; const fr = { room0: [], room8: [], elite: [], boss: [], ghost: [] };
  for (const q of [4, 7, 9, 10, 14, 15, 18, 22]) for (let k = 0; k < 60; k++) {
    const use = (o) => { const f = T.foeByBudget(makeRng(`fb${q}:${k}`), q, o); if (f.some(g => g.rank > T.rankCapOf(q))) capBad++; return f.reduce((a, g) => a + g.rank, 0) / q; };
    fr.room0.push(use({ kind: 'room', depth: 0 })); fr.room8.push(use({ kind: 'room', depth: 8 })); fr.elite.push(use({ kind: 'elite' })); fr.boss.push(use({ kind: 'boss' })); fr.ghost.push(use({ kind: 'ghost' }));
    const a = T.foeFor('same' + k, q, { kind: 'ghost' }), b = T.foeFor('same' + k, q, { kind: 'ghost' }); if (JSON.stringify(a) !== JSON.stringify(b)) det++;
  }
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  console.log('  用掉的额度（平均）:', Object.entries(fr).map(([k, a]) => `${k} ${Math.round(avg(a) * 100)}%`).join('  '));
  const near = (a, e) => Math.abs(avg(a) - e) < 0.1;
  ok(near(fr.room0, T.foeFrac('room', 0)) && near(fr.room8, T.foeFrac('room', 8)) && near(fr.elite, T.foeFrac('elite')) && near(fr.boss, T.foeFrac('boss')) && near(fr.ghost, 1), `用掉的额度和调参表一致（浅层 ${Math.round(T.foeFrac('room', 0) * 100)}%、第 9 层 ${Math.round(T.foeFrac('room', 8) * 100)}%、精英 ${Math.round(T.foeFrac('elite') * 100)}%、首领 ${Math.round(T.foeFrac('boss') * 100)}% × 各秘境 bk、斗幽灵满额）`);
  const f0 = T.foeFor('st', 14, { kind: 'room' }); ok(f0.every(g => { const st = statFor(g.sp, g.rank); return g.atk === st.atk && g.hp === st.hp; }), '敌蛊攻血 = 转数表原值，不打折');
  ok(!capBad && !det, '敌蛊转数不超过额度对应的上限；同种子同额度永远同一伙（斗幽灵、战帖也用）');
  const t = T.tripStart('lnd', 'caohai', player(makeRng('l'), 2)); ok(t.land === 'caohai' && t.quota === 10 && t.realm === 2, '按秘境 id 开局，记下额度和境界');
}

console.log('# 2 整趟模拟（配队一般、随机选路、不撤退）');
function runTrip(r, k, o = {}) {
  const rng = makeRng(`p${r}:${k}:${o.style || ''}`), team = o.team || player(rng, r, o.style), purse = { bank: o.bank || 0 }, L = T.landsOf(r);
  const t = T.tripStart('t' + r + ':' + k, o.land || L[k % L.length].id, team);
  const rec = { fights: [], rooms: 0, stuck: false, t };
  for (let guard = 0; !t.end && guard < 60; guard++) {
    if (o.retreatAt != null && t.d >= o.retreatAt && !t.room) { T.tripEnd(t, 'retreat'); break; }
    if (!t.room) {
      const reach = T.tripReach(t); if (!reach.length) { rec.stuck = true; break; }
      T.tripPick(t, reach[rng.int(reach.length)], UNIT, purse);
      for (let s = 0; !t.room && s < 1000; s++) T.tripFeed(t, 200000, UNIT, purse);   // 每次进账 20 万元气
      if (!t.room) { rec.stuck = true; break; }
      continue;
    }
    rec.rooms++;
    const room = t.room;
    if (room.foe) {
      const f = T.fieldTeam(t, team), foe = T.roomFoe(t), res = fight(f, foe, `b${k}:${room.d}`), out = T.tripFight(t, team, f, res);
      rec.fights.push({ d: room.d, type: room.type, n: f.length, dead: out.dead.length, saved: out.saved.length, lost: !!out.wiped, win: out.win, loot: out.loot });
    } else if (room.type === 'event') { const i = rng.int(2); if (!T.tripEvent(t, team, i, UNIT, purse).ok) T.tripEvent(t, team, 1 - i, UNIT, purse); }
    else if (room.type === 'camp') T.tripCamp(t);
    else if (room.type === 'market') { T.tripBuy(t, 0, UNIT, purse); T.tripLeaveRoom(t); }
  }
  if (!t.end) rec.stuck = true;
  return rec;
}
const R = [0, 1, 2, 3, 4, 5], N = 300, stuck = [], byD = {};
const ends = { retreat: 0, wipe: 0, clear: 0 };
const key = f => f.type === 'boss' ? 'boss' : f.type + (f.d <= 2 ? '浅' : f.d <= 5 ? '中' : '深');
for (const r of R) for (let k = 0; k < N; k++) {
  const rec = runTrip(r, k); if (rec.stuck) stuck.push(r + ':' + k); ends[rec.t.end ? rec.t.end.why : 'retreat']++;
  rec.fights.forEach(f => { const b = byD[key(f)] || (byD[key(f)] = { n: 0, loss: 0, saved: 0, units: 0 }); b.n++; b.units += f.n; b.saved += f.saved; if (f.lost) b.loss++; });
}
ok(!stuck.length, `不卡死（${R.length * N} 趟，卡住 ${stuck.length}）`);
console.log('  结局分布（随机选路、从不撤退）:', JSON.stringify(ends));
if (process.env.DBG) { const z = {}; for (const r of R) for (let k = 0; k < 150; k++) { const rec = runTrip(r, k); rec.fights.forEach(f => { const kk = r + ':' + key(f); const b = z[kk] || (z[kk] = [0, 0]); b[0]++; if (f.lost) b[1]++; }); } console.log('  按境界的输率:', Object.entries(z).sort().map(([k, [n, l]]) => `${k} ${(100 * l / n).toFixed(0)}%`).join(' ')); }
console.log('  每场输的概率（输了 = 场上全死）:', Object.entries(byD).sort().map(([k, b]) => `${k} ${(100 * b.loss / b.n).toFixed(1)}%（${b.n} 场，救回 ${(100 * b.saved / b.units).toFixed(0)}%）`).join('  '));
const lossOf = k => byD[k] ? byD[k].loss / byD[k].n : 0, eliteL = (byD['elite中'].loss + byD['elite深'].loss) / (byD['elite中'].n + byD['elite深'].n);
ok(lossOf('fight浅') < 0.05, `浅层（第 1–3 层）每场输的概率 < 5%：${(100 * lossOf('fight浅')).toFixed(1)}%`);
ok(eliteL >= 0.15 && eliteL <= 0.2, `精英：配队一般输 15%–20%：${(100 * eliteL).toFixed(1)}%`);

console.log('# 3 首领：配队一般 / 配得好 / 凑合');
// 一路下来剩 70%–100% 血进首领房（有一只是之前救回来的 1 血）
const bossLoss = (L, style, n = 80, tag = 'u') => {
  let loss = 0;
  for (let k = 0; k < n; k++) {
    const rng = makeRng(`${tag}${L.id}:${k}`), team = player(rng, L.realm, style);
    const t = T.tripStart('boss' + k, L.id, team); t.d = T.TRIP_CFG.depth - 1; t.lane = 1;
    team.forEach((g, i) => { t.hp[g.uid] = i === team.length - 1 && team.length > 2 ? 1 : Math.max(1, Math.round(g.hp * (0.7 + 0.3 * rng()))); });
    T.tripPick(t, 1, UNIT, { bank: 1e12 });
    const f = T.fieldTeam(t, team), out = T.tripFight(t, team, f, fight(f, T.roomFoe(t), 'bb' + k)); if (out.wiped) loss++;
  }
  return loss / n;
};
{
  const run = style => R.map(r => { const L = T.landsOf(r); return [r, L.reduce((a, l) => a + bossLoss(l, style), 0) / L.length]; });
  const show = (nm, rows) => console.log(`  ${nm}：` + rows.map(([r, l]) => `境界${r} 输${(100 * l).toFixed(0)}%`).join('  '));
  const mean = rows => rows.reduce((a, x) => a + x[1], 0) / rows.length;
  const A = run('avg'), G = run('good'), P = run('poor');
  show('配队一般', A); show('配得好  ', G); show('凑合    ', P);
  ok(mean(A) >= 0.35 && mean(A) <= 0.45, `首领：配队一般输 35%–45%：${(100 * mean(A)).toFixed(0)}%`);
  ok(mean(G) <= mean(A) * 0.7 && mean(P) > mean(A), `同一秘境，配得好的明显更安全（输 ${(100 * mean(G)).toFixed(0)}% < 一般 ${(100 * mean(A)).toFixed(0)}% < 凑合 ${(100 * mean(P)).toFixed(0)}%）`);
}
{
  console.log('# 3b 整趟对比（同一批秘境，随机选路、不撤退）');
  const sum = style => { let wipe = 0, clear = 0, n = 0, rooms = 0; for (const r of R) for (let k = 0; k < 120; k++) { const rec = runTrip(r, k, { style }); n++; rooms += rec.rooms; if (rec.t.end.why === 'wipe') wipe++; if (rec.t.end.why === 'clear') clear++; } return { wipe: wipe / n, clear: clear / n, rooms: rooms / n }; };
  const a = sum('avg'), g = sum('good'), p = sum('poor'), f = x => `全灭 ${(100 * x.wipe).toFixed(0)}%，通关 ${(100 * x.clear).toFixed(0)}%，平均走 ${x.rooms.toFixed(1)} 个房间`;
  console.log('  一般:', f(a)); console.log('  配得好:', f(g)); console.log('  凑合:', f(p));
  ok(g.clear > a.clear && a.clear > p.clear && g.wipe < a.wipe, '整趟下来也是配得好的通关多、全灭少');
}

if (process.env.TUNE) {   // 给每个秘境的首领挑阵容版本 bv、算 bk（首领用掉的额度再乘几倍）：配队一般打首领输 40% 左右
  const out = {};
  for (const L of T.LANDS) {
    const keep = [L.bk, L.bv], at = (bk, bv, n = 160) => { L.bk = bk; L.bv = bv; const v = bossLoss(L, 'avg', n, 'tu'); [L.bk, L.bv] = keep; return v; };
    let best = [1, 0], bd = 9;
    for (let bv = 0; bv < 4 && bd > 0.03; bv++) for (let bk = 0.7; bk <= 1.3 + 1e-9; bk += 0.1) { const v = at(+bk.toFixed(2), bv, 100), dd = Math.abs(v - 0.4) + Math.abs(bk - 1) * 0.02; if (dd < bd) { bd = dd; best = [+bk.toFixed(2), bv]; } }
    out[L.id] = best; console.log(`  ${L.n} bk=${best[0]} bv=${best[1]} → 首领用 ${Math.round(L.quota * T.TRIP_CFG.foe.boss * best[0])}/${L.quota} 点，输 ${(100 * at(best[0], best[1], 240)).toFixed(0)}%`);
  }
  console.log('  ' + JSON.stringify(out));
}

console.log('# 4 撤退与全灭');
{
  let a = null; for (let k = 0; k < 50 && !(a && a.t.end.why === 'retreat'); k++) a = runTrip(2, k, { retreatAt: 2 }); ok(a.t.end && a.t.end.why === 'retreat' && !a.t.end.wiped, '撤退：走到第 3 层主动撤退能结束');
  const res = T.tripResult(a.t); ok(res && Array.isArray(res.loot.gu) && res.loot.gu.every(g => g.sp && g.rank) && !('stone' in res.loot) && res.survivors.length + res.dead.length === a.t.order.length, '撤退结果：带回战利品（新蛊写成 {sp, rank}，没有元石），活着的 + 倒下的 = 出征的');
  let wipe = null; for (let k = 0; k < 200 && !wipe; k++) { const rng = makeRng('w' + k), weak = player(rng, 0, 'poor').slice(0, 1); weak[0].hp = 2; weak[0].atk = 1; const rec = runTrip(3, k, { team: weak }); if (rec.t.end && rec.t.end.wiped) wipe = rec; }
  ok(wipe && T.tripResult(wipe.t).loot.gu.length === 0 && T.tripResult(wipe.t).loot.foods.length === 0 && wipe.t.end.dead.length === wipe.t.order.length, '全灭：全员倒下，战利品全丢');
  const t = T.tripStart('qi', 0, player(makeRng('q'), 0)), purse = { bank: 5e6 };
  T.tripPick(t, 0, UNIT, purse); ok(t.room && purse.bank < 5e6, '出征先花攒着的元气：攒够一个房间就一口气走到');
  const t2 = T.tripStart('qi2', 0, player(makeRng('q2'), 0)), p2 = { bank: 0 }; T.tripFeed(t2, 1000, UNIT, p2); ok(p2.bank === 1000 && !t2.room, '没选路时进账的 token 存回元气');
}

console.log('# 5 战利品曲线（每个房间平均，境界 2，打赢时）');
{
  const line = []; for (let d = 0; d < 9; d++) { let food = 0, gu = 0, up = 0; const n = 400; for (let k = 0; k < n; k++) { const l = T.roomLoot('L' + k, 2, d, k % 3, 'fight'); food += l.foods.length; gu += l.gu.length; up += l.gu.filter(g => g.rank > 3).length; } line.push(`第${d + 1}层 食${(food / n).toFixed(2)} 蛊${(gu / n).toFixed(2)}`); }
  console.log('  战斗:', line.join(' | '));
  const el = T.roomLoot('E', 2, 5, 0, 'elite'), bs = T.roomLoot('B', 2, 9, 1, 'boss');
  console.log('  精英（第 6 层）:', T.lootText(el), '  首领:', T.lootText(bs));
  ok(T.roomLoot('x', 2, 8, 0, 'fight').foods !== undefined && !('stone' in T.roomLoot('x', 2, 8, 0, 'fight')), '战利品只有新蛊和食物，没有货币');
  { let bad2 = 0; for (let k = 0; k < 300; k++) T.roomLoot('s' + k, 2, 8, 0, 'boss').foods.forEach(id => { if (id === 'map') bad2++; }); ok(!bad2, '不再掉和元石有关的寻宝图'); }
}

console.log('# 6 节奏（真实画像：中位数 21.4 万 token/活跃分钟，缓存读取 ×0.1）');
{
  const perMin = 213782, m = T.tripMap('pace', 2), rooms = m.map(r => r.rooms.reduce((a, x) => a + x.cost, 0) / r.rooms.length * UNIT / perMin);
  console.log('  每层房间（分钟）:', rooms.map(x => x.toFixed(1)).join(' '));
  const total = rooms.reduce((a, b) => a + b, 0);
  ok(rooms.every(x => x >= 3 && x <= 6), `中位数玩家每个房间 3–6 分钟：${Math.min(...rooms).toFixed(1)}–${Math.max(...rooms).toFixed(1)}`);
  ok(total >= 30 && total <= 60, `一次完整出征 30–60 分钟：${total.toFixed(0)} 分钟`);
  console.log(`  网页（unit 200，模拟约 1000/s）：整趟约 ${(total * perMin / UNIT * 200 / 1000 / 60).toFixed(1)} 分钟`);
}

console.log('# 7 蛊性');
{
  ok(T.xingEarned({ hp: 2, mx: 10, kills: 0 }, true, null) === 'jianren' && T.xingEarned({ hp: 9, mx: 10, kills: 3 }, true, null) === 'shisha' && T.xingEarned({ hp: 9, mx: 10, kills: 3 }, true, 'shisha') === null, '达成条件与「已有的不算新的」');
  const team = player(makeRng('x'), 1), t = T.tripStart('x', 1, team); team[0].xing = 'jianren';
  t.room = { type: 'fight', d: 0, lane: 0, foe: 1 }; t.pick = 0;
  const f = T.fieldTeam(t, team), res = { winner: 'A', hpEnd: f.map(g => g.hp), statA: f.map((g, i) => ({ hp: g.hp, mx: g.hp, kills: i === 0 ? 3 : 0 })) };
  const out = T.tripFight(t, team, f, res); ok(out.offers.length === 1 && out.offers[0].old === 'jianren' && out.offers[0].xing === 'shisha' && team[0].xing === 'jianren', '已有蛊性时先问要不要替换，不直接换');
}
{
  const K = Object.keys(XING), need = ['jianren', 'shisha', 'ruiqi', 'zhanshou', 'tongpao', 'zhenyue', 'yuxue', 'zhefu'];
  ok(K.length === 8 && need.every((k, i) => K[i] === k), `8 个蛊性，顺序固定（坐标码按下标）：${K.join(' ')}`);
  ok(K.every(k => { const x = XING[k]; return x.n && x.d && x.get && Array.isArray(x.eff) && x.eff.every(e => e.when && e.op); }), '每个蛊性都有名字、效果说明、怎么得到、战斗效果数据');
  const base = { hp: 9, mx: 10, kills: 0, hits: 0, taken: 0 }, got = {
    jianren: [{ hp: 2 }, false], shisha: [{ kills: 3 }, true], ruiqi: [{ killT1: true }, true], zhanshou: [{ oneShot: true }, true],
    tongpao: [{ adjFell: 1 }, true], zhenyue: [{ front: true, hits: 4 }, true], yuxue: [{ taken: 12, hp: 5 }, false], zhefu: [{ frontFell: 1 }, true] };
  ok(K.every(k => T.xingEarned({ ...base, ...got[k][0] }, got[k][1], null) === k), '8 个蛊性各有一条打得出来的路');
  ok(T.xingEarned({ ...base, adjFell: 1 }, false, null) === null && T.xingEarned({ hp: 0, mx: 10, kills: 5 }, true, null) === null, '同袍/蛰伏要打赢；倒下的蛊不得蛊性');
}
console.log('# 7b 赢了救回，输了全死');
{
  const team = player(makeRng('rule'), 2), mk = () => { const t = T.tripStart('rule', 'caohai', team); t.pick = 0; t.room = { type: 'fight', d: 1, lane: 0, foe: 1 }; return t; };
  let t = mk(), f = T.fieldTeam(t, team);
  let out = T.tripFight(t, team, f, { winner: 'A', hpA: f.map((g, i) => i === 0 ? 0 : g.hp), statA: f.map(g => ({ hp: g.hp, mx: g.hp, kills: 0 })) });
  ok(out.win && out.saved.length === 1 && !out.dead.length && t.hp[f[0].uid] === 1 && !t.dead.length && t.saved.length === 1, '打赢：倒下的救回，剩 1 血');
  t = mk(); f = T.fieldTeam(t, team);
  out = T.tripFight(t, team, f, { winner: 'B', hpA: f.map((g, i) => i === 0 ? 3 : 0), statA: [] });
  ok(out.wiped && t.end && t.end.wiped && t.dead.length === f.length && T.tripResult(t).loot.gu.length === 0, '打输：场上全部永久死亡（剩着血的也算），出征结束，战利品全丢');
  t = mk(); f = T.fieldTeam(t, team);
  out = T.tripFight(t, team, f, { winner: 'draw', hpA: f.map((g, i) => i === 0 ? 0 : 2), statA: [] });
  ok(!out.wiped && !out.loot && out.saved.length === 1 && !t.end, '平手：双方退开，倒下的救回，没有战利品');
}
console.log('# 8 奇遇');
{
  const FX = ['heal', 'food', 'gu', 'bump', 'xing', 'shortcut', 'slow', 'hurtFront', 'hurtAll', 'healLow', 'pay'];
  ok(T.EVENTS.length === 10 && new Set(T.EVENTS.map(e => e.id)).size === 10, `10 个奇遇：${T.EVENTS.map(e => e.n).join('、')}`);
  ok(T.EVENTS.every(e => e.s && e.o.length === 2 && e.o.every(o => o.t && Object.keys(o.fx).every(k => FX.includes(k)) && (!o.fx.xing || XING[o.fx.xing]))), '每个奇遇两个选项，效果都认得');
  ok(T.EVENTS.every(e => e.o.every(o => T.fxText(o.fx).length > 3)), '每个选项的结果都写成了人话');
  const team = player(makeRng('ev'), 1), mk = id => { const t = T.tripStart('ev', 1, team); t.pick = 0; t.room = { type: 'event', d: 4, lane: 0, ev: id }; return t; };
  let t = mk('luonan'), purse = { bank: 0 }; const pay = T.evPay(t, T.EVENT.luonan.o[0].fx, UNIT);
  ok(!T.tripEvent(t, team, 0, UNIT, purse).ok && !t.room.done, '花元气的选项：元气不够就选不了');
  purse.bank = pay + 5; const r = T.tripEvent(t, team, 0, UNIT, purse); ok(r.ok && purse.bank === 5 && t.loot.gu.length === 1, `元气够就扣 ${pay} 换一只新蛊`);
  t = mk('duzhang'); const u0 = t.order[0]; T.tripEvent(t, team, 1, UNIT, purse); ok(t.short === 1.5, '绕路：下一个房间多走一半');
  t = mk('duzhang'); T.tripEvent(t, team, 0, UNIT, purse); ok(t.short === 0.5 && t.order.every(u => t.hp[u] >= 1 && t.hp[u] < t.mx[u]), '穿瘴气：全队掉血但不会掉到 0，路减半');
  t = mk('xuechi'); t.hp[u0] = 1; T.tripEvent(t, team, 0, UNIT, purse); ok(t.hp[u0] > 1, '赤水潭：回伤得最重的那只');
  t = T.tripStart('tea', 1, team, { trip: ['tea'] }); t.hp[u0] = 1; ok(T.tripPreFight(t) > 0 && t.hp[u0] > 1, '回春茶：每场开打前全队回血');
}
console.log(bad ? `\n${bad} 项未通过` : '\n全部通过'); process.exit(bad ? 1 : 0);
