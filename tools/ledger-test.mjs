// node tools/ledger-test.mjs —— 算力履历纯函数的边界测试：rootBuffs / cycleRewards / agentBonus / ledgerAchievements，
// 两种口径：玩法按全量吞吐 x（raw）判定，没有 x 时退回当量 t。外加统计、清洗、上限解析，以及演示数据生成器的确定性（同种子同时刻 → 同一份数据）。
import { rootBuffs, rootFeedMul, cycleRewards, ledgerSnap, agentBonus, ledgerAchievements, ledgerStats, demoLedger, normLedger, lgParseTok, lgKey, ledgerShichen, ROOT_TUNE, AGENT_TUNE, LG_FAMS, LEDGER_ACHS, LG_ACH_TUNE, ledgerMetaRegister, ledgerApply, LG_TITLE_DEFS } from '../src/ledger.js';
import { metaInit, metaMigrate, metaEmit, achList, titleName, setTitle, ACHIEVEMENTS, TITLES } from '../src/meta.js';

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('✗ ' + msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}：得到 ${JSON.stringify(a)}，期望 ${JSON.stringify(b)}`);
const near = (a, b, msg) => ok(Math.abs(a - b) < 1e-9, `${msg}：得到 ${a}，期望 ${b}`);
const NOW = new Date(2026, 9, 31, 15, 30).getTime(), H = 36e5, D = 864e5;
const day = (back, o = {}) => lgKey(new Date(2026, 9, 31 - back));
// 造数据：m = 近 n 天每天的模型分布
function mk({ m = null, n = 7, days = {}, hours = {}, windows = [], agents = { active: 0, peakToday: 0 }, demo } = {}) {
  const dd = { ...days };
  if (m) for (let i = 0; i < n; i++) { const t = Object.values(m).reduce((a, b) => a + b, 0); dd[day(i)] = { t, s: { x: t }, m: { ...m } }; }
  const L = { type: 'ledger', v: 1, days: dd, hours, sources: {}, windows, tools: {}, agents, generatedAt: NOW };
  if (demo) L.demo = true; return L;
}

// ───── rootBuffs / rootFeedMul
{
  const none = rootBuffs(mk());
  eq(none.verdict, '灵根未显', '无数据不显灵根'); eq(none.trait, {}, '无数据无加成'); eq(rootFeedMul(none, { tr: [['shell', 1]] }), 1, '无加成倍率恰为 1');
  const thin = rootBuffs(mk({ m: { 'claude-opus': 1e4 }, n: 7 }));   // 7 万 < 10 万
  eq(thin.verdict, '灵根未显', '近 7 天不足 10 万 token 不显灵根'); eq(thin.trait, {}, '不足阈值无加成');
  const at = rootBuffs(mk({ m: { 'claude-opus': ROOT_TUNE.minTok / 7 + 1 }, n: 7 }));
  ok(at.kind !== 'none', '恰好过阈值就显灵根');
  const pure = rootBuffs(mk({ m: { 'claude-opus': 6e7, 'claude-sonnet': 3e7, 'claude-haiku': 1e7 } }));
  eq(pure.verdict, '天灵根 · 金', '三种 claude 合起来是纯金天灵根');
  near(pure.trait.shell, ROOT_TUNE.heaven, '天灵根护体加成'); near(pure.trait.guard, ROOT_TUNE.heaven, '天灵根护卫加成'); eq(pure.trait.strike, undefined, '天灵根不加别的词条');
  const duo = rootBuffs(mk({ m: { 'claude-opus': 5e7, gpt: 5e7 } }));
  eq(duo.verdict, '金水双灵根', '五五开是金水双灵根'); near(duo.trait.shell, ROOT_TUNE.main, '主灵根 +6%'); near(duo.trait.split, ROOT_TUNE.main, '水主灵根加分影');
  const minor = rootBuffs(mk({ m: { 'claude-opus': 6e7, gpt: 2e7, glm: 1e7, gemini: 7e6, qwen: 3e6 } }));
  eq(minor.verdict, '金水双灵根', '次灵根 ≥15% 才入判词'); near(minor.trait.split, ROOT_TUNE.minor, '次灵根 +3%'); eq(minor.trait.devour, undefined, '10% 的木不算灵根');
  const five = rootBuffs(mk({ m: { 'claude-opus': 2e7, gpt: 2e7, glm: 2e7, gemini: 2e7, qwen: 2e7 } }));
  eq(five.verdict, '五行杂灵根', '五五平分是杂灵根');
  const hun = rootBuffs(mk({ m: { other: 6e7, 'claude-opus': 4e7 } }));
  eq(hun.verdict, '混沌灵体', '其他模型过半是混沌灵体'); near(hun.trait.legacy, ROOT_TUNE.hun, '混沌给每个词条一点');
  const hunMix = rootBuffs(mk({ m: { 'claude-opus': 7e7, other: 3e7 } }));
  near(hunMix.trait.shell, ROOT_TUNE.main + ROOT_TUNE.hun, '主灵根 + 混沌叠加'); near(hunMix.trait.strike, ROOT_TUNE.hun, '混沌也给开锋');
  ok(Object.values({ ...pure.trait, ...duo.trait, ...hunMix.trait }).every(v => v <= ROOT_TUNE.cap), '单个词条不超过封顶');
  const g2 = { tr: [['shell', 2], ['guard', 1], ['strike', 1]] };
  near(rootFeedMul(pure, g2), 1 + ROOT_TUNE.cap, '护体+护卫 = 16% 被封顶到 10%');
  near(rootFeedMul(duo, { tr: [['shell', 3], ['shell', 1]] }), 1 + ROOT_TUNE.main, '同一词条只算一次');
  near(rootFeedMul(duo, { tr: { split: 1 } }), 1 + ROOT_TUNE.main, '对象形式的词条也认');
  eq(rootFeedMul(duo, { tr: [['thorn', 1]] }), 1, '不相干词条无加成'); eq(rootFeedMul(duo, null), 1, '没有蛊返回 1'); eq(rootFeedMul(null, g2), 1, '没有 buffs 返回 1');
  const old = mk({ days: { [day(8)]: { t: 1e9, s: {}, m: { gpt: 1e9 } } }, m: { 'claude-opus': 1e7 } });
  eq(rootBuffs(old).verdict, '天灵根 · 金', '7 天以前的数据不算灵根');
  const rawW = { [day(0)]: { t: 3e7, x: 6e8, s: {}, m: { gpt: 3e7 } } }; for (let i = 1; i < 7; i++) rawW[day(i)] = { t: 1e7, x: 2e7, s: {}, m: { 'claude-opus': 1e7 } };
  eq(rootBuffs(mk({ days: rawW })).roots[0], 'shui', '灵根按 raw 加权：当量金多、吞吐水多 → 水为主');
  eq(rootBuffs(mk({ days: { [day(0)]: { t: 1e5, x: 2e6, s: {}, m: { gpt: 1e5 } } } })).roots[0], 'shui', '门槛看 raw：当量 10 万、吞吐 200 万也显灵根');
  const demo = demoLedger('t', NOW);
  eq(rootBuffs(demo).trait, {}, '演示数据默认无加成'); eq(rootBuffs(demo).active, false, '演示数据 active=false');
  ok(Object.keys(rootBuffs(demo, { demo: true }).trait).length > 0, '传 demo:true 才按演示算');
}

// ───── cycleRewards
{
  const w = (key, kind, start, len, used = 1e6, pct = 0.5) => ({ key, label: key, kind, start, resetsAt: start + len, used, pct, basis: 'log' });
  const s5 = NOW - 6 * H, sw = NOW - 8 * D;
  const prev = ledgerSnap(mk({ windows: [w('c5', '5h', s5, 5 * H), w('x5', '5h', s5, 5 * H), w('cw', 'week', sw, 7 * D)] }));
  const prevAt = { ...prev, windows: prev.windows.map(x => ({ ...x })) };
  eq(cycleRewards(null, mk()), [], '没有上一份快照不发');
  eq(cycleRewards(prev, null), [], '没有当前数据不发');
  const same = mk({ windows: [w('c5', '5h', NOW - H, 5 * H)] }), snapSame = ledgerSnap(same);
  eq(cycleRewards(snapSame, same), [], '同一周期不发');
  const cur = mk({ windows: [w('c5', '5h', NOW - H, 5 * H), w('x5', '5h', NOW - H, 5 * H), w('cw', 'week', NOW - D, 7 * D)] });
  const ev = cycleRewards(prevAt, cur);
  eq(ev.map(e => [e.kind, e.chest, e.keys.length]), [['week', 'silver', 1], ['5h', 'copper', 2]], '周与五小时各一箱，同类合并，周在前');
  eq(cycleRewards(ledgerSnap(cur), cur), [], '发过之后用新快照再算不重复');
  const idle = ledgerSnap(mk({ windows: [w('c5', '5h', s5, 5 * H, 0)] }));
  eq(cycleRewards(idle, mk({ windows: [w('c5', '5h', NOW - H, 5 * H)] })), [], '上一周期没用量不算轮转');
  const noReset = ledgerSnap(mk({ windows: [{ key: 'c5', kind: '5h', start: NOW - 7 * H, resetsAt: null, used: 5 }] }));
  eq(cycleRewards(noReset, mk({ windows: [{ key: 'c5', kind: '5h', start: NOW - H, resetsAt: null, used: 1, pct: null }] })).length, 1, '没有 resetsAt 时看 start 换没换');
  const jitter = ledgerSnap(mk({ windows: [{ key: 'c5', kind: '5h', start: NOW - H, resetsAt: null, used: 5 }] }));
  eq(cycleRewards(jitter, mk({ windows: [{ key: 'c5', kind: '5h', start: NOW - H + 3e4, resetsAt: null, used: 6 }] })), [], 'start 抖动一分钟以内不算');
  eq(cycleRewards(prevAt, { ...cur, demo: true }), [], '演示数据不发轮转箱');
  eq(cycleRewards(prevAt, { ...cur, demo: true }, { demo: true }).length, 2, '传 demo:true 可预览');
  eq(cycleRewards(prevAt, mk({ windows: [w('new', '5h', NOW - H, 5 * H)] })), [], '新出现的窗口不算');
}

// ───── agentBonus
{
  const ab = a => agentBonus(mk({ agents: { active: a, peakToday: a } }));
  eq([ab(0).show, ab(1).show, ab(2).show], [false, false, true], '两个以上才显示');
  eq(ab(1).stoneMul, 1, '一个 agent 无加成');
  near(ab(2).pct, AGENT_TUNE.per, '两个 +4%'); near(ab(3).pct, 2 * AGENT_TUNE.per, '三个 +8%');
  near(ab(4).pct, AGENT_TUNE.cap, '四个到顶'); near(ab(40).pct, AGENT_TUNE.cap, '再多也封顶'); near(ab(40).stoneMul, 1 + AGENT_TUNE.cap, '倍率封顶');
  eq(ab(40).shades, AGENT_TUNE.maxShades, '小影数封顶'); eq(ab(3).label, '分神 ×3', '标签');
  eq(agentBonus(mk({ agents: { active: 'x' } })).active, 0, '非数字当 0'); eq(agentBonus(mk({ agents: { active: -3 } })).show, false, '负数当 0');
  eq(agentBonus(null).show, false, '没有数据'); eq(agentBonus(mk({ agents: { active: 2.9 } })).active, 2, '小数取整');
  const d = demoLedger('t', NOW); eq(agentBonus(d).pct, 0, '演示数据显示小影但不给元石'); ok(agentBonus(d).show, '演示数据照样显示');
  near(agentBonus(d, { demo: true }).pct, 0.08, '传 demo:true 预览加成');
}

// ───── ledgerAchievements
{
  const ids = (L, o) => ledgerAchievements(L, o).map(a => a.id);
  eq(ids(mk()), [], '空数据无成就');
  ok(ids(mk({ days: { [day(3)]: { t: 1e8, s: {}, m: {} } } })).includes('lg_day_1e8'), '恰好 1 亿算破亿');
  ok(!ids(mk({ days: { [day(3)]: { t: 1e8 - 1, s: {}, m: {} } } })).includes('lg_day_1e8'), '差 1 个不算');
  ok(ids(mk({ days: { [day(3)]: { t: 1.5e7, x: 1e8, s: {}, m: {} } } })).includes('lg_day_1e8'), '按 raw 判破亿（当量只有 1500 万）');
  ok(!ids(mk({ days: { [day(3)]: { t: 2e8, x: 9e7, s: {}, m: {} } } })).includes('lg_day_1e8'), '有 raw 时不看当量');
  const ten = ids(mk({ days: { [day(3)]: { t: 1.4e8, x: LG_ACH_TUNE.day2, s: {}, m: {} } } }));
  ok(ten.includes('lg_day_1e9') && ten.includes('lg_day_1e8'), '吞吐十亿：两档都拿'); ok(!ids(mk({ days: { [day(3)]: { t: 1e8, x: 9.99e8, s: {}, m: {} } } })).includes('lg_day_1e9'), '9.99 亿不算十亿');
  const run = (n, endBack = 0, gap = -1) => { const d = {}; for (let i = 0; i < n; i++) if (i !== gap) d[day(endBack + i)] = { t: 1000, s: {}, m: {} }; return d; };
  eq(ids(mk({ days: run(6) })), [], '6 天不够七日连修');
  eq(ids(mk({ days: run(7) })), ['lg_streak7'], '7 天七日连修');
  eq(ids(mk({ days: run(8, 0, 3) })), [], '中间断一天不连');
  eq(ids(mk({ days: run(30, 40) })), ['lg_streak7', 'lg_streak30'], '30 天连修（很久以前的也算）');
  const cross = {}; for (let i = 0; i < 7; i++) cross[lgKey(new Date(2026, 0, 28 + i))] = { t: 5, s: {}, m: {} };
  ok(ids(mk({ days: cross })).includes('lg_streak7'), '跨月连修');
  const win = (pct, extra = {}) => mk({ windows: [{ key: 'k', label: 'k', kind: '5h', used: 5e7, pct, resetsAt: NOW + H, start: NOW - H, basis: 'log', ...extra }] });
  ok(ids(win(1)).includes('lg_quota_full'), '窗口 100% 算打满'); ok(!ids(win(0.98)).includes('lg_quota_full'), '98% 不算');
  ok(ids(win(null), { limits: { k: 5e7 } }).includes('lg_quota_full'), '玩家填的上限也能打满'); ok(!ids(win(null)).includes('lg_quota_full'), '无上限不算');
  ok(ids(mk({ agents: { active: 2, peakToday: 5 } })).includes('lg_agents5'), '今日峰值 5 个分神'); ok(!ids(mk({ agents: { active: 4, peakToday: 4 } })).includes('lg_agents5'), '4 个不算');
  const hrs = (n, h) => { const o = {}; for (let i = 0; i < n; i++) { const a = new Array(24).fill(0); a[h] = 4e5; o[day(i)] = a; } return o; };
  ok(ids(mk({ hours: hrs(7, 23) })).includes('lg_zishi7'), '7 天 23 点修炼'); ok(ids(mk({ hours: hrs(7, 0) })).includes('lg_zishi7'), '0 点也是子时');
  ok(!ids(mk({ hours: hrs(6, 23) })).includes('lg_zishi7'), '6 天不够'); ok(!ids(mk({ hours: hrs(7, 1) })).includes('lg_zishi7'), '1 点已是丑时');
  const tiny = hrs(7, 23); for (const k in tiny) tiny[k][23] = 100; ok(!ids(mk({ hours: tiny })).includes('lg_zishi7'), '子时只有零星几个 token 不算');
  ok(ids(mk({ m: { 'claude-opus': 9e7, gpt: 2e6, glm: 2e6, gemini: 2e6, qwen: 2e6 } })).includes('lg_wuxing'), '五行各 ≥1% 俱全');
  ok(!ids(mk({ m: { 'claude-opus': 9e7, gpt: 2e6, glm: 2e6, gemini: 2e6, qwen: 3e5 } })).includes('lg_wuxing'), '土不到 1% 不全');
  const d = demoLedger('t', NOW); eq(ids(d), [], '演示数据不计成就'); ok(ids(d, { demo: true }).length >= 5, '演示数据可预览成就');
  ok(ledgerAchievements(mk({ days: run(7) }))[0].tier === 'bronze' && LEDGER_ACHS.every(a => /^lg_/.test(a.id) && ['bronze', 'silver', 'gold'].includes(a.tier)), '成就格式与 meta 一致');
}

// ───── 统计与时辰
{
  const d = {}; for (let i = 1; i <= 5; i++) d[day(i)] = { t: 10, s: {}, m: {} };
  const st = ledgerStats(mk({ days: d }));
  eq([st.cur, st.longest.n, st.active, st.total], [5, 5, 5, 50], '今天还没修不算断连');
  d[day(0)] = { t: 3, s: {}, m: {} }; eq(ledgerStats(mk({ days: d })).cur, 6, '今天修了连修 +1');
  eq(ledgerStats(mk({ days: { [day(400)]: { t: 9e9, s: {}, m: {} } } })).total, 0, '一年以外不进全年总量');
  const h = new Array(24).fill(0); h[22] = 9; h[23] = 4; h[0] = 4;
  eq(ledgerShichen(mk({ hours: { [day(0)]: h } })).ch, '亥', '22 点是亥时');
  const z = new Array(24).fill(0); z[23] = 5; z[0] = 5; z[22] = 9; eq(ledgerShichen(mk({ hours: { [day(0)]: z } })).ch, '子', '23 点和 0 点合成子时');
  eq(ledgerShichen(mk()), null, '没有逐时数据');
  const sx = ledgerStats(mk({ days: { [day(1)]: { t: 1e7, x: 7e7, s: {}, m: {} }, [day(2)]: { t: 2e7, s: {}, m: {} } } }));
  eq([sx.total, sx.totalEq, sx.best.x, sx.best.date], [9e7, 3e7, 7e7, day(1)], '全年与最强一日用 raw，旧数据退回当量，另给 totalEq');
}

// ───── 清洗与上限解析
{
  eq(normLedger({ type: 'tokens' }), null, '类型不对丢弃'); eq(normLedger({ type: 'ledger', v: 2, days: {} }), null, '版本不对丢弃');
  const n = normLedger({ type: 'ledger', v: 1, days: { '2026-10-30': { s: { a: 5, b: 7 }, m: { gpt: 12 } }, 'bad': { t: 1 }, '2026-10-31': { t: -5 } }, hours: { '2026-10-30': [1, 2, 'x'] },
    windows: [{ key: 'a', kind: '5h', used: 3, pct: 9 }, { key: 'b', kind: 'day', used: 1 }, { kind: 'week' }], agents: { active: 1e6 }, sources: { a: { label: '<b>x</b>' } } });
  eq(n.days['2026-10-30'].t, 12, '没有 t 时按来源求和'); eq(n.days['2026-10-30'].x, 0, '没有 x 记 0（读时退回 t）');
  eq(normLedger({ type: 'ledger', v: 1, days: { '2026-10-30': { t: 5, x: 40 } }, windows: [{ key: 'w', kind: 'week', used: 70, usedEq: 10 }] }).windows[0].usedEq, 10, 'usedEq 保留'); eq(n.days.bad, undefined, '非法日期键丢弃'); eq(n.days['2026-10-31'].t, 0, '负数当 0');
  eq(n.hours['2026-10-30'].length, 24, '逐时补齐 24 格'); eq(n.hours['2026-10-30'][2], 0, '非数字当 0');
  eq(n.windows.map(w => [w.key, w.pct]), [['a', 1.5]], '只留 5h/week 且有 key 的窗口，pct 夹到 1.5'); eq(n.agents.active, 99, 'agent 数封顶 99');
  eq(n.sources.a.label, '<b>x</b>', '标签原样保留（渲染时再转义）');
  eq([lgParseTok('5000万'), lgParseTok('2亿'), lgParseTok('50M'), lgParseTok('1,200'), lgParseTok('1.5e8'), lgParseTok('abc'), lgParseTok('')], [5e7, 2e8, 5e7, 1200, 1.5e8, 0, 0], '上限解析');
}

// ───── 演示数据：确定性与合理性
{
  const a = demoLedger('gucode', NOW), b = demoLedger('gucode', NOW), c = demoLedger('别的种子', NOW);
  eq(JSON.stringify(a) === JSON.stringify(b), true, '同种子同时刻生成同一份数据');
  ok(JSON.stringify(a.days) !== JSON.stringify(c.days), '换种子数据不同');
  ok(JSON.stringify(demoLedger('gucode', NOW + D).days) !== JSON.stringify(a.days), '换一天数据跟着走');
  const keys = Object.keys(a.days).sort(), first = new Date(2026, 9, 31 - 399);
  ok(keys.length > 250 && keys.length <= 400 && keys[0] >= lgKey(first) && keys[keys.length - 1] <= lgKey(new Date(NOW)), '最多 400 天、不出界');
  ok(Object.keys(a.hours).length === 14 && Object.values(a.hours).every(h => h.length === 24), '最近 14 天、每天 24 格');
  ok(Object.entries(a.hours).every(([k, h]) => h.reduce((x, y) => x + y, 0) === ((a.days[k] && a.days[k].x) || 0)), '逐时（raw）加起来等于当天 x');
  ok(Object.values(a.days).every(d => d.x >= d.t * 5.9 && d.x <= d.t * 8.1), 'raw 约为当量的 6–8 倍');
  ok(Object.values(a.days).every(d => Object.values(d.s).reduce((x, y) => x + y, 0) === d.t && Object.values(d.m).reduce((x, y) => x + y, 0) === d.t), '来源、模型加起来都等于当天总量');
  ok(Object.values(a.days).every(d => Object.keys(d.m).every(f => LG_FAMS.includes(f))), '模型族只用约定的取值');
  ok(a.hours[lgKey(new Date(NOW))].slice(16).every(v => v === 0), '今天此刻之后没有数据');
  const st = ledgerStats(a); ok(st.best.x >= 1e9 && st.best.x < 2.5e9 && st.best.t < 2.2e8, '最强一日 raw 过十亿、当量不离谱'); ok(st.cur >= 23 && st.longest.n >= 61, '有像样的连修');
  ok(a.demo === true && a.windows.some(w => w.pct == null) && a.windows.some(w => w.basis === 'estimate') && a.windows.every(w => w.used > w.usedEq && w.usedEq > 0), '带演示标记、窗口有 used/usedEq，窗口覆盖 pct 为空与估算两种');
  const rt = normLedger(a); ok(rt && Object.keys(rt.days).length === keys.length && rt.days[keys[5]].t === a.days[keys[5]].t, '演示数据能过清洗');
}

// ───── 接入 meta：成就、称号、周天轮转箱
{
  const n0 = ACHIEVEMENTS.length; ledgerMetaRegister(); ledgerMetaRegister();
  eq(ACHIEVEMENTS.length, n0 + LEDGER_ACHS.length, '履历成就并进 meta，重复注册不重复');
  ok(LG_TITLE_DEFS.every(t => TITLES.some(x => x.id === t.id)), '履历称号并进 TITLES');
  const S = { started: true, team: [], realm: 0, nodes: 0, wins: 0, total: 0 }; const M = metaMigrate(null, S);
  const w = (start, used) => ({ key: 'c5', label: 'Claude · 五小时', kind: '5h', start, resetsAt: start + 5 * H, used, pct: 0.4, basis: 'log' });
  const d7 = {}; for (let i = 0; i < 7; i++) d7[day(i)] = { t: 2e8, x: 1.2e9, s: {}, m: { 'claude-opus': 2e8 } };
  const L1 = mk({ days: d7, windows: [w(NOW - H, 3e8)] });
  const r1 = ledgerApply(M, S, L1);
  eq(r1.filter(r => r.k === 'chest'), [], '第一次收到数据不发轮转箱');
  ok(S.lgSnap && S.lgSnap.windows.length === 1 && S.lgAch.includes('lg_streak7') && S.lgAch.includes('lg_day_1e9'), '存档里记下快照与已达成的履历成就');
  ok(r1.some(r => r.k === 'title' && r.id === 'lg_t2') && M.titles.includes('lg_t1') && M.titles.includes('lg_t2') && !M.titles.includes('lg_t3'), '全年吞吐 84 亿：发到十亿蛊师为止');
  const out = metaEmit(M, 'ledger', {}, null, S);
  ok(['lg_streak7', 'lg_day_1e8', 'lg_day_1e9'].every(id => out.achievements.some(a => a.id === id)), 'metaEmit 结算出履历成就');
  ok(achList(M).filter(a => /^lg_/.test(a.id)).every(a => a.n && a.d) && achList(M).some(a => a.id === 'lg_streak7' && a.done), '成就面板列得出、标得出已得');
  ok(setTitle(M, 'lg_t2') && titleName(M) === '十亿蛊师', '履历称号能装备、名字对');
  eq(metaEmit(M, 'ledger', {}, null, S).achievements, [], '已得成就不重复发');
  const chests0 = M.chests.length, got0 = M.stats.chestsGot;
  const L2 = mk({ days: d7, windows: [w(NOW + 4 * H, 1e6)] }); L2.generatedAt = NOW + 4.5 * H;
  const r2 = ledgerApply(M, S, L2);
  eq(r2.filter(r => r.k === 'chest').map(r => r.tier), ['copper'], '五小时窗口轮转：一个铜箱');
  eq([M.chests.length - chests0, M.stats.chestsGot - got0], [1, 1], '箱子进了 meta 的待开队列');
  eq(ledgerApply(M, S, L2).filter(r => r.k === 'chest'), [], '同一份数据再来一次不重复发');
  eq(ledgerApply(M, S, demoLedger('x', NOW)), [], '演示数据不碰存档');
  const S2 = { lgAch: ['lg_streak7'] }; ledgerApply(null, S2, mk({ days: { [day(0)]: { t: 1, s: {}, m: {} } } }));
  ok(S2.lgAch.includes('lg_streak7'), '履历成就一旦达成就留着（数据窗口滚动也不丢）');
  const old = metaMigrate({ level: 3, ach: { first_node: 1 }, titles: ['t0'] }, { total: 5 });
  ok(old.ach.first_node === 1 && !old.ach.lg_streak7 && titleName(old) === '无名蛊师', '旧存档读得进来，履历成就未得');
}

console.log(`ledger-test：通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
