// PW=<playwright 路径> node tools/ledger-shots.mjs —— 算力履历自查截图：宽屏 / 320 窄栏 × 深浅主题、某日详情、周天额度、灵根、年度卡，
// 抓页面报错；年度卡的二维码用 macOS CoreImage 解码，核对是否指向游戏首页。
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), out = n => path.join(root, 'shots', 'ledger-' + n + '.png'), url = 'file://' + path.join(root, 'index.html');
const errs = [], browser = await chromium.launch(), w = (p, ms) => p.waitForTimeout(ms);
async function open(width, scheme, height = 900) {
  const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: scheme });
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(url); await w(p, 300); await p.click('.starter >> nth=0'); await w(p, 300);
  return p;
}
async function panel(p, name) {   // 视口拉到面板全高，整张截下
  await p.click('[data-act=ledger]'); await w(p, 450);
  const h = await p.evaluate(() => Math.ceil(document.querySelector('.lg-wrap').getBoundingClientRect().height) + 2);
  await p.setViewportSize({ width: p.viewportSize().width, height: h }); await w(p, 300);
  await p.evaluate(() => { const s = document.querySelector('.lg-calsc'); if (s) s.scrollLeft = s.scrollWidth; });
  await p.screenshot({ path: out(name) });
}
const d = await open(1440, 'dark');
await d.screenshot({ path: out('main-shades') });
await panel(d, 'wide-dark');
const cells = d.locator('.lg-c.l3'); await cells.nth(Math.max(0, (await cells.count()) - 9)).click(); await w(d, 200);
await d.locator('#lgCal').screenshot({ path: out('day') });
await d.locator('#lgQuota').screenshot({ path: out('quota') });
await d.locator('#lgRoot').screenshot({ path: out('root') });
await d.click('[data-lg=hday] >> nth=-2').catch(() => {}); await d.click('[data-lg=mode][data-m=day]'); await w(d, 150);
await d.locator('#lgCurve').screenshot({ path: out('curve-day') });
await d.click('[data-lg=card]'); await d.waitForSelector('.lg-cardimg img'); await w(d, 200);
const src = await d.getAttribute('.lg-cardimg img', 'src'); fs.writeFileSync(out('card'), Buffer.from(src.split(',')[1], 'base64'));
await d.close();
const l = await open(1440, 'light'); await panel(l, 'wide-light'); await l.close();
for (const s of ['dark', 'light']) { const n = await open(320, s, 700); await panel(n, 'narrow-' + s); await n.close(); }
const sp = await open(390, 'dark', 844); await sp.click('[data-act=settings]'); await w(sp, 300); await sp.locator('.sheet').screenshot({ path: out('settings') }); await sp.close();
await browser.close();
// 二维码核对
const js = `ObjC.import('CoreImage');function run(a){const i=$.CIImage.imageWithContentsOfURL($.NSURL.fileURLWithPath(a[0]));const d=$.CIDetector.detectorOfTypeContextOptions($.CIDetectorTypeQRCode,$(),$({CIDetectorAccuracy:$.CIDetectorAccuracyHigh}));const f=d.featuresInImage(i);return f.count?ObjC.unwrap(f.objectAtIndex(0).messageString):'(none)'}`;
const tmp = path.join(root, 'shots', '.lgqr.js'); fs.writeFileSync(tmp, js);
let got = '(未解码)'; try { got = execFileSync('osascript', ['-l', 'JavaScript', tmp, out('card')]).toString().trim(); } catch (e) {} fs.unlinkSync(tmp);
console.log('card QR:', got, got === 'https://1596941391qq.github.io/gu-code/' ? '✓' : '✗');
console.log(errs.length ? 'page errors:\n' + errs.join('\n') : 'no page errors');
