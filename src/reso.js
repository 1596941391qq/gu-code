// 蛊码 GuCode · 道共鸣和杀招的常驻显示（洞府空窍上方、秘境队伍上方共用这一套，别各写一套）。只出 HTML 字符串，不碰 DOM。
//   resoHTML(team, opts)  一排小签：阵上出现的每一道「力道 1/2」「炎道 2/2 · 攻 +15%」，已触发的描朱，差一只的写「再 1 只：攻 +15%」，
//                         相冲的写明打几折；成形的杀招各一签。悬停（data-tip）写每只蛊实际加了多少，例如「赤焰蛊 攻 20 → 23（+3）」。
//     opts.near   = false 不写「再 1 只」（默认写）
//     opts.lone   = false 只有 1 只、还没触发的道不列（秘境队伍上方地方小时用；默认列）
//     opts.combos = false 不列杀招（默认列）
//     opts.empty  = 阵上没有蛊时的那句话（默认空串）
//   resoInfo(team)        上面用到的数：{ daos: [...], combos: [...] }
//   daoChar(sp)           蛊卡角上的小道字（力、炎、冰……），daoColor(sp) 它的颜色
//   resoOf(team, g)       这只蛊身上生效的共鸣，写实际数：「力道共鸣：攻 +15%（+3）」，没有就空串（蛊卡悬停用）
//   resoGain(team, sp)    再上阵一只 sp，哪一道会凑成或升一档共鸣：{ dao, name, tier, sum } 或 null（蛊市「凑共鸣」小签用）
// team = 阵上的蛊（{ sp, rank, atk, hp }，召唤物不算）。数字和战斗里一样：表里写 30，乘 RES_K（0.5）和相冲倍率，玩家拿到 15%。
import { SP, daoOf, RANK } from './core.js';
import { DAO, DAO_TIERS } from './daos.js';
import { synergyOf, RES_K } from './battle.js';

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
  const { daos, combos } = resoInfo(team), near = opts.near !== false, lone = opts.lone !== false;
  const chips = [];
  for (const x of daos) {
    if (!x.on && !lone && !(near && x.next === 1)) continue;
    const head = `${x.name} ${x.cnt}/${x.cap}`;
    const clash = x.on && x.clash < 1 ? `与${x.clashName}相冲，${zhe(x.clash)}` : '';
    const hint = near && x.next === 1 && x.nextSum ? `再 1 只：${x.nextSum}` : '';
    const txt = [head, x.on ? x.sum : '', clash, hint].filter(Boolean).join(' · ');
    const tip = [x.on ? `${x.name}共鸣（${x.tier} 只）：${x.d}${clash ? `（${clash}）` : ''}` : `${x.name}：阵上 ${x.cnt} 只，凑到 ${x.cap} 只触发共鸣`,
      ...x.gus, x.next === 1 && x.nextD ? `再上 1 只${x.name}的蛊：${x.nextD}` : x.next > 1 ? `再上 ${x.next} 只${x.name}的蛊升一档` : ''].filter(Boolean).join('\n');
    chips.push(`<span class="rz${x.on ? ' on' : ''}${clash ? ' clash' : ''}${hint ? ' near' : ''}" style="--dc:${esc(x.color)}" data-tip="${esc(tip)}"><b>${esc(x.ch)}</b>${esc(txt)}</span>`);
  }
  if (opts.combos !== false) for (const c of combos) {
    const tip = `杀招「${c.n}」：${c.d || ''}\n核心蛊：${RANK.names[c.rank] || ''}${c.coreName}，威力 ×${c.mul}`;
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
