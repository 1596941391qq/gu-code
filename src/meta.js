// 蛊码 GuCode · 成就道途（纯逻辑，不碰 DOM）。规则见 docs/design.md 第 4 节。
// 成就是一条逐步点亮的道途：达成一个，就解锁新的蛊、食物、秘境或玩法。成就本身不给数值。没有等级、经验、宝箱、每日任务。
//
// 用法：S.meta = metaMigrate(saved.meta)；事件发生时 const got = metaEmit(S.meta, '事件计数名', n, { set })，
//   got = 刚达成的道途节点数组（界面按 design.md 第 5 节全屏播放，每个停住等玩家点）。
//   事件计数名见 timeline.js 文件头（trips / clears / realm / merges / combos / buys / feeds）；opts.set = true 表示取最大值而不是累加（如境界）。
// isUnlocked(M, id, k)：物种 / 食物 / 秘境 / 玩法是否已解锁（不在 LOCKED 名单里的默认可用）。
// timelineView(M)：道途面板用，每条带 state：done 已达成 / open 可达成（前置已满足）/ locked 前置未满足。
import { TIMELINE, LOCKED } from './timeline.js';

export const TL = Object.fromEntries(TIMELINE.map(a => [a.id, a]));
// 算力履历的成就与称号会登记到这里（ledger.js 的 ledgerMetaRegister），道途面板之外单独展示
export const ACHIEVEMENTS = [], ACH_BY_ID = {}, TITLES = [];

export function metaInit() { return { v: 3, cnt: {}, done: [], at: {} }; }
export function metaMigrate(m) { return m && m.v === 3 ? Object.assign(metaInit(), m) : metaInit(); }

const reached = (M, a) => Object.entries(a.need || {}).every(([k, v]) => (M.cnt[k] || 0) >= v);
const opened = (M, a) => !a.after || M.done.includes(a.after);
export function metaEmit(M, k, n = 1, o = {}) {
  if (!M) return [];
  if (k) M.cnt[k] = o.set ? Math.max(M.cnt[k] || 0, n) : (M.cnt[k] || 0) + n;
  const got = [];
  for (let changed = true; changed;) {
    changed = false;
    for (const a of TIMELINE) if (!M.done.includes(a.id) && opened(M, a) && reached(M, a)) { M.done.push(a.id); M.at[a.id] = Date.now(); got.push(a); changed = true; }
  }
  return got;
}
export function isUnlocked(M, id, k) {
  if (!(LOCKED[k] || []).includes(id)) return true;
  return !!M && M.done.some(d => ((TL[d] || {}).unlock || []).some(u => u.k === k && u.id === id));
}
export function timelineView(M) {
  return TIMELINE.map(a => ({ ...a, state: M && M.done.includes(a.id) ? 'done' : !M || opened(M, a) ? 'open' : 'locked', prog: Object.entries(a.need || {}).map(([k, v]) => ({ k, v, cur: Math.min(v, (M && M.cnt[k]) || 0) })) }));
}
