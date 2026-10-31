// 蛊码 GuCode · VS Code 插件。纯 JS、无构建、零依赖。
// 1) 在 extension host 里用 adapters.js 监听各家 AI 编程 CLI 的本机会话日志（Claude Code、Codex、Gemini、Qwen、Copilot、
//    Cline/Roo/Kilo、OpenCode、ZCode、Droid、Amp、Kimi、Aider…，多账号目录自动发现），只截取 usage 数字，不解析/保存/外发正文
// 2) 用 Webview 跑同一套游戏（media/gucode.js + style.css），postMessage 推送 token
// 3) 状态栏安静显示总速率和进度；绝不主动弹窗、不抢焦点
// 4) media/ 里的游戏文件更新后自动重载 Webview，不用重启 VS Code
//
// ── 推给 Webview 的消息（集成方照这个格式接）──
// 每秒一次：{ type: 'tokens', delta, hot, rate, idle, rawDelta, rawRate, bySource }
//   双口径：raw 全量吞吐 = 输入 + 输出 + 缓存写入 + 缓存读取（「灵流」大数字、日历、年度卡用它，和 ccusage 一致）；
//           eq 算力当量 = 缓存读取按 0.1 折算（只用于养蛊推进和 econ，不同工具之间公平）
//   delta / rate：这一秒新增 / 10 秒窗口均值，eq，游戏推进用；hot：rate ≥ 2000；idle：30 秒无新 token
//   rawDelta / rawRate：同上，raw，界面显示用
//   bySource：{ [srcKey]: { label, rate, total, rawRate, rawTotal } }   srcKey 如 'claude'、'claude:.claude-work'、'codex'、'bridge:laptop:claude'
//             label 是给人看的来源名（如「Claude（.claude-work）」）；rate/rawRate 为该来源 10 秒窗口 token/s；total/rawTotal 为本次启动以来累计
//             本机有日志的来源即使是 0 也会列出
// 启动时、Webview 就绪时、之后每 60 秒：{ type: 'ledger', v: 1, … }   格式见 ledger.js 文件头
// 设置：gucode.extraRoots（手动加目录）、gucode.bridgeFiles（其他机器的桥接文件）、gucode.weeklyReset、gucode.limits
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const A = require('./adapters');
const LG = require('./ledger');

const HOT_TH = 2000;       // 武火阈值：token/秒（10 秒窗口均值；与 src/tokens.js 一致）
const IDLE_MS = 30000;     // 停手判定：30 秒无新 token

let ctx, statusItem, sideView = null, panel = null, ready = false, queue = [];
let latestSave, latestStatus, saveDirty = false, mediaVer = 0;
let tracker, ledger, bridgeRead, disposed = false, today = { d: '', n: 0, x: 0 }, todayDirty = false;
const meter = A.createMeter(10000);
const W = { pending: 0, pendingHot: 0, get total() { return meter.total; }, get rate() { return meter.rate; }, get rawTotal() { return meter.rawTotal; },
  get src() { const o = {}; for (const [k, s] of meter.by) o[k] = s.total; return o; } };

// ---------- 设置 ----------
function cfg(k, d) {
  try { const c = vscode.workspace && vscode.workspace.getConfiguration && vscode.workspace.getConfiguration('gucode'); const v = c && c.get(k); return v == null ? d : v; }
  catch (e) { return d; }
}
const expand = p => String(p || '').replace(/^~(?=$|[\\/])/, os.homedir());
const extraRoots = () => (cfg('extraRoots', []) || []).filter(x => x && x.path && x.adapter).map(x => ({ path: expand(x.path), adapter: String(x.adapter), label: x.label ? String(x.label) : '' }));
const bridgeFiles = () => (cfg('bridgeFiles', []) || []).map(expand).filter(Boolean);

