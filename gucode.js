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
  // 站位词条（只能往后加：坐标码按序号编码）
  guard:    { n: '护卫', ch: '卫', trig: '开战', d: v => `开战：自身 +${2 * v} 护体；相邻友蛊第一次挨打时由它代受` },
  link:     { n: '连心', ch: '连', trig: '开战', d: v => `开战：相邻友蛊各 +${v}/+${v}` },
  snipe:    { n: '暗针', ch: '针', trig: '开战', d: v => `开战：不在最前时，射敌方最末一只 ${2 * v + 1} 伤害` },
  vanguard: { n: '先登', ch: '登', trig: '开战', d: v => `开战：站最前时自身 +${v}/+${2 * v}` },
};
const TRAIT_KEYS = Object.keys(TRAITS);

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
const SP = Object.fromEntries(SPECIES.map(s => [s.id, s]));
const spTraits = id => { const s = SP[id]; return s.t2 ? [[s.t, s.v], [s.t2, s.v2]] : [[s.t, s.v]]; };
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
  { id: 'jinjia',   n: '金甲不坏身', need: ['iron', 'thorn'],  d: '开战再得 2 护体；护体未破时受击，反噬翻倍' },
  { id: 'wangu',    n: '万蛊朝宗',   need: ['queen', 'bone'],  d: '首次受击存活：身后召唤一只 1/1 蛊蛹；任一友蛊被召唤时，全体友蛊 +1/+1' },
  { id: 'tuoke',    n: '金蝉脱壳',   need: ['cicada', 'twin'], d: '首次阵亡时，以一半攻血原地蜕生' },
  { id: 'duopo',    n: '噬心夺魄',   need: ['mantis', 'scorp'], d: '击杀后，立刻对下一只敌蛊造成等同攻击的伤害（每回合一次）' },
  { id: 'pozhen',   n: '擂鼓破阵',   need: ['drum', 'boar'],   d: '回合开始：全体友蛊 +1/+1' },
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
function newGu(sp) { const s = SP[sp]; return { uid: nuid(), sp, atk: s.atk, hp: s.hp, tr: spTraits(sp), q: [], att: [], wound: 0, fed: 0, mut: 0 }; }
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
  return arrangeTeam(team);
}
// ---------- 布阵：站位效果与敌方排阵 ----------
// 每个下标收到哪些站位效果（界面画箭头/角标用）：[{ to, from, id, txt }]，to = -1 表示作用于敌方
function posLinks(team) {
  const out = [], n = team.length, tv = (g, id) => { const e = g.tr.find(t => t[0] === id); return e ? e[1] : 0; };
  team.forEach((g, i) => {
    let v;
    if ((v = tv(g, 'legacy')) && i + 1 < n) out.push({ to: i + 1, from: i, id: 'legacy', txt: `+${2 * v}/+${2 * v}` });
    if ((v = tv(g, 'war'))) out.push({ to: 0, from: i, id: 'war', txt: `+${v}攻/回合` });
    if ((v = tv(g, 'link'))) [i - 1, i + 1].forEach(j => { if (j >= 0 && j < n) out.push({ to: j, from: i, id: 'link', txt: `+${v}/+${v}` }); });
    if (tv(g, 'guard')) [i - 1, i + 1].forEach(j => { if (j >= 0 && j < n) out.push({ to: j, from: i, id: 'guard', txt: '代受一击' }); });
    if ((v = tv(g, 'vanguard')) && i === 0) out.push({ to: 0, from: 0, id: 'vanguard', txt: `+${v}/+${2 * v}` });
    if ((v = tv(g, 'snipe')) && i > 0) out.push({ to: -1, from: i, id: 'snipe', txt: `敌末位 -${2 * v + 1}` });
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
    const T = Object.fromEntries(g.tr), q = g.q || [], h = g.hp + 3 * (T.shell || 0) + 2 * (T.guard || 0);
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
  perm(team.slice(0, n), 0);
  team.splice(0, n, ...best); return team;
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
// 受伤：每层 -1/-1，最多 3 层；写代码温养（token）或静置（时间）都会愈合，哪个先满算哪个。不做永久损失
const WOUND = { max: 3, healTok: 60000, healSec: 240, loseNodePct: 0.3 };
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
    if (src && src.side !== tg.side && (kind === 'hit' || kind === 'skill') && !tg.f.guarded && !tg.tr.guard) {   // 护卫：相邻友蛊第一次挨打时代受
      const arr = S[tg.side], i = arr.indexOf(tg), gd = [arr[i - 1], arr[i + 1]].find(x => alive(x) && x.tr.guard);
      if (gd) { tg.f.guarded = 1; ev('trig', { uid: gd.uid, id: 'guard' }); tg = gd; }
    }
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
      if (T.guard && alive(u)) { tg('guard'); shield(u, 2 * T.guard); }
      const pos = S[u.side].indexOf(u);
      if (T.link && alive(u)) { tg('link'); [S[u.side][pos - 1], S[u.side][pos + 1]].forEach(a => { if (alive(a)) buff(a, T.link, T.link); }); }
      if (T.vanguard && pos === 0 && alive(u)) { tg('vanguard'); buff(u, T.vanguard, 2 * T.vanguard); }
      if (T.snipe && pos > 0 && alive(u)) { const fs = foes(u); if (fs.length) { tg('snipe'); deal(u, fs[fs.length - 1], 2 * T.snipe + 1, 'skill'); } }
      if (u.combo === 'sanzhu' && alive(u)) { comboEv(u); fired = true; const dd = Math.max(1, Math.ceil(u.atk / 2)); foes(u).slice(0, 3).forEach(f => deal(u, f, dd, 'skill')); }
      if (u.combo === 'jinjia' && alive(u)) { comboEv(u); fired = true; shield(u, 2); }
    } else if (h === 'turn') {
      if (T.war) { const a = allies(u)[0]; if (a) { tg('war'); buff(a, T.war, 0); } }
      if (u.combo === 'pozhen') { comboEv(u); fired = true; allies(u).forEach(a => buff(a, 1, 1)); }
      if (u.q.includes('blood')) deal(null, u, 1, 'self');
      if (u.q.includes('timid') && alive(u) && allies(u)[0] !== u) buff(u, 0, 1);
    } else if (h === 'hurt') {
      const s = c.src;
      if (T.thorn && s && c.kind !== 'thorn' && alive(s) && s.side !== u.side) { tg('thorn'); let d = T.thorn + 1 + (has(u.side, 'fanShi') ? 1 : 0); if (u.combo === 'jinjia' && c.had) d *= 2; deal(u, s, d, 'thorn'); }
      if (alive(u)) {
        if (T.frenzy) { tg('frenzy'); buff(u, T.frenzy, 0); }
        if (T.split && !u.f.split) { u.f.split = 1; tg('split'); summon(u.side, S[u.side].indexOf(u) + 1, { sp: 'shade', atk: T.split + 1, hp: T.split + 1 }, u); }
        if (u.combo === 'wangu' && !u.f.wangu) { u.f.wangu = 1; fired = true; comboEv(u); summon(u.side, S[u.side].indexOf(u) + 1, { sp: 'pupa', atk: 1, hp: 1 }, u); }
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
    this.acc = 0; this.hotAcc = 0; this.vrate = 0; this.vidle = true; this.vsrc = null;
    if (VSC) window.addEventListener('message', e => {
      const m = e.data || {};
      if (m.type === 'tokens') { this.acc += m.delta || 0; if (m.hot) this.hotAcc += m.delta || 0; this.vrate = m.rate || 0; this.vidle = !!m.idle; this.vsrc = m.bySource || null; }
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

// ---- src/ledger.js
// 蛊码 GuCode · 算力履历：修行日历、日内曲线、周天额度、灵根、功课、分神；年度履历卡；与玩法挂钩的纯函数。
//
// ═══ 集成指南 ════════════════════════════════════════════════════════════════
// 数据来源：插件或网页本地桥 window.postMessage({ type:'ledger', v:1, days, hours, sources, windows, tools, agents, generatedAt })。
//   两种口径：days[d].x / hours / windows[].used 是全量吞吐（raw，含每轮重复读上下文的读缓存，与 ccusage 同口径）；
//   days[d].t / windows[].usedEq 是算力当量（eq，读缓存按 0.1 计，推进养蛊用）；days[d].s / m 是 t 的拆分。
//   界面（日历、曲线、最强一日、年度卡）和玩法判定（灵根门槛、成就）一律用 raw；旧数据没有 x 时退回 t。
//   normLedger(raw) 校验清洗（字段名见 normLedger）；没有真实数据时界面用 demoLedger(seed, now)，它带 demo:true，
//   面板醒目标「演示数据」。demoLedger 同种子同 now 必出同一份数据（tools/ledger-test.mjs 有测）。
// 界面入口（ui.js 只加了几行）：
//   ledgerInit({ vsc, getLimits, setLimit, openSettings, onData, buffsOn })  启动时调一次；buffsOn=true 表示 rootBuffs/agentBonus 已接进 feed，
//     界面才把加成写成生效（没接时写「待接入」，演示数据写「演示」）。它自己监听 window message（网页版只收同源 / file / localhost）。
//   openLedger(meta)          打开「算力履历」面板。meta = { name, realm, title? }，title 不给就按全年总量取默认称号。
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
function rootShares(L, n = ROOT_TUNE.days) {
  const end = lgEnd(L), acc = { mu: 0, huo: 0, tu: 0, jin: 0, shui: 0, hun: 0 }; let total = 0;
  for (let i = 0; i < n; i++) {
    const dd = L && L.days && L.days[lgKey(lgAdd(end, -i))]; if (!dd || !dd.m) continue;
    const ms = lgSum(Object.values(dd.m).map(v => +v > 0 ? +v : 0)); if (!ms) continue; const x = lgX(dd) || ms;
    for (const f in dd.m) { const v = +dd.m[f] || 0; if (v > 0) acc[lgFamElem(f)] += x * v / ms; }
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

// ───────────────────────── 校验清洗 ─────────────────────────
function normLedger(raw) {
  if (!raw || raw.type !== 'ledger' || +raw.v !== 1 || typeof raw.days !== 'object' || !raw.days) return null;
  const num = x => (typeof x === 'number' && isFinite(x) && x > 0) ? x : 0, str = (x, n = 40) => String(x == null ? '' : x).slice(0, n);
  const nmap = o => { const r = {}; if (o && typeof o === 'object') for (const k in o) { const v = num(o[k]); if (v) r[str(k, 40)] = v; } return r; };
  const isDay = k => /^\d{4}-\d{2}-\d{2}$/.test(k), days = {}, hours = {}, tools = {}, sources = {};
  Object.keys(raw.days).filter(isDay).sort().slice(-400).forEach(k => { const d = raw.days[k] || {}, s = nmap(d.s), m = nmap(d.m); days[k] = { t: num(d.t) || lgSum(Object.values(s)) || lgSum(Object.values(m)), x: num(d.x), s, m }; });
  Object.keys(raw.hours || {}).filter(isDay).sort().slice(-14).forEach(k => { const a = raw.hours[k]; if (Array.isArray(a)) hours[k] = Array.from({ length: 24 }, (_, h) => num(a[h])); });
  Object.keys(raw.tools || {}).filter(isDay).sort().slice(-400).forEach(k => { const o = raw.tools[k] || {}; tools[k] = {}; LG_TOOLS.forEach(([id]) => { tools[k][id] = Math.round(num(o[id])); }); });
  for (const k in raw.sources || {}) { const s = raw.sources[k] || {}; sources[str(k)] = { label: str(s.label || k), kind: str(s.kind), account: str(s.account) }; }
  const windows = (Array.isArray(raw.windows) ? raw.windows : []).slice(0, 12).filter(w => w && w.key && (w.kind === '5h' || w.kind === 'week')).map(w => ({
    key: str(w.key), label: str(w.label || w.key), kind: w.kind, used: num(w.used), usedEq: num(w.usedEq) || null,
    pct: typeof w.pct === 'number' && isFinite(w.pct) ? Math.max(0, Math.min(1.5, w.pct)) : null,
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
  LGS.opts = opts;
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
  LGS.data = L; LGS.live = true;
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
  const src = Object.entries(d.s || {}).sort((a, b) => b[1] - a[1]).map(([n, v], i) => ({ n: (L.sources && L.sources[n] && L.sources[n].label) || n, v, c: 'lg-s' + Math.min(i, 4) }));
  const mod = LG_FAMS.filter(f => d.m && d.m[f]).map(f => ({ n: LG_FAM_NAME[f], v: d.m[f], st: `background:var(--e-${lgFamElem(f)});opacity:${f === 'claude-sonnet' ? 0.7 : f === 'claude-haiku' ? 0.45 : 1}` }));
  return head + two + `<div class="lg-dgrid">${src.length ? `<div><h5>来源 · 按当量</h5>${lgBar(src, 'src')}</div>` : ''}${mod.length ? `<div><h5>模型 · 灵根 · 按当量</h5>${lgBar(mod, 'mod')}</div>` : ''}
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
  return `<div class="set lg-limhead"><span>周天额度上限<small>插件读不到上限的窗口，填上就能显示百分比。和「已用」同口径（全量吞吐），可写 5亿、5000万、50M 或纯数字，清空即取消</small></span></div>` +
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
  const show = LGS.live || !LGS.opts.vsc, L = show ? ledgerData() : null, b = L ? agentBonus(L) : { show: false };
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
  if (meta.realm) { ctx.fillStyle = K.mu; ctx.font = `26px ${LG_KAI}`; ctx.textAlign = 'center'; ctx.fillText(meta.realm, W - P - 46, 372); ctx.textAlign = 'left'; }
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
// 蛊码 GuCode · 界面与流程（渲染层；逻辑都在 core/battle）







const KEY = 'gucode.v1', WILL_MAX = 5, WILL_SEC = 120, WILL_TOK = 60;
const $ = (s, r = document) => r.querySelector(s);
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fresh = () => ({ v: 2, started: false, name: '', team: [], realm: 0, nodes: 0, compass: [], sel: null, prog: 0, wh: 0, bank: 0, repair: 0, will: 3, willT: 0, willK: 0, total: 0, muts: 0, wins: 0, losses: 0, seed: (Math.random() * 1e9) | 0, step: 0, sound: false, speed: 1, theme: 'auto', mute: false, stone: 5, stoneK: 0, shop: [], pending: null, marks: [], ghosts: null, floor: 1, endless: 0, codex: { sp: [], combo: [] }, healT: 0, calm: false, stats: false, log: [], todayKey: '', todayTok: 0, streak: 0, bestStreak: 0, day: '', dayWin: false });
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
    return `<li class="pr ${state}"><span class="pn">${rn}</span><span class="pb"><b>空窍 ${slotCap(r)} 格${newSp ? ' · 蛊市新蛊：' + newSp : ''}</b><small>${REALM_NOTES[r]} · ${boss}</small>${r === S.realm && r < 5 ? `<em>下一劫阵容 · 点开看详情</em>${miniRow(tribTeam(r), 'foe', 'trib')}` : ''}</span></li>`;
  }).join('');
  sheet(`<h3>修行路</h3><p class="sm">凡人到五转，每渡一劫：全体 +1/+1、择一道痕，空窍与蛊市随境界扩开。</p><ol class="path">${rows}<li class="pr ${S.realm >= 5 ? 'now' : ''}"><span class="pn">无尽</span><span class="pb"><b>无尽劫 · 层数无限</b><small>每层敌阵更强（+${ENDLESS.atkPerFloor} 攻 +${ENDLESS.hpPerFloor} 血/层），最高层写进分享卡。当前最高 ${S.endless} 层</small>${S.realm >= 5 ? `<em>第 ${S.floor} 层阵容 · 点开看详情</em>${miniRow(endlessTeam(S.floor), 'foe', 'endl')}` : ''}</span></li></ol>`);
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
let sessTok = 0, bySrc = null;
// bySource 兼容 { claude: 2900 } / { claude: { rate } } / [{ name, rate }] 几种写法
function srcList(bs) {
  if (!bs) return [];
  const arr = Array.isArray(bs) ? bs : Object.entries(bs).map(([k, v]) => typeof v === 'number' ? { name: k, rate: v } : { name: k, ...v });
  return arr.map(x => ({ name: String(x.label || x.name || x.src || x.id || ''), rate: +x.rate || 0 })).filter(x => x.name);
}
function countTok(d) { if (!(d > 0)) return; sessTok += d; if (S.todayKey !== today()) { S.todayKey = today(); S.todayTok = 0; } S.todayTok += d; }
function onTick(t) {
  rate = t.rate; hot = t.hot; bySrc = t.bySource || null;
  if (!booted) return;
  if (t.delta > 0 && S.started) { countTok(t.delta); onTokens(t.delta, t.rate, bySrc); }
  if (t.delta > 0 && S.started && !inBattle) feed(t.delta, t.hotDelta != null ? t.hotDelta : (t.hot ? t.delta : 0));
  else if (t.delta > 0 && S.started) S.bank = Math.min(bankCap(), S.bank + t.delta), S.total += t.delta;
  phase = t.idle ? 'yin' : 'yang';   // 只影响灵脉/呼吸动画，不影响能否斗蛊
  if (S.started) regenWill(t.delta || 0);
  meters();
}
let lastTick = performance.now();
function regenWill(tok) {   // 意志 = 体力：随时间和 token 回复，与是否空闲无关
  const now = performance.now(), dt = Math.min(5000, now - lastTick); lastTick = now;
  if (S.team.some(g => g.wound > 0)) { S.healT = (S.healT || 0) + dt; if (S.healT >= WOUND.healSec * 1000) healOne(); }
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
  if (S.team.some(g => g.wound > 0)) { S.repair += d; while (S.repair >= WOUND.healTok && healOne()) S.repair -= WOUND.healTok; }
  else S.repair = 0;
  let guard = 0;
  while (rest > 0.01 && guard++ < 20) {
    if (S.sel == null) { S.bank = Math.min(bankCap(), S.bank + rest); break; }
    const cost = S.compass[S.sel].cost * src.unit, take = Math.min(cost - S.prog, rest), fr = take / rest;
    S.prog += take; S.wh += hr * fr; hr -= hr * fr; rest -= take;
    if (S.prog >= cost - 0.5) resolveNode();
  }
  save();
}
// 愈合一层：伤得最重的先好；有飘字、拨弦和卡片跳动
function healOne() {
  const g = S.team.filter(x => x.wound > 0).sort((a, b) => b.wound - a.wound)[0]; if (!g) return false;
  g.wound--; S.healT = 0; renderSlots(); renderHint();
  setTimeout(() => { fxFloat(g.uid, g.wound ? '伤愈一层' : '痊愈', 'heal'); const e = $(`.gu[data-uid="${g.uid}"]`); if (e) { e.classList.remove('pulse'); void e.offsetWidth; e.classList.add('pulse'); } snd('pluck'); }, 30);
  if (!S.team.some(x => x.wound > 0)) { S.repair = 0; S.healT = 0; }
  save(); return true;
}
const healPct = () => Math.min(1, Math.max(S.repair / WOUND.healTok, (S.healT || 0) / (WOUND.healSec * 1000)));
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
  onNode(node); if (node.type === 'summon' && S.team.length) onGain(S.team[S.team.length - 1], 'summon');
  const tg = node.type === 'summon' ? S.team[S.team.length - 1] : S.team[0]; if (tg) tg.fed += cost;
  S.muts += res.muts; S.nodes++; S.will = Math.min(WILL_MAX, S.will + 1); S.stone += ECON.node;
  S.compass = rollCompass(R(), S.team, false, curCap());
  S.shop = rollShop(R(), S.realm, S.shop); onRefresh(S.shop, 'node');
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
  if (S.started) { renderSlots(); renderShop(); renderPhase(); renderHint(); meters(); ledgerShades($('#qiao')); }
}
function startHTML() {
  const r = makeRng(S.seed + ':start'), pool = poolFor(0).slice(), picks = [];
  while (picks.length < 3) { const s = pool.splice(r.int(pool.length), 1)[0]; picks.push(s); }
  return `<div class="start"><div class="hero"><h1 class="title">蛊码</h1><p class="tag">烧 Token，养蛊，斗道。</p>
  <p class="lead">万物皆可为蛊，蛊即是道。你写代码烧掉的每一个 token，都在喂这一窝蛊；停手的时候，它们替你去斗。</p></div>
  <h2 class="step">三选一，结本命蛊</h2><div class="starters">${picks.map(id => { const s = SP[id]; return `<button class="starter" data-act="pick" data-sp="${id}"><div class="sart">${guSVG(id)}</div><b>${s.n}</b><span class="sst"><i class="a">${s.atk}</i><i class="h">${s.hp}</i></span><span class="strig">${spTraits(id).map(([t, v]) => TRAITS[t].d(v)).join('；')}</span><em>${s.lore}</em></button>`; }).join('')}</div>
  <p class="fine">${VSC ? '插件模式：读取本机 Claude Code / Codex 会话的 token 用量数字（不读内容）。' : '演示模式会模拟写代码的 token 流。存档只在本机。'}</p></div>`;
}
function mainHTML() {
  return `<header class="top"><div class="brand"><b class="logo">蛊码</b><span class="sub">烧 Token · 养蛊 · 斗道</span></div>
  <div class="tools"><button class="realm" id="realm" data-act="path" title="修行路">${REALMS[S.realm]}</button><button class="ib gear" data-act="settings" title="设置" aria-label="设置"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm7.4 4.6.1-1.2-.1-1.2 2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.6 3h-4l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6-.1 1.2.1 1.2-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4z"/></svg></button><button class="ib" data-act="ledger" title="算力履历">履历</button><button class="ib zhu" data-act="share">战帖</button></div></header>
  <section class="vein"><canvas id="vein"></canvas><div class="vread"><div class="vrate"><b id="rateTxt">0</b><span class="vu" id="rateU"></span><span class="vlab">灵流</span><span id="fireTag" class="fire"></span></div><div class="vtot"><span id="totTxt"></span><button class="chip" data-act="src" id="srcTag"></button></div></div><div class="vsrc" id="srcRates" hidden></div></section>
  <div class="seg" id="demo">${[['coding', '写代码中'], ['wuhuo', '武火并发'], ['rest', '停手休息']].map(([m, t]) => `<button data-act="demo" data-m="${m}">${t}</button>`).join('')}</div>
  <section class="qiao" id="qiao"><div class="qhead"><span class="lbl">空窍 <small>左为炉口 · 拖动换位</small></span><span id="qmeta"></span></div><div class="slots" id="slots"></div><p class="marks" id="marks" data-act="marksInfo"></p><p class="hint" id="hint"></p></section>
  <section class="shop" id="shop"></section><section id="phase" class="phase"></section>
  <footer class="foot"><button data-act="duelInput">粘贴坐标码应战</button><button data-act="path">修行路</button><button data-act="codex">蛊典</button><button data-act="reset" id="bReset">重开一局</button></footer>`;
}
function guCard(g, i, rc = '') {
  const sk = skillOf(g);
  return `<button class="gu${g.wound ? ' hurt' : ''}${i === 0 ? ' lead' : ''}" data-act="gu" data-i="${i}" data-uid="${g.uid}" data-drag="${i}">${rc ? `<span class="rcv">${rc}</span>` : ''}
  <span class="art">${guSVG(g.sp)}</span>${(g.star || 1) > 1 ? `<span class="star">★${g.star}</span>` : ''}${sk ? `<span class="mseal${sk.named ? '' : ' pale'}">${esc(sk.n[0])}</span>` : ''}${g.q.length ? `<span class="qk">${g.q.map(q => QUIRKS[q].n[0]).join('')}</span>` : ''}
  <span class="nm">${SP[g.sp].n}</span><span class="st"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i></span>
  <span class="tr">${trChars(g.tr)}${g.att.map(a => `<i class="att">${SP[a].ab}</i>`).join('')}</span>${g.wound ? `<span class="wd">伤${g.wound}</span>` : ''}</button>`;
}
function renderSlots() {
  const box = $('#slots'); if (!box) return;
  const cap = curCap(), rc = rcvChars(S.team); let h = '';
  for (let i = 0; i < SLOTS; i++) {
    if (S.team[i]) h += `<div class="slot">${guCard(S.team[i], i, rc[i])}</div>`;
    else if (i < cap) h += '<div class="slot"><span class="empty">空</span></div>';
    else { const r = SLOT_BY_REALM.findIndex(c => c > i); h += `<div class="slot"><span class="empty lock">锁<small>${REALMS[r] || ''}开</small></span></div>`; }
  }
  box.innerHTML = h; box.dataset.sort = 'team'; renderMeta();
  const rl = $('#realm'); if (rl) rl.textContent = REALMS[S.realm];
  const mk = $('#marks'); if (mk) mk.textContent = S.marks.length ? '道痕 · ' + S.marks.map(k => MARKS[k].n).join(' · ') : '';
}
function renderMeta() {
  const m = $('#qmeta'); if (!m) return;
  const wd = S.team.reduce((a, g) => a + (g.wound || 0), 0);
  m.innerHTML = `<b class="stone">◈ ${S.stone}</b> 元石 · 意志 <b class="will">${'◆'.repeat(S.will)}${'◇'.repeat(Math.max(0, WILL_MAX - S.will))}</b>${wd ? ` · <span class="heal" title="写代码约 1 分钟愈合一层">温养<span class="hbar"><i id="healBar" style="width:${(100 * healPct()).toFixed(0)}%"></i></span></span>` : ''}`;
}
function renderShop() {
  const box = $('#shop'); if (!box || !S.started) return;
  if (!S.shop || S.shop.length !== 3) S.shop = rollShop(R(), S.realm, []);
  const cost = buyCost(), rc = refCost(), cap = curCap();
  box.innerHTML = `<div class="ch"><span class="lbl">蛊市 <small>${REALMS[S.realm]}档 · ${poolFor(S.realm).length} 种 · 三只同种合炼升星</small></span><button class="ib mini-b" data-act="refresh"${S.stone >= rc ? '' : ' disabled'}>刷新${rc ? ' ' + rc + '◈' : ''}</button></div>
  <div class="wares">${S.shop.map((w, i) => {
    const sp = SP[w.sp], merge = S.team.filter(g => g.sp === w.sp && (g.star || 1) === 1).length >= 2, ok = !w.sold && S.stone >= cost && canBuy(S.team, w.sp, cap);
    const tag = w.sold ? '已购' : !canBuy(S.team, w.sp, cap) ? '空窍已满' : (merge ? '合炼 ' : '') + cost + '◈';
    return `<div class="ware${w.frozen ? ' frozen' : ''}${w.sold ? ' sold' : ''}${merge && !w.sold ? ' merge' : ''}${ok ? '' : ' cant'}"><button class="wbuy" data-act="ware" data-i="${i}"${w.sold ? ' disabled' : ''}>${w.frozen ? '<span class="fz">冻</span>' : ''}<span class="art">${guSVG(w.sp)}</span><b>${sp.n}</b><span class="st"><i class="a">${sp.atk}</i><i class="h">${sp.hp}</i></span><span class="wt">${spTraits(w.sp).map(([t, v]) => TRAITS[t].n + (v > 1 ? v : '')).join(' · ')}</span><span class="price">${tag}</span></button></div>`;
  }).join('')}</div>`;
}
const FOE = {};   // 面板里出现过的阵容，按 key 存着供「点开详情」用
function rcvChars(t) { const out = t.map(() => ''); posLinks(t).forEach(l => { if (l.to >= 0 && l.to !== l.from && !out[l.to].includes(TRAITS[l.id].ch)) out[l.to] += TRAITS[l.id].ch; }); return out; }
function miniRow(t, cls = '', key = '', drag = false) {
  if (key) FOE[key] = t;
  const rc = rcvChars(t), tag = key ? 'button' : 'div';
  return `<div class="mini ${cls}"${drag ? ` data-sort="${key}"` : ''}>${t.map((g, i) => { const sk = skillOf(g); return `<${tag} class="mg${g.boss ? ' boss' : ''}"${key ? ` data-act="peek" data-k="${key}" data-i="${i}"` : ''}${drag ? ` data-drag="${i}"` : ''}>${rc[i] ? `<span class="rcv">${rc[i]}</span>` : ''}<span class="art">${guSVG(g.sp)}</span><b>${g.boss ? '劫·' : ''}${SP[g.sp].n}${(g.star || 1) > 1 ? '★' + g.star : ''}</b><span class="st"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i></span>${sk && sk.named ? `<em class="cs">${esc(sk.n)}</em>` : `<span class="tr">${trChars(g.tr)}</span>`}</${tag}>`; }).join('')}</div>`;
}
function choiceHTML(p) {
  const L = S.team[0], t = p.node.type;
  const head = { mutate: `突变 · ${L ? SP[L.sp].n : ''} 择一词条`, summon: '招蛊 · 三选一', devour: `吞噬 · ${L ? SP[L.sp].n : ''} 吞下哪一只` }[t];
  const items = p.opts.map((o, i) => {
    if (t === 'mutate') { const e = L && L.tr.find(x => x[0] === o), v = e ? e[1] + 1 : 1; return `<button class="node opt" data-act="choose" data-i="${i}"><span class="nseal">${TRAITS[o].ch}</span><span class="nbody"><b>${TRAITS[o].n}${e ? ` · 升至 ${v} 层` : ''}</b><small>${TRAITS[o].trig} · ${TRAITS[o].d(v)}</small></span></button>`; }
    if (t === 'summon') { const sp = SP[o]; return `<button class="node opt" data-act="choose" data-i="${i}"><span class="oart">${guSVG(o)}</span><span class="nbody"><b>${sp.n} <i class="a">${sp.atk}</i> <i class="h">${sp.hp}</i></b><small>${spTraits(o).map(([t, v]) => TRAITS[t].d(v)).join('；')} · ${sp.lore}</small></span></button>`; }
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
  if (S.team.some(g => g.wound)) t = '受了伤：写代码约 1 分钟愈合一层，不写也会慢慢好。养蛊照常进行。';
  else if (S.pending) t = '罗盘停在一道选择题上。选好了，下一条路才会开。';
  else if (S.sel == null) t = S.nodes === 0 ? '选一条路。Token 流过，蛊沿路生长。' : '罗盘转好了，挑下一条路。顺序即流派。';
  else if (S.nodes >= 1 && S.will > 0) t = `${NODES[S.compass[S.sel].type].n}中。想打随时可以斗蛊，耗一点意志。`;
  else t = `${NODES[S.compass[S.sel].type].n}中：你写代码，它在长。`;
  h.textContent = t;
}
function meters() {
  if (!S.started) return;
  const rt = $('#rateTxt'); if (!rt) return;
  rt.textContent = rate > 0 ? fmtTok(rate) : '0'; $('#rateU').textContent = '/s';
  const ft = $('#fireTag'); ft.textContent = rate <= 0 ? '静息' : hot ? '武火' : '文火'; ft.classList.toggle('hot', hot && rate > 0); ft.classList.toggle('idle', rate <= 0);
  $('#totTxt').innerHTML = `今日 <b>${fmtTok(S.todayKey === today() ? S.todayTok : 0)}</b> · 本次 <b>${fmtTok(sessTok)}</b> token`;
  const sr = $('#srcRates'), sl = srcList(bySrc); sr.hidden = sl.length < 2;
  if (sl.length >= 2) sr.innerHTML = sl.map(x => `<span class="schip${x.rate > 0 ? '' : ' off'}">${esc(x.name)} <b>${fmtTok(x.rate)}/s</b></span>`).join('');
  const st = $('#srcTag'); st.textContent = src.mode === 'vscode' ? 'Claude 实时' : '演示';
  const dm = $('#demo'); dm.hidden = src.mode !== 'demo'; dm.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === src.demo));
  const bk = $('#bank'); if (bk) bk.textContent = S.bank > 0 ? `灵气存 ${fmtTok(S.bank)}` : '';
  if (S.sel != null) { const n = S.compass[S.sel], bar = document.querySelector(`.node[data-i="${S.sel}"] .nbar i`); if (n && bar) bar.style.width = Math.min(100, 100 * S.prog / (n.cost * src.unit)).toFixed(1) + '%'; }
  const hb = $('#healBar'); if (hb) hb.style.width = (100 * healPct()).toFixed(0) + '%';
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

// ---------- 斗蛊 ----------
// 对手：渡劫/无尽劫按规则生成，幽灵/战帖用传入阵容
function foeOf(kind, foe) {
  if (kind === 'trib') { const n = `${REALMS[S.realm + 1]}·${TRIB_NAMES[Math.min(S.realm, 4)]}`; return { team: tribTeam(S.realm), name: n, title: n.replace('·', ' · '), realm: S.realm + 1, marks: [] }; }
  if (kind === 'endless') return { team: endlessTeam(S.floor), name: `无尽劫·第${S.floor}层`, title: `无尽劫 · 第 ${S.floor} 层`, realm: 5, marks: [] };
  if (kind === 'ghost') return { team: foe.team, name: '幽灵·' + foe.name, title: `幽灵 · ${foe.name}（${foe.label || ''}）`, realm: S.realm, marks: [] };
  const n = foe.name || '无名蛊师'; return { team: foe.team, name: n, title: '战帖 · ' + n, realm: foe.realm || 0, marks: foe.marks || [] };
}
const myTeamFor = kind => (kind === 'duel' && (!S.started || !S.team.length)) ? starterTeam() : S.team;
const myMarksFor = kind => kind === 'duel' && !S.started ? [] : S.marks;
// ---------- 布阵：开战前看清敌阵、拖动调整站位、实时胜算 ----------
let PREP = null, oddsJob = 0;
function prep(kind, foe) {
  if (inBattle || (kind === 'trib' && S.realm >= 5) || (kind !== 'duel' && S.will <= 0)) return;
  const f = foeOf(kind, foe); PREP = { kind, foe, f, mine: myTeamFor(kind), last: null };
  renderPrep(true);
}
function renderPrep(open) {
  if (!PREP) return; const { f, kind } = PREP, mine = PREP.mine, canSort = mine === S.team && S.team.length > 1;
  const sum = t => `<span class="fsum">总 <i class="a">${t.reduce((a, g) => a + effA(g), 0)}</i><i class="h">${t.reduce((a, g) => a + effH(g), 0)}</i></span>`;
  const html = `<p class="eyebrow">布阵</p><h3>${esc(f.title)}</h3>
  <div class="fhead"><span class="lbl">敌阵 <small>点开看词条</small></span>${sum(f.team)}</div>${miniRow(f.team, 'foe', 'foe')}
  <div class="odds"><span class="olab">胜算约</span><b id="oddsN">…</b><span class="obar"><i id="oddsBar"></i></span><small id="oddsD">用同一套斗蛊规则推演 200 场</small></div>
  <div class="fhead"><span class="lbl">我阵 <small>${canSort ? '拖动换位 · 左为炉口，先上场' : '左为炉口，先上场'}</small></span>${sum(mine)}</div>${miniRow(mine, 'me', 'mine', canSort)}
  <p class="sm">${kind === 'duel' ? '' : '开战耗 1 点意志。'}站位决定谁先挨打：遗泽给身后、擂鼓给最前、先登要站最前、暗针要躲在后排、护卫和连心看左右邻。蓝角标是它从邻位拿到的加成。</p>
  <div class="row2"><button data-act="shut">再想想</button><button class="zhu big" data-act="fight">开战</button></div>`;
  const cur = $('.sheet.prep');
  if (open || !cur) sheet(html, 'prep'); else cur.innerHTML = '<button class="x" data-act="closeSheet">×</button>' + html;
  calcOdds(mine, f.team, myMarksFor(kind), f.marks);
}
function calcOdds(mine, enemy, ma, mb) {
  const job = ++oddsJob, A = decodeTeam(encodeTeam(mine, { marks: ma })), B = decodeTeam(encodeTeam(enemy, { marks: mb })), N = 200; let n = 0, w = 0;
  if (!A || !B) return;
  const step = () => {
    if (job !== oddsJob) return; const t0 = performance.now();
    while (n < N && performance.now() - t0 < 10) { const r = battle(A.team, B.team, 'odds:' + n, A.marks, B.marks); w += r.winner === 'A' ? 1 : r.winner === 'draw' ? 0.5 : 0; n++; }
    const pct = Math.round(100 * w / n), nb = $('#oddsN'), bar = $('#oddsBar'), d = $('#oddsD'); if (!nb) return;
    nb.textContent = pct + '%'; bar.style.width = pct + '%';
    if (n < N) { setTimeout(step, 0); return; }
    if (PREP) { if (PREP.last != null && PREP.last !== pct) d.innerHTML = `刚才换位：${PREP.last}% → <b>${pct}%</b>（${pct > PREP.last ? '+' : ''}${pct - PREP.last}）`; PREP.last = pct; }
  };
  step();
}
function startBattle(kind, foe) {
  if (inBattle) return;
  if (kind === 'trib' && S.realm >= 5) return;
  const F = foeOf(kind, foe), enemy = F.team, title = F.title, ename = F.name, erealm = F.realm;
  if (kind !== 'duel' && S.will <= 0) return;
  const mine = myTeamFor(kind);
  const ca = encodeTeam(mine, { name: S.name || '无名蛊师', realm: S.realm, marks: myMarksFor(kind) }), cb = encodeTeam(enemy, { name: ename, realm: erealm, marks: F.marks });
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
  S.team.forEach(g => { g.wound = Math.min(WOUND.max, (g.wound || 0) + 1); });
}
function showResult(B) {
  const w = B.res.winner, win = w === 'A', draw = w === 'draw';
  onBattleEnd(B);
  let txt = '', loot = [], btns = '';
  if (B.kind === 'replay') {}
  else if (B.kind === 'endless') {
    if (win) { S.wins++; S.endless = Math.max(S.endless, S.floor); S.floor++; txt = `破无尽劫第 ${S.floor - 1} 层。最高 ${S.endless} 层。`; }
    else if (draw) txt = '劫云僵持，未破此层。';
    else { S.losses++; wound(); txt = `止步第 ${S.floor} 层。全体轻伤 1 层，写代码约 1 分钟愈合一层。`; }
  }
  else if (B.kind === 'trib') {
    if (win) {
      S.realm++; S.wins++; S.team.forEach(g => { g.atk++; g.hp++; }); S.ghosts = null; S.shop = rollShop(R(), S.realm, S.shop); onRealm(S.realm); onRefresh(S.shop, 'realm');
      txt = `渡劫成功，晋${REALMS[S.realm]}。全体蜕变 +1/+1${slotCap(S.realm) > slotCap(S.realm - 1) ? '，空窍多开一格' : ''}。择一道痕，伴你整局：`;
      loot = rollMarks(R(), S.marks).map(k => ({ k: 'mark', id: k, t: `道痕【${MARKS[k].n}】${MARKS[k].d}` }));
    }
    else if (draw) txt = '劫云散去，未分胜负。';
    else { S.losses++; wound(); txt = '渡劫未成：全体轻伤 1 层，写代码约 1 分钟愈合一层。'; }
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
    else { S.losses++; wound(); txt = '败。全体轻伤 1 层，写代码约 1 分钟愈合一层。'; }
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
  let consol = '';
  if (!win && !draw && S.started && ['trib', 'ghost', 'endless'].includes(B.kind)) {
    const left = B.res.log[B.res.log.length - 1].s[1].reduce((a, x) => a + x[2], 0), got = [];
    if (S.sel != null && S.compass[S.sel]) { const c = S.compass[S.sel].cost * src.unit, add = Math.min(c * WOUND.loseNodePct, c - S.prog - 1); if (add > 0) { S.prog += add; got.push(`${NODES[S.compass[S.sel].type].n}进度 +${Math.round(100 * add / c)}%`); } }
    else { const add = WOUND.loseNodePct * 50 * src.unit; S.bank = Math.min(bankCap(), S.bank + add); got.push(`灵气 +${fmtTok(add)}`); }
    consol = `<div class="consol"><b>败亦有获</b>${got.map(t => `<span>${t}</span>`).join('')}${left > 0 ? `<em>敌阵只剩 ${fmtNum(left)} 血，差一点</em>` : ''}</div>`;
  }
  const panel = el(`<div class="result"><div class="rseal${win ? '' : ' lose'}">${win ? '胜' : draw ? '和' : '败'}</div>${B.comeback ? '<span class="goldtag">绝境翻盘</span>' : ''}<p class="rtxt">${txt}</p>${consol}
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
function sheet(html, cls = '', stack = false) {
  if (!stack) document.querySelectorAll('.sheet-bg').forEach(x => x.remove());
  const s = el(`<div class="sheet-bg${stack ? ' stack' : ''}" data-act="closeSheet"><div class="sheet ${cls}" data-stop="1"><button class="x" data-act="closeSheet">×</button>${html}</div></div>`);
  document.body.appendChild(s); return s;
}
function closeSheet() { const a = document.querySelectorAll('.sheet-bg'); if (a.length) a[a.length - 1].remove(); }
// 统一详情面板：自己的蛊、蛊市货架、敌蛊都用它。ctx.kind = mine | shop | foe | view
function guDetail(g, ctx = {}) {
  const s = SP[g.sp], sk = skillOf(g), team = ctx.team, i = ctx.i | 0, kind = ctx.kind || 'view';
  const recv = team ? posLinks(team).filter(l => l.to === i && l.from !== i) : [];
  const w = kind === 'shop' ? S.shop[i] : null, cost = buyCost(), cap = curCap();
  const merge = w && S.team.filter(x => x.sp === w.sp && (x.star || 1) === 1).length >= 2;
  sheet(`<div class="detail"><div class="dart">${guSVG(g.sp)}</div><div><h3>${g.boss ? '劫·' : ''}${s.n}${(g.star || 1) > 1 ? ` <small>★${g.star}</small>` : ''}</h3><p class="lore">${kind === 'foe' ? '<span class="foetag">敌</span>' : ''}${s.lore}${g.clone ? ' · 分身' : ''}</p><p class="dst"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i>${g.wound ? ` <span class="wd">伤 ${g.wound} 层</span>` : ''}</p>${team && kind !== 'shop' ? `<p class="sm">站位：${kind === 'foe' ? '敌阵' : '我阵'}第 ${i + 1} 位${i === 0 ? '（最前）' : ''}</p>` : ''}</div></div>
  <h4>词条</h4><ul>${g.tr.map(([id, v]) => { const pn = team && kind !== 'shop' ? posNote(team, i, id) : ''; return `<li><b>${TRAITS[id].n}${v > 1 ? ` ${v}层` : ''}</b>${TRAITS[id].d(v)}${pn ? `<em class="pn">→ ${esc(pn)}</em>` : ''}</li>`; }).join('')}</ul>
  ${recv.length ? `<h4>站位加成</h4><ul>${recv.map(l => `<li><b>${TRAITS[l.id].n}</b>来自 ${SP[team[l.from].sp].n}：${esc(l.txt)}</li>`).join('')}</ul>` : ''}
  ${g.q.length ? `<h4>怪癖</h4><ul>${g.q.map(q => `<li><b>${QUIRKS[q].n}</b>${QUIRKS[q].d}</li>`).join('')}</ul>` : ''}
  ${sk ? `<h4>杀招</h4><div class="skill"><span class="seal${sk.named ? '' : ' pale'}">${esc(sk.n)}</span><p>${esc(sk.d)}<br><small>附蛊：${g.att.map(a => SP[a].n).join('、')}</small></p></div>` : ''}
  ${kind === 'mine' ? `<h4>算力履历</h4><p class="hist">累计喂养 <b>${fmtTok(g.fed)}</b> token · 突变 <b>${g.mut || 0}</b> 次</p>
  <div class="row2"><button data-act="mv" data-i="${i}" data-d="-1"${i === 0 ? ' disabled' : ''}>← 左移</button><button data-act="mv" data-i="${i}" data-d="1"${i >= S.team.length - 1 ? ' disabled' : ''}>右移 →</button></div>
  <div class="row2"><button data-act="sell" data-i="${i}"${S.team.length > 1 ? '' : ' disabled'}>出售 +${sellValue(g)}◈</button></div>
  <p class="sm">左为炉口：多数罗盘节点作用在最左那只；炼附取最右那只。在空窍里直接拖动也能换位。${(g.star || 1) > 1 ? ` ★${g.star}：词条位 ${trCap(g)} 个。` : ''}</p>` : ''}
  ${w ? `<div class="row2"><button data-act="freeze" data-i="${i}">${w.frozen ? '解冻' : '冻结（刷新时保留）'}</button><button class="zhu" data-act="buy" data-i="${i}"${!w.sold && S.stone >= cost && canBuy(S.team, w.sp, cap) ? '' : ' disabled'}>${!canBuy(S.team, w.sp, cap) ? '空窍已满' : (merge ? '买下并合炼 ' : '买下 ') + cost + '◈'}</button></div><p class="sm">${merge ? '你已有两只同种 ★1，买下立即三合一升星。' : '同种三只自动合炼升星。'}余 ${S.stone}◈</p>` : ''}
  <details class="book"><summary>杀招配方（${COMBOS.length}）</summary><ul>${COMBOS.map(c => `<li><b>${c.n}</b>${c.need.map(x => SP[x].n).join(' + ')}</li>`).join('')}</ul></details>`, '', ctx.stack);
}
function openGu(i) { const g = S.team[i]; if (g) guDetail(g, { kind: 'mine', i, team: S.team }); }
function shareText(code) { return `我在《蛊码》养了一窝蛊（${REALMS[S.realm]}），敢接战帖吗？\n界壁坐标码：${code}`; }
const SHARE_BASE = 'https://1596941391qq.github.io/gu-code/';
function shareURL(code) { return (/^https?:/.test(location.protocol) ? location.origin + location.pathname : SHARE_BASE) + '#c=' + code; }
function myCode() { return encodeTeam(S.team.length ? S.team : starterTeam(), { name: S.name, realm: S.realm, marks: S.marks }); }
function openGhosts() {
  if (!S.ghosts || S.ghosts.realm !== S.realm) { const r = R(); S.ghosts = { realm: S.realm, list: ghostTrio(r, Math.max(1, S.nodes) + S.realm, S.realm).map(o => ({ tier: o.tier, label: o.label, name: o.name, code: encodeTeam(o.team, { name: '幽灵·' + o.name, realm: S.realm }) })) }; save(); }
  sheet(`<h3>斗幽灵 · 择一对手</h3><p class="sm">阵容摆在明面上，越难元石越多；胜了还能从残躯上夺一样。每场耗 1 点意志（余 ${S.will}）。</p>${S.ghosts.list.map((o, i) => { const d = decodeTeam(o.code); return `<div class="foeopt"><div class="fh"><b class="tier t-${o.tier}">${o.label}</b><span class="fn">${esc(o.name)}</span><span class="rw">胜 +${ECON.win[o.tier]}◈</span></div>${miniRow(d.team, 'foe', 'g' + i)}<button class="zhu" data-act="ghostGo" data-i="${i}"${S.will > 0 ? '' : ' disabled'}>应战</button></div>`; }).join('')}`);
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
  window.__guFoe = foe;
  sheet(`<p class="eyebrow">界壁震动</p><h3 class="duelh">有人向你下战帖</h3><p class="sm">来自 <b>${esc(foe.name || '无名蛊师')}</b> · ${REALMS[foe.realm] || '凡人'}</p>${miniRow(foe.team, 'foe', 'duel')}
  <p class="vsline">— 你的${S.started && S.team.length ? '空窍' : '初始阵容'} —</p>${miniRow(mine, '', 'duelMine')}<div class="row2"><button class="zhu big" data-act="duelFight">布阵应战</button></div>`);
}
function checkHash() {
  const h = location.hash; if (!/[#&](c|r)=/.test(h)) return;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  openLinkText(h);
}

// ---------- 设置 ----------
const applyCalm = () => document.documentElement.toggleAttribute('data-calm', !!S.calm);
const isCalm = () => !!S.calm;   // 表现组件读这个：减弱震屏与闪光
function openSettings() {
  const tog = (act, on, a = '开', b = '关') => `<button class="tog${on ? ' on' : ''}" data-act="${act}" aria-pressed="${on}">${on ? a : b}</button>`;
  ledgerBindLimits(sheet(`<h3>设置</h3>
  <div class="set"><span>主题</span><div class="segs">${[['auto', '自动'], ['light', '日'], ['dark', '夜']].map(([k, t]) => `<button data-act="setTheme" data-v="${k}" class="${(S.theme || 'auto') === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
  <div class="set"><span>声音<small>古琴、钱币与木鱼</small></span>${tog('setMute', !S.mute)}</div>
  <div class="set"><span>减弱震屏与闪光<small>暴击、斩杀、开茧的震动和闪白都调弱</small></span>${tog('setCalm', !!S.calm)}</div>
  ${VSC ? '' : `<div class="set"><span>匿名统计<small>只发游玩事件计数，帮我们调数值；不含代码与对话内容，默认关闭</small></span>${tog('setStats', !!S.stats)}</div>`}
  <div class="set"><span>导出游玩数据<small>最近 ${S.log.length} 条事件（获得、战斗、节点、升阶），只存在本机${VSC ? '，导出到剪贴板' : ''}</small></span><button class="tog" data-act="exportLog">导出</button></div>
  ${ledgerLimitRows()}
  <p class="sm">累计喂养 ${fmtTok(S.total)} token · 胜 ${S.wins} · 负 ${S.losses}</p>`, 'settings'));
}
// ---------- 集成接口：合分支时替换实现（现在只往本地事件日志里记一笔）----------
function logEv(k, o = {}) { (S.log || (S.log = [])).push({ t: Date.now(), k, ...o }); if (S.log.length > 500) S.log.splice(0, S.log.length - 500); }
function onGain(g, from) { logEv('gain', { sp: g.sp, from }); }                       // 获得蛊：starter | summon | shop | loot
function onRefresh(items, why) { logEv('refresh', { why, sp: items.map(w => w.sp) }); } // 蛊市刷新：manual | node | realm
function onBattleEnd(B) { logEv('battle', { kind: B.kind, w: B.res.winner, turns: B.res.turns, tier: B.tier || null }); }
function onTokens(d, rate, bySource) {}                                              // 每次 token 进账（约 5 次/秒）
function onNode(n) { logEv('node', { type: n.type, n: S.nodes + 1 }); }
function onRealm(r) { logEv('realm', { r }); }
function onSession() { logEv('session', { total: Math.round(S.total), realm: S.realm }); }

// ---------- 拖动换位 ----------
let drag = null, dragEndT = 0;
const moveIdx = (arr, f, t) => { const [x] = arr.splice(f, 1); arr.splice(t, 0, x); };
const SORT = {
  team(f, t) { moveIdx(S.team, f, t); renderSlots(); renderPhase(); renderHint(); save(); snd('clack'); },
  mine(f, t) { moveIdx(S.team, f, t); renderSlots(); renderPhase(); save(); snd('clack'); renderPrep(false); },
};
document.addEventListener('pointerdown', e => {
  const it = e.target.closest('[data-drag]'), box = it && it.closest('[data-sort]');
  if (!it || !box || e.button > 0) return;
  drag = { it, box, from: +it.dataset.drag, to: +it.dataset.drag, x0: e.clientX, y0: e.clientY, ghost: null, items: [...box.querySelectorAll('[data-drag]')] };
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
  if (d.to !== d.from && SORT[d.box.dataset.sort]) SORT[d.box.dataset.sort](d.from, d.to);
}
window.addEventListener('pointerup', dragEnd); window.addEventListener('pointercancel', dragEnd);

// ---------- 交互 ----------
const ACT = {
  pick(a) { S.team = [newGu(a.dataset.sp)]; S.started = true; onGain(S.team[0], 'starter'); S.shop = rollShop(R(), 0, []); S.compass = rollCompass(R(), S.team, true, curCap()); save(); renderAll(); },
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
  sound() { S.mute = !S.mute; save(); snd('pluck'); },
  settings() { openSettings(); },
  setTheme(a) { S.theme = a.dataset.v; applyTheme(); save(); openSettings(); },
  setMute() { S.mute = !S.mute; save(); snd('pluck'); openSettings(); },
  setCalm() { S.calm = !S.calm; applyCalm(); save(); openSettings(); },
  setStats() { if (!VSC) { S.stats = !S.stats; save(); openSettings(); } },
  exportLog(a) {
    const data = JSON.stringify({ app: 'gucode', v: 1, at: new Date().toISOString(), realm: S.realm, nodes: S.nodes, wins: S.wins, losses: S.losses, total: Math.round(S.total), log: S.log }, null, 1);
    if (VSC) { copy(data, a); return; }
    const u = URL.createObjectURL(new Blob([data], { type: 'application/json' })), l = document.createElement('a'); l.href = u; l.download = `gucode-log-${today()}.json`; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000);
  },
  share() { openShare(); },
  trib() { prep('trib'); }, ghost() { openGhosts(); }, endless() { prep('endless'); },
  path() { openPath(); }, codex() { openCodex(); },
  ledger() { openLedger({ name: S.name, realm: REALMS[S.realm] }); },
  ghostGo(a) { const o = S.ghosts && S.ghosts.list[+a.dataset.i]; if (!o || S.will <= 0) return; const d = decodeTeam(o.code); prep('ghost', { team: d.team, name: o.name, tier: o.tier, label: o.label }); },
  choose(a) { const p = S.pending; if (!p) return; finishNode(p.node, p.opts[+a.dataset.i], p.wu, p.cost); },
  buy(a) {
    const w = S.shop[+a.dataset.i], cost = buyCost(); if (!w || w.sold || S.stone < cost) return;
    const r = buyGu(S.team, w.sp, curCap(), S.marks, R()); if (!r) return; closeSheet();
    S.stone -= cost; w.sold = true; w.frozen = false; onGain(r.gu, 'shop');
    renderSlots(); renderShop(); renderPhase(); save(); snd('pluck');
    setTimeout(() => { if (r.merged.length) { const g = r.merged[r.merged.length - 1]; fxFloat(g.uid, `合炼 ★${g.star}`, 'mut'); stampIn($('#qiao'), '合炼', false, 'side'); } else fxFloat(r.gu.uid, '入窍', 'new'); }, 60);
  },
  refresh() { const c = refCost(); if (S.stone < c) return; S.stone -= c; S.shop = rollShop(R(), S.realm, S.shop); onRefresh(S.shop, 'manual'); renderMeta(); renderShop(); save(); },
  freeze(a) { const i = +a.dataset.i, w = S.shop[i]; if (w) { w.frozen = !w.frozen; renderShop(); save(); if (a.closest('.sheet')) guDetail(newGu(w.sp), { kind: 'shop', i }); } },
  sell(a) { const i = +a.dataset.i, g = S.team[i]; if (!g || S.team.length <= 1) return; S.stone += sellValue(g); S.team.splice(i, 1); closeSheet(); renderSlots(); renderShop(); renderPhase(); save(); },
  marksInfo() { if (S.marks.length) sheet(`<h3>道痕</h3><p class="sm">整局被动，渡劫成功时三选一。</p><ul>${S.marks.map(k => `<li><b>${MARKS[k].n}</b>${MARKS[k].d}</li>`).join('')}</ul>`); },
  speed() { S.speed = S.speed === 1 ? 2 : 1; $('#bspd').textContent = S.speed + '×'; save(); },
  skip() { skip = true; },
  payskip() { payFast = true; },
  loot(a) {
    const l = window.__guB.loot[+a.dataset.i], L = S.team[0];
    if (l.k === 'mark') { if (!S.marks.includes(l.id)) S.marks.push(l.id); }
    else if (l.k === 'take' && S.team.length < curCap()) { const g = newGu(l.sp); S.team.push(g); onGain(g, 'loot'); }
    else if (l.k === 'print' && L) addTrait(L, l.id, 1);
    else if (L) { L.atk += 2; L.hp += 2; }
    closeBattle();
  },
  closeBattle() { closeBattle(); },
  replyDuel() { closeBattle(); openShare(); },
  closeSheet(a, e) { if (e.target.closest('[data-stop]') && !a.classList.contains('x')) return; closeSheet(); },
  shut() { closeSheet(); },
  ware(a) { const w = S.shop[+a.dataset.i]; if (w && !w.sold) guDetail(newGu(w.sp), { kind: 'shop', i: +a.dataset.i }); },
  peek(a) { const t = FOE[a.dataset.k], i = +a.dataset.i; if (t && t[i]) guDetail(t[i], { kind: a.dataset.k === 'mine' ? 'view' : 'foe', i, team: t, stack: !!a.closest('.sheet') }); },
  fight() { const P = PREP; if (!P) return; oddsJob++; PREP = null; closeSheet(); startBattle(P.kind, P.foe); },
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
  duelFight() { prep('duel', window.__guFoe); },
  reset(a) {
    if (Date.now() - resetArm > 3000) { resetArm = Date.now(); a.textContent = '再点一次确认重开'; setTimeout(() => { a.textContent = '重开一局'; }, 3000); return; }
    codexScan(); const keep = { sound: S.sound, name: S.name, total: S.total, theme: S.theme, codex: S.codex }; S = Object.assign(fresh(), keep); save(); renderAll();
  },
};
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a || a.disabled || performance.now() - dragEndT < 250) return;
  const f = ACT[a.dataset.act]; if (f) f(a, e);
});

// ---------- 算力履历（src/ledger.js）：收数据、周天上限存档；玩法挂钩见 ledger.js 文件头 ----------
ledgerInit({ vsc: VSC, openSettings, getLimits: () => S.qlim || {}, setLimit: (k, v) => { S.qlim = Object.assign({}, S.qlim); if (v > 0) S.qlim[k] = v; else delete S.qlim[k]; save(); }, onData: () => ledgerShades($('#qiao')) });

// ---------- 启动 ----------
function boot(saved, pending) {
  const mg = migrate(saved); if (mg) S = Object.assign(fresh(), mg);
  if (!document.getElementById('gu-defs')) document.body.insertAdjacentHTML('afterbegin', `<svg id="gu-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${ART_DEFS}</defs></svg>`);
  applyTheme(); if (VSC && window.MutationObserver) new MutationObserver(applyTheme).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  booted = true; renderAll(); requestAnimationFrame(veinLoop);
  if (pending && pending.tokens > 0 && S.started) { countTok(pending.tokens); feed(pending.tokens, pending.hot || 0); renderSlots(); renderPhase(); const h = $('#hint'); if (h) h.textContent = `你不在的时候，蛊吸纳了 ${fmtTok(pending.tokens)} token。`; }
  onSession(); checkHash();
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
