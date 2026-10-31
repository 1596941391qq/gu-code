// 蛊码 GuCode · 蛊典扩充（M3 内容）：52 只新蛊、新词条、新杀招、战斗外 meta 钩子。
// 纯数据 + 纯函数，不 import 任何文件（避免与 core.js 循环引用）。战斗内一切随机只走 ctx.rng，结果可复现。
//
// ===================== 集成说明（集成方照做，本文件不改 core.js / battle.js） =====================
// 〇、数据格式（全部 export）
//   NEW_SPECIES[i] = { id, n 名, ab 简字, atk, hp, t 词条, v 层数, tier 蛊池档(0–5，仙蛊 6), rank 基础转数(1–6), role 流派说明,
//                      lore 一句话（末尾带喂食偏好，如「嗜金气（Claude）」）, how 大白话机制, food, eats, school, counters[], counteredBy[],
//                      meta?（战斗外效果说明）, legend?/immortal?（六转仙蛊：只能开茧获得，天地间唯一） }
//   NEW_TRAITS[k]  = { n, ch, trig, d(v), innate?（true = 物种专属、不进突变池）, hooks }
//   NEW_COMBOS[i]  = { id, n, need[2], d, hooks, school, counters[], counteredBy[] }
//   NEW_RECIPES[i] = { id, n, need[2–3]（物种 id 或 { rank: n } = 任意一只 n 转蛊）, out, d }   —— 蛊方，META.matchRecipe / META.discover
//   NEW_SUMMONS = { 召唤物 id: 名 }；NEW_POOL[0..5] = 各档新蛊 id；IMMORTALS（= LEGENDS）= 仙蛊 id
//   FOODS / FOOD_BONUS(0.3) / FOOD_ANY_BONUS(0.1)：喂食偏好；OLD_EXTRA = 旧 12 种的 { rank, food, eats, school }
//   SCHOOLS / FLOW：15 个流派标签与克制表；trCapOf(sp)：词条上限（五转、仙蛊 4，其余 3）；DOOM = 20：天劫压阵回合
//   META：战斗外钩子（卖价、胜利元石、转市价、光阴蝉的蜕、喂食倍率、仙蛊唯一、蛊方匹配与发现）
//
// 一、core.js 合并数据
//   import { NEW_SPECIES, NEW_TRAITS, NEW_COMBOS, NEW_SUMMONS, NEW_POOL, IMMORTALS, OLD_EXTRA, loreWithEats } from './bestiary.js';
//   0. 旧 12 种：Object.assign(SP[id], OLD_EXTRA[id])，lore = loreWithEats(lore, food)。
//   0b. 词条上限：trCap(g) 改为 Math.min(现有算法, trCapOf(g.sp))；MAXQ 改 1（策略性守则：怪癖最多 1 个）。
//   1. SPECIES.push(...NEW_SPECIES)；SP 重建。仙蛊（s.legend / s.immortal）进 SP 和蛊典，但 genTeam / mkNode / rollShop 的随机池
//      要排除：const NORMAL = SPECIES.filter(s => !s.legend)，genTeam 首蛊和 mkNode 的 rng.pick(SPECIES) 改用 NORMAL。
//   2. Object.assign(TRAITS, NEW_TRAITS)。突变池只收可突变词条：
//      TRAIT_KEYS = Object.keys(TRAITS).filter(k => !TRAITS[k].innate)（坐标码另用全量 ALL_TRAIT_KEYS 编号）。
//   3. COMBOS = [...旧 COMBOS, ...NEW_COMBOS]（新杀招都是两蛊配方，与旧配方不重叠）；COMBO 重建。
//   4. Object.assign(SUMMON_NAMES, NEW_SUMMONS)。
//   5. POOL_TIERS 扩到 6 档（下标 = 境界）：POOL_TIERS[i] = [...(旧 POOL_TIERS[i] || []), ...NEW_POOL[i]]，i = 0..5；
//      poolFor = r => POOL_TIERS.slice(0, Math.min(6, (r | 0) + 1)).flat()。REALM_NOTES[2] 的「蛊池全开」要改成「蛊池加入二转档」。
//   6. 坐标码：物种 64 种、词条 50+ 种，超出 4 位。encode/decode 升 ver 3：物种 6 位、词条 6 位（ver 2 照旧 4 位读）。
//   7. 物种 lore 字段照旧是一句话；新增字段 tier / role / how / meta（可选）给蛊典和蛊市详情用。
//
// 二、battle.js 通用派发（共 8 处，每处一两行；tools/bestiary-sim.mjs 会把这些补丁原样打到 battle.js 副本上跑模拟，能跑通即说明补丁对 449317c 有效）
//   P1 顶部：import * as BX from './bestiary.js';
//   P2 在 `const comboEv = ...` 之后建 ctx：
//      const ctx = { S, rng, roster, sideF, turn: 0, alive, allies, foes, buff, shield, deal, summon, hook, ev, has, reg, comboEv };
//   P3 deal() 里 greedy 那行之后：amt = BX.dmgMod(ctx, src, tg, amt, kind); if (amt <= 0) return;
//      同函数末尾 hook(tg, 'hurt', { src, kind, had }) 改为 hook(tg, 'hurt', { src, kind, had, n: amt })
//   P4 run() 的 `return fired;` 之前：if (BX.dispatch(ctx, h, u, c)) fired = true;
//   P5 reap()：`if (!dead.length) return;` 改为 `if (!dead.length) { if (BX.settle(ctx)) continue; return; }`
//      buMie 那行之后加：if (BX.saveDeath(ctx, u)) continue;
//   P6 开战道痕循环之后、start 钩子之前：BX.begin(ctx);
//   P7 ev('turn', { n: turn }) 之后：ctx.turn = turn;
//   P8 对撞：pa/pb 算完后 const pa2 = BX.atkMod(ctx, a, pa, b), pb2 = BX.atkMod(ctx, b, pb, a); 用 pa2/pb2 出手（为 0 则不出手）；
//      两次 deal 之后、reap() 之前：BX.afterClash(ctx, a, b);
//
// 三、渲染层（ui.js）建议
//   - 新事件 ev('status', { uid, k, n })：k ∈ psn 中毒 / para 寄生 / stun 定身 / web 落网 / miss 扑空 / swap 换位 / strip 破甲 / tie 系丝 / blitz 疾袭。没处理也不会报错（EV_MS 无此键 = 0 毫秒）。
//   - buff 事件可能带负攻（a < 0，减攻），浮字请写成「-n 攻」。
//   - 光阴回溯：先 ev('trig', { id: 'rewind' })，再对每只复生的蛊 ev('summon', { uid, rewind: 1 })，uid 与阵亡前相同，记得去掉 .die。
//   - 吞入瓮中的蛊发 ev('faint', { uid, eaten: 1 })，不触发亡语。
//
// 四、meta（战斗外，确定性）：见文件末尾 META。卖蛊、胜利元石、转市价、光阴蝉的「蜕」、喂食倍率、仙蛊唯一、蛊方都从这里取。
//   开茧得仙蛊前先 META.canOwn(全部已有蛊, sp)；拿到任何蛊（炼成 / 开茧 / 招蛊）时 META.discover(sp) 解锁蛊方；
//   光阴蝉入手时 META.onAcquire(g)，渡劫成功 META.onTribWin(team)，渡劫失败先 META.tribFailSave(team)，非 null 就恢复渡劫前快照、跳过 wound() 和降阶。
//
// 五、天劫压阵：第 DOOM(20) 合起双方全体每合受 (回合-19) 伤害，在 dispatch 里自动生效，防止回血/护体互耗打满 40 合。旧 12 种对局最长 15 合，不受影响。
//
// 钩子签名：词条 hooks.onX(ctx, u, v, c, go)；杀招 hooks.onX(ctx, u, c, go)。
//   v = 词条层数；c = 事件载荷；go(quiet) = 发触发事件并记为已触发（回响怪癖据此重放）。
//   onStart 开战 / onTurn 回合开始 / onHit 受击 {src,kind,had,n} / onKill 击杀 {victim} / onDeath 亡语 {idx} / onSummon 友蛊被召唤 {u}
//   onAttack 对撞出手后 {tg,n} / onPrep 布阵（开战前，先于开锋） / onFront 换到炉口那一刻 / onFoeFront 敌方换上新炉口 {u} / onMourn 有友蛊阵亡 {dead}
//   修正器（不发事件）：atkMod(ctx,u,v,pa,tg)→pa、dealMod(ctx,u,v,amt,tg,kind)→amt、takeMod(ctx,u,v,amt,src,kind)→amt、
//   auraTake(ctx,holder,v,tg,amt,src,kind)→amt（holder 给同侧 tg 减伤）、saveDeath(ctx,u,v)→true 表示免死。

