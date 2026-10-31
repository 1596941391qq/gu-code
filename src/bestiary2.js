// 蛊码 GuCode · 蛊典第二卷（v2 第三版规则）：120 种蛊的技能、战斗字段、每转攻血表。纯数据 + 纯函数，不 import 任何文件。
// 规则：docs/design.md 2.6（只有技能：被动技能 = 本命，必有；约四成另有主动技能；三转、五转各觉醒一次，两个技能一起强化）。
// 格式：docs/battle-spec.md 第二版（3×3 阵盘、shape 形状、knock/draw/swap/eat、chill 寒、inflict/allyInflict 跨道触发）。
//
// 导出：
//   SPECIES2[i]  新 56 种：{ id, n, ab, dao, rank, tier, nat, atk, hp（一转口径比例）, role, lore, spd, reach, aim, atkFx, act, st, canon?, immortal? }
//   PATCH64[id]  旧 64 种的补丁：{ dao, spd, reach, aim, atkFx, act, st, n?/ab?/lore?/canon?（换成原著名的那几种） }，集成时 Object.assign(SP[id], PATCH64[id])
//   NATS[key]    全部 120 种的被动技能（声明式）：{ n, ch, trig, d(v, m), aw: [m => 三转, m => 五转], eff, awEff: [[三转追加], [五转追加]], hooks: {} }
//                旧 64 种用原来的 key（rage、blaze……），集成时整条替换 NEW_TRAITS[key]，battle.js 的 NAT_K 里对应项删掉。
//                只有 rewind（春秋蝉：全队覆灭时倒转光阴）保留原钩子，这里只换描述（keepHooks: true）。
//   技能数值：〔〕括住的数随转数变：显示值 = 基准 × natK(转数)，natK(r) = 1 + NAT_UP × (r − 1)；eff 里每条带同样的 up，引擎按 spec 4.1 乘。
//            d(v, m) 的 m 照旧是 ui 传进来的 natMulOf(转数)，这里换算回转数。没括号的数（概率、寒层数、蛊力、免死留血、伤害倍数）不随转数变。
//   主动技 act = { n, cap, fx, d, eff, aw: [[三转追加], [五转追加]], awd: ['三转说明', '五转说明'] }，数值按 spec 默认 up 0.12 随转数涨。
//   KW / KW120   通用效果（中毒 灼烧 冰寒 护体、格挡 召唤 吞噬 击退、拉近 印记）：每种蛊会挂哪些（give）、专打哪些（use），蛊典和杀招图鉴的线索用。
//   ST120[id]    每转攻血表（下标 = 转数，[攻, 血]，基础转数以下为 null；仙蛊只有 [6]）。BATTLE120[id] = { spd, reach, aim, atkFx, act, st }。
//   DAO120[id]   120 种各属哪一道。SUMMONS2 新召唤物名。CANON 标了 canon: true 的原著蛊名，方便核对。
// 不含模型偏好（food / eats）字段，lore 不带这类后缀。界面文字里不出现「词条」。

export const NAT_UP = 0.15;
export const natK = r => 1 + NAT_UP * (Math.max(1, Math.min(6, r || 1)) - 1);
const rOfM = m => (m >= 2 ? 1 + (m - 2) / 0.85 : 1);
const fmt = (s, k) => s.replace(/〔(\d+)〕/g, (_, x) => String(Math.round(+x * k)));
const NUMK = ['atk', 'a0', 'mx', 'tatk', 'tmx', 'n', 'flat'];
const E = (when, op, tg, o = {}) => ({ when, op, tg, ...o });
const withUp = e => (e.up == null && (NUMK.some(k => e[k]) || e.op === 'buff') ? { ...e, up: NAT_UP } : e);
const N = (n, ch, trig, d, aw, eff, awEff, extra = {}) => ({
  n, ch, trig, innate: true, nat: true, v2: true, hooks: {}, ...extra,
  d: (v, m = 2) => fmt(d, natK(rOfM(m))), aw: aw.map(x => (m = 2) => fmt(x, natK(rOfM(m)))),
  eff: eff.map(withUp), awEff: awEff.map(L => L.map(withUp)), src: { d, aw },
});
export const natText = (key, rank) => { const t = NATS[key]; return t ? fmt(t.src.d, natK(rank)) : ''; };