// ---------- token 监听 ----------
function addToday(n, x) {
  const dk = LG.dayKey(Date.now()); if (today.d !== dk) today = { d: dk, n: 0, x: 0 };
  today.n += n; today.x += x; todayDirty = true;
}
function onRecord(r) {
  if (r.n > 0 || r.x > 0) { meter.add(r.key, r.label, r.n, r.x); addToday(r.n, r.x); }
  r.live = true; if (ledger) ledger.add(r);
}
async function discover(boot) {
  await tracker.discover(boot);
  for (const s of tracker.list()) meter.ensure(s.key, s.label);
}
function tick() {
  tracker.tick(); bridgeRead(bridgeFiles());
  const now = Date.now(), r = meter.step(now);
  const idle = !meter.lastAt || now - meter.lastAt > IDLE_MS, hot = r.rate >= HOT_TH, d = r.delta;
  const host = activeHost();
  if (host && ready) host.webview.postMessage({ type: 'tokens', delta: d, hot, rate: r.rate, idle, rawDelta: r.rawDelta, rawRate: r.rawRate, bySource: r.bySource });
  else if (d > 0) { W.pending += d; if (hot) W.pendingHot += d; }
  updateStatus();
}
function ledgerMsg() {
  for (const s of tracker.sources.values()) if (s.shared.rl) ledger.setRateLimits(s.key, s.shared.rl);
  return ledger.message(tracker.list());
}
function pushLedger() { const h = activeHost(); if (h && ready && ledger) h.webview.postMessage(ledgerMsg()); }

// ---------- 状态栏 ----------
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n));
function updateStatus() {
  const st = latestStatus;
  let text;
  if (!st || !st.started) text = '$(bug) 蛊码';
  else {
    const pct = st.node && st.cost ? Math.min(99, Math.floor(100 * (st.prog + (ready ? 0 : W.pending)) / st.cost)) + '%' : '待择路';
    text = meter.rawRate > 0 ? `$(bug) ${fmt(meter.rawRate)}/s · ${pct}` : `$(bug) 静 · ${pct}`;
  }
  statusItem.text = text;
  const rows = [...meter.by.values()].sort((a, b) => b.rawRate - a.rawRate || b.rawTotal - a.rawTotal).map(s => `${s.label} ${fmt(s.rawRate)}/s · 本次 ${fmt(s.rawTotal)}`);
  const lb = ledger && !ledger.ready ? '\n算力履历回填中…' : '';
  statusItem.tooltip = `蛊码 GuCode\n灵流 ${fmt(meter.rawRate)}/s · 本次启动 ${fmt(meter.rawTotal)} · 今日累计 ${fmt(today.x)}\n  全量吞吐：输入 + 输出 + 缓存写入 + 缓存读取，和 ccusage 等工具同口径\n算力当量 ${fmt(meter.rate)}/s · 本次启动 ${fmt(meter.total)} · 今日累计 ${fmt(today.n)}\n  缓存读取按 0.1 折算（参照 API 价格），只用于养蛊推进\n各来源（全量吞吐速率 · 本次累计）\n${rows.join('\n') || '还没发现 AI 编程工具的会话日志'}${lb}\n只读会话里的 usage 数字，不读内容\n点击打开空窍`;
}

