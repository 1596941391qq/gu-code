// PW=<playwright 路径> node tools/tutorial-shots.mjs —— 新玩家首次流程（新手引导）逐步截图到 shots/tut-*.png
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const O = new URL('../shots/tut-', import.meta.url).pathname;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark' });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const w = ms => p.waitForTimeout(ms), bub = async () => (await p.textContent('#tut-bub .tt').catch(() => '')) || '';
const shot = async n => { await p.screenshot({ path: O + n + '.png' }); console.log(n, '|', await bub()); };
await p.goto(new URL('../index.html', import.meta.url).href); await w(800); await shot('1-pick');
await p.click('.starter >> nth=0'); await w(700); await shot('2-path');
await p.click('.node >> nth=0'); await w(700); await shot('3-feed');
for (let i = 0; i < 60 && !(await p.$('[data-act=ghost]')); i++) { await w(500); const o = await p.$('.opt'); if (o) { await shot('3b-choose'); await o.click(); } }
await w(600); await shot('4-ghost');
await p.click('[data-act=ghost]'); await w(600); await shot('5-ghostgo');
await p.click('[data-act=ghostGo] >> nth=0'); await w(1200); await shot('5b-prep');
await p.click('[data-act=fight]'); await w(3000); await shot('6-battle');
await p.click('[data-act=skip]'); for (let i = 0; i < 40 && !(await p.$('.result')); i++) await w(250); await w(2500); await shot('6b-result');
console.log('result:', (await p.textContent('.result')).replace(/\s+/g, ' ').slice(0, 200));
const lb = await p.$('[data-act=loot]'); if (lb) await lb.click(); else await p.click('[data-act=closeBattle]');
await w(2500); await shot('7-shop');
console.log('lvbar:', await p.textContent('#lvbar'), '| tray:', await p.textContent('#tray'));
const ware = p.locator('.ware:not(.cant):not(.sold) .wbuy').first(); if (await ware.count()) { await ware.click(); await w(300); const by = p.locator('.sheet [data-act=buy]:not([disabled])'); if (await by.count()) await by.click(); else await p.click('.sheet .x'); }
await w(1200); if ((await bub()).includes('蛊市')) { await p.evaluate(() => document.querySelector('[data-act=refresh]').click()); }
await w(1500); await shot('8-formation');
console.log(errs.join('\n') || 'no errors'); await b.close();
