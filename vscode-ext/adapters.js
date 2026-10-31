// 蛊码 GuCode · 用量适配器 + 读取引擎。纯 JS、零依赖；插件（extension.js）、算力履历（ledger.js）和 tools/gu-bridge.mjs 共用。
//
// ── 双口径（每条记录同时给出两个数）──
//   x  raw 全量吞吐 = 输入 + 输出（含推理）+ 缓存写入 + 缓存读取。和 ccusage 等工具一致；「灵流」大数字、日历、年度卡用它。
//   n  eq  算力当量 = 输入 + 输出（含推理）+ 缓存写入 + 0.1 × 缓存读取。0.1 取自 API 读缓存价格比例；只用于养蛊推进和 econ，
//      这样大量复读上下文的工具和不带缓存的工具能公平比较。没有缓存字段的工具 raw = eq。
//   各家字段换算写在每个适配器的 note 里；docs/adapters.md 有支持矩阵。
//
// ── 适配器形状（新增一个 CLI = 往 ADAPTERS 里加一个对象）──
//   { id, label, note,
//     kind: 'jsonl' | 'json' | 'md' | 'sqlite'，或 (path) => kind,
//     depth?: 目录递归深度（默认 6）,  needles?: 历史回填时只解析含这些关键字的行（提速、省内存）,
//     roots(env, sys) => [{ dir, tag }]   tag 为 '' 表示默认目录；非空时来源名显示为「Claude（.claude-work）」
//     match(path) => bool                  path 已统一成 / 分隔
//     parse(input, st) => number | { n, x?, ts?, model?, tools? } | null | 数组(sqlite) }   n = eq，x = raw（省略时 x = n）
//   jsonl / md：input 是一行文本（按字节偏移增量读）；返回这一行新增的 token。
//   json：      input 是整个文件文本（文件会被整体重写）；返回该文件的累计 token，引擎负责做差。
//   sqlite：    input 是只读打开的 node:sqlite 连接；返回 [{ id, n, x, ts, model, tools }]，st.from/st.to 是时间范围（ms），引擎按 id 做差。
//   st：每个文件一份 { shared（同一来源共享，放去重表）, prime（启动预读：只记状态、不计数）, history（回填模式）, model }
//
// ── 隐私 ──
//   只用 indexOf / 正则截取数字字段、模型名、工具名；不 JSON.parse 会话正文，不保存任何文本，不联网。
//   sqlite 用 json_extract 只取数字列，连接用完即关。
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------- 小工具 ----------
const RX = new Map();
const rx = (k, tail) => { const key = k + tail; let r = RX.get(key); if (!r) RX.set(key, r = new RegExp('"' + k + '"\\s*:\\s*' + tail)); return r; };
const num = (s, k) => { const m = rx(k, '(\\d+)').exec(s); return m ? +m[1] : 0; };
const numF = (s, k) => { const m = rx(k, '(-?\\d+(?:\\.\\d+)?)').exec(s); return m ? +m[1] : null; };
// V8 的正则子串会引用整块读入的文本（几 MB），存进 Map 前要拷贝成独立字符串，否则整块文本无法回收
const own = s => (s.length < 13 ? s : JSON.parse(JSON.stringify(s)));
const str = (s, k) => { const m = rx(k, '"([^"\\\\]{1,100})"').exec(s); return m ? own(m[1]) : ''; };
const objAt = (s, k, len) => { const m = rx(k, '\\{').exec(s); return m ? s.slice(m.index, m.index + (len || 600)) : ''; };
function tsOf(line, last) {   // ISO 时间戳；last=true 取最后一个（Claude 的顶层 timestamp 在行尾）
  const k = '"timestamp":"', i = last ? line.lastIndexOf(k) : line.indexOf(k);
  if (i < 0) return 0; const t = Date.parse(line.slice(i + k.length, i + k.length + 40).split('"')[0]); return t > 0 ? t : 0;
}
const STALE_MS = 10 * 60e3;   // 实时模式：时间戳早于 10 分钟的行视为恢复会话时的历史回放，不计
const stale = (ts, st) => !st.history && !st.prime && ts > 0 && ts < Date.now() - STALE_MS;
const CR = 0.1;               // 算力当量里缓存读取的折算系数
function bump(sh, id, n, x) { // 同一 id 只计增量（流式重复写入取最大值）；返回 [Δeq, Δraw]
  if (x == null) x = n;
  const m = sh.seen || (sh.seen = new Map()), p = m.get(id) || [0, 0];
  if (n <= p[0] && x <= p[1]) return [0, 0];
  m.delete(id); m.set(own(id), [Math.max(n, p[0]), Math.max(x, p[1])]); if (m.size > 50000) m.delete(m.keys().next().value);
  return [Math.max(0, n - p[0]), Math.max(0, x - p[1])];
}
function once(sh, id) {       // 工具调用按 id 只记一次
  const m = sh.once || (sh.once = new Set()); if (m.has(id)) return false;
  m.add(own(id)); if (m.size > 50000) m.delete(m.values().next().value); return true;
}
const kNum = s => { if (!s) return 0; const k = /k$/i.test(s), v = parseFloat(s); return Math.round(k ? v * 1000 : v) || 0; };
const splitList = v => String(v || '').split(path.delimiter === ';' ? /[;,]/ : /[:,]/).map(s => s.trim()).filter(Boolean);
const P = p => p.replace(/\\/g, '/');
function homeDirs(sys, prefix, sub) {   // ~/.claude、~/.claude-work … 这类多账号目录
  let ents = []; try { ents = fs.readdirSync(sys.home, { withFileTypes: true }); } catch (e) {}
  return ents.filter(e => e.isDirectory() && e.name.startsWith(prefix) && fs.existsSync(path.join(sys.home, e.name, sub)))
    .sort((a, b) => a.name.length - b.name.length)
    .map(e => ({ dir: path.join(sys.home, e.name, sub), tag: e.name === prefix ? '' : e.name }));
}
function envDirs(v, sub) {
  return splitList(v).map(d => path.basename(d) === sub ? { dir: d, tag: path.basename(path.dirname(d)) } : { dir: path.join(d, sub), tag: path.basename(d) });
}
const SQL_SAFE = s => String(s).replace(/[^A-Za-z0-9_]/g, '');

