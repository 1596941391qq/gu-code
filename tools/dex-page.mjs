// 蛊典图鉴页生成器（v2）：从 src 读数据和美术，写出完全静态、没有外部依赖的 bestiary.html。
// 用法：node tools/dex-page.mjs        物种、杀招、食物有增减后重跑一次即可。
// 读取：core.js（SP、statTable、statFor）、bestiary2.js（原著名单）、daos.js（道与共鸣）、combos2.js（杀招）、
//       foods.js（食物）、battle.js（skillText：带这一转实际数字的技能说明）、art.js（guSVG：一转到五转的样貌）、art-food.js（foodSVG）。
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SPECIES, SP, baseRank, statFor } from '../src/core.js';
import { CANON } from '../src/bestiary2.js';
import { DAOS, DAO } from '../src/daos.js';
import { COMBOS2 } from '../src/combos2.js';
import { FOODS, FOOD_KIND } from '../src/foods.js';
import { skillText } from '../src/battle.js';
import { guSVG, RANK_CN } from '../src/art.js';
import { foodSVG } from '../src/art-food.js';

const OUT = fileURLToPath(new URL('../bestiary.html', import.meta.url));
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rankName = r => (r >= 6 ? '六转' : RANK_CN[r] + '转');
const canon = new Set(CANON.map(([id]) => id));
const seal = '<i class="seal" title="名字取自原著">原著</i>';

// ---------- 美术：clipPath 全页只放一份 ----------
const clips = new Map();
const art = (id, rank) => guSVG(id, { rank, still: true }).replace(/<defs>(.*?)<\/defs>/s, (_, inner) => {
  for (const m of inner.matchAll(/<clipPath id="([^"]+)">.*?<\/clipPath>/gs)) clips.set(m[1], m[0]);
  return '';
});
const foodArt = id => foodSVG(id);

// ---------- 技能一句话 ----------
const short = t => String(t || '').replace(/（这一转[^）]*）/g, '').trim();
const skills = (sp, r) => skillText(sp, r);
const nameOf = id => (SP[id] ? SP[id].n : id);
const daoName = id => (DAO[id] ? DAO[id].n : '');
const clashOf = d => Object.keys(d.clash || {}).map(k => daoName(k));

// ---------- 蛊卡 ----------
function guCard(s) {
  const base = baseRank(s.id), sk = skills(s.id, base);
  const pas = sk.find(x => x.kind === 'passive'), act = sk.find(x => x.kind === 'active');
  const ranks = base >= 6 ? [6] : [1, 2, 3, 4, 5].filter(r => r >= base);
  const aw = sk.filter(x => x.kind === 'aw3' || x.kind === 'aw5');
  const search = [s.n, s.lore, s.role, pas && pas.n, act && act.n].join(' ');
  return `<article class="card" id="${s.id}" data-rank="${base}" data-q="${esc(search)}">
<div class="head"><div class="pic1">${art(s.id, 1)}</div><div class="who"><h3>${esc(s.n)}${canon.has(s.id) ? seal : ''}</h3><p class="rk">原生 ${rankName(base)}</p><p class="lore">${esc(s.lore)}</p></div></div>
<ul class="sk">${pas ? `<li><b>被动 · ${esc(pas.n)}</b>${esc(short(pas.text))}</li>` : ''}${act ? `<li><b>主动 · ${esc(act.n)}</b>${esc(short(act.text))}</li>` : ''}</ul>
<details><summary>看一转到五转</summary>
<div class="evo">${ranks.map(r => { const st = statFor(s.id, r); return `<figure><div class="pic">${art(s.id, r)}</div><figcaption>${rankName(r)}</figcaption><p class="num"><span class="a">攻 ${st.atk}</span><span class="h">血 ${st.hp}</span></p></figure>`; }).join('')}</div>
${aw.map(x => `<div class="aw"><h4>${esc(x.n)}${x.at < base ? '' : ''}</h4>${x.lines.map(l => `<p><b>${l.of === 'active' ? '主动' : '被动'} · ${esc(l.n)}</b>${esc(l.text)}</p>`).join('')}</div>`).join('')}
</details>
</article>`;
}

// ---------- 道 ----------
function daoSection(d) {
  const list = SPECIES.filter(s => (s.dao || 'li') === d.id).sort((a, b) => baseRank(a.id) - baseRank(b.id));
  const cl = clashOf(d);
  return `<section class="dao" id="dao-${d.id}" style="--dc:${d.color}">
<div class="dh"><h2><i class="dot"></i>${esc(d.n)}<small>${list.length} 种</small></h2><p class="dd">${esc(d.d)}</p>
<dl class="reso"><dt>2 只同道</dt><dd>${esc(d.r2.d)}</dd><dt>4 只同道</dt><dd>${esc(d.r4.d)}</dd>${cl.length ? `<dt class="cl">相冲</dt><dd>和${cl.map(esc).join('、')}同时上阵，两边的共鸣都打五折</dd>` : ''}</dl></div>
<div class="grid">${list.map(guCard).join('\n')}</div></section>`;
}

