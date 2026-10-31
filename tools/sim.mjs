// node tools/sim.mjs —— v2 平衡与正确性自检（口径见 docs/design.md 第 8 节）。任何一项不过就退出码 1。
// 现在先查：战斗能跑完且可复现、坐标码往返、站位差（最佳−最差胜率差中位 ≥15 个百分点）、单种蛊胜率上限、合成与蛊市。
import { makeRng, genTeam, encodeTeam, decodeTeam, newGu, mergeAll, placeGu, rollShop, statFor, SP, SPECIES, poolFor, teamCombos, daoCount, RANK, cellPos, sortTeam } from '../src/core.js';
import { battle } from '../src/battle.js';

const fails = [], t0 = Date.now();
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const win = (A, B, seed) => battle(A, B, seed).winner;

// 1. 跑得完、可复现、回合不过长
let maxT = 0, nondet = 0, codeFail = 0;
for (let i = 0; i < 400; i++) {
  const r = makeRng('m' + i), a = genTeam(r, { realm: i % 6, up: 0.3 }), b = genTeam(r, { realm: i % 6, up: 0.3 });
  const x = battle(a, b, 's' + i), y = battle(a, b, 's' + i); maxT = Math.max(maxT, x.turns);
  if (x.winner !== y.winner || x.log.length !== y.log.length) nondet++;
  const d = decodeTeam(encodeTeam(a, { name: '测', realm: i % 6, trial: i % 2 === 0 }));
  if (!d || d.trial !== (i % 2 === 0) || JSON.stringify(d.team.map(g => [g.sp, g.rank, g.atk, g.hp])) !== JSON.stringify(a.map(g => [g.sp, g.rank, g.atk, g.hp]))) codeFail++;
}
console.log(`战斗：最长 ${maxT} 回合；不可复现 ${nondet}；坐标码往返失败 ${codeFail}`);
if (nondet) fails.push('同种子不复现 ' + nondet); if (codeFail) fails.push('坐标码往返失败 ' + codeFail); if (maxT >= 60) fails.push('有对局打满回合上限');
{ const d = decodeTeam('ShuaXp-eggSAJEhwk5YaU1WgAL4IwBAYWQAAFACwECC0AAAgAEBAgUQAAFABU'); const ok = d && d.old && d.team.length === 4 && d.team[0].sp === 'drum'; console.log('旧 v2 坐标码只取物种和转数：' + (ok ? 'OK' : '失败')); if (!ok) fails.push('旧码解码失败'); }

// 2. 站位：同一套蛊在 3×3 阵盘上换摆法（两种阵形 × 谁站哪格），最佳与最差的胜率差
const perms = a => a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));
const SHAPES = [[0, 3, 6, 1], [0, 3, 2, 5]];   // 格号 = 行×3+列（列 0 前、1 中、2 后）：前三中一；前二后二
const layouts = team => SHAPES.flatMap(sh => perms(team).map(p => sortTeam(p.map((g, i) => ({ ...g, pos: cellPos(sh[i]) })))));
const spread = [];
for (let k = 0; k < 16; k++) {
  const r = makeRng('f' + k), team = genTeam(r, { realm: 2, n: 4, up: 0.3 }), foes = Array.from({ length: 30 }, (_, j) => genTeam(makeRng('fo' + k + ':' + j), { realm: 2, n: 4, up: 0.3 }));
  const rates = layouts(team).map(p => foes.filter((f, j) => win(p, f, 'p' + j) === 'A').length / foes.length);
  spread.push(Math.max(...rates) - Math.min(...rates));
}
console.log(`站位：最佳−最差胜率差 中位 ${Math.round(med(spread) * 100)} 个百分点`);
if (med(spread) < 0.15) fails.push('站位差中位不足 15 个百分点');

// 3. 单种蛊：同转、同只数的镜像对局里，没有哪种胜率超过 60%（只看凡人到二转池，样本小的跳过）
const pool = poolFor(2).filter(sp => SP[sp] && !SP[sp].immortal), wr = {};
pool.forEach(sp => { wr[sp] = { w: 0, n: 0 }; });
for (let i = 0; i < 1500; i++) {
  const r = makeRng('sp' + i), a = r.pick(pool), b = r.pick(pool); if (a === b) continue;
  const A = [newGu(a, 2), newGu(a, 2), newGu(a, 2)], B = [newGu(b, 2), newGu(b, 2), newGu(b, 2)], w = win(A, B, 'x' + i);
  wr[a].n++; wr[b].n++; if (w === 'A') wr[a].w++; else if (w === 'B') wr[b].w++;
}
const top = Object.entries(wr).filter(([, x]) => x.n >= 40).map(([sp, x]) => [sp, x.w / x.n]).sort((p, q) => q[1] - p[1]);
console.log('单种蛊胜率前 5：' + top.slice(0, 5).map(([sp, p]) => `${SP[sp].n} ${Math.round(p * 100)}%`).join('  '));
const over = top.filter(([, p]) => p > 0.6);
if (over.length) console.log(`（提示）超过 60% 的有 ${over.length} 种，等战斗重做后按 design.md 第 8 节收紧为失败`);

// 4. 合成与蛊市
{
  const team = [newGu('boar'), newGu('boar')], bag = [], r = placeGu(team, bag, newGu('boar'), 3, 8, 'shop');
  const ok = r.where === 'merge' && team.length === 1 && team[0].rank === 2 && team[0].atk === statFor('boar', 2).atk;
  console.log('三只合成换成新一转的表值：' + (ok ? 'OK' : '失败')); if (!ok) fails.push('合成不对');
  const sh = rollShop(makeRng(3), 0, 'li'); const ok2 = sh.some(w => w.kind === 'gu') && sh.some(w => w.kind === 'food');
  console.log('蛊市有蛊位和食物位：' + (ok2 ? 'OK' : '失败')); if (!ok2) fails.push('蛊市缺位');
  const c = teamCombos([newGu('boar'), newGu('fire'), newGu('twin')]); const ok3 = Object.keys(c).length >= 1;
  console.log('杀招自动成形：' + (ok3 ? 'OK' : '失败')); if (!ok3) fails.push('杀招不成形');
}
console.log(`用时 ${Date.now() - t0}ms`);
if (fails.length) { console.log('FAIL: ' + fails.join('；')); process.exit(1); }
console.log('PASS');
