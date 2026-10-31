// 蛊码 GuCode · 算力履历：修行日历、日内曲线、周天额度、灵根、功课、分神；年度履历卡；与玩法挂钩的纯函数。
//
// ═══ 集成指南 ════════════════════════════════════════════════════════════════
// 数据来源：插件或网页本地桥 window.postMessage({ type:'ledger', v:1, days, hours, sources, windows, tools, agents, generatedAt })。
//   两种口径：days[d].x / hours / windows[].used 是全量吞吐（raw，含每轮重复读上下文的读缓存，与 ccusage 同口径）；
//   days[d].t / windows[].usedEq 是算力当量（eq，读缓存按 0.1 计，推进养蛊用）；days[d].s / m 是 t 的拆分，sx / mx 是 x 的拆分（有就优先用）。
//   windows[].pct 插件给的是百分数（0–100），normLedger 折成 0–1.5，之后各函数都按 0–1 算。
//   界面（日历、曲线、最强一日、年度卡）和玩法判定（灵根门槛、成就）一律用 raw；旧数据没有 x 时退回 t。
//   normLedger(raw) 校验清洗（字段名见 normLedger）；没有真实数据时界面用 demoLedger(seed, now)，它带 demo:true，
//   面板醒目标「演示数据」。demoLedger 同种子同 now 必出同一份数据（tools/ledger-test.mjs 有测）。
// 界面入口（ui.js 只加了几行）：
//   ledgerInit({ vsc, getLimits, setLimit, openSettings, onData, buffsOn })  启动时调一次；buffsOn=true 表示 rootBuffs/agentBonus 已接进 feed，
//     界面才把加成写成生效（没接时写「待接入」，演示数据写「演示」）。它自己监听 window message（网页版只收同源 / file / localhost）。
//   openLedger(meta)          打开「算力履历」面板。meta = { name, realm, rank?, title? }：title 是印章里的字（不给就按全年吞吐取），rank 是玩家装备的称号，写在印章下。
//   ledgerShades(qiaoEl)      空窍上方挂「分神 ×N」小影；renderAll() 之后、收到新数据之后各调一次。
//   ledgerLimitRows() / ledgerBindLimits(sheetEl)   设置面板里「周天上限」输入行（插件给不出 pct 的窗口才出现）。
//   ledgerData() / ledgerLive()  当前数据（无真实数据时是演示数据）与是否真实。
// 玩法挂钩（全是纯函数；数据带 demo:true 时一律返回中性结果，第二参数传 { demo:true } 才按演示算，只给面板预览用）：
//   1) rootBuffs(ledger) → { shares, total, roots, verdict, verse, trait:{ 词条id: 比例 }, cap, active }
//      灵根 = 近 7 天各模型族 token 占比：claude→金、gpt→水、glm→木、gemini→火、qwen→土、其余→混沌。
//      金→护体/护卫，水→分影/化生/应召（召唤类），木→噬魂，火→开锋，土→遗泽，混沌→以上八个各一点。
//      数值（ROOT_TUNE）：天灵根（≥80%）+8%，主灵根（≥50%）+6%，次灵根（15–50%）+3%，混沌 ≥15% 时八个词条各 +1.5%；
//      单只蛊合计封顶 +10%；近 7 天全量吞吐不足 100 万 token 不显灵根、没有加成。占比 = 每天 m 的比例按当天 raw 加权。
//      用法：feed() 里 token 进罗盘节点之前乘 rootFeedMul(buffs, S.team[0])。只加快节点进度（喂养成长），
//      不碰元石、意志、攻血数值，也不碰战斗随机数。buffs 每收到一次新 ledger 重算一次即可，别每 tick 算。
//   2) cycleRewards(prevSnap, ledger) → [{ k:'cycle', n:'周天轮转', kind:'5h'|'week', keys:[窗口key], labels, chest }]
//      prevSnap = ledgerSnap(上一份 ledger)，很小，随存档保存。每次收到新 ledger：先 cycleRewards(prev, cur)，再 prev = ledgerSnap(cur)。
//      判定：窗口过了上次记下的 resetsAt，或 start 换了新的，就算轮转一次；上一周期用量为 0 的窗口不算（没修炼就没有轮转）。
//      同一类窗口一次最多一个箱，五小时给 copper，每周给 silver（CYCLE_TUNE；键与 meta.js CHESTS 一致，直接交给 meta 发箱）。
//   3) agentBonus(ledger) → { active, show, label:'分神 ×N', stoneMul, pct, shades }
//      agents.active ≥ 2 才 show；每多一个分神元石 +4%，封顶 +12%（AGENT_TUNE）。用法：feed() 里 stoneK += d * stoneMul。
//   4) ledgerAchievements(ledger) → [{ id, tier, n, d }]（已达成的），按 raw 判定：单日破亿 1 亿、一日十亿 10 亿（重度用户 raw 约 5–6 亿/天）。LEDGER_ACHS 是全表，id 以 lg_ 开头，tier 用 meta 的 bronze/silver/gold。
//      合并进 meta：ACHIEVEMENTS 追加这些条目，check 写成 c => ledgerAchievements(c.S.ledger).some(a => a.id === id)，或者收到 ledger 时直接解锁。
// 年度履历卡：makeLedgerCard(ledger, meta) → PNG dataURL（1080×1350，同步）。二维码指向游戏首页。
// ─── 已接入主线（m4-ledger 预集成）───
//   ledgerInit 时 ledgerMetaRegister() 把 LEDGER_ACHS 并进 meta 的 ACHIEVEMENTS / ACH_BY_ID（check 读 S.lgAch），
//   把按全年吞吐分档的称号（LG_TITLE_DEFS）并进 TITLES。meta.js 本身不用改。
//   真实数据到达：ledgerApply(M, S, L) 更新 S.lgSnap / S.lgAch，把周天轮转箱压进 M.chests，按全年吞吐发称号，
//   返回要展示的奖励；ui 随后 metaEmit(M, 'ledger', {}) 让成就结算，再 handleOut。
//   feed()：节点进度乘 ledgerFeedMul(S.team[0])，元石累计乘 ledgerStoneMul()；数据超过 LG_STALE_MS 没更新就不加。
//   存档字段：S.qlim（周天上限，属设置）、S.lgSnap、S.lgAch，三者都不随「重开一局」清空。
// ══════════════════════════════════════════════════════════════════════════
import { makeRng, hashStr, TRAITS } from './core.js';
import { ACHIEVEMENTS, ACH_BY_ID, TITLES } from './meta.js';
import { qrDraw } from './qr.js';

// ───────────────────────── 调参表 ─────────────────────────
export const ROOT_TUNE = { days: 7, minTok: 1e6, rootMin: 0.15, mainMin: 0.5, heavenMin: 0.8, heaven: 0.08, main: 0.06, minor: 0.03, hun: 0.015, cap: 0.10 };
export const CYCLE_TUNE = { chest: { '5h': 'copper', week: 'silver' }, minUsed: 1 };
export const AGENT_TUNE = { min: 2, per: 0.04, cap: 0.12, maxShades: 6 };
export const LG_GAME_URL = 'https://1596941391qq.github.io/gu-code/';

export const LG_FAMS = ['claude-opus', 'claude-sonnet', 'claude-haiku', 'gpt', 'glm', 'gemini', 'qwen', 'other'];
export const LG_FAM_NAME = { 'claude-opus': 'Opus', 'claude-sonnet': 'Sonnet', 'claude-haiku': 'Haiku', gpt: 'GPT', glm: 'GLM', gemini: 'Gemini', qwen: 'Qwen', other: '其他' };
// 五行：相生顺序（木→火→土→金→水）排在五角图上；traits = 该灵根加成的词条
export const LG_ELEM = {
  mu: { ch: '木', fam: 'GLM', traits: ['devour'], verse: '木性吞纳，噬魂而长' },
  huo: { ch: '火', fam: 'Gemini', traits: ['strike'], verse: '火主锋芒，一击开阵' },
  tu: { ch: '土', fam: 'Qwen', traits: ['legacy'], verse: '土德厚载，遗泽后人' },
  jin: { ch: '金', fam: 'Claude', traits: ['shell', 'guard'], verse: '金气肃杀，护体如钟' },
  shui: { ch: '水', fam: 'GPT', traits: ['split', 'spawn', 'rally'], verse: '上善若水，分化无穷' },
};
export const LG_HUN = { ch: '混', n: '混沌', verse: '混沌未判，万法皆通' };
const LG_EK = ['mu', 'huo', 'tu', 'jin', 'shui'];
const LG_ROOT_TRAITS = [...new Set(LG_EK.flatMap(e => LG_ELEM[e].traits))];
export const lgFamElem = f => String(f).startsWith('claude') ? 'jin' : f === 'gpt' ? 'shui' : f === 'glm' ? 'mu' : f === 'gemini' ? 'huo' : f === 'qwen' ? 'tu' : 'hun';
export const LG_TOOLS = [['edit', '炼器', '改文件'], ['bash', '御雷', '跑命令'], ['read', '神识', '读文件'], ['web', '天眼', '查网页'], ['task', '分神', '派子 agent'], ['other', '杂务', '其他']];
const LG_SHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const LG_SHI_ALIAS = ['夜半', '鸡鸣', '平旦', '日出', '食时', '隅中', '日中', '日昳', '晡时', '日入', '黄昏', '人定'];
const LG_CN_NUM = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const LG_TITLES = [[1e11, '吞天蛊尊'], [3e10, '焚天蛊仙'], [1e10, '百亿蛊师'], [1e9, '十亿蛊师'], [1e8, '亿灵蛊徒'], [0, '初炼蛊徒']];   // 按全年 raw
export const LG_TITLE_DEFS = LG_TITLES.filter(([n]) => n > 0).reverse().map(([min, n], i) => ({ id: 'lg_t' + (i + 1), n, lgMin: min }));   // 可装备的称号
export const LG_STALE_MS = 10 * 60e3;
export const LEDGER_ACHS = [
  { id: 'lg_day_1e8', tier: 'bronze', n: '单日破亿', d: '单日全量吞吐过 1 亿 token' },
  { id: 'lg_day_1e9', tier: 'silver', n: '一日十亿', d: '单日全量吞吐过 10 亿 token' },
  { id: 'lg_streak7', tier: 'bronze', n: '七日连修', d: '连续 7 天都有 token 进账' },
  { id: 'lg_streak30', tier: 'gold', n: '三十日连修', d: '连续 30 天都有 token 进账' },
  { id: 'lg_quota_full', tier: 'silver', n: '周天圆满', d: '把一个五小时或每周额度窗口用满' },
  { id: 'lg_agents5', tier: 'silver', n: '五神分化', d: '同时有 5 个 agent 在跑' },
  { id: 'lg_zishi7', tier: 'bronze', n: '子时修士', d: '近 14 天里有 7 天在子时（23–1 点）修炼' },
  { id: 'lg_wuxing', tier: 'gold', n: '五行俱全', d: '近 7 天金木水火土五种灵根都用上，各占 1% 以上' },
];
export const LG_ACH_TUNE = { day1: 1e8, day2: 1e9, zishi: 3e5 };   // raw 口径

