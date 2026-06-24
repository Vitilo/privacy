/*
 * Pruebas del motor (funciones puras de main.js), ejecutables sin Obsidian:
 *   node scripture/test/core.test.mjs
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const { __test } = require(join(here, '..', 'main.js'));
const { resolveBook, parseNumericSpec, parseReference, formatLabel, lookupVerses, indexTranslation } = __test;

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('  ✗ ' + msg); }
}
function eq(a, b, msg) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg}  (esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)})`);
}

/* -------- resolveBook -------- */
eq(resolveBook('Juan'), 'JHN', 'Juan -> JHN');
eq(resolveBook('juan'), 'JHN', 'juan -> JHN');
eq(resolveBook('Jn'), 'JHN', 'Jn -> JHN');
eq(resolveBook('1 Juan'), '1JN', '1 Juan -> 1JN');
eq(resolveBook('1juan'), '1JN', '1juan -> 1JN');
eq(resolveBook('1 jn'), '1JN', '1 jn -> 1JN');
eq(resolveBook('Salmos'), 'PSA', 'Salmos -> PSA');
eq(resolveBook('Sal'), 'PSA', 'Sal -> PSA');
eq(resolveBook('Génesis'), 'GEN', 'Génesis -> GEN');
eq(resolveBook('genesis'), 'GEN', 'genesis (sin tilde) -> GEN');
eq(resolveBook('Gn'), 'GEN', 'Gn -> GEN');
eq(resolveBook('Apocalipsis'), 'REV', 'Apocalipsis -> REV');
eq(resolveBook('1 Corintios'), '1CO', '1 Corintios -> 1CO');
eq(resolveBook('Cantar de los Cantares'), 'SNG', 'Cantar de los Cantares -> SNG');
eq(resolveBook('xyz'), null, 'xyz -> null');

/* -------- parseNumericSpec -------- */
eq(parseNumericSpec('3'), { type: 'chapter', chapter: 3 }, '3 -> capítulo');
eq(parseNumericSpec('3:16'), { type: 'verses', chapter: 3, verses: [[16, 16]] }, '3:16');
eq(parseNumericSpec('3:16-19'), { type: 'verses', chapter: 3, verses: [[16, 19]] }, '3:16-19');
eq(parseNumericSpec('3:16,18'), { type: 'verses', chapter: 3, verses: [[16, 16], [18, 18]] }, '3:16,18');
eq(parseNumericSpec('3:16-18,20'), { type: 'verses', chapter: 3, verses: [[16, 18], [20, 20]] }, '3:16-18,20');
eq(parseNumericSpec('3.16'), { type: 'verses', chapter: 3, verses: [[16, 16]] }, '3.16 (punto)');
eq(parseNumericSpec('3:16-4:2'), { type: 'crossRange', c1: 3, v1: 16, c2: 4, v2: 2 }, '3:16-4:2');
eq(parseNumericSpec('abc'), null, 'abc -> null');

/* -------- parseReference -------- */
{
  const { refs, errors } = parseReference('Juan 3:16-19');
  eq(errors.length, 0, 'sin errores');
  eq(refs.length, 1, 'una referencia');
  eq(refs[0].bookId, 'JHN', 'bookId JHN');
  eq(formatLabel(refs[0]), 'Juan 3:16-19', 'etiqueta Juan 3:16-19');
}
{
  const { refs } = parseReference('Juan 3:16; 1 Juan 2:5; Salmos 23');
  eq(refs.length, 3, 'tres referencias');
  eq(refs.map((r) => r.bookId), ['JHN', '1JN', 'PSA'], 'ids correctos');
  eq(formatLabel(refs[2]), 'Salmos 23', 'etiqueta capítulo completo');
}
{
  // Sin espacio entre libro y capítulo (como lo escribió el usuario: "Juan3:17-19")
  const { refs } = parseReference('Juan3:17-19');
  eq(refs.length, 1, 'Juan3:17-19 sin espacio -> 1 ref');
  eq(formatLabel(refs[0]), 'Juan 3:17-19', 'etiqueta Juan 3:17-19');
  eq(parseReference('1Juan2:5').refs[0]?.bookId, '1JN', '1Juan2:5 sin espacio -> 1JN');
}
{
  const { refs, errors } = parseReference('Xyz 1:1');
  eq(refs.length, 0, 'referencia inválida no produce ref');
  ok(errors.length === 1, 'produce un error');
}

/* -------- lookupVerses contra la base de ejemplo -------- */
{
  const data = JSON.parse(readFileSync(join(here, '..', 'bibles', 'EJEMPLO.json'), 'utf8'));
  const tr = indexTranslation(data);

  const r1 = parseReference('Juan 3:16-19').refs[0];
  const v1 = lookupVerses(tr, r1);
  eq(v1.length, 4, 'Juan 3:16-19 -> 4 versículos');
  eq(v1.map((v) => v.verse), [16, 17, 18, 19], 'versículos 16..19');
  ok(/Porque de tal manera/.test(v1[0].text), 'texto de Juan 3:16 cargado');

  const r2 = parseReference('Génesis 1').refs[0];
  const v2 = lookupVerses(tr, r2);
  eq(v2.length, 5, 'Génesis 1 -> 5 versículos (capítulo completo)');

  const r3 = parseReference('Juan 3:19-4:2').refs[0];
  const v3 = lookupVerses(tr, r3);
  eq(v3.map((v) => `${v.chapter}:${v.verse}`), ['3:19', '3:20', '4:1', '4:2'], 'rango entre capítulos');

  const r4 = parseReference('Juan 3:99').refs[0];
  const v4 = lookupVerses(tr, r4);
  eq(v4.length, 1, 'versículo inexistente devuelve 1 entrada');
  ok(v4[0].missing === true, 'marcado como missing');
}

console.log(`\n${passed} pruebas OK, ${failed} fallidas.`);
process.exit(failed ? 1 : 0);