// ---------- 小工具 ----------
const idx = (ctx, u) => ctx.S[u.side].indexOf(u);
const isFront = (ctx, u) => ctx.allies(u)[0] === u;
const isLast = (ctx, u) => { const a = ctx.allies(u); return a[a.length - 1] === u; };
const nextAlly = (ctx, u) => { const a = ctx.S[u.side]; for (let i = a.indexOf(u) + 1; i < a.length; i++) if (ctx.alive(a[i])) return a[i]; return null; };
const status = (ctx, u, k, n = 1) => ctx.ev('status', { uid: u.uid, k, n });
const heal = (ctx, u, n) => { if (!ctx.alive(u)) return 0; const h = Math.min(n, u.mx - u.hp); if (h <= 0) return 0; u.hp += h; ctx.ev('buff', { uid: u.uid, a: 0, h }); return h; };
const weaken = (ctx, u, n) => { if (!ctx.alive(u)) return 0; const d = Math.min(n, u.atk - 1); if (d <= 0) return 0; u.atk -= d; ctx.ev('buff', { uid: u.uid, a: -d, h: 0 }); return d; };
const poison = (ctx, u, n, k = 'psn') => { if (!ctx.alive(u) || n <= 0) return; u.f[k] = Math.min(12, (u.f[k] || 0) + n); status(ctx, u, k, n); };
const stun = (ctx, u, n = 1, k = 'stun') => { if (!ctx.alive(u)) return; u.f[k] = Math.min(3, (u.f[k] || 0) + n); status(ctx, u, k, n); };
const by = (arr, key) => arr.reduce((b, x) => (b === null || key(x) > key(b) ? x : b), null);   // 取最大者，平手取靠前
const setTr = (ctx, u) => { if (ctx.roster[u.uid]) ctx.roster[u.uid].tr = { ...u.tr }; };
const puppetOf = (ctx, u, x, full) => {
  const p = ctx.summon(u.side, 99, { sp: 'kuilei', atk: Math.max(1, full ? x.atk : Math.ceil(x.atk / 2)), hp: Math.max(1, full ? x.mx : Math.ceil(x.mx / 2)) }, u);
  if (p) { p.tr = {}; Object.entries(x.tr).forEach(([k, l]) => { if (k !== 'strings') giveTr(p, k, l); }); setTr(ctx, p); } return p;
};
// 词条上限：每只蛊最多 3 个词条，五转蛊和仙蛊最多 4 个（吞噬、承嗣、拟态、傀儡加词条时都受此限）
export const trCapOf = sp => ((SPX[sp] || {}).rank || 0) >= 5 ? 4 : 3;
const giveTr = (u, k, l) => { if (l <= 0) return; if (u.tr[k] == null && Object.keys(u.tr).length >= trCapOf(u.sp)) return; u.tr[k] = Math.min(3, (u.tr[k] || 0) + l); };
const trSum = u => Object.values(u.tr).reduce((a, b) => a + b, 0);

