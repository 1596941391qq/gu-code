// node tools/shots.mjs —— 用 Playwright 自查：手机 390 / 桌面 1440 截图 + 抓页面报错
import { createRequire } from 'node:module';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const req = createRequire(import.meta.url);
const PW = process.env.PW || 'playwright';
const { chromium } = req(PW);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = n => path.join(root, 'shots', n);
const url = 'file://' + path.join(root, 'index.html') + (process.argv[2] ? '#c=' + process.argv[2] : '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = []; page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
const w = ms => page.waitForTimeout(ms);
await page.goto(url); await w(600);
await page.screenshot({ path: out('m0-start.png') });
await page.click('.starter >> nth=0'); await w(300);
await page.click('[data-act=demo][data-m=wuhuo]');
for (let k = 0; k < 5; k++) { await page.click('.node:not([disabled]) >> nth=' + (k % 2)); await w(4600); }
await page.screenshot({ path: out('m1-main.png') });
await page.click('[data-act=demo][data-m=rest]'); await w(1800);
await page.click('[data-act=ghost]'); await w(3200);
await page.screenshot({ path: out('m2-battle.png') });
await page.click('[data-act=skip]'); await w(900);
await page.screenshot({ path: out('m3-result.png') });
const lootBtn = await page.$('[data-act=loot]'); if (lootBtn) await lootBtn.click(); else await page.click('[data-act=closeBattle]');
await w(400); await page.click('[data-act=share]'); await w(1800);
await page.screenshot({ path: out('m4-share.png') });
const code = await page.textContent('#codeTxt');
await page.click('.x'); await page.setViewportSize({ width: 1440, height: 900 }); await w(400);
await page.screenshot({ path: out('d1-main.png') });
await page.click('[data-act=trib]'); await w(3500);
await page.screenshot({ path: out('d2-battle.png') });
console.log('code', code.length, code); console.log(errs.length ? errs.join('\n') : 'no page errors');
await browser.close();

// ---- 插件 Webview 路径：伪造 acquireVsCodeApi，侧栏宽度 320 ----
{
  const b2 = await chromium.launch();
  const pg = await b2.newPage({ viewport: { width: 320, height: 760 }, deviceScaleFactor: 2 });
  const er = []; pg.on('pageerror', e => er.push(e.message));
  await pg.addInitScript(() => {
    window.__posted = [];
    window.acquireVsCodeApi = () => ({ postMessage: m => {
      window.__posted.push(m.type);
      if (m.type === 'ready') setTimeout(() => {
        window.postMessage({ type: 'init', save: null, pending: { tokens: 0 } }, '*');
        let k = 0; setInterval(() => { k++; window.postMessage({ type: 'tokens', delta: k < 12 ? 90000 : 0, hot: k % 3 === 0, rate: k < 12 ? 2400 : 0, idle: k >= 14 }, '*'); }, 1000);
      }, 50);
    } });
  });
  await pg.goto('file://' + path.join(root, 'index.html')); await pg.waitForTimeout(500);
  await pg.click('.starter >> nth=1'); await pg.click('.node:not([disabled]) >> nth=0'); await pg.waitForTimeout(6500);
  await pg.click('.node:not([disabled]) >> nth=1'); await pg.waitForTimeout(5000);
  await pg.screenshot({ path: out('v1-vscode-sidebar.png') }); await pg.waitForTimeout(5000);
  const ghostOk = await pg.$eval('[data-act=ghost]', b => !b.disabled);
  console.log('vscode path: posted', [...new Set(await pg.evaluate(() => window.__posted))].join(','), '| fight unlocked after idle:', ghostOk, '| errors:', er.length ? er.join(';') : 'none');
  await b2.close();
}
