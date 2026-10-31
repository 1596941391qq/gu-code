// 蛊码 GuCode · 界面与流程：洞府（养成）、斗幽灵与战帖（切磋）、战斗回放、秘境接口。规则只认 docs/design.md
import { SPECIES, SP, TRAITS, REALMS, SLOTS, RANK, COMBOS, makeRng, hashStr, newGu, starterTeam, baseRank, rankOf, rankName, statFor, natOf, natMulFor, awOf, slotCap, poolFor, BAG, bagCap, canBuy, placeGu, mergeAll, sellValue, teamCombos, comboMissing, daoCount, daoOf, rollShop, foodCost, feedStat, PRICE, genTeam, ghostTrio, posLinks, encodeTeam, decodeTeam, EV_MS, playMs, tempoFor, fmtNum, fmtTok } from './core.js';
import { battle } from './battle.js';
import { guSVG, ART_DEFS } from './art.js';
import { TokenSource, VSC } from './tokens.js';
import { makeCard } from './card.js';
import { fuseRankUp, fxConfig } from './fx.js';
import { metaInit, metaMigrate, metaEmit, isUnlocked, timelineView } from './meta.js';
import { ledgerInit, openLedger, ledgerLimitRows, ledgerBindLimits } from './ledger.js';
import { DAOS, DAO } from './daos.js';
import { FOODS, FOOD, FOOD_KIND } from './foods.js';
import { TRIP } from './hooks.js';

const KEY = 'gucode.v1';
const $ = (s, r = document) => r.querySelector(s);
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const setHTML = (n, h) => { if (n && n._h !== h) { n.innerHTML = h; n._h = h; } };   // 内容没变就不重绘，悬停提示不会被打断

// ---------- 界面文案集中在这里 ----------
const TXT = {
  qiTip: '元气就是你在 AI 编程工具里消耗的 token，没有上限，也没有别的来源。买蛊、买食物、转市花元气；出征时先用攒下的元气一口气往深处走，用完靠实时 token。',
  qiTrial: '网页版是模拟元气（存档标「试玩」）。',
  sota: '你正在用 Claude，蛊的伤害 +1%',
  slotsHead: '空窍',
  slotsSub: '场上 · 出征时全部跟去',
  bagHead: '蛊囊',
  bagSub: '场下 · 凑合成用 · 不出征，绝对安全',
  bagTip: () => `蛊囊 ${S.bag.length}/${BC()}：场下的蛊放这里，不上场、不出征，所以绝对安全。主要用来凑合成：空窍和蛊囊里同种同转的蛊凑够三只，自动合成高一转。拖进空窍就上场。`,
  shopHead: '蛊市',
  shopTip: '花元石买蛊和食物。主道的蛊和食物大约占六成。转市换一批，冻结的货下次还在。',
  refresh: c => `转市 · ${c}`,
  freeze: on => on ? '解冻' : '冻结',
  daoNone: '还没定主道',
  daoLine: d => `本轮主道：${DAO[d] ? DAO[d].n : d}`,
  daoTip: '每次回到洞府转一次罗盘，三选一定下本轮蛊市的主道：货架上大约六成的蛊和食物出自这一道。罗盘不加属性。',
  compassHead: '罗盘 · 三选一主道',
  compassSub: '选一道，本轮蛊市大约六成的蛊和食物出自这一道。',
  resoNone: '道共鸣：同一道的蛊在空窍里有 2 只、4 只时触发',
  go: '出征',
  goSub: n => `空窍里的 ${n} 只蛊全部出征`,
  goWarn: '在秘境战斗中倒下的蛊会永远消失。蛊囊里的蛊留在洞府，绝对安全。可以随时撤退，带回战利品和活着的蛊；全员倒下就是全灭，这次的战利品全部丢失。',
  goSoon: '秘境还在开凿，出征下一版就来。先在洞府里买蛊、合成、排阵。',
  inTrip: '队伍正在秘境里。出征中不能逛蛊市、不能换阵。',
  merge: g => `三只合一：炼成${rankName(g)}，攻 ${g.atk} 血 ${g.hp}`,
  toBag: g => `${rankName(g)} 进了蛊囊（空窍满了）`,
  bagFull: '空窍和蛊囊都满了：先卖掉一只，或凑成合成',
  sold: (g, v) => `卖掉${rankName(g)}，退回 ${fmtTok(v)} 元气`,
  bought: g => `买下${rankName(g)}`,
  foodPick: f => `把「${f.n}」喂给哪一只？`,
  gearPick: f => `把「${f.n}」挂在哪一只身上？每只最多挂 1 个，换新的旧的就没了。`,
  tripFood: f => `「${f.n}」收好了，下一次出征生效`,
  fed: (f, gs) => `${f.n}：${gs.map(g => SP[g.sp].n).join('、')} 攻 +${f.atk || 0} 血 +${f.hp || 0}`,
  geared: (f, g) => `${SP[g.sp].n} 挂上了「${f.n}」`,
  floor: g => `洞府里一只蛊都没有了，免费领到${rankName(g)}`,
  poor: (need) => `元气不够：还差 ${fmtTok(need)}，写会儿代码就有了`,
  spar: '纯切磋：不死蛊，也不给东西',
  trib: r => `渡劫成功 · ${REALMS[r]}`,
  tribLines: r => [`空窍多开一格：现在 ${slotCap(r)} 格`, `蛊市进新档：能买到${RANK.names[Math.min(5, r + 1)]}的蛊`, '罗盘会转出新的道'],
  comboFirst: c => `杀招成形 · ${c.n}`,
  comboLines: (c, g) => [`${c.need.map(x => SP[x].n).join(' + ')} 同时在空窍，杀招自动成形`, `挂在${SP[g.sp].n}身上：${c.d}`, '蛊卡上的朱印就是它，悬停能看配方和效果'],
  achFirst: a => `道途 · ${a.n}`,
  achLines: a => [a.d + '：达成', ...(a.unlock || []).map(u => `解锁${{ species: '新蛊', food: '新食物', trip: '新秘境', feature: '新玩法' }[u.k] || ''}：${u.n}`)],
  trial: '试玩',
  trialShare: '这是网页试玩存档（模拟元气养的蛊），坐标码、分享卡、战帖和复盘都会标「试玩」。装 VS Code 插件、用真实 token 养的蛊不带这个标。',
  trialFoe: '对方是试玩存档（网页模拟元气养的蛊，不是真实 token 养出来的）',
  trialText: '【试玩存档】',
  srcLive: '实时 token', srcDemo: '模拟元气 ?', srcHead: '元气从哪来',
  srcFrom: '插件读取本机 Claude Code、Codex 等 AI 工具日志里的 token 用量数字，不读对话和代码内容。插件里只认真实 token，不能切到模拟元气。',
  srcNone: '现在没有工具在烧 token，元气暂时不涨。开始写代码就会涨。',
  demoHead: '这里是模拟元气',
  demoFrom: '网页读不到你电脑上的 AI 用量，这里按真实写代码时的常见流速（每秒约 500～1500 token）模拟。上面的「写代码中 / 停手休息」切换模拟状态。',
  demoTrial: '网页存档是试玩存档：分享出去的坐标码、分享卡、战帖和复盘都会标「试玩」，也不能导入插件。',
  demoInstall: '想用真实 token 养蛊，装 VS Code 插件。插件只读本机 Claude Code、Codex 等工具日志里的用量数字，不读对话和代码内容。',
};
const trialTag = on => on ? `<span class="trialtag">${TXT.trial}</span>` : '';

// ---------- 存档 ----------
// v3 = v2 玩法的存档（gu = { uid, sp, rank, atk, hp, food, xing, bonusA?, bonusH? }）。旧版本存档一律不读，启动时另存到 BAK_KEY。
// bank = 元气（token），没有上限；所有价格都是 token 数
const BAK_KEY = 'gucode.v1.bak-v2';
const fresh = () => ({ v: 3, started: false, name: '', realm: 0, bank: 0, total: 0, team: [], bag: [], shop: [], dao: null, compass: null, tripFood: [], pantry: [], trip: null,
  seed: (Math.random() * 1e9) >>> 0, step: 0, speed: 1, mute: true, theme: 'auto', calm: false, codex: {}, combosSeen: [], log: [], hlog: [], meta: null, todayKey: '', todayTok: 0, ghosts: null, trial: false, sotaAt: 0 });
const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const curCap = () => Math.max(slotCap(S.realm), S.team.length), BC = () => Math.max(bagCap(S.realm), S.bag.length);
const migrate = s => s && s.v === 3 ? s : null;
const price = k => Math.round(k * src.unit);   // 价格表（core.PRICE，单位 = 罗盘「千」）换成 token 数
let S = fresh(), rate = 0, hot = false, inBattle = false, booted = false, skip = false, resetArm = 0;
const src = new TokenSource(onTick);
const R = () => makeRng(S.seed + ':' + (S.step++));
const M = () => S.meta || (S.meta = metaInit());
const tripOn = () => TRIP.active ? !!TRIP.active(S) : !!S.trip;
let saveT;
function save() {
  if (saveT) return;   // 节流而非防抖：持续有 token 流入时也能按时落盘
  saveT = setTimeout(() => {
    saveT = null; codexScan(); S.seen = Date.now();
    if (VSC) VSC.postMessage({ type: 'save', data: S, status: { started: S.started, node: tripOn() ? '秘境' : null, cost: 0, prog: 0, realm: S.realm } });
    else try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  }, 400);
}
// 蛊典：见过的蛊（终身，跨局保留）
function codexScan() { [...S.team, ...S.bag].forEach(g => { if (!S.codex[g.sp]) S.codex[g.sp] = 1; }); }
// ---------- 声音（默认静音）----------
let AC = null; const KSB = {};
const QIN = [130.8, 146.8, 164.8, 196, 220, 261.6, 293.7, 329.6, 392, 440];   // 宫商角徵羽，两个八度
function ac() { if (!AC) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; AC = new C(); } if (AC.state === 'suspended') AC.resume(); return AC; }
function ksBuf(f) {   // Karplus-Strong 拨弦：噪声入环形缓冲，平均+衰减 ≈ 琴弦
  const k = Math.round(f); if (KSB[k]) return KSB[k];
  const sr = AC.sampleRate, len = Math.floor(sr * 1.8), buf = AC.createBuffer(1, len, sr), d = buf.getChannelData(0), N = Math.max(2, Math.round(sr / f)), ring = new Float32Array(N);
  for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
  for (let i = 0, j = 0; i < len; i++) { const n = (j + 1) % N, v = ring[j]; d[i] = v * (i < 40 ? i / 40 : 1); ring[j] = 0.4985 * (v + ring[n]); j = n; }
  return (KSB[k] = buf);
}
function pluck(f, at = 0, vol = 0.32) { const s = AC.createBufferSource(), g = AC.createGain(), lp = AC.createBiquadFilter(); s.buffer = ksBuf(f); lp.type = 'lowpass'; lp.frequency.value = 2400; g.gain.value = vol; s.connect(lp).connect(g).connect(AC.destination); s.start(AC.currentTime + at); }
function thump(vol = 0.5) {
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + 0.25);
  const len = AC.sampleRate * 0.05, nb = AC.createBuffer(1, len, AC.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const n = AC.createBufferSource(), ng = AC.createGain(), bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; ng.gain.value = vol * 0.35; n.buffer = nb; n.connect(bp).connect(ng).connect(AC.destination); n.start(t);
}
function ding(at = 0, vol = 0.12, f0 = 2350) {   // 钱币：非谐泛音的短促金属声
  const t = AC.currentTime + at;
  [[f0, 1], [f0 * 1.51, 0.6], [f0 * 2.37, 0.35]].forEach(([f, v]) => { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = f; g.gain.setValueAtTime(vol * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + 0.4); });
}
function glitch() { const len = AC.sampleRate * 0.16, b = AC.createBuffer(1, len, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.floor(i / 70) % 2 ? 1 : -1) * Math.random() * (1 - i / len) * 0.45; const s = AC.createBufferSource(), g = AC.createGain(); g.gain.value = 0.22; s.buffer = b; s.connect(g).connect(AC.destination); s.start(); }
function snd(kind) {
  if (S.mute) return;
  try {
    if (!ac()) return;
    if (kind === 'pluck') pluck(QIN[3 + ((Math.random() * 7) | 0)]);
    else if (kind === 'hit') thump(0.45);
    else if (kind === 'faint') pluck(QIN[0], 0, 0.28);
    else if (kind === 'combo') { pluck(QIN[0], 0, 0.4); pluck(QIN[4], 0.05, 0.3); pluck(QIN[7], 0.1, 0.25); glitch(); }
    else if (kind === 'win') [5, 7, 9].forEach((i, k) => pluck(QIN[i], k * 0.14, 0.3));
    else if (kind === 'coin') ding(0);
    else if (kind === 'coins') [0, 0.07, 0.15, 0.26].forEach(t => ding(t));
    else if (kind === 'clack') thump(0.25);
    else if (kind === 'tick') ding(0, 0.06, 1500 + Math.random() * 300);
    else if (kind === 'lose') [6, 3, 0].forEach((i, k) => pluck(QIN[i], k * 0.2, 0.28));
  } catch (e) {}
}
document.addEventListener('pointerdown', () => { if (!S.mute) ac(); }, { once: true });