// ======================= 被动技能（本命）· 120 种 =======================
export const NATS = {
  // ---------- 力道 ----------
  rage: N('越伤越狂', '猛', '受击', '开战嘲讽敌方（到下一轮）；被打中还活着：攻 +〔6〕%（每场最多 8 次）',
    ['血量第一次掉到一半以下：冲撞同一行最近的敌蛊，攻击 〔150〕%，击退一格', '第一次受到致命伤时留 1 血，攻 +〔15〕%'],
    [E('start', 'st', 'self', { k: 'taunt', n: 2 }), E('hit', 'buff', 'self', { atk: 0.06, max: 8 })],
    [[E('low', 'dmg', 'foe.front', { atk: 1.5 }), E('low', 'knock', 'same', { v: 1 })], [E('lethal', 'endure', null, { v: 0, max: 1 }), E('lethal', 'buff', 'self', { atk: 0.15, max: 1 })]]),
  blitz: N('黑豕冲阵', '疾', '出手', '第一次普攻额外打出攻击 〔100〕%，并把目标击退一格',
    ['开战先冲：同一行最近的敌蛊受攻击 〔60〕%，击退一格', '打满血的敌蛊，伤害 +20%'],
    [E('attack', 'dmg', 'tg', { atk: 1.0, if: 'first' }), E('attack', 'knock', 'tg', { v: 1, if: 'first' })],
    [[E('start', 'dmg', 'foe.front', { atk: 0.6 }), E('start', 'knock', 'same', { v: 1 })], [E('deal', 'mul', null, { v: 1.2, if: 'tg.full' })]]),
  beat: N('战鼓', '战', '每轮', '每轮开始：同一行身前的友蛊攻 +〔5〕%',
    ['同时给它本蛊最大血量 〔5〕% 的护体', '每 3 轮全体友蛊攻 +〔3〕%'],
    [E('round', 'buff', 'ally.ahead', { atk: 0.05 })],
    [[E('round', 'shield', 'ally.ahead', { mx: 0.05 })], [E('round', 'buff', 'ally.all', { atk: 0.03, every: 3 })]]),
  execute: N('斩首', '斩', '出手', '普攻目标血量不过半时，额外打出攻击 〔40〕%',
    ['目标有印记时，再额外打出 〔25〕%', '击杀后回复最大血量 〔5〕%'],
    [E('attack', 'dmg', 'tg', { atk: 0.4, if: 'tg.hp<50' })],
    [[E('attack', 'dmg', 'tg', { atk: 0.25, if: 'tg.mark' })], [E('kill', 'heal', 'self', { mx: 0.05 })]]),
  gorge: N('吞元', '饕', '出手', '普攻后，目标血量不过两成或是召唤物，就把它吞噬，得到它三成攻血',
    ['吞的门槛提高到三成', '击杀时攻 +〔4〕%'],
    [E('attack', 'eat', 'tg', { v: 0.2, gain: 0.3 })],
    [[E('attack', 'eat', 'tg', { v: 0.3, gain: 0.3 })], [E('kill', 'buff', 'self', { atk: 0.04 })]]),
  cleave: N('横扫', '扫', '出手', '普攻后，目标那一整列的敌蛊各受这一下的 〔30〕%',
    ['扫的比例再加 〔15〕%', '本蛊打冰寒中的敌蛊，伤害 +13%（冻住的庄稼一扫就断）'],
    [E('attack', 'dmg', 'tg', { n: 0.3, shape: 'col' })],
    [[E('attack', 'dmg', 'tg', { n: 0.15, shape: 'col' })], [E('deal', 'mul', null, { v: 1.13, if: 'tg.chill' })]]),
  bearforce: N('熊力', '熊', '出手', '普攻额外打出本蛊最大血量 〔3〕% 的伤害；40% 机会把目标击退一格（撞上就两只都受伤）',
    ['开战得到最大血量 〔10〕% 的护体', '血量第一次掉到一半以下时攻 +〔13〕%'],
    [E('attack', 'dmg', 'tg', { mx: 0.03 }), E('attack', 'knock', 'tg', { v: 1, chance: 0.4 })],
    [[E('start', 'shield', 'self', { mx: 0.1 })], [E('low', 'buff', 'self', { atk: 0.13 })]]),
  skyhold: N('擎天', '擎', '每轮', '每轮开始攻 +〔3〕%；同一列的友蛊攻 +〔2〕%（各最多 6 次）',
    ['开战：同一列的友蛊各得本蛊最大血量 〔10〕% 的护体', '击杀时攻 +〔5〕%'],
    [E('round', 'buff', 'self', { atk: 0.03, max: 6 }), E('round', 'buff', 'ally.col', { atk: 0.02, max: 6 })],
    [[E('start', 'shield', 'ally.col', { mx: 0.1 })], [E('kill', 'buff', 'self', { atk: 0.05 })]]),

  // ---------- 炎道 ----------
  blaze: N('流火', '火', '开战', '开战：烧敌方随机一只，攻击 〔100〕%，灼烧 2 轮（攻击 〔20〕%）',
    ['火星溅到它周围一圈，各受攻击 〔30〕%', '每 3 轮再烧一次（攻击 〔60〕%，灼烧 2 轮）'],
    [E('start', 'dmg', 'foe.rand', { atk: 1.0 }), E('start', 'st', 'same', { k: 'burn', n: 2, atk: 0.2 })],
    [[E('start', 'dmg', 'same', { atk: 0.3, shape: 'ring' })], [E('round', 'dmg', 'foe.rand', { atk: 0.6, every: 3 }), E('round', 'st', 'same', { k: 'burn', n: 2, atk: 0.2, every: 3 })]]),
  burst: N('爆囊', '爆', '亡语', '倒下时炸最近的敌蛊和它周围一圈，各受攻击 〔100〕%',
    ['炸到的蛊灼烧 2 轮（攻击 〔20〕%）', '炸到的蛊各击退一格'],
    [E('death', 'dmg', 'foe.front', { atk: 1.0, shape: 'ring' })],
    [[E('death', 'st', 'same', { k: 'burn', n: 2, atk: 0.2 })], [E('death', 'knock', 'same', { v: 1 })]]),
  phoenix: N('涅火', '涅', '免死', '第一次受到致命伤：化作劫火，敌方全体各受攻击 〔30〕%、灼烧 3 轮（攻击 〔12〕%），自己以 40% 血重生',
    ['重生时全体友蛊回复最大血量 〔10〕%', '每 3 轮劫火再燃：敌方全体灼烧 2 轮（攻击 〔4〕%）'],
    [E('lethal', 'endure', null, { v: 0.4, max: 1 }), E('lethal', 'dmg', 'foe.all', { atk: 0.3, max: 1 }), E('lethal', 'st', 'same', { k: 'burn', n: 3, atk: 0.12, max: 1 })],
    [[E('lethal', 'heal', 'ally.all', { tmx: 0.1, max: 1 })], [E('round', 'st', 'foe.all', { k: 'burn', n: 2, atk: 0.04, every: 3 })]]),
  scorch: N('灼咬', '灼', '出手', '普攻命中：目标灼烧 2 轮（攻击 〔15〕%）',
    ['本蛊打灼烧中的敌蛊，伤害 +20%', '灼烧蔓延到目标那一整行（攻击 〔5〕%）'],
    [E('attack', 'st', 'tg', { k: 'burn', n: 2, atk: 0.15 })],
    [[E('deal', 'mul', null, { v: 1.2, if: 'tg.burn' })], [E('attack', 'st', 'tg', { k: 'burn', n: 2, atk: 0.05, shape: 'row' })]]),
  wingfire: N('焚翅', '焚', '每轮', '每轮开始：烧掉自己最大血量 3%，对敌方全体造成攻击 〔10〕%',
    ['血量低于一半时再烧一遍', '倒下时敌方全体灼烧 2 轮（攻击 〔10〕%）'],
    [E('round', 'dmg', 'self', { mx: 0.03, up: 0, pierce: 1 }), E('round', 'dmg', 'foe.all', { atk: 0.1 })],
    [[E('round', 'dmg', 'foe.all', { atk: 0.1, if: 'hp<50' })], [E('death', 'st', 'foe.all', { k: 'burn', n: 2, atk: 0.1 })]]),
  coal: N('积炭', '炭', '受击', '被普攻打中：打它的那只灼烧 2 轮（攻击 〔12〕%），自己攻 +〔2〕%（每场最多 5 次）',
    ['开战得到最大血量 〔10〕% 的护体', '倒下时炭火迸出：最近的敌蛊和它十字范围各受攻击 〔30〕%'],
    [E('hit', 'st', 'src', { k: 'burn', n: 2, atk: 0.12, if: 'kind=hit' }), E('hit', 'buff', 'self', { atk: 0.02, if: 'kind=hit', max: 5 })],
    [[E('start', 'shield', 'self', { mx: 0.1 })], [E('death', 'dmg', 'foe.front', { atk: 0.3, shape: 'cross' })]]),
  ignite: N('燧火', '燧', '引燃', '每有敌蛊挂上灼烧（谁挂的都算），燧石跟着对它打出攻击 〔12〕%（每场最多 10 次）；每 2 轮让最近的敌蛊灼烧 2 轮（攻击 〔10〕%）',
    ['单数轮也点', '跟打的伤害再加 〔4〕%'],
    [E('inflict', 'dmg', 'tg', { atk: 0.12, if: 'k=burn', max: 10 }), E('allyInflict', 'dmg', 'tg', { atk: 0.12, if: 'k=burn', max: 10 }), E('round', 'st', 'foe.front', { k: 'burn', n: 2, atk: 0.1, every: 2 })],
    [[E('round', 'st', 'foe.front', { k: 'burn', n: 2, atk: 0.1, if: 'round%2' })], [E('inflict', 'dmg', 'tg', { atk: 0.04, if: 'k=burn', max: 10 }), E('allyInflict', 'dmg', 'tg', { atk: 0.04, if: 'k=burn', max: 10 })]]),
  lavashell: N('熔壳', '熔', '受击', '被近战打中：打它的那只受本蛊最大血量 〔3〕% 的伤害，灼烧 2 轮（攻击 〔12〕%）',
    ['开战：上下左右相邻的友蛊各得本蛊最大血量 〔4〕% 的护体', '血量第一次掉到一半以下：熔壳爆开，最近的敌蛊和它周围一圈各受本蛊最大血量 〔4〕%'],
    [E('hit', 'dmg', 'src', { mx: 0.03, if: 'melee' }), E('hit', 'st', 'src', { k: 'burn', n: 2, atk: 0.12, if: 'melee' })],
    [[E('start', 'shield', 'ally.adj', { mx: 0.04 })], [E('low', 'dmg', 'foe.front', { mx: 0.04, shape: 'ring' })]]),

  // ---------- 冰雪道 ----------
  frost: N('霜冻', '霜', '出手', '普攻命中：目标冰寒 1 层（每层速 -15%，叠到三层冻住一次）',
    ['寒气沿整行蔓延：目标那一整行都冰寒 1 层', '本蛊打冰寒中的敌蛊，伤害 +13%'],
    [E('attack', 'st', 'tg', { k: 'chill', n: 1 })],
    [[E('attack', 'st', 'tg', { k: 'chill', n: 1, shape: 'row' })], [E('deal', 'mul', null, { v: 1.13, if: 'tg.chill' })]]),
  icesilk: N('冰丝', '凝', '出手', '普攻命中：目标冰寒 1 层',
    ['开战：上下左右相邻的友蛊各得本蛊最大血量 〔8〕% 的冰茧护体', '开战：敌方速最快的那只冰寒 2 层'],
    [E('attack', 'st', 'tg', { k: 'chill', n: 1 })],
    [[E('start', 'shield', 'ally.adj', { mx: 0.08 })], [E('start', 'st', 'foe.fast', { k: 'chill', n: 2 })]]),
  snowhop: N('踏雪', '踏', '出手', '普攻打冰寒中的敌蛊，额外打出攻击 〔40〕%，并让它行动条推后 10%',
    ['第一次普攻让目标冰寒 2 层', '击杀后行动条提前 20%'],
    [E('attack', 'dmg', 'tg', { atk: 0.4, if: 'tg.chill' }), E('attack', 'delay', 'tg', { v: 0.1, if: 'tg.chill' })],
    [[E('attack', 'st', 'tg', { k: 'chill', n: 2, max: 1 })], [E('kill', 'adv', 'self', { v: 0.2 })]]),
  drag: N('迟滞', '迟', '开战', '开战：敌方速最快的两只各冰寒 1 层',
    ['每 3 轮再来一次', '冰寒中的敌蛊打它，伤害 -10%'],
    [E('start', 'st', 'foe.fast:2', { k: 'chill', n: 1 })],
    [[E('round', 'st', 'foe.fast:2', { k: 'chill', n: 1, every: 3 })], [E('take', 'mul', null, { v: 0.9, if: 'tg.chill' })]]),
  hush: N('噤声', '噤', '开战', '开战：敌方攻最高的蛊和它那一列被封印 2 轮（蛊力不涨）',
    ['被封印的同时冰寒 1 层', '友蛊每让一只敌蛊冰寒，寒蝉对它打出攻击 〔10〕%'],
    [E('start', 'st', 'foe.top', { k: 'seal', n: 3, shape: 'col' })],
    [[E('start', 'st', 'same', { k: 'chill', n: 1 })], [E('allyInflict', 'dmg', 'tg', { atk: 0.1, if: 'k=chill' })]]),
  hailstorm: N('落雹', '雹', '每轮', '单数轮开始：冰雹砸敌方随机一只和它周围一圈，各受攻击 〔12〕%、冰寒 1 层',
    ['双数轮也砸一只（攻击 〔20〕%）', '本蛊打冰寒中的敌蛊，伤害 +13%'],
    [E('round', 'dmg', 'foe.rand', { atk: 0.12, shape: 'ring', if: 'round%2' }), E('round', 'st', 'same', { k: 'chill', n: 1, if: 'round%2' })],
    [[E('round', 'dmg', 'foe.rand', { atk: 0.2, every: 2 })], [E('deal', 'mul', null, { v: 1.13, if: 'tg.chill' })]]),
  permafrost: N('冻原', '冻', '受击', '被近战打中：打它的那只冰寒 1 层',
    ['开战得到最大血量 〔15〕% 的护体', '本蛊打冻住（眩晕）中的敌蛊，伤害 +15%'],
    [E('hit', 'st', 'src', { k: 'chill', n: 1, if: 'melee' })],
    [[E('start', 'shield', 'self', { mx: 0.15 })], [E('deal', 'mul', null, { v: 1.15, if: 'tg.stun' })]]),

  // ---------- 金道 ----------
  ironskin: N('铜皮', '铁', '开战', '开战得到最大血量 〔20〕% 的护体',
    ['每 3 轮补 〔8〕% 护体', '开战：上下左右相邻的友蛊各得本蛊最大血量 〔4〕% 的护体'],
    [E('start', 'shield', 'self', { mx: 0.2 })],
    [[E('round', 'shield', 'self', { mx: 0.08, every: 3 })], [E('start', 'shield', 'ally.adj', { mx: 0.04 })]]),
  scale: N('坚鳞', '鳞', '受伤', '受到的伤害 -15%',
    ['血量不过半时再 -15%', '被打中时攻 +〔1.5〕%（每场最多 8 次）'],
    [E('take', 'mul', null, { v: 0.85 })],
    [[E('take', 'mul', null, { v: 0.85, if: 'hp<50' })], [E('hit', 'buff', 'self', { atk: 0.015, max: 8 })]]),
  gild: N('镀金', '镀', '亡语', '倒下时：同一行身后的友蛊得到本蛊最大血量 〔30〕% 的护体',
    ['开战先给身后的友蛊镀一层（〔10〕%）', '倒下时镀给全体友蛊（各 〔6〕%）'],
    [E('death', 'shield', 'ally.behind', { mx: 0.3 })],
    [[E('start', 'shield', 'ally.behind', { mx: 0.1 })], [E('death', 'shield', 'ally.all', { mx: 0.06 })]]),
  coin: N('吐宝', '宝', '击杀', '击杀：全体友蛊得到本蛊最大血量 〔6〕% 的护体',
    ['同时回复本蛊最大血量 〔5〕%', '击杀时攻 +〔4〕%'],
    [E('kill', 'shield', 'ally.all', { mx: 0.06 })],
    [[E('kill', 'heal', 'ally.all', { mx: 0.05 })], [E('kill', 'buff', 'self', { atk: 0.04 })]]),
  sunder: N('破甲', '破', '出手', '普攻后再撕一口：攻击 〔20〕% 加目标最大血量 〔2〕%，无视护体',
    ['目标挂着「格挡」时，这一口翻倍', '击杀时得到最大血量 〔5〕% 的护体'],
    [E('attack', 'dmg', 'tg', { atk: 0.2, tmx: 0.02, pierce: 1 })],
    [[E('attack', 'dmg', 'tg', { atk: 0.2, tmx: 0.02, pierce: 1, if: 'tg.guard' })], [E('kill', 'shield', 'self', { mx: 0.05 })]]),
  jadeskin: N('玉皮', '玉', '开战', '开战得到最大血量 〔10〕% 的护体，并挂「格挡」1 次（下一次受伤减半）',
    ['上下左右相邻的友蛊开战也各挂「格挡」1 次', '每 3 轮重新挂「格挡」1 次'],
    [E('start', 'shield', 'self', { mx: 0.1 }), E('start', 'st', 'self', { k: 'guard', n: 1 })],
    [[E('start', 'st', 'ally.adj', { k: 'guard', n: 1 })], [E('round', 'st', 'self', { k: 'guard', n: 1, every: 3 })]]),
  interlock: N('连锁', '锁', '开战', '开战：上下左右相邻的友蛊各得本蛊最大血量 〔10〕% 的护体',
    ['同一行身前的友蛊再挂「格挡」1 次', '每 3 轮：相邻的友蛊再各得本蛊最大血量 〔5〕% 的护体'],
    [E('start', 'shield', 'ally.adj', { mx: 0.1 })],
    [[E('start', 'st', 'ally.ahead', { k: 'guard', n: 1 })], [E('round', 'shield', 'ally.adj', { mx: 0.05, every: 3 })]]),
  whitejade: N('白玉', '璧', '低血', '血量第一次掉到一半以下：化作白玉，挂「格挡」3 次并嘲讽 2 轮',
    ['化玉时同一列的友蛊各得本蛊最大血量 〔12〕% 的护体', '化玉时回复最大血量 〔8〕%'],
    [E('low', 'st', 'self', { k: 'guard', n: 3 }), E('low', 'st', 'self', { k: 'taunt', n: 2 })],
    [[E('low', 'shield', 'ally.col', { mx: 0.12 })], [E('low', 'heal', 'self', { mx: 0.08 })]]),

  // ---------- 木道 ----------
  bramble: N('荆棘', '荆', '受击', '被近战打中：扎回这一下的 〔40〕%',
    ['站在最前（同一行身前没有友蛊）时，再扎回 〔30〕%', '扎中的蛊中毒（攻击 〔8〕%）'],
    [E('hit', 'dmg', 'src', { n: 0.4, if: 'melee' })],
    [[E('hit', 'dmg', 'src', { n: 0.3, if: 'melee&front' })], [E('hit', 'st', 'src', { k: 'psn', atk: 0.08, if: 'melee' })]]),
  ripen: N('蓄势', '蓄', '每轮', '同一行身前有友蛊挡着时，每轮开始攻血 +〔6〕%；每 3 轮给身前那只友蛊挂「格挡」1 次',
    ['站在最前时，每轮得到最大血量 〔5〕% 的护体', '蓄势翻倍'],
    [E('round', 'buff', 'self', { atk: 0.06, hp: 0.06, if: 'back' }), E('round', 'st', 'ally.ahead', { k: 'guard', n: 1, every: 3 })],
    [[E('round', 'shield', 'self', { mx: 0.05, if: 'front' })], [E('round', 'buff', 'self', { atk: 0.06, hp: 0.06, if: 'back' })]]),
  cocoon: N('结茧', '茧', '每轮', '第 3 轮开始破茧：攻 +〔60〕%，回满血（每场一次）',
    ['开战结茧时挂「格挡」2 次', '第 2 轮先破一层小茧：攻 +〔15〕%'],
    [E('round', 'buff', 'self', { atk: 0.6, if: 'round>=3', max: 1 }), E('round', 'heal', 'self', { mx: 1, up: 0, if: 'round>=3', max: 1 })],
    [[E('start', 'st', 'self', { k: 'guard', n: 2 })], [E('round', 'buff', 'self', { atk: 0.15, if: 'round>=2', max: 1 })]]),
  regrow: N('再生', '岁', '免死', '第一次受到致命伤：退到同一行最后一格，以 50% 血重新长出来',
    ['长回来时攻 +〔20〕%', '每轮回复最大血量 〔2〕%'],
    [E('lethal', 'endure', null, { v: 0.5, max: 1 }), E('lethal', 'swap', 'self', { with: 'back', max: 1 })],
    [[E('lethal', 'buff', 'self', { atk: 0.2, max: 1 })], [E('round', 'heal', 'self', { mx: 0.02 })]]),
  lifeleaf: N('生机', '叶', '每轮', '每轮开始：上下左右相邻的友蛊回复本蛊最大血量 〔4〕%',
    ['自己也回复同样多', '每 3 轮清掉相邻友蛊身上的减益'],
    [E('round', 'heal', 'ally.adj', { mx: 0.04 })],
    [[E('round', 'heal', 'self', { mx: 0.04 })], [E('round', 'cleanse', 'ally.adj', { every: 3 })]]),
  creep: N('缠藤', '藤', '出手', '普攻命中：把目标拉近一格（被挡住就撞上，两只都受伤）',
    ['藤刺让目标中毒（攻击 〔12〕%）', '每轮开始最大血量 +〔1.5〕%'],
    [E('attack', 'draw', 'tg', { v: 1 })],
    [[E('attack', 'st', 'tg', { k: 'psn', atk: 0.12 })], [E('round', 'buff', 'self', { hp: 0.015 })]]),
  cordyceps: N('夏草', '草', '击杀', '普攻让目标中毒（攻击 〔10〕%）；击杀时在后排长出一株虫草（本蛊攻血 〔20〕%，每场 2 株）',
    ['每场 4 株', '有友蛊被召唤时，全体友蛊回复最大血量 〔1.5〕%'],
    [E('attack', 'st', 'tg', { k: 'psn', atk: 0.1 }), E('kill', 'summon', null, { sp: 'grass', atk: 0.2, mx: 0.2, at: 'back', max: 2 })],
    [[E('kill', 'summon', null, { sp: 'grass', atk: 0.2, mx: 0.2, at: 'back', max: 2 })], [E('summon', 'heal', 'ally.all', { tmx: 0.015 })]]),
  sunroot: N('扶桑', '桑', '每轮', '每轮开始：全体友蛊回复最大血量 〔2〕%',
    ['同一列的友蛊再得本蛊最大血量 〔5〕% 的护体', '友蛊第一次倒下时，原地发出一株新芽（本蛊攻血 〔8〕%）'],
    [E('round', 'heal', 'ally.all', { tmx: 0.02 })],
    [[E('round', 'shield', 'ally.col', { mx: 0.05 })], [E('allyDeath', 'summon', null, { sp: 'sprout', atk: 0.08, mx: 0.08, at: 'here', max: 1 })]]),

  // ---------- 土道 ----------
  roll: N('滚丸', '丸', '每轮', '每轮开始得到最大血量 〔4〕% 的护体；普攻 30% 机会把目标击退一格（撞上就两只都受伤）',
    ['站在最前时护体翻倍', '再多 10% 机会推一次'],
    [E('round', 'shield', 'self', { mx: 0.04 }), E('attack', 'knock', 'tg', { v: 1, chance: 0.3 })],
    [[E('round', 'shield', 'self', { mx: 0.04, if: 'front' })], [E('attack', 'knock', 'tg', { v: 1, chance: 0.1 })]]),
  burrow: N('钻地', '钻', '开战', '开战：钻地突袭敌方后排，各受攻击 〔50〕%',
    ['每 3 轮再钻一次', '开战钻到的蛊被拉近一格'],
    [E('start', 'dmg', 'foe.last', { atk: 0.5, shape: 'back' })],
    [[E('round', 'dmg', 'foe.last', { atk: 0.5, shape: 'back', every: 3 })], [E('start', 'draw', 'same', { v: 1, bump: 0 })]]),
  pit: N('流沙', '沙', '每轮', '每 2 轮：把敌方最靠后的蛊拉近一格，对它造成攻击 〔40〕%',
    ['陷进去的蛊攻 -〔8〕%（2 轮）', '单数轮也拉'],
    [E('round', 'draw', 'foe.last', { v: 1, every: 2 }), E('round', 'dmg', 'same', { atk: 0.4, every: 2 })],
    [[E('round', 'buff', 'same', { atk: -0.08, dur: 2, every: 2 })], [E('round', 'draw', 'foe.last', { v: 1, if: 'round%2' })]]),
  bulwark: N('玄甲', '玄', '受伤', '站在最前（同一行身前没有友蛊）时，受到的普攻伤害减半',
    ['站在最前时，每轮得到最大血量 〔5〕% 的护体', '站在最前被近战打中，反震攻击 〔20〕%'],
    [E('take', 'mul', null, { v: 0.5, if: 'front&kind=hit' })],
    [[E('round', 'shield', 'self', { mx: 0.05, if: 'front' })], [E('hit', 'dmg', 'src', { atk: 0.2, if: 'front&melee' })]]),
  aegis: N('镇岳', '岳', '每轮', '站在后列时，每轮开始同一行的友蛊各得本蛊最大血量 〔4〕% 的护体',
    ['同一列的友蛊也得', '自己受到的伤害 -13%'],
    [E('round', 'shield', 'ally.row', { mx: 0.04, if: 'col=2' })],
    [[E('round', 'shield', 'ally.col', { mx: 0.04, if: 'col=2' })], [E('take', 'mul', null, { v: 0.87 })]],
    { hooks: { auraTake: (ctx, h, v, tg, amt) => amt } }),   // bestiary.js 的 dmgMod 写死调用 aegis 的 auraTake，这里给个原样返回，集成时删掉那行即可
  stoneskin: N('石衣', '石', '开战', '开战得到最大血量 〔10〕% 的护体，嘲讽敌方（到下一轮）；受到的伤害 -10%',
    ['站在最前时再 -10%', '被打中时得到最大血量 〔1〕% 的护体（每场最多 8 次）'],
    [E('start', 'shield', 'self', { mx: 0.1 }), E('start', 'st', 'self', { k: 'taunt', n: 2 }), E('take', 'mul', null, { v: 0.9 })],
    [[E('take', 'mul', null, { v: 0.89, if: 'front' })], [E('hit', 'shield', 'self', { mx: 0.01, max: 8 })]]),
  earthdragon: N('翻土', '蚓', '免死', '断成两截还能活：第一次受到致命伤时留 15% 血',
    ['起身时攻 +〔15〕%', '起身时身后分出半截地龙（本蛊攻血 〔15〕%）'],
    [E('lethal', 'endure', null, { v: 0.15, max: 1 })],
    [[E('lethal', 'buff', 'self', { atk: 0.15, max: 1 })], [E('lethal', 'summon', null, { sp: 'wormhalf', atk: 0.15, mx: 0.15, at: 'behind', max: 1 })]]),
  shiftmount: N('搬山', '搬', '每轮', '每 2 轮：最近的敌蛊受攻击 〔30〕%，并被击退一格（撞上就两只都受伤）',
    ['被搬走的蛊攻 -〔6〕%（2 轮）', '搬的时候再多打攻击 〔15〕%'],
    [E('round', 'dmg', 'foe.front', { atk: 0.3, every: 2 }), E('round', 'knock', 'same', { v: 1, every: 2 })],
    [[E('round', 'buff', 'same', { atk: -0.06, dur: 2, every: 2 })], [E('round', 'dmg', 'foe.front', { atk: 0.15, every: 2 })]]),

  // ---------- 雷道 ----------
  chain: N('连雷', '雷', '出手', '普攻后雷光沿斜线弹开：目标和它斜对角的敌蛊各受这一下的 〔30〕%',
    ['20% 机会让被弹到的蛊全部眩晕一次', '本蛊打灼烧中的敌蛊，伤害 +13%（雷火相生）'],
    [E('attack', 'dmg', 'tg', { n: 0.3, shape: 'diag' })],
    [[E('attack', 'st', 'same', { k: 'stun', n: 1, chance: 0.2 })], [E('deal', 'mul', null, { v: 1.13, if: 'tg.burn' })]]),
  storm: N('霆击', '霆', '每轮', '单数轮开始：敌方全体各受攻击 〔15〕%',
    ['先劈最近的那一整列，多吃 〔15〕%', '本蛊打有印记的敌蛊，伤害 +10%'],
    [E('round', 'dmg', 'foe.all', { atk: 0.15, if: 'round%2' })],
    [[E('round', 'dmg', 'foe.front', { atk: 0.15, shape: 'col', if: 'round%2' })], [E('deal', 'mul', null, { v: 1.1, if: 'tg.mark' })]]),
  charge: N('积电', '静', '受击', '被近战打中：25% 机会放电，打它的那只受攻击 〔50〕% 并眩晕一次',
    ['放电时电到它那一整列（攻击 〔25〕%）', '被技能打中也会放电'],
    [E('hit', 'dmg', 'src', { atk: 0.5, chance: 0.25, if: 'melee' }), E('hit', 'st', 'same', { k: 'stun', n: 1 })],
    [[E('hit', 'dmg', 'same', { atk: 0.25, shape: 'col' })], [E('hit', 'dmg', 'src', { atk: 0.5, chance: 0.25, if: 'kind=skill' })]]),
  springthunder: N('惊蛰', '蛰', '开战', '开战：敌方全体受攻击 〔12〕%，20% 机会全部眩晕一次',
    ['第 5 轮再响一次', '开战敌方全体打上印记（第 1 轮）'],
    [E('start', 'dmg', 'foe.all', { atk: 0.12 }), E('start', 'st', 'same', { k: 'stun', n: 1, chance: 0.2 })],
    [[E('round', 'dmg', 'foe.all', { atk: 0.12, if: 'round>=5', max: 1 })], [E('start', 'st', 'foe.all', { k: 'mark', n: 2 })]]),
  clickjump: N('弹雷', '叩', '每轮', '每 2 轮：弹起砸敌方随机一只，攻击 〔50〕%，击退一格',
    ['单数轮也弹', '砸中的蛊眩晕一次（每场 1 次）'],
    [E('round', 'dmg', 'foe.rand', { atk: 0.5, every: 2 }), E('round', 'knock', 'same', { v: 1, every: 2 })],
    [[E('round', 'dmg', 'foe.rand', { atk: 0.5, if: 'round%2' })], [E('round', 'st', 'same', { k: 'stun', n: 1, max: 1 })]]),
  thundercloud: N('云雷', '云', '每轮', '每 3 轮落雷：敌方全体各受攻击 〔35〕%',
    ['落雷劈进敌阵：敌方全体灼烧 2 轮（攻击 〔8〕%）', '落雷再多打攻击 〔12〕%'],
    [E('round', 'dmg', 'foe.all', { atk: 0.35, every: 3 })],
    [[E('round', 'st', 'same', { k: 'burn', n: 2, atk: 0.08, every: 3 })], [E('round', 'dmg', 'foe.all', { atk: 0.12, every: 3 })]]),
  magburst: N('磁暴', '磁', '出手', '普攻打眩晕中的敌蛊，额外打出攻击 〔35〕%；之后 15% 机会让目标眩晕',
    ['磁力把目标拉近一格', '击杀时电到最近的敌蛊（攻击 〔25〕%）'],
    [E('attack', 'dmg', 'tg', { atk: 0.35, if: 'tg.stun' }), E('attack', 'st', 'tg', { k: 'stun', n: 1, chance: 0.15 })],
    [[E('attack', 'draw', 'tg', { v: 1 })], [E('kill', 'dmg', 'foe.front', { atk: 0.25 })]]),
  ninebolt: N('九霄', '霄', '每轮', '每轮开始落 3 道雷，各劈敌方随机一只（攻击 〔10〕%）',
    ['再多一道', '本蛊打有印记的敌蛊，伤害 +13%'],
    [E('round', 'dmg', 'foe.rand', { atk: 0.1, times: 3 })],
    [[E('round', 'dmg', 'foe.rand', { atk: 0.1 })], [E('deal', 'mul', null, { v: 1.13, if: 'tg.mark' })]]),

  // ---------- 光道 ----------
  moon: N('月照', '月', '亡语', '倒下时月光照亮这一行：同一行身后的友蛊攻血 +〔25〕%，敌方最近的那一整行打上印记 2 轮',
    ['同一列的友蛊也 +〔12〕%', '受照的身后友蛊得到本蛊最大血量 〔8〕% 的护体'],
    [E('death', 'buff', 'ally.behind', { atk: 0.25, hp: 0.25 }), E('death', 'st', 'foe.front', { k: 'mark', n: 3, shape: 'row' })],
    [[E('death', 'buff', 'ally.col', { atk: 0.12, hp: 0.12 })], [E('death', 'shield', 'ally.behind', { mx: 0.08 })]]),
  ember: N('微光', '辉', '亡语', '倒下时一束光打向击杀者：攻击 〔100〕%，并打上印记 2 轮',
    ['开战：敌方攻最高的蛊打上印记（第 1 轮）', '倒下时光照满阵：敌方全体再各受攻击 〔15〕%'],
    [E('death', 'dmg', 'killer', { atk: 1.0 }), E('death', 'st', 'same', { k: 'mark', n: 3 })],
    [[E('start', 'st', 'foe.top', { k: 'mark', n: 2 })], [E('death', 'dmg', 'foe.all', { atk: 0.15 })]]),
  mirror: N('镜反', '镜', '受击', '受到技能伤害：照回来源这一下的 〔50〕%（每场最多 8 次）',
    ['受到的技能伤害 -25%', '普攻打它也照回 〔10〕%'],
    [E('hit', 'dmg', 'src', { n: 0.5, if: 'kind=skill', max: 8 })],
    [[E('take', 'mul', null, { v: 0.75, if: 'kind=skill' })], [E('hit', 'dmg', 'src', { n: 0.1, if: 'kind=hit' })]]),
  moonblade: N('月刃', '皎', '出手', '普攻化作一道月刃，贯穿目标那一整行：各受这一下的 〔30〕%',
    ['贯穿再加 〔15〕%', '本蛊打有印记的敌蛊，伤害 +10%'],
    [E('attack', 'dmg', 'tg', { n: 0.3, shape: 'row' })],
    [[E('attack', 'dmg', 'tg', { n: 0.15, shape: 'row' })], [E('deal', 'mul', null, { v: 1.1, if: 'tg.mark' })]]),
  relic: N('舍利', '舍', '开战', '开战：上下左右相邻的友蛊攻血各 +〔8〕%',
    ['同一列的友蛊也 +〔4〕%', '开战：相邻友蛊蛊力 +20'],
    [E('start', 'buff', 'ally.adj', { atk: 0.08, hp: 0.08 })],
    [[E('start', 'buff', 'ally.col', { atk: 0.04, hp: 0.04 })], [E('start', 'gp', 'ally.adj', { v: 20 })]]),
  nightlight: N('照夜', '照', '出手', '普攻 20% 机会照破要害：额外打出攻击 〔40〕%，并打上印记 2 轮',
    ['本蛊打灼烧中的敌蛊，伤害 +20%（火光里破绽更显眼）', '每 3 轮照亮敌方攻最高的蛊：打上印记 2 轮'],
    [E('attack', 'dmg', 'tg', { atk: 0.4, chance: 0.2 }), E('attack', 'st', 'same', { k: 'mark', n: 2 })],
    [[E('deal', 'mul', null, { v: 1.2, if: 'tg.burn' })], [E('round', 'st', 'foe.top', { k: 'mark', n: 3, every: 3 })]]),
  sunfire: N('曜日', '曜', '每轮', '单数轮：敌方全体灼烧 2 轮（攻击 〔8〕%）；每轮：全体友蛊回复攻击 〔5〕%',
    ['灼烧改为 3 轮', '双数轮也烧'],
    [E('round', 'st', 'foe.all', { k: 'burn', n: 2, atk: 0.08, if: 'round%2' }), E('round', 'heal', 'ally.all', { atk: 0.05 })],
    [[E('round', 'st', 'foe.all', { k: 'burn', n: 3, atk: 0.08, if: 'round%2' })], [E('round', 'st', 'foe.all', { k: 'burn', n: 2, atk: 0.08, every: 2 })]]),

  // ---------- 暗道 ----------
  heart: N('噬心', '心', '击杀', '击杀：攻血 +〔15〕%',
    ['本蛊打中毒的敌蛊，伤害 +25%', '开战先扑向敌方血最少的蛊，攻击 〔50〕%'],
    [E('kill', 'buff', 'self', { atk: 0.15, hp: 0.15 })],
    [[E('deal', 'mul', null, { v: 1.25, if: 'tg.psn' })], [E('start', 'dmg', 'foe.low', { atk: 0.5 })]]),
  hex: N('夺志', '魇', '开战', '开战：敌方攻最高的蛊被封印 2 轮（蛊力不涨），攻 -〔8〕%',
    ['再封印速最快的那只', '魇粉撒满敌阵：敌方全体中毒（攻击 〔4〕%）'],
    [E('start', 'st', 'foe.top', { k: 'seal', n: 3 }), E('start', 'buff', 'same', { atk: -0.08 })],
    [[E('start', 'st', 'foe.fast', { k: 'seal', n: 3 })], [E('start', 'st', 'foe.all', { k: 'psn', atk: 0.04 })]]),
  lull: N('催眠', '眠', '受击', '被近战打中：打它的那只眩晕一次（每场 2 次）',
    ['每场 3 次', '本蛊打眩晕中的敌蛊，伤害 +15%'],
    [E('hit', 'st', 'src', { k: 'stun', n: 1, if: 'melee', max: 2 })],
    [[E('hit', 'st', 'src', { k: 'stun', n: 1, if: 'melee', max: 1 })], [E('deal', 'mul', null, { v: 1.15, if: 'tg.stun' })]]),
  inkcloud: N('泼墨', '墨', '开战', '开战：墨糊住敌方最近的那一整列，它们第一次普攻落空',
    ['被糊住的蛊打上印记（第 1 轮）', '第 4 轮再喷一次'],
    [E('start', 'st', 'foe.front', { k: 'web', n: 1, shape: 'col' })],
    [[E('start', 'st', 'same', { k: 'mark', n: 2 })], [E('round', 'st', 'foe.front', { k: 'web', n: 1, shape: 'col', every: 4, max: 1 })]]),
  nightsip: N('夜吸', '蝠', '出手', '普攻后，伤得最重的友蛊回复这一下的 〔20〕%',
    ['本蛊打有印记的敌蛊，伤害 +25%', '自己也回复同样多'],
    [E('attack', 'heal', 'ally.lowp', { n: 0.2 })],
    [[E('deal', 'mul', null, { v: 1.25, if: 'tg.mark' })], [E('attack', 'heal', 'self', { n: 0.2 })]]),
  blotout: N('蚀光', '晦', '每轮', '每 2 轮：敌方攻最高的蛊攻 -〔10〕%（2 轮），冰寒 1 层',
    ['同时打上印记 2 轮', '再蚀一只（速最快的那只）'],
    [E('round', 'buff', 'foe.top', { atk: -0.1, dur: 2, every: 2 }), E('round', 'st', 'same', { k: 'chill', n: 1, every: 2 })],
    [[E('round', 'st', 'same', { k: 'mark', n: 3, every: 2 })], [E('round', 'buff', 'foe.fast', { atk: -0.1, dur: 2, every: 2 })]]),
  ferry: N('引渡', '渡', '友亡', '每场第一只倒下的友蛊，以魂体回到原地（本蛊攻血 〔25〕%）',
    ['多引渡一只（落在附近的空格）', '魂体回来时，敌方全体冰寒 1 层'],
    [E('allyDeath', 'summon', null, { sp: 'soul', atk: 0.25, mx: 0.25, at: 'here', max: 1 })],
    [[E('allyDeath', 'summon', null, { sp: 'soul', atk: 0.25, mx: 0.25, at: 'here', max: 1 })], [E('allyDeath', 'st', 'foe.all', { k: 'chill', n: 1, max: 1 })]]),

  // ---------- 血道 ----------
  leech: N('吮血', '吮', '出手', '普攻后回复这一下的 〔40〕%',
    ['咬中毒的敌蛊时再吸一口：攻击 〔25〕%，全部吸回', '每次普攻偷走目标 〔1.5〕% 的攻（每场最多 6 次）'],
    [E('attack', 'heal', 'self', { n: 0.4 })],
    [[E('attack', 'dmg', 'tg', { atk: 0.25, steal: 1, if: 'tg.psn' })], [E('attack', 'buff', 'tg', { atk: -0.015, max: 6 }), E('attack', 'buff', 'self', { atk: 0.015, max: 6 })]]),
  drain: N('抽髓', '髓', '开战', '开战：敌方攻最高的蛊攻 -〔12〕%，自己攻 +〔12〕%',
    ['普攻也偷：目标攻 -〔3〕%，自己 +〔3〕%（每场最多 6 次）', '开战时它还被打上印记（第 1 轮）'],
    [E('start', 'buff', 'foe.top', { atk: -0.12 }), E('start', 'buff', 'self', { atk: 0.12 })],
    [[E('attack', 'buff', 'tg', { atk: -0.03, max: 6 }), E('attack', 'buff', 'self', { atk: 0.03, max: 6 })], [E('start', 'st', 'foe.top', { k: 'mark', n: 2 })]]),
  urn: N('入瓮', '瓮', '布阵', '布阵：吞噬同一行身后紧挨的那只友蛊，得到它六成攻血（本场有效）',
    ['吞完再攻血 +〔15〕%', '每 3 轮吞噬一只召唤物或血不过 15% 的敌蛊（得它两成攻血）'],
    [E('prep', 'eat', 'ally.behind', { v: 9, gain: 0.6 })],
    [[E('prep', 'buff', 'self', { atk: 0.15, hp: 0.15 })], [E('round', 'eat', 'foe.lowp', { v: 0.15, gain: 0.2, every: 3 })]]),
  latch: N('吸附', '附', '出手', '普攻后偷走目标最大血量的 〔2〕%（无视护体）',
    ['目标中毒时再偷一次', '偷的同时目标攻 -〔1.5〕%（每场最多 6 次）'],
    [E('attack', 'dmg', 'tg', { tmx: 0.02, pierce: 1, steal: 1 })],
    [[E('attack', 'dmg', 'tg', { tmx: 0.02, pierce: 1, steal: 1, if: 'tg.psn' })], [E('attack', 'buff', 'tg', { atk: -0.015, max: 6 })]]),
  bloodpact: N('血契', '契', '开战', '开战：献出自己最大血量 10%，上下左右相邻的友蛊攻 +〔10〕%',
    ['献出的血化作它们的护体（本蛊最大血量 〔6〕%）', '倒下时相邻友蛊各回复本蛊最大血量 〔5〕%'],
    [E('start', 'dmg', 'self', { mx: 0.1, up: 0, pierce: 1 }), E('start', 'buff', 'ally.adj', { atk: 0.1 })],
    [[E('start', 'shield', 'ally.adj', { mx: 0.06 })], [E('death', 'heal', 'ally.adj', { mx: 0.05 })]]),
  clot: N('凝血', '珀', '免死', '第一次受到致命伤时凝成血珀：留 15% 血，挂「格挡」2 次',
    ['醒来攻 +〔15〕%', '凝血时相邻友蛊各回复本蛊最大血量 〔4〕%'],
    [E('lethal', 'endure', null, { v: 0.15, max: 1 }), E('lethal', 'st', 'self', { k: 'guard', n: 2, max: 1 })],
    [[E('lethal', 'buff', 'self', { atk: 0.15, max: 1 })], [E('lethal', 'heal', 'ally.adj', { mx: 0.04, max: 1 })]]),
  bloodmoon: N('血月', '朔', '出手', '普攻化作血色月刃，贯穿目标那一整行（这一下的 〔25〕%）；血量低于一半时再贯穿一次',
    ['普攻后回复这一下的 〔15〕%', '血量第一次掉到一半以下时攻 +〔10〕%'],
    [E('attack', 'dmg', 'tg', { n: 0.25, shape: 'row' }), E('attack', 'dmg', 'tg', { n: 0.25, shape: 'row', if: 'hp<50' })],
    [[E('attack', 'heal', 'self', { n: 0.15 })], [E('low', 'buff', 'self', { atk: 0.1 })]]),
  drought: N('旱血', '魃', '每轮', '每轮开始：敌方全体各受攻击 〔4〕%，自己回复攻击 〔6〕%',
    ['每 3 轮敌方全体灼烧 2 轮（攻击 〔10〕%）', '击杀时回复最大血量 〔8〕%'],
    [E('round', 'dmg', 'foe.all', { atk: 0.04 }), E('round', 'heal', 'self', { atk: 0.06 })],
    [[E('round', 'st', 'foe.all', { k: 'burn', n: 2, atk: 0.1, every: 3 })], [E('kill', 'heal', 'self', { mx: 0.08 })]]),

  // ---------- 毒道 ----------
  sting: N('蝎尾', '尾', '开战', '开战：一针扎敌方最靠后的蛊，攻击 〔150〕%，中毒（攻击 〔20〕%）',
    ['每 3 轮再扎一针（攻击 〔60〕%，中毒 〔10〕%）', '本蛊打中毒的敌蛊，伤害 +15%'],
    [E('start', 'dmg', 'foe.last', { atk: 1.5 }), E('start', 'st', 'same', { k: 'psn', atk: 0.2 })],
    [[E('round', 'dmg', 'foe.last', { atk: 0.6, every: 3 }), E('round', 'st', 'same', { k: 'psn', atk: 0.1, every: 3 })], [E('deal', 'mul', null, { v: 1.15, if: 'tg.psn' })]]),
  nettle: N('毒毛', '毛', '受击', '被近战打中：打它的那只中毒（攻击 〔20〕%）',
    ['被技能打中也扎', '中了毒毛的蛊攻 -〔2.5〕%（每场最多 4 次）'],
    [E('hit', 'st', 'src', { k: 'psn', atk: 0.2, if: 'melee' })],
    [[E('hit', 'st', 'src', { k: 'psn', atk: 0.2, if: 'kind=skill' })], [E('hit', 'buff', 'src', { atk: -0.025, if: 'melee', max: 4 })]]),
  venom: N('蚀毒', '蚀', '出手', '普攻：目标已中毒时额外打出攻击 〔25〕%；再让它中毒（攻击 〔15〕%，可叠）',
    ['击杀时毒转到最近的敌蛊（攻击 〔20〕%）', '普攻让目标那一整列都中毒（攻击 〔4〕%）'],
    [E('attack', 'dmg', 'tg', { atk: 0.25, if: 'tg.psn' }), E('attack', 'st', 'tg', { k: 'psn', atk: 0.15 })],
    [[E('kill', 'st', 'foe.front', { k: 'psn', atk: 0.2 })], [E('attack', 'st', 'tg', { k: 'psn', atk: 0.04, shape: 'col' })]]),
  prick: N('点刺', '刺', '开战', '开战：刺敌方血最少的蛊，攻击 〔120〕%，打上印记 2 轮',
    ['击杀时再刺血最少的敌蛊（攻击 〔80〕%，每场 2 次）', '每轮开始刺血最少的敌蛊（攻击 〔13〕%）'],
    [E('start', 'dmg', 'foe.low', { atk: 1.2 }), E('start', 'st', 'same', { k: 'mark', n: 3 })],
    [[E('kill', 'dmg', 'foe.low', { atk: 0.8, max: 2 })], [E('round', 'dmg', 'foe.low', { atk: 0.13 })]]),
  miasma: N('瘴气', '瘴', '受击', '第一次受伤：敌方全体中毒（本蛊最大血量 〔3〕%）',
    ['之后每 3 轮再放一次', '本蛊打中毒的敌蛊，伤害 +10%'],
    [E('hit', 'st', 'foe.all', { k: 'psn', mx: 0.03, max: 1 })],
    [[E('round', 'st', 'foe.all', { k: 'psn', mx: 0.03, every: 3 })], [E('deal', 'mul', null, { v: 1.1, if: 'tg.psn' })]]),
  parasite: N('寄生', '寄', '开战', '开战：钻进敌方攻最高的蛊：中毒（攻击 〔30〕%），打上印记 2 轮',
    ['宿主每轮攻 -〔4〕%', '宿主倒下就钻进下一只攻最高的敌蛊（每场 1 次）'],
    [E('start', 'st', 'foe.top', { k: 'psn', atk: 0.3 }), E('start', 'st', 'same', { k: 'mark', n: 3 })],
    [[E('round', 'buff', 'foe.top', { atk: -0.04 })], [E('foeDeath', 'st', 'foe.top', { k: 'psn', atk: 0.3, max: 1 }), E('foeDeath', 'st', 'same', { k: 'mark', n: 2, max: 1 })]]),
  widowkiss: N('噬偶', '寡', '出手', '普攻命中：目标中毒（攻击 〔15〕%）；击杀时毒转到最近的敌蛊（攻击 〔25〕%）',
    ['击杀时敌方全体中毒（各 〔8〕%）', '普攻后，目标中毒且血不过两成就把它吞噬'],
    [E('attack', 'st', 'tg', { k: 'psn', atk: 0.15 }), E('kill', 'st', 'foe.front', { k: 'psn', atk: 0.25 })],
    [[E('kill', 'st', 'foe.all', { k: 'psn', atk: 0.08 })], [E('attack', 'eat', 'tg', { v: 0.2, gain: 0.3, if: 'tg.psn' })]]),

  // ---------- 智道 ----------
  web: N('结网', '网', '开战', '开战：敌方最近的那只落网 2 次（普攻落空）',
    ['落网的同时行动条推后 20%', '开战敌方速最快的那只行动条推后 8%'],
    [E('start', 'st', 'foe.front', { k: 'web', n: 2 })],
    [[E('start', 'delay', 'same', { v: 0.2 })], [E('start', 'delay', 'foe.fast', { v: 0.08 })]]),
  chirp: N('叫阵', '叫', '每轮', '站在最前时，每轮开始敌方最近的那一整行攻 -〔5〕%',
    ['削下的攻加给自己', '叫声震慑敌方全体（各 -〔1〕%）'],
    [E('round', 'buff', 'foe.front', { atk: -0.05, shape: 'row', if: 'front' })],
    [[E('round', 'buff', 'self', { atk: 0.05, if: 'front' })], [E('round', 'buff', 'foe.all', { atk: -0.01, if: 'front' })]]),
  lure: N('引蝶', '引', '布阵', '布阵：把敌方血最少的蛊拉近两格，攻 -〔15〕%，打上印记 2 轮',
    ['引来的那只第一次普攻落空', '引来的那只开战前先受攻击 〔50〕%'],
    [E('prep', 'draw', 'foe.low', { v: 2 }), E('prep', 'buff', 'same', { atk: -0.15 }), E('prep', 'st', 'same', { k: 'mark', n: 3 })],
    [[E('prep', 'st', 'same', { k: 'web', n: 1 })], [E('prep', 'dmg', 'same', { atk: 0.5 })]]),
  mimic: N('拟态', '拟', '布阵', '布阵：照抄敌方最近那只的被动技能（本场有效，按本蛊转数算）',
    ['同时攻血 +〔15〕%', '再抄敌方攻最高那只的被动技能'],
    [E('prep', 'copyNat', 'foe.front')],
    [[E('prep', 'buff', 'self', { atk: 0.15, hp: 0.15 })], [E('prep', 'copyNat', 'foe.top')]]),
  earlisten: N('地听', '听', '开战', '开战：听出敌方攻最高的两只，打上印记 2 轮',
    ['每 3 轮再听一次（给攻最高的那只打上印记）', '开战：敌方速最快的行动条推后 15%'],
    [E('start', 'st', 'foe.top:2', { k: 'mark', n: 3 })],
    [[E('round', 'st', 'foe.top', { k: 'mark', n: 3, every: 3 })], [E('start', 'delay', 'foe.fast', { v: 0.15 })]]),
  brew: N('酒虫', '酿', '每轮', '每轮开始：上下左右相邻、有主动技能的友蛊蛊力 +10',
    ['同一列的友蛊也 +10', '开战：相邻友蛊蛊力 +30'],
    [E('round', 'gp', 'ally.adj', { v: 10 })],
    [[E('round', 'gp', 'ally.col', { v: 10 })], [E('start', 'gp', 'ally.adj', { v: 30 })]]),
  wisdom: N('智慧', '智', '开战', '开战：全体友蛊蛊力 +20；每轮开始：敌方攻最高的蛊蛊力 -15',
    ['每轮开始随机一只友蛊蛊力 +15', '每 3 轮清掉全体友蛊身上的减益'],
    [E('start', 'gp', 'ally.all', { v: 20 }), E('round', 'gp', 'foe.top', { v: -15 })],
    [[E('round', 'gp', 'ally.rand', { v: 15 })], [E('round', 'cleanse', 'ally.all', { every: 3 })]]),

  // ---------- 魂道 ----------
  rot: N('腐骨', '蛹', '亡语', '倒下时原地孵出蛊蛹（本蛊攻血 〔60〕%）',
    ['孵化时腐气让敌方最近的那一整列中毒（攻击 〔20〕%）', '每轮开始敌方最近的蛊中毒（攻击 〔4〕%）'],
    [E('death', 'summon', null, { sp: 'pupa', atk: 0.6, mx: 0.6, at: 'here' })],
    [[E('death', 'st', 'foe.front', { k: 'psn', atk: 0.2, shape: 'col' })], [E('round', 'st', 'foe.front', { k: 'psn', atk: 0.04 })]]),
  molt: N('蜕壳', '蜕', '亡语', '倒下时：同一行身后的友蛊得到本蛊攻血的 〔40〕%',
    ['同一列的友蛊也各得 〔20〕%', '第一次受到致命伤先蜕一层壳：留 30% 血'],
    [E('death', 'buff', 'ally.behind', { atk: 0.4, hp: 0.4, by: 'self' })],
    [[E('death', 'buff', 'ally.col', { atk: 0.2, hp: 0.2, by: 'self' })], [E('lethal', 'endure', null, { v: 0.3, max: 1 })]]),
  mother: N('子母', '蚨', '亡语', '倒下时原地召唤出子蚨（本蛊攻血 〔70〕%）',
    ['子蚨落地时，敌方最近的那只受攻击 〔80〕%', '再在后排召一只（〔15〕%）'],
    [E('death', 'summon', null, { sp: 'fuzi', atk: 0.7, mx: 0.7, at: 'here' })],
    [[E('death', 'dmg', 'foe.front', { atk: 0.8 })], [E('death', 'summon', null, { sp: 'fuzi', atk: 0.15, mx: 0.15, at: 'back' })]]),
  mourn: N('食腐', '腐', '有蛊倒下', '有蛊倒下（敌我都算）：攻血 +〔6〕%',
    ['本蛊打中毒的敌蛊，伤害 +30%（专挑烂的下嘴）', '每 3 轮吞噬一只召唤物或血不过 15% 的敌蛊'],
    [E('allyDeath', 'buff', 'self', { atk: 0.06, hp: 0.06 }), E('foeDeath', 'buff', 'self', { atk: 0.06, hp: 0.06 })],
    [[E('deal', 'mul', null, { v: 1.3, if: 'tg.psn' })], [E('round', 'eat', 'foe.lowp', { v: 0.15, gain: 0.3, every: 3 })]]),
  inherit: N('承嗣', '嗣', '亡语', '倒下时：上下左右相邻的友蛊各得到本蛊攻血的 〔25〕%',
    ['同时各得本蛊最大血量 〔10〕% 的护体', '也清掉它们身上的减益'],
    [E('death', 'buff', 'ally.adj', { atk: 0.25, hp: 0.25, by: 'self' })],
    [[E('death', 'shield', 'ally.adj', { mx: 0.1 })], [E('death', 'cleanse', 'ally.adj')]]),
  wisp: N('鬼火', '磷', '友亡', '有友蛊倒下：鬼火扑向随机一只敌蛊，攻击 〔40〕%，冰寒 1 层',
    ['再扑一只', '自己倒下时扑三发'],
    [E('allyDeath', 'dmg', 'foe.rand', { atk: 0.4 }), E('allyDeath', 'st', 'same', { k: 'chill', n: 1 })],
    [[E('allyDeath', 'dmg', 'foe.rand', { atk: 0.4 })], [E('death', 'dmg', 'foe.rand', { atk: 0.4, times: 3 })]]),
  dirge: N('骨笛', '笛', '友亡', '友蛊每倒下一只，全体友蛊攻 +〔3〕%',
    ['同时血 +〔5〕%', '敌蛊倒下也算（攻 +〔1.5〕%）'],
    [E('allyDeath', 'buff', 'ally.all', { atk: 0.03 })],
    [[E('allyDeath', 'buff', 'ally.all', { hp: 0.05 })], [E('foeDeath', 'buff', 'ally.all', { atk: 0.015 })]]),

  // ---------- 奴道 ----------
  royal: N('王令', '王', '开战', '开战：上下左右相邻的友蛊攻血 +〔8〕%；每有友蛊被召唤，自己攻血 +〔3〕%（每场最多 8 次）',
    ['开战先在身后召一只工蜂（本蛊攻血 〔40〕%）', '每有友蛊被召唤，全体友蛊攻 +〔1〕%（每场最多 6 次）'],
    [E('start', 'buff', 'ally.adj', { atk: 0.08, hp: 0.08 }), E('summon', 'buff', 'self', { atk: 0.03, hp: 0.03, max: 8 })],
    [[E('start', 'summon', null, { sp: 'bee', atk: 0.4, mx: 0.4, at: 'behind' })], [E('summon', 'buff', 'ally.all', { atk: 0.01, max: 6 })]]),
  muster: N('点兵', '兵', '开战', '开战：身后召 2 只兵蚁（各本蛊攻血 〔35〕%）',
    ['有友蛊倒下时，自己攻 +〔6〕%', '每 3 轮补一只兵蚁'],
    [E('start', 'summon', null, { sp: 'antling', atk: 0.35, mx: 0.35, at: 'behind', count: 2 })],
    [[E('allyDeath', 'buff', 'self', { atk: 0.06 })], [E('round', 'summon', null, { sp: 'antling', atk: 0.35, mx: 0.35, at: 'behind', every: 3 })]]),
  scatter: N('散籽', '籽', '亡语', '倒下时原地召唤出 2 只蚜虫（各本蛊攻血 〔35〕%）',
    ['召 3 只', '倒下时蚜汁溅到敌方最近的那只：中毒（攻击 〔8〕%）'],
    [E('death', 'summon', null, { sp: 'aphidling', atk: 0.35, mx: 0.35, at: 'here', count: 2 })],
    [[E('death', 'summon', null, { sp: 'aphidling', atk: 0.35, mx: 0.35, at: 'here' })], [E('death', 'st', 'foe.front', { k: 'psn', atk: 0.08 })]]),
  brood: N('抱卵', '卵', '受击', '被打中还活着：身后召一只小蛛（本蛊攻血 〔20〕%，每场 2 只）',
    ['每场 4 只', '有友蛊被召唤时，自己回复最大血量 〔2〕%'],
    [E('hit', 'summon', null, { sp: 'spiderling', atk: 0.2, mx: 0.2, at: 'behind', max: 2 })],
    [[E('hit', 'summon', null, { sp: 'spiderling', atk: 0.2, mx: 0.2, at: 'behind', max: 2 })], [E('summon', 'heal', 'self', { mx: 0.02 })]]),
  nurture: N('哺育', '哺', '召唤', '每有友蛊被召唤：全体友蛊攻 +〔2〕%（每场最多 6 次）',
    ['开战先召一只兵蚁（本蛊攻血 〔40〕%）', '每有友蛊被召唤，自己回复最大血量 〔2.5〕%'],
    [E('summon', 'buff', 'ally.all', { atk: 0.02, max: 6 })],
    [[E('start', 'summon', null, { sp: 'antling', atk: 0.4, mx: 0.4, at: 'behind' })], [E('summon', 'heal', 'self', { mx: 0.025 })]]),
  hive: N('蜂巢', '巢', '每轮', '每轮开始：身后召一只工蜂（本蛊攻血 〔25〕%，每场 3 只）',
    ['每场 5 只', '工蜂出巢时叮敌方最近的那只（攻击 〔15〕%，每场 5 次）'],
    [E('round', 'summon', null, { sp: 'bee', atk: 0.25, mx: 0.25, at: 'behind', max: 3 })],
    [[E('round', 'summon', null, { sp: 'bee', atk: 0.25, mx: 0.25, at: 'behind', max: 2 })], [E('round', 'dmg', 'foe.front', { atk: 0.15, max: 5 })]]),
  strings: N('牵丝', '丝', '击杀', '击杀：在本方后排做一只傀儡（本蛊攻血 〔50〕%，每场 1 次）',
    ['每场 2 次', '击杀时把敌方最靠后的蛊拉近一格，并让它落网 1 次'],
    [E('kill', 'summon', null, { sp: 'kuilei', atk: 0.5, mx: 0.5, at: 'back', max: 1 })],
    [[E('kill', 'summon', null, { sp: 'kuilei', atk: 0.5, mx: 0.5, at: 'back', max: 1 })], [E('kill', 'draw', 'foe.last', { v: 1 }), E('kill', 'st', 'same', { k: 'web', n: 1 })]]),
  mirage: N('幻身', '幻', '受击', '第一次被打中还活着：身后召唤出分影（本蛊攻血 〔60〕%）',
    ['血量第一次掉到一半以下时再分一只', '分影出现时自己挂「格挡」1 次'],
    [E('hit', 'summon', null, { sp: 'shade', atk: 0.6, mx: 0.6, at: 'behind', max: 1 })],
    [[E('low', 'summon', null, { sp: 'shade', atk: 0.6, mx: 0.6, at: 'behind', max: 1 })], [E('hit', 'st', 'self', { k: 'guard', n: 1, max: 1 })]]),

  // ---------- 宇道 ----------
  ward: N('守宫', '守', '每轮', '每轮开始：同一行身前的友蛊得到本蛊最大血量 〔6〕% 的护体',
    ['有友蛊倒下时，给最前的友蛊补 〔10〕%', '护体翻倍'],
    [E('round', 'shield', 'ally.ahead', { mx: 0.06 })],
    [[E('allyDeath', 'shield', 'ally.front', { mx: 0.1 })], [E('round', 'shield', 'ally.ahead', { mx: 0.06 })]]),
  hop: N('弹跳', '跳', '出手', '普攻后行动条提前 15%',
    ['每次普攻攻 +〔5〕%（每场最多 6 次）', '15% 机会再咬一口（攻击 〔20〕%）'],
    [E('attack', 'adv', 'self', { v: 0.15 })],
    [[E('attack', 'buff', 'self', { atk: 0.05, max: 6 })], [E('attack', 'dmg', 'tg', { atk: 0.2, chance: 0.15 })]]),
  pair: N('比翼', '翼', '开战', '开战：同一列的友蛊攻血各 +〔12〕%，自己 +〔6〕%',
    ['同一列的友蛊速 +〔6〕%', '相邻友蛊倒下时，自己攻 +〔10〕%'],
    [E('start', 'buff', 'ally.col', { atk: 0.12, hp: 0.12 }), E('start', 'buff', 'self', { atk: 0.06, hp: 0.06 })],
    [[E('start', 'buff', 'ally.col', { spd: 0.06 })], [E('allyDeath', 'buff', 'self', { atk: 0.1, if: 'dead.adj' })]]),
  skate: N('踏水', '黾', '每轮', '同一行身前有友蛊时，每轮开始得到最大血量 〔4〕% 的护体；普攻 30% 机会让目标冰寒 1 层',
    ['普攻后行动条提前 10%', '本蛊打冰寒中的敌蛊，伤害 +13%'],
    [E('round', 'shield', 'self', { mx: 0.04, if: 'back' }), E('attack', 'st', 'tg', { k: 'chill', n: 1, chance: 0.3 })],
    [[E('attack', 'adv', 'self', { v: 0.1 })], [E('deal', 'mul', null, { v: 1.13, if: 'tg.chill' })]]),
  inchforward: N('丈量', '尺', '每轮', '每 2 轮挪到同一行最前一格，攻 +〔6〕%',
    ['挪过去时得到最大血量 〔10〕% 的护体', '单数轮也挪'],
    [E('round', 'swap', 'self', { with: 'front', every: 2 }), E('round', 'buff', 'self', { atk: 0.06, every: 2 })],
    [[E('round', 'shield', 'self', { mx: 0.1, every: 2 })], [E('round', 'swap', 'self', { with: 'front', if: 'round%2' })]]),
  warp: N('挪移', '瞬', '出手', '普攻后和同一行身后的友蛊换位，它挂「格挡」1 次',
    ['换位后行动条提前 15%', '换位时对敌方后排补一刀（攻击 〔18〕%）'],
    [E('attack', 'swap', 'ally.behind', { with: 'self' }), E('attack', 'st', 'same', { k: 'guard', n: 1 })],
    [[E('attack', 'adv', 'self', { v: 0.15 })], [E('attack', 'dmg', 'foe.last', { atk: 0.18, shape: 'back' })]]),
  roam: N('定仙游', '游', '每轮', '每轮开始：和血量比例最低的友蛊换位，它挂「格挡」1 次',
    ['开战：把敌方攻最高的蛊挪到它那一行最后一格', '开战：全体友蛊速 +〔6〕%'],
    [E('round', 'swap', 'ally.lowp', { with: 'self' }), E('round', 'st', 'same', { k: 'guard', n: 1 })],
    [[E('start', 'swap', 'foe.top', { with: 'back' })], [E('start', 'buff', 'ally.all', { spd: 0.06 })]]),

  // ---------- 宙道 ----------
  brief: N('朝暮', '暮', '每轮', '生来攻血很高，第 4 轮开始寿尽倒下（会触发亡语）',
    ['倒下时化作光雨：敌方全体各受攻击 〔50〕%', '第一次受到致命伤时留 30% 血'],
    [E('round', 'dmg', 'self', { mx: 2, up: 0, pierce: 1, if: 'round>=4', max: 1 })],
    [[E('death', 'dmg', 'foe.all', { atk: 0.5 })], [E('lethal', 'endure', null, { v: 0.3, max: 1 })]]),
  rewind: N('春秋', '春', '覆灭', '每场一次：全队将要覆灭时倒转光阴，开战时在阵的蛊全部以五成攻血复生，蝉自己只剩 1 血',
    ['倒回来时，蝉身边的友蛊各得最大血量 15% 的护体', '倒回来那一刻，敌方全体被光阴反噬，各掉最大血量 10%'],
    [], [[], []], { keepHooks: true }),
  fate: N('织命', '命', '布阵', '布阵：把敌方最靠后的蛊拉近两格，让它落网 2 次（接下来 2 次普攻落空）',
    ['落网的那只再中毒（攻击 〔25〕%）', '速最快的那只也落网 2 次'],
    [E('prep', 'draw', 'foe.last', { v: 2 }), E('prep', 'st', 'same', { k: 'web', n: 2 })],
    [[E('prep', 'st', 'same', { k: 'psn', atk: 0.25 })], [E('prep', 'st', 'foe.fast', { k: 'web', n: 2 })]]),
  dawn: N('朝生', '朝', '开战', '开战攻 +〔40〕%，持续 2 轮（朝生暮死）；开战全体友蛊行动条提前 5%',
    ['开战行动条提前 20%', '第一次普攻回复造成伤害的 〔15〕%'],
    [E('start', 'buff', 'self', { atk: 0.4, dur: 2 }), E('start', 'adv', 'ally.all', { v: 0.05 })],
    [[E('start', 'adv', 'self', { v: 0.2 })], [E('attack', 'heal', 'self', { n: 0.15, if: 'first' })]]),
  backflow: N('倒流', '漏', '每轮', '每 3 轮：血量比例最低的友蛊回复最大血量 〔15〕%（时光倒流）',
    ['同时清掉它身上的减益', '每 2 轮：敌方速最快的那只冰寒 1 层'],
    [E('round', 'heal', 'ally.lowp', { tmx: 0.15, every: 3 })],
    [[E('round', 'cleanse', 'same', { every: 3 })], [E('round', 'st', 'foe.fast', { k: 'chill', n: 1, every: 2 })]]),
  growring: N('年轮', '轮', '每轮', '每轮开始攻血 +〔3〕%，第 5 轮起每轮翻倍',
    ['第 4 轮起再多一层', '倒下时同一行身后的友蛊攻血 +〔5〕%'],
    [E('round', 'buff', 'self', { atk: 0.03, hp: 0.03 }), E('round', 'buff', 'self', { atk: 0.03, hp: 0.03, if: 'round>=5' })],
    [[E('round', 'buff', 'self', { atk: 0.03, hp: 0.03, if: 'round>=4' })], [E('death', 'buff', 'ally.behind', { atk: 0.05, hp: 0.05 })]]),
  stoptime: N('刹那', '刹', '布阵', '开战前先出手：打最近的敌蛊两下（各攻击 〔20〕%）',
    ['再多一下', '开战行动条提前 10%'],
    [E('prep', 'dmg', 'foe.front', { atk: 0.2, times: 2 })],
    [[E('prep', 'dmg', 'foe.front', { atk: 0.2 })], [E('start', 'adv', 'self', { v: 0.1 })]]),
};

