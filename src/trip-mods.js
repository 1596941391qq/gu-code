// 蛊码 GuCode · 秘境的重开性内容（纯数据 + 纯函数，不碰 DOM）：天象、首领机制、秘境祝福、劫数。规则正本 docs/design.md 第 2.7 节。
// 战斗效果按 docs/battle-spec.md 第 4–6 节的格式写（{ when, op, tg, …数值, if }），挂在单位的 g.fx 上交给 battle()：
//   g.fx = [{ id, n, kind: 'sky' | 'boss' | 'bless' | 'food' | 'jie', eff: [...] }]；引擎触发时发 trig { uid, fx: id }，画面显示 n。
// 数值不随转数涨（up: 0）。op 'flag'（gpMul / psnMul / bumpMul / noSummon / noRevive / immune）见 battle-spec 第 11 节。

// ───────────── 天象：每趟秘境一个，进秘境前写明，双方每场都吃 ─────────────
// all = 每只蛊都挂；dao = 只挂给这一道的蛊。k = 劫数「天象加重」时数值乘几倍（scaleEff）
export const SKIES = [
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
export const SKY = Object.fromEntries(SKIES.map(s => [s.id, s]));

// ───────────── 首领机制：每个首领一条，专克一种打法，开打前写明 ─────────────
// on = 'lead' 只挂在领头身上 / 'team' 首领一方每只都挂；k = 克什么打法（写给玩家看）
export const MECHS = [
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
export const MECH = Object.fromEntries(MECHS.map(m => [m.id, m]));

// ───────────── 秘境祝福：部分房间三选一，只在这一趟有效，出秘境清零 ─────────────
// eff = 每场挂给我方每只出场蛊；trip = 秘境里的规则改动（路程、篝火、掉落、坊市、救回剩几成血、开打前回血）；fights = 只管接下来几场（不写 = 这一趟一直有效）
export const BLESSES = [
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
export const BLESS = Object.fromEntries(BLESSES.map(b => [b.id, b]));
export const blessLast = b => (b.fights ? `管接下来 ${b.fights} 场战斗` : '这一趟一直有效');

// ───────────── 劫数：通关一个秘境后能开劫一到劫十，每级叠一条限制（劫 n 含劫 1…n 全部）─────────────
// 解锁条件由道途决定（洞府一侧）；秘境只认 tripStart 的 opts.jie，结果里带回 jie，洞府记每个秘境打到第几劫
export const JIE = [
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
export const JIE_MAX = JIE.length;
export const JIE_NAMES = ['', '劫一', '劫二', '劫三', '劫四', '劫五', '劫六', '劫七', '劫八', '劫九', '劫十'];
// 劫 n 的全部规则：数值类相乘或相加，敌方效果合在一起
export function jieRules(n) {
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
export function scaleEff(list, k) {
  if (!k || k === 1) return list;
  return list.map(e => { const o = { ...e }; SCALE_KEYS.forEach(key => { if (typeof o[key] === 'number' && !(key === 'n' && e.op === 'st')) o[key] = +(o[key] * k).toFixed(3); });
    if ((e.op === 'mul' || e.op === 'flag') && typeof e.v === 'number') o.v = +(1 + (e.v - 1) * k).toFixed(3); return o; });   // 倍率类（×0.7、×2）按离 1 的距离放大
}
// 这只蛊这一场吃到的天象效果
export function skyEff(sky, daoId, k = 1) {
  const s = typeof sky === 'string' ? SKY[sky] : sky; if (!s) return [];
  return scaleEff([...(s.all || []), ...((s.dao && s.dao[daoId]) || [])], k);
}
// 祝福的规则改动合在一起（只算还在有效期里的）
export function blessRules(list) {
  const r = { road: 1, camp: null, food: 0, price: 1, rescue: 0, pre: 0 };
  (list || []).forEach(x => { const b = BLESS[x.id]; if (!b || !b.trip || (b.fights && (x.left | 0) <= 0)) return; const t = b.trip;
    if (t.road) r.road *= t.road; if (t.camp != null) r.camp = Math.max(r.camp || 0, t.camp); if (t.price) r.price *= t.price; r.food += t.food || 0; r.rescue = Math.max(r.rescue, t.rescue || 0); r.pre += t.pre || 0; });
  return r;
}
