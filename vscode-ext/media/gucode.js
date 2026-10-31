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

const MAXV = 3, MAXTR = 4, MAXQ = 2, MAXATT = 2, SLOTS = 7;
const REALMS = ['凡人', '一转', '二转', '三转', '四转', '五转'];
const SLOT_BY_REALM = [3, 4, 5, 6, 7, 7];   // 上阵格（空窍）按境界开放：凡人 3、一转 4、二转 5、三转 6、四转起 7
const slotCap = r => SLOT_BY_REALM[Math.min(5, Math.max(0, r | 0))];
const POOL_TIERS = [['boar', 'fire', 'twin', 'iron', 'thorn', 'bone'], ['mantis', 'queen', 'cicada'], ['drum', 'scorp', 'moth']];
const poolFor = r => POOL_TIERS.slice(0, Math.min(3, (r | 0) + 1)).flat();
// 转数（向原书靠拢：一转到五转，六转仙蛊另加）。基础转数 = 物种所在蛊池档位 + 1（凡人池一转，往上依次二转、三转）；
// 物种带 rank 字段时以它为准。三只同种同转合炼成高一转：同一只最多合炼 fuse 次，且不超过 max。
// 驱使上限：境界 r 的蛊师只能让转数 ≤ r + over 的蛊上阵（凡人驱使一转，一转蛊师驱使二转……），超出的可以收着，不能上阵。
const RANK = { names: ['', '一转', '二转', '三转', '四转', '五转', '六转'], ch: ['', '一', '二', '三', '四', '五', '六'], max: 5, fuse: 2, over: 1 };
const baseRank = sp => (SP[sp] && SP[sp].rank) || (POOL_TIERS.findIndex(t => t.includes(sp)) + 1) || 1;
const rankOf = g => g.rank || baseRank(g.sp);
const fuseLv = g => Math.max(0, rankOf(g) - baseRank(g.sp));     // 合炼过几次（0 = 原生转数）
const canWield = (g, realm) => rankOf(g) <= (realm | 0) + RANK.over;
const rankName = g => RANK.names[rankOf(g)] + SP[g.sp].n;          // 「一转野猪蛊」
const ECON = { node: 2, buy: 3, refresh: 1, tokPer: 25, lose: 1, win: { easy: 3, mid: 5, hard: 8, trib: 10, endless: 6, duel: 0 } };
const trCap = g => MAXTR + fuseLv(g);
// 蛊囊（备战区）：开茧、宝箱、夺蛊得到的蛊先放这里，拖进空窍才上阵；也用来攒同种合炼。
// cap 凡人时的格数，perRealm 每升一阶加几格（五转 18 格）；feedMul 吃灵气的比例（只吃一半）；
// meltMul 满了选「炼化」时按卖价的倍数折元石，rarSell 按品质（凡良珍绝天）再乘；trioOff 货架三只同种一起买的折扣
const BAG = { cap: 8, perRealm: 2, feedMul: 0.5, meltMul: 1.5, rarSell: [1, 1.2, 1.5, 2, 3], trioOff: 0.8 };
const bagCap = realm => BAG.cap + BAG.perRealm * Math.min(5, Math.max(0, realm | 0));

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
  heLian:    { n: '合炼得道', d: '合炼升转时额外觉醒一个词条' },
  shengCai:  { n: '生财有道', d: '斗蛊所得元石 +50%' },
  shiJing:   { n: '市井熟客', d: '蛊市买蛊只要 2 元石，刷新免费' },
};
const MARK_KEYS = Object.keys(MARKS);
function rollMarks(rng, owned = []) { const pool = MARK_KEYS.filter(k => !owned.includes(k)), out = []; while (out.length < 3 && pool.length) out.push(pool.splice(rng.int(pool.length), 1)[0]); return out; }

