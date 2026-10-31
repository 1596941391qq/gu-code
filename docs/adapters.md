# 蛊码 GuCode · 用量适配器

插件从本机各家 AI 编程工具的会话日志里截取 token 数字。这些数字推动游戏，也写进算力履历，用来画每日曲线、日历和额度窗口。读取逻辑全在 `vscode-ext/adapters.js`：上半部分是适配器，每个 CLI 一个对象；下半部分是读取引擎。插件、算力履历（`vscode-ext/ledger.js`）和本地桥（`tools/gu-bridge.mjs`）共用这一份代码。

## 双口径

每条记录同时产出两个数：

| 口径 | 定义 | 用在哪 |
|---|---|---|
| **raw 全量吞吐** | 输入 + 输出（含推理）+ 缓存写入 + 缓存读取 | 「灵流」大数字、状态栏、日历、年度卡、额度窗口的 used。和 ccusage 这类工具的口径一致 |
| **eq 算力当量** | 输入 + 输出（含推理）+ 缓存写入 + **0.1 ×** 缓存读取 | 养蛊推进和 econ（`tokens` 消息的 delta / rate，履历的 `t`） |

**为什么分两种：**

- AI 编程工具每一轮都会把整段上下文从缓存里重新读一遍。实测 90 秒窗口里，缓存读取是其余部分的 21 倍。
- 只算不含缓存读取的部分，用户会觉得「只统计了一个会话」，和 ccusage 等工具差一个数量级。所以展示用 raw。
- 但缓存读取几乎不花算力，API 价格只有普通输入的 1/10。如果按 raw 推进游戏：
  - 重度复读上下文的工具（Claude Code 长会话）会碾压不带缓存的工具；
  - 开一个超长会话什么都不干，也能「刷」出大量 token。
- 所以推进游戏按 API 价格比例，把缓存读取折成 0.1，就是 eq。
- 没有单独缓存字段的工具 raw = eq。

**各家「输入」是否已含缓存读取，口径不同**：

- Anthropic 系（Claude Code、Cline、Amp、Droid、Kimi）的输入不含缓存，缓存读取是单独字段。
- OpenAI 系（Codex、ZCode、Copilot、Roo/Kilo、Cline CLI）的输入已含缓存读取。
- 下表的换算已经统一好。

## 支持矩阵

路径一栏中，`~` 在 Windows 上是 `%USERPROFILE%`。

