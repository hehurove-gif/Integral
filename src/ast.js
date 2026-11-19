// AST + simplificador canónico. Números racionales exactos {p/q}.
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
export const num = (p, q = 1) => { if (q < 0) { p = -p; q = -q; } const g = gcd(p, q); return { t: 'num', p: p / g, q: q / g }; };
export const sym = (n) => ({ t: 'sym', n });
export const add = (...a) => ({ t: 'add', a });
export const mul = (...a) => ({ t: 'mul', a });
export const pow = (b, e) => ({ t: 'pow', b, e });
export const fn = (n, a) => ({ t: 'fn', n, a });
export const neg = (a) => mul(num(-1), a);
export const sub = (a, b) => add(a, neg(b));
export const div = (a, b) => mul(a, pow(b, num(-1)));
export const sqrt = (a) => pow(a, num(1, 2));
export const ONE = num(1), ZERO = num(0), E = sym('e'), PI = sym('pi');
export const isVar = (n) => n !== 'e' && n !== 'pi';
export const isNum = (e) => e.t === 'num';
export const isInt = (e) => e.t === 'num' && e.q === 1;
export const rmul = (a, b) => num(a.p * b.p, a.q * b.q);
export const radd = (a, b) => num(a.p * b.q + b.p * a.q, a.q * b.q);
export const val = (e) => e.p / e.q;

export function K(e) {
  switch (e.t) {
    case 'num': return e.q === 1 ? `${e.p}` : `${e.p}/${e.q}`;
    case 'sym': return e.n;
    case 'fn': return `${e.n}(${K(e.a)})`;
    case 'add': return `+(${e.a.map(K).join(',')})`;
    case 'mul': return `*(${e.a.map(K).join(',')})`;
    case 'pow': return `^(${K(e.b)},${K(e.e)})`;
  }
}
export const eq = (a, b) => K(a) === K(b);
export function has(e, v) {
  switch (e.t) {
    case 'num': return false;
    case 'sym': return e.n === v;
    case 'fn': return has(e.a, v);
    case 'pow': return has(e.b, v) || has(e.e, v);
    default: return e.a.some((x) => has(x, v));
  }
}
export const factors = (e) => (e.t === 'mul' ? e.a : [e]);
export const terms = (e) => (e.t === 'add' ? e.a : [e]);
export function size(e) {
  switch (e.t) {
    case 'num': case 'sym': return 1;
    case 'fn': return 1 + size(e.a);
    case 'pow': return 1 + size(e.b) + size(e.e);
    default: return 1 + e.a.reduce((s, x) => s + size(x), 0);
  }
}
export function map(e, f) { // aplica f a los hijos
  switch (e.t) {
    case 'num': case 'sym': return e;
    case 'fn': return fn(e.n, f(e.a));
    case 'pow': return pow(f(e.b), f(e.e));
    case 'add': return add(...e.a.map(f));
    case 'mul': return mul(...e.a.map(f));
  }
}
export function replace(e, from, to) {
  const k = K(from);
  const go = (x) => (K(x) === k ? to : map(x, go));
  return go(e);
}
export const substVar = (e, v, to) => simp(map1(e, (x) => (x.t === 'sym' && x.n === v ? to : null)));
function map1(e, pre) { const r = pre(e); return r ? r : map(e, (x) => map1(x, pre)); }