// ======================= 主动技能（48 种，约四成）=======================
const X = (op, tg, o = {}) => ({ op, tg, ...o });
const A = (n, cap, fx, d, eff, awd3, aw3, awd5, aw5) => ({ n, cap, fx, d, eff, aw: [aw3, aw5], awd: [awd3, awd5] });
export const ACTS = {
  // 力道
  boar: A('豕突', 100, 'pounce', '撞同一行最近的敌蛊，攻击 140%，击退一格（撞上后面的蛊，两只都受伤）', [X('dmg', 'foe.front', { atk: 1.4 }), X('knock', 'same', { v: 1 })],
    '被撞的眩晕一次', [X('st', 'same', { k: 'stun', n: 1 })], '自己攻 +8%', [X('buff', 'self', { atk: 0.08 })]),
  stag: A('断头钳', 100, 'slash', '夹敌方血量比例最低的那只，攻击 170%；它血不过半时 ×1.5', [X('dmg', 'foe.lowp', { atk: 1.7, exe: 0.5, exeMul: 1.5 })],
    '再给它打上印记 2 轮', [X('st', 'same', { k: 'mark', n: 2 })], '自己行动条提前 15%', [X('adv', 'self', { v: 0.15 })]),
  glut: A('鲸吞', 110, 'pounce', '咬血量比例最低的敌蛊，攻击 120%；咬完它血不过三成就把它吞噬，得到它五成攻血', [X('dmg', 'foe.lowp', { atk: 1.2 }), X('eat', 'same', { v: 0.3, gain: 0.5 })],
    '吞的门槛提高到四成', [X('eat', 'same', { v: 0.4, gain: 0.5 })], '回复最大血量 10%', [X('heal', 'self', { mx: 0.1 })]),
  xiongli: A('熊力撼山', 120, 'pounce', '贯穿最近的那一整行，各攻击 110%，各击退一格', [X('dmg', 'foe.front', { atk: 1.1, shape: 'row' }), X('knock', 'same', { v: 1 })],
    '被撞的 50% 机会全部眩晕一次', [X('st', 'same', { k: 'stun', n: 1, chance: 0.5 })], '自己得到最大血量 10% 的护体', [X('shield', 'self', { mx: 0.1 })]),
  qingtian: A('擎天一击', 130, 'slash', '最近的敌蛊和它十字范围各受攻击 90%，自己攻 +10%', [X('dmg', 'foe.front', { atk: 0.9, shape: 'cross' }), X('buff', 'self', { atk: 0.1 })],
    '同一列的友蛊各得本蛊最大血量 15% 的护体', [X('shield', 'ally.col', { mx: 0.15 })], '最近的敌蛊眩晕一次', [X('st', 'foe.front', { k: 'stun', n: 1 })]),
  // 炎道
  fire: A('流火喷吐', 100, 'fire', '贯穿最近的那一整行，各攻击 80%，灼烧 2 轮（攻击 20%）', [X('dmg', 'foe.front', { atk: 0.8, shape: 'row' }), X('st', 'same', { k: 'burn', n: 2, atk: 0.2 })],
    '灼烧改为 3 轮', [X('st', 'same', { k: 'burn', n: 3, atk: 0.2 })], '再烧它们周围一圈（各 15%）', [X('dmg', 'same', { atk: 0.15, shape: 'ring' })]),
  flint: A('燧火连爆', 110, 'fire', '最近的敌蛊和它十字范围各受攻击 80%，然后让敌方全体灼烧 2 轮（攻击 20%）', [X('dmg', 'foe.front', { atk: 0.8, shape: 'cross' }), X('st', 'foe.all', { k: 'burn', n: 2, atk: 0.2 })],
    '灼烧改为 3 轮', [X('st', 'foe.all', { k: 'burn', n: 3, atk: 0.2 })], '被灼烧的敌蛊行动条推后 10%', [X('delay', 'same', { v: 0.1 })]),
  magma: A('熔岩喷发', 120, 'fire', '最近的那一整列各受本蛊最大血量 12% 的伤害，灼烧 2 轮（攻击 20%）', [X('dmg', 'foe.front', { mx: 0.12, shape: 'col' }), X('st', 'same', { k: 'burn', n: 2, atk: 0.2 })],
    '被喷中的各击退一格', [X('knock', 'same', { v: 1 })], '自己得到最大血量 10% 的护体', [X('shield', 'self', { mx: 0.1 })]),
  nirvana: A('劫火', 130, 'fire', '敌方全体各受攻击 60%，灼烧 3 轮（攻击 25%）', [X('dmg', 'foe.all', { atk: 0.6 }), X('st', 'same', { k: 'burn', n: 3, atk: 0.25 })],
    '自己回复最大血量 20%', [X('heal', 'self', { mx: 0.2 })], '全体友蛊攻 +5%', [X('buff', 'ally.all', { atk: 0.05 })]),
  // 冰雪道
  frost: A('冰封', 100, 'frost', '速最快的敌蛊受攻击 80%，冰寒 3 层（立刻冻住）', [X('dmg', 'foe.fast', { atk: 0.8 }), X('st', 'same', { k: 'chill', n: 3 })],
    '攻最高的敌蛊冰寒 2 层', [X('st', 'foe.top', { k: 'chill', n: 2 })], '自己行动条提前 15%', [X('adv', 'self', { v: 0.15 })]),
  hail: A('雹暴', 110, 'frost', '敌方全体各受攻击 50%，冰寒 1 层', [X('dmg', 'foe.all', { atk: 0.5 }), X('st', 'same', { k: 'chill', n: 1 })],
    '冰寒改为 2 层', [X('st', 'same', { k: 'chill', n: 1 })], '再砸一轮（各 10%）', [X('dmg', 'foe.all', { atk: 0.1 })]),
  glacier: A('冰封千里', 120, 'frost', '最近的敌蛊和它十字范围冰寒 2 层，自己得到最大血量 20% 的护体', [X('st', 'foe.front', { k: 'chill', n: 2, shape: 'cross' }), X('shield', 'self', { mx: 0.2 })],
    '自己嘲讽 2 轮', [X('st', 'self', { k: 'taunt', n: 2 })], '同一列的友蛊也得 8% 护体', [X('shield', 'ally.col', { mx: 0.08 })]),
  // 金道
  iron: A('铜墙', 90, 'shield', '自己得到最大血量 35% 的护体，嘲讽 2 轮', [X('shield', 'self', { mx: 0.35 }), X('st', 'self', { k: 'taunt', n: 2 })],
    '上下左右相邻的友蛊各得 10% 护体', [X('shield', 'ally.adj', { mx: 0.1 })], '自己挂「格挡」1 次', [X('st', 'self', { k: 'guard', n: 1 })]),
  rhino: A('犀角冲锋', 100, 'pounce', '撞最近的敌蛊，攻击 150%，击退一格（撞上更疼）', [X('dmg', 'foe.front', { atk: 1.5 }), X('knock', 'same', { v: 1, bump: 0.6 })],
    '被撞的眩晕一次', [X('st', 'same', { k: 'stun', n: 1 })], '自己得到最大血量 8% 的护体', [X('shield', 'self', { mx: 0.08 })]),
  saw: A('裂甲', 100, 'slash', '贯穿最近的那一整行，各攻击 90%，无视护体', [X('dmg', 'foe.front', { atk: 0.9, shape: 'row', pierce: 1 })],
    '被撕的打上印记 2 轮', [X('st', 'same', { k: 'mark', n: 2 })], '自己攻 +5%', [X('buff', 'self', { atk: 0.05 })]),
  baiyu: A('玉身', 110, 'shield', '自己和同一列的友蛊各挂「格挡」2 次', [X('st', 'self', { k: 'guard', n: 2 }), X('st', 'ally.col', { k: 'guard', n: 2 })],
    '同一列的友蛊再得本蛊最大血量 10% 的护体', [X('shield', 'ally.col', { mx: 0.1 })], '自己得到 10% 护体', [X('shield', 'self', { mx: 0.1 })]),
  // 木道
  vine: A('缠藤', 100, 'slash', '把敌方最靠后的蛊拉近两格，让它眩晕一次', [X('draw', 'foe.last', { v: 2 }), X('st', 'same', { k: 'stun', n: 1 })],
    '被拉近的那只再中毒（攻击 30%）', [X('st', 'same', { k: 'psn', atk: 0.3 })], '再拉近攻最高的那只', [X('draw', 'foe.top', { v: 1 })]),
  fusang: A('扶桑朝晖', 120, 'heal', '全体友蛊回复最大血量 10%，清掉减益', [X('heal', 'ally.all', { tmx: 0.1 }), X('cleanse', 'ally.all')],
    '同一列的友蛊再得本蛊最大血量 10% 的护体', [X('shield', 'ally.col', { mx: 0.1 })], '全体友蛊攻 +4%', [X('buff', 'ally.all', { atk: 0.04 })]),
  // 土道
  tortoise: A('玄武镇', 120, 'shield', '全体友蛊得到本蛊最大血量 12% 的护体，自己嘲讽 2 轮', [X('shield', 'ally.all', { mx: 0.12 }), X('st', 'self', { k: 'taunt', n: 2 })],
    '自己挂「格挡」2 次', [X('st', 'self', { k: 'guard', n: 2 })], '同一行的友蛊再得 5% 护体', [X('shield', 'ally.row', { mx: 0.05 })]),
  moveshan: A('移山', 120, 'roar', '把敌方攻最高的蛊拉近两格（撞上更疼），再对它造成攻击 120%', [X('draw', 'foe.top', { v: 2, bump: 0.6 }), X('dmg', 'same', { atk: 1.2 })],
    '推后它行动条 30%', [X('delay', 'same', { v: 0.3 })], '它眩晕一次', [X('st', 'same', { k: 'stun', n: 1 })]),
  // 雷道
  thunder: A('连环雷', 110, 'bolt', '劈敌方随机一只和它十字范围，各攻击 80%；30% 机会全部眩晕一次', [X('dmg', 'foe.rand', { atk: 0.8, shape: 'cross' }), X('st', 'same', { k: 'stun', n: 1, chance: 0.3 })],
    '被劈的打上印记 2 轮', [X('st', 'same', { k: 'mark', n: 2 })], '再劈一下（各 15%）', [X('dmg', 'same', { atk: 0.15 })]),
  dfly: A('九天引雷', 120, 'bolt', '敌方全体各受攻击 70%，行动条推后 20%', [X('dmg', 'foe.all', { atk: 0.7 }), X('delay', 'same', { v: 0.2 })],
    '20% 机会全部眩晕一次', [X('st', 'same', { k: 'stun', n: 1, chance: 0.2 })], '敌方后排再各受 15%', [X('dmg', 'foe.last', { atk: 0.15, shape: 'back' })]),
  jiuxiao: A('九霄雷狱', 140, 'bolt', '敌方全体各受攻击 70%；25% 机会全部眩晕一次', [X('dmg', 'foe.all', { atk: 0.7 }), X('st', 'same', { k: 'stun', n: 1, chance: 0.25 })],
    '被劈的打上印记 2 轮', [X('st', 'same', { k: 'mark', n: 2 })], '自己行动条提前 20%', [X('adv', 'self', { v: 0.2 })]),
  // 光道
  yueguang: A('月华斜斩', 100, 'needle', '月刃斜斩：最近的敌蛊和它斜对角的敌蛊各受攻击 100%', [X('dmg', 'foe.front', { atk: 1.0, shape: 'diag' })],
    '被斩的打上印记 2 轮', [X('st', 'same', { k: 'mark', n: 2 })], '再贯穿最近的那一整行（各 20%）', [X('dmg', 'foe.front', { atk: 0.2, shape: 'row' })]),
  solar: A('大日', 130, 'fire', '敌方全体灼烧 3 轮（攻击 25%），全体友蛊回复最大血量 10%', [X('st', 'foe.all', { k: 'burn', n: 3, atk: 0.25 }), X('heal', 'ally.all', { tmx: 0.1 })],
    '敌方全体再各受 30%', [X('dmg', 'foe.all', { atk: 0.3 })], '全体友蛊速 +10%（2 轮）', [X('buff', 'ally.all', { spd: 0.1, dur: 2 })]),
  // 暗道
  mantis: A('斩心镰', 100, 'slash', '斩敌方血最少的蛊，攻击 180%；它血不过半时 ×1.5', [X('dmg', 'foe.low', { atk: 1.8, exe: 0.5, exeMul: 1.5 })],
    '自己行动条提前 30%', [X('adv', 'self', { v: 0.3 })], '回复最大血量 10%', [X('heal', 'self', { mx: 0.1 })]),
  bat: A('夜袭', 90, 'drain', '扑向敌方血最少的蛊，攻击 140%，回复造成伤害的一半', [X('dmg', 'foe.low', { atk: 1.4, steal: 0.5 })],
    '再给它打上印记 2 轮', [X('st', 'same', { k: 'mark', n: 2 })], '伤得最重的友蛊回复 5%', [X('heal', 'ally.lowp', { tmx: 0.05 })]),
  styx: A('冥河摆渡', 120, 'summon', '在后排召回一只魂体（本蛊攻血 40%），敌方全体冰寒 1 层', [X('summon', null, { sp: 'soul', atk: 0.4, mx: 0.4, at: 'back' }), X('st', 'foe.all', { k: 'chill', n: 1 })],
    '挂上冰寒的打上印记 1 轮', [X('st', 'same', { k: 'mark', n: 2 })], '全体友蛊攻 +4%', [X('buff', 'ally.all', { atk: 0.04 })]),
  // 血道
  mosq: A('吸髓', 90, 'drain', '吸攻最高的敌蛊，攻击 130%，回复一半；偷它 15% 的攻', [X('dmg', 'foe.top', { atk: 1.3, steal: 0.5 }), X('buff', 'same', { atk: -0.15 }), X('buff', 'self', { atk: 0.15 })],
    '它打上印记 2 轮', [X('st', 'foe.top', { k: 'mark', n: 2 })], '自己行动条提前 15%', [X('adv', 'self', { v: 0.15 })]),
  xueyue: A('血月当空', 110, 'slash', '失去最大血量 12%，贯穿最近的那一整行，各攻击 160%', [X('dmg', 'self', { mx: 0.12, up: 0, pierce: 1 }), X('dmg', 'foe.front', { atk: 1.6, shape: 'row' })],
    '回复最大血量 15%', [X('heal', 'self', { mx: 0.15 })], '那一整行打上印记 2 轮', [X('st', 'foe.front', { k: 'mark', n: 2, shape: 'row' })]),
  chiba: A('赤地千里', 140, 'drain', '敌方全体各受攻击 50%、灼烧 2 轮（攻击 10%），自己回复最大血量 15%', [X('dmg', 'foe.all', { atk: 0.5 }), X('st', 'same', { k: 'burn', n: 2, atk: 0.1 }), X('heal', 'self', { mx: 0.15 })],
    '全体友蛊回复 8%', [X('heal', 'ally.all', { tmx: 0.08 })], '全体友蛊攻 +5%', [X('buff', 'ally.all', { atk: 0.05 })]),
  // 毒道
  scorp: A('三连毒针', 90, 'needle', '对敌方最靠后的蛊连射三针，各攻击 60%，中毒（攻击 30%）', [X('dmg', 'foe.last', { atk: 0.6, times: 3 }), X('st', 'same', { k: 'psn', atk: 0.3 })],
    '它打上印记 2 轮', [X('st', 'same', { k: 'mark', n: 2 })], '敌方后排各再中一针（15%）', [X('dmg', 'foe.last', { atk: 0.15, shape: 'back' })]),
  cent: A('百足噬', 90, 'pounce', '咬最近的敌蛊，攻击 140%，中毒（攻击 40%）', [X('dmg', 'foe.front', { atk: 1.4 }), X('st', 'same', { k: 'psn', atk: 0.4 })],
    '它那一整列都中毒（20%）', [X('st', 'same', { k: 'psn', atk: 0.2, shape: 'col' })], '回复最大血量 8%', [X('heal', 'self', { mx: 0.08 })]),
  toad: A('毒瘴', 110, 'spore', '敌方全体中毒（本蛊最大血量 5%）', [X('st', 'foe.all', { k: 'psn', mx: 0.05 })],
    '中毒的攻 -8%（2 轮）', [X('buff', 'same', { atk: -0.08, dur: 2 })], '吞噬一只血不过 15% 的敌蛊（得它两成攻血）', [X('eat', 'foe.lowp', { v: 0.15, gain: 0.2 })]),
  widow: A('毒吻', 100, 'pounce', '攻最高的敌蛊中毒（攻击 60%），攻 -15%（3 轮）', [X('st', 'foe.top', { k: 'psn', atk: 0.6 }), X('buff', 'same', { atk: -0.15, dur: 3 })],
    '它打上印记 2 轮', [X('st', 'same', { k: 'mark', n: 2 })], '再咬它一口（攻击 40%）', [X('dmg', 'same', { atk: 0.4 })]),
  // 智道
  webspider: A('天罗网', 90, 'needle', '最近的那一整行落网 1 次，行动条推后 30%', [X('st', 'foe.front', { k: 'web', n: 1, shape: 'row' }), X('delay', 'same', { v: 0.3 })],
    '落网的打上印记 1 轮', [X('st', 'same', { k: 'mark', n: 2 })], '再网住速最快的那只', [X('st', 'foe.fast', { k: 'web', n: 1 })]),
  cricket: A('震天鸣', 100, 'roar', '敌方全体攻 -10%（2 轮），行动条推后 25%', [X('buff', 'foe.all', { atk: -0.1, dur: 2 }), X('delay', 'same', { v: 0.25 })],
    '自己攻 +10%', [X('buff', 'self', { atk: 0.1 })], '攻最高的敌蛊被封印 1 轮', [X('st', 'foe.top', { k: 'seal', n: 2 })]),
  zhihui: A('一念', 130, 'roar', '敌方全体被封印 1 轮（蛊力不涨），全体友蛊蛊力 +25', [X('st', 'foe.all', { k: 'seal', n: 2 }), X('gp', 'ally.all', { v: 25 })],
    '攻最高的敌蛊打上印记 2 轮', [X('st', 'foe.top', { k: 'mark', n: 2 })], '清掉全体友蛊身上的减益', [X('cleanse', 'ally.all')]),
  // 魂道
  boneflute: A('安魂曲', 120, 'summon', '在后排召回一只骨灵（本蛊攻血 25%），全体友蛊攻 +5%', [X('summon', null, { sp: 'bonesoul', atk: 0.25, mx: 0.25, at: 'back' }), X('buff', 'ally.all', { atk: 0.05 })],
    '全体友蛊回复 8%', [X('heal', 'ally.all', { tmx: 0.08 })], '敌方全体冰寒 1 层', [X('st', 'foe.all', { k: 'chill', n: 1 })]),
  // 奴道
  queen: A('万蜂朝王', 120, 'summon', '后排召两只工蜂（各本蛊攻血 25%），全体友蛊攻 +5%', [X('summon', null, { sp: 'bee', atk: 0.25, mx: 0.25, at: 'back', count: 2 }), X('buff', 'ally.all', { atk: 0.05 })],
    '全体友蛊得到本蛊最大血量 5% 的护体', [X('shield', 'ally.all', { mx: 0.05 })], '再召一只', [X('summon', null, { sp: 'bee', atk: 0.25, mx: 0.25, at: 'back' })]),
  spider: A('万蛛归巢', 110, 'summon', '身后召两只小蛛（各本蛊攻血 20%），自己回复最大血量 20%', [X('summon', null, { sp: 'spiderling', atk: 0.2, mx: 0.2, at: 'behind', count: 2 }), X('heal', 'self', { mx: 0.2 })],
    '敌方最近的那只落网 1 次', [X('st', 'foe.front', { k: 'web', n: 1 })], '再召一只', [X('summon', null, { sp: 'spiderling', atk: 0.2, mx: 0.2, at: 'behind' })]),
  qant: A('蚁潮', 120, 'summon', '后排召三只兵蚁（各本蛊攻血 18%）', [X('summon', null, { sp: 'antling', atk: 0.18, mx: 0.18, at: 'back', count: 3 })],
    '全体友蛊攻 +6%', [X('buff', 'ally.all', { atk: 0.06 })], '全体友蛊得到本蛊最大血量 3% 的护体', [X('shield', 'ally.all', { mx: 0.03 })]),
  // 宇道
  gecko: A('断尾护主', 80, 'shield', '最前的友蛊得到本蛊最大血量 30% 的护体，清掉减益', [X('shield', 'ally.front', { mx: 0.3 }), X('cleanse', 'same')],
    '它再挂「格挡」1 次', [X('st', 'same', { k: 'guard', n: 1 })], '同一行的友蛊各得 5% 护体', [X('shield', 'ally.row', { mx: 0.05 })]),
  blink: A('瞬斩', 90, 'slash', '闪到敌方后排：后排各受攻击 100%', [X('dmg', 'foe.last', { atk: 1.0, shape: 'back' })],
    '被斩的打上印记 2 轮', [X('st', 'same', { k: 'mark', n: 2 })], '自己行动条提前 15%', [X('adv', 'self', { v: 0.15 })]),
  dingxian: A('定仙游', 130, 'roar', '全体友蛊行动条提前 35%，最前的友蛊挂「格挡」2 次', [X('adv', 'ally.all', { v: 0.35 }), X('st', 'ally.front', { k: 'guard', n: 2 })],
    '把敌方攻最高的蛊挪到它那一行最后一格', [X('swap', 'foe.top', { with: 'back' })], '清掉全体友蛊身上的减益', [X('cleanse', 'ally.all')]),
  // 宙道
  guangyin: A('光阴倒流', 140, 'heal', '全体友蛊回复最大血量 20%，清掉减益', [X('heal', 'ally.all', { tmx: 0.2 }), X('cleanse', 'ally.all')],
    '全体友蛊行动条提前 20%', [X('adv', 'ally.all', { v: 0.2 })], '敌方全体行动条推后 10%', [X('delay', 'foe.all', { v: 0.1 })]),
  fate: A('织命', 120, 'needle', '敌方速最快的两只行动条推后 50%，冰寒 1 层', [X('delay', 'foe.fast:2', { v: 0.5 }), X('st', 'same', { k: 'chill', n: 1 })],
    '它们打上印记 2 轮', [X('st', 'same', { k: 'mark', n: 2 })], '它们落网 1 次', [X('st', 'same', { k: 'web', n: 1 })]),
  instant: A('刹那永恒', 120, 'slash', '对最近的敌蛊连斩三下，各攻击 60%，推后它行动条 30%', [X('dmg', 'foe.front', { atk: 0.6, times: 3 }), X('delay', 'same', { v: 0.3 })],
    '它冰寒 1 层', [X('st', 'same', { k: 'chill', n: 1 })], '自己行动条提前 15%', [X('adv', 'self', { v: 0.15 })]),
};
export const ACT_COUNT = Object.keys(ACTS).length;

