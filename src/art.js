import { ZHENYUAN } from './core.js';
// 蛊码 GuCode · 程序水墨蛊虫。头朝右，viewBox 0 0 100 100。墨色主体 + 一抹淡彩，毛笔边靠 #ink/#wash 滤镜。
import { ART2 } from './art2.js';
const INK = '#1c1915', PAPER = '#efe7d4';
const aE = (cx, cy, rx, ry, f = INK, r = 0, ex = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}"${r ? ` transform="rotate(${r} ${cx} ${cy})"` : ''}${ex}/>`;
const aC = (cx, cy, r, f = INK, ex = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}"${ex}/>`;
const aP = (d, w = 2, s = INK, f = 'none', ex = '') => `<path d="${d}" stroke="${s}" stroke-width="${w}" fill="${f}" stroke-linecap="round" stroke-linejoin="round"${ex}/>`;
const aF = (d, f = INK, ex = '') => `<path d="${d}" fill="${f}"${ex}/>`;
const aLegs = arr => arr.map(([x, y, kx, ky, dx, dy, w]) => aP(`M${x} ${y} L${x + kx} ${y + ky} L${x + dx} ${y + dy}`, w || 1.8)).join('');
const eye = (x, y, r = 1.7) => aC(x, y, r, PAPER);

export const ART_DEFS = `<filter id="ink" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3.4" xChannelSelector="R" yChannelSelector="G"/></filter><filter id="wash" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="0.9"/></filter><filter id="grim" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="1.2" result="a"/><feMorphology in="SourceAlpha" operator="dilate" radius="2.4" result="b"/><feComposite in="b" in2="a" operator="out" result="r"/><feFlood flood-color="#c08a2e"/><feComposite in2="r" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="grim6" x="-14%" y="-14%" width="128%" height="128%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="1.2" result="a"/><feMorphology in="SourceAlpha" operator="dilate" radius="2.8" result="b"/><feComposite in="b" in2="a" operator="out" result="r"/><feFlood flood-color="#d9a441"/><feComposite in2="r" operator="in" result="g"/><feMorphology in="SourceAlpha" operator="dilate" radius="3.6" result="c"/><feMorphology in="SourceAlpha" operator="dilate" radius="4.2" result="d"/><feComposite in="d" in2="c" operator="out" result="r2"/><feFlood flood-color="#b5301f"/><feComposite in2="r2" operator="in" result="z"/><feMerge><feMergeNode in="z"/><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="gyun" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="21" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="2.2" result="b"/><feTurbulence type="fractalNoise" baseFrequency="0.13" numOctaves="2" seed="5" result="m"/><feColorMatrix in="m" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.2 0 0 0 -0.45" result="ma"/><feComposite in="b" in2="ma" operator="in"/></filter>`;

const mothWings = (c1 = INK) => aF('M52 52 Q40 18 18 20 Q8 34 26 46 Q36 52 52 54 Z', c1, ' fill-opacity=".9"') + aF('M52 56 Q36 60 24 76 Q36 82 46 70 Q52 62 54 58 Z', c1, ' fill-opacity=".8"');

