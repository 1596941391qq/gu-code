// node tools/bestiary-sim.mjs [场数]  —— 蛊典扩充的平衡模拟（只在内存里合并，不改 core.js / battle.js）
// 1. 把 src/bestiary.js 文件头写的 8 处补丁原样打到 battle.js 副本上（每处必须恰好命中一次，否则报错）
// 2. 回归：只用旧 12 种蛊时，打补丁的引擎与原 battle.js 逐场结果、事件流完全一致
// 3. 合并数据后：物种同阶胜率（目标 42–60%）、新杀招强制胜率（目标 45–60%）、流派胜率与仙蛊胜率（都不超过 60%）、数据完整性（转数/喂食/克制/蛊方）、死循环/回合上限、同种子复现、词条触发覆盖
import { readFileSync } from 'node:fs';
import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
import * as core from '../src/core.js';
import { battle as battleOrig } from '../src/battle.js';
import * as BXmod from '../src/bestiary.js';
import { ART2 } from '../src/art2.js';
const { makeRng, genTeam, comboOf, SP, SPECIES, TRAITS, TRAIT_KEYS, COMBOS, COMBO, SUMMON_NAMES, POOL_TIERS, addTrait, MARK_KEYS } = core;
const { NEW_SPECIES, NEW_TRAITS, NEW_COMBOS, NEW_SUMMONS, NEW_POOL, LEGENDS, META, NEW_RECIPES, FOODS, SCHOOLS, OLD_EXTRA, trCapOf } = BXmod;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = +process.argv[2] || 8000;
const t0 = Date.now(), fails = [];

// ---------- 1. 打补丁 ----------
let src = readFileSync(path.join(root, 'src/battle.js'), 'utf8');
const P = [
  ['P1', "import { makeRng, SP, SUMMON_NAMES, comboOf, BATTLE } from './core.js';",
    `import { makeRng, SP, SUMMON_NAMES, comboOf, BATTLE } from '${pathToFileURL(path.join(root, 'src/core.js')).href}';\nimport * as BX from '${pathToFileURL(path.join(root, 'src/bestiary.js')).href}';`],
  ['P2', "const comboEv = u => ev('combo', { uid: u.uid, n: u.cname });",
    "const comboEv = u => ev('combo', { uid: u.uid, n: u.cname });\n  const ctx = { S, rng, roster, sideF, turn: 0, alive, allies, foes, buff, shield, deal, summon, hook, ev, has, reg, comboEv };"],
  ['P3a', "if (tg.q.includes('greedy')) amt += 1;", "if (tg.q.includes('greedy')) amt += 1;\n    amt = BX.dmgMod(ctx, src, tg, amt, kind); if (amt <= 0) return;"],
  ['P3b', "hook(tg, 'hurt', { src, kind, had });", "hook(tg, 'hurt', { src, kind, had, n: amt });"],
  ['P4', '    return fired;\n  }\n  function reap', '    if (BX.dispatch(ctx, h, u, c)) fired = true;\n    return fired;\n  }\n  function reap'],
  ['P5a', 'if (!dead.length) return;', 'if (!dead.length) { if (BX.settle(ctx)) continue; return; }'],
  ['P5b', "ev('trig', { uid: u.uid, mk: 'buMie' }); continue; }", "ev('trig', { uid: u.uid, mk: 'buMie' }); continue; }\n        if (BX.saveDeath(ctx, u)) continue;"],
  ['P6', "const order = () =>", "BX.begin(ctx);\n  const order = () =>"],
  ['P7', "ev('turn', { n: turn });", "ev('turn', { n: turn }); ctx.turn = turn;"],
  ['P8', "deal(a, b, ca ? pa * BATTLE.critMul : pa, 'hit', ca); deal(b, a, cb ? pb * BATTLE.critMul : pb, 'hit', cb);",
    "const pa2 = BX.atkMod(ctx, a, pa, b), pb2 = BX.atkMod(ctx, b, pb, a);\n    deal(a, b, ca ? pa2 * BATTLE.critMul : pa2, 'hit', ca && pa2 > 0); deal(b, a, cb ? pb2 * BATTLE.critMul : pb2, 'hit', cb && pb2 > 0);\n    BX.afterClash(ctx, a, b);"],
];
for (const [k, a, b] of P) { const n = src.split(a).length - 1; if (n !== 1) { console.error(`补丁 ${k} 命中 ${n} 次（应为 1）`); process.exit(1); } src = src.replace(a, () => b); }
const { battle } = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
console.log(`== 8 处补丁全部命中，打补丁的引擎已载入`);

