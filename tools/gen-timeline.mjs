// node tools/gen-timeline.mjs —— 生成 src/timeline.js（名字写成字面量，timeline.js 本身不 import 任何文件），并核对每个锁住的东西恰好有一个节点解开。改道途就改这里再跑一次。
import { writeFileSync } from 'fs';
const W = new URL('../src/', import.meta.url).href;
const C = await import(W + 'core.js'), F = await import(W + 'foods.js'), K = await import(W + 'combos2.js'), T = await import(W + 'trip.js');
const name = (k, id) => k === 'species' ? C.SP[id].n : k === 'food' ? F.FOOD[id].n : k === 'combo' ? K.COMBO2[id].n : k === 'trip' ? T.LAND[id].n : ({ kalpa: '劫数' })[id];
const S = 'species', FD = 'food', CB = 'combo', TR = 'trip', FT = 'feature';
const DAOS = ['li', 'yan', 'bing', 'jin', 'mu', 'tu', 'lei', 'guang', 'an', 'xue', 'du', 'zhi', 'hun', 'nu', 'yu', 'zhou'];
const STARTERS = ['boar', 'tiger', 'fire', 'fireant', 'snowsilk', 'iron', 'yupi', 'thorn', 'stick', 'shengji', 'dung', 'stonecase', 'static', 'firefly', 'yueguang', 'ink', 'leech', 'hairy', 'cent', 'webspider', 'bone', 'twin', 'ant', 'aphid', 'inch', 'asahi',
  'mantis', 'queen', 'cicada', 'mole', 'gecko', 'scorp', 'drum', 'moth'];