let UIDN = 1;
function nuid() { return 'g' + (UIDN++).toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
function newGu(sp) { const s = SP[sp]; return { uid: nuid(), sp, rank: baseRank(sp), atk: s.atk, hp: s.hp, tr: spTraits(sp), q: [], att: [], wound: 0, fed: 0, mut: 0 }; }
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
    case 'feed': team.forEach((g, i) => { const h = [3, 2, 1][i] || 1; g.hp += h; if (i === 0) g.atk += 1; fx.push({ uid: g.uid, txt: i === 0 ? `+1/+${h}` : `+${h}血` }); }); break;
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
// 能否再收一只：空窍或蛊囊有空位，或者它能和已有的同种同转凑成合炼（空窍、蛊囊都算）
const sameRank = (list, sp, rk) => list.filter(g => g.sp === sp && rankOf(g) === rk).length;
// mode：'shop' 蛊市买的（合炼 → 空窍空位 → 蛊囊）；'reward' 开茧、宝箱、夺蛊得的（合炼 → 蛊囊，不自动进空窍）
const fusable = (team, bag, g) => fuseLv(g) < RANK.fuse && rankOf(g) < RANK.max && sameRank([...team, ...(bag || [])], g.sp, rankOf(g)) >= 2;
function canTake(team, bag, g, cap, bc = BAG.cap, mode = 'shop') { return (mode === 'shop' && team.length < cap) || (bag || []).length < bc || fusable(team, bag, g); }
function canBuy(team, sp, cap, bag = [], bc = BAG.cap) { return canTake(team, bag, { sp, rank: baseRank(sp) }, cap, bc, 'shop'); }
// 收下一只蛊，按 mode 找去处。返回 { where: 'merge'|'team'|'bag'|null, merged }
function placeGu(team, bag, g, cap, marks, rng, bc = BAG.cap, mode = 'shop') {
  if (fusable(team, bag, g)) { bag.push(g); return { where: 'merge', merged: mergeAll(team, marks, rng, bag) }; }
  if (mode === 'shop' && team.length < cap) { team.push(g); return { where: 'team', merged: [] }; }
  if (bag.length < bc) { bag.push(g); return { where: 'bag', merged: mergeAll(team, marks, rng, bag) }; }
  return { where: null, merged: [] };
}
function mergeAll(team, marks = [], rng, bag = []) {   // 空窍和蛊囊一起算；合炼结果留在第一只的位置（空窍优先）
  const done = [], rm = x => { const l = team.includes(x) ? team : bag; l.splice(l.indexOf(x), 1); };
  for (let guard = 0; guard < 8; guard++) {
    let grp = null; const all = [...team, ...bag];
    for (const g of all) { const rk = rankOf(g), same = all.filter(x => x.sp === g.sp && rankOf(x) === rk); if (same.length >= 3 && fuseLv(g) < RANK.fuse && rk < RANK.max) { grp = same.slice(0, 3); break; } }
    if (!grp) break;
    const [a, b, c] = grp, s0 = fuseLv(a) + 1;
    a.rank = rankOf(a) + 1; a.atk = Math.max(a.atk, b.atk, c.atk) + 2 * s0 + 1; a.hp = Math.max(a.hp, b.hp, c.hp) + 3 * s0 + 1;
    [b, c].forEach(x => {
      x.tr.forEach(([id, v]) => addTrait(a, id, v)); x.q.forEach(q => { if (!a.q.includes(q) && a.q.length < MAXQ) a.q.push(q); });
      x.att.forEach(t => { if (a.att.length < MAXATT) a.att.push(t); }); a.fed = (a.fed || 0) + (x.fed || 0); a.mut = (a.mut || 0) + (x.mut || 0);
      a.wound = Math.min(a.wound || 0, x.wound || 0); rm(x);
    });
    if (marks.includes('heLian') && rng) { mutateGu(a, rng); a.mut++; }
    done.push(a);
  }
  return done;
}
function buyGu(team, sp, cap, marks, rng, bag = []) { if (!canBuy(team, sp, cap, bag)) return null; const g = newGu(sp), r = placeGu(team, bag, g, cap, marks, rng); return { gu: g, where: r.where, merged: r.merged }; }
const sellValue = g => fuseLv(g) + 1 + (g.att ? g.att.length : 0);
const meltValue = g => Math.round(sellValue(g) * BAG.meltMul * BAG.rarSell[Math.min(4, g.rar | 0)]);   // 炼化：按品质给卖价的 1.5 倍起

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
  if (n <= 5) perm(team.slice(0, n), 0);
  else {   // 6–7 只时全排列太多（5040 种），改为逐对交换的爬山：一直换到没有更好的排法为止
    let cur = team.slice(0, n), cs = formScore(cur), up = true;
    while (up) { up = false; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { [cur[i], cur[j]] = [cur[j], cur[i]]; const sc = formScore(cur); if (sc > cs + 1e-9) { cs = sc; up = true; } else [cur[i], cur[j]] = [cur[j], cur[i]]; } }
    if (cs > bs) { bs = cs; best = cur; }
  }
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
  const team = genTeam(rng, TRIB.power[r], Math.min(SLOTS, slotCap(r) + 1));
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
// 坐标码各版本的位宽：v1 无道痕与转数；v2 物种/词条 4 位、攻血 8 位；v3 物种/词条 6 位（装得下 64 种物种）、攻血 10 位、最多 7 格、直接存转数；
// v4 = v3 + 1 位「试玩」标志（网页模拟灵流的存档）
const CODE_W = { 1: { sp: 4, tr: 4, q: 3, st: 8, mk: 0, rk: 0 }, 2: { sp: 4, tr: 4, q: 3, st: 8, mk: 12, rk: 2 }, 3: { sp: 6, tr: 6, q: 4, st: 10, mk: 16, rk: 3 }, 4: { sp: 6, tr: 6, q: 4, st: 10, mk: 16, rk: 3, fl: 1 } };
function encodeTeam(team, meta = {}) {
  const bits = [];
  const put = (v, n) => { v = Math.max(0, Math.min(Math.floor(v) || 0, 2 ** n - 1)); for (let i = n - 1; i >= 0; i--) bits.push(Math.floor(v / 2 ** i) % 2); };
  let nm = utf8(String(meta.name || '').slice(0, 8)); if (nm.length > 24) nm = nm.slice(0, 24);
  const W = CODE_W[4]; put(4, 3); put(meta.realm || 0, 3); put(Math.min(SLOTS, team.length), 3); put(nm.length, 5); nm.forEach(b => put(b, 8));
  let mb = 0; (meta.marks || []).forEach(k => { const i = MARK_KEYS.indexOf(k); if (i >= 0) mb += 2 ** i; }); put(mb, W.mk); put(meta.trial ? 1 : 0, W.fl);
  for (const g of team.slice(0, SLOTS)) {
    put(SPI[g.sp], W.sp); put(g.atk, W.st); put(g.hp, W.st); put(g.wound || 0, 2);
    put(g.tr.length, 3); g.tr.forEach(([id, v]) => { put(TRI[id], W.tr); put(v, 2); });
    put(g.q.length, 2); g.q.forEach(q => put(QUI[q], W.q));
    put(g.att.length, 2); g.att.forEach(a => put(SPI[a], W.sp));
    put(Math.round((g.fed || 0) / 10000), 18); put(g.mut || 0, 7); put(g.boss ? 1 : 0, 1); put(rankOf(g), 3);
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
    const ver = get(3); if (!CODE_W[ver]) return null; const W = CODE_W[ver];
    const realm = get(3), n = get(3), nl = get(5), nm = []; for (let i = 0; i < nl; i++) nm.push(get(8));
    const marks = []; if (W.mk) { const mb = get(W.mk); MARK_KEYS.forEach((k, i) => { if (Math.floor(mb / 2 ** i) % 2) marks.push(k); }); }
    const trial = W.fl ? !!get(W.fl) : false;
    if (n < 1 || n > SLOTS) return null;
    const team = [];
    for (let i = 0; i < n; i++) {
      const sp = SPECIES[get(W.sp)]; if (!sp) return null;
      const g = { uid: nuid(), sp: sp.id, atk: Math.max(1, get(W.st)), hp: Math.max(1, get(W.st)), wound: get(2), tr: [], q: [], att: [] };
      const nt = get(3); for (let j = 0; j < nt; j++) { const k = TRAIT_KEYS[get(W.tr)], v = get(2); if (k && j < MAXTR + RANK.fuse) g.tr.push([k, Math.max(1, Math.min(MAXV, v))]); }
      const nq = get(2); for (let j = 0; j < nq; j++) { const k = QUIRK_KEYS[get(W.q)]; if (k) g.q.push(k); }
      const na = get(2); for (let j = 0; j < na; j++) { const a = SPECIES[get(W.sp)]; if (a && j < MAXATT) g.att.push(a.id); }
      g.fed = get(18) * 10000; g.mut = get(7); if (get(1)) g.boss = 1;
      const rk = W.rk ? get(W.rk) : 0;
      g.rank = ver >= 3 ? Math.max(1, Math.min(RANK.names.length - 1, rk)) : baseRank(g.sp) + Math.min(RANK.fuse, rk);   // v1 无转数；v2 存合炼次数；v3 存转数
      team.push(g);
    }
    const end = p; let chk = 0; for (let i = 0; i < end; i++) if (bits[i]) chk = (chk + i * 7 + 3) % 64;
    if (get(6) !== chk) return null;
    return { team, realm, name: unutf8(nm), marks, trial };
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


const MAXTURN = 60, MAXOPS = 6000, CAP = SLOTS;   // CAP：场上同时存活的上限（与空窍格数一致）

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
  if (trial) {   // 试玩存档：网页模拟灵流养的蛊，卡面盖一枚醒目的「试玩」章
    ctx.save(); ctx.translate(690, 150); ctx.rotate(-0.12); ctx.strokeStyle = '#d8553f'; ctx.lineWidth = 5; ctx.strokeRect(-92, -50, 184, 100); ctx.lineWidth = 2; ctx.strokeRect(-82, -40, 164, 80);
    ctx.fillStyle = '#d8553f'; ctx.font = `64px ${KAI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('试玩', 0, 4); ctx.restore();
    ctx.save(); ctx.fillStyle = 'rgba(216,85,63,.85)'; ctx.font = `24px ${KAI}`; ctx.textAlign = 'center'; ctx.fillText('网页模拟灵流', 690, 236); ctx.restore();
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

// ---- src/meta.js
// 蛊码 GuCode · 成长与奖励系统（纯逻辑，不碰 DOM）
//
// ═══ 集成指南（给 ui.js 接入的人）═══════════════════════════════════════════
// 状态：S.meta = metaMigrate(saved.meta, S)（读档时）；新档 S.meta = metaInit()。随 S 一起存档。
// 约定：所有函数的 rng 用 makeRng(...)；不传则用 M.rs 计数器派生（同存档可复现）。
//
// 1) 事件入口：每个游戏事件调用一次 `const out = metaEmit(S.meta, type, payload, rng, S)`
//    - token{delta,rate}        TokenSource 每次 tick（约每秒）。同时调用 feedTeam(S.team, delta) 让蛊头冒「+灵气」
//    - node_done{type}          罗盘节点结算后          - merge{star}   合炼升转后（star = 合炼次数 + 1）
//    - battle_end{kind,win,hpLeftRatio,crits,maxHit,skills,turns,streakSafe?}  斗蛊结算时（kind: easy/mid/hard/trib/endless/duel）
//    - cocoon{rarity}           开茧揭晓后（rarity 用 rollRarity 的返回值 0-4）
//    - shop_refresh{nearMiss,triple}  每次转市/首次摆出三格（flags 可用 shopFlags(wares)）
//    - realm_up{realm}  endless_floor{floor}  share{kind}  duel_open
//    - session_start{date,hour,awayMs,awayTokens}  打开页面/插件时一次；awayTokens 不要再另发 token 事件，meta 内部会计入
//    - day_tick{date,hour?}     每分钟一次即可（跨天、夜码人靠它）；date 用 ui 的 today() 格式（Y-M-D，补零与否均可）
//    第 5 个参数传 S 可让解锁/蛊典成就读到 S.nodes / S.realm / S.codex（不传也行，meta 自己计数）。
// 2) 返回值 out = { xp, levelUps[], achievements[], chests[], unlocks[], rewards[], notes[], streak?, settle?, away? }
//    动画按这个顺序播：xp 条增长 → levelUps（逐级，各带 rewards）→ achievements（逐个，铜/银/金不同时长）→
//    chests（掉箱）→ unlocks（新功能点亮，全屏小闪）→ rewards 汇总飘字 → notes（一行行小字，如「败也有得」「你离开期间」）。
//    大奖（金成就、玄箱、天/绝茧、里程碑等级）全屏；小奖只飘数字（设计内核第 12 条）。
// 3) 奖励落地：out.rewards 里只有 k==='stone' 需要 ui 自己 S.stone += n；
//    chest/cocoon/charm/species/slot/title/xp 已经由 meta 写进 S.meta，ui 只负责展示。
//    battle_end 的 stone 是「结算加成」（连胜倍率 + 每日首胜 ×3 相对 ECON.win 基础值的增量），基础元石仍由 ui 照旧发。
//    败局：连胜不扣已有东西，只失去加成；败局照样推进 经验 / 天机 / 每日 / 成就（out.notes 有「败也有得」）。
//    货币和道具只有三种：元石、蛊茧、经验（宝箱打开当场变成这三样）。魂片、护心符已去掉。
// 4) 宝箱：S.meta.chests 是未开的箱（档位 key 数组）；点开调用 openChest(M, rng, idx) → 同样形状的 out（+tier）。
//    开茧：S.meta.cocoons 是未开茧（元素为保底稀有度下限）；openCocoon(M, rng) → {tier, minRar}，
//    ui 再用 newGu(species) + applyRarity(gu, tier, rng) 生成蛊（放入哪里由 ui 定），然后 metaEmit('cocoon',{rarity:tier})。
//    透明显示：pityLeft(M) →「距天机 N」，rarityOdds() → 蛊典概率表，streakInfo(M) → 连胜/护心符。
// 5) 解锁：isUnlocked(M, S, key)（key 见 UNLOCKS）。UI 按它隐藏/锁住入口；out.unlocks 里的 key 是刚点亮的。
//    旧档：metaMigrate(m, S) 会把当前已满足的解锁静默记为已解锁，不放动画。
// 6) 新手：转市前调用 rigShop(M, rng, pool)，非 null 就用它当三格（前几次保证近失与三同 = 合炼机会）；
//    META_TUNE.newbie.freeRefresh 次转市建议免元石。坐标码编码：见回报，rar 建议集成方决定。
// 7) 每日面板：dailyView(M)；成就面板：achList(M)；称号：titleName(M)（上分享卡）；等级条：levelInfo(M)。
// ══════════════════════════════════════════════════════════════════════════


// ───────────────────────── 调参总表（贡献者/调参 agent 只改这几张表）─────────────────────────
const META_TUNE = {
  // 经验：每喂 1000 token 得 perKTok 点蛊师经验；武火（rate 高）有加成
  xp: { perKTok: 1, hotRate: 3000, hotMul: 1.2, node: 8, lose: 6, win: { easy: 10, mid: 14, hard: 20, trib: 40, endless: 16, duel: 10 }, merge: [0, 0, 10, 30], realm: 40, floor: 5, share: 15, duel: 5, cocoon: [3, 6, 12, 30, 80] },
  // 蛊师等级曲线：第 L 级升 L+1 所需经验 = round(base * growth^(L-1))，前期升得快、后期指数变慢
  level: { base: 18, growth: 1.095, max: 100 },
  // 蛊的灵气等级：升到第 l+1 级所需灵气（1 灵气 = 1 token）= round(base * growth^l)；每级 +hp，每 atkEvery 级 +1 攻
  gu: { max: 8, base: 8000, growth: 2.1, hp: 1, atkEvery: 3, leadShare: 0.4 },
  // 灵气宝箱：挂机每累计 every token 掉一个，间隔随机抖动 jitter 倍；第一个固定较早（新玩家）；档位权重 凡..玄 -> 木铜银金玄
  qiChest: { first: 50000, every: 150000, jitter: [0.4, 1.6], tier: [58, 28, 10, 3.5, 0.5], maxPerEvent: 20 },
  // 天机（保底）：每 every 次开茧必出绝或以上；新玩家第一次 firstEvery 次内必出；保底时绝:天 按 RARITY.p 比例
  pity: { every: 40, firstEvery: 5 },
  // 连胜：第 n 连胜的结算倍率 = min(cap, 1 + perWin*(n-1))；护心符 charmCost 元石一张，持有上限 charmMax；断连只失去倍率
  streak: { perWin: 0.1, cap: 2.0, charmCost: 6, charmMax: 3, minForCharm: 3, milestone: 5 },
  // 战败：把天机往前推 pityStep 次
  lose: { pityStep: 1 },
  // 战胜敌方残躯化茧的几率（幽灵按难度、无尽劫）；渡劫胜利另有晋阶与道痕
  spoils: { easy: 0.35, mid: 0.6, hard: 1, endless: 0.4 },
  // 胜利掉箱：p=掉落几率，w=档位权重（木铜银金玄）；每 every 场胜利必得一个 milestoneTier 箱（固定里程碑）
  drop: {
    easy: { p: 0.45, w: [70, 25, 5, 0, 0] }, mid: { p: 0.6, w: [45, 35, 15, 4, 1] }, hard: { p: 0.8, w: [20, 35, 28, 14, 3] },
    trib: { p: 1, w: [0, 20, 40, 30, 10] }, endless: { p: 0.6, w: [30, 35, 22, 10, 3] }, duel: { p: 0.5, w: [50, 30, 15, 5, 0] },
    every: 5, milestoneTier: 'silver',
  },
  // 每日：首胜结算倍率（加在连胜倍率上）、任务数、三个全完成的额外奖励
  daily: { firstWinMul: 3, taskCount: 3, allBonus: { k: 'chest', tier: 'silver' } },
  // 离开回来：离开至少 minMs 才算；按 awayTokens 阈值给宝箱档位（从高到低匹配）
  away: { minMs: 300000, tiers: [[20000000, 'gold'], [2000000, 'silver'], [200000, 'copper'], [20000, 'wood']] },
  // 新手：前几次转市保证近失/三同（合炼机会）；这几次转市建议免费
  newbie: { rigUntil: 4, freeRefresh: 2 },
  // 夜码人时段（本地小时，含头不含尾）
  night: [2, 5],
};

// 稀有度：凡良珍绝天。p=概率（和为 100，蛊典照实显示）；mul=攻血倍率；traits=额外词条数；col=主题色
const RARITY = [
  { id: 'fan', n: '凡', p: 60, mul: 1.0, traits: 0, col: '#8f8775' },
  { id: 'liang', n: '良', p: 25, mul: 1.15, traits: 0, col: '#6fb7a4' },
  { id: 'zhen', n: '珍', p: 10, mul: 1.35, traits: 1, col: '#6f9fd8' },
  { id: 'jue', n: '绝', p: 4, mul: 1.7, traits: 1, col: '#d9a441' },
  { id: 'tian', n: '天', p: 1, mul: 2.2, traits: 2, col: '#d8553f' },
];

// 宝箱：stone=元石区间；cocoonP=附送蛊茧几率；minRar=该茧保底稀有度；xp=经验区间（打开当场变成元石、经验、蛊茧）
const CHESTS = {
  wood: { n: '木箱', stone: [1, 3], cocoonP: 0.03, minRar: 0, xp: [4, 8] },
  copper: { n: '铜箱', stone: [3, 6], cocoonP: 0.1, minRar: 0, xp: [8, 16] },
  silver: { n: '银箱', stone: [6, 12], cocoonP: 0.22, minRar: 1, xp: [16, 30] },
  gold: { n: '金箱', stone: [12, 24], cocoonP: 0.45, minRar: 1, xp: [30, 60] },
  xuan: { n: '玄箱', stone: [25, 50], cocoonP: 1, minRar: 2, xp: [80, 150] },
};
const CHEST_KEYS = Object.keys(CHESTS);

// 蛊师等级奖励：k=stone 元石 / chest 宝箱 / cocoon 蛊茧(n=保底稀有度) / species 蛊种进池 / slot 蛊市加格 / title 称号
// 默认每级 1+⌊L/10⌋ 元石、每 3 级一个箱、每 5 级一个茧；下面 special 覆盖；里程碑（10 的倍数）给大奖
const LEVEL_REWARDS = (() => {
  const t = {}, tierAt = L => (L >= 80 ? 'xuan' : L >= 55 ? 'gold' : L >= 30 ? 'silver' : L >= 12 ? 'copper' : 'wood');
  for (let L = 2; L <= 100; L++) {
    const r = [{ k: 'stone', n: 1 + Math.floor(L / 10) }];
    if (L % 3 === 0) r.push({ k: 'chest', tier: tierAt(L) });
    if (L % 5 === 0) r.push({ k: 'cocoon', n: L >= 40 ? 1 : 0 });
    if (L % 10 === 0) r.push({ k: 'chest', tier: L >= 60 ? 'xuan' : 'gold' }, { k: 'cocoon', n: 2 });
    t[L] = r;
  }
  const sp = (L, r) => { t[L] = r; };
  // 新手前几级密集（连续奖励阶段）：5 分钟内要有升级、茧、箱
  sp(2, [{ k: 'stone', n: 2 }, { k: 'chest', tier: 'wood' }]);
  sp(3, [{ k: 'stone', n: 2 }, { k: 'cocoon', n: 0 }]);
  sp(4, [{ k: 'cocoon', n: 0 }, { k: 'stone', n: 1 }]);
  sp(5, [{ k: 'stone', n: 4 }, { k: 'chest', tier: 'copper' }, { k: 'cocoon', n: 0 }]);
  sp(6, [{ k: 'cocoon', n: 0 }, { k: 'species', id: 'mantis' }]);
  sp(7, [{ k: 'chest', tier: 'wood' }, { k: 'stone', n: 2 }]);
  sp(8, [{ k: 'stone', n: 8 }]);
  sp(10, [{ k: 'chest', tier: 'silver' }, { k: 'cocoon', n: 1 }, { k: 'species', id: 'queen' }, { k: 'title', id: 'lv10' }]);
  sp(14, [{ k: 'species', id: 'cicada' }, { k: 'stone', n: 4 }]);
  sp(15, [{ k: 'slot', n: 1 }, { k: 'cocoon', n: 1 }, { k: 'chest', tier: 'silver' }]);
  sp(18, [{ k: 'species', id: 'drum' }, { k: 'chest', tier: 'silver' }]);
  sp(20, [{ k: 'chest', tier: 'gold' }, { k: 'cocoon', n: 2 }, { k: 'stone', n: 6 }]);
  sp(22, [{ k: 'species', id: 'scorp' }, { k: 'stone', n: 6 }]);
  sp(25, [{ k: 'chest', tier: 'gold' }, { k: 'cocoon', n: 2 }, { k: 'title', id: 'lv25' }]);
  sp(26, [{ k: 'species', id: 'moth' }, { k: 'stone', n: 6 }]);
  sp(40, [{ k: 'slot', n: 1 }, { k: 'chest', tier: 'gold' }, { k: 'cocoon', n: 3 }]);
  sp(50, [{ k: 'chest', tier: 'xuan' }, { k: 'cocoon', n: 3 }, { k: 'title', id: 'lv50' }]);
  sp(75, [{ k: 'chest', tier: 'xuan' }, { k: 'cocoon', n: 3 }, { k: 'title', id: 'lv75' }]);
  sp(100, [{ k: 'chest', tier: 'xuan' }, { k: 'chest', tier: 'xuan' }, { k: 'cocoon', n: 4 }, { k: 'title', id: 'lv100' }]);
  return t;
})();
// 哪些级别算「大奖」（全屏动画）
const LEVEL_BIG = [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];

// 成就奖励（按档，单个成就可用 reward 覆盖）与成就点
const ACH_TIER = {
  bronze: { n: '铜', pt: 1, reward: [{ k: 'xp', n: 25 }, { k: 'stone', n: 2 }] },
  silver: { n: '银', pt: 3, reward: [{ k: 'xp', n: 80 }, { k: 'chest', tier: 'copper' }] },
  gold: { n: '金', pt: 6, reward: [{ k: 'xp', n: 250 }, { k: 'chest', tier: 'gold' }, { k: 'cocoon', n: 2 }] },
};

// 成就：[id, 档, 名, 说明, check(c), 隐藏?]。c = { M, st(=M.stats), type, p, S }
const mkAch = (id, tier, n, d, check, hidden) => ({ id, tier, n, d, check, hidden: !!hidden });
const mkStat = (k, n) => c => c.st[k] >= n;
const ACHIEVEMENTS = [
  // ——铜
  mkAch('first_node', 'bronze', '初入空窍', '走完第一个罗盘节点', mkStat('nodes', 1)),
  mkAch('first_win', 'bronze', '首战告捷', '斗蛊首胜', mkStat('wins', 1)),
  mkAch('first_merge', 'bronze', '初次合炼', '三只同种同转合炼成高一转', c => c.st.merges >= 1),
  mkAch('first_cocoon', 'bronze', '破茧', '第一次开茧', mkStat('cocoons', 1)),
  mkAch('first_chest', 'bronze', '得宝', '第一次获得宝箱', mkStat('chestsGot', 1)),
  mkAch('lv5', 'bronze', '蛊师五级', '蛊师达到 5 级', c => c.M.level >= 5),
  mkAch('tok_100k', 'bronze', '十万灵气', '累计喂出 10 万 token', c => c.st.tokens >= 1e5),
  mkAch('first_skill', 'bronze', '杀招初现', '一场斗蛊里打出杀招', mkStat('skills', 1)),
  mkAch('crit3', 'bronze', '手起刀落', '单场暴击 3 次', c => c.type === 'battle_end' && c.p.crits >= 3),
  mkAch('first_realm', 'bronze', '一转', '渡劫成功，踏入一转', c => c.st.realm >= 1),
  mkAch('first_share', 'bronze', '下战帖', '分享一次战帖', mkStat('shares', 1)),
  mkAch('first_duel', 'bronze', '应战', '打开一份朋友的战帖', mkStat('duels', 1)),
  mkAch('lose5', 'bronze', '屡败屡战', '累计败 5 场（败也有收获）', mkStat('losses', 5)),
  mkAch('near_miss', 'bronze', '差一只', '转市时差一只就凑齐三同', mkStat('nearMiss', 1), true),
  mkAch('pity_hit', 'bronze', '天机应验', '靠天机保底开出绝品', mkStat('pityHits', 1), true),
  mkAch('streak5', 'bronze', '五连胜', '斗蛊连胜 5 场', mkStat('bestStreak', 5)),
  mkAch('hit200', 'bronze', '力能扛鼎', '单次伤害 ≥ 200', mkStat('maxHit', 200)),
  // ——银
  mkAch('night', 'silver', '夜码人', '本地时间 2–5 点还在养蛊', mkStat('nights', 1), true),
  mkAch('hit1000', 'silver', '一刀秒杀', '单次伤害 ≥ 1000', mkStat('maxHit', 1000)),
  mkAch('comeback', 'silver', '绝境翻盘', '以不足两成血量赢下一场', mkStat('comebacks', 1), true),
  mkAch('ouhuang', 'silver', '欧皇', '10 次开茧内出 2 只天', c => c.M.recent.length >= 2 && c.M.recent.filter(x => x === 4).length >= 2, true),
  mkAch('tok_1m', 'silver', '百万灵气', '累计喂出 100 万 token', c => c.st.tokens >= 1e6),
  mkAch('streak10', 'silver', '十连胜', '斗蛊连胜 10 场', mkStat('bestStreak', 10)),
  mkAch('star3', 'silver', '再炼一转', '同一只蛊合炼两次（如一转炼到三转）', mkStat('maxStar', 3)),
  mkAch('triple', 'silver', '三同', '转市三格同种', mkStat('triples', 1)),
  mkAch('refresh3', 'silver', '三连转市', '连续转市 3 次不做别的', c => c.M.run.refStreak >= 3),
  mkAch('endless10', 'silver', '无尽十层', '无尽劫到第 10 层', mkStat('endless', 10)),
  mkAch('codex50', 'silver', '蛊典半卷', '蛊典收集过半', c => c.codex >= 0.5),
  mkAch('lv20', 'silver', '蛊师二十级', '蛊师达到 20 级', c => c.M.level >= 20),
  mkAch('realm3', 'silver', '三转', '踏入三转', mkStat('realm', 3)),
  mkAch('perfect', 'silver', '毫发无伤', '赢下一场且阵容血量不掉', mkStat('perfects', 1), true),
  mkAch('kinds7', 'silver', '七路皆走', '七种罗盘节点都走过一遍', c => Object.keys(c.st.nodeTypes).length >= 7),
  mkAch('jue1', 'silver', '绝品现世', '开出第一只绝或天', mkStat('jue', 1)),
  mkAch('daily3', 'silver', '日课圆满', '一天内完成 3 个每日任务', mkStat('allDays', 1)),
  mkAch('away_big', 'silver', '洞中一日', '一次离开期间蛊吃下 100 万 token', mkStat('awayMax', 1e6), true),
  mkAch('win50', 'silver', '五十胜', '累计斗赢 50 场', mkStat('wins', 50)),
  // ——金
  mkAch('hit10000', 'gold', '一击破万', '单次伤害 ≥ 10000', mkStat('maxHit', 10000)),
  mkAch('tian1', 'gold', '天选之蛊', '开出一只天品蛊', mkStat('tian', 1)),
  mkAch('tok_100m', 'gold', '亿级灵气', '累计喂出 1 亿 token', c => c.st.tokens >= 1e8),
  mkAch('streak20', 'gold', '二十连胜', '斗蛊连胜 20 场', mkStat('bestStreak', 20)),
  mkAch('realm5', 'gold', '登顶五转', '渡过天人劫，踏入五转', mkStat('realm', 5)),
  mkAch('endless30', 'gold', '无尽三十', '无尽劫到第 30 层', mkStat('endless', 30)),
  mkAch('codex100', 'gold', '蛊典圆满', '蛊典全部收集', c => c.codex >= 1),
  mkAch('lv50', 'gold', '蛊师五十级', '蛊师达到 50 级', c => c.M.level >= 50),
  mkAch('week7', 'gold', '七日修行', '七日签到走完一轮', c => c.st.signMax >= 7),
  mkAch('win200', 'gold', '百战老蛊师', '累计斗赢 200 场', mkStat('wins', 200)),
];
const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
const achReward = a => a.reward || ACH_TIER[a.tier].reward;

// 称号：ap=成就点达到即得；lv=由蛊师等级奖励发放。分享卡上显示 titleName(M)
const TITLES = [
  { id: 't0', n: '无名蛊师', ap: 0 }, { id: 't1', n: '初窥门径', ap: 4 }, { id: 't2', n: '炼气蛊徒', ap: 10 }, { id: 't3', n: '空窍行者', ap: 20 },
  { id: 't4', n: '夜行蛊师', ap: 34 }, { id: 't5', n: '百炼蛊修', ap: 52 }, { id: 't6', n: '一方蛊宗', ap: 75 }, { id: 't7', n: '天机在握', ap: 100 }, { id: 't8', n: '蛊道圆满', ap: 125 },
  { id: 'lv10', n: '十级蛊师', lv: 10 }, { id: 'lv25', n: '蛊师·百炼', lv: 25 }, { id: 'lv50', n: '蛊师·半百', lv: 50 }, { id: 'lv75', n: '蛊师·登峰', lv: 75 }, { id: 'lv100', n: '蛊师·满级', lv: 100 },
];

// 每日任务池：按日期种子抽 taskCount 个；inc(type,p) 返回本事件的进度增量；chest=完成奖励的箱
const DAILY_TASKS = [
  { id: 'win2', n: '斗赢 2 场', need: 2, chest: 'wood', inc: (t, p) => (t === 'battle_end' && p.win ? 1 : 0) },
  { id: 'fight3', n: '斗蛊 3 场（胜负不论）', need: 3, chest: 'wood', inc: t => (t === 'battle_end' ? 1 : 0) },
  { id: 'hard1', n: '胜一场「难」档幽灵', need: 1, chest: 'copper', inc: (t, p) => (t === 'battle_end' && p.win && (p.kind === 'hard' || p.kind === 'trib') ? 1 : 0) },
  { id: 'node3', n: '走完 3 个罗盘节点', need: 3, chest: 'wood', inc: t => (t === 'node_done' ? 1 : 0) },
  { id: 'refresh5', n: '转市 5 次', need: 5, chest: 'wood', inc: t => (t === 'shop_refresh' ? 1 : 0) },
  { id: 'merge1', n: '合炼 1 次', need: 1, chest: 'copper', inc: t => (t === 'merge' ? 1 : 0) },
  { id: 'cocoon3', n: '开茧 3 次', need: 3, chest: 'copper', inc: t => (t === 'cocoon' ? 1 : 0) },
  { id: 'feed200', n: '喂养 20 万灵气', need: 200, chest: 'copper', inc: (t, p) => (t === 'token' ? (p.delta || 0) / 1000 : 0) },
  { id: 'crit5', n: '暴击 5 次', need: 5, chest: 'wood', inc: (t, p) => (t === 'battle_end' ? p.crits || 0 : 0) },
  { id: 'skill2', n: '打出杀招 2 场', need: 2, chest: 'copper', inc: (t, p) => (t === 'battle_end' && p.skills > 0 ? 1 : 0) },
  { id: 'share1', n: '分享一次战帖', need: 1, chest: 'wood', inc: t => (t === 'share' ? 1 : 0) },
];
// 七日签到（断签不罚，只是从第 1 天重新算）
const SIGN_REWARDS = [
  [{ k: 'stone', n: 2 }], [{ k: 'chest', tier: 'wood' }], [{ k: 'stone', n: 6 }], [{ k: 'chest', tier: 'copper' }],
  [{ k: 'stone', n: 5 }], [{ k: 'cocoon', n: 1 }], [{ k: 'chest', tier: 'gold' }, { k: 'cocoon', n: 2 }],
];

// 分批解锁：need 里的条件全满足即点亮（nodes=已走节点数 wins=胜场 level=蛊师等级 realm=境界）
const UNLOCKS = {
  compass: { n: '罗盘', d: '三选一，走你的流派', need: {} },
  formation: { n: '蛊阵', d: '排兵布阵', need: {} },
  battle: { n: '斗蛊', d: '随时开斗', need: { nodes: 1 } },
  shop: { n: '转轮蛊市', d: '买蛊、转市、合炼升转', need: { nodes: 2 } },
  cocoon: { n: '开茧', d: '宝箱与升级会送蛊茧', need: { level: 2 } },
  daily: { n: '每日修行', d: '首胜加成、每日任务、七日签到', need: { level: 3 } },
  ach: { n: '成就', d: '成就与称号', need: { level: 4 } },
  marks: { n: '道痕', d: '渡劫后三选一的整局被动', need: { realm: 1 } },
  endless: { n: '无尽劫', d: '五转之后，逐层变强', need: { realm: 5 } },
};
const UNLOCK_ORDER = Object.keys(UNLOCKS);

// ───────────────────────── 状态 ─────────────────────────
const clone = o => JSON.parse(JSON.stringify(o));
function metaInit() {
  return {
    v: 1, rs: 1, xp: 0, level: 1, ap: 0, ach: {}, titles: ['t0'], title: 't0', chests: [], cocoons: [], shards: 0, species: ['boar', 'fire', 'twin', 'iron', 'thorn', 'bone'], shopSlots: 0,
    pity: { n: 0, total: 0, first: true, lastForced: false }, recent: [],
    streak: { n: 0, charms: 0 },
    qiChest: { acc: 0, next: 0 },
    run: { refStreak: 0 }, cur: { hour: 12 },
    daily: { date: '', firstWin: false, tasks: [], allDone: false, signDay: 0, signDate: '', shared: false },
    unlocked: {},
    stats: { tokens: 0, nodes: 0, nodeTypes: {}, battles: 0, wins: 0, losses: 0, crits: 0, skills: 0, maxHit: 0, merges: 0, maxStar: 1, cocoons: 0, jue: 0, tian: 0, pityHits: 0, refreshes: 0, triples: 0, nearMiss: 0, shares: 0, duels: 0, realm: 0, endless: 0, bestStreak: 0, chestsGot: 0, chestsOpened: 0, perfects: 0, comebacks: 0, nights: 0, allDays: 0, signMax: 0, awayMax: 0, kindWins: {} },
  };
}
function deepFill(def, cur) { for (const k of Object.keys(def)) { if (cur[k] === undefined || cur[k] === null) cur[k] = clone(def[k]); else if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k]) && typeof cur[k] === 'object') deepFill(def[k], cur[k]); } return cur; }
// 读档迁移：没有 meta（旧存档）就新建；有则补齐缺字段。传入 S 时用旧存档的进度种子化统计，并把已满足的解锁静默记为已解锁
function metaMigrate(m, S) {
  const isNew = !m || typeof m !== 'object';
  const M = isNew ? metaInit() : deepFill(metaInit(), m);
  if (S && typeof S === 'object') {
    const st = M.stats;
    if (isNew) {
      st.tokens = Math.max(st.tokens, S.total | 0); st.wins = Math.max(st.wins, S.wins | 0); st.losses = Math.max(st.losses, S.losses | 0); st.nodes = Math.max(st.nodes, S.nodes | 0);
      st.bestStreak = Math.max(st.bestStreak, S.bestStreak | 0); st.endless = Math.max(st.endless, S.endless | 0); st.realm = Math.max(st.realm, S.realm | 0); st.battles = st.wins + st.losses;
    }
    for (const k of UNLOCK_ORDER) if (!M.unlocked[k] && unlockOk(M, S, k)) M.unlocked[k] = true;
  }
  return M;
}

// ───────────────────────── 工具 ─────────────────────────
const wpick = (rng, w) => { let t = 0; for (const x of w) t += x; let r = rng() * t; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; } return w.length - 1; };
const rint = (rng, [a, b]) => a + rng.int(b - a + 1);
const getRng = (M, rng) => rng || makeRng(0x9e3779b1 ^ (M.rs = (M.rs + 1) | 0));
const dayNum = s => { const m = /(\d+)-(\d+)-(\d+)/.exec(String(s)); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : NaN; };
const nextTierKey = i => CHEST_KEYS[Math.max(0, Math.min(CHEST_KEYS.length - 1, i))];
const newOut = () => ({ xp: 0, levelUps: [], achievements: [], chests: [], unlocks: [], rewards: [], notes: [] });
const codexRatio = (M, S) => { const c = S && S.codex; if (!c) return 0; return ((c.sp || []).length + (c.combo || []).length) / (SPECIES.length + COMBOS.length); };

// ───────────────────────── 等级 ─────────────────────────
const levelNeed = L => Math.round(META_TUNE.level.base * Math.pow(META_TUNE.level.growth, L - 1));
function levelInfo(M) {
  const L = M.level, max = META_TUNE.level.max, nextL = Math.min(max, L + 1);
  return { level: L, cur: M.xp, need: L >= max ? 0 : levelNeed(L), next: L >= max ? [] : LEVEL_REWARDS[nextL], big: LEVEL_BIG.includes(nextL) };
}
function xpTotalTo(L) { let s = 0; for (let i = 1; i < L; i++) s += levelNeed(i); return s; }

// ───────────────────────── 稀有度与天机 ─────────────────────────
const pityThr = M => (M.pity.first ? META_TUNE.pity.firstEvery : META_TUNE.pity.every);
// 距天机还有几次开茧（1 = 下一次必出绝或以上）
function pityLeft(M) { return Math.max(1, pityThr(M) - M.pity.n); }
const rarityOdds = () => RARITY.map(r => ({ id: r.id, n: r.n, pct: r.p }));
// 开一次茧的稀有度（0-4）。带天机：达到次数必出绝/天；minRar 为保底下限（如玄箱的茧）
function rollRarity(M, rng, minRar = 0) {
  rng = getRng(M, rng); const P = M.pity, forced = P.n >= pityThr(M) - 1;
  let tier;
  if (forced) tier = 3 + wpick(rng, [RARITY[3].p, RARITY[4].p]);
  else tier = wpick(rng, RARITY.map(r => r.p));
  if (tier < minRar) tier = minRar;
  P.total++; P.lastForced = forced && tier >= 3 && P.n >= pityThr(M) - 1;
  if (tier >= 3) { P.n = 0; P.first = false; } else P.n++;
  return tier;
}
// 取一个未开的茧并掷稀有度；返回 {tier, minRar} 或 null。ui 之后 applyRarity 再 metaEmit('cocoon')
function openCocoon(M, rng) { if (!M.cocoons.length) return null; const minRar = M.cocoons.shift(); return { tier: rollRarity(M, rng, minRar), minRar }; }
// 给蛊加稀有度：属性倍率 + 额外词条。gu.rar = 0..4（已有 rar 则不重复）
function applyRarity(gu, tier, rng) {
  if (gu.rar !== undefined) return gu;
  const r = RARITY[tier]; gu.rar = tier; rng = rng || makeRng(hashStr(gu.uid || gu.sp));
  gu.atk = Math.max(gu.atk + (tier > 0 ? 1 : 0), Math.round(gu.atk * r.mul)); gu.hp = Math.max(gu.hp + (tier > 0 ? 1 : 0), Math.round(gu.hp * r.mul));
  for (let i = 0; i < r.traits; i++) {
    const fresh = TRAIT_KEYS.filter(k => !gu.tr.some(t => t[0] === k)), up = gu.tr.filter(t => t[1] < MAXV);
    if (gu.tr.length < trCap(gu) && fresh.length) addTrait(gu, rng.pick(fresh), 1, tier >= 4);
    else if (up.length) addTrait(gu, rng.pick(up)[0], 1);
    else { gu.atk++; gu.hp++; }
  }
  return gu;
}
// 蛊市里能进「开茧/招蛊池」的蛊种：基础 6 种 + 蛊师等级解锁的
const metaPool = M => M.species.slice();

// ───────────────────────── 蛊的灵气等级 ─────────────────────────
const guQiNeed = l => Math.round(META_TUNE.gu.base * Math.pow(META_TUNE.gu.growth, l));
// 给一只蛊喂灵气（token）。返回 {ups, atk, hp, level, cur, need}
function feedGu(g, amount) {
  const T = META_TUNE.gu; g.ql = g.ql || 0; g.qx = (g.qx || 0) + Math.max(0, amount); let ups = 0, atk = 0, hp = 0;
  while (g.ql < T.max && g.qx >= guQiNeed(g.ql)) { g.qx -= guQiNeed(g.ql); g.ql++; ups++; hp += T.hp; if (g.ql % T.atkEvery === 0) atk++; }
  if (g.ql >= T.max) g.qx = 0;
  g.atk += atk; g.hp += hp;
  return { ups, atk, hp, level: g.ql, cur: g.qx, need: g.ql >= T.max ? 0 : guQiNeed(g.ql) };
}
// token 流动时给全队分灵气：炉口（最左）占 leadShare，其余均分。返回 [{uid, qi, up}]，ui 在蛊头冒「+灵气」
function feedTeam(team, tokens) {
  const n = team.length; if (!n || !(tokens > 0)) return [];
  const lead = n === 1 ? 1 : META_TUNE.gu.leadShare, rest = n > 1 ? (1 - lead) / (n - 1) : 0;
  return team.map((g, i) => { const qi = Math.round(tokens * (i === 0 ? lead : rest)), r = feedGu(g, qi); return { uid: g.uid, qi, up: r.ups, atk: r.atk, hp: r.hp }; });
}
const qiText = n => '+' + (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : n) + '灵气';

// ───────────────────────── 宝箱 ─────────────────────────
function rollChest(rng, tier) {
  const c = CHESTS[tier], rewards = [{ k: 'stone', n: rint(rng, c.stone) }];
  if (rng() < c.cocoonP) rewards.push({ k: 'cocoon', n: c.minRar });
  rewards.push({ k: 'xp', n: rint(rng, c.xp) });
  return { tier, rewards };
}
const chestTier = (rng, w) => nextTierKey(wpick(rng, w));
// 打开一个未开的宝箱（idx 默认第一个）。返回 out 同形状 + tier
function openChest(M, rng, idx = 0) {
  rng = getRng(M, rng); const out = newOut(); if (idx < 0 || idx >= M.chests.length) return null;
  const tier = M.chests.splice(idx, 1)[0], r = rollChest(rng, tier);
  M.stats.chestsOpened++; out.tier = tier; give(M, out, r.rewards, rng); settle(M, out, rng, null, 'chest_open', {});
  return out;
}
// 灵气宝箱：累计 token 到随机阈值掉一个
function qiChests(M, out, delta, rng) {
  const T = META_TUNE.qiChest, q = M.qiChest; if (!q.next) q.next = T.first;
  q.acc += delta; let n = 0;
  while (q.acc >= q.next && n++ < T.maxPerEvent) {
    q.acc -= q.next; q.next = Math.round(T.every * (T.jitter[0] + rng() * (T.jitter[1] - T.jitter[0])));
    give(M, out, [{ k: 'chest', tier: chestTier(rng, T.tier), why: '灵气宝箱' }], rng);
  }
  if (q.acc > q.next * 3) q.acc = q.next; // 超长离开：不囤无限箱
}

// ───────────────────────── 连胜 ─────────────────────────
const streakMul = n => Math.min(META_TUNE.streak.cap, 1 + META_TUNE.streak.perWin * Math.max(0, n - 1));
function streakInfo(M) { const T = META_TUNE.streak, n = M.streak.n; return { n, mul: streakMul(n), charms: M.streak.charms, charmCost: T.charmCost, canGuard: n >= T.minForCharm }; }
const charmCost = () => META_TUNE.streak.charmCost;
// 败局前给 ui 判断是否值得弹「护心符」按钮
const canGuardStreak = M => M.streak.n >= META_TUNE.streak.minForCharm;

// ───────────────────────── 转市 ─────────────────────────
function shopFlags(wares) {
  const ids = wares.filter(w => w && !w.sold).map(w => w.sp), c = {}; ids.forEach(i => { c[i] = (c[i] || 0) + 1; });
  const mx = Math.max(0, ...Object.values(c));
  return { triple: ids.length >= 3 && mx >= 3, nearMiss: ids.length >= 3 && mx === 2 };
}
// 新手前几次转市保证：第 1 次近失、第 2 次三同（合炼机会）、之后到 rigUntil 交替；返回三格 sp 数组或 null（走自然随机）
function rigShop(M, rng, pool) {
  const n = M.stats.refreshes; if (n >= META_TUNE.newbie.rigUntil || !pool || pool.length < 2) return null;
  rng = getRng(M, rng); const a = rng.pick(pool); let b = rng.pick(pool); while (b === a) b = rng.pick(pool);
  return n % 2 === 1 ? [a, a, a] : [a, a, b];
}

// ───────────────────────── 奖励落地 ─────────────────────────
function give(M, out, list, rng) {
  for (const r of list) {
    const x = { ...r };
    switch (r.k) {
      case 'chest': M.chests.push(r.tier); out.chests.push(r.tier); M.stats.chestsGot++; if (r.tier === 'xuan') M.stats.xuan = (M.stats.xuan | 0) + 1; break;
      case 'cocoon': M.cocoons.push(r.n | 0); break;
      case 'charm': M.streak.charms = Math.min(META_TUNE.streak.charmMax, M.streak.charms + (r.n || 1)); break;
      case 'species': if (!M.species.includes(r.id)) M.species.push(r.id); break;
      case 'slot': M.shopSlots += r.n || 1; break;
      case 'title': if (!M.titles.includes(r.id)) M.titles.push(r.id); break;
      case 'xp': M.xp += r.n; out.xp += r.n; break;
    }
    out.rewards.push(x);
  }
}
function levelCheck(M, out) {
  const max = META_TUNE.level.max; let any = false;
  while (M.level < max && M.xp >= levelNeed(M.level)) {
    M.xp -= levelNeed(M.level); M.level++; any = true;
    const rw = LEVEL_REWARDS[M.level].map(r => ({ ...r, why: '升级' })), lu = { level: M.level, big: LEVEL_BIG.includes(M.level), rewards: rw };
    out.levelUps.push(lu); give(M, out, rw);
  }
  if (M.level >= max) M.xp = 0;
  return any;
}
function achCheck(M, out, c) {
  let any = false;
  for (const a of ACHIEVEMENTS) {
    if (M.ach[a.id] || !a.check(c)) continue;
    M.ach[a.id] = 1; M.ap += ACH_TIER[a.tier].pt; any = true;
    const rw = achReward(a).map(r => ({ ...r, why: '成就' }));
    out.achievements.push({ id: a.id, n: a.n, d: a.d, tier: a.tier, hidden: a.hidden, rewards: rw }); give(M, out, rw);
  }
  for (const t of TITLES) if (t.ap !== undefined && M.ap >= t.ap && !M.titles.includes(t.id)) { M.titles.push(t.id); M.title = t.id; out.rewards.push({ k: 'title', id: t.id, why: '成就点' }); }
  return any;
}
const have = (M, S, key) => {
  const st = M.stats, s = S || {};
  return { nodes: Math.max(st.nodes, s.nodes | 0), wins: Math.max(st.wins, s.wins | 0), level: M.level, realm: Math.max(st.realm, s.realm | 0) }[key];
};
function unlockOk(M, S, key) { const u = UNLOCKS[key]; return !!u && Object.entries(u.need).every(([k, v]) => have(M, S, k) >= v); }
function isUnlocked(M, S, key) { return !!M.unlocked[key] || unlockOk(M, S, key); }
function unlockCheck(M, out, S) {
  let any = false;
  for (const k of UNLOCK_ORDER) if (!M.unlocked[k] && unlockOk(M, S, k)) { M.unlocked[k] = true; out.unlocks.push(k); any = true; }
  return any;
}
function settle(M, out, rng, S, type, p) {
  for (let i = 0; i < 4; i++) {
    const a = levelCheck(M, out), b = achCheck(M, out, { M, st: M.stats, type, p, S, codex: codexRatio(M, S) }), c = unlockCheck(M, out, S);
    if (!a && !b && !c) break;
  }
}

// ───────────────────────── 每日 ─────────────────────────
function pickTasks(date) {
  const rng = makeRng('daily' + date), pool = DAILY_TASKS.slice(), out = [];
  while (out.length < META_TUNE.daily.taskCount && pool.length) { const t = pool.splice(rng.int(pool.length), 1)[0]; out.push({ id: t.id, prog: 0, need: t.need, done: false }); }
  return out;
}
function rollDay(M, out, date, rng) {
  const D = M.daily; if (!date || D.date === date) return;
  const gap = dayNum(date) - dayNum(D.signDate);
  D.signDay = D.signDate && gap === 1 && D.signDay < 7 ? D.signDay + 1 : 1; // 断签不罚：从第 1 天重新算
  D.signDate = date; D.date = date; D.firstWin = false; D.allDone = false; D.shared = false; D.tasks = pickTasks(date);
  M.stats.signMax = Math.max(M.stats.signMax, D.signDay);
  give(M, out, SIGN_REWARDS[D.signDay - 1].map(r => ({ ...r, why: '七日签到' })), rng);
  out.notes.push(`七日签到 第 ${D.signDay} 天`);
}
function dailyProgress(M, out, type, p, rng) {
  const D = M.daily; if (!D.date) return;
  for (const t of D.tasks) {
    if (t.done) continue; const def = DAILY_TASKS.find(d => d.id === t.id); if (!def) continue;
    t.prog = Math.min(t.need, t.prog + def.inc(type, p));
    if (t.prog >= t.need) { t.done = true; give(M, out, [{ k: 'chest', tier: def.chest, why: '每日任务' }], rng); out.notes.push(`每日任务完成：${def.n}`); }
  }
  if (!D.allDone && D.tasks.length && D.tasks.every(t => t.done)) { D.allDone = true; M.stats.allDays++; give(M, out, [{ ...META_TUNE.daily.allBonus, why: '日课圆满' }], rng); out.notes.push('今日三课全部完成'); }
}
function dailyView(M) {
  const D = M.daily;
  return { date: D.date, firstWinPending: !D.firstWin, firstWinMul: META_TUNE.daily.firstWinMul, signDay: D.signDay, sign: SIGN_REWARDS, allDone: D.allDone,
    tasks: D.tasks.map(t => { const d = DAILY_TASKS.find(x => x.id === t.id) || {}; return { id: t.id, n: d.n, prog: Math.floor(t.prog), need: t.need, done: t.done, chest: d.chest }; }) };
}

// ───────────────────────── 成就/称号面板 ─────────────────────────
function achList(M) {
  return ACHIEVEMENTS.map(a => { const done = !!M.ach[a.id], mask = a.hidden && !done; return { id: a.id, tier: a.tier, done, hidden: a.hidden, n: mask ? '？？？' : a.n, d: mask ? '隐藏成就，做到才会揭晓' : a.d }; });
}
const titleName = M => (TITLES.find(t => t.id === M.title) || TITLES[0]).n;
function setTitle(M, id) { if (M.titles.includes(id)) { M.title = id; return true; } return false; }

// ───────────────────────── 事件入口 ─────────────────────────
function addTokens(M, out, delta, rate, rng) {
  if (!(delta > 0)) return; const st = M.stats, T = META_TUNE.xp;
  st.tokens += delta;
  const xp = (delta / 1000) * T.perKTok * (rate >= T.hotRate ? T.hotMul : 1);
  M.xpFrac = (M.xpFrac || 0) + xp; const w = Math.floor(M.xpFrac); if (w) { M.xpFrac -= w; M.xp += w; out.xp += w; }
  const [a, b] = META_TUNE.night, h = M.cur.hour; if (h >= a && h < b) st.nights++;
  qiChests(M, out, delta, rng);
}
function metaEmit(M, type, p, rng, S) {
  p = p || {}; rng = getRng(M, rng); const out = newOut(), st = M.stats, X = META_TUNE.xp;
  const addXp = n => { M.xp += n; out.xp += n; };
  switch (type) {
    case 'token': addTokens(M, out, p.delta, p.rate || 0, rng); break;
    case 'node_done': st.nodes++; if (p.type) st.nodeTypes[p.type] = 1; M.run.refStreak = 0; addXp(X.node); break;
    case 'battle_end': {
      const kind = p.kind || 'easy'; M.run.refStreak = 0; st.battles++; st.crits += p.crits | 0; st.maxHit = Math.max(st.maxHit, p.maxHit | 0); if (p.skills > 0) st.skills++;
      if (p.win) {
        st.wins++; st.kindWins[kind] = (st.kindWins[kind] | 0) + 1; M.streak.n++; st.bestStreak = Math.max(st.bestStreak, M.streak.n);
        const hr = p.hpLeftRatio == null ? 1 : p.hpLeftRatio; if (hr <= 0.2) st.comebacks++; if (hr >= 0.999) st.perfects++;
        const fw = !!M.daily.date && !M.daily.firstWin; if (fw) M.daily.firstWin = true;
        const sm = streakMul(M.streak.n), mul = sm + (fw ? META_TUNE.daily.firstWinMul - 1 : 0), base = ECON.win[kind] || 0, bonus = Math.round(base * mul) - base;
        out.streak = { n: M.streak.n, mul: sm, firstWin: fw, total: mul }; out.settle = { base, mul, bonus };
        if (bonus > 0) give(M, out, [{ k: 'stone', n: bonus, why: fw ? '每日首胜 ×' + META_TUNE.daily.firstWinMul : '结算加成 ×' + mul.toFixed(1) }], rng);
        const D = META_TUNE.drop, d = D[kind] || D.easy;
        if (st.wins % D.every === 0) give(M, out, [{ k: 'chest', tier: D.milestoneTier, why: `第 ${st.wins} 胜` }], rng);
        else if (rng() < d.p) give(M, out, [{ k: 'chest', tier: chestTier(rng, d.w), why: '战利' }], rng);
        const sp = META_TUNE.spoils[kind]; if (sp && rng() < sp) give(M, out, [{ k: 'cocoon', n: 0, why: '敌方残躯化茧' }], rng);
        addXp(X.win[kind] || 10); if (p.turns > 0 && p.turns <= 3) st.quick = (st.quick | 0) + 1;
      } else {
        st.losses++; const L = META_TUNE.lose, was = M.streak.n; let saved = false;
        if (was > 0) M.streak.n = 0;
        out.streak = { n: M.streak.n, mul: streakMul(M.streak.n), saved, lost: was > 0 && !saved ? was : 0 };
        M.pity.n = Math.min(pityThr(M) - 1, M.pity.n + L.pityStep);
        addXp(X.lose);
        out.notes.push(`败也有得：经验 +${X.lose}、离下一只必出绝品或天品的茧更近一步（距天机 ${pityLeft(M)}）` + (was >= 2 ? `（连胜 ${was} 断了，只失去加成）` : ''));
      }
      break;
    }
    case 'merge': { const s = p.star | 0; st.merges++; st.maxStar = Math.max(st.maxStar, s); M.run.refStreak = 0; addXp(X.merge[Math.min(3, s)] || 10);
      if (s >= 3) give(M, out, [{ k: 'cocoon', n: 1, why: '再炼一转' }], rng); break; }
    case 'cocoon': {
      const t = typeof p.rarity === 'string' ? Math.max(0, RARITY.findIndex(r => r.id === p.rarity)) : p.rarity | 0;
      st.cocoons++; if (t >= 3) st.jue++; if (t === 4) st.tian++; if (M.pity.lastForced && t >= 3) { st.pityHits++; M.pity.lastForced = false; }
      M.recent.push(t); if (M.recent.length > 10) M.recent.shift(); addXp(X.cocoon[t] || 3); break;
    }
    case 'shop_refresh': st.refreshes++; M.run.refStreak++; if (p.nearMiss) st.nearMiss++; if (p.triple) st.triples++; break;
    case 'realm_up': st.realm = Math.max(st.realm, p.realm | 0); addXp(X.realm * (p.realm | 0));
      give(M, out, [{ k: 'cocoon', n: 1, why: '渡劫' }, { k: 'chest', tier: p.realm >= 5 ? 'xuan' : p.realm >= 3 ? 'gold' : 'silver', why: '渡劫' }], rng); break;
    case 'endless_floor': { const f = p.floor | 0; st.endless = Math.max(st.endless, f); addXp(X.floor);
      if (f % 5 === 0) give(M, out, [{ k: 'chest', tier: f >= 25 ? 'gold' : 'silver', why: `无尽 ${f} 层` }], rng); break; }
    case 'share': st.shares++; addXp(X.share); if (!M.daily.shared) { M.daily.shared = true; give(M, out, [{ k: 'chest', tier: 'wood', why: '今日首次分享' }], rng); } break;
    case 'duel_open': st.duels++; addXp(X.duel); break;
    case 'session_start': {
      if (p.hour != null) M.cur.hour = p.hour; rollDay(M, out, p.date, rng);
      const at = p.awayTokens | 0;
      if (at > 0 && (p.awayMs | 0) >= META_TUNE.away.minMs) {
        st.awayMax = Math.max(st.awayMax, at); addTokens(M, out, at, 0, rng);
        const tier = (META_TUNE.away.tiers.find(([n]) => at >= n) || [0, null])[1];
        if (tier) give(M, out, [{ k: 'chest', tier, why: '你离开期间' }], rng);
        out.away = { tokens: at, ms: p.awayMs | 0, tier }; out.notes.push(`你离开期间，蛊吃了 ${at >= 1e6 ? (at / 1e6).toFixed(2) + 'M' : at >= 1e3 ? (at / 1e3).toFixed(1) + 'k' : at} token`);
      }
      break;
    }
    case 'day_tick': if (p.hour != null) M.cur.hour = p.hour; rollDay(M, out, p.date, rng); break;
  }
  dailyProgress(M, out, type, p, rng);
  settle(M, out, rng, S, type, p);
  return out;
}

// ---- src/tutorial.js
// 蛊码 GuCode · 新手引导引擎（会碰 DOM）。
// 用法：startTutorial(TUTORIAL_STEPS, { vsc: !!VSC, onStep(i, step), onDone(skipped) })
// 推进方式：点击高亮目标（step.click 选择器，默认等于 sel），或外部调用 tutorialEvent('名字')（step.evt）。
// 集成方需要在对应时机调用 tutorialEvent：pick（选完本命蛊，其实点击已够）、node_done、battle_end、shop_open、formation_swap。
// 第 4 步（第一场斗蛊）必胜并打出杀招由集成方保证；含 quiet:true 的步骤整层引导隐藏，等事件到了再继续（战斗动画里不挡视线）。

// 步骤表：sel=高亮目标；click=点哪里算推进（可选）；evt=外部事件名（可选，数组也行）；quiet=等待时隐藏；text 可以是函数(opts)
// 「布阵」界面的 selector 是占位（主线在加），集成方请对齐：见 formation 步骤。
const TUTORIAL_STEPS = [
  { id: 'pick', sel: '.starters', click: '.starter', evt: 'pick', text: '三选一，结下你的本命蛊。它是你最先出手的炉口。' },
  { id: 'path', sel: '.nodes', click: '.node', evt: 'path', text: '选一条路。你走的顺序，就是你的流派。' },
  { id: 'feed', sel: '#demo', click: '[data-act="demo"]', evt: 'node_done', text: o => (o.vsc ? '写代码时真实 token 会喂养蛊，节点条走满就结算。你只管写。' : '网页版里点「写代码中」模拟灵流；装了 VS Code 插件，用的就是真实 token。') },
  { id: 'ghost', sel: '[data-act="ghost"]', click: '[data-act="ghost"]', evt: 'ghost_open', text: '节点走完，随时可以斗蛊。点「斗幽灵」。' },
  { id: 'ghostGo', sel: '[data-act="ghostGo"]', click: '[data-act="ghostGo"]', evt: 'battle_start', text: '点第一个「应战」，这一场你会赢，还会打出杀招。' },
  { id: 'battle', sel: null, quiet: true, evt: 'battle_end', text: '' },
  { id: 'shop', sel: '#shop', click: '[data-act="buy"],[data-act="refresh"]', evt: 'shop_open', text: '蛊市开了：买蛊、转市，三只同种同转合炼成高一转。' },
  { id: 'formation', sel: '[data-act="formation"]', click: '[data-act="formation"]', evt: 'formation_swap', text: '拖拽蛊换位。最左的炉口最先出手，站位就是战术。' },
];

const TUT_CSS = `
#tut-layer{position:fixed;inset:0;z-index:1000;pointer-events:none;font-family:var(--sans,system-ui,sans-serif)}
#tut-layer[hidden]{display:none}
#tut-layer .tb{position:fixed;background:rgba(12,10,7,.66);pointer-events:auto}
#tut-layer.nohole .tb{inset:0!important;width:auto!important;height:auto!important;background:rgba(12,10,7,.5);pointer-events:none}
#tut-ring{position:fixed;border-radius:6px;pointer-events:none;box-shadow:0 0 0 2px var(--gold,#d9a441),0 0 14px 2px var(--gold,#d9a441);transition:left .22s ease,top .22s ease,width .22s ease,height .22s ease}
#tut-layer.nohole #tut-ring{display:none}
#tut-bub{position:fixed;z-index:1;width:min(300px,calc(100vw - 24px));box-sizing:border-box;padding:12px 14px 10px;border-radius:6px;pointer-events:auto;background:var(--paper,#e7ddc7);color:var(--ink,#1c1915);border:1px solid var(--line2,rgba(40,32,24,.34));box-shadow:0 6px 22px var(--shadow,rgba(0,0,0,.45));font-size:14px;line-height:1.55;animation:tutIn .22s cubic-bezier(.2,1.3,.4,1)}
#tut-bub .tt{margin:0 0 8px;font-family:var(--kai,serif);font-size:15px}
#tut-bub .tf{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px}
#tut-bub .tn{color:var(--mu,#5b5244);letter-spacing:.06em}
#tut-bub button{font:inherit;cursor:pointer;border:0;background:none;color:var(--mu,#5b5244);padding:4px 2px;text-decoration:underline;text-underline-offset:3px}
#tut-bub button:hover{color:var(--zhu,#a82a1b)}
#tut-bub .ta{position:absolute;width:10px;height:10px;background:inherit;border:inherit;border-right:0;border-bottom:0;transform:rotate(45deg)}
@keyframes tutIn{from{opacity:0;transform:translateY(6px) scale(.97)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){#tut-bub{animation:none}#tut-ring{transition:none}}
`;

let tutSt = null; // 当前引导状态；null 表示没有在跑

function tutStyle() {
  if (document.getElementById('tut-style')) return;
  const s = document.createElement('style'); s.id = 'tut-style'; s.textContent = TUT_CSS; document.head.appendChild(s);
}
function tutRect(sel) {
  if (!sel) return null;
  let r = null;
  document.querySelectorAll(sel).forEach(n => {
    const b = n.getBoundingClientRect(); if (b.width < 2 || b.height < 2) return;
    r = r ? { l: Math.min(r.l, b.left), t: Math.min(r.t, b.top), r: Math.max(r.r, b.right), b: Math.max(r.b, b.bottom) } : { l: b.left, t: b.top, r: b.right, b: b.bottom };
  });
  return r;
}
function tutPlace() {
  const T = tutSt; if (!T) return;
  const step = T.steps[T.i], L = T.layer; if (!step) return;
  if (step.quiet) { L.hidden = true; return; }
  L.hidden = false;
  const rc = tutRect(step.sel), vw = window.innerWidth, vh = window.innerHeight, pad = 6;
  const blk = L.querySelectorAll('.tb'), bub = T.bub, ring = T.ring;
  if (!rc) {
    L.classList.add('nohole'); // 找不到目标（或步骤没有目标）：整层半透明 + 居中气泡，不卡死
    bub.style.left = Math.max(12, (vw - bub.offsetWidth) / 2) + 'px'; bub.style.top = Math.max(12, vh * 0.62) + 'px'; bub.querySelector('.ta').style.display = 'none';
    return;
  }
  L.classList.remove('nohole');
  const x0 = Math.max(0, rc.l - pad), y0 = Math.max(0, rc.t - pad), x1 = Math.min(vw, rc.r + pad), y1 = Math.min(vh, rc.b + pad);
  const set = (e, l, t, w, h) => { e.style.left = l + 'px'; e.style.top = t + 'px'; e.style.width = Math.max(0, w) + 'px'; e.style.height = Math.max(0, h) + 'px'; };
  set(blk[0], 0, 0, vw, y0); set(blk[1], 0, y1, vw, vh - y1); set(blk[2], 0, y0, x0, y1 - y0); set(blk[3], x1, y0, vw - x1, y1 - y0);
  set(ring, x0, y0, x1 - x0, y1 - y0);
  const bw = bub.offsetWidth, bh = bub.offsetHeight, below = vh - y1 >= bh + 20 || y0 < bh + 20;
  const bt = below ? Math.min(vh - bh - 8, y1 + 12) : Math.max(8, y0 - bh - 12), bl = Math.min(vw - bw - 12, Math.max(12, (x0 + x1) / 2 - bw / 2));
  bub.style.left = bl + 'px'; bub.style.top = bt + 'px';
  const ar = bub.querySelector('.ta'); ar.style.display = ''; ar.style.left = Math.min(bw - 22, Math.max(12, (x0 + x1) / 2 - bl - 5)) + 'px';
  if (below) { ar.style.top = '-6px'; ar.style.bottom = ''; ar.style.transform = 'rotate(45deg)'; } else { ar.style.bottom = '-6px'; ar.style.top = ''; ar.style.transform = 'rotate(225deg)'; }
}
function tutRender() {
  const T = tutSt; if (!T) return;
  const step = T.steps[T.i], txt = typeof step.text === 'function' ? step.text(T.opts) : step.text;
  T.bub.querySelector('.tt').textContent = txt; T.bub.querySelector('.tn').textContent = `${T.i + 1} / ${T.steps.length}`;
  T.bub.style.animation = 'none'; void T.bub.offsetWidth; T.bub.style.animation = '';
  tutPlace(); if (T.opts.onStep) T.opts.onStep(T.i, step);
}
function tutGo(i) {
  const T = tutSt; if (!T) return;
  if (i >= T.steps.length) return tutEnd(false);
  T.i = i; tutRender();
}
function tutEnd(skipped) {
  const T = tutSt; if (!T) return; tutSt = null;
  document.removeEventListener('click', T.onClick, true); window.removeEventListener('resize', T.onPos); window.removeEventListener('scroll', T.onPos, true); clearInterval(T.timer);
  T.layer.remove(); if (T.opts.onDone) T.opts.onDone(!!skipped);
}
function startTutorial(steps, opts) {
  opts = opts || {}; if (tutSt) tutEnd(true); tutStyle();
  const layer = document.createElement('div'); layer.id = 'tut-layer';
  layer.innerHTML = '<i class="tb"></i><i class="tb"></i><i class="tb"></i><i class="tb"></i><div id="tut-ring"></div><div id="tut-bub" role="dialog" aria-live="polite"><i class="ta"></i><p class="tt"></p><div class="tf"><span class="tn"></span><button type="button" data-tut="skip">跳过引导</button></div></div>';
  document.body.appendChild(layer);
  const T = tutSt = { steps, i: 0, opts, layer, bub: layer.querySelector('#tut-bub'), ring: layer.querySelector('#tut-ring') };
  T.onPos = () => tutPlace();
  // 点击目标推进：捕获阶段监听，但不拦截——点击照常传给按钮本身，下一帧再换步骤
  T.onClick = e => {
    if (!tutSt) return; const step = steps[T.i], t = e.target;
    if (t.closest && t.closest('#tut-bub')) { if (t.closest('[data-tut="skip"]')) tutEnd(true); return; }
    const sel = step.click || step.sel; if (sel && t.closest && t.closest(sel)) { const k = T.i; setTimeout(() => { if (tutSt && tutSt.i === k) tutGo(k + 1); }, 0); }
  };
  document.addEventListener('click', T.onClick, true); window.addEventListener('resize', T.onPos); window.addEventListener('scroll', T.onPos, true);
  T.timer = setInterval(tutPlace, 400); // 目标是动态渲染的：定时重算位置
  tutGo(0);
  return { stop: () => tutEnd(true), next: () => tutGo(T.i + 1), get index() { return T.i; } };
}
// 外部事件推进：事件名与当前步骤的 evt 一致才前进
function tutorialEvent(name) {
  const T = tutSt; if (!T) return false; const step = T.steps[T.i], ev = step && step.evt;
  if (ev && (Array.isArray(ev) ? ev.includes(name) : ev === name)) { tutGo(T.i + 1); return true; }
  return false;
}
const tutorialActive = () => !!tutSt;
const tutorialSkip = () => tutEnd(true);

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
// 蛊码 GuCode · 界面与流程（渲染层；逻辑都在 core/battle）









const KEY = 'gucode.v1', WILL_MAX = 5, WILL_SEC = 120, WILL_TOK = 60;
const $ = (s, r = document) => r.querySelector(s);
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const setHTML = (n, h) => { if (n._h !== h) { n.innerHTML = h; n._h = h; } };   // 内容没变就不重绘，悬停提示不会被打断
// ---------- 新增界面文案集中在这里（之后统一换成 guide.js 的术语）----------
const TXT = {
  rankBadge: g => `${RANK.ch[rankOf(g)]}转`,
  rankTip: g => `${rankName(g)}：${SP[g.sp].n}生来${RANK.names[baseRank(g.sp)]}${fuseLv(g) ? `，已合炼 ${fuseLv(g)} 次` : ''}。三只同种同转合炼成高一转，同一只最多炼 ${RANK.fuse} 次。`,
  sealed: '境界不够',
  qiTip: '你烧掉的 token 先存成灵气，选了路就灌进节点',
  qiIdle: '选一条路，灵气就灌进去',
  sealedTip: g => `境界不够，驱使不了${RANK.names[rankOf(g)]}的蛊：要到${REALMS[Math.min(5, rankOf(g) - RANK.over)]}才行。现在可以收着、照常长，但不上阵；渡劫晋阶后自动能用。`,
  noWield: '空窍里没有驱使得动的蛊，先招一只低转的蛊。',
  rankIntro: '蛊有转数：凡人驱使一转蛊，每晋一阶多驱使一转。三只同种同转合炼成高一转。',
  sealIntro: g => `境界不够，驱使不了${RANK.names[rankOf(g)]}的蛊：${rankName(g)}先收着不上阵，晋阶后就能用。`,
  shopNote: '三只同种同转合炼成高一转',
  bagRowTip: () => `蛊囊 ${S.bag.length}/${BC()}：开茧和奖励得到的蛊先放这里，拖进空窍才会上阵。蛊囊里的蛊不参战，灵气只吃一半；凑够三只同种同转自动合炼。每升一阶多 ${BAG.perRealm} 格。`,
  bagIntro: '蛊囊：开茧和奖励得到的蛊先放在空窍下面这一行，拖进空窍才会上阵。凑够三只同种同转会自动合炼。',
  bagFuse: '可合炼', bagFuseTip: g => `再得一只${rankName(g)}，三只自动合炼成${RANK.names[Math.min(RANK.max, rankOf(g) + 1)]}`,
  bagCombo: '可成杀招', bagComboTip: (g, c) => `走「炼附」节点时选它炼进主蛊${SP[S.team[0].sp].n}，成杀招【${c.n}】：${c.d}`,
  cocoonBtn: n => { const left = BC() - S.bag.length; return left > 0 ? `开茧 ×${n} · 进蛊囊（剩 ${left} 格）` : `开茧 ×${n} · 蛊囊满了，开出后选去处`; },
  bagHead: `蛊囊里的蛊不参战，灵气只吃一半（${Math.round(BAG.feedMul * 100)}%）。把蛊拖进上面的空窍就上阵，拖下来就收进蛊囊；点开一只可以上阵、收起或出售。`,
  toBag: (g, mode) => `${rankName(g)}进了蛊囊${mode === 'shop' ? '（空窍满了）' : ''}，拖进空窍才会上阵。`,
  canFuse: '可合炼',
  fuseTip: (sp, n) => `再买 ${n} 只即可炼成${RANK.names[baseRank(sp) + 1]}${SP[sp].n}${TXT.mergeWarn(sp, S.realm)}`,
  trio: (sp, c) => `三只一起炼 · ${RANK.names[baseRank(sp) + 1]}${SP[sp].n} · ${c}◈（8 折）`,
  trioTip: '货架上三只同种：一起买打 8 折，买下当场炼成高一转，只占 1 个位置；你已有同种也会接着合炼。',
  cocoonIntro: '蛊茧：开出一只随机的蛊。茧开出的蛊会自动合炼，或者放进蛊囊；满了也不会浪费，可以替换一只、炼化成元石或先存着。',
  cocoonDest: () => { const left = BC() - S.bag.length; return left > 0 ? `开出的蛊将进入蛊囊（剩 ${left} 格），能和已有的同种同转凑成三只就自动合炼` : '蛊囊满了：开出后若能合炼就自动合炼，否则让你选去处（替换 / 炼化 / 暂存），不会浪费'; },
  fullHead: g => `蛊囊满了，${rankName(g)}放哪？`,
  fullSwap: '替换一只：点选要换下的蛊，它按卖价折成元石',
  fullMelt: (g, v) => `炼化：把${rankName(g)}折成 ${v} 元石（按品质，比卖价多五成起）`,
  fullHold: '暂存：放回茧托盘，开出的结果保留，以后再开',
  heldTip: n => `其中 ${n} 个是暂存的，开出结果已定`,
  // 奖励说人话：是什么 · 有什么用 · 放到哪了
  rw: r => { const why = r.why ? `（${r.why}）` : '';
    switch (r.k) {
      case 'stone': return `元石 +${r.n}${why} · 蛊市买蛊、转市用 · 已存入`;
      case 'xp': return `经验 +${r.n}${why} · 攒满升级拿奖励 · 已计入`;
      case 'chest': return `${CHESTS[r.tier] ? CHESTS[r.tier].n : '宝箱'} ×1${why} · 打开当场变成元石、经验，可能有蛊茧 · 在右上「箱」里，点一下就开`;
      case 'cocoon': return `蛊茧 ×1${r.n ? `（至少${RQ(r.n).n}品）` : ''}${why} · 开出一只随机的蛊，茧开出的才有品质 · 在蛊囊旁「开茧」`;
      case 'species': return `新蛊种：${SP[r.id] ? SP[r.id].n : r.id}${why} · 以后蛊市和招蛊会出现它 · 已进蛊池`;
      case 'slot': return `蛊市 +1 格${why} · 每次多一只货可挑 · 已生效`;
      case 'title': { const t = TITLES.find(x => x.id === r.id); return `称号「${t ? t.n : r.id}」${why} · 显示在战帖分享卡上 · 在成就页换上`; }
      case 'charm': return `元石 +${META_TUNE.streak.charmCost}${why} · 已存入`;
    } return ''; },
  // 开打前的奖惩：数字都从表里取
  stakes: (kind, tier) => {
    const k = kind === 'ghost' ? (tier || 'mid') : kind, D = META_TUNE.drop[k], sp = META_TUNE.spoils[k], pc = x => Math.round(x * 100) + '%';
    const hurt = '蛊受轻伤 1 层（写代码约 1 分钟愈合一层）';
    if (kind === 'duel') return { win: D ? `${pc(D.p)} 掉宝箱` : '无', lose: '没有任何损失' };
    const w = [`元石 +${ECON.win[k] || 0}`]; if (kind === 'trib') w.unshift(`晋${REALMS[Math.min(5, S.realm + 1)]}、择一道痕`);
    if (sp) w.push(sp >= 1 ? '必得蛊茧' : `${pc(sp)} 得蛊茧`); if (D) w.push(D.p >= 1 ? '必掉宝箱' : `${pc(D.p)} 掉宝箱`);
    return { win: w.join('，'), lose: `元石 +${ECON.lose}，${hurt}` };
  },
  stakesLine: (kind, tier) => { const x = TXT.stakes(kind, tier); return `赢了：${x.win}｜输了：${x.lose}`; },
  mergeWarn: (sp, realm) => { const r = baseRank(sp) + 1; return r > realm + RANK.over ? `（炼成${RANK.names[r]}后要${REALMS[Math.min(5, r - RANK.over)]}才能驱使）` : ''; },
  // 试玩存档：网页模拟灵流养出来的蛊，对外的坐标码、分享卡、战帖、复盘都带这个标
  trial: '试玩',
  trialShare: '这是网页试玩存档（模拟灵流养的蛊），坐标码、分享卡、战帖和复盘都会标「试玩」。装 VS Code 插件、用真实 token 养的蛊不带这个标。',
  trialFoe: '对方是试玩存档（网页模拟灵流养的蛊，不是真实 token 养出来的）',
  trialText: '【试玩存档】',
  srcLive: '实时 token',
  srcDemo: '模拟灵流 ?',
  srcHead: '灵流从哪来',
  srcFrom: '插件读取本机 Claude Code、Codex 等 AI 工具日志里的 token 用量数字，不读对话和代码内容。插件里只认真实 token，不能切到模拟灵流。',
  srcNone: '现在没有工具在烧 token，灵流为 0。开始写代码就会涨。',
  demoHead: '这里是模拟灵流',
  demoFrom: '网页读不到你电脑上的 AI 用量，这里按真实写代码时的常见流速（每秒约 500～1500 token）模拟。上面的「写代码中 / 停手休息」切换模拟状态。',
  demoTrial: '网页存档是试玩存档：分享出去的坐标码、分享卡、战帖和复盘都会标「试玩」，也不能导入插件。',
  demoInstall: '想用真实 token 养蛊，装 VS Code 插件。插件只读本机 Claude Code、Codex 等工具日志里的用量数字，不读对话和代码内容。',
};
const trialTag = on => on ? `<span class="trialtag">${TXT.trial}</span>` : '';
function stakesHTML(kind, tier) { const x = TXT.stakes(kind, tier); return `<b class="sw">赢了</b>${esc(x.win)}<br><b class="sl">输了</b>${esc(x.lose)}`; }
const fresh = () => ({ v: 2, started: false, name: '', team: [], realm: 0, nodes: 0, compass: [], sel: null, prog: 0, wh: 0, bank: 0, repair: 0, will: 3, willT: 0, willK: 0, total: 0, muts: 0, wins: 0, losses: 0, seed: (Math.random() * 1e9) | 0, step: 0, sound: false, speed: 1, theme: 'auto', mute: false, stone: 5, stoneK: 0, shop: [], pending: null, marks: [], ghosts: null, floor: 1, endless: 0, codex: { sp: [], combo: [] }, healT: 0, calm: false, stats: false, log: [], gains: [], todayKey: '', todayTok: 0, meta: null, tutDone: false, seen: 0, tips: {}, bag: [], held: [], streak: 0, bestStreak: 0, day: '', dayWin: false });
const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const curCap = () => Math.max(slotCap(S.realm), S.team.length), BC = () => Math.max(bagCap(S.realm), S.bag.length);
const buyCost = () => S.marks.includes('shiJing') ? 2 : ECON.buy, refCost = () => S.marks.includes('shiJing') ? 0 : ECON.refresh;
function migrate(s) {
  if (!s || !s.v) return null; if (s.v === 1) { s.v = 2; s.stone = 5 + Math.min(20, s.nodes || 0); s.will = Math.max(s.will || 0, 3); }
  (s.team || []).forEach(g => { if (g.rank == null) g.rank = baseRank(g.sp) + Math.max(0, (g.star || 1) - 1); delete g.star; });   // 星级 → 转数
  return s.v === 2 ? s : null;
}

let S = fresh(), phase = 'yang', rate = 0, hot = false, inBattle = false, booted = false, skip = false, resetArm = 0;
const src = new TokenSource(onTick);
const R = () => makeRng(S.seed + ':' + (S.step++));
const effA = g => Math.max(1, g.atk - (g.wound || 0)), effH = g => Math.max(1, g.hp - (g.wound || 0));
const trChars = tr => (Array.isArray(tr) ? tr : Object.entries(tr)).map(([id, v]) => `<span class="tc" data-tip="${esc(TRAITS[id].n + (v > 1 ? ` ${v}层` : '') + '：' + TRAITS[id].d(v))}">${TRAITS[id].ch}${v > 1 ? `<sup>${v}</sup>` : ''}</span>`).join('');

// ---------- 存档 ----------
let saveT;
function save() {
  if (saveT) return;   // 节流而非防抖：持续有 token 流入时也能按时落盘
  saveT = setTimeout(() => {
    saveT = null; codexScan(); S.seen = Date.now();
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
  <h4>开茧品质（公开概率）</h4><div class="odds-t">${rarityOdds().map(r => `<span class="r${RARITY.findIndex(x => x.id === r.id)}"><i class="rq r${RARITY.findIndex(x => x.id === r.id)}">${r.n}</i>${r.pct}%</span>`).join('')}</div><p class="sm">天机：每 ${META_TUNE.pity.every} 次开茧必出绝或天，新手第一次 ${META_TUNE.pity.firstEvery} 次以内。当前距天机 ${pityLeft(M())}。招蛊、蛊市、夺蛊、宝箱里的茧都算开茧。</p>
  <h4>杀招</h4><ul>${COMBOS.map(c => cx.combo.includes(c.id) ? `<li><b>${c.n}</b>${c.need.map(x => SP[x].n).join(' + ')}：${c.d}</li>` : `<li class="unk"><b>？？？</b>${SP[c.need[0]].n} + ${c.need.slice(1).map(() => '？').join(' + ')}</li>`).join('')}</ul>`);
}
function openPath() {
  const rows = REALMS.map((rn, r) => {
    const newSp = r <= 2 ? POOL_TIERS[r].map(id => SP[id].n).join('、') : '';
    const state = r < S.realm ? 'done' : r === S.realm ? 'now' : '';
    const boss = r < 5 ? `渡${TRIB_NAMES[r]} → 晋${REALMS[r + 1]}` : '无尽劫';
    return `<li class="pr ${state}" data-tip="${esc(`${rn}：空窍 ${slotCap(r)} 格；${REALM_NOTES[r]}。${r < 5 ? `渡${TRIB_NAMES[r]}晋${REALMS[r + 1]}：全体 +1/+1、择一道痕。` : ''}`)}"><span class="pn">${rn}</span><span class="pb"><b>空窍 ${slotCap(r)} 格${newSp ? ' · 蛊市新蛊：' + newSp : ''}</b><small>${REALM_NOTES[r]} · ${boss}</small>${r === S.realm && r < 5 ? `<em>下一劫阵容 · 点开看详情</em>${miniRow(tribTeam(r), 'foe', 'trib')}` : ''}</span></li>`;
  }).join('');
  const L = levelInfo(M()), ul = UNLOCK_ORDER.map(k => { const u = UNLOCKS[k], ok = isUnlocked(M(), S, k); return `<li class="${ok ? 'on' : ''}"><b>${u.n}</b><small>${ok ? u.d : lockHTML(k).replace(/<[^>]+>/g, ' ').replace(u.n, '').trim()}</small></li>`; }).join('');
  sheet(`<h3>修行路 <button class="ib mini-b" data-act="gains">近期所得</button></h3><div class="lvnext"><b>蛊师 ${L.level} 级</b><span class="lvb"><i style="width:${L.need ? (100 * L.cur / L.need).toFixed(0) : 100}%"></i></span><small>${Math.floor(L.cur)}/${L.need} 经验 · 写代码、走节点、斗蛊、开茧、合炼都给经验</small><p>下一级奖励：${L.next.map(rwText).join(' · ') || '已满级'}</p></div>
  <h4>功能点亮</h4><ul class="unls">${ul}</ul>
  <h4>境界</h4><p class="sm">凡人到五转，每渡一劫：全体 +1/+1、择一道痕，空窍与蛊市随境界扩开。</p><ol class="path">${rows}<li class="pr ${S.realm >= 5 ? 'now' : ''}"><span class="pn">无尽</span><span class="pb"><b>无尽劫 · 层数无限</b><small>每层敌阵更强（+${ENDLESS.atkPerFloor} 攻 +${ENDLESS.hpPerFloor} 血/层），最高层写进分享卡。当前最高 ${S.endless} 层</small>${S.realm >= 5 ? `<em>第 ${S.floor} 层阵容 · 点开看详情</em>${miniRow(endlessTeam(S.floor), 'foe', 'endl')}` : ''}</span></li></ol>`);
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
  else if (t.delta > 0 && S.started) S.bank += t.delta, S.total += t.delta;   // 战斗中进账同样存成灵气，没有上限
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
  S.total += d; let rest = d * ledgerFeedMul(S.team[0]), hr = hotAmt || 0;   // 灵根：相合的主蛊吸纳更快（只加节点进度）
  S.stoneK += d * ledgerStoneMul(); while (S.stoneK >= ECON.tokPer * src.unit) { S.stoneK -= ECON.tokPer * src.unit; S.stone++; renderMeta(); renderShop(); }
  if (S.team.some(g => g.wound > 0)) { S.repair += d; while (S.repair >= WOUND.healTok && healOne()) S.repair -= WOUND.healTok; }
  else S.repair = 0;
  let guard = 0;
  while (rest > 0.01 && guard++ < 20) {
    if (S.sel == null) { S.bank += rest; break; }
    const cost = S.compass[S.sel].cost * src.unit, take = Math.min(cost - S.prog, rest), fr = take / rest;
    S.prog += take; S.wh += hr * fr; hr -= hr * fr; rest -= take;
    if (S.prog >= cost - 0.5) resolveNode();
  }
  save();
}
// 愈合一层：伤得最重的先好；有飘字、拨弦和卡片跳动
function healOne() {
  const g = S.team.filter(x => x.wound > 0).sort((a, b) => b.wound - a.wound)[0]; if (!g) return false;
  g.wound--; S.healT = 0; renderSlots(); renderHint(); gain('温养', `${SP[g.sp].n} 伤愈一层（攻血各 +1）`);
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
  if (node.type === 'refine' && S.bag.length && S.team.length >= 2) opts = [S.team[S.team.length - 1].uid, ...S.bag.map(g => g.uid)];   // 炼附也能从蛊囊里挑料
  if (opts && opts.length > 1) {   // 选择题：不弹窗，挂在罗盘位上，等玩家有空再点
    if (node.type === 'devour') opts = opts.map(i => S.team[i].uid);
    S.pending = { node, opts, wu, cost }; renderPhase(); renderHint(); snd('pluck'); save(); tutorialEvent('node_choice'); return;
  }
  finishNode(node, opts ? opts[0] : undefined, wu, cost);
}
function finishNode(node, pick, wu, cost) {
  if (node.type === 'devour' && typeof pick === 'string') pick = S.team.findIndex(g => g.uid === pick);
  if (node.type === 'refine' && typeof pick === 'string') { const bi = S.bag.findIndex(g => g.uid === pick); if (bi >= 0) S.team.push(S.bag.splice(bi, 1)[0]); pick = undefined; }
  S.pending = null;
  if (!nodeOk(node.type, S.team, curCap()) || (node.type === 'devour' && !(pick > 0))) { S.compass = rollCompass(R(), S.team, false, curCap()); renderPhase(); renderHint(); save(); return; }
  const res = applyNode(S.team, node, R(), { wuhuo: wu, pick, cap: curCap() });
  onNode(node); if (node.type === 'summon' && S.team.length) onGain(S.team[S.team.length - 1], 'summon');
  const tg = node.type === 'summon' ? S.team[S.team.length - 1] : S.team[0]; if (tg) tg.fed += cost;
  S.muts += res.muts; S.nodes++; S.will = Math.min(WILL_MAX, S.will + 1); S.stone += ECON.node;
  { const nm = uid => { const g = S.team.find(x => x.uid === uid); return g ? SP[g.sp].n : ''; }, lines = res.fx.map(f => `${nm(f.uid)} ${f.txt}`).filter(x => x.trim());
    lines.forEach(l => gain(NODES[node.type].n, l)); gain(NODES[node.type].n, `+${ECON.node} 元石、意志 +1（走完节点）`);
    popPush(`<div class="toast"><b>${NODES[node.type].n}</b> ${lines.map(esc).join('，')}<br><small>+${ECON.node} 元石 · 意志 +1</small></div>`, 1300, 'side'); }
  S.compass = rollCompass(R(), S.team, false, curCap());
  S.shop = rollWares(S.shop); onRefresh(S.shop, 'node');
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
  if (S.started) { renderSlots(); renderShop(); renderPhase(); renderHint(); renderLevel(); meters(); ledgerShades($('#qiao')); }
}
// ---------- 成长：等级条、箱茧托盘、稀有度 ----------
const M = () => S.meta || (S.meta = metaInit());
const on = k => !S.meta || isUnlocked(S.meta, S, k);
const RQ = t => RARITY[t | 0] || RARITY[0];
const rarTag = g => g && g.rar > 0 ? `<i class="rq r${g.rar}">${RQ(g.rar).n}</i>` : '';
function rwText(r) {
  switch (r.k) {
    case 'stone': return `${r.n}◈`; case 'xp': return `经验 +${r.n}`; case 'chest': return CHESTS[r.tier] ? CHESTS[r.tier].n : '宝箱';
    case 'cocoon': return r.n ? `蛊茧（至少${RQ(r.n).n}）` : '蛊茧'; case 'charm': return '护心符'; case 'species': return `新蛊种：${SP[r.id] ? SP[r.id].n : r.id}`;
    case 'slot': return '蛊市 +1 格'; case 'title': { const t = TITLES.find(x => x.id === r.id); return `称号「${t ? t.n : r.id}」`; }
  }
  return '';
}
function renderLevel() {
  const b = $('#lvbar'); if (!b) return; const L = levelInfo(M()), pct = L.need ? Math.min(100, 100 * L.cur / L.need) : 100;
  b.classList.toggle('near', pct >= 80); b.classList.toggle('big', !!L.big);
  setHTML(b, `<b>蛊师 ${L.level}</b><span class="lvb"><i style="width:${pct.toFixed(1)}%"></i></span><small>${Math.floor(L.cur)}/${L.need}</small><em>${L.next.length ? '下级：' + L.next.map(rwText).join(' ') : '满级'}</em>`);
  renderBagLine(); const t = $('#tray'); if (!t) return; const m = M(), si = streakInfo(m);
  setHTML(t, (si.n >= 2 ? `<span class="flame" data-tip="${si.n} 连胜：胜场结算元石 ×${si.mul.toFixed(1)}。断连只失去加成，不扣已有的东西。">焰 ${si.n}</span>` : '') 
    + (m.chests.length ? `<button class="tb chest" data-act="chest" data-tip="${esc('待开宝箱：' + m.chests.map(k => CHESTS[k].n).join('、') + '\n点一下开第一个：元石、经验，金箱玄箱可能有蛊茧')}">箱 <b>${m.chests.length}</b></button>` : '') + ((m.cocoons.length || S.held.length) && on('cocoon') ? `<button class="tb coc" data-act="cocoon" data-tip="${esc('蛊茧 ' + (m.cocoons.length + S.held.length) + ' 个' + (S.held.length ? '（' + TXT.heldTip(S.held.length) + '）' : '') + '：点一下开出一只蛊，品质凡良珍绝天。茧不过期。\n' + TXT.cocoonDest() + '\n距天机 ' + pityLeft(m) + ' 次（必出绝或天）')}">茧 <b>${m.cocoons.length + S.held.length}</b></button>` : ''));
}
// 每次得蛊都开茧：掷稀有度（带天机），属性与额外词条随稀有度
function gainRar(g, from) {
  if (g.rar !== undefined) return;
  if (from === 'starter') { g.rar = 0; return; }
  const t = rollRarity(M(), R()); applyRarity(g, t, R());
  handleOut(metaEmit(M(), 'cocoon', { rarity: t }, R(), S)); revealPop(g, from);
}
function revealPop(g, from) {
  gain('开茧', `${RQ(g.rar).n}·${SP[g.sp].n} 攻 ${g.atk} 血 ${g.hp}${from === 'cocoon' ? '' : ' → 空窍'}（${{ summon: '招蛊', shop: '蛊市', loot: '夺蛊', cocoon: '蛊茧' }[from] || from}）`);
  const r = RQ(g.rar), big = g.rar >= 3, src = { summon: '招蛊', shop: '蛊市', loot: '夺蛊', cocoon: '开茧' }[from] || '';
  popPush(`<div class="reveal r${g.rar}"><span class="art">${guSVG(g.sp)}</span><div><small>${src} · 开茧</small><b><i class="rq r${g.rar}">${r.n}</i>${SP[g.sp].n}</b><span class="st"><i class="a">${g.atk}</i><i class="h">${g.hp}</i></span><small>距天机 ${pityLeft(M())}</small></div></div>`, big ? 2000 : 1100, big ? 'big' : 'side');
  if (big) { snd('combo'); shake(4); } else snd('coin');
}
// ---------- 近期所得：每条奖励写明得到了什么、加到了哪里（最近 50 条，可回看）----------
function gain(src, txt) { const g = S.gains || (S.gains = []); g.push({ t: Date.now(), src, txt }); if (g.length > 50) g.splice(0, g.length - 50); }
function rwLine(r) { return TXT.rw(r) || rwText(r); }
function openGains() {
  const g = (S.gains || []).slice().reverse(), hm = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  sheet(`<h3>近期所得</h3><p class="sm">最近 ${g.length} 条奖励，错过的弹层都在这里。</p><ul class="gains">${g.map(x => `<li><time>${hm(x.t)}</time><span class="gs">${esc(x.src)}</span><span>${esc(x.txt)}</span></li>`).join('') || '<li>还没有记录</li>'}</ul>`, 'gainsheet', true);
}

// ---------- 临时弹层队列（fx 组件到位后替换）：升级 → 成就 → 宝箱 → 解锁 → 小字 ----------
const POPQ = []; let popBusy = false, heldOuts = [];
// 新系统第一次出现时的一句说明（每个只说一次）
function firstTip(k, txt) { const t = S.tips || (S.tips = {}); if (t[k]) return; t[k] = 1; popPush(`<div class="toast tipcard"><b>初见</b> ${esc(txt)}</div>`, 3200, 'side'); save(); }
function popPush(html, ms, kind = 'side') { POPQ.push({ html, ms, kind }); if (!popBusy) popRun(); }
async function popRun() {
  popBusy = true;
  while (POPQ.length) { while (inBattle) await sleep(300); const p = POPQ.shift(), n = el(`<div class="pop ${p.kind}" data-act="popx">${p.html}</div>`); document.body.appendChild(n); await sleep(POPQ.length > 3 ? Math.min(p.ms, 600) : p.ms); n.classList.add('out'); setTimeout(() => n.remove(), 280); await sleep(140); }
  popBusy = false;
}
// meta 的返回值：元石入账（只有 stone 要 ui 自己加），其余只展示；战斗中先攒着，回空窍再放
function handleOut(out, skip = () => false) {
  if (!out) return;
  out.rewards.forEach(r => { if (r.k === 'stone' && !skip(r)) S.stone += r.n; if (!skip(r) && r.k !== 'xp' || r.k === 'xp' && r.n >= 10) gain(r.why || '奖励', rwLine(r)); });
  out.levelUps.forEach(l => gain('升级', `蛊师升到 ${l.level} 级`)); out.achievements.forEach(a => gain('成就', `成就「${a.n}」（${ACH_TIER[a.tier].n}）`)); out.unlocks.forEach(k => gain('点亮', `解锁：${UNLOCKS[k].n}`));
  const any = out.levelUps.length || out.achievements.length || out.chests.length || out.unlocks.length || out.rewards.length || out.notes.length;
  if (!any) return;
  if (inBattle) { heldOuts.push(out); renderLevel(); return; }
  showOut(out); renderLevel(); renderMeta();
  if (out.unlocks.length && S.started) setTimeout(() => { renderAll(); }, 50);
}
function showOut(out) {
  out.levelUps.forEach(l => { popPush(`<div class="lvup"><small>蛊师升级 · 点一下关掉</small><b>${l.level} 级</b><ul>${l.rewards.map(r => `<li>${esc(rwLine({ ...r, why: '' }))}</li>`).join('')}</ul></div>`, l.big ? 3200 : 2600, l.big ? 'big' : 'center'); snd('win'); });
  out.achievements.forEach(a => { popPush(`<div class="achc t-${a.tier}"><span class="am">${ACH_TIER[a.tier].n}</span><div><b>${esc(a.n)}</b><small>${esc(a.d)}</small><em>${a.rewards.map(r => rwLine({ ...r, why: '' })).join('<br>')}</em></div></div>`, a.tier === 'gold' ? 2200 : 1500, a.tier === 'gold' ? 'big' : 'side'); snd('coins'); });
  const ch = out.rewards.filter(r => r.k === 'chest' && !/升级|成就/.test(r.why || ''));
  const cc = out.rewards.filter(r => r.k === 'cocoon' && !/升级|成就/.test(r.why || ''));
  if (ch.length || cc.length) popPush(`<div class="toast">${[...ch, ...cc].map(r => esc(rwLine(r))).join('<br>')}</div>`, 1800, 'side');
  out.unlocks.forEach(k => { const u = UNLOCKS[k]; popPush(`<div class="unl"><small>新功能点亮</small><b>${u.n}</b><p>${u.d}</p></div>`, 1800, 'center'); snd('glitch'); });
  const sts = out.rewards.filter(r => r.k === 'stone' && !/升级|成就/.test(r.why || '')), st = sts.reduce((a, r) => a + r.n, 0);
  if (st && !inBattle) { stoneFloat(st); popPush(`<div class="toast">${sts.map(r => esc(rwLine(r))).join('<br>')}</div>`, 1100, 'side'); }
  out.notes.filter(n => !/^败也有得/.test(n)).forEach(n => popPush(`<div class="toast">${esc(n)}</div>`, 1300, 'side'));
}
function stoneFloat(n) { const m = $('#qmeta .stone'); if (!m) return; const f = el(`<span class="sfloat">+${n}◈</span>`); m.appendChild(f); setTimeout(() => f.remove(), 1200); snd('coin'); }
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
  <div class="lvrow"><button class="lvbar" id="lvbar" data-act="path" data-tip-fn="level"></button><span class="tray" id="tray"></span></div>
  <section class="vein"><canvas id="vein"></canvas><div class="vread"><div class="vrate" data-tip-fn="rate"><b id="rateTxt">0</b><span class="vu" id="rateU"></span><span class="vlab">灵流</span><span id="fireTag" class="fire"></span></div><div class="vtot"><span id="totTxt"></span><button class="chip" data-act="src" id="srcTag"></button></div></div><div class="vsrc" id="srcRates" hidden></div></section>
  <div class="seg" id="demo">${[['coding', '写代码中'], ['rest', '停手休息']].map(([m, t]) => `<button data-act="demo" data-m="${m}">${t}</button>`).join('')}</div>
  <section class="qiao" id="qiao"><div class="qhead"><span class="lbl">空窍 <small>左为炉口 · 拖动换位</small></span><span id="qmeta"></span></div><div class="slots" id="slots"></div><div class="bagline" id="bagline"></div><p class="marks" id="marks" data-act="marksInfo"></p><p class="hint" id="hint"></p></section>
  <section class="shop" id="shop"></section><section id="phase" class="phase"></section>
  <footer class="foot"><button data-act="duelInput">粘贴坐标码应战</button><button data-act="path">修行路</button><button data-act="codex">蛊典</button>${on('daily') ? '<button data-act="daily">日课</button>' : ''}${on('ach') ? '<button data-act="achs">成就</button>' : ''}<button data-act="reset" id="bReset">重开一局</button></footer>`;
}
function guCard(g, i, rc = '') {
  const sk = skillOf(g), seal = !canWield(g, S.realm);
  return `<button class="gu${seal ? ' sealed' : ''}${g.wound ? ' hurt' : ''}${i === 0 ? ' lead' : ''}${g.rar > 0 ? ' r' + g.rar : ''}" data-act="gu" data-i="${i}" data-uid="${g.uid}" data-drag="${i}" data-tip-fn="gu">${rc ? `<span class="rcv">${rc}</span>` : ''}
  <span class="art">${guSVG(g.sp)}</span><span class="rk rk${rankOf(g)}">${TXT.rankBadge(g)}</span>${sk ? `<span class="mseal${sk.named ? '' : ' pale'}">${esc(sk.n[0])}</span>` : ''}${g.q.length ? `<span class="qk">${g.q.map(q => QUIRKS[q].n[0]).join('')}</span>` : ''}
  <span class="nm">${rarTag(g)}${SP[g.sp].n}</span><span class="st"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i></span>
  <span class="tr">${trChars(g.tr)}${g.att.map(a => `<i class="att">${SP[a].ab}</i>`).join('')}</span>${g.wound ? `<span class="wd">伤${g.wound}</span>` : ''}${seal ? `<span class="sealtag">${TXT.sealed}</span>` : ''}</button>`;
}
function renderSlots() {
  const box = $('#slots'); if (!box) return;
  const cap = curCap(), rc = rcvChars(S.team), n = Math.min(SLOTS, Math.max(S.team.length, cap + 1)); let h = '';   // 只多露一格「下一阶开」
  for (let i = 0; i < n; i++) {
    if (S.team[i]) h += `<div class="slot">${guCard(S.team[i], i, rc[i])}</div>`;
    else if (i < cap) h += `<div class="slot"><span class="empty" data-drag="${i}">空</span></div>`;
    else { const r = SLOT_BY_REALM.findIndex(c => c > i); h += `<div class="slot"><span class="empty lock">锁<small>${REALMS[r] || ''}开</small></span></div>`; }
  }
  box.innerHTML = h; box.dataset.sort = 'team'; box.dataset.group = 'main'; box.style.setProperty('--cn', n <= 5 ? n : Math.ceil(n / 2)); box.style.setProperty('--cw', n); box.classList.toggle('two', n > 5); renderMeta();
  renderBagLine();
  const rl = $('#realm'); if (rl) rl.textContent = REALMS[S.realm];
  const mk = $('#marks'); if (mk) mk.innerHTML = S.marks.length ? '道痕 · ' + S.marks.map(k => `<span class="tc" data-tip="${esc(MARKS[k].n + '：' + MARKS[k].d)}">${MARKS[k].n}</span>`).join(' · ') : '';
}
function renderMeta() {
  const m = $('#qmeta'); if (!m) return;
  const wd = S.team.reduce((a, g) => a + (g.wound || 0), 0);
  setHTML(m, `<b class="stone" data-tip="元石：买蛊、转市。来源：写代码的 token、走完节点、斗蛊结算、卖蛊、宝箱与升级。">◈ ${S.stone}</b> 元石 · 意志 <b class="will" data-tip="意志：每场斗蛊耗 1 点，上限 ${WILL_MAX}。每 ${WILL_SEC / 60} 分钟或写代码都会回，走完节点也回 1 点。">${'◆'.repeat(S.will)}${'◇'.repeat(Math.max(0, WILL_MAX - S.will))}</b>${wd ? ` · <span class="heal" title="写代码约 1 分钟愈合一层">温养<span class="hbar"><i id="healBar" style="width:${(100 * healPct()).toFixed(0)}%"></i></span></span>` : ''}`);
}
const shopPool = () => [...new Set([...poolFor(S.realm), ...metaPool(M()).filter(id => SP[id])])].filter(id => baseRank(id) <= S.realm + RANK.over);   // 只卖驱使得动的
const shopN = () => 3 + Math.min(2, M().shopSlots | 0);
const owned = sp => sameRank([...S.team, ...S.bag], sp, baseRank(sp));   // 已有几只同种原生转数的（空窍 + 蛊囊）
// 货架上三只同种：一起买打折，买下当场合炼
function trioSp() { const c = {}; S.shop.forEach(w => { if (!w.sold) c[w.sp] = (c[w.sp] || 0) + 1; }); return Object.keys(c).find(k => c[k] >= 3); }
const trioCost = () => Math.round(3 * buyCost() * BAG.trioOff);
function trioHTML() { const sp = trioSp(); if (!sp) return ''; const c = trioCost(), ok = S.stone >= c && trioPlan(sp); return `<button class="zhu trio" data-act="trio" data-sp="${sp}" data-tip="${esc(TXT.trioTip)}"${ok ? '' : ' disabled'}>${esc(TXT.trio(sp, c))}</button>`; }
function trioPlan(sp) {   // 先在副本上试放三只，放得下才允许
  const t = JSON.parse(JSON.stringify(S.team)), b = JSON.parse(JSON.stringify(S.bag)), cap = curCap();
  for (let k = 0; k < 3; k++) { const g = { ...newGu(sp) }; if (!canTake(t, b, g, cap, BC(), 'shop')) return false; placeGu(t, b, g, cap, [], null, BC(), 'shop'); }
  return true;
}
function rollWares(old = []) {
  const rig = rigShop(M(), R(), shopPool()); if (rig) return rig.map(sp => ({ sp, frozen: false }));
  const r = R(), pool = shopPool(); return Array.from({ length: shopN() }, (_, i) => (old[i] && old[i].frozen && !old[i].sold) ? old[i] : { sp: r.pick(pool), frozen: false });
}
const freeRef = () => (M().stats.refreshes | 0) < META_TUNE.newbie.freeRefresh;
function renderShop() {
  const box = $('#shop'); if (!box || !S.started) return;
  if (!on('shop')) { box.innerHTML = lockHTML('shop'); return; }
  if (!S.shop || S.shop.length !== shopN()) { S.shop = rollWares(S.shop || []); onRefresh(S.shop, 'init'); }
  const cost = buyCost(), rc = refCost(), cap = curCap();
  box.innerHTML = `<div class="ch"><span class="lbl">蛊市 <small>${REALMS[S.realm]}档 · ${shopPool().length} 种 · ${TXT.shopNote}</small></span><button class="ib mini-b" data-act="refresh"${S.stone >= rc || freeRef() ? '' : ' disabled'}>转市${freeRef() ? ' 免费' : rc ? ' ' + rc + '◈' : ''}</button></div>
  <div class="wares n${S.shop.length}">${S.shop.map((w, i) => {
    const sp = SP[w.sp], own = owned(w.sp), shelf = S.shop.filter(x => x.sp === w.sp && !x.sold).length, merge = own >= 2, fusable = !w.sold && own + shelf >= 3, can = canBuy(S.team, w.sp, cap, S.bag, BC()), ok = !w.sold && S.stone >= cost && can;
    const tag = w.sold ? '已购' : !can ? '空窍和蛊囊都满了' : (merge ? '合炼 ' : '') + cost + '◈';
    return `<div class="ware${w.frozen ? ' frozen' : ''}${w.sold ? ' sold' : ''}${fusable ? ' merge' : ''}${ok ? '' : ' cant'}"><button class="wbuy" data-act="ware" data-i="${i}" data-tip-fn="ware"${w.sold ? ' disabled' : ''}>${w.frozen ? '<span class="fz">冻</span>' : ''}${fusable ? `<span class="fu">${TXT.canFuse}</span>` : ''}<span class="art">${guSVG(w.sp)}</span><b><small class="rkt">${RANK.names[baseRank(w.sp)]}</small>${sp.n}</b><span class="st"><i class="a">${sp.atk}</i><i class="h">${sp.hp}</i></span><span class="wt">${spTraits(w.sp).map(([t, v]) => TRAITS[t].n + (v > 1 ? v : '')).join(' · ')}</span><span class="price">${tag}</span></button></div>`;
  }).join('')}</div>${trioHTML()}`;
}
const FOE = {};   // 面板里出现过的阵容，按 key 存着供「点开详情」用
function rcvChars(t) { const out = t.map(() => ''); posLinks(t).forEach(l => { if (l.to >= 0 && l.to !== l.from && !out[l.to].includes(TRAITS[l.id].ch)) out[l.to] += TRAITS[l.id].ch; }); return out; }
function miniRow(t, cls = '', key = '', drag = false) {
  if (key) FOE[key] = t;
  const rc = rcvChars(t), tag = key ? 'button' : 'div';
  return `<div class="mini ${cls}"${drag ? ` data-sort="${key}"` : ''}>${t.map((g, i) => { const sk = skillOf(g); return `<${tag} class="mg${g.boss ? ' boss' : ''}"${key ? ` data-act="peek" data-k="${key}" data-i="${i}" data-tip-fn="mg"` : ''}${drag ? ` data-drag="${i}"` : ''}>${rc[i] ? `<span class="rcv">${rc[i]}</span>` : ''}<span class="art">${guSVG(g.sp)}</span><b>${rarTag(g)}${g.boss ? '劫·' : ''}<small class="rkt">${RANK.names[rankOf(g)]}</small>${SP[g.sp].n}</b><span class="st"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i></span>${sk && sk.named ? `<em class="cs">${esc(sk.n)}</em>` : `<span class="tr">${trChars(g.tr)}</span>`}</${tag}>`; }).join('')}</div>`;
}
function choiceHTML(p) {
  const L = S.team[0], t = p.node.type;
  const head = { mutate: `突变 · ${L ? SP[L.sp].n : ''} 择一词条`, summon: '招蛊 · 三选一', devour: `吞噬 · ${L ? SP[L.sp].n : ''} 吞下哪一只`, refine: `炼附 · 选一只炼成${L ? SP[L.sp].n : ''}的附蛊` }[t];
  const items = p.opts.map((o, i) => {
    if (t === 'mutate') { const e = L && L.tr.find(x => x[0] === o), v = e ? e[1] + 1 : 1; return `<button class="node opt" data-act="choose" data-i="${i}"><span class="nseal">${TRAITS[o].ch}</span><span class="nbody"><b>${TRAITS[o].n}${e ? ` · 升至 ${v} 层` : ''}</b><small>${TRAITS[o].trig} · ${TRAITS[o].d(v)}</small></span></button>`; }
    if (t === 'summon') { const sp = SP[o]; return `<button class="node opt" data-act="choose" data-i="${i}"><span class="oart">${guSVG(o)}</span><span class="nbody"><b>${sp.n} <i class="a">${sp.atk}</i> <i class="h">${sp.hp}</i></b><small>${spTraits(o).map(([t, v]) => TRAITS[t].d(v)).join('；')} · ${sp.lore}</small></span></button>`; }
    if (t === 'refine') { const inBag = S.bag.find(x => x.uid === o), g = inBag || S.team.find(x => x.uid === o); if (!g || !L) return ''; const c = comboOf({ sp: L.sp, att: [...L.att, g.sp] }), nc = c && c !== comboOf(L); return `<button class="node opt" data-act="choose" data-i="${i}"><span class="oart">${guSVG(g.sp)}</span><span class="nbody"><b>炼入 ${esc(rankName(g))}${inBag ? ' <small>（蛊囊）</small>' : ' <small>（空窍最右）</small>'}</b><small>${L ? SP[L.sp].n : ''}得其四成攻血${nc ? ` → 成杀招【${esc(c.n)}】` : ''}</small></span></button>`; }
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
      return `把 ${Z} 炼为 ${L} 的附蛊${tip}${S.bag.length ? '（也可从蛊囊挑料）' : ''}`;
    }
  }
  return '';
}
function renderPhase() {
  const box = $('#phase'); if (!box) return;
  if (S.compass.length === 0 || S.compass.every(n => !nodeOk(n.type, S.team, curCap()))) { S.compass = rollCompass(R(), S.team, false, curCap()); S.sel = null; S.prog = 0; }
  const canFight = S.will > 0, nextWill = Math.max(0, Math.ceil(WILL_SEC - S.willT / 1000));
  const tribLabel = S.realm < 5 ? `渡${TRIB_NAMES[Math.min(S.realm, 4)]}` : '五转大成';
  box.innerHTML = (S.pending ? choiceHTML(S.pending) : `<div class="compass"><div class="ch"><span class="lbl">罗盘 · 三岔</span></div>${zyHTML()}
  <div class="nodes">${S.compass.map((n, i) => { const ok = nodeOk(n.type, S.team, curCap()), cur = S.sel === i; return `<button class="node${cur ? ' on' : ''}" data-act="node" data-i="${i}" data-tip="${esc(NODES[n.type].n + '：' + NODES[n.type].d + '\n这一次：' + nodeDesc(n) + '\n需要 ' + fmtTok(n.cost * src.unit) + ' 灵流；走完还得 ' + ECON.node + ' 元石、回 1 点意志、蛊师经验')}"${ok ? '' : ' disabled'}><span class="nseal">${NODES[n.type].ch}</span><span class="nbody"><b>${NODES[n.type].n}</b><small>${esc(nodeDesc(n))}</small></span><span class="ncost">${fmtTok(n.cost * src.unit)}</span><span class="nbar"><i></i></span></button>`; }).join('')}</div></div>`) + `
  ${!on('battle') ? lockHTML('battle') : `<div class="gate${canFight ? ' open' : ''}"><div class="gh"><span class="lbl">斗蛊</span><span class="gsub">${canFight ? `每场耗 1 点意志 · 余 ${S.will}` : `意志已尽 · 约 ${Math.ceil(nextWill / 60)} 分钟回 1 点，养蛊也会回`}</span></div>
  <div class="gbtns">${S.realm < 5 ? `<button class="gbtn" data-act="trib"${canFight ? '' : ' disabled'}><b>${tribLabel}</b><small>${REALMS[S.realm + 1]}境 Boss · 胜则升阶</small><em class="stk">${esc(TXT.stakesLine('trib'))}</em></button>` : `<button class="gbtn" data-act="endless"${canFight ? '' : ' disabled'}><b>无尽劫 · 第 ${S.floor} 层</b><small>最高 ${S.endless} 层 · 逐层变强</small><em class="stk">${esc(TXT.stakesLine('endless'))}</em></button>`}<button class="gbtn" data-act="ghost"${canFight ? '' : ' disabled'}><b>斗幽灵</b><small>易 · 中 · 难 任选</small><em class="stk">赢了：元石 +${ECON.win.easy}～${ECON.win.hard}，可能得蛊茧、宝箱｜输了：元石 +${ECON.lose}，蛊受轻伤</em></button></div></div>`}`;
  meters();
}
// 灵气存量：烧掉的 token 先存成灵气（没有上限），选了路就灌进节点。只显示一行数字，不画进度条
function zyHTML() { return `<div class="zy" id="zy" data-tip="${esc(TXT.qiTip)}"><span class="zyl">灵气</span><b id="zyN"></b><small id="zyT"></small></div>`; }
function zyUpdate() {
  const n = $('#zyN'); if (!n) return; n.textContent = fmtTok(S.bank);
  $('#zy').classList.toggle('flow', rate > 0 && S.sel != null); $('#zyT').textContent = S.sel == null && !S.pending && S.bank > 0 ? TXT.qiIdle : '';
}
function pourFx() { const z = $('#zy'); if (!z) return; z.classList.remove('pour'); void z.offsetWidth; z.classList.add('pour'); setTimeout(() => z.classList.remove('pour'), 1000); }
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
  const st = $('#srcTag'); st.textContent = VSC ? TXT.srcLive : TXT.srcDemo; st.classList.toggle('demo', !VSC);
  const dm = $('#demo'); dm.hidden = !!VSC || src.mode !== 'demo'; dm.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === src.demo));   // 插件里永远不显示模拟灵流开关
  zyUpdate();
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
  const n = foe.name || '无名蛊师'; return { team: foe.team, name: n, title: '战帖 · ' + n, realm: foe.realm || 0, marks: foe.marks || [], trial: !!foe.trial };
}
const fielded = () => S.team.every(g => canWield(g, S.realm)) ? S.team : S.team.filter(g => canWield(g, S.realm));   // 境界不够驱使的不上阵
const myTeamFor = kind => (kind === 'duel' && (!S.started || !S.team.length)) ? starterTeam() : fielded();
const myMarksFor = kind => kind === 'duel' && !S.started ? [] : S.marks;
// ---------- 布阵：开战前看清敌阵、拖动调整站位、实时胜算 ----------
let PREP = null, oddsJob = 0;
function prep(kind, foe) {
  if (inBattle || (kind === 'trib' && S.realm >= 5) || (kind !== 'duel' && S.will <= 0)) return;
  const mine = myTeamFor(kind); if (!mine.length) { popPush(`<div class="toast">${TXT.noWield}</div>`, 1600, 'side'); return; }
  const f = foeOf(kind, foe); PREP = { kind, foe, f, mine, last: null };
  renderPrep(true);
}
function renderPrep(open) {
  if (!PREP) return; const { f, kind } = PREP, mine = PREP.mine, canSort = mine === S.team && S.team.length > 1;
  const sum = t => `<span class="fsum">总 <i class="a">${t.reduce((a, g) => a + effA(g), 0)}</i><i class="h">${t.reduce((a, g) => a + effH(g), 0)}</i></span>`;
  const html = `<p class="eyebrow">布阵</p><h3>${esc(f.title)}</h3>
  <div class="fhead"><span class="lbl">敌阵 <small>点开看词条</small></span>${sum(f.team)}</div>${miniRow(f.team, 'foe', 'foe')}
  <div class="odds"><span class="olab">胜算约</span><b id="oddsN">…</b><span class="obar"><i id="oddsBar"></i></span><small id="oddsD">用同一套斗蛊规则推演 200 场</small></div>
  <div class="fhead"><span class="lbl">我阵 <small>${canSort ? '拖动换位 · 左为炉口，先上场' : '左为炉口，先上场'}</small></span>${sum(mine)}</div>${miniRow(mine, 'me', 'mine', canSort)}
  <p class="stakes">${stakesHTML(kind, PREP.foe && PREP.foe.tier)}</p>
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
  const ca = encodeTeam(mine, { name: S.name || '无名蛊师', realm: S.realm, marks: myMarksFor(kind), trial: S.trial }), cb = encodeTeam(enemy, { name: ename, realm: erealm, marks: F.marks, trial: F.trial });
  const seed = kind === 'duel' ? hashStr(ca + '|' + cb).toString(36) : ((S.seed ^ Math.imul(++S.step, 2654435761)) >>> 0).toString(36);
  let A = decodeTeam(ca), Bt = decodeTeam(cb), res = battle(A.team, Bt.team, 'r:' + seed, A.marks, Bt.marks), rp = [ca, cb, seed, kind[0]].join('.'), ttl = title;
  if (kind === 'ghost' && tutorialActive() && M().stats.battles === 0) { const t = tutorialFight(mine, enemy, A.marks); if (t) { ({ A, B: Bt, res, rp } = t); ttl = title + ' · 试炼'; } }
  if (kind !== 'duel') S.will--;
  (A.team || []).forEach((g, i) => { const r = res.roster['a' + i]; if (r && mine[i]) r.rar = mine[i].rar; });
  save(); playBattle({ kind, title: ttl, res, enemy, foe, tier: foe && foe.tier, A, B: Bt, replay: rp });
}
// 新手第一场：本命蛊借来附蛊凑成杀招、对手减弱，挑一个「赢且打出杀招」的种子
function tutorialFight(mine, enemy, marks) {
  const L = mine[0]; if (!L) return null;
  const c = ['sanzhu', 'jinjia', 'liaoyuan', 'pozhen', 'wangu', 'tuoke', 'fenshen', 'jingji', 'shishan', 'duopo'].map(id => COMBOS.find(x => x.id === id)).find(x => x && x.need.includes(L.sp));
  const t = mine.map(g => ({ ...g, tr: g.tr.map(x => [...x]), q: [...g.q], att: [...g.att], wound: 0 }));
  if (c && !comboOf(t[0])) t[0].att = c.need.filter(x => x !== L.sp).slice(0, MAXATT);
  const e = enemy.map(g => ({ ...g, atk: Math.max(1, Math.ceil(g.atk * 0.5)), hp: Math.max(1, Math.ceil(g.hp * 0.6)), tr: g.tr.map(x => [...x]), q: [], att: [] }));
  const ca = encodeTeam(t, { name: S.name || '无名蛊师', realm: S.realm, marks, trial: S.trial }), cb = encodeTeam(e, { name: '幽灵', realm: S.realm }), A = decodeTeam(ca), B = decodeTeam(cb);
  let pick = null;
  for (let k = 0; k < 60; k++) {
    const seed = 'tut' + k, res = battle(A.team, B.team, 'r:' + seed, A.marks, B.marks);
    if (res.winner !== 'A') continue; const sk = res.log.some(ev => ev.t === 'combo' && res.roster[ev.uid] && res.roster[ev.uid].side === 0);
    pick = { A, B, res, rp: [ca, cb, seed, 'g'].join('.') }; if (sk) break;
  }
  return pick;
}
function parseReplay(text) {
  const m = String(text || '').match(/r=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([0-9a-z]+)(?:\.([tgd]))?/); if (!m) return null;
  const A = decodeTeam(m[1]), B = decodeTeam(m[2]); if (!A || !B) return null;
  return { A, B, seed: m[3], kind: m[4] || 'd', replay: [m[1], m[2], m[3], m[4] || 'd'].join('.') };
}
function openReplay(rp) {
  window.__guRp = rp;
  const row = t => `<div class="mini">${t.map(g => { const sk = skillOf(g); return `<div class="mg"><span class="art">${guSVG(g.sp)}</span><b>${SP[g.sp].n}</b><span class="st"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i></span>${sk && sk.named ? `<em class="cs">${esc(sk.n)}</em>` : `<span class="tr">${trChars(g.tr)}</span>`}</div>`; }).join('')}</div>`;
  sheet(`<p class="eyebrow">复盘</p><h3 class="duelh">${esc(rp.B.name || '无名')}${trialTag(rp.B.trial)} 对 ${esc(rp.A.name || '无名')}${trialTag(rp.A.trial)}</h3><p class="sm">同一组阵容、同一颗种子，重放的是一模一样的那一场。</p>${row(rp.B.team)}<p class="vsline">— 对 —</p>${row(rp.A.team)}<div class="row2"><button class="zhu big" data-act="replayGo">观看复盘</button></div>`);
}
function openLinkText(text) {
  const rp = parseReplay(text); if (rp) { openReplay(rp); return true; }
  const foe = decodeTeam(text); if (foe) { openDuel(foe); return true; }
  return false;
}
function replayURL(link) { return (/^https?:/.test(location.protocol) ? location.origin + location.pathname : SHARE_BASE) + '#r=' + link; }
function buHTML(uid, r) {
  return `<div class="bu${r.side ? ' foe' : ''}${r.boss ? ' boss' : ''}" data-uid="${uid}"><div class="bart">${guSVG(r.sp)}</div><div class="binfo"><b class="bnm">${r.rar > 0 ? `<i class="rq r${r.rar}">${RQ(r.rar).n}</i>` : ''}${esc(r.name)}</b><span class="bst"><i class="a"></i><i class="h"></i><i class="s" hidden></i></span><span class="btr">${trChars(r.tr)}</span>${r.combo ? `<em class="cs">${esc(r.combo)}</em>` : ''}</div></div>`;
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
  const ov = el(`<div class="battle" id="battle"><div class="bbar"><span class="btitle">${esc(B.title)}${trialTag((B.A && B.A.trial) || (B.B && B.B.trial))}</span><span class="bturn" id="bturn">开战</span><button class="ib" data-act="speed" id="bspd">${S.speed}×</button><button class="ib" data-act="skip">跳过</button></div>
  <div class="arena" id="arena"><div class="side sb" id="sideB"></div><div class="mid"><i></i><span>斗</span><i></i></div><div class="side sa" id="sideA"></div></div><div class="blog" id="blog"></div></div>`);
  ov.style.setProperty('--nu', Math.max(10, (B.A.team || []).length + (B.B.team || []).length)); document.body.appendChild(ov);
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
  B.meta = onBattleEnd(B);
  let txt = '', loot = [], btns = '';
  if (B.kind === 'replay') {}
  else if (B.kind === 'endless') {
    if (win) { S.wins++; S.endless = Math.max(S.endless, S.floor); S.floor++; txt = `破无尽劫第 ${S.floor - 1} 层。最高 ${S.endless} 层。`; }
    else if (draw) txt = '劫云僵持，未破此层。';
    else { S.losses++; wound(); txt = `止步第 ${S.floor} 层。全体轻伤 1 层，写代码约 1 分钟愈合一层。`; }
  }
  else if (B.kind === 'trib') {
    if (win) {
      S.realm++; S.wins++; S.team.forEach(g => { g.atk++; g.hp++; }); S.ghosts = null; S.shop = rollWares(S.shop); onRealm(S.realm); onRefresh(S.shop, 'realm');
      gain('渡劫', `晋${REALMS[S.realm]}：全体攻血各 +1${slotCap(S.realm) > slotCap(S.realm - 1) ? '，空窍 +1 格' : ''}`);
      txt = `渡劫成功，晋${REALMS[S.realm]}。全体蜕变 +1/+1${slotCap(S.realm) > slotCap(S.realm - 1) ? '，空窍多开一格' : ''}。择一道痕，伴你整局：`;
      loot = rollMarks(R(), S.marks).map(k => ({ k: 'mark', id: k, t: `道痕【${MARKS[k].n}】${MARKS[k].d}` }));
    }
    else if (draw) txt = '劫云散去，未分胜负。';
    else { S.losses++; wound(); txt = '渡劫未成：全体轻伤 1 层，写代码约 1 分钟愈合一层。'; }
  } else if (B.kind === 'ghost') {
    if (win) {
      S.wins++; txt = '胜。';
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
  let base = 0; const mults = [], mo = B.meta, isSettle = r => r.k === 'stone' && /首胜|结算加成/.test(r.why || '');
  if (B.kind === 'trib' || B.kind === 'ghost' || B.kind === 'endless') base = win ? ECON.win[B.kind === 'ghost' ? (B.tier || 'mid') : B.kind] : ECON.lose;
  if (base && win && mo && mo.streak) {
    const st = mo.streak; if (st.n >= 2) mults.push([`${st.n} 连胜`, +st.mul.toFixed(2)]);
    if (st.firstWin) mults.push(['每日首胜', +((st.mul + META_TUNE.daily.firstWinMul - 1) / st.mul).toFixed(2)]);
    if (B.comeback) mults.push(['绝境翻盘', 2]);
    if (B.crits >= 3) mults.push([`暴击 ${B.crits} 次`, 1.2]);
  }
  if (base && S.marks.includes('shengCai')) mults.push(['生财有道', 1.5]);
  const got = Math.round(mults.reduce((a, m) => a * m[1], base)); S.stone += got; B.pay = { base, mults, gain: got };
  if (got) gain('斗蛊', `+${got} 元石（${B.title} ${win ? '胜' : '败'}，基础 ${base}${mults.map(m => ` · ${m[0]} ×${m[1]}`).join('')}）`);
  if (mo) { handleOut(mo, isSettle); if (mo.more) handleOut(mo.more); }
  if (B.kind === 'ghost') S.ghosts = null;
  B.loot = loot; window.__guB = B; snd(win ? 'win' : draw ? 'pluck' : 'lose');
  let consol = '';
  const mnote = B.meta && B.meta.notes.find(n => /^败也有得/.test(n)), saved = B.meta && B.meta.streak && B.meta.streak.saved;
  if (!win && !draw && S.started && ['trib', 'ghost', 'endless'].includes(B.kind)) {
    const left = B.res.log[B.res.log.length - 1].s[1].reduce((a, x) => a + x[2], 0), got = [];
    if (S.sel != null && S.compass[S.sel]) { const c = S.compass[S.sel].cost * src.unit, add = Math.min(c * WOUND.loseNodePct, c - S.prog - 1); if (add > 0) { S.prog += add; got.push(`${NODES[S.compass[S.sel].type].n}进度 +${Math.round(100 * add / c)}%`); } }
    else { const add = WOUND.loseNodePct * 50 * src.unit; S.bank += add; got.push(`灵气 +${fmtTok(add)}`); }
    if (mnote) got.push(...mnote.replace(/^败也有得：/, '').split('、').filter(t => !/^经验/.test(t)));   // 经验在「本场所得」里列
    consol = `<div class="consol"><b>败亦有获</b>${got.map(t => `<span>${esc(t)}</span>`).join('')}${left > 0 ? `<em>敌阵只剩 ${fmtNum(left)} 血，差一点</em>` : ''}</div>`;
  }
  const spoils = mo ? [...(mo.xp ? [{ k: 'xp', n: mo.xp }] : []), ...mo.rewards.filter(r => !isSettle(r) && r.k !== 'xp' && !/升级|成就/.test(r.why || ''))] : [];
  const panel = el(`<div class="result"><div class="rseal${win ? '' : ' lose'}">${win ? '胜' : draw ? '和' : '败'}</div>${B.comeback ? '<span class="goldtag">绝境翻盘</span>' : ''}<p class="rtxt">${txt}</p>${consol}
  ${spoils.length ? `<ul class="spoils"><li class="sh">本场所得</li>${spoils.map(r => `<li>${esc(rwLine(r))}</li>`).join('')}</ul>` : ''}
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
    row.appendChild(el(`<span class="mcard" data-tip="${esc(multTip(lab, m))}"><small>${esc(lab)}</small><b>×${m}</b></span>`)); snd('clack');
    box.animate([{ transform: 'translateY(3px)' }, { transform: 'none' }], { duration: 180 });
    val = val * m; await roll(Math.round(val), 420);
  }
  const total = Math.round(mults.reduce((a, m) => a * m[1], base));
  if (payFast) row.innerHTML = mults.map(([lab, m]) => `<span class="mcard" data-tip="${esc(multTip(lab, m))}"><small>${esc(lab)}</small><b>×${m}</b></span>`).join('');
  num.textContent = fmtNum(total); num.classList.add('final'); snd(mults.length ? 'coins' : 'coin');
}
function closeBattle() {
  const b = $('#battle'); if (b) b.remove(); inBattle = false;
  const ho = heldOuts; heldOuts = []; setTimeout(() => ho.forEach(showOut), 200);
  setTimeout(() => tutorialEvent('battle_end'), 60);
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
  const merge = w && owned(w.sp) >= 2, can = w && canBuy(S.team, w.sp, cap, S.bag, BC());
  sheet(`<div class="detail"><div class="dart">${guSVG(g.sp)}</div><div><h3>${rarTag(g)}${g.boss ? '劫·' : ''}${rankName(g)}</h3><p class="lore">${kind === 'foe' ? '<span class="foetag">敌</span>' : ''}${s.lore}${g.clone ? ' · 分身' : ''}</p><p class="dst"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i>${g.wound ? ` <span class="wd">伤 ${g.wound} 层</span>` : ''}</p>${team && kind !== 'shop' ? `<p class="sm">站位：${kind === 'foe' ? '敌阵' : '我阵'}第 ${i + 1} 位${i === 0 ? '（最前）' : ''}</p>` : ''}</div></div>
  <h4>词条</h4><ul>${g.tr.map(([id, v]) => { const pn = team && kind !== 'shop' ? posNote(team, i, id) : ''; return `<li><b>${TRAITS[id].n}${v > 1 ? ` ${v}层` : ''}</b>${TRAITS[id].d(v)}${pn ? `<em class="pn">→ ${esc(pn)}</em>` : ''}</li>`; }).join('')}</ul>
  ${recv.length ? `<h4>站位加成</h4><ul>${recv.map(l => `<li><b>${TRAITS[l.id].n}</b>来自 ${SP[team[l.from].sp].n}：${esc(l.txt)}</li>`).join('')}</ul>` : ''}
  ${g.q.length ? `<h4>怪癖</h4><ul>${g.q.map(q => `<li><b>${QUIRKS[q].n}</b>${QUIRKS[q].d}</li>`).join('')}</ul>` : ''}
  ${sk ? `<h4>杀招</h4><div class="skill"><span class="seal${sk.named ? '' : ' pale'}">${esc(sk.n)}</span><p>${esc(sk.d)}<br><small>附蛊：${g.att.map(a => SP[a].n).join('、')}</small></p></div>` : ''}
  ${kind === 'mine' ? `<h4>算力履历</h4><p class="hist">累计喂养 <b>${fmtTok(g.fed)}</b> token · 突变 <b>${g.mut || 0}</b> 次</p>
  <div class="row2"><button data-act="mv" data-i="${i}" data-d="-1"${i === 0 ? ' disabled' : ''}>← 左移</button><button data-act="mv" data-i="${i}" data-d="1"${i >= S.team.length - 1 ? ' disabled' : ''}>右移 →</button></div>
  <div class="row2"><button data-act="toBag" data-i="${i}"${S.team.length > 1 && S.bag.length < BC() ? '' : ' disabled'}>收进蛊囊</button><button data-act="sell" data-i="${i}"${S.team.length > 1 ? '' : ' disabled'}>出售 +${sellValue(g)}◈</button></div>
  <p class="sm">左为炉口：多数罗盘节点作用在最左那只；炼附取最右那只。在空窍里直接拖动也能换位。</p><p class="sm">${esc(TXT.rankTip(g))}词条位 ${trCap(g)} 个。${canWield(g, S.realm) ? '' : `<br><b class="sealtx">${TXT.sealed}</b>：${esc(TXT.sealedTip(g))}`}</p>` : ''}
  ${kind === 'bag' ? `<p class="sm">${esc(TXT.bagHead)}</p><div class="row2">${S.team.length < cap ? `<button class="zhu" data-act="fromBag" data-i="${i}"${canWield(g, S.realm) ? '' : ' disabled'}>上阵</button>` : ''}<button data-act="sellBag" data-i="${i}">出售 +${sellValue(g)}◈</button></div>${S.team.length >= cap && canWield(g, S.realm) ? `<h4>换下一只上阵</h4><div class="row2 wrap">${S.team.map((t, k) => `<button data-act="swapIn" data-i="${i}" data-k="${k}">换下 ${esc(rankName(t))}</button>`).join('')}</div>` : ''}<p class="sm">${esc(TXT.rankTip(g))}${canWield(g, S.realm) ? '' : `<br><b class="sealtx">${TXT.sealed}</b>：${esc(TXT.sealedTip(g))}`}</p>` : ''}
  ${w ? `<div class="row2"><button data-act="freeze" data-i="${i}">${w.frozen ? '解冻' : '冻结（刷新时保留）'}</button><button class="zhu" data-act="buy" data-i="${i}"${!w.sold && S.stone >= cost && can ? '' : ' disabled'}>${!can ? '空窍和蛊囊都满了' : (merge ? '买下并合炼 ' : '买下 ') + cost + '◈'}</button></div><p class="sm">${merge ? `你已有两只${RANK.names[baseRank(w.sp)]}${s.n}，买下立即三合一，炼成${RANK.names[baseRank(w.sp) + 1]}${esc(TXT.mergeWarn(w.sp, S.realm))}。` : TXT.shopNote + '，自动进行。'}余 ${S.stone}◈</p>` : ''}
  <details class="book"><summary>杀招配方（${COMBOS.length}）</summary><ul>${COMBOS.map(c => `<li><b>${c.n}</b>${c.need.map(x => SP[x].n).join(' + ')}</li>`).join('')}</ul></details>`, '', ctx.stack);
}
function openGu(i) { const g = S.team[i]; if (g) guDetail(g, { kind: 'mine', i, team: S.team }); }
// ---------- 蛊囊：空窍下面常驻一行；「整理」打开完整面板 ----------
function bagBadges(g) {
  const L = S.team[0], out = [];
  if (fuseLv(g) < RANK.fuse && rankOf(g) < RANK.max && sameRank([...S.team, ...S.bag], g.sp, rankOf(g)) >= 2) out.push(`<span class="bfu" data-tip="${esc(TXT.bagFuseTip(g))}">${TXT.bagFuse}</span>`);
  if (L && L.att.length < 2) { const c = comboOf({ sp: L.sp, att: [...L.att, g.sp] }); if (c && c !== comboOf(L)) out.push(`<span class="bcb" data-tip="${esc(TXT.bagComboTip(g, c))}">${TXT.bagCombo}</span>`); }
  return out.length ? `<span class="bbadge">${out.join('')}</span>` : '';
}
function bagItem(g, i) { return `<div class="mg${canWield(g, S.realm) ? '' : ' sealed'}" data-drag="${i}" data-act="bagGu" data-i="${i}" data-tip-fn="bg">${bagBadges(g)}<span class="art">${guSVG(g.sp)}</span><b><small class="rkt">${RANK.names[rankOf(g)]}</small>${SP[g.sp].n}</b><span class="st"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i></span><span class="tr">${trChars(g.tr)}</span></div>`; }
function renderBagLine() {
  const box = $('#bagline'); if (!box) return; const m = M(), nc = (m ? m.cocoons.length : 0) + S.held.length, left = BC() - S.bag.length;
  setHTML(box, `<div class="bh"><span class="lbl" data-tip-fn="bag">蛊囊 <b>${S.bag.length}</b>/${BC()}</span>${nc && on('cocoon') ? `<button class="mini-b coc2" data-act="cocoon" data-tip="${esc(TXT.cocoonDest())}">${esc(TXT.cocoonBtn(nc))}</button>` : ''}<button class="mini-b" data-act="bag">整理</button></div>
  <div class="mini bagm" data-sort="bagm" data-group="main">${S.bag.map(bagItem).join('')}${left > 0 ? `<div class="mg empty" data-drag="${S.bag.length}" data-tip-fn="bag">${S.bag.length ? `空 ${left} 格` : '开茧和奖励得到的蛊放这里'}</div>` : ''}</div>`);
}
function bagHTML() {
  const cap = curCap(), slot = (g, i, key) => g ? `<div class="mg${canWield(g, S.realm) ? '' : ' sealed'}" data-drag="${i}" data-act="${key === 'bag' ? 'bagGu' : 'teamGu'}" data-i="${i}">${key === 'bag' ? bagBadges(g) : ''}<span class="art">${guSVG(g.sp)}</span><b><small class="rkt">${RANK.names[rankOf(g)]}</small>${SP[g.sp].n}</b><span class="st"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i></span><span class="tr">${trChars(g.tr)}</span></div>` : `<div class="mg empty" data-drag="${i}">空</div>`;
  return `<h3>蛊囊 <small>${S.bag.length}/${BC()}</small></h3><p class="sm">${esc(TXT.bagHead)}</p>
  <div class="fhead"><span class="lbl">空窍 <small>${S.team.length}/${cap} · 上阵</small></span></div><div class="mini me bagrow" data-sort="bt" data-group="bag">${Array.from({ length: cap }, (_, i) => slot(S.team[i], i, 'team')).join('')}</div>
  <div class="fhead"><span class="lbl">蛊囊 <small>不参战 · 灵气减半</small></span></div><div class="mini bagrow bagbox" data-sort="bag" data-group="bag">${Array.from({ length: BC() }, (_, i) => slot(S.bag[i], i, 'bag')).join('')}</div>`;
}
function openBag() { firstTip('bag', TXT.bagIntro); const cur = $('.sheet.bagsheet'); if (cur) cur.innerHTML = '<button class="x" data-act="closeSheet">×</button>' + bagHTML(); else sheet(bagHTML(), 'bagsheet'); }
function bagChanged() { handleMerges(); renderSlots(); renderPhase(); renderShop(); save(); if ($('.sheet.bagsheet')) openBag(); }
// 空窍 ↔ 蛊囊 之间挪动：拖到有蛊的格子就互换，拖到空格就放进去；空窍至少留一只
function moveGu(fromKey, fi, toKey, ti) {
  const A = fromKey === 'bag' ? S.bag : S.team, B = toKey === 'bag' ? S.bag : S.team, g = A[fi]; if (!g || A === B) return false;
  const capB = toKey === 'bag' ? BC() : curCap(), other = B[ti];
  if (toKey !== 'bag' && !canWield(g, S.realm)) { popPush(`<div class="toast">${esc(TXT.sealIntro(g))}</div>`, 1800, 'side'); return false; }
  if (other) { if (fromKey !== 'bag' && !canWield(other, S.realm)) return false; A[fi] = other; B[ti] = g; }
  else { if (B.length >= capB || (fromKey !== 'bag' && S.team.length <= 1)) return false; A.splice(fi, 1); B.splice(Math.min(ti, B.length), 0, g); }
  snd('clack'); return true;
}
function shareText(code) { return `${S.trial ? TXT.trialText : ''}我在《蛊码》养了一窝蛊（${REALMS[S.realm]}），敢接战帖吗？\n界壁坐标码：${code}`; }
const SHARE_BASE = 'https://1596941391qq.github.io/gu-code/';
const INSTALL_URL = 'https://github.com/1596941391qq/gu-code#安装插件获取真实-token-消耗';
function shareURL(code) { return (/^https?:/.test(location.protocol) ? location.origin + location.pathname : SHARE_BASE) + '#c=' + code; }
function myCode() { return encodeTeam(S.team.length ? S.team : starterTeam(), { name: S.name, realm: S.realm, marks: S.marks, trial: S.trial }); }
function openGhosts() {
  if (!S.ghosts || S.ghosts.realm !== S.realm) { const r = R(); S.ghosts = { realm: S.realm, list: ghostTrio(r, Math.max(1, S.nodes) + S.realm, S.realm).map(o => ({ tier: o.tier, label: o.label, name: o.name, code: encodeTeam(o.team, { name: '幽灵·' + o.name, realm: S.realm }) })) }; save(); }
  sheet(`<h3>斗幽灵 · 择一对手</h3><p class="sm">阵容摆在明面上，越难奖励越多。每场耗 1 点意志（余 ${S.will}）。连胜、每日首胜另有元石加成。</p>${S.ghosts.list.map((o, i) => { const d = decodeTeam(o.code); return `<div class="foeopt"><div class="fh"><b class="tier t-${o.tier}">${o.label}</b><span class="fn">${esc(o.name)}</span></div><p class="stakes">${stakesHTML('ghost', o.tier)}</p>${miniRow(d.team, 'foe', 'g' + i)}<button class="zhu" data-act="ghostGo" data-i="${i}"${S.will > 0 ? '' : ' disabled'}>应战</button></div>`; }).join('')}`);
}
let cardURL = '';
async function openShare() {
  const code = myCode(), url = shareURL(code);
  sheet(`<h3>界壁坐标码${trialTag(S.trial)}</h3>${S.trial ? `<p class="trialnote">${TXT.trialShare}</p>` : ''}<p class="sm">发给朋友。对方${url ? '打开链接，或' : ''}在蛊码里粘贴坐标码，就会和你这支阵容开打。</p>
  <label class="row"><span>蛊师名号</span><input id="nm" maxlength="8" value="${esc(S.name)}" placeholder="无名蛊师"></label>
  <div class="code" id="codeTxt">${code}</div>
  <div class="row2"><button data-act="copyCode">复制坐标码</button><button data-act="copyLink">${url ? '复制战帖链接' : '复制战帖文案'}</button></div>
  <div class="cardbox"><img id="cardImg" alt="分享卡"><div class="row2"><button class="zhu" data-act="savePng">保存分享卡 PNG</button></div><p class="sm">${VSC ? '' : '手机上可长按图片保存。'}</p></div>`);
  $('#nm').addEventListener('change', e => { S.name = e.target.value.trim().slice(0, 8); save(); openShare(); });
  cardURL = ''; const img = $('#cardImg');
  try { cardURL = await makeCard({ team: S.team.length ? S.team : starterTeam(), title: titleName(M()), rar: RARITY, name: S.name, realm: S.realm, total: S.total, muts: S.muts, wins: S.wins, code, url, endless: S.endless, trial: S.trial }); if (img) img.src = cardURL; } catch (e) { if (img) img.alt = '分享卡生成失败'; }
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
  if (!foe) return; if (S.meta) emit('duel_open', {});
  const mine = S.started && S.team.length ? S.team : starterTeam();
  window.__guFoe = foe;
  sheet(`<p class="eyebrow">界壁震动</p><h3 class="duelh">有人向你下战帖${trialTag(foe.trial)}</h3><p class="sm">来自 <b>${esc(foe.name || '无名蛊师')}</b> · ${REALMS[foe.realm] || '凡人'}</p>${foe.trial ? `<p class="trialnote">${TXT.trialFoe}</p>` : ''}${miniRow(foe.team, 'foe', 'duel')}
  <p class="vsline">— 你的${S.started && S.team.length ? '空窍' : '初始阵容'} —</p>${miniRow(mine, '', 'duelMine')}<p class="stakes">${stakesHTML('duel')}</p><div class="row2"><button class="zhu big" data-act="duelFight">布阵应战</button></div>`);
}
function checkHash() {
  const h = location.hash; if (!/[#&](c|r)=/.test(h)) return;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  openLinkText(h);
}

function onMerged(x) { gain('合炼', `三只合一，炼成${rankName(x)} 攻 ${x.atk} 血 ${x.hp}`); handleOut(metaEmit(M(), 'merge', { star: fuseLv(x) + 1, rank: rankOf(x) }, R(), S)); firstTip('rank', TXT.rankIntro); if (!canWield(x, S.realm)) firstTip('seal', TXT.sealIntro(x)); }
// 新得一只蛊找去处：能合炼先合炼（播升转演出），再进空窍，再进蛊囊；都满了弹出三选一（替换 / 炼化 / 暂存）
const FULL = { g: null };
function placeNew(g, quiet, mode = 'shop') {
  const r = placeGu(S.team, S.bag, g, curCap(), S.marks, R(), BC(), mode);
  if (!r.where) { FULL.g = g; sheet(`<h3>${esc(TXT.fullHead(g))}</h3><p class="dst"><i class="a">${g.atk}</i> <i class="h">${g.hp}</i> ${trChars(g.tr)}</p><div class="fullopts"><button data-act="fullSwap">${esc(TXT.fullSwap)}</button><button data-act="fullMelt">${esc(TXT.fullMelt(g, meltValue(g)))}</button><button data-act="fullHold">${esc(TXT.fullHold)}</button></div>`, 'fullsheet'); return r; }
  r.merged.forEach(onMerged);
  if (r.where === 'bag' && !r.merged.length) { gain('蛊囊', TXT.toBag(g, mode)); if (!quiet) popPush(`<div class="toast">${esc(TXT.toBag(g, mode))}</div>`, 1600, 'side'); firstTip('bag', TXT.bagIntro); setTimeout(() => { const e = $(`#bagline .mg[data-i="${S.bag.indexOf(g)}"]`); if (e) { e.classList.remove('born'); void e.offsetWidth; e.classList.add('born'); } }, 60); }
  renderSlots(); renderPhase(); if ($('.sheet.bagsheet')) openBag();
  setTimeout(() => { if (r.merged.length) { const x = r.merged[r.merged.length - 1]; fxFloat(x.uid, `炼成${RANK.names[rankOf(x)]}`, 'mut'); stampIn($('#qiao'), '合炼', false, 'side'); } else if (r.where === 'team') fxFloat(g.uid, '入窍', 'new'); }, 60);
  return r;
}
function handleMerges() { mergeAll(S.team, S.marks, R(), S.bag).forEach(onMerged); }
function openDaily() {
  const d = dailyView(M()), si = streakInfo(M());
  sheet(`<h3>日课</h3><p class="sm">每天回来做一点，断签不罚，只是从第 1 天重新算。</p>
  <div class="dfw${d.firstWinPending ? '' : ' done'}"><b>每日首胜</b><span>${d.firstWinPending ? `今天第一场胜利结算 ×${d.firstWinMul}` : '今日已领'}</span></div>
  <h4>今日三课${d.allDone ? ' · 已圆满' : ''}</h4><ul class="tasks">${d.tasks.map(t => `<li class="${t.done ? 'done' : ''}" data-tip="${esc(`${t.n}：进度 ${t.prog}/${t.need}，完成得 ${CHESTS[t.chest] ? CHESTS[t.chest].n : '宝箱'}；三课全完成另得银箱。`)}"><b>${esc(t.n)}</b><span class="tbar"><i style="width:${(100 * t.prog / t.need).toFixed(0)}%"></i></span><small>${t.prog}/${t.need} · ${CHESTS[t.chest] ? CHESTS[t.chest].n : ''}</small></li>`).join('')}</ul>
  <h4>七日签到</h4><div class="sign">${d.sign.map((r, i) => `<span class="${i < d.signDay ? 'got' : ''}${i === d.signDay - 1 ? ' today' : ''}"><b>${i + 1}</b><small>${r.map(rwText).join(' ')}</small></span>`).join('')}</div>
  <h4>连胜</h4><p class="sm">当前 ${si.n} 连胜，胜场元石 ×${si.mul.toFixed(1)}。断连只失去加成，不扣已有的东西。</p>`, 'daily');
}
function openAchs() {
  const m = M(), list = achList(m), done = list.filter(a => a.done).length;
  sheet(`<h3>成就</h3><p class="sm">已得 ${done}/${list.length} · 成就点 ${m.ap} · 称号「${esc(titleName(m))}」（写在分享卡上）</p>
  <h4>称号</h4><div class="titles">${TITLES.filter(t => m.titles.includes(t.id)).map(t => `<button data-act="title" data-id="${t.id}" class="${m.title === t.id ? 'on' : ''}">${esc(t.n)}</button>`).join('')}${TITLES.filter(t => !m.titles.includes(t.id) && t.ap !== undefined).slice(0, 1).map(t => `<span class="next">下一个：${esc(t.n)}（${t.ap} 点）</span>`).join('')}</div>
  ${['gold', 'silver', 'bronze'].map(tier => `<h4>${ACH_TIER[tier].n} · ${ACH_TIER[tier].pt} 点</h4><ul class="achl">${list.filter(a => a.tier === tier).map(a => `<li class="${a.done ? 'done' : ''}${a.hidden && !a.done ? ' hid' : ''}" data-tip="${esc(`${a.n}：${a.d}\n${ACH_TIER[tier].n}档 ${ACH_TIER[tier].pt} 成就点；奖励 ${(ACH_TIER[tier].reward || []).map(rwText).join('、')}${a.done ? '（已得）' : ''}`)}"><b>${esc(a.n)}</b><small>${esc(a.d)}</small></li>`).join('')}</ul>`).join('')}`, 'achs');
}
function lockHTML(k) { const u = UNLOCKS[k], need = Object.entries(u.need).map(([q, v]) => ({ nodes: `走完 ${v} 个罗盘节点`, wins: `斗赢 ${v} 场`, level: `蛊师 ${v} 级`, realm: `踏入${REALMS[v]}` }[q])).join('、'); return `<div class="locked"><span class="lbl">${u.n}</span><small>${u.d} · ${need}后点亮</small></div>`; }

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
  <div class="set"><span>近期所得<small>最近 50 条奖励记录：时间、来源、内容</small></span><button class="tog" data-act="gains">查看</button></div>
  ${ledgerLimitRows()}
  <p class="sm">累计喂养 ${fmtTok(S.total)} token · 胜 ${S.wins} · 负 ${S.losses}</p>`, 'settings'));
}
// ---------- 集成接口：合分支时替换实现（现在只往本地事件日志里记一笔）----------
function logEv(k, o = {}) { (S.log || (S.log = [])).push({ t: Date.now(), k, ...o }); if (S.log.length > 500) S.log.splice(0, S.log.length - 500); }
const emit = (type, p) => handleOut(metaEmit(M(), type, p, R(), S));
function onGain(g, from) { logEv('gain', { sp: g.sp, from }); gainRar(g, from); }      // 获得蛊：starter | summon | shop | loot | cocoon
function onRefresh(items, why) { logEv('refresh', { why, sp: items.map(w => w.sp) }); emit('shop_refresh', shopFlags(items)); } // 蛊市刷新：manual | node | realm | init
function onBattleEnd(B) {                                                             // 战斗结束：返回 meta 的结算（连胜、首胜、掉箱、败也有得）
  logEv('battle', { kind: B.kind, w: B.res.winner, turns: B.res.turns, tier: B.tier || null });
  if (B.kind === 'replay' || B.res.winner === 'draw') return null;
  const log = B.res.log, s0 = log[0].s[0], s1 = log[log.length - 1].s[0], hp = s => s.reduce((a, x) => a + x[2], 0);
  const mine = log.filter(e => e.t === 'dmg' && e.src === 0), win = B.res.winner === 'A';
  const safe = false;
  const out = metaEmit(M(), 'battle_end', { kind: B.kind === 'ghost' ? (B.tier || 'mid') : B.kind, win, hpLeftRatio: hp(s1) / Math.max(1, hp(s0)), crits: B.crits | 0, maxHit: Math.max(0, ...mine.map(e => e.n)), skills: log.filter(e => e.t === 'combo' && B.res.roster[e.uid] && B.res.roster[e.uid].side === 0).length, turns: B.res.turns, streakSafe: safe }, R(), S);
  if (B.kind === 'endless' && win) out.more = metaEmit(M(), 'endless_floor', { floor: S.floor }, R(), S);
  return out;
}
let qiAcc = 0, qiT = 0;
function onTokens(d, rate, bySource) {                                               // 每次 token 进账（约 5 次/秒）：经验、灵气宝箱、蛊的灵气
  emit('token', { delta: d, rate });
  const fed = feedTeam(S.team, d); qiAcc += d; if (S.bag.length) { const per = d / Math.max(1, S.team.length) * BAG.feedMul; S.bag.forEach(g => feedGu(g, per)); }   // 蛊囊里的只吃一半
  if (inBattle) return;
  fed.forEach(f => { if (f.up) { const g = S.team.find(x => x.uid === f.uid); if (g) gain('灵气', `${SP[g.sp].n} 灵气升级：攻 +${f.atk} 血 +${f.hp}`); renderSlots(); setTimeout(() => { fxFloat(f.uid, `灵气升级 +${f.atk}/+${f.hp}`, 'mut'); const e = $(`.gu[data-uid="${f.uid}"]`); if (e) { e.classList.remove('pulse'); void e.offsetWidth; e.classList.add('pulse'); } }, 30); } });
  const now = performance.now(); if (now - qiT > 3500 && qiAcc > 0 && S.team.length) { qiT = now; const g = S.team[0]; fxFloat(g.uid, qiText(Math.round(qiAcc * META_TUNE.gu.leadShare)), 'qi'); qiAcc = 0; }
  const b = $('#lvbar i'); if (b) { const L = levelInfo(M()); b.style.width = (L.need ? Math.min(100, 100 * L.cur / L.need) : 100).toFixed(1) + '%'; }
}
function onNode(n) { logEv('node', { type: n.type, n: S.nodes + 1 }); emit('node_done', { type: n.type }); tutorialEvent('node_done'); }
function onRealm(r) { logEv('realm', { r }); emit('realm_up', { realm: r }); }
function onSession(away) {
  logEv('session', { total: Math.round(S.total), realm: S.realm });
  const d = new Date(); emit('session_start', { date: today(), hour: d.getHours(), awayMs: S.seen ? Date.now() - S.seen : 0, awayTokens: away | 0 });
}
setInterval(() => { if (booted && S.meta) { const d = new Date(); emit('day_tick', { date: today(), hour: d.getHours() }); } }, 60000);

// ---------- 悬停提示：任何元素加 data-tip（文字）或 data-tip-fn（动态）即可；鼠标悬停 250ms，触屏长按 ----------
function multTip(lab, m) {
  if (/连胜/.test(lab)) return `${lab}：连胜越长结算越高（上限 ×${META_TUNE.streak.cap}），断连只失去加成。本场 ×${m}`;
  if (/首胜/.test(lab)) return `每日首胜：今天第一场胜利的元石按 ×${META_TUNE.daily.firstWinMul} 结算（与连胜相加）。本场折算 ×${m}`;
  if (/翻盘/.test(lab)) return '绝境翻盘：己方剩血不到两成时赢下，元石 ×2。';
  if (/暴击/.test(lab)) return `${lab}：单场打出 3 次以上暴击，元石 ×1.2。`;
  if (/生财/.test(lab)) return '道痕「生财有道」：斗蛊所得元石 ×1.5。';
  return `${lab} ×${m}`;
}
function guTip(g, team, i) {
  if (!g) return '';
  const s = SP[g.sp], sk = skillOf(g), pn = id => team ? posNote(team, i, id) : '';
  return `<b>${rarTag(g)}${g.boss ? '劫·' : ''}${rankName(g)}</b> <i class="a">${effA(g)}</i> <i class="h">${effH(g)}</i>${g.wound ? ` <span class="wd">伤${g.wound}</span>` : ''}<br><small>${esc(s.lore)}${team ? ` · 第 ${i + 1} 位` : ''}</small>`
    + `<ul>${g.tr.map(([id, v]) => `<li><b>${TRAITS[id].n}${v > 1 ? v : ''}</b> ${esc(TRAITS[id].d(v))}${pn(id) ? `<em> → ${esc(pn(id))}</em>` : ''}</li>`).join('')}${g.q.map(q => `<li><b>${QUIRKS[q].n}</b> ${esc(QUIRKS[q].d)}</li>`).join('')}</ul>`
    + (sk ? `<p><b>${esc(sk.n)}</b> ${esc(sk.d)}</p>` : '') + (g.boss == null && !canWield(g, S.realm) && team === S.team ? `<p><b class="sealtx">${TXT.sealed}</b> ${esc(TXT.sealedTip(g))}</p>` : '') + `<small>点开看完整详情</small>`;
}
const TIPS = {
  bag: () => esc(TXT.bagRowTip()),
  bg: t => { const g = S.bag[+t.dataset.i]; return g ? guTip(g) + '<small>在蛊囊里：不参战，拖进空窍才上阵</small>' : ''; },
  gu: t => guTip(S.team[+t.dataset.i], S.team, +t.dataset.i),
  mg: t => { const tm = FOE[t.dataset.k]; return tm ? guTip(tm[+t.dataset.i], tm, +t.dataset.i) : ''; },
  ware: t => { const w = S.shop[+t.dataset.i]; if (!w) return ''; const n = owned(w.sp), shelf = S.shop.filter(x => x.sp === w.sp && !x.sold).length; return guTip(newGu(w.sp)) + `<small>买下时开茧定品质，价格 ${buyCost()}◈</small>` + (n >= 2 ? `<p>你已有 ${n} 只${RANK.names[baseRank(w.sp)]}${SP[w.sp].n}，买下即合炼成${RANK.names[baseRank(w.sp) + 1]}${esc(TXT.mergeWarn(w.sp, S.realm))}</p>` : n + shelf >= 3 ? `<p>${esc(TXT.fuseTip(w.sp, 3 - n))}</p>` : ''); },
  level: () => { const L = levelInfo(M()); return `<b>蛊师 ${L.level} 级</b> 经验 ${Math.floor(L.cur)}/${L.need}<br><small>写代码、走节点、斗蛊（输了也给）、开茧、合炼都给经验</small><p>下一级奖励：</p><ul>${L.next.map(r => `<li>${esc(rwLine(r))}</li>`).join('') || '<li>已满级</li>'}</ul>`; },
  rate: () => `<b>灵流 ${fmtTok(rate)}/s</b><br><small>${src.mode === 'vscode' ? '本机 AI 工具每秒烧掉的 token' : '网页里是模拟灵流'}。${hot ? '武火：' : '文火：'}超过 ${fmtTok(src.hotTh)}/s 算武火，走完节点有几率多一次突变或怪癖。</small><p>今日 ${fmtTok(S.todayKey === today() ? S.todayTok : 0)} · 本次 ${fmtTok(sessTok)} · 累计 ${fmtTok(S.total)}</p>`,
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

// ---------- 拖动换位 ----------
let drag = null, dragEndT = -1e9;
const moveIdx = (arr, f, t) => { const [x] = arr.splice(f, 1); arr.splice(t, 0, x); };
const SORT = {
  team(f, t) { moveIdx(S.team, f, t); renderSlots(); renderPhase(); renderHint(); save(); snd('clack'); tutorialEvent('formation_swap'); },
  mine(f, t) { moveIdx(S.team, f, t); renderSlots(); renderPhase(); save(); snd('clack'); renderPrep(false); tutorialEvent('formation_swap'); },
  bt(f, t) { if (S.team[f] && t < S.team.length) { moveIdx(S.team, f, t); snd('clack'); bagChanged(); } },
  bag(f, t) { if (S.bag[f] && t < S.bag.length) { moveIdx(S.bag, f, t); snd('clack'); bagChanged(); } },
  bagm(f, t) { if (S.bag[f] && t < S.bag.length) { moveIdx(S.bag, f, t); snd('clack'); bagChanged(); } },
};
const XSORT = { bt: 'team', bag: 'bag', team: 'team', bagm: 'bag' };   // 跨格子拖动：蛊囊面板里空窍行与蛊囊行之间
document.addEventListener('pointerdown', e => {
  const it = e.target.closest('[data-drag]'), box = it && it.closest('[data-sort]');
  if (!it || !box || e.button > 0) return;
  if (it.classList.contains('empty')) return;
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
  if (d.to === d.from) return; const tgt = d.items[d.to], tbox = tgt && tgt.closest('[data-sort]'), fi = +d.it.dataset.drag, ti = +tgt.dataset.drag;
  if (tbox && tbox !== d.box && XSORT[d.box.dataset.sort] && XSORT[tbox.dataset.sort]) { if (moveGu(XSORT[d.box.dataset.sort], fi, XSORT[tbox.dataset.sort], ti)) bagChanged(); }
  else if (SORT[d.box.dataset.sort] && !(d.box.dataset.sort === 'team' && ti >= S.team.length)) SORT[d.box.dataset.sort](fi, ti);
}
window.addEventListener('pointerup', dragEnd); window.addEventListener('pointercancel', dragEnd);

// ---------- 交互 ----------
const ACT = {
  pick(a) { S.team = [newGu(a.dataset.sp)]; S.started = true; onGain(S.team[0], 'starter'); S.shop = []; S.compass = rollCompass(R(), S.team, true, curCap()); save(); renderAll(); },
  node(a) {
    const i = +a.dataset.i; if (S.sel === i) return;
    if (S.sel != null) S.bank += S.prog;
    S.sel = i; S.prog = 0; S.wh = 0;
    const cost = S.compass[i].cost * src.unit, take = Math.min(S.bank, cost); S.prog = take; S.bank -= take;
    renderPhase(); renderHint(); snd('pluck'); save(); if (take > 0) { pourFx(); const nb = document.querySelector(`.node[data-i="${i}"]`); if (nb) nb.classList.add('pour'); }
    if (S.prog >= cost - 0.5) setTimeout(() => { if (S.sel === i && !inBattle) resolveNode(); }, 500);
  },
  gu(a) { openGu(+a.dataset.i); },
  mv(a) { const i = +a.dataset.i, j = i + +a.dataset.d; if (!S.team[j]) return; [S.team[i], S.team[j]] = [S.team[j], S.team[i]]; tutorialEvent('formation_swap'); closeSheet(); renderSlots(); renderPhase(); save(); openGu(j); },
  demo(a) { if (VSC) return; src.demo = a.dataset.m === 'rest' ? 'rest' : 'coding'; meters(); },
  src() {
    if (VSC) { const sl = srcList(bySrc); sheet(`<h3>${TXT.srcHead}</h3><p>${TXT.srcFrom}</p><p class="sm">当前灵流 <b>${fmtTok(rate)}/s</b></p>${sl.length ? `<ul class="srclist">${sl.map(x => `<li><span>${esc(x.name)}</span><b>${fmtTok(x.rate)}/s</b></li>`).join('')}</ul>` : `<p class="sm">${rate > 0 ? '' : TXT.srcNone}</p>`}`, 'srcinfo'); return; }
    sheet(`<h3>${TXT.demoHead}</h3><p>${TXT.demoFrom}</p><p class="sm">${TXT.demoTrial}</p><p>${TXT.demoInstall}</p><div class="row2"><a class="btn zhu" href="${INSTALL_URL}" target="_blank" rel="noopener">看插件安装方法</a></div><p class="sm">${esc(INSTALL_URL)}</p>`, 'demoinfo');
  },
  theme() { S.theme = { auto: 'light', light: 'dark', dark: 'auto' }[S.theme || 'auto']; applyTheme(); save(); },
  sound() { S.mute = !S.mute; save(); snd('pluck'); },
  settings() { openSettings(); },
  gains() { openGains(); },
  popx(a) { a.remove(); },
  chest() {
    const m = M(); if (!m.chests.length) return; const out = openChest(m, R(), 0); if (!out) return;
    const c = CHESTS[out.tier], big = out.tier === 'gold' || out.tier === 'xuan';
    popPush(`<div class="chestc t-${out.tier}"><small>开箱</small><b>${c.n}</b><p>${out.rewards.filter(r => r.why !== '升级' && r.why !== '成就').map(r => `<span>${rwText(r)}</span>`).join('')}</p></div>`, big ? 2000 : 1300, big ? 'big' : 'center');
    snd(big ? 'coins' : 'coin'); handleOut(out); save();
  },
  cocoon() {
    const m = M(); let g = S.held.shift();
    if (!g) { const c = openCocoon(m, R()); if (!c) return; g = newGu(R().pick(shopPool())); applyRarity(g, c.tier, R()); handleOut(metaEmit(m, 'cocoon', { rarity: c.tier }, R(), S)); revealPop(g, 'cocoon'); }
    firstTip('cocoon', TXT.cocoonIntro); placeNew(g, false, 'reward'); renderLevel(); renderBagLine(); save();
  },
  daily() { openDaily(); }, achs() { openAchs(); },
  title(a) { if (setTitle(M(), a.dataset.id)) { save(); openAchs(); } },
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
  trib() { prep('trib'); }, ghost() { openGhosts(); tutorialEvent('ghost_open'); }, endless() { prep('endless'); },
  path() { openPath(); }, codex() { openCodex(); },
  ledger() { openLedger({ name: S.name, realm: REALMS[S.realm], rank: titleName(M()) }); },
  ghostGo(a) { const o = S.ghosts && S.ghosts.list[+a.dataset.i]; if (!o || S.will <= 0) return; const d = decodeTeam(o.code); prep('ghost', { team: d.team, name: o.name, tier: o.tier, label: o.label }); },
  choose(a) { const p = S.pending; if (!p) return; finishNode(p.node, p.opts[+a.dataset.i], p.wu, p.cost); },
  buy(a) {
    const w = S.shop[+a.dataset.i], cost = buyCost(); if (!w || w.sold || S.stone < cost) return;
    if (!canBuy(S.team, w.sp, curCap(), S.bag, BC())) return; closeSheet();
    const g = newGu(w.sp); onGain(g, 'shop');
    S.stone -= cost; w.sold = true; w.frozen = false; tutorialEvent('shop_open');
    placeNew(g); renderShop(); save(); snd('pluck');
  },
  trio(a) {
    const sp = a.dataset.sp, c = trioCost(); if (trioSp() !== sp || S.stone < c || !trioPlan(sp)) return;
    S.stone -= c; let k = 0; S.shop.forEach(w => { if (w.sp === sp && !w.sold && k < 3) { w.sold = true; w.frozen = false; k++; } });
    gain('蛊市', `三只${SP[sp].n}一起买 −${c} 元石（8 折）`);
    for (let j = 0; j < 3; j++) { const g = newGu(sp); onGain(g, 'shop'); placeNew(g, true); }
    renderShop(); save(); snd('pluck'); tutorialEvent('shop_open');
  },
  bag() { openBag(); },
  bagGu(a) { const i = +a.dataset.i, g = S.bag[i]; if (g) guDetail(g, { kind: 'bag', i, stack: true }); },
  teamGu(a) { const i = +a.dataset.i, g = S.team[i]; if (g) guDetail(g, { kind: 'mine', i, team: S.team, stack: true }); },
  toBag(a) { const i = +a.dataset.i; if (moveGu('team', i, 'bag', S.bag.length)) { closeSheet(); gain('蛊囊', `${rankName(S.bag[S.bag.length - 1])} 收进蛊囊`); bagChanged(); } },
  fromBag(a) { const i = +a.dataset.i; if (moveGu('bag', i, 'team', S.team.length)) { closeSheet(); bagChanged(); } },
  swapIn(a) { if (moveGu('bag', +a.dataset.i, 'team', +a.dataset.k)) { closeSheet(); bagChanged(); } },
  sellBag(a) { const i = +a.dataset.i, g = S.bag[i]; if (!g) return; S.stone += sellValue(g); gain('出售', `${rankName(g)}（蛊囊）→ +${sellValue(g)} 元石`); S.bag.splice(i, 1); closeSheet(); bagChanged(); },
  fullSwap() { const g = FULL.g; if (!g) return; sheet(`<h3>${esc(TXT.fullSwap)}</h3><p class="sm">换上 ${esc(rankName(g))}（<i class="a">${g.atk}</i> <i class="h">${g.hp}</i>）</p>${[['team', S.team], ['bag', S.bag]].map(([k, l]) => `<h4>${k === 'team' ? '空窍' : '蛊囊'}</h4><div class="row2 wrap">${l.map((x, i) => `<button data-act="fullPick" data-k="${k}" data-i="${i}">${esc(rankName(x))} +${sellValue(x)}◈</button>`).join('')}</div>`).join('')}`, 'fullsheet', true); },
  fullPick(a) { const g = FULL.g, l = a.dataset.k === 'bag' ? S.bag : S.team, i = +a.dataset.i, x = l[i]; if (!g || !x) return; FULL.g = null; S.stone += sellValue(x); l[i] = g; gain('开茧', `${rankName(x)} 换下 +${sellValue(x)} 元石，${rankName(g)} 补上`); closeSheet(); closeSheet(); bagChanged(); },
  fullMelt() { const g = FULL.g; if (!g) return; FULL.g = null; const v = meltValue(g); S.stone += v; gain('开茧', `${rankName(g)} 炼化 +${v} 元石`); closeSheet(); renderMeta(); renderShop(); save(); stoneFloat(v); },
  fullHold() { const g = FULL.g; if (!g) return; FULL.g = null; S.held.unshift(g); gain('开茧', `${rankName(g)} 暂存回茧托盘`); closeSheet(); renderLevel(); renderBagLine(); save(); },
  refresh() { const free = freeRef(), c = free ? 0 : refCost(); if (S.stone < c) return; S.stone -= c; S.shop = rollWares(S.shop); onRefresh(S.shop, 'manual'); tutorialEvent('shop_open'); renderMeta(); renderShop(); save(); snd('tick'); },
  freeze(a) { const i = +a.dataset.i, w = S.shop[i]; if (w) { w.frozen = !w.frozen; renderShop(); save(); if (a.closest('.sheet')) guDetail(newGu(w.sp), { kind: 'shop', i }); } },
  sell(a) { const i = +a.dataset.i, g = S.team[i]; if (!g || S.team.length <= 1) return; S.stone += sellValue(g); gain('出售', `${SP[g.sp].n} → +${sellValue(g)} 元石`); S.team.splice(i, 1); closeSheet(); renderSlots(); renderShop(); renderPhase(); save(); },
  marksInfo() { if (S.marks.length) sheet(`<h3>道痕</h3><p class="sm">整局被动，渡劫成功时三选一。</p><ul>${S.marks.map(k => `<li><b>${MARKS[k].n}</b>${MARKS[k].d}</li>`).join('')}</ul>`); },
  speed() { S.speed = S.speed === 1 ? 2 : 1; $('#bspd').textContent = S.speed + '×'; save(); },
  skip() { skip = true; },
  payskip() { payFast = true; },
  loot(a) {
    const l = window.__guB.loot[+a.dataset.i];
    gain('道痕', l.t); if (l.k === 'mark' && !S.marks.includes(l.id)) S.marks.push(l.id);
    closeBattle();
  },
  closeBattle() { closeBattle(); },
  replyDuel() { closeBattle(); openShare(); },
  closeSheet(a, e) { if (e.target.closest('[data-stop]') && !a.classList.contains('x')) return; closeSheet(); },
  shut() { closeSheet(); },
  ware(a) { const w = S.shop[+a.dataset.i]; if (w && !w.sold) { guDetail(newGu(w.sp), { kind: 'shop', i: +a.dataset.i }); tutorialEvent('shop_open'); } },
  peek(a) { const t = FOE[a.dataset.k], i = +a.dataset.i; if (t && t[i]) guDetail(t[i], { kind: a.dataset.k === 'mine' ? 'view' : 'foe', i, team: t, stack: !!a.closest('.sheet') }); },
  fight() { const P = PREP; if (!P) return; oddsJob++; PREP = null; closeSheet(); startBattle(P.kind, P.foe); },
  copyCode(a) { copy(myCode(), a); emit('share', { kind: 'code' }); },
  copyLink(a) { const c = myCode(), u = shareURL(c); copy(u ? shareText(c) + '\n' + u : shareText(c), a); emit('share', { kind: 'link' }); },
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
    const tr = B.A.trial || B.B.trial;
    copy(`${tr ? TXT.trialText : ''}《蛊码》复盘：${an}${B.A.trial ? '（试玩）' : ''} 对 ${bn}${B.B.trial ? '（试玩）' : ''}，${wt}。点开看整场：\n${replayURL(B.replay)}`, a);
  },
  duelFight() { prep('duel', window.__guFoe); },
  reset(a) {
    if (Date.now() - resetArm > 3000) { resetArm = Date.now(); a.textContent = '再点一次确认重开'; setTimeout(() => { a.textContent = '重开一局'; }, 3000); return; }
    codexScan(); const keep = { sound: S.sound, name: S.name, total: S.total, theme: S.theme, codex: S.codex, meta: S.meta, tutDone: true, mute: S.mute, calm: S.calm, stats: S.stats, log: S.log, todayKey: S.todayKey, todayTok: S.todayTok, qlim: S.qlim, lgSnap: S.lgSnap, lgAch: S.lgAch }; S = Object.assign(fresh(), keep); save(); renderAll();
  },
};
document.addEventListener('click', e => {
  if (performance.now() - tipLongAt < 500) { e.preventDefault(); return; }   // 长按看提示后松手，不当作点击
  tipHide();
  const a = e.target.closest('[data-act]'); if (!a || a.disabled || performance.now() - dragEndT < 250) return;
  const f = ACT[a.dataset.act]; if (f) f(a, e);
});

// ---------- 算力履历（src/ledger.js）：收数据、周天上限存档；玩法挂钩见 ledger.js 文件头 ----------
ledgerInit({ vsc: VSC, openSettings, buffsOn: true, getLimits: () => S.qlim || {}, setLimit: (k, v) => { S.qlim = Object.assign({}, S.qlim); if (v > 0) S.qlim[k] = v; else delete S.qlim[k]; save(); }, onData: ledgerSync });
function ledgerSync() {   // 真实履历到达：周天轮转箱、履历成就、全年称号交给 meta 结算
  ledgerShades($('#qiao')); if (!booted || !S.started || !ledgerLive()) return;
  const rw = ledgerApply(M(), S, ledgerData()), out = metaEmit(M(), 'ledger', {}, R(), S);
  rw.forEach(r => { if (r.k === 'chest') out.chests.push(r.tier); out.rewards.push(r); });
  handleOut(out); save();
}

// ---------- 启动 ----------
function boot(saved, pending) {
  const mg = migrate(saved); if (mg) S = Object.assign(fresh(), mg);
  S.meta = metaMigrate(S.meta, S);
  S.trial = !VSC;   // 网页只有模拟灵流，存档一律算试玩；插件只认真实 token
  if (!document.getElementById('gu-defs')) document.body.insertAdjacentHTML('afterbegin', `<svg id="gu-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${ART_DEFS}</defs></svg>`);
  applyTheme(); if (VSC && window.MutationObserver) new MutationObserver(applyTheme).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  booted = true; renderAll(); requestAnimationFrame(veinLoop);
  const away = pending && pending.tokens > 0 && S.started ? pending.tokens : 0;
  if (pending && pending.tokens > 0 && S.started) { countTok(pending.tokens); feed(pending.tokens, pending.hot || 0); renderSlots(); renderPhase(); const h = $('#hint'); if (h) h.textContent = `你不在的时候，蛊吸纳了 ${fmtTok(pending.tokens)} token。`; }
  onSession(away); checkHash(); ledgerSync();
  if (!S.started && !S.tutDone && !location.hash.match(/[#&](c|r)=/)) setTimeout(runTutorial, 300);
}
// 新手引导：第一场斗蛊必胜并打出杀招（见 startBattle 里的 tutorialFight）
function runTutorial() {
  const steps = [];
  TUTORIAL_STEPS.forEach(st => {
    if (st.id === 'formation') steps.push({ ...st, sel: '#slots', click: '[data-act="mv"]', text: '拖动空窍里的蛊换位：最左的炉口最先出手，站位就是战术。' });
    else if (st.id === 'feed') { steps.push({ ...st, click: '[data-tut-none]', evt: ['node_done', 'node_choice'], text: VSC ? st.text : '网页读不到你电脑上的 AI 用量，这里是模拟灵流，节点条会自己走满。想用真实 token 养蛊，装 VS Code 插件。' }); steps.push({ id: 'choose', sel: '.nodes', click: '.opt', evt: 'node_done', text: '节点走满，停在一道选择题上：挑一个。' }); }
    else steps.push(st);
  });
  const tut = startTutorial(steps, { vsc: !!VSC, onStep(i, st) {
    if (st.id === 'choose' && !S.pending) setTimeout(() => tut.next(), 0); if (st.id === 'shop' && !isUnlocked(M(), S, 'shop')) { M().unlocked.shop = true; renderShop(); showOut({ levelUps: [], achievements: [], chests: [], unlocks: ['shop'], rewards: [], notes: [] }); } }, onDone() { S.tutDone = true; save(); } });
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