// ---------- 2. 回归：旧 12 种 ----------
let reg = 0;
for (let i = 0; i < 1500; i++) {
  const rng = makeRng('reg' + i), p = rng.int(16), ta = genTeam(rng, p), tb = genTeam(rng, p), ma = MARK_KEYS.filter(() => rng() < 0.15);
  const r1 = battleOrig(ta, tb, 'r' + i, ma), r2 = battle(ta, tb, 'r' + i, ma);
  if (r1.winner !== r2.winner || r1.log.length !== r2.log.length || JSON.stringify(r1.log.at(-1).s) !== JSON.stringify(r2.log.at(-1).s)) reg++;
}
console.log(`回归（旧 12 种 1500 场）：与原引擎不一致 ${reg} 场`);
if (reg) fails.push(`回归不一致 ${reg}`);

// ---------- 3. 合并数据（只在内存里） ----------
const NORMAL_NEW = NEW_SPECIES.filter(s => !s.legend);
SPECIES.push(...NORMAL_NEW);                       // 传说不进随机池
NEW_SPECIES.forEach(s => { SP[s.id] = s; });
Object.assign(TRAITS, NEW_TRAITS);
Object.keys(NEW_TRAITS).filter(k => !NEW_TRAITS[k].innate).forEach(k => TRAIT_KEYS.push(k));
const tri = NEW_COMBOS.filter(c => c.need.length > 2), duo = NEW_COMBOS.filter(c => c.need.length <= 2);
COMBOS.unshift(...tri); COMBOS.push(...duo); NEW_COMBOS.forEach(c => { COMBO[c.id] = c; });
Object.assign(SUMMON_NAMES, NEW_SUMMONS);
for (let i = 0; i < 6; i++) POOL_TIERS[i] = [...(POOL_TIERS[i] || []), ...NEW_POOL[i]];
const counts = NEW_POOL.map(p => p.length);
console.log(`合并：物种 ${SPECIES.length} 种进随机池 + 六转仙蛊 ${LEGENDS.length}（共 ${Object.keys(SP).length}）；新蛊按池 ${counts.join('/')}；词条 ${Object.keys(TRAITS).length}（可突变 ${TRAIT_KEYS.length}）；杀招 ${COMBOS.length}`);
const allIds = Object.keys(SP), dupAb = allIds.map(id => SP[id].ab).filter((a, i, arr) => arr.indexOf(a) !== i), dupN = allIds.map(id => SP[id].n).filter((a, i, arr) => arr.indexOf(a) !== i);
if (dupAb.length || dupN.length) fails.push(`重名：简字 ${dupAb.join(',')} 名字 ${dupN.join(',')}`);
for (const s of NEW_SPECIES) { if (!TRAITS[s.t]) fails.push(`${s.n} 词条 ${s.t} 未定义`); }
for (const c of NEW_COMBOS) for (const x of c.need) if (!SP[x]) fails.push(`杀招 ${c.n} 配方 ${x} 不存在`);
// 数据完整性：转数、喂食、流派与克制、蛊方、仙蛊、词条数
const rankOf = id => (SP[id] && SP[id].rank) || (OLD_EXTRA[id] || {}).rank;
for (const s of NEW_SPECIES) {
  if (s.rank !== (s.legend ? 6 : Math.min(5, s.tier + 1))) fails.push(`${s.n} 转数不对`);
  if (!FOODS[s.food] || !s.lore.includes(FOODS[s.food].n)) fails.push(`${s.n} 喂食偏好缺失`);
  if (!SCHOOLS.includes(s.school) || !s.counters?.length || !s.counteredBy?.length || [...s.counters, ...s.counteredBy].some(x => !SCHOOLS.includes(x))) fails.push(`${s.n} 流派/克制缺失`);
  if (s.legend && !s.immortal) fails.push(`${s.n} 仙蛊缺 immortal`);
}
for (const c of NEW_COMBOS) if (!SCHOOLS.includes(c.school) || !c.counters?.length || !c.counteredBy?.length) fails.push(`杀招 ${c.n} 流派/克制缺失`);
for (const id of Object.keys(OLD_EXTRA)) if (!OLD_EXTRA[id].rank || !FOODS[OLD_EXTRA[id].food] || !SCHOOLS.includes(OLD_EXTRA[id].school)) fails.push(`旧蛊 ${id} 补充字段缺失`);
for (const r of NEW_RECIPES) {
  if (!SP[r.out] || SP[r.out].legend) fails.push(`蛊方 ${r.n} 产出不合法`);
  if (r.need.length < 2 || r.need.length > 3) fails.push(`蛊方 ${r.n} 原料数不对`);
  const nr = r.need.map(x => typeof x === 'string' ? rankOf(x) : x.rank);
  if (nr.some(x => !x) || Math.max(...nr) >= rankOf(r.out)) fails.push(`蛊方 ${r.n} 原料转数应低于产物`);
  const sample = r.need.map(x => typeof x === 'string' ? { sp: x } : { sp: Object.keys(SP).find(id => rankOf(id) === x.rank && !r.need.includes(id)) });
  if (META.matchRecipe(sample)?.id !== r.id) fails.push(`蛊方 ${r.n} 匹配不到自己`);
}
if (!META.canOwn([{ sp: 'boar' }], 'guangyin') || META.canOwn([{ sp: 'guangyin' }], 'guangyin') || !META.canOwn([{ sp: 'boar' }], 'boar')) fails.push('仙蛊唯一规则不对');
if (META.feedMul({ sp: 'bfly' }, 'gemini') !== 1.3 || META.feedMul({ sp: 'bfly' }, 'gpt') !== 1 || META.feedMul({ sp: 'boar' }, 'qwen') !== 1.1) fails.push('喂食倍率不对');
const noArt = [...NEW_SPECIES.map(x => x.id), ...Object.keys(NEW_SUMMONS)].filter(id => !ART2[id] || !ART2[id].b); if (noArt.length) fails.push('缺美术：' + noArt.join(','));
const outs = new Set(NEW_RECIPES.map(r => r.out));
console.log(`蛊方 ${NEW_RECIPES.length} 条，产出 ${outs.size} 种（二转 ${[...outs].filter(x => rankOf(x) === 2).length} / 三转 ${[...outs].filter(x => rankOf(x) === 3).length} / 四转 ${[...outs].filter(x => rankOf(x) === 4).length} / 五转 ${[...outs].filter(x => rankOf(x) === 5).length}）；喂食偏好 ${Object.keys(FOODS).map(f => f + ' ' + [...NEW_SPECIES, ...Object.values(OLD_EXTRA)].filter(s => s.food === f).length).join(' / ')}`);