const FREE_FOOD = ['meat', 'dew', 'scale', 'shuangye'];
// [id, 名, 怎么达成, need, after, [[k, id], …], 组]
const N = [
  // —— 入门 ——
  ['first_buy', '开张', '在蛊市买下第一只蛊', { buys: 1 }, null, [[S, 'jingzhe'], [FD, 'tea']], '入门'],
  ['first_trip', '初入秘境', '第一次渡劫（进秘境打完回来就算，输了也算）', { trips: 1 }, null, [[S, 'snowflea'], [S, 'will'], [FD, 'gutang']], '入门'],
  ['first_merge', '三蛊归一', '第一次把三只同种同转的蛊合成一只', { merges: 1 }, null, [[S, 'tick'], [S, 'bloodant']], '入门'],
  ['first_combo', '杀招初成', '第一次让一个杀招成形', { combos: 1 }, 'first_merge', [[S, 'jiuchong'], [FD, 'egg']], '入门'],
  ['feeder', '养蛊人', '喂食 5 次（各类食物都算）', { feeds: 5 }, null, [[FD, 'map']], '入门'],
  ['buyer10', '蛊市熟客', '买蛊 10 次', { buys: 10 }, 'first_buy', [[S, 'strider'], [FD, 'yuelan'], [FD, 'zhuanshi']], '入门'],
  // —— 境界 ——
  ['realm1', '一转蛊师', '渡劫成功一次（打赢本境界任一秘境最深处的首领）', { realm: 1 }, 'first_trip', [[S, 'wasp'], [S, 'spider'], [S, 'qingfu'], [S, 'bomb']], '境界'],
  ['realm2', '二转蛊师', '境界到二转', { realm: 2 }, 'realm1', [[S, 'qant'], [S, 'flea'], [S, 'bfly'], [S, 'sleep'], [FD, 'juqi']], '境界'],
  ['realm3', '三转蛊师', '境界到三转', { realm: 3 }, 'realm2', [[S, 'mirror'], [S, 'hive'], [S, 'fly'], [S, 'bury'], [FD, 'duji'], [FD, 'zhenshi']], '境界'],
  ['realm4', '四转蛊师', '境界到四转', { realm: 4 }, 'realm3', [[S, 'xiongli'], [S, 'magma'], [S, 'hail'], [S, 'cordy'], [FD, 'huanhun']], '境界'],
  ['realm5', '五转蛊师', '境界到五转', { realm: 5 }, 'realm4', [[S, 'thunder'], [S, 'tortoise'], [S, 'puppet'], [S, 'hairworm']], '境界'],
  // —— 渡劫 ——
  ['trips3', '三进三出', '渡劫 3 次', { trips: 3 }, 'first_trip', [[S, 'silk'], [S, 'mosq'], [FD, 'zhanjiu'], [FD, 'huxin']], '渡劫'],
  ['trips6', '常走秘境', '渡劫 6 次', { trips: 6 }, 'trips3', [[S, 'click'], [S, 'sheli'], [S, 'bat'], [FD, 'qiangxian'], [FD, 'zhuanggu']], '渡劫'],
  ['trips10', '十进秘境', '渡劫 10 次', { trips: 10 }, 'trips6', [[S, 'cloud'], [S, 'shine'], [S, 'amber'], [S, 'ring'], [FD, 'duwu'], [FD, 'siwei']], '渡劫'],
  ['trips15', '识途老蛊', '渡劫 15 次', { trips: 15 }, 'trips10', [[S, 'xueyue'], [S, 'widow'], [S, 'blink']], '渡劫'],
  ['trips20', '踏遍山河', '渡劫 20 次', { trips: 20 }, 'trips15', [[S, 'orchid'], [S, 'taisui'], [S, 'yue'], [S, 'jinchan']], '渡劫'],
  ['clears2', '再下一城', '通关秘境 2 次（打赢最深处的首领，哪个秘境、第几劫都算）', { clears: 2 }, 'realm1', [[S, 'stag'], [S, 'glut'], [S, 'toad']], '渡劫'],
  ['clears4', '连破四关', '通关秘境 4 次', { clears: 4 }, 'clears2', [[S, 'flint'], [S, 'coldcicada'], [S, 'baiyu'], [FD, 'yinhun'], [FD, 'jinggu']], '渡劫'],
  ['clears6', '六关在握', '通关秘境 6 次', { clears: 6 }, 'clears4', [[S, 'moveshan'], [S, 'magstorm'], [S, 'eclipse'], [FD, 'baibao']], '渡劫'],
  ['clears8', '八方来朝', '通关秘境 8 次', { clears: 8 }, 'clears6', [[S, 'urn'], [S, 'hex'], [S, 'saw'], [S, 'dfly']], '渡劫'],
  ['clears10', '十关无阻', '通关秘境 10 次', { clears: 10 }, 'clears8', [[FD, 'xuming'], [FD, 'dinghun']], '渡劫'],
  // —— 合成与养蛊 ——
  ['merges5', '合蛊五次', '合成 5 次', { merges: 5 }, 'first_merge', [[S, 'rhino'], [S, 'gold'], [FD, 'helian']], '养蛊'],
  ['merges12', '炼蛊有成', '合成 12 次', { merges: 12 }, 'merges5', [[S, 'pyre'], [S, 'icesnail'], [S, 'lockarm'], [FD, 'huanwei']], '养蛊'],
  ['merges25', '炼蛊大家', '合成 25 次', { merges: 25 }, 'merges12', [[S, 'frost'], [S, 'lure'], [S, 'antlion'], [S, 'mayfly']], '养蛊'],
  ['merges40', '千炼成器', '合成 40 次', { merges: 40 }, 'merges25', [[S, 'glacier'], [S, 'fusang'], [S, 'solar']], '养蛊'],
  ['feeds12', '投喂有方', '喂食 12 次', { feeds: 12 }, 'feeder', [[FD, 'duzhen'], [FD, 'huorong'], [FD, 'guijia'], [FD, 'kaifeng']], '养蛊'],
  ['feeds20', '百味蛊厨', '喂食 20 次', { feeds: 20 }, 'feeds12', [[FD, 'bingpo'], [FD, 'yeming'], [FD, 'xuelian'], [FD, 'lingxi']], '养蛊'],
  ['feeds30', '食谱齐全', '喂食 30 次', { feeds: 30 }, 'feeds20', [[FD, 'taoya'], [FD, 'shanjiao'], [FD, 'jifeng'], [FD, 'chuanxin']], '养蛊'],
  ['buys30', '常客', '买蛊 30 次', { buys: 30 }, 'buyer10', [[S, 'cricket'], [S, 'locust'], [S, 'char']], '养蛊'],
  ['buys60', '蛊市贵客', '买蛊 60 次', { buys: 60 }, 'buys30', [[FD, 'huotan'], [FD, 'lingzhi'], [FD, 'leizao'], [FD, 'xuejing']], '养蛊'],
  // —— 杀招 ——
  ['combos3', '三招在手', '让 3 种不同的杀招成形过', { combos: 3 }, 'first_combo', [[S, 'vine'], [S, 'earthworm'], [FD, 'yingu']], '杀招'],
  ['combos6', '推演进阶', '让 6 种不同的杀招成形过', { combos: 6 }, 'combos3', [[S, 'diting'], [S, 'hourglass'], [CB, 'sanzhu2']], '杀招'],
  ['combos10', '十招融会', '让 10 种不同的杀招成形过', { combos: 10 }, 'combos6', [[CB, 'jinjia2'], [CB, 'pojian2'], [FD, 'zhujiu']], '杀招'],
  ['combos15', '招中有招', '让 15 种不同的杀招成形过', { combos: 15 }, 'combos10', [[CB, 'leigu2']], '杀招'],
  ['combos20', '万法归宗', '让 20 种不同的杀招成形过', { combos: 20 }, 'combos15', [[S, 'styx'], [S, 'boneflute'], [S, 'instant'], [CB, 'bingfeng2']], '杀招'],
  // —— 劫数：通关一个秘境开它的劫一，劫 N 通关开劫 N+1（见 KALPA） ——
  ['kalpa_open', '渡劫之后', '通关任意一个秘境，打开劫数', { clears: 1 }, null, [[FT, 'kalpa']], '劫数'],
  ['kalpa1', '初历一劫', '通关任意秘境的劫一', { kalpa: 1 }, 'kalpa_open', [[FD, 'jingleifu'], [FD, 'fengxingfu']], '劫数'],
  ['kalpa3', '三劫不死', '通关任意秘境的劫三', { kalpa: 3 }, 'kalpa1', [[S, 'nirvana'], [CB, 'suanwu2'], [FD, 'duanhun']], '劫数'],
  ['kalpa5', '五劫加身', '通关任意秘境的劫五', { kalpa: 5 }, 'kalpa3', [[S, 'guangyin'], [FD, 'guangyinxiang'], [FD, 'houtufu']], '劫数'],
  ['kalpa7', '七劫过尽', '通关任意秘境的劫七', { kalpa: 7 }, 'kalpa5', [[S, 'fate']], '劫数'],
  ['kalpa10', '十劫圆满', '通关任意秘境的劫十', { kalpa: 10 }, 'kalpa7', [[S, 'jiuxiao'], [CB, 'zhichi2']], '劫数'],
  // —— 挑战：通关时按出场阵容判（见 clearEvents），解锁新蛊和新杀招 ——
  ['ch_r1q7', '一转亦能', '只用一转蛊，通关额度 7 及以上的秘境', { r1q: 7 }, 'realm1', [[S, 'qingtian']], '挑战'],
  ['ch_r2q10', '低转为本', '只用一转、二转蛊，通关额度 10 及以上的秘境', { r2q: 10 }, 'realm2', [[CB, 'baiyi2'], [FD, 'shengzhuan']], '挑战'],
  ['ch_no5q14', '不仗高转', '不带五转和仙蛊，通关额度 14 及以上的秘境', { no5q: 14 }, 'realm3', [[S, 'dingxian'], [CB, 'yiri2']], '挑战'],
  ['ch_few3', '三蛊破阵', '出场不超过 3 只，通关额度 10 及以上的秘境', { few3q: 10 }, 'realm2', [[S, 'chiba']], '挑战'],
  ['ch_mono', '一道到底', '出场的蛊全属同一道，通关额度 10 及以上的秘境', { monoq: 10 }, 'realm2', [[TR, 'maigu'], [CB, 'wudu2']], '挑战'],
  ['ch_flawless', '全身而退', '一只蛊都没倒下，通关额度 14 及以上的秘境', { flawq: 14 }, 'realm3', [[CB, 'richu2']], '挑战'],
  ['ch_nocombo', '不靠杀招', '一个杀招都没成形，通关额度 10 及以上的秘境', { nocomboq: 10 }, 'realm2', [[CB, 'xuanwu2']], '挑战'],
  ['ch_daos4', '四道皆通', '用 4 个不同的道当主力各通关一次（主力 = 出场只数最多的道，并列都算）', { daos: 4 }, 'clears2', [[CB, 'jiutian2'], [TR, 'tianting']], '挑战'],
  ['ch_daos16', '十六道归一', '十六个道都当过一次主力通关', Object.fromEntries(DAOS.map(d => ['d_' + d, 1])), 'ch_daos4', [[S, 'zhihui']], '挑战'],
];
// 核对：锁住的东西恰好有一个节点解开
const opens = {}; N.forEach(a => a[5].forEach(([k, id]) => { const key = k + ':' + id; if (opens[key]) throw new Error('重复解锁 ' + key); opens[key] = a[0]; if (!name(k, id)) throw new Error('不存在 ' + key); }));
const lockedSp = C.SPECIES.map(s => s.id).filter(id => !STARTERS.includes(id));
const lockedFd = F.FOODS.map(f => f.id).filter(id => !FREE_FOOD.includes(id));
const lockedCb = K.COMBOS2.filter(c => c.from).map(c => c.id);
const lockedTr = ['maigu', 'tianting'], lockedFt = ['kalpa'];
const miss = [...lockedSp.map(x => 'species:' + x), ...lockedFd.map(x => 'food:' + x), ...lockedCb.map(x => 'combo:' + x), ...lockedTr.map(x => 'trip:' + x), ...lockedFt.map(x => 'feature:' + x)].filter(k => !opens[k]);
const extra = Object.keys(opens).filter(k => { const [kk, id] = k.split(':'); return !({ species: lockedSp, food: lockedFd, combo: lockedCb, trip: lockedTr, feature: lockedFt })[kk].includes(id); });
if (miss.length || extra.length) { console.log('缺', miss, '多', extra); process.exit(1); }
const q = s => `'${s}'`, obj = o => '{ ' + Object.entries(o).map(([k, v]) => `${k}: ${v}`).join(', ') + ' }';
const lines = N.map(([id, n, d, need, after, un, g]) => `  { id: ${q(id)}, n: ${q(n)}, g: ${q(g)}, d: ${q(d)}, need: ${obj(need)},${after ? ` after: ${q(after)},` : ''} unlock: [${un.map(([k, x]) => `{ k: ${q(k)}, id: ${q(x)}, n: ${q(name(k, x))} }`).join(', ')}] },`);
const wrap = (arr, per = 12) => { const out = []; for (let i = 0; i < arr.length; i += per) out.push('    ' + arr.slice(i, i + per).map(q).join(', ') + ','); return out.join('\n'); };
const src = `// 蛊码 GuCode · 成就道途（第三版：${N.length} 个节点，入门 / 境界 / 渡劫 / 养蛊 / 杀招 / 劫数 / 挑战七组）。纯数据 + 两个纯函数，不 import 任何文件。由 tools/gen-timeline.mjs 生成，改道途改那边再跑一次。
// 格式：TIMELINE[i] = { id, n 名, g 分组, d 怎么达成（一句话）, need { 事件计数名: 次数 }, after 前置节点 id（可无）, unlock [{ k, id, n }] 解锁什么 }
// 成就本身不给数值，只解锁东西（design 第 4 节、2.7 节）。
//
// 事件计数名（metaEmit 的 k）：
//   原有：trips 渡劫次数（进秘境一趟，打完回来就算）、realm 境界（set 取最大）、merges 合成次数、combos 杀招成形过的种数、buys 买蛊次数、feeds 喂食次数
//   clears 秘境通关次数：每通关一次都 +1（哪个秘境、第几劫都算，不只渡劫那一次）——请改用下面的 clearEvents，别只在渡劫时加
//   以下都在通关时由 clearEvents 算出来（set 取最大，值 = 这次通关的秘境额度）：
//     r1q 出场全是一转 · r2q 出场全是一转二转 · no5q 没有五转和仙蛊 · few3q 出场不超过 3 只 · monoq 出场全属同一道
//     flawq 一只都没倒下 · nocomboq 一个杀招都没成形
//   d_<道 id>（+1）这次通关的主力道（出场只数最多的道，并列都算）；daos（set）当过主力通关的道一共几个
//   kalpa（set）通关过的最高劫数（任意秘境）
// unlock.k：'species' 新蛊进蛊市（仙蛊 = 仙茧里才可能开出它）| 'food' 新食物进蛊市 | 'combo' 杀招能成形 | 'trip' 新秘境 | 'feature' 新玩法（kalpa = 劫数）
//   锁住的杀招在蛊典里照样能看到配方线索，只是凑齐了也不成形，界面写「道途解锁」。
export const TIMELINE = [
${lines.join('\n')}
];
// 一开始就锁着、要靠道途解锁的东西（不在这里的默认可用）。开局能买的蛊 ${STARTERS.length} 种：
//   ${STARTERS.join(' ')}
export const LOCKED = {
  species: [
${wrap(lockedSp)}
  ],
  food: [${lockedFd.map(q).join(', ')}],
  combo: [${lockedCb.map(q).join(', ')}],
  trip: [${lockedTr.map(q).join(', ')}],
  feature: [${lockedFt.map(q).join(', ')}],
};
export const STARTERS = [${STARTERS.map(q).join(', ')}];

// 劫数（design 2.7）：通关一个秘境开它的劫一；劫 N 通关开劫 N+1，最高劫十。要先点亮「渡劫之后」解锁 kalpa 玩法。
// 每个秘境打到第几劫由秘境一侧记在存档里（best = 这个秘境通关过的最高劫，普通难度通关记 0，没通关过记 -1）。
export const KALPA = { max: 10, feature: 'kalpa' };
export const kalpaOpen = best => (best == null || best < 0 ? 0 : Math.min(KALPA.max, (best | 0) + 1));   // 这个秘境现在最高能选第几劫（0 = 只有普通难度）

// 秘境通关时要发的道途事件。info = { quota 秘境额度, ranks [出场蛊转数，仙蛊记 6], daos [出场蛊的道], fallen 这一趟倒下几只（救回的也算）,
//   combos 这一趟成形过的杀招数, kalpa 这次打的第几劫（普通 0）, cnt 道途现有计数 M.cnt }
// 返回 [[计数名, 数, set], …]，按顺序 metaEmit(M, k, n, { set }) 即可（召唤物不算出场蛊）。
export function clearEvents(info = {}) {
  const q = info.quota | 0, rk = info.ranks || [], ds = info.daos || [], cnt = info.cnt || {}, ev = [['clears', 1, false]];
  if (rk.length) {
    if (rk.every(r => r <= 1)) ev.push(['r1q', q, true]);
    if (rk.every(r => r <= 2)) ev.push(['r2q', q, true]);
    if (rk.every(r => r < 5)) ev.push(['no5q', q, true]);
    if (rk.length <= 3) ev.push(['few3q', q, true]);
  }
  if (ds.length && ds.every(d => d === ds[0])) ev.push(['monoq', q, true]);
  if (!(info.fallen > 0)) ev.push(['flawq', q, true]);
  if (!(info.combos > 0)) ev.push(['nocomboq', q, true]);
  const by = {}; ds.forEach(d => { by[d] = (by[d] || 0) + 1; }); const top = Math.max(0, ...Object.values(by)), main = Object.keys(by).filter(d => by[d] === top);
  main.forEach(d => ev.push(['d_' + d, 1, false]));
  const had = new Set(Object.keys(cnt).filter(k => /^d_/.test(k) && cnt[k] > 0)); main.forEach(d => had.add('d_' + d));
  ev.push(['daos', had.size, true]);
  if (info.kalpa > 0) ev.push(['kalpa', info.kalpa | 0, true]);
  return ev;
}
`;
writeFileSync(new URL('timeline.js', W), src);
console.log('节点', N.length, '锁蛊', lockedSp.length, '锁食物', lockedFd.length, '锁杀招', lockedCb.length);
