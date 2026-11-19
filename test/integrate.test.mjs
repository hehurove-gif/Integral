import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.js';
import { solve } from '../src/integrate.js';
import { tex } from '../src/latex.js';

// integrando -> debe resolverse y la derivada del resultado debe coincidir numéricamente
const SOLVABLE = [
  '5', 'x', 'x^2', 'x^3+2x-7', '1/x', 'sqrt(x)', '1/sqrt(x)', 'x^(-3)', '3x^2-4x+1',
  'e^x', '2^x', 'e^(2x)', 'e^(-x)', 'sin(x)', 'cos(x)', 'sin(3x+1)', 'cos(x/2)', 'tan(x)', 'sec(x)^2', 'sec(x)*tan(x)',
  '(2x+1)^3', '1/(3x+2)', 'sqrt(2x+1)', 'x*(x+1)^5', '2x*e^(x^2)', 'x*sin(x^2)', 'ln(x)/x', 'sin(x)^3*cos(x)', 'cos(x)/sin(x)',
  'x/(x^2+1)', 'x/sqrt(x^2+4)', 'e^x/(1+e^x)',
  '1/(1+x^2)', '1/(x^2+4)', '1/sqrt(1-x^2)', '1/sqrt(4-x^2)',
  'x*e^x', 'x*sin(x)', 'x*cos(2x)', 'x^2*e^x', 'x^3*ln(x)', 'x*ln(x)', 'ln(x)', 'atan(x)', 'asin(x)', 'x*e^(2x)', 'ln(x)^2',
  'e^x*sin(x)', 'e^(2x)*cos(3x)',
  'sin(x)^2', 'cos(x)^2', 'sin(x)^3', 'cos(x)^3', 'sin(x)^2*cos(x)^2', 'sin(x)^4', 'sin(x)^3*cos(x)^2', 'tan(x)^2', 'tan(x)^3',
  '(x^2+1)^2', '(x+1)*(x-2)', 'sin(x)*cos(x)',
];
for (const s of SOLVABLE) {
  test(`∫ ${s}`, () => {
    const r = solve(parse(s));
    assert.ok(r.F, `sin solución: ${s}`);
    assert.ok(r.verification.ok, `la derivada no coincide para ${s}: F=${tex(r.F)}`);
    assert.ok(r.steps.length >= 2);
  });
}
// no elementales: deben fallar con gracia (null), nunca devolver algo incorrecto
for (const s of ['e^(x^2)', 'sin(x)/x', 'x^x', 'ln(x)/(x+1)', 'sqrt(1+x^3)']) {
  test(`no resoluble: ${s}`, () => { assert.equal(solve(parse(s)).F, null); });
}
