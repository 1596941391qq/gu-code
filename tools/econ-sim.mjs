// node tools/econ-sim.mjs —— 元气价格自检（真实 token 画像）：中位数玩家一天能养出几只五转、新手第一个小时买得起什么
// 调参：PRICE='{"gu":20,"refresh":8}' node tools/econ-sim.mjs（只改这次运行，不写回 core.js）
// 画像：插件的元气 = 算力当量（缓存读取按 0.1 折算）。hacking 近 14 天：活跃分钟中位 21.4 万/分钟，中位日 8350 万、343 活跃分钟。
//   「中位数玩家」按每天 120 活跃分钟算（约 2570 万），「轻度」30 分钟；hacking 自己的中位日单列。
// 养五转的玩家模型（蛊市贪心）：只买当前能买到的最高一档原生蛊（或高两档，取便宜的那种）；已有同种同转的必买，
//   没有的在空位够时开新的一摞；买不下就转市。五转一出来就记一只、拿走，接着养下一只，取平均（稳定状态，零头留到下一只）。
//   空位 = 蛊囊 8 格 + 空窍里闲着的 4 格。不冻结、不卖、不算罗盘偏向和秘境掉落（掉落另算，见「首领必掉」）。
import { PRICE, guCost, sellValue, rollShop, baseRank, makeRng, SP, RANK, BAG } from '../src/core.js';
import { FOODS } from '../src/foods.js';
import * as T from '../src/trip.js';
if (process.env.PRICE) Object.assign(PRICE, JSON.parse(process.env.PRICE));
let bad = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) bad++; };
const UNIT = 8000, PER_MIN = 213782;
const PROFILES = [{ k: 'light', n: '轻度（30 活跃分钟）', min: 30 }, { k: 'mid', n: '中位数玩家（120 活跃分钟）', min: 120 }, { k: 'hk', n: 'hacking 实测中位日（343 分钟）', tok: 83.5e6 }];
const dayUnits = p => (p.tok || p.min * PER_MIN) / UNIT;
const kq = n => n >= 1e8 ? (n / 1e8).toFixed(2) + ' 亿' : n >= 1e4 ? (n / 1e4).toFixed(0) + ' 万' : String(Math.round(n));
const tok = u => kq(u * UNIT);
const mins = u => (u * UNIT / PER_MIN).toFixed(u * UNIT / PER_MIN < 10 ? 1 : 0) + ' 分钟';

// 一趟秘境的路程（走中间那格的平均值，按境界各取 20 张图）
function walkOf(realm) { let s = 0; const N = 20; for (let i = 0; i < N; i++) s += T.tripMap('econ' + i, realm).reduce((a, row) => a + row.rooms.reduce((x, y) => x + y.cost, 0) / row.rooms.length, 0); return s / N; }

// 蛊市贪心养五转：返回每只五转平均花多少（千）
function raise(realm, tiers = 1, n = realm >= 3 ? 60 : 12, seed = 'econ') {
  const rng = makeRng(`${seed}:${realm}:${tiers}`), top = Math.min(4, realm), want = b => b - 1 > top - tiers && b - 1 <= top;
  // 同时养几种：一摞从原生 b 转合到五转，最多同时占 2×(5−b) 格，空位够几摞就养几种（至少一种）；正在养的那几种见了就买
  const cap = BAG.cap + 4, inv = new Map(), lanes = b => Math.max(1, Math.floor(cap / (2 * Math.max(1, RANK.max - b)))); let gu = 0, rf = 0, refreshes = 0, buys = 0, five = 0, guard = 0;
  const live = () => new Set([...inv].filter(([, v]) => v > 0).map(([k]) => k.split(':')[0]));
  const add = (sp, r) => {
    const k = sp + ':' + r; inv.set(k, (inv.get(k) || 0) + 1);
    if (inv.get(k) >= 3) { inv.set(k, 0); if (r + 1 >= RANK.max) five++; else add(sp, r + 1); }
  };
  while (five < n && guard++ < 400000) {
    const shop = rollShop(rng, realm, null, [], null).filter(w => w.kind === 'gu');
    for (const w of shop) {
      const b = baseRank(w.sp); if (!want(b)) continue;
      if (b >= RANK.max) { gu += guCost(w.sp); buys++; five++; continue; }
      const on = live(); if (!on.has(w.sp) && on.size >= lanes(b)) continue;
      gu += guCost(w.sp); buys++; add(w.sp, b);
      if (five >= n) break;
    }
    rf += PRICE.refresh; refreshes++;
  }
  return { per: (gu + rf) / five, gu: gu / five, rf: rf / five, refreshes: refreshes / five, buys: buys / five };
}

