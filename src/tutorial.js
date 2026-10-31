// 蛊码 GuCode · 新手引导引擎（会碰 DOM）。
// 用法：startTutorial(TUTORIAL_STEPS, { vsc: !!VSC, onStep(i, step), onDone(skipped) })
// 推进方式：点击高亮目标（step.click 选择器，默认等于 sel），或外部调用 tutorialEvent('名字')（step.evt）。
// 集成方需要在对应时机调用 tutorialEvent：pick（选完本命蛊，其实点击已够）、node_done、battle_end、shop_open、formation_swap。
// 第 4 步（第一场斗蛊）必胜并打出杀招由集成方保证；含 quiet:true 的步骤整层引导隐藏，等事件到了再继续（战斗动画里不挡视线）。

// 步骤表：sel=高亮目标；click=点哪里算推进（可选）；evt=外部事件名（可选，数组也行）；quiet=等待时隐藏；text 可以是函数(opts)
// 「布阵」界面的 selector 是占位（主线在加），集成方请对齐：见 formation 步骤。
export const TUTORIAL_STEPS = [
  { id: 'pick', sel: '.starters', click: '.starter', evt: 'pick', text: '三选一，结下你的本命蛊。它是你最先出手的炉口。' },
  { id: 'path', sel: '.nodes', click: '.node', evt: 'path', text: '选一条路。你走的顺序，就是你的流派。' },
  { id: 'feed', sel: '#demo', click: '[data-act="demo"]', evt: 'node_done', text: o => (o.vsc ? '写代码时真实 token 会喂养蛊，节点条走满就结算。你只管写。' : '网页版里点「写代码中」模拟灵流；装了 VS Code 插件，用的就是真实 token。') },
  { id: 'ghost', sel: '[data-act="ghost"]', click: '[data-act="ghost"]', evt: 'ghost_open', text: '节点走完，随时可以斗蛊。点「斗幽灵」。' },
  { id: 'ghostGo', sel: '[data-act="ghostGo"]', click: '[data-act="ghostGo"]', evt: 'battle_start', text: '点第一个「应战」，这一场你会赢，还会打出杀招。' },
  { id: 'battle', sel: null, quiet: true, evt: 'battle_end', text: '' },
  { id: 'shop', sel: '#shop', click: '[data-act="buy"],[data-act="refresh"]', evt: 'shop_open', text: '蛊市开了：买蛊、转市，三只同种合炼升星。' },
  { id: 'formation', sel: '[data-act="formation"]', click: '[data-act="formation"]', evt: 'formation_swap', text: '拖拽蛊换位。最左的炉口最先出手，站位就是战术。' },
];

const TUT_CSS = `
#tut-layer{position:fixed;inset:0;z-index:1000;pointer-events:none;font-family:var(--sans,system-ui,sans-serif)}
#tut-layer[hidden]{display:none}
#tut-layer .tb{position:fixed;background:rgba(12,10,7,.66);pointer-events:auto}
#tut-layer.nohole .tb{inset:0!important;width:auto!important;height:auto!important;background:rgba(12,10,7,.5);pointer-events:none}
#tut-ring{position:fixed;border-radius:6px;pointer-events:none;box-shadow:0 0 0 2px var(--gold,#d9a441),0 0 14px 2px var(--gold,#d9a441);transition:left .22s ease,top .22s ease,width .22s ease,height .22s ease}
#tut-layer.nohole #tut-ring{display:none}
#tut-bub{position:fixed;z-index:1;width:min(300px,calc(100vw - 24px));box-sizing:border-box;padding:12px 14px 10px;border-radius:6px;pointer-events:auto;background:var(--paper,#e7ddc7);color:var(--ink,#1c1915);border:1px solid var(--line2,rgba(40,32,24,.34));box-shadow:0 6px 22px var(--shadow,rgba(0,0,0,.45));font-size:14px;line-height:1.55;animation:tutIn .22s cubic-bezier(.2,1.3,.4,1)}
#tut-bub .tt{margin:0 0 8px;font-family:var(--kai,serif);font-size:15px}
#tut-bub .tf{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px}
#tut-bub .tn{color:var(--mu,#5b5244);letter-spacing:.06em}
#tut-bub button{font:inherit;cursor:pointer;border:0;background:none;color:var(--mu,#5b5244);padding:4px 2px;text-decoration:underline;text-underline-offset:3px}
#tut-bub button:hover{color:var(--zhu,#a82a1b)}
#tut-bub .ta{position:absolute;width:10px;height:10px;background:inherit;border:inherit;border-right:0;border-bottom:0;transform:rotate(45deg)}
@keyframes tutIn{from{opacity:0;transform:translateY(6px) scale(.97)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){#tut-bub{animation:none}#tut-ring{transition:none}}
`;

let tutSt = null; // 当前引导状态；null 表示没有在跑