// ======================= 新 56 种 =======================
// S(id, 名, 简字, 道, 基础转数, 攻, 血, 速, 远近 m/r, 远程挑谁, 普攻动作, 本命 key, 机制标签, 一句话, 额外)
const S = (id, n, ab, dao, rank, a, h, spd, rc, aim, atkFx, nat, role, lore, extra = {}) =>
  ({ id, n, ab, dao, rank, tier: rank >= 6 ? 6 : rank - 1, atk: a, hp: h, t: nat, v: 1, nat, spd, reach: rc === 'r' ? 'ranged' : 'melee', aim: rc === 'r' ? aim : null, atkFx, role, lore,
    ...(rank >= 6 ? { legend: 1, immortal: true } : {}), ...extra });
const C = { canon: true };
export const SPECIES2 = [
  S('xiongli',    '熊力蛊',     '熊', 'li',    4, 3, 6, 80,  'm', null,   'pounce', 'bearforce',     '击退·坦',     '一只蛊里装着一头熊的力气，拍一掌，对面整排往后退', C),
  S('qingtian',   '擎天蛊',     '擎', 'li',    6, 4, 6, 95,  'm', null,   'slash',  'skyhold',       '成长·仙蛊',   '传说它托着一片天，压弯的是它的腿，从来不是它的背'),
  S('fireant',    '火蚁蛊',     '焰', 'yan',   1, 2, 3, 105, 'm', null,   'bite',   'scorch',        '灼烧',        '咬一口像被火燎，疼劲要过两天才退'),
  S('pyre',       '焚翅蛊',     '焚', 'yan',   2, 3, 3, 110, 'r', 'low',  'spit',   'wingfire',      '群伤·自损',   '翅膀一直烧着，飞到哪儿烧到哪儿，连自己也烧'),
  S('char',       '炭甲蛊',     '炭', 'yan',   3, 3, 5, 85,  'm', null,   'pounce', 'coal',          '受击灼烧',    '甲壳是一层炭，越敲越红'),
  S('flint',      '燧石蛊',     '燧', 'yan',   3, 3, 3, 100, 'r', 'low',  'needle', 'ignite',        '引燃追击',    '两片鞘翅一碰就是一串火星，哪里起火它就扑向哪里'),
  S('magma',      '熔岩蛊',     '熔', 'yan',   4, 3, 7, 75,  'm', null,   'slash',  'lavashell',     '反伤·坦',     '壳底下是流动的岩浆，碰它一下就烫掉一层皮'),
  S('snowsilk',   '冰蚕蛊',     '蚕', 'bing',  1, 1, 4, 90,  'r', 'top',  'spit',   'icesilk',       '冰寒·护邻',     '吐的丝是冷的，缠上去手脚就慢了'),
  S('snowflea',   '雪蚤蛊',     '雪', 'bing',  1, 3, 2, 130, 'm', null,   'bite',   'snowhop',       '专打冰寒',      '在雪地上跳着走，专咬冻僵了的'),
  S('icesnail',   '冰蜗蛊',     '蜗', 'bing',  2, 1, 5, 65,  'r', 'top',  'spit',   'drag',          '冰寒·减速',     '它慢，它也要你陪它一起慢'),
  S('coldcicada', '寒蝉蛊',     '寒', 'bing',  3, 2, 4, 95,  'r', 'low',  'wave',   'hush',          '封印',      '秋深了，它一叫，满场都不敢出声'),
  S('hail',       '雹甲蛊',     '雹', 'bing',  4, 3, 5, 85,  'r', 'low',  'needle', 'hailstorm',     '范围·冰寒',     '背上结着一层冰疙瘩，一抖就是一场雹子'),
  S('glacier',    '玄冰蛊',     '冰', 'bing',  5, 2, 7, 70,  'm', null,   'slash',  'permafrost',    '坦·冻住',     '千年不化的一块冰，打它的人手先冻僵'),
  S('yupi',       '玉皮蛊',     '玉', 'jin',   1, 1, 5, 85,  'm', null,   'bite',   'jadeskin',      '格挡·护邻',     '皮肤生出一层玉色，刀砍上去只留一道白印', C),
  S('lockarm',    '锁甲蛊',     '锁', 'jin',   2, 2, 5, 80,  'm', null,   'slash',  'interlock',     '护邻',        '甲片一节扣一节，把左右的同伴也扣了进来'),
  S('baiyu',      '白玉蛊',     '璧', 'jin',   3, 2, 6, 75,  'm', null,   'slash',  'whitejade',     '残血化玉',    '快倒下时浑身化作白玉，硬得刀枪不入', C),
  S('shengji',    '生机叶',     '叶', 'mu',    1, 1, 4, 90,  'r', 'low',  'spore',  'lifeleaf',      '治疗相邻',    '一片嫩叶，贴在谁身上，谁的伤口就合上了', C),
  S('vine',       '藤蔓蛊',     '藤', 'mu',    2, 2, 4, 95,  'r', 'last', 'needle', 'creep',         '拉近后排',   '藤条一甩就缠住后排，硬拽到跟前来'),
  S('cordy',      '虫草蛊',     '草', 'mu',    4, 3, 4, 100, 'm', null,   'bite',   'cordyceps',     '中毒·击杀召唤', '冬天是虫，夏天是草，倒在它脚下的也一样'),
  S('fusang',     '扶桑蛊',     '桑', 'mu',    5, 2, 6, 85,  'r', 'low',  'spore',  'sunroot',       '群体治疗',    '日出的那棵树上，只住着它一只'),
  S('stonecase',  '石蚕蛊',     '石', 'tu',    1, 1, 5, 70,  'm', null,   'bite',   'stoneskin',     '坦·减伤',     '用砂石给自己缝了件衣服，刀砍上去只溅火星'),
  S('earthworm',  '地龙蛊',     '蚓', 'tu',    2, 2, 4, 85,  'm', null,   'bite',   'earthdragon',   '免死·分身',   '断成两截，两截都还能动'),
  S('moveshan',   '搬山蛊',     '搬', 'tu',    4, 3, 6, 70,  'm', null,   'pounce', 'shiftmount',    '击退',        '挡路的不是山，是还没被它搬走的山'),
  S('static',     '静电蛊',     '静', 'lei',   1, 2, 3, 110, 'm', null,   'bite',   'charge',        '反击·眩晕',   '一身绒毛炸着，谁摸谁一哆嗦'),
  S('jingzhe',    '惊蛰蛊',     '蛰', 'lei',   1, 2, 3, 105, 'r', 'low',  'wave',   'springthunder', '开局群控',    '第一声春雷就是它叫醒的'),
  S('click',      '叩甲蛊',     '叩', 'lei',   2, 3, 3, 120, 'm', null,   'pounce', 'clickjump',     '随机击退',    '翻过身啪的一弹，带着雷声砸下来'),
  S('cloud',      '积云蛊',     '云', 'lei',   3, 2, 4, 90,  'r', 'low',  'bolt',   'thundercloud',  '蓄力群伤',    '头顶总飘着一小朵乌云，攒够了就下'),
  S('magstorm',   '磁暴蛊',     '磁', 'lei',   4, 3, 4, 115, 'm', null,   'bolt',   'magburst',      '专打眩晕',    '它一靠近，你的骨头都在发麻'),
  S('jiuxiao',    '九霄蛊',     '霄', 'lei',   6, 4, 5, 120, 'r', 'low',  'bolt',   'ninebolt',      '群伤·仙蛊',   '九重天上的雷都听它调遣'),
  S('yueguang',   '月光蛊',     '月', 'guang', 1, 3, 2, 115, 'r', 'low',  'needle', 'moonblade',     '贯穿整行',    '掌心一道弯月，挥出去就是一片银白的刀光', C),
  S('sheli',      '舍利蛊',     '舍', 'guang', 2, 1, 4, 95,  'r', 'low',  'wave',   'relic',         '增益相邻',    '一粒温润的珠子，放在身边，修为就往上涨', C),
  S('shine',      '照夜蛊',     '照', 'guang', 3, 3, 3, 125, 'r', 'lowp', 'needle', 'nightlight',    '暴击·印记',   '夜里它一亮，你的破绽全露出来了'),
  S('solar',      '曜日蛊',     '曜', 'guang', 5, 3, 5, 95,  'r', 'low',  'spit',   'sunfire',       '灼烧·治疗',   '背上驮着一轮小太阳，烤敌人，暖自己人'),
  S('ink',        '墨斗蛊',     '墨', 'an',    1, 2, 3, 105, 'r', 'top',  'spit',   'inkcloud',      '落网一列',    '一口墨喷出来，对面一整列什么都看不见'),
  S('bat',        '夜蝠蛊',     '蝠', 'an',    2, 3, 3, 130, 'r', 'low',  'bite',   'nightsip',      '吸血·续航',   '白天倒挂着睡，夜里专挑伤最重的下嘴'),
  S('eclipse',    '月蚀蛊',     '蚀', 'an',    4, 3, 4, 110, 'r', 'last', 'needle', 'blotout',       '削弱·冰寒',     '它爬过月亮，月亮就缺了一块'),
  S('styx',       '冥蝶蛊',     '冥', 'an',    5, 2, 5, 100, 'r', 'low',  'wave',   'ferry',         '复生',        '从阴间飞回来的蝶，总会带回一个人'),
  S('tick',       '蜱蛊',       '蜱', 'xue',   1, 2, 3, 100, 'm', null,   'bite',   'latch',         '偷血·专打中毒', '小得看不见，咬上了就越吸越大'),
  S('bloodant',   '血蚁蛊',     '赤', 'xue',   1, 3, 2, 115, 'm', null,   'bite',   'bloodpact',     '献血增益',    '一窝血蚁，先咬破自己，再替兄弟出头'),
  S('amber',      '血珀蛊',     '珀', 'xue',   3, 2, 5, 75,  'm', null,   'slash',  'clot',          '免死',        '死到临头，它把自己封进一块血色琥珀'),
  S('xueyue',     '血月蛊',     '血', 'xue',   4, 4, 4, 110, 'm', null,   'slash',  'bloodmoon',     '残血贯穿',    '月光蛊饮够了血，弯月就染成了红色', C),
  S('chiba',      '赤魃蛊',     '魃', 'xue',   6, 4, 6, 105, 'r', 'low',  'wave',   'drought',       '群体吸血·仙蛊', '它走过的地方，三年不下雨'),
  S('widow',      '寡妇蛛',     '寡', 'du',    4, 3, 4, 105, 'm', null,   'bite',   'widowkiss',     '中毒·吞噬',       '红沙漏纹在腹下，一吻就是一条命'),
  S('jiuchong',   '酒虫',       '酒', 'zhi',   1, 1, 4, 95,  'r', 'low',  'spore',  'brew',          '攒蛊力',      '肚里一汪酒，喝一口，身边的蛊都来了精神', C),
  S('diting',     '地听肉耳草', '听', 'zhi',   2, 1, 4, 100, 'r', 'top',  'wave',   'earlisten',     '印记',        '长得像一只耳朵的草，贴着地，听得见对面谁最凶', C),
  S('zhihui',     '智慧蛊',     '智', 'zhi',   6, 3, 6, 105, 'r', 'top',  'wave',   'wisdom',        '蛊力·仙蛊',   '它不出手，它只是比所有人都先想到下一步', C),
  S('will',       '鬼火蛊',     '磷', 'hun',   1, 2, 2, 110, 'r', 'low',  'spit',   'wisp',          '亡语接力·冰寒', '坟头那点绿火，其实是它在等人'),
  S('boneflute',  '骨笛蛊',     '笛', 'hun',   5, 2, 5, 90,  'r', 'low',  'wave',   'dirge',         '亡者增益',    '用倒下的同伴的骨头吹出来的曲子，越吹越响'),
  S('strider',    '水黾蛊',     '黾', 'yu',    1, 2, 3, 125, 'r', 'low',  'needle', 'skate',         '后排护体·冰寒', '站在水面上，从来不沾湿脚'),
  S('inch',       '尺蠖蛊',     '尺', 'yu',    1, 2, 4, 80,  'm', null,   'bite',   'inchforward',   '挪位',        '一弓一伸，量着步子往前挪'),
  S('blink',      '瞬移蛊',     '瞬', 'yu',    4, 3, 3, 135, 'm', null,   'slash',  'warp',          '打完就换位',  '出一刀，人已经回到了队尾'),
  S('dingxian',   '定仙游',     '游', 'yu',    6, 3, 6, 120, 'r', 'low',  'wave',   'roam',          '换位·仙蛊',   '心念一动，人已在千里之外', C),
  S('asahi',      '朝菌蛊',     '菌', 'zhou',  1, 3, 2, 115, 'm', null,   'bite',   'dawn',          '开局爆发',    '早上生，晚上死，所以早上最凶'),
  S('hourglass',  '沙漏蛊',     '漏', 'zhou',  2, 1, 5, 90,  'r', 'lowp', 'wave',   'backflow',      '治疗·倒流',   '肚子里的沙往上流，伤口就往回长'),
  S('ring',       '年轮蛊',     '轮', 'zhou',  3, 2, 5, 85,  'm', null,   'slash',  'growring',      '越拖越强',    '多活一轮，身上就多一圈纹'),
  S('instant',    '刹那蛊',     '刹', 'zhou',  5, 3, 3, 150, 'm', null,   'slash',  'stoptime',      '先手连击',    '在别人眨眼的工夫里，它已经出了两刀'),
];
export const SUMMONS2 = { grass: '虫草', sprout: '新芽', soul: '魂体', wormhalf: '半截地龙', bonesoul: '骨灵', xueshen: '血神子' };

