// node tools/sim.mjs [场数]  —— 随机阵容对战压测：死循环、回合数、物种/杀招胜率、可复现性、坐标码往返
import { makeRng, genTeam, comboOf, SP, applyNode, newGu, encodeTeam, decodeTeam, QUIRKS, COMBOS, addTrait, MARK_KEYS, MARKS, playMs, tempoFor, poolFor, rollCompass, nodeChoices, rollShop, buyGu, canBuy, sellValue, tribTeam, endlessTeam, rollMarks, slotCap, ECON, ghostTrio, REALMS, arrangeTeam, spTraits, RANK, baseRank, rankOf, canWield, BAG } from '../src/core.js';
import { battle } from '../src/battle.js';

const N = +process.argv[2] || 1000;
const sp = {}, cb = {}, qk = {}; const turns = [], durs = []; let draws = 0, capped = 0, maxEv = 0, nondet = 0, codeFail = 0, t0 = Date.now();
const tally = (m, k, w) => { (m[k] ||= { n: 0, w: 0 }); m[k].n++; m[k].w += w; };
for (let i = 0; i < N; i++) {
  const rng = makeRng('sim' + i), p = rng.int(15);
  const ta = genTeam(rng, p), tb = genTeam(rng, Math.max(0, p + rng.int(3) - 1));
  const ma = MARK_KEYS.filter(() => rng() < 0.15), mb = MARK_KEYS.filter(() => rng() < 0.15);
  if (rng() < 0.3) ta[0].rank = baseRank(ta[0].sp) + 1 + rng.int(RANK.fuse);
  const r = battle(ta, tb, 'seed' + i, ma, mb), r2 = battle(ta, tb, 'seed' + i, ma, mb);
  if (r.winner !== r2.winner || r.log.length !== r2.log.length) nondet++;
  const dec = decodeTeam(encodeTeam(ta, { name: '测试', realm: 2, marks: ma }));
  if (!dec || dec.marks.join() !== ma.join() || dec.team.length !== ta.length || dec.team.some((g, j) => g.atk !== Math.min(1023, ta[j].atk) || g.hp !== Math.min(1023, ta[j].hp) || rankOf(g) !== rankOf(ta[j]) || JSON.stringify(g.tr) !== JSON.stringify(ta[j].tr) || g.att.join() !== ta[j].att.join() || g.q.join() !== ta[j].q.join())) codeFail++;
  else { const rd = battle(dec.team, decodeTeam(encodeTeam(tb, { marks: mb })).team, 'seed' + i, dec.marks, mb); if (rd.winner !== r.winner && ta.every(g => g.atk < 256 && g.hp < 256)) codeFail++; }
  durs.push(playMs(r.log) * tempoFor(playMs(r.log)) / 1000); turns.push(r.turns); if (r.winner === 'draw') draws++; if (r.capped) capped++; maxEv = Math.max(maxEv, r.log.length);
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
durs.sort((a, b) => a - b); const dq = q => durs[Math.floor(q * (durs.length - 1))].toFixed(1);
console.log(`1 倍速单局时长 P10 ${dq(0.1)}s / 中位 ${dq(0.5)}s / P90 ${dq(0.9)}s；落在 15–25 秒的 ${(100 * durs.filter(d => d >= 15 && d <= 25).length / durs.length).toFixed(0)}%`);
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
    g.tr = spTraits(g.sp); g.att.forEach(a => addTrait(g, SP[a].t, SP[a].v, true));
    const r = battle(ta, tb, 'f' + i); w += r.winner === 'A' ? 1 : r.winner === 'draw' ? 0.5 : 0;
  }
  forced.push(`${c.n} ${(100 * w / M).toFixed(1)}%`);
}
console.log('杀招强制胜率（同阶，300 场/招）:', forced.join('  '));