// ---------- 杀招 ----------
const combos = COMBOS2.filter(c => c.need.every(x => SP[x]));
const byId = Object.fromEntries(combos.map(c => [c.id, c]));
function comboCard(c) {
  const daos = [...new Set(c.need.map(x => (SP[x].dao || 'li')))];
  const from = c.from && byId[c.from];
  return `<article class="combo" data-q="${esc(c.n + ' ' + nameOf(c.core))}">
<h3>${esc(c.n)}${c.canon ? seal : ''}${from ? '<span class="up">进阶</span>' : ''}</h3>
<p class="cds">${daos.map(x => `<span class="dc" style="--dc:${DAO[x].color}">${esc(daoName(x))}</span>`).join('')}</p>
<p>${esc(c.d)}</p>
<p class="core">核心蛊：<b>${esc(nameOf(c.core))}</b>${from ? `　由「${esc(from.n)}」进阶而来` : ''}</p>
<details class="spoil"><summary>展开配方（剧透）</summary><p>${c.need.map(x => `<span class="need"${x === c.core ? ' data-core="1"' : ''}>${esc(nameOf(x))}</span>`).join('')}</p><p class="mu">配方里的蛊同时站在空窍里，杀招就会成形。</p></details>
</article>`;
}

// ---------- 食物 ----------
const foodCard = f => `<article class="food"><div class="pic">${foodArt(f.id)}</div><div><h3>${esc(f.n)}</h3><p class="kind">${esc(FOOD_KIND[f.kind] || f.kind)}</p><p>${esc(f.d)}</p></div></article>`;
const KIND_ORDER = Object.keys(FOOD_KIND);
const foodGroups = KIND_ORDER.map(k => [k, FOODS.filter(f => f.kind === k)]).filter(([, l]) => l.length);

const sections = DAOS.map(daoSection).join('\n');
const comboHTML = `<div class="grid c">${combos.filter(c => !c.from).map(comboCard).join('\n')}</div>
<h3 class="sub2">进阶杀招</h3><p class="mu">凑齐原来的杀招，再多加一两只，就会升成更强的进阶杀招。</p><div class="grid c">${combos.filter(c => c.from).map(comboCard).join('\n')}</div>`;
const foodHTML = foodGroups.map(([k, l]) => `<h3 class="sub2">${esc(FOOD_KIND[k])}<small>${l.length} 种</small></h3><div class="grid f">${l.map(foodCard).join('\n')}</div>`).join('\n');

