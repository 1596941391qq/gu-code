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
export const NAT_BASE = 2, NAT_STEP = 0.85;
export const natMulOf = r => NAT_BASE + NAT_STEP * (Math.min(5, Math.max(1, r || 1)) - 1);   // 一转 ×2、三转 ×3.7、五转及仙蛊 ×5.4（相对描述里的基准数）
const natMul = u => u.rank ? natMulOf(u.rank) : 1;   // 召唤物没有转数，按 ×1
let NM = 1;
const withNM = (m, f) => { const p = NM; NM = m; try { return f(); } finally { NM = p; } };
// 本命借势：本命钩子里，攻血按「自身」和「本方开战最高攻血的 LEAD」取大，辅蛊的本命到后期也不掉队（u.la / u.lh 在 begin 里按阵容算）
export const LEAD = 0.4;
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
export const trCapOf = sp => 2;
// 战斗中途得词条（吞瓮、承嗣、拟态、傀儡、吞元）：只在这一场里生效、不留存；副词条照样最多 2 个，本命不占格子
const giveTr = (u, k, l) => { if (l <= 0) return; if (isNat(k)) { u.tr[k] = 1; return; } if (u.tr[k] == null && Object.keys(u.tr).filter(x => !isNat(x)).length >= trCapOf(u.sp)) return; u.tr[k] = Math.min(3, (u.tr[k] || 0) + l); };
const trSum = u => Object.values(u.tr).reduce((a, b) => a + b, 0);

// ---------- 词条 ----------
// 本命技（nat）：每个物种独有一个，由物种推出、不进坐标码、不进突变池；三转、五转各觉醒一次（aw[0] / aw[1]），给本命追加一条效果。
// 副词条：突变、炼附、吞噬得来，可叠层（v = 1–3），明显弱于本命。旧 14 个副词条在 core.js / battle.js，这里是新增的 6 个。
// 描述里〔〕括住的数随转数缩放：显示值 = 基准 × 该转数的本命倍率（natMulOf）
const fmtNat = (s, m) => s.replace(/〔(\d+)〕/g, (_, x) => String(Math.round(+x * m)));
const N = (n, ch, trig, d, awd, hooks) => ({ n, ch, trig, innate: true, nat: true, d: (v, m = natMulOf(1)) => fmtNat(d, m), aw: awd.map(x => (m = natMulOf(1)) => fmtNat(x, m)), hooks });
export const NEW_TRAITS = {
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
// ---------- 转数 ----------
// rank：基础转数。凡人池 = 一转蛊，一转池 = 二转蛊，二转池 = 三转蛊，三转池 = 四转蛊，四转池与五转池 = 五转蛊，仙蛊 = 六转。
// 旧 12 种的补充字段（集成时 Object.assign 到 core 的 SPECIES 上）
// nat = 本命技；sub = 炼附/吞噬时教给本体的副词条；dup = 与本命重复、不能再得的副词条（旧存档里这些会被清掉）
export const OLD_EXTRA = Object.fromEntries([
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

export const NEW_SUMMONS = { antling: '兵蚁', aphidling: '蚜虫', spiderling: '小蛛', fuzi: '子蚨', bee: '工蜂', kuilei: '傀儡' };
export const NEW_POOL = [0, 1, 2, 3, 4, 5].map(t => NEW_SPECIES.filter(s => !s.legend && s.tier === t).map(s => s.id));
export const IMMORTALS = NEW_SPECIES.filter(s => s.immortal).map(s => s.id);
export const LEGENDS = IMMORTALS;   // 旧称，等同 IMMORTALS

// ---------- 新杀招 ----------
// need[0] 起名，comboOf 只看「本体 + 附蛊」物种集合，不分主次
const C = (id, n, need, d, hooks = {}) => ({ id, n, need, d, hooks });
const cq = (ctx, u) => ctx.ev('combo', { uid: u.uid, n: u.cname, quiet: 1 });
export const NEW_COMBOS = [
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
// 天劫压阵：第 20 合起双方全体每合掉最大血量 (回合-19)×10%，杜绝回血/护体互耗的僵局（按百分比，后期大血量照样收得住）
export const DOOM = 20;
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
