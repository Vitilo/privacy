#!/usr/bin/env node
/*
 * Importador: convierte un archivo de una versión bíblica al formato del plugin.
 *
 *   node build-bible.mjs <entrada> --id RV --name "Reina-Valera 1960" --abbr RV [--out <archivo>]
 *
 * Formatos de ENTRADA admitidos (autodetectados por extensión/contenido):
 *
 *  1) Markdown con superíndices (.md/.txt): el formato típico de "Biblia en
 *     Obsidian". Títulos de libro con "# GÉNESIS", capítulos con
 *     "## Capítulo 1" y números de versículo en superíndice (¹ ² ³ ⁴ ...),
 *     incluyendo rangos combinados como "¹¹-¹²".
 *
 *  2) VPL / texto por versículo (.txt): una línea por versículo
 *        Juan 3:16  Porque de tal manera amó Dios al mundo...
 *
 *  3) CSV / TSV (.csv/.tsv): columnas  libro, capitulo, versiculo, texto
 *
 *  4) JSON anidado (.json):  { "Juan": { "3": { "16": "texto..." } } }
 *
 *  5) JSON ya en formato del plugin (tiene books[].id): se valida y reordena.
 *
 * El mapeo de nombres de libro (español/abreviaturas -> código canónico) se
 * reutiliza del propio plugin (main.js), así que plugin e importador nunca se
 * desincronizan.
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
  console.log('Uso: node build-bible.mjs <entrada> --id NBV --name "Nueva Biblia Viva" --abbr NBV [--out salida.json]');
  process.exit(input ? 0 : 1);
}

const id = args.id || 'BIBLIA';
const name = args.name || id;
const abbr = args.abbr || id;
const outPath = args.out || join(here, '..', 'bibles', id + '.json');

/* -------- acumuladores -------- */
const data = new Map();        // bookId -> Map(chap -> Map(verse -> texto))
const headings = new Map();    // bookId -> Map(chap -> título)
const unknownBooks = new Set();
let mergeCount = 0;

function setCell(bookId, c, v, text) {
  if (!data.has(bookId)) data.set(bookId, new Map());
  const ch = data.get(bookId);
  if (!ch.has(c)) ch.set(c, new Map());
  ch.get(c).set(v, text);
}
function getCell(bookId, c, v) {
  const ch = data.get(bookId);
  return ch && ch.get(c) ? ch.get(c).get(v) : undefined;
}
function put(bookName, chapter, verse, text) {
  const bookId = resolveBook(bookName);
  if (!bookId) { unknownBooks.add(String(bookName).trim()); return; }
  const c = parseInt(chapter, 10);
  const v = parseInt(verse, 10);
  if (!c || !v) return;
  setCell(bookId, c, v, String(text).trim());
}
function putHeading(bookId, c, text) {
  if (!headings.has(bookId)) headings.set(bookId, new Map());
  const h = headings.get(bookId);
  h.set(c, (h.get(c) ? h.get(c) + ' ' : '') + String(text).trim());
}

/* -------- 1) Markdown con superíndices -------- */
const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
const SUP_CLASS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const VNUM = new RegExp(`([${SUP_CLASS}]+)(?:\\s*-\\s*([${SUP_CLASS}]+))?`, 'g');
function supToInt(s) { return parseInt([...s].map((c) => SUP[c]).join(''), 10); }

