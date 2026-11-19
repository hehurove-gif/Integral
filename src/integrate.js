// Motor de integración simbólica con pasos didácticos (basado en reglas).
import {
  num, sym, add, mul, pow, fn, neg, sub, simp, expand, has, K, eq, factors, size, replace, substVar,
  isInt, isNum, val, ONE, E, PI, rmul,
} from './ast.js';
import { D } from './diff.js';
import { tex, texPar } from './latex.js';
import { ev } from './eval.js';

const S = (st, d, title, math, note) => st.push({ d, title, math, note });
const intT = (f, v) => `\\int ${texPar(f)}\\,d${v}`;
const fresh = (v) => (v === 'u' ? 'w' : v === 'w' ? 'z' : 'u');
const MAXD = 9;

export function integ(f, v, st, d) {
  f = simp(f);
  if (d > MAXD) return null;
  for (const rule of RULES) {
    const mark = st.length;
    const r = rule(f, v, st, d);
    if (r) return simp(r);
    st.length = mark;
  }
  return null;
}

// ---------- reglas ----------
function ruleConst(f, v, st, d) {
  if (has(f, v)) return null;
  const r = simp(mul(f, sym(v)));
  S(st, d, 'Integral de una constante', `${intT(f, v)} = ${tex(r)}`, 'La integral de una constante k es k·x.');
  return r;
}

function ruleSum(f, v, st, d) {
  if (f.t !== 'add') return null;
  S(st, d, 'Linealidad de la integral', `\\int \\left(${tex(f)}\\right)d${v} = ${f.a.map((t, i) => (i ? '+' : '') + intT(t, v)).join(' ')}`,
    'La integral de una suma es la suma de las integrales de cada término.');
  const parts = [];
  for (const [i, t] of f.a.entries()) {
    S(st, d + 1, `Término ${i + 1}`, intT(t, v));
    const r = integ(t, v, st, d + 1);
    if (!r) return null;
    parts.push(r);
  }
  const res = simp(add(...parts));
  S(st, d, 'Suma de los resultados', tex(res));
  return res;
}

function ruleConstMul(f, v, st, d) {
  if (f.t !== 'mul') return null;
  const k = [], rest = [];
  for (const x of f.a) (has(x, v) ? rest : k).push(x);
  if (!k.length || !rest.length) return null;
  const kk = simp(mul(...k)), g = simp(mul(...rest));
  const kt = kk.t === 'num' && kk.p === -1 && kk.q === 1 ? '-' : texPar(kk);
  S(st, d, 'Sacar la constante', `${intT(f, v)} = ${kt}${intT(g, v)}`, 'Un factor constante puede salir de la integral.');
  const r = integ(g, v, st, d + 1);
  return r && simp(mul(kk, r));
}

