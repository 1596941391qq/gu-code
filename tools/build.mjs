// node tools/build.mjs —— 把 src/*.js（ES modules）拼成一个普通脚本 gucode.js，
// 这样 index.html 双击 file:// 也能跑（浏览器不允许 file:// 加载 module）。同时同步到 vscode-ext/media/。
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// fx 放在 meta 前（蛊茧、宝箱删掉后已无重名）
const order = ['core', 'battle', 'art', 'qr', 'tokens', 'card', 'fx', 'meta', 'tutorial', 'ledger', 'ui'];
let out = '/* 蛊码 GuCode —— 由 tools/build.mjs 从 src/ 生成，请改 src/ 再构建 */\n(() => {\n"use strict";\n';
for (const n of order) {
  const s = fs.readFileSync(path.join(root, 'src', n + '.js'), 'utf8')
    .replace(/^import .*$/gm, '').replace(/^export (?=(const|function|class|let|async))/gm, '');
  out += `// ---- src/${n}.js\n${s}\n`;
}
out += '})();\n';
fs.writeFileSync(path.join(root, 'gucode.js'), out);
for (const f of ['gucode.js', 'style.css']) fs.copyFileSync(path.join(root, f), path.join(root, 'vscode-ext', 'media', f));
console.log('built gucode.js', (out.length / 1024).toFixed(1) + 'KB → also vscode-ext/media/');
