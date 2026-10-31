// 蛊码 GuCode · 战斗画面：斜俯视的 6×3 阵盘、出手顺序条、出手预告、弹道、伤害数字、主动技大字、杀招动画、结算页。
// 只读 battle() 的结果（log + roster + units）重放，不改任何战斗数据。对外：playBattle(el, result, opts) → Promise（结算页点「继续」才 resolve）
import { guSVG, ART_DEFS } from './art.js';
import { TRAITS, XING } from './core.js';
import { FOOD } from './foods.js';
import { DAO } from './daos.js';
import { playCombo } from './combo-fx.js';

const CSS = `
.gbv{--a:var(--qing,#6fb7a4);--b:var(--zhu2,#d8553f);--pp:var(--paper,#e7ddc7);--ik:var(--ink,#1c1915);position:relative;user-select:none;-webkit-user-select:none;color:var(--tx,#ddd3bf);font:13px/1.4 var(--sans,system-ui)}
.gbv-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 6px}
.gbv-tt{font:16px/1.2 var(--kai,serif);letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gbv-tt small{font:12px var(--sans,system-ui);color:var(--mu,#8f8775);margin-left:6px;letter-spacing:0}
.gbv-ctl{display:flex;gap:4px;flex:0 0 auto}
.gbv-ctl button{min-width:34px;height:26px;padding:0 8px;border:1px solid var(--line2,rgba(233,224,204,.32));border-radius:3px;font:12px/24px var(--sans,system-ui);color:var(--tx,#ddd3bf);background:transparent;cursor:pointer}
.gbv-ctl button.on{background:var(--tx,#ddd3bf);color:var(--bg,#15130f);border-color:transparent}
.gbv-ord{position:relative;height:40px;margin:0 0 4px;overflow:hidden;border-bottom:1px solid var(--line,rgba(233,224,204,.14))}
.gbv-ord .gbv-lab{position:absolute;left:0;top:2px;font:10px/1 var(--sans,system-ui);color:var(--mu,#8f8775)}
.gbv-chip{position:absolute;top:10px;width:26px;height:26px;border-radius:50%;background:var(--pp);border:2px solid var(--a);overflow:hidden;transition:transform .32s cubic-bezier(.3,.7,.3,1),opacity .25s}
.gbv-chip.gbv-sb{border-color:var(--b)}
.gbv-chip svg{width:100%;height:100%;filter:brightness(0);opacity:.82}
.gbv-chip.gbv-sb svg{transform:scaleX(-1)}
.gbv-chip.now{width:32px;height:32px;top:6px;box-shadow:0 0 0 2px var(--bg,#15130f),0 0 0 4px var(--tx,#ddd3bf)}
.gbv-rd{position:absolute;top:14px;font:11px/1 var(--kai,serif);color:var(--mu,#8f8775);border-left:1px solid var(--line2,rgba(233,224,204,.32));padding-left:3px;height:18px;line-height:18px;transition:transform .32s cubic-bezier(.3,.7,.3,1)}
.gbv-syn{min-height:16px;font:11px/16px var(--sans,system-ui);color:var(--mu,#8f8775);display:flex;justify-content:space-between;gap:8px;margin-bottom:2px}
.gbv-syn span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gbv-st{position:relative;overflow:hidden;touch-action:manipulation}
.gbv-cam{position:absolute;inset:0;transform-origin:50% 55%}
.gbv-st.shake{animation:gbvshk .22s linear}
@keyframes gbvshk{20%{transform:translate(-3px,1px)}40%{transform:translate(3px,-2px)}60%{transform:translate(-2px,2px)}80%{transform:translate(2px,-1px)}}
.gbv-floor{position:absolute;left:0;top:0;pointer-events:none}
.gbv-floor .t{fill:var(--bg2,#1e1b16);stroke:var(--line2,rgba(233,224,204,.32));stroke-width:1}
.gbv-floor .t.ta{fill:color-mix(in srgb,var(--a) 9%,var(--bg2,#1e1b16))}
.gbv-floor .t.tb{fill:color-mix(in srgb,var(--b) 9%,var(--bg2,#1e1b16))}
.gbv-floor .t.aim{fill:color-mix(in srgb,var(--b) 42%,var(--bg2,#1e1b16));stroke:var(--b);stroke-width:2}
.gbv-floor .t.aimA{fill:color-mix(in srgb,var(--a) 42%,var(--bg2,#1e1b16));stroke:var(--a);stroke-width:2}
.gbv-floor .t.aim.gold,.gbv-floor .t.aimA.gold{stroke:#d9a441;stroke-width:2.5}
.gbv-floor .gbv-midl{stroke:var(--line2,rgba(233,224,204,.32));stroke-dasharray:3 4}
.gbv-u{position:absolute;transform:translate(-50%,-100%);transition:left .24s ease,top .24s ease,opacity .3s;pointer-events:auto;cursor:pointer}
.gbv-tok{position:relative;margin:0 auto;background:var(--pp);border-radius:40% 40% 10px 10px;box-shadow:0 2px 0 var(--shadow,rgba(0,0,0,.45));border-bottom:3px solid var(--a);transition:filter .08s,transform .12s}
.gbv-u.gbv-sb .gbv-tok{border-bottom-color:var(--b)}
.gbv-tok svg{display:block;width:100%;height:100%}
.gbv-u.gbv-sb .gbv-tok svg{transform:scaleX(-1)}
.gbv-u.now .gbv-tok{box-shadow:0 0 0 2px var(--tx,#ddd3bf)}
.gbv-u.flash .gbv-tok{filter:brightness(2.4) saturate(0)}
.gbv.calm .gbv-u.flash .gbv-tok{filter:none;opacity:.6}
.gbv-u.die{opacity:0;transform:translate(-50%,-80%) scale(.9);transition:opacity .5s,transform .5s}
.gbv-u.die .gbv-tok{filter:grayscale(1)}
.gbv-u.summon{animation:gbvpop .3s ease}
.gbv-u.rise{animation:gbvrise .7s ease both}
@keyframes gbvrise{0%{transform:translate(-50%,-100%) rotate(80deg) scale(.85);opacity:.3;filter:grayscale(1)}60%{transform:translate(-50%,-112%) rotate(-6deg)}100%{transform:translate(-50%,-100%);opacity:1}}
@keyframes gbvpop{from{transform:translate(-50%,-100%) scale(.3);opacity:0}}
.gbv-bar{height:4px;margin:2px auto 0;background:rgba(0,0,0,.45);border-radius:2px;overflow:hidden;position:relative}
.gbv-bar i{position:absolute;left:0;top:0;bottom:0;background:#4f9a6a;transition:width .25s}
.gbv-bar i.gbv-shi{background:#cfd8e0;opacity:.85}
.gbv-bar.lo i.gbv-hpi{background:#c65a3a}
.gbv-gp{height:3px;margin:1px auto 0;background:rgba(0,0,0,.4);border-radius:2px;overflow:hidden}
.gbv-gp i{display:block;height:100%;background:#d9a441;transition:width .25s}
.gbv-gp.full i{background:#f2c35a;box-shadow:0 0 4px #f2c35a}
.gbv-ic{position:absolute;left:50%;top:-14px;transform:translateX(-50%);display:flex;gap:1px;white-space:nowrap}
.gbv-ic b{font:10px/12px var(--kai,serif);padding:0 2px;border-radius:2px;background:var(--ik);color:#efe7d4}
.gbv-ic b.psn{background:#3d6b3a}.gbv-ic b.burn{background:#a3471f}.gbv-ic b.chill{background:#3f6f95}.gbv-ic b.stun,.gbv-ic b.web{background:#6a5a8a}.gbv-ic b.guard,.gbv-ic b.taunt{background:#7a6a3a}.gbv-ic b.mark{background:#8a2a2a}
.gbv-fl{position:absolute;pointer-events:none;transform:translate(-50%,-50%);font:700 15px/1 var(--sans,system-ui);color:var(--float,#f0e6d0);text-shadow:0 1px 0 var(--fshadow,#000),0 0 3px var(--fshadow,#000);white-space:nowrap;animation:gbvfl .9s ease-out forwards;z-index:30}
.gbv-fl.crit{font-size:22px;color:#f2c35a}.gbv-fl.heal{color:#7ed29a}.gbv-fl.psn{color:#9bd06a}.gbv-fl.burn{color:#f0915a}.gbv-fl.tag{font:12px/1 var(--kai,serif);color:var(--float,#f0e6d0)}.gbv-fl.blk{color:var(--blk,#8fb0d0);font-size:12px}
@keyframes gbvfl{0%{opacity:0;transform:translate(-50%,-30%) scale(.8)}15%{opacity:1;transform:translate(-50%,-70%) scale(1.08)}70%{opacity:1}100%{opacity:0;transform:translate(-50%,-160%)}}
.gbv-ban{position:absolute;left:0;right:0;top:30%;text-align:center;pointer-events:none;z-index:40;font:700 34px/1.1 var(--kai,serif);letter-spacing:.12em;color:var(--strong,#eee5d1);text-shadow:0 2px 0 var(--fshadow,#000)}
.gbv-ban span{display:inline-block;opacity:0;animation:gbvban .5s ease forwards}
.gbv-ban small{display:block;font:12px var(--sans,system-ui);letter-spacing:0;color:var(--mu,#8f8775);margin-top:6px;opacity:0;animation:gbvban .4s .3s forwards}
@keyframes gbvban{0%{opacity:0;transform:translateY(8px) scale(1.25);filter:blur(3px)}100%{opacity:1;transform:none;filter:none}}
.gbv-fx{position:absolute;left:0;top:0;pointer-events:none;overflow:visible;z-index:25}
.gbv-pj{position:absolute;pointer-events:none;z-index:26;transform:translate(-50%,-50%)}
.gbv-log{height:18px;margin-top:4px;font:12px/18px var(--sans,system-ui);color:var(--mu,#8f8775);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gbv-tip{position:absolute;z-index:50;max-width:220px;padding:7px 9px;background:var(--pp);color:var(--ik);border-left:3px solid var(--b);border-radius:2px;box-shadow:0 6px 16px rgba(0,0,0,.35);font:12px/1.5 var(--sans,system-ui);pointer-events:none}
.gbv-tip b{font:14px var(--kai,serif)}
.gbv-res{position:absolute;inset:0;z-index:60;background:var(--bg,#15130f);overflow:auto;padding:4px 2px 12px;animation:gbvin .35s ease}
@keyframes gbvin{from{opacity:0;transform:translateY(10px)}}
.gbv-res h3{margin:4px 0 2px;font:700 30px/1.2 var(--kai,serif);letter-spacing:.2em;text-align:center}
.gbv-res h3.win{color:var(--zhu2,#d8553f)}.gbv-res h3.lose{color:var(--mu,#8f8775)}
.gbv-res .gbv-sub{text-align:center;color:var(--mu,#8f8775);font-size:12px;margin-bottom:10px}
.gbv-mvp{display:flex;align-items:center;gap:10px;margin:0 auto 10px;max-width:360px;padding:8px 10px;background:var(--pp);color:var(--ik);border-radius:3px;border-left:4px solid #d9a441}
.gbv-mvp svg{width:52px;height:52px;flex:0 0 auto}
.gbv-mvp b{font:16px var(--kai,serif)}.gbv-mvp em{font-style:normal;font:11px var(--sans,system-ui);background:#d9a441;color:#1c1915;padding:1px 5px;border-radius:2px;margin-right:6px}
.gbv-tb{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}
.gbv-tb th{font-weight:400;color:var(--mu,#8f8775);text-align:right;padding:2px 4px;border-bottom:1px solid var(--line,rgba(233,224,204,.14))}
.gbv-tb th:first-child,.gbv-tb td:first-child{text-align:left}
.gbv-tb td{padding:3px 4px;text-align:right;font-variant-numeric:tabular-nums;border-bottom:1px solid var(--faint2,rgba(233,224,204,.12))}
.gbv-tb td:first-child{display:flex;align-items:center;gap:6px}
.gbv-tb td svg{width:22px;height:22px;background:var(--pp);border-radius:3px;flex:0 0 auto}
.gbv-tb tr.dead td{color:var(--mu,#8f8775)}.gbv-tb tr.dead svg{filter:grayscale(1);opacity:.6}
.gbv-tb .gbv-side{font:13px var(--kai,serif);color:var(--tx,#ddd3bf);padding-top:8px;text-align:left}
.gbv-fare{margin:6px 0 10px;padding:10px 12px;border:1px solid var(--line2,rgba(233,224,204,.32));border-left:4px solid var(--ik);background:var(--bg2,#1e1b16);border-radius:3px}
.gbv-save{margin:0 auto 10px;max-width:420px;padding:8px 10px;border-left:4px solid #7ed29a;background:var(--bg2,#1e1b16);border-radius:3px;font-size:12px;line-height:1.9}
.gbv-save b{font:15px var(--kai,serif);color:var(--strong,#eee5d1)}
.gbv-save span{display:inline-flex;align-items:center;gap:3px;margin-right:8px}
.gbv-save svg{width:22px;height:22px;background:var(--pp);border-radius:3px}
.gbv-fare .gbv-lead{margin:0 0 6px;font-size:12px;color:var(--mu,#8f8775)}
.gbv-fare small{font-size:11px;color:var(--mu,#8f8775)}
.gbv-fare h4{margin:0 0 6px;font:16px var(--kai,serif);letter-spacing:.1em;color:var(--strong,#eee5d1)}
.gbv-fare .gbv-g{display:flex;align-items:center;gap:10px;margin:6px 0;animation:gbvfare 1.6s ease both}
.gbv-fare .gbv-g svg{width:46px;height:46px;background:var(--pp);border-radius:3px;filter:grayscale(1) contrast(.9);flex:0 0 auto}
.gbv-fare .gbv-g b{font:15px var(--kai,serif)}.gbv-fare .gbv-g p{margin:2px 0 0;font-size:12px;color:var(--mu,#8f8775)}
@keyframes gbvfare{from{opacity:0;filter:blur(2px)}}
.gbv-res .gbv-note{font-size:11px;color:var(--mu,#8f8775);text-align:center;margin:4px 0}
.gbv-res .gbv-go{display:block;margin:10px auto 0;min-width:140px;height:38px;border-radius:3px;background:var(--zhu,#b5301f);color:var(--on-zhu,#f3ead6);font:16px var(--kai,serif);letter-spacing:.3em;cursor:pointer;border:0}
.gbv.narrow .gbv-tok{border-radius:50%}
.gbv.narrow .gbv-tok svg{filter:brightness(0);opacity:.85}
.gbv.calm .gbv-ban span{animation-duration:.2s}
`;
const ST_CH = { psn: '毒', para: '寄', burn: '灼', chill: '寒', stun: '眩', web: '网', guard: '护', grd: '护', taunt: '嘲', mark: '印', seal: '封' };
const ST_N = { psn: '中毒', para: '寄生', burn: '灼烧', chill: '寒', freeze: '冻住', stun: '眩晕', web: '落网', guard: '护', taunt: '嘲讽', mark: '印记', seal: '封', miss: '扑空', swap: '换位', strip: '破甲', tie: '系丝', blitz: '疾袭', luck: '鸿运', hex: '夺志', clean: '净' };
const CN = ['', '一', '二', '三', '四', '五', '仙'];
// trip = 秘境（会死），spar = 斗幽灵、战帖（不死蛊）。没写 mode 时按旧参数猜
const modeOf = o => o.mode === 'trip' || o.mode === 'spar' ? o.mode : (o.perm || o.kind === 'trip' ? 'trip' : 'spar');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function playBattle(el, res, opts = {}) {
  return new Promise(resolve => run(el, res, opts, resolve));
}

