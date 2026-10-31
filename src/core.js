// 蛊码 GuCode · 纯逻辑：种子随机、数据表、养成、坐标码。不碰 DOM。
export function hashStr(s) { s = String(s); let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function makeRng(seed) {
  let a = (typeof seed === 'number' ? seed : hashStr(seed)) >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = n => Math.floor(r() * n);
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  return r;
}

export const MAXV = 3, MAXTR = 4, MAXQ = 2, MAXATT = 2, SLOTS = 7;
export const REALMS = ['凡人', '一转', '二转', '三转', '四转', '五转'];
export const SLOT_BY_REALM = [3, 4, 5, 6, 7, 7];   // 上阵格（空窍）按境界开放：凡人 3、一转 4、二转 5、三转 6、四转起 7
export const slotCap = r => SLOT_BY_REALM[Math.min(5, Math.max(0, r | 0))];
export const POOL_TIERS = [['boar', 'fire', 'twin', 'iron', 'thorn', 'bone'], ['mantis', 'queen', 'cicada'], ['drum', 'scorp', 'moth']];
export const poolFor = r => POOL_TIERS.slice(0, Math.min(3, (r | 0) + 1)).flat();
// 转数（向原书靠拢：一转到五转，六转仙蛊另加）。基础转数 = 物种所在蛊池档位 + 1（凡人池一转，往上依次二转、三转）；
// 物种带 rank 字段时以它为准。三只同种同转合炼成高一转：同一只最多合炼 fuse 次，且不超过 max。
// 驱使上限：境界 r 的蛊师只能让转数 ≤ r + over 的蛊上阵（凡人驱使一转，一转蛊师驱使二转……），超出的可以收着，不能上阵。
export const RANK = { names: ['', '一转', '二转', '三转', '四转', '五转', '六转'], ch: ['', '一', '二', '三', '四', '五', '六'], max: 5, fuse: 2, over: 1 };
export const baseRank = sp => (SP[sp] && SP[sp].rank) || (POOL_TIERS.findIndex(t => t.includes(sp)) + 1) || 1;
export const rankOf = g => g.rank || baseRank(g.sp);
export const fuseLv = g => Math.max(0, rankOf(g) - baseRank(g.sp));     // 合炼过几次（0 = 原生转数）
export const canWield = (g, realm) => rankOf(g) <= (realm | 0) + RANK.over;
export const rankName = g => RANK.names[rankOf(g)] + SP[g.sp].n;          // 「一转野猪蛊」
export const ECON = { node: 2, buy: 3, refresh: 1, tokPer: 25, lose: 1, win: { easy: 3, mid: 5, hard: 8, trib: 10, endless: 6, duel: 0 } };
export const trCap = g => MAXTR + fuseLv(g);
// 蛊囊（备战区）：开茧、宝箱、夺蛊得到的蛊先放这里，拖进空窍才上阵；也用来攒同种合炼。
// cap 凡人时的格数，perRealm 每升一阶加几格（五转 18 格）；feedMul 吃灵气的比例（只吃一半）；
// meltMul 满了选「炼化」时按卖价的倍数折元石，rarSell 按品质（凡良珍绝天）再乘；trioOff 货架三只同种一起买的折扣
export const BAG = { cap: 8, perRealm: 2, feedMul: 0.5, meltMul: 1.5, rarSell: [1, 1.2, 1.5, 2, 3], trioOff: 0.8 };
export const bagCap = realm => BAG.cap + BAG.perRealm * Math.min(5, Math.max(0, realm | 0));

// 词条：v 为层数（1–3），同名合并即叠层
export const TRAITS = {
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
export const TRAIT_KEYS = Object.keys(TRAITS);

// 物种：每只一个直白词条。ab = 附蛊简字
export const SPECIES = [
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
export const SP = Object.fromEntries(SPECIES.map(s => [s.id, s]));
export const spTraits = id => { const s = SP[id]; return s.t2 ? [[s.t, s.v], [s.t2, s.v2]] : [[s.t, s.v]]; };
export const SUMMON_NAMES = { pupa: '蛊蛹', shade: '分影', lunar: '月影' };

// 怪癖：武火超频的双刃剑
export const QUIRKS = {
  blood:    { n: '嗜血', d: '攻 +2；每回合开始自损 1 血' },
  berserk:  { n: '狂暴', d: '攻 ×1.5；生命 ×0.7' },
  lastgasp: { n: '回光', d: '首次受致命伤时留 1 血' },
  echo:     { n: '回响', d: '词条触发后 35% 再触发一次；生命 -2' },
  timid:    { n: '怯阵', d: '居最前时攻 -2；在后排时每回合 +1 血' },
  martyr:   { n: '殉道', d: '亡语触发两次；生命 -2' },
  greedy:   { n: '贪噬', d: '击杀额外 +2/+2；受到伤害 +1' },
};
export const QUIRK_KEYS = Object.keys(QUIRKS);

// 杀招：本体 + 附蛊 的物种集合命中配方即成（三蛊配方优先）
export const COMBOS = [
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
export const COMBO = Object.fromEntries(COMBOS.map(c => [c.id, c]));

// 道痕：整局被动，渡劫成功三选一。顺序固定（坐标码按位编码），只能往后加
export const MARKS = {
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
export const MARK_KEYS = Object.keys(MARKS);
export function rollMarks(rng, owned = []) { const pool = MARK_KEYS.filter(k => !owned.includes(k)), out = []; while (out.length < 3 && pool.length) out.push(pool.splice(rng.int(pool.length), 1)[0]); return out; }

let UIDN = 1;
export function nuid() { return 'g' + (UIDN++).toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
export function newGu(sp) { const s = SP[sp]; return { uid: nuid(), sp, rank: baseRank(sp), atk: s.atk, hp: s.hp, tr: spTraits(sp), q: [], att: [], wound: 0, fed: 0, mut: 0 }; }
export function starterTeam() { return ['boar', 'fire', 'twin'].map(newGu); }

export function addTrait(g, id, v, bonus) {
  const e = g.tr.find(x => x[0] === id);
  if (e) { e[1] = Math.min(MAXV, e[1] + v + (bonus ? 1 : 0)); return true; }
  if (g.tr.length >= trCap(g)) return false;
  g.tr.push([id, Math.min(MAXV, v)]); return true;
}
export function comboOf(g) {
  if (!g.att || !g.att.length) return null;
  const set = new Set([g.sp, ...g.att]);
  for (const c of COMBOS) if (c.need.every(x => set.has(x))) return c;
  return null;
}
// 杀招：命中配方给名字和特效；未命中也有"自悟杀招"名——效果就是合流后的词条
export function skillOf(g) {
  const c = comboOf(g);
  if (c) return { id: c.id, n: c.n, d: c.d, named: true };
  if (g.att && g.att.length) {
    const chars = g.tr.map(t => TRAITS[t[0]].ch).join('');
    return { id: null, n: chars + ['诀', '印', '式', '咒', '阵'][hashStr(g.sp + g.att.join('')) % 5], d: '自悟杀招：本体与附蛊词条合流，层数叠加', named: false };
  }
  return null;
}
export function mutateGu(g, rng) {
  const fresh = TRAIT_KEYS.filter(k => !g.tr.some(t => t[0] === k));
  if (g.tr.length < trCap(g) && fresh.length) { const t = rng.pick(fresh); g.tr.push([t, 1]); return t; }
  const up = g.tr.filter(t => t[1] < MAXV);
  if (up.length) { const t = rng.pick(up); t[1]++; return t[0]; }
  g.atk++; g.hp++; return g.tr[0][0];
}
export function addQuirk(g, rng) {
  if (g.q.length >= MAXQ) return null;
  const q = rng.pick(QUIRK_KEYS.filter(k => !g.q.includes(k)));
  g.q.push(q); return q;
}
export function cloneGu(g) {
  return { ...g, uid: nuid(), atk: Math.max(1, Math.round(g.atk * 0.6)), hp: Math.max(1, Math.round(g.hp * 0.6)), tr: g.tr.map(t => [...t]), q: [...g.q], att: [], wound: 0, fed: 0, mut: 0, clone: 1 };
}

// 罗盘节点。cost 单位 = 千 token（演示）；桥接/插件模式另乘系数
export const NODES = {
  feed:   { n: '喂食', ch: '食', cost: 40, d: '灵食自左向右流过空窍：依次 +3/+2/+1 血，最左者另 +1 攻' },
  temper: { n: '淬体', ch: '淬', cost: 45, d: '最左蛊 +2 攻 +2 血' },
  mutate: { n: '突变', ch: '变', cost: 55, d: '最左蛊觉醒一个词条（三选一）' },
  split:  { n: '分裂', ch: '裂', cost: 60, d: '最左蛊裂出六成之力的分身，紧贴其右，词条全带' },
  devour: { n: '吞噬', ch: '吞', cost: 55, d: '最左蛊吞下你挑的一只：得其六成攻血、全部词条与附蛊' },
  summon: { n: '招蛊', ch: '招', cost: 40, d: '三选一：招来一只新蛊，入最右空窍' },
  refine: { n: '炼附', ch: '炼', cost: 60, d: '把最右蛊炼成最左蛊的附蛊：得其四成攻血，同名词条质变 +1，配方成杀招' },
};
export function nodeOk(type, team, cap = SLOTS) {
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
export function mkNode(type, rng) {
  const n = { type, cost: NODES[type].cost + rng.int(3) * 5 };
  if (type === 'summon') n.sp = rng.pick(SPECIES).id;
  return n;
}
export function rollCompass(rng, team, first, cap = SLOTS) {
  const pool = Object.keys(NODES).filter(t => nodeOk(t, team, cap));
  const out = [];
  if ((first || team.length < 2) && pool.includes('summon')) out.push(mkNode('summon', rng));
  while (out.length < 3 && pool.length) { const t = pool.splice(rng.int(pool.length), 1)[0]; if (!out.some(o => o.type === t)) out.push(mkNode(t, rng)); }
  return out;
}

// 结算一个节点。顺序即流派：先变后裂，分身带着突变；先裂后吞，词条叠层
export function applyNode(team, node, rng, opt = {}) {
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
export function nodeChoices(node, team, rng, realm = 5) {
  const L = team[0], pick3 = arr => { const a = [...arr], o = []; while (o.length < 3 && a.length) o.push(a.splice(rng.int(a.length), 1)[0]); return o; };
  if (node.type === 'mutate' && L) return pick3(TRAIT_KEYS.filter(k => { const e = L.tr.find(t => t[0] === k); return e ? e[1] < MAXV : L.tr.length < trCap(L); }));
  if (node.type === 'summon') return pick3(poolFor(realm));
  if (node.type === 'devour') return team.map((g, i) => i).slice(1);
  return null;
}
// ---------- 蛊市与合炼 ----------
export function rollShop(rng, realm, old = []) { const pool = poolFor(realm); return [0, 1, 2].map(i => (old[i] && old[i].frozen && !old[i].sold) ? old[i] : { sp: rng.pick(pool), frozen: false }); }
// 能否再收一只：空窍或蛊囊有空位，或者它能和已有的同种同转凑成合炼（空窍、蛊囊都算）
export const sameRank = (list, sp, rk) => list.filter(g => g.sp === sp && rankOf(g) === rk).length;
// mode：'shop' 蛊市买的（合炼 → 空窍空位 → 蛊囊）；'reward' 开茧、宝箱、夺蛊得的（合炼 → 蛊囊，不自动进空窍）
const fusable = (team, bag, g) => fuseLv(g) < RANK.fuse && rankOf(g) < RANK.max && sameRank([...team, ...(bag || [])], g.sp, rankOf(g)) >= 2;
export function canTake(team, bag, g, cap, bc = BAG.cap, mode = 'shop') { return (mode === 'shop' && team.length < cap) || (bag || []).length < bc || fusable(team, bag, g); }
export function canBuy(team, sp, cap, bag = [], bc = BAG.cap) { return canTake(team, bag, { sp, rank: baseRank(sp) }, cap, bc, 'shop'); }
// 收下一只蛊，按 mode 找去处。返回 { where: 'merge'|'team'|'bag'|null, merged }
export function placeGu(team, bag, g, cap, marks, rng, bc = BAG.cap, mode = 'shop') {
  if (fusable(team, bag, g)) { bag.push(g); return { where: 'merge', merged: mergeAll(team, marks, rng, bag) }; }
  if (mode === 'shop' && team.length < cap) { team.push(g); return { where: 'team', merged: [] }; }
  if (bag.length < bc) { bag.push(g); return { where: 'bag', merged: mergeAll(team, marks, rng, bag) }; }
  return { where: null, merged: [] };
}
export function mergeAll(team, marks = [], rng, bag = []) {   // 空窍和蛊囊一起算；合炼结果留在第一只的位置（空窍优先）
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
export function buyGu(team, sp, cap, marks, rng, bag = []) { if (!canBuy(team, sp, cap, bag)) return null; const g = newGu(sp), r = placeGu(team, bag, g, cap, marks, rng); return { gu: g, where: r.where, merged: r.merged }; }
export const sellValue = g => fuseLv(g) + 1 + (g.att ? g.att.length : 0);
export const meltValue = g => Math.round(sellValue(g) * BAG.meltMul * BAG.rarSell[Math.min(4, g.rar | 0)]);   // 炼化：按品质给卖价的 1.5 倍起

// 程序生成同阶阵容（幽灵 / 天劫），用同一套养成规则随机走路
export function genTeam(rng, power, cap = SLOTS) {
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
export function posLinks(team) {
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
export function posNote(team, i, id) {
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
export function formScore(t) {
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
export function arrangeTeam(team) {
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
export const TRIB_NAMES = ['心魔劫', '雷劫', '火劫', '风劫', '天人劫'];
// 修行路：每一阶额外解锁说明（空窍格数取 SLOT_BY_REALM，蛊池取 POOL_TIERS）
export const REALM_NOTES = ['开局三选一本命蛊', '蛊池加入一转档', '蛊池全开，可合炼到 ★3', '敌阵开始出现杀招与怪癖', '天人劫前最后一阶', '登顶，开启无尽劫'];
// 无尽劫：五转之后逐层变强，层数写进分享卡
export const ENDLESS = { basePower: 80, perFloor: 3, atkPerFloor: 1, hpPerFloor: 2, baseAtk: 5, baseHp: 10 };
export function endlessTeam(floor) {
  const f = Math.max(1, floor | 0), rng = makeRng('endless:' + f), team = genTeam(rng, ENDLESS.basePower + f * ENDLESS.perFloor, 5);
  team.forEach(g => { g.atk += ENDLESS.baseAtk + Math.floor(f * ENDLESS.atkPerFloor); g.hp += ENDLESS.baseHp + f * ENDLESS.hpPerFloor; });
  team[0].boss = 1; return team;
}
// 天劫强度表：power = 敌阵走过的养成节点数；all = 全体加成；boss = 劫主额外加成
export const TRIB = { power: [4, 14, 30, 52, 88], all: [[0, 0], [1, 2], [2, 4], [4, 7], [7, 13]], boss: [[1, 2], [2, 5], [4, 8], [6, 12], [12, 24]] };
export function tribTeam(realm) {
  const r = Math.min(realm, 4), rng = makeRng('tribulation:' + r);
  const team = genTeam(rng, TRIB.power[r], Math.min(SLOTS, slotCap(r) + 1));
  team.forEach(g => { g.atk += TRIB.all[r][0]; g.hp += TRIB.all[r][1]; });
  const b = team[0]; b.atk += TRIB.boss[r][0]; b.hp += TRIB.boss[r][1]; b.boss = 1;
  return team;
}
export function ghostTrio(rng, power, realm) {
  const names = [...GHOST_NAMES];
  return [['easy', '易', -3, 0], ['mid', '中', 0, 0], ['hard', '难', 3, 1]].map(([tier, label, d, extra]) => ({ tier, label, name: names.splice(rng.int(names.length), 1)[0], team: genTeam(rng, Math.max(0, power + d), slotCap(realm + extra)) }));
}
export const GHOST_NAMES = ['夜码人', '零点蛊师', '断点散人', '递归僧', '缓存道人', '并发狂徒', '栈溢出', '空指针', '热重载', '回滚真人', '合并冲突', '无限循环'];

// ---------- 界壁坐标码：阵容 → 位流 → base64url ----------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const SPI = Object.fromEntries(SPECIES.map((s, i) => [s.id, i]));
const TRI = Object.fromEntries(TRAIT_KEYS.map((k, i) => [k, i]));
const QUI = Object.fromEntries(QUIRK_KEYS.map((k, i) => [k, i]));
function utf8(s) { return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Buffer.from(s, 'utf8'); }
function unutf8(b) { return typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(new Uint8Array(b)) : Buffer.from(b).toString('utf8'); }
// 坐标码各版本的位宽：v1 无道痕与转数；v2 物种/词条 4 位、攻血 8 位；v3 物种/词条 6 位（装得下 64 种物种）、攻血 10 位、最多 7 格、直接存转数
const CODE_W = { 1: { sp: 4, tr: 4, q: 3, st: 8, mk: 0, rk: 0 }, 2: { sp: 4, tr: 4, q: 3, st: 8, mk: 12, rk: 2 }, 3: { sp: 6, tr: 6, q: 4, st: 10, mk: 16, rk: 3 } };
export function encodeTeam(team, meta = {}) {
  const bits = [];
  const put = (v, n) => { v = Math.max(0, Math.min(Math.floor(v) || 0, 2 ** n - 1)); for (let i = n - 1; i >= 0; i--) bits.push(Math.floor(v / 2 ** i) % 2); };
  let nm = utf8(String(meta.name || '').slice(0, 8)); if (nm.length > 24) nm = nm.slice(0, 24);
  const W = CODE_W[3]; put(3, 3); put(meta.realm || 0, 3); put(Math.min(SLOTS, team.length), 3); put(nm.length, 5); nm.forEach(b => put(b, 8));
  let mb = 0; (meta.marks || []).forEach(k => { const i = MARK_KEYS.indexOf(k); if (i >= 0) mb += 2 ** i; }); put(mb, W.mk);
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
export function decodeTeam(code) {
  try {
    code = String(code || '').trim(); const m = code.match(/[#?&]c=([A-Za-z0-9_-]+)/); if (m) code = m[1];
    if (!/^[A-Za-z0-9_-]{8,}$/.test(code)) return null;
    const bits = []; for (const ch of code) { const v = B64.indexOf(ch); for (let j = 5; j >= 0; j--) bits.push((v >> j) & 1); }
    let p = 0; const get = n => { let v = 0; for (let i = 0; i < n; i++) { if (p >= bits.length) throw 0; v = v * 2 + bits[p++]; } return v; };
    const ver = get(3); if (!CODE_W[ver]) return null; const W = CODE_W[ver];
    const realm = get(3), n = get(3), nl = get(5), nm = []; for (let i = 0; i < nl; i++) nm.push(get(8));
    const marks = []; if (W.mk) { const mb = get(W.mk); MARK_KEYS.forEach((k, i) => { if (Math.floor(mb / 2 ** i) % 2) marks.push(k); }); }
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
    return { team, realm, name: unutf8(nm), marks };
  } catch (e) { return null; }
}
// 受伤：每层 -1/-1，最多 3 层；写代码温养（token）或静置（时间）都会愈合，哪个先满算哪个。不做永久损失
export const WOUND = { max: 3, healTok: 60000, healSec: 240, loseNodePct: 0.3 };
// 战斗手感：暴击概率与倍数（种子随机，复盘可复现）
export const BATTLE = { crit: 0.10, critMul: 2 };
// 战斗回放节奏（毫秒，1 倍速基准）。界面按 playMs 自动缩放，使一局约 15–25 秒
export const EV_MS = { begin: 900, turn: 220, clash: 640, hit: 60, dmg: 200, buff: 110, trig: 300, combo: 1700, comboQuiet: 180, summon: 260, faint: 400, end: 300 };
export function playMs(log) {
  const seen = new Set(); let t = 0;
  for (const e of log) t += e.t === 'dmg' ? (e.k === 'hit' ? EV_MS.hit : EV_MS.dmg) : e.t === 'combo' ? ((e.quiet || seen.has(e.uid)) ? EV_MS.comboQuiet : (seen.add(e.uid), EV_MS.combo)) : (EV_MS[e.t] || 0);
  return t;
}
export const tempoFor = ms => Math.min(2.3, Math.max(0.6, 20000 / Math.max(1, ms)));
export function fmtNum(n) { n = Math.round(n || 0); const a = Math.abs(n); return a >= 1e8 ? (n / 1e8).toFixed(a >= 1e10 ? 0 : 2) + '亿' : a >= 1e4 ? (n / 1e4).toFixed(a >= 1e6 ? 0 : 1) + '万' : String(n); }
export function fmtTok(n) { n = n || 0; return n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n)); }
