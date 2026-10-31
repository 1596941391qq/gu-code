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
// 中毒 / 寄生：u.f.psn = 每回合掉血量。单只身上的毒最多叠到它最大血量的 25%（至少 6），防止毒把后期大血量的蛊秒掉
const poison = (ctx, u, n, k = 'psn') => { if (!ctx.alive(u) || n <= 0) return; u.f[k] = Math.min(Math.max(6, Math.ceil(u.mx * 0.25)), (u.f[k] || 0) + n); status(ctx, u, k, n); };
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
  for (const h of ctx.S[tg.side]) { if (!ctx.alive(h) || !h.tr.aegis) continue; amt = withNM(natMul(h), () => NEW_TRAITS.aegis.hooks.auraTake(ctx, h, h.tr.aegis, tg, amt, src, kind)); }
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
// ---- src/daos.js
// 蛊码 GuCode · 道（占位数据，内容专家交付后整份替换）。纯数据，不 import 任何文件。
// 格式：DAOS[i] = { id, n 名, d 一句话, r2 / r4 = 空窍里同道 2 只 / 4 只时的共鸣 { d 一句话, atk/hp/sh 全体百分比加成 } }
//   atk、hp：开战时同道的蛊攻、血各加百分之几；sh：开战时同道的蛊得到最大血量百分之几的护体。
// 物种属于哪一道：物种自带 dao 字段优先；没有时按 DAO_BY_SCHOOL[物种流派] 推（占位口径）。
const DAOS = [
  { id: 'li', n: '力道', d: '越打越强，先手爆发', r2: { d: '力道的蛊开战攻 +10%', atk: 10 }, r4: { d: '力道的蛊开战攻 +25%', atk: 25 } },
  { id: 'xue', n: '血道', d: '续航与毒，拖得越久越赚', r2: { d: '血道的蛊开战血 +12%', hp: 12 }, r4: { d: '血道的蛊开战血 +30%', hp: 30 } },
  { id: 'jin', n: '金道', d: '护体、减伤、反伤，硬扛', r2: { d: '金道的蛊开战得最大血量 10% 的护体', sh: 10 }, r4: { d: '金道的蛊开战得最大血量 25% 的护体', sh: 25 } },
  { id: 'nu', n: '奴道', d: '召唤一群，以多打少', r2: { d: '奴道的蛊开战攻血 +8%', atk: 8, hp: 8 }, r4: { d: '奴道的蛊开战攻血 +18%', atk: 18, hp: 18 } },
  { id: 'hun', n: '魂道', d: '倒下也有用，亡语接力', r2: { d: '魂道的蛊开战血 +15%', hp: 15 }, r4: { d: '魂道的蛊开战攻血 +20%', atk: 20, hp: 20 } },
  { id: 'zhi', n: '智道', d: '控制、站位、群攻，打乱对面', r2: { d: '智道的蛊开战攻 +8%、得 5% 护体', atk: 8, sh: 5 }, r4: { d: '智道的蛊开战攻 +20%、得 12% 护体', atk: 20, sh: 12 } },
];
const DAO = Object.fromEntries(DAOS.map(d => [d.id, d]));
const DAO_BY_SCHOOL = { 成长: 'li', 爆发: 'li', 斩杀: 'li', 开锋: 'li', 续航: 'xue', 毒: 'xue', 护体: 'jin', 减伤: 'jin', 反伤: 'jin', 召唤: 'nu', 亡语: 'hun', 控制: 'zhi', 站位: 'zhi', 群攻: 'zhi', 破甲: 'zhi' };

// ---- src/foods.js
// 蛊码 GuCode · 食物（占位数据：三类各两个，内容专家交付后整份替换）。纯数据，不 import 任何文件。
// 格式：FOODS[i] = { id, n 名, kind, dao 所属的道（蛊市按主道加权）, cost 元石, d 一句话（写清加什么、给谁、多久） , ...效果字段 }
//   kind 'stat'：买下立刻生效，永久加攻血。to = 'one'（玩家选一只）| 'rand2'（随机两只）| 'all'（空窍全体）；atk、hp = 加多少
//   kind 'gear'：挂在一只蛊身上，每只最多 1 个，换新的旧的就没了；效果在战斗里生效（battle.js 的食物挂件）
//              gear = 'spawn'（倒下化出小蛊：本蛊攻血 pct%）| 'ward'（每次受伤减 n 点）| 'first'（开战攻 +pct%）
//   kind 'trip'：只在下一次出征里有效，出征开始时生效、回洞府清掉。trip = 'heal'（每场开打前回 pct% 血）| 'stone'（战利品元石 +pct%）
// 顺序只能往后加（坐标码按下标记食物挂件）。
const FOODS = [
  { id: 'meat', n: '血肉团', kind: 'stat', dao: 'li', cost: 3, to: 'one', atk: 2, hp: 2, d: '喂给一只蛊：攻 +2、血 +2，永久' },
  { id: 'dew', n: '晨露丸', kind: 'stat', dao: 'xue', cost: 3, to: 'rand2', atk: 1, hp: 2, d: '空窍里随机两只：攻 +1、血 +2，永久' },
  { id: 'egg', n: '孵蛊卵', kind: 'gear', dao: 'nu', cost: 4, gear: 'spawn', pct: 40, d: '挂在一只蛊上：它倒下时原地化出一只小蛊（本蛊攻血的 40%）' },
  { id: 'scale', n: '鳞甲片', kind: 'gear', dao: 'jin', cost: 4, gear: 'ward', n2: 1, d: '挂在一只蛊上：每次受到伤害少 1 点' },
  { id: 'tea', n: '回春茶', kind: 'trip', dao: 'xue', cost: 3, trip: 'heal', pct: 20, d: '下一次出征：每场开打前全队回 20% 血' },
  { id: 'map', n: '寻宝图', kind: 'trip', dao: 'zhi', cost: 3, trip: 'stone', pct: 30, d: '下一次出征：战利品里的元石 +30%' },
];
const FOOD = Object.fromEntries(FOODS.map(f => [f.id, f]));
const FOOD_KIND = { stat: '直接加攻血', gear: '挂件', trip: '出征用' };

// ---- src/timeline.js
// 蛊码 GuCode · 成就道途（占位数据：5 条，内容专家交付后整份替换）。纯数据，不 import 任何文件。
// 格式：TIMELINE[i] = { id, n 名, d 怎么达成（一句话）, need { 事件计数名: 次数 }, after 前置成就 id（可无）, unlock [{ k, id, n }] 解锁什么 }
//   事件计数名：trips 出征次数、clears 秘境通关、realm 境界、merges 合成次数、combos 杀招成形种数、buys 买蛊次数、feeds 喂食次数
//   unlock.k：'species' 新蛊进蛊市 | 'food' 新食物进蛊市 | 'trip' 新秘境 | 'feature' 新玩法
// 成就本身不给数值，只解锁东西。
const TIMELINE = [
  { id: 'first_trip', n: '初入秘境', d: '第一次出征', need: { trips: 1 }, unlock: [{ k: 'food', id: 'tea', n: '回春茶' }] },
  { id: 'first_merge', n: '三蛊归一', d: '第一次合成', need: { merges: 1 }, unlock: [{ k: 'species', id: 'cicada', n: '金蝉蛊' }] },
  { id: 'first_combo', n: '杀招初成', d: '第一次让杀招成形', need: { combos: 1 }, after: 'first_merge', unlock: [{ k: 'food', id: 'egg', n: '孵蛊卵' }] },
  { id: 'feeder', n: '养蛊人', d: '喂食 5 次', need: { feeds: 5 }, unlock: [{ k: 'food', id: 'map', n: '寻宝图' }] },
  { id: 'realm1', n: '一转蛊师', d: '渡劫成功一次', need: { realm: 1 }, after: 'first_trip', unlock: [{ k: 'species', id: 'drum', n: '战鼓蛊' }] },
];
// 一开始就锁着、要靠道途解锁的东西（不在这里的物种、食物默认可用）
const LOCKED = { species: ['cicada', 'drum'], food: ['tea', 'egg', 'map'], trip: [], feature: [] };

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


