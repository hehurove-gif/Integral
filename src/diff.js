// Derivada simbólica (se usa para sustitución, partes y comprobación).
import { num, add, mul, pow, fn, neg, sub, div, simp, has, E, ONE, K } from './ast.js';

export function D(e, v = 'x') { return simp(d(e, v)); }

function d(e, v) {
  if (!has(e, v)) return num(0);
  switch (e.t) {
    case 'sym': return num(1);
    case 'add': return add(...e.a.map((x) => d(x, v)));
    case 'mul': return add(...e.a.map((_, i) => mul(...e.a.map((x, j) => (i === j ? d(x, v) : x)))));
    case 'pow': {
      const { b, e: ex } = e;
      if (!has(ex, v)) return mul(ex, pow(b, sub(ex, ONE)), d(b, v));
      if (!has(b, v)) return mul(e, fn('ln', b), d(ex, v));
      return mul(e, add(mul(d(ex, v), fn('ln', b)), div(mul(ex, d(b, v)), b)));
    }
    case 'fn': {
      const u = e.a, du = d(u, v);
      const one = (x) => x;
      const t = {
        sin: () => fn('cos', u), cos: () => neg(fn('sin', u)),
        tan: () => pow(fn('sec', u), num(2)), cot: () => neg(pow(fn('csc', u), num(2))),
        sec: () => mul(fn('sec', u), fn('tan', u)), csc: () => neg(mul(fn('csc', u), fn('cot', u))),
        asin: () => pow(sub(ONE, pow(u, num(2))), num(-1, 2)), acos: () => neg(pow(sub(ONE, pow(u, num(2))), num(-1, 2))),
        atan: () => pow(add(ONE, pow(u, num(2))), num(-1)),
        sinh: () => fn('cosh', u), cosh: () => fn('sinh', u), tanh: () => sub(ONE, pow(fn('tanh', u), num(2))),
        ln: () => pow(u, num(-1)), lnabs: () => pow(u, num(-1)),
      }[e.n];
      return mul(one(t()), du);
    }
  }
  return num(0);
}
void E; void K;