console.log(`# 价格（千，×${UNIT} = 元气）：一转蛊 ${PRICE.gu}（${tok(PRICE.gu)}），原生每高一转 ×${PRICE.rankK}；转市 ${PRICE.refresh}；卖一转 ${PRICE.sell}；食物每档 ${PRICE.food}`);
console.log('  原生转数的买价：' + [1, 2, 3, 4, 5].map(r => `${RANK.names[r]} ${PRICE.gu * Math.pow(PRICE.rankK, r - 1)}（${mins(PRICE.gu * Math.pow(PRICE.rankK, r - 1))}）`).join(' / '));
console.log('  食物：' + [...new Set(FOODS.map(f => f.cost))].sort((a, b) => a - b).map(c => `${c} 档 ${c * PRICE.food}`).join(' / '));

console.log('\n# 1 养一只五转要多少元气（蛊市贪心，稳定状态）');
const per = [];
for (let r = 0; r <= 4; r++) {
  const a = raise(r, 1), b = r ? raise(r, 2) : a, best = a.per <= b.per ? a : b;
  per[r] = best.per;
  console.log(`  境界 ${r}（买原生${RANK.names[Math.min(5, r + 1)]}${best === b && r ? '和低一档' : ''}）：${Math.round(best.per)} 千 = ${tok(best.per)} ≈ 中位流速 ${mins(best.per)}；其中买蛊 ${Math.round(best.gu)}、转市 ${best.refreshes.toFixed(1)} 次 ${Math.round(best.rf)}`);
}

console.log('\n# 2 一趟秘境的路程');
const walk = [0, 1, 2, 3, 4].map(walkOf);
console.log('  ' + walk.map((w, r) => `境界 ${r} ${Math.round(w)} 千（${mins(w)}）`).join(' / '));

console.log('\n# 3 一天能养出几只五转（每天走一趟秘境，路程先扣掉，剩下的全花在蛊市）');
const daily = {};
for (const p of PROFILES) {
  const u = dayUnits(p), left = r => Math.max(0, u - walk[r]);
  daily[p.k] = [0, 1, 2, 3, 4].map(r => left(r) / per[r]);
  console.log(`  ${p.n}：一天 ${tok(u)}（${Math.round(u)} 千），走完一趟剩 ${Math.round(left(3))} 千 → ` + daily[p.k].map((x, r) => `境界${r} ${x.toFixed(2)}`).join(' / '));
}
console.log('  另：四转境界的秘境渡劫成功，首领必掉一只五转（和一样食物二选一），首领配队一般输 35%–45%，平均每趟约 0.6 只');
ok(daily.mid[3] >= 0.8 && daily.mid[3] <= 1.5 && daily.mid[4] >= 0.8 && daily.mid[4] <= 1.5, `中位数玩家在三转、四转境界一天大约养出一只五转：${daily.mid[3].toFixed(2)} / ${daily.mid[4].toFixed(2)}`);
{ const wk = 7 * dayUnits(PROFILES[0]) - 2 * walk[4], n = wk / per[4]; console.log(`  轻度玩家一周 ${Math.round(7 * dayUnits(PROFILES[0]))} 千（一趟秘境要走一天半），走两趟后剩 ${Math.round(wk)} 千`); ok(n >= 1, `轻度玩家一周（走两趟秘境）也能养出一只以上：${n.toFixed(1)} 只/周`); }
ok(daily.hk[4] <= 6, `重度玩家（hacking 中位日）一天不超过 6 只，蛊池更全但单只封顶：${daily.hk[4].toFixed(1)}`);