const CSS = `
:root{--bg:#15130f;--bg2:#1e1b16;--line:rgba(233,224,204,.16);--tx:#ddd3bf;--mu:#9a917d;--strong:#eee5d1;--zhu:#d8553f;--qing:#6fb7a4;--atk:#d0644d;--hp:#6fb7a4;--chip:#26221b;--chipon:#b5301f;--chipontx:#f3ead6;--pic:#e3d9c2;color-scheme:dark}
@media (prefers-color-scheme:light){:root{--bg:#eee6d4;--bg2:#f6f0e1;--line:rgba(40,32,24,.2);--tx:#1f1b16;--mu:#5b5244;--strong:#1a1612;--zhu:#a82a1b;--qing:#2c6e5e;--atk:#9a3322;--hp:#2f5a4c;--chip:#e6dcc6;--chipon:#a82a1b;--chipontx:#f8f3e7;--pic:#f8f3e7;color-scheme:light}}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:12px}
body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif;overflow-x:hidden;-webkit-font-smoothing:antialiased}
.wrap{max-width:1120px;margin:0 auto;padding:12px 16px 40px}
.top a{display:inline-block;color:var(--zhu);text-decoration:none;font-weight:700;padding:8px 0}
.top a:hover{text-decoration:underline}
a:focus-visible,button:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid var(--zhu);outline-offset:2px}
h1{font-family:"Kaiti SC","STKaiti","KaiTi","BiauKai",serif;font-size:32px;letter-spacing:.1em;margin:6px 0 2px;color:var(--strong)}
.sub{margin:0 0 14px;color:var(--mu)}
.nav{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
.nav a,.chip{font:inherit;font-size:13px;padding:4px 11px;border:1px solid var(--line);border-radius:14px;background:var(--chip);color:var(--tx);text-decoration:none;cursor:pointer}
.nav a.big{border-color:var(--zhu);color:var(--zhu)}
.chip[aria-pressed=true]{background:var(--chipon);color:var(--chipontx);border-color:var(--chipon)}
.tools{padding:8px 0 10px;border-bottom:1px solid var(--line);margin-bottom:8px}
.tools input{width:100%;font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:3px;background:var(--bg2);color:var(--tx)}
.group{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px}
.group>span{color:var(--mu);font-size:13px}
.count{margin:8px 0 0;font-size:13px;color:var(--mu)}
.dao,.panel{margin-top:28px}
.dao[hidden]{display:none}
h2{font-family:"Kaiti SC","STKaiti","KaiTi","BiauKai",serif;font-size:26px;margin:0;color:var(--strong);letter-spacing:.08em;display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-bottom:2px solid var(--dc,var(--zhu));padding-bottom:4px}
h2 small{font-family:inherit;font-size:13px;color:var(--mu);letter-spacing:0;font-weight:400}
.dot{width:14px;height:14px;border-radius:50%;background:var(--dc);display:inline-block}
.dd{margin:6px 0 8px;color:var(--mu)}
.panel .dd{margin-bottom:14px}
.reso{margin:0 0 12px;display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:14px}
.reso dt{font-weight:700;color:var(--strong);white-space:nowrap}
.reso dt.cl{color:var(--zhu)}
.reso dd{margin:0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));gap:12px;align-items:start}
.card,.combo,.food{background:var(--bg2);border:1px solid var(--line);border-radius:4px;padding:12px;min-width:0}
.card[hidden]{display:none}
.head{display:flex;gap:10px}
.pic1{flex:none;width:76px;height:76px;background:var(--pic);border-radius:3px;overflow:hidden}
.pic1 svg,.pic svg{display:block;width:100%;height:100%}
.who{min-width:0}
h3{font-family:"Kaiti SC","STKaiti","KaiTi","BiauKai",serif;font-size:20px;margin:0;color:var(--strong);letter-spacing:.05em}
.rk{margin:0;font-size:12px;color:var(--zhu)}
.lore{margin:2px 0 0;font-size:13px;color:var(--mu);line-height:1.45}
.seal{font-style:normal;font-family:"Kaiti SC","STKaiti",serif;font-size:10px;line-height:1;color:#f8f3e7;background:#a82a1b;padding:2px 3px;margin-left:6px;border-radius:2px;vertical-align:middle;letter-spacing:0}
.sk{list-style:none;margin:8px 0 6px;padding:0;font-size:13.5px}
.sk li{margin-bottom:5px}
.sk b,.aw b{display:block;color:var(--qing);font-size:13px}
details{margin-top:4px}
summary{cursor:pointer;color:var(--zhu);font-size:13px;padding:6px 0;list-style:none}
summary::-webkit-details-marker{display:none}
summary::before{content:"▸ "}
details[open]>summary::before{content:"▾ "}
.evo{display:flex;gap:6px;margin:6px 0 10px}
figure{margin:0;flex:0 0 calc((100% - 24px) / 5);min-width:0;text-align:center}
.pic{background:var(--pic);border-radius:3px;aspect-ratio:1;overflow:hidden}
figcaption{font-size:12px;color:var(--mu);margin-top:2px}
.num{margin:0;font-size:11px;font-weight:700;line-height:1.35}
.num span{display:block}
.a{color:var(--atk)}.h{color:var(--hp)}
.aw{margin-top:6px;border-top:1px dashed var(--line);padding-top:6px;font-size:13.5px}
.aw h4{margin:0 0 2px;font-size:13px;color:var(--strong)}
.aw p{margin:0 0 4px}
.combo h3{display:flex;align-items:center;flex-wrap:wrap}
.up{font-family:-apple-system,"PingFang SC",sans-serif;font-size:11px;border:1px solid var(--zhu);color:var(--zhu);border-radius:3px;padding:0 5px;margin-left:8px;letter-spacing:0}
.cds{margin:4px 0;display:flex;gap:5px;flex-wrap:wrap}
.dc{font-size:12px;padding:0 8px;border-radius:10px;border:1px solid var(--dc);color:var(--strong)}
.combo p{margin:4px 0;font-size:14px}
.core b{color:var(--zhu)}
.mu{color:var(--mu);font-size:13px}
.spoil p{margin:4px 0}
.need{display:inline-block;margin:0 6px 4px 0;padding:0 8px;border:1px solid var(--line);border-radius:3px;font-size:13px}
.need[data-core]{border-color:var(--zhu);color:var(--zhu)}
.sub2{margin:20px 0 6px;font-size:18px}
.sub2 small{font-size:12px;color:var(--mu);font-family:sans-serif;margin-left:6px}
.grid.f{grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr))}
.food{display:flex;gap:10px}
.food .pic{flex:none;width:64px;height:64px;aspect-ratio:auto}
.food h3{font-size:17px}
.food p{margin:0;font-size:13px}
.kind{color:var(--zhu);font-size:12px!important}
.none{text-align:center;color:var(--mu);padding:30px 0}
.none[hidden]{display:none}
footer{margin-top:40px;padding-top:12px;border-top:1px solid var(--line);color:var(--mu);font-size:13px}
.hid{position:absolute;width:0;height:0;overflow:hidden}
:target{outline:2px solid var(--zhu)}
`;