// ---------- 4. 物种同阶胜率 ----------
const sp = {}, cbw = {}, scw = {}, seenTrig = new Set(), seenCombo = new Set(); const turns = []; let draws = 0, capped = 0, nondet = 0, maxEv = 0, overTr = 0;
const tally = (m, k, w) => { (m[k] ||= { n: 0, w: 0 }); m[k].n++; m[k].w += w; };
const scan = log => log.forEach(e => { if (e.t === 'trig' && e.id) seenTrig.add(e.id); if (e.t === 'status') seenTrig.add('status:' + e.k); if (e.t === 'combo') seenCombo.add(e.n); });
for (let i = 0; i < N; i++) {
  const rng = makeRng('bsim' + i), p = rng.int(16);
  const ta = genTeam(rng, p), tb = genTeam(rng, Math.max(0, p + rng.int(3) - 1));
  const ma = MARK_KEYS.filter(() => rng() < 0.15), mb = MARK_KEYS.filter(() => rng() < 0.15);
  if (rng() < 0.3) ta[0].star = 2 + rng.int(2);
  const r = battle(ta, tb, 'bs' + i, ma, mb), r2 = battle(ta, tb, 'bs' + i, ma, mb);
  if (r.winner !== r2.winner || r.log.length !== r2.log.length || JSON.stringify(r.log.at(-1).s) !== JSON.stringify(r2.log.at(-1).s)) nondet++;
  scan(r.log); turns.push(r.turns); if (r.winner === 'draw') draws++; if (r.capped) capped++; maxEv = Math.max(maxEv, r.log.length);
  [[ta, 'A'], [tb, 'B']].forEach(([t, side]) => {
    const w = r.winner === side ? 1 : r.winner === 'draw' ? 0.5 : 0;
    const set = new Set(); t.forEach(g => { set.add(g.sp); g.att.forEach(a => set.add(a)); }); set.forEach(s => tally(sp, s, w));
    const cs = new Set(); t.forEach(g => { const c = comboOf(g); if (c) cs.add(c.id); }); cs.forEach(c => tally(cbw, c, w));
    const ss = new Set(); set.forEach(s => ss.add(SP[s].school || OLD_EXTRA[s].school)); ss.forEach(x => tally(scw, x, w));
    t.forEach(g => { const n = g.tr.length; if (n > 4) overTr++; });
  });
}
turns.sort((a, b) => a - b);
const pc = v => (100 * v.w / v.n).toFixed(1) + '%';
console.log(`\n== ${N} 场随机同阶对战（64 种全池），用时 ${Date.now() - t0}ms`);
console.log(`回合数 中位 ${turns[turns.length >> 1]} / P90 ${turns[Math.floor(turns.length * 0.9)]} / 最大 ${turns.at(-1)}；平局 ${draws}；触发上限 ${capped}；单场最多事件 ${maxEv}；同种子不复现 ${nondet}`);
const tierOf = id => SP[id].tier ?? POOL_TIERS.findIndex(p => p.includes(id));
const TN = ['凡人', '一转', '二转', '三转', '四转', '五转'];
const rows = Object.entries(sp).sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n);
for (let t = 0; t < 6; t++) {
  const r = rows.filter(([id]) => tierOf(id) === t);
  console.log(`[${TN[t]}] ` + r.map(([id, v]) => `${SP[id].n}${NEW_SPECIES.some(s => s.id === id) ? '' : '(旧)'} ${pc(v)}`).join('  '));
}
const out = rows.filter(([, v]) => v.w / v.n < 0.42 || v.w / v.n > 0.60);
console.log(out.length ? '!! 超出 42–60%：' + out.map(([id, v]) => `${SP[id].n} ${pc(v)}(${v.n})`).join('  ') : 'OK：全部物种同阶胜率在 42–60%');
const allRates = rows.map(([, v]) => v.w / v.n);
console.log(`物种胜率区间 ${(100 * Math.min(...allRates)).toFixed(1)}% – ${(100 * Math.max(...allRates)).toFixed(1)}%，最少样本 ${Math.min(...rows.map(r => r[1].n))}`);
if (out.length) fails.push(`物种胜率超标 ${out.length} 种`);
console.log('流派胜率（阵中含该流派）：' + Object.entries(scw).sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n).map(([k, v]) => `${k} ${pc(v)}`).join('  '));
const hiS = Object.entries(scw).filter(([, v]) => v.w / v.n > 0.6); if (hiS.length) fails.push('流派胜率超过 60%：' + hiS.map(x => x[0]).join(','));
const hiC = Object.entries(cbw).filter(([, v]) => v.n >= 100 && v.w / v.n > 0.6);
{ const nat = Object.entries(cbw).filter(([, v]) => v.n >= 30).map(([k, v]) => [COMBO[k].n, v.w / v.n]).sort((a, b) => b[1] - a[1]); console.log(nat.length ? `自然出现的杀招（样本≥30）最高 ${nat.slice(0, 3).map(([n, r]) => n + ' ' + (100 * r).toFixed(1) + '%').join('  ')}` : '自然出现的杀招样本不足 30（64 种蛊里随机配中配方很少），杀招强度以下面的强制测试为准'); }
if (hiC.length) fails.push('自然杀招胜率超过 60%：' + hiC.map(x => COMBO[x[0]].n).join(','));
if (turns.at(-1) >= 40 || capped) fails.push(`回合或触发上限（最大回合 ${turns.at(-1)}，触发上限 ${capped}）`);
if (nondet) fails.push(`同种子不复现 ${nondet}`);

