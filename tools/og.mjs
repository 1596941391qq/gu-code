// PW=<playwright 路径> node tools/og.mjs —— 生成 1200×630 链接预览图 og.png（仓库根目录）
import { createRequire } from 'node:module';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { guSVG, ART_DEFS } from '../src/art.js';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bug = (sp, x, y, s, r = 0, o = 1) => `<div class="bug" style="left:${x}px;top:${y}px;width:${s}px;height:${s}px;transform:rotate(${r}deg);opacity:${o}">${guSVG(sp)}</div>`;
const digits = '0123456789'.split(''), stream = Array.from({ length: 46 }, (_, i) => `<i style="opacity:${(0.15 + 0.85 * Math.sin(i / 46 * Math.PI)).toFixed(2)}">${digits[(i * 7 + 3) % 10]}</i>`).join('');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:#ece3cf;font-family:"Kaiti SC","STKaiti","KaiTi",serif;color:#1f1b16;position:relative}
.paper{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 46%,rgba(255,250,238,.75),rgba(236,227,207,0) 62%)}
.wash{position:absolute;border-radius:50%;background:radial-gradient(circle,rgba(31,27,22,.16),rgba(31,27,22,.06) 45%,transparent 70%);filter:url(#wash)}
.bug{position:absolute}.bug svg{width:100%;height:100%}
.mid{position:absolute;left:0;right:0;top:92px;text-align:center}
h1{font-weight:400;font-size:218px;line-height:1;letter-spacing:.06em;color:#15120e}
.tag{margin-top:26px;font-size:58px;letter-spacing:.08em;color:#1f1b16}
.tag b{font-weight:400;color:#a82a1b}
.sub{margin-top:22px;font:28px/1.3 -apple-system,"PingFang SC",sans-serif;color:#5b5244;letter-spacing:.04em}
.seal{position:absolute;left:836px;top:96px;width:92px;height:92px;background:#a82a1b;color:#f6efe0;border-radius:4px;transform:rotate(-6deg);display:grid;place-items:center;font-size:30px;line-height:1.05;text-align:center;box-shadow:inset 0 0 0 5px #a82a1b,inset 0 0 0 7px #f6efe0}
.stream{position:absolute;left:0;right:0;bottom:44px;text-align:center;font:600 22px ui-monospace,Menlo,monospace;letter-spacing:.42em;color:#2c6e5e}
.stream i{font-style:normal}
.foot{position:absolute;right:40px;bottom:16px;font:20px ui-monospace,Menlo,monospace;color:#8a7f6d}
</style></head><body><svg width="0" height="0" style="position:absolute"><defs>${ART_DEFS}</defs></svg>
<div class="paper"></div>
<div class="wash" style="left:-60px;top:250px;width:420px;height:420px"></div><div class="wash" style="left:880px;top:-40px;width:400px;height:400px"></div><div class="wash" style="left:900px;top:330px;width:340px;height:340px;opacity:.7"></div>
${bug('mantis', 46, 110, 250, -8)}${bug('cicada', 70, 360, 190, 6, .9)}${bug('scorp', 930, 70, 230, 10)}${bug('boar', 935, 330, 220, -4, .95)}
<div class="mid"><h1>蛊码</h1><p class="tag">烧 <b>Token</b>，养蛊，斗道</p><p class="sub">写代码烧掉的 token 喂养蛊虫 · 自走棋斗蛊</p></div>
<div class="seal">蛊码<br>GU</div>
<div class="stream">${stream}</div><div class="foot">1596941391qq.github.io/gu-code</div>
</body></html>`;
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await p.setContent(html); await p.waitForTimeout(300);
await p.screenshot({ path: path.join(root, 'og.png') }); await b.close();
console.log('og.png 1200×630');