// ───────────────────────── 小工具（全部 lg 前缀：构建后各模块共用一个作用域）─────────────────────────
const lgPad = n => String(n).padStart(2, '0');
export const lgKey = d => d.getFullYear() + '-' + lgPad(d.getMonth() + 1) + '-' + lgPad(d.getDate());
const lgDate = k => { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, m - 1, d); };
const lgAdd = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const lgDiff = (a, b) => Math.round((b - a) / 864e5);
const lgEnd = L => { const d = new Date((L && L.generatedAt) || Date.now()); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const lgEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const lgSum = a => a.reduce((x, y) => x + y, 0);
const lgMD = k => { const d = lgDate(k); return `${d.getMonth() + 1}月${d.getDate()}日`; };
export const lgX = d => d ? (+d.x > 0 ? +d.x : +d.t > 0 ? +d.t : 0) : 0;   // 当天全量吞吐，旧数据退回当量
const lgBuffTag = () => !LGS.live ? '（演示）' : LGS.opts.buffsOn ? '' : '（待接入）';
const lgOff = (L, o) => !L || (L.demo && !(o && o.demo));
export function lgCN(n) {
  n = +n || 0;
  if (n >= 1e8) { const v = n / 1e8; return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + '亿'; }
  if (n >= 1e4) { const v = n / 1e4; return (v >= 100 ? v.toFixed(0) : v.toFixed(1)) + '万'; }
  return String(Math.round(n));
}
// 「5000万」「2亿」「50M」「1.5e8」→ 数字；不认识返回 0
export function lgParseTok(s) {
  const m = String(s || '').replace(/[,，\s]/g, '').match(/^(\d+(?:\.\d+)?(?:e\d+)?)(亿|万|千|k|m|b)?$/i); if (!m) return 0;
  const u = { '亿': 1e8, '万': 1e4, '千': 1e3, k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1;
  return Math.round(parseFloat(m[1]) * u);
}
function lgSplit(total, w) {   // 按权重把整数拆开，和恰好等于 total
  const s = lgSum(w) || 1, out = w.map(x => Math.floor(total * x / s)); let rest = total - lgSum(out);
  const ord = w.map((x, i) => [total * x / s - out[i], i]).sort((a, b) => b[0] - a[0]);
  for (let j = 0; rest > 0 && ord.length; j = (j + 1) % ord.length, rest--) out[ord[j][1]]++;
  return out;
}

// ───────────────────────── 统计（纯函数）─────────────────────────
// 近 365 天（raw）：总量、修行天数、最强一日、分位数；totalEq 是同期当量；连修按全部天数算（今天还没修不算断）
export function ledgerStats(L) {
  const end = lgEnd(L), from = lgAdd(end, -364), days = (L && L.days) || {}, vals = [];
  let total = 0, totalEq = 0, active = 0, best = null;
  for (let i = 0; i < 365; i++) { const k = lgKey(lgAdd(from, i)), x = lgX(days[k]); if (x > 0) { total += x; totalEq += +days[k].t || 0; active++; vals.push(x); if (!best || x > best.x) best = { date: k, x, t: +days[k].t || 0 }; } }
  const keys = Object.keys(days).filter(k => lgX(days[k]) > 0).sort();
  let longest = { n: 0, from: null, to: null }, run = 0, runFrom = null, prev = null;
  for (const k of keys) { if (prev && lgKey(lgAdd(lgDate(prev), 1)) === k) run++; else { run = 1; runFrom = k; } if (run > longest.n) longest = { n: run, from: runFrom, to: k }; prev = k; }
  let cur = 0, d = end; const on = x => lgX(days[lgKey(x)]) > 0;
  if (!on(d)) d = lgAdd(d, -1);
  while (on(d)) { cur++; d = lgAdd(d, -1); }
  vals.sort((a, b) => a - b); const q = p => vals.length ? vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] : 0;
  return { end: lgKey(end), from: lgKey(from), total, totalEq, active, best, longest, cur, curFrom: cur ? lgKey(lgAdd(d, 1)) : null, q: [q(0.25), q(0.5), q(0.75)] };
}
const lgLevel = (t, q) => !(t > 0) ? 0 : t <= q[0] ? 1 : t <= q[1] ? 2 : t <= q[2] ? 3 : 4;
// 近 n 天五行占比：每天按 m 的比例拆当天 raw，再累加
const lgHas = o => !!(o && typeof o === 'object' && Object.keys(o).length);
export function rootShares(L, n = ROOT_TUNE.days) {
  const end = lgEnd(L), acc = { mu: 0, huo: 0, tu: 0, jin: 0, shui: 0, hun: 0 }; let total = 0;
  for (let i = 0; i < n; i++) {
    const dd = L && L.days && L.days[lgKey(lgAdd(end, -i))], mm = dd && (lgHas(dd.mx) ? dd.mx : dd.m); if (!mm) continue;   // 有 raw 拆分（mx）就直接用，否则按当天 raw 总量放大当量拆分
    const ms = lgSum(Object.values(mm).map(v => +v > 0 ? +v : 0)); if (!ms) continue; const x = lgX(dd) || ms;
    for (const f in mm) { const v = +mm[f] || 0; if (v > 0) acc[lgFamElem(f)] += x * v / ms; }
    total += x;
  }
  const shares = {}; for (const e in acc) shares[e] = total ? acc[e] / total : 0;
  return { shares, total };
}
export function rootVerdict(shares, total) {
  const T = ROOT_TUNE;
  if (!(total >= T.minTok)) return { roots: [], verdict: '灵根未显', verse: '近七日灵气稀薄，多修几日再来测。', kind: 'none' };
  if (shares.hun >= T.mainMin) return { roots: ['hun'], verdict: '混沌灵体', verse: LG_HUN.verse, kind: 'hun' };
  const roots = LG_EK.filter(e => shares[e] >= T.rootMin).sort((a, b) => shares[b] - shares[a]);
  if (!roots.length) return { roots: [], verdict: '五行杂灵根', verse: '诸气相杂，未有所归', kind: 'mixed' };
  const ch = roots.map(e => LG_ELEM[e].ch).join(''), top = LG_ELEM[roots[0]];
  const verdict = roots.length === 1 ? (shares[roots[0]] >= T.heavenMin ? `天灵根 · ${ch}` : `${ch}单灵根`) : roots.length === 2 ? `${ch}双灵根` : roots.length === 3 ? `${ch}三灵根` : roots.length === 4 ? '四象杂灵根' : '五行杂灵根';
  return { roots, verdict, verse: roots.length >= 4 ? '诸气相杂，未有所归' : top.verse, kind: roots.length === 1 && shares[roots[0]] >= T.heavenMin ? 'heaven' : 'root' };
}
export function rootBuffs(L, opts = {}) {
  const T = ROOT_TUNE, { shares, total } = rootShares(L || {}), v = rootVerdict(shares, total), trait = {}, off = lgOff(L, opts);
  if (!off && v.kind !== 'none') {
    for (const e of LG_EK) { const s = shares[e], b = s >= T.heavenMin ? T.heaven : s >= T.mainMin ? T.main : s >= T.rootMin ? T.minor : 0; if (b) LG_ELEM[e].traits.forEach(id => { trait[id] = (trait[id] || 0) + b; }); }
    if (shares.hun >= T.rootMin) LG_ROOT_TRAITS.forEach(id => { trait[id] = (trait[id] || 0) + T.hun; });
    for (const id in trait) trait[id] = Math.min(T.cap, +trait[id].toFixed(4));
  }
  return { shares, total, ...v, trait, cap: T.cap, active: !off };
}
// 喂养倍率：这只蛊身上每种词条取一次加成，合计封顶 cap。没有加成时恰好返回 1
export function rootFeedMul(buffs, g) {
  if (!buffs || !buffs.trait || !g || !g.tr) return 1;
  const ids = new Set((Array.isArray(g.tr) ? g.tr : Object.entries(g.tr)).map(x => x[0])); let s = 0;
  ids.forEach(id => { s += buffs.trait[id] || 0; });
  return 1 + Math.min(buffs.cap || ROOT_TUNE.cap, s);
}
export function rootBuffText(b) {
  const g = {}; for (const id in b.trait) (g[b.trait[id]] || (g[b.trait[id]] = [])).push(TRAITS[id] ? TRAITS[id].n : id);
  const parts = Object.keys(g).sort((x, y) => y - x).map(v => `带${g[v].join('、')}的蛊吸纳 +${Math.round(v * 1000) / 10}%`);
  return parts.length ? parts.join('；') + `（单只封顶 +${Math.round(b.cap * 100)}%，不影响斗蛊）` : '暂无灵根加成';
}
// 周天轮转：存档里只需要这份快照
export function ledgerSnap(L) {
  if (!L) return null;
  return { at: L.generatedAt || 0, demo: !!L.demo, windows: (L.windows || []).map(w => ({ key: w.key, kind: w.kind, label: w.label, start: w.start, resetsAt: w.resetsAt, used: w.used, pct: w.pct })) };
}
export function cycleRewards(prev, cur, opts = {}) {
  if (!prev || !cur || lgOff(cur, opts) || (prev.demo && !opts.demo)) return [];
  const now = cur.generatedAt || cur.at || Date.now(), pw = new Map((prev.windows || []).map(w => [w.key, w])), by = {};
  for (const w of cur.windows || []) {
    const p = pw.get(w.key); if (!p || !(p.used >= CYCLE_TUNE.minUsed)) continue;
    const rolled = (p.resetsAt != null && now >= p.resetsAt) || (w.start != null && p.start != null && w.start > p.start + 6e4);
    if (!rolled) continue;
    const e = by[w.kind] || (by[w.kind] = { k: 'cycle', n: '周天轮转', kind: w.kind, keys: [], labels: [], chest: CYCLE_TUNE.chest[w.kind] || 'wood' });
    e.keys.push(w.key); e.labels.push(w.label || w.key);
  }
  return ['week', '5h'].filter(k => by[k]).map(k => by[k]).concat(Object.keys(by).filter(k => k !== 'week' && k !== '5h').map(k => by[k]));
}
export function agentBonus(L, opts = {}) {
  const n = Math.max(0, Math.min(99, Math.floor(+(L && L.agents && L.agents.active) || 0)));
  if (n < AGENT_TUNE.min) return { active: n, show: false, label: '', stoneMul: 1, pct: 0, shades: 0 };
  const pct = lgOff(L, opts) ? 0 : Math.min(AGENT_TUNE.cap, +(AGENT_TUNE.per * (n - 1)).toFixed(4));
  return { active: n, show: true, label: `分神 ×${n}`, stoneMul: 1 + pct, pct, shades: Math.min(AGENT_TUNE.maxShades, n) };
}
export function ledgerAchievements(L, opts = {}) {
  if (lgOff(L, opts)) return [];
  const st = ledgerStats(L), got = new Set(), days = L.days || {};
  const T = LG_ACH_TUNE, peak = Math.max(0, ...Object.values(days).map(lgX));
  if (peak >= T.day1) got.add('lg_day_1e8');
  if (peak >= T.day2) got.add('lg_day_1e9');
  if (st.longest.n >= 7) got.add('lg_streak7');
  if (st.longest.n >= 30) got.add('lg_streak30');
  const lim = opts.limits || {};
  if ((L.windows || []).some(w => { const p = w.pct != null ? w.pct : lim[w.key] > 0 ? w.used / lim[w.key] : null; return p != null && p >= 0.995; })) got.add('lg_quota_full');
  if (L.agents && Math.max(+L.agents.active || 0, +L.agents.peakToday || 0) >= 5) got.add('lg_agents5');
  if (Object.values(L.hours || {}).filter(h => Array.isArray(h) && ((+h[23] || 0) >= T.zishi || (+h[0] || 0) >= T.zishi)).length >= 7) got.add('lg_zishi7');
  const { shares, total } = rootShares(L); if (total >= ROOT_TUNE.minTok && LG_EK.every(e => shares[e] >= 0.01)) got.add('lg_wuxing');
  return LEDGER_ACHS.filter(a => got.has(a.id)).map(a => ({ ...a }));
}
// 最常修炼的时辰：近 14 天按时辰累加
export function ledgerShichen(L) {
  const acc = new Array(12).fill(0);
  for (const k in (L && L.hours) || {}) (L.hours[k] || []).forEach((v, h) => { acc[Math.floor(((h + 1) % 24) / 2)] += +v || 0; });
  const tot = lgSum(acc); if (!tot) return null;
  const i = acc.indexOf(Math.max(...acc)), a = (i * 2 + 23) % 24;
  return { i, ch: LG_SHI[i], alias: LG_SHI_ALIAS[i], range: `${a}–${(a + 2) % 24} 点`, share: acc[i] / tot, acc };
}
export function ledgerTitle(total) { return (LG_TITLES.find(([n]) => total >= n) || LG_TITLES[LG_TITLES.length - 1])[1]; }

// ───────────────────────── 接入 meta ─────────────────────────
const lgHasAch = (S, id) => !!(S && Array.isArray(S.lgAch) && S.lgAch.includes(id));
export function ledgerMetaRegister() {   // 幂等：成就与称号并进 meta 的表
  for (const a of LEDGER_ACHS) if (!ACH_BY_ID[a.id]) { const x = { ...a, hidden: false, check: c => lgHasAch(c.S, a.id) }; ACHIEVEMENTS.push(x); ACH_BY_ID[a.id] = x; }
  for (const t of LG_TITLE_DEFS) if (!TITLES.some(x => x.id === t.id)) TITLES.push({ ...t });
}
// 真实数据到达时调用：改 S 的三个履历字段、轮转箱进 M.chests、按全年吞吐发称号；返回要展示的奖励（chest / title）
export function ledgerApply(M, S, L) {
  if (!S || !L || L.demo) return [];
  const ev = cycleRewards(S.lgSnap || null, L); S.lgSnap = ledgerSnap(L);
  const got = ledgerAchievements(L, { limits: S.qlim || {} }).map(a => a.id);
  S.lgAch = [...new Set([...(Array.isArray(S.lgAch) ? S.lgAch : []), ...got])];
  const out = ev.map(e => ({ k: 'chest', tier: e.chest, why: `周天轮转 · ${e.labels.join('、')}` }));
  if (M) {
    out.forEach(r => { M.chests.push(r.tier); M.stats.chestsGot = (M.stats.chestsGot | 0) + 1; });
    const total = ledgerStats(L).total;
    LG_TITLE_DEFS.filter(t => total >= t.lgMin && !M.titles.includes(t.id)).forEach(t => { M.titles.push(t.id); out.push({ k: 'title', id: t.id, why: '算力履历' }); });
  }
  return out;
}
const lgFresh = () => LGS.live && LGS.data && Date.now() - (LGS.data.generatedAt || 0) < LG_STALE_MS;
export const ledgerFeedMul = g => lgFresh() && LGS.opts.buffsOn ? rootFeedMul(LGS.buffs, g) : 1;
export const ledgerStoneMul = () => lgFresh() && LGS.opts.buffsOn && LGS.agent ? LGS.agent.stoneMul : 1;

// ───────────────────────── 校验清洗 ─────────────────────────
export function normLedger(raw) {
  if (!raw || raw.type !== 'ledger' || +raw.v !== 1 || typeof raw.days !== 'object' || !raw.days) return null;
  const num = x => (typeof x === 'number' && isFinite(x) && x > 0) ? x : 0, str = (x, n = 40) => String(x == null ? '' : x).slice(0, n);
  const nmap = o => { const r = {}; if (o && typeof o === 'object') for (const k in o) { const v = num(o[k]); if (v) r[str(k, 40)] = v; } return r; };
  const isDay = k => /^\d{4}-\d{2}-\d{2}$/.test(k), days = {}, hours = {}, tools = {}, sources = {};
  Object.keys(raw.days).filter(isDay).sort().slice(-400).forEach(k => { const d = raw.days[k] || {}, s = nmap(d.s), m = nmap(d.m); days[k] = { t: num(d.t) || lgSum(Object.values(s)) || lgSum(Object.values(m)), x: num(d.x), s, m, sx: nmap(d.sx), mx: nmap(d.mx) }; });
  Object.keys(raw.hours || {}).filter(isDay).sort().slice(-14).forEach(k => { const a = raw.hours[k]; if (Array.isArray(a)) hours[k] = Array.from({ length: 24 }, (_, h) => num(a[h])); });
  Object.keys(raw.tools || {}).filter(isDay).sort().slice(-400).forEach(k => { const o = raw.tools[k] || {}; tools[k] = {}; LG_TOOLS.forEach(([id]) => { tools[k][id] = Math.round(num(o[id])); }); });
  for (const k in raw.sources || {}) { const s = raw.sources[k] || {}; sources[str(k)] = { label: str(s.label || k), kind: str(s.kind), account: str(s.account) }; }
  const windows = (Array.isArray(raw.windows) ? raw.windows : []).slice(0, 12).filter(w => w && w.key && (w.kind === '5h' || w.kind === 'week')).map(w => ({
    key: str(w.key), label: str(w.label || w.key), kind: w.kind, used: num(w.used), usedEq: num(w.usedEq) || null,
    pct: typeof w.pct === 'number' && isFinite(w.pct) ? Math.max(0, Math.min(1.5, w.pct / 100)) : null,   // 插件给的是百分数（0–100，可超），这里折成 0–1.5
    resetsAt: num(w.resetsAt) || null, start: num(w.start) || null, basis: w.basis === 'estimate' ? 'estimate' : 'log' }));
  const ag = raw.agents || {};
  return { type: 'ledger', v: 1, days, hours, sources, windows, tools, agents: { active: Math.min(99, Math.floor(num(ag.active))), peakToday: Math.min(99, Math.floor(num(ag.peakToday))) }, generatedAt: num(raw.generatedAt) || Date.now() };
}

// ───────────────────────── 演示数据生成器（确定性）─────────────────────────
// 一位从 400 天前开始用 AI 写代码、越用越多的开发者：工作日多、周末少，偶有休假与通宵大重构；
// 主力 Claude Code，后来加了 Codex，偶尔 Gemini CLI 与 Cline（GLM / Qwen）。同 seed + 同 now → 同一份数据。
export function demoLedger(seed = 'gucode', now = Date.now()) {
  const r = makeRng('ledger:' + seed), N = 400, endT = new Date(now), end = new Date(endT.getFullYear(), endT.getMonth(), endT.getDate());
  const gs = () => { let u = 0; for (let i = 0; i < 6; i++) u += r(); return (u - 3) * 1.414; };
  const off = new Set(); [[330, 9], [214, 6], [88, 5]].forEach(([c, n]) => { const s = c + r.int(9) - 4; for (let i = 0; i < n; i++) off.add(s + i); });
  const tot = new Array(N).fill(0); let ph = 0;
  for (let i = N - 1; i >= 0; i--) {
    const wd = lgAdd(end, -i).getDay(), age = (N - 1 - i) / (N - 1); ph = ph * 0.92 + gs() * 0.13;
    const forced = i <= 22 || (i >= 118 && i <= 178);
    const pOff = forced ? 0 : off.has(i) ? 1 : [0.4, 0.05, 0.04, 0.05, 0.05, 0.09, 0.3][wd] + 0.22 * (1 - age);
    const roll = r(), noise = gs(), burst = r(), bm = r();
    if (roll < pOff) continue;
    let t = (6e6 + 62e6 * Math.pow(age, 1.25)) * [0.55, 1, 1.08, 1.04, 1.1, 0.9, 0.62][wd] * Math.exp(ph + noise * 0.3);
    if (burst < 0.035) t *= 1.7 + bm * 0.8;
    tot[i] = Math.round(Math.min(t, 1.55e8 + bm * 3e7));
  }
  let bi = 0; tot.forEach((t, i) => { if (t > tot[bi]) bi = i; }); if (tot[bi] < 1.5e8) tot[bi] = Math.round(1.5e8 + r() * 3e7);
  const rx = tot.map(() => 6 + r() * 2); rx[bi] = Math.max(rx[bi], 7.3);   // raw ≈ 6–8 倍当量；最强一日过十亿
  const days = {}, hours = {}, tools = {}, nowH = endT.getHours() + endT.getMinutes() / 60;
  const gw = (h, c, s) => { let d = Math.abs(h - c); d = Math.min(d, 24 - d); return Math.exp(-d * d / (2 * s * s)); };
  for (let i = 13; i >= 0; i--) {   // 最近 14 天的 24 小时分布；今天只到此刻
    const zi = (i % 2 === 0 || r() < 0.35) ? 0.45 + r() * 0.4 : 0.02, a = 0.7 + r() * 0.5, b = 0.8 + r() * 0.5, c = 1.0 + r() * 0.5, w = [];
    for (let h = 0; h < 24; h++) { let v = 0.06 + a * gw(h + 0.5, 10.5, 1.3) + b * gw(h + 0.5, 15.5, 1.7) + c * gw(h + 0.5, 21.7, 1.2) + zi * gw(h + 0.5, 23.9, 0.9); if (h >= 2 && h < 8) v *= 0.05; w.push(v * Math.exp(gs() * 0.25)); }
    const full = lgSum(w);
    if (i === 0) { for (let h = 0; h < 24; h++) w[h] *= h + 1 <= nowH ? 1 : h < nowH ? nowH - h : 0; tot[0] = Math.round(tot[0] * lgSum(w) / full); }
    hours[lgKey(lgAdd(end, -i))] = tot[i] ? lgSplit(Math.round(tot[i] * rx[i]), w) : new Array(24).fill(0);
  }
  for (let i = N - 1; i >= 0; i--) {
    const t = tot[i]; if (!t) continue;
    const k = lgKey(lgAdd(end, -i)), age = (N - 1 - i) / (N - 1);
    const cx = age > 0.45 ? 0.15 + 0.2 * r() : 0, gm = age > 0.6 && (i < 7 || r() < 0.55) ? 0.03 + 0.06 * r() : 0, cl = age > 0.7 && (i < 7 || r() < 0.65) ? 0.05 + 0.08 * r() : 0;
    const [sc, sx, sg, sl] = lgSplit(t, [Math.max(0.4, 1 - cx - gm - cl), cx, gm, cl]), s = {}, m = {};
    [['claude', sc], ['codex', sx], ['gemini', sg], ['cline', sl]].forEach(([n, v]) => { if (v) s[n] = v; });
    const op = Math.max(0.1, Math.min(0.85, 0.2 + 0.55 * age + 0.08 * gs())), [mo, ms, mh] = lgSplit(sc, [op, 0.94 - op, 0.06]), [mg, mq, mx] = lgSplit(sl, [0.6, 0.34, 0.06]);
    [['claude-opus', mo], ['claude-sonnet', ms], ['claude-haiku', mh], ['gpt', sx], ['gemini', sg], ['glm', mg], ['qwen', mq], ['other', mx]].forEach(([n, v]) => { if (v) m[n] = v; });
    days[k] = { t, x: Math.round(t * rx[i]), s, m };
    const u = t / 2.5e6; tools[k] = { edit: Math.round(u * (2.6 + r())), bash: Math.round(u * (3.8 + 1.4 * r())), read: Math.round(u * (5.5 + 2 * r())), web: Math.round(u * (0.15 + 0.25 * r())), task: Math.round(u * (0.1 + 0.2 * r())), other: Math.round(u * (0.4 + 0.4 * r())) };
  }
  const H = 36e5, D = 864e5, c5 = now - (1.2 + r() * 2.6) * H, cw = now - (1 + r() * 5) * D, x5 = now - (0.5 + r() * 3.5) * H, xw = now - (2 + r() * 4) * D;
  const windows = [
    { key: 'claude-5h', label: 'Claude · 五小时', kind: '5h', used: 0, usedEq: Math.round(3e7 + r() * 3e7), pct: +(0.48 + r() * 0.3).toFixed(3), resetsAt: Math.round(c5 + 5 * H), start: Math.round(c5), basis: 'log' },
    { key: 'claude-week', label: 'Claude · 本周', kind: 'week', used: 0, usedEq: Math.round(3e8 + r() * 2e8), pct: +(0.55 + r() * 0.25).toFixed(3), resetsAt: Math.round(cw + 7 * D), start: Math.round(cw), basis: 'estimate' },
    { key: 'codex-5h', label: 'Codex · 五小时', kind: '5h', used: 0, usedEq: Math.round(4e6 + r() * 8e6), pct: null, resetsAt: Math.round(x5 + 5 * H), start: Math.round(x5), basis: 'log' },
    { key: 'codex-week', label: 'Codex · 本周', kind: 'week', used: 0, usedEq: Math.round(5e7 + r() * 5e7), pct: +(0.2 + r() * 0.2).toFixed(3), resetsAt: Math.round(xw + 7 * D), start: Math.round(xw), basis: 'estimate' },
  ];
  windows.forEach(w => { w.used = Math.round(w.usedEq * (6.2 + r() * 1.4)); });
  const sources = { claude: { label: 'Claude Code', kind: 'claude-code', account: 'Max' }, codex: { label: 'Codex', kind: 'codex', account: 'Plus' }, gemini: { label: 'Gemini CLI', kind: 'gemini-cli', account: '' }, cline: { label: 'Cline', kind: 'cline', account: 'GLM / Qwen' } };
  return { type: 'ledger', v: 1, days, hours, sources, windows, tools, agents: { active: 3, peakToday: 5 }, generatedAt: now, demo: true };
}

// ───────────────────────── 面板状态与入口 ─────────────────────────
const LGS = { data: null, live: false, demo: null, opts: {}, sel: null, mode: 'stack', hday: null, timer: 0, meta: {}, card: '' };
export function ledgerInit(opts = {}) {
  LGS.opts = opts; ledgerMetaRegister();
  if (typeof window === 'undefined' || LGS.bound) return; LGS.bound = true;
  window.addEventListener('message', e => {
    const m = e.data; if (!m || m.type !== 'ledger') return;
    if (!opts.vsc) { const o = e.origin || ''; if (!(o === location.origin || o === 'null' || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o))) return; }
    ledgerIngest(m);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('lgx')) { if (document.querySelector('.lg-cardbg')) lgCardClose(); else closeLedger(); } });
}
export function ledgerIngest(raw) {
  const L = normLedger(raw); if (!L) return null;
  LGS.data = L; LGS.live = true; LGS.buffs = rootBuffs(L); LGS.agent = agentBonus(L);
  if (document.getElementById('lgx')) lgRender();
  if (LGS.opts.onData) try { LGS.opts.onData(L); } catch (e) {}
  return L;
}
export const ledgerLive = () => LGS.live;
export function ledgerData() {
  if (LGS.data) return LGS.data;
  const day = lgKey(new Date());
  if (!LGS.demo || LGS.demoDay !== day) { LGS.demo = demoLedger('gucode', Date.now()); LGS.demoDay = day; }
  return LGS.demo;
}
export function openLedger(meta = {}) {
  LGS.meta = meta; LGS.sel = null; closeLedger();
  const box = document.createElement('div'); box.className = 'lgx'; box.id = 'lgx'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '算力履历');
  box.addEventListener('click', lgClick); document.body.appendChild(box);
  lgRender();
  LGS.timer = setInterval(lgTick, 1000);
}
export function closeLedger() { const b = document.getElementById('lgx'); if (b) b.remove(); clearInterval(LGS.timer); }
function lgRender() {
  const box = document.getElementById('lgx'); if (!box) return;
  const L = ledgerData(), st = ledgerStats(L);
  if (!LGS.sel || !L.days[LGS.sel]) LGS.sel = L.days[st.end] ? st.end : (Object.keys(L.days).sort().pop() || st.end);
  const vsc = !!LGS.opts.vsc, demo = !LGS.live;
  const note = !demo ? '' : vsc ? '插件还没推送履历数据，更新插件后这里换成你自己的记录' : '装 VS Code 插件或在终端运行本地桥后显示你自己的真实履历';
  const rng = `${st.from.replace(/-/g, '.')} — ${st.end.replace(/-/g, '.')}`;
  box.innerHTML = `<div class="lg-wrap">
  <header class="lg-top">${lgHills()}<div><p class="eyebrow">修行册</p><h2 class="lg-title">算力履历</h2><p class="lg-sub">${rng} · 你烧掉的每一个 token，都记在这本册子里</p></div><button class="x" data-lg="close" aria-label="关闭">×</button></header>
  ${demo ? `<div class="lg-demo"><b>演示数据</b><span>${note}</span></div>` : ''}
  <section class="lg-leaf" id="lgCal">${lgCalHTML(L, st)}</section>
  <div class="lg-cols"><div class="lg-col"><section class="lg-leaf" id="lgCurve">${lgCurveHTML(L)}</section><section class="lg-leaf" id="lgRoot">${lgRootHTML(L)}</section></div>
  <div class="lg-col"><section class="lg-leaf" id="lgQuota">${lgQuotaHTML(L)}</section><section class="lg-leaf" id="lgWork">${lgWorkHTML(L)}</section></div></div>
  <section class="lg-leaf" id="lgAch">${lgAchHTML(L)}</section>
  <footer class="lg-foot"><button class="zhu big" data-lg="card">生成年度履历卡</button><p class="sm">${demo ? '演示数据生成的卡片会印上「演示数据」。' : '只用到用量数字，不含任何代码与对话内容。'}</p></footer></div>`;
  lgScrollCal(); lgTick();
}
function lgHills() {   // 题头远山：两层淡墨
  const r = makeRng('lghills'), layer = (base, amp, ph) => { let d = 'M0 120'; for (let x = 0; x <= 600; x += 12) d += ` L${x} ${(base - amp * Math.pow(Math.sin(Math.PI * x / 600), 0.8) * (0.55 + 0.3 * Math.sin(x / 47 + ph) + 0.15 * Math.sin(x / 13 + ph * 2) * r())).toFixed(1)}`; return d + ' L600 120 Z'; };
  return `<svg class="lg-hills" viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden="true"><path d="${layer(96, 70, 1.3)}"/><path d="${layer(118, 52, 4.1)}"/></svg>`;
}
function lgScrollCal() { const sc = document.querySelector('#lgx .lg-calsc'); if (sc) sc.scrollLeft = sc.scrollWidth; }
function lgSection(id, html) { const s = document.getElementById(id); if (s) s.innerHTML = html; }
function lgClick(e) {
  const a = e.target.closest('[data-lg]'); if (!a) return;
  const L = ledgerData(), k = a.dataset.lg;
  if (k === 'close') closeLedger();
  else if (k === 'day') { const sc = document.querySelector('#lgx .lg-calsc'), x = sc ? sc.scrollLeft : 0; LGS.sel = a.dataset.d; lgSection('lgCal', lgCalHTML(L, ledgerStats(L))); const s2 = document.querySelector('#lgx .lg-calsc'); if (s2) s2.scrollLeft = x; }
  else if (k === 'mode') { LGS.mode = a.dataset.m; lgSection('lgCurve', lgCurveHTML(L)); }
  else if (k === 'hday') { LGS.hday = a.dataset.d; LGS.mode = 'day'; lgSection('lgCurve', lgCurveHTML(L)); }
  else if (k === 'limits') { if (LGS.opts.openSettings) LGS.opts.openSettings(); }
  else if (k === 'card') lgCardOpen();
  else if (k === 'save') lgCardSave();
  else if (k === 'uncard' || (k === 'cardbg' && e.target === a)) lgCardClose();
}
function lgTick() {
  const now = Date.now();
  document.querySelectorAll('#lgx [data-lg-reset]').forEach(n => { const t = +n.dataset.lgReset; n.textContent = t ? lgLeft(t - now) : '重置时间未知'; });
}
function lgLeft(ms) {
  if (ms <= 0) return '已轮转 · 等新数据';
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  return d ? `距轮转 ${d}天${h}时` : `距轮转 ${lgPad(h)}:${lgPad(m)}:${lgPad(s % 60)}`;
}
const lgHead = (seal, t, sub) => `<div class="lg-h"><i>${seal}</i><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;

// ───────────────────────── 修行日历 ─────────────────────────
function lgCalHTML(L, st) {
  const best = st.best ? `<small>最强一日 · ${lgMD(st.best.date)}</small><b>${lgCN(st.best.x)}</b>` : '<small>最强一日</small><b>—</b>';
  return `${lgHead('历', '修行日历', '近一年全量吞吐 · 墨越浓烧得越多 · 点一格看当天')}
  <div class="lg-stats"><div title="同期算力当量 ${lgCN(st.totalEq)}"><small>全年吞吐</small><b>${lgCN(st.total)}</b><small>token</small></div><div class="zhu">${best}</div>
  <div><small>当前连修</small><b>${st.cur}</b><small>日</small></div><div><small>最长连修</small><b>${st.longest.n}</b><small>日</small></div><div><small>修行</small><b>${st.active}</b><small>日</small></div></div>
  <div class="lg-calsc">${lgCalSVG(L, st)}</div>
  <div class="lg-legend"><span>少</span>${[0, 1, 2, 3, 4].map(l => `<i class="lg-sw l${l}"></i>`).join('')}<span>多</span><span class="lg-lgz"><i class="lg-sw best"></i>最强一日</span><span class="lg-lgz"><i class="lg-ln"></i>最长连修</span></div>
  <div class="lg-day">${lgDayHTML(L, LGS.sel)}</div>`;
}
function lgCalSVG(L, st) {
  const S = 13, C = 10.4, X0 = 22, Y0 = 18, end = lgDate(st.end), from = lgDate(st.from), start = lgAdd(from, -((from.getDay() + 6) % 7));
  const n = lgDiff(start, end) + 1, cols = Math.ceil(n / 7), W = X0 + cols * S + 4, H = Y0 + 7 * S + 18;
  let cells = '', mon = '', lastC = -9;
  for (let i = 0; i < n; i++) {
    const d = lgAdd(start, i), c = Math.floor(i / 7), w = i % 7, k = lgKey(d), t = lgX(L.days[k]), lv = lgLevel(t, st.q), h = hashStr(k);
    if (d.getDate() === 1 && c - lastC >= 3) { mon += `<text x="${X0 + c * S}" y="11" class="lg-mt">${LG_CN_NUM[d.getMonth() + 1]}月</text>`; lastC = c; }
    const j = ((h & 7) - 3.5) * 0.09, sz = C + ((h >> 3 & 3) - 1.5) * 0.25;
    const cls = `lg-c l${lv}${st.best && k === st.best.date ? ' best' : ''}${k === LGS.sel ? ' sel' : ''}`;
    cells += `<rect class="${cls}" x="${(X0 + c * S + j).toFixed(2)}" y="${(Y0 + w * S - j).toFixed(2)}" width="${sz.toFixed(2)}" height="${sz.toFixed(2)}" rx="2.2" data-lg="day" data-d="${k}"><title>${lgMD(k)} · ${t ? `吞吐 ${lgCN(t)} · 当量 ${lgCN(L.days[k].t)}` : '未修'}</title></rect>`;
  }
  const colOf = k => Math.floor(lgDiff(start, lgDate(k)) / 7), ly = Y0 + 7 * S + 6;
  const line = (a, b, cls) => { if (!a || !b) return ''; const ca = Math.max(0, colOf(a)), cb = Math.min(cols - 1, colOf(b)); if (cb < 0 || ca > cols - 1 || cb < ca) return ''; return `<path class="${cls}" d="M${X0 + ca * S} ${ly} Q${(X0 + (ca + cb) * S / 2 + C / 2).toFixed(1)} ${ly + 2.2} ${X0 + cb * S + C} ${ly - 0.6}"/>`; };
  const wk = ['一', '', '三', '', '五', '', '日'].map((t, w) => t ? `<text x="${X0 - 6}" y="${Y0 + w * S + 8.6}" class="lg-wt">${t}</text>` : '').join('');
  return `<svg class="lg-cal" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="近一年修行日历"><defs><filter id="lgBrush" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.7" xChannelSelector="R" yChannelSelector="G"/></filter></defs>
  ${mon}${wk}<g filter="url(#lgBrush)">${cells}</g>${line(st.longest.from, st.longest.to, 'lg-streak')}${st.cur && st.curFrom !== st.longest.from ? line(st.curFrom, st.end, 'lg-streak cur') : ''}</svg>`;
}
function lgBar(parts, cls) {
  const tot = lgSum(parts.map(p => p.v)) || 1;
  return `<div class="lg-bar ${cls}">${parts.map(p => `<i style="width:${(100 * p.v / tot).toFixed(2)}%;${p.st || ''}" class="${p.c || ''}" title="${lgEsc(p.n)} ${Math.round(100 * p.v / tot)}%"></i>`).join('')}</div>
  <ul class="lg-keys">${parts.map(p => `<li><i style="${p.st || ''}" class="${p.c || ''}"></i>${lgEsc(p.n)}<b>${Math.round(100 * p.v / tot)}%</b><small>${lgCN(p.v)}</small></li>`).join('')}</ul>`;
}
function lgDayHTML(L, k) {
  const d = L.days[k], dt = lgDate(k), tl = L.tools && L.tools[k];
  const head = `<div class="lg-dh"><b>${dt.getFullYear()}年${lgMD(k)}</b><small>周${'日一二三四五六'[dt.getDay()]}</small><span>${d && lgX(d) ? `${lgCN(lgX(d))} <small>token</small>` : '未修'}</span></div>`;
  if (!d || !lgX(d)) return head + '<p class="sm">这一天没有修炼记录。</p>';
  const two = `<div class="lg-two"><p><b>${lgCN(lgX(d))}</b>全量吞吐<small>含每轮重复读进来的上下文缓存，和 ccusage 等工具的口径一致</small></p><p><b>${lgCN(d.t)}</b>算力当量<small>读缓存只按一成计，养蛊吃的是这个</small></p></div>`;
  const rs = lgHas(d.sx), rm = lgHas(d.mx), ds = rs ? d.sx : d.s || {}, dm = rm ? d.mx : d.m || {};   // 插件给了 raw 拆分（sx/mx）就按全量显示，否则按当量
  const src = Object.entries(ds).sort((a, b) => b[1] - a[1]).map(([n, v], i) => ({ n: (L.sources && L.sources[n] && L.sources[n].label) || n, v, c: 'lg-s' + Math.min(i, 4) }));
  const mod = LG_FAMS.filter(f => dm[f]).map(f => ({ n: LG_FAM_NAME[f], v: dm[f], st: `background:var(--e-${lgFamElem(f)});opacity:${f === 'claude-sonnet' ? 0.7 : f === 'claude-haiku' ? 0.45 : 1}` }));
  return head + two + `<div class="lg-dgrid">${src.length ? `<div><h5>来源 · ${rs ? '全量' : '按当量'}</h5>${lgBar(src, 'src')}</div>` : ''}${mod.length ? `<div><h5>模型 · 灵根 · ${rm ? '全量' : '按当量'}</h5>${lgBar(mod, 'mod')}</div>` : ''}
  ${tl ? `<div class="lg-dtools"><h5>功课</h5><p>${LG_TOOLS.filter(([id]) => tl[id]).map(([id, n]) => `<span>${n}<b>${tl[id]}</b></span>`).join('')}</p></div>` : ''}</div>`;
}

// ───────────────────────── 日内曲线 ─────────────────────────
function lgSmooth(p, yMax) {
  if (!p.length) return '';
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c, cl = y => Math.min(yMax, y);
    d += ` C${(b[0] + (c[0] - a[0]) / 6).toFixed(1)} ${cl(b[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e[0] - b[0]) / 6).toFixed(1)} ${cl(c[1] - (e[1] - b[1]) / 6).toFixed(1)} ${c[0].toFixed(1)} ${c[1].toFixed(1)}`;
  }
  return d;
}
function lgCurveHTML(L) {
  const keys = Object.keys(L.hours || {}).sort().slice(-14), sc = ledgerShichen(L);
  if (!keys.length) return lgHead('时', '日内曲线', '最近 14 天') + '<p class="sm">还没有逐小时的记录。</p>';
  if (!LGS.hday || !keys.includes(LGS.hday)) LGS.hday = keys[keys.length - 1];
  const mode = LGS.mode, W = 400, H = 172, x0 = 8, x1 = 394, y0 = 12, y1 = 138, cw = x1 - x0;
  const all = keys.map(k => L.hours[k]), mx = Math.max(1, ...all.flat()), xh = h => x0 + (h + 0.5) / 24 * cw, yv = v => y1 - (y1 - y0) * v / mx;
  const avg = Array.from({ length: 24 }, (_, h) => lgSum(all.map(a => a[h])) / all.length), gd = new Date(L.generatedAt || Date.now()), gk = lgKey(gd);
  const pts = (a, k) => a.map((v, h) => [xh(h), yv(v)]).slice(0, k === gk ? gd.getHours() + 1 : 24);
  let bands = '', labs = '';
  for (let i = 0; i < 12; i++) {
    const a = Math.max(0, i * 2 - 1), b = Math.min(24, i * 2 + 1), hot = sc && sc.i === i;
    if (i % 2 || hot) bands += `<rect x="${(x0 + a / 24 * cw).toFixed(1)}" y="${y0}" width="${((b - a) / 24 * cw).toFixed(1)}" height="${y1 - y0}" class="${hot ? 'lg-band hot' : 'lg-band'}"/>${i === 0 ? `<rect x="${(x0 + 23 / 24 * cw).toFixed(1)}" y="${y0}" width="${(cw / 24).toFixed(1)}" height="${y1 - y0}" class="${hot ? 'lg-band hot' : 'lg-band'}"/>` : ''}`;
    const lx = i === 0 ? [x0 + 0.5 / 24 * cw, x0 + 23.5 / 24 * cw] : [x0 + i * 2 / 24 * cw];
    lx.forEach(x => { labs += `<text x="${x.toFixed(1)}" y="${y1 + 16}" class="lg-st${hot ? ' hot' : ''}">${LG_SHI[i]}</text>`; });
  }
  const grid = [0.5, 1].map(f => `<line x1="${x0}" x2="${x1}" y1="${yv(mx * f).toFixed(1)}" y2="${yv(mx * f).toFixed(1)}" class="lg-gl"/><text x="${x0 + 3}" y="${(yv(mx * f) - 3).toFixed(1)}" class="lg-yt">${lgCN(mx * f)}/时</text>`).join('');
  let lines = '';
  if (mode === 'day') {
    const p = pts(L.hours[LGS.hday], LGS.hday), d = lgSmooth(p, y1);
    lines = `<path d="${lgSmooth(pts(avg), y1)}" class="lg-avg ghost"/><path d="${d} L${p[p.length - 1][0].toFixed(1)} ${y1} L${p[0][0].toFixed(1)} ${y1} Z" class="lg-area"/><path d="${d}" class="lg-one"/>`;
  } else {
    lines = keys.map((k, i) => `<path d="${lgSmooth(pts(L.hours[k], k), y1)}" class="lg-old" style="stroke-opacity:${(0.1 + 0.32 * i / Math.max(1, keys.length - 1)).toFixed(2)}"/>`).join('') + `<path d="${lgSmooth(pts(avg), y1)}" class="lg-avg"/><path d="${lgSmooth(pts(all[all.length - 1], keys[keys.length - 1]), y1)}" class="lg-today"/>`;
  }
  const chips = keys.map((k, i) => { const dt = lgDate(k); return `<button data-lg="hday" data-d="${k}" class="${mode === 'day' && k === LGS.hday ? 'on' : ''}">${i === keys.length - 1 ? '今' : dt.getDate()}</button>`; }).join('');
  const hd = mode === 'day' ? lgDate(LGS.hday) : null;
  return `${lgHead('时', '日内曲线', '最近 14 天 · 每小时全量吞吐')}
  <div class="lg-seg2"><button data-lg="mode" data-m="stack" class="${mode !== 'day' ? 'on' : ''}">叠加</button><button data-lg="mode" data-m="day" class="${mode === 'day' ? 'on' : ''}">逐日</button></div>
  ${sc ? `<p class="lg-insight">你最常在<b>${sc.ch}时</b>修炼<small>${sc.alias} · ${sc.range} · 占 ${Math.round(sc.share * 100)}%</small></p>` : ''}
  <svg class="lg-curve" viewBox="0 0 ${W} ${H}" role="img" aria-label="日内 token 曲线">${bands}${grid}<line x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}" class="lg-axis"/>${lines}${labs}</svg>
  <p class="lg-cap">${mode === 'day' ? `${hd.getMonth() + 1}月${hd.getDate()}日 · 全天 ${lgCN(lgSum(L.hours[LGS.hday]))} · 淡线是十四日平均` : `${keys[keys.length - 1] === gk ? '朱线是今日（到此刻）' : '朱线是最近一日'} · 浓墨是十四日平均 · 淡墨是往日`}</p>
  ${mode === 'day' ? `<div class="lg-chips">${chips}</div>` : ''}`;
}

// ───────────────────────── 周天额度 ─────────────────────────
const lgLimits = () => { try { return (LGS.opts.getLimits && LGS.opts.getLimits()) || {}; } catch (e) { return {}; } };
export const lgWinPct = (w, lim = {}) => w.pct != null ? w.pct : lim[w.key] > 0 ? w.used / lim[w.key] : null;
function lgArc(cx, cy, r, f) {
  f = Math.max(0, Math.min(0.9999, f)); if (f <= 0) return '';
  const a = -Math.PI / 2 + f * 2 * Math.PI, x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
  return `M${cx} ${cy - r} A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
}
function lgRing(pct, tf) {
  let ticks = ''; for (let i = 0; i < 60; i++) { const a = i / 60 * 2 * Math.PI - Math.PI / 2, l = i % 5 ? 3 : 6, r1 = 47, r2 = r1 - l; ticks += `M${(50 + r1 * Math.cos(a)).toFixed(1)} ${(50 + r1 * Math.sin(a)).toFixed(1)}L${(50 + r2 * Math.cos(a)).toFixed(1)} ${(50 + r2 * Math.sin(a)).toFixed(1)}`; }
  const full = pct != null && pct >= 0.9;
  return `<svg viewBox="0 0 100 100" class="lg-ring" aria-hidden="true"><path d="${ticks}" class="lg-tick"/>${tf != null ? `<path d="${lgArc(50, 50, 39.5, tf)}" class="lg-tarc"/>` : ''}<circle cx="50" cy="50" r="32" class="lg-track"/>${pct != null ? `<path d="${lgArc(50, 50, 32, pct)}" class="lg-uarc${full ? ' full' : ''}"/>` : ''}
  <text x="50" y="${pct != null ? 54 : 56}" class="lg-rp">${pct != null ? Math.round(pct * 100) + '<tspan>%</tspan>' : '—'}</text></svg>`;
}
function lgQuotaHTML(L) {
  const ws = (L.windows || []).slice().sort((a, b) => (a.kind === b.kind ? 0 : a.kind === '5h' ? -1 : 1)), lim = lgLimits(), now = Date.now();
  if (!ws.length) return lgHead('周', '周天额度', '五小时 / 每周窗口') + '<p class="sm">插件还没读到额度窗口。</p>';
  return `${lgHead('周', '周天额度', '五小时与每周窗口 · 外圈细线是时间走了多少')}<div class="lg-quota">${ws.map(w => {
    const p = lgWinPct(w, lim), user = w.pct == null && p != null, tf = w.start && w.resetsAt && w.resetsAt > w.start ? (now - w.start) / (w.resetsAt - w.start) : null;
    return `<div class="lg-q">${lgRing(p, tf)}<b>${lgEsc(w.label)}</b><span class="lg-qu" title="全量吞吐，含每轮重复读的上下文缓存">已用 ${lgCN(w.used)}</span>${w.usedEq ? `<span class="lg-qe" title="读缓存按一成计">当量 ${lgCN(w.usedEq)}</span>` : ''}<span class="lg-qt" data-lg-reset="${w.resetsAt || 0}"></span>
    <span class="lg-tags">${w.basis === 'estimate' ? '<i class="lg-tag">估算</i>' : ''}${user ? '<i class="lg-tag">按你填的上限</i>' : ''}${p == null ? '<button class="lg-link" data-lg="limits" title="在设置里填这个窗口的上限">上限未知 · 去填</button>' : ''}</span></div>`;
  }).join('')}</div>`;
}
// 设置面板：插件给不出 pct 的窗口，让玩家自己填上限
export function ledgerLimitRows() {
  const L = ledgerData(), ws = (L.windows || []).filter(w => w.pct == null); if (!ws.length) return '';
  const lim = lgLimits();
  return `<div class="set lg-limhead"><span>周天额度上限<small>插件读不到上限的窗口，填上就能显示百分比。和「已用」同口径（全量吞吐），可写 5亿、5000万、50M 或纯数字，清空即取消</small></span></div>` +
    ws.map(w => `<label class="set lg-lim"><span>${lgEsc(w.label)}</span><input data-lglim="${lgEsc(w.key)}" inputmode="decimal" placeholder="例如 5亿" value="${lim[w.key] ? lgCN(lim[w.key]) : ''}"></label>`).join('');
}
export function ledgerBindLimits(root) {
  if (!root) return root;
  root.querySelectorAll('[data-lglim]').forEach(inp => inp.addEventListener('change', () => {
    const v = lgParseTok(inp.value); if (LGS.opts.setLimit) LGS.opts.setLimit(inp.dataset.lglim, v);
    inp.value = v ? lgCN(v) : ''; const L = ledgerData(); lgSection('lgQuota', lgQuotaHTML(L)); lgTick();
  }));
  return root;
}