console.log('\n# 4 新手第一个小时（中位流速，境界 0，只买一转蛊）');
{
  // 货架留着，买空了（或剩下的不想要）才花钱转市；见了已有的种就买（凑合成），新种最多同时养 4 种
  const hour = 60 * PER_MIN / UNIT, rng = makeRng('econ:new'), inv = new Map(), roll = () => rollShop(rng, 0, null, [], null).filter(w => w.kind === 'gu');
  let bank = 0, t = 0, buys = 0, merges = 0, firstMerge = null, refreshes = 0, buys10 = 0, shop = roll();
  const want = w => !w.sold && ((inv.get(w.sp) || 0) > 0 || [...inv.values()].filter(v => v > 0).length < 4);
  while (t < 60) {
    t += 0.25; bank += hour / 240;
    for (const w of shop) {
      if (!want(w)) continue; const c = guCost(w.sp); if (bank < c) break;
      const n = inv.get(w.sp) || 0; bank -= c; buys++; w.sold = true; inv.set(w.sp, n + 1);
      if (n + 1 >= 3) { inv.set(w.sp, 0); merges++; if (firstMerge == null) firstMerge = t; }
    }
    if (t <= 10) buys10 = buys;
    if (!shop.some(want) && bank >= PRICE.refresh) { bank -= PRICE.refresh; refreshes++; shop = roll(); }
  }
  console.log(`  一小时 ${Math.round(hour)} 千：全花在蛊市能买 ${buys} 只一转蛊、转市 ${refreshes} 次、合成 ${merges} 次，第一次合成在第 ${firstMerge == null ? '—' : firstMerge.toFixed(1)} 分钟`);
  console.log(`  （凡人境界只能驱使一转，买多了也上不了阵；多出来的元气留着第一趟秘境一口气走，路程 ${Math.round(walk[0])} 千）`);
  ok(firstMerge != null && firstMerge <= 20, `中位数玩家开局 20 分钟内能合出第一只二转：第 ${firstMerge == null ? '—' : firstMerge.toFixed(1)} 分钟`);
  ok(buys10 >= 4, `开局 10 分钟买得起 4 只一转蛊，凑满凡人秘境的额度 4：${buys10} 只`);
}

console.log('\n# 5 价钱之间不能有漏洞');
ok(PRICE.sell < PRICE.gu, '卖价低于买价：买三只合一只再卖掉一定亏');
ok([1, 2, 3, 4, 5].every(r => sellValue({ sp: 'boar', rank: r }) < PRICE.gu * Math.pow(PRICE.rankK, r - 1)), '任何转数卖出都低于同转原生蛊的买价');
ok(PRICE.refresh <= PRICE.gu / 2, `转市不超过一转蛊的一半（${PRICE.refresh} / ${PRICE.gu}），翻货架不心疼`);
ok(Object.values(SP).filter(s => !s.immortal && baseRank(s.id) >= 5).every(s => guCost(s.id) === PRICE.gu * Math.pow(PRICE.rankK, 4)), '原生五转的蛊和 81 只一转一样贵');
{ const tm = T.TRIP_CFG.market.price.gu, r4 = tm * (1 + 4 * T.TRIP_CFG.market.realm); console.log(`  参考：秘境坊市卖蛊 ${tm} 千起、四转境界 ${Math.round(r4)} 千（秘境专家的表）；蛊市原生五转 ${PRICE.gu * Math.pow(PRICE.rankK, 4)} 千`); }

console.log(bad ? `\n${bad} 项没过` : '\n全部通过');
process.exitCode = bad ? 1 : 0;
