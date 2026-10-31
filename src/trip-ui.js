// 蛊码 GuCode · 秘境界面。只通过 hooks.js 的 TRIP 和洞府打交道（不 import ui.js）。逻辑全在 trip.js。
// 一屏只有一个主按钮；「撤退」一直在右上角但不是主按钮；精英和首领开打前先给看阵容并写明「这一场可能会死蛊」。
// 倒下的蛊先停在原地送别（点了才过去），整次出征结束再列一遍带回了什么、谁没回来，然后交给洞府（api.onTripEnd）。
import { TRIP } from './hooks.js';
import { SP, RANK, XING, fmtTok } from './core.js';
import { guSVG } from './art.js';
import { VSC } from './tokens.js';
import { FOOD } from './foods.js';
import { DAO } from './daos.js';
import { TRIP_CFG, ROOMS, EVENT, nextLanes, tripStart, tripMapOf, tripAlive, tripReach, roomAt, curRoom, needTok, tripPick, tripFeed, roomFoe, fieldTeam, tripFight, tripPreFight, acceptXing, tripEvent, tripCamp, wareTok, tripBuy, wareText, tripLeaveRoom, tripEnd, tripResult, epitaph, lootEmpty, fxText, evPay, tripSeed, LANDS, foeFor, tripLand } from './trip.js';

const tuUnit = () => (VSC ? 8000 : 200);   // 1 份路程 = 多少 token（插件 8000，网页模拟 200），和 TokenSource.unit 一致
const tuEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tuFood = id => (FOOD[id] ? FOOD[id].n : id);
const tuGuN = g => (g ? (RANK.names[g.rank] || '') + (SP[g.sp] ? SP[g.sp].n : g.sp) : '');
let tuBusy = false;   // 战斗回放中不接点击

// ───────────── 状态 ─────────────
const tuT = api => { const S = api.S(); return S && S.trip && S.trip.v ? S.trip : null; };
function tuInit(api) {
  const S = api.S(), at = (S.trip && S.trip.at) || Date.now();
  const land = (S.trip && S.trip.land) || S.realm;   // 洞府选好的秘境 id（没选时取本境界第一个）
  const t = tripStart(tripSeed(S.seed, at), land, S.team, { trip: S.tripFood || [] });
  S.trip = Object.assign({ at }, t, { ui: { msg: [], fare: [], offers: [], ask: null } });
  api.save();
  return S.trip;
}
const tuUI = t => t.ui || (t.ui = { msg: [], fare: [], offers: [], ask: null });

