// 蛊码 GuCode · 斗蛊引擎（纯函数，种子随机，可复现）。输出事件流 + 每步快照，渲染层只负责回放。
import { makeRng, SP, SUMMON_NAMES, comboOf, BATTLE, SLOTS, natOf, awOf, guRank, subOk } from './core.js';
import { BX } from './bestiary.js';   // 蛊典扩充的词条/杀招：8 处通用派发（标注 [BX]），细节见 bestiary.js 文件头

const MAXTURN = 60, MAXOPS = 6000, CAP = SLOTS;   // CAP：场上同时存活的上限（与空窍格数一致）

export function toUnit(g, side) {
  const w = g.wound || 0, q = g.q || [];
  let atk = Math.max(1, g.atk - w), hp = Math.max(1, g.hp - w);
  if (q.includes('blood')) atk += 2;
  if (q.includes('berserk')) { atk = Math.ceil(atk * 1.5); hp = Math.max(1, Math.floor(hp * 0.7)); }
  if (q.includes('echo')) hp = Math.max(1, hp - 2);
  if (q.includes('martyr')) hp = Math.max(1, hp - 2);
  const tr = {}; (g.tr || []).forEach(([id, v]) => { if (subOk(g, id)) tr[id] = v; });
  const c = comboOf(g);
  // 本命技由物种推出（不进码），只属于本体；附蛊只教副词条。g.noNat 只给模拟做对照用
  if (!g.noNat) { const k = natOf(g.sp); if (k) tr[k] = 1; }
  return { side, sp: g.sp, name: (g.boss ? '劫·' : '') + (SP[g.sp] ? SP[g.sp].n : SUMMON_NAMES[g.sp]), atk, hp, mx: hp, sh: 0, tr, q, combo: c ? c.id : null, cname: c ? c.n : null, att: g.att || [], boss: !!g.boss, rank: guRank(g), aw: awOf(g), f: {} };
}

export function battle(ta, tb, seed, ma = [], mb = []) {
  const rng = makeRng(seed); let ops = 0, uidc = 0;
  const MK = [new Set(ma || []), new Set(mb || [])], has = (side, k) => MK[side].has(k), sideF = [{}, {}];
  const roster = {}, log = [], S = [[], []];
  const reg = u => { u.uid = (u.side ? 'b' : 'a') + (uidc++); roster[u.uid] = { sp: u.sp, name: u.name, side: u.side, combo: u.cname, tr: { ...u.tr }, q: u.q, att: u.att, boss: u.boss }; return u; };
  ta.slice(0, CAP).forEach(g => S[0].push(reg(toUnit(g, 0))));
  tb.slice(0, CAP).forEach(g => S[1].push(reg(toUnit(g, 1))));
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