| CLI | 默认路径（可用环境变量覆盖） | 格式与字段 | 换算（raw；eq 把其中的缓存读取 × 0.1） | 状态 |
|---|---|---|---|---|
| Claude Code | `~/.claude/projects/**/*.jsonl`；`~/.claude-*/projects`（多账号）；`$CLAUDE_CONFIG_DIR/projects`（可用逗号分隔多个）；`~/.config/claude/projects` | JSONL 追加。`message.usage`，子 agent 在 `<session>/subagents/agent-*.jsonl` | input + output + cache_creation + cache_read。按 msg id 去重，同一条消息流式写多行时取最大值 | 已支持 |
| OpenAI Codex CLI | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`；`~/.codex-*/sessions`；`$CODEX_HOME/sessions` | JSONL 追加。`event_msg/token_count` 的 `total_token_usage` 和 `last_token_usage`，以及 `rate_limits` | input + output（input 已含 cached_input；eq = (input − cached) + 0.1 × cached + output），output 已含 reasoning。按每个文件累计值的增量计，累计值没变的重复事件跳过 | 已支持（含 5 小时和每周额度） |
| Gemini CLI | `~/.gemini/tmp/<项目>/chats/session-*.jsonl`（新版，追加写）或 `.json`（旧版，整体重写）；`$GEMINI_CLI_HOME/.gemini/tmp` | `type: gemini` 记录里的 `tokens {input, output, cached, thoughts, tool, total}` | input + output + thoughts + tool（input 已含 cached）。同一 id 重写时取最大值 | 已支持 |
| Qwen Code | `~/.qwen/projects/<项目>/chats/*.jsonl`；`$QWEN_HOME/projects` | JSONL。`usageMetadata {promptTokenCount, candidatesTokenCount, thoughtsTokenCount, cachedContentTokenCount, totalTokenCount}` | prompt + candidates + thoughts（prompt 已含 cached）。按 uuid 去重 | 已支持 |
| GitHub Copilot CLI | `~/.copilot/session-state/<id>/events.jsonl`；`$COPILOT_HOME` | JSONL。`assistant.message` 带 `outputTokens`；`session.shutdown` 带 `modelMetrics.*.usage {inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens}` | 会话进行中实时计输出；会话结束时按 inputTokens + outputTokens 补齐（inputTokens 已含缓存读写） | 已支持（输入部分在会话结束时才到） |
| Cline | VS Code globalStorage `saoudrizwan.claude-dev/tasks/*/ui_messages.json`。macOS 在 `~/Library/Application Support/Code/User/globalStorage`，Linux 在 `~/.config/Code/...`，Windows 在 `%APPDATA%\Code\...`；Cursor、Windsurf、VSCodium、Insiders、Trae、Kiro 和 `~/.vscode-server` 一并查找 | JSON，整体重写。`say: api_req_started` 的 text 里有 `tokensIn / tokensOut / cacheWrites / cacheReads` | tokensIn + tokensOut + cacheWrites + cacheReads（Cline 的 tokensIn 不含缓存） | 已支持 |
| Roo Code | 同上，`rooveterinaryinc.roo-cline` | 同上 | tokensIn + tokensOut（Roo 从 3.29.5 起 tokensIn 含缓存） | 已支持 |
| Kilo Code | 同上，`kilocode.kilo-code` | 同上 | 同 Roo | 已支持 |
| Cline CLI | `~/.cline/data/sessions/<id>/<id>.messages.json`；`$CLINE_SESSION_DATA_DIR`、`$CLINE_DATA_DIR`、`$CLINE_DIR` | JSON。`metrics {inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens}` | inputTokens + outputTokens（inputTokens 已含缓存） | 已支持 |
| OpenCode | `~/.local/share/opencode/opencode.db`（v1.2+，sqlite）；旧版是 `storage/message/<会话>/*.json`；`$XDG_DATA_HOME/opencode`。Windows 同样在 `%USERPROFILE%\.local\share\opencode` | sqlite 的 `message.data` 用 `json_extract` 只取 tokens；旧版 JSON 读 `tokens {input, output, reasoning, cache{read, write}}` | input + output + reasoning + cache.write + cache.read | 已支持（sqlite 需要 `node:sqlite`，见下） |
| ZCode（Z.ai） | `~/.zcode/cli/db/db.sqlite`；`$ZCODE_HOME/cli/db` | sqlite。`model_usage(input_tokens, output_tokens, cache_read_input_tokens, model_id, started_at, completed_at)`，`tool_usage(tool_name)` | input + output（input 已含缓存，OpenAI 口径） | 已支持（需要 `node:sqlite`） |
| Droid（Factory） | `~/.factory/sessions/**/<id>.settings.json`；`$FACTORY_HOME/sessions` | JSON，整体重写。`tokenUsage {inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, thinkingTokens}` 是会话累计值 | input + output + thinking + cacheCreation + cacheRead，按差值计 | 已支持 |
| Amp | `~/.local/share/amp/threads/T-*.json`；`$AMP_DATA_DIR` | JSON，整体重写。`usageLedger.events[].tokens` 或 `messages[].usage` | input + output + cacheCreationInputTokens + cacheReadInputTokens | 已支持（Windows 路径未核实） |
| Kimi CLI | `~/.kimi/sessions/**/wire.jsonl`；`~/.kimi-code/sessions/**/wire.jsonl`；`$KIMI_SHARE_DIR`、`$KIMI_CODE_HOME` | JSONL。`StatusUpdate.token_usage {input_other, output, input_cache_read, input_cache_creation}`，或新版 `usage.record`（scope 为 turn） | input_other + output + input_cache_creation + input_cache_read | 已支持 |
| Goose | `~/.local/share/goose/sessions/sessions.db`（Linux）；macOS 在 `~/Library/Application Support/goose/sessions`；Windows 在 `%APPDATA%\Block\goose\data\sessions`；`$GOOSE_PATH_ROOT/data/sessions` | sqlite。`sessions.accumulated_input_tokens / accumulated_output_tokens`，是会话累计值 | 按差值计。没有单独的缓存字段，raw = eq | 部分支持（只计实时增量，不回填历史） |
| Aider | 当前工作区根目录下的 `.aider.chat.history.md`；`$AIDER_CHAT_HISTORY_FILE` | Markdown。`> Tokens: 2.4k sent, 1.2k cache write, 5.3k cache hit, 300 received.` | sent + received + cache hit。sent 已含 cache write。数字是四舍五入到 k 的近似值 | 已支持（近似） |
| Claude Code 接 GLM 等兼容 API | 同 Claude Code | 同上，`message.model` 为 `glm-4.6` 之类 | 同上 | 已支持。履历里按 model 字段归到 `glm` |
| Cursor CLI（cursor-agent） | `~/.cursor/chats/**/store.db`、`~/.cursor/ai-tracking/ai-code-tracking.db` | 只有聊天记录和代码行归属统计 | — | **暂不支持**：本地没有逐次 token 数，用量只在 Cursor 服务端 |
| Crush | `<项目>/.crush/crush.db` | sqlite。`sessions.prompt_tokens / completion_tokens` | — | **暂不支持**：这两个字段每一步都被覆盖成最后一步的值（prompt 是上下文长度），不是累计，算不出真实消耗 |
| iFlow CLI | `~/.iflow/` | — | — | **暂不支持**：官方仓库只有文档，找不到可核实的本地用量格式。如果你的版本写 Gemini 式的 chats 文件，可以用 `gucode.extraRoots` 指定 `adapter: "gemini"` 试试 |

**sqlite 类**（OpenCode v1.2+、ZCode、Goose）用 Node 内置的 `node:sqlite`，以只读方式打开，用完即关。插件不打包第三方依赖。

- VS Code 1.95 以上自带 Node 22.13+，可以直接用。实测本机 VS Code 带的是 Electron 43 / Node 24.21。
- 环境里没有 `node:sqlite` 时，这几个来源会显示「需要 node:sqlite」，其他来源不受影响。

**Copilot 的局限**：本地 `events.jsonl` 只有每条回复的输出 token，输入 token 要等会话正常结束时的 `session.shutdown` 才有。

- 插件启动前就开着的 Copilot 会话，结束时不补输入部分，否则会把启动前的也算进来。
- 进程被杀、没有正常退出的会话，输入部分会缺失。

## 多账号

自动发现，不用配置：

- Claude：`~/.claude*/projects`、`$CLAUDE_CONFIG_DIR`（可以写多个，用逗号或系统路径分隔符隔开）、`~/.config/claude/projects`。
- Codex：`~/.codex*/sessions`、`$CODEX_HOME`。

同一种 CLI 的多个目录分开统计，来源名带目录名，例如「Claude（.claude-work）」。指向同一个真实目录的路径（软链接等）只算一次。新建的账号目录在 10 秒内被发现。

注意：像 `~/.codex-accounts/<名字>/auth.json` 这种只切换登录凭据、会话都写进同一个 `~/.codex` 的用法，从日志上分不出账号，会合在「Codex」里。

不在默认位置的目录，在设置里手动添加：

```jsonc
// settings.json
"gucode.extraRoots": [
  { "path": "~/work/claude-home/projects", "adapter": "claude", "label": "公司号" },
  { "path": "D:/codex-b/sessions", "adapter": "codex", "label": "Codex 副号" }
]
```

`adapter` 填适配器 id：claude、codex、gemini、qwen、copilot、cline、roo、kilo、cline-cli、opencode、zcode、goose、droid、amp、kimi、aider。改完立即生效。

## 多台机器（桥接文件）

在另一台机器上跑桥，把累计数字写进同步盘：

```sh
node tools/gu-bridge.mjs --out ~/Dropbox/gucode/laptop.json --host laptop
# 可选：--interval 5（秒）、--root claude=D:/other/projects（手动加目录，可重复）、--list（只列出发现的来源）
```

文件格式：

```json
{ "v": 1, "host": "laptop", "updated": 1793430000000,
  "sources": { "claude": { "label": "Claude", "total": 1234567, "rawTotal": 25930000 }, "codex": { "label": "Codex", "total": 89012, "rawTotal": 410000 } } }
