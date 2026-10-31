// node tools/trip-test.mjs —— 秘境自检：同种子同图、不卡死、撤退/全灭都走得通、各层死亡率、战利品曲线、节奏（真实 token 画像）
import { makeRng, genTeam, slotCap, arrangeTeam } from '../src/core.js';
import { battle } from '../src/battle.js';
import * as T from '../src/trip.js';
if (process.env.FOE) Object.assign(T.TRIP_CFG.foe, JSON.parse(process.env.FOE)); if (process.env.BOSS) Object.assign(T.TRIP_CFG.boss, JSON.parse(process.env.BOSS));
let bad = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) bad++; };
// 死亡率两项要等新战斗引擎（m5-battle：速度轮次、血量 ×4）合进来再调 TRIP_CFG.foe.s / boss.all；在那之前只报数，STRICT=1 时算失败
const pend = (c, m) => console.log((c ? 'OK  ' : '待调') + ' ' + m);
const UNIT = 8000;   // 插件模式：每「千」= 8000 元气
// 战斗：引擎支持 hpNow/hpEnd 后直接用；还不支持时把剩血当满血喂进去，用最后一帧快照读剩血（和 trip.js 的兜底一致）
const fight = (f, foe, seed) => { let r = battle(f, foe, seed); if (!r.hpEnd) { r = battle(f.map(g => ({ ...g, hp: g.hpNow ?? g.hp })), foe, seed); r.hpEnd = T.hpFromLog(r, f.length); } return r; };
// 玩家模型：v2 的同境界阵容（genTeam，满编，部分升转）
const player = (rng, r, up = 0.3) => arrangeTeam(genTeam(rng, { realm: r, up }));

console.log('# 1 地图');
{
  const a = JSON.stringify(T.tripMap('seed-1', 2)), b = JSON.stringify(T.tripMap('seed-1', 2)), c = JSON.stringify(T.tripMap('seed-2', 2));
  ok(a === b && a !== c, '同种子两次地图相同，换种子不同');
  let minOpt = 9; for (let k = 0; k < 500; k++) { const m = T.tripMap('m' + k, k % 5); for (let d = 0; d < m.length - 1; d++) for (const r of m[d].rooms) { const nx = T.nextLanes(m, d, r.lane); minOpt = Math.min(minOpt, nx.length); if (!nx.every(l => m[d + 1].rooms.some(x => x.lane === l))) bad++; } }
  ok(minOpt >= 1, `每个房间都有下一步（普通层 2 条，首领前汇成 1 条）`);
  const p = T.foeTeam('s', 1, 3, 0, 'fight', 100), q = T.foeTeam('s', 1, 3, 0, 'fight', 100);
  ok(JSON.stringify(p.map(g => [g.sp, g.atk, g.hp])) === JSON.stringify(q.map(g => [g.sp, g.atk, g.hp])), '同种子同层同路的敌阵相同');
}

console.log('# 2 整趟模拟（随机选路、不撤退）');
function runTrip(r, k, o = {}) {
  const rng = makeRng(`p${r}:${k}`), team = o.team || player(rng, r, o.up ?? 0.3), purse = { bank: o.bank || 0 };
  const t = T.tripStart('t' + r + ':' + k, r, team);
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
      rec.fights.push({ d: room.d, type: room.type, n: f.length, dead: out.dead.length, win: out.win, loot: out.loot });
    } else if (room.type === 'event') T.tripEvent(t, team, rng.int(2));
    else if (room.type === 'camp') T.tripCamp(t);
    else if (room.type === 'market') { T.tripBuy(t, 0, UNIT, purse); T.tripLeaveRoom(t); }
  }
  if (!t.end) rec.stuck = true;
  return rec;
}
const R = [0, 1, 2, 3, 4], N = 300, stuck = [], byD = {}, boss = { n: 0, units: 0, dead: 0 };
const ends = { retreat: 0, wipe: 0, clear: 0 };
for (const r of R) for (let k = 0; k < N; k++) {
  const rec = runTrip(r, k); if (rec.stuck) stuck.push(r + ':' + k); ends[rec.t.end ? rec.t.end.why : 'retreat']++;
  rec.fights.forEach(f => { if (f.type === 'boss') { boss.n++; boss.units += f.n; boss.dead += f.dead; return; } const key = f.type + (f.d <= 2 ? '浅' : f.d <= 5 ? '中' : '深'); const b = byD[key] || (byD[key] = { n: 0, units: 0, dead: 0, loss: 0 }); b.n++; b.units += f.n; b.dead += f.dead; if (!f.win) b.loss++; });
}
ok(!stuck.length, `不卡死（${R.length * N} 趟，卡住 ${stuck.length}）`);
console.log('  结局分布（随机选路、从不撤退）:', JSON.stringify(ends));
console.log('  每场每只蛊的死亡率:', Object.entries(byD).sort().map(([k, b]) => `${k} ${(100 * b.dead / b.units).toFixed(1)}%（${b.n} 场，败 ${(100 * b.loss / b.n).toFixed(0)}%）`).join('  '));
const shallow = byD['fight浅']; (process.env.STRICT ? ok : pend)(shallow && shallow.dead / shallow.units < 0.05, `浅层（第 1–3 层）战斗每场死亡率 < 5%：${(100 * shallow.dead / shallow.units).toFixed(1)}%`);

