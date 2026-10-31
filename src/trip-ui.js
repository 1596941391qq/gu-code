// 蛊码 GuCode · 秘境界面。只通过 hooks.js 的 TRIP 和洞府打交道（不 import ui.js）。逻辑全在 trip.js。
// 一屏只有一个主按钮；「退出秘境」一直在右上角但不是主按钮；精英和首领开打前先给看阵容并写明「输了全队永久死亡」。
// 规则「赢了救回，输了全死」：打赢的那一场倒下的救回、剩 1 血；打输就是渡劫失败，全队永久死亡，直接进结算，结算页停住，列出每只死去的蛊和告别词，点了才回洞府（api.onTripEnd）。
// 天象、劫数、手里的祝福一直写在顶上；首领机制在开打前写明。打赢首领 = 渡劫成功，先二选一拿首领掉落再结算。
import { TRIP } from './hooks.js';
import { SP, RANK, XING, fmtTok, NORMAL_SPECIES, daoOf } from './core.js';
import { synergyOf, battleProfile } from './battle.js';
import { guSVG } from './art.js';
import { VSC } from './tokens.js';
import { FOOD, FOODS } from './foods.js';
import { DAO } from './daos.js';
import { TRIP_CFG, ROOMS, EVENT, nextLanes, tripStart, tripMapOf, tripAlive, tripReach, roomAt, curRoom, needTok, tripPick, tripFeed, roomFoe, fieldTeam, tripFight, tripPreFight, acceptXing, tripEvent, tripCamp, wareTok, tripBuy, wareText, tripLeaveRoom, tripEnd, tripResult, epitaph, lootEmpty, fxText, evPay, tripSeed, LANDS, foeFor, tripLand,
  roadOf, campOf, preOf, tripBless, tripOffer, blessList, tripReward, tripMods, tripPreview, landReward } from './trip.js';
import { BLESS, blessLast, JIE, JIE_MAX, JIE_NAMES } from './trip-mods.js';

const tuUnit = () => (VSC ? 8000 : 200);   // 1 份路程 = 多少 token（插件 8000，网页模拟 200），和 TokenSource.unit 一致
const tuEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tuFood = id => (FOOD[id] ? FOOD[id].n : id);
const tuGuN = g => (g ? (RANK.names[g.rank] || '') + (SP[g.sp] ? SP[g.sp].n : g.sp) : '');
let tuBusy = false;   // 战斗回放中不接点击

// ───────────── 状态 ─────────────
const tuT = api => { const S = api.S(); return S && S.trip && S.trip.v ? S.trip : null; };
// 下一趟的种子：进秘境前洞府用它预览天象和首领（TRIP.preview），出征时用同一个
const tuNextSeed = S => tripSeed(S.seed, 'k' + (S.tripN | 0));
const tuBest = (S, id) => (S.kalpa && S.kalpa[id] != null ? S.kalpa[id] : -1);   // 这个秘境通关过的最高劫（普通难度通关 = 0，没通关过 = -1）
function tuInit(api) {
  const S = api.S(), at = (S.trip && S.trip.at) || Date.now();
  const land = (S.trip && S.trip.land) || S.realm, kalpa = (S.trip && S.trip.kalpa) | 0;   // 洞府选好的秘境 id 和第几劫
  const ok = typeof api.unlocked === 'function' ? api.unlocked : null;   // 道途：掉落只出解锁过的食物和蛊
  const t = tripStart(tuNextSeed(S), land, S.team, { trip: S.tripFood || [], kalpa,
    foods: ok ? FOODS.filter(f => ok(f.id, 'food')).map(f => f.id) : [], sp: ok ? NORMAL_SPECIES.filter(s => ok(s.id, 'species')).map(s => s.id) : null });
  S.tripN = (S.tripN | 0) + 1;
  S.trip = Object.assign({ at }, t, { ui: { msg: [], offers: [], ask: null } });
  api.save();
  return S.trip;
}
const tuUI = t => t.ui || (t.ui = { msg: [], offers: [], ask: null });