// ---------- simplificación ----------
function exactRoot(n, k) { if (n < 0) return null; const r = Math.round(Math.pow(n, 1 / k)); return r ** k === n ? r : null; }
function numPow(b, e) {
  if (b.p === 0) return e.p > 0 ? num(0) : null;
  if (e.q === 1) {
    if (Math.abs(e.p) > 30) return null;
    const p = b.p ** Math.abs(e.p), q = b.q ** Math.abs(e.p);
    if (!Number.isSafeInteger(p) || !Number.isSafeInteger(q)) return null;
    return e.p >= 0 ? num(p, q) : num(q, p);
  }
  const rp = exactRoot(Math.abs(b.p), e.q), rq = exactRoot(b.q, e.q);
  if (rp === null || rq === null || (b.p < 0 && e.q % 2 === 0)) return null;
  const s = b.p < 0 ? -1 : 1;
  return numPow(num(s * rp, rq), num(e.p));
}
function frank(f) {
  if (f.t === 'sym') return isVar(f.n) ? 0 : 1;
  if (f.t === 'pow') {
    if (f.b.t === 'sym' && isVar(f.b.n)) return 0;
    if (f.b.t === 'sym' && f.b.n === 'e') return 4;
    if (f.b.t === 'add') return 2;
    if (f.b.t === 'fn') return 3;
    return f.b.t === 'num' ? 1 : 3;
  }
  if (f.t === 'add') return 2;
  return 3;
}
function polyDeg(t) {
  if (t.t === 'num') return 0;
  const r = t.t === 'mul' && t.a[0].t === 'num' ? (t.a.length === 2 ? t.a[1] : null) : t;
  if (!r) return null;
  if (r.t === 'sym' && isVar(r.n)) return 1;
  if (r.t === 'pow' && r.b.t === 'sym' && isVar(r.b.n) && r.e.t === 'num') return val(r.e);
  return null;
}
function simpAdd(ts) {
  const flat = [];
  (function f(a) { for (const t of a) { if (t.t === 'add') f(t.a); else flat.push(t); } })(ts);
  const m = new Map(); let c = num(0);
  for (const t of flat) {
    if (t.t === 'num') { c = radd(c, t); continue; }
    let co = num(1), rest = [t];
    if (t.t === 'mul' && t.a[0].t === 'num') { co = t.a[0]; rest = t.a.slice(1); }
    const k = rest.map(K).join('*');
    const cur = m.get(k);
    if (cur) cur.co = radd(cur.co, co); else m.set(k, { co, rest });
  }
  const out = [];
  for (const { co, rest } of m.values()) {
    if (co.p === 0) continue;
    out.push(co.p === 1 && co.q === 1 ? (rest.length === 1 ? rest[0] : mul(...rest)) : mul(co, ...rest));
  }
  if (c.p !== 0) out.push(c);
  if (!out.length) return num(0);
  if (out.length === 1) return out[0];
  out.sort((x, y) => {
    const dx = polyDeg(x), dy = polyDeg(y);
    if (dx === null && dy === null) return K(x) < K(y) ? -1 : 1;
    if (dx === null) return -1;
    if (dy === null) return 1;
    return dy - dx;
  });
  return { t: 'add', a: out };
}
function simpMul(fs) {
  let c = num(1); const g = new Map();
  const push = (f) => {
    if (f.t === 'mul') { f.a.forEach(push); return; }
    if (f.t === 'num') { c = rmul(c, f); return; }
    let b = f, e = num(1);
    if (f.t === 'pow') { b = f.b; e = f.e; }
    const k = K(b); const x = g.get(k);
    if (x) x.es.push(e); else g.set(k, { b, es: [e] });
  };
  fs.forEach(push);
  if (c.p === 0) return num(0);
  const out = []; let again = false;
  for (const { b, es } of g.values()) {
    const p = simpPow(b, es.length === 1 ? es[0] : simpAdd(es));
    if (p.t === 'num') c = rmul(c, p);
    else if (p.t === 'mul') { again = true; out.push(p); }
    else out.push(p);
  }
  if (again) return simpMul([c, ...out]);
  out.sort((x, y) => frank(x) - frank(y) || (K(x) < K(y) ? -1 : 1));
  const all = c.p === 1 && c.q === 1 ? out : [c, ...out];
  if (!all.length) return num(1);
  return all.length === 1 ? all[0] : { t: 'mul', a: all };
}
function simpPow(b, e) {
  if (e.t === 'num') {
    if (e.p === 0) return num(1);
    if (e.p === 1 && e.q === 1) return b;
    if (b.t === 'num') { const r = numPow(b, e); if (r) return r; }
    if (e.q === 1 && b.t === 'pow') return simpPow(b.b, simpMul([b.e, e]));
    if (e.q === 1 && b.t === 'mul') return simpMul(b.a.map((x) => simpPow(x, e)));
  }
  if (b.t === 'num' && b.p === 1 && b.q === 1) return num(1);
  if (b.t === 'pow' && b.b.t === 'sym' && b.b.n === 'e') return simpPow(b.b, simpMul([b.e, e]));
  if (b.t === 'sym' && b.n === 'e' && e.t === 'fn' && e.n === 'ln') return e.a;
  return { t: 'pow', b, e };
}
// sin(r·π) exacto para r = k/12 con valores conocidos
function sinPi(r) {
  if (12 % r.q) return null;
  let t = ((r.p * (12 / r.q)) % 24 + 24) % 24, s = 1;
  if (t >= 12) { t -= 12; s = -1; }
  if (t > 6) t = 12 - t;
  const T = { 0: num(0), 2: num(1, 2), 3: mul(num(1, 2), pow(num(2), num(1, 2))), 4: mul(num(1, 2), pow(num(3), num(1, 2))), 6: num(1) };
  return T[t] ? simp(mul(num(s), T[t])) : null;
}
function ratOfPi(a) {
  if (a.t === 'num' && a.p === 0) return num(0);
  if (a.t === 'sym' && a.n === 'pi') return num(1);
  if (a.t === 'mul' && a.a.length === 2 && a.a[0].t === 'num' && a.a[1].t === 'sym' && a.a[1].n === 'pi') return a.a[0];
  return null;
}
const ODD = new Set(['sin', 'tan', 'cot', 'csc', 'asin', 'atan', 'sinh', 'tanh', 'ln_']);
const EVEN = new Set(['cos', 'sec', 'cosh']);
function simpFn(n, a) {
  const negA = (a.t === 'num' && a.p < 0) || (a.t === 'mul' && a.a[0].t === 'num' && a.a[0].p < 0);
  if (negA && (ODD.has(n) || EVEN.has(n))) {
    const r = simpFn(n, simpMul([num(-1), a]));
    return ODD.has(n) ? simpMul([num(-1), r]) : r;
  }
  const r = ratOfPi(a);
  if (r && ['sin', 'cos', 'tan', 'cot', 'sec', 'csc'].includes(n)) {
    const s = sinPi(r), c = sinPi(num(r.q - 2 * r.p, 2 * r.q)); // cos(rπ) = sin(π/2 − rπ)
    const zero = (x) => x && x.t === 'num' && x.p === 0;
    const inv = (x) => simpPow(x, num(-1));
    if (s && c) {
      if (n === 'sin') return s;
      if (n === 'cos') return c;
      if (n === 'tan' && !zero(c)) return simpMul([s, inv(c)]);
      if (n === 'cot' && !zero(s)) return simpMul([c, inv(s)]);
      if (n === 'sec' && !zero(c)) return inv(c);
      if (n === 'csc' && !zero(s)) return inv(s);
    }
  }
  if (a.t === 'num') {
    if (a.p === 0 && ['sin', 'tan', 'asin', 'atan', 'sinh', 'tanh'].includes(n)) return num(0);
    if (a.p === 0 && ['cos', 'cosh', 'sec'].includes(n)) return num(1);
    if (a.p === 1 && a.q === 1) {
      if (n === 'ln' || n === 'lnabs' || n === 'acos') return num(0);
      if (n === 'atan') return mul(num(1, 4), PI);
      if (n === 'asin') return mul(num(1, 2), PI);
    }
    if (a.p === 0 && n === 'acos') return mul(num(1, 2), PI);
  }
  if (a.t === 'sym' && a.n === 'e' && (n === 'ln' || n === 'lnabs')) return num(1);
  return { t: 'fn', n, a };
}
export function simp(e) {
  switch (e.t) {
    case 'num': case 'sym': return e;
    case 'fn': return simpFn(e.n, simp(e.a));
    case 'pow': return simpPow(simp(e.b), simp(e.e));
    case 'add': return simpAdd(e.a.map(simp));
    case 'mul': return simpMul(e.a.map(simp));
  }
}
// ---------- expansión ----------
export function expand(e) {
  e = simp(e);
  const go = (x) => {
    switch (x.t) {
      case 'add': return simp(add(...x.a.map(go)));
      case 'mul': {
        let acc = [num(1)];
        for (const f of x.a.map(go)) {
          const ts = terms(f); const nx = [];
          for (const a of acc) for (const t of ts) nx.push(simp(mul(a, t)));
          acc = nx;
        }
        return simp(add(...acc));
      }
      case 'pow':
        if (x.e.t === 'num' && x.e.q === 1 && x.e.p >= 2 && x.e.p <= 8 && x.b.t === 'add') {
          let r = go(x.b);
          for (let i = 1; i < x.e.p; i++) r = go(mul(r, x.b));
          return r;
        }
        return simp(pow(go(x.b), x.e));
      default: return x;
    }
  };
  return go(e);
}