// ───────────── 画面 ─────────────
function tuDraw(api) {
  const box = api.el; if (!box) return;
  const S = api.S(); let t = tuT(api);
  if (!t && S.trip) t = tuInit(api);
  if (!t) { box.innerHTML = ''; return; }
  const ui = tuUI(t), by = Object.fromEntries(S.team.map(g => [g.uid, g]));
  let body;
  if (ui.fare.length) body = tuFare(t, ui.fare[0]);
  else if (ui.offers.length) body = tuOffer(t, by, ui.offers[0]);
  else if (t.end) body = tuEnd(t, by, S);
  else if (ui.ask === 'flee') body = tuAsk(t);
  else if (t.room && !t.room.done) body = tuRoom(t, S);
  else body = tuMap(t, S) + tuWalk(t);
  const msg = ui.msg && ui.msg.length && !t.end ? `<p class="tu-msg">${ui.msg.map(tuEsc).join('<br>')}</p>` : '';
  box.innerHTML = `${tuHead(t)}${tuTeam(t, by)}${msg}<div class="tu-body">${body}</div>${t.end ? '' : tuBag(t)}`;
}
function tuHead(t) {
  const N = tripMapOf(t).length, d = Math.min(t.d, N - 1);
  const dots = Array.from({ length: N }, (_, i) => `<i class="${i < t.d ? 'past' : i === t.d && !t.end ? 'now' : ''}${i === N - 1 ? ' boss' : ''}">${i === N - 1 ? '劫' : ''}</i>`).join('');
  const flee = t.end || tuUI(t).ask ? '' : `<button class="tu-flee" data-trip="flee" title="带着战利品回洞府">撤退</button>`, L = tripLand(t);
  return `<div class="tu-head"><span class="lbl">${tuEsc(tripLand(t).n)} <small>${t.end ? '出征结束' : `第 ${d + 1} / ${N} 层`}</small></span><span class="tu-dots" aria-label="第 ${d + 1} 层，共 ${N} 层，最深处是首领" title="${tuEsc(`${L.n}：额度 ${L.quota}，主道是${DAO[L.dao] ? DAO[L.dao].n : L.dao}，最深处是首领`)}">${dots}</span>${flee}</div>`;
}
function tuTeam(t, by) {
  return `<div class="tu-team">${t.order.map(u => {
    const g = by[u], f = t.fallen.find(x => x.uid === u), sp = g ? g.sp : f && f.sp, rank = g ? g.rank : f && f.rank; if (!sp) return '';
    const dead = t.dead.includes(u), hp = t.hp[u] || 0, mx = t.mx[u] || 1, pc = Math.max(0, Math.min(100, Math.round(hp / mx * 100)));
    const xg = g && g.xing && XING[g.xing];
    return `<div class="tu-g${dead ? ' dead' : pc <= 30 ? ' low' : ''}" title="${tuEsc(xg ? `蛊性「${xg.n}」：${xg.d}` : '')}"><span class="tu-art">${guSVG(sp, { rank })}</span><span class="tu-gi"><b>${tuEsc(SP[sp] ? SP[sp].n : sp)}${xg ? `<em class="tu-xg">${tuEsc(xg.n[0])}</em>` : ''}</b>${dead ? '<small>倒下</small>' : `<span class="tu-hp"><i style="width:${pc}%"></i></span><small>${hp}/${mx}</small>`}</span></div>`;
  }).join('')}</div>`;
}
function tuBag(t) {
  const l = t.loot, items = [...l.gu.map(tuGuN), ...l.foods.map(tuFood)];
  return `<div class="tu-bag"><span class="lbl">战利品袋</span><span>${items.length ? items.map(tuEsc).join('、') : '还是空的'}</span><small>撤退或通关全部带回；全灭全部丢在秘境里。</small></div>`;
}
const tuX = lane => [50, 150, 250][lane];
function tuNode(t, d, lane, o = {}) {
  const r = roomAt(t, d, lane); if (!r) return '<span class="tu-room none"></span>';
  const R = ROOMS[r.type], cost = r.cost * tuUnit() * (d === t.d ? t.short || 1 : 1);
  const tag = o.pick ? 'button' : 'span', cls = `tu-room t-${r.type}${o.on ? ' on' : ''}${o.off ? ' off' : ''}${o.cur ? ' cur' : ''}`;
  return `<${tag} class="${cls}"${o.pick ? ` data-trip="pick" data-lane="${lane}"` : ''} title="${tuEsc(R.n + '：' + R.d)}"><b class="tu-seal">${R.ch}</b><span>${R.n}</span><small>${fmtTok(cost)}</small></${tag}>`;
}
function tuMap(t, S) {
  const map = tripMapOf(t); if (t.d >= map.length) return '';
  const reach = tripReach(t), walking = t.pick != null, d = t.d, nx = map[d + 1];
  const now = [0, 1, 2].map(l => tuNode(t, d, l, walking ? { on: l === t.pick, off: l !== t.pick, cur: l === t.pick } : { pick: reach.includes(l), off: !reach.includes(l) })).join('');
  const from = walking ? [t.pick] : reach, to = new Set(), lines = [];
  if (nx) from.forEach(l => { if (!roomAt(t, d, l)) return; nextLanes(map, d, l).forEach(n => { to.add(n); lines.push(`<line x1="${tuX(l)}" y1="0" x2="${tuX(n)}" y2="40"/>`); }); });
  const next = nx ? [0, 1, 2].map(l => tuNode(t, d + 1, l, { off: !to.has(l) })).join('') : '';
  return `<div class="tu-map"><p class="tu-cap">${walking ? '正在走这条路' : '这一层走哪条路？'}<small>数字 = 要走多少元气</small></p><div class="tu-row">${now}</div>${nx ? `<svg class="tu-links" viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true">${lines.join('')}</svg><p class="tu-cap sub">再往下一层${map[d + 1].boss ? '：渡劫首领' : ''}</p><div class="tu-row next">${next}</div>` : ''}</div>`
    + (walking ? '' : `<p class="tu-hint">路程花元气：先花洞府攒着的（现在 ${fmtTok(S.bank)}），不够就等你写代码，token 会推着蛊往前走。</p>`);
}
function tuWalk(t) {
  const r = curRoom(t); if (!r || t.room) return '';
  const need = needTok(t, tuUnit()), pc = Math.min(100, Math.round(t.prog / need * 100));
  return `<div class="tu-walk"><b class="tu-seal">${ROOMS[r.type].ch}</b><div><p>走向第 ${t.d + 1} 层的${ROOMS[r.type].n}</p><div class="tu-bar"><i id="tuBar" style="width:${pc}%"></i></div><small id="tuProg">${fmtTok(t.prog)} / ${fmtTok(need)} 元气 · 写代码的 token 推着蛊往前走</small></div></div>`;
}
function tuFoes(foe) {
  return `<div class="tu-foes">${foe.map(f => `<div class="tu-f${f.boss ? ' boss' : ''}"><span class="tu-art">${guSVG(f.sp, { rank: f.rank })}</span><b>${tuEsc(SP[f.sp] ? SP[f.sp].n : f.sp)}</b><span class="st"><i class="a">${f.atk}</i><i class="h">${f.hp}</i></span></div>`).join('')}</div>`;
}
function tuRoom(t, S) {
  const room = t.room, R = ROOMS[room.type], title = `<p class="tu-eyebrow">第 ${room.d + 1} 层</p><h3><b class="tu-seal">${R.ch}</b>${R.n}</h3>`;
  if (room.foe) {
    const foe = roomFoe(t) || [], risky = room.type === 'elite' || room.type === 'boss';
    return `<div class="tu-panel t-${room.type}">${title}<p>${tuEsc(R.d)}</p>${risky ? '<p class="tu-warn">这一场可能会死蛊。倒下的蛊永远回不来；不想冒险，现在撤退，战利品都能带走。</p>' : ''}
      <p class="tu-cap">对面</p>${tuFoes(foe)}${t.pre ? `<p class="tu-hint">回春茶：开打前全队回 ${Math.round(t.pre * 100)}% 血。</p>` : ''}
      <div class="tu-main"><button class="zhu big" data-trip="fight">${room.type === 'boss' && t.realm === S.realm ? '渡劫' : '开打'}</button></div></div>`;
  }
  if (room.type === 'event') {
    const e = EVENT[room.ev];
    return `<div class="tu-panel t-event">${title.replace(R.n, tuEsc(e.n))}<p>${tuEsc(e.s)}</p><div class="tu-opts">${e.o.map((o, i) => { const pay = evPay(t, o.fx, tuUnit()), can = !pay || S.bank >= pay; return `<button class="tu-opt" data-trip="ev" data-i="${i}"${can ? '' : ' disabled'}><b>${tuEsc(o.t)}</b><small>${tuEsc(fxText(o.fx, pay))}${can ? '' : `（元气不够，现在 ${fmtTok(S.bank)}）`}</small></button>`; }).join('')}</div></div>`;
  }
  if (room.type === 'camp') return `<div class="tu-panel t-camp">${title}<p>${tuEsc(R.d)}</p><div class="tu-main"><button class="zhu big" data-trip="camp">歇一阵 · 全队回 ${Math.round(TRIP_CFG.camp * 100)}% 血</button></div></div>`;
  if (room.type === 'market') {
    const u = tuUnit();
    return `<div class="tu-panel t-market">${title}<p>${tuEsc(R.d)}</p><div class="tu-wares">${room.wares.map((w, i) => {
      const c = wareTok(w, u), can = !w.sold && S.bank >= c;
      return `<div class="tu-ware${w.sold ? ' sold' : ''}">${w.k === 'gu' ? `<span class="tu-art">${guSVG(w.g.sp, { rank: w.g.rank })}</span>` : `<b class="tu-seal">${w.k === 'heal' ? '药' : '食'}</b>`}<span>${tuEsc(wareText(w))}</span><button data-trip="buy" data-i="${i}"${can ? '' : ' disabled'}>${w.sold ? '买了' : fmtTok(c)}</button></div>`;
    }).join('')}</div><p class="tu-hint">花的是元气，洞府攒着的 ${fmtTok(S.bank)}。</p><div class="tu-main"><button class="zhu big" data-trip="leave">继续上路</button></div></div>`;
  }
  return '';
}
function tuOffer(t, by, o) {
  const g = by[o.uid], nw = XING[o.xing], old = XING[o.old]; if (!g || !nw || !old) return '';
  return `<div class="tu-panel"><p class="tu-eyebrow">蛊性</p><h3>${tuEsc(SP[g.sp].n)} 打出了新的蛊性</h3><p>每只蛊只能带一个蛊性，换了旧的就没了。</p>
    <ul class="tu-xl"><li><b>新的「${tuEsc(nw.n)}」</b>${tuEsc(nw.d)}</li><li><b>现在的「${tuEsc(old.n)}」</b>${tuEsc(old.d)}</li></ul>
    <div class="tu-main"><button class="zhu big" data-trip="xing" data-y="1">换成「${tuEsc(nw.n)}」</button><button class="tu-sec" data-trip="xing" data-y="0">留着「${tuEsc(old.n)}」</button></div></div>`;
}
function tuFare(t, uid) {
  const f = t.fallen.find(x => x.uid === uid); if (!f) return '';
  return `<div class="tu-panel tu-fare"><span class="tu-art gone">${guSVG(f.sp, { rank: f.rank })}</span><p class="tu-eyebrow">永远留在了秘境里</p><h3>${tuEsc(tuGuN(f))}</h3><p>${tuEsc(epitaph(f))}</p><p class="tu-hint">倒下的蛊不会再回来。</p>
    <div class="tu-main"><button class="zhu big" data-trip="fare">送它走</button></div></div>`;
}
function tuAsk(t) {
  const l = t.loot, items = [...l.gu.map(tuGuN), ...l.foods.map(tuFood)];
  return `<div class="tu-panel"><h3>撤退回洞府？</h3><p>${items.length ? `战利品袋里的全部带回：${tuEsc(items.join('、'))}。` : '战利品袋是空的。'}活着的蛊回洞府就养好伤。</p>
    <div class="tu-main"><button class="zhu big" data-trip="fleeYes">撤退</button><button class="tu-sec" data-trip="fleeNo">继续走</button></div></div>`;
}
function tuEnd(t, by, S) {
  const e = t.end, trib = t.realm === S.realm, head = { clear: trib ? ['渡劫成功', '闯到了最深处，赢了首领，境界加一'] : ['通关', '闯到了最深处，赢了首领'], wipe: ['全灭', '出征的蛊全部倒下了'], retreat: ['撤退', '带着战利品回洞府'] }[e.why] || ['回洞府', ''];
  const N = tripMapOf(t).length, deep = Math.min(N, e.why === 'clear' ? N : e.depth + (t.rooms > e.depth ? 1 : 0));
  const got = [...e.loot.gu.map(g => `<li><span class="tu-art">${guSVG(g.sp, { rank: g.rank })}</span>${tuEsc(tuGuN(g))}<small>放进蛊囊</small></li>`), ...e.loot.foods.map(id => `<li><b class="tu-seal">食</b>${tuEsc(tuFood(id))}<small>放进食物架</small></li>`)];
  const lost = e.lost && !lootEmpty(e.lost) ? `<p class="tu-hint">丢在秘境里的：${tuEsc([...e.lost.gu.map(tuGuN), ...e.lost.foods.map(tuFood)].join('、'))}</p>` : '';
  const back = e.survivors.map(u => by[u]).filter(Boolean).map(g => tuEsc(SP[g.sp].n));
  return `<div class="tu-panel tu-end w-${e.why}"><p class="tu-eyebrow">${head[0]}</p><h3>${head[1]}</h3><p>这一趟走了 ${t.rooms} 个房间，最深到第 ${deep} 层。${back.length ? `回来的：${back.join('、')}，回洞府就养好伤。` : ''}</p>
    <p class="tu-cap">带回洞府</p>${got.length ? `<ul class="tu-got">${got.join('')}</ul>` : '<p class="tu-hint">什么也没带回。</p>'}${lost}
    ${e.fallen.length ? `<p class="tu-cap">没有回来的</p><ul class="tu-gone">${e.fallen.map(f => `<li><span class="tu-art gone">${guSVG(f.sp, { rank: f.rank })}</span><span><b>${tuEsc(tuGuN(f))}</b><small>${tuEsc(epitaph(f))}</small></span></li>`).join('')}</ul>` : ''}
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
  ui.msg = [`${r.win ? '胜' : out.res.winner === 'draw' ? '僵持不下，各自退开' : '败'}${healed ? `（开打前回春茶回了 ${healed} 血）` : ''}${r.loot && !lootEmpty(r.loot) ? '。进战利品袋：' + [...r.loot.gu.map(tuGuN), ...r.loot.foods.map(tuFood)].join('、') : ''}`];
  r.offers.filter(o => o.auto).forEach(o => ui.msg.push(`${nm(o.uid)} 打出了蛊性「${XING[o.xing].n}」：${XING[o.xing].d}`));
  ui.fare = r.dead.slice(); ui.offers = r.offers.filter(o => !o.auto);
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
  buy(api, t, a) { const r = tripBuy(t, +a.dataset.i, tuUnit(), api.S()); tuUI(t).msg = r.ok ? ['买下了'] : [r.why || '买不了']; },
  leave(api, t) { tuUI(t).msg = []; tripLeaveRoom(t); },
  xing(api, t, a) {
    const ui = tuUI(t), o = ui.offers.shift(); if (!o) return;
    if (a.dataset.y === '1') { acceptXing(api.S().team, o.uid, o.xing); ui.msg = [`换上了蛊性「${XING[o.xing].n}」`]; }
  },
  fare(api, t) { tuUI(t).fare.shift(); },
  flee(api, t) { tuUI(t).ask = 'flee'; },
  fleeNo(api, t) { tuUI(t).ask = null; },
  fleeYes(api, t) { const ui = tuUI(t); ui.ask = null; ui.msg = []; tripEnd(t, 'retreat'); },
  home(api, t) { const r = tripResult(t); if (r) api.onTripEnd(r); return 'done'; },
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
TRIP.lands = LANDS;            // 秘境列表 [{ id, n, realm, quota, cap, dao, d, boss: [{ sp, rank, pos, boss }] }]，洞府出征前给玩家选
TRIP.foeFor = foeFor;          // (seed, quota, { dao, kind: 'room'|'elite'|'boss'|'ghost', depth }) → 敌阵，斗幽灵和战帖分场也用
TRIP.start = api => { tuInit(api); tuDraw(api); if (api.el) api.el.scrollIntoView({ block: 'start' }); };
TRIP.render = api => tuDraw(api);
TRIP.active = S => !!S.trip;
TRIP.feed = (S, tok) => {
  const t = S.trip && S.trip.v ? S.trip : null;
  if (!t) { S.bank += tok; return; }
  const api = TRIP.api;
  if (tripFeed(t, tok, tuUnit(), S)) { tuUI(t).msg = []; if (api) tuDraw(api); return; }
  if (t.pick != null && !t.room && typeof document !== 'undefined') {   // 走路中：只更新进度条，不整屏重画
    const need = needTok(t, tuUnit()), bar = document.getElementById('tuBar'), tx = document.getElementById('tuProg');
    if (bar) bar.style.width = Math.min(100, Math.round(t.prog / need * 100)) + '%';
    if (tx) tx.textContent = `${fmtTok(t.prog)} / ${fmtTok(need)} 元气 · 写代码的 token 推着蛊往前走`;
  }
};