// ───────────── 画面 ─────────────
function tuDraw(api) {
  const box = api.el; if (!box) return;
  const S = api.S(); let t = tuT(api);
  if (!t && S.trip) t = tuInit(api);
  if (!t) { box.innerHTML = ''; return; }
  const ui = tuUI(t), by = Object.fromEntries(S.team.map(g => [g.uid, g]));
  let body, onMap = false;
  if (ui.offers.length) body = tuOffer(t, by, ui.offers[0]);
  else if (t.offer) body = tuBlessPick(t, t.offer.ids, 'offer');
  else if (t.reward) body = tuReward(t);
  else if (t.end) body = tuEnd(t, by, S);
  else if (ui.ask === 'flee') body = tuAsk(t);
  else if (t.room && !t.room.done) body = tuRoom(t, S);
  else { body = tuMapView(t, S); onMap = true; }
  const msg = ui.msg && ui.msg.length && !t.end ? `<p class="tu-msg">${ui.msg.map(tuEsc).join('<br>')}</p>` : '';
  box.innerHTML = `${tuHead(t)}${t.end || onMap ? '' : tuMods(t)}${t.end ? '' : tuSyn(api, t, S)}${tuTeam(t, by)}${msg}<div class="tu-body">${body}</div>${t.end ? '' : tuBag(t)}`;
  const sc = box.querySelector('.tu-scroll'), at = sc && sc.querySelector('.tu-cell.cur, .tu-cell.reach');   // 地图滚到当前位置
  if (sc && at) sc.scrollTop = Math.max(0, at.offsetTop - sc.clientHeight / 2);
}
function tuHead(t) {
  const N = tripMapOf(t).length, d = Math.min(t.d, N - 1);
  const flee = t.end || t.reward || t.offer || tuUI(t).ask ? '' : `<button class="tu-flee" data-trip="flee" title="带着战利品回洞府">退出秘境</button>`, L = tripLand(t);
  return `<div class="tu-head"><span class="lbl" title="${tuEsc(`${L.n}：额度 ${L.quota}，主道是${DAO[L.dao] ? DAO[L.dao].n : L.dao}，最深处是首领`)}">${tuEsc(L.n)}${t.kalpa ? ` <em class="tu-jie">${tuEsc(JIE_NAMES[t.kalpa])}</em>` : ''} <small>${t.end ? '回洞府' : `第 ${d + 1} / ${N} 层`}</small></span>${flee}</div>`;
}
// 房间里（不在地图上时）顶上一行：天象、劫数、手里的祝福和出征食物（悬停看全文）
function tuMods(t) {
  const m = tripMods(t), chip = (cls, k, n, d) => `<span class="tu-chip ${cls}" title="${tuEsc(d)}"><i>${k}</i>${tuEsc(n)}</span>`, out = [];
  if (m.sky) out.push(chip('sky', '天象', m.sky.n, m.sky.d));
  if (m.kalpa) out.push(chip('jie', '劫数', m.kalpaName, m.rules.map((r, i) => `${JIE_NAMES[i + 1]}：${r}`).join('\n')));
  blessList(t).forEach(b => out.push(chip('bless', '祝福', b.n, `${b.d}（${b.last}）`)));
  (t.eff || []).forEach(id => FOOD[id] && out.push(chip('food', '食', FOOD[id].n, FOOD[id].d)));
  return out.length ? `<div class="tu-mods">${out.join('')}</div>` : '';
}
// 队伍上方一行：当前生效的道共鸣和杀招（用洞府的同一个组件 api.synLine；洞府还没给时只写一行字）
function tuSyn(api, t, S) {
  const team = fieldTeam(t, S.team); if (!team.length) return '';
  if (typeof api.synLine === 'function') return `<div class="tu-syn">${api.synLine(team)}</div>`;
  let line = ''; try { line = synergyOf(team).line; } catch (e) { line = ''; }
  return `<div class="tu-syn"><span class="lbl">共鸣</span><span>${tuEsc(line || '没有生效的共鸣和杀招')}</span></div>`;
}
// 队伍：每只写攻、速、血条和数字，道字、蛊性、挂件，身上的状态（残血、救回、定魂）
const tuSpd = g => { try { return g.spd || (battleProfile(g.sp) || {}).spd || 100; } catch (e) { return g.spd || 100; } };
function tuTeam(t, by) {
  return `<div class="tu-team">${t.order.map(u => {
    const g = by[u], f = t.fallen.find(x => x.uid === u), sp = g ? g.sp : f && f.sp, rank = g ? g.rank : f && f.rank; if (!sp) return '';
    const dead = t.dead.includes(u), hp = t.hp[u] || 0, mx = t.mx[u] || 1, pc = Math.max(0, Math.min(100, Math.round(hp / mx * 100)));
    const xg = g && g.xing && XING[g.xing], gear = g && g.food && FOOD[g.food], dao = DAO[daoOf(sp)];
    const tags = [xg ? `<em class="tu-tag xg" title="${tuEsc(`蛊性「${xg.n}」：${xg.d}`)}">${tuEsc(xg.n[0])}</em>` : '', gear ? `<em class="tu-tag gear" title="${tuEsc(`挂件「${gear.n}」：${gear.d}`)}">${tuEsc(gear.n[0])}</em>` : ''].join('');
    const st = dead ? '' : t.revived === u && hp > 1 ? '定魂' : (t.saved || []).includes(u) && hp <= Math.max(1, mx * 0.05) ? '救回' : pc <= 30 ? '残血' : '';
    return `<div class="tu-g${dead ? ' dead' : pc <= 30 ? ' low' : ''}"><span class="tu-art">${guSVG(sp, { rank })}</span><span class="tu-gi"><b>${dao ? `<i class="tu-dao" title="${tuEsc(dao.n)}">${tuEsc(dao.n[0])}</i>` : ''}${tuEsc(SP[sp] ? SP[sp].n : sp)}${tags}</b>${dead ? '<small>永久死亡</small>' : `<span class="tu-st"><i class="a">${g ? g.atk : ''}</i><i class="v">${g ? tuSpd(g) : ''}</i>${st ? `<em class="tu-state">${st}</em>` : ''}</span><span class="tu-hp"><i style="width:${pc}%"></i></span><small>${hp}/${mx}</small>`}</span></div>`;
  }).join('')}</div>`;
}
function tuBag(t) {
  const l = t.loot, items = [...l.gu.map(tuGuN), ...l.foods.map(tuFood)];
  return `<div class="tu-bag"><span class="lbl">战利品袋</span><span>${items.length ? items.map(tuEsc).join('、') : '还是空的'}</span><small>退出秘境或渡劫成功都全部带回；渡劫失败全部丢在秘境里。</small></div>`;
}
// ───────────── 整张地图（杀戮尖塔式）：从下往上 10 层，最顶上是首领；一层一行、三条路三列 ─────────────
// 当前位置描朱，能走的下一格高亮可点，走过的路变暗；正在走的那段路，朱线从起点往目标长（进度条）
const TU_H = 40, tuX = lane => [50, 150, 250][lane], tuPct = lane => ['16.667%', '50%', '83.333%'][lane];
function tuWalkPc(t) { const need = needTok(t, tuUnit()); return need ? Math.min(1, t.prog / need) : 0; }
function tuMapView(t, S) {
  const map = tripMapOf(t), N = map.length, H = TU_H, Ht = (N + 1) * H, reach = tripReach(t), walking = t.pick != null && !t.room, path = t.path || [];
  const y = d => (N - 1 - d) * H + H / 2;   // d = -1 是入口（最底下）
  const from = t.d === 0 ? [-1, 1] : [t.d - 1, path[t.d - 1] != null ? path[t.d - 1] : t.lane];   // 现在站的地方
  const lanesAt = d => (d < 0 ? [1] : map[d] ? map[d].rooms.map(r => r.lane) : []);
  const nexts = (d, l) => (d < 0 ? map[0].rooms.map(r => r.lane) : nextLanes(map, d, l));
  const lines = [];
  for (let d = -1; d < N - 1; d++) lanesAt(d).forEach(l => nexts(d, l).forEach(n => {
    const done = d + 1 < t.d && (d < 0 ? true : path[d] === l) && path[d + 1] === n;
    const isFrom = d === from[0] && l === from[1], open = isFrom && !walking && reach.includes(n), walk = isFrom && walking && n === t.pick;
    lines.push(`<line class="${done ? 'done' : open ? 'open' : walk ? 'base' : 'off'}" x1="${tuX(d < 0 ? 1 : l)}" y1="${y(d)}" x2="${tuX(n)}" y2="${y(d + 1)}"/>`);
    if (walk) { const p = tuWalkPc(t), x1 = tuX(d < 0 ? 1 : l), y1 = y(d), x2 = tuX(n), y2 = y(d + 1);
      lines.push(`<line id="tuWalkLn" class="walk" data-x="${x1},${y1},${x2},${y2}" x1="${x1}" y1="${y1}" x2="${x1 + (x2 - x1) * p}" y2="${y1 + (y2 - y1) * p}"/>`); }
  }));
  const m = tripMods(t), cells = [];
  for (let d = 0; d < N; d++) map[d].rooms.forEach(r => {
    const R = ROOMS[r.type], cost = r.cost * tuUnit() * (d === t.d ? t.short || 1 : 1) * roadOf(t);
    const past = d < t.d && path[d] === r.lane, skip = d < t.d && !past, cur = d === t.d && t.pick === r.lane, can = !walking && d === t.d && reach.includes(r.lane);
    const cls = `tu-cell t-${r.type}${past ? ' past' : ''}${skip ? ' skip' : ''}${cur ? ' cur' : ''}${can ? ' reach' : ''}${!past && !cur && !can && d <= t.d ? ' off' : ''}`;
    const tip = `第 ${d + 1} 层 · ${R.n}：${R.d}${d >= t.d ? `\n路程 ${fmtTok(cost)} 元气` : ''}`;
    const pop = r.type === 'boss' && m.boss ? `<span class="tu-pop"><b>${tuEsc(m.boss.n)}</b>${m.mechs.map(x => `<small>机制「${tuEsc(x.n)}」：${tuEsc(x.d)}</small>`).join('')}<span class="tu-pop-team">${m.boss.team.map(g => `<i title="${tuEsc(tuGuN(g))}">${guSVG(g.sp, { rank: g.rank })}<em>${RANK.ch[g.rank]}</em></i>`).join('')}</span></span>` : '';
    const tag = can ? 'button' : 'span', at = `style="left:${tuPct(r.lane)};top:${y(d)}px"`;
    cells.push(`<${tag} class="${cls}" ${at}${can ? ` data-trip="pick" data-lane="${r.lane}"` : ''} title="${tuEsc(pop ? '' : tip)}"><b class="tu-seal">${R.ch}</b>${can ? `<small>${fmtTok(cost)}</small>` : ''}${pop}</${tag}>`);
  });
  cells.push(`<span class="tu-cell t-start${t.d === 0 && !walking ? ' cur' : ''}" style="left:50%;top:${y(-1)}px" title="入口"><b class="tu-seal">入</b></span>`);
  const r = curRoom(t), need = needTok(t, tuUnit());
  const cap = walking ? `<p class="tu-cap tu-walkcap"><span>走向第 ${t.d + 1} 层的${ROOMS[r.type].n}</span><small id="tuProg">${fmtTok(t.prog)} / ${fmtTok(need)} 元气</small></p><p class="tu-hint">写代码的 token 推着蛊往前走（朱线就是进度）。</p>`
    : `<p class="tu-cap tu-walkcap"><span>点亮的格子可以走</span><small>格子下的数字是路程</small></p><p class="tu-hint">路程先花洞府攒着的元气（现在 ${fmtTok(S.bank)}），不够就等你写代码。</p>`;
  return `<div class="tu-mapwrap"><div class="tu-mapcol"><div class="tu-scroll"><div class="tu-tower" style="height:${Ht}px"><svg class="tu-lines" viewBox="0 0 300 ${Ht}" preserveAspectRatio="none" aria-hidden="true">${lines.join('')}</svg>${cells.join('')}</div></div></div>${tuSide(t)}</div>${cap}`;
}
// 地图旁边常驻：天象、首领（机制 + 阵容）、劫数、手里的祝福和出征食物
function tuSide(t) {
  const m = tripMods(t), out = [];
  if (m.sky) out.push(`<div class="tu-sc sky"><p class="k">天象 · 双方都吃</p><b>${tuEsc(m.sky.n)}</b><p>${tuEsc(m.sky.d)}</p></div>`);
  if (m.boss) out.push(`<div class="tu-sc boss"><p class="k">首领</p><b>${tuEsc(m.boss.n)}</b>${m.mechs.map(x => `<p><em>「${tuEsc(x.n)}」</em>${tuEsc(x.d)}<small>${tuEsc(x.k)}</small></p>`).join('')}<span class="tu-pop-team">${m.boss.team.map(g => `<i title="${tuEsc(tuGuN(g))}">${guSVG(g.sp, { rank: g.rank })}<em>${RANK.ch[g.rank]}</em></i>`).join('')}</span></div>`);
  if (m.kalpa) out.push(`<div class="tu-sc jie"><p class="k">劫数</p><b>${tuEsc(m.kalpaName)}</b><ol>${m.rules.map(x => `<li>${tuEsc(x)}</li>`).join('')}</ol></div>`);
  const bl = blessList(t), fd = (t.eff || []).filter(id => FOOD[id]);
  if (bl.length || fd.length) out.push(`<div class="tu-sc bless"><p class="k">这一趟的加持</p>${bl.map(b => `<p title="${tuEsc(b.d)}"><em>${tuEsc(b.n)}</em>${tuEsc(b.d)}<small>${tuEsc(b.last)}</small></p>`).join('')}${fd.map(id => `<p><em>${tuEsc(FOOD[id].n)}</em>${tuEsc(FOOD[id].d.replace(/^下一次出征：/, ''))}</p>`).join('')}</div>`);
  return `<aside class="tu-side">${out.join('')}</aside>`;
}
function tuFoes(foe) {
  return `<div class="tu-foes">${foe.map(f => `<div class="tu-f${f.boss ? ' boss' : ''}"><span class="tu-art">${guSVG(f.sp, { rank: f.rank })}</span><b>${tuEsc(SP[f.sp] ? SP[f.sp].n : f.sp)}</b><span class="st"><i class="a">${f.atk}</i><i class="h">${f.hp}</i></span></div>`).join('')}</div>`;
}
function tuRoom(t, S) {
  const room = t.room, R = ROOMS[room.type], title = `<p class="tu-eyebrow">第 ${room.d + 1} 层</p><h3><b class="tu-seal">${R.ch}</b>${R.n}</h3>`;
  if (room.foe) {
    const foe = roomFoe(t) || [], risky = room.type === 'elite' || room.type === 'boss', m = tripMods(t), pre = preOf(t), rules = [];
    if (m.sky) rules.push(`<li><b>天象「${tuEsc(m.sky.n)}」</b>${tuEsc(m.sky.d)}（双方都吃）</li>`);
    if (room.type === 'boss') m.mechs.forEach(x => rules.push(`<li class="mech"><b>首领机制「${tuEsc(x.n)}」</b>${tuEsc(x.d)}<small>${tuEsc(x.k)}</small></li>`));
    if (m.kalpa) rules.push(`<li><b>${tuEsc(m.kalpaName)}</b>${tuEsc(m.rules.join('；'))}</li>`);
    const boss = room.type === 'boss' && m.boss ? `<p class="tu-eyebrow">${tuEsc(m.boss.n)}</p>` : '';
    return `<div class="tu-panel t-${room.type}">${title}${boss}<p>${tuEsc(R.d)}</p>${risky ? '<p class="tu-warn">输了全队永久死亡；不想冒险，现在退出秘境，战利品都能带走。</p>' : ''}
      ${rules.length ? `<ul class="tu-rules">${rules.join('')}</ul>` : ''}<p class="tu-cap">对面</p>${tuFoes(foe)}${pre ? `<p class="tu-hint">开打前全队回 ${Math.round(pre * 100)}% 血（出征食物、祝福）。</p>` : ''}${t.revive && !t.revived ? `<p class="tu-hint">定魂香：这一趟第一只倒下的蛊，救回时以 ${Math.round(t.revive * 100)}% 血站起来。</p>` : ''}
      <div class="tu-main"><button class="zhu big" data-trip="fight">${room.type === 'boss' ? '渡劫' : '开打'}</button></div></div>`;
  }
  if (room.type === 'event') {
    const e = EVENT[room.ev];
    return `<div class="tu-panel t-event">${title.replace(R.n, tuEsc(e.n))}<p>${tuEsc(e.s)}</p><div class="tu-opts">${e.o.map((o, i) => { const pay = evPay(t, o.fx, tuUnit()), can = !pay || S.bank >= pay; return `<button class="tu-opt" data-trip="ev" data-i="${i}"${can ? '' : ' disabled'}><b>${tuEsc(o.t)}</b><small>${tuEsc(fxText(o.fx, pay))}${can ? '' : `（元气不够，现在 ${fmtTok(S.bank)}）`}</small></button>`; }).join('')}</div></div>`;
  }
  if (room.type === 'camp') return `<div class="tu-panel t-camp">${title}<p>歇脚，全队回满血的 ${Math.round(campOf(t) * 100)}%。</p><div class="tu-main"><button class="zhu big" data-trip="camp">歇一阵 · 全队回 ${Math.round(campOf(t) * 100)}% 血</button></div></div>`;
  if (room.type === 'bless') return `<div class="tu-panel t-bless">${title}<p>${tuEsc(R.d)}</p>${tuBlessCards(room.choices, 'bless')}</div>`;
  if (room.type === 'market') {
    const u = tuUnit();
    return `<div class="tu-panel t-market">${title}<p>${tuEsc(R.d)}</p><div class="tu-wares">${room.wares.map((w, i) => {
      const c = wareTok(w, u), can = !w.sold && S.bank >= c;
      return `<div class="tu-ware${w.sold ? ' sold' : ''}">${w.k === 'gu' ? `<span class="tu-art">${guSVG(w.g.sp, { rank: w.g.rank })}</span>` : `<b class="tu-seal">${w.k === 'heal' ? '药' : '食'}</b>`}<span>${tuEsc(wareText(w))}</span><button data-trip="buy" data-i="${i}"${can ? '' : ' disabled'}>${w.sold ? '买了' : fmtTok(c)}</button></div>`;
    }).join('')}</div><p class="tu-hint">花的是元气，洞府攒着的 ${fmtTok(S.bank)}。</p><div class="tu-main"><button class="zhu big" data-trip="leave">继续上路</button></div></div>`;
  }
  return '';
}
// 祝福三选一：每张卡写是什么、管多久
const tuBlessCards = (ids, act) => `<div class="tu-cards">${ids.map((id, i) => { const b = BLESS[id]; return b ? `<button class="tu-card" data-trip="${act}" data-i="${i}"><b>${tuEsc(b.n)}</b><span>${tuEsc(b.d)}</span><small>${tuEsc(blessLast(b))}</small></button>` : ''; }).join('')}</div>`;
function tuBlessPick(t, ids) {
  return `<div class="tu-panel t-bless"><p class="tu-eyebrow">打赢精英</p><h3><b class="tu-seal">福</b>选一个祝福</h3><p>只在这一趟有效，回洞府就没了。</p>${tuBlessCards(ids, 'offer')}<div class="tu-main"><button class="tu-sec" data-trip="offer" data-i="-1">都不要</button></div></div>`;
}
function tuReward(t) {
  const r = t.reward, g = r.gu, f = r.food && FOOD[r.food];
  return `<div class="tu-panel t-boss"><p class="tu-eyebrow">渡劫成功</p><h3><b class="tu-seal">劫</b>首领掉落，二选一</h3><p>选一样放进战利品袋，然后带着全部战利品回洞府。</p><div class="tu-cards two">
    ${g ? `<button class="tu-card" data-trip="reward" data-k="gu"><span class="tu-art">${guSVG(g.sp, { rank: g.rank })}</span><b>${tuEsc(tuGuN(g))}</b><span>${tuEsc(SP[g.sp] && SP[g.sp].d ? SP[g.sp].d : '这个秘境主道的蛊')}</span><small>放进蛊囊</small></button>` : ''}
    ${f ? `<button class="tu-card" data-trip="reward" data-k="food"><b class="tu-seal">食</b><b>${tuEsc(f.n)}</b><span>${tuEsc(f.d)}</span><small>放进食物架</small></button>` : ''}</div></div>`;
}
function tuOffer(t, by, o) {
  const g = by[o.uid], nw = XING[o.xing], old = XING[o.old]; if (!g || !nw || !old) return '';
  return `<div class="tu-panel"><p class="tu-eyebrow">蛊性</p><h3>${tuEsc(SP[g.sp].n)} 打出了新的蛊性</h3><p>每只蛊只能带一个蛊性，换了旧的就没了。</p>
    <ul class="tu-xl"><li><b>新的「${tuEsc(nw.n)}」</b>${tuEsc(nw.d)}</li><li><b>现在的「${tuEsc(old.n)}」</b>${tuEsc(old.d)}</li></ul>
    <div class="tu-main"><button class="zhu big" data-trip="xing" data-y="1">换成「${tuEsc(nw.n)}」</button><button class="tu-sec" data-trip="xing" data-y="0">留着「${tuEsc(old.n)}」</button></div></div>`;
}
function tuAsk(t) {
  const l = t.loot, items = [...l.gu.map(tuGuN), ...l.foods.map(tuFood)];
  return `<div class="tu-panel"><h3>退出秘境？</h3><p>${items.length ? `战利品袋里的全部带回：${tuEsc(items.join('、'))}。` : '战利品袋是空的。'}活着的蛊回洞府就养好伤。这一趟不算渡劫。</p>
    <div class="tu-main"><button class="zhu big" data-trip="fleeYes">退出秘境</button><button class="tu-sec" data-trip="fleeNo">继续走</button></div></div>`;
}
function tuEnd(t, by, S) {
  const e = t.end, head = { clear: ['渡劫成功', '闯到了最深处，赢了首领'], wipe: ['渡劫失败', '打输了一场，全队永久死亡'], retreat: ['退出秘境', '带着战利品回洞府'] }[e.why] || ['回洞府', ''];
  const first = e.cleared ? landReward(t.land, { realm: S.realm, best: tuBest(S, t.land), kalpa: t.kalpa }).first : [];   // 第一次渡过：晋境界、开放劫一（打到新的劫：开放下一劫）
  const isGot = (k, x) => t.got && t.got.k === k && (k === 'gu' ? t.got.gu.sp === x.sp && t.got.gu.rank === x.rank : t.got.food === x);
  let gotGu = false, gotFood = false;
  const N = tripMapOf(t).length, deep = Math.min(N, e.why === 'clear' ? N : e.depth + (t.rooms > e.depth ? 1 : 0));
  const tag = (k, x) => { const on = k === 'gu' ? !gotGu && isGot(k, x) : !gotFood && isGot(k, x); if (on) { if (k === 'gu') gotGu = true; else gotFood = true; } return on ? '<em class="tu-drop">首领掉落</em>' : ''; };
  const got = [...e.loot.gu.map(g => `<li><span class="tu-art">${guSVG(g.sp, { rank: g.rank })}</span><span>${tuEsc(tuGuN(g))}${tag('gu', g)}</span><small>放进蛊囊</small></li>`), ...e.loot.foods.map(id => `<li><b class="tu-seal">食</b><span>${tuEsc(tuFood(id))}${tag('food', id)}</span><small>放进食物架</small></li>`)];
  const lost = e.lost && !lootEmpty(e.lost) ? `<p class="tu-hint">丢在秘境里的：${tuEsc([...e.lost.gu.map(tuGuN), ...e.lost.foods.map(tuFood)].join('、'))}</p>` : '';
  const back = e.survivors.map(u => by[u]).filter(Boolean).map(g => tuEsc(SP[g.sp].n)), saved = (e.saved || []).map(u => by[u]).filter(Boolean).map(g => tuEsc(SP[g.sp].n));
  return `<div class="tu-panel tu-end w-${e.why}"><p class="tu-eyebrow">${head[0]}</p><h3>${head[1]}</h3><p>这一趟走了 ${t.rooms} 个房间，最深到第 ${deep} 层。${back.length ? `回来的：${back.join('、')}，回洞府就养好伤。` : ''}</p>${e.wiped ? '' : `<p class="tu-saved">${saved.length ? `救回 ${saved.length} 只：${saved.join('、')}（倒下过，但那一场打赢了）` : '这一趟没有蛊倒下过。'}</p>`}${first.length ? `<ul class="tu-first">${first.map(x => `<li>${tuEsc(x)}</li>`).join('')}</ul>` : ''}
    <p class="tu-cap">带回洞府</p>${got.length ? `<ul class="tu-got">${got.join('')}</ul>` : '<p class="tu-hint">什么也没带回。</p>'}${lost}
    ${e.fallen.length ? `<p class="tu-cap">全队永久死亡</p><ul class="tu-gone">${e.fallen.map(f => `<li><span class="tu-art gone">${guSVG(f.sp, { rank: f.rank })}</span><span><b>${tuEsc(tuGuN(f))}</b><small>${tuEsc(epitaph(f))}</small></span></li>`).join('')}</ul>` : ''}
    <div class="tu-main"><button class="zhu big" data-trip="home">回洞府</button></div></div>`;
}

