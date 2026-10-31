// 蛊码 GuCode · 界面与流程（渲染层；逻辑都在 core/battle）
import { makeRng, SPECIES, SP, TRAITS, QUIRKS, NODES, REALMS, TRIB_NAMES, GHOST_NAMES, SLOTS, MAXTR, MAXV, newGu, starterTeam, skillOf, comboOf, nodeOk, rollCompass, applyNode, genTeam, tribTeam, encodeTeam, decodeTeam, fmtTok, addTrait, COMBOS, hashStr, slotCap, SLOT_BY_REALM, poolFor, ECON, MARKS, rollMarks, nodeChoices, rollShop, canBuy, buyGu, sellValue, ghostTrio, trCap, REALM_NOTES, POOL_TIERS, endlessTeam, ENDLESS, EV_MS, playMs, tempoFor, fmtNum, spTraits, posLinks, posNote, WOUND } from './core.js';
import { battle } from './battle.js';
import { guSVG, ART_DEFS } from './art.js';
import { TokenSource, VSC } from './tokens.js';
import { makeCard } from './card.js';

const KEY = 'gucode.v1', WILL_MAX = 5, WILL_SEC = 120, WILL_TOK = 60;
const $ = (s, r = document) => r.querySelector(s);
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fresh = () => ({ v: 2, started: false, name: '', team: [], realm: 0, nodes: 0, compass: [], sel: null, prog: 0, wh: 0, bank: 0, repair: 0, will: 3, willT: 0, willK: 0, total: 0, muts: 0, wins: 0, losses: 0, seed: (Math.random() * 1e9) | 0, step: 0, sound: false, speed: 1, theme: 'auto', mute: false, stone: 5, stoneK: 0, shop: [], pending: null, marks: [], ghosts: null, floor: 1, endless: 0, codex: { sp: [], combo: [] }, healT: 0, streak: 0, bestStreak: 0, day: '', dayWin: false });
const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const curCap = () => Math.max(slotCap(S.realm), S.team.length);
const buyCost = () => S.marks.includes('shiJing') ? 2 : ECON.buy, refCost = () => S.marks.includes('shiJing') ? 0 : ECON.refresh;
function migrate(s) { if (!s || !s.v) return null; if (s.v === 1) { s.v = 2; s.stone = 5 + Math.min(20, s.nodes || 0); s.will = Math.max(s.will || 0, 3); } return s.v === 2 ? s : null; }

let S = fresh(), phase = 'yang', rate = 0, hot = false, inBattle = false, booted = false, skip = false, resetArm = 0;
const src = new TokenSource(onTick);
const R = () => makeRng(S.seed + ':' + (S.step++));
const bankCap = () => 120 * src.unit;
const effA = g => Math.max(1, g.atk - (g.wound || 0)), effH = g => Math.max(1, g.hp - (g.wound || 0));
const trChars = tr => (Array.isArray(tr) ? tr : Object.entries(tr)).map(([id, v]) => TRAITS[id].ch + (v > 1 ? `<sup>${v}</sup>` : '')).join('');

// ---------- 存档 ----------
let saveT;
function save() {
  if (saveT) return;   // 节流而非防抖：持续有 token 流入时也能按时落盘
  saveT = setTimeout(() => {
    saveT = null; codexScan();
    if (VSC) { const n = S.sel != null ? S.compass[S.sel] : null; VSC.postMessage({ type: 'save', data: S, status: { started: S.started, node: n ? NODES[n.type].n : null, cost: n ? n.cost * src.unit : 0, prog: S.prog, will: S.will, realm: S.realm } }); }
    else try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  }, 400);
}

// ---------- 蛊典：终身收集，跨局保留 ----------
function codexScan() {
  const cx = S.codex || (S.codex = { sp: [], combo: [] });
  for (const g of S.team) { [g.sp, ...(g.att || [])].forEach(id => { if (SP[id] && !cx.sp.includes(id)) cx.sp.push(id); }); const c = comboOf(g); if (c && !cx.combo.includes(c.id)) cx.combo.push(c.id); }
}
function openCodex() {
  codexScan(); const cx = S.codex;
  sheet(`<h3>蛊典</h3><p class="sm">终身收集，重开一局也保留。蛊种 ${cx.sp.length}/${SPECIES.length} · 杀招 ${cx.combo.length}/${COMBOS.length}</p>
  <div class="codex">${SPECIES.map(sp => cx.sp.includes(sp.id) ? `<div class="cx"><span class="art">${guSVG(sp.id)}</span><b>${sp.n}</b><small>${TRAITS[sp.t].n}</small></div>` : `<div class="cx unk"><span class="art">${guSVG(sp.id)}</span><b>？</b><small>未遇</small></div>`).join('')}</div>
  <h4>杀招</h4><ul>${COMBOS.map(c => cx.combo.includes(c.id) ? `<li><b>${c.n}</b>${c.need.map(x => SP[x].n).join(' + ')}：${c.d}</li>` : `<li class="unk"><b>？？？</b>${SP[c.need[0]].n} + ${c.need.slice(1).map(() => '？').join(' + ')}</li>`).join('')}</ul>`);
}
function openPath() {
  const rows = REALMS.map((rn, r) => {
    const newSp = r <= 2 ? POOL_TIERS[r].map(id => SP[id].n).join('、') : '';
    const state = r < S.realm ? 'done' : r === S.realm ? 'now' : '';
    const boss = r < 5 ? `渡${TRIB_NAMES[r]} → 晋${REALMS[r + 1]}` : '无尽劫';
    return `<li class="pr ${state}"><span class="pn">${rn}</span><span class="pb"><b>空窍 ${slotCap(r)} 格${newSp ? ' · 蛊市新蛊：' + newSp : ''}</b><small>${REALM_NOTES[r]} · ${boss}</small>${r === S.realm && r < 5 ? `<em>下一劫阵容 · 点开看详情</em>${miniRow(tribTeam(r), 'foe', 'trib')}` : ''}</span></li>`;
  }).join('');
  sheet(`<h3>修行路</h3><p class="sm">凡人到五转，每渡一劫：全体 +1/+1、择一道痕，空窍与蛊市随境界扩开。</p><ol class="path">${rows}<li class="pr ${S.realm >= 5 ? 'now' : ''}"><span class="pn">无尽</span><span class="pb"><b>无尽劫 · 层数无限</b><small>每层敌阵更强（+${ENDLESS.atkPerFloor} 攻 +${ENDLESS.hpPerFloor} 血/层），最高层写进分享卡。当前最高 ${S.endless} 层</small>${S.realm >= 5 ? `<em>第 ${S.floor} 层阵容 · 点开看详情</em>${miniRow(endlessTeam(S.floor), 'foe', 'endl')}` : ''}</span></li></ol>`);
}
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