```

`total` 是 eq，`rawTotal` 是 raw，都是这台机器从第一次运行起的累计，桥重启后接着算。

主力机的插件里配置：

```jsonc
"gucode.bridgeFiles": ["~/Dropbox/gucode/laptop.json"]
```

插件只读这个文件里数字的增量，汇进总数和 `bySource`。来源名是「Claude @laptop」，key 是 `bridge:laptop:claude`。

- 第一次读到文件只记基线，不会把历史一次性灌进来。
- `host` 和本机同名的桥接文件会被忽略，防止重复计。
- 桥和插件都不监听网络端口，同步交给 iCloud、Dropbox、Syncthing 这类同步盘。

## 网页版本地桥

网页版（GitHub Pages 上的游戏）拿不到本机文件，可以在终端开一个只监听本机的桥：

```sh
node tools/gu-bridge.mjs --serve            # 默认 http://127.0.0.1:47321
# 可选：--port 47321  --weekly-reset "Thu 08:00"  --claude5h 20000000  --claude-week 300000000  --no-ledger
```

- 只绑定 `127.0.0.1`，不对局域网开放。
- 只读本机日志里的数字，履历缓存在 `~/.gucode/ledger.json`。
- `GET /health` 返回 `{ ok: true, v: 1, app: 'gu-bridge', sources: [{ key, label }] }`。
- `GET /stream` 是 SSE 流。每条都是 `data: <JSON>`，JSON 和插件发给 Webview 的 postMessage 完全一致：
  - 每秒一条 `{ type: 'tokens', delta, hot, rate, idle, rawDelta, rawRate, bySource }`：
    - `delta` / `rate` 是 eq，用于游戏推进；`rawDelta` / `rawRate` 是 raw，用于显示。
    - `bySource[key]` 是 `{ label, rate, total, rawRate, rawTotal }`。
  - 连上时一条、之后每 60 秒一条 `{ type: 'ledger', v: 1, … }`。
  - 每 15 秒发一次 `: ping` 注释保活。
- CORS 只放行 `https://1596941391qq.github.io` 和 `file://` 打开的页面（`Origin: null`），其他来源一律 403。没有 Origin 的请求（curl 之类）照常放行。
- 预检请求会回 `Access-Control-Allow-Private-Network: true`。

