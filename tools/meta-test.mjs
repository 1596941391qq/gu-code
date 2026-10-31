// node tools/meta-test.mjs —— 成长/奖励系统的单元测试 + 新玩家前 5 分钟模拟。失败 exit(1)
import { makeRng, newGu, SPECIES, COMBOS, ECON } from '../src/core.js';
import * as MT from '../src/meta.js';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const { SIGN_REWARDS, META_TUNE, RARITY, ACHIEVEMENTS, LEVEL_REWARDS, CHESTS, DAILY_TASKS, UNLOCKS, TITLES, metaInit, metaMigrate, metaEmit, rollRarity, pityLeft, applyRarity, levelInfo, levelNeed, feedGu, feedTeam, rollChest, openChest, openCocoon, isUnlocked, rigShop, shopFlags, streakMul, dailyView, achList, xpTotalTo } = MT;

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } };
const sec = t => console.log('\n# ' + t);
const merge = (a, o) => { a.xp += o.xp; a.levelUps.push(...o.levelUps); a.achievements.push(...o.achievements); a.chests.push(...o.chests); a.unlocks.push(...o.unlocks); a.rewards.push(...o.rewards); a.notes.push(...o.notes); return a; };

sec('1 天机与概率');
{
  const rng = makeRng('pity'), M = metaInit(), N = 200000, cnt = [0, 0, 0, 0, 0]; let gap = 0, maxGap = 0, firstAt = 0, first = true;
  for (let i = 1; i <= N; i++) {
    const left = pityLeft(M), t = rollRarity(M, rng); cnt[t]++; gap++;
    if (t >= 3) { if (first) { firstAt = i; first = false; } maxGap = Math.max(maxGap, gap); gap = 0; }
    ok(left >= 1 && left <= 40, 'pityLeft 范围');
    if (left === 1) ok(t >= 3, `pityLeft=1 时必出绝/天（第 ${i} 次）`);
  }
  console.log('  频率', cnt.map((c, i) => RARITY[i].n + (c / N * 100).toFixed(2) + '%').join(' '), '最大间隔', maxGap, '首个绝+在第', firstAt, '次');
  ok(maxGap <= META_TUNE.pity.every, '每 40 次必出绝或以上');
  ok(firstAt <= 10, '新玩家第一次天机在 10 次以内');
  RARITY.forEach((r, i) => ok(Math.abs(cnt[i] / N * 100 - r.p) < (i >= 3 ? 1.6 : 1.2), `档位 ${r.n} 概率贴近 ${r.p}%`));
  ok(Math.abs(RARITY.reduce((s, r) => s + r.p, 0) - 100) < 1e-9, '概率和为 100');
  // 败局推进天机
  const M2 = metaInit(), l0 = pityLeft(M2); metaEmit(M2, 'battle_end', { kind: 'easy', win: false, hpLeftRatio: 0 }, makeRng(1)); ok(pityLeft(M2) === l0 - 1, '败局把天机推进 1 次');
  // 玄箱茧保底
  const M3 = metaInit(); M3.pity.first = false; for (let i = 0; i < 300; i++) ok(rollRarity(M3, makeRng(i), 2) >= 2, 'minRar 下限');
  // applyRarity
  const g = newGu('boar'), a0 = g.atk, h0 = g.hp; applyRarity(g, 4, makeRng(3)); ok(g.rar === 4 && g.atk > a0 && g.hp > h0 && g.tr.length >= 2, 'applyRarity 天品加属性和词条');
  const g2 = newGu('fire'); applyRarity(g2, 0, makeRng(3)); ok(g2.rar === 0 && g2.atk === SPECIES.find(s => s.id === 'fire').atk, '凡品不变');
}

