import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import { definite, area } from '../src/definite.js';
import { tex } from '../src/latex.js';

const close = (a, b, t = 1e-8) => assert.ok(Math.abs(a - b) < t, `${a} ≠ ${b}`);
const P = parse;

test('∫0^1 x² = 1/3', () => { const r = definite(P('x^2'), P('0'), P('1')); close(r.value, 1 / 3); assert.equal(tex(r.exact), '\\frac{1}{3}'); assert.ok(r.agree); });
test('∫0^π sen x = 2', () => { const r = definite(P('sin(x)'), P('0'), P('pi')); close(r.value, 2); assert.equal(tex(r.exact), '2'); });
test('∫0^(π/2) cos x = 1 (valores exactos)', () => { const r = definite(P('cos(x)'), P('0'), P('pi/2')); assert.equal(tex(r.exact), '1'); });
test('∫1^e 1/x = 1', () => { const r = definite(P('1/x'), P('1'), P('e')); assert.equal(tex(r.exact), '1'); });
test('∫0^1 xe^x = 1', () => { const r = definite(P('x*e^x'), P('0'), P('1')); close(r.value, 1); assert.ok(r.agree); });
test('∫0^1 1/(1+x²) = π/4', () => { const r = definite(P('1/(1+x^2)'), P('0'), P('1')); close(r.value, Math.PI / 4); assert.equal(tex(r.exact), '\\frac{\\pi}{4}'); });
test('límites invertidos dan signo negativo', () => { close(definite(P('x'), P('2'), P('0')).value, -2); });
test('singularidad detectada: ∫-1^1 1/x', () => { assert.ok(definite(P('1/x'), P('-1'), P('1')).singular !== undefined); });
test('singularidad en extremo: ∫0^1 1/√x', () => { assert.ok(definite(P('1/sqrt(x)'), P('0'), P('1')).error); });
test('no elemental: ∫0^1 e^(x²) → solo aproximación', () => { const r = definite(P('e^(x^2)'), P('0'), P('1')); assert.equal(r.F, null); close(r.simpson, 1.4626517459, 1e-7); });

test('área sen x en [0,2π]: con signo 0, geométrica 4', () => {
  const r = area(P('sin(x)'), null, P('0'), P('2*pi'));
  close(r.signed, 0); close(r.geometric, 4); assert.equal(r.pieces.length, 2);
  assert.equal(tex(r.exactGeo), '4'); assert.equal(tex(r.exactSigned), '0');
});
test('área entre y=x y y=x² en [0,2] (se cruzan en x=1)', () => {
  const r = area(P('x'), P('x^2'), P('0'), P('2'));
  close(r.signed, -2 / 3);           // con signo: ∫(x − x²) = 2 − 8/3
  close(r.geometric, 1);             // 1/6 + 5/6
  assert.equal(r.pieces.length, 2);
});
test('área exacta entre y=x y y=x²', () => {
  const r = area(P('x'), P('x^2'), P('0'), P('1'));
  close(r.geometric, 1 / 6); assert.equal(tex(r.exactGeo), '\\frac{1}{6}');
});
test('x³ en [-1,1]: con signo 0, geométrica 1/2', () => {
  const r = area(P('x^3'), null, P('-1'), P('1'));
  close(r.signed, 0); close(r.geometric, 0.5); assert.equal(tex(r.exactGeo), '\\frac{1}{2}');
});
test('intersecciones reportadas', () => { const r = area(P('x'), P('x^2'), P('-1'), P('2')); assert.deepEqual(r.roots.map((x) => Math.round(x * 1e6) / 1e6), [0, 1]); });
