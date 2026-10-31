// 蛊码 GuCode · 斗蛊引擎 v2（纯函数，种子随机，可复现）。规格见 docs/battle-spec.md，规则见 docs/design.md 2.5 / 3.5 / 第 8 节。
// 双方各一块 3×3 阵盘（列 c：0 前 1 中 2 后；行 r：0–2）。速度决定出手顺序（行动条），出手和挨打攒蛊力，蛊力满了放主动技；
// 近战打同一行最靠前的敌蛊（这一行没人打最近的一行），远程按 aim 挑；技能有形状和位移。输出事件流 + 每步快照，渲染层只负责回放。
import { makeRng, SP, SUMMON_NAMES, SLOTS, natOf, awOf, guRank, daoOf, COMBOS, XING, decodeTeam, statFor, baseRank, lowOk } from './core.js';
import { natK } from './bestiary2.js';
import { DAO } from './daos.js';
import { FOOD } from './foods.js';
import { BX, NEW_TRAITS } from './bestiary.js';   // 现有 64 种本命技（钩子式）照旧由 BX 派发，炉口 = 最前、对撞 = 普攻、回合开始 = 每轮开始

// HPK：战斗血量 = 卡面血 × HPK；DIST：行动条长度（速 100 的蛊每 DIST 个时间单位出手一次 = 一轮）
// SPD_K：速对出手间隔的影响系数（速 120 的蛊出手频率 = 1 + 0.2 × SPD_K 倍），让速度有意义又不一边倒
export const HPK = 1;   // 卡面血就是战斗里的血（core.HP_SCALE 已把卡面血乘 4）
export const DIST = 100;
export const SPD_K = 0.10;
export const MAXROUND = 30;
// OFF_MX：拿自己最大血量打人（伤害、毒灼）时血量按 1/OFF_MX 算。血量大约是攻的 8 倍，不折算的话「最大血量 16% 的伤害」会比「攻击 16%」强好几倍。和 HPK 无关，HPK 改成 1 以后照样生效
export const OFF_MX = 4;
const ROWS = 3, COLS = 3;
// RES_K：道共鸣数值整体折算（design.md 2.6：道共鸣只给轻量加成，配合比堆道重要）
export const RES_K = 0.5;
// 状态与杀招的总体强度（模拟按道、杀招、单种蛊的胜率调）：灼烧每轮伤害、毒每轮伤害、寒每层减速、杀招效果
// actUp：主动技每高一转效果涨多少（没写 up 的）；upMul：所有写了 up 的效果（被动技等）每转涨幅再乘这个数。压低这两个，转数集中的阵容就没那么占便宜
export const TUNE = { burn: 1, psn: 1, chill: 0.15, combo: 1, actUp: 0.06, upMul: 0.5 };
export const GP = { act: 34, charge: 60, hit: 15, cap: 100, start: 20 };
export const CRIT = { p: 0.1, mul: 1.5 };
const MAXOPS = 20000, MAXACT = 900, CAP = SLOTS, INFLICT = new Set(['psn', 'para', 'burn', 'chill', 'stun', 'web', 'mark', 'seal', 'tie']);

// ---------- 物种的战斗档案（内容专家在物种上写 spd / reach / aim / atkFx / act 后以物种为准） ----------
// [速, 近远程 m/r, 普攻动作, 远程挑谁]
const DEF = {
  boar: [105, 'm', 'pounce'], fire: [100, 'r', 'spit'], twin: [115, 'm', 'slash'], iron: [75, 'm', 'bite'], thorn: [85, 'm', 'slash'], mantis: [120, 'm', 'slash'],
  bone: [90, 'm', 'bite'], queen: [95, 'r', 'spore'], cicada: [100, 'r', 'wave'], drum: [90, 'r', 'wave', 'front'], scorp: [110, 'r', 'needle', 'last'], moth: [105, 'r', 'spore'],
  ant: [110, 'm', 'bite'], firefly: [120, 'r', 'spit'], stick: [80, 'm', 'slash'], leech: [100, 'm', 'bite'], dung: [70, 'm', 'pounce'], tiger: [140, 'm', 'pounce'],
  webspider: [125, 'r', 'needle', 'front'], aphid: [115, 'm', 'bite'], hairy: [85, 'm', 'bite'], cent: [110, 'm', 'bite'], wasp: [130, 'r', 'needle'], spider: [85, 'r', 'needle'],
  mole: [95, 'm', 'pounce'], gecko: [90, 'r', 'wave', 'front'], qingfu: [110, 'r', 'wave'], bomb: [95, 'm', 'pounce'], silk: [70, 'm', 'bite'], mosq: [125, 'r', 'needle', 'top'],
  rhino: [75, 'm', 'pounce'], gold: [85, 'm', 'pounce'], qant: [85, 'r', 'spore'], flea: [135, 'm', 'bite'], bfly: [100, 'r', 'wave'], sleep: [90, 'r', 'spore', 'front'],
  stag: [95, 'm', 'slash'], glut: [90, 'm', 'bite'], toad: [80, 'r', 'spore'], cricket: [115, 'r', 'wave', 'front'], locust: [120, 'm', 'slash'], mirror: [85, 'm', 'slash'],
  hive: [70, 'r', 'spore'], fly: [125, 'm', 'bite'], bury: [85, 'm', 'bite'], frost: [110, 'r', 'bolt'], lure: [120, 'r', 'wave'], antlion: [80, 'm', 'bite'],
  mayfly: [150, 'm', 'slash'], thunder: [100, 'r', 'bolt'], tortoise: [60, 'm', 'bite'], puppet: [95, 'r', 'needle'], hairworm: [105, 'r', 'needle', 'top'], urn: [75, 'm', 'pounce'],
  hex: [110, 'r', 'spore', 'top'], saw: [90, 'm', 'slash'], dfly: [140, 'r', 'bolt'], orchid: [105, 'm', 'slash'], taisui: [80, 'm', 'pounce'], yue: [60, 'r', 'wave', 'front'],
  jinchan: [85, 'r', 'spit'], guangyin: [100, 'r', 'wave'], fate: [95, 'r', 'needle'], nirvana: [115, 'r', 'spit'],
};
// 主动技（占位：约四成物种；内容专家在物种上写 act 后以物种为准）。格式见规格 5.2
const E = (op, tg, o = {}) => ({ op, tg, ...o });
// 旧 10 个杀招（core.js COMBOS 只有文字）的引擎侧效果；内容专家在杀招上写 when/eff 后以数据为准。新杀招的钩子在 bestiary.js
const DEF_COMBO = {
  sanzhu: { when: 'start', eff: [E('dmg', 'foe.front', { shape: 'row', atk: 0.6 })] },
  jinjia: { when: 'start', eff: [E('shield', 'self', { mx: 0.2 }), E('st', 'self', { k: 'taunt', n: 1 })] },
  wangu: { eff: [E('summon', null, { when: 'hit', sp: 'pupa', atk: 0.2, mx: 0.2, at: 'behind', max: 1 }), E('buff', 'ally.all', { when: 'summon', atk: 0.02, hp: 0.02, max: 3 })] },
  tuoke: { when: 'lethal', eff: [E('endure', null, { v: 0.25, max: 1 })] },
  duopo: { when: 'kill', eff: [E('dmg', 'foe.front', { atk: 0.8, max: 2 })] },
  pozhen: { when: 'round', eff: [E('buff', 'ally.all', { atk: 0.015, hp: 0.015, max: 6 })] },
  shishan: { when: 'death', eff: [E('summon', null, { sp: 'lunar', atk: 0.3, mx: 0.25, at: 'here' })] },
  fenshen: { when: 'kill', eff: [E('dmg', 'foe.all', { atk: 0.2 })] },
  jingji: { when: 'hit', eff: [E('shield', 'ally.adj', { mx: 0.03, max: 4 })] },
};
Object.values(NEW_TRAITS).forEach(t => { if (!t.hooks) t.hooks = {}; });
// 现有本命技是按旧的「炉口对撞、一回合一下」调的数值；新引擎里人人出手、挨打次数多得多，这里按本命技逐个折算（只缩放本命技钩子里的加攻血、护体、伤害、召唤、毒）。
// 内容专家把本命技改写成声明式后，这张表对应的项删掉即可。
export const NAT_K = {};   // 本命技第二卷全部写成声明式（按 up 随转数涨），旧的钩子折算表作废
const NAT_K0 = 1;   // 声明式本命技没写 hooks 时补空表，BX 派发不报错

const prof = sp => {
  const s = SP[sp] || {}, d = DEF[sp] || [100, s.school === '护体' || s.school === '减伤' ? 'm' : 'm', 'pounce'];
  const reach = s.reach || (d[1] === 'r' ? 'ranged' : 'melee');
  return { spd: s.spd || d[0], reach, aim: s.aim || d[3] || 'low', atkFx: s.atkFx || d[2] || (reach === 'ranged' ? 'needle' : 'pounce'), act: s.act || null };
};
export const battleProfile = prof;   // 蛊卡/蛊典显示速、近远程、主动技用

