// Integrales definidas y áreas (con signo / geométricas)
import { num, add, mul, neg, sub, simp, expand, substVar, PI } from './ast.js';
import { ev, simpson } from './eval.js';
import { solve } from './integrate.js';
import { tex } from './latex.js';

const fx = (e) => (x) => ev(e, { x });

// Busca puntos donde el integrando no es finito dentro de [a,b] (integral impropia).
export function findSingularity(h, a, b, N = 2000) {
  for (let i = 0; i <= N; i++) {
    const x = a + ((b - a) * i) / N, y = h(x);
    if (!Number.isFinite(y) || Math.abs(y) > 1e7) return x;
  }
  return null;
}

export function findRoots(h, a, b, N = 4000) {
  const roots = []; const eps = 1e-9 * (1 + Math.abs(b - a));
  let x0 = a, y0 = h(a);
  for (let i = 1; i <= N; i++) {
    const x1 = a + ((b - a) * i) / N, y1 = h(x1);
    if (Number.isFinite(y0) && Number.isFinite(y1)) {
      let r = null;
      if (y0 === 0) r = x0;
      else if (y0 * y1 < 0) {
        let lo = x0, hi = x1, flo = y0;
        for (let k = 0; k < 100; k++) { const m = (lo + hi) / 2, fm = h(m); if (fm === 0) { lo = hi = m; break; } if (flo * fm < 0) hi = m; else { lo = m; flo = fm; } }
        r = (lo + hi) / 2;
      }
      if (r !== null && r > a + eps && r < b - eps && !roots.some((q) => Math.abs(q - r) < 1e-7)) roots.push(r);
    }
    x0 = x1; y0 = y1;
  }
  return roots;
}

// Intenta expresar r como k/d o (k/d)·π con denominadores pequeños
export function niceExpr(r) {
  for (let d = 1; d <= 12; d++) {
    const k = Math.round(r * d);
    if (Math.abs(r - k / d) < 1e-9) return num(k, d);
  }
  for (let d = 1; d <= 12; d++) {
    const k = Math.round((r / Math.PI) * d);
    if (k !== 0 && Math.abs(r - (k * Math.PI) / d) < 1e-9) return simp(mul(num(k, d), PI));
  }
  return null;
}

const fmt = (x) => (Number.isFinite(x) ? Number(x.toPrecision(10)).toString() : String(x));
export { fmt };

export function definite(f, aE, bE) {
  const a = ev(aE, {}), b = ev(bE, {});
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { error: 'Los límites deben ser números reales finitos.' };
  const h = fx(f);
  const sing = findSingularity(h, Math.min(a, b), Math.max(a, b));
  if (sing !== null) {
    return { error: `El integrando no está definido o diverge cerca de x = ${fmt(sing)} dentro del intervalo. Es una integral impropia o con singularidad; esa parte aún no está implementada.`, singular: sing };
  }
  const sol = solve(f);
  const approx = simpson(h, a, b);
  const out = { a, b, aE, bE, f, steps: sol.steps, F: sol.F, verification: sol.verification, simpson: approx, ftc: [] };
  if (!sol.F) return out;
  const Fb = simp(substVar(sol.F, 'x', bE)), Fa = simp(substVar(sol.F, 'x', aE));
  const exact = simp(add(Fb, neg(Fa)));
  const value = ev(exact, {});
  out.exact = exact; out.value = value;
  out.agree = Number.isFinite(value) && Math.abs(value - approx) <= 1e-6 * (1 + Math.abs(approx));
  const T = (title, math, note) => out.ftc.push({ d: 0, title, math, note });
  T('Teorema fundamental del cálculo', `\\int_{${tex(aE)}}^{${tex(bE)}} ${tex(f)}\\,dx = F(${tex(bE)}) - F(${tex(aE)})`, 'Si F es una antiderivada de f, la integral definida es la diferencia de F en los límites. La constante C se cancela.');
  T('Antiderivada', `F(x) = ${tex(sol.F)}`);
  T('Evaluar en el límite superior', `F(${tex(bE)}) = ${tex(Fb)}`);
  T('Evaluar en el límite inferior', `F(${tex(aE)}) = ${tex(Fa)}`);
  T('Restar', `\\int_{${tex(aE)}}^{${tex(bE)}} ${tex(f)}\\,dx = ${tex(Fb)} - \\left(${tex(Fa)}\\right) = ${tex(exact)} \\approx ${fmt(value)}`);
  return out;
}

export function area(f, g, aE0, bE0) {
  let aE = aE0, bE = bE0, a = ev(aE, {}), b = ev(bE, {});
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { error: 'Los límites deben ser números reales finitos.' };
  let swapped = false;
  if (a > b) { [a, b, aE, bE] = [b, a, bE, aE]; swapped = true; }
  if (a === b) return { error: 'Los límites son iguales: el área es 0.' };
  const hAst = g ? expand(sub(f, g)) : f, h = fx(hAst);
  const sing = findSingularity(h, a, b);
  if (sing !== null) return { error: `La función no está definida o diverge cerca de x = ${fmt(sing)} dentro del intervalo (integral impropia, aún no implementada).` };
  const roots = findRoots(h, a, b);
  const pts = [{ x: a, e: aE }, ...roots.map((x) => ({ x, e: niceExpr(x) })), { x: b, e: bE }];
  const sol = solve(hAst);
  const F = sol.F ? fx(sol.F) : null;
  const pieces = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1];
    let v = F ? F(p1.x) - F(p0.x) : NaN;
    if (!Number.isFinite(v)) v = simpson(h, p0.x, p1.x);
    const mid = h((p0.x + p1.x) / 2);
    const exact = sol.F && p0.e && p1.e ? simp(sub(substVar(sol.F, 'x', p1.e), substVar(sol.F, 'x', p0.e))) : null;
    pieces.push({ from: p0, to: p1, value: v, sign: mid >= 0 ? 1 : -1, exact });
  }
  const signed = pieces.reduce((s, p) => s + p.value, 0);
  const geometric = pieces.reduce((s, p) => s + Math.abs(p.value), 0);
  const exactSigned = sol.F ? simp(sub(substVar(sol.F, 'x', bE), substVar(sol.F, 'x', aE))) : null;
  const exactGeo = pieces.every((p) => p.exact) ? simp(add(...pieces.map((p) => (p.sign < 0 ? neg(p.exact) : p.exact)))) : null;
  const intersections = g ? roots.map((x) => ({ x, y: ev(f, { x }) })) : [];
  return { a, b, aE, bE, swapped, h: hAst, F: sol.F, steps: sol.steps, verification: sol.verification, roots, pieces, signed, geometric, exactSigned, exactGeo, intersections, numericOnly: !sol.F, simpson: simpson(h, a, b) };
}