// Gemini 系的 token 对象：input 通常已含缓存读取（total = input + output + thoughts + tool 时）；返回 [eq, raw]
function gemNet(input, output, cached, thoughts, tool, total) {
  const sep = total > 0 && cached > 0 && total >= input + cached + output + thoughts + tool, inNet = sep ? input : Math.max(0, input - cached);
  const c = sep ? cached : Math.min(cached, input), rest = inNet + output + thoughts + tool;
  return [rest + CR * c, rest + c];
}

// ---------- 适配器 ----------
const ADAPTERS = [
  {
    id: 'claude', label: 'Claude', kind: 'jsonl', needles: ['"usage":{'],
    note: 'message.usage：raw = input + output + cache_creation + cache_read；eq 里 cache_read × 0.1；按 msg id 去重取最大值；子 agent 在 <session>/subagents/*.jsonl，一并计入',
    roots: (env, sys) => [...homeDirs(sys, '.claude', 'projects'), ...envDirs(env.CLAUDE_CONFIG_DIR, 'projects'),
      { dir: path.join(sys.xdgConfig, 'claude', 'projects'), tag: '.config-claude' }],
    match: p => p.endsWith('.jsonl'),
    parse(line, st) {
      const i = line.indexOf('"usage":{'); if (i < 0 || line.indexOf('"type":"assistant"') < 0) return null;
      const ts = tsOf(line, true); if (stale(ts, st)) return null;
      const u = line.slice(i, i + 800), cr = num(u, 'cache_read_input_tokens');
      const base = num(u, 'input_tokens') + num(u, 'output_tokens') + num(u, 'cache_creation_input_tokens'), n = base + CR * cr, x = base + cr;
      const m = /"id":"(msg_[A-Za-z0-9_-]+)"/.exec(line) || /"model":"[^"\\]*","id":"([^"\\]+)"/.exec(line);   // 兼容 API（GLM 等）的 id 未必以 msg_ 开头
      const d = m ? bump(st.shared, m[1], n, x) : [n, x];
      const tools = []; const re = /"type":"tool_use","id":"([A-Za-z0-9_-]+)","name":"([^"\\]{1,64})"/g; let t;
      while ((t = re.exec(line))) if (once(st.shared, t[1])) tools.push(own(t[2]));
      if (st.prime) return null;
      return { n: d[0], x: d[1], ts, model: str(line, 'model'), tools };
    },
  },
  {
    id: 'codex', label: 'Codex', kind: 'jsonl', needles: ['"token_count"', '"turn_context"', '_call"'],
    note: 'event_msg/token_count：input_tokens 已含 cached_input_tokens，raw = input + output，eq = (input − cached) + 0.1 × cached + output（output 已含 reasoning）；按每个文件 total_token_usage 的增量计，重复事件跳过；rate_limits 给出 5 小时/每周额度',
    roots: (env, sys) => [...homeDirs(sys, '.codex', 'sessions'), ...envDirs(env.CODEX_HOME, 'sessions')],
    match: p => /\/rollout-[^/]*\.jsonl$/.test(p),
    parse(line, st) {
      if (line.indexOf('"turn_context"') >= 0) { const m = str(line, 'model'); if (m) st.model = m; return null; }
      const ts = tsOf(line, false);
      for (const ty of ['function_call', 'custom_tool_call', 'local_shell_call', 'web_search_call']) {
        const j = line.indexOf('"type":"' + ty + '"'); if (j < 0) continue;
        if (stale(ts, st) || st.prime) return null;
        const name = ty === 'local_shell_call' ? 'shell' : ty === 'web_search_call' ? 'web_search' : str(line.slice(j, j + 400), 'name');
        return name ? { n: 0, ts, tools: [name] } : null;
      }
      if (line.indexOf('"token_count"') < 0) return null;
      const r = line.indexOf('"rate_limits":{');
      if (r >= 0) {
        const s = line.slice(r, r + 1200), lim = k => { const o = objAt(s, k, 220); if (!o) return null;
          const pct = numF(o, 'used_percent'), win = num(o, 'window_minutes'); let reset = num(o, 'resets_at');
          if (reset && reset < 1e12) reset *= 1000; if (!reset && num(o, 'resets_in_seconds')) reset = (ts || Date.now()) + num(o, 'resets_in_seconds') * 1000;
          return pct == null ? null : { pct, win, reset: reset || null }; };
        const rl = { at: ts || Date.now(), primary: lim('primary'), secondary: lim('secondary') };
        if ((rl.primary || rl.secondary) && (!st.shared.rl || rl.at >= st.shared.rl.at)) st.shared.rl = rl;
      }
      const ti = line.indexOf('"total_token_usage":{'); if (ti < 0) return null;
      const use = s => ({ i: num(s, 'input_tokens'), c: num(s, 'cached_input_tokens'), o: num(s, 'output_tokens'), t: num(s, 'total_tokens') });
      const eq = u => Math.max(0, u.i - u.c) + CR * Math.min(u.c, u.i) + u.o, raw = u => u.i + u.o;
      const tot = use(line.slice(ti, ti + 400)), prev = st.tot; st.tot = tot;
      if (st.prime) return null;
      if (!prev) { if (stale(ts, st)) return null; const li = line.indexOf('"last_token_usage":{'), l = li < 0 ? tot : use(line.slice(li, li + 400)); return { n: eq(l), x: raw(l), ts }; }
      if (tot.t <= prev.t) { st.tot = prev; return null; }           // 重复的 token_count
      if (stale(ts, st)) return null;
      return { n: Math.max(0, eq(tot) - eq(prev)), x: Math.max(0, raw(tot) - raw(prev)), ts };
    },
  },
  {
    id: 'gemini', label: 'Gemini', kind: p => p.endsWith('.jsonl') ? 'jsonl' : 'json', depth: 3, needles: ['"tokens"'],
    note: 'tmp/<项目>/chats/session-*.jsonl（新版追加写）或 .json（旧版整体重写）里 type=gemini 的 tokens：raw = input + output + thoughts + tool（input 已含 cached），eq 里 cached × 0.1；同 id 重写取最大值',
    roots: (env, sys) => [{ dir: path.join(env.GEMINI_CLI_HOME || sys.home, '.gemini', 'tmp'), tag: env.GEMINI_CLI_HOME ? path.basename(env.GEMINI_CLI_HOME) : '' }],
    match: p => /\/chats\/session-[^/]*\.jsonl?$/.test(p),
    parse(input, st) {
      const net = u => gemNet(num(u, 'input'), num(u, 'output'), num(u, 'cached'), num(u, 'thoughts'), num(u, 'tool'), num(u, 'total'));
      const re = /"tokens"\s*:\s*\{[^{}]*\}/g;
      if (st.kind === 'json') { let a = 0, b = 0, m; while ((m = re.exec(input))) { const v = net(m[0]); a += v[0]; b += v[1]; } return { n: a, x: b, model: str(input, 'model') }; }
      const m = re.exec(input); if (!m) return null;
      const ts = tsOf(input, false); if (stale(ts, st)) return null;
      const id = str(input, 'id'), v = net(m[0]), d = id ? bump(st.shared, id, v[0], v[1]) : v;
      const tools = []; const tr = /"id"\s*:\s*"([^"\\]+)"\s*,\s*"name"\s*:\s*"([^"\\]{1,64})"/g; let t;
      while ((t = tr.exec(input))) if (t[1] !== id && once(st.shared, t[1])) tools.push(own(t[2]));
      return st.prime ? null : { n: d[0], x: d[1], ts, model: str(input, 'model'), tools };
    },
  },
  {
    id: 'qwen', label: 'Qwen Code', kind: 'jsonl', depth: 3, needles: ['"usageMetadata"'],
    note: 'projects/<项目>/chats/*.jsonl 的 usageMetadata：raw = promptTokenCount（已含 cached）+ candidatesTokenCount + thoughtsTokenCount，eq 里 cachedContentTokenCount × 0.1；按 uuid 去重',
    roots: (env, sys) => [{ dir: path.join(env.QWEN_HOME || path.join(sys.home, '.qwen'), 'projects'), tag: env.QWEN_HOME ? path.basename(env.QWEN_HOME) : '' }],
    match: p => /\/chats\/[^/]+\.jsonl$/.test(p),
    parse(line, st) {
      const u = objAt(line, 'usageMetadata', 500); if (!u) return null;
      const ts = tsOf(line, false); if (stale(ts, st)) return null;
      const v = gemNet(num(u, 'promptTokenCount'), num(u, 'candidatesTokenCount'), num(u, 'cachedContentTokenCount'), num(u, 'thoughtsTokenCount'), num(u, 'toolUsePromptTokenCount'), num(u, 'totalTokenCount'));
      const id = str(line, 'uuid'), d = id ? bump(st.shared, id, v[0], v[1]) : v;
      const tools = []; const tr = /"functionCall"\s*:\s*\{\s*(?:"id"\s*:\s*"[^"\\]*"\s*,\s*)?"name"\s*:\s*"([^"\\]{1,64})"/g; let t;
      while ((t = tr.exec(line))) tools.push(own(t[1]));
      return st.prime ? null : { n: d[0], x: d[1], ts, model: str(line, 'model'), tools };
    },
  },
  {
    id: 'copilot', label: 'Copilot', kind: 'jsonl', depth: 2, needles: ['"type":"assistant.message"', '"type":"session.', '"type":"tool.execution_start"'],
    note: 'session-state/<id>/events.jsonl：assistant.message 的 outputTokens 实时计；session.shutdown 的 modelMetrics 在会话结束时补齐输入部分（inputTokens 已含缓存读写：raw = input + output，eq 里 cacheReadTokens × 0.1）',
    roots: (env, sys) => [{ dir: path.join(env.COPILOT_HOME || path.join(sys.home, '.copilot'), 'session-state'), tag: env.COPILOT_HOME ? path.basename(env.COPILOT_HOME) : '' }],
    match: p => p.endsWith('.jsonl'),
    parse(line, st) {
      if (st.prime) { st.partial = true; return null; }     // 启动时会话已在进行：结束时不补齐（补了会把启动前的也算进来）
      const ts = tsOf(line, false);
      if (/"type":"session\.(start|resume)"/.test(line)) { st.partial = false; st.out = 0; return null; }
      if (line.indexOf('"type":"assistant.message"') >= 0) {
        const n = num(line, 'outputTokens'); if (!n || stale(ts, st)) return null;
        st.out = (st.out || 0) + n; return { n, ts, model: str(line, 'model') };
      }
      if (line.indexOf('"type":"session.shutdown"') >= 0) {
        let te = 0, tx = 0; const re = /"usage"\s*:\s*\{[^{}]*\}/g; let m;
        while ((m = re.exec(line))) { const i = num(m[0], 'inputTokens'), c = Math.min(i, num(m[0], 'cacheReadTokens')), o = num(m[0], 'outputTokens'); te += i - c + CR * c + o; tx += i + o; }
        const skip = st.partial || stale(ts, st), out = st.out || 0; st.out = 0; st.partial = false;
        return skip ? null : { n: Math.max(0, te - out), x: Math.max(0, tx - out), ts };
      }
      const tn = /"toolName"\s*:\s*"([^"\\]{1,64})"/.exec(line);
      return tn && line.indexOf('"type":"tool.execution_start"') >= 0 && !stale(ts, st) ? { n: 0, ts, tools: [tn[1]] } : null;
    },
  },
  ...[['cline', 'Cline', 'saoudrizwan.claude-dev', false], ['roo', 'Roo Code', 'rooveterinaryinc.roo-cline', true], ['kilo', 'Kilo Code', 'kilocode.kilo-code', true]].map(([id, label, ext, gross]) => ({
    id, label, kind: 'json', depth: 2,
    note: gross ? 'globalStorage/' + ext + '/tasks/*/ui_messages.json 的 api_req_started：tokensIn 已含缓存，raw = tokensIn + tokensOut，eq 里 cacheReads × 0.1'
      : 'globalStorage/' + ext + '/tasks/*/ui_messages.json 的 api_req_started：raw = tokensIn + tokensOut + cacheWrites + cacheReads，eq 里 cacheReads × 0.1',
    roots: (env, sys) => sys.editorStorage.map(e => ({ dir: path.join(e.dir, ext, 'tasks'), tag: e.tag })),
    match: p => p.endsWith('/ui_messages.json'),
    parse(text) {   // text 字段是二次转义的 JSON：\"tokensIn\":123
      const sum = k => { let s = 0, m; const re = new RegExp('\\\\"' + k + '\\\\":(\\d+)', 'g'); while ((m = re.exec(text))) s += +m[1]; return s; };
      const i = sum('tokensIn'), o = sum('tokensOut'), w = sum('cacheWrites'), r = sum('cacheReads');
      return gross ? { n: Math.max(0, i - r) + CR * Math.min(r, i) + o, x: i + o } : { n: i + o + w + CR * r, x: i + o + w + r };
    },
  })),
  {
    id: 'cline-cli', label: 'Cline CLI', kind: 'json', depth: 2,
    note: '~/.cline/data/sessions/<id>/<id>.messages.json 的 metrics：inputTokens 已含缓存，raw = input + output，eq 里 cacheReadTokens × 0.1',
    roots: (env, sys) => [{ dir: env.CLINE_SESSION_DATA_DIR || (env.CLINE_DATA_DIR ? path.join(env.CLINE_DATA_DIR, 'sessions') : path.join(env.CLINE_DIR || path.join(sys.home, '.cline'), 'data', 'sessions')), tag: '' }],
    match: p => p.endsWith('.messages.json'),
    parse(text) {
      let a = 0, b = 0, m; const re = /"metrics"\s*:\s*\{[^{}]*\}/g;
      while ((m = re.exec(text))) { const i = num(m[0], 'inputTokens'), c = Math.min(i, num(m[0], 'cacheReadTokens')), o = num(m[0], 'outputTokens'); a += i - c + CR * c + o; b += i + o; }
      return { n: a, x: b };
    },
  },
  {
    id: 'opencode', label: 'OpenCode', kind: p => p.endsWith('.json') ? 'json' : 'sqlite', depth: 3,
    note: 'v1.2+：opencode.db 的 message.data（json_extract 只取 tokens）；旧版：storage/message/<会话>/*.json。raw = input + output + reasoning + cache.write + cache.read，eq 里 cache.read × 0.1',
    roots: (env, sys) => { const d = path.join(env.XDG_DATA_HOME || path.join(sys.home, '.local', 'share'), 'opencode'); return [{ dir: d, tag: '' }]; },
    match: p => /\/opencode[^/]*\.db$/.test(p) || /\/storage\/message\/[^/]+\/[^/]+\.json$/.test(p),
    parse(input, st) {
      if (st.kind === 'json') {
        const t = objAt(input, 'tokens', 400); if (!t) return null;
        const b = num(t, 'input') + num(t, 'output') + num(t, 'reasoning') + num(t, 'write'), c = num(t, 'read');
        return { n: b + CR * c, x: b + c, ts: num(objAt(input, 'time', 200), 'created') || 0, model: str(input, 'modelID') };
      }
      const rows = input.prepare(`SELECT id, time_created t, json_extract(data,'$.modelID') m, json_extract(data,'$.tokens.input') i, json_extract(data,'$.tokens.output') o,
        json_extract(data,'$.tokens.reasoning') r, json_extract(data,'$.tokens.cache.write') w, json_extract(data,'$.tokens.cache.read') c FROM message
        WHERE time_created > ? AND time_created <= ? AND json_extract(data,'$.role') = 'assistant'`).all(st.from, st.to);
      return rows.map(r => { const b = (r.i | 0) + (r.o | 0) + (r.r | 0) + (r.w | 0), c = r.c | 0; return { id: r.id, n: b + CR * c, x: b + c, ts: r.t < 1e12 ? r.t * 1000 : r.t, model: r.m || '' }; });
    },
  },
  {
    id: 'zcode', label: 'ZCode', kind: 'sqlite', depth: 0,
    note: '~/.zcode/cli/db/db.sqlite 的 model_usage：input_tokens 已含缓存，raw = input + output，eq 里 cache_read_input_tokens × 0.1；tool_usage 只取 tool_name',
    roots: (env, sys) => [{ dir: path.join(env.ZCODE_HOME || path.join(sys.home, '.zcode'), 'cli', 'db'), tag: '' }],
    match: p => p.endsWith('/db.sqlite'),
    parse(db, st) {
      const rows = db.prepare(`SELECT id, model_id m, input_tokens i, output_tokens o, cache_read_input_tokens c, COALESCE(completed_at, started_at) t
        FROM model_usage WHERE started_at > ? AND started_at <= ?`).all(st.from, st.to);
      const out = rows.map(r => { const i = r.i | 0, c = Math.min(i, r.c | 0), o = r.o | 0; return { id: 'u' + r.id, n: i - c + CR * c + o, x: i + o, ts: r.t, model: r.m || '' }; });
      try { for (const r of db.prepare('SELECT rowid k, tool_name n, started_at t FROM tool_usage WHERE started_at > ? AND started_at <= ?').all(st.from, st.to)) out.push({ id: 't' + r.k, n: 0, ts: r.t, tools: [r.n] }); } catch (e) {}
      return out;
    },
  },
  {
    id: 'goose', label: 'Goose', kind: 'sqlite', depth: 0,
    note: 'sessions.db 的 sessions.accumulated_input_tokens + accumulated_output_tokens（会话累计，按差值计；没有单独的缓存字段，raw = eq）',
    roots: (env, sys) => [{ dir: env.GOOSE_PATH_ROOT ? path.join(env.GOOSE_PATH_ROOT, 'data', 'sessions')
      : sys.platform === 'win32' ? path.join(sys.appData || '', 'Block', 'goose', 'data', 'sessions')
      : sys.platform === 'darwin' ? path.join(sys.home, 'Library', 'Application Support', 'goose', 'sessions')
      : path.join(sys.xdgData, 'goose', 'sessions'), tag: '' }, { dir: path.join(sys.xdgData, 'goose', 'sessions'), tag: '' }],
    match: p => p.endsWith('/sessions.db'),
    parse(db, st) {   // 只有会话累计值：每个会话一条，id 固定，引擎按 id 做差
      return db.prepare('SELECT id, accumulated_input_tokens i, accumulated_output_tokens o FROM sessions ORDER BY rowid DESC LIMIT 300').all()
        .map(r => ({ id: r.id, n: (r.i | 0) + (r.o | 0), ts: Date.now(), cumulative: true }));
    },
  },
  {
    id: 'droid', label: 'Droid', kind: 'json', depth: 2,
    note: '~/.factory/sessions/**/<id>.settings.json 的 tokenUsage（会话累计）：raw = inputTokens + outputTokens + thinkingTokens + cacheCreationTokens + cacheReadTokens，eq 里 cacheReadTokens × 0.1',
    roots: (env, sys) => [{ dir: path.join(env.FACTORY_HOME || path.join(sys.home, '.factory'), 'sessions'), tag: '' }],
    match: p => p.endsWith('.settings.json'),
    parse(text) {
      const u = objAt(text, 'tokenUsage', 400); if (!u) return null;
      const b = num(u, 'inputTokens') + num(u, 'outputTokens') + num(u, 'thinkingTokens') + num(u, 'cacheCreationTokens'), c = num(u, 'cacheReadTokens');
      return { n: b + CR * c, x: b + c, model: str(text, 'model') };
    },
  },
  {
    id: 'amp', label: 'Amp', kind: 'json', depth: 1,
    note: 'threads/T-*.json：usageLedger 事件或 messages[].usage 的 input + output，加 cacheCreationInputTokens；raw 再加 cacheReadInputTokens，eq 里它 × 0.1',
    roots: (env, sys) => [{ dir: env.AMP_DATA_DIR || path.join(env.XDG_DATA_HOME || path.join(sys.home, '.local', 'share'), 'amp', 'threads'), tag: '' }],
    match: p => /\/T-[^/]*\.json$/.test(p),
    parse(text) {
      let led = 0, msg = 0, cw = 0, cr = 0, m; const re = /"(tokens|usage)"\s*:\s*\{[^{}]*\}/g;
      while ((m = re.exec(text))) {
        if (m[1] === 'tokens') led += num(m[0], 'input') + num(m[0], 'output');
        else { msg += num(m[0], 'inputTokens') + num(m[0], 'outputTokens'); cw += num(m[0], 'cacheCreationInputTokens'); cr += num(m[0], 'cacheReadInputTokens'); }
      }
      return { n: Math.max(led, msg) + cw + CR * cr, x: Math.max(led, msg) + cw + cr };
    },
  },
  {
    id: 'kimi', label: 'Kimi', kind: 'jsonl', depth: 6, needles: ['token_usage', '"usage.record"'],
    note: 'sessions/**/wire.jsonl：StatusUpdate.token_usage 或 usage.record(turn)：raw = input_other + output + input_cache_creation + input_cache_read，eq 里 cache_read × 0.1',
    roots: (env, sys) => [{ dir: path.join(env.KIMI_SHARE_DIR || path.join(sys.home, '.kimi'), 'sessions'), tag: '' },
      { dir: path.join(env.KIMI_CODE_HOME || path.join(sys.home, '.kimi-code'), 'sessions'), tag: '.kimi-code' }],
    match: p => p.endsWith('/wire.jsonl'),
    parse(line, st) {
      let u = objAt(line, 'token_usage', 300), n = 0, c = 0;
      if (u && line.indexOf('StatusUpdate') >= 0) { n = num(u, 'input_other') + num(u, 'output') + num(u, 'input_cache_creation'); c = num(u, 'input_cache_read'); }
      else if (line.indexOf('"usage.record"') >= 0 && /"usageScope"\s*:\s*"turn"/.test(line)) { u = objAt(line, 'usage', 300); n = num(u, 'inputOther') + num(u, 'output') + num(u, 'inputCacheCreation'); c = num(u, 'inputCacheRead'); }
      else return null;
      const t = numF(line, 'timestamp') || numF(line, 'time') || 0, ts = t && t < 1e12 ? t * 1000 : t;
      if (stale(ts, st) || st.prime) return null;
      const id = str(line, 'message_id') + ':' + n + ':' + c + ':' + ts;   // 只去掉逐字重复的回放
      return once(st.shared, id) ? { n: n + CR * c, x: n + c, ts, model: str(line, 'model') } : null;
    },
  },
  {
    id: 'aider', label: 'Aider', kind: 'md', depth: 1, needles: ['Tokens:', '# aider chat started at '],
    note: '工作区里的 .aider.chat.history.md：「Tokens: X sent, Y cache write, Z cache hit, W received.」raw = sent + received + cache hit，eq 里 cache hit × 0.1（sent 已含 cache write；数字是 1.2k 这类四舍五入值）',
    roots: (env, sys) => [...sys.workspace.map(d => ({ dir: d, tag: path.basename(d) })), ...(env.AIDER_CHAT_HISTORY_FILE ? [{ dir: path.dirname(env.AIDER_CHAT_HISTORY_FILE), tag: '' }] : [])],
    match: p => p.endsWith('.aider.chat.history.md'),
    parse(line, st) {
      if (line.startsWith('# aider chat started at ')) { st.base = Date.parse(line.slice(24).trim().replace(' ', 'T')) || 0; return null; }
      const m = /Tokens:\s*([\d.]+k?)\s*sent(?:,\s*([\d.]+k?)\s*cache write)?(?:,\s*([\d.]+k?)\s*cache hit)?,\s*([\d.]+k?)\s*received/.exec(line);
      if (!m || st.prime) return null;
      const b = kNum(m[1]) + kNum(m[4]), c = kNum(m[3]);
      return { n: b + CR * c, x: b + c, ts: st.history ? st.base || 0 : Date.now() };
    },
  },
];

