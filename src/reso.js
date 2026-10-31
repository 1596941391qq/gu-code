// 蛊码 GuCode · 道共鸣和杀招的常驻显示（洞府空窍上方、秘境队伍上方共用这一套，别各写一套）。只出 HTML 字符串，不碰 DOM。
//   resoHTML(team, opts)  一排横排自动折行的小签：已触发的共鸣一道一签描朱「炎道 2/2 · 攻 +15%」（相冲写「相冲五折」）；
//                         还没触发的道合成一枚灰签「金·力·奴·血 各 1/2」，悬停逐道写「再 1 只：…」；成形的杀招各一签。
//                         悬停（data-tip）写每只蛊实际加了多少，例如「赤焰蛊 攻 20 → 23（+3）」。
//     opts.near   = false 离下一档差一只的签不描虚线（默认描）
//     opts.lone   = false 不列还没触发的那枚灰签（默认列）
//     opts.combos = false 不列杀招（默认列）
//     opts.empty  = 阵上没有蛊时的那句话（默认空串）
//   resoInfo(team)        上面用到的数：{ daos: [...], combos: [...] }
//   daoChar(sp)           蛊卡角上的小道字（力、炎、冰……），daoColor(sp) 它的颜色
//   resoOf(team, g)       这只蛊身上生效的共鸣，写实际数：「力道共鸣：攻 +15%（+3）」，没有就空串（蛊卡悬停用）
//   resoGain(team, sp)    再上阵一只 sp，哪一道会凑成或升一档共鸣：{ dao, name, tier, sum } 或 null（蛊市「凑共鸣」小签用）
//   comboStrat(c)         杀招的打法克制一行：「打法：灼烧流、群攻 · 克：护体流… · 被克：续航流…」（蛊典、蛊卡详情、杀招小签悬停共用）
//   comboLow(c, sp)       低转杀招里这一种的转数要求：「需一转」「需二转及以下」，不是低转杀招就空串
// team = 阵上的蛊（{ sp, rank, atk, hp }，召唤物不算）。数字和战斗里一样：表里写 30，乘 RES_K（0.5）和相冲倍率，玩家拿到 15%。
import { SP, daoOf, RANK } from './core.js';
import { DAO, DAO_TIERS } from './daos.js';
import { synergyOf, RES_K } from './battle.js';
import { COMBO2, STRAT } from './combos2.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const CN_ZHE = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const zhe = k => { const t = Math.round(k * 10); return t > 0 && t < 10 ? `打${CN_ZHE[t]}折` : `×${k}`; };
const pctOf = (v, k) => Math.round(v * RES_K * k);
const addOf = (n, p) => (p > 0 ? Math.max(1, Math.round(n * p / 100)) : 0);
const nmOf = g => (SP[g.sp] ? SP[g.sp].n : g.sp);

export const daoChar = sp => { const d = DAO[daoOf(sp)]; return d ? (d.ch || d.n.replace(/道$/, '')[0]) : ''; };
export const daoColor = sp => { const d = DAO[daoOf(sp)]; return d ? d.color : ''; };

// 一档共鸣的简短写法：「攻 +15%」「血 +15% 护体 15%」；表里只有特效的道，取 d 去掉「X道的蛊」开头、到第一个逗号为止
function sumOf(r, k = 1) {
  if (!r) return '';
  const out = [];
  if (r.atk) out.push(`攻 +${pctOf(r.atk, k)}%`);
  if (r.hp) out.push(`血 +${pctOf(r.hp, k)}%`);
  if (r.sh) out.push(`护体 ${pctOf(r.sh, k)}%`);
  if (r.spd) out.push(`速 +${pctOf(r.spd, k)}%`);
  if (r.gp) out.push(`开战蛊力 ${Math.round(r.gp * RES_K * k)}`);
  if (out.length) return out.join(' ');
  return String(r.d || '').replace(/^.{1,3}道的蛊/, '').split(/[，；]/)[0];
}
// 每只蛊实际加多少（悬停用）：「赤焰蛊 攻 20 → 23（+3）」
function perGu(g, r, k) {
  const bits = [];
  if (r.atk) { const p = pctOf(r.atk, k), a = addOf(g.atk, p); bits.push(`攻 ${g.atk} → ${g.atk + a}（+${a}）`); }
  if (r.hp) { const p = pctOf(r.hp, k), a = addOf(g.hp, p); bits.push(`血 ${g.hp} → ${g.hp + a}（+${a}）`); }
  if (r.sh) { const p = pctOf(r.sh, k); bits.push(`护体 ${addOf(g.hp, p)}`); }
  if (r.spd) bits.push(`速 +${pctOf(r.spd, k)}%`);
  return bits.length ? `${nmOf(g)} ${bits.join('，')}` : '';
}
const capOf = n => DAO_TIERS.find(t => t >= n) || DAO_TIERS[DAO_TIERS.length - 1];