sec('2 等级曲线');
{
  let prev = 0; for (let L = 1; L < 100; L++) { const n = levelNeed(L); ok(n >= prev, '需求单调'); prev = n; }
  console.log('  升级所需：L1', levelNeed(1), 'L2', levelNeed(2), 'L5', levelNeed(5), 'L10', levelNeed(10), 'L20', levelNeed(20), 'L50', levelNeed(50), 'L99', levelNeed(99), '累计到 L10/50/100', xpTotalTo(10), xpTotalTo(50), xpTotalTo(100));
  ok(levelNeed(1) <= 25 && xpTotalTo(6) <= 130, '前期升得很快');
  ok(levelNeed(99) / levelNeed(10) > 20, '后期指数变慢');
  for (let L = 2; L <= 100; L++) ok(LEVEL_REWARDS[L] && LEVEL_REWARDS[L].length > 0, '每级都有奖励 ' + L);
  const M = metaInit(), o = metaEmit(M, 'token', { delta: 3e6, rate: 1000 }, makeRng(1)); ok(M.level > 5 && o.levelUps.length === M.level - 1, '一次大 token 连升多级且逐级返回');
  const li = levelInfo(M); ok(li.level === M.level && li.need > 0 && Array.isArray(li.next), 'levelInfo 形状');
  const mx = metaInit(); metaEmit(mx, 'token', { delta: 1e12, rate: 0 }, makeRng(2)); ok(mx.level === 100, '满级封顶');
  ok(LEVEL_REWARDS[15].some(r => r.k === 'slot') && LEVEL_REWARDS[10].some(r => r.k === 'species') && LEVEL_REWARDS[100].some(r => r.k === 'title'), '蛊市加格/新蛊种/称号都在表里');
}

