// 蛊码 GuCode · 算力履历（按天/小时/来源/模型/工具的 token 汇总 + 额度窗口）。纯 JS、零依赖，插件和 tools/gu-bridge.mjs 共用。
// 记录来自 adapters.js：实时引擎的增量 + scanHistory 的历史回填。只记数字、模型名、工具名，不记任何内容。
//
// ── 推给 Webview 的消息（契约，字段名不改）──
// { type: 'ledger', v: 1,
//   days:    { 'YYYY-MM-DD': { t, x, s: { [srcKey]: n }, m: { [modelFamily]: n }, sx: { [srcKey]: n }, mx: { [modelFamily]: n } } },
//            // 最多 400 天，本地日期。t / s / m 是 eq 算力当量；x / sx / mx 是 raw 全量吞吐（日历、年度卡用 x）
//   hours:   { 'YYYY-MM-DD': [24 个数] },                                            // 最近 14 天，本地时区，raw
//   sources: { [srcKey]: { label, kind, account } },                                // kind = 适配器 id；account = 目录标记，默认 'default'
//   windows: [ { key, label, kind: '5h'|'week', used, usedEq, pct: number|null, resetsAt: ms|null, start: ms, basis: 'log'|'estimate' } ],
//            // used = raw，usedEq = eq
//   tools:   { 'YYYY-MM-DD': { edit, bash, read, web, task, other } },
//   agents:  { active, peakToday },                                                  // active = 最近 2 分钟有新记录的会话文件数（含子 agent）
//   generatedAt }
// modelFamily：claude-opus / claude-sonnet / claude-haiku / gpt / glm / gemini / qwen / other
// 双口径：raw 全量吞吐 = 输入 + 输出 + 缓存写入 + 缓存读取；eq 算力当量 = 缓存读取按 0.1 折算（见 adapters.js 文件头）
//
// ── 额度窗口 ──
//   Codex：会话日志里的 rate_limits（primary≈5 小时、secondary≈每周，used_percent + resets_at），basis 'log'。
//   Claude：没有百分比。5 小时按 ccusage 的分块法估算：窗口从块内第一条消息所在整点（UTC 取整）起算 5 小时，
//           距块起点满 5 小时后的第一条消息开新块；basis 'estimate'，pct 只有在 gucode.limits.claude5h 填了上限时才算。
//   每周：gucode.weeklyReset（如 "Thu 08:00"，本地时间）给出固定重置点；不填则滚动 7 天（resetsAt 为 null）。
//
// ── 持久化 ──
//   state = { v: 2, until, days, hours, tools, mins: { key: { 分钟: [raw, eq] } }, snap: { 文件: [eq, 时刻, raw] }, rl, peak } 存在 globalState（桥接模式存 ~/.gucode/ledger.json）。
//   until：时间戳不晚于它的记录都已计入；下次启动只回填 (until, 本次启动] 的部分。回填没跑完之前不落盘，
//   中途关掉 VS Code 的话下次从旧 until 重来，不会重复计。
'use strict';
const DAY = 864e5, H5 = 5 * 3600e3, WEEK = 7 * DAY;
const pad = n => (n < 10 ? '0' : '') + n;
const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

function modelFamily(model, srcId) {
  const m = String(model || '').toLowerCase();
  if (m.includes('opus')) return 'claude-opus';
  if (m.includes('sonnet')) return 'claude-sonnet';
  if (m.includes('haiku')) return 'claude-haiku';
  if (/glm|zhipu|chatglm|z-ai|zai/.test(m)) return 'glm';
  if (/gemini|gemma/.test(m)) return 'gemini';
  if (/qwen|qwq/.test(m)) return 'qwen';
  if (/gpt|codex|openai|^o\d/.test(m)) return 'gpt';
  if (!m) return { codex: 'gpt', gemini: 'gemini', qwen: 'qwen', zcode: 'glm' }[srcId] || 'other';
  return 'other';
}
const TOOLCAT = {};
for (const [cat, names] of Object.entries({
  edit: 'edit write multiedit notebookedit apply_patch write_file replace edit_file create_file str_replace_based_edit_tool',
  bash: 'bash shell exec_command local_shell run_shell_command write_stdin bashoutput killshell killbash powershell',
  read: 'read grep glob ls read_file read_many_files list_directory list_dir search_file_content view_image',
  web: 'websearch webfetch web_search web_fetch google_web_search',
  task: 'task agent',
})) for (const n of names.split(' ')) TOOLCAT[n] = cat;
const toolCat = name => TOOLCAT[String(name || '').toLowerCase()] || 'other';