// ───────────────────────── 灵根 ─────────────────────────
function lgRootSVG(sh, roots) {
  const cx = 120, cy = 114, R = 74, pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const ring = f => LG_EK.map((_, i) => pt(i, R * f).map(v => v.toFixed(1)).join(' ')).join(' L');
  const star = [0, 2, 4, 1, 3].map(i => pt(i, R).map(v => v.toFixed(1)).join(' ')).join(' L');
  const poly = LG_EK.map((e, i) => pt(i, R * Math.max(0.05, Math.sqrt(sh[e] || 0))).map(v => v.toFixed(1)).join(' ')).join(' L');
  const nodes = LG_EK.map((e, i) => { const [x, y] = pt(i, R + 22), on = roots.includes(e), p = Math.round((sh[e] || 0) * 100); return `<g class="lg-en${on ? ' on' : ''}" style="--ec:var(--e-${e})"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="14"/><text x="${x.toFixed(1)}" y="${(y + 5.5).toFixed(1)}" class="lg-ech">${LG_ELEM[e].ch}</text><text x="${(x + (i === 0 ? 19 : 0)).toFixed(1)}" y="${(y + (i === 0 ? 4 : 28)).toFixed(1)}" class="lg-ep${i === 0 ? ' st' : ''}">${p}%</text></g>`; }).join('');
    return `<svg class="lg-rootsvg" viewBox="0 0 240 240" role="img" aria-label="五行灵根图"><circle cx="${cx}" cy="${cy}" r="${R}" class="lg-r0"/><path d="M${star} Z" class="lg-r1"/><path d="M${ring(0.5)} Z" class="lg-r2"/><path d="M${ring(1)} Z" class="lg-r2"/><path d="M${poly} Z" class="lg-rpoly" filter="url(#lgBrush)"/>${nodes}</svg>`;
}
function lgRootHTML(L) {
  const b = rootBuffs(L, { demo: true });
  return `${lgHead('根', '灵根', '近 7 天各模型族的 token 占比')}
  <div class="lg-root">${lgRootSVG(b.shares, b.roots)}<div class="lg-verdict"><p class="lg-vk">判词</p><h4>${b.verdict}</h4><p class="lg-verse">${b.verse}</p>
  <p class="lg-map">${['jin', 'shui', 'mu', 'huo', 'tu'].map(e => `<span style="--ec:var(--e-${e})"><i></i>${LG_ELEM[e].ch} ${LG_ELEM[e].fam}<b>${Math.round(b.shares[e] * 100)}%</b></span>`).join('')}<span style="--ec:var(--e-hun)"><i></i>混沌 其他<b>${Math.round(b.shares.hun * 100)}%</b></span></p>
  <p class="lg-buff">${b.kind === 'none' ? '' : `灵根加成${lgBuffTag()}：${rootBuffText(b)}`}</p></div></div>`;
}