const A = {
  boar: () => ({
    w: aE(46, 60, 32, 17, '#8a5a32'),
    b: aLegs([[30, 66, -1, 7, -3, 14, 4.5], [40, 69, 1, 6, 0, 12, 4.5], [57, 69, 1, 6, 2, 12, 4.5], [65, 66, 2, 6, 4, 13, 4.5]])
      + aE(46, 56, 25, 16) + aE(71, 56, 12, 11.5) + aE(82, 60, 6.5, 5.5)
      + aF('M64 47 L68 36 L74 46 Z') + [27, 33, 39, 45, 51, 57].map((x, i) => aP(`M${x} ${42 - (i % 2) * 1.5} l-3 -${6 + (i % 3)}`, 1.7)).join('')
      + aP('M79 65 Q91 66 90 54', 3.2, PAPER) + aC(85, 59, 1.1, PAPER) + eye(74, 52) + aP('M21 52 q-7 -3 -4 -9', 1.6),
  }),
  fire: () => {
    let b = '', pts = [];
    for (let i = 0; i < 8; i++) pts.push([16 + i * 9.2, 58 + Math.sin(i * 0.95) * 8, 3.6 + i * 0.85]);
    pts.forEach(([x, y, r]) => { b += aC(x, y, r); });
    const [hx, hy] = pts[7];
    b += aP(`M${hx + 3} ${hy - 6} q4 -10 12 -12`, 1.3) + aP(`M${hx + 1} ${hy - 7} q0 -10 6 -15`, 1.3) + eye(hx + 3, hy - 2, 1.5) + aP(`M${hx + 7} ${hy + 2} l5 2`, 1.6);
    pts.slice(1, 7).forEach(([x, y, r]) => { b += aP(`M${x} ${y + r - 1} l-1 4`, 1.1); });
    return { w: aF('M19 58 Q3 52 6 36 Q11 47 15 45 Q11 33 20 26 Q24 42 26 52 Z', '#c0392b') + aE(50, 58, 30, 9, '#c0392b', 0, ' opacity=".35"'), b };
  },
  twin: () => {
    const body = mothWings() + aC(30, 32, 4, PAPER) + aC(30, 32, 1.8) + aE(55, 55, 14, 4.5, INK, -12) + aC(69, 51, 4.2) + aP('M71 48 q6 -9 13 -10', 1.2) + aP('M70 47 q3 -9 9 -13', 1.2) + eye(71, 50, 1.2);
    return { w: aE(40, 46, 26, 22, '#3d5a80'), b: `<g transform="translate(-10 -7)" opacity=".26">${body}</g>` + body };
  },
  iron: () => ({
    w: aE(50, 54, 32, 22, '#5f6b5a'),
    b: aLegs([[34, 64, -4, 7, -8, 14], [48, 66, 0, 7, -2, 14], [62, 64, 4, 7, 6, 14], [40, 64, -2, 6, -4, 12, 1.2], [56, 64, 2, 6, 4, 12, 1.2]])
      + aF('M20 66 Q22 30 52 28 Q80 30 82 66 Z') + aP('M52 30 L52 65', 1.4, PAPER) + aP('M28 50 Q52 42 76 50', 1.2, PAPER) + aP('M24 60 Q52 54 80 60', 1.2, PAPER)
      + aC(40, 40, 1.3, PAPER) + aC(64, 40, 1.3, PAPER) + aE(85, 61, 7, 6) + aP('M88 56 Q95 43 86 34', 3.8) + eye(88, 60, 1.3),
  }),
  thorn: () => {
    let b = '';
    for (let i = 0; i < 7; i++) {
      const x = 16 + i * 10, y = 60 - Math.sin(i * 0.6) * 3;
      b += aP(`M${x} ${y + 3} q3 6 -1 12`, 1.4) + aP(`M${x + 2} ${y + 3} q4 5 4 11`, 1.1) + aE(x, y, 6, 5) + aF(`M${x - 3} ${y - 3} L${x - 1} ${y - 14} L${x + 3} ${y - 3} Z`);
    }
    b += aE(86, 57, 7.5, 6) + aP('M91 60 q6 3 2 9', 2.2) + aP('M91 54 q6 -3 3 -9', 2.2) + eye(88, 55, 1.4);
    return { w: aE(52, 56, 38, 12, '#4b6a4e'), b };
  },
  mantis: () => ({
    w: aF('M28 60 c-6 -8 4 -12 6 -5 c2 -7 12 -3 6 5 l-6 6 z', '#8c2f2f') + aE(40, 60, 22, 9, '#8c2f2f', 8, ' opacity=".45"'),
    b: aLegs([[46, 63, -6, 7, -12, 15, 1.4], [52, 63, 2, 8, 8, 16, 1.4], [42, 62, -8, 6, -18, 12, 1.3]])
      + aE(34, 61, 21, 6.5, INK, 8) + aE(40, 55, 18, 4.5, INK, 8, ' fill-opacity=".55"') + aP('M52 60 L67 37', 5.2)
      + aF('M61 31 L80 26 L71 41 Z') + aC(74, 30, 2.6, PAPER) + aC(74.6, 30, 1.1)
      + aP('M65 41 L80 50 L73 63', 3) + aP('M80 50 l-3 3 M78 54 l-3 2 M76 58 l-3 2', 1.2) + aP('M73 63 L84 59', 2.2)
      + aP('M71 28 q4 -12 14 -16', 1.1) + aP('M73 27 q8 -8 18 -8', 1.1),
  }),
  bone: () => {
    let b = '';
    const segs = [[24, 64, 8], [34, 62, 10], [46, 60, 11], [58, 59, 11.5], [71, 58, 10.5]];
    segs.forEach(([x, y, r]) => { b += aC(x, y, r, '#cfc4ab', ` stroke="${INK}" stroke-width="2.4"`); });
    segs.slice(1, 4).forEach(([x, y, r]) => { b += aP(`M${x - 4} ${y + r - 1} l-1 5 M${x + 3} ${y + r - 1} l1 5`, 2); });
    b += aC(74, 55, 2.6) + aC(68, 55, 2.2) + aP('M68 63 q4 2 9 0', 1.6) + aP('M46 52 l2 3 M57 51 l-1 3', 1.4);
    return { w: aE(48, 60, 32, 15, '#7c8766'), b };
  },
  queen: () => ({
    w: aE(36, 60, 22, 13, '#b8862b', 10),
    b: aE(50, 34, 17, 7, INK, -28, ' fill-opacity=".35"') + aE(44, 39, 13, 5.5, INK, -12, ' fill-opacity=".3"')
      + aLegs([[56, 60, -2, 8, -6, 15, 1.4], [61, 61, 1, 8, 2, 16, 1.4], [66, 60, 3, 7, 8, 14, 1.4]])
      + aE(36, 60, 20, 12, INK, 10) + [29, 37, 45].map(x => aP(`M${x} ${50 + (x - 29) / 6} q-4 10 0 21`, 2.4, PAPER)).join('')
      + aP('M17 63 L7 68', 2.8) + aC(60, 55, 9) + aC(75, 50, 7) + aP('M71 43 L72 36 L75 41 L78 35 L80 43', 1.7) + eye(78, 49) + aP('M80 46 q6 -6 11 -6', 1.2),
  }),
  cicada: () => ({
    w: aF('M70 48 L12 56 L22 72 L70 62 Z', '#b39436'),
    b: aF('M70 49 L12 57 L22 71 L70 62 Z', INK, ' fill-opacity=".5"') + aP('M68 52 L20 61 M66 57 L26 67 M46 54 L36 66', 1, PAPER)
      + aLegs([[56, 64, 0, 7, -4, 14, 1.6], [62, 65, 2, 7, 4, 13, 1.6]])
      + aE(58, 58, 15, 9.5) + aE(77, 57, 8, 9) + aC(81, 50, 3.2) + aC(81, 50, 1.4, PAPER) + aC(80, 64, 2.4) + aP('M85 59 l6 2', 1.6),
  }),
  drum: () => ({
    w: aE(48, 56, 24, 20, '#9c3b2c'),
    b: aLegs([[34, 70, -2, 6, -6, 12, 2.2], [48, 72, 0, 6, -1, 12, 2.2], [62, 70, 2, 6, 6, 12, 2.2]])
      + aF('M28 44 L68 44 Q73 58 68 72 L28 72 Q23 58 28 44 Z') + aE(48, 44, 20, 5, '#3a3530') + aE(48, 44, 20, 5, 'none', 0, ` stroke="${PAPER}" stroke-width="1.2"`)
      + aP('M27 51 Q48 56 69 51', 1.3, PAPER) + aP('M27 65 Q48 70 69 65', 1.3, PAPER) + [33, 41, 49, 57, 64].map(x => aC(x, 58.5, 1.2, PAPER)).join('')
      + aE(76, 60, 6, 6) + eye(78, 58, 1.3) + aP('M74 55 L88 30', 2.2) + aC(89, 28, 3.4) + aP('M71 55 L77 26', 2.2) + aC(78, 24, 3.4),
  }),
  scorp: () => {
    let b = aLegs([[40, 66, -4, 6, -9, 13, 1.4], [46, 67, -2, 7, -4, 14, 1.4], [52, 67, 2, 7, 4, 14, 1.4], [58, 66, 4, 6, 9, 12, 1.4]]);
    b += [[32, 62, 5.2], [24, 54, 4.8], [21, 44, 4.4], [25, 35, 4], [33, 29, 3.6]].map(([x, y, r]) => aC(x, y, r)).join('');
    b += aP('M36 27 Q46 25 44 35', 2.8) + aE(46, 64, 15, 7.5) + aE(61, 63, 8, 6.5);
    b += aP('M64 60 L76 54', 3.2) + aP('M76 54 Q88 46 92 55 M76 54 Q86 62 92 55', 2.6) + aP('M64 66 L74 70', 2.6) + aP('M74 70 Q85 66 89 73 M74 70 Q82 78 89 73', 2.2) + eye(66, 61, 1.3);
    return { w: aC(42, 31, 8, '#a4542a') + aE(46, 64, 20, 9, '#a4542a', 0, ' opacity=".35"'), b };
  },
  moth: () => ({
    w: aE(38, 42, 22, 18, '#6f9a8f') + aE(30, 78, 9, 16, '#6f9a8f', 30),
    b: mothWings() + aF('M50 58 Q34 72 22 96 Q30 76 42 60 Z') + aC(32, 34, 7, PAPER) + aC(35, 32, 6.2)
      + aE(56, 52, 11, 4.2, INK, -18) + aC(67, 48, 3.6) + eye(68.5, 47.4, 1.1)
      + aP('M68 45 Q74 33 82 29', 1.2) + [0, 1, 2, 3].map(i => aP(`M${70 + i * 3} ${41 - i * 3} l3 -1`, 0.9)).join(''),
  }),
  pupa: () => ({
    w: aE(50, 60, 26, 15, '#7c8766'),
    b: aE(50, 60, 24, 13) + aP('M34 52 Q40 64 34 70 M44 48 Q50 62 44 72 M56 48 Q62 62 56 72 M66 52 Q72 62 66 68', 1.3, PAPER) + aP('M74 60 q8 -4 12 -12', 1.4),
  }),
};
A.shade = () => { const t = A.twin(); return { w: '', b: `<g opacity=".5">${t.b}</g>` }; };
A.lunar = () => { const t = A.moth(); return { w: t.w, b: `<g opacity=".55">${t.b}</g>` }; };
// 蛊典扩充：52 只新蛊与 6 种召唤物的画（src/art2.js），同名不覆盖
Object.entries(ART2).forEach(([k, v]) => { if (!A[k]) A[k] = () => v; });

