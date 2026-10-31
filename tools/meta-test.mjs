// node tools/meta-test.mjs —— 道途（成就时间线）的单元测试，口径见 docs/design.md 第 4 节。失败 exit(1)
// 查：计数与「取最大值」、前置节点、解锁名单、面板状态、旧存档不迁移，以及数据本身（解锁的东西都存在、锁住的东西都有地方解开）。
import { SP } from '../src/core.js';
import { FOOD } from '../src/foods.js';
import { TIMELINE, LOCKED } from '../src/timeline.js';
import { TL, metaInit, metaMigrate, metaEmit, isUnlocked, timelineView } from '../src/meta.js';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };

// 1. 数据：id 不重复、前置存在、解锁的物种/食物真的存在、LOCKED 里每一项都能被某个节点解开
{
  const ids = TIMELINE.map(a => a.id);
  ok(new Set(ids).size === ids.length, `道途节点 id 不重复（${ids.length} 个）`);
  ok(TIMELINE.every(a => !a.after || TL[a.after]), '前置节点都存在');
  const bad = TIMELINE.flatMap(a => (a.unlock || []).filter(u => (u.k === 'species' && !SP[u.id]) || (u.k === 'food' && !FOOD[u.id])).map(u => `${a.id}→${u.id}`));
  ok(!bad.length, '解锁的蛊和食物都存在' + (bad.length ? '：' + bad.join('、') : ''));
  const opens = new Set(TIMELINE.flatMap(a => (a.unlock || []).map(u => u.k + ':' + u.id)));
  const stuck = Object.entries(LOCKED).flatMap(([k, l]) => l.filter(id => !opens.has(k + ':' + id)).map(id => k + ':' + id));
  ok(!stuck.length, '锁住的东西都有节点能解开' + (stuck.length ? '：' + stuck.join('、') : ''));
  ok(TIMELINE.every(a => Object.keys(a.need || {}).length), '每个节点都写了达成条件');
}

// 2. 计数：累加、set 取最大值、刚达成的节点只返回一次
{
  const M = metaInit(), first = TIMELINE.find(a => !a.after), [k, v] = Object.entries(first.need)[0];
  let got = []; for (let i = 0; i < v; i++) got = got.concat(metaEmit(M, k, 1));
  ok(got.some(a => a.id === first.id) && M.done.includes(first.id), `累加到 ${k}=${v} 点亮「${first.n}」`);
  ok(!metaEmit(M, k, 1).some(a => a.id === first.id), '已点亮的不会再返回');
  const M2 = metaInit(); metaEmit(M2, 'realm', 2, { set: true }); metaEmit(M2, 'realm', 1, { set: true });
  ok(M2.cnt.realm === 2, 'set 取最大值（境界不会倒退）');
}

// 3. 前置：前置没点亮时，条件够了也不点亮；前置一亮，后面的连锁点亮
{
  const a = TIMELINE.find(x => x.after);
  if (a) {
    const M = metaInit(); Object.entries(a.need).forEach(([k, v]) => metaEmit(M, k, v, { set: true }));
    ok(!M.done.includes(a.id) || M.done.includes(a.after), `「${a.n}」要等前置「${TL[a.after].n}」`);
    const pre = TL[a.after]; let got = [];
    Object.entries(pre.need).forEach(([k, v]) => { got = got.concat(metaEmit(M, k, v, { set: true })); });
    ok(M.done.includes(a.after) && M.done.includes(a.id), '前置点亮后连锁点亮');
  } else ok(true, '没有带前置的节点');
}

// 4. 解锁：LOCKED 里的东西在点亮对应节点前不可用，点亮后可用；不在名单里的默认可用
{
  const M = metaInit(), node = TIMELINE.find(a => (a.unlock || []).some(u => (LOCKED[u.k] || []).includes(u.id)));
  if (node) {
    const u = node.unlock.find(x => (LOCKED[x.k] || []).includes(x.id));
    ok(!isUnlocked(M, u.id, u.k), `「${u.n}」一开始锁着`);
    M.done.push(node.id);
    ok(isUnlocked(M, u.id, u.k), `点亮「${node.n}」后「${u.n}」解锁`);
  }
  const free = Object.keys(SP).find(id => !(LOCKED.species || []).includes(id));
  ok(isUnlocked(metaInit(), free, 'species'), '不在名单里的蛊默认可用');
}

// 5. 面板状态与旧存档
{
  const M = metaInit(), v = timelineView(M);
  ok(v.length === TIMELINE.length && v.every(a => ['done', 'open', 'locked'].includes(a.state)), '面板每条都有 done / open / locked');
  ok(v.filter(a => a.after).every(a => a.state === 'locked'), '前置没点亮的显示为 locked');
  const old = metaMigrate({ v: 2, xp: 999, level: 7, chests: [1] });
  ok(old.v === 3 && !old.done.length && !('xp' in old), '旧版成就存档不迁移（v2 起重开）');
  ok(metaMigrate({ v: 3, cnt: { trips: 2 }, done: [], at: {} }).cnt.trips === 2, 'v3 存档原样读回');
}

console.log(fails ? `\n${fails} 项没过` : '\n全部通过');
process.exit(fails ? 1 : 0);
