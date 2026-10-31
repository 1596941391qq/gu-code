// PW=<playwright 路径> node tools/qrverify.mjs —— 在浏览器里生成真实分享卡，存成 shots/card-qr.png，
// 再用 macOS 自带 CoreImage 的 QR 识别（与 iPhone 相机同源）解码，核对是否等于战帖链接。
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), out = path.join(root, 'shots', 'card-qr.png');
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto('file://' + path.join(root, 'index.html')); await p.waitForTimeout(400);
await p.click('.starter >> nth=0'); await p.click('[data-act=share]'); await p.waitForFunction(() => document.querySelector('#cardImg')?.src?.startsWith('data:'));
const src = await p.getAttribute('#cardImg', 'src'), code = await p.textContent('#codeTxt'); await b.close();
fs.writeFileSync(out, Buffer.from(src.split(',')[1], 'base64'));
const js = `ObjC.import('CoreImage');function run(a){const i=$.CIImage.imageWithContentsOfURL($.NSURL.fileURLWithPath(a[0]));const d=$.CIDetector.detectorOfTypeContextOptions($.CIDetectorTypeQRCode,$(),$({CIDetectorAccuracy:$.CIDetectorAccuracyHigh}));const f=d.featuresInImage(i);return f.count?ObjC.unwrap(f.objectAtIndex(0).messageString):'(none)'}`;
const tmp = path.join(root, 'shots', '.qrdecode.js'); fs.writeFileSync(tmp, js);
const got = execFileSync('osascript', ['-l', 'JavaScript', tmp, out]).toString().trim(); fs.unlinkSync(tmp);
const want = 'https://1596941391qq.github.io/gu-code/#c=' + code;
console.log('decoded:', got); console.log(got === want ? 'QR OK：解码结果与战帖链接一致' : 'QR MISMATCH，期望 ' + want);