sec('3 灵气、宝箱、连胜、每日、离开');
{
  const g = newGu('boar'), r = feedGu(g, 8000); ok(r.ups === 1 && g.ql === 1 && g.hp === 5, 'feedGu 升级加血'); const r2 = feedGu(g, 1e12); ok(g.ql === META_TUNE.gu.max && r2.ups > 0, '灵气等级封顶');
  const t = ['boar', 'fire', 'twin'].map(newGu), f = feedTeam(t, 30000); ok(f.length === 3 && f[0].qi > f[1].qi && f.every(x => x.uid), 'feedTeam 炉口多分');
  const rng = makeRng('chest'); for (const k of Object.keys(CHESTS)) { const c = rollChest(rng, k); ok(c.rewards.some(x => x.k === 'stone'), '箱出元石 ' + k); }
  let cocoons = 0; for (let i = 0; i < 2000; i++) if (rollChest(rng, 'xuan').rewards.some(x => x.k === 'cocoon')) cocoons++; ok(cocoons === 2000, '玄箱必出茧');
  const M = metaInit(); metaEmit(M, 'session_start', { date: '2026-10-31', hour: 12, awayMs: 0, awayTokens: 0 }, makeRng(1));
  ok(M.daily.tasks.length === 3 && new Set(M.daily.tasks.map(x => x.id)).size === 3, '每日抽 3 个不重复任务');
  const M_b = metaInit(); metaEmit(M_b, 'session_start', { date: '2026-10-31' }, makeRng(9)); ok(JSON.stringify(M_b.daily.tasks) === JSON.stringify(M.daily.tasks), '同日期种子任务相同');
  // 首胜 ×3
  const w1 = metaEmit(M, 'battle_end', { kind: 'mid', win: true, hpLeftRatio: 0.5, crits: 0, maxHit: 9, skills: 0, turns: 8 }, makeRng(2));
  ok(w1.settle.mul >= 3 && w1.settle.bonus >= ECON.win.mid * 2, '每日首胜 ×3：' + JSON.stringify(w1.settle));
  const w2 = metaEmit(M, 'battle_end', { kind: 'mid', win: true, hpLeftRatio: 0.5, crits: 0, maxHit: 9, skills: 0, turns: 8 }, makeRng(3)); ok(!w2.streak.firstWin, '首胜只算一次');
  for (let i = 0; i < 12; i++) metaEmit(M, 'battle_end', { kind: 'easy', win: true, hpLeftRatio: 1, crits: 0, maxHit: 5, skills: 0, turns: 5 }, makeRng(10 + i));
  ok(M.streak.n === 14 && streakMul(14) === META_TUNE.streak.cap, '连胜倍率封顶');
  // 断连：不扣已有东西（护心符已去掉，货币只剩元石、蛊茧、经验）
  const before = { xp: M.xp, level: M.level, chests: M.chests.length, ap: M.ap };
  const l2 = metaEmit(M, 'battle_end', { kind: 'easy', win: false }, makeRng(51)); ok(M.streak.n === 0 && l2.streak.lost === 14, '断连只清零倍率');
  ok(M.level >= before.level && M.chests.length >= before.chests && M.ap >= before.ap && !l2.rewards.some(x => x.n < 0), '断连不扣任何已有东西');
  ok(l2.xp > 0 && l2.notes.some(x => x.includes('败也有得')), '败局至少推进 经验/天机');
  { const Mx = metaInit(); let got = 0; for (let i = 0; i < 40; i++) { const o = metaEmit(Mx, 'battle_end', { kind: 'hard', win: true }, makeRng(900 + i)); if (o.rewards.some(r => r.k === 'cocoon' && /残躯/.test(r.why))) got++; } ok(got === 40, '胜难幽灵必得残躯化茧'); }
  { const all = [...Object.values(LEVEL_REWARDS).flat(), ...SIGN_REWARDS.flat()]; ok(!all.some(r => r.k === 'charm'), '奖励里不再有护心符'); }
  // 里程碑固定箱
  const Mm = metaInit(); let got = 0; for (let i = 1; i <= 10; i++) { const o = metaEmit(Mm, 'battle_end', { kind: 'easy', win: true, hpLeftRatio: 1 }, makeRng(i)); if (i % 5 === 0) ok(o.chests.includes('silver'), `第 ${i} 胜必得银箱`); got += o.chests.length; }
  // 离开回来
  const Ma = metaInit(); const ao = metaEmit(Ma, 'session_start', { date: '2026-11-01', hour: 9, awayMs: 3600000, awayTokens: 2500000 }, makeRng(4));
  ok(ao.away && ao.away.tier === 'silver' && ao.chests.includes('silver') && ao.notes.some(x => x.includes('你离开期间')), '离开期间有宝箱和提示'); ok(Ma.stats.tokens === 2500000, '离开 token 计入累计');
  const Mb = metaInit(); const bo = metaEmit(Mb, 'session_start', { date: '2026-11-01', awayMs: 1000, awayTokens: 999999 }, makeRng(4)); ok(!bo.away, '离开太短不触发');
  // 七日签到：断签不罚
  const Md = metaInit(); const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06']; const sd = days.map(d => { metaEmit(Md, 'day_tick', { date: d }, makeRng(1)); return Md.daily.signDay; });
  ok(JSON.stringify(sd) === '[1,2,3,1,2]', '签到 1,2,3 断一天重新 1,2：' + sd);
  const Me = metaInit(); for (let i = 1; i <= 8; i++) metaEmit(Me, 'day_tick', { date: '2026-12-0' + i }, makeRng(1)); ok(Me.daily.signDay === 1, '第 8 天回到第 1 天');
  // 任务完成给箱
  const Mt = metaInit(); metaEmit(Mt, 'day_tick', { date: '2026-11-09' }, makeRng(1)); const nc = Mt.chests.length;
  for (let i = 0; i < 12; i++) { for (const [ty, p] of [['battle_end', { kind: 'hard', win: true, crits: 2, skills: 1, hpLeftRatio: 1 }], ['node_done', { type: 'feed' }], ['shop_refresh', {}], ['merge', { star: 2 }], ['cocoon', { rarity: 0 }], ['token', { delta: 100000 }], ['share', {}]]) metaEmit(Mt, ty, p, makeRng(i)); }
  ok(Mt.daily.tasks.every(x => x.done) && Mt.daily.allDone && Mt.chests.length >= nc + 3, '每日任务完成给宝箱');
  const dv = dailyView(Mt); ok(dv.tasks.length === 3 && achList(Mt).length === ACHIEVEMENTS.length, 'dailyView/achList');
}