// ======================= 旧 64 种 =======================
// 道、战斗字段（速 远近 挑谁 普攻动作）
const DAO64 = `li boar tiger drum stag glut locust|yan fire bomb nirvana|bing frost|jin iron rhino gold jinchan saw|mu thorn stick silk taisui|tu dung mole antlion tortoise yue
lei thunder dfly|guang moth firefly mirror|an mantis hex sleep|xue leech mosq urn|du scorp hairy cent wasp toad hairworm|zhi webspider cricket lure orchid
hun bone cicada qingfu fly bury|nu queen ant aphid spider qant hive puppet twin|yu gecko flea bfly|zhou mayfly guangyin fate`;
const B64 = `boar 95 m - pounce|fire 100 r low spit|twin 105 m - slash|iron 70 m - pounce|thorn 80 m - slash|mantis 120 m - slash|bone 85 m - bite|queen 90 r low wave
cicada 100 m - pounce|drum 85 r low wave|scorp 105 r last needle|moth 95 r low spore|ant 100 m - bite|firefly 110 r low spit|stick 80 m - slash|leech 95 m - bite
dung 70 m - pounce|tiger 140 m - pounce|webspider 100 r top needle|aphid 105 m - bite|hairy 85 m - bite|cent 105 m - bite|wasp 130 r low needle|spider 80 m - bite
mole 95 m - pounce|gecko 90 r low wave|qingfu 100 m - bite|bomb 90 m - pounce|silk 70 m - bite|mosq 125 r top needle|rhino 80 m - pounce|gold 85 m - pounce
qant 85 r low wave|flea 140 m - bite|bfly 115 r low spore|sleep 90 r top spore|stag 100 m - slash|glut 95 m - bite|toad 75 r low spore|cricket 110 m - pounce
locust 115 m - slash|mirror 80 m - slash|hive 75 r low wave|fly 120 m - bite|bury 85 m - bite|frost 110 r top needle|lure 105 r low spore|antlion 75 m - bite
mayfly 140 m - pounce|thunder 100 m - bolt|tortoise 60 m - pounce|puppet 95 r low needle|hairworm 110 r top needle|urn 70 m - bite|hex 100 r top spore|saw 90 m - slash
dfly 135 r low bolt|orchid 110 m - slash|taisui 75 m - bite|yue 60 r low wave|jinchan 85 r low spit|guangyin 100 r low wave|fate 95 r top needle|nirvana 110 r low spit`;
// 「一转口径」攻血比例（取自原物种表，合计不足 5 的按比例放大）与基础转数
const P64 = `boar 3 4|fire 2 3|twin 2 3|iron 2 5|thorn 2 4|mantis 4 2|bone 2 2|queen 2 3|cicada 2 3|drum 1 4|scorp 1 2|moth 1 2|ant 2 3|firefly 2 2|stick 1 3|leech 2 3
dung 1 4|tiger 3 2|webspider 1 2|aphid 1 2|hairy 2 3|cent 2 3|wasp 2 2|spider 1 5|mole 3 3|gecko 1 4|qingfu 2 3|bomb 2 2|silk 1 4|mosq 1 3|rhino 2 4|gold 2 3
qant 2 4|flea 3 3|bfly 3 4|sleep 1 4|stag 3 4|glut 3 3|toad 1 4|cricket 2 3|locust 2 3|mirror 2 4|hive 1 6|fly 2 3|bury 2 4|frost 2 3|lure 1 3|antlion 2 4
mayfly 6 6|thunder 3 4|tortoise 2 4|puppet 3 3|hairworm 2 3|urn 2 3|hex 1 3|saw 3 5|dfly 2 3|orchid 1 3|taisui 2 4|yue 2 6|jinchan 3 4|guangyin 2 4|fate 2 5|nirvana 3 3`;
const RANK64 = { boar: 1, fire: 1, twin: 1, iron: 1, thorn: 1, bone: 1, mantis: 2, queen: 2, cicada: 2, drum: 3, scorp: 3, moth: 3,
  ant: 1, firefly: 1, stick: 1, leech: 1, dung: 1, tiger: 1, webspider: 1, aphid: 1, hairy: 1, cent: 1, wasp: 2, spider: 2, mole: 2, gecko: 2, qingfu: 2, bomb: 2, silk: 2, mosq: 2, rhino: 2, gold: 2,
  qant: 3, flea: 3, bfly: 3, sleep: 3, stag: 3, glut: 3, toad: 3, cricket: 3, locust: 3, mirror: 4, hive: 4, fly: 4, bury: 4, frost: 4, lure: 4, antlion: 4, mayfly: 4,
  thunder: 5, tortoise: 5, puppet: 5, hairworm: 5, urn: 5, hex: 5, saw: 5, dfly: 5, orchid: 5, taisui: 5, yue: 5, jinchan: 5, guangyin: 6, fate: 6, nirvana: 6 };
