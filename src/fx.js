// 蛊码 GuCode · 爽感表现组件（开茧、转市、宝箱、升级、成就、点亮、跳数字、飘字、音色）
// 纯 DOM + CSS + WebAudio，不依赖 ui.js。样式在 style.css 末尾「fx 组件」段，演示页 tools/fx-demo.html。
//
// ── 给集成方 ─────────────────────────────────────────────────────────────
// 通用约定
//   · host：挂载容器。传 document.body 时是全屏浮层；传别的元素时铺满该元素（static 定位会被改成 relative）。
//   · 动画型组件都返回 Promise。播放中点一下（或按 Enter / Space / Esc）= 跳到最终态；
//     最终态再点一下 = 收起并 resolve({ skipped })。
//     传 keep:true 则停在最终态立即 resolve({ el, skipped })，el 由集成方自己移除；传 hold:ms 则最终态停 ms 后自动收起。
//   · 声音：组件不建 AudioContext，只调用 onSound(name, k)。name ∈ Object.keys(SFX)，k 是可选的档位/序号。接法：
//       onSound: (n, k) => { if (!S.mute && ac()) SFX[n](AC, AC.currentTime, AC.destination, k); }
//     也可以 fxConfig({ onSound }) 设一次全局默认，单次调用里传的优先。
//   · 减弱震屏和闪光：fxConfig({ calm: true }) 或单次传 calm:true。系统开了 prefers-reduced-motion 时自动 calm，
//     并把期待段缩到约三分之一、不放飞散粒子。
//   · 稀有度 rarity 0..4 = 凡 良 珍 绝 天；颜色走 CSS 变量 --fx-r0..4（底色上）与 --fx-p0..4（宣纸卡上），深浅主题各一版。
//
// API
//   openCocoon(host, { rarity, artHTML, name, tease?, onSound })   开茧：摇 → 裂 → 裂缝透色逐档升 → 顿帧破茧 → 蛊落下盖印。
//                                                                tease:true 时最后一道裂缝闪一下高一档的颜色再落回（近失）。
//   spinReels(host, { items:[h,h,h], nearMiss, triple, pool?, onSound })
//                                                                转市三格，约 400/750/1100ms 依次停；近失第三格拖到约 1.8s 并浮出「差一只！」；
//                                                                三连出全屏大字。转轮留在 host 里，resolve({ el, skipped })。pool 是转动时路过的填充图。
//   openChest(host, { tier, rewards:[{ icon, label, amount }], onSound })   宝箱，tier 0..4 = 木 铜 银 金 玄；金、玄带全屏墨染。
//   levelUp(host, { level, title?, rewards:[{ icon, label, amount }], onSound })   蛊师升级全屏庆祝。
//   toastAchievement({ tier, name, desc, hidden, onSound? })      成就卡右上角滑入，tier 0..2 = 铜 银 金；最多同屏 3 张，其余排队；
//                                                                自动消失，点一下提前收起；Promise 在它消失时 resolve。
//   unlockReveal(host, { name, line, onSound })                   功能点亮：卷轴展开、字落墨、盖「启」印，默认 2.6s 后自动收起。
//   rollNumber(el, from, to, ms = 600, fmt?)                      数字滚动（减速缓动），fmt(v) 自定义格式（如 fmtNum）。→ Promise
//   floatText(anchorEl, text, kind = 'info')                      飘字。kind：gain（金，+12◈）、qi（青，+灵气）、heal（青，伤愈）、dmg、crit、info。
//   SFX                                                           { coin, reelTick, reelStop, jackpot, crack, rarity0..4, levelUp, toast, chestThud,
//                                                                   seal, miss, unlock, whoosh }，每个是 (ctx, t, out, k?) => void
//   fxConfig({ calm, onSound })                                   全局默认，返回当前配置。calm 同时给 <html> 加/去 gu-calm，停住五转墨气。
//   fuseRankUp(host, { artBefore, artAfter, name, rank, onSound })
//                                                                升转演出：三只同种飞向中间 → 合成一团墨打转 → 顿帧炸开 → 新外貌弹出 →
//                                                                盖「二转」…「五转」/「仙蛊」印。rank 是升转后的转数 2..6。点一下跳到最终态。
//
// 升转外貌（src/art.js）
//   guSVG(sp, { rank, rarity, still })：rank 1..5，6 = 仙蛊。在任何物种（含以后新加的）原画上叠通用图层：
//     二转飞白墨纹、体型略大；三转身后真元色晕染（core.js ZHENYUAN.colors）；四转金线勾边、晕染更浓、足下小印；
//     五转头光 + 墨气缓动（still:true 或 html.gu-calm 或 prefers-reduced-motion 时不动）；六转金朱背光、双线描金、金箔、仙印。
//     rarity 不画在虫身上，只写进 data-rar；卡片用 rarityFrame(rarity) 返回的 class（rf rfN）出边框和角标。
//     rankLayers(rank, bbox) 是叠加层本体，新物种可在 RANK_BOX / 默认外框上直接套用。
//   接法示例：fuseRankUp(document.body, { artBefore: guSVG(g.sp, { rank: s0 }), artAfter: guSVG(g.sp, { rank: s0 + 1 }), name: SP[g.sp].n, rank: s0 + 1 })
// ────────────────────────────────────────────────────────────────────────

const FXC = { calm: false, onSound: null };
export function fxConfig(o) {
  if (o) { Object.assign(FXC, o); if ('calm' in o && typeof document !== 'undefined') document.documentElement.classList.toggle('gu-calm', !!o.calm); }
  return FXC;
}
const FX_RN = ['凡', '良', '珍', '绝', '天'], FX_CN = ['木', '铜', '银', '金', '玄'], FX_AN = ['铜', '银', '金'];
const fxRM = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const fxCalm = o => !!(o && o.calm != null ? o.calm : FXC.calm) || fxRM();
const fxH = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const fxEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fxCl = (v, a, b) => Math.max(a, Math.min(b, v));
const fxR = (a, b) => a + Math.random() * (b - a);
const fxPick = a => a[(Math.random() * a.length) | 0];
const fxNum = v => String(Math.round(v));
function fxSnd(o, n, k) { const f = (o && o.onSound) || FXC.onSound; if (f) try { f(n, k); } catch (e) { /* 声音出错不影响画面 */ } }
function fxAt(layer, node) { const a = layer.getBoundingClientRect(), b = node.getBoundingClientRect(); return { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height / 2, w: b.width, h: b.height }; }
const fxInk = (s, d0 = 0, step = 70) => [...String(s)].map((c, i) => `<i style="animation-delay:${d0 + i * step}ms">${fxEsc(c)}</i>`).join('');

// 滤镜：毛笔边、墨晕、洇开、印泥斑驳。只注入一次。
const FX_BODY = 'M61 24 C86 24 100 52 98 88 C96 125 80 151 59 150 C37 149 22 123 22 86 C22 50 37 24 61 24 Z';
function fxDefs() {
  if (document.getElementById('fx-defs')) return;
  document.body.insertAdjacentHTML('afterbegin', `<svg id="fx-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<filter id="fx-ink" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="fx-wash" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="0.9"/></filter>
<filter id="fx-sumi" x="-35%" y="-35%" width="170%" height="170%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="11" result="lo"/><feDisplacementMap in="SourceGraphic" in2="lo" scale="34" xChannelSelector="R" yChannelSelector="G" result="d1"/><feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves="2" seed="2" result="hi"/><feDisplacementMap in="d1" in2="hi" scale="6" xChannelSelector="R" yChannelSelector="G" result="d2"/><feGaussianBlur in="d2" stdDeviation="1.4" result="b"/><feMorphology in="b" operator="erode" radius="1.6" result="er"/><feComposite in="b" in2="er" operator="out" result="edge"/><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="6" result="m"/><feColorMatrix in="m" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.6 0 0 0 -0.75" result="ma"/><feComposite in="b" in2="ma" operator="in" result="body"/><feMerge><feMergeNode in="body"/><feMergeNode in="edge"/><feMergeNode in="edge"/></feMerge></filter>
<filter id="fx-seepf" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="8" result="lo"/><feDisplacementMap in="SourceGraphic" in2="lo" scale="14" xChannelSelector="R" yChannelSelector="G" result="d1"/><feGaussianBlur in="d1" stdDeviation="2" result="b"/><feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves="3" seed="12" result="m"/><feColorMatrix in="m" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.4 0 0 0 -0.6" result="ma"/><feComposite in="b" in2="ma" operator="in"/></filter>
<filter id="fx-stamp" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="t"/><feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -14 0 0 0 10.4" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in" result="c"/><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="9" result="d"/><feDisplacementMap in="c" in2="d" scale="1.8" xChannelSelector="R" yChannelSelector="G"/></filter>
<clipPath id="fx-ccclip"><path d="${FX_BODY}"/></clipPath>
</defs></svg>`);
}

