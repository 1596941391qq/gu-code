// PW=<playwright 路径> node tools/shots.mjs —— 自查截图（手机 390 / 桌面 1440 / 插件侧栏 320）并抓页面报错
import { createRequire } from 'node:module';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = n => path.join(root, 'shots', n), url = 'file://' + path.join(root, 'index.html');
const errs = [];
const browser = await chromium.launch();
async function newPage(o = {}) { const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ...o }); p.on('pageerror', e => errs.push(e.message)); return p; }
const w = (p, ms) => p.waitForTimeout(ms);
// 推进养蛊：有选择题先选，没有就点第一条可走的路
async function grow(p, n, ms = 4300) {
  for (let k = 0; k < n; k++) {
    const opt = await p.$('.opt'); if (opt) { await opt.click(); await w(p, 600); }
    const node = await p.$('.node:not([disabled]):not(.opt)'); if (node) await node.click();
    await w(p, ms);
    const ware = p.locator('.ware:not(.cant):not(.sold) .wbuy').first();
    if (await ware.count()) { await ware.click({ force: true }).catch(() => {}); await w(p, 250); const b = p.locator('.sheet [data-act=buy]:not([disabled])'); if (await b.count()) await b.click(); else if (await p.locator('.sheet .x').count()) await p.click('.sheet .x'); await w(p, 300); }
  }
  const opt = await p.$('.opt'); if (opt) { await opt.click(); await w(p, 600); }
}
const shot = process.argv[2] || 'all';

const p = await newPage({ colorScheme: 'dark' });
await p.goto(url); await w(p, 500);
await p.screenshot({ path: out('m0-start.png') });
await p.click('.starter >> nth=0'); await p.click('[data-act=demo][data-m=wuhuo]');
await grow(p, 4);
await p.screenshot({ path: out('m1-main.png') });
await p.evaluate(() => document.querySelector('#shop').scrollIntoView({ block: 'center' })); await w(p, 200);
await p.screenshot({ path: out('m6-shop.png') });
await p.click('.wbuy:not([disabled]) >> nth=0'); await w(p, 300); await p.screenshot({ path: out('m13-shop-detail.png') }); await p.click('.sheet .x'); await w(p, 200);
await p.click('[data-act=ghost]'); await w(p, 400);
await p.screenshot({ path: out('m7-ghosts.png') });
await p.click('[data-act=ghostGo] >> nth=1'); await w(p, 1600);
await p.screenshot({ path: out('m11-prep.png') });
await p.click('.mini.foe .mg >> nth=0'); await w(p, 300); await p.screenshot({ path: out('m12-foe-detail.png') }); await p.click('.sheet-bg.stack .x'); await w(p, 200);
await p.click('[data-act=fight]'); await w(p, 4200);
await p.screenshot({ path: out('m2-battle.png') });
await p.click('[data-act=skip]'); await w(p, 900);
await p.screenshot({ path: out('m3-result.png') });
const loot = await p.$('[data-act=loot]'); if (loot) await loot.click(); else await p.click('[data-act=closeBattle]');
await w(p, 300); await p.click('[data-act=share]'); await p.waitForFunction(() => document.querySelector('#cardImg')?.src?.startsWith('data:'));
await w(p, 300); await p.screenshot({ path: out('m4-share.png') });
await p.click('.x');
const path8 = await p.$('[data-act=path]'); if (path8) { await path8.click(); await w(p, 300); await p.screenshot({ path: out('m8-path.png') }); await p.click('.x'); }
await p.setViewportSize({ width: 1440, height: 900 }); await w(p, 300);
await p.screenshot({ path: out('d1-main.png') });
await p.close();

const q = await newPage({ colorScheme: 'light' });
await q.goto(url); await w(q, 300); await q.click('.starter >> nth=1'); await q.click('[data-act=demo][data-m=wuhuo]');
await grow(q, 3);
await q.screenshot({ path: out('m5-light.png') });
await q.close();

console.log(errs.length ? 'page errors:\n' + errs.join('\n') : 'no page errors');
await browser.close();