// ---------- 新词条 ----------
// innate: true = 物种专属，不进突变池（只能靠本体、附蛊、吞噬获得）
export const NEW_TRAITS = {
  // 可突变的通用词条（7 个）
  ripen:   { n: '蓄势', ch: '蓄', trig: '回合开始', d: v => `不在炉口时，回合开始自身 +${v}/+${v}`,
    hooks: { onTurn(ctx, u, v, c, go) { if (ctx.alive(u) && !isFront(ctx, u)) { go(); ctx.buff(u, v, v); } } } },
  leech:   { n: '吮血', ch: '吮', trig: '出手', d: v => `对撞出手后回复 ${v + 1} 血（不超上限）`,
    hooks: { onAttack(ctx, u, v, c, go) { if (ctx.alive(u) && u.hp < u.mx) { go(); heal(ctx, u, v + 1); } } } },
  venom:   { n: '蚀毒', ch: '毒', trig: '出手', d: v => `对撞出手：目标中毒 ${v} 层（每回合开始掉等同层数的血，层数不消）`,
    hooks: { onAttack(ctx, u, v, c, go) { if (ctx.alive(c.tg)) { go(); poison(ctx, c.tg, v); } } } },
  scale:   { n: '坚鳞', ch: '鳞', trig: '受伤', d: v => `每次受到的伤害 -${v}（至少 1）`,
    hooks: { takeMod(ctx, u, v, amt) { return amt > 1 ? Math.max(1, amt - v) : amt; } } },
  execute: { n: '斩首', ch: '斩', trig: '出手', d: v => `对撞时目标血量不过半，伤害 +${2 * v}`,
    hooks: { dealMod(ctx, u, v, amt, tg, kind) { return kind === 'hit' && tg.hp * 2 <= tg.mx ? amt + 2 * v : amt; } } },
  cleave:  { n: '横扫', ch: '扫', trig: '出手', d: v => `对撞出手：顺势扫到敌方第二只，造成 ${v + 1} 伤害`,
    hooks: { onAttack(ctx, u, v, c, go) {
      const fs = ctx.foes(u), wide = u.combo === 'huangzai', tg = wide ? fs.slice(1) : fs.slice(1, 2);
      if (!tg.length) return; go(); if (wide) ctx.ev('combo', { uid: u.uid, n: u.cname, quiet: 1 }); tg.forEach(f => ctx.deal(u, f, v + (wide ? 2 : 1), 'skill'));
    } } },
  mourn:   { n: '食腐', ch: '腐', trig: '友亡', d: v => `有友蛊阵亡：自身 +${v}/+${v}`,
    hooks: { onMourn(ctx, u, v, c, go) { if (ctx.alive(u)) { go(); ctx.buff(u, v, v); } } } },

  // 物种专属词条
  muster:  { n: '点兵', ch: '兵', trig: '开战', innate: true, d: v => `开战：身后召唤 ${v + 1} 只 1/1 兵蚁`,
    hooks: { onStart(ctx, u, v, c, go) { go(); for (let i = 0; i < v + 1; i++) ctx.summon(u.side, idx(ctx, u) + 1, { sp: 'antling', atk: 1, hp: 1 }, u); } } },
  ember:   { n: '余烬', ch: '烬', trig: '亡语', innate: true, d: v => `亡语：对击杀者造成 ${3 * v} 伤害（无击杀者则烧敌方炉口）`,
    hooks: { onDeath(ctx, u, v, c, go) { const k = u.killer && ctx.alive(u.killer) && u.killer.side !== u.side ? u.killer : ctx.foes(u)[0]; if (k) { go(); ctx.deal(u, k, 3 * v, 'skill'); } } } },
  roll:    { n: '滚丸', ch: '丸', trig: '回合开始', innate: true, d: v => `回合开始：自身 +${v} 护体，越滚越厚`,
    hooks: { onTurn(ctx, u, v, c, go) { if (ctx.alive(u)) { go(); ctx.shield(u, v); } } } },
  blitz:   { n: '疾袭', ch: '疾', trig: '出手', innate: true, d: v => `第一次对撞伤害 ×${v + 1}`,
    hooks: { atkMod(ctx, u, v, pa) { if (u.f.blitz) return pa; u.f.blitz = 1; status(ctx, u, 'blitz'); return pa * (v + 1); } } },
  web:     { n: '结网', ch: '网', trig: '开战', innate: true, d: v => `开战：敌方炉口前 ${v} 次对撞扑空`,
    hooks: { onStart(ctx, u, v, c, go) { const f = ctx.foes(u)[0]; if (f) { go(); stun(ctx, f, v, 'web'); } } } },
  scatter: { n: '散籽', ch: '籽', trig: '亡语', innate: true, d: v => `亡语：原地召唤 ${v + 1} 只 1/1 蚜虫`,
    hooks: { onDeath(ctx, u, v, c, go) { go(); for (let i = 0; i < v + 1; i++) ctx.summon(u.side, c.idx, { sp: 'aphidling', atk: 1, hp: 1 }, u); } } },
  nettle:  { n: '毒毛', ch: '毛', trig: '受击', innate: true, d: v => `被对撞打中：攻击者中毒 ${v} 层`,
    hooks: { onHit(ctx, u, v, c, go) { if (c.src && c.kind === 'hit' && c.src.side !== u.side && ctx.alive(c.src)) { go(); poison(ctx, c.src, v); } } } },
  prick:   { n: '点刺', ch: '刺', trig: '开战', innate: true, d: v => `开战：对敌方血最少的蛊造成 ${2 * v + 1} 伤害`,
    hooks: { onStart(ctx, u, v, c, go) { const t = by(ctx.foes(u), f => -f.hp); if (t) { go(); ctx.deal(u, t, 2 * v + 1, 'skill'); } } } },
  brood:   { n: '抱卵', ch: '卵', trig: '受击', innate: true, d: v => `受击存活：身后召唤 1/1 小蛛（每场最多 ${v + 1} 只）`,
    hooks: { onHit(ctx, u, v, c, go) {
      if (!ctx.alive(u) || (u.f.brood || 0) >= v + 1 || ctx.allies(u).length >= ctx.CAP) return;
      u.f.brood = (u.f.brood || 0) + 1; go(); ctx.summon(u.side, idx(ctx, u) + 1, { sp: 'spiderling', atk: 1, hp: 1 }, u);
    } } },
  burrow:  { n: '钻地', ch: '钻', trig: '换到炉口', innate: true, d: v => `换到炉口那一刻：钻地突袭敌方末位，造成攻×${v} 伤害`,
    hooks: { onFront(ctx, u, v, c, go) {
      const fs = ctx.foes(u), t = fs[fs.length - 1]; if (!t || !ctx.alive(u)) return; go(); ctx.deal(u, t, u.atk * v, 'skill');
    } } },
  ward:    { n: '守宫', ch: '守', trig: '回合开始', innate: true, d: v => `不在炉口时，回合开始给炉口友蛊 +${v + 1} 护体`,
    hooks: { onTurn(ctx, u, v, c, go) { if (ctx.alive(u) && !isFront(ctx, u)) { const f = ctx.allies(u)[0]; if (f) { go(); ctx.shield(f, v + 1); } } } } },
  mother:  { n: '子母', ch: '蚨', trig: '亡语', innate: true, d: v => `亡语：原地召唤子蚨（本蛊一半攻、${2 + v} 血）`,
    hooks: { onDeath(ctx, u, v, c, go) { go(); ctx.summon(u.side, c.idx, { sp: 'fuzi', atk: Math.max(1, Math.ceil(u.atk / 2)) + v - 1, hp: 2 + v }, u); } } },
  burst:   { n: '爆囊', ch: '爆', trig: '亡语', innate: true, d: v => `亡语：对敌方前两只各造成 ${2 * v + 1} 伤害`,
    hooks: { onDeath(ctx, u, v, c, go) { const fs = ctx.foes(u).slice(0, 2); if (fs.length) { go(); fs.forEach(f => ctx.deal(u, f, 2 * v + 1, 'skill')); } } } },
  cocoon:  { n: '结茧', ch: '茧', trig: '回合开始', innate: true, d: v => `第 3 回合开始破茧：攻 +${3 * v}，血回满（每场一次）`,
    hooks: { onTurn(ctx, u, v, c, go) { if (ctx.alive(u) && !u.f.coc && ctx.turn >= 3) { u.f.coc = 1; go(); ctx.buff(u, 3 * v, 0); heal(ctx, u, u.mx); } } } },
  drain:   { n: '抽髓', ch: '髓', trig: '开战', innate: true, d: v => `开战：敌方攻最高的蛊 -${v + 1} 攻，偷来加给自己`,
    hooks: { onStart(ctx, u, v, c, go) { const t = by(ctx.foes(u), f => f.atk); if (!t) return; go(); const d = weaken(ctx, t, v + 1); if (d) ctx.buff(u, d, 0); } } },
  gild:    { n: '镀金', ch: '金', trig: '亡语', innate: true, d: v => `亡语：身后友蛊 +${3 * v} 护体`,
    hooks: { onDeath(ctx, u, v, c, go) { const b = ctx.S[u.side][c.idx]; if (ctx.alive(b)) { go(); ctx.shield(b, 3 * v); } } } },
  nurture: { n: '哺育', ch: '哺', trig: '召唤', innate: true, d: v => `每有友蛊被召唤：那只 +${v}/+${v}`,
    hooks: { onSummon(ctx, u, v, c, go) { if (ctx.alive(u) && c.u && c.u.side === u.side) { go(); ctx.buff(c.u, v, v); } } } },
  hop:     { n: '弹跳', ch: '跳', trig: '出手', innate: true, d: v => `对撞后若还活着，跳到身后友蛊的后面${v > 1 ? `，并 +${v - 1} 攻` : ''}`,
    hooks: { onAttack(ctx, u, v, c, go) {
      if (!ctx.alive(u)) return; const b = nextAlly(ctx, u); if (!b) return; const a = ctx.S[u.side], i = a.indexOf(u), j = a.indexOf(b);
      a[i] = b; a[j] = u; go(); status(ctx, u, 'swap'); if (v > 1) ctx.buff(u, v - 1, 0);
      if (u.combo === 'yixing') { ctx.ev('combo', { uid: u.uid, n: u.cname, quiet: 1 }); ctx.buff(b, 3, 3); u.f.fronted = 0; }
    } } },
  pair:    { n: '比翼', ch: '翼', trig: '布阵', innate: true, d: v => `开战：左右两侧友蛊是同一物种时，自身攻血翻倍${v > 1 ? `再 +${v - 1}` : ''}`,
    hooks: { onStart(ctx, u, v, c, go) {
      const a = ctx.allies(u), i = a.indexOf(u), L = a[i - 1], R = a[i + 1];
      if (L && R && L.sp === R.sp) { go(); ctx.buff(u, u.atk + v - 1, u.hp + v - 1); }
    } } },
  lull:    { n: '催眠', ch: '眠', trig: '受击', innate: true, d: v => `被对撞打中：攻击者下次对撞不出手（每场 ${v + 1} 次）`,
    hooks: { onHit(ctx, u, v, c, go) { if (c.src && c.kind === 'hit' && c.src.side !== u.side && ctx.alive(c.src) && (u.f.lull || 0) < v + 1) { u.f.lull = (u.f.lull || 0) + 1; go(); stun(ctx, c.src, 1); } } } },
  gorge:   { n: '吞元', ch: '饕', trig: '击杀', innate: true, d: v => `击杀：吃下对方一半的攻${v > 1 ? `，另 +${v - 1}/+${v - 1}` : ''}`,
    hooks: { onKill(ctx, u, v, c, go) { if (!ctx.alive(u) || !c.victim) return; go(); ctx.buff(u, Math.max(1, Math.ceil(c.victim.atk / 2)) + v - 1, v - 1); } } },
  miasma:  { n: '瘴气', ch: '瘴', trig: '受击', innate: true, d: v => `第一次受伤：敌方全体中毒 ${v} 层`,
    hooks: { onHit(ctx, u, v, c, go) { if (u.f.mia || c.kind === 'psn') return; u.f.mia = 1; go(); ctx.foes(u).forEach(f => poison(ctx, f, v)); } } },
  chirp:   { n: '叫阵', ch: '叫', trig: '回合开始', innate: true, d: v => `站在炉口时，回合开始敌方炉口 -${v} 攻`,
    hooks: { onTurn(ctx, u, v, c, go) { if (ctx.alive(u) && isFront(ctx, u)) { const f = ctx.foes(u)[0]; if (f && f.atk > 1) { go(); weaken(ctx, f, v); } } } } },
  mirror:  { n: '镜反', ch: '镜', trig: '受击', innate: true, d: v => `受到技能伤害（开锋、杀招、亡语等非对撞伤害）：照回来源，最多 ${3 * v} 点`,
    hooks: { onHit(ctx, u, v, c, go) {
      const s = c.src; if (!s || s.side === u.side || !ctx.alive(s)) return;
      if (c.kind === 'hit' && u.combo === 'jinghua' && u.f.jh !== ctx.turn) { u.f.jh = ctx.turn; ctx.ev('combo', { uid: u.uid, n: u.cname, quiet: 1 }); ctx.deal(u, s, Math.max(1, Math.ceil((c.n || 1) / 2)), 'mirror'); return true; }
      if (!['skill', 'shot'].includes(c.kind)) return;
      go(); ctx.deal(u, s, Math.min(c.n || 1, 3 * v), 'mirror');
    } } },
  hive:    { n: '蜂巢', ch: '巢', trig: '回合开始', innate: true, d: v => `回合开始：身后召唤 1/1 工蜂（每场最多 ${v + 2} 只）`,
    hooks: { onTurn(ctx, u, v, c, go) {
      if (!ctx.alive(u) || (u.f.hive || 0) >= v + 2 || ctx.allies(u).length >= ctx.CAP) return;
      u.f.hive = (u.f.hive || 0) + 1; go(); ctx.summon(u.side, idx(ctx, u) + 1, { sp: 'bee', atk: 1, hp: 1 }, u);
    } } },
  inherit: { n: '承嗣', ch: '嗣', trig: '亡语', innate: true, d: v => `亡语：把自己其余词条全部传给身后友蛊${v > 1 ? `（各多 ${v - 1} 层）` : ''}`,
    hooks: { onDeath(ctx, u, v, c, go) {
      const b = ctx.S[u.side][c.idx]; if (!ctx.alive(b)) return; const give = Object.entries(u.tr).filter(([k, l]) => k !== 'inherit' && l > 0); if (!give.length) return;
      go(); give.forEach(([k, l]) => giveTr(b, k, l + v - 1)); setTr(ctx, b); ctx.buff(b, 1, 1);
    } } },
  frost:   { n: '霜冻', ch: '霜', trig: '出手', innate: true, d: v => `对撞出手：目标下次对撞不出手（每场 ${v + 1} 次）`,
    hooks: { onAttack(ctx, u, v, c, go) {
      const bf = u.combo === 'bingfeng'; if (!ctx.alive(c.tg) || (u.f.frost || 0) >= v + 1) return; u.f.frost = (u.f.frost || 0) + 1; go(); stun(ctx, c.tg, 1);
      if (bf) { cq(ctx, u); ctx.deal(u, c.tg, 2, 'skill'); }
    } } },
  lure:    { n: '引蝶', ch: '引', trig: '布阵', innate: true, d: v => `布阵：把敌方血最少的蛊引到炉口，并使其 -${v} 攻`,
    hooks: { onPrep(ctx, u, v, c, go) {
      const fs = ctx.foes(u); if (fs.length < 2) return; const t = by(fs, f => -f.hp); if (!t) return;
      go(); if (t !== fs[0]) { const a = ctx.S[t.side], i = a.indexOf(fs[0]), j = a.indexOf(t); a[i] = t; a[j] = fs[0]; status(ctx, t, 'swap'); } weaken(ctx, t, v);
    } } },
  pit:     { n: '流沙', ch: '沙', trig: '敌换炉口', innate: true, d: v => `敌方每换上一只新的炉口，它陷进流沙受 ${2 * v} 伤害`,
    hooks: { onFoeFront(ctx, u, v, c, go) {
      if (!ctx.alive(u) || !ctx.alive(c.u)) return; go(); ctx.deal(u, c.u, 2 * v * (u.combo === 'liusha' ? 2 : 1), 'skill');
    } } },
  brief:   { n: '朝暮', ch: '暮', trig: '回合开始', innate: true, d: v => `第 ${v + 3} 回合开始寿尽凋零（触发亡语）`,
    hooks: { onTurn(ctx, u, v, c, go) { if (ctx.alive(u) && ctx.turn >= v + 3) { go(); u.sh = 0; ctx.deal(null, u, u.hp, 'self'); } } } },
  chain:   { n: '连雷', ch: '雷', trig: '出手', innate: true, d: v => `对撞出手后，雷光弹向下一只敌蛊，造成这次攻击的 ${v * 50}%`,
    hooks: { onAttack(ctx, u, v, c, go) {
      const all = u.combo === 'leigu', fs = ctx.foes(u).filter(f => f !== c.tg), tg = fs.slice(0, all ? 2 : 1); if (!tg.length) return;
      const d = Math.max(1, Math.floor((c.n || 1) * v / 2)); go(); if (all) ctx.ev('combo', { uid: u.uid, n: u.cname, quiet: 1 }); tg.forEach(f => ctx.deal(u, f, d, 'skill'));
    } } },
  bulwark: { n: '玄甲', ch: '玄', trig: '受伤', innate: true, d: v => `站在炉口时，对撞挨的打减半${v > 1 ? `再 -${v - 1}` : ''}（技能、毒照常吃）`,
    hooks: { takeMod(ctx, u, v, amt, src, kind) { if (kind !== 'hit' || !isFront(ctx, u)) return amt; return Math.max(1, Math.ceil(amt / 2) - (v - 1)); } } },
  strings: { n: '牵丝', ch: '丝', trig: '击杀', innate: true, d: v => `击杀：把对方做成傀儡，放在己方末位（一半攻血，带它的词条；每场 ${v} 次）`,
    hooks: { onKill(ctx, u, v, c, go) {
      const x = c.victim; if (!x || x.f.tied || (u.f.str || 0) >= v || ctx.allies(u).length >= ctx.CAP) return; u.f.str = (u.f.str || 0) + 1; go();
      puppetOf(ctx, u, x, false);
    } } },
  parasite:{ n: '寄生', ch: '寄', trig: '开战', innate: true, d: v => `开战：钻进敌方攻最高的蛊体内，它每回合开始受 ${v + 1} 伤害`,
    hooks: { onStart(ctx, u, v, c, go) { const t = by(ctx.foes(u), f => f.atk); if (t) { go(); poison(ctx, t, v + 1, 'para'); } } } },
  urn:     { n: '入瓮', ch: '瓮', trig: '布阵', innate: true, d: v => `布阵：吞掉身后紧挨的友蛊，得其全部攻血和词条${v > 1 ? `，另 +${2 * (v - 1)}/+${2 * (v - 1)}` : ''}`,
    hooks: { onPrep(ctx, u, v, c, go) {
      const n = 1; let ate = 0;
      for (let k = 0; k < n; k++) {
        const b = nextAlly(ctx, u); if (!b) break; const a = ctx.S[u.side], ga = b.atk, gh = Math.max(1, b.hp); a.splice(a.indexOf(b), 1); b.dead = true; b.hp = 0;
        const bi = a.length > 0 ? Math.min(a.indexOf(u) + 1, a.length) : 0;
        if (!ate) go(); ate++; ctx.ev('faint', { uid: b.uid, eaten: 1 }); ctx.buff(u, ga, gh);
        if (u.combo === 'baichong') ctx.hook(b, 'faint', { idx: bi });
        Object.entries(b.tr).forEach(([k, l]) => { if (k !== 'urn') giveTr(u, k, l); }); setTr(ctx, u);
      }
      if (ate && u.combo === 'baichong') ctx.ev('combo', { uid: u.uid, n: u.cname, quiet: 1 });
      if (ate && v > 1) ctx.buff(u, 2 * (v - 1), 2 * (v - 1));
    } } },
  hex:     { n: '夺志', ch: '魇', trig: '布阵', innate: true, d: v => `布阵：敌方词条最厚的蛊，每个词条 -${v} 层（降到 0 即失效）`,
    hooks: { onPrep(ctx, u, v, c, go) {
      const t = by(ctx.foes(u), f => trSum(f)); if (!t || !trSum(t)) return; go();
      for (const k of Object.keys(t.tr)) { t.tr[k] -= v; if (t.tr[k] <= 0) delete t.tr[k]; } setTr(ctx, t); status(ctx, t, 'hex', v);
    } } },
  sunder:  { n: '破甲', ch: '破', trig: '出手', innate: true, d: v => `对撞前先撕掉目标全部护体${v > 1 ? `，伤害 +${v - 1}` : ''}`,
    hooks: { dealMod(ctx, u, v, amt, tg, kind) {
      if (kind !== 'hit') return amt; const s = tg.sh; if (s > 0) { tg.sh = 0; status(ctx, tg, 'strip', s); }
      if (u.combo === 'kaishan') { if (!u.f.ks) { u.f.ks = 1; ctx.ev('combo', { uid: u.uid, n: u.cname }); } return amt + v + 2; }
      return amt + (v - 1);
    } } },
  storm:   { n: '霆击', ch: '霆', trig: '回合开始', innate: true, d: v => `单数回合开始：对敌方全体各造成 ${v} 伤害`,
    hooks: { onTurn(ctx, u, v, c, go) {
      if (!ctx.alive(u) || ctx.turn % 2 === 0) return; const fs = ctx.foes(u); if (!fs.length) return; const up = u.combo === 'jiutian';
      go(); if (up) ctx.ev('combo', { uid: u.uid, n: u.cname, quiet: 1 }); fs.forEach((f, i) => ctx.deal(u, f, v + (up && i === 0 ? 1 : 0), 'skill'));
    } } },
  mimic:   { n: '拟态', ch: '拟', trig: '布阵', innate: true, d: v => `布阵：照抄敌方炉口的全部词条${v > 1 ? `，层数各 +${v - 1}` : ''}`,
    hooks: { onPrep(ctx, u, v, c, go) {
      const f = ctx.foes(u)[0]; if (!f) return; const src = Object.entries(f.tr).filter(([k, l]) => l > 0 && k !== 'mimic' && k !== 'rewind'); if (!src.length) return;
      go(); src.forEach(([k, l]) => { const want = Math.min(3, l + v - 1); if ((u.tr[k] || 0) < want) giveTr(u, k, want - (u.tr[k] || 0)); }); setTr(ctx, u);
    } } },
  regrow:  { n: '再生', ch: '岁', trig: '回合开始', innate: true, d: v => `第一次阵亡时退到末位，以${['三', '五', '七'][v - 1]}成血重新长出来`,
    hooks: {
      saveDeath(ctx, u, v) {
        if (u.f.regrow) return false; u.f.regrow = 1; const full = u.combo === 'burou';
        const a = ctx.S[u.side]; a.splice(a.indexOf(u), 1); a.push(u); u.hp = full ? u.mx : Math.max(1, Math.ceil(u.mx * [0.3, 0.5, 0.7][v - 1])); u.killer = null;
        ctx.ev('trig', { uid: u.uid, id: 'regrow' }); if (full) ctx.ev('combo', { uid: u.uid, n: u.cname, quiet: 1 }); return true;
      },
    } },
  aegis:   { n: '镇岳', ch: '岳', trig: '光环', innate: true, d: v => `站在末位时，全体友蛊每次受到的伤害 -${v}（至少 1）`,
    hooks: { auraTake(ctx, h, v, tg, amt) { return amt > 1 && ctx.alive(h) && isLast(ctx, h) ? Math.max(1, amt - v) : amt; } } },
  coin:    { n: '吐宝', ch: '宝', trig: '击杀', innate: true, d: v => `击杀：全体友蛊 +${v} 护体`,
    hooks: { onKill(ctx, u, v, c, go) { const a = ctx.allies(u); if (!a.length) return; go(); a.forEach(x => ctx.shield(x, v)); } } },
  rewind:  { n: '光阴', ch: '光', trig: '覆灭', innate: true, d: v => `每场一次：全队将要覆灭时倒转光阴，开战时在阵的蛊全部以五成攻血复生，蝉自己只剩 1 血`, hooks: {} },
  fate:    { n: '织命', ch: '命', trig: '布阵', innate: true, d: v => `布阵：把敌方末位拖到炉口，缠住它 ${v + 2} 合`,
    hooks: {
      onPrep(ctx, u, v, c, go) {
        const fs = ctx.foes(u); if (!fs.length) return; go(); const a = ctx.S[fs[0].side], t = fs[fs.length - 1];
        if (fs.length > 1) { const i = a.indexOf(fs[0]), j = a.indexOf(t); [a[i], a[j]] = [a[j], a[i]]; status(ctx, t, 'swap'); } stun(ctx, t, v + 2, 'web');
      },
    } },
  phoenix: { n: '涅火', ch: '涅', trig: '亡语', innate: true, d: v => `第一次阵亡时化作劫火：对敌方全体各造成 ${v} 伤害，再以一半攻、三成血浴火重生`,
    hooks: { saveDeath(ctx, u, v) {
      if (u.f.phx) return false; u.f.phx = 1; u.killer = null; u.hp = Math.max(1, Math.ceil(u.mx / 3)); ctx.ev('trig', { uid: u.uid, id: 'phoenix' });
      const d = v; ctx.foes(u).forEach(f => ctx.deal(u, f, d, 'skill')); u.atk = Math.max(1, Math.ceil(u.atk / 2)); return true;
    } } },
};