// ───────────── 操作 ─────────────
async function tuFight(api, t) {
  const S = api.S(), room = t.room, ui = tuUI(t);
  const healed = tripPreFight(t), fielded = fieldTeam(t, S.team), foe = roomFoe(t);
  if (!fielded.length || !foe) return;
  tuBusy = true; api.save();
  let out;
  try {
    out = await api.playBattle(foe, { team: fielded, seed: `${t.seed}:${room.d}:${room.lane}`, title: `秘境第 ${room.d + 1} 层 · ${ROOMS[room.type].n}`, foeName: room.type === 'boss' ? `${tripLand(t).n}首领` : room.type === 'elite' ? `${tripLand(t).n}精英` : tripLand(t).n });
  } finally { tuBusy = false; }
  const r = tripFight(t, S.team, fielded, out.res); if (!r) return;
  const nm = u => { const g = S.team.find(x => x.uid === u); return g ? SP[g.sp].n : ''; };
  if (r.wiped) { ui.msg = []; ui.offers = []; return; }   // 打输：全队永久死亡，直接进结算
  ui.msg = [`${r.win ? '胜' : '僵持不下，各自退开（这个房间没有战利品）'}${healed ? `（开打前回了 ${healed} 血）` : ''}${r.loot && !lootEmpty(r.loot) ? '。进战利品袋：' + [...r.loot.gu.map(tuGuN), ...r.loot.foods.map(tuFood)].join('、') : ''}`];
  if (r.saved.length) ui.msg.push(`倒下的 ${r.saved.map(nm).join('、')} 救回来了，剩 1 血${r.revived ? `（定魂香：${nm(r.revived)} 以 ${Math.round(t.revive * 100)}% 血站起来）` : ''}`);
  if (r.reward) ui.msg.push('渡劫成功！首领掉落二选一');
  r.offers.filter(o => o.auto).forEach(o => ui.msg.push(`${nm(o.uid)} 打出了蛊性「${XING[o.xing].n}」：${XING[o.xing].d}`));
  ui.offers = r.offers.filter(o => !o.auto);
}
const TU_ACT = {
  pick(api, t, a) { tuUI(t).msg = []; tripPick(t, +a.dataset.lane, tuUnit(), api.S()); },
  fight(api, t) { return tuFight(api, t); },
  ev(api, t, a) {
    const S = api.S(), r = tripEvent(t, S.team, +a.dataset.i, tuUnit(), S), ui = tuUI(t); if (!r.ok) { ui.msg = [r.why || '选不了']; return; }
    ui.msg = [r.lines.length ? r.lines.join('，') : '什么也没发生'];
    if (r.offer) ui.offers = [r.offer];
  },
  camp(api, t) { const r = tripCamp(t); if (r) tuUI(t).msg = [`篝火边歇了一阵，全队共回 ${r.healed} 血`]; },
  bless(api, t, a) { const r = tripBless(t, +a.dataset.i); if (r) tuUI(t).msg = [`得祝福「${BLESS[r.id].n}」：${BLESS[r.id].d}（${blessLast(BLESS[r.id])}）`]; },
  offer(api, t, a) { const r = tripOffer(t, +a.dataset.i); if (r && r.id) tuUI(t).msg.push(`得祝福「${BLESS[r.id].n}」：${BLESS[r.id].d}（${blessLast(BLESS[r.id])}）`); },
  reward(api, t, a) { const g = tripReward(t, a.dataset.k); if (g) tuUI(t).msg = []; },
  buy(api, t, a) { const r = tripBuy(t, +a.dataset.i, tuUnit(), api.S()); tuUI(t).msg = r.ok ? ['买下了'] : [r.why || '买不了']; },
  leave(api, t) { tuUI(t).msg = []; tripLeaveRoom(t); },
  xing(api, t, a) {
    const ui = tuUI(t), o = ui.offers.shift(); if (!o) return;
    if (a.dataset.y === '1') { acceptXing(api.S().team, o.uid, o.xing); ui.msg = [`换上了蛊性「${XING[o.xing].n}」`]; }
  },
  flee(api, t) { tuUI(t).ask = 'flee'; },
  fleeNo(api, t) { tuUI(t).ask = null; },
  fleeYes(api, t) { const ui = tuUI(t); ui.ask = null; ui.msg = []; tripEnd(t, 'retreat'); },
  home(api, t) {   // 渡劫成功：记下这个秘境打到的最高劫（劫数的开放按它算），再交给洞府
    const S = api.S(), r = tripResult(t); if (!r) return 'done';
    if (r.cleared) { S.kalpa = S.kalpa || {}; S.kalpa[t.land] = Math.max(tuBest(S, t.land), t.kalpa || 0); }
    api.onTripEnd(r); return 'done';
  },
};
async function tuClick(e) {
  const a = e.target.closest && e.target.closest('[data-trip]'); if (!a || a.disabled || tuBusy) return;
  const api = TRIP.api; if (!api || !api.el || !api.el.contains(a)) return;
  const t = tuT(api), f = TU_ACT[a.dataset.trip]; if (!t || !f) return;
  const r = await f(api, t, a);
  if (r === 'done') return;   // 洞府接手（onTripEnd 会重绘整页）
  api.save(); tuDraw(api);
  const top = api.el && api.el.getBoundingClientRect(); if (top && top.top < 0) api.el.scrollIntoView({ block: 'start' });
}
if (typeof document !== 'undefined') document.addEventListener('click', tuClick);