// ---------- Token 流 ----------
function onTick(t) {
  rate = t.rate; hot = t.hot;
  if (!booted) return;
  if (t.delta > 0 && S.started && !inBattle) feed(t.delta, t.hotDelta != null ? t.hotDelta : (t.hot ? t.delta : 0));
  else if (t.delta > 0 && S.started) S.bank = Math.min(bankCap(), S.bank + t.delta), S.total += t.delta;
  phase = t.idle ? 'yin' : 'yang';   // 只影响灵脉/呼吸动画，不影响能否斗蛊
  if (S.started) regenWill(t.delta || 0);
  meters();
}
let lastTick = performance.now();
function regenWill(tok) {   // 意志 = 体力：随时间和 token 回复，与是否空闲无关
  const now = performance.now(), dt = Math.min(5000, now - lastTick); lastTick = now;
  if (S.team.some(g => g.wound > 0)) { S.healT = (S.healT || 0) + dt; if (S.healT >= WOUND.healSec * 1000) healOne(); }
  if (S.will >= WILL_MAX) { S.willT = 0; S.willK = 0; return; }
  S.willT += dt; S.willK += tok;
  let up = 0;
  while (S.willT >= WILL_SEC * 1000) { S.willT -= WILL_SEC * 1000; up++; }
  while (S.willK >= WILL_TOK * src.unit) { S.willK -= WILL_TOK * src.unit; up++; }
  if (up) { S.will = Math.min(WILL_MAX, S.will + up); renderSlots(); renderPhase(); save(); }
}
function feed(d, hotAmt) {
  S.total += d; let rest = d, hr = hotAmt || 0;
  S.stoneK += d; while (S.stoneK >= ECON.tokPer * src.unit) { S.stoneK -= ECON.tokPer * src.unit; S.stone++; renderMeta(); renderShop(); }
  if (S.team.some(g => g.wound > 0)) { S.repair += d; while (S.repair >= WOUND.healTok && healOne()) S.repair -= WOUND.healTok; }
  else S.repair = 0;
  let guard = 0;
  while (rest > 0.01 && guard++ < 20) {
    if (S.sel == null) { S.bank = Math.min(bankCap(), S.bank + rest); break; }
    const cost = S.compass[S.sel].cost * src.unit, take = Math.min(cost - S.prog, rest), fr = take / rest;
    S.prog += take; S.wh += hr * fr; hr -= hr * fr; rest -= take;
    if (S.prog >= cost - 0.5) resolveNode();
  }
  save();
}
// 愈合一层：伤得最重的先好；有飘字、拨弦和卡片跳动
function healOne() {
  const g = S.team.filter(x => x.wound > 0).sort((a, b) => b.wound - a.wound)[0]; if (!g) return false;
  g.wound--; S.healT = 0; renderSlots(); renderHint();
  setTimeout(() => { fxFloat(g.uid, g.wound ? '伤愈一层' : '痊愈', 'heal'); const e = $(`.gu[data-uid="${g.uid}"]`); if (e) { e.classList.remove('pulse'); void e.offsetWidth; e.classList.add('pulse'); } snd('pluck'); }, 30);
  if (!S.team.some(x => x.wound > 0)) { S.repair = 0; S.healT = 0; }
  save(); return true;
}
const healPct = () => Math.min(1, Math.max(S.repair / WOUND.healTok, (S.healT || 0) / (WOUND.healSec * 1000)));
function resolveNode() {
  const node = S.compass[S.sel]; if (!node) return;
  const cost = node.cost * src.unit, wu = S.wh >= cost * 0.5;
  S.sel = null; S.prog = 0; S.wh = 0;
  if (!nodeOk(node.type, S.team, curCap())) { S.compass = rollCompass(R(), S.team, false, curCap()); renderPhase(); return; }
  let opts = nodeChoices(node, S.team, R(), S.realm);
  if (opts && opts.length > 1) {   // 选择题：不弹窗，挂在罗盘位上，等玩家有空再点
    if (node.type === 'devour') opts = opts.map(i => S.team[i].uid);
    S.pending = { node, opts, wu, cost }; renderPhase(); renderHint(); snd('pluck'); save(); return;
  }
  finishNode(node, opts ? opts[0] : undefined, wu, cost);
}
function finishNode(node, pick, wu, cost) {
  if (node.type === 'devour' && typeof pick === 'string') pick = S.team.findIndex(g => g.uid === pick);
  S.pending = null;
  if (!nodeOk(node.type, S.team, curCap()) || (node.type === 'devour' && !(pick > 0))) { S.compass = rollCompass(R(), S.team, false, curCap()); renderPhase(); renderHint(); save(); return; }
  const res = applyNode(S.team, node, R(), { wuhuo: wu, pick, cap: curCap() });
  const tg = node.type === 'summon' ? S.team[S.team.length - 1] : S.team[0]; if (tg) tg.fed += cost;
  S.muts += res.muts; S.nodes++; S.will = Math.min(WILL_MAX, S.will + 1); S.stone += ECON.node;
  S.compass = rollCompass(R(), S.team, false, curCap());
  S.shop = rollShop(R(), S.realm, S.shop);
  animResolve(res, wu); renderPhase(); renderHint(); renderShop(); snd('pluck'); save();
}
async function animResolve(res, wu) {
  res.gone.forEach(uid => { const e = $(`.gu[data-uid="${uid}"]`); if (e) e.classList.add('eaten'); });
  if (res.gone.length) await sleep(420);
  renderSlots();
  res.fx.forEach((f, i) => setTimeout(() => {
    fxFloat(f.uid, f.txt, f.k);
    const e = $(`.gu[data-uid="${f.uid}"]`); if (e) { e.classList.remove('pulse', 'born'); void e.offsetWidth; e.classList.add(f.k === 'new' ? 'born' : 'pulse'); }
  }, i * 170));
  if (wu) stampIn($('#qiao'), '武火', false, 'side');
  if (res.combo) setTimeout(() => { stampIn($('#qiao'), res.combo.n, false); snd('glitch'); }, 600);
}