// 暂不支持（写进 docs/adapters.md）：
//   Cursor CLI：本地没有逐次 token 数（只有聊天 store.db / ai-code-tracking.db 的代码行统计），用量只在 Cursor 服务端。
//   Crush：.crush/crush.db 的 sessions.prompt_tokens/completion_tokens 每步被覆盖成最后一步的值，不是累计，算不出真实消耗。
//   iFlow CLI：官方仓库只有文档，找不到可核实的本地用量格式；若你的版本写 Gemini 式 chats 文件，可用 gucode.extraRoots 指定 adapter:"gemini"。

// ---------- 系统信息（各平台路径）----------
const EDITORS = ['Code', 'Code - Insiders', 'Cursor', 'Windsurf', 'VSCodium', 'Trae', 'Kiro'];
function systemInfo(env, more) {
  env = env || process.env; more = more || {};
  const home = more.home || os.homedir(), platform = more.platform || process.platform;
  const appData = env.APPDATA || (platform === 'win32' ? path.join(home, 'AppData', 'Roaming') : null);
  const xdgConfig = env.XDG_CONFIG_HOME || path.join(home, '.config'), xdgData = env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  const base = platform === 'darwin' ? path.join(home, 'Library', 'Application Support') : platform === 'win32' ? appData : xdgConfig;
  const editorStorage = [...(more.editorStorage || []),
    ...EDITORS.map(e => ({ dir: path.join(base, e, 'User', 'globalStorage'), tag: e === 'Code' ? '' : e })),
    ...['.vscode-server', '.cursor-server', '.windsurf-server'].map(s => ({ dir: path.join(home, s, 'data', 'User', 'globalStorage'), tag: s.slice(1) }))];
  return { home, platform, appData, xdgConfig, xdgData, editorStorage, workspace: more.workspace || [] };
}