function tutStyle() {
  if (document.getElementById('tut-style')) return;
  const s = document.createElement('style'); s.id = 'tut-style'; s.textContent = TUT_CSS; document.head.appendChild(s);
}
function tutRect(sel) {
  if (!sel) return null;
  let r = null;
  document.querySelectorAll(sel).forEach(n => {
    const b = n.getBoundingClientRect(); if (b.width < 2 || b.height < 2) return;
    r = r ? { l: Math.min(r.l, b.left), t: Math.min(r.t, b.top), r: Math.max(r.r, b.right), b: Math.max(r.b, b.bottom) } : { l: b.left, t: b.top, r: b.right, b: b.bottom };
  });
  return r;
}
function tutPlace() {
  const T = tutSt; if (!T) return;
  const step = T.steps[T.i], L = T.layer; if (!step) return;
  if (step.quiet) { L.hidden = true; return; }
  L.hidden = false;
  const rc = tutRect(step.sel), vw = window.innerWidth, vh = window.innerHeight, pad = 6;
  const blk = L.querySelectorAll('.tb'), bub = T.bub, ring = T.ring;
  if (!rc) {
    L.classList.add('nohole'); // 找不到目标（或步骤没有目标）：整层半透明 + 居中气泡，不卡死
    bub.style.left = Math.max(12, (vw - bub.offsetWidth) / 2) + 'px'; bub.style.top = Math.max(12, vh * 0.62) + 'px'; bub.querySelector('.ta').style.display = 'none';
    return;
  }
  L.classList.remove('nohole');
  const x0 = Math.max(0, rc.l - pad), y0 = Math.max(0, rc.t - pad), x1 = Math.min(vw, rc.r + pad), y1 = Math.min(vh, rc.b + pad);
  const set = (e, l, t, w, h) => { e.style.left = l + 'px'; e.style.top = t + 'px'; e.style.width = Math.max(0, w) + 'px'; e.style.height = Math.max(0, h) + 'px'; };
  set(blk[0], 0, 0, vw, y0); set(blk[1], 0, y1, vw, vh - y1); set(blk[2], 0, y0, x0, y1 - y0); set(blk[3], x1, y0, vw - x1, y1 - y0);
  set(ring, x0, y0, x1 - x0, y1 - y0);
  const bw = bub.offsetWidth, bh = bub.offsetHeight, below = vh - y1 >= bh + 20 || y0 < bh + 20;
  const bt = below ? Math.min(vh - bh - 8, y1 + 12) : Math.max(8, y0 - bh - 12), bl = Math.min(vw - bw - 12, Math.max(12, (x0 + x1) / 2 - bw / 2));
  bub.style.left = bl + 'px'; bub.style.top = bt + 'px';
  const ar = bub.querySelector('.ta'); ar.style.display = ''; ar.style.left = Math.min(bw - 22, Math.max(12, (x0 + x1) / 2 - bl - 5)) + 'px';
  if (below) { ar.style.top = '-6px'; ar.style.bottom = ''; ar.style.transform = 'rotate(45deg)'; } else { ar.style.bottom = '-6px'; ar.style.top = ''; ar.style.transform = 'rotate(225deg)'; }
}
function tutRender() {
  const T = tutSt; if (!T) return;
  const step = T.steps[T.i], txt = typeof step.text === 'function' ? step.text(T.opts) : step.text;
  T.bub.querySelector('.tt').textContent = txt; T.bub.querySelector('.tn').textContent = `${T.i + 1} / ${T.steps.length}`;
  T.bub.style.animation = 'none'; void T.bub.offsetWidth; T.bub.style.animation = '';
  tutPlace(); if (T.opts.onStep) T.opts.onStep(T.i, step);
}
function tutGo(i) {
  const T = tutSt; if (!T) return;
  if (i >= T.steps.length) return tutEnd(false);
  T.i = i; tutRender();
}
function tutEnd(skipped) {
  const T = tutSt; if (!T) return; tutSt = null;
  document.removeEventListener('click', T.onClick, true); window.removeEventListener('resize', T.onPos); window.removeEventListener('scroll', T.onPos, true); clearInterval(T.timer);
  T.layer.remove(); if (T.opts.onDone) T.opts.onDone(!!skipped);
}
export function startTutorial(steps, opts) {
  opts = opts || {}; if (tutSt) tutEnd(true); tutStyle();
  const layer = document.createElement('div'); layer.id = 'tut-layer';
  layer.innerHTML = '<i class="tb"></i><i class="tb"></i><i class="tb"></i><i class="tb"></i><div id="tut-ring"></div><div id="tut-bub" role="dialog" aria-live="polite"><i class="ta"></i><p class="tt"></p><div class="tf"><span class="tn"></span><button type="button" data-tut="skip">跳过引导</button></div></div>';
  document.body.appendChild(layer);
  const T = tutSt = { steps, i: 0, opts, layer, bub: layer.querySelector('#tut-bub'), ring: layer.querySelector('#tut-ring') };
  T.onPos = () => tutPlace();
  // 点击目标推进：捕获阶段监听，但不拦截——点击照常传给按钮本身，下一帧再换步骤
  T.onClick = e => {
    if (!tutSt) return; const step = steps[T.i], t = e.target;
    if (t.closest && t.closest('#tut-bub')) { if (t.closest('[data-tut="skip"]')) tutEnd(true); return; }
    const sel = step.click || step.sel; if (sel && t.closest && t.closest(sel)) { const k = T.i; setTimeout(() => { if (tutSt && tutSt.i === k) tutGo(k + 1); }, 0); }
  };
  document.addEventListener('click', T.onClick, true); window.addEventListener('resize', T.onPos); window.addEventListener('scroll', T.onPos, true);
  T.timer = setInterval(tutPlace, 400); // 目标是动态渲染的：定时重算位置
  tutGo(0);
  return { stop: () => tutEnd(true), next: () => tutGo(T.i + 1), get index() { return T.i; } };
}
// 外部事件推进：事件名与当前步骤的 evt 一致才前进
export function tutorialEvent(name) {
  const T = tutSt; if (!T) return false; const step = T.steps[T.i], ev = step && step.evt;
  if (ev && (Array.isArray(ev) ? ev.includes(name) : ev === name)) { tutGo(T.i + 1); return true; }
  return false;
}
export const tutorialActive = () => !!tutSt;
export const tutorialSkip = () => tutEnd(true);