function looksMarkdownSuperscript(content) {
  return new RegExp(`[${SUP_CLASS}]`).test(content) &&
    (/^#\s+\S/m.test(content) || /^##\s+/m.test(content));
}

function parseMarkdownSuperscript(content) {
  const lines = content.split(/\r?\n/);
  let bookId = null;
  let chap = null;
  let lastVerses = null; // últimos versículos asignados (para continuaciones)

  const appendCont = (text) => {
    const t = text.trim();
    if (!t || !bookId || !chap || !lastVerses) return;
    for (const v of lastVerses) {
      const cur = getCell(bookId, chap, v) || '';
      setCell(bookId, chap, v, (cur ? cur + ' ' : '') + t);
    }
  };
  const assignRange = (a, b, text) => {
    const t = text.trim();
    for (let v = a; v <= b; v++) setCell(bookId, chap, v, t);
    lastVerses = [];
    for (let v = a; v <= b; v++) lastVerses.push(v);
    if (b > a) mergeCount++;
  };

  for (const raw of lines) {
    const line = raw.replace(/ /g, ' ').replace(/\s+$/, '');
    const t = line.trim();
    // Título de libro:  # GÉNESIS
    if (/^#\s+\S/.test(line) && !/^##/.test(line)) {
      const nm = t.replace(/^#\s+/, '').trim();
      bookId = resolveBook(nm);
      if (!bookId) unknownBooks.add(nm);
      chap = null; lastVerses = null;
      continue;
    }
    // Capítulo:  ## Capítulo 1
    if (/^##\s+/.test(line)) {
      const m = t.match(/(\d+)/);
      chap = m ? +m[1] : (chap || 0) + 1;
      lastVerses = null;
      continue;
    }
    if (!t) continue;
    if (/^---$/.test(t) || /^(tipo|tags|aliases|cssclass):/i.test(t)) continue; // frontmatter
    if (!bookId) continue;
    if (!chap) {
      // Capítulo 1 implícito si el marcador "## Capítulo 1" falta o está corrupto
      VNUM.lastIndex = 0;
      if (VNUM.test(t)) chap = 1; else continue;
    }

    VNUM.lastIndex = 0;
    if (!VNUM.test(t)) {
      // sin número: título del capítulo (antes del v1) o continuación del versículo
      if (lastVerses) appendCont(t);
      else putHeading(bookId, chap, t);
      continue;
    }
    // dividir la línea por los marcadores de versículo
    VNUM.lastIndex = 0;
    let m;
    let lastEnd = 0;
    let pending = null;
    while ((m = VNUM.exec(t))) {
      const pre = t.slice(lastEnd, m.index);
      if (pending) assignRange(pending.a, pending.b, pre);
      else if (pre.trim()) { if (lastVerses) appendCont(pre); else putHeading(bookId, chap, pre); }
      pending = { a: supToInt(m[1]), b: m[2] ? supToInt(m[2]) : supToInt(m[1]) };
      lastEnd = m.index + m[0].length;
    }
    if (pending) assignRange(pending.a, pending.b, t.slice(lastEnd));
  }
}

/* -------- 2) VPL -------- */
function parseVPL(content) {
  const re = /^\s*(.+?)\s+(\d+)[:.](\d+)\s+(.*\S)\s*$/;
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = line.match(re);
    if (m) put(m[1], m[2], m[3], m[4]);
  }
}

/* -------- 3) CSV / TSV -------- */
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
  const head = splitCsvLine(lines[0], delim).map((h) => h.toLowerCase().trim());
  const findCol = (...names) => head.findIndex((h) => names.some((n) => h.includes(n)));
  if (head.some((h) => /libro|book|capitulo|chapter|vers|text|texto/.test(h))) {
    cols = {
      book: findCol('libro', 'book'),
      chapter: findCol('capitulo', 'chapter', 'cap'),
      verse: findCol('versiculo', 'verse', 'vers'),
      text: findCol('texto', 'text'),
    };
    start = 1;
  }
  for (let i = start; i < lines.length; i++) {
    const f = splitCsvLine(lines[i], delim);
    put(f[cols.book], f[cols.chapter], f[cols.verse], f[cols.text]);
  }
}

/* -------- 4/5) JSON -------- */
function parseJSON(content) {
  const obj = JSON.parse(content.replace(/^﻿/, ''));
  // Formato común público: array de 66 libros en orden canónico,
  // cada uno { abbrev, name, chapters: [[v1, v2, ...], ...] }. Se mapea por
  // POSICIÓN (más fiable que el nombre, que a veces viene en inglés).
  if (Array.isArray(obj) && obj[0] && Array.isArray(obj[0].chapters)) {
    obj.forEach((b, i) => {
      const bookId = BOOK_ORDER[i];
      if (!bookId) { unknownBooks.add(b.name || b.abbrev || ('#' + i)); return; }
      const chapters = b.chapters || [];
      for (let ci = 0; ci < chapters.length; ci++) {
        const verses = chapters[ci] || [];
        for (let vi = 0; vi < verses.length; vi++) {
          const t = verses[vi];
          if (t != null && t !== '') setCell(bookId, ci + 1, vi + 1, String(t).trim());
        }
      }
    });
    return;
  }
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
else if (looksMarkdownSuperscript(content)) parseMarkdownSuperscript(content);
else {
  const t = content.trimStart();
  if (t.startsWith('{') || t.startsWith('[')) parseJSON(content);
  else if (content.includes('\t') || /,|;/.test(content.split('\n')[0])) parseCSV(content);
  else parseVPL(content);
}

/* -------- emitir en el formato del plugin -------- */
const books = [];
let chapterCount = 0;
let verseCount = 0;
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
      if (versesMap.has(v)) { arr.push(versesMap.get(v)); verseCount++; }
      else { arr.push(null); gapCount++; }
    }
    chapters.push(arr);
  }
  const book = { id: bookId, name: BOOK_NAME.get(bookId), chapters };
  if (headings.has(bookId)) {
    const h = {};
    for (const [c, title] of headings.get(bookId)) h[c] = title;
    book.headings = h;
  }
  books.push(book);
}

if (!verseCount) {
  console.error('No se importó ningún versículo. Revisa el formato del archivo.');
  if (unknownBooks.size) console.error('Libros no reconocidos: ' + [...unknownBooks].join(', '));
  process.exit(1);
}

const out = { id, name, abbr, language: 'es', books };
writeFileSync(outPath, JSON.stringify(out));

console.log(`✓ ${name} (${abbr})`);
console.log(`  libros:      ${books.length}`);
console.log(`  capítulos:   ${chapterCount}`);
console.log(`  versículos:  ${verseCount}`);
if (mergeCount) console.log(`  combinados (rangos tipo 11-12): ${mergeCount}`);
if (headings.size) console.log(`  títulos (p. ej. de Salmos): ${[...headings.values()].reduce((n, m) => n + m.size, 0)}`);
if (gapCount) console.log(`  huecos rellenados: ${gapCount}`);
if (unknownBooks.size) console.log(`  ⚠ libros no reconocidos (omitidos): ${[...unknownBooks].join(', ')}`);
console.log(`  -> ${outPath}`);
