// 蛊码 GuCode · 纯逻辑：种子随机、数据表、养成、坐标码。不碰 DOM。
export function hashStr(s) { s = String(s); let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function makeRng(seed) {
  let a = (typeof seed === 'number' ? seed : hashStr(seed)) >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.int = n => Math.floor(r() * n);
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  return r;
}

export const MAXV = 3, MAXTR = 4, MAXQ = 2, MAXATT = 2, SLOTS = 5;
export const REALMS = ['凡人', '一转', '二转', '三转', '四转', '五转'];

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
};
export const TRAIT_KEYS = Object.keys(TRAITS);

// 物种：每只一个直白词条。ab = 附蛊简字
export const SPECIES = [
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
export const SP = Object.fromEntries(SPECIES.map(s => [s.id, s]));
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
export const COMBO = Object.fromEntries(COMBOS.map(c => [c.id, c]));

let UIDN = 1;
export function nuid() { return 'g' + (UIDN++).toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
export function newGu(sp) { const s = SP[sp]; return { uid: nuid(), sp, atk: s.atk, hp: s.hp, tr: [[s.t, s.v]], q: [], att: [], wound: 0, fed: 0, mut: 0 }; }
export function starterTeam() { return ['boar', 'fire', 'twin'].map(newGu); }

export function addTrait(g, id, v, bonus) {
  const e = g.tr.find(x => x[0] === id);
  if (e) { e[1] = Math.min(MAXV, e[1] + v + (bonus ? 1 : 0)); return true; }
  if (g.tr.length >= MAXTR) return false;
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
  if (g.tr.length < MAXTR && fresh.length) { const t = rng.pick(fresh); g.tr.push([t, 1]); return t; }
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
  mutate: { n: '突变', ch: '变', cost: 55, d: '最左蛊觉醒一个随机词条（已满则某词条升层）' },
  split:  { n: '分裂', ch: '裂', cost: 60, d: '最左蛊裂出六成之力的分身，紧贴其右，词条全带' },
  devour: { n: '吞噬', ch: '吞', cost: 55, d: '最左蛊吞下右邻：得其六成攻血、全部词条与附蛊' },
  summon: { n: '招蛊', ch: '招', cost: 40, d: '招来一只新蛊，入最右空窍' },
  refine: { n: '炼附', ch: '炼', cost: 60, d: '把最右蛊炼成最左蛊的附蛊：得其四成攻血，同名词条质变 +1，配方成杀招' },
};
export function nodeOk(type, team) {
  const n = team.length;
  switch (type) {
    case 'feed': case 'temper': case 'mutate': return n > 0;
    case 'split': return n > 0 && n < SLOTS;
    case 'devour': return n >= 2;
    case 'summon': return n < SLOTS;
    case 'refine': return n >= 2 && team[0].att.length < MAXATT;
  }
  return false;
}
export function mkNode(type, rng) {
  const n = { type, cost: NODES[type].cost + rng.int(3) * 5 };
  if (type === 'summon') n.sp = rng.pick(SPECIES).id;
  return n;
}
export function rollCompass(rng, team, first) {
  const pool = Object.keys(NODES).filter(t => nodeOk(t, team));
  const out = [];
  if ((first || team.length < 2) && pool.includes('summon')) out.push(mkNode('summon', rng));
  while (out.length < 3 && pool.length) { const t = pool.splice(rng.int(pool.length), 1)[0]; if (!out.some(o => o.type === t)) out.push(mkNode(t, rng)); }
  return out;
}

// 结算一个节点。顺序即流派：先变后裂，分身带着突变；先裂后吞，词条叠层
export function applyNode(team, node, rng, opt = {}) {
  const fx = [], gone = []; let combo = null, muts = 0; const L = team[0];
  switch (node.type) {
    case 'feed': team.forEach((g, i) => { const h = [3, 2, 1, 1, 1][i]; g.hp += h; if (i === 0) g.atk += 1; fx.push({ uid: g.uid, txt: i === 0 ? `+1/+${h}` : `+${h}血` }); }); break;
    case 'temper': L.atk += 2; L.hp += 2; fx.push({ uid: L.uid, txt: '+2/+2' }); break;
    case 'mutate': { const t = mutateGu(L, rng); L.mut++; muts++; fx.push({ uid: L.uid, txt: '觉醒·' + TRAITS[t].n, k: 'mut' }); break; }
    case 'split': { const c = cloneGu(L); team.splice(1, 0, c); fx.push({ uid: c.uid, txt: '分身', k: 'new' }); break; }
    case 'devour': {
      const v = team.splice(1, 1)[0]; gone.push(v.uid);
      L.atk += Math.ceil(v.atk * 0.6); L.hp += Math.ceil(v.hp * 0.6);
      v.tr.forEach(([id, val]) => addTrait(L, id, val));
      v.q.forEach(q => { if (!L.q.includes(q) && L.q.length < MAXQ) L.q.push(q); });
      const before = comboOf(L);
      v.att.forEach(a => { if (L.att.length < MAXATT) L.att.push(a); });
      L.fed += v.fed; L.mut += v.mut;
      const c = comboOf(L); if (c && c !== before) combo = { uid: L.uid, n: c.n };
      fx.push({ uid: L.uid, txt: '吞·' + SP[v.sp].ab, k: 'eat' }); break;
    }
    case 'summon': { const g = newGu(node.sp); team.push(g); fx.push({ uid: g.uid, txt: '招来', k: 'new' }); break; }
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

// 程序生成同阶阵容（幽灵 / 天劫），用同一套养成规则随机走路
export function genTeam(rng, power) {
  const team = [newGu(rng.pick(SPECIES).id)];
  for (let i = 0; i < power; i++) {
    const types = Object.keys(NODES).filter(t => nodeOk(t, team));
    const t = (team.length < 3 && types.includes('summon') && rng() < 0.6) ? 'summon' : rng.pick(types);
    const node = mkNode(t, rng);
    applyNode(team, node, rng, { wuhuo: rng() < 0.15 });
    const tg = t === 'summon' ? team[team.length - 1] : team[0];
    if (tg) tg.fed += node.cost * 1000;
  }
  while (team.length < 2) team.push(newGu(rng.pick(SPECIES).id));
  return team;
}
export const TRIB_NAMES = ['心魔劫', '雷劫', '火劫', '风劫', '天人劫'];
export function tribTeam(realm) {
  const r = Math.min(realm, 4), rng = makeRng('tribulation:' + r);
  const team = genTeam(rng, 3 + r * 4);
  const b = team[0]; b.atk += r + 1; b.hp += 2 * r + 2; b.boss = 1;
  return team;
}
export const GHOST_NAMES = ['夜码人', '零点蛊师', '断点散人', '递归僧', '缓存道人', '并发狂徒', '栈溢出', '空指针', '热重载', '回滚真人', '合并冲突', '无限循环'];

// ---------- 界壁坐标码：阵容 → 位流 → base64url ----------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const SPI = Object.fromEntries(SPECIES.map((s, i) => [s.id, i]));
const TRI = Object.fromEntries(TRAIT_KEYS.map((k, i) => [k, i]));
const QUI = Object.fromEntries(QUIRK_KEYS.map((k, i) => [k, i]));
function utf8(s) { return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Buffer.from(s, 'utf8'); }
function unutf8(b) { return typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(new Uint8Array(b)) : Buffer.from(b).toString('utf8'); }
export function encodeTeam(team, meta = {}) {
  const bits = [];
  const put = (v, n) => { v = Math.max(0, Math.min(Math.floor(v) || 0, 2 ** n - 1)); for (let i = n - 1; i >= 0; i--) bits.push(Math.floor(v / 2 ** i) % 2); };
  let nm = utf8(String(meta.name || '').slice(0, 8)); if (nm.length > 24) nm = nm.slice(0, 24);
  put(1, 3); put(meta.realm || 0, 3); put(team.length, 3); put(nm.length, 5); nm.forEach(b => put(b, 8));
  for (const g of team.slice(0, SLOTS)) {
    put(SPI[g.sp], 4); put(g.atk, 8); put(g.hp, 8); put(g.wound || 0, 2);
    put(g.tr.length, 3); g.tr.forEach(([id, v]) => { put(TRI[id], 4); put(v, 2); });
    put(g.q.length, 2); g.q.forEach(q => put(QUI[q], 3));
    put(g.att.length, 2); g.att.forEach(a => put(SPI[a], 4));
    put(Math.round((g.fed || 0) / 10000), 18); put(g.mut || 0, 7); put(g.boss ? 1 : 0, 1);
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
    if (get(3) !== 1) return null;
    const realm = get(3), n = get(3), nl = get(5), nm = []; for (let i = 0; i < nl; i++) nm.push(get(8));
    if (n < 1 || n > SLOTS) return null;
    const team = [];
    for (let i = 0; i < n; i++) {
      const sp = SPECIES[get(4)]; if (!sp) return null;
      const g = { uid: nuid(), sp: sp.id, atk: Math.max(1, get(8)), hp: Math.max(1, get(8)), wound: get(2), tr: [], q: [], att: [] };
      const nt = get(3); for (let j = 0; j < nt; j++) { const k = TRAIT_KEYS[get(4)], v = get(2); if (k && j < MAXTR) g.tr.push([k, Math.max(1, Math.min(MAXV, v))]); }
      const nq = get(2); for (let j = 0; j < nq; j++) { const k = QUIRK_KEYS[get(3)]; if (k) g.q.push(k); }
      const na = get(2); for (let j = 0; j < na; j++) { const a = SPECIES[get(4)]; if (a && j < MAXATT) g.att.push(a.id); }
      g.fed = get(18) * 10000; g.mut = get(7); if (get(1)) g.boss = 1;
      team.push(g);
    }
    const end = p; let chk = 0; for (let i = 0; i < end; i++) if (bits[i]) chk = (chk + i * 7 + 3) % 64;
    if (get(6) !== chk) return null;
    return { team, realm, name: unutf8(nm) };
  } catch (e) { return null; }
}
export function fmtTok(n) { n = n || 0; return n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n)); }
