#!/usr/bin/env node
// 蛊码 GuCode · token 统计正确性验证
//   node tools/verify-tokens.mjs              单测（全部适配器的合成样例 + 履历/额度窗口）+ 实测 60 秒
//   node tools/verify-tokens.mjs --unit       只跑单测
//   node tools/verify-tokens.mjs --seconds 90 实测时长（--grace 60：窗口结束后等多久再核算）
//   node tools/verify-tokens.mjs --ledger     加跑履历回填：计时、事件循环卡顿、随机抽 3 天和独立核算比对
// 两种口径都核对：raw 全量吞吐（含缓存读取）和 eq 算力当量（缓存读取 × 0.1）。
// 实测：用 mock vscode 真正 activate 插件跑 N 秒；同时用独立方法（JSON.parse + 按时间戳归属 + 全局 msg id 去重）
//       从日志核算同一窗口，子 agent 单独拆出来。核算只取 usage 数字，用完即丢，不输出任何正文。
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url)), ext = path.join(here, '..', 'vscode-ext');
const A = require(path.join(ext, 'adapters.js')), LG = require(path.join(ext, 'ledger.js'));
const argv = process.argv.slice(2), has = k => argv.includes(k), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n));
const same = (a, b) => !!a && a[0] === b[0] && a[1] === b[1];
let fails = 0; const ok = (c, msg) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + msg); };