// ---------- 渲染 ----------
function renderAll() {
  const app = $('#app');
  app.innerHTML = S.started ? mainHTML() : startHTML();
  if (S.started) { renderSlots(); renderShop(); renderPhase(); renderHint(); meters(); }
}
function startHTML() {
  const r = makeRng(S.seed + ':start'), pool = poolFor(0).slice(), picks = [];
  while (picks.length < 3) { const s = pool.splice(r.int(pool.length), 1)[0]; picks.push(s); }
  return `<div class="start"><div class="hero"><h1 class="title">蛊码</h1><p class="tag">烧 Token，养蛊，斗道。</p>
  <p class="lead">万物皆可为蛊，蛊即是道。你写代码烧掉的每一个 token，都在喂这一窝蛊；停手的时候，它们替你去斗。</p></div>
  <h2 class="step">三选一，结本命蛊</h2><div class="starters">${picks.map(id => { const s = SP[id]; return `<button class="starter" data-act="pick" data-sp="${id}"><div class="sart">${guSVG(id)}</div><b>${s.n}</b><span class="sst"><i class="a">${s.atk}</i><i class="h">${s.hp}</i></span><span class="strig">${spTraits(id).map(([t, v]) => TRAITS[t].d(v)).join('；')}</span><em>${s.lore}</em></button>`; }).join('')}</div>
  <p class="fine">${VSC ? '插件模式：读取本机 Claude Code / Codex 会话的 token 用量数字（不读内容）。' : '演示模式会模拟写代码的 token 流。存档只在本机。'}</p></div>`;
}
function mainHTML() {
  return `<header class="top"><div class="brand"><b class="logo">蛊码</b><span class="sub">烧 Token · 养蛊 · 斗道</span></div>
  <div class="tools"><button class="realm" id="realm" data-act="path" title="修行路">${REALMS[S.realm]}</button><button class="ib" data-act="theme" id="bTheme" title="主题：自动 / 日 / 夜">${{ auto: '自', light: '日', dark: '夜' }[S.theme || 'auto']}</button><button class="ib" data-act="sound" id="bSound" title="声音开关">${S.mute ? '静' : '声'}</button><button class="ib zhu" data-act="share">战帖</button></div></header>
  <section class="vein"><canvas id="vein"></canvas><div class="vinfo"><button class="chip" data-act="src" id="srcTag"></button><span id="rateTxt"></span><span id="fireTag" class="fire"></span><span class="grow"></span><span id="totTxt"></span></div></section>
  <div class="seg" id="demo">${[['coding', '写代码中'], ['wuhuo', '武火并发'], ['rest', '停手休息']].map(([m, t]) => `<button data-act="demo" data-m="${m}">${t}</button>`).join('')}</div>
  <section class="qiao" id="qiao"><div class="qhead"><span class="lbl">空窍 <small>左为炉口 · 拖动换位</small></span><span id="qmeta"></span></div><div class="slots" id="slots"></div><p class="marks" id="marks" data-act="marksInfo"></p><p class="hint" id="hint"></p></section>
  <section class="shop" id="shop"></section><section id="phase" class="phase"></section>
  <footer class="foot"><button data-act="duelInput">粘贴坐标码应战</button><button data-act="path">修行路</button><button data-act="codex">蛊典</button><button data-act="reset" id="bReset">重开一局</button></footer>`;
}
function guCard(g, i, rc = '') {
  const sk = skillOf(g);
  return `<button class="gu${g.wound ? ' hurt' : ''}${i === 0 ? ' lead' : ''}" data-act="gu" data-i="${i}" data-uid="${g.uid}" data-drag="${i}">${rc ? `<span class="rcv">${rc}</span>` : ''}
  <span class="art">${guSVG(g.sp)}</span>${(g.star || 1) > 1 ? `<span class="star">★${g.star}</span>` : ''}${sk ? `<span class="mseal${sk.named ? '' : ' pale'}">${esc(sk.n[0])}</span>` : ''}${g.q.length ? `<span class="qk">${g.q.map(q => QUIRKS[q].n[0]).join('')}</span>` : ''}
  <span class="nm">${SP[g.sp].n}</span><span class="st"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i></span>
  <span class="tr">${trChars(g.tr)}${g.att.map(a => `<i class="att">${SP[a].ab}</i>`).join('')}</span>${g.wound ? `<span class="wd">伤${g.wound}</span>` : ''}</button>`;
}
function renderSlots() {
  const box = $('#slots'); if (!box) return;
  const cap = curCap(), rc = rcvChars(S.team); let h = '';
  for (let i = 0; i < SLOTS; i++) {
    if (S.team[i]) h += `<div class="slot">${guCard(S.team[i], i, rc[i])}</div>`;
    else if (i < cap) h += '<div class="slot"><span class="empty">空</span></div>';
    else { const r = SLOT_BY_REALM.findIndex(c => c > i); h += `<div class="slot"><span class="empty lock">锁<small>${REALMS[r] || ''}开</small></span></div>`; }
  }
  box.innerHTML = h; box.dataset.sort = 'team'; renderMeta();
  const rl = $('#realm'); if (rl) rl.textContent = REALMS[S.realm];
  const mk = $('#marks'); if (mk) mk.textContent = S.marks.length ? '道痕 · ' + S.marks.map(k => MARKS[k].n).join(' · ') : '';
}
function renderMeta() {
  const m = $('#qmeta'); if (!m) return;
  const wd = S.team.reduce((a, g) => a + (g.wound || 0), 0);
  m.innerHTML = `<b class="stone">◈ ${S.stone}</b> 元石 · 意志 <b class="will">${'◆'.repeat(S.will)}${'◇'.repeat(Math.max(0, WILL_MAX - S.will))}</b>${wd ? ` · <span class="heal" title="写代码约 1 分钟愈合一层">温养<span class="hbar"><i id="healBar" style="width:${(100 * healPct()).toFixed(0)}%"></i></span></span>` : ''}`;
}
function renderShop() {
  const box = $('#shop'); if (!box || !S.started) return;
  if (!S.shop || S.shop.length !== 3) S.shop = rollShop(R(), S.realm, []);
  const cost = buyCost(), rc = refCost(), cap = curCap();
  box.innerHTML = `<div class="ch"><span class="lbl">蛊市 <small>${REALMS[S.realm]}档 · ${poolFor(S.realm).length} 种 · 三只同种合炼升星</small></span><button class="ib mini-b" data-act="refresh"${S.stone >= rc ? '' : ' disabled'}>刷新${rc ? ' ' + rc + '◈' : ''}</button></div>
  <div class="wares">${S.shop.map((w, i) => {
    const sp = SP[w.sp], merge = S.team.filter(g => g.sp === w.sp && (g.star || 1) === 1).length >= 2, ok = !w.sold && S.stone >= cost && canBuy(S.team, w.sp, cap);
    const tag = w.sold ? '已购' : !canBuy(S.team, w.sp, cap) ? '空窍已满' : (merge ? '合炼 ' : '') + cost + '◈';
    return `<div class="ware${w.frozen ? ' frozen' : ''}${w.sold ? ' sold' : ''}${merge && !w.sold ? ' merge' : ''}${ok ? '' : ' cant'}"><button class="wbuy" data-act="ware" data-i="${i}"${w.sold ? ' disabled' : ''}>${w.frozen ? '<span class="fz">冻</span>' : ''}<span class="art">${guSVG(w.sp)}</span><b>${sp.n}</b><span class="st"><i class="a">${sp.atk}</i><i class="h">${sp.hp}</i></span><span class="wt">${spTraits(w.sp).map(([t, v]) => TRAITS[t].n + (v > 1 ? v : '')).join(' · ')}</span><span class="price">${tag}</span></button></div>`;
  }).join('')}</div>`;
}
const FOE = {};   // 面板里出现过的阵容，按 key 存着供「点开详情」用
function rcvChars(t) { const out = t.map(() => ''); posLinks(t).forEach(l => { if (l.to >= 0 && l.to !== l.from && !out[l.to].includes(TRAITS[l.id].ch)) out[l.to] += TRAITS[l.id].ch; }); return out; }
function miniRow(t, cls = '', key = '', drag = false) {
  if (key) FOE[key] = t;
  const rc = rcvChars(t), tag = key ? 'button' : 'div';
  return `<div class="mini ${cls}"${drag ? ` data-sort="${key}"` : ''}>${t.map((g, i) => { const sk = skillOf(g); return `<${tag} class="mg${g.boss ? ' boss' : ''}"${key ? ` data-act="peek" data-k="${key}" data-i="${i}"` : ''}${drag ? ` data-drag="${i}"` : ''}>${rc[i] ? `<span class="rcv">${rc[i]}</span>` : ''}<span class="art">${guSVG(g.sp)}</span><b>${g.boss ? '劫·' : ''}${SP[g.sp].n}${(g.star || 1) > 1 ? '★' + g.star : ''}</b><span class="st"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i></span>${sk && sk.named ? `<em class="cs">${esc(sk.n)}</em>` : `<span class="tr">${trChars(g.tr)}</span>`}</${tag}>`; }).join('')}</div>`;
}
function choiceHTML(p) {
  const L = S.team[0], t = p.node.type;
  const head = { mutate: `突变 · ${L ? SP[L.sp].n : ''} 择一词条`, summon: '招蛊 · 三选一', devour: `吞噬 · ${L ? SP[L.sp].n : ''} 吞下哪一只` }[t];
  const items = p.opts.map((o, i) => {
    if (t === 'mutate') { const e = L && L.tr.find(x => x[0] === o), v = e ? e[1] + 1 : 1; return `<button class="node opt" data-act="choose" data-i="${i}"><span class="nseal">${TRAITS[o].ch}</span><span class="nbody"><b>${TRAITS[o].n}${e ? ` · 升至 ${v} 层` : ''}</b><small>${TRAITS[o].trig} · ${TRAITS[o].d(v)}</small></span></button>`; }
    if (t === 'summon') { const sp = SP[o]; return `<button class="node opt" data-act="choose" data-i="${i}"><span class="oart">${guSVG(o)}</span><span class="nbody"><b>${sp.n} <i class="a">${sp.atk}</i> <i class="h">${sp.hp}</i></b><small>${spTraits(o).map(([t, v]) => TRAITS[t].d(v)).join('；')} · ${sp.lore}</small></span></button>`; }
    const g = S.team.find(x => x.uid === o); if (!g || g === L) return '';
    return `<button class="node opt" data-act="choose" data-i="${i}"><span class="oart">${guSVG(g.sp)}</span><span class="nbody"><b>吞下 ${SP[g.sp].n} <i class="a">${effA(g)}</i> <i class="h">${effH(g)}</i></b><small>${g.tr.map(x => TRAITS[x[0]].n + (x[1] > 1 ? x[1] : '')).join(' · ')}${g.att.length ? ' · 附' + g.att.length : ''}</small></span></button>`;
  }).join('');
  return `<div class="compass"><div class="ch"><span class="lbl">${head}</span><span class="bank">灵气照常累积</span></div><div class="nodes">${items}</div></div>`;
}
function nodeDesc(n) {
  const L = S.team[0] ? SP[S.team[0].sp].n : '', R1 = S.team[1] ? SP[S.team[1].sp].n : '', Z = S.team.length ? SP[S.team[S.team.length - 1].sp].n : '';
  switch (n.type) {
    case 'feed': return `全体依次 +3/+2/+1 血，${L} 另 +1 攻`;
    case 'temper': return `${L} +2 攻 +2 血`;
    case 'mutate': return `${L} 觉醒一个词条，三选一`;
    case 'split': return `${L} 裂出六成之力的分身，词条全带`;
    case 'devour': return `${L} 吞下你挑的一只：六成攻血 + 全部词条`;
    case 'summon': return `${REALMS[S.realm]}档蛊池三选一，入最右空窍`;
    case 'refine': {
      const g = S.team[0], z = S.team[S.team.length - 1]; let tip = '';
      if (g && z) { const c = comboOf({ sp: g.sp, att: [...g.att, z.sp] }); if (c && c !== comboOf(g)) tip = ` → 成杀招【${c.n}】`; }
      return `把 ${Z} 炼为 ${L} 的附蛊${tip}`;
    }
  }
  return '';
}
function renderPhase() {
  const box = $('#phase'); if (!box) return;
  if (S.compass.length === 0 || S.compass.every(n => !nodeOk(n.type, S.team, curCap()))) { S.compass = rollCompass(R(), S.team, false, curCap()); S.sel = null; S.prog = 0; }
  const canFight = S.will > 0, nextWill = Math.max(0, Math.ceil(WILL_SEC - S.willT / 1000));
  const tribLabel = S.realm < 5 ? `渡${TRIB_NAMES[Math.min(S.realm, 4)]}` : '五转大成';
  box.innerHTML = (S.pending ? choiceHTML(S.pending) : `<div class="compass"><div class="ch"><span class="lbl">罗盘 · 三岔</span><span id="bank" class="bank"></span></div>
  <div class="nodes">${S.compass.map((n, i) => { const ok = nodeOk(n.type, S.team, curCap()), on = S.sel === i; return `<button class="node${on ? ' on' : ''}" data-act="node" data-i="${i}"${ok ? '' : ' disabled'}><span class="nseal">${NODES[n.type].ch}</span><span class="nbody"><b>${NODES[n.type].n}</b><small>${esc(nodeDesc(n))}</small></span><span class="ncost">${fmtTok(n.cost * src.unit)}</span><span class="nbar"><i></i></span></button>`; }).join('')}</div></div>`) + `
  <div class="gate${canFight ? ' open' : ''}"><div class="gh"><span class="lbl">斗蛊</span><span class="gsub">${canFight ? `每场耗 1 点意志 · 余 ${S.will}` : `意志已尽 · 约 ${Math.ceil(nextWill / 60)} 分钟回 1 点，养蛊也会回`}</span></div>
  <div class="gbtns">${S.realm < 5 ? `<button class="gbtn" data-act="trib"${canFight ? '' : ' disabled'}><b>${tribLabel}</b><small>${REALMS[S.realm + 1]}境 Boss · 胜则升阶</small></button>` : `<button class="gbtn" data-act="endless"${canFight ? '' : ' disabled'}><b>无尽劫 · 第 ${S.floor} 层</b><small>最高 ${S.endless} 层 · 逐层变强</small></button>`}<button class="gbtn" data-act="ghost"${canFight ? '' : ' disabled'}><b>斗幽灵</b><small>易 · 中 · 难 任选 · 胜得元石夺蛊</small></button></div></div>`;
  meters();
}
function renderHint() {
  const h = $('#hint'); if (!h) return;
  let t;
  if (S.team.some(g => g.wound)) t = '受了伤：写代码约 1 分钟愈合一层，不写也会慢慢好。养蛊照常进行。';
  else if (S.pending) t = '罗盘停在一道选择题上。选好了，下一条路才会开。';
  else if (S.sel == null) t = S.nodes === 0 ? '选一条路。Token 流过，蛊沿路生长。' : '罗盘转好了，挑下一条路。顺序即流派。';
  else if (S.nodes >= 1 && S.will > 0) t = `${NODES[S.compass[S.sel].type].n}中。想打随时可以斗蛊，耗一点意志。`;
  else t = `${NODES[S.compass[S.sel].type].n}中：你写代码，它在长。`;
  h.textContent = t;
}
function meters() {
  if (!S.started) return;
  const rt = $('#rateTxt'); if (!rt) return;
  rt.textContent = rate > 0 ? `${fmtTok(rate)}/s` : '静';
  const ft = $('#fireTag'); ft.textContent = rate <= 0 ? '' : hot ? '武火' : '文火'; ft.classList.toggle('hot', hot && rate > 0);
  $('#totTxt').textContent = '累计 ' + fmtTok(S.total);
  const st = $('#srcTag'); st.textContent = src.mode === 'vscode' ? 'Claude 实时' : '演示';
  const dm = $('#demo'); dm.hidden = src.mode !== 'demo'; dm.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === src.demo));
  const bk = $('#bank'); if (bk) bk.textContent = S.bank > 0 ? `灵气存 ${fmtTok(S.bank)}` : '';
  if (S.sel != null) { const n = S.compass[S.sel], bar = document.querySelector(`.node[data-i="${S.sel}"] .nbar i`); if (n && bar) bar.style.width = Math.min(100, 100 * S.prog / (n.cost * src.unit)).toFixed(1) + '%'; }
  const hb = $('#healBar'); if (hb) hb.style.width = (100 * healPct()).toFixed(0) + '%';
  const q = $('#qiao'); if (q) { q.classList.toggle('flow', rate > 0 && S.sel != null); q.classList.toggle('hot', hot && rate > 0); }
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
  const btn = $('#bTheme'); if (btn) btn.textContent = { auto: '自', light: '日', dark: '夜' }[pref];
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
  while (vAcc >= 1) { vAcc--; VP.push({ x: -8, y: 6 + Math.floor(Math.random() * 3) * 8 + Math.random() * 2, c: '0123456789abcdef{}<>=;:/'[(Math.random() * 24) | 0], a: 0.25 + Math.random() * 0.6, z: hot && Math.random() < 0.18, v: 0.7 + Math.random() * 0.6 }); }
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
function shake(px) { const a = $('#arena'); if (a) a.animate([{ transform: 'none' }, { transform: `translate(${px}px,${-px / 2}px)` }, { transform: `translate(${-px}px,${px / 3}px)` }, { transform: `translate(${px / 2}px,0)` }, { transform: 'none' }], { duration: 240 }); }