// ---------- Webview ----------
const activeHost = () => panel || sideView;
function gameHtml(wv) {
  const m = f => wv.asWebviewUri(vscode.Uri.joinPath(ctx.extensionUri, 'media', f)).with({ query: 'v=' + mediaVer });
  const csp = `default-src 'none'; img-src ${wv.cspSource} data: blob:; style-src ${wv.cspSource} 'unsafe-inline'; script-src ${wv.cspSource}; font-src ${wv.cspSource};`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${m('style.css')}"><style>body{padding:0}</style></head><body class="vsc"><div id="app"></div><script src="${m('gucode.js')}"></script></body></html>`;
}
function parkedHtml(wv) {
  const csp = `default-src 'none'; style-src 'unsafe-inline';`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>body{background:#15130f;color:#8f8775;font:14px "Kaiti SC","STKaiti",serif;padding:24px 16px}</style></head><body>空窍已在编辑区打开。<br>关掉那个标签页，这里会接着养。</body></html>`;
}
function bindHost(wv) {
  wv.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(ctx.extensionUri, 'media')] };
  wv.onDidReceiveMessage(m => onMsg(m, wv));
}
function loadGame(host) { ready = false; host.webview.html = gameHtml(host.webview); }
function onMsg(m, wv) {
  const host = activeHost(); if (!host || host.webview !== wv) return;
  if (m.type === 'ready') {
    ready = true;
    wv.postMessage({ type: 'init', save: latestSave || ctx.globalState.get('gucode.save') || null, pending: { tokens: W.pending, hot: W.pendingHot } });
    W.pending = 0; W.pendingHot = 0; ctx.globalState.update('gucode.pending', null);
    const q = queue; queue = []; q.forEach(f => f());
    pushLedger();
  } else if (m.type === 'save') { latestSave = m.data; latestStatus = m.status; saveDirty = true; }
  else if (m.type === 'copy') { vscode.env.clipboard.writeText(String(m.text || '')); vscode.window.setStatusBarMessage('$(check) 已复制', 2000); }
  else if (m.type === 'savePng') savePng(m.data);
}
async function savePng(dataUrl) {
  const uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(path.join(os.homedir(), 'Downloads', 'gucode-card.png')), filters: { PNG: ['png'] } });
  if (!uri) return;
  await vscode.workspace.fs.writeFile(uri, Buffer.from(String(dataUrl).split(',')[1] || '', 'base64'));
  vscode.window.setStatusBarMessage('$(check) 分享卡已保存：' + uri.fsPath, 4000);
}
function flush() {
  if (saveDirty && latestSave) { ctx.globalState.update('gucode.save', latestSave); ctx.globalState.update('gucode.status', latestStatus); saveDirty = false; }
  if (!ready && W.pending > 0) ctx.globalState.update('gucode.pending', { tokens: W.pending, hot: W.pendingHot });
  if (todayDirty) { ctx.globalState.update('gucode.today', today); todayDirty = false; }
}
function openPanel() {
  if (panel) { panel.reveal(); return; }
  flush();
  panel = vscode.window.createWebviewPanel('gucode.panel', '蛊码 · 空窍', vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(ctx.extensionUri, 'media')] });
  panel.iconPath = vscode.Uri.joinPath(ctx.extensionUri, 'media', 'icon.svg');
  panel.webview.onDidReceiveMessage(m => onMsg(m, panel && panel.webview));
  if (sideView) sideView.webview.html = parkedHtml(sideView.webview);
  loadGame(panel);
  panel.onDidDispose(() => { panel = null; ready = false; flush(); if (sideView) loadGame(sideView); });
}
// 热更新：游戏文件变了就重载当前 Webview。存档一直同步在 latestSave 里，重载后原样恢复
function watchMedia() {
  let t = null;
  const bump = () => { clearTimeout(t); t = setTimeout(() => {
    mediaVer = Date.now(); flush();
    const h = activeHost(); if (h) { loadGame(h); vscode.window.setStatusBarMessage('$(sync) 蛊码已更新', 3000); }
  }, 800); };
  for (const f of ['gucode.js', 'style.css']) {
    const p = path.join(ctx.extensionUri.fsPath, 'media', f);
    try { mediaVer = Math.max(mediaVer, Math.floor(fs.statSync(p).mtimeMs)); } catch (e) {}
    fs.watchFile(p, { interval: 2000 }, (a, b) => { if (a.mtimeMs !== b.mtimeMs && a.mtimeMs) bump(); });
    ctx.subscriptions.push({ dispose: () => fs.unwatchFile(p) });
  }
}
function whenReady(f) { if (ready && activeHost()) f(); else queue.push(f); }

