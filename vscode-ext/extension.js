// 蛊码 GuCode · VS Code 插件。纯 JS、无构建。
// 1) 在 extension host 里监听 ~/.claude/projects/**/*.jsonl 与 ~/.codex/sessions/**/*.jsonl 的 usage 数字（正则只取数字，不解析/保存/外发正文）
// 2) 用 Webview 跑同一套游戏（media/gucode.js + style.css），postMessage 推送 token
// 3) 状态栏安静显示进度；绝不主动弹窗、不抢焦点
// 4) media/ 里的游戏文件更新后自动重载 Webview，不用重启 VS Code
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOT_TH = 2000;       // 武火阈值：token/秒（10 秒窗口均值；与 src/tokens.js 一致）
const IDLE_MS = 30000;     // 停手判定：30 秒无新 token
const ROOTS = [[path.join(os.homedir(), '.claude', 'projects'), 'claude'], [path.join(os.homedir(), '.codex', 'sessions'), 'codex']];

let ctx, statusItem, sideView = null, panel = null, ready = false, queue = [];
let latestSave, latestStatus, saveDirty = false, mediaVer = 0;
const W = { total: 0, win: [], lastAt: 0, delta: 0, hotDelta: 0, pending: 0, pendingHot: 0, src: { claude: 0, codex: 0 }, rate: 0 };
const files = new Map(), seen = new Map();

// ---------- token 监听 ----------
async function walk(dir, src, depth, boot) {
  let ents; try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (depth < 6) await walk(p, src, depth + 1, boot); continue; }
    if (!e.name.endsWith('.jsonl')) continue;
    let st; try { st = await fs.promises.stat(p); } catch (er) { continue; }
    const f = files.get(p);
    if (!f) files.set(p, { off: boot ? st.size : 0, src, mt: st.mtimeMs });
    else f.mt = st.mtimeMs;
  }
}
let walking = false;
async function walkAll(boot) { if (walking) return; walking = true; try { for (const [d, s] of ROOTS) await walk(d, s, 0, boot); } finally { walking = false; } }
const num = (s, k) => { const m = s.match(new RegExp('"' + k + '":(\\d+)')); return m ? +m[1] : 0; };
function add(n, src) { if (n <= 0) return; W.total += n; W.src[src] += n; W.win.push([Date.now(), n]); W.lastAt = Date.now(); W.delta += n; }
function parseLine(line, src) {
  if (src === 'claude') {
    const i = line.indexOf('"usage":{'); if (i < 0 || line.indexOf('"type":"assistant"') < 0) return;
    const u = line.slice(i, i + 700);
    const n = num(u, 'input_tokens') + num(u, 'output_tokens') + num(u, 'cache_creation_input_tokens');
    const m = line.match(/"id":"(msg_[A-Za-z0-9_-]+)"/);
    if (m) { const prev = seen.get(m[1]) || 0; if (n <= prev) return; seen.set(m[1], n); if (seen.size > 8000) seen.delete(seen.keys().next().value); add(n - prev, src); }
    else add(n, src);
  } else {
    const i = line.indexOf('"last_token_usage":{'); if (i < 0) return;
    const u = line.slice(i, i + 400);
    add(Math.max(0, num(u, 'input_tokens') - num(u, 'cached_input_tokens')) + num(u, 'output_tokens'), src);
  }
}
function readNew(p, f) {
  let st; try { st = fs.statSync(p); } catch (e) { return; }
  f.mt = st.mtimeMs; if (st.size < f.off) f.off = st.size; if (st.size === f.off) return;
  const len = Math.min(st.size - f.off, 16 << 20), buf = Buffer.alloc(len);
  let fd; try { fd = fs.openSync(p, 'r'); fs.readSync(fd, buf, 0, len, f.off); } catch (e) { return; } finally { if (fd != null) fs.closeSync(fd); }
  const end = buf.lastIndexOf(10); if (end < 0) return;
  f.off += end + 1;
  const s = buf.toString('utf8', 0, end);
  for (const line of s.split('\n')) parseLine(line, f.src);
}
function tick() {
  const now = Date.now();
  for (const [p, f] of files) if (now - f.mt < 6 * 3600e3) readNew(p, f);
  while (W.win.length && W.win[0][0] < now - 10000) W.win.shift();
  W.rate = W.win.reduce((a, b) => a + b[1], 0) / 10;
  const idle = !W.lastAt || now - W.lastAt > IDLE_MS, hot = W.rate >= HOT_TH, d = W.delta; W.delta = 0;
  const host = activeHost();
  if (host && ready) host.webview.postMessage({ type: 'tokens', delta: d, hot, rate: W.rate, idle });
  else if (d > 0) { W.pending += d; if (hot) W.pendingHot += d; }
  updateStatus(hot, idle);
}

// ---------- 状态栏 ----------
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n));
function updateStatus(hot, idle) {
  const st = latestStatus;
  let text;
  if (!st || !st.started) text = '$(bug) 蛊码';
  else {   // 只显示养蛊状态；斗蛊随时可开，不随空闲切换
    const pct = st.node && st.cost ? Math.min(99, Math.floor(100 * (st.prog + (ready ? 0 : W.pending)) / st.cost)) + '%' : '待择路';
    text = idle ? `$(bug) 蛊码 · ${pct}` : `$(bug) 养蛊中 · ${hot ? '武火' : '文火'} ${pct}`;
  }
  statusItem.text = text;
  statusItem.tooltip = `蛊码 GuCode\n灵流 ${fmt(W.rate)}/s · 本次启动累计 ${fmt(W.total)} token\nClaude ${fmt(W.src.claude)} · Codex ${fmt(W.src.codex)}\n只读会话里的 usage 数字，不读内容\n点击打开空窍`;
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
  walkAll(true);
  const t1 = setInterval(tick, 1000), t2 = setInterval(() => walkAll(false), 10000), t3 = setInterval(flush, 5000);
  context.subscriptions.push({ dispose: () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); flush(); } });
}
function deactivate() { try { flush(); } catch (e) {} }
module.exports = { activate, deactivate, _test: { parseLine, W, readNew, walkAll, files } };