// ---------- 整局模拟：简单策略的玩家走罗盘、逛蛊市、斗幽灵、渡劫、挑无尽劫 ----------
// 预算 STEPS 个节点（≈ 演示模式 30 分钟 / 真实 Vibe Coding 若干天）；每 2 节点斗一次幽灵，每 3 节点试一次渡劫/无尽劫
const RUNS = 1000, STEPS = 150;
const reach = new Array(6).fill(0), stepAt = [[], [], [], [], [], []], floors = []; let runCap = 0;
let simRealm = 0;
const ar = t => { const f = t.filter(g => canWield(g, simRealm)); return arrangeTeam((f.length ? f : t).slice()); };   // 机器人开战前按规则排阵（不改原阵）；真元不足以驱使的不上阵
const pow = g => g.atk + g.hp + g.tr.reduce((a, t) => a + t[1] * 2, 0);
for (let run = 0; run < RUNS; run++) {
  const rng = makeRng('run' + run); let team = [newGu(rng.pick(poolFor(0)))], bag = [], realm = 0, stone = 5, marks = [], shop = rollShop(rng, 0, []), floor = 1, best = 0, endLoss = 0;
  for (let step = 1; step <= STEPS; step++) {
    const cap = Math.max(slotCap(realm), team.length); simRealm = realm;
    const comp = rollCompass(rng, team, false, cap);
    const node = comp.find(n => n.type === 'refine' && comboOf({ sp: team[0].sp, att: [...team[0].att, team[team.length - 1].sp] })) || comp.find(n => n.type === 'summon' && team.length < cap) || rng.pick(comp);
    let pick; const opts = nodeChoices(node, team, rng, realm);
    if (opts) pick = node.type === 'devour' ? opts.reduce((b, i) => pow(team[i]) < pow(team[b]) ? i : b, opts[0]) : rng.pick(opts);
    applyNode(team, node, rng, { pick, cap, wuhuo: rng() < 0.2 }); stone += ECON.node + 1;
    shop = rollShop(rng, realm, shop);
    for (let k = 0; k < 3; k++) {   // 逛蛊市：先买能合炼的，再补空位，满了就卖最弱的换
      const cost = marks.includes('shiJing') ? 2 : ECON.buy; if (stone < cost) break;
      const ci = shop.findIndex(w => !w.sold && [...team, ...bag].filter(g => g.sp === w.sp && rankOf(g) === baseRank(w.sp)).length >= 2);
      const fi = ci >= 0 ? ci : shop.findIndex(w => !w.sold && (team.length < cap || (bag.length < BAG.cap && [...team, ...bag].some(g => g.sp === w.sp && rankOf(g) === baseRank(w.sp)))));   // 蛊囊只用来攒同种
      if (fi >= 0) { if (buyGu(team, shop[fi].sp, cap, marks, rng, bag)) { stone -= cost; shop[fi].sold = true; } continue; }
      if (team.length >= cap && stone >= cost + 2) { const wi = team.reduce((b, g, i) => pow(g) < pow(team[b]) ? i : b, 0); if (wi > 0) { stone += sellValue(team[wi]); team.splice(wi, 1); continue; } }
      if (stone >= cost + ECON.refresh) { stone -= marks.includes('shiJing') ? 0 : ECON.refresh; shop = rollShop(rng, realm, []); } else break;
    }
    while (team.length < cap && bag.length) team.push(bag.shift());   // 空窍有空位就从蛊囊补上
    team.forEach(g => { g.wound = 0; });
    if (step % 2 === 0) { const t = ghostTrio(rng, step + realm, realm)[1]; const r = battle(ar(team), t.team, 'g' + run + ':' + step, marks); stone += r.winner === 'A' ? ECON.win.mid : ECON.lose; }
    if (step % 3 === 0) {
      if (realm < 5) {
        const r = battle(ar(team), tribTeam(realm), 't' + run + ':' + step, marks);
        if (r.capped) runCap++;
        if (r.winner === 'A') { reach[realm]++; stepAt[realm].push(step); realm++; team.forEach(g => { g.atk++; g.hp++; }); marks.push(rng.pick(rollMarks(rng, marks))); stone += ECON.win.trib; shop = rollShop(rng, realm, []); }
      } else {
        const r = battle(ar(team), endlessTeam(floor), 'e' + run + ':' + step, marks);
        if (r.winner === 'A') { best = floor; floor++; endLoss = 0; stone += ECON.win.endless; } else endLoss++;
      }
    }
  }
  if (realm >= 5) floors.push(best);
}
const med = a => a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : '-';
console.log(`== 整局模拟 ${RUNS} 局 × ${STEPS} 节点（含蛊市买卖、合炼、道痕）`);
console.log('各阶通关率（渡劫成功占全部局）:', REALMS.slice(0, 5).map((n, r) => `${n}→${REALMS[r + 1]} ${(100 * reach[r] / RUNS).toFixed(1)}%（中位第 ${med(stepAt[r])} 节点）`).join('  '));
console.log(`无尽劫：登顶 ${floors.length} 局，平均 ${floors.length ? (floors.reduce((a, b) => a + b, 0) / floors.length).toFixed(1) : 0} 层，最高 ${floors.length ? Math.max(...floors) : 0} 层；整局触发上限 ${runCap}`);
if (runCap) capped += runCap;