// 5 小时分块（ccusage 做法）：mins 为 [[分钟序号, raw, eq], …] 升序
function block5h(mins, now) {
  let cur = null;
  for (const [m, x, n] of mins) {
    const t = m * 60000;
    if (!cur || t >= cur.start + H5) cur = { start: Math.floor(t / 3600e3) * 3600e3, used: 0, usedEq: 0 };
    cur.used += x; cur.usedEq += n == null ? x : n;
  }
  return cur && now < cur.start + H5 ? { start: cur.start, resetsAt: cur.start + H5, used: cur.used, usedEq: cur.usedEq } : null;
}
// "Thu 08:00" → 最近一次（≤ now）的本地重置时刻；无效或为空时返回 null（滚动 7 天）
function weeklyStart(spec, now) {
  const m = /^\s*(sun|mon|tue|wed|thu|fri|sat)[a-z]*\s+(\d{1,2}):(\d{2})\s*$/i.exec(String(spec || ''));
  if (!m) return null;
  const dow = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(m[1].toLowerCase().slice(0, 3));
  const d = new Date(now); d.setHours(+m[2], +m[3], 0, 0);
  d.setDate(d.getDate() - ((d.getDay() - dow + 7) % 7));
  if (d.getTime() > now) d.setDate(d.getDate() - 7);
  return d.getTime();
}