// ---------- 单测：合成样例 ----------
function materialize(dst, ts) {   // 把 fixtures/home 复制到临时假 home，替换时间占位符，建 sqlite 库
  const src = path.join(here, 'fixtures', 'home'), d = new Date(ts), pad = n => String(n).padStart(2, '0');
  const rep = s => s.replace(/__TS__/g, new Date(ts).toISOString()).replace(/__TSN__/g, String(ts)).replace(/__TSS__/g, (ts / 1000).toFixed(3))
    .replace(/__RESET5H__/g, String(Math.floor(ts / 1000) + 3 * 3600)).replace(/__RESETWK__/g, String(Math.floor(ts / 1000) + 3 * 86400))
    .replace(/__DATE__/g, `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
  (function cp(a, b) {
    fs.mkdirSync(b, { recursive: true });
    for (const e of fs.readdirSync(a, { withFileTypes: true })) {
      const pa = path.join(a, e.name), pb = path.join(b, e.name);
      if (e.isDirectory()) cp(pa, pb); else fs.writeFileSync(pb, rep(fs.readFileSync(pa, 'utf8')));
    }
  })(src, dst);
  const { DatabaseSync } = require('node:sqlite');
  for (const [name, rel] of [['opencode', '.local/share/opencode/opencode.db'], ['zcode', '.zcode/cli/db/db.sqlite'], ['goose', '.local/share/goose/sessions/sessions.db']]) {
    const p = path.join(dst, rel); fs.mkdirSync(path.dirname(p), { recursive: true });
    const db = new DatabaseSync(p); db.exec(rep(fs.readFileSync(path.join(here, 'fixtures', 'sql', name + '.sql'), 'utf8'))); db.close();
  }
}
const fakeSys = home => A.systemInfo({}, { home, platform: 'linux', workspace: [path.join(home, 'proj')] });
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gucode-verify-'));

async function unit() {
  const exp = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'expected.json'), 'utf8'));
  console.log('\n[单测 1] 历史回填模式：全部适配器的合成样例');
  {
    const home = path.join(tmpRoot, 'hist'), ts = Date.now() - 3600e3; materialize(home, ts);
    await new Promise(r => setTimeout(r, 20));
    const T = A.createTracker({ env: {}, sys: fakeSys(home) }); await T.discover(true);
    const got = {}, sub = { n: 0, x: 0 }, store = {};
    const L = LG.createLedger({ load: () => null, save: s => (store.s = s) });
    await L.backfill(A.scanHistory, T);
    const res = await A.scanHistory(T, { after: 0, before: Date.now(), onRecord: r => { const g = got[r.key] || (got[r.key] = [0, 0]); g[0] += r.n + (r.snap || 0); g[1] += r.x + (r.snapX || 0); if (r.file.includes('/subagents/')) { sub.n += r.n; sub.x += r.x; } } });
    for (const [k, v] of Object.entries(exp.sources)) ok(same(got[k], v), `${k.padEnd(20)} eq ${String(got[k] && got[k][0]).padStart(6)}  raw ${String(got[k] && got[k][1]).padStart(6)} / 期望 ${v.join(' / ')}`);
    ok(same([sub.n, sub.x], exp.claude_subagent), `Claude 子 agent 计入 eq ${sub.n} raw ${sub.x} / 期望 ${exp.claude_subagent.join(' / ')}`);
    ok(!got.goose, 'Goose 只有会话累计值，历史回填不计（实时按差值计）');
    const d = L.state.days[LG.dayKey(ts)], tools = L.state.tools[LG.dayKey(ts)];
    const sum = i => Object.values(exp.sources).reduce((a, b) => a + b[i], 0);
    ok(d && d.t === sum(0) && d.x === sum(1), `履历当天合计 t(eq)=${d && d.t} x(raw)=${d && d.x} / 期望 ${sum(0)} / ${sum(1)}`);
    for (const [k, v] of Object.entries(exp.tools)) ok(tools && tools[k] === v, `工具归类 ${k} = ${tools && tools[k]} / 期望 ${v}`);
    for (const [k, v] of Object.entries(exp.models)) ok(d && d.m[k] === v, `模型族 ${k} = ${d && d.m[k]} / 期望 ${v}`);
    ok(T.list().some(s => s.label === 'Claude（.claude-work）'), '多账号目录 ~/.claude-work 自动发现，label 带目录名');
    const msg = L.message(T.list());
    const cw = msg.windows.filter(w => w.key.startsWith('codex:'));
    ok(cw.length === 2 && cw[0].basis === 'log' && cw[0].pct === 12.5 && cw[1].kind === 'week' && cw[1].pct === 40, 'Codex rate_limits → 5 小时 12.5% / 每周 40%（basis log）');
    const c5 = msg.windows.find(w => w.key === 'claude:5h');
    ok(c5 && c5.basis === 'estimate' && c5.pct === null && c5.used === exp.sources.claude[1] && c5.usedEq === exp.sources.claude[0], `Claude 5 小时估算 used(raw)=${c5 && c5.used} usedEq=${c5 && c5.usedEq} pct=null`);
    ok(store.s && store.s.until > 0, `回填完成后落盘，until=${store.s && new Date(store.s.until).toISOString()}（${res.files} 个文件）`);
  }
  console.log('\n[单测 2] 实时模式：启动后新出现的文件、增量追加、流式重复、sqlite 差值');
  {
    const home = path.join(tmpRoot, 'live'); fs.mkdirSync(home, { recursive: true });
    const got = {};
    const T = A.createTracker({ env: {}, sys: fakeSys(home), onRecord: r => { const g = got[r.key] || (got[r.key] = [0, 0]); g[0] += r.n; g[1] += r.x; } });
    await T.discover(true);
    await new Promise(r => setTimeout(r, 30)); materialize(home, Date.now());
    await T.discover(false); T.tick();
    for (const [k, v] of Object.entries(exp.sources)) ok(same(got[k], v), `${k.padEnd(20)} eq ${String(got[k] && got[k][0]).padStart(6)}  raw ${String(got[k] && got[k][1]).padStart(6)} / 期望 ${v.join(' / ')}`);
    const cf = path.join(home, '.claude/projects/-tmp-demo/s1.jsonl');
    const line = (id, o) => JSON.stringify({ type: 'assistant', message: { model: 'claude-opus-5-5', id, usage: { input_tokens: 1, cache_creation_input_tokens: 9, cache_read_input_tokens: 999, output_tokens: o } }, timestamp: new Date().toISOString() }) + '\n';
    fs.appendFileSync(cf, line('msg_L1', 5) + line('msg_L1', 25)); T.tick();
    ok(got.claude[0] === exp.sources.claude[0] + 135 && got.claude[1] === exp.sources.claude[1] + 1034, `追加两行同 msg id（流式）只计最大值：eq +${got.claude[0] - exp.sources.claude[0]} raw +${got.claude[1] - exp.sources.claude[1]} / 期望 +135 / +1034`);
    fs.appendFileSync(cf, JSON.stringify({ type: 'assistant', message: { id: 'msg_OLD', usage: { input_tokens: 100, output_tokens: 1 } }, timestamp: new Date(Date.now() - 3600e3).toISOString() }) + '\n'); T.tick();
    ok(got.claude[0] === exp.sources.claude[0] + 135, '时间戳早于 10 分钟的回放行（恢复会话）不计');
    const { DatabaseSync } = require('node:sqlite'), gp = path.join(home, '.local/share/goose/sessions/sessions.db');
    const db = new DatabaseSync(gp); db.exec("UPDATE sessions SET accumulated_input_tokens=1500, accumulated_output_tokens=250"); db.close();
    for (const f of T.files.values()) f.readAt = 0;
    T.tick();
    ok(same(got.goose, exp.goose_live_delta), `Goose 会话累计值变化按差值计：${got.goose} / 期望 ${exp.goose_live_delta}`);
  }
  console.log('\n[单测 3] 启动边界：预读文件尾巴，跨启动的流式消息只计增量');
  {
    const home = path.join(tmpRoot, 'boot'), cf = path.join(home, '.claude/projects/-p/s.jsonl'); fs.mkdirSync(path.dirname(cf), { recursive: true });
    const line = o => JSON.stringify({ type: 'assistant', message: { model: 'claude-opus-5-5', id: 'msg_B1', usage: { input_tokens: 10, cache_creation_input_tokens: 500, output_tokens: o } }, timestamp: new Date().toISOString() }) + '\n';
    fs.writeFileSync(cf, line(5));
    const xf = path.join(home, '.codex/sessions/2026/10/31/rollout-x.jsonl'); fs.mkdirSync(path.dirname(xf), { recursive: true });
    const tcl = (i, c, o) => JSON.stringify({ timestamp: new Date().toISOString(), type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: i, cached_input_tokens: c, output_tokens: o, total_tokens: i + o }, last_token_usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1, total_tokens: 2 } } } }) + '\n';
    fs.writeFileSync(xf, tcl(5000, 4000, 100));
    let got = 0, gx = 0; const T = A.createTracker({ env: {}, sys: fakeSys(home), onRecord: r => { got += r.n; gx += r.x; } }); await T.discover(true);
    fs.appendFileSync(cf, line(30)); T.tick();
    ok(got === 25, `Claude 启动前已写一块（out=5），启动后同 msg 再写（out=30）：计 ${got} / 期望 25`);
    got = 0; gx = 0; fs.appendFileSync(xf, tcl(5000, 4000, 100) + tcl(9000, 7000, 160)); T.tick();
    ok(got === 1360 && gx === 4060, `Codex 预读到上次累计后：重复事件跳过、新事件按差值：eq ${got} raw ${gx} / 期望 1360 / 4060`);
  }
  console.log('\n[单测 5] 多机桥接文件：首次只记基线、之后计增量、同名主机忽略');
  {
    const bf = path.join(tmpRoot, 'laptop.json'), self = path.join(tmpRoot, 'self.json'), got = [];
    const write = (p, host, tot) => { fs.writeFileSync(p, JSON.stringify({ v: 1, host, updated: Date.now(), sources: { claude: { label: 'Claude', total: tot } } })); const t = new Date(Date.now() + Math.random() * 1e4); fs.utimesSync(p, t, t); };
    const read = A.createBridgeReader(r => got.push(r), 'me');
    write(bf, 'laptop', 1000); write(self, 'me', 500); read([bf, self]);
    write(bf, 'laptop', 1600); write(self, 'me', 900); read([bf, self]);
    ok(got.length === 1 && got[0].n === 600 && got[0].key === 'bridge:laptop:claude' && got[0].label === 'Claude @laptop', `桥接增量 ${got.map(r => r.key + '+' + r.n).join(',')} / 期望 bridge:laptop:claude+600`);
  }
  console.log('\n[单测 4] 5 小时窗口估算 / 每周重置 / 模型族 / 工具归类');
  {
    const base = Date.UTC(2026, 9, 31, 10, 0, 0), m = t => Math.floor(t / 60000), H = 3600e3;
    const mins = [[m(base + 15 * 60e3), 100], [m(base + H), 50], [m(base + 4 * H + 59 * 60e3), 10], [m(base + 5 * H + 30 * 60e3), 7]];
    let b = LG.block5h(mins, base + 6 * H);
    ok(b && b.start === base + 5 * H && b.used === 7 && b.resetsAt === base + 10 * H, '满 5 小时后的消息开新块，新块从该消息所在整点起算');
    b = LG.block5h(mins.slice(0, 3), base + 4 * H + 59 * 60e3 + 1);
    ok(b && b.start === base && b.used === 160, '块从第一条消息（10:15）所在整点 10:00 起算，5 小时内的都算进来');
    ok(LG.block5h(mins.slice(0, 3), base + 5 * H) === null, '块结束后没有新消息：无活跃窗口（resetsAt=null）');
    ok(LG.block5h([[m(base), 1], [m(base + 7 * H), 2]], base + 7 * H + 60e3).used === 2, '间隔超过 5 小时：重新起块');
    const now = new Date(2026, 9, 31, 12, 0, 0).getTime();   // 2026-10-31 是周六（本地时间）
    ok(LG.weeklyStart('Thu 08:00', now) === new Date(2026, 9, 29, 8, 0, 0).getTime(), 'weeklyReset "Thu 08:00" → 最近的周四 08:00');
    ok(LG.weeklyStart('Sat 13:00', now) === new Date(2026, 9, 24, 13, 0, 0).getTime(), '本周重置点还没到：退回上周');
    ok(LG.weeklyStart('', now) === null, '不填 → 滚动 7 天');
    const fam = { 'claude-opus-5-5': 'claude-opus', 'claude-sonnet-4-5-20250929': 'claude-sonnet', 'claude-haiku-4-5': 'claude-haiku', 'glm-4.6': 'glm', 'GLM-5.2': 'glm', 'gpt-5-codex': 'gpt', 'o3': 'gpt', 'gemini-2.5-pro': 'gemini', 'qwen3-coder-plus': 'qwen', 'kimi-k2': 'other' };
    ok(Object.entries(fam).every(([k, v]) => LG.modelFamily(k) === v), '模型族归类');
    const tc = { Edit: 'edit', Write: 'edit', MultiEdit: 'edit', NotebookEdit: 'edit', apply_patch: 'edit', Bash: 'bash', shell: 'bash', Read: 'read', Grep: 'read', Glob: 'read', LS: 'read', WebSearch: 'web', WebFetch: 'web', Task: 'task', Agent: 'task', TodoWrite: 'other', mcp__x__y: 'other' };
    ok(Object.entries(tc).every(([k, v]) => LG.toolCat(k) === v), '工具归类');
    const L = LG.createLedger({ load: () => null, settings: () => ({ limits: { claude5h: 1000 } }) }); L.ready = true;
    const t = Date.now(); L.add({ key: 'claude', label: 'Claude', src: { id: 'claude', tag: '' }, ts: t - 60e3, n: 250, model: 'claude-opus-5-5', tools: [] });
    const w = L.message([{ key: 'claude', label: 'Claude', kind: 'claude', account: 'default' }]).windows.find(x => x.key === 'claude:5h');
    ok(w && w.pct === 25 && w.used === 250, `填了 gucode.limits.claude5h=1000 时 pct=${w && w.pct}`);
  }
}

// ---------- 实测：mock vscode 真跑插件 ----------
function mockVscode() {
  const Module = require('module'), U = p => ({ fsPath: p, with() { return p; } }), mem = new Map();
  const vscode = { Uri: { joinPath: (u, ...p) => U(path.join(u.fsPath, ...p)), file: U },
    window: { createStatusBarItem: () => ({ show() {}, dispose() {} }), registerWebviewViewProvider: () => ({ dispose() {} }), setStatusBarMessage() {} },
    workspace: { getConfiguration: () => ({ get: () => undefined }), onDidChangeConfiguration: () => ({ dispose() {} }), workspaceFolders: [] },
    commands: { registerCommand: () => ({ dispose() {} }) }, StatusBarAlignment: { Right: 2 }, ViewColumn: { Active: -1 }, env: { clipboard: {} } };
  const ol = Module._load; Module._load = function (r, ...a) { return r === 'vscode' ? vscode : ol.call(this, r, ...a); };
  return { ctx: { extensionUri: U(ext), globalState: { get: k => mem.get(k), update: (k, v) => { mem.set(k, v); return Promise.resolve(); } }, subscriptions: [] } };
}
function auditClaude(files, t0, t1) {   // 独立核算：JSON.parse 每条 usage 行，全局按 message.id 取最大值，按首次出现的时间戳归属
  const ids = new Map();
  for (const p of files) {
    let text; try { text = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
    const sub = p.includes(path.sep + 'subagents' + path.sep);
    for (const line of text.split('\n')) {
      if (line.indexOf('"usage"') < 0) continue;
      let o; try { o = JSON.parse(line); } catch (e) { continue; }
      const msg = o.type === 'assistant' ? o.message : o.type === 'progress' && o.data && o.data.message && o.data.message.type === 'assistant' ? o.data.message.message : null;
      const u = msg && msg.usage; o = null; if (!u) continue;
      const b = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0), c = u.cache_read_input_tokens || 0, n = b + 0.1 * c, x = b + c, ts = Date.parse(line.slice(line.lastIndexOf('"timestamp":"') + 13, line.lastIndexOf('"timestamp":"') + 50).split('"')[0]);
      const id = msg.id || p + ts, e = ids.get(id);
      if (!e) ids.set(id, { n, x, ts, sub }); else { if (x > e.x) { e.x = x; e.n = n; } if (ts < e.ts) e.ts = ts; if (sub) e.sub = true; }
    }
  }
  let total = 0, sub = 0, raw = 0, subRaw = 0;
  for (const e of ids.values()) if (e.ts >= t0 && e.ts <= t1) { total += e.n; raw += e.x; if (e.sub) { sub += e.n; subRaw += e.x; } }
  return { total, sub, raw, subRaw, ids };
}
async function live(secs) {
  console.log(`\n[实测] mock vscode 激活插件，跑 ${secs} 秒（期间照常用 Claude Code / Codex，子 agent 越多越好）`);
  const { ctx } = mockVscode(); const E = require(path.join(ext, 'extension.js'));
  const t0 = Date.now(); E.activate(ctx);
  const X = E._test; await new Promise(r => setTimeout(r, 300));
  const T = X.tracker, orig = T.onRecord; let subN = 0, subX = 0, frozen = false; const bySrc = {}, rawBy = {}, recs = [];
  T.onRecord = r => {
    if (!frozen) { if (r.file.includes('/subagents/')) { subN += r.n; subX += r.x; } bySrc[r.key] = (bySrc[r.key] || 0) + r.n; rawBy[r.key] = (rawBy[r.key] || 0) + r.x; }
    if (r.src && r.src.id === 'claude') recs.push({ ts: r.ts, n: r.n, x: r.x, late: frozen });
    orig(r);
  };
  await new Promise(r => setTimeout(r, secs * 1000));
  const t1 = Date.now(); X.tick(); frozen = true; const rate = X.meter.rawRate;
  // 日志里的时间戳是消息开始时刻，整行要等这一块输出完才写入。插件计数在 t1 冻结，
  // 再等一段时间让「时间戳 ≤ t1 但还没写完」的消息落盘后才核算；期间插件继续读，用来拆出两端的边界量。
  const grace = +arg('--grace', 60);
  console.log(`  （插件计数已在 t1 冻结，等 ${grace} 秒让窗口末尾的消息写完再核算）`);
  await new Promise(r => setTimeout(r, grace * 1000)); ctx.subscriptions.forEach(d => d.dispose && d.dispose());
  const B = recs.filter(e => !e.late && e.ts < t0), D = recs.filter(e => e.late && e.ts >= t0 && e.ts <= t1);
  const sumx = a => a.reduce((s, e) => s + e.x, 0), sumn = a => a.reduce((s, e) => s + e.n, 0);
  const claudeKeys = T.list().filter(s => s.kind === 'claude'), files = [...T.files.values()].filter(f => f.src.id === 'claude' && f.mt >= t0 - 120e3).map(f => f.p);
  const au = auditClaude(files, t0, t1), plug = claudeKeys.reduce((a, s) => a + (bySrc[s.key] || 0), 0), plugX = claudeKeys.reduce((a, s) => a + (rawBy[s.key] || 0), 0);
  const pc = (a, b) => b ? (a - b) / b * 100 : 0, diff = pc(plug, au.total), diffX = pc(plugX, au.raw), subFiles = [...T.files.keys()].filter(p => p.includes('/subagents/')).length;
  console.log(`  来源：${T.list().map(s => s.label).join('、')}`);
  console.log(`  监视文件 ${T.files.size} 个（其中子 agent ${subFiles} 个）；窗口 ${new Date(t0).toISOString()} → ${new Date(t1).toISOString()}`);
  console.log(`  raw 全量吞吐（Claude 合计）：插件 ${fmt(plugX)}    独立核算 ${fmt(au.raw)}    差异 ${diffX.toFixed(1)}%`);
  console.log(`  eq  算力当量（Claude 合计）：插件 ${fmt(plug)}    独立核算 ${fmt(au.total)}    差异 ${diff.toFixed(1)}%    raw/eq = ${(au.raw / Math.max(1, au.total)).toFixed(1)} 倍`);
  console.log(`  子 agent 占比（raw）：插件 ${fmt(subX)}（${plugX ? (100 * subX / plugX).toFixed(0) : 0}%）  核算 ${fmt(au.subRaw)}（${au.raw ? (100 * au.subRaw / au.raw).toFixed(0) : 0}%）`);
  console.log(`  全部来源本次累计（raw）：${Object.entries(rawBy).map(([k, v]) => k + ' ' + fmt(v)).join(' · ') || '无'}；结束时 10 秒速率 ${fmt(rate)}/s`);
  const cx = plugX - sumx(B) + sumx(D), cn = plug - sumn(B) + sumn(D);
  console.log(`  边界拆解（raw）：开头 ${fmt(sumx(B))}（启动后才写入、但时间戳早于 t0 的消息，插件计了、核算不计）；结尾 ${fmt(sumx(D))}（时间戳在窗口内、t1 之后才写完的，核算计了、插件不计）`);
  console.log(`  扣掉两端后：raw 插件 ${fmt(cx)} vs 核算 ${fmt(au.raw)}（${pc(cx, au.raw).toFixed(2)}%）；eq ${fmt(cn)} vs ${fmt(au.total)}（${pc(cn, au.total).toFixed(2)}%）`);
  if (au.total < 2000) console.log('  （这段时间几乎没有 token，结果没有统计意义；请在跑的时候用 Claude Code 干点活）');
  else {
    ok(Math.abs(diffX) <= 15, `raw 差异 ${diffX.toFixed(1)}% 在 ±15% 以内`);
    ok(Math.abs(diff) <= 15, `eq 差异 ${diff.toFixed(1)}% 在 ±15% 以内`);
    ok(Math.abs(pc(cx, au.raw)) <= 2 && Math.abs(pc(cn, au.total)) <= 2, '扣掉窗口两端的边界量后，两种口径都在 ±2% 以内（解析、去重、子 agent 归属都对得上）');
  }
  ok(subN > 0 || au.sub === 0, '子 agent 被计入');
}

// ---------- 履历回填：计时 + 抽 3 天核算 ----------
async function ledgerAudit() {
  console.log('\n[履历] 回填最近 400 天（只读本机日志，结果只在内存里）');
  const T = A.createTracker({ env: process.env, sys: A.systemInfo(process.env) }); await T.discover(true);
  const L = LG.createLedger({ load: () => null, save: () => {} });
  let lag = 0, last = Date.now(); const iv = setInterval(() => { const n = Date.now(); lag = Math.max(lag, n - last - 50); last = n; }, 50);
  const t0 = Date.now(), res = await L.backfill(A.scanHistory, T); clearInterval(iv);
  console.log(`  ${res.files} 个文件 ${(res.bytes / 1e9).toFixed(2)}GB，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s；期间事件循环最长卡顿 ${lag}ms；回填后进程内存 ${(process.memoryUsage().rss / 1e6).toFixed(0)}MB`);
  ok(lag < 500, `回填不卡 extension host（最长卡顿 ${lag}ms < 500ms）`);
  const files = [...T.files.values()].filter(f => f.src.id === 'claude').map(f => f.p);
  const au = auditClaude(files, 0, T.since), byDay = {};
  const byDayX = {};
  for (const e of au.ids.values()) if (e.ts > 0 && e.ts <= T.since) { const d = LG.dayKey(e.ts); byDay[d] = (byDay[d] || 0) + e.n; byDayX[d] = (byDayX[d] || 0) + e.x; }
  const days = Object.keys(byDay).filter(d => byDay[d] > 1e5 && d !== LG.dayKey(Date.now())).sort();
  const pick = []; while (pick.length < 3 && pick.length < days.length) { const d = days[Math.floor(Math.random() * days.length)]; if (!pick.includes(d)) pick.push(d); }
  for (const d of pick.sort()) {
    const day = L.state.days[d] || { s: {}, sx: {} }, cl = o => Object.entries(o || {}).filter(([k]) => k === 'claude' || k.startsWith('claude:')).reduce((a, [, v]) => a + v, 0);
    const mine = cl(day.s), mineX = cl(day.sx), e = (mine - byDay[d]) / byDay[d] * 100, ex = (mineX - byDayX[d]) / byDayX[d] * 100;
    ok(Math.abs(e) < 5 && Math.abs(ex) < 5, `${d}  raw 履历 ${fmt(mineX)} 核算 ${fmt(byDayX[d])} 误差 ${ex.toFixed(2)}%  |  eq 履历 ${fmt(mine)} 核算 ${fmt(byDay[d])} 误差 ${e.toFixed(2)}%`);
  }
  const msg = L.message(T.list());
  console.log(`  ledger 消息：${Object.keys(msg.days).length} 天、${Object.keys(msg.hours).length} 天小时曲线、${msg.windows.length} 个额度窗口、JSON ${(JSON.stringify(msg).length / 1024).toFixed(0)}KB`);
}

try {
  await unit();
  if (has('--ledger')) await ledgerAudit();
  if (!has('--unit')) await live(+arg('--seconds', 60));
} finally { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
console.log(fails ? `\n${fails} 项未通过` : '\n全部通过');
process.exit(fails ? 1 : 0);