export function comboStrat(c) {
  const C = c && (c.style ? c : COMBO2[c.id]); if (!C) return '';
  const nm = ids => (ids || []).map(i => (STRAT[i] ? STRAT[i].n : i)).join('、'), out = [];
  if ((C.style || []).length) out.push('打法：' + nm(C.style));
  if ((C.counters || []).length) out.push('克：' + nm(C.counters));
  if ((C.counteredBy || []).length) out.push('被克：' + nm(C.counteredBy));
  return out.join(' · ');
}
export function comboLow(c, sp) {
  const C = c && (c.need ? c : COMBO2[c.id]), mx = C && C.low ? C.low[sp] : null;
  return mx == null ? '' : mx === 1 ? '需一转' : `需${RANK.names[mx]}及以下`;
}
const lowLine = c => { const C = COMBO2[c.id]; return C && C.low ? '低转杀招：' + Object.keys(C.low).map(sp => `${SP[sp] ? SP[sp].n : sp}${comboLow(C, sp)}`).join('、') + '，升上去就散' : ''; };

export function resoInfo(team) {
  const T = (team || []).filter(g => g && SP[g.sp]);
  let sy; try { sy = synergyOf(T); } catch (e) { sy = { daos: [], combos: [] }; }
  const daos = sy.daos.map(x => {
    const D = DAO[x.dao] || { n: x.name }, k = x.clash || 1, gus = T.filter(g => daoOf(g.sp) === x.dao);
    const nextR = x.next === 1 ? D['r' + (x.cnt + 1)] : null;
    return {
      dao: x.dao, name: D.n || x.name, ch: D.ch || String(D.n || '').replace(/道$/, '')[0], color: D.color || '', cnt: x.cnt, cap: capOf(x.cnt), tier: x.tier, on: !!x.tier,
      clash: k, clashWith: x.clashWith, clashName: x.clashWith && DAO[x.clashWith] ? DAO[x.clashWith].n : '',
      sum: x.tier ? sumOf(x.eff, k) : '', d: x.tier && x.eff ? x.eff.d : '', next: x.next, nextSum: nextR ? sumOf(nextR) : '', nextD: nextR ? nextR.d : '',
      gus: x.tier && x.eff ? gus.map(g => perGu(g, x.eff, k)).filter(Boolean) : [],
    };
  });
  const combos = (sy.combos || []).map(c => ({ id: c.id, n: c.n, d: c.d, mul: c.mul, rank: c.rank, core: c.core, coreName: SP[c.core] ? SP[c.core].n : c.core }));
  return { daos, combos };
}

