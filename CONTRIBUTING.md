# 一起养蛊

蛊码完全开源（MIT），欢迎任何形式的贡献：新蛊种、新杀招、平衡调整、美术、音效、翻译、修 bug、提想法都行。没写过代码也可以，直接开 issue 说你想要什么蛊。

> English is welcome too. Open an issue or PR in either language.

## 最快的参与方式

- **提想法**：开一个 issue，选「新蛊 / 杀招 / 玩法点子」模板，写清楚它干什么就行，数值可以不填。
- **报 bug**：选「bug」模板，附上浏览器或 VS Code 版本，能截图最好。
- **聊天**：到 Discussions 晒阵容、贴战帖链接、吵平衡。

## 改代码

项目是纯静态网页，零依赖，只需要 Node 18+。

```sh
git clone https://github.com/1596941391qq/gu-code && cd gu-code
node tools/build.mjs     # 把 src/ 打包成 gucode.js，同步到 vscode-ext/media/
open index.html          # 直接双击也能玩
node tools/sim.mjs       # 平衡模拟：上千场对战、杀招胜率、编解码自检
```

代码在 `src/` 里，`gucode.js` 是打包产物，**请改 `src/` 再跑 build**，并把打包结果一起提交（CI 会检查两者一致）。

| 想加什么 | 改哪里 |
|---|---|
| 新蛊种 | `src/core.js` 的 `SPECIES`，再在 `src/art.js` 给它画一只水墨虫 |
| 新杀招 | `src/core.js` 的 `COMBOS`，效果写在 `src/battle.js` |
| 新词条 / 怪癖 | `src/core.js` 的 `TRAITS` / `QUIRKS` |
| 界面 / 动画 | `src/ui.js`、`style.css` |
| 分享卡 | `src/card.js` |
| VS Code 插件 | `vscode-ext/extension.js` |

## 几条约定

1. **战斗必须确定**：同样的阵容和种子，打出来的结果必须一模一样，否则战帖链接和复盘链接会失效。随机数一律用 `makeRng(seed)`，不要用 `Math.random()`。
2. **坐标码向后兼容**：别人分享出去的旧链接要一直能打开。改编码格式时保留旧格式的解码。
3. **平衡跑 sim**：加了蛊种或杀招，PR 里贴一下 `node tools/sim.mjs` 的结果。杀招同阶胜率大致落在 45%–70% 之间就好。
4. **画风**：水墨、宣纸、朱印。尽量别用渐变和发光。
5. **隐私**：插件只读会话记录里的 token 用量数字，不读对话内容，也不联网。涉及这部分的改动请特别说明。

PR 不用写得很正式，说清楚改了什么、为什么就行。小改动直接提，大改动先开个 issue 聊一下方向，免得白做。

谢谢你来一起养蛊。
