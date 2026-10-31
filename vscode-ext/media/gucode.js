/* 蛊码 GuCode —— 由 tools/build.mjs 从 src/ 生成，请改 src/ 再构建 */
(() => {
"use strict";
// ---- src/core.js
// 蛊码 GuCode · 纯逻辑：种子随机、数据表、养成、坐标码。不碰 DOM。
function hashStr(s) { s = String(s); let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function makeRng(seed) {
  let a = (typeof seed === 'number' ? seed : hashStr(seed)) >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = n => Math.floor(r() * n);
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  return r;
}

const MAXV = 3, MAXTR = 4, MAXQ = 2, MAXATT = 2, SLOTS = 5;
const REALMS = ['凡人', '一转', '二转', '三转', '四转', '五转'];
const SLOT_BY_REALM = [3, 4, 5, 5, 5, 5];
const slotCap = r => SLOT_BY_REALM[Math.min(5, Math.max(0, r | 0))];
const POOL_TIERS = [['boar', 'fire', 'twin', 'iron', 'thorn', 'bone'], ['mantis', 'queen', 'cicada'], ['drum', 'scorp', 'moth']];
const poolFor = r => POOL_TIERS.slice(0, Math.min(3, (r | 0) + 1)).flat();
const ECON = { node: 2, buy: 3, refresh: 1, tokPer: 25, lose: 1, win: { easy: 3, mid: 5, hard: 8, trib: 10, endless: 6, duel: 0 } };
const trCap = g => MAXTR + Math.max(0, (g.star || 1) - 1);

// 词条：v 为层数（1–3），同名合并即叠层
const TRAITS = {
  strike: { n: '开锋', ch: '锋', trig: '开战', d: v => `开战：对随机敌蛊造成 ${2 * v} 伤害` },
  shell:  { n: '护体', ch: '甲', trig: '开战', d: v => `开战：获得 ${3 * v} 点护体（先挡伤害）` },
  thorn:  { n: '反噬', ch: '棘', trig: '受击', d: v => `受击：对攻击者反噬 ${v + 1} 伤害` },
  frenzy: { n: '狂血', ch: '狂', trig: '受击', d: v => `受击且存活：自身 +${v} 攻` },
  split:  { n: '分影', ch: '影', trig: '受击', d: v => `首次受击存活：身后召唤 ${v + 1}/${v + 1} 分影` },
  devour: { n: '噬魂', ch: '噬', trig: '击杀', d: v => `击杀：自身 +${2 * v}/+${2 * v}` },
  legacy: { n: '遗泽', ch: '泽', trig: '亡语', d: v => `亡语：身后友蛊 +${2 * v}/+${2 * v}` },
  spawn:  { n: '化生', ch: '化', trig: '亡语', d: v => `亡语：原地召唤 ${2 * v}/${2 * v} 蛊蛹` },
  rally:  { n: '应召', ch: '召', trig: '召唤', d: v => `有友蛊被召唤时：自身 +${v}/+${v}` },
  war:    { n: '擂鼓', ch: '鼓', trig: '回合开始', d: v => `回合开始：最前方友蛊 +${v} 攻` },
};
const TRAIT_KEYS = Object.keys(TRAITS);

// 物种：每只一个直白词条。ab = 附蛊简字
const SPECIES = [
  { id: 'boar',   n: '野猪蛊', ab: '豕', atk: 3, hp: 4, t: 'frenzy', v: 1, lore: '越挨打越疯' },
  { id: 'fire',   n: '流火蛊', ab: '火', atk: 2, hp: 3, t: 'strike', v: 1, lore: '开场先放一把火' },
  { id: 'twin',   n: '分身蛊', ab: '影', atk: 2, hp: 3, t: 'split',  v: 1, lore: '挨一下，多一个自己' },
  { id: 'iron',   n: '铁甲蛊', ab: '甲', atk: 2, hp: 5, t: 'shell',  v: 1, lore: '壳比命硬' },
  { id: 'thorn',  n: '荆棘蛊', ab: '棘', atk: 2, hp: 4, t: 'thorn',  v: 1, lore: '碰我者自伤' },
  { id: 'mantis', n: '噬心蛊', ab: '螳', atk: 4, hp: 2, t: 'devour', v: 1, lore: '吃一只，壮一圈' },
  { id: 'bone',   n: '腐骨蛊', ab: '骨', atk: 2, hp: 2, t: 'spawn',  v: 1, lore: '死了还会孵出来' },
  { id: 'queen',  n: '蜂王蛊', ab: '蜂', atk: 2, hp: 3, t: 'rally',  v: 1, lore: '一呼百应' },
  { id: 'cicada', n: '金蝉蛊', ab: '蝉', atk: 2, hp: 3, t: 'legacy', v: 1, lore: '蜕下的壳留给后人' },
  { id: 'drum',   n: '战鼓蛊', ab: '鼓', atk: 1, hp: 4, t: 'war',    v: 1, lore: '鼓声一响，前锋发狠' },
  { id: 'scorp',  n: '蝎尾蛊', ab: '蝎', atk: 1, hp: 2, t: 'strike', v: 2, lore: '一针定生死' },
  { id: 'moth',   n: '月蛾蛊', ab: '蛾', atk: 1, hp: 2, t: 'legacy', v: 2, lore: '燃尽自己照亮后人' },
];
const SP = Object.fromEntries(SPECIES.map(s => [s.id, s]));
const SUMMON_NAMES = { pupa: '蛊蛹', shade: '分影', lunar: '月影' };

// 怪癖：武火超频的双刃剑
const QUIRKS = {
  blood:    { n: '嗜血', d: '攻 +2；每回合开始自损 1 血' },
  berserk:  { n: '狂暴', d: '攻 ×1.5；生命 ×0.7' },
  lastgasp: { n: '回光', d: '首次受致命伤时留 1 血' },
  echo:     { n: '回响', d: '词条触发后 35% 再触发一次；生命 -2' },
  timid:    { n: '怯阵', d: '居最前时攻 -2；在后排时每回合 +1 血' },
  martyr:   { n: '殉道', d: '亡语触发两次；生命 -2' },
  greedy:   { n: '贪噬', d: '击杀额外 +2/+2；受到伤害 +1' },
};
const QUIRK_KEYS = Object.keys(QUIRKS);

// 杀招：本体 + 附蛊 的物种集合命中配方即成（三蛊配方优先）
const COMBOS = [
  { id: 'sanzhu',   n: '烈火三豕冲', need: ['boar', 'fire', 'twin'], d: '开战：冲阵，对敌方前三只各造成本蛊攻击一半的伤害' },
  { id: 'jinjia',   n: '金甲不坏身', need: ['iron', 'thorn'],  d: '开战再得 3 护体；护体未破时受击，反噬翻倍' },
  { id: 'wangu',    n: '万蛊朝宗',   need: ['queen', 'bone'],  d: '任一友蛊被召唤时，全体友蛊 +1/+1' },
  { id: 'tuoke',    n: '金蝉脱壳',   need: ['cicada', 'twin'], d: '首次阵亡时，以一半攻血原地蜕生' },
  { id: 'duopo',    n: '噬心夺魄',   need: ['mantis', 'scorp'], d: '击杀后，立刻对下一只敌蛊造成等同攻击的伤害（每回合一次）' },
  { id: 'pozhen',   n: '擂鼓破阵',   need: ['drum', 'boar'],   d: '回合开始：全体友蛊 +1 攻' },
  { id: 'shishan',  n: '尸山月影',   need: ['moth', 'bone'],   d: '亡语：再召唤一只继承本蛊一半攻击的月影' },
  { id: 'fenshen',  n: '焚身诀',     need: ['fire', 'mantis'], d: '击杀：对敌方全体造成 3 伤害' },
  { id: 'jingji',   n: '荆棘王座',   need: ['thorn', 'queen'], d: '受击：全体友蛊获得 1 点护体' },
  { id: 'liaoyuan', n: '天火燎原',   need: ['fire', 'scorp'],  d: '开战：开锋改为波及敌方全体（每只伤害减半）' },
];
const COMBO = Object.fromEntries(COMBOS.map(c => [c.id, c]));

// 道痕：整局被动，渡劫成功三选一。顺序固定（坐标码按位编码），只能往后加
const MARKS = {
  luKou:     { n: '炉口淬锋', d: '开战：炉口（最前）的蛊 +2 攻' },
  tieBi:     { n: '铁壁',     d: '开战：全体友蛊 +2 护体' },
  buMie:     { n: '不灭',     d: '每场第一只阵亡的友蛊以 1 血复生' },
  shaZhao:   { n: '杀招开光', d: '身负杀招的蛊开战 +3/+3' },
  qunGu:     { n: '群蛊',     d: '召唤出的蛊蛹、分影、月影 +2/+2' },
  fanShi:    { n: '反噬加深', d: '反噬伤害 +1' },
  shiHun:    { n: '噬魂入骨', d: '击杀时额外 +1/+1' },
  xianSheng: { n: '先声夺人', d: '开锋伤害 +2' },
  yiZe:      { n: '遗泽绵长', d: '遗泽与化生多算一层' },
  heLian:    { n: '合炼得道', d: '合炼升星时额外觉醒一个词条' },
  shengCai:  { n: '生财有道', d: '斗蛊所得元石 +50%' },
  shiJing:   { n: '市井熟客', d: '蛊市买蛊只要 2 元石，刷新免费' },
};
const MARK_KEYS = Object.keys(MARKS);
function rollMarks(rng, owned = []) { const pool = MARK_KEYS.filter(k => !owned.includes(k)), out = []; while (out.length < 3 && pool.length) out.push(pool.splice(rng.int(pool.length), 1)[0]); return out; }

let UIDN = 1;
function nuid() { return 'g' + (UIDN++).toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
function newGu(sp) { const s = SP[sp]; return { uid: nuid(), sp, atk: s.atk, hp: s.hp, tr: [[s.t, s.v]], q: [], att: [], wound: 0, fed: 0, mut: 0 }; }
function starterTeam() { return ['boar', 'fire', 'twin'].map(newGu); }

function addTrait(g, id, v, bonus) {
  const e = g.tr.find(x => x[0] === id);
  if (e) { e[1] = Math.min(MAXV, e[1] + v + (bonus ? 1 : 0)); return true; }
  if (g.tr.length >= trCap(g)) return false;
  g.tr.push([id, Math.min(MAXV, v)]); return true;
}
function comboOf(g) {
  if (!g.att || !g.att.length) return null;
  const set = new Set([g.sp, ...g.att]);
  for (const c of COMBOS) if (c.need.every(x => set.has(x))) return c;
  return null;
}
// 杀招：命中配方给名字和特效；未命中也有"自悟杀招"名——效果就是合流后的词条
function skillOf(g) {
  const c = comboOf(g);
  if (c) return { id: c.id, n: c.n, d: c.d, named: true };
  if (g.att && g.att.length) {
    const chars = g.tr.map(t => TRAITS[t[0]].ch).join('');
    return { id: null, n: chars + ['诀', '印', '式', '咒', '阵'][hashStr(g.sp + g.att.join('')) % 5], d: '自悟杀招：本体与附蛊词条合流，层数叠加', named: false };
  }
  return null;
}
function mutateGu(g, rng) {
  const fresh = TRAIT_KEYS.filter(k => !g.tr.some(t => t[0] === k));
  if (g.tr.length < trCap(g) && fresh.length) { const t = rng.pick(fresh); g.tr.push([t, 1]); return t; }
  const up = g.tr.filter(t => t[1] < MAXV);
  if (up.length) { const t = rng.pick(up); t[1]++; return t[0]; }
  g.atk++; g.hp++; return g.tr[0][0];
}
function addQuirk(g, rng) {
  if (g.q.length >= MAXQ) return null;
  const q = rng.pick(QUIRK_KEYS.filter(k => !g.q.includes(k)));
  g.q.push(q); return q;
}
function cloneGu(g) {
  return { ...g, uid: nuid(), atk: Math.max(1, Math.round(g.atk * 0.6)), hp: Math.max(1, Math.round(g.hp * 0.6)), tr: g.tr.map(t => [...t]), q: [...g.q], att: [], wound: 0, fed: 0, mut: 0, clone: 1 };
}

// 罗盘节点。cost 单位 = 千 token（演示）；桥接/插件模式另乘系数
const NODES = {
  feed:   { n: '喂食', ch: '食', cost: 40, d: '灵食自左向右流过空窍：依次 +3/+2/+1 血，最左者另 +1 攻' },
  temper: { n: '淬体', ch: '淬', cost: 45, d: '最左蛊 +2 攻 +2 血' },
  mutate: { n: '突变', ch: '变', cost: 55, d: '最左蛊觉醒一个词条（三选一）' },
  split:  { n: '分裂', ch: '裂', cost: 60, d: '最左蛊裂出六成之力的分身，紧贴其右，词条全带' },
  devour: { n: '吞噬', ch: '吞', cost: 55, d: '最左蛊吞下你挑的一只：得其六成攻血、全部词条与附蛊' },
  summon: { n: '招蛊', ch: '招', cost: 40, d: '三选一：招来一只新蛊，入最右空窍' },
  refine: { n: '炼附', ch: '炼', cost: 60, d: '把最右蛊炼成最左蛊的附蛊：得其四成攻血，同名词条质变 +1，配方成杀招' },
};
function nodeOk(type, team, cap = SLOTS) {
  const n = team.length;
  switch (type) {
    case 'feed': case 'temper': case 'mutate': return n > 0;
    case 'split': return n > 0 && n < cap;
    case 'devour': return n >= 2;
    case 'summon': return n < cap;
    case 'refine': return n >= 2 && team[0].att.length < MAXATT;
  }
  return false;
}
function mkNode(type, rng) {
  const n = { type, cost: NODES[type].cost + rng.int(3) * 5 };
  if (type === 'summon') n.sp = rng.pick(SPECIES).id;
  return n;
}
function rollCompass(rng, team, first, cap = SLOTS) {
  const pool = Object.keys(NODES).filter(t => nodeOk(t, team, cap));
  const out = [];
  if ((first || team.length < 2) && pool.includes('summon')) out.push(mkNode('summon', rng));
  while (out.length < 3 && pool.length) { const t = pool.splice(rng.int(pool.length), 1)[0]; if (!out.some(o => o.type === t)) out.push(mkNode(t, rng)); }
  return out;
}

// 结算一个节点。顺序即流派：先变后裂，分身带着突变；先裂后吞，词条叠层
function applyNode(team, node, rng, opt = {}) {
  const fx = [], gone = []; let combo = null, muts = 0; const L = team[0];
  switch (node.type) {
    case 'feed': team.forEach((g, i) => { const h = [3, 2, 1, 1, 1][i]; g.hp += h; if (i === 0) g.atk += 1; fx.push({ uid: g.uid, txt: i === 0 ? `+1/+${h}` : `+${h}血` }); }); break;
    case 'temper': L.atk += 2; L.hp += 2; fx.push({ uid: L.uid, txt: '+2/+2' }); break;
    case 'mutate': { const t = opt.pick && TRAITS[opt.pick] && addTrait(L, opt.pick, 1) ? opt.pick : mutateGu(L, rng); L.mut++; muts++; fx.push({ uid: L.uid, txt: '觉醒·' + TRAITS[t].n, k: 'mut' }); break; }
    case 'split': { const c = cloneGu(L); team.splice(1, 0, c); fx.push({ uid: c.uid, txt: '分身', k: 'new' }); break; }
    case 'devour': {
      const vi = typeof opt.pick === 'number' && opt.pick > 0 && team[opt.pick] ? opt.pick : 1;
      const v = team.splice(vi, 1)[0]; gone.push(v.uid);
      L.atk += Math.ceil(v.atk * 0.6); L.hp += Math.ceil(v.hp * 0.6);
      v.tr.forEach(([id, val]) => addTrait(L, id, val));
      v.q.forEach(q => { if (!L.q.includes(q) && L.q.length < MAXQ) L.q.push(q); });
      const before = comboOf(L);
      v.att.forEach(a => { if (L.att.length < MAXATT) L.att.push(a); });
      L.fed += v.fed; L.mut += v.mut;
      const c = comboOf(L); if (c && c !== before) combo = { uid: L.uid, n: c.n };
      fx.push({ uid: L.uid, txt: '吞·' + SP[v.sp].ab, k: 'eat' }); break;
    }
    case 'summon': { const g = newGu((opt.pick && SP[opt.pick]) ? opt.pick : node.sp || rng.pick(SPECIES).id); team.push(g); fx.push({ uid: g.uid, txt: '招来', k: 'new' }); break; }
    case 'refine': {
      const s = team.pop(); gone.push(s.uid); const before = comboOf(L);
      L.att.push(s.sp); L.atk += Math.ceil(s.atk * 0.4); L.hp += Math.ceil(s.hp * 0.4);
      s.tr.forEach(([id, val]) => addTrait(L, id, val, true));
      L.fed += s.fed; L.mut += s.mut;
      const c = comboOf(L); if (c && c !== before) combo = { uid: L.uid, n: c.n };
      fx.push({ uid: L.uid, txt: '附·' + SP[s.sp].ab, k: 'eat' }); break;
    }
  }
  let quirk = null;
  if (opt.wuhuo && team.length) {
    const tg = node.type === 'summon' ? team[team.length - 1] : team[0];
    if (rng() < 0.5) { const t = mutateGu(tg, rng); tg.mut++; muts++; fx.push({ uid: tg.uid, txt: '武火·' + TRAITS[t].n, k: 'mut' }); }
    else { quirk = addQuirk(tg, rng); if (quirk) fx.push({ uid: tg.uid, txt: '怪癖·' + QUIRKS[quirk].n, k: 'quirk' }); else { tg.atk += 2; fx.push({ uid: tg.uid, txt: '武火 +2 攻', k: 'mut' }); } }
  }
  return { fx, gone, combo, muts, quirk };
}
// 三选一：突变给 3 个词条，招蛊给 3 只蛊，吞噬给全部可吃的（下标）
function nodeChoices(node, team, rng, realm = 5) {
  const L = team[0], pick3 = arr => { const a = [...arr], o = []; while (o.length < 3 && a.length) o.push(a.splice(rng.int(a.length), 1)[0]); return o; };
  if (node.type === 'mutate' && L) return pick3(TRAIT_KEYS.filter(k => { const e = L.tr.find(t => t[0] === k); return e ? e[1] < MAXV : L.tr.length < trCap(L); }));
  if (node.type === 'summon') return pick3(poolFor(realm));
  if (node.type === 'devour') return team.map((g, i) => i).slice(1);
  return null;
}
// ---------- 蛊市与合炼 ----------
function rollShop(rng, realm, old = []) { const pool = poolFor(realm); return [0, 1, 2].map(i => (old[i] && old[i].frozen && !old[i].sold) ? old[i] : { sp: rng.pick(pool), frozen: false }); }
function canBuy(team, sp, cap) { return team.length < cap || team.filter(g => g.sp === sp && (g.star || 1) === 1).length >= 2; }
function mergeAll(team, marks = [], rng) {
  const done = [];
  for (let guard = 0; guard < 6; guard++) {
    let grp = null;
    for (const g of team) { const st = g.star || 1, same = team.filter(x => x.sp === g.sp && (x.star || 1) === st); if (same.length >= 3 && st < 3) { grp = same.slice(0, 3); break; } }
    if (!grp) break;
    const [a, b, c] = grp, s0 = a.star || 1;
    a.star = s0 + 1; a.atk = Math.max(a.atk, b.atk, c.atk) + 2 * s0 + 1; a.hp = Math.max(a.hp, b.hp, c.hp) + 3 * s0 + 1;
    [b, c].forEach(x => {
      x.tr.forEach(([id, v]) => addTrait(a, id, v)); x.q.forEach(q => { if (!a.q.includes(q) && a.q.length < MAXQ) a.q.push(q); });
      x.att.forEach(t => { if (a.att.length < MAXATT) a.att.push(t); }); a.fed = (a.fed || 0) + (x.fed || 0); a.mut = (a.mut || 0) + (x.mut || 0);
      a.wound = Math.min(a.wound || 0, x.wound || 0); team.splice(team.indexOf(x), 1);
    });
    if (marks.includes('heLian') && rng) { mutateGu(a, rng); a.mut++; }
    done.push(a);
  }
  return done;
}
function buyGu(team, sp, cap, marks, rng) { if (!canBuy(team, sp, cap)) return null; const g = newGu(sp); team.push(g); return { gu: g, merged: mergeAll(team, marks, rng) }; }
const sellValue = g => (g.star || 1) + (g.att ? g.att.length : 0);

// 程序生成同阶阵容（幽灵 / 天劫），用同一套养成规则随机走路
function genTeam(rng, power, cap = SLOTS) {
  const team = [newGu(rng.pick(SPECIES).id)];
  for (let i = 0; i < power; i++) {
    const types = Object.keys(NODES).filter(t => nodeOk(t, team, cap));
    const t = (team.length < 3 && types.includes('summon') && rng() < 0.6) ? 'summon' : rng.pick(types);
    const node = mkNode(t, rng);
    applyNode(team, node, rng, { wuhuo: rng() < 0.15 });
    const tg = t === 'summon' ? team[team.length - 1] : team[0];
    if (tg) tg.fed += node.cost * 1000;
  }
  while (team.length < 2) team.push(newGu(rng.pick(SPECIES).id));
  return team;
}
const TRIB_NAMES = ['心魔劫', '雷劫', '火劫', '风劫', '天人劫'];
// 修行路：每一阶额外解锁说明（空窍格数取 SLOT_BY_REALM，蛊池取 POOL_TIERS）
const REALM_NOTES = ['开局三选一本命蛊', '蛊池加入一转档', '蛊池全开，可合炼到 ★3', '敌阵开始出现杀招与怪癖', '天人劫前最后一阶', '登顶，开启无尽劫'];
// 无尽劫：五转之后逐层变强，层数写进分享卡
const ENDLESS = { basePower: 80, perFloor: 3, atkPerFloor: 1, hpPerFloor: 2, baseAtk: 5, baseHp: 10 };
function endlessTeam(floor) {
  const f = Math.max(1, floor | 0), rng = makeRng('endless:' + f), team = genTeam(rng, ENDLESS.basePower + f * ENDLESS.perFloor, 5);
  team.forEach(g => { g.atk += ENDLESS.baseAtk + Math.floor(f * ENDLESS.atkPerFloor); g.hp += ENDLESS.baseHp + f * ENDLESS.hpPerFloor; });
  team[0].boss = 1; return team;
}
// 天劫强度表：power = 敌阵走过的养成节点数；all = 全体加成；boss = 劫主额外加成
const TRIB = { power: [4, 14, 30, 52, 88], all: [[0, 0], [1, 2], [2, 4], [4, 7], [7, 13]], boss: [[1, 2], [2, 5], [4, 8], [6, 12], [12, 24]] };
function tribTeam(realm) {
  const r = Math.min(realm, 4), rng = makeRng('tribulation:' + r);
  const team = genTeam(rng, TRIB.power[r], Math.min(5, slotCap(r) + 1));
  team.forEach(g => { g.atk += TRIB.all[r][0]; g.hp += TRIB.all[r][1]; });
  const b = team[0]; b.atk += TRIB.boss[r][0]; b.hp += TRIB.boss[r][1]; b.boss = 1;
  return team;
}
function ghostTrio(rng, power, realm) {
  const names = [...GHOST_NAMES];
  return [['easy', '易', -3, 0], ['mid', '中', 0, 0], ['hard', '难', 3, 1]].map(([tier, label, d, extra]) => ({ tier, label, name: names.splice(rng.int(names.length), 1)[0], team: genTeam(rng, Math.max(0, power + d), slotCap(realm + extra)) }));
}
const GHOST_NAMES = ['夜码人', '零点蛊师', '断点散人', '递归僧', '缓存道人', '并发狂徒', '栈溢出', '空指针', '热重载', '回滚真人', '合并冲突', '无限循环'];

// ---------- 界壁坐标码：阵容 → 位流 → base64url ----------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const SPI = Object.fromEntries(SPECIES.map((s, i) => [s.id, i]));
const TRI = Object.fromEntries(TRAIT_KEYS.map((k, i) => [k, i]));
const QUI = Object.fromEntries(QUIRK_KEYS.map((k, i) => [k, i]));
function utf8(s) { return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Buffer.from(s, 'utf8'); }
function unutf8(b) { return typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(new Uint8Array(b)) : Buffer.from(b).toString('utf8'); }
function encodeTeam(team, meta = {}) {
  const bits = [];
  const put = (v, n) => { v = Math.max(0, Math.min(Math.floor(v) || 0, 2 ** n - 1)); for (let i = n - 1; i >= 0; i--) bits.push(Math.floor(v / 2 ** i) % 2); };
  let nm = utf8(String(meta.name || '').slice(0, 8)); if (nm.length > 24) nm = nm.slice(0, 24);
  put(2, 3); put(meta.realm || 0, 3); put(team.length, 3); put(nm.length, 5); nm.forEach(b => put(b, 8));
  let mb = 0; (meta.marks || []).forEach(k => { const i = MARK_KEYS.indexOf(k); if (i >= 0) mb += 2 ** i; }); put(mb, 12);
  for (const g of team.slice(0, SLOTS)) {
    put(SPI[g.sp], 4); put(g.atk, 8); put(g.hp, 8); put(g.wound || 0, 2);
    put(g.tr.length, 3); g.tr.forEach(([id, v]) => { put(TRI[id], 4); put(v, 2); });
    put(g.q.length, 2); g.q.forEach(q => put(QUI[q], 3));
    put(g.att.length, 2); g.att.forEach(a => put(SPI[a], 4));
    put(Math.round((g.fed || 0) / 10000), 18); put(g.mut || 0, 7); put(g.boss ? 1 : 0, 1); put((g.star || 1) - 1, 2);
  }
  let chk = 0; bits.forEach((b, i) => { if (b) chk = (chk + i * 7 + 3) % 64; }); put(chk, 6);
  while (bits.length % 6) bits.push(0);
  let s = ''; for (let i = 0; i < bits.length; i += 6) { let v = 0; for (let j = 0; j < 6; j++) v = v * 2 + bits[i + j]; s += B64[v]; }
  return s;
}
function decodeTeam(code) {
  try {
    code = String(code || '').trim(); const m = code.match(/[#?&]c=([A-Za-z0-9_-]+)/); if (m) code = m[1];
    if (!/^[A-Za-z0-9_-]{8,}$/.test(code)) return null;
    const bits = []; for (const ch of code) { const v = B64.indexOf(ch); for (let j = 5; j >= 0; j--) bits.push((v >> j) & 1); }
    let p = 0; const get = n => { let v = 0; for (let i = 0; i < n; i++) { if (p >= bits.length) throw 0; v = v * 2 + bits[p++]; } return v; };
    const ver = get(3); if (ver !== 1 && ver !== 2) return null;
    const realm = get(3), n = get(3), nl = get(5), nm = []; for (let i = 0; i < nl; i++) nm.push(get(8));
    const marks = []; if (ver >= 2) { const mb = get(12); MARK_KEYS.forEach((k, i) => { if (Math.floor(mb / 2 ** i) % 2) marks.push(k); }); }
    if (n < 1 || n > SLOTS) return null;
    const team = [];
    for (let i = 0; i < n; i++) {
      const sp = SPECIES[get(4)]; if (!sp) return null;
      const g = { uid: nuid(), sp: sp.id, atk: Math.max(1, get(8)), hp: Math.max(1, get(8)), wound: get(2), tr: [], q: [], att: [] };
      const nt = get(3); for (let j = 0; j < nt; j++) { const k = TRAIT_KEYS[get(4)], v = get(2); if (k && j < MAXTR) g.tr.push([k, Math.max(1, Math.min(MAXV, v))]); }
      const nq = get(2); for (let j = 0; j < nq; j++) { const k = QUIRK_KEYS[get(3)]; if (k) g.q.push(k); }
      const na = get(2); for (let j = 0; j < na; j++) { const a = SPECIES[get(4)]; if (a && j < MAXATT) g.att.push(a.id); }
      g.fed = get(18) * 10000; g.mut = get(7); if (get(1)) g.boss = 1;
      if (ver >= 2) { const st = get(2) + 1; if (st > 1) g.star = Math.min(3, st); }
      team.push(g);
    }
    const end = p; let chk = 0; for (let i = 0; i < end; i++) if (bits[i]) chk = (chk + i * 7 + 3) % 64;
    if (get(6) !== chk) return null;
    return { team, realm, name: unutf8(nm), marks };
  } catch (e) { return null; }
}
// 战斗手感：暴击概率与倍数（种子随机，复盘可复现）
const BATTLE = { crit: 0.10, critMul: 2 };
// 战斗回放节奏（毫秒，1 倍速基准）。界面按 playMs 自动缩放，使一局约 15–25 秒
const EV_MS = { begin: 900, turn: 220, clash: 640, hit: 60, dmg: 200, buff: 110, trig: 300, combo: 1700, comboQuiet: 180, summon: 260, faint: 400, end: 300 };
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


const MAXTURN = 40, MAXOPS = 4000, CAP = 5;

function toUnit(g, side) {
  const w = g.wound || 0, q = g.q || [];
  let atk = Math.max(1, g.atk - w), hp = Math.max(1, g.hp - w);
  if (q.includes('blood')) atk += 2;
  if (q.includes('berserk')) { atk = Math.ceil(atk * 1.5); hp = Math.max(1, Math.floor(hp * 0.7)); }
  if (q.includes('echo')) hp = Math.max(1, hp - 2);
  if (q.includes('martyr')) hp = Math.max(1, hp - 2);
  const tr = {}; (g.tr || []).forEach(([id, v]) => { tr[id] = v; });
  const c = comboOf(g);
  return { side, sp: g.sp, name: (g.boss ? '劫·' : '') + (SP[g.sp] ? SP[g.sp].n : SUMMON_NAMES[g.sp]), atk, hp, mx: hp, sh: 0, tr, q, combo: c ? c.id : null, cname: c ? c.n : null, att: g.att || [], boss: !!g.boss, f: {} };
}

function battle(ta, tb, seed, ma = [], mb = []) {
  const rng = makeRng(seed); let ops = 0, uidc = 0;
  const MK = [new Set(ma || []), new Set(mb || [])], has = (side, k) => MK[side].has(k), sideF = [{}, {}];
  const roster = {}, log = [], S = [[], []];
  const reg = u => { u.uid = (u.side ? 'b' : 'a') + (uidc++); roster[u.uid] = { sp: u.sp, name: u.name, side: u.side, combo: u.cname, tr: { ...u.tr }, q: u.q, att: u.att, boss: u.boss }; return u; };
  ta.slice(0, CAP).forEach(g => S[0].push(reg(toUnit(g, 0))));
  tb.slice(0, CAP).forEach(g => S[1].push(reg(toUnit(g, 1))));
  const snap = () => S.map(a => a.map(u => [u.uid, u.atk, Math.max(0, u.hp), u.sh]));
  const ev = (t, o = {}) => { o.t = t; o.s = snap(); log.push(o); };
  const alive = u => u && u.hp > 0 && !u.dead;
  const allies = u => S[u.side].filter(alive), foes = u => S[1 - u.side].filter(alive);
  const buff = (u, a, h) => { if (!alive(u)) return; u.atk = Math.min(999, u.atk + a); u.hp = Math.min(999, u.hp + h); u.mx += h; ev('buff', { uid: u.uid, a, h }); };
  const shield = (u, n) => { if (!alive(u)) return; u.sh = Math.min(99, u.sh + n); ev('buff', { uid: u.uid, sh: n }); };
  const comboEv = u => ev('combo', { uid: u.uid, n: u.cname });

  function deal(src, tg, amt, kind, crit) {
    if (!alive(tg) || amt <= 0) return;
    if (tg.q.includes('greedy')) amt += 1;
    const had = tg.sh > 0; let a = amt;
    if (tg.sh > 0) { const s = Math.min(tg.sh, a); tg.sh -= s; a -= s; }
    tg.hp -= a;
    if (tg.hp <= 0 && tg.q.includes('lastgasp') && !tg.f.gasp) { tg.hp = 1; tg.f.gasp = 1; ev('trig', { uid: tg.uid, q: 'lastgasp' }); }
    if (tg.hp <= 0 && src) tg.killer = src;
    ev('dmg', { uid: tg.uid, n: a, blk: amt - a, k: kind, src: src ? src.side : -1, crit: crit ? 1 : 0 });
    hook(tg, 'hurt', { src, kind, had });
  }
  function summon(side, idx, spec, by) {
    const arr = S[side]; if (arr.filter(alive).length >= CAP) return null;
    const bonus = has(side, 'qunGu') ? 2 : 0;
    const u = reg({ side, sp: spec.sp, name: SUMMON_NAMES[spec.sp], atk: spec.atk + bonus, hp: spec.hp + bonus, mx: spec.hp + bonus, sh: 0, tr: {}, q: [], combo: null, cname: null, att: [], f: {} });
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
        tg('strike'); const d = 2 * T.strike + (has(u.side, 'xianSheng') ? 2 : 0);
        if (u.combo === 'liaoyuan') { comboEv(u); foes(u).forEach(f => deal(u, f, Math.ceil(d / 2), 'skill')); }
        else { const fs = foes(u); if (fs.length) deal(u, rng.pick(fs), d, 'skill'); }
      }
      if (T.shell && alive(u)) { tg('shell'); shield(u, 3 * T.shell); }
      if (u.combo === 'sanzhu' && alive(u)) { comboEv(u); fired = true; const dd = Math.max(1, Math.ceil(u.atk / 2)); foes(u).slice(0, 3).forEach(f => deal(u, f, dd, 'skill')); }
      if (u.combo === 'jinjia' && alive(u)) { comboEv(u); fired = true; shield(u, 3); }
    } else if (h === 'turn') {
      if (T.war) { const a = allies(u)[0]; if (a) { tg('war'); buff(a, T.war, 0); } }
      if (u.combo === 'pozhen') { comboEv(u); fired = true; allies(u).forEach(a => buff(a, 1, 0)); }
      if (u.q.includes('blood')) deal(null, u, 1, 'self');
      if (u.q.includes('timid') && alive(u) && allies(u)[0] !== u) buff(u, 0, 1);
    } else if (h === 'hurt') {
      const s = c.src;
      if (T.thorn && s && c.kind !== 'thorn' && alive(s) && s.side !== u.side) { tg('thorn'); let d = T.thorn + 1 + (has(u.side, 'fanShi') ? 1 : 0); if (u.combo === 'jinjia' && c.had) d *= 2; deal(u, s, d, 'thorn'); }
      if (alive(u)) {
        if (T.frenzy) { tg('frenzy'); buff(u, T.frenzy, 0); }
        if (T.split && !u.f.split) { u.f.split = 1; tg('split'); summon(u.side, S[u.side].indexOf(u) + 1, { sp: 'shade', atk: T.split + 1, hp: T.split + 1 }, u); }
        if (u.combo === 'jingji' && c.kind !== 'self') { fired = true; ev('combo', { uid: u.uid, n: u.cname, quiet: 1 }); allies(u).forEach(a => shield(a, 1)); }
      }
    } else if (h === 'kill') {
      if (T.devour) { tg('devour'); buff(u, 2 * T.devour, 2 * T.devour); }
      if (u.q.includes('greedy')) buff(u, 2, 2);
      if (has(u.side, 'shiHun')) buff(u, 1, 1);
      if (u.combo === 'duopo' && !u.f.duopo) { const f = foes(u)[0]; if (f) { u.f.duopo = 1; fired = true; comboEv(u); deal(u, f, u.atk, 'skill'); } }
      if (u.combo === 'fenshen') { comboEv(u); fired = true; foes(u).forEach(f => deal(u, f, 3, 'skill')); }
    } else if (h === 'faint') {
      const arr = S[u.side];
      const yz = has(u.side, 'yiZe') ? 1 : 0;
      if (T.legacy) { const b = arr[c.idx], lv = T.legacy + yz; if (alive(b)) { tg('legacy'); buff(b, 2 * lv, 2 * lv); } }
      if (T.spawn) { tg('spawn'); const sv = T.spawn + yz; summon(u.side, c.idx, { sp: 'pupa', atk: 2 * sv, hp: 2 * sv }, u); }
      if (u.combo === 'shishan') { comboEv(u); fired = true; summon(u.side, c.idx, { sp: 'lunar', atk: Math.max(1, Math.ceil(u.atk / 2)), hp: 3 }, u); }
    } else if (h === 'ally') {
      if (T.rally) { tg('rally'); buff(u, T.rally, T.rally); }
      if (u.combo === 'wangu') { fired = true; ev('combo', { uid: u.uid, n: u.cname, quiet: 1 }); allies(u).forEach(a => buff(a, 1, 1)); }
    }
    return fired;
  }
  function reap() {
    for (let guard = 0; guard < 200; guard++) {
      const dead = [...S[0], ...S[1]].filter(u => u.hp <= 0 && !u.dead);
      if (!dead.length) return;
      for (const u of dead) {
        if (u.dead) continue;
        if (u.combo === 'tuoke' && !u.f.tuoke) {
          u.f.tuoke = 1; u.atk = Math.max(1, Math.ceil(u.atk / 2)); u.mx = Math.max(1, Math.ceil(u.mx / 2)); u.hp = u.mx; u.killer = null;
          comboEv(u); continue;
        }
        if (has(u.side, 'buMie') && !sideF[u.side].buMie) { sideF[u.side].buMie = 1; u.hp = 1; u.killer = null; ev('trig', { uid: u.uid, mk: 'buMie' }); continue; }
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
    if (has(side, 'luKou') && S[side][0]) { ev('trig', { uid: S[side][0].uid, mk: 'luKou' }); buff(S[side][0], 2, 0); }
    if (has(side, 'tieBi')) S[side].forEach(u => shield(u, 2));
    if (has(side, 'shaZhao')) S[side].forEach(u => { if (u.combo) buff(u, 3, 3); });
  }
  const order = () => [...S[0], ...S[1]].filter(alive).sort((x, y) => y.atk - x.atk || x.side - y.side);
  for (const u of order()) if (alive(u)) hook(u, 'start', {});
  reap();
  let turn = 0, winner;
  for (;;) {
    if (!S[0].length || !S[1].length) { winner = !S[0].length && !S[1].length ? 'draw' : S[0].length ? 'A' : 'B'; break; }
    if (++turn > MAXTURN) { winner = 'draw'; turn = MAXTURN; break; }
    ev('turn', { n: turn });
    for (const u of order()) { u.f.duopo = 0; if (alive(u)) hook(u, 'turn', {}); }
    reap();
    if (!S[0].length || !S[1].length) continue;
    const a = S[0][0], b = S[1][0];
    const pa = Math.max(1, a.atk - (a.q.includes('timid') ? 2 : 0)), pb = Math.max(1, b.atk - (b.q.includes('timid') ? 2 : 0));
    const ca = rng() < BATTLE.crit, cb = rng() < BATTLE.crit;
    ev('clash', { a: a.uid, b: b.uid });
    deal(a, b, ca ? pa * BATTLE.critMul : pa, 'hit', ca); deal(b, a, cb ? pb * BATTLE.critMul : pb, 'hit', cb);
    reap();
  }
  ev('end', { w: winner });
  return { winner, turns: turn, log, roster, ops, capped: ops > MAXOPS };
}

// ---- src/art.js
// 蛊码 GuCode · 程序水墨蛊虫。头朝右，viewBox 0 0 100 100。墨色主体 + 一抹淡彩，毛笔边靠 #ink/#wash 滤镜。
const INK = '#1c1915', PAPER = '#efe7d4';
const aE = (cx, cy, rx, ry, f = INK, r = 0, ex = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}"${r ? ` transform="rotate(${r} ${cx} ${cy})"` : ''}${ex}/>`;
const aC = (cx, cy, r, f = INK, ex = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}"${ex}/>`;
const aP = (d, w = 2, s = INK, f = 'none', ex = '') => `<path d="${d}" stroke="${s}" stroke-width="${w}" fill="${f}" stroke-linecap="round" stroke-linejoin="round"${ex}/>`;
const aF = (d, f = INK, ex = '') => `<path d="${d}" fill="${f}"${ex}/>`;
const aLegs = arr => arr.map(([x, y, kx, ky, dx, dy, w]) => aP(`M${x} ${y} L${x + kx} ${y + ky} L${x + dx} ${y + dy}`, w || 1.8)).join('');
const eye = (x, y, r = 1.7) => aC(x, y, r, PAPER);

const ART_DEFS = `<filter id="ink" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3.4" xChannelSelector="R" yChannelSelector="G"/></filter><filter id="wash" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="0.9"/></filter>`;

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

function guSVG(sp, o = {}) {
  const f = A[sp] || A.pupa, { w, b } = f();
  const size = o.size ? ` width="${o.size}" height="${o.size}"` : '';
  const defs = o.standalone ? `<defs>${ART_DEFS}</defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${size} class="gsvg" aria-hidden="true">${defs}<g filter="url(#wash)" opacity=".5">${w}</g><g filter="url(#ink)">${b}</g></svg>`;
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
    this.acc = 0; this.hotAcc = 0; this.vrate = 0; this.vidle = true;
    if (VSC) window.addEventListener('message', e => {
      const m = e.data || {};
      if (m.type === 'tokens') { this.acc += m.delta || 0; if (m.hot) this.hotAcc += m.delta || 0; this.vrate = m.rate || 0; this.vidle = !!m.idle; }
    });
    setInterval(() => this.tick(), 200);
  }
  get unit() { return this.mode === 'vscode' ? 8000 : 1000; }      // 罗盘节点每"千"折合多少真实 token
  get hotTh() { return this.mode === 'vscode' ? 2000 : 10000; }     // 武火阈值（token/秒）
  setMode(m) { this.mode = m; this.idleMs = 0; this.acc = 0; this.hotAcc = 0; }
  tick() {
    const now = performance.now(), dt = Math.min(1, (now - this.last) / 1000); this.last = now;
    if (this.mode === 'demo') {
      const base = { coding: 5200, wuhuo: 15500, rest: 0 }[this.demo], t = now / 1000;
      const r = base ? base * Math.max(0.15, 0.8 + 0.3 * Math.sin(t * 1.7) + 0.2 * Math.sin(t * 4.3 + 1)) : 0;
      const d = r * dt;
      this.rate = this.rate * 0.75 + r * 0.25; if (!base && this.rate < 20) this.rate = 0;
      this.idleMs = this.rate > 0 ? 0 : this.idleMs + dt * 1000;
      this.cb({ delta: d, rate: this.rate, hot: this.rate >= this.hotTh, idle: this.idleMs >= 1200 });
    } else {
      const d = this.acc, hd = this.hotAcc; this.acc = 0; this.hotAcc = 0; this.rate = this.vrate;
      this.cb({ delta: d, hotDelta: hd, rate: this.vrate, hot: this.vrate >= this.hotTh, idle: this.vidle });
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
async function makeCard({ team, name, realm, total, muts, wins, code, url, endless }) {
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
  ctx.fillStyle = '#ece3cf'; ctx.font = `44px ${KAI}`; ctx.fillText(`${name || '无名蛊师'} 的空窍`, 92, 340);
  const imgs = await Promise.all(team.map(g => loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(guSVG(g.sp, { standalone: true, size: 300 })))));
  let y = 376; const skills = [];
  team.forEach((g, i) => {
    const sk = skillOf(g); if (sk) skills.push(sk.n);
    ctx.fillStyle = '#e6dcc6'; ctx.fillRect(84, y, W - 168, 150);
    ctx.fillStyle = 'rgba(28,25,21,.06)'; for (let k = 0; k < 40; k++) ctx.fillRect(84 + rnd() * (W - 180), y + rnd() * 146, 1 + rnd() * 30, 1);
    if (imgs[i]) ctx.drawImage(imgs[i], 96, y + 2, 146, 146);
    ctx.fillStyle = '#1c1915'; ctx.font = `48px ${KAI}`; ctx.fillText(SP[g.sp].n, 262, y + 62);
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
  ctx.fillStyle = 'rgba(236,227,207,.55)'; ctx.font = `24px ${SANS}`; ctx.fillText('界壁坐标码 · 扫码或粘贴即可应战', 92, y + 150, LW);
  ctx.fillStyle = '#6fb7a4'; ctx.font = `24px ui-monospace,Menlo,monospace`;
  const per = 34; for (let i = 0; i * per < code.length && i < 3; i++) ctx.fillText(code.slice(i * per, (i + 1) * per), 92, y + 188 + i * 32, LW);
  if (url) {
    const qs = 264, qx = W - 92 - qs, qy = y - 40;
    if (qrDraw(ctx, url, qx, qy, qs)) { ctx.fillStyle = 'rgba(236,227,207,.7)'; ctx.font = `26px ${KAI}`; ctx.textAlign = 'center'; ctx.fillText('扫码应战', qx + qs / 2, qy + qs + 36); ctx.textAlign = 'left'; }
  }
  return cv.toDataURL('image/png');
}

// ---- src/ui.js
// 蛊码 GuCode · 界面与流程（渲染层；逻辑都在 core/battle）






const KEY = 'gucode.v1', REPAIR = 30, WILL_MAX = 5, WILL_SEC = 120, WILL_TOK = 60;
const $ = (s, r = document) => r.querySelector(s);
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fresh = () => ({ v: 2, started: false, name: '', team: [], realm: 0, nodes: 0, compass: [], sel: null, prog: 0, wh: 0, bank: 0, repair: 0, will: 3, willT: 0, willK: 0, total: 0, muts: 0, wins: 0, losses: 0, seed: (Math.random() * 1e9) | 0, step: 0, sound: false, speed: 1, theme: 'auto', mute: false, stone: 5, stoneK: 0, shop: [], pending: null, marks: [], ghosts: null, floor: 1, endless: 0, codex: { sp: [], combo: [] }, streak: 0, bestStreak: 0, day: '', dayWin: false });
const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const curCap = () => Math.max(slotCap(S.realm), S.team.length);
const buyCost = () => S.marks.includes('shiJing') ? 2 : ECON.buy, refCost = () => S.marks.includes('shiJing') ? 0 : ECON.refresh;
function migrate(s) { if (!s || !s.v) return null; if (s.v === 1) { s.v = 2; s.stone = 5 + Math.min(20, s.nodes || 0); s.will = Math.max(s.will || 0, 3); } return s.v === 2 ? s : null; }

let S = fresh(), phase = 'yang', rate = 0, hot = false, inBattle = false, booted = false, skip = false, resetArm = 0;
const src = new TokenSource(onTick);
const R = () => makeRng(S.seed + ':' + (S.step++));
const bankCap = () => 120 * src.unit;
const effA = g => Math.max(1, g.atk - (g.wound || 0)), effH = g => Math.max(1, g.hp - (g.wound || 0));
const trChars = tr => (Array.isArray(tr) ? tr : Object.entries(tr)).map(([id, v]) => TRAITS[id].ch + (v > 1 ? `<sup>${v}</sup>` : '')).join('');

// ---------- 存档 ----------
let saveT;
function save() {
  if (saveT) return;   // 节流而非防抖：持续有 token 流入时也能按时落盘
  saveT = setTimeout(() => {
    saveT = null; codexScan();
    if (VSC) { const n = S.sel != null ? S.compass[S.sel] : null; VSC.postMessage({ type: 'save', data: S, status: { started: S.started, node: n ? NODES[n.type].n : null, cost: n ? n.cost * src.unit : 0, prog: S.prog, will: S.will, realm: S.realm } }); }
    else try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  }, 400);
}

// ---------- 蛊典：终身收集，跨局保留 ----------
function codexScan() {
  const cx = S.codex || (S.codex = { sp: [], combo: [] });
  for (const g of S.team) { [g.sp, ...(g.att || [])].forEach(id => { if (SP[id] && !cx.sp.includes(id)) cx.sp.push(id); }); const c = comboOf(g); if (c && !cx.combo.includes(c.id)) cx.combo.push(c.id); }
}
function openCodex() {
  codexScan(); const cx = S.codex;
  sheet(`<h3>蛊典</h3><p class="sm">终身收集，重开一局也保留。蛊种 ${cx.sp.length}/${SPECIES.length} · 杀招 ${cx.combo.length}/${COMBOS.length}</p>
  <div class="codex">${SPECIES.map(sp => cx.sp.includes(sp.id) ? `<div class="cx"><span class="art">${guSVG(sp.id)}</span><b>${sp.n}</b><small>${TRAITS[sp.t].n}</small></div>` : `<div class="cx unk"><span class="art">${guSVG(sp.id)}</span><b>？</b><small>未遇</small></div>`).join('')}</div>
  <h4>杀招</h4><ul>${COMBOS.map(c => cx.combo.includes(c.id) ? `<li><b>${c.n}</b>${c.need.map(x => SP[x].n).join(' + ')}：${c.d}</li>` : `<li class="unk"><b>？？？</b>${SP[c.need[0]].n} + ${c.need.slice(1).map(() => '？').join(' + ')}</li>`).join('')}</ul>`);
}
function openPath() {
  const rows = REALMS.map((rn, r) => {
    const newSp = r <= 2 ? POOL_TIERS[r].map(id => SP[id].n).join('、') : '';
    const state = r < S.realm ? 'done' : r === S.realm ? 'now' : '';
    const boss = r < 5 ? `渡${TRIB_NAMES[r]} → 晋${REALMS[r + 1]}` : '无尽劫';
    return `<li class="pr ${state}"><span class="pn">${rn}</span><span class="pb"><b>空窍 ${slotCap(r)} 格${newSp ? ' · 蛊市新蛊：' + newSp : ''}</b><small>${REALM_NOTES[r]} · ${boss}</small>${r === S.realm && r < 5 ? `<em>下一劫阵容</em>${miniRow(tribTeam(r), 'foe')}` : ''}</span></li>`;
  }).join('');
  sheet(`<h3>修行路</h3><p class="sm">凡人到五转，每渡一劫：全体 +1/+1、择一道痕，空窍与蛊市随境界扩开。</p><ol class="path">${rows}<li class="pr ${S.realm >= 5 ? 'now' : ''}"><span class="pn">无尽</span><span class="pb"><b>无尽劫 · 层数无限</b><small>每层敌阵更强（+${ENDLESS.atkPerFloor} 攻 +${ENDLESS.hpPerFloor} 血/层），最高层写进分享卡。当前最高 ${S.endless} 层</small>${S.realm >= 5 ? `<em>第 ${S.floor} 层阵容</em>${miniRow(endlessTeam(S.floor), 'foe')}` : ''}</span></li></ol>`);
}
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

// ---------- Token 流 ----------
function onTick(t) {
  rate = t.rate; hot = t.hot;
  if (!booted) return;
  if (t.delta > 0 && S.started && !inBattle) feed(t.delta, t.hotDelta != null ? t.hotDelta : (t.hot ? t.delta : 0));
  else if (t.delta > 0 && S.started) S.bank = Math.min(bankCap(), S.bank + t.delta), S.total += t.delta;
  phase = t.idle ? 'yin' : 'yang';   // 只影响灵脉/呼吸动画，不影响能否斗蛊
  if (S.started) regenWill(t.delta || 0);
  meters();
}
let lastTick = performance.now();
function regenWill(tok) {   // 意志 = 体力：随时间和 token 回复，与是否空闲无关
  const now = performance.now(), dt = Math.min(5000, now - lastTick); lastTick = now;
  if (S.will >= WILL_MAX) { S.willT = 0; S.willK = 0; return; }
  S.willT += dt; S.willK += tok;
  let up = 0;
  while (S.willT >= WILL_SEC * 1000) { S.willT -= WILL_SEC * 1000; up++; }
  while (S.willK >= WILL_TOK * src.unit) { S.willK -= WILL_TOK * src.unit; up++; }
  if (up) { S.will = Math.min(WILL_MAX, S.will + up); renderSlots(); renderPhase(); save(); }
}
function feed(d, hotAmt) {
  S.total += d; let rest = d, hr = hotAmt || 0;
  S.stoneK += d; while (S.stoneK >= ECON.tokPer * src.unit) { S.stoneK -= ECON.tokPer * src.unit; S.stone++; renderMeta(); renderShop(); }
  if (S.team.some(g => g.wound > 0)) {
    const part = d * 0.5; rest -= part; hr *= 0.5; S.repair += part;
    while (S.repair >= REPAIR * src.unit) {
      const g = S.team.filter(x => x.wound > 0).sort((a, b) => b.wound - a.wound)[0]; if (!g) break;
      S.repair -= REPAIR * src.unit; g.wound--; renderSlots(); fxFloat(g.uid, '温养·伤愈', 'heal');
    }
  } else S.repair = 0;
  let guard = 0;
  while (rest > 0.01 && guard++ < 20) {
    if (S.sel == null) { S.bank = Math.min(bankCap(), S.bank + rest); break; }
    const cost = S.compass[S.sel].cost * src.unit, take = Math.min(cost - S.prog, rest), fr = take / rest;
    S.prog += take; S.wh += hr * fr; hr -= hr * fr; rest -= take;
    if (S.prog >= cost - 0.5) resolveNode();
  }
  save();
}
function resolveNode() {
  const node = S.compass[S.sel]; if (!node) return;
  const cost = node.cost * src.unit, wu = S.wh >= cost * 0.5;
  S.sel = null; S.prog = 0; S.wh = 0;
  if (!nodeOk(node.type, S.team, curCap())) { S.compass = rollCompass(R(), S.team, false, curCap()); renderPhase(); return; }
  let opts = nodeChoices(node, S.team, R(), S.realm);
  if (opts && opts.length > 1) {   // 选择题：不弹窗，挂在罗盘位上，等玩家有空再点
    if (node.type === 'devour') opts = opts.map(i => S.team[i].uid);
    S.pending = { node, opts, wu, cost }; renderPhase(); renderHint(); snd('pluck'); save(); return;
  }
  finishNode(node, opts ? opts[0] : undefined, wu, cost);
}
function finishNode(node, pick, wu, cost) {
  if (node.type === 'devour' && typeof pick === 'string') pick = S.team.findIndex(g => g.uid === pick);
  S.pending = null;
  if (!nodeOk(node.type, S.team, curCap()) || (node.type === 'devour' && !(pick > 0))) { S.compass = rollCompass(R(), S.team, false, curCap()); renderPhase(); renderHint(); save(); return; }
  const res = applyNode(S.team, node, R(), { wuhuo: wu, pick, cap: curCap() });
  const tg = node.type === 'summon' ? S.team[S.team.length - 1] : S.team[0]; if (tg) tg.fed += cost;
  S.muts += res.muts; S.nodes++; S.will = Math.min(WILL_MAX, S.will + 1); S.stone += ECON.node;
  S.compass = rollCompass(R(), S.team, false, curCap());
  S.shop = rollShop(R(), S.realm, S.shop);
  animResolve(res, wu); renderPhase(); renderHint(); renderShop(); snd('pluck'); save();
}
async function animResolve(res, wu) {
  res.gone.forEach(uid => { const e = $(`.gu[data-uid="${uid}"]`); if (e) e.classList.add('eaten'); });
  if (res.gone.length) await sleep(420);
  renderSlots();
  res.fx.forEach((f, i) => setTimeout(() => {
    fxFloat(f.uid, f.txt, f.k);
    const e = $(`.gu[data-uid="${f.uid}"]`); if (e) { e.classList.remove('pulse', 'born'); void e.offsetWidth; e.classList.add(f.k === 'new' ? 'born' : 'pulse'); }
  }, i * 170));
  if (wu) stampIn($('#qiao'), '武火', false, 'side');
  if (res.combo) setTimeout(() => { stampIn($('#qiao'), res.combo.n, false); snd('glitch'); }, 600);
}

// ---------- 渲染 ----------
function renderAll() {
  const app = $('#app');
  app.innerHTML = S.started ? mainHTML() : startHTML();
  if (S.started) { renderSlots(); renderShop(); renderPhase(); renderHint(); meters(); }
}
function startHTML() {
  const r = makeRng(S.seed + ':start'), pool = poolFor(0).slice(), picks = [];
  while (picks.length < 3) { const s = pool.splice(r.int(pool.length), 1)[0]; picks.push(s); }
  return `<div class="start"><div class="hero"><h1 class="title">蛊码</h1><p class="tag">烧 Token，养蛊，斗道。</p>
  <p class="lead">万物皆可为蛊，蛊即是道。你写代码烧掉的每一个 token，都在喂这一窝蛊；停手的时候，它们替你去斗。</p></div>
  <h2 class="step">三选一，结本命蛊</h2><div class="starters">${picks.map(id => { const s = SP[id]; return `<button class="starter" data-act="pick" data-sp="${id}"><div class="sart">${guSVG(id)}</div><b>${s.n}</b><span class="sst"><i class="a">${s.atk}</i><i class="h">${s.hp}</i></span><span class="strig">${TRAITS[s.t].d(s.v)}</span><em>${s.lore}</em></button>`; }).join('')}</div>
  <p class="fine">${VSC ? '插件模式：读取本机 Claude Code / Codex 会话的 token 用量数字（不读内容）。' : '演示模式会模拟写代码的 token 流。存档只在本机。'}</p></div>`;
}
function mainHTML() {
  return `<header class="top"><div class="brand"><b class="logo">蛊码</b><span class="sub">烧 Token · 养蛊 · 斗道</span></div>
  <div class="tools"><button class="realm" id="realm" data-act="path" title="修行路">${REALMS[S.realm]}</button><button class="ib" data-act="theme" id="bTheme" title="主题：自动 / 日 / 夜">${{ auto: '自', light: '日', dark: '夜' }[S.theme || 'auto']}</button><button class="ib" data-act="sound" id="bSound" title="声音开关">${S.mute ? '静' : '声'}</button><button class="ib zhu" data-act="share">战帖</button></div></header>
  <section class="vein"><canvas id="vein"></canvas><div class="vinfo"><button class="chip" data-act="src" id="srcTag"></button><span id="rateTxt"></span><span id="fireTag" class="fire"></span><span class="grow"></span><span id="totTxt"></span></div></section>
  <div class="seg" id="demo">${[['coding', '写代码中'], ['wuhuo', '武火并发'], ['rest', '停手休息']].map(([m, t]) => `<button data-act="demo" data-m="${m}">${t}</button>`).join('')}</div>
  <section class="qiao" id="qiao"><div class="qhead"><span class="lbl">空窍 <small>左为炉口</small></span><span id="qmeta"></span></div><div class="slots" id="slots"></div><p class="marks" id="marks" data-act="marksInfo"></p><p class="hint" id="hint"></p></section>
  <section class="shop" id="shop"></section><section id="phase" class="phase"></section>
  <footer class="foot"><button data-act="duelInput">粘贴坐标码应战</button><button data-act="path">修行路</button><button data-act="codex">蛊典</button><button data-act="reset" id="bReset">重开一局</button></footer>`;
}
function guCard(g, i) {
  const sk = skillOf(g);
  return `<button class="gu${g.wound ? ' hurt' : ''}${i === 0 ? ' lead' : ''}" data-act="gu" data-i="${i}" data-uid="${g.uid}">
  <span class="art">${guSVG(g.sp)}</span>${(g.star || 1) > 1 ? `<span class="star">★${g.star}</span>` : ''}${sk ? `<span class="mseal${sk.named ? '' : ' pale'}">${esc(sk.n[0])}</span>` : ''}${g.q.length ? `<span class="qk">${g.q.map(q => QUIRKS[q].n[0]).join('')}</span>` : ''}
  <span class="nm">${SP[g.sp].n}</span><span class="st"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i></span>
  <span class="tr">${trChars(g.tr)}${g.att.map(a => `<i class="att">${SP[a].ab}</i>`).join('')}</span>${g.wound ? `<span class="wd">伤${g.wound}</span>` : ''}</button>`;
}
function renderSlots() {
  const box = $('#slots'); if (!box) return;
  const cap = curCap(); let h = '';
  for (let i = 0; i < SLOTS; i++) {
    if (S.team[i]) h += `<div class="slot">${guCard(S.team[i], i)}</div>`;
    else if (i < cap) h += '<div class="slot"><span class="empty">空</span></div>';
    else { const r = SLOT_BY_REALM.findIndex(c => c > i); h += `<div class="slot"><span class="empty lock">锁<small>${REALMS[r] || ''}开</small></span></div>`; }
  }
  box.innerHTML = h; renderMeta();
  const rl = $('#realm'); if (rl) rl.textContent = REALMS[S.realm];
  const mk = $('#marks'); if (mk) mk.textContent = S.marks.length ? '道痕 · ' + S.marks.map(k => MARKS[k].n).join(' · ') : '';
}
function renderMeta() {
  const m = $('#qmeta'); if (!m) return;
  const wd = S.team.reduce((a, g) => a + (g.wound || 0), 0);
  m.innerHTML = `<b class="stone">◈ ${S.stone}</b> 元石 · 意志 <b class="will">${'◆'.repeat(S.will)}${'◇'.repeat(Math.max(0, WILL_MAX - S.will))}</b>${wd ? ` · 元气 ${Math.max(0, 100 - 12 * wd)}%` : ''}`;
}
function renderShop() {
  const box = $('#shop'); if (!box || !S.started) return;
  if (!S.shop || S.shop.length !== 3) S.shop = rollShop(R(), S.realm, []);
  const cost = buyCost(), rc = refCost(), cap = curCap();
  box.innerHTML = `<div class="ch"><span class="lbl">蛊市 <small>${REALMS[S.realm]}档 · ${poolFor(S.realm).length} 种 · 三只同种合炼升星</small></span><button class="ib mini-b" data-act="refresh"${S.stone >= rc ? '' : ' disabled'}>刷新${rc ? ' ' + rc + '◈' : ''}</button></div>
  <div class="wares">${S.shop.map((w, i) => {
    const sp = SP[w.sp], merge = S.team.filter(g => g.sp === w.sp && (g.star || 1) === 1).length >= 2, ok = !w.sold && S.stone >= cost && canBuy(S.team, w.sp, cap);
    const tag = w.sold ? '已购' : !canBuy(S.team, w.sp, cap) ? '空窍已满' : (merge ? '合炼 ' : '') + cost + '◈';
    return `<div class="ware${w.frozen ? ' frozen' : ''}${w.sold ? ' sold' : ''}${merge && !w.sold ? ' merge' : ''}"><button class="wbuy" data-act="buy" data-i="${i}"${ok ? '' : ' disabled'}><span class="art">${guSVG(w.sp)}</span><b>${sp.n}</b><span class="st"><i class="a">${sp.atk}</i><i class="h">${sp.hp}</i></span><span class="wt">${TRAITS[sp.t].n}${sp.v > 1 ? sp.v : ''}</span><span class="price">${tag}</span></button>${w.sold ? '' : `<button class="frz" data-act="freeze" data-i="${i}">${w.frozen ? '已冻结' : '冻结'}</button>`}</div>`;
  }).join('')}</div>`;
}
function miniRow(t, cls = '') {
  return `<div class="mini ${cls}">${t.map(g => { const sk = skillOf(g); return `<div class="mg"><span class="art">${guSVG(g.sp)}</span><b>${SP[g.sp].n}${(g.star || 1) > 1 ? '★' + g.star : ''}</b><span class="st"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i></span>${sk && sk.named ? `<em class="cs">${esc(sk.n)}</em>` : `<span class="tr">${trChars(g.tr)}</span>`}</div>`; }).join('')}</div>`;
}
function choiceHTML(p) {
  const L = S.team[0], t = p.node.type;
  const head = { mutate: `突变 · ${L ? SP[L.sp].n : ''} 择一词条`, summon: '招蛊 · 三选一', devour: `吞噬 · ${L ? SP[L.sp].n : ''} 吞下哪一只` }[t];
  const items = p.opts.map((o, i) => {
    if (t === 'mutate') { const e = L && L.tr.find(x => x[0] === o), v = e ? e[1] + 1 : 1; return `<button class="node opt" data-act="choose" data-i="${i}"><span class="nseal">${TRAITS[o].ch}</span><span class="nbody"><b>${TRAITS[o].n}${e ? ` · 升至 ${v} 层` : ''}</b><small>${TRAITS[o].trig} · ${TRAITS[o].d(v)}</small></span></button>`; }
    if (t === 'summon') { const sp = SP[o]; return `<button class="node opt" data-act="choose" data-i="${i}"><span class="oart">${guSVG(o)}</span><span class="nbody"><b>${sp.n} <i class="a">${sp.atk}</i> <i class="h">${sp.hp}</i></b><small>${TRAITS[sp.t].d(sp.v)} · ${sp.lore}</small></span></button>`; }
    const g = S.team.find(x => x.uid === o); if (!g || g === L) return '';
    return `<button class="node opt" data-act="choose" data-i="${i}"><span class="oart">${guSVG(g.sp)}</span><span class="nbody"><b>吞下 ${SP[g.sp].n} <i class="a">${effA(g)}</i> <i class="h">${effH(g)}</i></b><small>${g.tr.map(x => TRAITS[x[0]].n + (x[1] > 1 ? x[1] : '')).join(' · ')}${g.att.length ? ' · 附' + g.att.length : ''}</small></span></button>`;
  }).join('');
  return `<div class="compass"><div class="ch"><span class="lbl">${head}</span><span class="bank">灵气照常累积</span></div><div class="nodes">${items}</div></div>`;
}
function nodeDesc(n) {
  const L = S.team[0] ? SP[S.team[0].sp].n : '', R1 = S.team[1] ? SP[S.team[1].sp].n : '', Z = S.team.length ? SP[S.team[S.team.length - 1].sp].n : '';
  switch (n.type) {
    case 'feed': return `全体依次 +3/+2/+1 血，${L} 另 +1 攻`;
    case 'temper': return `${L} +2 攻 +2 血`;
    case 'mutate': return `${L} 觉醒一个词条，三选一`;
    case 'split': return `${L} 裂出六成之力的分身，词条全带`;
    case 'devour': return `${L} 吞下你挑的一只：六成攻血 + 全部词条`;
    case 'summon': return `${REALMS[S.realm]}档蛊池三选一，入最右空窍`;
    case 'refine': {
      const g = S.team[0], z = S.team[S.team.length - 1]; let tip = '';
      if (g && z) { const c = comboOf({ sp: g.sp, att: [...g.att, z.sp] }); if (c && c !== comboOf(g)) tip = ` → 成杀招【${c.n}】`; }
      return `把 ${Z} 炼为 ${L} 的附蛊${tip}`;
    }
  }
  return '';
}
function renderPhase() {
  const box = $('#phase'); if (!box) return;
  if (S.compass.length === 0 || S.compass.every(n => !nodeOk(n.type, S.team, curCap()))) { S.compass = rollCompass(R(), S.team, false, curCap()); S.sel = null; S.prog = 0; }
  const canFight = S.will > 0, nextWill = Math.max(0, Math.ceil(WILL_SEC - S.willT / 1000));
  const tribLabel = S.realm < 5 ? `渡${TRIB_NAMES[Math.min(S.realm, 4)]}` : '五转大成';
  box.innerHTML = (S.pending ? choiceHTML(S.pending) : `<div class="compass"><div class="ch"><span class="lbl">罗盘 · 三岔</span><span id="bank" class="bank"></span></div>
  <div class="nodes">${S.compass.map((n, i) => { const ok = nodeOk(n.type, S.team, curCap()), on = S.sel === i; return `<button class="node${on ? ' on' : ''}" data-act="node" data-i="${i}"${ok ? '' : ' disabled'}><span class="nseal">${NODES[n.type].ch}</span><span class="nbody"><b>${NODES[n.type].n}</b><small>${esc(nodeDesc(n))}</small></span><span class="ncost">${fmtTok(n.cost * src.unit)}</span><span class="nbar"><i></i></span></button>`; }).join('')}</div></div>`) + `
  <div class="gate${canFight ? ' open' : ''}"><div class="gh"><span class="lbl">斗蛊</span><span class="gsub">${canFight ? `每场耗 1 点意志 · 余 ${S.will}` : `意志已尽 · 约 ${Math.ceil(nextWill / 60)} 分钟回 1 点，养蛊也会回`}</span></div>
  <div class="gbtns">${S.realm < 5 ? `<button class="gbtn" data-act="trib"${canFight ? '' : ' disabled'}><b>${tribLabel}</b><small>${REALMS[S.realm + 1]}境 Boss · 胜则升阶</small></button>` : `<button class="gbtn" data-act="endless"${canFight ? '' : ' disabled'}><b>无尽劫 · 第 ${S.floor} 层</b><small>最高 ${S.endless} 层 · 逐层变强</small></button>`}<button class="gbtn" data-act="ghost"${canFight ? '' : ' disabled'}><b>斗幽灵</b><small>易 · 中 · 难 任选 · 胜得元石夺蛊</small></button></div></div>`;
  meters();
}
function renderHint() {
  const h = $('#hint'); if (!h) return;
  let t;
  if (S.team.some(g => g.wound)) t = '元气受损：一半 token 先拿去温养伤口。';
  else if (S.pending) t = '罗盘停在一道选择题上。选好了，下一条路才会开。';
  else if (S.sel == null) t = S.nodes === 0 ? '选一条路。Token 流过，蛊沿路生长。' : '罗盘转好了，挑下一条路。顺序即流派。';
  else if (S.nodes >= 1 && S.will > 0) t = `${NODES[S.compass[S.sel].type].n}中。想打随时可以斗蛊，耗一点意志。`;
  else t = `${NODES[S.compass[S.sel].type].n}中：你写代码，它在长。`;
  h.textContent = t;
}
function meters() {
  if (!S.started) return;
  const rt = $('#rateTxt'); if (!rt) return;
  rt.textContent = rate > 0 ? `${fmtTok(rate)}/s` : '静';
  const ft = $('#fireTag'); ft.textContent = rate <= 0 ? '' : hot ? '武火' : '文火'; ft.classList.toggle('hot', hot && rate > 0);
  $('#totTxt').textContent = '累计 ' + fmtTok(S.total);
  const st = $('#srcTag'); st.textContent = src.mode === 'vscode' ? 'Claude 实时' : '演示';
  const dm = $('#demo'); dm.hidden = src.mode !== 'demo'; dm.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === src.demo));
  const bk = $('#bank'); if (bk) bk.textContent = S.bank > 0 ? `灵气存 ${fmtTok(S.bank)}` : '';
  if (S.sel != null) { const n = S.compass[S.sel], bar = document.querySelector(`.node[data-i="${S.sel}"] .nbar i`); if (n && bar) bar.style.width = Math.min(100, 100 * S.prog / (n.cost * src.unit)).toFixed(1) + '%'; }
  const q = $('#qiao'); if (q) { q.classList.toggle('flow', rate > 0 && S.sel != null); q.classList.toggle('hot', hot && rate > 0); }
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
  const btn = $('#bTheme'); if (btn) btn.textContent = { auto: '自', light: '日', dark: '夜' }[pref];
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
  while (vAcc >= 1) { vAcc--; VP.push({ x: -8, y: 6 + Math.floor(Math.random() * 3) * 8 + Math.random() * 2, c: '0123456789abcdef{}<>=;:/'[(Math.random() * 24) | 0], a: 0.25 + Math.random() * 0.6, z: hot && Math.random() < 0.18, v: 0.7 + Math.random() * 0.6 }); }
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
function shake(px) { const a = $('#arena'); if (a) a.animate([{ transform: 'none' }, { transform: `translate(${px}px,${-px / 2}px)` }, { transform: `translate(${-px}px,${px / 3}px)` }, { transform: `translate(${px / 2}px,0)` }, { transform: 'none' }], { duration: 240 }); }

// ---------- 斗蛊 ----------
function startBattle(kind, foe) {
  if (inBattle) return;
  let enemy, title, ename, erealm = S.realm;
  if (kind === 'trib') { if (S.realm >= 5) return; enemy = tribTeam(S.realm); ename = `${REALMS[S.realm + 1]}·${TRIB_NAMES[Math.min(S.realm, 4)]}`; title = ename.replace('·', ' · '); erealm = S.realm + 1; }
  else if (kind === 'endless') { enemy = endlessTeam(S.floor); ename = `无尽劫·第${S.floor}层`; title = `无尽劫 · 第 ${S.floor} 层`; erealm = 5; }
  else if (kind === 'ghost') { enemy = foe.team; ename = '幽灵·' + foe.name; title = `幽灵 · ${foe.name}（${foe.label || ''}）`; }
  else { enemy = foe.team; ename = foe.name || '无名蛊师'; erealm = foe.realm || 0; title = '战帖 · ' + ename; }
  if (kind !== 'duel' && S.will <= 0) return;
  const mine = (kind === 'duel' && (!S.started || !S.team.length)) ? starterTeam() : S.team;
  const ca = encodeTeam(mine, { name: S.name || '无名蛊师', realm: S.realm, marks: kind === 'duel' && !S.started ? [] : S.marks }), cb = encodeTeam(enemy, { name: ename, realm: erealm, marks: (foe && foe.marks) || [] });
  const seed = kind === 'duel' ? hashStr(ca + '|' + cb).toString(36) : ((S.seed ^ Math.imul(++S.step, 2654435761)) >>> 0).toString(36);
  const A = decodeTeam(ca), Bt = decodeTeam(cb);
  const res = battle(A.team, Bt.team, 'r:' + seed, A.marks, Bt.marks);
  if (kind !== 'duel') S.will--;
  save(); playBattle({ kind, title, res, enemy, foe, tier: foe && foe.tier, A, B: Bt, replay: [ca, cb, seed, kind[0]].join('.') });
}
function parseReplay(text) {
  const m = String(text || '').match(/r=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([0-9a-z]+)(?:\.([tgd]))?/); if (!m) return null;
  const A = decodeTeam(m[1]), B = decodeTeam(m[2]); if (!A || !B) return null;
  return { A, B, seed: m[3], kind: m[4] || 'd', replay: [m[1], m[2], m[3], m[4] || 'd'].join('.') };
}
function openReplay(rp) {
  window.__guRp = rp;
  const row = t => `<div class="mini">${t.map(g => { const sk = skillOf(g); return `<div class="mg"><span class="art">${guSVG(g.sp)}</span><b>${SP[g.sp].n}</b><span class="st"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i></span>${sk && sk.named ? `<em class="cs">${esc(sk.n)}</em>` : `<span class="tr">${trChars(g.tr)}</span>`}</div>`; }).join('')}</div>`;
  sheet(`<p class="eyebrow">复盘</p><h3 class="duelh">${esc(rp.B.name || '无名')} 对 ${esc(rp.A.name || '无名')}</h3><p class="sm">同一组阵容、同一颗种子，重放的是一模一样的那一场。</p>${row(rp.B.team)}<p class="vsline">— 对 —</p>${row(rp.A.team)}<div class="row2"><button class="zhu big" data-act="replayGo">观看复盘</button></div>`);
}
function openLinkText(text) {
  const rp = parseReplay(text); if (rp) { openReplay(rp); return true; }
  const foe = decodeTeam(text); if (foe) { openDuel(foe); return true; }
  return false;
}
function replayURL(link) { return (/^https?:/.test(location.protocol) ? location.origin + location.pathname : SHARE_BASE) + '#r=' + link; }
function buHTML(uid, r) {
  return `<div class="bu${r.side ? ' foe' : ''}${r.boss ? ' boss' : ''}" data-uid="${uid}"><div class="bart">${guSVG(r.sp)}</div><div class="binfo"><b class="bnm">${esc(r.name)}</b><span class="bst"><i class="a"></i><i class="h"></i><i class="s" hidden></i></span><span class="btr">${trChars(r.tr)}</span>${r.combo ? `<em class="cs">${esc(r.combo)}</em>` : ''}</div></div>`;
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
    case 'buff': fxFloat(e.uid, e.sh ? `护+${e.sh}` : `+${e.a}/+${e.h}`.replace('/+0', '').replace('+0/', ''), 'buff'); return D(EV_MS.buff);
    case 'trig': {
      const lab = e.id ? TRAITS[e.id].n : e.mk ? '道痕·' + MARKS[e.mk].n : QUIRKS[e.q].n, ch = e.id ? TRAITS[e.id].ch : e.mk ? '道' : QUIRKS[e.q].n[0];
      const n = bnode(e.uid); if (n) { const g = el(`<span class="tg">${ch}</span>`); n.appendChild(g); setTimeout(() => g.remove(), 700); }
      blog(`${nm(e.uid)} · ${lab}`); return D(EV_MS.trig);
    }
    case 'combo': {
      const n = bnode(e.uid);
      if (e.quiet || seen.has(e.uid)) { if (n) { const g = el(`<span class="tg zhu">${esc(e.n[0])}</span>`); n.appendChild(g); setTimeout(() => g.remove(), 700); } return D(EV_MS.comboQuiet); }
      seen.add(e.uid); blog(`杀招【${e.n}】`);
      return comboCut(e.n, n, ros[e.uid]);
    }
    case 'summon': blog(`${nm(e.uid)} 现身`); return D(EV_MS.summon);
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
  const ov = el(`<div class="battle" id="battle"><div class="bbar"><span class="btitle">${esc(B.title)}</span><span class="bturn" id="bturn">开战</span><button class="ib" data-act="speed" id="bspd">${S.speed}×</button><button class="ib" data-act="skip">跳过</button></div>
  <div class="arena" id="arena"><div class="side sb" id="sideB"></div><div class="mid"><i></i><span>斗</span><i></i></div><div class="side sa" id="sideA"></div></div><div class="blog" id="blog"></div></div>`);
  document.body.appendChild(ov);
  const log = B.res.log, ros = B.res.roster, seen = new Set(); tempo = tempoFor(playMs(log)); chain = { side: -1, n: 0 };
  finalBlow = B.res.winner === 'draw' ? null : [...log].reverse().find(e => e.t === 'faint') || null;
  const hpSum = s => s.reduce((a, x) => a + x[2], 0), s0 = log[0].s[0], s1 = log[log.length - 1].s[0];
  B.comeback = B.res.winner === 'A' && hpSum(s1) <= 0.2 * hpSum(s0);
  B.crits = log.filter(e => e.t === 'dmg' && e.crit && e.src === 0).length;
  applySnap(log[0].s, ros);
  for (const e of log) { if (skip) break; await animEv(e, ros, seen); if (skip) break; applySnap(e.s, ros); }
  applySnap(log[log.length - 1].s, ros);
  showResult(B);
}
function wound() {
  S.team.forEach(g => { g.wound = Math.min(3, (g.wound || 0) + 1); });
  const L = S.team[0]; if (L) { const t = L.tr.filter(x => x[1] > 1).sort((a, b) => b[1] - a[1])[0]; if (t) t[1]--; }
}
function showResult(B) {
  const w = B.res.winner, win = w === 'A', draw = w === 'draw';
  let txt = '', loot = [], btns = '';
  if (B.kind === 'replay') {}
  else if (B.kind === 'endless') {
    if (win) { S.wins++; S.endless = Math.max(S.endless, S.floor); S.floor++; txt = `破无尽劫第 ${S.floor - 1} 层。最高 ${S.endless} 层。`; }
    else if (draw) txt = '劫云僵持，未破此层。';
    else { S.losses++; wound(); txt = `止步第 ${S.floor} 层。元气受损，写代码温养可愈。`; }
  }
  else if (B.kind === 'trib') {
    if (win) {
      S.realm++; S.wins++; S.team.forEach(g => { g.atk++; g.hp++; }); S.ghosts = null; S.shop = rollShop(R(), S.realm, S.shop);
      txt = `渡劫成功，晋${REALMS[S.realm]}。全体蜕变 +1/+1${slotCap(S.realm) > slotCap(S.realm - 1) ? '，空窍多开一格' : ''}。择一道痕，伴你整局：`;
      loot = rollMarks(R(), S.marks).map(k => ({ k: 'mark', id: k, t: `道痕【${MARKS[k].n}】${MARKS[k].d}` }));
    }
    else if (draw) txt = '劫云散去，未分胜负。';
    else { S.losses++; wound(); txt = '渡劫失败：元气受损，全体伤 1 层，主蛊降阶。写代码温养可愈。'; }
  } else if (B.kind === 'ghost') {
    if (win) {
      S.wins++; const r = R(), L = S.team[0];
      const atts = [...new Set(B.enemy.flatMap(g => g.att))], sps = [...new Set(B.enemy.map(g => g.sp))];
      if (S.team.length < curCap()) { const sp = atts.length ? r.pick(atts) : r.pick(sps); loot.push({ k: 'take', sp, t: `夺蛊：${SP[sp].n} 入空窍` }); }
      const trs = [...new Set(B.enemy.flatMap(g => g.tr.map(t => t[0])))].filter(id => { const e = L && L.tr.find(t => t[0] === id); return L && (e ? e[1] < MAXV : L.tr.length < MAXTR); });
      while (loot.length < 3 && trs.length) { const id = trs.splice(r.int(trs.length), 1)[0]; loot.push({ k: 'print', id, t: `拓印【${TRAITS[id].n}】→ ${SP[L.sp].n}` }); }
      if (!loot.length) loot.push({ k: 'boon', t: `${L ? SP[L.sp].n : '主蛊'} +2/+2` });
      txt = '胜。从败者残躯上取一样：';
    } else if (draw) txt = '两败俱伤，各自退去。';
    else { S.losses++; wound(); txt = '败。元气受损，全体伤 1 层，主蛊降阶。写代码温养可愈。'; }
  } else {
    txt = win ? '你接下了这封战帖，赢了。' : draw ? '平手。再养一养，回敬一封。' : '这封战帖的主人更强。去养蛊，再来。';
    btns = `<button class="zhu" data-act="replyDuel">回敬战帖</button>` + (S.started ? '' : `<button data-act="closeBattle">开始养自己的蛊</button>`);
  }
  if (B.kind === 'replay') {
    txt = draw ? '这一场打成了平手。' : `${esc((win ? B.A : B.B).name || '无名')} 胜。`;
    window.__guFoe = win || draw ? B.A : B.B;
    btns = `<button class="zhu" data-act="duelWinner">挑战胜者阵容</button>` + (S.started ? '' : `<button data-act="closeBattle">开始养自己的蛊</button>`);
  }
  let base = 0; const mults = [];
  if (B.kind === 'trib' || B.kind === 'ghost' || B.kind === 'endless') base = win ? ECON.win[B.kind === 'ghost' ? (B.tier || 'mid') : B.kind] : ECON.lose;
  if (base && win) {
    S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak);
    if (S.streak >= 2) mults.push([`${S.streak} 连胜`, +(1 + 0.25 * Math.min(S.streak - 1, 8)).toFixed(2)]);
    if (S.day !== today()) { S.day = today(); S.dayWin = false; }
    if (!S.dayWin) { S.dayWin = true; mults.push(['每日首胜', 3]); }
    if (B.comeback) mults.push(['绝境翻盘', 2]);
    if (B.crits >= 3) mults.push([`暴击 ${B.crits} 次`, 1.2]);
  } else if (base && !draw) S.streak = 0;
  if (base && S.marks.includes('shengCai')) mults.push(['生财有道', 1.5]);
  const gain = Math.round(mults.reduce((a, m) => a * m[1], base)); S.stone += gain; B.pay = { base, mults, gain };
  if (B.kind === 'ghost') S.ghosts = null;
  B.loot = loot; window.__guB = B; snd(win ? 'win' : draw ? 'pluck' : 'lose');
  const panel = el(`<div class="result"><div class="rseal${win ? '' : ' lose'}">${win ? '胜' : draw ? '和' : '败'}</div>${B.comeback ? '<span class="goldtag">绝境翻盘</span>' : ''}<p class="rtxt">${txt}</p>
  ${base ? `<div class="payout" data-act="payskip"><span class="plab">元石</span><b class="pnum">0</b><div class="pmul"></div></div>` : ''}
  ${loot.map((l, i) => `<button class="loot" data-act="loot" data-i="${i}">${esc(l.t)}</button>`).join('')}
  <div class="rbtns">${btns}${loot.length ? '' : `<button data-act="closeBattle">${S.started ? '回空窍' : '关闭'}</button>`}<button data-act="copyReplay">复制复盘链接</button></div></div>`);
  $('#battle').appendChild(panel); save(); renderMeta();
  if (base) payout(panel.querySelector('.payout'), base, mults);
}
let payFast = false;
async function payout(box, base, mults) {
  payFast = false; const num = box.querySelector('.pnum'), row = box.querySelector('.pmul'); let cur = 0;
  const roll = (to, ms) => new Promise(res => { const from = cur, t0 = performance.now(); const f = now => { const k = Math.min(1, (now - t0) / ms); cur = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); num.textContent = fmtNum(cur); if (k < 1 && !payFast) requestAnimationFrame(f); else { cur = to; num.textContent = fmtNum(to); res(); } }; requestAnimationFrame(f); });
  await sleep(500); await roll(base, 450); snd('coin');
  let val = base;
  for (const [lab, m] of mults) {
    if (payFast) break; await sleep(300);
    row.appendChild(el(`<span class="mcard"><small>${esc(lab)}</small><b>×${m}</b></span>`)); snd('clack');
    box.animate([{ transform: 'translateY(3px)' }, { transform: 'none' }], { duration: 180 });
    val = val * m; await roll(Math.round(val), 420);
  }
  const total = Math.round(mults.reduce((a, m) => a * m[1], base));
  if (payFast) row.innerHTML = mults.map(([lab, m]) => `<span class="mcard"><small>${esc(lab)}</small><b>×${m}</b></span>`).join('');
  num.textContent = fmtNum(total); num.classList.add('final'); snd(mults.length ? 'coins' : 'coin');
}
function closeBattle() {
  const b = $('#battle'); if (b) b.remove(); inBattle = false;
  if (S.started) { if (S.compass.some(n => !nodeOk(n.type, S.team, curCap()))) { S.compass = rollCompass(R(), S.team, false, curCap()); S.sel = null; S.prog = 0; } renderAll(); }
  else renderAll();
  save();
}

// ---------- 弹层（只由玩家点击打开）----------
function sheet(html) {
  closeSheet();
  const s = el(`<div class="sheet-bg" data-act="closeSheet"><div class="sheet" data-stop="1"><button class="x" data-act="closeSheet">×</button>${html}</div></div>`);
  document.body.appendChild(s); return s;
}
function closeSheet() { const s = $('.sheet-bg'); if (s) s.remove(); }
function openGu(i) {
  const g = S.team[i]; if (!g) return; const s = SP[g.sp], sk = skillOf(g);
  sheet(`<div class="detail"><div class="dart">${guSVG(g.sp)}</div><div><h3>${s.n}</h3><p class="lore">${s.lore}${g.clone ? ' · 分身' : ''}</p><p class="dst"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i>${g.wound ? ` <span class="wd">伤 ${g.wound} 层</span>` : ''}</p></div></div>
  <h4>词条</h4><ul>${g.tr.map(([id, v]) => `<li><b>${TRAITS[id].n}${v > 1 ? ` ${v}层` : ''}</b>${TRAITS[id].d(v)}</li>`).join('')}</ul>
  ${g.q.length ? `<h4>怪癖</h4><ul>${g.q.map(q => `<li><b>${QUIRKS[q].n}</b>${QUIRKS[q].d}</li>`).join('')}</ul>` : ''}
  ${sk ? `<h4>杀招</h4><div class="skill"><span class="seal${sk.named ? '' : ' pale'}">${esc(sk.n)}</span><p>${esc(sk.d)}<br><small>附蛊：${g.att.map(a => SP[a].n).join('、')}</small></p></div>` : ''}
  <h4>算力履历</h4><p class="hist">累计喂养 <b>${fmtTok(g.fed)}</b> token · 突变 <b>${g.mut || 0}</b> 次</p>
  <div class="row2"><button data-act="mv" data-i="${i}" data-d="-1"${i === 0 ? ' disabled' : ''}>← 左移</button><button data-act="mv" data-i="${i}" data-d="1"${i >= S.team.length - 1 ? ' disabled' : ''}>右移 →</button></div>
  <div class="row2"><button data-act="sell" data-i="${i}"${S.team.length > 1 ? '' : ' disabled'}>出售 +${sellValue(g)}◈</button></div>
  <p class="sm">左为炉口：多数罗盘节点作用在最左那只；炼附取最右那只。${(g.star || 1) > 1 ? ` ★${g.star}：词条位 ${trCap(g)} 个。` : ''}</p>
  <details class="book"><summary>杀招配方（${COMBOS.length}）</summary><ul>${COMBOS.map(c => `<li><b>${c.n}</b>${c.need.map(x => SP[x].n).join(' + ')}</li>`).join('')}</ul></details>`);
}
function shareText(code) { return `我在《蛊码》养了一窝蛊（${REALMS[S.realm]}），敢接战帖吗？\n界壁坐标码：${code}`; }
const SHARE_BASE = 'https://1596941391qq.github.io/gu-code/';
function shareURL(code) { return (/^https?:/.test(location.protocol) ? location.origin + location.pathname : SHARE_BASE) + '#c=' + code; }
function myCode() { return encodeTeam(S.team.length ? S.team : starterTeam(), { name: S.name, realm: S.realm, marks: S.marks }); }
function openGhosts() {
  if (!S.ghosts || S.ghosts.realm !== S.realm) { const r = R(); S.ghosts = { realm: S.realm, list: ghostTrio(r, Math.max(1, S.nodes) + S.realm, S.realm).map(o => ({ tier: o.tier, label: o.label, name: o.name, code: encodeTeam(o.team, { name: '幽灵·' + o.name, realm: S.realm }) })) }; save(); }
  sheet(`<h3>斗幽灵 · 择一对手</h3><p class="sm">阵容摆在明面上，越难元石越多；胜了还能从残躯上夺一样。每场耗 1 点意志（余 ${S.will}）。</p>${S.ghosts.list.map((o, i) => { const d = decodeTeam(o.code); return `<div class="foeopt"><div class="fh"><b class="tier t-${o.tier}">${o.label}</b><span class="fn">${esc(o.name)}</span><span class="rw">胜 +${ECON.win[o.tier]}◈</span></div>${miniRow(d.team, 'foe')}<button class="zhu" data-act="ghostGo" data-i="${i}"${S.will > 0 ? '' : ' disabled'}>应战</button></div>`; }).join('')}`);
}
let cardURL = '';
async function openShare() {
  const code = myCode(), url = shareURL(code);
  sheet(`<h3>界壁坐标码</h3><p class="sm">发给朋友。对方${url ? '打开链接，或' : ''}在蛊码里粘贴坐标码，就会和你这支阵容开打。</p>
  <label class="row"><span>蛊师名号</span><input id="nm" maxlength="8" value="${esc(S.name)}" placeholder="无名蛊师"></label>
  <div class="code" id="codeTxt">${code}</div>
  <div class="row2"><button data-act="copyCode">复制坐标码</button><button data-act="copyLink">${url ? '复制战帖链接' : '复制战帖文案'}</button></div>
  <div class="cardbox"><img id="cardImg" alt="分享卡"><div class="row2"><button class="zhu" data-act="savePng">保存分享卡 PNG</button></div><p class="sm">${VSC ? '' : '手机上可长按图片保存。'}</p></div>`);
  $('#nm').addEventListener('change', e => { S.name = e.target.value.trim().slice(0, 8); save(); openShare(); });
  cardURL = ''; const img = $('#cardImg');
  try { cardURL = await makeCard({ team: S.team.length ? S.team : starterTeam(), name: S.name, realm: S.realm, total: S.total, muts: S.muts, wins: S.wins, code, url, endless: S.endless }); if (img) img.src = cardURL; } catch (e) { if (img) img.alt = '分享卡生成失败'; }
}
function copy(text, btn) {
  const done = () => { if (btn) { const o = btn.textContent; btn.textContent = '已复制'; setTimeout(() => { btn.textContent = o; }, 1200); } };
  if (VSC) { VSC.postMessage({ type: 'copy', text }); return done(); }
  const fb = () => { const t = el('<textarea></textarea>'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} t.remove(); done(); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fb); else fb();
}
function openDuelInput() {
  sheet(`<h3>应战</h3><p class="sm">粘贴朋友发来的界壁坐标码、战帖链接或复盘链接。</p><textarea id="duelIn" rows="3" placeholder="坐标码"></textarea><p class="err" id="duelErr"></p><div class="row2"><button class="zhu" data-act="duelGo">查看战帖</button></div>`);
  setTimeout(() => { const t = $('#duelIn'); if (t) t.focus(); }, 50);
}
function openDuel(foe) {
  if (!foe) return;
  const mine = S.started && S.team.length ? S.team : starterTeam();
  const row = (t, cls) => `<div class="mini ${cls}">${t.map(g => { const sk = skillOf(g); return `<div class="mg"><span class="art">${guSVG(g.sp)}</span><b>${SP[g.sp].n}</b><span class="st"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i></span>${sk && sk.named ? `<em class="cs">${esc(sk.n)}</em>` : `<span class="tr">${trChars(g.tr)}</span>`}</div>`; }).join('')}</div>`;
  window.__guFoe = foe;
  sheet(`<p class="eyebrow">界壁震动</p><h3 class="duelh">有人向你下战帖</h3><p class="sm">来自 <b>${esc(foe.name || '无名蛊师')}</b> · ${REALMS[foe.realm] || '凡人'}</p>${row(foe.team, 'foe')}
  <p class="vsline">— 你的${S.started && S.team.length ? '空窍' : '初始阵容'} —</p>${row(mine, '')}<div class="row2"><button class="zhu big" data-act="duelFight">应战</button></div>`);
}
function checkHash() {
  const h = location.hash; if (!/[#&](c|r)=/.test(h)) return;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  openLinkText(h);
}

// ---------- 交互 ----------
const ACT = {
  pick(a) { S.team = [newGu(a.dataset.sp)]; S.started = true; S.shop = rollShop(R(), 0, []); S.compass = rollCompass(R(), S.team, true, curCap()); save(); renderAll(); },
  node(a) {
    const i = +a.dataset.i; if (S.sel === i) return;
    if (S.sel != null) S.bank = Math.min(bankCap(), S.bank + S.prog);
    S.sel = i; S.prog = 0; S.wh = 0;
    const cost = S.compass[i].cost * src.unit, take = Math.min(S.bank, cost); S.prog = take; S.bank -= take;
    renderPhase(); renderHint(); snd('pluck'); save();
    if (S.prog >= cost - 0.5) setTimeout(() => { if (S.sel === i && !inBattle) resolveNode(); }, 500);
  },
  gu(a) { openGu(+a.dataset.i); },
  mv(a) { const i = +a.dataset.i, j = i + +a.dataset.d; if (!S.team[j]) return; [S.team[i], S.team[j]] = [S.team[j], S.team[i]]; closeSheet(); renderSlots(); renderPhase(); save(); openGu(j); },
  demo(a) { src.demo = a.dataset.m; meters(); },
  src() { if (VSC) { src.setMode(src.mode === 'vscode' ? 'demo' : 'vscode'); renderPhase(); renderHint(); meters(); } else sheet(`<h3>真实 Token</h3><p class="sm">网页版默认是演示流。想让真实的 Claude Code / Codex 用量来养蛊，请装 VS Code 插件版（gu-code/vscode-ext），它只读会话里的 usage 数字，不读内容。</p>`); },
  theme() { S.theme = { auto: 'light', light: 'dark', dark: 'auto' }[S.theme || 'auto']; applyTheme(); save(); },
  sound() { S.mute = !S.mute; $('#bSound').textContent = S.mute ? '静' : '声'; save(); snd('pluck'); },
  share() { openShare(); },
  trib() { startBattle('trib'); }, ghost() { openGhosts(); }, endless() { startBattle('endless'); },
  path() { openPath(); }, codex() { openCodex(); },
  ghostGo(a) { const o = S.ghosts && S.ghosts.list[+a.dataset.i]; if (!o || S.will <= 0) return; const d = decodeTeam(o.code); closeSheet(); startBattle('ghost', { team: d.team, name: o.name, tier: o.tier, label: o.label }); },
  choose(a) { const p = S.pending; if (!p) return; finishNode(p.node, p.opts[+a.dataset.i], p.wu, p.cost); },
  buy(a) {
    const w = S.shop[+a.dataset.i], cost = buyCost(); if (!w || w.sold || S.stone < cost) return;
    const r = buyGu(S.team, w.sp, curCap(), S.marks, R()); if (!r) return;
    S.stone -= cost; w.sold = true; w.frozen = false;
    renderSlots(); renderShop(); renderPhase(); save(); snd('pluck');
    setTimeout(() => { if (r.merged.length) { const g = r.merged[r.merged.length - 1]; fxFloat(g.uid, `合炼 ★${g.star}`, 'mut'); stampIn($('#qiao'), '合炼', false, 'side'); } else fxFloat(r.gu.uid, '入窍', 'new'); }, 60);
  },
  refresh() { const c = refCost(); if (S.stone < c) return; S.stone -= c; S.shop = rollShop(R(), S.realm, S.shop); renderMeta(); renderShop(); save(); },
  freeze(a) { const w = S.shop[+a.dataset.i]; if (w) { w.frozen = !w.frozen; renderShop(); save(); } },
  sell(a) { const i = +a.dataset.i, g = S.team[i]; if (!g || S.team.length <= 1) return; S.stone += sellValue(g); S.team.splice(i, 1); closeSheet(); renderSlots(); renderShop(); renderPhase(); save(); },
  marksInfo() { if (S.marks.length) sheet(`<h3>道痕</h3><p class="sm">整局被动，渡劫成功时三选一。</p><ul>${S.marks.map(k => `<li><b>${MARKS[k].n}</b>${MARKS[k].d}</li>`).join('')}</ul>`); },
  speed() { S.speed = S.speed === 1 ? 2 : 1; $('#bspd').textContent = S.speed + '×'; save(); },
  skip() { skip = true; },
  payskip() { payFast = true; },
  loot(a) {
    const l = window.__guB.loot[+a.dataset.i], L = S.team[0];
    if (l.k === 'mark') { if (!S.marks.includes(l.id)) S.marks.push(l.id); }
    else if (l.k === 'take' && S.team.length < curCap()) S.team.push(newGu(l.sp));
    else if (l.k === 'print' && L) addTrait(L, l.id, 1);
    else if (L) { L.atk += 2; L.hp += 2; }
    closeBattle();
  },
  closeBattle() { closeBattle(); },
  replyDuel() { closeBattle(); openShare(); },
  closeSheet(a, e) { if (e.target.closest('[data-stop]') && !a.classList.contains('x')) return; closeSheet(); },
  copyCode(a) { copy(myCode(), a); },
  copyLink(a) { const c = myCode(), u = shareURL(c); copy(u ? shareText(c) + '\n' + u : shareText(c), a); },
  savePng() {
    if (!cardURL) return;
    if (VSC) VSC.postMessage({ type: 'savePng', data: cardURL });
    else { const a = document.createElement('a'); a.href = cardURL; a.download = 'gucode-card.png'; document.body.appendChild(a); a.click(); a.remove(); }
  },
  duelInput() { openDuelInput(); },
  duelGo() { if (!openLinkText($('#duelIn').value)) $('#duelErr').textContent = '坐标码或复盘链接不对，或者被截断了。'; },
  replayGo() { const rp = window.__guRp; closeSheet(); playBattle({ kind: 'replay', title: `复盘 · ${rp.B.name || '无名'} 对 ${rp.A.name || '无名'}`, res: battle(rp.A.team, rp.B.team, 'r:' + rp.seed, rp.A.marks, rp.B.marks), A: rp.A, B: rp.B, enemy: rp.B.team, replay: rp.replay }); },
  duelWinner() { closeBattle(); startBattle('duel', window.__guFoe); },
  copyReplay(a) {
    const B = window.__guB, w = B.res.winner, an = B.A.name || '无名', bn = B.B.name || '无名';
    const wt = w === 'draw' ? '打成平手' : (w === 'A' ? an : bn) + ' 胜';
    copy(`《蛊码》复盘：${an} 对 ${bn}，${wt}。点开看整场：\n${replayURL(B.replay)}`, a);
  },
  duelFight() { closeSheet(); startBattle('duel', window.__guFoe); },
  reset(a) {
    if (Date.now() - resetArm > 3000) { resetArm = Date.now(); a.textContent = '再点一次确认重开'; setTimeout(() => { a.textContent = '重开一局'; }, 3000); return; }
    codexScan(); const keep = { sound: S.sound, name: S.name, total: S.total, theme: S.theme, codex: S.codex }; S = Object.assign(fresh(), keep); save(); renderAll();
  },
};
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a || a.disabled) return;
  const f = ACT[a.dataset.act]; if (f) f(a, e);
});

// ---------- 启动 ----------
function boot(saved, pending) {
  const mg = migrate(saved); if (mg) S = Object.assign(fresh(), mg);
  if (!document.getElementById('gu-defs')) document.body.insertAdjacentHTML('afterbegin', `<svg id="gu-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${ART_DEFS}</defs></svg>`);
  applyTheme(); if (VSC && window.MutationObserver) new MutationObserver(applyTheme).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  booted = true; renderAll(); requestAnimationFrame(veinLoop);
  if (pending && pending.tokens > 0 && S.started) { feed(pending.tokens, pending.hot || 0); renderSlots(); renderPhase(); const h = $('#hint'); if (h) h.textContent = `你不在的时候，蛊吸纳了 ${fmtTok(pending.tokens)} token。`; }
  checkHash();
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
  const go = () => boot(s); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  window.addEventListener('hashchange', checkHash);
}

})();