// ---------- 读取引擎 ----------
// createTracker({ env, sys, extra: [{path, adapter, label}], onRecord(rec), only?: [adapterId] })
//   rec = { key, label, src, file, ts, n, model, tools }
let sqliteMod;
function sqlite() { if (sqliteMod === undefined) { try { sqliteMod = require('node:sqlite'); } catch (e) { sqliteMod = null; } } return sqliteMod; }
const real = d => { try { return fs.realpathSync(d); } catch (e) { return path.resolve(d); } };
const kindOf = (a, p) => typeof a.kind === 'function' ? a.kind(p) : a.kind;

function createTracker(o) {
  const env = o.env || process.env, sys = o.sys || systemInfo(env);
  const T = { sources: new Map(), files: new Map(), since: Date.now(), onRecord: o.onRecord || (() => {}) };
  const adapters = o.adapters || ADAPTERS;
  T.build = function (extra) {
    if (extra !== undefined) T.extra = extra; extra = T.extra;
    const keep = new Map(); for (const s of T.sources.values()) keep.set(s.real, s);
    T.sources.clear(); const seenDir = new Set();
    const addSrc = (a, dir, tag, label) => {
      const r = real(dir); if (seenDir.has(r)) return; seenDir.add(r);
      let key = tag ? a.id + ':' + tag : a.id; for (let i = 2; T.sources.has(key); i++) key = (tag ? a.id + ':' + tag : a.id) + '#' + i;
      const old = keep.get(r);
      T.sources.set(key, { key, id: a.id, adapter: a, dir, real: r, tag, label: label || (tag ? `${a.label}（${tag}）` : a.label), shared: old ? old.shared : {}, exists: false, error: '' });
    };
    for (const a of adapters) { if (o.only && !o.only.includes(a.id)) continue; for (const r of a.roots(env, sys) || []) if (r && r.dir) addSrc(a, r.dir, r.tag || '', r.label); }
    for (const x of extra || []) { const a = adapters.find(a => a.id === x.adapter); if (a && x.path) addSrc(a, x.path, x.label || path.basename(x.path), x.label); }
    for (const [p, f] of T.files) { const s = [...T.sources.values()].find(s => s.real === f.src.real); if (s) f.src = s; else T.files.delete(p); }
  };
  async function walk(dir, src, depth, boot) {
    let ents; try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (depth > 0 && e.name !== 'node_modules' && e.name !== '.git') await walk(p, src, depth - 1, boot); continue; }
      if (!src.adapter.match(P(p))) continue;
      let st; try { st = await fs.promises.stat(p); } catch (er) { continue; }
      const f = T.files.get(p);
      if (f) { f.mt = Math.max(f.mt, st.mtimeMs); continue; }
      const kind = kindOf(src.adapter, P(p)), old = boot || st.mtimeMs < T.since;   // 启动前就有的内容不算，只有启动后新建的文件从头计
      const nf = { p, src, kind, off: 0, bootOff: 0, mt: st.mtimeMs, readAt: 0, last: old ? null : 0, lastX: 0, fresh: !old, st: { shared: src.shared, kind } };
      if (kind === 'jsonl' || kind === 'md') { nf.off = nf.bootOff = old ? st.size : 0; if (boot && Date.now() - st.mtimeMs < 30 * 60e3) prime(nf, st.size); }
      if (kind === 'sqlite') nf.st.from = T.since - 3600e3;
      T.files.set(p, nf);
      if (kind === 'json' && old && Date.now() - st.mtimeMs < 7 * 864e5) { const text = await fs.promises.readFile(p, 'utf8').catch(() => null); if (text != null) readSnap(nf, true, text); }
    }
  }
  function prime(f, size) {   // 读文件尾巴，把去重表/累计值补齐，避免跨启动边界的消息被重复计
    const len = Math.min(size, 256 << 10); if (!len) return;
    const buf = Buffer.alloc(len); let fd;
    try { fd = fs.openSync(f.p, 'r'); fs.readSync(fd, buf, 0, len, size - len); } catch (e) { return; } finally { if (fd != null) fs.closeSync(fd); }
    f.st.prime = true; const s = buf.toString('utf8'); const a = s.indexOf('\n');
    for (const line of s.slice(len < size ? a + 1 : 0).split('\n')) if (line) try { f.src.adapter.parse(line, f.st); } catch (e) {}
    f.st.prime = false;
  }
  let walking = false;
  T.discover = async function (boot) {
    if (walking) return; walking = true;
    try { T.build(); for (const s of T.sources.values()) { s.exists = fs.existsSync(s.dir); if (s.exists) await walk(s.dir, s, s.adapter.depth == null ? 6 : s.adapter.depth, boot); } }
    finally { walking = false; }
  };
  function emit(r, f) {
    if (!r) return; if (typeof r === 'number') r = { n: r };
    const n = Math.max(0, Math.round(r.n || 0)), x = r.x == null ? n : Math.max(0, Math.round(r.x)), tools = r.tools || [];
    if (!n && !x && !tools.length) return;
    T.onRecord({ key: f.src.key, label: f.src.label, src: f.src, file: f.p, kind: f.kind, ts: r.ts || Date.now(), n, x, model: r.model || f.st.model || '', tools });
  }
  function readLines(f) {
    let st; try { st = fs.statSync(f.p); } catch (e) { return; }
    f.mt = st.mtimeMs; if (st.size < f.off) f.off = st.size; if (st.size === f.off) return;
    const len = Math.min(st.size - f.off, 16 << 20), buf = Buffer.alloc(len); let fd;
    try { fd = fs.openSync(f.p, 'r'); fs.readSync(fd, buf, 0, len, f.off); } catch (e) { return; } finally { if (fd != null) fs.closeSync(fd); }
    const end = buf.lastIndexOf(10); if (end < 0) return;
    f.off += end + 1;
    for (const line of buf.toString('utf8', 0, end).split('\n')) if (line) { let r; try { r = f.src.adapter.parse(line, f.st); } catch (e) { continue; } emit(r, f); }
  }
  function readSnap(f, baseline, text) {
    let st; try { st = fs.statSync(f.p); } catch (e) { return; }
    if (!baseline && st.mtimeMs === f.snapMt && st.size === f.snapSize) return;
    if (!baseline && Date.now() - f.readAt < 2000) return;   // 整体重写的大文件最多 2 秒读一次
    f.readAt = Date.now(); f.snapMt = st.mtimeMs; f.snapSize = st.size; f.mt = st.mtimeMs;
    let r; try { r = f.src.adapter.parse(text != null ? text : fs.readFileSync(f.p, 'utf8'), f.st); } catch (e) { return; }
    if (typeof r === 'number') r = { n: r }; if (!r) return;
    const tot = r.n || 0, totX = r.x == null ? tot : r.x;
    f.lastTs = r.ts || 0; if (r.model) f.st.model = r.model;
    if (f.last == null || tot < f.last || totX < f.lastX) { f.last = tot; f.lastX = totX; return; }
    if (tot > f.last || totX > f.lastX) { emit({ n: tot - f.last, x: totX - f.lastX, ts: st.mtimeMs, model: r.model }, f); f.last = tot; f.lastX = totX; }
  }
  function readDb(f, now) {
    const S = sqlite(); if (!S) { f.src.error = '需要 node:sqlite（Node 22.13+ / VS Code 1.95+）'; return; }
    let m = 0; for (const x of ['', '-wal']) try { m = Math.max(m, fs.statSync(f.p + x).mtimeMs); } catch (e) {}
    if (m === f.dbMt || now - f.readAt < 5000) return;
    f.readAt = now; f.dbMt = m; f.mt = Math.max(f.mt, m);
    let db; try {
      db = new S.DatabaseSync(f.p, { readOnly: true });
      const first = !f.st.primed; f.st.to = now + 864e5;
      const rows = f.src.adapter.parse(db, f.st) || [];
      for (const r of rows) {
        const d = r.id != null ? bump(f.st.shared, f.p + '|' + r.id, r.n || 0, r.x) : [r.n || 0, r.x == null ? r.n || 0 : r.x];
        const tl = r.tools && r.tools.length && (r.id == null || once(f.st.shared, f.p + '|t|' + r.id)) ? r.tools : null;
        if (first && (r.cumulative || r.ts <= T.since)) continue;   // 启动前的行只登记
        if (d[0] || d[1] || tl) emit({ n: d[0], x: d[1], ts: r.ts, model: r.model, tools: tl || [] }, f);
      }
      f.st.primed = true; f.src.error = '';
    } catch (e) { f.src.error = String(e.message || e).slice(0, 120); } finally { try { db && db.close(); } catch (e) {} }
  }
  T.tick = function () {
    const now = Date.now();
    for (const f of T.files.values()) {
      if (now - f.mt > 6 * 3600e3 && f.kind !== 'sqlite') continue;
      if (f.kind === 'json') readSnap(f); else if (f.kind === 'sqlite') readDb(f, now); else readLines(f);
    }
  };
  T.list = () => { const has = new Set(); for (const f of T.files.values()) has.add(f.src); return [...T.sources.values()].filter(s => s.exists && has.has(s)).map(s => ({ key: s.key, label: s.label, kind: s.id, account: s.tag || 'default', dir: s.dir, error: s.error })); };
  T.build(o.extra);
  return T;
}