// tabla de integrales inmediatas
function tableMatch(f, v) {
  const x = sym(v), kf = K(f);
  const is = (g) => kf === K(simp(g));
  const lnabs = (a) => fn('lnabs', a);
  if (f.t === 'sym' && f.n === v) return [mul(num(1, 2), pow(x, num(2))), 'Regla de la potencia: ∫xⁿ dx = xⁿ⁺¹/(n+1), con n = 1.'];
  if (f.t === 'pow' && f.b.t === 'sym' && f.b.n === v && isNum(f.e)) {
    if (f.e.p === -1 && f.e.q === 1) return [lnabs(x), '∫1/x dx = ln|x|: es el caso n = −1, donde no aplica la regla de la potencia.'];
    const n1 = num(f.e.p + f.e.q, f.e.q);
    return [mul(pow(x, n1), pow(n1, num(-1))), `Regla de la potencia: ∫xⁿ dx = xⁿ⁺¹/(n+1), con n = ${f.e.q === 1 ? f.e.p : f.e.p + '/' + f.e.q}.`];
  }
  if (f.t === 'pow' && f.b.t === 'sym' && f.b.n === 'e' && f.e.t === 'sym' && f.e.n === v) return [f, '∫eˣ dx = eˣ.'];
  if (f.t === 'pow' && f.b.t === 'num' && f.b.p > 0 && !(f.b.p === 1 && f.b.q === 1) && f.e.t === 'sym' && f.e.n === v)
    return [mul(f, pow(fn('ln', f.b), num(-1))), '∫aˣ dx = aˣ/ln(a).'];
  if (f.t === 'fn' && f.a.t === 'sym' && f.a.n === v) {
    const T = {
      sin: [neg(fn('cos', x)), '∫sen x dx = −cos x.'], cos: [fn('sin', x), '∫cos x dx = sen x.'],
      tan: [neg(lnabs(fn('cos', x))), '∫tan x dx = −ln|cos x|.'], cot: [lnabs(fn('sin', x)), '∫cot x dx = ln|sen x|.'],
      sec: [lnabs(add(fn('sec', x), fn('tan', x))), '∫sec x dx = ln|sec x + tan x|.'],
      csc: [neg(lnabs(add(fn('csc', x), fn('cot', x)))), '∫csc x dx = −ln|csc x + cot x|.'],
      sinh: [fn('cosh', x), '∫senh x dx = cosh x.'], cosh: [fn('sinh', x), '∫cosh x dx = senh x.'],
    }[f.n];
    if (T) return T;
  }
  if (is(pow(fn('sec', x), num(2)))) return [fn('tan', x), '∫sec²x dx = tan x (porque d/dx tan x = sec²x).'];
  if (is(pow(fn('csc', x), num(2)))) return [neg(fn('cot', x)), '∫csc²x dx = −cot x.'];
  if (is(mul(fn('sec', x), fn('tan', x)))) return [fn('sec', x), '∫sec x tan x dx = sec x.'];
  if (is(mul(fn('csc', x), fn('cot', x)))) return [neg(fn('csc', x)), '∫csc x cot x dx = −csc x.'];
  // 1/(x²+a²), 1/√(a²−x²), 1/√(x²±a²)
  if (f.t === 'pow' && f.b.t === 'add' && f.b.a.length === 2 && isNum(f.e)) {
    const [p, q] = f.b.a;
    const sq = (t) => t.t === 'pow' && t.b.t === 'sym' && t.b.n === v && eq(t.e, num(2));
    const cst = (t) => t.t === 'num';
    const find = (A, B) => (sq(A) && cst(B)) || null;
    let c = null, s = 1;
    if (find(p, q)) { c = q; s = 1; } else if (find(q, p)) { c = p; s = 1; }
    let negSq = false;
    if (!c) { // −x² + a²
      const m = (t) => t.t === 'mul' && t.a.length === 2 && t.a[0].t === 'num' && t.a[0].p === -1 && t.a[0].q === 1 && sq(t.a[1]);
      if (m(p) && cst(q)) { c = q; negSq = true; } else if (m(q) && cst(p)) { c = p; negSq = true; }
    }
    if (c && c.p > 0 && s) {
      const a = simp(pow(c, num(1, 2)));
      const xa = simp(mul(x, pow(a, num(-1))));
      if (!negSq && f.e.p === -1 && f.e.q === 1) return [mul(pow(a, num(-1)), fn('atan', xa)), '∫dx/(x²+a²) = (1/a)·arctan(x/a), con a² = ' + tex(c).replace(/\\frac\{(\d+)\}\{(\d+)\}/, '$1/$2') + '.'];
      if (negSq && f.e.p === -1 && f.e.q === 2) return [fn('asin', xa), '∫dx/√(a²−x²) = arcsen(x/a), con a² = ' + tex(c) + '.'];
      if (!negSq && f.e.p === -1 && f.e.q === 2) return [fn('lnabs', add(x, pow(add(pow(x, num(2)), c), num(1, 2)))), '∫dx/√(x²+k) = ln|x + √(x²+k)|.'];
    }
    if (!c && f.e.p === -1 && f.e.q === 2) { // 1/√(x²−a²)
      const m = (t) => t.t === 'num' && t.p < 0;
      if ((sq(p) && m(q)) || (sq(q) && m(p))) return [fn('lnabs', add(x, pow(f.b, num(1, 2)))), '∫dx/√(x²−a²) = ln|x + √(x²−a²)|.'];
    }
  }
  return null;
}
function ruleTable(f, v, st, d) {
  const m = tableMatch(f, v);
  if (!m) return null;
  const r = simp(m[0]);
  S(st, d, 'Integral inmediata', `${intT(f, v)} = ${tex(r)}`, m[1]);
  return r;
}