// ---------- 布阵：20 套常见阵容 × 全部排列，对同阶敌阵（敌方按规则排阵）各打 80 场 ----------
const permsOf = a => a.length <= 1 ? [a] : a.flatMap((x, i) => permsOf([...a.slice(0, i), ...a.slice(i + 1)]).map(q => [x, ...q]));
const spreads = []; const tF = Date.now();
for (let k = 0; spreads.length < 20; k++) {
  const rng = makeRng('form' + k), p = 8 + rng.int(14), team = genTeam(rng, p, 5); if (team.length < 4) continue;
  const foes = Array.from({ length: 40 }, (_, j) => genTeam(makeRng('formfoe' + k + ':' + j), p, 5));
  const wr = perm => { let w = 0; foes.forEach((f, j) => { for (const sd of ['a', 'b']) { const r = battle(perm, f, 'fs' + sd + j); w += r.winner === 'A' ? 1 : r.winner === 'draw' ? 0.5 : 0; } }); return w / (foes.length * 2); };
  const all = permsOf(team).map(wr), best = Math.max(...all), worst = Math.min(...all);
  spreads.push({ n: team.length, best, worst, d: best - worst, ai: wr(arrangeTeam(team.slice())), names: team.map(g => SP[g.sp].ab).join('') });
}
const big = spreads.filter(x => x.d >= 0.15).length, pp = x => (100 * x).toFixed(0);
console.log(`== 布阵 20 套阵容 × 全部排列 × 80 场，用时 ${Date.now() - tF}ms`);
console.log('每套 最佳/最差/规则排阵:', spreads.map(x => `${x.names} ${pp(x.best)}/${pp(x.worst)}/${pp(x.ai)}`).join('  '));
console.log(`最佳−最差胜率差 中位 ${pp(med(spreads.map(x => x.d)))} 个百分点；≥15 个百分点的 ${big}/20；规则排阵平均比最佳低 ${pp(spreads.reduce((a, x) => a + x.best - x.ai, 0) / 20)} 个百分点`);
// 7 格：6–7 只的阵容排列太多（最多 5040 种），每套随机抽 60 种排法 + 规则排阵，各打 40 场
const sp7 = []; const t7 = Date.now();
for (let k = 0; sp7.length < 10; k++) {
  const rng = makeRng('form7' + k), p = 24 + rng.int(20), team = genTeam(rng, p, 7); if (team.length < 6) continue;
  const foes = Array.from({ length: 20 }, (_, j) => genTeam(makeRng('form7foe' + k + ':' + j), p, 7));
  const wr = perm => { let w = 0; foes.forEach((f, j) => { for (const sd of ['a', 'b']) { const r = battle(perm, f, 'f7' + sd + j); w += r.winner === 'A' ? 1 : r.winner === 'draw' ? 0.5 : 0; } }); return w / (foes.length * 2); };
  const ws = Array.from({ length: 60 }, () => { const a = team.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rng.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return wr(a); });
  const ai = wr(arrangeTeam(team.slice())); ws.push(ai); const best = Math.max(...ws), worst = Math.min(...ws);
  sp7.push({ d: best - worst, best, worst, ai, names: team.map(g => SP[g.sp].ab).join('') });
}
const big7 = sp7.filter(x => x.d >= 0.15).length;
console.log(`== 布阵 7 格：10 套 6–7 只阵容 × 61 种排法 × 40 场，用时 ${Date.now() - t7}ms`);
console.log('每套 最佳/最差/规则排阵:', sp7.map(x => `${x.names} ${pp(x.best)}/${pp(x.worst)}/${pp(x.ai)}`).join('  '));
console.log(`7 格最佳−最差胜率差 中位 ${pp(med(sp7.map(x => x.d)))} 个百分点；≥15 个百分点的 ${big7}/10`);