// 历史回填：读每个文件 [0, bootOff) 的部分（实时引擎读 bootOff 之后，互不重叠），分批让出事件循环
// scanHistory(tracker, { after, before, onRecord, chunk, onProgress }) → { files, bytes, ms }
async function scanHistory(T, o) {
  const t0 = Date.now(), after = o.after || 0, before = o.before || T.since, chunk = o.chunk || (4 << 20);
  const yieldNow = () => new Promise(r => setImmediate(r));
  let bytes = 0, nfiles = 0, pool = Buffer.allocUnsafe(chunk); const shared = new Map();
  const files = [...T.files.values()].filter(f => f.mt > after).sort((a, b) => a.mt - b.mt);
  for (const f of files) {
    if (o.cancelled && o.cancelled()) break;
    const sh = shared.get(f.src.key) || (shared.set(f.src.key, {}), shared.get(f.src.key));
    const st = { shared: sh, kind: f.kind, history: true };
    const emit = r => {
      if (!r) return; if (typeof r === 'number') r = { n: r };
      const ts = r.ts || f.mt; if (ts <= after || ts > before) return;
      const n = Math.max(0, Math.round(r.n || 0)), x = r.x == null ? n : Math.max(0, Math.round(r.x)), tools = r.tools || []; if (!n && !x && !tools.length) return;
      o.onRecord({ key: f.src.key, label: f.src.label, src: f.src, file: f.p, kind: f.kind, ts, n, x, model: r.model || st.model || '', tools });
    };
    try {
      if (f.kind === 'jsonl' || f.kind === 'md') {
        const end = f.bootOff; if (!end) continue;
        const nd = f.src.adapter.needles, parse = line => { try { emit(f.src.adapter.parse(line, st)); } catch (e) {} };
        const fh = await fs.promises.open(f.p, 'r'); let pos = 0, size = chunk;
        try {
          while (pos < end) {
            const len = Math.min(size, end - pos); if (pool.length < len) pool = Buffer.allocUnsafe(len); const buf = pool.subarray(0, len);
            const { bytesRead } = await fh.read(buf, 0, len, pos); if (!bytesRead) break;
            let stop = buf.lastIndexOf(10, bytesRead - 1) + 1;
            if (!stop) { if (pos + bytesRead < end) { size *= 2; continue; } stop = bytesRead; }   // 超长行：加大块重读
            bytes += stop; size = chunk;
            if (nd) {   // 只把含关键字的行转成字符串（大部分字节是工具输出，直接跳过）
              const hits = new Map();
              for (const k of nd) for (let i = buf.indexOf(k); i >= 0 && i < stop; i = buf.indexOf(k, i + 1)) {
                const a = buf.lastIndexOf(10, i) + 1; if (hits.has(a)) continue;
                let b = buf.indexOf(10, i); if (b < 0 || b > stop) b = stop; hits.set(a, b); i = b;
              }
              for (const a of [...hits.keys()].sort((x, y) => x - y)) parse(buf.toString('utf8', a, hits.get(a)));
            } else for (const line of buf.toString('utf8', 0, stop).split('\n')) if (line) parse(line);
            pos += stop;
            await yieldNow();
          }
        } finally { await fh.close(); }
      } else if (f.kind === 'json') {   // 快照文件：报告启动时的累计值（snap），由调用方按文件做差
        if (f.fresh) continue;
        let n = f.last, x = f.lastX, ts = f.lastTs || Math.min(f.mt, before), model = f.st.model || '';
        if (n == null) {
          const text = await fs.promises.readFile(f.p, 'utf8'); bytes += text.length;
          let r = f.src.adapter.parse(text, st); if (typeof r === 'number') r = { n: r }; if (!r) continue;
          n = r.n || 0; x = r.x == null ? n : r.x; ts = r.ts || f.mt; model = r.model || '';
        }
        if (ts > after && (n > 0 || x > 0)) o.onRecord({ key: f.src.key, label: f.src.label, src: f.src, file: f.p, kind: 'json', snap: n, snapX: x, ts: Math.min(ts, before), n: 0, x: 0, model, tools: [] });
      } else if (f.kind === 'sqlite') {
        const S = sqlite(); if (!S) continue;
        const db = new S.DatabaseSync(f.p, { readOnly: true });
        try { st.from = after; st.to = before; for (const r of f.src.adapter.parse(db, st) || []) if (!r.cumulative) emit(r); } finally { db.close(); }
      }
    } catch (e) { /* 读不了的文件跳过 */ }
    nfiles++; if (o.onProgress && nfiles % 50 === 0) o.onProgress(nfiles, files.length, bytes);
    await yieldNow();
  }
  return { files: nfiles, bytes, ms: Date.now() - t0, shared };
}