// ---------- 羁绊：道共鸣、杀招（核心蛊定品级）、进阶杀招、道痕相冲 ----------
const TIER_IDX = { 0: 0, 2: 1, 4: 2, 6: 3 };
const comboDef = c => ({ ...(DEF_COMBO[c.id] || {}), ...c });
export function synergyOf(team) {
  const T = (team || []).slice(0, CAP), cnt = {};
  T.forEach(g => { if (g && SP[g.sp]) { const d = daoOf(g.sp); cnt[d] = (cnt[d] || 0) + 1; } });
  const daos = Object.entries(cnt).map(([id, n]) => {
    const D = DAO[id] || { id, n: id }, tier = n >= 6 && D.r6 ? 6 : n >= 4 && D.r4 ? 4 : n >= 2 && D.r2 ? 2 : 0;
    const nt = [2, 4, 6].find(t => t > n && D['r' + t]);
    return { dao: id, name: D.n || id, cnt: n, tier, next: nt ? nt - n : 0, eff: tier ? D['r' + tier] : null, d: tier ? D['r' + tier].d : '', clash: 1, clashWith: null };
  }).sort((a, b) => b.tier - a.tier || b.cnt - a.cnt);
  const act = daos.filter(x => x.tier), clashes = [];
  for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
    const a = act[i], b = act[j], k = ((DAO[a.dao] || {}).clash || {})[b.dao] || ((DAO[b.dao] || {}).clash || {})[a.dao];
    if (!k) continue; clashes.push({ a: a.dao, b: b.dao, k });
    if (k < a.clash) { a.clash = k; a.clashWith = b.dao; } if (k < b.clash) { b.clash = k; b.clashWith = a.dao; }
  }
  // 低转杀招（combos2 的 low = { 物种: 最高转数 }）：只算转数不超过上限的那几只，升上去就散（和 core.teamCombos 同一个 lowOk）
  const spsOf = c => new Set(T.filter(g => g && lowOk(c, g)).map(g => g.sp));
  let formed = COMBOS.filter(c => { const sps = spsOf(c); return c.need.every(x => sps.has(x)); });
  const replaced = new Set(formed.filter(c => c.from).map(c => c.from));
  formed = formed.filter(c => !replaced.has(c.id)).sort((a, b) => (b.from ? 1 : 0) - (a.from ? 1 : 0));
  const taken = new Set(), combos = [];
  for (const c of formed) {
    const core = c.core || c.need[0], idx = T.findIndex((g, i) => g && g.sp === core && !taken.has(i) && lowOk(c, g)); if (idx < 0) continue;
    taken.add(idx);
    const rank = guRank(T[idx]), dao = daoOf(core), dr = daos.find(x => x.dao === dao), ti = dr ? TIER_IDX[dr.tier] * dr.clash : 0;
    const mul = Math.round((1 + 0.15 * (rank - 1)) * (1 + 0.2 * ti) * 100) / 100;
    combos.push({ id: c.id, n: c.n, core, idx, rank, dao, mul, from: c.from || null, d: c.d });
  }
  const RC = ['', '一转', '二转', '三转', '四转', '五转', '仙'];
  const line = [act.map(x => `${x.name}·${x.cnt}${x.clash < 1 ? `（与${(DAO[x.clashWith] || {}).n || x.clashWith}相冲 ×${x.clash}）` : ''}`).join('  '),
    combos.length ? '杀招：' + combos.map(c => `${c.n}（${RC[c.rank] || ''} ×${c.mul}）`).join('、') : ''].filter(Boolean).join('  ·  ');
  return { daos, combos, clashes, line };
}

// ---------- 复盘链接：'<A码>.<B码>.<种子>.<类型>.<SOTA 两位>'（旧链接没有最后一段，按 0） ----------
export function encodeReplay(o) { const s = (o.sota && o.sota[0] ? 1 : 0) + (o.sota && o.sota[1] ? 2 : 0); return [o.A, o.B, o.seed, (o.kind || 'd')[0], s].join('.'); }
export function decodeReplay(text) {
  const m = String(text || '').match(/r=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([0-9a-z]+)(?:\.([tgd]))?(?:\.([0-3]))?/); if (!m) return null;
  const A = decodeTeam(m[1]), B = decodeTeam(m[2]); if (!A || !B) return null;
  const s = +(m[5] || 0), kind = m[4] || 'd', sota = [!!(s & 1), !!(s & 2)];
  return { A, B, codeA: m[1], codeB: m[2], seed: m[3], kind, sota, replay: encodeReplay({ A: m[1], B: m[2], seed: m[3], kind, sota }) };
}

// ---------- 阵盘摆放：蛊带 pos { r, c }；没有 pos（旧数据）的按一排顺序自动摆：第 i 只 → 列 floor(i / 3)，行按 中、上、下 ----------
export function layoutOf(team) {
  const used = new Set(), AUTO = [], ok = p => p && p.r >= 0 && p.r < ROWS && p.c >= 0 && p.c < COLS;
  for (let c = 0; c < COLS; c++) for (const r of [1, 0, 2]) AUTO.push([r, c]);
  const out = (team || []).map(g => { const p = g && g.pos; if (ok(p) && !used.has(p.r * 3 + p.c)) { used.add(p.r * 3 + p.c); return [p.r | 0, p.c | 0]; } return null; });
  let k = 0;
  return out.map(x => { if (x) return x; while (k < AUTO.length && used.has(AUTO[k][0] * 3 + AUTO[k][1])) k++; const a = AUTO[Math.min(k, AUTO.length - 1)]; used.add(a[0] * 3 + a[1]); return a; });
}

// ---------- 出手顺序预测（不结算效果，只按行动条推演） ----------
const ivOf = spd => DIST * 100 / Math.max(20, 100 + (spd - 100) * SPD_K);
// ----- 技能说明（蛊详情一转到五转对比、合成前预览用） -----
// skillText(sp, rank, opts) → [{ kind: 'passive' | 'active' | 'aw3' | 'aw5', n, text, locked?, at?, lines? }]
// text 是数据里的大白话说明（随转数变的数已换成这一转的值），后面括号补一句这一转的实际数字（按 statFor 的卡面攻血算）。
// 觉醒没到的标 locked: true，数字按觉醒那一转（三转 / 五转）算，方便预告。opts.est === false 时不补括号。
const scaleAt = (e, r, isAct) => 1 + (e.up != null ? e.up * TUNE.upMul : isAct ? TUNE.actUp : 0) * Math.max(0, r - 1);
const natAt = r => 1 + (natK(r) - 1) * TUNE.upMul;   // 被动技〔〕里的数随转数涨，和引擎同一个口径
const actPct = (t, k) => k === 1 ? t : t.replace(/(攻击|攻 ?\+|最大血量|血量的?) ?(\d+)%/g, (m, w, x) => `${w}${/\+$/.test(w) ? '' : ' '}${Math.round(+x * k)}%`.replace('  ', ' '));
function effNote(list, r, isAct, st) {
  const parts = [];
  for (const e of list || []) {
    if (parts.length >= 2) break;
    const k = scaleAt(e, r, isAct), num = (x, base) => Math.round(base * x * k);
    const off = e.op === 'dmg' || e.op === 'st' ? HPK / OFF_MX : 1;   // 打人用的血量折算同引擎（st.mx 是卡面血，战斗里的血 = 卡面血 × HPK）
    const v = Math.round(((e.atk || 0) * st.atk + (e.a0 || 0) * st.atk + (e.mx || 0) * st.mx * off + (e.op === 'st' ? 0 : e.n || 0) * st.atk + (e.tatk || 0) * st.atk + (e.tmx || 0) * st.mx) * k + (e.flat || 0));
    const each = e.shape && e.shape !== 'one' ? '每只' : '';
    if (e.op === 'dmg' && v > 0) parts.push(`${each}约 ${v} 伤害${(e.times || 1) > 1 ? ` × ${e.times}` : ''}`);
    else if (e.op === 'heal' && v > 0) parts.push(`${each}约回 ${v} 血`);
    else if (e.op === 'shield' && v > 0) parts.push(`${each}约 ${v} 护体`);
    else if (e.op === 'buff') {
      const b = [], A = e.atk ? num(e.atk, st.atk) : 0, H = e.hp ? num(e.hp, st.mx) : 0; if (A) b.push(`攻约 ${A > 0 ? '+' : ''}${A}`); if (H) b.push(`血约 ${H > 0 ? '+' : ''}${H}`);
      if (b.length) parts.push(b.join('、'));
    } else if (e.op === 'st' && v > 0 && (e.k === 'psn' || e.k === 'burn')) parts.push(e.k === 'psn' ? `毒每轮约掉 ${v} 血` : `灼每轮约烧 ${v}`);
    else if (e.op === 'summon') parts.push(`召出的约攻 ${num(e.atk || 0.3, st.atk)}、血 ${num(e.mx || 0.3, st.mx)}`);
    else if ((e.op === 'knock' || e.op === 'draw') && e.bump !== 0) parts.push(`撞上约 ${num(e.bump != null ? e.bump : 0.4, st.atk)}`);
  }
  return parts.length ? `（这一转${parts.join('，')}）` : '';
}
// 主动技说明换成这一下的实际数字（亮牌用）：「攻击 140%」→「28 伤害」、「最大血量 20%」→「24 点」、「攻 +15%」→「攻 +3」，去掉括号里的补充说明
export function liveLine(text, k, atk, mx) {
  const v = (b, x) => Math.max(1, Math.round(b * x / 100 * k));
  return String(text || '').replace(/（本蛊最大血量 ?(\d+)%）/g, (_, x) => `（每轮 ${v(mx / OFF_MX, x)}）`).replace(/（[^）]*）/g, m => /每轮 \d/.test(m) ? m : '')
    .replace(/最大血量 ?(\d+)% ?的?伤害/g, (_, x) => ` ${v(mx / OFF_MX, x)} 伤害`).replace(/攻击 ?(\d+)%/g, (_, x) => ` ${v(atk, x)} 伤害`)
    .replace(/最大血量 ?(\d+)% ?的?/g, (_, x) => ` ${v(mx, x)} 点`).replace(/攻 ?\+ ?(\d+)%/g, (_, x) => `攻 +${v(atk, x)}`)
    .replace(/ {2,}/g, ' ').replace(/([，；：、。]) /g, '$1').trim();
}
export function skillText(sp, rank, opts = {}) {
  const s = SP[sp]; if (!s) return [];
  const r0 = Math.max(baseRank(sp), Math.min(6, rank | 0 || baseRank(sp))), est = opts.est !== false;
  const stAt = r => { if (opts.st && r === r0) return opts.st; const x = statFor(sp, r); return { atk: x.atk, mx: x.hp }; };   // 血按卡面血写（蛊详情显示的是卡面攻血）
  const nk = natOf(sp), nt = nk && NEW_TRAITS[nk], act = prof(sp).act, out = [];
  const natD = r => nt ? (nt.src ? nt.src.d.replace(/〔(\d+)〕/g, (_, x) => String(Math.round(+x * natAt(r)))) : nt.d ? nt.d(1, 2) : '') : '';
  const natAw = (i, r) => nt && nt.src && nt.src.aw && nt.src.aw[i] ? nt.src.aw[i].replace(/〔(\d+)〕/g, (_, x) => String(Math.round(+x * natAt(r)))) : '';
  if (nt) out.push({ kind: 'passive', n: nt.n, trig: nt.trig || '', text: natD(r0) + (est ? effNote(nt.eff, r0, false, stAt(r0)) : '') });
  if (act) { const k = 1 + TUNE.actUp * (r0 - 1); out.push({ kind: 'active', n: act.n, cap: act.cap || GP.cap, text: actPct(act.d || '', k) + (est ? effNote(act.eff, r0, true, stAt(r0)) : '') }); }
  [3, 5].forEach((at, i) => {
    const r = Math.max(r0, at), st = stAt(r), lines = [];
    const pt = natAw(i, r); if (pt) lines.push({ of: 'passive', n: nt.n, text: pt + (est ? effNote(nt.awEff && nt.awEff[i], r, false, st) : '') });
    if (act && act.awd && act.awd[i]) lines.push({ of: 'active', n: act.n, text: actPct(act.awd[i], 1 + TUNE.actUp * (r - 1)) + (est ? effNote(act.aw && act.aw[i], r, true, st) : '') });
    if (!lines.length) return;
    out.push({ kind: i ? 'aw5' : 'aw3', n: i ? '五转觉醒' : '三转觉醒', at, locked: r0 < at, lines, text: lines.map(l => `${l.of === 'active' ? '主动技' : '被动技'}「${l.n}」：${l.text}`).join('；') });
  });
  return out;
}