console.log('# 3 首领（渡劫）：战力不够时');
{
  // 战力不够 = 出征时攻血总和只有首领的 75%–90%（同境界满编、少升转）。带着一路的伤进首领房
  const rows = [];
  for (const r of R) {
    let units = 0, dead = 0, n = 0, wins = 0; const bp = T.teamPow(T.bossTeam(r));
    for (let k = 0; k < 400 && n < 150; k++) {
      const rng = makeRng(`u${r}:${k}`), team = player(rng, r, 0.3), p = T.teamPow(team), ratio = p / bp;
      if (ratio < 0.75 || ratio > 0.9) continue;
      const t = T.tripStart('boss' + k, r, team); t.d = T.TRIP_CFG.depth - 1; t.lane = 1;
      team.forEach((g, i) => { t.hp[g.uid] = Math.max(1, Math.round(g.hp * (0.7 + 0.3 * rng()))); });   // 一路下来剩 70%–100% 血
      T.tripPick(t, 1, UNIT, { bank: 1e12 });
      const f = T.fieldTeam(t, team), res = fight(f, T.roomFoe(t), 'bb' + k), out = T.tripFight(t, team, f, res);
      units += f.length; dead += out.dead.length; n++; if (out.win) wins++;
    }
    rows.push([r, n, units ? dead / units : 0, n ? wins / n : 0]);
  }
  rows.forEach(([r, n, d, w]) => console.log(`  境界 ${r}：样本 ${n}，每只蛊死亡率 ${(100 * d).toFixed(0)}%，胜率 ${(100 * w).toFixed(0)}%`));
  const all = rows.filter(x => x[1] >= 20), avg = all.reduce((a, x) => a + x[2], 0) / Math.max(1, all.length);
  (process.env.STRICT ? ok : pend)(avg >= 0.3 && avg <= 0.5, `首领在战力不够时每只蛊死亡率平均 30%–50%：${(100 * avg).toFixed(0)}%`);
}

console.log('# 4 撤退与全灭');
{
  let a = null; for (let k = 0; k < 50 && !(a && a.t.end.why === 'retreat'); k++) a = runTrip(2, k, { retreatAt: 2 }); ok(a.t.end && a.t.end.why === 'retreat' && !a.t.end.wiped, '撤退：走到第 3 层主动撤退能结束');
  const res = T.tripResult(a.t); ok(res && Array.isArray(res.loot.gu) && res.loot.gu.every(g => g.sp && g.rank) && !('stone' in res.loot) && res.survivors.length + res.dead.length === a.t.order.length, '撤退结果：带回战利品（新蛊写成 {sp, rank}，没有元石），活着的 + 倒下的 = 出征的');
  let wipe = null; for (let k = 0; k < 200 && !wipe; k++) { const rng = makeRng('w' + k), weak = player(rng, 0, 0).slice(0, 1); weak[0].hp = 2; weak[0].atk = 1; const rec = runTrip(3, k, { team: weak }); if (rec.t.end && rec.t.end.wiped) wipe = rec; }
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
console.log(bad ? `\n${bad} 项未通过` : '\n全部通过'); process.exit(bad ? 1 : 0);
