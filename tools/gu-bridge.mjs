#!/usr/bin/env node
// 蛊码 GuCode · 本地桥（零依赖 node CLI，复用 vscode-ext/adapters.js 和 ledger.js）
//
// 两种用法，可以同时开：
//   1) 多机汇总：在另一台机器上跑，按来源把累计 token 写进一个 JSON 文件（放 iCloud / Dropbox / Syncthing 等同步盘），
//      主力机的插件在设置 gucode.bridgeFiles 里填这个文件路径即可汇入。不监听任何端口。
//        node tools/gu-bridge.mjs --out ~/Dropbox/gucode/laptop.json [--host laptop] [--interval 5]
//      文件格式：{ v: 1, host, updated, sources: { [srcKey]: { label, total, rawTotal } } }   total = eq 算力当量，rawTotal = raw 全量吞吐；
//      都是这台机器从第一次运行起的累计（重启续算）
//   2) 网页版本地桥：只监听 127.0.0.1（默认 47321），SSE 推送和插件 postMessage 完全一致的 tokens / ledger 消息。
//        node tools/gu-bridge.mjs --serve [--port 47321]
//      GET /stream  SSE（data: <与插件相同的 JSON>）；GET /health  { ok, v, sources }
//      CORS 只放行 https://1596941391qq.github.io 和 file://（Origin: null）；处理 Private Network Access 预检。
// 其他参数：--root <adapter>=<目录>（手动加目录，可重复）  --list（列出发现的来源后退出）  --no-ledger（serve 时不回填履历）
// 隐私：只读 usage 数字、模型名、工具名；不读正文，不外发（serve 只绑本机回环地址）。
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const A = require(path.join(here, '..', 'vscode-ext', 'adapters.js'));
const LG = require(path.join(here, '..', 'vscode-ext', 'ledger.js'));

const argv = process.argv.slice(2), has = k => argv.includes(k);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const all = k => argv.flatMap((a, i) => (a === k && argv[i + 1] ? [argv[i + 1]] : []));
const expand = p => p && p.replace(/^~(?=$|[\\/])/, os.homedir());
if (has('--help') || has('-h') || !(has('--out') || has('--serve') || has('--list'))) {
  console.log('用法：node tools/gu-bridge.mjs --out <同步盘里的 json> [--host 名字] [--interval 秒]\n      node tools/gu-bridge.mjs --serve [--port 47321]\n      node tools/gu-bridge.mjs --list\n详见 docs/adapters.md'); process.exit(0);
}
const host = arg('--host', os.hostname().replace(/\.local$/, ''));
const extra = all('--root').map(s => { const [adapter, ...p] = s.split('='); return { adapter, path: expand(p.join('=')), label: '' }; });
const meter = A.createMeter(10000);
const totals = {};
let ledger = null;

const tracker = A.createTracker({
  env: process.env, sys: A.systemInfo(process.env, { workspace: [process.cwd()] }), extra,
  onRecord(r) {
    if (r.n > 0 || r.x > 0) { meter.add(r.key, r.label, r.n, r.x); const t = totals[r.key] || (totals[r.key] = { label: r.label, total: 0, rawTotal: 0 }); t.total += r.n; t.rawTotal = (t.rawTotal || 0) + r.x; t.label = r.label; dirty = true; }
    r.live = true; if (ledger) ledger.add(r);
  },
});
let dirty = false;
await tracker.discover(true);
for (const s of tracker.list()) meter.ensure(s.key, s.label);

if (has('--list')) {
  for (const s of tracker.list()) console.log(`${s.key.padEnd(28)} ${s.label.padEnd(24)} ${s.dir}${s.error ? '  !' + s.error : ''}`);
  console.log(`${tracker.files.size} 个日志文件`); process.exit(0);
}

// ---------- 1) 写桥接文件 ----------
const out = expand(arg('--out', ''));
if (out) {
  try { const d = JSON.parse(fs.readFileSync(out, 'utf8')); if (d && d.host === host) for (const [k, s] of Object.entries(d.sources || {})) totals[k] = { label: s.label, total: +s.total || 0, rawTotal: +s.rawTotal || +s.total || 0 }; } catch (e) {}
  for (const s of tracker.list()) if (!totals[s.key]) totals[s.key] = { label: s.label, total: 0, rawTotal: 0 };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const write = () => {
    const tmp = out + '.tmp-' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify({ v: 1, host, updated: Date.now(), sources: totals }));
    fs.renameSync(tmp, out); dirty = false;
  };
  write();
  setInterval(() => { if (dirty) write(); }, Math.max(1, +arg('--interval', 5)) * 1000);
  console.log(`[gu-bridge] ${host} → ${out}（${tracker.list().length} 个来源）`);
}

