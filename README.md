# ∫ Calculadora de integrales paso a paso

Aplicación web estática (sin build, sin dependencias de ejecución; KaTeX por CDN solo para dibujar fórmulas).
Resuelve integrales indefinidas y definidas mostrando **cada paso con su justificación**, grafica la región y calcula áreas.

## Uso
- Local: `npm start` y abrir http://localhost:8080 (o cualquier servidor estático; despliega tal cual en Vercel/GitHub Pages).
- Tests: `npm test` (81 pruebas; cada antiderivada se verifica derivando numéricamente).

## Fase 1 (implementada)
- Parser (`2x`, `x^2`, `sqrt`, `pi`, `e`, funciones trig/hiperbólicas/ln/exp), con errores claros.
- Reglas: constante, linealidad, factor constante, tabla (potencia, exp, trig, arctan/arcsen, ln|x+√…|),
  sustitución (lineal con despeje de x y general), por partes (LIATE y caso cíclico eˣ·sen/cos), potencias trigonométricas, expansión.
- Definida por TFC con valores exactos (π/4, √2…), comprobación con Simpson adaptativo, detección de singularidades.
- Áreas: con signo vs geométrica, división en raíces, entre dos curvas, intersecciones.
- Gráfica con zoom/arrastre y sombreado (azul +, naranja −).
- Si no hay antiderivada con las reglas: lo dice y ofrece aproximación numérica.

## Fase 2 (pendiente, ver `Delimitacion integrales.md` del Project)
Fracciones parciales / completar cuadrado, sustitución trigonométrica, integrales impropias, entrada con editor visual.

## Estructura
`src/ast.js` (simplificador) · `parser.js` · `diff.js` · `eval.js` · `latex.js` · `integrate.js` (reglas y pasos) · `definite.js` · `plot.js` · `app.js`
