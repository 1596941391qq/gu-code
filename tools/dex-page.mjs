// 蛊典图鉴页生成器：从 src 读物种数据和美术，写出完全静态的 bestiary.html（无外部依赖）。
// 用法：node tools/dex-page.mjs        物种增加后重跑一次即可更新。
// 读取：core.js（SPECIES / COMBOS）、bestiary.js（词条、本命技与觉醒、转数倍率）、art.js（升转外貌）、art2.js（新蛊美术）。
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SPECIES, SP, COMBOS } from '../src/core.js';
import { NEW_TRAITS, natMulOf, SCHOOLS } from '../src/bestiary.js';
import { guSVG, ART_DEFS, RANK_BOX, RANK_CN, rankLayers } from '../src/art.js';
import { ART2 } from '../src/art2.js';

const OUT = fileURLToPath(new URL('../bestiary.html', import.meta.url));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rn = v => +v.toFixed(1);
const PAPER_BOX = [12, 28, 78, 52];   // 没有专门外框的蛊用的通用外框，与 art.js 一致


// 新蛊没有登记外框：从画稿本身估一个包围盒（椭圆、圆、路径控制点，认 translate / scale / rotate），让光晕和头光对得上虫身。
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
function parseTf(t) {
  let m = [1, 0, 0, 1, 0, 0];
  for (const [, f, a] of (t || '').matchAll(/(translate|scale|rotate)\(([^)]*)\)/g)) {
    const v = a.trim().split(/[\s,]+/).map(Number);
    if (f === 'translate') m = mul(m, [1, 0, 0, 1, v[0], v[1] || 0]);
    else if (f === 'scale') m = mul(m, [v[0], 0, 0, v[1] ?? v[0], 0, 0]);
    else { const r = v[0] * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), x = v[1] || 0, y = v[2] || 0; m = mul(mul(m, [1, 0, 0, 1, x, y]), mul([c, s, -s, c, 0, 0], [1, 0, 0, 1, -x, -y])); }
  }
  return m;
}
function pathPts(d) {
  const pts = []; let x = 0, y = 0, sx = 0, sy = 0;
  for (const [, c, a] of d.matchAll(/([MmLlHhVvQqCcSsTtAaZz])([^MmLlHhVvQqCcSsTtAaZz]*)/g)) {
    const v = (a.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number), rel = c === c.toLowerCase(), C = c.toUpperCase();
    const step = { M: 2, L: 2, H: 1, V: 1, Q: 4, C: 6, S: 4, T: 2, A: 7, Z: 0 }[C];
    if (C === 'Z') { x = sx; y = sy; continue; }
    for (let i = 0; i + step <= v.length; i += step) {
      const w = v.slice(i, i + step), ox = rel ? x : 0, oy = rel ? y : 0;
      if (C === 'H') { x = w[0] + ox; pts.push([x, y]); }
      else if (C === 'V') { y = w[0] + oy; pts.push([x, y]); }
      else if (C === 'A') { x = w[5] + ox; y = w[6] + oy; pts.push([x, y]); }
      else { for (let k = 0; k < step; k += 2) pts.push([w[k] + ox, w[k + 1] + oy]); x = w[step - 2] + ox; y = w[step - 1] + oy; }
      if (C === 'M' && i === 0) { sx = x; sy = y; }
    }
  }
  return pts;
}
function estBox(b) {
  const stack = [[1, 0, 0, 1, 0, 0]]; let x0 = 100, y0 = 100, x1 = 0, y1 = 0;
  const add = (m, px, py) => { const X = m[0] * px + m[2] * py + m[4], Y = m[1] * px + m[3] * py + m[5]; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); };
  for (const [all, close, tag, attrs] of b.matchAll(/<(\/?)(\w+)([^>]*)>/g).map(m => [m[0], m[1], m[2], m[3]])) {
    if (tag === 'g') { if (close) stack.pop(); else stack.push(mul(stack[stack.length - 1], parseTf((attrs.match(/transform="([^"]*)"/) || [])[1]))); continue; }
    if (close) continue;
    const at = k => { const m = attrs.match(new RegExp(`\\b${k}="([^"]*)"`)); return m ? m[1] : null; };
    const m = mul(stack[stack.length - 1], parseTf(at('transform')));
    if (tag === 'ellipse' || tag === 'circle') { const cx = +at('cx'), cy = +at('cy'), rx = +(at('rx') || at('r')), ry = +(at('ry') || at('r')); for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) add(m, cx + dx * rx, cy + dy * ry); }
    else if (tag === 'path') pathPts(at('d') || '').forEach(([px, py]) => add(m, px, py));
  }
  if (x1 <= x0 || y1 <= y0) return PAPER_BOX;
  x0 = Math.max(2, x0); y0 = Math.max(2, y0); x1 = Math.min(98, x1); y1 = Math.min(98, y1);
  return [rn(x0), rn(y0), rn(x1 - x0), rn(y1 - y0)];
}

// ---------- 美术 ----------
// 有专门分转美术 = art.js 的 RANK_BOX 里登记过（外框、头光位置按这只蛊量过）。其余蛊用通用外框叠同一套图层。
const hasOwnRankArt = id => !!RANK_BOX[id];
const clips = new Map(), boxes = {};   // clipPath 全页只放一份
function art(id, rank) {
  let svg;
  if (!ART2[id]) svg = guSVG(id, { rank, still: true });
  else {
    const { w, b } = ART2[id], r = Math.max(1, Math.min(6, rank | 0));
    if (r === 1) svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="gsvg" aria-hidden="true"><g filter="url(#wash)" opacity=".5">${w}</g><g filter="url(#ink)">${b}</g></svg>`;
    else {
      const box = RANK_BOX[id] || (boxes[id] ||= estBox(b)), clip = 'gc-' + id;
      const L = rankLayers(r, box, { clip, still: true });
      const cx = rn(box[0] + box[2] / 2), cy = rn(box[1] + box[3] / 2);
      const T = L.scale !== 1 ? ` transform="translate(${cx} ${cy}) scale(${L.scale}) translate(${-cx} ${-cy})"` : '';
      const body = L.rim ? `<g filter="url(#${L.rim})">${b}</g>` : b;
      svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="gsvg gr${r}" aria-hidden="true"><defs><clipPath id="${clip}">${b.replace(/<\/?g\b[^>]*>/g, '')}</clipPath></defs><g${T}>${L.back}<g filter="url(#wash)" opacity=".5">${w}</g><g filter="url(#ink)">${body}</g>${L.front}</g></svg>`;
    }
  }
  return svg.replace(/<defs>(.*?)<\/defs>/s, (_, inner) => {
    for (const m of inner.matchAll(/<clipPath id="([^"]+)">.*?<\/clipPath>/gs)) clips.set(m[1], m[0]);
    return '';
  });
}

// ---------- 数据 ----------
const rankName = r => (r >= 6 ? '仙蛊' : RANK_CN[r] + '转');
const comboOfSp = id => COMBOS.filter(c => c.need.includes(id));
const cards = SPECIES.map(s => ({ s, rank: s.rank || 1 })).sort((a, b) => a.rank - b.rank);
const schools = SCHOOLS.filter(x => cards.some(c => (c.s.school || '') === x));
const ranks = [...new Set(cards.map(c => c.rank))].sort((a, b) => a - b);

function card({ s, rank }) {
  const nat = NEW_TRAITS[s.nat];
  const row = (rank >= 6 ? [6] : [1, 2, 3, 4, 5].filter(r => r >= rank));
  const aw = nat && nat.aw ? nat.aw : [];
  const combos = comboOfSp(s.id);
  const search = [s.n, s.ab, s.school, s.lore, nat && nat.n, ...combos.map(c => c.n)].join(' ');
  return `<article class="card" id="${s.id}" data-rank="${rank}" data-school="${esc(s.school || '')}" data-q="${esc(search)}">
<header><div class="ttl"><h2>${esc(s.n)}</h2><p class="lore">${esc(s.lore)}</p></div><div class="tags"><span class="tag rk">基础 ${rankName(rank)}</span>${s.school ? `<span class="tag">${esc(s.school)}</span>` : ''}</div></header>
<div class="stat"><span class="a">攻 ${s.atk}</span><span class="h">血 ${s.hp}</span></div>
<div class="evo">${row.map(r => `<figure class="r${r}"><div class="pic">${art(s.id, r)}</div><figcaption>${rankName(r)}</figcaption></figure>`).join('')}</div>
${nat ? `<dl class="skill"><dt>本命技 · ${esc(nat.n)}</dt><dd>${esc(nat.d(1, natMulOf(rank)))}</dd>
${aw[0] ? `<dt class="aw">三转觉醒</dt><dd>${esc(aw[0](natMulOf(3)))}</dd>` : ''}${aw[1] ? `<dt class="aw">五转觉醒</dt><dd>${esc(aw[1](natMulOf(5)))}</dd>` : ''}</dl>` : ''}
${combos.length ? `<div class="combo"><h3>参与的杀招</h3>${combos.map(c => `<p><b>${esc(c.n)}</b><span class="with">${c.need.map(x => esc(SP[x] ? SP[x].n : x)).join(' + ')}</span><span class="cd">${esc(c.d)}</span></p>`).join('')}</div>` : ''}
${s.eats ? `<p class="eat">口味：${esc(s.eats)}</p>` : ''}
</article>`;
}

const CSS = `
:root{--bg:#15130f;--bg2:#1e1b16;--line:rgba(233,224,204,.16);--tx:#ddd3bf;--mu:#9a917d;--strong:#eee5d1;--paper:#d9cfb8;--zhu:#d8553f;--qing:#6fb7a4;--atk:#d0644d;--hp:#6fb7a4;--chip:#26221b;--chipon:#b5301f;--chipontx:#f3ead6;color-scheme:dark}
@media (prefers-color-scheme:light){:root{--bg:#eee6d4;--bg2:#f6f0e1;--line:rgba(40,32,24,.2);--tx:#1f1b16;--mu:#5b5244;--strong:#1a1612;--paper:#f8f3e7;--zhu:#a82a1b;--qing:#2c6e5e;--atk:#9a3322;--hp:#2f5a4c;--chip:#e6dcc6;--chipon:#a82a1b;--chipontx:#f8f3e7;color-scheme:light}}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--bg);color:var(--tx);font:15px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif;overflow-x:hidden;-webkit-font-smoothing:antialiased}
.wrap{max-width:1120px;margin:0 auto;padding:12px 16px 40px}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:4px 0 10px}
.top a{color:var(--zhu);text-decoration:none;font-weight:700;padding:8px 0}
.top a:hover{text-decoration:underline}
h1{font-family:"Kaiti SC","STKaiti","KaiTi","BiauKai",serif;font-size:32px;letter-spacing:.1em;margin:6px 0 2px;color:var(--strong);font-weight:700}
.sub{margin:0 0 16px;color:var(--mu)}
.tools{background:var(--bg);padding:8px 0 10px;border-bottom:1px solid var(--line);margin-bottom:16px}
@media (min-width:760px){.tools{position:sticky;top:0;z-index:5}}
.tools input{width:100%;font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:3px;background:var(--bg2);color:var(--tx)}
.tools input:focus-visible,.chip:focus-visible,.top a:focus-visible{outline:2px solid var(--zhu);outline-offset:2px}
.group{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px}
.group>span{color:var(--mu);font-size:13px;margin-right:2px}
.chip{font:inherit;font-size:13px;padding:4px 11px;border:1px solid var(--line);border-radius:14px;background:var(--chip);color:var(--tx);cursor:pointer}
.chip[aria-pressed=true]{background:var(--chipon);color:var(--chipontx);border-color:var(--chipon)}
.count{margin:8px 0 0;font-size:13px;color:var(--mu)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));gap:14px}
.card{background:var(--bg2);border:1px solid var(--line);border-radius:4px;padding:14px;min-width:0;content-visibility:auto;contain-intrinsic-size:auto 520px}
.card[hidden]{display:none}
header{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
h2{font-family:"Kaiti SC","STKaiti","KaiTi","BiauKai",serif;font-size:22px;margin:0;color:var(--strong);letter-spacing:.06em}
.lore{margin:2px 0 0;color:var(--mu);font-size:13px;line-height:1.5}
.tags{display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex:none}
.tag{font-size:12px;padding:1px 8px;border:1px solid var(--line);border-radius:3px;white-space:nowrap}
.tag.rk{background:var(--zhu);border-color:var(--zhu);color:#f8f3e7}
.stat{display:flex;gap:14px;margin:8px 0;font-weight:700;font-size:14px}
.a{color:var(--atk)}.h{color:var(--hp)}
.evo{display:flex;gap:6px;margin:6px 0 12px}
figure{margin:0;flex:0 0 calc((100% - 24px) / 5);min-width:0;text-align:center}
.pic{background:#e3d9c2;border-radius:3px;aspect-ratio:1;overflow:hidden}
@media (prefers-color-scheme:light){.pic{background:#f8f3e7;border:1px solid var(--line)}}
.pic svg{display:block;width:100%;height:100%}
figcaption{font-size:12px;color:var(--mu);margin-top:3px}
.skill{margin:0}
.skill dt{font-weight:700;color:var(--strong);margin-top:6px}
.skill dt.aw{font-size:13px;color:var(--qing)}
.skill dd{margin:0;font-size:14px}
.combo{margin-top:10px;border-top:1px dashed var(--line);padding-top:8px}
.combo h3{margin:0 0 4px;font-size:13px;color:var(--mu);font-weight:400}
.combo p{margin:0 0 6px;font-size:13px}
.combo b{color:var(--zhu);margin-right:6px}
.with{color:var(--mu);margin-right:6px}
.eat{margin:10px 0 0;font-size:12px;color:var(--mu)}
.none{text-align:center;color:var(--mu);padding:40px 0}
.none[hidden]{display:none}
.hid{position:absolute;width:0;height:0;overflow:hidden}
:target{outline:2px solid var(--zhu)}
`;

const JS = `
(function(){
  var cards=[].slice.call(document.querySelectorAll('.card')),q=document.getElementById('q'),cnt=document.getElementById('cnt'),none=document.getElementById('none');
  var st={school:'',rank:''};
  function apply(){
    var k=q.value.trim().toLowerCase(),n=0;
    cards.forEach(function(c){
      var ok=(!st.school||c.dataset.school===st.school)&&(!st.rank||c.dataset.rank===st.rank)&&(!k||c.dataset.q.toLowerCase().indexOf(k)>=0);
      c.hidden=!ok;if(ok)n++;
    });
    cnt.textContent='共 '+n+' 种';none.hidden=n>0;
  }
  [].forEach.call(document.querySelectorAll('.chip'),function(b){
    b.addEventListener('click',function(){
      var g=b.dataset.g;st[g]=b.dataset.v;
      [].forEach.call(document.querySelectorAll('.chip[data-g="'+g+'"]'),function(x){x.setAttribute('aria-pressed',x===b)});
      apply();
    });
  });
  q.addEventListener('input',apply);apply();
})();
`;

const chips = (g, items) => items.map(([v, t]) => `<button type="button" class="chip" data-g="${g}" data-v="${esc(v)}" aria-pressed="${v === ''}">${esc(t)}</button>`).join('');
const body = cards.map(card).join('\n');
const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>蛊典图鉴 · 蛊码 GuCode</title>
<meta name="description" content="蛊码里的全部 ${cards.length} 种蛊：每只蛊从一转到五转的样貌变化、本命技、觉醒和杀招。">
<style>${CSS}</style>
</head>
<body>
<svg class="hid" aria-hidden="true" focusable="false"><defs>${ART_DEFS}${[...clips.values()].join('')}</defs></svg>
<div class="wrap">
<div class="top"><a href="./">← 回到游戏</a></div>
<h1>蛊典图鉴</h1>
<p class="sub">共 ${cards.length} 种蛊。每一张卡上，从这只蛊的起始转数到五转，样貌一转比一转气派。新版正在制作，这里先放出全部图鉴，网页里还没出现的蛊会在新版陆续登场。</p>
<div class="tools">
<input id="q" type="search" placeholder="按名字搜索，如：野猪、金蝉" aria-label="按名字搜索" autocomplete="off">
<div class="group"><span>转数</span>${chips('rank', [['', '全部'], ...ranks.map(r => [String(r), rankName(r)])])}</div>
<div class="group"><span>流派</span>${chips('school', [['', '全部'], ...schools.map(x => [x, x])])}</div>
<p class="count" id="cnt" aria-live="polite"></p>
</div>
<main class="grid">
${body}
</main>
<p class="none" id="none" hidden>没有找到这样的蛊，换个条件试试。</p>
</div>
<script>${JS}</script>
</body>
</html>
`;
writeFileSync(OUT, html);
const missing = cards.filter(c => !hasOwnRankArt(c.s.id)).map(c => c.s.n);
console.log(`写出 ${OUT}：${cards.length} 种，${(html.length / 1024).toFixed(0)} KB；无专门分转美术 ${missing.length} 种`);
