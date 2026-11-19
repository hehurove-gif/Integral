// AST -> LaTeX
import { num, mul, pow, simp, rmul } from './ast.js';

const par = (s) => `\\left(${s}\\right)`;
const NAME = { asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan', sin: '\\operatorname{sen}', cos: '\\cos', tan: '\\tan', cot: '\\cot', sec: '\\sec', csc: '\\csc', sinh: '\\operatorname{senh}', cosh: '\\cosh', tanh: '\\tanh', ln: '\\ln' };
const simple = (a) => a.t === 'sym' || (a.t === 'num' && a.q === 1 && a.p >= 0);

function numTex(e) { return e.q === 1 ? `${e.p}` : `${e.p < 0 ? '-' : ''}\\frac{${Math.abs(e.p)}}{${e.q}}`; }
export const isNeg = (t) => (t.t === 'num' && t.p < 0) || (t.t === 'mul' && t.a[0].t === 'num' && t.a[0].p < 0);
function negate(t) {
  if (t.t === 'num') return num(-t.p, t.q);
  const c = num(-t.a[0].p, t.a[0].q), rest = t.a.slice(1);
  if (c.p === 1 && c.q === 1) return rest.length === 1 ? rest[0] : mul(...rest);
  return mul(c, ...rest);
}
function fac(f) { // factor dentro de un producto
  if (f.t === 'add') return par(tex(f));
  return tex(f);
}
function join(list) { // list: [{s, fnLike}]
  return list.reduce((acc, it, i) => (i === 0 ? it.s : acc + (/^[0-9]|^\\frac/.test(it.s) ? '\\cdot ' : list[i - 1].fnLike ? '\\,' : '') + it.s), '');
}
const isFnLike = (f) => f.t === 'fn' || (f.t === 'pow' && f.b.t === 'fn');
function fnTex(e) {
  if (e.n === 'lnabs') return `\\ln\\left|${tex(e.a)}\\right|`;
  const n = NAME[e.n] ?? `\\operatorname{${e.n}}`;
  return simple(e.a) ? `${n} ${tex(e.a)}` : `${n}${par(tex(e.a))}`;
}
function powTex(e) {
  const { b, e: x } = e;
  if (x.t === 'num' && x.p < 0) {
    const inv = simp(pow(b, num(-x.p, x.q)));
    return `\\frac{1}{${tex(inv)}}`;
  }
  if (x.t === 'num' && x.p === 1 && x.q === 2) return `\\sqrt{${tex(b)}}`;
  if (b.t === 'fn' && x.t === 'num' && x.q === 1 && NAME[b.n]) {
    const n = NAME[b.n];
    return simple(b.a) ? `${n}^{${x.p}} ${tex(b.a)}` : `${n}^{${x.p}}${par(tex(b.a))}`;
  }
  const needPar = ['add', 'mul', 'pow'].includes(b.t) || (b.t === 'num' && (b.p < 0 || b.q !== 1)) || (b.t === 'fn');
  const B = needPar ? par(tex(b)) : tex(b);
  return `${B}^{${tex(x)}}`;
}
function mulTex(e) {
  let c = num(1); const rest = [];
  for (const f of e.a) { if (f.t === 'num') c = rmul(c, f); else rest.push(f); }
  const top = [], bot = [];
  for (const f of rest) {
    if (f.t === 'pow' && f.e.t === 'num' && f.e.p < 0) bot.push(simp(pow(f.b, num(-f.e.p, f.e.q))));
    else top.push(f);
  }
  const sign = c.p < 0 ? '-' : '';
  const ap = Math.abs(c.p);
  const wrap = (f) => ({ s: fac(f), fnLike: isFnLike(f) });
  const topS = [...(ap !== 1 || !top.length ? [{ s: `${ap}` }] : []), ...top.map(wrap)];
  const botS = [...(c.q !== 1 ? [{ s: `${c.q}` }] : []), ...bot.map(wrap)];
  if (!botS.length) return sign + join(topS);
  return `${sign}\\frac{${join(topS) || '1'}}{${join(botS)}}`;
}
function addTex(e) {
  return e.a.map((t, i) => {
    if (i === 0) return tex(t);
    return isNeg(t) ? ` - ${tex(negate(t))}` : ` + ${tex(t)}`;
  }).join('');
}
export function tex(e) {
  switch (e.t) {
    case 'num': return numTex(e);
    case 'sym': return e.n === 'pi' ? '\\pi' : e.n;
    case 'fn': return fnTex(e);
    case 'add': return addTex(e);
    case 'mul': return mulTex(e);
    case 'pow': return powTex(e);
  }
}
export const texPar = (e) => (e.t === 'add' ? par(tex(e)) : tex(e));