// ---------- Token 流 → 元气 ----------
let sessTok = 0, bySrc = null;
// bySource 兼容 { claude: 2900 } / { claude: { rate } } / [{ name, rate }] 几种写法
function srcList(bs) {
  if (!bs) return [];
  const arr = Array.isArray(bs) ? bs : Object.entries(bs).map(([k, v]) => typeof v === 'number' ? { name: k, rate: v } : { name: k, ...v });
  return arr.map(x => ({ name: String(x.label || x.name || x.src || x.id || ''), rate: +x.rate || 0 })).filter(x => x.name);
}
// SOTA 彩蛋：插件读到最近 10 分钟内有 Claude 的 token。网页模拟元气永远不算
const SOTA_MS = 600000;
const sotaOn = () => !!VSC && Date.now() - (S.sotaAt || 0) < SOTA_MS;
function countTok(d) { if (!(d > 0)) return; sessTok += d; if (S.todayKey !== today()) { S.todayKey = today(); S.todayTok = 0; } S.todayTok += d; }
function onTick(t) {
  rate = t.rate; hot = t.hot; bySrc = t.bySource || null;
  if (VSC && srcList(bySrc).some(x => /claude/i.test(x.name) && x.rate > 0)) S.sotaAt = Date.now();
  if (!booted) return;
  if (t.delta > 0 && S.started) { countTok(t.delta); feed(t.delta); }
  meters();
}
// 元气进账：洞府里直接存进 S.bank（没有上限）；出征中交给秘境（它自己决定先花攒下的元气还是实时的）
function feed(tok) {
  S.total += tok;
  if (tripOn()) { if (TRIP.feed) TRIP.feed(S, tok); }
  else S.bank += tok;
  save();
}
const canPay = k => S.bank >= price(k);
function pay(k) { const n = price(k); if (S.bank < n) { note(TXT.poor(n - S.bank)); return false; } S.bank -= n; return true; }

// ---------- 全屏时刻（只有三种：渡劫成功、成就解锁、杀招第一次成形）：停住等玩家点，一次一个排队 ----------
const BIGQ = []; let bigBusy = false;
function big(kind, title, lines = []) { BIGQ.push({ kind, title, lines }); if (!bigBusy) bigRun(); }
async function bigRun() {
  bigBusy = true;
  while (BIGQ.length) {
    const b = BIGQ.shift();
    const ov = el(`<div class="bigmo big-${b.kind}" role="dialog" aria-modal="true"><div class="bigcard"><p class="eyebrow">${{ trib: '渡劫', ach: '道途', combo: '杀招' }[b.kind] || ''}</p><h2>${esc(b.title)}</h2><ul>${b.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul><button class="zhu big" data-big="ok">知道了</button></div></div>`);
    document.body.appendChild(ov); snd(b.kind === 'trib' ? 'combo' : 'pluck');
    requestAnimationFrame(() => ov.classList.add('in'));
    await new Promise(res => ov.addEventListener('click', e => { if (e.target.closest('[data-big]')) res(); }));
    ov.classList.remove('in'); await sleep(180); ov.remove();
  }
  bigBusy = false;
}
// 原地反馈：洞府战报加一行（留最近 5 行）
function note(txt) { const l = S.hlog || (S.hlog = []); l.push(txt); if (l.length > 5) l.splice(0, l.length - 5); renderLog(); }
function renderLog() { const b = $('#hlog'); if (b) setHTML(b, (S.hlog || []).map((t, i, a) => `<li${i === a.length - 1 ? ' class="new"' : ''}>${esc(t)}</li>`).join('')); }
function achieve(k, n, o) { metaEmit(M(), k, n, o).forEach(a => big('ach', TXT.achFirst(a), TXT.achLines(a))); }

