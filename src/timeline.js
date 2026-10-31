// 蛊码 GuCode · 成就道途（占位数据：5 条，内容专家交付后整份替换）。纯数据，不 import 任何文件。
// 格式：TIMELINE[i] = { id, n 名, d 怎么达成（一句话）, need { 事件计数名: 次数 }, after 前置成就 id（可无）, unlock [{ k, id, n }] 解锁什么 }
//   事件计数名：trips 出征次数、clears 秘境通关、realm 境界、merges 合成次数、combos 杀招成形种数、buys 买蛊次数、feeds 喂食次数
//   unlock.k：'species' 新蛊进蛊市 | 'food' 新食物进蛊市 | 'trip' 新秘境 | 'feature' 新玩法
// 成就本身不给数值，只解锁东西。
export const TIMELINE = [
  { id: 'first_trip', n: '初入秘境', d: '第一次出征', need: { trips: 1 }, unlock: [{ k: 'food', id: 'tea', n: '回春茶' }] },
  { id: 'first_merge', n: '三蛊归一', d: '第一次合成', need: { merges: 1 }, unlock: [{ k: 'species', id: 'cicada', n: '金蝉蛊' }] },
  { id: 'first_combo', n: '杀招初成', d: '第一次让杀招成形', need: { combos: 1 }, after: 'first_merge', unlock: [{ k: 'food', id: 'egg', n: '孵蛊卵' }] },
  { id: 'feeder', n: '养蛊人', d: '喂食 5 次', need: { feeds: 5 }, unlock: [{ k: 'food', id: 'map', n: '寻宝图' }] },
  { id: 'realm1', n: '一转蛊师', d: '渡劫成功一次', need: { realm: 1 }, after: 'first_trip', unlock: [{ k: 'species', id: 'drum', n: '战鼓蛊' }] },
];
// 一开始就锁着、要靠道途解锁的东西（不在这里的物种、食物默认可用）
export const LOCKED = { species: ['cicada', 'drum'], food: ['tea', 'egg', 'map'], trip: [], feature: [] };
