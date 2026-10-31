// 蛊码 GuCode · 洞府与秘境之间的接口（纯登记表，不 import 任何文件）。
// 秘境一侧（trip.js / trip-ui.js）启动时往 TRIP 上挂自己的函数；洞府（ui.js）只通过这里调用，两边互不 import。
//
// 秘境挂上来的：
//   TRIP.start(api)        玩家在洞府确认渡劫后调用一次。秘境自己往 S.trip 写状态，画在 <section id="trip"> 里（api.el）。
//   TRIP.feed(S, tok)      渡劫中每次有 token 进账调用（洞府攒着的元气 S.bank 渡劫时由秘境自己先用掉）。
//   TRIP.render(api)       洞府重绘时、读档后渡劫仍未结束时调用，让秘境把界面画回来。
//   TRIP.active(S)         可选：渡劫中返回 true（默认按 !!S.trip 判断）。
//   TRIP.lands             秘境列表 [{ id, n, realm, quota, cap, dao, d, bk, boss: [{ sp, rank, pos, boss }] }]：洞府的「选秘境」列它
//   TRIP.foeFor(seed, quota, { dao, kind: 'room'|'elite'|'boss'|'ghost', depth }) → 敌阵：斗幽灵、战帖按额度分场时洞府也调它
// 渡劫前洞府已经查过：上阵转数总和 ≤ 秘境额度、每只 ≤ 驱使上限和秘境的 cap；然后设 S.trip = { at, land: id } 再调 TRIP.start。
// 洞府提供的 api（TRIP.api，启动时就挂好）：
//   api.S()                当前存档对象（直接读写；改完调 api.save()）
//   api.save()             落盘（节流）
//   api.el                 <section id="trip"> 元素
//   api.playBattle(foeTeam, opts) → Promise<{ res, A, B }>：复用洞府的战斗回放；opts = { title, team（默认 S.team）, seed, foeName, oa }
//                          oa 并进 battle() 的第 4 个参数（SOTA 由洞府补上；血量延续读每只蛊的 hpNow）
//   api.onTripEnd(result)  秘境结束（退出秘境、渡劫成功或渡劫失败）时调用一次。
//                          result = { dead: [uid], survivors: [uid], loot: { foods: [id], gu: [{ sp, rank, xing? }] }, cleared, wiped }
//                          洞府负责：删掉倒下的蛊、发战利品（全灭时秘境应传空 loot）、cleared 且秘境属于当前境界时渡劫（境界 +1，全屏）、全员回满、
//                          清掉 S.trip 和只在这次渡劫有效的食物（S.tripFood）、罗盘重转（蛊市在玩家转完罗盘时换新货）。
//   api.big(kind, title, lines)  全屏时刻（只给 design.md 第 5 节那三种用：'trib' 渡劫成功、'ach' 成就解锁、'combo' 杀招第一次成形）
//   api.note(text)         在原地战报加一行（其余反馈都用这个）
//   api.float(uid, text, kind)   在某只蛊身上跳一个字
export const TRIP = { start: null, feed: null, render: null, active: null, api: null };