function activate(context) {
  ctx = context;
  latestSave = ctx.globalState.get('gucode.save'); latestStatus = ctx.globalState.get('gucode.status');
  // v2 玩法不读旧存档：第一次遇到旧版本（v 不是 3）时原样备份到 gucode.save.bak-v2，再清空，游戏从零开始
  if (latestSave && latestSave.v !== 3) { if (!ctx.globalState.get('gucode.save.bak-v2')) ctx.globalState.update('gucode.save.bak-v2', latestSave); latestSave = null; ctx.globalState.update('gucode.save', null); ctx.globalState.update('gucode.status', null); latestStatus = null; }
  const pend = ctx.globalState.get('gucode.pending'); if (pend) { W.pending = pend.tokens || 0; W.pendingHot = pend.hot || 0; }
  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
  statusItem.command = 'gucode.open'; statusItem.text = '$(bug) 蛊码'; statusItem.show();
  context.subscriptions.push(statusItem);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('gucode.view', {
    resolveWebviewView(v) {
      sideView = v; bindHost(v.webview);
      if (panel) v.webview.html = parkedHtml(v.webview); else loadGame(v);
      v.onDidDispose(() => { if (sideView === v) { sideView = null; if (!panel) ready = false; } });
    },
  }, { webviewOptions: { retainContextWhenHidden: true } }));
  context.subscriptions.push(
    vscode.commands.registerCommand('gucode.open', openPanel),
    vscode.commands.registerCommand('gucode.duel', async () => {
      const code = await vscode.window.showInputBox({ prompt: '粘贴界壁坐标码或战帖链接', placeHolder: '坐标码', ignoreFocusOut: true });
      if (!code) return; openPanel(); whenReady(() => activeHost().webview.postMessage({ type: 'duel', code: code.trim() }));
    }),
    vscode.commands.registerCommand('gucode.share', () => { openPanel(); whenReady(() => activeHost().webview.postMessage({ type: 'share' })); }),
  );
  watchMedia();
  startTokens(context);
}
function startTokens(context) {
  const t = ctx.globalState.get('gucode.today'); if (t && t.d === LG.dayKey(Date.now())) today = { d: t.d, n: +t.n || 0, x: +t.x || 0 };
  const ws = ((vscode.workspace && vscode.workspace.workspaceFolders) || []).map(f => f.uri && f.uri.fsPath).filter(Boolean);
  const gs = ctx.globalStorageUri && ctx.globalStorageUri.fsPath ? [{ dir: path.dirname(ctx.globalStorageUri.fsPath), tag: '' }] : [];
  tracker = A.createTracker({ env: process.env, sys: A.systemInfo(process.env, { workspace: ws, editorStorage: gs }), extra: extraRoots(), onRecord });
  bridgeRead = A.createBridgeReader(onRecord, os.hostname().replace(/\.local$/, ''));
  ledger = LG.createLedger({
    load: () => ctx.globalState.get('gucode.ledger'),
    save: s => ctx.globalState.update('gucode.ledger', s),
    settings: () => ({ weeklyReset: cfg('weeklyReset', ''), limits: cfg('limits', {}) || {} }),
  });
  const boot = discover(true);
  // 历史回填放后台：等 8 秒让 VS Code 先启动完，分批读、每 4MB 让出一次事件循环
  const t0 = setTimeout(() => boot.then(() => ledger.backfill(A.scanHistory, tracker, { cancelled: () => disposed }))
    .then(() => { pushLedger(); updateStatus(); }).catch(() => {}), 8000);
  const t1 = setInterval(tick, 1000), t2 = setInterval(() => discover(false), 10000), t3 = setInterval(flush, 5000);
  const t4 = setInterval(() => { pushLedger(); ledger.persist(); }, 60000);
  if (vscode.workspace && vscode.workspace.onDidChangeConfiguration) context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('gucode.extraRoots')) { tracker.build(extraRoots()); discover(false); }
    if (e.affectsConfiguration('gucode.weeklyReset') || e.affectsConfiguration('gucode.limits')) pushLedger();
  }));
  context.subscriptions.push({ dispose: () => { disposed = true; clearTimeout(t0); [t1, t2, t3, t4].forEach(clearInterval); flush(); ledger.persist(); } });
}
function deactivate() { try { flush(); if (ledger) ledger.persist(); } catch (e) {} }
module.exports = { activate, deactivate, _test: { W, meter, get tracker() { return tracker; }, get ledger() { return ledger; }, get files() { return tracker.files; }, tick, ledgerMsg } };
