// 蛊码 GuCode · Token 来源：演示流 / VS Code 插件推送
export const VSC = (typeof acquireVsCodeApi === 'function') ? acquireVsCodeApi() : null;

export class TokenSource {
  constructor(cb) {
    this.cb = cb; this.live = !!VSC; this.mode = VSC ? 'vscode' : 'demo'; this.demo = 'coding';
    this.rate = 0; this.idleMs = 0; this.last = performance.now();
    this.acc = 0; this.hotAcc = 0; this.vrate = 0; this.vidle = true;
    if (VSC) window.addEventListener('message', e => {
      const m = e.data || {};
      if (m.type === 'tokens') { this.acc += m.delta || 0; if (m.hot) this.hotAcc += m.delta || 0; this.vrate = m.rate || 0; this.vidle = !!m.idle; }
    });
    setInterval(() => this.tick(), 200);
  }
  get unit() { return this.mode === 'vscode' ? 8000 : 1000; }      // 罗盘节点每"千"折合多少真实 token
  get hotTh() { return this.mode === 'vscode' ? 2000 : 10000; }     // 武火阈值（token/秒）
  setMode(m) { this.mode = m; this.idleMs = 0; this.acc = 0; this.hotAcc = 0; }
  tick() {
    const now = performance.now(), dt = Math.min(1, (now - this.last) / 1000); this.last = now;
    if (this.mode === 'demo') {
      const base = { coding: 5200, wuhuo: 15500, rest: 0 }[this.demo], t = now / 1000;
      const r = base ? base * Math.max(0.15, 0.8 + 0.3 * Math.sin(t * 1.7) + 0.2 * Math.sin(t * 4.3 + 1)) : 0;
      const d = r * dt;
      this.rate = this.rate * 0.75 + r * 0.25; if (!base && this.rate < 20) this.rate = 0;
      this.idleMs = this.rate > 0 ? 0 : this.idleMs + dt * 1000;
      this.cb({ delta: d, rate: this.rate, hot: this.rate >= this.hotTh, idle: this.idleMs >= 1200 });
    } else {
      const d = this.acc, hd = this.hotAcc; this.acc = 0; this.hotAcc = 0; this.rate = this.vrate;
      this.cb({ delta: d, hotDelta: hd, rate: this.vrate, hot: this.vrate >= this.hotTh, idle: this.vidle });
    }
  }
}