// ---------- 新物种 ----------
// tier：0 凡人 1 一转 2 二转 3 三转 4 四转 5 五转；legend：天级传说，只能开茧获得
// role：流派；how：大白话机制（含战斗外效果）；meta：战斗外效果说明（实现见 META）
const S = (id, n, ab, atk, hp, t, v, tier, role, lore, extra = {}) => ({ id, n, ab, atk, hp, t, v, tier, role, lore, ...extra });
export const NEW_SPECIES = [
  // 凡人 10
  S('ant',      '兵蚁蛊', '蚁', 2, 3, 'muster',  1, 0, '召唤', '一只出巢，一窝跟上'),
  S('firefly',  '萤火蛊', '萤', 2, 2, 'ember',   1, 0, '亡语', '灯灭之前，先烫你一下'),
  S('stick',    '竹节蛊', '竹', 1, 3, 'ripen',   1, 0, '成长·站位', '站在后头，悄悄长成一根梁'),
  S('leech',    '血蛭蛊', '蛭', 2, 3, 'leech',   1, 0, '续航', '咬住了就不松口'),
  S('dung',     '推丸蛊', '丸', 1, 4, 'roll',    1, 0, '经济·护体', '粪丸也是家当，推着走才算富', { meta: '卖掉时多给 1 元石' }),
  S('tiger',    '虎甲蛊', '虎', 3, 2, 'blitz',   1, 0, '爆发', '地上跑得最快的虫，先到先咬'),
  S('webspider','网蛛蛊', '网', 1, 2, 'web',     1, 0, '控制', '网早织好了，是你自己撞上来的'),
  S('aphid',    '蚜群蛊', '蚜', 1, 2, 'scatter', 1, 0, '亡语·召唤', '死了一只，活了一片'),
  S('hairy',    '毛虫蛊', '毛', 2, 3, 'nettle',  1, 0, '反伤·毒', '摸一下，痒三天'),
  S('cent',     '蜈蚣蛊', '蜈', 2, 3, 'venom',   1, 0, '毒', '百足一咬，伤口发黑'),
  // 一转 10
  S('wasp',     '胡蜂蛊', '胡', 2, 2, 'prick',   1, 1, '开锋·点杀', '专挑最软的那一只'),
  S('spider',   '蛛母蛊', '母', 1, 5, 'brood',   1, 1, '召唤', '背上全是孩子，打一下掉一只'),
  S('mole',     '蝼蛄蛊', '蝼', 3, 3, 'burrow',  1, 1, '站位·换位触发', '从地底钻出来，先掏你后院'),
  S('gecko',    '守宫蛊', '守', 1, 4, 'ward',    1, 1, '站位·护体', '趴在后墙上，替门口那位挡刀'),
  S('qingfu',   '青蚨蛊', '蚨', 2, 3, 'mother',  1, 1, '经济·亡语', '母子血涂在钱上，花出去的钱会自己飞回来', { meta: '卖掉时多返 2 元石，等于白用' }),
  S('bomb',     '爆囊蛊', '囊', 2, 2, 'burst',   1, 1, '亡语·群伤', '尾巴一翘，滚烫的气喷你一脸'),
  S('silk',     '蚕茧蛊', '茧', 1, 4, 'cocoon',  1, 1, '成长·延时', '先忍三合，出来就是另一只虫'),
  S('mosq',     '赤蚊蛊', '蚊', 1, 3, 'drain',   1, 1, '控制·偷取', '叮一口，你就没那么有力气了'),
  S('rhino',    '犀角蛊', '犀', 2, 4, 'scale',   1, 1, '减伤', '甲上的刀痕，都是浅的'),
  S('gold',     '金龟蛊', '龟', 2, 3, 'gild',    1, 1, '经济·亡语', '壳上那层金，死后也要留给自家人', { meta: '在阵时斗蛊胜利 +1 元石' }),
  // 二转 9
  S('qant',     '蚁后蛊', '后', 2, 4, 'nurture', 1, 2, '召唤核心', '后来的孩子，都吃得更饱'),
  S('flea',     '跳蚤蛊', '蚤', 3, 3, 'hop',     1, 2, '站位·轮转', '咬一口就跳回后面去'),
  S('bfly',     '比翼蛊', '翼', 3, 4, 'pair',    1, 2, '站位·成对', '两边一个样，它才肯把翅膀全展开'),
  S('sleep',    '眠虫蛊', '眠', 1, 4, 'lull',    1, 2, '控制', '打它的人，打着打着就睡着了'),
  S('stag',     '锹甲蛊', '锹', 3, 4, 'execute', 1, 2, '斩杀', '两把大钳，专夹快倒下的'),
  S('glut',     '饕虫蛊', '饕', 3, 3, 'gorge',   1, 2, '成长·击杀', '吃什么，长什么'),
  S('toad',     '毒蟾蛊', '蟾', 1, 4, 'miasma',  1, 2, '毒·群体', '背上的疙瘩一破，满场都是瘴'),
  S('cricket',  '促织蛊', '促', 2, 3, 'chirp',   1, 2, '经济·控制', '一声叫阵，对面矮半截；街口斗虫的都认得它', { meta: '在阵时蛊市刷新便宜 1 元石' }),
  S('locust',   '蝗群蛊', '蝗', 2, 3, 'cleave',  1, 2, '群攻', '一过，田里一片空'),
  // 三转 8
  S('mirror',   '镜甲蛊', '镜', 2, 4, 'mirror',  1, 3, '反伤·克开锋', '你打出的每一招，都照见你自己'),
  S('hive',     '蜂巢蛊', '巢', 1, 6, 'hive',    1, 3, '召唤', '巢还在，蜂就断不了'),
  S('fly',      '尸蝇蛊', '蝇', 2, 3, 'mourn',   1, 3, '亡语核心', '哪里有死，哪里就有它'),
  S('bury',     '葬甲蛊', '葬', 2, 4, 'inherit', 1, 3, '亡语·传承', '把一身本事埋给下一个'),
  S('frost',    '霜蛉蛊', '蛉', 2, 3, 'frost',   1, 3, '控制', '翅膀一扇，你的手就冻住了'),
  S('lure',     '迷蝶蛊', '蝶', 1, 3, 'lure',    1, 3, '控制·站位', '一只花蝶，把最弱的那只骗到了阵前'),
  S('antlion',  '蚁狮蛊', '狮', 2, 4, 'pit',     1, 3, '站位·陷阱', '沙坑挖好了，谁站上来谁陷下去'),
  S('mayfly',   '蜉蝣蛊', '蜉', 6, 6, 'brief',   1, 3, '爆发·亡语引子', '一生只有一天，所以每一下都拼命'),
  // 四转 7
  S('thunder',  '雷甲蛊', '雷', 3, 4, 'chain',   1, 4, '群攻', '一甲雷光，打一个，麻一串'),
  S('tortoise', '玄龟蛊', '玄', 2, 4, 'bulwark', 1, 4, '坦·站位', '驮着一座山站在门口'),
  S('puppet',   '傀儡蛛', '傀', 3, 3, 'strings', 1, 4, '控制·召唤', '死在它手里的，都得给它干活'),
  S('hairworm', '铁线蛊', '线', 2, 3, 'parasite',1, 4, '寄生·点杀', '钻进去了，就从里面慢慢吃'),
  S('urn',      '瓮王蛊', '瓮', 2, 3, 'urn',     1, 4, '献祭·站位', '百虫入瓮，活下来的那只才叫蛊'),
  S('hex',      '魇蛾蛊', '魇', 1, 3, 'hex',     1, 4, '控制·克成长', '它扑过你的灯，你就忘了自己会什么'),
  S('saw',      '天牛蛊', '牛', 3, 5, 'sunder',  1, 4, '破甲', '两根长须一搭，再厚的壳也是木头'),
  // 五转 5
  S('dfly',     '霆蜓蛊', '霆', 2, 3, 'storm',   1, 5, '群攻', '它一振翅，满阵都在下雷'),
  S('orchid',   '兰螳蛊', '兰', 1, 3, 'mimic',   1, 5, '克制·复制', '开成一朵兰花，学成你的模样'),
  S('taisui',   '太岁蛊', '岁', 2, 4, 'regrow',  1, 5, '坦·不死', '割了又长，长了又割，没人动得了太岁'),
  S('yue',      '镇岳蛊', '岳', 2, 6, 'aegis',   1, 5, '站位·光环', '它在最后头蹲着，前面的就倒不了'),
  S('jinchan',  '金蟾蛊', '金', 3, 4, 'coin',    1, 5, '经济', '三条腿，一口钱，吐出来的都是家底', { meta: '在阵时斗蛊胜利 +2 元石；卖掉时多给 3 元石' }),
  // 六转仙蛊 3（只能开茧获得；天地间唯一：一个玩家同时只能有一只同名仙蛊）
  S('guangyin', '光阴蝉', '光', 2, 4, 'rewind',  1, 6, '仙蛊·逆转', '十七年埋在土里，只为叫那一个夏天。它叫一声，日影就往回走一寸——覆灭的阵前，所有人回到开战那一刻，只是都老了一半；叫完这一声，它自己只剩一口气。',
    { legend: 1, immortal: true, meta: '每次渡劫成功攒一层「蜕」（最多 3 层）；渡劫失败时自动褪下一层，退回渡劫之前，不受伤、主蛊不降阶' }),
  S('fate',     '织命蛛', '命', 2, 5, 'fate',    1, 6, '仙蛊·控制', '它不咬人，只是把你的命线换了个结法', { legend: 1, immortal: true }),
  S('nirvana',  '涅火蛾', '涅', 3, 3, 'phoenix', 1, 6, '仙蛊·亡语', '扑进火里的蛾子很多，从火里飞出来的只有它', { legend: 1, immortal: true }),
];
// ---------- 转数与喂食偏好 ----------
// rank：基础转数。凡人池 = 一转蛊，一转池 = 二转蛊，二转池 = 三转蛊，三转池 = 四转蛊，四转池与五转池 = 五转蛊，仙蛊 = 六转。
// food：偏好的模型族。烧对应模型的 token 时这只蛊灵气成长 +30%（any 不挑食：吃什么都 +10%）。只加成，不惩罚。
export const FOODS = {
  claude: { n: '金气', model: 'Claude', verb: '嗜' },
  gpt:    { n: '青气', model: 'GPT',    verb: '爱吃' },
  glm:    { n: '玄气', model: 'GLM',    verb: '偏好' },
  gemini: { n: '星气', model: 'Gemini', verb: '喜食' },
  qwen:   { n: '云气', model: 'Qwen',   verb: '好饮' },
  any:    { n: '百气', model: '不挑食', verb: '' },
};
export const FOOD_BONUS = 0.3;
export const FOOD_ANY_BONUS = 0.1;
const FOOD_OF = {
  ant: 'gpt', firefly: 'gemini', stick: 'qwen', leech: 'any', dung: 'claude', tiger: 'gpt', webspider: 'glm', aphid: 'any', hairy: 'qwen', cent: 'glm',
  wasp: 'gpt', spider: 'glm', mole: 'qwen', gecko: 'qwen', qingfu: 'claude', bomb: 'glm', silk: 'claude', mosq: 'any', rhino: 'qwen', gold: 'claude',
  qant: 'gpt', flea: 'any', bfly: 'gemini', sleep: 'gemini', stag: 'gpt', glut: 'any', toad: 'glm', cricket: 'qwen', locust: 'gpt',
  mirror: 'claude', hive: 'gpt', fly: 'any', bury: 'glm', frost: 'gemini', lure: 'gemini', antlion: 'qwen', mayfly: 'gemini',
  thunder: 'gpt', tortoise: 'qwen', puppet: 'glm', hairworm: 'glm', urn: 'glm', hex: 'gemini', saw: 'qwen',
  dfly: 'gpt', orchid: 'gemini', taisui: 'qwen', yue: 'qwen', jinchan: 'claude', guangyin: 'claude', fate: 'gemini', nirvana: 'claude',
};
export const eatsOf = food => food === 'any' ? '百气不忌，什么都吃' : `${FOODS[food].verb}${FOODS[food].n}（${FOODS[food].model}）`;
const withEats = (lore, food) => lore + (/[。！？]$/.test(lore) ? '' : '。') + eatsOf(food);
// 旧 12 种的补充字段（集成时 Object.assign 到 core 的 SPECIES 上；lore 用 withEats 后的版本）
export const OLD_EXTRA = Object.fromEntries([
  ['boar', 1, 'any'], ['fire', 1, 'claude'], ['twin', 1, 'gemini'], ['iron', 1, 'qwen'], ['thorn', 1, 'glm'], ['bone', 1, 'glm'],
  ['mantis', 2, 'gpt'], ['queen', 2, 'gpt'], ['cicada', 2, 'claude'], ['drum', 3, 'gpt'], ['scorp', 3, 'glm'], ['moth', 3, 'gemini'],
].map(([id, rank, food]) => [id, { rank, food, eats: eatsOf(food) }]));
export const loreWithEats = withEats;

