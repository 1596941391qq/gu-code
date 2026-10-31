// node tools/sim.mjs [场数]  —— 随机阵容对战压测：死循环、回合数、物种/杀招胜率、可复现性、坐标码往返
import { makeRng, genTeam, comboOf, SP, applyNode, newGu, encodeTeam, decodeTeam, QUIRKS, COMBOS, addTrait } from '../src/core.js';
import { battle } from '../src/battle.js';

const N = +process.argv[2] || 1000;
const sp = {}, cb = {}, qk = {}; const turns = []; let draws = 0, capped = 0, maxEv = 0, nondet = 0, codeFail = 0, t0 = Date.now();
const tally = (m, k, w) => { (m[k] ||= { n: 0, w: 0 }); m[k].n++; m[k].w += w; };
for (let i = 0; i < N; i++) {
  const rng = makeRng('sim' + i), p = rng.int(15);
  const ta = genTeam(rng, p), tb = genTeam(rng, Math.max(0, p + rng.int(3) - 1));
  const r = battle(ta, tb, 'seed' + i), r2 = battle(ta, tb, 'seed' + i);
  if (r.winner !== r2.winner || r.log.length !== r2.log.length) nondet++;
  const dec = decodeTeam(encodeTeam(ta, { name: '测试', realm: 2 }));
  if (!dec || dec.team.length !== ta.length || dec.team.some((g, j) => g.atk !== Math.min(255, ta[j].atk) || g.tr.length !== ta[j].tr.length || g.att.join() !== ta[j].att.join())) codeFail++;
  turns.push(r.turns); if (r.winner === 'draw') draws++; if (r.capped) capped++; maxEv = Math.max(maxEv, r.log.length);
  [[ta, 'A'], [tb, 'B']].forEach(([t, side]) => {
    const w = r.winner === side ? 1 : r.winner === 'draw' ? 0.5 : 0;
    const set = new Set(); t.forEach(g => { set.add(g.sp); g.att.forEach(a => set.add(a)); });
    set.forEach(s => tally(sp, SP[s].n, w));
    const cs = new Set(); t.forEach(g => { const c = comboOf(g); if (c) cs.add(c.n); }); cs.forEach(c => tally(cb, c, w));
    const qs = new Set(); t.forEach(g => g.q.forEach(q => qs.add(QUIRKS[q].n))); qs.forEach(q => tally(qk, q, w));
  });
}
turns.sort((a, b) => a - b);
const pct = q => turns[Math.floor(q * (turns.length - 1))];
const fmt = m => Object.entries(m).sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n).map(([k, v]) => `${k} ${(100 * v.w / v.n).toFixed(1)}%(${v.n})`).join('  ');
console.log(`== ${N} 场随机对战，用时 ${Date.now() - t0}ms`);
console.log(`回合数 中位 ${pct(0.5)} / P90 ${pct(0.9)} / 最大 ${turns[turns.length - 1]}；平局 ${draws}；触发上限 ${capped}；单场最多事件 ${maxEv}`);
console.log(`同种子复现不一致 ${nondet}；坐标码往返失败 ${codeFail}`);
console.log('物种胜率（含附蛊出场）:', fmt(sp));
console.log('杀招胜率:', fmt(cb));
console.log('怪癖胜率:', fmt(qk));
const over = [...Object.entries(sp), ...Object.entries(cb)].filter(([, v]) => v.n >= 20 && v.w / v.n > 0.75);
console.log(over.length ? '!! 胜率超过 75%: ' + over.map(x => x[0]).join(',') : 'OK：没有物种/杀招胜率超过 75%');

// 顺序即流派：同一起点，两种走法结果不同
const show = t => t.map(g => `${SP[g.sp].n}${g.atk}/${g.hp}[${g.tr.map(x => x[0] + x[1]).join(',')}]`).join(' | ');
const run = order => { const r = makeRng('order'); const team = [newGu('boar'), newGu('fire')]; order.forEach(type => applyNode(team, { type, cost: 50 }, r)); return show(team); };
console.log('突变→分裂→吞噬:', run(['mutate', 'split', 'devour']));
console.log('分裂→吞噬→突变:', run(['split', 'devour', 'mutate']));
console.log('吞噬→分裂→突变:', run(['devour', 'split', 'mutate']));

// 杀招强制测试：A 队首蛊强行炼成某杀招，对同阶随机阵容各打 300 场
const forced = [];
for (const c of COMBOS) {
  let w = 0; const M = 300;
  for (let i = 0; i < M; i++) {
    const rng = makeRng(c.id + i), p = 2 + rng.int(10);
    const ta = genTeam(rng, p), tb = genTeam(rng, p);
    const g = ta[0]; g.sp = c.need[0]; g.att = c.need.slice(1);
    g.tr = [[SP[g.sp].t, SP[g.sp].v]]; g.att.forEach(a => addTrait(g, SP[a].t, SP[a].v, true));
    const r = battle(ta, tb, 'f' + i); w += r.winner === 'A' ? 1 : r.winner === 'draw' ? 0.5 : 0;
  }
  forced.push(`${c.n} ${(100 * w / M).toFixed(1)}%`);
}
console.log('杀招强制胜率（同阶，300 场/招）:', forced.join('  '));