// e^{ax}·sen(bx) / e^{ax}·cos(bx): partes dos veces (caso cíclico)
function ruleExpTrig(f, v, st, d) {
  const fs = factors(f);
  if (fs.length !== 2) return null;
  const lin = (a) => { // a = c·x -> c
    if (a.t === 'sym' && a.n === v) return num(1);
    if (a.t === 'mul' && a.a.length === 2 && a.a[0].t === 'num' && a.a[1].t === 'sym' && a.a[1].n === v) return a.a[0];
    return null;
  };
  const ex = fs.find((g) => g.t === 'pow' && g.b.t === 'sym' && g.b.n === 'e' && lin(g.e));
  const tr = fs.find((g) => g.t === 'fn' && (g.n === 'sin' || g.n === 'cos') && lin(g.a));
  if (!ex || !tr) return null;
  const a = lin(ex.e), b = lin(tr.a);
  const den = num(a.p * a.p * b.q * b.q + b.p * b.p * a.q * a.q, a.q * a.q * b.q * b.q); // a²+b²
  const sinCase = tr.n === 'sin';
  const res = sinCase
    ? mul(ex, add(mul(a, tr), neg(mul(b, fn('cos', tr.a)))), pow(den, num(-1)))
    : mul(ex, add(mul(a, tr), mul(b, fn('sin', tr.a))), pow(den, num(-1)));
  const sn = `\\operatorname{sen}(${tex(tr.a)})`, cs = `\\cos(${tex(tr.a)})`, e = tex(ex);
  const [T1, T2] = sinCase ? [sn, cs] : [cs, sn]; // T1 = la función original, T2 = su "pareja"
  const co = (c) => (c.p === 1 && c.q === 1 ? '' : c.p === -1 && c.q === 1 ? '-' : tex(c));
  const term = (c, t) => (c.p < 0 ? ' - ' : ' + ') + co(num(Math.abs(c.p), c.q)) + t;
  const c1 = num(a.q, a.p), c2 = num(b.p * a.q, b.q * a.p), c3 = num(b.p * a.q * a.q, b.q * a.p * a.p), c4 = num(b.p * b.p * a.q * a.q, b.q * b.q * a.p * a.p);
  const sg = sinCase ? 1 : -1; // signo del término con la pareja
  S(st, d, 'Integración por partes dos veces (caso cíclico)', `I = ${intT(f, v)}`,
    'Al integrar por partes dos veces reaparece la integral original I; entonces se despeja I como si fuera una ecuación.');
  S(st, d + 1, '1.ª integración por partes', `u=${T1},\\; dv=${e}\\,d${v} \\;\\Rightarrow\\; I = ${co(c1)}${e}${T1}${term(num(-sg * c2.p, c2.q), `\\int ${e}${T2}\\,d${v}`)}`);
  S(st, d + 1, '2.ª integración por partes', `\\int ${e}${T2}\\,d${v} = ${co(c1)}${e}${T2}${term(num(sg * c2.p, c2.q), 'I')}`,
    'Se repite con u = la función trigonométrica; vuelve a aparecer I.');
  S(st, d + 1, 'Sustituir y despejar I', `I = ${co(c1)}${e}${T1}${term(num(-sg * c3.p, c3.q), e + T2)}${term(num(-c4.p, c4.q), 'I')} \\;\\Rightarrow\\; I\\left(1 + ${tex(c4)}\\right) = \\dots \\;\\Rightarrow\\; I = ${tex(simp(res))}`);
  return res;
}