// ---------- 5. 新杀招强制胜率 ----------
const forceGu = (g, need) => { g.sp = need[0]; g.att = need.slice(1); g.tr = [[SP[g.sp].t, SP[g.sp].v]]; g.att.forEach(a => addTrait(g, SP[a].t, SP[a].v, true)); };
const forced = [], badC = []; const M = 600;
const MAXR = 0.60;
for (const c of NEW_COMBOS) {
  let w = 0, hit = 0;
  for (let i = 0; i < M; i++) {
    const rng = makeRng('fc' + c.id + i), p = 2 + rng.int(10);
    const ta = genTeam(rng, p), tb = genTeam(rng, p);
    forceGu(ta[0], c.need); if (comboOf(ta[0])?.id !== c.id) { badC.push(c.n + '→' + comboOf(ta[0])?.n); break; }
    const r = battle(ta, tb, 'f' + i); w += r.winner === 'A' ? 1 : r.winner === 'draw' ? 0.5 : 0;
    if (r.log.some(e => e.t === 'combo' && e.uid === 'a0')) hit++;
    if (r.turns >= 40 || r.capped) fails.push(`杀招 ${c.n} 第 ${i} 场触顶`);
  }
  let wb = 0;   // 对照：同样的阵容，主蛊只换成配方首蛊、不带附蛊
  for (let i = 0; i < M; i++) { const rng = makeRng('fc' + c.id + i), p = 2 + rng.int(10), ta = genTeam(rng, p), tb = genTeam(rng, p); forceGu(ta[0], c.need.slice(0, 1)); const r = battle(ta, tb, 'f' + i); wb += r.winner === 'A' ? 1 : r.winner === 'draw' ? 0.5 : 0; }
  const rate = w / M; forced.push([c, rate, hit / M, wb / M]);
}
console.log(`\n== 新杀招强制胜率（主蛊强行炼成，对同阶随机阵容各 ${M} 场；括号内为本场杀招真正发动的比例）`);
console.log(forced.map(([c, r, h, b]) => `${c.n} ${(100 * r).toFixed(1)}%(发动${(100 * h).toFixed(0)}% 单蛊${(100 * b).toFixed(0)}%)`).join('  '));
const fo = forced.filter(([, r]) => r < 0.45 || r > 0.60);
console.log(fo.length ? '!! 超出 45–60%：' + fo.map(([c, r]) => `${c.n} ${(100 * r).toFixed(1)}%`).join('  ') : 'OK：全部新杀招强制胜率在 45–60%（原目标 45–70%，按策略性守则收紧到不超过 60%）');
if (fo.length) fails.push(`杀招胜率超标 ${fo.length} 个`);
if (badC.length) fails.push('杀招配方被别的配方抢先命中：' + badC.join(','));