// ---------- 升转外貌：在任何物种的原画上叠程序化图层，不改原画 ----------
// 一转原样；二转飞白墨纹、体型略大；三转身后一圈真元色晕染；四转金线勾边、晕染更浓、脚下一方小印；
// 五转头光、周身墨气缓缓流动（.g-qi，可被 calm / prefers-reduced-motion 关掉）；六转仙蛊：金朱背光、双线描金、金箔、仙印。
// 品质（rarity）不画在虫身上，用 rarityFrame(r) 给卡片加边框和角标。
const GU_BOX = [12, 28, 78, 52];   // 没登记的物种（含以后新加的）用这个外框 [x, y, w, h]
export const RANK_BOX = { boar: [16, 33, 74, 49], fire: [12, 39, 83, 35], twin: [4, 13, 80, 65], iron: [20, 28, 72, 52], thorn: [10, 43, 85, 33], mantis: [12, 12, 79, 67], bone: [16, 48, 66, 29], queen: [7, 20, 84, 57], cicada: [12, 47, 79, 31], drum: [26, 21, 67, 63], scorp: [17, 25, 75, 56], moth: [14, 20, 68, 76], pupa: [26, 47, 60, 26], shade: [4, 13, 80, 65], lunar: [14, 20, 68, 76] };
const RANK_HEAD = { boar: [74, 53], fire: [82, 57], twin: [69, 50], iron: [86, 60], thorn: [87, 56], mantis: [73, 31], bone: [71, 56], queen: [76, 49], cicada: [79, 54], drum: [76, 59], scorp: [64, 62], moth: [67, 48], pupa: [74, 58], shade: [69, 50], lunar: [67, 48] };
export const RANK_CN = ['', '一', '二', '三', '四', '五', '仙'];
export const rankColor = r => (r >= 6 ? '#d9a441' : ZHENYUAN.colors[Math.max(1, Math.min(5, r | 0))]);
export const rarityFrame = r => `rf rf${Math.max(0, Math.min(4, r | 0))}`;
const rn = v => +v.toFixed(1), rcl = (v, a, b) => Math.max(a, Math.min(b, v));
const GLYPH = {   // 小印里的笔画：四、五、仙（几像素大，只取其意）
  4: 'M-2.3 -2 h4.6 v4.1 h-4.6 z M-.8 -2 q.2 1.6 -.6 2.6 M.8 -2 v2 q0 .7 .9 .7',
  5: 'M-2.2 -2.3 h4.4 M-.5 -2.3 l-.7 4.4 M-1.7 -.1 h3.3 v2.3 M-2.6 2.2 h5.2',
  6: 'M-1.6 -2.6 q-.6 1.6 -1.3 2.4 M-2 -.6 v3.2 M.9 -2.6 v4.8 M-.4 -.6 v2.8 h2.7 v-2.8',
};
function rankSeal(x, y, r) {
  const bg = r >= 6 ? '#b5301f' : '#a82a1b', edge = r >= 6 ? '#d9a441' : PAPER;
  return `<g transform="translate(${rn(x)} ${rn(y)}) rotate(-7)"><rect x="-4.6" y="-4.6" width="9.2" height="9.2" rx=".5" fill="${bg}"/><rect x="-3.5" y="-3.5" width="7" height="7" fill="none" stroke="${edge}" stroke-width=".55"/><path d="${GLYPH[Math.min(6, r)]}" fill="none" stroke="${PAPER}" stroke-width=".75" stroke-linecap="round" stroke-linejoin="round" transform="scale(.82)"/></g>`;
}
export function rankLayers(rank, bbox = GU_BOX, o = {}) {
  const r = rcl(rank | 0, 1, 6), [x, y, w, h] = bbox, cx = x + w / 2, cy = y + h / 2, col = rankColor(r);
  const L = { back: '', front: '', rim: r >= 4 ? (r >= 6 ? 'grim6' : 'grim') : '', scale: [1, 1, 1.04, 1.06, 1.08, 1.09, 1.1][r] };
  if (r < 2) return L;
  // 二转起：飞白——两道干笔，每道是几根错开断开的纸色细丝，裁在虫身轮廓里，只在墨上露白
  const DA = ['7 1.6 11 2.4 4 1.2', '12 2.8 5 1.4 9 2', '4 1.2 9 3 13 1.6', '10 1.8 3 2.6 8 1.4'];
  let fb = '';
  [[.04, .4, .96, .3, .5], [.14, .66, .9, .58, .58]].forEach(([a, b, c, d, cm], j) => {
    for (let i = 0; i < 4; i++) {
      const off = i * 1.15 - 1.7, x1 = x + w * a, y1 = y + h * b + off, x2 = x + w * c, y2 = y + h * d + off, mx = x + w * cm, my = Math.min(y1, y2) - h * .1 + off;
      fb += `<path d="M${rn(x1 + i * 1.5)} ${rn(y1)} Q${rn(mx)} ${rn(my)} ${rn(x2 - i * 2)} ${rn(y2)}" stroke-width="${[.9, .6, .75, .5][i]}" stroke-dasharray="${DA[(i + j) % 4]}" stroke-dashoffset="${i * 3 + j * 5}"/>`;
    }
  });
  L.front += `<g clip-path="url(#${o.clip})"><g stroke="${PAPER}" fill="none" stroke-linecap="round" opacity="${r >= 4 ? .85 : .75}" filter="url(#ink)">${fb}</g></g>`;
  // 三转起：身后真元色晕染，一转比一转浓
  if (r >= 3) {
    const ax = Math.min(42, w * .56 + 6), ay = Math.min(40, h * .56 + 8), k = [0, 0, 0, .6, .8, .9, 1][r];
    const ring = (s, op, c) => `<ellipse cx="${rn(cx)}" cy="${rn(cy)}" rx="${rn(ax * s)}" ry="${rn(ay * s)}" fill="${c}" fill-opacity="${op}"/>`;
    L.back += `<g filter="url(#gyun)" opacity="${k}">${ring(1, .32, col)}${ring(.78, .38, col)}${ring(.54, .42, col)}${r >= 6 ? ring(.62, .42, '#b5301f') + ring(.36, .5, '#d9a441') : ''}</g>`;
  }
  // 四转起：脚下一方小印（金线勾边由 rim 滤镜做）
  if (r >= 4) L.front += rankSeal(Math.min(91, x + w * .82), Math.min(92, y + h + 4), r);
  // 五转起：头光 + 墨气
  if (r >= 5) {
    const [hx, hy] = o.head || [x + w * .8, y + h * .4], hr = r >= 6 ? 14 : 12;
    L.back += `<g fill="none" filter="url(#ink)"><circle cx="${hx}" cy="${hy}" r="${hr}" fill="${PAPER}" fill-opacity=".55"/><circle cx="${hx}" cy="${hy}" r="${hr}" fill="${col}" fill-opacity="${r >= 6 ? .28 : .24}"/><circle cx="${hx}" cy="${hy}" r="${hr}" stroke="${col}" stroke-width="1.6"/><circle cx="${hx}" cy="${hy}" r="${hr + 2.6}" stroke="${col}" stroke-width=".7" opacity=".75"/></g>`;
    // 墨气：绕身两三道断续的弧，像气在身周打转
    const qc = r >= 6 ? '#b8862b' : '#1c1915', ex = Math.min(46, w * .56 + 5), ey = Math.min(44, h * .56 + 7);
    const arc = (a0, a1, s, sw, op) => { let d = ''; for (let i = 0; i <= 24; i++) { const t = (a0 + (a1 - a0) * i / 24) * Math.PI / 180, k = s * (1 + .06 * Math.sin(i * .9)); d += `${i ? 'L' : 'M'}${rn(rcl(cx + Math.cos(t) * ex * k, 2, 98))} ${rn(rcl(cy + Math.sin(t) * ey * k, 2, 98))} `; } return `<path d="${d}" stroke-width="${sw}" opacity="${op}"/>`; };
    const wisps = arc(150, 250, 1, 1.8, .55) + arc(320, 410, .96, 1.5, .5) + arc(60, 120, 1.06, 1.1, .4) + arc(255, 300, .9, .9, .35);
    L.back += `<g class="${o.still ? '' : 'g-qi'}" fill="none" stroke="${qc}" stroke-linecap="round" filter="url(#wash)">${wisps}</g>`;
  }
  // 六转仙蛊：金色背光（火焰纹）+ 金箔
  if (r >= 6) {
    const ax = Math.min(47, w * .64 + 4), ay = Math.min(46, Math.max(30, h * .72 + 6));
    let d = '';
    for (let i = 0; i <= 96; i++) { const t = i / 96 * 6.2832, k = 1 + .07 * Math.pow(Math.abs(Math.sin(t * 6)), 3); d += `${i ? 'L' : 'M'}${rn(cx + Math.cos(t) * ax * k)} ${rn(cy + Math.sin(t) * ay * k)} `; }   // 尖焰
    L.back = `<g fill="none" filter="url(#ink)"><path d="${d}Z" stroke="#d9a441" stroke-width="1.1" opacity=".9"/><ellipse cx="${rn(cx)}" cy="${rn(cy)}" rx="${rn(ax * .86)}" ry="${rn(ay * .86)}" stroke="#b5301f" stroke-width=".6" opacity=".7"/></g>` + L.back;
    const leaf = [[.02, .1], [.9, .04], [1.02, .7], [-.04, .82], [.46, -.12], [.7, 1.08], [.2, 1.04]];
    L.front += leaf.map(([a, b], i) => { const px = rcl(x + w * a, 3, 96), py = rcl(y + h * b, 3, 96), s = 1.4 + (i % 3) * .5; return `<path d="M${rn(px)} ${rn(py - s)} L${rn(px + s * .8)} ${rn(py)} L${rn(px)} ${rn(py + s * .9)} L${rn(px - s * .7)} ${rn(py + .2)} Z" fill="${i % 2 ? '#e8c76a' : '#c08a2e'}"/>`; }).join('');
  }
  return L;
}