// ---------- 渲染 ----------
const unlocked = (id, k) => isUnlocked(M(), id, k);
function renderAll() {
  const app = $('#app'); if (!app) return;
  app.innerHTML = S.started ? mainHTML() : startHTML();
  if (S.started) { renderHome(); meters(); if (tripOn() && TRIP.render) TRIP.render(TRIP.api); }
  applyCalm();
}
function startHTML() {
  const r = makeRng(S.seed + ':start'), pool = poolFor(0).filter(sp => unlocked(sp, 'species')), picks = [];
  while (picks.length < 3 && pool.length) picks.push(pool.splice(r.int(pool.length), 1)[0]);
  return `<div class="start"><div class="hero"><h1 class="title">蛊码</h1><p class="tag">烧 Token，养蛊，闯秘境。</p>
  <p class="lead">你写代码消耗的每一个 token 都是元气。在洞府里花元气买蛊、合成、喂食、排阵，再带着它们进秘境闯关。在秘境里倒下的蛊永远没了。</p></div>
  <h2 class="step">三选一，领第一只蛊</h2><div class="starters">${picks.map(id => { const s = SP[id], st = statFor(id, 1); return `<button class="starter" data-act="pick" data-sp="${id}"><div class="sart">${guSVG(id)}</div><b>${s.n}</b><span class="sst"><i class="a">${st.atk}</i><i class="h">${st.hp}</i></span><span class="strig">${esc(natDesc(id))}</span><em>${esc(s.lore)}</em></button>`; }).join('')}</div>
  <p class="fine">${VSC ? '插件模式：读取本机 Claude Code / Codex 会话的 token 用量数字（不读内容）。' : '网页版是模拟元气，存档标「试玩」，只存在本机。'}</p></div>`;
}
const natDesc = sp => { const k = natOf(sp); return k && TRAITS[k] ? `本命·${TRAITS[k].n}：${TRAITS[k].d(1, natMulFor(SP[sp].rank))}` : ''; };
const natOfG = g => { const k = natOf(g.sp); return k && TRAITS[k] ? { n: TRAITS[k].n, ch: TRAITS[k].ch, d: TRAITS[k].d(1, natMulFor(rankOf(g))), aw: awOf(g) } : null; };
function mainHTML() {
  return `<header class="top"><div class="brand"><b class="logo">蛊码</b><span class="sub">烧 Token · 养蛊 · 闯秘境</span></div>
  <div class="tools"><span class="realm" id="realm" data-tip="${esc(`境界：${REALMS[S.realm]}。秘境最深处是渡劫首领，赢了境界加一：多开一格空窍，蛊市进新档，罗盘出新的道。`)}">${REALMS[S.realm]}</span><button class="ib gear" data-act="settings" title="设置" aria-label="设置"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm7.4 4.6.1-1.2-.1-1.2 2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.6 3h-4l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6-.1 1.2.1 1.2-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4z"/></svg></button><button class="ib zhu" data-act="share">战帖</button></div></header>
  <section class="vein"><div class="vread"><div class="vrate" data-tip-fn="qi"><span class="vlab">元气</span><b id="qiTxt">0</b><span id="sota" class="sota" data-tip="${esc(TXT.sota)}" hidden>SOTA</span></div><div class="vtot"><span id="totTxt"></span><button class="chip" data-act="src" id="srcTag"></button></div></div><div class="vsrc" id="srcRates" hidden></div></section>
  <div class="seg" id="demo">${[['coding', '写代码中'], ['rest', '停手休息']].map(([m, t]) => `<button data-act="demo" data-m="${m}">${t}</button>`).join('')}</div>
  <section class="home" id="home"></section>
  <section class="trip" id="trip"></section>
  <footer class="foot"><button data-act="duelInput">粘贴坐标码应战</button><button data-act="ghost">斗幽灵</button><button data-act="codex">蛊典</button><button data-act="path">道途</button><button data-act="ledger">履历</button><button data-act="reset" id="bReset">重开一局</button></footer>`;
}
function guCard(g, i, combos) {
  const c = combos && combos[i], nat = natOfG(g), f = g.food && FOOD[g.food];
  return `<button class="gu${i === 0 ? ' lead' : ''}" data-act="gu" data-i="${i}" data-uid="${g.uid}" data-drag="${i}" data-tip-fn="gu">
  <span class="art">${guSVG(g.sp, { rank: rankOf(g) })}</span><span class="rk rk${rankOf(g)}">${RANK.ch[rankOf(g)]}</span>${c ? `<span class="mseal">${esc(c.n[0])}</span>` : ''}
  <span class="nm">${SP[g.sp].n}</span><span class="st"><i class="a">${g.atk}</i><i class="h">${g.hp}</i></span>
  <span class="tr">${nat ? `<span class="tc nat">${esc(nat.ch)}</span>` : ''}${f ? `<span class="tc food">${esc(f.n[0])}</span>` : ''}${g.xing ? `<span class="tc xing">${esc(String(g.xing)[0])}</span>` : ''}</span></button>`;
}
function renderHome() {
  const box = $('#home'); if (!box) return;
  const t = tripOn();
  box.classList.toggle('away', t);
  box.innerHTML = `<div class="hhead"><span class="lbl" data-tip="${esc(TXT.daoTip)}">${S.dao ? TXT.daoLine(S.dao) : TXT.daoNone}</span><span id="reso" class="reso"></span></div>
  <section class="qiao" id="qiao"><div class="qhead"><span class="lbl">${TXT.slotsHead} <small>${TXT.slotsSub}</small></span><span class="qmeta">${S.team.length}/${slotCap(S.realm)}</span></div><div class="slots" id="slots"></div>
  <div class="bagline" id="bagline"></div></section>
  <ul class="hlog" id="hlog"></ul>
  ${t ? `<p class="hint">${TXT.inTrip}</p>` : S.compass ? compassHTML() : `<section class="shop" id="shop"></section>`}
  ${t ? '' : `<div class="gorow"><button class="zhu big go" data-act="go"${S.team.length ? '' : ' disabled'}>${TXT.go}<small>${TXT.goSub(S.team.length)}</small></button></div>`}`;
  renderSlots(); renderBagLine(); renderShop(); renderReso(); renderLog();
}
function renderSlots() {
  const box = $('#slots'); if (!box) return;
  const cap = slotCap(S.realm), n = Math.min(SLOTS, Math.max(S.team.length, cap)), combos = teamCombos(S.team);
  box.style.setProperty('--cn', Math.min(n, 7));
  box.innerHTML = Array.from({ length: n }, (_, i) => S.team[i] ? guCard(S.team[i], i, combos) : `<div class="gu empty" data-drag="${i}"><span>${i < cap ? '空' : '未开'}</span></div>`).join('');
  box.dataset.sort = 'team'; box.dataset.group = 'main';
}
function renderBagLine() {
  const b = $('#bagline'); if (!b) return;
  b.innerHTML = `<div class="bhead" data-tip-fn="bag"><span class="lbl">${TXT.bagHead} <small>${TXT.bagSub}</small></span><span class="qmeta">${S.bag.length}/${BC()}</span></div>
  <div class="mini bagrow" data-sort="bag" data-group="main">${Array.from({ length: BC() }, (_, i) => { const g = S.bag[i]; return g ? `<div class="mg" data-drag="${i}" data-act="bagGu" data-i="${i}" data-tip-fn="bg"><span class="art">${guSVG(g.sp, { rank: rankOf(g) })}</span><span class="rk rk${rankOf(g)}">${RANK.ch[rankOf(g)]}</span><b>${SP[g.sp].n}</b><span class="st"><i class="a">${g.atk}</i><i class="h">${g.hp}</i></span></div>` : `<div class="mg empty" data-drag="${i}"></div>`; }).join('')}</div>`;
}
function renderReso() {
  const r = $('#reso'); if (!r) return;
  const dc = daoCount(S.team).sort((a, b) => b.tier - a.tier || b.n - a.n);
  const on = dc.filter(x => x.tier);
  setHTML(r, on.length ? on.map(x => `<span class="ro on" data-tip="${esc(`${DAO[x.dao].n}：空窍里 ${x.n} 只。2 只：${DAO[x.dao].r2.d}；4 只：${DAO[x.dao].r4.d}`)}">${DAO[x.dao].n}${x.n} · ${esc(x.eff.d)}</span>`).join('') : `<span class="ro">${esc(TXT.resoNone)}</span>`);
}
// ---------- 罗盘：回到洞府时三选一主道 ----------
function rollCompass() { const r = R(), ids = DAOS.map(d => d.id), out = []; while (out.length < 3 && ids.length) out.push(ids.splice(r.int(ids.length), 1)[0]); S.compass = out; }
function compassHTML() {
  return `<section class="compass2"><div class="ch"><span class="lbl">${TXT.compassHead}</span></div><p class="sm">${TXT.compassSub}</p><div class="dopts">${S.compass.map(id => { const d = DAO[id], sp = shopSpeciesOf(id); return `<button class="dopt" data-act="dao" data-d="${id}"><b>${d.n}</b><small>${esc(d.d)}</small><span class="dsp">${sp.slice(0, 4).map(x => `<i>${guSVG(x)}</i>`).join('')}</span><em>共鸣：${esc(d.r2.d)}</em></button>`; }).join('')}</div></section>`;
}
const shopSpeciesOf = d => poolFor(S.realm).filter(sp => SP[sp] && !SP[sp].immortal && daoOf(sp) === d && unlocked(sp, 'species'));
// ---------- 蛊市 ----------
function newShop() { S.shop = rollShop(R(), S.realm, S.dao, S.shop, unlocked); }
const owned = sp => [...S.team, ...S.bag].filter(g => g.sp === sp && rankOf(g) === baseRank(sp)).length;
function wareHTML(w, i) {
  if (w.kind === 'food') {
    const f = FOOD[w.id], c = price(foodCost(w.id));
    return `<div class="ware food${w.frozen ? ' frozen' : ''}${w.sold ? ' sold' : ''}"><button class="wbuy" data-act="ware" data-i="${i}" data-tip-fn="ware"${w.sold ? ' disabled' : ''}><span class="fart">${esc(f.n[0])}</span><b>${esc(f.n)}</b><small>${FOOD_KIND[f.kind]}</small><span class="tag">${w.sold ? '已购' : fmtTok(c)}</span></button></div>`;
  }
  const s = SP[w.sp], st = statFor(w.sp, baseRank(w.sp)), c = price(PRICE.gu), merge = !w.sold && owned(w.sp) >= 2;
  return `<div class="ware${w.frozen ? ' frozen' : ''}${w.sold ? ' sold' : ''}${merge ? ' merge' : ''}"><button class="wbuy" data-act="ware" data-i="${i}" data-tip-fn="ware"${w.sold ? ' disabled' : ''}><span class="art">${guSVG(w.sp)}</span><b>${s.n}</b><span class="st"><i class="a">${st.atk}</i><i class="h">${st.hp}</i></span><span class="tag">${w.sold ? '已购' : (merge ? '合成 · ' : '') + fmtTok(c)}</span>${merge ? '<span class="fu">可合成</span>' : ''}</button></div>`;
}
function renderShop() {
  const box = $('#shop'); if (!box) return;
  if (!S.shop.length) newShop();
  box.innerHTML = `<div class="shead"><span class="lbl" data-tip="${esc(TXT.shopTip)}">${TXT.shopHead}</span><button class="mini-b" data-act="refresh">${TXT.refresh(fmtTok(price(PRICE.refresh)))}</button></div>
  <div class="wares">${S.shop.map(wareHTML).join('')}</div>${S.pantry.length ? `<div class="pantry"><span class="lbl">带回的食物</span>${S.pantry.map((id, i) => `<button class="pfood" data-act="pantry" data-i="${i}" data-tip="${esc(FOOD[id] ? FOOD[id].d : '')}">${esc(FOOD[id] ? FOOD[id].n : id)}</button>`).join('')}</div>` : ''}${S.tripFood.length ? `<p class="sm">下一次出征带着：${S.tripFood.map(id => FOOD[id] ? FOOD[id].n : id).join('、')}</p>` : ''}`;
}
// 新得一只蛊：能合成先合成；蛊市买的先进空窍再进蛊囊；战利品只进蛊囊
function placeNew(g, mode = 'shop') {
  const r = placeGu(S.team, S.bag, g, curCap(), BC(), mode);
  if (!r.where) return false;
  if (r.where === 'bag' && !r.merged.length) note(TXT.toBag(g));
  r.merged.forEach(x => { note(TXT.merge(x)); achieve('merges', 1); });
  afterChange(r.merged);
  return true;
}
// 阵容变了：重画；新成形的杀招第一次出现时全屏；合成播升转演出
function afterChange(merged = []) {
  renderHome(); save();
  const combos = teamCombos(S.team), seen = S.combosSeen || (S.combosSeen = []);
  Object.entries(combos).forEach(([i, c]) => { if (!seen.includes(c.id)) { seen.push(c.id); big('combo', TXT.comboFirst(c), TXT.comboLines(c, S.team[i])); achieve('combos', 1); } });
  merged.forEach(x => { const n = document.querySelector(`.gu[data-uid="${x.uid}"]`); if (n) { try { fuseRankUp(n, { sp: x.sp, from: rankOf(x) - 1, to: rankOf(x), calm: !!S.calm }); } catch (e) {} } });
  floorCheck();
}
// 保底：洞府里一只蛊都没有时，免费领一只一转蛊
function floorCheck() {
  if (S.team.length || S.bag.length || tripOn() || !S.started) return;
  const pool = poolFor(0).filter(sp => unlocked(sp, 'species')), g = newGu(R().pick(pool), 1);
  S.team.push(g); note(TXT.floor(g)); renderHome(); save();
}
// ---------- 食物 ----------
let FEED = null;   // 正在挑目标的食物 { id, from: 'shop'|'pantry', i }
function useFood(id, from, i) {
  const f = FOOD[id]; if (!f) return false;
  if (f.kind === 'trip') { S.tripFood.push(id); note(TXT.tripFood(f)); achieve('feeds', 1); return true; }
  if (f.kind === 'stat' && f.to !== 'one') {
    if (!S.team.length) return false;
    const r = R(), tg = f.to === 'all' ? S.team.slice() : S.team.slice().sort(() => r() - 0.5).slice(0, 2);
    feedStat(id, tg); note(TXT.fed(f, tg)); tg.forEach(g => fxFloat(g.uid, `+${f.atk || 0}/+${f.hp || 0}`, 'buff')); achieve('feeds', 1); return true;
  }
  FEED = { id, from, i };
  sheet(`<h3>${esc(f.kind === 'gear' ? TXT.gearPick(f) : TXT.foodPick(f))}</h3><p class="sm">${esc(f.d)}</p><div class="mini pick">${[...S.team, ...S.bag].map((g, k) => `<button class="mg" data-act="feedTo" data-k="${k}"><span class="art">${guSVG(g.sp, { rank: rankOf(g) })}</span><b>${SP[g.sp].n}</b><span class="st"><i class="a">${g.atk}</i><i class="h">${g.hp}</i></span>${g.food ? `<small>挂着${esc(FOOD[g.food] ? FOOD[g.food].n : '')}</small>` : ''}</button>`).join('')}</div>`);
  return null;   // 等玩家挑
}
function feedTo(g) {
  const f = FEED && FOOD[FEED.id]; if (!f || !g) return;
  const fr = FEED; FEED = null;
  if (fr.from === 'shop') { const w = S.shop[fr.i]; if (!w || w.sold || !pay(foodCost(w.id))) { closeSheet(); return; } w.sold = true; w.frozen = false; }
  else S.pantry.splice(fr.i, 1);
  if (f.kind === 'gear') { g.food = f.id; note(TXT.geared(f, g)); }
  else { feedStat(f.id, [g]); note(TXT.fed(f, [g])); }
  achieve('feeds', 1); closeSheet(); renderHome(); save(); fxFloat(g.uid, f.kind === 'gear' ? f.n : `+${f.atk || 0}/+${f.hp || 0}`, 'buff');
}
// ---------- 出征（秘境由另一侧实现，见 hooks.js）----------
function goSheet() {
  sheet(`<h3>${TXT.go}</h3><p>${esc(TXT.goSub(S.team.length))}：</p>${miniRow(S.team)}<p class="trialnote">${esc(TXT.goWarn)}</p><p class="sm">攒着的元气 ${fmtTok(S.bank)}：出征时先用它一口气往深处走。</p><div class="row2"><button class="zhu big" data-act="goConfirm">确认出征</button></div>`);
}
function onTripEnd(result = {}) {
  const dead = new Set(result.dead || []), loot = result.loot || {};
  const lost = S.team.filter(g => dead.has(g.uid));
  S.team = S.team.filter(g => !dead.has(g.uid));
  lost.forEach(g => note(`${rankName(g)} 倒在了秘境里`));
  if (!result.wiped) {
    (loot.foods || []).forEach(id => { if (FOOD[id]) S.pantry.push(id); });
    (loot.gu || []).forEach(g => { const n = g && SP[g.sp] ? newGu(g.sp, rankOf(g)) : null; if (n && g.xing) n.xing = g.xing; if (n && !placeNew(n, 'bag')) note(`${rankName(n)} 没地方放，留在了秘境`); });
    if ((loot.foods || []).length || (loot.gu || []).length) note(`带回战利品：${[...(loot.gu || []).map(g => SP[g.sp] ? SP[g.sp].n : ''), ...(loot.foods || []).map(id => FOOD[id] ? FOOD[id].n : '')].filter(Boolean).join('、')}`);
  } else note('全灭：这次的战利品全部丢失');
  S.trip = null; S.tripFood = [];
  achieve('trips', 1);
  if (result.cleared && S.realm < 5) { S.realm++; big('trib', TXT.trib(S.realm), TXT.tribLines(S.realm)); achieve('realm', S.realm, { set: true }); achieve('clears', 1); }
  rollCompass(); S.shop = S.shop.filter(w => w.frozen && !w.sold);
  renderAll(); save(); floorCheck();
}
// 给秘境复用的战斗回放：返回 Promise<{ res, A, B }>
function tripPlayBattle(foeTeam, opts = {}) {
  const team = opts.team || S.team, seed = opts.seed || ((S.seed ^ Math.imul(++S.step, 2654435761)) >>> 0).toString(36);
  const sota = { A: sotaOn(), B: false };
  const res = battle(team, foeTeam, 'r:' + seed, { ...(opts.oa || {}), sota }, opts.ob || {});
  const A = { team, name: S.name || '无名蛊师', realm: S.realm, trial: S.trial }, B = { team: foeTeam, name: opts.foeName || '秘境', realm: S.realm };
  return new Promise(resolve => playBattle({ kind: 'trip', title: opts.title || '秘境 · 斗蛊', res, A, B, sota, done: () => resolve({ res, A, B }) }));
}
TRIP.api = { S: () => S, save, get el() { return $('#trip'); }, playBattle: tripPlayBattle, onTripEnd, big, note, float: (uid, t, k) => fxFloat(uid, t, k || 'buff'), renderHome };
function meters() {
  if (!S.started) return;
  const q = $('#qiTxt'); if (!q) return;
  q.textContent = fmtTok(S.bank);
  const so = $('#sota'); if (so) so.hidden = !sotaOn();
  $('#totTxt').innerHTML = `元气 +<b>${rate > 0 ? fmtTok(rate) : 0}</b>/s · 今日 <b>${fmtTok(S.todayKey === today() ? S.todayTok : 0)}</b>`;
  const sr = $('#srcRates'), sl = srcList(bySrc); sr.hidden = sl.length < 2;
  if (sl.length >= 2) setHTML(sr, sl.map(x => `<span class="schip${x.rate > 0 ? '' : ' off'}">${esc(x.name)} <b>${fmtTok(x.rate)}/s</b></span>`).join(''));
  const st = $('#srcTag'); st.textContent = VSC ? TXT.srcLive : TXT.srcDemo; st.classList.toggle('demo', !VSC);
  const dm = $('#demo'); dm.hidden = !!VSC || src.mode !== 'demo'; dm.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === src.demo));   // 插件里永远不显示模拟开关
  document.querySelectorAll('.wbuy .tag').forEach(t => { const w = S.shop[+t.closest('.wbuy').dataset.i]; if (w && !w.sold) t.classList.toggle('poor', S.bank < price(w.kind === 'food' ? foodCost(w.id) : PRICE.gu)); });
}
// ---------- 主题：自动跟随系统 / VS Code，或手动日、夜 ----------
let veinRGB = '111,183,164';
function applyTheme() {
  const pref = S.theme || 'auto'; let t = pref;
  if (pref === 'auto') {
    const b = document.body ? document.body.classList : { contains: () => false };
    t = VSC ? ((b.contains('vscode-light') || b.contains('vscode-high-contrast-light')) ? 'light' : 'dark') : (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  }
  document.documentElement.dataset.theme = t; veinRGB = t === 'light' ? '44,110,94' : '111,183,164';
  applyCalm();
}
if (window.matchMedia) { const mq = matchMedia('(prefers-color-scheme: light)'); if (mq.addEventListener) mq.addEventListener('change', applyTheme); }
// ---------- 灵脉（青绿字符流）----------
const VP = []; let vLast = 0, vAcc = 0;
function veinLoop(ts) {
  requestAnimationFrame(veinLoop);
  const cv = $('#vein'); if (!cv) return;
  const dt = Math.min(0.05, (ts - vLast) / 1000 || 0); vLast = ts;
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const lvl = rate > 0 ? Math.min(1, rate / (src.hotTh * 1.3)) : 0;
  vAcc += (rate > 0 ? 5 + 55 * lvl : 0) * dt;
  while (vAcc >= 1) { vAcc--; VP.push({ x: -8, y: 4 + Math.random() * Math.max(8, h - 10), c: '0123456789abcdef{}<>=;:/'[(Math.random() * 24) | 0], a: 0.25 + Math.random() * 0.6, z: hot && Math.random() < 0.18, v: 0.7 + Math.random() * 0.6 }); }
  const sp = 24 + 170 * lvl;
  ctx.font = '10px ui-monospace,Menlo,monospace';
  for (let i = VP.length - 1; i >= 0; i--) {
    const p = VP[i]; p.x += sp * p.v * dt + (rate > 0 ? 0 : 6 * dt);
    if (p.x > w + 10) { VP.splice(i, 1); continue; }
    ctx.fillStyle = p.z ? `rgba(200,70,48,${p.a})` : `rgba(${veinRGB},${p.a})`; ctx.fillText(p.c, p.x, p.y + 4);
  }
  ctx.fillStyle = `rgba(${veinRGB},.18)`; ctx.fillRect(0, h - 1, w, 1);
}

// ---------- 浮字、印章、震屏 ----------
function fxFloat(uid, txt, k, blk) {
  const n = document.querySelector(`[data-uid="${uid}"]`); if (!n || (!txt && !blk)) return;
  const r = n.getBoundingClientRect();
  const f = el(`<span class="float ${k || ''}">${esc(txt)}${blk ? `<em>挡${blk}</em>` : ''}</span>`);
  f.style.left = (r.left + r.width / 2 + (Math.random() * 16 - 8)) + 'px'; f.style.top = (r.top + r.height * 0.35) + 'px';
  f.style.setProperty('--rot', (Math.random() * 14 - 7).toFixed(1) + 'deg');
  document.body.appendChild(f); setTimeout(() => f.remove(), 1100);
}
function stampIn(host, text, big, cls = '') {
  if (!host) return;
  const s = el(`<div class="stamp ${big ? 'big' : ''} ${cls}"><span>${esc(text)}</span></div>`);
  host.appendChild(s); setTimeout(() => s.classList.add('out'), big ? 1150 : 1500); setTimeout(() => s.remove(), big ? 1600 : 2000);
}
function shake(px) { if (S.calm) px = Math.min(px, 1.5); const a = $('#arena'); if (a) a.animate([{ transform: 'none' }, { transform: `translate(${px}px,${-px / 2}px)` }, { transform: `translate(${-px}px,${px / 3}px)` }, { transform: `translate(${px / 2}px,0)` }, { transform: 'none' }], { duration: 240 }); }
function buHTML(uid, r) {
  const k = r.tr ? Object.keys(r.tr)[0] : null, t = k && TRAITS[k];
  return `<div class="bu${r.side ? ' foe' : ''}${r.boss ? ' boss' : ''}" data-uid="${uid}"><div class="bart">${guSVG(r.sp)}</div><div class="binfo"><b class="bnm">${esc(r.name)}</b><span class="bst"><i class="a"></i><i class="h"></i><i class="s" hidden></i></span><span class="btr">${t ? `<span class="tc nat">${esc(t.ch)}</span>` : ''}</span>${r.combo ? `<em class="cs">${esc(r.combo)}</em>` : ''}</div></div>`;
}
function applySnap(s, ros) {
  const first = new Map(); document.querySelectorAll('#arena .bu').forEach(n => first.set(n.dataset.uid, n.getBoundingClientRect()));
  [0, 1].forEach(side => {
    const box = side ? $('#sideB') : $('#sideA'), ids = s[side].map(x => x[0]);
    box.querySelectorAll('.bu').forEach(n => { if (!ids.includes(n.dataset.uid)) n.remove(); });
    s[side].forEach(([uid, a, h, sh], i) => {
      let n = box.querySelector(`[data-uid="${uid}"]`);
      if (!n) { n = el(buHTML(uid, ros[uid])); if (booted && inBattle && first.size) n.classList.add('born'); }
      if (box.children[i] !== n) box.insertBefore(n, box.children[i] || null);
      n.querySelector('.a').textContent = a; n.querySelector('.h').textContent = h;
      const sn = n.querySelector('.s'); sn.textContent = sh || ''; sn.hidden = !sh;
    });
  });
  document.querySelectorAll('#arena .bu').forEach(n => {
    const r0 = first.get(n.dataset.uid); if (!r0) return; const r1 = n.getBoundingClientRect(), dx = r0.left - r1.left, dy = r0.top - r1.top;
    if (Math.abs(dx) + Math.abs(dy) > 2) n.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 280 / S.speed, easing: 'cubic-bezier(.2,.8,.2,1)' });
  });
}
const bnode = uid => document.querySelector(`#arena [data-uid="${uid}"]`);
function blog(t) { const b = $('#blog'); if (b) b.textContent = t; }
let tempo = 1, chain = { side: -1, n: 0 }, finalBlow = null, dispK = 1;
function showChain(n, side) {
  const a = $('#arena'); if (!a) return; const old = a.querySelector('.chain'); if (old) old.remove();
  const c = el(`<span class="chain ${side ? 'foe' : ''}" style="font-size:${Math.min(64, 30 + n * 4)}px">${n} 连！</span>`); a.appendChild(c); setTimeout(() => c.remove(), 900);
  snd('tick');
}
// 杀招招牌演出：宣纸横幅滑入、招名逐字落墨、朱印砸下、轻震屏
async function comboCut(name, node, r) {
  const total = EV_MS.combo * tempo / S.speed, chars = [...name];
  if (node) node.classList.add('caster');
  const cut = el(`<div class="cut" style="--d:${(total / 1000).toFixed(2)}s"><div class="band"><span class="cby">${esc(r ? r.name : '')} · 杀招</span><span class="cname">${chars.map((c, i) => `<i style="animation-delay:${Math.round(total * (0.14 + i * 0.07))}ms">${esc(c)}</i>`).join('')}</span></div><span class="cseal" style="animation-delay:${Math.round(total * (0.18 + chars.length * 0.07))}ms"><b>${esc(chars[0])}</b></span><span class="ink" style="animation-delay:${Math.round(total * (0.18 + chars.length * 0.07))}ms"></span></div>`);
  $('#battle').appendChild(cut); snd('combo');
  await sleep(total * (0.2 + chars.length * 0.07)); shake(9); snd('hit');
  await sleep(total * (0.8 - chars.length * 0.07)); cut.classList.add('out'); if (node) node.classList.remove('caster');
  setTimeout(() => cut.remove(), 400);
}
const STATUS_N = { psn: '中毒', para: '寄生', stun: '定身', web: '落网', miss: '扑空', swap: '换位', strip: '破甲', tie: '系丝', blitz: '疾袭', luck: '鸿运', hex: '夺志' };
async function animEv(e, ros, seen) {
  const D = ms => sleep(ms * tempo / S.speed), nm = uid => ros[uid] ? ros[uid].name : '';
  switch (e.t) {
    case 'begin': blog('开战：双方开锋、护体先行'); return D(EV_MS.begin);
    case 'turn': $('#bturn').textContent = `第 ${e.n} 合`; return D(EV_MS.turn);
    case 'clash': {
      const a = bnode(e.a), b = bnode(e.b); if (!a || !b) return;
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(), dx = (rb.left - ra.left) / 2, dy = (rb.top - ra.top) / 2, dur = EV_MS.clash * tempo / S.speed;
      const kf = (x, y) => [{ transform: 'none' }, { transform: `translate(${-x * 0.14}px,${-y * 0.14}px) scale(.95)`, offset: 0.42 }, { transform: `translate(${x * 0.72}px,${y * 0.72}px)`, offset: 0.62 }, { transform: 'none' }];
      a.animate(kf(dx, dy), { duration: dur, easing: 'ease-in-out' }); b.animate(kf(-dx, -dy), { duration: dur, easing: 'ease-in-out' });
      blog(`${nm(e.a)} ⟷ ${nm(e.b)}`);
      await sleep(dur * 0.62); shake(3); snd('hit'); await sleep(dur * 0.38); return;
    }
    case 'dmg': {
      fxFloat(e.uid, e.n > 0 ? (e.crit ? '暴 ' : '') + '-' + fmtNum(e.n * dispK) : '', e.crit ? 'dmg crit' : e.k === 'skill' ? 'dmg skill' : 'dmg', e.blk ? fmtNum(e.blk * dispK) : 0);
      const n = bnode(e.uid); if (n) { n.classList.remove('hit'); void n.offsetWidth; n.classList.add('hit'); }
      if (e.crit) { shake(5); snd('clack'); }
      if (e.src >= 0 && e.n > 0) { chain = chain.side === e.src ? { side: e.src, n: chain.n + 1 } : { side: e.src, n: 1 }; if (chain.n >= 3) showChain(chain.n, e.src); }
      return D(e.k === 'hit' ? EV_MS.hit : EV_MS.dmg);
    }
    case 'buff': fxFloat(e.uid, e.sh ? `护+${e.sh}` : e.a < 0 ? `${e.a} 攻` : `+${e.a}/+${e.h}`.replace('/+0', '').replace('+0/', ''), e.a < 0 ? 'dmg' : 'buff'); return D(EV_MS.buff);
    case 'status': { const lab = STATUS_N[e.k]; if (lab) { fxFloat(e.uid, lab, 'dmg skill'); blog(`${nm(e.uid)} · ${lab}`); } return D(EV_MS.status); }   // 蛊典扩充的状态：中毒/寄生/定身/落网/扑空/换位/破甲/系丝
    case 'trig': {
      const t = e.id && TRAITS[e.id], lab = t ? t.n : (e.id || ''), ch = t ? t.ch : '技';
      const n = bnode(e.uid); if (n) { const g = el(`<span class="tg">${esc(ch)}</span>`); n.appendChild(g); setTimeout(() => g.remove(), 700); }
      blog(`${nm(e.uid)} · ${lab}`); return D(EV_MS.trig);
    }
    case 'combo': {
      const n = bnode(e.uid);
      if (e.quiet || seen.has(e.uid)) { if (n) { const g = el(`<span class="tg zhu">${esc(e.n[0])}</span>`); n.appendChild(g); setTimeout(() => g.remove(), 700); } return D(EV_MS.comboQuiet); }
      seen.add(e.uid); blog(`杀招【${e.n}】`);
      return comboCut(e.n, n, ros[e.uid]);
    }
    case 'summon': { if (e.rewind) { const n = bnode(e.uid); if (n) n.classList.remove('die'); blog(`${nm(e.uid)} 随光阴倒回`); return D(EV_MS.summon); } blog(`${nm(e.uid)} 现身`); return D(EV_MS.summon); }
    case 'faint': {
      const n = bnode(e.uid);
      if (e === finalBlow && n) {   // 斩杀特写：慢放、墨迹炸开
        const r = n.getBoundingClientRect(), ink = el('<span class="inkburst"></span>'); ink.style.left = (r.left + r.width / 2) + 'px'; ink.style.top = (r.top + r.height / 2) + 'px';
        document.body.appendChild(ink); setTimeout(() => ink.remove(), 1400); $('#arena').classList.add('slowmo'); shake(10); snd('combo');
        blog(`斩 · ${nm(e.uid)}`); n.classList.add('die'); await sleep(400 + EV_MS.faint * tempo / S.speed); $('#arena').classList.remove('slowmo'); return;
      }
      if (n) n.classList.add('die'); blog(`${nm(e.uid)} 阵亡`); snd('faint'); return D(EV_MS.faint);
    }
    case 'end': return D(EV_MS.end);
  }
}

