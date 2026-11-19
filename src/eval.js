// Evaluación numérica (para gráficas, verificación y comprobaciones).
const F = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, cot: (x) => 1 / Math.tan(x), sec: (x) => 1 / Math.cos(x), csc: (x) => 1 / Math.sin(x),
  asin: Math.asin, acos: Math.acos, atan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  ln: Math.log, lnabs: (x) => Math.log(Math.abs(x)),
};
export function ev(e, env) {
  switch (e.t) {
    case 'num': return e.p / e.q;
    case 'sym': return e.n === 'pi' ? Math.PI : e.n === 'e' ? Math.E : env[e.n];
    case 'fn': return F[e.n](ev(e.a, env));
    case 'pow': return Math.pow(ev(e.b, env), ev(e.e, env));
    case 'add': { let s = 0; for (const x of e.a) s += ev(x, env); return s; }
    case 'mul': { let s = 1; for (const x of e.a) s *= ev(x, env); return s; }
  }
}
export const evalAt = (e, x) => ev(e, { x });
export const compile = (e) => (x) => ev(e, { x });

// Simpson adaptativo
export function simpson(f, a, b, tol = 1e-10) {
  const S = (fa, fm, fb, a, b) => ((b - a) / 6) * (fa + 4 * fm + fb);
  const rec = (a, b, fa, fm, fb, whole, tol, depth) => {
    const m = (a + b) / 2, lm = (a + m) / 2, rm = (m + b) / 2;
    const flm = f(lm), frm = f(rm);
    const l = S(fa, flm, fm, a, m), r = S(fm, frm, fb, m, b);
    if (depth <= 0 || Math.abs(l + r - whole) <= 15 * tol) return l + r + (l + r - whole) / 15;
    return rec(a, m, fa, flm, fm, l, tol / 2, depth - 1) + rec(m, b, fm, frm, fb, r, tol / 2, depth - 1);
  };
  const fa = f(a), fb = f(b), fm = f((a + b) / 2);
  return rec(a, b, fa, fm, fb, S(fa, fm, fb, a, b), tol, 40);
}