export function predictOrder(units, round, n = 8) {
  const L = units.map(u => ({ uid: u.uid, t: u.next, iv: ivOf(u.spd), spd: u.spd, side: u.side, pos: u.pos || 0 })), out = [];
  let r = round, guard = 0;
  while (out.length < n && L.length && guard++ < 200) {
    let p = L[0]; for (const x of L) if (x.t < p.t - 1e-9 || (Math.abs(x.t - p.t) < 1e-9 && (x.spd > p.spd || (x.spd === p.spd && (x.side < p.side || (x.side === p.side && x.pos < p.pos)))))) p = x;
    if (p.t > r * DIST + 1e-9) { r++; out.push('#' + r); continue; }
    out.push(p.uid); p.t += p.iv;
  }
  return out;
}

// ---------- 引擎 ----------
// battle(teamA, teamB, seed, opts)：opts = { sota: [a, b], maxRounds, lite }。返回值见规格第 8 节
export function battle(ta, tb, seed, opts = {}) {
  if (!opts || Array.isArray(opts) || typeof opts !== 'object') opts = {};
  const rng = makeRng(seed), lite = !!opts.lite, maxR = opts.maxRounds || MAXROUND;
  const so = opts.sota || {}, sota = [!!(so[0] || so.A), !!(so[1] || so.B)], sotaAcc = [0, 0];   // sota 认 [a, b] 或 { A, B }
  let ops = 0, uidc = 0, now = 0, round = 0, cur = null, acts = 0, deadCell = null;
  const roster = {}, log = [], S = [[], []], all = [], sideF = [{}, {}], told = new Set();
  const alive = u => u && u.hp > 0 && !u.dead;
  const allies = u => S[u.side].filter(alive), foes = u => S[1 - u.side].filter(alive);
  const iv = u => ivOf(u.spd);
  // 快照第 9 项：身上的状态 { 毒每轮伤害 psn, 灼 burn: [每轮伤害, 剩几轮], 寒层 chill, 眩 stun, 网 web, 护 grd, 印 mark, 封 seal, 嘲 taunt, 寄 para, by: { 状态: 谁挂的 uid } }，没有就是 0
  const stOf = u => { const f = u.f, o = {}; let any = 0; for (const k of ['psn', 'para', 'chill', 'stun', 'web', 'grd', 'mark', 'seal', 'taunt']) if (f[k] > 0) { o[k] = f[k]; any = 1; } if (f.burn && f.burn.n > 0) { o.burn = [f.burn.v, f.burn.n]; any = 1; } if (any && f.by) o.by = f.by; return any ? o : 0; };
  const snap = () => S.map(a => a.map(u => [u.uid, u.atk, Math.max(0, u.hp), u.sh, u.gp | 0, Math.round(u.spd), u.r, u.c, stOf(u)]));
  const ev = (t, o = {}) => {
    o.t = t; if (ctx.nat) o.nat = 1;
    if (t === 'combo') { const u = byId[o.uid]; if (u) { o.id = u.combo; if (!told.has(o.uid)) { told.add(o.uid); o.quiet = 0; o.big = 1; } } }
    if (t === 'buff' && cur && cur.side === (byId[o.uid] || {}).side && (o.h > 0 || o.sh > 0)) cur.sup += (o.h > 0 ? o.h : 0) + (o.sh || 0);
    if (t === 'status' && ctx.nat && cur && (o.k === 'psn' || o.k === 'para') && byId[o.uid]) { const k = nk(), tg = byId[o.uid]; if (k !== 1 && tg.f[o.k]) { const cut = Math.round(o.n * (1 - k)); tg.f[o.k] = Math.max(1, tg.f[o.k] - cut); o.n = Math.max(1, o.n - cut); } }
    if (!lite) o.s = snap(); log.push(o);
    // 跨道配合：谁给敌蛊挂上了状态（毒、灼、寒、眩、网、印……），施放者和它的友蛊都能接着触发（inflict / allyInflict）
    if (t === 'status' && INFLICT.has(o.k) && cur && alive(cur) && byId[o.uid] && byId[o.uid].side !== cur.side && depth < 6) {
      depth++; const by = cur, tg = byId[o.uid];
      if (by.dx.length) runDecl(by, 'inflict', { k: o.k, tg });
      for (const a of allies(by)) if (a !== by && a.dx.length) runDecl(a, 'allyInflict', { k: o.k, tg, by });
      depth--;
    }
  };
  let depth = 0;
  const byId = {};
  const reg = u => {
    u.uid = (u.side ? 'b' : 'a') + (uidc++); byId[u.uid] = u; all.push(u);
    roster[u.uid] = { gid: u.gid, side: u.side, src: u.src, sp: u.sp, name: u.name, rank: u.rank || 0, spd: u.spd, reach: u.reach, gpMax: u.gpMax, act: u.act ? { n: u.act.n, fx: u.act.fx, d: u.act.d } : null, combo: null, summon: !!u.summon, boss: !!u.boss, tr: { ...u.tr }, food: u.food || null, xing: u.xing || null };
    return u;
  };
  const st0 = () => ({ kills: 0, hits: 0, taken: 0, killT1: 0, oneShot: 0, adjFell: 0, frontFell: 0, front: 0 });
  const base = (side, o) => ({ side, sh: 0, tr: {}, q: [], att: [], f: {}, fl: {}, gp: 0, gpMax: 0, act: null, dx: [], tmp: [], dmg: 0, taken: 0, lost: 0, sup: 0, kills: 0, acts: 0, casts: 0, st: st0(), ...o });
  function fromGu(g, side, src) {
    const P = prof(g.sp), card = Math.max(1, g.hp | 0), mx = card * HPK, hp = g.hpNow != null ? Math.max(1, Math.min(card, Math.round(g.hpNow))) * HPK : mx;
    const act = g.noAct ? null : P.act, tr = {};
    if (!g.noNat) { const k = natOf(g.sp); if (k) tr[k] = 1; }
    const u = base(side, { sp: g.sp, gid: g.uid || null, src, name: (g.boss ? '劫·' : '') + (SP[g.sp] ? SP[g.sp].n : SUMMON_NAMES[g.sp] || g.sp), atk: Math.max(1, g.atk | 0), hp, mx, card, tr, boss: !!g.boss,
      rank: guRank(g), aw: awOf(g), food: g.food || null, xing: g.xing || null, spd: g.spd || P.spd, reach: P.reach, aim: P.aim, atkFx: P.atkFx, act, gpMax: act ? act.cap || GP.cap : 0 });
    // 声明式效果：食物挂件、蛊性、声明式本命技
    const fd = u.food && FOOD[u.food];
    if ((fd && fd.noMove) || g.noMove) u.noMove = 1;
    if (fd && fd.kind === 'gear') {
      const L = (fd.eff || []).slice(), p = (fd.pct || 0) / 100;
      if (fd.gear === 'spawn') L.push(E('summon', null, { when: 'death', sp: 'pupa', atk: p || 0.4, mx: p || 0.4, at: 'here' }));
      if (fd.gear === 'ward') L.push(E('mul', null, { when: 'take', v: fd.pct ? 1 - p : 0.9 }));
      if (fd.gear === 'first') L.push(E('buff', 'self', { when: 'start', atk: p || 0.2 }));
      if (L.length) u.dx.push({ src: { kind: 'food', key: 'fd', tag: { food: fd.id } }, list: L });
    }
    const xg = u.xing && XING[u.xing]; if (xg && xg.eff) u.dx.push({ src: { kind: 'xing', key: 'xg', tag: { xg: u.xing } }, list: xg.eff });
    (Array.isArray(g.fx) ? g.fx : []).forEach((f, i) => { if (f && f.eff && f.eff.length) u.dx.push({ src: { kind: f.kind || 'fx', key: 'fx' + i, tag: { fx: f.id, n: f.n } }, list: f.eff }); });   // 秘境挂的天象、祝福、首领机制
    const nk = natOf(g.sp), nt = nk && NEW_TRAITS[nk];
    if (nt && nt.eff && !g.noNat) u.dx.push({ src: { kind: 'nat', key: 'nat', tag: { id: nk } }, list: [...nt.eff, ...(nt.awEff || []).slice(0, u.aw).flat()] });
    if (act && act.aw) u.actEff = [...act.eff, ...act.aw.slice(0, u.aw).flat()]; else if (act) u.actEff = act.eff;
    return u;
  }
  const tA = (ta || []).slice(0, CAP), tB = (tb || []).slice(0, CAP);
  [tA, tB].forEach((T, s) => { const cells = layoutOf(T); T.forEach((g, i) => { const u = reg(fromGu(g, s, i)); u.r = cells[i][0]; u.c = cells[i][1]; S[s].push(u); }); sortSide(s); });

  // ----- 阵盘：格子、相邻、移动（S[s] 始终按 列→行 排好，旧钩子里的「最前 / 身后」按这个顺序近似） -----
  function sortSide(s) { S[s].sort((a, b) => a.c - b.c || a.r - b.r); }
  function at(s, r, c) { return S[s].find(u => alive(u) && u.r === r && u.c === c) || null; }
  function freeNear(s, r, c, ahead) {   // 离 (r, c) 最近的空格；ahead = 只找它身后同一行优先
    let best = null, bd = 1e9;
    for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) {
      if (at(s, rr, cc)) continue; const d = Math.abs(rr - r) * 1.1 + Math.abs(cc - c) + (ahead && (rr !== r || cc < c) ? 5 : 0) + cc * 0.01;
      if (d < bd) { bd = d; best = [rr, cc]; }
    }
    return best;
  }
  // 旧钩子直接改 S 数组顺序（换位、退到末位、光阴回溯）：数组顺序为准，把占着的格子按新顺序重新分配；重叠的挪到最近的空格
  function sync(s) {
    const arr = S[s], seen = new Set();
    arr.forEach(u => { const k = u.r * 9 + u.c; if (u.r == null || seen.has(k) || u.r < 0 || u.c < 0) { const f = freeNearSet(seen, u.r || 0, u.c || 0); u.r = f[0]; u.c = f[1]; } seen.add(u.r * 9 + u.c); });
    const sorted = arr.slice().sort((a, b) => a.c - b.c || a.r - b.r);
    if (sorted.some((u, i) => u !== arr[i])) { const cells = sorted.map(u => [u.r, u.c]); arr.forEach((u, i) => { if (u.r !== cells[i][0] || u.c !== cells[i][1]) { u.r = cells[i][0]; u.c = cells[i][1]; ev('move', { uid: u.uid, r: u.r, c: u.c, k: 'swap' }); } }); }
  }
  function freeNearSet(seen, r, c) { let best = [0, 0], bd = 1e9; for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) { if (seen.has(rr * 9 + cc)) continue; const d = Math.abs(rr - r) + Math.abs(cc - c) + cc * 0.01; if (d < bd) { bd = d; best = [rr, cc]; } } return best; }
  const syncAll = () => { sync(0); sync(1); };
  // 敌蛊离我多近：同一行优先，其次行距，再看列
  const nearKey = (u, x) => Math.abs(x.r - u.r) * 10 + x.c + x.r * 0.01;
  function shapeOf(anchor, shape) {
    if (!anchor) return [];
    const s = anchor.side, L = S[s].filter(alive), R = anchor.r, C = anchor.c;
    switch (shape) {
      case 'row': return L.filter(x => x.r === R).sort((a, b) => a.c - b.c);
      case 'col': return L.filter(x => x.c === C).sort((a, b) => a.r - b.r);
      case 'cross': return L.filter(x => (x.r === R && Math.abs(x.c - C) <= 1) || (x.c === C && Math.abs(x.r - R) <= 1));
      case 'ring': return L.filter(x => Math.abs(x.r - R) <= 1 && Math.abs(x.c - C) <= 1);
      case 'diag': return L.filter(x => Math.abs(x.r - R) === Math.abs(x.c - C) && Math.abs(x.r - R) <= 2);
      case 'back': { const mc = Math.max(...L.map(x => x.c)); return L.filter(x => x.c === mc); }
    }
    return [anchor];
  }
  function moveTo(u, r, c, k) { u.r = r; u.c = c; sortSide(u.side); ev('move', { uid: u.uid, r, c, k }); }
  // 模拟用对照开关：noSyn[s] 关掉某一方的全部羁绊；comboOnly[s] 是杀招 id 数组时，那一方只保留这些杀招（[] 即不成形，道共鸣照旧）
  const noSyn = opts.noSyn || [], only = opts.comboOnly || [], syn = [tA, tB].map((T, s) => {
    if (noSyn[s]) return { daos: [], combos: [], clashes: [], line: '' };
    const y = synergyOf(T); return Array.isArray(only[s]) ? { ...y, combos: y.combos.filter(c => only[s].includes(c.id)) } : y;
  });
  syn.forEach((sy, s) => sy.combos.forEach(c => {
    const u = S[s].find(x => x.src === c.idx), C = comboDef(COMBOS.find(x => x.id === c.id)); if (!u) return;
    u.combo = c.id; u.cname = c.n; u.cmul = c.mul; roster[u.uid].combo = { id: c.id, n: c.n, mul: c.mul };
    if (C.eff) { u.cdecl = 1; u.dx.push({ src: { kind: 'combo', key: 'cb', mul: c.mul * TUNE.combo, combo: 1 }, list: C.eff.map(e => ({ when: C.when, ...e })) }); }   // cdecl：bestiary 的旧杀招钩子不再派发
  }));

  // ----- 伤害、增益、召唤（ctx 接口与 bestiary.js 文件头一致） -----
  const P = (n, p) => p > 0 ? Math.max(1, Math.round(n * p)) : 0;
  const nk = () => ctx.nat && cur ? (NAT_K[natOf(cur.sp)] != null ? NAT_K[natOf(cur.sp)] : NAT_K0) : 1;
  const nsc = (n, k) => k === 1 || !n ? n : n > 0 ? Math.max(1, Math.round(n * k)) : Math.min(-1, Math.round(n * k));
  const buff = (u, a, h) => { if (!alive(u)) return; { const k = nk(); a = nsc(a, k); h = nsc(h, k); } u.atk = Math.max(1, Math.min(999999, u.atk + a)); u.hp = Math.min(9999999, u.hp + h); u.mx += h; ev('buff', { uid: u.uid, a, h }); };
  const shield = (u, n) => { if (!alive(u) || n <= 0) return; n = Math.round(n * nk()); if (n <= 0) return; u.sh = Math.min(Math.max(990, 2 * u.mx), u.sh + n); ev('buff', { uid: u.uid, sh: n }); };
  const setSpd = (u, ns) => { ns = Math.max(30, ns); if (u.next > now) { u.next = now + (u.next - now) * ivOf(ns) / ivOf(u.spd); } u.spd = ns; };
  const gainGp = (u, n) => { if (!u.act || !alive(u) || u.f.seal > 0) return; if (u.fl.gpMul) n *= u.fl.gpMul; u.gp = Math.max(0, Math.min(u.gpMax, (u.gp || 0) + n)); };
  const comboEv = u => ev('combo', { uid: u.uid, n: u.cname });
  const ctx = { S, CAP, rng, roster, sideF, turn: 0, nat: 0, alive, allies, foes, buff, shield, deal, summon, hook, ev, has: () => false, reg, comboEv };

  function deal(src, tg, amt, kind, crit, o = {}) {
    if (!alive(tg) || amt <= 0) return 0;
    if (ctx.nat && cur && src === cur && kind !== 'hit') amt = Math.max(1, Math.round(amt * nk()));
    const foe = src && src.side !== tg.side;
    if (foe && (kind === 'hit' || kind === 'skill') && !tg.f.guarded && !tg.tr.guard) {   // 护卫（蛊蛹等）：相邻友蛊第一次挨打时代受
      const arr = S[tg.side], i = arr.indexOf(tg), gd = [arr[i - 1], arr[i + 1]].find(x => alive(x) && x.tr.guard);
      if (gd) { tg.f.guarded = 1; ev('trig', { uid: gd.uid, id: 'guard' }); tg = gd; }
    }
    { const a0 = amt, a1 = BX.dmgMod(ctx, src, tg, amt, kind), who = a1 > a0 ? src : tg, k = who && NAT_K[natOf(who.sp)] != null ? NAT_K[natOf(who.sp)] : NAT_K0;   // 本命修正器（增伤 / 减伤）也按折算表缩放
      amt = a1 === a0 || k === 1 || a1 <= 0 ? a1 : Math.max(1, Math.round(a0 + (a1 - a0) * k)); }
    if (amt <= 0) return 0;
    if (src && src.dx.length) amt *= modMul(src, 'deal', { tg, kind, n: amt });
    if (tg.dx.length) amt *= modMul(tg, 'take', { src, kind, n: amt });
    if (tg.f.mark > 0 && foe) amt *= 1.25;
    if (tg.f.grd > 0 && foe) { tg.f.grd--; amt *= 0.5; }
    amt = Math.max(1, Math.round(amt));
    if (src && sota[src.side] && foe) { sotaAcc[src.side] += amt * 0.01; if (sotaAcc[src.side] >= 1) { const b = Math.floor(sotaAcc[src.side]); amt += b; sotaAcc[src.side] -= b; } }   // SOTA：伤害 +1%（零头累计，不丢）
    const had = tg.sh > 0, full = tg.hp >= tg.mx && !had; let a = amt;
    if (!o.pierce && tg.sh > 0 && !['psn', 'para', 'burn', 'doom', 'self'].includes(kind)) { const s = Math.min(tg.sh, a); tg.sh -= s; a -= s; }
    tg.hp -= a;
    if (foe) { src.dmg += amt; tg.taken += amt; tg.lost += a; if (kind === 'hit') tg.st.hits++; if (tg.hp <= 0 && full && kind === 'hit') src.st.oneShot = 1; }
    else if (kind !== 'self') { tg.taken += amt; tg.lost += a; }
    if (tg.hp <= 0 && src) tg.killer = src;
    if (foe && kind !== 'psn' && kind !== 'para' && kind !== 'burn') gainGp(tg, GP.hit);
    ev('dmg', { uid: tg.uid, src: src ? src.uid : null, n: a, blk: amt - a, k: kind, crit: crit ? 1 : 0 });
    if (alive(tg) && !tg.f.lowed && tg.hp * 2 < tg.mx) { tg.f.lowed = 1; runDecl(tg, 'low', {}); }
    hook(tg, 'hurt', { src, kind, had, n: amt });
    return amt;
  }
  function summon(side, idx, spec, by) {
    const arr = S[side]; if (arr.filter(alive).length >= CAP) return null;
    const sk = by && by === cur ? nk() : 1;
    const u = reg(base(side, { sp: spec.sp, name: SUMMON_NAMES[spec.sp] || spec.sp, atk: Math.max(1, Math.round(spec.atk * sk)), hp: Math.max(1, Math.round(spec.hp * sk)), mx: Math.max(1, Math.round(spec.hp * sk)), summon: true, src: null, gid: null, spd: 100, reach: 'melee', aim: 'low', atkFx: 'bite', rank: 0, aw: 0 }));
    u.a0 = u.atk; u.h0 = u.mx; u.next = now + iv(u);
    // 落在哪一格：spec.cell 指定；否则按旧钩子的下标找参照（下标 0 = 最前空格；k = 第 k 只身后；超出 = 后列），亡语召唤落在倒下那一格
    let cell = spec.cell && !at(side, spec.cell[0], spec.cell[1]) ? spec.cell : null;
    if (!cell && deadCell && deadCell.side === side && !at(side, deadCell.r, deadCell.c)) cell = [deadCell.r, deadCell.c];
    if (!cell) { const live = arr.filter(alive), ref = live[Math.min(idx, live.length) - 1]; cell = idx <= 0 ? freeNear(side, 1, 0) : idx >= live.length + 1 || !ref ? freeNear(side, 1, 2) : freeNear(side, ref.r, ref.c + 1, true); }
    if (!cell) { all.pop(); delete byId[u.uid]; delete roster[u.uid]; return null; }
    if (deadCell && cell[0] === deadCell.r && cell[1] === deadCell.c) deadCell = null;
    u.r = cell[0]; u.c = cell[1]; arr.push(u); sortSide(side);
    ev('summon', { uid: u.uid, by: by && by.uid });
    for (const o of arr.slice()) if (o !== u && alive(o)) hook(o, 'ally', { u });
    return u;
  }
  const WHEN = { start: 'start', turn: 'round', hurt: 'hit', kill: 'kill', faint: 'death', ally: 'summon', attack: 'attack', prep: 'prep', front: 'front', foeFront: 'foeFront', mourn: 'allyDeath' };
  // 受击连锁：受击反应里打出去的伤害，不再触发对方的受击效果（镜对镜照回不会无限互弹）；旧钩子最多再嵌两层
  let hurtD = 0, echoD = 0;
  function hook(u, h, c = {}) {
    if (++ops > MAXOPS) return;
    if (h === 'hurt' && hurtD >= 3) return;
    const prev = cur; cur = u; if (h === 'hurt') hurtD++;
    try {
      BX.dispatch(ctx, h, u, c); syncAll();
      const w = WHEN[h]; if (w && u.dx.length && !(h === 'hurt' && hurtD > 1)) runDecl(u, w, c);
    } finally { if (h === 'hurt') hurtD--; cur = prev; }
  }

  // ----- 声明式效果（规格第 4–7 节） -----
  const pick = (u, tg, c, last) => {
    if (!tg || tg === 'self') return alive(u) ? [u] : (tg === 'self' ? [] : [u]);
    if (tg === 'same') return (last || []).filter(alive);
    const [sd, rest = ''] = tg.split('.'), [pk, nn] = rest.split(':'), n = +nn || 1;
    if (sd === 'tg') return [c.tg].filter(alive); if (sd === 'src') return [c.src].filter(alive); if (sd === 'killer') return [c.killer || u.killer].filter(alive);
    const pool = sd === 'ally' ? allies(u) : foes(u); if (!pool.length) return [];
    if (sd === 'foe' && n === 1 && ['front', 'low', 'lowp', 'top', 'fast', 'last', 'rand'].includes(pk)) { const t = pool.find(x => x.f.taunt > 0); if (t) return [t]; }
    const sorted = f => pool.slice().sort((a, b) => f(a) - f(b) || nearKey(u, a) - nearKey(u, b)).slice(0, n);
    const mine = pool.filter(x => x !== u);
    switch (pk) {
      case 'front': return sd === 'ally' ? pool.slice().sort((a, b) => a.c - b.c || Math.abs(a.r - u.r) - Math.abs(b.r - u.r)).slice(0, n) : sorted(x => nearKey(u, x));
      case 'last': return pool.slice().sort((a, b) => b.c - a.c || Math.abs(a.r - u.r) - Math.abs(b.r - u.r) || a.r - b.r).slice(0, n);
      case 'low': return sorted(x => x.hp);
      case 'lowp': return sorted(x => x.hp / x.mx);
      case 'top': return sorted(x => -x.atk);
      case 'fast': return sorted(x => -x.spd);
      case 'rand': { const p = pool.slice(), out = []; while (out.length < n && p.length) out.push(p.splice(rng.int(p.length), 1)[0]); return out; }
      case 'all': return pool;
      case 'adj': return mine.filter(x => Math.abs(x.r - u.r) + Math.abs(x.c - u.c) === 1);
      case 'near': return mine.filter(x => Math.abs(x.r - u.r) <= 1 && Math.abs(x.c - u.c) <= 1);
      case 'row': return mine.filter(x => x.r === u.r);
      case 'col': return mine.filter(x => x.c === u.c);
      case 'behind': return mine.filter(x => x.r === u.r && x.c > u.c).sort((a, b) => a.c - b.c).slice(0, n);
      case 'ahead': return mine.filter(x => x.r === u.r && x.c < u.c).sort((a, b) => b.c - a.c).slice(0, n);
      case 'tg': return [c.tg].filter(alive);
      case 'src': return [c.src].filter(alive);
    }
    return pool.slice(0, n);
  };
  // 目标 = 先按 tg 挑锚点，再按 shape 展开（单体 / 整行贯穿 / 整列 / 十字 / 周围一圈 / 斜线 / 后排）
  function targetsOf(u, e, c, last) {
    const base = pick(u, e.shape === 'back' && !e.tg ? 'foe.front' : e.tg, c, last); if (!e.shape || e.shape === 'one') return base;
    const out = []; base.forEach(a => shapeOf(a, e.shape).forEach(x => { if (!out.includes(x)) out.push(x); })); return out;
  }
  const cellsOf = L => L.map(x => [x.side, x.r, x.c]);
  const cond = (u, s, c, t, used) => String(s).split('&').every(x => {
    x = x.trim(); let m;
    if (x === 'front') return !allies(u).some(a => a.r === u.r && a.c < u.c); if (x === 'back') return allies(u).some(a => a.r === u.r && a.c < u.c);
    if (x === 'last') return !allies(u).some(a => a.r === u.r && a.c > u.c);
    if ((m = x.match(/^col=(\d)$/))) return u.c === +m[1];
    if ((m = x.match(/^k=(\w+)$/))) return c.k === m[1];
    if (x === 'tg.chill') return !!t && t.f.chill > 0; if (x === 'tg.mark') return !!t && t.f.mark > 0; if (x === 'tg.summon') return !!t && !!t.summon; if (x === 'tg.guard') return !!t && t.f.grd > 0;
    if (x === 'first') return !used;
    if ((m = x.match(/^hp<(\d+)$/))) return u.hp * 100 < +m[1] * u.mx;
    if ((m = x.match(/^tg\.hp<(\d+)$/))) return !!t && t.hp * 100 < +m[1] * t.mx;
    if (x === 'tg.full') return !!t && t.hp >= t.mx; if (x === 'tg.psn') return !!t && t.f.psn > 0;
    if (x === 'tg.burn') return !!t && !!t.f.burn; if (x === 'tg.stun') return !!t && t.f.stun > 0;
    if ((m = x.match(/^round>=(\d+)$/))) return ctx.turn >= +m[1]; if (x === 'round%2') return ctx.turn % 2 === 1;
    if (x === 'dead.adj') return !!c.dead && (c.dead.f.adj || []).includes(u.uid);
    if (x === 'dead.ahead') return !!c.dead && c.dead.f.behind === u.uid;
    if (x === 'melee' || x === 'ranged') return !!c.src && c.kind === 'hit' && c.src.reach === x;
    if ((m = x.match(/^kind=(\w+)$/))) return c.kind === m[1];
    return true;
  });
  const scaleOf = (u, e, src) => src.mul || (1 + (e.up != null ? e.up * TUNE.upMul : src.kind === 'act' ? TUNE.actUp : 0) * Math.max(0, (u.rank || 1) - 1));
  const amount = (u, t, e, c, k) => {
    let v = 0;
    if (e.atk) v += u.atk * e.atk; if (e.a0) v += (u.a0 || u.atk) * e.a0; if (e.mx) v += u.mx * e.mx / (e.op === 'dmg' || e.op === 'st' ? OFF_MX : 1);   // 拿自己的最大血量打人（伤害、毒灼）按 1/OFF_MX 算；护体、回血照旧按血量的百分比
    if (e.tatk && t) v += t.atk * e.tatk; if (e.tmx && t) v += t.mx * e.tmx; if (e.n) v += (c.n || 0) * e.n; if (e.flat) v += e.flat;
    return v > 0 ? Math.max(1, Math.round(v * k)) : 0;
  };
  const cntKey = (u, key) => (u.f.cnt || (u.f.cnt = {}))[key] || 0;
  function modMul(u, when, c) {
    let m = 1;
    for (const blk of u.dx) blk.list.forEach((e, i) => {
      if ((e.when || blk.src.when) !== when || e.op !== 'mul') return;
      const key = blk.src.key + i, used = cntKey(u, key); if (e.max && used >= e.max) return;
      if (e.if && !cond(u, e.if, c, when === 'deal' ? c.tg : c.src, used)) return;
      u.f.cnt[key] = used + 1; m *= e.v != null ? e.v : 1;
      if (!lite) linkEv(u, when, e.if, c, when === 'deal' ? c.tg : c.src);   // v: 0 = 这一下全免（伤害最少仍记 1）
      if (e.v !== 1 && blk.src.kind !== 'food') ev('trig', { uid: u.uid, ...blk.src.tag });
    });
    return m;
  }
  function runDecl(u, when, c) {
    for (const blk of u.dx) {
      const L = blk.list.filter(e => (e.when || blk.src.when) === when && e.op !== 'mul' && e.op !== 'endure'); if (!L.length) continue;
      runList(u, L, c, blk.src, null, blk.list);
    }
  }
  // 跑一串效果：src = { kind, key, mul?, tag?, combo? }；pre = 第一条效果预先选好的目标（放主动技时先画出手方向）
  // 联动：效果因为目标身上的状态才触发（if: 'tg.psn' 等），或接友蛊挂上的状态（allyInflict），发 link 给画面画连线
  const LINK_K = /tg\.(psn|burn|chill|stun|mark|guard|summon|web|seal)/;
  function linkEv(u, when, cnd, c, t) {
    if (lite || !t || !t.uid || t === u) return;
    const m = cnd && LINK_K.exec(cnd), k = m ? m[1] : when === 'allyInflict' ? c.k : null;
    if (k) ev('link', { uid: u.uid, to: t.uid, k });
  }
  function runList(u, L, c, src, pre, full) {
    let last = null, told = false;
    L.forEach((e, j) => {
      const i = (full || L).indexOf(e), key = src.key + i, used = cntKey(u, key);
      if (e.max && used >= e.max) return;
      if (e.every && ctx.turn % e.every) return;
      const tgs = j === 0 && pre ? pre : (e.op === 'summon' || e.op === 'endure' ? [u] : targetsOf(u, e, c, last));
      if (e.if && !cond(u, e.if, c, tgs[0] || c.tg, used)) return;
      if (e.chance && rng() >= e.chance) return;
      if (!tgs.length && e.op !== 'summon') return;
      u.f.cnt[key] = used + 1;
      linkEv(u, e.when || src.when, e.if, c, tgs[0] || c.tg);
      if (!told && src.kind !== 'act') { told = true; if (src.combo) ev('combo', { uid: u.uid, n: u.cname, tg: tgs.map(x => x.uid) }); else ev('trig', { uid: u.uid, ...src.tag }); }
      const k = scaleOf(u, e, src);
      applyEff(u, e, tgs, c, k);
      last = tgs;
    });
  }
  function applyEff(u, e, tgs, c, k) {
    switch (e.op) {
      case 'dmg': tgs.forEach(t0 => {
        for (let r = 0; r < (e.times || 1); r++) {
          const t = r > 0 && /rand|low/.test(e.tg || '') ? pick(u, e.tg, c, null)[0] : t0; if (!alive(t)) break;
          let d = amount(u, t, e, c, k); if (e.exe && t.hp <= t.mx * e.exe) d = Math.round(d * (e.exeMul || 1.5));
          const cr = e.crit && rng() < e.crit; if (cr) d = Math.round(d * CRIT.mul);
          const n = deal(u, t, d, 'skill', cr, { pierce: e.pierce }); if (e.steal && n > 0) heal(u, Math.round(n * e.steal));
        }
      }); break;
      case 'heal': tgs.forEach(t => heal(t, amount(u, t, e, c, k))); break;
      case 'shield': tgs.forEach(t => shield(t, amount(u, t, e, c, k))); break;
      case 'buff': tgs.forEach(t => {
        if (!alive(t)) return; const ref = e.by === 'self' ? u : t, sg = x => x > 0 ? Math.max(1, Math.round(x)) : x < 0 ? Math.min(-1, Math.round(x)) : 0;
        const a = e.atk ? sg((ref.a0 || ref.atk) * e.atk * k) : 0, h = e.hp ? sg((ref.h0 || ref.mx) * e.hp * k) : 0, s = e.spd ? Math.round(ref.spd * e.spd * k) : 0;
        const a2 = a < 0 ? -Math.min(-a, t.atk - 1) : a, h2 = h < 0 ? -Math.min(-h, t.mx - 1) : h;
        if (a2 || h2) { t.atk += a2; t.mx += h2; t.hp = h2 > 0 ? t.hp + h2 : Math.min(t.hp, t.mx); }
        if (s) setSpd(t, t.spd + s);
        if (e.dur) t.tmp.push({ a: a2, h: h2, s, left: e.dur });
        ev('buff', { uid: t.uid, a: a2, h: h2, spd: s || undefined });
      }); break;
      case 'st': { const ea = e.n != null ? { ...e, n: 0 } : e; tgs.forEach(t => addSt(t, e.k, e.n, amount(u, t, ea, c, k), u)); break; }   // st 的 n 是层数 / 轮数，不是「按这一下伤害」的系数
      case 'flag': tgs.forEach(t => { t.fl[e.k] = e.v === undefined ? 1 : e.v; }); break;
      case 'copyNat': { const t = tgs[0], key = t && natOf(t.sp), nt = key && NEW_TRAITS[key]; if (!nt || !nt.eff || u.f.copied) break; u.f.copied = key; u.dx.push({ src: { kind: 'nat', key: 'cp', tag: { id: key } }, list: [...nt.eff, ...(nt.awEff || []).slice(0, u.aw).flat()] }); ev('trig', { uid: u.uid, id: key }); break; }   // 拟态：照抄目标的被动技能，本场有效，按施放者转数算
      case 'summon': if (u.fl.noSummon || (u.fl.noRevive && (e.when || src.when) === 'death')) break; for (let r = 0; r < (e.count || 1); r++) {
        const arr = S[u.side], i = arr.indexOf(u), at = e.at === 'front' ? 0 : e.at === 'back' ? 99 : e.at === 'here' ? (c.idx != null ? c.idx : Math.max(0, i)) : i + 1;
        summon(u.side, at, { sp: e.sp || 'pupa', atk: P(u.atk, (e.atk || 0.3) * k), hp: P(u.mx, (e.mx || 0.3) * k) }, u);
      } break;
      case 'gp': tgs.forEach(t => { if (t.act) { t.gp = Math.max(0, Math.min(t.gpMax, t.gp + (e.v || 0))); ev('buff', { uid: t.uid, gp: e.v }); } }); break;
      case 'adv': case 'pull': tgs.forEach(t => { t.next = Math.max(now, t.next - (e.v || 0.3) * iv(t)); ev('buff', { uid: t.uid, adv: e.v || 0.3 }); }); break;   // pull/push 是第一版的写法，等同 adv/delay
      case 'delay': case 'push': tgs.forEach(t => { t.next += (e.v || 0.3) * iv(t); ev('buff', { uid: t.uid, delay: e.v || 0.3 }); }); break;
      case 'knock': case 'draw': tgs.forEach(t => {   // 击退（往后一格）/ 拉近（往前一格）；被挡住或撞墙就撞上，双方都受伤
        if (!alive(t)) return; if (t.noMove) { ev('move', { uid: t.uid, r: t.r, c: t.c, k: 'hold' }); return; }   // 镇石等：不被击退拉近、也不撞
        const dc = e.op === 'knock' ? 1 : -1, steps = e.v || 1;
        for (let st = 0; st < steps && alive(t); st++) {
          const nc = t.c + dc, bump = Math.max(1, Math.round(u.atk * (e.bump != null ? e.bump : 0.4) * k * (u.fl.bumpMul || 1)));
          if (nc < 0) break;
          if (nc >= COLS) { ev('move', { uid: t.uid, r: t.r, c: t.c, k: 'wall' }); deal(u, t, bump, 'bump'); break; }
          const b = at(t.side, t.r, nc);
          if (b) { ev('move', { uid: t.uid, r: t.r, c: t.c, k: 'bump', into: b.uid }); deal(u, t, bump, 'bump'); deal(u, b, bump, 'bump'); break; }
          moveTo(t, t.r, nc, e.op);
        }
      }); break;
      case 'swap': tgs.forEach(t => {   // 换位：with = 'self'（和施放者换）| 'front' | 'back'（和同一行前一格 / 后一格换，空格就直接挪过去）
        if (!alive(t)) return; if (t.noMove || (e.with === 'self' && u.noMove)) { ev('move', { uid: (t.noMove ? t : u).uid, r: (t.noMove ? t : u).r, c: (t.noMove ? t : u).c, k: 'hold' }); return; }
        if (e.with === 'self' && t.side === u.side) { const r0 = u.r, c0 = u.c; u.r = t.r; u.c = t.c; t.r = r0; t.c = c0; sortSide(u.side); ev('move', { uid: u.uid, r: u.r, c: u.c, k: 'swap' }); ev('move', { uid: t.uid, r: t.r, c: t.c, k: 'swap' }); return; }
        const nc = e.with === 'back' || e.to === 'back' ? COLS - 1 : 0; if (nc === t.c) return; const o = at(t.side, t.r, nc);
        if (o && o.noMove) { ev('move', { uid: o.uid, r: o.r, c: o.c, k: 'hold' }); return; }
        if (o) { o.c = t.c; ev('move', { uid: o.uid, r: o.r, c: o.c, k: 'swap' }); } moveTo(t, t.r, nc, 'swap');
      }); break;
      case 'echo': tgs.forEach(t => {   // 把目标身上某个时机（k，默认亡语 death）的效果原样跑一遍，目标本身不倒（引魂香）
        if (!alive(t) || echoD > 1) return; const w = e.k || 'death', i = S[t.side].indexOf(t); echoD++;
        try { for (const blk of t.dx) { const L = blk.list.filter(x => (x.when || blk.src.when) === w && x.op !== 'mul' && x.op !== 'endure' && x.op !== 'echo'); if (L.length) { ev('trig', { uid: t.uid, ...blk.src.tag, echo: w }); runList(t, L, { idx: Math.max(0, i), echo: 1 }, blk.src, null, blk.list); } } }
        finally { echoD--; }
      }); break;
      case 'eat': tgs.forEach(t => {   // 吞：血量不过 v（默认三成）的敌蛊或任意召唤物，直接吞掉，施放者得到它 gain（默认三成）的攻血
        if (!alive(t) || !(t.summon || t.hp <= t.mx * (e.v || 0.3))) return; const g = e.gain || 0.3;
        const arr = S[t.side]; arr.splice(arr.indexOf(t), 1); t.dead = true; t.hp = 0; ev('faint', { uid: t.uid, eaten: 1, by: u.uid });
        if (t.side !== u.side) { u.kills++; u.st.kills++; }
        buff(u, P(t.atk, g), P(t.mx, g));
      }); break;
      case 'cleanse': tgs.forEach(t => { if (t.f.chillS) setSpd(t, t.spd + t.f.chillS); t.f.chillS = 0; ['psn', 'para', 'burn', 'stun', 'web', 'mark', 'seal', 'chill'].forEach(x => { t.f[x] = 0; }); t.tmp = t.tmp.filter(b => { if (b.a < 0 || b.s < 0) { revert(t, b); return false; } return true; }); ev('status', { uid: t.uid, k: 'clean', n: 1 }); }); break;
    }
  }
  const heal = (t, n) => { if (!alive(t) || n <= 0) return 0; const h = Math.min(n, t.mx - t.hp); if (h <= 0) return 0; t.hp += h; ev('heal', { uid: t.uid, n: h }); if (cur && cur.side === t.side) cur.sup += h; return h; };
  function addSt(t, k, n, v, by) {
    if (!alive(t)) return;
    if (Array.isArray(t.fl.immune) && t.fl.immune.includes(k === 'freeze' ? 'chill' : k)) return;
    if (k === 'psn' && by && by.fl.psnMul) v = Math.round(v * by.fl.psnMul);
    if (k === 'psn') { if (v <= 0) return; v = Math.max(1, Math.round(v * TUNE.psn)); t.f.psn = Math.min(Math.max(60, Math.ceil(t.mx * 0.25)), (t.f.psn || 0) + v); n = v; }
    else if (k === 'burn') { v = Math.max(1, Math.round((v || 10) * TUNE.burn)); const o = t.f.burn || { v: 0, n: 0 }; t.f.burn = { v: Math.max(o.v, v || 1), n: Math.max(o.n, n || 2) }; n = t.f.burn.n; }
    else if (k === 'stun') t.f.stun = Math.min(4, (t.f.stun || 0) + (n || 1));
    else if (k === 'web') t.f.web = (t.f.web || 0) + (n || 1);
    else if (k === 'chill') {   // 寒：每层速 -15%，叠到 3 层冻住（眩 1 次）后清空；每轮退一层
      const add = Math.min(n || 1, 3 - (t.f.chill || 0)); if (add > 0) { const d = Math.round(t.spd * TUNE.chill * add); t.f.chillS = (t.f.chillS || 0) + d; setSpd(t, t.spd - d); t.f.chill = (t.f.chill || 0) + add; }
      if (t.f.chill >= 3) { setSpd(t, t.spd + (t.f.chillS || 0)); t.f.chill = 0; t.f.chillS = 0; t.f.stun = Math.min(4, (t.f.stun || 0) + 1); ev('status', { uid: t.uid, k: 'freeze', n: 1, by: by ? by.uid : null }); return; }
      n = t.f.chill;
    }
    else if (k === 'guard') t.f.grd = (t.f.grd || 0) + (n || 1);
    else if (k === 'taunt' || k === 'mark' || k === 'seal') t.f[k] = Math.max(t.f[k] || 0, n || 2);
    if (by) (t.f.by || (t.f.by = {}))[k === 'guard' ? 'grd' : k] = by.uid;
    ev('status', { uid: t.uid, k, n: n || 1, by: by ? by.uid : null });
  }
  const revert = (t, b) => { t.atk = Math.max(1, t.atk - b.a); if (b.h) { t.mx = Math.max(1, t.mx - b.h); t.hp = Math.min(t.hp, t.mx); } if (b.s) setSpd(t, t.spd - b.s); };
  function lethalSave(u) {
    for (const blk of u.dx) for (let i = 0; i < blk.list.length; i++) {
      const e = blk.list[i]; if ((e.when || blk.src.when) !== 'lethal' || e.op !== 'endure' || u.fl.noRevive) continue;
      const key = blk.src.key + i, used = cntKey(u, key); if (e.max && used >= e.max) continue; if (e.if && !cond(u, e.if, {}, null, used)) continue;
      u.f.cnt[key] = used + 1; u.hp = e.v ? Math.max(1, Math.ceil(u.mx * e.v)) : 1; u.killer = null;
      if (blk.src.combo) ev('combo', { uid: u.uid, n: u.cname }); else ev('trig', { uid: u.uid, ...blk.src.tag });
      ev('heal', { uid: u.uid, n: u.hp });
      const rest = blk.list.filter(x => (x.when || blk.src.when) === 'lethal' && x.op !== 'endure' && x.op !== 'mul'); if (rest.length) runList(u, rest, {}, blk.src, null, blk.list);
      return true;
    }
    return false;
  }

  // ----- 倒下结算 -----
  function reap() {
    for (let guard = 0; guard < 300; guard++) {
      const dead = all.filter(u => u.hp <= 0 && !u.dead && S[u.side].includes(u));
      if (!dead.length) { if (BX.settle(ctx)) { syncAll(); continue; } fixNext(); return; }
      for (const u of dead) {
        if (u.dead) continue;
        if (lethalSave(u)) continue;
        if (!u.fl.noRevive && BX.saveDeath(ctx, u)) { syncAll(); continue; }
        const arr = S[u.side], idx = arr.indexOf(u), mates = arr.filter(x => x !== u && alive(x));
        const adjL = mates.filter(x => Math.abs(x.r - u.r) + Math.abs(x.c - u.c) === 1), behind = mates.filter(x => x.r === u.r && x.c > u.c).sort((a, b) => a.c - b.c)[0] || null;
        u.f.adj = adjL.map(x => x.uid); u.f.behind = behind ? behind.uid : null;
        if (idx >= 0) arr.splice(idx, 1);
        u.dead = true; ev('faint', { uid: u.uid });
        adjL.forEach(x => { x.st.adjFell = 1; }); if (behind) behind.st.frontFell = 1;
        const k = u.killer;
        if (k && alive(k) && k.side !== u.side) { k.kills++; k.st.kills++; if (ctx.turn <= 1) k.st.killT1 = 1; hook(k, 'kill', { victim: u }); }
        else if (k && k.side !== u.side) { k.kills++; k.st.kills++; }
        deadCell = { side: u.side, r: u.r, c: u.c }; hook(u, 'faint', { idx: Math.max(0, idx), killer: k }); deadCell = null;
        for (const o of S[1 - u.side].filter(alive)) if (o.dx.length) runDecl(o, 'foeDeath', { dead: u });
      }
    }
  }
  const fixNext = () => { for (const s of S) s.forEach(u => { if (u.next == null || u.next < now - 1e-9) u.next = now + iv(u); }); };   // 光阴回溯等复生的蛊重新排队

  // ----- 轮与出手 -----
  const order = () => [...S[0], ...S[1]].filter(alive).sort((x, y) => y.spd - x.spd || x.side - y.side || S[x.side].indexOf(x) - S[y.side].indexOf(y));
  const queue = () => predictOrder(order().map(u => ({ uid: u.uid, next: u.next, spd: u.spd, side: u.side, pos: S[u.side].indexOf(u) })), round, 8);
  function startRound(n) {
    round = n; ctx.turn = n; ev('round', { n });
    for (const u of order()) {
      if (u.f.burn && u.f.burn.n > 0) { const b = u.f.burn; deal(null, u, b.v, 'burn'); b.n--; if (b.n <= 0) u.f.burn = null; }
      ['taunt', 'mark', 'seal'].forEach(k => { if (u.f[k] > 0) u.f[k]--; });
      if (u.f.chill > 0) { const d = Math.round((u.f.chillS || 0) / u.f.chill); u.f.chill--; u.f.chillS -= d; setSpd(u, u.spd + d); }
      if (u.tmp.length) u.tmp = u.tmp.filter(b => { if (--b.left > 0) return true; revert(u, b); return false; });
    }
    reap();
    for (const u of order()) { u.f.duopo = 0; if (alive(u)) hook(u, 'turn', {}); }
  }
  function basicTarget(u) {
    const fs = foes(u); if (!fs.length) return null;
    const t = fs.find(x => x.f.taunt > 0); if (t) return t;
    if (u.reach !== 'ranged') return fs.slice().sort((a, b) => nearKey(u, a) - nearKey(u, b))[0];   // 近战：同一行最靠前，这一行没人打最近的一行
    return pick(u, 'foe.' + (u.aim || 'low'), {}, null)[0] || fs[0];
  }
  function act(u) {
    acts++; u.acts++; u.st.acts = u.acts; u.next = now + iv(u);
    ev('act', { uid: u.uid, q: queue() });
    if (u.dx.length) runDecl(u, 'pre', {}); if (!alive(u)) return;
    if (u.f.stun > 0) { u.f.stun--; ev('skip', { uid: u.uid, k: 'stun' }); return; }
    if (u.act && u.gp >= u.gpMax) {
      const L = u.actEff || u.act.eff, pre = L[0] && L[0].op !== 'summon' ? targetsOf(u, L[0], {}, null) : [];
      const ka = 1 + TUNE.actUp * Math.max(0, (u.rank || 1) - 1), line = lite ? '' : [u.act.d, ...(u.act.awd || []).slice(0, u.aw)].filter(Boolean).map(t => liveLine(t, ka, u.atk, u.mx)).join('；');
      ev('cast', { uid: u.uid, n: u.act.n, fx: u.act.fx || 'pounce', tg: pre.map(x => x.uid), cells: cellsOf(pre), shape: L[0] && L[0].shape || 'one', line });
      u.gp = 0; u.casts++; u.st.casts = u.casts;
      const prev = cur; cur = u; runList(u, L, {}, { kind: 'act', key: 'act' }, pre.length ? pre : null); cur = prev;
      if (u.dx.length && alive(u)) runDecl(u, 'cast', {});
      return;
    }
    if (u.reach !== 'ranged' && allies(u).some(a => a.r === u.r && a.c < u.c) && !foes(u).some(x => x.f.taunt > 0)) {   // 近战被同一行身前的友蛊挡住：够不着，改为蓄势
      gainGp(u, GP.charge); ev('skip', { uid: u.uid, k: 'charge' }); return;
    }
    const tg = basicTarget(u); if (!tg) return;
    const crit = rng() < CRIT.p;
    ev('atk', { uid: u.uid, tg: tg.uid, fx: u.atkFx, reach: u.reach, crit: crit ? 1 : 0, cells: cellsOf([tg]) });
    const prev = cur; cur = u;
    const pa = BX.atkMod(ctx, u, u.atk, tg);
    if (pa > 0) { deal(u, tg, crit ? Math.round(pa * CRIT.mul) : pa, 'hit', crit); if (alive(u)) hook(u, 'attack', { tg, n: pa }); }
    cur = prev;
    gainGp(u, GP.act);
  }

  // ----- 开战 -----
  ev('begin', { A: S[0].map(u => u.uid), B: S[1].map(u => u.uid) });
  S.forEach((arr, s) => {
    arr.forEach((u, i) => { u.st.front = u.c === 0 ? 1 : 0; });
    const sy = syn[s], act = sy.daos.filter(d => d.tier);
    ev('syn', { side: s, daos: act.map(d => ({ dao: d.dao, n: d.name, cnt: d.cnt, tier: d.tier, clash: d.clash, d: d.d })), combos: sy.combos.map(c => ({ id: c.id, n: c.n, uid: (arr.find(x => x.src === c.idx) || {}).uid, mul: c.mul, rank: c.rank })) });
    for (const d of act) {
      const r = d.eff, k = d.clash * RES_K; if (!r) continue;
      for (const u of arr.filter(x => !x.summon && daoOf(x.sp) === d.dao)) {
        const a = r.atk ? P(u.atk, r.atk / 100 * k) : 0, h = r.hp ? P(u.mx, r.hp / 100 * k) : 0;
        if (a || h) { u.atk += a; u.mx += h; u.hp += h; }
        if (r.spd) u.spd = Math.round(u.spd * (1 + r.spd / 100 * k));
        if (r.gp && u.act) u.gp = Math.min(u.gpMax, Math.round(r.gp * k));
        if (a || h || r.spd) ev('buff', { uid: u.uid, a, h, dao: d.dao });
        if (r.sh) shield(u, P(u.mx, r.sh / 100 * k));
        if (r.eff) u.dx.push({ src: { kind: 'dao', key: 'dao', tag: { dao: d.dao } }, list: r.eff });
      }
    }
  });
  all.forEach(u => { u.next = iv(u) * (0.55 + 0.45 * rng()); if (u.act) u.gp = Math.max(u.gp, GP.start); });   // 开战时行动条起点有先有后（种子随机），速快的整体出手更勤，但不是每次都抢到第一下
  BX.begin(ctx); syncAll();
  for (const u of order()) if (alive(u)) hook(u, 'start', {});
  reap();
  ev('order', { q: queue() });
  let winner = null;
  for (;;) {
    if (!S[0].some(alive) || !S[1].some(alive)) break;
    if (acts > MAXACT || ops > MAXOPS) { winner = 'draw'; break; }
    const L = order(); let u = L[0];
    for (const x of L) if (x.next < u.next - 1e-9) u = x;
    if (round === 0 || u.next > round * DIST + 1e-9) { if (round >= maxR) { winner = 'draw'; break; } startRound(round + 1); continue; }
    now = Math.max(now, u.next); act(u); reap();
  }
  if (!winner) { const a = S[0].some(alive), b = S[1].some(alive); winner = a && !b ? 'A' : b && !a ? 'B' : 'draw'; }
  ev('end', { w: winner });

  // ----- 结果 -----
  const units = {}, out = side => {
    const n = (side ? tB : tA).length, hp = new Array(n).fill(0), st = new Array(n).fill(null);
    all.filter(u => u.side === side && u.src != null).forEach(u => {
      const h = alive(u) ? Math.max(1, Math.min(u.card, Math.ceil(u.hp / HPK))) : 0; hp[u.src] = h;
      st[u.src] = { ...u.st, taken: Math.ceil(u.lost / HPK), dmg: u.dmg, hp: h, mx: u.card };
    });
    return { hp, st };
  };
  all.forEach(u => {
    const dead = !alive(u);
    units[u.uid] = { gid: u.gid, side: u.side, src: u.src, sp: u.sp, name: u.name, summon: !!u.summon, dmg: u.dmg, taken: u.taken, healed: u.sup, kills: u.kills, acts: u.acts, casts: u.casts,
      hpEnd: dead ? 0 : u.summon ? Math.max(1, Math.ceil(u.hp / HPK)) : Math.max(1, Math.min(u.card, Math.ceil(u.hp / HPK))), hpB: dead ? 0 : Math.max(0, u.hp), mxB: u.mx, mx: u.card || Math.ceil(u.mx / HPK), dead };
  });
  const score = u => u.dmg + 0.5 * u.taken + 0.5 * u.sup + 0.001 * (100 - u.side);
  const pool = all.filter(u => !u.summon && (winner === 'draw' || u.side === (winner === 'A' ? 0 : 1)));
  const mvp = pool.length ? pool.reduce((b, u) => score(u) > score(b) ? u : b).uid : null;
  const oa = out(0), ob = out(1);
  return { winner, rounds: round, turns: round, seed, sota, log, roster, units, mvp, hpA: oa.hp, hpB: ob.hp, statA: oa.st, statB: ob.st, syn, ops, capped: ops > MAXOPS || acts > MAXACT };
}