async function playBattle(B) {
  inBattle = true; skip = false;
  const ov = el(`<div class="battle" id="battle"><div class="bbar"><span class="btitle">${esc(B.title)}${trialTag((B.A && B.A.trial) || (B.B && B.B.trial))}</span><span class="bturn" id="bturn">开战</span><button class="ib" data-act="speed" id="bspd">${S.speed}×</button><button class="ib" data-act="skip">跳过</button></div>
  <div class="arena" id="arena"><div class="side sb" id="sideB"></div><div class="mid"><i></i><span>斗</span><i></i></div><div class="side sa" id="sideA"></div></div><div class="blog" id="blog"></div></div>`);
  ov.style.setProperty('--nu', Math.max(10, (B.A.team || []).length + (B.B.team || []).length)); document.body.appendChild(ov);
  const log = B.res.log, ros = B.res.roster, seen = new Set(); tempo = tempoFor(playMs(log)); chain = { side: -1, n: 0 };
  finalBlow = B.res.winner === 'draw' ? null : [...log].reverse().find(e => e.t === 'faint') || null;
  applySnap(log[0].s, ros);
  for (const e of log) { if (skip) break; await animEv(e, ros, seen); if (skip) break; applySnap(e.s, ros); }
  applySnap(log[log.length - 1].s, ros);
  showResult(B);
}
// 结算：停住等玩家点（切磋不给东西、不死蛊；秘境的生死由秘境一侧结算）
function showResult(B) {
  const w = B.res.winner, win = w === 'A', draw = w === 'draw';
  window.__guB = B;
  const head = draw ? '平手' : win ? '胜' : '负';
  const sub = B.kind === 'trip' ? '' : B.kind === 'replay' ? '复盘结束' : TXT.spar;
  const box = el(`<div class="result ${draw ? 'draw' : win ? 'win' : 'lose'}"><b class="rh">${head}</b><p class="sm">${esc(sub)}</p><div class="rbtns"><button class="zhu" data-act="closeBattle">${B.kind === 'trip' ? '继续' : '关闭'}</button>${B.kind !== 'trip' && B.replay ? '<button data-act="copyReplay">复制复盘链接</button>' : ''}</div></div>`);
  $('#battle').appendChild(box);
}
function closeBattle() { const b = $('#battle'); if (b) b.remove(); inBattle = false; const B = window.__guB; window.__guB = null; if (B && B.done) B.done(); renderAll(); }