// ───────────────────────── 功课 · 分神 ─────────────────────────
const lgWisp = (i, cls = '') => `<svg viewBox="0 0 20 30" class="lg-wisp ${cls}" style="animation-delay:${(-i * 0.73).toFixed(2)}s" aria-hidden="true"><path d="M10 3c4.4 0 6.6 3.6 6 7.6-.5 4-3.6 6.2-4.6 10.2-.6 2.6 1 5 3.2 6.2-4.6.4-8-2.4-8.2-6.2-.2-3.2-2.4-5.4-2.4-9.6C4 7 6.4 3 10 3z"/><circle cx="8.2" cy="9.6" r="1.1"/><circle cx="12.4" cy="9.6" r="1.1"/></svg>`;
function lgWorkHTML(L) {
  const keys = Object.keys(L.tools || {}).sort(), tk = keys[keys.length - 1], t = tk ? L.tools[tk] : null, ab = agentBonus(L, { demo: true });
  const prev = keys.slice(-8, -1).map(k => L.tools[k]), avg = id => prev.length ? lgSum(prev.map(o => o[id] || 0)) / prev.length : 0;
  const mx = t ? Math.max(1, ...LG_TOOLS.map(([id]) => Math.max(t[id] || 0, avg(id)))) : 1;
  const rows = t ? LG_TOOLS.map(([id, n, d]) => { const v = t[id] || 0, av = avg(id); return `<li title="${id} · ${d}"><b>${n}<small>${id}</small></b><span class="lg-tb"><i style="width:${(100 * v / mx).toFixed(1)}%"></i>${av ? `<u style="left:${(100 * av / mx).toFixed(1)}%"></u>` : ''}</span><em>${v}</em><small class="lg-cmp">${av ? '均 ' + Math.round(av) : ''}</small></li>`; }).join('') : '';
  const a = (L.agents && L.agents.active) || 0, pk = (L.agents && L.agents.peakToday) || 0;
  return `${lgHead('课', '功课', tk ? `${tk === lgKey(new Date()) ? '今日' : lgMD(tk)}各类工具调用次数 · 竖线是前七日均值` : '')}
  ${t ? `<ul class="lg-tools">${rows}</ul>` : '<p class="sm">还没有工具调用记录。</p>'}
  <div class="lg-agents">${lgHead('神', '分神', '此刻同时在跑的 agent')}
  <div class="lg-ag"><b>${a}</b><span class="lg-wisps">${Array.from({ length: Math.min(AGENT_TUNE.maxShades, a) }, (_, i) => lgWisp(i)).join('')}</span></div>
  <p class="sm">今日峰值 ${pk} · ${ab.show ? `${ab.label}：元石 +${Math.round(Math.min(AGENT_TUNE.cap, AGENT_TUNE.per * (a - 1)) * 100)}%${lgBuffTag()}，封顶 +${Math.round(AGENT_TUNE.cap * 100)}%` : '两个以上 agent 同时在跑时，元石略有加成'}</p></div>`;
}
function lgAchHTML(L) {
  const got = new Set(ledgerAchievements(L, { demo: true, limits: lgLimits() }).map(a => a.id)), TN = { bronze: '铜', silver: '银', gold: '金' };
  return `${lgHead('成', '履历成就', LGS.live ? '' : '演示数据只预览，不计入成就')}<ul class="lg-achs">${LEDGER_ACHS.map(a => `<li class="${got.has(a.id) ? 'on' : ''} t-${a.tier}"><span class="lg-as">${got.has(a.id) ? '成' : TN[a.tier]}</span><b>${a.n}</b><small>${a.d}</small></li>`).join('')}</ul>`;
}