sec('4 解锁');
{
  const M = metaInit(), S = { nodes: 0, realm: 0 };
  ok(isUnlocked(M, S, 'compass') && isUnlocked(M, S, 'formation') && !isUnlocked(M, S, 'battle') && !isUnlocked(M, S, 'shop'), '开局只有罗盘和蛊阵');
  const o1 = metaEmit(M, 'node_done', { type: 'feed' }, makeRng(1), { nodes: 1, realm: 0 }); ok(o1.unlocks.includes('battle') && !o1.unlocks.includes('shop'), '第 1 个节点后解锁斗蛊');
  const o2 = metaEmit(M, 'node_done', { type: 'temper' }, makeRng(1), { nodes: 2, realm: 0 }); ok(o2.unlocks.includes('shop'), '第 2 个节点后解锁蛊市');
  ok(!isUnlocked(M, S, 'marks') && !isUnlocked(M, S, 'endless'), '道痕/无尽劫未解锁');
  const o3 = metaEmit(M, 'realm_up', { realm: 1 }, makeRng(1), { nodes: 2, realm: 1 }); ok(o3.unlocks.includes('marks'), '一转后道痕');
  metaEmit(M, 'realm_up', { realm: 5 }, makeRng(1), { nodes: 9, realm: 5 }); ok(isUnlocked(M, S, 'endless') && M.unlocked.endless, '五转后无尽劫');
  const mid = ['cocoon', 'daily', 'ach'].map(k => UNLOCKS[k].need.level); ok(mid.every(l => l >= 2 && l <= 5), '成就/每日/开茧排在中间');
  // 旧档静默解锁
  const old = metaMigrate(null, { nodes: 5, realm: 2, wins: 3, total: 1e6, v: 2 }); ok(old.unlocked.battle && old.unlocked.shop && old.unlocked.marks && !old.unlocked.endless, '旧档静默解锁');
  const o4 = metaEmit(old, 'node_done', { type: 'feed' }, makeRng(1), { nodes: 6, realm: 2 }); ok(!o4.unlocks.includes('battle'), '旧档不重复放动画');
}

sec('5 存档迁移与确定性');
{
  const a = metaMigrate(undefined), b = metaMigrate(null), c = metaMigrate({}), d = metaMigrate({ xp: 12, level: 3, stats: { wins: 4 } });
  ok(JSON.stringify(a) === JSON.stringify(metaInit()) && JSON.stringify(b) === JSON.stringify(a) && c.stats && c.daily && c.pity, '无 meta 时补齐');
  ok(d.xp === 12 && d.level === 3 && d.stats.wins === 4 && d.stats.merges === 0 && d.pity.first === true, '旧字段保留、缺字段补齐');
  const e = JSON.parse(JSON.stringify(metaInit())); ok(JSON.stringify(metaMigrate(e)) === JSON.stringify(e), '迁移幂等且可 JSON 往返');
  const run = seed => { const rng = makeRng(seed), M = metaInit(), acc = []; metaEmit(M, 'session_start', { date: '2026-11-01', hour: 3, awayMs: 4e6, awayTokens: 3e5 }, rng); for (let i = 0; i < 400; i++) { const k = i % 5; acc.push(JSON.stringify(k === 0 ? metaEmit(M, 'token', { delta: 40000 + i * 10, rate: 1500 }, rng) : k === 1 ? metaEmit(M, 'battle_end', { kind: ['easy', 'mid', 'hard'][i % 3], win: i % 4 !== 0, hpLeftRatio: (i % 10) / 10, crits: i % 4, maxHit: i, skills: i % 2, turns: 7 }, rng) : k === 2 ? metaEmit(M, 'cocoon', { rarity: rollRarity(M, rng) }, rng) : k === 3 ? metaEmit(M, 'shop_refresh', { nearMiss: i % 3 === 0, triple: i % 17 === 0 }, rng) : (M.chests.length ? openChest(M, rng) : metaEmit(M, 'node_done', { type: 'feed' }, rng)))); } return JSON.stringify(M) + acc.join('|'); };
  ok(run(7) === run(7), '同种子结果完全相同'); ok(run(7) !== run(8), '不同种子结果不同');
}