// CI 闸门：死循环 / 编解码不一致 / 同种子不复现 任何一项出现就失败退出
const fails = [];
if (turns[turns.length - 1] >= 60 || capped > 0) fails.push(`回合或触发上限被触发（最大回合 ${turns[turns.length - 1]}，触发上限 ${capped}）`);
if (codeFail) fails.push(`坐标码往返失败 ${codeFail}`);
if (nondet) fails.push(`同种子不复现 ${nondet}`);
{ // 旧码兼容：M2 时代（v2，5 格、4 位物种、星级）生成的真实坐标码必须还能解码，星级换算成转数
  const d = decodeTeam('ShuaXp-eggSAJEhwk5YaU1WgAL4IwBAYWQAAFACwECC0AAAgAEBAgUQAAFABU');
  const ok = d && d.name === '旧码' && d.realm === 2 && d.marks.join() === 'heLian' && JSON.stringify(d.team.map(g => [g.sp, g.atk, g.hp, rankOf(g)])) === '[["drum",18,28,4],["cicada",2,3,2],["moth",1,2,3],["twin",2,4,1]]';
  console.log(ok ? '旧 v2 坐标码解码：OK' : '旧 v2 坐标码解码：失败 ' + JSON.stringify(d && d.team.map(g => [g.sp, g.atk, g.hp, rankOf(g)])));
  if (!ok) fails.push('旧 v2 坐标码解码失败');
}
{ // 试玩标志：v4 码多 1 位，网页试玩存档带上；旧 v3 码（没有这一位）照常解码，按非试玩处理
  const d3 = decodeTeam('ZZuS4ieeJiAIAJAEBAkoAAAADIAIAwjIAAAACLAEAgjQAAAADo');
  const ok3 = d3 && d3.name === '三版' && d3.realm === 1 && d3.trial === false && JSON.stringify(d3.team.map(g => [g.sp, g.atk, g.hp, rankOf(g)])) === '[["drum",1,4,3],["cicada",2,3,2],["moth",1,2,3]]';
  const t = decodeTeam(encodeTeam(d3 ? d3.team : [], { name: '试玩', realm: 1, trial: true })), f = decodeTeam(encodeTeam(d3 ? d3.team : [], { name: '真', realm: 1 }));
  const ok4 = t && t.trial === true && f && f.trial === false && t.team.length === 3;
  console.log(ok3 && ok4 ? '试玩标志（v4）与旧 v3 码：OK' : '试玩标志/旧 v3 码：失败');
  if (!(ok3 && ok4)) fails.push('试玩标志或旧 v3 码解码失败');
}
if (med(sp7.map(x => x.d)) < 0.15) fails.push(`7 格站位差中位不足 15 个百分点`);
if (fails.length) { console.error('FAIL: ' + fails.join('；')); process.exit(1); }
console.log('PASS');