const JS = `
(function(){
  var cards=[].slice.call(document.querySelectorAll('.card')),secs=[].slice.call(document.querySelectorAll('.dao')),q=document.getElementById('q'),cnt=document.getElementById('cnt'),none=document.getElementById('none'),rank='';
  function apply(){
    var k=q.value.trim().toLowerCase(),n=0;
    cards.forEach(function(c){var ok=(!rank||c.dataset.rank===rank)&&(!k||c.dataset.q.toLowerCase().indexOf(k)>=0);c.hidden=!ok;if(ok)n++;});
    secs.forEach(function(s){s.hidden=!s.querySelector('.card:not([hidden])');});
    cnt.textContent='共 '+n+' 种';none.hidden=n>0;
  }
  [].forEach.call(document.querySelectorAll('.chip'),function(b){
    b.addEventListener('click',function(){rank=b.dataset.v;[].forEach.call(document.querySelectorAll('.chip'),function(x){x.setAttribute('aria-pressed',x===b)});apply();});
  });
  q.addEventListener('input',apply);apply();
})();
`;

const ranks = [...new Set(SPECIES.map(s => baseRank(s.id)))].sort((a, b) => a - b);
const chips = [['', '全部'], ...ranks.map(r => [String(r), rankName(r)])].map(([v, t]) => `<button type="button" class="chip" data-v="${v}" aria-pressed="${v === ''}">${t}</button>`).join('');
const n = SPECIES.length;
const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>蛊典图鉴 · 蛊码 GuCode</title>
<meta name="description" content="蛊码里的全部 ${n} 种蛊：按道分类，每只蛊从一转到五转的样貌、技能和觉醒，以及杀招和食物图鉴。">
<style>${CSS}</style>
</head>
<body>
<svg class="hid" aria-hidden="true" focusable="false"><defs>${guSVG('boar', { standalone: true }).match(/<defs>(.*?)<\/defs>/s)[1]}${[...clips.values()].join('')}</defs></svg>
<div class="wrap">
<div class="top"><a href="./">← 回到游戏</a></div>
<h1>蛊典图鉴</h1>
<p class="sub">共 ${n} 种蛊，分属 ${DAOS.length} 个道。同一道的蛊同时上阵会有共鸣；每只蛊一转比一转气派，点开能看到一转到五转的样子。</p>
<nav class="nav" aria-label="跳到">${DAOS.map(d => `<a href="#dao-${d.id}" style="border-color:${d.color}">${esc(d.n)}</a>`).join('')}<a class="big" href="#combos">杀招图鉴</a><a class="big" href="#foods">食物图鉴</a></nav>
<div class="tools">
<input id="q" type="search" placeholder="按名字搜索蛊，如：熊力、金蝉" aria-label="按名字搜索" autocomplete="off">
<div class="group"><span>原生转数</span>${chips}</div>
<p class="count" id="cnt" aria-live="polite"></p>
</div>
${sections}
<p class="none" id="none" hidden>没有找到这样的蛊，换个条件试试。</p>
<section class="panel" id="combos"><h2>杀招图鉴<small>${combos.length} 个</small></h2><p class="dd">杀招要攒够配方里的蛊才会成形，游戏里是一个个揭晓的。这里先只列名字、效果和核心蛊，想提前知道配方，再点开「剧透」。</p>
${comboHTML}</section>
<section class="panel" id="foods"><h2>食物图鉴<small>${FOODS.length} 种</small></h2><p class="dd">喂给蛊，或挂在蛊身上，各有各的用处。</p>
${foodHTML}</section>
<footer>名字带「原著」印的，取自原著里的名字；所有说明文字都是蛊码自己写的。本页的数字和游戏里一致。</footer>
</div>
<script>${JS}</script>
</body>
</html>
`;
writeFileSync(OUT, html);
console.log(`写出 ${OUT}：${n} 种蛊、${DAOS.length} 道、${combos.length} 个杀招、${FOODS.length} 种食物，${(html.length / 1024).toFixed(0)} KB`);