// ---------- 斗幽灵、战帖：随时能打，纯切磋 ----------
function sotaFlag(s) { return (s.A ? 1 : 0) + (s.B ? 2 : 0); }
function spar(kind, foe) {
  if (inBattle) return;
  const mine = S.team.length ? S.team : starterTeam();
  const ca = encodeTeam(mine, { name: S.name || '无名蛊师', realm: S.realm, trial: S.trial }), cb = encodeTeam(foe.team, { name: foe.name, realm: foe.realm || S.realm, trial: !!foe.trial });
  const seed = kind === 'duel' ? (hashStr(ca + '|' + cb) >>> 0).toString(36) : ((S.seed ^ Math.imul(++S.step, 2654435761)) >>> 0).toString(36);
  const A = decodeTeam(ca), Bt = decodeTeam(cb), sota = { A: sotaOn(), B: false };
  const res = battle(A.team, Bt.team, 'r:' + seed, { sota }, {});
  save(); playBattle({ kind, title: (kind === 'duel' ? '战帖 · ' : '幽灵 · ') + (foe.name || '无名'), res, A, B: Bt, sota, replay: [ca, cb, seed, kind[0], 's' + sotaFlag(sota)].join('.') });
}
function openGhosts() {
  if (!S.ghosts || S.ghosts.realm !== S.realm) { S.ghosts = { realm: S.realm, list: ghostTrio(R(), S.realm).map(o => ({ tier: o.tier, label: o.label, name: o.name, code: encodeTeam(o.team, { name: '幽灵·' + o.name, realm: S.realm }) })) }; save(); }
  sheet(`<h3>斗幽灵</h3><p class="sm">${TXT.spar}。阵容摆在明面上，打完能复制复盘链接。</p>${S.ghosts.list.map((o, i) => { const d = decodeTeam(o.code); return `<div class="foeopt"><div class="fh"><b class="tier t-${o.tier}">${o.label}</b><span class="fn">${esc(o.name)}</span></div>${miniRow(d.team)}<button class="zhu" data-act="ghostGo" data-i="${i}">切磋</button></div>`; }).join('')}<div class="row2"><button data-act="ghostNew">换一批</button></div>`);
}
function parseReplay(text) {
  const m = String(text || '').match(/r=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([0-9a-z]+)(?:\.([tgd]))?(?:\.s([0-3]))?/); if (!m) return null;
  const A = decodeTeam(m[1]), B = decodeTeam(m[2]); if (!A || !B) return null;
  const f = +(m[5] || 0), sota = { A: !!(f & 1), B: !!(f & 2) };
  return { A, B, seed: m[3], kind: m[4] || 'd', sota, replay: [m[1], m[2], m[3], m[4] || 'd', 's' + f].join('.') };
}
function openReplay(rp) {
  window.__guRp = rp;
  sheet(`<p class="eyebrow">复盘</p><h3 class="duelh">${esc(rp.B.name || '无名')}${trialTag(rp.B.trial)} 对 ${esc(rp.A.name || '无名')}${trialTag(rp.A.trial)}</h3><p class="sm">同一组阵容、同一颗种子，重放的是一模一样的那一场。${rp.sota.A || rp.sota.B ? '（这一场有 SOTA）' : ''}</p>${miniRow(rp.B.team)}<p class="vsline">— 对 —</p>${miniRow(rp.A.team)}<div class="row2"><button class="zhu big" data-act="replayGo">观看复盘</button></div>`);
}
function openLinkText(text) {
  const rp = parseReplay(text); if (rp) { openReplay(rp); return true; }
  const foe = decodeTeam(text); if (foe) { openDuel(foe); return true; }
  return false;
}
const SHARE_BASE = 'https://1596941391qq.github.io/gu-code/';
const INSTALL_URL = 'https://github.com/1596941391qq/gu-code#安装插件获取真实-token-消耗';
const baseURL = () => (/^https?:/.test(location.protocol) ? location.origin + location.pathname : SHARE_BASE);
function replayURL(link) { return baseURL() + '#r=' + link; }
function shareURL(code) { return baseURL() + '#c=' + code; }
function shareText(code) { return `${S.trial ? TXT.trialText : ''}我在《蛊码》养了一窝蛊（${REALMS[S.realm]}），敢接战帖吗？\n界壁坐标码：${code}`; }
function myCode() { return encodeTeam(S.team.length ? S.team : starterTeam(), { name: S.name, realm: S.realm, trial: S.trial }); }
let cardURL = '';
async function openShare() {
  const code = myCode(), url = shareURL(code);
  sheet(`<h3>界壁坐标码${trialTag(S.trial)}</h3>${S.trial ? `<p class="trialnote">${TXT.trialShare}</p>` : ''}<p class="sm">发给朋友。对方打开链接，或在蛊码里粘贴坐标码，就会和你空窍里这支阵容切磋。</p>
  <label class="row"><span>蛊师名号</span><input id="nm" maxlength="8" value="${esc(S.name)}" placeholder="无名蛊师"></label>
  <div class="code" id="codeTxt">${code}</div>
  <div class="row2"><button data-act="copyCode">复制坐标码</button><button data-act="copyLink">复制战帖链接</button></div>
  <div class="cardbox"><img id="cardImg" alt="分享卡"><div class="row2"><button class="zhu" data-act="savePng">保存分享卡 PNG</button></div><p class="sm">${VSC ? '' : '手机上可长按图片保存。'}</p></div>`);
  $('#nm').addEventListener('change', e => { S.name = e.target.value.trim().slice(0, 8); save(); openShare(); });
  cardURL = ''; const img = $('#cardImg');
  try { cardURL = await makeCard({ team: S.team.length ? S.team : starterTeam(), name: S.name, realm: S.realm, total: S.total, code, url, trial: S.trial }); if (img) img.src = cardURL; } catch (e) { if (img) img.alt = '分享卡生成失败'; }
}
function openDuelInput() {
  sheet(`<h3>应战</h3><p class="sm">粘贴朋友发来的界壁坐标码、战帖链接或复盘链接。</p><textarea id="duelIn" rows="3" placeholder="坐标码"></textarea><p class="err" id="duelErr"></p><div class="row2"><button class="zhu" data-act="duelGo">查看战帖</button></div>`);
  setTimeout(() => { const t = $('#duelIn'); if (t) t.focus(); }, 50);
}
function openDuel(foe) {
  if (!foe) return; window.__guFoe = foe;
  const mine = S.team.length ? S.team : starterTeam();
  sheet(`<p class="eyebrow">界壁震动</p><h3 class="duelh">有人向你下战帖${trialTag(foe.trial)}</h3><p class="sm">来自 <b>${esc(foe.name || '无名蛊师')}</b> · ${REALMS[foe.realm] || '凡人'}${foe.old ? ' · 旧版坐标码（只认物种和转数）' : ''}</p>${foe.trial ? `<p class="trialnote">${TXT.trialFoe}</p>` : ''}${miniRow(foe.team)}
  <p class="vsline">— 你的${S.team.length ? '空窍' : '初始阵容'} —</p>${miniRow(mine)}<p class="sm">${TXT.spar}</p><div class="row2"><button class="zhu big" data-act="duelFight">应战</button></div>`);
}
function checkHash() {
  const h = location.hash; if (!/[#&](c|r)=/.test(h)) return;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  openLinkText(h);
}
function copy(text, btn) {
  const done = () => { if (btn) { const o = btn.textContent; btn.textContent = '已复制'; setTimeout(() => { btn.textContent = o; }, 1200); } };
  if (VSC) { VSC.postMessage({ type: 'copy', text }); return done(); }
  const fb = () => { const t = el('<textarea></textarea>'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} t.remove(); done(); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fb); else fb();
}

// ---------- 弹层（只由玩家点击打开）----------
function sheet(html, cls = '', stack = false) {
  if (!stack) document.querySelectorAll('.sheet-bg').forEach(n => n.remove());
  const bg = el(`<div class="sheet-bg${stack ? ' stack' : ''}" data-act="closeSheetBg"><div class="sheet ${cls}" role="dialog"><button class="x" data-act="closeSheet" aria-label="关闭">×</button>${html}</div></div>`);
  document.body.appendChild(bg); return bg.querySelector('.sheet');
}
function closeSheet() { const a = document.querySelectorAll('.sheet-bg'); if (a.length) a[a.length - 1].remove(); }
function miniRow(t) { return `<div class="mini">${t.map(g => `<div class="mg${g.boss ? ' boss' : ''}"><span class="art">${guSVG(g.sp, { rank: rankOf(g) })}</span><span class="rk rk${rankOf(g)}">${RANK.ch[rankOf(g)]}</span><b>${SP[g.sp] ? SP[g.sp].n : ''}</b><span class="st"><i class="a">${g.atk}</i><i class="h">${g.hp}</i></span></div>`).join('')}</div>`; }
function guDetail(g, ctx = {}) {
  const s = SP[g.sp], nat = natOfG(g), team = ctx.kind === 'team' ? S.team : null, i = ctx.i | 0, c = team ? teamCombos(team)[i] : null, f = g.food && FOOD[g.food];
  const recipes = COMBOS.filter(x => x.need.includes(g.sp));
  sheet(`<div class="detail"><div class="dart">${guSVG(g.sp, { rank: rankOf(g) })}</div><div><h3>${rankName(g)}</h3><p class="lore">${esc(s.lore)}</p><p class="dst"><i class="a">${g.atk}</i><i class="h">${g.hp}</i> <small>${DAO[daoOf(g.sp)] ? DAO[daoOf(g.sp)].n : ''}</small></p></div></div>
  ${nat ? `<h4>本命技</h4><p><b>${esc(nat.n)}</b> ${esc(nat.d)}</p><p class="sm">三转、五转各觉醒一次${nat.aw ? `（已觉醒 ${nat.aw} 次）` : ''}</p>` : ''}
  ${c ? `<h4>杀招</h4><div class="skill"><span class="seal">${esc(c.n)}</span><p>${esc(c.d)}<br><small>配方：${c.need.map(x => SP[x].n).join(' + ')}</small></p></div>` : ''}
  ${f ? `<h4>挂件</h4><p><b>${esc(f.n)}</b> ${esc(f.d)}</p>` : ''}
  ${g.xing ? `<h4>蛊性</h4><p>${esc(String(g.xing))}</p>` : ''}
  ${recipes.length ? `<h4>能凑的杀招</h4><ul>${recipes.map(x => `<li><b>${esc(x.n)}</b> ${x.need.map(y => SP[y].n).join(' + ')}</li>`).join('')}</ul>` : ''}
  ${ctx.kind === 'team' || ctx.kind === 'bag' ? `<div class="row2">${ctx.kind === 'team' ? `<button data-act="toBag" data-i="${i}"${S.bag.length < BC() && !tripOn() ? '' : ' disabled'}>收进蛊囊</button>` : `<button class="zhu" data-act="fromBag" data-i="${i}"${S.team.length < curCap() && !tripOn() ? '' : ' disabled'}>上场</button>`}<button data-act="sell" data-k="${ctx.kind}" data-i="${i}"${tripOn() ? ' disabled' : ''}>卖出 · 退回 ${fmtTok(price(sellValue(g)))}</button></div>` : ''}`);
}
function openCodex() {
  const have = S.team.map(g => g.sp);
  sheet(`<h3>蛊典</h3><p class="sm">见过 ${Object.keys(S.codex).length} / ${SPECIES.length} 种。</p>
  <h4>杀招配方</h4><ul class="recipes">${COMBOS.map(c => { const miss = comboMissing(c, have); return `<li class="${miss.length ? '' : 'on'}"><b>${esc(c.n)}</b> ${c.need.map(x => `<span class="${have.includes(x) ? 'got' : ''}">${SP[x] ? SP[x].n : x}</span>`).join(' + ')}${miss.length ? `<small>还差：${miss.map(x => SP[x] ? SP[x].n : x).join('、')}</small>` : '<small>已成形</small>'}<br><small>${esc(c.d)}</small></li>`; }).join('')}</ul>
  <h4>道</h4><ul>${DAOS.map(d => `<li><b>${d.n}</b> ${esc(d.d)}<br><small>2 只：${esc(d.r2.d)}；4 只：${esc(d.r4.d)}</small></li>`).join('')}</ul>
  <h4>蛊</h4><div class="codexgrid">${SPECIES.filter(s => !s.immortal).map(s => `<div class="cx${S.codex[s.id] ? '' : ' unseen'}" data-tip="${esc(S.codex[s.id] ? `${s.n}（${RANK.names[baseRank(s.id)]} · ${DAO[daoOf(s.id)] ? DAO[daoOf(s.id)].n : ''}）\n${natDesc(s.id)}` : '还没见过')}">${guSVG(s.id)}<small>${S.codex[s.id] ? s.n : '？'}</small></div>`).join('')}</div>`, 'codex');
}
function openPath() {
  const v = timelineView(M()), K = { trips: '出征', clears: '通关', realm: '境界', merges: '合成', combos: '杀招成形', buys: '买蛊', feeds: '喂食' };
  sheet(`<h3>道途</h3><p class="sm">达成一个，就解锁新的蛊、食物、秘境或玩法。成就本身不给数值。</p><ol class="tline">${v.map(a => `<li class="${a.state}"><b>${esc(a.n)}</b> <small>${esc(a.d)}</small>${a.state === 'done' ? '' : `<small class="prog">${a.prog.map(p => `${K[p.k] || p.k} ${p.cur}/${p.v}`).join(' · ')}</small>`}<em>${(a.unlock || []).map(u => '解锁 ' + esc(u.n)).join('、')}</em></li>`).join('')}</ol>`);
}
const applyCalm = () => { document.documentElement.toggleAttribute('data-calm', !!S.calm); try { fxConfig({ calm: !!S.calm }); } catch (e) {} };
function openSettings() {
  const tog = (act, on, a = '开', b = '关') => `<button class="tog${on ? ' on' : ''}" data-act="${act}" aria-pressed="${on}">${on ? a : b}</button>`;
  ledgerBindLimits(sheet(`<h3>设置</h3>
  <div class="set"><span>主题</span><div class="segs">${[['auto', '自动'], ['light', '日'], ['dark', '夜']].map(([k, t]) => `<button data-act="setTheme" data-v="${k}" class="${(S.theme || 'auto') === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
  <div class="set"><span>声音<small>古琴、木鱼</small></span>${tog('setMute', !S.mute)}</div>
  <div class="set"><span>减弱震屏与闪光<small>暴击、斩杀的震动和闪白都调弱</small></span>${tog('setCalm', !!S.calm)}</div>
  ${ledgerLimitRows()}
  <p class="sm">累计元气 ${fmtTok(S.total)} token</p>`, 'settings'));
}

// ---------- 悬停提示：data-tip（文字）或 data-tip-fn（动态） ----------
function guTip(g, team, i) {
  if (!g) return '';
  const nat = natOfG(g), c = team ? teamCombos(team)[i] : null, f = g.food && FOOD[g.food];
  return `<b>${rankName(g)}</b> <i class="a">${g.atk}</i> <i class="h">${g.hp}</i><br><small>${esc(SP[g.sp].lore)}${team ? ` · 第 ${i + 1} 位` : ''}</small>`
    + (nat ? `<p><b>本命·${esc(nat.n)}</b> ${esc(nat.d)}</p>` : '') + (c ? `<p><b>杀招·${esc(c.n)}</b> ${esc(c.d)}<br><small>配方：${c.need.map(x => SP[x].n).join(' + ')}</small></p>` : '')
    + (f ? `<p><b>挂件·${esc(f.n)}</b> ${esc(f.d)}</p>` : '') + `<small>点开看完整详情</small>`;
}
const TIPS = {
  qi: () => `<b>元气 ${fmtTok(S.bank)}</b><br><small>${esc(TXT.qiTip)}${VSC ? '' : esc(TXT.qiTrial)}</small>`,
  gu: t => guTip(S.team[+t.dataset.i], S.team, +t.dataset.i),
  bag: () => esc(TXT.bagTip()),
  bg: t => { const g = S.bag[+t.dataset.i]; return g ? guTip(g) + '<small>在蛊囊里：不上场、不出征，拖进空窍才上场</small>' : ''; },
  ware: t => { const w = S.shop[+t.dataset.i]; if (!w) return ''; if (w.kind === 'food') { const f = FOOD[w.id]; return `<b>${esc(f.n)}</b> · ${FOOD_KIND[f.kind]}<br>${esc(f.d)}<br><small>价格 ${fmtTok(price(foodCost(w.id)))} 元气</small>`; } const n = owned(w.sp); return guTip(newGu(w.sp)).replace('<small>点开看完整详情</small>', '') + `<small>价格 ${fmtTok(price(PRICE.gu))} 元气 · 点开看完整详情</small>` + (n >= 2 ? `<p>你已有 ${n} 只${RANK.names[baseRank(w.sp)]}${SP[w.sp].n}，买下当场合成${RANK.names[baseRank(w.sp) + 1]}</p>` : ''); },
};
let tipT = 0, tipEl = null, tipFor = null, tipLongT = 0, tipLongAt = -1e9;
function tipShow(t) {
  const f = t.dataset.tipFn, h = f ? (TIPS[f] ? TIPS[f](t) : '') : esc(t.dataset.tip || '').replace(/\n/g, '<br>'); if (!h) return;
  if (!tipEl) { tipEl = el('<div class="tip" role="tooltip"></div>'); document.body.appendChild(tipEl); }
  tipEl.innerHTML = h; tipEl.hidden = false; tipFor = t;
  const r = t.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
  const below = r.bottom + th + 10 < vh || r.top < th + 10, top = below ? r.bottom + 6 : r.top - th - 6;
  tipEl.style.left = Math.max(8, Math.min(vw - tw - 8, r.left + r.width / 2 - tw / 2)) + 'px'; tipEl.style.top = Math.max(8, Math.min(vh - th - 8, top)) + 'px';
}
function tipHide() { clearTimeout(tipT); clearTimeout(tipLongT); if (tipEl) tipEl.hidden = true; tipFor = null; }
const tipTarget = e => e.target.closest && e.target.closest('[data-tip],[data-tip-fn]');
document.addEventListener('pointerover', e => {
  if (e.pointerType === 'touch') return; const t = tipTarget(e); if (t === tipFor) return;
  tipHide(); if (t) tipT = setTimeout(() => { if (t.isConnected) tipShow(t); }, 250);
});
document.addEventListener('pointerout', e => { if (e.pointerType === 'touch') return; const t = tipTarget(e); if (t && !(e.relatedTarget && t.contains(e.relatedTarget))) tipHide(); });
document.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') { tipHide(); return; }
  const t = tipTarget(e); if (tipFor && tipFor !== t) tipHide();
  if (t) { const x = e.clientX, y = e.clientY; tipLongT = setTimeout(() => { tipShow(t); tipLongAt = performance.now(); }, 450); t._tipXY = [x, y]; }
}, true);
document.addEventListener('pointermove', e => { if (e.pointerType === 'touch' && tipLongT && tipFor == null) { const t = tipTarget(e); if (!t || !t._tipXY || Math.hypot(e.clientX - t._tipXY[0], e.clientY - t._tipXY[1]) > 8) clearTimeout(tipLongT); } }, true);
document.addEventListener('pointerup', e => { if (e.pointerType === 'touch') clearTimeout(tipLongT); }, true);
window.addEventListener('scroll', () => tipHide(), true);

// ---------- 拖动换位：空窍内、蛊囊内、两者之间 ----------
let drag = null, dragEndT = -1e9;
const moveIdx = (arr, f, t) => { const [x] = arr.splice(f, 1); arr.splice(t, 0, x); };
function moveGu(fromKey, fi, toKey, ti) {
  if (tripOn()) return false;
  const A = fromKey === 'bag' ? S.bag : S.team, B = toKey === 'bag' ? S.bag : S.team, g = A[fi]; if (!g) return false;
  if (A === B) { if (ti >= A.length) ti = A.length - 1; moveIdx(A, fi, ti); return true; }
  const capB = toKey === 'bag' ? BC() : curCap(), other = B[ti];
  if (other) { A[fi] = other; B[ti] = g; }
  else { if (B.length >= capB) return false; A.splice(fi, 1); B.splice(Math.min(ti, B.length), 0, g); }
  return true;
}
document.addEventListener('pointerdown', e => {
  const it = e.target.closest('[data-drag]'), box = it && it.closest('[data-sort]');
  if (!it || !box || e.button > 0 || it.classList.contains('empty') || tripOn()) return;
  const grp = box.dataset.group, items = grp ? [...document.querySelectorAll(`[data-group="${grp}"] [data-drag]`)] : [...box.querySelectorAll('[data-drag]')];
  drag = { it, box, from: items.indexOf(it), to: items.indexOf(it), x0: e.clientX, y0: e.clientY, ghost: null, items };
});
window.addEventListener('pointermove', e => {
  if (!drag) return; const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (!drag.ghost) {
    if (Math.hypot(dx, dy) < 8) return;
    const r = drag.it.getBoundingClientRect(), gh = drag.it.cloneNode(true); gh.classList.add('dragghost'); gh.removeAttribute('data-act');
    Object.assign(gh.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); document.body.appendChild(gh); drag.ghost = gh; drag.it.classList.add('dragging');
  }
  drag.ghost.style.transform = `translate(${dx}px,${dy}px) rotate(-3deg)`;
  let best = drag.from, bd = Infinity;
  drag.items.forEach((o, k) => { const r = o.getBoundingClientRect(), d = Math.hypot(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2); if (d < bd) { bd = d; best = k; } });
  drag.to = best; drag.items.forEach((o, k) => o.classList.toggle('dropto', k === best && k !== drag.from));
  e.preventDefault();
}, { passive: false });
function dragEnd() {
  if (!drag) return; const d = drag; drag = null; if (!d.ghost) return;
  d.ghost.remove(); d.it.classList.remove('dragging'); d.items.forEach(o => o.classList.remove('dropto')); dragEndT = performance.now();
  if (d.to === d.from) return; const tgt = d.items[d.to], tbox = tgt && tgt.closest('[data-sort]');
  if (!tbox) return;
  if (moveGu(d.box.dataset.sort, +d.it.dataset.drag, tbox.dataset.sort, +tgt.dataset.drag)) { snd('clack'); afterChange(); }
}
window.addEventListener('pointerup', dragEnd); window.addEventListener('pointercancel', dragEnd);

// ---------- 交互 ----------
function buyWare(i) {
  const w = S.shop[i]; if (!w || w.sold || tripOn()) return;
  if (w.kind === 'food') {
    const f = FOOD[w.id]; if (!canPay(foodCost(w.id))) { note(TXT.poor(price(foodCost(w.id)) - S.bank)); return; }
    if (f.kind === 'trip' || (f.kind === 'stat' && f.to !== 'one')) { if ((f.kind === 'stat' && !S.team.length) || !pay(foodCost(w.id))) return; w.sold = true; w.frozen = false; useFood(w.id, 'shop', i); closeSheet(); renderHome(); save(); return; }
    useFood(w.id, 'shop', i); return;
  }
  if (!canBuy(S.team, w.sp, curCap(), S.bag, BC())) { note(TXT.bagFull); return; }
  if (!pay(PRICE.gu)) return;
  const g = newGu(w.sp); w.sold = true; w.frozen = false;
  note(TXT.bought(g)); achieve('buys', 1); closeSheet();
  placeNew(g, 'shop'); snd('coin');
}
const ACT = {
  closeSheet() { closeSheet(); },
  closeSheetBg(a, e) { if (e.target === a) closeSheet(); },
  pick(a) {
    const g = newGu(a.dataset.sp, 1); S.team = [g]; S.started = true; S.bank = S.bank || 0; codexScan();
    rollCompass(); renderAll(); save();
  },
  dao(a) { S.dao = a.dataset.d; S.compass = null; S.shop = S.shop.filter(w => w.frozen && !w.sold); newShop(); note(TXT.daoLine(S.dao)); renderHome(); save(); },
  ware(a) {
    const i = +a.dataset.i, w = S.shop[i]; if (!w) return;
    if (w.kind === 'food') { const f = FOOD[w.id]; sheet(`<h3>${esc(f.n)} <small>${FOOD_KIND[f.kind]}</small></h3><p>${esc(f.d)}</p><div class="row2"><button data-act="freeze" data-i="${i}">${TXT.freeze(w.frozen)}</button><button class="zhu" data-act="buy" data-i="${i}"${!w.sold && canPay(foodCost(w.id)) ? '' : ' disabled'}>买下 ${fmtTok(price(foodCost(w.id)))}</button></div><p class="sm">余 ${fmtTok(S.bank)} 元气</p>`); return; }
    const g = newGu(w.sp); guDetail(g, { kind: 'shop' });
    const sh = $('.sheet'); if (sh) sh.insertAdjacentHTML('beforeend', `<div class="row2"><button data-act="freeze" data-i="${i}">${TXT.freeze(w.frozen)}</button><button class="zhu" data-act="buy" data-i="${i}"${!w.sold && canPay(PRICE.gu) ? '' : ' disabled'}>${owned(w.sp) >= 2 ? '买下并合成 ' : '买下 '}${fmtTok(price(PRICE.gu))}</button></div><p class="sm">余 ${fmtTok(S.bank)} 元气</p>`);
  },
  buy(a) { buyWare(+a.dataset.i); },
  freeze(a) { const w = S.shop[+a.dataset.i]; if (!w) return; w.frozen = !w.frozen; closeSheet(); renderShop(); save(); },
  refresh() { if (tripOn() || !pay(PRICE.refresh)) return; newShop(); renderShop(); meters(); save(); snd('tick'); },
  pantry(a) { const i = +a.dataset.i, id = S.pantry[i], f = FOOD[id]; if (!f) return; if (f.kind === 'gear' || (f.kind === 'stat' && f.to === 'one')) { useFood(id, 'pantry', i); return; } if (useFood(id, 'pantry', i)) { S.pantry.splice(i, 1); renderHome(); save(); } },
  feedTo(a) { const all = [...S.team, ...S.bag]; feedTo(all[+a.dataset.k]); },
  gu(a) { const i = +a.dataset.i; if (S.team[i]) guDetail(S.team[i], { kind: 'team', i }); },
  bagGu(a) { const i = +a.dataset.i; if (S.bag[i]) guDetail(S.bag[i], { kind: 'bag', i }); },
  toBag(a) { if (moveGu('team', +a.dataset.i, 'bag', S.bag.length)) { closeSheet(); afterChange(); } },
  fromBag(a) { if (moveGu('bag', +a.dataset.i, 'team', S.team.length)) { closeSheet(); afterChange(); } },
  sell(a) { const L = a.dataset.k === 'bag' ? S.bag : S.team, i = +a.dataset.i, g = L[i]; if (!g || tripOn()) return; const v = price(sellValue(g)); L.splice(i, 1); S.bank += v; note(TXT.sold(g, v)); closeSheet(); afterChange(); snd('coin'); },
  go() { if (!S.team.length || tripOn()) return; goSheet(); },
  goConfirm() { closeSheet(); if (!TRIP.start) { note(TXT.goSoon); return; } S.trip = S.trip || { at: Date.now() }; save(); renderHome(); TRIP.start(TRIP.api); },
  ghost() { openGhosts(); },
  ghostNew() { S.ghosts = null; openGhosts(); },
  ghostGo(a) { const o = S.ghosts && S.ghosts.list[+a.dataset.i]; if (!o) return; closeSheet(); const d = decodeTeam(o.code); spar('ghost', { team: d.team, name: o.name, realm: S.realm }); },
  share() { openShare(); },
  copyCode(a) { copy(myCode(), a); },
  copyLink(a) { const c = myCode(); copy(shareText(c) + '\n' + shareURL(c), a); },
  savePng() { if (!cardURL) return; if (VSC) { VSC.postMessage({ type: 'savePng', data: cardURL }); return; } const l = document.createElement('a'); l.href = cardURL; l.download = 'gucode.png'; l.click(); },
  duelInput() { openDuelInput(); },
  duelGo() { if (!openLinkText($('#duelIn').value)) $('#duelErr').textContent = '坐标码或复盘链接不对，或者被截断了。'; },
  duelFight() { closeSheet(); spar('duel', window.__guFoe); },
  replayGo() { const rp = window.__guRp; closeSheet(); playBattle({ kind: 'replay', title: `复盘 · ${rp.B.name || '无名'} 对 ${rp.A.name || '无名'}`, res: battle(rp.A.team, rp.B.team, 'r:' + rp.seed, { sota: rp.sota }, {}), A: rp.A, B: rp.B, sota: rp.sota, replay: rp.replay }); },
  copyReplay(a) { const B = window.__guB; if (!B) return; const w = B.res.winner, an = B.A.name || '无名', bn = B.B.name || '无名', wt = w === 'draw' ? '打成平手' : (w === 'A' ? an : bn) + ' 胜'; copy(`${(B.A.trial || B.B.trial) ? TXT.trialText : ''}《蛊码》复盘：${an} 对 ${bn}，${wt}。点开看整场：\n${replayURL(B.replay)}`, a); },
  closeBattle() { closeBattle(); },
  skip() { skip = true; },
  speed() { S.speed = S.speed >= 3 ? 1 : S.speed + 1; const b = $('#bspd'); if (b) b.textContent = S.speed + '×'; save(); },
  codex() { openCodex(); },
  path() { openPath(); },
  ledger() { openLedger({ name: S.name, realm: REALMS[S.realm], rank: REALMS[S.realm] }); },
  settings() { openSettings(); },
  setTheme(a) { S.theme = a.dataset.v; applyTheme(); save(); openSettings(); },
  setMute() { S.mute = !S.mute; save(); snd('pluck'); openSettings(); },
  setCalm() { S.calm = !S.calm; applyCalm(); save(); openSettings(); },
  demo(a) { if (VSC) return; src.demo = a.dataset.m === 'rest' ? 'rest' : 'coding'; meters(); },
  src() {
    if (VSC) { const sl = srcList(bySrc); sheet(`<h3>${TXT.srcHead}</h3><p>${TXT.srcFrom}</p><p class="sm">当前元气 +<b>${fmtTok(rate)}</b>/s</p>${sl.length ? `<ul class="srclist">${sl.map(x => `<li><span>${esc(x.name)}</span><b>${fmtTok(x.rate)}/s</b></li>`).join('')}</ul>` : `<p class="sm">${rate > 0 ? '' : TXT.srcNone}</p>`}`, 'srcinfo'); return; }
    sheet(`<h3>${TXT.demoHead}</h3><p>${TXT.demoFrom}</p><p class="sm">${TXT.demoTrial}</p><p>${TXT.demoInstall}</p><div class="row2"><a class="btn zhu" href="${INSTALL_URL}" target="_blank" rel="noopener">看插件安装方法</a></div><p class="sm">${esc(INSTALL_URL)}</p>`, 'demoinfo');
  },
  reset(a) {
    if (Date.now() - resetArm > 3000) { resetArm = Date.now(); a.textContent = '再点一次确认重开'; setTimeout(() => { a.textContent = '重开一局'; }, 3000); return; }
    const keep = { name: S.name, total: S.total, theme: S.theme, codex: S.codex, mute: S.mute, calm: S.calm, todayKey: S.todayKey, todayTok: S.todayTok, qlim: S.qlim, lgSnap: S.lgSnap, lgAch: S.lgAch, meta: S.meta, combosSeen: S.combosSeen, trial: S.trial, sotaAt: S.sotaAt };
    S = Object.assign(fresh(), keep); renderAll(); save();
  },
};
document.addEventListener('click', e => {
  if (performance.now() - tipLongAt < 500) { e.preventDefault(); return; }   // 长按看提示后松手，不当作点击
  tipHide();
  const a = e.target.closest('[data-act]'); if (!a || a.disabled || performance.now() - dragEndT < 250) return;
  const f = ACT[a.dataset.act]; if (f) f(a, e);
});

// ---------- 算力履历（只显示曲线、日历、额度；灵根和分神加成已删） ----------
ledgerInit({ vsc: VSC, openSettings, buffsOn: false, getLimits: () => S.qlim || {}, setLimit: (k, v) => { S.qlim = Object.assign({}, S.qlim); if (v > 0) S.qlim[k] = v; else delete S.qlim[k]; save(); }, onData: () => {} });

// ---------- 启动 ----------
function boot(saved, pending) {
  const mg = migrate(saved); if (mg) S = Object.assign(fresh(), mg);
  S.meta = metaMigrate(S.meta);
  S.trial = !VSC;   // 网页只有模拟元气，存档一律算试玩；插件只认真实 token
  if (!document.getElementById('gu-defs')) document.body.insertAdjacentHTML('afterbegin', `<svg id="gu-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${ART_DEFS}</defs></svg>`);
  applyTheme(); if (VSC && window.MutationObserver) new MutationObserver(applyTheme).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  booted = true; renderAll(); requestAnimationFrame(veinLoop);
  if (pending && pending.tokens > 0 && S.started) { countTok(pending.tokens); feed(pending.tokens); note(`你不在的时候，攒下了 ${fmtTok(pending.tokens)} 元气`); meters(); }
  if (S.started && !S.compass && !S.dao) rollCompass();
  floorCheck(); checkHash();
}
if (VSC) {
  window.addEventListener('message', e => {
    const m = e.data || {};
    if (m.type === 'init' && !booted) boot(m.save, m.pending);
    else if (m.type === 'duel') openLinkText(m.code);
    else if (m.type === 'share' && booted && S.started) openShare();
  });
  VSC.postMessage({ type: 'ready' });
} else {
  let s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  // 旧玩法的存档不再读取：原样另存一份备份（只存第一次遇到的那份）
  if (s && s.v !== 3) { try { if (!localStorage.getItem(BAK_KEY)) localStorage.setItem(BAK_KEY, JSON.stringify(s)); } catch (e) {} s = null; }
  const go = () => boot(s); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  window.addEventListener('hashchange', checkHash);
}