// ---------- 播放控制：可跳过的等待与动画 ----------
function fxRun(o, root) {
  const run = { skipped: false, done: false, root, anims: [], wakes: [], timers: [], junk: [] };
  run.wait = ms => new Promise(res => { if (run.skipped || ms <= 0) return res(); run.timers.push(setTimeout(res, ms)); run.wakes.push(res); });
  run.skip = () => {
    if (run.skipped || run.done) return;
    run.skipped = true; if (root) root.classList.add('fx-skip');
    run.timers.forEach(clearTimeout); run.wakes.splice(0).forEach(f => f());
    run.anims.splice(0).forEach(a => { try { a.finish(); } catch (e) { a.cancel(); } });
    run.junk.splice(0).forEach(n => n.remove());
  };
  run.anim = (node, kf, opt) => {
    if (!node || !node.animate) return null;
    const a = node.animate(kf, typeof opt === 'number' ? { duration: opt, fill: 'both' } : Object.assign({ fill: 'both' }, opt));
    if (run.skipped) { try { a.finish(); } catch (e) { a.cancel(); } } else run.anims.push(a);
    return a;
  };
  run.snd = (n, k) => { if (!run.skipped) fxSnd(o, n, k); };
  run.show = (node, cls = 'on') => { if (node) { node.classList.remove('fx-pre'); node.classList.add(cls); } };
  return run;
}
function fxStage(host, cls, o) {
  fxDefs();
  host = host || document.body;
  const fixed = host === document.body || host === document.documentElement;
  if (!fixed && getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const st = fxH(`<div class="fx-stage ${cls}${fixed ? ' fx-fixed' : ''}${fxCalm(o) ? ' fx-calm' : ''}" role="dialog" aria-live="polite"></div>`);
  (fixed ? document.body : host).appendChild(st);
  const run = fxRun(o, st);
  const key = e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') run.skip(); };
  st.addEventListener('pointerdown', run.skip); document.addEventListener('keydown', key);
  run.unkey = () => document.removeEventListener('keydown', key);
  return { st, run };
}
// 到最终态：换提示语，等点击或 hold 后收起
function fxClose(st, run, o, label) {
  run.done = true; run.unkey(); st.removeEventListener('pointerdown', run.skip);
  const hint = st.querySelector('.fx-hint'); if (hint) hint.textContent = label || '点击收下';
  if (o.keep) return Promise.resolve({ el: st, skipped: run.skipped });
  return new Promise(res => {
    const t0 = performance.now(); let fin = false, tm = 0;
    const go = () => {
      if (fin) return; fin = true; clearTimeout(tm); document.removeEventListener('keydown', onk);
      st.classList.add('fx-out'); setTimeout(() => { st.remove(); res({ skipped: run.skipped }); }, 260);
    };
    const onk = e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') go(); };
    st.addEventListener('pointerdown', () => { if (performance.now() - t0 > 250) go(); });
    document.addEventListener('keydown', onk);
    if (o.hold) tm = setTimeout(go, o.hold);
  });
}
function fxShake(node, px, ms = 260, o) {
  if (!node || !px || fxCalm(o)) return;
  if (node.classList.contains('fx-stage')) node = node.querySelector('.fx-col') || node;   // 只震内容，别把整块浮层震出缝
  node.animate([{ translate: '0 0' }, { translate: `${px}px ${-px / 2}px` }, { translate: `${-px}px ${px / 3}px` }, { translate: `${px / 2}px 0` }, { translate: '0 0' }], { duration: ms, easing: 'ease-out' });
}

// ---------- 墨与金：墨团、金箔、朱砂点、碎片、涟漪 ----------
// 一团墨：浓核 → 中圈 → 外圈淡洇 → 飞点，再过 fx-sumi（两级扭曲 + 宣纸斑驳）
function fxBlot(color, spat = 10, cls = '') {
  const c = (a, d, r, op) => `<circle cx="${(100 + Math.cos(a) * d).toFixed(1)}" cy="${(100 + Math.sin(a) * d).toFixed(1)}" r="${r.toFixed(1)}" fill-opacity="${op.toFixed(2)}"/>`;
  let s = c(0, 0, 32, .95);
  for (let i = 0; i < 6; i++) s += c(i * 1.047 + fxR(-.3, .3), fxR(20, 30), fxR(17, 25), fxR(.5, .8));
  for (let i = 0; i < 8; i++) s += c(i * .785 + fxR(-.3, .3), fxR(46, 60), fxR(9, 17), fxR(.22, .42));
  for (let i = 0; i < spat; i++) s += c(fxR(0, 6.283), fxR(68, 94), fxR(1.2, 4.2), fxR(.5, .9));
  return `<svg class="fx-blot ${cls}" viewBox="0 0 200 200" aria-hidden="true"><g filter="url(#fx-sumi)" style="fill:${color}">${s}</g></svg>`;
}
// 一团墨在 (x,y) 洇开再淡去：「闪」用它代替白闪
function fxBloom(layer, run, x, y, size, color, peak = .5, ms = 900, o) {
  if (run.skipped) return;
  const b = fxH(fxBlot(color, 10));
  Object.assign(b.style, { position: 'absolute', left: x - size / 2 + 'px', top: y - size / 2 + 'px', width: size + 'px', height: size + 'px', zIndex: 1, pointerEvents: 'none' });
  layer.appendChild(b); run.junk.push(b);
  const p = fxCalm(o) ? peak * .35 : peak;
  b.animate([{ scale: .2, opacity: 0 }, { scale: .85, opacity: p, offset: .18 }, { scale: 1.08, opacity: 0 }], { duration: fxRM() ? 300 : ms, easing: 'cubic-bezier(.15,.8,.25,1)', fill: 'forwards' }).onfinish = () => b.remove();
}
// 全屏墨染：留在最终态里，收起时随浮层一起淡出
function fxWash(st, run, colors, slow) {
  const w = st.querySelector('.fx-wash'); if (!w) return;
  const first = !w.childElementCount;
  if (first) w.innerHTML = colors.map((c, i) => fxBlot(c, i ? 0 : 14, 'w' + i)).join('');
  const kf = slow ? [{ scale: .15, opacity: 0 }, { scale: .55, opacity: .55 }] : first ? [{ scale: .5, opacity: 0 }, { scale: 1, opacity: 1 }] : [{ scale: 1, opacity: 1 }];
  [...w.children].forEach((s, i) => run.anim(s, kf, { duration: slow ? 900 : 700 + i * 160, easing: 'cubic-bezier(.2,.7,.3,1)' }));
}
function fxFlakes(layer, run, x, y, n, colors, spread = 1) {
  if (!n || run.skipped || fxRM()) return;
  for (let i = 0; i < n; i++) {
    const f = document.createElement('i'), s = fxR(5, 13), h = s * fxR(.55, 1.1);
    f.className = 'fx-flake';
    const p = () => fxR(0, 30).toFixed(0) + '% ' + fxR(0, 30).toFixed(0) + '%';
    f.style.cssText = `left:${x - s / 2}px;top:${y - h / 2}px;width:${s}px;height:${h}px;background:${colors[i % colors.length]};clip-path:polygon(${p()},${(70 + Math.random() * 30).toFixed(0)}% ${fxR(0, 25).toFixed(0)}%,${(75 + Math.random() * 25).toFixed(0)}% ${(70 + Math.random() * 30).toFixed(0)}%,${fxR(0, 30).toFixed(0)}% ${(75 + Math.random() * 25).toFixed(0)}%)`;
    layer.appendChild(f); run.junk.push(f);
    const a = -Math.PI / 2 + fxR(-1.35, 1.35), v = fxR(80, 230) * spread, dx = Math.cos(a) * v, dy = Math.sin(a) * v, fall = fxR(110, 260), rot = fxR(-540, 540);
    f.animate([
      { transform: 'translate(0,0) rotate(0deg) scaleX(1)', opacity: 1 },
      { transform: `translate(${dx * .72}px,${dy * .72}px) rotate(${rot * .3}deg) scaleX(-.35)`, opacity: 1, offset: .22 },
      { transform: `translate(${dx}px,${dy + fall * .35}px) rotate(${rot * .6}deg) scaleX(.85)`, opacity: 1, offset: .55 },
      { transform: `translate(${dx * 1.12}px,${dy + fall}px) rotate(${rot}deg) scaleX(-.5)`, opacity: 0 },
    ], { duration: fxR(1300, 2200), easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' }).onfinish = () => f.remove();
  }
}
function fxDrops(layer, run, x, y, n, color, spread = 1) {
  if (!n || run.skipped || fxRM()) return;
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i'), s = fxR(3, 10), a = fxR(0, 6.283), v = fxR(50, 170) * spread;
    d.className = 'fx-drop'; d.style.cssText = `left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;background:${color}`;
    layer.appendChild(d); run.junk.push(d);
    const deg = a * 57.3;
    d.animate([
      { transform: `translate(0,0) rotate(${deg}deg) scale(2.2,.45)`, opacity: .95 },
      { transform: `translate(${Math.cos(a) * v}px,${Math.sin(a) * v}px) rotate(${deg}deg) scale(1,1)`, opacity: .95, offset: .25 },
      { transform: `translate(${Math.cos(a) * v}px,${Math.sin(a) * v}px) rotate(${deg}deg) scale(1,1)`, opacity: .8, offset: .7 },
      { transform: `translate(${Math.cos(a) * v}px,${Math.sin(a) * v}px) rotate(${deg}deg) scale(1,1)`, opacity: 0 },
    ], { duration: fxR(900, 1400), easing: 'cubic-bezier(.1,.8,.2,1)', fill: 'forwards' }).onfinish = () => d.remove();
  }
}
function fxShards(layer, run, x, y, n, colors, spread = 1, up = 0) {
  if (!n || run.skipped || fxRM()) return;
  for (let i = 0; i < n; i++) {
    const f = document.createElement('i'), s = fxR(4, 12);
    f.className = 'fx-shard';
    f.style.cssText = `left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s * fxR(.5, 1)}px;background:${colors[i % colors.length]};clip-path:polygon(0 ${fxR(0, 40) | 0}%,100% 0,${fxR(60, 100) | 0}% 100%,${fxR(0, 30) | 0}% ${fxR(60, 100) | 0}%)`;
    layer.appendChild(f); run.junk.push(f);
    const a = fxR(0, 6.283), v = fxR(40, 150) * spread, dx = Math.cos(a) * v, dy = Math.sin(a) * v - up;
    f.animate([{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) rotate(${fxR(-200, 200)}deg)`, opacity: 1, offset: .4 }, { transform: `translate(${dx * 1.2}px,${dy + fxR(80, 180)}px) rotate(${fxR(-400, 400)}deg)`, opacity: 0 }],
      { duration: fxR(700, 1100), easing: 'cubic-bezier(.2,.6,.5,1)', fill: 'forwards' }).onfinish = () => f.remove();
  }
}
function fxRing(layer, run, x, y, size, color) {
  if (run.skipped || fxRM()) return;
  const r = document.createElement('i'); r.className = 'fx-ring';
  r.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;border-color:${color}`;
  layer.appendChild(r); run.junk.push(r);
  r.animate([{ scale: .45, opacity: .85 }, { scale: 1.6, opacity: 0 }], { duration: 560, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).onfinish = () => r.remove();
}
const fxSeal = (txt, cls = '', style = '') => `<span class="fx-seal ${cls}"${style ? ` style="${style}"` : ''}>${[...txt].map(c => `<b>${fxEsc(c)}</b>`).join('')}</span>`;
// 大印：带几点朱砂溅
function fxBigSeal(txt, color) {
  let dots = '';
  for (let i = 0; i < 9; i++) { const a = fxR(0, 6.283), d = fxR(46, 64); dots += `<circle cx="${(60 + Math.cos(a) * d).toFixed(1)}" cy="${(60 + Math.sin(a) * d).toFixed(1)}" r="${fxR(1, 3.6).toFixed(1)}"/>`; }
  return `<div class="fx-bigseal fx-pre" style="--sc:${color}"><svg viewBox="0 0 120 120" aria-hidden="true"><g filter="url(#fx-wash)" style="fill:${color}">${dots}</g></svg>${fxSeal(txt, 'fx-lg')}</div>`;
}
async function fxRollRun(el, from, to, ms, fmt, run) {
  const f = fmt || fxNum;
  if (!el) return;
  if (fxRM() || ms <= 0 || (run && run.skipped)) { el.textContent = f(to); return; }
  const t0 = performance.now(), tok = el.__fxRoll = {};
  await new Promise(res => {
    const step = now => {
      if (el.__fxRoll !== tok) return res();
      const k = run && run.skipped ? 1 : Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = f(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step); else { el.textContent = f(to); res(); }
    };
    requestAnimationFrame(step);
  });
}

// ---------- 1. 开茧 ----------
const FX_CRACKS = ['M60 70 L55 81 L62 90 L57 102', 'M60 70 L66 60 L61 50 L68 39', 'M62 90 L73 94 L79 106 L89 111', 'M55 81 L45 75 L35 80 L28 71', 'M57 102 L47 108 L41 121', 'M79 106 L77 120 L86 131'];
const FX_WRAPS = ['M18 62 Q60 76 102 58', 'M18 82 Q62 97 102 77', 'M20 103 Q60 118 100 98', 'M26 124 Q60 137 94 118', 'M32 44 Q60 54 92 40', 'M30 38 Q72 92 90 142', 'M88 34 Q50 94 34 140'];
function fxCocoonSVG() {
  return `<svg viewBox="0 0 120 170" class="fx-ccsvg" aria-hidden="true">
<ellipse cx="60" cy="161" rx="30" ry="4.5" class="fx-ccsh" filter="url(#fx-wash)"/>
<path d="M60 -30 L60 26" class="fx-thr"/>
<path d="${FX_BODY}" class="fx-silk"/>
<g clip-path="url(#fx-ccclip)"><ellipse cx="42" cy="106" rx="22" ry="42" class="fx-ccshade" filter="url(#fx-wash)"/><circle cx="61" cy="86" r="30" class="fx-seep" filter="url(#fx-seepf)"/>
<g class="fx-wrap" filter="url(#fx-ink)">${FX_WRAPS.map((d, i) => `<path d="${d}"${i > 4 ? ' opacity=".5"' : ''}/>`).join('')}</g></g>
<path d="${FX_BODY}" class="fx-silko" filter="url(#fx-ink)"/>
<g class="fx-cks" filter="url(#fx-ink)">${FX_CRACKS.map(d => `<g class="fx-ck"><path d="${d}" pathLength="1" class="e"/><path d="${d}" pathLength="1" class="l"/></g>`).join('')}</g>
</svg>`;
}
const fxSwing = a => [{ rotate: '0deg' }, { rotate: a + 'deg' }, { rotate: -a * .75 + 'deg' }, { rotate: a * .4 + 'deg' }, { rotate: '0deg' }];
const FX_RC = r => `var(--fx-r${r})`, FX_PC = r => `var(--fx-p${r})`;

export async function openCocoon(host, o = {}) {
  const r = fxCl(o.rarity | 0, 0, 4), rm = fxRM(), k = rm ? .35 : 1;
  const { st, run } = fxStage(host, 'fx-cocoon fx-r' + r, o);
  st.style.setProperty('--lc', FX_RC(0));
  st.innerHTML = `<div class="fx-wash"></div><div class="fx-col">
<div class="fx-pit">${r ? `<div class="fx-halo fx-pre">${fxBlot(FX_RC(r), 6)}</div>` : ''}<div class="fx-ccbox"><div class="fx-cc">${fxCocoonSVG()}</div></div>
<div class="fx-cardbox fx-pre"><div class="fx-card" style="--rc:${FX_PC(r)}"><div class="fx-art">${o.artHTML || ''}</div><b class="fx-cn">${fxEsc(o.name || '')}</b>${r < 3 ? fxSeal(FX_RN[r], 'fx-sm fx-pre', `--sc:${FX_PC(r)}`) : ''}</div>${r >= 3 ? fxBigSeal(FX_RN[r] + '品', r === 4 ? 'var(--zhu)' : FX_PC(3)) : ''}</div></div>
<div class="fx-rk fx-pre" style="color:${FX_RC(r)}"><span class="ln"></span><span>${fxInk(FX_RN[r] + '品', 0, 90)}</span><span class="ln"></span></div></div>
<div class="fx-hint">点击跳过</div>`;
  const q = s => st.querySelector(s), box = q('.fx-ccbox'), cc = q('.fx-cc'), cks = [...st.querySelectorAll('.fx-ck')], seep = q('.fx-seep'), cardbox = q('.fx-cardbox');
  const mid = () => fxAt(st, cc), lift = n => cks[n] && fxAt(st, cks[n]);
  const setLv = lv => { st.style.setProperty('--lc', FX_RC(lv)); seep.style.opacity = lv ? (.2 + lv * .12).toFixed(2) : 0; };
  // 一、摇晃
  run.anim(cc, fxSwing(5), { duration: 380, easing: 'ease-in-out' }); run.snd('reelTick');
  await run.wait(340 * k);
  // 二、裂纹逐道出现，裂缝里的颜色一档档往上走
  const n = 2 + r, T = (1200 + 250 * r) * k, hold = (150 + 55 * r) * k, gap = (T - 340 * k - hold) / n;
  let lv = 0;
  for (let i = 0; i < n; i++) {
    cks[i].querySelectorAll('path').forEach(p => { run.anim(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 150, easing: 'ease-out' }); p.style.strokeDashoffset = 0; });
    run.snd('crack', i);
    const nl = Math.min(i, r);
    if (nl !== lv) { lv = nl; setLv(lv); const m = mid(); fxRing(st, run, m.x, m.y, m.h * .9, FX_RC(lv)); run.anim(cc, [{ scale: 1 }, { scale: 1.05 }, { scale: 1 }], { duration: 220, easing: 'ease-out' }); }
    run.anim(cc, fxSwing(3 + i * 1.6), { duration: 300, easing: 'ease-out' });
    const c = lift(i); if (c) fxShards(st, run, c.x, c.y, 3, ['var(--fx-silk)', 'var(--fx-silk2)'], .5, 30);
    await run.wait(gap);
  }
  if (o.tease && r < 4 && !run.skipped) {   // 近失：闪一下高一档的颜色，再落回
    setLv(r + 1); run.snd('crack', n); await run.wait(170 * k); setLv(r);
  }
  // 三、屏息：快颤，墨意从四周渗进来（绝、天）
  const trem = run.anim(cc, [{ rotate: '-1.4deg' }, { rotate: '1.4deg' }], { duration: 48, iterations: Infinity, direction: 'alternate', fill: 'none' });
  seep.style.opacity = r ? (.3 + r * .14).toFixed(2) : .08;
  if (r >= 3) fxWash(st, run, r === 4 ? ['var(--fx-w4a)', 'var(--fx-w4b)'] : ['var(--fx-w3a)', 'var(--fx-w3b)'], true);
  await run.wait(hold);
  if (trem) trem.pause();
  await run.wait(rm ? 0 : 85);   // 顿帧
  if (trem) trem.cancel();
  // 四、破茧：两半飞开、碎丝四散、墨晕一闪、金箔朱砂、震屏
  const m = mid();
  cc.classList.add('fx-gone');
  const svg = cc.innerHTML;
  const top = fxH(`<div class="fx-half t">${svg}</div>`), bot = fxH(`<div class="fx-half b">${svg}</div>`);
  box.append(top, bot);
  run.anim(top, [{ transform: 'none', opacity: 1 }, { transform: `translate(${-30 - r * 6}px,${-64 - r * 10}px) rotate(${-24 - r * 4}deg)`, opacity: 0 }], { duration: 650, easing: 'cubic-bezier(.15,.7,.3,1)' });
  run.anim(bot, [{ transform: 'none', opacity: 1 }, { transform: `translate(${24 + r * 4}px,${50 + r * 6}px) rotate(${16 + r * 3}deg)`, opacity: 0 }], { duration: 650, easing: 'cubic-bezier(.3,.2,.4,1)' });
  fxBloom(st, run, m.x, m.y, 240 + r * 70, FX_RC(r), r ? .55 : .3, 900, o);
  fxShards(st, run, m.x, m.y, 10 + r * 3, ['var(--fx-silk)', 'var(--fx-silk2)', 'var(--fx-edge)'], 1 + r * .2);
  fxFlakes(st, run, m.x, m.y, [0, 3, 8, 16, 30][r], r === 4 ? ['var(--fx-gold)', 'var(--fx-gold2)', 'var(--fx-leaf)', 'var(--fx-r4b)'] : r === 3 ? [FX_RC(3), 'var(--fx-gold)', FX_RC(3)] : [FX_RC(r)], .8 + r * .15);
  if (r >= 3) { fxDrops(st, run, m.x, m.y, 14, r === 4 ? 'var(--zhu)' : FX_RC(3), 1.3); fxWash(st, run, [], false); }
  fxShake(st, [1, 2, 3, 6, 9][r], 300, o);
  run.snd('rarity' + r);
  // 五、蛊落下：弹出用回弹，落定用减速；身后留一团本档颜色的墨晕
  const halo = q('.fx-halo');
  if (halo) { run.show(halo); run.anim(halo, [{ scale: .3, opacity: 0 }, { scale: 1, opacity: 1 }], { duration: 700, easing: 'cubic-bezier(.15,.8,.25,1)' }); }
  run.show(cardbox);
  run.anim(cardbox, [{ transform: 'translateY(28px) scale(.5)', opacity: 0, easing: 'cubic-bezier(.2,.9,.3,1.25)' }, { transform: 'translateY(-22px) scale(1.04)', opacity: 1, offset: .5, easing: 'cubic-bezier(.3,0,.2,1)' }, { transform: 'none', opacity: 1 }], { duration: rm ? 200 : 560 });
  await run.wait(380 * k);
  run.show(q('.fx-rk'));
  if (r < 3) { run.show(q('.fx-card .fx-seal')); run.snd('seal'); }
  else {   // 绝、天：大印落下
    await run.wait(140 * k);
    run.show(q('.fx-bigseal')); run.snd('seal');
    await run.wait(rm ? 0 : 200);
    fxShake(st, r === 4 ? 6 : 4, 220, o);
    const s = fxAt(st, q('.fx-bigseal'));
    fxDrops(st, run, s.x, s.y, 8, r === 4 ? 'var(--zhu)' : FX_RC(3), .6);
    if (r === 4) fxFlakes(st, run, s.x, s.y, 10, ['var(--fx-gold)', 'var(--fx-gold2)'], .6);
  }
  return fxClose(st, run, o, '点击收下');
}

// ---------- 2. 转市 · 三格转轮 ----------
export async function spinReels(host, o = {}) {
  fxDefs();
  const items = (o.items || []).slice(0, 3), tri = !!o.triple, near = !!o.nearMiss && !tri, rm = fxRM();
  while (items.length < 3) items.push('');
  const pool = o.pool && o.pool.length ? o.pool : items;
  const box = fxH(`<div class="fx-reels${fxCalm(o) ? ' fx-calm' : ''}"><div class="fx-rrow">${[0, 1, 2].map(() => '<div class="fx-rwin"><div class="fx-strip"></div></div>').join('')}</div><div class="fx-rmsg"></div></div>`);
  (host || document.body).appendChild(box);
  const run = fxRun(o, box);
  box.addEventListener('pointerdown', run.skip);
  const wins = [...box.querySelectorAll('.fx-rwin')], strips = [...box.querySelectorAll('.fx-strip')], msg = box.querySelector('.fx-rmsg');
  const D = rm ? [160, 260, 360] : [400, 750, near ? 1800 : 1100], P = [3, 3, near ? 2.65 : 3];
  const R = [0, 1, 2].map(i => {
    const L = Math.max(5, Math.round(.06 * D[i] / P[i]) + 1);
    // 格子自上而下往下走：cells[1] 是停下的那格；近失时 cells[0]（下一格就转到的）放成同种，停下时露在中线上方，差一格
    const cells = [near && i === 2 ? items[0] : fxPick(pool), items[i], fxPick(pool)];
    for (let j = 3; j <= L + 1; j++) cells.push(fxPick(pool));
    strips[i].innerHTML = cells.map(h => `<div class="fx-cell">${h}</div>`).join('');
    return { L, D: D[i], P: P[i], last: -1, stopped: false };
  });
  const cellH = strips[0].firstElementChild.getBoundingClientRect().height || 64, winH = wins[0].clientHeight || cellH * 1.5, base = (winH - cellH) / 2;
  const place = (i, p, bump = 0) => { strips[i].style.transform = `translateY(${(base - (R[i].L + 1 - p - bump) * cellH).toFixed(2)}px)`; };
  R.forEach((_, i) => place(i, 0));
  let lastTick = 0;
  const onStop = i => {
    const w = wins[i];
    run.snd('reelStop', i);
    run.anim(w, [{ translate: '0 3px' }, { translate: '0 0' }], { duration: 170, easing: 'ease-out' });
    w.classList.add('fx-land');
    if (i === 1 && near) { wins[0].classList.add('fx-pair'); wins[1].classList.add('fx-pair'); wins[2].classList.add('fx-tense'); }
  };
  // 三格同时起转，按各自时长减速停下；路过一格响一下，慢下来就听得出「快到了」
  await new Promise(res => {
    const t0 = performance.now();
    const frame = now => {
      const t = run.skipped ? 1e9 : now - t0;
      let all = true;
      R.forEach((g, i) => {
        if (g.fin) return;
        const x = Math.min(1, t / g.D), p = g.L * (1 - Math.pow(1 - x, g.P));
        const u = t > g.D ? Math.min(1, (t - g.D) / 170) : 0, bump = u ? .14 * Math.sin(Math.PI * u) * (1 - u) : 0;
        place(i, p, bump);
        strips[i].classList.toggle('fx-blur', x < .55 && !rm);
        const c = Math.floor(p);
        if (c !== g.last) { g.last = c; if (now - lastTick > 48 && x < 1) { run.snd('reelTick'); lastTick = now; } }
        if (x >= 1 && !g.stopped) { g.stopped = true; onStop(i); }
        if (u >= 1) g.fin = true; else all = false;
      });
      if (all) return res();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  wins[2].classList.remove('fx-tense');
  if (run.skipped) fxSnd(o, 'reelStop', 2);
  if (near) {   // 近失：第三格停在「差一格」的地方，浮出「差一只！」
    run.snd('miss');
    run.anim(wins[2], [{ translate: '0 0' }, { translate: '-4px 0' }, { translate: '4px 0' }, { translate: '-2px 0' }, { translate: '0 0' }], { duration: 300 });
    msg.innerHTML = `<span class="fx-miss">${fxInk('差一只！', 0, 60)}</span>`;
    if (!run.skipped) {
      const f = fxH(`<span class="fx-missfly">差一只！</span>`), p = fxAt(box, wins[2]);
      f.style.left = p.x + 'px'; f.style.top = (p.y - p.h * .25) + 'px';
      box.appendChild(f); run.junk.push(f);
      f.animate([{ opacity: 0, translate: '-50% 10px', scale: .6 }, { opacity: 1, translate: '-50% -18px', scale: 1.1, offset: .3 }, { opacity: 0, translate: '-50% -48px', scale: 1 }], { duration: 1000, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }).onfinish = () => f.remove();
    }
  } else if (tri) {
    await run.wait(rm ? 0 : 85);   // 顿帧
    wins.forEach(w => w.classList.add('fx-win3'));
    msg.innerHTML = fxSeal('三连', 'fx-sm fx-tri3');
    if (!run.skipped) await fxTripleBurst(o, box);
  }
  run.done = true; box.removeEventListener('pointerdown', run.skip);
  return { el: box, skipped: run.skipped, nearMiss: near, triple: tri };
}
// 三连：全屏墨染 + 大字「三连」逐字落墨 + 朱印 + 金箔，约 1.6 秒自己收起，点一下提前收
async function fxTripleBurst(o, reels) {
  const st = fxH(`<div class="fx-stage fx-fixed fx-tri${fxCalm(o) ? ' fx-calm' : ''}"><div class="fx-wash"></div><div class="fx-col"><b class="fx-trin">${fxInk('三连', 60, 110)}</b>${fxBigSeal('大吉', 'var(--zhu)')}<p class="fx-trisub">三只同种 · 结算加成</p></div></div>`);
  document.body.appendChild(st);
  const run = fxRun(o, st); st.addEventListener('pointerdown', run.skip);
  run.snd('jackpot');
  fxWash(st, run, ['var(--fx-w4a)', 'var(--fx-w4b)'], false);
  fxShake(reels, 8, 320, o);
  const c = fxAt(st, st.querySelector('.fx-trin'));
  fxFlakes(st, run, c.x, c.y, 34, ['var(--fx-gold)', 'var(--fx-gold2)', 'var(--fx-leaf)', 'var(--fx-r4b)'], 1.3);
  fxDrops(st, run, c.x, c.y, 16, 'var(--zhu)', 1.6);
  await run.wait(360);
  run.show(st.querySelector('.fx-bigseal')); run.snd('seal');
  await run.wait(180); fxShake(st, 5, 200, o);
  await run.wait(1100);
  run.done = true; st.classList.add('fx-out');
  await new Promise(r => setTimeout(r, 260)); st.remove();
}

// ---------- 3. 宝箱 ----------
const FX_CHEST = [   // 箱体、箍、锁、盖内
  { b: '#8a5a32', s: '#4f331f', l: '#b98c4e', i: '#4a2e1a', pl: 1 },
  { b: '#6e4a30', s: '#a8743c', l: '#4f8a78', i: '#3a2616', pl: 1 },
  { b: '#4f4b47', s: '#c3c9c9', l: '#e1e5e2', i: '#2a2826' },
  { b: '#7a2318', s: '#d9a441', l: '#efcf7a', i: '#3e110b', cloud: 1 },
  { b: '#201c25', s: '#c99a3a', l: '#b5301f', i: '#0f0d12', rune: 1 },
];
// 正面立面图：合盖时盖子压在箱身上；开盖 = 盖子翻到箱后立起（看到盖内），箱口露出一道黑
function fxChestSVG(t) {
  const c = FX_CHEST[t], E = '#1c1915', G = `filter="url(#fx-ink)" stroke="${E}" stroke-width="2.2" stroke-linejoin="round"`;
  const planks = c.pl ? `<path d="M17 28 L143 28 M18 52 L142 52" stroke="${E}" stroke-width="1.2" opacity=".45"/>` : '';
  const rune = c.rune ? `<g stroke="${c.l}" stroke-width="2.2" fill="none" stroke-linecap="round"><path d="M56 42 q8 -10 16 0 t16 0"/><path d="M60 56 l10 -6 l10 6 l10 -6"/></g>` : '';
  const cloud = c.cloud ? `<g stroke="${c.s}" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M56 48 q-6 -10 4 -12 q4 -8 12 -2 q8 -4 10 4 q8 2 4 10"/><path d="M92 54 q4 -6 10 -2"/></g>` : '';
  const lidMark = c.rune ? `<path d="M64 26 q16 -12 32 0" stroke="${c.l}" stroke-width="2" fill="none"/>` : c.cloud ? `<path d="M66 28 q6 -8 14 -2 q8 -6 14 2" stroke="${c.s}" stroke-width="1.5" fill="none"/>` : '';
  const body = `<svg class="fx-cbody" viewBox="0 0 160 80" aria-hidden="true"><g ${G}>
<path d="M14 3 L146 3 L141 76 L19 76 Z" fill="${c.b}"/>${planks}${rune}${cloud}
<path d="M34 3 L44 3 L43.5 76 L34.5 76 Z M116 3 L126 3 L125.5 76 L116.5 76 Z" fill="${c.s}"/>
<path d="M14 3 L146 3 L145.4 11 L14.6 11 Z" fill="${c.s}"/>
<path d="M67 3 L93 3 L93 17 Q80 31 67 17 Z" fill="${c.l}"/><circle cx="80" cy="13" r="2.6" fill="${E}" stroke="none"/><path d="M80 14 L80 20" stroke-width="2"/>
</g><ellipse cx="80" cy="79" rx="70" ry="3" fill="${E}" opacity=".18" filter="url(#fx-wash)"/></svg>`;
  const lid = `<svg class="fx-clid" viewBox="0 0 160 46" aria-hidden="true"><g ${G}>
<path d="M12 45 L12 27 Q14 5 80 3 Q146 5 148 27 L148 45 Z" fill="${c.b}"/>${lidMark}
<path d="M34 7 Q39 5 44 5 L44 45 L34 45 Z M116 5 Q121 5 126 7 L126 45 L116 45 Z" fill="${c.s}"/>
<path d="M12 37 L148 37 L148 45 L12 45 Z" fill="${c.s}"/></g></svg>`;
  const inner = `<svg class="fx-lidin" viewBox="0 0 160 50" aria-hidden="true"><g ${G}>
<path d="M22 50 L8 8 Q80 -5 152 8 L138 50 Z" fill="${c.i}"/>
<path d="M22 50 L19.4 42 L140.6 42 L138 50 Z" fill="${c.s}"/>
<path d="M30 34 Q80 28 130 34 M24 20 Q80 12 136 20" stroke="${c.b}" stroke-width="1.3" opacity=".7" fill="none"/></g></svg>`;
  const mouth = `<svg class="fx-mouth" viewBox="0 0 160 16" aria-hidden="true"><path d="M21 0 L139 0 L146 16 L14 16 Z" fill="#0d0b09" stroke="${E}" stroke-width="2" stroke-linejoin="round"/><path d="M23 1.5 L137 1.5 L138.5 6 L21.5 6 Z" fill="${c.i}" opacity=".9"/></svg>`;
  return `<div class="fx-ctop">${lid}<div class="fx-open fx-pre">${inner}${mouth}</div></div>${body}<span class="fx-ft"><i>封</i><i></i></span>`;
}
const fxChip = (w, i) => `<div class="fx-rw fx-pre" data-i="${i}"><span class="fx-ri">${w.icon == null ? '' : w.icon}</span><span class="fx-rl">${fxEsc(w.label || '')}</span><b class="fx-ra">${w.amount != null ? '×0' : ''}</b></div>`;

export async function openChest(host, o = {}) {
  const t = fxCl(o.tier | 0, 0, 4), rw = o.rewards || [], big = t >= 3, rm = fxRM(), k = rm ? .35 : 1;
  const { st, run } = fxStage(host, 'fx-chestst fx-t' + t, o);
  const tc = ['#8a5a32', '#a8743c', 'var(--fx-r0)', 'var(--fx-r4)', 'var(--fx-r3)'][t];
  st.innerHTML = `<div class="fx-wash"></div><div class="fx-col">
<p class="fx-ctitle" style="color:${tc}">${FX_CN[t]}箱</p>
<div class="fx-chest">${fxChestSVG(t)}${big ? fxBigSeal(FX_CN[t], t === 3 ? 'var(--zhu)' : FX_PC(3)) : ''}</div>
<div class="fx-rws">${rw.map(fxChip).join('')}</div></div><div class="fx-hint">点击跳过</div>`;
  const q = s => st.querySelector(s), chest = q('.fx-chest'), lid = q('.fx-clid'), opened = q('.fx-open'), ft = q('.fx-ft');
  // 一、摇：一下比一下重
  const hops = 2 + (t >= 1) + (t >= 3), gap = (big ? 300 : 260) * k;
  for (let i = 0; i < hops; i++) {
    const h = 5 + i * 3 + t, d = i % 2 ? 1 : -1;
    run.anim(chest, [{ translate: '0 0', rotate: '0deg', scale: '1 1' }, { translate: `0 ${-h}px`, rotate: `${d * (2 + i)}deg`, scale: '.97 1.03', offset: .38 }, { translate: '0 0', rotate: `${-d}deg`, scale: '1.05 .95', offset: .72 }, { translate: '0 0', rotate: '0deg', scale: '1 1' }], { duration: 250, easing: 'ease-out' });
    await run.wait(180 * k);
    run.snd('chestThud', i); fxShake(st, 1 + i, 180, o);
    const c = fxAt(st, chest); fxShards(st, run, c.x, c.y + c.h * .45, 3, ['var(--fx-edge)', 'var(--fx-silk2)'], .6, 10);
    if (big && i === hops - 2) fxWash(st, run, t === 3 ? ['var(--fx-w4a)', 'var(--fx-w4b)'] : ['var(--fx-w3a)', 'var(--fx-wxb)'], true);
    await run.wait(gap - 180 * k);
  }
  // 二、屏息 + 顿帧
  const trem = run.anim(chest, [{ translate: '-1px 0' }, { translate: '1px 0' }], { duration: 40, iterations: Infinity, direction: 'alternate', fill: 'none' });
  await run.wait((120 + t * 50) * k);
  if (trem) trem.pause();
  await run.wait(rm ? 0 : 80);
  if (trem) trem.cancel();
  // 三、开盖：封条撕开、盖子掀起、箱口一团墨洇上来
  const c = fxAt(st, chest), b = fxAt(st, q('.fx-cbody')), my = b.y - b.h / 2 - 8;
  ft.classList.add('fx-torn');
  const [f1, f2] = ft.children;
  run.anim(f1, [{ transform: 'none', opacity: 1 }, { transform: 'translate(-26px,-60px) rotate(-50deg)', opacity: 0 }], { duration: 560, easing: 'cubic-bezier(.2,.7,.3,1)' });
  run.anim(f2, [{ transform: 'none', opacity: 1 }, { transform: 'rotate(28deg)', opacity: 1, offset: .35 }, { transform: 'translate(6px,24px) rotate(40deg)', opacity: 0 }], { duration: 600, easing: 'ease-in' });
  run.anim(lid, [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], { duration: rm ? 60 : 110, easing: 'ease-in' });   // 盖子翻过去
  await run.wait(90 * k);
  run.show(opened);
  run.anim(q('.fx-mouth'), [{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 140, easing: 'ease-out' });
  run.anim(q('.fx-lidin'), [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1.14)', offset: .6 }, { transform: 'none' }], { duration: rm ? 120 : 320, easing: 'cubic-bezier(.2,.9,.3,1)' });
  run.snd(big ? 'jackpot' : 'chestThud', 9);
  if (!big) run.snd('coin');
  fxBloom(st, run, c.x, my, 200 + t * 60, ['var(--fx-edge)', '#a8743c', 'var(--fx-r0)', 'var(--fx-r4)', 'var(--fx-r3)'][t], big ? .6 : .38, 1000, o);
  fxFlakes(st, run, c.x, my, [2, 5, 8, 26, 30][t], t === 2 ? ['#c3c9c9', '#e1e5e2'] : t === 4 ? ['var(--fx-gold)', 'var(--fx-r4b)', 'var(--fx-r3)'] : t >= 3 ? ['var(--fx-gold)', 'var(--fx-gold2)', 'var(--fx-leaf)'] : ['#b98c4e', '#a8743c'], .9 + t * .1);
  if (big) { fxDrops(st, run, c.x, my, 12, 'var(--zhu)', 1.2); fxWash(st, run, [], false); }
  fxShake(st, [2, 3, 3, 7, 8][t], 300, o);
  await run.wait(260 * k);
  if (big) { run.show(q('.fx-bigseal')); run.snd('seal'); await run.wait(160 * k); fxShake(st, 4, 200, o); }
  // 四、奖励逐个从箱口弹出，落定后数字滚上去
  const chips = [...st.querySelectorAll('.fx-rw')];
  const rolls = [];
  for (const [i, ch] of chips.entries()) {
    run.show(ch);
    const p = fxAt(st, ch), dx = c.x - p.x, dy = my - p.y;
    run.anim(ch, [{ transform: `translate(${dx}px,${dy}px) scale(.25)`, opacity: 0 }, { transform: `translate(${dx * .5}px,${dy * .5 - 60}px) scale(1.1)`, opacity: 1, offset: .45 }, { transform: 'none', opacity: 1 }], { duration: rm ? 160 : 520, easing: 'cubic-bezier(.25,.8,.35,1.15)' });
    run.snd('coin');
    const w = rw[i], a = ch.querySelector('.fx-ra');
    if (w && w.amount != null) rolls.push(run.wait(380 * k).then(() => fxRollRun(a, 0, +w.amount || 0, 520, v => '×' + fxNum(v), run)));
    await run.wait((big ? 260 : 200) * k);
  }
  await Promise.all(rolls);
  return fxClose(st, run, o, '点击收下');
}

// ---------- 4. 蛊师升级 ----------
export async function levelUp(host, o = {}) {
  const lv = o.level | 0, rw = o.rewards || [], rm = fxRM(), k = rm ? .35 : 1;
  const { st, run } = fxStage(host, 'fx-lvst', o);
  const title = o.title ? String(o.title) : '';
  st.innerHTML = `<div class="fx-wash"></div><div class="fx-col fx-lv">
<p class="fx-eb fx-pre">蛊师晋升</p>
<div class="fx-lvrow"><span class="fx-lvdi">第</span><span class="fx-lvnum"><span class="fx-lvroll"><b>${Math.max(0, lv - 1)}</b><b>${lv}</b></span></span><span class="fx-lvdi">级</span>${title ? fxSeal(title.slice(0, 4), 'fx-lvseal fx-pre') : ''}</div>
<svg class="fx-stroke" viewBox="0 0 300 22" aria-hidden="true"><path d="M5 12 C4 6 15 4 26 6.5 C72 9.5 150 5.5 228 7.5 C262 8.5 284 6.5 297 10.5 C289 13.5 262 13 232 13.5 C150 14.5 72 17 26 16.5 C13 17.5 5 16.5 5 12 Z" filter="url(#fx-ink)"/></svg>
<ul class="fx-lvrw">${rw.map((w, i) => `<li class="fx-pre" data-i="${i}"><span class="fx-ri">${w.icon == null ? '' : w.icon}</span><span class="fx-rl">${fxEsc(w.label || '')}</span><b class="fx-ra">${w.amount != null ? '+0' : ''}</b></li>`).join('')}</ul>
</div><div class="fx-hint">点击跳过</div>`;
  const q = s => st.querySelector(s), roll = q('.fx-lvroll'), num = q('.fx-lvnum'), row = q('.fx-lvrow');
  run.show(q('.fx-eb'));
  run.anim(row, [{ opacity: 0, scale: .92, filter: 'blur(5px)' }, { opacity: 1, scale: 1, filter: 'blur(0)' }], { duration: rm ? 120 : 380, easing: 'ease-out' });
  await run.wait(420 * k);
  // 期待：旧等级的数字颤一颤
  run.anim(num, [{ translate: '0 0' }, { translate: '0 -3px' }, { translate: '0 1px' }, { translate: '0 -2px' }, { translate: '0 0' }], { duration: 260 });
  run.snd('reelTick');
  await run.wait(300 * k);
  await run.wait(rm ? 0 : 70);   // 顿帧
  // 翻到新等级
  run.anim(roll, [{ transform: 'translateY(0)', easing: 'cubic-bezier(.2,1.5,.4,1)' }, { transform: 'translateY(-50%)' }], { duration: rm ? 120 : 420 });
  run.snd('levelUp');
  const c = fxAt(st, num);
  fxBloom(st, run, c.x, c.y, 360, 'var(--fx-r4)', .4, 1100, o);
  fxWash(st, run, ['var(--fx-w4a)', 'var(--fx-w4b)'], false);
  fxFlakes(st, run, c.x, c.y, 22, ['var(--fx-gold)', 'var(--fx-gold2)', 'var(--fx-leaf)'], 1);
  fxShake(st, 5, 260, o);
  run.anim(num, [{ scale: 1.35 }, { scale: 1 }], { duration: 360, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  run.anim(q('.fx-stroke'), [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], { duration: rm ? 100 : 460, delay: 120 * k, easing: 'cubic-bezier(.4,0,.2,1)' });   // 一笔横扫
  await run.wait(320 * k);
  if (title) { run.show(q('.fx-lvseal')); run.snd('seal'); await run.wait(240 * k); }
  const rows = [...st.querySelectorAll('.fx-lvrw li')], rolls = [];
  for (const li of rows) {
    run.show(li);
    run.anim(li, [{ opacity: 0, transform: 'translateY(14px) scale(.96)' }, { opacity: 1, transform: 'translateY(-3px) scale(1.01)', offset: .6 }, { opacity: 1, transform: 'none' }], { duration: rm ? 120 : 380, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
    run.snd('coin');
    const w = rw[+li.dataset.i], a = li.querySelector('.fx-ra');
    if (w && w.amount != null) rolls.push(fxRollRun(a, 0, +w.amount || 0, 480, v => '+' + fxNum(v), run));
    await run.wait(200 * k);
  }
  await Promise.all(rolls);
  return fxClose(st, run, o, '点击继续');
}

// ---------- 5. 成就弹卡 ----------
const FX_TQ = { box: null, live: [], wait: [] };
export function toastAchievement(o = {}) {
  fxDefs();
  return new Promise(res => { FX_TQ.wait.push({ o, res }); fxToastPump(); });
}
function fxToastPump() {
  if (!FX_TQ.box || !FX_TQ.box.isConnected) { FX_TQ.box = fxH('<div class="fx-toasts" aria-live="polite"></div>'); document.body.appendChild(FX_TQ.box); }
  while (FX_TQ.live.length < 3 && FX_TQ.wait.length) fxToastShow(FX_TQ.wait.shift());
}
function fxToastShow({ o, res }) {
  const tier = fxCl(o.tier | 0, 0, 2), hid = !!o.hidden, rm = fxRM();
  const t = fxH(`<div class="fx-toast fx-tt${tier}${hid ? ' fx-hid' : ''}" role="status">${fxSeal(hid ? '秘' : FX_AN[tier], 'fx-tseal')}<div class="fx-tbody"><small>${hid ? '隐藏成就' : '成就'} · ${FX_AN[tier]}</small><b>${fxInk(o.name || '', 240, 45)}</b>${o.desc ? `<p>${fxEsc(o.desc)}</p>` : ''}</div></div>`);
  FX_TQ.box.appendChild(t); FX_TQ.live.push(t);
  fxSnd(o, 'toast', tier);
  if (!rm) t.animate([{ transform: 'translateX(112%)', opacity: 0 }, { transform: 'translateX(-8px)', opacity: 1, offset: .7 }, { transform: 'none', opacity: 1 }], { duration: 440, easing: 'cubic-bezier(.2,.9,.3,1)' });
  if (tier === 2 && !rm) {
    const run = fxRun(o), s = t.querySelector('.fx-tseal');
    setTimeout(() => { if (!t.isConnected) return; const a = fxAt(document.body, s); fxFlakes(document.body, run, a.x, a.y, 9, ['var(--fx-gold)', 'var(--fx-gold2)'], .45); }, 320);
  }
  let gone = false;
  const out = () => {
    if (gone) return; gone = true; clearTimeout(tm);
    const h = t.offsetHeight;
    const a = t.animate([{ opacity: 1, transform: 'none', maxHeight: h + 'px', marginBottom: '8px' }, { opacity: 0, transform: 'translateX(40%)', maxHeight: h + 'px', marginBottom: '8px', offset: .55 }, { opacity: 0, transform: 'translateX(40%)', maxHeight: '0px', marginBottom: '0px' }], { duration: rm ? 120 : 380, easing: 'ease-in', fill: 'forwards' });
    a.onfinish = () => { t.remove(); FX_TQ.live.splice(FX_TQ.live.indexOf(t), 1); res(); fxToastPump(); };
  };
  const tm = setTimeout(out, [3200, 3600, 4400][tier] + (hid ? 700 : 0));
  t.addEventListener('pointerdown', out);
}

// ---------- 6. 功能点亮 · 卷轴展开 ----------
export async function unlockReveal(host, o = {}) {
  const rm = fxRM(), k = rm ? .35 : 1;
  const { st, run } = fxStage(host, 'fx-unst', o);
  const name = String(o.name || '');
  st.innerHTML = `<div class="fx-col"><div class="fx-scroll"><i class="fx-rod l"></i><div class="fx-sheet"><span class="fx-ueb">新境开启</span><b class="fx-un fx-pre">${fxInk(name, 0, 80)}</b>${o.line ? `<p class="fx-ul fx-pre">${fxEsc(o.line)}</p>` : ''}${fxSeal('启', 'fx-sm fx-useal fx-pre')}</div><i class="fx-rod r"></i></div></div><div class="fx-hint"></div>`;
  const q = s => st.querySelector(s), sh = q('.fx-sheet'), half = sh.offsetWidth / 2, ease = { duration: rm ? 120 : 560, easing: 'cubic-bezier(.3,.7,.2,1)' };
  run.snd('whoosh');
  run.anim(sh, [{ clipPath: 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0% 0 0%)' }], ease);
  run.anim(q('.fx-rod.l'), [{ transform: `translateX(${half}px)` }, { transform: 'none' }], ease);
  run.anim(q('.fx-rod.r'), [{ transform: `translateX(${-half}px)` }, { transform: 'none' }], ease);
  await run.wait(480 * k);
  run.show(q('.fx-un')); run.snd('unlock');
  await run.wait((160 + [...name].length * 80) * k);
  run.show(q('.fx-useal')); run.snd('seal');
  const s = fxAt(st, q('.fx-useal'));
  fxDrops(st, run, s.x, s.y, 6, 'var(--zhu)', .5);
  fxShake(sh, 2, 180, o);
  await run.wait(140 * k);
  run.show(q('.fx-ul'));
  return fxClose(st, run, Object.assign({ hold: 2600 }, o), '');
}

// ---------- 7. 跳数字、飘字 ----------
export function rollNumber(el, from, to, ms = 600, fmt) { return fxRollRun(el, +from || 0, +to || 0, ms, fmt, null); }
export function floatText(anchorEl, text, kind = 'info') {
  if (!anchorEl) return Promise.resolve();
  const r = anchorEl.getBoundingClientRect(), f = fxH(`<span class="fx-float fx-f-${fxEsc(kind)}">${fxEsc(text)}</span>`);
  f.style.left = (r.left + r.width / 2 + fxR(-8, 8)) + 'px'; f.style.top = (r.top + r.height * .3) + 'px';
  f.style.setProperty('--rot', fxR(-6, 6).toFixed(1) + 'deg');
  document.body.appendChild(f);
  const a = f.animate(fxRM() ? [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 0 }] : [
    { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
    { transform: 'translate(-50%,-75%) scale(1.2)', opacity: 1, offset: .14 },
    { transform: 'translate(-50%,-90%) scale(1)', opacity: 1, offset: .28 },
    { transform: 'translate(-50%,-250%) scale(.96)', opacity: 0 },
  ], { duration: kind === 'crit' ? 1300 : 1050, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
  return new Promise(res => { a.onfinish = () => { f.remove(); res(); }; });
}

// ---------- 9. 升转演出 ----------
const FX_RANK = ['', '一', '二', '三', '四', '五', '仙'], FX_ZY = ['#a0703f', '#a0703f', '#a4442c', '#9aa4ab', '#d9a441', '#7d62a8', '#d9a441'];   // 真元色，同 core.js ZHENYUAN.colors
export async function fuseRankUp(host, o = {}) {
  const r = fxCl(o.rank | 0 || 2, 2, 6), rm = fxRM(), k = rm ? .35 : 1, col = FX_ZY[r], big = r >= 5;
  const { st, run } = fxStage(host, r >= 6 ? 'fx-fuse fx-r4' : 'fx-fuse', o);
  const seal = r >= 6 ? '仙蛊' : FX_RANK[r] + '转', spots = [[-112, -52, -14], [112, -52, 14], [0, 92, 0]];
  st.innerHTML = `<div class="fx-wash"></div><div class="fx-col">
<div class="fx-fpit">${spots.map(([dx, dy]) => `<div class="fx-fz" style="--dx:${dx}px;--dy:${dy}px">${o.artBefore || ''}</div>`).join('')}
<div class="fx-orb fx-pre"><svg viewBox="0 0 200 200" aria-hidden="true"><g filter="url(#fx-sumi)"><circle cx="100" cy="100" r="66" style="fill:${col}" fill-opacity=".9"/><circle cx="100" cy="100" r="52" style="fill:var(--paper)"/><circle cx="100" cy="100" r="40" fill="#1c1915"/></g><path d="M78 92 Q96 70 120 86 Q132 100 116 116 Q100 124 94 108" fill="none" style="stroke:var(--paper)" stroke-width="3" stroke-linecap="round" opacity=".55" filter="url(#fx-ink)"/><g fill="none" stroke="${col}" stroke-linecap="round" filter="url(#fx-ink)"><path d="M100 30 A70 70 0 0 1 168 92" stroke-width="5"/><path d="M100 170 A70 70 0 0 1 32 108" stroke-width="5"/><path d="M60 52 A58 58 0 0 1 150 70" stroke-width="2.4" opacity=".7"/></g></svg></div>
<div class="fx-cardbox fx-pre"><div class="fx-card" style="--rc:${col}"><div class="fx-art">${o.artAfter || ''}</div></div>${fxBigSeal(seal, 'var(--zhu)')}</div></div>
<div class="fx-rkn fx-pre" style="--rcol:${col}"><span>${fxInk(o.name || '', 0, 70)}</span><small>${fxInk(seal, 160, 90)}</small></div></div>
<div class="fx-hint">点击跳过</div>`;
  const q = s => st.querySelector(s), fz = [...st.querySelectorAll('.fx-fz')], orb = q('.fx-orb'), card = q('.fx-cardbox');
  // 一、三只同种依次亮相
  fz.forEach((f, i) => run.anim(f, [{ scale: .5, opacity: 0 }, { scale: 1.06, opacity: 1, offset: .6 }, { scale: 1, opacity: 1 }], { duration: rm ? 100 : 300, delay: i * 70 * k, easing: 'cubic-bezier(.2,.9,.3,1.2)' }));
  run.snd('reelTick'); await run.wait(140 * k); run.snd('reelTick'); await run.wait(140 * k); run.snd('reelTick');
  await run.wait(260 * k);
  // 二、蓄势：往外一缩、一抖
  fz.forEach(f => run.anim(f, [{ transform: 'none' }, { transform: 'scale(.94) rotate(-4deg)' }, { transform: 'scale(.96) rotate(4deg)' }, { transform: 'none' }], { duration: 200 }));
  await run.wait(200 * k);
  // 三、飞向中间（越飞越快），撞进一团墨
  run.snd('whoosh');
  fz.forEach((f, i) => run.anim(f, [{ translate: `${spots[i][0]}px ${spots[i][1]}px`, transform: 'none', opacity: 1 }, { translate: '0px 0px', transform: `scale(.42) rotate(${spots[i][2] * 3}deg)`, opacity: .2 }], { duration: rm ? 120 : 460, delay: i * 45 * k, easing: 'cubic-bezier(.55,0,.85,.4)' }));
  await run.wait(520 * k);
  fz.forEach(f => { f.style.visibility = 'hidden'; });
  run.show(orb);
  const c = fxAt(st, orb);
  fxShake(st, 3, 200, o); fxShards(st, run, c.x, c.y, 10, ['var(--fx-edge)', col], .7);
  run.anim(orb, [{ scale: .3, opacity: 0 }, { scale: 1.08, opacity: 1, offset: .6 }, { scale: 1, opacity: 1 }], { duration: rm ? 100 : 300, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
  const spin = run.anim(orb, [{ rotate: '0deg' }, { rotate: '360deg' }], { duration: 640, iterations: Infinity, fill: 'none' });
  // 四、墨团打转，一下比一下紧（期待段）
  for (let i = 0; i < 3; i++) {
    run.snd('crack', i + 1); fxRing(st, run, c.x, c.y, 150 + i * 30, col);
    run.anim(orb, [{ transform: 'scale(1)' }, { transform: `scale(${1.06 + i * .04})` }, { transform: 'scale(1)' }], { duration: 160 });
    await run.wait((220 - i * 40) * k);
  }
  if (spin) spin.pause();
  await run.wait(rm ? 0 : 85);   // 顿帧
  if (spin) spin.cancel();
  // 五、炸开：墨晕一闪、碎墨、金箔、震屏，新外貌弹出
  run.anim(orb, [{ scale: 1, opacity: 1 }, { scale: 1.7, opacity: 0 }], { duration: 280, easing: 'ease-out' });
  fxBloom(st, run, c.x, c.y, 320 + r * 30, col, .55, 900, o);
  fxShards(st, run, c.x, c.y, 16, ['var(--fx-edge)', 'var(--fx-silk2)', col], 1.3);
  fxFlakes(st, run, c.x, c.y, [0, 0, 6, 10, 18, 24, 34][r], r >= 4 ? ['var(--fx-gold)', 'var(--fx-gold2)', col] : [col, 'var(--fx-gold)'], 1);
  if (big) { fxDrops(st, run, c.x, c.y, 12, 'var(--zhu)', 1.2); fxWash(st, run, r >= 6 ? ['var(--fx-w4a)', 'var(--fx-w4b)'] : ['var(--fx-w3a)', 'var(--fx-w3b)'], false); }
  fxShake(st, [0, 0, 3, 4, 5, 7, 9][r], 300, o);
  run.snd('rarity' + [0, 0, 0, 1, 2, 4, 4][r]);
  run.show(card);
  run.anim(card, [{ transform: 'scale(.5)', opacity: 0, easing: 'cubic-bezier(.2,.9,.3,1.25)' }, { transform: 'translateY(-14px) scale(1.05)', opacity: 1, offset: .5, easing: 'cubic-bezier(.3,0,.2,1)' }, { transform: 'none', opacity: 1 }], { duration: rm ? 160 : 520 });
  await run.wait(380 * k);
  // 六、盖转数印
  run.show(q('.fx-bigseal')); run.snd('seal');
  await run.wait(rm ? 0 : 200);
  fxShake(st, 4, 200, o);
  const s = fxAt(st, q('.fx-bigseal')); fxDrops(st, run, s.x, s.y, 7, 'var(--zhu)', .6);
  run.show(q('.fx-rkn'));
  return fxClose(st, run, o, '点击收下');
}

// ---------- 8. 音色（WebAudio 合成；古琴拨弦、磬、编钟、锣、木鱼、钱币）----------
const FX_QIN = [130.8, 146.8, 164.8, 196, 220, 261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784, 880];   // 宫商角徵羽
const FX_BUF = new WeakMap();
const FX_QING = [[1, 1, 1], [2.76, .42, .55], [5.4, .18, .3], [8.93, .08, .2]];                               // 磬：石片的非谐泛音
const FX_ZHONG = [[.5, .3, 1.3], [1, 1, 1], [1.19, .45, .8], [1.5, .28, .7], [2, .26, .6], [2.98, .12, .4], [4.1, .06, .3]];   // 编钟
function fxBufs(ctx) { let m = FX_BUF.get(ctx); if (!m) FX_BUF.set(ctx, m = { ks: {} }); return m; }
function fxNoiseBuf(ctx) {
  const m = fxBufs(ctx); if (m.noise) return m.noise;
  const len = ctx.sampleRate | 0, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return (m.noise = b);
}
function fxKs(ctx, f) {   // Karplus-Strong 拨弦（与 ui.js 的琴声同一算法）
  const m = fxBufs(ctx), key = Math.round(f); if (m.ks[key]) return m.ks[key];
  const sr = ctx.sampleRate, len = Math.floor(sr * 1.8), buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0), N = Math.max(2, Math.round(sr / f)), ring = new Float32Array(N);
  for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
  for (let i = 0, j = 0; i < len; i++) { const nx = (j + 1) % N, v = ring[j]; d[i] = v * (i < 40 ? i / 40 : 1); ring[j] = 0.4985 * (v + ring[nx]); j = nx; }
  return (m.ks[key] = buf);
}
function fxPluck(ctx, t, out, f, vol = .28, lp = 2400) {
  const s = ctx.createBufferSource(), g = ctx.createGain(), l = ctx.createBiquadFilter();
  s.buffer = fxKs(ctx, f); l.type = 'lowpass'; l.frequency.value = lp; g.gain.value = vol; s.connect(l).connect(g).connect(out); s.start(t);
}
function fxTone(ctx, t, out, f, vol, dur, type = 'sine', f2) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, vol), t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + .03);
}
const fxBell = (ctx, t, out, f0, vol, dur, parts) => parts.forEach(([r, a, d = 1]) => fxTone(ctx, t, out, f0 * r, vol * a, dur * d));
function fxNz(ctx, t, out, dur, type, freq, vol, q = 1, f2) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = fxNoiseBuf(ctx); f.type = type; f.frequency.setValueAtTime(freq, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur); f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f).connect(g).connect(out); s.start(t, Math.random() * .5); s.stop(t + dur + .03);
}
function fxGong(ctx, t, out, vol = .6, f0 = 180, dur = 2.6) {   // 锣：一槌下去先闷后亮，音高往下走
  fxNz(ctx, t, out, .12, 'lowpass', 1400, vol * .45);
  [1, 1.47, 1.98, 2.52, 3.11, 3.74, 4.38, 5.2].forEach((r, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = f0 * r * (1 + (Math.random() - .5) * .01), a = vol * .2 / (1 + i * .45), sw = i > 2 ? .1 + i * .03 : .006;
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * .955, t + dur * .7);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(a, t + sw); g.gain.exponentialRampToValueAtTime(.0001, t + dur * (1 - i * .07));
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + .05);
  });
}
export const SFX = {
  coin: (c, t, o) => { fxBell(c, t, o, 2350, .11, .35, [[1, 1], [1.51, .6], [2.37, .35]]); fxBell(c, t + .045, o, 2780, .05, .3, [[1, 1], [1.51, .5]]); },
  reelTick: (c, t, o) => { fxNz(c, t, o, .02, 'bandpass', 2400, .5, 4); fxTone(c, t, o, 1250, .05, .03); },
  reelStop: (c, t, o, k = 0) => { fxTone(c, t, o, 540 * (1 + .12 * (k || 0)), .3, .1); fxNz(c, t, o, .035, 'bandpass', 1300, .26, 2.5); fxTone(c, t, o, 150, .18, .14, 'sine', 70); },
  jackpot: (c, t, o) => { fxGong(c, t, o, .7, 170, 2.8); for (let i = 0; i < 7; i++) SFX.coin(c, t + .08 + i * .07 + Math.random() * .03, o); [5, 7, 9, 12].forEach((n, i) => fxPluck(c, t + .05 + i * .06, o, FX_QIN[n], .2)); },
  crack: (c, t, o, k = 0) => { let tt = t; for (let i = 0; i < 5; i++) { fxNz(c, tt, o, fxR(.006, .016), 'highpass', fxR(2800, 4800), fxR(.16, .32)); tt += fxR(.006, .024); } fxTone(c, t, o, 260 * Math.pow(1.122, k || 0), .13, .07); },
  rarity0: (c, t, o) => fxBell(c, t, o, 587, .11, .9, FX_QING),
  rarity1: (c, t, o) => { fxBell(c, t, o, 587, .1, .9, FX_QING); fxBell(c, t + .1, o, 784, .1, 1.1, FX_QING); },
  rarity2: (c, t, o) => { [587, 784, 880].forEach((f, i) => fxBell(c, t + i * .08, o, f, .1, 1.2, FX_QING)); fxBell(c, t + .24, o, 1175, .06, 1.6, FX_ZHONG); },
  rarity3: (c, t, o) => { fxGong(c, t, o, .35, 210, 2); fxBell(c, t, o, 294, .15, 2.4, FX_ZHONG); fxBell(c, t + .02, o, 440, .11, 2.2, FX_ZHONG); [7, 9, 11, 13].forEach((n, i) => fxPluck(c, t + .12 + i * .07, o, FX_QIN[n], .2)); },
  rarity4: (c, t, o) => { fxGong(c, t, o, .8, 160, 3.2); [262, 330, 392].forEach((f, i) => fxBell(c, t + .04 + i * .05, o, f, .12, 2.8, FX_ZHONG)); [5, 7, 9, 10, 12, 14].forEach((n, i) => fxPluck(c, t + .1 + i * .06, o, FX_QIN[n], .22)); for (let i = 0; i < 6; i++) SFX.coin(c, t + .45 + i * .09, o); },
  levelUp: (c, t, o) => { [0, 2, 4, 5, 7, 9, 12].forEach((n, i) => fxPluck(c, t + i * .055, o, FX_QIN[n], .27)); fxGong(c, t + .42, o, .55, 190, 2.4); },
  toast: (c, t, o, k = 0) => { fxBell(c, t, o, 1318 * (k === 2 ? 1.122 : 1), .07, .7, FX_QING); fxBell(c, t + .07, o, 1760, .045, .6, FX_QING); },
  chestThud: (c, t, o, k = 0) => { fxTone(c, t, o, 96, .5, .2, 'sine', 42); fxNz(c, t, o, .07, 'bandpass', 380, .3, 1.2); fxNz(c, t + .045, o, .02, 'bandpass', 3200, .07 + .02 * Math.min(k || 0, 3), 6); },
  seal: (c, t, o) => { fxTone(c, t, o, 190, .3, .09, 'sine', 90); fxNz(c, t, o, .05, 'lowpass', 1100, .25); },
  miss: (c, t, o) => { fxPluck(c, t, o, FX_QIN[7], .22, 1600); fxPluck(c, t + .14, o, FX_QIN[5], .18, 1200); },
  unlock: (c, t, o) => { [5, 7, 9].forEach((n, i) => fxPluck(c, t + i * .09, o, FX_QIN[n], .25)); fxBell(c, t + .27, o, 1175, .07, 1.2, FX_QING); },
  whoosh: (c, t, o) => fxNz(c, t, o, .38, 'bandpass', 500, .3, 1.2, 2200),
};