// 大白话机制：trait 描述 + 战斗外效果；补转数、仙蛊标记、喂食偏好
const TD = Object.fromEntries(Object.entries(NEW_TRAITS).map(([k, t]) => [k, t.d]));
NEW_SPECIES.forEach(s => {
  s.rank = s.legend ? 6 : Math.min(5, s.tier + 1);
  s.food = FOOD_OF[s.id]; s.eats = eatsOf(s.food); s.lore = withEats(s.lore, s.food);
  s.how = TD[s.t](s.v) + (s.meta ? '；' + s.meta : '');
});

export const NEW_SUMMONS = { antling: '兵蚁', aphidling: '蚜虫', spiderling: '小蛛', fuzi: '子蚨', bee: '工蜂', kuilei: '傀儡' };
export const NEW_POOL = [0, 1, 2, 3, 4, 5].map(t => NEW_SPECIES.filter(s => !s.legend && s.tier === t).map(s => s.id));
export const IMMORTALS = NEW_SPECIES.filter(s => s.immortal).map(s => s.id);
export const LEGENDS = IMMORTALS;   // 旧称，等同 IMMORTALS

// ---------- 新杀招 ----------
// need[0] 起名，comboOf 只看「本体 + 附蛊」物种集合，不分主次
const C = (id, n, need, d, hooks = {}) => ({ id, n, need, d, hooks });
const cq = (ctx, u) => ctx.ev('combo', { uid: u.uid, n: u.cname, quiet: 1 });
export const NEW_COMBOS = [
  C('wudu', '五毒噬心', ['cent', 'scorp'], '回合开始：敌方每只中毒的蛊，毒再深一层', {
    onTurn(ctx, u, c, go) { if (!ctx.alive(u)) return; const fs = ctx.foes(u).filter(f => f.f.psn); if (fs.length) { go(true); fs.forEach(f => poison(ctx, f, 1)); } } }),
  C('baiyi', '百蚁噬象', ['ant', 'qant'], '开战：全体兵蚁 +2/+2', {
    onStart(ctx, u, c, go) { const a = ctx.allies(u).filter(x => x.sp === 'antling'); if (a.length) { go(); a.forEach(x => ctx.buff(x, 2, 2)); } } }),
  C('liuying', '流萤焚夜', ['firefly', 'fire'], '亡语：余火落满敌阵，敌方全体各受 1 伤害', {
    onDeath(ctx, u, c, go) { const fs = ctx.foes(u); if (fs.length) { go(); fs.forEach(f => ctx.deal(u, f, 1, 'skill')); } } }),
  C('tianluo', '天罗地网', ['webspider', 'spider'], '小蛛落地时，敌方炉口若没被网住，就给它补一层网', {
    onSummon(ctx, u, c) { if (c.u && c.u.side === u.side && c.u.sp === 'spiderling') { const f = ctx.foes(u)[0]; if (f && !f.f.web) { cq(ctx, u); stun(ctx, f, 1, 'web'); return true; } } } }),
  C('pojian', '破茧成蝶', ['silk', 'bfly'], '第 2 回合就破茧，破茧时左右友蛊各 +1/+1', {
    onTurn(ctx, u, c, go) {
      if (!ctx.alive(u) || u.f.coc || ctx.turn < 2) return; u.f.coc = 1; go(); ctx.buff(u, 3 * (u.tr.cocoon || 1), 0); heal(ctx, u, u.mx);
      const a = ctx.allies(u), i = a.indexOf(u); [a[i - 1], a[i + 1]].forEach(x => x && ctx.buff(x, 1, 1));
    } }),
  C('yixing', '移形换影', ['flea', 'mole'], '每次弹跳换位，换上炉口的友蛊 +3/+3，本蛊下次回到炉口时钻地再发动'),
  C('baichong', '百虫入瓮', ['urn', 'bone'], '被吞进瓮里的蛊，亡语照常发动'),
  C('jinghua', '镜花水月', ['mirror', 'lure'], '对撞挨的打也能照回一半（每回合一次）'),
  C('shijie', '尸解登仙', ['fly', 'bury'], '有友蛊阵亡（包括自己）：其余友蛊各 +1/+1', {
    onMourn(ctx, u, c, go) { if (!ctx.alive(u)) return; go(true); ctx.allies(u).forEach(a => ctx.buff(a, 1, 1)); },
    onDeath(ctx, u, c, go) { const a = ctx.allies(u); if (a.length) { go(); a.forEach(x => ctx.buff(x, 1, 1)); } } }),
  C('bingfeng', '冰火两重', ['frost', 'fire'], '霜冻冻住目标时，再烧它 2 点'),
  C('tixian', '提线百傀', ['puppet', 'spider'], '开战给敌方全体系上傀儡丝（各 -1 攻），它们不论死在谁手里，都完整变成我方傀儡', {
    onStart(ctx, u, c, go) { const fs = ctx.foes(u); if (fs.length) { go(); fs.forEach(f => { f.f.tied = u; status(ctx, f, 'tie'); weaken(ctx, f, 1); }); } } }),
  C('leigu', '雷鼓破天', ['thunder', 'drum'], '连雷一次弹两只'),
  C('xuanwu', '玄武镇关', ['tortoise', 'gecko'], '守宫的护体不再只给别人：站在炉口时，回合开始自己 +1 护体', {
    onTurn(ctx, u, c, go) { if (ctx.alive(u) && isFront(ctx, u)) { go(true); ctx.shield(u, 1); } } }),
  C('kaishan', '开山断岳', ['saw', 'stag'], '对撞伤害 +3'),
  C('burou', '肉身不朽', ['taisui', 'cicada'], '再生重新长出来时，血是满的'),
  C('huangzai', '蝗过千里', ['locust', 'boar'], '横扫不再只扫一只，扫遍敌方整个后排，每只多 1 伤害'),
  C('jiutian', '九天引雷', ['dfly', 'firefly'], '萤火引路：霆击劈敌方炉口时多 1 点'),
  C('tuibao', '金蟾吐宝', ['jinchan', 'qingfu'], '击杀时全体友蛊再 +1/+1；在阵时斗蛊胜利再 +1 元石', {
    onKill(ctx, u, c, go) { const a = ctx.allies(u); if (a.length) { go(true); a.forEach(x => ctx.buff(x, 1, 1)); } } }),
  C('yiri', '一日千秋', ['mayfly', 'bfly'], '蜉蝣阵亡时，全体友蛊 +2/+2', {
    onDeath(ctx, u, c, go) { const a = ctx.allies(u); if (a.length) { go(); a.forEach(x => ctx.buff(x, 2, 2)); } } }),
  C('liusha', '流沙陷阵', ['antlion', 'mole'], '流沙翻倍：开战时敌方炉口也先陷一次，此后每次陷进去的伤害都翻倍', {
    onStart(ctx, u, c, go) { const f = ctx.foes(u)[0]; if (f) { go(); ctx.deal(u, f, 4 * (u.tr.pit || 1), 'skill'); } } }),
  C('shousui', '守岁', ['guangyin', 'gecko'], '守宫守着那一夜：光阴回溯后，蝉自己留下三成血'),
];
const NC = Object.fromEntries(NEW_COMBOS.map(c => [c.id, c]));

