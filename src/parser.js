// Parser de expresiones en texto -> AST. Solo variable x.
import { num, sym, add, mul, pow, fn, neg, sub, div, sqrt, E, PI, simp } from './ast.js';

const FUNCS = {
  sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', sec: 'sec', csc: 'csc',
  asin: 'asin', acos: 'acos', atan: 'atan', arcsin: 'asin', arccos: 'acos', arctan: 'atan',
  sinh: 'sinh', cosh: 'cosh', tanh: 'tanh', ln: 'ln', exp: 'exp', sqrt: 'sqrt',
};
const NAMES = [...Object.keys(FUNCS), 'pi', 'x', 'e'].sort((a, b) => b.length - a.length);

function decimal(s) {
  const [i, f = ''] = s.split('.');
  if (i.length + f.length > 15) throw new Error(`Número demasiado largo: ${s}`);
  return num(Number(i + f), 10 ** f.length);
}

function tokenize(src) {
  const s = src.replace(/−/g, '-').replace(/[×·]/g, '*').replace(/π/g, 'pi').replace(/\*\*/g, '^').replace(/√/g, 'sqrt').replace(/,/g, '.');
  const toks = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
      if (!m) throw new Error(`Número inválido cerca de "${s.slice(i, i + 5)}"`);
      toks.push({ k: 'n', v: m[0] }); i += m[0].length; continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i; while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      let w = s.slice(i, j).toLowerCase(); i = j;
      while (w) {
        const nm = NAMES.find((n) => w.startsWith(n));
        if (!nm) throw new Error(`"${w}" no se reconoce. Solo se admite la variable x y las funciones sin, cos, tan, cot, sec, csc, asin, acos, atan, sinh, cosh, tanh, ln, exp, sqrt.`);
        toks.push({ k: 'id', v: nm }); w = w.slice(nm.length);
      }
      continue;
    }
    if ('+-*/^()'.includes(c)) { toks.push({ k: c }); i++; continue; }
    throw new Error(`Carácter no válido: "${c}"`);
  }
  return toks;
}

export function parse(src) {
  if (!src || !src.trim()) throw new Error('La expresión está vacía.');
  const T = tokenize(src); let p = 0;
  const peek = () => T[p];
  const startsPrimary = (t) => t && (t.k === 'n' || t.k === 'id' || t.k === '(');
  function expr() {
    let l = term();
    while (peek() && (peek().k === '+' || peek().k === '-')) { const o = T[p++].k; const r = term(); l = o === '+' ? add(l, r) : sub(l, r); }
    return l;
  }
  function term() {
    let l = unary();
    for (;;) {
      const t = peek();
      if (t && (t.k === '*' || t.k === '/')) { p++; const r = unary(); l = t.k === '*' ? mul(l, r) : div(l, r); }
      else if (startsPrimary(t)) l = mul(l, unary()); // multiplicación implícita
      else return l;
    }
  }
  function unary() {
    const t = peek();
    if (t && t.k === '-') { p++; return neg(unary()); }
    if (t && t.k === '+') { p++; return unary(); }
    return power();
  }
  function power() {
    const b = primary();
    if (peek() && peek().k === '^') { p++; return pow(b, unary()); }
    return b;
  }
  function primary() {
    const t = T[p++];
    if (!t) throw new Error('La expresión termina de forma inesperada.');
    if (t.k === 'n') return decimal(t.v);
    if (t.k === '(') {
      const e = expr();
      if (!peek() || peek().k !== ')') throw new Error('Falta cerrar un paréntesis.');
      p++; return e;
    }
    if (t.k === 'id') {
      if (t.v === 'x') return sym('x');
      if (t.v === 'pi') return PI;
      if (t.v === 'e') return E;
      if (!peek() || peek().k !== '(') throw new Error(`Escribe ${t.v}(…) con paréntesis, por ejemplo ${t.v}(x).`);
      p++; const a = expr();
      if (!peek() || peek().k !== ')') throw new Error('Falta cerrar un paréntesis.');
      p++;
      if (t.v === 'exp') return pow(E, a);
      if (t.v === 'sqrt') return sqrt(a);
      return fn(FUNCS[t.v], a);
    }
    throw new Error(`Símbolo inesperado "${t.k}".`);
  }
  const r = expr();
  if (p < T.length) throw new Error(`Sobra "${T[p].v ?? T[p].k}" en la expresión.`);
  return simp(r);
}