// ---------- 斗蛊 ----------
// 对手：渡劫/无尽劫按规则生成，幽灵/战帖用传入阵容
function foeOf(kind, foe) {
  if (kind === 'trib') { const n = `${REALMS[S.realm + 1]}·${TRIB_NAMES[Math.min(S.realm, 4)]}`; return { team: tribTeam(S.realm), name: n, title: n.replace('·', ' · '), realm: S.realm + 1, marks: [] }; }
  if (kind === 'endless') return { team: endlessTeam(S.floor), name: `无尽劫·第${S.floor}层`, title: `无尽劫 · 第 ${S.floor} 层`, realm: 5, marks: [] };
  if (kind === 'ghost') return { team: foe.team, name: '幽灵·' + foe.name, title: `幽灵 · ${foe.name}（${foe.label || ''}）`, realm: S.realm, marks: [] };
  const n = foe.name || '无名蛊师'; return { team: foe.team, name: n, title: '战帖 · ' + n, realm: foe.realm || 0, marks: foe.marks || [] };
}
const myTeamFor = kind => (kind === 'duel' && (!S.started || !S.team.length)) ? starterTeam() : S.team;
const myMarksFor = kind => kind === 'duel' && !S.started ? [] : S.marks;
// ---------- 布阵：开战前看清敌阵、拖动调整站位、实时胜算 ----------
let PREP = null, oddsJob = 0;
function prep(kind, foe) {
  if (inBattle || (kind === 'trib' && S.realm >= 5) || (kind !== 'duel' && S.will <= 0)) return;
  const f = foeOf(kind, foe); PREP = { kind, foe, f, mine: myTeamFor(kind), last: null };
  renderPrep(true);
}
function renderPrep(open) {
  if (!PREP) return; const { f, kind } = PREP, mine = PREP.mine, canSort = mine === S.team && S.team.length > 1;
  const sum = t => `<span class="fsum">总 <i class="a">${t.reduce((a, g) => a + effA(g), 0)}</i><i class="h">${t.reduce((a, g) => a + effH(g), 0)}</i></span>`;
  const html = `<p class="eyebrow">布阵</p><h3>${esc(f.title)}</h3>
  <div class="fhead"><span class="lbl">敌阵 <small>点开看词条</small></span>${sum(f.team)}</div>${miniRow(f.team, 'foe', 'foe')}
  <div class="odds"><span class="olab">胜算约</span><b id="oddsN">…</b><span class="obar"><i id="oddsBar"></i></span><small id="oddsD">用同一套斗蛊规则推演 200 场</small></div>
  <div class="fhead"><span class="lbl">我阵 <small>${canSort ? '拖动换位 · 左为炉口，先上场' : '左为炉口，先上场'}</small></span>${sum(mine)}</div>${miniRow(mine, 'me', 'mine', canSort)}
  <p class="sm">${kind === 'duel' ? '' : '开战耗 1 点意志。'}站位决定谁先挨打：遗泽给身后、擂鼓给最前、先登要站最前、暗针要躲在后排、护卫和连心看左右邻。蓝角标是它从邻位拿到的加成。</p>
  <div class="row2"><button data-act="shut">再想想</button><button class="zhu big" data-act="fight">开战</button></div>`;
  const cur = $('.sheet.prep');
  if (open || !cur) sheet(html, 'prep'); else cur.innerHTML = '<button class="x" data-act="closeSheet">×</button>' + html;
  calcOdds(mine, f.team, myMarksFor(kind), f.marks);
}
function calcOdds(mine, enemy, ma, mb) {
  const job = ++oddsJob, A = decodeTeam(encodeTeam(mine, { marks: ma })), B = decodeTeam(encodeTeam(enemy, { marks: mb })), N = 200; let n = 0, w = 0;
  if (!A || !B) return;
  const step = () => {
    if (job !== oddsJob) return; const t0 = performance.now();
    while (n < N && performance.now() - t0 < 10) { const r = battle(A.team, B.team, 'odds:' + n, A.marks, B.marks); w += r.winner === 'A' ? 1 : r.winner === 'draw' ? 0.5 : 0; n++; }
    const pct = Math.round(100 * w / n), nb = $('#oddsN'), bar = $('#oddsBar'), d = $('#oddsD'); if (!nb) return;
    nb.textContent = pct + '%'; bar.style.width = pct + '%';
    if (n < N) { setTimeout(step, 0); return; }
    if (PREP) { if (PREP.last != null && PREP.last !== pct) d.innerHTML = `刚才换位：${PREP.last}% → <b>${pct}%</b>（${pct > PREP.last ? '+' : ''}${pct - PREP.last}）`; PREP.last = pct; }
  };
  step();
}
function startBattle(kind, foe) {
  if (inBattle) return;
  if (kind === 'trib' && S.realm >= 5) return;
  const F = foeOf(kind, foe), enemy = F.team, title = F.title, ename = F.name, erealm = F.realm;
  if (kind !== 'duel' && S.will <= 0) return;
  const mine = myTeamFor(kind);
  const ca = encodeTeam(mine, { name: S.name || '无名蛊师', realm: S.realm, marks: myMarksFor(kind) }), cb = encodeTeam(enemy, { name: ename, realm: erealm, marks: F.marks });
  const seed = kind === 'duel' ? hashStr(ca + '|' + cb).toString(36) : ((S.seed ^ Math.imul(++S.step, 2654435761)) >>> 0).toString(36);
  const A = decodeTeam(ca), Bt = decodeTeam(cb);
  const res = battle(A.team, Bt.team, 'r:' + seed, A.marks, Bt.marks);
  if (kind !== 'duel') S.will--;
  save(); playBattle({ kind, title, res, enemy, foe, tier: foe && foe.tier, A, B: Bt, replay: [ca, cb, seed, kind[0]].join('.') });
}
function parseReplay(text) {
  const m = String(text || '').match(/r=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([0-9a-z]+)(?:\.([tgd]))?/); if (!m) return null;
  const A = decodeTeam(m[1]), B = decodeTeam(m[2]); if (!A || !B) return null;
  return { A, B, seed: m[3], kind: m[4] || 'd', replay: [m[1], m[2], m[3], m[4] || 'd'].join('.') };
}
function openReplay(rp) {
  window.__guRp = rp;
  const row = t => `<div class="mini">${t.map(g => { const sk = skillOf(g); return `<div class="mg"><span class="art">${guSVG(g.sp)}</span><b>${SP[g.sp].n}</b><span class="st"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i></span>${sk && sk.named ? `<em class="cs">${esc(sk.n)}</em>` : `<span class="tr">${trChars(g.tr)}</span>`}</div>`; }).join('')}</div>`;
  sheet(`<p class="eyebrow">复盘</p><h3 class="duelh">${esc(rp.B.name || '无名')} 对 ${esc(rp.A.name || '无名')}</h3><p class="sm">同一组阵容、同一颗种子，重放的是一模一样的那一场。</p>${row(rp.B.team)}<p class="vsline">— 对 —</p>${row(rp.A.team)}<div class="row2"><button class="zhu big" data-act="replayGo">观看复盘</button></div>`);
}
function openLinkText(text) {
  const rp = parseReplay(text); if (rp) { openReplay(rp); return true; }
  const foe = decodeTeam(text); if (foe) { openDuel(foe); return true; }
  return false;
}
function replayURL(link) { return (/^https?:/.test(location.protocol) ? location.origin + location.pathname : SHARE_BASE) + '#r=' + link; }
function buHTML(uid, r) {
  return `<div class="bu${r.side ? ' foe' : ''}${r.boss ? ' boss' : ''}" data-uid="${uid}"><div class="bart">${guSVG(r.sp)}</div><div class="binfo"><b class="bnm">${esc(r.name)}</b><span class="bst"><i class="a"></i><i class="h"></i><i class="s" hidden></i></span><span class="btr">${trChars(r.tr)}</span>${r.combo ? `<em class="cs">${esc(r.combo)}</em>` : ''}</div></div>`;
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
    case 'buff': fxFloat(e.uid, e.sh ? `护+${e.sh}` : `+${e.a}/+${e.h}`.replace('/+0', '').replace('+0/', ''), 'buff'); return D(EV_MS.buff);
    case 'trig': {
      const lab = e.id ? TRAITS[e.id].n : e.mk ? '道痕·' + MARKS[e.mk].n : QUIRKS[e.q].n, ch = e.id ? TRAITS[e.id].ch : e.mk ? '道' : QUIRKS[e.q].n[0];
      const n = bnode(e.uid); if (n) { const g = el(`<span class="tg">${ch}</span>`); n.appendChild(g); setTimeout(() => g.remove(), 700); }
      blog(`${nm(e.uid)} · ${lab}`); return D(EV_MS.trig);
    }
    case 'combo': {
      const n = bnode(e.uid);
      if (e.quiet || seen.has(e.uid)) { if (n) { const g = el(`<span class="tg zhu">${esc(e.n[0])}</span>`); n.appendChild(g); setTimeout(() => g.remove(), 700); } return D(EV_MS.comboQuiet); }
      seen.add(e.uid); blog(`杀招【${e.n}】`);
      return comboCut(e.n, n, ros[e.uid]);
    }
    case 'summon': blog(`${nm(e.uid)} 现身`); return D(EV_MS.summon);
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
  const ov = el(`<div class="battle" id="battle"><div class="bbar"><span class="btitle">${esc(B.title)}</span><span class="bturn" id="bturn">开战</span><button class="ib" data-act="speed" id="bspd">${S.speed}×</button><button class="ib" data-act="skip">跳过</button></div>
  <div class="arena" id="arena"><div class="side sb" id="sideB"></div><div class="mid"><i></i><span>斗</span><i></i></div><div class="side sa" id="sideA"></div></div><div class="blog" id="blog"></div></div>`);
  document.body.appendChild(ov);
  const log = B.res.log, ros = B.res.roster, seen = new Set(); tempo = tempoFor(playMs(log)); chain = { side: -1, n: 0 };
  finalBlow = B.res.winner === 'draw' ? null : [...log].reverse().find(e => e.t === 'faint') || null;
  const hpSum = s => s.reduce((a, x) => a + x[2], 0), s0 = log[0].s[0], s1 = log[log.length - 1].s[0];
  B.comeback = B.res.winner === 'A' && hpSum(s1) <= 0.2 * hpSum(s0);
  B.crits = log.filter(e => e.t === 'dmg' && e.crit && e.src === 0).length;
  applySnap(log[0].s, ros);
  for (const e of log) { if (skip) break; await animEv(e, ros, seen); if (skip) break; applySnap(e.s, ros); }
  applySnap(log[log.length - 1].s, ros);
  showResult(B);
}
function wound() {
  S.team.forEach(g => { g.wound = Math.min(WOUND.max, (g.wound || 0) + 1); });
}
function showResult(B) {
  const w = B.res.winner, win = w === 'A', draw = w === 'draw';
  let txt = '', loot = [], btns = '';
  if (B.kind === 'replay') {}
  else if (B.kind === 'endless') {
    if (win) { S.wins++; S.endless = Math.max(S.endless, S.floor); S.floor++; txt = `破无尽劫第 ${S.floor - 1} 层。最高 ${S.endless} 层。`; }
    else if (draw) txt = '劫云僵持，未破此层。';
    else { S.losses++; wound(); txt = `止步第 ${S.floor} 层。全体轻伤 1 层，写代码约 1 分钟愈合一层。`; }
  }
  else if (B.kind === 'trib') {
    if (win) {
      S.realm++; S.wins++; S.team.forEach(g => { g.atk++; g.hp++; }); S.ghosts = null; S.shop = rollShop(R(), S.realm, S.shop);
      txt = `渡劫成功，晋${REALMS[S.realm]}。全体蜕变 +1/+1${slotCap(S.realm) > slotCap(S.realm - 1) ? '，空窍多开一格' : ''}。择一道痕，伴你整局：`;
      loot = rollMarks(R(), S.marks).map(k => ({ k: 'mark', id: k, t: `道痕【${MARKS[k].n}】${MARKS[k].d}` }));
    }
    else if (draw) txt = '劫云散去，未分胜负。';
    else { S.losses++; wound(); txt = '渡劫未成：全体轻伤 1 层，写代码约 1 分钟愈合一层。'; }
  } else if (B.kind === 'ghost') {
    if (win) {
      S.wins++; const r = R(), L = S.team[0];
      const atts = [...new Set(B.enemy.flatMap(g => g.att))], sps = [...new Set(B.enemy.map(g => g.sp))];
      if (S.team.length < curCap()) { const sp = atts.length ? r.pick(atts) : r.pick(sps); loot.push({ k: 'take', sp, t: `夺蛊：${SP[sp].n} 入空窍` }); }
      const trs = [...new Set(B.enemy.flatMap(g => g.tr.map(t => t[0])))].filter(id => { const e = L && L.tr.find(t => t[0] === id); return L && (e ? e[1] < MAXV : L.tr.length < MAXTR); });
      while (loot.length < 3 && trs.length) { const id = trs.splice(r.int(trs.length), 1)[0]; loot.push({ k: 'print', id, t: `拓印【${TRAITS[id].n}】→ ${SP[L.sp].n}` }); }
      if (!loot.length) loot.push({ k: 'boon', t: `${L ? SP[L.sp].n : '主蛊'} +2/+2` });
      txt = '胜。从败者残躯上取一样：';
    } else if (draw) txt = '两败俱伤，各自退去。';
    else { S.losses++; wound(); txt = '败。全体轻伤 1 层，写代码约 1 分钟愈合一层。'; }
  } else {
    txt = win ? '你接下了这封战帖，赢了。' : draw ? '平手。再养一养，回敬一封。' : '这封战帖的主人更强。去养蛊，再来。';
    btns = `<button class="zhu" data-act="replyDuel">回敬战帖</button>` + (S.started ? '' : `<button data-act="closeBattle">开始养自己的蛊</button>`);
  }
  if (B.kind === 'replay') {
    txt = draw ? '这一场打成了平手。' : `${esc((win ? B.A : B.B).name || '无名')} 胜。`;
    window.__guFoe = win || draw ? B.A : B.B;
    btns = `<button class="zhu" data-act="duelWinner">挑战胜者阵容</button>` + (S.started ? '' : `<button data-act="closeBattle">开始养自己的蛊</button>`);
  }
  let base = 0; const mults = [];
  if (B.kind === 'trib' || B.kind === 'ghost' || B.kind === 'endless') base = win ? ECON.win[B.kind === 'ghost' ? (B.tier || 'mid') : B.kind] : ECON.lose;
  if (base && win) {
    S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak);
    if (S.streak >= 2) mults.push([`${S.streak} 连胜`, +(1 + 0.25 * Math.min(S.streak - 1, 8)).toFixed(2)]);
    if (S.day !== today()) { S.day = today(); S.dayWin = false; }
    if (!S.dayWin) { S.dayWin = true; mults.push(['每日首胜', 3]); }
    if (B.comeback) mults.push(['绝境翻盘', 2]);
    if (B.crits >= 3) mults.push([`暴击 ${B.crits} 次`, 1.2]);
  } else if (base && !draw) S.streak = 0;
  if (base && S.marks.includes('shengCai')) mults.push(['生财有道', 1.5]);
  const gain = Math.round(mults.reduce((a, m) => a * m[1], base)); S.stone += gain; B.pay = { base, mults, gain };
  if (B.kind === 'ghost') S.ghosts = null;
  B.loot = loot; window.__guB = B; snd(win ? 'win' : draw ? 'pluck' : 'lose');
  let consol = '';
  if (!win && !draw && S.started && ['trib', 'ghost', 'endless'].includes(B.kind)) {
    const left = B.res.log[B.res.log.length - 1].s[1].reduce((a, x) => a + x[2], 0), got = [];
    if (S.sel != null && S.compass[S.sel]) { const c = S.compass[S.sel].cost * src.unit, add = Math.min(c * WOUND.loseNodePct, c - S.prog - 1); if (add > 0) { S.prog += add; got.push(`${NODES[S.compass[S.sel].type].n}进度 +${Math.round(100 * add / c)}%`); } }
    else { const add = WOUND.loseNodePct * 50 * src.unit; S.bank = Math.min(bankCap(), S.bank + add); got.push(`灵气 +${fmtTok(add)}`); }
    consol = `<div class="consol"><b>败亦有获</b>${got.map(t => `<span>${t}</span>`).join('')}${left > 0 ? `<em>敌阵只剩 ${fmtNum(left)} 血，差一点</em>` : ''}</div>`;
  }
  const panel = el(`<div class="result"><div class="rseal${win ? '' : ' lose'}">${win ? '胜' : draw ? '和' : '败'}</div>${B.comeback ? '<span class="goldtag">绝境翻盘</span>' : ''}<p class="rtxt">${txt}</p>${consol}
  ${base ? `<div class="payout" data-act="payskip"><span class="plab">元石</span><b class="pnum">0</b><div class="pmul"></div></div>` : ''}
  ${loot.map((l, i) => `<button class="loot" data-act="loot" data-i="${i}">${esc(l.t)}</button>`).join('')}
  <div class="rbtns">${btns}${loot.length ? '' : `<button data-act="closeBattle">${S.started ? '回空窍' : '关闭'}</button>`}<button data-act="copyReplay">复制复盘链接</button></div></div>`);
  $('#battle').appendChild(panel); save(); renderMeta();
  if (base) payout(panel.querySelector('.payout'), base, mults);
}
let payFast = false;
async function payout(box, base, mults) {
  payFast = false; const num = box.querySelector('.pnum'), row = box.querySelector('.pmul'); let cur = 0;
  const roll = (to, ms) => new Promise(res => { const from = cur, t0 = performance.now(); const f = now => { const k = Math.min(1, (now - t0) / ms); cur = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); num.textContent = fmtNum(cur); if (k < 1 && !payFast) requestAnimationFrame(f); else { cur = to; num.textContent = fmtNum(to); res(); } }; requestAnimationFrame(f); });
  await sleep(500); await roll(base, 450); snd('coin');
  let val = base;
  for (const [lab, m] of mults) {
    if (payFast) break; await sleep(300);
    row.appendChild(el(`<span class="mcard"><small>${esc(lab)}</small><b>×${m}</b></span>`)); snd('clack');
    box.animate([{ transform: 'translateY(3px)' }, { transform: 'none' }], { duration: 180 });
    val = val * m; await roll(Math.round(val), 420);
  }
  const total = Math.round(mults.reduce((a, m) => a * m[1], base));
  if (payFast) row.innerHTML = mults.map(([lab, m]) => `<span class="mcard"><small>${esc(lab)}</small><b>×${m}</b></span>`).join('');
  num.textContent = fmtNum(total); num.classList.add('final'); snd(mults.length ? 'coins' : 'coin');
}
function closeBattle() {
  const b = $('#battle'); if (b) b.remove(); inBattle = false;
  if (S.started) { if (S.compass.some(n => !nodeOk(n.type, S.team, curCap()))) { S.compass = rollCompass(R(), S.team, false, curCap()); S.sel = null; S.prog = 0; } renderAll(); }
  else renderAll();
  save();
}

