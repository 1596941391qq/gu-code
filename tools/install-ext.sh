#!/bin/sh
# 构建并把插件复制进本机 VS Code（不打 vsix）。首次安装需要 "Developer: Reload Window"；之后再装，正在运行的插件会自动热更新游戏。
set -e
cd "$(dirname "$0")/.."
node tools/build.mjs
DEST="$HOME/.vscode/extensions/hacking.gu-code-0.1.0"
mkdir -p "$DEST"; rsync -a --delete vscode-ext/ "$DEST/"   # 就地覆盖：插件在运行时会自动热更新游戏
node -e '
const fs=require("fs"),p=process.env.HOME+"/.vscode/extensions/extensions.json",d=process.env.HOME+"/.vscode/extensions/hacking.gu-code-0.1.0";
let a=[];try{a=JSON.parse(fs.readFileSync(p,"utf8"))}catch(e){}
if(!fs.existsSync(p+".bak-gucode"))fs.writeFileSync(p+".bak-gucode",JSON.stringify(a));
a=a.filter(x=>x.identifier.id!=="hacking.gu-code");
a.push({identifier:{id:"hacking.gu-code"},version:"0.1.0",location:{$mid:1,fsPath:d,external:"file://"+d,path:d,scheme:"file"},relativeLocation:"hacking.gu-code-0.1.0",metadata:{isApplicationScoped:false,isMachineScoped:false,isBuiltin:false,installedTimestamp:Date.now(),pinned:true,source:"vsix"}});
fs.writeFileSync(p,JSON.stringify(a));console.log("registered in extensions.json ("+a.length+" entries)");'
echo "installed → $DEST"
