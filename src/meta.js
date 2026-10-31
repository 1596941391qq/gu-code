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
//    败局：连胜不扣已有东西，只失去加成；败局照样推进 经验 / 魂片 / 天机 / 每日 / 成就（out.notes 有「败也有得」）。
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
import { makeRng, hashStr, SPECIES, COMBOS, TRAIT_KEYS, MAXV, ECON, addTrait, trCap } from './core.js';

// ───────────────────────── 调参总表（贡献者/调参 agent 只改这几张表）─────────────────────────
export const META_TUNE = {
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
  // 战败：每败 +1 魂片，攒满 shardNeed 得一个木箱；败局还把天机往前推 pityStep 次
  lose: { shardNeed: 4, pityStep: 1 },
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
export const RARITY = [
  { id: 'fan', n: '凡', p: 60, mul: 1.0, traits: 0, col: '#8f8775' },
  { id: 'liang', n: '良', p: 25, mul: 1.15, traits: 0, col: '#6fb7a4' },
  { id: 'zhen', n: '珍', p: 10, mul: 1.35, traits: 1, col: '#6f9fd8' },
  { id: 'jue', n: '绝', p: 4, mul: 1.7, traits: 1, col: '#d9a441' },
  { id: 'tian', n: '天', p: 1, mul: 2.2, traits: 2, col: '#d8553f' },
];

// 宝箱：stone=元石区间；cocoonP=附送蛊茧几率；minRar=该茧保底稀有度；charmP=护心符几率；xp=经验区间
export const CHESTS = {
  wood: { n: '木箱', stone: [1, 3], cocoonP: 0.03, minRar: 0, charmP: 0, xp: [4, 8] },
  copper: { n: '铜箱', stone: [3, 6], cocoonP: 0.1, minRar: 0, charmP: 0, xp: [8, 16] },
  silver: { n: '银箱', stone: [6, 12], cocoonP: 0.22, minRar: 1, charmP: 0.05, xp: [16, 30] },
  gold: { n: '金箱', stone: [12, 24], cocoonP: 0.45, minRar: 1, charmP: 0.2, xp: [30, 60] },
  xuan: { n: '玄箱', stone: [25, 50], cocoonP: 1, minRar: 2, charmP: 0.5, xp: [80, 150] },
};
export const CHEST_KEYS = Object.keys(CHESTS);

// 蛊师等级奖励：k=stone 元石 / chest 宝箱 / cocoon 蛊茧(n=保底稀有度) / charm 护心符 / species 蛊种进池 / slot 蛊市加格 / title 称号
// 默认每级 1+⌊L/10⌋ 元石、每 3 级一个箱、每 5 级一个茧；下面 special 覆盖；里程碑（10 的倍数）给大奖
export const LEVEL_REWARDS = (() => {
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
  sp(8, [{ k: 'stone', n: 5 }, { k: 'charm', n: 1 }]);
  sp(10, [{ k: 'chest', tier: 'silver' }, { k: 'cocoon', n: 1 }, { k: 'species', id: 'queen' }, { k: 'title', id: 'lv10' }]);
  sp(14, [{ k: 'species', id: 'cicada' }, { k: 'stone', n: 4 }]);
  sp(15, [{ k: 'slot', n: 1 }, { k: 'cocoon', n: 1 }, { k: 'chest', tier: 'silver' }]);
  sp(18, [{ k: 'species', id: 'drum' }, { k: 'chest', tier: 'silver' }]);
  sp(20, [{ k: 'chest', tier: 'gold' }, { k: 'cocoon', n: 2 }, { k: 'charm', n: 1 }]);
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
export const LEVEL_BIG = [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];

// 成就奖励（按档，单个成就可用 reward 覆盖）与成就点
export const ACH_TIER = {
  bronze: { n: '铜', pt: 1, reward: [{ k: 'xp', n: 25 }, { k: 'stone', n: 2 }] },
  silver: { n: '银', pt: 3, reward: [{ k: 'xp', n: 80 }, { k: 'chest', tier: 'copper' }] },
  gold: { n: '金', pt: 6, reward: [{ k: 'xp', n: 250 }, { k: 'chest', tier: 'gold' }, { k: 'cocoon', n: 2 }] },
};

// 成就：[id, 档, 名, 说明, check(c), 隐藏?]。c = { M, st(=M.stats), type, p, S }
const mkAch = (id, tier, n, d, check, hidden) => ({ id, tier, n, d, check, hidden: !!hidden });
const mkStat = (k, n) => c => c.st[k] >= n;
export const ACHIEVEMENTS = [
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
export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
export const achReward = a => a.reward || ACH_TIER[a.tier].reward;

// 称号：ap=成就点达到即得；lv=由蛊师等级奖励发放。分享卡上显示 titleName(M)
export const TITLES = [
  { id: 't0', n: '无名蛊师', ap: 0 }, { id: 't1', n: '初窥门径', ap: 4 }, { id: 't2', n: '炼气蛊徒', ap: 10 }, { id: 't3', n: '空窍行者', ap: 20 },
  { id: 't4', n: '夜行蛊师', ap: 34 }, { id: 't5', n: '百炼蛊修', ap: 52 }, { id: 't6', n: '一方蛊宗', ap: 75 }, { id: 't7', n: '天机在握', ap: 100 }, { id: 't8', n: '蛊道圆满', ap: 125 },
  { id: 'lv10', n: '十级蛊师', lv: 10 }, { id: 'lv25', n: '蛊师·百炼', lv: 25 }, { id: 'lv50', n: '蛊师·半百', lv: 50 }, { id: 'lv75', n: '蛊师·登峰', lv: 75 }, { id: 'lv100', n: '蛊师·满级', lv: 100 },
];

// 每日任务池：按日期种子抽 taskCount 个；inc(type,p) 返回本事件的进度增量；chest=完成奖励的箱
export const DAILY_TASKS = [
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
export const SIGN_REWARDS = [
  [{ k: 'stone', n: 2 }], [{ k: 'chest', tier: 'wood' }], [{ k: 'stone', n: 3 }, { k: 'charm', n: 1 }], [{ k: 'chest', tier: 'copper' }],
  [{ k: 'stone', n: 5 }], [{ k: 'cocoon', n: 1 }], [{ k: 'chest', tier: 'gold' }, { k: 'cocoon', n: 2 }],
];

// 分批解锁：need 里的条件全满足即点亮（nodes=已走节点数 wins=胜场 level=蛊师等级 realm=境界）
export const UNLOCKS = {
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
export const UNLOCK_ORDER = Object.keys(UNLOCKS);

// ───────────────────────── 状态 ─────────────────────────
const clone = o => JSON.parse(JSON.stringify(o));
export function metaInit() {
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
export function metaMigrate(m, S) {
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
export const levelNeed = L => Math.round(META_TUNE.level.base * Math.pow(META_TUNE.level.growth, L - 1));
export function levelInfo(M) {
  const L = M.level, max = META_TUNE.level.max, nextL = Math.min(max, L + 1);
  return { level: L, cur: M.xp, need: L >= max ? 0 : levelNeed(L), next: L >= max ? [] : LEVEL_REWARDS[nextL], big: LEVEL_BIG.includes(nextL) };
}
export function xpTotalTo(L) { let s = 0; for (let i = 1; i < L; i++) s += levelNeed(i); return s; }

// ───────────────────────── 稀有度与天机 ─────────────────────────
const pityThr = M => (M.pity.first ? META_TUNE.pity.firstEvery : META_TUNE.pity.every);
// 距天机还有几次开茧（1 = 下一次必出绝或以上）
export function pityLeft(M) { return Math.max(1, pityThr(M) - M.pity.n); }
export const rarityOdds = () => RARITY.map(r => ({ id: r.id, n: r.n, pct: r.p }));
// 开一次茧的稀有度（0-4）。带天机：达到次数必出绝/天；minRar 为保底下限（如玄箱的茧）
export function rollRarity(M, rng, minRar = 0) {
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
export function openCocoon(M, rng) { if (!M.cocoons.length) return null; const minRar = M.cocoons.shift(); return { tier: rollRarity(M, rng, minRar), minRar }; }
// 给蛊加稀有度：属性倍率 + 额外词条。gu.rar = 0..4（已有 rar 则不重复）
export function applyRarity(gu, tier, rng) {
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
export const metaPool = M => M.species.slice();

// ───────────────────────── 蛊的灵气等级 ─────────────────────────
export const guQiNeed = l => Math.round(META_TUNE.gu.base * Math.pow(META_TUNE.gu.growth, l));
// 给一只蛊喂灵气（token）。返回 {ups, atk, hp, level, cur, need}
export function feedGu(g, amount) {
  const T = META_TUNE.gu; g.ql = g.ql || 0; g.qx = (g.qx || 0) + Math.max(0, amount); let ups = 0, atk = 0, hp = 0;
  while (g.ql < T.max && g.qx >= guQiNeed(g.ql)) { g.qx -= guQiNeed(g.ql); g.ql++; ups++; hp += T.hp; if (g.ql % T.atkEvery === 0) atk++; }
  if (g.ql >= T.max) g.qx = 0;
  g.atk += atk; g.hp += hp;
  return { ups, atk, hp, level: g.ql, cur: g.qx, need: g.ql >= T.max ? 0 : guQiNeed(g.ql) };
}
// token 流动时给全队分灵气：炉口（最左）占 leadShare，其余均分。返回 [{uid, qi, up}]，ui 在蛊头冒「+灵气」
export function feedTeam(team, tokens) {
  const n = team.length; if (!n || !(tokens > 0)) return [];
  const lead = n === 1 ? 1 : META_TUNE.gu.leadShare, rest = n > 1 ? (1 - lead) / (n - 1) : 0;
  return team.map((g, i) => { const qi = Math.round(tokens * (i === 0 ? lead : rest)), r = feedGu(g, qi); return { uid: g.uid, qi, up: r.ups, atk: r.atk, hp: r.hp }; });
}
export const qiText = n => '+' + (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : n) + '灵气';

// ───────────────────────── 宝箱 ─────────────────────────
export function rollChest(rng, tier) {
  const c = CHESTS[tier], rewards = [{ k: 'stone', n: rint(rng, c.stone) }];
  if (rng() < c.cocoonP) rewards.push({ k: 'cocoon', n: c.minRar });
  if (c.charmP && rng() < c.charmP) rewards.push({ k: 'charm', n: 1 });
  rewards.push({ k: 'xp', n: rint(rng, c.xp) });
  return { tier, rewards };
}
const chestTier = (rng, w) => nextTierKey(wpick(rng, w));
// 打开一个未开的宝箱（idx 默认第一个）。返回 out 同形状 + tier
export function openChest(M, rng, idx = 0) {
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
export const streakMul = n => Math.min(META_TUNE.streak.cap, 1 + META_TUNE.streak.perWin * Math.max(0, n - 1));
export function streakInfo(M) { const T = META_TUNE.streak, n = M.streak.n; return { n, mul: streakMul(n), charms: M.streak.charms, charmCost: T.charmCost, canGuard: n >= T.minForCharm }; }
export const charmCost = () => META_TUNE.streak.charmCost;
// 败局前给 ui 判断是否值得弹「护心符」按钮
export const canGuardStreak = M => M.streak.n >= META_TUNE.streak.minForCharm;

// ───────────────────────── 转市 ─────────────────────────
export function shopFlags(wares) {
  const ids = wares.filter(w => w && !w.sold).map(w => w.sp), c = {}; ids.forEach(i => { c[i] = (c[i] || 0) + 1; });
  const mx = Math.max(0, ...Object.values(c));
  return { triple: ids.length >= 3 && mx >= 3, nearMiss: ids.length >= 3 && mx === 2 };
}
// 新手前几次转市保证：第 1 次近失、第 2 次三同（合炼机会）、之后到 rigUntil 交替；返回三格 sp 数组或 null（走自然随机）
export function rigShop(M, rng, pool) {
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
export function isUnlocked(M, S, key) { return !!M.unlocked[key] || unlockOk(M, S, key); }
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
export function dailyView(M) {
  const D = M.daily;
  return { date: D.date, firstWinPending: !D.firstWin, firstWinMul: META_TUNE.daily.firstWinMul, signDay: D.signDay, sign: SIGN_REWARDS, allDone: D.allDone,
    tasks: D.tasks.map(t => { const d = DAILY_TASKS.find(x => x.id === t.id) || {}; return { id: t.id, n: d.n, prog: Math.floor(t.prog), need: t.need, done: t.done, chest: d.chest }; }) };
}

// ───────────────────────── 成就/称号面板 ─────────────────────────
export function achList(M) {
  return ACHIEVEMENTS.map(a => { const done = !!M.ach[a.id], mask = a.hidden && !done; return { id: a.id, tier: a.tier, done, hidden: a.hidden, n: mask ? '？？？' : a.n, d: mask ? '隐藏成就，做到才会揭晓' : a.d }; });
}
export const titleName = M => (TITLES.find(t => t.id === M.title) || TITLES[0]).n;
export function setTitle(M, id) { if (M.titles.includes(id)) { M.title = id; return true; } return false; }

// ───────────────────────── 事件入口 ─────────────────────────
function addTokens(M, out, delta, rate, rng) {
  if (!(delta > 0)) return; const st = M.stats, T = META_TUNE.xp;
  st.tokens += delta;
  const xp = (delta / 1000) * T.perKTok * (rate >= T.hotRate ? T.hotMul : 1);
  M.xpFrac = (M.xpFrac || 0) + xp; const w = Math.floor(M.xpFrac); if (w) { M.xpFrac -= w; M.xp += w; out.xp += w; }
  const [a, b] = META_TUNE.night, h = M.cur.hour; if (h >= a && h < b) st.nights++;
  qiChests(M, out, delta, rng);
}
export function metaEmit(M, type, p, rng, S) {
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
        addXp(X.win[kind] || 10); if (p.turns > 0 && p.turns <= 3) st.quick = (st.quick | 0) + 1;
      } else {
        st.losses++; const L = META_TUNE.lose, was = M.streak.n; let saved = false;
        if (was > 0) { if (p.streakSafe) { saved = true; if (M.streak.charms > 0) M.streak.charms--; } else M.streak.n = 0; }
        out.streak = { n: M.streak.n, mul: streakMul(M.streak.n), saved, lost: was > 0 && !saved ? was : 0 };
        M.shards++; let shardTxt = `魂片 ${M.shards}/${L.shardNeed}`;
        if (M.shards >= L.shardNeed) { M.shards = 0; give(M, out, [{ k: 'chest', tier: 'wood', why: '魂片集齐' }], rng); shardTxt = '魂片集齐，得木箱'; }
        M.pity.n = Math.min(pityThr(M) - 1, M.pity.n + L.pityStep);
        addXp(X.lose);
        out.notes.push(`败也有得：经验 +${X.lose}、${shardTxt}、距天机 ${pityLeft(M)}` + (saved ? '、护心符保住了连胜' : was >= 2 ? `（连胜 ${was} 断了，只失去加成）` : ''));
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
