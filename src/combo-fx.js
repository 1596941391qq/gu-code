// 蛊码 GuCode · 杀招动画。每个杀招一份「配方」：几层基础特效（火浪、雷霆、剑雨、毒雾、金钟罩、残影、漩涡、冰封、血流、风刃、地刺、光柱……）
// 按时间叠起来，加镜头（推、拉、摇、震）和逐笔写出的招式名。画面是时间的纯函数：同一时刻画出来永远一样，所以总览图能直接按关键帧画。
// 对外：playCombo(stage, o) → Promise；comboSheet(el, o) 画总览；COMBO_FX 配方表。
const TAU = Math.PI * 2;
const cl = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const eo = t => 1 - Math.pow(1 - t, 3), ei = t => t * t * t, eio = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const env = (p, a, b) => cl(p < a ? p / a : p > 1 - b ? (1 - p) / b : 1);
function rngOf(seed) { let s = seed >>> 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hashOf = str => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rgba = (h, a) => { if (!h || h[0] !== '#') return h || 'rgba(0,0,0,0)'; let n = h.slice(1); if (n.length === 3) n = n.replace(/./g, '$&$&'); const v = parseInt(n, 16); return `rgba(${v >> 16 & 255},${v >> 8 & 255},${v & 255},${cl(a)})`; };
const C = (R, v, i = 0) => typeof v === 'string' ? v : (R.c[v == null ? i : v] || R.c[R.c.length - 1]);
let KAI = '"Kaiti SC","STKaiti","KaiTi","BiauKai",serif';
const kaiFont = () => { try { const v = getComputedStyle(document.documentElement).getPropertyValue('--kai').trim(); if (v) KAI = v; } catch (e) { /* 没有样式表时用默认楷体 */ } return KAI; };

// ---------- 场景锚点 ----------
const cen = (L, S) => L && L.length ? { x: L.reduce((a, t) => a + t.x, 0) / L.length, y: L.reduce((a, t) => a + t.y, 0) / L.length } : { x: S.w * (S.dir > 0 ? 0.72 : 0.28), y: S.h * 0.55 };
function pts(S, k) {
  const byFront = () => S.foes.slice().sort((a, b) => Math.abs(a.x - S.w / 2) - Math.abs(b.x - S.w / 2));
  switch (k) {
    case 'from': return [S.from];
    case 'tg': return [S.targets[0] || cen(S.foes, S)];
    case 'tgs': return S.targets.length ? S.targets : S.foes;
    case 'foes': return S.foes;
    case 'allies': return S.allies;
    case 'foeC': return [cen(S.foes, S)];
    case 'allyC': return [cen(S.allies, S)];
    case 'mid': return [{ x: S.w / 2, y: S.h * 0.52 }];
    case 'front': return byFront().slice(0, 1);
    case 'front2': return byFront().slice(0, 2);
    case 'frontCol': { const f = byFront()[0]; return f ? S.foes.filter(t => Math.abs(t.x - f.x) < S.u * 0.3) : []; }   // 敌方最前那一列
    case 'foeBack': return byFront().slice(-1);
    case 'ally': return [S.allies.find(a => a !== S.from && (a.x !== S.from.x || a.y !== S.from.y)) || S.from];
    default: return [S.from];
  }
}
const pt1 = (S, k) => pts(S, k)[0] || S.from;

// ---------- 画笔小工具 ----------
function fillAll(g, S, c, a) { if (a <= 0) return; g.fillStyle = rgba(c, a); g.fillRect(-S.w, -S.h, S.w * 3, S.h * 3); }
function radial(g, x, y, r, col, a) { if (r <= 0.5 || a <= 0) return; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
function line(g, L) { g.beginPath(); L.forEach((q, i) => i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); }
// 毛笔：沿折线一路盖圆点，两头收锋；p0..p1 只画其中一段（用来做「一笔一笔写出来」）
function brush(g, P, w, col, a = 1, p0 = 0, p1 = 1, taper = 0.5) {
  if (p1 <= p0 || P.length < 2 || a <= 0) return;
  const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y));
  const tot = L[L.length - 1]; if (!tot) return; const step = Math.max(0.8, w * 0.22); let j = 1;
  g.fillStyle = rgba(col, a); g.beginPath();
  for (let d = p0 * tot; d <= p1 * tot; d += step) {
    while (j < L.length - 1 && L[j] < d) j++;
    const f = (d - L[j - 1]) / (L[j] - L[j - 1] || 1), x = lerp(P[j - 1].x, P[j].x, f), y = lerp(P[j - 1].y, P[j].y, f), u = d / tot;
    const r = w / 2 * (taper ? Math.pow(Math.max(0.06, Math.sin(Math.PI * u)), taper) : 1);
    g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU);
  }
  g.fill();
}
const qbez = (a, b, c, t) => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * b.x + t * t * c.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * b.y + t * t * c.y });
// 折线抖动：固定消耗 n-1 次随机数，保证每一帧同一条闪电长得一样
function jag(a, b, n, amp, r) { const L = [a], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len; for (let i = 1; i < n; i++) { const t = i / n, o = (r() - 0.5) * 2 * amp; L.push({ x: a.x + dx * t + nx * o, y: a.y + dy * t + ny * o }); } L.push(b); return L; }
function wav(x0, y0, x1, y1, n, amp, r) { const L = []; for (let i = 0; i <= n; i++) { const t = i / n; L.push({ x: lerp(x0, x1, t), y: lerp(y0, y1, t) + (r() - 0.5) * 2 * amp }); } return L; }
function flame(g, x, y, w, h, c1, c2, a) { if (h < 1 || a <= 0) return; const gr = g.createLinearGradient(x, y, x, y - h); gr.addColorStop(0, rgba(c2, a)); gr.addColorStop(0.5, rgba(c1, a * 0.8)); gr.addColorStop(1, rgba(c1, 0)); g.fillStyle = gr; g.beginPath(); g.moveTo(x - w / 2, y); g.quadraticCurveTo(x - w * 0.6, y - h * 0.5, x, y - h); g.quadraticCurveTo(x + w * 0.6, y - h * 0.5, x + w / 2, y); g.closePath(); g.fill(); }
function star(g, x, y, s, col, a) { if (s <= 0 || a <= 0) return; g.fillStyle = rgba(col, a); g.beginPath(); for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4 - Math.PI / 2, rr = k % 2 ? s * 0.28 : s; k ? g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr) : g.moveTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); } g.closePath(); g.fill(); }
function hex(g, x, y, s) { g.beginPath(); for (let k = 0; k <= 6; k++) { const an = k * TAU / 6; k ? g.lineTo(x + Math.cos(an) * s, y + Math.sin(an) * s * 0.6) : g.moveTo(x + Math.cos(an) * s, y + Math.sin(an) * s * 0.6); } g.stroke(); }
function bug(g, x, y, s, col, a, dir = 1) {
  if (a <= 0.01) return; g.save(); g.translate(x, y); g.scale(dir, 1); g.fillStyle = rgba(col, a); g.strokeStyle = rgba(col, a); g.lineWidth = Math.max(1, s * 0.035);
  g.beginPath(); g.ellipse(-s * 0.05, 0, s * 0.32, s * 0.2, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(s * 0.3, -s * 0.04, s * 0.12, 0, TAU); g.fill();
  g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(k * s * 0.12, s * 0.1); g.lineTo(k * s * 0.16 - s * 0.05, s * 0.28); } g.moveTo(s * 0.38, -s * 0.1); g.lineTo(s * 0.5, -s * 0.26); g.stroke(); g.restore();
}
function ant(g, x, y, s, col, a, dir = 1) { g.save(); g.translate(x, y); g.scale(dir, 1); g.fillStyle = rgba(col, a); g.strokeStyle = rgba(col, a); g.lineWidth = 1; [[-0.3, 0.16], [0, 0.11], [0.26, 0.12]].forEach(([u, r]) => { g.beginPath(); g.ellipse(u * s, 0, r * s, r * s * 0.75, 0, 0, TAU); g.fill(); }); g.beginPath(); for (let k = -1; k <= 1; k++) { g.moveTo(k * s * 0.08, 0); g.lineTo(k * s * 0.14, s * 0.2); g.moveTo(k * s * 0.08, 0); g.lineTo(k * s * 0.14, -s * 0.2); } g.stroke(); g.restore(); }
function creature(g, x, y, ang, s, kind, col, a, p) {
  if (a <= 0) return; g.save(); g.translate(x, y); g.rotate(ang); g.strokeStyle = rgba(col, a); g.fillStyle = rgba(col, a); g.lineWidth = 1.4;
  if (kind === 'cent') for (let k = 0; k < 7; k++) { const sx = -k * s * 0.16, sy = Math.sin(p * 30 - k * 0.9) * s * 0.05; g.beginPath(); g.ellipse(sx, sy, s * 0.09, s * 0.06, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(sx, sy - s * 0.05); g.lineTo(sx - s * 0.04, sy - s * 0.15); g.moveTo(sx, sy + s * 0.05); g.lineTo(sx - s * 0.04, sy + s * 0.15); g.stroke(); }
  else { g.beginPath(); g.ellipse(0, 0, s * 0.22, s * 0.12, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-s * 0.2, 0); g.quadraticCurveTo(-s * 0.55, 0, -s * 0.5, -s * 0.25); g.quadraticCurveTo(-s * 0.4, -s * 0.38, -s * 0.28, -s * 0.28); g.moveTo(s * 0.2, -s * 0.06); g.lineTo(s * 0.38, -s * 0.16); g.moveTo(s * 0.2, s * 0.06); g.lineTo(s * 0.38, s * 0.16); g.stroke(); }
  g.restore();
}

// ---------- 招式名：一笔一笔写出来 ----------
// 先把字画到小画布上，按连通的笔画块分开（先上后下、先左后右），每块从左上角起笔、沿着笔画内部的距离往外长，
// 这样一横是从左往右写，一撇是顺着撇的方向写，拐弯的笔画也会跟着拐。
const NAMES = new Map();
function strokeOrder(A, S) {
  const N = S * S, ink = new Uint8Array(N), lab = new Int32Array(N).fill(-1), d = new Float32Array(N).fill(-1), v = new Float32Array(N).fill(2), q = new Int32Array(N), comps = [];
  for (let i = 0; i < N; i++) ink[i] = A[i] > 90 ? 1 : 0;
  const nb = (j, f) => { const x = j % S, y = (j / S) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < S && yy < S) f(yy * S + xx); } };
  for (let i = 0; i < N; i++) {
    if (!ink[i] || lab[i] >= 0) continue;
    let h = 0, t = 0, best = i, bk = 1e9; const px = [], id = comps.length; q[t++] = i; lab[i] = id;
    while (h < t) { const j = q[h++]; px.push(j); const k = ((j / S) | 0) + (j % S) * 0.6; if (k < bk) { bk = k; best = j; } nb(j, n => { if (ink[n] && lab[n] < 0) { lab[n] = id; q[t++] = n; } }); }
    comps.push({ px, start: best, key: ((best / S) | 0) + (best % S) * 0.5 });
  }
  comps.sort((a, b) => a.key - b.key);
  let total = 0;
  comps.forEach(c => { let h = 0, t = 0, mx = 0; q[t++] = c.start; d[c.start] = 0; while (h < t) { const j = q[h++]; nb(j, n => { if (ink[n] && d[n] < 0) { d[n] = d[j] + 1; if (d[n] > mx) mx = d[n]; q[t++] = n; } }); } c.off = total; c.len = mx + 1; total += c.len + 3; });
  total = Math.max(1, total);
  comps.forEach(c => c.px.forEach(j => { v[j] = (c.off + d[j]) / total; }));
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) { if (!A[i] || v[i] <= 1) continue; let m = 2; nb(i, n => { if (v[n] < m) m = v[n]; }); if (m <= 1) v[i] = m; }
  for (let i = 0; i < N; i++) if (A[i] && v[i] > 1) v[i] = 1;
  return { v, len: total };
}
function prepName(name, size) {
  const key = name + '|' + size; if (NAMES.has(key)) return NAMES.get(key);
  const font = kaiFont(), S = Math.ceil(size * 1.18), chars = [];
  for (const ch of name) {
    const cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d', { willReadFrequently: true });
    g.font = `${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(ch, S / 2, S / 2 + size * 0.03);
    const raw = g.getImageData(0, 0, S, S).data, A = new Uint8Array(S * S); for (let i = 0; i < S * S; i++) A[i] = raw[i * 4 + 3];
    const o = strokeOrder(A, S); chars.push({ cv, g, A, v: o.v, len: o.len, img: g.createImageData(S, S), t: -1 });
  }
  const o = { chars, S, size }; NAMES.set(key, o); if (NAMES.size > 80) NAMES.delete(NAMES.keys().next().value); return o;
}
function renderChar(c, t) {
  if (c.t === t) return; c.t = t; const { A, v, img } = c, D = img.data;
  for (let i = 0; i < A.length; i++) { const a = A[i], k = i * 4; if (!a) { D[k + 3] = 0; continue; } const m = cl((t - v[i]) / 0.03); D[k] = 26; D[k + 1] = 22; D[k + 2] = 18; D[k + 3] = a * m; }
  c.g.putImageData(img, 0, 0);
}
const nameSize = (S, n) => Math.round(Math.max(18, Math.min(S.w > 500 ? 56 : 48, S.w * 0.82 / (n * 1.015 + 1.25))));
function nameTimes(R, n) { const nm = R.nm, wd = 140 * n + 260, seal = nm + 120 + wd; return { nm, wd, seal, total: Math.max(R.dur, seal + 600) }; }
function drawName(g, NM, cx, cy, T, TL, R) {
  if (T < TL.nm) return;
  const { chars, S, size } = NM, n = chars.length, W = n * S * 0.86 + size * 1.25, H = size * 1.42;
  const strip = eo(cl((T - TL.nm) / 180)), write = cl((T - TL.nm - 120) / TL.wd), seal = cl((T - TL.seal) / 220), a = cl((TL.total - T) / 260);
  const sw = W * strip; if (sw < 2 || a <= 0) return;
  g.save(); g.globalAlpha = a;
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(cx - sw / 2 + 3, cy - H / 2 + 4, sw, H);
  const r = rngOf(hashOf(R.id) + 5); g.fillStyle = '#efe6d0'; g.beginPath();
  for (let i = 0; i <= 12; i++) { const x = cx - sw / 2 + sw * i / 12; g[i ? 'lineTo' : 'moveTo'](x, cy - H / 2 + r() * 3); }
  for (let i = 12; i >= 0; i--) { const x = cx - sw / 2 + sw * i / 12; g.lineTo(x, cy + H / 2 - r() * 3); }
  g.closePath(); g.fill();
  if (R.adv) { g.strokeStyle = '#c99a3a'; g.lineWidth = 2; g.strokeRect(cx - sw / 2 + 4, cy - H / 2 + 5, sw - 8, H - 10); }
  g.beginPath(); g.rect(cx - sw / 2, cy - H / 2, sw, H); g.clip();
  const tot = chars.reduce((s, c) => s + c.len, 0); let acc = 0, x = cx - W / 2 + size * 0.3;
  chars.forEach(c => { renderChar(c, cl((write * tot - acc) / c.len)); acc += c.len; g.drawImage(c.cv, x, cy - S / 2); x += S * 0.86; });
  if (seal > 0) {
    const s = size * 0.6, k = 1 + 0.8 * (1 - eo(seal)); g.save(); g.translate(cx + W / 2 - size * 0.55, cy + size * 0.12); g.scale(k, k); g.rotate(-0.06); g.globalAlpha = a * cl(seal * 2);
    g.fillStyle = '#b5301f'; g.fillRect(-s / 2, -s / 2, s, s); g.fillStyle = '#efe6d0'; g.font = `${Math.round(s * 0.72)}px ${KAI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(R.seal || '杀', 0, s * 0.04); g.restore();
  }
  g.restore();
}

// ---------- 基础特效（每个都是 (画笔, 进度 0..1, 参数, 场景, 配方, 随机数) → 画一帧） ----------
// 随机数每一帧都从同一个种子重新开始，所以粒子位置只跟进度有关；循环里随机数要在 continue 之前取完。
const PR = {
  dim(g, p, P, S) { fillAll(g, S, P.c || '#07060a', (P.a ?? 0.4) * env(p, 0.12, 0.2)); },
  flash(g, p, P, S) { const n = P.n || 1, q = p * n, k = Math.floor(q); if (k >= n) return; fillAll(g, S, P.c || '#ffffff', (P.a ?? 0.8) * (S.reduce ? 0.15 : 1) * Math.pow(1 - (q - k), 2)); },
  mono(g, p, P, S) { const a = env(p, 0.04, 0.15); fillAll(g, S, '#7a7a7a', 0.22 * a); if (a > 0.5) S.mono = 1; },
  split(g, p, P, S, R) {
    const a = (P.a ?? 0.3) * env(p, 0.2, 0.25), m = S.w / 2;
    g.fillStyle = rgba(C(R, P.c, 0), a); g.fillRect(-S.w, -S.h, m + S.w, S.h * 3); g.fillStyle = rgba(C(R, P.c2, 1), a); g.fillRect(m, -S.h, S.w * 2, S.h * 3);
    brush(g, [{ x: m, y: -10 }, { x: m, y: S.h + 10 }], 3, '#ffffff', a * 2, 0, eo(cl(p * 3)), 0);
  },
  // 力：火影冲阵
  charge(g, p, P, S, R, r) {
    const n = P.n || 3, gap = P.gap ?? 0.15, len = P.len ?? 0.4, L = pts(S, P.at || 'tgs');
    for (let i = 0; i < n; i++) {
      const t = L[i % L.length], jit = r(), lp = (p - i * gap) / len; if (lp < 0 || lp > 1.3) continue;
      const xa = S.dir > 0 ? -S.u : S.w + S.u, xb = S.dir > 0 ? S.w + S.u : -S.u, y = t.y + (jit - 0.5) * S.u * 0.3, hx = lerp(xa, xb, eio(cl(lp))), fade = cl(1.3 - lp);
      for (let k = 12; k >= 0; k--) { const x = hx - S.dir * k * S.u * 0.18; g.fillStyle = rgba(k < 4 ? C(R, P.c2, 1) : C(R, P.c, 0), (1 - k / 13) * 0.7 * fade); g.beginPath(); g.ellipse(x, y - k * 0.6, S.u * (0.32 - k * 0.018), S.u * (0.2 - k * 0.01), 0, 0, TAU); g.fill(); }
      bug(g, hx, y, S.u * 0.7, '#1c1915', 0.85 * fade, S.dir);
    }
  },
  scorch(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'tgs'), n = P.n || 3, a = env(p, 0.1, 0.25) * 0.55;
    for (let i = 0; i < n; i++) { const t = L[i % L.length], y = t.y + S.u * 0.4 + (r() - 0.5) * 6, x0 = S.w * (S.dir > 0 ? 0.52 : 0.48), x1 = S.dir > 0 ? S.w - 4 : 4; brush(g, wav(x0, y, x1, y, 6, 2, r), S.u * 0.12, P.c || '#2a1a10', a, 0, eo(cl(p * 2.5 - i * 0.2)), 0.4); }
  },
  drum(g, p, P, S, R) {
    const A = pt1(S, P.at || 'mid'), s0 = (P.s || 1.3) * S.u, appear = eo(cl(p / 0.25)); let pulse = 0;
    (P.beats || [0.35, 0.6, 0.78]).forEach(b => { if (p >= b) pulse = Math.max(pulse, Math.exp(-(p - b) * 18)); });
    const s = s0 * (0.35 + 0.65 * appear) * (1 + 0.14 * pulse), y = A.y - (P.lift ?? 1.1) * S.u;
    g.save(); g.globalAlpha = env(p, 0.08, 0.15); g.translate(A.x, y); g.fillStyle = C(R, P.c, 0); g.strokeStyle = '#1c1915'; g.lineWidth = Math.max(1.5, s * 0.05);
    g.beginPath(); g.moveTo(-s / 2, 0); g.lineTo(-s / 2, s * 0.45); g.ellipse(0, s * 0.45, s / 2, s * 0.16, 0, Math.PI, 0, true); g.lineTo(s / 2, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#efe6d0'; g.beginPath(); g.ellipse(0, 0, s / 2, s * 0.16, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#1c1915'; for (let k = 0; k < 7; k++) { const an = Math.PI * (k + 0.5) / 7; g.beginPath(); g.arc(Math.cos(an) * s * 0.49, s * 0.1 + Math.sin(an) * s * 0.06, s * 0.025, 0, TAU); g.fill(); }
    if (pulse > 0.05) { g.fillStyle = rgba('#ffffff', 0.7 * pulse); g.beginPath(); g.ellipse(0, 0, s * 0.4, s * 0.12, 0, 0, TAU); g.fill(); }
    g.restore();
  },
  rings(g, p, P, S, R) {
    const A = pt1(S, P.at || 'allyC'), Rm = (P.R || 3) * S.u, col = C(R, P.c, 1);
    (P.ts || [0.35, 0.6, 0.78]).forEach(b => { const q = (p - b) / (P.life || 0.3); if (q < 0 || q > 1) return; const rr = lerp(S.u * 0.3, Rm, eo(q)); g.strokeStyle = rgba(col, (1 - q) * 0.85); g.lineWidth = lerp(S.u * 0.16, 1, q); g.beginPath(); g.ellipse(A.x, A.y + S.u * 0.3, rr, rr * (P.flat ?? 0.42), 0, 0, TAU); g.stroke(); });
  },
  glow(g, p, P, S, R) {
    const L = pts(S, P.at || 'allies'), a = env(p, 0.25, 0.3), col = C(R, P.c, 0);
    L.forEach((t, i) => {
      const q = cl(p * 2 - i * 0.1); g.save(); g.globalCompositeOperation = 'lighter'; radial(g, t.x, t.y, S.u * 0.75, col, 0.55 * a * q); g.restore();
      if (P.stripe) brush(g, [{ x: t.x - S.u * 0.3, y: t.y + S.u * 0.2 }, { x: t.x + S.u * 0.3, y: t.y - S.u * 0.3 }], S.u * 0.08, col, a, 0, q);
    });
  },
  swarm(g, p, P, S, R, r) {
    const n = P.n || 160, c = C(R, P.c, 1), fc = P.burn ? '#f0a040' : null;
    const st = P.start === 'br' ? { x: S.w + 20, y: S.h + 10 } : { x: S.dir > 0 ? -20 : S.w + 20, y: S.h * 0.8 }, en = { x: S.dir > 0 ? S.w + 40 : -40, y: S.h * 0.25 }, mid = cen(S.foes, S);
    if (P.start === 'br') en.x = -40;
    for (let i = 0; i < n; i++) {
      const d = r() * 0.35, ox = (r() - 0.5) * S.u * 2.2, oy = (r() - 0.5) * S.u * 1.4, ph = r() * TAU, sz = 1 + r() * 2, q = p * 1.35 - d; if (q < 0 || q > 1) continue;
      const pos = qbez(st, mid, en, q), x = pos.x + ox * Math.sin(q * Math.PI) + Math.sin(p * 30 + ph) * 3, y = pos.y + oy * Math.sin(q * Math.PI) + Math.cos(p * 26 + ph) * 3;
      g.fillStyle = rgba(fc && q > 0.35 ? fc : c, 0.85); g.fillRect(x, y, sz, sz); if (fc && q > 0.35) radial(g, x, y, 5, '#e2672e', 0.25);
    }
  },
  stain(g, p, P, S, R) { const L = pts(S, P.at || 'foes'), a = (P.a ?? 0.35) * env(p, P.in ?? 0.3, 0.2), col = C(R, P.c, 0), k = P.s || 1; L.forEach(t => { g.fillStyle = rgba(col, a); g.beginPath(); g.ellipse(t.x, t.y + S.u * 0.45, S.u * 0.75 * k, S.u * 0.24 * k, 0, 0, TAU); g.fill(); }); },
  // 炎：火球炸开
  burst(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'tg'), c1 = C(R, P.c, 0), c2 = C(R, P.c2, 1), b = P.b ?? 0.35, n = P.n || 14, Rm = (P.R || 2.4) * S.u, q = (p - b) / (1 - b);
    g.save(); g.globalCompositeOperation = 'lighter';
    if (p < b + 0.05) { const s = S.u * (0.15 + 0.45 * eo(cl(p / b))) * (1 + 0.08 * Math.sin(p * 60)); radial(g, A.x, A.y, s, c1, 0.95); radial(g, A.x, A.y, s * 0.55, '#fff3c0', 0.9); }
    for (let i = 0; i < n; i++) { const ang = (i / n) * TAU + r() * 0.4, len = Rm * (0.6 + 0.5 * r()); if (q <= 0) continue; const L0 = len * eo(cl(q * 2)); brush(g, [A, { x: A.x + Math.cos(ang) * L0, y: A.y + Math.sin(ang) * L0 * 0.6 }], S.u * 0.44 * (1 - q), i % 2 ? c1 : c2, 0.8 * (1 - q), 0, 1, 0.8); }
    g.restore();
  },
  embers(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'foes'), n = P.n || 40, c = C(R, P.c, 1), up = P.up ? -1 : 1;
    for (let i = 0; i < n; i++) { const t = L[i % L.length], ox = (r() - 0.5) * S.u * 2, d = r() * 0.5, sp = 0.5 + r(), q = (p - d) / (1 - d); if (q < 0) continue; const x = t.x + ox + Math.sin(q * 9 + i) * 4, y = t.y + (up < 0 ? S.u * 0.3 : -S.u) + up * q * S.u * 1.8 * sp; g.fillStyle = rgba(c, (1 - q) * 0.9); g.fillRect(x, y, 2, 2); }
  },
  sun(g, p, P, S, R, r) {
    const c = C(R, P.c, 0), x = S.w * (P.x ?? (S.dir > 0 ? 0.72 : 0.28)), rise = P.rise ?? 0.45, y = lerp(S.h * 0.38, S.h * (P.y ?? 0.1), eo(cl(p / rise))), rad = S.u * (P.s || 0.55), a = env(p, 0.05, 0.15);
    g.save(); g.globalCompositeOperation = 'lighter'; radial(g, x, y, rad * 3, c, 0.4 * a); g.restore(); g.fillStyle = rgba('#fff6dc', a); g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    const L = pts(S, 'foes'), n = P.rays || 0;
    for (let i = 0; i < n; i++) { const t = L[i % L.length], ox = (r() - 0.5) * S.u * 1.6, d = rise + r() * (0.85 - rise), lq = (p - d) / 0.12; if (lq < 0 || lq > 1.5) continue; const tx = t.x + ox, ty = t.y + S.u * 0.3; g.strokeStyle = rgba('#fff2c0', 0.9 * cl(1.5 - lq)); g.lineWidth = 1.5; g.beginPath(); g.moveTo(lerp(x, tx, cl(lq - 0.35)), lerp(y, ty, cl(lq - 0.35))); g.lineTo(lerp(x, tx, cl(lq)), lerp(y, ty, cl(lq))); g.stroke(); }
  },
  eclipse(g, p, P, S, R) {
    const x = S.w * 0.62, y = S.h * 0.16, rad = S.u * 0.62, a = env(p, 0.08, 0.15), q = eo(cl(p / 0.45));
    fillAll(g, S, '#020203', 0.5 * a * q); g.fillStyle = rgba('#f4efe0', a * 0.9); g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    g.fillStyle = rgba('#050505', a); g.beginPath(); g.arc(lerp(S.w * 1.1, x, q), lerp(-S.u, y, q), rad, 0, TAU); g.fill();
    if (q > 0.85) { g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(C(R, P.c2, 1), a * (q - 0.85) / 0.15); g.lineWidth = 3; g.shadowColor = '#e0e0f0'; g.shadowBlur = 12; g.beginPath(); g.arc(x, y, rad * 1.05, 0, TAU); g.stroke(); g.restore(); }
  },
  haze(g, p, P, S, R) {
    const c = cen(S.foes, S), a = 0.4 * env(p, 0.2, 0.2); g.strokeStyle = rgba(C(R, P.c, 1), a); g.lineWidth = 1.2;
    for (let k = 0; k < 6; k++) { const y = c.y + S.u * (0.6 - k * 0.3); g.beginPath(); for (let i = 0; i <= 40; i++) { const x = c.x - S.u * 2.4 + i * S.u * 0.12, yy = y + Math.sin(x * 0.12 + p * 20 + k) * 2.5; i ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke(); }
  },
  carpet(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'foes'), n = P.n || 10, a = env(p, P.in ?? 0.06, 0.25), hk = P.h || 1; g.save(); g.globalCompositeOperation = 'lighter';
    L.forEach(t => { for (let i = 0; i < n; i++) { const ox = (r() - 0.5) * S.u * 1.3, ph = r() * TAU, h = S.u * hk * (0.25 + 0.25 * r()) * (0.75 + 0.25 * Math.sin(p * 25 + ph)); flame(g, t.x + ox, t.y + S.u * 0.45, h * 0.45, h, C(R, P.c, 0), C(R, P.c2, 1), 0.75 * a); } });
    g.restore();
  },
  firewall(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'foes'), ys = L.map(t => t.y), xs = L.map(t => t.x), y0 = Math.min(...ys) - S.u * 0.2, y1 = Math.max(...ys) + S.u * 0.5;
    const xa = S.dir > 0 ? Math.min(S.from.x, ...xs) - S.u * 0.5 : Math.max(S.from.x, ...xs) + S.u * 0.5, xb = S.dir > 0 ? Math.max(...xs) + S.u * 1.5 : Math.min(...xs) - S.u * 1.5;
    const front = lerp(xa, xb, eo(cl(p / 0.7))), n = P.n || 110, H = S.u * (P.h || 1.1), a = env(p, 0.03, 0.25); g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) { const fx = r(), fy = r(), ph = r() * TAU, rh = r(), x = lerp(xa, xb, fx), behind = (front - x) * S.dir; if (behind < 0) continue; const life = cl(1 - behind / Math.abs(xb - xa) * 1.8); if (life <= 0) continue; const h = H * (0.35 + 0.65 * rh) * life * (0.7 + 0.3 * Math.sin(p * 30 + ph)); flame(g, x, lerp(y0, y1, fy), h * 0.4, h, C(R, P.c, 0), C(R, P.c2, 1), 0.8 * a); }
    for (let k = 0; k < 8; k++) flame(g, front, lerp(y0, y1, k / 7), S.u * 0.35, H * 1.2 * (0.8 + 0.2 * Math.sin(p * 40 + k)), C(R, P.c, 0), '#fff0b0', 0.85 * a);
    g.restore();
  },
  // 冰
  helix(g, p, P, S, R) {
    const A = pt1(S, P.at || 'tg'), H = S.u * (P.h || 2.2) * eo(cl(p / 0.4)), a = env(p, 0.05, P.out ?? 0.2), base = A.y + S.u * 0.45, wr = S.u * 0.45;
    [C(R, P.c, 0), C(R, P.c2, 1)].forEach((col, k) => { const L = []; for (let i = 0; i <= 28; i++) { const u = i / 28; L.push({ x: A.x + Math.sin(u * 10 + p * 18 + k * Math.PI) * wr * (1 - u * 0.4), y: base - u * H }); } brush(g, L, S.u * 0.16, col, a * 0.9, 0, 1, 0.3); });
  },
  shards(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'tg'), n = P.n || 22, q = eo(p);
    for (let i = 0; i < n; i++) { const ang = r() * TAU, sp = S.u * (1 + r() * 1.6), rot = r() * TAU, sz = S.u * (0.06 + r() * 0.1); g.save(); g.translate(A.x + Math.cos(ang) * sp * q, A.y + Math.sin(ang) * sp * q * 0.7 + S.u * 1.2 * p * p); g.rotate(rot + p * 6); g.fillStyle = rgba(i % 2 ? C(R, P.c2, 1) : C(R, P.c, 0), 1 - p); g.beginPath(); g.moveTo(0, -sz); g.lineTo(sz * 0.6, sz); g.lineTo(-sz * 0.6, sz); g.closePath(); g.fill(); g.restore(); }
  },
  iceline(g, p, P, S, R, r) {
    const a0 = S.from, L = S.foes, far = S.dir > 0 ? Math.max(...L.map(t => t.x)) + S.u : Math.min(...L.map(t => t.x)) - S.u, y = cen(L, S).y + S.u * 0.45, front = lerp(a0.x, far, eo(cl(p / 0.45))), a = env(p, 0.02, 0.2);
    brush(g, [{ x: a0.x, y: a0.y + S.u * 0.45 }, { x: front, y }], S.u * 0.1, '#ffffff', a, 0, 1, 0);
    g.strokeStyle = rgba(C(R, P.c, 0), 0.95 * a); g.lineWidth = 1.2;
    for (let i = 0, n = P.n || 26; i < n; i++) { const fx = lerp(a0.x, far, r()), oy = (r() - 0.5) * S.u * 1.8, s = S.u * (0.12 + r() * 0.16); if ((front - fx) * S.dir < 0) continue; hex(g, fx, y + oy * 0.5 - S.u * 0.1, s); }
  },
  icicle(g, p, P, S, R) {
    const L = pts(S, P.at || 'front2'), a = env(p, 0.02, 0.2), col = C(R, P.c, 0);
    L.forEach((t, i) => {
      const q = eo(cl((p - (P.d ?? 0.3) - i * 0.06) / 0.25)); if (q <= 0) return; const h = S.u * 1.3 * q, w = S.u * 0.75, b = t.y + S.u * 0.48;
      const gr = g.createLinearGradient(t.x - w / 2, 0, t.x + w / 2, 0); gr.addColorStop(0, rgba('#ffffff', 0.75 * a)); gr.addColorStop(0.5, rgba(col, 0.5 * a)); gr.addColorStop(1, rgba('#ffffff', 0.7 * a)); g.fillStyle = gr;
      g.beginPath(); g.moveTo(t.x - w / 2, b); g.lineTo(t.x - w * 0.42, b - h * 0.85); g.lineTo(t.x - w * 0.1, b - h); g.lineTo(t.x + w * 0.3, b - h * 0.92); g.lineTo(t.x + w / 2, b); g.closePath(); g.fill(); g.strokeStyle = rgba('#ffffff', 0.9 * a); g.lineWidth = 1.2; g.stroke();
    });
  },
  // at：只落在这几只头顶（±0.7 格）；rain：画成斜的雨丝
  snow(g, p, P, S, R, r) {
    const a = env(p, 0.2, 0.25), col = rgba(typeof P.c === 'number' ? C(R, P.c) : P.c || '#ffffff', 0.85 * a), L = P.at ? pts(S, P.at) : null; g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 1;
    for (let i = 0, n = P.n || 40; i < n; i++) {
      const x0 = L && L.length ? L[i % L.length].x + (r() - 0.5) * S.u * 1.4 : r() * S.w, sp = 0.4 + r() * 0.6, ph = r() * TAU, sz = 1 + r() * 2, y0 = r(), y = ((y0 + p * sp * (P.rain ? 3 : 1.2)) % 1) * (S.h + 20) - 10;
      if (P.rain) { g.beginPath(); g.moveTo(x0 + y * 0.12, y); g.lineTo(x0 + y * 0.12 - 3, y - 9); g.stroke(); } else { g.beginPath(); g.arc(x0 + Math.sin(p * 6 + ph) * 8, y, sz, 0, TAU); g.fill(); }
    }
  },
  lake(g, p, P, S, R) {
    const c = cen(S.foes, S), q = eo(cl((p - (P.d ?? 0.2)) / 0.3)), a = env(p, 0, 0.2), rx = S.u * 2.6 * q, ry = S.u * 1.0 * q; if (q <= 0) return;
    const gr = g.createLinearGradient(c.x - rx, c.y, c.x + rx, c.y + ry); gr.addColorStop(0, rgba('#ffffff', 0.75 * a)); gr.addColorStop(0.5, rgba(C(R, P.c, 0), 0.55 * a)); gr.addColorStop(1, rgba('#ffffff', 0.7 * a));
    g.fillStyle = gr; g.beginPath(); g.ellipse(c.x, c.y + S.u * 0.25, rx, ry, 0, 0, TAU); g.fill(); g.strokeStyle = rgba('#ffffff', a); g.lineWidth = 1.5; g.stroke();
    g.lineWidth = 1; g.beginPath(); for (let k = 0; k < 4; k++) { const x = c.x - rx * 0.6 + k * rx * 0.35, y = c.y + S.u * 0.1 + (k % 2) * ry * 0.3; g.moveTo(x, y); g.lineTo(x + rx * 0.15, y - ry * 0.1); } g.stroke();
  },
  dart(g, p, P, S, R) {
    const c = cen(S.foes, S), q = cl((p - (P.d ?? 0.5)) / 0.3); if (q <= 0 || q >= 1) return;
    g.save(); g.translate(lerp(c.x - S.dir * S.u * 3, c.x + S.dir * S.u * 3, q), c.y + S.u * 0.05 + Math.sin(q * 12) * 3); g.scale(S.dir, 1); g.strokeStyle = '#1c1915'; g.fillStyle = rgba(C(R, P.c, 2), 0.95); g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(0, 0, S.u * 0.3, S.u * 0.05, 0, 0, TAU); g.fill(); g.stroke(); const fl = Math.sin(p * 80) * 0.5; [-1, 1].forEach(k => { g.beginPath(); g.ellipse(S.u * 0.08, k * S.u * 0.08, S.u * 0.16, S.u * 0.05, k * (0.5 + fl), 0, TAU); g.stroke(); }); g.restore();
  },
};
Object.assign(PR, {
  // 金
  plates(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), n = P.n || 10, step = P.step ?? 0.05, d0 = P.d || 0, a = env(p, 0, 0.12);
    for (let i = 0; i < n; i++) {
      const ang0 = r() * TAU, far = S.u * (2.2 + r()), sl = (i / n) * TAU, q = eo(cl((p - d0 - i * step) / 0.12)); if (q <= 0) continue;
      const x = lerp(A.x + Math.cos(ang0) * far, A.x + Math.cos(sl) * S.u * 0.32, q), y = lerp(A.y + Math.sin(ang0) * far * 0.7, A.y + Math.sin(sl) * S.u * 0.28, q);
      g.save(); g.translate(x, y); g.rotate(sl + Math.PI / 2 + (1 - q) * 3); g.fillStyle = rgba(P.quill ? C(R, P.c2, 2) : C(R, P.c, 0), 0.95 * a); g.strokeStyle = rgba('#1c1915', a); g.lineWidth = 1; g.beginPath();
      if (P.quill) { g.moveTo(0, -S.u * 0.38); g.lineTo(S.u * 0.045, 0); g.lineTo(0, S.u * 0.12); g.lineTo(-S.u * 0.045, 0); g.closePath(); } else g.ellipse(0, 0, S.u * 0.14, S.u * 0.2, 0, 0, TAU);
      g.fill(); g.stroke(); g.restore();
    }
    const done = d0 + n * step + 0.12, q = (p - done) / 0.15; if (q > 0 && q < 1) { g.save(); g.globalCompositeOperation = 'lighter'; radial(g, A.x, A.y, S.u * (0.6 + q), C(R, P.c, 0), 0.75 * (1 - q)); g.restore(); }
  },
  crack(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), n = P.n || 7, Rm = S.u * (P.R || 1.2), a = env(p, 0.02, 0.25), q = eo(cl((p - (P.d || 0)) / 0.25)), by = A.y + S.u * 0.45;
    for (let i = 0; i < n; i++) { const ang = (i / n) * TAU + r() * 0.5, L = [{ x: A.x, y: by }]; for (let k = 1; k <= 4; k++) { const rr = Rm * k / 4, an = ang + (r() - 0.5) * 0.5; L.push({ x: A.x + Math.cos(an) * rr, y: by + Math.sin(an) * rr * 0.4 }); } if (q > 0) brush(g, L, 2.6, P.c || '#1c1915', 0.85 * a, 0, q, 0.6); }
  },
  blade(g, p, P, S, R) {
    const A = pt1(S, P.at || 'tg'), col = C(R, P.c2, 1), a = env(p, 0.02, 0.2), top = -10, bot = A.y + S.u * 0.6;
    if (p < 0.35) star(g, A.x, A.y - S.u * 1.6, S.u * 0.25 * (0.6 + 0.4 * Math.sin(p * 40)), '#ffffff', 0.95);
    const q = cl((p - 0.35) / 0.08); if (q > 0) { const y = lerp(top, bot, eo(q)); g.save(); g.globalCompositeOperation = 'lighter'; brush(g, [{ x: A.x, y: top }, { x: A.x, y }], S.u * 0.24, col, 0.55 * a, 0, 1, 0.3); brush(g, [{ x: A.x, y: top }, { x: A.x, y }], S.u * 0.07, '#ffffff', a, 0, 1, 0.3); g.restore(); }
    const sp = cl((p - 0.45) / 0.2); if (sp > 0 && sp < 1) { const off = Math.sin(sp * Math.PI) * S.u * 0.25; g.strokeStyle = rgba('#1c1915', 0.7 * (1 - sp)); g.lineWidth = 2; g.beginPath(); g.moveTo(A.x - off, top); g.lineTo(A.x - off, bot); g.moveTo(A.x + off, top); g.lineTo(A.x + off, bot); g.stroke(); }
  },
  debris(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'tg'), d0 = P.d || 0, q = cl((p - d0) / (1 - d0));
    for (let i = 0, n = P.n || 14; i < n; i++) { const vx = (r() - 0.5) * S.u * 3, vy = -S.u * (0.8 + r() * 1.4), sz = S.u * (0.05 + r() * 0.08), rot = r() * TAU; if (q <= 0) continue; g.save(); g.translate(A.x + vx * q, A.y + S.u * 0.4 + vy * q + S.u * 3 * q * q); g.rotate(rot + q * 5); g.fillStyle = rgba(P.c || '#2b241b', 1 - q); g.fillRect(-sz, -sz * 0.7, sz * 2, sz * 1.4); g.restore(); }
  },
  dome(g, p, P, S, R) {
    const L = pts(S, P.at || 'from'), col = C(R, P.c, 0), a = env(p, 0.05, 0.2), q = eo(cl((p - (P.d || 0)) / 0.25)); if (q <= 0) return;
    L.forEach(t => {
      const w = S.u * 0.62, h = S.u * 1.15 * q, by = t.y + S.u * 0.45; g.fillStyle = rgba(col, 0.22 * a); g.strokeStyle = rgba(col, 0.95 * a); g.lineWidth = 2;
      g.beginPath(); g.moveTo(t.x - w, by); g.bezierCurveTo(t.x - w, by - h * 0.6, t.x - w * 0.45, by - h, t.x, by - h); g.bezierCurveTo(t.x + w * 0.45, by - h, t.x + w, by - h * 0.6, t.x + w, by); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(t.x, by, w, w * 0.25, 0, 0, TAU); g.stroke(); g.lineWidth = 1; [0.35, 0.6].forEach(k => { g.beginPath(); g.ellipse(t.x, by - h * k, w * (1 - k * 0.35), w * 0.18, 0, 0, Math.PI); g.stroke(); });
      const sh = (p * 2) % 1; g.strokeStyle = rgba('#ffffff', 0.6 * a * (1 - sh)); g.beginPath(); g.ellipse(t.x, by - h * sh, w * (1 - sh * 0.5), w * 0.2, 0, 0, Math.PI); g.stroke();
    });
  },
  coins(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), L = pts(S, 'allies'), col = C(R, P.c, 0), a = env(p, 0.05, 0.15);
    for (let i = 0, n = P.n || 14; i < n; i++) { const t = L[i % L.length], ox = (r() - 0.5) * S.u * 0.6, d = r() * 0.4, h = S.u * (1 + r()), q = cl((p - 0.1 - d) / 0.35); if (q <= 0) continue; const x = lerp(A.x, t.x + ox, q), y = lerp(A.y - S.u * 0.3, t.y, q) - h * 4 * q * (1 - q), w = Math.abs(Math.cos(p * 25 + i)) * S.u * 0.11 + 1; g.fillStyle = rgba(col, a); g.strokeStyle = rgba('#5a3a0a', a); g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, w, S.u * 0.11, 0, 0, TAU); g.fill(); g.stroke(); if (q >= 1) star(g, t.x + ox, t.y - S.u * 0.3, S.u * 0.07 * (1 + Math.sin(p * 30 + i)), '#fff6c0', a); }
  },
  // 木
  cocoon(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), col = C(R, P.c, 1), rw = S.u * 0.42, rh = S.u * 0.62, a = env(p, 0.05, 0.12), crack = cl((p - 0.15) / 0.2), peel = cl((p - 0.42) / 0.4);
    for (let i = 0, n = 8; i < n; i++) { const ang = (i / n) * TAU, dx = r() - 0.5, dy = r(); g.save(); g.translate(A.x + Math.cos(ang) * rw * 0.6 + dx * S.u * 2 * peel, A.y + Math.sin(ang) * rh * 0.6 + dy * S.u * 1.5 * peel * peel); g.rotate(peel * dx * 6); g.globalAlpha = a * (1 - peel); g.fillStyle = col; g.strokeStyle = '#1c1915'; g.lineWidth = 1; g.beginPath(); g.ellipse(0, 0, rw * 0.5, rh * 0.45, ang, 0, TAU); g.fill(); g.stroke(); g.restore(); }
    if (crack > 0 && peel < 1) { g.save(); g.globalCompositeOperation = 'lighter'; brush(g, [{ x: A.x, y: A.y - rh }, { x: A.x + 4, y: A.y - rh * 0.5 }, { x: A.x - 3, y: A.y }, { x: A.x + 2, y: A.y + rh * 0.5 }], 3 + 6 * peel, P.g || '#c9a0e8', 0.95 * (1 - peel), 0, crack, 0.5); g.restore(); }
  },
  wings(g, p, P, S, R) {
    const A = pt1(S, P.at || 'from'), s = S.u * (P.s || 1.6) * eo(cl((p - (P.d ?? 0.4)) / 0.4)), flap = 0.85 + 0.15 * Math.sin(p * 14); if (s < 1) return;
    g.save(); g.translate(A.x, A.y - S.u * 0.3); g.globalAlpha = env(p, 0.02, 0.15) * (P.a ?? 1);
    [-1, 1].forEach(sd => {
      g.save(); g.scale(sd * flap, 1); g.fillStyle = C(R, P.c, 1); g.strokeStyle = '#1c1915'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(s * 0.4, -s * 0.9, s * 1.1, -s * 0.7, s * 0.9, -s * 0.1); g.bezierCurveTo(s * 0.8, s * 0.2, s * 0.4, s * 0.1, 0, 0); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(s * 0.5, s * 0.2, s * 0.7, s * 0.6, s * 0.35, s * 0.7); g.bezierCurveTo(s * 0.15, s * 0.6, s * 0.05, s * 0.3, 0, 0); g.fillStyle = C(R, P.c2, 0); g.fill(); g.stroke();
      g.fillStyle = '#1c1915'; g.beginPath(); g.arc(s * 0.6, -s * 0.45, s * 0.07, 0, TAU); g.fill(); g.restore();
    });
    g.restore();
  },
  blobs(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), col = C(R, P.c, 1), q = eio(cl((p - 0.12) / 0.55)), a = env(p, 0.05, 0.15);
    for (let i = 0, n = P.n || 7; i < n; i++) { const ang = r() * TAU, d = S.u * (0.9 + r() * 0.9), sz = S.u * (0.14 + r() * 0.1), wob = 1 + 0.15 * Math.sin(p * 30 + i); g.fillStyle = rgba(col, 0.92 * a); g.strokeStyle = rgba('#1c1915', 0.8 * a); g.lineWidth = 1.2; g.beginPath(); g.ellipse(A.x + Math.cos(ang) * d * (1 - q), A.y + S.u * 0.35 * (1 - q) + Math.sin(ang) * d * 0.35 * (1 - q), sz * wob, sz / wob * 0.8, ang, 0, TAU); g.fill(); g.stroke(); }
  },
  sprouts(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'from'), col = C(R, P.c, 0), a = env(p, 0.02, 0.2);
    L.forEach(t => { for (let i = 0, n = P.n || 8; i < n; i++) { const ox = (r() - 0.5) * S.u * (P.wide || 1), oy = (r() - 0.5) * S.u * 0.3, d = r() * 0.5, h = S.u * (0.15 + r() * 0.2), q = eo(cl((p - (P.d || 0) - d * 0.5) / 0.25)); if (q <= 0) continue; const x = t.x + ox, y = t.y + S.u * (P.onBody ? 0 : 0.45) + oy; brush(g, [{ x, y }, { x: x + h * 0.3, y: y - h * 0.6 }, { x: x + h * 0.1, y: y - h }], 2.4, col, a, 0, q, 0.4); } });
  },
  thorns(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), n = P.n || 12, col = C(R, P.c, 0), a = env(p, 0.03, 0.2), by = A.y + S.u * 0.45;
    for (let i = 0; i < n; i++) { const an = i / n * TAU, rr = S.u * (0.75 + r() * 0.2), h = S.u * (0.4 + r() * 0.5), q = eo(cl((p - 0.05 - (i / n) * 0.3) / 0.15)); if (q <= 0) continue; const x = A.x + Math.cos(an) * rr, y = by + Math.sin(an) * rr * 0.35, lean = Math.cos(an) * 0.3; g.fillStyle = rgba(col, a); g.strokeStyle = rgba('#1c1915', a); g.lineWidth = 1; g.beginPath(); g.moveTo(x - S.u * 0.07, y); g.quadraticCurveTo(x + lean * h * 0.3, y - h * q * 0.6, x + lean * h, y - h * q); g.quadraticCurveTo(x + lean * h * 0.3 + 2, y - h * q * 0.5, x + S.u * 0.07, y); g.closePath(); g.fill(); g.stroke(); }
  },
  tree(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), base = { x: A.x - S.dir * S.u * 0.6, y: A.y + S.u * 0.45 }, col = C(R, P.c, 2), a = env(p, 0.05, 0.2) * 0.8, grow = eo(cl(p / 0.35));
    const br = (x, y, ang, len, d) => { if (d > 4) return; const x2 = x + Math.cos(ang) * len * grow, y2 = y + Math.sin(ang) * len * grow, j1 = r(), j2 = r(); brush(g, [{ x, y }, { x: x2, y: y2 }], Math.max(1.5, 7 - d * 1.5), col, a, 0, 1, 0); br(x2, y2, ang - 0.45 - j1 * 0.2, len * 0.72, d + 1); br(x2, y2, ang + 0.4 + j2 * 0.2, len * 0.7, d + 1); };
    br(base.x, base.y, -Math.PI / 2, S.u * 1.05, 0);
    g.save(); g.globalCompositeOperation = 'lighter'; radial(g, base.x, base.y - S.u * 1.6, S.u * 1.6, col, 0.25 * a * grow); g.restore();
  },
  flit(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), c = { x: A.x - S.dir * S.u * 0.6, y: A.y - S.u * 1.3 }, q = cl((p - 0.25) / 0.6), an = q * (P.loops || 3) * TAU, x = c.x + Math.cos(an) * S.u * 0.9, y = c.y + Math.sin(an) * S.u * 0.4, a = env(p, 0.1, 0.15);
    if (q > 0 && q < 1) { const fl = Math.abs(Math.sin(p * 50)); g.fillStyle = rgba(C(R, P.c, 1), a); g.strokeStyle = rgba('#1c1915', a); [-1, 1].forEach(k => { g.beginPath(); g.ellipse(x + k * S.u * 0.08 * fl, y, S.u * 0.1 * fl + 1, S.u * 0.12, k * 0.5, 0, TAU); g.fill(); g.stroke(); }); }
    const L = pts(S, 'allies'), gold = C(R, P.c2, 2);
    for (let i = 0; i < 40; i++) { const t = L[i % L.length], ox = (r() - 0.5) * S.u, d = 0.25 + r() * 0.6, dq = (p - d) / 0.25; if (dq < 0 || dq > 1) continue; g.fillStyle = rgba(gold, (1 - dq) * a); g.fillRect(t.x + ox, lerp(t.y - S.u * 1.2, t.y, dq), 2, 2); }
  },
  // 土
  mountain(g, p, P, S, R) {
    const A = pt1(S, P.at || 'from'), s = S.u * (P.s || 2), col = C(R, P.c, 0), a = env(p, 0.08, 0.2) * (P.a ?? 0.85), ground = A.y + S.u * 0.45;
    const oy = P.mode === 'sink' ? -S.u * 1.2 + eio(cl((p - 0.1) / 0.6)) * S.u * 1.2 : S.u * 0.8 * (1 - eo(cl(p / 0.4))), bx = A.x + (P.dx ?? -0.6) * S.dir * S.u, by = ground + oy;
    const pk = P.peaks || [[-0.5, 0.55], [-0.15, 1], [0.2, 0.7], [0.5, 0.45]];
    g.save(); g.beginPath(); g.rect(-S.w, -S.h, S.w * 3, ground + S.h); g.clip();
    const gr = g.createLinearGradient(0, by - s, 0, by); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, a * 0.15)); g.fillStyle = gr;
    g.beginPath(); g.moveTo(bx - s * 0.75, by); pk.forEach(([px, ph], i) => { if (i) { const [qx, qh] = pk[i - 1]; g.lineTo(bx + (px + qx) / 2 * s, by - Math.min(ph, qh) * 0.55 * s); } g.lineTo(bx + px * s, by - ph * s); }); g.lineTo(bx + s * 0.75, by); g.closePath(); g.fill();
    g.strokeStyle = rgba('#1c1915', a * 0.7); g.lineWidth = 1.5; g.stroke(); g.restore();
  },
  hexes(g, p, P, S, R) {
    const A = pt1(S, P.at || 'from'), s = S.u * 0.13; g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(C(R, P.c, 1), env(p, 0.1, 0.2) * (0.7 + 0.3 * Math.sin(p * 20))); g.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) { const x = A.x + i * s * 1.55, y = A.y + j * s * 1.7 + (i % 2 ? s * 0.85 : 0); if (Math.hypot((x - A.x) / 1.3, y - A.y) < S.u * 0.42) hex(g, x, y, s * 0.8); }
    g.restore();
  },
  dust(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'from'), col = C(R, P.c, 1), a = env(p, 0.15, 0.3);
    L.forEach(t => { for (let i = 0, n = P.n || 24; i < n; i++) { const ox = (r() - 0.5) * S.u * (P.wide || 2.4), sp = 0.3 + r() * 0.7, sz = S.u * (0.08 + r() * 0.12), d = r() * 0.4, q = cl((p - d) / (1 - d)); if (q <= 0) continue; g.fillStyle = rgba(col, 0.38 * a * (1 - q)); g.beginPath(); g.arc(t.x + ox * (0.6 + q * 0.6), t.y + S.u * 0.45 - q * S.u * sp, sz * (1 + q), 0, TAU); g.fill(); } });
  },
  funnel(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'front'), col = C(R, P.c, 0), dk = C(R, P.c2, 1), a = env(p, 0.1, 0.25), rot = eio(cl(p / 0.85)) * TAU * 1.5, by = A.y + S.u * 0.4, Rm = S.u * 0.95;
    for (let k = 0; k < 4; k++) { const L = []; for (let i = 0; i <= 20; i++) { const u = i / 20, an = rot + k * Math.PI / 2 + u * 4, rr = Rm * (1 - u); L.push({ x: A.x + Math.cos(an) * rr, y: by + Math.sin(an) * rr * 0.32 }); } brush(g, L, 3, k % 2 ? dk : col, 0.85 * a, 0, 1, 0.5); }
    for (let i = 0; i < 40; i++) { const an0 = r() * TAU, rr0 = r(), sp = 0.5 + r(), u = (rr0 + p * sp) % 1, an = an0 + rot * 1.3 + u * 3, rr = Rm * (1 - u); g.fillStyle = rgba(col, a); g.fillRect(A.x + Math.cos(an) * rr, by + Math.sin(an) * rr * 0.32, 2, 2); }
    const sink = eo(cl((p - 0.3) / 0.5)); if (sink > 0) { g.fillStyle = rgba(col, 0.92 * a); g.beginPath(); g.ellipse(A.x, by, S.u * 0.55, S.u * 0.18 + sink * S.u * 0.28, 0, Math.PI, 0); g.fill(); }
  },
  rock(g, p, P, S, R) {
    const a0 = pt1(S, P.at || 'front'), b0 = pt1(S, P.to || 'foeBack'), col = C(R, P.c, 1), fly = cl((p - 0.3) / 0.4); let x, y;
    if (fly <= 0) { x = a0.x; y = a0.y + S.u * 0.5 - eo(cl(p / 0.25)) * S.u * 0.5; } else { x = lerp(a0.x, b0.x + S.dir * S.u * 0.5, fly); y = lerp(a0.y, b0.y, fly) - S.u * (P.arc ?? 2.2) * 4 * fly * (1 - fly); }   // arc：抛起的高度（格），小就是贴地滚
    if (fly < 1) { const s = S.u * 0.55; g.save(); g.translate(x, y); g.rotate(fly * 4); g.fillStyle = col; g.strokeStyle = '#1c1915'; g.lineWidth = 2; g.beginPath(); [[-1, 0.2], [-0.6, -0.8], [0.3, -0.9], [1, -0.2], [0.7, 0.7], [-0.4, 0.8]].forEach(([u, v], i) => i ? g.lineTo(u * s, v * s * 0.8) : g.moveTo(u * s, v * s * 0.8)); g.closePath(); g.fill(); g.stroke(); bug(g, 0, -s * 0.9, S.u * 0.6, '#1c1915', fly > 0 ? 0.7 : 0, S.dir); g.restore(); }
    const land = cl((p - 0.7) / 0.3); if (land > 0) { g.strokeStyle = rgba(col, 0.9 * (1 - land)); g.lineWidth = 4 * (1 - land) + 1; g.beginPath(); g.ellipse(b0.x + S.dir * S.u * 0.5, b0.y + S.u * 0.45, S.u * (0.3 + land * 1.4), S.u * (0.1 + land * 0.45), 0, 0, TAU); g.stroke(); }
  },
  flag(g, p, P, S, R) {
    const A = pt1(S, P.at || 'from'), x = A.x + S.dir * S.u * 0.6, by = A.y + S.u * 0.45, q = eo(cl((p - (P.d ?? 0.5)) / 0.2)), a = env(p, 0, 0.15); if (q <= 0) return; const H = S.u * 1.4 * q;
    g.strokeStyle = rgba('#1c1915', a); g.lineWidth = 2; g.beginPath(); g.moveTo(x, by); g.lineTo(x, by - H); g.stroke();
    g.fillStyle = rgba(C(R, P.c, 2), a); g.beginPath(); g.moveTo(x, by - H); for (let i = 0; i <= 8; i++) { const u = i / 8; g.lineTo(x + S.dir * u * S.u * 0.7 * q, by - H + Math.sin(u * 5 + p * 20) * 3); } for (let i = 8; i >= 0; i--) { const u = i / 8; g.lineTo(x + S.dir * u * S.u * 0.7 * q, by - H + S.u * 0.4 + Math.sin(u * 5 + p * 20) * 3); } g.closePath(); g.fill();
  },
  // 雷
  chain(g, p, P, S, R, r) {
    const L = [pt1(S, P.at || 'from')].concat(S.foes).slice(0, (P.n || 2) + 2), col = C(R, P.c, 1), seg = 1 / Math.max(1, L.length - 1);
    for (let i = 1; i < L.length; i++) { const J = jag(L[i - 1], L[i], 7, S.u * 0.3, r), lp = (p - (i - 1) * seg * 0.8) / (seg * 0.9); if (lp < 0 || lp > 1) continue; g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba(col, 0.45 * (1 - lp)); g.lineWidth = 7; line(g, J); g.stroke(); g.strokeStyle = rgba('#ffffff', 1 - lp); g.lineWidth = 2; line(g, J); g.stroke(); radial(g, L[i].x, L[i].y, S.u * 0.5 * (1 - lp), col, 0.6); g.restore(); }
  },
  motes(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'tgs'), n = P.n || L.length * 2, col = C(R, P.c, 1), src = pt1(S, P.src || 'from'), fly = P.fly ?? 0.5, a = env(p, 0.05, 0.15); g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) { const t = L[i % L.length], ox = (r() - 0.5) * S.u * 0.6, d = r() * 0.25, cx = src.x + (r() - 0.5) * S.u * 2, cy = src.y - r() * S.u * 1.5, q = eio(cl((p - d) / fly)), pos = qbez(src, { x: cx, y: cy - S.u }, { x: t.x + ox, y: t.y - S.u * 0.75 }, q); radial(g, pos.x, pos.y, S.u * 0.18 * (0.6 + 0.4 * Math.sin(p * 40 + i)), col, 0.9 * a); }
    g.restore();
  },
  bolts(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'tgs'), n = P.n || L.length, gap = P.gap ?? 0, life = P.life || 0.25, col = C(R, P.c, 1), d0 = P.d || 0;
    for (let i = 0; i < n; i++) {
      const t = L[i % L.length], ox = (r() - 0.5) * S.u * 0.5, J = jag({ x: t.x + ox * 3, y: -12 }, { x: t.x + ox, y: t.y + S.u * 0.2 }, 8, S.u * 0.28, r), lp = (p - d0 - i * gap) / life; if (lp < 0 || lp > 1) continue;
      const big = P.last && i === n - 1, w = (P.w || 2.5) * (big ? 2.4 : 1), a = 1 - lp; g.save(); g.globalCompositeOperation = 'lighter';
      g.strokeStyle = rgba(big ? C(R, P.lc ?? 2, 2) : col, 0.5 * a); g.lineWidth = w * 4; line(g, J); g.stroke(); g.strokeStyle = rgba('#ffffff', a); g.lineWidth = w; line(g, J); g.stroke(); radial(g, t.x + ox, t.y + S.u * 0.3, S.u * (big ? 1.2 : 0.6), col, 0.7 * a); g.restore();
    }
  },
  cracks(g, p, P, S, R, r) {
    const col = C(R, P.c, 2), a = env(p, 0.05, 0.2); g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0, n = P.n || 9; i < n; i++) { const x0 = S.w * (0.1 + 0.8 * (i + r() * 0.6) / n), J = jag({ x: x0, y: -5 }, { x: x0 + (r() - 0.5) * S.u, y: S.h * (0.12 + r() * 0.12) }, 5, S.u * 0.2, r), q = cl((p - i * 0.03) / 0.15); if (q > 0) { brush(g, J, 6, col, 0.3 * a, 0, q, 0.3); brush(g, J, 2.5, '#fff6d0', a, 0, q, 0.3); } }
    g.restore();
  },
  band(g, p, P, S, R) {
    const y = S.h * (P.y ?? 0.14), x = lerp(-S.w * 0.3, S.w * 1.3, eio(cl(p / 0.6))), col = C(R, P.c, 0), a = env(p, 0.05, 0.3); g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(x - S.w * 0.6, 0, x, 0); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(1, rgba(col, 0.75 * a)); g.fillStyle = gr; g.fillRect(x - S.w * 0.6, y - S.u * 0.18, S.w * 0.6, S.u * 0.36); radial(g, x, y, S.u * 0.6, '#ffffff', 0.8 * a); g.restore();
  },
  stars(g, p, P, S, R) { const L = pts(S, P.at || 'front2'), a = env(p, 0.15, 0.2); L.forEach(t => { for (let k = 0; k < 3; k++) { const an = p * 12 + k * TAU / 3; star(g, t.x + Math.cos(an) * S.u * 0.35, t.y - S.u * 0.65 + Math.sin(an) * S.u * 0.1, S.u * 0.11, P.c || '#f2c35a', a); } }); },
});
Object.assign(PR, {
  // 光
  meteor(g, p, P, S, R, r) {
    const L = S.foes, n = P.n || 60, col = C(R, P.c, 0), fire = P.fire; g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const sx = fire ? r() * S.w : lerp(S.w * (S.dir > 0 ? 0.05 : 0.55), S.w * (S.dir > 0 ? 0.45 : 0.95), r()), sy0 = S.h * (0.6 + r() * 0.3), hy = S.h * (0.08 + r() * 0.25), t = L[i % L.length], ox = (r() - 0.5) * S.u * 1.2, d = r() * 0.15, tx = t.x + ox, ty = t.y + S.u * 0.3;
      let x, y, fx0, fy0;
      if (fire) { const q = cl((p - d * 3) / 0.35); if (q >= 1) { const k = (p - d * 3 - 0.35) / 0.15; if (k < 1) radial(g, tx, ty, S.u * 0.35 * (1 - k), '#ffb060', 0.7); continue; } if (q <= 0) continue; fx0 = tx - S.dir * S.u * 2; fy0 = -10; x = lerp(fx0, tx, ei(q)); y = lerp(fy0, ty, ei(q)); }
      else { const rise = cl((p - d) / 0.35), fall = cl((p - 0.5 - d) / 0.3); if (fall >= 1) { const k = (p - 0.8 - d) / 0.12; if (k < 1) radial(g, tx, ty, S.u * 0.25 * (1 - k), '#ffb060', 0.85 * (1 - k)); continue; } if (fall <= 0) { radial(g, sx + Math.sin(p * 8 + i) * 4, lerp(sy0, hy, eo(rise)), S.u * 0.08 + 2, col, 0.9 * cl(rise * 3)); continue; } fx0 = sx; fy0 = hy; x = lerp(sx, tx, ei(fall)); y = lerp(hy, ty, ei(fall)); }
      const dl = Math.hypot(tx - fx0, ty - fy0) || 1; radial(g, x, y, S.u * 0.09 + 2, col, 0.95); g.strokeStyle = rgba(col, 0.55); g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x - (tx - fx0) / dl * 16, y - (ty - fy0) / dl * 16); g.stroke();
    }
    g.restore();
  },
  mirror(g, p, P, S, R) {
    const A = pt1(S, P.at || 'from'), x = A.x + S.dir * S.u * 0.75, y = A.y - S.u * 0.1, hgt = S.u * 0.95 * eo(cl(p / 0.2)), c1 = C(R, P.c, 0), c2 = C(R, P.c2, 1), a = env(p, 0.02, 0.15);
    const gr = g.createLinearGradient(x - 8, 0, x + 8, 0); gr.addColorStop(0, rgba(c1, 0.2 * a)); gr.addColorStop(0.5, rgba('#ffffff', 0.65 * a)); gr.addColorStop(1, rgba(c1, 0.2 * a)); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, S.u * 0.18, Math.max(1, hgt), 0, 0, TAU); g.fill(); g.strokeStyle = rgba('#ffffff', 0.9 * a); g.lineWidth = 1.5; g.stroke();
    if (p > 0.25) for (let k = 0; k < 3; k++) { const q = ((p * 2.2 - k * 0.25) % 1 + 1) % 1; g.strokeStyle = rgba(c1, (1 - q) * 0.85 * a); g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, S.u * 0.18 * (1 + q * 1.5), hgt * (0.3 + q * 0.6), 0, 0, TAU); g.stroke(); }
    const T = pt1(S, 'tg'), sh = cl((p - 0.2) / 0.5); if (sh > 0 && sh < 1) { const out = sh < 0.5, f = out ? sh * 2 : (sh - 0.5) * 2; radial(g, out ? lerp(T.x, x, f) : lerp(x, T.x, f), out ? lerp(T.y, y, f) : lerp(y, T.y, f), S.u * 0.22, out ? '#ffffff' : c2, 0.95); }
    const fl = cl((p - 0.55) / 0.35); if (fl > 0) for (let k = 0; k < 5; k++) { const an = k * TAU / 5 + 0.3, sp = fl > 0.5 ? (fl - 0.5) * S.u * 2.5 : 0; g.fillStyle = rgba(c2, (fl > 0.5 ? 1 - (fl - 0.5) * 2 : fl * 2) * 0.9); g.beginPath(); g.ellipse(x + Math.cos(an) * (S.u * 0.18 + sp), y + Math.sin(an) * (S.u * 0.18 + sp) + sp * sp / S.u, S.u * 0.12, S.u * 0.06, an, 0, TAU); g.fill(); }
  },
  prism(g, p, P, S, R) {
    const A = pt1(S, P.at || 'from'), a = env(p, 0.03, 0.2), beam = cl(p / 0.2), fan = eo(cl((p - 0.2) / 0.3)), cols = ['#e05a4a', '#e8933a', '#e8d04a', '#7ac06a', '#4aa8d8', '#5a6ad0', '#a06ad0'], src = { x: A.x - S.dir * S.u * 2, y: -10 };
    g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba('#ffffff', 0.9 * a); g.lineWidth = 4; g.beginPath(); g.moveTo(src.x, src.y); g.lineTo(lerp(src.x, A.x, beam), lerp(src.y, A.y, beam)); g.stroke();
    if (fan > 0) {
      const L = pts(S, 'allies'); cols.forEach((c, i) => { const t = L[i % L.length], o = (i - 3) * 4; g.strokeStyle = rgba(c, 0.6 * a); g.lineWidth = 3; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(lerp(A.x, t.x + o, fan), lerp(A.y, t.y + o, fan)); g.stroke(); });
      const T = pt1(S, 'tg'), st = eo(cl((p - 0.45) / 0.15)); if (st > 0) { g.strokeStyle = rgba('#ffffff', a); g.lineWidth = 5; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(lerp(A.x, T.x, st), lerp(A.y, T.y, st)); g.stroke(); if (st >= 1) { g.strokeStyle = rgba('#dff3ff', a); g.lineWidth = 2.5; g.beginPath(); g.ellipse(T.x, T.y, S.u * 0.42, S.u * 0.5, 0, 0, TAU); g.stroke(); } }
    }
    g.restore();
  },
  pillar(g, p, P, S, R) {
    const L = pts(S, P.at || 'tgs'), col = C(R, P.c, 0), a = env(p, 0.1, 0.35), w0 = S.u * (P.w || 0.5); g.save(); g.globalCompositeOperation = 'lighter';
    L.forEach((t, i) => { const q = cl((p - i * (P.step ?? 0.06)) / 0.2); if (q <= 0) return; const w = w0 * eo(q) * (1 - 0.6 * cl((p - 0.6) / 0.4)), by = t.y + S.u * 0.45; const gr = g.createLinearGradient(t.x - w, 0, t.x + w, 0); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.5, rgba(col, 0.8 * a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(t.x - w, -10, w * 2, by + 10); g.fillStyle = rgba('#ffffff', 0.7 * a); g.fillRect(t.x - w * 0.15, -10, w * 0.3, by + 10); g.beginPath(); g.ellipse(t.x, by, w * 1.3, w * 0.35, 0, 0, TAU); g.fill(); });
    g.restore();
  },
  // 暗
  ghost(g, p, P, S, R) {
    const A = pt1(S, P.at || 'from'), L = pts(S, P.to || 'tgs'), hops = Math.min(P.n || 2, L.length), c1 = C(R, P.c, 1), c0 = C(R, P.c0, 0); let prev = A;
    for (let i = 0; i < hops; i++) {
      const t = L[i], q = (p - 0.12 - i * 0.38) / 0.3, dst = { x: t.x - S.dir * S.u * 0.55, y: t.y };
      if (q > 0) {
        bug(g, prev.x, prev.y, S.u * 0.8, c1, 0.6 * cl(1 - q), S.dir); for (let k = 1; k <= 4; k++) bug(g, lerp(prev.x, dst.x, k / 5), lerp(prev.y, dst.y, k / 5), S.u * 0.75, c1, 0.2 * cl(1 - q * 0.8), S.dir);
        bug(g, dst.x, dst.y, S.u * 0.8, c0, 0.9 * cl(1.6 - q), S.dir);
        const sl = cl((q - 0.15) / 0.3); if (sl > 0 && sl < 1) brush(g, [{ x: t.x - S.u * 0.4, y: t.y - S.u * 0.5 }, { x: t.x + S.u * 0.1, y: t.y }, { x: t.x + S.u * 0.4, y: t.y + S.u * 0.4 }], S.u * 0.16, c1, 1 - sl, 0, eo(cl(sl * 2)), 0.6);
      }
      prev = dst;
    }
  },
  marks(g, p, P, S, R) {
    const L = pts(S, P.at || 'foes'), col = C(R, P.c, 1), a = env(p, 0.05, 0.2);
    L.forEach((t, i) => { const q = eo(cl((p - (P.d ?? 0.25) - i * (P.step ?? 0.07)) / 0.12)); if (q <= 0) return; const x = t.x, y = t.y - S.u * 0.78, s = S.u * 0.3 * (1.6 - 0.6 * q); g.strokeStyle = rgba(col, a * q); g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, s, 0, TAU); g.stroke(); g.fillStyle = rgba(col, a * q); g.font = `${Math.round(s * 1.1)}px ${KAI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(P.ch || '印', x, y + 1); });
  },
  claw(g, p, P, S, R) {
    const T = pt1(S, P.at || 'foeBack'), q = cl((p - (P.d ?? 0.6)) / 0.12), a = env(p, 0.02, 0.2); if (q <= 0) return;
    for (let k = 0; k < 3; k++) { const o = (k - 1) * S.u * 0.22, L = [{ x: T.x + o - S.u * 0.5, y: T.y - S.u * 0.7 }, { x: T.x + o, y: T.y - S.u * 0.1 }, { x: T.x + o + S.u * 0.2, y: T.y + S.u * 0.5 }]; brush(g, L, S.u * 0.13, P.c || '#0c0b10', a, 0, eo(q), 0.7); brush(g, L, S.u * 0.035, '#c0c0d0', a * 0.85, 0, eo(q), 0.7); }
  },
  // 血
  stream(g, p, P, S, R, r) {
    const src = pts(S, P.at || 'tg'), dst = pt1(S, P.to || 'ally'), col = C(R, P.c, 0), col2 = C(R, P.c2, 1);
    for (let i = 0, n = P.n || 46; i < n; i++) {
      const s = src[i % src.length], d = r() * 0.4, ox = (r() - 0.5) * S.u * 0.5, oy = (r() - 0.5) * S.u * 0.4, sz = 1.5 + r() * 2.5, q = eio(cl((p - 0.1 - d) / 0.5));
      if (q <= 0) { if (p > 0.03) { g.fillStyle = rgba(col, 0.9); g.beginPath(); g.arc(s.x + ox, s.y + oy - cl(p / 0.1) * S.u * 0.3, sz, 0, TAU); g.fill(); } continue; } if (q >= 1) continue;
      const pos = qbez({ x: s.x + ox, y: s.y + oy - S.u * 0.3 }, { x: (s.x + dst.x) / 2, y: Math.min(s.y, dst.y) - S.u * 1.8 }, dst, q); g.fillStyle = rgba(i % 3 ? col : col2, 0.9); g.beginPath(); g.arc(pos.x, pos.y, sz * (1 - q * 0.4), 0, TAU); g.fill();
    }
    const gl = cl((p - 0.6) / 0.3); if (gl > 0) radial(g, dst.x, dst.y, S.u * 0.75, col2, 0.6 * Math.sin(gl * Math.PI));
  },
  // 毒
  crawl(g, p, P, S, R, r) {
    const C0 = pt1(S, P.at || 'foeC'), n = P.n || 2, col = C(R, P.c, 2), Rr = S.u * (P.R || 1.7), a = env(p, 0.05, 0.2) * 0.9;
    for (let i = 0; i < n; i++) {
      const ph = i * TAU / n + r(); let x, y, ang;
      if (P.converge) { const st = { x: C0.x + Math.cos(ph) * S.u * 3.5, y: C0.y + Math.sin(ph) * S.u * 1.6 }, q = eio(cl(p / 0.55)); x = lerp(st.x, C0.x + Math.cos(ph) * S.u * 0.5, q); y = lerp(st.y, C0.y - S.u * 0.9 + Math.sin(ph) * S.u * 0.2, q); ang = Math.atan2(C0.y - st.y, C0.x - st.x); }
      else { ang = ph + p * p * 2.2 * TAU; x = C0.x + Math.cos(ang) * Rr; y = C0.y + S.u * 0.2 + Math.sin(ang) * Rr * 0.38; ang += Math.PI / 2; }
      creature(g, x, y, ang, S.u * 0.6, i % 2 ? 'scorp' : 'cent', col, a, p);
    }
  },
  bubbles(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'foes');
    L.forEach(t => { for (let i = 0, n = P.n || 5; i < n; i++) { const ox = (r() - 0.5) * S.u * 1.2, oy = (r() - 0.3) * S.u * 0.8, d = r() * 0.6, sz = S.u * (0.06 + r() * 0.1), col = r() > 0.5 ? C(R, P.c, 0) : C(R, P.c2, 1), q = (p - (P.d || 0) - d * 0.5) / 0.3; if (q < 0 || q > 1.15) continue; const x = t.x + ox, y = t.y + oy - q * S.u * 0.3; if (q < 1) { g.strokeStyle = rgba(col, 0.9); g.lineWidth = 1.4; g.fillStyle = rgba(col, 0.3); g.beginPath(); g.arc(x, y, sz * (0.4 + q), 0, TAU); g.fill(); g.stroke(); } else { g.strokeStyle = rgba(col, 0.75); g.beginPath(); for (let k = 0; k < 6; k++) { const an = k * TAU / 6; g.moveTo(x + Math.cos(an) * sz * 1.4, y + Math.sin(an) * sz * 1.4); g.lineTo(x + Math.cos(an) * sz * 2, y + Math.sin(an) * sz * 2); } g.stroke(); } } });
  },
  fog(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'foes'), a = env(p, 0.2, 0.3) * (P.a ?? 0.5);
    L.forEach(t => { for (let i = 0, n = P.n || 3; i < n; i++) { const ox = (r() - 0.5) * S.u * 1.4, oy = (r() - 0.5) * S.u * 0.6, s = S.u * (0.5 + r() * 0.5); radial(g, t.x + ox + Math.sin(p * 3 + i) * 6, t.y + oy, s * (0.6 + p * 0.8), i % 2 ? C(R, P.c2, 1) : C(R, P.c, 0), a); } });
  },
  penta(g, p, P, S, R) {
    const T = pt1(S, P.at || 'tg'), rr = S.u * (1.2 - 0.8 * cl((p - 0.6) / 0.3)) * eo(cl(p / 0.3)), x = T.x, y = T.y - S.u * 0.9, rot = p * 8, a = env(p, 0.02, 0.1); g.save(); g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba(C(R, P.c, 0), 0.95 * a); g.lineWidth = 2.5; g.beginPath(); for (let k = 0; k <= 5; k++) { const an = rot + (k * 2 % 5) * TAU / 5 - Math.PI / 2; k ? g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr * 0.5) : g.moveTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr * 0.5); } g.stroke();
    g.strokeStyle = rgba(C(R, P.c2, 1), 0.85 * a); g.beginPath(); g.ellipse(x, y, rr, rr * 0.5, 0, 0, TAU); g.stroke(); g.restore();
  },
  // 智
  web(g, p, P, S, R) {
    const Cc = cen(S.foes, S), cx = Cc.x, q = eo(cl(p / 0.35)), cy = lerp(-S.h * 0.4, Cc.y - S.u * 0.2, q), Rr = S.u * (P.R || 2.4), col = C(R, P.c, 0), a = env(p, 0.02, 0.2), sp = 9;
    if (P.elec) { g.save(); g.globalCompositeOperation = 'lighter'; }
    g.strokeStyle = rgba(col, 0.9 * a); g.lineWidth = P.elec ? 1.8 : 1.2; g.beginPath(); for (let k = 0; k < sp; k++) { const an = k * TAU / sp; g.moveTo(cx, cy); g.lineTo(cx + Math.cos(an) * Rr, cy + Math.sin(an) * Rr * 0.6); } g.stroke();
    g.beginPath(); for (let ring = 1; ring <= 5; ring++) { const rr = Rr * ring / 5.3; for (let k = 0; k <= sp; k++) { const an = k * TAU / sp, x = cx + Math.cos(an) * rr, y = cy + Math.sin(an) * rr * 0.6 + (k % 2 ? 2 : 0); k ? g.lineTo(x, y) : g.moveTo(x, y); } } g.stroke();
    if (P.elec) { for (let k = 0; k < 3; k++) { const an = (k * 3 + p * 20) % sp * TAU / sp, f = (p * 3 + k * 0.3) % 1; radial(g, cx + Math.cos(an) * Rr * f, cy + Math.sin(an) * Rr * 0.6 * f, S.u * 0.25, '#ffffff', 0.8 * a); } g.restore(); }
    else if (q >= 1) { [0, 2, 5, 7].forEach(k => { const an = k * TAU / sp; g.fillStyle = rgba('#1c1915', a); g.beginPath(); g.arc(cx + Math.cos(an) * Rr, cy + Math.sin(an) * Rr * 0.6, 3, 0, TAU); g.fill(); }); const gl = cl((p - 0.4) / 0.2); if (gl > 0 && gl < 1) star(g, cx + Math.cos(TAU / sp) * Rr * gl, cy + Math.sin(TAU / sp) * Rr * 0.6 * gl, S.u * 0.16, '#ffffff', 1 - gl); }
  },
  wrap(g, p, P, S, R) {
    const L = pts(S, P.at || 'front2'), col = C(R, P.c, 0), q = eo(cl((p - (P.d ?? 0.45)) / 0.2)), a = env(p, 0, 0.2); if (q <= 0) return;
    L.forEach((t, i) => { const j = Math.sin(p * 40 + i) * 2; g.strokeStyle = rgba(col, 0.95 * a); g.lineWidth = 1.2; g.beginPath(); for (let k = 0; k < 6; k++) { const y = t.y - S.u * 0.4 + k * S.u * 0.15 * q; g.moveTo(t.x - S.u * 0.4 + j, y); g.lineTo(t.x + S.u * 0.4 + j, y + S.u * 0.12); } for (let k = 0; k < 4; k++) { const x = t.x - S.u * 0.3 + k * S.u * 0.2; g.moveTo(x + j, t.y - S.u * 0.45); g.lineTo(x - S.u * 0.05 + j, t.y - S.u * 0.45 + S.u * 0.85 * q); } g.stroke(); });
  },
  board(g, p, P, S, R, r) {
    const Cc = cen(S.foes, S), col = C(R, P.c, 1), a = env(p, 0.1, 0.2), q = eo(cl(p / 0.2)), W = S.u * 3.4 * q, H = S.u * 1.6 * q, y0 = Cc.y - S.u * 0.2 - H / 2, n = 6, T = pt1(S, 'tg');
    const P4 = (u, v) => ({ x: Cc.x + (u - 0.5) * W * (0.75 + 0.25 * v), y: y0 + H * v });
    g.fillStyle = rgba(col, 0.1 * a); g.beginPath(); [P4(0, 0), P4(1, 0), P4(1, 1), P4(0, 1)].forEach((o, i) => i ? g.lineTo(o.x, o.y) : g.moveTo(o.x, o.y)); g.fill();
    g.strokeStyle = rgba(col, 0.6 * a); g.lineWidth = 1; g.beginPath(); for (let i = 0; i <= n; i++) { const a1 = P4(i / n, 0), b1 = P4(i / n, 1), a2 = P4(0, i / n), b2 = P4(1, i / n); g.moveTo(a1.x, a1.y); g.lineTo(b1.x, b1.y); g.moveTo(a2.x, a2.y); g.lineTo(b2.x, b2.y); } g.stroke();
    const stones = P.n || 5;
    for (let i = 0; i < stones; i++) { const u = r(), v = r(), last = i === stones - 1, pos = last ? { x: T.x, y: T.y - S.u * 0.75 } : P4(Math.round(u * n) / n, Math.round(v * n) / n), sq = cl((p - 0.2 - i * 0.09) / 0.08); if (sq <= 0) continue; g.fillStyle = rgba(i % 2 ? '#efe7d4' : '#15130f', a); g.strokeStyle = rgba('#efe7d4', a * 0.6); g.beginPath(); g.ellipse(pos.x, pos.y - (1 - eo(sq)) * S.u * 1.2, S.u * 0.12, S.u * 0.08, 0, 0, TAU); g.fill(); g.stroke(); }
    const ch = cl((p - (0.25 + stones * 0.09)) / 0.25); if (ch > 0) { g.save(); g.setLineDash([5, 4]); g.lineDashOffset = -p * 60; g.strokeStyle = rgba(C(R, P.c2, 0), a); g.lineWidth = 3; g.beginPath(); g.ellipse(T.x, T.y, S.u * 0.55 * (1.6 - 0.6 * ch), S.u * 0.25 * (1.6 - 0.6 * ch), 0, 0, TAU); g.stroke(); g.restore(); }
  },
  // 魂
  shell(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), col = C(R, P.c, 0), a = env(p, 0.02, 0.15), crack = cl((p - 0.15) / 0.15), out = eo(cl((p - 0.3) / 0.3)), shat = cl((p - 0.65) / 0.3);
    if (shat <= 0) { g.fillStyle = rgba(col, a); g.strokeStyle = rgba('#1c1915', a); g.lineWidth = 1.5; g.beginPath(); g.ellipse(A.x, A.y, S.u * 0.4, S.u * 0.3, 0, 0, TAU); g.fill(); g.stroke(); if (crack > 0) brush(g, [{ x: A.x - S.u * 0.3, y: A.y - S.u * 0.1 }, { x: A.x, y: A.y - S.u * 0.25 }, { x: A.x + S.u * 0.3, y: A.y - S.u * 0.1 }], 3, '#fff6d0', a, 0, crack, 0); }
    else for (let k = 0; k < 6; k++) { const vx = (r() - 0.5) * S.u * 2, vy = -r() * S.u, rot = (r() - 0.5) * 6; g.save(); g.translate(A.x + vx * shat, A.y + vy * shat + S.u * 2 * shat * shat); g.rotate(shat * rot); g.fillStyle = rgba(col, a * (1 - shat)); g.strokeStyle = rgba('#1c1915', a * (1 - shat)); g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, 0, S.u * 0.15, S.u * 0.11, k, 0, TAU); g.fill(); g.stroke(); g.restore(); }
    if (out > 0) { const x = A.x - S.dir * S.u * 0.9 * out, y = A.y - S.u * 0.9 * Math.sin(out * Math.PI); bug(g, x, y, S.u * 0.75, C(R, P.c2, 1), 0.6 * a, S.dir); radial(g, x, y, S.u * 0.45, '#fff6d0', 0.35 * a); }
  },
  soul(g, p, P, S, R) {
    const A = pt1(S, P.at || 'from'), B = pt1(S, P.to || 'ally'), col = C(R, P.c, 1), a = env(p, 0.05, 0.12), top = A.y - S.u * 1.3; let x, y;
    if (p < 0.35) { x = A.x; y = lerp(A.y, top, eo(p / 0.35)); } else if (p < 0.7) { const q = (p - 0.35) / 0.35, an = q * TAU - Math.PI / 2; x = A.x + Math.cos(an) * S.u * 0.6 * Math.sin(q * Math.PI); y = top + (Math.sin(an) + 1) * S.u * 0.3; } else { const q = eio(cl((p - 0.7) / 0.25)); x = lerp(A.x, B.x, q); y = lerp(top, B.y, q); }
    g.save(); g.globalCompositeOperation = 'lighter'; radial(g, x, y, S.u * 0.34, col, 0.9 * a); radial(g, x, y + S.u * 0.2, S.u * 0.2, col, 0.45 * a); g.restore();
    if (p > 0.9) { const q = (p - 0.9) / 0.1; g.strokeStyle = rgba(col, (1 - q) * a); g.lineWidth = 2.5; g.beginPath(); g.ellipse(B.x, B.y, S.u * 0.45, S.u * 0.52, 0, 0, TAU); g.stroke(); }
  },
  // 奴
  ants(g, p, P, S, R) {
    const L = pts(S, 'allies'), back = L.slice().sort((a, b) => (a.x - b.x) * S.dir)[0] || S.from, ac = cen(L, S), hole = { x: ac.x + S.dir * S.u * 0.9, y: ac.y + S.u * 0.8 }, col = C(R, P.c, 0), a = env(p, 0.03, 0.15), op = eo(cl(p / 0.15));
    g.fillStyle = rgba('#0c0a08', 0.85 * a); g.beginPath(); g.ellipse(hole.x, hole.y, S.u * 0.4 * op + 0.1, S.u * 0.13 * op + 0.1, 0, 0, TAU); g.fill();
    const dest = { x: back.x - S.dir * S.u * 0.9, y: back.y + S.u * 0.3 };
    for (let i = 0, n = P.n || 9; i < n; i++) { const q = eio(cl((p - 0.12 - i * 0.05) / 0.45)); if (q <= 0) continue; const end = { x: dest.x - S.dir * (i % 3) * S.u * 0.22, y: dest.y + (Math.floor(i / 3) - 1) * S.u * 0.25 }, pos = qbez(hole, { x: (hole.x + end.x) / 2, y: Math.min(hole.y, end.y) - S.u * 1.2 }, end, q); ant(g, pos.x, pos.y, S.u * (0.25 + 0.25 * q), col, a, -S.dir); }
  },
  threads(g, p, P, S, R) {
    const L = pts(S, P.at || 'tg'), col = C(R, P.c, 0), a = env(p, 0.02, 0.15), q = eo(cl(p / 0.3)), lift = eo(cl((p - 0.35) / 0.3)) * S.u * 0.45;
    L.forEach((t, i) => {
      const sway = Math.sin(p * 9 + i) * S.u * 0.15 * cl((p - 0.5) / 0.2);
      for (let k = -1; k <= 1; k++) { const x = t.x + k * S.u * 0.22 + sway, x0 = x + k * S.u * 0.5; g.strokeStyle = rgba(col, 0.9 * a); g.lineWidth = 1.3; g.beginPath(); g.moveTo(x0, -10); g.lineTo(lerp(x0, x, q), lerp(-10, t.y - S.u * 0.3 - lift, q)); g.stroke(); }
      if (lift > 0) bug(g, t.x + sway, t.y - lift, S.u * 0.7, '#1c1915', 0.5 * a, -S.dir);
      if (p > 0.7) { const e = cl((p - 0.7) / 0.1); [-1, 1].forEach(k => { g.fillStyle = rgba(S.sideCol, a * e); g.beginPath(); g.arc(t.x + sway + k * S.u * 0.1, t.y - lift - S.u * 0.15, 2.8, 0, TAU); g.fill(); }); }
    });
  },
  converge(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), col = C(R, P.c, 0), a = env(p, 0.05, 0.2);
    for (let i = 0, n = P.n || 60; i < n; i++) { const an = r() * TAU, d0 = Math.max(S.w, S.h) * (0.6 + r() * 0.3), d = r() * 0.3, q = eio(cl((p - d) / 0.55)), rr = lerp(d0, S.u * (0.75 + 0.15 * Math.sin(i)), q), an2 = an + q * 1.2 + Math.max(0, p - d - 0.55) * 2; g.fillStyle = rgba(col, a); g.beginPath(); g.ellipse(A.x + Math.cos(an2) * rr, A.y + Math.sin(an2) * rr * 0.5, 2.8, 1.7, an2 + Math.PI / 2, 0, TAU); g.fill(); }
  },
  urn(g, p, P, S, R) {
    const A = pt1(S, P.at || 'mid'), s = S.u * 0.95 * eo(cl(p / 0.25)), x = A.x, y = A.y - S.u * 0.2; if (s < 1) return;
    g.save(); g.globalAlpha = env(p, 0.05, 0.2); g.fillStyle = C(R, P.c, 0); g.strokeStyle = '#1c1915'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - s * 0.25, y - s * 0.55); g.lineTo(x + s * 0.25, y - s * 0.55); g.quadraticCurveTo(x + s * 0.2, y - s * 0.4, x + s * 0.5, y - s * 0.1); g.quadraticCurveTo(x + s * 0.6, y + s * 0.45, x, y + s * 0.5); g.quadraticCurveTo(x - s * 0.6, y + s * 0.45, x - s * 0.5, y - s * 0.1); g.quadraticCurveTo(x - s * 0.2, y - s * 0.4, x - s * 0.25, y - s * 0.55); g.fill(); g.stroke();
    g.fillStyle = '#0c0a08'; g.beginPath(); g.ellipse(x, y - s * 0.55, s * 0.25, s * 0.07, 0, 0, TAU); g.fill(); g.restore();
  },
  vortex(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'tg'), col = C(R, P.c, 0), col2 = C(R, P.c2, 1), a = env(p, 0.1, 0.2), Rm = S.u * (P.R || 1.8), rot = p * TAU * (P.turns || 2);
    for (let k = 0; k < 3; k++) { const L = []; for (let i = 0; i <= 24; i++) { const u = i / 24, an = rot + k * TAU / 3 + u * 5, rr = Rm * (1 - u); L.push({ x: A.x + Math.cos(an) * rr, y: A.y + Math.sin(an) * rr * 0.45 }); } brush(g, L, 3.5, col, 0.6 * a, 0, 1, 0.6); }
    for (let i = 0, n = P.n || 70; i < n; i++) { const an0 = r() * TAU, o = r(), sp = 0.6 + r() * 0.8, u = (o + p * sp * 1.5) % 1, an = an0 + u * 6 + rot, rr = Rm * (1 - u) * 1.15; g.fillStyle = rgba(i % 3 ? col2 : col, a * (0.4 + 0.6 * u)); g.fillRect(A.x + Math.cos(an) * rr, A.y + Math.sin(an) * rr * 0.45, 2.2, 2.2); }
    radial(g, A.x, A.y, S.u * 0.35, '#000000', 0.6 * a);
  },
  // 宇、宙
  fold(g, p, P, S, R) {
    const c = { x: S.w / 2, y: S.h * 0.5 }, col = C(R, P.c, 0), a = env(p, 0.05, 0.2), f = Math.sin(cl((p - 0.15) / 0.55) * Math.PI);
    g.save(); g.globalCompositeOperation = 'lighter'; radial(g, c.x, c.y, S.u * (0.3 + 0.15 * Math.sin(p * 20)) * (1 + f), col, 0.95 * a); g.restore();
    for (let i = 0, n = 8; i < n; i++) { const u = (i + 0.5) / n - 0.5, x = c.x + u * S.w * (1 - 0.85 * f), w = S.w / n * (1 - 0.85 * f); g.fillStyle = rgba(i % 2 ? '#000000' : '#ffffff', 0.14 * f * a); g.fillRect(x - w / 2, -S.h, w, S.h * 3); g.strokeStyle = rgba(col, 0.6 * f * a); g.lineWidth = 1; g.beginPath(); g.moveTo(x - w / 2, -S.h); g.lineTo(x - w / 2, S.h * 2); g.stroke(); }
    const ch = cl((p - 0.7) / 0.25); if (ch > 0) pts(S, 'allies').forEach(t => { for (let k = 0; k < 2; k++) { const x = t.x + S.dir * (S.u * 0.3 + ch * S.u * 0.6 + k * 8), y = t.y - S.u * 0.2; g.strokeStyle = rgba(col, (1 - ch) * a); g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - S.dir * 6, y - 7); g.lineTo(x, y); g.lineTo(x - S.dir * 6, y + 7); g.stroke(); } });
  },
  sweep(g, p, P, S, R) {
    const col = C(R, P.c, 0), a = env(p, 0.05, 0.2), q = cl(p / 0.6), x = lerp(S.w * 0.92, S.w * 0.08, q), y = S.h * 0.2 - Math.sin(q * Math.PI) * S.h * 0.1;
    g.save(); g.globalCompositeOperation = 'lighter'; radial(g, x, y, S.u * 1.2, col, 0.5 * a); g.fillStyle = rgba('#fff6dc', a); g.beginPath(); g.arc(x, y, S.u * 0.28, 0, TAU); g.fill();
    const bx = lerp(-S.w * 0.2, S.w * 1.2, q), gr = g.createLinearGradient(bx - S.u * 1.5, 0, bx + S.u * 1.5, 0); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.5, rgba(col, 0.35 * a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(bx - S.u * 1.5, -S.h, S.u * 3, S.h * 3); g.restore();
    pts(S, 'allies').forEach((t, i) => { for (let k = 0; k < 3; k++) { const rq = cl((p - 0.45 - i * 0.04 - k * 0.08) / 0.3); if (rq <= 0) continue; g.strokeStyle = rgba(C(R, P.c2, 1), (1 - rq * 0.6) * a); g.lineWidth = 1.5; g.beginPath(); g.ellipse(t.x, t.y, S.u * (0.2 + rq * 0.3 + k * 0.1), S.u * (0.25 + rq * 0.3 + k * 0.1), 0, 0, TAU); g.stroke(); } });
  },
  clock(g, p, P, S, R) {
    const A = pt1(S, P.at || 'from'), col = C(R, P.c, 0), a = env(p, 0.08, 0.2), rr = S.u * 0.85 * eo(cl(p / 0.25)), hand = -Math.PI / 2 + eio(cl((p - 0.2) / 0.6)) * TAU; if (rr < 1) return;
    g.strokeStyle = rgba(col, a); g.lineWidth = 2; g.beginPath(); g.arc(A.x, A.y, rr, 0, TAU); g.stroke(); g.beginPath(); for (let k = 0; k < 12; k++) { const an = k * TAU / 12; g.moveTo(A.x + Math.cos(an) * rr * 0.85, A.y + Math.sin(an) * rr * 0.85); g.lineTo(A.x + Math.cos(an) * rr, A.y + Math.sin(an) * rr); } g.stroke();
    g.fillStyle = rgba(col, 0.2 * a); g.beginPath(); g.moveTo(A.x, A.y); g.arc(A.x, A.y, rr, -Math.PI / 2, hand); g.closePath(); g.fill(); g.lineWidth = 3; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(A.x + Math.cos(hand) * rr * 0.75, A.y + Math.sin(hand) * rr * 0.75); g.stroke();
  },
  slashes(g, p, P, S, R) {
    const T = pt1(S, P.at || 'tg'), col = C(R, P.c2, 1);
    for (let k = 0, n = P.n || 2; k < n; k++) { const st = (P.d ?? 0.3) + k * 0.16, q = cl((p - st) / 0.1), fade = cl(1 - (p - st - 0.1) / 0.35); if (q <= 0 || fade <= 0) continue; const ang = k % 2 ? -0.6 : 0.6, L = S.u * 1.2, a0 = { x: T.x - Math.cos(ang) * L, y: T.y - Math.sin(ang) * L * 0.8 - S.u * 0.2 }, b0 = { x: T.x + Math.cos(ang) * L, y: T.y + Math.sin(ang) * L * 0.8 - S.u * 0.2 }; g.save(); g.globalCompositeOperation = 'lighter'; brush(g, [a0, b0], S.u * 0.2, col, 0.6 * fade, 0, eo(q), 0.5); brush(g, [a0, b0], S.u * 0.06, '#ffffff', fade, 0, eo(q), 0.5); g.restore(); }
  },
  // 其它
  hail(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'tg'), ci = C(R, P.c, 0), lv = C(R, P.c2, 1), a = env(p, 0.02, 0.15);
    for (let i = 0, n = P.n || 16; i < n; i++) { const ox = (r() - 0.5) * S.u * 1.6, d = r() * 0.5, q = cl((p - d) / 0.3); if (q <= 0 || q >= 1) continue; if (i % 2 === 0) { const x = A.x + ox, y = lerp(-10, A.y, ei(q)); g.fillStyle = rgba('#ffffff', a); g.strokeStyle = rgba(ci, a); g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 4, y); g.lineTo(x, y + 5); g.lineTo(x - 4, y); g.closePath(); g.fill(); g.stroke(); } else radial(g, A.x + ox * 0.6, lerp(A.y + S.u * 0.5, A.y - S.u * 1.2, eo(q)) + q * q * S.u, S.u * 0.16, lv, a); }
  },
  ding(g, p, P, S, R) {
    const A = pt1(S, P.at || 'tg'), d0 = P.d ?? 0.35, q = eo(cl((p - d0) / 0.2)), bur = cl((p - d0 - 0.3) / 0.25), a = env(p, 0, 0.1); if (q <= 0) return; const s = S.u * 0.85 * q, x = A.x, y = A.y - S.u * 1.1;
    if (bur < 1) { g.save(); g.globalAlpha = a * (1 - bur); g.strokeStyle = '#1c1915'; g.fillStyle = rgba(C(R, P.c2, 2), 0.88); g.lineWidth = 2; g.beginPath(); g.moveTo(x - s * 0.6, y - s * 0.3); g.lineTo(x + s * 0.6, y - s * 0.3); g.quadraticCurveTo(x + s * 0.65, y + s * 0.35, x, y + s * 0.38); g.quadraticCurveTo(x - s * 0.65, y + s * 0.35, x - s * 0.6, y - s * 0.3); g.fill(); g.stroke(); g.beginPath(); [-0.35, 0, 0.35].forEach(k => { g.moveTo(x + k * s, y + s * 0.3); g.lineTo(x + k * s * 1.2, y + s * 0.65); }); [-1, 1].forEach(k => { g.moveTo(x + k * s * 0.45, y - s * 0.3); g.lineTo(x + k * s * 0.45, y - s * 0.55); g.lineTo(x + k * s * 0.25, y - s * 0.55); g.lineTo(x + k * s * 0.25, y - s * 0.3); }); g.stroke(); g.restore(); }
    if (bur > 0 && bur < 1) { g.save(); g.globalCompositeOperation = 'lighter'; radial(g, x, y, S.u * (0.4 + bur * 1.6), C(R, P.c2, 1), 0.85 * (1 - bur)); radial(g, x, y, S.u * (0.3 + bur * 1.2), C(R, P.c, 0), 0.65 * (1 - bur)); g.restore(); }
  },
  spikes(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'tgs'), col = C(R, P.c, 0), a = env(p, 0.02, 0.25), xs = L.map(t => t.x), x0 = S.dir > 0 ? Math.min(...xs) - S.u : Math.max(...xs) + S.u, x1 = S.dir > 0 ? Math.max(...xs) + S.u : Math.min(...xs) - S.u;
    L.forEach(t => { for (let i = 0, n = P.n || 3; i < n; i++) { const ox = (r() - 0.5) * S.u * 1.1, h = S.u * (0.5 + r() * 0.5), w = S.u * 0.15, jit = r() * 0.15, st = (P.d ?? 0.1) + (P.seq ? cl((t.x + ox - x0) / (x1 - x0 || 1)) * 0.4 : jit), q = eo(cl((p - st) / 0.12)); if (q <= 0) continue; const x = t.x + ox, by = t.y + S.u * 0.5; g.fillStyle = rgba(col, 0.95 * a); g.strokeStyle = rgba('#1c1915', 0.8 * a); g.lineWidth = 1; g.beginPath(); g.moveTo(x - w, by); g.lineTo(x + (r() - 0.5) * 2, by - h * q); g.lineTo(x + w, by); g.closePath(); g.fill(); g.stroke(); } });
  },
  swords(g, p, P, S, R, r) {
    const L = pts(S, P.at || 'foes'), col = C(R, P.c, 1), ang = P.ang ?? 0.35;
    for (let i = 0, n = P.n || 18; i < n; i++) { const t = L[i % L.length], ox = (r() - 0.5) * S.u * 1.4, oy = (r() - 0.5) * S.u * 0.5, d = r() * 0.55, q = cl((p - d) / 0.18), stay = cl((p - d - 0.18) / 0.3); if (q <= 0 || stay >= 1) continue; const tx = t.x + ox, ty = t.y + S.u * 0.4 + oy, sx = tx - Math.sin(ang) * S.h * S.dir, sy = ty - S.h, hx = lerp(sx, tx, ei(q)), hy = lerp(sy, ty, ei(q)), dl = Math.hypot(tx - sx, ty - sy), ux = (tx - sx) / dl, uy = (ty - sy) / dl, len = S.u * 0.7, aa = 1 - stay; g.strokeStyle = rgba(col, aa); g.lineWidth = 2.2; g.beginPath(); g.moveTo(hx - ux * len, hy - uy * len); g.lineTo(hx, hy); g.stroke(); g.strokeStyle = rgba('#1c1915', aa); g.lineWidth = 3; g.beginPath(); g.moveTo(hx - ux * len, hy - uy * len); g.lineTo(hx - ux * len * 0.78, hy - uy * len * 0.78); g.moveTo(hx - ux * len * 0.78 - uy * 5, hy - uy * len * 0.78 + ux * 5); g.lineTo(hx - ux * len * 0.78 + uy * 5, hy - uy * len * 0.78 - ux * 5); g.stroke(); }
  },
  wind(g, p, P, S, R, r) {
    const A = pt1(S, P.at || 'from'), L = pts(S, P.to || 'tgs'), col = C(R, P.c, 1);
    for (let i = 0, n = P.n || 6; i < n; i++) { const t = L[i % L.length], d = r() * 0.4, oy = (r() - 0.5) * S.u * 0.8, q = cl((p - d) / 0.35); if (q <= 0 || q >= 1) continue; const s = S.u * 0.42; g.save(); g.translate(lerp(A.x, t.x + S.dir * S.u * 0.8, eo(q)), lerp(A.y + oy, t.y + oy * 0.3, eo(q))); g.scale(S.dir, 1); g.strokeStyle = rgba(col, 0.9 * (1 - q * 0.5)); g.lineWidth = 2.6; g.beginPath(); g.arc(-s * 0.6, 0, s, -0.9, 0.9); g.stroke(); g.lineWidth = 1; g.beginPath(); g.arc(-s * 0.95, 0, s * 0.8, -0.7, 0.7); g.stroke(); g.restore(); }
  },
  swap(g, p, P, S, R) {
    const A = pt1(S, P.at || 'from'), B = pt1(S, P.to || 'ally'), col = C(R, P.c, 1), q = eio(cl((p - 0.15) / 0.5)), a = env(p, 0.05, 0.15);
    [[A, B, -1], [B, A, 1]].forEach(([u, v, k]) => { for (let j = 0; j < 5; j++) { const qq = cl(q - j * 0.06); bug(g, lerp(u.x, v.x, qq), lerp(u.y, v.y, qq) + k * Math.sin(qq * Math.PI) * S.u * 0.8, S.u * 0.7, col, (j ? 0.15 : 0.75) * a, S.dir); } });
  },
  moon(g, p, P, S) {
    const x = S.w * (S.dir > 0 ? 0.3 : 0.7), y = S.h * 0.14, rr = S.u * 0.55, a = env(p, 0.15, 0.2); g.save(); g.globalCompositeOperation = 'lighter'; radial(g, x, y, rr * 2.5, '#dfe6ff', 0.3 * a); g.restore();
    g.fillStyle = rgba('#eef0f6', a); g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill(); g.fillStyle = rgba('#000000', 0.12 * a); g.beginPath(); g.arc(x - rr * 0.3, y + rr * 0.15, rr * 0.18, 0, TAU); g.arc(x + rr * 0.25, y - rr * 0.25, rr * 0.12, 0, TAU); g.fill();
  },
});

// ---------- 配方：每个杀招一份（[特效, 起 ms, 止 ms, 参数]，镜头 [推/拉/摇/震, 起, 止, 量, 锚点]） ----------
const X = (id, n, seal, c, dur, nm, L, cam = [], o = {}) => ({ id, n, seal, c, dur, nm, L, cam, ...o });
const D = (a = 0.38, c) => ['dim', 0, 99999, { a, c }];
export const COMBO_FX = Object.fromEntries([
  // 力
  X('sanzhu', '烈火三豕冲', '力', ['#b5301f', '#e08a3a'], 1900, 1250, [D(0.38), ['charge', 100, 1200, { n: 3, gap: 0.14, len: 0.5 }], ['scorch', 500, 1900, { n: 3 }], ['embers', 600, 1800, { n: 30, up: 1 }]], [['tilt', 0, 1900, 10], ['shake', 380, 540, 6], ['shake', 560, 720, 6], ['shake', 740, 920, 6]]),
  X('pozhen', '擂鼓破阵', '力', ['#b5301f', '#1c1915'], 2000, 1300, [D(0.3), ['drum', 0, 1800, { beats: [0.36, 0.56, 0.7], s: 1.4, lift: 0.6 }], ['rings', 0, 1800, { at: 'allyC', ts: [0.36, 0.56, 0.7], R: 3.2, c: 1 }], ['glow', 1200, 2000, { stripe: 1 }]], [['push', 1240, 1700, 1.12, 'mid'], ['shake', 1260, 1420, 4]]),
  X('huangzai', '蝗过千里', '力', ['#7a6a2a', '#3a3a1a'], 1900, 1200, [D(0.3), ['stain', 300, 1900, { c: '#a08a3a', a: 0.4, in: 0.5 }], ['swarm', 0, 1600, { n: 220, start: 'br' }]], [['pan', 0, 1700, -16]]),
  // 炎
  X('fenshen', '焚身诀', '炎', ['#d0632a', '#7a1a10'], 2000, 1250, [D(0.35), ['burst', 0, 1300, { b: 0.3, n: 16, R: 2.6 }], ['dim', 450, 1500, { c: '#d0632a', a: 0.28 }], ['embers', 900, 2000, { n: 40, c: 0 }]], [['zoom', 0, 1000, 0.9, 'tg'], ['shake', 400, 600, 5]]),
  X('lieyang', '烈阳焚野', '炎', ['#f0b03a', '#d0632a'], 2300, 1500, [D(0.32, '#1a0e05'), ['sun', 0, 2300, { rise: 0.42, rays: 18, s: 0.6 }], ['haze', 600, 2200, {}], ['carpet', 1400, 2300, { in: 0.04, n: 8 }]], [['tilt', 0, 1200, -12]]),
  // 冰
  X('bingfeng', '冰火两重', '冰', ['#6a9cc0', '#d0632a'], 1900, 1200, [['split', 0, 1900, { a: 0.28 }], ['helix', 250, 1500, { h: 2.3 }], ['shards', 1300, 1900, { n: 26 }]], [['zoom', 0, 1900, 1.08, 'tg']]),
  X('hanchuan', '寒川锁江', '冰', ['#a8c8e0', '#ffffff'], 2100, 1300, [D(0.32, '#0b1420'), ['iceline', 0, 1500, { n: 30 }], ['icicle', 0, 1900, { d: 0.35 }], ['snow', 800, 2100, { n: 50 }]], [['zoom', 0, 2100, 0.94, 'mid']]),
  // 金
  X('jinjia', '金甲不坏身', '金', ['#a8803e', '#e8c76a'], 2000, 1300, [D(0.3), ['plates', 0, 1600, { n: 12, step: 0.045 }], ['crack', 1050, 2000, { R: 1.3, n: 8 }], ['glow', 1100, 1700, { at: 'from', c: 1 }]], [['pan', 0, 1700, 20], ['zoom', 0, 1800, 1.12, 'from']]),
  X('kaishan', '开山断岳', '金', ['#8a6a3a', '#c0c0c0'], 1800, 1150, [D(0.42), ['blade', 0, 1300, {}], ['debris', 600, 1500, {}], ['crack', 600, 1800, { at: 'tg', R: 1, n: 5 }]], [['zoom', 0, 650, 1.1, 'tg'], ['shake', 600, 820, 7]]),
  // 木
  X('pojian', '破茧成蝶', '木', ['#5e8a4a', '#e8d8f0'], 2400, 1600, [D(0.3, '#100c14'), ['cocoon', 0, 1700, {}], ['wings', 600, 2400, { d: 0.25, s: 1.5 }]], [['zoom', 0, 2400, 1.08, 'from']]),
  X('burou', '肉身不朽', '木', ['#7a9a5a', '#c0a080'], 2100, 1400, [D(0.3), ['blobs', 0, 1500, { n: 8 }], ['sprouts', 1000, 2100, { onBody: 1, n: 10 }], ['glow', 1300, 2100, { at: 'from' }]], [['zoom', 0, 2000, 1.15, 'from']]),
  // 土
  X('xuanwu', '玄武镇关', '土', ['#4a5a4a', '#8a6a3a'], 2100, 1400, [D(0.3), ['mountain', 0, 1500, { mode: 'sink', s: 2.2 }], ['hexes', 900, 2100, {}], ['dust', 600, 2100, {}]], [['tilt', 0, 2100, 14], ['zoom', 0, 2100, 1.06, 'from']]),
  X('liusha', '流沙陷阵', '土', ['#c0a060', '#6a5030'], 2000, 1300, [D(0.3), ['funnel', 0, 1900, {}], ['dust', 900, 2000, { at: 'front', n: 14, wide: 1.4 }]], [['zoom', 0, 1900, 1.1, 'front']]),
  X('banshan', '搬山移海', '土', ['#8a6a3a', '#4a3a2a'], 2000, 1300, [D(0.3), ['rock', 0, 1600, {}], ['debris', 0, 500, { at: 'front', c: '#4a3a2a' }], ['dust', 1100, 2000, { at: 'foeBack' }]], [['pan', 300, 1500, 18], ['shake', 1100, 1300, 4]]),
  // 雷
  X('leigu', '雷鼓破天', '雷', ['#3a6aa8', '#ffffff'], 1600, 1000, [D(0.45, '#05070d'), ['drum', 0, 1100, { at: 'from', beats: [0.35], s: 0.8, lift: 1.3 }], ['chain', 350, 1100, { n: 2, c: 0 }], ['flash', 450, 560, { a: 0.6 }], ['flash', 750, 860, { a: 0.6 }]], [['shake', 450, 600, 4], ['shake', 750, 900, 4]]),
  X('jiutian', '九天引雷', '雷', ['#5a8ad0', '#e8e070'], 2000, 1300, [D(0.55, '#03050a'), ['motes', 0, 900, { fly: 0.7 }], ['bolts', 900, 1500, { c: 0 }], ['flash', 900, 1100, { n: 2, a: 0.8 }]], [['tilt', 0, 1000, -14], ['zoom', 1000, 2000, 0.95, 'foeC']]),
  X('chunlei', '春雷乍惊', '雷', ['#6a8ac0', '#9ac070'], 2000, 1300, [D(0.3), ['band', 0, 1100, { y: 0.12 }], ['sprouts', 500, 2000, { at: 'foes', n: 6, c: 1, wide: 1.6 }], ['stars', 800, 2000, {}], ['flash', 600, 700, { a: 0.35 }]], [['zoom', 0, 2000, 0.92, 'mid']]),
  // 光
  X('liuying', '流萤焚夜', '光', ['#e7d77a', '#1c1915'], 2300, 1500, [D(0.62, '#04050c'), ['meteor', 0, 2000, { n: 70 }], ['carpet', 1600, 2300, { n: 4, h: 0.6, c: '#e2672e', c2: '#f6c24a' }]], [['zoom', 0, 2300, 1.04, 'foeC']]),
  X('jinghua', '镜花水月', '光', ['#c0d8e8', '#e8a0c0'], 1900, 1200, [D(0.35, '#0a0c12'), ['mirror', 0, 1900, {}]], [['zoom', 0, 1900, 1.08, 'from']]),
  X('liguang', '琉璃照影', '光', ['#f0e8c0', '#80c0e0'], 1900, 1250, [D(0.45), ['prism', 0, 1900, {}]], [['pan', 0, 1900, 10]]),
  // 暗
  X('duopo', '噬心夺魄', '暗', ['#3a3346', '#8a1f2b'], 1700, 1100, [D(0.5, '#07050a'), ['ghost', 0, 1500, { n: 2 }]], [['push', 250, 700, 1.1, 'tg'], ['push', 900, 1350, 1.1, 'tg']]),
  X('yeshi', '夜蚀', '暗', ['#1c1915', '#c0c0d0'], 2300, 1500, [['eclipse', 0, 2300, {}], ['marks', 900, 2100, { d: 0.15, step: 0.08, ch: '蚀' }], ['claw', 1500, 2100, { d: 0.3 }]], [['zoom', 0, 2300, 0.96, 'mid']]),
  // 血
  X('chichao', '赤潮', '血', ['#8a1f2b', '#d04050'], 2000, 1300, [D(0.4, '#0e0406'), ['stream', 0, 1800, {}]], [['pan', 0, 1800, -14]]),
  // 毒
  X('wudu', '五毒噬心', '毒', ['#4f7a3a', '#6a3a7a'], 2100, 1400, [D(0.35), ['crawl', 0, 1800, { n: 2 }], ['bubbles', 300, 2000, { n: 4 }], ['fog', 1000, 2100, { a: 0.4 }]], [['zoom', 0, 2100, 0.95, 'foeC']]),
  // 智
  X('tianluo', '天罗地网', '智', ['#d8d0c0', '#1c1915'], 1900, 1250, [D(0.45), ['web', 0, 1900, { R: 2.5 }], ['wrap', 0, 1900, { d: 0.5 }]], [['tilt', 0, 900, -10]]),
  X('suanwu', '算无遗策', '智', ['#3d5a8a', '#e8e0c0'], 2200, 1450, [D(0.4), ['board', 0, 2200, { n: 5, c: 1, c2: 0 }]], [['zoom', 0, 2200, 1.05, 'foeC']]),
  // 魂
  X('tuoke', '金蝉脱壳', '魂', ['#c8a040', '#efe7d4'], 1900, 1250, [D(0.4), ['mono', 0, 450, {}], ['shell', 0, 1900, {}]], [['push', 0, 500, 1.15, 'from'], ['pan', 400, 1200, -12]]),
  X('shijie', '尸解登仙', '魂', ['#5a4a7a', '#e8e0f0'], 2300, 1500, [D(0.45, '#0a0810'), ['embers', 0, 1000, { at: 'from', n: 40, c: '#8a8a8a' }], ['soul', 200, 2200, {}], ['pillar', 1800, 2300, { at: 'ally', c: 1, w: 0.35 }]], [['zoom', 0, 2300, 1.06, 'from']]),
  // 奴
  X('baiyi', '百蚁噬象', '奴', ['#9a4a2c', '#1c1915'], 2100, 1400, [D(0.3), ['ants', 0, 2000, { n: 9 }]], [['tilt', 0, 2000, 10]]),
  X('tixian', '提线百傀', '奴', ['#8a3030', '#d8d0c0'], 2100, 1400, [D(0.45), ['threads', 0, 2100, {}]], [['tilt', 0, 2100, -12]]),
  // 宇、宙
  X('xumi', '芥子纳须弥', '宇', ['#4a8a86', '#efe7d4'], 2200, 1500, [D(0.35), ['fold', 0, 2200, {}]], [['squash', 300, 1500, 0.5], ['zoom', 0, 2200, 0.92, 'mid']]),
  X('yiri', '一日千秋', '宙', ['#d8c890', '#8a7a3a'], 2100, 1400, [D(0.35), ['sweep', 0, 2100, {}]], [['pan', 0, 1500, -12]]),
  X('chana', '刹那芳华', '宙', ['#8a7a3a', '#ffffff'], 1700, 1150, [['mono', 0, 1300, {}], D(0.25), ['slashes', 0, 1600, { n: 2, d: 0.3 }]], [['push', 450, 950, 1.12, 'tg']]),
  // 进阶
  X('sanzhu2', '焚原三豕', '力', ['#b5301f', '#e08a3a', '#3a3a1a'], 2400, 1600, [D(0.45), ['charge', 0, 1100, { n: 3, gap: 0.12, len: 0.5 }], ['swarm', 300, 1500, { n: 200, burn: 1, c: 2 }], ['firewall', 900, 2100, { h: 1.3 }], ['scorch', 1500, 2400, { n: 3 }]], [['zoom', 0, 2400, 0.9, 'mid'], ['shake', 1000, 1500, 5]], { adv: 1 }),
  X('jinjia2', '万钧金身', '金', ['#a8803e', '#e8c76a', '#c0c0c0'], 2300, 1550, [D(0.35), ['plates', 0, 1300, { n: 12, step: 0.04 }], ['plates', 900, 2000, { quill: 1, n: 10, step: 0.035 }], ['crack', 1300, 2300, { R: 2.2, n: 11 }], ['glow', 1500, 2100, { at: 'from', c: 2 }]], [['pan', 0, 2000, 28], ['zoom', 0, 2000, 1.15, 'from'], ['roll', 0, 2000, 2]], { adv: 1 }),
  X('pojian2', '化蝶三生', '木', ['#5e8a4a', '#e8d8f0', '#f0c050'], 2600, 1750, [D(0.35, '#0c0a10'), ['tree', 0, 2600, {}], ['cocoon', 0, 1300, {}], ['flit', 500, 2600, {}]], [['zoom', 0, 2600, 0.94, 'from'], ['pan', 0, 2600, 10]], { adv: 1 }),
  X('xuanwu2', '玄武负山', '土', ['#4a5a4a', '#8a6a3a', '#b5301f'], 2400, 1600, [D(0.35), ['mountain', 0, 1500, { mode: 'sink', s: 2.2 }], ['mountain', 700, 2400, { s: 3, dx: -1.5, a: 0.7, peaks: [[-0.55, 0.4], [-0.3, 0.75], [0, 1], [0.3, 0.75], [0.55, 0.4]] }], ['flag', 0, 2400, { d: 0.55 }], ['hexes', 900, 2400, {}]], [['tilt', 0, 2400, 14], ['zoom', 0, 2400, 1.08, 'from']], { adv: 1 }),
  X('leigu2', '雷霆万钧', '雷', ['#3a6aa8', '#ffffff', '#a0a0ff'], 2200, 1450, [D(0.5, '#05050d'), ['drum', 0, 1200, { at: 'from', beats: [0.25, 0.45, 0.65], s: 0.8, lift: 1.3 }], ['web', 600, 2100, { R: 2.4, c: 2, elec: 1 }], ['chain', 800, 1500, { n: 3, c: 2 }], ['flash', 800, 900, { a: 0.6 }], ['flash', 1100, 1200, { a: 0.6 }], ['flash', 1400, 1500, { a: 0.6 }]], [['tilt', 600, 2000, -10]], { adv: 1 }),
  X('jiutian2', '九霄雷劫', '雷', ['#5a8ad0', '#e8e070', '#d9a441'], 2500, 1650, [D(0.6, '#020308'), ['cracks', 0, 1000, { n: 9 }], ['motes', 300, 1100, { fly: 0.6 }], ['bolts', 1000, 1900, { n: 9, gap: 0.07, life: 0.2, last: 1, c: 0 }], ['dim', 1900, 2500, { c: '#d9a441', a: 0.25 }], ['flash', 1700, 1850, { a: 0.7 }]], [['tilt', 0, 1100, -16], ['shake', 1650, 1900, 6]], { adv: 1 }),
  X('wudu2', '万毒归宗', '毒', ['#4f7a3a', '#6a3a7a', '#1c1915'], 2300, 1550, [D(0.4), ['crawl', 0, 1300, { at: 'tg', n: 5, converge: 1 }], ['penta', 900, 1800, {}], ['fog', 1500, 2300, { at: 'tg', n: 5, a: 0.6 }], ['bubbles', 1500, 2300, { at: 'tg', n: 8 }]], [['zoom', 0, 1800, 1.1, 'tg']], { adv: 1 }),
  X('bingfeng2', '冰火同炉', '冰', ['#6a9cc0', '#d0632a', '#7a1a10'], 2400, 1600, [['split', 0, 2400, { a: 0.3 }], ['helix', 0, 1100, {}], ['hail', 700, 1700, { n: 20 }], ['ding', 0, 2000, { d: 0.45 }], ['shards', 1600, 2400, { n: 30 }]], [['zoom', 0, 2400, 1.06, 'tg']], { adv: 1 }),
  X('hanchuan2', '万里冰原', '冰', ['#a8c8e0', '#ffffff', '#6a9cc0'], 2500, 1650, [D(0.22, '#e8f0f8'), ['iceline', 0, 900, {}], ['lake', 0, 2500, { d: 0.25 }], ['dart', 0, 2500, { d: 0.45 }], ['spikes', 1100, 2500, { at: 'foes', n: 2, seq: 1, d: 0, c: 2 }], ['snow', 0, 2500, { n: 60 }]], [['zoom', 0, 2500, 0.88, 'mid']], { adv: 1 }),
  // 旧版杀招（还在旧表里的几个）
  X('liaoyuan', '天火燎原', '炎', ['#d0632a', '#f0b03a'], 2000, 1300, [D(0.4), ['meteor', 0, 1200, { fire: 1, n: 16 }], ['firewall', 800, 1900, {}]], [['shake', 900, 1200, 4]]),
  X('wangu', '万蛊朝宗', '奴', ['#6a5a2a', '#d9a441'], 2100, 1400, [D(0.35), ['converge', 0, 1800, { n: 80 }], ['glow', 1200, 2100, { at: 'from', c: 1 }], ['rings', 1100, 2100, { at: 'from', ts: [0.1, 0.35], R: 2.2, c: 1 }]], [['zoom', 0, 2100, 1.08, 'from']]),
  X('jingji', '荆棘王座', '木', ['#3e5a2a', '#8a1f2b'], 1900, 1250, [D(0.35), ['thorns', 0, 1900, { n: 14 }], ['swords', 500, 1700, { n: 14, c: 0 }]], [['zoom', 0, 1900, 1.1, 'from']]),
  X('shishan', '尸山月影', '魂', ['#4a4a5a', '#d0d4e8'], 2200, 1450, [D(0.5, '#05060c'), ['moon', 0, 2200, {}], ['mountain', 0, 2200, { s: 1.6, peaks: [[-0.4, 0.5], [0, 0.8], [0.4, 0.5]] }], ['wings', 600, 2200, { s: 1.1, c: '#3a3a4a', c2: '#6a6a7a', d: 0.2, a: 0.8 }]], [['tilt', 0, 2200, -8]]),
  X('baichong', '百虫入瓮', '奴', ['#7a5a3a', '#3a2a1a'], 2000, 1300, [D(0.35), ['urn', 0, 2000, {}], ['vortex', 300, 1800, { at: 'mid', n: 80, R: 2.4, c: 1, c2: 0 }]], [['zoom', 0, 2000, 1.08, 'mid']]),
  X('yixing', '移形换影', '宇', ['#6a8aa0', '#e0e8f0'], 1800, 1150, [D(0.35), ['swap', 0, 1600, {}], ['wind', 200, 1400, { n: 8, to: 'allies' }]], [['pan', 0, 1600, 12]]),
  X('tuibao', '金蟾吐宝', '金', ['#d9a441', '#7a9a5a'], 2000, 1300, [D(0.3), ['coins', 0, 1900, { n: 16 }], ['glow', 1200, 2000, { at: 'allies' }]], [['pan', 0, 1800, -10]]),
  // 低转杀招（combos2 里 low 的那几个）
  X('yingxue', '萤雪映书', '光', ['#e8e0a0', '#a8c8e0'], 2300, 1500, [D(0.55, '#05060c'), ['motes', 0, 1300, { at: 'foeC', src: 'allyC', n: 9, fly: 0.75, c: 0 }], ['glow', 900, 2300, { at: 'foeC', c: 0 }], ['marks', 1000, 2200, { at: 'foes', d: 0.05, step: 0.05, ch: '照', c: 0 }], ['snow', 1100, 2300, { at: 'frontCol', n: 36, c: 1 }]], [['zoom', 0, 2300, 1.04, 'foeC']]),
  X('zhuma', '竹马之交', '木', ['#7a9a4a', '#e8d8c0'], 2000, 1300, [D(0.28), ['flit', 0, 1800, { at: 'allyC', loops: 1, c: 0, c2: 1 }], ['sprouts', 500, 1900, { at: 'allies', n: 5, wide: 1.2 }], ['glow', 1100, 2000, { at: 'allies', c: 0 }]], [['pan', 0, 1800, 10]]),
  X('maodu', '毛蜱吮毒', '血', ['#8a1f2b', '#6a8a3a'], 1800, 1150, [D(0.4, '#0e0406'), ['bubbles', 0, 1100, { at: 'tg', n: 3, c: 1 }], ['stream', 400, 1700, { at: 'tg', to: 'from', n: 30, c: 0, c2: 1 }], ['glow', 1200, 1800, { at: 'from', c: 0 }]], [['push', 0, 600, 1.12, 'tg'], ['zoom', 900, 1800, 1.1, 'from']]),
  X('jingyu', '惊雷细雨', '雷', ['#5a7ab0', '#a0c0d0'], 1900, 1250, [D(0.5, '#05070d'), ['snow', 0, 1900, { n: 70, c: 1, rain: 1 }], ['rings', 0, 900, { at: 'from', ts: [0.1, 0.32], R: 1.6, c: 1 }], ['bolts', 650, 1300, { at: 'tgs', n: 2, gap: 0.22, life: 0.45, c: 0 }], ['flash', 700, 800, { a: 0.35 }], ['flash', 880, 980, { a: 0.35 }]], [['shake', 700, 830, 3], ['shake', 880, 1010, 3]]),
  X('guihuo', '鬼火引路', '魂', ['#6ac0a0', '#3a3a4a'], 2000, 1300, [D(0.5, '#06080a'), ['embers', 0, 900, { at: 'from', n: 16, c: 0, up: 1 }], ['motes', 300, 1100, { at: 'tgs', n: 6, fly: 0.6, c: 0 }], ['web', 900, 2000, { R: 2.2, c: 0 }], ['embers', 1300, 2000, { at: 'tgs', n: 24, c: 0, up: 1 }]], [['tilt', 0, 1000, -8]]),
  X('xiaobing', '小卒推山', '奴', ['#8a6a3a', '#5a4a3a'], 1900, 1250, [D(0.3), ['glow', 0, 800, { at: 'from', c: 0 }], ['rock', 0, 1500, { at: 'from', to: 'front', arc: 0.12, c: 0 }], ['dust', 900, 1900, { at: 'front', n: 14, wide: 1.4 }]], [['tilt', 0, 1900, 8], ['push', 300, 1150, 1.12, 'front'], ['shake', 1000, 1150, 5]]),
  X('shousui', '守岁', '宙', ['#b5301f', '#d9a441'], 2100, 1400, [D(0.35), ['clock', 0, 2000, { c: 1 }], ['dome', 900, 2100, {}]], [['zoom', 0, 2100, 1.08, 'from']]),
].map(r => [r.id, r]));

// 没写配方的新杀招：按 id 稳定地挑一组特效和配色，同一个 id 永远长一个样；进阶杀招（xxx2）在原版上加金色光柱和收尾闪光
const POOL = [
  ['firewall', {}], ['bolts', {}], ['swords', {}], ['fog', {}], ['dome', { at: 'from' }], ['ghost', {}], ['vortex', {}], ['icicle', {}], ['stream', {}], ['wind', {}], ['spikes', {}], ['pillar', {}],
  ['burst', {}], ['rings', { at: 'from' }], ['meteor', {}], ['crack', { at: 'tg' }], ['marks', {}], ['bubbles', {}], ['coins', {}], ['thorns', {}],
];
const PALS = [['#b5301f', '#e08a3a'], ['#3a6aa8', '#cfe6ff'], ['#4f7a3a', '#9ac070'], ['#6a3a7a', '#e8a0c0'], ['#a8803e', '#e8c76a'], ['#8a1f2b', '#d04050'], ['#4a8a86', '#efe7d4'], ['#5a4a7a', '#c0c0d0']];
function recipeOf(id, name) {
  if (COMBO_FX[id]) return COMBO_FX[id];
  const base = /2$/.test(id || '') && COMBO_FX[id.slice(0, -1)];
  if (base) return { ...base, id, n: name || base.n, adv: 1, dur: base.dur + 300, L: base.L.concat([['pillar', base.dur - 500, base.dur + 300, { at: 'from', c: '#d9a441', w: 0.45 }], ['flash', base.dur - 200, base.dur, { c: '#f2c35a', a: 0.4 }]]) };
  const h = hashOf(id || name || 'x'), a = POOL[h % POOL.length], b = POOL[(h >>> 5) % POOL.length], b2 = b === a ? POOL[(h >>> 9) % POOL.length] : b;
  return X(id || 'x', name || '杀招', '杀', PALS[(h >>> 13) % PALS.length], 1900, 1200, [D(0.38), [a[0], 0, 1500, a[1]], [b2[0], 400, 1900, b2[1]]], [['zoom', 0, 1900, 1.06, 'tg']]);
}

// ---------- 镜头 ----------
function camAt(R, T, S) {
  let s = 1, sx = 1, x = 0, y = 0, rot = 0, A = { x: S.w / 2, y: S.h / 2 }; const red = S.reduce;
  for (const [k, t0, t1, v, at] of R.cam || []) {
    if (T < t0 || T > t1) continue; const p = (T - t0) / (t1 - t0), e = eio(env(p, 0.3, 0.3));
    if (k === 'zoom') { s *= 1 + (v - 1) * e * (red ? 0.5 : 1); if (at) A = pt1(S, at); }
    else if (k === 'push') { const f = p < 0.25 ? eo(p / 0.25) : 1 - eio((p - 0.25) / 0.75); s *= 1 + (v - 1) * f * (red ? 0.4 : 1); if (at) A = pt1(S, at); }
    else if (k === 'shake') { if (red) continue; const amp = v * (1 - p); x += Math.sin(T * 0.13) * amp; y += Math.cos(T * 0.17) * amp * 0.6; }
    else if (k === 'pan') x += v * S.dir * e * (red ? 0.5 : 1);
    else if (k === 'tilt') y += v * e * (red ? 0.5 : 1);
    else if (k === 'squash') { sx *= 1 - (1 - v) * Math.sin(p * Math.PI) * (red ? 0.5 : 1); A = pt1(S, 'mid'); }
    else if (k === 'roll') rot += v * e * (red ? 0 : 1);
  }
  return { s, sx, x, y, rot, A };
}
const camCss = c => `translate(${(c.A.x + c.x).toFixed(1)}px,${(c.A.y + c.y).toFixed(1)}px) rotate(${c.rot.toFixed(2)}deg) scale(${(c.s * c.sx).toFixed(4)},${c.s.toFixed(4)}) translate(${(-c.A.x).toFixed(1)}px,${(-c.A.y).toFixed(1)}px)`;
const camCtx = (g, c) => { g.translate(c.A.x + c.x, c.A.y + c.y); g.rotate(c.rot * Math.PI / 180); g.scale(c.s * c.sx, c.s); g.translate(-c.A.x, -c.A.y); };

function drawFx(g, R, T, S) {
  R.L.forEach(([k, t0, t1, P], li) => {
    const f = PR[k]; if (!f || T < t0 || T > Math.min(t1, R.total || 1e9)) return;
    const span = Math.min(t1, R.total || t1) - t0, p = span > 0 ? cl((T - t0) / span) : 1;
    g.save(); try { f(g, p, P || {}, S, R, rngOf(S.seed + li * 7919)); } finally { g.restore(); }
  });
}
function sceneOf(o) {
  const w = o.w || 360, h = o.h || 200, side = o.side ? 1 : 0, dir = side ? -1 : 1, from = o.from || { x: w * (side ? 0.7 : 0.3), y: h * 0.55 };
  const foes = o.foes && o.foes.length ? o.foes : [{ x: w * (side ? 0.25 : 0.75), y: h * 0.55 }], allies = o.allies && o.allies.length ? o.allies : [from];
  return { w, h, side, dir, from, foes, allies, targets: o.targets && o.targets.length ? o.targets : foes, u: o.u || Math.min(90, w / 6.4), reduce: !!o.reduce, seed: hashOf(o.id || o.name || 'x'), sideCol: side ? '#d8553f' : '#6fb7a4', mono: 0 };
}
function timeline(R, name) { const n = [...(name || '')].length; const t = nameTimes(R, Math.max(1, n)); R.total = t.total; return t; }

// 播放：特效画在跟镜头一起动的画布上，招式名画在不动的那一层
export function playCombo(stage, o = {}) {
  return new Promise(done => {
    if (typeof document === 'undefined' || !stage || typeof requestAnimationFrame === 'undefined') return done();
    const R0 = recipeOf(o.id, o.name), R = { ...R0 }, S = sceneOf(o), sp = Math.max(0.25, o.speed || 1), dpr = Math.min(2, window.devicePixelRatio || 1), name = o.name || R.n || '';
    const mk = (host, z) => { const c = document.createElement('canvas'); c.width = Math.round(S.w * dpr); c.height = Math.round(S.h * dpr); c.style.cssText = `position:absolute;left:0;top:0;width:${S.w}px;height:${S.h}px;pointer-events:none;z-index:${z}`; host.appendChild(c); return { c, g: c.getContext('2d') }; };
    const fx = mk(stage, 44), hud = mk(o.hud || stage.parentElement || stage, 70), TL = timeline(R, name), NM = name ? prepName(name, nameSize(S, [...name].length)) : null;
    const grey = stage.querySelectorAll('.gbv-u, .gbv-floor'), oldO = stage.style.transformOrigin, t0 = performance.now();
    const tick = now => {
      let T = (now - t0) * sp; if (o.isSkip && o.isSkip()) T = TL.total; const end = T >= TL.total;
      fx.g.setTransform(dpr, 0, 0, dpr, 0, 0); fx.g.clearRect(0, 0, S.w, S.h); S.mono = 0; if (!end) drawFx(fx.g, R, T, S);
      stage.style.transformOrigin = '0 0'; stage.style.transform = end ? '' : camCss(camAt(R, T, S)); grey.forEach(u => { u.style.filter = S.mono ? 'grayscale(1)' : ''; });
      hud.g.setTransform(dpr, 0, 0, dpr, 0, 0); hud.g.clearRect(0, 0, S.w, S.h); if (NM && !end) drawName(hud.g, NM, S.w / 2, o.nameY || S.h * 0.17, T, TL, R);
      if (end) { fx.c.remove(); hud.c.remove(); stage.style.transform = ''; stage.style.transformOrigin = oldO; grey.forEach(u => { u.style.filter = ''; }); return done(); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// ---------- 总览：每个杀招按几个关键帧画成一排，方便一眼看出彼此不重样 ----------
function demoScene(w, h, id) {
  const allies = [[0.33, 0.52], [0.2, 0.36], [0.2, 0.7], [0.08, 0.54]].map(([x, y]) => ({ x: w * x, y: h * y })), foes = [[0.64, 0.4], [0.64, 0.68], [0.78, 0.54], [0.9, 0.38], [0.9, 0.72]].map(([x, y]) => ({ x: w * x, y: h * y }));
  return sceneOf({ id, w, h, side: 0, from: allies[0], allies, foes, targets: foes.slice(0, 2), u: w / 7.2 });
}
function drawDemoUnits(g, S) {
  g.fillStyle = '#1e1b16'; g.fillRect(-S.w, -S.h, S.w * 3, S.h * 3);
  g.strokeStyle = 'rgba(233,224,204,.12)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(S.w / 2, S.h * 0.18); g.lineTo(S.w / 2, S.h * 0.95); g.stroke(); g.setLineDash([]);
  [[S.allies, '#6fb7a4', 1], [S.foes, '#d8553f', -1]].forEach(([L, col, dir]) => L.forEach(t => { g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(t.x, t.y + S.u * 0.45, S.u * 0.4, S.u * 0.12, 0, 0, TAU); g.fill(); g.fillStyle = '#e7ddc7'; g.beginPath(); g.arc(t.x, t.y, S.u * 0.36, 0, TAU); g.fill(); g.strokeStyle = col; g.lineWidth = 2; g.stroke(); bug(g, t.x, t.y + 1, S.u * 0.62, '#1c1915', 0.9, dir); }));
}
// T：毫秒；传 'name' 画招式名写完、印章落下的那一刻
export function drawComboFrame(g, id, T, w, h) {
  const R = { ...recipeOf(id) }, S = demoScene(w, h, id), TL = timeline(R, R.n); if (T === 'name') T = Math.min(TL.total - 280, TL.seal + 260); const cam = camAt(R, T, S);
  g.save(); camCtx(g, cam); drawDemoUnits(g, S); drawFx(g, R, T, S); g.restore();
  drawName(g, prepName(R.n, Math.round(Math.min(26, w * 0.8 / ([...R.n].length * 1.015 + 1.25)))), w / 2, h * 0.15, T, TL, R);
}
export function comboSheet(el, o = {}) {
  const ids = o.ids || Object.keys(COMBO_FX), frames = o.frames || [0.12, 0.3, 0.5, 0.72, 'name'], w = o.w || 180, h = o.h || 112, dpr = o.dpr || 1;
  el.innerHTML = ''; el.style.cssText += ';display:grid;grid-template-columns:repeat(' + (o.cols || 2) + ',max-content);gap:10px 18px;background:#15130f;padding:14px;color:#ddd3bf;font:12px system-ui';
  ids.forEach(id => {
    const R = recipeOf(id), row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:4px';
    row.innerHTML = `<div style="width:76px;font:15px ${kaiFont()};line-height:1.25">${R.n}<br><small style="font:10px system-ui;color:#8f8775">${id}${R.adv ? ' · 进阶' : ''}</small></div>`;
    frames.forEach(f => { const T = f === 'name' ? f : f * R.dur, c = document.createElement('canvas'); c.width = w * dpr; c.height = h * dpr; c.style.cssText = `width:${w}px;height:${h}px;border-radius:3px`; const g = c.getContext('2d'); g.scale(dpr, dpr); drawComboFrame(g, id, T, w, h); row.appendChild(c); });
    el.appendChild(row);
  });
  return ids.length;
}