// ---------- 6. 传说蛊参考（不进随机池，只看强度别离谱） ----------
const leg = [];
for (const id of LEGENDS) {
  let w = 0; const L = 400;
  for (let i = 0; i < L; i++) {
    const rng = makeRng('lg' + id + i), p = 2 + rng.int(10), ta = genTeam(rng, p), tb = genTeam(rng, p);
    const g = ta[0]; g.sp = id; g.att = []; g.tr = [[SP[id].t, SP[id].v]];
    const r = battle(ta, tb, 'l' + i); w += r.winner === 'A' ? 1 : r.winner === 'draw' ? 0.5 : 0; scan(r.log);
    if (r.turns >= 40 || r.capped) fails.push(`传说 ${SP[id].n} 第 ${i} 场触顶`);
  }
  leg.push([`${SP[id].n} ${(100 * w / L).toFixed(1)}%`, w / L]);
}
console.log(`\n== 六转仙蛊（首蛊换成仙蛊，同阶 400 场）：${leg.map(x => x[0]).join('  ')}`);
const hiL = leg.filter(x => x[1] > 0.6); if (hiL.length) fails.push('仙蛊胜率超过 60%：' + hiL.map(x => x[0]).join(','));
// 光阴回溯专项：A 队首蛊是光阴蝉，统计回溯发动后翻盘的比例
{ let fired = 0, won = 0;
  for (let i = 0; i < 600; i++) { const rng = makeRng('gy' + i), p = 2 + rng.int(10), ta = genTeam(rng, p), tb = genTeam(rng, p + 3); const g = ta[0]; g.sp = 'guangyin'; g.att = []; g.tr = [['rewind', 1]];
    const r = battle(ta, tb, 'gy' + i); if (r.log.some(e => e.t === 'trig' && e.id === 'rewind')) { fired++; if (r.winner === 'A') won++; } }
  console.log(`光阴回溯专项（对手高 3 阶，600 场）：发动 ${fired} 次，发动后翻盘 ${won} 次（${fired ? (100 * won / fired).toFixed(0) : 0}%）`); }

