import { parse } from './parser.js';
import { solve } from './integrate.js';
import { definite, area, fmt } from './definite.js';
import { tex, texPar } from './latex.js';
import { ev } from './eval.js';
import { Plot } from './plot.js';

const $ = (id) => document.getElementById(id);
let mode = 'indef';

const EXAMPLES = {
  indef: ['x^3+2x', 'x*e^x', 'x^2*ln(x)', 'sin(x)^3*cos(x)', 'sin(x)^2', 'e^x*sin(x)', 'sqrt(2x+1)', '1/(x^2+4)', 'x*(x+1)^5', 'tan(x)^2'],
  def: [['sin(x)', '0', 'pi'], ['x^2', '0', '3'], ['1/(1+x^2)', '0', '1'], ['x*e^x', '0', '1'], ['cos(x)^2', '0', 'pi/2'], ['e^(x^2)', '0', '1']],
  area: [['x', 'x^2', '0', '1'], ['sin(x)', '', '0', '2*pi'], ['x^3-x', '', '-1', '1'], ['4-x^2', 'x+2', '-3', '2']],
};

function math(el, t, display = false) {
  if (window.katex) { try { window.katex.render(t, el, { displayMode: display, throwOnError: false }); return; } catch { /* cae al texto */ } }
  el.textContent = t;
}
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const card = (title) => { const c = h('section', 'card'); if (title) c.append(h('h2', '', title)); return c; };
const msg = (kind, html) => h('div', `msg ${kind}`, html);
const badge = (kind, text) => h('span', `badge ${kind}`, esc(text));

function stepsCard(title, ...lists) {
  const c = card(title);
  for (const steps of lists) for (const s of steps) {
    const d = h('div', 'step'); d.style.marginLeft = `${Math.min(s.d, 4) * 16}px`;
    d.append(h('div', 't', esc(s.title)));
    if (s.math) { const m = h('div', 'm'); math(m, s.math, true); d.append(m); }
    if (s.note) d.append(h('div', 'n', esc(s.note)));
    c.append(d);
  }
  return c;
}

function plotCard(data) {
  const c = card('Gráfica');
  const cv = h('canvas'); c.append(cv, h('div', 'hint', 'Rueda del ratón: zoom · arrastrar: mover · doble clic: restablecer la escala. Azul: área positiva, naranja: área negativa.'));
  requestAnimationFrame(() => new Plot(cv).set(data));
  return c;
}

const hasRational = (e) => (e.t === 'pow' && e.b.t === 'add' && e.e.t === 'num' && e.e.p < 0) || (e.a && e.a.some?.(hasRational)) || (e.t === 'pow' && (hasRational(e.b) || hasRational(e.e))) || (e.t === 'fn' && hasRational(e.a));
const failText = (f) => `No encontré una antiderivada con los métodos implementados (tabla, linealidad, sustitución, por partes, trigonométricas).${hasRational(f) ? ' Las <b>fracciones parciales</b> y la <b>sustitución trigonométrica</b> están previstas en la siguiente fase.' : ''} Eso no significa que no exista: algunas funciones (como e<sup>x²</sup>) no tienen antiderivada elemental.`;

function verifyBadge(v) {
  if (!v) return null;
  return v.ok ? badge('ok', `✓ Comprobado: la derivada del resultado coincide con el integrando (${v.points} puntos)`) : badge('warn', '⚠ La comprobación numérica no coincidió; revisa la expresión');
}

function run() {
  const out = $('out'); out.replaceChildren();
  try {
    const f = parse($('f').value);
    if (mode === 'indef') return runIndef(f, out);
    const aE = parse($('a').value), bE = parse($('b').value);
    if (mode === 'def') return runDef(f, aE, bE, out);
    const g = $('g').value.trim() ? parse($('g').value) : null;
    return runArea(f, g, aE, bE, out);
  } catch (e) { out.append(msg('bad', `<b>Error:</b> ${esc(e.message)}`)); }
}