// ---------- 速率表：按来源 10 秒窗口速率 + 本次启动累计（eq 和 raw 各一套）----------
function createMeter(winMs) {
  winMs = winMs || 10000;
  const M = { total: 0, rate: 0, rawTotal: 0, rawRate: 0, lastAt: 0, delta: 0, rawDelta: 0, win: [], by: new Map() };
  M.ensure = (key, label) => { let s = M.by.get(key); if (!s) M.by.set(key, s = { label, total: 0, rate: 0, rawTotal: 0, rawRate: 0, win: [] }); else if (label) s.label = label; return s; };
  M.add = (key, label, n, x, now) => {
    if (x == null) x = n; if (n <= 0 && x <= 0) return; now = now || Date.now(); const s = M.ensure(key, label);
    s.total += n; s.rawTotal += x; s.win.push([now, n, x]); M.total += n; M.rawTotal += x; M.win.push([now, n, x]); M.lastAt = now; M.delta += n; M.rawDelta += x;
  };
  M.step = now => {
    now = now || Date.now(); const cut = now - winMs, sec = winMs / 1000;
    const rate = w => { while (w.length && w[0][0] < cut) w.shift(); let a = 0, b = 0; for (const e of w) { a += e[1]; b += e[2]; } return [a / sec, b / sec]; };
    [M.rate, M.rawRate] = rate(M.win); const bySource = {};
    for (const [k, s] of M.by) { [s.rate, s.rawRate] = rate(s.win); bySource[k] = { label: s.label, rate: s.rate, total: s.total, rawRate: s.rawRate, rawTotal: s.rawTotal }; }
    const d = M.delta, dx = M.rawDelta; M.delta = 0; M.rawDelta = 0;
    return { delta: d, rate: M.rate, rawDelta: dx, rawRate: M.rawRate, bySource };
  };
  return M;
}

