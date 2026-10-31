// node tools/bestiary-sim.mjs [场数] [--quick]  —— 蛊典（64 种蛊）的平衡与区分度闸门，用集成后的真实 core.js / battle.js。任何一项不达标 exit(1)
// 1. 数据：本命独有、觉醒齐全、副词条/教授/重复表合法、蛊方、仙蛊唯一、喂食、美术、旧 v2 坐标码能读
// 2. 突变去同质化：三选一不给本命和重复词条、尽量不同道；随机养成后同一只蛊身上没有重复副词条
// 3. 同阶胜率：物种 42–60%、流派 ≤60%、自然杀招 ≤60%；死循环 / 回合上限 / 同种子复现
// 4. 杀招强制胜率 45–60%（敌方首蛊是同一主蛊、同样副词条但没炼成杀招）；六转仙蛊 ≤60%；光阴回溯专项
// 5. 区分度：替换敏感度（同攻血换物种，一转 / 五转各测，平均 ≥ 8 个百分点）+ 本命占比（伤害与效果占比、关掉本命后的胜率差，五转不低于一转）
// 6. 触发覆盖、meta 钩子
import * as core from '../src/core.js';
import { battle } from '../src/battle.js';
import * as BXmod from '../src/bestiary.js';
import { ART2 } from '../src/art2.js';
const { makeRng, genTeam, comboOf, SP, SPECIES, NORMAL_SPECIES, TRAITS, TRAIT_KEYS, COMBOS, COMBO, POOL_TIERS, addTrait, MARK_KEYS, decodeTeam, encodeTeam, natOf, guRank, awOf, subOk, nodeChoices, applyNode, mkNode, NODES, nodeOk, newGu, poolFor, slotCap, cleanTr } = core;
const { NEW_SPECIES, NEW_TRAITS, NEW_COMBOS, NEW_SUMMONS, LEGENDS, META, NEW_RECIPES, SCHOOLS, OLD_EXTRA } = BXmod;

const QUICK = process.argv.includes('--quick'), N = +process.argv.find(a => /^\d+$/.test(a)) || (QUICK ? 3000 : 8000);
const t0 = Date.now(), fails = [], warn = [];
const score = r => r.winner === 'A' ? 1 : r.winner === 'draw' ? 0.5 : 0;
const pct = x => (100 * x).toFixed(1) + '%';