function createLedger(o) {
  // o: { load() => state|null, save(state), settings() => { weeklyReset, limits }, now? }
  const now = () => (o.now ? o.now() : Date.now());
  const fresh = () => ({ v: 2, until: 0, days: {}, hours: {}, tools: {}, mins: {}, snap: {}, rl: {}, peak: { d: '', n: 0 } });
  let S = o.load && o.load(); if (!S || S.v !== 2) S = fresh();
  for (const k of Object.keys(fresh())) if (S[k] == null) S[k] = fresh()[k];
  const snapBase = Object.assign({}, S.snap), snapHist = {}, snapLive = {};
  const active = new Map(), meta = new Map();
  const L = { state: S, ready: false, stats: null };

  L.add = function (r) {
    if (!r) return;
    let n = r.n || 0, x = r.x == null ? n : r.x;
    if (r.snap != null) {   // 快照文件的历史累计：减去上次落盘时已计入的部分
      const sx = r.snapX == null ? r.snap : r.snapX, b = snapBase[r.file] || [0, 0, 0];
      snapHist[r.file] = [r.snap, sx]; n = Math.max(0, r.snap - (b[0] || 0)); x = Math.max(0, sx - (b[2] == null ? b[0] || 0 : b[2]));
    } else if (r.kind === 'json') { const l = snapLive[r.file] || (snapLive[r.file] = [0, 0]); l[0] += n; l[1] += x; }
    if (r.src) meta.set(r.key, { label: r.label, kind: r.src.id, account: r.src.tag || 'default' });
    else if (!meta.has(r.key)) meta.set(r.key, { label: r.label || r.key, kind: r.bridge ? 'bridge' : r.key.split(':')[0], account: 'default' });
    const ts = r.ts || now(), dk = dayKey(ts);
    if (n > 0 || x > 0) {
      const d = S.days[dk] || (S.days[dk] = { t: 0, x: 0, s: {}, m: {}, sx: {}, mx: {} });
      d.t += n; d.x += x; d.s[r.key] = (d.s[r.key] || 0) + n; d.sx[r.key] = (d.sx[r.key] || 0) + x;
      const fam = modelFamily(r.model, r.src && r.src.id); d.m[fam] = (d.m[fam] || 0) + n; d.mx[fam] = (d.mx[fam] || 0) + x;
      if (now() - ts < 15 * DAY) { const h = S.hours[dk] || (S.hours[dk] = new Array(24).fill(0)); h[new Date(ts).getHours()] += x; }
      if (now() - ts < 8 * DAY) { const mk = Math.floor(ts / 60000), mm = S.mins[r.key] || (S.mins[r.key] = {}), e = mm[mk] || (mm[mk] = [0, 0]); e[0] += x; e[1] += n; }
    }
    if (r.tools && r.tools.length) {
      const t = S.tools[dk] || (S.tools[dk] = { edit: 0, bash: 0, read: 0, web: 0, task: 0, other: 0 });
      for (const name of r.tools) t[toolCat(name)]++;
    }
    if (r.live && r.file) active.set(r.file, now());
  };
  L.setRateLimits = function (key, rl) { if (rl && (!S.rl[key] || rl.at >= S.rl[key].at)) S.rl[key] = rl; };

  function prune() {
    const t = now(), keys = o => Object.keys(o).sort();
    const cut = (obj, days) => { const lim = dayKey(t - days * DAY); for (const k of keys(obj)) if (k < lim) delete obj[k]; };
    cut(S.days, 400); cut(S.tools, 400); cut(S.hours, 14);
    const mcut = Math.floor((t - 8 * DAY) / 60000);
    for (const m of Object.values(S.mins)) for (const k of Object.keys(m)) if (+k < mcut) delete m[k];
    const snap = {};
    for (const f of new Set([...Object.keys(snapBase), ...Object.keys(snapHist), ...Object.keys(snapLive)])) {
      const b = snapBase[f] || [0, 0, 0], h = snapHist[f] || [b[0] || 0, b[2] == null ? b[0] || 0 : b[2]], l = snapLive[f] || [0, 0];
      const last = snapLive[f] || snapHist[f] ? t : b[1] || 0;
      if (t - last < 60 * DAY) snap[f] = [h[0] + l[0], last, h[1] + l[1]];
    }
    S.snap = snap;
  }
  const minsOf = key => Object.entries(S.mins[key] || {}).map(([k, v]) => [+k, v[0], v[1]]).sort((a, b) => a[0] - b[0]);
  const sumSince = (key, from) => { let x = 0, n = 0; const f = Math.floor(from / 60000); for (const [k, v] of Object.entries(S.mins[key] || {})) if (+k >= f) { x += v[0]; n += v[1]; } return [x, n]; };

  L.windows = function (sources, t) {
    t = t || now(); const set = (o.settings && o.settings()) || {}, lim = set.limits || {}, out = [];
    const wk = weeklyStart(set.weeklyReset, t);
    for (const [key, s] of Object.entries(sources)) {
      if (s.kind === 'codex') {
        const rl = S.rl[key]; if (!rl) continue;
        for (const [slot, w] of [['primary', rl.primary], ['secondary', rl.secondary]]) {
          if (!w) continue;
          const kind = w.win ? (w.win <= 360 ? '5h' : 'week') : slot === 'primary' ? '5h' : 'week';
          const span = (w.win || (kind === '5h' ? 300 : 10080)) * 60000, expired = w.reset && w.reset <= t;
          const start = expired ? t : w.reset ? w.reset - span : t - span;
          const [used, usedEq] = sumSince(key, start);
          out.push({ key: key + ':' + kind, label: s.label + (kind === '5h' ? ' 5 小时' : ' 每周'), kind, used, usedEq, pct: expired ? 0 : w.pct, resetsAt: expired ? null : w.reset, start, basis: 'log' });
        }
      } else if (s.kind === 'claude') {
        const b = block5h(minsOf(key), t);
        out.push({ key: key + ':5h', label: s.label + ' 5 小时', kind: '5h', used: b ? b.used : 0, usedEq: b ? Math.round(b.usedEq) : 0, pct: lim.claude5h && b ? Math.min(999, 100 * b.used / lim.claude5h) : lim.claude5h ? 0 : null,
          resetsAt: b ? b.resetsAt : null, start: b ? b.start : t, basis: 'estimate' });
        const start = wk != null ? wk : t - WEEK, [used, usedEq] = sumSince(key, start);
        out.push({ key: key + ':week', label: s.label + ' 每周', kind: 'week', used, usedEq, pct: lim.claudeWeek ? Math.min(999, 100 * used / lim.claudeWeek) : null,
          resetsAt: wk != null ? wk + WEEK : null, start, basis: 'estimate' });
      }
    }
    return out;
  };

  L.agents = function (t) {
    t = t || now(); let a = 0;
    for (const [f, ts] of active) { if (t - ts < 120e3) a++; else if (t - ts > 600e3) active.delete(f); }
    const dk = dayKey(t); if (S.peak.d !== dk) S.peak = { d: dk, n: 0 }; if (a > S.peak.n) S.peak.n = a;
    return { active: a, peakToday: S.peak.n };
  };

  L.message = function (srcList) {
    const t = now(), sources = {};
    for (const [k, m] of meta) sources[k] = m;
    for (const s of srcList || []) sources[s.key] = { label: s.label, kind: s.kind, account: s.account };
    for (const k of Object.keys(S.rl)) if (!sources[k]) delete S.rl[k];
    const agents = L.agents(t);
    prune();
    return { type: 'ledger', v: 1, days: S.days, hours: S.hours, sources, windows: L.windows(sources, t), tools: S.tools, agents, generatedAt: t };
  };

  // 后台回填：scanHistory 分批读，读完才把 until 推进并落盘
  L.backfill = async function (scan, tracker, opt) {
    opt = opt || {};
    const before = tracker.since, after = Math.max(S.until || 0, before - 400 * DAY);
    const res = await scan(tracker, { after, before, onRecord: r => L.add(r), cancelled: opt.cancelled, onProgress: opt.onProgress });
    for (const s of tracker.sources.values()) if (s.shared.rl) L.setRateLimits(s.key, s.shared.rl);
    if (res.shared) for (const [k, sh] of res.shared) if (sh.rl) L.setRateLimits(k, sh.rl);
    L.ready = !(opt.cancelled && opt.cancelled()); L.stats = res;
    if (L.ready) L.persist();
    return res;
  };
  L.persist = function (until) {
    if (!L.ready) return false;
    prune(); S.until = Math.max(S.until || 0, until || now());
    if (o.save) o.save(S);
    return true;
  };
  return L;
}

module.exports = { createLedger, modelFamily, toolCat, block5h, weeklyStart, dayKey };