sec('6 每个成就都能被触发');
{
  const M = metaInit(), S = { nodes: 0, realm: 0, codex: { sp: SPECIES.map(s => s.id), combo: COMBOS.map(c => c.id) } }, rng = makeRng('career'), E = (t, p) => metaEmit(M, t, p, rng, S);
  const fired = new Set(); const E2 = (t, p) => { const o = E(t, p); o.achievements.forEach(a => fired.add(a.id)); return o; };
  const B = (o = {}) => E2('battle_end', { kind: 'easy', win: true, hpLeftRatio: 0.6, crits: 0, maxHit: 8, skills: 0, turns: 8, ...o });
  E2('session_start', { date: '2026-11-01', hour: 3 }); E2('token', { delta: 1000, rate: 800 });
  for (const t of ['feed', 'temper', 'mutate', 'split', 'devour', 'summon', 'refine']) E2('node_done', { type: t });
  for (let i = 0; i < 5; i++) B({ win: false });
  B({ crits: 3, skills: 1, maxHit: 250, hpLeftRatio: 0.1 }); B({ hpLeftRatio: 1, turns: 2 }); B({ maxHit: 1200 }); B({ maxHit: 12000 });
  for (let i = 0; i < 22; i++) B({ kind: ['easy', 'mid', 'hard'][i % 3] });
  for (let i = 0; i < 180; i++) B();
  E2('merge', { star: 2 }); E2('merge', { star: 3 });
  for (let i = 0; i < 200; i++) { const t = rollRarity(M, rng); E2('cocoon', { rarity: t }); if (M.stats.pityHits >= 1) break; }
  E2('cocoon', { rarity: 4 }); E2('cocoon', { rarity: 4 }); E2('cocoon', { rarity: 3 });
  E2('shop_refresh', { nearMiss: true, triple: false }); E2('shop_refresh', { nearMiss: false, triple: true }); E2('shop_refresh', {}); E2('shop_refresh', {});
  for (let r = 1; r <= 5; r++) { S.realm = r; E2('realm_up', { realm: r }); }
  for (let f = 1; f <= 30; f++) E2('endless_floor', { floor: f });
  E2('share', { kind: 'card' }); E2('duel_open');
  for (const [t, p] of [['node_done', { type: 'feed' }], ['shop_refresh', {}], ['merge', { star: 2 }], ['token', { delta: 300000 }], ['cocoon', { rarity: 0 }], ['share', {}]]) for (let i = 0; i < 6; i++) E2(t, p);
  E2('token', { delta: 1e8, rate: 1000 }); E2('session_start', { date: '2026-11-01', hour: 10, awayMs: 3.6e6, awayTokens: 2e6 });
  for (let d = 2; d <= 8; d++) E2('day_tick', { date: '2026-11-0' + d });
  for (let i = 0; i < 100; i++) E2('token', { delta: 1e9 });
  const miss = ACHIEVEMENTS.filter(a => !M.ach[a.id]).map(a => a.id); console.log('  成就数', ACHIEVEMENTS.length, '未触发', miss.join(',') || '无');
  ok(miss.length === 0, '全部成就可触发'); ok(fired.size === ACHIEVEMENTS.length, '每个成就都在 out.achievements 里播报过一次');
  const tiers = { bronze: 0, silver: 0, gold: 0 }; ACHIEVEMENTS.forEach(a => tiers[a.tier]++); console.log('  铜/银/金', tiers.bronze, tiers.silver, tiers.gold, '隐藏', ACHIEVEMENTS.filter(a => a.hidden).length);
  ok(ACHIEVEMENTS.length >= 40 && ACHIEVEMENTS.some(a => a.hidden) && tiers.gold >= 5, '约 40 个、含隐藏、三档齐全'); ok(new Set(ACHIEVEMENTS.map(a => a.id)).size === ACHIEVEMENTS.length, '成就 id 唯一');
  const maxAp = ACHIEVEMENTS.reduce((s, a) => s + { bronze: 1, silver: 3, gold: 6 }[a.tier], 0); console.log('  成就点总和', maxAp, '称号门槛', TITLES.filter(t => t.ap != null).map(t => t.ap).join('/'));
  ok(TITLES.filter(t => t.ap != null).every(t => t.ap <= maxAp) && M.titles.length > 8 && MT.titleName(M) !== '无名蛊师', '称号随成就点解锁'); ok(M.ap === maxAp, '成就点累计正确');
  // 同一事件重复不重复发
  const again = E('token', { delta: 1 }); ok(again.achievements.length === 0, '成就不重复发');
}