// ---------- 1. 数据 ----------
const allIds = Object.keys(SP);
if (SPECIES.length !== 64 || NORMAL_SPECIES.length !== 61) fails.push(`物种数 ${SPECIES.length}/${NORMAL_SPECIES.length}，应为 64/61`);
const nats = SPECIES.map(s => s.nat), dupNat = nats.filter((k, i) => nats.indexOf(k) !== i);
if (dupNat.length || nats.some(k => !TRAITS[k] || !TRAITS[k].nat)) fails.push('本命不独有或缺失：' + dupNat.join(','));
for (const s of SPECIES) {
  const t = TRAITS[s.nat];
  if (!t || !Array.isArray(t.aw) || t.aw.length !== 2 || t.aw.some(x => !x)) fails.push(`${s.n} 觉醒不全`);
  if (!s.sub || !TRAIT_KEYS.includes(s.sub)) fails.push(`${s.n} 教授词条 ${s.sub} 不是副词条`);
  if ((s.dup || []).some(k => !TRAIT_KEYS.includes(k))) fails.push(`${s.n} 重复表有非副词条`);
}
if (TRAIT_KEYS.some(k => TRAITS[k].innate || !TRAITS[k].dao)) fails.push('突变池里混进了本命，或副词条缺道');
const chs = Object.values(TRAITS).map(t => t.ch), dupCh = chs.filter((c, i) => chs.indexOf(c) !== i); if (dupCh.length) fails.push('词条简字重复：' + dupCh.join(''));
const dupAb = allIds.map(id => SP[id].ab).filter((a, i, arr) => arr.indexOf(a) !== i), dupN = allIds.map(id => SP[id].n).filter((a, i, arr) => arr.indexOf(a) !== i);
if (dupAb.length || dupN.length) fails.push(`重名：简字 ${dupAb.join(',')} 名字 ${dupN.join(',')}`);
for (const c of COMBOS) for (const x of c.need) if (!SP[x]) fails.push(`杀招 ${c.n} 配方 ${x} 不存在`);
if (POOL_TIERS.length !== 6 || POOL_TIERS.flat().some(id => SP[id].immortal)) fails.push('蛊池不是 6 档或混进了仙蛊');
const rankOf = id => SP[id] && SP[id].rank;
for (const s of SPECIES) { if (!SCHOOLS.includes(s.school)) fails.push(`${s.n} 流派缺失`); }
for (const r of NEW_RECIPES) {
  if (!SP[r.out] || SP[r.out].immortal) fails.push(`蛊方 ${r.n} 产出不合法`);
  const nr = r.need.map(x => typeof x === 'string' ? rankOf(x) : x.rank); if (nr.some(x => !x) || Math.max(...nr) >= rankOf(r.out)) fails.push(`蛊方 ${r.n} 原料转数应低于产物`);
  const sample = r.need.map(x => typeof x === 'string' ? { sp: x } : { sp: allIds.find(id => rankOf(id) === x.rank && !r.need.includes(id)) });
  if (META.matchRecipe(sample)?.id !== r.id) fails.push(`蛊方 ${r.n} 匹配不到自己`);
}
if (!META.canOwn([{ sp: 'boar' }], 'guangyin') || META.canOwn([{ sp: 'guangyin' }], 'guangyin')) fails.push('仙蛊唯一规则不对');
const noArt = [...NEW_SPECIES.map(x => x.id), ...Object.keys(NEW_SUMMONS)].filter(id => !ART2[id] || !ART2[id].b); if (noArt.length) fails.push('缺美术：' + noArt.join(','));
// 转数与觉醒：物种基础转数 + 每星两转
if (guRank({ sp: 'boar', star: 1 }) !== 1 || guRank({ sp: 'boar', star: 2 }) !== 3 || guRank({ sp: 'boar', star: 3 }) !== 5 || awOf({ sp: 'boar', star: 2 }) !== 1 || awOf({ sp: 'dfly' }) !== 2 || guRank({ sp: 'guangyin' }) !== 6) fails.push('转数/觉醒推算不对');
// 旧 v2 坐标码（主线 fe7cb9b 生成）：新 core 照样能读，与本命重复的旧词条被清掉
const V2 = [['SZuaXp-eggYgACQoRwoAALAQwEBCdpAAAUAHAgMUNoAACgAA', 'boar,bone,queen', 'xianSheng,shiJing'],
  ['ShuaXp-eggaHGDhMj9e-bQAEQIGAQQTtIAAAAA4ECjhtVAAAQCJAQYMoAACgAe', 'bone,bone,queen,drum', 'buMie,shaZhao,qunGu,heLian,shiJing'],
  ['SZuaXp-eggZLXGiUkd5c7JkABuDAQIGCCAAAoAKCAYVQAAFAAY', 'queen,fire,mantis', 'luKou,buMie,shaZhao,fanShi,yiZe,shiJing']];
for (const [code, sps, mk] of V2) { const d = decodeTeam(code); if (!d || d.team.map(g => g.sp).join() !== sps || d.marks.join() !== mk || d.team.some(g => g.tr.some(([k]) => !subOk(g, k)))) fails.push('旧 v2 码读不回：' + code.slice(0, 12)); }
console.log(`== 数据：物种 ${SPECIES.length}（随机池 ${NORMAL_SPECIES.length}），本命 ${new Set(nats).size} 个各不相同，副词条 ${TRAIT_KEYS.length} 个分属 ${new Set(TRAIT_KEYS.map(k => TRAITS[k].dao)).size} 道，杀招 ${COMBOS.length}，蛊方 ${NEW_RECIPES.length}`);

// ---------- 2. 突变去同质化 ----------
{ let bad = 0, offers = 0, diverse = 0, dupHold = 0;
  for (let i = 0; i < 2000; i++) {
    const rng = makeRng('mut' + i), sp = rng.pick(SPECIES).id, g = newGu(sp); for (let k = 0; k < rng.int(3); k++) core.mutateGu(g, rng);
    const opts = nodeChoices({ type: 'mutate' }, [g], rng) || []; offers++;
    if (opts.some(k => !subOk(g, k) || TRAITS[k].innate)) bad++;
    if (new Set(opts.map(k => TRAITS[k].dao)).size === opts.length) diverse++;
  }
  for (let i = 0; i < 400; i++) { const t = genTeam(makeRng('hold' + i), 30); for (const g of t) { const ks = g.tr.map(x => x[0]); if (new Set(ks).size !== ks.length || ks.some(k => !subOk(g, k))) dupHold++; } }
  console.log(`突变三选一 ${offers} 次：给出本命或重复词条 ${bad} 次；三个选项分属不同的道 ${pct(diverse / offers)}；随机养成后蛊身上重复/违规副词条 ${dupHold}`);
  if (bad || dupHold) fails.push(`突变去同质化不达标（违规选项 ${bad}，违规持有 ${dupHold}）`);
  if (diverse / offers < 0.9) fails.push('三选一来自不同道的比例低于 90%'); }