// ---------- integración por partes ----------
function cls(f, v) {
  if (f.t === 'fn' && (f.n === 'ln' || f.n === 'lnabs') && has(f, v)) return 'L';
  if (f.t === 'pow' && f.b.t === 'fn' && (f.b.n === 'ln') && isInt(f.e) && f.e.p > 0) return 'L';
  if (f.t === 'fn' && ['atan', 'asin', 'acos'].includes(f.n) && has(f, v)) return 'I';
  if (f.t === 'sym' && f.n === v) return 'A';
  if (f.t === 'pow' && f.b.t === 'sym' && f.b.n === v && isNum(f.e)) return 'A';
  if (f.t === 'fn' && ['sin', 'cos', 'tan', 'sinh', 'cosh'].includes(f.n) && has(f, v)) return 'T';
  if (f.t === 'pow' && f.b.t === 'fn' && ['sin', 'cos'].includes(f.b.n) && isInt(f.e) && f.e.p > 0) return 'T';
  if (f.t === 'pow' && f.b.t === 'sym' && f.b.n === 'e' && has(f.e, v)) return 'E';
  if (f.t === 'pow' && f.b.t === 'num' && has(f.e, v)) return 'E';
  return null;
}
const RANK = { L: 1, I: 2, A: 3, T: 4, E: 5 };
function ruleParts(f, v, st, d) {
  if (d > 7) return null;
  const fs = factors(f), cl = fs.map((g) => cls(g, v));
  if (cl.some((c) => !c)) return null;
  if (fs.length === 1 && cl[0] !== 'L' && cl[0] !== 'I') return null;
  if (fs.length > 1 && new Set(cl).size < 2) return null;
  let iu = 0;
  cl.forEach((c, i) => { if (RANK[c] < RANK[cl[iu]]) iu = i; });
  const u = fs[iu], dv = simp(mul(...fs.filter((_, i) => i !== iu), ONE));
  S(st, d, 'Integración por partes', `\\int u\\,dv = uv - \\int v\\,du`,
    'Se elige u según LIATE (Logarítmica, Inversa trigonométrica, Algebraica, Trigonométrica, Exponencial): u es el factor que aparece primero.');
  S(st, d + 1, 'Elección', `u = ${tex(u)}, \\qquad dv = ${tex(dv)}\\,d${v}`);
  S(st, d + 1, 'Integrar dv para obtener v', `v = \\int ${texPar(dv)}\\,d${v}`);
  const vv = integ(dv, v, st, d + 2);
  if (!vv) return null;
  const du = D(u, v), w = simp(mul(vv, du));
  S(st, d + 1, 'Derivar u', `du = ${tex(du)}\\,d${v}, \\qquad v = ${tex(vv)}`);
  const uv = simp(mul(u, vv));
  S(st, d + 1, 'Aplicar la fórmula', `${intT(f, v)} = ${tex(uv)} - ${intT(w, v)}`);
  const r = integ(w, v, st, d + 2);
  if (!r) return null;
  const res = simp(add(uv, neg(r)));
  S(st, d + 1, 'Resultado', tex(res));
  return res;
}