// ---------- 多机桥接文件：{ v:1, host, updated, sources: { key: { label, total, rawTotal } } }（total = eq，rawTotal = raw）----------
function createBridgeReader(onRecord, selfHost) {
  const B = new Map();   // path → { mt, totals: Map }
  return function read(paths) {
    for (const p of paths || []) {
      let st; try { st = fs.statSync(p); } catch (e) { continue; }
      let b = B.get(p); if (b && b.mt === st.mtimeMs) continue;
      let d; try { d = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { continue; }   // 桥接文件是我们自己写的纯数字 JSON
      if (!d || !d.sources || (selfHost && d.host === selfHost)) continue;               // 同一台机器的桥接文件不重复计
      const first = !b; if (!b) B.set(p, b = { mt: 0, totals: new Map() }); b.mt = st.mtimeMs;
      const host = String(d.host || path.basename(p)).slice(0, 40);
      for (const [k, s] of Object.entries(d.sources)) {
        const tot = +s.total || 0, totX = s.rawTotal == null ? tot : +s.rawTotal || 0, prev = b.totals.get(k); b.totals.set(k, [tot, totX]);
        if (first || prev == null || tot < prev[0] || totX < prev[1]) continue;
        if (tot > prev[0] || totX > prev[1]) onRecord({ key: 'bridge:' + host + ':' + k, label: (s.label || k) + ' @' + host, ts: Date.now(), n: tot - prev[0], x: totX - prev[1], model: s.model || '', tools: [], bridge: true });
      }
    }
  };
}

module.exports = { ADAPTERS, systemInfo, createTracker, scanHistory, createMeter, createBridgeReader, _h: { num, str, tsOf, gemNet, kNum, bump } };
