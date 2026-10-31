// 蛊码 GuCode · 战斗画面：斜俯视的 6×3 阵盘、出手顺序条、出手预告、弹道、伤害数字、主动技大字、杀招动画、结算页。
// 只读 battle() 的结果（log + roster + units）重放，不改任何战斗数据。对外：playBattle(el, result, opts) → Promise（结算页点「继续」才 resolve）
import { guSVG, ART_DEFS } from './art.js';
import { TRAITS, XING } from './core.js';
import { FOOD } from './foods.js';
import { DAO } from './daos.js';
import { playCombo } from './combo-fx.js';
import { skillText, TUNE } from './battle.js';
import { ST_NAME, ST_COLOR, GL, glossHTML, glossNote, glossTable } from './gloss.js';

const CSS = `
.gbv{--a:var(--qing,#6fb7a4);--b:var(--zhu2,#d8553f);--pp:var(--paper,#e7ddc7);--ik:var(--ink,#1c1915);position:relative;user-select:none;-webkit-user-select:none;color:var(--tx,#ddd3bf);font:13px/1.4 var(--sans,system-ui)}
.gbv-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 6px}
.gbv-tt{font:16px/1.2 var(--kai,serif);letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gbv-tt small{font:12px var(--sans,system-ui);color:var(--mu,#8f8775);margin-left:6px;letter-spacing:0}
.gbv-ctl{display:flex;gap:4px;flex:0 0 auto}
.gbv-ctl button{min-width:34px;height:26px;padding:0 8px;border:1px solid var(--line2,rgba(233,224,204,.32));border-radius:3px;font:12px/24px var(--sans,system-ui);color:var(--tx,#ddd3bf);background:transparent;cursor:pointer}
.gbv-ctl button.on{background:var(--tx,#ddd3bf);color:var(--bg,#15130f);border-color:transparent}
.gbv-ctl .gbv-glb{font-family:var(--kai,serif);font-size:13px;padding:0 7px}
.gbv-gl{position:absolute;left:0;right:0;top:34px;bottom:0;z-index:60;overflow:auto;-webkit-overflow-scrolling:touch;padding:10px 12px 16px;background:var(--pp);color:var(--ik);border-radius:2px;box-shadow:0 8px 24px rgba(0,0,0,.45);user-select:text;-webkit-user-select:text}
.gbv-glh{position:sticky;top:-10px;display:flex;align-items:center;gap:8px;margin:-10px -12px 4px;padding:8px 12px;background:var(--pp);border-bottom:1px solid rgba(40,32,24,.2);z-index:1}
.gbv-glh b{font:16px var(--kai,serif)}.gbv-glh small{color:#6b6150;font-size:12px}
.gbv-glh .gbv-glx{margin-left:auto;height:28px;padding:0 10px;border:1px solid rgba(40,32,24,.35);border-radius:3px;background:transparent;color:var(--ik);font:13px var(--kai,serif);cursor:pointer}
.gbv-gl .glossary h5{color:var(--ik)}.gbv-gl .sm{color:#4a4236;font-size:12.5px;line-height:1.55;margin:4px 0}.gbv-gl .gltab li{border-bottom-color:rgba(40,32,24,.18)}.gbv-gl .glk{color:#6b6150}.gbv-gl .glk.gl-debuff{color:#a82a1b}.gbv-gl .glk.gl-buff{color:#2c6e5e}
.gbv-tip .glk{color:#6b6150}.gbv-tip .glk.gl-debuff{color:#a82a1b}.gbv-tip .glk.gl-buff{color:#2c6e5e}.gbv-tip .glnote{border-top-color:rgba(40,32,24,.3)}.gbv-tip .glnote i{color:#6b6150}.gbv-tip .glnote .glic{font:11px/14px var(--kai,serif);color:#fbf3e3}
.gbv-ord{position:relative;height:60px;margin:0 0 4px;overflow:hidden;border-bottom:1px solid var(--line,rgba(233,224,204,.14))}
.gbv-ord .gbv-lab{position:absolute;left:0;top:2px;font:10px/1 var(--sans,system-ui);color:var(--mu,#8f8775)}
.gbv-chip{position:absolute;top:25px;width:26px;height:26px;border-radius:50%;background:var(--pp);border:2px solid var(--a);transition:transform .32s cubic-bezier(.3,.7,.3,1),opacity .25s}
.gbv-chip.gbv-sb{border-color:var(--b)}
.gbv-chip svg{width:100%;height:100%;filter:brightness(0);opacity:.82}
.gbv-chip.gbv-sb svg{transform:scaleX(-1)}
.gbv-chip.now{width:32px;height:32px;top:22px;box-shadow:0 0 0 2px var(--bg,#15130f),0 0 0 4px var(--tx,#ddd3bf)}
.gbv-rd{position:absolute;top:29px;font:11px/1 var(--kai,serif);color:var(--mu,#8f8775);border-left:1px solid var(--line2,rgba(233,224,204,.32));padding-left:3px;height:18px;line-height:18px;transition:transform .32s cubic-bezier(.3,.7,.3,1)}
.gbv-syn{min-height:16px;font:11px/16px var(--sans,system-ui);color:var(--mu,#8f8775);display:flex;justify-content:space-between;gap:8px;margin-bottom:2px}
.gbv-syn span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gbv-st{position:relative;overflow:hidden;touch-action:manipulation}
.gbv-cam{position:absolute;inset:0;transform-origin:50% 55%}
.gbv-st.shake{animation:gbvshk .22s linear}
@keyframes gbvshk{20%{transform:translate(-3px,1px)}40%{transform:translate(3px,-2px)}60%{transform:translate(-2px,2px)}80%{transform:translate(2px,-1px)}}
.gbv-floor{position:absolute;left:0;top:0;pointer-events:none}
.gbv-floor .t{fill:var(--bg2,#1e1b16);stroke:var(--line2,rgba(233,224,204,.32));stroke-width:1}
.gbv-floor .t.ta{fill:color-mix(in srgb,var(--a) 9%,var(--bg2,#1e1b16))}
.gbv-floor .t.tb{fill:color-mix(in srgb,var(--b) 9%,var(--bg2,#1e1b16))}
.gbv-floor .t.aim{fill:color-mix(in srgb,var(--b) 42%,var(--bg2,#1e1b16));stroke:var(--b);stroke-width:2}
.gbv-floor .t.aimA{fill:color-mix(in srgb,var(--a) 42%,var(--bg2,#1e1b16));stroke:var(--a);stroke-width:2}
.gbv-floor .t.aim.gold,.gbv-floor .t.aimA.gold{stroke:#d9a441;stroke-width:2.5}
.gbv-floor .gbv-midl{stroke:var(--line2,rgba(233,224,204,.32));stroke-dasharray:3 4}
.gbv-u{position:absolute;transform:translate(-50%,-100%);transition:left .24s ease,top .24s ease,opacity .3s;pointer-events:auto;cursor:pointer}
.gbv-tok{position:relative;margin:0 auto;background:var(--pp);border-radius:40% 40% 10px 10px;box-shadow:0 2px 0 var(--shadow,rgba(0,0,0,.45));border-bottom:3px solid var(--a);transition:filter .08s,transform .12s}
.gbv-u.gbv-sb .gbv-tok{border-bottom-color:var(--b)}
.gbv-tok svg{display:block;width:100%;height:100%}
.gbv-u.gbv-sb .gbv-tok svg{transform:scaleX(-1)}
.gbv-u.now .gbv-tok{box-shadow:0 0 0 2px var(--tx,#ddd3bf)}
.gbv-u.flash .gbv-tok{filter:brightness(2.4) saturate(0)}
.gbv.calm .gbv-u.flash .gbv-tok{filter:none;opacity:.6}
.gbv-u.die{opacity:0;transform:translate(-50%,-80%) scale(.9);transition:opacity .5s,transform .5s}
.gbv-u.die .gbv-tok{filter:grayscale(1)}
.gbv-u.summon{animation:gbvpop .3s ease}
.gbv-u.rise{animation:gbvrise .7s ease both}
@keyframes gbvrise{0%{transform:translate(-50%,-100%) rotate(80deg) scale(.85);opacity:.3;filter:grayscale(1)}60%{transform:translate(-50%,-112%) rotate(-6deg)}100%{transform:translate(-50%,-100%);opacity:1}}
@keyframes gbvpop{from{transform:translate(-50%,-100%) scale(.3);opacity:0}}
.gbv-bar{height:4px;margin:2px auto 0;background:rgba(0,0,0,.45);border-radius:2px;overflow:hidden;position:relative}
.gbv-bar i{position:absolute;left:0;top:0;bottom:0;background:#4f9a6a;transition:width .25s}
.gbv-bar i.gbv-shi{background:#cfd8e0;opacity:.85}
.gbv-bar.lo i.gbv-hpi{background:#c65a3a}
.gbv-gp{height:3px;margin:1px auto 0;background:rgba(0,0,0,.4);border-radius:2px;overflow:hidden}
.gbv-gp i{display:block;height:100%;background:#d9a441;transition:width .25s}
.gbv-gp.full i{background:#f2c35a;box-shadow:0 0 4px #f2c35a}
.gbv-fl{position:absolute;pointer-events:none;transform:translate(-50%,-50%);font:700 15px/1 var(--sans,system-ui);color:var(--float,#f0e6d0);text-shadow:0 1px 0 var(--fshadow,#000),0 0 3px var(--fshadow,#000);white-space:nowrap;animation:gbvfl .9s ease-out forwards;z-index:30}
.gbv-fl.crit{font-size:22px;color:#f2c35a}.gbv-fl.heal{color:#7ed29a}.gbv-fl.psn{color:#9bd06a}.gbv-fl.burn{color:#f0915a}.gbv-fl.tag{font:12px/1 var(--kai,serif);color:var(--float,#f0e6d0)}.gbv-fl.blk{color:var(--blk,#8fb0d0);font-size:12px}
@keyframes gbvfl{0%{opacity:0;transform:translate(-50%,-30%) scale(.8)}15%{opacity:1;transform:translate(-50%,-70%) scale(1.08)}70%{opacity:1}100%{opacity:0;transform:translate(-50%,-160%)}}
.gbv-ban{position:absolute;left:0;right:0;top:30%;text-align:center;pointer-events:none;z-index:40;font:700 34px/1.1 var(--kai,serif);letter-spacing:.12em;color:var(--strong,#eee5d1);text-shadow:0 2px 0 var(--fshadow,#000)}
.gbv-ban span{display:inline-block;opacity:0;animation:gbvban .5s ease forwards}
.gbv-ban small{display:block;font:12px var(--sans,system-ui);letter-spacing:0;color:var(--mu,#8f8775);margin-top:6px;opacity:0;animation:gbvban .4s .3s forwards}
@keyframes gbvban{0%{opacity:0;transform:translateY(8px) scale(1.25);filter:blur(3px)}100%{opacity:1;transform:none;filter:none}}
.gbv-fx{position:absolute;left:0;top:0;pointer-events:none;overflow:visible;z-index:25}
.gbv-pj{position:absolute;pointer-events:none;z-index:26;transform:translate(-50%,-50%)}
.gbv-tip{position:absolute;z-index:50;max-width:220px;padding:7px 9px;background:var(--pp);color:var(--ik);border-left:3px solid var(--b);border-radius:2px;box-shadow:0 6px 16px rgba(0,0,0,.35);font:12px/1.5 var(--sans,system-ui);pointer-events:none}
.gbv-tip b{font:14px var(--kai,serif)}
.gbv-res{position:absolute;inset:0;z-index:60;background:var(--bg,#15130f);overflow:auto;padding:4px 2px 12px;animation:gbvin .35s ease}
@keyframes gbvin{from{opacity:0;transform:translateY(10px)}}
.gbv-res h3{margin:4px 0 2px;font:700 30px/1.2 var(--kai,serif);letter-spacing:.2em;text-align:center}
.gbv-res h3.win{color:var(--zhu2,#d8553f)}.gbv-res h3.lose{color:var(--mu,#8f8775)}
.gbv-res .gbv-sub{text-align:center;color:var(--mu,#8f8775);font-size:12px;margin-bottom:10px}
.gbv-mvp{display:flex;align-items:center;gap:10px;margin:0 auto 10px;max-width:360px;padding:8px 10px;background:var(--pp);color:var(--ik);border-radius:3px;border-left:4px solid #d9a441}
.gbv-mvp svg{width:52px;height:52px;flex:0 0 auto}
.gbv-mvp b{font:16px var(--kai,serif)}.gbv-mvp em{font-style:normal;font:11px var(--sans,system-ui);background:#d9a441;color:#1c1915;padding:1px 5px;border-radius:2px;margin-right:6px}
.gbv-tb{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}
.gbv-tb th{font-weight:400;color:var(--mu,#8f8775);text-align:right;padding:2px 4px;border-bottom:1px solid var(--line,rgba(233,224,204,.14))}
.gbv-tb th:first-child,.gbv-tb td:first-child{text-align:left}
.gbv-tb td{padding:3px 4px;text-align:right;font-variant-numeric:tabular-nums;border-bottom:1px solid var(--faint2,rgba(233,224,204,.12))}
.gbv-tb td:first-child{display:flex;align-items:center;gap:6px}
.gbv-tb td svg{width:22px;height:22px;background:var(--pp);border-radius:3px;flex:0 0 auto}
.gbv-tb tr.dead td{color:var(--mu,#8f8775)}.gbv-tb tr.dead svg{filter:grayscale(1);opacity:.6}
.gbv-tb .gbv-side{font:13px var(--kai,serif);color:var(--tx,#ddd3bf);padding-top:8px;text-align:left}
.gbv-fare{margin:6px 0 10px;padding:10px 12px;border:1px solid var(--line2,rgba(233,224,204,.32));border-left:4px solid var(--ik);background:var(--bg2,#1e1b16);border-radius:3px}
.gbv-save{margin:0 auto 10px;max-width:420px;padding:8px 10px;border-left:4px solid #7ed29a;background:var(--bg2,#1e1b16);border-radius:3px;font-size:12px;line-height:1.9}
.gbv-save b{font:15px var(--kai,serif);color:var(--strong,#eee5d1)}
.gbv-save span{display:inline-flex;align-items:center;gap:3px;margin-right:8px}
.gbv-save svg{width:22px;height:22px;background:var(--pp);border-radius:3px}
.gbv-fare .gbv-lead{margin:0 0 6px;font-size:12px;color:var(--mu,#8f8775)}
.gbv-fare small{font-size:11px;color:var(--mu,#8f8775)}
.gbv-fare h4{margin:0 0 6px;font:16px var(--kai,serif);letter-spacing:.1em;color:var(--strong,#eee5d1)}
.gbv-fare .gbv-g{display:flex;align-items:center;gap:10px;margin:6px 0;animation:gbvfare 1.6s ease both}
.gbv-fare .gbv-g svg{width:46px;height:46px;background:var(--pp);border-radius:3px;filter:grayscale(1) contrast(.9);flex:0 0 auto}
.gbv-fare .gbv-g b{font:15px var(--kai,serif)}.gbv-fare .gbv-g p{margin:2px 0 0;font-size:12px;color:var(--mu,#8f8775)}
@keyframes gbvfare{from{opacity:0;filter:blur(2px)}}
.gbv-res .gbv-note{font-size:11px;color:var(--mu,#8f8775);text-align:center;margin:4px 0}
.gbv-res .gbv-go{display:block;margin:10px auto 0;min-width:140px;height:38px;border-radius:3px;background:var(--zhu,#b5301f);color:var(--on-zhu,#f3ead6);font:16px var(--kai,serif);letter-spacing:.3em;cursor:pointer;border:0}
.gbv.narrow .gbv-ic b{font-size:9.5px;line-height:12px;padding:0 1.5px}.gbv.narrow .gbv-ic b em{font-size:8px;line-height:12px;margin-left:1px}
.gbv.narrow .gbv-tok{border-radius:50%}
.gbv.narrow .gbv-tok svg{filter:brightness(0);opacity:.85}
.gbv.calm .gbv-ban span{animation-duration:.2s}
/* ---- 状态：挂上那一下的动画 ---- */
.gbv-sx{position:absolute;transform:translate(-50%,-50%);pointer-events:none;z-index:27;animation:gbvsxo 1.05s linear both}
@keyframes gbvsxo{0%,78%{opacity:1}100%{opacity:0}}
.gbv-sx i,.gbv-sx svg{position:absolute;display:block}
.sx-burn i{left:50%;bottom:4%;width:30%;height:58%;margin-left:-15%;border-radius:50% 50% 45% 45%/64% 64% 36% 36%;background:radial-gradient(ellipse at 50% 78%,#fff3b8 0,#ffb13e 28%,#f0602a 60%,rgba(190,40,15,0) 74%);transform-origin:50% 100%;animation:gbvflame .82s ease-out both}
@keyframes gbvflame{0%{transform:translate(var(--x),30%) scale(.3,.15);opacity:0}22%{opacity:1}58%{transform:translate(var(--x),-28%) scale(1,1.2);opacity:1}100%{transform:translate(var(--x),-80%) scale(.35,.9);opacity:0}}
.sx-burn .gl{inset:8% 0 0;border-radius:40% 40% 10px 10px;background:radial-gradient(ellipse 70% 55% at 50% 100%,rgba(255,120,40,.65),rgba(255,90,30,0) 75%);animation:gbvglow .9s ease-out both}
@keyframes gbvglow{0%{opacity:0}30%{opacity:1}100%{opacity:0}}
.sx-psn i{left:50%;bottom:8%;width:var(--s);height:var(--s);margin-left:calc(var(--s) / -2);border-radius:50%;border:1.5px solid #8fd05a;background:radial-gradient(circle at 35% 35%,rgba(225,255,195,.95) 0 14%,rgba(110,190,60,.5) 42%,rgba(55,115,30,.3));animation:gbvbub2 .92s ease-out both}
@keyframes gbvbub2{0%{transform:translate(var(--x),0) scale(.2);opacity:0}25%{opacity:1}82%{transform:translate(var(--x),var(--y)) scale(1);opacity:1}100%{transform:translate(var(--x),var(--y)) scale(1.6);opacity:0}}
.sx-psn .pf{inset:10%;border-radius:50%;background:radial-gradient(circle,rgba(130,200,70,.55),rgba(90,160,50,0) 70%);animation:gbvpuff .8s ease-out both;width:auto;height:auto;margin:0;border:0}
@keyframes gbvpuff{0%{transform:scale(.3);opacity:0}35%{opacity:1}100%{transform:scale(1.5);opacity:0}}
.sx-chill .fr{inset:0;border-radius:40% 40% 10px 10px;background:radial-gradient(circle,rgba(235,248,255,0) 28%,rgba(190,228,255,.8) 72%,rgba(255,255,255,.95));box-shadow:inset 0 0 10px 3px #fff;animation:gbvfrost .8s ease-out both}
.sx-chill svg{left:-15%;top:-15%;width:130%;height:130%;animation:gbvcrys .85s ease-out both}
@keyframes gbvfrost{0%{transform:scale(1.5);opacity:0}45%{opacity:1;transform:scale(1)}100%{opacity:0}}
@keyframes gbvcrys{0%{transform:scale(.2) rotate(-50deg);opacity:0}40%{opacity:1}100%{transform:scale(1) rotate(0);opacity:0}}
.sx-freeze .ice{inset:-8% -10% -4%;background:linear-gradient(135deg,rgba(235,248,255,.92),rgba(140,195,240,.7) 55%,rgba(225,242,255,.9));border:1.5px solid #f4fbff;clip-path:polygon(8% 0,92% 4%,100% 40%,94% 100%,6% 96%,0 52%);animation:gbvice .9s ease-out both}
@keyframes gbvice{0%{transform:scale(1.4);opacity:0}30%{transform:scale(1);opacity:1}75%{opacity:1}100%{opacity:0;transform:scale(1.04)}}
.sx-grd .dome{inset:-14% -18% -4%;border-radius:50% 50% 30% 30%;border:2px solid #f5de96;background:radial-gradient(ellipse at 50% 22%,rgba(255,248,210,.7),rgba(245,222,150,.12) 70%);box-shadow:0 0 16px rgba(245,222,150,.8);transform-origin:50% 100%;animation:gbvdome .85s cubic-bezier(.2,.8,.3,1.25) both}
@keyframes gbvdome{0%{transform:scale(.25,.05);opacity:0}45%{opacity:1}70%{transform:scale(1.06)}100%{transform:scale(1);opacity:.15}}
.sx-mark svg{left:25%;top:-46%;width:50%;height:50%;animation:gbvmark .7s cubic-bezier(.3,1.5,.5,1) both}
@keyframes gbvmark{0%{transform:translateY(-70%) scale(2.4) rotate(90deg);opacity:0}55%{opacity:1;transform:scale(.88)}100%{transform:none;opacity:1}}
.sx-stun i{left:50%;top:-8%;width:12px;height:12px;margin:-6px;background:#f2c35a;clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);animation:gbvstar .8s ease-out both}
@keyframes gbvstar{0%{transform:translate(0,0) scale(.2) rotate(0);opacity:0}30%{opacity:1}100%{transform:translate(var(--x),var(--y)) scale(1) rotate(180deg);opacity:0}}
.sx-web svg{inset:-10%;width:120%;height:120%;animation:gbvweb .7s ease-out both}
@keyframes gbvweb{0%{transform:translateY(-60%) scale(1.3);opacity:0}50%{opacity:1}100%{transform:none;opacity:.9}}
.sx-seal i{left:50%;top:30%;width:44px;height:26px;margin:-13px -22px;background:#b5301f;color:#fbefdc;font:16px/26px var(--kai,serif);text-align:center;border-radius:3px;animation:gbvstamp .55s cubic-bezier(.3,1.6,.5,1) both}
@keyframes gbvstamp{0%{transform:scale(2.6) rotate(-14deg);opacity:0}100%{transform:rotate(-6deg);opacity:1}}
.sx-dust i{left:50%;bottom:-6%;width:46%;height:22%;margin-left:-23%;border-radius:50%;background:radial-gradient(ellipse,rgba(170,150,120,.7),rgba(170,150,120,0) 70%);animation:gbvdust .6s ease-out both}
@keyframes gbvdust{0%{transform:translateX(var(--x)) scale(.3);opacity:.9}100%{transform:translateX(var(--x)) scale(1.6);opacity:0}}
/* ---- 状态：挂着的时候常驻 ---- */
.gbv-au{position:absolute;left:50%;top:0;transform:translateX(-50%);pointer-events:none}
.gbv-au i{position:absolute;inset:0;display:none;border-radius:40% 40% 10px 10px}
.gbv-u.s-burn .a-burn{display:block;background:radial-gradient(ellipse 75% 45% at 50% 100%,rgba(255,130,40,.55),rgba(255,90,30,0) 72%);box-shadow:0 2px 10px rgba(240,110,40,.55);animation:gbvemb 1.1s ease-in-out infinite alternate}
.gbv-u.s-burn .a-burn::before,.gbv-u.s-burn .a-burn::after{content:'';position:absolute;bottom:14%;width:4px;height:4px;border-radius:50%;background:#ffb255;box-shadow:0 0 4px #ff7a2a;animation:gbvspark 1.5s linear infinite}
.gbv-u.s-burn .a-burn::before{left:26%}.gbv-u.s-burn .a-burn::after{left:68%;animation-delay:.75s}
@keyframes gbvemb{from{opacity:.6}to{opacity:1}}
@keyframes gbvspark{0%{transform:translate(0,0);opacity:0}20%{opacity:1}100%{transform:translate(3px,-26px);opacity:0}}
.gbv-u.s-psn .a-psn{display:block;background:radial-gradient(ellipse at 50% 62%,rgba(120,200,70,.34),rgba(120,200,70,0) 72%);box-shadow:0 0 9px rgba(110,190,60,.6)}
.gbv-u.s-psn .a-psn::after{content:'';position:absolute;left:64%;bottom:26%;width:6px;height:6px;border-radius:50%;border:1.5px solid #8fd05a;animation:gbvbub 1.7s ease-in infinite}
@keyframes gbvbub{0%{transform:translateY(0) scale(.5);opacity:0}30%{opacity:1}100%{transform:translateY(-22px) scale(1.1);opacity:0}}
.gbv-u.s-chill .a-chill{display:block;background:linear-gradient(180deg,rgba(185,225,255,.42),rgba(130,185,240,.24));box-shadow:inset 0 0 9px 2px rgba(235,248,255,.95),0 0 6px rgba(150,205,250,.6)}
.gbv-u.s-grd .a-grd{display:block;inset:-7% -11% -2%;border-radius:50% 50% 30% 30%;border:1.5px solid rgba(245,222,150,.85);background:radial-gradient(ellipse at 50% 22%,rgba(255,245,200,.26),rgba(255,245,200,0) 70%);box-shadow:0 0 8px rgba(245,222,150,.45)}
.gbv-u.s-mark .a-mark{display:block;inset:auto;right:-9px;top:-5px;width:16px;height:16px;border-radius:50%;border:1.5px solid #d8453a;background:radial-gradient(circle,#d8453a 0 2px,rgba(0,0,0,0) 2.5px)}
.gbv-u.s-mark .a-mark::before,.gbv-u.s-mark .a-mark::after{content:'';position:absolute;background:#d8453a}
.gbv-u.s-mark .a-mark::before{left:50%;top:-4px;bottom:-4px;width:1.5px;margin-left:-.75px}
.gbv-u.s-mark .a-mark::after{top:50%;left:-4px;right:-4px;height:1.5px;margin-top:-.75px}
.gbv-u.s-stun .a-stun{display:block;inset:auto;left:15%;right:15%;top:-5px;height:9px;border-radius:50%;border:1.5px dashed #f2c35a;animation:gbvspin 1.1s linear infinite}
@keyframes gbvspin{to{transform:rotate(360deg)}}
.gbv-u.s-web .a-web{display:block;background:repeating-linear-gradient(45deg,rgba(235,232,222,.55) 0 1px,rgba(0,0,0,0) 1px 7px),repeating-linear-gradient(-45deg,rgba(235,232,222,.55) 0 1px,rgba(0,0,0,0) 1px 7px)}
.gbv-u.s-seal .gbv-gp i{background:#8a8070!important;box-shadow:none!important}
.gbv-ic{position:absolute;z-index:2;left:50%;bottom:2px;transform:translateX(-50%);display:flex;flex-wrap:nowrap;justify-content:center;gap:1px;width:100%;overflow:visible;pointer-events:none}
.gbv-ic b{flex:0 0 auto;font:10.5px/13px var(--kai,serif);padding:0 2.5px;border-radius:2px;background:#5a5244;color:#fbf3e3;white-space:nowrap;box-shadow:0 1px 0 rgba(0,0,0,.35)}
.gbv-ic b em{font:600 9px/13px var(--sans,system-ui);font-style:normal;margin-left:1.5px}
.gbv-ic b.more{background:#3a352c;font:600 10px/13px var(--sans,system-ui)}.gbv-ic b.psn,.gbv-ic b.para{background:#3d7a33}.gbv-ic b.burn{background:#c2501f}.gbv-ic b.chill{background:#3d78a8}.gbv-ic b.stun,.gbv-ic b.web{background:#6a5a8a}.gbv-ic b.grd,.gbv-ic b.taunt{background:#8a7434}.gbv-ic b.mark{background:#a3302a}.gbv-ic b.seal{background:#55504a}
/* 状态跳字：灼伤橙红带小火苗、毒绿字带气泡 */
.gbv-fl.stk{font-size:16px;display:flex;align-items:center;gap:2px}
.gbv-fl.stk.burn{color:#ff7a3d}.gbv-fl.stk.psn{color:#8fd05a}
.gbv-fl.stk svg{flex:0 0 auto;filter:drop-shadow(0 1px 0 var(--fshadow,#000))}
/* 联动连线 */
.gbv-lk{animation:gbvlk .75s ease-out forwards}
@keyframes gbvlk{0%{stroke-dashoffset:var(--len);opacity:1}45%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}}
.gbv-lkt{animation:gbvfade .75s ease-out forwards}
.gbv-lkr{animation:gbvlkr .6s ease-out forwards}
@keyframes gbvlkr{from{r:4px;opacity:1}to{r:30px;opacity:0}}
@keyframes gbvfade{0%{opacity:0}25%{opacity:1}100%{opacity:0}}
@keyframes gbvfadein{from{opacity:0}to{opacity:1}}
/* 主动技：蓄势放大描边 + 技能牌（实色，按阵营上色） */
.gbv-u.charge{z-index:40!important}
.gbv-u.charge .gbv-tok{transform:scale(1.16);box-shadow:0 0 0 3px var(--cc),0 0 14px 2px var(--cc)}
.gbv-u.gbv-sa{--cc:#2f8a73}.gbv-u.gbv-sb{--cc:#c23a26}
.gbv-card{position:absolute;top:4px;z-index:46;min-width:120px;max-width:min(260px,72%);padding:5px 10px 6px;border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,.35);pointer-events:none;transform-origin:var(--px,50%) 100%;animation:gbvcard .26s cubic-bezier(.3,1.4,.5,1) both}
.gbv-card.op{background:#b5301f;color:#fff6e6}.gbv-card.me{background:#24735f;color:#f0faf4}
.gbv-card::after{content:'';position:absolute;left:var(--px,50%);bottom:-6px;margin-left:-6px;border:6px solid transparent;border-bottom:0;border-top-color:inherit}
.gbv-card.op::after{border-top-color:#b5301f}.gbv-card.me::after{border-top-color:#24735f}
.gbv-card .c1{font:11px/1.3 var(--sans,system-ui);opacity:.92}
.gbv-card .c2{font:700 19px/1.25 var(--kai,serif);letter-spacing:.08em}
.gbv-card .c3{font:12px/1.4 var(--sans,system-ui);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.gbv-card.lit{box-shadow:0 0 0 2px #f2c35a,0 4px 14px rgba(0,0,0,.4)}
.gbv-card.out{animation:gbvcardo .22s ease forwards}
@keyframes gbvcard{from{transform:translateY(10px) scale(.6);opacity:0}}
@keyframes gbvcardo{to{transform:translateY(-6px);opacity:0}}
.gbv-tether{stroke-width:1.5;stroke-dasharray:3 3;fill:none}
/* 出手顺序条：蛊力满、下一下放主动技 */
.gbv-chip .cv{position:absolute;inset:0;border-radius:50%;overflow:hidden}
.gbv-chip.ult{box-shadow:0 0 0 2px #f2c35a,0 0 8px 2px rgba(242,195,90,.75)}
.gbv-chip .bd{display:none;position:absolute;right:-7px;top:-6px;min-width:15px;height:15px;padding:0 2px;border-radius:3px;background:#f2c35a;color:#1c1915;font:700 10px/15px var(--kai,serif);text-align:center;box-shadow:0 0 0 1px var(--bg,#15130f)}
.gbv-chip.ult .bd{display:block}
/* 战斗记录 */
.gbv-log{height:auto;max-height:112px;min-height:76px;margin-top:6px;padding:4px 8px;overflow-y:auto;font:12.5px/18px var(--sans,system-ui);color:var(--tx,#ddd3bf);white-space:normal;background:var(--bg2,rgba(0,0,0,.12));border:1px solid var(--line,rgba(233,224,204,.14));border-radius:3px;scrollbar-width:thin}
.gbv-ll{padding:1px 0;border-bottom:1px dashed var(--faint2,rgba(233,224,204,.1))}
.gbv-ll.op{color:var(--logop,#e06a52)}.gbv-ll.me{color:var(--logme,#5fb39b)}.gbv-ll.n{color:var(--mu,#8f8775)}
.gbv-ll b{font-weight:700}
.gbv-ll.cb{font-weight:700}
.gbv-tip{max-width:280px}
.gbv-tip .tk{display:block;margin-top:3px}
.gbv-tip .tk i{font-style:normal;font-size:11px;padding:0 4px;margin-right:4px;border-radius:2px;background:var(--ik);color:var(--pp)}
.gbv-tip .tk.lock{opacity:.55}
.gbv-tip .ts{display:block;margin-top:2px}
.gbv-tip .ts b{font:11px/13px var(--kai,serif);padding:0 3px;border-radius:2px;color:#fbf3e3;margin-right:4px}
/* 减弱闪光：挂状态的动画改成淡入淡出，图标和层数照常 */
.gbv.calm .gbv-sx,.gbv.calm .gbv-sx i,.gbv.calm .gbv-sx svg{animation-name:gbvfade!important;transform:none!important}
.gbv.calm .sx-mark svg,.gbv.calm .sx-seal i,.gbv.calm .sx-web svg{animation-name:gbvfadein!important}
.gbv.calm .gbv-au i,.gbv.calm .gbv-au i::before,.gbv.calm .gbv-au i::after{animation:none!important}
.gbv.calm .gbv-lk{animation-name:gbvfade!important;stroke-dashoffset:0!important}
.gbv.calm .gbv-u.charge .gbv-tok{transform:none}
.gbv.calm .gbv-card{animation-name:gbvfadein!important}
:root[data-theme=light] .gbv{--logop:#a92a1a;--logme:#1e6e59}
`;
// 状态名字一律用 gloss.js 的全称（灼烧、中毒、冰寒、格挡……），不用单字简称
const ST_N = { ...ST_NAME, miss: '扑空', swap: '换位', strip: '破甲', tie: '系丝', blitz: '疾袭', luck: '鸿运', hex: '夺志', clean: '清掉减益' };
const CN = ['', '一', '二', '三', '四', '五', '仙'];
const ST_ORDER = ['burn', 'psn', 'para', 'chill', 'stun', 'web', 'grd', 'mark', 'seal', 'taunt'];
const ST_COL = ST_COLOR;   // 图标底色和「状态说明」表同一套（gloss.js）
const stNum = (k, v) => k === 'burn' ? v[1] : v;   // 图标上的数：灼烧 = 还剩几轮，中毒 = 每轮掉多少，其余 = 层数 / 次数 / 轮数
const ST_DESC = {
  burn: v => `还剩 ${v[1]} 轮，每轮烧 ${v[0]}（护体挡不住）`, psn: v => `每轮掉 ${v} 血，不会自己消失（护体挡不住）`, para: v => `每轮掉 ${v} 血`,
  chill: v => `${v} 层，速 -${Math.round(TUNE.chill * 100 * v)}%，叠到 3 层冻住一次；每轮退一层`, stun: v => `跳过接下来 ${v} 次出手`, web: v => `接下来 ${v} 次普攻落空`,
  grd: v => `接下来 ${v} 次挨打伤害减半`, mark: v => `还剩 ${v} 轮，受到的伤害 +25%`, seal: v => `还剩 ${v} 轮，蛊力不涨`, taunt: v => `还剩 ${v} 轮，敌方单体攻击优先打它`,
};
const ST_LOG = { psn: n => `中毒（每轮 ${n}）`, para: n => `寄生（每轮 ${n}）`, burn: n => `灼烧 ${n} 轮`, chill: n => `冰寒 ${n} 层`, freeze: () => '冻住', stun: n => `眩晕 ${n} 次`, web: n => `落网 ${n} 次`, guard: n => `格挡 ${n} 次`, mark: n => `印记 ${n} 轮`, seal: n => `封印 ${n} 轮`, taunt: n => `嘲讽 ${n} 轮` };
const FL_IC = {
  burn: '<svg viewBox="0 0 10 13" width="11" height="14"><path d="M5 0C6 3 9 4.5 9 8.2A4 4 0 0 1 1 8.2C1 6 2.6 4.8 3.2 3.2 3.9 4.6 4.6 5 5 5.2 5.4 3.6 5.6 1.8 5 0Z" fill="#f0602a"/><path d="M5 6.2C5.6 7.4 6.8 8 6.8 9.4A1.8 1.8 0 0 1 3.2 9.4C3.2 8.4 4.2 7.6 5 6.2Z" fill="#ffd36a"/></svg>',
  psn: '<svg viewBox="0 0 12 12" width="12" height="12"><circle cx="4.2" cy="7.4" r="3.1" fill="rgba(120,200,70,.35)" stroke="#8fd05a" stroke-width="1.4"/><circle cx="8.7" cy="3.4" r="2.1" fill="rgba(120,200,70,.35)" stroke="#8fd05a" stroke-width="1.2"/></svg>',
};
const SX_SVG = {
  chill: '<svg viewBox="-20 -20 40 40"><g stroke="#f4fbff" stroke-width="2.6" stroke-linecap="round" fill="none"><path d="M0-16V16M-13.9-8 13.9 8M-13.9 8 13.9-8"/><path d="M-4-12 0-8 4-12M-4 12 0 8 4 12M-12.4-2.5-7-4-8.4-9M12.4 2.5 7 4 8.4 9M-12.4 2.5-7 4-8.4 9M12.4-2.5 7-4 8.4-9"/></g><g stroke="#5f9fd6" stroke-width="1" fill="none"><path d="M0-16V16M-13.9-8 13.9 8M-13.9 8 13.9-8"/></g></svg>',
  mark: '<svg viewBox="-12 -12 24 24"><circle r="8.5" fill="none" stroke="#d8453a" stroke-width="2.2"/><circle r="2.2" fill="#d8453a"/><path d="M0-12V-5M0 5V12M-12 0H-5M5 0H12" stroke="#d8453a" stroke-width="2.2"/></svg>',
  web: '<svg viewBox="-20 -20 40 40"><g stroke="#eeeae0" stroke-width="1.1" fill="none" opacity=".95"><path d="M-18 0H18M0-18V18M-13-13 13 13M-13 13 13-13"/><circle r="5"/><circle r="10"/><circle r="15"/></g></svg>',
};
// trip = 秘境（会死），spar = 斗幽灵、战帖（不死蛊）。没写 mode 时按旧参数猜
const modeOf = o => o.mode === 'trip' || o.mode === 'spar' ? o.mode : (o.perm || o.kind === 'trip' ? 'trip' : 'spar');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function playBattle(el, res, opts = {}) {
  return new Promise(resolve => run(el, res, opts, resolve));
}

