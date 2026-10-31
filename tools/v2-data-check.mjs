// v2 数据自检：120 种蛊的技能 / 战斗字段 / 道 / 杀招 / 食物 / 道途是否齐全、写法是否都在 battle-spec 第二版的范围里。
// 用法：node tools/v2-data-check.mjs（有问题就列出来并以 1 退出）
import * as B2 from '../src/bestiary2.js';
const errs = [], warn = [], say = (...a) => console.log(...a);
const DAO_IDS = ['li', 'yan', 'bing', 'jin', 'mu', 'tu', 'lei', 'guang', 'an', 'xue', 'du', 'zhi', 'hun', 'nu', 'yu', 'zhou'];
const OPS = new Set(['dmg', 'heal', 'shield', 'buff', 'st', 'summon', 'gp', 'adv', 'delay', 'pull', 'push', 'knock', 'draw', 'swap', 'eat', 'cleanse', 'endure', 'mul', 'copyNat']);
const WHEN = new Set(['prep', 'start', 'round', 'pre', 'attack', 'cast', 'hit', 'lethal', 'death', 'kill', 'allyDeath', 'foeDeath', 'summon', 'front', 'foeFront', 'low', 'inflict', 'allyInflict', 'deal', 'take']);
const PICK = new Set(['front', 'last', 'low', 'lowp', 'top', 'fast', 'rand', 'all', 'adj', 'near', 'row', 'col', 'behind', 'ahead']);
const ALLY_ONLY = new Set(['adj', 'near', 'row', 'col', 'behind', 'ahead']);
const SHAPE = new Set(['one', 'row', 'col', 'cross', 'ring', 'diag', 'back']);
const ST = new Set(['psn', 'burn', 'stun', 'web', 'guard', 'taunt', 'mark', 'seal', 'chill']);
const FX = new Set(['fire', 'needle', 'pounce', 'summon', 'slash', 'bolt', 'frost', 'spore', 'shield', 'heal', 'roar', 'drain']);
const ATKFX = new Set(['pounce', 'slash', 'bite', 'spit', 'needle', 'bolt', 'spore', 'wave']);
const condOk = s => String(s).split('&').every(x => /^(front|back|last|first|melee|ranged|round%2|dead\.adj|dead\.ahead|tg\.(full|psn|burn|stun|chill|mark|guard|summon)|col=[012]|k=(psn|burn|chill|stun|web|mark|seal)|hp<\d+|tg\.hp<\d+|round>=\d+|kind=(hit|skill))$/.test(x.trim()));
function chkEff(where, e, needWhen) {
  if (!OPS.has(e.op)) errs.push(`${where}: 未知 op ${e.op}`);
  if (needWhen && !WHEN.has(e.when)) errs.push(`${where}: 未知时机 ${e.when}`);
  if (e.op === 'mul' && !['deal', 'take'].includes(e.when)) errs.push(`${where}: mul 只能在 deal/take`);
  if (e.op === 'endure' && e.when !== 'lethal') errs.push(`${where}: endure 只能在 lethal`);
  if (e.tg && !['self', 'same'].includes(e.tg)) {
    const [sd, rest = ''] = e.tg.split('.'), [pk] = rest.split(':');
    if (['tg', 'src', 'killer'].includes(sd)) { if (rest) errs.push(`${where}: tg 写法 ${e.tg}`); }
    else if (!['foe', 'ally'].includes(sd) || !PICK.has(pk)) errs.push(`${where}: tg 写法 ${e.tg}`);
    else if (sd === 'foe' && ALLY_ONLY.has(pk)) errs.push(`${where}: ${e.tg} 只用于 ally`);
  }
  if (e.shape && !SHAPE.has(e.shape)) errs.push(`${where}: 形状 ${e.shape}`);
  if (e.op === 'st' && !ST.has(e.k)) errs.push(`${where}: 状态 ${e.k}`);
  if (e.op === 'swap' && !['self', 'front', 'back'].includes(e.with)) errs.push(`${where}: swap 要写 with`);
  if (e.if && !condOk(e.if)) errs.push(`${where}: 条件 ${e.if}`);
}
// ---- 物种 ----
const ids = Object.keys(B2.DAO120);
if (ids.length !== 120) errs.push(`物种数 ${ids.length} ≠ 120`);
if (B2.SPECIES2.length !== 56) errs.push(`新物种 ${B2.SPECIES2.length} ≠ 56`);
const abs = new Map(), chs = new Map();
const OLD_AB = { boar: '豕', fire: '火', twin: '影', iron: '甲', thorn: '棘', mantis: '螳', bone: '骨', queen: '蜂', cicada: '蝉', drum: '鼓', scorp: '蝎', moth: '蛾', ant: '蚁', firefly: '萤', stick: '竹', leech: '蛭', dung: '丸', tiger: '虎', webspider: '网', aphid: '蚜', hairy: '毛', cent: '蜈', wasp: '胡', spider: '母', mole: '蝼', gecko: '守', qingfu: '蚨', bomb: '囊', silk: '茧', mosq: '蚊', rhino: '犀', gold: '龟', qant: '后', flea: '蚤', bfly: '翼', sleep: '眠', stag: '锹', glut: '饕', toad: '蟾', cricket: '促', locust: '蝗', mirror: '镜', hive: '巢', fly: '蝇', bury: '葬', frost: '蛉', lure: '蝶', antlion: '狮', mayfly: '蜉', thunder: '雷', tortoise: '玄', puppet: '傀', hairworm: '线', urn: '瓮', hex: '魇', saw: '牛', dfly: '霆', orchid: '兰', taisui: '岁', yue: '岳', jinchan: '金', guangyin: '光', fate: '命', nirvana: '涅' };
for (const id of ids) {
  const sp = B2.SPECIES2.find(s => s.id === id), p = B2.PATCH64[id], ab = (sp && sp.ab) || (p && p.ab) || OLD_AB[id];
  if (abs.has(ab)) errs.push(`简字重复 ${ab}: ${abs.get(ab)} / ${id}`); abs.set(ab, id);
  if (!DAO_IDS.includes(B2.DAO120[id])) errs.push(`${id}: 道 ${B2.DAO120[id]}`);
  const b = B2.BATTLE120[id];
  if (!b || !(b.spd >= 60 && b.spd <= 160)) errs.push(`${id}: 速 ${b && b.spd}`);
  if (!['melee', 'ranged'].includes(b.reach)) errs.push(`${id}: 远近 ${b.reach}`);
  if (b.reach === 'ranged' && !PICK.has(b.aim)) errs.push(`${id}: 远程没写 aim`);
  if (!ATKFX.has(b.atkFx)) errs.push(`${id}: 普攻动作 ${b.atkFx}`);
  const st = B2.ST120[id]; if (!st || !st.some(Boolean)) errs.push(`${id}: 没有攻血表`);
  const k = B2.NAT_OF(id), t = B2.NATS[k];
  if (!t) { errs.push(`${id}: 没有被动技能 ${k}`); continue; }
  if (chs.has(t.ch)) errs.push(`技能印重复 ${t.ch}: ${chs.get(t.ch)} / ${k}`); chs.set(t.ch, k);
  if (!t.keepHooks) {
    if (!t.eff.length) errs.push(`${k}: 没有效果`);
    t.eff.forEach((e, i) => chkEff(`${id}.nat.eff${i}`, e, true));
    t.awEff.forEach((L, j) => { if (!L.length) errs.push(`${k}: 觉醒 ${j + 1} 没有效果`); L.forEach((e, i) => chkEff(`${id}.nat.aw${j + 1}.${i}`, e, true)); });
    // 描述里括号数字要在效果里找得到
    const nums = new Set([...t.eff, ...t.awEff.flat()].flatMap(e => ['atk', 'a0', 'mx', 'tatk', 'tmx', 'n', 'hp', 'spd'].map(x => e[x]).filter(v => typeof v === 'number').map(v => Math.round(Math.abs(v) * 100))));
    [t.src.d, ...t.src.aw].join(' ').replace(/〔(\d+)〕/g, (_, x) => { if (!nums.has(+x)) errs.push(`${k}: 描述里的 〔${x}〕 在效果里没有`); return ''; });
  }
  if (/词条|副词/.test([t.src.d, ...t.src.aw].join())) errs.push(`${k}: 描述里有「词条」`);
  const a = b.act;
  if (a) {
    if (!FX.has(a.fx)) errs.push(`${id}.act: fx ${a.fx}`);
    if (!(a.cap >= 70 && a.cap <= 150)) errs.push(`${id}.act: cap ${a.cap}`);
    a.eff.forEach((e, i) => chkEff(`${id}.act.eff${i}`, e, false));
    a.aw.forEach((L, j) => { if (!L.length || !a.awd[j]) errs.push(`${id}.act: 觉醒 ${j + 1} 缺`); L.forEach((e, i) => chkEff(`${id}.act.aw${j + 1}.${i}`, e, false)); });
  }
}
const nAct = ids.filter(id => B2.BATTLE120[id].act).length;
say(`物种 ${ids.length}，主动技 ${nAct}（${Math.round(nAct / ids.length * 100)}%），远程 ${ids.filter(id => B2.BATTLE120[id].reach === 'ranged').length}`);
const byDao = {}; ids.forEach(id => { (byDao[B2.DAO120[id]] = byDao[B2.DAO120[id]] || []).push(id); });
say('各道只数：' + DAO_IDS.map(d => `${d} ${(byDao[d] || []).length}`).join('  '));
// ---- 通用效果跨道 ----
for (const [k, nm] of Object.entries(B2.KW)) {
  const g = new Set(), u = new Set();
  ids.forEach(id => { const w = B2.KW120[id]; if (w.give.includes(k)) g.add(B2.DAO120[id]); if (w.use.includes(k)) u.add(B2.DAO120[id]); });
  say(`  ${nm}：会挂 ${g.size} 道 [${[...g].join(' ')}]，专打 ${u.size} 道 [${[...u].join(' ')}]`);
  if (g.size < 4) errs.push(`通用效果「${nm}」只有 ${g.size} 个道会挂（要 ≥4）`);
}
say('原著名：' + B2.CANON.map(([, n]) => n).join('、'));
// ---- 其余数据文件（存在才查）----
try {
  const D = await import('../src/daos.js');
  if (D.DAOS.length < 12 || D.DAOS.length > 16) errs.push(`道 ${D.DAOS.length} 个`);
  D.DAOS.forEach(d => { if (d.r6) errs.push(`${d.id}: 还有 6 只档`); if (!d.r2 || !d.r4) errs.push(`${d.id}: 缺 2/4 只档`); [d.r2, d.r4].forEach((r, i) => (r && r.eff || []).forEach((e, j) => chkEff(`dao.${d.id}.r${i ? 4 : 2}.${j}`, e, true))); });
  ids.forEach(id => { if (D.DAO_OF[id] !== B2.DAO120[id]) errs.push(`daos.js 的 DAO_OF[${id}] = ${D.DAO_OF[id]}，物种表是 ${B2.DAO120[id]}`); });
  say(`道 ${D.DAOS.length} 个，相冲 ${D.DAO_CLASH.length} 对`);
} catch (e) { warn.push('daos.js: ' + e.message); }
try {
  const K = await import('../src/combos2.js'), L = K.COMBOS2;
  let cross = 0;
  L.forEach(c => {
    c.need.forEach(x => { if (!B2.DAO120[x]) errs.push(`杀招 ${c.id}: 没有物种 ${x}`); });
    if (!c.need.includes(c.core)) errs.push(`杀招 ${c.id}: 核心不在配方里`);
    (c.eff || []).forEach((e, i) => chkEff(`combo.${c.id}.${i}`, { when: c.when, ...e }, true));
    if (c.from) { const b = L.find(x => x.id === c.from); if (!b || !b.need.every(x => c.need.includes(x)) || b.core !== c.core) errs.push(`进阶 ${c.id}: 原杀招对不上`); }
    if (new Set(c.need.map(x => B2.DAO120[x])).size > 1) cross++;
  });
  const base = L.filter(c => !c.from).length;
  say(`杀招 ${base} 个 + 进阶 ${L.length - base} 个，跨道 ${cross}/${L.length}`);
  if (cross * 2 < L.length) errs.push(`跨道杀招 ${cross}/${L.length}，不到一半`);
} catch (e) { warn.push('combos2.js: ' + e.message); }
try {
  const F = await import('../src/foods.js'), L = F.FOOD_ITEMS || F.FOODS;
  const kinds = {}; L.forEach(f => { kinds[f.kind] = (kinds[f.kind] || 0) + 1; (f.eff || []).forEach((e, i) => chkEff(`food.${f.id}.${i}`, e, true)); });
  say(`食物 ${L.length} 种：` + Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(' '));
} catch (e) { warn.push('foods.js: ' + e.message); }
try {
  const T = await import('../src/timeline.js');
  const lockedSp = new Set(T.LOCKED.species), unlock = new Set(T.TIMELINE.flatMap(t => t.unlock.filter(u => u.k === 'species').map(u => u.id)));
  lockedSp.forEach(id => { if (!B2.DAO120[id]) errs.push(`道途锁了不存在的蛊 ${id}`); if (!unlock.has(id)) errs.push(`锁住的蛊 ${id} 没有成就能解锁`); });
  say(`道途 ${T.TIMELINE.length} 条，开局可买 ${ids.filter(id => !lockedSp.has(id) && !(B2.SPECIES2.find(s => s.id === id) || {}).immortal && !['guangyin', 'fate', 'nirvana'].includes(id)).length} 种`);
} catch (e) { warn.push('timeline.js: ' + e.message); }
warn.forEach(w => say('  （跳过）' + w));
if (errs.length) { say(`\n${errs.length} 个问题：`); errs.forEach(e => say('  ✗ ' + e)); process.exit(1); }
say('\n全部通过');
