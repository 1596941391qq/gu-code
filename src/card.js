// 蛊码 GuCode · 分享卡（canvas → PNG）
import { SP, TRAITS, REALMS, skillOf, fmtTok } from './core.js';
import { guSVG } from './art.js';
import { qrDraw } from './qr.js';

const KAI = '"Kaiti SC","STKaiti","KaiTi","BiauKai",serif';
const SANS = '-apple-system,"PingFang SC","Microsoft YaHei",system-ui,sans-serif';
function loadImg(src) { return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
function seal(ctx, x, y, text, size, rot = -0.05) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const chars = [...text], fs = size, w = fs * 1.25, h = fs * chars.length + fs * 0.4;
  ctx.fillStyle = '#b5301f'; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = 'rgba(239,231,212,.85)'; ctx.lineWidth = 2; ctx.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
  ctx.fillStyle = '#f3ead6'; ctx.font = `${fs}px ${KAI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  chars.forEach((c, i) => ctx.fillText(c, 0, -h / 2 + fs * 0.7 + i * fs));
  ctx.restore();
}
export async function makeCard({ team, name, realm, total, muts, wins, code, url, endless }) {
  const W = 1080, H = 376 + team.length * 166 + 380, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#17140f'; ctx.fillRect(0, 0, W, H);
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2200; i++) { ctx.strokeStyle = `rgba(233,224,204,${0.015 + rnd() * 0.03})`; ctx.lineWidth = 0.6 + rnd(); const x = rnd() * W, y = rnd() * H, a = rnd() * 6.28, l = 6 + rnd() * 30; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + rnd() * 6, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(233,224,204,.22)'; ctx.lineWidth = 2; ctx.strokeRect(40, 40, W - 80, H - 80); ctx.lineWidth = 1; ctx.strokeRect(52, 52, W - 104, H - 104);
  ctx.fillStyle = '#ece3cf'; ctx.font = `128px ${KAI}`; ctx.textBaseline = 'alphabetic'; ctx.fillText('蛊码', 92, 200);
  ctx.fillStyle = 'rgba(236,227,207,.6)'; ctx.font = `34px ${KAI}`; ctx.fillText('烧 Token · 养蛊 · 斗道', 98, 256);
  seal(ctx, 930, 170, REALMS[realm] || '凡人', 64, 0.06);
  if (endless) { ctx.save(); ctx.fillStyle = '#d8553f'; ctx.font = `30px ${KAI}`; ctx.textAlign = 'center'; ctx.fillText(`无尽 ${endless} 层`, 930, 300); ctx.restore(); }
  ctx.fillStyle = '#ece3cf'; ctx.font = `44px ${KAI}`; ctx.fillText(`${name || '无名蛊师'} 的空窍`, 92, 340);
  const imgs = await Promise.all(team.map(g => loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(guSVG(g.sp, { standalone: true, size: 300 })))));
  let y = 376; const skills = [];
  team.forEach((g, i) => {
    const sk = skillOf(g); if (sk) skills.push(sk.n);
    ctx.fillStyle = '#e6dcc6'; ctx.fillRect(84, y, W - 168, 150);
    ctx.fillStyle = 'rgba(28,25,21,.06)'; for (let k = 0; k < 40; k++) ctx.fillRect(84 + rnd() * (W - 180), y + rnd() * 146, 1 + rnd() * 30, 1);
    if (imgs[i]) ctx.drawImage(imgs[i], 96, y + 2, 146, 146);
    ctx.fillStyle = '#1c1915'; ctx.font = `48px ${KAI}`; ctx.fillText(SP[g.sp].n, 262, y + 62);
    ctx.font = `600 34px ${SANS}`; ctx.fillStyle = '#7a2a1c'; ctx.fillText(`攻 ${g.atk}`, 262, y + 112); ctx.fillStyle = '#2f4a40'; ctx.fillText(`血 ${g.hp}`, 392, y + 112);
    let tw = 0; if (sk) { ctx.font = `30px ${KAI}`; tw = ctx.measureText(sk.n).width + 28; }
    ctx.fillStyle = '#3a342c'; ctx.font = `30px ${KAI}`;
    ctx.fillText(g.tr.map(([id, v]) => TRAITS[id].n + (v > 1 ? v : '')).join(' · ') + (g.q.length ? '  癖' + g.q.length : ''), 520, y + 62, W - 140 - tw - 520);
    ctx.font = `26px ${SANS}`; ctx.fillStyle = '#6b6254'; ctx.fillText(`喂 ${fmtTok(g.fed)} · 变 ${g.mut || 0}${g.att.length ? ' · 附 ' + g.att.map(a => SP[a].ab).join('') : ''}`, 520, y + 112);
    if (sk) { ctx.save(); ctx.font = `30px ${KAI}`; ctx.fillStyle = sk.named ? '#b5301f' : '#5a5246'; ctx.fillRect(W - 112 - tw, y + 14, tw, 46); ctx.fillStyle = '#f3ead6'; ctx.fillText(sk.n, W - 98 - tw, y + 47); ctx.restore(); }
    y += 166;
  });
  y += 30;
  const LW = W - 92 - 330;
  ctx.fillStyle = 'rgba(236,227,207,.85)'; ctx.font = `32px ${KAI}`;
  ctx.fillText(`算力履历　累计喂养 ${fmtTok(total)} Token`, 92, y, LW);
  ctx.fillText(`突变 ${muts || 0} 次 · 胜 ${wins || 0} · ${REALMS[realm] || '凡人'}${endless ? ` · 无尽劫第 ${endless} 层` : ''}`, 92, y + 46, LW);
  if (skills.length) { ctx.fillStyle = '#d8553f'; ctx.fillText('杀招 ' + skills.map(n => '【' + n + '】').join(''), 92, y + 96, LW); }
  ctx.fillStyle = 'rgba(236,227,207,.55)'; ctx.font = `24px ${SANS}`; ctx.fillText('界壁坐标码 · 扫码或粘贴即可应战', 92, y + 150, LW);
  ctx.fillStyle = '#6fb7a4'; ctx.font = `24px ui-monospace,Menlo,monospace`;
  const per = 34; for (let i = 0; i * per < code.length && i < 3; i++) ctx.fillText(code.slice(i * per, (i + 1) * per), 92, y + 188 + i * 32, LW);
  if (url) {
    const qs = 264, qx = W - 92 - qs, qy = y - 40;
    if (qrDraw(ctx, url, qx, qy, qs)) { ctx.fillStyle = 'rgba(236,227,207,.7)'; ctx.font = `26px ${KAI}`; ctx.textAlign = 'center'; ctx.fillText('扫码应战', qx + qs / 2, qy + qs + 36); ctx.textAlign = 'left'; }
  }
  return cv.toDataURL('image/png');
}