**网页侧（tokens.js）怎么接**，由集成方实现：

1. 启动时 `fetch('http://127.0.0.1:47321/health', { signal: AbortSignal.timeout(800) })`，拿到 `ok: true` 再开 `new EventSource('http://127.0.0.1:47321/stream')`。失败就保持演示模式，可以每 30 秒重试一次，或给一个「连接本机」按钮让用户点一下再探测。
2. `es.onmessage = e => handle(JSON.parse(e.data))`。`handle` 直接复用插件里处理 `window.addEventListener('message')` 的那段逻辑，因为消息格式一模一样。
3. 收到第一条 `tokens` 就切到真实模式，停掉演示数据。`es.onerror` 连续失败几次后切回演示模式。EventSource 自己会按 `retry: 3000` 重连。
4. 可以提供 `?bridge=47321` 这类参数，方便用户改端口。

**浏览器兼容性**：

- **Chrome / Edge**：53 起，https 页面访问 `http://127.0.0.1` 不算混合内容。Chrome 142 起有「本地网络访问」权限：公网页面第一次访问回环地址时会弹窗请用户允许；Chrome 145 起拆出单独的「回环网络」权限。用户点允许后才连得上，所以最好由按钮触发第一次连接。更早的版本走 Private Network Access 预检，桥已经处理。
- **Firefox**：把 `127.0.0.1` 当作可信来源，https 页面可以直接连。
- **Safari**：**不建议依赖**。WebKit 不按规范豁免 localhost：Safari 18 起，https 页面加载 `http://localhost` / `127.0.0.1` 会被当作混合内容拦下（WebKit bug 279249、171934，至今仍有争议）。以上来自 WebKit 的 bug 记录，本机没有实测。Safari 用户可以：
  - 把网页版下载到本地，用 `file://` 打开（Origin 为 null，已放行，也不是混合内容）；
  - 或者改用 Chrome、Edge、Firefox。