export function guSVG(sp, o = {}) {
  const f = A[sp] || A.pupa, { w, b } = f();
  const size = o.size ? ` width="${o.size}" height="${o.size}"` : '';
  const r = Math.max(1, Math.min(6, o.rank | 0 || 1)), rar = o.rarity != null ? ` data-rar="${Math.max(0, Math.min(4, o.rarity | 0))}"` : '';
  if (r === 1) {   // 一转：原画原样
    const defs = o.standalone ? `<defs>${ART_DEFS}</defs>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${size} class="gsvg" aria-hidden="true"${rar}>${defs}<g filter="url(#wash)" opacity=".5">${w}</g><g filter="url(#ink)">${b}</g></svg>`;
  }
  const key = A[sp] ? sp : 'pupa', box = RANK_BOX[key] || GU_BOX, clip = 'gc-' + key;
  const L = rankLayers(r, box, { head: RANK_HEAD[key], clip, still: o.still || o.standalone });
  const cx = rn(box[0] + box[2] / 2), cy = rn(box[1] + box[3] / 2);
  const T = L.scale !== 1 ? ` transform="translate(${cx} ${cy}) scale(${L.scale}) translate(${-cx} ${-cy})"` : '';
  const defs = `<defs>${o.standalone ? ART_DEFS : ''}<clipPath id="${clip}">${b.replace(/<\/?g\b[^>]*>/g, '')}</clipPath></defs>`;
  const body = L.rim ? `<g filter="url(#${L.rim})">${b}</g>` : b;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${size} class="gsvg gr${r}" aria-hidden="true"${rar}>${defs}<g${T}>${L.back}<g filter="url(#wash)" opacity=".5">${w}</g><g filter="url(#ink)">${body}</g>${L.front}</g></svg>`;
}