// ---------- 2) 网页版本地桥 ----------
if (has('--serve')) {
  const port = +arg('--port', 47321);
  const ALLOW = new Set(['https://1596941391qq.github.io', 'null']);
  const store = path.join(os.homedir(), '.gucode', 'ledger.json');
  if (!has('--no-ledger')) {
    ledger = LG.createLedger({
      load: () => { try { return JSON.parse(fs.readFileSync(store, 'utf8')); } catch (e) { return null; } },
      save: s => { fs.mkdirSync(path.dirname(store), { recursive: true }); fs.writeFileSync(store + '.tmp', JSON.stringify(s)); fs.renameSync(store + '.tmp', store); },
      settings: () => ({ weeklyReset: arg('--weekly-reset', ''), limits: { claude5h: +arg('--claude5h', 0) || 0, claudeWeek: +arg('--claude-week', 0) || 0 } }),
    });
    const t0 = Date.now();
    ledger.backfill(A.scanHistory, tracker).then(r => { console.log(`[gu-bridge] 履历回填完成：${r.files} 个文件 ${(r.bytes / 1e6).toFixed(0)}MB，${((Date.now() - t0) / 1000).toFixed(1)}s`); broadcast(ledgerMsg()); });
  }
  const clients = new Set();
  const ledgerMsg = () => { for (const s of tracker.sources.values()) if (s.shared.rl) ledger.setRateLimits(s.key, s.shared.rl); return ledger.message(tracker.list()); };
  const send = (res, m) => res.write('data: ' + JSON.stringify(m) + '\n\n');
  const broadcast = m => { for (const c of clients) send(c, m); };
  let lastTokens = { type: 'tokens', delta: 0, hot: false, rate: 0, idle: true, rawDelta: 0, rawRate: 0, bySource: {} };
  const cors = (req, res) => {
    const origin = req.headers.origin;
    if (origin === undefined) return true;                       // 非浏览器（curl 等）
    if (!ALLOW.has(origin)) { res.writeHead(403, { 'Content-Type': 'text/plain' }); res.end('origin not allowed'); return false; }
    res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin');
    if (req.headers['access-control-request-private-network'] === 'true') res.setHeader('Access-Control-Allow-Private-Network', 'true');
    return true;
  };
  const server = http.createServer((req, res) => {
    if (!cors(req, res)) return;
    const url = (req.url || '/').split('?')[0];
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || 'Content-Type', 'Access-Control-Max-Age': '600' });
      return res.end();
    }
    if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
    if (url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify({ ok: true, v: 1, app: 'gu-bridge', sources: tracker.list().map(s => ({ key: s.key, label: s.label })) })); }
    if (url === '/stream') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 3000\n\n'); send(res, lastTokens); if (ledger) send(res, ledgerMsg());
      clients.add(res); req.on('close', () => clients.delete(res));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('gu-bridge: /stream /health');
  });
  server.on('error', e => { console.error('[gu-bridge] 端口 ' + port + ' 打不开：' + e.message); process.exit(1); });
  server.listen(port, '127.0.0.1', () => console.log(`[gu-bridge] 网页版本地桥 http://127.0.0.1:${port}/stream（${tracker.list().length} 个来源）`));
  setInterval(() => {
    const now = Date.now(), r = meter.step(now), idle = !meter.lastAt || now - meter.lastAt > 30000;
    lastTokens = { type: 'tokens', delta: r.delta, hot: r.rate >= 2000, rate: r.rate, idle, rawDelta: r.rawDelta, rawRate: r.rawRate, bySource: r.bySource };
    broadcast(lastTokens);
  }, 1000);
  setInterval(() => { for (const c of clients) c.write(': ping\n\n'); }, 15000);
  if (ledger) setInterval(() => { broadcast(ledgerMsg()); ledger.persist(); }, 60000);
  const bye = () => { try { ledger && ledger.persist(); } catch (e) {} process.exit(0); };
  process.on('SIGINT', bye); process.on('SIGTERM', bye);
}

setInterval(() => tracker.tick(), 1000);
setInterval(() => tracker.discover(false).then(() => { for (const s of tracker.list()) meter.ensure(s.key, s.label); }), 10000);