// ---------- 7. 触发覆盖 ----------
const modOnly = new Set(['scale', 'execute', 'bulwark', 'aegis', 'sunder', 'blitz', 'rewind', 'regrow', 'phoenix']);
const never = Object.keys(NEW_TRAITS).filter(k => !seenTrig.has(k) && !modOnly.has(k));
console.log(`\n词条触发覆盖：${never.length ? '!! 从未触发 ' + never.join(',') : '全部会发事件的新词条都触发过'}；状态事件 ${[...seenTrig].filter(k => k.startsWith('status:')).map(k => k.slice(7)).join('/')}`);
if (never.length) fails.push('词条从未触发：' + never.join(','));
const forcedHitLow = forced.filter(([, , h]) => h < 0.15).map(([c]) => c.n);
if (forcedHitLow.length) console.log('!! 强制测试里很少发动的杀招：' + forcedHitLow.join(','));

// ---------- 8. meta 钩子（确定性） ----------
{ const mk = (sp, att = []) => ({ sp, att, tr: [], q: [] });
  const team = [mk('jinchan', ['qingfu']), mk('gold'), mk('cricket'), mk('guangyin')];
  const a = [META.winBonus(team), META.refreshDiscount(team), META.sellBonus(team[0]), META.sellBonus(mk('dung'))].join();
  const b = [META.winBonus(team), META.refreshDiscount(team), META.sellBonus(team[0]), META.sellBonus(mk('dung'))].join();
  META.onAcquire(team[3]); META.onTribWin(team); META.onTribWin(team); META.onTribWin(team);
  const s1 = META.tribFailSave(team), s2 = META.tribFailSave(team), s3 = META.tribFailSave(team), s4 = META.tribFailSave(team);
  const ok = a === b && a === '4,1,3,1' && team[3].tui === 0 && s1 && s2 && s3 && !s4;
  console.log(`meta 钩子：胜利/转市/卖价 = ${a}；蜕 1+3 层封顶 3，褪三次后无蜕 → ${ok ? 'OK' : 'FAIL'}`);
  if (!ok) fails.push('meta 钩子不符预期'); }

if (fails.length) { console.error('\nFAIL:\n- ' + fails.slice(0, 20).join('\n- ')); process.exit(1); }
console.log(`\nPASS（总用时 ${((Date.now() - t0) / 1000).toFixed(1)}s）`);
