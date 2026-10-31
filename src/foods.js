// 蛊码 GuCode · 食物（占位数据：三类各两个，内容专家交付后整份替换）。纯数据，不 import 任何文件。
// 格式：FOODS[i] = { id, n 名, kind, dao 所属的道（蛊市按主道加权）, cost 元石, d 一句话（写清加什么、给谁、多久） , ...效果字段 }
//   kind 'stat'：买下立刻生效，永久加攻血。to = 'one'（玩家选一只）| 'rand2'（随机两只）| 'all'（空窍全体）；atk、hp = 加多少
//   kind 'gear'：挂在一只蛊身上，每只最多 1 个，换新的旧的就没了；效果在战斗里生效（battle.js 的食物挂件）
//              gear = 'spawn'（倒下化出小蛊：本蛊攻血 pct%）| 'ward'（每次受伤减 n 点）| 'first'（开战攻 +pct%）
//   kind 'trip'：只在下一次出征里有效，出征开始时生效、回洞府清掉。trip = 'heal'（每场开打前回 pct% 血）| 'stone'（战利品元石 +pct%）
// 顺序只能往后加（坐标码按下标记食物挂件）。
export const FOODS = [
  { id: 'meat', n: '血肉团', kind: 'stat', dao: 'li', cost: 3, to: 'one', atk: 2, hp: 2, d: '喂给一只蛊：攻 +2、血 +2，永久' },
  { id: 'dew', n: '晨露丸', kind: 'stat', dao: 'xue', cost: 3, to: 'rand2', atk: 1, hp: 2, d: '空窍里随机两只：攻 +1、血 +2，永久' },
  { id: 'egg', n: '孵蛊卵', kind: 'gear', dao: 'nu', cost: 4, gear: 'spawn', pct: 40, d: '挂在一只蛊上：它倒下时原地化出一只小蛊（本蛊攻血的 40%）' },
  { id: 'scale', n: '鳞甲片', kind: 'gear', dao: 'jin', cost: 4, gear: 'ward', n2: 1, d: '挂在一只蛊上：每次受到伤害少 1 点' },
  { id: 'tea', n: '回春茶', kind: 'trip', dao: 'xue', cost: 3, trip: 'heal', pct: 20, d: '下一次出征：每场开打前全队回 20% 血' },
  { id: 'map', n: '寻宝图', kind: 'trip', dao: 'zhi', cost: 3, trip: 'stone', pct: 30, d: '下一次出征：战利品里的元石 +30%' },
];
export const FOOD = Object.fromEntries(FOODS.map(f => [f.id, f]));
export const FOOD_KIND = { stat: '直接加攻血', gear: '挂件', trip: '出征用' };