// ---------- sustitución ----------
function candidates(f, v) {
  const out = new Map();
  const push = (c) => { if (has(c, v) && !(c.t === 'sym') && c.t !== 'num') out.set(K(c), c); };
  (function walk(e) {
    if (e.t === 'fn') { push(e.a); push(e); }
    if (e.t === 'pow') { push(e.b); push(e.e); push(e); }
    if (e.t === 'add' || e.t === 'mul') e.a.forEach(walk);
    if (e.t === 'fn') walk(e.a);
    if (e.t === 'pow') { walk(e.b); walk(e.e); }
  })(f);
  return [...out.values()].sort((a, b) => size(a) - size(b));
}
function toU(q, u, U) {
  const Us = sym(U);
  if (!(u.t === 'pow' && u.e.t === 'num')) return simp(replace(q, u, Us));
  // u = B^m: solo se reescribe B^k cuando k/m es entero (x⁴ -> u² si u = x²).
  // Reescribir x como u^(1/2) sería falso para x < 0.
  const go = (e) => {
    if (eq(e, u)) return Us;
    if (e.t === 'pow' && eq(e.b, u.b) && e.e.t === 'num') {
      const k = num(e.e.p * u.e.q, e.e.q * u.e.p);
      return k.q === 1 ? pow(Us, k) : { t: 'pow', b: e.b, e: e.e };
    }
    switch (e.t) {
      case 'num': case 'sym': return e;
      case 'fn': return fn(e.n, go(e.a));
      case 'pow': return pow(go(e.b), go(e.e));
      default: return { t: e.t, a: e.a.map(go) };
    }
  };
  return simp(go(q));
}
function ruleUSub(f, v, st, d) {
  if (d > 6) return null;
  const U = fresh(v);
  for (const cand of candidates(f, v)) {
    const du = D(cand, v);
    if (du.t === 'num' && du.p === 0) continue;
    let q, how;
    if (du.t === 'num') { // sustitución lineal: x = (u − b)/a
      const b = simp(sub(cand, mul(du, sym(v))));
      if (has(b, v)) continue;
      const xs = simp(mul(sub(sym(U), b), pow(du, num(-1))));
      q = simp(mul(substVar(f, v, xs), pow(du, num(-1))));
      how = `x = ${tex(xs)}`;
    } else {
      q = toU(simp(mul(f, pow(du, num(-1)))), cand, U);
      how = null;
    }
    if (has(q, v)) continue;
    if (eq(q, f)) continue;
    const mark = st.length;
    S(st, d, 'Sustitución (cambio de variable)', `${U} = ${tex(cand)}, \\qquad d${U} = ${tex(du)}\\,d${v}${how ? ',\\qquad ' + how : ''}`,
      du.t === 'num' ? 'El argumento es lineal, así que du es una constante y se puede despejar x.' : `Se busca que aparezca la derivada de ${U} en el integrando para que todo quede en términos de ${U}.`);
    S(st, d + 1, 'Reescribir en términos de ' + U, `${intT(f, v)} = ${intT(q, U)}`);
    const r = integ(q, U, st, d + 1);
    if (!r) { st.length = mark; continue; }
    const res = simp(substVar(r, U, cand));
    S(st, d + 1, `Regresar a ${v}`, `${U} = ${tex(cand)} \\;\\Rightarrow\\; ${tex(res)}`);
    return res;
  }
  return null;
}