sec('7 新玩家前 5 分钟（真实 500–1700 token/s）');
{
  const SEEDS = 300, LIM = 300, res = []; let timeline = null;
  for (let s = 0; s < SEEDS; s++) {
    const rng = makeRng('newbie' + s), M = metaInit(), S = { nodes: 0, realm: 0 }, tl = {}, log = [];
    const mark = (k, t, txt) => { if (!(k in tl)) { tl[k] = t; log.push(`${String(t).padStart(3)}s ${txt}`); } };
    const feed = (o, t) => { if (o.levelUps.length) mark('level', t, `升级 → 蛊师 ${o.levelUps[o.levelUps.length - 1].level} 级`); if (o.achievements.length) mark('ach', t, `成就「${o.achievements[0].n}」`); if (o.chests.length) mark('chest', t, `宝箱 ${o.chests.join('/')}（${o.rewards.find(r => r.k === 'chest' && r.why) ? o.rewards.find(r => r.k === 'chest').why : ''}）`); return o; };
    const E = (t, type, p) => feed(metaEmit(M, type, p, rng, S), t);
    E(0, 'session_start', { date: '2026-11-01', hour: 14, awayMs: 0, awayTokens: 0 });
    const base = 500 + rng() * 1200; let prog = 0, cost = 40000 + rng.int(3) * 5000, shopOpenAt = null, nextRefresh = 0, nodes = 0, battleAt = [], cocoonQ = [], battles = 0;
    for (let t = 1; t <= LIM; t++) {
      const delta = Math.round(base * (0.7 + rng() * 0.6)); E(t, 'token', { delta, rate: delta }); prog += delta;
      if (prog >= cost) { prog -= cost; cost = 40000 + rng.int(3) * 5000; nodes++; S.nodes = nodes; const o = E(t, 'node_done', { type: 'feed' }); if (o.unlocks.includes('battle')) battleAt.push(t + 6); if (nodes >= 2) battleAt.push(t + 8); if (o.unlocks.includes('shop')) { shopOpenAt = t + 4; nextRefresh = shopOpenAt; } }
      while (battleAt.length && battleAt[0] <= t) { battleAt.shift(); const first = battles++ === 0, win = first || rng() < 0.85; E(t, 'battle_end', { kind: 'easy', win, hpLeftRatio: win ? 0.3 + rng() * 0.7 : 0, crits: rng.int(3), maxHit: 10 + rng.int(40), skills: first ? 1 : rng.int(2), turns: 7 }); }
      if (shopOpenAt !== null && t >= nextRefresh) { const rig = rigShop(M, rng, ['boar', 'fire', 'twin', 'iron', 'thorn', 'bone']), f = rig ? shopFlags(rig.map(sp => ({ sp }))) : { nearMiss: false, triple: false }; E(t, 'shop_refresh', f); if (f.triple) { mark('merge', t, '转市三同：合炼机会'); } nextRefresh = t + 18; }
      while (M.cocoons.length && !cocoonQ.length) cocoonQ.push(t + 3);
      if (cocoonQ.length && t >= cocoonQ[0]) { cocoonQ.shift(); const c = openCocoon(M, rng); if (c) { E(t, 'cocoon', { rarity: c.tier }); if (c.tier >= 3) mark('jue', t, `开茧出${RARITY[c.tier].n}（第 ${M.stats.cocoons} 个茧${M.pity.lastForced === false && M.stats.pityHits ? '，天机' : ''}）`); } }
    }
    res.push(tl); if (s === 0) timeline = log;
  }
  console.log('  seed0 时间线：\n    ' + timeline.join('\n    '));
  const keys = [['level', '升级'], ['jue', '绝级开茧'], ['ach', '成就'], ['merge', '合炼机会'], ['chest', '宝箱']];
  for (const [k, n] of keys) { const v = res.map(r => r[k]).filter(x => x != null); const miss = SEEDS - v.length; v.sort((a, b) => a - b); console.log(`  ${n}：首次 中位 ${v[v.length >> 1]}s，最慢 ${v[v.length - 1]}s，${SEEDS} 个种子里未出现 ${miss}`); ok(miss === 0, `前 5 分钟必有「${n}」`); }
}

sec('8 文本与禁词');
{
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), u = s => s.split('|').map(x => x.split('.').map(h => String.fromCharCode(parseInt(h, 16))).join('')).join('|');
  const pat = new RegExp(u('65af.91d1.7eb3|8d4c|8001.864e.673a|62bd.5361|6210.763e|4e0a.763e|591a.5df4.80fa') + '|' + ['skin', 'ner|cas', 'ino|gam', 'bl|slot.?mac', 'hine|ga', 'cha|add', 'ict|dopa', 'mine|variable.', 'ratio|compul', 'sion'].join(''), 'i');
  for (const f of ['src/meta.js', 'src/tutorial.js', 'tools/meta-test.mjs']) ok(!pat.test(fs.readFileSync(path.join(root, f), 'utf8')), '无禁词 ' + f);
  ok(DAILY_TASKS.length >= 8 && Object.keys(CHESTS).length === 5 && RARITY.length === 5, '表结构');
}
console.log(fails ? `\n失败 ${fails} 项` : '\n全部通过'); process.exit(fails ? 1 : 0);
