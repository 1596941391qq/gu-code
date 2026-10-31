/* 蛊码 GuCode —— 由 tools/build.mjs 从 src/ 生成，请改 src/ 再构建 */
(() => {
"use strict";
// ---- src/bestiary.js（包一层，只放出 export）
const { NAT_BASE, natMulOf, LEAD, trCapOf, NEW_TRAITS, NEW_SPECIES, OLD_EXTRA, NEW_SUMMONS, NEW_POOL, IMMORTALS, LEGENDS, NEW_COMBOS, SCHOOLS, FLOW, OLD_SCHOOL, DOOM, BX, NEW_RECIPES, META } = (() => {
// 蛊码 GuCode · 蛊典扩充（M3 内容）：52 只新蛊、新词条、新杀招、战斗外 meta 钩子。
// 纯数据 + 纯函数，不 import 任何文件（避免与 core.js 循环引用）。战斗内一切随机只走 ctx.rng，结果可复现。
//
// ===================== 集成说明（集成方照做，本文件不改 core.js / battle.js） =====================
// 〇、数据格式（全部 export）
//   NEW_SPECIES[i] = { id, n 名, ab 简字, atk, hp, t 词条, v 层数, tier 蛊池档(0–5，仙蛊 6), rank 基础转数(1–6), role 流派说明,
//                      lore 一句话, how 大白话机制, school, counters[], counteredBy[],
//                      meta?（战斗外效果说明）, legend?/immortal?（六转仙蛊：只能开茧获得，天地间唯一） }
//   NEW_TRAITS[k]  = { n, ch, trig, d(v), innate?（true = 物种专属、不进突变池）, hooks }
//   NEW_COMBOS[i]  = { id, n, need[2], d, hooks, school, counters[], counteredBy[] }
//   NEW_RECIPES[i] = { id, n, need[2–3]（物种 id 或 { rank: n } = 任意一只 n 转蛊）, out, d }   —— 蛊方，META.matchRecipe / META.discover
//   NEW_SUMMONS = { 召唤物 id: 名 }；NEW_POOL[0..5] = 各档新蛊 id；IMMORTALS（= LEGENDS）= 仙蛊 id
//   OLD_EXTRA = 旧 12 种的 { rank, nat, school }（按模型挑食的设定已删除，见 docs/design.md 3.5）
//   SCHOOLS / FLOW：15 个流派标签与克制表；trCapOf(sp)：词条上限（五转、仙蛊 4，其余 3）；DOOM = 20：天劫压阵回合
//   META：战斗外钩子（卖价、胜利元石、转市价、光阴蝉的蜕、喂食倍率、仙蛊唯一、蛊方匹配与发现）
//
// 一、core.js 合并数据
//   import { NEW_SPECIES, NEW_TRAITS, NEW_COMBOS, NEW_SUMMONS, NEW_POOL, IMMORTALS, OLD_EXTRA } from './bestiary.js';
//   0. 旧 12 种：Object.assign(SP[id], OLD_EXTRA[id])。
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
const weaken = (ctx, u, n) => { if (!ctx.alive(u)) return 0; const d = Math.min(n, u.atk - 1, Math.ceil(u.atk * 0.4)); if (d <= 0) return 0; u.atk -= d; ctx.ev('buff', { uid: u.uid, a: -d, h: 0 }); return d; };   // 单次最多削四成
// 中毒 / 寄生：u.f.psn = 每回合掉血量。单只身上的毒最多叠到它最大血量的 25%（至少 60，数值放大十倍后），防止毒把后期大血量的蛊秒掉
const poison = (ctx, u, n, k = 'psn') => { if (!ctx.alive(u) || n <= 0) return; u.f[k] = Math.min(Math.max(60, Math.ceil(u.mx * 0.25)), (u.f[k] || 0) + n); status(ctx, u, k, n); };
const stun = (ctx, u, n = 1, k = 'stun') => { if (!ctx.alive(u)) return; u.f[k] = Math.min(4, (u.f[k] || 0) + n); status(ctx, u, k, n); };
const by = (arr, key) => arr.reduce((b, x) => (b === null || key(x) > key(b) ? x : b), null);   // 取最大者，平手取靠前
const setTr = (ctx, u) => { if (ctx.roster[u.uid]) ctx.roster[u.uid].tr = { ...u.tr }; };
const swapPos = (ctx, x, y) => { const a = ctx.S[x.side], i = a.indexOf(x), j = a.indexOf(y); a[i] = y; a[j] = x; };
const cnt = (u, k, max) => { if ((u.f[k] || 0) >= max) return false; u.f[k] = (u.f[k] || 0) + 1; return true; };   // 每场限次
// 数值按成长缩放：本命、副词条、杀招、共鸣一律写成「攻 / 血的百分比」，后期攻血放大了它们照样举足轻重
const pc = (n, p) => p > 0 ? Math.max(1, Math.round(n * p)) : 0;
// 本命随转数增强：本命钩子执行期间 NM = 持有者的倍率，A/H/PN 自动乘上（召唤物继承到的本命按 ×1）
const NAT_BASE = 2, NAT_STEP = 0.85;
const natMulOf = r => NAT_BASE + NAT_STEP * (Math.min(5, Math.max(1, r || 1)) - 1);   // 一转 ×2、三转 ×3.7、五转及仙蛊 ×5.4（相对描述里的基准数）
const natMul = u => u.rank ? natMulOf(u.rank) : 1;   // 召唤物没有转数，按 ×1
let NM = 1;
const withNM = (m, f) => { const p = NM; NM = m; try { return f(); } finally { NM = p; } };
// 本命借势：本命钩子里，攻血按「自身」和「本方开战最高攻血的 LEAD」取大，辅蛊的本命到后期也不掉队（u.la / u.lh 在 begin 里按阵容算）
const LEAD = 0.4;
const la = (u, n) => NM > 1 ? Math.max(n, u.la || 0) : n, lh = (u, n) => NM > 1 ? Math.max(n, u.lh || 0) : n;
const A = (u, p) => pc(la(u, u.atk), p * NM);         // 当前攻 × p
const H = (u, p) => pc(lh(u, u.mx), p * NM);          // 最大血 × p
const A0 = (u, p) => pc(la(u, u.a0 || u.atk), p * NM); // 开战攻 × p（叠加型成长用开战值，避免越滚越大）
const H0 = (u, p) => pc(lh(u, u.h0 || u.mx), p * NM);
const PN = (n, p) => pc(n, p * NM);            // 按某个数（这次伤害、护体、对方攻血）× p，也随转数缩放
const aw = (u, n) => (u.aw || 0) >= n;         // 觉醒：u.aw = 0 未觉醒，1 三转觉醒，2 五转觉醒（battle.js toUnit 按转数算）
const isNat = k => !!(NEW_TRAITS[k] && NEW_TRAITS[k].nat);
const SUMMON_IDS = new Set(['pupa', 'shade', 'lunar', 'antling', 'aphidling', 'spiderling', 'fuzi', 'bee', 'kuilei']);
const copySub = (u, s) => Object.entries(u.tr).forEach(([k, l]) => { if (!isNat(k)) giveTr(s, k, l); });
const puppetOf = (ctx, u, x, full) => {
  const p = ctx.summon(u.side, 99, { sp: 'kuilei', atk: full ? x.atk : pc(x.atk, 0.5), hp: full ? x.mx : pc(x.mx, 0.5) }, u);
  if (p) { p.tr = {}; Object.entries(x.tr).forEach(([k, l]) => { if (k !== 'strings') giveTr(p, k, l); }); setTr(ctx, p); } return p;
};
// 词条结构：1 个本命技（独有）+ 最多 2 个副词条，觉醒不占格子。副词条只从突变（三选一）和炼附来
const trCapOf = sp => 2;
// 战斗中途得词条（吞瓮、承嗣、拟态、傀儡、吞元）：只在这一场里生效、不留存；副词条照样最多 2 个，本命不占格子
const giveTr = (u, k, l) => { if (l <= 0) return; if (isNat(k)) { u.tr[k] = 1; return; } if (u.tr[k] == null && Object.keys(u.tr).filter(x => !isNat(x)).length >= trCapOf(u.sp)) return; u.tr[k] = Math.min(3, (u.tr[k] || 0) + l); };
const trSum = u => Object.values(u.tr).reduce((a, b) => a + b, 0);

// ---------- 词条 ----------
// 本命技（nat）：每个物种独有一个，由物种推出、不进坐标码、不进突变池；三转、五转各觉醒一次（aw[0] / aw[1]），给本命追加一条效果。
// 副词条：突变、炼附、吞噬得来，可叠层（v = 1–3），明显弱于本命。旧 14 个副词条在 core.js / battle.js，这里是新增的 6 个。
// 描述里〔〕括住的数随转数缩放：显示值 = 基准 × 该转数的本命倍率（natMulOf）
const fmtNat = (s, m) => s.replace(/〔(\d+)〕/g, (_, x) => String(Math.round(+x * m)));
const N = (n, ch, trig, d, awd, hooks) => ({ n, ch, trig, innate: true, nat: true, d: (v, m = natMulOf(1)) => fmtNat(d, m), aw: awd.map(x => (m = natMulOf(1)) => fmtNat(x, m)), hooks });
const NEW_TRAITS = {
  // ===== 新增副词条（可突变；dao = 所属的道） =====
  siphon:  { n: '吸血', ch: '吸', trig: '出手', dao: '血', d: v => `对撞出手后，回复这次伤害的 ${10 * v}%`,
    hooks: { onAttack(ctx, u, v, c, go) { if (ctx.alive(u) && u.hp < u.mx) { go(); heal(ctx, u, pc(c.n || 1, 0.1 * v)); } } } },
  toxin:   { n: '淬毒', ch: '淬', trig: '出手', dao: '毒', d: v => `对撞出手：目标中毒，每回合掉本蛊攻击 ${8 * v}% 的血`,
    hooks: { onAttack(ctx, u, v, c, go) { if (ctx.alive(c.tg)) { go(); poison(ctx, c.tg, A(u, 0.08 * v)); } } } },
  mend:    { n: '回春', ch: '春', trig: '回合开始', dao: '木', d: v => `回合开始：回复最大血量的 ${3 * v}%`,
    hooks: { onTurn(ctx, u, v, c, go) { if (ctx.alive(u) && u.hp < u.mx) { go(); heal(ctx, u, H(u, 0.03 * v)); } } } },
  spark:   { n: '电光', ch: '电', trig: '出手', dao: '雷', d: v => `对撞出手：电光溅到敌方下一只，造成这次攻击的 ${12 * v}%`,
    hooks: { onAttack(ctx, u, v, c, go) { const f = ctx.foes(u).find(x => x !== c.tg); if (f) { go(); ctx.deal(u, f, pc(c.n || 1, 0.12 * v), 'skill'); } } } },
  insight: { n: '看破', ch: '看', trig: '开战', dao: '智', d: v => `开战：敌方炉口攻击 -${5 * v}%`,
    hooks: { onStart(ctx, u, v, c, go) { const f = ctx.foes(u)[0]; if (f) { go(); weaken(ctx, f, A(f, 0.05 * v)); } } } },
  luck:    { n: '鸿运', ch: '运', trig: '出手', dao: '运', d: v => `对撞时有 ${6 * v}% 的机会多打一倍`,
    hooks: { atkMod(ctx, u, v, pa) { if (pa > 0 && ctx.rng() < 0.06 * v) { status(ctx, u, 'luck'); return pa * 2; } return pa; } } },

  // ===== 旧 12 种的本命技 =====
  rage: N('越伤越狂', '猛', '受击', '被敌方打中且还活着：攻击 +〔15〕%（按开战攻，层层叠加）',
    ['狂到 5 层时冲撞敌方第二只，造成本蛊攻击 〔100〕% 的伤害（每场一次）', '第一次受到致命伤时狂暴一回合：留 1 血、攻击翻倍，下次出手后才倒下'], {
      onHit(ctx, u, v, c, go) {
        if (!ctx.alive(u) || !c.src || c.src.side === u.side) return; u.f.rg = (u.f.rg || 0) + 1; go(); ctx.buff(u, A0(u, 0.15), 0);
        if (aw(u, 1) && u.f.rg >= 5 && cnt(u, 'rgx', 1)) { const fs = ctx.foes(u), t = fs[1] || fs[0]; if (t) ctx.deal(u, t, A(u, 1), 'skill'); }
      },
      saveDeath(ctx, u) { if (!aw(u, 2) || u.f.zb) return false; u.f.zb = ctx.turn || 1; u.hp = 1; u.killer = null; ctx.ev('trig', { uid: u.uid, id: 'rage' }); ctx.buff(u, u.atk, 0); return true; },
      onAttack(ctx, u) { if (u.f.zb && ctx.alive(u)) { u.sh = 0; ctx.deal(null, u, u.hp, 'self'); } },
      onTurn(ctx, u) { if (u.f.zb && ctx.alive(u) && ctx.turn >= u.f.zb + 2) { u.sh = 0; ctx.deal(null, u, u.hp, 'self'); } } }),
  blaze: N('流火', '火', '开战', '开战：对随机一只敌蛊造成本蛊攻击 〔120〕% 的伤害',
    ['被烧中的蛊灼伤：每回合掉本蛊攻击 〔25〕% 的血', '火势分出一股，波及敌方全体（每只本蛊攻击 〔40〕%）'], {
      onStart(ctx, u, v, c, go) {
        const fs = ctx.foes(u); if (!fs.length) return; go();
        if (u.combo === 'liaoyuan') { ctx.comboEv(u); fs.forEach(f => ctx.deal(u, f, A(u, 0.3), 'skill')); }
        else { const t = ctx.rng.pick(fs); ctx.deal(u, t, A(u, 1.2), 'skill'); if (aw(u, 1)) poison(ctx, t, A(u, 0.25)); }
        if (aw(u, 2)) ctx.foes(u).forEach(f => ctx.deal(u, f, A(u, 0.4), 'skill'));
      } }),
  mirage: N('幻身', '幻', '受击', '第一次被打中还活着：身后召唤分影（本蛊攻血 〔50〕%，带本蛊的副词条）',
    ['能分两次', '分影落地时与本体换位：分影顶到前面，本体退到它身后'], {
      onHit(ctx, u, v, c, go) {
        if (!ctx.alive(u) || !c.src || ctx.allies(u).length >= ctx.CAP || !cnt(u, 'mg', aw(u, 1) ? 2 : 1)) return; go();
        const s = ctx.summon(u.side, idx(ctx, u) + 1, { sp: 'shade', atk: A(u, 0.5), hp: H(u, 0.5) }, u); if (!s) return;
        copySub(u, s); setTr(ctx, s); if (aw(u, 2)) { swapPos(ctx, u, s); status(ctx, s, 'swap'); }
      } }),
  ironskin: N('铁骨', '铁', '开战', '开战：获得最大血量 〔40〕% 的护体',
    ['护体没破时，受到的对撞伤害再 -20%', '回合开始补回最大血量 〔8〕% 的护体'], {
      onStart(ctx, u, v, c, go) { go(); ctx.shield(u, H(u, 0.4)); },
      takeMod(ctx, u, v, amt, src, kind) { return aw(u, 1) && kind === 'hit' && u.sh > 0 && amt > 1 ? pc(amt, 0.8) : amt; },
      onTurn(ctx, u, v, c, go) { if (aw(u, 2) && ctx.alive(u)) { go(); ctx.shield(u, H(u, 0.08)); } } }),
  bramble: N('荆棘', '荆', '受击', '被敌方打中：把这一下伤害的 〔50〕% 扎回攻击者（至少 1）',
    ['站在炉口时扎回 〔80〕%', '同时扎到攻击者身后那只（〔30〕%）'], {
      onHit(ctx, u, v, c, go) {
        const s = c.src; if (!s || s.side === u.side || !ctx.alive(s) || ['thorn', 'mirror'].includes(c.kind)) return;
        let p = aw(u, 1) && isFront(ctx, u) ? 0.8 : 0.5; if (u.combo === 'jinjia' && c.had) p *= 2; go();
        ctx.deal(u, s, PN(c.n || 1, p), 'thorn');
        if (aw(u, 2)) { const b = nextAlly(ctx, s); if (b) ctx.deal(u, b, PN(c.n || 1, 0.3), 'thorn'); }
      } }),
  heart: N('噬心', '心', '击杀', '击杀：攻击、最大血量各 +〔30〕%（按当前）',
    ['击杀时回复最大血量 〔30〕%', '开战先扑向敌方血最少的蛊，造成本蛊攻击 〔80〕% 的伤害'], {
      onKill(ctx, u, v, c, go) { if (!ctx.alive(u)) return; go(); ctx.buff(u, A(u, 0.3), H(u, 0.3)); if (aw(u, 1)) heal(ctx, u, H(u, 0.3)); },
      onStart(ctx, u, v, c, go) { if (!aw(u, 2)) return; const t = by(ctx.foes(u), f => -f.hp); if (t) { go(); ctx.deal(u, t, A(u, 0.8), 'skill'); } } }),
  rot: N('腐骨', '蛹', '亡语', '亡语：原地孵出蛊蛹（本蛊攻 〔60〕%、最大血 〔80〕%），蛊蛹会护卫相邻友蛊',
    ['蛊蛹倒下时再孵一只（只孵一代）', '孵化时腐气熏到敌方炉口：中毒，每回合掉本蛊攻击 〔40〕%'], {
      onDeath(ctx, u, v, c, go) {
        go(); const p = ctx.summon(u.side, c.idx, { sp: 'pupa', atk: A(u, 0.6), hp: H(u, 0.8) }, u);
        if (p) { p.tr.guard = 1; if (aw(u, 1)) p.tr.rot = 1; setTr(ctx, p); }
        if (aw(u, 2)) { const f = ctx.foes(u)[0]; if (f) poison(ctx, f, A(u, 0.4)); }
      } }),
  royal: N('王令', '王', '开战', '开战：相邻友蛊攻血各 +〔15〕%；之后每有友蛊被召唤，自身攻血 +〔10〕%',
    ['开战先召来一只工蜂（本蛊攻血 〔40〕%）', '被召唤的友蛊也 +〔20〕% 攻血'], {
      onStart(ctx, u, v, c, go) {
        go(); const a = ctx.S[u.side], i = a.indexOf(u); [a[i - 1], a[i + 1]].forEach(x => { if (ctx.alive(x)) ctx.buff(x, A0(x, 0.15), H0(x, 0.15)); });
        if (aw(u, 1)) ctx.summon(u.side, i + 1, { sp: 'bee', atk: A(u, 0.4), hp: H(u, 0.4) }, u);
      },
      onSummon(ctx, u, v, c, go) { if (!ctx.alive(u) || !c.u || c.u.side !== u.side) return; go(); ctx.buff(u, A0(u, 0.1), H0(u, 0.1)); if (aw(u, 2)) ctx.buff(c.u, A(c.u, 0.2), H(c.u, 0.2)); } }),
  molt: N('蜕壳', '蜕', '亡语', '亡语：身后友蛊得到本蛊攻血的 〔60〕%',
    ['蜕给身后两只（各 〔40〕%）', '第一次阵亡时先蜕一层壳：原地以 30% 血复生，第二次阵亡才蜕给后人'], {
      saveDeath(ctx, u) { if (!aw(u, 2) || u.f.molt) return false; u.f.molt = 1; u.killer = null; u.hp = pc(u.mx, 0.3); ctx.ev('trig', { uid: u.uid, id: 'molt' }); return true; },
      onDeath(ctx, u, v, c, go) {
        const a = ctx.S[u.side], tg = (aw(u, 1) ? [a[c.idx], a[c.idx + 1]] : [a[c.idx]]).filter(x => ctx.alive(x)), p = aw(u, 1) ? 0.4 : 0.6;
        if (!tg.length) return; go(); tg.forEach(b => ctx.buff(b, A(u, p), H(u, p)));
      } }),
  beat: N('战鼓', '战', '回合开始', '回合开始：最前方友蛊攻击 +〔8〕%（按它当前攻）',
    ['同时给最前方友蛊本蛊最大血量 〔8〕% 的护体', '每第 3 回合鼓声大作：全体友蛊攻击 +〔6〕%'], {
      onTurn(ctx, u, v, c, go) {
        if (!ctx.alive(u)) return; const a = ctx.allies(u), f = a[0]; if (!f) return; go(); ctx.buff(f, A(f, 0.08), 0);
        if (aw(u, 1)) ctx.shield(f, H(u, 0.08)); if (aw(u, 2) && ctx.turn % 3 === 0) a.forEach(x => ctx.buff(x, A(x, 0.06), 0));
      } }),
  sting: N('蝎尾', '尾', '开战', '开战：一针扎敌方最末一只，造成本蛊攻击 〔250〕% 的伤害（站在炉口时减半）',
    ['中针的蛊中毒：每回合掉本蛊攻击 〔50〕%', '回合开始若不在炉口，再扎最末一只（本蛊攻击 〔80〕%）'], {
      onStart(ctx, u, v, c, go) { const fs = ctx.foes(u), t = fs[fs.length - 1]; if (!t) return; go(); ctx.deal(u, t, A(u, isFront(ctx, u) ? 1.25 : 2.5), 'skill'); if (aw(u, 1)) poison(ctx, t, A(u, 0.5)); },
      onTurn(ctx, u, v, c, go) { if (!aw(u, 2) || !ctx.alive(u) || isFront(ctx, u)) return; const fs = ctx.foes(u), t = fs[fs.length - 1]; if (t) { go(); ctx.deal(u, t, A(u, 0.8), 'skill'); } } }),
  moon: N('月照', '月', '亡语', '亡语：身后友蛊攻血各 +〔45〕%（按它的开战攻血）',
    ['月光照到身后两只', '受照的友蛊再得到它最大血量 〔25〕% 的护体'], {
      onDeath(ctx, u, v, c, go) {
        const a = ctx.S[u.side], tg = (aw(u, 1) ? [a[c.idx], a[c.idx + 1]] : [a[c.idx]]).filter(x => ctx.alive(x)); if (!tg.length) return; go();
        tg.forEach(b => { ctx.buff(b, A0(b, 0.45), H0(b, 0.45)); if (aw(u, 2)) ctx.shield(b, H(b, 0.25)); });
      } }),

  // ===== 新 52 种的本命技 =====
  muster: N('点兵', '兵', '开战', '开战：身后召唤 2 只兵蚁（各本蛊攻血 〔35〕%）',
    ['有兵蚁倒下时，本蛊攻击 +〔10〕%（按开战攻）', '回合开始兵蚁不足 2 只就补 1 只（每场最多 3 次）'], {
      onStart(ctx, u, v, c, go) { go(); for (let i = 0; i < 2; i++) ctx.summon(u.side, idx(ctx, u) + 1, { sp: 'antling', atk: A(u, 0.35), hp: H(u, 0.35) }, u); },
      onMourn(ctx, u, v, c, go) { if (aw(u, 1) && ctx.alive(u) && c.dead && c.dead.sp === 'antling') { go(); ctx.buff(u, A0(u, 0.1), 0); } },
      onTurn(ctx, u, v, c, go) { if (aw(u, 2) && ctx.alive(u) && ctx.allies(u).filter(x => x.sp === 'antling').length < 2 && ctx.allies(u).length < ctx.CAP && cnt(u, 'mst', 3)) { go(); ctx.summon(u.side, idx(ctx, u) + 1, { sp: 'antling', atk: A(u, 0.35), hp: H(u, 0.35) }, u); } } }),
  ember: N('余烬', '烬', '亡语', '亡语：对击杀者造成本蛊攻击 〔150〕% 的伤害（没有击杀者就烧敌方炉口）',
    ['余烬还灼伤它：每回合掉本蛊攻击 〔30〕%', '火星溅满敌阵：敌方全体再各受本蛊攻击 〔40〕%'], {
      onDeath(ctx, u, v, c, go) {
        const k = u.killer && ctx.alive(u.killer) && u.killer.side !== u.side ? u.killer : ctx.foes(u)[0]; if (!k) return; go();
        ctx.deal(u, k, A(u, 1.5), 'skill'); if (aw(u, 1)) poison(ctx, k, A(u, 0.3)); if (aw(u, 2)) ctx.foes(u).forEach(f => ctx.deal(u, f, A(u, 0.4), 'skill'));
      } }),
  ripen: N('蓄势', '蓄', '回合开始', '不在炉口时，回合开始攻血各 +〔10〕%（按开战攻血）',
    ['站上炉口那一刻，获得最大血量 〔30〕% 的护体', '蓄势翻倍：每回合 +〔20〕%'], {
      onTurn(ctx, u, v, c, go) { if (ctx.alive(u) && !isFront(ctx, u)) { go(); const p = aw(u, 2) ? 0.2 : 0.1; ctx.buff(u, A0(u, p), H0(u, p)); } },
      onFront(ctx, u, v, c, go) { if (aw(u, 1) && ctx.alive(u)) { go(); ctx.shield(u, H(u, 0.3)); } } }),
  leech: N('吮血', '吮', '出手', '对撞出手后，回复这次伤害的 〔50〕%（不超上限）',
    ['回满后多出来的回复变成护体', '每次吸血都偷走目标 〔8〕% 的攻'], {
      onAttack(ctx, u, v, c, go) {
        if (!ctx.alive(u) || (u.hp >= u.mx && !aw(u, 1) && !aw(u, 2))) return; go(); const n = PN(c.n || 1, 0.5), h = heal(ctx, u, n);
        if (aw(u, 1) && n > h) ctx.shield(u, n - h); if (aw(u, 2) && ctx.alive(c.tg)) { const d = weaken(ctx, c.tg, A(c.tg, 0.08)); if (d) ctx.buff(u, d, 0); }
      } }),
  roll: N('滚丸', '丸', '回合开始', '回合开始：获得最大血量 〔10〕% 的护体，越滚越厚',
    ['站上炉口那一刻，护体翻倍', '对撞时额外打出自身护体的 〔30〕%'], {
      onTurn(ctx, u, v, c, go) { if (ctx.alive(u)) { go(); ctx.shield(u, H(u, 0.1)); } },
      onFront(ctx, u, v, c, go) { if (aw(u, 1) && ctx.alive(u) && u.sh > 0) { go(); ctx.shield(u, u.sh); } },
      dealMod(ctx, u, v, amt, tg, kind) { return aw(u, 2) && kind === 'hit' && u.sh > 0 ? amt + PN(u.sh, 0.3) : amt; } }),
  blitz: N('疾袭', '疾', '出手', '第一次对撞伤害 ×2',
    ['疾袭这一下打死了对方，下一次对撞还能再疾袭', '开战先冲一次：对敌方炉口造成本蛊攻击 〔100〕% 的伤害'], {
      atkMod(ctx, u, v, pa) { if (u.f.blitz) return pa; u.f.blitz = 1; u.f.bzT = ctx.turn; status(ctx, u, 'blitz'); return pa * 2; },
      onKill(ctx, u) { if (aw(u, 1) && u.f.bzT === ctx.turn && cnt(u, 'bz2', 1)) u.f.blitz = 0; },
      onStart(ctx, u, v, c, go) { if (!aw(u, 2)) return; const f = ctx.foes(u)[0]; if (f) { go(); ctx.deal(u, f, A(u, 1), 'skill'); } } }),
  web: N('结网', '网', '开战', '开战：敌方炉口第一次对撞扑空',
    ['敌方每换上一只新炉口，也给它结一层网（每场 2 次）', '撞进网里扑空的敌蛊，同时受本蛊攻击 〔100〕% 的伤害'], {
      onStart(ctx, u, v, c, go) { const f = ctx.foes(u)[0]; if (f) { go(); stun(ctx, f, 1, 'web'); if (aw(u, 2)) f.f.webBy = u; } },
      onFoeFront(ctx, u, v, c, go) { if (aw(u, 1) && ctx.alive(u) && ctx.alive(c.u) && !c.u.f.web && cnt(u, 'wb', 2)) { go(); stun(ctx, c.u, 1, 'web'); if (aw(u, 2)) c.u.f.webBy = u; } } }),
  scatter: N('散籽', '籽', '亡语', '亡语：原地召唤 2 只蚜虫（各本蛊攻血 〔35〕%）',
    ['召唤 3 只', '蚜虫带上本蛊的副词条'], {
      onDeath(ctx, u, v, c, go) { go(); for (let i = 0; i < (aw(u, 1) ? 3 : 2); i++) { const s = ctx.summon(u.side, c.idx, { sp: 'aphidling', atk: A(u, 0.35), hp: H(u, 0.35) }, u); if (s && aw(u, 2)) { copySub(u, s); setTr(ctx, s); } } } }),
  nettle: N('毒毛', '毛', '受击', '被对撞打中：攻击者中毒，每回合掉本蛊攻击 〔40〕%',
    ['技能伤害的来源也会被扎', '中了毒毛的敌蛊攻击 -〔15〕%（每只只削一次）'], {
      onHit(ctx, u, v, c, go) {
        const s = c.src; if (!s || s.side === u.side || !ctx.alive(s) || !(c.kind === 'hit' || (aw(u, 1) && c.kind === 'skill'))) return; go();
        poison(ctx, s, A(u, 0.4)); if (aw(u, 2) && !s.f.nt) { s.f.nt = 1; weaken(ctx, s, A(s, 0.15)); }
      } }),
  venom: N('蚀毒', '蚀', '出手', '对撞出手：目标中毒，每回合掉本蛊攻击 〔30〕% 的血（可叠）',
    ['对中毒的目标，对撞伤害 +25%', '打死中毒的敌蛊时，毒转到下一只敌蛊身上'], {
      onAttack(ctx, u, v, c, go) { if (ctx.alive(c.tg)) { go(); poison(ctx, c.tg, A(u, 0.3)); } },
      dealMod(ctx, u, v, amt, tg, kind) { return aw(u, 1) && kind === 'hit' && tg.f.psn ? pc(amt, 1.25) : amt; },
      onKill(ctx, u, v, c, go) { if (aw(u, 2) && c.victim && c.victim.f.psn) { const f = ctx.foes(u)[0]; if (f) { go(); poison(ctx, f, c.victim.f.psn); } } } }),
  prick: N('点刺', '刺', '开战', '开战：对敌方血最少的蛊造成本蛊攻击 〔150〕% 的伤害',
    ['点刺刺死了它，就再刺一只血最少的', '回合开始也刺一下血最少的敌蛊（本蛊攻击 〔50〕%）'], {
      onStart(ctx, u, v, c, go) { const t = by(ctx.foes(u), f => -f.hp); if (!t) return; go(); ctx.deal(u, t, A(u, 1.5), 'skill'); if (aw(u, 1) && t.hp <= 0) { const t2 = by(ctx.foes(u), f => -f.hp); if (t2) ctx.deal(u, t2, A(u, 1.5), 'skill'); } },
      onTurn(ctx, u, v, c, go) { if (!aw(u, 2) || !ctx.alive(u)) return; const t = by(ctx.foes(u), f => -f.hp); if (t) { go(); ctx.deal(u, t, A(u, 0.5), 'skill'); } } }),
  brood: N('抱卵', '卵', '受击', '被打中还活着：身后召唤小蛛（本蛊攻血 〔30〕%，每场最多 2 只）',
    ['每场最多 4 只', '小蛛倒下时，蛛母回复最大血量 〔10〕%'], {
      onHit(ctx, u, v, c, go) { if (!ctx.alive(u) || !c.src || ctx.allies(u).length >= ctx.CAP || !cnt(u, 'brood', aw(u, 1) ? 4 : 2)) return; go(); ctx.summon(u.side, idx(ctx, u) + 1, { sp: 'spiderling', atk: A(u, 0.3), hp: H(u, 0.3) }, u); },
      onMourn(ctx, u, v, c, go) { if (aw(u, 2) && ctx.alive(u) && c.dead && c.dead.sp === 'spiderling') { go(); heal(ctx, u, H(u, 0.1)); } } }),
  burrow: N('钻地', '钻', '换到炉口', '换到炉口那一刻：钻地突袭敌方末位，造成本蛊攻击 〔150〕% 的伤害',
    ['开战时若不在炉口，先钻一次（本蛊攻击 〔80〕%）', '突袭打死了末位，就再钻一次'], {
      onFront(ctx, u, v, c, go) {
        if (!ctx.alive(u)) return; const hit = () => { const fs = ctx.foes(u), t = fs[fs.length - 1]; if (t) ctx.deal(u, t, A(u, 1.5), 'skill'); return t; };
        if (!ctx.foes(u).length) return; go(); const t = hit(); if (aw(u, 2) && t && t.hp <= 0) hit();
      },
      onStart(ctx, u, v, c, go) { if (!aw(u, 1) || isFront(ctx, u)) return; const fs = ctx.foes(u), t = fs[fs.length - 1]; if (t) { go(); ctx.deal(u, t, A(u, 0.8), 'skill'); } } }),
  ward: N('守宫', '守', '回合开始', '不在炉口时，回合开始给炉口友蛊本蛊最大血量 〔15〕% 的护体',
    ['有友蛊倒下时，给炉口友蛊补本蛊最大血量 〔25〕% 的护体', '护体翻倍'], {
      onTurn(ctx, u, v, c, go) { if (ctx.alive(u) && !isFront(ctx, u)) { const f = ctx.allies(u)[0]; if (f) { go(); ctx.shield(f, H(u, aw(u, 2) ? 0.3 : 0.15)); } } },
      onMourn(ctx, u, v, c, go) { if (!aw(u, 1) || !ctx.alive(u)) return; const f = ctx.allies(u)[0]; if (f) { go(); ctx.shield(f, H(u, 0.25)); } } }),
  mother: N('子母', '蚨', '亡语', '亡语：原地召唤子蚨（本蛊攻、血各 〔60〕%）',
    ['子蚨也会子母：再生一只（只再生一代）', '子蚨出生时，敌方炉口受本蛊攻击 〔100〕% 的伤害'], {
      onDeath(ctx, u, v, c, go) {
        go(); const s = ctx.summon(u.side, c.idx, { sp: 'fuzi', atk: A(u, 0.6), hp: H(u, 0.6) }, u); if (s && aw(u, 1)) { s.tr.mother = 1; setTr(ctx, s); }
        if (aw(u, 2)) { const f = ctx.foes(u)[0]; if (f) ctx.deal(u, f, A(u, 1), 'skill'); }
      } }),
  burst: N('爆囊', '爆', '亡语', '亡语：对敌方前两只各造成本蛊攻击 〔100〕% 的伤害',
    ['炸到敌方前三只', '按最大血量算：每只至少受本蛊最大血量 〔50〕% 的伤害'], {
      onDeath(ctx, u, v, c, go) { const fs = ctx.foes(u).slice(0, aw(u, 1) ? 3 : 2); if (!fs.length) return; go(); const d = aw(u, 2) ? Math.max(A(u, 1), H(u, 0.5)) : A(u, 1); fs.forEach(f => ctx.deal(u, f, d, 'skill')); } }),
  cocoon: N('结茧', '茧', '回合开始', '第 3 回合开始破茧：攻击 +〔80〕%，血回满（每场一次）',
    ['结茧期间受到的伤害 -30%', '第 2 回合就破茧'], {
      onTurn(ctx, u, v, c, go) {
        const pj = u.combo === 'pojian', t = aw(u, 2) ? 2 : 3; if (!ctx.alive(u) || u.f.coc || ctx.turn < t) return;
        u.f.coc = 1; go(); ctx.buff(u, A0(u, 0.8), 0); heal(ctx, u, u.mx);
        if (pj) { cq(ctx, u); const a = ctx.allies(u), i = a.indexOf(u); [a[i - 1], a[i + 1]].forEach(x => x && ctx.buff(x, pc(x.a0 || x.atk, 0.15), pc(x.h0 || x.mx, 0.15))); }
      },
      takeMod(ctx, u, v, amt) { return aw(u, 1) && !u.f.coc && amt > 1 ? pc(amt, 0.7) : amt; } }),
  drain: N('抽髓', '髓', '开战', '开战：敌方攻最高的蛊攻击 -〔15〕%，偷来加给自己（单次最多削四成）',
    ['再抽敌方攻第二高的那只', '对撞出手时再偷目标 〔10〕% 的攻'], {
      onStart(ctx, u, v, c, go) { const fs = ctx.foes(u).slice().sort((a, b) => b.atk - a.atk).slice(0, aw(u, 1) ? 2 : 1); if (!fs.length) return; go(); fs.forEach(t => { const d = weaken(ctx, t, A(t, 0.15)); if (d) ctx.buff(u, d, 0); }); },
      onAttack(ctx, u, v, c, go) { if (aw(u, 2) && ctx.alive(c.tg) && ctx.alive(u)) { const d = weaken(ctx, c.tg, A(c.tg, 0.1)); if (d) { go(); ctx.buff(u, d, 0); } } } }),
  scale: N('坚鳞', '鳞', '受伤', '每次受到的伤害 -30%（至少 1）',
    ['血量不过半时，减伤提高到 45%', '每挡下一次，攻击 +〔3〕%（按开战攻）'], {
      takeMod(ctx, u, v, amt) { if (amt <= 1) return amt; const r = pc(amt, aw(u, 1) && u.hp * 2 <= u.mx ? 0.55 : 0.7); if (aw(u, 2) && r < amt) u.atk = Math.min(999, u.atk + A0(u, 0.03)); return r; } }),
  gild: N('镀金', '镀', '亡语', '亡语：身后友蛊获得本蛊最大血量 〔60〕% 的护体',
    ['开战先给身后友蛊镀一层（本蛊最大血量 〔20〕%）', '镀金给全体友蛊'], {
      onDeath(ctx, u, v, c, go) { const a = ctx.S[u.side], tg = aw(u, 2) ? a.filter(ctx.alive) : [a[c.idx]].filter(x => ctx.alive(x)); if (!tg.length) return; go(); tg.forEach(b => ctx.shield(b, H(u, 0.6))); },
      onStart(ctx, u, v, c, go) { if (!aw(u, 1)) return; const b = nextAlly(ctx, u); if (b) { go(); ctx.shield(b, H(u, 0.2)); } } }),
  nurture: N('哺育', '哺', '召唤', '每有友蛊被召唤：它的攻血加上本蛊攻血的 〔15〕%',
    ['开战先召一只兵蚁（本蛊攻血 〔35〕%）', '召唤物倒下时，本蛊攻血 +〔8〕%（按开战攻血）'], {
      onSummon(ctx, u, v, c, go) { if (ctx.alive(u) && c.u && c.u.side === u.side) { go(); ctx.buff(c.u, A(u, 0.15), H(u, 0.15)); } },
      onStart(ctx, u, v, c, go) { if (aw(u, 1)) { go(); ctx.summon(u.side, idx(ctx, u) + 1, { sp: 'antling', atk: A(u, 0.35), hp: H(u, 0.35) }, u); } },
      onMourn(ctx, u, v, c, go) { if (aw(u, 2) && ctx.alive(u) && c.dead && SUMMON_IDS.has(c.dead.sp)) { go(); ctx.buff(u, A0(u, 0.08), H0(u, 0.08)); } } }),
  hop: N('弹跳', '跳', '出手', '对撞后若还活着，跳到身后友蛊的后面，并给顶上来的友蛊本蛊最大血量 〔8〕% 的护体',
    ['每跳一次攻击 +〔10〕%（按开战攻）', '起跳时顺嘴再咬对手一口（本蛊攻击 〔50〕%）'], {
      onAttack(ctx, u, v, c, go) {
        if (!ctx.alive(u)) return; const b = nextAlly(ctx, u); if (!b) return; if (aw(u, 2) && ctx.alive(c.tg)) ctx.deal(u, c.tg, A(u, 0.5), 'skill');
        swapPos(ctx, u, b); go(); status(ctx, u, 'swap'); ctx.shield(b, H(u, 0.08)); if (aw(u, 1)) ctx.buff(u, A0(u, 0.1), 0);
        if (u.combo === 'yixing') { cq(ctx, u); ctx.buff(b, pc(b.a0 || b.atk, 0.12), pc(b.h0 || b.mx, 0.12)); u.f.fronted = 0; }
      } }),
  pair: N('比翼', '翼', '布阵', '开战：左右两侧友蛊是同一物种时，自身攻血翻倍',
    ['只要左右两侧都有友蛊就算比翼（攻血 +50%）', '比翼成功时，左右友蛊也各 +〔25〕% 攻血'], {
      onStart(ctx, u, v, c, go) {
        const a = ctx.allies(u), i = a.indexOf(u), L = a[i - 1], R = a[i + 1]; if (!L || !R) return; const same = L.sp === R.sp; if (!same && !aw(u, 1)) return;
        go(); const p = same ? 1 : 0.5; ctx.buff(u, pc(u.atk, p), pc(u.mx, p)); if (aw(u, 2)) [L, R].forEach(x => ctx.buff(x, A0(x, 0.25), H0(x, 0.25)));
      } }),
  lull: N('催眠', '眠', '受击', '被对撞打中：攻击者下次对撞不出手（每场 2 次）',
    ['每场 3 次', '睡着的敌蛊受到的伤害 +30%'], {
      onHit(ctx, u, v, c, go) { if (c.src && c.kind === 'hit' && c.src.side !== u.side && ctx.alive(c.src) && cnt(u, 'lull', aw(u, 1) ? 3 : 2)) { go(); stun(ctx, c.src, 1); if (aw(u, 2)) c.src.f.drowsy = 1; } } }),
  execute: N('斩首', '斩', '出手', '对撞时目标血量不过半，伤害 +60%',
    ['斩杀后回复最大血量 〔20〕%', '门槛放宽到七成血'], {
      dealMod(ctx, u, v, amt, tg, kind) { return kind === 'hit' && tg.hp <= tg.mx * (aw(u, 2) ? 0.7 : 0.5) ? pc(amt, 1.6) : amt; },
      onKill(ctx, u, v, c, go) { if (aw(u, 1) && ctx.alive(u)) { go(); heal(ctx, u, H(u, 0.2)); } } }),
  gorge: N('吞元', '饕', '击杀', '击杀：吃下对方攻击的 〔50〕%',
    ['同时吃下对方最大血量的 〔30〕%', '再吞下对方一个副词条'], {
      onKill(ctx, u, v, c, go) {
        const x = c.victim; if (!ctx.alive(u) || !x) return; go(); ctx.buff(u, PN(x.atk, 0.5), aw(u, 1) ? PN(x.mx, 0.3) : 0);
        if (aw(u, 2)) { const k = Object.keys(x.tr).find(k => !isNat(k) && u.tr[k] == null); if (k) { giveTr(u, k, x.tr[k]); setTr(ctx, u); } }
      } }),
  miasma: N('瘴气', '瘴', '受击', '第一次受伤：敌方全体中毒，每回合掉本蛊最大血量 〔10〕%',
    ['之后每第 3 回合再放一次瘴', '阵亡时再放一次瘴'], {
      onHit(ctx, u, v, c, go) { if (u.f.mia || !c.src) return; u.f.mia = 1; go(); ctx.foes(u).forEach(f => poison(ctx, f, H(u, 0.1))); },
      onTurn(ctx, u, v, c, go) { if (aw(u, 1) && ctx.alive(u) && u.f.mia && ctx.turn % 3 === 0) { go(); ctx.foes(u).forEach(f => poison(ctx, f, H(u, 0.1))); } },
      onDeath(ctx, u, v, c, go) { if (aw(u, 2)) { const fs = ctx.foes(u); if (fs.length) { go(); fs.forEach(f => poison(ctx, f, H(u, 0.1))); } } } }),
  chirp: N('叫阵', '叫', '回合开始', '站在炉口时，回合开始敌方炉口攻击 -〔12〕%',
    ['削下来的攻加到自己身上', '叫声震慑敌方全体（炉口之外各 -〔6〕%）'], {
      onTurn(ctx, u, v, c, go) {
        if (!ctx.alive(u) || !isFront(ctx, u)) return; const fs = ctx.foes(u); if (!fs.length) return; go();
        (aw(u, 2) ? fs : [fs[0]]).forEach((f, i) => { const d = weaken(ctx, f, A(f, i ? 0.06 : 0.12)); if (d && aw(u, 1)) ctx.buff(u, d, 0); });
      } }),
  cleave: N('横扫', '扫', '出手', '对撞出手：顺势扫到敌方下一只，造成这次攻击的 〔60〕%',
    ['扫到敌方下两只', '横扫扫死一只，本蛊攻击 +〔10〕%（按开战攻）'], {
      onAttack(ctx, u, v, c, go) {
        const fs = ctx.foes(u).filter(f => f !== c.tg), wide = u.combo === 'huangzai', tg = wide ? fs : fs.slice(0, aw(u, 1) ? 2 : 1); if (!tg.length) return;
        go(); if (wide) cq(ctx, u); const d = PN(c.n || 1, 0.6); tg.forEach(f => { ctx.deal(u, f, d, 'skill'); if (aw(u, 2) && f.hp <= 0) ctx.buff(u, A0(u, 0.1), 0); });
      } }),
  mirror: N('镜反', '镜', '受击', '受到技能伤害（开锋、杀招、亡语等非对撞伤害）：原样照回来源（最多本蛊最大血量 〔60〕%）',
    ['被照回的那一下，自己只吃一半', '对撞挨的打也照回 〔25〕%'], {
      takeMod(ctx, u, v, amt, src, kind) { return aw(u, 1) && src && src.side !== u.side && (kind === 'skill' || kind === 'shot') && amt > 1 ? pc(amt, 0.5) : amt; },
      onHit(ctx, u, v, c, go) {
        const s = c.src; if (!s || s.side === u.side || !ctx.alive(s)) return;
        if (c.kind === 'hit') {
          if (u.combo === 'jinghua' && u.f.jh !== ctx.turn) { u.f.jh = ctx.turn; cq(ctx, u); ctx.deal(u, s, pc(c.n || 1, 0.3), 'mirror'); return true; }
          if (aw(u, 2)) { go(); ctx.deal(u, s, PN(c.n || 1, 0.25), 'mirror'); } return;
        }
        if (c.kind !== 'skill' && c.kind !== 'shot') return; go(); ctx.deal(u, s, Math.min(c.n || 1, H(u, 0.6)), 'mirror');
      } }),
  hive: N('蜂巢', '巢', '回合开始', '回合开始：身后召唤工蜂（本蛊攻血 〔25〕%，每场最多 3 只）',
    ['每场最多 5 只', '工蜂出巢时叮敌方炉口一下（本蛊攻击 〔40〕%）'], {
      onTurn(ctx, u, v, c, go) {
        if (!ctx.alive(u) || ctx.allies(u).length >= ctx.CAP || !cnt(u, 'hive', aw(u, 1) ? 5 : 3)) return; go();
        ctx.summon(u.side, idx(ctx, u) + 1, { sp: 'bee', atk: A(u, 0.25), hp: H(u, 0.25) }, u); if (aw(u, 2)) { const f = ctx.foes(u)[0]; if (f) ctx.deal(u, f, A(u, 0.4), 'skill'); }
      } }),
  mourn: N('食腐', '腐', '友亡', '有友蛊阵亡：自身攻血 +〔15〕%（按开战攻血）',
    ['敌蛊阵亡也算', '友蛊阵亡时，对敌方炉口造成本蛊攻击 〔60〕% 的伤害'], {
      onMourn(ctx, u, v, c, go) { if (!ctx.alive(u)) return; go(); ctx.buff(u, A0(u, 0.15), H0(u, 0.15)); if (aw(u, 2)) { const f = ctx.foes(u)[0]; if (f) ctx.deal(u, f, A(u, 0.6), 'skill'); } },
      onFoeDie(ctx, u, v, c, go) { if (aw(u, 1) && ctx.alive(u)) { go(); ctx.buff(u, A0(u, 0.15), H0(u, 0.15)); } } }),
  inherit: N('承嗣', '嗣', '亡语', '亡语：把自己的副词条和本命全部传给身后友蛊',
    ['同时传给它本蛊攻血的 〔30〕%', '传给身后两只'], {
      onDeath(ctx, u, v, c, go) {
        const a = ctx.S[u.side], tg = (aw(u, 2) ? [a[c.idx], a[c.idx + 1]] : [a[c.idx]]).filter(x => ctx.alive(x)), give = Object.entries(u.tr).filter(([k, l]) => k !== 'inherit' && l > 0);
        if (!tg.length || (!give.length && !aw(u, 1))) return; go();
        tg.forEach(b => { give.forEach(([k, l]) => giveTr(b, k, l)); setTr(ctx, b); if (aw(u, 1)) ctx.buff(b, A(u, 0.3), H(u, 0.3)); });
      } }),
  frost: N('霜冻', '霜', '出手', '对撞出手：目标下次对撞不出手（每场 2 次）',
    ['冻住时附带本蛊攻击 〔50〕% 的冰伤', '每场 3 次'], {
      onAttack(ctx, u, v, c, go) {
        if (!ctx.alive(c.tg) || !cnt(u, 'frost', aw(u, 2) ? 3 : 2)) return; go(); stun(ctx, c.tg, 1);
        if (aw(u, 1)) ctx.deal(u, c.tg, A(u, 0.5), 'skill'); if (u.combo === 'bingfeng') { cq(ctx, u); ctx.deal(u, c.tg, A(u, 0.6), 'skill'); }
      } }),
  lure: N('引蝶', '引', '布阵', '布阵：把敌方血最少的蛊引到炉口，并使其攻击 -〔25〕%',
    ['引来的蛊被花粉迷住，第一次对撞扑空', '引来的蛊开战先受本蛊攻击 〔150〕% 的伤害'], {
      onPrep(ctx, u, v, c, go) {
        const fs = ctx.foes(u), t = by(fs, f => -f.hp); if (!t) return; go();
        if (t !== fs[0]) { swapPos(ctx, t, fs[0]); status(ctx, t, 'swap'); } weaken(ctx, t, A(t, 0.25)); if (aw(u, 1)) stun(ctx, t, 1, 'web'); if (aw(u, 2)) ctx.deal(u, t, A(u, 1.5), 'skill');
      } }),
  pit: N('流沙', '沙', '敌换炉口', '敌方每换上一只新炉口，它陷进流沙受本蛊攻击 〔40〕% 的伤害',
    ['陷进去的蛊攻击 -〔10〕%', '开战时敌方炉口也先陷一次'], {
      onFoeFront(ctx, u, v, c, go) { if (!ctx.alive(u) || !ctx.alive(c.u)) return; go(); ctx.deal(u, c.u, A(u, 0.4), 'skill'); if (aw(u, 1)) weaken(ctx, c.u, A(c.u, 0.1)); if (u.combo === 'liusha' && ctx.alive(c.u)) { cq(ctx, u); weaken(ctx, c.u, pc(c.u.atk, 0.15)); } },
      onStart(ctx, u, v, c, go) { if (!aw(u, 2)) return; const f = ctx.foes(u)[0]; if (f) { go(); ctx.deal(u, f, A(u, 0.4), 'skill'); } } }),
  brief: N('朝暮', '暮', '回合开始', '生来攻血很高，但第 4 回合开始寿尽凋零（会触发亡语）',
    ['凋零时化作光雨：敌方全体各受本蛊攻击 〔50〕%', '寿命延长到第 6 回合'], {
      onTurn(ctx, u, v, c, go) { if (!ctx.alive(u) || ctx.turn < (aw(u, 2) ? 6 : 4)) return; go(); if (aw(u, 1)) ctx.foes(u).forEach(f => ctx.deal(u, f, A(u, 0.5), 'skill')); u.sh = 0; ctx.deal(null, u, u.hp, 'self'); } }),
  chain: N('连雷', '雷', '出手', '对撞出手后，雷光弹向下一只敌蛊，造成这次攻击的 〔35〕%',
    ['雷光弹两只', '被雷劈中的蛊有 30% 机会麻住，下次对撞不出手'], {
      onAttack(ctx, u, v, c, go) {
        const lg = u.combo === 'leigu', n = (aw(u, 1) ? 2 : 1) + (lg ? 1 : 0), tg = ctx.foes(u).filter(f => f !== c.tg).slice(0, n); if (!tg.length) return;
        go(); if (lg) cq(ctx, u); const d = PN(c.n || 1, 0.35); tg.forEach(f => { ctx.deal(u, f, d, 'skill'); if (aw(u, 2) && ctx.alive(f) && ctx.rng() < 0.3) stun(ctx, f, 1); });
      } }),
  bulwark: N('玄甲', '玄', '受伤', '站在炉口时，对撞挨的打减半（技能、毒照常吃）',
    ['站在炉口时，回合开始获得最大血量 〔3〕% 的护体', '在炉口挨打时反震攻击者本蛊攻击 〔25〕%'], {
      takeMod(ctx, u, v, amt, src, kind) { return kind === 'hit' && isFront(ctx, u) && amt > 1 ? pc(amt, 0.5) : amt; },
      onTurn(ctx, u, v, c, go) { if (aw(u, 1) && ctx.alive(u) && isFront(ctx, u)) { go(); ctx.shield(u, H(u, 0.03)); } },
      onHit(ctx, u, v, c, go) { if (aw(u, 2) && c.kind === 'hit' && c.src && c.src.side !== u.side && ctx.alive(c.src) && ctx.alive(u) && isFront(ctx, u)) { go(); ctx.deal(u, c.src, A(u, 0.25), 'thorn'); } } }),
  strings: N('牵丝', '丝', '击杀', '击杀：把对方做成傀儡放到己方末位（一半攻血，带它的词条；每场 1 次）',
    ['每场 2 次', '傀儡是完整攻血'], {
      onKill(ctx, u, v, c, go) { const x = c.victim; if (!x || x.f.tied || ctx.allies(u).length >= ctx.CAP || !cnt(u, 'str', aw(u, 1) ? 2 : 1)) return; go(); puppetOf(ctx, u, x, aw(u, 2)); } }),
  parasite: N('寄生', '寄', '开战', '开战：钻进敌方攻最高的蛊体内，它每回合开始受本蛊攻击 〔10〕% 的伤害',
    ['宿主死了就钻进下一只攻最高的敌蛊', '宿主每回合攻击 -〔8〕%'], {
      onStart(ctx, u, v, c, go) { const t = by(ctx.foes(u), f => f.atk); if (t) { go(); poison(ctx, t, A(u, 0.1), 'para'); u.f.host = t; if (aw(u, 2)) t.f.paraW = 1; } },
      onFoeDie(ctx, u, v, c, go) { if (!aw(u, 1) || c.dead !== u.f.host) return; const t = by(ctx.foes(u), f => f.atk); if (t) { go(); poison(ctx, t, A(u, 0.1), 'para'); u.f.host = t; if (aw(u, 2)) t.f.paraW = 1; } } }),
  urn: N('入瓮', '瓮', '布阵', '布阵：吞掉身后紧挨的友蛊，得到它全部攻血和副词条（本场有效）',
    ['吞完再 +〔20〕% 攻血', '能吞两只'], {
      onPrep(ctx, u, v, c, go) {
        let ate = 0;
        for (let k = 0; k < (aw(u, 2) ? 2 : 1); k++) {
          const b = nextAlly(ctx, u); if (!b) break; const a = ctx.S[u.side], ga = b.atk, gh = Math.max(1, b.hp); a.splice(a.indexOf(b), 1); b.dead = true; b.hp = 0;
          const bi = a.length > 0 ? Math.min(a.indexOf(u) + 1, a.length) : 0;
          if (!ate) go(); ate++; ctx.ev('faint', { uid: b.uid, eaten: 1 }); ctx.buff(u, ga, gh);
          if (u.combo === 'baichong') ctx.hook(b, 'faint', { idx: bi });
          Object.entries(b.tr).forEach(([k2, l]) => { if (!isNat(k2)) giveTr(u, k2, l); }); setTr(ctx, u);
        }
        if (ate && u.combo === 'baichong') cq(ctx, u);
        if (ate && aw(u, 1)) ctx.buff(u, A(u, 0.2), H(u, 0.2));
      } }),
  hex: N('夺志', '魇', '布阵', '布阵：敌方副词条最厚的那只，每个副词条 -1 层（降到 0 即失效）',
    ['再夺一只', '被夺志的蛊攻击 -〔8〕%'], {
      onPrep(ctx, u, v, c, go) {
        const sub = f => Object.entries(f.tr).reduce((a, [k, l]) => a + (isNat(k) ? 0 : l), 0), fs = ctx.foes(u).filter(f => sub(f) > 0).sort((a, b) => sub(b) - sub(a)).slice(0, aw(u, 1) ? 2 : 1); if (!fs.length) return; go();
        fs.forEach(t => { for (const k of Object.keys(t.tr)) { if (isNat(k)) continue; t.tr[k] -= 1; if (t.tr[k] <= 0) delete t.tr[k]; } setTr(ctx, t); status(ctx, t, 'hex', 1); if (aw(u, 2)) weaken(ctx, t, A(t, 0.08)); });
      } }),
  sunder: N('破甲', '破', '出手', '对撞前先撕掉目标全部护体，伤害 +20%',
    ['撕下来的护体一半披到自己身上', '每次对撞再加目标最大血量 〔6〕% 的伤害'], {
      dealMod(ctx, u, v, amt, tg, kind) {
        if (kind !== 'hit') return amt; const s = tg.sh; if (s > 0) { tg.sh = 0; status(ctx, tg, 'strip', s); if (aw(u, 1)) ctx.shield(u, PN(s, 0.5)); }
        let r = pc(amt, 1.2) + (aw(u, 2) ? H(tg, 0.06) : 0);
        if (u.combo === 'kaishan') { if (!u.f.ks) { u.f.ks = 1; ctx.comboEv(u); } r = pc(r, 1.25); }
        return r;
      } }),
  storm: N('霆击', '霆', '回合开始', '单数回合开始：对敌方全体各造成本蛊攻击 〔10〕% 的伤害',
    ['霆击先劈炉口：炉口多吃一半', '劈死一只，本蛊攻击 +〔10〕%（按开战攻）'], {
      onTurn(ctx, u, v, c, go) {
        if (!ctx.alive(u) || ctx.turn % 2 === 0) return; const fs = ctx.foes(u); if (!fs.length) return; const up = u.combo === 'jiutian'; go(); if (up) cq(ctx, u);
        fs.forEach((f, i) => { ctx.deal(u, f, A(u, 0.1 * (i === 0 && aw(u, 1) ? 1.5 : 1) + (up && i === 0 ? 0.05 : 0)), 'skill'); if (aw(u, 2) && f.hp <= 0) ctx.buff(u, A0(u, 0.1), 0); });
      } }),
  mimic: N('拟态', '拟', '布阵', '布阵：照抄敌方炉口的全部副词条',
    ['同时抄来它 〔10〕% 的攻血', '抄来的副词条各多 1 层'], {
      onPrep(ctx, u, v, c, go) {
        const f = ctx.foes(u)[0]; if (!f) return; const src = Object.entries(f.tr).filter(([k, l]) => l > 0 && !isNat(k));
        if (!src.length && !aw(u, 1)) return; go(); src.forEach(([k, l0]) => { const l = l0 + (aw(u, 2) ? 1 : 0); if ((u.tr[k] || 0) < l) giveTr(u, k, l - (u.tr[k] || 0)); }); setTr(ctx, u);
        if (aw(u, 1)) ctx.buff(u, A(f, 0.1), H(f, 0.1));
      } }),
  regrow: N('再生', '岁', '免死', '第一次阵亡时退到末位，以五成血重新长出来',
    ['长回来时攻击 +〔10〕%（按开战攻）', '能再生两次'], {
      saveDeath(ctx, u) {
        if (!cnt(u, 'regrow', aw(u, 2) ? 2 : 1)) return false; const full = u.combo === 'burou', a = ctx.S[u.side]; a.splice(a.indexOf(u), 1); a.push(u);
        u.hp = pc(u.mx, full ? 0.8 : 0.5); u.killer = null; ctx.ev('trig', { uid: u.uid, id: 'regrow' }); if (full) cq(ctx, u); if (aw(u, 1)) ctx.buff(u, A0(u, 0.1), 0); return true;
      } }),
  aegis: N('镇岳', '岳', '光环', '站在末位时，全体友蛊每次受到的伤害 -15%（至少 1）',
    ['在末位时，回合开始给炉口友蛊本蛊最大血量 〔8〕% 的护体', '减伤提高到 25%'], {
      auraTake(ctx, h, v, tg, amt) { return amt > 1 && ctx.alive(h) && isLast(ctx, h) ? pc(amt, aw(h, 2) ? 0.75 : 0.85) : amt; },
      onTurn(ctx, u, v, c, go) { if (aw(u, 1) && ctx.alive(u) && isLast(ctx, u)) { const f = ctx.allies(u)[0]; if (f && f !== u) { go(); ctx.shield(f, H(u, 0.08)); } } } }),
  coin: N('吐宝', '宝', '击杀', '击杀：全体友蛊获得本蛊最大血量 〔15〕% 的护体',
    ['同时回复全体友蛊各 〔10〕% 血', '击杀时本蛊攻击 +〔10〕%（按开战攻）'], {
      onKill(ctx, u, v, c, go) { const a = ctx.allies(u); if (!a.length) return; go(); a.forEach(x => { ctx.shield(x, H(u, 0.15)); if (aw(u, 1)) heal(ctx, x, H(x, 0.1)); }); if (aw(u, 2) && ctx.alive(u)) ctx.buff(u, A0(u, 0.1), 0); } }),
  rewind: N('光阴', '光', '覆灭', '每场一次：全队将要覆灭时倒转光阴，开战时在阵的蛊全部以五成攻血复生，蝉自己只剩 1 血',
    ['倒回来时，蝉身边的友蛊各得最大血量 15% 的护体', '倒回来那一刻，敌方全体被光阴反噬，各掉最大血量 10%'], {}),
  fate: N('织命', '命', '布阵', '布阵：把敌方末位拖到炉口，缠住它 3 合',
    ['被缠住的蛊每合掉本蛊攻击 〔30〕% 的血', '缠住 4 合'], {
      onPrep(ctx, u, v, c, go) {
        const fs = ctx.foes(u); if (!fs.length) return; go(); const t = fs[fs.length - 1];
        if (fs.length > 1) { swapPos(ctx, fs[0], t); status(ctx, t, 'swap'); } stun(ctx, t, aw(u, 2) ? 4 : 3, 'web'); if (aw(u, 1)) poison(ctx, t, A(u, 0.3));
      } }),
  phoenix: N('涅火', '涅', '免死', '第一次阵亡时化作劫火：敌方全体各受本蛊攻击 〔5〕%，再以四成攻、两成血重生',
    ['重生时血改为三成', '劫火灼伤敌方全体：每回合掉本蛊攻击 〔1〕%'], {
      saveDeath(ctx, u) {
        if (u.f.phx) return false; u.f.phx = 1; u.killer = null; u.hp = pc(u.mx, aw(u, 1) ? 0.3 : 0.2); ctx.ev('trig', { uid: u.uid, id: 'phoenix' });
        ctx.foes(u).forEach(f => { ctx.deal(u, f, A(u, 0.05), 'skill'); if (aw(u, 2)) poison(ctx, f, A(u, 0.01)); }); u.atk = pc(u.atk, 0.4); return true;
      } }),
};

// ---------- 新物种 ----------
// tier：0 凡人 1 一转 2 二转 3 三转 4 四转 5 五转；legend：天级传说，只能开茧获得
// role：流派；how：大白话机制（含战斗外效果）；meta：战斗外效果说明（实现见 META）
const S = (id, n, ab, atk, hp, t, v, tier, role, lore, extra = {}) => ({ id, n, ab, atk, hp, t, v, tier, role, lore, ...extra });
const NEW_SPECIES = [
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
// ---------- 转数 ----------
// rank：基础转数。凡人池 = 一转蛊，一转池 = 二转蛊，二转池 = 三转蛊，三转池 = 四转蛊，四转池与五转池 = 五转蛊，仙蛊 = 六转。
// 旧 12 种的补充字段（集成时 Object.assign 到 core 的 SPECIES 上）
// nat = 本命技；sub = 炼附/吞噬时教给本体的副词条；dup = 与本命重复、不能再得的副词条（旧存档里这些会被清掉）
const OLD_EXTRA = Object.fromEntries([
  ['boar', 1, 'rage', 'frenzy', 'frenzy'], ['fire', 1, 'blaze', 'strike', 'strike'], ['twin', 1, 'mirage', 'split', 'split'],
  ['iron', 1, 'ironskin', 'shell', 'shell'], ['thorn', 1, 'bramble', 'thorn', 'thorn,vanguard'], ['bone', 1, 'rot', 'spawn', 'spawn,guard'],
  ['mantis', 2, 'heart', 'devour', 'devour'], ['queen', 2, 'royal', 'rally', 'rally,link'], ['cicada', 2, 'molt', 'legacy', 'legacy'],
  ['drum', 3, 'beat', 'war', 'war'], ['scorp', 3, 'sting', 'snipe', 'snipe,strike'], ['moth', 3, 'moon', 'legacy', 'legacy'],
].map(([id, rank, nat, sub, dup]) => [id, { rank, nat, t: nat, v: 1, sub, dup: dup.split(',') }]));

// 大白话机制：trait 描述 + 战斗外效果；补转数、仙蛊标记
const TD = Object.fromEntries(Object.entries(NEW_TRAITS).map(([k, t]) => [k, t.d]));
const SUB = { ant: 'rally', firefly: 'strike', stick: 'mend', leech: 'siphon', dung: 'shell', tiger: 'vanguard', webspider: 'insight', aphid: 'spawn', hairy: 'thorn', cent: 'toxin',
  wasp: 'strike', spider: 'rally', mole: 'snipe', gecko: 'guard', qingfu: 'spawn', bomb: 'spark', silk: 'mend', mosq: 'siphon', rhino: 'shell', gold: 'legacy',
  qant: 'rally', flea: 'link', bfly: 'link', sleep: 'insight', stag: 'devour', glut: 'devour', toad: 'toxin', cricket: 'insight', locust: 'spark',
  mirror: 'thorn', hive: 'rally', fly: 'legacy', bury: 'legacy', frost: 'insight', lure: 'insight', antlion: 'snipe', mayfly: 'vanguard',
  thunder: 'spark', tortoise: 'guard', puppet: 'split', hairworm: 'toxin', urn: 'devour', hex: 'insight', saw: 'strike',
  dfly: 'spark', orchid: 'split', taisui: 'mend', yue: 'guard', jinchan: 'luck', guangyin: 'legacy', fate: 'insight', nirvana: 'strike' };
const DUP = { leech: ['siphon'], cent: ['toxin'], glut: ['devour'], dung: ['shell'], thunder: ['spark'], locust: ['spark'], wasp: ['snipe'], gecko: ['guard'], taisui: ['mend'] };
NEW_SPECIES.forEach(s => {
  s.rank = s.legend ? 6 : Math.min(5, s.tier + 1); s.nat = s.t; s.sub = SUB[s.id]; s.dup = DUP[s.id] || [];
  s.how = TD[s.t](1) + (s.meta ? '；' + s.meta : '');
});

const NEW_SUMMONS = { antling: '兵蚁', aphidling: '蚜虫', spiderling: '小蛛', fuzi: '子蚨', bee: '工蜂', kuilei: '傀儡' };
const NEW_POOL = [0, 1, 2, 3, 4, 5].map(t => NEW_SPECIES.filter(s => !s.legend && s.tier === t).map(s => s.id));
const IMMORTALS = NEW_SPECIES.filter(s => s.immortal).map(s => s.id);
const LEGENDS = IMMORTALS;   // 旧称，等同 IMMORTALS

// ---------- 新杀招 ----------
// need[0] 起名，comboOf 只看「本体 + 附蛊」物种集合，不分主次
const C = (id, n, need, d, hooks = {}) => ({ id, n, need, d, hooks });
const cq = (ctx, u) => ctx.ev('combo', { uid: u.uid, n: u.cname, quiet: 1 });
const NEW_COMBOS = [
  C('wudu', '五毒噬心', ['cent', 'scorp'], '回合开始：敌方每只中毒的蛊，毒再深一层（加本蛊攻击 35%）', {
    onTurn(ctx, u, c, go) { if (!ctx.alive(u)) return; const fs = ctx.foes(u).filter(f => f.f.psn); if (fs.length) { go(true); fs.forEach(f => poison(ctx, f, A(u, 0.35))); } } }),
  C('baiyi', '百蚁噬象', ['ant', 'qant'], '开战：全体兵蚁攻血 +18%', {
    onStart(ctx, u, c, go) { const a = ctx.allies(u).filter(x => x.sp === 'antling'); if (a.length) { go(); a.forEach(x => ctx.buff(x, A(x, 0.18), H(x, 0.18))); } } }),
  C('liuying', '流萤焚夜', ['firefly', 'fire'], '亡语：余火落满敌阵，敌方全体各受本蛊攻击 30%', {
    onDeath(ctx, u, c, go) { const fs = ctx.foes(u); if (fs.length) { go(); fs.forEach(f => ctx.deal(u, f, A(u, 0.3), 'skill')); } } }),
  C('tianluo', '天罗地网', ['webspider', 'spider'], '小蛛落地时，敌方炉口若没被网住，就给它补一层网', {
    onSummon(ctx, u, c) { if (c.u && c.u.side === u.side && c.u.sp === 'spiderling') { const f = ctx.foes(u)[0]; if (f && !f.f.web) { cq(ctx, u); stun(ctx, f, 1, 'web'); return true; } } } }),
  C('pojian', '破茧成蝶', ['silk', 'bfly'], '破茧化蝶时，左右友蛊各 +15% 攻血（按开战攻血）'),
  C('yixing', '移形换影', ['flea', 'mole'], '每次弹跳换位，换上前的友蛊 +12% 攻血，本蛊下次回到炉口时钻地再发动'),
  C('baichong', '百虫入瓮', ['urn', 'bone'], '被吞进瓮里的蛊，亡语照常发动'),
  C('jinghua', '镜花水月', ['mirror', 'lure'], '对撞挨的打也能照回三成（每回合一次）'),
  C('shijie', '尸解登仙', ['fly', 'bury'], '有友蛊阵亡（包括自己）：其余友蛊各 +10% 攻血', {
    onMourn(ctx, u, c, go) { if (!ctx.alive(u)) return; go(true); ctx.allies(u).forEach(a => ctx.buff(a, A0(a, 0.1), H0(a, 0.1))); },
    onDeath(ctx, u, c, go) { const a = ctx.allies(u); if (a.length) { go(); a.forEach(x => ctx.buff(x, A0(x, 0.1), H0(x, 0.1))); } } }),
  C('bingfeng', '冰火两重', ['frost', 'fire'], '霜冻冻住目标时，再烧它本蛊攻击 60%'),
  C('tixian', '提线百傀', ['puppet', 'spider'], '开战给敌方前两只系上傀儡丝，它们不论死在谁手里，都变成我方傀儡（一半攻血）', {
    onStart(ctx, u, c, go) { const fs = ctx.foes(u).slice(0, 2); if (fs.length) { go(); fs.forEach(f => { f.f.tied = u; status(ctx, f, 'tie'); }); } } }),
  C('leigu', '雷鼓破天', ['thunder', 'drum'], '连雷多弹一只'),
  C('xuanwu', '玄武镇关', ['tortoise', 'gecko'], '站在炉口时，回合开始自己获得最大血量 10% 的护体', {
    onTurn(ctx, u, c, go) { if (ctx.alive(u) && isFront(ctx, u)) { go(true); ctx.shield(u, pc(u.mx, 0.1)); } } }),
  C('kaishan', '开山断岳', ['saw', 'stag'], '破甲的对撞伤害再 +25%'),
  C('burou', '肉身不朽', ['taisui', 'cicada'], '再生重新长出来时，血回到八成'),
  C('huangzai', '蝗过千里', ['locust', 'boar'], '横扫不再只扫一只，扫遍敌方整个后排'),
  C('jiutian', '九天引雷', ['dfly', 'firefly'], '萤火引路：霆击劈敌方炉口时多 5% 攻击'),
  C('tuibao', '金蟾吐宝', ['jinchan', 'qingfu'], '击杀时全体友蛊再 +8% 攻血；在阵时斗蛊胜利再 +1 元石', {
    onKill(ctx, u, c, go) { const a = ctx.allies(u); if (a.length) { go(true); a.forEach(x => ctx.buff(x, A0(x, 0.08), H0(x, 0.08))); } } }),
  C('yiri', '一日千秋', ['mayfly', 'bfly'], '蜉蝣阵亡时，全体友蛊 +10% 攻血（按开战攻血）', {
    onDeath(ctx, u, c, go) { const a = ctx.allies(u); if (a.length) { go(); a.forEach(x => ctx.buff(x, pc(x.a0 || x.atk, 0.1), pc(x.h0 || x.mx, 0.1))); } } }),
  C('liusha', '流沙陷阵', ['antlion', 'mole'], '流沙陷阵：陷进流沙的蛊攻击再 -15%'),
  C('shousui', '守岁', ['guangyin', 'gecko'], '守宫守着那一夜：光阴回溯后，蝉自己留下三成血'),
];
const NC = Object.fromEntries(NEW_COMBOS.map(c => [c.id, c]));

// ---------- 流派与克制 ----------
// 15 个流派标签。school = 主流派；counters = 它克制的流派；counteredBy = 克制它的流派。
// 克制环的骨架：召唤怕群攻，群攻怕减伤/护体，护体怕破甲，破甲怕反伤/控制，控制怕召唤（打在炮灰上）；
// 后排成长怕站位（钻地、织命专打末位），爆发怕控制，毒克续航与减伤，斩杀克续航，亡语克爆发与斩杀（杀它就挨反咬）。
const SCHOOLS = ['召唤', '亡语', '成长', '反伤', '站位', '控制', '毒', '护体', '减伤', '开锋', '群攻', '斩杀', '续航', '爆发', '破甲'];
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
const FLOW = Object.fromEntries(FL.split(/[|\n]/).map(x => x.trim().split(' ')).map(([id, school, a, b]) => [id, { school, counters: a.split(','), counteredBy: b.split(',') }]));
NEW_SPECIES.forEach(s => Object.assign(s, FLOW[s.id]));
NEW_COMBOS.forEach(c => Object.assign(c, FLOW[c.id]));
// 旧 12 种的主流派（只用于流派统计和蛊典展示）
const OLD_SCHOOL = { boar: '成长', fire: '开锋', twin: '召唤', iron: '护体', thorn: '反伤', mantis: '成长', bone: '亡语', queen: '召唤', cicada: '亡语', drum: '站位', scorp: '开锋', moth: '亡语' };
Object.entries(OLD_SCHOOL).forEach(([id, sc]) => { OLD_EXTRA[id].school = sc; });


// ---------- 通用派发（battle.js 打补丁后调用） ----------
// 天劫压阵：第 20 合起双方全体每合掉最大血量 (回合-19)×10%，杜绝回血/护体互耗的僵局（按百分比，后期大血量照样收得住）
const DOOM = 20;
// battle.js 只引这一个对象：import { BX } from './bestiary.js'（构建脚本把各文件拼成一个脚本，用对象收口可以避免与别的文件重名）
const HMAP = { start: 'onStart', turn: 'onTurn', hurt: 'onHit', kill: 'onKill', faint: 'onDeath', ally: 'onSummon', attack: 'onAttack', prep: 'onPrep', front: 'onFront', foeFront: 'onFoeFront', mourn: 'onMourn', foeDie: 'onFoeDie' };

function dispatch(ctx, h, u, c = {}) {
  let fired = false;
  // 状态结算：每只蛊每回合一次（回响重放不重复扣）
  if (h === 'turn' && ctx.alive(u) && u.f.tick !== ctx.turn) withNM(1, () => {
    u.f.tick = ctx.turn;
    if (u.f.psn) ctx.deal(null, u, u.f.psn, 'psn');
    if (u.f.para && ctx.alive(u)) ctx.deal(null, u, u.f.para, 'para');
    if (u.f.paraW && u.f.para && ctx.alive(u)) weaken(ctx, u, A(u, 0.08));
    if (ctx.turn >= DOOM && ctx.alive(u)) ctx.deal(null, u, H(u, 0.1 * (ctx.turn - DOOM + 1)), 'doom');
  });
  // 友蛊阵亡广播（殉道重放不重复广播）
  if (h === 'faint' && u.f.tied && !c.tied) { c.tied = 1; const o = u.f.tied; if (ctx.alive(o) && ctx.allies(o).length < ctx.CAP) { cq(ctx, o); puppetOf(ctx, o, u, false); } }
  if (h === 'faint' && !c.mourned) { c.mourned = 1; for (const a of ctx.S[u.side].filter(ctx.alive)) ctx.hook(a, 'mourn', { dead: u }); for (const a of ctx.S[1 - u.side].filter(ctx.alive)) if (a.tr.mourn || a.tr.parasite) ctx.hook(a, 'foeDie', { dead: u }); }
  const name = HMAP[h]; if (!name) return false;
  for (const id in u.tr) {
    const t = NEW_TRAITS[id], fn = t && t.hooks[name]; if (!fn || !u.tr[id]) continue;
    const pn = ctx.nat; ctx.nat = t.nat ? 1 : 0;   // ctx.nat：本命技发出的事件带 nat 标记，模拟里统计本命占比
    withNM(t.nat ? natMul(u) : 1, () => fn(ctx, u, u.tr[id], c, () => { fired = true; ctx.ev('trig', { uid: u.uid, id }); })); ctx.nat = pn;
  }
  const cb = u.combo && NC[u.combo], cf = cb && cb.hooks[name];
  if (cf && withNM(1, () => cf(ctx, u, c, quiet => { fired = true; ctx.ev('combo', { uid: u.uid, n: u.cname, quiet: quiet ? 1 : 0 }); }))) fired = true;
  return fired;
}

// 伤害修正：攻方 dealMod → 守方 takeMod → 同侧光环 auraTake
function dmgMod(ctx, src, tg, amt, kind) {
  const nm = (u, id) => NEW_TRAITS[id].nat ? natMul(u) : 1;
  if (src && src.tr) for (const id in src.tr) { const m = NEW_TRAITS[id] && NEW_TRAITS[id].hooks.dealMod; if (m && src.tr[id]) amt = withNM(nm(src, id), () => m(ctx, src, src.tr[id], amt, tg, kind)); }
  for (const id in tg.tr) { const m = NEW_TRAITS[id] && NEW_TRAITS[id].hooks.takeMod; if (m && tg.tr[id]) amt = withNM(nm(tg, id), () => m(ctx, tg, tg.tr[id], amt, src, kind)); }
  if (tg.f.drowsy && tg.f.stun > 0 && amt > 0) amt = pc(amt, 1.3);   // 眠虫五转觉醒：睡着的敌蛊多吃三成
  return amt;
}

// 对撞出手前：定身 / 扑空 / 疾袭
function atkMod(ctx, u, pa, tg) {
  u.f.swung = 0;
  if (u.f.stun > 0) { u.f.stun--; status(ctx, u, 'miss'); return 0; }
  if (u.f.web > 0) { u.f.web--; status(ctx, u, 'miss'); const w = u.f.webBy; if (w) { u.f.webBy = null; if (ctx.alive(w)) ctx.deal(w, u, withNM(natMul(w), () => A(w, 1)), 'skill'); } return 0; }
  for (const id in u.tr) { const m = NEW_TRAITS[id] && NEW_TRAITS[id].hooks.atkMod; if (m && u.tr[id]) pa = withNM(NEW_TRAITS[id].nat ? natMul(u) : 1, () => m(ctx, u, u.tr[id], pa, tg)); }
  if (pa > 0) { u.f.swung = 1; u.f.lastHit = pa; }
  return pa;
}
function afterClash(ctx, a, b) {
  for (const [x, y] of [[a, b], [b, a]]) if (x.f.swung) { x.f.swung = 0; ctx.hook(x, 'attack', { tg: y, n: x.f.lastHit }); }
}

// 免死：太岁再生、涅火重生
function saveDeath(ctx, u) {
  for (const id in u.tr) { const m = NEW_TRAITS[id] && NEW_TRAITS[id].hooks.saveDeath; if (m && u.tr[id] && withNM(natMul(u), () => m(ctx, u, u.tr[id]))) return true; }
  return false;
}

// 布阵：开战前（先于开锋）记下开战快照，结算换位/吞噬/照抄/夺志
function begin(ctx) {
  ctx.BX = { front: [null, null], rew: [0, 0] };
  for (const s of [0, 1]) {
    ctx.S[s].forEach(u => { u.a0 = u.atk; u.h0 = u.mx; });   // 开战攻血：叠加型成长按它算
    const ma = Math.max(0, ...ctx.S[s].map(u => u.atk)), mh = Math.max(0, ...ctx.S[s].map(u => u.mx));
    ctx.S[s].forEach(u => { u.la = Math.ceil(ma * LEAD); u.lh = Math.ceil(mh * LEAD); });
  }
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
  const tj = hd.u.combo === 'shousui', k = 0.5, aw1 = aw(hd.u, 1), aw2 = aw(hd.u, 2);
  ctx.ev('trig', { uid: hd.u.uid, id: 'rewind' }); if (tj) ctx.ev('combo', { uid: hd.u.uid, n: hd.u.cname });
  ctx.S[s].length = 0;
  for (const o of op.slice(0, ctx.CAP)) {
    const u = o.u; u.dead = false; u.killer = null; u.sh = 0; u.f = {};
    u.atk = Math.max(1, Math.ceil(o.atk * k)); u.mx = u.hp = o === hd ? (tj ? Math.max(1, Math.ceil(o.hp * 0.3)) : 1) : Math.max(1, Math.ceil(o.hp * k));   // 叫完这一声，蝉自己只剩一口气
    ctx.S[s].push(u); ctx.ev('summon', { uid: u.uid, by: hd.u.uid, rewind: 1 });
  }
  if (aw1) { const a = ctx.S[s], i = a.indexOf(hd.u); [a[i - 1], a[i + 1]].forEach(x => { if (ctx.alive(x)) ctx.shield(x, H(x, 0.15)); }); }
  if (aw2) ctx.S[1 - s].filter(ctx.alive).forEach(f => ctx.deal(hd.u, f, H(f, 0.1), 'skill'));
  return true;
}

const BX = { dispatch, dmgMod, atkMod, afterClash, saveDeath, begin, settle };

// ---------- 蛊方（炼蛊配方） ----------
// { id, n, need, out, d }：need 为 2–3 个原料，元素是物种 id，或 { rank: n } 表示「任意一只 n 转蛊」。炼成后原料全部消耗，得到 out。
// 发现规则：第一次炼成 out，或第一次开茧/招蛊拿到 out 时，解锁所有产出 out 的蛊方（META.discover）。
const RC = (id, n, need, out, d) => ({ id, n, need, out, d });
const NEW_RECIPES = [
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
const META = {
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

return { NAT_BASE, natMulOf, LEAD, trCapOf, NEW_TRAITS, NEW_SPECIES, OLD_EXTRA, NEW_SUMMONS, NEW_POOL, IMMORTALS, LEGENDS, NEW_COMBOS, SCHOOLS, FLOW, OLD_SCHOOL, DOOM, BX, NEW_RECIPES, META };
})();
// ---- src/bestiary2.js（包一层，只放出 export）
const { NAT_UP, natK, natText, NATS, ACTS, ACT_COUNT, SPECIES2, SUMMONS2, ST_GROW, ST120, PATCH64, BATTLE120, DAO120, CANON, NAT_OF, KW, KW120 } = (() => {
// 蛊码 GuCode · 蛊典第二卷（v2 第三版规则）：120 种蛊的技能、战斗字段、每转攻血表。纯数据 + 纯函数，不 import 任何文件。
// 规则：docs/design.md 2.6（只有技能：被动技能 = 本命，必有；约四成另有主动技能；三转、五转各觉醒一次，两个技能一起强化）。
// 格式：docs/battle-spec.md 第二版（3×3 阵盘、shape 形状、knock/draw/swap/eat、chill 寒、inflict/allyInflict 跨道触发）。
//
// 导出：
//   SPECIES2[i]  新 56 种：{ id, n, ab, dao, rank, tier, nat, atk, hp（一转口径比例）, role, lore, spd, reach, aim, atkFx, act, st, canon?, immortal? }
//   PATCH64[id]  旧 64 种的补丁：{ dao, spd, reach, aim, atkFx, act, st, n?/ab?/lore?/canon?（换成原著名的那几种） }，集成时 Object.assign(SP[id], PATCH64[id])
//   NATS[key]    全部 120 种的被动技能（声明式）：{ n, ch, trig, d(v, m), aw: [m => 三转, m => 五转], eff, awEff: [[三转追加], [五转追加]], hooks: {} }
//                旧 64 种用原来的 key（rage、blaze……），集成时整条替换 NEW_TRAITS[key]，battle.js 的 NAT_K 里对应项删掉。
//                只有 rewind（春秋蝉：全队覆灭时倒转光阴）保留原钩子，这里只换描述（keepHooks: true）。
//   技能数值：〔〕括住的数随转数变：显示值 = 基准 × natK(转数)，natK(r) = 1 + NAT_UP × (r − 1)；eff 里每条带同样的 up，引擎按 spec 4.1 乘。
//            d(v, m) 的 m 照旧是 ui 传进来的 natMulOf(转数)，这里换算回转数。没括号的数（概率、寒层数、蛊力、免死留血、伤害倍数）不随转数变。
//   主动技 act = { n, cap, fx, d, eff, aw: [[三转追加], [五转追加]], awd: ['三转说明', '五转说明'] }，数值按 spec 默认 up 0.12 随转数涨。
//   KW / KW120   通用效果（毒 灼 寒 护 召 吞 击退 标记）：每种蛊会挂哪些（give）、专打哪些（use），蛊典和杀招图鉴的线索用。
//   ST120[id]    每转攻血表（下标 = 转数，[攻, 血]，基础转数以下为 null；仙蛊只有 [6]）。BATTLE120[id] = { spd, reach, aim, atkFx, act, st }。
//   DAO120[id]   120 种各属哪一道。SUMMONS2 新召唤物名。CANON 标了 canon: true 的原著蛊名，方便核对。
// 不含模型偏好（food / eats）字段，lore 不带这类后缀。界面文字里不出现「词条」。

const NAT_UP = 0.15;
const natK = r => 1 + NAT_UP * (Math.max(1, Math.min(6, r || 1)) - 1);
const rOfM = m => (m >= 2 ? 1 + (m - 2) / 0.85 : 1);
const fmt = (s, k) => s.replace(/〔(\d+)〕/g, (_, x) => String(Math.round(+x * k)));
const NUMK = ['atk', 'a0', 'mx', 'tatk', 'tmx', 'n', 'flat'];
const E = (when, op, tg, o = {}) => ({ when, op, tg, ...o });
const withUp = e => (e.up == null && (NUMK.some(k => e[k]) || e.op === 'buff') ? { ...e, up: NAT_UP } : e);
const N = (n, ch, trig, d, aw, eff, awEff, extra = {}) => ({
  n, ch, trig, innate: true, nat: true, v2: true, hooks: {}, ...extra,
  d: (v, m = 2) => fmt(d, natK(rOfM(m))), aw: aw.map(x => (m = 2) => fmt(x, natK(rOfM(m)))),
  eff: eff.map(withUp), awEff: awEff.map(L => L.map(withUp)), src: { d, aw },
});
const natText = (key, rank) => { const t = NATS[key]; return t ? fmt(t.src.d, natK(rank)) : ''; };

// ======================= 被动技能（本命）· 120 种 =======================
const NATS = {
  // ---------- 力道 ----------
  rage: N('越伤越狂', '猛', '受击', '被打中还活着：攻 +〔6〕%（每场最多 8 次）',
    ['血量第一次掉到一半以下：冲撞同一行最近的敌蛊，攻击 〔150〕%，击退一格', '第一次受到致命伤时留 1 血，攻 +〔30〕%'],
    [E('hit', 'buff', 'self', { atk: 0.06, max: 8 })],
    [[E('low', 'dmg', 'foe.front', { atk: 1.5 }), E('low', 'knock', 'same', { v: 1 })], [E('lethal', 'endure', null, { v: 0, max: 1 }), E('lethal', 'buff', 'self', { atk: 0.3, max: 1 })]]),
  blitz: N('黑豕冲阵', '疾', '出手', '第一次普攻额外打出攻击 〔100〕%',
    ['开战先冲：同一行最近的敌蛊受攻击 〔60〕%，击退一格', '打满血的敌蛊，伤害 +40%'],
    [E('attack', 'dmg', 'tg', { atk: 1.0, if: 'first' })],
    [[E('start', 'dmg', 'foe.front', { atk: 0.6 }), E('start', 'knock', 'same', { v: 1 })], [E('deal', 'mul', null, { v: 1.4, if: 'tg.full' })]]),
  beat: N('战鼓', '战', '每轮', '每轮开始：同一行身前的友蛊攻 +〔5〕%',
    ['同时给它本蛊最大血量 〔5〕% 的护体', '每 3 轮全体友蛊攻 +〔6〕%'],
    [E('round', 'buff', 'ally.ahead', { atk: 0.05 })],
    [[E('round', 'shield', 'ally.ahead', { mx: 0.05 })], [E('round', 'buff', 'ally.all', { atk: 0.06, every: 3 })]]),
  execute: N('斩首', '斩', '出手', '普攻目标血量不过半时，额外打出攻击 〔40〕%',
    ['目标有标记时，再额外打出 〔25〕%', '击杀后回复最大血量 〔10〕%'],
    [E('attack', 'dmg', 'tg', { atk: 0.4, if: 'tg.hp<50' })],
    [[E('attack', 'dmg', 'tg', { atk: 0.25, if: 'tg.mark' })], [E('kill', 'heal', 'self', { mx: 0.1 })]]),
  gorge: N('吞元', '饕', '出手', '普攻后，目标血量不过两成或是召唤物，就整只吞下，得到它三成攻血',
    ['吞的门槛提高到三成', '击杀时攻 +〔8〕%'],
    [E('attack', 'eat', 'tg', { v: 0.2, gain: 0.3 })],
    [[E('attack', 'eat', 'tg', { v: 0.3, gain: 0.3 })], [E('kill', 'buff', 'self', { atk: 0.08 })]]),
  cleave: N('横扫', '扫', '出手', '普攻后，目标那一整列的敌蛊各受这一下的 〔30〕%',
    ['扫的比例再加 〔15〕%', '本蛊打寒中的敌蛊，伤害 +25%（冻住的庄稼一扫就断）'],
    [E('attack', 'dmg', 'tg', { n: 0.3, shape: 'col' })],
    [[E('attack', 'dmg', 'tg', { n: 0.15, shape: 'col' })], [E('deal', 'mul', null, { v: 1.25, if: 'tg.chill' })]]),
  bearforce: N('熊力', '熊', '出手', '普攻额外打出本蛊最大血量 〔3〕% 的伤害；40% 机会把目标击退一格（撞上就两只都受伤）',
    ['开战得到最大血量 〔10〕% 的护体', '血量第一次掉到一半以下时攻 +〔25〕%'],
    [E('attack', 'dmg', 'tg', { mx: 0.03 }), E('attack', 'knock', 'tg', { v: 1, chance: 0.4 })],
    [[E('start', 'shield', 'self', { mx: 0.1 })], [E('low', 'buff', 'self', { atk: 0.25 })]]),
  skyhold: N('擎天', '擎', '每轮', '每轮开始攻 +〔4〕%；同一列的友蛊攻 +〔2〕%',
    ['开战：同一列的友蛊各得本蛊最大血量 〔10〕% 的护体', '击杀时攻 +〔10〕%'],
    [E('round', 'buff', 'self', { atk: 0.04 }), E('round', 'buff', 'ally.col', { atk: 0.02 })],
    [[E('start', 'shield', 'ally.col', { mx: 0.1 })], [E('kill', 'buff', 'self', { atk: 0.1 })]]),

  // ---------- 炎道 ----------
  blaze: N('流火', '火', '开战', '开战：烧敌方随机一只，攻击 〔100〕%，灼烧 2 轮（攻击 〔20〕%）',
    ['火星溅到它周围一圈，各受攻击 〔30〕%', '每 3 轮再烧一次（攻击 〔60〕%，灼烧 2 轮）'],
    [E('start', 'dmg', 'foe.rand', { atk: 1.0 }), E('start', 'st', 'same', { k: 'burn', n: 2, atk: 0.2 })],
    [[E('start', 'dmg', 'same', { atk: 0.3, shape: 'ring' })], [E('round', 'dmg', 'foe.rand', { atk: 0.6, every: 3 }), E('round', 'st', 'same', { k: 'burn', n: 2, atk: 0.2, every: 3 })]]),
  burst: N('爆囊', '爆', '亡语', '倒下时炸最近的敌蛊和它周围一圈，各受攻击 〔100〕%',
    ['炸到的蛊灼烧 2 轮（攻击 〔20〕%）', '炸到的蛊各击退一格'],
    [E('death', 'dmg', 'foe.front', { atk: 1.0, shape: 'ring' })],
    [[E('death', 'st', 'same', { k: 'burn', n: 2, atk: 0.2 })], [E('death', 'knock', 'same', { v: 1 })]]),
  phoenix: N('涅火', '涅', '免死', '第一次受到致命伤：化作劫火，敌方全体各受攻击 〔30〕%、灼烧 3 轮（攻击 〔12〕%），自己以 40% 血重生',
    ['重生时全体友蛊回复最大血量 〔10〕%', '每 3 轮劫火再燃：敌方全体灼烧 2 轮（攻击 〔8〕%）'],
    [E('lethal', 'endure', null, { v: 0.4, max: 1 }), E('lethal', 'dmg', 'foe.all', { atk: 0.3, max: 1 }), E('lethal', 'st', 'same', { k: 'burn', n: 3, atk: 0.12, max: 1 })],
    [[E('lethal', 'heal', 'ally.all', { tmx: 0.1, max: 1 })], [E('round', 'st', 'foe.all', { k: 'burn', n: 2, atk: 0.08, every: 3 })]]),
  scorch: N('灼咬', '灼', '出手', '普攻命中：目标灼烧 2 轮（攻击 〔15〕%）',
    ['本蛊打灼烧中的敌蛊，伤害 +20%', '灼烧蔓延到目标那一整行（攻击 〔10〕%）'],
    [E('attack', 'st', 'tg', { k: 'burn', n: 2, atk: 0.15 })],
    [[E('deal', 'mul', null, { v: 1.2, if: 'tg.burn' })], [E('attack', 'st', 'tg', { k: 'burn', n: 2, atk: 0.1, shape: 'row' })]]),
  wingfire: N('焚翅', '焚', '每轮', '每轮开始：烧掉自己最大血量 3%，对敌方全体造成攻击 〔10〕%',
    ['血量低于一半时再烧一遍', '倒下时敌方全体灼烧 2 轮（攻击 〔20〕%）'],
    [E('round', 'dmg', 'self', { mx: 0.03, up: 0, pierce: 1 }), E('round', 'dmg', 'foe.all', { atk: 0.1 })],
    [[E('round', 'dmg', 'foe.all', { atk: 0.1, if: 'hp<50' })], [E('death', 'st', 'foe.all', { k: 'burn', n: 2, atk: 0.2 })]]),
  coal: N('积炭', '炭', '受击', '被普攻打中：打它的那只灼烧 2 轮（攻击 〔12〕%），自己攻 +〔3〕%（每场最多 8 次）',
    ['开战得到最大血量 〔10〕% 的护体', '倒下时炭火迸出：最近的敌蛊和它十字范围各受攻击 〔60〕%'],
    [E('hit', 'st', 'src', { k: 'burn', n: 2, atk: 0.12, if: 'kind=hit' }), E('hit', 'buff', 'self', { atk: 0.03, if: 'kind=hit', max: 8 })],
    [[E('start', 'shield', 'self', { mx: 0.1 })], [E('death', 'dmg', 'foe.front', { atk: 0.6, shape: 'cross' })]]),
  ignite: N('燧火', '燧', '引燃', '每有敌蛊被点燃（谁点的都算），燧石跟着对它打出攻击 〔25〕%；每 2 轮点燃最近的敌蛊 2 轮（攻击 〔10〕%）',
    ['单数轮也点', '跟打的伤害再加 〔15〕%'],
    [E('inflict', 'dmg', 'tg', { atk: 0.25, if: 'k=burn' }), E('allyInflict', 'dmg', 'tg', { atk: 0.25, if: 'k=burn' }), E('round', 'st', 'foe.front', { k: 'burn', n: 2, atk: 0.1, every: 2 })],
    [[E('round', 'st', 'foe.front', { k: 'burn', n: 2, atk: 0.1, if: 'round%2' })], [E('inflict', 'dmg', 'tg', { atk: 0.15, if: 'k=burn' }), E('allyInflict', 'dmg', 'tg', { atk: 0.15, if: 'k=burn' })]]),
  lavashell: N('熔壳', '熔', '受击', '被近战打中：打它的那只受本蛊最大血量 〔3〕% 的伤害，灼烧 2 轮（攻击 〔12〕%）',
    ['开战：上下左右相邻的友蛊各得本蛊最大血量 〔6〕% 的护体', '血量第一次掉到一半以下：熔壳爆开，最近的敌蛊和它周围一圈各受本蛊最大血量 〔8〕%'],
    [E('hit', 'dmg', 'src', { mx: 0.03, if: 'melee' }), E('hit', 'st', 'src', { k: 'burn', n: 2, atk: 0.12, if: 'melee' })],
    [[E('start', 'shield', 'ally.adj', { mx: 0.06 })], [E('low', 'dmg', 'foe.front', { mx: 0.08, shape: 'ring' })]]),

  // ---------- 冰雪道 ----------
  frost: N('霜冻', '霜', '出手', '普攻命中：目标寒 1 层（每层速 -15%，叠到三层冻住一次）',
    ['寒气沿整行蔓延：目标那一整行都寒 1 层', '本蛊打寒中的敌蛊，伤害 +25%'],
    [E('attack', 'st', 'tg', { k: 'chill', n: 1 })],
    [[E('attack', 'st', 'tg', { k: 'chill', n: 1, shape: 'row' })], [E('deal', 'mul', null, { v: 1.25, if: 'tg.chill' })]]),
  icesilk: N('冰丝', '凝', '出手', '普攻命中：目标寒 1 层',
    ['开战：上下左右相邻的友蛊各得本蛊最大血量 〔8〕% 的冰茧护体', '开战：敌方速最快的那只寒 2 层'],
    [E('attack', 'st', 'tg', { k: 'chill', n: 1 })],
    [[E('start', 'shield', 'ally.adj', { mx: 0.08 })], [E('start', 'st', 'foe.fast', { k: 'chill', n: 2 })]]),
  snowhop: N('踏雪', '踏', '出手', '普攻打寒中的敌蛊，额外打出攻击 〔40〕%',
    ['第一次普攻让目标寒 2 层', '击杀后行动条提前 40%'],
    [E('attack', 'dmg', 'tg', { atk: 0.4, if: 'tg.chill' })],
    [[E('attack', 'st', 'tg', { k: 'chill', n: 2, max: 1 })], [E('kill', 'adv', 'self', { v: 0.4 })]]),
  drag: N('迟滞', '迟', '开战', '开战：敌方速最快的两只各寒 1 层',
    ['每 3 轮再来一次', '寒中的敌蛊打它，伤害 -20%'],
    [E('start', 'st', 'foe.fast:2', { k: 'chill', n: 1 })],
    [[E('round', 'st', 'foe.fast:2', { k: 'chill', n: 1, every: 3 })], [E('take', 'mul', null, { v: 0.8, if: 'tg.chill' })]]),
  hush: N('噤声', '噤', '开战', '开战：敌方攻最高的蛊和它那一列被封住 2 轮（蛊力不涨）',
    ['被封的同时寒 1 层', '友蛊每让一只敌蛊寒，寒蝉对它打出攻击 〔20〕%'],
    [E('start', 'st', 'foe.top', { k: 'seal', n: 3, shape: 'col' })],
    [[E('start', 'st', 'same', { k: 'chill', n: 1 })], [E('allyInflict', 'dmg', 'tg', { atk: 0.2, if: 'k=chill' })]]),
  hailstorm: N('落雹', '雹', '每轮', '单数轮开始：冰雹砸敌方随机一只和它周围一圈，各受攻击 〔12〕%、寒 1 层',
    ['双数轮也砸一只（攻击 〔20〕%）', '本蛊打寒中的敌蛊，伤害 +25%'],
    [E('round', 'dmg', 'foe.rand', { atk: 0.12, shape: 'ring', if: 'round%2' }), E('round', 'st', 'same', { k: 'chill', n: 1, if: 'round%2' })],
    [[E('round', 'dmg', 'foe.rand', { atk: 0.2, every: 2 })], [E('deal', 'mul', null, { v: 1.25, if: 'tg.chill' })]]),
  permafrost: N('冻原', '冻', '受击', '被近战打中：打它的那只寒 1 层',
    ['开战得到最大血量 〔15〕% 的护体', '本蛊打冻住（眩晕）中的敌蛊，伤害 +30%'],
    [E('hit', 'st', 'src', { k: 'chill', n: 1, if: 'melee' })],
    [[E('start', 'shield', 'self', { mx: 0.15 })], [E('deal', 'mul', null, { v: 1.3, if: 'tg.stun' })]]),

  // ---------- 金道 ----------
  ironskin: N('铜皮', '铁', '开战', '开战得到最大血量 〔20〕% 的护体',
    ['每 3 轮补 〔8〕% 护体', '开战：上下左右相邻的友蛊各得本蛊最大血量 〔8〕% 的护体'],
    [E('start', 'shield', 'self', { mx: 0.2 })],
    [[E('round', 'shield', 'self', { mx: 0.08, every: 3 })], [E('start', 'shield', 'ally.adj', { mx: 0.08 })]]),
  scale: N('坚鳞', '鳞', '受伤', '受到的伤害 -15%',
    ['血量不过半时再 -15%', '被打中时攻 +〔3〕%（每场最多 8 次）'],
    [E('take', 'mul', null, { v: 0.85 })],
    [[E('take', 'mul', null, { v: 0.85, if: 'hp<50' })], [E('hit', 'buff', 'self', { atk: 0.03, max: 8 })]]),
  gild: N('镀金', '镀', '亡语', '倒下时：同一行身后的友蛊得到本蛊最大血量 〔30〕% 的护体',
    ['开战先给身后的友蛊镀一层（〔10〕%）', '倒下时镀给全体友蛊（各 〔12〕%）'],
    [E('death', 'shield', 'ally.behind', { mx: 0.3 })],
    [[E('start', 'shield', 'ally.behind', { mx: 0.1 })], [E('death', 'shield', 'ally.all', { mx: 0.12 })]]),
  coin: N('吐宝', '宝', '击杀', '击杀：全体友蛊得到本蛊最大血量 〔6〕% 的护体',
    ['同时回复本蛊最大血量 〔5〕%', '击杀时攻 +〔8〕%'],
    [E('kill', 'shield', 'ally.all', { mx: 0.06 })],
    [[E('kill', 'heal', 'ally.all', { mx: 0.05 })], [E('kill', 'buff', 'self', { atk: 0.08 })]]),
  sunder: N('破甲', '破', '出手', '普攻后再撕一口：攻击 〔20〕% 加目标最大血量 〔2〕%，无视护体',
    ['目标挂着「护」时，这一口翻倍', '击杀时得到最大血量 〔10〕% 的护体'],
    [E('attack', 'dmg', 'tg', { atk: 0.2, tmx: 0.02, pierce: 1 })],
    [[E('attack', 'dmg', 'tg', { atk: 0.2, tmx: 0.02, pierce: 1, if: 'tg.guard' })], [E('kill', 'shield', 'self', { mx: 0.1 })]]),
  jadeskin: N('玉皮', '玉', '开战', '开战得到最大血量 〔10〕% 的护体，并挂「护」1 次（下一次受伤减半）',
    ['上下左右相邻的友蛊开战也各挂「护」1 次', '每 3 轮重新挂「护」1 次'],
    [E('start', 'shield', 'self', { mx: 0.1 }), E('start', 'st', 'self', { k: 'guard', n: 1 })],
    [[E('start', 'st', 'ally.adj', { k: 'guard', n: 1 })], [E('round', 'st', 'self', { k: 'guard', n: 1, every: 3 })]]),
  interlock: N('连锁', '锁', '开战', '开战：上下左右相邻的友蛊各得本蛊最大血量 〔10〕% 的护体',
    ['同一行身前的友蛊再挂「护」1 次', '每 3 轮再连一次'],
    [E('start', 'shield', 'ally.adj', { mx: 0.1 })],
    [[E('start', 'st', 'ally.ahead', { k: 'guard', n: 1 })], [E('round', 'shield', 'ally.adj', { mx: 0.1, every: 3 })]]),
  whitejade: N('白玉', '璧', '低血', '血量第一次掉到一半以下：化作白玉，挂「护」3 次并嘲讽 2 轮',
    ['化玉时同一列的友蛊各得本蛊最大血量 〔12〕% 的护体', '化玉时回复最大血量 〔15〕%'],
    [E('low', 'st', 'self', { k: 'guard', n: 3 }), E('low', 'st', 'self', { k: 'taunt', n: 2 })],
    [[E('low', 'shield', 'ally.col', { mx: 0.12 })], [E('low', 'heal', 'self', { mx: 0.15 })]]),

  // ---------- 木道 ----------
  bramble: N('荆棘', '荆', '受击', '被近战打中：扎回这一下的 〔40〕%',
    ['站在最前（同一行身前没有友蛊）时，再扎回 〔30〕%', '扎中的蛊中毒（攻击 〔15〕%）'],
    [E('hit', 'dmg', 'src', { n: 0.4, if: 'melee' })],
    [[E('hit', 'dmg', 'src', { n: 0.3, if: 'melee&front' })], [E('hit', 'st', 'src', { k: 'psn', atk: 0.15, if: 'melee' })]]),
  ripen: N('蓄势', '蓄', '每轮', '同一行身前有友蛊挡着时，每轮开始攻血 +〔6〕%',
    ['站在最前时，每轮得到最大血量 〔5〕% 的护体', '蓄势翻倍'],
    [E('round', 'buff', 'self', { atk: 0.06, hp: 0.06, if: 'back' })],
    [[E('round', 'shield', 'self', { mx: 0.05, if: 'front' })], [E('round', 'buff', 'self', { atk: 0.06, hp: 0.06, if: 'back' })]]),
  cocoon: N('结茧', '茧', '每轮', '第 3 轮开始破茧：攻 +〔60〕%，回满血（每场一次）',
    ['开战结茧时挂「护」2 次', '第 2 轮先破一层小茧：攻 +〔30〕%'],
    [E('round', 'buff', 'self', { atk: 0.6, if: 'round>=3', max: 1 }), E('round', 'heal', 'self', { mx: 1, up: 0, if: 'round>=3', max: 1 })],
    [[E('start', 'st', 'self', { k: 'guard', n: 2 })], [E('round', 'buff', 'self', { atk: 0.3, if: 'round>=2', max: 1 })]]),
  regrow: N('再生', '岁', '免死', '第一次受到致命伤：退到同一行最后一格，以 50% 血重新长出来',
    ['长回来时攻 +〔20〕%', '每轮回复最大血量 〔4〕%'],
    [E('lethal', 'endure', null, { v: 0.5, max: 1 }), E('lethal', 'swap', 'self', { with: 'back', max: 1 })],
    [[E('lethal', 'buff', 'self', { atk: 0.2, max: 1 })], [E('round', 'heal', 'self', { mx: 0.04 })]]),
  lifeleaf: N('生机', '叶', '每轮', '每轮开始：上下左右相邻的友蛊回复本蛊最大血量 〔4〕%',
    ['自己也回复同样多', '每 3 轮清掉相邻友蛊身上的减益'],
    [E('round', 'heal', 'ally.adj', { mx: 0.04 })],
    [[E('round', 'heal', 'self', { mx: 0.04 })], [E('round', 'cleanse', 'ally.adj', { every: 3 })]]),
  creep: N('缠藤', '藤', '出手', '普攻命中：把目标拉近一格（被挡住就撞上，两只都受伤）',
    ['藤刺让目标中毒（攻击 〔12〕%）', '每轮开始最大血量 +〔3〕%'],
    [E('attack', 'draw', 'tg', { v: 1 })],
    [[E('attack', 'st', 'tg', { k: 'psn', atk: 0.12 })], [E('round', 'buff', 'self', { hp: 0.03 })]]),
  cordyceps: N('夏草', '草', '击杀', '普攻让目标中毒（攻击 〔10〕%）；击杀时在后排长出一株虫草（本蛊攻血 〔20〕%，每场 2 株）',
    ['每场 4 株', '有友蛊被召唤时，全体友蛊回复最大血量 〔3〕%'],
    [E('attack', 'st', 'tg', { k: 'psn', atk: 0.1 }), E('kill', 'summon', null, { sp: 'grass', atk: 0.2, mx: 0.2, at: 'back', max: 2 })],
    [[E('kill', 'summon', null, { sp: 'grass', atk: 0.2, mx: 0.2, at: 'back', max: 2 })], [E('summon', 'heal', 'ally.all', { tmx: 0.03 })]]),
  sunroot: N('扶桑', '桑', '每轮', '每轮开始：全体友蛊回复最大血量 〔3〕%',
    ['同一列的友蛊再得本蛊最大血量 〔5〕% 的护体', '友蛊第一次倒下时，原地发出一株新芽（本蛊攻血 〔15〕%）'],
    [E('round', 'heal', 'ally.all', { tmx: 0.03 })],
    [[E('round', 'shield', 'ally.col', { mx: 0.05 })], [E('allyDeath', 'summon', null, { sp: 'sprout', atk: 0.15, mx: 0.15, at: 'here', max: 1 })]]),

  // ---------- 土道 ----------
  roll: N('滚丸', '丸', '每轮', '每轮开始得到最大血量 〔4〕% 的护体；普攻 30% 机会把目标推后一格（撞上就两只都受伤）',
    ['站在最前时护体翻倍', '再多 20% 机会推一次'],
    [E('round', 'shield', 'self', { mx: 0.04 }), E('attack', 'knock', 'tg', { v: 1, chance: 0.3 })],
    [[E('round', 'shield', 'self', { mx: 0.04, if: 'front' })], [E('attack', 'knock', 'tg', { v: 1, chance: 0.2 })]]),
  burrow: N('钻地', '钻', '开战', '开战：钻地突袭敌方后排，各受攻击 〔50〕%',
    ['每 3 轮再钻一次', '开战钻到的蛊被拉近一格'],
    [E('start', 'dmg', 'foe.last', { atk: 0.5, shape: 'back' })],
    [[E('round', 'dmg', 'foe.last', { atk: 0.5, shape: 'back', every: 3 })], [E('start', 'draw', 'same', { v: 1 })]]),
  pit: N('流沙', '沙', '每轮', '每 2 轮：把敌方最靠后的蛊拉近一格，对它造成攻击 〔40〕%',
    ['陷进去的蛊攻 -〔8〕%（2 轮）', '单数轮也拉'],
    [E('round', 'draw', 'foe.last', { v: 1, every: 2 }), E('round', 'dmg', 'same', { atk: 0.4, every: 2 })],
    [[E('round', 'buff', 'same', { atk: -0.08, dur: 2, every: 2 })], [E('round', 'draw', 'foe.last', { v: 1, if: 'round%2' })]]),
  bulwark: N('玄甲', '玄', '受伤', '站在最前（同一行身前没有友蛊）时，受到的普攻伤害减半',
    ['站在最前时，每轮得到最大血量 〔5〕% 的护体', '站在最前被近战打中，反震攻击 〔40〕%'],
    [E('take', 'mul', null, { v: 0.5, if: 'front&kind=hit' })],
    [[E('round', 'shield', 'self', { mx: 0.05, if: 'front' })], [E('hit', 'dmg', 'src', { atk: 0.4, if: 'front&melee' })]]),
  aegis: N('镇岳', '岳', '每轮', '站在后列时，每轮开始同一行的友蛊各得本蛊最大血量 〔4〕% 的护体',
    ['同一列的友蛊也得', '自己受到的伤害 -25%'],
    [E('round', 'shield', 'ally.row', { mx: 0.04, if: 'col=2' })],
    [[E('round', 'shield', 'ally.col', { mx: 0.04, if: 'col=2' })], [E('take', 'mul', null, { v: 0.75 })]],
    { hooks: { auraTake: (ctx, h, v, tg, amt) => amt } }),   // bestiary.js 的 dmgMod 写死调用 aegis 的 auraTake，这里给个原样返回，集成时删掉那行即可
  stoneskin: N('石衣', '石', '开战', '开战得到最大血量 〔10〕% 的护体；受到的伤害 -10%',
    ['站在最前时再 -10%', '被打中时得到最大血量 〔2〕% 的护体（每场最多 8 次）'],
    [E('start', 'shield', 'self', { mx: 0.1 }), E('take', 'mul', null, { v: 0.9 })],
    [[E('take', 'mul', null, { v: 0.89, if: 'front' })], [E('hit', 'shield', 'self', { mx: 0.02, max: 8 })]]),
  earthdragon: N('翻土', '蚓', '免死', '断成两截还能活：第一次受到致命伤时留 15% 血',
    ['起身时攻 +〔15〕%', '起身时身后分出半截地龙（本蛊攻血 〔30〕%）'],
    [E('lethal', 'endure', null, { v: 0.15, max: 1 })],
    [[E('lethal', 'buff', 'self', { atk: 0.15, max: 1 })], [E('lethal', 'summon', null, { sp: 'wormhalf', atk: 0.3, mx: 0.3, at: 'behind', max: 1 })]]),
  shiftmount: N('搬山', '搬', '每轮', '每 2 轮：最近的敌蛊受攻击 〔30〕%，并被击退两格（撞上就两只都受伤）',
    ['被搬走的蛊攻 -〔6〕%（2 轮）', '单数轮也搬'],
    [E('round', 'dmg', 'foe.front', { atk: 0.3, every: 2 }), E('round', 'knock', 'same', { v: 2, every: 2 })],
    [[E('round', 'buff', 'same', { atk: -0.06, dur: 2, every: 2 })], [E('round', 'dmg', 'foe.front', { atk: 0.3, if: 'round%2' }), E('round', 'knock', 'same', { v: 2, if: 'round%2' })]]),

  // ---------- 雷道 ----------
  chain: N('连雷', '雷', '出手', '普攻后雷光沿斜线弹开：目标和它斜对角的敌蛊各受这一下的 〔40〕%',
    ['20% 机会让被弹到的蛊全部眩晕一次', '本蛊打灼烧中的敌蛊，伤害 +25%（雷火相生）'],
    [E('attack', 'dmg', 'tg', { n: 0.4, shape: 'diag' })],
    [[E('attack', 'st', 'same', { k: 'stun', n: 1, chance: 0.2 })], [E('deal', 'mul', null, { v: 1.25, if: 'tg.burn' })]]),
  storm: N('霆击', '霆', '每轮', '单数轮开始：敌方全体各受攻击 〔15〕%',
    ['先劈最近的那一整列，多吃 〔15〕%', '本蛊打有标记的敌蛊，伤害 +20%'],
    [E('round', 'dmg', 'foe.all', { atk: 0.15, if: 'round%2' })],
    [[E('round', 'dmg', 'foe.front', { atk: 0.15, shape: 'col', if: 'round%2' })], [E('deal', 'mul', null, { v: 1.2, if: 'tg.mark' })]]),
  charge: N('积电', '静', '受击', '被近战打中：25% 机会放电，打它的那只受攻击 〔50〕% 并眩晕一次',
    ['放电时电到它那一整列（攻击 〔25〕%）', '被技能打中也会放电'],
    [E('hit', 'dmg', 'src', { atk: 0.5, chance: 0.25, if: 'melee' }), E('hit', 'st', 'same', { k: 'stun', n: 1 })],
    [[E('hit', 'dmg', 'same', { atk: 0.25, shape: 'col' })], [E('hit', 'dmg', 'src', { atk: 0.5, chance: 0.25, if: 'kind=skill' })]]),
  springthunder: N('惊蛰', '蛰', '开战', '开战：敌方全体受攻击 〔12〕%，20% 机会全部眩晕一次',
    ['第 5 轮再响一次', '开战敌方全体打上标记（第 1 轮）'],
    [E('start', 'dmg', 'foe.all', { atk: 0.12 }), E('start', 'st', 'same', { k: 'stun', n: 1, chance: 0.2 })],
    [[E('round', 'dmg', 'foe.all', { atk: 0.12, if: 'round>=5', max: 1 })], [E('start', 'st', 'foe.all', { k: 'mark', n: 2 })]]),
  clickjump: N('弹雷', '叩', '每轮', '每 2 轮：弹起砸敌方随机一只，攻击 〔50〕%，击退一格',
    ['单数轮也弹', '砸中的蛊眩晕一次（每场 2 次）'],
    [E('round', 'dmg', 'foe.rand', { atk: 0.5, every: 2 }), E('round', 'knock', 'same', { v: 1, every: 2 })],
    [[E('round', 'dmg', 'foe.rand', { atk: 0.5, if: 'round%2' })], [E('round', 'st', 'same', { k: 'stun', n: 1, max: 2 })]]),
  thundercloud: N('云雷', '云', '每轮', '每 3 轮落雷：敌方全体各受攻击 〔35〕%',
    ['落雷点燃敌阵：敌方全体灼烧 2 轮（攻击 〔8〕%）', '落雷改为每 2 轮'],
    [E('round', 'dmg', 'foe.all', { atk: 0.35, every: 3 })],
    [[E('round', 'st', 'same', { k: 'burn', n: 2, atk: 0.08, every: 3 })], [E('round', 'dmg', 'foe.all', { atk: 0.35, every: 2 })]]),
  magburst: N('磁暴', '磁', '出手', '普攻打眩晕中的敌蛊，额外打出攻击 〔35〕%；之后 15% 机会让目标眩晕',
    ['磁力把目标拉近一格', '击杀时电到最近的敌蛊（攻击 〔50〕%）'],
    [E('attack', 'dmg', 'tg', { atk: 0.35, if: 'tg.stun' }), E('attack', 'st', 'tg', { k: 'stun', n: 1, chance: 0.15 })],
    [[E('attack', 'draw', 'tg', { v: 1 })], [E('kill', 'dmg', 'foe.front', { atk: 0.5 })]]),
  ninebolt: N('九霄', '霄', '每轮', '每轮开始落 3 道雷，各劈敌方随机一只（攻击 〔12〕%）',
    ['再多一道', '本蛊打有标记的敌蛊，伤害 +25%'],
    [E('round', 'dmg', 'foe.rand', { atk: 0.12, times: 3 })],
    [[E('round', 'dmg', 'foe.rand', { atk: 0.12 })], [E('deal', 'mul', null, { v: 1.25, if: 'tg.mark' })]]),

  // ---------- 光道 ----------
  moon: N('月照', '月', '亡语', '倒下时月光照亮这一行：同一行身后的友蛊攻血 +〔25〕%，敌方最近的那一整行打上标记 2 轮',
    ['同一列的友蛊也 +〔12〕%', '受照的身后友蛊得到本蛊最大血量 〔15〕% 的护体'],
    [E('death', 'buff', 'ally.behind', { atk: 0.25, hp: 0.25 }), E('death', 'st', 'foe.front', { k: 'mark', n: 3, shape: 'row' })],
    [[E('death', 'buff', 'ally.col', { atk: 0.12, hp: 0.12 })], [E('death', 'shield', 'ally.behind', { mx: 0.15 })]]),
  ember: N('微光', '辉', '亡语', '倒下时一束光打向击杀者：攻击 〔100〕%，并打上标记 2 轮',
    ['开战：敌方攻最高的蛊打上标记（第 1 轮）', '倒下时光照满阵：敌方全体再各受攻击 〔30〕%'],
    [E('death', 'dmg', 'killer', { atk: 1.0 }), E('death', 'st', 'same', { k: 'mark', n: 3 })],
    [[E('start', 'st', 'foe.top', { k: 'mark', n: 2 })], [E('death', 'dmg', 'foe.all', { atk: 0.3 })]]),
  mirror: N('镜反', '镜', '受击', '受到技能伤害：照回来源这一下的 〔50〕%（每场最多 8 次）',
    ['受到的技能伤害 -25%', '普攻打它也照回 〔20〕%'],
    [E('hit', 'dmg', 'src', { n: 0.5, if: 'kind=skill', max: 8 })],
    [[E('take', 'mul', null, { v: 0.75, if: 'kind=skill' })], [E('hit', 'dmg', 'src', { n: 0.2, if: 'kind=hit' })]]),
  moonblade: N('月刃', '皎', '出手', '普攻化作一道月刃，贯穿目标那一整行：各受这一下的 〔30〕%',
    ['贯穿再加 〔15〕%', '本蛊打有标记的敌蛊，伤害 +20%'],
    [E('attack', 'dmg', 'tg', { n: 0.3, shape: 'row' })],
    [[E('attack', 'dmg', 'tg', { n: 0.15, shape: 'row' })], [E('deal', 'mul', null, { v: 1.2, if: 'tg.mark' })]]),
  relic: N('舍利', '舍', '开战', '开战：上下左右相邻的友蛊攻血各 +〔8〕%',
    ['同一列的友蛊也 +〔4〕%', '开战：相邻友蛊蛊力 +20'],
    [E('start', 'buff', 'ally.adj', { atk: 0.08, hp: 0.08 })],
    [[E('start', 'buff', 'ally.col', { atk: 0.04, hp: 0.04 })], [E('start', 'gp', 'ally.adj', { v: 20 })]]),
  nightlight: N('照夜', '照', '出手', '普攻 20% 机会照破要害：额外打出攻击 〔40〕%，并打上标记 2 轮',
    ['本蛊打灼烧中的敌蛊，伤害 +20%（火光里破绽更显眼）', '每 3 轮照亮敌方攻最高的蛊：标记 2 轮'],
    [E('attack', 'dmg', 'tg', { atk: 0.4, chance: 0.2 }), E('attack', 'st', 'same', { k: 'mark', n: 2 })],
    [[E('deal', 'mul', null, { v: 1.2, if: 'tg.burn' })], [E('round', 'st', 'foe.top', { k: 'mark', n: 3, every: 3 })]]),
  sunfire: N('曜日', '曜', '每轮', '单数轮：敌方全体灼烧 2 轮（攻击 〔8〕%）；每轮：全体友蛊回复攻击 〔5〕%',
    ['灼烧改为 3 轮', '双数轮也烧'],
    [E('round', 'st', 'foe.all', { k: 'burn', n: 2, atk: 0.08, if: 'round%2' }), E('round', 'heal', 'ally.all', { atk: 0.05 })],
    [[E('round', 'st', 'foe.all', { k: 'burn', n: 3, atk: 0.08, if: 'round%2' })], [E('round', 'st', 'foe.all', { k: 'burn', n: 2, atk: 0.08, every: 2 })]]),

  // ---------- 暗道 ----------
  heart: N('噬心', '心', '击杀', '击杀：攻血 +〔15〕%',
    ['本蛊打中毒的敌蛊，伤害 +25%', '开战先扑向敌方血最少的蛊，攻击 〔100〕%'],
    [E('kill', 'buff', 'self', { atk: 0.15, hp: 0.15 })],
    [[E('deal', 'mul', null, { v: 1.25, if: 'tg.psn' })], [E('start', 'dmg', 'foe.low', { atk: 1.0 })]]),
  hex: N('夺志', '魇', '开战', '开战：敌方攻最高的蛊被封住 2 轮（蛊力不涨），攻 -〔8〕%',
    ['再封速最快的那只', '魇粉撒满敌阵：敌方全体中毒（攻击 〔8〕%）'],
    [E('start', 'st', 'foe.top', { k: 'seal', n: 3 }), E('start', 'buff', 'same', { atk: -0.08 })],
    [[E('start', 'st', 'foe.fast', { k: 'seal', n: 3 })], [E('start', 'st', 'foe.all', { k: 'psn', atk: 0.08 })]]),
  lull: N('催眠', '眠', '受击', '被近战打中：打它的那只眩晕一次（每场 2 次）',
    ['每场 3 次', '本蛊打眩晕中的敌蛊，伤害 +30%'],
    [E('hit', 'st', 'src', { k: 'stun', n: 1, if: 'melee', max: 2 })],
    [[E('hit', 'st', 'src', { k: 'stun', n: 1, if: 'melee', max: 1 })], [E('deal', 'mul', null, { v: 1.3, if: 'tg.stun' })]]),
  inkcloud: N('泼墨', '墨', '开战', '开战：墨糊住敌方最近的那一整列，它们第一次普攻落空',
    ['被糊住的蛊打上标记（第 1 轮）', '每 3 轮再喷一次'],
    [E('start', 'st', 'foe.front', { k: 'web', n: 1, shape: 'col' })],
    [[E('start', 'st', 'same', { k: 'mark', n: 2 })], [E('round', 'st', 'foe.front', { k: 'web', n: 1, shape: 'col', every: 3 })]]),
  nightsip: N('夜吸', '蝠', '出手', '普攻后，伤得最重的友蛊回复这一下的 〔20〕%',
    ['本蛊打有标记的敌蛊，伤害 +25%', '自己也回复同样多'],
    [E('attack', 'heal', 'ally.lowp', { n: 0.2 })],
    [[E('deal', 'mul', null, { v: 1.25, if: 'tg.mark' })], [E('attack', 'heal', 'self', { n: 0.2 })]]),
  blotout: N('蚀光', '晦', '每轮', '每 2 轮：敌方攻最高的蛊攻 -〔10〕%（2 轮），寒 1 层',
    ['同时打上标记 2 轮', '再蚀一只（速最快的那只）'],
    [E('round', 'buff', 'foe.top', { atk: -0.1, dur: 2, every: 2 }), E('round', 'st', 'same', { k: 'chill', n: 1, every: 2 })],
    [[E('round', 'st', 'same', { k: 'mark', n: 3, every: 2 })], [E('round', 'buff', 'foe.fast', { atk: -0.1, dur: 2, every: 2 })]]),
  ferry: N('引渡', '渡', '友亡', '每场第一只倒下的友蛊，以魂体回到原地（本蛊攻血 〔25〕%）',
    ['多引渡一只（落在附近的空格）', '魂体回来时，敌方全体寒 1 层'],
    [E('allyDeath', 'summon', null, { sp: 'soul', atk: 0.25, mx: 0.25, at: 'here', max: 1 })],
    [[E('allyDeath', 'summon', null, { sp: 'soul', atk: 0.25, mx: 0.25, at: 'here', max: 1 })], [E('allyDeath', 'st', 'foe.all', { k: 'chill', n: 1, max: 1 })]]),

  // ---------- 血道 ----------
  leech: N('吮血', '吮', '出手', '普攻后回复这一下的 〔40〕%',
    ['咬中毒的敌蛊时再吸一口：攻击 〔25〕%，全部吸回', '每次普攻偷走目标 〔3〕% 的攻（每场最多 6 次）'],
    [E('attack', 'heal', 'self', { n: 0.4 })],
    [[E('attack', 'dmg', 'tg', { atk: 0.25, steal: 1, if: 'tg.psn' })], [E('attack', 'buff', 'tg', { atk: -0.03, max: 6 }), E('attack', 'buff', 'self', { atk: 0.03, max: 6 })]]),
  drain: N('抽髓', '髓', '开战', '开战：敌方攻最高的蛊攻 -〔12〕%，自己攻 +〔12〕%',
    ['普攻也偷：目标攻 -〔3〕%，自己 +〔3〕%（每场最多 6 次）', '开战时它还被打上标记（第 1 轮）'],
    [E('start', 'buff', 'foe.top', { atk: -0.12 }), E('start', 'buff', 'self', { atk: 0.12 })],
    [[E('attack', 'buff', 'tg', { atk: -0.03, max: 6 }), E('attack', 'buff', 'self', { atk: 0.03, max: 6 })], [E('start', 'st', 'foe.top', { k: 'mark', n: 2 })]]),
  urn: N('入瓮', '瓮', '布阵', '布阵：吞掉同一行身后紧挨的那只友蛊，得到它六成攻血（本场有效）',
    ['吞完再攻血 +〔15〕%', '每 3 轮吞掉一只召唤物或血不过三成的敌蛊（得它三成攻血）'],
    [E('prep', 'eat', 'ally.behind', { v: 9, gain: 0.6 })],
    [[E('prep', 'buff', 'self', { atk: 0.15, hp: 0.15 })], [E('round', 'eat', 'foe.lowp', { v: 0.3, gain: 0.3, every: 3 })]]),
  latch: N('吸附', '附', '出手', '普攻后偷走目标最大血量的 〔2〕%（无视护体）',
    ['目标中毒时再偷一次', '偷的同时目标攻 -〔3〕%（每场最多 6 次）'],
    [E('attack', 'dmg', 'tg', { tmx: 0.02, pierce: 1, steal: 1 })],
    [[E('attack', 'dmg', 'tg', { tmx: 0.02, pierce: 1, steal: 1, if: 'tg.psn' })], [E('attack', 'buff', 'tg', { atk: -0.03, max: 6 })]]),
  bloodpact: N('血契', '契', '开战', '开战：献出自己最大血量 10%，上下左右相邻的友蛊攻 +〔10〕%',
    ['献出的血化作它们的护体（本蛊最大血量 〔6〕%）', '倒下时相邻友蛊各回复本蛊最大血量 〔10〕%'],
    [E('start', 'dmg', 'self', { mx: 0.1, up: 0, pierce: 1 }), E('start', 'buff', 'ally.adj', { atk: 0.1 })],
    [[E('start', 'shield', 'ally.adj', { mx: 0.06 })], [E('death', 'heal', 'ally.adj', { mx: 0.1 })]]),
  clot: N('凝血', '珀', '免死', '第一次受到致命伤时凝成血珀：留 15% 血，挂「护」2 次',
    ['醒来攻 +〔15〕%', '凝血时相邻友蛊各回复本蛊最大血量 〔8〕%'],
    [E('lethal', 'endure', null, { v: 0.15, max: 1 }), E('lethal', 'st', 'self', { k: 'guard', n: 2, max: 1 })],
    [[E('lethal', 'buff', 'self', { atk: 0.15, max: 1 })], [E('lethal', 'heal', 'ally.adj', { mx: 0.08, max: 1 })]]),
  bloodmoon: N('血月', '朔', '出手', '普攻化作血色月刃，贯穿目标那一整行（这一下的 〔25〕%）；血量低于一半时再贯穿一次',
    ['普攻后回复这一下的 〔15〕%', '血量第一次掉到一半以下时攻 +〔20〕%'],
    [E('attack', 'dmg', 'tg', { n: 0.25, shape: 'row' }), E('attack', 'dmg', 'tg', { n: 0.25, shape: 'row', if: 'hp<50' })],
    [[E('attack', 'heal', 'self', { n: 0.15 })], [E('low', 'buff', 'self', { atk: 0.2 })]]),
  drought: N('旱血', '魃', '每轮', '每轮开始：敌方全体各受攻击 〔5〕%，自己回复攻击 〔10〕%',
    ['每 3 轮敌方全体灼烧 2 轮（攻击 〔10〕%）', '血量不过 15% 的敌蛊直接吸干'],
    [E('round', 'dmg', 'foe.all', { atk: 0.05 }), E('round', 'heal', 'self', { atk: 0.1 })],
    [[E('round', 'st', 'foe.all', { k: 'burn', n: 2, atk: 0.1, every: 3 })], [E('round', 'dmg', 'foe.lowp', { tmx: 1, up: 0, pierce: 1, if: 'tg.hp<15' })]]),

  // ---------- 毒道 ----------
  sting: N('蝎尾', '尾', '开战', '开战：一针扎敌方最靠后的蛊，攻击 〔150〕%，中毒（攻击 〔20〕%）',
    ['每 3 轮再扎一针（攻击 〔60〕%，中毒 〔10〕%）', '本蛊打中毒的敌蛊，伤害 +30%'],
    [E('start', 'dmg', 'foe.last', { atk: 1.5 }), E('start', 'st', 'same', { k: 'psn', atk: 0.2 })],
    [[E('round', 'dmg', 'foe.last', { atk: 0.6, every: 3 }), E('round', 'st', 'same', { k: 'psn', atk: 0.1, every: 3 })], [E('deal', 'mul', null, { v: 1.3, if: 'tg.psn' })]]),
  nettle: N('毒毛', '毛', '受击', '被近战打中：打它的那只中毒（攻击 〔20〕%）',
    ['被技能打中也扎', '中了毒毛的蛊攻 -〔5〕%（每场最多 4 次）'],
    [E('hit', 'st', 'src', { k: 'psn', atk: 0.2, if: 'melee' })],
    [[E('hit', 'st', 'src', { k: 'psn', atk: 0.2, if: 'kind=skill' })], [E('hit', 'buff', 'src', { atk: -0.05, if: 'melee', max: 4 })]]),
  venom: N('蚀毒', '蚀', '出手', '普攻：目标已中毒时额外打出攻击 〔25〕%；再让它中毒（攻击 〔15〕%，可叠）',
    ['击杀时毒转到最近的敌蛊（攻击 〔20〕%）', '普攻让目标那一整列都中毒（攻击 〔8〕%）'],
    [E('attack', 'dmg', 'tg', { atk: 0.25, if: 'tg.psn' }), E('attack', 'st', 'tg', { k: 'psn', atk: 0.15 })],
    [[E('kill', 'st', 'foe.front', { k: 'psn', atk: 0.2 })], [E('attack', 'st', 'tg', { k: 'psn', atk: 0.08, shape: 'col' })]]),
  prick: N('点刺', '刺', '开战', '开战：刺敌方血最少的蛊，攻击 〔120〕%，打上标记 2 轮',
    ['击杀时再刺血最少的敌蛊（攻击 〔80〕%，每场 2 次）', '每轮开始刺血最少的敌蛊（攻击 〔25〕%）'],
    [E('start', 'dmg', 'foe.low', { atk: 1.2 }), E('start', 'st', 'same', { k: 'mark', n: 3 })],
    [[E('kill', 'dmg', 'foe.low', { atk: 0.8, max: 2 })], [E('round', 'dmg', 'foe.low', { atk: 0.25 })]]),
  miasma: N('瘴气', '瘴', '受击', '第一次受伤：敌方全体中毒（本蛊最大血量 〔3〕%）',
    ['之后每 3 轮再放一次', '每轮开始吞掉一只血不过两成的中毒敌蛊'],
    [E('hit', 'st', 'foe.all', { k: 'psn', mx: 0.03, max: 1 })],
    [[E('round', 'st', 'foe.all', { k: 'psn', mx: 0.03, every: 3 })], [E('round', 'eat', 'foe.lowp', { v: 0.2, gain: 0.3, if: 'tg.psn' })]]),
  parasite: N('寄生', '寄', '开战', '开战：钻进敌方攻最高的蛊：中毒（攻击 〔30〕%），打上标记 2 轮',
    ['宿主每轮攻 -〔4〕%', '宿主倒下就钻进下一只攻最高的敌蛊（每场 2 次）'],
    [E('start', 'st', 'foe.top', { k: 'psn', atk: 0.3 }), E('start', 'st', 'same', { k: 'mark', n: 3 })],
    [[E('round', 'buff', 'foe.top', { atk: -0.04 })], [E('foeDeath', 'st', 'foe.top', { k: 'psn', atk: 0.3, max: 2 }), E('foeDeath', 'st', 'same', { k: 'mark', n: 2, max: 2 })]]),
  widowkiss: N('噬偶', '寡', '出手', '普攻命中：目标中毒（攻击 〔15〕%）；击杀时毒转到最近的敌蛊（攻击 〔25〕%）',
    ['击杀时敌方全体中毒（各 〔8〕%）', '普攻后，目标中毒且血不过两成就整只吞下'],
    [E('attack', 'st', 'tg', { k: 'psn', atk: 0.15 }), E('kill', 'st', 'foe.front', { k: 'psn', atk: 0.25 })],
    [[E('kill', 'st', 'foe.all', { k: 'psn', atk: 0.08 })], [E('attack', 'eat', 'tg', { v: 0.2, gain: 0.3, if: 'tg.psn' })]]),

  // ---------- 智道 ----------
  web: N('结网', '网', '开战', '开战：敌方最近的那只落网 2 次（普攻落空）',
    ['落网的同时行动条推后 20%', '再网住速最快的那只'],
    [E('start', 'st', 'foe.front', { k: 'web', n: 2 })],
    [[E('start', 'delay', 'same', { v: 0.2 })], [E('start', 'st', 'foe.fast', { k: 'web', n: 1 })]]),
  chirp: N('叫阵', '叫', '每轮', '站在最前时，每轮开始敌方最近的那一整行攻 -〔5〕%',
    ['削下的攻加给自己', '叫声震慑敌方全体（各 -〔2〕%）'],
    [E('round', 'buff', 'foe.front', { atk: -0.05, shape: 'row', if: 'front' })],
    [[E('round', 'buff', 'self', { atk: 0.05, if: 'front' })], [E('round', 'buff', 'foe.all', { atk: -0.02, if: 'front' })]]),
  lure: N('引蝶', '引', '布阵', '布阵：把敌方血最少的蛊拉近两格，攻 -〔15〕%，打上标记 2 轮',
    ['引来的那只第一次普攻落空', '引来的那只开战前先受攻击 〔100〕%'],
    [E('prep', 'draw', 'foe.low', { v: 2 }), E('prep', 'buff', 'same', { atk: -0.15 }), E('prep', 'st', 'same', { k: 'mark', n: 3 })],
    [[E('prep', 'st', 'same', { k: 'web', n: 1 })], [E('prep', 'dmg', 'same', { atk: 1.0 })]]),
  mimic: N('拟态', '拟', '布阵', '布阵：照抄敌方最近那只的被动技能（本场有效，按本蛊转数算）',
    ['同时攻血 +〔15〕%', '再抄敌方攻最高那只的被动技能'],
    [E('prep', 'copyNat', 'foe.front')],
    [[E('prep', 'buff', 'self', { atk: 0.15, hp: 0.15 })], [E('prep', 'copyNat', 'foe.top')]]),
  earlisten: N('地听', '听', '开战', '开战：听出敌方攻最高的两只，打上标记 2 轮',
    ['每 3 轮再听一次（标记攻最高的那只）', '开战：敌方速最快的行动条推后 30%'],
    [E('start', 'st', 'foe.top:2', { k: 'mark', n: 3 })],
    [[E('round', 'st', 'foe.top', { k: 'mark', n: 3, every: 3 })], [E('start', 'delay', 'foe.fast', { v: 0.3 })]]),
  brew: N('酒虫', '酿', '每轮', '每轮开始：上下左右相邻、有主动技能的友蛊蛊力 +10',
    ['同一列的友蛊也 +10', '开战：相邻友蛊蛊力 +30'],
    [E('round', 'gp', 'ally.adj', { v: 10 })],
    [[E('round', 'gp', 'ally.col', { v: 10 })], [E('start', 'gp', 'ally.adj', { v: 30 })]]),
  wisdom: N('智慧', '智', '开战', '开战：全体友蛊蛊力 +20；每轮开始：敌方攻最高的蛊蛊力 -15',
    ['每轮开始随机一只友蛊蛊力 +15', '每 3 轮清掉全体友蛊身上的减益'],
    [E('start', 'gp', 'ally.all', { v: 20 }), E('round', 'gp', 'foe.top', { v: -15 })],
    [[E('round', 'gp', 'ally.rand', { v: 15 })], [E('round', 'cleanse', 'ally.all', { every: 3 })]]),

  // ---------- 魂道 ----------
  rot: N('腐骨', '蛹', '亡语', '倒下时原地孵出蛊蛹（本蛊攻血 〔60〕%）',
    ['孵化时腐气让敌方最近的那一整列中毒（攻击 〔20〕%）', '每轮开始敌方最近的蛊中毒（攻击 〔8〕%）'],
    [E('death', 'summon', null, { sp: 'pupa', atk: 0.6, mx: 0.6, at: 'here' })],
    [[E('death', 'st', 'foe.front', { k: 'psn', atk: 0.2, shape: 'col' })], [E('round', 'st', 'foe.front', { k: 'psn', atk: 0.08 })]]),
  molt: N('蜕壳', '蜕', '亡语', '倒下时：同一行身后的友蛊得到本蛊攻血的 〔40〕%',
    ['同一列的友蛊也各得 〔20〕%', '第一次受到致命伤先蜕一层壳：留 30% 血'],
    [E('death', 'buff', 'ally.behind', { atk: 0.4, hp: 0.4, by: 'self' })],
    [[E('death', 'buff', 'ally.col', { atk: 0.2, hp: 0.2, by: 'self' })], [E('lethal', 'endure', null, { v: 0.3, max: 1 })]]),
  mother: N('子母', '蚨', '亡语', '倒下时原地召出子蚨（本蛊攻血 〔70〕%）',
    ['子蚨落地时，敌方最近的那只受攻击 〔80〕%', '再在后排召一只（〔40〕%）'],
    [E('death', 'summon', null, { sp: 'fuzi', atk: 0.7, mx: 0.7, at: 'here' })],
    [[E('death', 'dmg', 'foe.front', { atk: 0.8 })], [E('death', 'summon', null, { sp: 'fuzi', atk: 0.4, mx: 0.4, at: 'back' })]]),
  mourn: N('食腐', '腐', '有蛊倒下', '有蛊倒下（敌我都算）：攻血 +〔6〕%',
    ['本蛊打中毒的敌蛊，伤害 +30%（专挑烂的下嘴）', '每 2 轮吞掉一只召唤物或血不过两成的敌蛊'],
    [E('allyDeath', 'buff', 'self', { atk: 0.06, hp: 0.06 }), E('foeDeath', 'buff', 'self', { atk: 0.06, hp: 0.06 })],
    [[E('deal', 'mul', null, { v: 1.3, if: 'tg.psn' })], [E('round', 'eat', 'foe.lowp', { v: 0.2, gain: 0.3, every: 2 })]]),
  inherit: N('承嗣', '嗣', '亡语', '倒下时：上下左右相邻的友蛊各得到本蛊攻血的 〔25〕%',
    ['同时各得本蛊最大血量 〔10〕% 的护体', '也清掉它们身上的减益'],
    [E('death', 'buff', 'ally.adj', { atk: 0.25, hp: 0.25, by: 'self' })],
    [[E('death', 'shield', 'ally.adj', { mx: 0.1 })], [E('death', 'cleanse', 'ally.adj')]]),
  wisp: N('鬼火', '磷', '友亡', '有友蛊倒下：鬼火扑向随机一只敌蛊，攻击 〔40〕%，寒 1 层',
    ['再扑一只', '自己倒下时扑三发'],
    [E('allyDeath', 'dmg', 'foe.rand', { atk: 0.4 }), E('allyDeath', 'st', 'same', { k: 'chill', n: 1 })],
    [[E('allyDeath', 'dmg', 'foe.rand', { atk: 0.4 })], [E('death', 'dmg', 'foe.rand', { atk: 0.4, times: 3 })]]),
  dirge: N('骨笛', '笛', '友亡', '友蛊每倒下一只，全体友蛊攻 +〔5〕%',
    ['同时血 +〔5〕%', '敌蛊倒下也算（攻 +〔3〕%）'],
    [E('allyDeath', 'buff', 'ally.all', { atk: 0.05 })],
    [[E('allyDeath', 'buff', 'ally.all', { hp: 0.05 })], [E('foeDeath', 'buff', 'ally.all', { atk: 0.03 })]]),

  // ---------- 奴道 ----------
  royal: N('王令', '王', '开战', '开战：上下左右相邻的友蛊攻血 +〔10〕%；每有友蛊被召唤，自己攻血 +〔5〕%（每场最多 8 次）',
    ['开战先在身后召一只工蜂（本蛊攻血 〔40〕%）', '每有友蛊被召唤，全体友蛊攻 +〔2〕%（每场最多 6 次）'],
    [E('start', 'buff', 'ally.adj', { atk: 0.1, hp: 0.1 }), E('summon', 'buff', 'self', { atk: 0.05, hp: 0.05, max: 8 })],
    [[E('start', 'summon', null, { sp: 'bee', atk: 0.4, mx: 0.4, at: 'behind' })], [E('summon', 'buff', 'ally.all', { atk: 0.02, max: 6 })]]),
  muster: N('点兵', '兵', '开战', '开战：身后召 2 只兵蚁（各本蛊攻血 〔35〕%）',
    ['有友蛊倒下时，自己攻 +〔6〕%', '每 3 轮补一只兵蚁'],
    [E('start', 'summon', null, { sp: 'antling', atk: 0.35, mx: 0.35, at: 'behind', count: 2 })],
    [[E('allyDeath', 'buff', 'self', { atk: 0.06 })], [E('round', 'summon', null, { sp: 'antling', atk: 0.35, mx: 0.35, at: 'behind', every: 3 })]]),
  scatter: N('散籽', '籽', '亡语', '倒下时原地召出 2 只蚜虫（各本蛊攻血 〔35〕%）',
    ['召 3 只', '倒下时蚜汁溅到敌方最近的那只：中毒（攻击 〔15〕%）'],
    [E('death', 'summon', null, { sp: 'aphidling', atk: 0.35, mx: 0.35, at: 'here', count: 2 })],
    [[E('death', 'summon', null, { sp: 'aphidling', atk: 0.35, mx: 0.35, at: 'here' })], [E('death', 'st', 'foe.front', { k: 'psn', atk: 0.15 })]]),
  brood: N('抱卵', '卵', '受击', '被打中还活着：身后召一只小蛛（本蛊攻血 〔30〕%，每场 2 只）',
    ['每场 4 只', '有友蛊被召唤时，自己回复最大血量 〔4〕%'],
    [E('hit', 'summon', null, { sp: 'spiderling', atk: 0.3, mx: 0.3, at: 'behind', max: 2 })],
    [[E('hit', 'summon', null, { sp: 'spiderling', atk: 0.3, mx: 0.3, at: 'behind', max: 2 })], [E('summon', 'heal', 'self', { mx: 0.04 })]]),
  nurture: N('哺育', '哺', '召唤', '每有友蛊被召唤：全体友蛊攻 +〔3〕%（每场最多 6 次）',
    ['开战先召一只兵蚁（本蛊攻血 〔40〕%）', '每有友蛊被召唤，自己回复最大血量 〔5〕%'],
    [E('summon', 'buff', 'ally.all', { atk: 0.03, max: 6 })],
    [[E('start', 'summon', null, { sp: 'antling', atk: 0.4, mx: 0.4, at: 'behind' })], [E('summon', 'heal', 'self', { mx: 0.05 })]]),
  hive: N('蜂巢', '巢', '每轮', '每轮开始：身后召一只工蜂（本蛊攻血 〔25〕%，每场 3 只）',
    ['每场 5 只', '工蜂出巢时叮敌方最近的那只（攻击 〔30〕%，每场 5 次）'],
    [E('round', 'summon', null, { sp: 'bee', atk: 0.25, mx: 0.25, at: 'behind', max: 3 })],
    [[E('round', 'summon', null, { sp: 'bee', atk: 0.25, mx: 0.25, at: 'behind', max: 2 })], [E('round', 'dmg', 'foe.front', { atk: 0.3, max: 5 })]]),
  strings: N('牵丝', '丝', '击杀', '击杀：在本方后排做一只傀儡（本蛊攻血 〔50〕%，每场 1 次）',
    ['每场 2 次', '击杀时把敌方最靠后的蛊拉近一格，并让它落网 1 次'],
    [E('kill', 'summon', null, { sp: 'kuilei', atk: 0.5, mx: 0.5, at: 'back', max: 1 })],
    [[E('kill', 'summon', null, { sp: 'kuilei', atk: 0.5, mx: 0.5, at: 'back', max: 1 })], [E('kill', 'draw', 'foe.last', { v: 1 }), E('kill', 'st', 'same', { k: 'web', n: 1 })]]),
  mirage: N('幻身', '幻', '受击', '第一次被打中还活着：身后召出分影（本蛊攻血 〔60〕%）',
    ['血量第一次掉到一半以下时再分一只', '分影出现时自己挂「护」1 次'],
    [E('hit', 'summon', null, { sp: 'shade', atk: 0.6, mx: 0.6, at: 'behind', max: 1 })],
    [[E('low', 'summon', null, { sp: 'shade', atk: 0.6, mx: 0.6, at: 'behind', max: 1 })], [E('hit', 'st', 'self', { k: 'guard', n: 1, max: 1 })]]),

  // ---------- 宇道 ----------
  ward: N('守宫', '守', '每轮', '每轮开始：同一行身前的友蛊得到本蛊最大血量 〔6〕% 的护体',
    ['有友蛊倒下时，给最前的友蛊补 〔10〕%', '护体翻倍'],
    [E('round', 'shield', 'ally.ahead', { mx: 0.06 })],
    [[E('allyDeath', 'shield', 'ally.front', { mx: 0.1 })], [E('round', 'shield', 'ally.ahead', { mx: 0.06 })]]),
  hop: N('弹跳', '跳', '出手', '普攻后行动条提前 15%',
    ['每次普攻攻 +〔5〕%（每场最多 6 次）', '30% 机会再咬一口（攻击 〔40〕%）'],
    [E('attack', 'adv', 'self', { v: 0.15 })],
    [[E('attack', 'buff', 'self', { atk: 0.05, max: 6 })], [E('attack', 'dmg', 'tg', { atk: 0.4, chance: 0.3 })]]),
  pair: N('比翼', '翼', '开战', '开战：同一列的友蛊攻血各 +〔12〕%，自己 +〔6〕%',
    ['同一列的友蛊速 +〔6〕%', '相邻友蛊倒下时，自己攻 +〔20〕%'],
    [E('start', 'buff', 'ally.col', { atk: 0.12, hp: 0.12 }), E('start', 'buff', 'self', { atk: 0.06, hp: 0.06 })],
    [[E('start', 'buff', 'ally.col', { spd: 0.06 })], [E('allyDeath', 'buff', 'self', { atk: 0.2, if: 'dead.adj' })]]),
  skate: N('踏水', '黾', '每轮', '同一行身前有友蛊时，每轮开始得到最大血量 〔4〕% 的护体；普攻 30% 机会让目标寒 1 层',
    ['普攻后行动条提前 10%', '本蛊打寒中的敌蛊，伤害 +25%'],
    [E('round', 'shield', 'self', { mx: 0.04, if: 'back' }), E('attack', 'st', 'tg', { k: 'chill', n: 1, chance: 0.3 })],
    [[E('attack', 'adv', 'self', { v: 0.1 })], [E('deal', 'mul', null, { v: 1.25, if: 'tg.chill' })]]),
  inchforward: N('丈量', '尺', '每轮', '每 2 轮挪到同一行最前一格，攻 +〔6〕%',
    ['挪过去时得到最大血量 〔10〕% 的护体', '单数轮也挪'],
    [E('round', 'swap', 'self', { with: 'front', every: 2 }), E('round', 'buff', 'self', { atk: 0.06, every: 2 })],
    [[E('round', 'shield', 'self', { mx: 0.1, every: 2 })], [E('round', 'swap', 'self', { with: 'front', if: 'round%2' })]]),
  warp: N('挪移', '瞬', '出手', '普攻后和同一行身后的友蛊换位，它挂「护」1 次',
    ['换位后行动条提前 15%', '换位时对敌方后排补一刀（攻击 〔35〕%）'],
    [E('attack', 'swap', 'ally.behind', { with: 'self' }), E('attack', 'st', 'same', { k: 'guard', n: 1 })],
    [[E('attack', 'adv', 'self', { v: 0.15 })], [E('attack', 'dmg', 'foe.last', { atk: 0.35, shape: 'back' })]]),
  roam: N('定仙游', '游', '每轮', '每轮开始：和血量比例最低的友蛊换位，它挂「护」1 次',
    ['开战：把敌方攻最高的蛊挪到它那一行最后一格', '开战：全体友蛊速 +〔6〕%'],
    [E('round', 'swap', 'ally.lowp', { with: 'self' }), E('round', 'st', 'same', { k: 'guard', n: 1 })],
    [[E('start', 'swap', 'foe.top', { with: 'back' })], [E('start', 'buff', 'ally.all', { spd: 0.06 })]]),

  // ---------- 宙道 ----------
  brief: N('朝暮', '暮', '每轮', '生来攻血很高，第 4 轮开始寿尽倒下（会触发亡语）',
    ['倒下时化作光雨：敌方全体各受攻击 〔50〕%', '第一次受到致命伤时留 30% 血'],
    [E('round', 'dmg', 'self', { mx: 2, up: 0, pierce: 1, if: 'round>=4', max: 1 })],
    [[E('death', 'dmg', 'foe.all', { atk: 0.5 })], [E('lethal', 'endure', null, { v: 0.3, max: 1 })]]),
  rewind: N('春秋', '春', '覆灭', '每场一次：全队将要覆灭时倒转光阴，开战时在阵的蛊全部以五成攻血复生，蝉自己只剩 1 血',
    ['倒回来时，蝉身边的友蛊各得最大血量 15% 的护体', '倒回来那一刻，敌方全体被光阴反噬，各掉最大血量 10%'],
    [], [[], []], { keepHooks: true }),
  fate: N('织命', '命', '布阵', '布阵：把敌方最靠后的蛊拉近两格，缠住它：2 次普攻落空',
    ['被缠住的蛊中毒（攻击 〔25〕%）', '再缠一只（速最快的那只）'],
    [E('prep', 'draw', 'foe.last', { v: 2 }), E('prep', 'st', 'same', { k: 'web', n: 2 })],
    [[E('prep', 'st', 'same', { k: 'psn', atk: 0.25 })], [E('prep', 'st', 'foe.fast', { k: 'web', n: 2 })]]),
  dawn: N('朝生', '朝', '开战', '开战攻 +〔40〕%，持续 2 轮（朝生暮死）',
    ['开战行动条提前 20%', '第一次普攻回复造成伤害的 〔30〕%'],
    [E('start', 'buff', 'self', { atk: 0.4, dur: 2 })],
    [[E('start', 'adv', 'self', { v: 0.2 })], [E('attack', 'heal', 'self', { n: 0.3, if: 'first' })]]),
  backflow: N('倒流', '漏', '每轮', '每 3 轮：血量比例最低的友蛊回复最大血量 〔15〕%（时光倒流）',
    ['同时清掉它身上的减益', '每 2 轮：敌方速最快的那只寒 1 层'],
    [E('round', 'heal', 'ally.lowp', { tmx: 0.15, every: 3 })],
    [[E('round', 'cleanse', 'same', { every: 3 })], [E('round', 'st', 'foe.fast', { k: 'chill', n: 1, every: 2 })]]),
  growring: N('年轮', '轮', '每轮', '每轮开始攻血 +〔3〕%，第 5 轮起每轮翻倍',
    ['第 4 轮起再多一层', '倒下时同一行身后的友蛊攻血 +〔10〕%'],
    [E('round', 'buff', 'self', { atk: 0.03, hp: 0.03 }), E('round', 'buff', 'self', { atk: 0.03, hp: 0.03, if: 'round>=5' })],
    [[E('round', 'buff', 'self', { atk: 0.03, hp: 0.03, if: 'round>=4' })], [E('death', 'buff', 'ally.behind', { atk: 0.1, hp: 0.1 })]]),
  stoptime: N('刹那', '刹', '布阵', '开战前先出手：打最近的敌蛊两下（各攻击 〔20〕%）',
    ['再多一下', '开战行动条提前 20%'],
    [E('prep', 'dmg', 'foe.front', { atk: 0.2, times: 2 })],
    [[E('prep', 'dmg', 'foe.front', { atk: 0.2 })], [E('start', 'adv', 'self', { v: 0.2 })]]),
};

// ======================= 主动技能（48 种，约四成）=======================
const X = (op, tg, o = {}) => ({ op, tg, ...o });
const A = (n, cap, fx, d, eff, awd3, aw3, awd5, aw5) => ({ n, cap, fx, d, eff, aw: [aw3, aw5], awd: [awd3, awd5] });
const ACTS = {
  // 力道
  boar: A('豕突', 100, 'pounce', '撞同一行最近的敌蛊，攻击 140%，击退一格（撞上后面的蛊，两只都受伤）', [X('dmg', 'foe.front', { atk: 1.4 }), X('knock', 'same', { v: 1 })],
    '被撞的眩晕一次', [X('st', 'same', { k: 'stun', n: 1 })], '自己攻 +15%', [X('buff', 'self', { atk: 0.15 })]),
  stag: A('断头钳', 100, 'slash', '夹敌方血量比例最低的那只，攻击 170%；它血不过半时 ×1.5', [X('dmg', 'foe.lowp', { atk: 1.7, exe: 0.5, exeMul: 1.5 })],
    '再给它打上标记 2 轮', [X('st', 'same', { k: 'mark', n: 2 })], '自己行动条提前 30%', [X('adv', 'self', { v: 0.3 })]),
  glut: A('鲸吞', 110, 'pounce', '咬血量比例最低的敌蛊，攻击 120%；咬完它血不过三成就整只吞下，得到它五成攻血', [X('dmg', 'foe.lowp', { atk: 1.2 }), X('eat', 'same', { v: 0.3, gain: 0.5 })],
    '吞的门槛提高到四成', [X('eat', 'same', { v: 0.4, gain: 0.5 })], '回复最大血量 20%', [X('heal', 'self', { mx: 0.2 })]),
  xiongli: A('熊力撼山', 120, 'pounce', '贯穿最近的那一整行，各攻击 110%，各击退一格', [X('dmg', 'foe.front', { atk: 1.1, shape: 'row' }), X('knock', 'same', { v: 1 })],
    '被撞的 50% 机会全部眩晕一次', [X('st', 'same', { k: 'stun', n: 1, chance: 0.5 })], '自己得到最大血量 20% 的护体', [X('shield', 'self', { mx: 0.2 })]),
  qingtian: A('擎天一击', 130, 'slash', '最近的敌蛊和它十字范围各受攻击 140%，自己攻 +15%', [X('dmg', 'foe.front', { atk: 1.4, shape: 'cross' }), X('buff', 'self', { atk: 0.15 })],
    '同一列的友蛊各得本蛊最大血量 15% 的护体', [X('shield', 'ally.col', { mx: 0.15 })], '最近的敌蛊眩晕一次', [X('st', 'foe.front', { k: 'stun', n: 1 })]),
  // 炎道
  fire: A('流火喷吐', 100, 'fire', '贯穿最近的那一整行，各攻击 80%，灼烧 2 轮（攻击 20%）', [X('dmg', 'foe.front', { atk: 0.8, shape: 'row' }), X('st', 'same', { k: 'burn', n: 2, atk: 0.2 })],
    '灼烧改为 3 轮', [X('st', 'same', { k: 'burn', n: 3, atk: 0.2 })], '再烧它们周围一圈（各 30%）', [X('dmg', 'same', { atk: 0.3, shape: 'ring' })]),
  flint: A('燧火连爆', 110, 'fire', '最近的敌蛊和它十字范围各受攻击 80%，然后点燃敌方全体 2 轮（攻击 20%）', [X('dmg', 'foe.front', { atk: 0.8, shape: 'cross' }), X('st', 'foe.all', { k: 'burn', n: 2, atk: 0.2 })],
    '灼烧改为 3 轮', [X('st', 'foe.all', { k: 'burn', n: 3, atk: 0.2 })], '被点燃的行动条推后 20%', [X('delay', 'same', { v: 0.2 })]),
  magma: A('熔岩喷发', 120, 'fire', '最近的那一整列各受本蛊最大血量 12% 的伤害，灼烧 2 轮（攻击 20%）', [X('dmg', 'foe.front', { mx: 0.12, shape: 'col' }), X('st', 'same', { k: 'burn', n: 2, atk: 0.2 })],
    '被喷中的各击退一格', [X('knock', 'same', { v: 1 })], '自己得到最大血量 20% 的护体', [X('shield', 'self', { mx: 0.2 })]),
  nirvana: A('劫火', 130, 'fire', '敌方全体各受攻击 60%，灼烧 3 轮（攻击 25%）', [X('dmg', 'foe.all', { atk: 0.6 }), X('st', 'same', { k: 'burn', n: 3, atk: 0.25 })],
    '自己回复最大血量 20%', [X('heal', 'self', { mx: 0.2 })], '全体友蛊攻 +10%', [X('buff', 'ally.all', { atk: 0.1 })]),
  // 冰雪道
  frost: A('冰封', 100, 'frost', '速最快的敌蛊受攻击 80%，寒 3 层（立刻冻住）', [X('dmg', 'foe.fast', { atk: 0.8 }), X('st', 'same', { k: 'chill', n: 3 })],
    '攻最高的敌蛊寒 2 层', [X('st', 'foe.top', { k: 'chill', n: 2 })], '自己行动条提前 30%', [X('adv', 'self', { v: 0.3 })]),
  hail: A('雹暴', 110, 'frost', '敌方全体各受攻击 50%，寒 1 层', [X('dmg', 'foe.all', { atk: 0.5 }), X('st', 'same', { k: 'chill', n: 1 })],
    '寒改为 2 层', [X('st', 'same', { k: 'chill', n: 1 })], '再砸一轮（各 20%）', [X('dmg', 'foe.all', { atk: 0.2 })]),
  glacier: A('冰封千里', 120, 'frost', '最近的敌蛊和它十字范围寒 2 层，自己得到最大血量 20% 的护体', [X('st', 'foe.front', { k: 'chill', n: 2, shape: 'cross' }), X('shield', 'self', { mx: 0.2 })],
    '自己嘲讽 2 轮', [X('st', 'self', { k: 'taunt', n: 2 })], '同一列的友蛊也得 15% 护体', [X('shield', 'ally.col', { mx: 0.15 })]),
  // 金道
  iron: A('铜墙', 90, 'shield', '自己得到最大血量 35% 的护体，嘲讽 2 轮', [X('shield', 'self', { mx: 0.35 }), X('st', 'self', { k: 'taunt', n: 2 })],
    '上下左右相邻的友蛊各得 10% 护体', [X('shield', 'ally.adj', { mx: 0.1 })], '自己挂「护」2 次', [X('st', 'self', { k: 'guard', n: 2 })]),
  rhino: A('犀角冲锋', 100, 'pounce', '撞最近的敌蛊，攻击 150%，击退一格（撞上更疼）', [X('dmg', 'foe.front', { atk: 1.5 }), X('knock', 'same', { v: 1, bump: 0.6 })],
    '被撞的眩晕一次', [X('st', 'same', { k: 'stun', n: 1 })], '自己得到最大血量 15% 的护体', [X('shield', 'self', { mx: 0.15 })]),
  saw: A('裂甲', 100, 'slash', '贯穿最近的那一整行，各攻击 90%，无视护体', [X('dmg', 'foe.front', { atk: 0.9, shape: 'row', pierce: 1 })],
    '被撕的打上标记 2 轮', [X('st', 'same', { k: 'mark', n: 2 })], '自己攻 +10%', [X('buff', 'self', { atk: 0.1 })]),
  baiyu: A('玉身', 110, 'shield', '自己和同一列的友蛊各挂「护」2 次', [X('st', 'self', { k: 'guard', n: 2 }), X('st', 'ally.col', { k: 'guard', n: 2 })],
    '同一列的友蛊再得本蛊最大血量 10% 的护体', [X('shield', 'ally.col', { mx: 0.1 })], '自己得到 20% 护体', [X('shield', 'self', { mx: 0.2 })]),
  // 木道
  vine: A('缠藤', 100, 'slash', '把敌方最靠后的蛊拉近两格，缠住它（眩晕一次）', [X('draw', 'foe.last', { v: 2 }), X('st', 'same', { k: 'stun', n: 1 })],
    '被缠的中毒（攻击 30%）', [X('st', 'same', { k: 'psn', atk: 0.3 })], '再拉近攻最高的那只', [X('draw', 'foe.top', { v: 1 })]),
  fusang: A('扶桑朝晖', 120, 'heal', '全体友蛊回复最大血量 15%，清掉减益', [X('heal', 'ally.all', { tmx: 0.15 }), X('cleanse', 'ally.all')],
    '同一列的友蛊再得本蛊最大血量 10% 的护体', [X('shield', 'ally.col', { mx: 0.1 })], '全体友蛊攻 +8%', [X('buff', 'ally.all', { atk: 0.08 })]),
  // 土道
  tortoise: A('玄武镇', 120, 'shield', '全体友蛊得到本蛊最大血量 12% 的护体，自己嘲讽 2 轮', [X('shield', 'ally.all', { mx: 0.12 }), X('st', 'self', { k: 'taunt', n: 2 })],
    '自己挂「护」2 次', [X('st', 'self', { k: 'guard', n: 2 })], '同一行的友蛊再得 10% 护体', [X('shield', 'ally.row', { mx: 0.1 })]),
  moveshan: A('移山', 120, 'roar', '把敌方攻最高的蛊拉近两格（撞上更疼），再对它造成攻击 120%', [X('draw', 'foe.top', { v: 2, bump: 0.6 }), X('dmg', 'same', { atk: 1.2 })],
    '推后它行动条 30%', [X('delay', 'same', { v: 0.3 })], '它眩晕一次', [X('st', 'same', { k: 'stun', n: 1 })]),
  // 雷道
  thunder: A('连环雷', 110, 'bolt', '劈敌方随机一只和它十字范围，各攻击 80%；30% 机会全部眩晕一次', [X('dmg', 'foe.rand', { atk: 0.8, shape: 'cross' }), X('st', 'same', { k: 'stun', n: 1, chance: 0.3 })],
    '被劈的打上标记 2 轮', [X('st', 'same', { k: 'mark', n: 2 })], '再劈一下（各 30%）', [X('dmg', 'same', { atk: 0.3 })]),
  dfly: A('九天引雷', 120, 'bolt', '敌方全体各受攻击 70%，行动条推后 20%', [X('dmg', 'foe.all', { atk: 0.7 }), X('delay', 'same', { v: 0.2 })],
    '20% 机会全部眩晕一次', [X('st', 'same', { k: 'stun', n: 1, chance: 0.2 })], '敌方后排再各受 30%', [X('dmg', 'foe.last', { atk: 0.3, shape: 'back' })]),
  jiuxiao: A('九霄雷狱', 140, 'bolt', '敌方全体各受攻击 100%；35% 机会全部眩晕一次', [X('dmg', 'foe.all', { atk: 1.0 }), X('st', 'same', { k: 'stun', n: 1, chance: 0.35 })],
    '被劈的打上标记 2 轮', [X('st', 'same', { k: 'mark', n: 2 })], '自己行动条提前 40%', [X('adv', 'self', { v: 0.4 })]),
  // 光道
  yueguang: A('月华斜斩', 100, 'needle', '月刃斜斩：最近的敌蛊和它斜对角的敌蛊各受攻击 100%', [X('dmg', 'foe.front', { atk: 1.0, shape: 'diag' })],
    '被斩的打上标记 2 轮', [X('st', 'same', { k: 'mark', n: 2 })], '再贯穿最近的那一整行（各 40%）', [X('dmg', 'foe.front', { atk: 0.4, shape: 'row' })]),
  solar: A('大日', 130, 'fire', '敌方全体灼烧 3 轮（攻击 25%），全体友蛊回复最大血量 10%', [X('st', 'foe.all', { k: 'burn', n: 3, atk: 0.25 }), X('heal', 'ally.all', { tmx: 0.1 })],
    '敌方全体再各受 30%', [X('dmg', 'foe.all', { atk: 0.3 })], '全体友蛊速 +10%（2 轮）', [X('buff', 'ally.all', { spd: 0.1, dur: 2 })]),
  // 暗道
  mantis: A('斩心镰', 100, 'slash', '斩敌方血最少的蛊，攻击 180%；它血不过半时 ×1.5', [X('dmg', 'foe.low', { atk: 1.8, exe: 0.5, exeMul: 1.5 })],
    '自己行动条提前 30%', [X('adv', 'self', { v: 0.3 })], '回复最大血量 20%', [X('heal', 'self', { mx: 0.2 })]),
  bat: A('夜袭', 90, 'drain', '扑向敌方血最少的蛊，攻击 140%，回复造成伤害的一半', [X('dmg', 'foe.low', { atk: 1.4, steal: 0.5 })],
    '再给它打上标记 2 轮', [X('st', 'same', { k: 'mark', n: 2 })], '伤得最重的友蛊回复 10%', [X('heal', 'ally.lowp', { tmx: 0.1 })]),
  styx: A('冥河摆渡', 120, 'summon', '在后排召回一只魂体（本蛊攻血 40%），敌方全体寒 1 层', [X('summon', null, { sp: 'soul', atk: 0.4, mx: 0.4, at: 'back' }), X('st', 'foe.all', { k: 'chill', n: 1 })],
    '寒到的打上标记 1 轮', [X('st', 'same', { k: 'mark', n: 2 })], '全体友蛊攻 +8%', [X('buff', 'ally.all', { atk: 0.08 })]),
  // 血道
  mosq: A('吸髓', 90, 'drain', '吸攻最高的敌蛊，攻击 130%，回复一半；偷它 15% 的攻', [X('dmg', 'foe.top', { atk: 1.3, steal: 0.5 }), X('buff', 'same', { atk: -0.15 }), X('buff', 'self', { atk: 0.15 })],
    '它打上标记 2 轮', [X('st', 'foe.top', { k: 'mark', n: 2 })], '自己行动条提前 30%', [X('adv', 'self', { v: 0.3 })]),
  xueyue: A('血月当空', 110, 'slash', '失去最大血量 12%，贯穿最近的那一整行，各攻击 160%', [X('dmg', 'self', { mx: 0.12, up: 0, pierce: 1 }), X('dmg', 'foe.front', { atk: 1.6, shape: 'row' })],
    '回复最大血量 15%', [X('heal', 'self', { mx: 0.15 })], '那一整行打上标记 2 轮', [X('st', 'foe.front', { k: 'mark', n: 2, shape: 'row' })]),
  chiba: A('赤地千里', 140, 'drain', '敌方全体各受攻击 70%、灼烧 2 轮（攻击 20%），自己回复最大血量 25%', [X('dmg', 'foe.all', { atk: 0.7 }), X('st', 'same', { k: 'burn', n: 2, atk: 0.2 }), X('heal', 'self', { mx: 0.25 })],
    '全体友蛊回复 8%', [X('heal', 'ally.all', { tmx: 0.08 })], '全体友蛊攻 +10%', [X('buff', 'ally.all', { atk: 0.1 })]),
  // 毒道
  scorp: A('三连毒针', 90, 'needle', '对敌方最靠后的蛊连射三针，各攻击 60%，中毒（攻击 30%）', [X('dmg', 'foe.last', { atk: 0.6, times: 3 }), X('st', 'same', { k: 'psn', atk: 0.3 })],
    '它打上标记 2 轮', [X('st', 'same', { k: 'mark', n: 2 })], '敌方后排各再中一针（30%）', [X('dmg', 'foe.last', { atk: 0.3, shape: 'back' })]),
  cent: A('百足噬', 90, 'pounce', '咬最近的敌蛊，攻击 140%，中毒（攻击 40%）', [X('dmg', 'foe.front', { atk: 1.4 }), X('st', 'same', { k: 'psn', atk: 0.4 })],
    '它那一整列都中毒（20%）', [X('st', 'same', { k: 'psn', atk: 0.2, shape: 'col' })], '回复最大血量 15%', [X('heal', 'self', { mx: 0.15 })]),
  toad: A('毒瘴', 110, 'spore', '敌方全体中毒（本蛊最大血量 5%）', [X('st', 'foe.all', { k: 'psn', mx: 0.05 })],
    '中毒的攻 -8%（2 轮）', [X('buff', 'same', { atk: -0.08, dur: 2 })], '吞掉一只血不过 25% 的敌蛊（得它四成攻血）', [X('eat', 'foe.lowp', { v: 0.25, gain: 0.4 })]),
  widow: A('毒吻', 100, 'pounce', '攻最高的敌蛊中毒（攻击 60%），攻 -15%（3 轮）', [X('st', 'foe.top', { k: 'psn', atk: 0.6 }), X('buff', 'same', { atk: -0.15, dur: 3 })],
    '它打上标记 2 轮', [X('st', 'same', { k: 'mark', n: 2 })], '再咬它一口（攻击 80%）', [X('dmg', 'same', { atk: 0.8 })]),
  // 智道
  webspider: A('天罗网', 90, 'needle', '最近的那一整行落网 1 次，行动条推后 30%', [X('st', 'foe.front', { k: 'web', n: 1, shape: 'row' }), X('delay', 'same', { v: 0.3 })],
    '落网的打上标记 1 轮', [X('st', 'same', { k: 'mark', n: 2 })], '再网住速最快的那只', [X('st', 'foe.fast', { k: 'web', n: 1 })]),
  cricket: A('震天鸣', 100, 'roar', '敌方全体攻 -10%（2 轮），行动条推后 25%', [X('buff', 'foe.all', { atk: -0.1, dur: 2 }), X('delay', 'same', { v: 0.25 })],
    '自己攻 +10%', [X('buff', 'self', { atk: 0.1 })], '攻最高的敌蛊被封住 1 轮', [X('st', 'foe.top', { k: 'seal', n: 2 })]),
  zhihui: A('一念', 130, 'roar', '敌方全体被封住 1 轮（蛊力不涨），全体友蛊蛊力 +25', [X('st', 'foe.all', { k: 'seal', n: 2 }), X('gp', 'ally.all', { v: 25 })],
    '攻最高的敌蛊打上标记 2 轮', [X('st', 'foe.top', { k: 'mark', n: 2 })], '清掉全体友蛊身上的减益', [X('cleanse', 'ally.all')]),
  // 魂道
  boneflute: A('安魂曲', 120, 'summon', '在后排召回一只骨灵（本蛊攻血 40%），全体友蛊攻 +8%', [X('summon', null, { sp: 'bonesoul', atk: 0.4, mx: 0.4, at: 'back' }), X('buff', 'ally.all', { atk: 0.08 })],
    '全体友蛊回复 8%', [X('heal', 'ally.all', { tmx: 0.08 })], '敌方全体寒 1 层', [X('st', 'foe.all', { k: 'chill', n: 1 })]),
  // 奴道
  queen: A('万蜂朝王', 120, 'summon', '后排召两只工蜂（各本蛊攻血 35%），全体友蛊攻 +8%', [X('summon', null, { sp: 'bee', atk: 0.35, mx: 0.35, at: 'back', count: 2 }), X('buff', 'ally.all', { atk: 0.08 })],
    '全体友蛊得到本蛊最大血量 5% 的护体', [X('shield', 'ally.all', { mx: 0.05 })], '再召一只', [X('summon', null, { sp: 'bee', atk: 0.35, mx: 0.35, at: 'back' })]),
  spider: A('万蛛归巢', 110, 'summon', '身后召两只小蛛（各本蛊攻血 30%），自己回复最大血量 20%', [X('summon', null, { sp: 'spiderling', atk: 0.3, mx: 0.3, at: 'behind', count: 2 }), X('heal', 'self', { mx: 0.2 })],
    '敌方最近的那只落网 1 次', [X('st', 'foe.front', { k: 'web', n: 1 })], '再召一只', [X('summon', null, { sp: 'spiderling', atk: 0.3, mx: 0.3, at: 'behind' })]),
  qant: A('蚁潮', 120, 'summon', '后排召三只兵蚁（各本蛊攻血 25%）', [X('summon', null, { sp: 'antling', atk: 0.25, mx: 0.25, at: 'back', count: 3 })],
    '全体友蛊攻 +6%', [X('buff', 'ally.all', { atk: 0.06 })], '全体友蛊得到本蛊最大血量 6% 的护体', [X('shield', 'ally.all', { mx: 0.06 })]),
  // 宇道
  gecko: A('断尾护主', 80, 'shield', '最前的友蛊得到本蛊最大血量 30% 的护体，清掉减益', [X('shield', 'ally.front', { mx: 0.3 }), X('cleanse', 'same')],
    '它再挂「护」1 次', [X('st', 'same', { k: 'guard', n: 1 })], '同一行的友蛊各得 10% 护体', [X('shield', 'ally.row', { mx: 0.1 })]),
  blink: A('瞬斩', 90, 'slash', '闪到敌方后排：后排各受攻击 100%', [X('dmg', 'foe.last', { atk: 1.0, shape: 'back' })],
    '被斩的打上标记 2 轮', [X('st', 'same', { k: 'mark', n: 2 })], '自己行动条提前 30%', [X('adv', 'self', { v: 0.3 })]),
  dingxian: A('定仙游', 130, 'roar', '全体友蛊行动条提前 35%，最前的友蛊挂「护」2 次', [X('adv', 'ally.all', { v: 0.35 }), X('st', 'ally.front', { k: 'guard', n: 2 })],
    '把敌方攻最高的蛊挪到它那一行最后一格', [X('swap', 'foe.top', { with: 'back' })], '清掉全体友蛊身上的减益', [X('cleanse', 'ally.all')]),
  // 宙道
  guangyin: A('光阴倒流', 140, 'heal', '全体友蛊回复最大血量 20%，清掉减益', [X('heal', 'ally.all', { tmx: 0.2 }), X('cleanse', 'ally.all')],
    '全体友蛊行动条提前 20%', [X('adv', 'ally.all', { v: 0.2 })], '敌方全体行动条推后 20%', [X('delay', 'foe.all', { v: 0.2 })]),
  fate: A('织命', 120, 'needle', '敌方速最快的两只行动条推后 50%，寒 1 层', [X('delay', 'foe.fast:2', { v: 0.5 }), X('st', 'same', { k: 'chill', n: 1 })],
    '它们打上标记 2 轮', [X('st', 'same', { k: 'mark', n: 2 })], '它们落网 1 次', [X('st', 'same', { k: 'web', n: 1 })]),
  instant: A('刹那永恒', 120, 'slash', '对最近的敌蛊连斩三下，各攻击 60%，推后它行动条 30%', [X('dmg', 'foe.front', { atk: 0.6, times: 3 }), X('delay', 'same', { v: 0.3 })],
    '它寒 1 层', [X('st', 'same', { k: 'chill', n: 1 })], '自己行动条提前 30%', [X('adv', 'self', { v: 0.3 })]),
};
const ACT_COUNT = Object.keys(ACTS).length;

// ======================= 新 56 种 =======================
// S(id, 名, 简字, 道, 基础转数, 攻, 血, 速, 远近 m/r, 远程挑谁, 普攻动作, 本命 key, 机制标签, 一句话, 额外)
const S = (id, n, ab, dao, rank, a, h, spd, rc, aim, atkFx, nat, role, lore, extra = {}) =>
  ({ id, n, ab, dao, rank, tier: rank >= 6 ? 6 : rank - 1, atk: a, hp: h, t: nat, v: 1, nat, spd, reach: rc === 'r' ? 'ranged' : 'melee', aim: rc === 'r' ? aim : null, atkFx, role, lore,
    ...(rank >= 6 ? { legend: 1, immortal: true } : {}), ...extra });
const C = { canon: true };
const SPECIES2 = [
  S('xiongli',    '熊力蛊',     '熊', 'li',    4, 3, 6, 80,  'm', null,   'pounce', 'bearforce',     '击退·坦',     '一只蛊里装着一头熊的力气，拍一掌，对面整排往后退', C),
  S('qingtian',   '擎天蛊',     '擎', 'li',    6, 4, 6, 95,  'm', null,   'slash',  'skyhold',       '成长·仙蛊',   '传说它托着一片天，压弯的是它的腿，从来不是它的背'),
  S('fireant',    '火蚁蛊',     '焰', 'yan',   1, 2, 3, 105, 'm', null,   'bite',   'scorch',        '灼烧',        '咬一口像被火燎，疼劲要过两天才退'),
  S('pyre',       '焚翅蛊',     '焚', 'yan',   2, 3, 3, 110, 'r', 'low',  'spit',   'wingfire',      '群伤·自损',   '翅膀一直烧着，飞到哪儿烧到哪儿，连自己也烧'),
  S('char',       '炭甲蛊',     '炭', 'yan',   3, 3, 5, 85,  'm', null,   'pounce', 'coal',          '受击灼烧',    '甲壳是一层炭，越敲越红'),
  S('flint',      '燧石蛊',     '燧', 'yan',   3, 3, 3, 100, 'r', 'low',  'needle', 'ignite',        '引燃追击',    '两片鞘翅一碰就是一串火星，哪里起火它就扑向哪里'),
  S('magma',      '熔岩蛊',     '熔', 'yan',   4, 3, 7, 75,  'm', null,   'slash',  'lavashell',     '反伤·坦',     '壳底下是流动的岩浆，碰它一下就烫掉一层皮'),
  S('snowsilk',   '冰蚕蛊',     '蚕', 'bing',  1, 1, 4, 90,  'r', 'top',  'spit',   'icesilk',       '寒·护邻',     '吐的丝是冷的，缠上去手脚就慢了'),
  S('snowflea',   '雪蚤蛊',     '雪', 'bing',  1, 3, 2, 130, 'm', null,   'bite',   'snowhop',       '专打寒',      '在雪地上跳着走，专咬冻僵了的'),
  S('icesnail',   '冰蜗蛊',     '蜗', 'bing',  2, 1, 5, 65,  'r', 'top',  'spit',   'drag',          '寒·减速',     '它慢，它也要你陪它一起慢'),
  S('coldcicada', '寒蝉蛊',     '寒', 'bing',  3, 2, 4, 95,  'r', 'low',  'wave',   'hush',          '封蛊力',      '秋深了，它一叫，满场都不敢出声'),
  S('hail',       '雹甲蛊',     '雹', 'bing',  4, 3, 5, 85,  'r', 'low',  'needle', 'hailstorm',     '范围·寒',     '背上结着一层冰疙瘩，一抖就是一场雹子'),
  S('glacier',    '玄冰蛊',     '冰', 'bing',  5, 2, 7, 70,  'm', null,   'slash',  'permafrost',    '坦·冻结',     '千年不化的一块冰，打它的人手先冻僵'),
  S('yupi',       '玉皮蛊',     '玉', 'jin',   1, 1, 5, 85,  'm', null,   'bite',   'jadeskin',      '护·护邻',     '皮肤生出一层玉色，刀砍上去只留一道白印', C),
  S('lockarm',    '锁甲蛊',     '锁', 'jin',   2, 2, 5, 80,  'm', null,   'slash',  'interlock',     '护邻',        '甲片一节扣一节，把左右的同伴也扣了进来'),
  S('baiyu',      '白玉蛊',     '璧', 'jin',   3, 2, 6, 75,  'm', null,   'slash',  'whitejade',     '残血化玉',    '快倒下时浑身化作白玉，硬得刀枪不入', C),
  S('shengji',    '生机叶',     '叶', 'mu',    1, 1, 4, 90,  'r', 'low',  'spore',  'lifeleaf',      '治疗相邻',    '一片嫩叶，贴在谁身上，谁的伤口就合上了', C),
  S('vine',       '藤蔓蛊',     '藤', 'mu',    2, 2, 4, 95,  'r', 'last', 'needle', 'creep',         '拉近·缠绕',   '藤条一甩就缠住后排，硬拽到跟前来'),
  S('cordy',      '虫草蛊',     '草', 'mu',    4, 3, 4, 100, 'm', null,   'bite',   'cordyceps',     '毒·击杀召唤', '冬天是虫，夏天是草，倒在它脚下的也一样'),
  S('fusang',     '扶桑蛊',     '桑', 'mu',    5, 2, 6, 85,  'r', 'low',  'spore',  'sunroot',       '群体治疗',    '日出的那棵树上，只住着它一只'),
  S('stonecase',  '石蚕蛊',     '石', 'tu',    1, 1, 5, 70,  'm', null,   'bite',   'stoneskin',     '坦·减伤',     '用砂石给自己缝了件衣服，刀砍上去只溅火星'),
  S('earthworm',  '地龙蛊',     '蚓', 'tu',    2, 2, 4, 85,  'm', null,   'bite',   'earthdragon',   '免死·分身',   '断成两截，两截都还能动'),
  S('moveshan',   '搬山蛊',     '搬', 'tu',    4, 3, 6, 70,  'm', null,   'pounce', 'shiftmount',    '击退',        '挡路的不是山，是还没被它搬走的山'),
  S('static',     '静电蛊',     '静', 'lei',   1, 2, 3, 110, 'm', null,   'bite',   'charge',        '反击·麻痹',   '一身绒毛炸着，谁摸谁一哆嗦'),
  S('jingzhe',    '惊蛰蛊',     '蛰', 'lei',   1, 2, 3, 105, 'r', 'low',  'wave',   'springthunder', '开局群控',    '第一声春雷就是它叫醒的'),
  S('click',      '叩甲蛊',     '叩', 'lei',   2, 3, 3, 120, 'm', null,   'pounce', 'clickjump',     '随机击退',    '翻过身啪的一弹，带着雷声砸下来'),
  S('cloud',      '积云蛊',     '云', 'lei',   3, 2, 4, 90,  'r', 'low',  'bolt',   'thundercloud',  '蓄力群伤',    '头顶总飘着一小朵乌云，攒够了就下'),
  S('magstorm',   '磁暴蛊',     '磁', 'lei',   4, 3, 4, 115, 'm', null,   'bolt',   'magburst',      '专打眩晕',    '它一靠近，你的骨头都在发麻'),
  S('jiuxiao',    '九霄蛊',     '霄', 'lei',   6, 4, 5, 120, 'r', 'low',  'bolt',   'ninebolt',      '群伤·仙蛊',   '九重天上的雷都听它调遣'),
  S('yueguang',   '月光蛊',     '月', 'guang', 1, 3, 2, 115, 'r', 'low',  'needle', 'moonblade',     '贯穿整行',    '掌心一道弯月，挥出去就是一片银白的刀光', C),
  S('sheli',      '舍利蛊',     '舍', 'guang', 2, 1, 4, 95,  'r', 'low',  'wave',   'relic',         '增益相邻',    '一粒温润的珠子，放在身边，修为就往上涨', C),
  S('shine',      '照夜蛊',     '照', 'guang', 3, 3, 3, 125, 'r', 'lowp', 'needle', 'nightlight',    '暴击·标记',   '夜里它一亮，你的破绽全露出来了'),
  S('solar',      '曜日蛊',     '曜', 'guang', 5, 3, 5, 95,  'r', 'low',  'spit',   'sunfire',       '灼烧·治疗',   '背上驮着一轮小太阳，烤敌人，暖自己人'),
  S('ink',        '墨斗蛊',     '墨', 'an',    1, 2, 3, 105, 'r', 'top',  'spit',   'inkcloud',      '致盲一列',    '一口墨喷出来，对面一整列什么都看不见'),
  S('bat',        '夜蝠蛊',     '蝠', 'an',    2, 3, 3, 130, 'r', 'low',  'bite',   'nightsip',      '吸血·续航',   '白天倒挂着睡，夜里专挑伤最重的下嘴'),
  S('eclipse',    '月蚀蛊',     '蚀', 'an',    4, 3, 4, 110, 'r', 'last', 'needle', 'blotout',       '削弱·寒',     '它爬过月亮，月亮就缺了一块'),
  S('styx',       '冥蝶蛊',     '冥', 'an',    5, 2, 5, 100, 'r', 'low',  'wave',   'ferry',         '复生',        '从阴间飞回来的蝶，总会带回一个人'),
  S('tick',       '蜱蛊',       '蜱', 'xue',   1, 2, 3, 100, 'm', null,   'bite',   'latch',         '偷血·专打毒', '小得看不见，咬上了就越吸越大'),
  S('bloodant',   '血蚁蛊',     '赤', 'xue',   1, 3, 2, 115, 'm', null,   'bite',   'bloodpact',     '献血增益',    '一窝血蚁，先咬破自己，再替兄弟出头'),
  S('amber',      '血珀蛊',     '珀', 'xue',   3, 2, 5, 75,  'm', null,   'slash',  'clot',          '免死',        '死到临头，它把自己封进一块血色琥珀'),
  S('xueyue',     '血月蛊',     '血', 'xue',   4, 4, 4, 110, 'm', null,   'slash',  'bloodmoon',     '残血贯穿',    '月光蛊饮够了血，弯月就染成了红色', C),
  S('chiba',      '赤魃蛊',     '魃', 'xue',   6, 4, 6, 105, 'r', 'low',  'wave',   'drought',       '群体吸血·仙蛊', '它走过的地方，三年不下雨'),
  S('widow',      '寡妇蛛',     '寡', 'du',    4, 3, 4, 105, 'm', null,   'bite',   'widowkiss',     '毒·吞',       '红沙漏纹在腹下，一吻就是一条命'),
  S('jiuchong',   '酒虫',       '酒', 'zhi',   1, 1, 4, 95,  'r', 'low',  'spore',  'brew',          '攒蛊力',      '肚里一汪酒，喝一口，身边的蛊都来了精神', C),
  S('diting',     '地听肉耳草', '听', 'zhi',   2, 1, 4, 100, 'r', 'top',  'wave',   'earlisten',     '标记',        '长得像一只耳朵的草，贴着地，听得见对面谁最凶', C),
  S('zhihui',     '智慧蛊',     '智', 'zhi',   6, 3, 6, 105, 'r', 'top',  'wave',   'wisdom',        '蛊力·仙蛊',   '它不出手，它只是比所有人都先想到下一步', C),
  S('will',       '鬼火蛊',     '磷', 'hun',   1, 2, 2, 110, 'r', 'low',  'spit',   'wisp',          '亡语接力·寒', '坟头那点绿火，其实是它在等人'),
  S('boneflute',  '骨笛蛊',     '笛', 'hun',   5, 2, 5, 90,  'r', 'low',  'wave',   'dirge',         '亡者增益',    '用倒下的同伴的骨头吹出来的曲子，越吹越响'),
  S('strider',    '水黾蛊',     '黾', 'yu',    1, 2, 3, 125, 'r', 'low',  'needle', 'skate',         '后排护体·寒', '站在水面上，从来不沾湿脚'),
  S('inch',       '尺蠖蛊',     '尺', 'yu',    1, 2, 4, 80,  'm', null,   'bite',   'inchforward',   '挪位',        '一弓一伸，量着步子往前挪'),
  S('blink',      '瞬移蛊',     '瞬', 'yu',    4, 3, 3, 135, 'm', null,   'slash',  'warp',          '打完就换位',  '出一刀，人已经回到了队尾'),
  S('dingxian',   '定仙游',     '游', 'yu',    6, 3, 6, 120, 'r', 'low',  'wave',   'roam',          '换位·仙蛊',   '心念一动，人已在千里之外', C),
  S('asahi',      '朝菌蛊',     '菌', 'zhou',  1, 3, 2, 115, 'm', null,   'bite',   'dawn',          '开局爆发',    '早上生，晚上死，所以早上最凶'),
  S('hourglass',  '沙漏蛊',     '漏', 'zhou',  2, 1, 5, 90,  'r', 'lowp', 'wave',   'backflow',      '治疗·倒流',   '肚子里的沙往上流，伤口就往回长'),
  S('ring',       '年轮蛊',     '轮', 'zhou',  3, 2, 5, 85,  'm', null,   'slash',  'growring',      '越拖越强',    '多活一轮，身上就多一圈纹'),
  S('instant',    '刹那蛊',     '刹', 'zhou',  5, 3, 3, 150, 'm', null,   'slash',  'stoptime',      '先手连击',    '在别人眨眼的工夫里，它已经出了两刀'),
];
const SUMMONS2 = { grass: '虫草', sprout: '新芽', soul: '魂体', wormhalf: '半截地龙', bonesoul: '骨灵', xueshen: '血神子' };

// ======================= 旧 64 种 =======================
// 道、战斗字段（速 远近 挑谁 普攻动作）
const DAO64 = `li boar tiger drum stag glut locust|yan fire bomb nirvana|bing frost|jin iron rhino gold jinchan saw|mu thorn stick silk taisui|tu dung mole antlion tortoise yue
lei thunder dfly|guang moth firefly mirror|an mantis hex sleep|xue leech mosq urn|du scorp hairy cent wasp toad hairworm|zhi webspider cricket lure orchid
hun bone cicada qingfu fly bury|nu queen ant aphid spider qant hive puppet twin|yu gecko flea bfly|zhou mayfly guangyin fate`;
const B64 = `boar 95 m - pounce|fire 100 r low spit|twin 105 m - slash|iron 70 m - pounce|thorn 80 m - slash|mantis 120 m - slash|bone 85 m - bite|queen 90 r low wave
cicada 100 m - pounce|drum 85 r low wave|scorp 105 r last needle|moth 95 r low spore|ant 100 m - bite|firefly 110 r low spit|stick 80 m - slash|leech 95 m - bite
dung 70 m - pounce|tiger 140 m - pounce|webspider 100 r top needle|aphid 105 m - bite|hairy 85 m - bite|cent 105 m - bite|wasp 130 r low needle|spider 80 m - bite
mole 95 m - pounce|gecko 90 r low wave|qingfu 100 m - bite|bomb 90 m - pounce|silk 70 m - bite|mosq 125 r top needle|rhino 80 m - pounce|gold 85 m - pounce
qant 85 r low wave|flea 140 m - bite|bfly 115 r low spore|sleep 90 r top spore|stag 100 m - slash|glut 95 m - bite|toad 75 r low spore|cricket 110 m - pounce
locust 115 m - slash|mirror 80 m - slash|hive 75 r low wave|fly 120 m - bite|bury 85 m - bite|frost 110 r top needle|lure 105 r low spore|antlion 75 m - bite
mayfly 140 m - pounce|thunder 100 m - bolt|tortoise 60 m - pounce|puppet 95 r low needle|hairworm 110 r top needle|urn 70 m - bite|hex 100 r top spore|saw 90 m - slash
dfly 135 r low bolt|orchid 110 m - slash|taisui 75 m - bite|yue 60 r low wave|jinchan 85 r low spit|guangyin 100 r low wave|fate 95 r top needle|nirvana 110 r low spit`;
// 「一转口径」攻血比例（取自原物种表，合计不足 5 的按比例放大）与基础转数
const P64 = `boar 3 4|fire 2 3|twin 2 3|iron 2 5|thorn 2 4|mantis 4 2|bone 2 2|queen 2 3|cicada 2 3|drum 1 4|scorp 1 2|moth 1 2|ant 2 3|firefly 2 2|stick 1 3|leech 2 3
dung 1 4|tiger 3 2|webspider 1 2|aphid 1 2|hairy 2 3|cent 2 3|wasp 2 2|spider 1 5|mole 3 3|gecko 1 4|qingfu 2 3|bomb 2 2|silk 1 4|mosq 1 3|rhino 2 4|gold 2 3
qant 2 4|flea 3 3|bfly 3 4|sleep 1 4|stag 3 4|glut 3 3|toad 1 4|cricket 2 3|locust 2 3|mirror 2 4|hive 1 6|fly 2 3|bury 2 4|frost 2 3|lure 1 3|antlion 2 4
mayfly 6 6|thunder 3 4|tortoise 2 4|puppet 3 3|hairworm 2 3|urn 2 3|hex 1 3|saw 3 5|dfly 2 3|orchid 1 3|taisui 2 4|yue 2 6|jinchan 3 4|guangyin 2 4|fate 2 5|nirvana 3 3`;
const RANK64 = { boar: 1, fire: 1, twin: 1, iron: 1, thorn: 1, bone: 1, mantis: 2, queen: 2, cicada: 2, drum: 3, scorp: 3, moth: 3,
  ant: 1, firefly: 1, stick: 1, leech: 1, dung: 1, tiger: 1, webspider: 1, aphid: 1, hairy: 1, cent: 1, wasp: 2, spider: 2, mole: 2, gecko: 2, qingfu: 2, bomb: 2, silk: 2, mosq: 2, rhino: 2, gold: 2,
  qant: 3, flea: 3, bfly: 3, sleep: 3, stag: 3, glut: 3, toad: 3, cricket: 3, locust: 3, mirror: 4, hive: 4, fly: 4, bury: 4, frost: 4, lure: 4, antlion: 4, mayfly: 4,
  thunder: 5, tortoise: 5, puppet: 5, hairworm: 5, urn: 5, hex: 5, saw: 5, dfly: 5, orchid: 5, taisui: 5, yue: 5, jinchan: 5, guangyin: 6, fate: 6, nirvana: 6 };
// 换成原著名字的旧物种（id 不变，存档和坐标码照旧）
const RENAME64 = {
  boar: { n: '白豕蛊', canon: true, lore: '一头白豕的蛮力附在身上，越挨打越疯' },
  tiger: { n: '黑豕蛊', ab: '黑', canon: true, lore: '一头黑豕的蛮力，全压在冲出去的第一下' },
  iron: { n: '铜皮蛊', ab: '铜', canon: true, lore: '一身铜皮，壳比命硬' },
  firefly: { n: '小光蛊', ab: '光', canon: true, lore: '一点微光，灭之前也要照出你的破绽' },
  guangyin: { n: '春秋蝉', ab: '春', canon: true, lore: '春去秋来只叫一声。它叫一声，日影就往回走一寸——覆灭的阵前，所有人回到开战那一刻，只是都老了一半；叫完这一声，它自己只剩一口气。' },
};

// ======================= 每转攻血表 =======================
// 与 core.js 的 RANK_GROW 同一条曲线：一转 ×1、二转 ×1.8、三转 ×3、四转 ×4.6、五转 ×6.8、仙蛊 ×9.6；基础转数每高一转多 6%（买得更贵）
const ST_GROW = [0, 1, 1.8, 3, 4.6, 6.8, 9.6];
const table = (a, h, r0) => {
  const t = a + h, k = t < 5 ? 5 / t : 1, prem = 1 + 0.06 * (Math.min(6, r0) - 1), st = Array(7).fill(null);
  for (let r = r0; r <= (r0 >= 6 ? 6 : 5); r++) st[r] = [Math.max(1, Math.round(a * k * ST_GROW[r] * prem)), Math.max(1, Math.round(h * k * ST_GROW[r] * prem))];
  return st;
};
const ST120 = {};
P64.split(/[|\n]/).forEach(x => { const [id, a, h] = x.trim().split(' '); ST120[id] = table(+a, +h, RANK64[id]); });
SPECIES2.forEach(s => { ST120[s.id] = table(s.atk, s.hp, s.rank); s.st = ST120[s.id]; s.act = ACTS[s.id] || null; });

const PATCH64 = {};
DAO64.split(/[|\n]/).forEach(x => { const [d, ...ids] = x.trim().split(' '); ids.forEach(id => { PATCH64[id] = { dao: d }; }); });
B64.split(/[|\n]/).forEach(x => {
  const [id, spd, rc, aim, atkFx] = x.trim().split(' ');
  Object.assign(PATCH64[id], { spd: +spd, reach: rc === 'r' ? 'ranged' : 'melee', aim: aim === '-' ? null : aim, atkFx, act: ACTS[id] || null, st: ST120[id] }, RENAME64[id] || {});
});

// ======================= 汇总 =======================
const BATTLE120 = {};
Object.entries(PATCH64).forEach(([id, p]) => { BATTLE120[id] = { spd: p.spd, reach: p.reach, aim: p.aim, atkFx: p.atkFx, act: p.act, st: p.st }; });
SPECIES2.forEach(s => { BATTLE120[s.id] = { spd: s.spd, reach: s.reach, aim: s.aim, atkFx: s.atkFx, act: s.act, st: s.st }; });
const DAO120 = Object.fromEntries([...Object.entries(PATCH64).map(([id, p]) => [id, p.dao]), ...SPECIES2.map(s => [s.id, s.dao])]);
const CANON = [...Object.entries(RENAME64).map(([id, r]) => [id, r.n]), ...SPECIES2.filter(s => s.canon).map(s => [s.id, s.n])];
const NAT_OF64 = { boar: 'rage', fire: 'blaze', twin: 'mirage', iron: 'ironskin', thorn: 'bramble', mantis: 'heart', bone: 'rot', queen: 'royal', cicada: 'molt', drum: 'beat', scorp: 'sting', moth: 'moon',
  ant: 'muster', firefly: 'ember', stick: 'ripen', leech: 'leech', dung: 'roll', tiger: 'blitz', webspider: 'web', aphid: 'scatter', hairy: 'nettle', cent: 'venom', wasp: 'prick', spider: 'brood',
  mole: 'burrow', gecko: 'ward', qingfu: 'mother', bomb: 'burst', silk: 'cocoon', mosq: 'drain', rhino: 'scale', gold: 'gild', qant: 'nurture', flea: 'hop', bfly: 'pair', sleep: 'lull',
  stag: 'execute', glut: 'gorge', toad: 'miasma', cricket: 'chirp', locust: 'cleave', mirror: 'mirror', hive: 'hive', fly: 'mourn', bury: 'inherit', frost: 'frost', lure: 'lure', antlion: 'pit',
  mayfly: 'brief', thunder: 'chain', tortoise: 'bulwark', puppet: 'strings', hairworm: 'parasite', urn: 'urn', hex: 'hex', saw: 'sunder', dfly: 'storm', orchid: 'mimic', taisui: 'regrow',
  yue: 'aegis', jinchan: 'coin', guangyin: 'rewind', fate: 'fate', nirvana: 'phoenix' };
const NAT_OF = id => NAT_OF64[id] || (SPECIES2.find(s => s.id === id) || {}).nat || null;

// 通用效果：give = 这只蛊会挂上 / 做出，use = 这只蛊专门吃这一种（条件里读它，或靠 inflict / allyInflict 接）
const KW = { psn: '毒', burn: '灼', chill: '寒', guard: '护', summon: '召', eat: '吞', knock: '击退', mark: '标记' };
function kwOf(list) {
  const give = new Set(), use = new Set();
  for (const e of list) {
    if (e.op === 'st' && KW[e.k]) give.add(e.k);
    if (e.op === 'shield') give.add('guard');
    if (e.op === 'summon') give.add('summon');
    if (e.op === 'eat') { give.add('eat'); use.add('summon'); }
    if (e.op === 'knock' || e.op === 'draw') give.add('knock');
    const c = String(e.if || '');
    for (const k of ['psn', 'burn', 'chill', 'mark', 'guard', 'summon']) if (c.includes('tg.' + k) || c.includes('k=' + k)) use.add(k);
    if (e.when === 'summon') use.add('summon');
  }
  return { give: [...give], use: [...use] };
}
const KW120 = Object.fromEntries(Object.keys(DAO120).map(id => {
  const t = NATS[NAT_OF(id)] || {}, a = ACTS[id];
  return [id, kwOf([...(t.eff || []), ...(t.awEff || []).flat(), ...(a ? [...a.eff, ...a.aw.flat()] : [])])];
}));

return { NAT_UP, natK, natText, NATS, ACTS, ACT_COUNT, SPECIES2, SUMMONS2, ST_GROW, ST120, PATCH64, BATTLE120, DAO120, CANON, NAT_OF, KW, KW120 };
})();
// ---- src/combos2.js（包一层，只放出 export）
const { COMBOS2, COMBO2, COMBO_POWER, COMBO_UP, COMBO_SUMMONS } = (() => {
// 蛊码 GuCode · 杀招 v2 第三版（docs/design.md 第 1 节「羁绊分三层」第二、三层 + 2.6 节；格式按 docs/battle-spec.md 7.3）。纯数据，不 import 任何文件。
// 成形：need 里的物种同时在空窍。core = 核心蛊，一律写在 need 第一位：品级看它的转数，所属的道跟它走，杀招挂在站得最靠前的那只核心蛊身上由它释放。
// 一大半杀招由不同道的蛊组成，靠通用效果互相接力：毒、灼、寒、护、召、吞、击退、标记谁都能挂、谁都能读（battle-spec 4.2 / 5.1）。
// 威力倍率（引擎算，见 COMBO_POWER）：(1 + 0.15 × (核心转数 − 1)) × (1 + 0.2 × 共鸣档)，共鸣档 = 核心那一道 2 只 → 1、4 只 → 2，相冲打折后按比例。
// 倍率乘的是攻、血、护体、伤害、治疗、增减益、召唤物攻血这些数值；层数、轮数、吞的门槛（eat 的 v/gain）、行动条推后量不乘。
// 进阶杀招：from = 原杀招 id，need 写全（原配方 + 一两只），成形后取代原杀招，仍属原来那一道。
// 单个效果可以自带 when，覆盖杀招的 when（一招里分两个时机）。fx = 给战斗专家的动画构思：c 主色，d 画面、节奏和镜头，每招各不相同。
// canon: true = 原著里的杀招名（描述是蛊码自己写的）；其余名字是蛊码自起。导出名用 COMBOS2，避免和 core.js 里旧的 COMBOS 重名。
const K = (id, n, need, when, d, eff, fx, extra = {}) => ({ id, n, need, core: need[0], when, d, eff, fx, ...extra });
const E = (op, tg, o = {}) => ({ op, tg, ...o });
const COMBOS2 = [
  // ====== 力道 ======
  K('sanzhu', '烈火三豕冲', ['boar', 'fire', 'twin'], 'start', '开战：白豕带着火影冲阵，敌方最前那一列各受攻击 50%，灼烧 2 轮（攻击 15%）',
    [E('dmg', 'foe.front', { shape: 'col', atk: 0.5 }), E('st', 'same', { k: 'burn', n: 2, atk: 0.15 })],
    { c: ['#b5301f', '#e08a3a'], d: '镜头贴地，三道火影一行一道同时冲向敌方前列，撞上时横向震屏，地面留下三道焦痕；最后定格半拍再出招式名' }),
  K('huangzai', '蝗过千里', ['locust', 'boar'], 'attack', '普攻后蝗群越过前排：敌方后排各受这一下的 35%',
    [E('dmg', 'foe.last', { shape: 'back', n: 0.35 })],
    { c: ['#7a6a2a', '#3a3a1a'], d: '黑压压的蝗群从我方头顶掠过敌方前排，像泼墨一样落进后排，沙沙声密集，落过的地面草色褪黄；镜头跟着蝗群横摇' }),
  K('wanwo', '万我', ['xiongli', 'twin'], 'start', '开战：熊力分出两道力影站到身后（各本蛊攻血 30%）；之后每有友蛊被召唤，本蛊攻 +4%（最多 6 次）',
    [E('summon', 'self', { sp: 'shade', atk: 0.3, mx: 0.3, at: 'behind', count: 2 }), { when: 'summon', ...E('buff', 'self', { atk: 0.04, max: 6 }) }],
    { c: ['#8a3a1f', '#e8c08a'], d: '熊力蛊一跺脚，身后叠出两道半透明的同形力影，三个身影同时握拳，镜头从侧面拉远显出一排一模一样的背影' }, { canon: true }),
  K('tunshi', '饕餮吞毒', ['glut', 'toad'], 'attack', '普攻打中毒的敌蛊：它血量不过 45% 就整只吞下，得到它四成攻血',
    [E('eat', 'tg', { v: 0.45, gain: 0.4, if: 'tg.psn' })],
    { c: ['#6a4a2a', '#4f7a3a'], d: '饕虫张开大得不成比例的嘴，连目标带一团绿色毒雾整个吸进去，腮帮鼓两下，打一个冒绿泡的嗝' }),
  // ====== 炎道 ======
  K('fenshen', '焚身诀', ['fire', 'mantis'], 'kill', '击杀时火势炸开：最近的敌蛊和它周围一圈各受攻击 40%，灼烧 2 轮（攻击 15%）',
    [E('dmg', 'foe.front', { shape: 'ring', atk: 0.4 }), E('st', 'same', { k: 'burn', n: 2, atk: 0.15 })],
    { c: ['#d0632a', '#7a1a10'], d: '被击杀的敌蛊原地燃成火球，停 0.3 秒后爆成放射状火舌扑向下一只敌蛊和它四周，镜头先拉远再快速回正' }),
  K('liaoyuan', '天火燎原', ['scorp', 'fire'], 'start', '开战：火毒齐下，敌方全体灼烧 2 轮（攻击 12%），并中毒（攻击 8%）',
    [E('st', 'foe.all', { k: 'burn', n: 2, atk: 0.12 }), E('st', 'foe.all', { k: 'psn', atk: 0.08 })],
    { c: ['#d0632a', '#4f7a3a'], d: '蝎尾向天一甩，毒针在半空被流火点着，化作一场绿芯红焰的火雨落满敌阵，火苗烧成绿色才熄' }),
  K('lieyang', '烈阳焚野', ['flint', 'solar', 'fireant'], 'round', '单数轮开始：燧石借烈日引火，敌方全体灼烧 2 轮（攻击 15%）；燧火会跟着每一处起火补一下',
    [E('st', 'foe.all', { k: 'burn', n: 2, atk: 0.15, if: 'round%2' })],
    { c: ['#f0b03a', '#d0632a'], d: '画面上方缓缓升起一轮金白日轮，光线像针一样一根根落下，敌阵地面从边缘泛起热浪，最后整片燃起矮矮的火苗；日轮升起用 1 秒，火苗一瞬铺满' }),
  K('dihuo', '地火焚城', ['magma', 'mole'], 'round', '每 2 轮：蝼蛄打通地脉，地火从敌方后排喷出：后排各受本蛊最大血量 6%，灼烧 2 轮（攻击 15%）',
    [E('dmg', 'foe.last', { shape: 'back', mx: 0.06, every: 2 }), E('st', 'same', { k: 'burn', n: 2, atk: 0.15, every: 2 })],
    { c: ['#c0401a', '#5a3a20'], d: '敌方后排脚下先鼓起几道裂纹，停一拍后岩浆柱一根接一根喷上天；镜头从地底往上仰拍，岩浆落回时溅起黑烟' }),
  // ====== 冰雪道 ======
  K('bingfeng', '冰火两重', ['frost', 'fire'], 'attack', '普攻命中：目标身上带着寒时冰火相激，再受攻击 40%；然后目标灼烧 2 轮（攻击 20%）',
    [E('dmg', 'tg', { atk: 0.4, if: 'tg.chill' }), E('st', 'tg', { k: 'burn', n: 2, atk: 0.2 })],
    { c: ['#6a9cc0', '#d0632a'], d: '画面从中间一分为二，左半边结霜变蓝、右半边起火变红，两股气流在目标身上拧成一根冰火螺旋柱，碎开时冰渣和火星一起溅出；分屏对称构图' }),
  K('hanchuan', '寒川锁江', ['glacier', 'icesnail', 'strider'], 'start', '开战：寒流封江，敌方最前那一列各寒 2 层，敌方全体速 -10%',
    [E('st', 'foe.front', { shape: 'col', k: 'chill', n: 2 }), E('buff', 'foe.all', { spd: -0.1 })],
    { c: ['#a8c8e0', '#ffffff'], d: '镜头俯拍，冰线从我方脚下向敌阵蔓延，所到之处裂出六角冰纹，水黾在冰面上划出两道白痕，敌方前列被冰柱从下往上包住；全程只有冰裂的脆响' }),
  K('xuebeng', '雪崩', ['hail', 'moveshan'], 'round', '每 2 轮：雪崩压向敌方最前那一列：各受攻击 35%，寒 1 层，并被推后一格（撞上后面的蛊，两只都受伤）',
    [E('dmg', 'foe.front', { shape: 'col', atk: 0.35, every: 2 }), E('st', 'same', { k: 'chill', n: 1, every: 2 }), E('knock', 'same', { v: 1, every: 2 })],
    { c: ['#e8f0f8', '#6a5a4a'], d: '画面上方的雪坡整块崩落，夹着山石的雪浪横着推过敌方前列，被推后的蛊撞成一团，雪雾久久不散' }),
  // ====== 金道 ======
  K('jinjia', '金甲不坏身', ['iron', 'thorn'], 'start', '开战：铜皮蛊得到最大血量 30% 的护体，接下来 3 次受伤减半；同一列的友蛊各得本蛊最大血量 10% 的护体',
    [E('shield', 'self', { mx: 0.3 }), E('st', 'self', { k: 'guard', n: 3 }), E('shield', 'ally.col', { mx: 0.1 })],
    { c: ['#a8803e', '#e8c76a'], d: '一片片金色甲叶从四周飞来，咔咔咔逐片扣到铜皮蛊身上（每片 0.08 秒），扣满后金光沿着这一列扫过去，镜头绕它转半圈' }),
  K('tuibao', '金蟾吐宝', ['jinchan', 'qingfu'], 'kill', '击杀：金蟾吐出一串青蚨钱，全体友蛊攻血 +6%（每场最多 4 次）',
    [E('buff', 'ally.all', { atk: 0.06, hp: 0.06, max: 4 })],
    { c: ['#d9a441', '#4a8a6a'], d: '金蟾鼓起腮帮吐出一串铜钱，铜钱在空中化作一只只青蚨飞向友蛊，落到身上叮一声变成金光' }),
  K('tiesuo', '铁索横江', ['lockarm', 'vine'], 'start', '开战：铁索连起上下左右的友蛊，它们各挂「护」2 次；另一头把敌方后排拽近一格（被挡住就撞上，两只都受伤）',
    [E('st', 'ally.adj', { k: 'guard', n: 2 }), E('draw', 'foe.last', { shape: 'back', v: 1, bump: 0.5 })],
    { c: ['#7a7a80', '#5e8a4a'], d: '锁甲蛊身上甩出几条铁链，一头扣住身边友蛊连成一片，另一头缠着青藤飞向敌方后排猛地一拽，铁链绷直时声音很脆' }),
  // ====== 木道 ======
  K('pojian', '破茧成蝶', ['silk', 'bfly'], 'round', '第 3 轮开始破茧时双蝶齐飞：同一列的友蛊攻血 +15%，本蛊速 +20%（只一次）',
    [E('buff', 'ally.col', { atk: 0.15, hp: 0.15, if: 'round>=3', max: 1 }), E('buff', 'self', { spd: 0.2, if: 'round>=3', max: 1 })],
    { c: ['#5e8a4a', '#e8d8f0'], d: '茧壳先裂开一道细缝透出淡紫光，茧片一片片剥落飘走，两只蝶一前一后飞出，沿着这一列洒下一道光粉；整段慢镜头，配极轻的丝帛撕裂声' }),
  K('burou', '肉身不朽', ['taisui', 'cicada'], 'lethal', '太岁再受致命伤也不倒：留六成血重新长出来（每场一次，和本命的再生分开算）',
    [E('endure', null, { v: 0.6, max: 1 })],
    { c: ['#7a9a5a', '#c0a080'], d: '太岁被打碎成几块肉团摊在地上，镜头特写，肉团像倒放一样蠕动着彼此吸回去重新拼成原形，表面冒出一层新芽般的绿纹；先停 0.5 秒制造悬念再快速倒放' }),
  // ====== 土道 ======
  K('xuanwu', '玄武镇关', ['tortoise', 'gecko'], 'round', '每轮开始：玄龟站在最前时，自己得到最大血量 8% 的护体，身后的友蛊各得 4%',
    [E('shield', 'self', { mx: 0.08, if: 'front' }), E('shield', 'ally.behind', { mx: 0.04, if: 'front' })],
    { c: ['#4a5a4a', '#8a6a3a'], d: '玄龟背后浮现一座墨色山影，山影向下一沉压进龟壳，龟壳纹路亮起土黄色的光，再顺着这一行往后铺开；镜头仰拍，龟像一座关隘' }),
  K('banshan', '搬山移海', ['moveshan', 'rhino'], 'start', '开战：把敌方最前那只搬到它那一行的最后一格（和那里的蛊对调），被搬走的先受攻击 60%',
    [E('dmg', 'foe.front', { atk: 0.6 }), E('swap', 'same', { with: 'back' })],
    { c: ['#8a6a3a', '#4a3a2a'], d: '地面隆起一块巨石，把敌方最前那只整只托起，沿抛物线扔到它那一行的末尾，落地砸出一圈土浪；镜头跟着巨石大幅横摇，落地时轻微震屏' }),
  // ====== 雷道 ======
  K('leigu', '雷鼓破天', ['thunder', 'drum'], 'attack', '普攻后鼓声引雷：目标和它十字范围各受这一下的 30%',
    [E('dmg', 'tg', { shape: 'cross', n: 0.3 })],
    { c: ['#3a6aa8', '#ffffff'], d: '雷甲蛊背上浮出一面雷鼓，敲一下，白蓝电弧从目标身上向上下左右四个方向同时炸开，画面闪白一帧；干脆利落，没有余韵' }),
  K('jiutian', '九天引雷', ['dfly', 'firefly'], 'round', '单数轮开始：萤火先给敌方攻最高的蛊打上标记（2 轮），雷随即从天而降，敌方全体受攻击 25%',
    [E('st', 'foe.top', { k: 'mark', n: 2, if: 'round%2' }), E('dmg', 'foe.all', { atk: 0.25, if: 'round%2' })],
    { c: ['#5a8ad0', '#e8e070'], d: '画面先暗下来，一点萤火飞到敌方主力头顶停住当作标记，随即数道竖直落雷同时劈下，整屏闪白两帧；镜头从仰拍天空切到俯拍敌阵' }),
  K('chunlei', '春雷乍惊', ['jingzhe', 'shengji'], 'start', '开战：一声春雷，敌方随机两只眩晕一次；万物惊醒，全体友蛊蛊力 +20',
    [E('st', 'foe.rand:2', { k: 'stun', n: 1 }), E('gp', 'ally.all', { v: 20 })],
    { c: ['#6a8ac0', '#9ac070'], d: '天边滚过一道横向的闷雷光带，我方脚下冒出一片嫩绿草芽，被震到的两只敌蛊头顶出现转圈的小星；声音先低后炸，用一次远景交代天地' }),
  K('cishi', '磁石引铁', ['magstorm', 'lockarm'], 'round', '每 2 轮：磁暴把敌方最靠后的蛊吸近两格（被挡住就撞上，两只都受伤），再让它眩晕一次',
    [E('draw', 'foe.last', { v: 2, bump: 0.5, every: 2 }), E('st', 'same', { k: 'stun', n: 1, every: 2 })],
    { c: ['#5a4ab0', '#a0a0a8'], d: '磁暴蛊身上浮起一圈紫色磁力线，敌方后排那只被吸得一路滑过来，撞上东西时迸出一串蓝白火花，最后贴在半空抽搐一下' }),
  // ====== 光道 ======
  K('liuying', '流萤焚夜', ['firefly', 'fire'], 'death', '小光蛊倒下时化作满天流萤：敌方全体受攻击 50%，灼烧 2 轮（攻击 10%）',
    [E('dmg', 'foe.all', { atk: 0.5 }), E('st', 'same', { k: 'burn', n: 2, atk: 0.1 })],
    { c: ['#e7d77a', '#1c1915'], d: '画面转入夜色，小光蛊散成上百个光点慢慢升空，悬停一拍后像流星雨一样斜着落进敌阵，每个光点落地开出一朵小火花；慢开快收' }),
  K('jinghua', '镜花水月', ['mirror', 'lure'], 'hit', '镜甲被打中：照回这一下的 40% 给打它的那只（普攻也算，每场最多 8 次）',
    [E('dmg', 'src', { n: 0.4, max: 8 })],
    { c: ['#c0d8e8', '#e8a0c0'], d: '镜甲身前竖起一面水波纹镜面，来袭的攻击在镜面上荡开涟漪后原路折返，镜中倒映出一朵虚花又碎掉；镜头与镜面平行，左右对称' }),
  K('shishan', '尸山月影', ['moth', 'bone'], 'death', '月蛾倒下时，原地召出一只月影（本蛊攻 50%、血 40%）',
    [E('summon', 'self', { sp: 'lunar', atk: 0.5, mx: 0.4, at: 'here' })],
    { c: ['#c8c0e8', '#3a3346'], d: '月蛾倒下处的白骨堆上升起一轮小小的白月，月光里慢慢凝出一只半透明的蛾影，落地时地面结一圈白霜' }),
  K('richu', '日出扶桑', ['solar', 'fusang'], 'round', '每轮开始：全体友蛊回复最大血量 4%；单数轮金乌出扶桑，敌方全体再灼烧 2 轮（攻击 12%）',
    [E('heal', 'ally.all', { tmx: 0.04 }), E('st', 'foe.all', { k: 'burn', n: 2, atk: 0.12, if: 'round%2' })],
    { c: ['#f0b03a', '#5e8a4a'], d: '画面左侧立起一棵金色扶桑树影，一轮红日从枝头升起，阳光扫过友蛊是暖金色，落到敌阵就变成火苗' }),
  // ====== 暗道 ======
  K('duopo', '噬心夺魄', ['mantis', 'scorp'], 'kill', '击杀后立刻扑向敌方血量比例最低的蛊，造成攻击 90% 的伤害（每场最多 3 次）',
    [E('dmg', 'foe.lowp', { atk: 0.9, max: 3 })],
    { c: ['#3a3346', '#8a1f2b'], d: '螳螂击杀后身形化作一道暗红残影，一帧闪到下一只敌蛊身前出刀，残影在原地慢慢散去；只用两种颜色，节奏是「顿—闪」' }),
  K('yeshi', '天狗食月', ['eclipse', 'moth'], 'start', '开战：月被吞尽、天色骤暗，敌方全体打上标记 2 轮，最靠后的那只先受攻击 70%',
    [E('st', 'foe.all', { k: 'mark', n: 2 }), E('dmg', 'foe.last', { atk: 0.7 })],
    { c: ['#1c1915', '#c0c0d0'], d: '一个黑影从右上角滑入一口口啃掉月亮，整屏只剩一圈银白月晕，敌蛊身上一个个亮起印记，最后一只被从阴影里伸出的爪子拍中；全段压暗，只有高光' }),
  K('zuisheng', '醉生梦死', ['sleep', 'jiuchong'], 'start', '开战：酒香混着催眠粉飘过去，敌方最前那一列各眩晕一次',
    [E('st', 'foe.front', { shape: 'col', k: 'stun', n: 1 })],
    { c: ['#c09060', '#6a5a8a'], d: '酒虫打个酒嗝，一团带甜味的粉紫色雾气慢悠悠飘向敌方前列，被熏到的蛊一个个东倒西歪，头顶冒出小酒泡' }),
  // ====== 血道 ======
  K('xuehe', '血河蟒', ['xueyue', 'leech', 'hairy'], 'round', '每 2 轮：血河化作巨蟒，贯穿敌方最近的那一整行：各受攻击 60%，并中毒（攻击 10%）；本蛊吸回造成伤害的一半',
    [E('dmg', 'foe.front', { shape: 'row', atk: 0.6, steal: 0.5, every: 2 }), E('st', 'same', { k: 'psn', atk: 0.1, every: 2 })],
    { c: ['#8a1f2b', '#4f7a3a'], d: '地面裂开一道暗红血河，一条血色巨蟒从河里昂首冲出，贴着敌方那一行横穿过去，蟒身带起的血浪泛着绿光' }, { canon: true }),
  K('baichong', '百虫入瓮', ['urn', 'bone'], 'start', '开战：瓮王得到最大血量 25% 的护体；倒下时瓮里的百虫破瓮而出，原地召出两只蛊蛹（各本蛊攻血 35%）',
    [E('shield', 'self', { mx: 0.25 }), { when: 'death', ...E('summon', 'self', { sp: 'pupa', atk: 0.35, mx: 0.35, at: 'here', count: 2 }) }],
    { c: ['#6a3a2a', '#c0a080'], d: '瓮王身上的釉面泛起一层暗光；倒下时瓮身裂成几瓣，里面的虫影哗地涌出又缩成两只蛊蛹，瓮片在地上转几圈才停' }),
  K('xueshen', '血神子', ['chiba', 'twin'], 'start', '开战：赤魃滴血化出两只血神子站到后排（各本蛊攻血 30%）；之后每有友蛊倒下，敌方全体受攻击 12%（每场最多 4 次）',
    [E('summon', 'self', { sp: 'xueshen', atk: 0.3, mx: 0.3, at: 'back', count: 2 }), { when: 'allyDeath', ...E('dmg', 'foe.all', { atk: 0.12, max: 4 }) }],
    { c: ['#a01828', '#1c1915'], d: '赤魃指尖滴下两滴血，落地即长成两个小小的血色人形，眼睛亮起红光，向后一跃站进后排；有友蛊倒下时血色从地面漫向敌阵' }, { canon: true }),
  // ====== 毒道 ======
  K('wudu', '五毒噬心', ['cent', 'scorp'], 'round', '每轮开始：敌方全体中毒（攻击 7%，可叠）',
    [E('st', 'foe.all', { k: 'psn', atk: 0.07 })],
    { c: ['#4f7a3a', '#6a3a7a'], d: '蜈蚣、蝎子的墨影绕着敌阵爬一圈，爬过的地方冒起紫绿色毒泡，泡泡一个个破开散成毒雾；俯视构图，绕圈由慢到快' }),
  K('shidu', '尸毒瘴', ['toad', 'fly'], 'allyDeath', '有蛊倒下（敌我都算）：尸气化成瘴，敌方全体中毒（攻击 6%）（敌我各最多 6 次）',
    [E('st', 'foe.all', { k: 'psn', atk: 0.06, max: 6 }), { when: 'foeDeath', ...E('st', 'foe.all', { k: 'psn', atk: 0.06, max: 6 }) }],
    { c: ['#5a6a3a', '#3a2a3a'], d: '倒下的蛊身上升起灰绿色尸气，尸蝇嗡嗡绕着飞一圈，毒蟾鼓腹一吹，瘴气贴着地面漫进敌阵' }),
  K('tixian', '提线百傀', ['puppet', 'hairworm'], 'foeDeath', '敌蛊倒下（谁打死的都算）：铁线钻进它的身子，牵丝做成我方傀儡站到后排（本蛊攻血 40%，每场最多 2 只）',
    [E('summon', 'self', { sp: 'kuilei', atk: 0.4, mx: 0.4, at: 'back', max: 2 })],
    { c: ['#8a3030', '#d8d0c0'], d: '一根细铁线从倒下的敌蛊身上钻进去，画面顶端随即垂下几根红丝把它吊起，像木偶一样晃两下后转身，眼睛换成我方的颜色；镜头仰拍丝线来处' }),
  // ====== 智道 ======
  K('tianluo', '天罗地网', ['webspider', 'spider'], 'start', '开战：敌方最前那一列落网 1 次；之后每有友蛊被召唤，敌方最近的那只再落网 1 次（最多 3 次）',
    [E('st', 'foe.front', { shape: 'col', k: 'web', n: 1 }), { when: 'summon', ...E('st', 'foe.front', { k: 'web', n: 1, max: 3 }) }],
    { c: ['#d8d0c0', '#1c1915'], d: '一张巨大的蛛网从画面上方垂落，四角钉进地面罩住敌方前列；之后每落地一只小蛛，网上就多拉一根亮丝' }),
  K('suanwu', '算无遗策', ['diting', 'hex'], 'start', '开战：听出敌方攻最高的那只，它攻 -20%（3 轮），3 轮内蛊力不涨',
    [E('buff', 'foe.top', { atk: -0.2, dur: 3 }), E('st', 'same', { k: 'seal', n: 3 })],
    { c: ['#3d5a8a', '#e8e0c0'], d: '地听草的肉耳贴地一颤，画面浮出一块半透明棋盘，棋子啪啪落下几步，最后一子落在敌方主力头顶，一圈算筹缠上它；节奏像落子，配算珠声' }),
  // ====== 魂道 ======
  K('tuoke', '金蝉脱壳', ['cicada', 'twin'], 'lethal', '金蝉受到致命伤时留下空壳，本体以五成血脱身（每场一次）',
    [E('endure', null, { v: 0.5, max: 1 })],
    { c: ['#c8a040', '#efe7d4'], d: '致命一击打中后画面定格，金蝉背部裂开，一只半透明的本体钻出飞到一旁，原地只剩一个金色空壳被打碎；用一次快速的镜头位移交代人已不在原地' }),
  // ====== 奴道 ======
  K('wangu', '万蛊朝宗', ['queen', 'bone'], 'start', '开战：后排召出一只蛊蛹（本蛊攻血 25%）；之后每有友蛊被召唤，全体友蛊攻血 +3%（最多 6 次）',
    [E('summon', 'self', { sp: 'pupa', atk: 0.25, mx: 0.25, at: 'back' }), { when: 'summon', ...E('buff', 'ally.all', { atk: 0.03, hp: 0.03, max: 6 }) }],
    { c: ['#d9a441', '#3a3346'], d: '蜂王振翅，画面四角的虫影一齐朝它俯首，后排地面裂开钻出一只蛊蛹；之后每多一只召唤物，王冠就亮一层' }),
  K('baiyi', '百蚁噬象', ['qant', 'ant'], 'start', '开战：蚁后再召两只兵蚁站到后排（各本蛊攻血 25%）',
    [E('summon', 'self', { sp: 'antling', atk: 0.25, mx: 0.25, at: 'back', count: 2 })],
    { c: ['#9a4a2c', '#1c1915'], d: '地面裂开一个蚁穴口，兵蚁排成一列从洞里钻出，沿弧线跑进我方后排站好；镜头低角度，兵蚁由小变大，最后一只落位时轻轻一顿' }),
  K('qunfeng', '群蜂蛰毒', ['hive', 'wasp'], 'summon', '每有友蛊被召唤：随机一只敌蛊被蜂群蛰中，中毒（攻击 10%）（每场最多 8 次）',
    [E('st', 'foe.rand', { k: 'psn', atk: 0.1, max: 8 })],
    { c: ['#e0a020', '#4f7a3a'], d: '蜂巢口涌出一股金黄色蜂群，像一条丝带绕过前排扎进某只敌蛊，被蛰的地方鼓起一个绿色的包' }),
  // ====== 宇道 ======
  K('yixing', '移形换影', ['flea', 'mole'], 'round', '每 2 轮：跳蚤和最前的友蛊换位，被换下的友蛊挂「护」1 次；跳到最前时钻地突袭敌方后排，各受攻击 40%（最多 2 次）',
    [E('swap', 'ally.front', { with: 'self', every: 2 }), E('st', 'same', { k: 'guard', n: 1, every: 2 }), { when: 'front', ...E('dmg', 'foe.last', { shape: 'back', atk: 0.4, max: 2 }) }],
    { c: ['#4a8a86', '#8a6a3a'], d: '跳蚤一弹就和前面的友蛊对调位置，留下一圈残影；落到最前时一头扎进土里，敌方后排脚下同时拱起土包' }),
  K('zhichi', '咫尺天涯', ['blink', 'instant'], 'start', '开战：瞬移蛊一步跨过战场，敌方后排各受攻击 50%，行动条推后 20%',
    [E('dmg', 'foe.last', { shape: 'back', atk: 0.5 }), E('delay', 'same', { v: 0.2 })],
    { c: ['#4a8a86', '#ffffff'], d: '画面像纸一样被折了一下，瞬移蛊从原地消失、同一帧出现在敌方后排身后，刀光一闪再折回原位，前后不到半秒' }),
  // ====== 宙道 ======
  K('yiri', '一日千秋', ['mayfly', 'bfly'], 'death', '蜉蝣倒下时，全体友蛊攻血 +15%',
    [E('buff', 'ally.all', { atk: 0.15, hp: 0.15 })],
    { c: ['#d8c890', '#8a7a3a'], d: '蜉蝣倒下的瞬间背景的日影飞快地从东走到西，光影在全队身上扫过一遍，友蛊身上留下淡金色年轮纹；延时摄影般的快进节奏' }),
  K('chana', '刹那芳华', ['instant', 'flea'], 'start', '开战：时间一停，刹那蛊对最近的敌蛊连斩两刀（各攻击 60%）',
    [E('dmg', 'foe.front', { atk: 0.6, times: 2 })],
    { c: ['#8a7a3a', '#ffffff'], d: '全屏瞬间褪成黑白、所有动作停住，只有刹那蛊保持彩色连出两刀，颜色恢复时两道伤害数字同时跳出' }),
  K('niliu', '逆流护身印', ['hourglass', 'mirror'], 'start', '开战：全体友蛊挂「护」1 次；每 3 轮：血量比例最低的友蛊清掉减益、挂「护」2 次',
    [E('st', 'ally.all', { k: 'guard', n: 1 }), { when: 'round', ...E('cleanse', 'ally.lowp', { every: 3 }) }, { when: 'round', ...E('st', 'same', { k: 'guard', n: 2, every: 3 }) }],
    { c: ['#8a7a3a', '#c0d8e8'], d: '一道倒着流的光河绕全队一圈，水纹往上涌，凝成一枚半透明的印落在每只友蛊额头；之后每 3 轮那枚印逆转一次，伤得最重的那只身上的污迹倒流回地面' }, { canon: true }),

  // ====== 进阶杀招（原杀招 + 一两只，成形后取代原杀招） ======
  K('sanzhu2', '焚原三豕', ['boar', 'fire', 'twin', 'locust'], 'start', '开战：火影与蝗群一起冲阵：敌方最前那一列各受攻击 70%、灼烧 2 轮（攻击 20%），后排各受攻击 30%',
    [E('dmg', 'foe.front', { shape: 'col', atk: 0.7 }), E('st', 'same', { k: 'burn', n: 2, atk: 0.2 }), E('dmg', 'foe.last', { shape: 'back', atk: 0.3 })],
    { c: ['#b5301f', '#e08a3a', '#3a3a1a'], d: '三道火影后面跟着一大片蝗群，火借风势把蝗群点成一道火墙横扫敌阵，镜头被火墙推着后退，收尾一整排焦土' }, { from: 'sanzhu' }),
  K('jinjia2', '万钧金身', ['iron', 'thorn', 'yupi'], 'start', '开战：铜皮蛊得到最大血量 45% 的护体，接下来 5 次受伤减半，同一列的友蛊各得 15%；之后被近战打中，扎回这一下的 25%',
    [E('shield', 'self', { mx: 0.45 }), E('st', 'self', { k: 'guard', n: 5 }), E('shield', 'ally.col', { mx: 0.15 }), { when: 'hit', ...E('dmg', 'src', { n: 0.25, if: 'melee' }) }],
    { c: ['#a8803e', '#e8c76a', '#d8e8d0'], d: '金甲扣满后，玉皮蛊的玉色从甲缝里渗出来，整身变成金玉两色并长出细刺，镜头绕满一整圈正面定格，地面裂纹比原版大一倍' }, { from: 'jinjia' }),
  K('pojian2', '化蝶三生', ['silk', 'bfly', 'fusang'], 'round', '第 2 轮开始就破茧：同一列的友蛊攻血 +20%，本蛊速 +25%，全体友蛊回复最大血量 20%（只一次）',
    [E('buff', 'ally.col', { atk: 0.2, hp: 0.2, if: 'round>=2', max: 1 }), E('buff', 'self', { spd: 0.25, if: 'round>=2', max: 1 }), E('heal', 'ally.all', { tmx: 0.2, if: 'round>=2', max: 1 })],
    { c: ['#5e8a4a', '#e8d8f0', '#f0c050'], d: '破茧时背后长出一棵金色扶桑树影，双蝶绕树三圈，每圈洒下一层金粉落到友蛊身上；比原版多一段绕树的环形镜头' }, { from: 'pojian' }),
  K('xuanwu2', '玄武负山', ['tortoise', 'gecko', 'yue'], 'round', '每轮开始：玄龟站在最前时得到 12% 护体、身后的友蛊各 6%，并嘲讽敌方（到下一轮）',
    [E('shield', 'self', { mx: 0.12, if: 'front' }), E('shield', 'ally.behind', { mx: 0.06, if: 'front' }), E('st', 'self', { k: 'taunt', n: 2, if: 'front' })],
    { c: ['#4a5a4a', '#8a6a3a', '#b5301f'], d: '山影压进龟壳后，镇岳蛊在后方升起一座更高的峰，两座山影叠成一个「山」字，龟身前插起一面红色挑战旗；仰拍加慢推' }, { from: 'xuanwu' }),
  K('leigu2', '雷霆万钧', ['thunder', 'drum', 'magstorm'], 'attack', '普攻后雷鼓连响：目标和它十字范围各受这一下的 40%，20% 机会全部眩晕一次',
    [E('dmg', 'tg', { shape: 'cross', n: 0.4 }), E('st', 'same', { k: 'stun', n: 1, chance: 0.2 })],
    { c: ['#3a6aa8', '#ffffff', '#a0a0ff'], d: '雷鼓连敲三下，磁暴蛊在敌阵上空张开一张紫色电网，电弧顺着十字同时跳动，闪白三帧；比原版多一个电网的俯视镜头' }, { from: 'leigu' }),
  K('jiutian2', '九霄雷劫', ['dfly', 'firefly', 'jiuxiao'], 'round', '单数轮开始：攻最高的两只敌蛊打上标记（2 轮），九道雷劫落下，敌方全体受攻击 40%，20% 机会全部眩晕一次',
    [E('st', 'foe.top:2', { k: 'mark', n: 2, if: 'round%2' }), E('dmg', 'foe.all', { atk: 0.4, if: 'round%2' }), E('st', 'same', { k: 'stun', n: 1, chance: 0.2, if: 'round%2' })],
    { c: ['#5a8ad0', '#e8e070', '#d9a441'], d: '天幕裂开九道金色裂缝，萤火标记之后九道雷柱依次落下（间隔 0.06 秒），最后一道最粗、带金边；从仰拍一路摇到俯拍' }, { from: 'jiutian' }),
  K('wudu2', '万毒归宗', ['cent', 'scorp', 'toad', 'cordy'], 'round', '每轮开始：敌方全体中毒（攻击 10%，可叠），攻最高的那只已中毒时再受攻击 30%',
    [E('st', 'foe.all', { k: 'psn', atk: 0.1 }), E('dmg', 'foe.top', { atk: 0.3, if: 'tg.psn' })],
    { c: ['#4f7a3a', '#6a3a7a', '#1c1915'], d: '几种毒虫的墨影和一株虫草从四面爬向敌阵中心，在攻最高的那只头顶汇成一个旋转的毒环，收紧后炸成绿紫色的雾；对称构图，越汇越急' }, { from: 'wudu' }),
  K('bingfeng2', '冰火同炉', ['frost', 'fire', 'magma', 'hail'], 'attack', '普攻命中：目标带着寒时再受攻击 50%；然后目标灼烧 2 轮（攻击 25%），它和十字范围各寒 1 层',
    [E('dmg', 'tg', { atk: 0.5, if: 'tg.chill' }), E('st', 'tg', { k: 'burn', n: 2, atk: 0.25 }), E('st', 'tg', { shape: 'cross', k: 'chill', n: 1 })],
    { c: ['#6a9cc0', '#d0632a', '#7a1a10'], d: '冰火螺旋柱成形后，地下涌出岩浆、天上砸下冰雹，冰与火在目标头顶撞成一只炉鼎的形状再炸开；分屏构图收拢成一个圆' }, { from: 'bingfeng' }),
  K('baiyi2', '火蚁燎原', ['qant', 'ant', 'fireant'], 'start', '开战：蚁后召三只兵蚁站到后排（各本蛊攻血 25%）；之后每有友蛊被召唤，随机一只敌蛊被火蚁咬中，灼烧 2 轮（攻击 12%）（最多 8 次）',
    [E('summon', 'self', { sp: 'antling', atk: 0.25, mx: 0.25, at: 'back', count: 3 }), { when: 'summon', ...E('st', 'foe.rand', { k: 'burn', n: 2, atk: 0.12, max: 8 }) }],
    { c: ['#9a4a2c', '#e05a1a'], d: '蚁穴口喷出一串火星，兵蚁一只只背着小火苗钻出来，红色的蚁流分出几股窜进敌阵，被咬过的地方冒起一缕青烟' }, { from: 'baiyi' }),
  K('suanwu2', '算尽天机', ['diting', 'hex', 'zhihui'], 'start', '开战：敌方攻最高的那只攻 -25%（3 轮）、3 轮内蛊力不涨；敌方全体打上标记 2 轮，全体友蛊蛊力 +25',
    [E('buff', 'foe.top', { atk: -0.25, dur: 3 }), E('st', 'same', { k: 'seal', n: 3 }), E('st', 'foe.all', { k: 'mark', n: 2 }), E('gp', 'ally.all', { v: 25 })],
    { c: ['#3d5a8a', '#e8e0c0', '#f0f0ff'], d: '棋盘铺开后，智慧蛊的光从上方照下，整张棋盘变成透明的星图，每只敌蛊头上亮一颗星、被连成一张网；全段安静，只有落子声' }, { from: 'suanwu' }),
  K('richu2', '凤栖扶桑', ['solar', 'fusang', 'nirvana'], 'round', '每轮开始：全体友蛊回复最大血量 6%；单数轮敌方全体灼烧 2 轮（攻击 18%）；有友蛊倒下时凤鸣一声，全体友蛊回复 15%（最多 2 次）',
    [E('heal', 'ally.all', { tmx: 0.06 }), E('st', 'foe.all', { k: 'burn', n: 2, atk: 0.18, if: 'round%2' }), { when: 'allyDeath', ...E('heal', 'ally.all', { tmx: 0.15, max: 2 }) }],
    { c: ['#f0b03a', '#5e8a4a', '#e0402a'], d: '红日升到扶桑树梢时，一只火凤从日轮里飞出落在枝头，振翅一下火羽洒满敌阵；凤鸣时整棵树亮一次，友蛊身上泛起暖光' }, { from: 'richu' }),
  K('zhichi2', '神游万里', ['blink', 'instant', 'dingxian'], 'start', '开战：瞬移蛊跨过战场，敌方后排各受攻击 70%、行动条推后 30%；全体友蛊行动条提前 25%',
    [E('dmg', 'foe.last', { shape: 'back', atk: 0.7 }), E('delay', 'same', { v: 0.3 }), E('adv', 'ally.all', { v: 0.25 })],
    { c: ['#4a8a86', '#ffffff', '#c8a0e0'], d: '定仙游的光把整张阵盘托起来轻轻一转，瞬移蛊趁着这一转出现在敌方后排，刀光过后阵盘落回，我方出手顺序条集体往前一跳' }, { from: 'zhichi' }),
  K('yiri2', '一梦千秋', ['mayfly', 'bfly', 'guangyin'], 'death', '蜉蝣倒下时，春秋蝉替它留住这一日：全体友蛊攻血 +25%，回复最大血量 20%',
    [E('buff', 'ally.all', { atk: 0.25, hp: 0.25 }), E('heal', 'ally.all', { tmx: 0.2 })],
    { c: ['#d8c890', '#8a7a3a', '#a0c0a0'], d: '日影从东走到西之后，春秋蝉振翅让日影又倒退回东边，画面上一春一秋的树叶各落一片，友蛊身上的年轮纹多出一圈' }, { from: 'yiri' }),
];
const COMBO2 = Object.fromEntries(COMBOS2.map(c => [c.id, c]));
// 威力倍率（与 battle-spec 7.3 一致，引擎可直接用）：rank = 核心蛊转数，tier = 核心那一道当前生效的共鸣档（0/2/4），mul = 道痕相冲倍率
const COMBO_POWER = (rank, tier = 0, mul = 1) => (1 + 0.15 * (Math.max(1, rank) - 1)) * (1 + 0.2 * (tier / 2) * mul);
// 进阶路线：原杀招 id → 进阶杀招 id（蛊典里「还差哪只」用）
const COMBO_UP = Object.fromEntries(COMBOS2.filter(c => c.from).map(c => [c.from, c.id]));
// 新召唤物（bestiary2.js 的 SUMMONS2 里也有）
const COMBO_SUMMONS = { xueshen: '血神子' };

return { COMBOS2, COMBO2, COMBO_POWER, COMBO_UP, COMBO_SUMMONS };
})();
// ---- src/daos.js（包一层，只放出 export）
const { DAOS, DAO, DAO_KEYS, DAO_TIERS, CLASH_MUL, DAO_CLASH, CLASH_NOTE, DAO_OF, DAO_BY_SCHOOL, daoCount, daoLine } = (() => {
// 蛊码 GuCode · 道（流派）。docs/design.md 第 1 节「羁绊分三层」的第一层 + 2.8「道共鸣要有体感」。纯数据 + 纯函数，不 import 任何文件。
// 16 道都是原著里的流派名（canon: true）。同一道的蛊在空窍里凑到 2 只、4 只时触发共鸣（4 只档替换 2 只档，不叠加），没有 6 只档。
// 共鸣要有体感（design 2.8）：每道 2 只约 +15%、4 只约 +35% 的基础加成（攻、血或护体，带速度的道略少一点），再加这一道的小特色。
// 异道道痕相冲：写在道上 clash: { 道id: 倍率 }，两道同时有共鸣时，两边共鸣都打折（只削共鸣，不影响杀招）。
//
// 格式（docs/battle-spec.md 7.1 / 7.2）：DAOS[i] = { id, n, color, d, canon, clash, r2, r4 }
//   r* = { d 一句话（写的是玩家实际拿到的数）, atk / hp / spd / sh / gp, eff?: [{ when, op, … }] }
//   atk / hp / spd / sh / gp 按引擎 RES_K（现为 0.5）折算前写：表里写 30，玩家拿到 15%，d 里写 15%。改 RES_K 要连 d 一起改。
//   eff 的施放者是这一道的每只蛊自己，只作用于自己（不写全队效果，免得只数越多叠得越多）；up: 0 = 不随转数涨。
const E = (when, op, tg, o = {}) => ({ when, op, tg, up: 0, ...o });
const DAOS = [
  { id: 'li', n: '力道', color: '#b5301f', d: '一身蛮力，打满血的更狠', canon: true,
    r2: { d: '力道的蛊攻 +15%', atk: 30 },
    r4: { d: '力道的蛊攻 +35%；打满血的敌蛊伤害 +15%', atk: 70, eff: [E('deal', 'mul', null, { v: 1.15, if: 'tg.full' })] } },
  { id: 'yan', n: '炎道', color: '#d0632a', d: '普攻带火', canon: true, clash: { bing: 0.5 },
    r2: { d: '炎道的蛊攻 +15%，普攻点燃目标 2 轮（攻击 5%）', atk: 30, eff: [E('attack', 'st', 'tg', { k: 'burn', n: 2, atk: 0.05 })] },
    r4: { d: '炎道的蛊攻 +35%，普攻点燃目标 2 轮（攻击 8%）', atk: 70, eff: [E('attack', 'st', 'tg', { k: 'burn', n: 2, atk: 0.08 })] } },
  { id: 'bing', n: '冰雪道', color: '#6a9cc0', d: '普攻带寒', canon: true, clash: { yan: 0.5 },
    r2: { d: '冰雪道的蛊血 +15%，普攻 15% 机会让目标寒 1 层', hp: 30, eff: [E('attack', 'st', 'tg', { k: 'chill', n: 1, chance: 0.15 })] },
    r4: { d: '冰雪道的蛊血 +35%，普攻 30% 机会让目标寒 1 层', hp: 70, eff: [E('attack', 'st', 'tg', { k: 'chill', n: 1, chance: 0.3 })] } },
  { id: 'jin', n: '金道', color: '#a8803e', d: '开战披甲', canon: true, clash: { mu: 0.5 },
    r2: { d: '金道的蛊开战得到最大血量 15% 的护体', sh: 30 },
    r4: { d: '金道的蛊开战得到最大血量 35% 的护体，受到的伤害 -8%', sh: 70, eff: [E('take', 'mul', null, { v: 0.92 })] } },
  { id: 'mu', n: '木道', color: '#5e8a4a', d: '慢慢回血', canon: true, clash: { jin: 0.5 },
    r2: { d: '木道的蛊血 +15%，每轮回复最大血量 2%', hp: 30, eff: [E('round', 'heal', 'self', { mx: 0.02 })] },
    r4: { d: '木道的蛊血 +35%，每轮回复最大血量 3%', hp: 70, eff: [E('round', 'heal', 'self', { mx: 0.03 })] } },
  { id: 'tu', n: '土道', color: '#8a6a3a', d: '皮糙肉厚，站前排更稳', canon: true, clash: { lei: 0.5 },
    r2: { d: '土道的蛊血 +15%', hp: 30 },
    r4: { d: '土道的蛊血 +35%；站在最前时受到的伤害 -10%', hp: 70, eff: [E('take', 'mul', null, { v: 0.9, if: 'front' })] } },
  { id: 'lei', n: '雷道', color: '#3a6aa8', d: '出手快，偶尔麻住对手', canon: true, clash: { tu: 0.5 },
    r2: { d: '雷道的蛊攻 +10%、速 +5%', atk: 20, spd: 10 },
    r4: { d: '雷道的蛊攻 +25%、速 +10%，普攻 8% 机会让目标眩晕一次', atk: 50, spd: 20, eff: [E('attack', 'st', 'tg', { k: 'stun', n: 1, chance: 0.08 })] } },
  { id: 'guang', n: '光道', color: '#c9a53a', d: '光比谁都快，专打被照亮的', canon: true, clash: { an: 0.5 },
    r2: { d: '光道的蛊攻 +10%、速 +5%', atk: 20, spd: 10 },
    r4: { d: '光道的蛊攻 +25%、速 +10%；打有标记的敌蛊伤害 +10%', atk: 50, spd: 20, eff: [E('deal', 'mul', null, { v: 1.1, if: 'tg.mark' })] } },
  { id: 'an', n: '暗道', color: '#3a3346', d: '先在暗处做好记号', canon: true, clash: { guang: 0.5 },
    r2: { d: '暗道的蛊攻 +15%；开战给敌方攻最高的蛊打上标记（第 1 轮）', atk: 30, eff: [E('start', 'st', 'foe.top', { k: 'mark', n: 2 })] },
    r4: { d: '暗道的蛊攻 +35%，开战标记敌方攻最高的蛊；打有标记的伤害 +12%', atk: 70, eff: [E('start', 'st', 'foe.top', { k: 'mark', n: 2 }), E('deal', 'mul', null, { v: 1.12, if: 'tg.mark' })] } },
  { id: 'xue', n: '血道', color: '#8a1f2b', d: '打出去的伤害吸回来', canon: true,
    r2: { d: '血道的蛊血 +15%，普攻后回复这一下的 8%', hp: 30, eff: [E('attack', 'heal', 'self', { n: 0.08 })] },
    r4: { d: '血道的蛊血 +35%，普攻后回复这一下的 15%', hp: 70, eff: [E('attack', 'heal', 'self', { n: 0.15 })] } },
  { id: 'du', n: '毒道', color: '#4f7a3a', d: '普攻带毒', canon: true,
    r2: { d: '毒道的蛊攻 +15%，普攻让目标中毒（攻击 5%）', atk: 30, eff: [E('attack', 'st', 'tg', { k: 'psn', atk: 0.05 })] },
    r4: { d: '毒道的蛊攻 +35%，普攻让目标中毒（攻击 8%）；打中毒的敌蛊伤害 +10%', atk: 70, eff: [E('attack', 'st', 'tg', { k: 'psn', atk: 0.08 }), E('deal', 'mul', null, { v: 1.1, if: 'tg.psn' })] } },
  { id: 'zhi', n: '智道', color: '#3d5a8a', d: '谋定而后动，主动技来得早', canon: true,
    r2: { d: '智道的蛊攻、血各 +8%，有主动技的开战蛊力 15', atk: 16, hp: 16, gp: 30 },
    r4: { d: '智道的蛊攻、血各 +18%，有主动技的开战蛊力 30；开战敌方速最快的行动条推后 10%', atk: 36, hp: 36, gp: 60, eff: [E('start', 'delay', 'foe.fast', { v: 0.1 })] } },
  { id: 'hun', n: '魂道', color: '#5a4a7a', d: '同伴倒下，魂气更盛', canon: true,
    r2: { d: '魂道的蛊攻 +15%；有友蛊倒下时再攻 +5%', atk: 30, eff: [E('allyDeath', 'buff', 'self', { atk: 0.05 })] },
    r4: { d: '魂道的蛊攻 +35%；有友蛊倒下时再攻 +8%、血 +5%', atk: 70, eff: [E('allyDeath', 'buff', 'self', { atk: 0.08, hp: 0.05 })] } },
  { id: 'nu', n: '奴道', color: '#7a5a3a', d: '驱使召唤物，越多越壮', canon: true,
    r2: { d: '奴道的蛊血 +15%；每有友蛊被召唤，攻 +3%（最多 5 次）', hp: 30, eff: [E('summon', 'buff', 'self', { atk: 0.03, max: 5 })] },
    r4: { d: '奴道的蛊血 +35%；每有友蛊被召唤，攻 +5%（最多 6 次）', hp: 70, eff: [E('summon', 'buff', 'self', { atk: 0.05, max: 6 })] } },
  { id: 'yu', n: '宇道', color: '#4a8a86', d: '站位腾挪，后排更安全', canon: true,
    r2: { d: '宇道的蛊血 +10%、速 +5%；身前有友蛊时每轮得到最大血量 2% 的护体', hp: 20, spd: 10, eff: [E('round', 'shield', 'self', { mx: 0.02, if: 'back' })] },
    r4: { d: '宇道的蛊血 +25%、速 +10%；身前有友蛊时每轮得到 4% 护体', hp: 50, spd: 20, eff: [E('round', 'shield', 'self', { mx: 0.04, if: 'back' })] } },
  { id: 'zhou', n: '宙道', color: '#8a7a3a', d: '拖得越久越强', canon: true,
    r2: { d: '宙道的蛊血 +15%；第 3 轮起每轮攻 +2%', hp: 30, eff: [E('round', 'buff', 'self', { atk: 0.02, if: 'round>=3' })] },
    r4: { d: '宙道的蛊血 +35%；第 3 轮起每轮攻 +4%、血 +2%', hp: 70, eff: [E('round', 'buff', 'self', { atk: 0.04, hp: 0.02, if: 'round>=3' })] } },
];
const DAO = Object.fromEntries(DAOS.map(d => [d.id, d]));
const DAO_KEYS = DAOS.map(d => d.id);
const DAO_TIERS = [2, 4];

// 道痕相冲：两道同时有共鸣（各 ≥2 只）时，两边共鸣都 ×倍率（数值写在各道的 clash 上；这里列一份给界面和图鉴）
const CLASH_MUL = 0.5;
const DAO_CLASH = [['yan', 'bing', CLASH_MUL], ['guang', 'an', CLASH_MUL], ['jin', 'mu', CLASH_MUL], ['lei', 'tu', CLASH_MUL]];
const CLASH_NOTE = { yan: '炎道与冰雪道相冲（水火不容）', bing: '冰雪道与炎道相冲（水火不容）', guang: '光道与暗道相冲', an: '暗道与光道相冲', jin: '金道与木道相冲（金克木）', mu: '木道与金道相冲（金克木）', lei: '雷道与土道相冲（土能引雷入地）', tu: '土道与雷道相冲（土能引雷入地）' };

// 120 种蛊的道（与 bestiary2.js 的 DAO120 一致，tools/v2-data-check.mjs 会核对）；每道 7–8 种，各转数都有
const M = {
  li:    'boar drum tiger stag glut locust xiongli qingtian',
  yan:   'fire bomb nirvana fireant pyre char flint magma',
  bing:  'frost snowsilk snowflea icesnail coldcicada hail glacier',
  jin:   'iron rhino gold jinchan saw yupi lockarm baiyu',
  mu:    'thorn stick silk taisui shengji vine cordy fusang',
  tu:    'dung mole antlion tortoise yue stonecase earthworm moveshan',
  lei:   'thunder dfly static jingzhe click cloud magstorm jiuxiao',
  guang: 'moth firefly mirror yueguang sheli shine solar',
  an:    'mantis hex sleep ink bat eclipse styx',
  xue:   'leech mosq urn tick bloodant amber xueyue chiba',
  du:    'scorp hairy cent wasp toad hairworm widow',
  zhi:   'webspider cricket lure orchid jiuchong diting zhihui',
  hun:   'bone cicada qingfu fly bury will boneflute',
  nu:    'queen ant aphid spider qant hive puppet twin',
  yu:    'gecko flea bfly strider inch blink dingxian',
  zhou:  'mayfly guangyin fate asahi hourglass ring instant',
};
const DAO_OF = Object.fromEntries(Object.entries(M).flatMap(([d, s]) => s.split(' ').map(id => [id, d])));
// core.js 现在用 DAO_BY_SCHOOL 给没写 dao 的物种兜底；物种都带 dao 之后用不上，留着兼容旧流派标签
const DAO_BY_SCHOOL = { 召唤: 'nu', 亡语: 'hun', 成长: 'zhou', 反伤: 'mu', 站位: 'yu', 控制: 'zhi', 毒: 'du', 护体: 'jin', 减伤: 'tu', 开锋: 'li', 群攻: 'lei', 斩杀: 'an', 续航: 'xue', 爆发: 'yan', 破甲: 'jin' };

// 共鸣计数：lineup = 空窍里的蛊（{ sp } 数组，召唤物不算）。返回 { 道id: { n 只数, tier 0/2/4, eff 生效档, mul 相冲后的倍率, clash 相冲的道 } }
function daoCount(lineup) {
  const out = {};
  for (const g of lineup || []) { const d = g && DAO_OF[g.sp]; if (d) (out[d] ||= { n: 0 }).n++; }
  for (const [d, o] of Object.entries(out)) { o.tier = o.n >= 4 ? 4 : o.n >= 2 ? 2 : 0; o.eff = o.tier ? DAO[d]['r' + o.tier] : null; o.mul = 1; o.clash = null; }
  for (const [a, b, m] of DAO_CLASH) if (out[a] && out[b] && out[a].tier && out[b].tier) { out[a].mul = out[b].mul = m; out[a].clash = b; out[b].clash = a; }
  return out;
}
// 空窍上方的一句话，例：「力道 3/4 · 力道的蛊攻 +6%」「炎道 2/4 · …（与冰雪道相冲，效果减半）」
function daoLine(d, info) {
  const o = DAO[d]; if (!o || !info) return '';
  return `${o.n} ${info.n}/${info.n >= 2 ? 4 : 2}` + (info.eff ? ` · ${info.eff.d}` : '') + (info.clash ? `（与${DAO[info.clash].n}相冲，效果减半）` : '');
}

return { DAOS, DAO, DAO_KEYS, DAO_TIERS, CLASH_MUL, DAO_CLASH, CLASH_NOTE, DAO_OF, DAO_BY_SCHOOL, daoCount, daoLine };
})();
// ---- src/foods.js
// 蛊码 GuCode · 食物（第三版，26 种：加攻血 8、挂件 10、出征用 8）。纯数据，不 import 任何文件。
// 格式：FOODS[i] = { id, n 名, kind, dao 所属的道（蛊市按罗盘选中的道加权）, cost 价格档（× core.PRICE.food 才是元气）, d 一句话（写清加什么、给谁、多久）, ...效果字段 }
//   kind 'stat'：买下立刻生效，永久加攻血（每只最多吃 core.ATE_MAX 次）。to = 'one'（玩家选一只）| 'rand2'（随机两只）| 'all'（空窍全体）；atk、hp = 加多少点（数值已按 design 2.8 放大十倍，和 core.STAT_SCALE 一致）
//   kind 'gear'：挂在一只蛊身上，每只最多 1 个，换新的旧的就没了；战斗里生效。
//              eff = 声明式效果（battle-spec 第 4、6 节），施放者是挂着它的那只蛊，数值不随转数涨。
//              旧写法 gear = 'spawn'（倒下化出蛊蛹：本蛊攻血 pct%）| 'ward'（受到的伤害 -pct%）| 'first'（开战攻 +pct%）引擎照旧认。
//              八种挂件正好各给一种通用效果（召、护、毒、灼、寒、标记、吞、击退），任何道的蛊挂上都能接别人的配合。
//   kind 'trip'：只在下一次出征里有效，出征开始时生效、回洞府清掉。
//              trip = 'heal'：每场开打前全队回 pct% 血（秘境已支持）
//              trip = 'road'：这趟出征房间路程 -pct%（新，要秘境一侧接：路程乘 1 − pct/100）
//              trip = 'revive'：这趟出征第一只倒下的蛊，下一场开打前以 pct% 血站起来，只一次（新，要秘境一侧接）
//              trip = 'eff'：这趟出征每场战斗，每只出场蛊都加上 eff（新，要秘境把 eff 传给引擎，建议 battle opts 里按方带一份额外效果）
//              新类型没接好之前，可以先用 timeline.js 的 LOCKED.food 锁住不上架（lockedTrip 列出来了）。
// 顺序只能往后加（坐标码按下标记食物挂件）。前 6 个是骨架时的占位，id 和位置不动，只改了内容。
// canon: true = 原著里有的东西（描述是蛊码自己写的）。导出 FOODS / FOOD（core、秘境在用），FOOD_ITEMS 是同一份的别名。
const F = (id, n, kind, dao, cost, d, o = {}) => ({ id, n, kind, dao, cost, d, ...o });
const FOODS = [
  // —— 骨架时的 6 个（位置不动）——
  F('meat', '血肉团', 'stat', 'li', 3, '喂给一只蛊：攻 +20、血 +20，永久', { to: 'one', atk: 20, hp: 20 }),
  F('dew', '晨露丸', 'stat', 'xue', 3, '空窍里随机两只：攻 +10、血 +20，永久', { to: 'rand2', atk: 10, hp: 20 }),
  F('egg', '孵蛊卵', 'gear', 'nu', 4, '挂在一只蛊上：它倒下时原地化出一只蛊蛹（本蛊攻血的 40%）', { gear: 'spawn', pct: 40 }),
  F('scale', '鳞甲片', 'gear', 'jin', 4, '挂在一只蛊上：受到的伤害 -10%', { gear: 'ward', pct: 10 }),
  F('tea', '回春茶', 'trip', 'xue', 3, '下一次出征：每场开打前全队回 20% 血', { trip: 'heal', pct: 20 }),
  F('map', '寻路图', 'trip', 'zhi', 3, '下一次出征：房间路程 -15%，少花元气', { trip: 'road', pct: 15 }),
  // —— 加攻血 ——
  F('yuelan', '月兰花瓣', 'stat', 'guang', 3, '喂给一只蛊：攻 +30，永久', { to: 'one', atk: 30, hp: 0, canon: true }),
  F('zhujiu', '青竹酒', 'stat', 'zhi', 5, '空窍全体各喝一口：攻 +10、血 +10，永久', { to: 'all', atk: 10, hp: 10 }),
  F('huotan', '火炭心', 'stat', 'yan', 4, '空窍里随机两只：攻 +20、血 +10，永久', { to: 'rand2', atk: 20, hp: 10 }),
  F('shuangye', '霜叶', 'stat', 'bing', 2, '喂给一只蛊：攻 +10、血 +20，永久', { to: 'one', atk: 10, hp: 20 }),
  F('lingzhi', '灵芝片', 'stat', 'mu', 5, '空窍全体：血 +20，永久', { to: 'all', atk: 0, hp: 20 }),
  F('leizao', '雷击枣', 'stat', 'lei', 4, '喂给一只蛊：攻 +20、血 +30，永久', { to: 'one', atk: 20, hp: 30 }),
  // —— 挂件：各给一种通用效果 ——
  F('duzhen', '毒针囊', 'gear', 'du', 4, '挂在一只蛊上：它的普攻让目标中毒（攻击 10%，可叠）',
    { eff: [{ when: 'attack', op: 'st', tg: 'tg', k: 'psn', atk: 0.1 }] }),
  F('huorong', '火绒草', 'gear', 'yan', 4, '挂在一只蛊上：它的普攻让目标灼烧 2 轮（攻击 12%）',
    { eff: [{ when: 'attack', op: 'st', tg: 'tg', k: 'burn', n: 2, atk: 0.12 }] }),
  F('bingpo', '冰魄珠', 'gear', 'bing', 4, '挂在一只蛊上：它的普攻 35% 机会让目标寒 1 层',
    { eff: [{ when: 'attack', op: 'st', tg: 'tg', k: 'chill', n: 1, chance: 0.35 }] }),
  F('yeming', '夜明砂', 'gear', 'an', 4, '挂在一只蛊上：开战给敌方攻最高的蛊打上标记 2 轮',
    { eff: [{ when: 'start', op: 'st', tg: 'foe.top', k: 'mark', n: 3 }] }),
  F('taoya', '饕餮牙', 'gear', 'li', 5, '挂在一只蛊上：它普攻后，目标血量不过 15% 或是召唤物，就整只吞下，得到它四分之一攻血',
    { eff: [{ when: 'attack', op: 'eat', tg: 'tg', v: 0.15, gain: 0.25 }] }),
  F('shanjiao', '撞山角', 'gear', 'tu', 4, '挂在一只蛊上：它的普攻 25% 机会把目标击退一格（撞上后面的蛊，两只都受伤）',
    { eff: [{ when: 'attack', op: 'knock', tg: 'tg', v: 1, bump: 0.3, chance: 0.25 }] }),
  F('xuelian', '血莲子', 'gear', 'xue', 4, '挂在一只蛊上：它普攻后回复这一下的 15%',
    { eff: [{ when: 'attack', op: 'heal', tg: 'self', n: 0.15 }] }),
  F('jifeng', '疾风翎', 'gear', 'yu', 3, '挂在一只蛊上：开战行动条提前 40%，抢先出手',
    { eff: [{ when: 'start', op: 'adv', tg: 'self', v: 0.4 }] }),
  // —— 出征用 ——
  F('xuming', '续命汤', 'trip', 'mu', 5, '下一次出征：每场开打前全队回 35% 血', { trip: 'heal', pct: 35 }),
  F('dinghun', '定魂香', 'trip', 'hun', 5, '下一次出征：第一只倒下的蛊，下一场开打前以 30% 血站起来（只一次）', { trip: 'revive', pct: 30 }),
  F('jingleifu', '惊雷符', 'trip', 'lei', 3, '下一次出征：每场开战全队蛊力 +15',
    { trip: 'eff', eff: [{ when: 'start', op: 'gp', tg: 'self', v: 15 }] }),
  F('guangyinxiang', '光阴香', 'trip', 'zhou', 4, '下一次出征：每场第 4 轮起全队攻 +10%',
    { trip: 'eff', eff: [{ when: 'round', op: 'buff', tg: 'self', atk: 0.1, if: 'round>=4', max: 1 }] }),
  F('houtufu', '厚土符', 'trip', 'tu', 4, '下一次出征：每场开战全队得到最大血量 8% 的护体',
    { trip: 'eff', eff: [{ when: 'start', op: 'shield', tg: 'self', mx: 0.08 }] }),
  F('fengxingfu', '风行符', 'trip', 'yu', 3, '下一次出征：每场开战全队行动条提前 15%',
    { trip: 'eff', eff: [{ when: 'start', op: 'adv', tg: 'self', v: 0.15 }] }),
];
const FOOD_ITEMS = FOODS;
const FOOD = Object.fromEntries(FOODS.map(f => [f.id, f]));
const FOOD_KIND = { stat: '直接加攻血', gear: '挂件', trip: '出征用' };
// 出征食物里秘境还没接的类型（接好前可以锁住不上架）
const TRIP_NEW = ['road', 'revive', 'eff'];
const lockedTrip = () => FOODS.filter(f => f.kind === 'trip' && TRIP_NEW.includes(f.trip)).map(f => f.id);

// ---- src/timeline.js
// 蛊码 GuCode · 成就道途（第三版：50 个节点，入门 / 境界 / 出征 / 养蛊 / 杀招 / 劫数 / 挑战七组）。纯数据 + 两个纯函数，不 import 任何文件。由 tools/gen-timeline.mjs 生成，改道途改那边再跑一次。
// 格式：TIMELINE[i] = { id, n 名, g 分组, d 怎么达成（一句话）, need { 事件计数名: 次数 }, after 前置节点 id（可无）, unlock [{ k, id, n }] 解锁什么 }
// 成就本身不给数值，只解锁东西（design 第 4 节、2.7 节）。
//
// 事件计数名（metaEmit 的 k）：
//   原有：trips 出征次数（打完回来就算）、realm 境界（set 取最大）、merges 合成次数、combos 杀招成形过的种数、buys 买蛊次数、feeds 喂食次数
//   clears 秘境通关次数：每通关一次都 +1（哪个秘境、第几劫都算，不只渡劫那一次）——请改用下面的 clearEvents，别只在渡劫时加
//   以下都在通关时由 clearEvents 算出来（set 取最大，值 = 这次通关的秘境额度）：
//     r1q 出场全是一转 · r2q 出场全是一转二转 · no5q 没有五转和仙蛊 · few3q 出场不超过 3 只 · monoq 出场全属同一道
//     flawq 一只都没倒下 · nocomboq 一个杀招都没成形
//   d_<道 id>（+1）这次通关的主力道（出场只数最多的道，并列都算）；daos（set）当过主力通关的道一共几个
//   kalpa（set）通关过的最高劫数（任意秘境）
// unlock.k：'species' 新蛊进蛊市（仙蛊 = 仙茧里才可能开出它）| 'food' 新食物进蛊市 | 'combo' 杀招能成形 | 'trip' 新秘境 | 'feature' 新玩法（kalpa = 劫数）
//   锁住的杀招在蛊典里照样能看到配方线索，只是凑齐了也不成形，界面写「道途解锁」。
const TIMELINE = [
  { id: 'first_buy', n: '开张', g: '入门', d: '在蛊市买下第一只蛊', need: { buys: 1 }, unlock: [{ k: 'species', id: 'jingzhe', n: '惊蛰蛊' }, { k: 'food', id: 'tea', n: '回春茶' }] },
  { id: 'first_trip', n: '初入秘境', g: '入门', d: '第一次出征（打完回来就算，输了也算）', need: { trips: 1 }, unlock: [{ k: 'species', id: 'snowflea', n: '雪蚤蛊' }, { k: 'species', id: 'will', n: '鬼火蛊' }] },
  { id: 'first_merge', n: '三蛊归一', g: '入门', d: '第一次把三只同种同转的蛊合成一只', need: { merges: 1 }, unlock: [{ k: 'species', id: 'tick', n: '蜱蛊' }, { k: 'species', id: 'bloodant', n: '血蚁蛊' }] },
  { id: 'first_combo', n: '杀招初成', g: '入门', d: '第一次让一个杀招成形', need: { combos: 1 }, after: 'first_merge', unlock: [{ k: 'species', id: 'jiuchong', n: '酒虫' }, { k: 'food', id: 'egg', n: '孵蛊卵' }] },
  { id: 'feeder', n: '养蛊人', g: '入门', d: '喂食 5 次（挂件、出征用的也算）', need: { feeds: 5 }, unlock: [{ k: 'food', id: 'map', n: '寻路图' }] },
  { id: 'buyer10', n: '蛊市熟客', g: '入门', d: '买蛊 10 次', need: { buys: 10 }, after: 'first_buy', unlock: [{ k: 'species', id: 'strider', n: '水黾蛊' }, { k: 'food', id: 'yuelan', n: '月兰花瓣' }] },
  { id: 'realm1', n: '一转蛊师', g: '境界', d: '渡劫成功一次（打赢本境界任一秘境最深处的首领）', need: { realm: 1 }, after: 'first_trip', unlock: [{ k: 'species', id: 'wasp', n: '胡蜂蛊' }, { k: 'species', id: 'spider', n: '蛛母蛊' }, { k: 'species', id: 'qingfu', n: '青蚨蛊' }, { k: 'species', id: 'bomb', n: '爆囊蛊' }] },
  { id: 'realm2', n: '二转蛊师', g: '境界', d: '境界到二转', need: { realm: 2 }, after: 'realm1', unlock: [{ k: 'species', id: 'qant', n: '蚁后蛊' }, { k: 'species', id: 'flea', n: '跳蚤蛊' }, { k: 'species', id: 'bfly', n: '比翼蛊' }, { k: 'species', id: 'sleep', n: '眠虫蛊' }] },
  { id: 'realm3', n: '三转蛊师', g: '境界', d: '境界到三转', need: { realm: 3 }, after: 'realm2', unlock: [{ k: 'species', id: 'mirror', n: '镜甲蛊' }, { k: 'species', id: 'hive', n: '蜂巢蛊' }, { k: 'species', id: 'fly', n: '尸蝇蛊' }, { k: 'species', id: 'bury', n: '葬甲蛊' }] },
  { id: 'realm4', n: '四转蛊师', g: '境界', d: '境界到四转', need: { realm: 4 }, after: 'realm3', unlock: [{ k: 'species', id: 'xiongli', n: '熊力蛊' }, { k: 'species', id: 'magma', n: '熔岩蛊' }, { k: 'species', id: 'hail', n: '雹甲蛊' }, { k: 'species', id: 'cordy', n: '虫草蛊' }] },
  { id: 'realm5', n: '五转蛊师', g: '境界', d: '境界到五转', need: { realm: 5 }, after: 'realm4', unlock: [{ k: 'species', id: 'thunder', n: '雷甲蛊' }, { k: 'species', id: 'tortoise', n: '玄龟蛊' }, { k: 'species', id: 'puppet', n: '傀儡蛛' }, { k: 'species', id: 'hairworm', n: '铁线蛊' }] },
  { id: 'trips3', n: '三进三出', g: '出征', d: '出征 3 次', need: { trips: 3 }, after: 'first_trip', unlock: [{ k: 'species', id: 'silk', n: '蚕茧蛊' }, { k: 'species', id: 'mosq', n: '赤蚊蛊' }] },
  { id: 'trips6', n: '常走秘境', g: '出征', d: '出征 6 次', need: { trips: 6 }, after: 'trips3', unlock: [{ k: 'species', id: 'click', n: '叩甲蛊' }, { k: 'species', id: 'sheli', n: '舍利蛊' }, { k: 'species', id: 'bat', n: '夜蝠蛊' }] },
  { id: 'trips10', n: '十进秘境', g: '出征', d: '出征 10 次', need: { trips: 10 }, after: 'trips6', unlock: [{ k: 'species', id: 'cloud', n: '积云蛊' }, { k: 'species', id: 'shine', n: '照夜蛊' }, { k: 'species', id: 'amber', n: '血珀蛊' }, { k: 'species', id: 'ring', n: '年轮蛊' }] },
  { id: 'trips15', n: '识途老蛊', g: '出征', d: '出征 15 次', need: { trips: 15 }, after: 'trips10', unlock: [{ k: 'species', id: 'xueyue', n: '血月蛊' }, { k: 'species', id: 'widow', n: '寡妇蛛' }, { k: 'species', id: 'blink', n: '瞬移蛊' }] },
  { id: 'trips20', n: '踏遍山河', g: '出征', d: '出征 20 次', need: { trips: 20 }, after: 'trips15', unlock: [{ k: 'species', id: 'orchid', n: '兰螳蛊' }, { k: 'species', id: 'taisui', n: '太岁蛊' }, { k: 'species', id: 'yue', n: '镇岳蛊' }, { k: 'species', id: 'jinchan', n: '金蟾蛊' }] },
  { id: 'clears2', n: '再下一城', g: '出征', d: '通关秘境 2 次（打赢最深处的首领，哪个秘境、第几劫都算）', need: { clears: 2 }, after: 'realm1', unlock: [{ k: 'species', id: 'stag', n: '锹甲蛊' }, { k: 'species', id: 'glut', n: '饕虫蛊' }, { k: 'species', id: 'toad', n: '毒蟾蛊' }] },
  { id: 'clears4', n: '连破四关', g: '出征', d: '通关秘境 4 次', need: { clears: 4 }, after: 'clears2', unlock: [{ k: 'species', id: 'flint', n: '燧石蛊' }, { k: 'species', id: 'coldcicada', n: '寒蝉蛊' }, { k: 'species', id: 'baiyu', n: '白玉蛊' }] },
  { id: 'clears6', n: '六关在握', g: '出征', d: '通关秘境 6 次', need: { clears: 6 }, after: 'clears4', unlock: [{ k: 'species', id: 'moveshan', n: '搬山蛊' }, { k: 'species', id: 'magstorm', n: '磁暴蛊' }, { k: 'species', id: 'eclipse', n: '月蚀蛊' }] },
  { id: 'clears8', n: '八方来朝', g: '出征', d: '通关秘境 8 次', need: { clears: 8 }, after: 'clears6', unlock: [{ k: 'species', id: 'urn', n: '瓮王蛊' }, { k: 'species', id: 'hex', n: '魇蛾蛊' }, { k: 'species', id: 'saw', n: '天牛蛊' }, { k: 'species', id: 'dfly', n: '霆蜓蛊' }] },
  { id: 'clears10', n: '十关无阻', g: '出征', d: '通关秘境 10 次', need: { clears: 10 }, after: 'clears8', unlock: [{ k: 'food', id: 'xuming', n: '续命汤' }, { k: 'food', id: 'dinghun', n: '定魂香' }] },
  { id: 'merges5', n: '合蛊五次', g: '养蛊', d: '合成 5 次', need: { merges: 5 }, after: 'first_merge', unlock: [{ k: 'species', id: 'rhino', n: '犀角蛊' }, { k: 'species', id: 'gold', n: '金龟蛊' }] },
  { id: 'merges12', n: '炼蛊有成', g: '养蛊', d: '合成 12 次', need: { merges: 12 }, after: 'merges5', unlock: [{ k: 'species', id: 'pyre', n: '焚翅蛊' }, { k: 'species', id: 'icesnail', n: '冰蜗蛊' }, { k: 'species', id: 'lockarm', n: '锁甲蛊' }] },
  { id: 'merges25', n: '炼蛊大家', g: '养蛊', d: '合成 25 次', need: { merges: 25 }, after: 'merges12', unlock: [{ k: 'species', id: 'frost', n: '霜蛉蛊' }, { k: 'species', id: 'lure', n: '迷蝶蛊' }, { k: 'species', id: 'antlion', n: '蚁狮蛊' }, { k: 'species', id: 'mayfly', n: '蜉蝣蛊' }] },
  { id: 'merges40', n: '千炼成器', g: '养蛊', d: '合成 40 次', need: { merges: 40 }, after: 'merges25', unlock: [{ k: 'species', id: 'glacier', n: '玄冰蛊' }, { k: 'species', id: 'fusang', n: '扶桑蛊' }, { k: 'species', id: 'solar', n: '曜日蛊' }] },
  { id: 'feeds12', n: '投喂有方', g: '养蛊', d: '喂食 12 次', need: { feeds: 12 }, after: 'feeder', unlock: [{ k: 'food', id: 'duzhen', n: '毒针囊' }, { k: 'food', id: 'huorong', n: '火绒草' }] },
  { id: 'feeds20', n: '百味蛊厨', g: '养蛊', d: '喂食 20 次', need: { feeds: 20 }, after: 'feeds12', unlock: [{ k: 'food', id: 'bingpo', n: '冰魄珠' }, { k: 'food', id: 'yeming', n: '夜明砂' }, { k: 'food', id: 'xuelian', n: '血莲子' }] },
  { id: 'feeds30', n: '食谱齐全', g: '养蛊', d: '喂食 30 次', need: { feeds: 30 }, after: 'feeds20', unlock: [{ k: 'food', id: 'taoya', n: '饕餮牙' }, { k: 'food', id: 'shanjiao', n: '撞山角' }, { k: 'food', id: 'jifeng', n: '疾风翎' }] },
  { id: 'buys30', n: '常客', g: '养蛊', d: '买蛊 30 次', need: { buys: 30 }, after: 'buyer10', unlock: [{ k: 'species', id: 'cricket', n: '促织蛊' }, { k: 'species', id: 'locust', n: '蝗群蛊' }, { k: 'species', id: 'char', n: '炭甲蛊' }] },
  { id: 'buys60', n: '蛊市贵客', g: '养蛊', d: '买蛊 60 次', need: { buys: 60 }, after: 'buys30', unlock: [{ k: 'food', id: 'huotan', n: '火炭心' }, { k: 'food', id: 'lingzhi', n: '灵芝片' }, { k: 'food', id: 'leizao', n: '雷击枣' }] },
  { id: 'combos3', n: '三招在手', g: '杀招', d: '让 3 种不同的杀招成形过', need: { combos: 3 }, after: 'first_combo', unlock: [{ k: 'species', id: 'vine', n: '藤蔓蛊' }, { k: 'species', id: 'earthworm', n: '地龙蛊' }] },
  { id: 'combos6', n: '推演进阶', g: '杀招', d: '让 6 种不同的杀招成形过', need: { combos: 6 }, after: 'combos3', unlock: [{ k: 'species', id: 'diting', n: '地听肉耳草' }, { k: 'species', id: 'hourglass', n: '沙漏蛊' }, { k: 'combo', id: 'sanzhu2', n: '焚原三豕' }] },
  { id: 'combos10', n: '十招融会', g: '杀招', d: '让 10 种不同的杀招成形过', need: { combos: 10 }, after: 'combos6', unlock: [{ k: 'combo', id: 'jinjia2', n: '万钧金身' }, { k: 'combo', id: 'pojian2', n: '化蝶三生' }, { k: 'food', id: 'zhujiu', n: '青竹酒' }] },
  { id: 'combos15', n: '招中有招', g: '杀招', d: '让 15 种不同的杀招成形过', need: { combos: 15 }, after: 'combos10', unlock: [{ k: 'combo', id: 'leigu2', n: '雷霆万钧' }] },
  { id: 'combos20', n: '万法归宗', g: '杀招', d: '让 20 种不同的杀招成形过', need: { combos: 20 }, after: 'combos15', unlock: [{ k: 'species', id: 'styx', n: '冥蝶蛊' }, { k: 'species', id: 'boneflute', n: '骨笛蛊' }, { k: 'species', id: 'instant', n: '刹那蛊' }, { k: 'combo', id: 'bingfeng2', n: '冰火同炉' }] },
  { id: 'kalpa_open', n: '渡劫之后', g: '劫数', d: '通关任意一个秘境，打开劫数', need: { clears: 1 }, unlock: [{ k: 'feature', id: 'kalpa', n: '劫数' }] },
  { id: 'kalpa1', n: '初历一劫', g: '劫数', d: '通关任意秘境的劫一', need: { kalpa: 1 }, after: 'kalpa_open', unlock: [{ k: 'food', id: 'jingleifu', n: '惊雷符' }, { k: 'food', id: 'fengxingfu', n: '风行符' }] },
  { id: 'kalpa3', n: '三劫不死', g: '劫数', d: '通关任意秘境的劫三', need: { kalpa: 3 }, after: 'kalpa1', unlock: [{ k: 'species', id: 'nirvana', n: '涅火蛾' }, { k: 'combo', id: 'suanwu2', n: '算尽天机' }] },
  { id: 'kalpa5', n: '五劫加身', g: '劫数', d: '通关任意秘境的劫五', need: { kalpa: 5 }, after: 'kalpa3', unlock: [{ k: 'species', id: 'guangyin', n: '春秋蝉' }, { k: 'food', id: 'guangyinxiang', n: '光阴香' }, { k: 'food', id: 'houtufu', n: '厚土符' }] },
  { id: 'kalpa7', n: '七劫过尽', g: '劫数', d: '通关任意秘境的劫七', need: { kalpa: 7 }, after: 'kalpa5', unlock: [{ k: 'species', id: 'fate', n: '织命蛛' }] },
  { id: 'kalpa10', n: '十劫圆满', g: '劫数', d: '通关任意秘境的劫十', need: { kalpa: 10 }, after: 'kalpa7', unlock: [{ k: 'species', id: 'jiuxiao', n: '九霄蛊' }, { k: 'combo', id: 'zhichi2', n: '神游万里' }] },
  { id: 'ch_r1q7', n: '一转亦能', g: '挑战', d: '只用一转蛊，通关额度 7 及以上的秘境', need: { r1q: 7 }, after: 'realm1', unlock: [{ k: 'species', id: 'qingtian', n: '擎天蛊' }] },
  { id: 'ch_r2q10', n: '低转为本', g: '挑战', d: '只用一转、二转蛊，通关额度 10 及以上的秘境', need: { r2q: 10 }, after: 'realm2', unlock: [{ k: 'combo', id: 'baiyi2', n: '火蚁燎原' }] },
  { id: 'ch_no5q14', n: '不仗高转', g: '挑战', d: '不带五转和仙蛊，通关额度 14 及以上的秘境', need: { no5q: 14 }, after: 'realm3', unlock: [{ k: 'species', id: 'dingxian', n: '定仙游' }, { k: 'combo', id: 'yiri2', n: '一梦千秋' }] },
  { id: 'ch_few3', n: '三蛊破阵', g: '挑战', d: '出场不超过 3 只，通关额度 10 及以上的秘境', need: { few3q: 10 }, after: 'realm2', unlock: [{ k: 'species', id: 'chiba', n: '赤魃蛊' }] },
  { id: 'ch_mono', n: '一道到底', g: '挑战', d: '出场的蛊全属同一道，通关额度 10 及以上的秘境', need: { monoq: 10 }, after: 'realm2', unlock: [{ k: 'trip', id: 'maigu', n: '埋骨荒原' }, { k: 'combo', id: 'wudu2', n: '万毒归宗' }] },
  { id: 'ch_flawless', n: '全身而退', g: '挑战', d: '一只蛊都没倒下，通关额度 14 及以上的秘境', need: { flawq: 14 }, after: 'realm3', unlock: [{ k: 'combo', id: 'richu2', n: '凤栖扶桑' }] },
  { id: 'ch_nocombo', n: '不靠杀招', g: '挑战', d: '一个杀招都没成形，通关额度 10 及以上的秘境', need: { nocomboq: 10 }, after: 'realm2', unlock: [{ k: 'combo', id: 'xuanwu2', n: '玄武负山' }] },
  { id: 'ch_daos4', n: '四道皆通', g: '挑战', d: '用 4 个不同的道当主力各通关一次（主力 = 出场只数最多的道，并列都算）', need: { daos: 4 }, after: 'clears2', unlock: [{ k: 'combo', id: 'jiutian2', n: '九霄雷劫' }, { k: 'trip', id: 'tianting', n: '天庭' }] },
  { id: 'ch_daos16', n: '十六道归一', g: '挑战', d: '十六个道都当过一次主力通关', need: { d_li: 1, d_yan: 1, d_bing: 1, d_jin: 1, d_mu: 1, d_tu: 1, d_lei: 1, d_guang: 1, d_an: 1, d_xue: 1, d_du: 1, d_zhi: 1, d_hun: 1, d_nu: 1, d_yu: 1, d_zhou: 1 }, after: 'ch_daos4', unlock: [{ k: 'species', id: 'zhihui', n: '智慧蛊' }] },
];
// 一开始就锁着、要靠道途解锁的东西（不在这里的默认可用）。开局能买的蛊 34 种：
//   boar tiger fire fireant snowsilk iron yupi thorn stick shengji dung stonecase static firefly yueguang ink leech hairy cent webspider bone twin ant aphid inch asahi mantis queen cicada mole gecko scorp drum moth
const LOCKED = {
  species: [
    'wasp', 'spider', 'qingfu', 'bomb', 'silk', 'mosq', 'rhino', 'gold', 'qant', 'flea', 'bfly', 'sleep',
    'stag', 'glut', 'toad', 'cricket', 'locust', 'mirror', 'hive', 'fly', 'bury', 'frost', 'lure', 'antlion',
    'mayfly', 'thunder', 'tortoise', 'puppet', 'hairworm', 'urn', 'hex', 'saw', 'dfly', 'orchid', 'taisui', 'yue',
    'jinchan', 'guangyin', 'fate', 'nirvana', 'xiongli', 'qingtian', 'pyre', 'char', 'flint', 'magma', 'snowflea', 'icesnail',
    'coldcicada', 'hail', 'glacier', 'lockarm', 'baiyu', 'vine', 'cordy', 'fusang', 'earthworm', 'moveshan', 'jingzhe', 'click',
    'cloud', 'magstorm', 'jiuxiao', 'sheli', 'shine', 'solar', 'bat', 'eclipse', 'styx', 'tick', 'bloodant', 'amber',
    'xueyue', 'chiba', 'widow', 'jiuchong', 'diting', 'zhihui', 'will', 'boneflute', 'strider', 'blink', 'dingxian', 'hourglass',
    'ring', 'instant',
  ],
  food: ['egg', 'tea', 'map', 'yuelan', 'zhujiu', 'huotan', 'lingzhi', 'leizao', 'duzhen', 'huorong', 'bingpo', 'yeming', 'taoya', 'shanjiao', 'xuelian', 'jifeng', 'xuming', 'dinghun', 'jingleifu', 'guangyinxiang', 'houtufu', 'fengxingfu'],
  combo: ['sanzhu2', 'jinjia2', 'pojian2', 'xuanwu2', 'leigu2', 'jiutian2', 'wudu2', 'bingfeng2', 'baiyi2', 'suanwu2', 'richu2', 'zhichi2', 'yiri2'],
  trip: ['maigu', 'tianting'],
  feature: ['kalpa'],
};
const STARTERS = ['boar', 'tiger', 'fire', 'fireant', 'snowsilk', 'iron', 'yupi', 'thorn', 'stick', 'shengji', 'dung', 'stonecase', 'static', 'firefly', 'yueguang', 'ink', 'leech', 'hairy', 'cent', 'webspider', 'bone', 'twin', 'ant', 'aphid', 'inch', 'asahi', 'mantis', 'queen', 'cicada', 'mole', 'gecko', 'scorp', 'drum', 'moth'];

// 劫数（design 2.7）：通关一个秘境开它的劫一；劫 N 通关开劫 N+1，最高劫十。要先点亮「渡劫之后」解锁 kalpa 玩法。
// 每个秘境打到第几劫由秘境一侧记在存档里（best = 这个秘境通关过的最高劫，普通难度通关记 0，没通关过记 -1）。
const KALPA = { max: 10, feature: 'kalpa' };
const kalpaOpen = best => (best == null || best < 0 ? 0 : Math.min(KALPA.max, (best | 0) + 1));   // 这个秘境现在最高能选第几劫（0 = 只有普通难度）

// 秘境通关时要发的道途事件。info = { quota 秘境额度, ranks [出场蛊转数，仙蛊记 6], daos [出场蛊的道], fallen 这一趟倒下几只（救回的也算）,
//   combos 这一趟成形过的杀招数, kalpa 这次打的第几劫（普通 0）, cnt 道途现有计数 M.cnt }
// 返回 [[计数名, 数, set], …]，按顺序 metaEmit(M, k, n, { set }) 即可（召唤物不算出场蛊）。
function clearEvents(info = {}) {
  const q = info.quota | 0, rk = info.ranks || [], ds = info.daos || [], cnt = info.cnt || {}, ev = [['clears', 1, false]];
  if (rk.length) {
    if (rk.every(r => r <= 1)) ev.push(['r1q', q, true]);
    if (rk.every(r => r <= 2)) ev.push(['r2q', q, true]);
    if (rk.every(r => r < 5)) ev.push(['no5q', q, true]);
    if (rk.length <= 3) ev.push(['few3q', q, true]);
  }
  if (ds.length && ds.every(d => d === ds[0])) ev.push(['monoq', q, true]);
  if (!(info.fallen > 0)) ev.push(['flawq', q, true]);
  if (!(info.combos > 0)) ev.push(['nocomboq', q, true]);
  const by = {}; ds.forEach(d => { by[d] = (by[d] || 0) + 1; }); const top = Math.max(0, ...Object.values(by)), main = Object.keys(by).filter(d => by[d] === top);
  main.forEach(d => ev.push(['d_' + d, 1, false]));
  const had = new Set(Object.keys(cnt).filter(k => /^d_/.test(k) && cnt[k] > 0)); main.forEach(d => had.add('d_' + d));
  ev.push(['daos', had.size, true]);
  if (info.kalpa > 0) ev.push(['kalpa', info.kalpa | 0, true]);
  return ev;
}

// ---- src/core.js
// 蛊码 GuCode · 纯逻辑：种子随机、数据表、洞府养成（蛊市、合成、食物、道、杀招）、坐标码。不碰 DOM。规则见 docs/design.md





const natMulFor = r => natMulOf(r);   // 本命描述里〔〕数字按转数换算（界面用）
function hashStr(s) { s = String(s); let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function makeRng(seed) {
  let a = (typeof seed === 'number' ? seed : hashStr(seed)) >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = n => Math.floor(r() * n);
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  return r;
}


const MAXV = 3, SLOTS = 9;   // MAXV：本命技层数上限（TRAITS.d(v) 用）；SLOTS：阵盘 3×3 共 9 格，上阵几只由秘境额度决定
const REALMS = ['凡人', '一转', '二转', '三转', '四转', '五转'];
const SLOT_BY_REALM = [3, 4, 5, 6, 7, 7];   // 只给程序生成阵容当默认只数用；玩家的空窍不再按境界限格数（见 QUOTA）
const slotCap = r => SLOT_BY_REALM[Math.min(5, Math.max(0, r | 0))];
// 蛊池 6 档（下标 = 境界）：旧 12 种在前三档，蛊典扩充的新蛊按档追加；六转仙蛊不进任何一档
const POOL_TIERS = [['boar', 'fire', 'twin', 'iron', 'thorn', 'bone'], ['mantis', 'queen', 'cicada'], ['drum', 'scorp', 'moth'], [], [], []].map((t, i) => [...t, ...NEW_POOL[i]]);
const poolFor = r => POOL_TIERS.slice(0, Math.min(6, (r | 0) + 1)).flat();
// 转数：一转到五转（六转仙蛊另算）。基础转数 = 物种所在蛊池档位 + 1；物种带 rank 字段时以它为准。三只同种同转合成高一转，最高五转。
const RANK = { names: ['', '一转', '二转', '三转', '四转', '五转', '六转'], ch: ['', '一', '二', '三', '四', '五', '六'], max: 5 };
const baseRank = sp => (SP[sp] && SP[sp].rank) || (POOL_TIERS.findIndex(t => t.includes(sp)) + 1) || 1;
const rankOf = g => g.rank || baseRank(g.sp);
const fuseLv = g => Math.max(0, rankOf(g) - baseRank(g.sp));     // 合成过几次（0 = 原生转数）
const rankName = g => RANK.names[rankOf(g)] + SP[g.sp].n;          // 「一转野猪蛊」
// 出战额度：每个秘境写明额度，上阵蛊的转数加起来不能超过它（只限转数总和，不限只数）。下标 = 秘境所属境界
const QUOTA = [4, 7, 10, 14, 18, 22];
const quotaOf = team => (team || []).reduce((s, g) => s + rankOf(g), 0);
const driveCap = r => Math.min(RANK.max, (r | 0) + 1);   // 驱使上限：境界 r 只能让 r+1 转及以下的蛊上阵
// 斗幽灵、战帖按额度分场：上阵转数总和不超过这一场的额度就能进（和秘境一样只限总和，不限只数和单只转数）
const ARENAS = [4, 9, 15, 22];
const arenaOf = team => ARENAS.find(q => quotaOf(team) <= q) || 0;   // 这队最低能进几点场（超过 22 点返回 0）
// 各转的主色（升转外貌、转数角标用）：一转青铜、二转赤铁、三转白银、四转黄金、五转紫晶
const ZHENYUAN = { colors: ['#a0703f', '#a0703f', '#a4442c', '#9aa4ab', '#d9a441', '#7d62a8'] };
// 价格（元气 = 消耗的 token）：单位是「千」，乘 tokens.js 的 unit 才是 token 数（插件 8000，网页 200）。
// gu 买一只蛊；refresh 转市；sell 卖蛊退回 = sell × 3^(合成次数)（三只合一只，退回也按三倍走）；食物的价格 = FOODS[].cost × food
const PRICE = { gu: 75, refresh: 25, sell: 25, food: 25 };
// 蛊囊（场下）：凑合成用，不上场、不跟去渡劫，放在里面绝对安全。固定 8 格
const BAG = { cap: 8 };
const bagCap = () => BAG.cap;
// 攻血成长表：同一种蛊每一转的攻血固定。G[r] = 该转相对一转的倍数；物种的 atk/hp 是它基础转数时的数值。
// 物种可带 st: [[攻,血] × 6]（下标 = 转数）直接覆盖这张表。
// 单只蛊封顶（design 第 0 节）：攻血按「每种蛊每一转」的固定表，五转封顶；加攻血的食物每只最多吃 ATE_MAX 次
const RANK_GROW = [0, 1, 1.8, 3, 4.6, 6.8, 9.6];
// 数值放大十倍（design 2.8）：物种表里的攻血是小数字，statFor 统一乘 STAT_SCALE 再给出去（一转约攻 20、血 40），百分比加成才看得出来。
// 食物加的攻血在 foods.js 里已经是放大后的数，不再乘。
const STAT_SCALE = 10;
const ATE_MAX = 3;
const ateOf = g => (g && g.ate) || 0;
const canEat = g => !!g && ateOf(g) < ATE_MAX;
// 这种蛊从原生转数到五转的攻血表：[{ rank, atk, hp }]
const statTable = sp => { const out = []; for (let r = baseRank(sp); r <= RANK.max; r++) out.push({ rank: r, ...statFor(sp, r) }); return out; };
function statFor(sp, rank) {
  const s = SP[sp]; if (!s) return { atk: 1, hp: 1 };
  const r = Math.max(1, Math.min(6, rank | 0)), X = STAT_SCALE; if (s.st && s.st[r]) return { atk: Math.max(1, Math.round(s.st[r][0] * X)), hp: Math.max(1, Math.round(s.st[r][1] * X)) };
  const k = RANK_GROW[r] / RANK_GROW[Math.max(1, Math.min(6, baseRank(sp)))];
  return { atk: Math.max(1, Math.round(s.atk * k * X)), hp: Math.max(1, Math.round(s.hp * k * X)) };
}

// 词条效果表：旧 12 种蛊的本命技（物种的 nat 字段指向这里），v 为层数；数值按本蛊攻血的百分比。v2 不再有副词条，词条只作本命技用。
// 蛊典扩充的本命技在 bestiary.js 的 NEW_TRAITS
const TRAITS = {
  strike: { n: '开锋', ch: '锋', trig: '开战', dao: '炎', d: v => `开战：对随机敌蛊造成本蛊攻击 ${20 * v}% 的伤害` },
  shell:  { n: '护体', ch: '甲', trig: '开战', dao: '金', d: v => `开战：获得最大血量 ${8 * v}% 的护体（先挡伤害）` },
  thorn:  { n: '反噬', ch: '棘', trig: '受击', dao: '金', d: v => `被敌方打中：把这一下伤害的 ${15 * v}% 反噬回去（至少 1）` },
  frenzy: { n: '狂血', ch: '狂', trig: '受击', dao: '力', d: v => `被打中且还活着：攻击 +${4 * v}%（按开战攻，至少 1）` },
  split:  { n: '分影', ch: '影', trig: '受击', dao: '变化', d: v => `第一次被打中还活着：身后召唤分影（本蛊攻血 ${12 * v}%）` },
  devour: { n: '噬魂', ch: '噬', trig: '击杀', dao: '食', d: v => `击杀：攻血各 +${6 * v}%` },
  legacy: { n: '遗泽', ch: '泽', trig: '亡语', dao: '魂', d: v => `亡语：身后友蛊攻血 +${8 * v}%（按它的开战攻血）` },
  spawn:  { n: '化生', ch: '化', trig: '亡语', dao: '奴', d: v => `亡语：原地召唤蛊蛹（本蛊攻血 ${15 * v}%）` },
  rally:  { n: '应召', ch: '召', trig: '召唤', dao: '奴', d: v => `有友蛊被召唤时：攻血各 +${3 * v}%（至少 1）` },
  war:    { n: '擂鼓', ch: '鼓', trig: '回合开始', dao: '力', d: v => `回合开始：最前方友蛊攻击 +${3 * v}%（至少 1）` },
  // 站位词条（只能往后加：坐标码按序号编码）
  guard:    { n: '护卫', ch: '卫', trig: '开战', dao: '宇', d: v => `开战：获得最大血量 ${6 * v}% 的护体；相邻友蛊第一次挨打时由它代受` },
  link:     { n: '连心', ch: '连', trig: '开战', dao: '宇', d: v => `开战：相邻友蛊攻血各 +${5 * v}%` },
  snipe:    { n: '暗针', ch: '针', trig: '开战', dao: '宇', d: v => `开战：不在最前时，射敌方最末一只本蛊攻击 ${20 * v}% 的伤害` },
  vanguard: { n: '先登', ch: '登', trig: '开战', dao: '宇', d: v => `开战：站最前时攻击 +${4 * v}%、血 +${8 * v}%` },
};
Object.assign(TRAITS, NEW_TRAITS);   // 蛊典扩充的词条接在后面（序号只增不改）
const TRAIT_ALL = Object.keys(TRAITS);                         // 全部词条：坐标码按这个序号编码

// 物种：每只一个直白词条。ab = 附蛊简字
const SPECIES = [
  { id: 'boar',   n: '野猪蛊', ab: '豕', atk: 3, hp: 4, t: 'frenzy', v: 1, lore: '越挨打越疯' },
  { id: 'fire',   n: '流火蛊', ab: '火', atk: 2, hp: 3, t: 'strike', v: 1, lore: '开场先放一把火' },
  { id: 'twin',   n: '分身蛊', ab: '影', atk: 2, hp: 3, t: 'split',  v: 1, lore: '挨一下，多一个自己' },
  { id: 'iron',   n: '铁甲蛊', ab: '甲', atk: 2, hp: 5, t: 'shell',  v: 1, lore: '壳比命硬' },
  { id: 'thorn',  n: '荆棘蛊', ab: '棘', atk: 2, hp: 4, t: 'thorn',  v: 1, t2: 'vanguard', v2: 1, lore: '碰我者自伤' },
  { id: 'mantis', n: '噬心蛊', ab: '螳', atk: 4, hp: 2, t: 'devour', v: 1, lore: '吃一只，壮一圈' },
  { id: 'bone',   n: '腐骨蛊', ab: '骨', atk: 2, hp: 2, t: 'spawn',  v: 1, t2: 'guard', v2: 1, lore: '死了还会孵出来' },
  { id: 'queen',  n: '蜂王蛊', ab: '蜂', atk: 2, hp: 3, t: 'rally',  v: 1, t2: 'link', v2: 1, lore: '一呼百应' },
  { id: 'cicada', n: '金蝉蛊', ab: '蝉', atk: 2, hp: 3, t: 'legacy', v: 1, lore: '蜕下的壳留给后人' },
  { id: 'drum',   n: '战鼓蛊', ab: '鼓', atk: 1, hp: 4, t: 'war',    v: 1, lore: '鼓声一响，前锋发狠' },
  { id: 'scorp',  n: '蝎尾蛊', ab: '蝎', atk: 1, hp: 2, t: 'strike', v: 2, t2: 'snipe', v2: 1, lore: '一针定生死' },
  { id: 'moth',   n: '月蛾蛊', ab: '蛾', atk: 1, hp: 2, t: 'legacy', v: 2, lore: '燃尽自己照亮后人' },
];
// 旧 12 种补上转数 / 喂食偏好 / 流派；蛊典扩充的 52 种接在后面（坐标码按下标编码，只能往后加）
SPECIES.forEach(s => { Object.assign(s, OLD_EXTRA[s.id]); });
SPECIES.push(...NEW_SPECIES);
// 蛊典第二卷（120 种）：旧 64 种打补丁（道、速、远近、主动技、每转攻血表、少数换成原著名），基础转数以攻血表为准；新 56 种接在后面
SPECIES.forEach(s => { const p = PATCH64[s.id]; if (!p) return; Object.assign(s, p); s.nat = NAT_OF(s.id) || s.nat; const b = (s.st || []).findIndex(Boolean); if (b > 0) s.rank = b; if (b >= 6) s.immortal = true; });
SPECIES.push(...SPECIES2.filter(s => !SPECIES.some(x => x.id === s.id)));
// 蛊池按基础转数重排（下标 = 境界，基础 r 转进第 r−1 档；六转仙蛊不进任何一档）
POOL_TIERS.forEach((t, i) => { t.length = 0; t.push(...SPECIES.filter(s => !s.immortal && !s.legend && (s.rank || 1) - 1 === i).map(s => s.id)); });
// 120 种的被动技能换成声明式（战斗引擎读 NEW_TRAITS 的 eff / awEff）；keepHooks 的只换描述
Object.entries(NATS).forEach(([k, t]) => {
  if (t.keepHooks && NEW_TRAITS[k]) Object.assign(NEW_TRAITS[k], { n: t.n, ch: t.ch, trig: t.trig, d: t.d, aw: t.aw });
  else NEW_TRAITS[k] = t;
  TRAITS[k] = NEW_TRAITS[k];
});
const NORMAL_SPECIES = SPECIES.filter(s => !s.immortal);   // 随机池（幽灵、天劫、招蛊）：六转仙蛊只能开茧获得
const SP = Object.fromEntries(SPECIES.map(s => [s.id, s]));
const spTraits = id => [];   // 新蛊出生不带副词条：物种的本事在本命技里（natOf），副词条靠突变、炼附、吞噬
// 本命与转数：本命由物种推出；三转、五转各觉醒一次本命
const natOf = sp => (SP[sp] && SP[sp].nat) || null;
const guRank = g => { const s = SP[g.sp]; if (!s) return 1; return s.immortal ? 6 : rankOf(g); };
const awOf = g => { const r = guRank(g); return r >= 5 ? 2 : r >= 3 ? 1 : 0; };
SPECIES.forEach(s => { if (!s.dao) s.dao = DAO_BY_SCHOOL[s.school] || 'li'; });   // 物种属于哪一道（占位口径见 daos.js）
const SUMMON_NAMES = { pupa: '蛊蛹', shade: '分影', lunar: '月影', ...NEW_SUMMONS, ...SUMMONS2, ...COMBO_SUMMONS };

// 杀招：配方里的几种蛊同时在空窍，杀招就自动成形，挂在配方第一种蛊（站得最靠前的那只）身上
const COMBOS = [
  { id: 'sanzhu',   n: '烈火三豕冲', need: ['boar', 'fire', 'twin'], d: '开战：冲阵，对敌方前三只各造成本蛊攻击 25% 的伤害' },
  { id: 'jinjia',   n: '金甲不坏身', need: ['iron', 'thorn'],  d: '开战再得最大血量 15% 的护体；护体未破时受击，反噬与荆棘翻倍' },
  { id: 'wangu',    n: '万蛊朝宗',   need: ['queen', 'bone'],  d: '首次受击存活：身后召唤蛊蛹（本蛊攻血 12%）；任一友蛊被召唤时，全体友蛊攻血 +3%' },
  { id: 'tuoke',    n: '金蝉脱壳',   need: ['cicada', 'twin'], d: '首次阵亡时原地蜕生：攻击不变，血回一半' },
  { id: 'duopo',    n: '噬心夺魄',   need: ['mantis', 'scorp'], d: '击杀后，立刻对下一只敌蛊造成等同攻击的伤害（每回合一次）' },
  { id: 'pozhen',   n: '擂鼓破阵',   need: ['drum', 'boar'],   d: '回合开始：全体友蛊攻血 +3%（按开战攻血）' },
  { id: 'shishan',  n: '尸山月影',   need: ['moth', 'bone'],   d: '亡语：再召唤一只月影（本蛊一半攻击、40% 血）' },
  { id: 'fenshen',  n: '焚身诀',     need: ['fire', 'mantis'], d: '击杀：对敌方全体造成本蛊攻击 20% 的伤害' },
  { id: 'jingji',   n: '荆棘王座',   need: ['thorn', 'queen'], d: '被敌方打中：全体友蛊获得本蛊最大血量 4% 的护体' },
  { id: 'liaoyuan', n: '天火燎原',   need: ['fire', 'scorp'],  d: '开战：流火与开锋改为波及敌方全体（流火每只按四分之一算，开锋每只减半）' },
];
COMBOS.push(...NEW_COMBOS);   // 新杀招都是两蛊配方，排在旧配方之后
// 杀招第二版（combos2.js：核心蛊、时机、声明式效果、进阶）整表替换上面的旧配方；配方里有还不存在的物种的先跳过
const COMBOS_SKIPPED = COMBOS2.filter(c => !c.need.every(x => SP[x])).map(c => c.id);
COMBOS.length = 0; COMBOS.push(...COMBOS2.filter(c => c.need.every(x => SP[x])));
// 道途锁住的杀招（进阶杀招要靠道途解锁）：COMBOS 只放能成形的，COMBOS_ALL 是全表（蛊典照样列出、写「道途解锁」）。
// setComboLocks(on) 按 on(id) 重排 COMBOS；战斗引擎和 synergyOf 读的是 COMBOS。切磋和复盘前设成全开，结果和对方看到的一样
const COMBOS_ALL = COMBOS.slice();
function setComboLocks(on = () => true) { COMBOS.length = 0; COMBOS.push(...COMBOS_ALL.filter(c => on(c.id))); }
const COMBO = Object.fromEntries(COMBOS.map(c => [c.id, c]));

let UIDN = 1;
function nuid() { return 'g' + (UIDN++).toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
// 一只蛊：物种、转数、攻血（按转数查表）、挂件食物（food，最多 1 个）、蛊性（xing，最多 1 个，秘境里打出来）
function newGu(sp, rank) { const r = rank || baseRank(sp), st = statFor(sp, r); return { uid: nuid(), sp, rank: r, atk: st.atk, hp: st.hp, food: null, xing: null }; }
function starterTeam() { return ['boar', 'fire', 'twin'].map(sp => newGu(sp)); }
const daoOf = sp => (SP[sp] && SP[sp].dao) || 'li';

// ---------- 杀招（队伍级，自动成形） ----------
// 返回 { 下标: 杀招 }：每只蛊最多挂一个杀招，配方按 COMBOS 顺序认领
function teamCombos(team) {
  const out = {}, sps = new Set(team.map(g => g.sp));
  for (const c of COMBOS) {
    if (!c.need.every(x => sps.has(x))) continue;
    const i = team.findIndex((g, k) => g.sp === c.need[0] && !out[k]); if (i >= 0) out[i] = c;
  }
  return out;
}
function comboOf(g, team) { if (!team) return null; const i = team.indexOf(g); return i >= 0 ? teamCombos(team)[i] || null : null; }
function skillOf(g, team) { const c = comboOf(g, team); return c ? { id: c.id, n: c.n, d: c.d, named: true } : null; }
// 配方还差哪几种（蛊典用）：have = 当前空窍物种
const comboMissing = (c, have) => c.need.filter(x => !have.includes(x));

// ---------- 蛊市 ----------
// 货架：蛊位 n 个、食物位 2 个。罗盘选中的道只让它出现的概率 +daoP（每个货位先以 daoP 的几率从这一道里挑，否则从全部里挑），
// 蛊市照样什么道都会刷，不锁阵容。foeDaoP：程序生成的对手偏向某一道的几率（秘境房间的主题）
const SHOP = { guSlots: [3, 3, 4, 4, 5, 5], foodSlots: 2, daoP: 0.05, foeDaoP: 0.6 };
function shopSpecies(realm, unlocked) { return poolFor(realm).filter(sp => SP[sp] && !SP[sp].immortal && (!unlocked || unlocked(sp, 'species'))); }
function shopFoods(unlocked) { return FOODS.filter(f => !unlocked || unlocked(f.id, 'food')).map(f => f.id); }
function pickDao(rng, list, dao, of, p = SHOP.daoP) { const main = dao ? list.filter(x => of(x) === dao) : []; return main.length && rng() < p ? rng.pick(main) : rng.pick(list); }
function rollShop(rng, realm, dao, old = [], unlocked) {
  const sps = shopSpecies(realm, unlocked), fds = shopFoods(unlocked), keep = w => w && w.frozen && !w.sold;
  const gu = Array.from({ length: SHOP.guSlots[Math.min(5, realm | 0)] }, (_, i) => { const o = old.filter(w => w.kind === 'gu')[i]; return keep(o) ? o : { kind: 'gu', sp: pickDao(rng, sps, dao, daoOf), frozen: false, sold: false }; });
  const fd = Array.from({ length: SHOP.foodSlots }, (_, i) => { const o = old.filter(w => w.kind === 'food')[i]; return keep(o) ? o : (fds.length ? { kind: 'food', id: pickDao(rng, fds, dao, id => FOOD[id].dao), frozen: false, sold: false } : null); }).filter(Boolean);
  return [...gu, ...fd];
}
const foodCost = id => (FOOD[id] ? FOOD[id].cost : 3) * PRICE.food;   // 单位同 PRICE

// ---------- 阵盘：3 行 × 3 列（列 c：0 前、1 中、2 后），g.pos = { r, c } ----------
const COL_NAMES = ['前', '中', '后'];
const cellOf = g => g && g.pos ? g.pos.r * 3 + g.pos.c : -1;
const cellPos = k => ({ r: Math.floor(k / 3), c: k % 3 });
const CELL_ORDER = [0, 3, 6, 1, 4, 7, 2, 5, 8];   // 自动摆放：先前列（上中下），再中列，再后列
function freeCell(team) { const used = new Set(team.map(cellOf)); return CELL_ORDER.find(k => !used.has(k)); }
// 没有位置（或位置重复）的蛊按顺序摆进空格；然后按 列、行 排好（旧引擎按数组顺序读站位）
function autoPlace(team) {
  const used = new Set();
  team.forEach(g => { const k = cellOf(g); if (k < 0 || k > 8 || used.has(k)) g.pos = null; else used.add(k); });
  team.forEach(g => { if (!g.pos) { const k = CELL_ORDER.find(x => !used.has(x)); if (k != null) { g.pos = cellPos(k); used.add(k); } } });
  return sortTeam(team);
}
function sortTeam(team) { team.sort((a, b) => (a.pos ? a.pos.c * 3 + a.pos.r : 99) - (b.pos ? b.pos.c * 3 + b.pos.r : 99)); return team; }

// ---------- 收蛊与合成 ----------
const sameRank = (list, sp, rk) => list.filter(g => g.sp === sp && rankOf(g) === rk).length;
const fusable = (team, bag, g) => rankOf(g) < RANK.max && !(SP[g.sp] || {}).immortal && sameRank([...team, ...bag], g.sp, rankOf(g)) >= 2;
// 能否再收一只：空窍或蛊囊有空位，或者它能和已有的同种同转凑成合成
function canTake(team, bag, g, cap, bc = BAG.cap) { return team.length < cap || bag.length < bc || fusable(team, bag, g); }
function canBuy(team, sp, cap, bag = [], bc = BAG.cap) { return canTake(team, bag, { sp, rank: baseRank(sp) }, cap, bc); }
// 收下一只蛊：能合成先合成；否则空窍有空位进空窍，再不行进蛊囊。mode 'bag'（战利品）只进蛊囊。返回 { where, merged }
function placeGu(team, bag, g, cap, bc = BAG.cap, mode = 'shop', pick) {
  if (fusable(team, bag, g)) { bag.push(g); return { where: 'merge', merged: mergeAll(team, bag, pick) }; }
  if (mode === 'shop' && team.length < cap) { g.pos = cellPos(freeCell(team)); team.push(g); sortTeam(team); return { where: 'team', merged: [] }; }
  if (bag.length < bc) { bag.push(g); return { where: 'bag', merged: mergeAll(team, bag, pick) }; }
  return { where: null, merged: [] };
}
// 同种同转三只合成高一转：空窍和蛊囊一起算，结果留在第一只的位置（空窍优先）。攻血直接换成新一转的表值；
// 挂件食物保留第一只的；蛊性从三只里挑一个：pick(候选蛊性数组) → 选中的那个（不给 pick 就取第一个）。返回合成出的蛊
// 三只同种同转合成高一转：攻血换成新一转的表值，再加上三只里吃得最多的那只的食物加成（吃的次数一并继承，所以不会超过 ATE_MAX 次）。
// 蛊性：三只材料里有不同的蛊性时，pick(候选) 同步选一个；没给 pick 就先传第一个，并在新蛊上留 xingAsk = 候选，等界面问玩家。
function mergeAll(team, bag = [], pick) {
  const done = [], rm = x => { const l = team.includes(x) ? team : bag; l.splice(l.indexOf(x), 1); };
  for (let guard = 0; guard < 12; guard++) {
    let grp = null; const all = [...team, ...bag];
    for (const g of all) { const rk = rankOf(g), same = all.filter(x => x.sp === g.sp && rankOf(x) === rk); if (same.length >= 3 && rk < RANK.max && !(SP[g.sp] || {}).immortal) { grp = same.slice(0, 3); break; } }
    if (!grp) break;
    const [a, b, c] = grp, xs = [...new Set(grp.map(x => x.xing).filter(Boolean))];
    const fed = grp.reduce((m, x) => (ateOf(x) > ateOf(m) ? x : m), a);
    const bA = fed.bonusA || 0, bH = fed.bonusH || 0, ate = ateOf(fed);
    a.rank = rankOf(a) + 1; const st = statFor(a.sp, a.rank);
    a.bonusA = bA; a.bonusH = bH; a.ate = ate; a.atk = st.atk + bA; a.hp = st.hp + bH;
    delete a.xingAsk;
    if (xs.length > 1 && pick) a.xing = pick(xs); else { a.xing = xs[0] || null; if (xs.length > 1) a.xingAsk = xs; }
    a.food = a.food || b.food || c.food || null;
    [b, c].forEach(rm);
    done.push(a);
  }
  return done;
}
const sellValue = g => PRICE.sell * Math.pow(3, fuseLv(g));   // 单位同 PRICE

// ---------- 食物 ----------
// 喂加攻血的食物：只喂还没吃满 ATE_MAX 次的，返回真正吃到的。永久加成记在 bonusA/bonusH（合成换表值时保留）
function feedStat(food, targets) {
  const f = FOOD[food]; if (!f || f.kind !== 'stat') return [];
  const ok = targets.filter(canEat);
  ok.forEach(g => { g.ate = ateOf(g) + 1; g.bonusA = (g.bonusA || 0) + (f.atk || 0); g.bonusH = (g.bonusH || 0) + (f.hp || 0); g.atk += f.atk || 0; g.hp += f.hp || 0; });
  return ok;
}

// ---------- 程序生成阵容（幽灵、秘境的对手） ----------
// realm 境界（决定蛊池与转数），n 只数，up 每只额外升转的几率，dao 偏向的道（可无）
function genTeam(rng, o = {}) {
  const realm = Math.max(0, Math.min(5, o.realm | 0)), n = Math.max(1, Math.min(SLOTS, o.n || slotCap(realm))), pool = poolFor(realm).filter(sp => SP[sp] && !SP[sp].immortal);
  const team = Array.from({ length: n }, () => { const sp = pickDao(rng, pool, o.dao, daoOf, SHOP.foeDaoP), r = Math.min(RANK.max, baseRank(sp) + (rng() < (o.up || 0) ? 1 : 0) + (rng() < (o.up || 0) / 3 ? 1 : 0)); return newGu(sp, r); });
  return autoPlace(arrangeTeam(team));
}
// 按额度凑一队（占位：秘境专家的 foeFor 交来后以它为准）：先放尽量高转的蛊，余数补一只低转。dao 偏向的道
function quotaTeam(rng, quota, o = {}) {
  const top = Math.max(1, Math.min(RANK.max, Math.ceil(quota / 4.5))), ranks = [];
  for (let left = Math.max(1, quota | 0); left > 0 && ranks.length < SLOTS;) { const r = Math.min(top, left); ranks.push(r); left -= r; }
  const team = ranks.map(r => { const pool = poolFor(r - 1).filter(sp => SP[sp] && !SP[sp].immortal); return newGu(pickDao(rng, pool, o.dao, daoOf, SHOP.foeDaoP), r); });
  return autoPlace(arrangeTeam(team));
}

// ---------- 布阵：站位效果与敌方排阵 ----------
// 每个下标收到哪些站位效果（界面画箭头/角标用）：[{ to, from, id, txt }]，to = -1 表示作用于敌方
function posLinks(team) {
  const out = [], n = team.length, tv = (g, id) => natOf(g.sp) === id ? 1 : 0;
  team.forEach((g, i) => {
    let v;
    if ((v = tv(g, 'legacy')) && i + 1 < n) out.push({ to: i + 1, from: i, id: 'legacy', txt: `攻血 +${8 * v}%` });
    if ((v = tv(g, 'war'))) out.push({ to: 0, from: i, id: 'war', txt: `攻 +${3 * v}%/回合` });
    if ((v = tv(g, 'link'))) [i - 1, i + 1].forEach(j => { if (j >= 0 && j < n) out.push({ to: j, from: i, id: 'link', txt: `攻血 +${5 * v}%` }); });
    if (tv(g, 'guard')) [i - 1, i + 1].forEach(j => { if (j >= 0 && j < n) out.push({ to: j, from: i, id: 'guard', txt: '代受一击' }); });
    if ((v = tv(g, 'vanguard')) && i === 0) out.push({ to: 0, from: 0, id: 'vanguard', txt: `攻 +${4 * v}% 血 +${8 * v}%` });
    if ((v = tv(g, 'snipe')) && i > 0) out.push({ to: -1, from: i, id: 'snipe', txt: `射敌末位 ${20 * v}% 攻` });
  });
  return out;
}
// 详情面板里「作用到谁」的一句话
function posNote(team, i, id) {
  const nm = j => team[j] ? (SP[team[j].sp] ? SP[team[j].sp].n : '') : '';
  const adj = [i - 1, i + 1].filter(j => team[j]).map(nm).join('、');
  switch (id) {
    case 'legacy': return team[i + 1] ? `身后：${nm(i + 1)}` : '身后没有友蛊，暂时落空';
    case 'war': return `最前：${nm(0)}`;
    case 'link': return adj ? `相邻：${adj}` : '没有相邻友蛊';
    case 'guard': return adj ? `护住：${adj}` : '没有相邻友蛊';
    case 'vanguard': return i === 0 ? '正站最前，生效' : '不在最前，暂不生效';
    case 'snipe': return i > 0 ? '在后排，生效' : '站在最前，暂不生效';
    case 'split': return '分影出现在它身后';
    case 'spawn': return '蛊蛹在原位补上';
  }
  return '';
}
// 敌方排阵：给每种排列打分取最高（不跑战斗，够快）
function formScore(t) {
  let s = 0; const n = t.length;
  t.forEach((g, i) => {
    const k = natOf(g.sp), T = k ? { [k]: 1 } : {}, q = [], A = g.atk / STAT_SCALE, h = g.hp / STAT_SCALE + 3 * (T.shell || 0) + 2 * (T.guard || 0);   // 攻血按放大前的量级打分，和下面的常数对得上
    if (i === 0) s += h * 1.3 + A * 0.5 + 2.5 * (T.thorn || 0) + 2 * (T.frenzy || 0) + 1.5 * (T.split || 0) + 4 * (T.vanguard || 0) - 4 * (T.snipe || 0) - 2 * (T.war || 0) - 1.5 * (T.legacy || 0) - (q.includes('timid') ? 4 : 0) + (q.includes('lastgasp') ? 2 : 0);
    else s += 3 * (T.snipe || 0) + (n - i) * 0.15 * h;
    if (T.legacy && t[i + 1]) s += T.legacy * (1 + 0.15 * t[i + 1].atk / STAT_SCALE);
    if (T.link) s += 1.5 * T.link * ((i > 0) + (i < n - 1));
    if (T.guard) s += i === 1 ? 4 : i > 1 ? 1 : 0;
  });
  return s;
}
function arrangeTeam(team) {
  const n = Math.min(team.length, SLOTS); if (n < 2) return team;
  let best = team.slice(), bs = formScore(best);
  const perm = (a, k) => { if (k === a.length) { const sc = formScore(a); if (sc > bs + 1e-9) { bs = sc; best = a.slice(); } return; } for (let i = k; i < a.length; i++) { [a[k], a[i]] = [a[i], a[k]]; perm(a, k + 1); [a[k], a[i]] = [a[i], a[k]]; } };
  if (n <= 5) perm(team.slice(0, n), 0);
  else {   // 6–7 只时全排列太多（5040 种），改为逐对交换的爬山：一直换到没有更好的排法为止
    let cur = team.slice(0, n), cs = formScore(cur), up = true;
    while (up) { up = false; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { [cur[i], cur[j]] = [cur[j], cur[i]]; const sc = formScore(cur); if (sc > cs + 1e-9) { cs = sc; up = true; } else [cur[i], cur[j]] = [cur[j], cur[i]]; } }
    if (cs > bs) { bs = cs; best = cur; }
  }
  team.splice(0, n, ...best); return team;
}

const GHOST_NAMES = ['夜码人', '零点蛊师', '断点散人', '递归僧', '缓存道人', '并发狂徒', '栈溢出', '空指针', '热重载', '回滚真人', '合并冲突', '无限循环'];

// ---------- 界壁坐标码：阵容 → 位流 → base64url ----------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const SPI = Object.fromEntries(SPECIES.map((s, i) => [s.id, i]));
const FDI = Object.fromEntries(FOODS.map((f, i) => [f.id, i]));
// 蛊性表由秘境一侧维护（XING，顺序只能往后加）；坐标码按下标记
const XING = {};
const XING_KEYS = () => Object.keys(XING);
function utf8(s) { return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Buffer.from(s, 'utf8'); }
function unutf8(b) { return typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(new Uint8Array(b)) : Buffer.from(b).toString('utf8'); }
// v1–v4 是旧玩法的码（带词条、怪癖、附蛊、道痕），照旧能读：只取物种和转数，攻血按新表换算。
// v5（v2 玩法）：物种 7 位、转数 3 位、攻血各 10 位、挂件食物 6 位、蛊性 6 位，外加 1 位「试玩」
// v6（阵盘）：v5 每只蛊后面再加 阵盘格 4 位（0–8，15 = 没摆）、速 8 位（0 = 按物种）。v1–v5 解出来按顺序自动摆进阵盘
// v7（额度）：和 v6 一样，只是只数字段从 3 位改成 4 位（阵盘最多 9 只）
// v8（数值放大十倍）：版本字段写 0 再跟 3 位扩展号（8 = 7 + 1），攻血各 12 位；v5–v7 的攻血是放大前的数，解出来乘 STAT_SCALE
const OLD_W = { 1: { sp: 4, tr: 4, q: 3, st: 8, mk: 0, rk: 0 }, 2: { sp: 4, tr: 4, q: 3, st: 8, mk: 12, rk: 2 }, 3: { sp: 6, tr: 6, q: 4, st: 10, mk: 16, rk: 3 }, 4: { sp: 6, tr: 6, q: 4, st: 10, mk: 16, rk: 3, fl: 1 } };
const W5 = { sp: 7, rk: 3, st: 10, fd: 6, xg: 6 }, ST8 = 12;
function encodeTeam(team, meta = {}) {
  let bits = ''; const put = (v, n) => { bits += Math.max(0, Math.min(2 ** n - 1, Math.round(v) || 0)).toString(2).padStart(n, '0'); };
  const nm = Array.from(utf8((meta.name || '').slice(0, 8))).slice(0, 31);
  put(0, 3); put(1, 3); put(meta.realm || 0, 3); put(Math.min(SLOTS, team.length), 4); put(nm.length, 5); nm.forEach(b => put(b, 8)); put(meta.trial ? 1 : 0, 1);
  const xk = XING_KEYS();
  for (const g of team.slice(0, SLOTS)) {
    put(SPI[g.sp], W5.sp); put(rankOf(g), W5.rk); put(g.atk, ST8); put(g.hp, ST8);
    put(g.food && FDI[g.food] != null ? FDI[g.food] + 1 : 0, W5.fd); const xi = g.xing ? xk.indexOf(g.xing) : -1; put(xi + 1, W5.xg); put(g.boss ? 1 : 0, 1);
    const k = cellOf(g); put(k >= 0 && k <= 8 ? k : 15, 4); put(g.spd || 0, 8);
  }
  while (bits.length % 6) bits += '0';
  let out = ''; for (let i = 0; i < bits.length; i += 6) out += B64[parseInt(bits.slice(i, i + 6), 2)];
  return out;
}
function decodeTeam(code) {
  try {
    const m = String(code).match(/[A-Za-z0-9_-]{8,}/); if (!m) return null;
    let bits = ''; for (const ch of m[0]) { const i = B64.indexOf(ch); if (i < 0) return null; bits += i.toString(2).padStart(6, '0'); }
    let p = 0; const get = n => { if (p + n > bits.length) throw 0; const v = parseInt(bits.slice(p, p + n), 2); p += n; return v; };
    let ver = get(3); if (ver === 0) ver = 7 + get(3); if (ver < 1 || ver > 8) return null;
    const realm = get(3), n = get(ver >= 7 ? 4 : 3), nl = get(5), nm = []; for (let i = 0; i < nl; i++) nm.push(get(8));
    const team = []; let trial = false;
    if (ver >= 5) {
      trial = !!get(1); const xk = XING_KEYS(), sw = ver >= 8 ? ST8 : W5.st, sx = ver >= 8 ? 1 : STAT_SCALE;
      for (let i = 0; i < n; i++) {
        const sp = SPECIES[get(W5.sp)]; if (!sp) return null;
        const rank = Math.max(1, Math.min(6, get(W5.rk))), g = { uid: nuid(), sp: sp.id, rank, atk: Math.max(1, get(sw) * sx), hp: Math.max(1, get(sw) * sx), food: null, xing: null };
        const fi = get(W5.fd); if (fi && FOODS[fi - 1]) g.food = FOODS[fi - 1].id; const xi = get(W5.xg); if (xi && xk[xi - 1]) g.xing = xk[xi - 1]; if (get(1)) g.boss = 1;
        if (ver >= 6) { const k = get(4); if (k <= 8) g.pos = cellPos(k); const sp2 = get(8); if (sp2) g.spd = sp2; }
        team.push(g);
      }
    } else {
      const W = OLD_W[ver]; if (W.mk) get(W.mk); if (W.fl) trial = !!get(W.fl);
      for (let i = 0; i < n; i++) {
        const sp = SPECIES[get(W.sp)]; if (!sp) return null;
        get(W.st); get(W.st); get(2);
        const nt = get(3); for (let j = 0; j < nt; j++) { get(W.tr); get(2); }
        const nq = get(2); for (let j = 0; j < nq; j++) get(W.q);
        const na = get(2); for (let j = 0; j < na; j++) get(W.sp);
        get(18); get(7); const boss = get(1); const rk = W.rk ? get(W.rk) : 0;
        const rank = ver >= 3 ? Math.max(1, Math.min(6, rk)) : Math.min(RANK.max, baseRank(sp.id) + rk);
        const g = newGu(sp.id, rank); if (boss) g.boss = 1; team.push(g);
      }
    }
    if (!team.length) return null;
    autoPlace(team);
    return { team, realm, name: unutf8(nm), trial, old: ver < 5 };
  } catch (e) { return null; }
}

// 战斗手感：暴击概率与倍数（种子随机，复盘可复现）
const BATTLE = { crit: 0.10, critMul: 2 };
// 战斗回放节奏（毫秒，1 倍速基准）。界面按 playMs 自动缩放，使一局约 15–25 秒
const EV_MS = { begin: 900, turn: 220, clash: 640, hit: 60, dmg: 200, buff: 110, trig: 300, combo: 1700, comboQuiet: 180, summon: 260, faint: 400, status: 160, end: 300 };
function playMs(log) {
  const seen = new Set(); let t = 0;
  for (const e of log) t += e.t === 'dmg' ? (e.k === 'hit' ? EV_MS.hit : EV_MS.dmg) : e.t === 'combo' ? ((e.quiet || seen.has(e.uid)) ? EV_MS.comboQuiet : (seen.add(e.uid), EV_MS.combo)) : (EV_MS[e.t] || 0);
  return t;
}
const tempoFor = ms => Math.min(2.3, Math.max(0.6, 20000 / Math.max(1, ms)));
function fmtNum(n) { n = Math.round(n || 0); const a = Math.abs(n); return a >= 1e8 ? (n / 1e8).toFixed(a >= 1e10 ? 0 : 2) + '亿' : a >= 1e4 ? (n / 1e4).toFixed(a >= 1e6 ? 0 : 1) + '万' : String(n); }
function fmtTok(n) { n = n || 0; return n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n)); }

// ---- src/battle.js（包一层，只放出 export）
const { HPK, DIST, SPD_K, MAXROUND, RES_K, TUNE, GP, CRIT, NAT_K, battleProfile, synergyOf, encodeReplay, decodeReplay, layoutOf, skillText, predictOrder, battle } = (() => {
// 蛊码 GuCode · 斗蛊引擎 v2（纯函数，种子随机，可复现）。规格见 docs/battle-spec.md，规则见 docs/design.md 2.5 / 3.5 / 第 8 节。
// 双方各一块 3×3 阵盘（列 c：0 前 1 中 2 后；行 r：0–2）。速度决定出手顺序（行动条），出手和挨打攒蛊力，蛊力满了放主动技；
// 近战打同一行最靠前的敌蛊（这一行没人打最近的一行），远程按 aim 挑；技能有形状和位移。输出事件流 + 每步快照，渲染层只负责回放。






// HPK：战斗血量 = 卡面血 × HPK；DIST：行动条长度（速 100 的蛊每 DIST 个时间单位出手一次 = 一轮）
// SPD_K：速对出手间隔的影响系数（速 120 的蛊出手频率 = 1 + 0.2 × SPD_K 倍），让速度有意义又不一边倒
const HPK = 4;
const DIST = 100;
const SPD_K = 0.18;
const MAXROUND = 30;
const ROWS = 3, COLS = 3;
// RES_K：道共鸣数值整体折算（design.md 2.6：道共鸣只给轻量加成，配合比堆道重要）
const RES_K = 0.5;
// 状态与杀招的总体强度（模拟按道、杀招、单种蛊的胜率调）：灼烧每轮伤害、毒每轮伤害、寒每层减速、杀招效果
const TUNE = { burn: 1, psn: 1, chill: 0.15, combo: 1 };
const GP = { act: 34, charge: 60, hit: 15, cap: 100, start: 20 };
const CRIT = { p: 0.1, mul: 1.5 };
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
const NAT_K = {};   // 本命技第二卷全部写成声明式（按 up 随转数涨），旧的钩子折算表作废
const NAT_K0 = 1;   // 声明式本命技没写 hooks 时补空表，BX 派发不报错

const prof = sp => {
  const s = SP[sp] || {}, d = DEF[sp] || [100, s.school === '护体' || s.school === '减伤' ? 'm' : 'm', 'pounce'];
  const reach = s.reach || (d[1] === 'r' ? 'ranged' : 'melee');
  return { spd: s.spd || d[0], reach, aim: s.aim || d[3] || 'low', atkFx: s.atkFx || d[2] || (reach === 'ranged' ? 'needle' : 'pounce'), act: s.act || null };
};
const battleProfile = prof;   // 蛊卡/蛊典显示速、近远程、主动技用

// ---------- 羁绊：道共鸣、杀招（核心蛊定品级）、进阶杀招、道痕相冲 ----------
const TIER_IDX = { 0: 0, 2: 1, 4: 2, 6: 3 };
const comboDef = c => ({ ...(DEF_COMBO[c.id] || {}), ...c });
function synergyOf(team) {
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
  const sps = new Set(T.filter(Boolean).map(g => g.sp));
  let formed = COMBOS.filter(c => c.need.every(x => sps.has(x)));
  const replaced = new Set(formed.filter(c => c.from).map(c => c.from));
  formed = formed.filter(c => !replaced.has(c.id)).sort((a, b) => (b.from ? 1 : 0) - (a.from ? 1 : 0));
  const taken = new Set(), combos = [];
  for (const c of formed) {
    const core = c.core || c.need[0], idx = T.findIndex((g, i) => g && g.sp === core && !taken.has(i)); if (idx < 0) continue;
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
function encodeReplay(o) { const s = (o.sota && o.sota[0] ? 1 : 0) + (o.sota && o.sota[1] ? 2 : 0); return [o.A, o.B, o.seed, (o.kind || 'd')[0], s].join('.'); }
function decodeReplay(text) {
  const m = String(text || '').match(/r=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([0-9a-z]+)(?:\.([tgd]))?(?:\.([0-3]))?/); if (!m) return null;
  const A = decodeTeam(m[1]), B = decodeTeam(m[2]); if (!A || !B) return null;
  const s = +(m[5] || 0), kind = m[4] || 'd', sota = [!!(s & 1), !!(s & 2)];
  return { A, B, codeA: m[1], codeB: m[2], seed: m[3], kind, sota, replay: encodeReplay({ A: m[1], B: m[2], seed: m[3], kind, sota }) };
}

// ---------- 阵盘摆放：蛊带 pos { r, c }；没有 pos（旧数据）的按一排顺序自动摆：第 i 只 → 列 floor(i / 3)，行按 中、上、下 ----------
function layoutOf(team) {
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
// text 是数据里的大白话说明（随转数变的数已换成这一转的值），后面括号补一句这一转的实际数字（按 statFor 的攻血；血按战斗里的血 = 卡面血 × HPK）。
// 觉醒没到的标 locked: true，数字按觉醒那一转（三转 / 五转）算，方便预告。opts.est === false 时不补括号。
const ACT_UP = 0.12;
const scaleAt = (e, r, isAct) => 1 + (e.up != null ? e.up : isAct ? ACT_UP : 0) * Math.max(0, r - 1);
const actPct = (t, k) => k === 1 ? t : t.replace(/(攻击|攻 ?\+|最大血量|血量的?) ?(\d+)%/g, (m, w, x) => `${w}${/\+$/.test(w) ? '' : ' '}${Math.round(+x * k)}%`.replace('  ', ' '));
function effNote(list, r, isAct, st) {
  const parts = [];
  for (const e of list || []) {
    if (parts.length >= 2) break;
    const k = scaleAt(e, r, isAct), num = (x, base) => Math.round(base * x * k);
    const v = Math.round(((e.atk || 0) * st.atk + (e.a0 || 0) * st.atk + (e.mx || 0) * st.mx + (e.n || 0) * st.atk + (e.tatk || 0) * st.atk + (e.tmx || 0) * st.mx) * k + (e.flat || 0));
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
function skillText(sp, rank, opts = {}) {
  const s = SP[sp]; if (!s) return [];
  const r0 = Math.max(baseRank(sp), Math.min(6, rank | 0 || baseRank(sp))), est = opts.est !== false;
  const stAt = r => { const x = statFor(sp, r); return { atk: x.atk, mx: x.hp * HPK }; };
  const nk = natOf(sp), nt = nk && NEW_TRAITS[nk], act = prof(sp).act, out = [];
  const natD = r => nt ? (nt.src ? nt.src.d.replace(/〔(\d+)〕/g, (_, x) => String(Math.round(+x * natK(r)))) : nt.d ? nt.d(1, 2) : '') : '';
  const natAw = (i, r) => nt && nt.src && nt.src.aw && nt.src.aw[i] ? nt.src.aw[i].replace(/〔(\d+)〕/g, (_, x) => String(Math.round(+x * natK(r)))) : '';
  if (nt) out.push({ kind: 'passive', n: nt.n, trig: nt.trig || '', text: natD(r0) + (est ? effNote(nt.eff, r0, false, stAt(r0)) : '') });
  if (act) { const k = 1 + ACT_UP * (r0 - 1); out.push({ kind: 'active', n: act.n, cap: act.cap || GP.cap, text: actPct(act.d || '', k) + (est ? effNote(act.eff, r0, true, stAt(r0)) : '') }); }
  [3, 5].forEach((at, i) => {
    const r = Math.max(r0, at), st = stAt(r), lines = [];
    const pt = natAw(i, r); if (pt) lines.push({ of: 'passive', n: nt.n, text: pt + (est ? effNote(nt.awEff && nt.awEff[i], r, false, st) : '') });
    if (act && act.awd && act.awd[i]) lines.push({ of: 'active', n: act.n, text: actPct(act.awd[i], 1 + ACT_UP * (r - 1)) + (est ? effNote(act.aw && act.aw[i], r, true, st) : '') });
    if (!lines.length) return;
    out.push({ kind: i ? 'aw5' : 'aw3', n: i ? '五转觉醒' : '三转觉醒', at, locked: r0 < at, lines, text: lines.map(l => `${l.of === 'active' ? '主动技' : '被动技'}「${l.n}」：${l.text}`).join('；') });
  });
  return out;
}

function predictOrder(units, round, n = 8) {
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
function battle(ta, tb, seed, opts = {}) {
  if (!opts || Array.isArray(opts) || typeof opts !== 'object') opts = {};
  const rng = makeRng(seed), lite = !!opts.lite, maxR = opts.maxRounds || MAXROUND;
  const so = opts.sota || {}, sota = [!!(so[0] || so.A), !!(so[1] || so.B)], sotaAcc = [0, 0];   // sota 认 [a, b] 或 { A, B }
  let ops = 0, uidc = 0, now = 0, round = 0, cur = null, acts = 0, deadCell = null;
  const roster = {}, log = [], S = [[], []], all = [], sideF = [{}, {}], told = new Set();
  const alive = u => u && u.hp > 0 && !u.dead;
  const allies = u => S[u.side].filter(alive), foes = u => S[1 - u.side].filter(alive);
  const iv = u => ivOf(u.spd);
  const snap = () => S.map(a => a.map(u => [u.uid, u.atk, Math.max(0, u.hp), u.sh, u.gp | 0, Math.round(u.spd), u.r, u.c]));
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
  const noSyn = opts.noSyn || [], syn = [tA, tB].map((T, s) => noSyn[s] ? { daos: [], combos: [], clashes: [], line: '' } : synergyOf(T));   // noSyn：模拟用，关掉某一方的羁绊做对照
  syn.forEach((sy, s) => sy.combos.forEach(c => {
    const u = S[s].find(x => x.src === c.idx), C = comboDef(COMBOS.find(x => x.id === c.id)); if (!u) return;
    u.combo = c.id; u.cname = c.n; u.cmul = c.mul; roster[u.uid].combo = { id: c.id, n: c.n, mul: c.mul };
    if (C.eff) u.dx.push({ src: { kind: 'combo', key: 'cb', mul: c.mul * TUNE.combo, combo: 1 }, list: C.eff.map(e => ({ when: C.when, ...e })) });
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
  const scaleOf = (u, e, src) => src.mul || (1 + (e.up != null ? e.up : src.kind === 'act' ? 0.12 : 0) * Math.max(0, (u.rank || 1) - 1));
  const amount = (u, t, e, c, k) => {
    let v = 0;
    if (e.atk) v += u.atk * e.atk; if (e.a0) v += (u.a0 || u.atk) * e.a0; if (e.mx) v += u.mx * e.mx;
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
      u.f.cnt[key] = used + 1; m *= e.v != null ? e.v : 1;   // v: 0 = 这一下全免（伤害最少仍记 1）
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
      case 'st': tgs.forEach(t => addSt(t, e.k, e.n, amount(u, t, e, c, k), u)); break;
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
      ev('cast', { uid: u.uid, n: u.act.n, fx: u.act.fx || 'pounce', tg: pre.map(x => x.uid), cells: cellsOf(pre), shape: L[0] && L[0].shape || 'one' });
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

return { HPK, DIST, SPD_K, MAXROUND, RES_K, TUNE, GP, CRIT, NAT_K, battleProfile, synergyOf, encodeReplay, decodeReplay, layoutOf, skillText, predictOrder, battle };
})();
// ---- src/art2.js（包一层，只放出 export）
const { ART2, guSVG2 } = (() => {
// 蛊码 GuCode · 蛊典扩充的水墨蛊虫（与 art.js 同一套笔法：头朝右，viewBox 0 0 100 100；w = 淡彩晕染层，b = 墨色主体层，
// 由 guSVG 套 #wash / #ink 两个滤镜）。集成：Object.entries(ART2).forEach(([k, v]) => { A[k] = () => v; })。
// 先做同族部件（甲虫、蛛、蚁、翅、节肢、尾针），再组合出每只蛊的识别点。
const INK = '#1c1915', PAPER = '#efe7d4';
const aE = (cx, cy, rx, ry, f = INK, r = 0, ex = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}"${r ? ` transform="rotate(${r} ${cx} ${cy})"` : ''}${ex}/>`;
const aC = (cx, cy, r, f = INK, ex = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}"${ex}/>`;
const aP = (d, w = 2, s = INK, f = 'none', ex = '') => `<path d="${d}" stroke="${s}" stroke-width="${w}" fill="${f}" stroke-linecap="round" stroke-linejoin="round"${ex}/>`;
const aF = (d, f = INK, ex = '') => `<path d="${d}" fill="${f}"${ex}/>`;
const aLegs = arr => arr.map(([x, y, kx, ky, dx, dy, w]) => aP(`M${x} ${y} L${x + kx} ${y + ky} L${x + dx} ${y + dy}`, w || 1.8)).join('');
const eye = (x, y, r = 1.7) => aC(x, y, r, PAPER);
const g = (inner, t = '', ex = '') => `<g${t ? ` transform="${t}"` : ''}${ex}>${inner}</g>`;
const R = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');

// ---------- 部件 ----------
// 侧视甲虫：鞘翅 + 前胸 + 头 + 三对腿。o 可调鞘翅大小、腿长、是否画中缝
const beetle = (o = {}) => {
  const { x = 48, y = 58, rx = 24, ry = 13, hx = x + rx + 9, hy = y - 1, hr = 6.5, leg = 13, lw = 2, seam = true } = o;
  return aLegs([[x - rx * 0.45, y + ry * 0.55, -4, leg * 0.5, -8, leg], [x, y + ry * 0.7, 0, leg * 0.5, -1, leg], [x + rx * 0.5, y + ry * 0.55, 4, leg * 0.5, 9, leg * 0.9]].map(l => [...l, lw]))
    + aE(x, y, rx, ry) + aE(x + rx * 0.82, y - 1, rx * 0.36, ry * 0.72) + aC(hx, hy, hr)
    + (seam ? aP(`M${x - rx * 0.9} ${y - ry * 0.25} Q${x} ${y - ry * 0.75} ${x + rx * 0.62} ${y - ry * 0.5}`, 1.1, PAPER) : '');
};
// 俯视蛛：头胸 + 腹 + 八条折腿
const spider = (cx, cy, s = 1, ab = 1) => {
  let b = '';
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sy]) => {
    [[-12, 0.95], [-5, 1.1], [3, 1.05], [10, 0.9]].forEach(([dx, k]) => {
      const x0 = cx + 4 * s + dx * 0.25 * s, y0 = cy, kx = x0 + dx * 0.9 * s, ky = cy + sy * 12 * s * k, ex = kx + dx * 0.5 * s + (dx > 0 ? 4 : -4) * s, ey = ky + sy * 8 * s;
      if (sx > 0) b += aP(`M${x0} ${y0} Q${kx} ${ky - sy * 3 * s} ${kx} ${ky} L${ex} ${ey}`, 1.6 * Math.sqrt(s));
    });
  });
  return b + aE(cx - 8 * s, cy, 11 * s * ab, 9 * s * ab) + aE(cx + 7 * s, cy, 6.5 * s, 5.5 * s) + aC(cx + 12.5 * s, cy - 1.5 * s, 0.9 * s, PAPER) + aC(cx + 12.5 * s, cy + 1.5 * s, 0.9 * s, PAPER);
};
// 侧视蚁：腹、腰结、胸、头、肘状触角、六足
const ant = (x = 50, y = 58, s = 1, gaster = 1) => aLegs([[x - 2 * s, y + 3 * s, -6 * s, 8 * s, -11 * s, 15 * s, 1.5], [x + 2 * s, y + 3 * s, 0, 9 * s, -2 * s, 16 * s, 1.5], [x + 5 * s, y + 3 * s, 6 * s, 8 * s, 11 * s, 15 * s, 1.5]])
  + aE(x - 20 * s * gaster, y + 1 * s, 13 * s * gaster, 9 * s * gaster, INK, -8) + aC(x - 7 * s, y + 1.5 * s, 2.6 * s) + aE(x + 2 * s, y - 0.5 * s, 7.5 * s, 4.5 * s, INK, -10) + aC(x + 14 * s, y - 4 * s, 6 * s)
  + aP(`M${x + 16 * s} ${y - 9 * s} L${x + 20 * s} ${y - 19 * s} L${x + 29 * s} ${y - 16 * s}`, 1.3) + aP(`M${x + 19 * s} ${y + 0 * s} q6 1 8 -3 M${x + 19 * s} ${y + 1.5 * s} q5 3 8 1`, 1.4) + eye(x + 16 * s, y - 5 * s, 1.3 * s);
// 透明长翅（蜻蜓、蜉蝣、蝉）：墨色半透 + 宣纸翅脉
const glassWing = (d, op = '.32', vein = '') => aF(d, INK, ` fill-opacity="${op}"`) + (vein ? aP(vein, 0.8, PAPER) : '');
// 宽翅（蝶、蛾）
const broadWing = (d, op = '.9') => aF(d, INK, ` fill-opacity="${op}"`);
// 节段躯干：一串椭圆
const segs = (pts, f = INK) => pts.map(([x, y, rx, ry, r]) => aE(x, y, rx, ry, f, r || 0)).join('');
// 方孔钱
const coin = (x, y, r = 7, f = INK) => aC(x, y, r, f) + aF(`M${x - r * 0.3} ${y - r * 0.3} h${r * 0.6} v${r * 0.6} h${-r * 0.6} Z`, PAPER) + aC(x, y, r * 0.78, 'none', ` stroke="${PAPER}" stroke-width=".7"`);
// 冰晶
const flake = (x, y, r) => R(3, i => { const a = i * Math.PI / 3, dx = Math.cos(a) * r, dy = Math.sin(a) * r; return aP(`M${(x - dx).toFixed(1)} ${(y - dy).toFixed(1)} L${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)}`, 1); });
// 闪电
const bolt = (x, y, s = 1, w = 1.6, c = INK) => aP(`M${x} ${y} l${4 * s} ${7 * s} l${-3 * s} ${1 * s} l${5 * s} ${8 * s}`, w, c);

// ---------- 52 只新蛊 ----------
const A2 = {
  // —— 凡人 ——
  ant: () => ({ w: aE(40, 60, 26, 13, '#9a4a2c'), b: ant(50, 58, 1.15) + aP('M69 54 l6 -1 M69 57 l6 1', 1.6) }),
  firefly: () => ({
    w: aC(24, 62, 15, '#d6c25a') + aC(24, 62, 8, '#e7d77a'),
    b: aF('M54 50 Q40 34 30 40 Q40 46 50 54 Z', INK, ' fill-opacity=".35"') + beetle({ x: 50, y: 60, rx: 20, ry: 9, hr: 5, leg: 10, lw: 1.5 })
      + aE(30, 62, 9, 7, PAPER, 0, ` stroke="${INK}" stroke-width="2"`) + aP('M27 59 l-3 -2 M26 63 l-4 0 M28 66 l-3 3', 1, INK) + aP('M80 55 q6 -10 14 -12 M80 56 q8 -6 15 -4', 1.1) + eye(80, 58, 1.2),
  }),
  stick: () => ({
    w: aP('M10 60 L92 52', 9, '#7d9a5a'),
    b: aP('M12 61 L78 53', 4.2) + [24, 38, 52, 66].map(x => aP(`M${x} ${61 - (x - 12) * 0.12 - 3.5} l0 7`, 1.3, PAPER)).join('') + aE(82, 52.5, 6, 3.2, INK, -6)
      + aLegs([[30, 59, -6, 12, -14, 26, 1.2], [44, 58, 2, 13, -2, 28, 1.2], [58, 56, 8, 12, 16, 26, 1.2], [66, 55, 10, -10, 22, -14, 1.1]])
      + aP('M86 51 q6 -4 9 -12 M86 53 q7 -1 10 -6', 0.9) + eye(84, 51.5, 1),
  }),
  leech: () => ({
    w: aP('M14 66 C30 40 52 82 70 52 S88 46 92 52', 14, '#7c2b2b'),
    b: aP('M14 66 C30 40 52 82 70 52 S86 46 90 52', 10) + R(9, i => { const t = 18 + i * 8; return aP(`M${t} ${44 + Math.sin(i * 0.9) * 10} l1 12`, 0.9, PAPER, 'none', ' opacity=".7"'); })
      + aC(14, 66, 6) + aC(14, 66, 2.6, PAPER) + aC(90, 52, 4.5) + aP('M91 49 l3 -2 M92 52 l3 0 M91 55 l3 2', 0.9),
  }),
  dung: () => ({
    w: aC(30, 60, 20, '#a8803e'),
    b: aC(30, 60, 18, INK, ' fill-opacity=".82"') + aP('M18 52 q8 -6 16 -3 M16 64 q9 4 18 0 M24 72 q6 2 12 -1', 1.1, PAPER) + aP('M12 79 L90 79', 1.6)
      + beetle({ x: 64, y: 62, rx: 15, ry: 10, hr: 5, leg: 9, lw: 2.2, seam: false }) + aLegs([[52, 64, -6, -2, -12, -4, 2.4], [53, 67, -5, 4, -12, 8, 2.4]])
      + aP('M87 60 l5 -3 l2 2 M87 63 l5 0', 1.6) + eye(84, 60, 1.2),
  }),
  tiger: () => ({
    w: aE(46, 58, 28, 12, '#3f7a5a'),
    b: aLegs([[38, 64, -8, 8, -18, 18, 1.4], [48, 66, 0, 9, 2, 19, 1.4], [58, 64, 9, 8, 20, 17, 1.4]]) + aE(46, 58, 20, 9) + aE(66, 57, 6, 5.5) + aC(76, 56, 6)
      + [36, 46, 56].map(x => aE(x, 55.5, 2.2, 1.4, PAPER)).join('') + aC(77, 52, 2.4, PAPER) + aC(77.5, 52, 1)
      + aP('M80 58 q8 -1 9 6 q-4 -3 -7 -2', 1.8, INK, INK) + aP('M80 60 q7 3 6 9', 1.6) + aP('M78 51 q6 -9 14 -10', 1),
  }),
  webspider: () => ({
    w: aC(50, 50, 30, '#6b7f90'),
    b: R(8, i => { const a = i * Math.PI / 4 + 0.2; return aP(`M50 50 L${(50 + Math.cos(a) * 42).toFixed(1)} ${(50 + Math.sin(a) * 42).toFixed(1)}`, 0.7); })
      + [12, 22, 32].map(r => aP(R(9, i => { const a = i * Math.PI / 4 + 0.2; return `${i ? 'L' : 'M'}${(50 + Math.cos(a) * r).toFixed(1)} ${(50 + Math.sin(a) * r).toFixed(1)} `; }), 0.7)).join('')
      + spider(52, 54, 0.95),
  }),
  aphid: () => ({
    w: aE(50, 62, 34, 14, '#8fae5c'),
    b: aP('M8 74 Q50 66 94 72', 2.2) + [[30, 62, 1], [56, 60, 1.25], [76, 66, 0.8], [18, 68, 0.7]].map(([x, y, s]) =>
      aE(x, y, 9 * s, 6.5 * s, INK, -8) + aC(x + 9 * s, y - 2 * s, 3.4 * s) + aP(`M${x - 6 * s} ${y - 4 * s} l-3 ${-5 * s} M${x - 3 * s} ${y - 5 * s} l-1 ${-5 * s}`, 1.1) + aLegs([[x - 2 * s, y + 5 * s, -2, 3, -4, 6, 1], [x + 3 * s, y + 5 * s, 1, 3, 2, 6, 1]]) + aP(`M${x + 11 * s} ${y - 4 * s} q4 -6 9 -6`, 0.8)).join(''),
  }),
  hairy: () => {
    const pts = [[18, 70], [27, 69], [35, 61], [43, 51], [52, 47], [60, 52], [68, 59], [76, 61]];
    let b = aP('M16 70 Q30 71 38 57 Q46 43 56 47 Q64 51 70 59 Q76 63 84 60', 11);
    b += pts.map(([x, y], i) => R(6, k => { const a = -Math.PI * (0.12 + k * 0.15) + (i < 3 ? -0.15 : i > 5 ? 0.15 : 0), L = 9 + (k % 2) * 4; return aP(`M${x} ${y - 3} l${(Math.cos(a) * L).toFixed(1)} ${(Math.sin(a) * L).toFixed(1)}`, 0.85); })).join('');
    b += [[20, 74], [28, 73], [66, 64], [74, 66]].map(([x, y]) => aP(`M${x} ${y} l0 5`, 2)).join('') + aC(86, 60, 6) + eye(88, 58, 1.3) + aP('M91 63 l3 3', 1.4);
    return { w: aP('M14 70 Q30 70 38 56 Q46 42 56 46 Q66 52 72 60 Q78 63 88 60', 22, '#c8a440'), b };
  },
  cent: () => {
    const pts = Array.from({ length: 13 }, (_, i) => [10 + i * 6.2, 60 + Math.sin(i * 0.62) * 11]);
    let b = pts.slice(0, 12).map(([x, y], i) => { const [nx, ny] = pts[i + 1], ang = Math.atan2(ny - y, nx - x), px = -Math.sin(ang), py = Math.cos(ang);
      return aP(`M${x} ${y} l${(px * 11 - Math.cos(ang) * 5).toFixed(1)} ${(py * 11 - Math.sin(ang) * 5).toFixed(1)} M${x} ${y} l${(-px * 11 - Math.cos(ang) * 5).toFixed(1)} ${(-py * 11 - Math.sin(ang) * 5).toFixed(1)}`, 1.2); }).join('');
    b += aP('M' + pts.map(p => p.join(' ')).join(' L'), 7.5) + pts.slice(1, 12).map(([x, y], i) => { const [nx, ny] = pts[i + 2], ang = Math.atan2(ny - y, nx - x); return aP(`M${(x - Math.sin(ang) * 3).toFixed(1)} ${(y + Math.cos(ang) * 3).toFixed(1)} L${(x + Math.sin(ang) * 3).toFixed(1)} ${(y - Math.cos(ang) * 3).toFixed(1)}`, 0.9, PAPER); }).join('');
    const [hx, hy] = pts[12]; b += aE(hx + 4, hy, 5.5, 4.5) + aP(`M${hx + 8} ${hy - 2} q6 -2 6 3 M${hx + 8} ${hy + 2} q6 2 6 -3`, 1.8) + aP(`M${hx + 6} ${hy - 3} q4 -10 12 -12 M${hx + 4} ${hy - 4} q-2 -10 4 -15`, 1) + aC(hx + 6, hy - 1.5, 1, PAPER);
    return { w: aP('M8 60 Q26 46 40 62 T80 60', 16, '#a8432a') + aC(pts[12][0] + 4, pts[12][1], 8, '#c0562e'), b };
  },
  // —— 一转 ——
  wasp: () => ({
    w: aE(34, 58, 18, 9, '#c78a2a', 20),
    b: glassWing('M56 50 Q58 22 76 18 Q72 36 60 52 Z', '.28', 'M58 48 Q64 32 74 20') + glassWing('M52 51 Q44 26 52 18 Q60 34 56 52 Z', '.22')
      + aE(33, 61, 17, 7.5, INK, 22) + [27, 34, 41].map(x => aP(`M${x} ${55 + (x - 27) * 0.4} l-4 9`, 2.2, PAPER)).join('') + aP('M18 68 L9 74', 2)
      + aC(50, 55, 1.6) + aE(58, 53, 7, 5) + aC(69, 50, 5.2) + eye(71, 49, 1.2) + aP('M71 46 q4 -8 12 -10 M70 46 q1 -8 6 -12', 1)
      + aLegs([[55, 57, -3, 9, -6, 18, 1.2], [59, 57, 0, 10, 1, 20, 1.2], [62, 56, 4, 9, 9, 17, 1.2]]),
  }),
  spider: () => ({
    w: aE(38, 56, 24, 20, '#7a6488'),
    b: spider(56, 56, 1.35, 1.05) + R(9, i => aC(30 + (i % 3) * 6 + (i > 5 ? 2 : 0), 49 + Math.floor(i / 3) * 6, 1.6, PAPER)),
  }),
  mole: () => ({
    w: aE(48, 74, 40, 10, '#8a6a42'),
    b: aP('M6 76 Q30 68 50 74 T94 72', 1.6) + R(6, i => aC(14 + i * 13, 80 + (i % 2) * 3, 1.4))
      + aE(44, 58, 22, 9, INK, -8) + aE(66, 54, 9, 7.5, INK, -14) + aC(77, 50, 5.5) + eye(79, 48, 1.2) + aP('M80 46 q5 -6 12 -6 M80 47 q6 -2 12 1', 1)
      + aP('M68 60 L78 66 M72 63 l4 -3 M75 65 l4 -2 M78 66 l5 -1', 3, INK) + aP('M60 60 L64 70', 2.2) + aP('M38 64 L30 72 M30 72 l-8 -2', 2.2) + aP('M24 56 L12 52 M24 59 L13 62', 1.1),
  }),
  gecko: () => ({
    w: aE(50, 54, 38, 26, '#7c8f7e'),
    b: aP('M38 53 Q24 55 18 64', 5) + aP('M18 64 Q14 71 18 77', 3) + aP('M18 77 Q22 83 29 82', 1.5)
      + aE(50, 52, 15, 6.5, INK, -4) + aE(65, 50.5, 5, 4.2) + aF('M67 46.5 Q80 44 89 50 Q80 56 67 54.5 Z')
      + [[59, 48, 63, 38, 69, 34], [59, 56, 63, 66, 69, 70], [41, 49, 37, 39, 43, 33], [41, 56, 37, 66, 43, 72]].map(([x, y, kx, ky, ex, ey]) => aP(`M${x} ${y} L${kx} ${ky} L${ex} ${ey}`, 2.4) + R(4, k => { const a = -1.1 + k * 0.7 + (ey < 50 ? -0.4 : 0.4); return aP(`M${ex} ${ey} l${(Math.cos(a) * 4).toFixed(1)} ${(Math.sin(a) * 4).toFixed(1)}`, 1) + aC((ex + Math.cos(a) * 4).toFixed(1), (ey + Math.sin(a) * 4).toFixed(1), 0.9); })).join('')
      + aC(80, 48.5, 1.8, PAPER) + aC(80.4, 48.5, 0.8) + R(6, i => aC(40 + i * 4, 51 - (i % 2), 0.9, PAPER, ' opacity=".7"')),
  }),
  qingfu: () => ({
    w: aE(44, 56, 24, 16, '#4f8a86') + aC(80, 72, 9, '#b8a050'),
    b: aE(42, 56, 20, 13) + aE(60, 53, 8, 6.5) + aC(68, 51, 3.5) + aP('M24 52 Q42 44 58 50', 1.1, PAPER) + aP('M26 60 Q40 66 56 60', 1.1, PAPER)
      + aLegs([[36, 66, -6, 4, -12, 10, 1.8], [48, 67, 0, 6, -2, 12, 1.8], [56, 63, 6, 4, 12, 8, 1.8]]) + eye(70, 50, 1.1)
      + aE(26, 36, 7, 4.5, INK, -20) + aC(32, 33, 2) + aP('M32 32 q4 -4 8 -4', 0.8) + coin(80, 72, 8),
  }),
  bomb: () => ({
    w: aE(16, 50, 16, 13, '#c0562e'),
    b: [[22, 54, 6, 4.5, '.3'], [14, 48, 8, 6, '.22'], [8, 40, 7, 5.5, '.16'], [18, 42, 5, 4, '.2']].map(([x, y, rx, ry, op]) => aE(x, y, rx, ry, INK, -20, ` fill-opacity="${op}"`)).join('') + aP('M32 58 L22 52 M32 59 L18 56 M32 60 L24 60', 0.9)
      + beetle({ x: 52, y: 60, rx: 18, ry: 11, hr: 5.5, leg: 11, lw: 1.8 }) + aP('M44 54 Q52 50 62 53', 1, PAPER) + aC(46, 60, 1.3, PAPER) + aC(54, 62, 1.3, PAPER)
      + aP('M80 57 q6 -6 12 -6 M80 58 q7 -2 12 1', 1) + eye(80, 59, 1.1),
  }),
  silk: () => ({
    w: aE(40, 60, 26, 15, '#d8cfae', -10),
    b: aP('M14 22 Q40 18 70 24', 2.4) + aP('M36 22 L38 46 M46 22 L44 47', 0.7) + aE(40, 60, 22, 13, INK, -10, ' fill-opacity=".8"')
      + R(6, i => aP(`M${22 + i * 7} ${52 - i * 1.4} Q${30 + i * 5} ${62} ${20 + i * 7} ${72 - i * 1.2}`, 0.7, PAPER, 'none', ' opacity=".55"')) + aP('M20 58 Q40 50 60 54 M20 64 Q40 72 60 62', 0.7, PAPER, 'none', ' opacity=".55"')
      + [[61, 54, 4.6], [67, 51, 4.4], [73, 49, 4.2]].map(([x, y, r]) => aC(x, y, r, '#e9e0c9', ` stroke="${INK}" stroke-width="1.6"`)) + aC(79, 47.5, 4.2) + eye(80.5, 46.5, 1) + aP('M83 50 l3 1', 1.2),
  }),
  mosq: () => ({
    w: aE(40, 62, 14, 7, '#a82e2e', 15),
    b: glassWing('M54 50 Q50 28 66 22 Q66 38 58 52 Z', '.25', 'M56 48 Q60 34 64 26') + aE(40, 61, 17, 4.5, INK, 15) + aE(40, 62, 10, 3, '#8a2222', 15, ' fill-opacity=".8"')
      + aE(58, 54, 6, 4.2) + aC(66, 51, 4) + eye(68, 50, 1.1) + aP('M69 52 L92 60', 1.2) + aP('M68 48 q5 -6 10 -6 M67 48 q3 -7 6 -9', 0.9)
      + aLegs([[56, 57, -10, 12, -22, 30, 1], [58, 57, -2, 14, -6, 34, 1], [60, 56, 10, 12, 22, 30, 1]]),
  }),
  rhino: () => ({
    w: aE(44, 60, 30, 16, '#5c3e28'),
    b: beetle({ x: 42, y: 62, rx: 24, ry: 14, hx: 76, hy: 62, hr: 6, leg: 12, lw: 2.8, seam: false }) + aP('M24 54 Q38 46 56 52', 1.6, PAPER) + aE(36, 56, 6, 2, PAPER, -10, ' opacity=".55"')
      + aF('M76 58 Q86 46 84 26 Q92 36 90 50 Q86 60 78 64 Z') + aP('M84 26 l4 -4 M84 26 l-3 -3', 2) + aF('M62 52 Q68 40 76 38 Q72 46 68 54 Z') + eye(79, 61, 1.1),
  }),
  gold: () => ({
    w: aE(48, 54, 30, 22, '#c69a2e'),
    b: aE(44, 54, 24, 18) + aE(70, 54, 9, 11) + aC(82, 54, 5.5) + aP('M22 54 L66 54', 1.2, PAPER) + aP('M26 42 Q46 36 64 44 M26 66 Q46 72 64 64', 1, PAPER)
      + [[34, 47], [46, 45], [34, 61], [46, 63], [56, 48], [56, 60]].map(([x, y]) => aC(x, y, 1.5, PAPER, ' opacity=".85"')).join('') + aE(38, 46, 9, 3, PAPER, -14, ' opacity=".35"')
      + aLegs([[40, 38, -2, -8, -8, -14, 2], [54, 38, 2, -8, 6, -14, 2], [40, 70, -2, 8, -8, 14, 2], [54, 70, 2, 8, 6, 14, 2], [64, 44, 6, -8, 12, -12, 1.8], [64, 64, 6, 8, 12, 12, 1.8]])
      + aP('M86 51 L92 46', 1.2) + aF('M92 46 l4 -4 l1 3 l-2 3 Z') + aP('M86 57 L92 62', 1.2) + aF('M92 62 l4 4 l1 -3 l-2 -3 Z'),
  }),
  // —— 二转 ——
  qant: () => ({
    w: aE(30, 60, 26, 17, '#a85232'),
    b: glassWing('M52 50 Q44 30 60 24 Q62 38 56 52 Z', '.22') + ant(56, 58, 1, 1.55) + R(4, i => aP(`M${16 + i * 8} ${50 + (i % 2)} q-2 9 1 18`, 1.1, PAPER, 'none', ' opacity=".6"')),
  }),
  flea: () => ({
    w: aE(46, 56, 22, 18, '#7a5032'),
    b: aP('M10 36 Q30 10 54 26', 1, INK, 'none', ' stroke-dasharray="2 3"') + aE(46, 56, 20, 15, INK, -12) + aC(66, 50, 6.5)
      + R(5, i => aP(`M${32 + i * 6} ${44 - i * 1.5} l-2 -4`, 1)) + aP('M38 66 L26 58 L22 80 l-6 3', 3.4) + aP('M48 70 L44 82 l-4 2', 2) + aP('M58 66 L64 80 l4 1', 2)
      + aP('M70 54 L80 58', 2) + eye(68, 48, 1.2) + aP('M70 45 q4 -5 9 -6', 0.9),
  }),
  bfly: () => ({
    w: aE(40, 32, 22, 16, '#3e5f9a') + aE(40, 78, 20, 13, '#3e5f9a'),
    b: broadWing('M54 50 Q46 14 22 14 Q10 24 18 40 Q30 50 52 52 Z') + broadWing('M54 56 Q48 90 26 90 Q14 82 22 68 Q34 58 52 54 Z', '.85')
      + aC(32, 30, 5, PAPER) + aC(32, 30, 2.4) + aC(32, 76, 4.2, PAPER) + aC(32, 76, 2) + aP('M24 22 Q36 36 50 48 M22 84 Q36 70 50 56', 0.8, PAPER)
      + aE(58, 53, 12, 3.6) + aC(71, 52, 3.4) + eye(72.5, 51.4, 1) + aP('M72 49 Q78 38 84 34 M72 50 Q80 42 88 40', 1) + aC(84, 34, 1.6) + aC(88, 40, 1.6),
  }),
  sleep: () => ({
    w: aE(48, 70, 36, 10, '#8e86b0'),
    b: aP('M10 76 Q48 64 92 74 Q50 84 10 76 Z', 1.4, INK, INK, ' fill-opacity=".25"') + aP('M48 74 Q48 70 50 70', 1)
      + aP('M64 58 C66 40 44 32 32 42 C22 50 26 66 40 66 C48 66 52 60 50 54', 13) + R(6, i => { const a = -0.4 + i * 0.75, cx = 44 + Math.cos(a) * 14, cy = 52 + Math.sin(a) * 12; return aC(cx, cy, 1, PAPER, ' opacity=".7"'); })
      + aC(64, 60, 6.5) + aP('M62 59 q2.5 2 5 0', 1.1, PAPER) + aP('M74 40 q3 -1 4 -4 M80 32 q2 -1 3 -3', 0.9, INK, 'none', ' opacity=".6"'),
  }),
  stag: () => ({
    w: aE(40, 60, 26, 14, '#6a2e22'),
    b: beetle({ x: 38, y: 62, rx: 22, ry: 12, hx: 68, hy: 60, hr: 6.5, leg: 12, lw: 2 }) + aE(64, 60, 8, 7)
      + aP('M70 56 Q84 40 92 46 M84 46 l-3 -5 M70 64 Q86 72 92 62 M86 68 l1 5', 3.2) + eye(70, 58, 1.1),
  }),
  glut: () => ({
    w: aE(44, 58, 32, 18, '#8a6a30'),
    b: segs([[24, 62, 9, 10], [36, 60, 11, 13], [50, 58, 12, 15]]) + aP('M56 44 Q76 40 80 54 L66 58 L80 62 Q76 76 56 72 Z', 1, INK, INK)
      + aF('M64 56 L80 54 L78 58 L80 62 L64 60 Z', PAPER) + R(4, i => aF(`M${66 + i * 3.5} 55 l1.6 3 l1.6 -3 Z`, INK)) + R(4, i => aF(`M${66 + i * 3.5} 61 l1.6 -3 l1.6 3 Z`, INK))
      + aC(62, 48, 2.2, PAPER) + aC(62.6, 48, 1) + [30, 42].map(x => aP(`M${x} ${48 + (x - 30) * 0.1} q-3 12 0 24`, 1, PAPER, 'none', ' opacity=".6"')).join(''),
  }),
  toad: () => ({
    w: aE(46, 60, 34, 20, '#6e7a3e'),
    b: aF('M14 72 Q14 46 40 40 Q62 36 76 46 Q86 54 82 64 Q74 74 50 74 Z') + aC(66, 42, 6) + aC(66, 41, 2.6, PAPER) + aC(66.5, 41, 1.2)
      + aP('M60 56 Q72 60 84 56', 1.3, PAPER) + R(10, i => aC(22 + (i * 7) % 40, 48 + (i * 11) % 18, 1.6 + (i % 3) * 0.5, PAPER, ' opacity=".75"'))
      + aP('M62 70 L66 80 l-4 2 M66 80 l4 1', 2.4) + aP('M24 70 Q12 78 18 84 l8 0', 3.2),
  }),
  cricket: () => ({
    w: aE(46, 58, 30, 12, '#6a4a22'),
    b: aP('M80 50 Q60 20 20 18 M80 51 Q66 30 34 26', 0.9) + aE(46, 58, 22, 8) + aP('M26 52 Q46 46 66 52', 1, PAPER) + aP('M30 56 l30 -2 M34 60 l26 -1', 0.7, PAPER)
      + aE(70, 56, 7, 6.5) + aC(78, 54, 5) + eye(80, 52, 1.1) + aP('M38 62 L22 48 L18 76 l-6 2', 3.2) + aP('M52 64 L50 76 l-4 2 M60 63 L66 74 l4 1', 1.6) + aP('M24 56 L12 60', 1.4),
  }),
  locust: () => {
    const one = aP('M80 52 q6 -6 10 -7', 1) + aE(48, 56, 24, 7.5, INK, -4) + aP('M26 54 Q48 48 70 52', 1, PAPER) + aE(72, 54, 6, 6) + aC(79, 53, 4.6) + eye(81, 51.5, 1)
      + aP('M44 60 L30 44 L24 72 l-5 2', 3) + aP('M58 62 L56 74 M64 61 L70 72', 1.6);
    return { w: aE(50, 58, 38, 14, '#9aa04a'), b: g(one, 'translate(-14 -20) scale(.7)', ' opacity=".28"') + g(one, 'translate(2 30) scale(.55)', ' opacity=".22"') + one };
  },
  // —— 三转 ——
  mirror: () => ({
    w: aC(44, 54, 26, '#8aa0b0'),
    b: aC(44, 54, 22) + aC(44, 54, 15, PAPER, ' opacity=".9"') + aP('M34 48 Q38 42 46 41', 2, INK, 'none', ' opacity=".55"') + aP('M36 60 Q42 66 52 64', 1.2, INK, 'none', ' opacity=".35"')
      + aC(44, 54, 22, 'none', ` stroke="${INK}" stroke-width="2.6"`) + aE(70, 54, 7, 8) + aC(80, 54, 5) + eye(82, 52, 1.1)
      + aLegs([[36, 33, -2, -6, -8, -12, 2], [52, 33, 2, -6, 6, -12, 2], [36, 75, -2, 6, -8, 12, 2], [52, 75, 2, 6, 6, 12, 2], [64, 47, 6, -6, 12, -10, 1.8], [64, 61, 6, 6, 12, 10, 1.8]])
      + aP('M84 51 q4 -5 9 -6 M84 57 q4 5 9 6', 1),
  }),
  hive: () => {
    const cells = [[34, 40], [46, 40], [28, 52], [40, 52], [52, 52], [34, 64], [46, 64], [40, 76]];
    return {
      w: aE(40, 56, 24, 30, '#c79a2e'),
      b: aP('M10 22 L70 22', 3) + aP('M40 22 L40 32', 2) + aF('M22 34 Q40 26 58 34 Q64 60 40 86 Q16 60 22 34 Z', INK, ' fill-opacity=".85"')
        + cells.map(([x, y]) => aP(R(7, i => { const a = i * Math.PI / 3 + Math.PI / 6; return `${i ? 'L' : 'M'}${(x + Math.cos(a) * 5.6).toFixed(1)} ${(y + Math.sin(a) * 5.6).toFixed(1)} `; }), 1, PAPER)).join('')
        + aC(46, 52, 2.4, PAPER) + g(aE(0, 0, 5, 3.2) + aP('M-2 -2 q-2 -6 4 -7 M1 -2 q4 -6 8 -3', 1, INK, INK, ' fill-opacity=".3"') + aC(5, -0.5, 2.2) + aP('M-2 -2.4 l0 4.8 M1 -2.8 l0 5.6', 0.9, PAPER), 'translate(76 50)'),
    };
  },
  fly: () => ({
    w: aE(48, 56, 26, 16, '#4a6a4a') + aC(70, 52, 7, '#8a2a22'),
    b: glassWing('M52 48 Q40 22 22 26 Q24 40 48 52 Z', '.3', 'M48 48 Q36 34 26 30 M44 50 Q34 42 26 40') + glassWing('M52 58 Q38 80 22 76 Q26 64 48 56 Z', '.25')
      + aE(44, 54, 15, 9) + aE(58, 54, 8, 8) + aC(68, 53, 6.5) + aC(71, 50, 3.6, '#7a2a20') + aC(71, 50, 3.6, 'none', ` stroke="${INK}" stroke-width="1"`)
      + R(9, i => aP(`M${36 + (i % 5) * 5} ${46 + Math.floor(i / 5) * 16} l${i % 2 ? 1 : -1} ${i < 5 ? -3 : 3}`, 0.9)) + aP('M73 57 l4 3 l2 -1', 1.4)
      + aLegs([[48, 62, -4, 8, -10, 14, 1.3], [56, 62, 0, 9, 0, 16, 1.3], [62, 61, 5, 8, 10, 14, 1.3]]),
  }),
  bury: () => ({
    w: aE(30, 74, 22, 8, '#d0d0c0') + aE(46, 56, 22, 12, '#c8642a'),
    b: aP('M10 78 Q20 70 36 74 Q46 70 52 74', 4, '#cfc4ab', 'none', ` stroke-opacity="1"`) + aP('M10 78 Q20 70 36 74 Q46 70 52 74', 1.2) + aC(10, 78, 3, '#cfc4ab', ` stroke="${INK}" stroke-width="1.2"`) + aC(52, 74, 3, '#cfc4ab', ` stroke="${INK}" stroke-width="1.2"`)
      + beetle({ x: 46, y: 56, rx: 20, ry: 10, hr: 5.5, leg: 10, lw: 1.8, seam: false }) + aF('M30 50 Q36 46 42 48 L40 56 Q34 56 28 56 Z', '#c8642a', ' fill-opacity=".9"') + aF('M46 48 Q54 46 60 50 L58 58 Q52 60 46 58 Z', '#c8642a', ' fill-opacity=".9"')
      + aP('M78 52 l5 -6 M78 52 l6 -2', 1) + aC(84, 46, 1.8) + aC(85, 50, 1.8) + eye(76, 54, 1.1),
  }),
  frost: () => ({
    w: aE(48, 46, 34, 16, '#8fb4c8'),
    b: glassWing('M64 44 Q46 24 18 28 Q40 38 62 46 Z', '.45', 'M60 44 Q42 32 24 30 M54 42 Q44 38 34 38') + glassWing('M64 47 Q44 58 18 58 Q40 50 62 48 Z', '.38', 'M60 48 Q42 54 26 56')
      + glassWing('M66 44 Q58 22 40 14 Q46 28 64 46 Z', '.28') + aP('M8 62 Q30 56 60 49', 3.2) + R(7, i => aP(`M${12 + i * 7} ${61 - i * 1.5} l0 3`, 0.8, PAPER)) + aE(66, 48, 5, 3.8) + aC(73, 46, 4) + aC(75, 44.6, 1.6, PAPER)
      + [[30, 32], [44, 52], [24, 54], [50, 30]].map(([x, y]) => aF(`M${x} ${y - 2} l1.2 2 l-1.2 2 l-1.2 -2 Z`, PAPER)) + [[80, 28], [86, 36], [20, 74]].map(([x, y]) => aF(`M${x} ${y - 2.4} l1.4 2.4 l-1.4 2.4 l-1.4 -2.4 Z`)),
  }),
  lure: () => ({
    w: aE(40, 42, 20, 26, '#a8608a') + aC(78, 74, 9, '#c88aa8'),
    b: aF('M50 58 Q36 10 20 18 Q14 30 22 48 Q32 60 50 60 Z', INK, ' fill-opacity=".9"') + aP('M26 50 L18 74', 2.6) + aF('M18 74 l-3 4 l5 -1 Z')
      + aC(28, 30, 4, PAPER) + aC(28, 30, 1.8) + aP('M24 22 Q34 38 48 56', 0.8, PAPER) + aP('M30 44 Q38 50 48 58', 0.8, PAPER)
      + aE(56, 62, 9, 3.2, INK, 20) + aC(64, 60, 3) + eye(65, 59.4, 0.9) + aP('M66 62 q6 2 6 7 q0 3 -3 3', 1) + aP('M64 57 Q66 46 72 42', 0.9) + aC(72, 42, 1.4)
      + R(5, i => { const a = i * Math.PI * 2 / 5; return aE((78 + Math.cos(a) * 5).toFixed(1), (74 + Math.sin(a) * 5).toFixed(1), 4, 2.4, INK, i * 72, ' fill-opacity=".55"'); }) + aC(78, 74, 2, PAPER) + aP('M78 80 L78 94', 1.4),
  }),
  antlion: () => ({
    w: aF('M8 34 L92 34 L56 78 L44 78 Z', '#c8ac72'),
    b: aP('M6 34 L44 78 M94 34 L56 78', 1.4) + R(6, i => aP(`M${16 + i * 4} ${42 + i * 6} L${84 - i * 4} ${42 + i * 6}`, 0.6, INK, 'none', ' stroke-dasharray="1.5 3" opacity=".7"'))
      + R(5, i => aC(30 + i * 9, 30 - (i % 2) * 2, 1.2)) + aE(46, 74, 9, 6.5) + aC(54, 70, 4.5)
      + aP('M56 67 Q66 58 70 64 M56 72 Q66 80 70 72', 2.2) + aLegs([[42, 78, -4, 3, -8, 4, 1.2], [48, 79, 2, 3, 4, 5, 1.2]]) + R(4, i => aP(`M${40 + i * 3} ${69} l-1 -3`, 0.9)),
  }),
  mayfly: () => ({
    w: aE(54, 36, 18, 20, '#c8b46a'),
    b: glassWing('M60 52 Q50 18 66 10 Q70 30 64 52 Z', '.3', 'M62 50 Q58 30 66 14 M64 50 Q66 34 68 20') + glassWing('M56 52 Q46 34 50 24 Q58 38 60 52 Z', '.22')
      + aP('M8 46 Q24 58 36 58 M10 54 Q24 60 36 59 M12 62 Q26 62 36 60', 0.9) + aP('M36 59 Q50 62 62 56', 3.6) + R(5, i => aP(`M${40 + i * 4.5} ${59.6 - i * 0.6} l0 2.6`, 0.7, PAPER))
      + aE(66, 55, 5, 4) + aC(73, 53, 3.6) + eye(74.5, 52, 1) + aLegs([[64, 58, 2, 8, 0, 15, 1], [67, 58, 6, 6, 10, 13, 1], [69, 56, 9, 2, 16, 4, 1]]),
  }),
  // —— 四转 ——
  thunder: () => ({
    w: aE(46, 56, 30, 18, '#5a5aa0'),
    b: beetle({ x: 46, y: 58, rx: 24, ry: 14, hr: 6, leg: 12, lw: 2.2, seam: false }) + aP('M28 48 L38 58 L34 60 L46 70', 2.4, PAPER) + aP('M48 46 L56 54 L52 56 L60 64', 1.8, PAPER)
      + bolt(80, 30, 1, 1.4) + bolt(18, 28, 0.8, 1.2) + aP('M84 54 q6 -8 10 -8 M84 55 q7 -3 10 -1', 1) + eye(82, 56, 1.1),
  }),
  tortoise: () => ({
    w: aE(46, 58, 34, 20, '#3e5a5a'),
    b: aLegs([[28, 66, -2, 6, -6, 12, 5], [44, 70, 0, 6, -2, 12, 5], [58, 68, 2, 6, 4, 12, 5]]) + aP('M18 66 L10 70', 3.2) + aF('M14 68 Q18 34 46 32 Q74 34 78 68 Z')
      + aP('M46 34 L46 66 M30 42 L36 54 L30 66 M62 42 L56 54 L62 66 M36 54 L56 54', 1.2, PAPER) + aP('M16 66 L78 66', 1.6, PAPER)
      + aP('M76 60 Q84 54 88 58', 5) + aC(89, 58, 4.5) + eye(91, 56.6, 1.1),
  }),
  puppet: () => ({
    w: aC(54, 24, 13, '#8a3030') + aE(54, 78, 12, 14, '#8a3030'),
    b: aP('M54 4 L54 16', 0.9) + spider(54, 24, 0.75) + aP('M44 30 L40 62 M54 32 L54 58 M64 30 L68 66 M50 32 L46 74 M58 32 L62 76', 0.6)
      + aC(54, 64, 4.5) + aP('M54 68 L54 80 M40 62 L54 72 L68 66 M54 80 L46 92 M54 80 L62 92', 2.2) + aP('M52 63 l1.5 0 M55.5 63 l1.5 0', 0.9, PAPER) + aP('M8 94 L92 94', 1.2),
  }),
  hairworm: () => ({
    w: aE(46, 80, 30, 6, '#6a7a86') + aE(50, 48, 28, 20, '#6a6a6a'),
    b: aP('M90 26 C72 26 74 52 56 54 C38 56 30 34 44 30 C58 26 64 48 48 62 C36 72 18 66 20 54 C22 44 36 46 40 56 C44 68 54 76 50 82', 2.4)
      + aE(50, 84, 16, 3, 'none', 0, ` stroke="${INK}" stroke-width="1"`) + aE(50, 84, 26, 5, 'none', 0, ` stroke="${INK}" stroke-width=".7" opacity=".6"`) + aC(90, 26, 1.8) + aP('M90 26 l4 -2', 1.2),
  }),
  urn: () => ({
    w: aE(44, 66, 24, 22, '#8a5a32'),
    b: aF('M30 40 Q22 50 22 64 Q22 84 44 86 Q66 84 66 64 Q66 50 58 40 Z') + aE(44, 40, 15, 4, '#3a3530') + aE(44, 39, 15, 4, 'none', ` stroke="${PAPER}" stroke-width="1"`)
      + aP('M26 76 Q44 82 62 76', 1.2, PAPER) + aF('M38 52 L50 52 L50 70 L38 70 Z', '#b5301f') + aP('M41 55 l6 0 M44 55 l0 12 M41 60 q3 2 6 0 M41 65 l6 0', 0.9, INK)
      + aP('M48 40 Q52 26 62 22 Q70 20 74 26', 4.4) + R(5, i => aP(`M${52 + i * 4} ${33 - i * 2.5} l-3 -3 M${52 + i * 4} ${33 - i * 2.5} l2 -4`, 1)) + aC(75, 27, 4) + eye(77, 26, 1) + aP('M78 29 q3 2 6 1 M78 30 q3 4 6 4', 1.3),
  }),
  hex: () => ({
    w: aE(40, 30, 22, 14, '#5a3a6a') + aE(40, 76, 22, 14, '#5a3a6a'),
    b: broadWing('M56 50 L14 16 Q8 34 24 46 Z') + broadWing('M56 56 L14 90 Q8 72 24 60 Z', '.88') + broadWing('M54 50 L34 40 Q38 48 52 52 Z', '.5') + broadWing('M54 56 L34 66 Q38 58 52 54 Z', '.5')
      + aC(26, 30, 4.2, PAPER) + aC(26, 30, 1.8) + aC(26, 76, 4.2, PAPER) + aC(26, 76, 1.8) + aP('M18 22 L50 48 M18 84 L50 58', 0.7, PAPER)
      + aE(62, 53, 13, 6.5) + aE(64, 53, 4.2, 3.4, PAPER, 0, ' opacity=".85"') + aC(62.6, 52.4, 1) + aC(65.4, 52.4, 1) + aP('M64 54.5 l0 2', 0.7) + aC(77, 53, 4) + eye(78.5, 52, 1)
      + aP('M79 50 Q84 42 90 40 M79 56 Q84 64 90 66', 1.2) + R(4, i => aP(`M${81 + i * 2.4} ${47 - i * 2} l2 -1 M${81 + i * 2.4} ${59 + i * 2} l2 1`, 0.7)),
  }),
  saw: () => {
    const ant = 'M78 54 Q86 22 56 14 Q32 10 16 28', ant2 = 'M80 56 Q96 34 84 16';
    return { w: aE(44, 62, 28, 11, '#3a4a6a'),
      b: aP(ant, 2.6) + aP(ant, 1.4, PAPER, 'none', ' stroke-dasharray="2.5 4.5"') + aP(ant2, 2.2) + aP(ant2, 1.2, PAPER, 'none', ' stroke-dasharray="2.5 4.5"')
        + beetle({ x: 44, y: 64, rx: 26, ry: 8.5, hx: 80, hy: 60, hr: 5.5, leg: 12, lw: 1.6, seam: false }) + [[30, 61], [40, 66], [50, 61], [58, 66], [24, 66]].map(([x, y]) => aE(x, y, 2.2, 1.6, PAPER)).join('') + eye(82, 59, 1) };
  },
  // —— 五转 ——
  dfly: () => ({
    w: aE(50, 50, 40, 22, '#4a7ab0'),
    b: glassWing('M64 46 Q46 22 12 24 Q16 34 62 50 Z', '.3', 'M60 46 Q40 32 18 28') + glassWing('M64 52 Q46 76 12 76 Q16 66 62 50 Z', '.3', 'M60 54 Q40 68 18 72')
      + glassWing('M66 46 Q60 18 34 10 Q38 22 64 48 Z', '.22') + glassWing('M66 54 Q60 82 34 90 Q38 78 64 52 Z', '.22')
      + aP('M8 50 L60 50', 3) + R(7, i => aP(`M${12 + i * 7} 48.5 l0 3`, 0.8, PAPER)) + aE(66, 50, 6, 4.5) + aC(75, 50, 5.5) + aC(77, 47, 2.4, PAPER) + aC(77, 53, 2.4, PAPER)
      + bolt(86, 20, 0.8, 1.3) + bolt(8, 62, 0.7, 1.1),
  }),
  orchid: () => ({
    w: aE(44, 56, 30, 24, '#d08aa8'),
    b: aF('M50 60 Q32 46 16 54 Q22 70 48 66 Z', INK, ' fill-opacity=".8"') + aP('M20 56 Q34 58 48 62', 0.8, PAPER) + aP('M50 60 L62 40', 4)
      + [[38, 66, 34, 80, -30], [48, 66, 54, 80, 30]].map(([x, y, ex, ey, r]) => aP(`M${x} ${y} L${ex} ${ey}`, 1.6) + aE((x + ex) / 2 + (r > 0 ? 3 : -3), (y + ey) / 2, 6, 3.4, INK, r, ' fill-opacity=".35"') + aE((x + ex) / 2 + (r > 0 ? 3 : -3), (y + ey) / 2, 6, 3.4, 'none', r, ` stroke="${INK}" stroke-width="1.2"`)).join('')
      + aF('M58 36 L74 30 L68 44 Z') + aC(70, 34, 2.2, PAPER) + aC(70.6, 34, 1) + aP('M62 44 L76 50 L70 60', 2.6) + aE(72, 47, 5, 2.6, INK, 25, ' fill-opacity=".4"') + aP('M68 32 q4 -10 12 -14 M70 31 q8 -6 16 -6', 1),
  }),
  taisui: () => ({
    w: aE(50, 56, 34, 22, '#c89a86'),
    b: aP('M8 76 L92 76', 1.4) + aF('M18 74 Q12 52 26 42 Q34 30 50 34 Q70 28 80 42 Q90 56 82 74 Z', INK, ' fill-opacity=".9"')
      + aP('M30 48 Q40 42 50 46 M56 42 Q66 40 74 48 M26 62 Q36 58 44 64 M58 60 Q68 56 78 62', 1.1, PAPER, 'none', ' opacity=".6"')
      + [[38, 54], [62, 50], [52, 62], [72, 64]].map(([x, y], i) => aC(x, y, 2.4 - (i % 2) * 0.6, PAPER) + aC(x + 0.4, y, 1)).join('')
      + aP('M28 76 q-2 6 -8 9 q-3 2 -6 1 M28 80 l4 6 M48 76 q1 8 -3 12 M48 82 l5 4 M68 76 q4 6 10 7 M74 80 l2 6', 0.9, INK, 'none', ' opacity=".8"'),
  }),
  yue: () => ({
    w: aE(46, 56, 34, 20, '#5a6470'),
    b: beetle({ x: 44, y: 60, rx: 28, ry: 17, hx: 82, hy: 62, hr: 6, leg: 12, lw: 3, seam: false })
      + aP('M20 58 L30 44 L36 52 L46 34 L56 50 L62 44 L70 56', 1.8, PAPER) + aP('M38 46 l4 2 M48 38 l-2 4', 0.9, PAPER) + aP('M20 64 Q44 70 70 64', 1, PAPER, 'none', ' opacity=".6"')
      + aP('M86 58 L92 52', 2.4) + eye(84, 61, 1.1),
  }),
  jinchan: () => ({
    w: aE(48, 58, 32, 20, '#c69a2e'),
    b: [0, 1, 2, 3].map(i => aE(28, 84 - i * 3.2, 12, 3, INK) + aE(28, 83.4 - i * 3.2, 12, 2.4, 'none', 0, ` stroke="${PAPER}" stroke-width=".6"`)).join('')
      + aF('M20 70 Q20 46 44 42 Q66 38 80 50 Q88 58 84 66 Q74 74 48 74 Z') + aC(68, 44, 5.5) + aC(68, 43, 2.4, PAPER) + aC(68.5, 43, 1.1)
      + R(7, i => aC(30 + (i * 9) % 36, 52 + (i * 7) % 14, 1.5, PAPER, ' opacity=".7"')) + aP('M62 72 L66 82 l-4 2 M66 82 l4 1', 2.6) + aP('M34 72 Q26 80 36 84', 3.2) + coin(88, 60, 5),
  }),
  // —— 六转仙蛊 ——
  guangyin: () => ({
    w: aC(52, 50, 38, '#c9a24a'),
    b: aC(52, 50, 38, 'none', ` stroke="${INK}" stroke-width="1.2" opacity=".55"`) + R(12, i => { const a = i * Math.PI / 6, r1 = i % 3 ? 35 : 32; return aP(`M${(52 + Math.cos(a) * r1).toFixed(1)} ${(50 + Math.sin(a) * r1).toFixed(1)} L${(52 + Math.cos(a) * 38).toFixed(1)} ${(50 + Math.sin(a) * 38).toFixed(1)}`, i % 3 ? 0.9 : 1.6); })
      + glassWing('M66 46 L10 54 L20 70 L66 58 Z', '.3', 'M64 49 L18 58 M62 54 L24 66 M44 52 L34 64') + glassWing('M66 44 L22 38 L16 48 L64 50 Z', '.22', 'M62 46 L24 42')
      + aE(58, 54, 13, 8.5) + aE(75, 53, 7, 8) + aC(79, 46, 3) + aC(79, 46, 1.3, PAPER) + aC(78, 60, 2.2) + aP('M83 55 l5 2', 1.4)
      + aLegs([[56, 60, 0, 6, -4, 12, 1.4], [62, 61, 2, 6, 4, 11, 1.4]]) + aP('M52 50 L52 22 M52 50 L68 62', 1.2, INK, 'none', ' opacity=".5"'),
  }),
  fate: () => ({
    w: aE(50, 50, 34, 34, '#4a4a7a'),
    b: aP('M14 12 L86 88 M86 12 L14 88 M50 6 L50 94 M6 50 L94 50', 0.6, INK, 'none', ' opacity=".7"') + aP('M14 30 Q50 40 86 30 M14 70 Q50 60 86 70', 0.6, INK, 'none', ' opacity=".6"')
      + aP('M6 82 Q30 60 50 52 Q70 44 94 20', 1.6, '#b5301f') + aP('M44 54 q4 -6 8 0 q-4 6 -8 0', 1.4, '#b5301f') + spider(56, 46, 1.05, 0.95),
  }),
  nirvana: () => ({
    w: aE(40, 30, 28, 22, '#c0442a') + aE(40, 76, 26, 18, '#d8742a'),
    b: broadWing('M56 52 Q50 30 40 22 Q42 30 34 26 Q36 16 26 10 Q24 22 16 20 Q20 32 12 34 Q24 44 54 54 Z') + broadWing('M56 56 Q48 76 38 84 Q38 76 30 82 Q30 90 20 94 Q22 84 14 82 Q22 72 54 56 Z', '.85')
      + aP('M24 22 Q38 36 52 50 M22 84 Q38 70 52 58', 0.8, PAPER) + aC(30, 34, 3, PAPER) + aC(30, 74, 2.6, PAPER)
      + aE(62, 54, 11, 4.4, INK, -12) + aC(73, 51, 3.6) + eye(74.4, 50.4, 1) + aP('M74 48 Q80 36 90 32 M74 49 Q84 42 92 42', 1) + R(4, i => aP(`M${77 + i * 3} ${44 - i * 3} l3 -1`, 0.8))
      + aP('M8 60 q4 -6 2 -12 M14 64 q5 -4 4 -10', 1.1, '#b5301f'),
  }),
};

// 召唤物：取本体缩小、淡一点
const mini = (sp, s = 0.72, op = '.75') => () => { const a = A2[sp](); return { w: g(a.w, `translate(${50 - 50 * s} ${54 - 54 * s}) scale(${s})`), b: g(a.b, `translate(${50 - 50 * s} ${54 - 54 * s}) scale(${s})`, ` opacity="${op}"`) }; };
Object.assign(A2, {
  antling: mini('ant'), aphidling: () => ({ w: aE(50, 60, 20, 10, '#8fae5c'), b: aE(46, 60, 14, 10, INK, -8) + aC(60, 56, 5) + aP('M38 54 l-4 -7 M42 52 l-1 -7', 1.4) + aLegs([[44, 68, -2, 4, -5, 9, 1.4], [52, 68, 1, 4, 3, 9, 1.4]]) + aP('M63 53 q5 -8 12 -8', 1) + eye(62, 55, 1.2) }),
  spiderling: mini('webspider', 0.7), fuzi: () => { return { w: aE(44, 56, 20, 13, '#4f8a86'), b: g(aE(42, 56, 20, 13) + aE(60, 53, 8, 6.5) + aC(68, 51, 3.5) + aP('M24 52 Q42 44 58 50', 1.1, PAPER) + eye(70, 50, 1.1) + aLegs([[36, 66, -6, 4, -12, 10, 1.8], [48, 67, 0, 6, -2, 12, 1.8], [56, 63, 6, 4, 12, 8, 1.8]]), 'translate(10 8) scale(.8)', ' opacity=".8"') }; },
  bee: () => ({ w: aE(46, 58, 18, 11, '#c79a2e'), b: glassWing('M54 50 Q50 30 64 26 Q64 40 58 52 Z', '.28') + aE(42, 60, 14, 9) + [36, 42, 48].map(x => aP(`M${x} ${52} q-2 8 0 16`, 2, PAPER)).join('') + aP('M28 62 L20 66', 2) + aC(60, 56, 6) + eye(62, 54, 1.2) + aP('M63 51 q4 -6 10 -7', 1) + aLegs([[44, 68, -2, 6, -6, 12, 1.3], [50, 68, 1, 6, 3, 12, 1.3]]) }),
  kuilei: () => ({ w: aE(50, 60, 16, 22, '#8a3030'), b: aP('M50 6 L50 30 M34 6 L36 50 M66 6 L64 54 M42 6 L42 80 M58 6 L58 82', 0.6) + aC(50, 36, 6) + aP('M50 42 L50 62 M36 50 L50 54 L64 54 M50 62 L42 82 M50 62 L58 82', 2.6) + aP('M47.5 35 l2 0 M51.5 35 l2 0', 1, PAPER) }),
});

const ART2 = Object.fromEntries(Object.entries(A2).map(([k, f]) => [k, f()]));
// 便于单独预览：与 art.js 的 guSVG 输出一致（需要页面里有 ART_DEFS 的 #ink / #wash）
function guSVG2(sp, o = {}) {
  const v = ART2[sp]; if (!v) return '';
  const size = o.size ? ` width="${o.size}" height="${o.size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${size} class="gsvg" aria-hidden="true"><g filter="url(#wash)" opacity=".5">${v.w}</g><g filter="url(#ink)">${v.b}</g></svg>`;
}

return { ART2, guSVG2 };
})();
// ---- src/art3.js（包一层，只放出 export）
const { ART3, HEAD3, BOX3 } = (() => {
// 蛊码 GuCode · 蛊典第二卷新 56 种的水墨蛊虫（与 art.js / art2.js 同一套笔法：viewBox 0 0 100 100，大多头朝右；
// w = 淡彩晕染层，b = 墨色主体层，由 guSVG 套 #wash / #ink 两个滤镜）。
// b 里不用 <g>：升转飞白要用 b 的形状做 clipPath（guSVG 会把 <g> 剥掉），所以主体尽量画成实心形状，粗身子用 tube 生成轮廓。
// 导出：ART3[id] = { w, b }；HEAD3[id] = 头的位置（五转头光画在这里）；BOX3[id] = 墨色主体的外框 [x, y, w, h]（升转晕染、小印按它摆）。
// 召唤物 6 种（虫草、新芽、魂体、半截地龙、骨灵、血神子）附在后面，取本体缩小或简笔。
const INK = '#1c1915', PAPER = '#efe7d4';
const n1 = v => +(+v).toFixed(1);
const aE = (cx, cy, rx, ry, f = INK, r = 0, ex = '') => `<ellipse cx="${n1(cx)}" cy="${n1(cy)}" rx="${n1(rx)}" ry="${n1(ry)}" fill="${f}"${r ? ` transform="rotate(${n1(r)} ${n1(cx)} ${n1(cy)})"` : ''}${ex}/>`;
const aC = (cx, cy, r, f = INK, ex = '') => `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" fill="${f}"${ex}/>`;
const aP = (d, w = 2, s = INK, f = 'none', ex = '') => `<path d="${d}" stroke="${s}" stroke-width="${w}" fill="${f}" stroke-linecap="round" stroke-linejoin="round"${ex}/>`;
const aF = (d, f = INK, ex = '') => `<path d="${d}" fill="${f}"${ex}/>`;
const aLegs = arr => arr.map(([x, y, kx, ky, dx, dy, w]) => aP(`M${n1(x)} ${n1(y)} L${n1(x + kx)} ${n1(y + ky)} L${n1(x + dx)} ${n1(y + dy)}`, w || 1.8)).join('');
const eye = (x, y, r = 1.7) => aC(x, y, r, PAPER);
const R = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');
const ln = (w, c = INK) => ` stroke="${c}" stroke-width="${w}"`;          // 给实心形状加描边
const op = v => ` fill-opacity="${v}"`;
const dash = (a = '2 3') => ` stroke-dasharray="${a}"`;
const pts = a => a.map(p => `${n1(p[0])} ${n1(p[1])}`).join(' L');

// ---------- 部件 ----------
// 沿曲线 fn(t) 的实心身子，半径 rf(t)，两头圆
const tube = (fn, rf, f = INK, ex = '', n = 28) => {
  const L = [], Rt = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y] = fn(t), [xa, ya] = fn(Math.max(0, t - 0.01)), [xb, yb] = fn(Math.min(1, t + 0.01));
    const dx = xb - xa, dy = yb - ya, d = Math.hypot(dx, dy) || 1, r = rf(t);
    L.push([x - dy / d * r, y + dx / d * r]); Rt.push([x + dy / d * r, y - dx / d * r]);
  }
  const [x0, y0] = fn(0), [x1, y1] = fn(1);
  return aF(`M${pts([...L, ...Rt.reverse()])} Z`, f, ex) + aC(x0, y0, rf(0), f, ex) + aC(x1, y1, rf(1), f, ex);
};
// 贝塞尔
const qb = (a, c, b) => t => [0, 1].map(k => (1 - t) * (1 - t) * a[k] + 2 * (1 - t) * t * c[k] + t * t * b[k]);
const cb = (a, c1, c2, b) => t => [0, 1].map(k => (1 - t) ** 3 * a[k] + 3 * (1 - t) ** 2 * t * c1[k] + 3 * (1 - t) * t * t * c2[k] + t ** 3 * b[k]);
// 沿曲线 fn 每隔一段画一道横纹（体节）
const rings = (fn, rf, n, w = 0.9, c = PAPER, t0 = 0.08, t1 = 0.92, ex = '') => R(n, i => {
  const t = t0 + (t1 - t0) * i / Math.max(1, n - 1), [x, y] = fn(t), [xb, yb] = fn(Math.min(1, t + 0.01)), dx = xb - x, dy = yb - y, d = Math.hypot(dx, dy) || 1, r = rf(t) * 0.85;
  return aP(`M${n1(x - dy / d * r)} ${n1(y + dx / d * r)} L${n1(x + dy / d * r)} ${n1(y - dx / d * r)}`, w, c, 'none', ex);
});
// 火舌：底在 (x, y)，高 h，半宽 w，尖头偏 dx
const flame = (x, y, h, w, dx = 0, f = INK, ex = '') => aF(`M${n1(x - w)} ${n1(y)} C${n1(x - w * 1.25)} ${n1(y - h * 0.45)} ${n1(x + dx - w * 0.55)} ${n1(y - h * 0.62)} ${n1(x + dx)} ${n1(y - h)} C${n1(x + dx + w * 0.1)} ${n1(y - h * 0.55)} ${n1(x + w * 1.2)} ${n1(y - h * 0.42)} ${n1(x + w)} ${n1(y)} Q${n1(x)} ${n1(y + w * 0.7)} ${n1(x - w)} ${n1(y)} Z`, f, ex);
// 六出冰晶（每臂带两根小枝）
const crystal = (x, y, r, w = 1, c = INK) => aP(R(6, i => {
  const a = i * Math.PI / 3 - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), mx = x + ca * r * 0.55, my = y + sa * r * 0.55, b = r * 0.32;
  return `M${n1(x)} ${n1(y)} L${n1(x + ca * r)} ${n1(y + sa * r)} M${n1(mx)} ${n1(my)} l${n1(Math.cos(a + 0.8) * b)} ${n1(Math.sin(a + 0.8) * b)} M${n1(mx)} ${n1(my)} l${n1(Math.cos(a - 0.8) * b)} ${n1(Math.sin(a - 0.8) * b)} `;
}), w, c);
// 闪电
const bolt = (x, y, s = 1, w = 1.6, c = INK) => aP(`M${x} ${y} l${n1(4 * s)} ${n1(7 * s)} l${n1(-3 * s)} ${n1(1 * s)} l${n1(5 * s)} ${n1(8 * s)}`, w, c);
// 叶片：叶柄在 (x, y)，朝 ang 度伸 len，半宽 wd
const leaf = (x, y, len, ang, wd, f = INK, vein = true) => {
  const a = ang * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), tx = x + ca * len, ty = y + sa * len, mx = x + ca * len * 0.45, my = y + sa * len * 0.45;
  return aF(`M${n1(x)} ${n1(y)} Q${n1(mx - sa * wd * 1.6)} ${n1(my + ca * wd * 1.6)} ${n1(tx)} ${n1(ty)} Q${n1(mx + sa * wd * 1.6)} ${n1(my - ca * wd * 1.6)} ${n1(x)} ${n1(y)} Z`, f)
    + (vein ? aP(`M${n1(x + ca * len * 0.1)} ${n1(y + sa * len * 0.1)} L${n1(x + ca * len * 0.8)} ${n1(y + sa * len * 0.8)}`, 0.7, PAPER) : '');
};
// 圆 1 减去圆 2 剩下的月牙
const lune = (x1, y1, r1, x2, y2, r2, f = INK, ex = '') => {
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy), a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const mx = x1 + dx * a / d, my = y1 + dy * a / d, p = [mx + h * dy / d, my - h * dx / d], q = [mx - h * dy / d, my + h * dx / d];
  return aF(`M${n1(p[0])} ${n1(p[1])} A${r1} ${r1} 0 ${a > 0 ? 1 : 0} 0 ${n1(q[0])} ${n1(q[1])} A${r2} ${r2} 0 ${a > d ? 1 : 0} 1 ${n1(p[0])} ${n1(p[1])} Z`, f, ex);
};
// 祥云：一道底线，两头卷、上面一个云头
const yun = (x, y, s = 1, w = 1.3, c = INK) => aP(`M${n1(x - 13 * s)} ${n1(y)} L${n1(x + 13 * s)} ${n1(y)} M${n1(x - 13 * s)} ${n1(y)} A${n1(4 * s)} ${n1(4 * s)} 0 1 1 ${n1(x - 9 * s)} ${n1(y - 4 * s)} A${n1(2 * s)} ${n1(2 * s)} 0 1 1 ${n1(x - 11 * s)} ${n1(y - 2 * s)}`
  + ` M${n1(x - 7 * s)} ${n1(y)} A${n1(6.5 * s)} ${n1(6.5 * s)} 0 0 1 ${n1(x + 5 * s)} ${n1(y - 3 * s)} A${n1(3 * s)} ${n1(3 * s)} 0 1 1 ${n1(x + 1 * s)} ${n1(y - 6 * s)} M${n1(x + 13 * s)} ${n1(y)} A${n1(4 * s)} ${n1(4 * s)} 0 0 0 ${n1(x + 9 * s)} ${n1(y - 4 * s)}`, w, c);
// 螺旋线
const spiral = (cx, cy, r0, turns, a0 = 0, w = 1, c = INK, ex = '') => {
  const N = Math.round(turns * 20), p = [];
  for (let i = 0; i <= N; i++) { const t = i / N, a = a0 + t * turns * Math.PI * 2, r = r0 * (1 - t * 0.85); p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return aP(`M${pts(p)}`, w, c, 'none', ex);
};
// 四角小星
const twinkle = (x, y, s = 2, c = INK) => aF(`M${n1(x)} ${n1(y - s * 1.6)} Q${n1(x + s * 0.25)} ${n1(y - s * 0.25)} ${n1(x + s * 1.6)} ${n1(y)} Q${n1(x + s * 0.25)} ${n1(y + s * 0.25)} ${n1(x)} ${n1(y + s * 1.6)} Q${n1(x - s * 0.25)} ${n1(y + s * 0.25)} ${n1(x - s * 1.6)} ${n1(y)} Q${n1(x - s * 0.25)} ${n1(y - s * 0.25)} ${n1(x)} ${n1(y - s * 1.6)} Z`, c);
// 绝对坐标的 M/L/Q/C 路径左右镜像（对 x = cx）
const flipX = (d, cx = 50) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${n1(2 * cx - +x)} ${y}`);
// 侧视甲虫（同 art2：鞘翅 + 前胸 + 头 + 三对腿）
const beetle = (o = {}) => {
  const { x = 48, y = 58, rx = 24, ry = 13, hx = x + rx + 9, hy = y - 1, hr = 6.5, leg = 13, lw = 2, seam = true } = o;
  return aLegs([[x - rx * 0.45, y + ry * 0.55, -4, leg * 0.5, -8, leg], [x, y + ry * 0.7, 0, leg * 0.5, -1, leg], [x + rx * 0.5, y + ry * 0.55, 4, leg * 0.5, 9, leg * 0.9]].map(l => [...l, lw]))
    + aE(x, y, rx, ry) + aE(x + rx * 0.82, y - 1, rx * 0.36, ry * 0.72) + aC(hx, hy, hr)
    + (seam ? aP(`M${n1(x - rx * 0.9)} ${n1(y - ry * 0.25)} Q${n1(x)} ${n1(y - ry * 0.75)} ${n1(x + rx * 0.62)} ${n1(y - ry * 0.5)}`, 1.1, PAPER) : '');
};
// 侧视蚁（同 art2）：腹、腰结、胸、头、肘状触角、六足
const ant = (x = 50, y = 58, s = 1, gaster = 1) => aLegs([[x - 2 * s, y + 3 * s, -6 * s, 8 * s, -11 * s, 15 * s, 1.5 * Math.sqrt(s)], [x + 2 * s, y + 3 * s, 0, 9 * s, -2 * s, 16 * s, 1.5 * Math.sqrt(s)], [x + 5 * s, y + 3 * s, 6 * s, 8 * s, 11 * s, 15 * s, 1.5 * Math.sqrt(s)]])
  + aE(x - 20 * s * gaster, y + 1 * s, 13 * s * gaster, 9 * s * gaster, INK, -8) + aC(x - 7 * s, y + 1.5 * s, 2.6 * s) + aE(x + 2 * s, y - 0.5 * s, 7.5 * s, 4.5 * s, INK, -10) + aC(x + 14 * s, y - 4 * s, 6 * s)
  + aP(`M${n1(x + 16 * s)} ${n1(y - 9 * s)} L${n1(x + 20 * s)} ${n1(y - 19 * s)} L${n1(x + 29 * s)} ${n1(y - 16 * s)}`, 1.3 * Math.sqrt(s)) + aP(`M${n1(x + 19 * s)} ${n1(y)} q${n1(6 * s)} ${n1(1 * s)} ${n1(8 * s)} ${n1(-3 * s)} M${n1(x + 19 * s)} ${n1(y + 1.5 * s)} q${n1(5 * s)} ${n1(3 * s)} ${n1(8 * s)} ${n1(1 * s)}`, 1.4 * Math.sqrt(s)) + eye(x + 16 * s, y - 5 * s, 1.3 * s);
// 透明长翅
const glassWing = (d, o = '.32', vein = '') => aF(d, INK, op(o)) + (vein ? aP(vein, 0.8, PAPER) : '');

// ---------- 56 只 ----------
const H = {};   // 头的位置
const A3 = {
  // ===== 力道 =====
  // 熊力蛊：熊一样隆起的背，抬起一只厚掌拍出去，掌前是震开的气浪
  xiongli: () => ({
    w: aE(46, 58, 32, 20, '#9a4a32') + aP('M90 48 q6 10 0 22', 5, '#b5301f'),
    b: aLegs([[28, 68, -1, 7, -3, 15, 5.5], [42, 71, 0, 6, -1, 13, 5.5], [58, 70, 2, 6, 4, 13, 5.5]])
      + aF('M16 72 Q12 46 34 38 Q52 31 64 40 Q72 48 70 62 Q67 74 50 74 L22 74 Q16 74 16 72 Z')
      + [[21, 49], [27, 44], [34, 40], [41, 37], [49, 35], [56, 36]].map(([x, y]) => aP(`M${x} ${y} l-2.5 -5`, 1.6)).join('')
      + aP('M26 58 q4 -3 8 0 M38 51 q4 -3 8 0 M30 65 q4 -3 8 0 M46 62 q4 -3 8 0', 1, PAPER, 'none', ' opacity=".6"')
      + aC(72, 42, 10) + aC(65.5, 32.5, 3.8) + aC(77, 31.5, 3.8) + aC(65.5, 32.5, 1.5, PAPER, ' opacity=".7"') + aC(77, 31.5, 1.5, PAPER, ' opacity=".7"')
      + aE(82, 46, 6, 4.4) + aC(87, 44.6, 1.1, PAPER) + eye(75, 39.5, 1.5) + aP('M70 33 q-3 -8 2 -14 M74 32 q5 -7 12 -8', 1.1)
      + aP('M60 55 L72 64 L84 59', 6.5) + aP('M85 55.5 l6 -3.5 M86 59 l6.5 0 M85 62.5 l6 2.5', 1.7)
      + aP('M93 50 q4 8 0 16 M97 46 q5 12 0 24', 1.2, INK, 'none', ' opacity=".7"'),
  }),
  // 擎天蛊（仙）：直立，四臂托着一方天，腿压弯了，背是直的；两侧祥云
  qingtian: () => ({
    w: aE(50, 19, 42, 10, '#c9a24a') + aE(50, 62, 22, 26, '#b07a3a'),
    b: aF('M10 21 Q10 13 20 13 L80 13 Q90 13 90 21 Q90 26 84 26 L16 26 Q10 26 10 21 Z')
      + yun(30, 22, 0.55, 1, PAPER) + yun(66, 22, 0.55, 1, PAPER) + aC(48, 18, 0.9, PAPER) + aC(82, 18, 0.9, PAPER) + aC(18, 18, 0.9, PAPER)
      + aP('M44 47 L32 38 L34 27', 3.2) + aP('M56 47 L68 38 L66 27', 3.2) + aP('M45 50 L26 44 L22 27', 2.2) + aP('M55 50 L74 44 L78 27', 2.2)
      + aP('M31 27 l-2 -2 M35 27 l1 -2 M65 27 l-1 -2 M69 27 l2 -2', 1.2)
      + aC(51, 39, 6.2) + eye(54, 38, 1.2) + aP('M56 42 l4 1.5 M56 43 l3 3', 1.3) + aP('M50 33 q-3 -3 -1 -6 M53 33 q3 -3 4 -6', 1)
      + aE(50, 50, 8, 6.5) + aE(50, 67, 11, 15.5) + aP('M40 62 Q50 66 60 62 M40 70 Q50 74 60 70 M42 77 Q50 80 58 77', 1.1, PAPER)
      + aLegs([[44, 58, -14, 10, -11, 28, 3.6], [56, 58, 14, 10, 11, 28, 3.6]])
      + aP('M8 87 L92 87', 1.5) + aP('M30 87 l-4 4 M34 87 l1 4 M66 87 l-1 4 M70 87 l4 4', 1)
      + yun(12, 54, 0.5, 1.1) + yun(88, 58, 0.5, 1.1),
  }),

  // ===== 炎道 =====
  // 火蚁蛊：蚁身，腹尾往上卷成一团火舌，大颚
  fireant: () => ({
    w: flame(28, 62, 34, 11, -8, '#c8402a') + aE(52, 66, 28, 9, '#d0632a'),
    b: aLegs([[47, 64, -6, 8, -11, 15, 1.6], [51, 64, 0, 9, -2, 16, 1.6], [54, 64, 6, 8, 11, 15, 1.6]])
      + flame(30, 58, 22, 7, -8) + flame(21, 62, 13, 4.5, -5) + flame(39, 58, 12, 4, -2)
      + aE(33, 63, 12.5, 8.5, INK, -12) + aP('M29 58 q-3 -6 -6 -10 M35 57 q-1 -5 -2 -8', 1, PAPER)
      + aC(46, 63.5, 2.5) + aE(54, 61.5, 7.5, 4.3, INK, -10) + aC(66, 57, 6) + eye(68, 55.5, 1.3)
      + aP('M70 59 q8 -1 10 4 M70 61.5 q7 4 10 2', 2) + aP('M67 52 L71 42 L80 44', 1.3)
      + aC(14, 34, 1.3) + aC(22, 26, 1) + aC(34, 30, 1.1),
  }),
  // 焚翅蛊：一双翅膀本身就是火，连尾巴尖都在烧，火星往下掉
  pyre: () => ({
    w: flame(42, 56, 46, 18, -12, '#d0632a') + aC(40, 38, 16, '#e08a3a'),
    b: aF('M50 57 C40 56 26 52 18 44 C14 38 16 30 12 24 C20 28 24 34 26 38 C28 32 26 26 26 20 C34 28 36 40 38 46 Z', INK, op('.45'))
      + aF('M54 54 C46 50 36 46 30 38 C27 30 32 22 28 12 C36 18 40 26 40 32 C42 24 42 16 47 7 C51 18 50 28 48 36 C52 30 56 26 59 19 C61 30 59 42 54 54 Z', INK, op('.9'))
      + aP('M51 50 Q42 40 44 26 M47 52 Q37 46 34 34 M53 48 Q54 38 57 28', 0.9, PAPER)
      + aE(38, 62, 15, 4.3, INK, 14) + aE(56, 56.5, 6.5, 4.6) + aC(65, 53.5, 4.2) + eye(66.6, 52.6, 1)
      + aP('M66 50 q4 -8 12 -10 M65 50 q1 -8 6 -12', 1) + aLegs([[54, 59, -2, 6, -5, 11, 1.2], [58, 59, 1, 6, 2, 11, 1.2]])
      + flame(24, 66, 9, 3, -4) + aC(20, 76, 1.5) + aC(30, 81, 1.1) + aC(14, 70, 1) + aC(40, 78, 0.9),
  }),
  // 炭甲蛊：一块棱角分明的炭，裂缝里透着红，头顶冒烟
  char: () => ({
    w: aE(46, 62, 30, 15, '#c0442a'),
    b: aLegs([[28, 70, -3, 6, -7, 12, 2.6], [43, 72, 0, 6, -1, 12, 2.6], [58, 70, 3, 6, 7, 12, 2.6]])
      + aF('M14 72 L18 54 L28 42 L45 35 L60 39 L70 51 L72 72 Z')
      + aP('M28 42 L35 56 L18 54 M35 56 L45 35 M35 56 L54 58 L60 39 M54 58 L70 51 M35 56 L29 72 M54 58 L56 72', 0.8, PAPER, 'none', ' opacity=".5"')
      + aP('M22 64 L30 60 L37 66 L46 62 M49 47 L55 51 L53 58 M61 62 L67 67', 1.7, '#d0632a')
      + aE(78, 64, 7, 6) + eye(80, 62, 1.2) + aP('M84 66 l5 1 M84 68 l4 3', 1.4) + aP('M80 59 q3 -6 9 -7', 1)
      + aP('M38 30 q-4 -5 0 -9 q4 -4 0 -9 M52 31 q3 -4 0 -8 q-3 -4 0 -7', 1, INK, 'none', ' opacity=".55"'),
  }),
  // 燧石蛊：两片打制石片似的鞘翅像蚌壳一样掀起，翅尖一碰迸出一团火星
  flint: () => {
    const shell = 'M64 58 L61 46 L53 39 L42 37 L32 40 L26 47 L25 58 Z', facet = 'M61 46 L48 51 L32 40 M48 51 L42 37 M48 51 L26 50';
    const rot = a => ` transform="rotate(${a} 64 58)"`;
    return {
      w: aC(30, 28, 13, '#e0a040') + aE(50, 64, 26, 10, '#8a6a4a'),
      b: aLegs([[40, 68, -4, 7, -9, 14, 1.9], [50, 70, 0, 7, -1, 14, 1.9], [60, 68, 4, 7, 9, 13, 1.9]])
        + aF(shell, INK, op('.62') + rot(56)) + aP(facet, 0.8, PAPER, 'none', ' opacity=".5"' + rot(56))
        + aE(46, 63, 19, 7.5) + aP('M32 61 Q34 66 32 69 M40 59 Q42 65 40 70 M48 58 Q50 64 48 70', 0.9, PAPER, 'none', ' opacity=".6"')
        + aF(shell, INK, rot(28)) + aP(facet, 0.8, PAPER, 'none', ' opacity=".6"' + rot(28))
        + aE(66, 60, 7, 6.2) + aC(76, 58, 5.5) + eye(78, 57, 1.1) + aP('M79 54 q5 -6 11 -6 M79 55 q6 -2 11 1', 1)
        + R(8, i => { const a = i * Math.PI / 4 + 0.3, r0 = 3.2, r1 = i % 2 ? 8 : 11.5; return aP(`M${n1(32 + Math.cos(a) * r0)} ${n1(28 + Math.sin(a) * r0)} L${n1(32 + Math.cos(a) * r1)} ${n1(28 + Math.sin(a) * r1)}`, 1.5); })
        + aC(32, 28, 1.8) + aC(18, 18, 1) + aC(44, 14, 1.1) + aC(16, 36, 0.9) + aC(48, 30, 0.8),
    };
  },
  // 熔岩蛊：又宽又扁的一块熔岩壳，壳缝里是流动的岩浆，壳底往下滴
  magma: () => ({
    w: aE(48, 82, 40, 6, '#d0632a') + aE(46, 62, 34, 14, '#c0442a'),
    b: aLegs([[24, 72, -2, 5, -5, 9, 3.4], [40, 74, 0, 5, -1, 9, 3.4], [56, 74, 0, 5, 1, 9, 3.4], [70, 72, 2, 5, 5, 9, 3.4]])
      + aF('M8 72 Q8 62 14 58 Q16 50 24 50 Q28 44 36 46 Q42 40 50 44 Q58 40 64 46 Q72 46 74 54 Q80 58 80 66 Q80 72 74 74 L14 74 Q8 74 8 72 Z')
      + aP('M13 66 L24 60 L22 52 M24 60 L38 63 L36 48 M38 63 L50 58 L50 46 M50 58 L64 62 L64 48 M64 62 L77 65', 1.9, '#e0742a')
      + aP('M30 74 q1 5 0 8 M58 74 q-1 4 0 6', 2.3, '#d0632a') + aC(30, 84, 1.7, '#d0632a') + aC(58, 82, 1.4, '#d0632a')
      + aF('M79 61 Q90 59 95 66 Q90 72 79 70 Z') + eye(88, 64.5, 1.1)
      + aC(30, 54, 1.4, PAPER, ' opacity=".6"') + aC(58, 50, 1.2, PAPER, ' opacity=".6"') + aC(44, 52, 0.9, PAPER, ' opacity=".6"'),
  }),

  // ===== 冰雪道 =====
  // 冰蚕蛊：一节节半透明的白蚕，前半身昂起，吐一缕冷丝，丝头结成冰晶
  snowsilk: () => ({
    w: aE(42, 64, 30, 12, '#9cc0d8') + aC(83, 27, 10, '#bcd6e6'),
    b: [[17, 71, 4.8], [25.5, 70.5, 5.8], [34.5, 69.5, 6.6], [43.5, 67.5, 7], [51.5, 63.5, 6.8], [57.5, 56.5, 6.2], [61.5, 48.5, 5.6]]
      .map(([x, y, r]) => aC(x, y, r, '#e3edf0', ln(2.2))).join('')
      + [[22, 76], [30, 76], [39, 75], [48, 73]].map(([x, y]) => aP(`M${x} ${y} l-1 4`, 1.8)).join('')
      + crystal(43.5, 67.5, 3, 0.8) + crystal(25.5, 70.5, 2.4, 0.8)
      + aC(64.5, 42, 5) + eye(66.6, 40.8, 1) + aP('M68.5 44 l3 1', 1.2)
      + aP('M69 42 Q77 40 75 32 Q73 24 81 22 Q88 21 86 27', 1) + crystal(84, 28, 5, 1.1) + crystal(18, 50, 3.2, 0.9),
  }),
  // 雪蚤蛊：斜着蹦起来，后腿还蹬在身后，雪地上溅起两团雪
  snowflea: () => ({
    w: aE(30, 82, 24, 6, '#a8c4d8') + aE(56, 44, 18, 14, '#7aa0bc'),
    b: aP('M6 85 Q20 81 34 85 T64 85', 1.4) + aC(22, 80, 3.2, PAPER, ln(1.2)) + aC(27.5, 81.5, 2.4, PAPER, ln(1.2)) + aC(17.5, 82.5, 2, PAPER, ln(1.1))
      + aP('M22 74 Q30 52 44 50', 1, INK, 'none', dash())
      + aP('M50 54 L38 59 L23 74', 3.4) + aP('M23 74 l-4 1', 2) + aP('M54 56 L45 65 L35 78', 2, INK, 'none', ' opacity=".7"')
      + aE(56, 46, 13.5, 10, INK, -35) + aC(68, 35.5, 6.2)
      + [[52, 44], [57, 40], [50, 50], [58, 47], [62, 43]].map(([x, y]) => aC(x, y, 1.3, PAPER, ' opacity=".85"')).join('')
      + aLegs([[63, 47, 6, 3, 11, 9, 1.4], [60, 50, 3, 6, 4, 12, 1.4]]) + eye(70.5, 34, 1.2) + aP('M72 30 q4 -6 11 -6 M71 30 q2 -6 6 -9', 1)
      + crystal(82, 60, 3, 0.9) + crystal(86, 18, 2.6, 0.9) + crystal(36, 26, 2.2, 0.8),
  }),
  // 冰蜗蛊：蜗牛，壳是一块多棱的冰，壳顶几根冰刺，身后一道结霜的黏迹
  icesnail: () => {
    const shell = Array.from({ length: 9 }, (_, i) => { const a = i / 9 * Math.PI * 2 - 0.3, r = 20 + (i % 2 ? 1.5 : -1); return [42 + Math.cos(a) * r, 50 + Math.sin(a) * r * 0.95]; });
    return {
      w: aE(46, 62, 32, 16, '#8fb4c8'),
      b: aF('M10 76 Q14 70 30 70 L66 70 Q74 66 76 58 Q80 53 84 57 Q87 66 82 72 Q78 78 66 78 L16 78 Q10 78 10 76 Z')
        + aP('M78 58 L83 42 M80 58 L90 46', 1.7) + aC(83, 41.5, 2) + aC(90.5, 45.5, 2)
        + aF(`M${pts(shell)} Z`) + spiral(42, 50, 15, 2.2, -1.2, 1.4, PAPER)
        + aF('M30 34 L31 22 L36 32 Z') + aF('M43 31 L47 17 L50 31 Z') + aF('M56 35 L63 26 L60 38 Z')
        + aP('M34 46 L38 40 M48 58 L52 62', 0.8, PAPER, 'none', ' opacity=".6"') + aC(85, 63, 1.1, PAPER)
        + aP('M4 81 L22 81', 1.1, INK, 'none', dash('2 2.5')) + crystal(12, 88, 2.8, 0.9) + crystal(26, 88, 2.2, 0.8),
    };
  },
  // 寒蝉蛊：深秋，竖着伏在一根枯枝上，翅上结霜，一叫满场噤声
  coldcicada: () => ({
    w: aE(54, 46, 20, 30, '#8aa4b8'),
    b: aP('M36 98 Q42 62 40 32 Q39 16 46 4', 4.2) + aP('M40 46 Q30 40 20 42', 2) + leaf(20, 42, 12, 120, 3, INK, false)
      + aF('M46 36 L41 66 L52 76 L63 66 L58 36 Z', INK, op('.5')) + aP('M52 38 L52 74 M47 40 L44.5 64 M57 40 L59.5 64', 0.8, PAPER)
      + aE(52, 52, 5.5, 14) + aE(52, 32, 7.5, 6) + aE(52, 24, 7.5, 5) + aC(45, 23, 2.5) + aC(59, 23, 2.5) + aC(44.6, 22.4, 0.9, PAPER) + aC(58.6, 22.4, 0.9, PAPER)
      + aP('M47 32 L42 30 M47 40 L42 43 M47 48 L43 53', 1.6)
      + crystal(60, 58, 2.6, 0.8, PAPER) + crystal(46, 64, 2, 0.7, PAPER)
      + aP('M64 16 q4 4 0 8 M68 13 q6 7 0 14 M72 10 q8 10 0 20', 1, INK, 'none', ' opacity=".55"')
      + crystal(80, 40, 3.4, 0.9) + crystal(76, 78, 2.8, 0.9) + leaf(80, 88, 9, 200, 2.6),
  }),
  // 雹甲蛊：背上一串冰疙瘩鼓出轮廓，头顶在下雹子
  hail: () => ({
    w: aE(46, 60, 30, 16, '#7aa0c0') + aE(48, 22, 30, 10, '#a8c4d8'),
    b: beetle({ x: 44, y: 64, rx: 24, ry: 12, hr: 6, leg: 11, lw: 2.2, seam: false })
      + [[25, 57, 4.2], [33, 52, 4.8], [43, 50, 5.2], [53, 51, 4.8], [61, 55, 4]].map(([x, y, r]) => aC(x, y, r) + aP(`M${n1(x - r * 0.55)} ${n1(y - r * 0.2)} Q${n1(x - r * 0.3)} ${n1(y - r * 0.65)} ${n1(x + r * 0.2)} ${n1(y - r * 0.6)}`, 0.9, PAPER)).join('')
      + [[22, 26, 3], [36, 17, 2.6], [52, 24, 3.2], [68, 15, 2.4], [80, 30, 2.8]].map(([x, y, r]) => aC(x, y, r) + aC(x - r * 0.35, y - r * 0.35, r * 0.35, PAPER) + aP(`M${x + 1} ${n1(y - r - 1.5)} l1 -5`, 0.8, INK, 'none', ' opacity=".6"')).join('')
      + eye(78.5, 62, 1.2) + aP('M82 58 q5 -6 11 -6 M82 59 q6 -2 11 1', 1),
  }),
  // 玄冰蛊：一簇往上戳的黑冰棱柱，冰里探出头和腿
  glacier: () => ({
    w: aE(46, 58, 34, 24, '#5a7a9a'),
    b: aF('M18 76 L21 47 L29 35 L34 50 L32 76 Z') + aF('M28 76 L34 40 L42 16 L50 40 L48 76 Z') + aF('M44 76 L52 34 L60 25 L64 46 L62 76 Z') + aF('M58 76 L66 53 L74 46 L74 76 Z')
      + aP('M42 17 L42 74 M29 36 L27 74 M60 26 L56 74 M74 47 L68 74', 0.9, PAPER, 'none', ' opacity=".55"') + aP('M36 34 L38 28 M54 36 L57 31', 1.2, PAPER, 'none', ' opacity=".8"')
      + aF('M14 76 L80 76 L76 81 L18 81 Z')
      + aLegs([[26, 80, -2, 5, -6, 10, 2.6], [44, 80, 0, 5, -1, 10, 2.6], [62, 80, 2, 5, 6, 10, 2.6]])
      + aE(84, 70, 7, 6) + eye(86, 68, 1.2) + aP('M90 72 l4 1 M90 74 l3 3', 1.3) + aP('M87 65 q3 -6 9 -7', 1)
      + crystal(88, 42, 3.6, 1) + crystal(12, 30, 3, 0.9),
  }),

  // ===== 金道 =====
  // 玉皮蛊：一只玉色的鼠妇，背上一节节，刀痕只留一道白印
  yupi: () => ({
    w: aE(48, 62, 32, 14, '#7fae96'),
    b: R(7, i => aP(`M${24 + i * 8} 71 l${i < 3 ? -1.5 : 1.5} 6`, 1.5))
      + aF('M14 71 Q14 45 46 43 Q76 43 82 66 Q82 72 76 72 L18 72 Q14 72 14 71 Z', '#aac8b2', ln(2.4))
      + R(5, i => aP(`M${30.5 + i * 9.5} 71 Q${32.5 + i * 9.5} 56 ${36.5 + i * 9.5} 45`, 1.2))
      + aE(38, 51, 10, 2.4, '#eaf2e8', -8, ' opacity=".75"')
      + aP('M30 52 L60 64', 3.4) + aP('M30 52 L60 64', 1.6, '#fbf8ee')
      + aE(83, 66, 5, 4.6) + eye(84.6, 64.6, 1.1) + aP('M85 63 q6 -6 12 -4 M85 64 q7 -2 11 2', 1.1),
  }),
  // 锁甲蛊：一片扣一片的拱形甲（像穿山甲），尾巴上还拖着两节锁环
  lockarm: () => ({
    w: aE(50, 60, 34, 14, '#a8803e'),
    b: aLegs([[34, 70, -2, 6, -5, 12, 2.6], [50, 71, 0, 6, -1, 12, 2.6], [64, 70, 2, 6, 5, 12, 2.6]])
      + [[14, 7.5, 10], [24, 9, 15], [36, 10, 19], [50, 9.5, 18], [62, 8, 13]].map(([x, r, h]) => aF(`M${x} 71 A${r} ${h} 0 0 1 ${x + 2 * r} 71 Z`) + aP(`M${n1(x + r * 1.05)} ${n1(71 - h)} A${r} ${h} 0 0 1 ${x + 2 * r} 71`, 1.6, PAPER) + aC(x + 2 * r - 2.4, 66, 1.1, PAPER)).join('')
      + aE(78, 66, 4, 4.5) + aC(83, 63, 6) + eye(85, 61, 1.2) + aP('M88 66 l4 1 M88 68 l3 3', 1.3) + aP('M85 57 q3 -6 9 -7', 1)
      + aE(13, 63, 4.6, 3, 'none', -20, ln(1.9)) + aE(7, 68, 4.6, 3, 'none', 40, ln(1.9)),
  }),
  // 白玉蛊：身子是一块白玉璧（中间有孔、刻着谷纹），头和腿是墨的
  baiyu: () => ({
    w: aC(44, 54, 26, '#d8d4c4'),
    b: aLegs([[34, 73, -3, 6, -7, 12, 2.2], [46, 75, 0, 6, -1, 12, 2.2], [56, 73, 3, 6, 7, 12, 2.2]])
      + aC(44, 54, 22, '#f4f0e3', ln(2.8)) + aC(44, 54, 7, '#e4dcc6', ln(1.8)) + aC(44, 54, 18.5, 'none', ln(0.8))
      + R(12, i => { const a = i * Math.PI / 6, x = 44 + Math.cos(a) * 13, y = 54 + Math.sin(a) * 13; return aC(x, y, 1.3) + aP(`M${n1(x)} ${n1(y)} q${n1(Math.cos(a + 1.6) * 2)} ${n1(Math.sin(a + 1.6) * 2)} ${n1(Math.cos(a + 2.2) * 3)} ${n1(Math.sin(a + 2.2) * 3)}`, 0.8); })
      + aP('M30 40 L34 46 L32 50', 0.7, INK, 'none', ' opacity=".5"')
      + aE(69, 60, 5.5, 6) + aC(77, 57, 5.2) + eye(79, 56, 1.1) + aP('M80 53 q5 -6 11 -6 M80 54 q6 -2 11 1', 1),
  }),

  // ===== 木道 =====
  // 生机叶（植物）：一片嫩叶连着卷曲的叶柄，旁边一颗露珠和几点回春的光
  shengji: () => ({
    w: aE(56, 40, 30, 24, '#7fae5c') + aC(30, 64, 8, '#9cc46a'),
    b: aP('M24 88 Q30 76 40 70 Q46 66 48 61', 2.6) + aP('M24 88 q-6 -2 -4 -7 q2 -3 5 -1', 1.6)
      + aF('M46 62 C34 50 34 28 56 16 C66 10 80 10 89 12 C87 24 82 40 70 52 C62 60 54 64 46 62 Z')
      + aP('M47 61 Q62 40 87 13', 1.2, PAPER)
      + aP('M52 53 Q45 46 41 41 M57 46 Q50 37 46 31 M63 39 Q58 29 55 22 M56 52 Q66 51 72 47 M62 45 Q72 43 78 37 M69 36 Q76 32 82 26', 0.8, PAPER)
      + leaf(40, 70, 13, 200, 3.4)
      + aC(32, 42, 3.2, 'none', ln(1)) + aC(31, 41, 0.9)
      + aP('M76 64 l0 6 M73 67 l6 0 M84 54 l0 4 M82 56 l4 0 M22 60 l0 4 M20 62 l4 0', 1.2),
  }),
  // 藤蔓蛊（植物）：一条 S 形的藤，叶子交替长，卷须，藤头甩成一个套索
  vine: () => {
    const f = t => (t < 0.5 ? cb([12, 88], [36, 76], [12, 48], [40, 44])(t * 2) : cb([40, 44], [64, 40], [64, 64], [84, 40])(t * 2 - 1));
    return {
      w: aP('M12 86 C34 74 16 48 40 44 S66 62 86 38', 14, '#6a9a52'),
      b: tube(f, t => 4.6 - t * 2.4)
        + [[0.12, 1], [0.27, -1], [0.42, 1], [0.58, -1], [0.72, 1]].map(([t, s]) => { const [x, y] = f(t), [xb, yb] = f(t + 0.02), a = Math.atan2(yb - y, xb - x) * 180 / Math.PI; return leaf(x, y, 15, a + s * 65, 3.8); }).join('')
        + spiral(26, 66, 5, 1.4, 1, 1) + spiral(56, 52, 4.5, 1.3, 3, 1)
        + aP('M84 40 Q92 32 90 24 Q88 18 82 20 Q76 23 80 29 Q83 33 87 30', 1.6) + aC(84, 40, 3) + aC(85, 39.4, 0.9, PAPER),
    };
  },
  // 虫草蛊：冬天的虫躺在地上，头上长出一根夏天的草，草头是一枚子座
  cordy: () => {
    const f = cb([14, 78], [24, 64], [52, 64], [64, 78]), r = t => 5 + Math.sin(t * Math.PI) * 2.2;
    return {
      w: aE(42, 74, 30, 8, '#a8864a') + aE(70, 34, 9, 20, '#c8a050'),
      b: aP('M6 85 L94 85', 1.4) + tube(f, r) + rings(f, r, 8, 1, PAPER, 0.12, 0.88)
        + [[22, 80], [30, 82], [40, 82], [50, 81]].map(([x, y]) => aP(`M${x} ${y} l0 3`, 1.8)).join('')
        + aC(68, 79, 5.2) + aC(70, 78, 1, PAPER)
        + aP('M67 75 Q62 54 69 38 Q72 30 72 24', 2.5) + aE(72, 19, 4.3, 9, INK, 8) + R(5, i => aC(70.5 + (i % 2) * 2.6, 14 + i * 2.2, 0.8, PAPER))
        + aP('M63 76 Q55 62 58 52', 1.5) + aE(58, 49, 2.3, 4.6, INK, -8),
    };
  },
  // 扶桑蛊（植物）：一棵虬曲的扶桑树，红日挂在枝间，树上只住着它一只
  fusang: () => ({
    w: aC(60, 30, 18, '#d04a2a') + aE(46, 42, 34, 22, '#6a9a52'),
    b: aC(60, 30, 11, '#b5301f', op('.85')) + R(10, i => { const a = i * Math.PI / 5 - 0.3; return aP(`M${n1(60 + Math.cos(a) * 13.5)} ${n1(30 + Math.sin(a) * 13.5)} L${n1(60 + Math.cos(a) * 17)} ${n1(30 + Math.sin(a) * 17)}`, 1.2, '#b5301f'); })
      + aP('M18 88 Q40 84 50 86 Q60 84 82 88', 1.4) + aP('M44 86 q-6 0 -10 4 M54 86 q6 0 10 4', 1.6)
      + aF('M44 86 Q46 70 42 61 Q38 53 29 47 L32 44 Q41 50 47 56 Q50 46 47 37 L52 37 Q55 50 53 60 Q61 52 72 50 L73 53 Q61 58 55 66 Q52 76 57 86 Z')
      + [[29, 46, 10, 200], [28, 44, 10, 250], [30, 45, 9, 160], [20, 38, 8, 220], [49, 37, 10, 240], [49, 37, 10, 290], [48, 37, 9, 200], [72, 51, 10, 320], [73, 51, 9, 10], [72, 52, 8, 40], [38, 30, 8, 260], [56, 46, 7, 300]]
        .map(([x, y, l, a]) => leaf(x, y, l, a, 3.2)).join('')
      + aE(66, 49.5, 3.4, 2) + aC(70, 48.6, 1.8) + aP('M71 47.5 q2 -3 5 -3', 0.8),
  }),

  // ===== 土道 =====
  // 石蚕蛊：石蛾幼虫用砂石缝的一截管子，头和前足从管口探出来，刀砍上去只溅火星
  stonecase: () => ({
    w: aE(44, 62, 32, 13, '#9a8a6a'),
    b: aF('M12 64 Q12 52 24 52 L64 50 Q72 50 72 60 Q72 72 64 72 L22 74 Q12 74 12 64 Z')
      + [[34, 50, 5, 3.4], [52, 49, 4.4, 3], [20, 53, 3.6, 3], [62, 51, 4, 3]].map(([x, y, rx, ry]) => aE(x, y, rx, ry)).join('')
      + [[20, 60, 5, 4], [30, 56, 4, 3.5], [29, 67, 5, 4], [40, 60, 5.5, 4.5], [50, 55, 4, 3.4], [51, 67, 4.5, 4], [61, 61, 4.5, 4], [21, 70, 3, 2], [40, 70, 3.5, 2.4], [34, 50, 4, 2.6], [52, 49, 3.4, 2.2]]
        .map(([x, y, rx, ry]) => aE(x, y, rx, ry, 'none', 0, ln(0.9, PAPER))).join('')
      + aE(76, 58, 5.5, 5) + eye(78, 56, 1.1) + aP('M81 60 l4 1 M81 62 l3 3', 1.3) + aP('M78 53 q3 -5 8 -6', 1)
      + aLegs([[72, 64, 4, 4, 8, 10, 1.7], [74, 62, 6, 3, 12, 8, 1.7], [70, 66, 2, 6, 4, 12, 1.7]])
      + aP('M40 41 l-2 -5 M44 40 l2 -5 M42 41 l0 -6', 1),
  }),
  // 地龙蛊：一条蚯蚓断成两截，两截都还在扭，断口露着肉
  earthworm: () => {
    const fa = cb([8, 77], [12, 48], [34, 44], [40, 64]), ra = t => 3 + t * 2.8;
    const fb = cb([52, 67], [58, 42], [74, 78], [90, 52]), rb = t => 5.8 - t * 1.4;
    return {
      w: aE(48, 78, 40, 7, '#a86a5a') + aE(48, 62, 34, 14, '#b87a6a'),
      b: aP('M4 82 Q24 78 50 82 T96 80', 1.6) + aC(20, 84, 1.4) + aC(64, 85, 1.6) + aC(80, 84, 1.1)
        + tube(fa, ra) + rings(fa, ra, 6, 0.7, PAPER, 0.12, 0.88, ' opacity=".7"') + tube(fb, rb) + rings(fb, rb, 5, 0.7, PAPER, 0.1, 0.5, ' opacity=".7"') + rings(fb, rb, 2, 1.6, PAPER, 0.62, 0.7) + rings(fb, rb, 2, 0.7, PAPER, 0.8, 0.9, ' opacity=".7"')
        + aE(40.2, 65, 2.6, 5.4, '#c98a7a', -20, ln(1.3)) + aE(52.4, 67.5, 2.6, 5.6, '#c98a7a', 25, ln(1.3))
        + aP('M45 56 l-1 -6 M48 56 l1 -6', 1) + aP('M16 44 q-3 -2 -5 0 M91 43 q2 -4 6 -4', 1, INK, 'none', ' opacity=".6"') + aC(91.5, 51, 1, PAPER),
    };
  },
  // 搬山蛊：背上驮着一座山（峰顶有雪、坡上有松），腿往外撑
  moveshan: () => ({
    w: aF('M20 70 L36 34 L44 44 L54 18 L66 42 L72 36 L82 70 Z', '#8a7a5a') + aE(50, 82, 34, 6, '#8a6a3a'),
    b: aP('M6 87 L94 87', 1.6) + aLegs([[30, 76, -6, 4, -10, 11, 3.2], [44, 78, -2, 4, -4, 9, 3.2], [58, 78, 2, 4, 4, 9, 3.2], [70, 76, 6, 4, 10, 11, 3.2]])
      + aE(50, 73, 25, 8) + aC(80, 72, 6.2) + aP('M85 70 q5 -3 7 -8', 2.3) + eye(82, 70, 1.1)
      + aF('M22 69 L36 36 L44 46 L54 19 L66 44 L72 38 L80 69 Z')
      + aP('M36 36 L40 50 L34 60 M54 19 L50 36 L56 46 L50 60 M72 38 L70 52', 1, PAPER, 'none', ' opacity=".6"')
      + aF('M50 28 L54 19 L58 28 L55.5 26 L53.5 29.5 Z', PAPER) + aF('M33.5 42 L36 36 L39 41 L36.5 40 Z', PAPER)
      + aP('M64 50 l0 7 M61 55 l3 -3 l3 3 M62 52.5 l2 -2 l2 2', 1, PAPER)
      + aC(20, 86, 2, 'none', ln(0.9)) + aC(26, 85, 1.4, 'none', ln(0.9)),
  }),

  // ===== 雷道 =====
  // 静电蛊：一身绒毛全炸开的毛球，毛尖噼啪带电
  static: () => ({
    w: aC(48, 54, 26, '#6a8ac0'),
    b: R(34, i => { const a = i / 34 * Math.PI * 2, L = 19 + (i % 3) * 3 + (Math.sin(a) < -0.3 ? 2 : 0), bend = (i % 2 ? 0.12 : -0.12); return aP(`M${n1(48 + Math.cos(a) * 10)} ${n1(55 + Math.sin(a) * 10)} L${n1(48 + Math.cos(a + bend) * L)} ${n1(55 + Math.sin(a + bend) * L)}`, 1.1); })
      + aC(48, 55, 13.5) + aC(57, 51, 3, PAPER) + aC(58, 51, 1.4) + aP('M60 58 q2 1 4 0', 1, PAPER)
      + aLegs([[42, 67, -2, 5, -5, 9, 1.6], [50, 68, 0, 5, 1, 9, 1.6], [56, 66, 2, 5, 6, 9, 1.6]])
      + bolt(76, 26, 0.8, 1.4) + bolt(16, 30, 0.7, 1.3) + aP('M74 72 l4 -2 l-1 4 l4 -2', 1.2) + aP('M20 70 l-3 -2 l1 4 l-3 -2', 1.2),
  }),
  // 惊蛰蛊：从土里钻出来，前足张开、触角朝天，土块乱飞，天上一道春雷
  jingzhe: () => ({
    w: aE(48, 82, 38, 6, '#7a6a4a') + aE(50, 46, 18, 28, '#5a7ab0'),
    b: aF('M4 79 Q30 75 50 77 Q70 75 96 79 L96 84 L4 84 Z') + aE(50, 78.5, 12, 3.2, '#3a3530')
      + aE(50, 68, 9, 12) + aP('M42 64 Q50 67 58 64 M43 70 Q50 73 57 70', 1, PAPER, 'none', ' opacity=".7"') + aE(50, 52, 7.5, 6.5) + aC(52, 41, 6.5) + eye(55, 39.5, 1.3)
      + aP('M51 35 q-2 -10 -8 -14 M54 35 q4 -9 12 -11', 1.2)
      + aLegs([[44, 52, -8, -4, -13, -12, 2.1], [56, 52, 8, -4, 13, -12, 2.1], [44, 61, -8, 6, -14, 14, 2.1], [56, 61, 8, 6, 14, 14, 2.1]])
      + aC(30, 64, 2.2) + aC(72, 60, 2.6) + aC(24, 72, 1.6) + aC(78, 70, 1.8) + aP('M28 60 l-3 -3 M75 56 l3 -3', 0.9)
      + bolt(74, 6, 1.2, 1.9) + bolt(20, 10, 0.8, 1.4) + aP('M22 79 q-1 -6 2 -9 M22 73 q3 -2 5 0', 1.2),
  }),
  // 叩甲蛊：细长的叩头虫翻过身弹在半空，六足朝天，落点炸开一声雷
  click: () => ({
    w: aE(50, 46, 30, 12, '#4a6aa0') + aC(50, 82, 9, '#7a9ad0'),
    b: aLegs([[40, 43, -3, -6, -6, -12, 1.6], [52, 41, 0, -7, 2, -13, 1.6], [62, 41, 3, -6, 8, -11, 1.6]])
      + aE(46, 49, 24, 7, INK, -8) + aP('M28 48 Q44 41 62 42', 1, PAPER, 'none', ' opacity=".7"') + aP('M30 52 Q46 47 64 46', 0.8, PAPER, 'none', ' opacity=".5"')
      + aE(70, 45, 7, 6, INK, -8) + aF('M65 49 L60 56 L68 50 Z') + aC(79.5, 43, 4.6) + eye(81.5, 44, 1)
      + aP('M83 41 l3 -2 l1 2 l3 -2 l1 2 l3 -1', 1)
      + aP('M12 80 Q18 52 34 44', 1, INK, 'none', dash())
      + R(8, i => { const a = Math.PI + i * Math.PI / 7; return aP(`M${n1(50 + Math.cos(a) * 4)} ${n1(84 + Math.sin(a) * 4)} L${n1(50 + Math.cos(a) * (i % 2 ? 9 : 12))} ${n1(84 + Math.sin(a) * (i % 2 ? 9 : 12))}`, 1.2); })
      + aP('M24 86 L76 86', 1.4) + bolt(44, 60, 0.8, 1.4),
  }),
  // 积云蛊：头顶飘着一大朵乌云，攒着雨和雷，小虫在云下抬头
  cloud: () => ({
    w: aE(50, 28, 36, 16, '#4a5a7a') + aE(48, 82, 22, 6, '#6a8ac0'),
    b: aC(30, 31, 10) + aC(45, 22, 13.5) + aC(62, 24, 11) + aC(75, 33, 8) + aE(52, 35, 28, 8)
      + aP('M27 33 q4 -4 8 0 M47 24 q5 -5 10 0 M66 28 q3 -3 6 0', 1, PAPER, 'none', ' opacity=".6"')
      + aP('M70 42 L63 53 L69 53 L60 66', 1.9) + R(5, i => aP(`M${28 + i * 7} 47 l-2 6`, 1, INK, 'none', ' opacity=".7"'))
      + aE(42, 79, 10.5, 6) + aP('M34 77 Q42 74 50 77', 0.9, PAPER) + aC(55, 77, 4.6) + eye(56.6, 76, 1)
      + aP('M55 72 q1 -6 5 -9 M53 73 q-2 -6 0 -10', 1) + aLegs([[36, 83, -2, 4, -5, 7, 1.4], [43, 84, 0, 4, 0, 7, 1.4], [49, 83, 2, 4, 5, 7, 1.4]]),
  }),
  // 磁暴蛊：一对马蹄铁似的大颚，两极之间绕着一圈圈磁力线
  magstorm: () => ({
    w: aE(48, 58, 32, 22, '#3a6aa8'),
    b: aP('M80 46 Q96 58 80 70', 0.9, INK, 'none', dash('2 2.4')) + aP('M80 43 Q99 58 80 73', 0.8, INK, 'none', dash('2 2.4') + ' opacity=".7"') + aP('M80 40 Q102 58 80 76', 0.7, INK, 'none', dash('2 3') + ' opacity=".45"')
      + aLegs([[30, 66, -4, 7, -9, 14, 1.9], [42, 68, 0, 7, -1, 14, 1.9], [52, 66, 4, 7, 9, 13, 1.9]])
      + aE(34, 58, 18, 11) + aP('M20 54 Q34 48 48 54', 1, PAPER) + aE(52, 58, 8, 8)
      + aP('M80 46 L70 46 Q60 46 60 58 Q60 70 70 70 L80 70', 6.2) + aP('M76 46 L81 46', 6.2, '#b5301f') + aP('M76 70 L81 70', 4, PAPER) + aC(58, 58, 4.8) + eye(60, 56.4, 1.1)
      + R(9, i => { const a = -1.2 + i * 0.3; return aP(`M${n1(50 + Math.cos(a) * 34)} ${n1(58 + Math.sin(a) * 26)} l${n1(-Math.sin(a) * 2.2)} ${n1(Math.cos(a) * 2.2)}`, 0.9); })
      + bolt(18, 30, 0.7, 1.2),
  }),
  // 九霄蛊（仙）：雷公的一圈九面鼓围着它，雷从鼓间劈出，脚下祥云
  jiuxiao: () => ({
    w: aC(50, 48, 36, '#3a6aa8') + aC(50, 48, 18, '#c9a24a'),
    b: aC(50, 48, 35, 'none', ln(1.2)) + R(9, i => { const a = -Math.PI / 2 + i * Math.PI * 2 / 9, x = 50 + Math.cos(a) * 35, y = 48 + Math.sin(a) * 35; return aE(x, y + 0.8, 4.6, 3.6) + aE(x, y - 1.6, 4.6, 1.5, '#3a3530', 0, ln(0.6, PAPER)); })
      + glassWing('M50 46 Q40 26 22 22 Q30 38 48 50 Z', '.35', 'M48 46 Q38 32 26 26') + glassWing('M50 52 Q40 70 22 74 Q30 58 48 50 Z', '.3', 'M48 54 Q38 66 26 70')
      + aE(50, 50, 13, 6.5) + aP('M40 47 Q50 44 60 47', 1, PAPER) + aC(66, 49, 5.4) + eye(68, 47.6, 1.2) + aP('M68 44 q3 -6 9 -8 M67 44 q1 -6 4 -9', 1)
      + bolt(72, 56, 1, 1.5) + bolt(26, 54, 0.9, 1.4) + bolt(60, 20, 0.8, 1.3)
      + yun(50, 92, 0.75, 1.2),
  }),

  // ===== 光道 =====
  // 月光蛊：一道银白弯月立在背上，挥出去就是两道刀光
  yueguang: () => ({
    w: aC(42, 34, 21, '#c9c49a') + aE(50, 66, 24, 7, '#c9a53a'),
    b: lune(42, 36, 22, 52, 30, 18.5, '#f2ecd8', ln(2.2))
      + aE(40, 65, 15, 4.5, INK, 6) + aE(56, 62.5, 6.5, 4.6) + aC(65, 60, 4.6) + eye(66.6, 59, 1.1) + aP('M66 56 q3 -7 9 -9 M65 56 q0 -7 3 -10', 1)
      + aP('M57 60 L59 52', 1.8) + aLegs([[52, 66, -3, 6, -7, 12, 1.4], [57, 66, 1, 6, 3, 12, 1.4], [61, 64, 4, 6, 9, 11, 1.4]])
      + aP('M72 24 Q86 40 74 60', 1.2) + aP('M78 20 Q94 40 80 66', 0.9, INK, 'none', ' opacity=".55"') + twinkle(86, 14, 1.6),
  }),
  // 舍利蛊：一粒温润的珠子坐在莲台上，四周放光，珠上两根细须
  sheli: () => ({
    w: aC(50, 44, 22, '#e0c060'),
    b: R(14, i => { const a = -Math.PI + i * Math.PI / 13 - 0.15; return aP(`M${n1(50 + Math.cos(a) * 18.5)} ${n1(44 + Math.sin(a) * 18.5)} L${n1(50 + Math.cos(a) * (i % 2 ? 24 : 27))} ${n1(44 + Math.sin(a) * (i % 2 ? 24 : 27))}`, 0.9); })
      + [[-62, 13], [-30, 15], [0, 16], [30, 15], [62, 13]].map(([a, l]) => { const r = (a - 90) * Math.PI / 180, x = 50, y = 74, tx = x + Math.cos(r) * l, ty = y + Math.sin(r) * l, px = -Math.sin(r) * 5, py = Math.cos(r) * 5; return aF(`M${x} ${y} Q${n1((x + tx) / 2 + px)} ${n1((y + ty) / 2 + py)} ${n1(tx)} ${n1(ty)} Q${n1((x + tx) / 2 - px)} ${n1((y + ty) / 2 - py)} ${x} ${y} Z`) + aP(`M${x} ${y} L${n1(x + (tx - x) * 0.7)} ${n1(y + (ty - y) * 0.7)}`, 0.7, PAPER); }).join('')
      + aF('M30 76 Q50 84 70 76 L66 82 Q50 88 34 82 Z')
      + aC(50, 46, 14, '#f6f0de', ln(2.4)) + lune(50, 46, 12.8, 46, 42, 12.8, INK, op('.18')) + aP('M41 41 Q43 36 48 35', 1.8, '#fffaf0')
      + aC(56, 45, 1.3) + aC(60, 46, 1.1) + aP('M56 33 q3 -6 8 -7 M53 32.5 q1 -6 4 -9', 1),
  }),
  // 照夜蛊：伏在枝上，腹灯亮着，头前射出一束光，光头照出一个靶记
  shine: () => ({
    w: aF('M60 50 L98 34 L98 72 Z', '#e8d07a') + aC(26, 58, 13, '#e8d07a'),
    b: aP('M62 50 L96 36 M62 56 L96 70', 0.8, INK, 'none', dash('2 2.5') + ' opacity=".7"')
      + aC(88, 53, 6, 'none', ln(1.2)) + aP('M88 43 l0 5 M88 58 l0 5 M78 53 l5 0 M93 53 l5 0', 1.1)
      + aP('M8 75 Q40 68 72 72', 2.4) + aLegs([[36, 62, -2, 5, -6, 9, 1.5], [44, 62, 0, 5, 0, 8, 1.5], [50, 60, 2, 5, 5, 10, 1.5]])
      + aE(28, 58, 12, 9, '#f4eedc', 0, ln(2.2)) + aP('M24 53 l-3 -3 M22 58 l-4 0 M24 63 l-3 3', 0.9) + aP('M30 50 Q34 58 30 66 M24 51 Q28 58 24 65', 0.8, INK, 'none', ' opacity=".5"')
      + aE(44, 56, 10, 7) + aC(56, 53, 5.6) + aC(60, 52, 2.2, PAPER) + aC(60.4, 52, 0.9)
      + aP('M56 48 q-2 -8 -10 -12 M54 48 q-6 -5 -14 -5', 1),
  }),
  // 曜日蛊：圣甲虫用前足把一轮小太阳举过头顶
  solar: () => ({
    w: aC(56, 25, 18, '#d0632a') + aE(46, 66, 26, 12, '#c9a53a'),
    b: aC(56, 25, 11, '#b5301f', ln(1.2)) + R(12, i => { const a = i * Math.PI / 6; return aP(`M${n1(56 + Math.cos(a) * 13.5)} ${n1(25 + Math.sin(a) * 13.5)} L${n1(56 + Math.cos(a) * (i % 2 ? 17 : 19))} ${n1(25 + Math.sin(a) * (i % 2 ? 17 : 19))}`, 1.4, '#b5301f'); })
      + aP('M50 21 Q56 17 62 21', 1, '#efc9a0')
      + aP('M8 81 L92 81', 1.4) + aLegs([[34, 74, -4, 4, -9, 7, 2.3], [46, 77, 0, 2, -1, 4, 2.3], [56, 75, 4, 3, 8, 6, 2.3]])
      + aE(44, 66, 20, 12) + aP('M26 64 Q44 56 62 62', 1.1, PAPER) + aP('M44 55 L44 77', 1, PAPER, 'none', ' opacity=".6"')
      + aE(62, 62, 7, 7.5) + aF('M66 56 Q77 56 79 62 L76.5 62.5 L77.5 64 L74 65 Q70 66 67 66 Z') + eye(71, 59.5, 1.1)
      + aP('M63 57 L58 46 L53 38', 2.3) + aP('M68 57 L66 46 L61 37', 2.3),
  }),

  // ===== 暗道 =====
  // 墨斗蛊：墨鱼似的身子，一把卷须，往前喷出一大团墨
  ink: () => ({
    w: aE(80, 46, 18, 22, '#3a3346') + aE(36, 54, 26, 14, '#5a5070'),
    b: aE(34, 54, 24.5, 13.5, INK, 0, op('.35')) + aE(34, 54, 21, 11) + R(5, i => aC(22 + i * 6, 50 + (i % 2) * 6, 1.2, PAPER, ' opacity=".7"'))
      + aE(58, 54, 7, 8.5) + aC(58, 50.5, 3.2, PAPER) + aC(58.6, 50.5, 1.5)
      + R(6, i => { const y = 49 + i * 2.4, d = i - 2.5; return aP(`M63 ${n1(y)} q8 ${n1(d * 1.6)} 12 ${n1(d * 3)} q3 ${n1(d * 1.2)} 1 ${n1(d * 2 + (i % 2 ? 3 : -3))}`, 1.9 - Math.abs(d) * 0.2); })
      + aC(84, 40, 7, INK, op('.85')) + aC(90, 48, 5.5, INK, op('.85')) + aC(80, 50, 4.5, INK, op('.85')) + aC(88, 33, 3.4, INK, op('.85'))
      + aC(94, 38, 1.6) + aC(96, 54, 1.3) + aC(76, 32, 1.2) + aC(82, 58, 1.4),
  }),
  // 夜蝠蛊：白天倒挂在枝上，翅膀半张，獠牙朝下
  bat: () => {
    const wingL = 'M46 26 L22 21 Q15 30 11 45 Q18 42 20 51 Q25 46 30 53 Q34 46 40 50 Q44 46 46 44 Z';
    return {
      w: aE(50, 44, 34, 22, '#4a3a5a'),
      b: aP('M6 15 Q50 10 94 17', 2.8) + aP('M76 14 q4 -4 8 -4', 1.4) + aP('M46 15 L47 22 M54 15 L53 22', 1.5)
        + aF(wingL, INK, op('.9')) + aF(flipX(wingL), INK, op('.9'))
        + aP('M44 30 L22 22 M44 34 L13 44 M44 38 L22 50 M44 41 L32 52', 0.8, PAPER, 'none', ' opacity=".7"')
        + aP(flipX('M44 30 L22 22 M44 34 L13 44 M44 38 L22 50 M44 41 L32 52'), 0.8, PAPER, 'none', ' opacity=".7"')
        + aE(50, 36, 7, 12.5) + aC(50, 52, 6.2) + aF('M45 55 L43 63 L48 57.5 Z') + aF('M55 55 L57 63 L52 57.5 Z')
        + aC(47.6, 50.6, 1.2, PAPER) + aC(52.4, 50.6, 1.2, PAPER) + aP('M48.4 56.6 l0 2.4 M51.6 56.6 l0 2.4', 0.9, PAPER),
    };
  },
  // 月蚀蛊：它爬过一轮满月，爬过的那边月亮就黑了一块
  eclipse: () => ({
    w: aC(46, 46, 30, '#5a5070'),
    b: aC(46, 46, 24, '#efe6c8', ln(1.6)) + aC(54, 40, 3, 'none', ln(0.7)) + aC(58, 56, 2.2, 'none', ln(0.7)) + aC(46, 60, 1.6, 'none', ln(0.7))
      + lune(46, 46, 24, 58, 50, 22)
      + aLegs([[56, 30, -2, -5, -5, -9, 1.4], [62, 31, 1, -6, 3, -10, 1.4], [56, 37, -3, 5, -6, 9, 1.4], [62, 38, 1, 5, 4, 9, 1.4]])
      + aE(58, 33.5, 9, 4.6, INK, 8) + aC(69, 35.5, 3.8) + aC(70.4, 34.6, 1, PAPER) + aP('M71 32 q4 -5 10 -5 M72 33 q5 -2 10 1', 0.9)
      + twinkle(84, 18, 1.6) + twinkle(14, 80, 1.3) + crystal(84, 74, 3, 0.9),
  }),
  // 冥蝶蛊：从阴间飞回来的燕尾蝶，翅破、尾长，后面跟着一缕魂
  styx: () => {
    const fw = 'M50 40 Q36 18 12 19 Q8 28 13 36 L11 39 Q16 45 26 47 Q38 50 50 46 Z', hw = 'M50 48 Q36 52 28 61 Q25 72 34 74 L29 91 L39 76 Q47 70 50 56 Z';
    return {
      w: aE(30, 46, 20, 22, '#5a4a7a') + aE(70, 46, 20, 22, '#5a4a7a') + aC(82, 84, 7, '#9a8ac0'),
      b: aF(fw) + aF(flipX(fw)) + aF(hw, INK, op('.9')) + aF(flipX(hw), INK, op('.9'))
        + aP('M48 41 L16 23 M48 43 L14 34 M46 45 L22 44', 0.8, PAPER, 'none', ' opacity=".6"') + aP(flipX('M48 41 L16 23 M48 43 L14 34 M46 45 L22 44'), 0.8, PAPER, 'none', ' opacity=".6"')
        + aC(22, 27, 2, PAPER) + aC(78, 27, 2, PAPER) + aC(35, 65, 2.4, PAPER) + aC(65, 65, 2.4, PAPER) + aC(35, 65, 1) + aC(65, 65, 1) + aC(17, 32, 1, PAPER) + aC(83, 32, 1, PAPER)
        + aE(50, 50, 3.3, 16) + aC(50, 32, 3.5) + aP('M49 30 Q44 18 40 13 M51 30 Q56 18 60 13', 1) + aC(40, 13, 1.3) + aC(60, 13, 1.3)
        + aF('M82 90 Q74 88 76 80 Q78 74 82 70 Q82 76 86 78 Q90 84 82 90 Z', INK, op('.4')) + aP('M82 90 Q74 88 76 80 Q78 74 82 70 Q82 76 86 78 Q90 84 82 90 Z', 1) + aC(80.5, 83, 0.8) + aC(84, 83, 0.8)
        + aP('M78 78 Q66 72 58 64', 0.8, INK, 'none', dash('1.5 2.5')),
    };
  },

  // ===== 血道 =====
  // 蜱蛊：吸得滚圆的蜱，八条短腿全挤在前头
  tick: () => ({
    w: aE(42, 54, 28, 22, '#8a2a2a'),
    b: aLegs([[55, 46, 3, -8, 9, -12, 1.7], [59, 47, 5, -6, 13, -8, 1.7], [62, 49, 6, -4, 14, -4, 1.6], [52, 45, 0, -8, 3, -14, 1.6],
      [55, 62, 3, 8, 9, 12, 1.7], [59, 61, 5, 6, 13, 8, 1.7], [62, 59, 6, 4, 14, 4, 1.6], [52, 63, 0, 8, 3, 14, 1.6]])
      + aE(40, 54, 24, 19) + aE(31, 46, 9, 4, PAPER, -20, ' opacity=".45"') + aP('M24 47 Q30 54 24 61 M34 40 Q41 54 34 68', 0.9, PAPER, 'none', ' opacity=".5"')
      + aE(58, 54, 7, 8) + aE(58, 54, 5, 6, 'none', 0, ln(0.8, PAPER)) + aF('M64 50 L74 52 L74 56 L64 58 Z') + aP('M74 53 l5 -1 M74 55 l5 1', 1.4)
      + aC(81, 57, 1.4, '#8a1f2b') + aF('M84 60 q-1.4 2.4 0 3.4 q1.4 -1 0 -3.4 Z', '#8a1f2b'),
  }),
  // 血蚁蛊：一窝三只血蚁排成一队，先咬破自己，身上挂着血珠
  bloodant: () => ({
    w: aE(46, 60, 36, 22, '#8a1f2b'),
    b: ant(62, 60, 0.82) + ant(33, 44, 0.56) + ant(30, 77, 0.5)
      + [[48, 54], [24, 40], [21, 74]].map(([x, y]) => aF(`M${x} ${y} q-1.6 2.8 0 4 q1.6 -1.2 0 -4 Z`, '#a8241f')).join('')
      + aC(86, 64, 1.4, '#a8241f') + aC(52, 46, 1, '#a8241f') + aP('M6 90 L94 90', 1.1, INK, 'none', ' opacity=".5"'),
  }),
  // 血珀蛊：一块多棱的血色琥珀，里面封着它自己
  amber: () => {
    const gem = 'M50 14 Q70 18 78 36 Q86 56 74 74 Q62 88 44 86 Q24 82 18 62 Q14 42 26 26 Q36 14 50 14 Z';
    return {
      w: aE(48, 52, 30, 30, '#a8402a'),
      b: aF(gem, '#8a2a1f', op('.6')) + aP(gem, 2.3)
        + aP('M26 26 L40 34 L50 14 M40 34 L36 58 L18 62 M36 58 L54 70 L74 74 M54 70 L66 46 L78 36 M66 46 L40 34', 0.8, PAPER, 'none', ' opacity=".5"')
        + aLegs([[42, 58, -6, 4, -12, 2, 1.4], [46, 60, -2, 7, -6, 12, 1.4], [50, 59, 4, 6, 8, 11, 1.4], [44, 50, -6, -4, -10, -10, 1.3]])
        + aE(46, 54, 11, 6.5, INK, -20) + aC(57, 48.5, 4.2) + aP('M59 45 q3 -6 9 -6 M58 45 q1 -6 5 -8', 0.9) + aC(58.6, 47.6, 0.9, PAPER)
        + aP('M28 32 Q32 24 41 21', 2, PAPER, 'none', ' opacity=".75"')
        + aF('M46 86 q-2.4 5 0 7 q2.4 -2 0 -7 Z', '#8a1f2b'),
    };
  },
  // 血月蛊：螳螂似的一只，前臂是一弯血红的月刃，身后一轮血月
  xueyue: () => ({
    w: aC(30, 32, 20, '#a82a2a') + aE(46, 66, 26, 8, '#8a1f2b'),
    b: aC(30, 32, 14, '#8a1f2b', op('.6'))
      + aLegs([[42, 66, -6, 7, -12, 15, 1.5], [48, 66, 2, 8, 8, 16, 1.5], [38, 65, -8, 6, -18, 12, 1.4]])
      + aE(36, 64, 19, 6.2, INK, 6) + R(4, i => aF(`M${24 + i * 6} ${n1(60 - i * 0.4)} l2 -6 l2 6 Z`))
      + aP('M50 62 L60 47', 4.6) + aF('M56 43 L72 41 L64 54 Z') + aC(67, 44, 2.2, '#e8c0a0') + aC(67.4, 44, 0.9) + aP('M66 41 q4 -10 12 -14 M68 40 q8 -6 16 -6', 1)
      + aP('M60 50 L68 56', 2.6) + aF('M64 56 Q92 56 95 24 Q86 46 64 51 Z', '#b5301f', ln(1.6))
      + aF('M88 42 q-1.6 2.8 0 4 q1.6 -1.2 0 -4 Z', '#8a1f2b') + aF('M82 54 q-1.6 2.8 0 4 q1.6 -1.2 0 -4 Z', '#8a1f2b'),
  }),
  // 赤魃蛊（仙）：脚下是龟裂的旱地，四臂张开，头上冒火，两边热浪
  chiba: () => ({
    w: aC(50, 32, 22, '#c0442a') + aE(50, 84, 42, 8, '#a8742a'),
    b: aF('M6 78 L94 78 L90 90 L10 90 Z', INK, op('.85'))
      + aP('M14 80 L22 86 L34 82 L42 88 M34 82 L38 79 M52 80 L58 86 L70 82 L80 88 M70 82 L74 79 M22 86 L20 90 M58 86 L56 90 M84 80 L86 88', 0.9, PAPER)
      + flame(44, 27, 13, 4, -5, '#b5301f') + flame(50, 25, 17, 4.6, 0, '#b5301f') + flame(56, 27, 13, 4, 5, '#b5301f')
      + aP('M42 40 L30 32 L22 21 M58 40 L70 32 L78 21', 2.8) + aP('M43 47 L30 51 L21 46 M57 47 L70 51 L79 46', 2.1)
      + aP('M22 21 l-3 -2 M22 21 l-1 -4 M78 21 l3 -2 M78 21 l1 -4', 1.2)
      + aE(50, 58, 10, 14) + aP('M41 56 Q50 60 59 56 M42 63 Q50 67 58 63', 1, PAPER, 'none', ' opacity=".6"') + aE(50, 42, 9, 7) + aC(50, 31, 7)
      + aP('M45.5 30 l3 1.2 M51.5 31.2 l3 -1.2', 1.3, '#e8c76a') + aP('M45 70 L40 78 M55 70 L60 78', 3.2)
      + aP('M12 66 q3 -4 0 -8 q-3 -4 0 -8 q3 -4 0 -8 M88 66 q-3 -4 0 -8 q3 -4 0 -8 q-3 -4 0 -8', 1, INK, 'none', ' opacity=".5"'),
  }),

  // ===== 毒道 =====
  // 寡妇蛛：侧身，黑亮的圆腹高高翘起，腹下一个红沙漏
  widow: () => ({
    w: aE(40, 48, 24, 22, '#8a2a2a'),
    b: aP('M58 59 Q66 40 74 44 L82 80 M60 60 Q74 38 84 44 L94 74 M56 60 Q48 64 40 70 L30 86 M58 61 Q56 70 52 74 L46 88', 1.1, INK, 'none', ' opacity=".4"')
      + aP('M62 57 Q72 30 82 36 L92 72 M60 58 Q66 36 74 40 L80 80 M58 58 Q46 52 40 62 L28 84 M60 59 Q54 66 50 70 L42 86', 1.9)
      + aC(37, 42, 18.5) + aE(29, 34, 6.5, 3, PAPER, -30, ' opacity=".55"')
      + aF('M45 55 L51 53 L49 57.5 L53 61 L47 63 L48 58.5 Z', '#c0281f')
      + aE(60, 58, 8, 6, INK, -10) + aC(68, 55.5, 3.8) + aC(69.5, 54, 0.8, PAPER) + aC(71, 55.4, 0.7, PAPER) + aP('M70 58 l3 3 M68 59 l1 4', 1.3)
      + aP('M20 48 Q12 38 8 18', 0.7),
  }),

  // ===== 智道 =====
  // 酒虫：身子是一只酒葫芦，腰上系红绳，醉眯着眼，嘴角滴酒
  jiuchong: () => ({
    w: aE(46, 56, 24, 28, '#c8a050') + aC(78, 22, 6, '#e0c070'),
    b: aC(43, 64, 16.5) + aC(51, 39, 10.5) + aE(47, 51, 5, 4)
      + aP('M41 50 Q48 54.5 56 50', 2.4, '#b5301f') + aP('M50 53 q-2 5 -5 7 M51 53 q1 5 3 8', 1.2, '#b5301f')
      + aP('M30 62 Q43 68 56 62 M32 71 Q43 76 54 71', 1, PAPER, 'none', ' opacity=".6"') + aE(37, 58, 4, 2, PAPER, -20, ' opacity=".4"')
      + R(4, i => aP(`M${34 + i * 6} 79 l${i < 2 ? -1 : 1} 4`, 1.6))
      + aC(60, 30, 5.6) + aP('M59.5 28.6 q1.6 -1.6 3.2 0', 1, PAPER) + aC(62.4, 32, 1.4, '#c0442a', ' opacity=".85"')
      + aP('M60 25 q-2 -8 4 -10 q4 -1 3 4', 1) + aP('M65 33 q4 3 3 8', 1.2) + aF('M68 42 q-1.6 2.6 0 3.8 q1.6 -1.2 0 -3.8 Z')
      + aC(76, 24, 2, 'none', ln(0.9)) + aC(82, 16, 1.4, 'none', ln(0.9)) + aC(72, 15, 1, 'none', ln(0.8)),
  }),
  // 地听肉耳草（植物）：贴地长着一只肉耳朵似的叶子，旁边的声纹一圈圈往耳里收
  diting: () => ({
    w: aE(42, 48, 24, 28, '#c88a7a'),
    b: aP('M8 85 L92 85', 1.4) + aP('M42 85 q-4 4 -10 5 M44 85 q0 5 -2 9 M46 85 q5 3 10 4', 1)
      + aP('M44 85 Q46 77 44 69', 3.2) + leaf(43, 83, 11, 200, 3) + leaf(45, 83, 11, -20, 3)
      + aF('M44 71 C30 71 22 57 24 41 C26 23 40 15 52 19 C64 23 66 37 60 47 C56 53 54 59 56 65 C57 71 50 73 44 71 Z')
      + aP('M50 27 C40 25 32 33 34 45 C35 53 42 55 46 51', 1.6, PAPER) + aP('M48 34 C42 34 40 40 43 45', 1.1, PAPER, 'none', ' opacity=".7"')
      + aE(47, 47, 3, 4, '#3a3530') + aP('M30 60 q3 4 8 4', 0.9, PAPER, 'none', ' opacity=".5"')
      + aP('M70 39 q4 6 0 12 M76 35 q6 10 0 20 M82 31 q8 14 0 28', 1.1, INK, 'none', ' opacity=".6"'),
  }),
  // 智慧蛊（仙）：盘坐，头大如穹，额上一道旋纹，长须优雅地卷着，周围一圈八卦
  zhihui: () => {
    const TRI = ['111', '000', '100', '011', '010', '101', '001', '110'];
    return {
      w: aC(50, 48, 34, '#3d5a8a') + aC(52, 38, 15, '#c9a24a'),
      b: TRI.map((t, k) => { const a = -Math.PI / 2 + k * Math.PI / 4, tx = -Math.sin(a), ty = Math.cos(a);
        return R(3, j => { const r = 38 - 2 + j * 2, x = 50 + Math.cos(a) * r, y = 49 + Math.sin(a) * r, L = 3.4; return t[j] === '1' ? aP(`M${n1(x - tx * L)} ${n1(y - ty * L)} L${n1(x + tx * L)} ${n1(y + ty * L)}`, 1.1) : aP(`M${n1(x - tx * L)} ${n1(y - ty * L)} L${n1(x - tx * 0.9)} ${n1(y - ty * 0.9)} M${n1(x + tx * 0.9)} ${n1(y + ty * 0.9)} L${n1(x + tx * L)} ${n1(y + ty * L)}`, 1.1); }); }).join('')
        + aE(50, 67, 15, 8.5) + aP('M37 71 Q29 73 30 66 M63 71 Q71 73 70 66', 2.2)
        + aE(50, 55, 8.5, 6.5) + aP('M43 59 Q49 64 57 60', 2)
        + aC(52, 38, 12.5) + spiral(51, 37, 8, 1.8, 0, 1.1, PAPER) + aP('M57.5 42 q2 1.4 4 0', 1, PAPER)
        + aP('M56 27 Q60 14 70 12 Q78 12 76 18', 1.1) + aP('M49 26.5 Q45 14 35 12 Q27 12 29 18', 1.1)
        + yun(50, 84, 0.7, 1.2),
    };
  },

  // ===== 魂道 =====
  // 鬼火蛊：坟头一团幽绿的火，火心两只眼，在等人
  will: () => ({
    w: aE(56, 40, 18, 22, '#5a8a9a') + aE(40, 82, 26, 6, '#6a6a6a'),
    b: aF('M10 86 Q20 70 40 68 Q60 70 70 86 Z') + aF('M27 86 L27 60 Q31 54 35 60 L35 86 Z') + aP('M31 64 l0 12', 0.9, PAPER) + aP('M28 59 Q31 55 34 59', 0.8, PAPER)
      + aP('M64 86 q-1 -5 1 -8 M68 86 q0 -4 3 -6 M14 86 q0 -5 -2 -7', 1)
      + aF('M57 64 C45 62 43 48 49 40 C53 34 51 26 45 18 C57 22 61 30 63 38 C67 32 67 26 65 20 C73 30 73 44 69 54 C67 60 63 64 57 64 Z', INK, op('.88'))
      + aE(58, 52, 5.5, 7.5, PAPER, 0, ' opacity=".55"') + aC(55.5, 51, 1.3) + aC(60.5, 51, 1.3)
      + crystal(80, 30, 2.6, 0.9) + aC(76, 52, 1) + aC(44, 30, 0.9),
  }),
  // 骨笛蛊：一支斜放的白骨笛，笛孔一排，小虫伏在笛头吹，笛尾飘出魂音
  boneflute: () => {
    const f = qb([14, 78], [48, 60], [80, 40]);
    return {
      w: aE(50, 58, 38, 14, '#8a7aa0', -30),
      b: tube(f, () => 4, '#e8dcc0', ln(1.8)) + aC(14, 78, 5.4, '#e8dcc0', ln(1.8)) + aC(80, 40, 5.4, '#e8dcc0', ln(1.8))
        + [0.32, 0.42, 0.52, 0.62, 0.72].map(t => { const [x, y] = f(t); return aE(x, y, 1.6, 1.1, INK, -30); }).join('')
        + aP('M12 74 q2 3 0 7 M82 36 q-2 4 1 8', 0.8, INK, 'none', ' opacity=".6"')
        + aE(66, 40, 8, 4.4, INK, -30) + aC(74, 33, 4.3) + eye(75.4, 32, 1) + aP('M75 29 q2 -7 8 -9 M74 29 q-1 -7 2 -11', 1)
        + aLegs([[63, 44, -1, 5, -3, 8, 1.3], [67, 42, 1, 5, 1, 8, 1.3], [71, 40, 3, 5, 5, 7, 1.3]])
        + aP('M8 70 q-4 -6 2 -10 q6 -4 3 -10 M16 66 q-2 -5 2 -8', 1, INK, 'none', ' opacity=".6"') + spiral(10, 52, 4, 1.2, 0, 0.9, INK, ' opacity=".6"')
        + aP('M24 60 l0 -6 l3 -1 M30 54 l0 -5', 1, INK, 'none', ' opacity=".55"'),
    };
  },

  // ===== 宇道 =====
  // 水黾蛊：细身子，四条长腿往外撑开，脚尖点在水面上，各压出一圈涟漪
  strider: () => ({
    w: aE(50, 72, 44, 7, '#6aa0a0'),
    b: [[92, 71], [6, 71], [17, 71], [76, 71]].map(([x, y]) => aE(x, y + 1, 4.6, 1.4, 'none', 0, ln(0.9)) + aE(x, y + 1, 7.5, 2.2, 'none', 0, ln(0.6) + ' opacity=".5"')).join('')
      + aP('M50 61 Q60 52 78 60 L92 71 M48 61 Q34 52 18 60 L6 71 M44 61.5 Q36 66 28 68 L17 71 M54 61.5 Q64 64 70 67 L76 71', 1.7)
      + aE(46, 60.5, 18, 4.2) + aP('M32 59.5 Q46 57 60 59', 0.8, PAPER) + aE(68, 59.5, 5.2, 3.4) + eye(70, 58.6, 0.9) + aP('M72 58 l8 -4 M72 59.4 l9 -1', 1) + aP('M62 61 L70 66 L73 69', 1.3)
      + aE(46, 77, 16, 1.8, INK, 0, ' opacity=".2"'),
  }),
  // 尺蠖蛊：在一根刻着尺寸的枝上弓成一个 Ω，一弓一伸往前挪
  inch: () => {
    const f = cb([24, 77], [22, 30], [68, 28], [70, 74]), r = () => 4.2;
    return {
      w: aE(48, 78, 40, 7, '#7a9a6a') + aE(48, 36, 18, 6, '#7a9a6a'),
      b: aP('M6 81 L94 81', 2.6) + R(10, i => aP(`M${10 + i * 9} 81 l0 ${i % 2 ? 3 : 5}`, 1))
        + tube(f, r) + rings(f, r, 9, 0.9)
        + aP('M21 81 l0 -3 M26 81 l0 -3 M66 78 l-1 3 M70 78 l1 3', 1.6) + aE(74, 73, 4.8, 4) + eye(76, 71.6, 1) + aP('M77 69 l3 -3', 1.1),
    };
  },
  // 瞬移蛊：从一个门洞里钻出、刀已出鞘；身后另一个门洞里只剩一道虚影
  blink: () => ({
    w: aE(22, 56, 10, 22, '#4a8a86') + aE(62, 56, 10, 22, '#4a8a86'),
    b: aE(22, 56, 7, 20, 'none', 0, ln(2.2)) + aE(22, 56, 4, 13, 'none', 0, ln(1) + dash('3 2.5')) + spiral(22, 56, 3, 1.5, 0, 0.8)
      + aE(40, 56, 10, 5, 'none', 0, ln(1) + dash('2 2.5')) + aC(52, 55, 3.6, 'none', ln(0.9) + dash('2 2'))
      + aE(56, 56, 8, 5.5, INK, 0, op('.35')) + aE(70, 56, 10, 6.5) + aP('M62 53 Q70 50 78 53', 1, PAPER) + aE(62, 56, 7, 20, 'none', 0, ln(2.4))
      + aC(83, 54, 5.2) + eye(85, 52.6, 1.1) + aP('M85 49 q3 -6 9 -7', 1)
      + aP('M78 60 L86 67 L95 62', 2.1) + aLegs([[68, 62, 0, 6, -2, 12, 1.5], [73, 62, 3, 6, 6, 11, 1.5]])
      + aP('M86 38 Q99 54 88 74', 1.2),
  }),
  // 定仙游（仙）：飞天一样的仙虫，细翅上扬，两条长长的飘带卷着，脚下祥云
  dingxian: () => ({
    w: aE(52, 46, 36, 20, '#4a8a86') + aC(66, 44, 14, '#c9a24a'),
    b: glassWing('M60 45 Q50 20 26 11 Q36 28 58 47 Z', '.34', 'M58 44 Q48 26 30 15') + glassWing('M60 47 Q42 37 14 34 Q30 44 58 49 Z', '.26', 'M56 47 Q38 40 20 36')
      + glassWing('M62 50 Q54 62 42 66 Q50 56 60 49 Z', '.24')
      + aP('M55 51 C41 57 35 71 21 67 C11 64 11 55 19 55', 2) + aP('M55 51 C41 57 35 71 21 67', 0.6, PAPER)
      + aP('M56 52 C47 65 47 81 31 85 C23 87 19 81 25 79', 1.8) + aP('M56 52 C47 65 47 81 31 85', 0.6, PAPER)
      + aE(63, 48.5, 9, 4, INK, -10) + aC(73, 45, 4.2) + eye(74.4, 44, 1) + aP('M75 42 Q83 30 93 30', 1) + aP('M75 43 Q87 38 95 42', 0.9)
      + yun(68, 72, 0.7, 1.2) + twinkle(86, 16, 1.8) + twinkle(18, 24, 1.4) + twinkle(90, 62, 1.3),
  }),

  // ===== 宙道 =====
  // 朝菌蛊（菌）：一朵早上冒出来的蘑菇，柄上一双凶眼，身后太阳才升起一半
  asahi: () => ({
    w: aC(70, 46, 14, '#e08a3a') + aE(42, 60, 26, 18, '#c8a070'),
    b: aF('M56 58 A14 14 0 0 1 84 58 Z', '#c0442a', op('.8')) + R(7, i => { const a = Math.PI + i * Math.PI / 6; return aP(`M${n1(70 + Math.cos(a) * 17)} ${n1(58 + Math.sin(a) * 17)} L${n1(70 + Math.cos(a) * 21)} ${n1(58 + Math.sin(a) * 21)}`, 1.2, '#c0442a'); })
      + aP('M8 81 L92 81', 1.4)
      + aF('M36 54 Q34 68 31 81 L51 81 Q47 68 46 54 Z')
      + aF('M16 53 Q18 29 41 27 Q62 28 66 51 Q60 55 41 55 Q22 55 16 53 Z')
      + aP('M22 53 l2 -3 M28 54 l1 -3 M34 54.5 l0 -3 M41 55 l0 -3 M48 54.5 l0 -3 M54 54 l-1 -3 M60 53 l-2 -3', 0.8, PAPER)
      + aC(30, 38, 2.6, PAPER) + aC(44, 33, 2, PAPER) + aC(55, 41, 1.8, PAPER) + aC(38, 45, 1.4, PAPER)
      + aP('M36 62 l4.4 1.6 M42.6 63.6 l4.4 -1.6', 1.2, PAPER) + aC(38.6, 65.4, 1.2, PAPER) + aC(44.4, 65.4, 1.2, PAPER)
      + aF('M60 81 Q61 74 62 70 L65 70 Q66 76 66 81 Z') + aF('M56 71 Q58 63 63.5 63 Q69 63 71 71 Z')
      + aP('M33 81 l-3 4 M41 81 l0 4 M49 81 l3 4', 1.4),
  }),
  // 沙漏蛊：身子是一只沙漏，沙往上流、堆在上头，头顶在上，腿从架子里伸出来
  hourglass: () => ({
    w: aE(48, 52, 18, 30, '#c8b070'),
    b: aF('M28 20 Q28 18 30 18 L66 18 Q68 18 68 20 L68 24 L28 24 Z') + aF('M28 80 L68 80 L68 84 Q68 86 66 86 L30 86 Q28 86 28 84 Z')
      + aP('M31 24 L31 80 M65 24 L65 80', 2)
      + aF('M36 24 L60 24 Q60 40 50 52 Q60 64 60 80 L36 80 Q36 64 46 52 Q36 40 36 24 Z', '#f3ecd8', ln(1.8))
      + aF('M37 25 L59 25 Q58.5 33 55 38 Q48 34 41 38 Q37.5 33 37 25 Z', INK, op('.85'))
      + aP('M48 76 L48 46', 1, INK, 'none', dash('1.4 2')) + aP('M45.5 66 L48 62 L50.5 66 M45.5 74 L48 70 L50.5 74', 0.8) + aF('M39 79.5 Q48 76 57 79.5 Z', INK, op('.7'))
      + aLegs([[31, 44, -7, -3, -13, 3, 1.7], [31, 64, -7, 3, -12, 11, 1.7], [65, 44, 7, -3, 13, 3, 1.7], [65, 64, 7, 3, 12, 11, 1.7]])
      + aC(55, 13, 5) + eye(57, 11.8, 1) + aP('M57 9 q4 -5 10 -5 M56 9 q1 -5 5 -7', 1),
  }),
  // 年轮蛊：一截树桩，顶面一圈圈年轮，树根抓地；它从桩侧探出头来，桩顶冒了新芽
  ring: () => ({
    w: aE(46, 58, 32, 24, '#8a7a3a'),
    b: aF('M18 46 L18 73 Q14 80 7 84 L21 82 Q26 86 31 84 L38 80 L58 80 Q64 86 70 84 L75 82 L85 84 Q78 78 74 72 L74 46 Z')
      + aP('M24 52 L24 72 M32 56 L32 78 M42 54 L42 78 M52 56 L52 78 M62 54 L62 76 M69 52 L69 70', 0.8, PAPER, 'none', ' opacity=".45"')
      + aE(46, 46, 28, 9, '#e9dfc4', 0, ln(2)) + R(4, i => aE(47 + i * 0.4, 46.4, (i + 1) * 5.4, (i + 1) * 1.75, 'none', 0, ln(0.9))) + aP('M48 46 L70 44.5', 0.8)
      + aE(77, 61, 4, 3.6) + aC(81.5, 58.5, 5.2) + eye(83.4, 57.2, 1.1) + aP('M84 54 q4 -8 10 -9 M83 54 q1 -8 6 -12', 1) + aP('M77 65 L83 69 L88 67', 1.6)
      + aP('M30 42 q-1 -6 2 -10', 1.2) + leaf(31, 35, 6, 220, 1.8, INK, false) + leaf(32, 36, 6, 320, 1.8, INK, false),
  }),
  // 刹那蛊：一支镖似的身子往前冲，翅向后掠，身后两道残影，刀光在前头交成一个叉
  instant: () => {
    const body = dx => `M${26 + dx} 54 Q${44 + dx} 46 ${64 + dx} 48 Q${74 + dx} 50 ${76 + dx} 52 Q${74 + dx} 56 ${64 + dx} 57 Q${44 + dx} 60 ${26 + dx} 54 Z`;
    return {
      w: aE(48, 52, 32, 10, '#8a7a3a') + aE(88, 52, 8, 22, '#c9a24a'),
      b: R(5, i => aP(`M${4 + i * 2} ${40 + i * 6} L${22 + i * 2} ${40 + i * 6}`, 0.9, INK, 'none', ' opacity=".5"'))
        + aF(body(-16), INK, op('.14')) + aF(body(-8), INK, op('.25'))
        + aF('M56 49 Q44 36 26 33 Q40 44 50 52 Z', INK, op('.6')) + aF('M56 56 Q44 68 28 72 Q40 62 50 54 Z', INK, op('.5'))
        + aF(body(0)) + aP('M34 53 Q50 50 66 51', 0.9, PAPER)
        + aC(78, 52, 4.4) + eye(79.6, 51, 1) + aP('M70 56 L80 62 L90 58', 1.9) + aP('M68 49 L78 42 L88 44', 1.9)
        + aP('M82 30 Q90 50 96 74', 1.5) + aP('M97 31 Q87 51 81 75', 1.5),
    };
  },
};
Object.assign(H, {
  xiongli: [72, 42], qingtian: [51, 39], fireant: [66, 57], pyre: [65, 53.5], char: [78, 64], flint: [76, 58], magma: [86, 65],
  snowsilk: [64.5, 42], snowflea: [68, 35.5], icesnail: [84, 52], coldcicada: [52, 24], hail: [77, 63], glacier: [84, 70],
  yupi: [83, 66], lockarm: [83, 63], baiyu: [77, 57],
  shengji: [64, 36], vine: [84, 40], cordy: [72, 20], fusang: [60, 30],
  stonecase: [76, 58], earthworm: [86, 56], moveshan: [80, 72],
  static: [56, 52], jingzhe: [52, 41], click: [79.5, 43], cloud: [55, 77], magstorm: [58, 58], jiuxiao: [66, 49],
  yueguang: [65, 60], sheli: [50, 46], shine: [56, 53], solar: [72, 61],
  ink: [58, 51], bat: [50, 52], eclipse: [69, 35.5], styx: [50, 32],
  tick: [69, 54], bloodant: [73.5, 56.7], amber: [57, 48.5], xueyue: [64, 46], chiba: [50, 31],
  widow: [68, 55.5],
  jiuchong: [60, 30], diting: [46, 46], zhihui: [52, 38],
  will: [58, 52], boneflute: [74, 33],
  strider: [68, 59.5], inch: [74, 73], blink: [83, 54], dingxian: [73, 45],
  asahi: [41, 64], hourglass: [55, 13], ring: [81.5, 58.5], instant: [78, 52],
});

// ---------- 召唤物：缩小、淡一点的简笔 ----------
const mini = (id, s = 0.72, o = 0.75) => () => {   // 按比例改写坐标（不用 <g transform>，免得升转飞白裁错）
  const a = A3[id](), k = v => n1(v), tx = x => k(50 + (x - 50) * s), ty = y => k(56 + (y - 56) * s);
  const sc = str => str
    .replace(/\b(cx|x)="(-?[\d.]+)"/g, (_, n, v) => `${n}="${tx(+v)}"`).replace(/\b(cy|y)="(-?[\d.]+)"/g, (_, n, v) => `${n}="${ty(+v)}"`)
    .replace(/ (r|rx|ry)="([\d.]+)"/g, (_, n, v) => ` ${n}="${k(+v * s)}"`).replace(/stroke-width="([\d.]+)"/g, (_, v) => `stroke-width="${k(+v * Math.max(0.8, s))}"`)
    .replace(/rotate\((-?[\d.]+) (-?[\d.]+) (-?[\d.]+)\)/g, (_, r, x, y) => `rotate(${r} ${tx(+x)} ${ty(+y)})`)
    .replace(/ d="([^"]+)"/g, (_, d) => ` d="${scaleD(d, tx, ty, s)}"`);
  return { w: sc(a.w), b: sc(a.b).replace(/<(path|ellipse|circle)\b([^>]*?)\/>/g, (m, t, at) => (at.includes(' opacity=') ? m : `<${t} opacity="${o}"${at}/>`)) };
};
// 路径坐标缩放：大写命令按绝对坐标换算，小写按相对量乘 s；A 命令的半径乘 s、旗标不动
function scaleD(d, tx, ty, s) {
  const toks = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let out = '', cmd = '', i = 0;
  const num = () => +toks[i++];
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) { cmd = toks[i++]; out += cmd; if (cmd === 'Z' || cmd === 'z') continue; }
    const up = cmd === cmd.toUpperCase(), c = cmd.toUpperCase();
    const P = () => { const x = num(), y = num(); return up ? `${tx(x)} ${ty(y)} ` : `${n1(x * s)} ${n1(y * s)} `; };
    if (c === 'H') { const x = num(); out += (up ? tx(x) : n1(x * s)) + ' '; }
    else if (c === 'V') { const y = num(); out += (up ? ty(y) : n1(y * s)) + ' '; }
    else if (c === 'A') { const rx = num(), ry = num(), rot = num(), la = num(), sw = num(); out += `${n1(rx * s)} ${n1(ry * s)} ${rot} ${la} ${sw} ` + P(); }
    else if (c === 'Q' || c === 'S') out += P() + P();
    else if (c === 'C') out += P() + P() + P();
    else out += P();
  }
  return out.trim();
}
const SUMMON3 = {
  grass: mini('cordy', 0.6),
  sprout: () => ({ w: aE(50, 62, 18, 12, '#7fae5c'), b: aP('M30 82 L70 82', 1.4) + aP('M50 82 Q49 72 50 62', 2.4) + leaf(50, 63, 15, 205, 4.5) + leaf(50, 62, 16, -28, 5) + aC(50, 61, 1.6) }),
  soul: () => ({ w: aE(50, 50, 18, 24, '#9a8ac0'), b: aF('M50 80 Q38 78 38 62 Q38 46 44 36 Q48 28 50 22 Q54 30 58 38 Q64 50 62 64 Q60 78 50 80 Z', INK, op('.45')) + aP('M50 80 Q38 78 38 62 Q38 46 44 36 Q48 28 50 22 Q54 30 58 38 Q64 50 62 64 Q60 78 50 80 Z', 1.2) + aC(46, 56, 1.6) + aC(54, 56, 1.6) + aP('M44 80 q-4 4 -8 4 M56 80 q4 4 8 4', 1, INK, 'none', ' opacity=".6"') }),
  wormhalf: () => { const f = cb([22, 74], [32, 52], [60, 52], [74, 70]), r = t => 4.6 - t * 1.4; return { w: aE(48, 66, 28, 10, '#b87a6a'), b: aP('M10 80 L90 80', 1.4) + tube(f, r) + rings(f, r, 6, 0.8) + aE(22, 74, 2, 4, '#c98a7a', -30, ln(1.1)) }; },
  bonesoul: () => ({ w: aE(50, 54, 20, 22, '#8a7aa0'), b: aF('M50 82 Q36 76 40 58 Q42 48 50 40 Q58 48 60 58 Q64 76 50 82 Z', INK, op('.3')) + aC(50, 44, 9, '#e8dcc0', ln(1.8)) + aC(46.5, 43, 2.2) + aC(53.5, 43, 2.2) + aP('M47 50 l6 0 M48 50 l0 2 M50 50 l0 2 M52 50 l0 2', 0.9) + aP('M44 62 l12 0 M45 68 l10 0 M46 74 l8 0', 1.8, '#e8dcc0') }),
  xueshen: () => ({ w: aE(50, 56, 18, 24, '#a8241f'), b: aF('M50 22 Q60 38 60 50 Q60 60 50 62 Q40 60 40 50 Q40 38 50 22 Z', '#8a1f2b', ln(1.4)) + aP('M44 62 L40 78 M56 62 L60 78 M42 46 L32 54 M58 46 L68 54', 2.4, '#8a1f2b') + aC(46.5, 48, 1.3, PAPER) + aC(53.5, 48, 1.3, PAPER) }),
};
Object.assign(H, { grass: [50, 34], sprout: [50, 60], soul: [50, 52], wormhalf: [70, 68], bonesoul: [50, 44], xueshen: [50, 46] });

const ART3 = Object.fromEntries([...Object.entries(A3), ...Object.entries(SUMMON3)].map(([k, f]) => [k, f()]));
const HEAD3 = H;
// 升转图层的外框：框住墨色主体（不含火星、冰晶这类点缀），二转飞白的两道干笔落在框高 0.3～0.66 处，要扫得到身子；没写的物种用 art.js 的默认外框
const BOX3 = {
  xiongli: [14, 30, 76, 46], qingtian: [20, 14, 60, 74], fireant: [16, 36, 66, 36], pyre: [12, 8, 60, 60], char: [14, 34, 70, 40], flint: [22, 26, 62, 46], magma: [8, 42, 88, 34],
  snowsilk: [12, 36, 60, 42], snowflea: [20, 28, 60, 50], icesnail: [10, 28, 78, 50], coldcicada: [36, 10, 30, 70], hail: [18, 46, 70, 30], glacier: [16, 16, 64, 66],
  yupi: [14, 43, 74, 30], lockarm: [16, 46, 72, 26], baiyu: [22, 32, 62, 46],
  shengji: [34, 10, 56, 54], vine: [10, 26, 80, 62], cordy: [12, 50, 64, 34], fusang: [16, 18, 64, 70],
  stonecase: [12, 46, 74, 30], earthworm: [6, 50, 86, 34], moveshan: [20, 18, 70, 64],
  static: [20, 30, 56, 50], jingzhe: [36, 32, 30, 50], click: [22, 36, 64, 22], cloud: [16, 4, 70, 60], magstorm: [16, 44, 66, 30], jiuxiao: [12, 12, 76, 76],
  yueguang: [20, 14, 52, 72], sheli: [26, 18, 48, 68], shine: [16, 46, 50, 22], solar: [24, 14, 56, 66],
  ink: [12, 38, 80, 32], bat: [10, 12, 80, 52], eclipse: [20, 20, 54, 52], styx: [10, 12, 80, 80],
  tick: [16, 34, 62, 40], bloodant: [10, 36, 82, 50], amber: [16, 14, 66, 74], xueyue: [18, 38, 78, 34], chiba: [20, 18, 60, 72],
  widow: [18, 22, 56, 46],
  jiuchong: [26, 26, 40, 56], diting: [22, 16, 44, 58], zhihui: [24, 24, 56, 54],
  will: [12, 18, 62, 68], boneflute: [12, 30, 74, 52],
  strider: [14, 54, 72, 14], inch: [18, 30, 60, 52], blink: [14, 36, 80, 40], dingxian: [14, 12, 80, 64],
  asahi: [14, 26, 56, 56], hourglass: [26, 8, 46, 80], ring: [8, 36, 80, 50], instant: [22, 32, 70, 42],
  grass: [22, 27, 56, 48], sprout: [29, 52, 42, 31], soul: [35, 21, 30, 64], wormhalf: [9, 52, 82, 29], bonesoul: [38, 34, 24, 49], xueshen: [31, 21, 38, 58],
};

return { ART3, HEAD3, BOX3 };
})();
// ---- src/art.js

// 蛊码 GuCode · 程序水墨蛊虫。头朝右，viewBox 0 0 100 100。墨色主体 + 一抹淡彩，毛笔边靠 #ink/#wash 滤镜。


const INK = '#1c1915', PAPER = '#efe7d4';
const aE = (cx, cy, rx, ry, f = INK, r = 0, ex = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}"${r ? ` transform="rotate(${r} ${cx} ${cy})"` : ''}${ex}/>`;
const aC = (cx, cy, r, f = INK, ex = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}"${ex}/>`;
const aP = (d, w = 2, s = INK, f = 'none', ex = '') => `<path d="${d}" stroke="${s}" stroke-width="${w}" fill="${f}" stroke-linecap="round" stroke-linejoin="round"${ex}/>`;
const aF = (d, f = INK, ex = '') => `<path d="${d}" fill="${f}"${ex}/>`;
const aLegs = arr => arr.map(([x, y, kx, ky, dx, dy, w]) => aP(`M${x} ${y} L${x + kx} ${y + ky} L${x + dx} ${y + dy}`, w || 1.8)).join('');
const eye = (x, y, r = 1.7) => aC(x, y, r, PAPER);

const ART_DEFS = `<filter id="ink" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3.4" xChannelSelector="R" yChannelSelector="G"/></filter><filter id="wash" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="0.9"/></filter><filter id="grim" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="1.2" result="a"/><feMorphology in="SourceAlpha" operator="dilate" radius="2.4" result="b"/><feComposite in="b" in2="a" operator="out" result="r"/><feFlood flood-color="#c08a2e"/><feComposite in2="r" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="grim6" x="-14%" y="-14%" width="128%" height="128%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="1.2" result="a"/><feMorphology in="SourceAlpha" operator="dilate" radius="2.8" result="b"/><feComposite in="b" in2="a" operator="out" result="r"/><feFlood flood-color="#d9a441"/><feComposite in2="r" operator="in" result="g"/><feMorphology in="SourceAlpha" operator="dilate" radius="3.6" result="c"/><feMorphology in="SourceAlpha" operator="dilate" radius="4.2" result="d"/><feComposite in="d" in2="c" operator="out" result="r2"/><feFlood flood-color="#b5301f"/><feComposite in2="r2" operator="in" result="z"/><feMerge><feMergeNode in="z"/><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="gyun" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="21" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="2.2" result="b"/><feTurbulence type="fractalNoise" baseFrequency="0.13" numOctaves="2" seed="5" result="m"/><feColorMatrix in="m" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.2 0 0 0 -0.45" result="ma"/><feComposite in="b" in2="ma" operator="in"/></filter>`;

const mothWings = (c1 = INK) => aF('M52 52 Q40 18 18 20 Q8 34 26 46 Q36 52 52 54 Z', c1, ' fill-opacity=".9"') + aF('M52 56 Q36 60 24 76 Q36 82 46 70 Q52 62 54 58 Z', c1, ' fill-opacity=".8"');

const A = {
  boar: () => ({
    w: aE(46, 60, 32, 17, '#8a5a32'),
    b: aLegs([[30, 66, -1, 7, -3, 14, 4.5], [40, 69, 1, 6, 0, 12, 4.5], [57, 69, 1, 6, 2, 12, 4.5], [65, 66, 2, 6, 4, 13, 4.5]])
      + aE(46, 56, 25, 16) + aE(71, 56, 12, 11.5) + aE(82, 60, 6.5, 5.5)
      + aF('M64 47 L68 36 L74 46 Z') + [27, 33, 39, 45, 51, 57].map((x, i) => aP(`M${x} ${42 - (i % 2) * 1.5} l-3 -${6 + (i % 3)}`, 1.7)).join('')
      + aP('M79 65 Q91 66 90 54', 3.2, PAPER) + aC(85, 59, 1.1, PAPER) + eye(74, 52) + aP('M21 52 q-7 -3 -4 -9', 1.6),
  }),
  fire: () => {
    let b = '', pts = [];
    for (let i = 0; i < 8; i++) pts.push([16 + i * 9.2, 58 + Math.sin(i * 0.95) * 8, 3.6 + i * 0.85]);
    pts.forEach(([x, y, r]) => { b += aC(x, y, r); });
    const [hx, hy] = pts[7];
    b += aP(`M${hx + 3} ${hy - 6} q4 -10 12 -12`, 1.3) + aP(`M${hx + 1} ${hy - 7} q0 -10 6 -15`, 1.3) + eye(hx + 3, hy - 2, 1.5) + aP(`M${hx + 7} ${hy + 2} l5 2`, 1.6);
    pts.slice(1, 7).forEach(([x, y, r]) => { b += aP(`M${x} ${y + r - 1} l-1 4`, 1.1); });
    return { w: aF('M19 58 Q3 52 6 36 Q11 47 15 45 Q11 33 20 26 Q24 42 26 52 Z', '#c0392b') + aE(50, 58, 30, 9, '#c0392b', 0, ' opacity=".35"'), b };
  },
  twin: () => {
    const body = mothWings() + aC(30, 32, 4, PAPER) + aC(30, 32, 1.8) + aE(55, 55, 14, 4.5, INK, -12) + aC(69, 51, 4.2) + aP('M71 48 q6 -9 13 -10', 1.2) + aP('M70 47 q3 -9 9 -13', 1.2) + eye(71, 50, 1.2);
    return { w: aE(40, 46, 26, 22, '#3d5a80'), b: `<g transform="translate(-10 -7)" opacity=".26">${body}</g>` + body };
  },
  iron: () => ({
    w: aE(50, 54, 32, 22, '#5f6b5a'),
    b: aLegs([[34, 64, -4, 7, -8, 14], [48, 66, 0, 7, -2, 14], [62, 64, 4, 7, 6, 14], [40, 64, -2, 6, -4, 12, 1.2], [56, 64, 2, 6, 4, 12, 1.2]])
      + aF('M20 66 Q22 30 52 28 Q80 30 82 66 Z') + aP('M52 30 L52 65', 1.4, PAPER) + aP('M28 50 Q52 42 76 50', 1.2, PAPER) + aP('M24 60 Q52 54 80 60', 1.2, PAPER)
      + aC(40, 40, 1.3, PAPER) + aC(64, 40, 1.3, PAPER) + aE(85, 61, 7, 6) + aP('M88 56 Q95 43 86 34', 3.8) + eye(88, 60, 1.3),
  }),
  thorn: () => {
    let b = '';
    for (let i = 0; i < 7; i++) {
      const x = 16 + i * 10, y = 60 - Math.sin(i * 0.6) * 3;
      b += aP(`M${x} ${y + 3} q3 6 -1 12`, 1.4) + aP(`M${x + 2} ${y + 3} q4 5 4 11`, 1.1) + aE(x, y, 6, 5) + aF(`M${x - 3} ${y - 3} L${x - 1} ${y - 14} L${x + 3} ${y - 3} Z`);
    }
    b += aE(86, 57, 7.5, 6) + aP('M91 60 q6 3 2 9', 2.2) + aP('M91 54 q6 -3 3 -9', 2.2) + eye(88, 55, 1.4);
    return { w: aE(52, 56, 38, 12, '#4b6a4e'), b };
  },
  mantis: () => ({
    w: aF('M28 60 c-6 -8 4 -12 6 -5 c2 -7 12 -3 6 5 l-6 6 z', '#8c2f2f') + aE(40, 60, 22, 9, '#8c2f2f', 8, ' opacity=".45"'),
    b: aLegs([[46, 63, -6, 7, -12, 15, 1.4], [52, 63, 2, 8, 8, 16, 1.4], [42, 62, -8, 6, -18, 12, 1.3]])
      + aE(34, 61, 21, 6.5, INK, 8) + aE(40, 55, 18, 4.5, INK, 8, ' fill-opacity=".55"') + aP('M52 60 L67 37', 5.2)
      + aF('M61 31 L80 26 L71 41 Z') + aC(74, 30, 2.6, PAPER) + aC(74.6, 30, 1.1)
      + aP('M65 41 L80 50 L73 63', 3) + aP('M80 50 l-3 3 M78 54 l-3 2 M76 58 l-3 2', 1.2) + aP('M73 63 L84 59', 2.2)
      + aP('M71 28 q4 -12 14 -16', 1.1) + aP('M73 27 q8 -8 18 -8', 1.1),
  }),
  bone: () => {
    let b = '';
    const segs = [[24, 64, 8], [34, 62, 10], [46, 60, 11], [58, 59, 11.5], [71, 58, 10.5]];
    segs.forEach(([x, y, r]) => { b += aC(x, y, r, '#cfc4ab', ` stroke="${INK}" stroke-width="2.4"`); });
    segs.slice(1, 4).forEach(([x, y, r]) => { b += aP(`M${x - 4} ${y + r - 1} l-1 5 M${x + 3} ${y + r - 1} l1 5`, 2); });
    b += aC(74, 55, 2.6) + aC(68, 55, 2.2) + aP('M68 63 q4 2 9 0', 1.6) + aP('M46 52 l2 3 M57 51 l-1 3', 1.4);
    return { w: aE(48, 60, 32, 15, '#7c8766'), b };
  },
  queen: () => ({
    w: aE(36, 60, 22, 13, '#b8862b', 10),
    b: aE(50, 34, 17, 7, INK, -28, ' fill-opacity=".35"') + aE(44, 39, 13, 5.5, INK, -12, ' fill-opacity=".3"')
      + aLegs([[56, 60, -2, 8, -6, 15, 1.4], [61, 61, 1, 8, 2, 16, 1.4], [66, 60, 3, 7, 8, 14, 1.4]])
      + aE(36, 60, 20, 12, INK, 10) + [29, 37, 45].map(x => aP(`M${x} ${50 + (x - 29) / 6} q-4 10 0 21`, 2.4, PAPER)).join('')
      + aP('M17 63 L7 68', 2.8) + aC(60, 55, 9) + aC(75, 50, 7) + aP('M71 43 L72 36 L75 41 L78 35 L80 43', 1.7) + eye(78, 49) + aP('M80 46 q6 -6 11 -6', 1.2),
  }),
  cicada: () => ({
    w: aF('M70 48 L12 56 L22 72 L70 62 Z', '#b39436'),
    b: aF('M70 49 L12 57 L22 71 L70 62 Z', INK, ' fill-opacity=".5"') + aP('M68 52 L20 61 M66 57 L26 67 M46 54 L36 66', 1, PAPER)
      + aLegs([[56, 64, 0, 7, -4, 14, 1.6], [62, 65, 2, 7, 4, 13, 1.6]])
      + aE(58, 58, 15, 9.5) + aE(77, 57, 8, 9) + aC(81, 50, 3.2) + aC(81, 50, 1.4, PAPER) + aC(80, 64, 2.4) + aP('M85 59 l6 2', 1.6),
  }),
  drum: () => ({
    w: aE(48, 56, 24, 20, '#9c3b2c'),
    b: aLegs([[34, 70, -2, 6, -6, 12, 2.2], [48, 72, 0, 6, -1, 12, 2.2], [62, 70, 2, 6, 6, 12, 2.2]])
      + aF('M28 44 L68 44 Q73 58 68 72 L28 72 Q23 58 28 44 Z') + aE(48, 44, 20, 5, '#3a3530') + aE(48, 44, 20, 5, 'none', 0, ` stroke="${PAPER}" stroke-width="1.2"`)
      + aP('M27 51 Q48 56 69 51', 1.3, PAPER) + aP('M27 65 Q48 70 69 65', 1.3, PAPER) + [33, 41, 49, 57, 64].map(x => aC(x, 58.5, 1.2, PAPER)).join('')
      + aE(76, 60, 6, 6) + eye(78, 58, 1.3) + aP('M74 55 L88 30', 2.2) + aC(89, 28, 3.4) + aP('M71 55 L77 26', 2.2) + aC(78, 24, 3.4),
  }),
  scorp: () => {
    let b = aLegs([[40, 66, -4, 6, -9, 13, 1.4], [46, 67, -2, 7, -4, 14, 1.4], [52, 67, 2, 7, 4, 14, 1.4], [58, 66, 4, 6, 9, 12, 1.4]]);
    b += [[32, 62, 5.2], [24, 54, 4.8], [21, 44, 4.4], [25, 35, 4], [33, 29, 3.6]].map(([x, y, r]) => aC(x, y, r)).join('');
    b += aP('M36 27 Q46 25 44 35', 2.8) + aE(46, 64, 15, 7.5) + aE(61, 63, 8, 6.5);
    b += aP('M64 60 L76 54', 3.2) + aP('M76 54 Q88 46 92 55 M76 54 Q86 62 92 55', 2.6) + aP('M64 66 L74 70', 2.6) + aP('M74 70 Q85 66 89 73 M74 70 Q82 78 89 73', 2.2) + eye(66, 61, 1.3);
    return { w: aC(42, 31, 8, '#a4542a') + aE(46, 64, 20, 9, '#a4542a', 0, ' opacity=".35"'), b };
  },
  moth: () => ({
    w: aE(38, 42, 22, 18, '#6f9a8f') + aE(30, 78, 9, 16, '#6f9a8f', 30),
    b: mothWings() + aF('M50 58 Q34 72 22 96 Q30 76 42 60 Z') + aC(32, 34, 7, PAPER) + aC(35, 32, 6.2)
      + aE(56, 52, 11, 4.2, INK, -18) + aC(67, 48, 3.6) + eye(68.5, 47.4, 1.1)
      + aP('M68 45 Q74 33 82 29', 1.2) + [0, 1, 2, 3].map(i => aP(`M${70 + i * 3} ${41 - i * 3} l3 -1`, 0.9)).join(''),
  }),
  pupa: () => ({
    w: aE(50, 60, 26, 15, '#7c8766'),
    b: aE(50, 60, 24, 13) + aP('M34 52 Q40 64 34 70 M44 48 Q50 62 44 72 M56 48 Q62 62 56 72 M66 52 Q72 62 66 68', 1.3, PAPER) + aP('M74 60 q8 -4 12 -12', 1.4),
  }),
};
A.shade = () => { const t = A.twin(); return { w: '', b: `<g opacity=".5">${t.b}</g>` }; };
A.lunar = () => { const t = A.moth(); return { w: t.w, b: `<g opacity=".55">${t.b}</g>` }; };
// 蛊典扩充：52 只新蛊与 6 种召唤物的画（src/art2.js），同名不覆盖
Object.entries(ART2).forEach(([k, v]) => { if (!A[k]) A[k] = () => v; });
// 蛊典第二卷新 56 种与 6 种召唤物的画（src/art3.js），同名不覆盖；外框和头的位置在下面并进 RANK_BOX / RANK_HEAD
Object.entries(ART3).forEach(([k, v]) => { if (!A[k]) A[k] = () => v; });

// ---------- 升转外貌：在任何物种的原画上叠程序化图层，不改原画 ----------
// 一转原样；二转飞白墨纹、体型略大；三转身后一圈真元色晕染；四转金线勾边、晕染更浓、脚下一方小印；
// 五转头光、周身墨气缓缓流动（.g-qi，可被 calm / prefers-reduced-motion 关掉）；六转仙蛊：金朱背光、双线描金、金箔、仙印。
// 品质（rarity）不画在虫身上，用 rarityFrame(r) 给卡片加边框和角标。
const GU_BOX = [12, 28, 78, 52];   // 没登记的物种（含以后新加的）用这个外框 [x, y, w, h]
const RANK_BOX = { boar: [16, 33, 74, 49], fire: [12, 39, 83, 35], twin: [4, 13, 80, 65], iron: [20, 28, 72, 52], thorn: [10, 43, 85, 33], mantis: [12, 12, 79, 67], bone: [16, 48, 66, 29], queen: [7, 20, 84, 57], cicada: [12, 47, 79, 31], drum: [26, 21, 67, 63], scorp: [17, 25, 75, 56], moth: [14, 20, 68, 76], pupa: [26, 47, 60, 26], shade: [4, 13, 80, 65], lunar: [14, 20, 68, 76] };
const RANK_HEAD = { boar: [74, 53], fire: [82, 57], twin: [69, 50], iron: [86, 60], thorn: [87, 56], mantis: [73, 31], bone: [71, 56], queen: [76, 49], cicada: [79, 54], drum: [76, 59], scorp: [64, 62], moth: [67, 48], pupa: [74, 58], shade: [69, 50], lunar: [67, 48] };
Object.entries(BOX3).forEach(([k, v]) => { if (!RANK_BOX[k]) RANK_BOX[k] = v; });
Object.entries(HEAD3).forEach(([k, v]) => { if (!RANK_HEAD[k]) RANK_HEAD[k] = v; });
const RANK_CN = ['', '一', '二', '三', '四', '五', '仙'];
const rankColor = r => (r >= 6 ? '#d9a441' : ZHENYUAN.colors[Math.max(1, Math.min(5, r | 0))]);
const rarityFrame = r => `rf rf${Math.max(0, Math.min(4, r | 0))}`;
const rn = v => +v.toFixed(1), rcl = (v, a, b) => Math.max(a, Math.min(b, v));
const GLYPH = {   // 小印里的笔画：四、五、仙（几像素大，只取其意）
  4: 'M-2.3 -2 h4.6 v4.1 h-4.6 z M-.8 -2 q.2 1.6 -.6 2.6 M.8 -2 v2 q0 .7 .9 .7',
  5: 'M-2.2 -2.3 h4.4 M-.5 -2.3 l-.7 4.4 M-1.7 -.1 h3.3 v2.3 M-2.6 2.2 h5.2',
  6: 'M-1.6 -2.6 q-.6 1.6 -1.3 2.4 M-2 -.6 v3.2 M.9 -2.6 v4.8 M-.4 -.6 v2.8 h2.7 v-2.8',
};
function rankSeal(x, y, r) {
  const bg = r >= 6 ? '#b5301f' : '#a82a1b', edge = r >= 6 ? '#d9a441' : PAPER;
  return `<g transform="translate(${rn(x)} ${rn(y)}) rotate(-7)"><rect x="-4.6" y="-4.6" width="9.2" height="9.2" rx=".5" fill="${bg}"/><rect x="-3.5" y="-3.5" width="7" height="7" fill="none" stroke="${edge}" stroke-width=".55"/><path d="${GLYPH[Math.min(6, r)]}" fill="none" stroke="${PAPER}" stroke-width=".75" stroke-linecap="round" stroke-linejoin="round" transform="scale(.82)"/></g>`;
}
function rankLayers(rank, bbox = GU_BOX, o = {}) {
  const r = rcl(rank | 0, 1, 6), [x, y, w, h] = bbox, cx = x + w / 2, cy = y + h / 2, col = rankColor(r);
  const L = { back: '', front: '', rim: r >= 4 ? (r >= 6 ? 'grim6' : 'grim') : '', scale: [1, 1, 1.04, 1.06, 1.08, 1.09, 1.1][r] };
  if (r < 2) return L;
  // 二转起：飞白——两道干笔，每道是几根错开断开的纸色细丝，裁在虫身轮廓里，只在墨上露白
  const DA = ['7 1.6 11 2.4 4 1.2', '12 2.8 5 1.4 9 2', '4 1.2 9 3 13 1.6', '10 1.8 3 2.6 8 1.4'];
  let fb = '';
  [[.04, .4, .96, .3, .5], [.14, .66, .9, .58, .58]].forEach(([a, b, c, d, cm], j) => {
    for (let i = 0; i < 4; i++) {
      const off = i * 1.15 - 1.7, x1 = x + w * a, y1 = y + h * b + off, x2 = x + w * c, y2 = y + h * d + off, mx = x + w * cm, my = Math.min(y1, y2) - h * .1 + off;
      fb += `<path d="M${rn(x1 + i * 1.5)} ${rn(y1)} Q${rn(mx)} ${rn(my)} ${rn(x2 - i * 2)} ${rn(y2)}" stroke-width="${[.9, .6, .75, .5][i]}" stroke-dasharray="${DA[(i + j) % 4]}" stroke-dashoffset="${i * 3 + j * 5}"/>`;
    }
  });
  L.front += `<g clip-path="url(#${o.clip})"><g stroke="${PAPER}" fill="none" stroke-linecap="round" opacity="${r >= 4 ? .85 : .75}" filter="url(#ink)">${fb}</g></g>`;
  // 三转起：身后真元色晕染，一转比一转浓
  if (r >= 3) {
    const ax = Math.min(42, w * .56 + 6), ay = Math.min(40, h * .56 + 8), k = [0, 0, 0, .6, .8, .9, 1][r];
    const ring = (s, op, c) => `<ellipse cx="${rn(cx)}" cy="${rn(cy)}" rx="${rn(ax * s)}" ry="${rn(ay * s)}" fill="${c}" fill-opacity="${op}"/>`;
    L.back += `<g filter="url(#gyun)" opacity="${k}">${ring(1, .32, col)}${ring(.78, .38, col)}${ring(.54, .42, col)}${r >= 6 ? ring(.62, .42, '#b5301f') + ring(.36, .5, '#d9a441') : ''}</g>`;
  }
  // 四转起：脚下一方小印（金线勾边由 rim 滤镜做）
  if (r >= 4) L.front += rankSeal(Math.min(91, x + w * .82), Math.min(92, y + h + 4), r);
  // 五转起：头光 + 墨气
  if (r >= 5) {
    const [hx, hy] = o.head || [x + w * .8, y + h * .4], hr = r >= 6 ? 14 : 12;
    L.back += `<g fill="none" filter="url(#ink)"><circle cx="${hx}" cy="${hy}" r="${hr}" fill="${PAPER}" fill-opacity=".55"/><circle cx="${hx}" cy="${hy}" r="${hr}" fill="${col}" fill-opacity="${r >= 6 ? .28 : .24}"/><circle cx="${hx}" cy="${hy}" r="${hr}" stroke="${col}" stroke-width="1.6"/><circle cx="${hx}" cy="${hy}" r="${hr + 2.6}" stroke="${col}" stroke-width=".7" opacity=".75"/></g>`;
    // 墨气：绕身两三道断续的弧，像气在身周打转
    const qc = r >= 6 ? '#b8862b' : '#1c1915', ex = Math.min(46, w * .56 + 5), ey = Math.min(44, h * .56 + 7);
    const arc = (a0, a1, s, sw, op) => { let d = ''; for (let i = 0; i <= 24; i++) { const t = (a0 + (a1 - a0) * i / 24) * Math.PI / 180, k = s * (1 + .06 * Math.sin(i * .9)); d += `${i ? 'L' : 'M'}${rn(rcl(cx + Math.cos(t) * ex * k, 2, 98))} ${rn(rcl(cy + Math.sin(t) * ey * k, 2, 98))} `; } return `<path d="${d}" stroke-width="${sw}" opacity="${op}"/>`; };
    const wisps = arc(150, 250, 1, 1.8, .55) + arc(320, 410, .96, 1.5, .5) + arc(60, 120, 1.06, 1.1, .4) + arc(255, 300, .9, .9, .35);
    L.back += `<g class="${o.still ? '' : 'g-qi'}" fill="none" stroke="${qc}" stroke-linecap="round" filter="url(#wash)">${wisps}</g>`;
  }
  // 六转仙蛊：金色背光（火焰纹）+ 金箔
  if (r >= 6) {
    const ax = Math.min(47, w * .64 + 4), ay = Math.min(46, Math.max(30, h * .72 + 6));
    let d = '';
    for (let i = 0; i <= 96; i++) { const t = i / 96 * 6.2832, k = 1 + .07 * Math.pow(Math.abs(Math.sin(t * 6)), 3); d += `${i ? 'L' : 'M'}${rn(cx + Math.cos(t) * ax * k)} ${rn(cy + Math.sin(t) * ay * k)} `; }   // 尖焰
    L.back = `<g fill="none" filter="url(#ink)"><path d="${d}Z" stroke="#d9a441" stroke-width="1.1" opacity=".9"/><ellipse cx="${rn(cx)}" cy="${rn(cy)}" rx="${rn(ax * .86)}" ry="${rn(ay * .86)}" stroke="#b5301f" stroke-width=".6" opacity=".7"/></g>` + L.back;
    const leaf = [[.02, .1], [.9, .04], [1.02, .7], [-.04, .82], [.46, -.12], [.7, 1.08], [.2, 1.04]];
    L.front += leaf.map(([a, b], i) => { const px = rcl(x + w * a, 3, 96), py = rcl(y + h * b, 3, 96), s = 1.4 + (i % 3) * .5; return `<path d="M${rn(px)} ${rn(py - s)} L${rn(px + s * .8)} ${rn(py)} L${rn(px)} ${rn(py + s * .9)} L${rn(px - s * .7)} ${rn(py + .2)} Z" fill="${i % 2 ? '#e8c76a' : '#c08a2e'}"/>`; }).join('');
  }
  return L;
}

function guSVG(sp, o = {}) {
  const f = A[sp] || A.pupa, { w, b } = f();
  const size = o.size ? ` width="${o.size}" height="${o.size}"` : '';
  const r = Math.max(1, Math.min(6, o.rank | 0 || 1)), rar = o.rarity != null ? ` data-rar="${Math.max(0, Math.min(4, o.rarity | 0))}"` : '';
  if (r === 1) {   // 一转：原画原样
    const defs = o.standalone ? `<defs>${ART_DEFS}</defs>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${size} class="gsvg" aria-hidden="true"${rar}>${defs}<g filter="url(#wash)" opacity=".5">${w}</g><g filter="url(#ink)">${b}</g></svg>`;
  }
  const key = A[sp] ? sp : 'pupa', box = RANK_BOX[key] || GU_BOX, clip = 'gc-' + key;
  const L = rankLayers(r, box, { head: RANK_HEAD[key], clip, still: o.still || o.standalone });
  const cx = rn(box[0] + box[2] / 2), cy = rn(box[1] + box[3] / 2);
  const T = L.scale !== 1 ? ` transform="translate(${cx} ${cy}) scale(${L.scale}) translate(${-cx} ${-cy})"` : '';
  const defs = `<defs>${o.standalone ? ART_DEFS : ''}<clipPath id="${clip}">${b.replace(/<\/?g\b[^>]*>/g, '')}</clipPath></defs>`;
  const body = L.rim ? `<g filter="url(#${L.rim})">${b}</g>` : b;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${size} class="gsvg gr${r}" aria-hidden="true"${rar}>${defs}<g${T}>${L.back}<g filter="url(#wash)" opacity=".5">${w}</g><g filter="url(#ink)">${body}</g>${L.front}</g></svg>`;
}

// ---- src/art-food.js（包一层，只放出 export）
const { FOOD_ART, foodSVG } = (() => {
// 蛊码 GuCode · 食物图标（与蛊画同一套笔法：viewBox 0 0 100 100，w = 淡彩晕染，b = 墨色主体，套 #wash / #ink 两个滤镜）。
// 按 foods.js 每种的 look 画：轮廓大、线条粗、各带一个主色，48px 下也认得出。
// 导出：foodSVG(id, { size, standalone })，standalone 时自带滤镜（卡片导出图用）；FOOD_ART[id] = { w, b }。
// 不认识的 id（以后新加、还没画的）画一个扎绳的油纸包，不报错。

const INK = '#1c1915', PAPER = '#efe7d4';
const n1 = v => +(+v).toFixed(1);
const aE = (cx, cy, rx, ry, f = INK, r = 0, ex = '') => `<ellipse cx="${n1(cx)}" cy="${n1(cy)}" rx="${n1(rx)}" ry="${n1(ry)}" fill="${f}"${r ? ` transform="rotate(${n1(r)} ${n1(cx)} ${n1(cy)})"` : ''}${ex}/>`;
const aC = (cx, cy, r, f = INK, ex = '') => `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" fill="${f}"${ex}/>`;
const aP = (d, w = 2, s = INK, f = 'none', ex = '') => `<path d="${d}" stroke="${s}" stroke-width="${w}" fill="${f}" stroke-linecap="round" stroke-linejoin="round"${ex}/>`;
const aF = (d, f = INK, ex = '') => `<path d="${d}" fill="${f}"${ex}/>`;
const R = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');
const ln = (w, c = INK) => ` stroke="${c}" stroke-width="${w}" stroke-linejoin="round"`;
const op = v => ` opacity="${v}"`;
// 叶 / 花瓣：柄在 (x, y)，朝 ang 度伸 len，半宽 wd
const leaf = (x, y, len, ang, wd, f = INK, ex = '') => {
  const a = ang * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), tx = x + ca * len, ty = y + sa * len, mx = x + ca * len * 0.45, my = y + sa * len * 0.45;
  return aF(`M${n1(x)} ${n1(y)} Q${n1(mx - sa * wd * 1.6)} ${n1(my + ca * wd * 1.6)} ${n1(tx)} ${n1(ty)} Q${n1(mx + sa * wd * 1.6)} ${n1(my - ca * wd * 1.6)} ${n1(x)} ${n1(y)} Z`, f, ex);
};
// 小骨头（两头圆疙瘩）
const bone = (x1, y1, x2, y2, w = 3.4, f = '#ece2c8') => aP(`M${x1} ${y1} L${x2} ${y2}`, w + 2.4) + aP(`M${x1} ${y1} L${x2} ${y2}`, w, f)
  + [[x1, y1, -1], [x2, y2, 1]].map(([x, y, s]) => { const a = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2, dx = Math.cos(a) * w * 0.55, dy = Math.sin(a) * w * 0.55; return aC(x + dx, y + dy, w * 0.62, f, ln(1.2)) + aC(x - dx, y - dy, w * 0.62, f, ln(1.2)); }).join('');
// 水滴（尖朝上）
const drop = (x, y, s = 1, f = INK, ex = '') => aF(`M${x} ${n1(y - 5 * s)} Q${n1(x + 3.4 * s)} ${n1(y - 0.6 * s)} ${n1(x + 3 * s)} ${n1(y + 1.6 * s)} Q${n1(x + 2.4 * s)} ${n1(y + 4 * s)} ${x} ${n1(y + 4 * s)} Q${n1(x - 2.4 * s)} ${n1(y + 4 * s)} ${n1(x - 3 * s)} ${n1(y + 1.6 * s)} Q${n1(x - 3.4 * s)} ${n1(y - 0.6 * s)} ${x} ${n1(y - 5 * s)} Z`, f, ex);
// 四角小星
const twinkle = (x, y, s = 2, c = INK) => aF(`M${x} ${n1(y - s * 1.6)} Q${n1(x + s * 0.25)} ${n1(y - s * 0.25)} ${n1(x + s * 1.6)} ${y} Q${n1(x + s * 0.25)} ${n1(y + s * 0.25)} ${x} ${n1(y + s * 1.6)} Q${n1(x - s * 0.25)} ${n1(y + s * 0.25)} ${n1(x - s * 1.6)} ${y} Q${n1(x - s * 0.25)} ${n1(y - s * 0.25)} ${x} ${n1(y - s * 1.6)} Z`, c);
// 六出雪花
const flake = (x, y, r, w = 1.6, c = INK) => aP(R(6, i => { const a = i * Math.PI / 3 - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), mx = x + ca * r * 0.55, my = y + sa * r * 0.55, b = r * 0.34;
  return `M${x} ${y} L${n1(x + ca * r)} ${n1(y + sa * r)} M${n1(mx)} ${n1(my)} l${n1(Math.cos(a + 0.8) * b)} ${n1(Math.sin(a + 0.8) * b)} M${n1(mx)} ${n1(my)} l${n1(Math.cos(a - 0.8) * b)} ${n1(Math.sin(a - 0.8) * b)} `; }), w, c);
// 朱砂符文（一笔雷纹 / 云纹，只取其意）
const glyph = (x, y, s = 1, c = '#b5301f', w = 2) => aP(`M${x} ${n1(y - 22 * s)} L${x} ${n1(y - 14 * s)} M${n1(x - 7 * s)} ${n1(y - 17 * s)} L${n1(x + 7 * s)} ${n1(y - 17 * s)} M${n1(x - 6 * s)} ${n1(y - 9 * s)} L${n1(x + 6 * s)} ${n1(y - 9 * s)} L${n1(x - 6 * s)} ${n1(y - 1 * s)} L${n1(x + 7 * s)} ${n1(y - 1 * s)} L${n1(x - 5 * s)} ${n1(y + 9 * s)} L${n1(x + 5 * s)} ${n1(y + 9 * s)} L${x} ${n1(y + 20 * s)}`, w, c);
const spiral = (cx, cy, r0, turns, a0 = 0, w = 1.4, c = INK) => { const N = Math.round(turns * 20); let d = ''; for (let i = 0; i <= N; i++) { const t = i / N, a = a0 + t * turns * Math.PI * 2, r = r0 * (1 - t * 0.88); d += `${i ? 'L' : 'M'}${n1(cx + Math.cos(a) * r)} ${n1(cy + Math.sin(a) * r)} `; } return aP(d.trim(), w, c); };
// 线香：香在 (x, y1)→(x, y2)，c 香色
const stick = (x1, y1, x2, y2, c, w = 2.6) => aP(`M${x1} ${y1} L${x2} ${y2}`, w + 2.2) + aP(`M${x1} ${y1} L${x2} ${y2}`, w, c);

const F = {
  // —— 第一批 26 种 ——
  meat: () => ({ w: aC(50, 56, 30, '#a8402a'),   // 血肉团：一团暗红生肉，草绳十字扎着
    b: aF('M24 60 Q20 40 38 33 Q50 27 64 34 Q80 41 78 60 Q76 76 56 80 Q34 82 26 70 Z', '#4a1714', ln(2.6))
      + aP('M31 50 q8 -4 14 2 M53 66 q8 -2 13 4 M35 69 q6 2 10 -2 M58 43 q6 0 10 4', 1.8, '#d09080', 'none', op('.8'))
      + aP('M29 45 Q50 58 75 50', 3.4, '#b8944e') + aP('M40 79 Q46 56 52 31', 3.4, '#b8944e') + aC(49, 52, 3.6, '#b8944e', ln(1)) + aP('M51 50 l8 -11 M49 50 l2 -13', 2.2, '#b8944e') }),
  dew: () => ({ w: aC(50, 54, 30, '#c88a8a'),    // 晨露丸：三颗透明露珠丸子，裹着血丝
    b: [[36, 64], [64, 64], [50, 40]].map(([x, y]) => aC(x, y, 13, '#eef3f2', ln(2.6)) + aP(`M${x - 6} ${y + 2} Q${x - 2} ${y - 6} ${x + 2} ${y} Q${x + 5} ${y + 5} ${x + 6} ${y - 3}`, 1.6, '#b5301f') + aP(`M${x - 8} ${y - 4} Q${x - 6} ${y - 9} ${x - 1} ${y - 10}`, 1.8, '#ffffff')).join('') }),
  egg: () => ({ w: aE(50, 56, 28, 30, '#a89a7a'),  // 孵蛊卵：灰白软壳卵，透出蜷着的小虫影
    b: aE(50, 54, 22, 29, '#ebe5d8', 0, ln(2.8)) + aP('M44 68 Q34 58 42 46 Q50 38 58 46 Q64 56 55 61', 5, INK, 'none', op('.32')) + aC(54, 61, 3.4, INK, op('.32'))
      + aP('M34 40 Q38 32 46 30', 2, '#ffffff') + aP('M30 62 q4 3 3 8 M68 50 q-3 4 -1 8', 1.2, INK, 'none', op('.45')) }),
  scale: () => ({ w: aC(50, 52, 32, '#b08a42'),   // 鳞甲片：巴掌大的青铜色鳞片，边缘磨亮
    b: aF('M50 16 Q79 20 81 48 Q79 72 50 87 Q21 72 19 48 Q21 20 50 16 Z', '#7a6232', ln(2.8))
      + aP('M50 24 L50 80 M50 24 Q36 50 31 72 M50 24 Q64 50 69 72', 1.6, '#3a2e18') + aP('M25 44 Q27 25 50 21 Q73 25 75 44', 2.4, '#ecd8a0') }),
  tea: () => ({ w: aE(50, 60, 34, 24, '#b8784a'),  // 回春茶：粗陶小碗，红褐茶汤冒热气
    b: aF('M18 52 Q20 79 50 81 Q80 79 82 52 Z', '#5a4636', ln(2.6)) + aF('M38 80 L62 80 L60 86 L40 86 Z', '#5a4636', ln(2))
      + aE(50, 52, 32, 7.5, '#7a3a22', 0, ln(2.4)) + aE(42, 51, 10, 2, '#d08a5a', 0, op('.8')) + R(5, i => aC(28 + i * 11, 66 + (i % 2) * 6, 1.1, PAPER, op('.6')))
      + aP('M38 42 q-5 -6 0 -12 q5 -6 0 -12 M52 42 q-5 -6 0 -12 q5 -6 0 -12 M65 42 q-4 -5 0 -10', 2, INK, 'none', op('.55')) }),
  map: () => ({ w: aE(50, 52, 34, 30, '#c8a870'),  // 寻路图：一卷泛黄羊皮图，弯弯的山路
    b: aF('M24 28 L76 28 L76 76 L24 76 Z', '#e6d4a6', ln(2.2)) + aF('M17 25 Q17 22 21 22 L27 22 L27 82 L21 82 Q17 82 17 79 Z', '#8a6a3a', ln(2.2)) + aF('M73 25 L79 25 Q83 25 83 28 L83 76 Q83 79 79 79 L73 79 Z', '#8a6a3a', ln(2.2))
      + aP('M47 67 L55 55 L61 63 L65 57 L71 67', 2) + aP('M31 70 Q41 61 37 52 Q33 44 47 42 Q60 40 57 32', 2, '#b5301f', 'none', ' stroke-dasharray="3.4 2.8"') + aC(57, 32, 2.6, '#b5301f') }),
  yuelan: () => ({ w: aC(50, 50, 34, '#9cc0dc'),  // 月兰花瓣：几片半透明淡蓝花瓣，夜里发冷光
    b: [[-150, 34, 9], [-118, 40, 10], [-86, 42, 10], [-54, 38, 10], [-24, 32, 9]].map(([a, l, wd]) => leaf(50, 80, l, a, wd, '#cfe0ee', ln(2.4) + ' fill-opacity=".9"')).join('')
      + [[-150, 34], [-118, 40], [-86, 42], [-54, 38], [-24, 32]].map(([a, l]) => aP(`M50 80 L${n1(50 + Math.cos(a * Math.PI / 180) * l * 0.8)} ${n1(80 + Math.sin(a * Math.PI / 180) * l * 0.8)}`, 1.2, '#6a8aa8')).join('')
      + aC(50, 80, 3.4) + aF('M78 12 A9 9 0 1 0 85 26 A7 7 0 1 1 78 12 Z', '#f2ecd8', ln(1.8)) + twinkle(20, 24, 2, '#6a8aa8') }),
  zhujiu: () => ({ w: aE(50, 56, 26, 32, '#6a9a52'),  // 青竹酒：青竹筒，软木塞，竹节挂酒珠
    b: aF('M37 27 L63 27 L63 84 L37 84 Z', '#4f7a3a', ln(2.8)) + aP('M37 46 L63 46 M37 66 L63 66', 3) + aP('M43 31 L43 44 M43 49 L43 64 M43 69 L43 81', 2, '#a8c890')
      + aF('M41 18 L59 18 L58 28 L42 28 Z', '#b08a5a', ln(2.2)) + leaf(63, 46, 14, -35, 3.4, '#4f7a3a', ln(1.4))
      + drop(68, 56, 1.1, '#d0a040', ln(1.2)) + drop(31, 70, 0.9, '#d0a040', ln(1.2)) }),
  huotan: () => ({ w: aC(50, 56, 32, '#d0632a'),  // 火炭心：外黑里红的炭芯，裂缝在烧
    b: aF('M22 66 L28 42 L44 30 L62 32 L76 46 L78 66 L60 79 L36 79 Z') + aE(50, 57, 9, 6, '#d04020', 0, op('.7'))
      + aP('M30 58 L42 52 L48 60 L58 54 L67 60 M48 39 L52 48 L46 52 M60 66 L66 73 M36 66 L32 72', 2.8, '#e8642a') }),
  shuangye: () => ({ w: aC(50, 50, 32, '#9cc0d8'),  // 霜叶：结了白霜的枫叶，叶脉银线
    b: aF('M50 13 L56 30 L66 23 L64 38 L83 31 L74 46 L87 52 L70 58 L75 70 L58 64 L52 72 L52 87 L48 87 L48 72 L42 64 L25 70 L30 58 L13 52 L26 46 L17 31 L36 38 L34 23 L44 30 Z', '#7a3a30', ln(2))
      + aP('M50 80 L50 22 M50 56 L77 39 M50 56 L23 39 M50 62 L70 64 M50 62 L30 64', 1.8, '#f2f7fa') + aP('M30 34 l2 3 M70 34 l-2 3 M20 52 l3 0 M80 52 l-3 0', 2.2, '#f2f7fa') }),
  lingzhi: () => ({ w: aE(50, 48, 34, 24, '#a8603a'),  // 灵芝片：切开的赤褐灵芝，一圈圈年轮
    b: aF('M17 55 Q17 25 50 23 Q83 25 83 55 Q71 63 58 58 L57 82 L43 82 L42 58 Q29 63 17 55 Z', '#6a3a22', ln(2.6))
      + aP('M24 52 Q24 32 50 30 M76 52 Q76 32 50 30 M31 51 Q32 38 50 37 Q68 38 69 51 M38 50 Q39 44 50 44 Q61 44 62 50', 1.6, '#d8a878') + aP('M30 34 Q38 28 48 27', 2, '#f0d0a8', 'none', op('.8')) }),
  leizao: () => ({ w: aC(50, 54, 30, '#5a7ab0'),  // 雷击枣：焦黑红枣，一道蓝白电纹
    b: aE(50, 57, 21, 27, '#3a1a14', -18, ln(2.6)) + aP('M44 34 L53 46 L46 50 L57 64 L50 68 L58 79', 4.4, '#7ab0e0', 'none', op('.6')) + aP('M44 34 L53 46 L46 50 L57 64 L50 68 L58 79', 2.2, '#eaf6ff')
      + aP('M57 31 Q59 22 65 17', 2.6) + leaf(64, 18, 12, -10, 3, '#4f7a3a', ln(1.2)) }),
  duzhen: () => ({ w: aE(50, 60, 30, 26, '#4f7a3a'),  // 毒针囊：墨绿小皮囊，口上三根细针
    b: aP('M44 47 L37 14 M50 47 L50 10 M56 47 L63 14', 2.4) + aC(37, 14, 1.2, PAPER) + aC(50, 10, 1.2, PAPER) + aC(63, 14, 1.2, PAPER)
      + aF('M30 52 Q20 72 33 83 Q50 89 67 83 Q80 72 70 52 Q60 46 50 46 Q40 46 30 52 Z', '#2f4a2a', ln(2.6)) + aP('M33 51 Q50 57 67 51', 2.6, '#b8944e') + aP('M62 53 q6 6 4 13 M64 53 q10 3 11 10', 1.8, '#b8944e')
      + aP('M38 64 Q44 70 40 76', 1.4, '#7a9a6a') }),
  huorong: () => ({ w: aC(50, 50, 30, '#e08a3a'),  // 火绒草：一簇橙红绒毛草，尖上冒火星
    b: aP('M38 84 L62 84', 3) + aP('M50 82 Q42 70 40 60 M50 82 Q58 70 60 60', 2.4) + R(9, i => { const a = (-150 + i * 15) * Math.PI / 180, tx = 50 + Math.cos(a) * 36, ty = 82 + Math.sin(a) * 50; return aP(`M50 82 Q${n1(50 + Math.cos(a) * 12)} ${n1(82 + Math.sin(a) * 30)} ${n1(tx)} ${n1(ty)}`, 3.2, '#d0632a') + aC(tx, ty, 2.4, '#f0a040', ln(1)); })
      + aC(30, 20, 1.4) + aC(70, 18, 1.2) + aC(52, 14, 1.3) }),
  bingpo: () => ({ w: aC(50, 52, 32, '#6a9cc0'),  // 冰魄珠：鸽蛋大的冰珠，封着一片雪花
    b: aC(50, 52, 26, '#d8eaf4', ln(2.8)) + flake(50, 53, 14, 2) + aP('M32 42 Q36 32 46 29', 2.6, '#ffffff') + aC(70, 40, 1.6, '#ffffff') }),
  yeming: () => ({ w: aE(50, 56, 30, 30, '#3a3346'),  // 夜明砂：骨瓶里一撮黑砂，闪细碎绿光
    b: aF('M42 22 L58 22 L58 31 Q73 37 73 57 Q73 81 50 83 Q27 81 27 57 Q27 37 42 31 Z', '#e8dcc0', ln(2.6)) + aF('M40 16 L60 16 L59 23 L41 23 Z', '#5a4a3a', ln(1.6))
      + aF('M29 58 Q50 53 71 58 Q70 79 50 81 Q30 79 29 58 Z') + [[40, 66], [56, 63], [48, 73], [62, 72], [36, 74]].map(([x, y], i) => twinkle(x, y, i % 2 ? 1.4 : 2, '#8ae08a')).join('')
      + twinkle(80, 30, 2, '#5aa05a') + aP('M34 42 Q38 36 44 34', 1.6, '#ffffff') }),
  // —— 挂件 ——
  taoya: () => ({ w: aE(50, 54, 26, 30, '#b5301f'),  // 饕餮牙：弯钩獠牙，牙根缠红绳
    b: aF('M32 22 Q28 52 46 71 Q57 81 72 84 Q59 70 55 56 Q49 40 52 22 Z', '#efe2bc', ln(2.8)) + aP('M36 34 Q36 54 48 66', 1.4, '#c8b080')
      + aP('M31 25 L53 25 M31 30 L52 30', 3, '#b5301f') + aP('M53 27 q9 2 11 11 M53 29 q6 6 4 14', 2, '#b5301f') }),
  shanjiao: () => ({ w: aE(50, 56, 32, 24, '#8a6a3a'),  // 撞山角：粗短犀角，尖头磨圆，沾着土
    b: aF('M22 74 Q30 40 64 24 Q75 21 77 30 Q71 52 52 75 Z', '#5a4630', ln(2.8)) + aE(37, 74, 15, 5, '#8a6a4a', -6, ln(2))
      + aP('M30 62 Q42 66 54 60 M36 50 Q48 54 60 46', 1.6, '#3a2e20') + aP('M60 30 Q66 26 72 27', 2, '#c8a878')
      + aC(28, 82, 2.4, '#7a5a3a') + aC(46, 84, 1.8, '#7a5a3a') + aC(56, 80, 1.4, '#7a5a3a') }),
  xuelian: () => ({ w: aC(50, 56, 28, '#8a1f2b'),  // 血莲子：暗红莲子，剥开一角露血色芯
    b: aE(50, 57, 19, 25, '#5a1a1a', 0, ln(2.6)) + aC(50, 31, 3, '#5a1a1a', ln(1.6))
      + aF('M55 37 Q67 39 68 53 Q59 53 54 44 Z', '#e0383a', ln(1.6)) + aP('M58 41 Q62 46 64 51', 1.2, '#ffd0c8') + aP('M38 50 Q36 60 40 70', 1.6, '#a85050') }),
  jifeng: () => ({ w: aE(52, 50, 30, 26, '#4a8a86'),  // 疾风翎：青灰长翎，羽丝往一边倒
    b: aF('M29 77 Q26 60 39 48 Q52 34 76 20 Q71 40 58 54 Q45 68 29 77 Z', '#6a7a86', ln(2.2)) + aP('M22 86 Q46 56 79 17', 2.6)
      + R(7, i => { const t = 0.2 + i * 0.1, x = 22 + (79 - 22) * t, y = 86 - (86 - 17) * t - 3; return aP(`M${n1(x)} ${n1(y)} l-9 -2`, 1.2, '#d8e0e4'); })
      + aP('M66 62 q9 -2 16 2 M60 72 q11 -2 21 2', 1.8, INK, 'none', op('.6')) }),
  // —— 渡劫用 ——
  xuming: () => ({ w: aE(50, 56, 32, 28, '#5e8a4a'),  // 续命汤：带盖黑陶罐，盖缝飘绿色药气
    b: aF('M26 47 Q20 77 50 83 Q80 77 74 47 Z') + aP('M22 54 q-6 2 -4 8 M78 54 q6 2 4 8', 2.6) + aE(50, 45, 26, 6.5, '#3a3530', 0, ln(2.2)) + aC(50, 38, 4.4) + aP('M27 48 Q50 53 73 48', 1.6, '#8ad07a')
      + aP('M34 38 q-4 -6 0 -12 q4 -6 0 -12 M66 38 q4 -6 0 -12 q-4 -6 0 -12', 2.4, '#4f8a3a') + aP('M50 33 q-3 -5 0 -10', 2, '#4f8a3a') }),
  dinghun: () => ({ w: aE(50, 50, 22, 32, '#6a4a8a'),  // 定魂香：紫色线香插在骨座上，烟成一个圈
    b: bone(32, 80, 68, 80, 5) + stick(50, 76, 50, 34, '#7a5a9a', 3) + aC(50, 33, 2, '#e8602a')
      + aP('M50 31 Q45 26 50 22 Q55 18 50 15', 1.6, INK, 'none', op('.65')) + aE(50, 11, 9, 4, 'none', 0, ln(1.8) + op('.7')) }),
  jingleifu: () => ({ w: aE(50, 50, 26, 38, '#3a6aa8'),  // 惊雷符：黄纸符，朱砂雷纹，边缘焦黑
    b: aF('M33 15 L67 15 L67 85 L33 85 Z', '#ecc64c', ln(2.2)) + aF('M58 15 L67 15 L67 26 Q62 22 60 18 Z M33 74 Q38 78 37 85 L33 85 Z', '#3a2a1a') + glyph(50, 50, 1.2, '#b5301f', 2.4) }),
  guangyinxiang: () => ({ w: aE(50, 50, 22, 34, '#8a7a3a'),  // 光阴香：沙漏形的香，上半截成灰落在下半截
    b: aF('M34 19 L66 19 Q66 36 52 50 L48 50 Q34 36 34 19 Z', '#c4bcaa', ln(2.4)) + aF('M48 50 L52 50 Q66 64 66 81 L34 81 Q34 64 48 50 Z', '#6a5232', ln(2.4))
      + aF('M38 81 Q42 72 50 71 Q58 72 62 81 Z', '#c4bcaa', ln(1.4)) + aC(50, 50, 2.8, '#e8602a') + R(5, i => aC(42 + i * 4, 30 + (i % 2) * 5, 1.1, '#8a8478')) + aP('M28 85 L72 85', 2.4) }),
  houtufu: () => ({ w: aE(50, 54, 34, 30, '#8a6a3a'),  // 厚土符：方陶片上一个土黄掌印
    b: aF('M20 30 L76 24 L82 76 L26 82 L22 66 Z', '#b88a58', ln(2.6)) + aF('M76 24 L82 34 L80 28 Z', '#e6dcc6')
      + aE(51, 60, 11, 12, '#7a5226') + [[-150, 13], [-118, 16], [-90, 17], [-62, 15], [-28, 11]].map(([a, l]) => leaf(51 + Math.cos(a * Math.PI / 180) * 8, 55 + Math.sin(a * Math.PI / 180) * 8, l, a, 2.4, '#7a5226')).join('') }),
  fengxingfu: () => ({ w: aE(50, 52, 34, 22, '#4a8a86'),  // 风行符：青纸符折成纸鸢，翅膀微翘
    b: aF('M14 60 L86 34 L52 63 Z', '#a8d8d4', ln(2.2)) + aF('M86 34 L48 72 L44 61 Z', '#7ab8b4', ln(2.2)) + aP('M30 58 L44 52 M38 60 L52 54 L46 58', 1.8, '#b5301f')
      + aP('M8 72 q8 -2 14 2 M14 82 q10 -2 18 2', 1.8, INK, 'none', op('.55')) }),
  // —— 第四版新增 ——
  gutang: () => ({ w: aE(50, 58, 34, 26, '#5a4a7a'),  // 骨头汤：豁边小铁锅，汤里浮几截白骨
    b: aF('M19 47 Q21 77 50 81 Q79 77 81 47 Z', '#2a2724') + aP('M19 50 q-6 0 -6 6 M81 50 q6 0 6 6', 2.6) + aE(50, 47, 31, 7.5, '#3a3530', 0, ln(2.4)) + aE(50, 47, 27, 5.5, '#d2c4a4')
      + aF('M64 40 L70 40 L67 45 Z', '#f5efe0') + bone(32, 48, 46, 44, 3) + bone(54, 49, 66, 46, 2.6) }),
  xuejing: () => ({ w: aC(50, 52, 32, '#8a1f2b'),  // 血精丸：龙眼大的深红药丸，爬着血管似的细纹
    b: aC(50, 52, 26, '#6a1a1a', ln(2.8)) + aP('M30 46 Q40 50 44 42 Q48 35 57 40 M38 64 Q46 56 54 61 Q61 65 68 56 M57 40 Q63 47 71 44 M44 42 Q42 34 46 30', 1.8, '#e06050')
      + aP('M34 38 Q40 30 50 28', 2.4, '#e8a0a0', 'none', op('.7')) }),
  zhanjiu: () => ({ w: aE(50, 58, 38, 22, '#b5301f'),  // 壮行酒：大口粗瓷碗，酒面浮一片红辣椒
    b: aF('M12 47 Q18 75 50 77 Q82 75 88 47 Z', '#e6decd', ln(2.8)) + aP('M15 54 Q50 64 85 54', 2.4, '#3d5a8a') + aF('M40 76 L60 76 L58 82 L42 82 Z', '#e6decd', ln(2))
      + aE(50, 47, 38, 7.5, '#c8a050', 0, ln(2.4)) + aP('M36 46 Q50 52 64 44', 5.4, '#b5301f') + aP('M64 44 l5 -4', 2.4, '#4f7a3a') }),
  huxin: () => ({ w: aC(50, 52, 32, '#b08a42'),  // 护心镜：圆铜镜，背面一圈兽纹
    b: aC(50, 52, 28, '#8a6a32', ln(2.8)) + aC(50, 52, 20, 'none', ln(1.6, '#3a2e18'))
      + R(8, i => { const a = i * Math.PI / 4, x = 50 + Math.cos(a) * 24, y = 52 + Math.sin(a) * 24; return aP(`M${n1(x - Math.sin(a) * 2.6)} ${n1(y + Math.cos(a) * 2.6)} q${n1(Math.cos(a) * 2)} ${n1(Math.sin(a) * 2)} ${n1(Math.sin(a) * 5.2)} ${n1(-Math.cos(a) * 5.2)}`, 1.6, '#3a2e18'); })
      + aC(50, 52, 5.5, '#5a4420', ln(1.8)) + aP('M30 40 Q36 30 46 28', 2.2, '#ecd8a0') + aP('M50 58 Q46 72 40 86', 2.2, '#b5301f') }),
  qiangxian: () => ({ w: aE(48, 52, 28, 26, '#4a8a86'),  // 抢先香：极细白香，点着那头烧得飞快
    b: stick(24, 82, 68, 28, '#f4eee2', 2.4) + aE(24, 84, 9, 3.6) + aC(68.5, 27.5, 3, '#e8602a') + aF('M70 26 Q78 20 74 12 Q72 18 68 22 Z', '#e8902a')
      + aP('M76 32 L90 32 M74 40 L86 40 M80 24 L92 24', 2, INK, 'none', op('.55')) + aP('M64 30 Q58 20 62 12', 1.4, INK, 'none', op('.5')) }),
  siwei: () => {   // 四味酒：四格小酒盘，清、黄、红、褐
    const q = (a, b, c, d, f) => aF(`M${a} L${b} L${c} L${d} Z`, f, ln(1.6));
    return { w: aE(50, 54, 36, 26, '#3d5a8a'),
      b: aF('M22 28 L78 28 L87 78 L13 78 Z', '#5a4636', ln(2.6))
        + q('27 32', '48 32', '47 51', '23 51', '#e8eee6') + q('52 32', '73 32', '77 51', '53 51', '#e0c050') + q('22 55', '47 55', '46 74', '18 74', '#b5301f') + q('53 55', '78 55', '82 74', '54 74', '#7a4a22')
        + aP('M30 36 l8 0 M56 36 l8 0', 1.6, '#ffffff', 'none', op('.7')) };
  },
  zhuanggu: () => ({ w: aE(50, 56, 30, 28, '#8a6a3a'),  // 壮骨汤：陶盅，奶白汤，盅沿搭一根大骨
    b: aF('M26 42 L74 42 Q72 78 50 82 Q28 78 26 42 Z', '#8a5a3a', ln(2.6)) + aE(50, 42, 24, 5.6, '#f2ecdc', 0, ln(2.4)) + aP('M30 58 Q50 64 70 58', 1.4, '#5a3a22') + bone(42, 42, 76, 16, 4.6) }),
  duwu: () => ({ w: aE(50, 58, 28, 30, '#4f7a3a'),  // 毒雾瓶：细颈小瓷瓶，塞布团，渗一丝绿烟
    b: aF('M41 30 L59 30 L58 43 Q74 52 72 68 Q70 85 50 85 Q30 85 28 68 Q26 52 42 43 Z', '#e8eee6', ln(2.6)) + aP('M30 62 Q50 68 70 62', 2, '#4a6a8a')
      + aF('M38 31 Q36 22 44 21 Q50 16 56 21 Q64 22 62 31 Z', '#9a8a62', ln(1.8)) + aP('M54 18 q7 -4 3 -10 q-4 -5 4 -8', 2.6, '#4f8a3a') + aP('M36 50 Q34 58 36 64', 2, '#ffffff', 'none', op('.8')) }),
  guijia: () => ({ w: aE(50, 54, 32, 32, '#8a6a3a'),  // 龟甲符：一片刻符文的龟甲，裂纹填金粉
    b: aF('M30 21 L70 21 Q83 34 81 54 Q79 77 50 85 Q21 77 19 54 Q17 34 30 21 Z', '#c8a870', ln(2.6)) + aP('M50 21 L50 85 M21 46 L79 46 M24 66 L76 66', 1.8, '#5a4426')
      + aP('M36 30 l4 6 l-3 3 M60 30 l-2 5 l4 2 M34 54 l6 2 M62 54 l4 4 M40 74 l4 -3 M58 74 l3 2', 1.4, '#3a2a16') + aP('M28 36 L38 42 L36 52 M64 58 L72 62 L70 72', 2, '#e0b040') }),
  kaifeng: () => ({ w: aE(50, 58, 36, 22, '#a8803e'),  // 开锋石：青黑磨刀石，中间一道凹槽
    b: aF('M14 50 L62 38 L86 48 L38 62 Z', '#4a5250', ln(2.4)) + aF('M14 50 L38 62 L38 77 L14 65 Z', INK, ln(2)) + aF('M38 62 L86 48 L86 63 L38 77 Z', '#2a2e2e', ln(2))
      + aP('M24 51 Q50 45 77 47', 4, '#6a7472') + aP('M26 50 Q50 44 75 46', 1.4, '#c8d0cc') + aP('M84 30 l4 -6 M88 36 l6 -2 M80 28 l0 -6', 1.6) }),
  duanhun: () => ({ w: aE(50, 52, 30, 26, '#3a3346'),  // 断魂针：乌黑长针，针尾系一缕白发
    b: aP('M22 80 L82 16', 3.2) + aE(23.5, 78.5, 2.8, 1.4, PAPER, -47) + aP('M76 24 L80 19', 1.2, '#ffffff')
      + aP('M22 80 Q30 90 42 84 Q54 78 64 88 M22 80 Q26 92 36 92', 3, INK) + aP('M22 80 Q30 90 42 84 Q54 78 64 88 M22 80 Q26 92 36 92', 1.6, '#f4f0e6') }),
  lingxi: () => ({ w: aE(50, 58, 32, 22, '#3d5a8a'),  // 灵犀角：半透明小犀角，一条白线贯通两头
    b: aF('M18 64 Q40 70 62 58 Q76 48 84 28 Q87 44 79 58 Q64 79 36 79 Q24 77 18 64 Z', '#b8c4cc', ln(2.6) + ' fill-opacity=".85"') + aE(22, 71, 5, 8, '#8a9aa8', 20, ln(1.8))
      + aP('M22 71 Q44 74 64 64 Q76 56 83 32', 2.2, '#ffffff') }),
  huanhun: () => ({ w: aE(50, 54, 28, 32, '#5a4a7a'),  // 还魂草：枯黄小草，只有顶上一片叶是翠绿的
    b: aF('M26 86 Q50 76 74 86 Z', '#5a4630') + aP('M50 84 Q46 60 52 26', 3.4, '#a8904a') + aP('M48 84 Q38 72 30 74', 2.4, '#a8904a')
      + leaf(48, 72, 22, 160, 4.6, '#c0a864', ln(1.8)) + leaf(49, 60, 22, 25, 4.6, '#c0a864', ln(1.8)) + leaf(49, 46, 18, 165, 4, '#c0a864', ln(1.8)) + leaf(30, 74, 12, 120, 3, '#c0a864', ln(1.4))
      + leaf(52, 27, 26, -62, 6.4, '#3a9a3a', ln(2)) + aP('M54 24 L62 8', 1.2, '#a8e0a0') + twinkle(74, 18, 2.4, '#6aba6a') }),
  duji: () => ({ w: aE(50, 54, 30, 32, '#5e8a4a'),  // 毒棘甲：带刺藤条编的小背甲，刺尖发紫
    b: aF('M30 22 L42 22 Q50 31 58 22 L70 22 L77 40 L72 81 L28 81 L23 40 Z', '#3e4a26', ln(2.4))
      + aP('M28 44 L56 78 M36 34 L70 70 M26 62 L42 80 M44 30 L74 54 M72 44 L44 78 M64 32 L30 70 M74 62 L58 80 M54 28 L26 52', 1.4, '#9aaa6a')
      + [[23, 40, -1], [25, 56, -1], [26, 72, -1], [77, 40, 1], [75, 56, 1], [73, 72, 1], [30, 22, 0], [70, 22, 0]].map(([x, y, s]) => aF(s ? `M${x} ${y - 3} L${x + s * 8} ${y} L${x} ${y + 3} Z` : `M${x - 3} ${y} L${x} ${y - 8} L${x + 3} ${y} Z`, '#8a3aa0', ln(1))).join('') }),
  zhenshi: () => ({ w: aE(50, 64, 32, 22, '#8a6a3a'),  // 镇石：压秤的黑石，底平，顶上凿提环
    b: aP('M41 45 Q41 26 50 26 Q59 26 59 45', 4.2) + aF('M23 81 Q21 50 50 43 Q79 50 77 81 Z') + R(6, i => aC(32 + i * 7, 62 + (i % 2) * 8, 1.2, PAPER, op('.55')))
      + aP('M30 58 Q34 50 42 48', 2, '#6a6a68') + aP('M16 84 L84 84', 2.2) }),
  juqi: () => ({ w: aC(50, 52, 32, '#3d5a8a'),  // 聚气珠：灰白石珠，一圈圈往里旋的纹
    b: aC(50, 52, 26, '#d6d2c8', ln(2.8)) + spiral(50, 52, 20, 2.6, 0.4, 1.8) + aP('M32 40 Q36 32 44 29', 2.4, '#ffffff') }),
  chuanxin: () => ({ w: aE(52, 50, 30, 26, '#b5301f'),  // 穿心簇：三棱铁箭头，棱上开放血槽
    b: aP('M44 58 L18 86', 5) + aF('M84 14 Q72 40 62 60 L52 63 L40 58 L43 49 Q62 34 84 14 Z', '#2e3236', ln(2.4)) + aP('M83 15 L48 58', 1.8, '#d8dcd8') + aP('M74 27 L56 49', 1.8, '#c0302a') + aP('M40 58 L52 63 L46 66 Z', 1.6) }),
  helian: () => ({ w: aC(50, 52, 30, '#a8803e'),  // 合炼丹：金灰两色交缠的丹丸，沉甸甸
    b: aE(50, 82, 20, 3.4, INK, 0, op('.35')) + aC(50, 50, 25, '#9a9890', ln(2.8)) + aF('M50 25 A12.5 12.5 0 0 1 50 50 A12.5 12.5 0 0 0 50 75 A25 25 0 0 1 50 25 Z', '#d0a84a')
      + aC(50, 37.5, 3.6, '#9a9890') + aC(50, 62.5, 3.6, '#d0a84a') + aP('M34 38 Q38 30 46 28', 2.2, '#ffffff', 'none', op('.8')) }),
  huanwei: () => ({ w: aE(50, 54, 34, 30, '#4a8a86'),  // 换位符：对折的符纸，两半同一道符、颜色相反
    b: aF('M17 26 L50 34 L50 83 L17 75 Z', '#ecc64c', ln(2.2)) + aF('M50 34 L83 26 L83 75 L50 83 Z', '#b5301f', ln(2.2)) + glyph(33.5, 56, 0.85, '#b5301f', 2.2) + glyph(66.5, 56, 0.85, '#ecc64c', 2.2) }),
  yinhun: () => ({ w: aE(50, 58, 26, 30, '#5a4a7a'),  // 引魂香：灰白线香，烟往下沉，绕着香座打转
    b: aF('M34 76 Q34 86 50 86 Q66 86 66 76 Z', '#6a5a4a', ln(2)) + stick(50, 76, 50, 26, '#cfc8bc', 3) + aC(50, 25, 2, '#e8602a')
      + aP('M51 24 Q62 30 60 44 Q58 58 70 70 Q66 82 46 82 Q30 80 30 72 Q32 64 44 68', 1.8, INK, 'none', op('.6')) }),
  jinggu: () => ({ w: aE(46, 56, 32, 24, '#5e8a4a'),  // 净蛊水：小竹勺盛清水，沉几粒白沙
    b: aP('M54 55 L86 25', 7.6) + aP('M54 55 L86 25', 5, '#c8a870') + aP('M72 38 l3 3', 2) + aE(36, 61, 21, 14, '#c8a870', -10, ln(2.6)) + aE(36, 60, 17, 10.5, '#d8ecf2', -10)
      + [[30, 62], [36, 64], [42, 61], [33, 58]].map(([x, y]) => aC(x, y, 1.6, '#ffffff', ln(0.8))).join('') + aP('M26 56 Q30 52 38 52', 1.6, '#ffffff') }),
  baibao: () => ({ w: aE(50, 58, 32, 28, '#c9a24a'),  // 百宝囊：鼓鼓的花布袋，袋口露出几样小物件
    b: aF('M44 42 L40 22 L46 21 L50 40 Z', '#e6d4a6', ln(1.6)) + aC(58, 34, 6, '#d0a840', ln(1.6)) + aF('M56 32 h4 v4 h-4 Z', '#5a4426') + leaf(48, 40, 18, -130, 3, '#4f7a3a', ln(1.2))
      + aF('M28 45 Q15 67 26 81 Q50 91 74 81 Q85 67 72 45 Z', '#b5402f', ln(2.6)) + aP('M30 46 Q50 52 70 46', 2.8, '#b8944e')
      + [[38, 62], [58, 60], [48, 74], [66, 74], [30, 74]].map(([x, y]) => R(5, i => aC(x + Math.cos(i * 1.256) * 2.6, y + Math.sin(i * 1.256) * 2.6, 1.3, '#f2e2b0'))).join('') }),
  yingu: () => ({ w: aE(50, 54, 32, 28, '#3a3346'),  // 引蛊香：铜香炉，炉盖上蹲一只小虫钮
    b: aP('M32 72 L28 84 M50 75 L50 86 M68 72 L72 84', 3.2) + aF('M23 52 Q23 74 50 76 Q77 74 77 52 Z', '#7a6232', ln(2.6)) + aP('M23 56 q-6 -2 -6 -8 M77 56 q6 -2 6 -8', 2.6)
      + aF('M28 52 Q30 34 50 32 Q70 34 72 52 Z', '#9a7a40', ln(2.4)) + [[40, 44], [50, 42], [60, 44]].map(([x, y]) => aC(x, y, 1.8, '#2a2216')).join('')
      + aE(48, 28, 6, 3.4) + aC(56, 26.5, 3) + aP('M44 30 l-3 3 M48 31 l0 3 M52 30 l3 3', 1.4) + aP('M58 24 q3 -4 7 -4', 1.1)
      + aP('M36 32 q-3 -5 0 -10 M64 32 q3 -5 0 -10', 1.6, INK, 'none', op('.5')) }),
  shengzhuan: () => ({ w: aC(68, 64, 16, '#d9a441') + aE(40, 40, 26, 16, '#6a9a52', -30),  // 升转露：一滴悬在叶尖的金色露水
    b: aF('M14 66 Q22 28 66 30 Q58 46 66 52 Q40 66 14 66 Z', '#3a5a2a', ln(2.2)) + aP('M18 64 Q40 48 64 50', 1.6, '#a8c890') + aP('M14 66 Q8 76 10 86', 2.4)
      + drop(68, 66, 2.4, '#e0b030', ln(2)) + aP('M64 60 Q65 56 68 55', 1.8, '#fff4c8') + twinkle(84, 50, 2, '#c08a2e') }),
  zhuanshi: () => ({ w: aE(50, 54, 28, 34, '#3d5a8a'),  // 转市令：木牌正面刻一个「转」字
    b: aP('M44 18 Q50 8 56 18', 2.2, '#b5301f') + aF('M28 22 Q28 18 32 18 L68 18 Q72 18 72 22 L72 82 Q72 86 68 86 L32 86 Q28 86 28 82 Z', '#b07e4c', ln(2.8)) + aC(50, 25, 2.4, '#3a2a1a')
      + aP('M32 34 L68 34 M32 78 L68 78', 1.2, '#6a4a2a') + `<text x="50" y="68" font-size="32" text-anchor="middle" font-family="Kaiti SC,STKaiti,KaiTi,Songti SC,serif" font-weight="700" fill="#2a1a10">转</text>`
      + aF('M60 70 h8 v8 h-8 Z', '#b5301f') }),
};
// 没画的：扎绳油纸包
F._ = () => ({ w: aE(50, 56, 30, 26, '#a8804e'), b: aF('M22 40 L78 40 L74 80 L26 80 Z', '#c8a870', ln(2.6)) + aP('M50 40 L50 80 M24 60 L76 60', 2.4, '#7a5a3a') + aP('M50 40 q-8 -10 -14 -6 q4 6 14 6 q8 -10 14 -6 q-4 6 -14 6', 2, '#7a5a3a') });

const FOOD_ART = Object.fromEntries(Object.entries(F).map(([k, f]) => [k, f()]));
function foodSVG(id, o = {}) {
  const { w, b } = FOOD_ART[id] || FOOD_ART._;
  const size = o.size ? ` width="${o.size}" height="${o.size}"` : '';
  const defs = o.standalone ? `<defs>${ART_DEFS}</defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${size} class="fsvg" aria-hidden="true">${defs}<g filter="url(#wash)" opacity=".5">${w}</g><g filter="url(#ink)">${b}</g></svg>`;
}

return { FOOD_ART, foodSVG };
})();
// ---- src/qr.js
// 蛊码 GuCode · 精简 QR 编码器（零依赖）：byte 模式、纠错等级 M、版本 1–15 自动选择。
// 算法按 ISO/IEC 18004（参考 Nayuki 的公开实现思路）重写，只保留本项目用得到的部分。
const QR_ECC_M = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24];   // 每块纠错码字数
const QR_BLK_M = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10];                // 块数
function qrRawModules(v) { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; }
function qrDataCodewords(v) { return Math.floor(qrRawModules(v) / 8) - QR_ECC_M[v] * QR_BLK_M[v]; }
function gfMul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 255; }
function rsDivisor(deg) { const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1; for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { r[j] = gfMul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = gfMul(root, 2); } return r; }
function rsRemainder(data, div) { const r = div.map(() => 0); for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gfMul(c, f); }); } return r; }
function qrAlignPos(v, size) { if (v === 1) return []; const n = Math.floor(v / 7) + 2, step = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, r = [6]; for (let p = size - 7; r.length < n; p -= step) r.splice(1, 0, p); return r; }

// 返回 { size, get(x,y) } ；文本过长返回 null
function qrEncode(text) {
  const bytes = Array.from(typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(text) : Buffer.from(text, 'utf8'));
  let v = 1; for (; v <= 15; v++) if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= qrDataCodewords(v) * 8) break;
  if (v > 15) return null;
  const cap = qrDataCodewords(v) * 8, bits = [];
  const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
  put(0, Math.min(4, cap - bits.length)); put(0, (8 - bits.length % 8) % 8);
  for (let p = 0xEC; bits.length < cap; p ^= 0xEC ^ 0x11) put(p, 8);
  const data = []; for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
  // 分块加纠错并交织
  const nb = QR_BLK_M[v], ecl = QR_ECC_M[v], raw = Math.floor(qrRawModules(v) / 8), nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDivisor(ecl), blocks = [];
  for (let i = 0, k = 0; i < nb; i++) { const d = data.slice(k, k + shortLen - ecl + (i < nShort ? 0 : 1)); k += d.length; const e = rsRemainder(d, div); if (i < nShort) d.push(0); blocks.push(d.concat(e)); }
  const cw = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - ecl || j >= nShort) cw.push(b[i]); });
  // 功能图形
  const size = v * 4 + 17, M = [], F = [];
  for (let y = 0; y < size; y++) { M.push(new Array(size).fill(false)); F.push(new Array(size).fill(false)); }
  const fn = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
  for (let i = 0; i < size; i++) { fn(6, i, i % 2 === 0); fn(i, 6, i % 2 === 0); }
  [[3, 3], [size - 4, 3], [3, size - 4]].forEach(([cx, cy]) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy)); if (x >= 0 && x < size && y >= 0 && y < size) fn(x, y, d !== 2 && d !== 4); } });
  const ap = qrAlignPos(v, size);
  ap.forEach((ax, i) => ap.forEach((ay, j) => { if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fn(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
  const drawFormat = mask => {
    const d = (0 << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412, bit = i => ((b >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) fn(8, i, bit(i));
    fn(8, 7, bit(6)); fn(8, 8, bit(7)); fn(7, 8, bit(8));
    for (let i = 9; i < 15; i++) fn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) fn(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) fn(8, size - 15 + i, bit(i));
    fn(8, size - 8, true);
  };
  drawFormat(0);
  if (v >= 7) { let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25); const b = (v << 12) | r; for (let i = 0; i < 18; i++) { const bt = ((b >>> i) & 1) === 1, a = size - 11 + i % 3, c = Math.floor(i / 3); fn(a, c, bt); fn(c, a, bt); } }
  // 之字形放置码字
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!F[y][x] && k < cw.length * 8) { M[y][x] = ((cw[k >>> 3] >>> (7 - (k & 7))) & 1) === 1; k++; }
    }
  }
  const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0, (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
  const applyMask = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && MASKS[m](x, y)) M[y][x] = !M[y][x]; };
  const penalty = () => {   // 简化罚分：连续同色、2×2 色块、明暗比例（足以避开最差的掩码）
    let p = 0, dark = 0;
    for (let a = 0; a < size; a++) for (const horiz of [true, false]) {
      let run = 1;
      for (let b = 1; b <= size; b++) {
        const same = b < size && (horiz ? M[a][b] === M[a][b - 1] : M[b][a] === M[b - 1][a]);
        if (same) run++; else { if (run >= 5) p += run - 2; run = 1; }
      }
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { if (M[y][x]) dark++; if (x < size - 1 && y < size - 1 && M[y][x] === M[y][x + 1] && M[y][x] === M[y + 1][x] && M[y][x] === M[y + 1][x + 1]) p += 3; }
    return p + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
  };
  let best = 0, bestP = Infinity;
  for (let m = 0; m < 8; m++) { applyMask(m); drawFormat(m); const p = penalty(); if (p < bestP) { bestP = p; best = m; } applyMask(m); }
  applyMask(best); drawFormat(best);
  return { size, version: v, get: (x, y) => M[y][x] };
}
// 画到 canvas 上：x,y 左上角，px 总边长（含 4 格静区）
function qrDraw(ctx, text, x, y, px, dark = '#1c1915', light = '#ece3cf') {
  const q = qrEncode(text); if (!q) return false;
  const n = q.size + 8, s = px / n;
  ctx.fillStyle = light; ctx.fillRect(x, y, px, px); ctx.fillStyle = dark;
  for (let j = 0; j < q.size; j++) for (let i = 0; i < q.size; i++) if (q.get(i, j)) ctx.fillRect(Math.floor(x + (i + 4) * s), Math.floor(y + (j + 4) * s), Math.ceil(s), Math.ceil(s));
  return true;
}

// ---- src/tokens.js
// 蛊码 GuCode · Token 来源：演示流 / VS Code 插件推送
const VSC = (typeof acquireVsCodeApi === 'function') ? acquireVsCodeApi() : null;

class TokenSource {
  constructor(cb) {
    this.cb = cb; this.live = !!VSC; this.mode = VSC ? 'vscode' : 'demo'; this.demo = 'coding';
    this.rate = 0; this.idleMs = 0; this.last = performance.now();
    this.acc = 0; this.hotAcc = 0; this.vrate = 0; this.vidle = true; this.vsrc = null;
    if (VSC) window.addEventListener('message', e => {
      const m = e.data || {};
      if (m.type === 'tokens') { this.acc += m.delta || 0; if (m.hot) this.hotAcc += m.delta || 0; this.vrate = m.rate || 0; this.vidle = !!m.idle; this.vsrc = m.bySource || null; }
    });
    setInterval(() => this.tick(), 200);
  }
  get unit() { return this.mode === 'vscode' ? 8000 : 200; }       // 罗盘节点每"千"折合多少 token（网页模拟流速约 1000/s，折算同比缩小，节奏和以前一样）
  get hotTh() { return 2000; }                                       // 武火阈值（token/秒）
  setMode(m) { if (VSC && m !== 'vscode') return; this.mode = m; this.idleMs = 0; this.acc = 0; this.hotAcc = 0; }   // 插件里只认真实 token，不能切到模拟灵流
  tick() {
    const now = performance.now(), dt = Math.min(1, (now - this.last) / 1000); this.last = now;
    if (this.mode === 'demo') {
      // 网页模拟灵流：接近真实写代码时的中位流速，约 500–1500/s 起伏；只有「写代码中 / 停手休息」两档
      const base = this.demo === 'rest' ? 0 : 1000, t = now / 1000;
      const r = base ? base * Math.min(1.5, Math.max(0.5, 1 + 0.32 * Math.sin(t * 0.9) + 0.18 * Math.sin(t * 2.7 + 1))) : 0;
      const d = r * dt;
      this.rate = this.rate * 0.75 + r * 0.25; if (!base && this.rate < 20) this.rate = 0;
      this.idleMs = this.rate > 0 ? 0 : this.idleMs + dt * 1000;
      this.cb({ delta: d, rate: this.rate, hot: this.rate >= this.hotTh, idle: this.idleMs >= 1200 });
    } else {
      const d = this.acc, hd = this.hotAcc; this.acc = 0; this.hotAcc = 0; this.rate = this.vrate;
      this.cb({ delta: d, hotDelta: hd, rate: this.vrate, hot: this.vrate >= this.hotTh, idle: this.vidle, bySource: this.vsrc });
    }
  }
}

// ---- src/card.js
// 蛊码 GuCode · 分享卡（canvas → PNG）




const KAI = '"Kaiti SC","STKaiti","KaiTi","BiauKai",serif';
const SANS = '-apple-system,"PingFang SC","Microsoft YaHei",system-ui,sans-serif';
function loadImg(src) { return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
function seal(ctx, x, y, text, size, rot = -0.05) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const chars = [...text], fs = size, w = fs * 1.25, h = fs * chars.length + fs * 0.4;
  ctx.fillStyle = '#b5301f'; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = 'rgba(239,231,212,.85)'; ctx.lineWidth = 2; ctx.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
  ctx.fillStyle = '#f3ead6'; ctx.font = `${fs}px ${KAI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  chars.forEach((c, i) => ctx.fillText(c, 0, -h / 2 + fs * 0.7 + i * fs));
  ctx.restore();
}
async function makeCard({ team, name, realm, total, muts, wins, code, url, endless, title, rar, trial }) {
  const W = 1080, H = 376 + team.length * 166 + 380, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#17140f'; ctx.fillRect(0, 0, W, H);
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2200; i++) { ctx.strokeStyle = `rgba(233,224,204,${0.015 + rnd() * 0.03})`; ctx.lineWidth = 0.6 + rnd(); const x = rnd() * W, y = rnd() * H, a = rnd() * 6.28, l = 6 + rnd() * 30; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + rnd() * 6, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(233,224,204,.22)'; ctx.lineWidth = 2; ctx.strokeRect(40, 40, W - 80, H - 80); ctx.lineWidth = 1; ctx.strokeRect(52, 52, W - 104, H - 104);
  ctx.fillStyle = '#ece3cf'; ctx.font = `128px ${KAI}`; ctx.textBaseline = 'alphabetic'; ctx.fillText('蛊码', 92, 200);
  ctx.fillStyle = 'rgba(236,227,207,.6)'; ctx.font = `34px ${KAI}`; ctx.fillText('烧 Token · 养蛊 · 斗道', 98, 256);
  seal(ctx, 930, 170, REALMS[realm] || '凡人', 64, 0.06);
  if (endless) { ctx.save(); ctx.fillStyle = '#d8553f'; ctx.font = `30px ${KAI}`; ctx.textAlign = 'center'; ctx.fillText(`无尽 ${endless} 层`, 930, 300); ctx.restore(); }
  if (trial) {   // 试玩存档：网页模拟元气养的蛊，卡面盖一枚醒目的「试玩」章
    ctx.save(); ctx.translate(690, 150); ctx.rotate(-0.12); ctx.strokeStyle = '#d8553f'; ctx.lineWidth = 5; ctx.strokeRect(-92, -50, 184, 100); ctx.lineWidth = 2; ctx.strokeRect(-82, -40, 164, 80);
    ctx.fillStyle = '#d8553f'; ctx.font = `64px ${KAI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('试玩', 0, 4); ctx.restore();
    ctx.save(); ctx.fillStyle = 'rgba(216,85,63,.85)'; ctx.font = `24px ${KAI}`; ctx.textAlign = 'center'; ctx.fillText('网页模拟元气', 690, 236); ctx.restore();
  }
  ctx.fillStyle = '#ece3cf'; ctx.font = `44px ${KAI}`; ctx.fillText(`${name || '无名蛊师'} 的空窍`, 92, 340);
  if (title) { const w = ctx.measureText(`${name || '无名蛊师'} 的空窍`).width; ctx.save(); ctx.font = `28px ${KAI}`; ctx.fillStyle = '#d9a441'; ctx.fillText(`「${title}」`, 104 + w, 338); ctx.restore(); }
  const imgs = await Promise.all(team.map(g => loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(guSVG(g.sp, { standalone: true, size: 300 })))));
  let y = 376; const skills = [];
  team.forEach((g, i) => {
    const sk = skillOf(g); if (sk) skills.push(sk.n);
    ctx.fillStyle = '#e6dcc6'; ctx.fillRect(84, y, W - 168, 150);
    ctx.fillStyle = 'rgba(28,25,21,.06)'; for (let k = 0; k < 40; k++) ctx.fillRect(84 + rnd() * (W - 180), y + rnd() * 146, 1 + rnd() * 30, 1);
    if (imgs[i]) ctx.drawImage(imgs[i], 96, y + 2, 146, 146);
    ctx.fillStyle = '#1c1915'; ctx.font = `48px ${KAI}`; ctx.fillText(rankName(g), 262, y + 62);
    const rq = rar && g.rar > 0 && rar[g.rar]; if (rq) { const nw = ctx.measureText(rankName(g)).width; ctx.save(); ctx.fillStyle = rq.col; ctx.fillRect(272 + nw, y + 24, 44, 44); ctx.fillStyle = '#f3ead6'; ctx.font = `32px ${KAI}`; ctx.fillText(rq.n, 278 + nw, y + 58); ctx.restore(); }
    ctx.font = `600 34px ${SANS}`; ctx.fillStyle = '#7a2a1c'; ctx.fillText(`攻 ${g.atk}`, 262, y + 112); ctx.fillStyle = '#2f4a40'; ctx.fillText(`血 ${g.hp}`, 392, y + 112);
    let tw = 0; if (sk) { ctx.font = `30px ${KAI}`; tw = ctx.measureText(sk.n).width + 28; }
    ctx.fillStyle = '#3a342c'; ctx.font = `30px ${KAI}`;
    ctx.fillText(g.tr.map(([id, v]) => TRAITS[id].n + (v > 1 ? v : '')).join(' · ') + (g.q.length ? '  癖' + g.q.length : ''), 520, y + 62, W - 140 - tw - 520);
    ctx.font = `26px ${SANS}`; ctx.fillStyle = '#6b6254'; ctx.fillText(`喂 ${fmtTok(g.fed)} · 变 ${g.mut || 0}${g.att.length ? ' · 附 ' + g.att.map(a => SP[a].ab).join('') : ''}`, 520, y + 112);
    if (sk) { ctx.save(); ctx.font = `30px ${KAI}`; ctx.fillStyle = sk.named ? '#b5301f' : '#5a5246'; ctx.fillRect(W - 112 - tw, y + 14, tw, 46); ctx.fillStyle = '#f3ead6'; ctx.fillText(sk.n, W - 98 - tw, y + 47); ctx.restore(); }
    y += 166;
  });
  y += 30;
  const LW = W - 92 - 330;
  ctx.fillStyle = 'rgba(236,227,207,.85)'; ctx.font = `32px ${KAI}`;
  ctx.fillText(`算力履历　累计喂养 ${fmtTok(total)} Token`, 92, y, LW);
  ctx.fillText(`突变 ${muts || 0} 次 · 胜 ${wins || 0} · ${REALMS[realm] || '凡人'}${endless ? ` · 无尽劫第 ${endless} 层` : ''}`, 92, y + 46, LW);
  if (skills.length) { ctx.fillStyle = '#d8553f'; ctx.fillText('杀招 ' + skills.map(n => '【' + n + '】').join(''), 92, y + 96, LW); }
  ctx.fillStyle = 'rgba(236,227,207,.55)'; ctx.font = `24px ${SANS}`; ctx.fillText(trial ? '界壁坐标码（试玩存档）· 扫码或粘贴即可应战' : '界壁坐标码 · 扫码或粘贴即可应战', 92, y + 150, LW);
  ctx.fillStyle = '#6fb7a4'; ctx.font = `24px ui-monospace,Menlo,monospace`;
  const per = 34; for (let i = 0; i * per < code.length && i < 3; i++) ctx.fillText(code.slice(i * per, (i + 1) * per), 92, y + 188 + i * 32, LW);
  if (url) {
    const qs = 264, qx = W - 92 - qs, qy = y - 40;
    if (qrDraw(ctx, url, qx, qy, qs)) { ctx.fillStyle = 'rgba(236,227,207,.7)'; ctx.font = `26px ${KAI}`; ctx.textAlign = 'center'; ctx.fillText('扫码应战', qx + qs / 2, qy + qs + 36); ctx.textAlign = 'left'; }
  }
  return cv.toDataURL('image/png');
}

// ---- src/fx.js
// 蛊码 GuCode · 爽感表现组件（开茧、转市、宝箱、升级、成就、点亮、跳数字、飘字、音色）
// 纯 DOM + CSS + WebAudio，不依赖 ui.js。样式在 style.css 末尾「fx 组件」段，演示页 tools/fx-demo.html。
//
// ── 给集成方 ─────────────────────────────────────────────────────────────
// 通用约定
//   · host：挂载容器。传 document.body 时是全屏浮层；传别的元素时铺满该元素（static 定位会被改成 relative）。
//   · 动画型组件都返回 Promise。播放中点一下（或按 Enter / Space / Esc）= 跳到最终态；
//     最终态再点一下 = 收起并 resolve({ skipped })。
//     传 keep:true 则停在最终态立即 resolve({ el, skipped })，el 由集成方自己移除；传 hold:ms 则最终态停 ms 后自动收起。
//   · 声音：组件不建 AudioContext，只调用 onSound(name, k)。name ∈ Object.keys(SFX)，k 是可选的档位/序号。接法：
//       onSound: (n, k) => { if (!S.mute && ac()) SFX[n](AC, AC.currentTime, AC.destination, k); }
//     也可以 fxConfig({ onSound }) 设一次全局默认，单次调用里传的优先。
//   · 减弱震屏和闪光：fxConfig({ calm: true }) 或单次传 calm:true。系统开了 prefers-reduced-motion 时自动 calm，
//     并把期待段缩到约三分之一、不放飞散粒子。
//   · 稀有度 rarity 0..4 = 凡 良 珍 绝 天；颜色走 CSS 变量 --fx-r0..4（底色上）与 --fx-p0..4（宣纸卡上），深浅主题各一版。
//
// API
//   openCocoon(host, { rarity, artHTML, name, tease?, onSound })   开茧：摇 → 裂 → 裂缝透色逐档升 → 顿帧破茧 → 蛊落下盖印。
//                                                                tease:true 时最后一道裂缝闪一下高一档的颜色再落回（近失）。
//   spinReels(host, { items:[h,h,h], nearMiss, triple, pool?, onSound })
//                                                                转市三格，约 400/750/1100ms 依次停；近失第三格拖到约 1.8s 并浮出「差一只！」；
//                                                                三连出全屏大字。转轮留在 host 里，resolve({ el, skipped })。pool 是转动时路过的填充图。
//   openChest(host, { tier, rewards:[{ icon, label, amount }], onSound })   宝箱，tier 0..4 = 木 铜 银 金 玄；金、玄带全屏墨染。
//   levelUp(host, { level, title?, rewards:[{ icon, label, amount }], onSound })   蛊师升级全屏庆祝。
//   toastAchievement({ tier, name, desc, hidden, onSound? })      成就卡右上角滑入，tier 0..2 = 铜 银 金；最多同屏 3 张，其余排队；
//                                                                自动消失，点一下提前收起；Promise 在它消失时 resolve。
//   unlockReveal(host, { name, line, onSound })                   功能点亮：卷轴展开、字落墨、盖「启」印，默认 2.6s 后自动收起。
//   rollNumber(el, from, to, ms = 600, fmt?)                      数字滚动（减速缓动），fmt(v) 自定义格式（如 fmtNum）。→ Promise
//   floatText(anchorEl, text, kind = 'info')                      飘字。kind：gain（金，+12◈）、qi（青，+灵气）、heal（青，伤愈）、dmg、crit、info。
//   SFX                                                           { coin, reelTick, reelStop, jackpot, crack, rarity0..4, levelUp, toast, chestThud,
//                                                                   seal, miss, unlock, whoosh }，每个是 (ctx, t, out, k?) => void
//   fxConfig({ calm, onSound })                                   全局默认，返回当前配置。calm 同时给 <html> 加/去 gu-calm，停住五转墨气。
//   fuseRankUp(host, { artBefore, artAfter, name, rank, onSound })
//                                                                升转演出：三只同种飞向中间 → 合成一团墨打转 → 顿帧炸开 → 新外貌弹出 →
//                                                                盖「二转」…「五转」/「仙蛊」印。rank 是升转后的转数 2..6。点一下跳到最终态。
//
// 升转外貌（src/art.js）
//   guSVG(sp, { rank, rarity, still })：rank 1..5，6 = 仙蛊。在任何物种（含以后新加的）原画上叠通用图层：
//     二转飞白墨纹、体型略大；三转身后真元色晕染（core.js ZHENYUAN.colors）；四转金线勾边、晕染更浓、足下小印；
//     五转头光 + 墨气缓动（still:true 或 html.gu-calm 或 prefers-reduced-motion 时不动）；六转金朱背光、双线描金、金箔、仙印。
//     rarity 不画在虫身上，只写进 data-rar；卡片用 rarityFrame(rarity) 返回的 class（rf rfN）出边框和角标。
//     rankLayers(rank, bbox) 是叠加层本体，新物种可在 RANK_BOX / 默认外框上直接套用。
//   接法示例：fuseRankUp(document.body, { artBefore: guSVG(g.sp, { rank: s0 }), artAfter: guSVG(g.sp, { rank: s0 + 1 }), name: SP[g.sp].n, rank: s0 + 1 })
// ────────────────────────────────────────────────────────────────────────

const FXC = { calm: false, onSound: null };
function fxConfig(o) {
  if (o) { Object.assign(FXC, o); if ('calm' in o && typeof document !== 'undefined') document.documentElement.classList.toggle('gu-calm', !!o.calm); }
  return FXC;
}
const FX_RN = ['凡', '良', '珍', '绝', '天'], FX_CN = ['木', '铜', '银', '金', '玄'], FX_AN = ['铜', '银', '金'];
const fxRM = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const fxCalm = o => !!(o && o.calm != null ? o.calm : FXC.calm) || fxRM();
const fxH = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const fxEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fxCl = (v, a, b) => Math.max(a, Math.min(b, v));
const fxR = (a, b) => a + Math.random() * (b - a);
const fxPick = a => a[(Math.random() * a.length) | 0];
const fxNum = v => String(Math.round(v));
function fxSnd(o, n, k) { const f = (o && o.onSound) || FXC.onSound; if (f) try { f(n, k); } catch (e) { /* 声音出错不影响画面 */ } }
function fxAt(layer, node) { const a = layer.getBoundingClientRect(), b = node.getBoundingClientRect(); return { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height / 2, w: b.width, h: b.height }; }
const fxInk = (s, d0 = 0, step = 70) => [...String(s)].map((c, i) => `<i style="animation-delay:${d0 + i * step}ms">${fxEsc(c)}</i>`).join('');

// 滤镜：毛笔边、墨晕、洇开、印泥斑驳。只注入一次。
const FX_BODY = 'M61 24 C86 24 100 52 98 88 C96 125 80 151 59 150 C37 149 22 123 22 86 C22 50 37 24 61 24 Z';
function fxDefs() {
  if (document.getElementById('fx-defs')) return;
  document.body.insertAdjacentHTML('afterbegin', `<svg id="fx-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<filter id="fx-ink" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="fx-wash" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="0.9"/></filter>
<filter id="fx-sumi" x="-35%" y="-35%" width="170%" height="170%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="11" result="lo"/><feDisplacementMap in="SourceGraphic" in2="lo" scale="34" xChannelSelector="R" yChannelSelector="G" result="d1"/><feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves="2" seed="2" result="hi"/><feDisplacementMap in="d1" in2="hi" scale="6" xChannelSelector="R" yChannelSelector="G" result="d2"/><feGaussianBlur in="d2" stdDeviation="1.4" result="b"/><feMorphology in="b" operator="erode" radius="1.6" result="er"/><feComposite in="b" in2="er" operator="out" result="edge"/><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="6" result="m"/><feColorMatrix in="m" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.6 0 0 0 -0.75" result="ma"/><feComposite in="b" in2="ma" operator="in" result="body"/><feMerge><feMergeNode in="body"/><feMergeNode in="edge"/><feMergeNode in="edge"/></feMerge></filter>
<filter id="fx-seepf" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="8" result="lo"/><feDisplacementMap in="SourceGraphic" in2="lo" scale="14" xChannelSelector="R" yChannelSelector="G" result="d1"/><feGaussianBlur in="d1" stdDeviation="2" result="b"/><feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves="3" seed="12" result="m"/><feColorMatrix in="m" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.4 0 0 0 -0.6" result="ma"/><feComposite in="b" in2="ma" operator="in"/></filter>
<filter id="fx-stamp" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="t"/><feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -14 0 0 0 10.4" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in" result="c"/><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="9" result="d"/><feDisplacementMap in="c" in2="d" scale="1.8" xChannelSelector="R" yChannelSelector="G"/></filter>
<clipPath id="fx-ccclip"><path d="${FX_BODY}"/></clipPath>
</defs></svg>`);
}

// ---------- 播放控制：可跳过的等待与动画 ----------
function fxRun(o, root) {
  const run = { skipped: false, done: false, root, anims: [], wakes: [], timers: [], junk: [] };
  run.wait = ms => new Promise(res => { if (run.skipped || ms <= 0) return res(); run.timers.push(setTimeout(res, ms)); run.wakes.push(res); });
  run.skip = () => {
    if (run.skipped || run.done) return;
    run.skipped = true; if (root) root.classList.add('fx-skip');
    run.timers.forEach(clearTimeout); run.wakes.splice(0).forEach(f => f());
    run.anims.splice(0).forEach(a => { try { a.finish(); } catch (e) { a.cancel(); } });
    run.junk.splice(0).forEach(n => n.remove());
  };
  run.anim = (node, kf, opt) => {
    if (!node || !node.animate) return null;
    const a = node.animate(kf, typeof opt === 'number' ? { duration: opt, fill: 'both' } : Object.assign({ fill: 'both' }, opt));
    if (run.skipped) { try { a.finish(); } catch (e) { a.cancel(); } } else run.anims.push(a);
    return a;
  };
  run.snd = (n, k) => { if (!run.skipped) fxSnd(o, n, k); };
  run.show = (node, cls = 'on') => { if (node) { node.classList.remove('fx-pre'); node.classList.add(cls); } };
  return run;
}
function fxStage(host, cls, o) {
  fxDefs();
  host = host || document.body;
  const fixed = host === document.body || host === document.documentElement;
  if (!fixed && getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const st = fxH(`<div class="fx-stage ${cls}${fixed ? ' fx-fixed' : ''}${fxCalm(o) ? ' fx-calm' : ''}" role="dialog" aria-live="polite"></div>`);
  (fixed ? document.body : host).appendChild(st);
  const run = fxRun(o, st);
  const key = e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') run.skip(); };
  st.addEventListener('pointerdown', run.skip); document.addEventListener('keydown', key);
  run.unkey = () => document.removeEventListener('keydown', key);
  return { st, run };
}
// 到最终态：换提示语，等点击或 hold 后收起
function fxClose(st, run, o, label) {
  run.done = true; run.unkey(); st.removeEventListener('pointerdown', run.skip);
  const hint = st.querySelector('.fx-hint'); if (hint) hint.textContent = label || '点击收下';
  if (o.keep) return Promise.resolve({ el: st, skipped: run.skipped });
  return new Promise(res => {
    const t0 = performance.now(); let fin = false, tm = 0;
    const go = () => {
      if (fin) return; fin = true; clearTimeout(tm); document.removeEventListener('keydown', onk);
      st.classList.add('fx-out'); setTimeout(() => { st.remove(); res({ skipped: run.skipped }); }, 260);
    };
    const onk = e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') go(); };
    st.addEventListener('pointerdown', () => { if (performance.now() - t0 > 250) go(); });
    document.addEventListener('keydown', onk);
    if (o.hold) tm = setTimeout(go, o.hold);
  });
}
function fxShake(node, px, ms = 260, o) {
  if (!node || !px || fxCalm(o)) return;
  if (node.classList.contains('fx-stage')) node = node.querySelector('.fx-col') || node;   // 只震内容，别把整块浮层震出缝
  node.animate([{ translate: '0 0' }, { translate: `${px}px ${-px / 2}px` }, { translate: `${-px}px ${px / 3}px` }, { translate: `${px / 2}px 0` }, { translate: '0 0' }], { duration: ms, easing: 'ease-out' });
}

// ---------- 墨与金：墨团、金箔、朱砂点、碎片、涟漪 ----------
// 一团墨：浓核 → 中圈 → 外圈淡洇 → 飞点，再过 fx-sumi（两级扭曲 + 宣纸斑驳）
function fxBlot(color, spat = 10, cls = '') {
  const c = (a, d, r, op) => `<circle cx="${(100 + Math.cos(a) * d).toFixed(1)}" cy="${(100 + Math.sin(a) * d).toFixed(1)}" r="${r.toFixed(1)}" fill-opacity="${op.toFixed(2)}"/>`;
  let s = c(0, 0, 32, .95);
  for (let i = 0; i < 6; i++) s += c(i * 1.047 + fxR(-.3, .3), fxR(20, 30), fxR(17, 25), fxR(.5, .8));
  for (let i = 0; i < 8; i++) s += c(i * .785 + fxR(-.3, .3), fxR(46, 60), fxR(9, 17), fxR(.22, .42));
  for (let i = 0; i < spat; i++) s += c(fxR(0, 6.283), fxR(68, 94), fxR(1.2, 4.2), fxR(.5, .9));
  return `<svg class="fx-blot ${cls}" viewBox="0 0 200 200" aria-hidden="true"><g filter="url(#fx-sumi)" style="fill:${color}">${s}</g></svg>`;
}
// 一团墨在 (x,y) 洇开再淡去：「闪」用它代替白闪
function fxBloom(layer, run, x, y, size, color, peak = .5, ms = 900, o) {
  if (run.skipped) return;
  const b = fxH(fxBlot(color, 10));
  Object.assign(b.style, { position: 'absolute', left: x - size / 2 + 'px', top: y - size / 2 + 'px', width: size + 'px', height: size + 'px', zIndex: 1, pointerEvents: 'none' });
  layer.appendChild(b); run.junk.push(b);
  const p = fxCalm(o) ? peak * .35 : peak;
  b.animate([{ scale: .2, opacity: 0 }, { scale: .85, opacity: p, offset: .18 }, { scale: 1.08, opacity: 0 }], { duration: fxRM() ? 300 : ms, easing: 'cubic-bezier(.15,.8,.25,1)', fill: 'forwards' }).onfinish = () => b.remove();
}
// 全屏墨染：留在最终态里，收起时随浮层一起淡出
function fxWash(st, run, colors, slow) {
  const w = st.querySelector('.fx-wash'); if (!w) return;
  const first = !w.childElementCount;
  if (first) w.innerHTML = colors.map((c, i) => fxBlot(c, i ? 0 : 14, 'w' + i)).join('');
  const kf = slow ? [{ scale: .15, opacity: 0 }, { scale: .55, opacity: .55 }] : first ? [{ scale: .5, opacity: 0 }, { scale: 1, opacity: 1 }] : [{ scale: 1, opacity: 1 }];
  [...w.children].forEach((s, i) => run.anim(s, kf, { duration: slow ? 900 : 700 + i * 160, easing: 'cubic-bezier(.2,.7,.3,1)' }));
}
function fxFlakes(layer, run, x, y, n, colors, spread = 1) {
  if (!n || run.skipped || fxRM()) return;
  for (let i = 0; i < n; i++) {
    const f = document.createElement('i'), s = fxR(5, 13), h = s * fxR(.55, 1.1);
    f.className = 'fx-flake';
    const p = () => fxR(0, 30).toFixed(0) + '% ' + fxR(0, 30).toFixed(0) + '%';
    f.style.cssText = `left:${x - s / 2}px;top:${y - h / 2}px;width:${s}px;height:${h}px;background:${colors[i % colors.length]};clip-path:polygon(${p()},${(70 + Math.random() * 30).toFixed(0)}% ${fxR(0, 25).toFixed(0)}%,${(75 + Math.random() * 25).toFixed(0)}% ${(70 + Math.random() * 30).toFixed(0)}%,${fxR(0, 30).toFixed(0)}% ${(75 + Math.random() * 25).toFixed(0)}%)`;
    layer.appendChild(f); run.junk.push(f);
    const a = -Math.PI / 2 + fxR(-1.35, 1.35), v = fxR(80, 230) * spread, dx = Math.cos(a) * v, dy = Math.sin(a) * v, fall = fxR(110, 260), rot = fxR(-540, 540);
    f.animate([
      { transform: 'translate(0,0) rotate(0deg) scaleX(1)', opacity: 1 },
      { transform: `translate(${dx * .72}px,${dy * .72}px) rotate(${rot * .3}deg) scaleX(-.35)`, opacity: 1, offset: .22 },
      { transform: `translate(${dx}px,${dy + fall * .35}px) rotate(${rot * .6}deg) scaleX(.85)`, opacity: 1, offset: .55 },
      { transform: `translate(${dx * 1.12}px,${dy + fall}px) rotate(${rot}deg) scaleX(-.5)`, opacity: 0 },
    ], { duration: fxR(1300, 2200), easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' }).onfinish = () => f.remove();
  }
}
function fxDrops(layer, run, x, y, n, color, spread = 1) {
  if (!n || run.skipped || fxRM()) return;
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i'), s = fxR(3, 10), a = fxR(0, 6.283), v = fxR(50, 170) * spread;
    d.className = 'fx-drop'; d.style.cssText = `left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;background:${color}`;
    layer.appendChild(d); run.junk.push(d);
    const deg = a * 57.3;
    d.animate([
      { transform: `translate(0,0) rotate(${deg}deg) scale(2.2,.45)`, opacity: .95 },
      { transform: `translate(${Math.cos(a) * v}px,${Math.sin(a) * v}px) rotate(${deg}deg) scale(1,1)`, opacity: .95, offset: .25 },
      { transform: `translate(${Math.cos(a) * v}px,${Math.sin(a) * v}px) rotate(${deg}deg) scale(1,1)`, opacity: .8, offset: .7 },
      { transform: `translate(${Math.cos(a) * v}px,${Math.sin(a) * v}px) rotate(${deg}deg) scale(1,1)`, opacity: 0 },
    ], { duration: fxR(900, 1400), easing: 'cubic-bezier(.1,.8,.2,1)', fill: 'forwards' }).onfinish = () => d.remove();
  }
}
function fxShards(layer, run, x, y, n, colors, spread = 1, up = 0) {
  if (!n || run.skipped || fxRM()) return;
  for (let i = 0; i < n; i++) {
    const f = document.createElement('i'), s = fxR(4, 12);
    f.className = 'fx-shard';
    f.style.cssText = `left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s * fxR(.5, 1)}px;background:${colors[i % colors.length]};clip-path:polygon(0 ${fxR(0, 40) | 0}%,100% 0,${fxR(60, 100) | 0}% 100%,${fxR(0, 30) | 0}% ${fxR(60, 100) | 0}%)`;
    layer.appendChild(f); run.junk.push(f);
    const a = fxR(0, 6.283), v = fxR(40, 150) * spread, dx = Math.cos(a) * v, dy = Math.sin(a) * v - up;
    f.animate([{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) rotate(${fxR(-200, 200)}deg)`, opacity: 1, offset: .4 }, { transform: `translate(${dx * 1.2}px,${dy + fxR(80, 180)}px) rotate(${fxR(-400, 400)}deg)`, opacity: 0 }],
      { duration: fxR(700, 1100), easing: 'cubic-bezier(.2,.6,.5,1)', fill: 'forwards' }).onfinish = () => f.remove();
  }
}
function fxRing(layer, run, x, y, size, color) {
  if (run.skipped || fxRM()) return;
  const r = document.createElement('i'); r.className = 'fx-ring';
  r.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;border-color:${color}`;
  layer.appendChild(r); run.junk.push(r);
  r.animate([{ scale: .45, opacity: .85 }, { scale: 1.6, opacity: 0 }], { duration: 560, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).onfinish = () => r.remove();
}
const fxSeal = (txt, cls = '', style = '') => `<span class="fx-seal ${cls}"${style ? ` style="${style}"` : ''}>${[...txt].map(c => `<b>${fxEsc(c)}</b>`).join('')}</span>`;
// 大印：带几点朱砂溅
function fxBigSeal(txt, color) {
  let dots = '';
  for (let i = 0; i < 9; i++) { const a = fxR(0, 6.283), d = fxR(46, 64); dots += `<circle cx="${(60 + Math.cos(a) * d).toFixed(1)}" cy="${(60 + Math.sin(a) * d).toFixed(1)}" r="${fxR(1, 3.6).toFixed(1)}"/>`; }
  return `<div class="fx-bigseal fx-pre" style="--sc:${color}"><svg viewBox="0 0 120 120" aria-hidden="true"><g filter="url(#fx-wash)" style="fill:${color}">${dots}</g></svg>${fxSeal(txt, 'fx-lg')}</div>`;
}
async function fxRollRun(el, from, to, ms, fmt, run) {
  const f = fmt || fxNum;
  if (!el) return;
  if (fxRM() || ms <= 0 || (run && run.skipped)) { el.textContent = f(to); return; }
  const t0 = performance.now(), tok = el.__fxRoll = {};
  await new Promise(res => {
    const step = now => {
      if (el.__fxRoll !== tok) return res();
      const k = run && run.skipped ? 1 : Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = f(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step); else { el.textContent = f(to); res(); }
    };
    requestAnimationFrame(step);
  });
}

// ---------- 1. 开茧 ----------
const FX_CRACKS = ['M60 70 L55 81 L62 90 L57 102', 'M60 70 L66 60 L61 50 L68 39', 'M62 90 L73 94 L79 106 L89 111', 'M55 81 L45 75 L35 80 L28 71', 'M57 102 L47 108 L41 121', 'M79 106 L77 120 L86 131'];
const FX_WRAPS = ['M18 62 Q60 76 102 58', 'M18 82 Q62 97 102 77', 'M20 103 Q60 118 100 98', 'M26 124 Q60 137 94 118', 'M32 44 Q60 54 92 40', 'M30 38 Q72 92 90 142', 'M88 34 Q50 94 34 140'];
function fxCocoonSVG() {
  return `<svg viewBox="0 0 120 170" class="fx-ccsvg" aria-hidden="true">
<ellipse cx="60" cy="161" rx="30" ry="4.5" class="fx-ccsh" filter="url(#fx-wash)"/>
<path d="M60 -30 L60 26" class="fx-thr"/>
<path d="${FX_BODY}" class="fx-silk"/>
<g clip-path="url(#fx-ccclip)"><ellipse cx="42" cy="106" rx="22" ry="42" class="fx-ccshade" filter="url(#fx-wash)"/><circle cx="61" cy="86" r="30" class="fx-seep" filter="url(#fx-seepf)"/>
<g class="fx-wrap" filter="url(#fx-ink)">${FX_WRAPS.map((d, i) => `<path d="${d}"${i > 4 ? ' opacity=".5"' : ''}/>`).join('')}</g></g>
<path d="${FX_BODY}" class="fx-silko" filter="url(#fx-ink)"/>
<g class="fx-cks" filter="url(#fx-ink)">${FX_CRACKS.map(d => `<g class="fx-ck"><path d="${d}" pathLength="1" class="e"/><path d="${d}" pathLength="1" class="l"/></g>`).join('')}</g>
</svg>`;
}
const fxSwing = a => [{ rotate: '0deg' }, { rotate: a + 'deg' }, { rotate: -a * .75 + 'deg' }, { rotate: a * .4 + 'deg' }, { rotate: '0deg' }];
const FX_RC = r => `var(--fx-r${r})`, FX_PC = r => `var(--fx-p${r})`;

async function openCocoon(host, o = {}) {
  const r = fxCl(o.rarity | 0, 0, 4), rm = fxRM(), k = rm ? .35 : 1;
  const { st, run } = fxStage(host, 'fx-cocoon fx-r' + r, o);
  st.style.setProperty('--lc', FX_RC(0));
  st.innerHTML = `<div class="fx-wash"></div><div class="fx-col">
<div class="fx-pit">${r ? `<div class="fx-halo fx-pre">${fxBlot(FX_RC(r), 6)}</div>` : ''}<div class="fx-ccbox"><div class="fx-cc">${fxCocoonSVG()}</div></div>
<div class="fx-cardbox fx-pre"><div class="fx-card" style="--rc:${FX_PC(r)}"><div class="fx-art">${o.artHTML || ''}</div><b class="fx-cn">${fxEsc(o.name || '')}</b>${r < 3 ? fxSeal(FX_RN[r], 'fx-sm fx-pre', `--sc:${FX_PC(r)}`) : ''}</div>${r >= 3 ? fxBigSeal(FX_RN[r] + '品', r === 4 ? 'var(--zhu)' : FX_PC(3)) : ''}</div></div>
<div class="fx-rk fx-pre" style="color:${FX_RC(r)}"><span class="ln"></span><span>${fxInk(FX_RN[r] + '品', 0, 90)}</span><span class="ln"></span></div></div>
<div class="fx-hint">点击跳过</div>`;
  const q = s => st.querySelector(s), box = q('.fx-ccbox'), cc = q('.fx-cc'), cks = [...st.querySelectorAll('.fx-ck')], seep = q('.fx-seep'), cardbox = q('.fx-cardbox');
  const mid = () => fxAt(st, cc), lift = n => cks[n] && fxAt(st, cks[n]);
  const setLv = lv => { st.style.setProperty('--lc', FX_RC(lv)); seep.style.opacity = lv ? (.2 + lv * .12).toFixed(2) : 0; };
  // 一、摇晃
  run.anim(cc, fxSwing(5), { duration: 380, easing: 'ease-in-out' }); run.snd('reelTick');
  await run.wait(340 * k);
  // 二、裂纹逐道出现，裂缝里的颜色一档档往上走
  const n = 2 + r, T = (1200 + 250 * r) * k, hold = (150 + 55 * r) * k, gap = (T - 340 * k - hold) / n;
  let lv = 0;
  for (let i = 0; i < n; i++) {
    cks[i].querySelectorAll('path').forEach(p => { run.anim(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 150, easing: 'ease-out' }); p.style.strokeDashoffset = 0; });
    run.snd('crack', i);
    const nl = Math.min(i, r);
    if (nl !== lv) { lv = nl; setLv(lv); const m = mid(); fxRing(st, run, m.x, m.y, m.h * .9, FX_RC(lv)); run.anim(cc, [{ scale: 1 }, { scale: 1.05 }, { scale: 1 }], { duration: 220, easing: 'ease-out' }); }
    run.anim(cc, fxSwing(3 + i * 1.6), { duration: 300, easing: 'ease-out' });
    const c = lift(i); if (c) fxShards(st, run, c.x, c.y, 3, ['var(--fx-silk)', 'var(--fx-silk2)'], .5, 30);
    await run.wait(gap);
  }
  if (o.tease && r < 4 && !run.skipped) {   // 近失：闪一下高一档的颜色，再落回
    setLv(r + 1); run.snd('crack', n); await run.wait(170 * k); setLv(r);
  }
  // 三、屏息：快颤，墨意从四周渗进来（绝、天）
  const trem = run.anim(cc, [{ rotate: '-1.4deg' }, { rotate: '1.4deg' }], { duration: 48, iterations: Infinity, direction: 'alternate', fill: 'none' });
  seep.style.opacity = r ? (.3 + r * .14).toFixed(2) : .08;
  if (r >= 3) fxWash(st, run, r === 4 ? ['var(--fx-w4a)', 'var(--fx-w4b)'] : ['var(--fx-w3a)', 'var(--fx-w3b)'], true);
  await run.wait(hold);
  if (trem) trem.pause();
  await run.wait(rm ? 0 : 85);   // 顿帧
  if (trem) trem.cancel();
  // 四、破茧：两半飞开、碎丝四散、墨晕一闪、金箔朱砂、震屏
  const m = mid();
  cc.classList.add('fx-gone');
  const svg = cc.innerHTML;
  const top = fxH(`<div class="fx-half t">${svg}</div>`), bot = fxH(`<div class="fx-half b">${svg}</div>`);
  box.append(top, bot);
  run.anim(top, [{ transform: 'none', opacity: 1 }, { transform: `translate(${-30 - r * 6}px,${-64 - r * 10}px) rotate(${-24 - r * 4}deg)`, opacity: 0 }], { duration: 650, easing: 'cubic-bezier(.15,.7,.3,1)' });
  run.anim(bot, [{ transform: 'none', opacity: 1 }, { transform: `translate(${24 + r * 4}px,${50 + r * 6}px) rotate(${16 + r * 3}deg)`, opacity: 0 }], { duration: 650, easing: 'cubic-bezier(.3,.2,.4,1)' });
  fxBloom(st, run, m.x, m.y, 240 + r * 70, FX_RC(r), r ? .55 : .3, 900, o);
  fxShards(st, run, m.x, m.y, 10 + r * 3, ['var(--fx-silk)', 'var(--fx-silk2)', 'var(--fx-edge)'], 1 + r * .2);
  fxFlakes(st, run, m.x, m.y, [0, 3, 8, 16, 30][r], r === 4 ? ['var(--fx-gold)', 'var(--fx-gold2)', 'var(--fx-leaf)', 'var(--fx-r4b)'] : r === 3 ? [FX_RC(3), 'var(--fx-gold)', FX_RC(3)] : [FX_RC(r)], .8 + r * .15);
  if (r >= 3) { fxDrops(st, run, m.x, m.y, 14, r === 4 ? 'var(--zhu)' : FX_RC(3), 1.3); fxWash(st, run, [], false); }
  fxShake(st, [1, 2, 3, 6, 9][r], 300, o);
  run.snd('rarity' + r);
  // 五、蛊落下：弹出用回弹，落定用减速；身后留一团本档颜色的墨晕
  const halo = q('.fx-halo');
  if (halo) { run.show(halo); run.anim(halo, [{ scale: .3, opacity: 0 }, { scale: 1, opacity: 1 }], { duration: 700, easing: 'cubic-bezier(.15,.8,.25,1)' }); }
  run.show(cardbox);
  run.anim(cardbox, [{ transform: 'translateY(28px) scale(.5)', opacity: 0, easing: 'cubic-bezier(.2,.9,.3,1.25)' }, { transform: 'translateY(-22px) scale(1.04)', opacity: 1, offset: .5, easing: 'cubic-bezier(.3,0,.2,1)' }, { transform: 'none', opacity: 1 }], { duration: rm ? 200 : 560 });
  await run.wait(380 * k);
  run.show(q('.fx-rk'));
  if (r < 3) { run.show(q('.fx-card .fx-seal')); run.snd('seal'); }
  else {   // 绝、天：大印落下
    await run.wait(140 * k);
    run.show(q('.fx-bigseal')); run.snd('seal');
    await run.wait(rm ? 0 : 200);
    fxShake(st, r === 4 ? 6 : 4, 220, o);
    const s = fxAt(st, q('.fx-bigseal'));
    fxDrops(st, run, s.x, s.y, 8, r === 4 ? 'var(--zhu)' : FX_RC(3), .6);
    if (r === 4) fxFlakes(st, run, s.x, s.y, 10, ['var(--fx-gold)', 'var(--fx-gold2)'], .6);
  }
  return fxClose(st, run, o, '点击收下');
}

// ---------- 2. 转市 · 三格转轮 ----------
async function spinReels(host, o = {}) {
  fxDefs();
  const items = (o.items || []).slice(0, 3), tri = !!o.triple, near = !!o.nearMiss && !tri, rm = fxRM();
  while (items.length < 3) items.push('');
  const pool = o.pool && o.pool.length ? o.pool : items;
  const box = fxH(`<div class="fx-reels${fxCalm(o) ? ' fx-calm' : ''}"><div class="fx-rrow">${[0, 1, 2].map(() => '<div class="fx-rwin"><div class="fx-strip"></div></div>').join('')}</div><div class="fx-rmsg"></div></div>`);
  (host || document.body).appendChild(box);
  const run = fxRun(o, box);
  box.addEventListener('pointerdown', run.skip);
  const wins = [...box.querySelectorAll('.fx-rwin')], strips = [...box.querySelectorAll('.fx-strip')], msg = box.querySelector('.fx-rmsg');
  const D = rm ? [160, 260, 360] : [400, 750, near ? 1800 : 1100], P = [3, 3, near ? 2.65 : 3];
  const R = [0, 1, 2].map(i => {
    const L = Math.max(5, Math.round(.06 * D[i] / P[i]) + 1);
    // 格子自上而下往下走：cells[1] 是停下的那格；近失时 cells[0]（下一格就转到的）放成同种，停下时露在中线上方，差一格
    const cells = [near && i === 2 ? items[0] : fxPick(pool), items[i], fxPick(pool)];
    for (let j = 3; j <= L + 1; j++) cells.push(fxPick(pool));
    strips[i].innerHTML = cells.map(h => `<div class="fx-cell">${h}</div>`).join('');
    return { L, D: D[i], P: P[i], last: -1, stopped: false };
  });
  const cellH = strips[0].firstElementChild.getBoundingClientRect().height || 64, winH = wins[0].clientHeight || cellH * 1.5, base = (winH - cellH) / 2;
  const place = (i, p, bump = 0) => { strips[i].style.transform = `translateY(${(base - (R[i].L + 1 - p - bump) * cellH).toFixed(2)}px)`; };
  R.forEach((_, i) => place(i, 0));
  let lastTick = 0;
  const onStop = i => {
    const w = wins[i];
    run.snd('reelStop', i);
    run.anim(w, [{ translate: '0 3px' }, { translate: '0 0' }], { duration: 170, easing: 'ease-out' });
    w.classList.add('fx-land');
    if (i === 1 && near) { wins[0].classList.add('fx-pair'); wins[1].classList.add('fx-pair'); wins[2].classList.add('fx-tense'); }
  };
  // 三格同时起转，按各自时长减速停下；路过一格响一下，慢下来就听得出「快到了」
  await new Promise(res => {
    const t0 = performance.now();
    const frame = now => {
      const t = run.skipped ? 1e9 : now - t0;
      let all = true;
      R.forEach((g, i) => {
        if (g.fin) return;
        const x = Math.min(1, t / g.D), p = g.L * (1 - Math.pow(1 - x, g.P));
        const u = t > g.D ? Math.min(1, (t - g.D) / 170) : 0, bump = u ? .14 * Math.sin(Math.PI * u) * (1 - u) : 0;
        place(i, p, bump);
        strips[i].classList.toggle('fx-blur', x < .55 && !rm);
        const c = Math.floor(p);
        if (c !== g.last) { g.last = c; if (now - lastTick > 48 && x < 1) { run.snd('reelTick'); lastTick = now; } }
        if (x >= 1 && !g.stopped) { g.stopped = true; onStop(i); }
        if (u >= 1) g.fin = true; else all = false;
      });
      if (all) return res();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  wins[2].classList.remove('fx-tense');
  if (run.skipped) fxSnd(o, 'reelStop', 2);
  if (near) {   // 近失：第三格停在「差一格」的地方，浮出「差一只！」
    run.snd('miss');
    run.anim(wins[2], [{ translate: '0 0' }, { translate: '-4px 0' }, { translate: '4px 0' }, { translate: '-2px 0' }, { translate: '0 0' }], { duration: 300 });
    msg.innerHTML = `<span class="fx-miss">${fxInk('差一只！', 0, 60)}</span>`;
    if (!run.skipped) {
      const f = fxH(`<span class="fx-missfly">差一只！</span>`), p = fxAt(box, wins[2]);
      f.style.left = p.x + 'px'; f.style.top = (p.y - p.h * .25) + 'px';
      box.appendChild(f); run.junk.push(f);
      f.animate([{ opacity: 0, translate: '-50% 10px', scale: .6 }, { opacity: 1, translate: '-50% -18px', scale: 1.1, offset: .3 }, { opacity: 0, translate: '-50% -48px', scale: 1 }], { duration: 1000, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }).onfinish = () => f.remove();
    }
  } else if (tri) {
    await run.wait(rm ? 0 : 85);   // 顿帧
    wins.forEach(w => w.classList.add('fx-win3'));
    msg.innerHTML = fxSeal('三连', 'fx-sm fx-tri3');
    if (!run.skipped) await fxTripleBurst(o, box);
  }
  run.done = true; box.removeEventListener('pointerdown', run.skip);
  return { el: box, skipped: run.skipped, nearMiss: near, triple: tri };
}
// 三连：全屏墨染 + 大字「三连」逐字落墨 + 朱印 + 金箔，约 1.6 秒自己收起，点一下提前收
async function fxTripleBurst(o, reels) {
  const st = fxH(`<div class="fx-stage fx-fixed fx-tri${fxCalm(o) ? ' fx-calm' : ''}"><div class="fx-wash"></div><div class="fx-col"><b class="fx-trin">${fxInk('三连', 60, 110)}</b>${fxBigSeal('大吉', 'var(--zhu)')}<p class="fx-trisub">三只同种 · 结算加成</p></div></div>`);
  document.body.appendChild(st);
  const run = fxRun(o, st); st.addEventListener('pointerdown', run.skip);
  run.snd('jackpot');
  fxWash(st, run, ['var(--fx-w4a)', 'var(--fx-w4b)'], false);
  fxShake(reels, 8, 320, o);
  const c = fxAt(st, st.querySelector('.fx-trin'));
  fxFlakes(st, run, c.x, c.y, 34, ['var(--fx-gold)', 'var(--fx-gold2)', 'var(--fx-leaf)', 'var(--fx-r4b)'], 1.3);
  fxDrops(st, run, c.x, c.y, 16, 'var(--zhu)', 1.6);
  await run.wait(360);
  run.show(st.querySelector('.fx-bigseal')); run.snd('seal');
  await run.wait(180); fxShake(st, 5, 200, o);
  await run.wait(1100);
  run.done = true; st.classList.add('fx-out');
  await new Promise(r => setTimeout(r, 260)); st.remove();
}

// ---------- 3. 宝箱 ----------
const FX_CHEST = [   // 箱体、箍、锁、盖内
  { b: '#8a5a32', s: '#4f331f', l: '#b98c4e', i: '#4a2e1a', pl: 1 },
  { b: '#6e4a30', s: '#a8743c', l: '#4f8a78', i: '#3a2616', pl: 1 },
  { b: '#4f4b47', s: '#c3c9c9', l: '#e1e5e2', i: '#2a2826' },
  { b: '#7a2318', s: '#d9a441', l: '#efcf7a', i: '#3e110b', cloud: 1 },
  { b: '#201c25', s: '#c99a3a', l: '#b5301f', i: '#0f0d12', rune: 1 },
];
// 正面立面图：合盖时盖子压在箱身上；开盖 = 盖子翻到箱后立起（看到盖内），箱口露出一道黑
function fxChestSVG(t) {
  const c = FX_CHEST[t], E = '#1c1915', G = `filter="url(#fx-ink)" stroke="${E}" stroke-width="2.2" stroke-linejoin="round"`;
  const planks = c.pl ? `<path d="M17 28 L143 28 M18 52 L142 52" stroke="${E}" stroke-width="1.2" opacity=".45"/>` : '';
  const rune = c.rune ? `<g stroke="${c.l}" stroke-width="2.2" fill="none" stroke-linecap="round"><path d="M56 42 q8 -10 16 0 t16 0"/><path d="M60 56 l10 -6 l10 6 l10 -6"/></g>` : '';
  const cloud = c.cloud ? `<g stroke="${c.s}" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M56 48 q-6 -10 4 -12 q4 -8 12 -2 q8 -4 10 4 q8 2 4 10"/><path d="M92 54 q4 -6 10 -2"/></g>` : '';
  const lidMark = c.rune ? `<path d="M64 26 q16 -12 32 0" stroke="${c.l}" stroke-width="2" fill="none"/>` : c.cloud ? `<path d="M66 28 q6 -8 14 -2 q8 -6 14 2" stroke="${c.s}" stroke-width="1.5" fill="none"/>` : '';
  const body = `<svg class="fx-cbody" viewBox="0 0 160 80" aria-hidden="true"><g ${G}>
<path d="M14 3 L146 3 L141 76 L19 76 Z" fill="${c.b}"/>${planks}${rune}${cloud}
<path d="M34 3 L44 3 L43.5 76 L34.5 76 Z M116 3 L126 3 L125.5 76 L116.5 76 Z" fill="${c.s}"/>
<path d="M14 3 L146 3 L145.4 11 L14.6 11 Z" fill="${c.s}"/>
<path d="M67 3 L93 3 L93 17 Q80 31 67 17 Z" fill="${c.l}"/><circle cx="80" cy="13" r="2.6" fill="${E}" stroke="none"/><path d="M80 14 L80 20" stroke-width="2"/>
</g><ellipse cx="80" cy="79" rx="70" ry="3" fill="${E}" opacity=".18" filter="url(#fx-wash)"/></svg>`;
  const lid = `<svg class="fx-clid" viewBox="0 0 160 46" aria-hidden="true"><g ${G}>
<path d="M12 45 L12 27 Q14 5 80 3 Q146 5 148 27 L148 45 Z" fill="${c.b}"/>${lidMark}
<path d="M34 7 Q39 5 44 5 L44 45 L34 45 Z M116 5 Q121 5 126 7 L126 45 L116 45 Z" fill="${c.s}"/>
<path d="M12 37 L148 37 L148 45 L12 45 Z" fill="${c.s}"/></g></svg>`;
  const inner = `<svg class="fx-lidin" viewBox="0 0 160 50" aria-hidden="true"><g ${G}>
<path d="M22 50 L8 8 Q80 -5 152 8 L138 50 Z" fill="${c.i}"/>
<path d="M22 50 L19.4 42 L140.6 42 L138 50 Z" fill="${c.s}"/>
<path d="M30 34 Q80 28 130 34 M24 20 Q80 12 136 20" stroke="${c.b}" stroke-width="1.3" opacity=".7" fill="none"/></g></svg>`;
  const mouth = `<svg class="fx-mouth" viewBox="0 0 160 16" aria-hidden="true"><path d="M21 0 L139 0 L146 16 L14 16 Z" fill="#0d0b09" stroke="${E}" stroke-width="2" stroke-linejoin="round"/><path d="M23 1.5 L137 1.5 L138.5 6 L21.5 6 Z" fill="${c.i}" opacity=".9"/></svg>`;
  return `<div class="fx-ctop">${lid}<div class="fx-open fx-pre">${inner}${mouth}</div></div>${body}<span class="fx-ft"><i>封</i><i></i></span>`;
}
const fxChip = (w, i) => `<div class="fx-rw fx-pre" data-i="${i}"><span class="fx-ri">${w.icon == null ? '' : w.icon}</span><span class="fx-rl">${fxEsc(w.label || '')}</span><b class="fx-ra">${w.amount != null ? '×0' : ''}</b></div>`;

async function openChest(host, o = {}) {
  const t = fxCl(o.tier | 0, 0, 4), rw = o.rewards || [], big = t >= 3, rm = fxRM(), k = rm ? .35 : 1;
  const { st, run } = fxStage(host, 'fx-chestst fx-t' + t, o);
  const tc = ['#8a5a32', '#a8743c', 'var(--fx-r0)', 'var(--fx-r4)', 'var(--fx-r3)'][t];
  st.innerHTML = `<div class="fx-wash"></div><div class="fx-col">
<p class="fx-ctitle" style="color:${tc}">${FX_CN[t]}箱</p>
<div class="fx-chest">${fxChestSVG(t)}${big ? fxBigSeal(FX_CN[t], t === 3 ? 'var(--zhu)' : FX_PC(3)) : ''}</div>
<div class="fx-rws">${rw.map(fxChip).join('')}</div></div><div class="fx-hint">点击跳过</div>`;
  const q = s => st.querySelector(s), chest = q('.fx-chest'), lid = q('.fx-clid'), opened = q('.fx-open'), ft = q('.fx-ft');
  // 一、摇：一下比一下重
  const hops = 2 + (t >= 1) + (t >= 3), gap = (big ? 300 : 260) * k;
  for (let i = 0; i < hops; i++) {
    const h = 5 + i * 3 + t, d = i % 2 ? 1 : -1;
    run.anim(chest, [{ translate: '0 0', rotate: '0deg', scale: '1 1' }, { translate: `0 ${-h}px`, rotate: `${d * (2 + i)}deg`, scale: '.97 1.03', offset: .38 }, { translate: '0 0', rotate: `${-d}deg`, scale: '1.05 .95', offset: .72 }, { translate: '0 0', rotate: '0deg', scale: '1 1' }], { duration: 250, easing: 'ease-out' });
    await run.wait(180 * k);
    run.snd('chestThud', i); fxShake(st, 1 + i, 180, o);
    const c = fxAt(st, chest); fxShards(st, run, c.x, c.y + c.h * .45, 3, ['var(--fx-edge)', 'var(--fx-silk2)'], .6, 10);
    if (big && i === hops - 2) fxWash(st, run, t === 3 ? ['var(--fx-w4a)', 'var(--fx-w4b)'] : ['var(--fx-w3a)', 'var(--fx-wxb)'], true);
    await run.wait(gap - 180 * k);
  }
  // 二、屏息 + 顿帧
  const trem = run.anim(chest, [{ translate: '-1px 0' }, { translate: '1px 0' }], { duration: 40, iterations: Infinity, direction: 'alternate', fill: 'none' });
  await run.wait((120 + t * 50) * k);
  if (trem) trem.pause();
  await run.wait(rm ? 0 : 80);
  if (trem) trem.cancel();
  // 三、开盖：封条撕开、盖子掀起、箱口一团墨洇上来
  const c = fxAt(st, chest), b = fxAt(st, q('.fx-cbody')), my = b.y - b.h / 2 - 8;
  ft.classList.add('fx-torn');
  const [f1, f2] = ft.children;
  run.anim(f1, [{ transform: 'none', opacity: 1 }, { transform: 'translate(-26px,-60px) rotate(-50deg)', opacity: 0 }], { duration: 560, easing: 'cubic-bezier(.2,.7,.3,1)' });
  run.anim(f2, [{ transform: 'none', opacity: 1 }, { transform: 'rotate(28deg)', opacity: 1, offset: .35 }, { transform: 'translate(6px,24px) rotate(40deg)', opacity: 0 }], { duration: 600, easing: 'ease-in' });
  run.anim(lid, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], { duration: rm ? 60 : 110, easing: 'ease-in' });   // 盖子翻过去
  await run.wait(90 * k);
  run.show(opened);
  run.anim(q('.fx-mouth'), [{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 140, easing: 'ease-out' });
  run.anim(q('.fx-lidin'), [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1.14)', offset: .6 }, { transform: 'none' }], { duration: rm ? 120 : 320, easing: 'cubic-bezier(.2,.9,.3,1)' });
  run.snd(big ? 'jackpot' : 'chestThud', 9);
  if (!big) run.snd('coin');
  fxBloom(st, run, c.x, my, 200 + t * 60, ['var(--fx-edge)', '#a8743c', 'var(--fx-r0)', 'var(--fx-r4)', 'var(--fx-r3)'][t], big ? .6 : .38, 1000, o);
  fxFlakes(st, run, c.x, my, [2, 5, 8, 26, 30][t], t === 2 ? ['#c3c9c9', '#e1e5e2'] : t === 4 ? ['var(--fx-gold)', 'var(--fx-r4b)', 'var(--fx-r3)'] : t >= 3 ? ['var(--fx-gold)', 'var(--fx-gold2)', 'var(--fx-leaf)'] : ['#b98c4e', '#a8743c'], .9 + t * .1);
  if (big) { fxDrops(st, run, c.x, my, 12, 'var(--zhu)', 1.2); fxWash(st, run, [], false); }
  fxShake(st, [2, 3, 3, 7, 8][t], 300, o);
  await run.wait(260 * k);
  if (big) { run.show(q('.fx-bigseal')); run.snd('seal'); await run.wait(160 * k); fxShake(st, 4, 200, o); }
  // 四、奖励逐个从箱口弹出，落定后数字滚上去
  const chips = [...st.querySelectorAll('.fx-rw')];
  const rolls = [];
  for (const [i, ch] of chips.entries()) {
    run.show(ch);
    const p = fxAt(st, ch), dx = c.x - p.x, dy = my - p.y;
    run.anim(ch, [{ transform: `translate(${dx}px,${dy}px) scale(.25)`, opacity: 0 }, { transform: `translate(${dx * .5}px,${dy * .5 - 60}px) scale(1.1)`, opacity: 1, offset: .45 }, { transform: 'none', opacity: 1 }], { duration: rm ? 160 : 520, easing: 'cubic-bezier(.25,.8,.35,1.15)' });
    run.snd('coin');
    const w = rw[i], a = ch.querySelector('.fx-ra');
    if (w && w.amount != null) rolls.push(run.wait(380 * k).then(() => fxRollRun(a, 0, +w.amount || 0, 520, v => '×' + fxNum(v), run)));
    await run.wait((big ? 260 : 200) * k);
  }
  await Promise.all(rolls);
  return fxClose(st, run, o, '点击收下');
}

// ---------- 4. 蛊师升级 ----------
async function levelUp(host, o = {}) {
  const lv = o.level | 0, rw = o.rewards || [], rm = fxRM(), k = rm ? .35 : 1;
  const { st, run } = fxStage(host, 'fx-lvst', o);
  const title = o.title ? String(o.title) : '';
  st.innerHTML = `<div class="fx-wash"></div><div class="fx-col fx-lv">
<p class="fx-eb fx-pre">蛊师晋升</p>
<div class="fx-lvrow"><span class="fx-lvdi">第</span><span class="fx-lvnum"><span class="fx-lvroll"><b>${Math.max(0, lv - 1)}</b><b>${lv}</b></span></span><span class="fx-lvdi">级</span>${title ? fxSeal(title.slice(0, 4), 'fx-lvseal fx-pre') : ''}</div>
<svg class="fx-stroke" viewBox="0 0 300 22" aria-hidden="true"><path d="M5 12 C4 6 15 4 26 6.5 C72 9.5 150 5.5 228 7.5 C262 8.5 284 6.5 297 10.5 C289 13.5 262 13 232 13.5 C150 14.5 72 17 26 16.5 C13 17.5 5 16.5 5 12 Z" filter="url(#fx-ink)"/></svg>
<ul class="fx-lvrw">${rw.map((w, i) => `<li class="fx-pre" data-i="${i}"><span class="fx-ri">${w.icon == null ? '' : w.icon}</span><span class="fx-rl">${fxEsc(w.label || '')}</span><b class="fx-ra">${w.amount != null ? '+0' : ''}</b></li>`).join('')}</ul>
</div><div class="fx-hint">点击跳过</div>`;
  const q = s => st.querySelector(s), roll = q('.fx-lvroll'), num = q('.fx-lvnum'), row = q('.fx-lvrow');
  run.show(q('.fx-eb'));
  run.anim(row, [{ opacity: 0, scale: .92, filter: 'blur(5px)' }, { opacity: 1, scale: 1, filter: 'blur(0)' }], { duration: rm ? 120 : 380, easing: 'ease-out' });
  await run.wait(420 * k);
  // 期待：旧等级的数字颤一颤
  run.anim(num, [{ translate: '0 0' }, { translate: '0 -3px' }, { translate: '0 1px' }, { translate: '0 -2px' }, { translate: '0 0' }], { duration: 260 });
  run.snd('reelTick');
  await run.wait(300 * k);
  await run.wait(rm ? 0 : 70);   // 顿帧
  // 翻到新等级
  run.anim(roll, [{ transform: 'translateY(0)', easing: 'cubic-bezier(.2,1.5,.4,1)' }, { transform: 'translateY(-50%)' }], { duration: rm ? 120 : 420 });
  run.snd('levelUp');
  const c = fxAt(st, num);
  fxBloom(st, run, c.x, c.y, 360, 'var(--fx-r4)', .4, 1100, o);
  fxWash(st, run, ['var(--fx-w4a)', 'var(--fx-w4b)'], false);
  fxFlakes(st, run, c.x, c.y, 22, ['var(--fx-gold)', 'var(--fx-gold2)', 'var(--fx-leaf)'], 1);
  fxShake(st, 5, 260, o);
  run.anim(num, [{ scale: 1.35 }, { scale: 1 }], { duration: 360, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  run.anim(q('.fx-stroke'), [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], { duration: rm ? 100 : 460, delay: 120 * k, easing: 'cubic-bezier(.4,0,.2,1)' });   // 一笔横扫
  await run.wait(320 * k);
  if (title) { run.show(q('.fx-lvseal')); run.snd('seal'); await run.wait(240 * k); }
  const rows = [...st.querySelectorAll('.fx-lvrw li')], rolls = [];
  for (const li of rows) {
    run.show(li);
    run.anim(li, [{ opacity: 0, transform: 'translateY(14px) scale(.96)' }, { opacity: 1, transform: 'translateY(-3px) scale(1.01)', offset: .6 }, { opacity: 1, transform: 'none' }], { duration: rm ? 120 : 380, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
    run.snd('coin');
    const w = rw[+li.dataset.i], a = li.querySelector('.fx-ra');
    if (w && w.amount != null) rolls.push(fxRollRun(a, 0, +w.amount || 0, 480, v => '+' + fxNum(v), run));
    await run.wait(200 * k);
  }
  await Promise.all(rolls);
  return fxClose(st, run, o, '点击继续');
}

// ---------- 5. 成就弹卡 ----------
const FX_TQ = { box: null, live: [], wait: [] };
function toastAchievement(o = {}) {
  fxDefs();
  return new Promise(res => { FX_TQ.wait.push({ o, res }); fxToastPump(); });
}
function fxToastPump() {
  if (!FX_TQ.box || !FX_TQ.box.isConnected) { FX_TQ.box = fxH('<div class="fx-toasts" aria-live="polite"></div>'); document.body.appendChild(FX_TQ.box); }
  while (FX_TQ.live.length < 3 && FX_TQ.wait.length) fxToastShow(FX_TQ.wait.shift());
}
function fxToastShow({ o, res }) {
  const tier = fxCl(o.tier | 0, 0, 2), hid = !!o.hidden, rm = fxRM();
  const t = fxH(`<div class="fx-toast fx-tt${tier}${hid ? ' fx-hid' : ''}" role="status">${fxSeal(hid ? '秘' : FX_AN[tier], 'fx-tseal')}<div class="fx-tbody"><small>${hid ? '隐藏成就' : '成就'} · ${FX_AN[tier]}</small><b>${fxInk(o.name || '', 240, 45)}</b>${o.desc ? `<p>${fxEsc(o.desc)}</p>` : ''}</div></div>`);
  FX_TQ.box.appendChild(t); FX_TQ.live.push(t);
  fxSnd(o, 'toast', tier);
  if (!rm) t.animate([{ transform: 'translateX(112%)', opacity: 0 }, { transform: 'translateX(-8px)', opacity: 1, offset: .7 }, { transform: 'none', opacity: 1 }], { duration: 440, easing: 'cubic-bezier(.2,.9,.3,1)' });
  if (tier === 2 && !rm) {
    const run = fxRun(o), s = t.querySelector('.fx-tseal');
    setTimeout(() => { if (!t.isConnected) return; const a = fxAt(document.body, s); fxFlakes(document.body, run, a.x, a.y, 9, ['var(--fx-gold)', 'var(--fx-gold2)'], .45); }, 320);
  }
  let gone = false;
  const out = () => {
    if (gone) return; gone = true; clearTimeout(tm);
    const h = t.offsetHeight;
    const a = t.animate([{ opacity: 1, transform: 'none', maxHeight: h + 'px', marginBottom: '8px' }, { opacity: 0, transform: 'translateX(40%)', maxHeight: h + 'px', marginBottom: '8px', offset: .55 }, { opacity: 0, transform: 'translateX(40%)', maxHeight: '0px', marginBottom: '0px' }], { duration: rm ? 120 : 380, easing: 'ease-in', fill: 'forwards' });
    a.onfinish = () => { t.remove(); FX_TQ.live.splice(FX_TQ.live.indexOf(t), 1); res(); fxToastPump(); };
  };
  const tm = setTimeout(out, [3200, 3600, 4400][tier] + (hid ? 700 : 0));
  t.addEventListener('pointerdown', out);
}

// ---------- 6. 功能点亮 · 卷轴展开 ----------
async function unlockReveal(host, o = {}) {
  const rm = fxRM(), k = rm ? .35 : 1;
  const { st, run } = fxStage(host, 'fx-unst', o);
  const name = String(o.name || '');
  st.innerHTML = `<div class="fx-col"><div class="fx-scroll"><i class="fx-rod l"></i><div class="fx-sheet"><span class="fx-ueb">新境开启</span><b class="fx-un fx-pre">${fxInk(name, 0, 80)}</b>${o.line ? `<p class="fx-ul fx-pre">${fxEsc(o.line)}</p>` : ''}${fxSeal('启', 'fx-sm fx-useal fx-pre')}</div><i class="fx-rod r"></i></div></div><div class="fx-hint"></div>`;
  const q = s => st.querySelector(s), sh = q('.fx-sheet'), half = sh.offsetWidth / 2, ease = { duration: rm ? 120 : 560, easing: 'cubic-bezier(.3,.7,.2,1)' };
  run.snd('whoosh');
  run.anim(sh, [{ clipPath: 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0% 0 0%)' }], ease);
  run.anim(q('.fx-rod.l'), [{ transform: `translateX(${half}px)` }, { transform: 'none' }], ease);
  run.anim(q('.fx-rod.r'), [{ transform: `translateX(${-half}px)` }, { transform: 'none' }], ease);
  await run.wait(480 * k);
  run.show(q('.fx-un')); run.snd('unlock');
  await run.wait((160 + [...name].length * 80) * k);
  run.show(q('.fx-useal')); run.snd('seal');
  const s = fxAt(st, q('.fx-useal'));
  fxDrops(st, run, s.x, s.y, 6, 'var(--zhu)', .5);
  fxShake(sh, 2, 180, o);
  await run.wait(140 * k);
  run.show(q('.fx-ul'));
  return fxClose(st, run, Object.assign({ hold: 2600 }, o), '');
}

// ---------- 7. 跳数字、飘字 ----------
function rollNumber(el, from, to, ms = 600, fmt) { return fxRollRun(el, +from || 0, +to || 0, ms, fmt, null); }
function floatText(anchorEl, text, kind = 'info') {
  if (!anchorEl) return Promise.resolve();
  const r = anchorEl.getBoundingClientRect(), f = fxH(`<span class="fx-float fx-f-${fxEsc(kind)}">${fxEsc(text)}</span>`);
  f.style.left = (r.left + r.width / 2 + fxR(-8, 8)) + 'px'; f.style.top = (r.top + r.height * .3) + 'px';
  f.style.setProperty('--rot', fxR(-6, 6).toFixed(1) + 'deg');
  document.body.appendChild(f);
  const a = f.animate(fxRM() ? [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 0 }] : [
    { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
    { transform: 'translate(-50%,-75%) scale(1.2)', opacity: 1, offset: .14 },
    { transform: 'translate(-50%,-90%) scale(1)', opacity: 1, offset: .28 },
    { transform: 'translate(-50%,-250%) scale(.96)', opacity: 0 },
  ], { duration: kind === 'crit' ? 1300 : 1050, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
  return new Promise(res => { a.onfinish = () => { f.remove(); res(); }; });
}

// ---------- 9. 升转演出 ----------
const FX_RANK = ['', '一', '二', '三', '四', '五', '仙'], FX_ZY = ['#a0703f', '#a0703f', '#a4442c', '#9aa4ab', '#d9a441', '#7d62a8', '#d9a441'];   // 真元色，同 core.js ZHENYUAN.colors
async function fuseRankUp(host, o = {}) {
  const r = fxCl(o.rank | 0 || 2, 2, 6), rm = fxRM(), k = rm ? .35 : 1, col = FX_ZY[r], big = r >= 5;
  const { st, run } = fxStage(host, r >= 6 ? 'fx-fuse fx-r4' : 'fx-fuse', o);
  const seal = r >= 6 ? '仙蛊' : FX_RANK[r] + '转', spots = [[-112, -52, -14], [112, -52, 14], [0, 92, 0]];
  st.innerHTML = `<div class="fx-wash"></div><div class="fx-col">
<div class="fx-fpit">${spots.map(([dx, dy]) => `<div class="fx-fz" style="--dx:${dx}px;--dy:${dy}px">${o.artBefore || ''}</div>`).join('')}
<div class="fx-orb fx-pre"><svg viewBox="0 0 200 200" aria-hidden="true"><g filter="url(#fx-sumi)"><circle cx="100" cy="100" r="66" style="fill:${col}" fill-opacity=".9"/><circle cx="100" cy="100" r="52" style="fill:var(--paper)"/><circle cx="100" cy="100" r="40" fill="#1c1915"/></g><path d="M78 92 Q96 70 120 86 Q132 100 116 116 Q100 124 94 108" fill="none" style="stroke:var(--paper)" stroke-width="3" stroke-linecap="round" opacity=".55" filter="url(#fx-ink)"/><g fill="none" stroke="${col}" stroke-linecap="round" filter="url(#fx-ink)"><path d="M100 30 A70 70 0 0 1 168 92" stroke-width="5"/><path d="M100 170 A70 70 0 0 1 32 108" stroke-width="5"/><path d="M60 52 A58 58 0 0 1 150 70" stroke-width="2.4" opacity=".7"/></g></svg></div>
<div class="fx-cardbox fx-pre"><div class="fx-card" style="--rc:${col}"><div class="fx-art">${o.artAfter || ''}</div></div>${fxBigSeal(seal, 'var(--zhu)')}</div></div>
<div class="fx-rkn fx-pre" style="--rcol:${col}"><span>${fxInk(o.name || '', 0, 70)}</span><small>${fxInk(seal, 160, 90)}</small></div></div>
<div class="fx-hint">点击跳过</div>`;
  const q = s => st.querySelector(s), fz = [...st.querySelectorAll('.fx-fz')], orb = q('.fx-orb'), card = q('.fx-cardbox');
  // 一、三只同种依次亮相
  fz.forEach((f, i) => run.anim(f, [{ scale: .5, opacity: 0 }, { scale: 1.06, opacity: 1, offset: .6 }, { scale: 1, opacity: 1 }], { duration: rm ? 100 : 300, delay: i * 70 * k, easing: 'cubic-bezier(.2,.9,.3,1.2)' }));
  run.snd('reelTick'); await run.wait(140 * k); run.snd('reelTick'); await run.wait(140 * k); run.snd('reelTick');
  await run.wait(260 * k);
  // 二、蓄势：往外一缩、一抖
  fz.forEach(f => run.anim(f, [{ transform: 'none' }, { transform: 'scale(.94) rotate(-4deg)' }, { transform: 'scale(.96) rotate(4deg)' }, { transform: 'none' }], { duration: 200 }));
  await run.wait(200 * k);
  // 三、飞向中间（越飞越快），撞进一团墨
  run.snd('whoosh');
  fz.forEach((f, i) => run.anim(f, [{ translate: `${spots[i][0]}px ${spots[i][1]}px`, transform: 'none', opacity: 1 }, { translate: '0px 0px', transform: `scale(.42) rotate(${spots[i][2] * 3}deg)`, opacity: .2 }], { duration: rm ? 120 : 460, delay: i * 45 * k, easing: 'cubic-bezier(.55,0,.85,.4)' }));
  await run.wait(520 * k);
  fz.forEach(f => { f.style.visibility = 'hidden'; });
  run.show(orb);
  const c = fxAt(st, orb);
  fxShake(st, 3, 200, o); fxShards(st, run, c.x, c.y, 10, ['var(--fx-edge)', col], .7);
  run.anim(orb, [{ scale: .3, opacity: 0 }, { scale: 1.08, opacity: 1, offset: .6 }, { scale: 1, opacity: 1 }], { duration: rm ? 100 : 300, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
  const spin = run.anim(orb, [{ rotate: '0deg' }, { rotate: '360deg' }], { duration: 640, iterations: Infinity, fill: 'none' });
  // 四、墨团打转，一下比一下紧（期待段）
  for (let i = 0; i < 3; i++) {
    run.snd('crack', i + 1); fxRing(st, run, c.x, c.y, 150 + i * 30, col);
    run.anim(orb, [{ transform: 'scale(1)' }, { transform: `scale(${1.06 + i * .04})` }, { transform: 'scale(1)' }], { duration: 160 });
    await run.wait((220 - i * 40) * k);
  }
  if (spin) spin.pause();
  await run.wait(rm ? 0 : 85);   // 顿帧
  if (spin) spin.cancel();
  // 五、炸开：墨晕一闪、碎墨、金箔、震屏，新外貌弹出
  run.anim(orb, [{ scale: 1, opacity: 1 }, { scale: 1.7, opacity: 0 }], { duration: 280, easing: 'ease-out' });
  fxBloom(st, run, c.x, c.y, 320 + r * 30, col, .55, 900, o);
  fxShards(st, run, c.x, c.y, 16, ['var(--fx-edge)', 'var(--fx-silk2)', col], 1.3);
  fxFlakes(st, run, c.x, c.y, [0, 0, 6, 10, 18, 24, 34][r], r >= 4 ? ['var(--fx-gold)', 'var(--fx-gold2)', col] : [col, 'var(--fx-gold)'], 1);
  if (big) { fxDrops(st, run, c.x, c.y, 12, 'var(--zhu)', 1.2); fxWash(st, run, r >= 6 ? ['var(--fx-w4a)', 'var(--fx-w4b)'] : ['var(--fx-w3a)', 'var(--fx-w3b)'], false); }
  fxShake(st, [0, 0, 3, 4, 5, 7, 9][r], 300, o);
  run.snd('rarity' + [0, 0, 0, 1, 2, 4, 4][r]);
  run.show(card);
  run.anim(card, [{ transform: 'scale(.5)', opacity: 0, easing: 'cubic-bezier(.2,.9,.3,1.25)' }, { transform: 'translateY(-14px) scale(1.05)', opacity: 1, offset: .5, easing: 'cubic-bezier(.3,0,.2,1)' }, { transform: 'none', opacity: 1 }], { duration: rm ? 160 : 520 });
  await run.wait(380 * k);
  // 六、盖转数印
  run.show(q('.fx-bigseal')); run.snd('seal');
  await run.wait(rm ? 0 : 200);
  fxShake(st, 4, 200, o);
  const s = fxAt(st, q('.fx-bigseal')); fxDrops(st, run, s.x, s.y, 7, 'var(--zhu)', .6);
  run.show(q('.fx-rkn'));
  return fxClose(st, run, o, '点击收下');
}

// ---------- 8. 音色（WebAudio 合成；古琴拨弦、磬、编钟、锣、木鱼、钱币）----------
const FX_QIN = [130.8, 146.8, 164.8, 196, 220, 261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784, 880];   // 宫商角徵羽
const FX_BUF = new WeakMap();
const FX_QING = [[1, 1, 1], [2.76, .42, .55], [5.4, .18, .3], [8.93, .08, .2]];                               // 磬：石片的非谐泛音
const FX_ZHONG = [[.5, .3, 1.3], [1, 1, 1], [1.19, .45, .8], [1.5, .28, .7], [2, .26, .6], [2.98, .12, .4], [4.1, .06, .3]];   // 编钟
function fxBufs(ctx) { let m = FX_BUF.get(ctx); if (!m) FX_BUF.set(ctx, m = { ks: {} }); return m; }
function fxNoiseBuf(ctx) {
  const m = fxBufs(ctx); if (m.noise) return m.noise;
  const len = ctx.sampleRate | 0, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return (m.noise = b);
}
function fxKs(ctx, f) {   // Karplus-Strong 拨弦（与 ui.js 的琴声同一算法）
  const m = fxBufs(ctx), key = Math.round(f); if (m.ks[key]) return m.ks[key];
  const sr = ctx.sampleRate, len = Math.floor(sr * 1.8), buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0), N = Math.max(2, Math.round(sr / f)), ring = new Float32Array(N);
  for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
  for (let i = 0, j = 0; i < len; i++) { const nx = (j + 1) % N, v = ring[j]; d[i] = v * (i < 40 ? i / 40 : 1); ring[j] = 0.4985 * (v + ring[nx]); j = nx; }
  return (m.ks[key] = buf);
}
function fxPluck(ctx, t, out, f, vol = .28, lp = 2400) {
  const s = ctx.createBufferSource(), g = ctx.createGain(), l = ctx.createBiquadFilter();
  s.buffer = fxKs(ctx, f); l.type = 'lowpass'; l.frequency.value = lp; g.gain.value = vol; s.connect(l).connect(g).connect(out); s.start(t);
}
function fxTone(ctx, t, out, f, vol, dur, type = 'sine', f2) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, vol), t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + .03);
}
const fxBell = (ctx, t, out, f0, vol, dur, parts) => parts.forEach(([r, a, d = 1]) => fxTone(ctx, t, out, f0 * r, vol * a, dur * d));
function fxNz(ctx, t, out, dur, type, freq, vol, q = 1, f2) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = fxNoiseBuf(ctx); f.type = type; f.frequency.setValueAtTime(freq, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur); f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f).connect(g).connect(out); s.start(t, Math.random() * .5); s.stop(t + dur + .03);
}
function fxGong(ctx, t, out, vol = .6, f0 = 180, dur = 2.6) {   // 锣：一槌下去先闷后亮，音高往下走
  fxNz(ctx, t, out, .12, 'lowpass', 1400, vol * .45);
  [1, 1.47, 1.98, 2.52, 3.11, 3.74, 4.38, 5.2].forEach((r, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = f0 * r * (1 + (Math.random() - .5) * .01), a = vol * .2 / (1 + i * .45), sw = i > 2 ? .1 + i * .03 : .006;
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * .955, t + dur * .7);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(a, t + sw); g.gain.exponentialRampToValueAtTime(.0001, t + dur * (1 - i * .07));
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + .05);
  });
}
const SFX = {
  coin: (c, t, o) => { fxBell(c, t, o, 2350, .11, .35, [[1, 1], [1.51, .6], [2.37, .35]]); fxBell(c, t + .045, o, 2780, .05, .3, [[1, 1], [1.51, .5]]); },
  reelTick: (c, t, o) => { fxNz(c, t, o, .02, 'bandpass', 2400, .5, 4); fxTone(c, t, o, 1250, .05, .03); },
  reelStop: (c, t, o, k = 0) => { fxTone(c, t, o, 540 * (1 + .12 * (k || 0)), .3, .1); fxNz(c, t, o, .035, 'bandpass', 1300, .26, 2.5); fxTone(c, t, o, 150, .18, .14, 'sine', 70); },
  jackpot: (c, t, o) => { fxGong(c, t, o, .7, 170, 2.8); for (let i = 0; i < 7; i++) SFX.coin(c, t + .08 + i * .07 + Math.random() * .03, o); [5, 7, 9, 12].forEach((n, i) => fxPluck(c, t + .05 + i * .06, o, FX_QIN[n], .2)); },
  crack: (c, t, o, k = 0) => { let tt = t; for (let i = 0; i < 5; i++) { fxNz(c, tt, o, fxR(.006, .016), 'highpass', fxR(2800, 4800), fxR(.16, .32)); tt += fxR(.006, .024); } fxTone(c, t, o, 260 * Math.pow(1.122, k || 0), .13, .07); },
  rarity0: (c, t, o) => fxBell(c, t, o, 587, .11, .9, FX_QING),
  rarity1: (c, t, o) => { fxBell(c, t, o, 587, .1, .9, FX_QING); fxBell(c, t + .1, o, 784, .1, 1.1, FX_QING); },
  rarity2: (c, t, o) => { [587, 784, 880].forEach((f, i) => fxBell(c, t + i * .08, o, f, .1, 1.2, FX_QING)); fxBell(c, t + .24, o, 1175, .06, 1.6, FX_ZHONG); },
  rarity3: (c, t, o) => { fxGong(c, t, o, .35, 210, 2); fxBell(c, t, o, 294, .15, 2.4, FX_ZHONG); fxBell(c, t + .02, o, 440, .11, 2.2, FX_ZHONG); [7, 9, 11, 13].forEach((n, i) => fxPluck(c, t + .12 + i * .07, o, FX_QIN[n], .2)); },
  rarity4: (c, t, o) => { fxGong(c, t, o, .8, 160, 3.2); [262, 330, 392].forEach((f, i) => fxBell(c, t + .04 + i * .05, o, f, .12, 2.8, FX_ZHONG)); [5, 7, 9, 10, 12, 14].forEach((n, i) => fxPluck(c, t + .1 + i * .06, o, FX_QIN[n], .22)); for (let i = 0; i < 6; i++) SFX.coin(c, t + .45 + i * .09, o); },
  levelUp: (c, t, o) => { [0, 2, 4, 5, 7, 9, 12].forEach((n, i) => fxPluck(c, t + i * .055, o, FX_QIN[n], .27)); fxGong(c, t + .42, o, .55, 190, 2.4); },
  toast: (c, t, o, k = 0) => { fxBell(c, t, o, 1318 * (k === 2 ? 1.122 : 1), .07, .7, FX_QING); fxBell(c, t + .07, o, 1760, .045, .6, FX_QING); },
  chestThud: (c, t, o, k = 0) => { fxTone(c, t, o, 96, .5, .2, 'sine', 42); fxNz(c, t, o, .07, 'bandpass', 380, .3, 1.2); fxNz(c, t + .045, o, .02, 'bandpass', 3200, .07 + .02 * Math.min(k || 0, 3), 6); },
  seal: (c, t, o) => { fxTone(c, t, o, 190, .3, .09, 'sine', 90); fxNz(c, t, o, .05, 'lowpass', 1100, .25); },
  miss: (c, t, o) => { fxPluck(c, t, o, FX_QIN[7], .22, 1600); fxPluck(c, t + .14, o, FX_QIN[5], .18, 1200); },
  unlock: (c, t, o) => { [5, 7, 9].forEach((n, i) => fxPluck(c, t + i * .09, o, FX_QIN[n], .25)); fxBell(c, t + .27, o, 1175, .07, 1.2, FX_QING); },
  whoosh: (c, t, o) => fxNz(c, t, o, .38, 'bandpass', 500, .3, 1.2, 2200),
};

// ---- src/combo-fx.js（包一层，只放出 export）
const { COMBO_FX, playCombo, drawComboFrame, comboSheet } = (() => {
// 蛊码 GuCode · 杀招动画。每个杀招一份「配方」：几层基础特效（火浪、雷霆、剑雨、毒雾、金钟罩、残影、漩涡、冰封、血流、风刃、地刺、光柱……）
// 按时间叠起来，加镜头（推、拉、摇、震）和逐笔写出的招式名。画面是时间的纯函数：同一时刻画出来永远一样，所以总览图能直接按关键帧画。
// 对外：playCombo(stage, o) → Promise；comboSheet(el, o) 画总览；COMBO_FX 配方表。
const TAU = Math.PI * 2;
const cl = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const eo = t => 1 - Math.pow(1 - t, 3), ei = t => t * t * t, eio = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const env = (p, a, b) => cl(p < a ? p / a : p > 1 - b ? (1 - p) / b : 1);
function rngOf(seed) { let s = seed >>> 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hashOf = str => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rgba = (h, a) => { if (!h || h[0] !== '#') return h || 'rgba(0,0,0,0)'; let n = h.slice(1); if (n.length === 3) n = n.replace(/./g, '$&$&'); const v = parseInt(n, 16); return `rgba(${v >> 16 & 255},${v >> 8 & 255},${v & 255},${cl(a)})`; };
const C = (R, v, i = 0) => typeof v === 'string' ? v : (R.c[v == null ? i : v] || R.c[R.c.length - 1]);
let KAI = '"Kaiti SC","STKaiti","KaiTi","BiauKai",serif';
const kaiFont = () => { try { const v = getComputedStyle(document.documentElement).getPropertyValue('--kai').trim(); if (v) KAI = v; } catch (e) { /* 没有样式表时用默认楷体 */ } return KAI; };

// ---------- 场景锚点 ----------
const cen = (L, S) => L && L.length ? { x: L.reduce((a, t) => a + t.x, 0) / L.length, y: L.reduce((a, t) => a + t.y, 0) / L.length } : { x: S.w * (S.dir > 0 ? 0.72 : 0.28), y: S.h * 0.55 };
function pts(S, k) {
  const byFront = () => S.foes.slice().sort((a, b) => Math.abs(a.x - S.w / 2) - Math.abs(b.x - S.w / 2));
  switch (k) {
    case 'from': return [S.from];
    case 'tg': return [S.targets[0] || cen(S.foes, S)];
    case 'tgs': return S.targets.length ? S.targets : S.foes;
    case 'foes': return S.foes;
    case 'allies': return S.allies;
    case 'foeC': return [cen(S.foes, S)];
    case 'allyC': return [cen(S.allies, S)];
    case 'mid': return [{ x: S.w / 2, y: S.h * 0.52 }];
    case 'front': return byFront().slice(0, 1);
    case 'front2': return byFront().slice(0, 2);
    case 'foeBack': return byFront().slice(-1);
    case 'ally': return [S.allies.find(a => a !== S.from && (a.x !== S.from.x || a.y !== S.from.y)) || S.from];
    default: return [S.from];
  }
}
const pt1 = (S, k) => pts(S, k)[0] || S.from;

// ---------- 画笔小工具 ----------
function fillAll(g, S, c, a) { if (a <= 0) return; g.fillStyle = rgba(c, a); g.fillRect(-S.w, -S.h, S.w * 3, S.h * 3); }
function radial(g, x, y, r, col, a) { if (r <= 0.5 || a <= 0) return; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
function line(g, L) { g.beginPath(); L.forEach((q, i) => i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); }
// 毛笔：沿折线一路盖圆点，两头收锋；p0..p1 只画其中一段（用来做「一笔一笔写出来」）
function brush(g, P, w, col, a = 1, p0 = 0, p1 = 1, taper = 0.5) {
  if (p1 <= p0 || P.length < 2 || a <= 0) return;
  const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y));
  const tot = L[L.length - 1]; if (!tot) return; const step = Math.max(0.8, w * 0.22); let j = 1;
  g.fillStyle = rgba(col, a); g.beginPath();
  for (let d = p0 * tot; d <= p1 * tot; d += step) {
    while (j < L.length - 1 && L[j] < d) j++;
    const f = (d - L[j - 1]) / (L[j] - L[j - 1] || 1), x = lerp(P[j - 1].x, P[j].x, f), y = lerp(P[j - 1].y, P[j].y, f), u = d / tot;
    const r = w / 2 * (taper ? Math.pow(Math.max(0.06, Math.sin(Math.PI * u)), taper) : 1);
    g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU);
  }
  g.fill();
}
const qbez = (a, b, c, t) => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * b.x + t * t * c.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * b.y + t * t * c.y });
// 折线抖动：固定消耗 n-1 次随机数，保证每一帧同一条闪电长得一样
function jag(a, b, n, amp, r) { const L = [a], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len; for (let i = 1; i < n; i++) { const t = i / n, o = (r() - 0.5) * 2 * amp; L.push({ x: a.x + dx * t + nx * o, y: a.y + dy * t + ny * o }); } L.push(b); return L; }
function wav(x0, y0, x1, y1, n, amp, r) { const L = []; for (let i = 0; i <= n; i++) { const t = i / n; L.push({ x: lerp(x0, x1, t), y: lerp(y0, y1, t) + (r() - 0.5) * 2 * amp }); } return L; }
function flame(g, x, y, w, h, c1, c2, a) { if (h < 1 || a <= 0) return; const gr = g.createLinearGradient(x, y, x, y - h); gr.addColorStop(0, rgba(c2, a)); gr.addColorStop(0.5, rgba(c1, a * 0.8)); gr.addColorStop(1, rgba(c1, 0)); g.fillStyle = gr; g.beginPath(); g.moveTo(x - w / 2, y); g.quadraticCurveTo(x - w * 0.6, y - h * 0.5, x, y - h); g.quadraticCurveTo(x + w * 0.6, y - h * 0.5, x + w / 2, y); g.closePath(); g.fill(); }
function star(g, x, y, s, col, a) { if (s <= 0 || a <= 0) return; g.fillStyle = rgba(col, a); g.beginPath(); for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4 - Math.PI / 2, rr = k % 2 ? s * 0.28 : s; k ? g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr) : g.moveTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); } g.closePath(); g.fill(); }
function hex(g, x, y, s) { g.beginPath(); for (let k = 0; k <= 6; k++) { const an = k * TAU / 6; k ? g.lineTo(x + Math.cos(an) * s, y + Math.sin(an) * s * 0.6) : g.moveTo(x + Math.cos(an) * s, y + Math.sin(an) * s * 0.6); } g.stroke(); }
function bug(g, x, y, s, col, a, dir = 1) {
  if (a <= 0.01) return; g.save(); g.translate(x, y); g.scale(dir, 1); g.fillStyle = rgba(col, a); g.strokeStyle = rgba(col, a); g.lineWidth = Math.max(1, s * 0.035);
  g.beginPath(); g.ellipse(-s * 0.05, 0, s * 0.32, s * 0.2, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(s * 0.3, -s * 0.04, s * 0.12, 0, TAU); g.fill();
  g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(k * s * 0.12, s * 0.1); g.lineTo(k * s * 0.16 - s * 0.05, s * 0.28); } g.moveTo(s * 0.38, -s * 0.1); g.lineTo(s * 0.5, -s * 0.26); g.stroke(); g.restore();
}
function ant(g, x, y, s, col, a, dir = 1) { g.save(); g.translate(x, y); g.scale(dir, 1); g.fillStyle = rgba(col, a); g.strokeStyle = rgba(col, a); g.lineWidth = 1; [[-0.3, 0.16], [0, 0.11], [0.26, 0.12]].forEach(([u, r]) => { g.beginPath(); g.ellipse(u * s, 0, r * s, r * s * 0.75, 0, 0, TAU); g.fill(); }); g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(k * s * 0.08, 0); g.lineTo(k * s * 0.14, s * 0.2); g.moveTo(k * s * 0.08, 0); g.lineTo(k * s * 0.14, -s * 0.2); } g.stroke(); g.restore(); }
function creature(g, x, y, ang, s, kind, col, a, p) {
  if (a <= 0) return; g.save(); g.translate(x, y); g.rotate(ang); g.strokeStyle = rgba(col, a); g.fillStyle = rgba(col, a); g.lineWidth = 1.4;
  if (kind === 'cent') for (let k = 0; k < 7; k++) { const sx = -k * s * 0.16, sy = Math.sin(p * 30 - k * 0.9) * s * 0.05; g.beginPath(); g.ellipse(sx, sy, s * 0.09, s * 0.06, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(sx, sy - s * 0.05); g.lineTo(sx - s * 0.04, sy - s * 0.15); g.moveTo(sx, sy + s * 0.05); g.lineTo(sx - s * 0.04, sy + s * 0.15); g.stroke(); }
  else { g.beginPath(); g.ellipse(0, 0, s * 0.22, s * 0.12, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-s * 0.2, 0); g.quadraticCurveTo(-s * 0.55, 0, -s * 0.5, -s * 0.25); g.quadraticCurveTo(-s * 0.4, -s * 0.38, -s * 0.28, -s * 0.28); g.moveTo(s * 0.2, -s * 0.06); g.lineTo(s * 0.38, -s * 0.16); g.moveTo(s * 0.2, s * 0.06); g.lineTo(s * 0.38, s * 0.16); g.stroke(); }
  g.restore();
}

// ---------- 招式名：一笔一笔写出来 ----------
// 先把字画到小画布上，按连通的笔画块分开（先上后下、先左后右），每块从左上角起笔、沿着笔画内部的距离往外长，
// 这样一横是从左往右写，一撇是顺着撇的方向写，拐弯的笔画也会跟着拐。
const NAMES = new Map();
function strokeOrder(A, S) {
  const N = S * S, ink = new Uint8Array(N), lab = new Int32Array(N).fill(-1), d = new Float32Array(N).fill(-1), v = new Float32Array(N).fill(2), q = new Int32Array(N), comps = [];
  for (let i = 0; i < N; i++) ink[i] = A[i] > 90 ? 1 : 0;
  const nb = (j, f) => { const x = j % S, y = (j / S) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < S && yy < S) f(yy * S + xx); } };
  for (let i = 0; i < N; i++) {
    if (!ink[i] || lab[i] >= 0) continue;
    let h = 0, t = 0, best = i, bk = 1e9; const px = [], id = comps.length; q[t++] = i; lab[i] = id;
    while (h < t) { const j = q[h++]; px.push(j); const k = ((j / S) | 0) + (j % S) * 0.6; if (k < bk) { bk = k; best = j; } nb(j, n => { if (ink[n] && lab[n] < 0) { lab[n] = id; q[t++] = n; } }); }
    comps.push({ px, start: best, key: ((best / S) | 0) + (best % S) * 0.5 });
  }
  comps.sort((a, b) => a.key - b.key);
  let total = 0;
  comps.forEach(c => { let h = 0, t = 0, mx = 0; q[t++] = c.start; d[c.start] = 0; while (h < t) { const j = q[h++]; nb(j, n => { if (ink[n] && d[n] < 0) { d[n] = d[j] + 1; if (d[n] > mx) mx = d[n]; q[t++] = n; } }); } c.off = total; c.len = mx + 1; total += c.len + 3; });
  total = Math.max(1, total);
  comps.forEach(c => c.px.forEach(j => { v[j] = (c.off + d[j]) / total; }));
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) { if (!A[i] || v[i] <= 1) continue; let m = 2; nb(i, n => { if (v[n] < m) m = v[n]; }); if (m <= 1) v[i] = m; }
  for (let i = 0; i < N; i++) if (A[i] && v[i] > 1) v[i] = 1;
  return { v, len: total };
}
function prepName(name, size) {
  const key = name + '|' + size; if (NAMES.has(key)) return NAMES.get(key);
  const font = kaiFont(), S = Math.ceil(size * 1.18), chars = [];
  for (const ch of name) {
    const cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d', { willReadFrequently: true });
    g.font = `${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(ch, S / 2, S / 2 + size * 0.03);
    const raw = g.getImageData(0, 0, S, S).data, A = new Uint8Array(S * S); for (let i = 0; i < S * S; i++) A[i] = raw[i * 4 + 3];
    const o = strokeOrder(A, S); chars.push({ cv, g, A, v: o.v, len: o.len, img: g.createImageData(S, S), t: -1 });
  }
  const o = { chars, S, size }; NAMES.set(key, o); if (NAMES.size > 80) NAMES.delete(NAMES.keys().next().value); return o;
}
function renderChar(c, t) {
  if (c.t === t) return; c.t = t; const { A, v, img } = c, D = img.data;
  for (let i = 0; i < A.length; i++) { const a = A[i], k = i * 4; if (!a) { D[k + 3] = 0; continue; } const m = cl((t - v[i]) / 0.03); D[k] = 26; D[k + 1] = 22; D[k + 2] = 18; D[k + 3] = a * m; }
  c.g.putImageData(img, 0, 0);
}
const nameSize = (S, n) => Math.round(Math.max(18, Math.min(S.w > 500 ? 56 : 48, S.w * 0.82 / (n * 1.015 + 1.25))));
function nameTimes(R, n) { const nm = R.nm, wd = 140 * n + 260, seal = nm + 120 + wd; return { nm, wd, seal, total: Math.max(R.dur, seal + 600) }; }
function drawName(g, NM, cx, cy, T, TL, R) {
  if (T < TL.nm) return;
  const { chars, S, size } = NM, n = chars.length, W = n * S * 0.86 + size * 1.25, H = size * 1.42;
  const strip = eo(cl((T - TL.nm) / 180)), write = cl((T - TL.nm - 120) / TL.wd), seal = cl((T - TL.seal) / 220), a = cl((TL.total - T) / 260);
  const sw = W * strip; if (sw < 2 || a <= 0) return;
  g.save(); g.globalAlpha = a;
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(cx - sw / 2 + 3, cy - H / 2 + 4, sw, H);
  const r = rngOf(hashOf(R.id) + 5); g.fillStyle = '#efe6d0'; g.beginPath();
  for (let i = 0; i <= 12; i++) { const x = cx - sw / 2 + sw * i / 12; g[i ? 'lineTo' : 'moveTo'](x, cy - H / 2 + r() * 3); }
  for (let i = 12; i >= 0; i--) { const x = cx - sw / 2 + sw * i / 12; g.lineTo(x, cy + H / 2 - r() * 3); }
  g.closePath(); g.fill();
  if (R.adv) { g.strokeStyle = '#c99a3a'; g.lineWidth = 2; g.strokeRect(cx - sw / 2 + 4, cy - H / 2 + 5, sw - 8, H - 10); }
  g.beginPath(); g.rect(cx - sw / 2, cy - H / 2, sw, H); g.clip();
  const tot = chars.reduce((s, c) => s + c.len, 0); let acc = 0, x = cx - W / 2 + size * 0.3;
  chars.forEach(c => { renderChar(c, cl((write * tot - acc) / c.len)); acc += c.len; g.drawImage(c.cv, x, cy - S / 2); x += S * 0.86; });
  if (seal > 0) {
    const s = size * 0.6, k = 1 + 0.8 * (1 - eo(seal)); g.save(); g.translate(cx + W / 2 - size * 0.55, cy + size * 0.12); g.scale(k, k); g.rotate(-0.06); g.globalAlpha = a * cl(seal * 2);
    g.fillStyle = '#b5301f'; g.fillRect(-s / 2, -s / 2, s, s); g.fillStyle = '#efe6d0'; g.font = `${Math.round(s * 0.72)}px ${KAI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(R.seal || '杀', 0, s * 0.04); g.restore();
  }
  g.restore();
}

// ---------- 基础特效（每个都是 (画笔, 进度 0..1, 参数, 场景, 配方, 随机数) → 画一帧） ----------
// 随机数每一帧都从同一个种子重新开始，所以粒子位置只跟进度有关；循环里随机数要在 continue 之前取完。
const PR = {
  dim(g, p, P, S) { fillAll(g, S, P.c || '#07060a', (P.a ?? 0.4) * env(p, 0.12, 0.2)); },
  flash(g, p, P, S) { const n = P.n || 1, q = p * n, k = Math.floor(q); if (k >= n) return; fillAll(g, S, P.c || '#ffffff', (P.a ?? 0.8) * (S.reduce ? 0.15 : 1) * Math.pow(1 - (q - k), 2)); },
  mono(g, p, P, S) { const a = env(p, 0.04, 0.15); fillAll(g, S, '#7a7a7a', 0.22 * a); if (a > 0.5) S.mono = 1; },
  split(g, p, P, S, R) {
    const a = (P.a ?? 0.3) * env(p, 0.2, 0.25), m = S.w / 2;
    g.fillStyle = rgba(C(R, P.c, 0), a); g.fillRect(-S.w, -S.h, m + S.w, S.h * 3); g.fillStyle = rgba(C(R, P.c2, 1), a); g.fillRect(m, -S.h, S.w * 2, S.h * 3);
    brush(g, [{ x: m, y: -10 }, { x: m, y: S.h + 10 }], 3, '#ffffff', a * 2, 0, eo(cl(p * 3)), 0);
  },
  // 力：火影冲阵
  charge(g, p, P, S, R, r) {
    const n = P.n || 3, gap = P.gap ?? 0.15, len = P.len ?? 0.4, L = pts(S, P.at || 'tgs');
    for (let i = 0; i < n; i++) {
      const t = L[i % L.length], jit = r(), lp = (p - i * gap) / len; if (lp < 0 || lp > 1.3) continue;
      const xa = S.dir > 0 ? -S.u : S.w + S.u, xb = S.dir > 0 ? S.w + S.u : -S.u, y = t.y + (jit - 0.5) * S.u * 0.3, hx = lerp(xa, xb, eio(cl(lp))), fade = cl(1.3 - lp);
      for (let k = 12; k >= 0; k--) { const x = hx - S.dir * k * S.u * 0.18; g.fillStyle = rgba(k < 4 ? C(R, P.c2, 1) : C(R, P.c, 0), (1 - k / 13) * 0.7 * fade); g.beginPath(); g.ellipse(x, y - k * 0.6, S.u * (0.32 - k * 0.018), S.u * (0.2 - k * 0.01), 0, 0, TAU); g.fill(); }
      bug(g, hx, y, S.u * 0.7, '#1c1915', 0.85 * fade, S.dir);
    }
  },
  scorch(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'tgs'), n = P.n || 3, a = env(p, 0.1, 0.25) * 0.55;
    for (let i = 0; i < n; i++) { const t = L[i % L.length], y = t.y + S.u * 0.4 + (r() - 0.5) * 6, x0 = S.w * (S.dir > 0 ? 0.52 : 0.48), x1 = S.dir > 0 ? S.w - 4 : 4; brush(g, wav(x0, y, x1, y, 6, 2, r), S.u * 0.12, P.c || '#2a1a10', a, 0, eo(cl(p * 2.5 - i * 0.2)), 0.4); }
  },
  drum(g, p, P, S, R) {
    const A = pt1(S, P.at || 'mid'), s0 = (P.s || 1.3) * S.u, appear = eo(cl(p / 0.25)); let pulse = 0;
    (P.beats || [0.35, 0.6, 0.78]).forEach(b => { if (p >= b) pulse = Math.max(pulse, Math.exp(-(p - b) * 18)); });
    const s = s0 * (0.35 + 0.65 * appear) * (1 + 0.14 * pulse), y = A.y - (P.lift ?? 1.1) * S.u;
    g.save(); g.globalAlpha = env(p, 0.08, 0.15); g.translate(A.x, y); g.fillStyle = C(R, P.c, 0); g.strokeStyle = '#1c1915'; g.lineWidth = Math.max(1.5, s * 0.05);
    g.beginPath(); g.moveTo(-s / 2, 0); g.lineTo(-s / 2, s * 0.45); g.ellipse(0, s * 0.45, s / 2, s * 0.16, 0, Math.PI, 0, true); g.lineTo(s / 2, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#efe6d0'; g.beginPath(); g.ellipse(0, 0, s / 2, s * 0.16, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#1c1915'; for (let k = 0; k < 7; k++) { const an = Math.PI * (k + 0.5) / 7; g.beginPath(); g.arc(Math.cos(an) * s * 0.49, s * 0.1 + Math.sin(an) * s * 0.06, s * 0.025, 0, TAU); g.fill(); }
    if (pulse > 0.05) { g.fillStyle = rgba('#ffffff', 0.7 * pulse); g.beginPath(); g.ellipse(0, 0, s * 0.4, s * 0.12, 0, 0, TAU); g.fill(); }
    g.restore();
  },
  rings(g, p, P, S, R) {
    const A = pt1(S, P.at || 'allyC'), Rm = (P.R || 3) * S.u, col = C(R, P.c, 1);
    (P.ts || [0.35, 0.6, 0.78]).forEach(b => { const q = (p - b) / (P.life || 0.3); if (q < 0 || q > 1) return; const rr = lerp(S.u * 0.3, Rm, eo(q)); g.strokeStyle = rgba(col, (1 - q) * 0.85); g.lineWidth = lerp(S.u * 0.16, 1, q); g.beginPath(); g.ellipse(A.x, A.y + S.u * 0.3, rr, rr * (P.flat ?? 0.42), 0, 0, TAU); g.stroke(); });
  },
  glow(g, p, P, S, R) {
    const L = pts(S, P.at || 'allies'), a = env(p, 0.25, 0.3), col = C(R, P.c, 0);
    L.forEach((t, i) => {
      const q = cl(p * 2 - i * 0.1); g.save(); g.globalCompositeOperation = 'lighter'; radial(g, t.x, t.y, S.u * 0.75, col, 0.55 * a * q); g.restore();
      if (P.stripe) brush(g, [{ x: t.x - S.u * 0.3, y: t.y + S.u * 0.2 }, { x: t.x + S.u * 0.3, y: t.y - S.u * 0.3 }], S.u * 0.08, col, a, 0, q);
    });
  },
  swarm(g, p, P, S, R, r) {
    const n = P.n || 160, c = C(R, P.c, 1), fc = P.burn ? '#f0a040' : null;
    const st = P.start === 'br' ? { x: S.w + 20, y: S.h + 10 } : { x: S.dir > 0 ? -20 : S.w + 20, y: S.h * 0.8 }, en = { x: S.dir > 0 ? S.w + 40 : -40, y: S.h * 0.25 }, mid = cen(S.foes, S);
    if (P.start === 'br') en.x = -40;
    for (let i = 0; i < n; i++) {
      const d = r() * 0.35, ox = (r() - 0.5) * S.u * 2.2, oy = (r() - 0.5) * S.u * 1.4, ph = r() * TAU, sz = 1 + r() * 2, q = p * 1.35 - d; if (q < 0 || q > 1) continue;
      const pos = qbez(st, mid, en, q), x = pos.x + ox * Math.sin(q * Math.PI) + Math.sin(p * 30 + ph) * 3, y = pos.y + oy * Math.sin(q * Math.PI) + Math.cos(p * 26 + ph) * 3;
      g.fillStyle = rgba(fc && q > 0.35 ? fc : c, 0.85); g.fillRect(x, y, sz, sz); if (fc && q > 0.35) radial(g, x, y, 5, '#e2672e', 0.25);
    }
  },
  stain(g, p, P, S, R) { const L = pts(S, P.at || 'foes'), a = (P.a ?? 0.35) * env(p, P.in ?? 0.3, 0.2), col = C(R, P.c, 0), k = P.s || 1; L.forEach(t => { g.fillStyle = rgba(col, a); g.beginPath(); g.ellipse(t.x, t.y + S.u * 0.45, S.u * 0.75 * k, S.u * 0.24 * k, 0, 0, TAU); g.fill(); }); },
  // 炎：火球炸开
  burst(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'tg'), c1 = C(R, P.c, 0), c2 = C(R, P.c2, 1), b = P.b ?? 0.35, n = P.n || 14, Rm = (P.R || 2.4) * S.u, q = (p - b) / (1 - b);
    g.save(); g.globalCompositeOperation = 'lighter';
    if (p < b + 0.05) { const s = S.u * (0.15 + 0.45 * eo(cl(p / b))) * (1 + 0.08 * Math.sin(p * 60)); radial(g, A.x, A.y, s, c1, 0.95); radial(g, A.x, A.y, s * 0.55, '#fff3c0', 0.9); }
    for (let i = 0; i < n; i++) { const ang = (i / n) * TAU + r() * 0.4, len = Rm * (0.6 + 0.5 * r()); if (q <= 0) continue; const L0 = len * eo(cl(q * 2)); brush(g, [A, { x: A.x + Math.cos(ang) * L0, y: A.y + Math.sin(ang) * L0 * 0.6 }], S.u * 0.44 * (1 - q), i % 2 ? c1 : c2, 0.8 * (1 - q), 0, 1, 0.8); }
    g.restore();
  },
  embers(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'foes'), n = P.n || 40, c = C(R, P.c, 1), up = P.up ? -1 : 1;
    for (let i = 0; i < n; i++) { const t = L[i % L.length], ox = (r() - 0.5) * S.u * 2, d = r() * 0.5, sp = 0.5 + r(), q = (p - d) / (1 - d); if (q < 0) continue; const x = t.x + ox + Math.sin(q * 9 + i) * 4, y = t.y + (up < 0 ? S.u * 0.3 : -S.u) + up * q * S.u * 1.8 * sp; g.fillStyle = rgba(c, (1 - q) * 0.9); g.fillRect(x, y, 2, 2); }
  },
  sun(g, p, P, S, R, r) {
    const c = C(R, P.c, 0), x = S.w * (P.x ?? (S.dir > 0 ? 0.72 : 0.28)), rise = P.rise ?? 0.45, y = lerp(S.h * 0.38, S.h * (P.y ?? 0.1), eo(cl(p / rise))), rad = S.u * (P.s || 0.55), a = env(p, 0.05, 0.15);
    g.save(); g.globalCompositeOperation = 'lighter'; radial(g, x, y, rad * 3, c, 0.4 * a); g.restore(); g.fillStyle = rgba('#fff6dc', a); g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    const L = pts(S, 'foes'), n = P.rays || 0;
    for (let i = 0; i < n; i++) { const t = L[i % L.length], ox = (r() - 0.5) * S.u * 1.6, d = rise + r() * (0.85 - rise), lq = (p - d) / 0.12; if (lq < 0 || lq > 1.5) continue; const tx = t.x + ox, ty = t.y + S.u * 0.3; g.strokeStyle = rgba('#fff2c0', 0.9 * cl(1.5 - lq)); g.lineWidth = 1.5; g.beginPath(); g.moveTo(lerp(x, tx, cl(lq - 0.35)), lerp(y, ty, cl(lq - 0.35))); g.lineTo(lerp(x, tx, cl(lq)), lerp(y, ty, cl(lq))); g.stroke(); }
  },
  eclipse(g, p, P, S, R) {
    const x = S.w * 0.62, y = S.h * 0.16, rad = S.u * 0.62, a = env(p, 0.08, 0.15), q = eo(cl(p / 0.45));
    fillAll(g, S, '#020203', 0.5 * a * q); g.fillStyle = rgba('#f4efe0', a * 0.9); g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    g.fillStyle = rgba('#050505', a); g.beginPath(); g.arc(lerp(S.w * 1.1, x, q), lerp(-S.u, y, q), rad, 0, TAU); g.fill();
    if (q > 0.85) { g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(C(R, P.c2, 1), a * (q - 0.85) / 0.15); g.lineWidth = 3; g.shadowColor = '#e0e0f0'; g.shadowBlur = 12; g.beginPath(); g.arc(x, y, rad * 1.05, 0, TAU); g.stroke(); g.restore(); }
  },
  haze(g, p, P, S, R) {
    const c = cen(S.foes, S), a = 0.4 * env(p, 0.2, 0.2); g.strokeStyle = rgba(C(R, P.c, 1), a); g.lineWidth = 1.2;
    for (let k = 0; k < 6; k++) { const y = c.y + S.u * (0.6 - k * 0.3); g.beginPath(); for (let i = 0; i <= 40; i++) { const x = c.x - S.u * 2.4 + i * S.u * 0.12, yy = y + Math.sin(x * 0.12 + p * 20 + k) * 2.5; i ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke(); }
  },
  carpet(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'foes'), n = P.n || 10, a = env(p, P.in ?? 0.06, 0.25), hk = P.h || 1; g.save(); g.globalCompositeOperation = 'lighter';
    L.forEach(t => { for (let i = 0; i < n; i++) { const ox = (r() - 0.5) * S.u * 1.3, ph = r() * TAU, h = S.u * hk * (0.25 + 0.25 * r()) * (0.75 + 0.25 * Math.sin(p * 25 + ph)); flame(g, t.x + ox, t.y + S.u * 0.45, h * 0.45, h, C(R, P.c, 0), C(R, P.c2, 1), 0.75 * a); } });
    g.restore();
  },
  firewall(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'foes'), ys = L.map(t => t.y), xs = L.map(t => t.x), y0 = Math.min(...ys) - S.u * 0.2, y1 = Math.max(...ys) + S.u * 0.5;
    const xa = S.dir > 0 ? Math.min(S.from.x, ...xs) - S.u * 0.5 : Math.max(S.from.x, ...xs) + S.u * 0.5, xb = S.dir > 0 ? Math.max(...xs) + S.u * 1.5 : Math.min(...xs) - S.u * 1.5;
    const front = lerp(xa, xb, eo(cl(p / 0.7))), n = P.n || 110, H = S.u * (P.h || 1.1), a = env(p, 0.03, 0.25); g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) { const fx = r(), fy = r(), ph = r() * TAU, rh = r(), x = lerp(xa, xb, fx), behind = (front - x) * S.dir; if (behind < 0) continue; const life = cl(1 - behind / Math.abs(xb - xa) * 1.8); if (life <= 0) continue; const h = H * (0.35 + 0.65 * rh) * life * (0.7 + 0.3 * Math.sin(p * 30 + ph)); flame(g, x, lerp(y0, y1, fy), h * 0.4, h, C(R, P.c, 0), C(R, P.c2, 1), 0.8 * a); }
    for (let k = 0; k < 8; k++) flame(g, front, lerp(y0, y1, k / 7), S.u * 0.35, H * 1.2 * (0.8 + 0.2 * Math.sin(p * 40 + k)), C(R, P.c, 0), '#fff0b0', 0.85 * a);
    g.restore();
  },
  // 冰
  helix(g, p, P, S, R) {
    const A = pt1(S, P.at || 'tg'), H = S.u * (P.h || 2.2) * eo(cl(p / 0.4)), a = env(p, 0.05, P.out ?? 0.2), base = A.y + S.u * 0.45, wr = S.u * 0.45;
    [C(R, P.c, 0), C(R, P.c2, 1)].forEach((col, k) => { const L = []; for (let i = 0; i <= 28; i++) { const u = i / 28; L.push({ x: A.x + Math.sin(u * 10 + p * 18 + k * Math.PI) * wr * (1 - u * 0.4), y: base - u * H }); } brush(g, L, S.u * 0.16, col, a * 0.9, 0, 1, 0.3); });
  },
  shards(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'tg'), n = P.n || 22, q = eo(p);
    for (let i = 0; i < n; i++) { const ang = r() * TAU, sp = S.u * (1 + r() * 1.6), rot = r() * TAU, sz = S.u * (0.06 + r() * 0.1); g.save(); g.translate(A.x + Math.cos(ang) * sp * q, A.y + Math.sin(ang) * sp * q * 0.7 + S.u * 1.2 * p * p); g.rotate(rot + p * 6); g.fillStyle = rgba(i % 2 ? C(R, P.c2, 1) : C(R, P.c, 0), 1 - p); g.beginPath(); g.moveTo(0, -sz); g.lineTo(sz * 0.6, sz); g.lineTo(-sz * 0.6, sz); g.closePath(); g.fill(); g.restore(); }
  },
  iceline(g, p, P, S, R, r) {
    const a0 = S.from, L = S.foes, far = S.dir > 0 ? Math.max(...L.map(t => t.x)) + S.u : Math.min(...L.map(t => t.x)) - S.u, y = cen(L, S).y + S.u * 0.45, front = lerp(a0.x, far, eo(cl(p / 0.45))), a = env(p, 0.02, 0.2);
    brush(g, [{ x: a0.x, y: a0.y + S.u * 0.45 }, { x: front, y }], S.u * 0.1, '#ffffff', a, 0, 1, 0);
    g.strokeStyle = rgba(C(R, P.c, 0), 0.95 * a); g.lineWidth = 1.2;
    for (let i = 0, n = P.n || 26; i < n; i++) { const fx = lerp(a0.x, far, r()), oy = (r() - 0.5) * S.u * 1.8, s = S.u * (0.12 + r() * 0.16); if ((front - fx) * S.dir < 0) continue; hex(g, fx, y + oy * 0.5 - S.u * 0.1, s); }
  },
  icicle(g, p, P, S, R) {
    const L = pts(S, P.at || 'front2'), a = env(p, 0.02, 0.2), col = C(R, P.c, 0);
    L.forEach((t, i) => {
      const q = eo(cl((p - (P.d ?? 0.3) - i * 0.06) / 0.25)); if (q <= 0) return; const h = S.u * 1.3 * q, w = S.u * 0.75, b = t.y + S.u * 0.48;
      const gr = g.createLinearGradient(t.x - w / 2, 0, t.x + w / 2, 0); gr.addColorStop(0, rgba('#ffffff', 0.75 * a)); gr.addColorStop(0.5, rgba(col, 0.5 * a)); gr.addColorStop(1, rgba('#ffffff', 0.7 * a)); g.fillStyle = gr;
      g.beginPath(); g.moveTo(t.x - w / 2, b); g.lineTo(t.x - w * 0.42, b - h * 0.85); g.lineTo(t.x - w * 0.1, b - h); g.lineTo(t.x + w * 0.3, b - h * 0.92); g.lineTo(t.x + w / 2, b); g.closePath(); g.fill(); g.strokeStyle = rgba('#ffffff', 0.9 * a); g.lineWidth = 1.2; g.stroke();
    });
  },
  snow(g, p, P, S, R, r) {
    const a = env(p, 0.2, 0.25); g.fillStyle = rgba(P.c || '#ffffff', 0.85 * a);
    for (let i = 0, n = P.n || 40; i < n; i++) { const x0 = r() * S.w, sp = 0.4 + r() * 0.6, ph = r() * TAU, sz = 1 + r() * 2, y0 = r(); g.beginPath(); g.arc(x0 + Math.sin(p * 6 + ph) * 8, ((y0 + p * sp * 1.2) % 1) * (S.h + 20) - 10, sz, 0, TAU); g.fill(); }
  },
  lake(g, p, P, S, R) {
    const c = cen(S.foes, S), q = eo(cl((p - (P.d ?? 0.2)) / 0.3)), a = env(p, 0, 0.2), rx = S.u * 2.6 * q, ry = S.u * 1.0 * q; if (q <= 0) return;
    const gr = g.createLinearGradient(c.x - rx, c.y, c.x + rx, c.y + ry); gr.addColorStop(0, rgba('#ffffff', 0.75 * a)); gr.addColorStop(0.5, rgba(C(R, P.c, 0), 0.55 * a)); gr.addColorStop(1, rgba('#ffffff', 0.7 * a));
    g.fillStyle = gr; g.beginPath(); g.ellipse(c.x, c.y + S.u * 0.25, rx, ry, 0, 0, TAU); g.fill(); g.strokeStyle = rgba('#ffffff', a); g.lineWidth = 1.5; g.stroke();
    g.lineWidth = 1; g.beginPath(); for (let k = 0; k < 4; k++) { const x = c.x - rx * 0.6 + k * rx * 0.35, y = c.y + S.u * 0.1 + (k % 2) * ry * 0.3; g.moveTo(x, y); g.lineTo(x + rx * 0.15, y - ry * 0.1); } g.stroke();
  },
  dart(g, p, P, S, R) {
    const c = cen(S.foes, S), q = cl((p - (P.d ?? 0.5)) / 0.3); if (q <= 0 || q >= 1) return;
    g.save(); g.translate(lerp(c.x - S.dir * S.u * 3, c.x + S.dir * S.u * 3, q), c.y + S.u * 0.05 + Math.sin(q * 12) * 3); g.scale(S.dir, 1); g.strokeStyle = '#1c1915'; g.fillStyle = rgba(C(R, P.c, 2), 0.95); g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(0, 0, S.u * 0.3, S.u * 0.05, 0, 0, TAU); g.fill(); g.stroke(); const fl = Math.sin(p * 80) * 0.5; [-1, 1].forEach(k => { g.beginPath(); g.ellipse(S.u * 0.08, k * S.u * 0.08, S.u * 0.16, S.u * 0.05, k * (0.5 + fl), 0, TAU); g.stroke(); }); g.restore();
  },
};
Object.assign(PR, {
  // 金
  plates(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), n = P.n || 10, step = P.step ?? 0.05, d0 = P.d || 0, a = env(p, 0, 0.12);
    for (let i = 0; i < n; i++) {
      const ang0 = r() * TAU, far = S.u * (2.2 + r()), sl = (i / n) * TAU, q = eo(cl((p - d0 - i * step) / 0.12)); if (q <= 0) continue;
      const x = lerp(A.x + Math.cos(ang0) * far, A.x + Math.cos(sl) * S.u * 0.32, q), y = lerp(A.y + Math.sin(ang0) * far * 0.7, A.y + Math.sin(sl) * S.u * 0.28, q);
      g.save(); g.translate(x, y); g.rotate(sl + Math.PI / 2 + (1 - q) * 3); g.fillStyle = rgba(P.quill ? C(R, P.c2, 2) : C(R, P.c, 0), 0.95 * a); g.strokeStyle = rgba('#1c1915', a); g.lineWidth = 1; g.beginPath();
      if (P.quill) { g.moveTo(0, -S.u * 0.38); g.lineTo(S.u * 0.045, 0); g.lineTo(0, S.u * 0.12); g.lineTo(-S.u * 0.045, 0); g.closePath(); } else g.ellipse(0, 0, S.u * 0.14, S.u * 0.2, 0, 0, TAU);
      g.fill(); g.stroke(); g.restore();
    }
    const done = d0 + n * step + 0.12, q = (p - done) / 0.15; if (q > 0 && q < 1) { g.save(); g.globalCompositeOperation = 'lighter'; radial(g, A.x, A.y, S.u * (0.6 + q), C(R, P.c, 0), 0.75 * (1 - q)); g.restore(); }
  },
  crack(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), n = P.n || 7, Rm = S.u * (P.R || 1.2), a = env(p, 0.02, 0.25), q = eo(cl((p - (P.d || 0)) / 0.25)), by = A.y + S.u * 0.45;
    for (let i = 0; i < n; i++) { const ang = (i / n) * TAU + r() * 0.5, L = [{ x: A.x, y: by }]; for (let k = 1; k <= 4; k++) { const rr = Rm * k / 4, an = ang + (r() - 0.5) * 0.5; L.push({ x: A.x + Math.cos(an) * rr, y: by + Math.sin(an) * rr * 0.4 }); } if (q > 0) brush(g, L, 2.6, P.c || '#1c1915', 0.85 * a, 0, q, 0.6); }
  },
  blade(g, p, P, S, R) {
    const A = pt1(S, P.at || 'tg'), col = C(R, P.c2, 1), a = env(p, 0.02, 0.2), top = -10, bot = A.y + S.u * 0.6;
    if (p < 0.35) star(g, A.x, A.y - S.u * 1.6, S.u * 0.25 * (0.6 + 0.4 * Math.sin(p * 40)), '#ffffff', 0.95);
    const q = cl((p - 0.35) / 0.08); if (q > 0) { const y = lerp(top, bot, eo(q)); g.save(); g.globalCompositeOperation = 'lighter'; brush(g, [{ x: A.x, y: top }, { x: A.x, y }], S.u * 0.24, col, 0.55 * a, 0, 1, 0.3); brush(g, [{ x: A.x, y: top }, { x: A.x, y }], S.u * 0.07, '#ffffff', a, 0, 1, 0.3); g.restore(); }
    const sp = cl((p - 0.45) / 0.2); if (sp > 0 && sp < 1) { const off = Math.sin(sp * Math.PI) * S.u * 0.25; g.strokeStyle = rgba('#1c1915', 0.7 * (1 - sp)); g.lineWidth = 2; g.beginPath(); g.moveTo(A.x - off, top); g.lineTo(A.x - off, bot); g.moveTo(A.x + off, top); g.lineTo(A.x + off, bot); g.stroke(); }
  },
  debris(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'tg'), d0 = P.d || 0, q = cl((p - d0) / (1 - d0));
    for (let i = 0, n = P.n || 14; i < n; i++) { const vx = (r() - 0.5) * S.u * 3, vy = -S.u * (0.8 + r() * 1.4), sz = S.u * (0.05 + r() * 0.08), rot = r() * TAU; if (q <= 0) continue; g.save(); g.translate(A.x + vx * q, A.y + S.u * 0.4 + vy * q + S.u * 3 * q * q); g.rotate(rot + q * 5); g.fillStyle = rgba(P.c || '#2b241b', 1 - q); g.fillRect(-sz, -sz * 0.7, sz * 2, sz * 1.4); g.restore(); }
  },
  dome(g, p, P, S, R) {
    const L = pts(S, P.at || 'from'), col = C(R, P.c, 0), a = env(p, 0.05, 0.2), q = eo(cl((p - (P.d || 0)) / 0.25)); if (q <= 0) return;
    L.forEach(t => {
      const w = S.u * 0.62, h = S.u * 1.15 * q, by = t.y + S.u * 0.45; g.fillStyle = rgba(col, 0.22 * a); g.strokeStyle = rgba(col, 0.95 * a); g.lineWidth = 2;
      g.beginPath(); g.moveTo(t.x - w, by); g.bezierCurveTo(t.x - w, by - h * 0.6, t.x - w * 0.45, by - h, t.x, by - h); g.bezierCurveTo(t.x + w * 0.45, by - h, t.x + w, by - h * 0.6, t.x + w, by); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(t.x, by, w, w * 0.25, 0, 0, TAU); g.stroke(); g.lineWidth = 1; [0.35, 0.6].forEach(k => { g.beginPath(); g.ellipse(t.x, by - h * k, w * (1 - k * 0.35), w * 0.18, 0, 0, Math.PI); g.stroke(); });
      const sh = (p * 2) % 1; g.strokeStyle = rgba('#ffffff', 0.6 * a * (1 - sh)); g.beginPath(); g.ellipse(t.x, by - h * sh, w * (1 - sh * 0.5), w * 0.2, 0, 0, Math.PI); g.stroke();
    });
  },
  coins(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), L = pts(S, 'allies'), col = C(R, P.c, 0), a = env(p, 0.05, 0.15);
    for (let i = 0, n = P.n || 14; i < n; i++) { const t = L[i % L.length], ox = (r() - 0.5) * S.u * 0.6, d = r() * 0.4, h = S.u * (1 + r()), q = cl((p - 0.1 - d) / 0.35); if (q <= 0) continue; const x = lerp(A.x, t.x + ox, q), y = lerp(A.y - S.u * 0.3, t.y, q) - h * 4 * q * (1 - q), w = Math.abs(Math.cos(p * 25 + i)) * S.u * 0.11 + 1; g.fillStyle = rgba(col, a); g.strokeStyle = rgba('#5a3a0a', a); g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, w, S.u * 0.11, 0, 0, TAU); g.fill(); g.stroke(); if (q >= 1) star(g, t.x + ox, t.y - S.u * 0.3, S.u * 0.07 * (1 + Math.sin(p * 30 + i)), '#fff6c0', a); }
  },
  // 木
  cocoon(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), col = C(R, P.c, 1), rw = S.u * 0.42, rh = S.u * 0.62, a = env(p, 0.05, 0.12), crack = cl((p - 0.15) / 0.2), peel = cl((p - 0.42) / 0.4);
    for (let i = 0, n = 8; i < n; i++) { const ang = (i / n) * TAU, dx = r() - 0.5, dy = r(); g.save(); g.translate(A.x + Math.cos(ang) * rw * 0.6 + dx * S.u * 2 * peel, A.y + Math.sin(ang) * rh * 0.6 + dy * S.u * 1.5 * peel * peel); g.rotate(peel * dx * 6); g.globalAlpha = a * (1 - peel); g.fillStyle = col; g.strokeStyle = '#1c1915'; g.lineWidth = 1; g.beginPath(); g.ellipse(0, 0, rw * 0.5, rh * 0.45, ang, 0, TAU); g.fill(); g.stroke(); g.restore(); }
    if (crack > 0 && peel < 1) { g.save(); g.globalCompositeOperation = 'lighter'; brush(g, [{ x: A.x, y: A.y - rh }, { x: A.x + 4, y: A.y - rh * 0.5 }, { x: A.x - 3, y: A.y }, { x: A.x + 2, y: A.y + rh * 0.5 }], 3 + 6 * peel, P.g || '#c9a0e8', 0.95 * (1 - peel), 0, crack, 0.5); g.restore(); }
  },
  wings(g, p, P, S, R) {
    const A = pt1(S, P.at || 'from'), s = S.u * (P.s || 1.6) * eo(cl((p - (P.d ?? 0.4)) / 0.4)), flap = 0.85 + 0.15 * Math.sin(p * 14); if (s < 1) return;
    g.save(); g.translate(A.x, A.y - S.u * 0.3); g.globalAlpha = env(p, 0.02, 0.15) * (P.a ?? 1);
    [-1, 1].forEach(sd => {
      g.save(); g.scale(sd * flap, 1); g.fillStyle = C(R, P.c, 1); g.strokeStyle = '#1c1915'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(s * 0.4, -s * 0.9, s * 1.1, -s * 0.7, s * 0.9, -s * 0.1); g.bezierCurveTo(s * 0.8, s * 0.2, s * 0.4, s * 0.1, 0, 0); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(s * 0.5, s * 0.2, s * 0.7, s * 0.6, s * 0.35, s * 0.7); g.bezierCurveTo(s * 0.15, s * 0.6, s * 0.05, s * 0.3, 0, 0); g.fillStyle = C(R, P.c2, 0); g.fill(); g.stroke();
      g.fillStyle = '#1c1915'; g.beginPath(); g.arc(s * 0.6, -s * 0.45, s * 0.07, 0, TAU); g.fill(); g.restore();
    });
    g.restore();
  },
  blobs(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), col = C(R, P.c, 1), q = eio(cl((p - 0.12) / 0.55)), a = env(p, 0.05, 0.15);
    for (let i = 0, n = P.n || 7; i < n; i++) { const ang = r() * TAU, d = S.u * (0.9 + r() * 0.9), sz = S.u * (0.14 + r() * 0.1), wob = 1 + 0.15 * Math.sin(p * 30 + i); g.fillStyle = rgba(col, 0.92 * a); g.strokeStyle = rgba('#1c1915', 0.8 * a); g.lineWidth = 1.2; g.beginPath(); g.ellipse(A.x + Math.cos(ang) * d * (1 - q), A.y + S.u * 0.35 * (1 - q) + Math.sin(ang) * d * 0.35 * (1 - q), sz * wob, sz / wob * 0.8, ang, 0, TAU); g.fill(); g.stroke(); }
  },
  sprouts(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'from'), col = C(R, P.c, 0), a = env(p, 0.02, 0.2);
    L.forEach(t => { for (let i = 0, n = P.n || 8; i < n; i++) { const ox = (r() - 0.5) * S.u * (P.wide || 1), oy = (r() - 0.5) * S.u * 0.3, d = r() * 0.5, h = S.u * (0.15 + r() * 0.2), q = eo(cl((p - (P.d || 0) - d * 0.5) / 0.25)); if (q <= 0) continue; const x = t.x + ox, y = t.y + S.u * (P.onBody ? 0 : 0.45) + oy; brush(g, [{ x, y }, { x: x + h * 0.3, y: y - h * 0.6 }, { x: x + h * 0.1, y: y - h }], 2.4, col, a, 0, q, 0.4); } });
  },
  thorns(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), n = P.n || 12, col = C(R, P.c, 0), a = env(p, 0.03, 0.2), by = A.y + S.u * 0.45;
    for (let i = 0; i < n; i++) { const an = i / n * TAU, rr = S.u * (0.75 + r() * 0.2), h = S.u * (0.4 + r() * 0.5), q = eo(cl((p - 0.05 - (i / n) * 0.3) / 0.15)); if (q <= 0) continue; const x = A.x + Math.cos(an) * rr, y = by + Math.sin(an) * rr * 0.35, lean = Math.cos(an) * 0.3; g.fillStyle = rgba(col, a); g.strokeStyle = rgba('#1c1915', a); g.lineWidth = 1; g.beginPath(); g.moveTo(x - S.u * 0.07, y); g.quadraticCurveTo(x + lean * h * 0.3, y - h * q * 0.6, x + lean * h, y - h * q); g.quadraticCurveTo(x + lean * h * 0.3 + 2, y - h * q * 0.5, x + S.u * 0.07, y); g.closePath(); g.fill(); g.stroke(); }
  },
  tree(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), base = { x: A.x - S.dir * S.u * 0.6, y: A.y + S.u * 0.45 }, col = C(R, P.c, 2), a = env(p, 0.05, 0.2) * 0.8, grow = eo(cl(p / 0.35));
    const br = (x, y, ang, len, d) => { if (d > 4) return; const x2 = x + Math.cos(ang) * len * grow, y2 = y + Math.sin(ang) * len * grow, j1 = r(), j2 = r(); brush(g, [{ x, y }, { x: x2, y: y2 }], Math.max(1.5, 7 - d * 1.5), col, a, 0, 1, 0); br(x2, y2, ang - 0.45 - j1 * 0.2, len * 0.72, d + 1); br(x2, y2, ang + 0.4 + j2 * 0.2, len * 0.7, d + 1); };
    br(base.x, base.y, -Math.PI / 2, S.u * 1.05, 0);
    g.save(); g.globalCompositeOperation = 'lighter'; radial(g, base.x, base.y - S.u * 1.6, S.u * 1.6, col, 0.25 * a * grow); g.restore();
  },
  flit(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), c = { x: A.x - S.dir * S.u * 0.6, y: A.y - S.u * 1.3 }, q = cl((p - 0.25) / 0.6), an = q * (P.loops || 3) * TAU, x = c.x + Math.cos(an) * S.u * 0.9, y = c.y + Math.sin(an) * S.u * 0.4, a = env(p, 0.1, 0.15);
    if (q > 0 && q < 1) { const fl = Math.abs(Math.sin(p * 50)); g.fillStyle = rgba(C(R, P.c, 1), a); g.strokeStyle = rgba('#1c1915', a); [-1, 1].forEach(k => { g.beginPath(); g.ellipse(x + k * S.u * 0.08 * fl, y, S.u * 0.1 * fl + 1, S.u * 0.12, k * 0.5, 0, TAU); g.fill(); g.stroke(); }); }
    const L = pts(S, 'allies'), gold = C(R, P.c2, 2);
    for (let i = 0; i < 40; i++) { const t = L[i % L.length], ox = (r() - 0.5) * S.u, d = 0.25 + r() * 0.6, dq = (p - d) / 0.25; if (dq < 0 || dq > 1) continue; g.fillStyle = rgba(gold, (1 - dq) * a); g.fillRect(t.x + ox, lerp(t.y - S.u * 1.2, t.y, dq), 2, 2); }
  },
  // 土
  mountain(g, p, P, S, R) {
    const A = pt1(S, P.at || 'from'), s = S.u * (P.s || 2), col = C(R, P.c, 0), a = env(p, 0.08, 0.2) * (P.a ?? 0.85), ground = A.y + S.u * 0.45;
    const oy = P.mode === 'sink' ? -S.u * 1.2 + eio(cl((p - 0.1) / 0.6)) * S.u * 1.2 : S.u * 0.8 * (1 - eo(cl(p / 0.4))), bx = A.x + (P.dx ?? -0.6) * S.dir * S.u, by = ground + oy;
    const pk = P.peaks || [[-0.5, 0.55], [-0.15, 1], [0.2, 0.7], [0.5, 0.45]];
    g.save(); g.beginPath(); g.rect(-S.w, -S.h, S.w * 3, ground + S.h); g.clip();
    const gr = g.createLinearGradient(0, by - s, 0, by); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, a * 0.15)); g.fillStyle = gr;
    g.beginPath(); g.moveTo(bx - s * 0.75, by); pk.forEach(([px, ph], i) => { if (i) { const [qx, qh] = pk[i - 1]; g.lineTo(bx + (px + qx) / 2 * s, by - Math.min(ph, qh) * 0.55 * s); } g.lineTo(bx + px * s, by - ph * s); }); g.lineTo(bx + s * 0.75, by); g.closePath(); g.fill();
    g.strokeStyle = rgba('#1c1915', a * 0.7); g.lineWidth = 1.5; g.stroke(); g.restore();
  },
  hexes(g, p, P, S, R) {
    const A = pt1(S, P.at || 'from'), s = S.u * 0.13; g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(C(R, P.c, 1), env(p, 0.1, 0.2) * (0.7 + 0.3 * Math.sin(p * 20))); g.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) { const x = A.x + i * s * 1.55, y = A.y + j * s * 1.7 + (i % 2 ? s * 0.85 : 0); if (Math.hypot((x - A.x) / 1.3, y - A.y) < S.u * 0.42) hex(g, x, y, s * 0.8); }
    g.restore();
  },
  dust(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'from'), col = C(R, P.c, 1), a = env(p, 0.15, 0.3);
    L.forEach(t => { for (let i = 0, n = P.n || 24; i < n; i++) { const ox = (r() - 0.5) * S.u * (P.wide || 2.4), sp = 0.3 + r() * 0.7, sz = S.u * (0.08 + r() * 0.12), d = r() * 0.4, q = cl((p - d) / (1 - d)); if (q <= 0) continue; g.fillStyle = rgba(col, 0.38 * a * (1 - q)); g.beginPath(); g.arc(t.x + ox * (0.6 + q * 0.6), t.y + S.u * 0.45 - q * S.u * sp, sz * (1 + q), 0, TAU); g.fill(); } });
  },
  funnel(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'front'), col = C(R, P.c, 0), dk = C(R, P.c2, 1), a = env(p, 0.1, 0.25), rot = eio(cl(p / 0.85)) * TAU * 1.5, by = A.y + S.u * 0.4, Rm = S.u * 0.95;
    for (let k = 0; k < 4; k++) { const L = []; for (let i = 0; i <= 20; i++) { const u = i / 20, an = rot + k * Math.PI / 2 + u * 4, rr = Rm * (1 - u); L.push({ x: A.x + Math.cos(an) * rr, y: by + Math.sin(an) * rr * 0.32 }); } brush(g, L, 3, k % 2 ? dk : col, 0.85 * a, 0, 1, 0.5); }
    for (let i = 0; i < 40; i++) { const an0 = r() * TAU, rr0 = r(), sp = 0.5 + r(), u = (rr0 + p * sp) % 1, an = an0 + rot * 1.3 + u * 3, rr = Rm * (1 - u); g.fillStyle = rgba(col, a); g.fillRect(A.x + Math.cos(an) * rr, by + Math.sin(an) * rr * 0.32, 2, 2); }
    const sink = eo(cl((p - 0.3) / 0.5)); if (sink > 0) { g.fillStyle = rgba(col, 0.92 * a); g.beginPath(); g.ellipse(A.x, by, S.u * 0.55, S.u * 0.18 + sink * S.u * 0.28, 0, Math.PI, 0); g.fill(); }
  },
  rock(g, p, P, S, R) {
    const a0 = pt1(S, P.at || 'front'), b0 = pt1(S, P.to || 'foeBack'), col = C(R, P.c, 1), fly = cl((p - 0.3) / 0.4); let x, y;
    if (fly <= 0) { x = a0.x; y = a0.y + S.u * 0.5 - eo(cl(p / 0.25)) * S.u * 0.5; } else { x = lerp(a0.x, b0.x + S.dir * S.u * 0.5, fly); y = lerp(a0.y, b0.y, fly) - S.u * 2.2 * 4 * fly * (1 - fly); }
    if (fly < 1) { const s = S.u * 0.55; g.save(); g.translate(x, y); g.rotate(fly * 4); g.fillStyle = col; g.strokeStyle = '#1c1915'; g.lineWidth = 2; g.beginPath(); [[-1, 0.2], [-0.6, -0.8], [0.3, -0.9], [1, -0.2], [0.7, 0.7], [-0.4, 0.8]].forEach(([u, v], i) => i ? g.lineTo(u * s, v * s * 0.8) : g.moveTo(u * s, v * s * 0.8)); g.closePath(); g.fill(); g.stroke(); bug(g, 0, -s * 0.9, S.u * 0.6, '#1c1915', fly > 0 ? 0.7 : 0, S.dir); g.restore(); }
    const land = cl((p - 0.7) / 0.3); if (land > 0) { g.strokeStyle = rgba(col, 0.9 * (1 - land)); g.lineWidth = 4 * (1 - land) + 1; g.beginPath(); g.ellipse(b0.x + S.dir * S.u * 0.5, b0.y + S.u * 0.45, S.u * (0.3 + land * 1.4), S.u * (0.1 + land * 0.45), 0, 0, TAU); g.stroke(); }
  },
  flag(g, p, P, S, R) {
    const A = pt1(S, P.at || 'from'), x = A.x + S.dir * S.u * 0.6, by = A.y + S.u * 0.45, q = eo(cl((p - (P.d ?? 0.5)) / 0.2)), a = env(p, 0, 0.15); if (q <= 0) return; const H = S.u * 1.4 * q;
    g.strokeStyle = rgba('#1c1915', a); g.lineWidth = 2; g.beginPath(); g.moveTo(x, by); g.lineTo(x, by - H); g.stroke();
    g.fillStyle = rgba(C(R, P.c, 2), a); g.beginPath(); g.moveTo(x, by - H); for (let i = 0; i <= 8; i++) { const u = i / 8; g.lineTo(x + S.dir * u * S.u * 0.7 * q, by - H + Math.sin(u * 5 + p * 20) * 3); } for (let i = 8; i >= 0; i--) { const u = i / 8; g.lineTo(x + S.dir * u * S.u * 0.7 * q, by - H + S.u * 0.4 + Math.sin(u * 5 + p * 20) * 3); } g.closePath(); g.fill();
  },
  // 雷
  chain(g, p, P, S, R, r) {
    const L = [pt1(S, P.at || 'from')].concat(S.foes).slice(0, (P.n || 2) + 2), col = C(R, P.c, 1), seg = 1 / Math.max(1, L.length - 1);
    for (let i = 1; i < L.length; i++) { const J = jag(L[i - 1], L[i], 7, S.u * 0.3, r), lp = (p - (i - 1) * seg * 0.8) / (seg * 0.9); if (lp < 0 || lp > 1) continue; g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(col, 0.45 * (1 - lp)); g.lineWidth = 7; line(g, J); g.stroke(); g.strokeStyle = rgba('#ffffff', 1 - lp); g.lineWidth = 2; line(g, J); g.stroke(); radial(g, L[i].x, L[i].y, S.u * 0.5 * (1 - lp), col, 0.6); g.restore(); }
  },
  motes(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'tgs'), n = P.n || L.length * 2, col = C(R, P.c, 1), src = pt1(S, P.src || 'from'), fly = P.fly ?? 0.5, a = env(p, 0.05, 0.15); g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) { const t = L[i % L.length], ox = (r() - 0.5) * S.u * 0.6, d = r() * 0.25, cx = src.x + (r() - 0.5) * S.u * 2, cy = src.y - r() * S.u * 1.5, q = eio(cl((p - d) / fly)), pos = qbez(src, { x: cx, y: cy - S.u }, { x: t.x + ox, y: t.y - S.u * 0.75 }, q); radial(g, pos.x, pos.y, S.u * 0.18 * (0.6 + 0.4 * Math.sin(p * 40 + i)), col, 0.9 * a); }
    g.restore();
  },
  bolts(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'tgs'), n = P.n || L.length, gap = P.gap ?? 0, life = P.life || 0.25, col = C(R, P.c, 1), d0 = P.d || 0;
    for (let i = 0; i < n; i++) {
      const t = L[i % L.length], ox = (r() - 0.5) * S.u * 0.5, J = jag({ x: t.x + ox * 3, y: -12 }, { x: t.x + ox, y: t.y + S.u * 0.2 }, 8, S.u * 0.28, r), lp = (p - d0 - i * gap) / life; if (lp < 0 || lp > 1) continue;
      const big = P.last && i === n - 1, w = (P.w || 2.5) * (big ? 2.4 : 1), a = 1 - lp; g.save(); g.globalCompositeOperation = 'lighter';
      g.strokeStyle = rgba(big ? C(R, P.lc ?? 2, 2) : col, 0.5 * a); g.lineWidth = w * 4; line(g, J); g.stroke(); g.strokeStyle = rgba('#ffffff', a); g.lineWidth = w; line(g, J); g.stroke(); radial(g, t.x + ox, t.y + S.u * 0.3, S.u * (big ? 1.2 : 0.6), col, 0.7 * a); g.restore();
    }
  },
  cracks(g, p, P, S, R, r) {
    const col = C(R, P.c, 2), a = env(p, 0.05, 0.2); g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0, n = P.n || 9; i < n; i++) { const x0 = S.w * (0.1 + 0.8 * (i + r() * 0.6) / n), J = jag({ x: x0, y: -5 }, { x: x0 + (r() - 0.5) * S.u, y: S.h * (0.12 + r() * 0.12) }, 5, S.u * 0.2, r), q = cl((p - i * 0.03) / 0.15); if (q > 0) { brush(g, J, 6, col, 0.3 * a, 0, q, 0.3); brush(g, J, 2.5, '#fff6d0', a, 0, q, 0.3); } }
    g.restore();
  },
  band(g, p, P, S, R) {
    const y = S.h * (P.y ?? 0.14), x = lerp(-S.w * 0.3, S.w * 1.3, eio(cl(p / 0.6))), col = C(R, P.c, 0), a = env(p, 0.05, 0.3); g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(x - S.w * 0.6, 0, x, 0); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(1, rgba(col, 0.75 * a)); g.fillStyle = gr; g.fillRect(x - S.w * 0.6, y - S.u * 0.18, S.w * 0.6, S.u * 0.36); radial(g, x, y, S.u * 0.6, '#ffffff', 0.8 * a); g.restore();
  },
  stars(g, p, P, S, R) { const L = pts(S, P.at || 'front2'), a = env(p, 0.15, 0.2); L.forEach(t => { for (let k = 0; k < 3; k++) { const an = p * 12 + k * TAU / 3; star(g, t.x + Math.cos(an) * S.u * 0.35, t.y - S.u * 0.65 + Math.sin(an) * S.u * 0.1, S.u * 0.11, P.c || '#f2c35a', a); } }); },
});
Object.assign(PR, {
  // 光
  meteor(g, p, P, S, R, r) {
    const L = S.foes, n = P.n || 60, col = C(R, P.c, 0), fire = P.fire; g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const sx = fire ? r() * S.w : lerp(S.w * (S.dir > 0 ? 0.05 : 0.55), S.w * (S.dir > 0 ? 0.45 : 0.95), r()), sy0 = S.h * (0.6 + r() * 0.3), hy = S.h * (0.08 + r() * 0.25), t = L[i % L.length], ox = (r() - 0.5) * S.u * 1.2, d = r() * 0.15, tx = t.x + ox, ty = t.y + S.u * 0.3;
      let x, y, fx0, fy0;
      if (fire) { const q = cl((p - d * 3) / 0.35); if (q >= 1) { const k = (p - d * 3 - 0.35) / 0.15; if (k < 1) radial(g, tx, ty, S.u * 0.35 * (1 - k), '#ffb060', 0.7); continue; } if (q <= 0) continue; fx0 = tx - S.dir * S.u * 2; fy0 = -10; x = lerp(fx0, tx, ei(q)); y = lerp(fy0, ty, ei(q)); }
      else { const rise = cl((p - d) / 0.35), fall = cl((p - 0.5 - d) / 0.3); if (fall >= 1) { const k = (p - 0.8 - d) / 0.12; if (k < 1) radial(g, tx, ty, S.u * 0.25 * (1 - k), '#ffb060', 0.85 * (1 - k)); continue; } if (fall <= 0) { radial(g, sx + Math.sin(p * 8 + i) * 4, lerp(sy0, hy, eo(rise)), S.u * 0.08 + 2, col, 0.9 * cl(rise * 3)); continue; } fx0 = sx; fy0 = hy; x = lerp(sx, tx, ei(fall)); y = lerp(hy, ty, ei(fall)); }
      const dl = Math.hypot(tx - fx0, ty - fy0) || 1; radial(g, x, y, S.u * 0.09 + 2, col, 0.95); g.strokeStyle = rgba(col, 0.55); g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x - (tx - fx0) / dl * 16, y - (ty - fy0) / dl * 16); g.stroke();
    }
    g.restore();
  },
  mirror(g, p, P, S, R) {
    const A = pt1(S, P.at || 'from'), x = A.x + S.dir * S.u * 0.75, y = A.y - S.u * 0.1, hgt = S.u * 0.95 * eo(cl(p / 0.2)), c1 = C(R, P.c, 0), c2 = C(R, P.c2, 1), a = env(p, 0.02, 0.15);
    const gr = g.createLinearGradient(x - 8, 0, x + 8, 0); gr.addColorStop(0, rgba(c1, 0.2 * a)); gr.addColorStop(0.5, rgba('#ffffff', 0.65 * a)); gr.addColorStop(1, rgba(c1, 0.2 * a)); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, S.u * 0.18, Math.max(1, hgt), 0, 0, TAU); g.fill(); g.strokeStyle = rgba('#ffffff', 0.9 * a); g.lineWidth = 1.5; g.stroke();
    if (p > 0.25) for (let k = 0; k < 3; k++) { const q = ((p * 2.2 - k * 0.25) % 1 + 1) % 1; g.strokeStyle = rgba(c1, (1 - q) * 0.85 * a); g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, S.u * 0.18 * (1 + q * 1.5), hgt * (0.3 + q * 0.6), 0, 0, TAU); g.stroke(); }
    const T = pt1(S, 'tg'), sh = cl((p - 0.2) / 0.5); if (sh > 0 && sh < 1) { const out = sh < 0.5, f = out ? sh * 2 : (sh - 0.5) * 2; radial(g, out ? lerp(T.x, x, f) : lerp(x, T.x, f), out ? lerp(T.y, y, f) : lerp(y, T.y, f), S.u * 0.22, out ? '#ffffff' : c2, 0.95); }
    const fl = cl((p - 0.55) / 0.35); if (fl > 0) for (let k = 0; k < 5; k++) { const an = k * TAU / 5 + 0.3, sp = fl > 0.5 ? (fl - 0.5) * S.u * 2.5 : 0; g.fillStyle = rgba(c2, (fl > 0.5 ? 1 - (fl - 0.5) * 2 : fl * 2) * 0.9); g.beginPath(); g.ellipse(x + Math.cos(an) * (S.u * 0.18 + sp), y + Math.sin(an) * (S.u * 0.18 + sp) + sp * sp / S.u, S.u * 0.12, S.u * 0.06, an, 0, TAU); g.fill(); }
  },
  prism(g, p, P, S, R) {
    const A = pt1(S, P.at || 'from'), a = env(p, 0.03, 0.2), beam = cl(p / 0.2), fan = eo(cl((p - 0.2) / 0.3)), cols = ['#e05a4a', '#e8933a', '#e8d04a', '#7ac06a', '#4aa8d8', '#5a6ad0', '#a06ad0'], src = { x: A.x - S.dir * S.u * 2, y: -10 };
    g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba('#ffffff', 0.9 * a); g.lineWidth = 4; g.beginPath(); g.moveTo(src.x, src.y); g.lineTo(lerp(src.x, A.x, beam), lerp(src.y, A.y, beam)); g.stroke();
    if (fan > 0) {
      const L = pts(S, 'allies'); cols.forEach((c, i) => { const t = L[i % L.length], o = (i - 3) * 4; g.strokeStyle = rgba(c, 0.6 * a); g.lineWidth = 3; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(lerp(A.x, t.x + o, fan), lerp(A.y, t.y + o, fan)); g.stroke(); });
      const T = pt1(S, 'tg'), st = eo(cl((p - 0.45) / 0.15)); if (st > 0) { g.strokeStyle = rgba('#ffffff', a); g.lineWidth = 5; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(lerp(A.x, T.x, st), lerp(A.y, T.y, st)); g.stroke(); if (st >= 1) { g.strokeStyle = rgba('#dff3ff', a); g.lineWidth = 2.5; g.beginPath(); g.ellipse(T.x, T.y, S.u * 0.42, S.u * 0.5, 0, 0, TAU); g.stroke(); } }
    }
    g.restore();
  },
  pillar(g, p, P, S, R) {
    const L = pts(S, P.at || 'tgs'), col = C(R, P.c, 0), a = env(p, 0.1, 0.35), w0 = S.u * (P.w || 0.5); g.save(); g.globalCompositeOperation = 'lighter';
    L.forEach((t, i) => { const q = cl((p - i * (P.step ?? 0.06)) / 0.2); if (q <= 0) return; const w = w0 * eo(q) * (1 - 0.6 * cl((p - 0.6) / 0.4)), by = t.y + S.u * 0.45; const gr = g.createLinearGradient(t.x - w, 0, t.x + w, 0); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.5, rgba(col, 0.8 * a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(t.x - w, -10, w * 2, by + 10); g.fillStyle = rgba('#ffffff', 0.7 * a); g.fillRect(t.x - w * 0.15, -10, w * 0.3, by + 10); g.beginPath(); g.ellipse(t.x, by, w * 1.3, w * 0.35, 0, 0, TAU); g.fill(); });
    g.restore();
  },
  // 暗
  ghost(g, p, P, S, R) {
    const A = pt1(S, P.at || 'from'), L = pts(S, P.to || 'tgs'), hops = Math.min(P.n || 2, L.length), c1 = C(R, P.c, 1), c0 = C(R, P.c0, 0); let prev = A;
    for (let i = 0; i < hops; i++) {
      const t = L[i], q = (p - 0.12 - i * 0.38) / 0.3, dst = { x: t.x - S.dir * S.u * 0.55, y: t.y };
      if (q > 0) {
        bug(g, prev.x, prev.y, S.u * 0.8, c1, 0.6 * cl(1 - q), S.dir); for (let k = 1; k <= 4; k++) bug(g, lerp(prev.x, dst.x, k / 5), lerp(prev.y, dst.y, k / 5), S.u * 0.75, c1, 0.2 * cl(1 - q * 0.8), S.dir);
        bug(g, dst.x, dst.y, S.u * 0.8, c0, 0.9 * cl(1.6 - q), S.dir);
        const sl = cl((q - 0.15) / 0.3); if (sl > 0 && sl < 1) brush(g, [{ x: t.x - S.u * 0.4, y: t.y - S.u * 0.5 }, { x: t.x + S.u * 0.1, y: t.y }, { x: t.x + S.u * 0.4, y: t.y + S.u * 0.4 }], S.u * 0.16, c1, 1 - sl, 0, eo(cl(sl * 2)), 0.6);
      }
      prev = dst;
    }
  },
  marks(g, p, P, S, R) {
    const L = pts(S, P.at || 'foes'), col = C(R, P.c, 1), a = env(p, 0.05, 0.2);
    L.forEach((t, i) => { const q = eo(cl((p - (P.d ?? 0.25) - i * (P.step ?? 0.07)) / 0.12)); if (q <= 0) return; const x = t.x, y = t.y - S.u * 0.78, s = S.u * 0.3 * (1.6 - 0.6 * q); g.strokeStyle = rgba(col, a * q); g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, s, 0, TAU); g.stroke(); g.fillStyle = rgba(col, a * q); g.font = `${Math.round(s * 1.1)}px ${KAI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(P.ch || '印', x, y + 1); });
  },
  claw(g, p, P, S, R) {
    const T = pt1(S, P.at || 'foeBack'), q = cl((p - (P.d ?? 0.6)) / 0.12), a = env(p, 0.02, 0.2); if (q <= 0) return;
    for (let k = 0; k < 3; k++) { const o = (k - 1) * S.u * 0.22, L = [{ x: T.x + o - S.u * 0.5, y: T.y - S.u * 0.7 }, { x: T.x + o, y: T.y - S.u * 0.1 }, { x: T.x + o + S.u * 0.2, y: T.y + S.u * 0.5 }]; brush(g, L, S.u * 0.13, P.c || '#0c0b10', a, 0, eo(q), 0.7); brush(g, L, S.u * 0.035, '#c0c0d0', a * 0.85, 0, eo(q), 0.7); }
  },
  // 血
  stream(g, p, P, S, R, r) {
    const src = pts(S, P.at || 'tg'), dst = pt1(S, P.to || 'ally'), col = C(R, P.c, 0), col2 = C(R, P.c2, 1);
    for (let i = 0, n = P.n || 46; i < n; i++) {
      const s = src[i % src.length], d = r() * 0.4, ox = (r() - 0.5) * S.u * 0.5, oy = (r() - 0.5) * S.u * 0.4, sz = 1.5 + r() * 2.5, q = eio(cl((p - 0.1 - d) / 0.5));
      if (q <= 0) { if (p > 0.03) { g.fillStyle = rgba(col, 0.9); g.beginPath(); g.arc(s.x + ox, s.y + oy - cl(p / 0.1) * S.u * 0.3, sz, 0, TAU); g.fill(); } continue; } if (q >= 1) continue;
      const pos = qbez({ x: s.x + ox, y: s.y + oy - S.u * 0.3 }, { x: (s.x + dst.x) / 2, y: Math.min(s.y, dst.y) - S.u * 1.8 }, dst, q); g.fillStyle = rgba(i % 3 ? col : col2, 0.9); g.beginPath(); g.arc(pos.x, pos.y, sz * (1 - q * 0.4), 0, TAU); g.fill();
    }
    const gl = cl((p - 0.6) / 0.3); if (gl > 0) radial(g, dst.x, dst.y, S.u * 0.75, col2, 0.6 * Math.sin(gl * Math.PI));
  },
  // 毒
  crawl(g, p, P, S, R, r) {
    const C0 = pt1(S, P.at || 'foeC'), n = P.n || 2, col = C(R, P.c, 2), Rr = S.u * (P.R || 1.7), a = env(p, 0.05, 0.2) * 0.9;
    for (let i = 0; i < n; i++) {
      const ph = i * TAU / n + r(); let x, y, ang;
      if (P.converge) { const st = { x: C0.x + Math.cos(ph) * S.u * 3.5, y: C0.y + Math.sin(ph) * S.u * 1.6 }, q = eio(cl(p / 0.55)); x = lerp(st.x, C0.x + Math.cos(ph) * S.u * 0.5, q); y = lerp(st.y, C0.y - S.u * 0.9 + Math.sin(ph) * S.u * 0.2, q); ang = Math.atan2(C0.y - st.y, C0.x - st.x); }
      else { ang = ph + p * p * 2.2 * TAU; x = C0.x + Math.cos(ang) * Rr; y = C0.y + S.u * 0.2 + Math.sin(ang) * Rr * 0.38; ang += Math.PI / 2; }
      creature(g, x, y, ang, S.u * 0.6, i % 2 ? 'scorp' : 'cent', col, a, p);
    }
  },
  bubbles(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'foes');
    L.forEach(t => { for (let i = 0, n = P.n || 5; i < n; i++) { const ox = (r() - 0.5) * S.u * 1.2, oy = (r() - 0.3) * S.u * 0.8, d = r() * 0.6, sz = S.u * (0.06 + r() * 0.1), col = r() > 0.5 ? C(R, P.c, 0) : C(R, P.c2, 1), q = (p - (P.d || 0) - d * 0.5) / 0.3; if (q < 0 || q > 1.15) continue; const x = t.x + ox, y = t.y + oy - q * S.u * 0.3; if (q < 1) { g.strokeStyle = rgba(col, 0.9); g.lineWidth = 1.4; g.fillStyle = rgba(col, 0.3); g.beginPath(); g.arc(x, y, sz * (0.4 + q), 0, TAU); g.fill(); g.stroke(); } else { g.strokeStyle = rgba(col, 0.75); g.beginPath(); for (let k = 0; k < 6; k++) { const an = k * TAU / 6; g.moveTo(x + Math.cos(an) * sz * 1.4, y + Math.sin(an) * sz * 1.4); g.lineTo(x + Math.cos(an) * sz * 2, y + Math.sin(an) * sz * 2); } g.stroke(); } } });
  },
  fog(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'foes'), a = env(p, 0.2, 0.3) * (P.a ?? 0.5);
    L.forEach(t => { for (let i = 0, n = P.n || 3; i < n; i++) { const ox = (r() - 0.5) * S.u * 1.4, oy = (r() - 0.5) * S.u * 0.6, s = S.u * (0.5 + r() * 0.5); radial(g, t.x + ox + Math.sin(p * 3 + i) * 6, t.y + oy, s * (0.6 + p * 0.8), i % 2 ? C(R, P.c2, 1) : C(R, P.c, 0), a); } });
  },
  penta(g, p, P, S, R) {
    const T = pt1(S, P.at || 'tg'), rr = S.u * (1.2 - 0.8 * cl((p - 0.6) / 0.3)) * eo(cl(p / 0.3)), x = T.x, y = T.y - S.u * 0.9, rot = p * 8, a = env(p, 0.02, 0.1); g.save(); g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba(C(R, P.c, 0), 0.95 * a); g.lineWidth = 2.5; g.beginPath(); for (let k = 0; k <= 5; k++) { const an = rot + (k * 2 % 5) * TAU / 5 - Math.PI / 2; k ? g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr * 0.5) : g.moveTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr * 0.5); } g.stroke();
    g.strokeStyle = rgba(C(R, P.c2, 1), 0.85 * a); g.beginPath(); g.ellipse(x, y, rr, rr * 0.5, 0, 0, TAU); g.stroke(); g.restore();
  },
  // 智
  web(g, p, P, S, R) {
    const Cc = cen(S.foes, S), cx = Cc.x, q = eo(cl(p / 0.35)), cy = lerp(-S.h * 0.4, Cc.y - S.u * 0.2, q), Rr = S.u * (P.R || 2.4), col = C(R, P.c, 0), a = env(p, 0.02, 0.2), sp = 9;
    if (P.elec) { g.save(); g.globalCompositeOperation = 'lighter'; }
    g.strokeStyle = rgba(col, 0.9 * a); g.lineWidth = P.elec ? 1.8 : 1.2; g.beginPath(); for (let k = 0; k < sp; k++) { const an = k * TAU / sp; g.moveTo(cx, cy); g.lineTo(cx + Math.cos(an) * Rr, cy + Math.sin(an) * Rr * 0.6); } g.stroke();
    g.beginPath(); for (let ring = 1; ring <= 5; ring++) { const rr = Rr * ring / 5.3; for (let k = 0; k <= sp; k++) { const an = k * TAU / sp, x = cx + Math.cos(an) * rr, y = cy + Math.sin(an) * rr * 0.6 + (k % 2 ? 2 : 0); k ? g.lineTo(x, y) : g.moveTo(x, y); } } g.stroke();
    if (P.elec) { for (let k = 0; k < 3; k++) { const an = (k * 3 + p * 20) % sp * TAU / sp, f = (p * 3 + k * 0.3) % 1; radial(g, cx + Math.cos(an) * Rr * f, cy + Math.sin(an) * Rr * 0.6 * f, S.u * 0.25, '#ffffff', 0.8 * a); } g.restore(); }
    else if (q >= 1) { [0, 2, 5, 7].forEach(k => { const an = k * TAU / sp; g.fillStyle = rgba('#1c1915', a); g.beginPath(); g.arc(cx + Math.cos(an) * Rr, cy + Math.sin(an) * Rr * 0.6, 3, 0, TAU); g.fill(); }); const gl = cl((p - 0.4) / 0.2); if (gl > 0 && gl < 1) star(g, cx + Math.cos(TAU / sp) * Rr * gl, cy + Math.sin(TAU / sp) * Rr * 0.6 * gl, S.u * 0.16, '#ffffff', 1 - gl); }
  },
  wrap(g, p, P, S, R) {
    const L = pts(S, P.at || 'front2'), col = C(R, P.c, 0), q = eo(cl((p - (P.d ?? 0.45)) / 0.2)), a = env(p, 0, 0.2); if (q <= 0) return;
    L.forEach((t, i) => { const j = Math.sin(p * 40 + i) * 2; g.strokeStyle = rgba(col, 0.95 * a); g.lineWidth = 1.2; g.beginPath(); for (let k = 0; k < 6; k++) { const y = t.y - S.u * 0.4 + k * S.u * 0.15 * q; g.moveTo(t.x - S.u * 0.4 + j, y); g.lineTo(t.x + S.u * 0.4 + j, y + S.u * 0.12); } for (let k = 0; k < 4; k++) { const x = t.x - S.u * 0.3 + k * S.u * 0.2; g.moveTo(x + j, t.y - S.u * 0.45); g.lineTo(x - S.u * 0.05 + j, t.y - S.u * 0.45 + S.u * 0.85 * q); } g.stroke(); });
  },
  board(g, p, P, S, R, r) {
    const Cc = cen(S.foes, S), col = C(R, P.c, 1), a = env(p, 0.1, 0.2), q = eo(cl(p / 0.2)), W = S.u * 3.4 * q, H = S.u * 1.6 * q, y0 = Cc.y - S.u * 0.2 - H / 2, n = 6, T = pt1(S, 'tg');
    const P4 = (u, v) => ({ x: Cc.x + (u - 0.5) * W * (0.75 + 0.25 * v), y: y0 + H * v });
    g.fillStyle = rgba(col, 0.1 * a); g.beginPath(); [P4(0, 0), P4(1, 0), P4(1, 1), P4(0, 1)].forEach((o, i) => i ? g.lineTo(o.x, o.y) : g.moveTo(o.x, o.y)); g.fill();
    g.strokeStyle = rgba(col, 0.6 * a); g.lineWidth = 1; g.beginPath(); for (let i = 0; i <= n; i++) { const a1 = P4(i / n, 0), b1 = P4(i / n, 1), a2 = P4(0, i / n), b2 = P4(1, i / n); g.moveTo(a1.x, a1.y); g.lineTo(b1.x, b1.y); g.moveTo(a2.x, a2.y); g.lineTo(b2.x, b2.y); } g.stroke();
    const stones = P.n || 5;
    for (let i = 0; i < stones; i++) { const u = r(), v = r(), last = i === stones - 1, pos = last ? { x: T.x, y: T.y - S.u * 0.75 } : P4(Math.round(u * n) / n, Math.round(v * n) / n), sq = cl((p - 0.2 - i * 0.09) / 0.08); if (sq <= 0) continue; g.fillStyle = rgba(i % 2 ? '#efe7d4' : '#15130f', a); g.strokeStyle = rgba('#efe7d4', a * 0.6); g.beginPath(); g.ellipse(pos.x, pos.y - (1 - eo(sq)) * S.u * 1.2, S.u * 0.12, S.u * 0.08, 0, 0, TAU); g.fill(); g.stroke(); }
    const ch = cl((p - (0.25 + stones * 0.09)) / 0.25); if (ch > 0) { g.save(); g.setLineDash([5, 4]); g.lineDashOffset = -p * 60; g.strokeStyle = rgba(C(R, P.c2, 0), a); g.lineWidth = 3; g.beginPath(); g.ellipse(T.x, T.y, S.u * 0.55 * (1.6 - 0.6 * ch), S.u * 0.25 * (1.6 - 0.6 * ch), 0, 0, TAU); g.stroke(); g.restore(); }
  },
  // 魂
  shell(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), col = C(R, P.c, 0), a = env(p, 0.02, 0.15), crack = cl((p - 0.15) / 0.15), out = eo(cl((p - 0.3) / 0.3)), shat = cl((p - 0.65) / 0.3);
    if (shat <= 0) { g.fillStyle = rgba(col, a); g.strokeStyle = rgba('#1c1915', a); g.lineWidth = 1.5; g.beginPath(); g.ellipse(A.x, A.y, S.u * 0.4, S.u * 0.3, 0, 0, TAU); g.fill(); g.stroke(); if (crack > 0) brush(g, [{ x: A.x - S.u * 0.3, y: A.y - S.u * 0.1 }, { x: A.x, y: A.y - S.u * 0.25 }, { x: A.x + S.u * 0.3, y: A.y - S.u * 0.1 }], 3, '#fff6d0', a, 0, crack, 0); }
    else for (let k = 0; k < 6; k++) { const vx = (r() - 0.5) * S.u * 2, vy = -r() * S.u, rot = (r() - 0.5) * 6; g.save(); g.translate(A.x + vx * shat, A.y + vy * shat + S.u * 2 * shat * shat); g.rotate(shat * rot); g.fillStyle = rgba(col, a * (1 - shat)); g.strokeStyle = rgba('#1c1915', a * (1 - shat)); g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, 0, S.u * 0.15, S.u * 0.11, k, 0, TAU); g.fill(); g.stroke(); g.restore(); }
    if (out > 0) { const x = A.x - S.dir * S.u * 0.9 * out, y = A.y - S.u * 0.9 * Math.sin(out * Math.PI); bug(g, x, y, S.u * 0.75, C(R, P.c2, 1), 0.6 * a, S.dir); radial(g, x, y, S.u * 0.45, '#fff6d0', 0.35 * a); }
  },
  soul(g, p, P, S, R) {
    const A = pt1(S, P.at || 'from'), B = pt1(S, P.to || 'ally'), col = C(R, P.c, 1), a = env(p, 0.05, 0.12), top = A.y - S.u * 1.3; let x, y;
    if (p < 0.35) { x = A.x; y = lerp(A.y, top, eo(p / 0.35)); } else if (p < 0.7) { const q = (p - 0.35) / 0.35, an = q * TAU - Math.PI / 2; x = A.x + Math.cos(an) * S.u * 0.6 * Math.sin(q * Math.PI); y = top + (Math.sin(an) + 1) * S.u * 0.3; } else { const q = eio(cl((p - 0.7) / 0.25)); x = lerp(A.x, B.x, q); y = lerp(top, B.y, q); }
    g.save(); g.globalCompositeOperation = 'lighter'; radial(g, x, y, S.u * 0.34, col, 0.9 * a); radial(g, x, y + S.u * 0.2, S.u * 0.2, col, 0.45 * a); g.restore();
    if (p > 0.9) { const q = (p - 0.9) / 0.1; g.strokeStyle = rgba(col, (1 - q) * a); g.lineWidth = 2.5; g.beginPath(); g.ellipse(B.x, B.y, S.u * 0.45, S.u * 0.52, 0, 0, TAU); g.stroke(); }
  },
  // 奴
  ants(g, p, P, S, R) {
    const L = pts(S, 'allies'), back = L.slice().sort((a, b) => (a.x - b.x) * S.dir)[0] || S.from, ac = cen(L, S), hole = { x: ac.x + S.dir * S.u * 0.9, y: ac.y + S.u * 0.8 }, col = C(R, P.c, 0), a = env(p, 0.03, 0.15), op = eo(cl(p / 0.15));
    g.fillStyle = rgba('#0c0a08', 0.85 * a); g.beginPath(); g.ellipse(hole.x, hole.y, S.u * 0.4 * op + 0.1, S.u * 0.13 * op + 0.1, 0, 0, TAU); g.fill();
    const dest = { x: back.x - S.dir * S.u * 0.9, y: back.y + S.u * 0.3 };
    for (let i = 0, n = P.n || 9; i < n; i++) { const q = eio(cl((p - 0.12 - i * 0.05) / 0.45)); if (q <= 0) continue; const end = { x: dest.x - S.dir * (i % 3) * S.u * 0.22, y: dest.y + (Math.floor(i / 3) - 1) * S.u * 0.25 }, pos = qbez(hole, { x: (hole.x + end.x) / 2, y: Math.min(hole.y, end.y) - S.u * 1.2 }, end, q); ant(g, pos.x, pos.y, S.u * (0.25 + 0.25 * q), col, a, -S.dir); }
  },
  threads(g, p, P, S, R) {
    const L = pts(S, P.at || 'tg'), col = C(R, P.c, 0), a = env(p, 0.02, 0.15), q = eo(cl(p / 0.3)), lift = eo(cl((p - 0.35) / 0.3)) * S.u * 0.45;
    L.forEach((t, i) => {
      const sway = Math.sin(p * 9 + i) * S.u * 0.15 * cl((p - 0.5) / 0.2);
      for (let k = -1; k <= 1; k++) { const x = t.x + k * S.u * 0.22 + sway, x0 = x + k * S.u * 0.5; g.strokeStyle = rgba(col, 0.9 * a); g.lineWidth = 1.3; g.beginPath(); g.moveTo(x0, -10); g.lineTo(lerp(x0, x, q), lerp(-10, t.y - S.u * 0.3 - lift, q)); g.stroke(); }
      if (lift > 0) bug(g, t.x + sway, t.y - lift, S.u * 0.7, '#1c1915', 0.5 * a, -S.dir);
      if (p > 0.7) { const e = cl((p - 0.7) / 0.1); [-1, 1].forEach(k => { g.fillStyle = rgba(S.sideCol, a * e); g.beginPath(); g.arc(t.x + sway + k * S.u * 0.1, t.y - lift - S.u * 0.15, 2.8, 0, TAU); g.fill(); }); }
    });
  },
  converge(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), col = C(R, P.c, 0), a = env(p, 0.05, 0.2);
    for (let i = 0, n = P.n || 60; i < n; i++) { const an = r() * TAU, d0 = Math.max(S.w, S.h) * (0.6 + r() * 0.3), d = r() * 0.3, q = eio(cl((p - d) / 0.55)), rr = lerp(d0, S.u * (0.75 + 0.15 * Math.sin(i)), q), an2 = an + q * 1.2 + Math.max(0, p - d - 0.55) * 2; g.fillStyle = rgba(col, a); g.beginPath(); g.ellipse(A.x + Math.cos(an2) * rr, A.y + Math.sin(an2) * rr * 0.5, 2.8, 1.7, an2 + Math.PI / 2, 0, TAU); g.fill(); }
  },
  urn(g, p, P, S, R) {
    const A = pt1(S, P.at || 'mid'), s = S.u * 0.95 * eo(cl(p / 0.25)), x = A.x, y = A.y - S.u * 0.2; if (s < 1) return;
    g.save(); g.globalAlpha = env(p, 0.05, 0.2); g.fillStyle = C(R, P.c, 0); g.strokeStyle = '#1c1915'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - s * 0.25, y - s * 0.55); g.lineTo(x + s * 0.25, y - s * 0.55); g.quadraticCurveTo(x + s * 0.2, y - s * 0.4, x + s * 0.5, y - s * 0.1); g.quadraticCurveTo(x + s * 0.6, y + s * 0.45, x, y + s * 0.5); g.quadraticCurveTo(x - s * 0.6, y + s * 0.45, x - s * 0.5, y - s * 0.1); g.quadraticCurveTo(x - s * 0.2, y - s * 0.4, x - s * 0.25, y - s * 0.55); g.fill(); g.stroke();
    g.fillStyle = '#0c0a08'; g.beginPath(); g.ellipse(x, y - s * 0.55, s * 0.25, s * 0.07, 0, 0, TAU); g.fill(); g.restore();
  },
  vortex(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'tg'), col = C(R, P.c, 0), col2 = C(R, P.c2, 1), a = env(p, 0.1, 0.2), Rm = S.u * (P.R || 1.8), rot = p * TAU * (P.turns || 2);
    for (let k = 0; k < 3; k++) { const L = []; for (let i = 0; i <= 24; i++) { const u = i / 24, an = rot + k * TAU / 3 + u * 5, rr = Rm * (1 - u); L.push({ x: A.x + Math.cos(an) * rr, y: A.y + Math.sin(an) * rr * 0.45 }); } brush(g, L, 3.5, col, 0.6 * a, 0, 1, 0.6); }
    for (let i = 0, n = P.n || 70; i < n; i++) { const an0 = r() * TAU, o = r(), sp = 0.6 + r() * 0.8, u = (o + p * sp * 1.5) % 1, an = an0 + u * 6 + rot, rr = Rm * (1 - u) * 1.15; g.fillStyle = rgba(i % 3 ? col2 : col, a * (0.4 + 0.6 * u)); g.fillRect(A.x + Math.cos(an) * rr, A.y + Math.sin(an) * rr * 0.45, 2.2, 2.2); }
    radial(g, A.x, A.y, S.u * 0.35, '#000000', 0.6 * a);
  },
  // 宇、宙
  fold(g, p, P, S, R) {
    const c = { x: S.w / 2, y: S.h * 0.5 }, col = C(R, P.c, 0), a = env(p, 0.05, 0.2), f = Math.sin(cl((p - 0.15) / 0.55) * Math.PI);
    g.save(); g.globalCompositeOperation = 'lighter'; radial(g, c.x, c.y, S.u * (0.3 + 0.15 * Math.sin(p * 20)) * (1 + f), col, 0.95 * a); g.restore();
    for (let i = 0, n = 8; i < n; i++) { const u = (i + 0.5) / n - 0.5, x = c.x + u * S.w * (1 - 0.85 * f), w = S.w / n * (1 - 0.85 * f); g.fillStyle = rgba(i % 2 ? '#000000' : '#ffffff', 0.14 * f * a); g.fillRect(x - w / 2, -S.h, w, S.h * 3); g.strokeStyle = rgba(col, 0.6 * f * a); g.lineWidth = 1; g.beginPath(); g.moveTo(x - w / 2, -S.h); g.lineTo(x - w / 2, S.h * 2); g.stroke(); }
    const ch = cl((p - 0.7) / 0.25); if (ch > 0) pts(S, 'allies').forEach(t => { for (let k = 0; k < 2; k++) { const x = t.x + S.dir * (S.u * 0.3 + ch * S.u * 0.6 + k * 8), y = t.y - S.u * 0.2; g.strokeStyle = rgba(col, (1 - ch) * a); g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - S.dir * 6, y - 7); g.lineTo(x, y); g.lineTo(x - S.dir * 6, y + 7); g.stroke(); } });
  },
  sweep(g, p, P, S, R) {
    const col = C(R, P.c, 0), a = env(p, 0.05, 0.2), q = cl(p / 0.6), x = lerp(S.w * 0.92, S.w * 0.08, q), y = S.h * 0.2 - Math.sin(q * Math.PI) * S.h * 0.1;
    g.save(); g.globalCompositeOperation = 'lighter'; radial(g, x, y, S.u * 1.2, col, 0.5 * a); g.fillStyle = rgba('#fff6dc', a); g.beginPath(); g.arc(x, y, S.u * 0.28, 0, TAU); g.fill();
    const bx = lerp(-S.w * 0.2, S.w * 1.2, q), gr = g.createLinearGradient(bx - S.u * 1.5, 0, bx + S.u * 1.5, 0); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.5, rgba(col, 0.35 * a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(bx - S.u * 1.5, -S.h, S.u * 3, S.h * 3); g.restore();
    pts(S, 'allies').forEach((t, i) => { for (let k = 0; k < 3; k++) { const rq = cl((p - 0.45 - i * 0.04 - k * 0.08) / 0.3); if (rq <= 0) continue; g.strokeStyle = rgba(C(R, P.c2, 1), (1 - rq * 0.6) * a); g.lineWidth = 1.5; g.beginPath(); g.ellipse(t.x, t.y, S.u * (0.2 + rq * 0.3 + k * 0.1), S.u * (0.25 + rq * 0.3 + k * 0.1), 0, 0, TAU); g.stroke(); } });
  },
  clock(g, p, P, S, R) {
    const A = pt1(S, P.at || 'from'), col = C(R, P.c, 0), a = env(p, 0.08, 0.2), rr = S.u * 0.85 * eo(cl(p / 0.25)), hand = -Math.PI / 2 + eio(cl((p - 0.2) / 0.6)) * TAU; if (rr < 1) return;
    g.strokeStyle = rgba(col, a); g.lineWidth = 2; g.beginPath(); g.arc(A.x, A.y, rr, 0, TAU); g.stroke(); g.beginPath(); for (let k = 0; k < 12; k++) { const an = k * TAU / 12; g.moveTo(A.x + Math.cos(an) * rr * 0.85, A.y + Math.sin(an) * rr * 0.85); g.lineTo(A.x + Math.cos(an) * rr, A.y + Math.sin(an) * rr); } g.stroke();
    g.fillStyle = rgba(col, 0.2 * a); g.beginPath(); g.moveTo(A.x, A.y); g.arc(A.x, A.y, rr, -Math.PI / 2, hand); g.closePath(); g.fill(); g.lineWidth = 3; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(A.x + Math.cos(hand) * rr * 0.75, A.y + Math.sin(hand) * rr * 0.75); g.stroke();
  },
  slashes(g, p, P, S, R) {
    const T = pt1(S, P.at || 'tg'), col = C(R, P.c2, 1);
    for (let k = 0, n = P.n || 2; k < n; k++) { const st = (P.d ?? 0.3) + k * 0.16, q = cl((p - st) / 0.1), fade = cl(1 - (p - st - 0.1) / 0.35); if (q <= 0 || fade <= 0) continue; const ang = k % 2 ? -0.6 : 0.6, L = S.u * 1.2, a0 = { x: T.x - Math.cos(ang) * L, y: T.y - Math.sin(ang) * L * 0.8 - S.u * 0.2 }, b0 = { x: T.x + Math.cos(ang) * L, y: T.y + Math.sin(ang) * L * 0.8 - S.u * 0.2 }; g.save(); g.globalCompositeOperation = 'lighter'; brush(g, [a0, b0], S.u * 0.2, col, 0.6 * fade, 0, eo(q), 0.5); brush(g, [a0, b0], S.u * 0.06, '#ffffff', fade, 0, eo(q), 0.5); g.restore(); }
  },
  // 其它
  hail(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'tg'), ci = C(R, P.c, 0), lv = C(R, P.c2, 1), a = env(p, 0.02, 0.15);
    for (let i = 0, n = P.n || 16; i < n; i++) { const ox = (r() - 0.5) * S.u * 1.6, d = r() * 0.5, q = cl((p - d) / 0.3); if (q <= 0 || q >= 1) continue; if (i % 2 === 0) { const x = A.x + ox, y = lerp(-10, A.y, ei(q)); g.fillStyle = rgba('#ffffff', a); g.strokeStyle = rgba(ci, a); g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 4, y); g.lineTo(x, y + 5); g.lineTo(x - 4, y); g.closePath(); g.fill(); g.stroke(); } else radial(g, A.x + ox * 0.6, lerp(A.y + S.u * 0.5, A.y - S.u * 1.2, eo(q)) + q * q * S.u, S.u * 0.16, lv, a); }
  },
  ding(g, p, P, S, R) {
    const A = pt1(S, P.at || 'tg'), d0 = P.d ?? 0.35, q = eo(cl((p - d0) / 0.2)), bur = cl((p - d0 - 0.3) / 0.25), a = env(p, 0, 0.1); if (q <= 0) return; const s = S.u * 0.85 * q, x = A.x, y = A.y - S.u * 1.1;
    if (bur < 1) { g.save(); g.globalAlpha = a * (1 - bur); g.strokeStyle = '#1c1915'; g.fillStyle = rgba(C(R, P.c2, 2), 0.88); g.lineWidth = 2; g.beginPath(); g.moveTo(x - s * 0.6, y - s * 0.3); g.lineTo(x + s * 0.6, y - s * 0.3); g.quadraticCurveTo(x + s * 0.65, y + s * 0.35, x, y + s * 0.38); g.quadraticCurveTo(x - s * 0.65, y + s * 0.35, x - s * 0.6, y - s * 0.3); g.fill(); g.stroke(); g.beginPath(); [-0.35, 0, 0.35].forEach(k => { g.moveTo(x + k * s, y + s * 0.3); g.lineTo(x + k * s * 1.2, y + s * 0.65); }); [-1, 1].forEach(k => { g.moveTo(x + k * s * 0.45, y - s * 0.3); g.lineTo(x + k * s * 0.45, y - s * 0.55); g.lineTo(x + k * s * 0.25, y - s * 0.55); g.lineTo(x + k * s * 0.25, y - s * 0.3); }); g.stroke(); g.restore(); }
    if (bur > 0 && bur < 1) { g.save(); g.globalCompositeOperation = 'lighter'; radial(g, x, y, S.u * (0.4 + bur * 1.6), C(R, P.c2, 1), 0.85 * (1 - bur)); radial(g, x, y, S.u * (0.3 + bur * 1.2), C(R, P.c, 0), 0.65 * (1 - bur)); g.restore(); }
  },
  spikes(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'tgs'), col = C(R, P.c, 0), a = env(p, 0.02, 0.25), xs = L.map(t => t.x), x0 = S.dir > 0 ? Math.min(...xs) - S.u : Math.max(...xs) + S.u, x1 = S.dir > 0 ? Math.max(...xs) + S.u : Math.min(...xs) - S.u;
    L.forEach(t => { for (let i = 0, n = P.n || 3; i < n; i++) { const ox = (r() - 0.5) * S.u * 1.1, h = S.u * (0.5 + r() * 0.5), w = S.u * 0.15, jit = r() * 0.15, st = (P.d ?? 0.1) + (P.seq ? cl((t.x + ox - x0) / (x1 - x0 || 1)) * 0.4 : jit), q = eo(cl((p - st) / 0.12)); if (q <= 0) continue; const x = t.x + ox, by = t.y + S.u * 0.5; g.fillStyle = rgba(col, 0.95 * a); g.strokeStyle = rgba('#1c1915', 0.8 * a); g.lineWidth = 1; g.beginPath(); g.moveTo(x - w, by); g.lineTo(x + (r() - 0.5) * 2, by - h * q); g.lineTo(x + w, by); g.closePath(); g.fill(); g.stroke(); } });
  },
  swords(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'foes'), col = C(R, P.c, 1), ang = P.ang ?? 0.35;
    for (let i = 0, n = P.n || 18; i < n; i++) { const t = L[i % L.length], ox = (r() - 0.5) * S.u * 1.4, oy = (r() - 0.5) * S.u * 0.5, d = r() * 0.55, q = cl((p - d) / 0.18), stay = cl((p - d - 0.18) / 0.3); if (q <= 0 || stay >= 1) continue; const tx = t.x + ox, ty = t.y + S.u * 0.4 + oy, sx = tx - Math.sin(ang) * S.h * S.dir, sy = ty - S.h, hx = lerp(sx, tx, ei(q)), hy = lerp(sy, ty, ei(q)), dl = Math.hypot(tx - sx, ty - sy), ux = (tx - sx) / dl, uy = (ty - sy) / dl, len = S.u * 0.7, aa = 1 - stay; g.strokeStyle = rgba(col, aa); g.lineWidth = 2.2; g.beginPath(); g.moveTo(hx - ux * len, hy - uy * len); g.lineTo(hx, hy); g.stroke(); g.strokeStyle = rgba('#1c1915', aa); g.lineWidth = 3; g.beginPath(); g.moveTo(hx - ux * len, hy - uy * len); g.lineTo(hx - ux * len * 0.78, hy - uy * len * 0.78); g.moveTo(hx - ux * len * 0.78 - uy * 5, hy - uy * len * 0.78 + ux * 5); g.lineTo(hx - ux * len * 0.78 + uy * 5, hy - uy * len * 0.78 - ux * 5); g.stroke(); }
  },
  wind(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), L = pts(S, P.to || 'tgs'), col = C(R, P.c, 1);
    for (let i = 0, n = P.n || 6; i < n; i++) { const t = L[i % L.length], d = r() * 0.4, oy = (r() - 0.5) * S.u * 0.8, q = cl((p - d) / 0.35); if (q <= 0 || q >= 1) continue; const s = S.u * 0.42; g.save(); g.translate(lerp(A.x, t.x + S.dir * S.u * 0.8, eo(q)), lerp(A.y + oy, t.y + oy * 0.3, eo(q))); g.scale(S.dir, 1); g.strokeStyle = rgba(col, 0.9 * (1 - q * 0.5)); g.lineWidth = 2.6; g.beginPath(); g.arc(-s * 0.6, 0, s, -0.9, 0.9); g.stroke(); g.lineWidth = 1; g.beginPath(); g.arc(-s * 0.95, 0, s * 0.8, -0.7, 0.7); g.stroke(); g.restore(); }
  },
  swap(g, p, P, S, R) {
    const A = pt1(S, P.at || 'from'), B = pt1(S, P.to || 'ally'), col = C(R, P.c, 1), q = eio(cl((p - 0.15) / 0.5)), a = env(p, 0.05, 0.15);
    [[A, B, -1], [B, A, 1]].forEach(([u, v, k]) => { for (let j = 0; j < 5; j++) { const qq = cl(q - j * 0.06); bug(g, lerp(u.x, v.x, qq), lerp(u.y, v.y, qq) + k * Math.sin(qq * Math.PI) * S.u * 0.8, S.u * 0.7, col, (j ? 0.15 : 0.75) * a, S.dir); } });
  },
  moon(g, p, P, S) {
    const x = S.w * (S.dir > 0 ? 0.3 : 0.7), y = S.h * 0.14, rr = S.u * 0.55, a = env(p, 0.15, 0.2); g.save(); g.globalCompositeOperation = 'lighter'; radial(g, x, y, rr * 2.5, '#dfe6ff', 0.3 * a); g.restore();
    g.fillStyle = rgba('#eef0f6', a); g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); g.fillStyle = rgba('#000000', 0.12 * a); g.beginPath(); g.arc(x - rr * 0.3, y + rr * 0.15, rr * 0.18, 0, TAU); g.arc(x + rr * 0.25, y - rr * 0.25, rr * 0.12, 0, TAU); g.fill();
  },
});

// ---------- 配方：每个杀招一份（[特效, 起 ms, 止 ms, 参数]，镜头 [推/拉/摇/震, 起, 止, 量, 锚点]） ----------
const X = (id, n, seal, c, dur, nm, L, cam = [], o = {}) => ({ id, n, seal, c, dur, nm, L, cam, ...o });
const D = (a = 0.38, c) => ['dim', 0, 99999, { a, c }];
const COMBO_FX = Object.fromEntries([
  // 力
  X('sanzhu', '烈火三豕冲', '力', ['#b5301f', '#e08a3a'], 1900, 1250, [D(0.38), ['charge', 100, 1200, { n: 3, gap: 0.14, len: 0.5 }], ['scorch', 500, 1900, { n: 3 }], ['embers', 600, 1800, { n: 30, up: 1 }]], [['tilt', 0, 1900, 10], ['shake', 380, 540, 6], ['shake', 560, 720, 6], ['shake', 740, 920, 6]]),
  X('pozhen', '擂鼓破阵', '力', ['#b5301f', '#1c1915'], 2000, 1300, [D(0.3), ['drum', 0, 1800, { beats: [0.36, 0.56, 0.7], s: 1.4, lift: 0.6 }], ['rings', 0, 1800, { at: 'allyC', ts: [0.36, 0.56, 0.7], R: 3.2, c: 1 }], ['glow', 1200, 2000, { stripe: 1 }]], [['push', 1240, 1700, 1.12, 'mid'], ['shake', 1260, 1420, 4]]),
  X('huangzai', '蝗过千里', '力', ['#7a6a2a', '#3a3a1a'], 1900, 1200, [D(0.3), ['stain', 300, 1900, { c: '#a08a3a', a: 0.4, in: 0.5 }], ['swarm', 0, 1600, { n: 220, start: 'br' }]], [['pan', 0, 1700, -16]]),
  // 炎
  X('fenshen', '焚身诀', '炎', ['#d0632a', '#7a1a10'], 2000, 1250, [D(0.35), ['burst', 0, 1300, { b: 0.3, n: 16, R: 2.6 }], ['dim', 450, 1500, { c: '#d0632a', a: 0.28 }], ['embers', 900, 2000, { n: 40, c: 0 }]], [['zoom', 0, 1000, 0.9, 'tg'], ['shake', 400, 600, 5]]),
  X('lieyang', '烈阳焚野', '炎', ['#f0b03a', '#d0632a'], 2300, 1500, [D(0.32, '#1a0e05'), ['sun', 0, 2300, { rise: 0.42, rays: 18, s: 0.6 }], ['haze', 600, 2200, {}], ['carpet', 1400, 2300, { in: 0.04, n: 8 }]], [['tilt', 0, 1200, -12]]),
  // 冰
  X('bingfeng', '冰火两重', '冰', ['#6a9cc0', '#d0632a'], 1900, 1200, [['split', 0, 1900, { a: 0.28 }], ['helix', 250, 1500, { h: 2.3 }], ['shards', 1300, 1900, { n: 26 }]], [['zoom', 0, 1900, 1.08, 'tg']]),
  X('hanchuan', '寒川锁江', '冰', ['#a8c8e0', '#ffffff'], 2100, 1300, [D(0.32, '#0b1420'), ['iceline', 0, 1500, { n: 30 }], ['icicle', 0, 1900, { d: 0.35 }], ['snow', 800, 2100, { n: 50 }]], [['zoom', 0, 2100, 0.94, 'mid']]),
  // 金
  X('jinjia', '金甲不坏身', '金', ['#a8803e', '#e8c76a'], 2000, 1300, [D(0.3), ['plates', 0, 1600, { n: 12, step: 0.045 }], ['crack', 1050, 2000, { R: 1.3, n: 8 }], ['glow', 1100, 1700, { at: 'from', c: 1 }]], [['pan', 0, 1700, 20], ['zoom', 0, 1800, 1.12, 'from']]),
  X('kaishan', '开山断岳', '金', ['#8a6a3a', '#c0c0c0'], 1800, 1150, [D(0.42), ['blade', 0, 1300, {}], ['debris', 600, 1500, {}], ['crack', 600, 1800, { at: 'tg', R: 1, n: 5 }]], [['zoom', 0, 650, 1.1, 'tg'], ['shake', 600, 820, 7]]),
  // 木
  X('pojian', '破茧成蝶', '木', ['#5e8a4a', '#e8d8f0'], 2400, 1600, [D(0.3, '#100c14'), ['cocoon', 0, 1700, {}], ['wings', 600, 2400, { d: 0.25, s: 1.5 }]], [['zoom', 0, 2400, 1.08, 'from']]),
  X('burou', '肉身不朽', '木', ['#7a9a5a', '#c0a080'], 2100, 1400, [D(0.3), ['blobs', 0, 1500, { n: 8 }], ['sprouts', 1000, 2100, { onBody: 1, n: 10 }], ['glow', 1300, 2100, { at: 'from' }]], [['zoom', 0, 2000, 1.15, 'from']]),
  // 土
  X('xuanwu', '玄武镇关', '土', ['#4a5a4a', '#8a6a3a'], 2100, 1400, [D(0.3), ['mountain', 0, 1500, { mode: 'sink', s: 2.2 }], ['hexes', 900, 2100, {}], ['dust', 600, 2100, {}]], [['tilt', 0, 2100, 14], ['zoom', 0, 2100, 1.06, 'from']]),
  X('liusha', '流沙陷阵', '土', ['#c0a060', '#6a5030'], 2000, 1300, [D(0.3), ['funnel', 0, 1900, {}], ['dust', 900, 2000, { at: 'front', n: 14, wide: 1.4 }]], [['zoom', 0, 1900, 1.1, 'front']]),
  X('banshan', '搬山移海', '土', ['#8a6a3a', '#4a3a2a'], 2000, 1300, [D(0.3), ['rock', 0, 1600, {}], ['debris', 0, 500, { at: 'front', c: '#4a3a2a' }], ['dust', 1100, 2000, { at: 'foeBack' }]], [['pan', 300, 1500, 18], ['shake', 1100, 1300, 4]]),
  // 雷
  X('leigu', '雷鼓破天', '雷', ['#3a6aa8', '#ffffff'], 1600, 1000, [D(0.45, '#05070d'), ['drum', 0, 1100, { at: 'from', beats: [0.35], s: 0.8, lift: 1.3 }], ['chain', 350, 1100, { n: 2, c: 0 }], ['flash', 450, 560, { a: 0.6 }], ['flash', 750, 860, { a: 0.6 }]], [['shake', 450, 600, 4], ['shake', 750, 900, 4]]),
  X('jiutian', '九天引雷', '雷', ['#5a8ad0', '#e8e070'], 2000, 1300, [D(0.55, '#03050a'), ['motes', 0, 900, { fly: 0.7 }], ['bolts', 900, 1500, { c: 0 }], ['flash', 900, 1100, { n: 2, a: 0.8 }]], [['tilt', 0, 1000, -14], ['zoom', 1000, 2000, 0.95, 'foeC']]),
  X('chunlei', '春雷乍惊', '雷', ['#6a8ac0', '#9ac070'], 2000, 1300, [D(0.3), ['band', 0, 1100, { y: 0.12 }], ['sprouts', 500, 2000, { at: 'foes', n: 6, c: 1, wide: 1.6 }], ['stars', 800, 2000, {}], ['flash', 600, 700, { a: 0.35 }]], [['zoom', 0, 2000, 0.92, 'mid']]),
  // 光
  X('liuying', '流萤焚夜', '光', ['#e7d77a', '#1c1915'], 2300, 1500, [D(0.62, '#04050c'), ['meteor', 0, 2000, { n: 70 }], ['carpet', 1600, 2300, { n: 4, h: 0.6, c: '#e2672e', c2: '#f6c24a' }]], [['zoom', 0, 2300, 1.04, 'foeC']]),
  X('jinghua', '镜花水月', '光', ['#c0d8e8', '#e8a0c0'], 1900, 1200, [D(0.35, '#0a0c12'), ['mirror', 0, 1900, {}]], [['zoom', 0, 1900, 1.08, 'from']]),
  X('liguang', '琉璃照影', '光', ['#f0e8c0', '#80c0e0'], 1900, 1250, [D(0.45), ['prism', 0, 1900, {}]], [['pan', 0, 1900, 10]]),
  // 暗
  X('duopo', '噬心夺魄', '暗', ['#3a3346', '#8a1f2b'], 1700, 1100, [D(0.5, '#07050a'), ['ghost', 0, 1500, { n: 2 }]], [['push', 250, 700, 1.1, 'tg'], ['push', 900, 1350, 1.1, 'tg']]),
  X('yeshi', '夜蚀', '暗', ['#1c1915', '#c0c0d0'], 2300, 1500, [['eclipse', 0, 2300, {}], ['marks', 900, 2100, { d: 0.15, step: 0.08, ch: '蚀' }], ['claw', 1500, 2100, { d: 0.3 }]], [['zoom', 0, 2300, 0.96, 'mid']]),
  // 血
  X('chichao', '赤潮', '血', ['#8a1f2b', '#d04050'], 2000, 1300, [D(0.4, '#0e0406'), ['stream', 0, 1800, {}]], [['pan', 0, 1800, -14]]),
  // 毒
  X('wudu', '五毒噬心', '毒', ['#4f7a3a', '#6a3a7a'], 2100, 1400, [D(0.35), ['crawl', 0, 1800, { n: 2 }], ['bubbles', 300, 2000, { n: 4 }], ['fog', 1000, 2100, { a: 0.4 }]], [['zoom', 0, 2100, 0.95, 'foeC']]),
  // 智
  X('tianluo', '天罗地网', '智', ['#d8d0c0', '#1c1915'], 1900, 1250, [D(0.45), ['web', 0, 1900, { R: 2.5 }], ['wrap', 0, 1900, { d: 0.5 }]], [['tilt', 0, 900, -10]]),
  X('suanwu', '算无遗策', '智', ['#3d5a8a', '#e8e0c0'], 2200, 1450, [D(0.4), ['board', 0, 2200, { n: 5, c: 1, c2: 0 }]], [['zoom', 0, 2200, 1.05, 'foeC']]),
  // 魂
  X('tuoke', '金蝉脱壳', '魂', ['#c8a040', '#efe7d4'], 1900, 1250, [D(0.4), ['mono', 0, 450, {}], ['shell', 0, 1900, {}]], [['push', 0, 500, 1.15, 'from'], ['pan', 400, 1200, -12]]),
  X('shijie', '尸解登仙', '魂', ['#5a4a7a', '#e8e0f0'], 2300, 1500, [D(0.45, '#0a0810'), ['embers', 0, 1000, { at: 'from', n: 40, c: '#8a8a8a' }], ['soul', 200, 2200, {}], ['pillar', 1800, 2300, { at: 'ally', c: 1, w: 0.35 }]], [['zoom', 0, 2300, 1.06, 'from']]),
  // 奴
  X('baiyi', '百蚁噬象', '奴', ['#9a4a2c', '#1c1915'], 2100, 1400, [D(0.3), ['ants', 0, 2000, { n: 9 }]], [['tilt', 0, 2000, 10]]),
  X('tixian', '提线百傀', '奴', ['#8a3030', '#d8d0c0'], 2100, 1400, [D(0.45), ['threads', 0, 2100, {}]], [['tilt', 0, 2100, -12]]),
  // 宇、宙
  X('xumi', '芥子纳须弥', '宇', ['#4a8a86', '#efe7d4'], 2200, 1500, [D(0.35), ['fold', 0, 2200, {}]], [['squash', 300, 1500, 0.5], ['zoom', 0, 2200, 0.92, 'mid']]),
  X('yiri', '一日千秋', '宙', ['#d8c890', '#8a7a3a'], 2100, 1400, [D(0.35), ['sweep', 0, 2100, {}]], [['pan', 0, 1500, -12]]),
  X('chana', '刹那芳华', '宙', ['#8a7a3a', '#ffffff'], 1700, 1150, [['mono', 0, 1300, {}], D(0.25), ['slashes', 0, 1600, { n: 2, d: 0.3 }]], [['push', 450, 950, 1.12, 'tg']]),
  // 进阶
  X('sanzhu2', '焚原三豕', '力', ['#b5301f', '#e08a3a', '#3a3a1a'], 2400, 1600, [D(0.45), ['charge', 0, 1100, { n: 3, gap: 0.12, len: 0.5 }], ['swarm', 300, 1500, { n: 200, burn: 1, c: 2 }], ['firewall', 900, 2100, { h: 1.3 }], ['scorch', 1500, 2400, { n: 3 }]], [['zoom', 0, 2400, 0.9, 'mid'], ['shake', 1000, 1500, 5]], { adv: 1 }),
  X('jinjia2', '万钧金身', '金', ['#a8803e', '#e8c76a', '#c0c0c0'], 2300, 1550, [D(0.35), ['plates', 0, 1300, { n: 12, step: 0.04 }], ['plates', 900, 2000, { quill: 1, n: 10, step: 0.035 }], ['crack', 1300, 2300, { R: 2.2, n: 11 }], ['glow', 1500, 2100, { at: 'from', c: 2 }]], [['pan', 0, 2000, 28], ['zoom', 0, 2000, 1.15, 'from'], ['roll', 0, 2000, 2]], { adv: 1 }),
  X('pojian2', '化蝶三生', '木', ['#5e8a4a', '#e8d8f0', '#f0c050'], 2600, 1750, [D(0.35, '#0c0a10'), ['tree', 0, 2600, {}], ['cocoon', 0, 1300, {}], ['flit', 500, 2600, {}]], [['zoom', 0, 2600, 0.94, 'from'], ['pan', 0, 2600, 10]], { adv: 1 }),
  X('xuanwu2', '玄武负山', '土', ['#4a5a4a', '#8a6a3a', '#b5301f'], 2400, 1600, [D(0.35), ['mountain', 0, 1500, { mode: 'sink', s: 2.2 }], ['mountain', 700, 2400, { s: 3, dx: -1.5, a: 0.7, peaks: [[-0.55, 0.4], [-0.3, 0.75], [0, 1], [0.3, 0.75], [0.55, 0.4]] }], ['flag', 0, 2400, { d: 0.55 }], ['hexes', 900, 2400, {}]], [['tilt', 0, 2400, 14], ['zoom', 0, 2400, 1.08, 'from']], { adv: 1 }),
  X('leigu2', '雷霆万钧', '雷', ['#3a6aa8', '#ffffff', '#a0a0ff'], 2200, 1450, [D(0.5, '#05050d'), ['drum', 0, 1200, { at: 'from', beats: [0.25, 0.45, 0.65], s: 0.8, lift: 1.3 }], ['web', 600, 2100, { R: 2.4, c: 2, elec: 1 }], ['chain', 800, 1500, { n: 3, c: 2 }], ['flash', 800, 900, { a: 0.6 }], ['flash', 1100, 1200, { a: 0.6 }], ['flash', 1400, 1500, { a: 0.6 }]], [['tilt', 600, 2000, -10]], { adv: 1 }),
  X('jiutian2', '九霄雷劫', '雷', ['#5a8ad0', '#e8e070', '#d9a441'], 2500, 1650, [D(0.6, '#020308'), ['cracks', 0, 1000, { n: 9 }], ['motes', 300, 1100, { fly: 0.6 }], ['bolts', 1000, 1900, { n: 9, gap: 0.07, life: 0.2, last: 1, c: 0 }], ['dim', 1900, 2500, { c: '#d9a441', a: 0.25 }], ['flash', 1700, 1850, { a: 0.7 }]], [['tilt', 0, 1100, -16], ['shake', 1650, 1900, 6]], { adv: 1 }),
  X('wudu2', '万毒归宗', '毒', ['#4f7a3a', '#6a3a7a', '#1c1915'], 2300, 1550, [D(0.4), ['crawl', 0, 1300, { at: 'tg', n: 5, converge: 1 }], ['penta', 900, 1800, {}], ['fog', 1500, 2300, { at: 'tg', n: 5, a: 0.6 }], ['bubbles', 1500, 2300, { at: 'tg', n: 8 }]], [['zoom', 0, 1800, 1.1, 'tg']], { adv: 1 }),
  X('bingfeng2', '冰火同炉', '冰', ['#6a9cc0', '#d0632a', '#7a1a10'], 2400, 1600, [['split', 0, 2400, { a: 0.3 }], ['helix', 0, 1100, {}], ['hail', 700, 1700, { n: 20 }], ['ding', 0, 2000, { d: 0.45 }], ['shards', 1600, 2400, { n: 30 }]], [['zoom', 0, 2400, 1.06, 'tg']], { adv: 1 }),
  X('hanchuan2', '万里冰原', '冰', ['#a8c8e0', '#ffffff', '#6a9cc0'], 2500, 1650, [D(0.22, '#e8f0f8'), ['iceline', 0, 900, {}], ['lake', 0, 2500, { d: 0.25 }], ['dart', 0, 2500, { d: 0.45 }], ['spikes', 1100, 2500, { at: 'foes', n: 2, seq: 1, d: 0, c: 2 }], ['snow', 0, 2500, { n: 60 }]], [['zoom', 0, 2500, 0.88, 'mid']], { adv: 1 }),
  // 旧版杀招（还在旧表里的几个）
  X('liaoyuan', '天火燎原', '炎', ['#d0632a', '#f0b03a'], 2000, 1300, [D(0.4), ['meteor', 0, 1200, { fire: 1, n: 16 }], ['firewall', 800, 1900, {}]], [['shake', 900, 1200, 4]]),
  X('wangu', '万蛊朝宗', '奴', ['#6a5a2a', '#d9a441'], 2100, 1400, [D(0.35), ['converge', 0, 1800, { n: 80 }], ['glow', 1200, 2100, { at: 'from', c: 1 }], ['rings', 1100, 2100, { at: 'from', ts: [0.1, 0.35], R: 2.2, c: 1 }]], [['zoom', 0, 2100, 1.08, 'from']]),
  X('jingji', '荆棘王座', '木', ['#3e5a2a', '#8a1f2b'], 1900, 1250, [D(0.35), ['thorns', 0, 1900, { n: 14 }], ['swords', 500, 1700, { n: 14, c: 0 }]], [['zoom', 0, 1900, 1.1, 'from']]),
  X('shishan', '尸山月影', '魂', ['#4a4a5a', '#d0d4e8'], 2200, 1450, [D(0.5, '#05060c'), ['moon', 0, 2200, {}], ['mountain', 0, 2200, { s: 1.6, peaks: [[-0.4, 0.5], [0, 0.8], [0.4, 0.5]] }], ['wings', 600, 2200, { s: 1.1, c: '#3a3a4a', c2: '#6a6a7a', d: 0.2, a: 0.8 }]], [['tilt', 0, 2200, -8]]),
  X('baichong', '百虫入瓮', '奴', ['#7a5a3a', '#3a2a1a'], 2000, 1300, [D(0.35), ['urn', 0, 2000, {}], ['vortex', 300, 1800, { at: 'mid', n: 80, R: 2.4, c: 1, c2: 0 }]], [['zoom', 0, 2000, 1.08, 'mid']]),
  X('yixing', '移形换影', '宇', ['#6a8aa0', '#e0e8f0'], 1800, 1150, [D(0.35), ['swap', 0, 1600, {}], ['wind', 200, 1400, { n: 8, to: 'allies' }]], [['pan', 0, 1600, 12]]),
  X('tuibao', '金蟾吐宝', '金', ['#d9a441', '#7a9a5a'], 2000, 1300, [D(0.3), ['coins', 0, 1900, { n: 16 }], ['glow', 1200, 2000, { at: 'allies' }]], [['pan', 0, 1800, -10]]),
  X('shousui', '守岁', '宙', ['#b5301f', '#d9a441'], 2100, 1400, [D(0.35), ['clock', 0, 2000, { c: 1 }], ['dome', 900, 2100, {}]], [['zoom', 0, 2100, 1.08, 'from']]),
].map(r => [r.id, r]));

// 没写配方的新杀招：按 id 稳定地挑一组特效和配色，同一个 id 永远长一个样；进阶杀招（xxx2）在原版上加金色光柱和收尾闪光
const POOL = [
  ['firewall', {}], ['bolts', {}], ['swords', {}], ['fog', {}], ['dome', { at: 'from' }], ['ghost', {}], ['vortex', {}], ['icicle', {}], ['stream', {}], ['wind', {}], ['spikes', {}], ['pillar', {}],
  ['burst', {}], ['rings', { at: 'from' }], ['meteor', {}], ['crack', { at: 'tg' }], ['marks', {}], ['bubbles', {}], ['coins', {}], ['thorns', {}],
];
const PALS = [['#b5301f', '#e08a3a'], ['#3a6aa8', '#cfe6ff'], ['#4f7a3a', '#9ac070'], ['#6a3a7a', '#e8a0c0'], ['#a8803e', '#e8c76a'], ['#8a1f2b', '#d04050'], ['#4a8a86', '#efe7d4'], ['#5a4a7a', '#c0c0d0']];
function recipeOf(id, name) {
  if (COMBO_FX[id]) return COMBO_FX[id];
  const base = /2$/.test(id || '') && COMBO_FX[id.slice(0, -1)];
  if (base) return { ...base, id, n: name || base.n, adv: 1, dur: base.dur + 300, L: base.L.concat([['pillar', base.dur - 500, base.dur + 300, { at: 'from', c: '#d9a441', w: 0.45 }], ['flash', base.dur - 200, base.dur, { c: '#f2c35a', a: 0.4 }]]) };
  const h = hashOf(id || name || 'x'), a = POOL[h % POOL.length], b = POOL[(h >>> 5) % POOL.length], b2 = b === a ? POOL[(h >>> 9) % POOL.length] : b;
  return X(id || 'x', name || '杀招', '杀', PALS[(h >>> 13) % PALS.length], 1900, 1200, [D(0.38), [a[0], 0, 1500, a[1]], [b2[0], 400, 1900, b2[1]]], [['zoom', 0, 1900, 1.06, 'tg']]);
}

// ---------- 镜头 ----------
function camAt(R, T, S) {
  let s = 1, sx = 1, x = 0, y = 0, rot = 0, A = { x: S.w / 2, y: S.h / 2 }; const red = S.reduce;
  for (const [k, t0, t1, v, at] of R.cam || []) {
    if (T < t0 || T > t1) continue; const p = (T - t0) / (t1 - t0), e = eio(env(p, 0.3, 0.3));
    if (k === 'zoom') { s *= 1 + (v - 1) * e * (red ? 0.5 : 1); if (at) A = pt1(S, at); }
    else if (k === 'push') { const f = p < 0.25 ? eo(p / 0.25) : 1 - eio((p - 0.25) / 0.75); s *= 1 + (v - 1) * f * (red ? 0.4 : 1); if (at) A = pt1(S, at); }
    else if (k === 'shake') { if (red) continue; const amp = v * (1 - p); x += Math.sin(T * 0.13) * amp; y += Math.cos(T * 0.17) * amp * 0.6; }
    else if (k === 'pan') x += v * S.dir * e * (red ? 0.5 : 1);
    else if (k === 'tilt') y += v * e * (red ? 0.5 : 1);
    else if (k === 'squash') { sx *= 1 - (1 - v) * Math.sin(p * Math.PI) * (red ? 0.5 : 1); A = pt1(S, 'mid'); }
    else if (k === 'roll') rot += v * e * (red ? 0 : 1);
  }
  return { s, sx, x, y, rot, A };
}
const camCss = c => `translate(${(c.A.x + c.x).toFixed(1)}px,${(c.A.y + c.y).toFixed(1)}px) rotate(${c.rot.toFixed(2)}deg) scale(${(c.s * c.sx).toFixed(4)},${c.s.toFixed(4)}) translate(${(-c.A.x).toFixed(1)}px,${(-c.A.y).toFixed(1)}px)`;
const camCtx = (g, c) => { g.translate(c.A.x + c.x, c.A.y + c.y); g.rotate(c.rot * Math.PI / 180); g.scale(c.s * c.sx, c.s); g.translate(-c.A.x, -c.A.y); };

function drawFx(g, R, T, S) {
  R.L.forEach(([k, t0, t1, P], li) => {
    const f = PR[k]; if (!f || T < t0 || T > Math.min(t1, R.total || 1e9)) return;
    const span = Math.min(t1, R.total || t1) - t0, p = span > 0 ? cl((T - t0) / span) : 1;
    g.save(); try { f(g, p, P || {}, S, R, rngOf(S.seed + li * 7919)); } finally { g.restore(); }
  });
}
function sceneOf(o) {
  const w = o.w || 360, h = o.h || 200, side = o.side ? 1 : 0, dir = side ? -1 : 1, from = o.from || { x: w * (side ? 0.7 : 0.3), y: h * 0.55 };
  const foes = o.foes && o.foes.length ? o.foes : [{ x: w * (side ? 0.25 : 0.75), y: h * 0.55 }], allies = o.allies && o.allies.length ? o.allies : [from];
  return { w, h, side, dir, from, foes, allies, targets: o.targets && o.targets.length ? o.targets : foes, u: o.u || Math.min(90, w / 6.4), reduce: !!o.reduce, seed: hashOf(o.id || o.name || 'x'), sideCol: side ? '#d8553f' : '#6fb7a4', mono: 0 };
}
function timeline(R, name) { const n = [...(name || '')].length; const t = nameTimes(R, Math.max(1, n)); R.total = t.total; return t; }

// 播放：特效画在跟镜头一起动的画布上，招式名画在不动的那一层
function playCombo(stage, o = {}) {
  return new Promise(done => {
    if (typeof document === 'undefined' || !stage || typeof requestAnimationFrame === 'undefined') return done();
    const R0 = recipeOf(o.id, o.name), R = { ...R0 }, S = sceneOf(o), sp = Math.max(0.25, o.speed || 1), dpr = Math.min(2, window.devicePixelRatio || 1), name = o.name || R.n || '';
    const mk = (host, z) => { const c = document.createElement('canvas'); c.width = Math.round(S.w * dpr); c.height = Math.round(S.h * dpr); c.style.cssText = `position:absolute;left:0;top:0;width:${S.w}px;height:${S.h}px;pointer-events:none;z-index:${z}`; host.appendChild(c); return { c, g: c.getContext('2d') }; };
    const fx = mk(stage, 44), hud = mk(o.hud || stage.parentElement || stage, 70), TL = timeline(R, name), NM = name ? prepName(name, nameSize(S, [...name].length)) : null;
    const grey = stage.querySelectorAll('.gbv-u, .gbv-floor'), oldO = stage.style.transformOrigin, t0 = performance.now();
    const tick = now => {
      let T = (now - t0) * sp; if (o.isSkip && o.isSkip()) T = TL.total; const end = T >= TL.total;
      fx.g.setTransform(dpr, 0, 0, dpr, 0, 0); fx.g.clearRect(0, 0, S.w, S.h); S.mono = 0; if (!end) drawFx(fx.g, R, T, S);
      stage.style.transformOrigin = '0 0'; stage.style.transform = end ? '' : camCss(camAt(R, T, S)); grey.forEach(u => { u.style.filter = S.mono ? 'grayscale(1)' : ''; });
      hud.g.setTransform(dpr, 0, 0, dpr, 0, 0); hud.g.clearRect(0, 0, S.w, S.h); if (NM && !end) drawName(hud.g, NM, S.w / 2, o.nameY || S.h * 0.17, T, TL, R);
      if (end) { fx.c.remove(); hud.c.remove(); stage.style.transform = ''; stage.style.transformOrigin = oldO; grey.forEach(u => { u.style.filter = ''; }); return done(); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// ---------- 总览：每个杀招按几个关键帧画成一排，方便一眼看出彼此不重样 ----------
function demoScene(w, h, id) {
  const allies = [[0.33, 0.52], [0.2, 0.36], [0.2, 0.7], [0.08, 0.54]].map(([x, y]) => ({ x: w * x, y: h * y })), foes = [[0.64, 0.4], [0.64, 0.68], [0.78, 0.54], [0.9, 0.38], [0.9, 0.72]].map(([x, y]) => ({ x: w * x, y: h * y }));
  return sceneOf({ id, w, h, side: 0, from: allies[0], allies, foes, targets: foes.slice(0, 2), u: w / 7.2 });
}
function drawDemoUnits(g, S) {
  g.fillStyle = '#1e1b16'; g.fillRect(-S.w, -S.h, S.w * 3, S.h * 3);
  g.strokeStyle = 'rgba(233,224,204,.12)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(S.w / 2, S.h * 0.18); g.lineTo(S.w / 2, S.h * 0.95); g.stroke(); g.setLineDash([]);
  [[S.allies, '#6fb7a4', 1], [S.foes, '#d8553f', -1]].forEach(([L, col, dir]) => L.forEach(t => { g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(t.x, t.y + S.u * 0.45, S.u * 0.4, S.u * 0.12, 0, 0, TAU); g.fill(); g.fillStyle = '#e7ddc7'; g.beginPath(); g.arc(t.x, t.y, S.u * 0.36, 0, TAU); g.fill(); g.strokeStyle = col; g.lineWidth = 2; g.stroke(); bug(g, t.x, t.y + 1, S.u * 0.62, '#1c1915', 0.9, dir); }));
}
// T：毫秒；传 'name' 画招式名写完、印章落下的那一刻
function drawComboFrame(g, id, T, w, h) {
  const R = { ...recipeOf(id) }, S = demoScene(w, h, id), TL = timeline(R, R.n); if (T === 'name') T = Math.min(TL.total - 280, TL.seal + 260); const cam = camAt(R, T, S);
  g.save(); camCtx(g, cam); drawDemoUnits(g, S); drawFx(g, R, T, S); g.restore();
  drawName(g, prepName(R.n, Math.round(Math.min(26, w * 0.8 / ([...R.n].length * 1.015 + 1.25)))), w / 2, h * 0.15, T, TL, R);
}
function comboSheet(el, o = {}) {
  const ids = o.ids || Object.keys(COMBO_FX), frames = o.frames || [0.12, 0.3, 0.5, 0.72, 'name'], w = o.w || 180, h = o.h || 112, dpr = o.dpr || 1;
  el.innerHTML = ''; el.style.cssText += ';display:grid;grid-template-columns:repeat(' + (o.cols || 2) + ',max-content);gap:10px 18px;background:#15130f;padding:14px;color:#ddd3bf;font:12px system-ui';
  ids.forEach(id => {
    const R = recipeOf(id), row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:4px';
    row.innerHTML = `<div style="width:76px;font:15px ${kaiFont()};line-height:1.25">${R.n}<br><small style="font:10px system-ui;color:#8f8775">${id}${R.adv ? ' · 进阶' : ''}</small></div>`;
    frames.forEach(f => { const T = f === 'name' ? f : f * R.dur, c = document.createElement('canvas'); c.width = w * dpr; c.height = h * dpr; c.style.cssText = `width:${w}px;height:${h}px;border-radius:3px`; const g = c.getContext('2d'); g.scale(dpr, dpr); drawComboFrame(g, id, T, w, h); row.appendChild(c); });
    el.appendChild(row);
  });
  return ids.length;
}

return { COMBO_FX, playCombo, drawComboFrame, comboSheet };
})();
// ---- src/battle-view.js（包一层，只放出 export）
const { playBattle } = (() => {
// 蛊码 GuCode · 战斗画面：斜俯视的 6×3 阵盘、出手顺序条、出手预告、弹道、伤害数字、主动技大字、杀招动画、结算页。
// 只读 battle() 的结果（log + roster + units）重放，不改任何战斗数据。对外：playBattle(el, result, opts) → Promise（结算页点「继续」才 resolve）






const CSS = `
.gbv{--a:var(--qing,#6fb7a4);--b:var(--zhu2,#d8553f);--pp:var(--paper,#e7ddc7);--ik:var(--ink,#1c1915);position:relative;user-select:none;-webkit-user-select:none;color:var(--tx,#ddd3bf);font:13px/1.4 var(--sans,system-ui)}
.gbv-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 6px}
.gbv-tt{font:16px/1.2 var(--kai,serif);letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gbv-tt small{font:12px var(--sans,system-ui);color:var(--mu,#8f8775);margin-left:6px;letter-spacing:0}
.gbv-ctl{display:flex;gap:4px;flex:0 0 auto}
.gbv-ctl button{min-width:34px;height:26px;padding:0 8px;border:1px solid var(--line2,rgba(233,224,204,.32));border-radius:3px;font:12px/24px var(--sans,system-ui);color:var(--tx,#ddd3bf);background:transparent;cursor:pointer}
.gbv-ctl button.on{background:var(--tx,#ddd3bf);color:var(--bg,#15130f);border-color:transparent}
.gbv-ord{position:relative;height:54px;margin:0 0 4px;overflow:hidden;border-bottom:1px solid var(--line,rgba(233,224,204,.14))}
.gbv-ord .gbv-lab{position:absolute;left:0;top:2px;font:10px/1 var(--sans,system-ui);color:var(--mu,#8f8775)}
.gbv-chip{position:absolute;top:18px;width:26px;height:26px;border-radius:50%;background:var(--pp);border:2px solid var(--a);overflow:hidden;transition:transform .32s cubic-bezier(.3,.7,.3,1),opacity .25s}
.gbv-chip.gbv-sb{border-color:var(--b)}
.gbv-chip svg{width:100%;height:100%;filter:brightness(0);opacity:.82}
.gbv-chip.gbv-sb svg{transform:scaleX(-1)}
.gbv-chip.now{width:32px;height:32px;top:15px;box-shadow:0 0 0 2px var(--bg,#15130f),0 0 0 4px var(--tx,#ddd3bf)}
.gbv-rd{position:absolute;top:22px;font:11px/1 var(--kai,serif);color:var(--mu,#8f8775);border-left:1px solid var(--line2,rgba(233,224,204,.32));padding-left:3px;height:18px;line-height:18px;transition:transform .32s cubic-bezier(.3,.7,.3,1)}
.gbv-syn{min-height:16px;font:11px/16px var(--sans,system-ui);color:var(--mu,#8f8775);display:flex;justify-content:space-between;gap:8px;margin-bottom:2px}
.gbv-syn span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gbv-st{position:relative;overflow:hidden;touch-action:manipulation}
.gbv-cam{position:absolute;inset:0;transform-origin:50% 55%}
.gbv-st.shake{animation:gbvshk .22s linear}
@keyframes gbvshk{20%{transform:translate(-3px,1px)}40%{transform:translate(3px,-2px)}60%{transform:translate(-2px,2px)}80%{transform:translate(2px,-1px)}}
.gbv-floor{position:absolute;left:0;top:0;pointer-events:none}
.gbv-floor .t{fill:var(--bg2,#1e1b16);stroke:var(--line2,rgba(233,224,204,.32));stroke-width:1}
.gbv-floor .t.ta{fill:color-mix(in srgb,var(--a) 9%,var(--bg2,#1e1b16))}
.gbv-floor .t.tb{fill:color-mix(in srgb,var(--b) 9%,var(--bg2,#1e1b16))}
.gbv-floor .t.aim{fill:color-mix(in srgb,var(--b) 42%,var(--bg2,#1e1b16));stroke:var(--b);stroke-width:2}
.gbv-floor .t.aimA{fill:color-mix(in srgb,var(--a) 42%,var(--bg2,#1e1b16));stroke:var(--a);stroke-width:2}
.gbv-floor .t.aim.gold,.gbv-floor .t.aimA.gold{stroke:#d9a441;stroke-width:2.5}
.gbv-floor .gbv-midl{stroke:var(--line2,rgba(233,224,204,.32));stroke-dasharray:3 4}
.gbv-u{position:absolute;transform:translate(-50%,-100%);transition:left .24s ease,top .24s ease,opacity .3s;pointer-events:auto;cursor:pointer}
.gbv-tok{position:relative;margin:0 auto;background:var(--pp);border-radius:40% 40% 10px 10px;box-shadow:0 2px 0 var(--shadow,rgba(0,0,0,.45));border-bottom:3px solid var(--a);transition:filter .08s,transform .12s}
.gbv-u.gbv-sb .gbv-tok{border-bottom-color:var(--b)}
.gbv-tok svg{display:block;width:100%;height:100%}
.gbv-u.gbv-sb .gbv-tok svg{transform:scaleX(-1)}
.gbv-u.now .gbv-tok{box-shadow:0 0 0 2px var(--tx,#ddd3bf)}
.gbv-u.flash .gbv-tok{filter:brightness(2.4) saturate(0)}
.gbv.calm .gbv-u.flash .gbv-tok{filter:none;opacity:.6}
.gbv-u.die{opacity:0;transform:translate(-50%,-80%) scale(.9);transition:opacity .5s,transform .5s}
.gbv-u.die .gbv-tok{filter:grayscale(1)}
.gbv-u.summon{animation:gbvpop .3s ease}
.gbv-u.rise{animation:gbvrise .7s ease both}
@keyframes gbvrise{0%{transform:translate(-50%,-100%) rotate(80deg) scale(.85);opacity:.3;filter:grayscale(1)}60%{transform:translate(-50%,-112%) rotate(-6deg)}100%{transform:translate(-50%,-100%);opacity:1}}
@keyframes gbvpop{from{transform:translate(-50%,-100%) scale(.3);opacity:0}}
.gbv-bar{height:4px;margin:2px auto 0;background:rgba(0,0,0,.45);border-radius:2px;overflow:hidden;position:relative}
.gbv-bar i{position:absolute;left:0;top:0;bottom:0;background:#4f9a6a;transition:width .25s}
.gbv-bar i.gbv-shi{background:#cfd8e0;opacity:.85}
.gbv-bar.lo i.gbv-hpi{background:#c65a3a}
.gbv-gp{height:3px;margin:1px auto 0;background:rgba(0,0,0,.4);border-radius:2px;overflow:hidden}
.gbv-gp i{display:block;height:100%;background:#d9a441;transition:width .25s}
.gbv-gp.full i{background:#f2c35a;box-shadow:0 0 4px #f2c35a}
.gbv-ic{position:absolute;left:50%;top:-14px;transform:translateX(-50%);display:flex;gap:1px;white-space:nowrap}
.gbv-ic b{font:10px/12px var(--kai,serif);padding:0 2px;border-radius:2px;background:var(--ik);color:#efe7d4}
.gbv-ic b.psn{background:#3d6b3a}.gbv-ic b.burn{background:#a3471f}.gbv-ic b.chill{background:#3f6f95}.gbv-ic b.stun,.gbv-ic b.web{background:#6a5a8a}.gbv-ic b.guard,.gbv-ic b.taunt{background:#7a6a3a}.gbv-ic b.mark{background:#8a2a2a}
.gbv-fl{position:absolute;pointer-events:none;transform:translate(-50%,-50%);font:700 15px/1 var(--sans,system-ui);color:var(--float,#f0e6d0);text-shadow:0 1px 0 var(--fshadow,#000),0 0 3px var(--fshadow,#000);white-space:nowrap;animation:gbvfl .9s ease-out forwards;z-index:30}
.gbv-fl.crit{font-size:22px;color:#f2c35a}.gbv-fl.heal{color:#7ed29a}.gbv-fl.psn{color:#9bd06a}.gbv-fl.burn{color:#f0915a}.gbv-fl.tag{font:12px/1 var(--kai,serif);color:var(--float,#f0e6d0)}.gbv-fl.blk{color:var(--blk,#8fb0d0);font-size:12px}
@keyframes gbvfl{0%{opacity:0;transform:translate(-50%,-30%) scale(.8)}15%{opacity:1;transform:translate(-50%,-70%) scale(1.08)}70%{opacity:1}100%{opacity:0;transform:translate(-50%,-160%)}}
.gbv-ban{position:absolute;left:0;right:0;top:30%;text-align:center;pointer-events:none;z-index:40;font:700 34px/1.1 var(--kai,serif);letter-spacing:.12em;color:var(--strong,#eee5d1);text-shadow:0 2px 0 var(--fshadow,#000)}
.gbv-ban span{display:inline-block;opacity:0;animation:gbvban .5s ease forwards}
.gbv-ban small{display:block;font:12px var(--sans,system-ui);letter-spacing:0;color:var(--mu,#8f8775);margin-top:6px;opacity:0;animation:gbvban .4s .3s forwards}
@keyframes gbvban{0%{opacity:0;transform:translateY(8px) scale(1.25);filter:blur(3px)}100%{opacity:1;transform:none;filter:none}}
.gbv-fx{position:absolute;left:0;top:0;pointer-events:none;overflow:visible;z-index:25}
.gbv-pj{position:absolute;pointer-events:none;z-index:26;transform:translate(-50%,-50%)}
.gbv-log{height:18px;margin-top:4px;font:12px/18px var(--sans,system-ui);color:var(--mu,#8f8775);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gbv-tip{position:absolute;z-index:50;max-width:220px;padding:7px 9px;background:var(--pp);color:var(--ik);border-left:3px solid var(--b);border-radius:2px;box-shadow:0 6px 16px rgba(0,0,0,.35);font:12px/1.5 var(--sans,system-ui);pointer-events:none}
.gbv-tip b{font:14px var(--kai,serif)}
.gbv-res{position:absolute;inset:0;z-index:60;background:var(--bg,#15130f);overflow:auto;padding:4px 2px 12px;animation:gbvin .35s ease}
@keyframes gbvin{from{opacity:0;transform:translateY(10px)}}
.gbv-res h3{margin:4px 0 2px;font:700 30px/1.2 var(--kai,serif);letter-spacing:.2em;text-align:center}
.gbv-res h3.win{color:var(--zhu2,#d8553f)}.gbv-res h3.lose{color:var(--mu,#8f8775)}
.gbv-res .gbv-sub{text-align:center;color:var(--mu,#8f8775);font-size:12px;margin-bottom:10px}
.gbv-mvp{display:flex;align-items:center;gap:10px;margin:0 auto 10px;max-width:360px;padding:8px 10px;background:var(--pp);color:var(--ik);border-radius:3px;border-left:4px solid #d9a441}
.gbv-mvp svg{width:52px;height:52px;flex:0 0 auto}
.gbv-mvp b{font:16px var(--kai,serif)}.gbv-mvp em{font-style:normal;font:11px var(--sans,system-ui);background:#d9a441;color:#1c1915;padding:1px 5px;border-radius:2px;margin-right:6px}
.gbv-tb{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}
.gbv-tb th{font-weight:400;color:var(--mu,#8f8775);text-align:right;padding:2px 4px;border-bottom:1px solid var(--line,rgba(233,224,204,.14))}
.gbv-tb th:first-child,.gbv-tb td:first-child{text-align:left}
.gbv-tb td{padding:3px 4px;text-align:right;font-variant-numeric:tabular-nums;border-bottom:1px solid var(--faint2,rgba(233,224,204,.12))}
.gbv-tb td:first-child{display:flex;align-items:center;gap:6px}
.gbv-tb td svg{width:22px;height:22px;background:var(--pp);border-radius:3px;flex:0 0 auto}
.gbv-tb tr.dead td{color:var(--mu,#8f8775)}.gbv-tb tr.dead svg{filter:grayscale(1);opacity:.6}
.gbv-tb .gbv-side{font:13px var(--kai,serif);color:var(--tx,#ddd3bf);padding-top:8px;text-align:left}
.gbv-fare{margin:6px 0 10px;padding:10px 12px;border:1px solid var(--line2,rgba(233,224,204,.32));border-left:4px solid var(--ik);background:var(--bg2,#1e1b16);border-radius:3px}
.gbv-save{margin:0 auto 10px;max-width:420px;padding:8px 10px;border-left:4px solid #7ed29a;background:var(--bg2,#1e1b16);border-radius:3px;font-size:12px;line-height:1.9}
.gbv-save b{font:15px var(--kai,serif);color:var(--strong,#eee5d1)}
.gbv-save span{display:inline-flex;align-items:center;gap:3px;margin-right:8px}
.gbv-save svg{width:22px;height:22px;background:var(--pp);border-radius:3px}
.gbv-fare .gbv-lead{margin:0 0 6px;font-size:12px;color:var(--mu,#8f8775)}
.gbv-fare small{font-size:11px;color:var(--mu,#8f8775)}
.gbv-fare h4{margin:0 0 6px;font:16px var(--kai,serif);letter-spacing:.1em;color:var(--strong,#eee5d1)}
.gbv-fare .gbv-g{display:flex;align-items:center;gap:10px;margin:6px 0;animation:gbvfare 1.6s ease both}
.gbv-fare .gbv-g svg{width:46px;height:46px;background:var(--pp);border-radius:3px;filter:grayscale(1) contrast(.9);flex:0 0 auto}
.gbv-fare .gbv-g b{font:15px var(--kai,serif)}.gbv-fare .gbv-g p{margin:2px 0 0;font-size:12px;color:var(--mu,#8f8775)}
@keyframes gbvfare{from{opacity:0;filter:blur(2px)}}
.gbv-res .gbv-note{font-size:11px;color:var(--mu,#8f8775);text-align:center;margin:4px 0}
.gbv-res .gbv-go{display:block;margin:10px auto 0;min-width:140px;height:38px;border-radius:3px;background:var(--zhu,#b5301f);color:var(--on-zhu,#f3ead6);font:16px var(--kai,serif);letter-spacing:.3em;cursor:pointer;border:0}
.gbv.narrow .gbv-tok{border-radius:50%}
.gbv.narrow .gbv-tok svg{filter:brightness(0);opacity:.85}
.gbv.calm .gbv-ban span{animation-duration:.2s}
`;
const ST_CH = { psn: '毒', para: '寄', burn: '灼', chill: '寒', stun: '眩', web: '网', guard: '护', grd: '护', taunt: '嘲', mark: '印', seal: '封' };
const ST_N = { psn: '中毒', para: '寄生', burn: '灼烧', chill: '寒', freeze: '冻住', stun: '眩晕', web: '落网', guard: '护', taunt: '嘲讽', mark: '印记', seal: '封', miss: '扑空', swap: '换位', strip: '破甲', tie: '系丝', blitz: '疾袭', luck: '鸿运', hex: '夺志', clean: '净' };
const CN = ['', '一', '二', '三', '四', '五', '仙'];
// trip = 秘境（会死），spar = 斗幽灵、战帖（不死蛊）。没写 mode 时按旧参数猜
const modeOf = o => o.mode === 'trip' || o.mode === 'spar' ? o.mode : (o.perm || o.kind === 'trip' ? 'trip' : 'spar');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function playBattle(el, res, opts = {}) {
  return new Promise(resolve => run(el, res, opts, resolve));
}

async function run(el, res, opts, resolve) {
  if (typeof document === 'undefined') return resolve({ closed: true, skipped: true });
  if (!document.getElementById('gbv-css')) { const st = document.createElement('style'); st.id = 'gbv-css'; st.textContent = CSS; document.head.appendChild(st); }
  if (!document.getElementById('gu-defs')) document.body.insertAdjacentHTML('afterbegin', `<svg id="gu-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${ART_DEFS}</defs></svg>`);
  const R = res.roster, log = res.log, me = opts.mySide === 1 ? 1 : 0, calm = !!opts.reduceMotion;
  const names = opts.names || ['我方', '对方'];
  el.innerHTML = `<div class="gbv${calm ? ' calm' : ''}"><div class="gbv-top"><div class="gbv-tt">${esc(opts.title || '斗蛊')}<small class="gbv-rdl">开战</small></div>
    <div class="gbv-ctl"><button data-s="1" class="on">1×</button><button data-s="2">2×</button><button data-s="skip">跳过</button></div></div>
    <div class="gbv-ord"><span class="gbv-lab">出手顺序</span></div><div class="gbv-syn"><span class="gbv-syna"></span><span class="gbv-synb"></span></div>
    <div class="gbv-st"><div class="gbv-cam"><svg class="gbv-floor"></svg><svg class="gbv-fx"></svg></div></div><div class="gbv-log"></div></div>`;
  const root = el.firstElementChild, outer = root.querySelector('.gbv-st'), stage = root.querySelector('.gbv-cam'), floor = root.querySelector('.gbv-floor'), fxs = root.querySelector('.gbv-fx'), ord = root.querySelector('.gbv-ord'), logEl = root.querySelector('.gbv-log');
  let speed = opts.speed === 2 ? 2 : 1, skip = false, wake = null;
  root.querySelectorAll('.gbv-ctl button').forEach(b => b.onclick = () => {
    if (b.dataset.s === 'skip') { skip = true; if (wake) wake(); return; }
    speed = +b.dataset.s; root.querySelectorAll('.gbv-ctl button').forEach(x => x.classList.toggle('on', x === b));
  });
  const sleep = ms => skip ? Promise.resolve() : new Promise(r => { const t = setTimeout(() => { wake = null; r(); }, ms / speed); wake = () => { clearTimeout(t); wake = null; r(); }; });

  // ----- 几何：斜俯视 6×3。X = 0..5（A 方后中前 | B 方前中后），r = 0 远 … 2 近 -----
  let G = {};
  const layout = () => {
    const W = Math.max(300, Math.min(760, root.clientWidth || el.clientWidth || 360));
    const cw = Math.min(96, Math.floor((W - 8) / 6.6)), rh = Math.round(cw * 0.66), top = Math.max(60, Math.round(cw * 1.02)), gap = Math.round(cw * 0.2);
    const sc = r => 0.86 + 0.07 * r, H = top + rh * 3 + Math.round(cw * 0.32);
    G = { W, cw, rh, top, gap, sc, H, narrow: cw < 62 };
    root.classList.toggle('narrow', G.narrow);
    outer.style.height = H + 'px'; floor.setAttribute('width', W); floor.setAttribute('height', H); fxs.setAttribute('width', W); fxs.setAttribute('height', H);
    drawFloor();
    Object.values(U).forEach(place);
  };
  const Xof = (side, c) => side === 0 ? 2 - c : 3 + c;
  const px = (X, r) => G.W / 2 + (X - 2.5) * G.cw * G.sc(r) + (X < 3 ? -G.gap / 2 : G.gap / 2);   // 格子中心 x（随行缩放）
  const py = r => G.top + (r + 0.5) * G.rh;                                                          // 格子中心 y
  const cellXY = (side, r, c) => ({ x: px(Xof(side, c), r), y: py(r) });
  const tilePts = (X, r) => {
    const y0 = G.top + r * G.rh, y1 = y0 + G.rh, s0 = 0.86 + 0.07 * (r - 0.5), s1 = s0 + 0.07, g = X < 3 ? -G.gap / 2 : G.gap / 2;
    const xa = (x, s) => G.W / 2 + (x - 3) * G.cw * s + g, pad = 2;
    return `${xa(X, s0) + pad},${y0 + pad} ${xa(X + 1, s0) - pad},${y0 + pad} ${xa(X + 1, s1) - pad},${y1 - pad} ${xa(X, s1) + pad},${y1 - pad}`;
  };
  function drawFloor() {
    let s = '';
    for (let r = 0; r < 3; r++) for (let X = 0; X < 6; X++) s += `<polygon class="t ${X < 3 ? 'ta' : 'tb'}" data-k="${X}_${r}" points="${tilePts(X, r)}"/>`;
    s += `<line class="gbv-midl" x1="${G.W / 2}" y1="${G.top - 4}" x2="${G.W / 2}" y2="${G.top + 3 * G.rh + 4}"/>`;
    floor.innerHTML = s;
  }

  // ----- 单位 -----
  const U = {};
  function mkUnit(uid) {
    const ro = R[uid]; if (!ro) return null;
    const d = document.createElement('div'); d.className = 'gbv-u ' + (ro.side ? 'gbv-sb' : 'gbv-sa'); d.dataset.uid = uid;
    d.innerHTML = `<div class="gbv-ic"></div><div class="gbv-tok">${guSVG(ro.sp, { rank: ro.rank || 1, still: true })}</div><div class="gbv-bar"><i class="gbv-hpi"></i><i class="gbv-shi"></i></div>${ro.act ? '<div class="gbv-gp"><i></i></div>' : ''}`;
    stage.appendChild(d);
    const u = { uid, ro, el: d, tok: d.querySelector('.gbv-tok'), hpI: d.querySelector('.gbv-hpi'), shI: d.querySelector('.gbv-shi'), bar: d.querySelector('.gbv-bar'), gpI: d.querySelector('.gbv-gp i'), gpB: d.querySelector('.gbv-gp'), ic: d.querySelector('.gbv-ic'), st: {}, r: 1, c: 0, hp: 1, mx: 1, sh: 0, gp: 0, atk: 0, alive: true };
    d.onmouseenter = () => showTip(u); d.onmouseleave = hideTip; d.onclick = e => { e.stopPropagation(); showTip(u, true); };
    U[uid] = u; return u;
  }
  function place(u) {
    const s = G.sc(u.r), sz = Math.round(Math.min(G.cw * 0.7, G.rh * 1.15) * s), p = cellXY(u.ro.side, u.r, u.c);
    u.el.style.left = p.x + 'px'; u.el.style.top = (p.y + G.rh * 0.36) + 'px'; u.el.style.zIndex = 10 + u.r;
    u.tok.style.width = sz + 'px'; u.tok.style.height = Math.round(sz * (G.narrow ? 1 : 0.94)) + 'px';
    u.bar.style.width = Math.round(sz * 0.92) + 'px'; if (u.gpB) u.gpB.style.width = Math.round(sz * 0.92) + 'px';
  }
  const center = u => { const p = cellXY(u.ro.side, u.r, u.c), s = G.sc(u.r); return { x: p.x, y: p.y + G.rh * 0.36 - Math.min(G.cw * 0.7, G.rh * 1.15) * 0.52 * s }; };
  function setBars(u) {
    const tot = Math.max(u.mx, u.hp + u.sh), hw = 100 * Math.max(0, u.hp) / tot, sw = 100 * u.sh / tot;
    u.hpI.style.width = hw + '%'; u.shI.style.left = hw + '%'; u.shI.style.width = sw + '%'; u.bar.classList.toggle('lo', u.hp < u.mx * 0.35);
    if (u.gpI) { const g = Math.min(1, u.gp / (u.ro.gpMax || 100)); u.gpI.style.width = 100 * g + '%'; u.gpB.classList.toggle('full', g >= 1); }
  }
  const setIcons = u => { u.ic.innerHTML = Object.entries(u.st).filter(([, v]) => v > 0).map(([k]) => `<b class="${k}">${ST_CH[k] || ''}</b>`).join(''); };
  // 快照：[[uid, 攻, 血, 护体, 蛊力, 速, 行, 列]] × 两方
  function applySnap(s) {
    if (!s) return; const seen = new Set();
    s.forEach(side => side.forEach(([uid, atk, hp, sh, gp, spd, r, c]) => {
      seen.add(uid); let u = U[uid]; if (!u) { u = mkUnit(uid); if (!u) return; u.r = r; u.c = c; place(u); }
      const moved = u.r !== r || u.c !== c; u.atk = atk; u.hp = hp; u.sh = sh; u.gp = gp; u.spd = spd; if (moved) { u.r = r; u.c = c; place(u); }
      setBars(u);
    }));
    Object.values(U).forEach(u => { if (u.alive && !seen.has(u.uid)) { u.alive = false; u.el.classList.add('die'); } });
  }
  const mxOf = uid => (res.units[uid] && res.units[uid].mxB) || 1;

  // ----- 出手顺序条 -----
  let chips = {};
  function drawOrder(cur, q) {
    const list = (cur ? [cur] : []).concat(q || []).slice(0, G.narrow ? 7 : 10), cnt = {}, keep = {}, x0 = 4, step = G.narrow ? 30 : 34;
    let x = x0;
    list.forEach((id, i) => {
      const k = id[0] === '#' ? id : id + '@' + (cnt[id] = (cnt[id] || 0) + 1);
      let c = chips[k];
      if (!c) {
        c = document.createElement('div');
        if (id[0] === '#') { c.className = 'gbv-rd'; c.textContent = '第' + id.slice(1) + '轮'; }
        else { const ro = R[id] || {}; c.className = 'gbv-chip' + (ro.side ? ' gbv-sb' : ''); c.innerHTML = guSVG(ro.sp || 'pupa', { still: true }); c.title = ro.name || ''; }
        c.style.transform = `translateX(${x + 40}px)`; c.style.opacity = '0'; ord.appendChild(c);
        c.getBoundingClientRect();
      }
      c.classList.toggle('now', i === 0 && !!cur); c.style.opacity = '1'; c.style.transform = `translateX(${x}px)`;
      keep[k] = c; x += id[0] === '#' ? 40 : (i === 0 && cur ? step + 8 : step);
    });
    Object.entries(chips).forEach(([k, c]) => { if (!keep[k]) { c.style.opacity = '0'; c.style.transform += ' translateX(-30px)'; setTimeout(() => c.remove(), 320); } });
    chips = keep;
  }

  // ----- 小工具：浮字、提示、弹道 -----
  const float = (u, text, cls = '', dy = 0) => {
    if (!u || skip) return; const p = center(u), f = document.createElement('div'); f.className = 'gbv-fl ' + cls; f.textContent = text;
    f.style.left = p.x + 'px'; f.style.top = (p.y - 6 + dy) + 'px'; stage.appendChild(f); setTimeout(() => f.remove(), 950);
  };
  let tipEl = null;
  function showTip(u, pin) {
    hideTip(); const ro = u.ro, t = document.createElement('div'); t.className = 'gbv-tip';
    const nat = Object.keys(ro.tr || {}).map(k => TRAITS[k] && TRAITS[k].n).filter(Boolean)[0];
    t.innerHTML = `<b>${esc(ro.name)}</b>${ro.rank ? ` · ${CN[ro.rank]}转` : ''}<br>攻 ${u.atk} · 血 ${Math.max(0, u.hp)}/${u.mx}${u.sh ? ` · 护 ${u.sh}` : ''} · 速 ${u.spd || ro.spd}<br>${ro.reach === 'ranged' ? '远程' : '近战'}${nat ? ' · 本命「' + esc(nat) + '」' : ''}${ro.act ? `<br>主动「${esc(ro.act.n)}」：${esc(ro.act.d || '')}` : ''}${ro.combo ? `<br>杀招「${esc(ro.combo.n)}」` : ''}`;
    const p = center(u); t.style.left = Math.max(2, Math.min(G.W - 222, p.x - 110)) + 'px'; t.style.top = Math.max(0, p.y - G.cw * 1.4 - 40) + 'px';
    stage.appendChild(t); tipEl = t; if (pin) setTimeout(() => { if (tipEl === t) hideTip(); }, 2600);
  }
  function hideTip() { if (tipEl) { tipEl.remove(); tipEl = null; } }
  stage.addEventListener('click', hideTip);
  const shake = () => { if (calm || skip) return; outer.classList.remove('shake'); outer.getBoundingClientRect(); outer.classList.add('shake'); };
  const flash = u => { if (!u) return; u.el.classList.add('flash'); setTimeout(() => u.el.classList.remove('flash'), 110); };
  const aimOn = (cells, gold, friendly) => { cells && cells.forEach(([s, r, c]) => { const t = floor.querySelector(`[data-k="${Xof(s, c)}_${r}"]`); if (t) { t.classList.add(friendly ? 'aimA' : 'aim'); if (gold) t.classList.add('gold'); } }); };
  const aimOff = () => floor.querySelectorAll('.aim,.aimA').forEach(t => t.classList.remove('aim', 'aimA', 'gold'));
  const anim = (node, kf, ms, o = {}) => skip ? Promise.resolve() : new Promise(r => { const a = node.animate(kf, { duration: ms / speed, easing: o.ease || 'ease-out', fill: 'forwards' }); a.onfinish = r; a.oncancel = r; });
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); fxs.appendChild(n); return n; };
  const pj = (html, x, y) => { const d = document.createElement('div'); d.className = 'gbv-pj'; d.innerHTML = html; d.style.left = x + 'px'; d.style.top = y + 'px'; stage.appendChild(d); return d; };
  const arcKf = (a, b, h, n = 6) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return { transform: `translate(${(b.x - a.x) * t}px,${(b.y - a.y) * t - h * 4 * t * (1 - t)}px) translate(-50%,-50%)` }; });
  // 普攻弹道：返回在「打中」那一刻 resolve 的 Promise
  async function shot(fx, a, t) {
    const A = center(a), B = center(t), ang = Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI, dir = a.ro.side ? -1 : 1;
    switch (fx) {
      case 'spit': { const d = pj(`<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#e2672e"/><circle cx="6" cy="6" r="2.5" fill="#f6c24a"/></svg>`, A.x, A.y); await anim(d, arcKf(A, B, G.cw * 0.6), 300, { ease: 'linear' }); d.remove(); break; }
      case 'needle': { const d = pj(`<div style="width:${G.cw * 0.5}px;height:2px;background:var(--ik);box-shadow:0 0 0 1px var(--pp);transform:rotate(${ang}deg)"></div>`, A.x, A.y); await anim(d, [{ transform: 'translate(-50%,-50%)' }, { transform: `translate(${B.x - A.x}px,${B.y - A.y}px) translate(-50%,-50%)` }], 170, { ease: 'linear' }); d.remove(); break; }
      case 'bolt': { const pts = [A]; for (let i = 1; i < 5; i++) pts.push({ x: A.x + (B.x - A.x) * i / 5 + (i % 2 ? 7 : -7), y: A.y + (B.y - A.y) * i / 5 + (i % 2 ? -6 : 6) }); pts.push(B); const l = svgEl('polyline', { points: pts.map(p => p.x + ',' + p.y).join(' '), fill: 'none', stroke: '#9fd2ff', 'stroke-width': 3, 'stroke-linejoin': 'round' }); await sleep(90); l.setAttribute('stroke', '#ffffff'); await sleep(70); l.remove(); break; }
      case 'spore': { const ds = [0, 1, 2].map(i => pj(`<div style="width:${10 + i * 3}px;height:${10 + i * 3}px;border-radius:50%;background:#7c9a4a;opacity:.7;filter:blur(1px)"></div>`, A.x, A.y)); await Promise.all(ds.map((d, i) => anim(d, arcKf(A, { x: B.x + (i - 1) * 6, y: B.y + (i - 1) * 4 }, G.cw * 0.3 * (i + 1) / 2), 380 + i * 40))); ds.forEach(d => d.remove()); break; }
      case 'wave': { const c = svgEl('path', { d: `M${A.x} ${A.y - 10} q${dir * 10} 10 0 20`, fill: 'none', stroke: 'var(--qing,#6fb7a4)', 'stroke-width': 3 }); await anim(c, [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${B.x - A.x}px,${B.y - A.y}px)`, opacity: 0.4 }], 260, { ease: 'linear' }); c.remove(); break; }
      default: {   // pounce / bite / slash：本体扑过去再退回
        const dx = (B.x - A.x) * 0.62, dy = (B.y - A.y) * 0.62;
        await anim(a.el, [{ transform: 'translate(-50%,-100%)' }, { transform: `translate(calc(-50% + ${dx}px),calc(-100% + ${dy - 8}px))` }], 150, { ease: 'cubic-bezier(.5,0,.9,.4)' });
        if (fx === 'slash' || fx === 'bite') { const p = fx === 'slash' ? `M${B.x - 14} ${B.y - 12} Q${B.x + 4} ${B.y - 2} ${B.x + 12} ${B.y + 14}` : `M${B.x - 6} ${B.y - 10} l3 9 M${B.x + 5} ${B.y - 10} l-3 9`; const s = svgEl('path', { d: p, fill: 'none', stroke: 'var(--ik)', 'stroke-width': fx === 'slash' ? 4 : 3, 'stroke-linecap': 'round' }); setTimeout(() => s.remove(), 220 / speed); }
        anim(a.el, [{ transform: `translate(calc(-50% + ${dx}px),calc(-100% + ${dy - 8}px))` }, { transform: 'translate(-50%,-100%)' }], 200).then(() => { a.el.getAnimations().forEach(x => x.cancel()); });
      }
    }
  }
  // 主动技动作（释放者那一侧的通用动作；具体伤害数字随后由 dmg 事件逐个跳出）
  async function castFx(fx, a, tgs) {
    const A = center(a), T = tgs.map(center);
    const colors = { fire: '#e2672e', frost: '#8fc7ee', bolt: '#cfe6ff', spore: '#7c9a4a', heal: '#7ed29a', shield: '#e8d9a8', drain: '#b0303a', roar: '#e8d9a8', web: '#e8e2d0', needle: '#1c1915', slash: '#1c1915', pounce: '#1c1915', bite: '#1c1915', summon: '#1c1915' };
    const col = colors[fx] || '#d9a441';
    if (fx === 'pounce' || fx === 'slash' || fx === 'bite') { if (tgs[0]) await shot(fx, a, tgs[0]); return; }
    if (fx === 'shield' || fx === 'heal' || fx === 'summon') {
      const L = (tgs.length ? tgs : [a]).map(center);
      L.forEach(p => { const c = svgEl('circle', { cx: p.x, cy: p.y + 6, r: G.cw * 0.2, fill: 'none', stroke: col, 'stroke-width': 3 }); anim(c, [{ r: G.cw * 0.2, opacity: 1 }, { r: G.cw * 0.55, opacity: 0 }], 420).then(() => c.remove()); });
      await sleep(260); return;
    }
    if (fx === 'roar') { for (let i = 0; i < 3; i++) { const c = svgEl('circle', { cx: A.x, cy: A.y, r: 6, fill: 'none', stroke: col, 'stroke-width': 2 }); anim(c, [{ r: 6, opacity: 0.9 }, { r: G.cw * 2.6, opacity: 0 }], 520).then(() => c.remove()); await sleep(90); } return; }
    await Promise.all(T.map((p, i) => new Promise(async r => {
      await sleep(i * 50);
      if (fx === 'bolt') { const l = svgEl('polyline', { points: `${p.x},${p.y - G.cw} ${p.x - 6},${p.y - G.cw * 0.5} ${p.x + 5},${p.y - G.cw * 0.4} ${p.x},${p.y}`, fill: 'none', stroke: col, 'stroke-width': 3 }); await sleep(150); l.remove(); }
      else if (fx === 'drain') { const l = svgEl('line', { x1: p.x, y1: p.y, x2: A.x, y2: A.y, stroke: col, 'stroke-width': 3, 'stroke-dasharray': '4 5' }); await anim(l, [{ strokeDashoffset: 0 }, { strokeDashoffset: -40 }], 300, { ease: 'linear' }); l.remove(); }
      else if (fx === 'web') { const g = svgEl('path', { d: `M${p.x - 14} ${p.y - 14} L${p.x + 14} ${p.y + 14} M${p.x + 14} ${p.y - 14} L${p.x - 14} ${p.y + 14} M${p.x - 18} ${p.y} L${p.x + 18} ${p.y}`, stroke: col, 'stroke-width': 1.5, fill: 'none' }); await anim(g, [{ opacity: 0 }, { opacity: 1 }], 200); setTimeout(() => g.remove(), 260 / speed); }
      else { const d = pj(`<div style="width:14px;height:14px;border-radius:50%;background:${col};box-shadow:0 0 0 2px rgba(0,0,0,.25)"></div>`, A.x, A.y); await anim(d, arcKf(A, p, fx === 'needle' ? 4 : G.cw * 0.5), fx === 'needle' ? 180 : 320, { ease: 'linear' }); d.remove(); }
      r();
    })));
  }
  const banner = async (txt, sub, ms = 650) => {
    if (skip) return; const b = document.createElement('div'); b.className = 'gbv-ban';
    b.innerHTML = [...txt].map((ch, i) => `<span style="animation-delay:${i * 70 / speed}ms">${esc(ch)}</span>`).join('') + (sub ? `<small>${esc(sub)}</small>` : '');
    stage.appendChild(b); await sleep(ms); b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 / speed, fill: 'forwards' }); setTimeout(() => b.remove(), 220 / speed);
  };
  const say = t => { logEl.textContent = t; };
  const nm = uid => (R[uid] || {}).name || '?';
  const trigName = e => e.fx ? e.n || '' : e.xg ? (XING[e.xg] || {}).n : e.food ? (FOOD[e.food] || {}).n : e.dao ? (DAO[e.dao] || {}).n : e.id ? (TRAITS[e.id] || {}).n : e.mk || '';

  // ----- 重放 -----
  layout();
  const onR = () => layout(); window.addEventListener('resize', onR);
  const big = new Set(); let round = 0, castMode = 0;
  for (let i = 0; i < log.length; i++) {
    if (skip) break;
    const e = log[i], u = U[e.uid];
    switch (e.t) {
      case 'begin': applySnap(e.s); Object.values(U).forEach((x, k) => { x.el.style.opacity = '0'; setTimeout(() => { x.el.style.opacity = '1'; }, (x.ro.side ? 120 : 0) + k * 30); }); say('开战'); await sleep(700); continue;
      case 'syn': { const t = [...e.daos.map(d => `${d.n}·${d.cnt}`), ...e.combos.map(c => '「' + c.n + '」')].join(' '); root.querySelector(e.side ? '.gbv-synb' : '.gbv-syna').textContent = t ? (e.side === me ? '' : '') + t : ''; break; }
      case 'order': drawOrder(null, e.q); await sleep(350); break;
      case 'round': round = e.n; root.querySelector('.gbv-rdl').textContent = `第 ${e.n} 轮`; await sleep(180); break;
      case 'act': Object.values(U).forEach(x => x.el.classList.toggle('now', x.uid === e.uid)); drawOrder(e.uid, e.q); await sleep(140); break;
      case 'skip': if (u) float(u, e.k === 'stun' ? '眩晕' : '蓄势', 'tag'); say(`${nm(e.uid)} ${e.k === 'stun' ? '被眩住，跳过' : '被挡在身后，蓄势（蛊力 +）'}`); await sleep(260); break;
      case 'atk': {
        const t = U[e.tg]; aimOn(e.cells, false, R[e.uid] && R[e.tg] && R[e.uid].side === R[e.tg].side); say(`${nm(e.uid)} → ${nm(e.tg)}`);
        await sleep(240); if (u && t) await shot(e.fx, u, t); aimOff(); castMode = 0; break;
      }
      case 'cast': {
        const tg = (e.tg || []).map(x => U[x]).filter(Boolean); aimOn(e.cells, true, tg[0] && u && tg[0].ro.side === u.ro.side);
        say(`${nm(e.uid)} 放出「${e.n}」`); await banner(e.n, nm(e.uid), 640); if (u) await castFx(e.fx, u, tg); aimOff(); castMode = 1; break;
      }
      case 'combo': {
        if (e.big && !big.has(e.uid)) {
          big.add(e.uid); say(`杀招 · ${e.n}`);
          const tg = (e.tg || []).map(x => U[x]).filter(Boolean);
          const sd = u ? u.ro.side : 0, live = Object.values(U).filter(x => x.alive), fo = live.filter(x => x.ro.side !== sd).map(center);
          if (!skip) await playCombo(stage, { id: e.id, name: e.n, side: sd, hud: outer, nameY: Math.max(26, G.top * 0.42), u: G.cw, from: u ? center(u) : { x: G.W / 2, y: G.H / 2 }, targets: tg.length ? tg.map(center) : fo, allies: live.filter(x => x.ro.side === sd).map(center), foes: fo, w: G.W, h: G.H, ground: G.top + 3 * G.rh, reduce: calm, speed, isSkip: () => skip });
        } else if (u) float(u, '「' + (e.n || '')[0] + '」', 'tag', -10);
        castMode = 1; break;
      }
      case 'dmg': {
        if (!u) break; const kill = e.s && !e.s.some(sd => sd.some(x => x[0] === e.uid && x[2] > 0));
        if (e.k === 'psn' || e.k === 'para' || e.k === 'burn' || e.k === 'doom') { float(u, '-' + e.n, e.k === 'burn' ? 'burn' : 'psn'); applySnap(e.s); await sleep(120); break; }
        flash(u); float(u, (e.crit ? '暴 ' : '') + '-' + e.n, e.crit ? 'crit' : '', castMode ? (i % 3) * -6 : 0); if (e.blk) float(u, '挡' + e.blk, 'blk', 14);
        applySnap(e.s);
        if (e.crit || kill) { shake(); await sleep(kill ? 160 : 90); }   // 顿帧：暴击、斩杀停一下
        await sleep(castMode ? 110 : 200); break;
      }
      case 'heal': if (u) float(u, '+' + e.n, 'heal'); applySnap(e.s); await sleep(120); break;
      case 'buff': {
        if (!u) break; const p = []; if (e.a) p.push((e.a > 0 ? '+' : '') + e.a + '攻'); if (e.h) p.push((e.h > 0 ? '+' : '') + e.h + '血'); if (e.sh) p.push('+' + e.sh + '护'); if (e.spd) p.push((e.spd > 0 ? '速+' : '速') + e.spd); if (e.adv) p.push('提前'); if (e.delay) p.push('推后');
        if (p.length) float(u, p.join(' '), e.a < 0 || e.delay ? 'psn' : 'heal', -12); applySnap(e.s); await sleep(e.dao ? 40 : 110); break;
      }
      case 'status': {
        if (!u) break; const k = e.k === 'freeze' ? 'stun' : e.k === 'clean' ? null : e.k;
        if (k && ST_CH[k]) { u.st[k] = 1; } if (e.k === 'clean') u.st = {}; setIcons(u); if (ST_N[e.k]) float(u, ST_N[e.k], 'tag', -18); await sleep(140); break;
      }
      case 'trig': { const n = trigName(e); if (u && n) float(u, n, 'tag', -22); applySnap(e.s); await sleep(e.id || e.xg ? 200 : 60); break; }
      case 'summon': applySnap(e.s); if (U[e.uid]) { U[e.uid].el.classList.add('summon'); say(`${nm(e.uid)} 现身`); } await sleep(220); break;
      case 'move': if (u) { if (e.k === 'bump' || e.k === 'wall') { float(u, '撞', 'tag'); flash(u); if (U[e.into]) flash(U[e.into]); shake(); } } applySnap(e.s); await sleep(220); break;
      case 'faint': if (u) { u.alive = false; u.el.classList.add('die'); say(`${nm(e.uid)} 倒下${e.eaten ? '（被吞）' : ''}`); } applySnap(e.s); await sleep(380); break;
      case 'end': break;
      default: applySnap(e.s);
    }
    // 状态图标随快照外的标记淡出：眩、网、嘲等由下一次出手消耗，这里只按事件粗略维护
    if (e.t === 'act' && u) { ['stun', 'web'].forEach(k => { if (u.st[k]) { u.st[k] = 0; } }); setIcons(u); }
  }
  window.removeEventListener('resize', onR);
  aimOff(); hideTip();
  const trip = modeOf(opts) === 'trip', won = res.winner !== 'draw' && (res.winner === 'A' ? 0 : 1) === me;
  if (trip && won) {   // 秘境里打赢：倒下的蛊全部救回，剩 1 血，从倒地处起身
    const up = Object.values(U).filter(x => !x.alive && x.ro.side === me && !x.ro.summon);
    if (up.length && !skip) {
      say(`打赢了，倒下的 ${up.length} 只救回来了（剩 1 血）`);
      up.forEach((x, k) => setTimeout(() => { x.alive = true; x.hp = 1; x.sh = 0; x.el.classList.remove('die'); x.el.classList.add('rise'); setBars(x); float(x, '救回', 'heal', -16); }, k * 160));
      await new Promise(r => setTimeout(r, 900 + up.length * 160));
    }
  }
  // 结算页
  showResult(root, res, opts, me, names, skip, resolve, () => window.removeEventListener('resize', onR));
}

function showResult(root, res, opts, me, names, skipped, resolve) {
  const R = res.roster, US = res.units, w = res.winner, mine = w === 'draw' ? 'draw' : (w === 'A' ? 0 : 1) === me ? 'win' : 'lose', trip = modeOf(opts) === 'trip';
  const head = mine === 'win' ? '胜' : mine === 'lose' ? '败' : '平';
  const art = (uid, sz) => guSVG(R[uid].sp, { rank: R[uid].rank || 1, size: sz, still: true });
  const rows = side => Object.entries(US).filter(([, x]) => x.side === side && !x.summon).map(([uid, x]) =>
    `<tr class="${x.dead ? 'dead' : ''}"><td>${art(uid)}<span>${esc(x.name)}${R[uid].rank ? `<small style="color:var(--mu)"> ${CN[R[uid].rank]}转</small>` : ''}</span></td><td>${x.dmg}</td><td>${x.taken}</td><td>${x.kills}</td><td>${side === me && trip ? (mine === 'win' ? (x.dead ? '<b style="color:#7ed29a">救回 1</b>' : x.hpEnd + '/' + x.mx) : '<b style="color:var(--zhu2,#d8553f)">永逝</b>') : x.dead ? '倒下' : x.hpEnd + '/' + x.mx}</td></tr>`).join('');
  const sm = Object.values(US).filter(x => x.summon), smTxt = side => { const L = sm.filter(x => x.side === side); return L.length ? `<tr><td colspan="5" style="color:var(--mu);font-size:11px">召唤物 ${L.length} 只，合计伤害 ${L.reduce((a, x) => a + x.dmg, 0)}</td></tr>` : ''; };
  const mv = res.mvp && US[res.mvp];
  const mineU = Object.entries(US).filter(([, x]) => x.side === me && !x.summon), saved = trip && mine === 'win' ? mineU.filter(([, x]) => x.dead) : [], fallen = trip && mine !== 'win' ? mineU : [];
  const deadRound = uid => { let rd = 0; for (const e of res.log) { if (e.t === 'round') rd = e.n; if (e.t === 'faint' && e.uid === uid) return rd || 1; } return rd; };
  const sota = opts.sota || res.sota || [];
  const box = document.createElement('div'); box.className = 'gbv-res';
  box.innerHTML = `<h3 class="${mine}">${head}</h3><div class="gbv-sub">${esc(names[me])} 对 ${esc(names[1 - me])} · ${res.rounds} 轮${skipped ? ' · 已跳过' : ''}</div>
    ${mv ? `<div class="gbv-mvp">${art(res.mvp, 52)}<div><em>本场最佳</em><b>${esc(mv.name)}</b><br><span style="font-size:12px">伤害 ${mv.dmg} · 承受 ${mv.taken} · 击杀 ${mv.kills}${mv.healed ? ' · 护佑 ' + mv.healed : ''}</span></div></div>` : ''}
    ${saved.length ? `<div class="gbv-save"><b>救回 ${saved.length} 只</b>（剩 1 血继续走）：${saved.map(([uid, x]) => `<span>${art(uid, 22)}${esc(x.name)}</span>`).join('')}</div>` : ''}
    ${fallen.length ? `<div class="gbv-fare"><h4>全队告别</h4><p class="gbv-lead">这一场输了，场上的蛊全部永久离开，这次出征到此为止。</p>${fallen.map(([uid, x], i) => `<div class="gbv-g" style="animation-delay:${0.4 + i * 0.6}s">${art(uid, 46)}<div><b>${esc(x.name)}</b>${R[uid].rank ? ` <small>${CN[R[uid].rank]}转</small>` : ''}<p>${x.dead ? `倒在第 ${deadRound(uid)} 轮` : '战到最后'}，打出 ${x.dmg} 点伤害${x.kills ? `、击倒 ${x.kills} 只` : ''}。它不会再回来了。</p></div></div>`).join('')}</div>` : ''}
    <table class="gbv-tb"><tr><th>${esc(names[me])}</th><th>伤害</th><th>承受</th><th>击杀</th><th>剩血</th></tr>${rows(me)}${smTxt(me)}
    <tr><td class="gbv-side" colspan="5">${esc(names[1 - me])}</td></tr>${rows(1 - me)}${smTxt(1 - me)}</table>
    ${trip ? '' : '<p class="gbv-note">切磋：不死蛊</p>'}
    ${sota[me] ? '<p class="gbv-note">SOTA +1%</p>' : ''}
    <button class="gbv-go">继续</button>`;
  root.appendChild(box);
  box.querySelector('.gbv-go').onclick = () => { box.remove(); resolve({ closed: true, skipped }); };
}

return { playBattle };
})();
// ---- src/reso.js（包一层，只放出 export）
const { daoChar, daoColor, resoInfo, resoHTML, resoGain, resoOf } = (() => {
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
// team = 阵上的蛊（{ sp, rank, atk, hp }，召唤物不算）。数字和战斗里一样：表里写 30，乘 RES_K（0.5）和相冲倍率，玩家拿到 15%。




const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const CN_ZHE = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const zhe = k => { const t = Math.round(k * 10); return t > 0 && t < 10 ? `打${CN_ZHE[t]}折` : `×${k}`; };
const pctOf = (v, k) => Math.round(v * RES_K * k);
const addOf = (n, p) => (p > 0 ? Math.max(1, Math.round(n * p / 100)) : 0);
const nmOf = g => (SP[g.sp] ? SP[g.sp].n : g.sp);

const daoChar = sp => { const d = DAO[daoOf(sp)]; return d ? (d.ch || d.n.replace(/道$/, '')[0]) : ''; };
const daoColor = sp => { const d = DAO[daoOf(sp)]; return d ? d.color : ''; };

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

function resoInfo(team) {
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

function resoHTML(team, opts = {}) {
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
    const tip = `杀招「${c.n}」：${c.d || ''}\n核心蛊：${RANK.names[c.rank] || ''}${c.coreName}，威力 ×${c.mul}`;
    chips.push(`<span class="rz combo" data-tip="${esc(tip)}"><b>招</b>${esc(c.n)}${c.mul && c.mul !== 1 ? ` ×${c.mul}` : ''}</span>`);
  }
  if (!chips.length) return opts.empty ? `<div class="reso2"><span class="rz none">${esc(opts.empty)}</span></div>` : '';
  return `<div class="reso2">${chips.join('')}</div>`;
}

// 再上阵一只 sp：哪一道会凑成或升一档（只数阵上的，召唤物不算）
function resoGain(team, sp) {
  const d = daoOf(sp), D = DAO[d]; if (!D) return null;
  const n = (team || []).filter(g => g && SP[g.sp] && daoOf(g.sp) === d).length + 1;
  if (!DAO_TIERS.includes(n) || !D['r' + n]) return null;
  return { dao: d, name: D.n, tier: n, sum: sumOf(D['r' + n]) };
}

// 这只蛊身上生效的共鸣（悬停写实际数）：「力道共鸣：攻 +15%（+3）」「冰雪道共鸣：血 +8%（+3）（与炎道相冲，打五折）」
function resoOf(team, g) {
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

return { daoChar, daoColor, resoInfo, resoHTML, resoGain, resoOf };
})();
// ---- src/meta.js
// 蛊码 GuCode · 成就道途（纯逻辑，不碰 DOM）。规则见 docs/design.md 第 4 节。
// 成就是一条逐步点亮的道途：达成一个，就解锁新的蛊、食物、秘境或玩法。成就本身不给数值。没有等级、经验、宝箱、每日任务。
//
// 用法：S.meta = metaMigrate(saved.meta)；事件发生时 const got = metaEmit(S.meta, '事件计数名', n, { set })，
//   got = 刚达成的道途节点数组（界面按 design.md 第 5 节全屏播放，每个停住等玩家点）。
//   事件计数名见 timeline.js 文件头（trips / clears / realm / merges / combos / buys / feeds）；opts.set = true 表示取最大值而不是累加（如境界）。
// isUnlocked(M, id, k)：物种 / 食物 / 秘境 / 玩法是否已解锁（不在 LOCKED 名单里的默认可用）。
// timelineView(M)：道途面板用，每条带 state：done 已达成 / open 可达成（前置已满足）/ locked 前置未满足。


const TL = Object.fromEntries(TIMELINE.map(a => [a.id, a]));
// 算力履历的成就与称号会登记到这里（ledger.js 的 ledgerMetaRegister），道途面板之外单独展示
const ACHIEVEMENTS = [], ACH_BY_ID = {}, TITLES = [];

function metaInit() { return { v: 3, cnt: {}, done: [], at: {} }; }
function metaMigrate(m) { return m && m.v === 3 ? Object.assign(metaInit(), m) : metaInit(); }

const reached = (M, a) => Object.entries(a.need || {}).every(([k, v]) => (M.cnt[k] || 0) >= v);
const opened = (M, a) => !a.after || M.done.includes(a.after);
function metaEmit(M, k, n = 1, o = {}) {
  if (!M) return [];
  if (k) M.cnt[k] = o.set ? Math.max(M.cnt[k] || 0, n) : (M.cnt[k] || 0) + n;
  const got = [];
  for (let changed = true; changed;) {
    changed = false;
    for (const a of TIMELINE) if (!M.done.includes(a.id) && opened(M, a) && reached(M, a)) { M.done.push(a.id); M.at[a.id] = Date.now(); got.push(a); changed = true; }
  }
  return got;
}
function isUnlocked(M, id, k) {
  if (!(LOCKED[k] || []).includes(id)) return true;
  return !!M && M.done.some(d => ((TL[d] || {}).unlock || []).some(u => u.k === k && u.id === id));
}
function timelineView(M) {
  return TIMELINE.map(a => ({ ...a, state: M && M.done.includes(a.id) ? 'done' : !M || opened(M, a) ? 'open' : 'locked', prog: Object.entries(a.need || {}).map(([k, v]) => ({ k, v, cur: Math.min(v, (M && M.cnt[k]) || 0) })) }));
}

// ---- src/hooks.js
// 蛊码 GuCode · 洞府与秘境之间的接口（纯登记表，不 import 任何文件）。
// 秘境一侧（trip.js / trip-ui.js）启动时往 TRIP 上挂自己的函数；洞府（ui.js）只通过这里调用，两边互不 import。
//
// 秘境挂上来的：
//   TRIP.start(api)        玩家在洞府确认渡劫后调用一次。秘境自己往 S.trip 写状态，画在 <section id="trip"> 里（api.el）。
//   TRIP.feed(S, tok)      渡劫中每次有 token 进账调用（洞府攒着的元气 S.bank 渡劫时由秘境自己先用掉）。
//   TRIP.render(api)       洞府重绘时、读档后渡劫仍未结束时调用，让秘境把界面画回来。
//   TRIP.active(S)         可选：渡劫中返回 true（默认按 !!S.trip 判断）。
//   TRIP.lands             秘境列表 [{ id, n, realm, quota, cap, dao, d, bk, boss: [{ sp, rank, pos, boss }] }]：洞府的「选秘境」列它
//   TRIP.foeFor(seed, quota, { dao, kind: 'room'|'elite'|'boss'|'ghost', depth }) → 敌阵：斗幽灵、战帖按额度分场时洞府也调它
// 渡劫前洞府已经查过：上阵转数总和 ≤ 秘境额度、每只 ≤ 驱使上限和秘境的 cap；然后设 S.trip = { at, land: id } 再调 TRIP.start。
// 洞府提供的 api（TRIP.api，启动时就挂好）：
//   api.S()                当前存档对象（直接读写；改完调 api.save()）
//   api.save()             落盘（节流）
//   api.el                 <section id="trip"> 元素
//   api.playBattle(foeTeam, opts) → Promise<{ res, A, B }>：复用洞府的战斗回放；opts = { title, team（默认 S.team）, seed, foeName, oa }
//                          oa 并进 battle() 的第 4 个参数（SOTA 由洞府补上；血量延续读每只蛊的 hpNow）
//   api.onTripEnd(result)  秘境结束（退出秘境、渡劫成功或渡劫失败）时调用一次。
//                          result = { dead: [uid], survivors: [uid], loot: { foods: [id], gu: [{ sp, rank, xing? }] }, cleared, wiped }
//                          洞府负责：删掉倒下的蛊、发战利品（全灭时秘境应传空 loot）、cleared 且秘境属于当前境界时渡劫（境界 +1，全屏）、全员回满、
//                          清掉 S.trip 和只在这次渡劫有效的食物（S.tripFood）、罗盘重转、蛊市刷新。
//   api.big(kind, title, lines)  全屏时刻（只给 design.md 第 5 节那三种用：'trib' 渡劫成功、'ach' 成就解锁、'combo' 杀招第一次成形）
//   api.note(text)         在原地战报加一行（其余反馈都用这个）
//   api.float(uid, text, kind)   在某只蛊身上跳一个字
const TRIP = { start: null, feed: null, render: null, active: null, api: null };

// ---- src/ledger.js
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




// ───────────────────────── 调参表 ─────────────────────────
const ROOT_TUNE = { days: 7, minTok: 1e6, rootMin: 0.15, mainMin: 0.5, heavenMin: 0.8, heaven: 0.08, main: 0.06, minor: 0.03, hun: 0.015, cap: 0.10 };
const CYCLE_TUNE = { chest: { '5h': 'copper', week: 'silver' }, minUsed: 1 };
const AGENT_TUNE = { min: 2, per: 0.04, cap: 0.12, maxShades: 6 };
const LG_GAME_URL = 'https://1596941391qq.github.io/gu-code/';

const LG_FAMS = ['claude-opus', 'claude-sonnet', 'claude-haiku', 'gpt', 'glm', 'gemini', 'qwen', 'other'];
const LG_FAM_NAME = { 'claude-opus': 'Opus', 'claude-sonnet': 'Sonnet', 'claude-haiku': 'Haiku', gpt: 'GPT', glm: 'GLM', gemini: 'Gemini', qwen: 'Qwen', other: '其他' };
// 五行：相生顺序（木→火→土→金→水）排在五角图上；traits = 该灵根加成的词条
const LG_ELEM = {
  mu: { ch: '木', fam: 'GLM', traits: ['devour'], verse: '木性吞纳，噬魂而长' },
  huo: { ch: '火', fam: 'Gemini', traits: ['strike'], verse: '火主锋芒，一击开阵' },
  tu: { ch: '土', fam: 'Qwen', traits: ['legacy'], verse: '土德厚载，遗泽后人' },
  jin: { ch: '金', fam: 'Claude', traits: ['shell', 'guard'], verse: '金气肃杀，护体如钟' },
  shui: { ch: '水', fam: 'GPT', traits: ['split', 'spawn', 'rally'], verse: '上善若水，分化无穷' },
};
const LG_HUN = { ch: '混', n: '混沌', verse: '混沌未判，万法皆通' };
const LG_EK = ['mu', 'huo', 'tu', 'jin', 'shui'];
const LG_ROOT_TRAITS = [...new Set(LG_EK.flatMap(e => LG_ELEM[e].traits))];
const lgFamElem = f => String(f).startsWith('claude') ? 'jin' : f === 'gpt' ? 'shui' : f === 'glm' ? 'mu' : f === 'gemini' ? 'huo' : f === 'qwen' ? 'tu' : 'hun';
const LG_TOOLS = [['edit', '炼器', '改文件'], ['bash', '御雷', '跑命令'], ['read', '神识', '读文件'], ['web', '天眼', '查网页'], ['task', '分神', '派子 agent'], ['other', '杂务', '其他']];
const LG_SHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const LG_SHI_ALIAS = ['夜半', '鸡鸣', '平旦', '日出', '食时', '隅中', '日中', '日昳', '晡时', '日入', '黄昏', '人定'];
const LG_CN_NUM = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const LG_TITLES = [[1e11, '吞天蛊尊'], [3e10, '焚天蛊仙'], [1e10, '百亿蛊师'], [1e9, '十亿蛊师'], [1e8, '亿灵蛊徒'], [0, '初炼蛊徒']];   // 按全年 raw
const LG_TITLE_DEFS = LG_TITLES.filter(([n]) => n > 0).reverse().map(([min, n], i) => ({ id: 'lg_t' + (i + 1), n, lgMin: min }));   // 可装备的称号
const LG_STALE_MS = 10 * 60e3;
const LEDGER_ACHS = [
  { id: 'lg_day_1e8', tier: 'bronze', n: '单日破亿', d: '单日全量吞吐过 1 亿 token' },
  { id: 'lg_day_1e9', tier: 'silver', n: '一日十亿', d: '单日全量吞吐过 10 亿 token' },
  { id: 'lg_streak7', tier: 'bronze', n: '七日连修', d: '连续 7 天都有 token 进账' },
  { id: 'lg_streak30', tier: 'gold', n: '三十日连修', d: '连续 30 天都有 token 进账' },
  { id: 'lg_quota_full', tier: 'silver', n: '周天圆满', d: '把一个五小时或每周额度窗口用满' },
  { id: 'lg_agents5', tier: 'silver', n: '五神分化', d: '同时有 5 个 agent 在跑' },
  { id: 'lg_zishi7', tier: 'bronze', n: '子时修士', d: '近 14 天里有 7 天在子时（23–1 点）修炼' },
  { id: 'lg_wuxing', tier: 'gold', n: '五行俱全', d: '近 7 天金木水火土五种灵根都用上，各占 1% 以上' },
];
const LG_ACH_TUNE = { day1: 1e8, day2: 1e9, zishi: 3e5 };   // raw 口径

// ───────────────────────── 小工具（全部 lg 前缀：构建后各模块共用一个作用域）─────────────────────────
const lgPad = n => String(n).padStart(2, '0');
const lgKey = d => d.getFullYear() + '-' + lgPad(d.getMonth() + 1) + '-' + lgPad(d.getDate());
const lgDate = k => { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, m - 1, d); };
const lgAdd = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const lgDiff = (a, b) => Math.round((b - a) / 864e5);
const lgEnd = L => { const d = new Date((L && L.generatedAt) || Date.now()); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const lgEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const lgSum = a => a.reduce((x, y) => x + y, 0);
const lgMD = k => { const d = lgDate(k); return `${d.getMonth() + 1}月${d.getDate()}日`; };
const lgX = d => d ? (+d.x > 0 ? +d.x : +d.t > 0 ? +d.t : 0) : 0;   // 当天全量吞吐，旧数据退回当量
const lgBuffTag = () => !LGS.live ? '（演示）' : LGS.opts.buffsOn ? '' : '（待接入）';
const lgOff = (L, o) => !L || (L.demo && !(o && o.demo));
function lgCN(n) {
  n = +n || 0;
  if (n >= 1e8) { const v = n / 1e8; return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + '亿'; }
  if (n >= 1e4) { const v = n / 1e4; return (v >= 100 ? v.toFixed(0) : v.toFixed(1)) + '万'; }
  return String(Math.round(n));
}
// 「5000万」「2亿」「50M」「1.5e8」→ 数字；不认识返回 0
function lgParseTok(s) {
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
function ledgerStats(L) {
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
function rootShares(L, n = ROOT_TUNE.days) {
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
function rootVerdict(shares, total) {
  const T = ROOT_TUNE;
  if (!(total >= T.minTok)) return { roots: [], verdict: '灵根未显', verse: '近七日灵气稀薄，多修几日再来测。', kind: 'none' };
  if (shares.hun >= T.mainMin) return { roots: ['hun'], verdict: '混沌灵体', verse: LG_HUN.verse, kind: 'hun' };
  const roots = LG_EK.filter(e => shares[e] >= T.rootMin).sort((a, b) => shares[b] - shares[a]);
  if (!roots.length) return { roots: [], verdict: '五行杂灵根', verse: '诸气相杂，未有所归', kind: 'mixed' };
  const ch = roots.map(e => LG_ELEM[e].ch).join(''), top = LG_ELEM[roots[0]];
  const verdict = roots.length === 1 ? (shares[roots[0]] >= T.heavenMin ? `天灵根 · ${ch}` : `${ch}单灵根`) : roots.length === 2 ? `${ch}双灵根` : roots.length === 3 ? `${ch}三灵根` : roots.length === 4 ? '四象杂灵根' : '五行杂灵根';
  return { roots, verdict, verse: roots.length >= 4 ? '诸气相杂，未有所归' : top.verse, kind: roots.length === 1 && shares[roots[0]] >= T.heavenMin ? 'heaven' : 'root' };
}
function rootBuffs(L, opts = {}) {
  const T = ROOT_TUNE, { shares, total } = rootShares(L || {}), v = rootVerdict(shares, total), trait = {}, off = lgOff(L, opts);
  if (!off && v.kind !== 'none') {
    for (const e of LG_EK) { const s = shares[e], b = s >= T.heavenMin ? T.heaven : s >= T.mainMin ? T.main : s >= T.rootMin ? T.minor : 0; if (b) LG_ELEM[e].traits.forEach(id => { trait[id] = (trait[id] || 0) + b; }); }
    if (shares.hun >= T.rootMin) LG_ROOT_TRAITS.forEach(id => { trait[id] = (trait[id] || 0) + T.hun; });
    for (const id in trait) trait[id] = Math.min(T.cap, +trait[id].toFixed(4));
  }
  return { shares, total, ...v, trait, cap: T.cap, active: !off };
}
// 喂养倍率：这只蛊身上每种词条取一次加成，合计封顶 cap。没有加成时恰好返回 1
function rootFeedMul(buffs, g) {
  if (!buffs || !buffs.trait || !g || !g.tr) return 1;
  const ids = new Set((Array.isArray(g.tr) ? g.tr : Object.entries(g.tr)).map(x => x[0])); let s = 0;
  ids.forEach(id => { s += buffs.trait[id] || 0; });
  return 1 + Math.min(buffs.cap || ROOT_TUNE.cap, s);
}
function rootBuffText(b) {
  const g = {}; for (const id in b.trait) (g[b.trait[id]] || (g[b.trait[id]] = [])).push(TRAITS[id] ? TRAITS[id].n : id);
  const parts = Object.keys(g).sort((x, y) => y - x).map(v => `带${g[v].join('、')}的蛊吸纳 +${Math.round(v * 1000) / 10}%`);
  return parts.length ? parts.join('；') + `（单只封顶 +${Math.round(b.cap * 100)}%，不影响斗蛊）` : '暂无灵根加成';
}
// 周天轮转：存档里只需要这份快照
function ledgerSnap(L) {
  if (!L) return null;
  return { at: L.generatedAt || 0, demo: !!L.demo, windows: (L.windows || []).map(w => ({ key: w.key, kind: w.kind, label: w.label, start: w.start, resetsAt: w.resetsAt, used: w.used, pct: w.pct })) };
}
function cycleRewards(prev, cur, opts = {}) {
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
function agentBonus(L, opts = {}) {
  const n = Math.max(0, Math.min(99, Math.floor(+(L && L.agents && L.agents.active) || 0)));
  if (n < AGENT_TUNE.min) return { active: n, show: false, label: '', stoneMul: 1, pct: 0, shades: 0 };
  const pct = lgOff(L, opts) ? 0 : Math.min(AGENT_TUNE.cap, +(AGENT_TUNE.per * (n - 1)).toFixed(4));
  return { active: n, show: true, label: `分神 ×${n}`, stoneMul: 1 + pct, pct, shades: Math.min(AGENT_TUNE.maxShades, n) };
}
function ledgerAchievements(L, opts = {}) {
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
function ledgerShichen(L) {
  const acc = new Array(12).fill(0);
  for (const k in (L && L.hours) || {}) (L.hours[k] || []).forEach((v, h) => { acc[Math.floor(((h + 1) % 24) / 2)] += +v || 0; });
  const tot = lgSum(acc); if (!tot) return null;
  const i = acc.indexOf(Math.max(...acc)), a = (i * 2 + 23) % 24;
  return { i, ch: LG_SHI[i], alias: LG_SHI_ALIAS[i], range: `${a}–${(a + 2) % 24} 点`, share: acc[i] / tot, acc };
}
function ledgerTitle(total) { return (LG_TITLES.find(([n]) => total >= n) || LG_TITLES[LG_TITLES.length - 1])[1]; }

// ───────────────────────── 接入 meta ─────────────────────────
const lgHasAch = (S, id) => !!(S && Array.isArray(S.lgAch) && S.lgAch.includes(id));
function ledgerMetaRegister() {   // 幂等：成就与称号并进 meta 的表
  for (const a of LEDGER_ACHS) if (!ACH_BY_ID[a.id]) { const x = { ...a, hidden: false, check: c => lgHasAch(c.S, a.id) }; ACHIEVEMENTS.push(x); ACH_BY_ID[a.id] = x; }
  for (const t of LG_TITLE_DEFS) if (!TITLES.some(x => x.id === t.id)) TITLES.push({ ...t });
}
// 真实数据到达时调用：改 S 的三个履历字段、轮转箱进 M.chests、按全年吞吐发称号；返回要展示的奖励（chest / title）
function ledgerApply(M, S, L) {
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
const ledgerFeedMul = g => lgFresh() && LGS.opts.buffsOn ? rootFeedMul(LGS.buffs, g) : 1;
const ledgerStoneMul = () => lgFresh() && LGS.opts.buffsOn && LGS.agent ? LGS.agent.stoneMul : 1;

// ───────────────────────── 校验清洗 ─────────────────────────
function normLedger(raw) {
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
function demoLedger(seed = 'gucode', now = Date.now()) {
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
function ledgerInit(opts = {}) {
  LGS.opts = opts; ledgerMetaRegister();
  if (typeof window === 'undefined' || LGS.bound) return; LGS.bound = true;
  window.addEventListener('message', e => {
    const m = e.data; if (!m || m.type !== 'ledger') return;
    if (!opts.vsc) { const o = e.origin || ''; if (!(o === location.origin || o === 'null' || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o))) return; }
    ledgerIngest(m);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('lgx')) { if (document.querySelector('.lg-cardbg')) lgCardClose(); else closeLedger(); } });
}
function ledgerIngest(raw) {
  const L = normLedger(raw); if (!L) return null;
  LGS.data = L; LGS.live = true; LGS.buffs = rootBuffs(L); LGS.agent = agentBonus(L);
  if (document.getElementById('lgx')) lgRender();
  if (LGS.opts.onData) try { LGS.opts.onData(L); } catch (e) {}
  return L;
}
const ledgerLive = () => LGS.live;
function ledgerData() {
  if (LGS.data) return LGS.data;
  const day = lgKey(new Date());
  if (!LGS.demo || LGS.demoDay !== day) { LGS.demo = demoLedger('gucode', Date.now()); LGS.demoDay = day; }
  return LGS.demo;
}
function openLedger(meta = {}) {
  LGS.meta = meta; LGS.sel = null; closeLedger();
  const box = document.createElement('div'); box.className = 'lgx'; box.id = 'lgx'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '算力履历');
  box.addEventListener('click', lgClick); document.body.appendChild(box);
  lgRender();
  LGS.timer = setInterval(lgTick, 1000);
}
function closeLedger() { const b = document.getElementById('lgx'); if (b) b.remove(); clearInterval(LGS.timer); }
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
const lgWinPct = (w, lim = {}) => w.pct != null ? w.pct : lim[w.key] > 0 ? w.used / lim[w.key] : null;
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
function ledgerLimitRows() {
  const L = ledgerData(), ws = (L.windows || []).filter(w => w.pct == null); if (!ws.length) return '';
  const lim = lgLimits();
  return `<div class="set lg-limhead"><span>周天额度上限<small>插件读不到上限的窗口，填上就能显示百分比。和「已用」同口径（全量吞吐），可写 5亿、5000万、50M 或纯数字，清空即取消</small><small class="lg-limrule">以哪个为准：VS Code 插件设置里的 gucode.limits 填过、或插件自己算得出百分比的窗口，一律用插件的，这里不再出现；这里只给插件算不出的窗口补上限。</small></span></div>` +
    ws.map(w => `<label class="set lg-lim"><span>${lgEsc(w.label)}</span><input data-lglim="${lgEsc(w.key)}" inputmode="decimal" placeholder="例如 5亿" value="${lim[w.key] ? lgCN(lim[w.key]) : ''}"></label>`).join('');
}
function ledgerBindLimits(root) {
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
function ledgerShades(host) {
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
function makeLedgerCard(L, meta = {}) {
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

// ---- src/trip-mods.js
// 蛊码 GuCode · 秘境的重开性内容（纯数据 + 纯函数，不碰 DOM）：天象、首领机制、秘境祝福、劫数。规则正本 docs/design.md 第 2.7 节。
// 战斗效果按 docs/battle-spec.md 第 4–6 节的格式写（{ when, op, tg, …数值, if }），挂在单位的 g.fx 上交给 battle()：
//   g.fx = [{ id, n, kind: 'sky' | 'boss' | 'bless' | 'food' | 'jie', eff: [...] }]；引擎触发时发 trig { uid, fx: id }，画面显示 n。
// 数值不随转数涨（up: 0）。op 'flag'（gpMul / psnMul / bumpMul / noSummon / noRevive / immune）见 battle-spec 第 11 节。

// ───────────── 天象：每趟秘境一个，进秘境前写明，双方每场都吃 ─────────────
// all = 每只蛊都挂；dao = 只挂给这一道的蛊。k = 劫数「天象加重」时数值乘几倍（scaleEff）
const SKIES = [
  { id: 'duwu', n: '毒雾', d: '每轮开始，场上每只蛊挂 1 层毒（每层每轮掉满血 2%）',
    all: [{ when: 'round', op: 'st', tg: 'self', k: 'psn', n: 1, mx: 0.02, up: 0 }] },
  { id: 'lingchao', n: '灵潮', d: '每次出手攒的蛊力翻倍，主动技来得快一倍',
    all: [{ when: 'start', op: 'flag', tg: 'self', k: 'gpMul', v: 2 }] },
  { id: 'hanye', n: '寒夜', d: '冰雪道的蛊攻 +20%，炎道的蛊攻 −20%',
    dao: { bing: [{ when: 'start', op: 'buff', tg: 'self', atk: 0.2 }], yan: [{ when: 'start', op: 'buff', tg: 'self', atk: -0.2 }] } },
  { id: 'yanri', n: '烈日', d: '炎道的蛊攻 +20%，冰雪道的蛊攻 −20%',
    dao: { yan: [{ when: 'start', op: 'buff', tg: 'self', atk: 0.2 }], bing: [{ when: 'start', op: 'buff', tg: 'self', atk: -0.2 }] } },
  { id: 'leiyu', n: '雷雨', d: '雷道的蛊速 +25%；金道的蛊引雷，每轮开始掉满血 3%',
    dao: { lei: [{ when: 'start', op: 'buff', tg: 'self', spd: 0.25 }], jin: [{ when: 'round', op: 'dmg', tg: 'self', mx: 0.03, up: 0, pierce: 1 }] } },
  { id: 'kuangfeng', n: '狂风', d: '远程普攻伤害 −30%，近战照常',
    all: [{ when: 'deal', op: 'mul', v: 0.7, if: 'ranged' }] },
  { id: 'yeshen', n: '长夜', d: '暗道的蛊攻 +20%，光道的蛊攻 −20%',
    dao: { an: [{ when: 'start', op: 'buff', tg: 'self', atk: 0.2 }], guang: [{ when: 'start', op: 'buff', tg: 'self', atk: -0.2 }] } },
  { id: 'huangsha', n: '黄沙', d: '土道的蛊血 +20%，木道的蛊攻 −15%',
    dao: { tu: [{ when: 'start', op: 'buff', tg: 'self', hp: 0.2 }], mu: [{ when: 'start', op: 'buff', tg: 'self', atk: -0.15 }] } },
  { id: 'chunlin', n: '春霖', d: '每轮开始全场回满血 3%（木道的蛊回 6%）',
    all: [{ when: 'round', op: 'heal', tg: 'self', mx: 0.03, up: 0 }], dao: { mu: [{ when: 'round', op: 'heal', tg: 'self', mx: 0.03, up: 0 }] } },
  { id: 'xueyue', n: '血月', d: '普攻打中回这一下伤害的 15%（血道的蛊回 30%）',
    all: [{ when: 'attack', op: 'heal', tg: 'self', n: 0.15, up: 0 }], dao: { xue: [{ when: 'attack', op: 'heal', tg: 'self', n: 0.15, up: 0 }] } },
];
const SKY = Object.fromEntries(SKIES.map(s => [s.id, s]));

// ───────────── 首领机制：每个首领一条，专克一种打法，开打前写明 ─────────────
// on = 'lead' 只挂在领头身上 / 'team' 首领一方每只都挂；k = 克什么打法（写给玩家看）
const MECHS = [
  { id: 'baidu', n: '百毒不侵', k: '克毒', d: '首领一方受到的毒伤只剩两成', on: 'team', eff: [{ when: 'take', op: 'mul', v: 0.2, if: 'kind=psn' }] },
  { id: 'zhanruo', n: '斩弱', k: '克铺小蛊、带残血', d: '每轮开始，领头对你血最少的那只打一下（攻 ×0.8，无视护体）', on: 'lead', eff: [{ when: 'round', op: 'dmg', tg: 'foe.low', atk: 0.8, pierce: 1, up: 0 }] },
  { id: 'fanzhen', n: '反震', k: '克单体猛攻', d: '领头被普攻打中，把这一下的 40% 反弹回去', on: 'lead', eff: [{ when: 'hit', op: 'dmg', tg: 'src', n: 0.4, up: 0, if: 'kind=hit' }] },
  { id: 'fengli', n: '封力', k: '克主动技', d: '开战时封住你全队的蛊力 2 轮', on: 'lead', eff: [{ when: 'start', op: 'st', tg: 'foe.all', k: 'seal', n: 2 }] },
  { id: 'tiebi', n: '铁壁', k: '克技能流', d: '首领一方受到的技能伤害 −40%', on: 'team', eff: [{ when: 'take', op: 'mul', v: 0.6, if: 'kind=skill' }] },
  { id: 'kuangbao', n: '狂暴', k: '克拖延、续航', d: '第 4 轮起，首领一方每轮攻 +25%（最多三次）', on: 'team', eff: [{ when: 'round', op: 'buff', tg: 'self', atk: 0.25, if: 'round>=4', max: 3 }] },
  { id: 'xianfa', n: '先发制人', k: '克慢速后手', d: '首领一方速 +30%', on: 'team', eff: [{ when: 'start', op: 'buff', tg: 'self', spd: 0.3 }] },
  { id: 'hengsao', n: '横扫', k: '克密集铺场', d: '领头普攻打中时，你全队都挨这一下的 25%', on: 'lead', eff: [{ when: 'attack', op: 'dmg', tg: 'foe.all', n: 0.25, up: 0 }] },
  { id: 'yinxue', n: '饮血', k: '克消耗战', d: '首领一方普攻打中回这一下伤害的 40%', on: 'team', eff: [{ when: 'attack', op: 'heal', tg: 'self', n: 0.4, up: 0 }] },
  { id: 'duanhun', n: '断魂', k: '克召唤、亡语', d: '你这一方放不出召唤，免死和亡语都不生效', on: 'lead',
    eff: [{ when: 'start', op: 'flag', tg: 'foe.all', k: 'noSummon', v: 1 }, { when: 'start', op: 'flag', tg: 'foe.all', k: 'noRevive', v: 1 }] },
];
const MECH = Object.fromEntries(MECHS.map(m => [m.id, m]));

// ───────────── 秘境祝福：部分房间三选一，只在这一趟有效，出秘境清零 ─────────────
// eff = 每场挂给我方每只出场蛊；trip = 秘境里的规则改动（路程、篝火、掉落、坊市、救回剩几成血、开打前回血）；fights = 只管接下来几场（不写 = 这一趟一直有效）
const BLESSES = [
  { id: 'xiansheng', n: '先声', d: '每场开战蛊力就是满的，第一次出手直接放主动技', eff: [{ when: 'start', op: 'gp', tg: 'self', v: 100 }] },
  { id: 'tiejia', n: '铁甲', d: '每场开战得满血 20% 的护体', eff: [{ when: 'start', op: 'shield', tg: 'self', mx: 0.2, up: 0 }] },
  { id: 'ruifeng', n: '锐锋', d: '攻 +15%', eff: [{ when: 'start', op: 'buff', tg: 'self', atk: 0.15 }] },
  { id: 'jifeng', n: '疾风', d: '速 +15%', eff: [{ when: 'start', op: 'buff', tg: 'self', spd: 0.15 }] },
  { id: 'huichun', n: '回春', d: '每轮开始回满血 5%', eff: [{ when: 'round', op: 'heal', tg: 'self', mx: 0.05, up: 0 }] },
  { id: 'yinxue', n: '饮血', d: '普攻打中回这一下伤害的 25%', eff: [{ when: 'attack', op: 'heal', tg: 'self', n: 0.25, up: 0 }] },
  { id: 'jingji', n: '荆棘', d: '被普攻打中，反伤这一下的 30%', eff: [{ when: 'hit', op: 'dmg', tg: 'src', n: 0.3, up: 0, if: 'kind=hit' }] },
  { id: 'zhuiming', n: '追命', d: '打血量不到一半的敌蛊，伤害 ×1.3', eff: [{ when: 'deal', op: 'mul', v: 1.3, if: 'tg.hp<50' }] },
  { id: 'buqu', n: '不屈', d: '每场第一次受到致命伤，留 1 血', eff: [{ when: 'lethal', op: 'endure', v: 0, max: 1 }] },
  { id: 'pojia', n: '破甲', d: '普攻打中给目标挂「印」1 轮（受到的伤害 +25%）', eff: [{ when: 'attack', op: 'st', tg: 'tg', k: 'mark', n: 1 }] },
  { id: 'tongxin', n: '同心', d: '有友蛊倒下时，攻 +15%', eff: [{ when: 'allyDeath', op: 'buff', tg: 'self', atk: 0.15 }] },
  { id: 'xuli', n: '蓄力', d: '每次出手多攒一半蛊力', eff: [{ when: 'pre', op: 'gp', tg: 'self', v: 17 }] },
  { id: 'shouwang', n: '守望', d: '站最前的蛊开战得满血 40% 的护体', eff: [{ when: 'start', op: 'shield', tg: 'self', mx: 0.4, up: 0, if: 'front' }] },
  { id: 'dushang', n: '毒上加毒', d: '你挂的毒层数翻倍', eff: [{ when: 'start', op: 'flag', tg: 'self', k: 'psnMul', v: 2 }] },
  { id: 'zhuangshan', n: '撞山', d: '击退把敌蛊撞上别的蛊时，撞伤翻倍', eff: [{ when: 'start', op: 'flag', tg: 'self', k: 'bumpMul', v: 2 }] },
  { id: 'fengxing', n: '风行', d: '剩下的路程少走 25%', trip: { road: 0.75 } },
  { id: 'guhuo', n: '篝火旺', d: '篝火回满血的 100%（原来一半）', trip: { camp: 1 } },
  { id: 'fengshou', n: '丰收', d: '打赢战斗多掉一份食物', trip: { food: 1 } },
  { id: 'shuke', n: '熟客', d: '坊市的东西半价', trip: { price: 0.5 } },
  { id: 'qiangjiu', n: '抢救', d: '打赢后倒下的蛊救回时剩三成血（原来只剩 1 血）', trip: { rescue: 0.3 } },
  { id: 'baoyou', n: '庇佑', d: '开打前全队回满血 25%', trip: { pre: 0.25 }, fights: 3 },
];
const BLESS = Object.fromEntries(BLESSES.map(b => [b.id, b]));
const blessLast = b => (b.fights ? `管接下来 ${b.fights} 场战斗` : '这一趟一直有效');

// ───────────── 劫数：通关一个秘境后能开劫一到劫十，每级叠一条限制（劫 n 含劫 1…n 全部）─────────────
// 解锁条件由道途决定（洞府一侧）；秘境只认 tripStart 的 opts.jie，结果里带回 jie，洞府记每个秘境打到第几劫
const JIE = [
  { n: '敌蛊速 +10%', foe: [{ when: 'start', op: 'buff', tg: 'self', spd: 0.1 }] },
  { n: '篝火只回三成血', trip: { camp: 0.3 } },
  { n: '天象加重：天象的数值 ×1.5', trip: { sky: 1.5 } },
  { n: '精英多用一成额度', trip: { elite: 0.1 } },
  { n: '路程 +20%', trip: { road: 1.2 } },
  { n: '坊市涨价五成', trip: { price: 1.5 } },
  { n: '首领多用一成额度', trip: { boss: 0.1 } },
  { n: '敌蛊血 +10%', foe: [{ when: 'start', op: 'buff', tg: 'self', hp: 0.1 }] },
  { n: '普通战斗多用一成额度', trip: { room: 0.1 } },
  { n: '首领再多带一条机制', trip: { mech2: 1 } },
];
const JIE_MAX = JIE.length;
const JIE_NAMES = ['', '劫一', '劫二', '劫三', '劫四', '劫五', '劫六', '劫七', '劫八', '劫九', '劫十'];
// 劫 n 的全部规则：数值类相乘或相加，敌方效果合在一起
function jieRules(n) {
  const r = { camp: null, sky: 1, elite: 0, road: 1, price: 1, boss: 0, room: 0, mech2: 0, foe: [] };
  JIE.slice(0, Math.max(0, Math.min(JIE_MAX, n | 0))).forEach(j => {
    const t = j.trip || {};
    if (t.camp != null) r.camp = t.camp; if (t.sky) r.sky *= t.sky; if (t.road) r.road *= t.road; if (t.price) r.price *= t.price;
    r.elite += t.elite || 0; r.boss += t.boss || 0; r.room += t.room || 0; r.mech2 = r.mech2 || t.mech2 || 0;
    if (j.foe) r.foe.push(...j.foe);
  });
  return r;
}

// 效果数值乘 k（天象加重用）：只乘量的键，不乘 v 以外的开关
const SCALE_KEYS = ['atk', 'hp', 'spd', 'mx', 'n'];
function scaleEff(list, k) {
  if (!k || k === 1) return list;
  return list.map(e => { const o = { ...e }; SCALE_KEYS.forEach(key => { if (typeof o[key] === 'number' && !(key === 'n' && e.op === 'st')) o[key] = +(o[key] * k).toFixed(3); });
    if ((e.op === 'mul' || e.op === 'flag') && typeof e.v === 'number') o.v = +(1 + (e.v - 1) * k).toFixed(3); return o; });   // 倍率类（×0.7、×2）按离 1 的距离放大
}
// 这只蛊这一场吃到的天象效果
function skyEff(sky, daoId, k = 1) {
  const s = typeof sky === 'string' ? SKY[sky] : sky; if (!s) return [];
  return scaleEff([...(s.all || []), ...((s.dao && s.dao[daoId]) || [])], k);
}
// 祝福的规则改动合在一起（只算还在有效期里的）
function blessRules(list) {
  const r = { road: 1, camp: null, food: 0, price: 1, rescue: 0, pre: 0 };
  (list || []).forEach(x => { const b = BLESS[x.id]; if (!b || !b.trip || (b.fights && (x.left | 0) <= 0)) return; const t = b.trip;
    if (t.road) r.road *= t.road; if (t.camp != null) r.camp = Math.max(r.camp || 0, t.camp); if (t.price) r.price *= t.price; r.food += t.food || 0; r.rescue = Math.max(r.rescue, t.rescue || 0); r.pre += t.pre || 0; });
  return r;
}

// ---- src/trip.js
// 蛊码 GuCode · 秘境（纯逻辑：地图、房间、血量延续、永久死亡、撤退与全灭、战利品、蛊性）。种子随机，不碰 DOM。
// 规则正本：docs/design.md 第 2 节。界面在 trip-ui.js。战斗引擎归战斗一侧：秘境给出场蛊带 hpNow，读回 res.hpEnd（每只剩血，0 = 倒下）
// 和 res.statA（每只这一场的经历，判蛊性用）；引擎还没给 hpEnd 时，用最后一帧快照兜底（hpFromLog）。
// 资源只有元气（= 消耗的 token）：房间路程、坊市、奇遇里要花的都按元气算，先花洞府攒着的（purse.bank），不够就等实时 token。





// ───────────── 蛊性：秘境里打出来的经历。每只蛊最多 1 个；数值按进场攻血的百分比，后期不贬值 ─────────────
// 顺序 = 坐标码里的下标（只能往后加）。prio 越小越优先（同一场同时达成几个时取一个）。get = 怎么得到，d = 效果（界面原样显示）
// eff = 战斗效果，格式见 docs/battle-spec.md 第 6 节（{ when, op, … }，按攻血百分比）；引擎触发时发 trig { uid, xg }
Object.assign(XING, {
  jianren:  { n: '坚韧', prio: 1, get: '残血（不到四分之一）活过一场', d: '每场第一次受到致命伤时，留 1 血', eff: [{ when: 'lethal', op: 'endure', v: 0, max: 1 }] },
  shisha:   { n: '嗜杀', prio: 2, get: '一场里斩杀三只', d: '每斩杀一只，攻 +20%（按进场时的攻算）', eff: [{ when: 'kill', op: 'buff', tg: 'self', atk: 0.2 }] },
  ruiqi:    { n: '锐气', prio: 4, get: '第一轮就斩杀一只', d: '每场第一次出手，伤害 ×1.5', eff: [{ when: 'deal', op: 'mul', v: 1.5, if: 'first' }] },
  zhanshou: { n: '斩首', prio: 3, get: '一下打倒一只满血的敌蛊', d: '打满血的敌蛊，伤害 ×1.3', eff: [{ when: 'deal', op: 'mul', v: 1.3, if: 'tg.full' }] },
  tongpao:  { n: '同袍', prio: 5, get: '相邻的友蛊倒下了，自己撑到打赢', d: '相邻友蛊倒下时，回满血的 25%', eff: [{ when: 'allyDeath', op: 'heal', tg: 'self', mx: 0.25, up: 0, if: 'dead.adj' }] },
  zhenyue:  { n: '镇岳', prio: 6, get: '站最前挨了 4 下还活着', d: '开战时站最前，得满血 25% 的护体', eff: [{ when: 'start', op: 'shield', tg: 'self', mx: 0.25, up: 0, if: 'front' }] },
  yuxue:    { n: '浴血', prio: 7, get: '一场里掉的血超过自己满血，还活着', d: '每被普攻打中一次还活着，攻 +10%', eff: [{ when: 'hit', op: 'buff', tg: 'self', atk: 0.1, if: 'kind=hit' }] },
  zhefu:    { n: '蛰伏', prio: 8, get: '身前的友蛊倒下了，自己撑到打赢', d: '身前友蛊倒下时，攻和血 +15%', eff: [{ when: 'allyDeath', op: 'buff', tg: 'self', atk: 0.15, hp: 0.15, if: 'dead.ahead' }] },
});
const XORDER = () => Object.keys(XING).sort((a, b) => (XING[a].prio || 99) - (XING[b].prio || 99));
// 一场打完，这只蛊达成了哪个蛊性（只看活下来的；已经有的那个不算新的）。st 见战斗结果的 statA
function xingEarned(st, won, cur) {
  if (!st || !(st.hp > 0) || !st.mx) return null;
  const ok = { jianren: st.hp / st.mx <= 0.25, shisha: st.kills >= 3, ruiqi: !!st.killT1, zhanshou: !!st.oneShot, tongpao: won && !!st.adjFell,
    zhenyue: !!st.front && st.hits >= 4, yuxue: st.taken >= st.mx, zhefu: won && !!st.frontFell };
  return XORDER().find(k => ok[k] && k !== cur) || null;
}

// ───────────── 调参总表（贡献者只改这里）─────────────
const TRIP_CFG = {
  depth: 10,                                   // 第 1–9 层普通房间，第 10 层是首领（渡劫）
  // 房间路程，单位「千」：乘 TokenSource.unit 得到元气（插件 8000，网页 200）。真实画像中位数约 21 万 token/分钟（缓存读取 ×0.1 折算），
  // base 90 ≈ 72 万元气 ≈ 3.4 分钟，越深越远，首领约 5.3 分钟；整趟约 44 分钟。节奏表见 tools/trip-test.mjs
  cost: { base: 90, per: 6, jit: 0.12 },
  w: { fight: 50, event: 16, elite: 12, camp: 8, market: 8, bless: 8 },   // 房间权重
  from: { event: 1, market: 2, elite: 3, camp: 3, bless: 1 },             // 第几层（从 0 数）起出现
  rowMax: { elite: 1, camp: 1, market: 1, event: 1, bless: 1 },           // 同一层最多几个
  // 敌阵只按额度配，不看玩家的蛊池（见 foeByBudget）：额度 = 上阵蛊转数总和的上限。敌蛊攻血一律用正常的转数表，不打折、不暗加。
  // 难度只靠「用掉几成额度」调：普通战斗 frac[0] + frac[1]×(层数 − ramp)；精英 elite；首领 boss × 每个秘境的 bk；斗幽灵 ghost 满额。
  // 规则是「赢了救回，输了全死」，所以目标是输的概率：浅层每场 < 5%，精英 15%–20%，首领 35%–45%（配队一般，见 tools/trip-test.mjs）
  foe: { frac: [0.4, 0.04], ramp: 2, elite: 0.64, boss: 0.85, ghost: 1, maxN: 7, daoP: 0.65 },
  camp: 0.5,                                   // 篝火：全队回满血的 50%
  // 战利品只有新蛊和食物，越深越多、越稀有：数量 = 基数 + 每层 × 层数（小数部分按几率）；新蛊升一转的几率 up[0] + up[1]×层数，
  // 第 rare 层起一半几率出自高一档蛊池；食物按价钱算稀有，越深越偏向贵的
  loot: {
    fight: { food: [0.25, 0.04], gu: [0.12, 0.03] },
    elite: { food: [1, 0.05], gu: [0.6, 0.04] },
    boss: { food: [1, 0], gu: [0, 0] },        // 首领另有「渡劫成功必掉」二选一（bossReward）
    up: [0.05, 0.05], rare: 5,
  },
  market: { heal: 0.4, price: { heal: 35, food: 45, gu: 70 }, realm: 0.25 },   // 坊市价格（千，乘 unit 得元气），每高一境 +25%
  pay: { realm: 0.25 },                        // 奇遇里要花的元气，每高一境 +25%
  bless: 3,                                    // 祝福一次给几个选（灵台房间、打赢精英后）
};
// n 名字、ch 地图上的单字、k 图例里的一句用途、tip 地图格子悬停的一句话（是什么、能得到什么）、d 进房间后的说明
const ROOMS = {
  fight:  { n: '战斗', ch: '斗', k: '打野蛊', tip: '战斗：一伙野蛊拦路。打赢可能掉食物和新蛊，倒下的都能救回', d: '一伙野蛊拦路。赢了倒下的都能救回，还可能掉食物和新蛊' },
  elite:  { n: '精英', ch: '精', k: '强敌，必掉东西', tip: '精英：强敌。打赢必掉食物、常有新蛊，还能选一个祝福；输了全队永久死亡', d: '强敌，开打前能看阵容。赢了必得食物，常有新蛊，还能选一个祝福' },
  event:  { n: '奇遇', ch: '遇', k: '二选一的小事', tip: '奇遇：一段小事，两个选择，结果都先写明（回血、食物、新蛊、蛊性……）', d: '一段小事，两个选择，结果都先写明' },
  camp:   { n: '篝火', ch: '火', k: '歇脚回血', tip: '篝火：歇脚的地方，全队回血（不是炎道）', d: '歇脚，全队回满血的一半' },
  market: { n: '坊市', ch: '市', k: '花元气买东西', tip: '坊市：秘境里的小货摊，花元气买药汤、食物或新蛊', d: '小货摊：花元气买回血、食物或新蛊' },
  bless:  { n: '灵台', ch: '福', k: '选一个祝福', tip: '灵台：三个祝福选一个，只在这一趟有效', d: '三个祝福选一个，只在这一趟有效，出秘境清零' },
  boss:   { n: '首领', ch: '劫', k: '渡劫', tip: '首领：打赢就是渡劫成功，必掉一样东西（二选一），带着全部战利品回洞府', d: '秘境最深处的首领。打赢就是渡劫成功：必掉一样东西（二选一），带着全部战利品回洞府；本境界的秘境第一次渡过，境界加一' },
};

// ───────────── 地图：三条路，每层三个房间。左路通 左/中，右路通 中/右，中路通 中 + 本层指定的一侧；最深处汇成首领 ─────────────
const ROW_TYPES = ['fight', 'event', 'elite', 'camp', 'market', 'bless'];
const roomCost = (d, j = 0) => Math.round((TRIP_CFG.cost.base + TRIP_CFG.cost.per * d) * (1 + TRIP_CFG.cost.jit * j));
function tripMap(seed, realm = 0) {
  const C = TRIP_CFG, rng = makeRng('trip:' + seed + ':' + (realm | 0)), rows = [], D = C.depth;
  for (let d = 0; d < D - 1; d++) {
    const mid = rng() < 0.5 ? 0 : 2, cnt = {}, types = [null, null, null];
    if (d === 0) { types[0] = types[2] = 'fight'; types[1] = 'event'; }        // 第一层平缓：两场小仗、一个奇遇
    if (d === D - 2) types[1] = 'camp';                                      // 首领前一层，中路必有篝火（中路从哪条路都走得到）
    types.forEach(t => { if (t) cnt[t] = (cnt[t] || 0) + 1; });
    for (let l = 0; l < 3; l++) {
      if (types[l]) continue;
      const pool = ROW_TYPES.filter(t => d >= (C.from[t] || 0) && (cnt[t] || 0) < (C.rowMax[t] || 9));
      let x = rng() * pool.reduce((a, t) => a + C.w[t], 0), t = pool[0];
      for (const k of pool) { x -= C.w[k]; if (x < 0) { t = k; break; } }
      types[l] = t; cnt[t] = (cnt[t] || 0) + 1;
    }
    rows.push({ d, mid, rooms: types.map((type, lane) => ({ type, lane, d, cost: roomCost(d, rng() * 2 - 1) })) });
  }
  rows.push({ d: D - 1, mid: 1, boss: true, rooms: [{ type: 'boss', lane: 1, d: D - 1, cost: roomCost(D - 1) }] });
  return rows;
}
// 从第 d 层的 lane 出发，下一层能去哪几条路
function nextLanes(map, d, lane) {
  const nx = map[d + 1]; if (!nx) return [];
  if (nx.boss) return [1];
  if (lane === 0) return [0, 1]; if (lane === 2) return [1, 2];
  return [1, map[d].mid].sort();
}

// ───────────── 秘境列表：每个境界两三个，同境界额度相同，主道和首领不同。渡过本境界任一秘境的首领 = 渡劫，境界加一 ─────────────
// 额度 = 上阵蛊转数总和的上限；境界 r 能驱使 r+1 转及以下的蛊（敌人也一样）。名字取原著里的大地名，描述是自己写的
const rankCapOf = q => Math.min(RANK.max, q < 7 ? 1 : q < 10 ? 2 : q < 14 ? 3 : q < 18 ? 4 : 5);   // 额度对应的最高转数（斗幽灵 4/9/15/22 档也按这个）
const LAND_DEF = [   // [id, 名, 境界, 主道, 一句介绍]。首领见下面的 BOSS_DEF
  ['qingmao', '青茅山', 0, 'li', '山寨外的竹林里野蛊成群，蛊师入门的第一道坎。'],
  ['suishi', '碎石滩', 0, 'jin', '河滩上全是碎石，甲壳硬的野蛊躲在石缝里，不好啃。'],
  ['shangjia', '商家城外', 1, 'zhi', '城外的商路上常有劫道的蛊师，阵法摆得比力气重要。'],
  ['zhangze', '南疆瘴泽', 1, 'xue', '泥沼里瘴气终年不散，这里的蛊靠吸血熬人。'],
  ['caohai', '北原草海', 2, 'nu', '草比人高，牧蛊的部族一放就是一群，以多打少。'],
  ['liusha', '西漠流沙', 2, 'jin', '风一起沙就动，披甲的蛊埋在沙下等人踩上来。'],
  ['wangting', '王庭福地', 3, 'li', '北原诸部争了几百年的福地，守在这里的都是硬骨头。'],
  ['jiaodao', '东海礁岛', 3, 'xue', '潮水退了才露出来的礁岛，礁缝里的蛊受了伤反而更凶。'],
  ['maigu', '埋骨荒原', 3, 'hun', '大战之后没人收的战场，倒下的蛊在这里不肯散。'],
  ['langya', '琅琊福地', 4, 'nu', '云上的福地，满山的毛民听一个声音调遣。'],
  ['yitian', '义天山', 4, 'hun', '正魔两道在山上打了一场大仗，山里至今魂火不灭。'],
  ['baohuang', '宝黄天', 5, 'jin', '天下蛊师做买卖的地方，守库的蛊一身金甲。'],
  ['tianting', '天庭', 5, 'zhi', '中洲之上的天庭，一步一阵，算无遗策。'],
];
const LANDS = LAND_DEF.map(([id, n, realm, dao, d]) => ({ id, n, realm, quota: QUOTA[realm], cap: rankCapOf(QUOTA[realm]), dao, d }));
const LAND = Object.fromEntries(LANDS.map(l => [l.id, l]));
const landsOf = realm => LANDS.filter(l => l.realm === realm);
const landOf = x => (x && typeof x === 'object' ? x : LAND[x] || landsOf(Math.max(0, Math.min(5, x | 0)))[0] || LANDS[0]);
const teamQuota = team => team.reduce((a, g) => a + (g.rank || baseRank(g.sp)), 0);   // 这队占多少额度

// ───────────── 敌阵：只按额度生成（纯函数，斗幽灵和战帖分场也用）─────────────
// foeByBudget(rng, budget, { dao, kind: 'room'|'elite'|'boss'|'ghost', depth, maxRank, frac }) → [{ uid, sp, rank, atk, hp, pos, boss? }]
// 用掉几成额度见 TRIP_CFG.foe（frac 可直接指定）；转数不超过额度对应的上限；攻血 = 转数表原值。首领那一队里转数最高的一只标 boss（领头）
const normalPool = r => poolFor(r).filter(id => SP[id] && !SP[id].immortal);
function foeFrac(kind, depth = 0) {
  const F = TRIP_CFG.foe;
  return kind === 'boss' ? F.boss : kind === 'elite' ? F.elite : kind === 'ghost' ? F.ghost : Math.min(1, F.frac[0] + F.frac[1] * Math.max(0, depth - F.ramp));
}
function foeByBudget(rng, budget, o = {}) {
  const F = TRIP_CFG.foe, kind = o.kind || 'room', cap = Math.max(1, Math.min(RANK.max, o.maxRank || rankCapOf(budget)));
  let left = Math.max(1, Math.round(budget * (o.frac != null ? o.frac : foeFrac(kind, o.depth || 0)))); const ranks = [];
  while (left > 0 && ranks.length < F.maxN) {   // 多用接近上限的转数，偶尔低一两转，最后的零头用小转数补满
    const hi = Math.min(cap, left), r = hi > 1 && rng() < 0.3 ? hi - 1 - (hi > 2 && rng() < 0.3 ? 1 : 0) : hi;
    ranks.push(r); left -= r;
  }
  const all = NORMAL_SPECIES.map(s => s.id);
  const team = ranks.sort((a, b) => b - a).map((r, i) => {
    const ok = all.filter(id => baseRank(id) <= r), main = o.dao ? ok.filter(id => daoOf(id) === o.dao) : [];
    const sp = rng.pick(main.length && (rng() < F.daoP || (kind === 'boss' && i === 0)) ? main : ok.length ? ok : all), st = statFor(sp, r);
    return { uid: 'f' + i, sp, rank: r, atk: st.atk, hp: st.hp, food: null, xing: null };
  });
  if (kind === 'boss' && team[0]) team[0].boss = 1;
  return autoPlace(arrangeTeam(team));
}
// 首领：每个秘境两三个（首领机制池），每趟随机遇到其中一个，进秘境前就写明。每个首领一伙固定阵容（同一秘境同一编号永远同一伙），
// 领头尽量是主道的蛊，身上带一条专克某种打法的机制（trip-mods.js 的 MECHS）。用掉的额度 = 额度 × boss × bk；bk、bv 每个首领单独调（TUNE=1 node tools/trip-test.mjs）
//   [机制, bk, bv]：bv = 阵容第几版（换一版随机阵容），让配队一般打这个首领（带着机制）输 40% 左右
const BOSS_DEF = {   // 调参工具会直接改这里的 bk、bv
  qingmao: [['fanzhen', 0.7, 1], ['yinxue', 0.7, 1]],
  suishi: [['tiebi', 1, 1], ['xianfa', 1, 0]],
  shangjia: [['fengli', 1, 2], ['hengsao', 0.9, 0]],
  zhangze: [['yinxue', 0.9, 2], ['baidu', 1.1, 1]],
  caohai: [['hengsao', 0.6, 2], ['kuangbao', 0.6, 2], ['duanhun', 0.6, 2]],
  liusha: [['tiebi', 0.9, 0], ['fanzhen', 0.9, 0], ['xianfa', 1, 0]],
  wangting: [['kuangbao', 0.6, 2], ['zhanruo', 0.9, 3], ['fengli', 1.1, 1]],
  jiaodao: [['yinxue', 1.3, 2], ['baidu', 1.3, 3], ['fanzhen', 1.3, 1]],
  maigu: [['duanhun', 1.1, 0], ['zhanruo', 0.9, 0], ['tiebi', 0.8, 1]],
  langya: [['hengsao', 0.8, 1], ['xianfa', 1.4, 1], ['yinxue', 1, 2]],
  yitian: [['duanhun', 1, 0], ['fengli', 1, 1], ['kuangbao', 1, 0]],
  baohuang: [['tiebi', 1, 0], ['fanzhen', 1.4, 3], ['baidu', 0.8, 1]],
  tianting: [['fengli', 0.9, 3], ['xianfa', 1.3, 0], ['zhanruo', 0.9, 0]],
};
const bossDef = (L, i = 0) => { const B = BOSS_DEF[L.id] || [['zhanruo']], b = B[((i | 0) % B.length + B.length) % B.length]; return { mech: b[0], bk: b[1] || 1, bv: b[2] || 0 }; };
const bossFrac = (land, i = 0) => TRIP_CFG.foe.boss * bossDef(landOf(land), i).bk;
function landBoss(land, i = 0, add = 0) {
  const L = landOf(land), b = bossDef(L, i);
  return foeByBudget(makeRng('boss:v5:' + L.id + ':' + (i | 0) + (b.bv ? ':' + b.bv : '')), L.quota, { dao: L.dao, kind: 'boss', maxRank: L.cap, frac: bossFrac(L, i) + add });
}
const bossName = (team, mech) => { const lead = team.find(g => g.boss) || team[0]; return `${MECH[mech] ? MECH[mech].n : ''}·${lead && SP[lead.sp] ? SP[lead.sp].n : '首领'}`; };
const slim = team => team.map(g => ({ sp: g.sp, rank: g.rank, pos: g.pos ? { ...g.pos } : null, boss: g.boss || 0 }));
LANDS.forEach(l => {
  l.bosses = (BOSS_DEF[l.id] || [['zhanruo']]).map((b, i) => { const team = landBoss(l, i); return { i, mech: b[0], n: bossName(team, b[0]), team: slim(team) }; });
  l.boss = l.bosses[0].team;   // 旧接口：第一个首领的阵容
});
// 房间里的敌阵（同一种子、同一层、同一条路永远是同一伙）。o = { boss: 第几个首领, add: 劫数多加的额度比例 }
function foeTeam(seed, land, d, lane, type, o = {}) {
  const L = landOf(land); if (type === 'boss') return landBoss(L, o.boss || 0, o.add || 0);
  const kind = type === 'elite' ? 'elite' : 'room';
  return foeByBudget(makeRng(`trip:${seed}:foe:${d}:${lane}`), L.quota, { dao: L.dao, kind, depth: d, maxRank: L.cap, frac: o.add ? foeFrac(kind, d) + o.add : undefined });
}
const foeFor = (seed, quota, opts = {}) => foeByBudget(makeRng('foe:' + seed), quota, opts);   // 给洞府（斗幽灵、战帖分场）

// ───────────── 战利品：新蛊（物种 + 转数，回洞府时变成蛊）和食物 id ─────────────
// 掉落只出道途已解锁的：出征时洞府给的 foods（食物 id）、sp（物种 id）名单，没给就是全部
const foodPoolOf = t => (t && t.foodPool && t.foodPool.length ? t.foodPool : FOODS.filter(f => f.trip !== 'stone').map(f => f.id));
const foodName = id => (FOODS.find(f => f.id === id) || { n: id }).n;
function foodPick(rng, pool, d) {   // 越深越偏向贵的（稀有）
  const w = pool.map(id => Math.pow((FOODS.find(f => f.id === id) || { cost: 3 }).cost || 3, d / 4)), tot = w.reduce((a, b) => a + b, 0); let r = rng() * tot;
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r < 0) return pool[i]; } return pool[pool.length - 1];
}
function lootGu(rng, realm, d, bump = 0, spPool = null) {
  const L = TRIP_CFG.loot, cap = Math.min(RANK.max, (realm | 0) + 1), rare = d >= L.rare && rng() < 0.5, ok = spPool && spPool.length ? new Set(spPool) : null;
  const all = normalPool(Math.min(5, (realm | 0) + (rare ? 1 : 0))).filter(id => baseRank(id) <= cap), pool = ok ? all.filter(id => ok.has(id)) : all;
  const sp = rng.pick(pool.length ? pool : all.length ? all : normalPool(0));
  const r = Math.min(cap, Math.max(baseRank(sp), baseRank(sp) + bump + (rng() < L.up[0] + L.up[1] * d ? 1 : 0)));   // 不超过这个境界能驱使的转数
  return { sp, rank: r };
}
function roomLoot(seed, realm, d, lane, type, foodPool, spPool = null, extraFood = 0) {
  const L = TRIP_CFG.loot[type], out = { foods: [], gu: [] }; if (!L) return out;
  const rng = makeRng(`trip:${seed}:loot:${d}:${lane}`), pool = foodPoolOf({ foodPool });
  const roll = ([p, per]) => { const q = p + per * d; let n = Math.floor(q); if (rng() < q - n) n++; return n; };
  for (let i = roll(L.food) + extraFood; i > 0; i--) out.foods.push(foodPick(rng, pool, d));
  for (let i = roll(L.gu); i > 0; i--) out.gu.push(lootGu(rng, realm, d, type === 'boss' ? 1 : 0, spPool));
  return out;
}
function addLoot(bag, l) { (l.foods || []).forEach(f => bag.foods.push(f)); (l.gu || []).forEach(g => bag.gu.push(g)); return bag; }
const lootEmpty = l => !l || (!(l.foods || []).length && !(l.gu || []).length);
const guName = g => RANK.names[g.rank] + (SP[g.sp] ? SP[g.sp].n : g.sp);
function lootText(l) {
  const a = []; if ((l.gu || []).length) a.push('新蛊：' + l.gu.map(guName).join('、'));
  if ((l.foods || []).length) a.push('食物：' + l.foods.map(foodName).join('、'));
  return a.join('；');
}

// ───────────── 奇遇：两个选项，两个结果都写明。fx 见 applyFx ─────────────
// heal/hurt = 按满血的比例；Front = 只作用在最前那只活着的蛊；healLow = 只回伤得最重的那只；hurtAll = 全队掉（不会掉到 0）
// shortcut / slow = 下一个房间路程倍数（0.5 = 减半，1.5 = 多走一半）；pay = 花几份元气（×单位×境界系数，先花攒着的，不够就选不了）
// bump = 新蛊更稀有一档。越深的奇遇给的食物越偏贵（foodPick），新蛊转数随层数涨（lootGu）
const EVENTS = [
  { id: 'yishui', n: '古修遗蜕', s: '崖下坐着一具古修士的遗蜕，衣袍一碰就碎，掌心还托着一团温热的灵光。',
    o: [{ t: '吸了这团灵光', fx: { heal: 0.3 } }, { t: '翻他的遗物', fx: { food: 1 } }] },
  { id: 'yegu', n: '迷路的野蛊', s: '草丛里窸窸窣窣，一只野蛊跟了你们半天，像是想找个主人。',
    o: [{ t: '收下它', fx: { gu: 1 } }, { t: '分它点灵气，打发走', fx: { heal: 0.1 } }] },
  { id: 'lingquan', n: '山泉灵眼', s: '石缝里涌出一眼灵泉，水是凉的，带着淡淡的灵气。',
    o: [{ t: '全队泡一泡', fx: { heal: 0.4 } }, { t: '装一壶带走', fx: { food: 1 } }] },
  { id: 'duanya', n: '断崖窄道', s: '前面是断崖，崖壁上有一条窄道，走过去能省下大半段路。',
    o: [{ t: '走窄道', fx: { shortcut: 0.5, hurtFront: 0.4 } }, { t: '绕远路', fx: {} }] },
  { id: 'guzhen', n: '古阵残影', s: '地上刻着残缺的阵纹，阵里有一道虚影，在等人进来过招。',
    o: [{ t: '让最前的蛊入阵过招', fx: { xing: 'ruiqi', hurtFront: 0.2 } }, { t: '不进阵', fx: {} }] },
  { id: 'guchao', n: '树洞蛊巢', s: '老树洞里结着一个野蛊巢，里面有动静，守巢的那只脾气不好。',
    o: [{ t: '掏巢', fx: { gu: 1, bump: 1, hurtFront: 0.35 } }, { t: '不惊动它', fx: {} }] },
  { id: 'duzhang', n: '毒瘴林', s: '前面一片林子笼着灰绿的瘴气。穿过去最近，绕开要多走不少路。',
    o: [{ t: '屏住气穿过去', fx: { hurtAll: 0.15, shortcut: 0.5 } }, { t: '绕开走', fx: { slow: 1.5 } }] },
  { id: 'shibei', n: '无字石碑', s: '路边立着一块无字石碑，盯久了，碑面像有一座山压下来。',
    o: [{ t: '让最前的蛊对着石碑静坐', fx: { xing: 'zhenyue', slow: 1.3 } }, { t: '不看它，接着走', fx: {} }] },
  { id: 'xuechi', n: '赤水潭', s: '一潭暗红的水冒着热气。泡进去伤口发烫，出来却像换了一身筋骨。',
    o: [{ t: '让伤得最重的蛊泡进去', fx: { healLow: 0.6 } }, { t: '让最前的蛊泡到发烫', fx: { xing: 'yuxue', hurtFront: 0.25 } }] },
  { id: 'luonan', n: '落难修士', s: '一个修士靠着石头喘气，元气耗尽了，身边一只蛊守着他不肯走。',
    o: [{ t: '分他一些元气', fx: { pay: 30, gu: 1, bump: 1 } }, { t: '问他前面的路', fx: { shortcut: 0.7 } }] },
];
const EVENT = Object.fromEntries(EVENTS.map(e => [e.id, e]));
function pickEvent(seed, d, lane, seen = []) {
  const rng = makeRng(`trip:${seed}:ev:${d}:${lane}`), pool = EVENTS.filter(e => !seen.includes(e.id));
  return rng.pick(pool.length ? pool : EVENTS).id;
}
// 一个选项写成人话：结果是什么、放到哪
const evPay = (t, fx, unit) => fx && fx.pay ? Math.round(fx.pay * unit * (1 + (t ? t.realm : 0) * TRIP_CFG.pay.realm)) : 0;
function fxText(fx, pay = 0) {
  const out = [], pc = p => Math.round(p * 100) + '%';
  if (fx.pay) out.push(`花 ${fmtTok(pay || fx.pay)} 元气`);
  if (fx.heal) out.push(`全队回满血的 ${pc(fx.heal)}`);
  if (fx.food) out.push(`食物 ×${fx.food}（进战利品袋）`);
  if (fx.healLow) out.push(`伤得最重的那只回满血的 ${pc(fx.healLow)}`);
  if (fx.gu) out.push(`新蛊 ×${fx.gu}${fx.bump ? '，转数高一档' : ''}（进战利品袋，回洞府放进蛊囊）`);
  if (fx.xing) out.push(`最前的蛊得蛊性「${XING[fx.xing].n}」：${XING[fx.xing].d}`);
  if (fx.shortcut) out.push(`下一个房间少走 ${pc(1 - fx.shortcut)} 的路`);
  if (fx.slow) out.push(`下一个房间多走 ${pc(fx.slow - 1)} 的路`);
  if (fx.hurtFront) out.push(`最前的蛊掉满血的 ${pc(fx.hurtFront)}（不会掉到 0）`);
  if (fx.hurtAll) out.push(`全队掉满血的 ${pc(fx.hurtAll)}（不会掉到 0）`);
  return out.length ? out.join('，') : '什么也不发生';
}

// ───────────── 出征状态（S.trip）─────────────
// { v, seed, land, realm, quota, d, lane, pick, prog, order, hp, mx, dead, fallen, saved, loot, log, room, end, kills, seen, short, foodPool, pre }
//   saved = 这一趟倒下过又被救回的蛊（不重复）；dead / fallen = 永久死亡的（只有打输那一场才有）
//   d 当前第几层（0 起）；lane 上一层走的路（第一层前为 null）；pick 这一层选好的路；prog 这个房间已走的元气
//   room 走到后待处理的房间 { type, d, lane, foe?, ev?, wares?, done? }；end 结束结果；short 下一个房间路程倍数（断崖窄道）
// purse：放元气的对象（界面传 S，用 S.bank），选路时先从里面花；等待时进账的 token 也存回去
// opts = { trip: 出征食物 id（S.tripFood）, foods / sp: 道途已解锁的食物、物种 id（掉落只出这些，不给 = 全部）, kalpa: 第几劫（0 = 普通） }
// 天象和首领由种子 + 秘境定（tripPlan），进秘境前就能算出来给玩家看（tripPreview）
function tripStart(seed, land, team, opts = {}) {   // land = 秘境 id（也认境界数字，取那个境界的第一个秘境）
  const L = landOf(land), fielded = team.slice(0, SLOTS), plan = tripPlan(seed, L), tf = (opts.trip || []).map(id => FOOD[id]).filter(f => f && f.kind === 'trip');
  const t = { v: 2, seed: String(seed), land: L.id, realm: L.realm, quota: L.quota, d: 0, lane: null, pick: null, prog: 0, order: fielded.map(g => g.uid), hp: {}, mx: {}, dead: [], fallen: [],
    loot: { foods: [], gu: [] }, log: [], room: null, end: null, kills: {}, saved: [], seen: [], rooms: 0, short: 1, foodPool: (opts.foods || []).slice(), spPool: opts.sp && opts.sp.length ? opts.sp.slice() : null,
    kalpa: Math.max(0, Math.min(JIE_MAX, opts.kalpa | 0)), sky: plan.sky, boss: plan.boss, bless: [], offer: null, reward: null, got: null,
    map: tripMap(seed, L.realm), path: [],                                                                   // 整张地图进秘境时就生成好存下；path = 每层走的哪条路
    pre: Math.min(1, tf.reduce((a, f) => a + (f.trip === 'heal' ? (f.pct || 0) / 100 : 0), 0)),                 // 回春茶、续命汤：每场开打前全队回的比例
    road: tf.reduce((a, f) => a * (f.trip === 'road' ? 1 - (f.pct || 0) / 100 : 1), 1),                       // 寻路图：路程乘几
    revive: Math.max(0, ...tf.map(f => (f.trip === 'revive' ? (f.pct || 0) / 100 : 0))), revived: null,       // 定魂香：第一只倒下的蛊下一场以几成血站起来
    eff: tf.filter(f => f.trip === 'eff' && f.eff).map(f => f.id) };                                         // 惊雷符等：每场挂给出场蛊
  fielded.forEach(g => { t.hp[g.uid] = g.hp; t.mx[g.uid] = g.hp; t.kills[g.uid] = 0; });
  tlog(t, `进入${L.n}${t.kalpa ? '（' + JIE_NAMES[t.kalpa] + '）' : ''}：${fielded.map(g => SP[g.sp] ? SP[g.sp].n : g.sp).join('、')}。天象「${SKY[t.sky].n}」。共 ${TRIP_CFG.depth} 层，最深处是首领。`);
  return t;
}
const tlog = (t, s) => { t.log.push(s); if (t.log.length > 60) t.log.splice(0, t.log.length - 60); };
const MAPC = new Map();   // 旧存档没存地图时由种子现算
function tripMapOf(t) { if (t.map) return t.map; const k = t.seed + '|' + t.realm; if (!MAPC.has(k)) { if (MAPC.size > 8) MAPC.clear(); MAPC.set(k, tripMap(t.seed, t.realm)); } return MAPC.get(k); }
const tripAlive = t => t.order.filter(u => !t.dead.includes(u));
// 这一层能选哪几条路
function tripReach(t) {
  const map = tripMapOf(t); if (t.end || t.room || t.d >= map.length) return [];
  if (map[t.d].boss) return [1];
  return t.d === 0 || t.lane == null ? [0, 1, 2] : nextLanes(map, t.d - 1, t.lane);
}
const roomAt = (t, d, lane) => { const row = tripMapOf(t)[d]; return row ? row.rooms.find(r => r.lane === lane) || null : null; };
const curRoom = t => t.pick != null ? roomAt(t, t.d, t.pick) : null;
// 路程倍数：出征食物（寻路图）× 祝福（风行）× 劫数（路程 +20%）
const roadOf = t => (t.road || 1) * blessRules(t.bless).road * jieRules(t.kalpa).road;
const needTok = (t, unit) => { const r = curRoom(t); return r ? Math.round(r.cost * unit * (t.short || 1) * roadOf(t)) : 0; };
const campOf = t => { const b = blessRules(t.bless).camp, j = jieRules(t.kalpa).camp; return b != null ? b : j != null ? j : TRIP_CFG.camp; };   // 篝火回几成：祝福「篝火旺」优先，其次劫数
// 选路：先花攒着的元气；返回是否当场就走到了
function tripPick(t, lane, unit, purse) {
  if (!tripReach(t).includes(lane) || t.pick != null) return false;
  t.pick = lane; t.prog = 0; return tripPour(t, unit, purse);
}
function tripPour(t, unit, purse) {
  if (!curRoom(t) || t.room) return false;
  const take = Math.max(0, Math.min(needTok(t, unit) - t.prog, purse ? purse.bank || 0 : 0));
  if (take) purse.bank -= take; t.prog += take;
  if (t.prog >= needTok(t, unit) - 0.5) { arrive(t); return true; }
  return false;
}
// 实时 token：在走路就推进（多出来的存回 purse），否则全部存回 purse。返回是否刚走到一个房间
function tripFeed(t, tok, unit, purse) {
  if (!(tok > 0)) return false;
  const add = n => { if (purse && n > 0) purse.bank = (purse.bank || 0) + n; };
  if (!t || t.end || !curRoom(t) || t.room) { add(tok); return false; }
  const take = Math.min(needTok(t, unit) - t.prog, tok); t.prog += take; add(tok - take);
  if (t.prog >= needTok(t, unit) - 0.5) { arrive(t); return true; }
  return false;
}
function arrive(t) {
  const r = curRoom(t), room = { type: r.type, d: t.d, lane: r.lane };
  if (r.type === 'fight' || r.type === 'elite' || r.type === 'boss') room.foe = 1;   // 阵容用 roomFoe(t) 现算（同种子永远相同），不进存档
  if (r.type === 'event') { room.ev = pickEvent(t.seed, t.d, r.lane, t.seen); t.seen.push(room.ev); }
  if (r.type === 'market') room.wares = marketWares(t, r);
  if (r.type === 'bless') room.choices = blessChoices(t, `${t.d}:${r.lane}`);
  t.room = room; t.rooms++; t.short = 1; t.prog = 0;
  tlog(t, `第 ${t.d + 1} 层 · ${ROOMS[r.type].n}`);
}
// 房间里的敌阵，带上这一趟的天象、劫数和首领机制（g.fx，battle-spec 第 11 节）
function roomFoe(t) {
  if (!t.room || !t.room.foe) return null;
  const type = t.room.type, jr = jieRules(t.kalpa), add = type === 'boss' ? jr.boss : type === 'elite' ? jr.elite : jr.room;
  return foeTeam(t.seed, t.land || t.realm, t.room.d, t.room.lane, type, { boss: t.boss || 0, add }).map(g => ({ ...g, fx: foeFx(t, g, type === 'boss') }));
}
const tripLand = t => landOf(t.land || t.realm);
function leave(t) {   // 房间处理完：进下一层（首领打完就结束）
  (t.path || (t.path = []))[t.d] = t.pick; t.lane = t.pick; t.pick = null; t.prog = 0; t.room = null; t.d++;
  if (t.d >= tripMapOf(t).length) tripEnd(t, 'clear');
}
// 出战阵容：出征时的站位，去掉倒下的；每只带 hpNow（上一场剩的血）
function fieldTeam(t, team) {   // 每只带上天象、祝福、出征食物的效果（g.fx）
  const by = Object.fromEntries(team.map(g => [g.uid, g]));
  return tripAlive(t).filter(u => by[u]).map(u => ({ ...by[u], hpNow: t.hp[u], fx: myFx(t, by[u]) }));
}
// 引擎还没给 hpEnd 时：从最后一帧快照读我方剩血（我方出场蛊按顺序登记为 a0, a1 …）
function hpFromLog(res, n) {
  const last = res.log && res.log[res.log.length - 1], s = last && last.s ? last.s[0] : [], hp = new Array(n).fill(0);
  s.forEach(([uid, , h]) => { const i = /^a(\d+)$/.test(uid) ? +uid.slice(1) : -1; if (i >= 0 && i < n) hp[i] = Math.max(0, h | 0); });
  return hp;
}
// 战斗结果落地（规则：赢了救回，输了全死）：res = battle() 的返回（或 api.playBattle 给的 res），fielded = 开打时的 fieldTeam(t, team)。
//   赢了：这一场倒下的全部救回，剩 1 血继续走；输了：场上的蛊全部永久死亡，出征结束（= 全灭，战利品全丢）；
//   平手（打满轮数）：双方退开，倒下的也救回，这个房间不给战利品；首领平手就带着战利品退回洞府。
//   定魂香：这一趟第一只倒下的蛊不是剩 1 血，而是以 revive 比例的血站起来（只一次）。
//   打赢精英：给三个祝福选一个（t.offer）；打赢首领：渡劫成功，先在两样必掉的东西里选一样（t.reward → tripReward），再回洞府。
// 返回 { win, saved:[uid], dead:[uid], loot, offers:[{uid, xing, old, auto}], revived?, bless?, reward?, wiped?, cleared?, fled? }
function tripFight(t, team, fielded, res) {
  const room = t.room; if (!room || !room.foe || room.done) return null;
  const win = res.winner === 'A', lost = res.winner === 'B', saved = [], offers = [], by = Object.fromEntries(team.map(g => [g.uid, g]));
  const hpEnd = res.hpEnd || res.hpA || hpFromLog(res, fielded.length), stat = res.statA || [];
  const name = id => (SP[(by[id] || {}).sp] || {}).n || '';
  room.done = true;
  if (lost) {
    fielded.forEach((g, i) => { const st = stat[i]; if (st) t.kills[g.uid] = (t.kills[g.uid] || 0) + (st.kills | 0); });
    const dead = fielded.map(g => g.uid);
    dead.forEach(u => { if (t.dead.includes(u)) return; t.dead.push(u); t.hp[u] = 0; const g = by[u] || fielded.find(x => x.uid === u) || {};
      t.fallen.push({ uid: u, sp: g.sp, rank: g.rank, d: room.d, type: room.type, kills: t.kills[u] || 0, xing: g.xing || null }); });
    tlog(t, `败。场上的蛊全部永久死亡：${dead.map(name).join('、')}`);
    tripEnd(t, 'wipe'); return { win: false, saved, dead, loot: null, offers, wiped: true };
  }
  fielded.forEach((g, i) => {
    const hp = Math.max(0, Math.round(hpEnd[i] || 0)), st = stat[i] || null, real = by[g.uid];
    if (st) t.kills[g.uid] = (t.kills[g.uid] || 0) + (st.kills | 0);
    if (hp <= 0) {   // 倒下了但这一场没输：救回，剩 1 血（定魂香：第一只以几成血站起来）
      saved.push(g.uid); if (!t.saved.includes(g.uid)) t.saved.push(g.uid); t.hp[g.uid] = Math.max(1, Math.round(t.mx[g.uid] * blessRules(t.bless).rescue));   // 祝福「抢救」：救回剩三成
      if (t.revive && !t.revived) { t.revived = g.uid; t.hp[g.uid] = Math.max(1, Math.round(t.mx[g.uid] * t.revive)); }
      return;
    }
    t.hp[g.uid] = Math.min(t.mx[g.uid], hp);
    const k = real ? xingEarned(st, win, real.xing) : null;
    if (k) { if (!real.xing) { real.xing = k; offers.push({ uid: g.uid, xing: k, old: null, auto: true }); } else offers.push({ uid: g.uid, xing: k, old: real.xing }); }
  });
  let loot = null; const revived = saved.includes(t.revived) && t.hp[t.revived] > 1 ? t.revived : null;
  if (win) { loot = roomLoot(t.seed, t.realm, room.d, room.lane, room.type, t.foodPool, t.spPool, blessRules(t.bless).food); addLoot(t.loot, loot); }
  (t.bless || []).forEach(x => { if (x.left > 0) x.left--; });   // 只管几场的祝福（庇佑）少一场
  tlog(t, `${win ? '胜' : '僵持不下，各自退开'}${saved.length ? '。救回：' + saved.map(name).join('、') + '（剩 1 血）' : ''}${revived ? `。定魂香：${name(revived)} 以 ${Math.round(t.revive * 100)}% 血站起来` : ''}${loot && !lootEmpty(loot) ? '。' + lootText(loot) : ''}`);
  offers.filter(o => o.auto).forEach(o => tlog(t, `${name(o.uid)} 得蛊性「${XING[o.xing].n}」`));
  const out = { win, saved, dead: [], loot, offers, revived };
  if (room.type === 'boss') {
    if (win) { t.reward = bossReward(t.seed, t.land, { sp: t.spPool, foods: t.foodPool }); tlog(t, '渡劫成功。首领必掉一样东西，二选一'); return { ...out, cleared: true, reward: t.reward }; }
    tripEnd(t, 'retreat'); return { ...out, fled: true };
  }
  if (win && room.type === 'elite') { t.offer = { from: 'elite', ids: blessChoices(t, `e${room.d}:${room.lane}`) }; out.bless = t.offer.ids; }
  leave(t);
  return out;
}
// 出征食物：每场开打前全队回 t.pre 比例的血。返回回了多少
const preOf = t => Math.min(1, (t.pre || 0) + blessRules(t.bless).pre);   // 出征食物（回春茶）+ 祝福「庇佑」
function tripPreFight(t) {
  const p = t ? preOf(t) : 0; if (!p) return 0; let sum = 0;
  tripAlive(t).forEach(u => { const v = Math.min(t.mx[u] - t.hp[u], Math.max(1, Math.round(t.mx[u] * p))); t.hp[u] += v; sum += v; });
  return sum;
}

// ───────────── 祝福：灵台房间、打赢精英后三选一，只在这一趟有效 ─────────────
// 三个不重复、手里还没有的；同一个地方永远是同样三个
function blessChoices(t, key) {
  const have = new Set((t.bless || []).map(x => x.id)), pool = BLESSES.filter(b => !have.has(b.id)), rng = makeRng(`trip:${t.seed}:bless:${key}`), out = [];
  while (out.length < TRIP_CFG.bless && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0].id);
  return out;
}
function addBless(t, id) { const b = BLESS[id]; if (!b) return false; t.bless = t.bless || []; t.bless.push({ id, left: b.fights || 0 }); tlog(t, `得祝福「${b.n}」：${b.d}（${blessLast(b)}）`); return true; }
// 灵台：选第 i 个
function tripBless(t, i) {
  const room = t.room; if (!room || room.type !== 'bless' || room.done) return null;
  const id = room.choices[i]; if (!id || !addBless(t, id)) return null;
  room.done = true; leave(t); return { id };
}
// 打赢精英后的三选一：选第 i 个（i < 0 = 不要）
function tripOffer(t, i) {
  const o = t.offer; if (!o) return null; t.offer = null;
  const id = o.ids[i]; if (id && addBless(t, id)) return { id }; return { id: null };
}
// 这一趟手里的祝福 [{ id, n, d, last, left }]（界面列出来；用完的不列）
const blessList = t => (t.bless || []).map(x => ({ ...x, b: BLESS[x.id] })).filter(x => x.b && (!x.b.fights || x.left > 0)).map(x => ({ id: x.id, n: x.b.n, d: x.b.d, last: x.b.fights ? `还剩 ${x.left} 场` : '这一趟有效', left: x.left }));

// ───────────── 战斗挂件 g.fx：天象（双方）、祝福和出征食物（我方）、劫数和首领机制（敌方）─────────────
const skyFx = (t, g, k) => { const sk = SKY[t.sky], e = sk ? skyEff(sk, daoOf(g.sp), k) : []; return e.length ? [{ id: 'sky_' + sk.id, n: sk.n, kind: 'sky', eff: e }] : []; };
function myFx(t, g) {
  const out = skyFx(t, g, jieRules(t.kalpa).sky);
  (t.bless || []).forEach(x => { const b = BLESS[x.id]; if (b && b.eff && (!b.fights || x.left > 0)) out.push({ id: 'bless_' + b.id, n: b.n, kind: 'bless', eff: b.eff }); });
  (t.eff || []).forEach(id => { const f = FOOD[id]; if (f && f.eff) out.push({ id: 'food_' + id, n: f.n, kind: 'food', eff: f.eff }); });
  return out;
}
// 这一趟首领带的机制（劫十再多带一条：这个秘境下一个首领的机制）
function bossMechs(t) {
  const L = landOf(t.land || t.realm), B = BOSS_DEF[L.id] || [['zhanruo']], i = (t.boss || 0) % B.length, ids = [B[i][0]];
  if (jieRules(t.kalpa).mech2) { const m2 = B.map(b => b[0]).find(m => m !== ids[0]) || MECHS.find(m => m.id !== ids[0]).id; ids.push(m2); }
  return ids.map(id => MECH[id]).filter(Boolean);
}
function foeFx(t, g, isBoss) {
  const jr = jieRules(t.kalpa), out = skyFx(t, g, jr.sky);
  if (jr.foe.length) out.push({ id: 'jie', n: JIE_NAMES[t.kalpa], kind: 'jie', eff: jr.foe });
  if (isBoss) bossMechs(t).forEach(m => { if (m.on === 'team' || g.boss) out.push({ id: 'boss_' + m.id, n: m.n, kind: 'boss', eff: m.eff }); });
  return out;
}

// ───────────── 渡劫成功的奖励：首领必掉，二选一（这个秘境主道的一只高转蛊，或一份稀有食物）─────────────
// 高转 = 这个境界能驱使的最高转数；稀有食物 = 价钱 4 档及以上（道途解锁过的）。同一趟永远是同样两样
function bossReward(seed, land, o = {}) {
  const L = landOf(land), rng = makeRng(`trip:${seed}:reward:${L.id}`), rank = driveCap(L.realm), ok = o.sp && o.sp.length ? new Set(o.sp) : null;
  const all = NORMAL_SPECIES.map(s => s.id).filter(id => daoOf(id) === L.dao && baseRank(id) <= rank), sps = ok && all.some(id => ok.has(id)) ? all.filter(id => ok.has(id)) : all;
  const w = sps.map(id => baseRank(id) * baseRank(id)), tot = w.reduce((a, b) => a + b, 0); let x = rng() * tot, sp = sps[0];   // 原本就是高转的物种更常出
  for (let i = 0; i < sps.length; i++) { x -= w[i]; if (x < 0) { sp = sps[i]; break; } }
  const fp = foodPoolOf({ foodPool: o.foods }), rare = fp.filter(id => FOOD[id] && (FOOD[id].cost || 0) >= 4);
  return { gu: sp ? { sp, rank: Math.max(baseRank(sp), rank) } : null, food: rng.pick(rare.length ? rare : fp) };
}
// 选一样：k = 'gu' | 'food'。放进战利品袋，然后渡劫成功、回洞府
function tripReward(t, k) {
  const r = t.reward; if (!r || !(k === 'gu' ? r.gu : r.food)) return null;
  t.reward = null; t.got = k === 'gu' ? { k, gu: { ...r.gu } } : { k, food: r.food };
  if (k === 'gu') t.loot.gu.push({ ...r.gu }); else t.loot.foods.push(r.food);
  tlog(t, `首领掉落：${k === 'gu' ? guName(r.gu) : foodName(r.food)}`);
  leave(t); return t.got;
}
// 给选秘境列表的「渡劫成功可得」：{ pick: [两样二选一的说明], first: [第一次渡过才有的], lines: [全部，一行一条] }
//   o = { realm: 玩家当前境界, best: 这个秘境通关过的最高劫（没通关过 = -1 或不给）, kalpa: 这次打第几劫 }
function landReward(land, o = {}) {
  const L = landOf(land), rank = driveCap(L.realm), dao = DAO[L.dao] ? DAO[L.dao].n : L.dao, best = o.best == null ? -1 : o.best, k = o.kalpa | 0;
  const pick = [`${dao}的一只${RANK.names[rank]}蛊`, '一份稀有食物'], first = [];
  if (best < 0 && o.realm != null && L.realm === o.realm && o.realm < REALMS.length - 1) first.push(`境界晋一层：${REALMS[o.realm + 1]}`);
  if (best < 0) first.push('这个秘境开放劫一');
  else if (k > best && k < JIE_MAX) first.push(`这个秘境开放${JIE_NAMES[k + 1]}`);
  return { pick, first, lines: [`首领必掉，二选一：${pick.join('，或')}`, ...first, '这一趟的战利品全部带回'] };
}

// ───────────── 进秘境前就能看的：天象、首领、劫数 ─────────────
// 同一个种子、同一个秘境永远是同一个天象和首领（洞府先用 tripPreview 给玩家看，出征时 tripStart 用同一个种子）
function tripPlan(seed, land) {
  const L = landOf(land), rng = makeRng(`trip:${seed}:plan:${L.id}`), n = (BOSS_DEF[L.id] || [1]).length;
  return { sky: rng.pick(SKIES).id, boss: Math.floor(rng() * n) };
}
function tripPreview(seed, land, kalpa = 0, o = {}) {
  const L = landOf(land), p = tripPlan(seed, L), t = { seed: String(seed), land: L.id, realm: L.realm, kalpa: Math.max(0, Math.min(JIE_MAX, kalpa | 0)), sky: p.sky, boss: p.boss };
  const B = L.bosses[p.boss], jr = jieRules(t.kalpa), team = jr.boss ? slim(landBoss(L, p.boss, jr.boss)) : B.team, sk = SKY[p.sky];
  return { land: L.id, n: L.n, sky: { id: sk.id, n: sk.n, d: sk.d + (jr.sky !== 1 ? `（劫数加重：数值 ×${jr.sky}）` : '') },
    boss: { i: p.boss, n: B.n, team, mechs: bossMechs(t).map(m => ({ id: m.id, n: m.n, k: m.k, d: m.d })) },
    kalpa: { n: t.kalpa, name: JIE_NAMES[t.kalpa] || '普通', rules: JIE.slice(0, t.kalpa).map(j => j.n) }, reward: landReward(L, { ...o, kalpa: t.kalpa }) };
}
// 一趟里的天象、首领机制、劫数（界面在顶上和开打前写明）
//   boss = { i, mech, n, team }（team 已算上劫数多用的额度）
function tripMods(t) {
  const L = landOf(t.land || t.realm), B = (L.bosses || [])[t.boss || 0] || null, add = jieRules(t.kalpa).boss;
  return { sky: SKY[t.sky] || null, mechs: bossMechs(t), kalpa: t.kalpa || 0, kalpaName: JIE_NAMES[t.kalpa] || '', rules: JIE.slice(0, t.kalpa || 0).map(j => j.n),
    boss: B && { ...B, team: add ? slim(landBoss(L, t.boss || 0, add)) : B.team } };
}
function acceptXing(team, uid, key) { const g = team.find(x => x.uid === uid); if (g && XING[key]) { g.xing = key; return true; } return false; }
// 奇遇：选第 i 个选项。返回 { ok, lines, offer? }
function tripEvent(t, team, i, unit = 0, purse = null) {
  const room = t.room; if (!room || room.type !== 'event' || room.done) return { ok: false };
  const e = EVENT[room.ev], o = e && e.o[i]; if (!o) return { ok: false };
  const pay = evPay(t, o.fx, unit); if (pay) { if (!purse || (purse.bank || 0) < pay) return { ok: false, why: '元气不够' }; purse.bank -= pay; }
  const r = applyFx(t, team, o.fx, room);
  room.done = true; tlog(t, `${e.n}：${o.t}。${r.lines.join('，') || '无事发生'}`); leave(t); return r;
}
function applyFx(t, team, fx, room) {
  const lines = [], al = tripAlive(t), front = al[0], by = Object.fromEntries(team.map(g => [g.uid, g])), nm = u => (SP[(by[u] || {}).sp] || {}).n || '';
  const rng = makeRng(`trip:${t.seed}:fx:${room.d}:${room.lane}`); let offer = null;
  if (fx.heal) { al.forEach(u => { t.hp[u] = Math.min(t.mx[u], t.hp[u] + Math.max(1, Math.round(t.mx[u] * fx.heal))); }); lines.push(`全队回血 ${Math.round(fx.heal * 100)}%`); }
  for (let k = 0; k < (fx.food || 0); k++) { const id = foodPick(rng, foodPoolOf(t), room.d); t.loot.foods.push(id); lines.push(`食物：${foodName(id)}`); }
  if (fx.healLow) { const u = al.slice().sort((a, b) => t.hp[a] / t.mx[a] - t.hp[b] / t.mx[b])[0]; if (u) { const v = Math.min(t.mx[u] - t.hp[u], Math.round(t.mx[u] * fx.healLow)); t.hp[u] += v; lines.push(`${nm(u)} 回 ${v} 血`); } }
  for (let k = 0; k < (fx.gu || 0); k++) { const g = lootGu(rng, t.realm, room.d, fx.bump || 0, t.spPool); t.loot.gu.push(g); lines.push(`新蛊：${guName(g)}`); }
  if (fx.shortcut) { t.short = fx.shortcut; lines.push(`下一个房间少走 ${Math.round((1 - fx.shortcut) * 100)}% 的路`); }
  if (fx.slow) { t.short = fx.slow; lines.push(`下一个房间多走 ${Math.round((fx.slow - 1) * 100)}% 的路`); }
  if (fx.hurtAll) { al.forEach(u => { t.hp[u] -= Math.max(0, Math.min(t.hp[u] - 1, Math.max(1, Math.round(t.mx[u] * fx.hurtAll)))); }); lines.push(`全队掉 ${Math.round(fx.hurtAll * 100)}% 血`); }
  if (fx.hurtFront && front) { const v = Math.max(0, Math.min(t.hp[front] - 1, Math.round(t.mx[front] * fx.hurtFront))); t.hp[front] -= v; lines.push(`${nm(front)} 掉 ${v} 血`); }
  if (fx.xing && front && by[front]) {
    const g = by[front]; if (!g.xing) { g.xing = fx.xing; lines.push(`${nm(front)} 得蛊性「${XING[fx.xing].n}」`); }
    else if (g.xing !== fx.xing) offer = { uid: front, xing: fx.xing, old: g.xing };
  }
  return { ok: true, lines, offer };
}
function tripCamp(t) {
  const room = t.room; if (!room || room.type !== 'camp' || room.done) return null;
  let sum = 0; const p = campOf(t); tripAlive(t).forEach(u => { const v = Math.min(t.mx[u] - t.hp[u], Math.round(t.mx[u] * p)); t.hp[u] += v; sum += v; });
  room.done = true; tlog(t, `篝火边歇了一阵，全队共回 ${sum} 血`); leave(t); return { healed: sum };
}
// 坊市：三样货，花元气（先花攒着的）
function marketWares(t, r) {   // 价格：每高一境 +25%；劫数涨价、祝福「熟客」半价
  const M = TRIP_CFG.market, rng = makeRng(`trip:${t.seed}:mk:${t.d}:${r.lane}`), m = (1 + t.realm * M.realm) * jieRules(t.kalpa).price * blessRules(t.bless).price;
  return [{ k: 'heal', p: M.heal, price: Math.round(M.price.heal * m) }, { k: 'food', id: foodPick(rng, foodPoolOf(t), t.d), price: Math.round(M.price.food * m) }, { k: 'gu', g: lootGu(rng, t.realm, t.d, 0, t.spPool), price: Math.round(M.price.gu * m) }];
}
const wareTok = (w, unit) => w.price * unit;
function tripBuy(t, i, unit, purse) {
  const room = t.room; if (!room || room.type !== 'market' || room.done) return { ok: false };
  const w = room.wares[i], c = w ? wareTok(w, unit) : 0; if (!w || w.sold) return { ok: false }; if (!purse || (purse.bank || 0) < c) return { ok: false, why: '元气不够' };
  purse.bank -= c; w.sold = true;
  if (w.k === 'heal') tripAlive(t).forEach(u => { t.hp[u] = Math.min(t.mx[u], t.hp[u] + Math.round(t.mx[u] * w.p)); });
  if (w.k === 'food') t.loot.foods.push(w.id);
  if (w.k === 'gu') t.loot.gu.push(w.g);
  tlog(t, `坊市：${wareText(w)}`); return { ok: true };
}
const wareText = w => w.k === 'heal' ? `药汤：全队回满血的 ${Math.round(w.p * 100)}%` : w.k === 'food' ? `食物：${foodName(w.id)}（进战利品袋）` : `新蛊：${guName(w.g)}（进战利品袋）`;
function tripLeaveRoom(t) { const room = t.room; if (!room || room.type !== 'market') return false; room.done = true; tlog(t, '离开坊市'); leave(t); return true; }
// 结束：retreat 退出秘境（带回全部）/ wipe 渡劫失败（全队永久死亡，战利品全丢）/ clear 渡劫成功（带回全部，含首领掉落）
function tripEnd(t, why) {
  if (t.end) return t.end;
  const wiped = why === 'wipe', copy = l => ({ foods: l.foods.slice(), gu: l.gu.map(g => ({ ...g })) });
  t.end = { why, dead: t.dead.slice(), survivors: tripAlive(t), saved: (t.saved || []).filter(u => !t.dead.includes(u)), loot: wiped ? { foods: [], gu: [] } : copy(t.loot), lost: wiped ? copy(t.loot) : null, cleared: why === 'clear', wiped, depth: t.d, fallen: t.fallen.slice() };
  t.room = null; t.pick = null; t.prog = 0; t.offer = null; t.reward = null;
  tlog(t, wiped ? '渡劫失败，全队永久死亡。这一趟的战利品全部丢在了秘境里。' : why === 'clear' ? '渡劫成功，带着战利品回洞府。' : '退出秘境，带着战利品回洞府。');
  return t.end;
}
// 给 api.onTripEnd 的结果（hooks.js）：新蛊写成 { sp, rank }，洞府放进蛊囊；规则第二版没有元石
//   land 秘境 id、kalpa 这一趟第几劫（道途的「劫数」计数用）、reward 渡劫成功时选的那样（{ k: 'gu', gu } 或 { k: 'food', food }）
const tripResult = t => t.end ? { dead: t.end.dead, survivors: t.end.survivors, loot: { foods: t.end.loot.foods.slice(), gu: t.end.loot.gu.map(g => ({ sp: g.sp, rank: g.rank })) }, cleared: t.end.cleared, wiped: t.end.wiped,
  land: t.land, kalpa: t.kalpa || 0, reward: t.got || null } : null;
function epitaph(f) {   // 告别词：死在哪、这一趟斩敌几只、带着什么蛊性
  return `死在第 ${f.d + 1} 层的${ROOMS[f.type] ? ROOMS[f.type].n : ''}${f.kills ? `，这一趟斩敌 ${f.kills} 只` : ''}${f.xing && XING[f.xing] ? `，带着「${XING[f.xing].n}」走了` : ''}。`;
}
const toBoss = t => Math.max(0, TRIP_CFG.depth - 1 - t.d);
const tripSeed = (base, n) => (hashStr(String(base) + ':trip:' + n) >>> 0).toString(36);

// ---- src/trip-ui.js
// 蛊码 GuCode · 秘境界面。只通过 hooks.js 的 TRIP 和洞府打交道（不 import ui.js）。逻辑全在 trip.js。
// 一屏只有一个主按钮；「退出秘境」一直在右上角但不是主按钮；精英和首领开打前先给看阵容并写明「输了全队永久死亡」。
// 规则「赢了救回，输了全死」：打赢的那一场倒下的救回、剩 1 血；打输就是渡劫失败，全队永久死亡，直接进结算，结算页停住，列出每只死去的蛊和告别词，点了才回洞府（api.onTripEnd）。
// 天象、劫数、手里的祝福一直写在顶上；首领机制在开打前写明。打赢首领 = 渡劫成功，先二选一拿首领掉落再结算。











const tuUnit = () => (VSC ? 8000 : 200);   // 1 份路程 = 多少 token（插件 8000，网页模拟 200），和 TokenSource.unit 一致
const tuEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tuFood = id => (FOOD[id] ? FOOD[id].n : id);
const tuFi = id => `<span class="fi">${foodSVG(id)}</span>`;   // 食物小图（洞府同一套 .fi 样式）
const tuGuN = g => (g ? (RANK.names[g.rank] || '') + (SP[g.sp] ? SP[g.sp].n : g.sp) : '');
let tuBusy = false;   // 战斗回放中不接点击

// ───────────── 状态 ─────────────
const tuT = api => { const S = api.S(); return S && S.trip && S.trip.v ? S.trip : null; };
// 下一趟的种子：进秘境前洞府用它预览天象和首领（TRIP.preview），出征时用同一个
const tuNextSeed = S => tripSeed(S.seed, 'k' + (S.tripN | 0));
const tuBest = (S, id) => (S.kalpa && S.kalpa[id] != null ? S.kalpa[id] : -1);   // 这个秘境通关过的最高劫（普通难度通关 = 0，没通关过 = -1）
function tuInit(api) {
  const S = api.S(), at = (S.trip && S.trip.at) || Date.now();
  const land = (S.trip && S.trip.land) || S.realm, kalpa = (S.trip && S.trip.kalpa) | 0;   // 洞府选好的秘境 id 和第几劫
  const ok = typeof api.unlocked === 'function' ? api.unlocked : null;   // 道途：掉落只出解锁过的食物和蛊
  const t = tripStart(tuNextSeed(S), land, S.team, { trip: S.tripFood || [], kalpa,
    foods: ok ? FOODS.filter(f => ok(f.id, 'food')).map(f => f.id) : [], sp: ok ? NORMAL_SPECIES.filter(s => ok(s.id, 'species')).map(s => s.id) : null });
  S.tripN = (S.tripN | 0) + 1;
  S.trip = Object.assign({ at }, t, { ui: { msg: [], offers: [], ask: null } });
  api.save();
  return S.trip;
}
const tuUI = t => t.ui || (t.ui = { msg: [], offers: [], ask: null });

// ───────────── 画面 ─────────────
function tuDraw(api) {
  const box = api.el; if (!box) return;
  const S = api.S(); let t = tuT(api);
  if (!t && S.trip) t = tuInit(api);
  if (!t) { box.innerHTML = ''; return; }
  const ui = tuUI(t), by = Object.fromEntries(S.team.map(g => [g.uid, g]));
  let body, onMap = false;
  if (ui.offers.length) body = tuOffer(t, by, ui.offers[0]);
  else if (t.offer) body = tuBlessPick(t, t.offer.ids, 'offer');
  else if (t.reward) body = tuReward(t);
  else if (t.end) body = tuEnd(t, by, S);
  else if (ui.ask === 'flee') body = tuAsk(t);
  else if (t.room && !t.room.done) body = tuRoom(t, S);
  else { body = tuMapView(t, S); onMap = true; }
  const msg = ui.msg && ui.msg.length && !t.end ? `<p class="tu-msg">${ui.msg.map(tuEsc).join('<br>')}</p>` : '';
  box.innerHTML = `${tuHead(t)}${t.end || onMap ? '' : tuMods(t)}${t.end ? '' : tuSyn(api, t, S)}${tuTeam(t, by)}${msg}<div class="tu-body">${body}</div>${t.end ? '' : tuBag(t)}`;
  const sc = box.querySelector('.tu-scroll'), at = sc && sc.querySelector('.tu-cell.cur, .tu-cell.reach');   // 地图滚到当前位置
  if (sc && at) sc.scrollTop = Math.max(0, at.offsetTop - sc.clientHeight / 2);
}
function tuHead(t) {
  const N = tripMapOf(t).length, d = Math.min(t.d, N - 1);
  const flee = t.end || t.reward || t.offer || tuUI(t).ask ? '' : `<button class="tu-flee" data-trip="flee" title="带着战利品回洞府">退出秘境</button>`, L = tripLand(t);
  return `<div class="tu-head"><span class="lbl" title="${tuEsc(`${L.n}：额度 ${L.quota}，主道是${DAO[L.dao] ? DAO[L.dao].n : L.dao}，最深处是首领`)}">${tuEsc(L.n)}${t.kalpa ? ` <em class="tu-jie">${tuEsc(JIE_NAMES[t.kalpa])}</em>` : ''} <small>${t.end ? '回洞府' : `第 ${d + 1} / ${N} 层`}</small></span>${flee}</div>`;
}
// 房间里（不在地图上时）顶上一行：天象、劫数、手里的祝福和出征食物（悬停看全文）
function tuMods(t) {
  const m = tripMods(t), chip = (cls, k, n, d) => `<span class="tu-chip ${cls}" title="${tuEsc(d)}"><i>${k}</i>${tuEsc(n)}</span>`, out = [];
  if (m.sky) out.push(chip('sky', '天象', m.sky.n, m.sky.d));
  if (m.kalpa) out.push(chip('jie', '劫数', m.kalpaName, m.rules.map((r, i) => `${JIE_NAMES[i + 1]}：${r}`).join('\n')));
  blessList(t).forEach(b => out.push(chip('bless', '祝福', b.n, `${b.d}（${b.last}）`)));
  (t.eff || []).forEach(id => FOOD[id] && out.push(`<span class="tu-chip food" title="${tuEsc(FOOD[id].d)}">${tuFi(id)}${tuEsc(FOOD[id].n)}</span>`));
  return out.length ? `<div class="tu-mods">${out.join('')}</div>` : '';
}
// 队伍上方一行：当前生效的道共鸣和杀招（用洞府的同一个组件 api.synLine；洞府还没给时只写一行字）
function tuSyn(api, t, S) {
  const team = fieldTeam(t, S.team); if (!team.length) return '';
  if (typeof api.synLine === 'function') return `<div class="tu-syn">${api.synLine(team)}</div>`;
  let line = ''; try { line = synergyOf(team).line; } catch (e) { line = ''; }
  return `<div class="tu-syn"><span class="lbl">共鸣</span><span>${tuEsc(line || '没有生效的共鸣和杀招')}</span></div>`;
}
// 队伍：每只写攻、速、血条和数字，道字、蛊性、挂件，身上的状态（残血、救回、定魂）
const tuSpd = g => { try { return g.spd || (battleProfile(g.sp) || {}).spd || 100; } catch (e) { return g.spd || 100; } };
function tuTeam(t, by) {
  return `<div class="tu-team">${t.order.map(u => {
    const g = by[u], f = t.fallen.find(x => x.uid === u), sp = g ? g.sp : f && f.sp, rank = g ? g.rank : f && f.rank; if (!sp) return '';
    const dead = t.dead.includes(u), hp = t.hp[u] || 0, mx = t.mx[u] || 1, pc = Math.max(0, Math.min(100, Math.round(hp / mx * 100)));
    const xg = g && g.xing && XING[g.xing], gear = g && g.food && FOOD[g.food], dao = DAO[daoOf(sp)];
    const tags = [xg ? `<em class="tu-tag xg" title="${tuEsc(`蛊性「${xg.n}」：${xg.d}`)}">${tuEsc(xg.n[0])}</em>` : '', gear ? `<em class="tu-tag gear fimg" title="${tuEsc(`挂件「${gear.n}」：${gear.d}`)}">${foodSVG(g.food)}</em>` : ''].join('');
    const st = dead ? '' : t.revived === u && hp > 1 ? '定魂' : (t.saved || []).includes(u) && hp <= Math.max(1, mx * 0.05) ? '救回' : pc <= 30 ? '残血' : '';
    return `<div class="tu-g${dead ? ' dead' : pc <= 30 ? ' low' : ''}"><span class="tu-art">${guSVG(sp, { rank })}</span><span class="tu-gi"><b>${dao ? `<i class="tu-dao" title="${tuEsc(dao.n)}">${tuEsc(dao.n[0])}</i>` : ''}${tuEsc(SP[sp] ? SP[sp].n : sp)}${tags}</b>${dead ? '<small>永久死亡</small>' : `<span class="tu-st"><i class="a">${g ? g.atk : ''}</i><i class="v">${g ? tuSpd(g) : ''}</i>${st ? `<em class="tu-state">${st}</em>` : ''}</span><span class="tu-hp"><i style="width:${pc}%"></i></span><small>${hp}/${mx}</small>`}</span></div>`;
  }).join('')}</div>`;
}
function tuBag(t) {
  const l = t.loot, items = [...l.gu.map(g => tuEsc(tuGuN(g))), ...l.foods.map(id => tuFi(id) + tuEsc(tuFood(id)))];
  return `<div class="tu-bag"><span class="lbl">战利品袋</span><span>${items.length ? items.join('、') : '还是空的'}</span><small>退出秘境或渡劫成功都全部带回；渡劫失败全部丢在秘境里。</small></div>`;
}
// ───────────── 整张地图（杀戮尖塔式）：从下往上 10 层，最顶上是首领；一层一行、三条路三列 ─────────────
// 当前位置描朱，能走的下一格高亮可点，走过的路变暗；正在走的那段路，朱线从起点往目标长（进度条）
const TU_H = 40, tuX = lane => [50, 150, 250][lane], tuPct = lane => ['16.667%', '50%', '83.333%'][lane];
const tuTip = (t, k) => (k === 'camp' ? `篝火：歇脚的地方，全队回满血的 ${Math.round(campOf(t) * 100)}%（不是炎道）` : ROOMS[k].tip);   // 地图格子和图例的悬停说明
function tuWalkPc(t) { const need = needTok(t, tuUnit()); return need ? Math.min(1, t.prog / need) : 0; }
function tuMapView(t, S) {
  const map = tripMapOf(t), N = map.length, H = TU_H, Ht = (N + 1) * H, reach = tripReach(t), walking = t.pick != null && !t.room, path = t.path || [];
  const y = d => (N - 1 - d) * H + H / 2;   // d = -1 是入口（最底下）
  const from = t.d === 0 ? [-1, 1] : [t.d - 1, path[t.d - 1] != null ? path[t.d - 1] : t.lane];   // 现在站的地方
  const lanesAt = d => (d < 0 ? [1] : map[d] ? map[d].rooms.map(r => r.lane) : []);
  const nexts = (d, l) => (d < 0 ? map[0].rooms.map(r => r.lane) : nextLanes(map, d, l));
  const lines = [];
  for (let d = -1; d < N - 1; d++) lanesAt(d).forEach(l => nexts(d, l).forEach(n => {
    const done = d + 1 < t.d && (d < 0 ? true : path[d] === l) && path[d + 1] === n;
    const isFrom = d === from[0] && l === from[1], open = isFrom && !walking && reach.includes(n), walk = isFrom && walking && n === t.pick;
    lines.push(`<line class="${done ? 'done' : open ? 'open' : walk ? 'base' : 'off'}" x1="${tuX(d < 0 ? 1 : l)}" y1="${y(d)}" x2="${tuX(n)}" y2="${y(d + 1)}"/>`);
    if (walk) { const p = tuWalkPc(t), x1 = tuX(d < 0 ? 1 : l), y1 = y(d), x2 = tuX(n), y2 = y(d + 1);
      lines.push(`<line id="tuWalkLn" class="walk" data-x="${x1},${y1},${x2},${y2}" x1="${x1}" y1="${y1}" x2="${x1 + (x2 - x1) * p}" y2="${y1 + (y2 - y1) * p}"/>`); }
  }));
  const m = tripMods(t), cells = [];
  for (let d = 0; d < N; d++) map[d].rooms.forEach(r => {
    const R = ROOMS[r.type], cost = r.cost * tuUnit() * (d === t.d ? t.short || 1 : 1) * roadOf(t);
    const past = d < t.d && path[d] === r.lane, skip = d < t.d && !past, cur = d === t.d && t.pick === r.lane, can = !walking && d === t.d && reach.includes(r.lane);
    const cls = `tu-cell t-${r.type}${past ? ' past' : ''}${skip ? ' skip' : ''}${cur ? ' cur' : ''}${can ? ' reach' : ''}${!past && !cur && !can && d <= t.d ? ' off' : ''}`;
    const tip = `第 ${d + 1} 层 · ${tuTip(t, r.type)}${d >= t.d ? `\n路程 ${fmtTok(cost)} 元气` : ''}`;
    const pop = r.type === 'boss' && m.boss ? `<span class="tu-pop"><b>${tuEsc(m.boss.n)}</b>${m.mechs.map(x => `<small>机制「${tuEsc(x.n)}」：${tuEsc(x.d)}</small>`).join('')}<span class="tu-pop-team">${m.boss.team.map(g => `<i title="${tuEsc(tuGuN(g))}">${guSVG(g.sp, { rank: g.rank })}<em>${RANK.ch[g.rank]}</em></i>`).join('')}</span></span>` : '';
    const tag = can ? 'button' : 'span', at = `style="left:${tuPct(r.lane)};top:${y(d)}px"`;
    cells.push(`<${tag} class="${cls}" ${at}${can ? ` data-trip="pick" data-lane="${r.lane}"` : ''} title="${tuEsc(pop ? '' : tip)}"><b class="tu-seal">${R.ch}</b>${can ? `<small>${fmtTok(cost)}</small>` : ''}${pop}</${tag}>`);
  });
  cells.push(`<span class="tu-cell t-start${t.d === 0 && !walking ? ' cur' : ''}" style="left:50%;top:${y(-1)}px" title="入口"><b class="tu-seal">入</b></span>`);
  const r = curRoom(t), need = needTok(t, tuUnit());
  const cap = walking ? `<p class="tu-cap tu-walkcap"><span>走向第 ${t.d + 1} 层的${ROOMS[r.type].n}</span><small id="tuProg">${fmtTok(t.prog)} / ${fmtTok(need)} 元气</small></p><p class="tu-hint">写代码的 token 推着蛊往前走（朱线就是进度）。</p>`
    : `<p class="tu-cap tu-walkcap"><span>点亮的格子可以走</span><small>格子下的数字是路程</small></p><p class="tu-hint">路程先花洞府攒着的元气（现在 ${fmtTok(S.bank)}），不够就等你写代码。</p>`;
  const legend = `<p class="tu-legend">${['fight', 'elite', 'event', 'camp', 'market', 'bless', 'boss'].map(k => `<span title="${tuEsc(tuTip(t, k))}"><b class="tu-seal t-${k}">${ROOMS[k].ch}</b>${ROOMS[k].n}<small>${ROOMS[k].k}</small></span>`).join('')}</p>`;
  return `<div class="tu-mapwrap"><div class="tu-mapcol"><div class="tu-scroll"><div class="tu-tower" style="height:${Ht}px"><svg class="tu-lines" viewBox="0 0 300 ${Ht}" preserveAspectRatio="none" aria-hidden="true">${lines.join('')}</svg>${cells.join('')}</div></div></div>${tuSide(t)}</div>${legend}${cap}`;
}
// 地图旁边常驻：天象、首领（机制 + 阵容）、劫数、手里的祝福和出征食物
function tuSide(t) {
  const m = tripMods(t), out = [];
  if (m.sky) out.push(`<div class="tu-sc sky"><p class="k">天象 · 双方都吃</p><b>${tuEsc(m.sky.n)}</b><p>${tuEsc(m.sky.d)}</p></div>`);
  if (m.boss) out.push(`<div class="tu-sc boss"><p class="k">首领</p><b>${tuEsc(m.boss.n)}</b>${m.mechs.map(x => `<p><em>「${tuEsc(x.n)}」</em>${tuEsc(x.d)}<small>${tuEsc(x.k)}</small></p>`).join('')}<span class="tu-pop-team">${m.boss.team.map(g => `<i title="${tuEsc(tuGuN(g))}">${guSVG(g.sp, { rank: g.rank })}<em>${RANK.ch[g.rank]}</em></i>`).join('')}</span></div>`);
  if (m.kalpa) out.push(`<div class="tu-sc jie"><p class="k">劫数</p><b>${tuEsc(m.kalpaName)}</b><ol>${m.rules.map(x => `<li>${tuEsc(x)}</li>`).join('')}</ol></div>`);
  const bl = blessList(t), fd = (t.eff || []).filter(id => FOOD[id]);
  if (bl.length || fd.length) out.push(`<div class="tu-sc bless"><p class="k">这一趟的加持</p>${bl.map(b => `<p title="${tuEsc(b.d)}"><em>${tuEsc(b.n)}</em>${tuEsc(b.d)}<small>${tuEsc(b.last)}</small></p>`).join('')}${fd.map(id => `<p>${tuFi(id)}<em>${tuEsc(FOOD[id].n)}</em>${tuEsc(FOOD[id].d.replace(/^下一次出征：/, ''))}</p>`).join('')}</div>`);
  return `<aside class="tu-side">${out.join('')}</aside>`;
}
function tuFoes(foe) {
  return `<div class="tu-foes">${foe.map(f => `<div class="tu-f${f.boss ? ' boss' : ''}"><span class="tu-art">${guSVG(f.sp, { rank: f.rank })}</span><b>${tuEsc(SP[f.sp] ? SP[f.sp].n : f.sp)}</b><span class="st"><i class="a">${f.atk}</i><i class="h">${f.hp}</i></span></div>`).join('')}</div>`;
}
function tuRoom(t, S) {
  const room = t.room, R = ROOMS[room.type], title = `<p class="tu-eyebrow">第 ${room.d + 1} 层</p><h3><b class="tu-seal">${R.ch}</b>${R.n}</h3>`;
  if (room.foe) {
    const foe = roomFoe(t) || [], risky = room.type === 'elite' || room.type === 'boss', m = tripMods(t), pre = preOf(t), rules = [];
    if (m.sky) rules.push(`<li><b>天象「${tuEsc(m.sky.n)}」</b>${tuEsc(m.sky.d)}（双方都吃）</li>`);
    if (room.type === 'boss') m.mechs.forEach(x => rules.push(`<li class="mech"><b>首领机制「${tuEsc(x.n)}」</b>${tuEsc(x.d)}<small>${tuEsc(x.k)}</small></li>`));
    if (m.kalpa) rules.push(`<li><b>${tuEsc(m.kalpaName)}</b>${tuEsc(m.rules.join('；'))}</li>`);
    const boss = room.type === 'boss' && m.boss ? `<p class="tu-eyebrow">${tuEsc(m.boss.n)}</p>` : '';
    return `<div class="tu-panel t-${room.type}">${title}${boss}<p>${tuEsc(R.d)}</p>${risky ? '<p class="tu-warn">输了全队永久死亡；不想冒险，现在退出秘境，战利品都能带走。</p>' : ''}
      ${rules.length ? `<ul class="tu-rules">${rules.join('')}</ul>` : ''}<p class="tu-cap">对面</p>${tuFoes(foe)}${pre ? `<p class="tu-hint">开打前全队回 ${Math.round(pre * 100)}% 血（出征食物、祝福）。</p>` : ''}${t.revive && !t.revived ? `<p class="tu-hint">定魂香：这一趟第一只倒下的蛊，救回时以 ${Math.round(t.revive * 100)}% 血站起来。</p>` : ''}
      <div class="tu-main"><button class="zhu big" data-trip="fight">${room.type === 'boss' ? '渡劫' : '开打'}</button></div></div>`;
  }
  if (room.type === 'event') {
    const e = EVENT[room.ev];
    return `<div class="tu-panel t-event">${title.replace(R.n, tuEsc(e.n))}<p>${tuEsc(e.s)}</p><div class="tu-opts">${e.o.map((o, i) => { const pay = evPay(t, o.fx, tuUnit()), can = !pay || S.bank >= pay; return `<button class="tu-opt" data-trip="ev" data-i="${i}"${can ? '' : ' disabled'}><b>${tuEsc(o.t)}</b><small>${tuEsc(fxText(o.fx, pay))}${can ? '' : `（元气不够，现在 ${fmtTok(S.bank)}）`}</small></button>`; }).join('')}</div></div>`;
  }
  if (room.type === 'camp') return `<div class="tu-panel t-camp">${title}<p>歇脚，全队回满血的 ${Math.round(campOf(t) * 100)}%。</p><div class="tu-main"><button class="zhu big" data-trip="camp">歇一阵 · 全队回 ${Math.round(campOf(t) * 100)}% 血</button></div></div>`;
  if (room.type === 'bless') return `<div class="tu-panel t-bless">${title}<p>${tuEsc(R.d)}</p>${tuBlessCards(room.choices, 'bless')}</div>`;
  if (room.type === 'market') {
    const u = tuUnit();
    return `<div class="tu-panel t-market">${title}<p>${tuEsc(R.d)}</p><div class="tu-wares">${room.wares.map((w, i) => {
      const c = wareTok(w, u), can = !w.sold && S.bank >= c;
      return `<div class="tu-ware${w.sold ? ' sold' : ''}">${w.k === 'gu' ? `<span class="tu-art">${guSVG(w.g.sp, { rank: w.g.rank })}</span>` : (w.k === 'food' ? `<span class="tu-art">${foodSVG(w.id)}</span>` : `<b class="tu-seal">药</b>`)}<span>${tuEsc(wareText(w))}</span><button data-trip="buy" data-i="${i}"${can ? '' : ' disabled'}>${w.sold ? '买了' : fmtTok(c)}</button></div>`;
    }).join('')}</div><p class="tu-hint">花的是元气，洞府攒着的 ${fmtTok(S.bank)}。</p><div class="tu-main"><button class="zhu big" data-trip="leave">继续上路</button></div></div>`;
  }
  return '';
}
// 祝福三选一：每张卡写是什么、管多久
const tuBlessCards = (ids, act) => `<div class="tu-cards">${ids.map((id, i) => { const b = BLESS[id]; return b ? `<button class="tu-card" data-trip="${act}" data-i="${i}"><b>${tuEsc(b.n)}</b><span>${tuEsc(b.d)}</span><small>${tuEsc(blessLast(b))}</small></button>` : ''; }).join('')}</div>`;
function tuBlessPick(t, ids) {
  return `<div class="tu-panel t-bless"><p class="tu-eyebrow">打赢精英</p><h3><b class="tu-seal">福</b>选一个祝福</h3><p>只在这一趟有效，回洞府就没了。</p>${tuBlessCards(ids, 'offer')}<div class="tu-main"><button class="tu-sec" data-trip="offer" data-i="-1">都不要</button></div></div>`;
}
function tuReward(t) {
  const r = t.reward, g = r.gu, f = r.food && FOOD[r.food];
  return `<div class="tu-panel t-boss"><p class="tu-eyebrow">渡劫成功</p><h3><b class="tu-seal">劫</b>首领掉落，二选一</h3><p>选一样放进战利品袋，然后带着全部战利品回洞府。</p><div class="tu-cards two">
    ${g ? `<button class="tu-card" data-trip="reward" data-k="gu"><span class="tu-art">${guSVG(g.sp, { rank: g.rank })}</span><b>${tuEsc(tuGuN(g))}</b><span>${tuEsc(SP[g.sp] && SP[g.sp].d ? SP[g.sp].d : '这个秘境主道的蛊')}</span><small>放进蛊囊</small></button>` : ''}
    ${f ? `<button class="tu-card" data-trip="reward" data-k="food"><span class="tu-art">${foodSVG(r.food)}</span><b>${tuEsc(f.n)}</b><span>${tuEsc(f.d)}</span><small>放进食物架</small></button>` : ''}</div></div>`;
}
function tuOffer(t, by, o) {
  const g = by[o.uid], nw = XING[o.xing], old = XING[o.old]; if (!g || !nw || !old) return '';
  return `<div class="tu-panel"><p class="tu-eyebrow">蛊性</p><h3>${tuEsc(SP[g.sp].n)} 打出了新的蛊性</h3><p>每只蛊只能带一个蛊性，换了旧的就没了。</p>
    <ul class="tu-xl"><li><b>新的「${tuEsc(nw.n)}」</b>${tuEsc(nw.d)}</li><li><b>现在的「${tuEsc(old.n)}」</b>${tuEsc(old.d)}</li></ul>
    <div class="tu-main"><button class="zhu big" data-trip="xing" data-y="1">换成「${tuEsc(nw.n)}」</button><button class="tu-sec" data-trip="xing" data-y="0">留着「${tuEsc(old.n)}」</button></div></div>`;
}
function tuAsk(t) {
  const l = t.loot, items = [...l.gu.map(tuGuN), ...l.foods.map(tuFood)];
  return `<div class="tu-panel"><h3>退出秘境？</h3><p>${items.length ? `战利品袋里的全部带回：${tuEsc(items.join('、'))}。` : '战利品袋是空的。'}活着的蛊回洞府就养好伤。这一趟不算渡劫。</p>
    <div class="tu-main"><button class="zhu big" data-trip="fleeYes">退出秘境</button><button class="tu-sec" data-trip="fleeNo">继续走</button></div></div>`;
}
// 结算页一句：这一趟的天象、劫数、拿过的祝福
const tuTripSum = t => { const m = tripMods(t), bl = (t.bless || []).map(x => BLESS[x.id] && BLESS[x.id].n).filter(Boolean); return [m.sky ? `天象「${m.sky.n}」` : '', m.kalpa ? m.kalpaName : '', bl.length ? `祝福：${bl.join('、')}` : ''].filter(Boolean).map(tuEsc).join(' · ') + (m.sky || m.kalpa || bl.length ? '。' : ''); };
function tuEnd(t, by, S) {
  const e = t.end, head = { clear: ['渡劫成功', '闯到了最深处，赢了首领'], wipe: ['渡劫失败', '打输了一场，全队永久死亡'], retreat: ['退出秘境', '带着战利品回洞府'] }[e.why] || ['回洞府', ''];
  const first = e.cleared ? landReward(t.land, { realm: S.realm, best: tuBest(S, t.land), kalpa: t.kalpa }).first : [];   // 第一次渡过：晋境界、开放劫一（打到新的劫：开放下一劫）
  const isGot = (k, x) => t.got && t.got.k === k && (k === 'gu' ? t.got.gu.sp === x.sp && t.got.gu.rank === x.rank : t.got.food === x);
  let gotGu = false, gotFood = false;
  const N = tripMapOf(t).length, deep = Math.min(N, e.why === 'clear' ? N : e.depth + (t.rooms > e.depth ? 1 : 0));
  const tag = (k, x) => { const on = k === 'gu' ? !gotGu && isGot(k, x) : !gotFood && isGot(k, x); if (on) { if (k === 'gu') gotGu = true; else gotFood = true; } return on ? '<em class="tu-drop">首领掉落</em>' : ''; };
  const got = [...e.loot.gu.map(g => `<li><span class="tu-art">${guSVG(g.sp, { rank: g.rank })}</span><span>${tuEsc(tuGuN(g))}${tag('gu', g)}</span><small>放进蛊囊</small></li>`), ...e.loot.foods.map(id => `<li><span class="tu-art">${foodSVG(id)}</span><span>${tuEsc(tuFood(id))}${tag('food', id)}</span><small>放进食物架</small></li>`)];
  const lost = e.lost && !lootEmpty(e.lost) ? `<p class="tu-hint">丢在秘境里的：${[...e.lost.gu.map(g => tuEsc(tuGuN(g))), ...e.lost.foods.map(id => tuFi(id) + tuEsc(tuFood(id)))].join('、')}</p>` : '';
  const back = e.survivors.map(u => by[u]).filter(Boolean).map(g => tuEsc(SP[g.sp].n)), saved = (e.saved || []).map(u => by[u]).filter(Boolean).map(g => tuEsc(SP[g.sp].n));
  return `<div class="tu-panel tu-end w-${e.why}"><p class="tu-eyebrow">${head[0]}</p><h3>${head[1]}</h3><p>这一趟走了 ${t.rooms} 个房间，最深到第 ${deep} 层。${tuTripSum(t)}${back.length ? `回来的：${back.join('、')}，回洞府就养好伤。` : ''}</p>${e.wiped ? '' : `<p class="tu-saved">${saved.length ? `救回 ${saved.length} 只：${saved.join('、')}（倒下过，但那一场打赢了）` : '这一趟没有蛊倒下过。'}</p>`}${first.length ? `<ul class="tu-first">${first.map(x => `<li>${tuEsc(x)}</li>`).join('')}</ul>` : ''}
    <p class="tu-cap">带回洞府</p>${got.length ? `<ul class="tu-got">${got.join('')}</ul>` : '<p class="tu-hint">什么也没带回。</p>'}${lost}
    ${e.fallen.length ? `<p class="tu-cap">全队永久死亡</p><ul class="tu-gone">${e.fallen.map(f => `<li><span class="tu-art gone">${guSVG(f.sp, { rank: f.rank })}</span><span><b>${tuEsc(tuGuN(f))}</b><small>${tuEsc(epitaph(f))}</small></span></li>`).join('')}</ul>` : ''}
    <div class="tu-main"><button class="zhu big" data-trip="home">回洞府</button></div></div>`;
}

// ───────────── 操作 ─────────────
async function tuFight(api, t) {
  const S = api.S(), room = t.room, ui = tuUI(t);
  const healed = tripPreFight(t), fielded = fieldTeam(t, S.team), foe = roomFoe(t);
  if (!fielded.length || !foe) return;
  tuBusy = true; api.save();
  let out;
  try {
    out = await api.playBattle(foe, { team: fielded, seed: `${t.seed}:${room.d}:${room.lane}`, title: `秘境第 ${room.d + 1} 层 · ${ROOMS[room.type].n}`, foeName: room.type === 'boss' ? `${tripLand(t).n}首领` : room.type === 'elite' ? `${tripLand(t).n}精英` : tripLand(t).n });
  } finally { tuBusy = false; }
  const r = tripFight(t, S.team, fielded, out.res); if (!r) return;
  const nm = u => { const g = S.team.find(x => x.uid === u); return g ? SP[g.sp].n : ''; };
  if (r.wiped) { ui.msg = []; ui.offers = []; return; }   // 打输：全队永久死亡，直接进结算
  ui.msg = [`${r.win ? '胜' : '僵持不下，各自退开（这个房间没有战利品）'}${healed ? `（开打前回了 ${healed} 血）` : ''}${r.loot && !lootEmpty(r.loot) ? '。进战利品袋：' + [...r.loot.gu.map(tuGuN), ...r.loot.foods.map(tuFood)].join('、') : ''}`];
  if (r.saved.length) ui.msg.push(`倒下的 ${r.saved.map(nm).join('、')} 救回来了，剩 1 血${r.revived ? `（定魂香：${nm(r.revived)} 以 ${Math.round(t.revive * 100)}% 血站起来）` : ''}`);
  if (r.reward) ui.msg.push('渡劫成功！首领掉落二选一');
  r.offers.filter(o => o.auto).forEach(o => ui.msg.push(`${nm(o.uid)} 打出了蛊性「${XING[o.xing].n}」：${XING[o.xing].d}`));
  ui.offers = r.offers.filter(o => !o.auto);
}
const TU_ACT = {
  pick(api, t, a) { tuUI(t).msg = []; tripPick(t, +a.dataset.lane, tuUnit(), api.S()); },
  fight(api, t) { return tuFight(api, t); },
  ev(api, t, a) {
    const S = api.S(), r = tripEvent(t, S.team, +a.dataset.i, tuUnit(), S), ui = tuUI(t); if (!r.ok) { ui.msg = [r.why || '选不了']; return; }
    ui.msg = [r.lines.length ? r.lines.join('，') : '什么也没发生'];
    if (r.offer) ui.offers = [r.offer];
  },
  camp(api, t) { const r = tripCamp(t); if (r) tuUI(t).msg = [`篝火边歇了一阵，全队共回 ${r.healed} 血`]; },
  bless(api, t, a) { const r = tripBless(t, +a.dataset.i); if (r) tuUI(t).msg = [`得祝福「${BLESS[r.id].n}」：${BLESS[r.id].d}（${blessLast(BLESS[r.id])}）`]; },
  offer(api, t, a) { const r = tripOffer(t, +a.dataset.i); if (r && r.id) tuUI(t).msg.push(`得祝福「${BLESS[r.id].n}」：${BLESS[r.id].d}（${blessLast(BLESS[r.id])}）`); },
  reward(api, t, a) { const g = tripReward(t, a.dataset.k); if (g) tuUI(t).msg = []; },
  buy(api, t, a) { const r = tripBuy(t, +a.dataset.i, tuUnit(), api.S()); tuUI(t).msg = r.ok ? ['买下了'] : [r.why || '买不了']; },
  leave(api, t) { tuUI(t).msg = []; tripLeaveRoom(t); },
  xing(api, t, a) {
    const ui = tuUI(t), o = ui.offers.shift(); if (!o) return;
    if (a.dataset.y === '1') { acceptXing(api.S().team, o.uid, o.xing); ui.msg = [`换上了蛊性「${XING[o.xing].n}」`]; }
  },
  flee(api, t) { tuUI(t).ask = 'flee'; },
  fleeNo(api, t) { tuUI(t).ask = null; },
  fleeYes(api, t) { const ui = tuUI(t); ui.ask = null; ui.msg = []; tripEnd(t, 'retreat'); },
  home(api, t) {   // 渡劫成功：记下这个秘境打到的最高劫（劫数的开放按它算），再交给洞府
    const S = api.S(), r = tripResult(t); if (!r) return 'done';
    if (r.cleared) { S.kalpa = S.kalpa || {}; S.kalpa[t.land] = Math.max(tuBest(S, t.land), t.kalpa || 0); }
    api.onTripEnd(r); return 'done';
  },
};
async function tuClick(e) {
  const a = e.target.closest && e.target.closest('[data-trip]'); if (!a || a.disabled || tuBusy) return;
  const api = TRIP.api; if (!api || !api.el || !api.el.contains(a)) return;
  const t = tuT(api), f = TU_ACT[a.dataset.trip]; if (!t || !f) return;
  const r = await f(api, t, a);
  if (r === 'done') return;   // 洞府接手（onTripEnd 会重绘整页）
  api.save(); tuDraw(api);
  const top = api.el && api.el.getBoundingClientRect(); if (top && top.top < 0) api.el.scrollIntoView({ block: 'start' });
}
if (typeof document !== 'undefined') document.addEventListener('click', tuClick);

// ───────────── 挂到洞府 ─────────────
TRIP.lands = LANDS;            // 秘境列表 [{ id, n, realm, quota, cap, dao, d, bosses: [{ i, mech, n, team }], boss（= 第一个首领的阵容）}]，洞府出征前给玩家选
// 进秘境前给玩家看的（选秘境列表、出征确认里用）：这一趟的天象、首领（名字、机制、阵容）、劫数规则、渡劫成功可得。
//   TRIP.preview(S, landId, kalpa) → { n, sky: { n, d }, boss: { n, mechs: [{ n, k, d }], team }, kalpa: { n, name, rules }, reward: { pick, first, lines } }
TRIP.preview = (S, id, kalpa) => tripPreview(tuNextSeed(S), id, kalpa | 0, { realm: S.realm, best: tuBest(S, id) });
TRIP.reward = (S, id, kalpa) => landReward(id, { realm: S.realm, best: tuBest(S, id), kalpa: kalpa | 0 });   // 只要「渡劫成功可得」时用
// 劫数：秘境一侧把每个秘境通关过的最高劫记在 S.kalpa[landId]（普通难度通关 = 0）。洞府选秘境时让玩家挑 0…open(S, id)，设 S.trip = { at, land, kalpa }
TRIP.kalpa = { max: JIE_MAX, names: JIE_NAMES, rules: JIE.map(j => j.n), best: tuBest, open: (S, id) => { const b = tuBest(S, id); return b < 0 ? 0 : Math.min(JIE_MAX, b + 1); } };
TRIP.foeFor = foeFor;          // (seed, quota, { dao, kind: 'room'|'elite'|'boss'|'ghost', depth }) → 敌阵，斗幽灵和战帖分场也用
TRIP.start = api => { tuInit(api); tuDraw(api); if (api.el) api.el.scrollIntoView({ block: 'start' }); };
TRIP.render = api => tuDraw(api);
TRIP.active = S => !!S.trip;
TRIP.feed = (S, tok) => {
  const t = S.trip && S.trip.v ? S.trip : null;
  if (!t) { S.bank += tok; return; }
  const api = TRIP.api;
  if (tripFeed(t, tok, tuUnit(), S)) { tuUI(t).msg = []; if (api) tuDraw(api); return; }
  if (t.pick != null && !t.room && typeof document !== 'undefined') {   // 走路中：只把地图上的朱线往前长、改数字，不整屏重画
    const ln = document.getElementById('tuWalkLn'), tx = document.getElementById('tuProg'), p = tuWalkPc(t);
    if (ln) { const [x1, y1, x2, y2] = ln.dataset.x.split(',').map(Number); ln.setAttribute('x2', x1 + (x2 - x1) * p); ln.setAttribute('y2', y1 + (y2 - y1) * p); }
    if (tx) tx.textContent = `${fmtTok(t.prog)} / ${fmtTok(needTok(t, tuUnit()))} 元气`;
  }
};

// ---- src/ui.js
// 蛊码 GuCode · 界面与流程：洞府（养成）、斗幽灵与战帖（切磋）、战斗回放、秘境接口。规则只认 docs/design.md















const KEY = 'gucode.v1';
const $ = (s, r = document) => r.querySelector(s);
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const setHTML = (n, h) => { if (n && n._h !== h) { n.innerHTML = h; n._h = h; } };   // 内容没变就不重绘，悬停提示不会被打断

// ---------- 界面文案集中在这里 ----------
const TXT = {
  qiTip: '元气就是你在 AI 编程工具里消耗的 token，没有上限，也没有别的来源。买蛊、买食物、转市花元气；渡劫时先用攒下的元气一口气往深处走，用完靠实时 token。',
  qiTrial: '网页版是模拟元气（存档标「试玩」）。',
  sota: '你正在用 Claude，蛊的伤害 +1%',
  slotsHead: '空窍',
  slotsSub: '场上 · 渡劫时全部跟去',
  bagHead: '蛊囊',
  bagSub: '场下 · 凑合成用 · 不跟去渡劫，绝对安全',
  bagTip: () => `蛊囊 ${S.bag.length}/${BC()}：场下的蛊放这里，不上场、不跟去渡劫，所以绝对安全。主要用来凑合成：空窍和蛊囊里同种同转的蛊凑够三只，自动合成高一转。拖进空窍就上场。`,
  shopHead: '蛊市',
  shopTip: '花元气买蛊和食物。什么道的蛊都会刷，罗盘选中的道出现得稍多一点（+5%）。转市换一批，冻结的货下次还在。',
  refresh: c => `转市 · ${c}`,
  freeze: on => on ? '解冻' : '冻结',
  daoNone: '罗盘：还没转（选中的道在蛊市里多出 5%）',
  daoLine: d => `罗盘：${DAO[d] ? DAO[d].n : d}（这一轮蛊市里多出 5%）`,
  daoTip: '每次回到洞府转一次罗盘，三选一：选中的道在本轮蛊市出现的概率 +5%。只是轻轻偏一下，蛊市照样什么道都会刷。罗盘不加属性。',
  compassHead: '罗盘 · 三选一',
  compassSub: '选一道，它在本轮蛊市出现的概率 +5%。只是轻轻偏一下，什么道都还会刷。',
  resoNone: '道共鸣：同一道的蛊在空窍里有 2 只、4 只时触发',
  go: '渡劫',
  goSub: (n, l) => `空窍里的 ${n} 只蛊全部去「${l.n}」`,
  landsHead: '选秘境',
  landsSub: '每个秘境写明出战额度：上阵蛊的转数加起来不能超过它。敌人按额度配，不看你的蛊池。渡过本境界任一秘境最深处的首领劫，开放下一境界的秘境。',
  landLock: '渡过上一境界的首领劫后开放',
  gainHead: '渡劫成功可得', skyHead: '天象', jieHead: '劫数', jieNormal: '普通',
  gainLine: lines => `渡劫成功可得：${lines.join('；')}`,
  jieSub: '劫数越高敌人越强，规则一条条叠上去；打过这一劫，开放下一劫',
  landLine: l => `${REALMS[l.realm]} · 额度 ${l.quota} · 敌人多${DAO[l.dao] ? DAO[l.dao].n : '杂道'}`,
  quotaTip: (u, q) => `上阵蛊的转数加起来是 ${u}，这个秘境的额度是 ${q}。额度 9 可以带三只三转，也可以一只五转加两只二转；只限转数总和，不限只数。`,
  driveTip: () => `${REALMS[S.realm]}境界能驱使${RANK.names[driveCap(S.realm)]}及以下的蛊上阵；第一次渡过本境界的劫，境界加一，能驱使更高转数的蛊。`,
  whyEmpty: '空窍里还没有蛊',
  whyQuota: (u, q) => `上阵转数 ${u}，超过额度 ${q}：收一只进蛊囊再渡劫`,
  whyDrive: g => `${rankName(g)}要${REALMS[rankOf(g) - 1]}境界才能驱使：先收进蛊囊`,
  driveNo: g => `${REALMS[S.realm]}境界只能驱使${RANK.names[driveCap(S.realm)]}及以下的蛊，${rankName(g)}先留在蛊囊`,
  overDrive: '境界不够，驱使不了：渡劫前收进蛊囊',
  ateLine: g => `加攻血的食物 已吃 ${ateOf(g)}/${ATE_MAX}`,
  ateNo: g => `${rankName(g)}已经吃满 ${ATE_MAX} 次加攻血的食物了`,
  ateFull: `空窍里的蛊都吃满 ${ATE_MAX} 次了，这份食物喂不下`,
  statHead: '每一转',
  statSub: '三只同种同转合成高一转：攻血换成那一转的数，技能跟着攻血涨，主动技每升一转再强一截；三转、五转各觉醒一次。五转封顶，喂食物的加成另算（每只最多吃 3 次）',
  mergeAfter: (a, b) => `合成后：${a}`,
  xingAsk: g => `${rankName(g)}：传哪个蛊性？`,
  xingAskSub: '三只材料带着不同的蛊性，新蛊只能留一个，没选的就没了。关掉这一页就先留着现在亮着的那个。',
  xingSet: g => `${rankName(g)}留下了蛊性「${xingName(g.xing)}」`,
  goWarn: '一场打赢了，这一场倒下的蛊全部救回；打输一场就是渡劫失败：上阵的蛊全部永久死亡，这次的战利品全部丢失。每场开打前都能退出秘境，带回战利品和所有蛊。蛊囊里的蛊留在洞府，绝对安全。',
  goSoon: '秘境还在开凿，渡劫下一版就来。先在洞府里买蛊、合成、排阵。',
  inTrip: '队伍正在秘境里渡劫。渡劫中不能逛蛊市、不能换阵。',
  merge: g => `三只合一：炼成${rankName(g)}，攻 ${g.atk} 血 ${g.hp}`,
  toBag: g => `${rankName(g)} 进了蛊囊（空窍满了）`,
  bagFull: '空窍和蛊囊都满了：先卖掉一只，或凑成合成',
  sold: (g, v) => `卖掉${rankName(g)}，退回 ${fmtTok(v)} 元气`,
  bought: g => `买下${rankName(g)}`,
  foodPick: f => `把「${f.n}」喂给哪一只？`,
  gearPick: f => `把「${f.n}」挂在哪一只身上？每只最多挂 1 个，换新的旧的就没了。`,
  tripFood: f => `「${f.n}」收好了，下一次渡劫生效`,
  tripLocked: '下个版本开放',
  tripLockedLine: names => `${names}：下个版本开放`,
  fed: (f, gs) => `${f.n}：${gs.map(g => SP[g.sp].n).join('、')} 攻 +${f.atk || 0} 血 +${f.hp || 0}`,
  geared: (f, g) => `${SP[g.sp].n} 挂上了「${f.n}」`,
  floor: g => `洞府里一只蛊都没有了，免费领到${rankName(g)}`,
  poor: (need) => `元气不够：还差 ${fmtTok(need)}，写会儿代码就有了`,
  spar: '纯切磋：不死蛊，也不给东西',
  resoGain: '凑共鸣',
  resoGainTip: x => `买下放上阵盘：${x.name}凑到 ${x.tier} 只，${x.sum}`,
  tryName: '试阵', tryGo: '先试阵', tryOne: '模拟一场', try20: '连打 20 场',
  trySub: '用阵盘上现在的摆法打',
  tryTip: '试阵：拿阵盘上现在的摆法和幽灵、本秘境的精英或首领打一场看看。纯模拟，什么都不会变。',
  tryQ: '额度', tryFoe: '对手',
  tryOver: (u, q) => `你的阵转数 ${u}，超过额度 ${q}：真渡劫要先收几只进蛊囊`,
  tryBossQ: q => `首领按秘境原样（额度 ${q}）`,
  tryRun: (i, n) => `打了 ${i} / ${n} 场…`,
  tryRes: (w, l, d, n) => `${n} 场：胜 ${w} · 负 ${l}${d ? ' · 平 ' + d : ''}`,
  tryWin: p => `胜率 ${p}%`,
  tryLeft: (x, n) => `平均剩 ${x} / ${n} 只`,
  tryTop: (nm, x) => `伤害最高：${nm}（每场平均 ${x}）`,
  tryOneRes: (left, n, top) => `剩 ${left} / ${n} 只${top ? ' · 伤害最高：' + top : ''}`,
  arenaName: q => `${q} 点场`,
  arenaOver: (u, q) => `你的空窍转数 ${u}，超过 ${q} 点场：收几只进蛊囊，或者换高一档的场`,
  arenaNone: u => `转数 ${u}，超过最高的 22 点场`,
  duelArena: q => `这张战帖是 ${q} 点场：双方上阵转数都不超过 ${q}`,
  trib: r => `渡劫成功 · ${REALMS[r]}`,
  tribLines: r => [`开放额度 ${QUOTA[r]} 的秘境`, `能驱使${RANK.names[driveCap(r)]}及以下的蛊上阵`, `蛊市进新档：能买到${RANK.names[Math.min(5, r + 1)]}的蛊`, '罗盘会转出新的道'],
  comboFirst: c => `杀招成形 · ${c.n}`,
  comboLines: (c, g) => [`${c.need.map(x => SP[x].n).join(' + ')} 同时在空窍，杀招自动成形`, `挂在${SP[g.sp].n}身上：${c.d}`, '蛊卡上的朱印就是它，悬停能看配方和效果'],
  achFirst: a => `道途 · ${a.n}`,
  achLines: a => [a.d + '：达成', ...(a.unlock || []).map(u => `解锁${{ species: '新蛊', food: '新食物', combo: '进阶杀招', trip: '新秘境', feature: '新玩法' }[u.k] || ''}：${u.n}`)],
  trial: '试玩',
  trialShare: '这是网页试玩存档（模拟元气养的蛊），坐标码、分享卡、战帖和复盘都会标「试玩」。装 VS Code 插件、用真实 token 养的蛊不带这个标。',
  trialFoe: '对方是试玩存档（网页模拟元气养的蛊，不是真实 token 养出来的）',
  trialText: '【试玩存档】',
  srcLive: '实时 token', srcDemo: '模拟元气 ?', srcHead: '元气从哪来',
  srcFrom: '插件读取本机 Claude Code、Codex 等 AI 工具日志里的 token 用量数字，不读对话和代码内容。插件里只认真实 token，不能切到模拟元气。',
  srcNone: '现在没有工具在烧 token，元气暂时不涨。开始写代码就会涨。',
  demoHead: '这里是模拟元气',
  demoFrom: '网页读不到你电脑上的 AI 用量，这里按真实写代码时的常见流速（每秒约 500～1500 token）模拟。上面的「写代码中 / 停手休息」切换模拟状态。',
  demoTrial: '网页存档是试玩存档：分享出去的坐标码、分享卡、战帖和复盘都会标「试玩」，也不能导入插件。',
  demoInstall: '想用真实 token 养蛊，装 VS Code 插件。插件只读本机 Claude Code、Codex 等工具日志里的用量数字，不读对话和代码内容。',
};
const trialTag = on => on ? `<span class="trialtag">${TXT.trial}</span>` : '';

// ---------- 存档 ----------
// v3 = v2 玩法的存档（gu = { uid, sp, rank, atk, hp, food, xing, bonusA?, bonusH? }）。旧版本存档一律不读，启动时另存到 BAK_KEY。
// bank = 元气（token），没有上限；所有价格都是 token 数
const BAK_KEY = 'gucode.v1.bak-v2';
const fresh = () => ({ v: 3, sx: STAT_SCALE, started: false, name: '', realm: 0, bank: 0, total: 0, team: [], bag: [], shop: [], dao: null, compass: null, tripFood: [], pantry: [], trip: null, land: null,
  seed: (Math.random() * 1e9) >>> 0, step: 0, speed: 1, mute: true, theme: 'auto', calm: false, codex: {}, combosSeen: [], log: [], hlog: [], meta: null, todayKey: '', todayTok: 0, sim: null, trial: false, sotaAt: 0 });
const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const curCap = () => SLOTS, BC = () => Math.max(bagCap(S.realm), S.bag.length);
// sx = 存档里的攻血按几倍存的。没有 sx 的是放大十倍之前的存档：空窍、蛊囊、秘境里的血量和战利品蛊一律乘 STAT_SCALE（只做一次）
const scaleGu = (g, k) => { if (!g) return; ['atk', 'hp', 'bonusA', 'bonusH'].forEach(f => { if (typeof g[f] === 'number') g[f] = Math.max(f === 'atk' || f === 'hp' ? 1 : 0, Math.round(g[f] * k)); }); };
function scaleSave(s) {
  if (!s || s.sx === STAT_SCALE) return s;
  const k = STAT_SCALE / (s.sx || 1), t = s.trip;
  (s.team || []).forEach(g => scaleGu(g, k)); (s.bag || []).forEach(g => scaleGu(g, k));
  if (t) {
    ['hp', 'mx'].forEach(f => { if (t[f]) for (const u in t[f]) t[f][u] = Math.max(t[f][u] > 0 ? 1 : 0, Math.round(t[f][u] * k)); });
    [t.loot, t.end && t.end.loot].forEach(l => l && (l.gu || []).forEach(g => scaleGu(g, k)));
  }
  delete s.ghosts; s.sx = STAT_SCALE; return s;
}
const migrate = s => s && s.v === 3 ? scaleSave(s) : null;
const price = k => Math.round(k * src.unit);   // 价格表（core.PRICE，单位 = 罗盘「千」）换成 token 数
let S = fresh(), rate = 0, hot = false, inBattle = false, booted = false, skip = false, resetArm = 0;
const src = new TokenSource(onTick);
const R = () => makeRng(S.seed + ':' + (S.step++));
const M = () => S.meta || (S.meta = metaInit());
const tripOn = () => TRIP.active ? !!TRIP.active(S) : !!S.trip;
let saveT;
function save() {
  if (saveT) return;   // 节流而非防抖：持续有 token 流入时也能按时落盘
  saveT = setTimeout(() => {
    saveT = null; codexScan(); S.seen = Date.now();
    if (VSC) VSC.postMessage({ type: 'save', data: S, status: { started: S.started, where: tripOn() ? (S.trip && S.trip.d != null ? `秘境第 ${(S.trip.d | 0) + 1} 层` : '秘境') : '洞府', qi: S.bank, realm: S.realm } });
    else try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  }, 400);
}
// 蛊典：见过的蛊（终身，跨局保留）
function codexScan() { [...S.team, ...S.bag].forEach(g => { if (!S.codex[g.sp]) S.codex[g.sp] = 1; }); }
// ---------- 声音（默认静音）----------
let AC = null; const KSB = {};
const QIN = [130.8, 146.8, 164.8, 196, 220, 261.6, 293.7, 329.6, 392, 440];   // 宫商角徵羽，两个八度
function ac() { if (!AC) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; AC = new C(); } if (AC.state === 'suspended') AC.resume(); return AC; }
function ksBuf(f) {   // Karplus-Strong 拨弦：噪声入环形缓冲，平均+衰减 ≈ 琴弦
  const k = Math.round(f); if (KSB[k]) return KSB[k];
  const sr = AC.sampleRate, len = Math.floor(sr * 1.8), buf = AC.createBuffer(1, len, sr), d = buf.getChannelData(0), N = Math.max(2, Math.round(sr / f)), ring = new Float32Array(N);
  for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
  for (let i = 0, j = 0; i < len; i++) { const n = (j + 1) % N, v = ring[j]; d[i] = v * (i < 40 ? i / 40 : 1); ring[j] = 0.4985 * (v + ring[n]); j = n; }
  return (KSB[k] = buf);
}
function pluck(f, at = 0, vol = 0.32) { const s = AC.createBufferSource(), g = AC.createGain(), lp = AC.createBiquadFilter(); s.buffer = ksBuf(f); lp.type = 'lowpass'; lp.frequency.value = 2400; g.gain.value = vol; s.connect(lp).connect(g).connect(AC.destination); s.start(AC.currentTime + at); }
function thump(vol = 0.5) {
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + 0.25);
  const len = AC.sampleRate * 0.05, nb = AC.createBuffer(1, len, AC.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const n = AC.createBufferSource(), ng = AC.createGain(), bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; ng.gain.value = vol * 0.35; n.buffer = nb; n.connect(bp).connect(ng).connect(AC.destination); n.start(t);
}
function ding(at = 0, vol = 0.12, f0 = 2350) {   // 钱币：非谐泛音的短促金属声
  const t = AC.currentTime + at;
  [[f0, 1], [f0 * 1.51, 0.6], [f0 * 2.37, 0.35]].forEach(([f, v]) => { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = f; g.gain.setValueAtTime(vol * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + 0.4); });
}
function glitch() { const len = AC.sampleRate * 0.16, b = AC.createBuffer(1, len, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.floor(i / 70) % 2 ? 1 : -1) * Math.random() * (1 - i / len) * 0.45; const s = AC.createBufferSource(), g = AC.createGain(); g.gain.value = 0.22; s.buffer = b; s.connect(g).connect(AC.destination); s.start(); }
function snd(kind) {
  if (S.mute) return;
  try {
    if (!ac()) return;
    if (kind === 'pluck') pluck(QIN[3 + ((Math.random() * 7) | 0)]);
    else if (kind === 'hit') thump(0.45);
    else if (kind === 'faint') pluck(QIN[0], 0, 0.28);
    else if (kind === 'combo') { pluck(QIN[0], 0, 0.4); pluck(QIN[4], 0.05, 0.3); pluck(QIN[7], 0.1, 0.25); glitch(); }
    else if (kind === 'win') [5, 7, 9].forEach((i, k) => pluck(QIN[i], k * 0.14, 0.3));
    else if (kind === 'coin') ding(0);
    else if (kind === 'coins') [0, 0.07, 0.15, 0.26].forEach(t => ding(t));
    else if (kind === 'clack') thump(0.25);
    else if (kind === 'tick') ding(0, 0.06, 1500 + Math.random() * 300);
    else if (kind === 'lose') [6, 3, 0].forEach((i, k) => pluck(QIN[i], k * 0.2, 0.28));
  } catch (e) {}
}
document.addEventListener('pointerdown', () => { if (!S.mute) ac(); }, { once: true });

// ---------- Token 流 → 元气 ----------
let sessTok = 0, bySrc = null;
// bySource 兼容 { claude: 2900 } / { claude: { rate } } / [{ name, rate }] 几种写法
function srcList(bs) {
  if (!bs) return [];
  const arr = Array.isArray(bs) ? bs : Object.entries(bs).map(([k, v]) => typeof v === 'number' ? { name: k, rate: v } : { name: k, ...v });
  return arr.map(x => ({ name: String(x.label || x.name || x.src || x.id || ''), rate: +x.rate || 0 })).filter(x => x.name);
}
// SOTA 彩蛋：插件读到最近 10 分钟内有 Claude 的 token。网页模拟元气永远不算
const SOTA_MS = 600000;
const sotaOn = () => !!VSC && Date.now() - (S.sotaAt || 0) < SOTA_MS;
function countTok(d) { if (!(d > 0)) return; sessTok += d; if (S.todayKey !== today()) { S.todayKey = today(); S.todayTok = 0; } S.todayTok += d; }
function onTick(t) {
  rate = t.rate; hot = t.hot; bySrc = t.bySource || null;
  if (VSC && srcList(bySrc).some(x => /claude/i.test(x.name) && x.rate > 0)) S.sotaAt = Date.now();
  if (!booted) return;
  if (t.delta > 0 && S.started) { countTok(t.delta); feed(t.delta); }
  meters();
}
// 元气进账：洞府里直接存进 S.bank（没有上限）；渡劫中交给秘境（它自己决定先花攒下的元气还是实时的）
function feed(tok) {
  S.total += tok;
  if (tripOn()) { if (TRIP.feed) TRIP.feed(S, tok); }
  else S.bank += tok;
  save();
}
const canPay = k => S.bank >= price(k);
function pay(k) { const n = price(k); if (S.bank < n) { note(TXT.poor(n - S.bank)); return false; } S.bank -= n; return true; }

// ---------- 全屏时刻（只有三种：渡劫成功、成就解锁、杀招第一次成形）：停住等玩家点，一次一个排队 ----------
const BIGQ = []; let bigBusy = false;
function big(kind, title, lines = []) { BIGQ.push({ kind, title, lines }); if (!bigBusy) bigRun(); }
async function bigRun() {
  bigBusy = true;
  while (BIGQ.length) {
    const b = BIGQ.shift();
    const ov = el(`<div class="bigmo big-${b.kind}" role="dialog" aria-modal="true"><div class="bigcard"><p class="eyebrow">${{ trib: '渡劫', ach: '道途', combo: '杀招' }[b.kind] || ''}</p><h2>${esc(b.title)}</h2><ul>${b.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul><button class="zhu big" data-big="ok">知道了</button></div></div>`);
    document.body.appendChild(ov); snd(b.kind === 'trib' ? 'combo' : 'pluck');
    requestAnimationFrame(() => ov.classList.add('in'));
    await new Promise(res => ov.addEventListener('click', e => { if (e.target.closest('[data-big]')) res(); }));
    ov.classList.remove('in'); await sleep(180); ov.remove();
  }
  bigBusy = false;
}
// 原地反馈：洞府战报加一行（留最近 5 行）
function note(txt) { const l = S.hlog || (S.hlog = []); l.push(txt); if (l.length > 5) l.splice(0, l.length - 5); renderLog(); }
function renderLog() { const b = $('#hlog'); if (b) setHTML(b, (S.hlog || []).map((t, i, a) => `<li${i === a.length - 1 ? ' class="new"' : ''}>${esc(t)}</li>`).join('')); }
function achieve(k, n, o) { const got = metaEmit(M(), k, n, o); got.forEach(a => big('ach', TXT.achFirst(a), TXT.achLines(a))); if (got.length) applyLocks(); }
// 道途锁住的进阶杀招不成形（秘境里按自己的道途）；切磋、复盘一律全开，同一个坐标码谁算都一样
const applyLocks = () => setComboLocks(id => unlocked(id, 'combo'));
const allCombos = f => { setComboLocks(); try { return f(); } finally { applyLocks(); } };

// ---------- 渲染 ----------
// 洞府还没接好的食物类别：先不上架，界面写明「下个版本开放」。渡劫用的（trip）秘境一侧已全部接上
const FOOD_READY = { stat: 1, gear: 1, trip: 1 };
const notYet = id => { const f = FOOD[id]; return !f || !FOOD_READY[f.kind]; };
const notYetList = () => FOODS.filter(f => !FOOD_READY[f.kind] && isUnlocked(M(), f.id, 'food')).map(f => f.id);
const unlocked = (id, k) => !(k === 'food' && notYet(id)) && isUnlocked(M(), id, k);
function renderAll() {
  applyLocks();
  const app = $('#app'); if (!app) return;
  app.innerHTML = S.started ? mainHTML() : startHTML();
  if (S.started) { renderHome(); meters(); if (tripOn() && TRIP.render) TRIP.render(TRIP.api); }
  applyCalm();
}
function startHTML() {
  const r = makeRng(S.seed + ':start'), pool = poolFor(0).filter(sp => unlocked(sp, 'species')), picks = [];
  while (picks.length < 3 && pool.length) picks.push(pool.splice(r.int(pool.length), 1)[0]);
  return `<div class="start"><div class="hero"><h1 class="title">蛊码</h1><p class="tag">烧 Token，养蛊，闯秘境。</p>
  <p class="lead">你写代码消耗的每一个 token 都是元气。在洞府里花元气买蛊、合成、喂食、排阵，再带着它们进秘境闯关。在秘境里倒下的蛊永远没了。</p></div>
  <h2 class="step">三选一，领第一只蛊</h2><div class="starters">${picks.map(id => { const s = SP[id], st = statFor(id, 1); return `<button class="starter" data-act="pick" data-sp="${id}"><div class="sart">${guSVG(id)}</div><b>${s.n}</b><span class="sst"><i class="a">${st.atk}</i><i class="h">${st.hp}</i></span><span class="strig">${esc(natDesc(id))}</span><em>${esc(s.lore)}</em></button>`; }).join('')}</div>
  <p class="fine">${VSC ? '插件模式：读取本机 Claude Code / Codex 会话的 token 用量数字（不读内容）。' : '网页版是模拟元气，存档标「试玩」，只存在本机。'}</p></div>`;
}
const natDesc = sp => { const k = natOf(sp); return k && TRAITS[k] ? `被动·${TRAITS[k].n}：${TRAITS[k].d(1, natMulFor(SP[sp].rank))}` : ''; };
// 速、近远程、主动技以战斗引擎为准（battleProfile 里有物种没写时的默认值）
const profOf = g => { try { return battleProfile(g.sp) || {}; } catch (e) { return {}; } };
const spdG = g => g.spd || profOf(g).spd || 100;
const reachG = g => (profOf(g).reach === 'ranged' ? '远程' : '近战');
const actOfG = g => { const a = profOf(g).act; return a && a.n ? { n: a.n, ch: a.n[0], d: a.d || '' } : null; };
// 羁绊以战斗引擎的 synergyOf 为准：line 写在空窍上方；combos[k].idx 是队伍下标，配方从 COMBO 补
const synOf = team => { try { return synergyOf(team); } catch (e) { return { daos: [], combos: [], line: '' }; } };
const combosBy = team => { const m = {}; synOf(team).combos.forEach(c => { m[c.idx] = { ...(COMBO[c.id] || {}), ...c, need: (COMBO[c.id] || {}).need || [c.core] }; }); return m; };
const xingName = k => (XING[k] ? XING[k].n : String(k || ''));
const xingDesc = k => (XING[k] ? XING[k].d : '');
const natOfG = g => { const k = natOf(g.sp); return k && TRAITS[k] ? { n: TRAITS[k].n, ch: TRAITS[k].ch, d: TRAITS[k].d(1, natMulFor(rankOf(g))), aw: awOf(g) } : null; };
function mainHTML() {
  return `<header class="top"><div class="brand"><b class="logo">蛊码</b><span class="sub">烧 Token · 养蛊 · 闯秘境</span></div>
  <div class="tools"><span class="realm" id="realm" data-tip="${esc(`境界：${REALMS[S.realm]}。能驱使${RANK.names[driveCap(S.realm)]}及以下的蛊上阵。本境界的秘境就是这一境界的劫，第一次打赢最深处的首领，境界加一：开放额度更高的秘境，能驱使更高转数的蛊，蛊市进新档，罗盘出新的道。`)}">${REALMS[S.realm]}</span><button class="ib gear" data-act="settings" title="设置" aria-label="设置"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm7.4 4.6.1-1.2-.1-1.2 2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.6 3h-4l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6-.1 1.2.1 1.2-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4z"/></svg></button><button class="ib zhu" data-act="share">战帖</button></div></header>
  <section class="vein"><div class="vread"><div class="vrate" data-tip-fn="qi"><span class="vlab">元气</span><b id="qiTxt">0</b><span id="sota" class="sota" data-tip="${esc(TXT.sota)}" hidden>SOTA</span></div><div class="vtot"><span id="totTxt"></span><button class="chip" data-act="src" id="srcTag"></button></div></div><div class="vsrc" id="srcRates" hidden></div></section>
  <div class="seg" id="demo">${[['coding', '写代码中'], ['rest', '停手休息']].map(([m, t]) => `<button data-act="demo" data-m="${m}">${t}</button>`).join('')}</div>
  <section class="home" id="home"></section>
  <section class="trip" id="trip"></section>
  <footer class="foot"><button data-act="duelInput">粘贴坐标码应战</button><button data-act="tryOpen">试阵</button><button data-act="codex">蛊典</button><button data-act="path">道途</button><button data-act="ledger">履历</button><button data-act="reset" id="bReset">重开一局</button></footer>`;
}
// 卡面只放攻、血、速三个数，加被动技、主动技两个小印（没有主动技就不显示）；杀招成形时右上角亮朱印
// 食物小图（art-food.js）：名字旁边都配图；fi(id) 行内小图，gearHTML(g) 蛊卡左下角的挂件小印
const fi = id => `<span class="fi">${foodSVG(id)}</span>`;
const gearHTML = g => (g && g.food && FOOD[g.food] ? `<span class="gear" title="${esc('挂件「' + FOOD[g.food].n + '」：' + FOOD[g.food].d)}">${foodSVG(g.food)}</span>` : '');
const dzHTML = sp => { const c = daoChar(sp); return c ? `<span class="dz" style="--dc:${daoColor(sp)}">${esc(c)}</span>` : ''; };
function guCard(g, combo) {
  const nat = natOfG(g), act = actOfG(g), k = cellOf(g), over = rankOf(g) > driveCap(S.realm);
  return `<button class="gu${over ? ' over' : ''}" data-act="gu" data-uid="${g.uid}" data-drag="${k}" data-tip-fn="gu">
  <span class="art">${guSVG(g.sp, { rank: rankOf(g) })}</span><span class="rk rk${rankOf(g)}">${RANK.ch[rankOf(g)]}</span>${combo ? `<span class="mseal">${esc(combo.n[0])}</span>` : ''}${dzHTML(g.sp)}${gearHTML(g)}
  <span class="nm">${SP[g.sp].n}</span><span class="st"><i class="a">${g.atk}</i><i class="h">${g.hp}</i><i class="v">${spdG(g)}</i></span>
  <span class="tr">${nat ? `<span class="tc nat">${esc(nat.ch)}</span>` : ''}${act ? `<span class="tc act">${esc(act.ch)}</span>` : ''}</span></button>`;
}
function renderHome() {
  const box = $('#home'); if (!box) return;
  const t = tripOn();
  box.classList.toggle('away', t);
  const land = curLand(), used = quotaOf(S.team), why = goWhy(land);
  box.innerHTML = `<div class="hhead"><span class="lbl" data-tip="${esc(TXT.daoTip)}">${S.dao ? TXT.daoLine(S.dao) : TXT.daoNone}</span></div><div id="reso" class="reso"></div>
  <section class="qiao" id="qiao"><button class="landbtn" data-act="lands"${t ? ' disabled' : ''}><span class="lbl">秘境</span><b>${esc(land.n)}${kalpaOf(land) ? ` · ${esc(jieName(kalpaOf(land)))}` : ''}</b><small>${esc(TXT.landLine(land))}</small><span class="lchg">${t ? '渡劫中' : '换秘境'}</span></button>
  <div class="qhead"><span class="lbl">${TXT.slotsHead} <small>${TXT.slotsSub}</small></span><span class="qmeta quota${used > land.quota ? ' over' : ''}" data-tip="${esc(TXT.quotaTip(used, land.quota) + '\n' + TXT.driveTip())}">已用 ${used} / 额度 ${land.quota}</span>${t ? '' : `<button class="trybtn" data-act="tryOpen" data-tip="${esc(TXT.tryTip)}">${TXT.tryName}</button>`}</div><div class="slots" id="slots"></div>
  <div class="bagline" id="bagline"></div></section>
  <ul class="hlog" id="hlog"></ul>
  ${t ? `<p class="hint">${TXT.inTrip}</p>` : S.compass ? compassHTML() : `<section class="shop" id="shop"></section>`}
  ${t ? '' : `<div class="gorow"><button class="trygo" data-act="tryOpen"${S.team.length ? '' : ' disabled'}>${TXT.tryGo}</button><button class="zhu big go" data-act="go"${why ? ' disabled' : ''}>${TXT.go} · ${esc(land.n)}<small>${esc(why || TXT.goSub(S.team.length, land))}</small></button></div>${(() => { const L = gainLines(previewOf(land)); return L.length ? `<p class="gainline">${esc(TXT.gainLine(L))}</p>` : ''; })()}`}`;
  renderSlots(); renderBagLine(); renderShop(); renderReso(); renderLog();
}
// 阵盘：3 行 × 3 列，屏幕上从左到右是 后、中、前（前列朝向敌人）。9 格随便摆；能带几只看秘境额度（转数总和）
function renderSlots() {
  const box = $('#slots'); if (!box) return;
  autoPlace(S.team);
  const combos = combosBy(S.team), byUid = {}; S.team.forEach((g, i) => { byUid[g.uid] = combos[i]; });
  const at = {}; S.team.forEach(g => { at[cellOf(g)] = g; });
  let h = `<span class="bcol">${COL_NAMES[2]}</span><span class="bcol">${COL_NAMES[1]}</span><span class="bcol">${COL_NAMES[0]} <small>敌在右</small></span>`;
  for (let r = 0; r < 3; r++) for (const c of [2, 1, 0]) { const k = r * 3 + c, g = at[k]; h += g ? guCard(g, byUid[g.uid]) : `<div class="gu empty" data-drag="${k}"><span>空</span></div>`; }
  box.innerHTML = h; box.dataset.sort = 'team'; box.dataset.group = 'main'; box.classList.add('board');
}
function renderBagLine() {
  const b = $('#bagline'); if (!b) return;
  b.innerHTML = `<div class="bhead" data-tip-fn="bag"><span class="lbl">${TXT.bagHead} <small>${TXT.bagSub}</small></span><span class="qmeta">${S.bag.length}/${BC()}</span></div>
  <div class="mini bagrow" data-sort="bag" data-group="main">${Array.from({ length: BC() }, (_, i) => { const g = S.bag[i]; return g ? `<div class="mg" data-drag="${i}" data-act="bagGu" data-i="${i}" data-tip-fn="bg"><span class="art">${guSVG(g.sp, { rank: rankOf(g) })}</span><span class="rk rk${rankOf(g)}">${RANK.ch[rankOf(g)]}</span>${dzHTML(g.sp)}${gearHTML(g)}<b>${SP[g.sp].n}</b><span class="st"><i class="a">${g.atk}</i><i class="h">${g.hp}</i></span></div>` : `<div class="mg empty" data-drag="${i}"></div>`; }).join('')}</div>`;
}
// 道共鸣和杀招常驻在空窍上方（reso.js，秘境队伍上方用同一套）
function renderReso() {
  const r = $('#reso'); if (!r) return;
  setHTML(r, resoHTML(S.team, { empty: S.team.length ? '' : TXT.resoNone }) || `<div class="reso2"><span class="rz none">${esc(TXT.resoNone)}</span></div>`);
}
// ---------- 罗盘：回到洞府时三选一，选中的道在这一轮蛊市里多出 5% ----------
function rollCompass() { const r = R(), ids = DAOS.map(d => d.id), out = []; while (out.length < 3 && ids.length) out.push(ids.splice(r.int(ids.length), 1)[0]); S.compass = out; }
function compassHTML() {
  return `<section class="compass2"><div class="ch"><span class="lbl">${TXT.compassHead}</span></div><p class="sm">${TXT.compassSub}</p><div class="dopts">${S.compass.map(id => { const d = DAO[id], sp = shopSpeciesOf(id); return `<button class="dopt" data-act="dao" data-d="${id}"><b>${d.n}</b><small>${esc(d.d)}</small><span class="dsp">${sp.slice(0, 4).map(x => `<i>${guSVG(x)}</i>`).join('')}</span><em>共鸣：${esc(d.r2.d)}</em></button>`; }).join('')}</div></section>`;
}
const shopSpeciesOf = d => poolFor(S.realm).filter(sp => SP[sp] && !SP[sp].immortal && daoOf(sp) === d && unlocked(sp, 'species'));
// ---------- 蛊市 ----------
function newShop() { S.shop = rollShop(R(), S.realm, S.dao, S.shop, unlocked); }
const owned = sp => [...S.team, ...S.bag].filter(g => g.sp === sp && rankOf(g) === baseRank(sp)).length;
function wareHTML(w, i) {
  if (w.kind === 'food') {
    const f = FOOD[w.id], c = price(foodCost(w.id));
    return `<div class="ware food${w.frozen ? ' frozen' : ''}${w.sold ? ' sold' : ''}"><button class="wbuy" data-act="ware" data-i="${i}" data-tip-fn="ware"${w.sold ? ' disabled' : ''}><span class="fart">${foodSVG(w.id)}</span><b>${esc(f.n)}</b><small>${FOOD_KIND[f.kind]}</small><span class="tag">${w.sold ? '已购' : fmtTok(c)}</span></button></div>`;
  }
  const s = SP[w.sp], st = statFor(w.sp, baseRank(w.sp)), c = price(PRICE.gu), merge = !w.sold && owned(w.sp) >= 2, gain = !w.sold && !merge ? resoGain(S.team, w.sp) : null;
  return `<div class="ware${w.frozen ? ' frozen' : ''}${w.sold ? ' sold' : ''}${merge ? ' merge' : ''}"><button class="wbuy" data-act="ware" data-i="${i}" data-tip-fn="ware"${w.sold ? ' disabled' : ''}><span class="art">${guSVG(w.sp)}</span>${dzHTML(w.sp)}<b>${s.n}</b><span class="st"><i class="a">${st.atk}</i><i class="h">${st.hp}</i></span><span class="tag">${w.sold ? '已购' : (merge ? '合成 · ' : '') + fmtTok(c)}</span>${merge ? '<span class="fu">可合成</span>' : gain ? `<span class="fu rzg">${TXT.resoGain}</span>` : ''}</button></div>`;
}
function renderShop() {
  const box = $('#shop'); if (!box) return;
  if (!S.shop.length) newShop();
  box.innerHTML = `<div class="shead"><span class="lbl" data-tip="${esc(TXT.shopTip)}">${TXT.shopHead}</span><button class="mini-b" data-act="refresh">${TXT.refresh(fmtTok(price(PRICE.refresh)))}</button></div>
  <div class="wares">${S.shop.map(wareHTML).join('')}</div>${S.pantry.length ? `<div class="pantry"><span class="lbl">带回的食物</span>${S.pantry.map((id, i) => `<button class="pfood" data-act="pantry" data-i="${i}" data-tip="${esc(FOOD[id] ? FOOD[id].d + (notYet(id) ? '\n' + TXT.tripLocked : '') : '')}"${notYet(id) ? ' disabled' : ''}>${fi(id)}${esc(FOOD[id] ? FOOD[id].n : id)}</button>`).join('')}</div>` : ''}${(() => { const l = notYetList(); return l.length ? `<p class="sm tlocked" data-tip="${esc(l.map(id => `${FOOD[id].n}：${FOOD[id].d}`).join('\n'))}">${esc(TXT.tripLockedLine(l.map(id => '「' + FOOD[id].n + '」').join('')))}</p>` : ''; })()}${S.tripFood.length ? `<p class="sm">下一次渡劫带着：${S.tripFood.map(id => fi(id) + esc(FOOD[id] ? FOOD[id].n : id)).join('、')}</p>` : ''}`;
}
// 新得一只蛊：能合成先合成；蛊市买的先进空窍再进蛊囊；战利品只进蛊囊
function placeNew(g, mode = 'shop') {
  if (mode === 'shop' && rankOf(g) > driveCap(S.realm)) mode = 'bag';   // 驱使不了的只进蛊囊
  const r = placeGu(S.team, S.bag, g, curCap(), BC(), mode);
  if (!r.where) return false;
  if (r.where === 'bag' && !r.merged.length) note(TXT.toBag(g));
  r.merged.forEach(x => { note(TXT.merge(x)); achieve('merges', 1); });
  afterChange(r.merged);
  return true;
}
// 阵容变了：重画；新成形的杀招第一次出现时全屏；合成播升转演出
function afterChange(merged = []) {
  renderHome(); save();
  const combos = combosBy(S.team), seen = S.combosSeen || (S.combosSeen = []);
  Object.entries(combos).forEach(([i, c]) => { if (!seen.includes(c.id)) { seen.push(c.id); big('combo', TXT.comboFirst(c), TXT.comboLines(c, S.team[i])); achieve('combos', 1); } });
  merged.forEach(x => { const n = document.querySelector(`.gu[data-uid="${x.uid}"]`); if (n) { try { fuseRankUp(n, { sp: x.sp, from: rankOf(x) - 1, to: rankOf(x), calm: !!S.calm }); } catch (e) {} } });
  floorCheck();
  if ([...S.team, ...S.bag].some(x => x.xingAsk)) setTimeout(askXing, merged.length ? 900 : 0);
}
// 合成时三只材料带着不同的蛊性：挑一个传给新蛊（没挑之前先带着第一个；关掉不选就留着它）
function askXing() {
  const g = [...S.team, ...S.bag].find(x => x.xingAsk && x.xingAsk.length > 1); if (!g || tripOn()) return;
  if (document.querySelector('.bigmo, .sheet-bg, #battle')) { setTimeout(askXing, 800); return; }
  sheet(`<h3>${esc(TXT.xingAsk(g))}</h3><p class="sm">${esc(TXT.xingAskSub)}</p><div class="xpick">${g.xingAsk.map(k => `<button class="${k === g.xing ? 'zhu' : ''}" data-act="xingPick" data-uid="${g.uid}" data-k="${esc(k)}"><b>${esc(xingName(k))}</b><small>${esc(xingDesc(k))}</small></button>`).join('')}</div>`, 'xask');
  delete g.xingAsk; save();   // 只问一次：关掉就留着现在这个
}
// 保底：洞府里一只蛊都没有时，免费领一只一转蛊
function floorCheck() {
  if (S.team.length || S.bag.length || tripOn() || !S.started) return;
  const pool = poolFor(0).filter(sp => unlocked(sp, 'species')), g = newGu(R().pick(pool), 1);
  S.team.push(g); note(TXT.floor(g)); renderHome(); save();
}
// ---------- 食物 ----------
let FEED = null;   // 正在挑目标的食物 { id, from: 'shop'|'pantry', i }
function useFood(id, from, i) {
  const f = FOOD[id]; if (!f) return false;
  if (notYet(id)) { note(`「${f.n}」${TXT.tripLocked}`); return false; }
  if (f.kind === 'trip') { S.tripFood.push(id); note(TXT.tripFood(f)); achieve('feeds', 1); return true; }
  if (f.kind === 'stat' && f.to !== 'one') {
    const can = S.team.filter(canEat); if (!can.length) { note(TXT.ateFull); return false; }
    const r = R(), tg = f.to === 'all' ? can : can.sort(() => r() - 0.5).slice(0, 2);
    feedStat(id, tg); note(TXT.fed(f, tg)); tg.forEach(g => fxFloat(g.uid, `+${f.atk || 0}/+${f.hp || 0}`, 'buff')); achieve('feeds', 1); return true;
  }
  FEED = { id, from, i };
  sheet(`<div class="fhead"><span class="fbig">${foodSVG(f.id)}</span><div><h3>${esc(f.kind === 'gear' ? TXT.gearPick(f) : TXT.foodPick(f))}</h3><p class="sm">${esc(f.d)}</p></div></div><div class="mini pick">${[...S.team, ...S.bag].map((g, k) => `<button class="mg" data-act="feedTo" data-k="${k}"${f.kind === 'stat' && !canEat(g) ? ' disabled' : ''}><span class="art">${guSVG(g.sp, { rank: rankOf(g) })}</span><b>${SP[g.sp].n}</b><span class="st"><i class="a">${g.atk}</i><i class="h">${g.hp}</i></span>${f.kind === 'stat' ? `<small>${canEat(g) ? `已吃 ${ateOf(g)}/${ATE_MAX}` : '吃满了'}</small>` : g.food ? `<small>${fi(g.food)}挂着${esc(FOOD[g.food] ? FOOD[g.food].n : '')}</small>` : ''}</button>`).join('')}</div>`);
  return null;   // 等玩家挑
}
function feedTo(g) {
  const f = FEED && FOOD[FEED.id]; if (!f || !g) return;
  if (f.kind === 'stat' && !canEat(g)) { note(TXT.ateNo(g)); return; }
  const fr = FEED; FEED = null;
  if (fr.from === 'shop') { const w = S.shop[fr.i]; if (!w || w.sold || !pay(foodCost(w.id))) { closeSheet(); return; } w.sold = true; w.frozen = false; }
  else S.pantry.splice(fr.i, 1);
  if (f.kind === 'gear') { g.food = f.id; note(TXT.geared(f, g)); }
  else { feedStat(f.id, [g]); note(TXT.fed(f, [g])); }
  achieve('feeds', 1); closeSheet(); renderHome(); save(); fxFloat(g.uid, f.kind === 'gear' ? f.n : `+${f.atk || 0}/+${f.hp || 0}`, 'buff');
}
// ---------- 选秘境：额度、敌人主道、首领阵容（秘境列表由秘境侧给 TRIP.lands；没给时用下面的占位表）----------
const LAND_NAMES = [['竹海', '石林', '雾泽'], ['赤岩', '寒潭', '断崖'], ['火窟', '沙洲', '古渡'], ['雷谷', '冰原', '天坑'], ['血沼', '骨林', '玄洞'], ['星墟', '云台', '归墟']];
let lands0;
const LANDS0 = () => lands0 || (lands0 = QUOTA.flatMap((q, r) => LAND_NAMES[r].slice(0, 2).map((n, k) => {
  const dao = DAOS[(r * 2 + k) % DAOS.length].id, id = `l${r}${k}`;
  return { id, n, realm: r, quota: q, dao, boss: quotaTeam(makeRng('land:' + id), q + 2 + r, { dao }).map(g => ({ ...g, boss: 1 })), d: '' };
})));
const lands = () => (TRIP.lands && TRIP.lands.length ? TRIP.lands : LANDS0());
const landById = id => lands().find(l => l.id === id);
const landOpen = l => l.realm <= S.realm && unlocked(l.id, 'trip');
const curLand = () => { const l = landById(S.land); return l && landOpen(l) ? l : lands().find(x => x.realm === S.realm && landOpen(x)) || lands().find(landOpen) || lands()[0]; };
const bossOf = l => (l.boss || []).map(b => (b.atk ? b : { ...newGu(b.sp, b.rank), ...b }));
// 劫数（秘境一侧 TRIP.kalpa / TRIP.preview）：道途点亮「渡劫之后」才显示；每个秘境选的第几劫记在 S.landK[秘境 id]
const kalpaOn = () => unlocked('kalpa', 'feature');
const kalpaMax = l => (kalpaOn() && TRIP.kalpa && TRIP.kalpa.open ? TRIP.kalpa.open(S, l.id) | 0 : 0);
const kalpaOf = l => Math.max(0, Math.min(kalpaMax(l), ((S.landK || {})[l.id]) | 0));
const jieName = k => (k && TRIP.kalpa && TRIP.kalpa.names ? TRIP.kalpa.names[k] : TXT.jieNormal);
// 进秘境前就能看的：天象、首领（名字、机制、阵容）、劫数规则、渡劫成功可得。同一种子进去后一模一样
const previewOf = (l, k = kalpaOf(l)) => { try { return TRIP.preview ? TRIP.preview(S, l.id, k) : null; } catch (e) { return null; } };
const gainLines = pv => (pv && pv.reward && pv.reward.lines ? pv.reward.lines : []);
const gainHTML = pv => { const L = gainLines(pv); return L.length ? `<div class="gain"><span class="lbl">${TXT.gainHead}</span><ul>${L.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''; };
// 渡劫前的检查：空窍不能空、转数总和不超过额度、每只都在驱使上限内。返回原因（能渡劫时返回空）
function goWhy(land = curLand()) {
  if (!S.team.length) return TXT.whyEmpty;
  const used = quotaOf(S.team); if (used > land.quota) return TXT.whyQuota(used, land.quota);
  const over = S.team.find(g => rankOf(g) > driveCap(S.realm)); if (over) return TXT.whyDrive(over);
  return '';
}
function landCard(l, lock) {
  const on = !lock && l.id === curLand().id, pv = lock ? null : previewOf(l), boss = pv ? pv.boss.team.map(b => (b.atk ? b : { ...newGu(b.sp, b.rank), ...b })) : bossOf(l);
  const km = lock ? 0 : kalpaMax(l), k = kalpaOf(l);
  return `<div class="land${on ? ' on' : ''}${lock ? ' lock' : ''}"><div class="lh"><b>${esc(l.n)}</b><small>${esc(TXT.landLine(l))}${l.realm <= S.realm && !unlocked(l.id, 'trip') ? ' · 道途解锁' : ''}</small></div>${l.d ? `<p class="sm">${esc(l.d)}</p>` : ''}
  ${pv ? `<p class="sm"><span class="lbl">${TXT.skyHead}</span> <b>${esc(pv.sky.n)}</b> ${esc(pv.sky.d)}</p>` : ''}
  <details><summary>首领${pv ? `「${esc(pv.boss.n)}」` : '阵容'} · ${boss.length} 只，转数共 ${quotaOf(boss)}</summary>${pv && pv.boss.mechs.length ? `<ul class="mechs">${pv.boss.mechs.map(m => `<li><b>${esc(m.n)}</b> ${esc(m.d)}</li>`).join('')}</ul>` : ''}${miniRow(boss)}</details>
  ${km ? `<div class="jie"><span class="lbl">${TXT.jieHead}</span><div class="segs">${Array.from({ length: km + 1 }, (_, i) => `<button data-act="jie" data-id="${esc(l.id)}" data-k="${i}" class="${i === k ? 'on' : ''}">${esc(jieName(i))}</button>`).join('')}</div>${pv && pv.kalpa.rules.length ? `<p class="sm">${esc(pv.kalpa.rules.join('；'))}</p>` : `<p class="sm">${esc(TXT.jieSub)}</p>`}</div>` : ''}
  ${gainHTML(pv)}
  ${lock ? '' : `<button class="${on ? '' : 'zhu'}" data-act="land" data-id="${esc(l.id)}"${on ? ' disabled' : ''}>${on ? '已选' : '选这个'}</button>`}</div>`;
}
function openLands() {
  const all = lands(), top = Math.min(5, S.realm + 1);
  sheet(`<h3>${TXT.landsHead}</h3><p class="sm">${esc(TXT.landsSub)}</p>${REALMS.slice(0, top + 1).map((rn, r) => {
    const ls = all.filter(l => l.realm === r), lock = r > S.realm; if (!ls.length) return '';
    return `<h4>${rn} · 额度 ${ls[0].quota}${lock ? ` <small>${esc(TXT.landLock)}</small>` : ''}</h4>${ls.map(l => landCard(l, lock || !unlocked(l.id, 'trip'))).join('')}`;
  }).join('')}`, 'lands');
}
// ---------- 渡劫（秘境由另一侧实现，见 hooks.js）----------
function goSheet() {
  const land = curLand();
  sheet(`<h3>${TXT.go} · ${esc(land.n)}</h3><p class="sm">${esc(TXT.landLine(land))} · 已用 ${quotaOf(S.team)}</p><p>${esc(TXT.goSub(S.team.length, land))}：</p>${miniRow(S.team)}${(() => { const pv = previewOf(land); return pv ? `<p class="sm"><span class="lbl">${TXT.skyHead}</span> <b>${esc(pv.sky.n)}</b> ${esc(pv.sky.d)}${kalpaOf(land) ? ` · ${esc(jieName(kalpaOf(land)))}` : ''}</p><details><summary>最深处的首领「${esc(pv.boss.n)}」</summary>${pv.boss.mechs.length ? `<ul class="mechs">${pv.boss.mechs.map(m => `<li><b>${esc(m.n)}</b> ${esc(m.d)}</li>`).join('')}</ul>` : ''}${miniRow(pv.boss.team.map(b => (b.atk ? b : { ...newGu(b.sp, b.rank), ...b })))}</details>${gainHTML(pv)}` : `<details><summary>最深处的首领</summary>${miniRow(bossOf(land))}</details>`; })()}<p class="trialnote">${esc(TXT.goWarn)}</p><p class="sm">攒着的元气 ${fmtTok(S.bank)}：渡劫时先用它一口气往深处走。</p><div class="row2"><button class="zhu big" data-act="goConfirm">开始渡劫</button></div>`);
}
function onTripEnd(result = {}) {
  const dead = new Set(result.dead || []), loot = result.loot || {}, land = landById(S.trip && S.trip.land);
  const went = S.team.slice(), end = (S.trip && S.trip.end) || {};
  const lost = S.team.filter(g => dead.has(g.uid));
  S.team = S.team.filter(g => !dead.has(g.uid));
  lost.forEach(g => note(`${rankName(g)} 倒在了秘境里`));
  if (!result.wiped) {
    (loot.foods || []).forEach(id => { if (FOOD[id]) S.pantry.push(id); });
    (loot.gu || []).forEach(g => { const n = g && SP[g.sp] ? newGu(g.sp, rankOf(g)) : null; if (n && g.xing) n.xing = g.xing; if (n && !placeNew(n, 'bag')) note(`${rankName(n)} 没地方放，留在了秘境`); });
    if ((loot.foods || []).length || (loot.gu || []).length) note(`带回战利品：${[...(loot.gu || []).map(g => SP[g.sp] ? SP[g.sp].n : ''), ...(loot.foods || []).map(id => FOOD[id] ? FOOD[id].n : '')].filter(Boolean).join('、')}`);
  } else note('全灭：这次的战利品全部丢失');
  S.trip = null; S.tripFood = [];
  achieve('trips', 1);
  if (result.cleared) clearEvents({ quota: land ? land.quota : 0, ranks: went.map(g => (SP[g.sp] && SP[g.sp].immortal ? 6 : rankOf(g))), daos: went.map(g => daoOf(g.sp)),
    fallen: dead.size + (end.saved || []).length, combos: synOf(went).combos.length, kalpa: result.kalpa || end.kalpa || 0, cnt: M().cnt }).forEach(([k, n, set]) => achieve(k, n, { set }));
  if (result.cleared && (!land || land.realm === S.realm) && S.realm < 5) { S.realm++; S.land = (lands().find(l => l.realm === S.realm) || {}).id || S.land; big('trib', TXT.trib(S.realm), TXT.tribLines(S.realm)); achieve('realm', S.realm, { set: true }); }
  rollCompass(); S.shop = S.shop.filter(w => w.frozen && !w.sold);
  renderAll(); save(); floorCheck();
}
// 进战斗前按阵盘摆好（复制一份，没位置的按 前列→中列→后列 自动摆），引擎读 g.pos
const placed = t => autoPlace((t || []).map(g => ({ ...g, pos: g.pos ? { ...g.pos } : null })));
// 给秘境复用的战斗回放：返回 Promise<{ res, A, B }>
function tripPlayBattle(foeTeam, opts = {}) {
  const team = opts.team || S.team, seed = opts.seed || ((S.seed ^ Math.imul(++S.step, 2654435761)) >>> 0).toString(36);
  const sota = { A: sotaOn(), B: false };
  const res = battle(placed(team), placed(foeTeam), 'r:' + seed, { ...(opts.oa || {}), sota });
  const A = { team, name: S.name || '无名蛊师', realm: S.realm, trial: S.trial }, B = { team: foeTeam, name: opts.foeName || '秘境', realm: S.realm };
  return new Promise(resolve => runBattle({ kind: 'trip', title: opts.title || '秘境 · 斗蛊', res, A, B, sota, done: () => resolve({ res, A, B }) }));
}
TRIP.api = { S: () => S, save, unlocked: (id, k) => unlocked(id, k), synLine: (team, o) => resoHTML(team, o || {}), get el() { return $('#trip'); }, playBattle: tripPlayBattle, onTripEnd, big, note, float: (uid, t, k) => fxFloat(uid, t, k || 'buff'), renderHome };
function meters() {
  if (!S.started) return;
  const q = $('#qiTxt'); if (!q) return;
  q.textContent = fmtTok(S.bank);
  const so = $('#sota'); if (so) so.hidden = !sotaOn();
  $('#totTxt').innerHTML = `元气 +<b>${rate > 0 ? fmtTok(rate) : 0}</b>/s · 今日 <b>${fmtTok(S.todayKey === today() ? S.todayTok : 0)}</b>`;
  const sr = $('#srcRates'), sl = srcList(bySrc); sr.hidden = sl.length < 2;
  if (sl.length >= 2) setHTML(sr, sl.map(x => `<span class="schip${x.rate > 0 ? '' : ' off'}">${esc(x.name)} <b>${fmtTok(x.rate)}/s</b></span>`).join(''));
  const st = $('#srcTag'); st.textContent = VSC ? TXT.srcLive : TXT.srcDemo; st.classList.toggle('demo', !VSC);
  const dm = $('#demo'); dm.hidden = !!VSC || src.mode !== 'demo'; dm.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === src.demo));   // 插件里永远不显示模拟开关
  document.querySelectorAll('.wbuy .tag').forEach(t => { const w = S.shop[+t.closest('.wbuy').dataset.i]; if (w && !w.sold) t.classList.toggle('poor', S.bank < price(w.kind === 'food' ? foodCost(w.id) : PRICE.gu)); });
}
// ---------- 主题：自动跟随系统 / VS Code，或手动日、夜 ----------
let veinRGB = '111,183,164';
function applyTheme() {
  const pref = S.theme || 'auto'; let t = pref;
  if (pref === 'auto') {
    const b = document.body ? document.body.classList : { contains: () => false };
    t = VSC ? ((b.contains('vscode-light') || b.contains('vscode-high-contrast-light')) ? 'light' : 'dark') : (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  }
  document.documentElement.dataset.theme = t; veinRGB = t === 'light' ? '44,110,94' : '111,183,164';
  applyCalm();
}
if (window.matchMedia) { const mq = matchMedia('(prefers-color-scheme: light)'); if (mq.addEventListener) mq.addEventListener('change', applyTheme); }
// ---------- 灵脉（青绿字符流）----------
const VP = []; let vLast = 0, vAcc = 0;
function veinLoop(ts) {
  requestAnimationFrame(veinLoop);
  const cv = $('#vein'); if (!cv) return;
  const dt = Math.min(0.05, (ts - vLast) / 1000 || 0); vLast = ts;
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const lvl = rate > 0 ? Math.min(1, rate / (src.hotTh * 1.3)) : 0;
  vAcc += (rate > 0 ? 5 + 55 * lvl : 0) * dt;
  while (vAcc >= 1) { vAcc--; VP.push({ x: -8, y: 4 + Math.random() * Math.max(8, h - 10), c: '0123456789abcdef{}<>=;:/'[(Math.random() * 24) | 0], a: 0.25 + Math.random() * 0.6, z: hot && Math.random() < 0.18, v: 0.7 + Math.random() * 0.6 }); }
  const sp = 24 + 170 * lvl;
  ctx.font = '10px ui-monospace,Menlo,monospace';
  for (let i = VP.length - 1; i >= 0; i--) {
    const p = VP[i]; p.x += sp * p.v * dt + (rate > 0 ? 0 : 6 * dt);
    if (p.x > w + 10) { VP.splice(i, 1); continue; }
    ctx.fillStyle = p.z ? `rgba(200,70,48,${p.a})` : `rgba(${veinRGB},${p.a})`; ctx.fillText(p.c, p.x, p.y + 4);
  }
  ctx.fillStyle = `rgba(${veinRGB},.18)`; ctx.fillRect(0, h - 1, w, 1);
}

// ---------- 浮字、印章、震屏 ----------
function fxFloat(uid, txt, k, blk) {
  const n = document.querySelector(`[data-uid="${uid}"]`); if (!n || (!txt && !blk)) return;
  const r = n.getBoundingClientRect();
  const f = el(`<span class="float ${k || ''}">${esc(txt)}${blk ? `<em>挡${blk}</em>` : ''}</span>`);
  f.style.left = (r.left + r.width / 2 + (Math.random() * 16 - 8)) + 'px'; f.style.top = (r.top + r.height * 0.35) + 'px';
  f.style.setProperty('--rot', (Math.random() * 14 - 7).toFixed(1) + 'deg');
  document.body.appendChild(f); setTimeout(() => f.remove(), 1100);
}
function stampIn(host, text, big, cls = '') {
  if (!host) return;
  const s = el(`<div class="stamp ${big ? 'big' : ''} ${cls}"><span>${esc(text)}</span></div>`);
  host.appendChild(s); setTimeout(() => s.classList.add('out'), big ? 1150 : 1500); setTimeout(() => s.remove(), big ? 1600 : 2000);
}
function shake(px) { if (S.calm) px = Math.min(px, 1.5); const a = $('#arena'); if (a) a.animate([{ transform: 'none' }, { transform: `translate(${px}px,${-px / 2}px)` }, { transform: `translate(${-px}px,${px / 3}px)` }, { transform: `translate(${px / 2}px,0)` }, { transform: 'none' }], { duration: 240 }); }
function buHTML(uid, r) {
  const k = r.tr ? Object.keys(r.tr)[0] : null, t = k && TRAITS[k];
  return `<div class="bu${r.side ? ' foe' : ''}${r.boss ? ' boss' : ''}" data-uid="${uid}"><div class="bart">${guSVG(r.sp)}</div><div class="binfo"><b class="bnm">${esc(r.name)}</b><span class="bst"><i class="a"></i><i class="h"></i><i class="s" hidden></i></span><span class="btr">${t ? `<span class="tc nat">${esc(t.ch)}</span>` : ''}</span>${r.combo ? `<em class="cs">${esc(r.combo)}</em>` : ''}</div></div>`;
}
function applySnap(s, ros) {
  const first = new Map(); document.querySelectorAll('#arena .bu').forEach(n => first.set(n.dataset.uid, n.getBoundingClientRect()));
  [0, 1].forEach(side => {
    const box = side ? $('#sideB') : $('#sideA'), ids = s[side].map(x => x[0]);
    box.querySelectorAll('.bu').forEach(n => { if (!ids.includes(n.dataset.uid)) n.remove(); });
    s[side].forEach(([uid, a, h, sh], i) => {
      let n = box.querySelector(`[data-uid="${uid}"]`);
      if (!n) { n = el(buHTML(uid, ros[uid])); if (booted && inBattle && first.size) n.classList.add('born'); }
      if (box.children[i] !== n) box.insertBefore(n, box.children[i] || null);
      n.querySelector('.a').textContent = a; n.querySelector('.h').textContent = h;
      const sn = n.querySelector('.s'); sn.textContent = sh || ''; sn.hidden = !sh;
    });
  });
  document.querySelectorAll('#arena .bu').forEach(n => {
    const r0 = first.get(n.dataset.uid); if (!r0) return; const r1 = n.getBoundingClientRect(), dx = r0.left - r1.left, dy = r0.top - r1.top;
    if (Math.abs(dx) + Math.abs(dy) > 2) n.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 280 / S.speed, easing: 'cubic-bezier(.2,.8,.2,1)' });
  });
}
const bnode = uid => document.querySelector(`#arena [data-uid="${uid}"]`);
function blog(t) { const b = $('#blog'); if (b) b.textContent = t; }
let tempo = 1, chain = { side: -1, n: 0 }, finalBlow = null, dispK = 1;
function showChain(n, side) {
  const a = $('#arena'); if (!a) return; const old = a.querySelector('.chain'); if (old) old.remove();
  const c = el(`<span class="chain ${side ? 'foe' : ''}" style="font-size:${Math.min(64, 30 + n * 4)}px">${n} 连！</span>`); a.appendChild(c); setTimeout(() => c.remove(), 900);
  snd('tick');
}
// 杀招招牌演出：宣纸横幅滑入、招名逐字落墨、朱印砸下、轻震屏
async function comboCut(name, node, r) {
  const total = EV_MS.combo * tempo / S.speed, chars = [...name];
  if (node) node.classList.add('caster');
  const cut = el(`<div class="cut" style="--d:${(total / 1000).toFixed(2)}s"><div class="band"><span class="cby">${esc(r ? r.name : '')} · 杀招</span><span class="cname">${chars.map((c, i) => `<i style="animation-delay:${Math.round(total * (0.14 + i * 0.07))}ms">${esc(c)}</i>`).join('')}</span></div><span class="cseal" style="animation-delay:${Math.round(total * (0.18 + chars.length * 0.07))}ms"><b>${esc(chars[0])}</b></span><span class="ink" style="animation-delay:${Math.round(total * (0.18 + chars.length * 0.07))}ms"></span></div>`);
  $('#battle').appendChild(cut); snd('combo');
  await sleep(total * (0.2 + chars.length * 0.07)); shake(9); snd('hit');
  await sleep(total * (0.8 - chars.length * 0.07)); cut.classList.add('out'); if (node) node.classList.remove('caster');
  setTimeout(() => cut.remove(), 400);
}
const STATUS_N = { psn: '中毒', para: '寄生', stun: '定身', web: '落网', miss: '扑空', swap: '换位', strip: '破甲', tie: '系丝', blitz: '疾袭', luck: '鸿运', hex: '夺志' };
async function animEv(e, ros, seen) {
  const D = ms => sleep(ms * tempo / S.speed), nm = uid => ros[uid] ? ros[uid].name : '';
  switch (e.t) {
    case 'begin': blog('开战：双方开锋、护体先行'); return D(EV_MS.begin);
    case 'turn': $('#bturn').textContent = `第 ${e.n} 合`; return D(EV_MS.turn);
    case 'clash': {
      const a = bnode(e.a), b = bnode(e.b); if (!a || !b) return;
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(), dx = (rb.left - ra.left) / 2, dy = (rb.top - ra.top) / 2, dur = EV_MS.clash * tempo / S.speed;
      const kf = (x, y) => [{ transform: 'none' }, { transform: `translate(${-x * 0.14}px,${-y * 0.14}px) scale(.95)`, offset: 0.42 }, { transform: `translate(${x * 0.72}px,${y * 0.72}px)`, offset: 0.62 }, { transform: 'none' }];
      a.animate(kf(dx, dy), { duration: dur, easing: 'ease-in-out' }); b.animate(kf(-dx, -dy), { duration: dur, easing: 'ease-in-out' });
      blog(`${nm(e.a)} ⟷ ${nm(e.b)}`);
      await sleep(dur * 0.62); shake(3); snd('hit'); await sleep(dur * 0.38); return;
    }
    case 'dmg': {
      fxFloat(e.uid, e.n > 0 ? (e.crit ? '暴 ' : '') + '-' + fmtNum(e.n * dispK) : '', e.crit ? 'dmg crit' : e.k === 'skill' ? 'dmg skill' : 'dmg', e.blk ? fmtNum(e.blk * dispK) : 0);
      const n = bnode(e.uid); if (n) { n.classList.remove('hit'); void n.offsetWidth; n.classList.add('hit'); }
      if (e.crit) { shake(5); snd('clack'); }
      if (e.src >= 0 && e.n > 0) { chain = chain.side === e.src ? { side: e.src, n: chain.n + 1 } : { side: e.src, n: 1 }; if (chain.n >= 3) showChain(chain.n, e.src); }
      return D(e.k === 'hit' ? EV_MS.hit : EV_MS.dmg);
    }
    case 'buff': fxFloat(e.uid, e.sh ? `护+${e.sh}` : e.a < 0 ? `${e.a} 攻` : `+${e.a}/+${e.h}`.replace('/+0', '').replace('+0/', ''), e.a < 0 ? 'dmg' : 'buff'); return D(EV_MS.buff);
    case 'status': { const lab = STATUS_N[e.k]; if (lab) { fxFloat(e.uid, lab, 'dmg skill'); blog(`${nm(e.uid)} · ${lab}`); } return D(EV_MS.status); }   // 蛊典扩充的状态：中毒/寄生/定身/落网/扑空/换位/破甲/系丝
    case 'trig': {
      const t = e.id && TRAITS[e.id], lab = t ? t.n : (e.id || ''), ch = t ? t.ch : '技';
      const n = bnode(e.uid); if (n) { const g = el(`<span class="tg">${esc(ch)}</span>`); n.appendChild(g); setTimeout(() => g.remove(), 700); }
      blog(`${nm(e.uid)} · ${lab}`); return D(EV_MS.trig);
    }
    case 'combo': {
      const n = bnode(e.uid);
      if (e.quiet || seen.has(e.uid)) { if (n) { const g = el(`<span class="tg zhu">${esc(e.n[0])}</span>`); n.appendChild(g); setTimeout(() => g.remove(), 700); } return D(EV_MS.comboQuiet); }
      seen.add(e.uid); blog(`杀招【${e.n}】`);
      return comboCut(e.n, n, ros[e.uid]);
    }
    case 'summon': { if (e.rewind) { const n = bnode(e.uid); if (n) n.classList.remove('die'); blog(`${nm(e.uid)} 随光阴倒回`); return D(EV_MS.summon); } blog(`${nm(e.uid)} 现身`); return D(EV_MS.summon); }
    case 'faint': {
      const n = bnode(e.uid);
      if (e === finalBlow && n) {   // 斩杀特写：慢放、墨迹炸开
        const r = n.getBoundingClientRect(), ink = el('<span class="inkburst"></span>'); ink.style.left = (r.left + r.width / 2) + 'px'; ink.style.top = (r.top + r.height / 2) + 'px';
        document.body.appendChild(ink); setTimeout(() => ink.remove(), 1400); $('#arena').classList.add('slowmo'); shake(10); snd('combo');
        blog(`斩 · ${nm(e.uid)}`); n.classList.add('die'); await sleep(400 + EV_MS.faint * tempo / S.speed); $('#arena').classList.remove('slowmo'); return;
      }
      if (n) n.classList.add('die'); blog(`${nm(e.uid)} 阵亡`); snd('faint'); return D(EV_MS.faint);
    }
    case 'end': return D(EV_MS.end);
  }
}

// 新战斗画面（battle-view.js 的 playBattle）：铺一层全屏，结算页点「继续」再收起。没打包 battle-view 时退回下面的旧画面
const NEW_BV = typeof playBattle === 'function';
async function runBattle(B) {
  if (!NEW_BV) return showBattle(B);
  if (inBattle) return; inBattle = true; skip = false; window.__guB = B;
  const ov = el(`<div class="battle bv2" id="battle"><div class="bvbox"></div>${B.kind !== 'trip' && B.replay ? '<div class="bvx"><button data-act="copyReplay">复制复盘链接</button></div>' : ''}</div>`);
  document.body.appendChild(ov);
  try {
    await playBattle(ov.querySelector('.bvbox'), B.res, { mode: B.kind === 'trip' ? 'trip' : 'spar', title: B.title, names: [(B.A && B.A.name) || '我方', (B.B && B.B.name) || '对方'], mySide: 0, speed: S.speed >= 2 ? 2 : 1, reduceMotion: !!S.calm, sota: B.sota ? [!!B.sota.A, !!B.sota.B] : [] });
  } catch (e) { console.error(e); }
  closeBattle();
}
async function showBattle(B) {
  inBattle = true; skip = false;
  const ov = el(`<div class="battle" id="battle"><div class="bbar"><span class="btitle">${esc(B.title)}${trialTag((B.A && B.A.trial) || (B.B && B.B.trial))}</span><span class="bturn" id="bturn">开战</span><button class="ib" data-act="speed" id="bspd">${S.speed}×</button><button class="ib" data-act="skip">跳过</button></div>
  <div class="arena" id="arena"><div class="side sb" id="sideB"></div><div class="mid"><i></i><span>斗</span><i></i></div><div class="side sa" id="sideA"></div></div><div class="blog" id="blog"></div></div>`);
  ov.style.setProperty('--nu', Math.max(10, (B.A.team || []).length + (B.B.team || []).length)); document.body.appendChild(ov);
  const log = B.res.log, ros = B.res.roster, seen = new Set(); tempo = tempoFor(playMs(log)); chain = { side: -1, n: 0 };
  finalBlow = B.res.winner === 'draw' ? null : [...log].reverse().find(e => e.t === 'faint') || null;
  applySnap(log[0].s, ros);
  for (const e of log) { if (skip) break; await animEv(e, ros, seen); if (skip) break; applySnap(e.s, ros); }
  applySnap(log[log.length - 1].s, ros);
  showResult(B);
}
// 结算：停住等玩家点（切磋不给东西、不死蛊；秘境的生死由秘境一侧结算）
function showResult(B) {
  const w = B.res.winner, win = w === 'A', draw = w === 'draw';
  window.__guB = B;
  const head = draw ? '平手' : win ? '胜' : '负';
  const sub = B.kind === 'trip' ? '' : B.kind === 'replay' ? '复盘结束' : TXT.spar;
  const box = el(`<div class="result ${draw ? 'draw' : win ? 'win' : 'lose'}"><b class="rh">${head}</b><p class="sm">${esc(sub)}</p><div class="rbtns"><button class="zhu" data-act="closeBattle">${B.kind === 'trip' ? '继续' : '关闭'}</button>${B.kind !== 'trip' && B.replay ? '<button data-act="copyReplay">复制复盘链接</button>' : ''}</div></div>`);
  $('#battle').appendChild(box);
}
function closeBattle() { const b = $('#battle'); if (b) b.remove(); inBattle = false; const B = window.__guB; window.__guB = null; if (B && B.done) B.done(); renderAll(); }

// ---------- 斗幽灵、战帖：随时能打，纯切磋 ----------
function sotaFlag(s) { return (s.A ? 1 : 0) + (s.B ? 2 : 0); }
function spar(kind, foe) {
  if (inBattle) return;
  const mine = S.team.length ? S.team : starterTeam();
  const ca = encodeTeam(mine, { name: S.name || '无名蛊师', realm: S.realm, trial: S.trial }), cb = encodeTeam(foe.team, { name: foe.name, realm: foe.realm || S.realm, trial: !!foe.trial });
  const seed = kind === 'duel' ? (hashStr(ca + '|' + cb) >>> 0).toString(36) : ((S.seed ^ Math.imul(++S.step, 2654435761)) >>> 0).toString(36);
  const A = decodeTeam(ca), Bt = decodeTeam(cb), sota = { A: sotaOn(), B: false };
  const res = allCombos(() => battle(placed(A.team), placed(Bt.team), 'r:' + seed, { sota }));
  save(); runBattle({ kind, title: (kind === 'duel' ? '战帖 · ' : '幽灵 · ') + (foe.name || '无名'), res, A, B: Bt, sota, replay: [ca, cb, seed, kind[0], 's' + sotaFlag(sota)].join('.') });
}
// ---------- 试阵：拿阵盘上现在的摆法和幽灵 / 本秘境的精英 / 首领打着看。纯模拟：不死蛊、不给东西、不花元气、不记道途 ----------
// S.sim = { q, foe: 'ghost' | 'elite' | 'boss:i', seed }（只记面板上的选择，换一个就换 seed）
const ghostFoe = (seed, q, dao) => (TRIP.foeFor ? TRIP.foeFor(seed, q, { kind: 'ghost', dao }) : quotaTeam(makeRng('ghost:' + seed), q, { dao }));
const myArenaTeam = () => (S.team.length ? S.team : starterTeam());
const bossPool = l => (l.bosses && l.bosses.length ? l.bosses.map(b => ({ n: b.n, team: (b.team || []).map(g => (g.atk ? g : { ...newGu(g.sp, g.rank), ...g })) })) : [{ n: '', team: bossOf(l) }]);
const simQs = land => [...new Set([...ARENAS, land.quota])].sort((a, b) => a - b);
function simState() {
  const land = curLand(), o = S.sim && typeof S.sim === 'object' ? S.sim : {};
  const q = simQs(land).includes(o.q) ? o.q : land.quota, foe = /^(ghost|elite|boss:\d+)$/.test(o.foe || '') ? o.foe : 'ghost';
  S.sim = { q, foe, seed: o.seed || (S.seed + ':' + S.step).toString(36) }; return { land, ...S.sim };
}
// 对手阵容：幽灵 = 同额度满配、随机一道；精英 = 本秘境主道、按精英的强度；首领 = 本秘境首领池里选的那一伙（按秘境原样）
function simFoe(st) {
  const { land, q, foe, seed } = st;
  if (foe.startsWith('boss:')) { const pool = bossPool(land), b = pool[+foe.slice(5)] || pool[0]; return { name: (b.n || '首领') + ' · ' + land.n, team: b.team, boss: true }; }
  if (foe === 'elite') return { name: '精英 · ' + land.n, team: TRIP.foeFor ? TRIP.foeFor('sim:' + seed, q, { kind: 'elite', dao: land.dao, depth: 6 }) : quotaTeam(makeRng('sim:' + seed), q, { dao: land.dao }) };
  const r = makeRng('simg:' + seed), dao = DAOS[r.int(DAOS.length)].id, name = GHOST_NAMES[r.int(GHOST_NAMES.length)];
  return { name: '幽灵 · ' + name, team: ghostFoe('sim:' + seed, q, dao), dao };
}
function simFight(foe, seed) {
  const mine = myArenaTeam();
  return battle(placed(mine), placed(foe.team), 'sim:' + seed, { sota: { A: sotaOn(), B: false } });
}
function openTry(res20) {
  if (inBattle) return;
  const st = simState(), foe = simFoe(st), mine = myArenaTeam(), used = quotaOf(mine), boss = foe.boss, pool = bossPool(st.land);
  const fq = boss ? quotaOf(foe.team) : st.q, over = used > (boss ? st.land.quota : st.q);
  const foes = [['ghost', '幽灵'], ['elite', '精英'], ...pool.map((b, i) => ['boss:' + i, pool.length > 1 ? '首领 · ' + (b.n || i + 1) : '首领'])];
  sheet(`<h3>${TXT.tryName}</h3><p class="sm">${TXT.trySub}</p>
  <p class="lbl">${TXT.tryQ}</p><div class="segs arenas">${simQs(st.land).map(a => `<button data-act="simQ" data-q="${a}" class="${a === st.q ? 'on' : ''}"${boss ? ' disabled' : ''}>${a}</button>`).join('')}</div>
  <p class="lbl">${TXT.tryFoe} · ${esc(st.land.n)}</p><div class="segs simfoes">${foes.map(([k, n]) => `<button data-act="simFoe" data-k="${k}" class="${k === st.foe ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>
  <div class="foeopt"><div class="fh"><span class="fn">${esc(foe.name)}</span><small>${boss ? esc(TXT.tryBossQ(st.land.quota)) : (foe.dao && DAO[foe.dao] ? '多' + DAO[foe.dao].n + ' · ' : '') + '转数 ' + fq}</small>${boss ? '' : `<button class="ib" data-act="simNew" title="换一个">换一个</button>`}</div>${miniRow(foe.team)}</div>
  <p class="vsline">— 你的阵盘 · 转数 ${used} —</p>${miniRow(placed(mine))}${over ? `<p class="sm err">${esc(TXT.tryOver(used, boss ? st.land.quota : st.q))}</p>` : ''}
  <div class="row2"><button class="zhu" data-act="simOne">${TXT.tryOne}</button><button data-act="sim20">${TXT.try20}</button></div>
  <div class="simres" id="simres">${res20 ? simResHTML(res20) : ''}</div>`);
}
function simResHTML(r) {
  return `<p><b>${TXT.tryWin(Math.round(r.w / r.n * 100))}</b> · ${TXT.tryRes(r.w, r.l, r.d, r.n)}</p><p class="sm">${TXT.tryLeft((r.left / r.n).toFixed(1), r.size)}</p>${r.top ? `<p class="sm">${TXT.tryTop(r.top, Math.round(r.topDmg / r.n))}</p>` : ''}`;
}
// 连打 20 场：不播动画，分几批算（每批之间让一下界面）
async function sim20() {
  const st = simState(), foe = simFoe(st), mine = myArenaTeam(), N = 20, box = $('#simres');
  const agg = { n: N, w: 0, l: 0, d: 0, left: 0, size: mine.length, dmg: new Array(mine.length).fill(0) };
  for (let i = 0; i < N; i++) {
    if (box && i % 4 === 0) { box.innerHTML = `<p class="sm">${TXT.tryRun(i, N)}</p>`; await sleep(0); }
    const res = simFight(foe, st.seed + ':' + i);
    if (res.winner === 'A') agg.w++; else if (res.winner === 'B') agg.l++; else agg.d++;
    agg.left += (res.hpA || []).filter(h => h > 0).length;
    (res.statA || []).forEach((x, k) => { if (x && k < agg.dmg.length) agg.dmg[k] += x.dmg || 0; });
  }
  const placedMine = placed(mine), k = agg.dmg.reduce((b, v, i) => v > agg.dmg[b] ? i : b, 0);
  if (agg.dmg[k] > 0) { agg.top = rankName(placedMine[k]); agg.topDmg = agg.dmg[k]; }
  openTry(agg);
}
function simOne() {
  const st = simState(), foe = simFoe(st), mine = myArenaTeam(), seed = st.seed + ':' + (++S.step);
  const res = simFight(foe, seed); closeSheet(); save();
  runBattle({ kind: 'sim', title: TXT.tryName + ' · ' + foe.name, res, A: { team: mine, name: S.name || '无名蛊师', trial: S.trial }, B: { team: foe.team, name: foe.name }, sota: { A: sotaOn(), B: false }, done: () => setTimeout(() => openTry(), 50) });
}
function parseReplay(text) {
  const m = String(text || '').match(/r=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([0-9a-z]+)(?:\.([tgd]))?(?:\.s([0-3]))?/); if (!m) return null;
  const A = decodeTeam(m[1]), B = decodeTeam(m[2]); if (!A || !B) return null;
  const f = +(m[5] || 0), sota = { A: !!(f & 1), B: !!(f & 2) };
  return { A, B, seed: m[3], kind: m[4] || 'd', sota, replay: [m[1], m[2], m[3], m[4] || 'd', 's' + f].join('.') };
}
function openReplay(rp) {
  window.__guRp = rp;
  sheet(`<p class="eyebrow">复盘</p><h3 class="duelh">${esc(rp.B.name || '无名')}${trialTag(rp.B.trial)} 对 ${esc(rp.A.name || '无名')}${trialTag(rp.A.trial)}</h3><p class="sm">同一组阵容、同一颗种子，重放的是一模一样的那一场。${rp.sota.A || rp.sota.B ? '（这一场有 SOTA）' : ''}</p>${miniRow(rp.B.team)}<p class="vsline">— 对 —</p>${miniRow(rp.A.team)}<div class="row2"><button class="zhu big" data-act="replayGo">观看复盘</button></div>`);
}
function openLinkText(text) {
  const rp = parseReplay(text); if (rp) { openReplay(rp); return true; }
  const foe = decodeTeam(text); if (foe) { openDuel(foe); return true; }
  return false;
}
const SHARE_BASE = 'https://1596941391qq.github.io/gu-code/';
const INSTALL_URL = 'https://github.com/1596941391qq/gu-code#安装插件获取真实-token-消耗';
const baseURL = () => (/^https?:/.test(location.protocol) ? location.origin + location.pathname : SHARE_BASE);
function replayURL(link) { return baseURL() + '#r=' + link; }
function shareURL(code) { return baseURL() + '#c=' + code; }
function shareText(code) { const q = arenaOf(myArenaTeam()); return `${S.trial ? TXT.trialText : ''}我在《蛊码》养了一窝蛊（${REALMS[S.realm]}${q ? ' · ' + TXT.arenaName(q) : ''}），敢接战帖吗？\n界壁坐标码：${code}`; }
function myCode() { return encodeTeam(S.team.length ? S.team : starterTeam(), { name: S.name, realm: S.realm, trial: S.trial }); }
let cardURL = '';
async function openShare() {
  const code = myCode(), url = shareURL(code);
  sheet(`<h3>界壁坐标码${trialTag(S.trial)}</h3>${S.trial ? `<p class="trialnote">${TXT.trialShare}</p>` : ''}<p class="sm">发给朋友。对方打开链接，或在蛊码里粘贴坐标码，就会和你空窍里这支阵容切磋。${(() => { const u = quotaOf(myArenaTeam()), q = arenaOf(myArenaTeam()); return q ? `你的空窍转数 ${u}，算 ${TXT.arenaName(q)}：对方上阵转数也不能超过 ${q}。` : esc(TXT.arenaNone(u)) + '，别人接不了这张战帖。'; })()}</p>
  <label class="row"><span>蛊师名号</span><input id="nm" maxlength="8" value="${esc(S.name)}" placeholder="无名蛊师"></label>
  <div class="code" id="codeTxt">${code}</div>
  <div class="row2"><button data-act="copyCode">复制坐标码</button><button data-act="copyLink">复制战帖链接</button></div>
  <div class="cardbox"><img id="cardImg" alt="分享卡"><div class="row2"><button class="zhu" data-act="savePng">保存分享卡 PNG</button></div><p class="sm">${VSC ? '' : '手机上可长按图片保存。'}</p></div>`);
  $('#nm').addEventListener('change', e => { S.name = e.target.value.trim().slice(0, 8); save(); openShare(); });
  cardURL = ''; const img = $('#cardImg');
  try { cardURL = await makeCard({ team: S.team.length ? S.team : starterTeam(), name: S.name, realm: S.realm, total: S.total, code, url, trial: S.trial }); if (img) img.src = cardURL; } catch (e) { if (img) img.alt = '分享卡生成失败'; }
}
function openDuelInput() {
  sheet(`<h3>应战</h3><p class="sm">粘贴朋友发来的界壁坐标码、战帖链接或复盘链接。</p><textarea id="duelIn" rows="3" placeholder="坐标码"></textarea><p class="err" id="duelErr"></p><div class="row2"><button class="zhu" data-act="duelGo">查看战帖</button></div>`);
  setTimeout(() => { const t = $('#duelIn'); if (t) t.focus(); }, 50);
}
function openDuel(foe) {
  if (!foe) return; window.__guFoe = foe;
  const mine = myArenaTeam(), q = arenaOf(foe.team), used = quotaOf(mine), why = !q ? TXT.arenaNone(quotaOf(foe.team)) : used > q ? TXT.arenaOver(used, q) : '';
  sheet(`<p class="eyebrow">界壁震动</p><h3 class="duelh">有人向你下战帖${trialTag(foe.trial)}</h3><p class="sm">来自 <b>${esc(foe.name || '无名蛊师')}</b> · ${REALMS[foe.realm] || '凡人'}${foe.old ? ' · 旧版坐标码（只认物种和转数）' : ''}</p>${foe.trial ? `<p class="trialnote">${TXT.trialFoe}</p>` : ''}${q ? `<p class="sm">${esc(TXT.duelArena(q))}</p>` : ''}${miniRow(foe.team)}
  <p class="vsline">— 你的${S.team.length ? '空窍' : '初始阵容'} · 转数 ${used} —</p>${miniRow(mine)}<p class="sm ${why ? 'err' : ''}">${esc(why || TXT.spar)}</p><div class="row2"><button class="zhu big" data-act="duelFight"${why ? ' disabled' : ''}>应战</button></div>`);
}
function checkHash() {
  const h = location.hash; if (!/[#&](c|r)=/.test(h)) return;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  openLinkText(h);
}
function copy(text, btn) {
  const done = () => { if (btn) { const o = btn.textContent; btn.textContent = '已复制'; setTimeout(() => { btn.textContent = o; }, 1200); } };
  if (VSC) { VSC.postMessage({ type: 'copy', text }); return done(); }
  const fb = () => { const t = el('<textarea></textarea>'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} t.remove(); done(); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fb); else fb();
}

// ---------- 弹层（只由玩家点击打开）----------
function sheet(html, cls = '', stack = false) {
  if (!stack) document.querySelectorAll('.sheet-bg').forEach(n => n.remove());
  const bg = el(`<div class="sheet-bg${stack ? ' stack' : ''}" data-act="closeSheetBg"><div class="sheet ${cls}" role="dialog"><button class="x" data-act="closeSheet" aria-label="关闭">×</button>${html}</div></div>`);
  document.body.appendChild(bg); return bg.querySelector('.sheet');
}
function closeSheet() { const a = document.querySelectorAll('.sheet-bg'); if (a.length) a[a.length - 1].remove(); }
function miniRow(t) { return `<div class="mini">${t.map(g => `<div class="mg${g.boss ? ' boss' : ''}"><span class="art">${guSVG(g.sp, { rank: rankOf(g) })}</span><span class="rk rk${rankOf(g)}">${RANK.ch[rankOf(g)]}</span>${dzHTML(g.sp)}${gearHTML(g)}<b>${SP[g.sp] ? SP[g.sp].n : ''}</b><span class="st"><i class="a">${g.atk}</i><i class="h">${g.hp}</i></span></div>`).join('')}</div>`; }
// 技能说明（battle.js 的 skillText）：带这一转的实际数字。skNum 取「（这一转约 …）」里的话，skDmg 取第一个数（合成预览用）
const skills = (sp, r) => { try { return skillText(sp, r) || []; } catch (e) { return []; } };
const skNum = t => { const m = String(t || '').match(/（这一转([^（）]*)）\s*$/); return m ? m[1].trim() : ''; };
const skDmg = t => { const m = skNum(t).match(/(\d+)/); return m ? +m[1] : 0; };
// 蛊详情里的「每一转」：原生转数到五转，每一转的攻血和技能实际数，当前这一转描朱，三转、五转的觉醒写清多了什么，没到的灰着
function growHTML(g) {
  const cur = rankOf(g), rows = [];
  for (const x of statTable(g.sp)) {
    const sk = skills(g.sp, x.rank), act = sk.find(k => k.kind === 'active'), pas = sk.find(k => k.kind === 'passive');
    const bits = [act && skNum(act.text) ? `主动 ${skNum(act.text)}` : '', pas && skNum(pas.text) ? `被动 ${skNum(pas.text)}` : ''].filter(Boolean);
    rows.push(`<div class="grow${x.rank === cur ? ' on' : x.rank > cur ? ' later' : ''}"><b>${RANK.names[x.rank]}</b><span><i class="a">${x.atk}</i> <i class="h">${x.hp}</i>${x.rank === cur ? ' <small>现在</small>' : ''}</span>${bits.length ? `<small class="gsk">${esc(bits.join(' · '))}</small>` : ''}</div>`);
    const aw = sk.find(k => k.kind === (x.rank === 3 ? 'aw3' : x.rank === 5 ? 'aw5' : ''));
    if (aw) rows.push(`<div class="grow aw${cur >= x.rank ? ' got' : ' later'}"><b>${esc(aw.n)}</b><small class="gsk">${(aw.lines || [{ text: aw.text }]).map(l => `${l.of === 'passive' ? '被动' : l.of === 'active' ? '主动' : ''}${l.n ? `「${esc(l.n)}」` : ''}${esc(l.text)}`).join('<br>')}</small></div>`);
  }
  return `<div class="grows">${rows.join('')}</div>`;
}
// 合成预览：现在这一转 → 高一转的攻血和主动技伤害
function mergePreview(sp, r) {
  if (r >= RANK.max) return '';
  const a = statFor(sp, r), b = statFor(sp, r + 1), sa = skills(sp, r).find(k => k.kind === 'active'), sb = skills(sp, r + 1).find(k => k.kind === 'active');
  const da = sa ? skDmg(sa.text) : 0, db = sb ? skDmg(sb.text) : 0;
  return `攻 ${a.atk}→${b.atk}，血 ${a.hp}→${b.hp}${da && db ? `，技能伤害 ${da}→${db}` : ''}${r + 1 === 3 || r + 1 === 5 ? `，${RANK.names[r + 1]}觉醒` : ''}`;
}
function guDetail(g, ctx = {}) {
  const s = SP[g.sp], nat = natOfG(g), team = ctx.kind === 'team' ? S.team : null, i = ctx.i | 0, c = team ? combosBy(team)[i] : null, f = g.food && FOOD[g.food];
  const recipes = COMBOS_ALL.filter(x => x.need.includes(g.sp)), sk = skills(g.sp, rankOf(g)), skP = sk.find(k => k.kind === 'passive'), skA = sk.find(k => k.kind === 'active');
  sheet(`<div class="detail"><div class="dart">${guSVG(g.sp, { rank: rankOf(g) })}</div><div><h3>${rankName(g)}</h3><p class="lore">${esc(s.lore)}</p><p class="dst"><i class="a">${g.atk}</i><i class="h">${g.hp}</i><i class="v">${spdG(g)}</i> <small>${DAO[daoOf(g.sp)] ? DAO[daoOf(g.sp)].n : ''} · ${reachG(g)}</small></p>${team && resoOf(team, g) ? `<p class="sm rs">${esc(resoOf(team, g))}</p>` : ''}</div></div>
  ${nat ? `<h4>被动技能</h4><p><b>${esc((skP || nat).n)}</b> ${esc(skP ? skP.text : nat.d)}</p>` : ''}${actOfG(g) ? `<h4>主动技能</h4><p><b>${esc((skA || actOfG(g)).n)}</b> ${esc(skA ? skA.text : actOfG(g).d)}<br><small>蛊力攒满自动放</small></p>` : ''}
  ${c ? `<h4>杀招</h4><div class="skill"><span class="seal">${esc(c.n)}</span><p>${esc(c.d)}<br><small>配方：${c.need.map(x => SP[x].n).join(' + ')}</small></p></div>` : ''}
  ${f ? `<h4>挂件</h4><p>${fi(f.id)}<b>${esc(f.n)}</b> ${esc(f.d)}</p>` : ''}
  ${g.xing ? `<h4>蛊性</h4><p><b>${esc(xingName(g.xing))}</b> ${esc(xingDesc(g.xing))}</p>` : ''}
  <h4>${TXT.statHead}</h4><p class="sm">${esc(TXT.statSub)}</p>${growHTML(g)}<p class="sm">${esc(TXT.ateLine(g))}${g.bonusA || g.bonusH ? `（已加攻 ${g.bonusA || 0}、血 ${g.bonusH || 0}）` : ''}</p>
  ${recipes.length ? `<h4>能凑的杀招</h4><ul>${recipes.map(x => `<li><b>${esc(x.n)}</b> ${x.need.map(y => SP[y].n).join(' + ')}${unlocked(x.id, 'combo') ? '' : ' <small>道途解锁</small>'}</li>`).join('')}</ul>` : ''}
  ${ctx.kind === 'team' || ctx.kind === 'bag' ? `<div class="row2">${ctx.kind === 'team' ? `<button data-act="toBag" data-k="${cellOf(g)}"${S.bag.length < BC() && !tripOn() ? '' : ' disabled'}>收进蛊囊</button>` : `<button class="zhu" data-act="fromBag" data-i="${i}"${S.team.length < SLOTS && rankOf(g) <= driveCap(S.realm) && !tripOn() ? '' : ' disabled'}>上阵</button>`}<button data-act="sell" data-k="${ctx.kind}" data-i="${i}"${tripOn() ? ' disabled' : ''}>卖出 · 退回 ${fmtTok(price(sellValue(g)))}</button></div>` : ''}`);
}
function openCodex() {
  const have = S.team.map(g => g.sp);
  sheet(`<h3>蛊典</h3><p class="sm">见过 ${Object.keys(S.codex).length} / ${SPECIES.length} 种。</p>
  <h4>杀招图鉴</h4><p class="sm">没凑出来过的杀招只露出核心蛊，其余几只只告诉你属于哪一道；第一次成形后完整揭晓。</p><ul class="recipes">${COMBOS_ALL.map(c => { const seen = (S.combosSeen || []).includes(c.id), core = SP[c.need[0]], rest = c.need.slice(1);
    if (!seen) return `<li class="hid"><b>？？？</b> 核心：<span class="${have.includes(c.need[0]) ? 'got' : ''}">${core ? core.n : '？'}</span> + ${rest.map(x => `<span>某只${DAO[daoOf(x)] ? DAO[daoOf(x)].n : ''}的蛊</span>`).join(' + ')}${unlocked(c.id, 'combo') ? '' : ' <small>道途解锁</small>'}</li>`;
    const miss = comboMissing(c, have); return `<li class="${miss.length ? '' : 'on'}"><b>${esc(c.n)}</b> ${c.need.map(x => `<span class="${have.includes(x) ? 'got' : ''}">${SP[x] ? SP[x].n : x}</span>`).join(' + ')}${!unlocked(c.id, 'combo') ? '<small>道途解锁</small>' : miss.length ? '' : '<small>已成形</small>'}<br><small>${esc(c.d)}</small></li>`; }).join('')}</ul>
  <h4>道</h4><ul>${DAOS.map(d => `<li><b>${d.n}</b> ${esc(d.d)}<br><small>2 只：${esc(d.r2.d)}；4 只：${esc(d.r4.d)}</small></li>`).join('')}</ul>
  <h4>蛊</h4><div class="codexgrid">${SPECIES.filter(s => !s.immortal).map(s => `<div class="cx${S.codex[s.id] ? '' : ' unseen'}" data-tip="${esc(S.codex[s.id] ? `${s.n}（${RANK.names[baseRank(s.id)]} · ${DAO[daoOf(s.id)] ? DAO[daoOf(s.id)].n : ''}）\n${natDesc(s.id)}` : '还没见过')}">${guSVG(s.id)}<small>${S.codex[s.id] ? s.n : '？'}</small></div>`).join('')}</div>`, 'codex');
}
const PATH_K = { trips: '渡劫', clears: '通关', realm: '境界', merges: '合成', combos: '杀招成形', buys: '买蛊', feeds: '喂食', daos: '当过主力的道', kalpa: '劫数',
  r1q: '只带一转通关的额度', r2q: '只带一二转通关的额度', no5q: '不带五转通关的额度', few3q: '不超过 3 只通关的额度', monoq: '全同一道通关的额度', flawq: '一只没倒通关的额度', nocomboq: '不成杀招通关的额度' };
const pathK = k => PATH_K[k] || (/^d_/.test(k) && DAO[k.slice(2)] ? `${DAO[k.slice(2)].n}当主力通关` : k);
function openPath() {
  const v = timelineView(M()), groups = [...new Set(v.map(a => a.g || ''))];
  sheet(`<h3>道途</h3><p class="sm">达成一个，就解锁新的蛊、食物、杀招、秘境或玩法。成就本身不给数值。</p>${groups.map(g => `${g ? `<h4>${esc(g)}</h4>` : ''}<ol class="tline">${v.filter(a => (a.g || '') === g).map(a => `<li class="${a.state}"><b>${esc(a.n)}</b> <small>${esc(a.d)}</small>${a.state === 'done' ? '' : `<small class="prog">${a.prog.map(p => `${pathK(p.k)} ${p.cur}/${p.v}`).join(' · ')}</small>`}<em>${(a.unlock || []).map(u => '解锁 ' + esc(u.n)).join('、')}</em></li>`).join('')}</ol>`).join('')}`);
}
const applyCalm = () => { document.documentElement.toggleAttribute('data-calm', !!S.calm); try { fxConfig({ calm: !!S.calm }); } catch (e) {} };
function openSettings() {
  const tog = (act, on, a = '开', b = '关') => `<button class="tog${on ? ' on' : ''}" data-act="${act}" aria-pressed="${on}">${on ? a : b}</button>`;
  ledgerBindLimits(sheet(`<h3>设置</h3>
  <div class="set"><span>主题</span><div class="segs">${[['auto', '自动'], ['light', '日'], ['dark', '夜']].map(([k, t]) => `<button data-act="setTheme" data-v="${k}" class="${(S.theme || 'auto') === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
  <div class="set"><span>声音<small>古琴、木鱼</small></span>${tog('setMute', !S.mute)}</div>
  <div class="set"><span>减弱震屏与闪光<small>暴击、斩杀的震动和闪白都调弱</small></span>${tog('setCalm', !!S.calm)}</div>
  ${ledgerLimitRows()}
  <p class="sm">累计元气 ${fmtTok(S.total)} token</p>`, 'settings'));
}

// ---------- 悬停提示：data-tip（文字）或 data-tip-fn（动态） ----------
function guTip(g, team, i) {
  if (!g) return '';
  const nat = natOfG(g), c = team ? combosBy(team)[i] : null, f = g.food && FOOD[g.food];
  const act = actOfG(g), p = g.pos, sk = skills(g.sp, rankOf(g)), skP = sk.find(k => k.kind === 'passive'), skA = sk.find(k => k.kind === 'active'), rs = team ? resoOf(team, g) : '';
  return `<b>${rankName(g)}</b> <i class="a">${g.atk}</i> <i class="h">${g.hp}</i> <i class="v">${spdG(g)}</i><br><small>${esc(SP[g.sp].lore)}${team && p ? ` · 第 ${p.r + 1} 行${COL_NAMES[p.c]}列` : ''} · ${reachG(g)} · 攻 / 血 / 速</small>`
    + (rankOf(g) > driveCap(S.realm) ? `<p class="warn">${esc(TXT.overDrive)}</p>` : '') + (rs ? `<p class="rs"><b>${esc(rs.split('：')[0])}</b> ${esc(rs.slice(rs.indexOf('：') + 1))}</p>` : '') + (nat ? `<p><b>被动·${esc((skP || nat).n)}</b> ${esc(skP ? skP.text : nat.d)}</p>` : '') + (act ? `<p><b>主动·${esc((skA || act).n)}</b> ${esc(skA ? skA.text : act.d)}<br><small>蛊力攒满自动放</small></p>` : '') + (c ? `<p><b>杀招·${esc(c.n)}</b> ${esc(c.d)}<br><small>配方：${c.need.map(x => SP[x].n).join(' + ')}</small></p>` : '')
    + (f ? `<p>${fi(f.id)}<b>挂件·${esc(f.n)}</b> ${esc(f.d)}</p>` : '') + (g.xing ? `<p><b>蛊性·${esc(xingName(g.xing))}</b> ${esc(xingDesc(g.xing))}</p>` : '') + `<small>${esc(TXT.ateLine(g))} · 点开看完整详情</small>`;
}
const TIPS = {
  qi: () => `<b>元气 ${fmtTok(S.bank)}</b><br><small>${esc(TXT.qiTip)}${VSC ? '' : esc(TXT.qiTrial)}</small>`,
  gu: t => { const i = S.team.findIndex(g => g.uid === t.dataset.uid); return guTip(S.team[i], S.team, i); },
  bag: () => esc(TXT.bagTip()),
  bg: t => { const g = S.bag[+t.dataset.i]; return g ? guTip(g) + '<small>在蛊囊里：不上场、不跟去渡劫，拖进空窍才上场</small>' : ''; },
  ware: t => { const w = S.shop[+t.dataset.i]; if (!w) return ''; if (w.kind === 'food') { const f = FOOD[w.id]; return `${fi(f.id)}<b>${esc(f.n)}</b> · ${FOOD_KIND[f.kind]}<br>${esc(f.d)}<br><small>价格 ${fmtTok(price(foodCost(w.id)))} 元气</small>`; } const n = owned(w.sp); return guTip(newGu(w.sp)).replace('<small>点开看完整详情</small>', '') + `<small>价格 ${fmtTok(price(PRICE.gu))} 元气 · 点开看完整详情</small>` + (n >= 2 ? `<p>你已有 ${n} 只${RANK.names[baseRank(w.sp)]}${SP[w.sp].n}，买下当场合成${RANK.names[baseRank(w.sp) + 1]}</p><p>${esc(TXT.mergeAfter(mergePreview(w.sp, baseRank(w.sp))))}</p>` : '' + (n < 2 && resoGain(S.team, w.sp) ? `<p>${esc(TXT.resoGainTip(resoGain(S.team, w.sp)))}</p>` : '')); },
};
let tipT = 0, tipEl = null, tipFor = null, tipLongT = 0, tipLongAt = -1e9;
function tipShow(t) {
  const f = t.dataset.tipFn, h = f ? (TIPS[f] ? TIPS[f](t) : '') : esc(t.dataset.tip || '').replace(/\n/g, '<br>'); if (!h) return;
  if (!tipEl) { tipEl = el('<div class="tip" role="tooltip"></div>'); document.body.appendChild(tipEl); }
  tipEl.innerHTML = h; tipEl.hidden = false; tipFor = t;
  const r = t.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
  const below = r.bottom + th + 10 < vh || r.top < th + 10, top = below ? r.bottom + 6 : r.top - th - 6;
  tipEl.style.left = Math.max(8, Math.min(vw - tw - 8, r.left + r.width / 2 - tw / 2)) + 'px'; tipEl.style.top = Math.max(8, Math.min(vh - th - 8, top)) + 'px';
}
function tipHide() { clearTimeout(tipT); clearTimeout(tipLongT); if (tipEl) tipEl.hidden = true; tipFor = null; }
const tipTarget = e => e.target.closest && e.target.closest('[data-tip],[data-tip-fn]');
document.addEventListener('pointerover', e => {
  if (e.pointerType === 'touch') return; const t = tipTarget(e); if (t === tipFor) return;
  tipHide(); if (t) tipT = setTimeout(() => { if (t.isConnected) tipShow(t); }, 250);
});
document.addEventListener('pointerout', e => { if (e.pointerType === 'touch') return; const t = tipTarget(e); if (t && !(e.relatedTarget && t.contains(e.relatedTarget))) tipHide(); });
document.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') { tipHide(); return; }
  const t = tipTarget(e); if (tipFor && tipFor !== t) tipHide();
  if (t) { const x = e.clientX, y = e.clientY; tipLongT = setTimeout(() => { tipShow(t); tipLongAt = performance.now(); }, 450); t._tipXY = [x, y]; }
}, true);
document.addEventListener('pointermove', e => { if (e.pointerType === 'touch' && tipLongT && tipFor == null) { const t = tipTarget(e); if (!t || !t._tipXY || Math.hypot(e.clientX - t._tipXY[0], e.clientY - t._tipXY[1]) > 8) clearTimeout(tipLongT); } }, true);
document.addEventListener('pointerup', e => { if (e.pointerType === 'touch') clearTimeout(tipLongT); }, true);
window.addEventListener('scroll', () => tipHide(), true);

// ---------- 拖动换位：空窍内、蛊囊内、两者之间 ----------
let drag = null, dragEndT = -1e9;
const moveIdx = (arr, f, t) => { const [x] = arr.splice(f, 1); arr.splice(t, 0, x); };
// 阵盘用格号（0–8），蛊囊用下标。阵盘内换格；蛊囊和阵盘之间互换或移动；上阵满了不能再往空格放
function moveGu(fromKey, fi, toKey, ti) {
  if (tripOn()) return false;
  const atCell = k => S.team.find(g => cellOf(g) === k);
  if (fromKey === 'team' && toKey === 'team') { const g = atCell(fi), o = atCell(ti); if (!g) return false; if (o) o.pos = cellPos(fi); g.pos = cellPos(ti); sortTeam(S.team); return true; }
  if (fromKey === 'bag' && toKey === 'bag') { if (!S.bag[fi]) return false; moveIdx(S.bag, fi, Math.min(ti, S.bag.length - 1)); return true; }
  if (fromKey === 'bag') {
    const g = S.bag[fi], k = ti == null || ti < 0 ? freeCell(S.team) : ti, o = atCell(k); if (!g || k == null) return false;
    if (rankOf(g) > driveCap(S.realm)) { note(TXT.driveNo(g)); return false; }
    if (o) { S.bag[fi] = o; o.pos = null; } else { if (S.team.length >= SLOTS) { note(`阵盘 9 格都满了：拖到一只蛊身上就能换下它`); return false; } S.bag.splice(fi, 1); }
    g.pos = cellPos(k); S.team.push(g); sortTeam(S.team); return true;
  }
  const g = atCell(fi), o = S.bag[ti]; if (!g) return false;
  if (o && rankOf(o) > driveCap(S.realm)) { note(TXT.driveNo(o)); return false; }
  if (o) { S.bag[ti] = g; o.pos = g.pos; S.team.splice(S.team.indexOf(g), 1, o); g.pos = null; }
  else { if (S.bag.length >= BC()) return false; S.team.splice(S.team.indexOf(g), 1); g.pos = null; S.bag.push(g); }
  sortTeam(S.team); return true;
}
document.addEventListener('pointerdown', e => {
  const it = e.target.closest('[data-drag]'), box = it && it.closest('[data-sort]');
  if (!it || !box || e.button > 0 || it.classList.contains('empty') || tripOn()) return;
  const grp = box.dataset.group, items = grp ? [...document.querySelectorAll(`[data-group="${grp}"] [data-drag]`)] : [...box.querySelectorAll('[data-drag]')];
  drag = { it, box, from: items.indexOf(it), to: items.indexOf(it), x0: e.clientX, y0: e.clientY, ghost: null, items };
});
window.addEventListener('pointermove', e => {
  if (!drag) return; const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (!drag.ghost) {
    if (Math.hypot(dx, dy) < 8) return;
    const r = drag.it.getBoundingClientRect(), gh = drag.it.cloneNode(true); gh.classList.add('dragghost'); gh.removeAttribute('data-act');
    Object.assign(gh.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); document.body.appendChild(gh); drag.ghost = gh; drag.it.classList.add('dragging');
  }
  drag.ghost.style.transform = `translate(${dx}px,${dy}px) rotate(-3deg)`;
  let best = drag.from, bd = Infinity;
  drag.items.forEach((o, k) => { const r = o.getBoundingClientRect(), d = Math.hypot(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2); if (d < bd) { bd = d; best = k; } });
  drag.to = best; drag.items.forEach((o, k) => o.classList.toggle('dropto', k === best && k !== drag.from));
  e.preventDefault();
}, { passive: false });
function dragEnd() {
  if (!drag) return; const d = drag; drag = null; if (!d.ghost) return;
  d.ghost.remove(); d.it.classList.remove('dragging'); d.items.forEach(o => o.classList.remove('dropto')); dragEndT = performance.now();
  if (d.to === d.from) return; const tgt = d.items[d.to], tbox = tgt && tgt.closest('[data-sort]');
  if (!tbox) return;
  if (moveGu(d.box.dataset.sort, +d.it.dataset.drag, tbox.dataset.sort, +tgt.dataset.drag)) { snd('clack'); afterChange(); }
}
window.addEventListener('pointerup', dragEnd); window.addEventListener('pointercancel', dragEnd);

// ---------- 交互 ----------
function buyWare(i) {
  const w = S.shop[i]; if (!w || w.sold || tripOn()) return;
  if (w.kind === 'food') {
    const f = FOOD[w.id]; if (!canPay(foodCost(w.id))) { note(TXT.poor(price(foodCost(w.id)) - S.bank)); return; }
    if (f.kind === 'trip' || (f.kind === 'stat' && f.to !== 'one')) { if (f.kind === 'stat' && !S.team.some(canEat)) { note(TXT.ateFull); return; }
      if (!pay(foodCost(w.id))) return; w.sold = true; w.frozen = false; useFood(w.id, 'shop', i); closeSheet(); renderHome(); save(); return; }
    useFood(w.id, 'shop', i); return;
  }
  if (!canBuy(S.team, w.sp, curCap(), S.bag, BC())) { note(TXT.bagFull); return; }
  if (!pay(PRICE.gu)) return;
  const g = newGu(w.sp); w.sold = true; w.frozen = false;
  note(TXT.bought(g)); achieve('buys', 1); closeSheet();
  placeNew(g, 'shop'); snd('coin');
}
const ACT = {
  closeSheet() { closeSheet(); },
  closeSheetBg(a, e) { if (e.target === a) closeSheet(); },
  pick(a) {
    const g = newGu(a.dataset.sp, 1); S.team = [g]; S.started = true; S.bank = S.bank || 0; codexScan();
    rollCompass(); renderAll(); save();
  },
  dao(a) { S.dao = a.dataset.d; S.compass = null; S.shop = S.shop.filter(w => w.frozen && !w.sold); newShop(); note(TXT.daoLine(S.dao)); renderHome(); save(); },
  ware(a) {
    const i = +a.dataset.i, w = S.shop[i]; if (!w) return;
    if (w.kind === 'food') { const f = FOOD[w.id]; sheet(`<div class="fhead"><span class="fbig">${foodSVG(f.id)}</span><div><h3>${esc(f.n)} <small>${FOOD_KIND[f.kind]}</small></h3><p>${esc(f.d)}</p></div></div><div class="row2"><button data-act="freeze" data-i="${i}">${TXT.freeze(w.frozen)}</button><button class="zhu" data-act="buy" data-i="${i}"${!w.sold && canPay(foodCost(w.id)) ? '' : ' disabled'}>买下 ${fmtTok(price(foodCost(w.id)))}</button></div><p class="sm">余 ${fmtTok(S.bank)} 元气</p>`); return; }
    const g = newGu(w.sp); guDetail(g, { kind: 'shop' });
    const sh = $('.sheet'); if (sh) sh.insertAdjacentHTML('beforeend', `<div class="row2"><button data-act="freeze" data-i="${i}">${TXT.freeze(w.frozen)}</button><button class="zhu" data-act="buy" data-i="${i}"${!w.sold && canPay(PRICE.gu) ? '' : ' disabled'}>${owned(w.sp) >= 2 ? '买下并合成 ' : '买下 '}${fmtTok(price(PRICE.gu))}</button></div><p class="sm">余 ${fmtTok(S.bank)} 元气</p>`);
  },
  buy(a) { buyWare(+a.dataset.i); },
  freeze(a) { const w = S.shop[+a.dataset.i]; if (!w) return; w.frozen = !w.frozen; closeSheet(); renderShop(); save(); },
  refresh() { if (tripOn() || !pay(PRICE.refresh)) return; newShop(); renderShop(); meters(); save(); snd('tick'); },
  pantry(a) { const i = +a.dataset.i, id = S.pantry[i], f = FOOD[id]; if (!f) return; if (f.kind === 'gear' || (f.kind === 'stat' && f.to === 'one')) { useFood(id, 'pantry', i); return; } if (useFood(id, 'pantry', i)) { S.pantry.splice(i, 1); renderHome(); save(); } },
  feedTo(a) { const all = [...S.team, ...S.bag]; feedTo(all[+a.dataset.k]); },
  xingPick(a) { const g = [...S.team, ...S.bag].find(x => x.uid === a.dataset.uid); if (!g) return; g.xing = a.dataset.k; closeSheet(); note(TXT.xingSet(g)); renderHome(); save(); askXing(); },
  gu(a) { const i = S.team.findIndex(g => g.uid === a.dataset.uid); if (i >= 0) guDetail(S.team[i], { kind: 'team', i }); },
  bagGu(a) { const i = +a.dataset.i; if (S.bag[i]) guDetail(S.bag[i], { kind: 'bag', i }); },
  toBag(a) { if (moveGu('team', +a.dataset.k, 'bag', S.bag.length)) { closeSheet(); afterChange(); } },
  fromBag(a) { if (moveGu('bag', +a.dataset.i, 'team', -1)) { closeSheet(); afterChange(); } },
  sell(a) { const L = a.dataset.k === 'bag' ? S.bag : S.team, i = +a.dataset.i, g = L[i]; if (!g || tripOn()) return; const v = price(sellValue(g)); L.splice(i, 1); S.bank += v; note(TXT.sold(g, v)); closeSheet(); afterChange(); snd('coin'); },
  go() { if (tripOn() || goWhy()) return; goSheet(); },
  lands() { if (!tripOn()) openLands(); },
  jie(a) { const l = landById(a.dataset.id); if (!l) return; S.landK = Object.assign({}, S.landK, { [l.id]: +a.dataset.k | 0 }); save(); renderHome(); openLands(); },
  land(a) { const l = landById(a.dataset.id); if (!l || !landOpen(l)) return; S.land = l.id; closeSheet(); renderHome(); save(); },
  goConfirm() { closeSheet(); if (goWhy()) return; if (!TRIP.start) { note(TXT.goSoon); return; } S.trip = S.trip || { at: Date.now(), land: curLand().id, kalpa: kalpaOf(curLand()) }; save(); renderHome(); TRIP.start(TRIP.api); },
  tryOpen() { openTry(); },
  simQ(a) { simState(); S.sim.q = +a.dataset.q; S.sim.seed = (S.seed + ':' + (++S.step)).toString(36); openTry(); },
  simFoe(a) { simState(); S.sim.foe = a.dataset.k; S.sim.seed = (S.seed + ':' + (++S.step)).toString(36); openTry(); },
  simNew() { simState(); S.sim.seed = (S.seed + ':' + (++S.step)).toString(36); openTry(); },
  simOne() { simOne(); },
  sim20(a) { a.disabled = true; sim20(); },
  share() { openShare(); },
  copyCode(a) { copy(myCode(), a); },
  copyLink(a) { const c = myCode(); copy(shareText(c) + '\n' + shareURL(c), a); },
  savePng() { if (!cardURL) return; if (VSC) { VSC.postMessage({ type: 'savePng', data: cardURL }); return; } const l = document.createElement('a'); l.href = cardURL; l.download = 'gucode.png'; l.click(); },
  duelInput() { openDuelInput(); },
  duelGo() { if (!openLinkText($('#duelIn').value)) $('#duelErr').textContent = '坐标码或复盘链接不对，或者被截断了。'; },
  duelFight() { const f = window.__guFoe, q = f && arenaOf(f.team); if (!f || !q || quotaOf(myArenaTeam()) > q) return; closeSheet(); spar('duel', f); },
  replayGo() { const rp = window.__guRp; closeSheet(); runBattle({ kind: 'replay', title: `复盘 · ${rp.B.name || '无名'} 对 ${rp.A.name || '无名'}`, res: allCombos(() => battle(placed(rp.A.team), placed(rp.B.team), 'r:' + rp.seed, { sota: rp.sota })), A: rp.A, B: rp.B, sota: rp.sota, replay: rp.replay }); },
  copyReplay(a) { const B = window.__guB; if (!B) return; const w = B.res.winner, an = B.A.name || '无名', bn = B.B.name || '无名', wt = w === 'draw' ? '打成平手' : (w === 'A' ? an : bn) + ' 胜'; copy(`${(B.A.trial || B.B.trial) ? TXT.trialText : ''}《蛊码》复盘：${an} 对 ${bn}，${wt}。点开看整场：\n${replayURL(B.replay)}`, a); },
  closeBattle() { closeBattle(); },
  skip() { skip = true; },
  speed() { S.speed = S.speed >= 3 ? 1 : S.speed + 1; const b = $('#bspd'); if (b) b.textContent = S.speed + '×'; save(); },
  codex() { openCodex(); },
  path() { openPath(); },
  ledger() { openLedger({ name: S.name, realm: REALMS[S.realm], rank: REALMS[S.realm] }); },
  settings() { openSettings(); },
  setTheme(a) { S.theme = a.dataset.v; applyTheme(); save(); openSettings(); },
  setMute() { S.mute = !S.mute; save(); snd('pluck'); openSettings(); },
  setCalm() { S.calm = !S.calm; applyCalm(); save(); openSettings(); },
  demo(a) { if (VSC) return; src.demo = a.dataset.m === 'rest' ? 'rest' : 'coding'; meters(); },
  src() {
    if (VSC) { const sl = srcList(bySrc); sheet(`<h3>${TXT.srcHead}</h3><p>${TXT.srcFrom}</p><p class="sm">当前元气 +<b>${fmtTok(rate)}</b>/s</p>${sl.length ? `<ul class="srclist">${sl.map(x => `<li><span>${esc(x.name)}</span><b>${fmtTok(x.rate)}/s</b></li>`).join('')}</ul>` : `<p class="sm">${rate > 0 ? '' : TXT.srcNone}</p>`}`, 'srcinfo'); return; }
    sheet(`<h3>${TXT.demoHead}</h3><p>${TXT.demoFrom}</p><p class="sm">${TXT.demoTrial}</p><p>${TXT.demoInstall}</p><div class="row2"><a class="btn zhu" href="${INSTALL_URL}" target="_blank" rel="noopener">看插件安装方法</a></div><p class="sm">${esc(INSTALL_URL)}</p>`, 'demoinfo');
  },
  reset(a) {
    if (Date.now() - resetArm > 3000) { resetArm = Date.now(); a.textContent = '再点一次确认重开'; setTimeout(() => { a.textContent = '重开一局'; }, 3000); return; }
    const keep = { name: S.name, total: S.total, theme: S.theme, codex: S.codex, mute: S.mute, calm: S.calm, todayKey: S.todayKey, todayTok: S.todayTok, qlim: S.qlim, lgSnap: S.lgSnap, lgAch: S.lgAch, meta: S.meta, combosSeen: S.combosSeen, trial: S.trial, sotaAt: S.sotaAt };
    S = Object.assign(fresh(), keep); renderAll(); save();
  },
};
document.addEventListener('click', e => {
  if (performance.now() - tipLongAt < 500) { e.preventDefault(); return; }   // 长按看提示后松手，不当作点击
  tipHide();
  const a = e.target.closest('[data-act]'); if (!a || a.disabled || performance.now() - dragEndT < 250) return;
  const f = ACT[a.dataset.act]; if (f) f(a, e);
});

// ---------- 算力履历（只显示曲线、日历、额度；灵根和分神加成已删） ----------
ledgerInit({ vsc: VSC, openSettings, buffsOn: false, getLimits: () => S.qlim || {}, setLimit: (k, v) => { S.qlim = Object.assign({}, S.qlim); if (v > 0) S.qlim[k] = v; else delete S.qlim[k]; save(); }, onData: () => {} });

// ---------- 启动 ----------
function boot(saved, pending) {
  const mg = migrate(saved); if (mg) S = Object.assign(fresh(), mg);
  S.meta = metaMigrate(S.meta);
  S.trial = !VSC;   // 网页只有模拟元气，存档一律算试玩；插件只认真实 token
  if (!document.getElementById('gu-defs')) document.body.insertAdjacentHTML('afterbegin', `<svg id="gu-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${ART_DEFS}</defs></svg>`);
  applyTheme(); if (VSC && window.MutationObserver) new MutationObserver(applyTheme).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  booted = true; renderAll(); requestAnimationFrame(veinLoop);
  if (pending && pending.tokens > 0 && S.started) { countTok(pending.tokens); feed(pending.tokens); note(`你不在的时候，攒下了 ${fmtTok(pending.tokens)} 元气`); meters(); }
  if (S.started && !S.compass && !S.dao) rollCompass();
  floorCheck(); checkHash();
  if (S.started) setTimeout(askXing, 600);
}
if (VSC) {
  window.addEventListener('message', e => {
    const m = e.data || {};
    if (m.type === 'init' && !booted) boot(m.save, m.pending);
    else if (m.type === 'duel') openLinkText(m.code);
    else if (m.type === 'share' && booted && S.started) openShare();
  });
  VSC.postMessage({ type: 'ready' });
} else {
  let s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  // 旧玩法的存档不再读取：原样另存一份备份（只存第一次遇到的那份）
  if (s && s.v !== 3) { try { if (!localStorage.getItem(BAK_KEY)) localStorage.setItem(BAK_KEY, JSON.stringify(s)); } catch (e) {} s = null; }
  const go = () => boot(s); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  window.addEventListener('hashchange', checkHash);
}

})();
