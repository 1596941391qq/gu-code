// 蛊码 GuCode · 食物（第三版，26 种：加攻血 8、挂件 10、出征用 8）。纯数据，不 import 任何文件。
// 格式：FOODS[i] = { id, n 名, kind, dao 所属的道（蛊市按罗盘选中的道加权）, cost 价格档（× core.PRICE.food 才是元气）, d 一句话（写清加什么、给谁、多久）, ...效果字段 }
//   kind 'stat'：买下立刻生效，永久加攻血（每只最多吃 core.ATE_MAX 次）。to = 'one'（玩家选一只）| 'rand2'（随机两只）| 'all'（空窍全体）；atk、hp = 加多少点（数值已按 design 2.8 放大十倍，和 core.STAT_SCALE 一致）
//   kind 'gear'：挂在一只蛊身上，每只最多 1 个，换新的旧的就没了；战斗里生效。
//              eff = 声明式效果（battle-spec 第 4、6 节），施放者是挂着它的那只蛊，数值不随转数涨。
//              旧写法 gear = 'spawn'（倒下化出蛊蛹：本蛊攻血 pct%）| 'ward'（受到的伤害 -pct%）| 'first'（开战攻 +pct%）引擎照旧认。
//              八种挂件正好各给一种通用效果（召、护、毒、灼、寒、标记、吞、击退），任何道的蛊挂上都能接别人的配合。
//   kind 'trip'：只在下一次出征里有效，出征开始时生效、回洞府清掉。
//              trip = 'heal'：每场开打前全队回 pct% 血（秘境已支持）
//              trip = 'road'：这趟出征房间路程 -pct%（新，要秘境一侧接：路程乘 1 − pct/100）
//              trip = 'revive'：这趟出征第一只倒下的蛊，下一场开打前以 pct% 血站起来，只一次（新，要秘境一侧接）
//              trip = 'eff'：这趟出征每场战斗，每只出场蛊都加上 eff（新，要秘境把 eff 传给引擎，建议 battle opts 里按方带一份额外效果）
//              新类型没接好之前，可以先用 timeline.js 的 LOCKED.food 锁住不上架（lockedTrip 列出来了）。
// 顺序只能往后加（坐标码按下标记食物挂件）。前 6 个是骨架时的占位，id 和位置不动，只改了内容。
// canon: true = 原著里有的东西（描述是蛊码自己写的）。导出 FOODS / FOOD（core、秘境在用），FOOD_ITEMS 是同一份的别名。
const F = (id, n, kind, dao, cost, d, o = {}) => ({ id, n, kind, dao, cost, d, ...o });
export const FOODS = [
  // —— 骨架时的 6 个（位置不动）——
  F('meat', '血肉团', 'stat', 'li', 3, '喂给一只蛊：攻 +20、血 +20，永久', { to: 'one', atk: 20, hp: 20 }),
  F('dew', '晨露丸', 'stat', 'xue', 3, '空窍里随机两只：攻 +10、血 +20，永久', { to: 'rand2', atk: 10, hp: 20 }),
  F('egg', '孵蛊卵', 'gear', 'nu', 4, '挂在一只蛊上：它倒下时原地化出一只蛊蛹（本蛊攻血的 40%）', { gear: 'spawn', pct: 40 }),
  F('scale', '鳞甲片', 'gear', 'jin', 4, '挂在一只蛊上：受到的伤害 -10%', { gear: 'ward', pct: 10 }),
  F('tea', '回春茶', 'trip', 'xue', 3, '下一次出征：每场开打前全队回 20% 血', { trip: 'heal', pct: 20 }),
  F('map', '寻路图', 'trip', 'zhi', 3, '下一次出征：房间路程 -15%，少花元气', { trip: 'road', pct: 15 }),
  // —— 加攻血 ——
  F('yuelan', '月兰花瓣', 'stat', 'guang', 3, '喂给一只蛊：攻 +30，永久', { to: 'one', atk: 30, hp: 0, canon: true }),
  F('zhujiu', '青竹酒', 'stat', 'zhi', 5, '空窍全体各喝一口：攻 +10、血 +10，永久', { to: 'all', atk: 10, hp: 10 }),
  F('huotan', '火炭心', 'stat', 'yan', 4, '空窍里随机两只：攻 +20、血 +10，永久', { to: 'rand2', atk: 20, hp: 10 }),
  F('shuangye', '霜叶', 'stat', 'bing', 2, '喂给一只蛊：攻 +10、血 +20，永久', { to: 'one', atk: 10, hp: 20 }),
  F('lingzhi', '灵芝片', 'stat', 'mu', 5, '空窍全体：血 +20，永久', { to: 'all', atk: 0, hp: 20 }),
  F('leizao', '雷击枣', 'stat', 'lei', 4, '喂给一只蛊：攻 +20、血 +30，永久', { to: 'one', atk: 20, hp: 30 }),
  // —— 挂件：各给一种通用效果 ——
  F('duzhen', '毒针囊', 'gear', 'du', 4, '挂在一只蛊上：它的普攻让目标中毒（攻击 10%，可叠）',
    { eff: [{ when: 'attack', op: 'st', tg: 'tg', k: 'psn', atk: 0.1 }] }),
  F('huorong', '火绒草', 'gear', 'yan', 4, '挂在一只蛊上：它的普攻让目标灼烧 2 轮（攻击 12%）',
    { eff: [{ when: 'attack', op: 'st', tg: 'tg', k: 'burn', n: 2, atk: 0.12 }] }),
  F('bingpo', '冰魄珠', 'gear', 'bing', 4, '挂在一只蛊上：它的普攻 35% 机会让目标寒 1 层',
    { eff: [{ when: 'attack', op: 'st', tg: 'tg', k: 'chill', n: 1, chance: 0.35 }] }),
  F('yeming', '夜明砂', 'gear', 'an', 4, '挂在一只蛊上：开战给敌方攻最高的蛊打上标记 2 轮',
    { eff: [{ when: 'start', op: 'st', tg: 'foe.top', k: 'mark', n: 3 }] }),
  F('taoya', '饕餮牙', 'gear', 'li', 5, '挂在一只蛊上：它普攻后，目标血量不过 15% 或是召唤物，就整只吞下，得到它四分之一攻血',
    { eff: [{ when: 'attack', op: 'eat', tg: 'tg', v: 0.15, gain: 0.25 }] }),
  F('shanjiao', '撞山角', 'gear', 'tu', 4, '挂在一只蛊上：它的普攻 25% 机会把目标击退一格（撞上后面的蛊，两只都受伤）',
    { eff: [{ when: 'attack', op: 'knock', tg: 'tg', v: 1, bump: 0.3, chance: 0.25 }] }),
  F('xuelian', '血莲子', 'gear', 'xue', 4, '挂在一只蛊上：它普攻后回复这一下的 15%',
    { eff: [{ when: 'attack', op: 'heal', tg: 'self', n: 0.15 }] }),
  F('jifeng', '疾风翎', 'gear', 'yu', 3, '挂在一只蛊上：开战行动条提前 40%，抢先出手',
    { eff: [{ when: 'start', op: 'adv', tg: 'self', v: 0.4 }] }),
  // —— 出征用 ——
  F('xuming', '续命汤', 'trip', 'mu', 5, '下一次出征：每场开打前全队回 35% 血', { trip: 'heal', pct: 35 }),
  F('dinghun', '定魂香', 'trip', 'hun', 5, '下一次出征：第一只倒下的蛊，下一场开打前以 30% 血站起来（只一次）', { trip: 'revive', pct: 30 }),
  F('jingleifu', '惊雷符', 'trip', 'lei', 3, '下一次出征：每场开战全队蛊力 +15',
    { trip: 'eff', eff: [{ when: 'start', op: 'gp', tg: 'self', v: 15 }] }),
  F('guangyinxiang', '光阴香', 'trip', 'zhou', 4, '下一次出征：每场第 4 轮起全队攻 +10%',
    { trip: 'eff', eff: [{ when: 'round', op: 'buff', tg: 'self', atk: 0.1, if: 'round>=4', max: 1 }] }),
  F('houtufu', '厚土符', 'trip', 'tu', 4, '下一次出征：每场开战全队得到最大血量 8% 的护体',
    { trip: 'eff', eff: [{ when: 'start', op: 'shield', tg: 'self', mx: 0.08 }] }),
  F('fengxingfu', '风行符', 'trip', 'yu', 3, '下一次出征：每场开战全队行动条提前 15%',
    { trip: 'eff', eff: [{ when: 'start', op: 'adv', tg: 'self', v: 0.15 }] }),
];
export const FOOD_ITEMS = FOODS;
export const FOOD = Object.fromEntries(FOODS.map(f => [f.id, f]));
export const FOOD_KIND = { stat: '直接加攻血', gear: '挂件', trip: '出征用' };
// 出征食物里秘境还没接的类型（接好前可以锁住不上架）
export const TRIP_NEW = ['road', 'revive', 'eff'];
export const lockedTrip = () => FOODS.filter(f => f.kind === 'trip' && TRIP_NEW.includes(f.trip)).map(f => f.id);
