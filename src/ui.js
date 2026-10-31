// 蛊码 GuCode · 界面与流程（渲染层；逻辑都在 core/battle）
import { natMulFor, natOf, awOf, guRank, cleanTr, mergeAll, makeRng, SPECIES, SP, TRAITS, QUIRKS, NODES, REALMS, TRIB_NAMES, GHOST_NAMES, SLOTS, MAXTR, MAXV, newGu, starterTeam, skillOf, comboOf, nodeOk, rollCompass, applyNode, genTeam, tribTeam, encodeTeam, decodeTeam, fmtTok, addTrait, COMBOS, hashStr, slotCap, SLOT_BY_REALM, poolFor, ECON, MARKS, rollMarks, nodeChoices, rollShop, canBuy, buyGu, sellValue, ghostTrio, trCap, REALM_NOTES, POOL_TIERS, endlessTeam, ENDLESS, EV_MS, playMs, tempoFor, fmtNum, spTraits, posLinks, posNote, WOUND, RANK, baseRank, rankOf, fuseLv, canWield, rankName, BAG, bagCap, canTake, placeGu, meltValue, sameRank } from './core.js';
import { battle } from './battle.js';
import { guSVG, ART_DEFS } from './art.js';
import { TokenSource, VSC } from './tokens.js';
import { makeCard } from './card.js';
import { ledgerInit, openLedger, ledgerShades, ledgerLimitRows, ledgerBindLimits, ledgerApply, ledgerLive, ledgerData, ledgerFeedMul, ledgerStoneMul } from './ledger.js';
import { metaInit, metaMigrate, metaEmit, levelInfo, LEVEL_REWARDS, RARITY, CHESTS, TITLES, UNLOCKS, UNLOCK_ORDER, isUnlocked, rollRarity, applyRarity, openCocoon, openChest, pityLeft, rarityOdds, metaPool, feedTeam, feedGu, qiText, streakInfo, charmCost, canGuardStreak, shopFlags, rigShop, META_TUNE, dailyView, achList, titleName, setTitle, ACH_TIER } from './meta.js';
import { TUTORIAL_STEPS, startTutorial, tutorialEvent, tutorialActive } from './tutorial.js';

const KEY = 'gucode.v1', WILL_MAX = 5, WILL_SEC = 120, WILL_TOK = 60;
const $ = (s, r = document) => r.querySelector(s);
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const setHTML = (n, h) => { if (n._h !== h) { n.innerHTML = h; n._h = h; } };   // 内容没变就不重绘，悬停提示不会被打断
// ---------- 新增界面文案集中在这里（之后统一换成 guide.js 的术语）----------
const TXT = {
  rankBadge: g => `${RANK.ch[rankOf(g)]}转`,
  rankTip: g => `${rankName(g)}：${SP[g.sp].n}生来${RANK.names[baseRank(g.sp)]}${fuseLv(g) ? `，已合炼 ${fuseLv(g)} 次` : ''}。三只同种同转合炼成高一转，同一只最多炼 ${RANK.fuse} 次。`,
  sealed: '境界不够',
  qiTip: '你烧掉的 token 先存成灵气，选了路就灌进节点',
  qiIdle: '选一条路，灵气就灌进去',
  sealedTip: g => `境界不够，驱使不了${RANK.names[rankOf(g)]}的蛊：要到${REALMS[Math.min(5, rankOf(g) - RANK.over)]}才行。现在可以收着、照常长，但不上阵；渡劫晋阶后自动能用。`,
  noWield: '空窍里没有驱使得动的蛊，先招一只低转的蛊。',
  rankIntro: '蛊有转数：凡人驱使一转蛊，每晋一阶多驱使一转。三只同种同转合炼成高一转。',
  sealIntro: g => `境界不够，驱使不了${RANK.names[rankOf(g)]}的蛊：${rankName(g)}先收着不上阵，晋阶后就能用。`,
  shopNote: '三只同种同转合炼成高一转',
  bagRowTip: () => `蛊囊 ${S.bag.length}/${BC()}：开茧和奖励得到的蛊先放这里，拖进空窍才会上阵。蛊囊里的蛊不参战，灵气只吃一半；凑够三只同种同转自动合炼。每升一阶多 ${BAG.perRealm} 格。`,
  bagIntro: '蛊囊：开茧和奖励得到的蛊先放在空窍下面这一行，拖进空窍才会上阵。凑够三只同种同转会自动合炼。',
  bagFuse: '可合炼', bagFuseTip: g => `再得一只${rankName(g)}，三只自动合炼成${RANK.names[Math.min(RANK.max, rankOf(g) + 1)]}`,
  bagCombo: '可成杀招', bagComboTip: (g, c) => `走「炼附」节点时选它炼进主蛊${SP[S.team[0].sp].n}，成杀招【${c.n}】：${c.d}`,
  cocoonBtn: n => { const left = BC() - S.bag.length; return left > 0 ? `开茧 ×${n} · 进蛊囊（剩 ${left} 格）` : `开茧 ×${n} · 蛊囊满了，开出后选去处`; },
  bagHead: `蛊囊里的蛊不参战，灵气只吃一半（${Math.round(BAG.feedMul * 100)}%）。把蛊拖进上面的空窍就上阵，拖下来就收进蛊囊；点开一只可以上阵、收起或出售。`,
  toBag: (g, mode) => `${rankName(g)}进了蛊囊${mode === 'shop' ? '（空窍满了）' : ''}，拖进空窍才会上阵。`,
  canFuse: '可合炼',
  fuseTip: (sp, n) => `再买 ${n} 只即可炼成${RANK.names[baseRank(sp) + 1]}${SP[sp].n}${TXT.mergeWarn(sp, S.realm)}`,
  trio: (sp, c) => `三只一起炼 · ${RANK.names[baseRank(sp) + 1]}${SP[sp].n} · ${c}◈（8 折）`,
  trioTip: '货架上三只同种：一起买打 8 折，买下当场炼成高一转，只占 1 个位置；你已有同种也会接着合炼。',
  cocoonIntro: '蛊茧：开出一只随机的蛊。茧开出的蛊会自动合炼，或者放进蛊囊；满了也不会浪费，可以替换一只、炼化成元石或先存着。',
  cocoonDest: () => { const left = BC() - S.bag.length; return left > 0 ? `开出的蛊将进入蛊囊（剩 ${left} 格），能和已有的同种同转凑成三只就自动合炼` : '蛊囊满了：开出后若能合炼就自动合炼，否则让你选去处（替换 / 炼化 / 暂存），不会浪费'; },
  fullHead: g => `蛊囊满了，${rankName(g)}放哪？`,
  fullSwap: '替换一只：点选要换下的蛊，它按卖价折成元石',
  fullMelt: (g, v) => `炼化：把${rankName(g)}折成 ${v} 元石（按品质，比卖价多五成起）`,
  fullHold: '暂存：放回茧托盘，开出的结果保留，以后再开',
  heldTip: n => `其中 ${n} 个是暂存的，开出结果已定`,
  // 奖励说人话：是什么 · 有什么用 · 放到哪了
  rw: r => { const why = r.why ? `（${r.why}）` : '';
    switch (r.k) {
      case 'stone': return `元石 +${r.n}${why} · 蛊市买蛊、转市用 · 已存入`;
      case 'xp': return `经验 +${r.n}${why} · 攒满升级拿奖励 · 已计入`;
      case 'chest': return `${CHESTS[r.tier] ? CHESTS[r.tier].n : '宝箱'} ×1${why} · 打开当场变成元石、经验，可能有蛊茧 · 在右上「箱」里，点一下就开`;
      case 'cocoon': return `蛊茧 ×1${r.n ? `（至少${RQ(r.n).n}品）` : ''}${why} · 开出一只随机的蛊，茧开出的才有品质 · 在蛊囊旁「开茧」`;
      case 'species': return `新蛊种：${SP[r.id] ? SP[r.id].n : r.id}${why} · 以后蛊市和招蛊会出现它 · 已进蛊池`;
      case 'slot': return `蛊市 +1 格${why} · 每次多一只货可挑 · 已生效`;
      case 'title': { const t = TITLES.find(x => x.id === r.id); return `称号「${t ? t.n : r.id}」${why} · 显示在战帖分享卡上 · 在成就页换上`; }
      case 'charm': return `元石 +${META_TUNE.streak.charmCost}${why} · 已存入`;
    } return ''; },
  // 开打前的奖惩：数字都从表里取
  stakes: (kind, tier) => {
    const k = kind === 'ghost' ? (tier || 'mid') : kind, D = META_TUNE.drop[k], sp = META_TUNE.spoils[k], pc = x => Math.round(x * 100) + '%';
    const hurt = '蛊受轻伤 1 层（写代码约 1 分钟愈合一层）';
    if (kind === 'duel') return { win: D ? `${pc(D.p)} 掉宝箱` : '无', lose: '没有任何损失' };
    const w = [`元石 +${ECON.win[k] || 0}`]; if (kind === 'trib') w.unshift(`晋${REALMS[Math.min(5, S.realm + 1)]}、择一道痕`);
    if (sp) w.push(sp >= 1 ? '必得蛊茧' : `${pc(sp)} 得蛊茧`); if (D) w.push(D.p >= 1 ? '必掉宝箱' : `${pc(D.p)} 掉宝箱`);
    return { win: w.join('，'), lose: `元石 +${ECON.lose}，${hurt}` };
  },
  stakesLine: (kind, tier) => { const x = TXT.stakes(kind, tier); return `赢了：${x.win}｜输了：${x.lose}`; },
  mergeWarn: (sp, realm) => { const r = baseRank(sp) + 1; return r > realm + RANK.over ? `（炼成${RANK.names[r]}后要${REALMS[Math.min(5, r - RANK.over)]}才能驱使）` : ''; },
  // 试玩存档：网页模拟灵流养出来的蛊，对外的坐标码、分享卡、战帖、复盘都带这个标
  trial: '试玩',
  trialShare: '这是网页试玩存档（模拟灵流养的蛊），坐标码、分享卡、战帖和复盘都会标「试玩」。装 VS Code 插件、用真实 token 养的蛊不带这个标。',
  trialFoe: '对方是试玩存档（网页模拟灵流养的蛊，不是真实 token 养出来的）',
  trialText: '【试玩存档】',
  srcLive: '实时 token',
  srcDemo: '模拟灵流 ?',
  srcHead: '灵流从哪来',
  srcFrom: '插件读取本机 Claude Code、Codex 等 AI 工具日志里的 token 用量数字，不读对话和代码内容。插件里只认真实 token，不能切到模拟灵流。',
  srcNone: '现在没有工具在烧 token，灵流为 0。开始写代码就会涨。',
  demoHead: '这里是模拟灵流',
  demoFrom: '网页读不到你电脑上的 AI 用量，这里按真实写代码时的常见流速（每秒约 500～1500 token）模拟。上面的「写代码中 / 停手休息」切换模拟状态。',
  demoTrial: '网页存档是试玩存档：分享出去的坐标码、分享卡、战帖和复盘都会标「试玩」，也不能导入插件。',
  demoInstall: '想用真实 token 养蛊，装 VS Code 插件。插件只读本机 Claude Code、Codex 等工具日志里的用量数字，不读对话和代码内容。',
};
const trialTag = on => on ? `<span class="trialtag">${TXT.trial}</span>` : '';
function stakesHTML(kind, tier) { const x = TXT.stakes(kind, tier); return `<b class="sw">赢了</b>${esc(x.win)}<br><b class="sl">输了</b>${esc(x.lose)}`; }
const fresh = () => ({ v: 2, started: false, name: '', team: [], realm: 0, nodes: 0, compass: [], sel: null, prog: 0, wh: 0, bank: 0, repair: 0, will: 3, willT: 0, willK: 0, total: 0, muts: 0, wins: 0, losses: 0, seed: (Math.random() * 1e9) | 0, step: 0, sound: false, speed: 1, theme: 'auto', mute: false, stone: 5, stoneK: 0, shop: [], pending: null, marks: [], ghosts: null, floor: 1, endless: 0, codex: { sp: [], combo: [] }, healT: 0, calm: false, stats: false, log: [], gains: [], todayKey: '', todayTok: 0, meta: null, tutDone: false, seen: 0, tips: {}, bag: [], held: [], streak: 0, bestStreak: 0, day: '', dayWin: false });
const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const curCap = () => Math.max(slotCap(S.realm), S.team.length), BC = () => Math.max(bagCap(S.realm), S.bag.length);
const buyCost = () => S.marks.includes('shiJing') ? 2 : ECON.buy, refCost = () => S.marks.includes('shiJing') ? 0 : ECON.refresh;
function migrate(s) {
  if (!s || !s.v) return null; if (s.v === 1) { s.v = 2; s.stone = 5 + Math.min(20, s.nodes || 0); s.will = Math.max(s.will || 0, 3); }
  (s.team || []).forEach(g => { if (g.rank == null) g.rank = baseRank(g.sp) + Math.max(0, (g.star || 1) - 1); delete g.star; });   // 星级 → 转数
  return s.v === 2 ? s : null;
}

let S = fresh(), phase = 'yang', rate = 0, hot = false, inBattle = false, booted = false, skip = false, resetArm = 0;
const src = new TokenSource(onTick);
const R = () => makeRng(S.seed + ':' + (S.step++));
const effA = g => Math.max(1, g.atk - (g.wound || 0)), effH = g => Math.max(1, g.hp - (g.wound || 0));
const natDesc = sp => { const k = natOf(sp); return k ? `本命·${TRAITS[k].n}：${TRAITS[k].d(1, natMulFor(SP[sp].rank))}` : ''; };
const natChip = g => { const k = natOf(g.sp); return k ? `<span class="tc nat" data-tip="${esc('本命·' + TRAITS[k].n + '：' + TRAITS[k].d(1, natMulFor(guRank(g))))}">${TRAITS[k].ch}</span>` : ''; };
const trChars = tr => (Array.isArray(tr) ? tr : Object.entries(tr)).map(([id, v]) => `<span class="tc" data-tip="${esc(TRAITS[id].n + (v > 1 ? ` ${v}层` : '') + '：' + TRAITS[id].d(v))}">${TRAITS[id].ch}${v > 1 ? `<sup>${v}</sup>` : ''}</span>`).join('');