// ---------- 3. 同阶胜率 ----------
const sp = {}, cbw = {}, scw = {}, seenTrig = new Set(); const turns = []; let draws = 0, capped = 0, nondet = 0, maxEv = 0;
const tally = (m, k, w) => { (m[k] ||= { n: 0, w: 0 }); m[k].n++; m[k].w += w; };
const scan = log => log.forEach(e => { if (e.t === 'trig' && e.id) seenTrig.add(e.id); if (e.t === 'status') seenTrig.add('status:' + e.k); });
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
    const ss = new Set(); set.forEach(s => ss.add(SP[s].school)); ss.forEach(x => tally(scw, x, w));
  });
}
turns.sort((a, b) => a - b);
const pc = v => pct(v.w / v.n);
console.log(`\n== ${N} 场随机同阶对战（64 种全池），用时 ${Date.now() - t0}ms`);
console.log(`回合数 中位 ${turns[turns.length >> 1]} / P90 ${turns[Math.floor(turns.length * 0.9)]} / 最大 ${turns.at(-1)}；平局 ${draws}；触发上限 ${capped}；单场最多事件 ${maxEv}；同种子不复现 ${nondet}`);
const tierOf = id => POOL_TIERS.findIndex(p => p.includes(id)), TN = ['凡人', '一转', '二转', '三转', '四转', '五转'];
const rows = Object.entries(sp).sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n);
for (let t = 0; t < 6; t++) console.log(`[${TN[t]}池] ` + rows.filter(([id]) => tierOf(id) === t).map(([id, v]) => `${SP[id].n} ${pc(v)}`).join('  '));
const MINS = 600, out = rows.filter(([, v]) => v.n >= MINS && (v.w / v.n < 0.42 || v.w / v.n > 0.60));
if (rows.some(([, v]) => v.n < MINS)) warn.push(`有物种样本少于 ${MINS}，胜率只作参考`);
const allRates = rows.map(([, v]) => v.w / v.n);
console.log(out.length ? '!! 超出 42–60%：' + out.map(([id, v]) => `${SP[id].n} ${pc(v)}`).join('  ') : `OK：全部物种同阶胜率在 42–60%（${pct(Math.min(...allRates))} – ${pct(Math.max(...allRates))}）`);
if (out.length) fails.push(`物种胜率超标 ${out.length} 种`);
console.log('流派胜率：' + Object.entries(scw).sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n).map(([k, v]) => `${k} ${pc(v)}`).join('  '));
const hiS = Object.entries(scw).filter(([, v]) => v.w / v.n > 0.6); if (hiS.length) fails.push('流派胜率超过 60%：' + hiS.map(x => x[0]).join(','));
const hiC = Object.entries(cbw).filter(([, v]) => v.n >= 100 && v.w / v.n > 0.6); if (hiC.length) fails.push('自然杀招胜率超过 60%：' + hiC.map(x => COMBO[x[0]].n).join(','));
if (turns.at(-1) >= 40 || capped) fails.push(`回合或触发上限（最大回合 ${turns.at(-1)}，触发上限 ${capped}）`);
if (nondet) fails.push(`同种子不复现 ${nondet}`);