function runIndef(f, out) {
  const sol = solve(f);
  const c = card('Resultado'); c.classList.add('result');
  if (!sol.F) { c.append(msg('warn', failText(f))); out.append(c, stepsCard('Intentos', sol.steps.slice(0, 1))); return; }
  const big = h('div', 'big'); math(big, `\\int ${tex(f)}\\,dx = ${tex(sol.F)} + C`, true);
  c.append(big, verifyBadge(sol.verification));
  const d = h('div', 'n'); d.style.marginTop = '8px'; math(d, `\\text{Comprobación: } \\frac{d}{dx}\\left[${tex(sol.F)}\\right] = ${tex(sol.verification.derivative)}`);
  c.append(d);
  out.append(c, stepsCard('Procedimiento paso a paso', sol.steps));
  const Ff = (x) => ev(sol.F, { x }), ff = (x) => ev(f, { x });
  out.append(plotCard({ curves: [{ f: ff, color: '#2563eb', label: 'f(x)' }, { f: Ff, color: '#dc2626', label: 'F(x) (C = 0)' }] }));
}

function runDef(f, aE, bE, out) {
  const r = definite(f, aE, bE);
  const c = card('Resultado'); c.classList.add('result');
  if (r.error) { c.append(msg('bad', esc(r.error))); out.append(c); return; }
  const lim = `\\int_{${tex(aE)}}^{${tex(bE)}} ${tex(f)}\\,dx`;
  if (!r.F) {
    const big = h('div', 'big'); math(big, `${lim} \\approx ${fmt(r.simpson)}`, true);
    c.append(big, msg('warn', failText(f) + ' Se muestra la <b>aproximación numérica</b> (Simpson adaptativo).'));
    out.append(c, plotCard({ curves: [{ f: (x) => ev(f, { x }), color: '#2563eb', label: 'f(x)' }], shade: { f: (x) => ev(f, { x }), a: Math.min(r.a, r.b), b: Math.max(r.a, r.b) }, range: { a: Math.min(r.a, r.b), b: Math.max(r.a, r.b) } }));
    return;
  }
  const big = h('div', 'big'); math(big, `${lim} = ${tex(r.exact)} \\approx ${fmt(r.value)}`, true);
  c.append(big, verifyBadge(r.verification), document.createTextNode(' '),
    r.agree ? badge('ok', `✓ Simpson numérico independiente: ${fmt(r.simpson)}`) : badge('warn', `⚠ Simpson numérico: ${fmt(r.simpson)} (difiere)`));
  out.append(c, stepsCard('Procedimiento: antiderivada', r.steps), stepsCard('Procedimiento: evaluar en los límites', r.ftc));
  const lo = Math.min(r.a, r.b), hi = Math.max(r.a, r.b), ff = (x) => ev(f, { x });
  out.append(plotCard({ curves: [{ f: ff, color: '#2563eb', label: 'f(x)' }], shade: { f: ff, a: lo, b: hi }, range: { a: lo, b: hi } }));
}