export function resoHTML(team, opts = {}) {
  const { daos, combos } = resoInfo(team), near = opts.near !== false;
  const chips = [], lone = daos.filter(x => !x.on);
  // 已触发的共鸣：一道一签描朱，「力道 2/2 · 攻 +15%」；相冲写「相冲五折」；离下一档差一只的签描虚线，悬停写「再 1 只」
  for (const x of daos.filter(d => d.on)) {
    const clash = x.clash < 1 ? `与${x.clashName}相冲，${zhe(x.clash)}` : '';
    const txt = [`${x.name} ${x.cnt}/${x.cap}`, x.sum, clash ? '相冲' + zhe(x.clash).replace(/^打/, '') : ''].filter(Boolean).join(' · ');
    const tip = [`${x.name}共鸣（${x.tier} 只）：${x.d}${clash ? `（${clash}）` : ''}`, ...x.gus,
      x.next === 1 && x.nextD ? `再 1 只：${x.nextD}` : x.next > 1 ? `再 ${x.next} 只升一档` : ''].filter(Boolean).join('\n');
    chips.push(`<span class="rz on${clash ? ' clash' : ''}${near && x.next === 1 ? ' near' : ''}" style="--dc:${esc(x.color)}" data-tip="${esc(tip)}"><b>${esc(x.ch)}</b>${esc(txt)}</span>`);
  }
  // 还没触发的道（阵上各 1 只）合成一枚灰签：「金·力·奴·血 各 1/2」，悬停逐道写「再 1 只：…」
  if (lone.length && opts.lone !== false) {
    const cnt = [...new Set(lone.map(x => `${x.cnt}/${x.cap}`))], txt = `${lone.map(x => x.ch).join('·')} ${cnt.length === 1 ? (lone.length > 1 ? '各 ' : '') + cnt[0] : ''}`.trim();
    const tip = ['还没触发的道（同一道凑到 2 只触发共鸣）：', ...lone.map(x => `${x.name} ${x.cnt}/${x.cap} · 再 ${x.next || 1} 只：${x.nextSum || x.nextD || '触发共鸣'}`)].join('\n');
    chips.push(`<span class="rz lone" data-tip="${esc(tip)}">${esc(txt)}</span>`);
  }
  if (opts.combos !== false) for (const c of combos) {
    const tip = [`杀招「${c.n}」：${c.d || ''}`, `核心蛊：${RANK.names[c.rank] || ''}${c.coreName}，威力 ×${c.mul}`, lowLine(c), comboStrat(c)].filter(Boolean).join('\n');
    chips.push(`<span class="rz combo" data-tip="${esc(tip)}"><b>招</b>${esc(c.n)}${c.mul && c.mul !== 1 ? ` ×${c.mul}` : ''}</span>`);
  }
  if (!chips.length) return opts.empty ? `<div class="reso2"><span class="rz none">${esc(opts.empty)}</span></div>` : '';
  return `<div class="reso2">${chips.join('')}</div>`;
}

// 再上阵一只 sp：哪一道会凑成或升一档（只数阵上的，召唤物不算）
export function resoGain(team, sp) {
  const d = daoOf(sp), D = DAO[d]; if (!D) return null;
  const n = (team || []).filter(g => g && SP[g.sp] && daoOf(g.sp) === d).length + 1;
  if (!DAO_TIERS.includes(n) || !D['r' + n]) return null;
  return { dao: d, name: D.n, tier: n, sum: sumOf(D['r' + n]) };
}

// 这只蛊身上生效的共鸣（悬停写实际数）：「力道共鸣：攻 +15%（+3）」「冰雪道共鸣：血 +8%（+3）（与炎道相冲，打五折）」
export function resoOf(team, g) {
  if (!g || !SP[g.sp]) return '';
  const T = (team || []).filter(x => x && SP[x.sp]);
  let sy; try { sy = synergyOf(T); } catch (e) { return ''; }
  const x = sy.daos.find(d => d.dao === daoOf(g.sp) && d.tier), D = x && DAO[x.dao]; if (!x || !x.eff || !D) return '';
  const k = x.clash || 1, r = x.eff, bits = [];
  if (r.atk) { const p = pctOf(r.atk, k); bits.push(`攻 +${p}%（+${addOf(g.atk, p)}）`); }
  if (r.hp) { const p = pctOf(r.hp, k); bits.push(`血 +${p}%（+${addOf(g.hp, p)}）`); }
  if (r.sh) { const p = pctOf(r.sh, k); bits.push(`护体 ${p}%（${addOf(g.hp, p)}）`); }
  if (r.spd) bits.push(`速 +${pctOf(r.spd, k)}%`);
  if (r.gp) bits.push(`开战蛊力 ${Math.round(r.gp * RES_K * k)}`);
  const extra = r.eff ? String(r.d || '').split(/[，；]/).slice(1).join('，') : '';
  return `${D.n}共鸣（${x.tier} 只）：${bits.join('，') || r.d}${extra ? '；' + extra : ''}${k < 1 ? `（与${DAO[x.clashWith] ? DAO[x.clashWith].n : ''}相冲，${zhe(k)}）` : ''}`;
}