// ───────────── 挂到洞府 ─────────────
TRIP.lands = LANDS;            // 秘境列表 [{ id, n, realm, quota, cap, dao, d, bosses: [{ i, mech, n, team }], boss（= 第一个首领的阵容）}]，洞府出征前给玩家选
// 进秘境前给玩家看的（选秘境列表、出征确认里用）：这一趟的天象、首领（名字、机制、阵容）、劫数规则、渡劫成功可得。
//   TRIP.preview(S, landId, kalpa) → { n, sky: { n, d }, boss: { n, mechs: [{ n, k, d }], team }, kalpa: { n, name, rules }, reward: { pick, first, lines } }
TRIP.preview = (S, id, kalpa) => tripPreview(tuNextSeed(S), id, kalpa | 0, { realm: S.realm, best: tuBest(S, id) });
TRIP.reward = (S, id, kalpa) => landReward(id, { realm: S.realm, best: tuBest(S, id), kalpa: kalpa | 0 });   // 只要「渡劫成功可得」时用
// 劫数：秘境一侧把每个秘境通关过的最高劫记在 S.kalpa[landId]（普通难度通关 = 0）。洞府选秘境时让玩家挑 0…open(S, id)，设 S.trip = { at, land, kalpa }
TRIP.kalpa = { max: JIE_MAX, names: JIE_NAMES, rules: JIE.map(j => j.n), best: tuBest, open: (S, id) => { const b = tuBest(S, id); return b < 0 ? 0 : Math.min(JIE_MAX, b + 1); } };
TRIP.foeFor = foeFor;          // (seed, quota, { dao, kind: 'room'|'elite'|'boss'|'ghost', depth }) → 敌阵，斗幽灵和战帖分场也用
TRIP.start = api => { tuInit(api); tuDraw(api); if (api.el) api.el.scrollIntoView({ block: 'start' }); };
TRIP.render = api => tuDraw(api);
TRIP.active = S => !!S.trip;
TRIP.feed = (S, tok) => {
  const t = S.trip && S.trip.v ? S.trip : null;
  if (!t) { S.bank += tok; return; }
  const api = TRIP.api;
  if (tripFeed(t, tok, tuUnit(), S)) { tuUI(t).msg = []; if (api) tuDraw(api); return; }
  if (t.pick != null && !t.room && typeof document !== 'undefined') {   // 走路中：只把地图上的朱线往前长、改数字，不整屏重画
    const ln = document.getElementById('tuWalkLn'), tx = document.getElementById('tuProg'), p = tuWalkPc(t);
    if (ln) { const [x1, y1, x2, y2] = ln.dataset.x.split(',').map(Number); ln.setAttribute('x2', x1 + (x2 - x1) * p); ln.setAttribute('y2', y1 + (y2 - y1) * p); }
    if (tx) tx.textContent = `${fmtTok(t.prog)} / ${fmtTok(needTok(t, tuUnit()))} 元气`;
  }
};
