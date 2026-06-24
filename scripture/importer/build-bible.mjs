#!/usr/bin/env node
/*
 * Importador: convierte un archivo de una versión bíblica al formato del plugin.
 *
 *   node build-bible.mjs <entrada> --id RV --name "Reina-Valera 1960" --abbr RV [--out <archivo>]
 *
 * Formatos de ENTRADA admitidos (autodetectados por extensión/contenido):
 *
 *  1) VPL / texto por versículo (.txt): una línea por versículo
 *        Juan 3:16  Porque de tal manera amó Dios al mundo...
 *        1 Juan 2:5 Pero el que guarda su palabra...
 *
 *  2) CSV / TSV (.csv/.tsv): columnas  libro, capitulo, versiculo, texto
 *     (con o sin encabezado; separador , ; o tabulación, autodetectado)
 *
 *  3) JSON anidado (.json):  { "Juan": { "3": { "16": "texto..." } }, ... }
 *
 *  4) JSON ya en formato del plugin (tiene books[].id): se valida y reordena.
 *
 * El mapeo de nombres de libro (español/abreviaturas -> código canónico) se
 * reutiliza del propio plugin (main.js), así que el plugin y el importador
 * nunca se desincronizan.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const { __test } = require(join(here, '..', 'main.js'));
const { resolveBook, BOOKS } = __test;

const BOOK_ORDER = BOOKS.map((b) => b.id);
const BOOK_NAME = new Map(BOOKS.map((b) => [b.id, b.name]));

/* -------- argumentos -------- */
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = val;
    } else {
      args._.push(a);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const input = args._[0];
if (!input || args.help) {
  console.log('Uso: node build-bible.mjs <entrada> --id RV --name "Reina-Valera 1960" --abbr RV [--out salida.json]');
  process.exit(input ? 0 : 1);
}

const id = args.id || 'BIBLIA';
const name = args.name || id;
const abbr = args.abbr || id;
const outPath = args.out || join(here, '..', 'bibles', id + '.json');

/* -------- acumulador: bookId -> chapter(1-based) -> verse(1-based) -> texto -------- */
const data = new Map();
const unknownBooks = new Set();
let count = 0;

function put(bookName, chapter, verse, text) {
  const bookId = resolveBook(bookName);
  if (!bookId) { unknownBooks.add(String(bookName).trim()); return; }
  const c = parseInt(chapter, 10);
  const v = parseInt(verse, 10);
  if (!c || !v) return;
  if (!data.has(bookId)) data.set(bookId, new Map());
  const chapters = data.get(bookId);
  if (!chapters.has(c)) chapters.set(c, new Map());
  chapters.get(c).set(v, String(text).trim());
  count++;
}

/* -------- parsers de entrada -------- */
function parseVPL(content) {
  // "Libro C:V  texto"
  const re = /^\s*(.+?)\s+(\d+)[:.](\d+)\s+(.*\S)\s*$/;
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = line.match(re);
    if (m) put(m[1], m[2], m[3], m[4]);
  }
}

function detectDelimiter(sample) {
  if (sample.includes('\t')) return '\t';
  const semis = (sample.match(/;/g) || []).length;
  const commas = (sample.match(/,/g) || []).length;
  return semis > commas ? ';' : ',';
}

function splitCsvLine(line, delim) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return;
  const delim = detectDelimiter(lines[0]);
  let cols = { book: 0, chapter: 1, verse: 2, text: 3 };
  let start = 0;
  // ¿encabezado?
  const head = splitCsvLine(lines[0], delim).map((h) => h.toLowerCase().trim());
  const findCol = (...names) => head.findIndex((h) => names.some((n) => h.includes(n)));
  if (head.some((h) => /libro|book|capitulo|chapter|vers|text|texto/.test(h))) {
    const b = findCol('libro', 'book');
    const c = findCol('capitulo', 'chapter', 'cap');
    const v = findCol('versiculo', 'verse', 'vers');
    const t = findCol('texto', 'text');
    cols = { book: b, chapter: c, verse: v, text: t };
    start = 1;
  }
  for (let i = start; i < lines.length; i++) {
    const f = splitCsvLine(lines[i], delim);
    put(f[cols.book], f[cols.chapter], f[cols.verse], f[cols.text]);
  }
}

function parseJSON(content) {
  const obj = JSON.parse(content);
  // ¿ya en formato del plugin?
  if (obj && Array.isArray(obj.books) && obj.books[0] && obj.books[0].id) {
    for (const b of obj.books) {
      const chapters = b.chapters || [];
      for (let ci = 0; ci < chapters.length; ci++) {
        const verses = chapters[ci] || [];
        for (let vi = 0; vi < verses.length; vi++) {
          if (verses[vi] != null && verses[vi] !== '') put(b.name || b.id, ci + 1, vi + 1, verses[vi]);
        }
      }
    }
    return;
  }
  // anidado: { libro: { cap: { vers: texto } } }
  for (const [book, chapters] of Object.entries(obj)) {
    if (!chapters || typeof chapters !== 'object') continue;
    for (const [c, verses] of Object.entries(chapters)) {
      if (!verses || typeof verses !== 'object') continue;
      for (const [v, text] of Object.entries(verses)) put(book, c, v, text);
    }
  }
}

/* -------- ejecutar -------- */
const content = readFileSync(input, 'utf8');
const ext = extname(input).toLowerCase();
if (ext === '.json') parseJSON(content);
else if (ext === '.csv' || ext === '.tsv') parseCSV(content);
else if (ext === '.txt' || ext === '') parseVPL(content);
else {
  // intento por contenido
  const t = content.trimStart();
  if (t.startsWith('{') || t.startsWith('[')) parseJSON(content);
  else if (content.includes('\t') || /,|;/.test(content.split('\n')[0])) parseCSV(content);
  else parseVPL(content);
}

if (!count) {
  console.error('No se importó ningún versículo. Revisa el formato del archivo.');
  if (unknownBooks.size) console.error('Libros no reconocidos: ' + [...unknownBooks].join(', '));
  process.exit(1);
}

/* -------- emitir en el formato del plugin (ordenado y con huecos rellenos) -------- */
const books = [];
let chapterCount = 0;
let gapCount = 0;
for (const bookId of BOOK_ORDER) {
  if (!data.has(bookId)) continue;
  const chaptersMap = data.get(bookId);
  const maxChapter = Math.max(...chaptersMap.keys());
  const chapters = [];
  for (let c = 1; c <= maxChapter; c++) {
    const versesMap = chaptersMap.get(c);
    if (!versesMap) { chapters.push([]); continue; }
    chapterCount++;
    const maxVerse = Math.max(...versesMap.keys());
    const arr = [];
    for (let v = 1; v <= maxVerse; v++) {
      if (versesMap.has(v)) arr.push(versesMap.get(v));
      else { arr.push(null); gapCount++; }
    }
    chapters.push(arr);
  }
  books.push({ id: bookId, name: BOOK_NAME.get(bookId), chapters });
}

const out = { id, name, abbr, language: 'es', books };
writeFileSync(outPath, JSON.stringify(out));

console.log(`✓ ${name} (${abbr})`);
console.log(`  libros:      ${books.length}`);
console.log(`  capítulos:   ${chapterCount}`);
console.log(`  versículos:  ${count}`);
if (gapCount) console.log(`  huecos (versículos faltantes rellenados): ${gapCount}`);
if (unknownBooks.size) console.log(`  ⚠ libros no reconocidos (omitidos): ${[...unknownBooks].join(', ')}`);
console.log(`  -> ${outPath}`);