页面上检测到 Safari 时，提示「Safari 连不上本机桥，请用本地打开或换浏览器」即可。

## 算力履历与额度窗口

`vscode-ext/ledger.js` 复用适配器的解析结果，每条记录形如 `{ src, account, ts, tokens, model, tools: [name] }`，按天、小时、来源、模型族、工具类别汇总。

- 插件启动时、Webview 就绪时、之后每 60 秒推一条 `type: 'ledger'` 消息，格式见 `ledger.js` 文件头。这个格式是和 UI 的契约，字段名不改。双口径的落法：
  - `days[d].t`、`s`、`m` 是 eq；新增的 `x`、`sx`、`mx` 是 raw。日历和年度卡用 `x`。
  - `hours` 是 raw。
  - `windows[].used` 是 raw，`usedEq` 是 eq。
- **回填**：首次启动 8 秒后在后台读最近 400 天的日志。每 4MB 让出一次事件循环，只把含关键字的行转成字符串。
  - 本机实测：2.25GB、1350 个文件，用时约 2 秒，事件循环最长卡顿 8ms，峰值内存约 110MB。
  - 汇总结果（约 50KB）存在 globalState，之后只读新增部分。
  - 回填没跑完就关掉 VS Code 的话，下次从头补，不会重复计。
- **额度窗口**：
  - Codex 直接读日志里的 `rate_limits`（primary 是 5 小时，secondary 是每周），basis 记为 `log`。
  - Claude 没有百分比，5 小时窗口按 ccusage 的分块法估算：从块内第一条消息所在的整点起算 5 小时，basis 记为 `estimate`。
  - 每周窗口按 `gucode.weeklyReset`（如 `"Thu 08:00"`）计算，不填就是滚动 7 天。
  - 在 `gucode.limits` 里填了 `{ claude5h, claudeWeek }` 才算百分比。
- **工具归类**：Edit / Write / MultiEdit / NotebookEdit / apply_patch 记为 edit，Bash / shell 记为 bash，Read / Grep / Glob / LS 记为 read，WebSearch / WebFetch 记为 web，Task / Agent 记为 task，其余记为 other。Codex、Gemini 等的同类工具名（如 `exec_command`、`read_file`）也归到对应类。
  - 目前能取到工具名的有 Claude、Codex、Gemini、Qwen、Copilot、ZCode。
  - 整体重写的 JSON 类（Cline 等）不统计工具。
- **快照类**：整体重写的 JSON 文件在回填时，按文件的最后修改日期整份归属，是近似值；实时增量按发生时刻归属。

## 隐私

- 只记数字、模型名和工具名，不记对话内容、文件内容、命令参数、路径以外的任何文本。
- 文本格式一律用 `indexOf` 和正则截取数字字段，不 `JSON.parse` 会话正文。sqlite 用 `json_extract` 只取数字列。
- 解析用到的文本读完即丢，正则截出来的 id 和名字会拷贝成独立字符串再存，原文所在的内存块随即释放。
- 插件不联网。本地桥只监听 127.0.0.1；桥接文件里只有来源名和累计数字。

## 如何适配一个新 CLI