// 空窍上方的分神小影（网页演示也挂；插件里只在收到真实数据后挂）
export function ledgerShades(host) {
  if (!host) return;
  let box = host.querySelector('.lg-shades');
  const show = LGS.live ? lgFresh() : !LGS.opts.vsc, L = show ? ledgerData() : null, b = L ? agentBonus(L) : { show: false };
  if (!b.show) { if (box) box.remove(); return; }
  if (!box) { box = document.createElement('button'); box.className = 'lg-shades'; box.dataset.act = 'ledger'; const qh = host.querySelector('.qhead'); if (qh) qh.after(box); else host.prepend(box); }
  box.title = '同时在跑的 agent · 点开算力履历';
  box.innerHTML = Array.from({ length: b.shades }, (_, i) => lgWisp(i, 'lg-wsm')).join('') + `<span>${b.label}${b.pct && LGS.opts.buffsOn ? ` · 元石 +${Math.round(b.pct * 100)}%` : LGS.live ? '' : ' · 演示'}</span>`;
}

// ───────────────────────── 年度履历卡 ─────────────────────────
function lgCardOpen() {
  const box = document.getElementById('lgx'); if (!box) return;
  const bg = document.createElement('div'); bg.className = 'lg-cardbg'; bg.dataset.lg = 'cardbg';
  bg.innerHTML = `<div class="lg-cardbox"><button class="x" data-lg="uncard" aria-label="关闭">×</button><h3>年度履历卡</h3><p class="sm">1080 × 1350，适合朋友圈、小红书与 X。</p><div class="lg-cardimg"><span class="sm">研墨中…</span></div><div class="row2"><button class="zhu" data-lg="save">保存 PNG</button></div></div>`;
  box.appendChild(bg);
  setTimeout(() => {
    try { LGS.card = makeLedgerCard(ledgerData(), LGS.meta); const im = bg.querySelector('.lg-cardimg'); if (im) im.innerHTML = `<img src="${LGS.card}" alt="年度算力履历卡">`; }
    catch (e) { const im = bg.querySelector('.lg-cardimg'); if (im) im.textContent = '生成失败：' + e.message; }
  }, 30);
}
function lgCardClose() { const b = document.querySelector('.lg-cardbg'); if (b) b.remove(); }
function lgCardSave() {
  if (!LGS.card) return;
  if (LGS.opts.vsc) LGS.opts.vsc.postMessage({ type: 'savePng', data: LGS.card });
  else { const a = document.createElement('a'); a.href = LGS.card; a.download = `gucode-ledger-${lgKey(new Date())}.png`; document.body.appendChild(a); a.click(); a.remove(); }
}
const LG_KAI = '"Kaiti SC","STKaiti","KaiTi","BiauKai",serif', LG_SANS = '-apple-system,"PingFang SC","Microsoft YaHei",system-ui,sans-serif';
const LG_CARD = { ink: '#1c1915', mu: '#5b5244', mu2: '#8a7f6d', zhu: '#b5301f', paper: '#efe7d3', slip: '#f7f2e4', e: { mu: '#4e7a58', huo: '#b5301f', tu: '#9a7434', jin: '#a8894e', shui: '#3d5f7a', hun: '#7d7466' } };
function lgSeal(ctx, x, y, text, fs, rot) {
  const ch = [...text], w = fs * 1.3, h = fs * ch.length + fs * 0.5;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = LG_CARD.zhu; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w / 2, -h / 2, w, h, 4) : ctx.rect(-w / 2, -h / 2, w, h); ctx.fill();
  ctx.strokeStyle = 'rgba(247,240,224,.85)'; ctx.lineWidth = 2.4; ctx.strokeRect(-w / 2 + 7, -h / 2 + 7, w - 14, h - 14);
  ctx.fillStyle = '#f7efdc'; ctx.font = `${fs}px ${LG_KAI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ch.forEach((c, i) => ctx.fillText(c, 0, -h / 2 + fs * 0.75 + i * fs));
  // 印泥不匀：随机擦掉几处
  let s = hashStr(text); const rr = () => (s = (s * 16807) % 2147483647) / 2147483647;
  ctx.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 26; i++) { ctx.globalAlpha = 0.15 + rr() * 0.35; ctx.beginPath(); ctx.arc((rr() - 0.5) * w, (rr() - 0.5) * h, 0.8 + rr() * 2.6, 0, 6.29); ctx.fill(); }
  ctx.restore();
}
function lgMountains(ctx, r, W, top, bottom) {
  [[0.05, 0.62, 5], [0.075, 0.42, 4], [0.11, 0.22, 3]].forEach(([a, hf, oct]) => {
    const n = 64, ys = [], base = bottom, amp = (bottom - top) * hf; let ph1 = r() * 6, ph2 = r() * 6;
    for (let i = 0; i <= n; i++) { const x = i / n; let y = 0; for (let o = 1; o <= oct; o++) y += Math.sin(x * Math.PI * (o * 1.7) + ph1 * o + ph2) / o; ys.push(base - amp * (0.55 + 0.35 * y) * (0.6 + 0.4 * Math.sin(x * Math.PI))); }
    ctx.fillStyle = `rgba(28,25,21,${a})`; ctx.beginPath(); ctx.moveTo(0, bottom);
    ys.forEach((y, i) => ctx.lineTo(i / n * W, y)); ctx.lineTo(W, bottom); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(28,25,21,${a * 1.4})`; ctx.lineWidth = 1.2; ctx.beginPath(); ys.forEach((y, i) => i ? ctx.lineTo(i / n * W, y) : ctx.moveTo(0, y)); ctx.stroke();
  });
}
// meta = { name, title, realm, url }；返回 PNG dataURL
export function makeLedgerCard(L, meta = {}) {
  L = L || ledgerData();
  const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), K = LG_CARD, st = ledgerStats(L), rb = rootBuffs(L, { demo: true }), r = makeRng('lgcard:' + st.end), url = meta.url || LG_GAME_URL;
  const P = 92, IN = 62;
  ctx.fillStyle = K.paper; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { ctx.strokeStyle = `rgba(110,84,48,${0.018 + r() * 0.04})`; ctx.lineWidth = 0.5 + r() * 0.9; const x = r() * W, y = r() * H, a = r() * 6.28, l = 5 + r() * 28; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + r() * 5, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
  ctx.save(); ctx.filter = 'blur(40px)'; for (let i = 0; i < 7; i++) { ctx.fillStyle = `rgba(150,118,70,${0.025 + r() * 0.03})`; ctx.beginPath(); ctx.ellipse(r() * W, r() * H, 60 + r() * 140, 40 + r() * 90, r() * 3, 0, 6.29); ctx.fill(); } ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(IN, IN, W - IN * 2, H - IN * 2); ctx.clip(); lgMountains(ctx, r, W, 1170, H - IN); ctx.restore();
  ctx.strokeStyle = 'rgba(28,25,21,.55)'; ctx.lineWidth = 2.2; ctx.strokeRect(46, 46, W - 92, H - 92); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(28,25,21,.35)'; ctx.strokeRect(IN, IN, W - IN * 2, H - IN * 2);
  // 题头
  const end = lgDate(st.end), y = end.getFullYear(), gz = '甲乙丙丁戊己庚辛壬癸'[((y - 4) % 10 + 10) % 10] + '子丑寅卯辰巳午未申酉戌亥'[((y - 4) % 12 + 12) % 12], season = '冬冬春春春夏夏夏秋秋秋冬'[end.getMonth()];
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = K.ink; ctx.font = `118px ${LG_KAI}`; ctx.fillText('算力履历', P, 214);
  ctx.fillStyle = K.mu; ctx.font = `34px ${LG_KAI}`; ctx.fillText(`${gz}年${season} · ${(meta.name || '无名蛊师').slice(0, 8)} 记`, P + 4, 272);
  ctx.fillStyle = K.mu2; ctx.font = `24px ${LG_SANS}`; ctx.fillText(`${st.from.replace(/-/g, '.')} — ${st.end.replace(/-/g, '.')}`, P + 4, 314);
  lgSeal(ctx, W - P - 46, 214, String(meta.title || ledgerTitle(st.total)).slice(0, 5), 52, 0.05);
  const sub = [meta.realm, meta.rank && meta.rank !== '无名蛊师' ? meta.rank : ''].filter(Boolean);
  if (sub.length) { ctx.fillStyle = K.mu; ctx.font = `26px ${LG_KAI}`; ctx.textAlign = 'center'; sub.forEach((t, i) => ctx.fillText(t, W - P - 46, 372 + i * 34, 220)); ctx.textAlign = 'left'; }
  // 全年总量
  ctx.fillStyle = K.mu; ctx.font = `34px ${LG_KAI}`; ctx.fillText('全年吞吐', P, 392);
  const tv = lgCN(st.total), num = tv.replace(/[亿万]$/, ''), unit = (tv.match(/[亿万]$/) || [''])[0];
  ctx.fillStyle = K.ink; ctx.font = `150px ${LG_KAI}`; ctx.fillText(num, P - 6, 528); let tx = P - 6 + ctx.measureText(num).width + 10;
  ctx.font = `64px ${LG_KAI}`; ctx.fillText(unit, tx, 524); tx += ctx.measureText(unit).width + 14;
  ctx.fillStyle = K.mu; ctx.font = `32px ${LG_SANS}`; ctx.fillText('token', tx, 522);
  if (st.totalEq) { ctx.fillStyle = K.mu2; ctx.font = `22px ${LG_KAI}`; ctx.fillText(`算力当量 ${lgCN(st.totalEq)} · 读缓存按一成计`, P + 2, 562); }
  if (L.demo) { ctx.save(); ctx.translate(W - P - 92, 488); ctx.rotate(-0.08); ctx.strokeStyle = K.zhu; ctx.lineWidth = 3; ctx.strokeRect(-92, -34, 184, 62); ctx.fillStyle = K.zhu; ctx.font = `36px ${LG_KAI}`; ctx.textAlign = 'center'; ctx.fillText('演示数据', 0, 11); ctx.restore(); }
  // 修行日历
  const from = lgDate(st.from), start = lgAdd(from, -((from.getDay() + 6) % 7)), n = lgDiff(start, end) + 1, cols = Math.ceil(n / 7);
  const gx = P, gy = 630, step = (W - P * 2) / cols, cs = step * 0.82, alpha = [0.06, 0.2, 0.4, 0.66, 0.9];
  ctx.font = `20px ${LG_KAI}`; ctx.fillStyle = K.mu2; let lastC = -9;
  for (let i = 0; i < n; i++) {
    const d = lgAdd(start, i), c = Math.floor(i / 7), w = i % 7, k = lgKey(d), t = lgX(L.days[k]), lv = lgLevel(t, st.q);
    if (d.getDate() === 1 && c - lastC >= 4) { ctx.fillStyle = K.mu2; ctx.fillText(LG_CN_NUM[d.getMonth() + 1] + '月', gx + c * step, gy - 14); lastC = c; }
    const x = gx + c * step + (r() - 0.5) * 1.2, yy = gy + w * step + (r() - 0.5) * 1.2, best = st.best && k === st.best.date;
    ctx.fillStyle = best ? K.zhu : `rgba(28,25,21,${alpha[lv]})`; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, yy, cs, cs, 3) : ctx.rect(x, yy, cs, cs); ctx.fill();
    if (lv >= 2 || best) { ctx.fillStyle = best ? 'rgba(120,20,10,.35)' : `rgba(28,25,21,${alpha[lv] * 0.35})`; ctx.beginPath(); ctx.arc(x + cs * (0.3 + r() * 0.4), yy + cs * (0.35 + r() * 0.35), cs * (0.18 + r() * 0.14), 0, 6.29); ctx.fill(); }
  }
  const ly = gy + 7 * step + 12, colOf = k => Math.floor(lgDiff(start, lgDate(k)) / 7);
  if (st.longest.from) {
    const ca = Math.max(0, colOf(st.longest.from)), cb = Math.min(cols - 1, colOf(st.longest.to));
    if (cb >= ca) { ctx.strokeStyle = K.zhu; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(gx + ca * step, ly); ctx.quadraticCurveTo(gx + (ca + cb) * step / 2, ly + 5, gx + cb * step + cs, ly - 1); ctx.stroke(); ctx.fillStyle = K.zhu; ctx.font = `22px ${LG_KAI}`; ctx.fillText(`最长连修 ${st.longest.n} 日`, Math.min(gx + ca * step, W - P - 190), ly + 34); }
  }
  ctx.font = `20px ${LG_KAI}`; ctx.fillStyle = K.mu2; ctx.textAlign = 'right'; ctx.fillText('少', W - P - 5 * 26 - 8, ly + 34);
  alpha.forEach((a, i) => { ctx.fillStyle = `rgba(28,25,21,${a})`; ctx.fillRect(W - P - (5 - i) * 26 + 4, ly + 17, 20, 20); }); ctx.fillStyle = K.mu2; ctx.textAlign = 'left'; ctx.fillText('多', W - P + 6, ly + 34);
  // 三栏数字
  const sy = 862, cw3 = (W - P * 2) / 3, stats = [['最强一日', st.best ? lgCN(st.best.x) : '—', st.best ? lgMD(st.best.date) : ''], ['最长连修', st.longest.n + ' 日', st.cur ? `此刻连修 ${st.cur} 日` : ''], ['修行', st.active + ' 日', `一年 365 日`]];
  stats.forEach(([a, b, c], i) => {
    const x = P + i * cw3 + (i ? 28 : 0);
    if (i) { ctx.strokeStyle = 'rgba(28,25,21,.25)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(P + i * cw3, sy - 30); ctx.lineTo(P + i * cw3 + 2, sy + 82); ctx.stroke(); }
    ctx.fillStyle = K.mu2; ctx.font = `26px ${LG_KAI}`; ctx.fillText(a, x, sy);
    ctx.fillStyle = i === 0 ? K.zhu : K.ink; ctx.font = `58px ${LG_KAI}`; ctx.fillText(b, x, sy + 62);
    ctx.fillStyle = K.mu; ctx.font = `22px ${LG_KAI}`; ctx.fillText(c, x, sy + 98);
  });
  // 灵根：五角图 + 判词
  const rcx = P + 90, rcy = 1094, R = 62, pt = (i, rr) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return [rcx + rr * Math.cos(a), rcy + rr * Math.sin(a)]; };
  ctx.strokeStyle = 'rgba(28,25,21,.28)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(rcx, rcy, R, 0, 6.29); ctx.stroke();
  ctx.beginPath(); [0, 2, 4, 1, 3, 0].forEach((i, j) => { const [x, yy] = pt(i, R); j ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }); ctx.strokeStyle = 'rgba(28,25,21,.14)'; ctx.stroke();
  ctx.beginPath(); LG_EK.forEach((e, i) => { const [x, yy] = pt(i, R * Math.max(0.06, Math.sqrt(rb.shares[e] || 0))); i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }); ctx.closePath(); ctx.fillStyle = 'rgba(28,25,21,.26)'; ctx.fill(); ctx.strokeStyle = 'rgba(28,25,21,.75)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  LG_EK.forEach((e, i) => { const [x, yy] = pt(i, R + 20), on = rb.roots.includes(e); ctx.beginPath(); ctx.arc(x, yy, 16, 0, 6.29); if (on) { ctx.fillStyle = K.e[e]; ctx.fill(); } else { ctx.fillStyle = K.paper; ctx.fill(); ctx.strokeStyle = K.e[e]; ctx.lineWidth = 1.6; ctx.stroke(); } ctx.fillStyle = on ? '#f7efdc' : K.e[e]; ctx.font = `20px ${LG_KAI}`; ctx.fillText(LG_ELEM[e].ch, x, yy + 1); });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const vx = P + 214; ctx.fillStyle = K.mu2; ctx.font = `24px ${LG_KAI}`; ctx.fillText('灵根判词', vx, 1040);
  ctx.fillStyle = K.ink; ctx.font = `60px ${LG_KAI}`; ctx.fillText(rb.verdict, vx, 1106, 470);
  ctx.fillStyle = K.mu; ctx.font = `28px ${LG_KAI}`; ctx.fillText(rb.verse, vx, 1150, 470);
  ctx.fillStyle = K.mu2; ctx.font = `20px ${LG_SANS}`; ctx.fillText(LG_EK.filter(e => rb.shares[e] >= 0.005).sort((a, b) => rb.shares[b] - rb.shares[a]).map(e => `${LG_ELEM[e].ch} ${Math.round(rb.shares[e] * 100)}%`).join('  ·  '), vx, 1184, 470);
  // 落款与二维码
  const qs = 168, qx = W - P - qs, qy = 1012;
  ctx.fillStyle = K.slip; ctx.fillRect(qx - 10, qy - 10, qs + 20, qs + 52); ctx.strokeStyle = 'rgba(28,25,21,.25)'; ctx.lineWidth = 1; ctx.strokeRect(qx - 10, qy - 10, qs + 20, qs + 52);
  qrDraw(ctx, url, qx, qy, qs, K.ink, K.slip);
  ctx.fillStyle = K.mu; ctx.font = `22px ${LG_KAI}`; ctx.textAlign = 'center'; ctx.fillText('扫码养一窝蛊', qx + qs / 2, qy + qs + 30); ctx.textAlign = 'left';
  ctx.fillStyle = K.ink; ctx.font = `40px ${LG_KAI}`; ctx.fillText('蛊码', P, H - 94); const bw = ctx.measureText('蛊码').width;
  ctx.fillStyle = K.mu; ctx.font = `24px ${LG_KAI}`; ctx.fillText('烧 Token · 养蛊 · 斗道', P + bw + 18, H - 96);
  ctx.fillStyle = K.mu2; ctx.font = `19px ${LG_SANS}`; ctx.fillText(url.replace(/^https?:\/\//, '').replace(/\/$/, ''), P + bw + 18, H - 70);
  return cv.toDataURL('image/png');
}
