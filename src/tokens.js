// 蛊码 GuCode · Token 来源：演示流 / VS Code 插件推送
export const VSC = (typeof acquireVsCodeApi === 'function') ? acquireVsCodeApi() : null;

export class TokenSource {
  constructor(cb) {
    this.cb = cb; this.live = !!VSC; this.mode = VSC ? 'vscode' : 'demo'; this.demo = 'coding';
    this.rate = 0; this.idleMs = 0; this.last = performance.now();
    this.acc = 0; this.hotAcc = 0; this.vrate = 0; this.vidle = true; this.vsrc = null;
    if (VSC) window.addEventListener('message', e => {
      const m = e.data || {};
      if (m.type === 'tokens') { this.acc += m.delta || 0; if (m.hot) this.hotAcc += m.delta || 0; this.vrate = m.rate || 0; this.vidle = !!m.idle; this.vsrc = m.bySource || null; }
    });
    setInterval(() => this.tick(), 200);
  }
  get unit() { return this.mode === 'vscode' ? 8000 : 200; }       // 罗盘节点每"千"折合多少 token（网页模拟流速约 1000/s，折算同比缩小，节奏和以前一样）
  get hotTh() { return 2000; }                                       // 武火阈值（token/秒）
  setMode(m) { if (VSC && m !== 'vscode') return; this.mode = m; this.idleMs = 0; this.acc = 0; this.hotAcc = 0; }   // 插件里只认真实 token，不能切到模拟灵流
  tick() {
    const now = performance.now(), dt = Math.min(1, (now - this.last) / 1000); this.last = now;
    if (this.mode === 'demo') {
      // 网页模拟灵流：接近真实写代码时的中位流速，约 500–1500/s 起伏；只有「写代码中 / 停手休息」两档
      const base = this.demo === 'rest' ? 0 : 1000, t = now / 1000;
      const r = base ? base * Math.min(1.5, Math.max(0.5, 1 + 0.32 * Math.sin(t * 0.9) + 0.18 * Math.sin(t * 2.7 + 1))) : 0;
      const d = r * dt;
      this.rate = this.rate * 0.75 + r * 0.25; if (!base && this.rate < 20) this.rate = 0;
      this.idleMs = this.rate > 0 ? 0 : this.idleMs + dt * 1000;
      this.cb({ delta: d, rate: this.rate, hot: this.rate >= this.hotTh, idle: this.idleMs >= 1200 });
    } else {
      const d = this.acc, hd = this.hotAcc; this.acc = 0; this.hotAcc = 0; this.rate = this.vrate;
      this.cb({ delta: d, hotDelta: hd, rate: this.vrate, hot: this.vrate >= this.hotTh, idle: this.vidle, bySource: this.vsrc });
    }
  }
}