// ---------- 流派与克制 ----------
// 15 个流派标签。school = 主流派；counters = 它克制的流派；counteredBy = 克制它的流派。
// 克制环的骨架：召唤怕群攻，群攻怕减伤/护体，护体怕破甲，破甲怕反伤/控制，控制怕召唤（打在炮灰上）；
// 后排成长怕站位（钻地、织命专打末位），爆发怕控制，毒克续航与减伤，斩杀克续航，亡语克爆发与斩杀（杀它就挨反咬）。
export const SCHOOLS = ['召唤', '亡语', '成长', '反伤', '站位', '控制', '毒', '护体', '减伤', '开锋', '群攻', '斩杀', '续航', '爆发', '破甲'];
const FL = `ant 召唤 斩杀,开锋 群攻|firefly 亡语 爆发,斩杀 控制|stick 成长 减伤,护体 站位,爆发|leech 续航 召唤,群攻 毒,斩杀|dung 护体 开锋,群攻 破甲
tiger 爆发 成长,续航 控制,护体|webspider 控制 爆发,斩杀 召唤,群攻|aphid 召唤 斩杀,开锋 群攻|hairy 反伤 爆发,续航 开锋,召唤|cent 毒 减伤,续航 召唤,爆发
wasp 开锋 召唤,成长 护体,反伤|spider 召唤 斩杀,爆发 群攻|mole 站位 成长,站位 反伤,护体|gecko 护体 开锋,爆发 破甲,站位|qingfu 亡语 斩杀,爆发 群攻,控制
bomb 亡语 召唤,爆发 反伤,控制|silk 成长 减伤,续航 爆发,控制|mosq 控制 爆发,成长 召唤,群攻|rhino 减伤 群攻,召唤 斩杀,毒|gold 亡语 开锋,爆发 破甲,控制
qant 召唤 斩杀,开锋 群攻|flea 站位 控制,爆发 站位,群攻|bfly 站位 减伤,续航 开锋,控制|sleep 控制 爆发,斩杀 开锋,召唤|stag 斩杀 续航,减伤 护体,召唤
glut 成长 召唤,亡语 控制,爆发|toad 毒 召唤,续航 爆发,开锋|cricket 控制 爆发,成长 召唤,群攻|locust 群攻 召唤,续航 减伤,护体
mirror 反伤 开锋,群攻 爆发,毒|hive 召唤 斩杀,开锋 群攻|fly 亡语 群攻,召唤 控制,开锋|bury 亡语 斩杀,爆发 控制|frost 控制 爆发,斩杀 召唤,群攻
lure 控制 成长,站位 护体,减伤|antlion 站位 召唤,站位 减伤,护体|mayfly 爆发 减伤,护体 控制,召唤
thunder 群攻 召唤,成长 减伤,反伤|tortoise 减伤 爆发 开锋,毒,群攻|puppet 召唤 召唤,亡语 群攻,控制|hairworm 毒 成长,爆发 续航,召唤
urn 成长 减伤,续航 控制,斩杀|hex 控制 成长,亡语 召唤,爆发|saw 破甲 护体,减伤 反伤,控制
dfly 群攻 召唤,续航 减伤,反伤|orchid 控制 减伤,反伤 召唤|taisui 续航 爆发,斩杀 毒,控制|yue 减伤 群攻,召唤 站位,破甲|jinchan 护体 召唤,开锋 控制,破甲
guangyin 亡语 爆发,斩杀 群攻|fate 控制 成长,站位 召唤|nirvana 亡语 召唤 控制,反伤
wudu 毒 减伤,续航 爆发,召唤|baiyi 召唤 斩杀,开锋 群攻|liuying 亡语 召唤 反伤|tianluo 控制 爆发 群攻|pojian 成长 减伤 爆发
yixing 站位 成长 站位|baichong 亡语 斩杀 控制|jinghua 反伤 爆发,开锋 毒|shijie 亡语 群攻 控制|bingfeng 控制 爆发 召唤
tixian 召唤 召唤,亡语 群攻|leigu 群攻 召唤 减伤|xuanwu 护体 爆发 破甲,毒|kaishan 破甲 护体,减伤 反伤|burou 续航 斩杀,爆发 毒
huangzai 群攻 召唤 减伤|jiutian 群攻 召唤 反伤|tuibao 护体 召唤 控制|yiri 爆发 减伤 控制|liusha 站位 召唤,站位 减伤|shousui 亡语 爆发,斩杀 群攻`;
export const FLOW = Object.fromEntries(FL.split(/[|\n]/).map(x => x.trim().split(' ')).map(([id, school, a, b]) => [id, { school, counters: a.split(','), counteredBy: b.split(',') }]));
NEW_SPECIES.forEach(s => Object.assign(s, FLOW[s.id]));
NEW_COMBOS.forEach(c => Object.assign(c, FLOW[c.id]));
// 旧 12 种的主流派（只用于流派统计和蛊典展示）
export const OLD_SCHOOL = { boar: '成长', fire: '开锋', twin: '召唤', iron: '护体', thorn: '反伤', mantis: '成长', bone: '亡语', queen: '召唤', cicada: '亡语', drum: '站位', scorp: '开锋', moth: '亡语' };
Object.entries(OLD_SCHOOL).forEach(([id, sc]) => { OLD_EXTRA[id].school = sc; });