// 换成原著名字的旧物种（id 不变，存档和坐标码照旧）
const RENAME64 = {
  boar: { n: '白豕蛊', canon: true, lore: '一头白豕的蛮力附在身上，越挨打越疯' },
  tiger: { n: '黑豕蛊', ab: '黑', canon: true, lore: '一头黑豕的蛮力，全压在冲出去的第一下' },
  iron: { n: '铜皮蛊', ab: '铜', canon: true, lore: '一身铜皮，壳比命硬' },
  firefly: { n: '小光蛊', ab: '光', canon: true, lore: '一点微光，灭之前也要照出你的破绽' },
  guangyin: { n: '春秋蝉', ab: '春', canon: true, lore: '春去秋来只叫一声。它叫一声，日影就往回走一寸——覆灭的阵前，所有人回到开战那一刻，只是都老了一半；叫完这一声，它自己只剩一口气。' },
};

// ======================= 仙蛊上阵规则 =======================
// 一队最多 1 只仙蛊；仙蛊占额度 8（比它的转数 6 多扣 2）。平衡倍率按「8 点额度换一只仙蛊」调（对照：同一底队 + 五转 + 三转）。
// 接法：core.quotaOf 里仙蛊记 IMMORTAL.cost 点；上阵、换阵、开茧放进空窍时，队里已有 IMMORTAL.max 只仙蛊就拦下并提示「一队只能有一只仙蛊」。
export const IMMORTAL = { max: 1, cost: 8 };

