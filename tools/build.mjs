// node tools/build.mjs —— 把 src/*.js（ES modules）拼成一个普通脚本 gucode.js，
// 这样 index.html 双击 file:// 也能跑（浏览器不允许 file:// 加载 module）。同时同步到 vscode-ext/media/。
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 数据文件（daos / foods / timeline）在 core 前；hooks 是洞府与秘境的接口登记表；trip / trip-ui 由秘境一侧提供，文件不在时跳过
const order = ['bestiary', 'bestiary2', 'combos2', 'daos', 'foods', 'timeline', 'core', 'battle', 'art2', 'art', 'qr', 'tokens', 'card', 'fx', 'combo-fx', 'battle-view', 'meta', 'hooks', 'ledger', 'trip', 'trip-ui', 'ui'];
const OPTIONAL = new Set(['trip', 'trip-ui', 'combo-fx', 'battle-view']);   // combo-fx / battle-view 由特效、战斗画面一侧提供，没合进来时跳过
// 这些文件的顶层小工具名与别的文件重复（如 art2 与 art 的 INK/aE），整个包进一层函数，只把 export 的名字放出来
const WRAP = new Set(['bestiary', 'bestiary2', 'combos2', 'daos', 'art2', 'battle', 'combo-fx', 'battle-view']);
let out = '/* 蛊码 GuCode —— 由 tools/build.mjs 从 src/ 生成，请改 src/ 再构建 */\n(() => {\n"use strict";\n';
for (const n of order) {
  if (OPTIONAL.has(n) && !fs.existsSync(path.join(root, 'src', n + '.js'))) continue;
  const raw = fs.readFileSync(path.join(root, 'src', n + '.js'), 'utf8');
  const s = raw.replace(/^import\b[\s\S]*?['"][^'"\n]+['"];?[^\n]*$/gm, '')   // 去掉 import（含跨多行的 import { … } from '…'）
   .replace(/^export (?=(const|function|class|let|async))/gm, '');
  if (WRAP.has(n)) {
    const names = [...raw.matchAll(/^export (?:const|let|class|function|async function)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
    out += `// ---- src/${n}.js（包一层，只放出 export）\nconst { ${names.join(', ')} } = (() => {\n${s}\nreturn { ${names.join(', ')} };\n})();\n`;
  } else out += `// ---- src/${n}.js\n${s}\n`;
}
out += '})();\n';
fs.writeFileSync(path.join(root, 'gucode.js'), out);
for (const f of ['gucode.js', 'style.css']) fs.copyFileSync(path.join(root, f), path.join(root, 'vscode-ext', 'media', f));
console.log('built gucode.js', (out.length / 1024).toFixed(1) + 'KB → also vscode-ext/media/');