async function run(el, res, opts, resolve) {
  if (typeof document === 'undefined') return resolve({ closed: true, skipped: true });
  if (!document.getElementById('gbv-css')) { const st = document.createElement('style'); st.id = 'gbv-css'; st.textContent = CSS; document.head.appendChild(st); }
  if (!document.getElementById('gu-defs')) document.body.insertAdjacentHTML('afterbegin', `<svg id="gu-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${ART_DEFS}</defs></svg>`);
  const R = res.roster, log = res.log, me = opts.mySide === 1 ? 1 : 0, calm = !!opts.reduceMotion;
  const names = opts.names || ['我方', '对方'];
  el.innerHTML = `<div class="gbv${calm ? ' calm' : ''}"><div class="gbv-top"><div class="gbv-tt">${esc(opts.title || '斗蛊')}<small class="gbv-rdl">开战</small></div>
    <div class="gbv-ctl"><button data-s="gl" class="gbv-glb" aria-expanded="false">状态说明</button><button data-s="1" class="on">1×</button><button data-s="2">2×</button><button data-s="skip">跳过</button></div></div>
    <div class="gbv-ord"><span class="gbv-lab">出手顺序</span></div><div class="gbv-syn"><span class="gbv-syna"></span><span class="gbv-synb"></span></div>
    <div class="gbv-st"><div class="gbv-cam"><svg class="gbv-floor"></svg><svg class="gbv-fx"></svg></div></div><div class="gbv-log"></div></div>`;
  const root = el.firstElementChild, outer = root.querySelector('.gbv-st'), stage = root.querySelector('.gbv-cam'), floor = root.querySelector('.gbv-floor'), fxs = root.querySelector('.gbv-fx'), ord = root.querySelector('.gbv-ord'), logEl = root.querySelector('.gbv-log');
  let speed = opts.speed === 2 ? 2 : 1, skip = false, wake = null, paused = false, resume = null, glP = null;
  // 「状态说明」：顶上的按钮打开整张状态表（gloss.js 的 glossTable，和蛊典里那一节同一张），看表时战斗停住，收起接着打
  const glBtn = root.querySelector('.gbv-glb'), goOn = () => { paused = false; if (resume) { const r = resume; resume = null; r(); } };
  const glClose = () => { if (glP) { glP.remove(); glP = null; } glBtn.classList.remove('on'); glBtn.setAttribute('aria-expanded', 'false'); goOn(); };
  const glOpen = () => {
    if (glP) return glClose();
    glP = document.createElement('div'); glP.className = 'gbv-gl';
    glP.innerHTML = `<div class="gbv-glh"><b>状态说明</b><small>战斗暂停中</small><button class="gbv-glx">收起，接着打</button></div>${glossTable()}`;
    glP.querySelector('.gbv-glx').onclick = glClose; glP.addEventListener('click', e => e.stopPropagation());
    root.appendChild(glP); paused = true; glBtn.classList.add('on'); glBtn.setAttribute('aria-expanded', 'true');
  };
  root.querySelectorAll('.gbv-ctl button').forEach(b => b.onclick = () => {
    if (b.dataset.s === 'gl') return glOpen();
    if (b.dataset.s === 'skip') { skip = true; if (glP) glClose(); if (wake) wake(); return; }
    speed = +b.dataset.s; root.querySelectorAll('.gbv-ctl button[data-s="1"],.gbv-ctl button[data-s="2"]').forEach(x => x.classList.toggle('on', x === b));
  });
  const hold = () => paused && !skip ? new Promise(r => { resume = r; }) : undefined;
  const sleep = ms => (skip ? Promise.resolve() : new Promise(r => { const t = setTimeout(() => { wake = null; r(); }, ms / speed); wake = () => { clearTimeout(t); wake = null; r(); }; })).then(hold);

  // ----- 几何：斜俯视 6×3。X = 0..5（A 方后中前 | B 方前中后），r = 0 远 … 2 近 -----
  let G = {};
  const layout = () => {
    const W = Math.max(300, Math.min(760, root.clientWidth || el.clientWidth || 360));
    const cw = Math.min(96, Math.floor((W - 8) / 6.6)), rh = Math.round(cw * 0.66), top = Math.max(cw < 62 ? 96 : 64, Math.round(cw * 1.02)), gap = Math.round(cw * 0.2);
    const sc = r => 0.86 + 0.07 * r, H = top + rh * 3 + Math.round(cw * 0.32);
    G = { W, cw, rh, top, gap, sc, H, narrow: cw < 62 };
    root.classList.toggle('narrow', G.narrow);
    outer.style.height = H + 'px'; floor.setAttribute('width', W); floor.setAttribute('height', H); fxs.setAttribute('width', W); fxs.setAttribute('height', H);
    drawFloor();
    Object.values(U).forEach(place);
  };
  const Xof = (side, c) => side === 0 ? 2 - c : 3 + c;
  const px = (X, r) => G.W / 2 + (X - 2.5) * G.cw * G.sc(r) + (X < 3 ? -G.gap / 2 : G.gap / 2);   // 格子中心 x（随行缩放）
  const py = r => G.top + (r + 0.5) * G.rh;                                                          // 格子中心 y
  const cellXY = (side, r, c) => ({ x: px(Xof(side, c), r), y: py(r) });
  const tilePts = (X, r) => {
    const y0 = G.top + r * G.rh, y1 = y0 + G.rh, s0 = 0.86 + 0.07 * (r - 0.5), s1 = s0 + 0.07, g = X < 3 ? -G.gap / 2 : G.gap / 2;
    const xa = (x, s) => G.W / 2 + (x - 3) * G.cw * s + g, pad = 2;
    return `${xa(X, s0) + pad},${y0 + pad} ${xa(X + 1, s0) - pad},${y0 + pad} ${xa(X + 1, s1) - pad},${y1 - pad} ${xa(X, s1) + pad},${y1 - pad}`;
  };
  function drawFloor() {
    let s = '';
    for (let r = 0; r < 3; r++) for (let X = 0; X < 6; X++) s += `<polygon class="t ${X < 3 ? 'ta' : 'tb'}" data-k="${X}_${r}" points="${tilePts(X, r)}"/>`;
    s += `<line class="gbv-midl" x1="${G.W / 2}" y1="${G.top - 4}" x2="${G.W / 2}" y2="${G.top + 3 * G.rh + 4}"/>`;
    floor.innerHTML = s;
  }

  // ----- 单位 -----
  const U = {};
  function mkUnit(uid) {
    const ro = R[uid]; if (!ro) return null;
    const d = document.createElement('div'); d.className = 'gbv-u ' + (ro.side ? 'gbv-sb' : 'gbv-sa'); d.dataset.uid = uid;
    d.innerHTML = `<div class="gbv-tok">${guSVG(ro.sp, { rank: ro.rank || 1, still: true })}<div class="gbv-ic"></div></div><div class="gbv-au"><i class="a-burn"></i><i class="a-psn"></i><i class="a-chill"></i><i class="a-grd"></i><i class="a-web"></i><i class="a-stun"></i><i class="a-mark"></i></div><div class="gbv-bar"><i class="gbv-hpi"></i><i class="gbv-shi"></i></div>${ro.act ? '<div class="gbv-gp"><i></i></div>' : ''}`;
    stage.appendChild(d);
    const u = { uid, ro, el: d, tok: d.querySelector('.gbv-tok'), hpI: d.querySelector('.gbv-hpi'), shI: d.querySelector('.gbv-shi'), bar: d.querySelector('.gbv-bar'), gpI: d.querySelector('.gbv-gp i'), gpB: d.querySelector('.gbv-gp'), ic: d.querySelector('.gbv-ic'), au: d.querySelector('.gbv-au'), sx: {}, r: 1, c: 0, hp: 1, mx: 1, sh: 0, gp: 0, atk: 0, alive: true };
    d.onmouseenter = () => showTip(u); d.onmouseleave = hideTip; d.onclick = e => { e.stopPropagation(); showTip(u, true); };
    U[uid] = u; return u;
  }
  function place(u) {
    const s = G.sc(u.r), sz = Math.round(Math.min(G.cw * 0.7, G.rh * 1.15) * s), p = cellXY(u.ro.side, u.r, u.c);
    u.el.style.left = p.x + 'px'; u.el.style.top = (p.y + G.rh * 0.36) + 'px'; u.el.style.zIndex = 10 + u.r;
    u.tok.style.width = sz + 'px'; u.tok.style.height = Math.round(sz * (G.narrow ? 1 : 0.94)) + 'px'; u.au.style.width = sz + 'px'; u.au.style.height = u.tok.style.height;
    u.bar.style.width = Math.round(sz * 0.92) + 'px'; if (u.gpB) u.gpB.style.width = Math.round(sz * 0.92) + 'px';
    const iw = Math.round(G.cw * s - 6); if (u.icW !== iw) { u.icW = iw; u.ic.style.width = iw + 'px'; if (u.sx) { u.sxKey = null; setSt(u, u.sx); } }   // 小牌子那一行最宽到格子宽
  }
  const center = u => { const p = cellXY(u.ro.side, u.r, u.c), s = G.sc(u.r); return { x: p.x, y: p.y + G.rh * 0.36 - Math.min(G.cw * 0.7, G.rh * 1.15) * 0.52 * s }; };
  function setBars(u) {
    const tot = Math.max(u.mx, u.hp + u.sh), hw = 100 * Math.max(0, u.hp) / tot, sw = 100 * u.sh / tot;
    u.hpI.style.width = hw + '%'; u.shI.style.left = hw + '%'; u.shI.style.width = sw + '%'; u.bar.classList.toggle('lo', u.hp < u.mx * 0.35);
    if (u.gpI) { const g = Math.min(1, u.gp / (u.ro.gpMax || 100)); u.gpI.style.width = 100 * g + '%'; u.gpB.classList.toggle('full', g >= 1); }
  }
  const tokSz = u => Math.round(Math.min(G.cw * 0.7, G.rh * 1.15) * G.sc(u.r));
  // 身上的状态：快照第 9 项（引擎每个事件都带），图标带层数 + 常驻效果
  function setSt(u, sx) {
    sx = sx || {}; const key = JSON.stringify(sx); if (key === u.sxKey) return; u.sxKey = key; u.sx = sx;
    const L = ST_ORDER.filter(k => sx[k]);   // 小牌子贴在蛊身下沿、只排一行（不往上叠，免得压到身后那只）；这一格放不下的写「+N」，悬停或点按看全部
    u.ic.innerHTML = L.map(k => `<b class="${k}" style="background:${ST_COL[k]}">${ST_NAME[k]}<em>${stNum(k, sx[k])}</em></b>`).join('');
    if (L.length) {
      const max = u.ic.clientWidth, kids = [...u.ic.children], more = 16; let w = 0, n = 0;
      for (let i = 0; i < kids.length; i++) { const kw = kids[i].offsetWidth + (i ? 1 : 0); if (w + kw + (i < kids.length - 1 ? more : 0) > max) break; w += kw; n++; }
      n = Math.max(1, n); if (n < L.length) { kids.slice(n).forEach(x => x.remove()); u.ic.insertAdjacentHTML('beforeend', `<b class="more">+${L.length - n}</b>`); }
    }
    ['burn', 'chill', 'stun', 'web', 'grd', 'mark', 'seal'].forEach(k => u.el.classList.toggle('s-' + k, !!sx[k]));
    u.el.classList.toggle('s-psn', !!(sx.psn || sx.para));
  }
  // 快照：[[uid, 攻, 血, 护体, 蛊力, 速, 行, 列, 状态, 血上限]] × 两方
  function applySnap(s) {
    if (!s) return; const seen = new Set();
    s.forEach(side => side.forEach(([uid, atk, hp, sh, gp, spd, r, c, sx, mx]) => {
      seen.add(uid); let u = U[uid]; if (!u) { u = mkUnit(uid); if (!u) return; u.r = r; u.c = c; place(u); }
      const moved = u.r !== r || u.c !== c; u.atk = atk; u.hp = hp; u.sh = sh; u.gp = gp; u.spd = spd; if (mx) u.mx = mx; if (moved) { u.r = r; u.c = c; place(u); }
      setBars(u); setSt(u, sx);
    }));
    Object.values(U).forEach(u => { if (u.alive && !seen.has(u.uid)) { u.alive = false; u.el.classList.add('die'); } });
  }
  const mxOf = uid => (res.units[uid] && res.units[uid].mxB) || 1;

  // ----- 出手顺序条 -----
  let chips = {};
  function drawOrder(cur, q) {
    const list = (cur ? [cur] : []).concat(q || []).slice(0, G.narrow ? 7 : 10), cnt = {}, keep = {}, x0 = 4, step = G.narrow ? 30 : 34;
    let x = x0;
    list.forEach((id, i) => {
      const k = id[0] === '#' ? id : id + '@' + (cnt[id] = (cnt[id] || 0) + 1);
      let c = chips[k];
      if (!c) {
        c = document.createElement('div');
        if (id[0] === '#') { c.className = 'gbv-rd'; c.textContent = '第' + id.slice(1) + '轮'; }
        else { const ro = R[id] || {}; c.className = 'gbv-chip' + (ro.side ? ' gbv-sb' : ''); c.innerHTML = `<i class="cv">${guSVG(ro.sp || 'pupa', { still: true })}</i><b class="bd">技</b>`; c.title = ro.name || ''; }
        c.style.transform = `translateX(${x + 40}px)`; c.style.opacity = '0'; ord.appendChild(c);
        c.getBoundingClientRect();
      }
      c.classList.toggle('now', i === 0 && !!cur); c.style.opacity = '1'; c.style.transform = `translateX(${x}px)`;
      if (id[0] !== '#') {   // 蛊力满了：下一次出手放主动技，头像加「技」角标和金色光圈，悬停看技能
        const x0 = U[id], ult = cnt[id] === 1 && !!(x0 && x0.alive && x0.ro.act && x0.gp >= (x0.ro.gpMax || 100));
        c.classList.toggle('ult', ult); c.title = ult ? `${x0.ro.name}：蛊力满，下一次出手放「${x0.ro.act.n}」——${actLine(x0)}` : (R[id] || {}).name || '';
      }
      keep[k] = c; x += id[0] === '#' ? 40 : (i === 0 && cur ? step + 8 : step);
    });
    Object.entries(chips).forEach(([k, c]) => { if (!keep[k]) { c.style.opacity = '0'; c.style.transform += ' translateX(-30px)'; setTimeout(() => c.remove(), 320); } });
    chips = keep;
  }

  // ----- 小工具：浮字、提示、弹道 -----
  const float = (u, text, cls = '', dy = 0) => {
    if (!u || skip) return; const p = center(u), f = document.createElement('div'); f.className = 'gbv-fl ' + cls; f.textContent = text;
    f.style.left = p.x + 'px'; f.style.top = (p.y - 6 + dy) + 'px'; stage.appendChild(f); setTimeout(() => f.remove(), 950);
  };
  const floatSt = (u, n, k) => {   // 每轮结算的跳字：灼烧橙红带小火苗，中毒绿字带气泡
    if (!u || skip) return; const p = center(u), f = document.createElement('div'), c = k === 'burn' ? 'burn' : 'psn';
    f.className = 'gbv-fl stk ' + c; f.innerHTML = (k === 'doom' ? '' : FL_IC[c]) + (ST_NAME[k] || '') + ' -' + n;
    f.style.left = p.x + 'px'; f.style.top = (p.y - 2) + 'px'; stage.appendChild(f); setTimeout(() => f.remove(), 950);
  };
  const skOf = u => !u.ro.summon ? skillText(u.ro.sp, u.ro.rank || 1, { st: { atk: u.atk, mx: u.mx } }) : [];
  const actLine = u => { const a = skOf(u).find(x => x.kind === 'active'); return a ? a.text : (u.ro.act && u.ro.act.d) || ''; };
  const KN = { passive: '被动', active: '主动', aw3: '三转', aw5: '五转' };
  function stFx(u, k) {   // 挂上状态的那一下
    if (!u || skip || !u.alive) return; const sz = tokSz(u), p = center(u), d = document.createElement('div'), px = x => Math.round(x * sz) + 'px';
    d.className = 'gbv-sx sx-' + k; d.style.left = p.x + 'px'; d.style.top = p.y + 'px'; d.style.width = sz + 'px'; d.style.height = Math.round(sz * 0.94) + 'px';
    let h = '';
    if (k === 'burn') h = '<i class="gl"></i>' + [-0.3, -0.1, 0.12, 0.3, -0.2, 0.2].map((x, i) => `<i style="--x:${px(x)};animation-delay:${i * 55}ms;height:${50 + (i % 3) * 9}%"></i>`).join('');
    else if (k === 'psn') h = '<i class="pf"></i>' + [[-0.28, -0.55, 0.13], [0.1, -0.7, 0.17], [0.27, -0.45, 0.1], [-0.06, -0.9, 0.11], [-0.22, -0.3, 0.08], [0.2, -0.82, 0.14]].map(([x, y, z], i) => `<i style="--x:${px(x)};--y:${px(y)};--s:${Math.max(5, Math.round(z * sz))}px;animation-delay:${i * 70}ms"></i>`).join('');
    else if (k === 'chill') h = '<i class="fr"></i>' + SX_SVG.chill;
    else if (k === 'freeze') h = '<i class="ice"></i>' + SX_SVG.chill;
    else if (k === 'grd') h = '<i class="dome"></i>';
    else if (k === 'mark') h = SX_SVG.mark;
    else if (k === 'stun') h = [0, 72, 144, 216, 288].map((a, i) => `<i style="--x:${px(Math.cos(a * Math.PI / 180) * 0.5)};--y:${px(Math.sin(a * Math.PI / 180) * 0.25 - 0.1)};animation-delay:${i * 30}ms"></i>`).join('');
    else if (k === 'web') h = SX_SVG.web;
    else if (k === 'seal') h = '<i>封印</i>';
    else if (k === 'dust') h = [-0.25, 0.25].map(x => `<i style="--x:${px(x)}"></i>`).join('');
    else return;
    d.innerHTML = h; stage.appendChild(d); setTimeout(() => d.remove(), 1100);
  }
  function linkFx(a, b, k) {   // 联动：触发者到目标画一道弧线，目标处闪一圈
    if (!a || !b || skip) return; const p = center(a), q = center(b), col = ST_COL[k] || '#d9a441', mx = (p.x + q.x) / 2, my = Math.min(p.y, q.y) - G.cw * 0.6;
    const path = svgEl('path', { d: `M${p.x} ${p.y}Q${mx} ${my} ${q.x} ${q.y}`, fill: 'none', stroke: col, 'stroke-width': 3, 'stroke-linecap': 'round', class: 'gbv-lk' });
    const len = Math.ceil(path.getTotalLength ? path.getTotalLength() : 300); path.style.setProperty('--len', len); path.style.strokeDasharray = len;
    const ring = svgEl('circle', { cx: q.x, cy: q.y, r: 4, fill: 'none', stroke: col, 'stroke-width': 2.5, class: 'gbv-lkr' });
    const tx = svgEl('text', { x: (p.x + 2 * mx + q.x) / 4, y: (p.y + 2 * my + q.y) / 4 + 4, 'text-anchor': 'middle', fill: col, 'font-size': 13, stroke: 'var(--bg,#15130f)', 'stroke-width': 3, 'paint-order': 'stroke', class: 'gbv-lkt' });
    tx.style.fontFamily = 'var(--kai,serif)'; tx.textContent = '联动·' + (ST_NAME[k] || '');
    setTimeout(() => { path.remove(); ring.remove(); tx.remove(); }, 820);
  }
  let tipEl = null;
  function showTip(u, pin) {
    hideTip(); const ro = u.ro, t = document.createElement('div'), sx = u.sx || {}; t.className = 'gbv-tip';
    const sk = skOf(u).filter(x => !x.locked).map(x => `<span class="tk"><i>${KN[x.kind]}</i>${x.kind === 'aw3' || x.kind === 'aw5' ? '' : '「' + esc(x.n) + '」'}${glossHTML(x.text, { tip: false })}</span>`).join('');
    const skTx = skOf(u).filter(x => !x.locked).map(x => x.text).join('；') || (ro.act && ro.act.d) || '', note = glossNote(skTx, 3);
    const st = ST_ORDER.filter(k => sx[k]).map(k => { const by = sx.by && sx.by[k]; const g = GL[k]; return `<span class="ts"><b style="background:${ST_COL[k]}">${ST_NAME[k]} ${stNum(k, sx[k])}</b>${g ? `<i class="glk gl-${g.kind}">${g.kind === 'buff' ? '增益' : '减益'}</i> ` : ''}${ST_DESC[k](sx[k])}${by && R[by] ? ` · ${esc(R[by].name)}挂的` : ''}</span>`; }).join('');
    t.innerHTML = `<b>${esc(ro.name)}</b>${ro.rank ? ` · ${CN[ro.rank]}转` : ''} · ${ro.side === me ? '我方' : '敌方'}<br>攻 ${u.atk} · 血 ${Math.max(0, u.hp)}/${u.mx}${u.sh ? ` · 护体 ${u.sh}` : ''} · 速 ${u.spd || ro.spd}${ro.act ? ` · 蛊力 ${u.gp}/${ro.gpMax || 100}` : ''}`
      + (sk || (ro.act ? `<span class="tk"><i>主动</i>「${esc(ro.act.n)}」${glossHTML(ro.act.d || '', { tip: false })}</span>` : '')) + (ro.combo ? `<span class="tk"><i>杀招</i>「${esc(ro.combo.n)}」</span>` : '') + note + (st ? `<span class="ts" style="margin-top:5px;color:var(--mu)">身上的状态</span>${st}` : '');
    root.appendChild(t); tipEl = t;
    const rb = root.getBoundingClientRect(), ub = u.tok.getBoundingClientRect(), tw = t.offsetWidth, th = t.offsetHeight;
    t.style.left = Math.max(2, Math.min(rb.width - tw - 2, ub.left - rb.left + ub.width / 2 - tw / 2)) + 'px';
    const y = ub.top - rb.top - th - 20; t.style.top = (y >= 0 ? y : ub.bottom - rb.top + 26) + 'px';
  }
  function hideTip() { if (tipEl) { tipEl.remove(); tipEl = null; } }
  root.addEventListener('click', hideTip);
  const shake = () => { if (calm || skip) return; outer.classList.remove('shake'); outer.getBoundingClientRect(); outer.classList.add('shake'); };
  const flash = u => { if (!u) return; u.el.classList.add('flash'); setTimeout(() => u.el.classList.remove('flash'), 110); };
  const aimOn = (cells, gold, friendly) => { cells && cells.forEach(([s, r, c]) => { const t = floor.querySelector(`[data-k="${Xof(s, c)}_${r}"]`); if (t) { t.classList.add(friendly ? 'aimA' : 'aim'); if (gold) t.classList.add('gold'); } }); };
  const aimOff = () => floor.querySelectorAll('.aim,.aimA').forEach(t => t.classList.remove('aim', 'aimA', 'gold'));
  const anim = (node, kf, ms, o = {}) => skip ? Promise.resolve() : new Promise(r => { const a = node.animate(kf, { duration: ms / speed, easing: o.ease || 'ease-out', fill: 'forwards' }); a.onfinish = r; a.oncancel = r; });
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); fxs.appendChild(n); return n; };
  const pj = (html, x, y) => { const d = document.createElement('div'); d.className = 'gbv-pj'; d.innerHTML = html; d.style.left = x + 'px'; d.style.top = y + 'px'; stage.appendChild(d); return d; };
  const arcKf = (a, b, h, n = 6) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return { transform: `translate(${(b.x - a.x) * t}px,${(b.y - a.y) * t - h * 4 * t * (1 - t)}px) translate(-50%,-50%)` }; });
  // 普攻弹道：返回在「打中」那一刻 resolve 的 Promise
  async function shot(fx, a, t) {
    const A = center(a), B = center(t), ang = Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI, dir = a.ro.side ? -1 : 1;
    switch (fx) {
      case 'spit': { const d = pj(`<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#e2672e"/><circle cx="6" cy="6" r="2.5" fill="#f6c24a"/></svg>`, A.x, A.y); await anim(d, arcKf(A, B, G.cw * 0.6), 300, { ease: 'linear' }); d.remove(); break; }
      case 'needle': { const d = pj(`<div style="width:${G.cw * 0.5}px;height:2px;background:var(--ik);box-shadow:0 0 0 1px var(--pp);transform:rotate(${ang}deg)"></div>`, A.x, A.y); await anim(d, [{ transform: 'translate(-50%,-50%)' }, { transform: `translate(${B.x - A.x}px,${B.y - A.y}px) translate(-50%,-50%)` }], 170, { ease: 'linear' }); d.remove(); break; }
      case 'bolt': { const pts = [A]; for (let i = 1; i < 5; i++) pts.push({ x: A.x + (B.x - A.x) * i / 5 + (i % 2 ? 7 : -7), y: A.y + (B.y - A.y) * i / 5 + (i % 2 ? -6 : 6) }); pts.push(B); const l = svgEl('polyline', { points: pts.map(p => p.x + ',' + p.y).join(' '), fill: 'none', stroke: '#9fd2ff', 'stroke-width': 3, 'stroke-linejoin': 'round' }); await sleep(90); l.setAttribute('stroke', '#ffffff'); await sleep(70); l.remove(); break; }
      case 'spore': { const ds = [0, 1, 2].map(i => pj(`<div style="width:${10 + i * 3}px;height:${10 + i * 3}px;border-radius:50%;background:#7c9a4a;opacity:.7;filter:blur(1px)"></div>`, A.x, A.y)); await Promise.all(ds.map((d, i) => anim(d, arcKf(A, { x: B.x + (i - 1) * 6, y: B.y + (i - 1) * 4 }, G.cw * 0.3 * (i + 1) / 2), 380 + i * 40))); ds.forEach(d => d.remove()); break; }
      case 'wave': { const c = svgEl('path', { d: `M${A.x} ${A.y - 10} q${dir * 10} 10 0 20`, fill: 'none', stroke: 'var(--qing,#6fb7a4)', 'stroke-width': 3 }); await anim(c, [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${B.x - A.x}px,${B.y - A.y}px)`, opacity: 0.4 }], 260, { ease: 'linear' }); c.remove(); break; }
      default: {   // pounce / bite / slash：本体扑过去再退回
        const dx = (B.x - A.x) * 0.62, dy = (B.y - A.y) * 0.62;
        await anim(a.el, [{ transform: 'translate(-50%,-100%)' }, { transform: `translate(calc(-50% + ${dx}px),calc(-100% + ${dy - 8}px))` }], 150, { ease: 'cubic-bezier(.5,0,.9,.4)' });
        if (fx === 'slash' || fx === 'bite') { const p = fx === 'slash' ? `M${B.x - 14} ${B.y - 12} Q${B.x + 4} ${B.y - 2} ${B.x + 12} ${B.y + 14}` : `M${B.x - 6} ${B.y - 10} l3 9 M${B.x + 5} ${B.y - 10} l-3 9`; const s = svgEl('path', { d: p, fill: 'none', stroke: 'var(--ik)', 'stroke-width': fx === 'slash' ? 4 : 3, 'stroke-linecap': 'round' }); setTimeout(() => s.remove(), 220 / speed); }
        anim(a.el, [{ transform: `translate(calc(-50% + ${dx}px),calc(-100% + ${dy - 8}px))` }, { transform: 'translate(-50%,-100%)' }], 200).then(() => { a.el.getAnimations().forEach(x => x.cancel()); });
      }
    }
  }
  // 主动技动作（释放者那一侧的通用动作；具体伤害数字随后由 dmg 事件逐个跳出）
  async function castFx(fx, a, tgs) {
    const A = center(a), T = tgs.map(center);
    const colors = { fire: '#e2672e', frost: '#8fc7ee', bolt: '#cfe6ff', spore: '#7c9a4a', heal: '#7ed29a', shield: '#e8d9a8', drain: '#b0303a', roar: '#e8d9a8', web: '#e8e2d0', needle: '#1c1915', slash: '#1c1915', pounce: '#1c1915', bite: '#1c1915', summon: '#1c1915' };
    const col = colors[fx] || '#d9a441';
    if (fx === 'pounce' || fx === 'slash' || fx === 'bite') { if (tgs[0]) await shot(fx, a, tgs[0]); return; }
    if (fx === 'shield' || fx === 'heal' || fx === 'summon') {
      const L = (tgs.length ? tgs : [a]).map(center);
      L.forEach(p => { const c = svgEl('circle', { cx: p.x, cy: p.y + 6, r: G.cw * 0.2, fill: 'none', stroke: col, 'stroke-width': 3 }); anim(c, [{ r: G.cw * 0.2, opacity: 1 }, { r: G.cw * 0.55, opacity: 0 }], 420).then(() => c.remove()); });
      await sleep(260); return;
    }
    if (fx === 'roar') { for (let i = 0; i < 3; i++) { const c = svgEl('circle', { cx: A.x, cy: A.y, r: 6, fill: 'none', stroke: col, 'stroke-width': 2 }); anim(c, [{ r: 6, opacity: 0.9 }, { r: G.cw * 2.6, opacity: 0 }], 520).then(() => c.remove()); await sleep(90); } return; }
    await Promise.all(T.map((p, i) => new Promise(async r => {
      await sleep(i * 50);
      if (fx === 'bolt') { const l = svgEl('polyline', { points: `${p.x},${p.y - G.cw} ${p.x - 6},${p.y - G.cw * 0.5} ${p.x + 5},${p.y - G.cw * 0.4} ${p.x},${p.y}`, fill: 'none', stroke: col, 'stroke-width': 3 }); await sleep(150); l.remove(); }
      else if (fx === 'drain') { const l = svgEl('line', { x1: p.x, y1: p.y, x2: A.x, y2: A.y, stroke: col, 'stroke-width': 3, 'stroke-dasharray': '4 5' }); await anim(l, [{ strokeDashoffset: 0 }, { strokeDashoffset: -40 }], 300, { ease: 'linear' }); l.remove(); }
      else if (fx === 'web') { const g = svgEl('path', { d: `M${p.x - 14} ${p.y - 14} L${p.x + 14} ${p.y + 14} M${p.x + 14} ${p.y - 14} L${p.x - 14} ${p.y + 14} M${p.x - 18} ${p.y} L${p.x + 18} ${p.y}`, stroke: col, 'stroke-width': 1.5, fill: 'none' }); await anim(g, [{ opacity: 0 }, { opacity: 1 }], 200); setTimeout(() => g.remove(), 260 / speed); }
      else { const d = pj(`<div style="width:14px;height:14px;border-radius:50%;background:${col};box-shadow:0 0 0 2px rgba(0,0,0,.25)"></div>`, A.x, A.y); await anim(d, arcKf(A, p, fx === 'needle' ? 4 : G.cw * 0.5), fx === 'needle' ? 180 : 320, { ease: 'linear' }); d.remove(); }
      r();
    })));
  }
  const banner = async (txt, sub, ms = 650) => {
    if (skip) return; const b = document.createElement('div'); b.className = 'gbv-ban';
    b.innerHTML = [...txt].map((ch, i) => `<span style="animation-delay:${i * 70 / speed}ms">${esc(ch)}</span>`).join('') + (sub ? `<small>${esc(sub)}</small>` : '');
    stage.appendChild(b); await sleep(ms); b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 / speed, fill: 'forwards' }); setTimeout(() => b.remove(), 220 / speed);
  };
  // 战斗记录：阵盘下方 4～6 行，敌方朱红、我方青绿；一次出手一行，打中谁、掉多少、挂了什么都并进这一行
  let LN = null, card = null;
  const sideOf = uid => (R[uid] || {}).side, tag = sd => sd === me ? '我' : '敌';
  function logNew(sd, head, cls = '') {
    const d = document.createElement('div'); d.className = 'gbv-ll ' + (sd == null ? 'n' : sd === me ? 'me' : 'op') + (cls ? ' ' + cls : ''); logEl.appendChild(d);
    while (logEl.childElementCount > 80) logEl.firstElementChild.remove();
    LN = { el: d, head, tg: new Map(), ex: [], arrow: ' → ' }; logDraw(); return LN;
  }
  const logWho = uid => LN || logNew(sideOf(uid), uid != null && R[uid] ? `[${tag(sideOf(uid))}] ${esc(nm(uid))}` : `第 ${round} 轮`);
  function logPart(uid, kind, txt) { const L = LN || logNew(null, `第 ${round} 轮`); let t = L.tg.get(uid); if (!t) L.tg.set(uid, t = { d: [], s: [] }); t[kind].push(txt); logDraw(); }
  function logEx(txt) { const L = LN; if (!L || L.ex.includes(txt)) return; L.ex.push(txt); logDraw(); }
  function logDraw() {
    const L = LN, tg = [...L.tg].map(([uid, t]) => `${esc(nm(uid))} ${t.d.join(' ')}${t.s.length ? (t.d.length ? '，' : '') + t.s.join('，') : ''}`.trim());
    L.el.innerHTML = L.head + (tg.length ? L.arrow + tg.join('；') : '') + (L.ex.length ? ' · ' + L.ex.join(' · ') : ''); logEl.scrollTop = logEl.scrollHeight;
  }
  const say = t => { logNew(null, esc(t)); };
  // 主动技亮牌：施放者头顶上方（阵盘上沿的空白里）冒出一块实色牌子，按阵营上色，留到这一招的效果结算完
  function showCard(u, e) {
    const sd = u.ro.side, p = center(u), d = document.createElement('div');
    d.className = 'gbv-card ' + (sd === me ? 'me' : 'op');
    d.innerHTML = `<div class="c1">${tag(sd)} · ${esc(u.ro.name)}</div><div class="c2">${esc(e.n)}</div>${e.line ? `<div class="c3">${glossHTML(e.line, { tip: false })}</div>` : ''}`;
    stage.appendChild(d); const w = d.offsetWidth, h = d.offsetHeight, x = Math.max(2, Math.min(G.W - w - 2, p.x - w / 2));
    d.style.left = x + 'px'; d.style.setProperty('--px', Math.max(10, Math.min(w - 10, p.x - x)) + 'px');
    const y1 = 4 + h + 7, y2 = p.y - tokSz(u) * 0.5 - 18;
    const ln = y2 > y1 + 6 ? svgEl('line', { x1: p.x, y1, x2: p.x, y2, stroke: sd === me ? '#2f8a73' : '#c23a26', class: 'gbv-tether' }) : null;
    return { el: d, ln };
  }
  function dropCard() { if (!card) return; const c = card; card = null; c.el.classList.add('out'); setTimeout(() => c.el.remove(), 240); if (c.ln) c.ln.remove(); }
  const nm = uid => (R[uid] || {}).name || '?';
  const trigName = e => e.fx ? e.n || '' : e.xg ? (XING[e.xg] || {}).n : e.food ? (FOOD[e.food] || {}).n : e.dao ? (DAO[e.dao] || {}).n : e.id ? (TRAITS[e.id] || {}).n : e.mk || '';

  // ----- 重放 -----
  layout();
  const onR = () => layout(); window.addEventListener('resize', onR);
  const big = new Set(); let round = 0, castMode = 0;
  for (let i = 0; i < log.length; i++) {
    if (skip) break;
    const e = log[i], u = U[e.uid];
    switch (e.t) {
      case 'begin': logNew(null, '开战'); applySnap(e.s); Object.values(U).forEach((x, k) => { x.el.style.opacity = '0'; setTimeout(() => { x.el.style.opacity = '1'; }, (x.ro.side ? 120 : 0) + k * 30); }); await sleep(700); continue;
      case 'syn': { const t = [...e.daos.map(d => `${d.n}·${d.cnt}`), ...e.combos.map(c => '「' + c.n + '」')].join(' '); root.querySelector(e.side ? '.gbv-synb' : '.gbv-syna').textContent = t ? (e.side === me ? '' : '') + t : ''; break; }
      case 'order': drawOrder(null, e.q); await sleep(350); break;
      case 'round': dropCard(); LN = null; round = e.n; root.querySelector('.gbv-rdl').textContent = `第 ${e.n} 轮`; await sleep(180); break;
      case 'act': dropCard(); LN = null; Object.values(U).forEach(x => x.el.classList.toggle('now', x.uid === e.uid)); drawOrder(e.uid, e.q); await sleep(140); break;
      case 'skip': if (u) float(u, e.k === 'stun' ? '眩晕' : '蓄势', 'tag'); logNew(sideOf(e.uid), `[${tag(sideOf(e.uid))}] ${esc(nm(e.uid))} ${e.k === 'stun' ? '眩晕中，跳过这次出手' : '被挡在身后，蓄势（蛊力 +）'}`); await sleep(260); break;
      case 'atk': {
        const t = U[e.tg]; aimOn(e.cells, false, R[e.uid] && R[e.tg] && R[e.uid].side === R[e.tg].side); LN = null; logWho(e.uid);
        await sleep(240); if (u && t) await shot(e.fx, u, t); aimOff(); castMode = 0; break;
      }
      case 'cast': {
        const tg = (e.tg || []).map(x => U[x]).filter(Boolean); aimOn(e.cells, true, tg[0] && u && tg[0].ro.side === u.ro.side);
        dropCard(); const sd = sideOf(e.uid); logNew(sd, `[${tag(sd)}] ${esc(nm(e.uid))} 放「<b>${esc(e.n)}</b>」`);
        if (u && !skip) { u.el.classList.add('charge'); card = showCard(u, e); }
        await sleep(420);                          // 蓄势：卡放大描边、牌子冒出来、目标格按形状亮起
        if (card) card.el.classList.add('lit');
        await sleep(320);                          // 亮牌
        if (u) u.el.classList.remove('charge');
        if (u) await castFx(e.fx, u, tg); aimOff(); castMode = 1; break;   // 结算：后面的伤害、状态逐个跳出，牌子留到下一次出手
      }
      case 'combo': {
        if (e.big && !big.has(e.uid)) {
          big.add(e.uid); dropCard(); logNew(sideOf(e.uid), `[${tag(sideOf(e.uid))}] 杀招「<b>${esc(e.n)}</b>」`, 'cb');
          const tg = (e.tg || []).map(x => U[x]).filter(Boolean);
          const sd = u ? u.ro.side : 0, live = Object.values(U).filter(x => x.alive), fo = live.filter(x => x.ro.side !== sd).map(center);
          if (!skip) await playCombo(stage, { id: e.id, name: e.n, side: sd, hud: outer, nameY: Math.max(26, G.top * 0.42), u: G.cw, from: u ? center(u) : { x: G.W / 2, y: G.H / 2 }, targets: tg.length ? tg.map(center) : fo, allies: live.filter(x => x.ro.side === sd).map(center), foes: fo, w: G.W, h: G.H, ground: G.top + 3 * G.rh, reduce: calm, speed, isSkip: () => skip });
        } else if (u) { float(u, '「' + (e.n || '')[0] + '」', 'tag', -10); if (LN) logEx(`杀招「${esc(e.n)}」`); }
        castMode = 1; break;
      }
      case 'dmg': {
        if (!u) break; const kill = e.s && !e.s.some(sd => sd.some(x => x[0] === e.uid && x[2] > 0));
        if (e.k === 'psn' || e.k === 'para' || e.k === 'burn' || e.k === 'doom') {
          floatSt(u, e.n, e.k); if (!LN || LN.tick !== round) { logNew(null, `第 ${round} 轮结算`); LN.tick = round; LN.arrow = '：'; }
          logPart(e.uid, 'd', (e.k === 'burn' ? '灼烧' : e.k === 'doom' ? '天劫压阵' : e.k === 'para' ? '寄生' : '中毒') + ' -' + e.n); applySnap(e.s); await sleep(120); break;
        }
        if (!LN) logWho(e.src); logPart(e.uid, 'd', e.n ? (e.crit ? '暴击 ' : '') + '-' + e.n + (e.blk ? `（护体挡下 ${e.blk}）` : '') : `护体挡下 ${e.blk || 0}`);
        flash(u); if (e.n) float(u, (e.crit ? '暴击 ' : '') + '-' + e.n, e.crit ? 'crit' : '', castMode ? (i % 3) * -6 : 0); if (e.blk) float(u, '护体挡下 ' + e.blk, 'blk', e.n ? 14 : 0);
        applySnap(e.s);
        if (e.crit || kill) { shake(); await sleep(kill ? 160 : 90); }   // 顿帧：暴击、斩杀停一下
        await sleep(castMode ? 110 : 200); break;
      }
      case 'heal': if (u) { float(u, '+' + e.n, 'heal'); if (LN) logPart(e.uid, 'd', '+' + e.n); } applySnap(e.s); await sleep(120); break;
      case 'buff': {
        if (!u) break; const p = []; if (e.a) p.push((e.a > 0 ? '+' : '') + e.a + '攻'); if (e.h) p.push((e.h > 0 ? '+' : '') + e.h + '血'); if (e.sh) p.push('护体 +' + e.sh); if (e.spd) p.push((e.spd > 0 ? '速+' : '速') + e.spd); if (e.adv) p.push('提前'); if (e.delay) p.push('推后');
        if (p.length) float(u, p.join(' '), e.a < 0 || e.delay ? 'psn' : 'heal', -12); if (LN && !e.dao && (e.sh || e.a < 0)) logPart(e.uid, 's', e.sh ? `护体 +${e.sh}` : `攻 ${e.a}`); applySnap(e.s); await sleep(e.dao ? 40 : 110); break;
      }
      case 'status': {
        if (!u) break; const k = e.k === 'guard' ? 'grd' : e.k === 'para' ? 'psn' : e.k;
        stFx(u, k); applySnap(e.s);
        if (ST_LOG[e.k]) { if (!LN || (LN.tick && e.by)) { LN = null; logWho(e.by); } logPart(e.uid, 's', ST_LOG[e.k](e.n)); }
        await sleep(calm ? 200 : 300); break;
      }
      case 'trig': { const n = trigName(e); if (u && n) { float(u, n, 'tag', -22); if (!LN || LN.tick) logNew(sideOf(e.uid), `[${tag(sideOf(e.uid))}] ${esc(nm(e.uid))}「${esc(n)}」`); else logEx(`${esc(nm(e.uid))}「${esc(n)}」`); } applySnap(e.s); await sleep(e.id || e.xg ? 200 : 60); break; }
      case 'link': { const a = U[e.uid], b = U[e.to]; linkFx(a, b, e.k); if (LN) logEx(`联动：${esc(nm(e.uid))} 接上 ${esc(nm(e.to))} 的${ST_N[e.k] || ''}`); await sleep(calm ? 120 : 220); break; }
      case 'summon': applySnap(e.s); if (U[e.uid]) { U[e.uid].el.classList.add('summon'); if (LN) logEx(`召唤出 ${esc(nm(e.uid))}`); else say(`${nm(e.uid)} 现身`); } await sleep(220); break;
      case 'move': if (u) {
        if (e.k === 'bump' || e.k === 'wall') { float(u, '撞上', 'tag'); flash(u); if (U[e.into]) flash(U[e.into]); shake(); if (LN) logPart(e.uid, 's', '撞上'); }
        else if (e.k === 'knock' || e.k === 'draw') { stFx(u, 'dust'); float(u, e.k === 'knock' ? '击退' : '拉近', 'tag', -14); if (LN) logPart(e.uid, 's', e.k === 'knock' ? '击退' : '拉近'); }
        else if (e.k === 'hold') { float(u, '纹丝不动', 'tag', -14); if (!calm) anim(u.tok, [{ transform: 'translateX(0)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }], 220); if (LN) logPart(e.uid, 's', '纹丝不动'); }
      } applySnap(e.s); await sleep(e.k === 'knock' || e.k === 'draw' ? 300 : 220); break;
      case 'faint': if (u) {
        u.alive = false; if (LN) logPart(e.uid, 's', e.eaten ? '被吞噬' : '倒下'); else say(`${nm(e.uid)} 倒下`);
        const by = e.eaten && U[e.by];
        if (by && !skip) {   // 吞：整只被吸到吞它的蛊身上，越吸越小
          const a = center(u), b = center(by);
          await anim(u.el, [{ transform: 'translate(-50%,-100%)', opacity: 1 }, { transform: `translate(calc(-50% + ${b.x - a.x}px),calc(-100% + ${b.y - a.y + 20}px)) scale(.12)`, opacity: 0.2 }], 460, { ease: 'cubic-bezier(.6,0,.9,.5)' });
          anim(by.tok, [{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(1)' }], 260);
        }
        u.el.classList.add('die');
      } applySnap(e.s); await sleep(380); break;
      case 'end': break;
      default: applySnap(e.s);
    }
  }
  window.removeEventListener('resize', onR);
  aimOff(); hideTip(); dropCard();
  const trip = modeOf(opts) === 'trip', won = res.winner !== 'draw' && (res.winner === 'A' ? 0 : 1) === me;
  if (trip && won) {   // 秘境里打赢：倒下的蛊全部救回（剩多少血由秘境定），从倒地处起身
    const up = Object.values(U).filter(x => !x.alive && x.ro.side === me && !x.ro.summon);
    if (up.length && !skip) {
      say(`打赢了，倒下的 ${up.length} 只救回来了`);
      up.forEach((x, k) => setTimeout(() => { x.alive = true; x.hp = 1; x.sh = 0; x.el.classList.remove('die'); x.el.classList.add('rise'); setBars(x); float(x, '救回', 'heal', -16); }, k * 160));
      await new Promise(r => setTimeout(r, 900 + up.length * 160));
    }
  }
  // 结算页
  showResult(root, res, opts, me, names, skip, resolve, () => window.removeEventListener('resize', onR));
}

function showResult(root, res, opts, me, names, skipped, resolve) {
  const R = res.roster, US = res.units, w = res.winner, mine = w === 'draw' ? 'draw' : (w === 'A' ? 0 : 1) === me ? 'win' : 'lose', trip = modeOf(opts) === 'trip';
  const head = mine === 'win' ? '胜' : mine === 'lose' ? '败' : '平';
  const art = (uid, sz) => guSVG(R[uid].sp, { rank: R[uid].rank || 1, size: sz, still: true });
  const rows = side => Object.entries(US).filter(([, x]) => x.side === side && !x.summon).map(([uid, x]) =>
    `<tr class="${x.dead ? 'dead' : ''}"><td>${art(uid)}<span>${esc(x.name)}${R[uid].rank ? `<small style="color:var(--mu)"> ${CN[R[uid].rank]}转</small>` : ''}</span></td><td>${x.dmg}</td><td>${x.taken}</td><td>${x.kills}</td><td>${side === me && trip ? (mine === 'win' ? (x.dead ? '<b style="color:#7ed29a">救回 1</b>' : x.hpEnd + '/' + x.mx) : '<b style="color:var(--zhu2,#d8553f)">永逝</b>') : x.dead ? '倒下' : x.hpEnd + '/' + x.mx}</td></tr>`).join('');
  const sm = Object.values(US).filter(x => x.summon), smTxt = side => { const L = sm.filter(x => x.side === side); return L.length ? `<tr><td colspan="5" style="color:var(--mu);font-size:11px">召唤物 ${L.length} 只，合计伤害 ${L.reduce((a, x) => a + x.dmg, 0)}</td></tr>` : ''; };
  const mv = res.mvp && US[res.mvp];
  const mineU = Object.entries(US).filter(([, x]) => x.side === me && !x.summon), saved = trip && mine === 'win' ? mineU.filter(([, x]) => x.dead) : [], fallen = trip && mine !== 'win' ? mineU : [];
  const deadRound = uid => { let rd = 0; for (const e of res.log) { if (e.t === 'round') rd = e.n; if (e.t === 'faint' && e.uid === uid) return rd || 1; } return rd; };
  const sota = opts.sota || res.sota || [];
  const box = document.createElement('div'); box.className = 'gbv-res';
  box.innerHTML = `<h3 class="${mine}">${head}</h3><div class="gbv-sub">${esc(names[me])} 对 ${esc(names[1 - me])} · ${res.rounds} 轮${skipped ? ' · 已跳过' : ''}</div>
    ${mv ? `<div class="gbv-mvp">${art(res.mvp, 52)}<div><em>本场最佳</em><b>${esc(mv.name)}</b><br><span style="font-size:12px">伤害 ${mv.dmg} · 承受 ${mv.taken} · 击杀 ${mv.kills}${mv.healed ? ' · 护佑 ' + mv.healed : ''}</span></div></div>` : ''}
    ${saved.length ? `<div class="gbv-save"><b>救回 ${saved.length} 只</b>：${saved.map(([uid, x]) => `<span>${art(uid, 22)}${esc(x.name)}</span>`).join('')}</div>` : ''}
    ${fallen.length ? `<div class="gbv-fare"><h4>全队告别</h4><p class="gbv-lead">这一场输了，渡劫失败，场上的蛊全部永久离开。</p>${fallen.map(([uid, x], i) => `<div class="gbv-g" style="animation-delay:${0.4 + i * 0.6}s">${art(uid, 46)}<div><b>${esc(x.name)}</b>${R[uid].rank ? ` <small>${CN[R[uid].rank]}转</small>` : ''}<p>${x.dead ? `倒在第 ${deadRound(uid)} 轮` : '战到最后'}，打出 ${x.dmg} 点伤害${x.kills ? `、击倒 ${x.kills} 只` : ''}。它不会再回来了。</p></div></div>`).join('')}</div>` : ''}
    <table class="gbv-tb"><tr><th>${esc(names[me])}</th><th>伤害</th><th>承受</th><th>击杀</th><th>剩血</th></tr>${rows(me)}${smTxt(me)}
    <tr><td class="gbv-side" colspan="5">${esc(names[1 - me])}</td></tr>${rows(1 - me)}${smTxt(1 - me)}</table>
    ${trip ? '' : '<p class="gbv-note">切磋：不死蛊</p>'}
    ${sota[me] ? '<p class="gbv-note">SOTA +1%</p>' : ''}
    <button class="gbv-go">继续</button>`;
  root.appendChild(box);
  box.querySelector('.gbv-go').onclick = () => { box.remove(); resolve({ closed: true, skipped }); };
}