// ======================= 每转攻血表 =======================
// 每转倍率：一转 ×1.15、二转 ×2.05、三转 ×2.6、四转 ×3.25、五转 ×3.75、仙蛊 ×6.35；基础转数每高一转多 6%（买得更贵）。
// 每升一转攻血至少涨 15%（design：每次升转要有体感）：二转 +78%、三转 +27%、四转 +25%、五转 +15%。
// 按额度算，高转每点给的攻血少一些：高转另有三转、五转觉醒，主动技、被动技随转数涨（引擎 TUNE.actUp / upMul），杀招威力看核心转数。
// 五转觉醒的数值已经按一半写（原先 [5,5,5,5,2] 四只五转觉醒叠起来能到 69%），几条「再来一次 / 吞掉敌蛊」的觉醒也改成了次数更少的版本。
// 拟合用「同额度不同分法循环赛」（7/10/15/22 点共 17 种分法两两对打，各 200 局×2），每种分法都在 44%–55%。
// 仙蛊 ×6.35 = 五转 + 三转（仙蛊占 8 点额度）。改了技能涨幅或觉醒要用 tune/hm2.mjs 重拟。
export const ST_GROW = [0, 1.15, 2.05, 2.6, 3.25, 3.75, 6.35];
// 平衡倍率（按「同额度下每种蛊每点额度的胜率 42%–58%」迭代出来，design 2.7）：攻血表整体乘它。
// 测法和 tools/sim.mjs 一样：同一支底队（秘境 foeByBudget，4/9/15/22 点），只换第一只转数够的：A 放这种蛊、B 放同转数、同基础转数的另一种，两边各站一次；仙蛊按 8 点额度，对照是同一底队 + 五转 + 三转。
// 在主线 17e0b21 的引擎上（主动技每转 +6%、被动技涨幅减半、速 SPD_K 0.10）每种 400 局×两边各站一次：120 种都在 43%–58%。
// 技能强的蛊攻血低一些（赤魃 0.26、九霄 0.31），技能弱的辅助蛊攻血高一些（玉皮 2.2、石蚕 1.71）；改技能数值后要重跑。表里的数是放大前的，core.statFor 再乘 STAT_SCALE（血再乘 HP_SCALE）。
export const BAL = { amber: 1.26, ant: 1.01, antlion: 1.1, aphid: 1.31, asahi: 1.52, baiyu: 0.98, bat: 0.83, bfly: 0.6, blink: 0.98, bloodant: 1.54, boar: 0.97, bomb: 1.19, bone: 1.19, boneflute: 0.47, bury: 1.13, cent: 1.19, char: 0.9, chiba: 0.26, cicada: 1.25, click: 0.97, cloud: 0.91, coldcicada: 1.17, cordy: 0.9, cricket: 0.97, dfly: 0.87, dingxian: 0.5, diting: 1.58, drum: 1.87, dung: 1.71, earthworm: 1.42, eclipse: 0.95, fate: 0.61, fire: 1.16, fireant: 1.57, firefly: 1.21, flea: 1.02, flint: 0.78, fly: 1.14, frost: 1.01, fusang: 0.38, gecko: 1.27, glacier: 0.66, glut: 0.83, gold: 1.53, guangyin: 0.53, hail: 0.61, hairworm: 0.85, hairy: 1.4, hex: 1.37, hive: 0.75, hourglass: 1.19, icesnail: 1.84, inch: 1.38, ink: 0.95, instant: 0.9, iron: 0.86, jinchan: 0.74, jingzhe: 1.31, jiuchong: 1.84, jiuxiao: 0.34, leech: 1.45, lockarm: 1.21, locust: 1.1, lure: 1.29, magma: 0.64, magstorm: 1.03, mantis: 1.11, mayfly: 0.57, mirror: 1.25, mole: 1.12, mosq: 0.95, moth: 1.29, moveshan: 0.66, nirvana: 0.36, orchid: 1.25, puppet: 0.82, pyre: 0.93, qant: 0.56, qingfu: 1.3, qingtian: 0.4, queen: 0.62, rhino: 1.07, ring: 0.91, saw: 0.72, scorp: 0.98, sheli: 1.38, shengji: 1.33, shine: 1.04, silk: 1.67, sleep: 1.78, snowflea: 1.7, snowsilk: 1.73, solar: 0.52, spider: 0.65, stag: 0.89, static: 1.56, stick: 1.94, stonecase: 1.53, strider: 1.4, styx: 0.6, taisui: 1.1, thorn: 1.28, thunder: 0.62, tick: 1.56, tiger: 1.24, toad: 0.96, tortoise: 0.61, twin: 1.23, urn: 1.35, vine: 1.07, wasp: 0.93, webspider: 0.99, widow: 0.77, will: 1.29, xiongli: 0.61, xueyue: 0.56, yue: 1.05, yueguang: 1.33, yupi: 2.09, zhihui: 0.63 };
// 保留一位小数：core.statFor 乘 STAT_SCALE（10）后再取整，倍率的细微差别不会在小数值上被抹掉
const r1 = x => Math.max(0.1, Math.round(x * 10) / 10);
const table = (a, h, r0, id) => {
  const t = a + h, k = (t < 5 ? 5 / t : 1) * (BAL[id] || 1), prem = 1 + 0.06 * (Math.min(6, r0) - 1), st = Array(7).fill(null);
  for (let r = r0; r <= (r0 >= 6 ? 6 : 5); r++) st[r] = [r1(a * k * ST_GROW[r] * prem), r1(h * k * ST_GROW[r] * prem)];
  return st;
};
export const ST120 = {};
P64.split(/[|\n]/).forEach(x => { const [id, a, h] = x.trim().split(' '); ST120[id] = table(+a, +h, RANK64[id], id); });
SPECIES2.forEach(s => { ST120[s.id] = table(s.atk, s.hp, s.rank, s.id); s.st = ST120[s.id]; s.act = ACTS[s.id] || null; });