// ---------- 存档 ----------
let saveT;
function save() {
  if (saveT) return;   // 节流而非防抖：持续有 token 流入时也能按时落盘
  saveT = setTimeout(() => {
    saveT = null; codexScan(); S.seen = Date.now();
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
  <h4>开茧品质（公开概率）</h4><div class="odds-t">${rarityOdds().map(r => `<span class="r${RARITY.findIndex(x => x.id === r.id)}"><i class="rq r${RARITY.findIndex(x => x.id === r.id)}">${r.n}</i>${r.pct}%</span>`).join('')}</div><p class="sm">天机：每 ${META_TUNE.pity.every} 次开茧必出绝或天，新手第一次 ${META_TUNE.pity.firstEvery} 次以内。当前距天机 ${pityLeft(M())}。招蛊、蛊市、夺蛊、宝箱里的茧都算开茧。</p>
  <h4>杀招</h4><ul>${COMBOS.map(c => cx.combo.includes(c.id) ? `<li><b>${c.n}</b>${c.need.map(x => SP[x].n).join(' + ')}：${c.d}</li>` : `<li class="unk"><b>？？？</b>${SP[c.need[0]].n} + ${c.need.slice(1).map(() => '？').join(' + ')}</li>`).join('')}</ul>`);
}
function openPath() {
  const rows = REALMS.map((rn, r) => {
    const newSp = POOL_TIERS[r] ? POOL_TIERS[r].map(id => SP[id].n).join('、') : '';
    const state = r < S.realm ? 'done' : r === S.realm ? 'now' : '';
    const boss = r < 5 ? `渡${TRIB_NAMES[r]} → 晋${REALMS[r + 1]}` : '无尽劫';
    return `<li class="pr ${state}" data-tip="${esc(`${rn}：空窍 ${slotCap(r)} 格；${REALM_NOTES[r]}。${r < 5 ? `渡${TRIB_NAMES[r]}晋${REALMS[r + 1]}：全体 +1/+1、择一道痕。` : ''}`)}"><span class="pn">${rn}</span><span class="pb"><b>空窍 ${slotCap(r)} 格${newSp ? ' · 蛊市新蛊：' + newSp : ''}</b><small>${REALM_NOTES[r]} · ${boss}</small>${r === S.realm && r < 5 ? `<em>下一劫阵容 · 点开看详情</em>${miniRow(tribTeam(r), 'foe', 'trib')}` : ''}</span></li>`;
  }).join('');
  const L = levelInfo(M()), ul = UNLOCK_ORDER.map(k => { const u = UNLOCKS[k], ok = isUnlocked(M(), S, k); return `<li class="${ok ? 'on' : ''}"><b>${u.n}</b><small>${ok ? u.d : lockHTML(k).replace(/<[^>]+>/g, ' ').replace(u.n, '').trim()}</small></li>`; }).join('');
  sheet(`<h3>修行路 <button class="ib mini-b" data-act="gains">近期所得</button></h3><div class="lvnext"><b>蛊师 ${L.level} 级</b><span class="lvb"><i style="width:${L.need ? (100 * L.cur / L.need).toFixed(0) : 100}%"></i></span><small>${Math.floor(L.cur)}/${L.need} 经验 · 写代码、走节点、斗蛊、开茧、合炼都给经验</small><p>下一级奖励：${L.next.map(rwText).join(' · ') || '已满级'}</p></div>
  <h4>功能点亮</h4><ul class="unls">${ul}</ul>
  <h4>境界</h4><p class="sm">凡人到五转，每渡一劫：全体 +1/+1、择一道痕，空窍与蛊市随境界扩开。</p><ol class="path">${rows}<li class="pr ${S.realm >= 5 ? 'now' : ''}"><span class="pn">无尽</span><span class="pb"><b>无尽劫 · 层数无限</b><small>每层敌阵更强（+${ENDLESS.atkPerFloor} 攻 +${ENDLESS.hpPerFloor} 血/层），最高层写进分享卡。当前最高 ${S.endless} 层</small>${S.realm >= 5 ? `<em>第 ${S.floor} 层阵容 · 点开看详情</em>${miniRow(endlessTeam(S.floor), 'foe', 'endl')}` : ''}</span></li></ol>`);
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
let sessTok = 0, bySrc = null;
// bySource 兼容 { claude: 2900 } / { claude: { rate } } / [{ name, rate }] 几种写法
function srcList(bs) {
  if (!bs) return [];
  const arr = Array.isArray(bs) ? bs : Object.entries(bs).map(([k, v]) => typeof v === 'number' ? { name: k, rate: v } : { name: k, ...v });
  return arr.map(x => ({ name: String(x.label || x.name || x.src || x.id || ''), rate: +x.rate || 0 })).filter(x => x.name);
}
function countTok(d) { if (!(d > 0)) return; sessTok += d; if (S.todayKey !== today()) { S.todayKey = today(); S.todayTok = 0; } S.todayTok += d; }
function onTick(t) {
  rate = t.rate; hot = t.hot; bySrc = t.bySource || null;
  if (!booted) return;
  if (t.delta > 0 && S.started) { countTok(t.delta); onTokens(t.delta, t.rate, bySrc); }
  if (t.delta > 0 && S.started && !inBattle) feed(t.delta, t.hotDelta != null ? t.hotDelta : (t.hot ? t.delta : 0));
  else if (t.delta > 0 && S.started) S.bank += t.delta, S.total += t.delta;   // 战斗中进账同样存成灵气，没有上限
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
  S.total += d; let rest = d * ledgerFeedMul(S.team[0]), hr = hotAmt || 0;   // 灵根：相合的主蛊吸纳更快（只加节点进度）
  S.stoneK += d * ledgerStoneMul(); while (S.stoneK >= ECON.tokPer * src.unit) { S.stoneK -= ECON.tokPer * src.unit; S.stone++; renderMeta(); renderShop(); }
  if (S.team.some(g => g.wound > 0)) { S.repair += d; while (S.repair >= WOUND.healTok && healOne()) S.repair -= WOUND.healTok; }
  else S.repair = 0;
  let guard = 0;
  while (rest > 0.01 && guard++ < 20) {
    if (S.sel == null) { S.bank += rest; break; }
    const cost = S.compass[S.sel].cost * src.unit, take = Math.min(cost - S.prog, rest), fr = take / rest;
    S.prog += take; S.wh += hr * fr; hr -= hr * fr; rest -= take;
    if (S.prog >= cost - 0.5) resolveNode();
  }
  save();
}
// 愈合一层：伤得最重的先好；有飘字、拨弦和卡片跳动
function healOne() {
  const g = S.team.filter(x => x.wound > 0).sort((a, b) => b.wound - a.wound)[0]; if (!g) return false;
  g.wound--; S.healT = 0; renderSlots(); renderHint(); gain('温养', `${SP[g.sp].n} 伤愈一层（攻血各 +1）`);
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
  if (node.type === 'refine' && S.bag.length && S.team.length >= 2) opts = [S.team[S.team.length - 1].uid, ...S.bag.map(g => g.uid)];   // 炼附也能从蛊囊里挑料
  if (opts && opts.length > 1) {   // 选择题：不弹窗，挂在罗盘位上，等玩家有空再点
    if (node.type === 'devour') opts = opts.map(i => S.team[i].uid);
    S.pending = { node, opts, wu, cost }; renderPhase(); renderHint(); snd('pluck'); save(); tutorialEvent('node_choice'); return;
  }
  finishNode(node, opts ? opts[0] : undefined, wu, cost);
}
function finishNode(node, pick, wu, cost) {
  if (node.type === 'devour' && typeof pick === 'string') pick = S.team.findIndex(g => g.uid === pick);
  if (node.type === 'refine' && typeof pick === 'string') { const bi = S.bag.findIndex(g => g.uid === pick); if (bi >= 0) S.team.push(S.bag.splice(bi, 1)[0]); pick = undefined; }
  S.pending = null;
  if (!nodeOk(node.type, S.team, curCap()) || (node.type === 'devour' && !(pick > 0))) { S.compass = rollCompass(R(), S.team, false, curCap()); renderPhase(); renderHint(); save(); return; }
  const res = applyNode(S.team, node, R(), { wuhuo: wu, pick, cap: curCap() });
  onNode(node); if (node.type === 'summon' && S.team.length) onGain(S.team[S.team.length - 1], 'summon');
  const tg = node.type === 'summon' ? S.team[S.team.length - 1] : S.team[0]; if (tg) tg.fed += cost;
  S.muts += res.muts; S.nodes++; S.will = Math.min(WILL_MAX, S.will + 1); S.stone += ECON.node;
  { const nm = uid => { const g = S.team.find(x => x.uid === uid); return g ? SP[g.sp].n : ''; }, lines = res.fx.map(f => `${nm(f.uid)} ${f.txt}`).filter(x => x.trim());
    lines.forEach(l => gain(NODES[node.type].n, l)); gain(NODES[node.type].n, `+${ECON.node} 元石、意志 +1（走完节点）`);
    popPush(`<div class="toast"><b>${NODES[node.type].n}</b> ${lines.map(esc).join('，')}<br><small>+${ECON.node} 元石 · 意志 +1</small></div>`, 1300, 'side'); }
  S.compass = rollCompass(R(), S.team, false, curCap());
  S.shop = rollWares(S.shop); onRefresh(S.shop, 'node');
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
  if (S.started) { renderSlots(); renderShop(); renderPhase(); renderHint(); renderLevel(); meters(); ledgerShades($('#qiao')); }
}
// ---------- 成长：等级条、箱茧托盘、稀有度 ----------
const M = () => S.meta || (S.meta = metaInit());
const on = k => !S.meta || isUnlocked(S.meta, S, k);
const RQ = t => RARITY[t | 0] || RARITY[0];
const rarTag = g => g && g.rar > 0 ? `<i class="rq r${g.rar}">${RQ(g.rar).n}</i>` : '';
function rwText(r) {
  switch (r.k) {
    case 'stone': return `${r.n}◈`; case 'xp': return `经验 +${r.n}`; case 'chest': return CHESTS[r.tier] ? CHESTS[r.tier].n : '宝箱';
    case 'cocoon': return r.n ? `蛊茧（至少${RQ(r.n).n}）` : '蛊茧'; case 'charm': return '护心符'; case 'species': return `新蛊种：${SP[r.id] ? SP[r.id].n : r.id}`;
    case 'slot': return '蛊市 +1 格'; case 'title': { const t = TITLES.find(x => x.id === r.id); return `称号「${t ? t.n : r.id}」`; }
  }
  return '';
}
function renderLevel() {
  const b = $('#lvbar'); if (!b) return; const L = levelInfo(M()), pct = L.need ? Math.min(100, 100 * L.cur / L.need) : 100;
  b.classList.toggle('near', pct >= 80); b.classList.toggle('big', !!L.big);
  setHTML(b, `<b>蛊师 ${L.level}</b><span class="lvb"><i style="width:${pct.toFixed(1)}%"></i></span><small>${Math.floor(L.cur)}/${L.need}</small><em>${L.next.length ? '下级：' + L.next.map(rwText).join(' ') : '满级'}</em>`);
  renderBagLine(); const t = $('#tray'); if (!t) return; const m = M(), si = streakInfo(m);
  setHTML(t, (si.n >= 2 ? `<span class="flame" data-tip="${si.n} 连胜：胜场结算元石 ×${si.mul.toFixed(1)}。断连只失去加成，不扣已有的东西。">焰 ${si.n}</span>` : '') 
    + (m.chests.length ? `<button class="tb chest" data-act="chest" data-tip="${esc('待开宝箱：' + m.chests.map(k => CHESTS[k].n).join('、') + '\n点一下开第一个：元石、经验，金箱玄箱可能有蛊茧')}">箱 <b>${m.chests.length}</b></button>` : '') + ((m.cocoons.length || S.held.length) && on('cocoon') ? `<button class="tb coc" data-act="cocoon" data-tip="${esc('蛊茧 ' + (m.cocoons.length + S.held.length) + ' 个' + (S.held.length ? '（' + TXT.heldTip(S.held.length) + '）' : '') + '：点一下开出一只蛊，品质凡良珍绝天。茧不过期。\n' + TXT.cocoonDest() + '\n距天机 ' + pityLeft(m) + ' 次（必出绝或天）')}">茧 <b>${m.cocoons.length + S.held.length}</b></button>` : ''));
}
// 每次得蛊都开茧：掷稀有度（带天机），属性与额外词条随稀有度
function gainRar(g, from) {
  if (g.rar !== undefined) return;
  if (from === 'starter') { g.rar = 0; return; }
  const t = rollRarity(M(), R()); applyRarity(g, t, R());
  handleOut(metaEmit(M(), 'cocoon', { rarity: t }, R(), S)); revealPop(g, from);
}
function revealPop(g, from) {
  gain('开茧', `${RQ(g.rar).n}·${SP[g.sp].n} 攻 ${g.atk} 血 ${g.hp}${from === 'cocoon' ? '' : ' → 空窍'}（${{ summon: '招蛊', shop: '蛊市', loot: '夺蛊', cocoon: '蛊茧' }[from] || from}）`);
  const r = RQ(g.rar), big = g.rar >= 3, src = { summon: '招蛊', shop: '蛊市', loot: '夺蛊', cocoon: '开茧' }[from] || '';
  popPush(`<div class="reveal r${g.rar}"><span class="art">${guSVG(g.sp)}</span><div><small>${src} · 开茧</small><b><i class="rq r${g.rar}">${r.n}</i>${SP[g.sp].n}</b><span class="st"><i class="a">${g.atk}</i><i class="h">${g.hp}</i></span><small>距天机 ${pityLeft(M())}</small></div></div>`, big ? 2000 : 1100, big ? 'big' : 'side');
  if (big) { snd('combo'); shake(4); } else snd('coin');
}
// ---------- 近期所得：每条奖励写明得到了什么、加到了哪里（最近 50 条，可回看）----------
function gain(src, txt) { const g = S.gains || (S.gains = []); g.push({ t: Date.now(), src, txt }); if (g.length > 50) g.splice(0, g.length - 50); }
function rwLine(r) { return TXT.rw(r) || rwText(r); }
function openGains() {
  const g = (S.gains || []).slice().reverse(), hm = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  sheet(`<h3>近期所得</h3><p class="sm">最近 ${g.length} 条奖励，错过的弹层都在这里。</p><ul class="gains">${g.map(x => `<li><time>${hm(x.t)}</time><span class="gs">${esc(x.src)}</span><span>${esc(x.txt)}</span></li>`).join('') || '<li>还没有记录</li>'}</ul>`, 'gainsheet', true);
}

// ---------- 临时弹层队列（fx 组件到位后替换）：升级 → 成就 → 宝箱 → 解锁 → 小字 ----------
const POPQ = []; let popBusy = false, heldOuts = [];
// 新系统第一次出现时的一句说明（每个只说一次）
function firstTip(k, txt) { const t = S.tips || (S.tips = {}); if (t[k]) return; t[k] = 1; popPush(`<div class="toast tipcard"><b>初见</b> ${esc(txt)}</div>`, 3200, 'side'); save(); }
function popPush(html, ms, kind = 'side') { POPQ.push({ html, ms, kind }); if (!popBusy) popRun(); }
async function popRun() {
  popBusy = true;
  while (POPQ.length) { while (inBattle) await sleep(300); const p = POPQ.shift(), n = el(`<div class="pop ${p.kind}" data-act="popx">${p.html}</div>`); document.body.appendChild(n); await sleep(POPQ.length > 3 ? Math.min(p.ms, 600) : p.ms); n.classList.add('out'); setTimeout(() => n.remove(), 280); await sleep(140); }
  popBusy = false;
}
// meta 的返回值：元石入账（只有 stone 要 ui 自己加），其余只展示；战斗中先攒着，回空窍再放
function handleOut(out, skip = () => false) {
  if (!out) return;
  out.rewards.forEach(r => { if (r.k === 'stone' && !skip(r)) S.stone += r.n; if (!skip(r) && r.k !== 'xp' || r.k === 'xp' && r.n >= 10) gain(r.why || '奖励', rwLine(r)); });
  out.levelUps.forEach(l => gain('升级', `蛊师升到 ${l.level} 级`)); out.achievements.forEach(a => gain('成就', `成就「${a.n}」（${ACH_TIER[a.tier].n}）`)); out.unlocks.forEach(k => gain('点亮', `解锁：${UNLOCKS[k].n}`));
  const any = out.levelUps.length || out.achievements.length || out.chests.length || out.unlocks.length || out.rewards.length || out.notes.length;
  if (!any) return;
  if (inBattle) { heldOuts.push(out); renderLevel(); return; }
  showOut(out); renderLevel(); renderMeta();
  if (out.unlocks.length && S.started) setTimeout(() => { renderAll(); }, 50);
}
function showOut(out) {
  out.levelUps.forEach(l => { popPush(`<div class="lvup"><small>蛊师升级 · 点一下关掉</small><b>${l.level} 级</b><ul>${l.rewards.map(r => `<li>${esc(rwLine({ ...r, why: '' }))}</li>`).join('')}</ul></div>`, l.big ? 3200 : 2600, l.big ? 'big' : 'center'); snd('win'); });
  out.achievements.forEach(a => { popPush(`<div class="achc t-${a.tier}"><span class="am">${ACH_TIER[a.tier].n}</span><div><b>${esc(a.n)}</b><small>${esc(a.d)}</small><em>${a.rewards.map(r => rwLine({ ...r, why: '' })).join('<br>')}</em></div></div>`, a.tier === 'gold' ? 2200 : 1500, a.tier === 'gold' ? 'big' : 'side'); snd('coins'); });
  const ch = out.rewards.filter(r => r.k === 'chest' && !/升级|成就/.test(r.why || ''));
  const cc = out.rewards.filter(r => r.k === 'cocoon' && !/升级|成就/.test(r.why || ''));
  if (ch.length || cc.length) popPush(`<div class="toast">${[...ch, ...cc].map(r => esc(rwLine(r))).join('<br>')}</div>`, 1800, 'side');
  out.unlocks.forEach(k => { const u = UNLOCKS[k]; popPush(`<div class="unl"><small>新功能点亮</small><b>${u.n}</b><p>${u.d}</p></div>`, 1800, 'center'); snd('glitch'); });
  const sts = out.rewards.filter(r => r.k === 'stone' && !/升级|成就/.test(r.why || '')), st = sts.reduce((a, r) => a + r.n, 0);
  if (st && !inBattle) { stoneFloat(st); popPush(`<div class="toast">${sts.map(r => esc(rwLine(r))).join('<br>')}</div>`, 1100, 'side'); }
  out.notes.filter(n => !/^败也有得/.test(n)).forEach(n => popPush(`<div class="toast">${esc(n)}</div>`, 1300, 'side'));
}
function stoneFloat(n) { const m = $('#qmeta .stone'); if (!m) return; const f = el(`<span class="sfloat">+${n}◈</span>`); m.appendChild(f); setTimeout(() => f.remove(), 1200); snd('coin'); }
function startHTML() {
  const r = makeRng(S.seed + ':start'), pool = poolFor(0).slice(), picks = [];
  while (picks.length < 3) { const s = pool.splice(r.int(pool.length), 1)[0]; picks.push(s); }
  return `<div class="start"><div class="hero"><h1 class="title">蛊码</h1><p class="tag">烧 Token，养蛊，斗道。</p>
  <p class="lead">万物皆可为蛊，蛊即是道。你写代码烧掉的每一个 token，都在喂这一窝蛊；停手的时候，它们替你去斗。</p></div>
  <h2 class="step">三选一，结本命蛊</h2><div class="starters">${picks.map(id => { const s = SP[id]; return `<button class="starter" data-act="pick" data-sp="${id}"><div class="sart">${guSVG(id)}</div><b>${s.n}</b><span class="sst"><i class="a">${s.atk}</i><i class="h">${s.hp}</i></span><span class="strig">${natDesc(id)}</span><em>${s.lore}</em></button>`; }).join('')}</div>
  <p class="fine">${VSC ? '插件模式：读取本机 Claude Code / Codex 会话的 token 用量数字（不读内容）。' : '演示模式会模拟写代码的 token 流。存档只在本机。'}</p></div>`;
}
function mainHTML() {
  return `<header class="top"><div class="brand"><b class="logo">蛊码</b><span class="sub">烧 Token · 养蛊 · 斗道</span></div>
  <div class="tools"><button class="realm" id="realm" data-act="path" title="修行路">${REALMS[S.realm]}</button><button class="ib gear" data-act="settings" title="设置" aria-label="设置"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm7.4 4.6.1-1.2-.1-1.2 2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.6 3h-4l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6-.1 1.2.1 1.2-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4z"/></svg></button><button class="ib" data-act="ledger" title="算力履历">履历</button><button class="ib zhu" data-act="share">战帖</button></div></header>
  <div class="lvrow"><button class="lvbar" id="lvbar" data-act="path" data-tip-fn="level"></button><span class="tray" id="tray"></span></div>
  <section class="vein"><canvas id="vein"></canvas><div class="vread"><div class="vrate" data-tip-fn="rate"><b id="rateTxt">0</b><span class="vu" id="rateU"></span><span class="vlab">灵流</span><span id="fireTag" class="fire"></span></div><div class="vtot"><span id="totTxt"></span><button class="chip" data-act="src" id="srcTag"></button></div></div><div class="vsrc" id="srcRates" hidden></div></section>
  <div class="seg" id="demo">${[['coding', '写代码中'], ['rest', '停手休息']].map(([m, t]) => `<button data-act="demo" data-m="${m}">${t}</button>`).join('')}</div>
  <section class="qiao" id="qiao"><div class="qhead"><span class="lbl">空窍 <small>左为炉口 · 拖动换位</small></span><span id="qmeta"></span></div><div class="slots" id="slots"></div><div class="bagline" id="bagline"></div><p class="marks" id="marks" data-act="marksInfo"></p><p class="hint" id="hint"></p></section>
  <section class="shop" id="shop"></section><section id="phase" class="phase"></section>
  <footer class="foot"><button data-act="duelInput">粘贴坐标码应战</button><button data-act="path">修行路</button><button data-act="codex">蛊典</button>${on('daily') ? '<button data-act="daily">日课</button>' : ''}${on('ach') ? '<button data-act="achs">成就</button>' : ''}<button data-act="reset" id="bReset">重开一局</button></footer>`;
}
function guCard(g, i, rc = '') {
  const sk = skillOf(g), seal = !canWield(g, S.realm);
  return `<button class="gu${seal ? ' sealed' : ''}${g.wound ? ' hurt' : ''}${i === 0 ? ' lead' : ''}${g.rar > 0 ? ' r' + g.rar : ''}" data-act="gu" data-i="${i}" data-uid="${g.uid}" data-drag="${i}" data-tip-fn="gu">${rc ? `<span class="rcv">${rc}</span>` : ''}
  <span class="art">${guSVG(g.sp)}</span><span class="rk rk${rankOf(g)}">${TXT.rankBadge(g)}</span>${sk ? `<span class="mseal${sk.named ? '' : ' pale'}">${esc(sk.n[0])}</span>` : ''}${g.q.length ? `<span class="qk">${g.q.map(q => QUIRKS[q].n[0]).join('')}</span>` : ''}
  <span class="nm">${rarTag(g)}${SP[g.sp].n}</span><span class="st"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i></span>
  <span class="tr">${trChars(g.tr)}${g.att.map(a => `<i class="att">${SP[a].ab}</i>`).join('')}</span>${g.wound ? `<span class="wd">伤${g.wound}</span>` : ''}${seal ? `<span class="sealtag">${TXT.sealed}</span>` : ''}</button>`;
}
function renderSlots() {
  const box = $('#slots'); if (!box) return;
  const cap = curCap(), rc = rcvChars(S.team), n = Math.min(SLOTS, Math.max(S.team.length, cap + 1)); let h = '';   // 只多露一格「下一阶开」
  for (let i = 0; i < n; i++) {
    if (S.team[i]) h += `<div class="slot">${guCard(S.team[i], i, rc[i])}</div>`;
    else if (i < cap) h += `<div class="slot"><span class="empty" data-drag="${i}">空</span></div>`;
    else { const r = SLOT_BY_REALM.findIndex(c => c > i); h += `<div class="slot"><span class="empty lock">锁<small>${REALMS[r] || ''}开</small></span></div>`; }
  }
  box.innerHTML = h; box.dataset.sort = 'team'; box.dataset.group = 'main'; box.style.setProperty('--cn', n <= 5 ? n : Math.ceil(n / 2)); box.style.setProperty('--cw', n); box.classList.toggle('two', n > 5); renderMeta();
  renderBagLine();
  const rl = $('#realm'); if (rl) rl.textContent = REALMS[S.realm];
  const mk = $('#marks'); if (mk) mk.innerHTML = S.marks.length ? '道痕 · ' + S.marks.map(k => `<span class="tc" data-tip="${esc(MARKS[k].n + '：' + MARKS[k].d)}">${MARKS[k].n}</span>`).join(' · ') : '';
}
function renderMeta() {
  const m = $('#qmeta'); if (!m) return;
  const wd = S.team.reduce((a, g) => a + (g.wound || 0), 0);
  setHTML(m, `<b class="stone" data-tip="元石：买蛊、转市。来源：写代码的 token、走完节点、斗蛊结算、卖蛊、宝箱与升级。">◈ ${S.stone}</b> 元石 · 意志 <b class="will" data-tip="意志：每场斗蛊耗 1 点，上限 ${WILL_MAX}。每 ${WILL_SEC / 60} 分钟或写代码都会回，走完节点也回 1 点。">${'◆'.repeat(S.will)}${'◇'.repeat(Math.max(0, WILL_MAX - S.will))}</b>${wd ? ` · <span class="heal" title="写代码约 1 分钟愈合一层">温养<span class="hbar"><i id="healBar" style="width:${(100 * healPct()).toFixed(0)}%"></i></span></span>` : ''}`);
}
const shopPool = () => [...new Set([...poolFor(S.realm), ...metaPool(M()).filter(id => SP[id])])].filter(id => baseRank(id) <= S.realm + RANK.over);   // 只卖驱使得动的
const shopN = () => 3 + Math.min(2, M().shopSlots | 0);
const owned = sp => sameRank([...S.team, ...S.bag], sp, baseRank(sp));   // 已有几只同种原生转数的（空窍 + 蛊囊）
// 货架上三只同种：一起买打折，买下当场合炼
function trioSp() { const c = {}; S.shop.forEach(w => { if (!w.sold) c[w.sp] = (c[w.sp] || 0) + 1; }); return Object.keys(c).find(k => c[k] >= 3); }
const trioCost = () => Math.round(3 * buyCost() * BAG.trioOff);
function trioHTML() { const sp = trioSp(); if (!sp) return ''; const c = trioCost(), ok = S.stone >= c && trioPlan(sp); return `<button class="zhu trio" data-act="trio" data-sp="${sp}" data-tip="${esc(TXT.trioTip)}"${ok ? '' : ' disabled'}>${esc(TXT.trio(sp, c))}</button>`; }
function trioPlan(sp) {   // 先在副本上试放三只，放得下才允许
  const t = JSON.parse(JSON.stringify(S.team)), b = JSON.parse(JSON.stringify(S.bag)), cap = curCap();
  for (let k = 0; k < 3; k++) { const g = { ...newGu(sp) }; if (!canTake(t, b, g, cap, BC(), 'shop')) return false; placeGu(t, b, g, cap, [], null, BC(), 'shop'); }
  return true;
}
function rollWares(old = []) {
  const rig = rigShop(M(), R(), shopPool()); if (rig) return rig.map(sp => ({ sp, frozen: false }));
  const r = R(), pool = shopPool(); return Array.from({ length: shopN() }, (_, i) => (old[i] && old[i].frozen && !old[i].sold) ? old[i] : { sp: r.pick(pool), frozen: false });
}
const freeRef = () => (M().stats.refreshes | 0) < META_TUNE.newbie.freeRefresh;
function renderShop() {
  const box = $('#shop'); if (!box || !S.started) return;
  if (!on('shop')) { box.innerHTML = lockHTML('shop'); return; }
  if (!S.shop || S.shop.length !== shopN()) { S.shop = rollWares(S.shop || []); onRefresh(S.shop, 'init'); }
  const cost = buyCost(), rc = refCost(), cap = curCap();
  box.innerHTML = `<div class="ch"><span class="lbl">蛊市 <small>${REALMS[S.realm]}档 · ${shopPool().length} 种 · ${TXT.shopNote}</small></span><button class="ib mini-b" data-act="refresh"${S.stone >= rc || freeRef() ? '' : ' disabled'}>转市${freeRef() ? ' 免费' : rc ? ' ' + rc + '◈' : ''}</button></div>
  <div class="wares n${S.shop.length}">${S.shop.map((w, i) => {
    const sp = SP[w.sp], own = owned(w.sp), shelf = S.shop.filter(x => x.sp === w.sp && !x.sold).length, merge = own >= 2, fusable = !w.sold && own + shelf >= 3, can = canBuy(S.team, w.sp, cap, S.bag, BC()), ok = !w.sold && S.stone >= cost && can;
    const tag = w.sold ? '已购' : !can ? '空窍和蛊囊都满了' : (merge ? '合炼 ' : '') + cost + '◈';
    return `<div class="ware${w.frozen ? ' frozen' : ''}${w.sold ? ' sold' : ''}${fusable ? ' merge' : ''}${ok ? '' : ' cant'}"><button class="wbuy" data-act="ware" data-i="${i}" data-tip-fn="ware"${w.sold ? ' disabled' : ''}>${w.frozen ? '<span class="fz">冻</span>' : ''}${fusable ? `<span class="fu">${TXT.canFuse}</span>` : ''}<span class="art">${guSVG(w.sp)}</span><b><small class="rkt">${RANK.names[baseRank(w.sp)]}</small>${sp.n}</b><span class="st"><i class="a">${sp.atk}</i><i class="h">${sp.hp}</i></span><span class="wt">${spTraits(w.sp).map(([t, v]) => TRAITS[t].n + (v > 1 ? v : '')).join(' · ')}</span><span class="price">${tag}</span></button></div>`;
  }).join('')}</div>${trioHTML()}`;
}
const FOE = {};   // 面板里出现过的阵容，按 key 存着供「点开详情」用
function rcvChars(t) { const out = t.map(() => ''); posLinks(t).forEach(l => { if (l.to >= 0 && l.to !== l.from && !out[l.to].includes(TRAITS[l.id].ch)) out[l.to] += TRAITS[l.id].ch; }); return out; }
function miniRow(t, cls = '', key = '', drag = false) {
  if (key) FOE[key] = t;
  const rc = rcvChars(t), tag = key ? 'button' : 'div';
  return `<div class="mini ${cls}"${drag ? ` data-sort="${key}"` : ''}>${t.map((g, i) => { const sk = skillOf(g); return `<${tag} class="mg${g.boss ? ' boss' : ''}"${key ? ` data-act="peek" data-k="${key}" data-i="${i}" data-tip-fn="mg"` : ''}${drag ? ` data-drag="${i}"` : ''}>${rc[i] ? `<span class="rcv">${rc[i]}</span>` : ''}<span class="art">${guSVG(g.sp)}</span><b>${rarTag(g)}${g.boss ? '劫·' : ''}<small class="rkt">${RANK.names[rankOf(g)]}</small>${SP[g.sp].n}</b><span class="st"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i></span>${sk && sk.named ? `<em class="cs">${esc(sk.n)}</em>` : `<span class="tr">${trChars(g.tr)}</span>`}</${tag}>`; }).join('')}</div>`;
}
function choiceHTML(p) {
  const L = S.team[0], t = p.node.type;
  const head = { mutate: `突变 · ${L ? SP[L.sp].n : ''} 择一词条`, summon: '招蛊 · 三选一', devour: `吞噬 · ${L ? SP[L.sp].n : ''} 吞下哪一只`, refine: `炼附 · 选一只炼成${L ? SP[L.sp].n : ''}的附蛊` }[t];
  const items = p.opts.map((o, i) => {
    if (t === 'mutate') { const e = L && L.tr.find(x => x[0] === o), v = e ? e[1] + 1 : 1; return `<button class="node opt" data-act="choose" data-i="${i}"><span class="nseal">${TRAITS[o].ch}</span><span class="nbody"><b>${TRAITS[o].n}${e ? ` · 升至 ${v} 层` : ''}</b><small>${TRAITS[o].trig} · ${TRAITS[o].d(v)}</small></span></button>`; }
    if (t === 'summon') { const sp = SP[o]; return `<button class="node opt" data-act="choose" data-i="${i}"><span class="oart">${guSVG(o)}</span><span class="nbody"><b>${sp.n} <i class="a">${sp.atk}</i> <i class="h">${sp.hp}</i></b><small>${spTraits(o).map(([t, v]) => TRAITS[t].d(v)).join('；')} · ${sp.lore}</small></span></button>`; }
    if (t === 'refine') { const inBag = S.bag.find(x => x.uid === o), g = inBag || S.team.find(x => x.uid === o); if (!g || !L) return ''; const c = comboOf({ sp: L.sp, att: [...L.att, g.sp] }), nc = c && c !== comboOf(L); return `<button class="node opt" data-act="choose" data-i="${i}"><span class="oart">${guSVG(g.sp)}</span><span class="nbody"><b>炼入 ${esc(rankName(g))}${inBag ? ' <small>（蛊囊）</small>' : ' <small>（空窍最右）</small>'}</b><small>${L ? SP[L.sp].n : ''}得其四成攻血${nc ? ` → 成杀招【${esc(c.n)}】` : ''}</small></span></button>`; }
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
      return `把 ${Z} 炼为 ${L} 的附蛊${tip}${S.bag.length ? '（也可从蛊囊挑料）' : ''}`;
    }
  }
  return '';
}
function renderPhase() {
  const box = $('#phase'); if (!box) return;
  if (S.compass.length === 0 || S.compass.every(n => !nodeOk(n.type, S.team, curCap()))) { S.compass = rollCompass(R(), S.team, false, curCap()); S.sel = null; S.prog = 0; }
  const canFight = S.will > 0, nextWill = Math.max(0, Math.ceil(WILL_SEC - S.willT / 1000));
  const tribLabel = S.realm < 5 ? `渡${TRIB_NAMES[Math.min(S.realm, 4)]}` : '五转大成';
  box.innerHTML = (S.pending ? choiceHTML(S.pending) : `<div class="compass"><div class="ch"><span class="lbl">罗盘 · 三岔</span></div>${zyHTML()}
  <div class="nodes">${S.compass.map((n, i) => { const ok = nodeOk(n.type, S.team, curCap()), cur = S.sel === i; return `<button class="node${cur ? ' on' : ''}" data-act="node" data-i="${i}" data-tip="${esc(NODES[n.type].n + '：' + NODES[n.type].d + '\n这一次：' + nodeDesc(n) + '\n需要 ' + fmtTok(n.cost * src.unit) + ' 灵流；走完还得 ' + ECON.node + ' 元石、回 1 点意志、蛊师经验')}"${ok ? '' : ' disabled'}><span class="nseal">${NODES[n.type].ch}</span><span class="nbody"><b>${NODES[n.type].n}</b><small>${esc(nodeDesc(n))}</small></span><span class="ncost">${fmtTok(n.cost * src.unit)}</span><span class="nbar"><i></i></span></button>`; }).join('')}</div></div>`) + `
  ${!on('battle') ? lockHTML('battle') : `<div class="gate${canFight ? ' open' : ''}"><div class="gh"><span class="lbl">斗蛊</span><span class="gsub">${canFight ? `每场耗 1 点意志 · 余 ${S.will}` : `意志已尽 · 约 ${Math.ceil(nextWill / 60)} 分钟回 1 点，养蛊也会回`}</span></div>
  <div class="gbtns">${S.realm < 5 ? `<button class="gbtn" data-act="trib"${canFight ? '' : ' disabled'}><b>${tribLabel}</b><small>${REALMS[S.realm + 1]}境 Boss · 胜则升阶</small><em class="stk">${esc(TXT.stakesLine('trib'))}</em></button>` : `<button class="gbtn" data-act="endless"${canFight ? '' : ' disabled'}><b>无尽劫 · 第 ${S.floor} 层</b><small>最高 ${S.endless} 层 · 逐层变强</small><em class="stk">${esc(TXT.stakesLine('endless'))}</em></button>`}<button class="gbtn" data-act="ghost"${canFight ? '' : ' disabled'}><b>斗幽灵</b><small>易 · 中 · 难 任选</small><em class="stk">赢了：元石 +${ECON.win.easy}～${ECON.win.hard}，可能得蛊茧、宝箱｜输了：元石 +${ECON.lose}，蛊受轻伤</em></button></div></div>`}`;
  meters();
}
// 灵气存量：烧掉的 token 先存成灵气（没有上限），选了路就灌进节点。只显示一行数字，不画进度条
function zyHTML() { return `<div class="zy" id="zy" data-tip="${esc(TXT.qiTip)}"><span class="zyl">灵气</span><b id="zyN"></b><small id="zyT"></small></div>`; }
function zyUpdate() {
  const n = $('#zyN'); if (!n) return; n.textContent = fmtTok(S.bank);
  $('#zy').classList.toggle('flow', rate > 0 && S.sel != null); $('#zyT').textContent = S.sel == null && !S.pending && S.bank > 0 ? TXT.qiIdle : '';
}
function pourFx() { const z = $('#zy'); if (!z) return; z.classList.remove('pour'); void z.offsetWidth; z.classList.add('pour'); setTimeout(() => z.classList.remove('pour'), 1000); }
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
  rt.textContent = rate > 0 ? fmtTok(rate) : '0'; $('#rateU').textContent = '/s';
  const ft = $('#fireTag'); ft.textContent = rate <= 0 ? '静息' : hot ? '武火' : '文火'; ft.classList.toggle('hot', hot && rate > 0); ft.classList.toggle('idle', rate <= 0);
  $('#totTxt').innerHTML = `今日 <b>${fmtTok(S.todayKey === today() ? S.todayTok : 0)}</b> · 本次 <b>${fmtTok(sessTok)}</b> token`;
  const sr = $('#srcRates'), sl = srcList(bySrc); sr.hidden = sl.length < 2;
  if (sl.length >= 2) sr.innerHTML = sl.map(x => `<span class="schip${x.rate > 0 ? '' : ' off'}">${esc(x.name)} <b>${fmtTok(x.rate)}/s</b></span>`).join('');
  const st = $('#srcTag'); st.textContent = VSC ? TXT.srcLive : TXT.srcDemo; st.classList.toggle('demo', !VSC);
  const dm = $('#demo'); dm.hidden = !!VSC || src.mode !== 'demo'; dm.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === src.demo));   // 插件里永远不显示模拟灵流开关
  zyUpdate();
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

// ---------- 斗蛊 ----------
// 对手：渡劫/无尽劫按规则生成，幽灵/战帖用传入阵容
function foeOf(kind, foe) {
  if (kind === 'trib') { const n = `${REALMS[S.realm + 1]}·${TRIB_NAMES[Math.min(S.realm, 4)]}`; return { team: tribTeam(S.realm), name: n, title: n.replace('·', ' · '), realm: S.realm + 1, marks: [] }; }
  if (kind === 'endless') return { team: endlessTeam(S.floor), name: `无尽劫·第${S.floor}层`, title: `无尽劫 · 第 ${S.floor} 层`, realm: 5, marks: [] };
  if (kind === 'ghost') return { team: foe.team, name: '幽灵·' + foe.name, title: `幽灵 · ${foe.name}（${foe.label || ''}）`, realm: S.realm, marks: [] };
  const n = foe.name || '无名蛊师'; return { team: foe.team, name: n, title: '战帖 · ' + n, realm: foe.realm || 0, marks: foe.marks || [], trial: !!foe.trial };
}
const fielded = () => S.team.every(g => canWield(g, S.realm)) ? S.team : S.team.filter(g => canWield(g, S.realm));   // 境界不够驱使的不上阵
const myTeamFor = kind => (kind === 'duel' && (!S.started || !S.team.length)) ? starterTeam() : fielded();
const myMarksFor = kind => kind === 'duel' && !S.started ? [] : S.marks;
// ---------- 布阵：开战前看清敌阵、拖动调整站位、实时胜算 ----------
let PREP = null, oddsJob = 0;
function prep(kind, foe) {
  if (inBattle || (kind === 'trib' && S.realm >= 5) || (kind !== 'duel' && S.will <= 0)) return;
  const mine = myTeamFor(kind); if (!mine.length) { popPush(`<div class="toast">${TXT.noWield}</div>`, 1600, 'side'); return; }
  const f = foeOf(kind, foe); PREP = { kind, foe, f, mine, last: null };
  renderPrep(true);
}
function renderPrep(open) {
  if (!PREP) return; const { f, kind } = PREP, mine = PREP.mine, canSort = mine === S.team && S.team.length > 1;
  const sum = t => `<span class="fsum">总 <i class="a">${t.reduce((a, g) => a + effA(g), 0)}</i><i class="h">${t.reduce((a, g) => a + effH(g), 0)}</i></span>`;
  const html = `<p class="eyebrow">布阵</p><h3>${esc(f.title)}</h3>
  <div class="fhead"><span class="lbl">敌阵 <small>点开看词条</small></span>${sum(f.team)}</div>${miniRow(f.team, 'foe', 'foe')}
  <div class="odds"><span class="olab">胜算约</span><b id="oddsN">…</b><span class="obar"><i id="oddsBar"></i></span><small id="oddsD">用同一套斗蛊规则推演 200 场</small></div>
  <div class="fhead"><span class="lbl">我阵 <small>${canSort ? '拖动换位 · 左为炉口，先上场' : '左为炉口，先上场'}</small></span>${sum(mine)}</div>${miniRow(mine, 'me', 'mine', canSort)}
  <p class="stakes">${stakesHTML(kind, PREP.foe && PREP.foe.tier)}</p>
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
  const ca = encodeTeam(mine, { name: S.name || '无名蛊师', realm: S.realm, marks: myMarksFor(kind), trial: S.trial }), cb = encodeTeam(enemy, { name: ename, realm: erealm, marks: F.marks, trial: F.trial });
  const seed = kind === 'duel' ? hashStr(ca + '|' + cb).toString(36) : ((S.seed ^ Math.imul(++S.step, 2654435761)) >>> 0).toString(36);
  let A = decodeTeam(ca), Bt = decodeTeam(cb), res = battle(A.team, Bt.team, 'r:' + seed, A.marks, Bt.marks), rp = [ca, cb, seed, kind[0]].join('.'), ttl = title;
  if (kind === 'ghost' && tutorialActive() && M().stats.battles === 0) { const t = tutorialFight(mine, enemy, A.marks); if (t) { ({ A, B: Bt, res, rp } = t); ttl = title + ' · 试炼'; } }
  if (kind !== 'duel') S.will--;
  (A.team || []).forEach((g, i) => { const r = res.roster['a' + i]; if (r && mine[i]) r.rar = mine[i].rar; });
  save(); playBattle({ kind, title: ttl, res, enemy, foe, tier: foe && foe.tier, A, B: Bt, replay: rp });
}
// 新手第一场：本命蛊借来附蛊凑成杀招、对手减弱，挑一个「赢且打出杀招」的种子
function tutorialFight(mine, enemy, marks) {
  const L = mine[0]; if (!L) return null;
  const c = ['sanzhu', 'jinjia', 'liaoyuan', 'pozhen', 'wangu', 'tuoke', 'fenshen', 'jingji', 'shishan', 'duopo'].map(id => COMBOS.find(x => x.id === id)).find(x => x && x.need.includes(L.sp));
  const t = mine.map(g => ({ ...g, tr: g.tr.map(x => [...x]), q: [...g.q], att: [...g.att], wound: 0 }));
  if (c && !comboOf(t[0])) t[0].att = c.need.filter(x => x !== L.sp).slice(0, MAXATT);
  const e = enemy.map(g => ({ ...g, atk: Math.max(1, Math.ceil(g.atk * 0.5)), hp: Math.max(1, Math.ceil(g.hp * 0.6)), tr: g.tr.map(x => [...x]), q: [], att: [] }));
  const ca = encodeTeam(t, { name: S.name || '无名蛊师', realm: S.realm, marks, trial: S.trial }), cb = encodeTeam(e, { name: '幽灵', realm: S.realm }), A = decodeTeam(ca), B = decodeTeam(cb);
  let pick = null;
  for (let k = 0; k < 60; k++) {
    const seed = 'tut' + k, res = battle(A.team, B.team, 'r:' + seed, A.marks, B.marks);
    if (res.winner !== 'A') continue; const sk = res.log.some(ev => ev.t === 'combo' && res.roster[ev.uid] && res.roster[ev.uid].side === 0);
    pick = { A, B, res, rp: [ca, cb, seed, 'g'].join('.') }; if (sk) break;
  }
  return pick;
}
function parseReplay(text) {
  const m = String(text || '').match(/r=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([0-9a-z]+)(?:\.([tgd]))?/); if (!m) return null;
  const A = decodeTeam(m[1]), B = decodeTeam(m[2]); if (!A || !B) return null;
  return { A, B, seed: m[3], kind: m[4] || 'd', replay: [m[1], m[2], m[3], m[4] || 'd'].join('.') };
}
function openReplay(rp) {
  window.__guRp = rp;
  const row = t => `<div class="mini">${t.map(g => { const sk = skillOf(g); return `<div class="mg"><span class="art">${guSVG(g.sp)}</span><b>${SP[g.sp].n}</b><span class="st"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i></span>${sk && sk.named ? `<em class="cs">${esc(sk.n)}</em>` : `<span class="tr">${trChars(g.tr)}</span>`}</div>`; }).join('')}</div>`;
  sheet(`<p class="eyebrow">复盘</p><h3 class="duelh">${esc(rp.B.name || '无名')}${trialTag(rp.B.trial)} 对 ${esc(rp.A.name || '无名')}${trialTag(rp.A.trial)}</h3><p class="sm">同一组阵容、同一颗种子，重放的是一模一样的那一场。</p>${row(rp.B.team)}<p class="vsline">— 对 —</p>${row(rp.A.team)}<div class="row2"><button class="zhu big" data-act="replayGo">观看复盘</button></div>`);
}
function openLinkText(text) {
  const rp = parseReplay(text); if (rp) { openReplay(rp); return true; }
  const foe = decodeTeam(text); if (foe) { openDuel(foe); return true; }
  return false;
}
function replayURL(link) { return (/^https?:/.test(location.protocol) ? location.origin + location.pathname : SHARE_BASE) + '#r=' + link; }
function buHTML(uid, r) {
  return `<div class="bu${r.side ? ' foe' : ''}${r.boss ? ' boss' : ''}" data-uid="${uid}"><div class="bart">${guSVG(r.sp)}</div><div class="binfo"><b class="bnm">${r.rar > 0 ? `<i class="rq r${r.rar}">${RQ(r.rar).n}</i>` : ''}${esc(r.name)}</b><span class="bst"><i class="a"></i><i class="h"></i><i class="s" hidden></i></span><span class="btr">${trChars(r.tr)}</span>${r.combo ? `<em class="cs">${esc(r.combo)}</em>` : ''}</div></div>`;
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
  B.meta = onBattleEnd(B);
  let txt = '', loot = [], btns = '';
  if (B.kind === 'replay') {}
  else if (B.kind === 'endless') {
    if (win) { S.wins++; S.endless = Math.max(S.endless, S.floor); S.floor++; txt = `破无尽劫第 ${S.floor - 1} 层。最高 ${S.endless} 层。`; }
    else if (draw) txt = '劫云僵持，未破此层。';
    else { S.losses++; wound(); txt = `止步第 ${S.floor} 层。全体轻伤 1 层，写代码约 1 分钟愈合一层。`; }
  }
  else if (B.kind === 'trib') {
    if (win) {
      S.realm++; S.wins++; S.team.forEach(g => { g.atk++; g.hp++; }); S.ghosts = null; S.shop = rollWares(S.shop); onRealm(S.realm); onRefresh(S.shop, 'realm');
      gain('渡劫', `晋${REALMS[S.realm]}：全体攻血各 +1${slotCap(S.realm) > slotCap(S.realm - 1) ? '，空窍 +1 格' : ''}`);
      txt = `渡劫成功，晋${REALMS[S.realm]}。全体蜕变 +1/+1${slotCap(S.realm) > slotCap(S.realm - 1) ? '，空窍多开一格' : ''}。择一道痕，伴你整局：`;
      loot = rollMarks(R(), S.marks).map(k => ({ k: 'mark', id: k, t: `道痕【${MARKS[k].n}】${MARKS[k].d}` }));
    }
    else if (draw) txt = '劫云散去，未分胜负。';
    else { S.losses++; wound(); txt = '渡劫未成：全体轻伤 1 层，写代码约 1 分钟愈合一层。'; }
  } else if (B.kind === 'ghost') {
    if (win) {
      S.wins++; txt = '胜。';
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
  let base = 0; const mults = [], mo = B.meta, isSettle = r => r.k === 'stone' && /首胜|结算加成/.test(r.why || '');
  if (B.kind === 'trib' || B.kind === 'ghost' || B.kind === 'endless') base = win ? ECON.win[B.kind === 'ghost' ? (B.tier || 'mid') : B.kind] : ECON.lose;
  if (base && win && mo && mo.streak) {
    const st = mo.streak; if (st.n >= 2) mults.push([`${st.n} 连胜`, +st.mul.toFixed(2)]);
    if (st.firstWin) mults.push(['每日首胜', +((st.mul + META_TUNE.daily.firstWinMul - 1) / st.mul).toFixed(2)]);
    if (B.comeback) mults.push(['绝境翻盘', 2]);
    if (B.crits >= 3) mults.push([`暴击 ${B.crits} 次`, 1.2]);
  }
  if (base && S.marks.includes('shengCai')) mults.push(['生财有道', 1.5]);
  const got = Math.round(mults.reduce((a, m) => a * m[1], base)); S.stone += got; B.pay = { base, mults, gain: got };
  if (got) gain('斗蛊', `+${got} 元石（${B.title} ${win ? '胜' : '败'}，基础 ${base}${mults.map(m => ` · ${m[0]} ×${m[1]}`).join('')}）`);
  if (mo) { handleOut(mo, isSettle); if (mo.more) handleOut(mo.more); }
  if (B.kind === 'ghost') S.ghosts = null;
  B.loot = loot; window.__guB = B; snd(win ? 'win' : draw ? 'pluck' : 'lose');
  let consol = '';
  const mnote = B.meta && B.meta.notes.find(n => /^败也有得/.test(n)), saved = B.meta && B.meta.streak && B.meta.streak.saved;
  if (!win && !draw && S.started && ['trib', 'ghost', 'endless'].includes(B.kind)) {
    const left = B.res.log[B.res.log.length - 1].s[1].reduce((a, x) => a + x[2], 0), got = [];
    if (S.sel != null && S.compass[S.sel]) { const c = S.compass[S.sel].cost * src.unit, add = Math.min(c * WOUND.loseNodePct, c - S.prog - 1); if (add > 0) { S.prog += add; got.push(`${NODES[S.compass[S.sel].type].n}进度 +${Math.round(100 * add / c)}%`); } }
    else { const add = WOUND.loseNodePct * 50 * src.unit; S.bank += add; got.push(`灵气 +${fmtTok(add)}`); }
    if (mnote) got.push(...mnote.replace(/^败也有得：/, '').split('、').filter(t => !/^经验/.test(t)));   // 经验在「本场所得」里列
    consol = `<div class="consol"><b>败亦有获</b>${got.map(t => `<span>${esc(t)}</span>`).join('')}${left > 0 ? `<em>敌阵只剩 ${fmtNum(left)} 血，差一点</em>` : ''}</div>`;
  }
  const spoils = mo ? [...(mo.xp ? [{ k: 'xp', n: mo.xp }] : []), ...mo.rewards.filter(r => !isSettle(r) && r.k !== 'xp' && !/升级|成就/.test(r.why || ''))] : [];
  const panel = el(`<div class="result"><div class="rseal${win ? '' : ' lose'}">${win ? '胜' : draw ? '和' : '败'}</div>${B.comeback ? '<span class="goldtag">绝境翻盘</span>' : ''}<p class="rtxt">${txt}</p>${consol}
  ${spoils.length ? `<ul class="spoils"><li class="sh">本场所得</li>${spoils.map(r => `<li>${esc(rwLine(r))}</li>`).join('')}</ul>` : ''}
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
    row.appendChild(el(`<span class="mcard" data-tip="${esc(multTip(lab, m))}"><small>${esc(lab)}</small><b>×${m}</b></span>`)); snd('clack');
    box.animate([{ transform: 'translateY(3px)' }, { transform: 'none' }], { duration: 180 });
    val = val * m; await roll(Math.round(val), 420);
  }
  const total = Math.round(mults.reduce((a, m) => a * m[1], base));
  if (payFast) row.innerHTML = mults.map(([lab, m]) => `<span class="mcard" data-tip="${esc(multTip(lab, m))}"><small>${esc(lab)}</small><b>×${m}</b></span>`).join('');
  num.textContent = fmtNum(total); num.classList.add('final'); snd(mults.length ? 'coins' : 'coin');
}
function closeBattle() {
  const b = $('#battle'); if (b) b.remove(); inBattle = false;
  const ho = heldOuts; heldOuts = []; setTimeout(() => ho.forEach(showOut), 200);
  setTimeout(() => tutorialEvent('battle_end'), 60);
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
// 本命 / 三转觉醒 / 五转觉醒：未到转数的灰着
function natHTML(g) {
  const k = natOf(g.sp), t = k && TRAITS[k]; if (!t) return '';
  const a = awOf(g), r = guRank(g), L = (on, b, d) => `<li class="${on ? '' : 'off'}"><b>${b}</b>${esc(d)}</li>`;
  return `<h4>本命 · ${t.n} <small>${r >= 6 ? '仙蛊' : REALMS[r]}蛊</small></h4><ul class="natl">${L(true, '本命', t.d(1, natMulFor(r)))}${L(a >= 1, '三转觉醒', t.aw[0](natMulFor(r)))}${L(a >= 2, '五转觉醒', t.aw[1](natMulFor(r)))}</ul>`;
}
function guDetail(g, ctx = {}) {
  const s = SP[g.sp], sk = skillOf(g), team = ctx.team, i = ctx.i | 0, kind = ctx.kind || 'view';
  const recv = team ? posLinks(team).filter(l => l.to === i && l.from !== i) : [];
  const w = kind === 'shop' ? S.shop[i] : null, cost = buyCost(), cap = curCap();
  const merge = w && owned(w.sp) >= 2, can = w && canBuy(S.team, w.sp, cap, S.bag, BC());
  sheet(`<div class="detail"><div class="dart">${guSVG(g.sp)}</div><div><h3>${rarTag(g)}${g.boss ? '劫·' : ''}${rankName(g)}</h3><p class="lore">${kind === 'foe' ? '<span class="foetag">敌</span>' : ''}${s.lore}${g.clone ? ' · 分身' : ''}</p><p class="dst"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i>${g.wound ? ` <span class="wd">伤 ${g.wound} 层</span>` : ''}</p>${team && kind !== 'shop' ? `<p class="sm">站位：${kind === 'foe' ? '敌阵' : '我阵'}第 ${i + 1} 位${i === 0 ? '（最前）' : ''}</p>` : ''}</div></div>
  <h4>词条</h4><ul>${g.tr.map(([id, v]) => { const pn = team && kind !== 'shop' ? posNote(team, i, id) : ''; return `<li><b>${TRAITS[id].n}${v > 1 ? ` ${v}层` : ''}</b>${TRAITS[id].d(v)}${pn ? `<em class="pn">→ ${esc(pn)}</em>` : ''}</li>`; }).join('')}</ul>
  ${recv.length ? `<h4>站位加成</h4><ul>${recv.map(l => `<li><b>${TRAITS[l.id].n}</b>来自 ${SP[team[l.from].sp].n}：${esc(l.txt)}</li>`).join('')}</ul>` : ''}
  ${g.q.length ? `<h4>怪癖</h4><ul>${g.q.map(q => `<li><b>${QUIRKS[q].n}</b>${QUIRKS[q].d}</li>`).join('')}</ul>` : ''}
  ${sk ? `<h4>杀招</h4><div class="skill"><span class="seal${sk.named ? '' : ' pale'}">${esc(sk.n)}</span><p>${esc(sk.d)}<br><small>附蛊：${g.att.map(a => SP[a].n).join('、')}</small></p></div>` : ''}
  ${kind === 'mine' ? `<h4>算力履历</h4><p class="hist">累计喂养 <b>${fmtTok(g.fed)}</b> token · 突变 <b>${g.mut || 0}</b> 次</p>
  <div class="row2"><button data-act="mv" data-i="${i}" data-d="-1"${i === 0 ? ' disabled' : ''}>← 左移</button><button data-act="mv" data-i="${i}" data-d="1"${i >= S.team.length - 1 ? ' disabled' : ''}>右移 →</button></div>
  <div class="row2"><button data-act="toBag" data-i="${i}"${S.team.length > 1 && S.bag.length < BC() ? '' : ' disabled'}>收进蛊囊</button><button data-act="sell" data-i="${i}"${S.team.length > 1 ? '' : ' disabled'}>出售 +${sellValue(g)}◈</button></div>
  <p class="sm">左为炉口：多数罗盘节点作用在最左那只；炼附取最右那只。在空窍里直接拖动也能换位。</p><p class="sm">${esc(TXT.rankTip(g))}词条位 ${trCap(g)} 个。${canWield(g, S.realm) ? '' : `<br><b class="sealtx">${TXT.sealed}</b>：${esc(TXT.sealedTip(g))}`}</p>` : ''}
  ${kind === 'bag' ? `<p class="sm">${esc(TXT.bagHead)}</p><div class="row2">${S.team.length < cap ? `<button class="zhu" data-act="fromBag" data-i="${i}"${canWield(g, S.realm) ? '' : ' disabled'}>上阵</button>` : ''}<button data-act="sellBag" data-i="${i}">出售 +${sellValue(g)}◈</button></div>${S.team.length >= cap && canWield(g, S.realm) ? `<h4>换下一只上阵</h4><div class="row2 wrap">${S.team.map((t, k) => `<button data-act="swapIn" data-i="${i}" data-k="${k}">换下 ${esc(rankName(t))}</button>`).join('')}</div>` : ''}<p class="sm">${esc(TXT.rankTip(g))}${canWield(g, S.realm) ? '' : `<br><b class="sealtx">${TXT.sealed}</b>：${esc(TXT.sealedTip(g))}`}</p>` : ''}
  ${w ? `<div class="row2"><button data-act="freeze" data-i="${i}">${w.frozen ? '解冻' : '冻结（刷新时保留）'}</button><button class="zhu" data-act="buy" data-i="${i}"${!w.sold && S.stone >= cost && can ? '' : ' disabled'}>${!can ? '空窍和蛊囊都满了' : (merge ? '买下并合炼 ' : '买下 ') + cost + '◈'}</button></div><p class="sm">${merge ? `你已有两只${RANK.names[baseRank(w.sp)]}${s.n}，买下立即三合一，炼成${RANK.names[baseRank(w.sp) + 1]}${esc(TXT.mergeWarn(w.sp, S.realm))}。` : TXT.shopNote + '，自动进行。'}余 ${S.stone}◈</p>` : ''}
  <details class="book"><summary>杀招配方（${COMBOS.length}）</summary><ul>${COMBOS.map(c => `<li><b>${c.n}</b>${c.need.map(x => SP[x].n).join(' + ')}</li>`).join('')}</ul></details>`, '', ctx.stack);
}
function openGu(i) { const g = S.team[i]; if (g) guDetail(g, { kind: 'mine', i, team: S.team }); }
// ---------- 蛊囊：空窍下面常驻一行；「整理」打开完整面板 ----------
function bagBadges(g) {
  const L = S.team[0], out = [];
  if (fuseLv(g) < RANK.fuse && rankOf(g) < RANK.max && sameRank([...S.team, ...S.bag], g.sp, rankOf(g)) >= 2) out.push(`<span class="bfu" data-tip="${esc(TXT.bagFuseTip(g))}">${TXT.bagFuse}</span>`);
  if (L && L.att.length < 2) { const c = comboOf({ sp: L.sp, att: [...L.att, g.sp] }); if (c && c !== comboOf(L)) out.push(`<span class="bcb" data-tip="${esc(TXT.bagComboTip(g, c))}">${TXT.bagCombo}</span>`); }
  return out.length ? `<span class="bbadge">${out.join('')}</span>` : '';
}
function bagItem(g, i) { return `<div class="mg${canWield(g, S.realm) ? '' : ' sealed'}" data-drag="${i}" data-act="bagGu" data-i="${i}" data-tip-fn="bg">${bagBadges(g)}<span class="art">${guSVG(g.sp)}</span><b><small class="rkt">${RANK.names[rankOf(g)]}</small>${SP[g.sp].n}</b><span class="st"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i></span><span class="tr">${trChars(g.tr)}</span></div>`; }
function renderBagLine() {
  const box = $('#bagline'); if (!box) return; const m = M(), nc = (m ? m.cocoons.length : 0) + S.held.length, left = BC() - S.bag.length;
  setHTML(box, `<div class="bh"><span class="lbl" data-tip-fn="bag">蛊囊 <b>${S.bag.length}</b>/${BC()}</span>${nc && on('cocoon') ? `<button class="mini-b coc2" data-act="cocoon" data-tip="${esc(TXT.cocoonDest())}">${esc(TXT.cocoonBtn(nc))}</button>` : ''}<button class="mini-b" data-act="bag">整理</button></div>
  <div class="mini bagm" data-sort="bagm" data-group="main">${S.bag.map(bagItem).join('')}${left > 0 ? `<div class="mg empty" data-drag="${S.bag.length}" data-tip-fn="bag">${S.bag.length ? `空 ${left} 格` : '开茧和奖励得到的蛊放这里'}</div>` : ''}</div>`);
}
function bagHTML() {
  const cap = curCap(), slot = (g, i, key) => g ? `<div class="mg${canWield(g, S.realm) ? '' : ' sealed'}" data-drag="${i}" data-act="${key === 'bag' ? 'bagGu' : 'teamGu'}" data-i="${i}">${key === 'bag' ? bagBadges(g) : ''}<span class="art">${guSVG(g.sp)}</span><b><small class="rkt">${RANK.names[rankOf(g)]}</small>${SP[g.sp].n}</b><span class="st"><i class="a">${effA(g)}</i><i class="h">${effH(g)}</i></span><span class="tr">${trChars(g.tr)}</span></div>` : `<div class="mg empty" data-drag="${i}">空</div>`;
  return `<h3>蛊囊 <small>${S.bag.length}/${BC()}</small></h3><p class="sm">${esc(TXT.bagHead)}</p>
  <div class="fhead"><span class="lbl">空窍 <small>${S.team.length}/${cap} · 上阵</small></span></div><div class="mini me bagrow" data-sort="bt" data-group="bag">${Array.from({ length: cap }, (_, i) => slot(S.team[i], i, 'team')).join('')}</div>
  <div class="fhead"><span class="lbl">蛊囊 <small>不参战 · 灵气减半</small></span></div><div class="mini bagrow bagbox" data-sort="bag" data-group="bag">${Array.from({ length: BC() }, (_, i) => slot(S.bag[i], i, 'bag')).join('')}</div>`;
}
function openBag() { firstTip('bag', TXT.bagIntro); const cur = $('.sheet.bagsheet'); if (cur) cur.innerHTML = '<button class="x" data-act="closeSheet">×</button>' + bagHTML(); else sheet(bagHTML(), 'bagsheet'); }
function bagChanged() { handleMerges(); renderSlots(); renderPhase(); renderShop(); save(); if ($('.sheet.bagsheet')) openBag(); }
// 空窍 ↔ 蛊囊 之间挪动：拖到有蛊的格子就互换，拖到空格就放进去；空窍至少留一只
function moveGu(fromKey, fi, toKey, ti) {
  const A = fromKey === 'bag' ? S.bag : S.team, B = toKey === 'bag' ? S.bag : S.team, g = A[fi]; if (!g || A === B) return false;
  const capB = toKey === 'bag' ? BC() : curCap(), other = B[ti];
  if (toKey !== 'bag' && !canWield(g, S.realm)) { popPush(`<div class="toast">${esc(TXT.sealIntro(g))}</div>`, 1800, 'side'); return false; }
  if (other) { if (fromKey !== 'bag' && !canWield(other, S.realm)) return false; A[fi] = other; B[ti] = g; }
  else { if (B.length >= capB || (fromKey !== 'bag' && S.team.length <= 1)) return false; A.splice(fi, 1); B.splice(Math.min(ti, B.length), 0, g); }
  snd('clack'); return true;
}
function shareText(code) { return `${S.trial ? TXT.trialText : ''}我在《蛊码》养了一窝蛊（${REALMS[S.realm]}），敢接战帖吗？\n界壁坐标码：${code}`; }
const SHARE_BASE = 'https://1596941391qq.github.io/gu-code/';
const INSTALL_URL = 'https://github.com/1596941391qq/gu-code#安装插件获取真实-token-消耗';
function shareURL(code) { return (/^https?:/.test(location.protocol) ? location.origin + location.pathname : SHARE_BASE) + '#c=' + code; }
function myCode() { return encodeTeam(S.team.length ? S.team : starterTeam(), { name: S.name, realm: S.realm, marks: S.marks, trial: S.trial }); }
function openGhosts() {
  if (!S.ghosts || S.ghosts.realm !== S.realm) { const r = R(); S.ghosts = { realm: S.realm, list: ghostTrio(r, Math.max(1, S.nodes) + S.realm, S.realm).map(o => ({ tier: o.tier, label: o.label, name: o.name, code: encodeTeam(o.team, { name: '幽灵·' + o.name, realm: S.realm }) })) }; save(); }
  sheet(`<h3>斗幽灵 · 择一对手</h3><p class="sm">阵容摆在明面上，越难奖励越多。每场耗 1 点意志（余 ${S.will}）。连胜、每日首胜另有元石加成。</p>${S.ghosts.list.map((o, i) => { const d = decodeTeam(o.code); return `<div class="foeopt"><div class="fh"><b class="tier t-${o.tier}">${o.label}</b><span class="fn">${esc(o.name)}</span></div><p class="stakes">${stakesHTML('ghost', o.tier)}</p>${miniRow(d.team, 'foe', 'g' + i)}<button class="zhu" data-act="ghostGo" data-i="${i}"${S.will > 0 ? '' : ' disabled'}>应战</button></div>`; }).join('')}`);
}
let cardURL = '';
async function openShare() {
  const code = myCode(), url = shareURL(code);
  sheet(`<h3>界壁坐标码${trialTag(S.trial)}</h3>${S.trial ? `<p class="trialnote">${TXT.trialShare}</p>` : ''}<p class="sm">发给朋友。对方${url ? '打开链接，或' : ''}在蛊码里粘贴坐标码，就会和你这支阵容开打。</p>
  <label class="row"><span>蛊师名号</span><input id="nm" maxlength="8" value="${esc(S.name)}" placeholder="无名蛊师"></label>
  <div class="code" id="codeTxt">${code}</div>
  <div class="row2"><button data-act="copyCode">复制坐标码</button><button data-act="copyLink">${url ? '复制战帖链接' : '复制战帖文案'}</button></div>
  <div class="cardbox"><img id="cardImg" alt="分享卡"><div class="row2"><button class="zhu" data-act="savePng">保存分享卡 PNG</button></div><p class="sm">${VSC ? '' : '手机上可长按图片保存。'}</p></div>`);
  $('#nm').addEventListener('change', e => { S.name = e.target.value.trim().slice(0, 8); save(); openShare(); });
  cardURL = ''; const img = $('#cardImg');
  try { cardURL = await makeCard({ team: S.team.length ? S.team : starterTeam(), title: titleName(M()), rar: RARITY, name: S.name, realm: S.realm, total: S.total, muts: S.muts, wins: S.wins, code, url, endless: S.endless, trial: S.trial }); if (img) img.src = cardURL; } catch (e) { if (img) img.alt = '分享卡生成失败'; }
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
  if (!foe) return; if (S.meta) emit('duel_open', {});
  const mine = S.started && S.team.length ? S.team : starterTeam();
  window.__guFoe = foe;
  sheet(`<p class="eyebrow">界壁震动</p><h3 class="duelh">有人向你下战帖${trialTag(foe.trial)}</h3><p class="sm">来自 <b>${esc(foe.name || '无名蛊师')}</b> · ${REALMS[foe.realm] || '凡人'}</p>${foe.trial ? `<p class="trialnote">${TXT.trialFoe}</p>` : ''}${miniRow(foe.team, 'foe', 'duel')}
  <p class="vsline">— 你的${S.started && S.team.length ? '空窍' : '初始阵容'} —</p>${miniRow(mine, '', 'duelMine')}<p class="stakes">${stakesHTML('duel')}</p><div class="row2"><button class="zhu big" data-act="duelFight">布阵应战</button></div>`);
}
function checkHash() {
  const h = location.hash; if (!/[#&](c|r)=/.test(h)) return;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  openLinkText(h);
}

function onMerged(x) { gain('合炼', `三只合一，炼成${rankName(x)} 攻 ${x.atk} 血 ${x.hp}`); handleOut(metaEmit(M(), 'merge', { star: fuseLv(x) + 1, rank: rankOf(x) }, R(), S)); firstTip('rank', TXT.rankIntro); if (!canWield(x, S.realm)) firstTip('seal', TXT.sealIntro(x)); }
// 新得一只蛊找去处：能合炼先合炼（播升转演出），再进空窍，再进蛊囊；都满了弹出三选一（替换 / 炼化 / 暂存）
const FULL = { g: null };
function placeNew(g, quiet, mode = 'shop') {
  const r = placeGu(S.team, S.bag, g, curCap(), S.marks, R(), BC(), mode);
  if (!r.where) { FULL.g = g; sheet(`<h3>${esc(TXT.fullHead(g))}</h3><p class="dst"><i class="a">${g.atk}</i> <i class="h">${g.hp}</i> ${trChars(g.tr)}</p><div class="fullopts"><button data-act="fullSwap">${esc(TXT.fullSwap)}</button><button data-act="fullMelt">${esc(TXT.fullMelt(g, meltValue(g)))}</button><button data-act="fullHold">${esc(TXT.fullHold)}</button></div>`, 'fullsheet'); return r; }
  r.merged.forEach(onMerged);
  if (r.where === 'bag' && !r.merged.length) { gain('蛊囊', TXT.toBag(g, mode)); if (!quiet) popPush(`<div class="toast">${esc(TXT.toBag(g, mode))}</div>`, 1600, 'side'); firstTip('bag', TXT.bagIntro); setTimeout(() => { const e = $(`#bagline .mg[data-i="${S.bag.indexOf(g)}"]`); if (e) { e.classList.remove('born'); void e.offsetWidth; e.classList.add('born'); } }, 60); }
  renderSlots(); renderPhase(); if ($('.sheet.bagsheet')) openBag();
  setTimeout(() => { if (r.merged.length) { const x = r.merged[r.merged.length - 1]; fxFloat(x.uid, `炼成${RANK.names[rankOf(x)]}`, 'mut'); stampIn($('#qiao'), '合炼', false, 'side'); } else if (r.where === 'team') fxFloat(g.uid, '入窍', 'new'); }, 60);
  return r;
}
function handleMerges() { mergeAll(S.team, S.marks, R(), S.bag).forEach(onMerged); }
function openDaily() {
  const d = dailyView(M()), si = streakInfo(M());
  sheet(`<h3>日课</h3><p class="sm">每天回来做一点，断签不罚，只是从第 1 天重新算。</p>
  <div class="dfw${d.firstWinPending ? '' : ' done'}"><b>每日首胜</b><span>${d.firstWinPending ? `今天第一场胜利结算 ×${d.firstWinMul}` : '今日已领'}</span></div>
  <h4>今日三课${d.allDone ? ' · 已圆满' : ''}</h4><ul class="tasks">${d.tasks.map(t => `<li class="${t.done ? 'done' : ''}" data-tip="${esc(`${t.n}：进度 ${t.prog}/${t.need}，完成得 ${CHESTS[t.chest] ? CHESTS[t.chest].n : '宝箱'}；三课全完成另得银箱。`)}"><b>${esc(t.n)}</b><span class="tbar"><i style="width:${(100 * t.prog / t.need).toFixed(0)}%"></i></span><small>${t.prog}/${t.need} · ${CHESTS[t.chest] ? CHESTS[t.chest].n : ''}</small></li>`).join('')}</ul>
  <h4>七日签到</h4><div class="sign">${d.sign.map((r, i) => `<span class="${i < d.signDay ? 'got' : ''}${i === d.signDay - 1 ? ' today' : ''}"><b>${i + 1}</b><small>${r.map(rwText).join(' ')}</small></span>`).join('')}</div>
  <h4>连胜</h4><p class="sm">当前 ${si.n} 连胜，胜场元石 ×${si.mul.toFixed(1)}。断连只失去加成，不扣已有的东西。</p>`, 'daily');
}
function openAchs() {
  const m = M(), list = achList(m), done = list.filter(a => a.done).length;
  sheet(`<h3>成就</h3><p class="sm">已得 ${done}/${list.length} · 成就点 ${m.ap} · 称号「${esc(titleName(m))}」（写在分享卡上）</p>
  <h4>称号</h4><div class="titles">${TITLES.filter(t => m.titles.includes(t.id)).map(t => `<button data-act="title" data-id="${t.id}" class="${m.title === t.id ? 'on' : ''}">${esc(t.n)}</button>`).join('')}${TITLES.filter(t => !m.titles.includes(t.id) && t.ap !== undefined).slice(0, 1).map(t => `<span class="next">下一个：${esc(t.n)}（${t.ap} 点）</span>`).join('')}</div>
  ${['gold', 'silver', 'bronze'].map(tier => `<h4>${ACH_TIER[tier].n} · ${ACH_TIER[tier].pt} 点</h4><ul class="achl">${list.filter(a => a.tier === tier).map(a => `<li class="${a.done ? 'done' : ''}${a.hidden && !a.done ? ' hid' : ''}" data-tip="${esc(`${a.n}：${a.d}\n${ACH_TIER[tier].n}档 ${ACH_TIER[tier].pt} 成就点；奖励 ${(ACH_TIER[tier].reward || []).map(rwText).join('、')}${a.done ? '（已得）' : ''}`)}"><b>${esc(a.n)}</b><small>${esc(a.d)}</small></li>`).join('')}</ul>`).join('')}`, 'achs');
}
function lockHTML(k) { const u = UNLOCKS[k], need = Object.entries(u.need).map(([q, v]) => ({ nodes: `走完 ${v} 个罗盘节点`, wins: `斗赢 ${v} 场`, level: `蛊师 ${v} 级`, realm: `踏入${REALMS[v]}` }[q])).join('、'); return `<div class="locked"><span class="lbl">${u.n}</span><small>${u.d} · ${need}后点亮</small></div>`; }

// ---------- 设置 ----------
const applyCalm = () => document.documentElement.toggleAttribute('data-calm', !!S.calm);
const isCalm = () => !!S.calm;   // 表现组件读这个：减弱震屏与闪光
function openSettings() {
  const tog = (act, on, a = '开', b = '关') => `<button class="tog${on ? ' on' : ''}" data-act="${act}" aria-pressed="${on}">${on ? a : b}</button>`;
  ledgerBindLimits(sheet(`<h3>设置</h3>
  <div class="set"><span>主题</span><div class="segs">${[['auto', '自动'], ['light', '日'], ['dark', '夜']].map(([k, t]) => `<button data-act="setTheme" data-v="${k}" class="${(S.theme || 'auto') === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
  <div class="set"><span>声音<small>古琴、钱币与木鱼</small></span>${tog('setMute', !S.mute)}</div>
  <div class="set"><span>减弱震屏与闪光<small>暴击、斩杀、开茧的震动和闪白都调弱</small></span>${tog('setCalm', !!S.calm)}</div>
  ${VSC ? '' : `<div class="set"><span>匿名统计<small>只发游玩事件计数，帮我们调数值；不含代码与对话内容，默认关闭</small></span>${tog('setStats', !!S.stats)}</div>`}
  <div class="set"><span>导出游玩数据<small>最近 ${S.log.length} 条事件（获得、战斗、节点、升阶），只存在本机${VSC ? '，导出到剪贴板' : ''}</small></span><button class="tog" data-act="exportLog">导出</button></div>
  <div class="set"><span>近期所得<small>最近 50 条奖励记录：时间、来源、内容</small></span><button class="tog" data-act="gains">查看</button></div>
  ${ledgerLimitRows()}
  <p class="sm">累计喂养 ${fmtTok(S.total)} token · 胜 ${S.wins} · 负 ${S.losses}</p>`, 'settings'));
}
// ---------- 集成接口：合分支时替换实现（现在只往本地事件日志里记一笔）----------
function logEv(k, o = {}) { (S.log || (S.log = [])).push({ t: Date.now(), k, ...o }); if (S.log.length > 500) S.log.splice(0, S.log.length - 500); }
const emit = (type, p) => handleOut(metaEmit(M(), type, p, R(), S));
function onGain(g, from) { logEv('gain', { sp: g.sp, from }); gainRar(g, from); }      // 获得蛊：starter | summon | shop | loot | cocoon
function onRefresh(items, why) { logEv('refresh', { why, sp: items.map(w => w.sp) }); emit('shop_refresh', shopFlags(items)); } // 蛊市刷新：manual | node | realm | init
function onBattleEnd(B) {                                                             // 战斗结束：返回 meta 的结算（连胜、首胜、掉箱、败也有得）
  logEv('battle', { kind: B.kind, w: B.res.winner, turns: B.res.turns, tier: B.tier || null });
  if (B.kind === 'replay' || B.res.winner === 'draw') return null;
  const log = B.res.log, s0 = log[0].s[0], s1 = log[log.length - 1].s[0], hp = s => s.reduce((a, x) => a + x[2], 0);
  const mine = log.filter(e => e.t === 'dmg' && e.src === 0), win = B.res.winner === 'A';
  const safe = false;
  const out = metaEmit(M(), 'battle_end', { kind: B.kind === 'ghost' ? (B.tier || 'mid') : B.kind, win, hpLeftRatio: hp(s1) / Math.max(1, hp(s0)), crits: B.crits | 0, maxHit: Math.max(0, ...mine.map(e => e.n)), skills: log.filter(e => e.t === 'combo' && B.res.roster[e.uid] && B.res.roster[e.uid].side === 0).length, turns: B.res.turns, streakSafe: safe }, R(), S);
  if (B.kind === 'endless' && win) out.more = metaEmit(M(), 'endless_floor', { floor: S.floor }, R(), S);
  return out;
}
let qiAcc = 0, qiT = 0;
function onTokens(d, rate, bySource) {                                               // 每次 token 进账（约 5 次/秒）：经验、灵气宝箱、蛊的灵气
  emit('token', { delta: d, rate });
  const fed = feedTeam(S.team, d); qiAcc += d; if (S.bag.length) { const per = d / Math.max(1, S.team.length) * BAG.feedMul; S.bag.forEach(g => feedGu(g, per)); }   // 蛊囊里的只吃一半
  if (inBattle) return;
  fed.forEach(f => { if (f.up) { const g = S.team.find(x => x.uid === f.uid); if (g) gain('灵气', `${SP[g.sp].n} 灵气升级：攻 +${f.atk} 血 +${f.hp}`); renderSlots(); setTimeout(() => { fxFloat(f.uid, `灵气升级 +${f.atk}/+${f.hp}`, 'mut'); const e = $(`.gu[data-uid="${f.uid}"]`); if (e) { e.classList.remove('pulse'); void e.offsetWidth; e.classList.add('pulse'); } }, 30); } });
  const now = performance.now(); if (now - qiT > 3500 && qiAcc > 0 && S.team.length) { qiT = now; const g = S.team[0]; fxFloat(g.uid, qiText(Math.round(qiAcc * META_TUNE.gu.leadShare)), 'qi'); qiAcc = 0; }
  const b = $('#lvbar i'); if (b) { const L = levelInfo(M()); b.style.width = (L.need ? Math.min(100, 100 * L.cur / L.need) : 100).toFixed(1) + '%'; }
}
function onNode(n) { logEv('node', { type: n.type, n: S.nodes + 1 }); emit('node_done', { type: n.type }); tutorialEvent('node_done'); }
function onRealm(r) { logEv('realm', { r }); emit('realm_up', { realm: r }); }
function onSession(away) {
  logEv('session', { total: Math.round(S.total), realm: S.realm });
  const d = new Date(); emit('session_start', { date: today(), hour: d.getHours(), awayMs: S.seen ? Date.now() - S.seen : 0, awayTokens: away | 0 });
}
setInterval(() => { if (booted && S.meta) { const d = new Date(); emit('day_tick', { date: today(), hour: d.getHours() }); } }, 60000);

// ---------- 悬停提示：任何元素加 data-tip（文字）或 data-tip-fn（动态）即可；鼠标悬停 250ms，触屏长按 ----------
function multTip(lab, m) {
  if (/连胜/.test(lab)) return `${lab}：连胜越长结算越高（上限 ×${META_TUNE.streak.cap}），断连只失去加成。本场 ×${m}`;
  if (/首胜/.test(lab)) return `每日首胜：今天第一场胜利的元石按 ×${META_TUNE.daily.firstWinMul} 结算（与连胜相加）。本场折算 ×${m}`;
  if (/翻盘/.test(lab)) return '绝境翻盘：己方剩血不到两成时赢下，元石 ×2。';
  if (/暴击/.test(lab)) return `${lab}：单场打出 3 次以上暴击，元石 ×1.2。`;
  if (/生财/.test(lab)) return '道痕「生财有道」：斗蛊所得元石 ×1.5。';
  return `${lab} ×${m}`;
}
function guTip(g, team, i) {
  if (!g) return '';
  const s = SP[g.sp], sk = skillOf(g), pn = id => team ? posNote(team, i, id) : '';
  return `<b>${rarTag(g)}${g.boss ? '劫·' : ''}${rankName(g)}</b> <i class="a">${effA(g)}</i> <i class="h">${effH(g)}</i>${g.wound ? ` <span class="wd">伤${g.wound}</span>` : ''}<br><small>${esc(s.lore)}${team ? ` · 第 ${i + 1} 位` : ''}</small>`
    + `<ul>${g.tr.map(([id, v]) => `<li><b>${TRAITS[id].n}${v > 1 ? v : ''}</b> ${esc(TRAITS[id].d(v))}${pn(id) ? `<em> → ${esc(pn(id))}</em>` : ''}</li>`).join('')}${g.q.map(q => `<li><b>${QUIRKS[q].n}</b> ${esc(QUIRKS[q].d)}</li>`).join('')}</ul>`
    + (sk ? `<p><b>${esc(sk.n)}</b> ${esc(sk.d)}</p>` : '') + (g.boss == null && !canWield(g, S.realm) && team === S.team ? `<p><b class="sealtx">${TXT.sealed}</b> ${esc(TXT.sealedTip(g))}</p>` : '') + `<small>点开看完整详情</small>`;
}
const TIPS = {
  bag: () => esc(TXT.bagRowTip()),
  bg: t => { const g = S.bag[+t.dataset.i]; return g ? guTip(g) + '<small>在蛊囊里：不参战，拖进空窍才上阵</small>' : ''; },
  gu: t => guTip(S.team[+t.dataset.i], S.team, +t.dataset.i),
  mg: t => { const tm = FOE[t.dataset.k]; return tm ? guTip(tm[+t.dataset.i], tm, +t.dataset.i) : ''; },
  ware: t => { const w = S.shop[+t.dataset.i]; if (!w) return ''; const n = owned(w.sp), shelf = S.shop.filter(x => x.sp === w.sp && !x.sold).length; return guTip(newGu(w.sp)) + `<small>买下时开茧定品质，价格 ${buyCost()}◈</small>` + (n >= 2 ? `<p>你已有 ${n} 只${RANK.names[baseRank(w.sp)]}${SP[w.sp].n}，买下即合炼成${RANK.names[baseRank(w.sp) + 1]}${esc(TXT.mergeWarn(w.sp, S.realm))}</p>` : n + shelf >= 3 ? `<p>${esc(TXT.fuseTip(w.sp, 3 - n))}</p>` : ''); },
  level: () => { const L = levelInfo(M()); return `<b>蛊师 ${L.level} 级</b> 经验 ${Math.floor(L.cur)}/${L.need}<br><small>写代码、走节点、斗蛊（输了也给）、开茧、合炼都给经验</small><p>下一级奖励：</p><ul>${L.next.map(r => `<li>${esc(rwLine(r))}</li>`).join('') || '<li>已满级</li>'}</ul>`; },
  rate: () => `<b>灵流 ${fmtTok(rate)}/s</b><br><small>${src.mode === 'vscode' ? '本机 AI 工具每秒烧掉的 token' : '网页里是模拟灵流'}。${hot ? '武火：' : '文火：'}超过 ${fmtTok(src.hotTh)}/s 算武火，走完节点有几率多一次突变或怪癖。</small><p>今日 ${fmtTok(S.todayKey === today() ? S.todayTok : 0)} · 本次 ${fmtTok(sessTok)} · 累计 ${fmtTok(S.total)}</p>`,
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

// ---------- 拖动换位 ----------
let drag = null, dragEndT = -1e9;
const moveIdx = (arr, f, t) => { const [x] = arr.splice(f, 1); arr.splice(t, 0, x); };
const SORT = {
  team(f, t) { moveIdx(S.team, f, t); renderSlots(); renderPhase(); renderHint(); save(); snd('clack'); tutorialEvent('formation_swap'); },
  mine(f, t) { moveIdx(S.team, f, t); renderSlots(); renderPhase(); save(); snd('clack'); renderPrep(false); tutorialEvent('formation_swap'); },
  bt(f, t) { if (S.team[f] && t < S.team.length) { moveIdx(S.team, f, t); snd('clack'); bagChanged(); } },
  bag(f, t) { if (S.bag[f] && t < S.bag.length) { moveIdx(S.bag, f, t); snd('clack'); bagChanged(); } },
  bagm(f, t) { if (S.bag[f] && t < S.bag.length) { moveIdx(S.bag, f, t); snd('clack'); bagChanged(); } },
};
const XSORT = { bt: 'team', bag: 'bag', team: 'team', bagm: 'bag' };   // 跨格子拖动：蛊囊面板里空窍行与蛊囊行之间
document.addEventListener('pointerdown', e => {
  const it = e.target.closest('[data-drag]'), box = it && it.closest('[data-sort]');
  if (!it || !box || e.button > 0) return;
  if (it.classList.contains('empty')) return;
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
  if (d.to === d.from) return; const tgt = d.items[d.to], tbox = tgt && tgt.closest('[data-sort]'), fi = +d.it.dataset.drag, ti = +tgt.dataset.drag;
  if (tbox && tbox !== d.box && XSORT[d.box.dataset.sort] && XSORT[tbox.dataset.sort]) { if (moveGu(XSORT[d.box.dataset.sort], fi, XSORT[tbox.dataset.sort], ti)) bagChanged(); }
  else if (SORT[d.box.dataset.sort] && !(d.box.dataset.sort === 'team' && ti >= S.team.length)) SORT[d.box.dataset.sort](fi, ti);
}
window.addEventListener('pointerup', dragEnd); window.addEventListener('pointercancel', dragEnd);

// ---------- 交互 ----------
const ACT = {
  pick(a) { S.team = [newGu(a.dataset.sp)]; S.started = true; onGain(S.team[0], 'starter'); S.shop = []; S.compass = rollCompass(R(), S.team, true, curCap()); save(); renderAll(); },
  node(a) {
    const i = +a.dataset.i; if (S.sel === i) return;
    if (S.sel != null) S.bank += S.prog;
    S.sel = i; S.prog = 0; S.wh = 0;
    const cost = S.compass[i].cost * src.unit, take = Math.min(S.bank, cost); S.prog = take; S.bank -= take;
    renderPhase(); renderHint(); snd('pluck'); save(); if (take > 0) { pourFx(); const nb = document.querySelector(`.node[data-i="${i}"]`); if (nb) nb.classList.add('pour'); }
    if (S.prog >= cost - 0.5) setTimeout(() => { if (S.sel === i && !inBattle) resolveNode(); }, 500);
  },
  gu(a) { openGu(+a.dataset.i); },
  mv(a) { const i = +a.dataset.i, j = i + +a.dataset.d; if (!S.team[j]) return; [S.team[i], S.team[j]] = [S.team[j], S.team[i]]; tutorialEvent('formation_swap'); closeSheet(); renderSlots(); renderPhase(); save(); openGu(j); },
  demo(a) { if (VSC) return; src.demo = a.dataset.m === 'rest' ? 'rest' : 'coding'; meters(); },
  src() {
    if (VSC) { const sl = srcList(bySrc); sheet(`<h3>${TXT.srcHead}</h3><p>${TXT.srcFrom}</p><p class="sm">当前灵流 <b>${fmtTok(rate)}/s</b></p>${sl.length ? `<ul class="srclist">${sl.map(x => `<li><span>${esc(x.name)}</span><b>${fmtTok(x.rate)}/s</b></li>`).join('')}</ul>` : `<p class="sm">${rate > 0 ? '' : TXT.srcNone}</p>`}`, 'srcinfo'); return; }
    sheet(`<h3>${TXT.demoHead}</h3><p>${TXT.demoFrom}</p><p class="sm">${TXT.demoTrial}</p><p>${TXT.demoInstall}</p><div class="row2"><a class="btn zhu" href="${INSTALL_URL}" target="_blank" rel="noopener">看插件安装方法</a></div><p class="sm">${esc(INSTALL_URL)}</p>`, 'demoinfo');
  },
  theme() { S.theme = { auto: 'light', light: 'dark', dark: 'auto' }[S.theme || 'auto']; applyTheme(); save(); },
  sound() { S.mute = !S.mute; save(); snd('pluck'); },
  settings() { openSettings(); },
  gains() { openGains(); },
  popx(a) { a.remove(); },
  chest() {
    const m = M(); if (!m.chests.length) return; const out = openChest(m, R(), 0); if (!out) return;
    const c = CHESTS[out.tier], big = out.tier === 'gold' || out.tier === 'xuan';
    popPush(`<div class="chestc t-${out.tier}"><small>开箱</small><b>${c.n}</b><p>${out.rewards.filter(r => r.why !== '升级' && r.why !== '成就').map(r => `<span>${rwText(r)}</span>`).join('')}</p></div>`, big ? 2000 : 1300, big ? 'big' : 'center');
    snd(big ? 'coins' : 'coin'); handleOut(out); save();
  },
  cocoon() {
    const m = M(); let g = S.held.shift();
    if (!g) { const c = openCocoon(m, R()); if (!c) return; g = newGu(R().pick(shopPool())); applyRarity(g, c.tier, R()); handleOut(metaEmit(m, 'cocoon', { rarity: c.tier }, R(), S)); revealPop(g, 'cocoon'); }
    firstTip('cocoon', TXT.cocoonIntro); placeNew(g, false, 'reward'); renderLevel(); renderBagLine(); save();
  },
  daily() { openDaily(); }, achs() { openAchs(); },
  title(a) { if (setTitle(M(), a.dataset.id)) { save(); openAchs(); } },
  setTheme(a) { S.theme = a.dataset.v; applyTheme(); save(); openSettings(); },
  setMute() { S.mute = !S.mute; save(); snd('pluck'); openSettings(); },
  setCalm() { S.calm = !S.calm; applyCalm(); save(); openSettings(); },
  setStats() { if (!VSC) { S.stats = !S.stats; save(); openSettings(); } },
  exportLog(a) {
    const data = JSON.stringify({ app: 'gucode', v: 1, at: new Date().toISOString(), realm: S.realm, nodes: S.nodes, wins: S.wins, losses: S.losses, total: Math.round(S.total), log: S.log }, null, 1);
    if (VSC) { copy(data, a); return; }
    const u = URL.createObjectURL(new Blob([data], { type: 'application/json' })), l = document.createElement('a'); l.href = u; l.download = `gucode-log-${today()}.json`; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000);
  },
  share() { openShare(); },
  trib() { prep('trib'); }, ghost() { openGhosts(); tutorialEvent('ghost_open'); }, endless() { prep('endless'); },
  path() { openPath(); }, codex() { openCodex(); },
  ledger() { openLedger({ name: S.name, realm: REALMS[S.realm], rank: titleName(M()) }); },
  ghostGo(a) { const o = S.ghosts && S.ghosts.list[+a.dataset.i]; if (!o || S.will <= 0) return; const d = decodeTeam(o.code); prep('ghost', { team: d.team, name: o.name, tier: o.tier, label: o.label }); },
  choose(a) { const p = S.pending; if (!p) return; finishNode(p.node, p.opts[+a.dataset.i], p.wu, p.cost); },
  buy(a) {
    const w = S.shop[+a.dataset.i], cost = buyCost(); if (!w || w.sold || S.stone < cost) return;
    if (!canBuy(S.team, w.sp, curCap(), S.bag, BC())) return; closeSheet();
    const g = newGu(w.sp); onGain(g, 'shop');
    S.stone -= cost; w.sold = true; w.frozen = false; tutorialEvent('shop_open');
    placeNew(g); renderShop(); save(); snd('pluck');
  },
  trio(a) {
    const sp = a.dataset.sp, c = trioCost(); if (trioSp() !== sp || S.stone < c || !trioPlan(sp)) return;
    S.stone -= c; let k = 0; S.shop.forEach(w => { if (w.sp === sp && !w.sold && k < 3) { w.sold = true; w.frozen = false; k++; } });
    gain('蛊市', `三只${SP[sp].n}一起买 −${c} 元石（8 折）`);
    for (let j = 0; j < 3; j++) { const g = newGu(sp); onGain(g, 'shop'); placeNew(g, true); }
    renderShop(); save(); snd('pluck'); tutorialEvent('shop_open');
  },
  bag() { openBag(); },
  bagGu(a) { const i = +a.dataset.i, g = S.bag[i]; if (g) guDetail(g, { kind: 'bag', i, stack: true }); },
  teamGu(a) { const i = +a.dataset.i, g = S.team[i]; if (g) guDetail(g, { kind: 'mine', i, team: S.team, stack: true }); },
  toBag(a) { const i = +a.dataset.i; if (moveGu('team', i, 'bag', S.bag.length)) { closeSheet(); gain('蛊囊', `${rankName(S.bag[S.bag.length - 1])} 收进蛊囊`); bagChanged(); } },
  fromBag(a) { const i = +a.dataset.i; if (moveGu('bag', i, 'team', S.team.length)) { closeSheet(); bagChanged(); } },
  swapIn(a) { if (moveGu('bag', +a.dataset.i, 'team', +a.dataset.k)) { closeSheet(); bagChanged(); } },
  sellBag(a) { const i = +a.dataset.i, g = S.bag[i]; if (!g) return; S.stone += sellValue(g); gain('出售', `${rankName(g)}（蛊囊）→ +${sellValue(g)} 元石`); S.bag.splice(i, 1); closeSheet(); bagChanged(); },
  fullSwap() { const g = FULL.g; if (!g) return; sheet(`<h3>${esc(TXT.fullSwap)}</h3><p class="sm">换上 ${esc(rankName(g))}（<i class="a">${g.atk}</i> <i class="h">${g.hp}</i>）</p>${[['team', S.team], ['bag', S.bag]].map(([k, l]) => `<h4>${k === 'team' ? '空窍' : '蛊囊'}</h4><div class="row2 wrap">${l.map((x, i) => `<button data-act="fullPick" data-k="${k}" data-i="${i}">${esc(rankName(x))} +${sellValue(x)}◈</button>`).join('')}</div>`).join('')}`, 'fullsheet', true); },
  fullPick(a) { const g = FULL.g, l = a.dataset.k === 'bag' ? S.bag : S.team, i = +a.dataset.i, x = l[i]; if (!g || !x) return; FULL.g = null; S.stone += sellValue(x); l[i] = g; gain('开茧', `${rankName(x)} 换下 +${sellValue(x)} 元石，${rankName(g)} 补上`); closeSheet(); closeSheet(); bagChanged(); },
  fullMelt() { const g = FULL.g; if (!g) return; FULL.g = null; const v = meltValue(g); S.stone += v; gain('开茧', `${rankName(g)} 炼化 +${v} 元石`); closeSheet(); renderMeta(); renderShop(); save(); stoneFloat(v); },
  fullHold() { const g = FULL.g; if (!g) return; FULL.g = null; S.held.unshift(g); gain('开茧', `${rankName(g)} 暂存回茧托盘`); closeSheet(); renderLevel(); renderBagLine(); save(); },
  refresh() { const free = freeRef(), c = free ? 0 : refCost(); if (S.stone < c) return; S.stone -= c; S.shop = rollWares(S.shop); onRefresh(S.shop, 'manual'); tutorialEvent('shop_open'); renderMeta(); renderShop(); save(); snd('tick'); },
  freeze(a) { const i = +a.dataset.i, w = S.shop[i]; if (w) { w.frozen = !w.frozen; renderShop(); save(); if (a.closest('.sheet')) guDetail(newGu(w.sp), { kind: 'shop', i }); } },
  sell(a) { const i = +a.dataset.i, g = S.team[i]; if (!g || S.team.length <= 1) return; S.stone += sellValue(g); gain('出售', `${SP[g.sp].n} → +${sellValue(g)} 元石`); S.team.splice(i, 1); closeSheet(); renderSlots(); renderShop(); renderPhase(); save(); },
  marksInfo() { if (S.marks.length) sheet(`<h3>道痕</h3><p class="sm">整局被动，渡劫成功时三选一。</p><ul>${S.marks.map(k => `<li><b>${MARKS[k].n}</b>${MARKS[k].d}</li>`).join('')}</ul>`); },
  speed() { S.speed = S.speed === 1 ? 2 : 1; $('#bspd').textContent = S.speed + '×'; save(); },
  skip() { skip = true; },
  payskip() { payFast = true; },
  loot(a) {
    const l = window.__guB.loot[+a.dataset.i];
    gain('道痕', l.t); if (l.k === 'mark' && !S.marks.includes(l.id)) S.marks.push(l.id);
    closeBattle();
  },
  closeBattle() { closeBattle(); },
  replyDuel() { closeBattle(); openShare(); },
  closeSheet(a, e) { if (e.target.closest('[data-stop]') && !a.classList.contains('x')) return; closeSheet(); },
  shut() { closeSheet(); },
  ware(a) { const w = S.shop[+a.dataset.i]; if (w && !w.sold) { guDetail(newGu(w.sp), { kind: 'shop', i: +a.dataset.i }); tutorialEvent('shop_open'); } },
  peek(a) { const t = FOE[a.dataset.k], i = +a.dataset.i; if (t && t[i]) guDetail(t[i], { kind: a.dataset.k === 'mine' ? 'view' : 'foe', i, team: t, stack: !!a.closest('.sheet') }); },
  fight() { const P = PREP; if (!P) return; oddsJob++; PREP = null; closeSheet(); startBattle(P.kind, P.foe); },
  copyCode(a) { copy(myCode(), a); emit('share', { kind: 'code' }); },
  copyLink(a) { const c = myCode(), u = shareURL(c); copy(u ? shareText(c) + '\n' + u : shareText(c), a); emit('share', { kind: 'link' }); },
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
    const tr = B.A.trial || B.B.trial;
    copy(`${tr ? TXT.trialText : ''}《蛊码》复盘：${an}${B.A.trial ? '（试玩）' : ''} 对 ${bn}${B.B.trial ? '（试玩）' : ''}，${wt}。点开看整场：\n${replayURL(B.replay)}`, a);
  },
  duelFight() { prep('duel', window.__guFoe); },
  reset(a) {
    if (Date.now() - resetArm > 3000) { resetArm = Date.now(); a.textContent = '再点一次确认重开'; setTimeout(() => { a.textContent = '重开一局'; }, 3000); return; }
    codexScan(); const keep = { sound: S.sound, name: S.name, total: S.total, theme: S.theme, codex: S.codex, meta: S.meta, tutDone: true, mute: S.mute, calm: S.calm, stats: S.stats, log: S.log, todayKey: S.todayKey, todayTok: S.todayTok, qlim: S.qlim, lgSnap: S.lgSnap, lgAch: S.lgAch }; S = Object.assign(fresh(), keep); save(); renderAll();
  },
};
document.addEventListener('click', e => {
  if (performance.now() - tipLongAt < 500) { e.preventDefault(); return; }   // 长按看提示后松手，不当作点击
  tipHide();
  const a = e.target.closest('[data-act]'); if (!a || a.disabled || performance.now() - dragEndT < 250) return;
  const f = ACT[a.dataset.act]; if (f) f(a, e);
});

// ---------- 算力履历（src/ledger.js）：收数据、周天上限存档；玩法挂钩见 ledger.js 文件头 ----------
ledgerInit({ vsc: VSC, openSettings, buffsOn: true, getLimits: () => S.qlim || {}, setLimit: (k, v) => { S.qlim = Object.assign({}, S.qlim); if (v > 0) S.qlim[k] = v; else delete S.qlim[k]; save(); }, onData: ledgerSync });
function ledgerSync() {   // 真实履历到达：周天轮转箱、履历成就、全年称号交给 meta 结算
  ledgerShades($('#qiao')); if (!booted || !S.started || !ledgerLive()) return;
  const rw = ledgerApply(M(), S, ledgerData()), out = metaEmit(M(), 'ledger', {}, R(), S);
  rw.forEach(r => { if (r.k === 'chest') out.chests.push(r.tier); out.rewards.push(r); });
  handleOut(out); save();
}

// ---------- 启动 ----------
function boot(saved, pending) {
  const mg = migrate(saved); if (mg) S = Object.assign(fresh(), mg);
  S.meta = metaMigrate(S.meta, S);
  S.trial = !VSC;   // 网页只有模拟灵流，存档一律算试玩；插件只认真实 token
  if (!document.getElementById('gu-defs')) document.body.insertAdjacentHTML('afterbegin', `<svg id="gu-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${ART_DEFS}</defs></svg>`);
  applyTheme(); if (VSC && window.MutationObserver) new MutationObserver(applyTheme).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  booted = true; renderAll(); requestAnimationFrame(veinLoop);
  const away = pending && pending.tokens > 0 && S.started ? pending.tokens : 0;
  if (pending && pending.tokens > 0 && S.started) { countTok(pending.tokens); feed(pending.tokens, pending.hot || 0); renderSlots(); renderPhase(); const h = $('#hint'); if (h) h.textContent = `你不在的时候，蛊吸纳了 ${fmtTok(pending.tokens)} token。`; }
  onSession(away); checkHash(); ledgerSync();
  if (!S.started && !S.tutDone && !location.hash.match(/[#&](c|r)=/)) setTimeout(runTutorial, 300);
}
// 新手引导：第一场斗蛊必胜并打出杀招（见 startBattle 里的 tutorialFight）
function runTutorial() {
  const steps = [];
  TUTORIAL_STEPS.forEach(st => {
    if (st.id === 'formation') steps.push({ ...st, sel: '#slots', click: '[data-act="mv"]', text: '拖动空窍里的蛊换位：最左的炉口最先出手，站位就是战术。' });
    else if (st.id === 'feed') { steps.push({ ...st, click: '[data-tut-none]', evt: ['node_done', 'node_choice'], text: VSC ? st.text : '网页读不到你电脑上的 AI 用量，这里是模拟灵流，节点条会自己走满。想用真实 token 养蛊，装 VS Code 插件。' }); steps.push({ id: 'choose', sel: '.nodes', click: '.opt', evt: 'node_done', text: '节点走满，停在一道选择题上：挑一个。' }); }
    else steps.push(st);
  });
  const tut = startTutorial(steps, { vsc: !!VSC, onStep(i, st) {
    if (st.id === 'choose' && !S.pending) setTimeout(() => tut.next(), 0); if (st.id === 'shop' && !isUnlocked(M(), S, 'shop')) { M().unlocked.shop = true; renderShop(); showOut({ levelUps: [], achievements: [], chests: [], unlocks: ['shop'], rewards: [], notes: [] }); } }, onDone() { S.tutDone = true; save(); } });
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
