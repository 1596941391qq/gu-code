#!/bin/sh
# 构建并把插件复制进本机 VS Code（不打 vsix）。装完在 VS Code 里执行 "Developer: Reload Window"。
set -e
cd "$(dirname "$0")/.."
node tools/build.mjs
DEST="$HOME/.vscode/extensions/hacking.gu-code-0.1.0"
rm -rf "$DEST"; mkdir -p "$DEST"; cp -R vscode-ext/. "$DEST/"
node -e '
const fs=require("fs"),p=process.env.HOME+"/.vscode/extensions/extensions.json",d=process.env.HOME+"/.vscode/extensions/hacking.gu-code-0.1.0";
let a=[];try{a=JSON.parse(fs.readFileSync(p,"utf8"))}catch(e){}
if(!fs.existsSync(p+".bak-gucode"))fs.writeFileSync(p+".bak-gucode",JSON.stringify(a));
a=a.filter(x=>x.identifier.id!=="hacking.gu-code");
a.push({identifier:{id:"hacking.gu-code"},version:"0.1.0",location:{$mid:1,fsPath:d,external:"file://"+d,path:d,scheme:"file"},relativeLocation:"hacking.gu-code-0.1.0",metadata:{isApplicationScoped:false,isMachineScoped:false,isBuiltin:false,installedTimestamp:Date.now(),pinned:true,source:"vsix"}});
fs.writeFileSync(p,JSON.stringify(a));console.log("registered in extensions.json ("+a.length+" entries)");'
echo "installed → $DEST"