// ---------- 4. 杀招强制胜率、仙蛊 ----------
const forceGu = (g, need) => { g.sp = need[0]; g.att = need.slice(1); g.tr = []; g.att.forEach(a => addTrait(g, SP[a].sub, 1, true)); };
const M = QUICK ? 300 : 600, forced = [], badC = [];
for (const c of COMBOS) {
  let w = 0, hit = 0;
  for (let i = 0; i < M; i++) {
    const rng = makeRng('fc' + c.id + i), p = 2 + rng.int(10), ta = genTeam(rng, p), tb = genTeam(rng, p);
    forceGu(ta[0], c.need); if (comboOf(ta[0])?.id !== c.id) { badC.push(c.n + '→' + comboOf(ta[0])?.n); break; }
    // 对照：敌方首蛊换成同一主蛊、同样的副词条，只是没炼成杀招 → 胜率只反映杀招本身
    forceGu(tb[0], [c.need[0]]); ta[0].tr.forEach(([k, l]) => addTrait(tb[0], k, l, true));
    const r = battle(ta, tb, 'f' + i); w += score(r); if (r.log.some(e => e.t === 'combo' && e.uid === 'a0')) hit++;
    if (r.turns >= 40 || r.capped) fails.push(`杀招 ${c.n} 第 ${i} 场触顶`);
  }
  forced.push([c, w / M, hit / M]);
}
console.log(`\n== 杀招强制胜率（主蛊强行炼成，对面首蛊是同主蛊同副词条的对照，各 ${M} 场）`);
console.log(forced.map(([c, r, h]) => `${c.n} ${pct(r)}${h < 0.15 ? '(少发动)' : ''}`).join('  '));
const fo = forced.filter(([, r]) => r < 0.45 || r > 0.60);
console.log(fo.length ? '!! 超出 45–60%：' + fo.map(([c, r]) => `${c.n} ${pct(r)}`).join('  ') : 'OK：全部杀招强制胜率在 45–60%');
if (fo.length) fails.push(`杀招胜率超标 ${fo.length} 个`); if (badC.length) fails.push('杀招配方被别的配方抢先命中：' + badC.join(','));
const leg = [];
for (const id of LEGENDS) {
  let w = 0; const L = 400;
  for (let i = 0; i < L; i++) { const rng = makeRng('lg' + id + i), p = 2 + rng.int(10), ta = genTeam(rng, p), tb = genTeam(rng, p); const g = ta[0]; g.sp = id; g.att = []; g.tr = []; const r = battle(ta, tb, 'l' + i); w += score(r); scan(r.log); if (r.turns >= 40 || r.capped) fails.push(`仙蛊 ${SP[id].n} 触顶`); }
  leg.push([`${SP[id].n} ${pct(w / L)}`, w / L]);
}
console.log(`== 六转仙蛊（首蛊换成仙蛊，同阶 400 场）：${leg.map(x => x[0]).join('  ')}`);
const hiL = leg.filter(x => x[1] > 0.6); if (hiL.length) fails.push('仙蛊胜率超过 60%：' + hiL.map(x => x[0]).join(','));