// ---------- potencias trigonométricas ----------
function ruleTrig(f, v, st, d) {
  const x = sym(v);
  // tan^n, cot^n
  if (f.t === 'pow' && f.b.t === 'fn' && (f.b.n === 'tan' || f.b.n === 'cot') && f.b.a.t === 'sym' && f.b.a.n === v && isInt(f.e) && f.e.p >= 2) {
    const n = f.e.p, isT = f.b.n === 'tan', w = isT ? 'sec' : 'csc';
    const lo = simp(pow(f.b, num(n - 2)));
    const g = simp(add(mul(lo, pow(fn(w, x), num(2))), neg(lo)));
    S(st, d, 'Identidad trigonométrica', `${isT ? '\\tan' : '\\cot'}^{2}x = ${isT ? '\\sec' : '\\csc'}^{2}x - 1 \\;\\Rightarrow\\; ${intT(f, v)} = ${intT(g, v)}`,
      `Se separa ${isT ? 'tan' : 'cot'}ⁿ = ${isT ? 'tan' : 'cot'}ⁿ⁻²·(${w}²−1).`);
    return integ(g, v, st, d + 1);
  }
  // sen^m cos^n
  const fs = factors(f); let m = 0, n = 0;
  for (const g of fs) {
    let b = g, k = 1;
    if (g.t === 'pow' && isInt(g.e) && g.e.p > 0) { b = g.b; k = g.e.p; }
    if (b.t === 'fn' && b.a.t === 'sym' && b.a.n === v && (b.n === 'sin' || b.n === 'cos')) { if (b.n === 'sin') m += k; else n += k; } else return null;
  }
  if (m + n < 2 || m + n > 12) return null;
  const U = fresh(v), Us = sym(U);
  const oneMinus = (p) => pow(sub(ONE, pow(Us, num(2))), num(p));
  if (m % 2 === 1) {
    const k = (m - 1) / 2, g = simp(mul(num(-1), oneMinus(k), pow(Us, num(n))));
    S(st, d, 'Potencia impar de seno', `\\operatorname{sen}^{${m}}x = (\\operatorname{sen}^2 x)^{${k}}\\operatorname{sen}x = (1-\\cos^2 x)^{${k}}\\operatorname{sen}x`, 'Se aparta un sen x y el resto se escribe con cos x usando sen²x = 1 − cos²x.');
    S(st, d, 'Sustitución', `${U} = \\cos x, \\qquad d${U} = -\\operatorname{sen}x\\,d${v}`);
    S(st, d + 1, 'Reescribir', `${intT(f, v)} = ${intT(g, U)}`);
    const r = integ(g, U, st, d + 1);
    if (!r) return null;
    const res = simp(substVar(r, U, fn('cos', x)));
    S(st, d + 1, `Regresar a ${v}`, tex(res));
    return res;
  }
  if (n % 2 === 1) {
    const k = (n - 1) / 2, g = simp(mul(pow(Us, num(m)), oneMinus(k)));
    S(st, d, 'Potencia impar de coseno', `\\cos^{${n}}x = (\\cos^2 x)^{${k}}\\cos x = (1-\\operatorname{sen}^2 x)^{${k}}\\cos x`, 'Se aparta un cos x y el resto se escribe con sen x usando cos²x = 1 − sen²x.');
    S(st, d, 'Sustitución', `${U} = \\operatorname{sen}x, \\qquad d${U} = \\cos x\\,d${v}`);
    S(st, d + 1, 'Reescribir', `${intT(f, v)} = ${intT(g, U)}`);
    const r = integ(g, U, st, d + 1);
    if (!r) return null;
    const res = simp(substVar(r, U, fn('sin', x)));
    S(st, d + 1, `Regresar a ${v}`, tex(res));
    return res;
  }
  // ambas pares: ángulo doble
  const c2 = fn('cos', mul(num(2), x));
  const sin2 = mul(num(1, 2), sub(ONE, c2)), cos2 = mul(num(1, 2), add(ONE, c2));
  const g = expand(mul(pow(sin2, num(m / 2)), pow(cos2, num(n / 2))));
  S(st, d, 'Identidades de ángulo doble', `\\operatorname{sen}^2 x = \\frac{1-\\cos 2x}{2}, \\qquad \\cos^2 x = \\frac{1+\\cos 2x}{2}`, 'Ambas potencias son pares: se reducen con las identidades del ángulo doble.');
  S(st, d + 1, 'Reescribir', `${intT(f, v)} = ${intT(g, v)}`);
  return integ(g, v, st, d + 1);
}

function ruleExpand(f, v, st, d) {
  const g = expand(f);
  if (eq(g, f)) return null;
  S(st, d, 'Expandir el integrando', `${intT(f, v)} = ${intT(g, v)}`, 'Se desarrollan productos y potencias para poder integrar término a término.');
  return integ(g, v, st, d + 1);
}

const RULES = [ruleConst, ruleSum, ruleConstMul, ruleTable, ruleExpTrig, ruleParts, ruleUSub, ruleTrig, ruleExpand];

// ---------- API ----------
export function solve(f, v = 'x') {
  f = simp(f);
  const steps = [];
  S(steps, 0, 'Planteamiento', `\\int ${texPar(f)}\\,d${v}`);
  const F = integ(f, v, steps, 0);
  if (!F) return { f, F: null, steps, verification: null };
  S(steps, 0, 'Resultado', `${intT(f, v)} = ${tex(F)} + C`, 'Se añade la constante de integración C.');
  return { f, F, steps, verification: verify(f, F, v) };
}

export function verify(f, F, v = 'x') {
  const dF = D(F, v);
  let ok = 0, bad = 0;
  for (let x = -4.1; x <= 6.3; x += 0.37) {
    const a = ev(dF, { [v]: x }), b = ev(f, { [v]: x });
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (Math.abs(a - b) <= 1e-7 * (1 + Math.abs(b))) ok++; else bad++;
  }
  return { ok: bad === 0 && ok >= 4, points: ok, derivative: dF };
}