const MAXV = 3, SLOTS = 7;   // MAXV：本命技层数上限（TRAITS.d(v) 用）；SLOTS：空窍最多 7 格
const REALMS = ['凡人', '一转', '二转', '三转', '四转', '五转'];
const SLOT_BY_REALM = [3, 4, 5, 6, 7, 7];   // 空窍（场上）按境界开放：凡人 3、一转 4、二转 5、三转 6、四转起 7
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
// 各转的主色（升转外貌、转数角标用）：一转青铜、二转赤铁、三转白银、四转黄金、五转紫晶
const ZHENYUAN = { colors: ['#a0703f', '#a0703f', '#a4442c', '#9aa4ab', '#d9a441', '#7d62a8'] };
// 价格（元气 = 消耗的 token）：单位是「千」，乘 tokens.js 的 unit 才是 token 数（插件 8000，网页 200）。
// gu 买一只蛊；refresh 转市；sell 卖蛊退回 = sell × 3^(合成次数)（三只合一只，退回也按三倍走）；食物的价格 = FOODS[].cost × food
const PRICE = { gu: 75, refresh: 25, sell: 25, food: 25 };
// 蛊囊（场下）：凑合成用，不上场、不出征，放在里面绝对安全。固定 8 格
const BAG = { cap: 8 };
const bagCap = () => BAG.cap;
// 攻血成长表：同一种蛊每一转的攻血固定。G[r] = 该转相对一转的倍数；物种的 atk/hp 是它基础转数时的数值。
// 物种可带 st: [[攻,血] × 6]（下标 = 转数）直接覆盖这张表。
const RANK_GROW = [0, 1, 1.8, 3, 4.6, 6.8, 9.6];
function statFor(sp, rank) {
  const s = SP[sp]; if (!s) return { atk: 1, hp: 1 };
  const r = Math.max(1, Math.min(6, rank | 0)); if (s.st && s.st[r]) return { atk: s.st[r][0], hp: s.st[r][1] };
  const k = RANK_GROW[r] / RANK_GROW[Math.max(1, Math.min(6, baseRank(sp)))];
  return { atk: Math.max(1, Math.round(s.atk * k)), hp: Math.max(1, Math.round(s.hp * k)) };
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
const NORMAL_SPECIES = SPECIES.filter(s => !s.immortal);   // 随机池（幽灵、天劫、招蛊）：六转仙蛊只能开茧获得
const SP = Object.fromEntries(SPECIES.map(s => [s.id, s]));
const spTraits = id => [];   // 新蛊出生不带副词条：物种的本事在本命技里（natOf），副词条靠突变、炼附、吞噬
// 本命与转数：本命由物种推出；三转、五转各觉醒一次本命
const natOf = sp => (SP[sp] && SP[sp].nat) || null;
const guRank = g => { const s = SP[g.sp]; if (!s) return 1; return s.immortal ? 6 : rankOf(g); };
const awOf = g => { const r = guRank(g); return r >= 5 ? 2 : r >= 3 ? 1 : 0; };
SPECIES.forEach(s => { if (!s.dao) s.dao = DAO_BY_SCHOOL[s.school] || 'li'; });   // 物种属于哪一道（占位口径见 daos.js）
const SUMMON_NAMES = { pupa: '蛊蛹', shade: '分影', lunar: '月影', ...NEW_SUMMONS };

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

// ---------- 道共鸣 ----------
// 空窍里各道有几只；返回 [{ dao, n, tier: 0/2/4, eff }]，eff = 正在生效的那档（r2 / r4）
function daoCount(team) {
  const c = {}; team.forEach(g => { const d = daoOf(g.sp); c[d] = (c[d] || 0) + 1; });
  return DAOS.filter(d => c[d.id]).map(d => { const n = c[d.id], tier = n >= 4 ? 4 : n >= 2 ? 2 : 0; return { dao: d.id, n, tier, eff: tier ? d['r' + tier] : null }; });
}

// ---------- 蛊市 ----------
// 货架：蛊位 n 个、食物位 2 个；主道（罗盘定）的蛊和食物大约占六成。opts.species / opts.foods = 已解锁可上架的
const SHOP = { guSlots: [3, 3, 4, 4, 5, 5], foodSlots: 2, daoP: 0.6 };
function shopSpecies(realm, unlocked) { return poolFor(realm).filter(sp => SP[sp] && !SP[sp].immortal && (!unlocked || unlocked(sp, 'species'))); }
function shopFoods(unlocked) { return FOODS.filter(f => !unlocked || unlocked(f.id, 'food')).map(f => f.id); }
function pickDao(rng, list, dao, of) { const main = dao ? list.filter(x => of(x) === dao) : []; return main.length && rng() < SHOP.daoP ? rng.pick(main) : rng.pick(list); }
function rollShop(rng, realm, dao, old = [], unlocked) {
  const sps = shopSpecies(realm, unlocked), fds = shopFoods(unlocked), keep = w => w && w.frozen && !w.sold;
  const gu = Array.from({ length: SHOP.guSlots[Math.min(5, realm | 0)] }, (_, i) => { const o = old.filter(w => w.kind === 'gu')[i]; return keep(o) ? o : { kind: 'gu', sp: pickDao(rng, sps, dao, daoOf), frozen: false, sold: false }; });
  const fd = Array.from({ length: SHOP.foodSlots }, (_, i) => { const o = old.filter(w => w.kind === 'food')[i]; return keep(o) ? o : (fds.length ? { kind: 'food', id: pickDao(rng, fds, dao, id => FOOD[id].dao), frozen: false, sold: false } : null); }).filter(Boolean);
  return [...gu, ...fd];
}
const foodCost = id => (FOOD[id] ? FOOD[id].cost : 3) * PRICE.food;   // 单位同 PRICE

// ---------- 收蛊与合成 ----------
const sameRank = (list, sp, rk) => list.filter(g => g.sp === sp && rankOf(g) === rk).length;
const fusable = (team, bag, g) => rankOf(g) < RANK.max && !(SP[g.sp] || {}).immortal && sameRank([...team, ...bag], g.sp, rankOf(g)) >= 2;
// 能否再收一只：空窍或蛊囊有空位，或者它能和已有的同种同转凑成合成
function canTake(team, bag, g, cap, bc = BAG.cap) { return team.length < cap || bag.length < bc || fusable(team, bag, g); }
function canBuy(team, sp, cap, bag = [], bc = BAG.cap) { return canTake(team, bag, { sp, rank: baseRank(sp) }, cap, bc); }
// 收下一只蛊：能合成先合成；否则空窍有空位进空窍，再不行进蛊囊。mode 'bag'（战利品）只进蛊囊。返回 { where, merged }
function placeGu(team, bag, g, cap, bc = BAG.cap, mode = 'shop', pick) {
  if (fusable(team, bag, g)) { bag.push(g); return { where: 'merge', merged: mergeAll(team, bag, pick) }; }
  if (mode === 'shop' && team.length < cap) { team.push(g); return { where: 'team', merged: [] }; }
  if (bag.length < bc) { bag.push(g); return { where: 'bag', merged: mergeAll(team, bag, pick) }; }
  return { where: null, merged: [] };
}
// 同种同转三只合成高一转：空窍和蛊囊一起算，结果留在第一只的位置（空窍优先）。攻血直接换成新一转的表值；
// 挂件食物保留第一只的；蛊性从三只里挑一个：pick(候选蛊性数组) → 选中的那个（不给 pick 就取第一个）。返回合成出的蛊
function mergeAll(team, bag = [], pick) {
  const done = [], rm = x => { const l = team.includes(x) ? team : bag; l.splice(l.indexOf(x), 1); };
  for (let guard = 0; guard < 12; guard++) {
    let grp = null; const all = [...team, ...bag];
    for (const g of all) { const rk = rankOf(g), same = all.filter(x => x.sp === g.sp && rankOf(x) === rk); if (same.length >= 3 && rk < RANK.max && !(SP[g.sp] || {}).immortal) { grp = same.slice(0, 3); break; } }
    if (!grp) break;
    const [a, b, c] = grp, xs = grp.map(x => x.xing).filter(Boolean);
    a.rank = rankOf(a) + 1; const st = statFor(a.sp, a.rank); a.atk = st.atk + (a.bonusA || 0); a.hp = st.hp + (a.bonusH || 0);
    a.xing = xs.length ? (pick && xs.length > 1 ? pick(xs) : xs[0]) : null;
    a.food = a.food || b.food || c.food || null;
    [b, c].forEach(rm);
    done.push(a);
  }
  return done;
}
const sellValue = g => PRICE.sell * Math.pow(3, fuseLv(g));   // 单位同 PRICE

// ---------- 食物 ----------
// 喂一个直接加攻血的食物：targets = 要加的蛊。永久加成记在 bonusA/bonusH（合成换表值时保留）
function feedStat(food, targets) {
  const f = FOOD[food]; if (!f || f.kind !== 'stat') return [];
  targets.forEach(g => { g.bonusA = (g.bonusA || 0) + (f.atk || 0); g.bonusH = (g.bonusH || 0) + (f.hp || 0); g.atk += f.atk || 0; g.hp += f.hp || 0; });
  return targets;
}

// ---------- 程序生成阵容（幽灵、秘境的对手） ----------
// realm 境界（决定蛊池与转数），n 只数，up 每只额外升转的几率，dao 偏向的道（可无）
function genTeam(rng, o = {}) {
  const realm = Math.max(0, Math.min(5, o.realm | 0)), n = Math.max(1, Math.min(SLOTS, o.n || slotCap(realm))), pool = poolFor(realm).filter(sp => SP[sp] && !SP[sp].immortal);
  const team = Array.from({ length: n }, () => { const sp = pickDao(rng, pool, o.dao, daoOf), r = Math.min(RANK.max, baseRank(sp) + (rng() < (o.up || 0) ? 1 : 0) + (rng() < (o.up || 0) / 3 ? 1 : 0)); return newGu(sp, r); });
  return arrangeTeam(team);
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
    const k = natOf(g.sp), T = k ? { [k]: 1 } : {}, q = [], h = g.hp + 3 * (T.shell || 0) + 2 * (T.guard || 0);
    if (i === 0) s += h * 1.3 + g.atk * 0.5 + 2.5 * (T.thorn || 0) + 2 * (T.frenzy || 0) + 1.5 * (T.split || 0) + 4 * (T.vanguard || 0) - 4 * (T.snipe || 0) - 2 * (T.war || 0) - 1.5 * (T.legacy || 0) - (q.includes('timid') ? 4 : 0) + (q.includes('lastgasp') ? 2 : 0);
    else s += 3 * (T.snipe || 0) + (n - i) * 0.15 * h;
    if (T.legacy && t[i + 1]) s += T.legacy * (1 + 0.15 * t[i + 1].atk);
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

function ghostTrio(rng, realm) {
  const names = [...GHOST_NAMES], n = slotCap(realm);
  return [['easy', '易', 0, Math.max(1, n - 1)], ['mid', '中', 0.25, n], ['hard', '难', 0.6, Math.min(SLOTS, n + 1)]].map(([tier, label, up, k]) => ({ tier, label, name: names.splice(rng.int(names.length), 1)[0], team: genTeam(rng, { realm, n: k, up }) }));
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
const OLD_W = { 1: { sp: 4, tr: 4, q: 3, st: 8, mk: 0, rk: 0 }, 2: { sp: 4, tr: 4, q: 3, st: 8, mk: 12, rk: 2 }, 3: { sp: 6, tr: 6, q: 4, st: 10, mk: 16, rk: 3 }, 4: { sp: 6, tr: 6, q: 4, st: 10, mk: 16, rk: 3, fl: 1 } };
const W5 = { sp: 7, rk: 3, st: 10, fd: 6, xg: 6 };
function encodeTeam(team, meta = {}) {
  let bits = ''; const put = (v, n) => { bits += Math.max(0, Math.min(2 ** n - 1, Math.round(v) || 0)).toString(2).padStart(n, '0'); };
  const nm = Array.from(utf8((meta.name || '').slice(0, 8))).slice(0, 31);
  put(5, 3); put(meta.realm || 0, 3); put(Math.min(SLOTS, team.length), 3); put(nm.length, 5); nm.forEach(b => put(b, 8)); put(meta.trial ? 1 : 0, 1);
  const xk = XING_KEYS();
  for (const g of team.slice(0, SLOTS)) {
    put(SPI[g.sp], W5.sp); put(rankOf(g), W5.rk); put(g.atk, W5.st); put(g.hp, W5.st);
    put(g.food && FDI[g.food] != null ? FDI[g.food] + 1 : 0, W5.fd); const xi = g.xing ? xk.indexOf(g.xing) : -1; put(xi + 1, W5.xg); put(g.boss ? 1 : 0, 1);
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
    const ver = get(3); if (ver < 1 || ver > 5) return null;
    const realm = get(3), n = get(3), nl = get(5), nm = []; for (let i = 0; i < nl; i++) nm.push(get(8));
    const team = []; let trial = false;
    if (ver === 5) {
      trial = !!get(1); const xk = XING_KEYS();
      for (let i = 0; i < n; i++) {
        const sp = SPECIES[get(W5.sp)]; if (!sp) return null;
        const rank = Math.max(1, Math.min(6, get(W5.rk))), g = { uid: nuid(), sp: sp.id, rank, atk: Math.max(1, get(W5.st)), hp: Math.max(1, get(W5.st)), food: null, xing: null };
        const fi = get(W5.fd); if (fi && FOODS[fi - 1]) g.food = FOODS[fi - 1].id; const xi = get(W5.xg); if (xi && xk[xi - 1]) g.xing = xk[xi - 1]; if (get(1)) g.boss = 1;
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

// ---- src/battle.js
// 蛊码 GuCode · 斗蛊引擎（纯函数，种子随机，可复现）。输出事件流 + 每步快照，渲染层只负责回放。



const MAXTURN = 60, MAXOPS = 6000, CAP = SLOTS;   // CAP：场上同时存活的上限（与空窍格数一致）

// 战斗只认：攻、血、本命技、挂着的食物、蛊性、杀招、道共鸣、站位（docs/design.md 第 8 节）
// combo = 这只蛊身上成形的杀招（队伍级，由 teamCombos 算出）
function toUnit(g, side, combo) {
  const atk = Math.max(1, g.atk | 0), hp = Math.max(1, g.hp | 0), q = [], tr = {};
  // 本命技由物种推出（不进码）。g.noNat 只给模拟做对照用
  if (!g.noNat) { const k = natOf(g.sp); if (k) tr[k] = 1; }
  return { side, sp: g.sp, name: (g.boss ? '劫·' : '') + (SP[g.sp] ? SP[g.sp].n : SUMMON_NAMES[g.sp]), atk, hp, mx: hp, sh: 0, tr, q, combo: combo ? combo.id : null, cname: combo ? combo.n : null, att: [], boss: !!g.boss, rank: guRank(g), aw: awOf(g), food: g.food || null, xing: g.xing || null, f: {} };
}

// oa / ob：双方的附加参数（秘境用，例如带进来的血量）；旧的道痕参数已删除
function battle(ta, tb, seed, oa = {}, ob = {}) {
  const rng = makeRng(seed); let ops = 0, uidc = 0;
  const MK = [new Set(), new Set()], has = (side, k) => MK[side].has(k), sideF = [{}, {}];
  const roster = {}, log = [], S = [[], []];
  const reg = u => { u.uid = (u.side ? 'b' : 'a') + (uidc++); roster[u.uid] = { sp: u.sp, name: u.name, side: u.side, combo: u.cname, tr: { ...u.tr }, q: u.q, att: u.att, boss: u.boss }; return u; };
  const tA = ta.slice(0, CAP), tB = tb.slice(0, CAP), cA = teamCombos(tA), cB = teamCombos(tB);
  tA.forEach((g, i) => S[0].push(reg(toUnit(g, 0, cA[i]))));
  tB.forEach((g, i) => S[1].push(reg(toUnit(g, 1, cB[i]))));
  const snap = () => S.map(a => a.map(u => [u.uid, u.atk, Math.max(0, u.hp), u.sh]));
  const ev = (t, o = {}) => { o.t = t; if (ctx.nat) o.nat = 1; o.s = snap(); log.push(o); };
  const P = (n, p) => p > 0 ? Math.max(1, Math.round(n * p)) : 0;   // 百分比数值（至少 1）
  const R = (n, p) => Math.round(n * p);   // 每回合叠加的小百分比：不保底，免得攻血很小时 +1 变成 +30%
  const buffR = (u, a, h) => { if (a || h) buff(u, a, h); };
  const alive = u => u && u.hp > 0 && !u.dead;
  const allies = u => S[u.side].filter(alive), foes = u => S[1 - u.side].filter(alive);
  const buff = (u, a, h) => { if (!alive(u)) return; u.atk = Math.min(999, u.atk + a); u.hp = Math.min(999, u.hp + h); u.mx += h; ev('buff', { uid: u.uid, a, h }); };
  const shield = (u, n) => { if (!alive(u) || n <= 0) return; u.sh = Math.min(Math.max(99, 2 * u.mx), u.sh + n); ev('buff', { uid: u.uid, sh: n }); };
  const comboEv = u => ev('combo', { uid: u.uid, n: u.cname });
  const ctx = { S, CAP, rng, roster, sideF, turn: 0, alive, allies, foes, buff, shield, deal, summon, hook, ev, has, reg, comboEv };   // [BX]

  function deal(src, tg, amt, kind, crit) {
    if (!alive(tg) || amt <= 0) return;
    if (src && src.side !== tg.side && (kind === 'hit' || kind === 'skill') && !tg.f.guarded && !tg.tr.guard) {   // 护卫：相邻友蛊第一次挨打时代受
      const arr = S[tg.side], i = arr.indexOf(tg), gd = [arr[i - 1], arr[i + 1]].find(x => alive(x) && x.tr.guard);
      if (gd) { tg.f.guarded = 1; ev('trig', { uid: gd.uid, id: 'guard' }); tg = gd; }
    }
    if (tg.q.includes('greedy')) amt += 1;
    amt = BX.dmgMod(ctx, src, tg, amt, kind); if (amt <= 0) return;   // [BX]
    const had = tg.sh > 0; let a = amt;
    if (tg.sh > 0) { const s = Math.min(tg.sh, a); tg.sh -= s; a -= s; }
    tg.hp -= a;
    if (tg.hp <= 0 && tg.q.includes('lastgasp') && !tg.f.gasp) { tg.hp = 1; tg.f.gasp = 1; ev('trig', { uid: tg.uid, q: 'lastgasp' }); }
    if (tg.hp <= 0 && src) tg.killer = src;
    ev('dmg', { uid: tg.uid, n: a, blk: amt - a, k: kind, src: src ? src.side : -1, crit: crit ? 1 : 0 });
    hook(tg, 'hurt', { src, kind, had, n: amt });
  }
  function summon(side, idx, spec, by) {
    const arr = S[side]; if (arr.filter(alive).length >= CAP) return null;
    const qa = has(side, 'qunGu') ? P(spec.atk, 0.3) : 0, qh = has(side, 'qunGu') ? P(spec.hp, 0.3) : 0;
    const u = reg({ side, sp: spec.sp, name: SUMMON_NAMES[spec.sp], atk: Math.max(1, spec.atk + qa), hp: Math.max(1, spec.hp + qh), mx: Math.max(1, spec.hp + qh), sh: 0, tr: {}, q: [], combo: null, cname: null, att: [], f: {} });
    arr.splice(Math.max(0, Math.min(idx, arr.length)), 0, u);
    ev('summon', { uid: u.uid, by: by && by.uid });
    for (const o of arr.slice()) if (o !== u && alive(o)) hook(o, 'ally', { u });
    return u;
  }
  function hook(u, h, c) {
    if (++ops > MAXOPS) return;
    const reps = h === 'faint' && u.q.includes('martyr') ? 2 : 1;
    for (let r = 0; r < reps; r++) {
      const fired = run(u, h, c);
      if (fired && u.q.includes('echo') && rng() < 0.35) { ev('trig', { uid: u.uid, q: 'echo' }); run(u, h, c); }
    }
  }
  function run(u, h, c) {
    const T = u.tr; let fired = false;
    const tg = id => { fired = true; ev('trig', { uid: u.uid, id }); };
    if (h === 'start') {
      if (T.strike) {
        tg('strike'); const d = P(u.atk, 0.2 * T.strike * (has(u.side, 'xianSheng') ? 1.5 : 1));
        if (u.combo === 'liaoyuan') { comboEv(u); foes(u).forEach(f => deal(u, f, Math.ceil(d / 2), 'skill')); }
        else { const fs = foes(u); if (fs.length) deal(u, rng.pick(fs), d, 'skill'); }
      }
      if (T.shell && alive(u)) { tg('shell'); shield(u, P(u.mx, 0.08 * T.shell)); }
      if (T.guard && alive(u)) { tg('guard'); shield(u, P(u.mx, 0.06 * T.guard)); }
      const pos = S[u.side].indexOf(u);
      if (T.link && alive(u)) { tg('link'); [S[u.side][pos - 1], S[u.side][pos + 1]].forEach(a => { if (alive(a)) buff(a, P(a.atk, 0.05 * T.link), P(a.mx, 0.05 * T.link)); }); }
      if (T.vanguard && pos === 0 && alive(u)) { tg('vanguard'); buff(u, P(u.atk, 0.04 * T.vanguard), P(u.mx, 0.08 * T.vanguard)); }
      if (T.snipe && pos > 0 && alive(u)) { const fs = foes(u); if (fs.length) { tg('snipe'); deal(u, fs[fs.length - 1], P(u.atk, 0.2 * T.snipe), 'skill'); } }
      if (u.combo === 'sanzhu' && alive(u)) { comboEv(u); fired = true; const dd = P(u.atk, 0.25); foes(u).slice(0, 3).forEach(f => deal(u, f, dd, 'skill')); }
      if (u.combo === 'jinjia' && alive(u)) { comboEv(u); fired = true; shield(u, P(u.mx, 0.15)); }
    } else if (h === 'turn') {
      if (T.war) { const a = allies(u)[0]; if (a) { tg('war'); buff(a, P(a.atk, 0.03 * T.war), 0); } }
      if (u.combo === 'pozhen') { comboEv(u); fired = true; allies(u).forEach(a => buffR(a, R(a.a0 || a.atk, 0.03), R(a.h0 || a.mx, 0.03))); }
      if (u.q.includes('blood')) deal(null, u, 1, 'self');
      if (u.q.includes('timid') && alive(u) && allies(u)[0] !== u) buff(u, 0, 1);
    } else if (h === 'hurt') {
      const s = c.src;
      if (T.thorn && s && c.kind !== 'thorn' && c.kind !== 'mirror' && alive(s) && s.side !== u.side) { tg('thorn'); let d = P(c.n || 1, 0.15 * T.thorn * (has(u.side, 'fanShi') ? 1.5 : 1)); if (u.combo === 'jinjia' && c.had) d *= 2; deal(u, s, d, 'thorn'); }
      if (alive(u)) {
        if (T.frenzy && s && s.side !== u.side) { tg('frenzy'); buff(u, P(u.a0 || u.atk, 0.04 * T.frenzy), 0); }
        if (T.split && !u.f.split && s) { u.f.split = 1; tg('split'); summon(u.side, S[u.side].indexOf(u) + 1, { sp: 'shade', atk: P(u.atk, 0.12 * T.split), hp: P(u.mx, 0.12 * T.split) }, u); }
        if (u.combo === 'wangu' && !u.f.wangu && s) { u.f.wangu = 1; fired = true; comboEv(u); summon(u.side, S[u.side].indexOf(u) + 1, { sp: 'pupa', atk: P(u.atk, 0.12), hp: P(u.mx, 0.12) }, u); }
        if (u.combo === 'jingji' && s && s.side !== u.side) { fired = true; ev('combo', { uid: u.uid, n: u.cname, quiet: 1 }); allies(u).forEach(a => shield(a, P(u.mx, 0.04))); }
      }
    } else if (h === 'kill') {
      if (T.devour) { tg('devour'); buff(u, P(u.atk, 0.06 * T.devour), P(u.mx, 0.06 * T.devour)); }
      if (u.q.includes('greedy')) buff(u, P(u.atk, 0.1), P(u.mx, 0.1));
      if (has(u.side, 'shiHun')) buff(u, P(u.atk, 0.05), P(u.mx, 0.05));
      if (u.combo === 'duopo' && !u.f.duopo) { const f = foes(u)[0]; if (f) { u.f.duopo = 1; fired = true; comboEv(u); deal(u, f, u.atk, 'skill'); } }
      if (u.combo === 'fenshen') { comboEv(u); fired = true; foes(u).forEach(f => deal(u, f, P(u.atk, 0.2), 'skill')); }
    } else if (h === 'faint') {
      const arr = S[u.side];
      const yz = has(u.side, 'yiZe') ? 1 : 0;
      if (T.legacy) { const b = arr[c.idx], lv = T.legacy + yz; if (alive(b)) { tg('legacy'); buff(b, P(b.a0 || b.atk, 0.08 * lv), P(b.h0 || b.mx, 0.08 * lv)); } }
      if (T.spawn) { tg('spawn'); const sv = T.spawn + yz; summon(u.side, c.idx, { sp: 'pupa', atk: P(u.atk, 0.15 * sv), hp: P(u.mx, 0.15 * sv) }, u); }
      if (u.combo === 'shishan') { comboEv(u); fired = true; summon(u.side, c.idx, { sp: 'lunar', atk: Math.max(1, Math.ceil(u.atk / 2)), hp: P(u.mx, 0.4) }, u); }
    } else if (h === 'ally') {
      if (T.rally) { tg('rally'); buff(u, P(u.a0 || u.atk, 0.03 * T.rally), P(u.h0 || u.mx, 0.03 * T.rally)); }
      if (u.combo === 'wangu') { fired = true; ev('combo', { uid: u.uid, n: u.cname, quiet: 1 }); allies(u).forEach(a => buffR(a, R(a.a0 || a.atk, 0.03), R(a.h0 || a.mx, 0.03))); }
    }
    if (BX.dispatch(ctx, h, u, c)) fired = true;   // [BX]
    return fired;
  }
  function reap() {
    for (let guard = 0; guard < 200; guard++) {
      const dead = [...S[0], ...S[1]].filter(u => u.hp <= 0 && !u.dead);
      if (!dead.length) { if (BX.settle(ctx)) continue; return; }   // [BX] 炉口换人、光阴回溯
      for (const u of dead) {
        if (u.dead) continue;
        if (u.combo === 'tuoke' && !u.f.tuoke) {
          u.f.tuoke = 1; u.hp = Math.max(1, Math.ceil(u.mx / 2)); u.killer = null;
          comboEv(u); continue;
        }
        if (has(u.side, 'buMie') && !sideF[u.side].buMie) { sideF[u.side].buMie = 1; u.hp = 1; u.killer = null; ev('trig', { uid: u.uid, mk: 'buMie' }); continue; }
        if (BX.saveDeath(ctx, u)) continue;   // [BX]
        const arr = S[u.side], idx = arr.indexOf(u);
        if (idx >= 0) arr.splice(idx, 1);
        u.dead = true; ev('faint', { uid: u.uid });
        if (u.killer && alive(u.killer) && u.killer.side !== u.side) hook(u.killer, 'kill', { victim: u });
        hook(u, 'faint', { idx: Math.max(0, idx) });
      }
    }
  }

  ev('begin');
  for (const side of [0, 1]) {
    if (has(side, 'luKou') && S[side][0]) { ev('trig', { uid: S[side][0].uid, mk: 'luKou' }); buff(S[side][0], P(S[side][0].atk, 0.2), 0); }
    if (has(side, 'tieBi')) S[side].forEach(u => shield(u, P(u.mx, 0.1)));
    if (has(side, 'shaZhao')) S[side].forEach(u => { if (u.combo) buff(u, P(u.atk, 0.2), P(u.mx, 0.2)); });
  }
  BX.begin(ctx);   // [BX] 布阵：开战快照、换位、吞噬
  const order = () => [...S[0], ...S[1]].filter(alive).sort((x, y) => y.atk - x.atk || x.side - y.side);
  for (const u of order()) if (alive(u)) hook(u, 'start', {});
  reap();
  let turn = 0, winner;
  for (;;) {
    if (!S[0].length || !S[1].length) { winner = !S[0].length && !S[1].length ? 'draw' : S[0].length ? 'A' : 'B'; break; }
    if (++turn > MAXTURN) { winner = 'draw'; turn = MAXTURN; break; }
    ev('turn', { n: turn }); ctx.turn = turn;
    for (const u of order()) { u.f.duopo = 0; if (alive(u)) hook(u, 'turn', {}); }
    reap();
    if (!S[0].length || !S[1].length) continue;
    const a = S[0][0], b = S[1][0];
    const pa = Math.max(1, a.atk - (a.q.includes('timid') ? 2 : 0)), pb = Math.max(1, b.atk - (b.q.includes('timid') ? 2 : 0));
    const ca = rng() < BATTLE.crit, cb = rng() < BATTLE.crit;
    ev('clash', { a: a.uid, b: b.uid });
    const pa2 = BX.atkMod(ctx, a, pa, b), pb2 = BX.atkMod(ctx, b, pb, a);   // [BX] 定身 / 扑空 / 疾袭
    deal(a, b, ca ? pa2 * BATTLE.critMul : pa2, 'hit', ca && pa2 > 0); deal(b, a, cb ? pb2 * BATTLE.critMul : pb2, 'hit', cb && pb2 > 0);
    BX.afterClash(ctx, a, b);
    reap();
  }
  ev('end', { w: winner });
  return { winner, turns: turn, log, roster, ops, capped: ops > MAXOPS };
}

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

// ---------- 升转外貌：在任何物种的原画上叠程序化图层，不改原画 ----------
// 一转原样；二转飞白墨纹、体型略大；三转身后一圈真元色晕染；四转金线勾边、晕染更浓、脚下一方小印；
// 五转头光、周身墨气缓缓流动（.g-qi，可被 calm / prefers-reduced-motion 关掉）；六转仙蛊：金朱背光、双线描金、金箔、仙印。
// 品质（rarity）不画在虫身上，用 rarityFrame(r) 给卡片加边框和角标。
const GU_BOX = [12, 28, 78, 52];   // 没登记的物种（含以后新加的）用这个外框 [x, y, w, h]
const RANK_BOX = { boar: [16, 33, 74, 49], fire: [12, 39, 83, 35], twin: [4, 13, 80, 65], iron: [20, 28, 72, 52], thorn: [10, 43, 85, 33], mantis: [12, 12, 79, 67], bone: [16, 48, 66, 29], queen: [7, 20, 84, 57], cicada: [12, 47, 79, 31], drum: [26, 21, 67, 63], scorp: [17, 25, 75, 56], moth: [14, 20, 68, 76], pupa: [26, 47, 60, 26], shade: [4, 13, 80, 65], lunar: [14, 20, 68, 76] };
const RANK_HEAD = { boar: [74, 53], fire: [82, 57], twin: [69, 50], iron: [86, 60], thorn: [87, 56], mantis: [73, 31], bone: [71, 56], queen: [76, 49], cicada: [79, 54], drum: [76, 59], scorp: [64, 62], moth: [67, 48], pupa: [74, 58], shade: [69, 50], lunar: [67, 48] };
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
//   TRIP.start(api)        玩家在洞府确认出征后调用一次。秘境自己往 S.trip 写状态，画在 <section id="trip"> 里（api.el）。
//   TRIP.feed(S, tok)      出征中每次有 token 进账调用（洞府攒着的灵气 S.bank 出征时由秘境自己先用掉）。
//   TRIP.render(api)       洞府重绘时、读档后出征仍未结束时调用，让秘境把界面画回来。
//   TRIP.active(S)         可选：出征中返回 true（默认按 !!S.trip 判断）。
// 洞府提供的 api（TRIP.api，启动时就挂好）：
//   api.S()                当前存档对象（直接读写；改完调 api.save()）
//   api.save()             落盘（节流）
//   api.el                 <section id="trip"> 元素
//   api.playBattle(foeTeam, opts) → Promise<{ res, A, B }>：复用洞府的战斗回放；opts = { title, team（默认 S.team）, seed, oa, ob }
//                          oa / ob 原样传给 battle() 的第 4、5 个参数（血量延续等由秘境在 battle.js 里处理）
//   api.onTripEnd(result)  秘境结束（撤退、通关或全灭）时调用一次。
//                          result = { dead: [uid], survivors: [uid], loot: { stone, foods: [id], gu: [蛊对象] }, cleared, wiped }
//                          洞府负责：删掉倒下的蛊、发战利品（全灭时秘境应传空 loot）、cleared 时渡劫（境界 +1，全屏）、全员回满、
//                          清掉 S.trip 和只在这次出征有效的食物（S.tripFood）、罗盘重转、蛊市刷新。
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
  qiTip: '元气就是你在 AI 编程工具里消耗的 token，没有上限，也没有别的来源。买蛊、买食物、转市花元气；出征时先用攒下的元气一口气往深处走，用完靠实时 token。',
  qiTrial: '网页版是模拟元气（存档标「试玩」）。',
  sota: '你正在用 Claude，蛊的伤害 +1%',
  slotsHead: '空窍',
  slotsSub: '场上 · 出征时全部跟去',
  bagHead: '蛊囊',
  bagSub: '场下 · 凑合成用 · 不出征，绝对安全',
  bagTip: () => `蛊囊 ${S.bag.length}/${BC()}：场下的蛊放这里，不上场、不出征，所以绝对安全。主要用来凑合成：空窍和蛊囊里同种同转的蛊凑够三只，自动合成高一转。拖进空窍就上场。`,
  shopHead: '蛊市',
  shopTip: '花元石买蛊和食物。主道的蛊和食物大约占六成。转市换一批，冻结的货下次还在。',
  refresh: c => `转市 · ${c}`,
  freeze: on => on ? '解冻' : '冻结',
  daoNone: '还没定主道',
  daoLine: d => `本轮主道：${DAO[d] ? DAO[d].n : d}`,
  daoTip: '每次回到洞府转一次罗盘，三选一定下本轮蛊市的主道：货架上大约六成的蛊和食物出自这一道。罗盘不加属性。',
  compassHead: '罗盘 · 三选一主道',
  compassSub: '选一道，本轮蛊市大约六成的蛊和食物出自这一道。',
  resoNone: '道共鸣：同一道的蛊在空窍里有 2 只、4 只时触发',
  go: '出征',
  goSub: n => `空窍里的 ${n} 只蛊全部出征`,
  goWarn: '在秘境战斗中倒下的蛊会永远消失。蛊囊里的蛊留在洞府，绝对安全。可以随时撤退，带回战利品和活着的蛊；全员倒下就是全灭，这次的战利品全部丢失。',
  goSoon: '秘境还在开凿，出征下一版就来。先在洞府里买蛊、合成、排阵。',
  inTrip: '队伍正在秘境里。出征中不能逛蛊市、不能换阵。',
  merge: g => `三只合一：炼成${rankName(g)}，攻 ${g.atk} 血 ${g.hp}`,
  toBag: g => `${rankName(g)} 进了蛊囊（空窍满了）`,
  bagFull: '空窍和蛊囊都满了：先卖掉一只，或凑成合成',
  sold: (g, v) => `卖掉${rankName(g)}，退回 ${fmtTok(v)} 元气`,
  bought: g => `买下${rankName(g)}`,
  foodPick: f => `把「${f.n}」喂给哪一只？`,
  gearPick: f => `把「${f.n}」挂在哪一只身上？每只最多挂 1 个，换新的旧的就没了。`,
  tripFood: f => `「${f.n}」收好了，下一次出征生效`,
  fed: (f, gs) => `${f.n}：${gs.map(g => SP[g.sp].n).join('、')} 攻 +${f.atk || 0} 血 +${f.hp || 0}`,
  geared: (f, g) => `${SP[g.sp].n} 挂上了「${f.n}」`,
  floor: g => `洞府里一只蛊都没有了，免费领到${rankName(g)}`,
  poor: (need) => `元气不够：还差 ${fmtTok(need)}，写会儿代码就有了`,
  spar: '纯切磋：不死蛊，也不给东西',
  trib: r => `渡劫成功 · ${REALMS[r]}`,
  tribLines: r => [`空窍多开一格：现在 ${slotCap(r)} 格`, `蛊市进新档：能买到${RANK.names[Math.min(5, r + 1)]}的蛊`, '罗盘会转出新的道'],
  comboFirst: c => `杀招成形 · ${c.n}`,
  comboLines: (c, g) => [`${c.need.map(x => SP[x].n).join(' + ')} 同时在空窍，杀招自动成形`, `挂在${SP[g.sp].n}身上：${c.d}`, '蛊卡上的朱印就是它，悬停能看配方和效果'],
  achFirst: a => `道途 · ${a.n}`,
  achLines: a => [a.d + '：达成', ...(a.unlock || []).map(u => `解锁${{ species: '新蛊', food: '新食物', trip: '新秘境', feature: '新玩法' }[u.k] || ''}：${u.n}`)],
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
const fresh = () => ({ v: 3, started: false, name: '', realm: 0, bank: 0, total: 0, team: [], bag: [], shop: [], dao: null, compass: null, tripFood: [], pantry: [], trip: null,
  seed: (Math.random() * 1e9) >>> 0, step: 0, speed: 1, mute: true, theme: 'auto', calm: false, codex: {}, combosSeen: [], log: [], hlog: [], meta: null, todayKey: '', todayTok: 0, ghosts: null, trial: false, sotaAt: 0 });
const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const curCap = () => Math.max(slotCap(S.realm), S.team.length), BC = () => Math.max(bagCap(S.realm), S.bag.length);
const migrate = s => s && s.v === 3 ? s : null;
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
    if (VSC) VSC.postMessage({ type: 'save', data: S, status: { started: S.started, node: tripOn() ? '秘境' : null, cost: 0, prog: 0, realm: S.realm } });
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
// 元气进账：洞府里直接存进 S.bank（没有上限）；出征中交给秘境（它自己决定先花攒下的元气还是实时的）
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
function achieve(k, n, o) { metaEmit(M(), k, n, o).forEach(a => big('ach', TXT.achFirst(a), TXT.achLines(a))); }

// ---------- 渲染 ----------
const unlocked = (id, k) => isUnlocked(M(), id, k);
function renderAll() {
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
const natDesc = sp => { const k = natOf(sp); return k && TRAITS[k] ? `本命·${TRAITS[k].n}：${TRAITS[k].d(1, natMulFor(SP[sp].rank))}` : ''; };
const natOfG = g => { const k = natOf(g.sp); return k && TRAITS[k] ? { n: TRAITS[k].n, ch: TRAITS[k].ch, d: TRAITS[k].d(1, natMulFor(rankOf(g))), aw: awOf(g) } : null; };
function mainHTML() {
  return `<header class="top"><div class="brand"><b class="logo">蛊码</b><span class="sub">烧 Token · 养蛊 · 闯秘境</span></div>
  <div class="tools"><span class="realm" id="realm" data-tip="${esc(`境界：${REALMS[S.realm]}。秘境最深处是渡劫首领，赢了境界加一：多开一格空窍，蛊市进新档，罗盘出新的道。`)}">${REALMS[S.realm]}</span><button class="ib gear" data-act="settings" title="设置" aria-label="设置"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm7.4 4.6.1-1.2-.1-1.2 2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.6 3h-4l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6-.1 1.2.1 1.2-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4z"/></svg></button><button class="ib zhu" data-act="share">战帖</button></div></header>
  <section class="vein"><div class="vread"><div class="vrate" data-tip-fn="qi"><span class="vlab">元气</span><b id="qiTxt">0</b><span id="sota" class="sota" data-tip="${esc(TXT.sota)}" hidden>SOTA</span></div><div class="vtot"><span id="totTxt"></span><button class="chip" data-act="src" id="srcTag"></button></div></div><div class="vsrc" id="srcRates" hidden></div></section>
  <div class="seg" id="demo">${[['coding', '写代码中'], ['rest', '停手休息']].map(([m, t]) => `<button data-act="demo" data-m="${m}">${t}</button>`).join('')}</div>
  <section class="home" id="home"></section>
  <section class="trip" id="trip"></section>
  <footer class="foot"><button data-act="duelInput">粘贴坐标码应战</button><button data-act="ghost">斗幽灵</button><button data-act="codex">蛊典</button><button data-act="path">道途</button><button data-act="ledger">履历</button><button data-act="reset" id="bReset">重开一局</button></footer>`;
}
function guCard(g, i, combos) {
  const c = combos && combos[i], nat = natOfG(g), f = g.food && FOOD[g.food];
  return `<button class="gu${i === 0 ? ' lead' : ''}" data-act="gu" data-i="${i}" data-uid="${g.uid}" data-drag="${i}" data-tip-fn="gu">
  <span class="art">${guSVG(g.sp, { rank: rankOf(g) })}</span><span class="rk rk${rankOf(g)}">${RANK.ch[rankOf(g)]}</span>${c ? `<span class="mseal">${esc(c.n[0])}</span>` : ''}
  <span class="nm">${SP[g.sp].n}</span><span class="st"><i class="a">${g.atk}</i><i class="h">${g.hp}</i></span>
  <span class="tr">${nat ? `<span class="tc nat">${esc(nat.ch)}</span>` : ''}${f ? `<span class="tc food">${esc(f.n[0])}</span>` : ''}${g.xing ? `<span class="tc xing">${esc(String(g.xing)[0])}</span>` : ''}</span></button>`;
}
function renderHome() {
  const box = $('#home'); if (!box) return;
  const t = tripOn();
  box.classList.toggle('away', t);
  box.innerHTML = `<div class="hhead"><span class="lbl" data-tip="${esc(TXT.daoTip)}">${S.dao ? TXT.daoLine(S.dao) : TXT.daoNone}</span><span id="reso" class="reso"></span></div>
  <section class="qiao" id="qiao"><div class="qhead"><span class="lbl">${TXT.slotsHead} <small>${TXT.slotsSub}</small></span><span class="qmeta">${S.team.length}/${slotCap(S.realm)}</span></div><div class="slots" id="slots"></div>
  <div class="bagline" id="bagline"></div></section>
  <ul class="hlog" id="hlog"></ul>
  ${t ? `<p class="hint">${TXT.inTrip}</p>` : S.compass ? compassHTML() : `<section class="shop" id="shop"></section>`}
  ${t ? '' : `<div class="gorow"><button class="zhu big go" data-act="go"${S.team.length ? '' : ' disabled'}>${TXT.go}<small>${TXT.goSub(S.team.length)}</small></button></div>`}`;
  renderSlots(); renderBagLine(); renderShop(); renderReso(); renderLog();
}
function renderSlots() {
  const box = $('#slots'); if (!box) return;
  const cap = slotCap(S.realm), n = Math.min(SLOTS, Math.max(S.team.length, cap)), combos = teamCombos(S.team);
  box.style.setProperty('--cn', Math.min(n, 7));
  box.innerHTML = Array.from({ length: n }, (_, i) => S.team[i] ? guCard(S.team[i], i, combos) : `<div class="gu empty" data-drag="${i}"><span>${i < cap ? '空' : '未开'}</span></div>`).join('');
  box.dataset.sort = 'team'; box.dataset.group = 'main';
}
function renderBagLine() {
  const b = $('#bagline'); if (!b) return;
  b.innerHTML = `<div class="bhead" data-tip-fn="bag"><span class="lbl">${TXT.bagHead} <small>${TXT.bagSub}</small></span><span class="qmeta">${S.bag.length}/${BC()}</span></div>
  <div class="mini bagrow" data-sort="bag" data-group="main">${Array.from({ length: BC() }, (_, i) => { const g = S.bag[i]; return g ? `<div class="mg" data-drag="${i}" data-act="bagGu" data-i="${i}" data-tip-fn="bg"><span class="art">${guSVG(g.sp, { rank: rankOf(g) })}</span><span class="rk rk${rankOf(g)}">${RANK.ch[rankOf(g)]}</span><b>${SP[g.sp].n}</b><span class="st"><i class="a">${g.atk}</i><i class="h">${g.hp}</i></span></div>` : `<div class="mg empty" data-drag="${i}"></div>`; }).join('')}</div>`;
}
function renderReso() {
  const r = $('#reso'); if (!r) return;
  const dc = daoCount(S.team).sort((a, b) => b.tier - a.tier || b.n - a.n);
  const on = dc.filter(x => x.tier);
  setHTML(r, on.length ? on.map(x => `<span class="ro on" data-tip="${esc(`${DAO[x.dao].n}：空窍里 ${x.n} 只。2 只：${DAO[x.dao].r2.d}；4 只：${DAO[x.dao].r4.d}`)}">${DAO[x.dao].n}${x.n} · ${esc(x.eff.d)}</span>`).join('') : `<span class="ro">${esc(TXT.resoNone)}</span>`);
}
// ---------- 罗盘：回到洞府时三选一主道 ----------
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
    return `<div class="ware food${w.frozen ? ' frozen' : ''}${w.sold ? ' sold' : ''}"><button class="wbuy" data-act="ware" data-i="${i}" data-tip-fn="ware"${w.sold ? ' disabled' : ''}><span class="fart">${esc(f.n[0])}</span><b>${esc(f.n)}</b><small>${FOOD_KIND[f.kind]}</small><span class="tag">${w.sold ? '已购' : fmtTok(c)}</span></button></div>`;
  }
  const s = SP[w.sp], st = statFor(w.sp, baseRank(w.sp)), c = price(PRICE.gu), merge = !w.sold && owned(w.sp) >= 2;
  return `<div class="ware${w.frozen ? ' frozen' : ''}${w.sold ? ' sold' : ''}${merge ? ' merge' : ''}"><button class="wbuy" data-act="ware" data-i="${i}" data-tip-fn="ware"${w.sold ? ' disabled' : ''}><span class="art">${guSVG(w.sp)}</span><b>${s.n}</b><span class="st"><i class="a">${st.atk}</i><i class="h">${st.hp}</i></span><span class="tag">${w.sold ? '已购' : (merge ? '合成 · ' : '') + fmtTok(c)}</span>${merge ? '<span class="fu">可合成</span>' : ''}</button></div>`;
}
function renderShop() {
  const box = $('#shop'); if (!box) return;
  if (!S.shop.length) newShop();
  box.innerHTML = `<div class="shead"><span class="lbl" data-tip="${esc(TXT.shopTip)}">${TXT.shopHead}</span><button class="mini-b" data-act="refresh">${TXT.refresh(fmtTok(price(PRICE.refresh)))}</button></div>
  <div class="wares">${S.shop.map(wareHTML).join('')}</div>${S.pantry.length ? `<div class="pantry"><span class="lbl">带回的食物</span>${S.pantry.map((id, i) => `<button class="pfood" data-act="pantry" data-i="${i}" data-tip="${esc(FOOD[id] ? FOOD[id].d : '')}">${esc(FOOD[id] ? FOOD[id].n : id)}</button>`).join('')}</div>` : ''}${S.tripFood.length ? `<p class="sm">下一次出征带着：${S.tripFood.map(id => FOOD[id] ? FOOD[id].n : id).join('、')}</p>` : ''}`;
}
// 新得一只蛊：能合成先合成；蛊市买的先进空窍再进蛊囊；战利品只进蛊囊
function placeNew(g, mode = 'shop') {
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
  const combos = teamCombos(S.team), seen = S.combosSeen || (S.combosSeen = []);
  Object.entries(combos).forEach(([i, c]) => { if (!seen.includes(c.id)) { seen.push(c.id); big('combo', TXT.comboFirst(c), TXT.comboLines(c, S.team[i])); achieve('combos', 1); } });
  merged.forEach(x => { const n = document.querySelector(`.gu[data-uid="${x.uid}"]`); if (n) { try { fuseRankUp(n, { sp: x.sp, from: rankOf(x) - 1, to: rankOf(x), calm: !!S.calm }); } catch (e) {} } });
  floorCheck();
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
  if (f.kind === 'trip') { S.tripFood.push(id); note(TXT.tripFood(f)); achieve('feeds', 1); return true; }
  if (f.kind === 'stat' && f.to !== 'one') {
    if (!S.team.length) return false;
    const r = R(), tg = f.to === 'all' ? S.team.slice() : S.team.slice().sort(() => r() - 0.5).slice(0, 2);
    feedStat(id, tg); note(TXT.fed(f, tg)); tg.forEach(g => fxFloat(g.uid, `+${f.atk || 0}/+${f.hp || 0}`, 'buff')); achieve('feeds', 1); return true;
  }
  FEED = { id, from, i };
  sheet(`<h3>${esc(f.kind === 'gear' ? TXT.gearPick(f) : TXT.foodPick(f))}</h3><p class="sm">${esc(f.d)}</p><div class="mini pick">${[...S.team, ...S.bag].map((g, k) => `<button class="mg" data-act="feedTo" data-k="${k}"><span class="art">${guSVG(g.sp, { rank: rankOf(g) })}</span><b>${SP[g.sp].n}</b><span class="st"><i class="a">${g.atk}</i><i class="h">${g.hp}</i></span>${g.food ? `<small>挂着${esc(FOOD[g.food] ? FOOD[g.food].n : '')}</small>` : ''}</button>`).join('')}</div>`);
  return null;   // 等玩家挑
}
function feedTo(g) {
  const f = FEED && FOOD[FEED.id]; if (!f || !g) return;
  const fr = FEED; FEED = null;
  if (fr.from === 'shop') { const w = S.shop[fr.i]; if (!w || w.sold || !pay(foodCost(w.id))) { closeSheet(); return; } w.sold = true; w.frozen = false; }
  else S.pantry.splice(fr.i, 1);
  if (f.kind === 'gear') { g.food = f.id; note(TXT.geared(f, g)); }
  else { feedStat(f.id, [g]); note(TXT.fed(f, [g])); }
  achieve('feeds', 1); closeSheet(); renderHome(); save(); fxFloat(g.uid, f.kind === 'gear' ? f.n : `+${f.atk || 0}/+${f.hp || 0}`, 'buff');
}
// ---------- 出征（秘境由另一侧实现，见 hooks.js）----------
function goSheet() {
  sheet(`<h3>${TXT.go}</h3><p>${esc(TXT.goSub(S.team.length))}：</p>${miniRow(S.team)}<p class="trialnote">${esc(TXT.goWarn)}</p><p class="sm">攒着的元气 ${fmtTok(S.bank)}：出征时先用它一口气往深处走。</p><div class="row2"><button class="zhu big" data-act="goConfirm">确认出征</button></div>`);
}
function onTripEnd(result = {}) {
  const dead = new Set(result.dead || []), loot = result.loot || {};
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
  if (result.cleared && S.realm < 5) { S.realm++; big('trib', TXT.trib(S.realm), TXT.tribLines(S.realm)); achieve('realm', S.realm, { set: true }); achieve('clears', 1); }
  rollCompass(); S.shop = S.shop.filter(w => w.frozen && !w.sold);
  renderAll(); save(); floorCheck();
}
// 给秘境复用的战斗回放：返回 Promise<{ res, A, B }>
function tripPlayBattle(foeTeam, opts = {}) {
  const team = opts.team || S.team, seed = opts.seed || ((S.seed ^ Math.imul(++S.step, 2654435761)) >>> 0).toString(36);
  const sota = { A: sotaOn(), B: false };
  const res = battle(team, foeTeam, 'r:' + seed, { ...(opts.oa || {}), sota }, opts.ob || {});
  const A = { team, name: S.name || '无名蛊师', realm: S.realm, trial: S.trial }, B = { team: foeTeam, name: opts.foeName || '秘境', realm: S.realm };
  return new Promise(resolve => playBattle({ kind: 'trip', title: opts.title || '秘境 · 斗蛊', res, A, B, sota, done: () => resolve({ res, A, B }) }));
}
TRIP.api = { S: () => S, save, get el() { return $('#trip'); }, playBattle: tripPlayBattle, onTripEnd, big, note, float: (uid, t, k) => fxFloat(uid, t, k || 'buff'), renderHome };
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

async function playBattle(B) {
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
  const res = battle(A.team, Bt.team, 'r:' + seed, { sota }, {});
  save(); playBattle({ kind, title: (kind === 'duel' ? '战帖 · ' : '幽灵 · ') + (foe.name || '无名'), res, A, B: Bt, sota, replay: [ca, cb, seed, kind[0], 's' + sotaFlag(sota)].join('.') });
}
function openGhosts() {
  if (!S.ghosts || S.ghosts.realm !== S.realm) { S.ghosts = { realm: S.realm, list: ghostTrio(R(), S.realm).map(o => ({ tier: o.tier, label: o.label, name: o.name, code: encodeTeam(o.team, { name: '幽灵·' + o.name, realm: S.realm }) })) }; save(); }
  sheet(`<h3>斗幽灵</h3><p class="sm">${TXT.spar}。阵容摆在明面上，打完能复制复盘链接。</p>${S.ghosts.list.map((o, i) => { const d = decodeTeam(o.code); return `<div class="foeopt"><div class="fh"><b class="tier t-${o.tier}">${o.label}</b><span class="fn">${esc(o.name)}</span></div>${miniRow(d.team)}<button class="zhu" data-act="ghostGo" data-i="${i}">切磋</button></div>`; }).join('')}<div class="row2"><button data-act="ghostNew">换一批</button></div>`);
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
function shareText(code) { return `${S.trial ? TXT.trialText : ''}我在《蛊码》养了一窝蛊（${REALMS[S.realm]}），敢接战帖吗？\n界壁坐标码：${code}`; }
function myCode() { return encodeTeam(S.team.length ? S.team : starterTeam(), { name: S.name, realm: S.realm, trial: S.trial }); }
let cardURL = '';
async function openShare() {
  const code = myCode(), url = shareURL(code);
  sheet(`<h3>界壁坐标码${trialTag(S.trial)}</h3>${S.trial ? `<p class="trialnote">${TXT.trialShare}</p>` : ''}<p class="sm">发给朋友。对方打开链接，或在蛊码里粘贴坐标码，就会和你空窍里这支阵容切磋。</p>
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
  const mine = S.team.length ? S.team : starterTeam();
  sheet(`<p class="eyebrow">界壁震动</p><h3 class="duelh">有人向你下战帖${trialTag(foe.trial)}</h3><p class="sm">来自 <b>${esc(foe.name || '无名蛊师')}</b> · ${REALMS[foe.realm] || '凡人'}${foe.old ? ' · 旧版坐标码（只认物种和转数）' : ''}</p>${foe.trial ? `<p class="trialnote">${TXT.trialFoe}</p>` : ''}${miniRow(foe.team)}
  <p class="vsline">— 你的${S.team.length ? '空窍' : '初始阵容'} —</p>${miniRow(mine)}<p class="sm">${TXT.spar}</p><div class="row2"><button class="zhu big" data-act="duelFight">应战</button></div>`);
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
function miniRow(t) { return `<div class="mini">${t.map(g => `<div class="mg${g.boss ? ' boss' : ''}"><span class="art">${guSVG(g.sp, { rank: rankOf(g) })}</span><span class="rk rk${rankOf(g)}">${RANK.ch[rankOf(g)]}</span><b>${SP[g.sp] ? SP[g.sp].n : ''}</b><span class="st"><i class="a">${g.atk}</i><i class="h">${g.hp}</i></span></div>`).join('')}</div>`; }
function guDetail(g, ctx = {}) {
  const s = SP[g.sp], nat = natOfG(g), team = ctx.kind === 'team' ? S.team : null, i = ctx.i | 0, c = team ? teamCombos(team)[i] : null, f = g.food && FOOD[g.food];
  const recipes = COMBOS.filter(x => x.need.includes(g.sp));
  sheet(`<div class="detail"><div class="dart">${guSVG(g.sp, { rank: rankOf(g) })}</div><div><h3>${rankName(g)}</h3><p class="lore">${esc(s.lore)}</p><p class="dst"><i class="a">${g.atk}</i><i class="h">${g.hp}</i> <small>${DAO[daoOf(g.sp)] ? DAO[daoOf(g.sp)].n : ''}</small></p></div></div>
  ${nat ? `<h4>本命技</h4><p><b>${esc(nat.n)}</b> ${esc(nat.d)}</p><p class="sm">三转、五转各觉醒一次${nat.aw ? `（已觉醒 ${nat.aw} 次）` : ''}</p>` : ''}
  ${c ? `<h4>杀招</h4><div class="skill"><span class="seal">${esc(c.n)}</span><p>${esc(c.d)}<br><small>配方：${c.need.map(x => SP[x].n).join(' + ')}</small></p></div>` : ''}
  ${f ? `<h4>挂件</h4><p><b>${esc(f.n)}</b> ${esc(f.d)}</p>` : ''}
  ${g.xing ? `<h4>蛊性</h4><p>${esc(String(g.xing))}</p>` : ''}
  ${recipes.length ? `<h4>能凑的杀招</h4><ul>${recipes.map(x => `<li><b>${esc(x.n)}</b> ${x.need.map(y => SP[y].n).join(' + ')}</li>`).join('')}</ul>` : ''}
  ${ctx.kind === 'team' || ctx.kind === 'bag' ? `<div class="row2">${ctx.kind === 'team' ? `<button data-act="toBag" data-i="${i}"${S.bag.length < BC() && !tripOn() ? '' : ' disabled'}>收进蛊囊</button>` : `<button class="zhu" data-act="fromBag" data-i="${i}"${S.team.length < curCap() && !tripOn() ? '' : ' disabled'}>上场</button>`}<button data-act="sell" data-k="${ctx.kind}" data-i="${i}"${tripOn() ? ' disabled' : ''}>卖出 · 退回 ${fmtTok(price(sellValue(g)))}</button></div>` : ''}`);
}
function openCodex() {
  const have = S.team.map(g => g.sp);
  sheet(`<h3>蛊典</h3><p class="sm">见过 ${Object.keys(S.codex).length} / ${SPECIES.length} 种。</p>
  <h4>杀招配方</h4><ul class="recipes">${COMBOS.map(c => { const miss = comboMissing(c, have); return `<li class="${miss.length ? '' : 'on'}"><b>${esc(c.n)}</b> ${c.need.map(x => `<span class="${have.includes(x) ? 'got' : ''}">${SP[x] ? SP[x].n : x}</span>`).join(' + ')}${miss.length ? `<small>还差：${miss.map(x => SP[x] ? SP[x].n : x).join('、')}</small>` : '<small>已成形</small>'}<br><small>${esc(c.d)}</small></li>`; }).join('')}</ul>
  <h4>道</h4><ul>${DAOS.map(d => `<li><b>${d.n}</b> ${esc(d.d)}<br><small>2 只：${esc(d.r2.d)}；4 只：${esc(d.r4.d)}</small></li>`).join('')}</ul>
  <h4>蛊</h4><div class="codexgrid">${SPECIES.filter(s => !s.immortal).map(s => `<div class="cx${S.codex[s.id] ? '' : ' unseen'}" data-tip="${esc(S.codex[s.id] ? `${s.n}（${RANK.names[baseRank(s.id)]} · ${DAO[daoOf(s.id)] ? DAO[daoOf(s.id)].n : ''}）\n${natDesc(s.id)}` : '还没见过')}">${guSVG(s.id)}<small>${S.codex[s.id] ? s.n : '？'}</small></div>`).join('')}</div>`, 'codex');
}
function openPath() {
  const v = timelineView(M()), K = { trips: '出征', clears: '通关', realm: '境界', merges: '合成', combos: '杀招成形', buys: '买蛊', feeds: '喂食' };
  sheet(`<h3>道途</h3><p class="sm">达成一个，就解锁新的蛊、食物、秘境或玩法。成就本身不给数值。</p><ol class="tline">${v.map(a => `<li class="${a.state}"><b>${esc(a.n)}</b> <small>${esc(a.d)}</small>${a.state === 'done' ? '' : `<small class="prog">${a.prog.map(p => `${K[p.k] || p.k} ${p.cur}/${p.v}`).join(' · ')}</small>`}<em>${(a.unlock || []).map(u => '解锁 ' + esc(u.n)).join('、')}</em></li>`).join('')}</ol>`);
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
  const nat = natOfG(g), c = team ? teamCombos(team)[i] : null, f = g.food && FOOD[g.food];
  return `<b>${rankName(g)}</b> <i class="a">${g.atk}</i> <i class="h">${g.hp}</i><br><small>${esc(SP[g.sp].lore)}${team ? ` · 第 ${i + 1} 位` : ''}</small>`
    + (nat ? `<p><b>本命·${esc(nat.n)}</b> ${esc(nat.d)}</p>` : '') + (c ? `<p><b>杀招·${esc(c.n)}</b> ${esc(c.d)}<br><small>配方：${c.need.map(x => SP[x].n).join(' + ')}</small></p>` : '')
    + (f ? `<p><b>挂件·${esc(f.n)}</b> ${esc(f.d)}</p>` : '') + `<small>点开看完整详情</small>`;
}
const TIPS = {
  qi: () => `<b>元气 ${fmtTok(S.bank)}</b><br><small>${esc(TXT.qiTip)}${VSC ? '' : esc(TXT.qiTrial)}</small>`,
  gu: t => guTip(S.team[+t.dataset.i], S.team, +t.dataset.i),
  bag: () => esc(TXT.bagTip()),
  bg: t => { const g = S.bag[+t.dataset.i]; return g ? guTip(g) + '<small>在蛊囊里：不上场、不出征，拖进空窍才上场</small>' : ''; },
  ware: t => { const w = S.shop[+t.dataset.i]; if (!w) return ''; if (w.kind === 'food') { const f = FOOD[w.id]; return `<b>${esc(f.n)}</b> · ${FOOD_KIND[f.kind]}<br>${esc(f.d)}<br><small>价格 ${fmtTok(price(foodCost(w.id)))} 元气</small>`; } const n = owned(w.sp); return guTip(newGu(w.sp)).replace('<small>点开看完整详情</small>', '') + `<small>价格 ${fmtTok(price(PRICE.gu))} 元气 · 点开看完整详情</small>` + (n >= 2 ? `<p>你已有 ${n} 只${RANK.names[baseRank(w.sp)]}${SP[w.sp].n}，买下当场合成${RANK.names[baseRank(w.sp) + 1]}</p>` : ''); },
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
function moveGu(fromKey, fi, toKey, ti) {
  if (tripOn()) return false;
  const A = fromKey === 'bag' ? S.bag : S.team, B = toKey === 'bag' ? S.bag : S.team, g = A[fi]; if (!g) return false;
  if (A === B) { if (ti >= A.length) ti = A.length - 1; moveIdx(A, fi, ti); return true; }
  const capB = toKey === 'bag' ? BC() : curCap(), other = B[ti];
  if (other) { A[fi] = other; B[ti] = g; }
  else { if (B.length >= capB) return false; A.splice(fi, 1); B.splice(Math.min(ti, B.length), 0, g); }
  return true;
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
    if (f.kind === 'trip' || (f.kind === 'stat' && f.to !== 'one')) { if ((f.kind === 'stat' && !S.team.length) || !pay(foodCost(w.id))) return; w.sold = true; w.frozen = false; useFood(w.id, 'shop', i); closeSheet(); renderHome(); save(); return; }
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
    if (w.kind === 'food') { const f = FOOD[w.id]; sheet(`<h3>${esc(f.n)} <small>${FOOD_KIND[f.kind]}</small></h3><p>${esc(f.d)}</p><div class="row2"><button data-act="freeze" data-i="${i}">${TXT.freeze(w.frozen)}</button><button class="zhu" data-act="buy" data-i="${i}"${!w.sold && canPay(foodCost(w.id)) ? '' : ' disabled'}>买下 ${fmtTok(price(foodCost(w.id)))}</button></div><p class="sm">余 ${fmtTok(S.bank)} 元气</p>`); return; }
    const g = newGu(w.sp); guDetail(g, { kind: 'shop' });
    const sh = $('.sheet'); if (sh) sh.insertAdjacentHTML('beforeend', `<div class="row2"><button data-act="freeze" data-i="${i}">${TXT.freeze(w.frozen)}</button><button class="zhu" data-act="buy" data-i="${i}"${!w.sold && canPay(PRICE.gu) ? '' : ' disabled'}>${owned(w.sp) >= 2 ? '买下并合成 ' : '买下 '}${fmtTok(price(PRICE.gu))}</button></div><p class="sm">余 ${fmtTok(S.bank)} 元气</p>`);
  },
  buy(a) { buyWare(+a.dataset.i); },
  freeze(a) { const w = S.shop[+a.dataset.i]; if (!w) return; w.frozen = !w.frozen; closeSheet(); renderShop(); save(); },
  refresh() { if (tripOn() || !pay(PRICE.refresh)) return; newShop(); renderShop(); meters(); save(); snd('tick'); },
  pantry(a) { const i = +a.dataset.i, id = S.pantry[i], f = FOOD[id]; if (!f) return; if (f.kind === 'gear' || (f.kind === 'stat' && f.to === 'one')) { useFood(id, 'pantry', i); return; } if (useFood(id, 'pantry', i)) { S.pantry.splice(i, 1); renderHome(); save(); } },
  feedTo(a) { const all = [...S.team, ...S.bag]; feedTo(all[+a.dataset.k]); },
  gu(a) { const i = +a.dataset.i; if (S.team[i]) guDetail(S.team[i], { kind: 'team', i }); },
  bagGu(a) { const i = +a.dataset.i; if (S.bag[i]) guDetail(S.bag[i], { kind: 'bag', i }); },
  toBag(a) { if (moveGu('team', +a.dataset.i, 'bag', S.bag.length)) { closeSheet(); afterChange(); } },
  fromBag(a) { if (moveGu('bag', +a.dataset.i, 'team', S.team.length)) { closeSheet(); afterChange(); } },
  sell(a) { const L = a.dataset.k === 'bag' ? S.bag : S.team, i = +a.dataset.i, g = L[i]; if (!g || tripOn()) return; const v = price(sellValue(g)); L.splice(i, 1); S.bank += v; note(TXT.sold(g, v)); closeSheet(); afterChange(); snd('coin'); },
  go() { if (!S.team.length || tripOn()) return; goSheet(); },
  goConfirm() { closeSheet(); if (!TRIP.start) { note(TXT.goSoon); return; } S.trip = S.trip || { at: Date.now() }; save(); renderHome(); TRIP.start(TRIP.api); },
  ghost() { openGhosts(); },
  ghostNew() { S.ghosts = null; openGhosts(); },
  ghostGo(a) { const o = S.ghosts && S.ghosts.list[+a.dataset.i]; if (!o) return; closeSheet(); const d = decodeTeam(o.code); spar('ghost', { team: d.team, name: o.name, realm: S.realm }); },
  share() { openShare(); },
  copyCode(a) { copy(myCode(), a); },
  copyLink(a) { const c = myCode(); copy(shareText(c) + '\n' + shareURL(c), a); },
  savePng() { if (!cardURL) return; if (VSC) { VSC.postMessage({ type: 'savePng', data: cardURL }); return; } const l = document.createElement('a'); l.href = cardURL; l.download = 'gucode.png'; l.click(); },
  duelInput() { openDuelInput(); },
  duelGo() { if (!openLinkText($('#duelIn').value)) $('#duelErr').textContent = '坐标码或复盘链接不对，或者被截断了。'; },
  duelFight() { closeSheet(); spar('duel', window.__guFoe); },
  replayGo() { const rp = window.__guRp; closeSheet(); playBattle({ kind: 'replay', title: `复盘 · ${rp.B.name || '无名'} 对 ${rp.A.name || '无名'}`, res: battle(rp.A.team, rp.B.team, 'r:' + rp.seed, { sota: rp.sota }, {}), A: rp.A, B: rp.B, sota: rp.sota, replay: rp.replay }); },
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