// ---------- 5. 区分度：替换敏感度与本命占比 ----------
// 阶段阵容：一转 = 凡人+一转池、10–17 个养成节点、全 ★1；五转 = 全池、60–89 个节点、★1/2/3 = 40/35/25%（升星照合炼加攻血）
function stageTeam(rng, realm) {
  const pool = poolFor(realm), cap = slotCap(realm), power = realm >= 5 ? 60 + rng.int(30) : 10 + rng.int(8), team = [newGu(rng.pick(pool))];
  for (let i = 0; i < power; i++) {
    const types = Object.keys(NODES).filter(t => nodeOk(t, team, cap)), t = team.length < 3 && types.includes('summon') && rng() < 0.6 ? 'summon' : rng.pick(types), node = mkNode(t, rng);
    const opt = { cap, wuhuo: rng() < 0.1 }; if (t === 'summon') opt.pick = rng.pick(pool); if (t === 'mutate') { const o = nodeChoices(node, team, rng, realm); if (o && o.length) opt.pick = rng.pick(o); }
    applyNode(team, node, rng, opt);
  }
  while (team.length < Math.min(3, cap)) team.push(newGu(rng.pick(pool)));
  if (realm >= 5) team.forEach(g => { const x = rng(); g.star = x < 0.4 ? 1 : x < 0.75 ? 2 : 3; g.atk += 3 * (g.star - 1) + 5; g.hp += 4 * (g.star - 1) + 5; });
  else team.forEach(g => { g.atk += 1; g.hp += 1; });
  return core.arrangeTeam(team);
}
const clone = t => t.map(g => ({ ...g, tr: g.tr.map(x => [...x]), q: [...g.q], att: [...g.att] }));
function stageStats(realm) {
  const K = QUICK ? 24 : 40, F = QUICK ? 20 : 30, SEEDS = 4, SUBS = 3, pool = poolFor(realm);
  const deltas = [], abl = []; let dN = 0, dAll = 0, eN = 0, eAll = 0;
  for (let k = 0; k < K; k++) {
    const rng = makeRng(`st${realm}:${k}`), A = stageTeam(rng, realm), foes = Array.from({ length: F }, (_, j) => stageTeam(makeRng(`sf${realm}:${k}:${j}`), realm));
    const wr = (T, log) => { let w = 0; foes.forEach((f, j) => { for (let s = 0; s < SEEDS; s++) { const r = battle(T, f, `ss${realm}:${k}:${j}:${s}`); w += score(r); if (log) for (const e of r.log) { const v = e.t === 'dmg' ? e.n : e.t === 'buff' ? Math.abs(e.a || 0) + (e.h || 0) + (e.sh || 0) : 0; if (!v) continue; if (e.t === 'dmg') { dAll += v; if (e.nat) dN += v; } eAll += v; if (e.nat) eN += v; } } }); return w / (F * SEEDS); };
    const base = wr(A, true);
    for (let s = 0; s < SUBS; s++) {
      const B = clone(A), j = rng.int(B.length), cur = B[j].sp, alt = pool.filter(x => x !== cur && !(B[j].att || []).includes(x));
      B[j].sp = rng.pick(alt); cleanTr(B[j]); deltas.push(Math.abs(wr(B) - base));
    }
    const C = clone(A); C.forEach(g => { g.noNat = 1; }); abl.push(base - wr(C));
  }
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length, sd = a => Math.sqrt(mean(a.map(x => (x - mean(a)) ** 2)));
  return { sens: mean(deltas), sensSe: sd(deltas) / Math.sqrt(deltas.length), dmgShare: dN / Math.max(1, dAll), effShare: eN / Math.max(1, eAll), abl: mean(abl), n: deltas.length };
}
const S1 = stageStats(1), S5 = stageStats(5);
console.log(`\n== 区分度（每次替换 ${QUICK ? 80 : 120} 场，同一批对手与种子）`);
for (const [nm, s] of [['一转', S1], ['五转', S5]]) console.log(`[${nm}] 替换敏感度 平均 ${(100 * s.sens).toFixed(1)} 个百分点（±${(100 * s.sensSe).toFixed(1)}，${s.n} 次替换）；本命占比：伤害 ${pct(s.dmgShare)}、伤害+增益+护体 ${pct(s.effShare)}；关掉本命后胜率掉 ${(100 * s.abl).toFixed(1)} 个百分点`);
if (S1.sens < 0.08 || S5.sens < 0.08) fails.push(`替换敏感度不足 8 个百分点（一转 ${(100 * S1.sens).toFixed(1)}，五转 ${(100 * S5.sens).toFixed(1)}）`);
if (S5.abl < S1.abl) fails.push(`五转时本命对胜负的贡献（${(100 * S5.abl).toFixed(1)}）低于一转（${(100 * S1.abl).toFixed(1)}）`);

// ---------- 6. 触发覆盖、meta ----------
const modOnly = new Set(['scale', 'execute', 'bulwark', 'aegis', 'sunder', 'blitz', 'luck', 'rewind', 'cocoon']);
const never = Object.keys(NEW_TRAITS).filter(k => !seenTrig.has(k) && !modOnly.has(k));
console.log(`\n词条触发覆盖：${never.length ? '!! 从未触发 ' + never.join(',') : '全部会发事件的词条都触发过'}`);
if (never.length) fails.push('词条从未触发：' + never.join(','));
{ const mk = (sp, att = []) => ({ sp, att, tr: [], q: [] }), team = [mk('jinchan', ['qingfu']), mk('gold'), mk('cricket'), mk('guangyin')];
  const a = [META.winBonus(team), META.refreshDiscount(team), META.sellBonus(team[0]), META.sellBonus(mk('dung'))].join();
  META.onAcquire(team[3]); META.onTribWin(team); META.onTribWin(team); META.onTribWin(team);
  const s1 = META.tribFailSave(team), s2 = META.tribFailSave(team), s3 = META.tribFailSave(team), s4 = META.tribFailSave(team);
  if (!(a === '4,1,3,1' && team[3].tui === 0 && s1 && s2 && s3 && !s4)) fails.push('meta 钩子不符预期'); }

if (warn.length) console.log('提示：' + warn.join('；'));
if (fails.length) { console.error('\nFAIL:\n- ' + fails.slice(0, 20).join('\n- ')); process.exit(1); }
console.log(`\nPASS（总用时 ${((Date.now() - t0) / 1000).toFixed(1)}s）`);