// ---------- 弹层（只由玩家点击打开）----------
function sheet(html, cls = '', stack = false) {
  if (!stack) document.querySelectorAll('.sheet-bg').forEach(x => x.remove());
  const s = el(`<div class="sheet-bg${stack ? ' stack' : ''}" data-act="closeSheet"><div class="sheet ${cls}" data-stop="1"><button class="x" data-act="closeSheet">×</button>${html}</div></div>`);
  document.body.appendChild(s); return s;
}
function closeSheet() { const a = document.querySelectorAll('.sheet-bg'); if (a.length) a[a.length - 1].remove(); }
// 统一详情面板：自己的蛊、蛊市货架、敌蛊都用它。ctx.kind = mine | shop | foe | view
function guDetail(g, ctx = {}) {
  const s = SP[g.sp], sk = skillOf(g), team = ctx.team, i = ctx.i | 0, kind = ctx.kind || 'view';
  const recv = team ? posLinks(team).filter(l => l.to === i && l.from !== i) : [];
  const w = kind === 'shop' ? S.shop[i] : null, cost = buyCost(), cap = curCap();
  const merge = w && S.team.filter(x => x.sp === w.sp && (x.star || 1) === 1).length >= 2;
  sheet(`<div class="detail"><div class="dart">${guSVG(g.sp)}</div><div><h3>${g.boss ? '劫·' : ''}${s.n}${(g.star || 1) > 1 ? ` <small>★${g.star}</small>` : ''}</h3><p class="lore">${kind === 'foe' ? '<span class="foetag">敌</span>' : ''}${s.lore}${g.clone ? ' · 分身' : ''}</p><p class="dst"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i>${g.wound ? ` <span class="wd">伤 ${g.wound} 层</span>` : ''}</p>${team && kind !== 'shop' ? `<p class="sm">站位：${kind === 'foe' ? '敌阵' : '我阵'}第 ${i + 1} 位${i === 0 ? '（最前）' : ''}</p>` : ''}</div></div>
  <h4>词条</h4><ul>${g.tr.map(([id, v]) => { const pn = team && kind !== 'shop' ? posNote(team, i, id) : ''; return `<li><b>${TRAITS[id].n}${v > 1 ? ` ${v}层` : ''}</b>${TRAITS[id].d(v)}${pn ? `<em class="pn">→ ${esc(pn)}</em>` : ''}</li>`; }).join('')}</ul>
  ${recv.length ? `<h4>站位加成</h4><ul>${recv.map(l => `<li><b>${TRAITS[l.id].n}</b>来自 ${SP[team[l.from].sp].n}：${esc(l.txt)}</li>`).join('')}</ul>` : ''}
  ${g.q.length ? `<h4>怪癖</h4><ul>${g.q.map(q => `<li><b>${QUIRKS[q].n}</b>${QUIRKS[q].d}</li>`).join('')}</ul>` : ''}
  ${sk ? `<h4>杀招</h4><div class="skill"><span class="seal${sk.named ? '' : ' pale'}">${esc(sk.n)}</span><p>${esc(sk.d)}<br><small>附蛊：${g.att.map(a => SP[a].n).join('、')}</small></p></div>` : ''}
  ${kind === 'mine' ? `<h4>算力履历</h4><p class="hist">累计喂养 <b>${fmtTok(g.fed)}</b> token · 突变 <b>${g.mut || 0}</b> 次</p>
  <div class="row2"><button data-act="mv" data-i="${i}" data-d="-1"${i === 0 ? ' disabled' : ''}>← 左移</button><button data-act="mv" data-i="${i}" data-d="1"${i >= S.team.length - 1 ? ' disabled' : ''}>右移 →</button></div>
  <div class="row2"><button data-act="sell" data-i="${i}"${S.team.length > 1 ? '' : ' disabled'}>出售 +${sellValue(g)}◈</button></div>
  <p class="sm">左为炉口：多数罗盘节点作用在最左那只；炼附取最右那只。在空窍里直接拖动也能换位。${(g.star || 1) > 1 ? ` ★${g.star}：词条位 ${trCap(g)} 个。` : ''}</p>` : ''}
  ${w ? `<div class="row2"><button data-act="freeze" data-i="${i}">${w.frozen ? '解冻' : '冻结（刷新时保留）'}</button><button class="zhu" data-act="buy" data-i="${i}"${!w.sold && S.stone >= cost && canBuy(S.team, w.sp, cap) ? '' : ' disabled'}>${!canBuy(S.team, w.sp, cap) ? '空窍已满' : (merge ? '买下并合炼 ' : '买下 ') + cost + '◈'}</button></div><p class="sm">${merge ? '你已有两只同种 ★1，买下立即三合一升星。' : '同种三只自动合炼升星。'}余 ${S.stone}◈</p>` : ''}
  <details class="book"><summary>杀招配方（${COMBOS.length}）</summary><ul>${COMBOS.map(c => `<li><b>${c.n}</b>${c.need.map(x => SP[x].n).join(' + ')}</li>`).join('')}</ul></details>`, '', ctx.stack);
}
function openGu(i) { const g = S.team[i]; if (g) guDetail(g, { kind: 'mine', i, team: S.team }); }
function shareText(code) { return `我在《蛊码》养了一窝蛊（${REALMS[S.realm]}），敢接战帖吗？\n界壁坐标码：${code}`; }
const SHARE_BASE = 'https://1596941391qq.github.io/gu-code/';
function shareURL(code) { return (/^https?:/.test(location.protocol) ? location.origin + location.pathname : SHARE_BASE) + '#c=' + code; }
function myCode() { return encodeTeam(S.team.length ? S.team : starterTeam(), { name: S.name, realm: S.realm, marks: S.marks }); }
function openGhosts() {
  if (!S.ghosts || S.ghosts.realm !== S.realm) { const r = R(); S.ghosts = { realm: S.realm, list: ghostTrio(r, Math.max(1, S.nodes) + S.realm, S.realm).map(o => ({ tier: o.tier, label: o.label, name: o.name, code: encodeTeam(o.team, { name: '幽灵·' + o.name, realm: S.realm }) })) }; save(); }
  sheet(`<h3>斗幽灵 · 择一对手</h3><p class="sm">阵容摆在明面上，越难元石越多；胜了还能从残躯上夺一样。每场耗 1 点意志（余 ${S.will}）。</p>${S.ghosts.list.map((o, i) => { const d = decodeTeam(o.code); return `<div class="foeopt"><div class="fh"><b class="tier t-${o.tier}">${o.label}</b><span class="fn">${esc(o.name)}</span><span class="rw">胜 +${ECON.win[o.tier]}◈</span></div>${miniRow(d.team, 'foe', 'g' + i)}<button class="zhu" data-act="ghostGo" data-i="${i}"${S.will > 0 ? '' : ' disabled'}>应战</button></div>`; }).join('')}`);
}
let cardURL = '';
async function openShare() {
  const code = myCode(), url = shareURL(code);
  sheet(`<h3>界壁坐标码</h3><p class="sm">发给朋友。对方${url ? '打开链接，或' : ''}在蛊码里粘贴坐标码，就会和你这支阵容开打。</p>
  <label class="row"><span>蛊师名号</span><input id="nm" maxlength="8" value="${esc(S.name)}" placeholder="无名蛊师"></label>
  <div class="code" id="codeTxt">${code}</div>
  <div class="row2"><button data-act="copyCode">复制坐标码</button><button data-act="copyLink">${url ? '复制战帖链接' : '复制战帖文案'}</button></div>
  <div class="cardbox"><img id="cardImg" alt="分享卡"><div class="row2"><button class="zhu" data-act="savePng">保存分享卡 PNG</button></div><p class="sm">${VSC ? '' : '手机上可长按图片保存。'}</p></div>`);
  $('#nm').addEventListener('change', e => { S.name = e.target.value.trim().slice(0, 8); save(); openShare(); });
  cardURL = ''; const img = $('#cardImg');
  try { cardURL = await makeCard({ team: S.team.length ? S.team : starterTeam(), name: S.name, realm: S.realm, total: S.total, muts: S.muts, wins: S.wins, code, url, endless: S.endless }); if (img) img.src = cardURL; } catch (e) { if (img) img.alt = '分享卡生成失败'; }
}
function copy(text, btn) {
  const done = () => { if (btn) { const o = btn.textContent; btn.textContent = '已复制'; setTimeout(() => { btn.textContent = o; }, 1200); } };
  if (VSC) { VSC.postMessage({ type: 'copy', text }); return done(); }
  const fb = () => { const t = el('<textarea></textarea>'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} t.remove(); done(); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fb); else fb();
}
function openDuelInput() {
  sheet(`<h3>应战</h3><p class="sm">粘贴朋友发来的界壁坐标码、战帖链接或复盘链接。</p><textarea id="duelIn" rows="3" placeholder="坐标码"></textarea><p class="err" id="duelErr"></p><div class="row2"><button class="zhu" data-act="duelGo">查看战帖</button></div>`);
  setTimeout(() => { const t = $('#duelIn'); if (t) t.focus(); }, 50);
}
function openDuel(foe) {
  if (!foe) return;
  const mine = S.started && S.team.length ? S.team : starterTeam();
  window.__guFoe = foe;
  sheet(`<p class="eyebrow">界壁震动</p><h3 class="duelh">有人向你下战帖</h3><p class="sm">来自 <b>${esc(foe.name || '无名蛊师')}</b> · ${REALMS[foe.realm] || '凡人'}</p>${miniRow(foe.team, 'foe', 'duel')}
  <p class="vsline">— 你的${S.started && S.team.length ? '空窍' : '初始阵容'} —</p>${miniRow(mine, '', 'duelMine')}<div class="row2"><button class="zhu big" data-act="duelFight">布阵应战</button></div>`);
}
function checkHash() {
  const h = location.hash; if (!/[#&](c|r)=/.test(h)) return;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  openLinkText(h);
}

// ---------- 拖动换位 ----------
let drag = null, dragEndT = 0;
const moveIdx = (arr, f, t) => { const [x] = arr.splice(f, 1); arr.splice(t, 0, x); };
const SORT = {
  team(f, t) { moveIdx(S.team, f, t); renderSlots(); renderPhase(); renderHint(); save(); snd('clack'); },
  mine(f, t) { moveIdx(S.team, f, t); renderSlots(); renderPhase(); save(); snd('clack'); renderPrep(false); },
};
document.addEventListener('pointerdown', e => {
  const it = e.target.closest('[data-drag]'), box = it && it.closest('[data-sort]');
  if (!it || !box || e.button > 0) return;
  drag = { it, box, from: +it.dataset.drag, to: +it.dataset.drag, x0: e.clientX, y0: e.clientY, ghost: null, items: [...box.querySelectorAll('[data-drag]')] };
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
  if (d.to !== d.from && SORT[d.box.dataset.sort]) SORT[d.box.dataset.sort](d.from, d.to);
}
window.addEventListener('pointerup', dragEnd); window.addEventListener('pointercancel', dragEnd);

// ---------- 交互 ----------
const ACT = {
  pick(a) { S.team = [newGu(a.dataset.sp)]; S.started = true; S.shop = rollShop(R(), 0, []); S.compass = rollCompass(R(), S.team, true, curCap()); save(); renderAll(); },
  node(a) {
    const i = +a.dataset.i; if (S.sel === i) return;
    if (S.sel != null) S.bank = Math.min(bankCap(), S.bank + S.prog);
    S.sel = i; S.prog = 0; S.wh = 0;
    const cost = S.compass[i].cost * src.unit, take = Math.min(S.bank, cost); S.prog = take; S.bank -= take;
    renderPhase(); renderHint(); snd('pluck'); save();
    if (S.prog >= cost - 0.5) setTimeout(() => { if (S.sel === i && !inBattle) resolveNode(); }, 500);
  },
  gu(a) { openGu(+a.dataset.i); },
  mv(a) { const i = +a.dataset.i, j = i + +a.dataset.d; if (!S.team[j]) return; [S.team[i], S.team[j]] = [S.team[j], S.team[i]]; closeSheet(); renderSlots(); renderPhase(); save(); openGu(j); },
  demo(a) { src.demo = a.dataset.m; meters(); },
  src() { if (VSC) { src.setMode(src.mode === 'vscode' ? 'demo' : 'vscode'); renderPhase(); renderHint(); meters(); } else sheet(`<h3>真实 Token</h3><p class="sm">网页版默认是演示流。想让真实的 Claude Code / Codex 用量来养蛊，请装 VS Code 插件版（gu-code/vscode-ext），它只读会话里的 usage 数字，不读内容。</p>`); },
  theme() { S.theme = { auto: 'light', light: 'dark', dark: 'auto' }[S.theme || 'auto']; applyTheme(); save(); },
  sound() { S.mute = !S.mute; $('#bSound').textContent = S.mute ? '静' : '声'; save(); snd('pluck'); },
  share() { openShare(); },
  trib() { prep('trib'); }, ghost() { openGhosts(); }, endless() { prep('endless'); },
  path() { openPath(); }, codex() { openCodex(); },
  ghostGo(a) { const o = S.ghosts && S.ghosts.list[+a.dataset.i]; if (!o || S.will <= 0) return; const d = decodeTeam(o.code); prep('ghost', { team: d.team, name: o.name, tier: o.tier, label: o.label }); },
  choose(a) { const p = S.pending; if (!p) return; finishNode(p.node, p.opts[+a.dataset.i], p.wu, p.cost); },
  buy(a) {
    const w = S.shop[+a.dataset.i], cost = buyCost(); if (!w || w.sold || S.stone < cost) return;
    const r = buyGu(S.team, w.sp, curCap(), S.marks, R()); if (!r) return; closeSheet();
    S.stone -= cost; w.sold = true; w.frozen = false;
    renderSlots(); renderShop(); renderPhase(); save(); snd('pluck');
    setTimeout(() => { if (r.merged.length) { const g = r.merged[r.merged.length - 1]; fxFloat(g.uid, `合炼 ★${g.star}`, 'mut'); stampIn($('#qiao'), '合炼', false, 'side'); } else fxFloat(r.gu.uid, '入窍', 'new'); }, 60);
  },
  refresh() { const c = refCost(); if (S.stone < c) return; S.stone -= c; S.shop = rollShop(R(), S.realm, S.shop); renderMeta(); renderShop(); save(); },
  freeze(a) { const i = +a.dataset.i, w = S.shop[i]; if (w) { w.frozen = !w.frozen; renderShop(); save(); if (a.closest('.sheet')) guDetail(newGu(w.sp), { kind: 'shop', i }); } },
  sell(a) { const i = +a.dataset.i, g = S.team[i]; if (!g || S.team.length <= 1) return; S.stone += sellValue(g); S.team.splice(i, 1); closeSheet(); renderSlots(); renderShop(); renderPhase(); save(); },
  marksInfo() { if (S.marks.length) sheet(`<h3>道痕</h3><p class="sm">整局被动，渡劫成功时三选一。</p><ul>${S.marks.map(k => `<li><b>${MARKS[k].n}</b>${MARKS[k].d}</li>`).join('')}</ul>`); },
  speed() { S.speed = S.speed === 1 ? 2 : 1; $('#bspd').textContent = S.speed + '×'; save(); },
  skip() { skip = true; },
  payskip() { payFast = true; },
  loot(a) {
    const l = window.__guB.loot[+a.dataset.i], L = S.team[0];
    if (l.k === 'mark') { if (!S.marks.includes(l.id)) S.marks.push(l.id); }
    else if (l.k === 'take' && S.team.length < curCap()) S.team.push(newGu(l.sp));
    else if (l.k === 'print' && L) addTrait(L, l.id, 1);
    else if (L) { L.atk += 2; L.hp += 2; }
    closeBattle();
  },
  closeBattle() { closeBattle(); },
  replyDuel() { closeBattle(); openShare(); },
  closeSheet(a, e) { if (e.target.closest('[data-stop]') && !a.classList.contains('x')) return; closeSheet(); },
  shut() { closeSheet(); },
  ware(a) { const w = S.shop[+a.dataset.i]; if (w && !w.sold) guDetail(newGu(w.sp), { kind: 'shop', i: +a.dataset.i }); },
  peek(a) { const t = FOE[a.dataset.k], i = +a.dataset.i; if (t && t[i]) guDetail(t[i], { kind: a.dataset.k === 'mine' ? 'view' : 'foe', i, team: t, stack: !!a.closest('.sheet') }); },
  fight() { const P = PREP; if (!P) return; oddsJob++; PREP = null; closeSheet(); startBattle(P.kind, P.foe); },
  copyCode(a) { copy(myCode(), a); },
  copyLink(a) { const c = myCode(), u = shareURL(c); copy(u ? shareText(c) + '\n' + u : shareText(c), a); },
  savePng() {
    if (!cardURL) return;
    if (VSC) VSC.postMessage({ type: 'savePng', data: cardURL });
    else { const a = document.createElement('a'); a.href = cardURL; a.download = 'gucode-card.png'; document.body.appendChild(a); a.click(); a.remove(); }
  },
  duelInput() { openDuelInput(); },
  duelGo() { if (!openLinkText($('#duelIn').value)) $('#duelErr').textContent = '坐标码或复盘链接不对，或者被截断了。'; },
  replayGo() { const rp = window.__guRp; closeSheet(); playBattle({ kind: 'replay', title: `复盘 · ${rp.B.name || '无名'} 对 ${rp.A.name || '无名'}`, res: battle(rp.A.team, rp.B.team, 'r:' + rp.seed, rp.A.marks, rp.B.marks), A: rp.A, B: rp.B, enemy: rp.B.team, replay: rp.replay }); },
  duelWinner() { closeBattle(); startBattle('duel', window.__guFoe); },
  copyReplay(a) {
    const B = window.__guB, w = B.res.winner, an = B.A.name || '无名', bn = B.B.name || '无名';
    const wt = w === 'draw' ? '打成平手' : (w === 'A' ? an : bn) + ' 胜';
    copy(`《蛊码》复盘：${an} 对 ${bn}，${wt}。点开看整场：\n${replayURL(B.replay)}`, a);
  },
  duelFight() { prep('duel', window.__guFoe); },
  reset(a) {
    if (Date.now() - resetArm > 3000) { resetArm = Date.now(); a.textContent = '再点一次确认重开'; setTimeout(() => { a.textContent = '重开一局'; }, 3000); return; }
    codexScan(); const keep = { sound: S.sound, name: S.name, total: S.total, theme: S.theme, codex: S.codex }; S = Object.assign(fresh(), keep); save(); renderAll();
  },
};
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a || a.disabled || performance.now() - dragEndT < 250) return;
  const f = ACT[a.dataset.act]; if (f) f(a, e);
});

// ---------- 启动 ----------
function boot(saved, pending) {
  const mg = migrate(saved); if (mg) S = Object.assign(fresh(), mg);
  if (!document.getElementById('gu-defs')) document.body.insertAdjacentHTML('afterbegin', `<svg id="gu-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${ART_DEFS}</defs></svg>`);
  applyTheme(); if (VSC && window.MutationObserver) new MutationObserver(applyTheme).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  booted = true; renderAll(); requestAnimationFrame(veinLoop);
  if (pending && pending.tokens > 0 && S.started) { feed(pending.tokens, pending.hot || 0); renderSlots(); renderPhase(); const h = $('#hint'); if (h) h.textContent = `你不在的时候，蛊吸纳了 ${fmtTok(pending.tokens)} token。`; }
  checkHash();
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
  const go = () => boot(s); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  window.addEventListener('hashchange', checkHash);
}