1. **先查清格式**：日志在哪（三个系统的路径、环境变量）、是追加写还是整体重写、token 字段叫什么、输入是否含缓存、会不会重复写同一条。依据要来自官方文档、源码或可靠的二手资料（如 ccusage、tokscale 的源码），不要猜。
2. **在 `vscode-ext/adapters.js` 的 `ADAPTERS` 里加一个对象**：

   ```js
   {
     id: 'mycli', label: 'MyCLI', kind: 'jsonl', depth: 3, needles: ['"usage"'],
     note: '一句话写清字段和换算',
     roots: (env, sys) => [{ dir: path.join(env.MYCLI_HOME || path.join(sys.home, '.mycli'), 'sessions'), tag: '' }],
     match: p => p.endsWith('.jsonl'),          // p 已统一成 / 分隔
     parse(line, st) {                          // 每行调用一次；返回 { n: eq, x: raw, ts, model, tools }
       const u = line.indexOf('"usage":{'); if (u < 0) return null;
       const s = line.slice(u, u + 400), i = num(s, 'input'), c = num(s, 'cached'), o = num(s, 'output');   // 假设 input 已含 cached
       return { n: i - c + CR * c + o, x: i + o, ts: tsOf(line), model: str(line, 'model') };
     },
   }
   ```

   - 每条记录给两个数：`n` 是 eq（缓存读取 × 0.1，常量 `CR`），`x` 是 raw。没有缓存字段时只返回 `n`，引擎会让 `x = n`。
   - `kind` 有四种：`jsonl` 和 `md` 逐行增量读，返回本行新增；`json` 是整份文本，返回该文件的累计值，引擎会做差；`sqlite` 是只读连接，返回 `[{ id, n, ts, model, tools }]`，引擎按 id 做差。
   - 同一条消息会被多次写入的，用 `bump(st.shared, id, n)` 只计增量。
   - 启动预读时 `st.prime` 为真：只更新去重表和累计值，返回 null。
   - 工具只取名字，不碰参数。
3. **在 `tools/fixtures/home/` 下按真实目录结构放一个合成样例**：数字随便编，不能有真实正文；时间写成 `__TS__`。然后在 `tools/fixtures/expected.json` 里写上按口径手算的期望值。
4. **跑 `node tools/verify-tokens.mjs --unit`**：历史回填和实时两种模式都要对上期望值。
5. **补文档**：在本文的支持矩阵里加一行；在 `vscode-ext/package.json` 的 `gucode.extraRoots` 枚举里加上新 id。

## 验证

```sh
node tools/verify-tokens.mjs            # 单测 + 实测 60 秒：mock vscode 真跑插件，和按时间戳的独立核算比对，子 agent 单独拆出
node tools/verify-tokens.mjs --ledger   # 加跑：400 天回填计时、事件循环卡顿、随机 3 天和独立核算比对
```

实测两种口径都核对。

日志里的时间戳是消息开始的时刻，整行要等这一块输出完才写入，大消息会晚几十秒。所以：

- 插件计数在窗口结束时冻结；
- 再等 60 秒（`--grace`），让「时间戳在窗口内、但还没写完」的消息落盘，然后才按时间戳核算；
- 等待期间插件继续读，用来把两端的边界量单独拆出来：
  - **开头量**：启动后才写入、但时间戳早于窗口起点的消息。插件计了，核算不计。
  - **结尾量**：时间戳在窗口内、窗口结束后才写完的消息。核算计了，插件不计。

验收看两个数：

- 插件数和核算数的直接差异应在 ±15% 以内。
- 扣掉两端边界量之后的差异应在 ±2% 以内。这一项验证解析、去重和子 agent 归属是对的。

单条子 agent 消息动辄上万 token，60 秒里只有十来条，所以直接差异的波动主要来自边界量，拉长实测时间可以缩小。另外按消息逐条比对过：近 20 分钟的 10 个文件、3536 条消息、约 10 亿 raw token，插件解析和独立核算逐条完全一致。