async function run(el, res, opts, resolve) {
  if (typeof document === 'undefined') return resolve({ closed: true, skipped: true });
  if (!document.getElementById('gbv-css')) { const st = document.createElement('style'); st.id = 'gbv-css'; st.textContent = CSS; document.head.appendChild(st); }
  if (!document.getElementById('gu-defs')) document.body.insertAdjacentHTML('afterbegin', `<svg id="gu-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${ART_DEFS}</defs></svg>`);
  const R = res.roster, log = res.log, me = opts.mySide === 1 ? 1 : 0, calm = !!opts.reduceMotion;
  const names = opts.names || ['我方', '对方'];
  el.innerHTML = `<div class="gbv${calm ? ' calm' : ''}"><div class="gbv-top"><div class="gbv-tt">${esc(opts.title || '斗蛊')}<small class="gbv-rdl">开战</small></div>
    <div class="gbv-ctl"><button data-s="1" class="on">1×</button><button data-s="2">2×</button><button data-s="skip">跳过</button></div></div>
    <div class="gbv-ord"><span class="gbv-lab">出手顺序</span></div><div class="gbv-syn"><span class="gbv-syna"></span><span class="gbv-synb"></span></div>
    <div class="gbv-st"><div class="gbv-cam"><svg class="gbv-floor"></svg><svg class="gbv-fx"></svg></div></div><div class="gbv-log"></div></div>`;
  const root = el.firstElementChild, outer = root.querySelector('.gbv-st'), stage = root.querySelector('.gbv-cam'), floor = root.querySelector('.gbv-floor'), fxs = root.querySelector('.gbv-fx'), ord = root.querySelector('.gbv-ord'), logEl = root.querySelector('.gbv-log');
  let speed = opts.speed === 2 ? 2 : 1, skip = false, wake = null;
  root.querySelectorAll('.gbv-ctl button').forEach(b => b.onclick = () => {
    if (b.dataset.s === 'skip') { skip = true; if (wake) wake(); return; }
    speed = +b.dataset.s; root.querySelectorAll('.gbv-ctl button').forEach(x => x.classList.toggle('on', x === b));
  });
  const sleep = ms => skip ? Promise.resolve() : new Promise(r => { const t = setTimeout(() => { wake = null; r(); }, ms / speed); wake = () => { clearTimeout(t); wake = null; r(); }; });

  // ----- 几何：斜俯视 6×3。X = 0..5（A 方后中前 | B 方前中后），r = 0 远 … 2 近 -----
  let G = {};
  const layout = () => {
    const W = Math.max(300, Math.min(760, root.clientWidth || el.clientWidth || 360));
    const cw = Math.min(96, Math.floor((W - 6) / 6.2)), rh = Math.round(cw * 0.66), top = Math.round(cw * 1.02), gap = Math.round(cw * 0.2);
    const sc = r => 0.86 + 0.07 * r, H = top + rh * 3 + Math.round(cw * 0.32);
    G = { W, cw, rh, top, gap, sc, H, narrow: cw < 62 };
    root.classList.toggle('narrow', G.narrow);
    outer.style.height = H + 'px'; floor.setAttribute('width', W); floor.setAttribute('height', H); fxs.setAttribute('width', W); fxs.setAttribute('height', H);
    drawFloor();
    Object.values(U).forEach(place);
  };
  const Xof = (side, c) => side === 0 ? 2 - c : 3 + c;
  const px = (X, r) => G.W / 2 + (X - 2.5) * G.cw * G.sc(r) + (X < 3 ? -G.gap / 2 : G.gap / 2);   // 格子中心 x（随行缩放）
  const py = r => G.top + (r + 0.5) * G.rh;                                                          // 格子中心 y
  const cellXY = (side, r, c) => ({ x: px(Xof(side, c), r), y: py(r) });
  const tilePts = (X, r) => {
    const y0 = G.top + r * G.rh, y1 = y0 + G.rh, s0 = 0.86 + 0.07 * (r - 0.5), s1 = s0 + 0.07, g = X < 3 ? -G.gap / 2 : G.gap / 2;
    const xa = (x, s) => G.W / 2 + (x - 3) * G.cw * s + g, pad = 2;
    return `${xa(X, s0) + pad},${y0 + pad} ${xa(X + 1, s0) - pad},${y0 + pad} ${xa(X + 1, s1) - pad},${y1 - pad} ${xa(X, s1) + pad},${y1 - pad}`;
  };
  function drawFloor() {
    let s = '';
    for (let r = 0; r < 3; r++) for (let X = 0; X < 6; X++) s += `<polygon class="t ${X < 3 ? 'ta' : 'tb'}" data-k="${X}_${r}" points="${tilePts(X, r)}"/>`;
    s += `<line class="gbv-midl" x1="${G.W / 2}" y1="${G.top - 4}" x2="${G.W / 2}" y2="${G.top + 3 * G.rh + 4}"/>`;
    floor.innerHTML = s;
  }

  // ----- 单位 -----
  const U = {};
  function mkUnit(uid) {
    const ro = R[uid]; if (!ro) return null;
    const d = document.createElement('div'); d.className = 'gbv-u ' + (ro.side ? 'gbv-sb' : 'gbv-sa'); d.dataset.uid = uid;
    d.innerHTML = `<div class="gbv-ic"></div><div class="gbv-tok">${guSVG(ro.sp, { rank: ro.rank || 1, still: true })}</div><div class="gbv-bar"><i class="gbv-hpi"></i><i class="gbv-shi"></i></div>${ro.act ? '<div class="gbv-gp"><i></i></div>' : ''}`;
    stage.appendChild(d);
    const u = { uid, ro, el: d, tok: d.querySelector('.gbv-tok'), hpI: d.querySelector('.gbv-hpi'), shI: d.querySelector('.gbv-shi'), bar: d.querySelector('.gbv-bar'), gpI: d.querySelector('.gbv-gp i'), gpB: d.querySelector('.gbv-gp'), ic: d.querySelector('.gbv-ic'), st: {}, r: 1, c: 0, hp: 1, mx: 1, sh: 0, gp: 0, atk: 0, alive: true };
    d.onmouseenter = () => showTip(u); d.onmouseleave = hideTip; d.onclick = e => { e.stopPropagation(); showTip(u, true); };
    U[uid] = u; return u;
  }
  function place(u) {
    const s = G.sc(u.r), sz = Math.round(G.cw * 0.86 * s), p = cellXY(u.ro.side, u.r, u.c);
    u.el.style.left = p.x + 'px'; u.el.style.top = (p.y + G.rh * 0.36) + 'px'; u.el.style.zIndex = 10 + u.r;
    u.tok.style.width = sz + 'px'; u.tok.style.height = Math.round(sz * (G.narrow ? 1 : 0.92)) + 'px';
    u.bar.style.width = Math.round(sz * 0.92) + 'px'; if (u.gpB) u.gpB.style.width = Math.round(sz * 0.92) + 'px';
  }
  const center = u => { const p = cellXY(u.ro.side, u.r, u.c), s = G.sc(u.r); return { x: p.x, y: p.y + G.rh * 0.36 - G.cw * 0.45 * s }; };
  function setBars(u) {
    const tot = Math.max(u.mx, u.hp + u.sh), hw = 100 * Math.max(0, u.hp) / tot, sw = 100 * u.sh / tot;
    u.hpI.style.width = hw + '%'; u.shI.style.left = hw + '%'; u.shI.style.width = sw + '%'; u.bar.classList.toggle('lo', u.hp < u.mx * 0.35);
    if (u.gpI) { const g = Math.min(1, u.gp / (u.ro.gpMax || 100)); u.gpI.style.width = 100 * g + '%'; u.gpB.classList.toggle('full', g >= 1); }
  }
  const setIcons = u => { u.ic.innerHTML = Object.entries(u.st).filter(([, v]) => v > 0).map(([k]) => `<b class="${k}">${ST_CH[k] || ''}</b>`).join(''); };
  // 快照：[[uid, 攻, 血, 护体, 蛊力, 速, 行, 列]] × 两方
  function applySnap(s) {
    if (!s) return; const seen = new Set();
    s.forEach(side => side.forEach(([uid, atk, hp, sh, gp, spd, r, c]) => {
      seen.add(uid); let u = U[uid]; if (!u) { u = mkUnit(uid); if (!u) return; u.r = r; u.c = c; place(u); }
      const moved = u.r !== r || u.c !== c; u.atk = atk; u.hp = hp; u.sh = sh; u.gp = gp; u.spd = spd; if (moved) { u.r = r; u.c = c; place(u); }
      setBars(u);
    }));
    Object.values(U).forEach(u => { if (u.alive && !seen.has(u.uid)) { u.alive = false; u.el.classList.add('die'); } });
  }
  const mxOf = uid => (res.units[uid] && res.units[uid].mxB) || 1;

  // ----- 出手顺序条 -----
  let chips = {};
  function drawOrder(cur, q) {
    const list = (cur ? [cur] : []).concat(q || []).slice(0, G.narrow ? 7 : 10), cnt = {}, keep = {}, x0 = 4, step = G.narrow ? 30 : 34;
    let x = x0;
    list.forEach((id, i) => {
      const k = id[0] === '#' ? id : id + '@' + (cnt[id] = (cnt[id] || 0) + 1);
      let c = chips[k];
      if (!c) {
        c = document.createElement('div');
        if (id[0] === '#') { c.className = 'gbv-rd'; c.textContent = '第' + id.slice(1) + '轮'; }
        else { const ro = R[id] || {}; c.className = 'gbv-chip' + (ro.side ? ' gbv-sb' : ''); c.innerHTML = guSVG(ro.sp || 'pupa', { still: true }); c.title = ro.name || ''; }
        c.style.transform = `translateX(${x + 40}px)`; c.style.opacity = '0'; ord.appendChild(c);
        c.getBoundingClientRect();
      }
      c.classList.toggle('now', i === 0 && !!cur); c.style.opacity = '1'; c.style.transform = `translateX(${x}px)`;
      keep[k] = c; x += id[0] === '#' ? 40 : (i === 0 && cur ? step + 8 : step);
    });
    Object.entries(chips).forEach(([k, c]) => { if (!keep[k]) { c.style.opacity = '0'; c.style.transform += ' translateX(-30px)'; setTimeout(() => c.remove(), 320); } });
    chips = keep;
  }

  // ----- 小工具：浮字、提示、弹道 -----
  const float = (u, text, cls = '', dy = 0) => {
    if (!u || skip) return; const p = center(u), f = document.createElement('div'); f.className = 'gbv-fl ' + cls; f.textContent = text;
    f.style.left = p.x + 'px'; f.style.top = (p.y - 6 + dy) + 'px'; stage.appendChild(f); setTimeout(() => f.remove(), 950);
  };
  let tipEl = null;
  function showTip(u, pin) {
    hideTip(); const ro = u.ro, t = document.createElement('div'); t.className = 'gbv-tip';
    const nat = Object.keys(ro.tr || {}).map(k => TRAITS[k] && TRAITS[k].n).filter(Boolean)[0];
    t.innerHTML = `<b>${esc(ro.name)}</b>${ro.rank ? ` · ${CN[ro.rank]}转` : ''}<br>攻 ${u.atk} · 血 ${Math.max(0, u.hp)}/${u.mx}${u.sh ? ` · 护 ${u.sh}` : ''} · 速 ${u.spd || ro.spd}<br>${ro.reach === 'ranged' ? '远程' : '近战'}${nat ? ' · 本命「' + esc(nat) + '」' : ''}${ro.act ? `<br>主动「${esc(ro.act.n)}」：${esc(ro.act.d || '')}` : ''}${ro.combo ? `<br>杀招「${esc(ro.combo.n)}」` : ''}`;
    const p = center(u); t.style.left = Math.max(2, Math.min(G.W - 222, p.x - 110)) + 'px'; t.style.top = Math.max(0, p.y - G.cw * 1.4 - 40) + 'px';
    stage.appendChild(t); tipEl = t; if (pin) setTimeout(() => { if (tipEl === t) hideTip(); }, 2600);
  }
  function hideTip() { if (tipEl) { tipEl.remove(); tipEl = null; } }
  stage.addEventListener('click', hideTip);
  const shake = () => { if (calm || skip) return; outer.classList.remove('shake'); outer.getBoundingClientRect(); outer.classList.add('shake'); };
  const flash = u => { if (!u) return; u.el.classList.add('flash'); setTimeout(() => u.el.classList.remove('flash'), 110); };
  const aimOn = (cells, gold, friendly) => { cells && cells.forEach(([s, r, c]) => { const t = floor.querySelector(`[data-k="${Xof(s, c)}_${r}"]`); if (t) { t.classList.add(friendly ? 'aimA' : 'aim'); if (gold) t.classList.add('gold'); } }); };
  const aimOff = () => floor.querySelectorAll('.aim,.aimA').forEach(t => t.classList.remove('aim', 'aimA', 'gold'));
  const anim = (node, kf, ms, o = {}) => skip ? Promise.resolve() : new Promise(r => { const a = node.animate(kf, { duration: ms / speed, easing: o.ease || 'ease-out', fill: 'forwards' }); a.onfinish = r; a.oncancel = r; });
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); fxs.appendChild(n); return n; };
  const pj = (html, x, y) => { const d = document.createElement('div'); d.className = 'gbv-pj'; d.innerHTML = html; d.style.left = x + 'px'; d.style.top = y + 'px'; stage.appendChild(d); return d; };
  const arcKf = (a, b, h, n = 6) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return { transform: `translate(${(b.x - a.x) * t}px,${(b.y - a.y) * t - h * 4 * t * (1 - t)}px) translate(-50%,-50%)` }; });
  // 普攻弹道：返回在「打中」那一刻 resolve 的 Promise
  async function shot(fx, a, t) {
    const A = center(a), B = center(t), ang = Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI, dir = a.ro.side ? -1 : 1;
    switch (fx) {
      case 'spit': { const d = pj(`<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#e2672e"/><circle cx="6" cy="6" r="2.5" fill="#f6c24a"/></svg>`, A.x, A.y); await anim(d, arcKf(A, B, G.cw * 0.6), 300, { ease: 'linear' }); d.remove(); break; }
      case 'needle': { const d = pj(`<div style="width:${G.cw * 0.5}px;height:2px;background:var(--ik);box-shadow:0 0 0 1px var(--pp);transform:rotate(${ang}deg)"></div>`, A.x, A.y); await anim(d, [{ transform: 'translate(-50%,-50%)' }, { transform: `translate(${B.x - A.x}px,${B.y - A.y}px) translate(-50%,-50%)` }], 170, { ease: 'linear' }); d.remove(); break; }
      case 'bolt': { const pts = [A]; for (let i = 1; i < 5; i++) pts.push({ x: A.x + (B.x - A.x) * i / 5 + (i % 2 ? 7 : -7), y: A.y + (B.y - A.y) * i / 5 + (i % 2 ? -6 : 6) }); pts.push(B); const l = svgEl('polyline', { points: pts.map(p => p.x + ',' + p.y).join(' '), fill: 'none', stroke: '#9fd2ff', 'stroke-width': 3, 'stroke-linejoin': 'round' }); await sleep(90); l.setAttribute('stroke', '#ffffff'); await sleep(70); l.remove(); break; }
      case 'spore': { const ds = [0, 1, 2].map(i => pj(`<div style="width:${10 + i * 3}px;height:${10 + i * 3}px;border-radius:50%;background:#7c9a4a;opacity:.7;filter:blur(1px)"></div>`, A.x, A.y)); await Promise.all(ds.map((d, i) => anim(d, arcKf(A, { x: B.x + (i - 1) * 6, y: B.y + (i - 1) * 4 }, G.cw * 0.3 * (i + 1) / 2), 380 + i * 40))); ds.forEach(d => d.remove()); break; }
      case 'wave': { const c = svgEl('path', { d: `M${A.x} ${A.y - 10} q${dir * 10} 10 0 20`, fill: 'none', stroke: 'var(--qing,#6fb7a4)', 'stroke-width': 3 }); await anim(c, [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${B.x - A.x}px,${B.y - A.y}px)`, opacity: 0.4 }], 260, { ease: 'linear' }); c.remove(); break; }
      default: {   // pounce / bite / slash：本体扑过去再退回
        const dx = (B.x - A.x) * 0.62, dy = (B.y - A.y) * 0.62;
        await anim(a.el, [{ transform: 'translate(-50%,-100%)' }, { transform: `translate(calc(-50% + ${dx}px),calc(-100% + ${dy - 8}px))` }], 150, { ease: 'cubic-bezier(.5,0,.9,.4)' });
        if (fx === 'slash' || fx === 'bite') { const p = fx === 'slash' ? `M${B.x - 14} ${B.y - 12} Q${B.x + 4} ${B.y - 2} ${B.x + 12} ${B.y + 14}` : `M${B.x - 6} ${B.y - 10} l3 9 M${B.x + 5} ${B.y - 10} l-3 9`; const s = svgEl('path', { d: p, fill: 'none', stroke: 'var(--ik)', 'stroke-width': fx === 'slash' ? 4 : 3, 'stroke-linecap': 'round' }); setTimeout(() => s.remove(), 220 / speed); }
        anim(a.el, [{ transform: `translate(calc(-50% + ${dx}px),calc(-100% + ${dy - 8}px))` }, { transform: 'translate(-50%,-100%)' }], 200).then(() => { a.el.getAnimations().forEach(x => x.cancel()); });
      }
    }
  }
  // 主动技动作（释放者那一侧的通用动作；具体伤害数字随后由 dmg 事件逐个跳出）
  async function castFx(fx, a, tgs) {
    const A = center(a), T = tgs.map(center);
    const colors = { fire: '#e2672e', frost: '#8fc7ee', bolt: '#cfe6ff', spore: '#7c9a4a', heal: '#7ed29a', shield: '#e8d9a8', drain: '#b0303a', roar: '#e8d9a8', web: '#e8e2d0', needle: '#1c1915', slash: '#1c1915', pounce: '#1c1915', bite: '#1c1915', summon: '#1c1915' };
    const col = colors[fx] || '#d9a441';
    if (fx === 'pounce' || fx === 'slash' || fx === 'bite') { if (tgs[0]) await shot(fx, a, tgs[0]); return; }
    if (fx === 'shield' || fx === 'heal' || fx === 'summon') {
      const L = (tgs.length ? tgs : [a]).map(center);
      L.forEach(p => { const c = svgEl('circle', { cx: p.x, cy: p.y + 6, r: G.cw * 0.2, fill: 'none', stroke: col, 'stroke-width': 3 }); anim(c, [{ r: G.cw * 0.2, opacity: 1 }, { r: G.cw * 0.55, opacity: 0 }], 420).then(() => c.remove()); });
      await sleep(260); return;
    }
    if (fx === 'roar') { for (let i = 0; i < 3; i++) { const c = svgEl('circle', { cx: A.x, cy: A.y, r: 6, fill: 'none', stroke: col, 'stroke-width': 2 }); anim(c, [{ r: 6, opacity: 0.9 }, { r: G.cw * 2.6, opacity: 0 }], 520).then(() => c.remove()); await sleep(90); } return; }
    await Promise.all(T.map((p, i) => new Promise(async r => {
      await sleep(i * 50);
      if (fx === 'bolt') { const l = svgEl('polyline', { points: `${p.x},${p.y - G.cw} ${p.x - 6},${p.y - G.cw * 0.5} ${p.x + 5},${p.y - G.cw * 0.4} ${p.x},${p.y}`, fill: 'none', stroke: col, 'stroke-width': 3 }); await sleep(150); l.remove(); }
      else if (fx === 'drain') { const l = svgEl('line', { x1: p.x, y1: p.y, x2: A.x, y2: A.y, stroke: col, 'stroke-width': 3, 'stroke-dasharray': '4 5' }); await anim(l, [{ strokeDashoffset: 0 }, { strokeDashoffset: -40 }], 300, { ease: 'linear' }); l.remove(); }
      else if (fx === 'web') { const g = svgEl('path', { d: `M${p.x - 14} ${p.y - 14} L${p.x + 14} ${p.y + 14} M${p.x + 14} ${p.y - 14} L${p.x - 14} ${p.y + 14} M${p.x - 18} ${p.y} L${p.x + 18} ${p.y}`, stroke: col, 'stroke-width': 1.5, fill: 'none' }); await anim(g, [{ opacity: 0 }, { opacity: 1 }], 200); setTimeout(() => g.remove(), 260 / speed); }
      else { const d = pj(`<div style="width:14px;height:14px;border-radius:50%;background:${col};box-shadow:0 0 0 2px rgba(0,0,0,.25)"></div>`, A.x, A.y); await anim(d, arcKf(A, p, fx === 'needle' ? 4 : G.cw * 0.5), fx === 'needle' ? 180 : 320, { ease: 'linear' }); d.remove(); }
      r();
    })));
  }
  const banner = async (txt, sub, ms = 650) => {
    if (skip) return; const b = document.createElement('div'); b.className = 'gbv-ban';
    b.innerHTML = [...txt].map((ch, i) => `<span style="animation-delay:${i * 70 / speed}ms">${esc(ch)}</span>`).join('') + (sub ? `<small>${esc(sub)}</small>` : '');
    stage.appendChild(b); await sleep(ms); b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 / speed, fill: 'forwards' }); setTimeout(() => b.remove(), 220 / speed);
  };
  const say = t => { logEl.textContent = t; };
  const nm = uid => (R[uid] || {}).name || '?';
  const trigName = e => e.xg ? (XING[e.xg] || {}).n : e.food ? (FOOD[e.food] || {}).n : e.dao ? (DAO[e.dao] || {}).n : e.id ? (TRAITS[e.id] || {}).n : e.mk || '';

  // ----- 重放 -----
  layout();
  const onR = () => layout(); window.addEventListener('resize', onR);
  const big = new Set(); let round = 0, castMode = 0;
  for (let i = 0; i < log.length; i++) {
    if (skip) break;
    const e = log[i], u = U[e.uid];
    switch (e.t) {
      case 'begin': applySnap(e.s); Object.values(U).forEach((x, k) => { x.el.style.opacity = '0'; setTimeout(() => { x.el.style.opacity = '1'; }, (x.ro.side ? 120 : 0) + k * 30); }); say('开战'); await sleep(700); continue;
      case 'syn': { const t = [...e.daos.map(d => `${d.n}·${d.cnt}`), ...e.combos.map(c => '「' + c.n + '」')].join(' '); root.querySelector(e.side ? '.gbv-synb' : '.gbv-syna').textContent = t ? (e.side === me ? '' : '') + t : ''; break; }
      case 'order': drawOrder(null, e.q); await sleep(350); break;
      case 'round': round = e.n; root.querySelector('.gbv-rdl').textContent = `第 ${e.n} 轮`; await sleep(180); break;
      case 'act': Object.values(U).forEach(x => x.el.classList.toggle('now', x.uid === e.uid)); drawOrder(e.uid, e.q); await sleep(140); break;
      case 'skip': if (u) float(u, e.k === 'stun' ? '眩晕' : '蓄势', 'tag'); say(`${nm(e.uid)} ${e.k === 'stun' ? '被眩住，跳过' : '被挡在身后，蓄势（蛊力 +）'}`); await sleep(260); break;
      case 'atk': {
        const t = U[e.tg]; aimOn(e.cells, false, R[e.uid] && R[e.tg] && R[e.uid].side === R[e.tg].side); say(`${nm(e.uid)} → ${nm(e.tg)}`);
        await sleep(240); if (u && t) await shot(e.fx, u, t); aimOff(); castMode = 0; break;
      }
      case 'cast': {
        const tg = (e.tg || []).map(x => U[x]).filter(Boolean); aimOn(e.cells, true, tg[0] && u && tg[0].ro.side === u.ro.side);
        say(`${nm(e.uid)} 放出「${e.n}」`); await banner(e.n, nm(e.uid), 640); if (u) await castFx(e.fx, u, tg); aimOff(); castMode = 1; break;
      }
      case 'combo': {
        if (e.big && !big.has(e.uid)) {
          big.add(e.uid); say(`杀招 · ${e.n}`);
          const tg = (e.tg || []).map(x => U[x]).filter(Boolean);
          const sd = u ? u.ro.side : 0, live = Object.values(U).filter(x => x.alive), fo = live.filter(x => x.ro.side !== sd).map(center);
          if (!skip) await playCombo(stage, { id: e.id, name: e.n, side: sd, hud: outer, from: u ? center(u) : { x: G.W / 2, y: G.H / 2 }, targets: tg.length ? tg.map(center) : fo, allies: live.filter(x => x.ro.side === sd).map(center), foes: fo, w: G.W, h: G.H, ground: G.top + 3 * G.rh, reduce: calm, speed, isSkip: () => skip });
        } else if (u) float(u, '「' + (e.n || '')[0] + '」', 'tag', -10);
        castMode = 1; break;
      }
      case 'dmg': {
        if (!u) break; const kill = e.s && !e.s.some(sd => sd.some(x => x[0] === e.uid && x[2] > 0));
        if (e.k === 'psn' || e.k === 'para' || e.k === 'burn' || e.k === 'doom') { float(u, '-' + e.n, e.k === 'burn' ? 'burn' : 'psn'); applySnap(e.s); await sleep(120); break; }
        flash(u); float(u, (e.crit ? '暴 ' : '') + '-' + e.n, e.crit ? 'crit' : '', castMode ? (i % 3) * -6 : 0); if (e.blk) float(u, '挡' + e.blk, 'blk', 14);
        applySnap(e.s);
        if (e.crit || kill) { shake(); await sleep(kill ? 160 : 90); }   // 顿帧：暴击、斩杀停一下
        await sleep(castMode ? 110 : 200); break;
      }
      case 'heal': if (u) float(u, '+' + e.n, 'heal'); applySnap(e.s); await sleep(120); break;
      case 'buff': {
        if (!u) break; const p = []; if (e.a) p.push((e.a > 0 ? '+' : '') + e.a + '攻'); if (e.h) p.push((e.h > 0 ? '+' : '') + e.h + '血'); if (e.sh) p.push('+' + e.sh + '护'); if (e.spd) p.push((e.spd > 0 ? '速+' : '速') + e.spd); if (e.adv) p.push('提前'); if (e.delay) p.push('推后');
        if (p.length) float(u, p.join(' '), e.a < 0 || e.delay ? 'psn' : 'heal', -12); applySnap(e.s); await sleep(e.dao ? 40 : 110); break;
      }
      case 'status': {
        if (!u) break; const k = e.k === 'freeze' ? 'stun' : e.k === 'clean' ? null : e.k;
        if (k && ST_CH[k]) { u.st[k] = 1; } if (e.k === 'clean') u.st = {}; setIcons(u); if (ST_N[e.k]) float(u, ST_N[e.k], 'tag', -18); await sleep(140); break;
      }
      case 'trig': { const n = trigName(e); if (u && n) float(u, n, 'tag', -22); applySnap(e.s); await sleep(e.id || e.xg ? 200 : 60); break; }
      case 'summon': applySnap(e.s); if (U[e.uid]) { U[e.uid].el.classList.add('summon'); say(`${nm(e.uid)} 现身`); } await sleep(220); break;
      case 'move': if (u) { if (e.k === 'bump' || e.k === 'wall') { float(u, '撞', 'tag'); flash(u); if (U[e.into]) flash(U[e.into]); shake(); } } applySnap(e.s); await sleep(220); break;
      case 'faint': if (u) { u.alive = false; u.el.classList.add('die'); say(`${nm(e.uid)} 倒下${e.eaten ? '（被吞）' : ''}`); } applySnap(e.s); await sleep(380); break;
      case 'end': break;
      default: applySnap(e.s);
    }
    // 状态图标随快照外的标记淡出：眩、网、嘲等由下一次出手消耗，这里只按事件粗略维护
    if (e.t === 'act' && u) { ['stun', 'web'].forEach(k => { if (u.st[k]) { u.st[k] = 0; } }); setIcons(u); }
  }
  window.removeEventListener('resize', onR);
  aimOff(); hideTip();
  const trip = modeOf(opts) === 'trip', won = res.winner !== 'draw' && (res.winner === 'A' ? 0 : 1) === me;
  if (trip && won) {   // 秘境里打赢：倒下的蛊全部救回，剩 1 血，从倒地处起身
    const up = Object.values(U).filter(x => !x.alive && x.ro.side === me && !x.ro.summon);
    if (up.length && !skip) {
      say(`打赢了，倒下的 ${up.length} 只救回来了（剩 1 血）`);
      up.forEach((x, k) => setTimeout(() => { x.alive = true; x.hp = 1; x.sh = 0; x.el.classList.remove('die'); x.el.classList.add('rise'); setBars(x); float(x, '救回', 'heal', -16); }, k * 160));
      await new Promise(r => setTimeout(r, 900 + up.length * 160));
    }
  }
  // 结算页
  showResult(root, res, opts, me, names, skip, resolve, () => window.removeEventListener('resize', onR));
}

function showResult(root, res, opts, me, names, skipped, resolve) {
  const R = res.roster, US = res.units, w = res.winner, mine = w === 'draw' ? 'draw' : (w === 'A' ? 0 : 1) === me ? 'win' : 'lose', trip = modeOf(opts) === 'trip';
  const head = mine === 'win' ? '胜' : mine === 'lose' ? '败' : '平';
  const art = (uid, sz) => guSVG(R[uid].sp, { rank: R[uid].rank || 1, size: sz, still: true });
  const rows = side => Object.entries(US).filter(([, x]) => x.side === side && !x.summon).map(([uid, x]) =>
    `<tr class="${x.dead ? 'dead' : ''}"><td>${art(uid)}<span>${esc(x.name)}${R[uid].rank ? `<small style="color:var(--mu)"> ${CN[R[uid].rank]}转</small>` : ''}</span></td><td>${x.dmg}</td><td>${x.taken}</td><td>${x.kills}</td><td>${side === me && trip ? (mine === 'win' ? (x.dead ? '<b style="color:#7ed29a">救回 1</b>' : x.hpEnd + '/' + x.mx) : '<b style="color:var(--zhu2,#d8553f)">永逝</b>') : x.dead ? '倒下' : x.hpEnd + '/' + x.mx}</td></tr>`).join('');
  const sm = Object.values(US).filter(x => x.summon), smTxt = side => { const L = sm.filter(x => x.side === side); return L.length ? `<tr><td colspan="5" style="color:var(--mu);font-size:11px">召唤物 ${L.length} 只，合计伤害 ${L.reduce((a, x) => a + x.dmg, 0)}</td></tr>` : ''; };
  const mv = res.mvp && US[res.mvp];
  const mineU = Object.entries(US).filter(([, x]) => x.side === me && !x.summon), saved = trip && mine === 'win' ? mineU.filter(([, x]) => x.dead) : [], fallen = trip && mine !== 'win' ? mineU : [];
  const deadRound = uid => { let rd = 0; for (const e of res.log) { if (e.t === 'round') rd = e.n; if (e.t === 'faint' && e.uid === uid) return rd || 1; } return rd; };
  const sota = opts.sota || res.sota || [];
  const box = document.createElement('div'); box.className = 'gbv-res';
  box.innerHTML = `<h3 class="${mine}">${head}</h3><div class="gbv-sub">${esc(names[me])} 对 ${esc(names[1 - me])} · ${res.rounds} 轮${skipped ? ' · 已跳过' : ''}</div>
    ${mv ? `<div class="gbv-mvp">${art(res.mvp, 52)}<div><em>本场最佳</em><b>${esc(mv.name)}</b><br><span style="font-size:12px">伤害 ${mv.dmg} · 承受 ${mv.taken} · 击杀 ${mv.kills}${mv.healed ? ' · 护佑 ' + mv.healed : ''}</span></div></div>` : ''}
    ${saved.length ? `<div class="gbv-save"><b>救回 ${saved.length} 只</b>（剩 1 血继续走）：${saved.map(([uid, x]) => `<span>${art(uid, 22)}${esc(x.name)}</span>`).join('')}</div>` : ''}
    ${fallen.length ? `<div class="gbv-fare"><h4>全队告别</h4><p class="gbv-lead">这一场输了，场上的蛊全部永久离开，这次出征到此为止。</p>${fallen.map(([uid, x], i) => `<div class="gbv-g" style="animation-delay:${0.4 + i * 0.6}s">${art(uid, 46)}<div><b>${esc(x.name)}</b>${R[uid].rank ? ` <small>${CN[R[uid].rank]}转</small>` : ''}<p>${x.dead ? `倒在第 ${deadRound(uid)} 轮` : '战到最后'}，打出 ${x.dmg} 点伤害${x.kills ? `、击倒 ${x.kills} 只` : ''}。它不会再回来了。</p></div></div>`).join('')}</div>` : ''}
    <table class="gbv-tb"><tr><th>${esc(names[me])}</th><th>伤害</th><th>承受</th><th>击杀</th><th>剩血</th></tr>${rows(me)}${smTxt(me)}
    <tr><td class="gbv-side" colspan="5">${esc(names[1 - me])}</td></tr>${rows(1 - me)}${smTxt(1 - me)}</table>
    ${trip ? '' : '<p class="gbv-note">切磋：不死蛊</p>'}
    ${sota[me] ? '<p class="gbv-note">SOTA +1%</p>' : ''}
    <button class="gbv-go">继续</button>`;
  root.appendChild(box);
  box.querySelector('.gbv-go').onclick = () => { box.remove(); resolve({ closed: true, skipped }); };
}
