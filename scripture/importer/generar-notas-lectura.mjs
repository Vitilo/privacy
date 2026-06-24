// Genera notas de lectura (una por capítulo) + índices por libro + índice general.
// Las notas referencian el capítulo con un bloque ```bible (usa la versión por
// defecto del plugin), así una sola colección sirve para todas las versiones.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const { __test } = require(path.join(here, '..', 'main.js'));
const { BOOKS } = __test;

const CANON = { GEN:50,EXO:40,LEV:27,NUM:36,DEU:34,JOS:24,JDG:21,RUT:4,'1SA':31,'2SA':24,'1KI':22,'2KI':25,'1CH':29,'2CH':36,EZR:10,NEH:13,EST:10,JOB:42,PSA:150,PRO:31,ECC:12,SNG:8,ISA:66,JER:52,LAM:5,EZK:48,DAN:12,HOS:14,JOL:3,AMO:9,OBA:1,JON:4,MIC:7,NAM:3,HAB:3,ZEP:3,HAG:2,ZEC:14,MAL:4,MAT:28,MRK:16,LUK:24,JHN:21,ACT:28,ROM:16,'1CO':16,'2CO':13,GAL:6,EPH:6,PHP:4,COL:4,'1TH':5,'2TH':3,'1TI':6,'2TI':4,TIT:3,PHM:1,HEB:13,JAS:5,'1PE':5,'2PE':3,'1JN':5,'2JN':1,'3JN':1,JUD:1,REV:22 };

const ROOT = process.argv[2] || '/tmp/Biblia';
fs.rmSync(ROOT, { recursive: true, force: true });
fs.mkdirSync(ROOT, { recursive: true });

const pad = (c, total) => String(c).padStart(String(total).length, '0');
const chapBase = (name, c) => `${name} ${pad(c, CANON_BY_NAME[name])}`;
const CANON_BY_NAME = {};
BOOKS.forEach((b) => (CANON_BY_NAME[b.name] = CANON[b.id]));
const folderName = (b, i) => `${String(i + 1).padStart(2, '0')} ${b.name}`;

// lista global ordenada de capítulos (para prev/next continuo)
const flat = [];
BOOKS.forEach((b, i) => { for (let c = 1; c <= CANON[b.id]; c++) flat.push({ b, i, c }); });

let nNotes = 0;
flat.forEach((it, gi) => {
  const folder = path.join(ROOT, folderName(it.b, it.i));
  fs.mkdirSync(folder, { recursive: true });
  const prev = gi > 0 ? flat[gi - 1] : null;
  const next = gi < flat.length - 1 ? flat[gi + 1] : null;
  const prevL = prev ? `[[${chapBase(prev.b.name, prev.c)}|‹ ${prev.b.name} ${prev.c}]]` : '';
  const nextL = next ? `[[${chapBase(next.b.name, next.c)}|${next.b.name} ${next.c} ›]]` : '';
  const idxL = `[[${it.b.name}|${it.b.name}]]`;
  const nav = [prevL, idxL, nextL].filter(Boolean).join('  ·  ');
  const body =
    `# ${it.b.name} ${it.c}\n\n${nav}\n\n` +
    '```bible\n' + `${it.b.name} ${it.c}\n` + '```\n\n' +
    `${nav}\n`;
  fs.writeFileSync(path.join(folder, `${chapBase(it.b.name, it.c)}.md`), body);
  nNotes++;
});

// índice por libro
BOOKS.forEach((b, i) => {
  const folder = path.join(ROOT, folderName(b, i));
  const links = [];
  for (let c = 1; c <= CANON[b.id]; c++) links.push(`[[${chapBase(b.name, c)}|${c}]]`);
  fs.writeFileSync(path.join(folder, `${b.name}.md`), `# ${b.name}\n\nCapítulos: ${links.join(' · ')}\n`);
});

// índice general
const at = BOOKS.slice(0, 39).map((b) => `[[${b.name}]]`).join(' · ');
const nt = BOOKS.slice(39).map((b) => `[[${b.name}]]`).join(' · ');
fs.writeFileSync(path.join(ROOT, 'Biblia.md'),
  `# La Biblia\n\n> La versión mostrada depende de la *versión por defecto* del plugin (ajustes). Cámbiala para leer toda la Biblia en otra versión.\n\n## Antiguo Testamento\n${at}\n\n## Nuevo Testamento\n${nt}\n`);

console.log(`Notas de capítulo: ${nNotes}`);
console.log(`Índices de libro: ${BOOKS.length}  +  1 índice general`);
console.log(`-> ${ROOT}`);