function runArea(f, g, aE, bE, out) {
  const r = area(f, g, aE, bE);
  const c = card('Resultado'); c.classList.add('result');
  if (r.error) { c.append(msg('bad', esc(r.error))); out.append(c); return; }
  const what = g ? `\\int_{${tex(r.aE)}}^{${tex(r.bE)}} \\left[${texPar(f)} - ${texPar(g)}\\right]dx` : `\\int_{${tex(r.aE)}}^{${tex(r.bE)}} ${tex(f)}\\,dx`;
  if (r.swapped) c.append(msg('info', 'Los límites estaban invertidos; se intercambiaron para calcular el área en [a, b].'));
  const l1 = h('div', 'big'), l2 = h('div', 'big');
  math(l1, `\\text{Área con signo: } ${what} = ${r.exactSigned ? tex(r.exactSigned) + ' \\approx ' : ''}${fmt(r.signed)}`, true);
  math(l2, `\\text{Área geométrica (total): } ${r.exactGeo ? tex(r.exactGeo) + ' \\approx ' : ''}${fmt(r.geometric)}`, true);
  c.append(l1, l2, h('div', 'n', 'El área con signo resta lo que queda bajo el eje (o bajo la otra curva); la geométrica suma el valor absoluto de cada tramo, dividiendo el intervalo donde la función cambia de signo.'));
  if (r.numericOnly) c.append(msg('warn', failText(r.h) + ' Los valores son aproximaciones numéricas.'));
  if (r.pieces.length > 0) {
    const t = h('table'); t.innerHTML = '<tr><th>Tramo</th><th>Posición</th><th>Valor de la integral</th><th>Área</th></tr>';
    for (const p of r.pieces) {
      const tr = h('tr'), tdRange = h('td'), tdPos = h('td', p.sign > 0 ? 'pos' : 'negc', g ? (p.sign > 0 ? 'f arriba de g' : 'g arriba de f') : (p.sign > 0 ? 'sobre el eje x' : 'bajo el eje x')), tdV = h('td'), tdA = h('td');
      math(tdRange, `[${p.from.e ? tex(p.from.e) : fmt(p.from.x)},\\ ${p.to.e ? tex(p.to.e) : fmt(p.to.x)}]`);
      math(tdV, `${p.exact ? tex(p.exact) + ' \\approx ' : ''}${fmt(p.value)}`); tdA.textContent = fmt(Math.abs(p.value));
      tr.append(tdRange, tdPos, tdV, tdA); t.append(tr);
    }
    c.append(t);
  }
  if (r.intersections.length) { const d = h('div', 'n'); d.style.marginTop = '8px'; d.textContent = 'Intersecciones en el intervalo: ' + r.intersections.map((p) => `(${fmt(p.x)}, ${fmt(p.y)})`).join(', '); c.append(d); }
  else if (!g && r.roots.length) { const d = h('div', 'n'); d.style.marginTop = '8px'; d.textContent = 'Cruces con el eje x: ' + r.roots.map((x) => fmt(x)).join(', '); c.append(d); }
  out.append(c);
  if (r.steps.length > 1) out.append(stepsCard(g ? 'Integral de f − g, paso a paso' : 'Antiderivada, paso a paso', r.steps));
  const ff = (x) => ev(f, { x });
  const curves = [{ f: ff, color: '#2563eb', label: 'f(x)' }];
  if (g) curves.push({ f: (x) => ev(g, { x }), color: '#dc2626', label: 'g(x)' });
  out.append(plotCard({ curves, shade: { f: ff, g: g ? (x) => ev(g, { x }) : null, a: r.a, b: r.b }, range: { a: r.a, b: r.b }, points: r.intersections }));
}

// ---------- interfaz ----------
function setMode(m) {
  mode = m;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.mode === m));
  $('gRow').hidden = m !== 'area'; $('limits').hidden = m === 'indef';
  const chips = $('chips'); chips.replaceChildren();
  for (const ex of EXAMPLES[m]) {
    const b = h('button', 'chip'); b.type = 'button';
    b.textContent = typeof ex === 'string' ? ex : m === 'def' ? `∫[${ex[1]},${ex[2]}] ${ex[0]}` : `${ex[0]}${ex[1] ? ' vs ' + ex[1] : ''} [${ex[2]},${ex[3]}]`;
    b.onclick = () => {
      if (typeof ex === 'string') $('f').value = ex;
      else if (m === 'def') { $('f').value = ex[0]; $('a').value = ex[1]; $('b').value = ex[2]; }
      else { $('f').value = ex[0]; $('g').value = ex[1]; $('a').value = ex[2]; $('b').value = ex[3]; }
      preview(); run();
    };
    chips.append(b);
  }
}
function preview() {
  const p = $('fprev'); p.className = 'preview';
  try { math(p, `f(x) = ${tex(parse($('f').value))}`, false); } catch (e) { p.className = 'preview err'; p.textContent = $('f').value.trim() ? e.message : ''; }
}
document.querySelectorAll('.tab').forEach((t) => { t.onclick = () => { setMode(t.dataset.mode); $('out').replaceChildren(); }; });
$('f').addEventListener('input', preview);
for (const id of ['f', 'g', 'a', 'b']) $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
$('go').onclick = run;
setMode('indef'); preview(); run();