export const PATCH64 = {};
DAO64.split(/[|\n]/).forEach(x => { const [d, ...ids] = x.trim().split(' '); ids.forEach(id => { PATCH64[id] = { dao: d }; }); });
B64.split(/[|\n]/).forEach(x => {
  const [id, spd, rc, aim, atkFx] = x.trim().split(' ');
  Object.assign(PATCH64[id], { spd: +spd, reach: rc === 'r' ? 'ranged' : 'melee', aim: aim === '-' ? null : aim, atkFx, act: ACTS[id] || null, st: ST120[id] }, RENAME64[id] || {});
});

// ======================= 汇总 =======================
export const BATTLE120 = {};
Object.entries(PATCH64).forEach(([id, p]) => { BATTLE120[id] = { spd: p.spd, reach: p.reach, aim: p.aim, atkFx: p.atkFx, act: p.act, st: p.st }; });
SPECIES2.forEach(s => { BATTLE120[s.id] = { spd: s.spd, reach: s.reach, aim: s.aim, atkFx: s.atkFx, act: s.act, st: s.st }; });
export const DAO120 = Object.fromEntries([...Object.entries(PATCH64).map(([id, p]) => [id, p.dao]), ...SPECIES2.map(s => [s.id, s.dao])]);
export const CANON = [...Object.entries(RENAME64).map(([id, r]) => [id, r.n]), ...SPECIES2.filter(s => s.canon).map(s => [s.id, s.n])];
const NAT_OF64 = { boar: 'rage', fire: 'blaze', twin: 'mirage', iron: 'ironskin', thorn: 'bramble', mantis: 'heart', bone: 'rot', queen: 'royal', cicada: 'molt', drum: 'beat', scorp: 'sting', moth: 'moon',
  ant: 'muster', firefly: 'ember', stick: 'ripen', leech: 'leech', dung: 'roll', tiger: 'blitz', webspider: 'web', aphid: 'scatter', hairy: 'nettle', cent: 'venom', wasp: 'prick', spider: 'brood',
  mole: 'burrow', gecko: 'ward', qingfu: 'mother', bomb: 'burst', silk: 'cocoon', mosq: 'drain', rhino: 'scale', gold: 'gild', qant: 'nurture', flea: 'hop', bfly: 'pair', sleep: 'lull',
  stag: 'execute', glut: 'gorge', toad: 'miasma', cricket: 'chirp', locust: 'cleave', mirror: 'mirror', hive: 'hive', fly: 'mourn', bury: 'inherit', frost: 'frost', lure: 'lure', antlion: 'pit',
  mayfly: 'brief', thunder: 'chain', tortoise: 'bulwark', puppet: 'strings', hairworm: 'parasite', urn: 'urn', hex: 'hex', saw: 'sunder', dfly: 'storm', orchid: 'mimic', taisui: 'regrow',
  yue: 'aegis', jinchan: 'coin', guangyin: 'rewind', fate: 'fate', nirvana: 'phoenix' };
export const NAT_OF = id => NAT_OF64[id] || (SPECIES2.find(s => s.id === id) || {}).nat || null;

// 通用效果：give = 这只蛊会挂上 / 做出，use = 这只蛊专门吃这一种（条件里读它，或靠 inflict / allyInflict 接）
export const KW = { psn: '中毒', burn: '灼烧', chill: '冰寒', guard: '护体、格挡', summon: '召唤', eat: '吞噬', knock: '击退、拉近', mark: '印记' };
function kwOf(list) {
  const give = new Set(), use = new Set();
  for (const e of list) {
    if (e.op === 'st' && KW[e.k]) give.add(e.k);
    if (e.op === 'shield') give.add('guard');
    if (e.op === 'summon') give.add('summon');
    if (e.op === 'eat') { give.add('eat'); use.add('summon'); }
    if (e.op === 'knock' || e.op === 'draw') give.add('knock');
    const c = String(e.if || '');
    for (const k of ['psn', 'burn', 'chill', 'mark', 'guard', 'summon']) if (c.includes('tg.' + k) || c.includes('k=' + k)) use.add(k);
    if (e.when === 'summon') use.add('summon');
  }
  return { give: [...give], use: [...use] };
}
export const KW120 = Object.fromEntries(Object.keys(DAO120).map(id => {
  const t = NATS[NAT_OF(id)] || {}, a = ACTS[id];
  return [id, kwOf([...(t.eff || []), ...(t.awEff || []).flat(), ...(a ? [...a.eff, ...a.aw.flat()] : [])])];
}));
