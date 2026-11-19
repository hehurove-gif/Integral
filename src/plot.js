// Gráfica en canvas: curvas, región sombreada, intersecciones; zoom (rueda) y desplazamiento (arrastrar).
const niceStep = (span) => {
  const raw = span / 7, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
};

export class Plot {
  constructor(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.data = { curves: [], shade: null, points: [], marks: [] };
    this.view = { x0: -6, x1: 6, y0: -4, y1: 4 };
    this._auto = null;
    new ResizeObserver(() => this.draw()).observe(canvas);
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(e); }, { passive: false });
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, v: { ...this.view } }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const r = canvas.getBoundingClientRect(), v = drag.v;
      const dx = ((e.clientX - drag.x) / r.width) * (v.x1 - v.x0), dy = ((e.clientY - drag.y) / r.height) * (v.y1 - v.y0);
      this.view = { x0: v.x0 - dx, x1: v.x1 - dx, y0: v.y0 + dy, y1: v.y1 + dy }; this.draw();
    });
    canvas.addEventListener('pointerup', () => { drag = null; });
    canvas.addEventListener('dblclick', () => this.reset());
  }
  zoom(e) {
    const r = this.c.getBoundingClientRect(), v = this.view, k = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const mx = v.x0 + ((e.clientX - r.left) / r.width) * (v.x1 - v.x0), my = v.y1 - ((e.clientY - r.top) / r.height) * (v.y1 - v.y0);
    this.view = { x0: mx - (mx - v.x0) * k, x1: mx + (v.x1 - mx) * k, y0: my - (my - v.y0) * k, y1: my + (v.y1 - my) * k }; this.draw();
  }
  set(data) { this.data = { curves: [], shade: null, points: [], marks: [], ...data }; this.reset(); }
  setView(v) { this.view = { ...this.view, ...v }; this.draw(); }
  reset() {
    const { curves, shade, range } = this.data;
    let x0 = -6, x1 = 6;
    if (range) { const pad = (range.b - range.a) * 0.2 || 1; x0 = range.a - pad; x1 = range.b + pad; }
    const ys = [0];
    for (const cv of curves) for (let i = 0; i <= 400; i++) { const y = cv.f(x0 + ((x1 - x0) * i) / 400); if (Number.isFinite(y)) ys.push(y); }
    ys.sort((a, b) => a - b);
    const lo = ys[Math.floor(ys.length * 0.02)], hi = ys[Math.ceil(ys.length * 0.98) - 1];
    let y0 = Math.min(lo, 0), y1 = Math.max(hi, 0);
    if (y1 - y0 < 1e-6) { y0 -= 1; y1 += 1; }
    const pad = (y1 - y0) * 0.12; y0 -= pad; y1 += pad;
    void shade;
    this.view = { x0, x1, y0, y1 }; this.draw();
  }
  draw() {
    const c = this.c, dpr = window.devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
    if (!W || !H) return;
    if (c.width !== W * dpr || c.height !== H * dpr) { c.width = W * dpr; c.height = H * dpr; }
    const g = this.ctx; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const { x0, x1, y0, y1 } = this.view;
    const X = (x) => ((x - x0) / (x1 - x0)) * W, Y = (y) => H - ((y - y0) / (y1 - y0)) * H;
    // rejilla y ejes
    g.font = '11px system-ui, sans-serif'; g.textBaseline = 'top';
    const sx = niceStep(x1 - x0), sy = niceStep(y1 - y0);
    g.lineWidth = 1;
    for (let x = Math.ceil(x0 / sx) * sx; x <= x1; x += sx) { g.strokeStyle = '#e5e7eb'; g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), H); g.stroke(); }
    for (let y = Math.ceil(y0 / sy) * sy; y <= y1; y += sy) { g.strokeStyle = '#e5e7eb'; g.beginPath(); g.moveTo(0, Y(y)); g.lineTo(W, Y(y)); g.stroke(); }
    g.strokeStyle = '#6b7280'; g.fillStyle = '#6b7280';
    const ax = Math.min(Math.max(Y(0), 0), H - 14), ay = Math.min(Math.max(X(0), 0), W - 30);
    g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(W, Y(0)); g.moveTo(X(0), 0); g.lineTo(X(0), H); g.stroke();
    const lab = (v) => Number(v.toPrecision(6)).toString();
    for (let x = Math.ceil(x0 / sx) * sx; x <= x1; x += sx) if (Math.abs(x) > sx / 2) g.fillText(lab(x), X(x) + 2, ax + 2);
    for (let y = Math.ceil(y0 / sy) * sy; y <= y1; y += sy) if (Math.abs(y) > sy / 2) g.fillText(lab(y), ay + 4, Y(y) + 2);
    // región sombreada: entre f y g (o el eje x) en [a, b]
    const sh = this.data.shade;
    if (sh) {
      for (let px = Math.max(0, Math.floor(X(sh.a))); px <= Math.min(W, Math.ceil(X(sh.b))); px++) {
        const x = x0 + ((px + 0.5) / W) * (x1 - x0);
        if (x < sh.a || x > sh.b) continue;
        const yf = sh.f(x), yg = sh.g ? sh.g(x) : 0;
        if (!Number.isFinite(yf) || !Number.isFinite(yg)) continue;
        g.fillStyle = yf - yg >= 0 ? 'rgba(37,99,235,.25)' : 'rgba(234,88,12,.28)';
        const a = Math.max(-1e5, Math.min(1e5, Y(yf))), b = Math.max(-1e5, Math.min(1e5, Y(yg)));
        g.fillRect(px, Math.min(a, b), 1, Math.abs(a - b));
      }
      g.strokeStyle = 'rgba(55,65,81,.7)'; g.setLineDash([5, 4]);
      for (const x of [sh.a, sh.b]) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), H); g.stroke(); }
      g.setLineDash([]);
    }
    // curvas
    g.lineWidth = 2;
    for (const cv of this.data.curves) {
      g.strokeStyle = cv.color; g.beginPath();
      let pen = false, prev = 0;
      for (let px = 0; px <= W; px += 0.5) {
        const y = cv.f(x0 + (px / W) * (x1 - x0)), py = Y(y);
        if (!Number.isFinite(y) || Math.abs(py) > 1e5 || (pen && Math.abs(py - prev) > H * 1.2)) { pen = false; prev = py; continue; }
        if (pen) g.lineTo(px, py); else g.moveTo(px, py);
        pen = true; prev = py;
      }
      g.stroke();
    }
    // puntos (intersecciones) y leyenda
    for (const p of this.data.points) {
      g.fillStyle = '#111827'; g.beginPath(); g.arc(X(p.x), Y(p.y), 4, 0, 7); g.fill();
      g.fillStyle = '#111827'; g.fillText(`(${Number(p.x.toPrecision(4))}, ${Number(p.y.toPrecision(4))})`, X(p.x) + 6, Y(p.y) - 16);
    }
    let ly = 8;
    g.font = '12px system-ui, sans-serif';
    for (const cv of this.data.curves) { g.fillStyle = cv.color; g.fillRect(W - 120, ly + 4, 16, 3); g.fillStyle = '#374151'; g.fillText(cv.label, W - 98, ly); ly += 16; }
  }
}