// ---------- 通用派发（battle.js 打补丁后调用） ----------
// 天劫压阵：第 20 合起双方全体每合受 (回合-19) 伤害，杜绝回血/护体互耗的僵局（旧 12 种的对局最长 15 合，不受影响）
export const DOOM = 20;
// battle.js 只引这一个对象：import { BX } from './bestiary.js'（构建脚本把各文件拼成一个脚本，用对象收口可以避免与别的文件重名）
const HMAP = { start: 'onStart', turn: 'onTurn', hurt: 'onHit', kill: 'onKill', faint: 'onDeath', ally: 'onSummon', attack: 'onAttack', prep: 'onPrep', front: 'onFront', foeFront: 'onFoeFront', mourn: 'onMourn' };

function dispatch(ctx, h, u, c = {}) {
  let fired = false;
  // 状态结算：每只蛊每回合一次（回响重放不重复扣）
  if (h === 'turn' && ctx.alive(u) && u.f.tick !== ctx.turn) {
    u.f.tick = ctx.turn;
    if (u.f.psn) ctx.deal(null, u, u.f.psn, 'psn');
    if (u.f.para && ctx.alive(u)) ctx.deal(null, u, u.f.para, 'para');
    if (ctx.turn >= DOOM && ctx.alive(u)) ctx.deal(null, u, ctx.turn - DOOM + 1, 'doom');
  }
  // 友蛊阵亡广播（殉道重放不重复广播）
  if (h === 'faint' && u.f.tied && !c.tied) { c.tied = 1; const o = u.f.tied; if (ctx.alive(o) && ctx.allies(o).length < ctx.CAP) { cq(ctx, o); puppetOf(ctx, o, u, true); } }
  if (h === 'faint' && !c.mourned) { c.mourned = 1; for (const a of ctx.S[u.side].filter(ctx.alive)) ctx.hook(a, 'mourn', { dead: u }); }
  const name = HMAP[h]; if (!name) return false;
  for (const id in u.tr) {
    const t = NEW_TRAITS[id], fn = t && t.hooks[name]; if (!fn || !u.tr[id]) continue;
    fn(ctx, u, u.tr[id], c, () => { fired = true; ctx.ev('trig', { uid: u.uid, id }); });
  }
  const cb = u.combo && NC[u.combo], cf = cb && cb.hooks[name];
  if (cf && cf(ctx, u, c, quiet => { fired = true; ctx.ev('combo', { uid: u.uid, n: u.cname, quiet: quiet ? 1 : 0 }); })) fired = true;
  return fired;
}

// 伤害修正：攻方 dealMod → 守方 takeMod → 同侧光环 auraTake
function dmgMod(ctx, src, tg, amt, kind) {
  if (src && src.tr) for (const id in src.tr) { const m = NEW_TRAITS[id] && NEW_TRAITS[id].hooks.dealMod; if (m && src.tr[id]) amt = m(ctx, src, src.tr[id], amt, tg, kind); }
  for (const id in tg.tr) { const m = NEW_TRAITS[id] && NEW_TRAITS[id].hooks.takeMod; if (m && tg.tr[id]) amt = m(ctx, tg, tg.tr[id], amt, src, kind); }
  for (const h of ctx.S[tg.side]) { if (!ctx.alive(h) || !h.tr.aegis) continue; amt = NEW_TRAITS.aegis.hooks.auraTake(ctx, h, h.tr.aegis, tg, amt, src, kind); }
  return amt;
}

// 对撞出手前：定身 / 扑空 / 疾袭
function atkMod(ctx, u, pa, tg) {
  u.f.swung = 0;
  if (u.f.stun > 0) { u.f.stun--; status(ctx, u, 'miss'); return 0; }
  if (u.f.web > 0) { u.f.web--; status(ctx, u, 'miss'); return 0; }
  for (const id in u.tr) { const m = NEW_TRAITS[id] && NEW_TRAITS[id].hooks.atkMod; if (m && u.tr[id]) pa = m(ctx, u, u.tr[id], pa, tg); }
  if (pa > 0) { u.f.swung = 1; u.f.lastHit = pa; }
  return pa;
}
function afterClash(ctx, a, b) {
  for (const [x, y] of [[a, b], [b, a]]) if (x.f.swung) { x.f.swung = 0; ctx.hook(x, 'attack', { tg: y, n: x.f.lastHit }); }
}

// 免死：太岁再生、涅火重生
function saveDeath(ctx, u) {
  for (const id in u.tr) { const m = NEW_TRAITS[id] && NEW_TRAITS[id].hooks.saveDeath; if (m && u.tr[id] && m(ctx, u, u.tr[id])) return true; }
  return false;
}

// 布阵：开战前（先于开锋）记下开战快照，结算换位/吞噬/照抄/夺志
function begin(ctx) {
  ctx.BX = { front: [null, null], rew: [0, 0] };
  ctx.opening = ctx.S.map(a => a.map(u => ({ u, atk: u.atk, hp: u.hp, tr: { ...u.tr } })));
  const order = [...ctx.S[0], ...ctx.S[1]].filter(ctx.alive).sort((x, y) => y.atk - x.atk || x.side - y.side);
  for (const u of order) if (ctx.alive(u)) ctx.hook(u, 'prep', {});
  for (const s of [0, 1]) { const f = ctx.S[s].find(ctx.alive); if (f) { f.f.fronted = 1; ctx.BX.front[s] = f.uid; } }
}

