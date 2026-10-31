// PW=<playwright 路径> [OUT=截图目录/] node tools/shots.mjs —— v2 自查截图并抓页面报错：
//   新玩家（手机 390 · 深色）：开局 → 洞府 → 蛊市详情 → 秘境列表 → 试阵 → 出征一路点到回洞府
//   老存档（v2 早期的小数字存档，手机 · 浅色）：读档换算后的洞府和蛊卡悬停
//   桌面 1440（深色、浅色）和插件侧栏 320（浅色）的洞府
// 元气只为截图给足（改存档），不走真实流速。默认存到仓库的 shots/v2-*.png
import { createRequire } from 'node:module';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.OUT || path.join(root, 'shots', 'v2-'), url = 'file://' + path.join(root, 'index.html');
const errs = [], browser = await chromium.launch();
async function page(o = {}, save = null) {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ...o });
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.setDefaultTimeout(8000);
  if (save) await p.addInitScript(s => { try { if (!sessionStorage.getItem('sv')) { localStorage.setItem('gucode.v1', JSON.stringify(s)); sessionStorage.setItem('sv', 1); } } catch (e) {} }, save);
  await p.goto(url); await p.waitForTimeout(600); return p;
}
const has = async (p, s) => (await p.locator(s).count()) > 0 && await p.locator(s).first().isVisible().catch(() => false);
const click = async (p, s) => { await p.locator(s).first().click({ force: true }); await p.waitForTimeout(250); };
const pop = async p => { while (await has(p, '.bigmo [data-big]')) await click(p, '.bigmo [data-big]'); };
const shot = (p, n) => p.screenshot({ path: OUT + n + '.png' });
const close = p => click(p, '[data-act="closeSheet"]');

// 1 新玩家
{
  let p = await page({ colorScheme: 'dark' });
  await p.evaluate(() => localStorage.clear()); await p.goto(url); await p.waitForTimeout(500);
  await shot(p, 'm0-start');
  await click(p, '[data-act="pick"]'); if (await has(p, '[data-act="dao"]')) await click(p, '[data-act="dao"]'); await pop(p); await p.waitForTimeout(800);
  const sv = await p.evaluate(() => JSON.parse(localStorage.getItem('gucode.v1'))); sv.bank = 5e7; await p.close();
  p = await page({ colorScheme: 'dark' }, sv);
  for (let i = 0; i < 5; i++) {
    await pop(p); const w = p.locator('.ware:not(.food):not(.sold) [data-act="ware"]').first();
    if (!(await w.count())) { await click(p, '[data-act="refresh"]'); continue; }
    await w.click({ force: true }); await p.waitForTimeout(200);
    if (i === 0) await shot(p, 'm2-shop-detail');
    if (await has(p, '[data-act="buy"]:not([disabled])')) await click(p, '[data-act="buy"]:not([disabled])'); else await close(p);
  }
  await pop(p); await shot(p, 'm1-home');
  await click(p, '[data-act="lands"]'); await p.waitForTimeout(300); await shot(p, 'm3-lands'); await close(p);
  for (let k = 0; k < 9 && await has(p, '.go:disabled'); k++) {   // 超额度或驱使不了：收进蛊囊
    const t = (await p.locator('.slots .gu.over').count()) ? p.locator('.slots .gu.over').first() : p.locator('.slots .gu[data-uid]').last();
    await t.click({ force: true }); await p.waitForTimeout(200);
    if (await has(p, '[data-act="toBag"]:not([disabled])')) await click(p, '[data-act="toBag"]'); else { await close(p); break; }
    await pop(p);
  }
  await click(p, '.gorow [data-act="tryOpen"]'); await p.waitForTimeout(300); await shot(p, 'm4-try'); await close(p);
  await click(p, '[data-act="go"]'); await shot(p, 'm5-go'); await click(p, '[data-act="goConfirm"]'); await shot(p, 'm6-map');
  const ORDER = ['fare', 'reward', 'offer', 'bless', 'xing"][data-y="1', 'fight', 'camp', 'ev', 'leave', 'pick', 'home'].map(x => `[data-trip="${x}"]`);
  let battles = 0, idle = 0, done = false;
  for (let i = 0; i < 400 && !done && idle < 40; i++) {
    if (await has(p, '.bigmo [data-big]')) { await click(p, '.bigmo [data-big]'); continue; }
    if (await has(p, '#battle')) {
      if (!battles++) { await p.waitForTimeout(900); await shot(p, 'm7-battle'); }
      if (await has(p, '#battle .gbv-ctl [data-s="skip"], #battle [data-act="skip"]')) await click(p, '#battle .gbv-ctl [data-s="skip"], #battle [data-act="skip"]');
      if (await has(p, '#battle .gbv-go, #battle [data-act="closeBattle"]')) { if (battles === 1) await shot(p, 'm8-result'); await click(p, '#battle .gbv-go, #battle [data-act="closeBattle"]'); } else await p.waitForTimeout(300);
      continue;
    }
    let hit = null; for (const s of ORDER) if (await has(p, s)) { hit = s; break; }
    if (!hit) { idle++; await p.waitForTimeout(300); continue; }
    idle = 0; if (hit.includes('home')) { await shot(p, 'm9-end'); done = true; } await click(p, hit);
  }
  await p.waitForTimeout(400); await pop(p); await shot(p, 'm10-back');
  console.log(done ? '新玩家：走完一趟出征' : '新玩家：出征没走完（idle）');
  await p.close();
}

// 2 老存档（v2 早期：没有 sx/hx 标记，攻血是小数字）
const G = (uid, sp, rank, atk, hp, pos) => ({ uid, sp, rank, atk, hp, food: null, xing: null, pos });
const OLD = { v: 3, started: true, name: '老存档', realm: 2, bank: 3e6, total: 9e7, seed: 11, dao: 'li', compass: null, tripFood: [], pantry: ['meat'], trip: null, land: null, meta: null, shop: [],
  team: [G('a', 'boar', 3, 9, 12, { r: 0, c: 0 }), G('b', 'fire', 2, 4, 5, { r: 1, c: 0 }), G('c', 'mantis', 2, 8, 6, { r: 0, c: 1 }), G('d', 'tiger', 1, 3, 4, { r: 2, c: 1 })], bag: [G('e', 'boar', 1, 3, 4, null)] };
{
  const p = await page({ colorScheme: 'light' }, OLD); await pop(p);
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('gucode.v1')));
  console.log('老存档换算：', st.team.map(g => `${g.sp} ${g.rank}转 攻${g.atk} 血${g.hp}`).join('，'), `sx=${st.sx} hx=${st.hx}`);
  await shot(p, 'o1-home');
  await p.locator('.slots .gu[data-uid]').first().hover({ force: true }); await p.waitForTimeout(500); await shot(p, 'o2-tip');
  await p.close();
}

// 3 桌面和插件侧栏
for (const [n, o] of [['d1-dark', { colorScheme: 'dark', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }], ['d2-light', { colorScheme: 'light', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }], ['s1-side320', { colorScheme: 'light', viewport: { width: 320, height: 800 } }]]) {
  const p = await page(o, OLD); await pop(p); await shot(p, n); await p.close();
}

console.log(errs.length ? 'page errors:\n' + [...new Set(errs)].join('\n') : 'no page errors');
await browser.close();
process.exitCode = errs.length ? 1 : 0;