// 每轮清点阵亡后：炉口换人（换到炉口 / 敌换炉口），以及光阴回溯
function settle(ctx) {
  if (!ctx.BX) return false;
  let act = false;
  for (const s of [0, 1]) {
    const f = ctx.S[s].find(ctx.alive); if (!f || ctx.BX.front[s] === f.uid) continue;
    ctx.BX.front[s] = f.uid; act = true;
    if (!f.f.fronted) { f.f.fronted = 1; ctx.hook(f, 'front', {}); }
    for (const o of ctx.S[1 - s].filter(ctx.alive)) ctx.hook(o, 'foeFront', { u: f });
  }
  for (const s of [0, 1]) if (!ctx.S[s].some(ctx.alive) && !ctx.BX.rew[s] && rewind(ctx, s)) act = true;
  return act;
}
function rewind(ctx, s) {
  const op = ctx.opening[s], hd = op.find(o => o.tr.rewind); if (!hd) return false;
  ctx.BX.rew[s] = 1; ctx.BX.front[s] = null;
  const tj = hd.u.combo === 'shousui', k = 0.5;
  ctx.ev('trig', { uid: hd.u.uid, id: 'rewind' }); if (tj) ctx.ev('combo', { uid: hd.u.uid, n: hd.u.cname });
  ctx.S[s].length = 0;
  for (const o of op.slice(0, ctx.CAP)) {
    const u = o.u; u.dead = false; u.killer = null; u.sh = 0; u.f = {};
    u.atk = Math.max(1, Math.ceil(o.atk * k)); u.mx = u.hp = o === hd ? (tj ? Math.max(1, Math.ceil(o.hp * 0.3)) : 1) : Math.max(1, Math.ceil(o.hp * k));   // 叫完这一声，蝉自己只剩一口气
    ctx.S[s].push(u); ctx.ev('summon', { uid: u.uid, by: hd.u.uid, rewind: 1 });
  }
  return true;
}

export const BX = { dispatch, dmgMod, atkMod, afterClash, saveDeath, begin, settle };

// ---------- 蛊方（炼蛊配方） ----------
// { id, n, need, out, d }：need 为 2–3 个原料，元素是物种 id，或 { rank: n } 表示「任意一只 n 转蛊」。炼成后原料全部消耗，得到 out。
// 发现规则：第一次炼成 out，或第一次开茧/招蛊拿到 out 时，解锁所有产出 out 的蛊方（META.discover）。
const RC = (id, n, need, out, d) => ({ id, n, need, out, d });
export const NEW_RECIPES = [
  // 炼成二转
  RC('fang_spider', '蛛母方', ['webspider', 'webspider'], 'spider', '两张网叠在一处，网心结出一窝卵'),
  RC('fang_qingfu', '青蚨方', ['leech', 'dung'], 'qingfu', '血蛭的血涂在推丸攒下的家当上，钱从此认得回家的路'),
  RC('fang_silk', '蚕茧方', ['hairy', 'hairy'], 'silk', '两条毛虫抱团吐丝，裹成一枚茧'),
  RC('fang_mosq', '赤蚊方', ['leech', 'tiger'], 'mosq', '血蛭会吸，虎甲会飞，合起来就是一只蚊子'),
  RC('fang_gold', '金龟方', ['dung', 'iron'], 'gold', '推丸攒下的家当，一层层镀到铁甲上'),
  RC('fang_mole', '蝼蛄方', ['boar', 'dung'], 'mole', '野猪拱地，推丸滚土，地底下就有了蝼蛄'),
  // 炼成三转
  RC('fang_qant', '蚁后方', ['ant', 'ant', 'aphid'], 'qant', '两只兵蚁放牧一群蚜虫，吃得最饱的那只登了后位'),
  RC('fang_bfly', '比翼方', ['silk', 'twin'], 'bfly', '分身钻进茧里，破出来的是两片一模一样的翅'),
  RC('fang_sleep', '眠虫方', ['silk', 'silk'], 'sleep', '蚕要四眠才吐丝，两只一起睡过了头，没醒的那只成了眠虫'),
  RC('fang_stag', '锹甲方', ['mantis', 'rhino'], 'stag', '噬心的镰刀长到犀角的甲上，就成了两把大钳'),
  RC('fang_toad', '毒蟾方', ['cent', 'cent', 'hairy'], 'toad', '蟾吞下两条蜈蚣一条毛虫，背上的毒疙瘩就鼓了起来'),
  RC('fang_locust', '蝗群方', ['aphid', 'aphid', 'tiger'], 'locust', '蚜虫成群，虎甲领路，一过田就空了'),
  // 炼成四转
  RC('fang_mirror', '镜甲方', ['iron', 'rhino', 'cicada'], 'mirror', '铁甲磨亮，犀角作底，再贴一层金蝉蜕下的透明壳，就照得见人'),
  RC('fang_hive', '蜂巢方', ['queen', 'wasp', 'wasp'], 'hive', '蜂王带着两只胡蜂筑巢，巢比蜂活得久'),
  RC('fang_bury', '葬甲方', ['bone', 'cicada', 'dung'], 'bury', '推丸刨坑，金蝉留壳，腐骨入穴，土里爬出来的是葬甲'),
  RC('fang_antlion', '蚁狮方', ['ant', 'ant', 'mole'], 'antlion', '蝼蛄吃够了兵蚁，学会在沙里挖坑等下一只'),
  RC('fang_frost', '霜蛉方', ['mosq', 'moth'], 'frost', '赤蚊跟着月蛾在月下飞了一夜，翅上结满了霜'),
  // 炼成五转
  RC('fang_urn', '瓮王方', [{ rank: 3 }, { rank: 3 }, { rank: 3 }], 'urn', '任意三只三转蛊同封一瓮，相互吞食，活下来的那只就是瓮王——这是养蛊最老的法子'),
  RC('fang_hairworm', '铁线方', ['mantis', 'leech', 'fly'], 'hairworm', '铁线虫本就寄生在螳螂肚里长大，血蛭引路，尸蝇收尾'),
  RC('fang_puppet', '傀儡方', ['spider', 'bury'], 'puppet', '蛛母的丝穿进葬甲埋下的尸身，尸身就会动了'),
  RC('fang_hex', '魇蛾方', ['moth', 'sleep'], 'hex', '月蛾扑进眠虫的梦里，再飞出来时满翅都是魇'),
  RC('fang_thunder', '雷甲方', ['firefly', 'iron', 'drum'], 'thunder', '萤火作电，铁甲作壳，战鼓作雷声'),
  RC('fang_yue', '镇岳方', ['gecko', 'rhino', { rank: 4 }], 'yue', '守宫守门，犀角作基，再压一只四转蛊作山心，便镇得住一方'),
  RC('fang_jinchan', '金蟾方', ['toad', 'gold', 'qingfu'], 'jinchan', '毒蟾吞下金龟和青蚨，从此吐出来的都是钱'),
];

// ---------- 战斗外 meta 钩子（确定性：只看阵容，不掷骰） ----------
const SPX = Object.fromEntries([...NEW_SPECIES.map(x => [x.id, x]), ...Object.entries(OLD_EXTRA).map(([id, x]) => [id, { id, ...x }])]);
const has = (team, sp) => team.filter(g => g.sp === sp || (g.att || []).includes(sp)).length;
const hasCombo = (team, need) => team.some(g => { const s = new Set([g.sp, ...(g.att || [])]); return need.every(x => s.has(x)); });
export const META = {
  // 喂食：烧 family（claude/gpt/glm/gemini/qwen）的 token 时，这只蛊灵气成长倍率
  feedMul(g, family) { const f = (SPX[g.sp] || {}).food; return f === family ? 1 + FOOD_BONUS : f === 'any' ? 1 + FOOD_ANY_BONUS : 1; },
  // 仙蛊天地间唯一：owned 为玩家当前拥有的全部蛊（阵上 + 寄存），已有同名仙蛊则不能再得
  canOwn(owned, sp) { return !(SPX[sp] && SPX[sp].immortal && owned.some(g => g.sp === sp)); },
  // 蛊方匹配：gus 为准备投炉的蛊（2–3 只），返回命中的蛊方或 null。物种原料优先配对，{rank} 通配用剩下的蛊补
  matchRecipe(gus) {
    for (const r of NEW_RECIPES) {
      if (r.need.length !== gus.length) continue;
      const left = gus.map(g => g.sp); let ok = true;
      for (const x of r.need.filter(x => typeof x === 'string')) { const i = left.indexOf(x); if (i < 0) { ok = false; break; } left.splice(i, 1); }
      if (!ok) continue;
      const ranks = left.map(sp => (SPX[sp] || {}).rank || 0).sort(), want = r.need.filter(x => typeof x !== 'string').map(x => x.rank).sort();
      if (ranks.join() === want.join()) return r;
    }
    return null;
  },
  // 发现：拿到（炼成 / 开茧 / 招蛊）物种 sp 时解锁的蛊方 id
  discover(sp) { return NEW_RECIPES.filter(r => r.out === sp).map(r => r.id); },
  // 卖蛊：在原 sellValue 之上额外给的元石
  sellBonus(g) { return ({ dung: 1, qingfu: 2, jinchan: 3 })[g.sp] || 0; },
  // 斗蛊胜利（幽灵、渡劫、无尽）额外元石：在阵每只叠加
  winBonus(team) { return has(team, 'gold') + 2 * has(team, 'jinchan') + (hasCombo(team, ['jinchan', 'qingfu']) ? 1 : 0); },
  // 蛊市刷新减价（不叠加，最低 0）
  refreshDiscount(team) { return has(team, 'cricket') ? 1 : 0; },
  // 光阴蝉的「蜕」：获得时 1 层，每次渡劫成功 +1（最多 3）
  onAcquire(g) { if (g.sp === 'guangyin' && g.tui == null) g.tui = 1; return g; },
  onTribWin(team) { team.forEach(g => { if (g.sp === 'guangyin') g.tui = Math.min(3, (g.tui || 0) + 1); }); },
  // 渡劫失败时调用：有蜕就褪一层，返回 { uid, left }，调用方应把阵容恢复到渡劫前快照、跳过 wound() 和主蛊降阶；无蜕返回 null
  tribFailSave(team) {
    const g = team.find(x => x.sp === 'guangyin' && (x.tui || 0) > 0); if (!g) return null;
    g.tui--; return { uid: g.uid, left: g.tui, txt: `光阴蝉褪下一层蜕，日影倒回渡劫之前（余 ${g.tui} 层）` };
  },
};
