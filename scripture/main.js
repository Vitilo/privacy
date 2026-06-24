'use strict';

/*
 * Scripture (Biblia) — Obsidian plugin
 * -------------------------------------
 * La Biblia se guarda como BASE DE DATOS (JSON) y se RENDERIZA bajo demanda.
 * El texto nunca es una nota editable: es imposible editarlo por error y
 * funciona en modo lectura. Los resaltados se guardan APARTE del texto.
 *
 * Distribución: este archivo es CommonJS y se usa tal cual (sin compilar).
 *
 * El bloque inferior de "bindings" permite que las funciones puras
 * (parser de referencias, registro de libros, búsqueda) se puedan importar
 * desde Node para pruebas, sin necesidad de Obsidian.
 */

/* ============================================================
 *  Obsidian bindings (con fallback para correr pruebas en Node)
 * ============================================================ */
let Plugin = class {};
let PluginSettingTab = class {};
let Setting = class { constructor() {} };
let Notice = class { constructor() {} };
let Menu = class { constructor() {} addItem() {} showAtMouseEvent() {} };
let normalizePath = (p) => p;
let _OBSIDIAN = false;
try {
  const o = require('obsidian');
  Plugin = o.Plugin;
  PluginSettingTab = o.PluginSettingTab;
  Setting = o.Setting;
  Notice = o.Notice;
  Menu = o.Menu;
  normalizePath = o.normalizePath || normalizePath;
  _OBSIDIAN = true;
} catch (e) {
  // Fuera de Obsidian (p. ej. node test/core.test.mjs). Se usan los fallbacks.
}

/* ============================================================
 *  Registro de libros (canon protestante de 66 libros)
 *  id  = código canónico (USFM)
 *  name = nombre en español (para mostrar)
 *  aliases = nombres/abreviaturas aceptadas al escribir referencias
 * ============================================================ */
const BOOKS = [
  { id: 'GEN', name: 'Génesis', aliases: ['genesis', 'gn', 'gen', 'ge'] },
  { id: 'EXO', name: 'Éxodo', aliases: ['exodo', 'ex', 'exo', 'ex'] },
  { id: 'LEV', name: 'Levítico', aliases: ['levitico', 'lv', 'lev'] },
  { id: 'NUM', name: 'Números', aliases: ['numeros', 'nm', 'num', 'nu'] },
  { id: 'DEU', name: 'Deuteronomio', aliases: ['deuteronomio', 'dt', 'deu', 'deut'] },
  { id: 'JOS', name: 'Josué', aliases: ['josue', 'jos', 'js'] },
  { id: 'JDG', name: 'Jueces', aliases: ['jueces', 'jue', 'jc', 'jdg'] },
  { id: 'RUT', name: 'Rut', aliases: ['rut', 'rt', 'ru'] },
  { id: '1SA', name: '1 Samuel', aliases: ['1 samuel', '1samuel', '1 sa', '1sa', '1 s', '1s', 'i samuel'] },
  { id: '2SA', name: '2 Samuel', aliases: ['2 samuel', '2samuel', '2 sa', '2sa', '2 s', '2s', 'ii samuel'] },
  { id: '1KI', name: '1 Reyes', aliases: ['1 reyes', '1reyes', '1 re', '1re', '1 r', '1r', 'i reyes'] },
  { id: '2KI', name: '2 Reyes', aliases: ['2 reyes', '2reyes', '2 re', '2re', '2 r', '2r', 'ii reyes'] },
  { id: '1CH', name: '1 Crónicas', aliases: ['1 cronicas', '1cronicas', '1 cr', '1cr', '1 cro', '1cro', 'i cronicas'] },
  { id: '2CH', name: '2 Crónicas', aliases: ['2 cronicas', '2cronicas', '2 cr', '2cr', '2 cro', '2cro', 'ii cronicas'] },
  { id: 'EZR', name: 'Esdras', aliases: ['esdras', 'esd', 'esr'] },
  { id: 'NEH', name: 'Nehemías', aliases: ['nehemias', 'neh', 'ne'] },
  { id: 'EST', name: 'Ester', aliases: ['ester', 'est', 'es'] },
  { id: 'JOB', name: 'Job', aliases: ['job', 'jb'] },
  { id: 'PSA', name: 'Salmos', aliases: ['salmos', 'salmo', 'sal', 'slm', 'sl'] },
  { id: 'PRO', name: 'Proverbios', aliases: ['proverbios', 'pr', 'prov', 'pro'] },
  { id: 'ECC', name: 'Eclesiastés', aliases: ['eclesiastes', 'ec', 'ecl', 'qo'] },
  { id: 'SNG', name: 'Cantares', aliases: ['cantares', 'cantar de los cantares', 'cnt', 'cant', 'ct'] },
  { id: 'ISA', name: 'Isaías', aliases: ['isaias', 'is', 'isa'] },
  { id: 'JER', name: 'Jeremías', aliases: ['jeremias', 'jer', 'jr'] },
  { id: 'LAM', name: 'Lamentaciones', aliases: ['lamentaciones', 'lam', 'lm'] },
  { id: 'EZK', name: 'Ezequiel', aliases: ['ezequiel', 'ez', 'eze', 'ezq'] },
  { id: 'DAN', name: 'Daniel', aliases: ['daniel', 'dn', 'dan'] },
  { id: 'HOS', name: 'Oseas', aliases: ['oseas', 'os', 'ose'] },
  { id: 'JOL', name: 'Joel', aliases: ['joel', 'jl', 'joe'] },
  { id: 'AMO', name: 'Amós', aliases: ['amos', 'am', 'amo'] },
  { id: 'OBA', name: 'Abdías', aliases: ['abdias', 'abd', 'ab'] },
  { id: 'JON', name: 'Jonás', aliases: ['jonas', 'jon', 'jns'] },
  { id: 'MIC', name: 'Miqueas', aliases: ['miqueas', 'miq', 'mi'] },
  { id: 'NAM', name: 'Nahúm', aliases: ['nahum', 'nah', 'na'] },
  { id: 'HAB', name: 'Habacuc', aliases: ['habacuc', 'hab', 'hb'] },
  { id: 'ZEP', name: 'Sofonías', aliases: ['sofonias', 'sof', 'so'] },
  { id: 'HAG', name: 'Hageo', aliases: ['hageo', 'hag', 'ag'] },
  { id: 'ZEC', name: 'Zacarías', aliases: ['zacarias', 'zac', 'za'] },
  { id: 'MAL', name: 'Malaquías', aliases: ['malaquias', 'mal', 'ml'] },
  { id: 'MAT', name: 'Mateo', aliases: ['mateo', 'mt', 'mat'] },
  { id: 'MRK', name: 'Marcos', aliases: ['marcos', 'mr', 'mc', 'mar'] },
  { id: 'LUK', name: 'Lucas', aliases: ['lucas', 'lc', 'luc', 'lu'] },
  { id: 'JHN', name: 'Juan', aliases: ['juan', 'jn', 'jua', 'jhn'] },
  { id: 'ACT', name: 'Hechos', aliases: ['hechos', 'hch', 'hec', 'hch'] },
  { id: 'ROM', name: 'Romanos', aliases: ['romanos', 'ro', 'rom', 'rm'] },
  { id: '1CO', name: '1 Corintios', aliases: ['1 corintios', '1corintios', '1 co', '1co', '1 cor', '1cor', 'i corintios'] },
  { id: '2CO', name: '2 Corintios', aliases: ['2 corintios', '2corintios', '2 co', '2co', '2 cor', '2cor', 'ii corintios'] },
  { id: 'GAL', name: 'Gálatas', aliases: ['galatas', 'ga', 'gal', 'gl'] },
  { id: 'EPH', name: 'Efesios', aliases: ['efesios', 'ef', 'efe'] },
  { id: 'PHP', name: 'Filipenses', aliases: ['filipenses', 'fil', 'flp', 'flp'] },
  { id: 'COL', name: 'Colosenses', aliases: ['colosenses', 'col', 'co'] },
  { id: '1TH', name: '1 Tesalonicenses', aliases: ['1 tesalonicenses', '1tesalonicenses', '1 ts', '1ts', '1 tes', '1tes', 'i tesalonicenses'] },
  { id: '2TH', name: '2 Tesalonicenses', aliases: ['2 tesalonicenses', '2tesalonicenses', '2 ts', '2ts', '2 tes', '2tes', 'ii tesalonicenses'] },
  { id: '1TI', name: '1 Timoteo', aliases: ['1 timoteo', '1timoteo', '1 ti', '1ti', '1 tim', '1tim', 'i timoteo'] },
  { id: '2TI', name: '2 Timoteo', aliases: ['2 timoteo', '2timoteo', '2 ti', '2ti', '2 tim', '2tim', 'ii timoteo'] },
  { id: 'TIT', name: 'Tito', aliases: ['tito', 'tit', 'ti'] },
  { id: 'PHM', name: 'Filemón', aliases: ['filemon', 'flm', 'film'] },
  { id: 'HEB', name: 'Hebreos', aliases: ['hebreos', 'heb', 'hb'] },
  { id: 'JAS', name: 'Santiago', aliases: ['santiago', 'st', 'stg', 'sant'] },
  { id: '1PE', name: '1 Pedro', aliases: ['1 pedro', '1pedro', '1 pe', '1pe', '1 p', '1p', 'i pedro'] },
  { id: '2PE', name: '2 Pedro', aliases: ['2 pedro', '2pedro', '2 pe', '2pe', '2 p', '2p', 'ii pedro'] },
  { id: '1JN', name: '1 Juan', aliases: ['1 juan', '1juan', '1 jn', '1jn', 'i juan'] },
  { id: '2JN', name: '2 Juan', aliases: ['2 juan', '2juan', '2 jn', '2jn', 'ii juan'] },
  { id: '3JN', name: '3 Juan', aliases: ['3 juan', '3juan', '3 jn', '3jn', 'iii juan'] },
  { id: 'JUD', name: 'Judas', aliases: ['judas', 'jud', 'jd'] },
  { id: 'REV', name: 'Apocalipsis', aliases: ['apocalipsis', 'ap', 'apo', 'rev'] },
];

/** Quita acentos, pasa a minúsculas, quita puntos y normaliza espacios. */
function norm(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Mapa: alias normalizado -> bookId (incluye variante sin espacios)
const ALIAS_MAP = (() => {
  const m = new Map();
  for (const b of BOOKS) {
    const add = (a) => {
      const n = norm(a);
      if (n) m.set(n, b.id);
      const ns = n.replace(/\s+/g, '');
      if (ns) m.set(ns, b.id);
    };
    add(b.name);
    for (const a of b.aliases) add(a);
  }
  return m;
})();

const BOOK_BY_ID = (() => {
  const m = new Map();
  for (const b of BOOKS) m.set(b.id, b);
  return m;
})();

/** Resuelve un nombre/abreviatura de libro a su bookId, o null. */
function resolveBook(name) {
  const n = norm(name);
  if (ALIAS_MAP.has(n)) return ALIAS_MAP.get(n);
  const ns = n.replace(/\s+/g, '');
  if (ALIAS_MAP.has(ns)) return ALIAS_MAP.get(ns);
  return null;
}

/* ============================================================
 *  Parser de referencias
 * ============================================================ */

/** Parsea la parte numérica de una referencia ("3", "3:16", "3:16-19", "3:16,18", "3:16-4:2"). */
function parseNumericSpec(specRaw) {
  const spec = String(specRaw).replace(/\s+/g, '').replace(/[–—]/g, '-');
  // Rango entre capítulos:  3:16-4:2
  let m = spec.match(/^(\d+)[:.](\d+)-(\d+)[:.](\d+)$/);
  if (m) {
    return { type: 'crossRange', c1: +m[1], v1: +m[2], c2: +m[3], v2: +m[4] };
  }
  // Capítulo completo:  3
  if (/^\d+$/.test(spec)) {
    return { type: 'chapter', chapter: +spec };
  }
  // Capítulo : lista de versículos/rangos:  3:16  /  3:16-19  /  3:16,18-20
  m = spec.match(/^(\d+)[:.](.+)$/);
  if (!m) return null;
  const chapter = +m[1];
  const verses = [];
  for (const seg of m[2].split(',')) {
    const r = seg.match(/^(\d+)(?:-(\d+))?$/);
    if (!r) return null;
    const a = +r[1];
    const b = r[2] ? +r[2] : a;
    if (b < a) return null;
    verses.push([a, b]);
  }
  return { type: 'verses', chapter, verses };
}

/**
 * Parsea una cadena con una o varias referencias separadas por ; o salto de línea.
 * Devuelve { refs: [...], errors: [...] }.
 * Cada ref: { bookId, bookName, spec, raw }
 */
function parseReference(input) {
  const refs = [];
  const errors = [];
  const tokens = String(input)
    .split(/[;\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of tokens) {
    // libro (puede empezar con 1/2/3 o I/II/III) + parte numérica.
    // El espacio entre el libro y el capítulo es opcional ("Juan 3:16" o "Juan3:16").
    const m = token.match(/^\s*(.+?)\s*(\d[\d\s:.,–—-]*)\s*$/);
    if (!m) {
      errors.push(`No se entendió la referencia: "${token}"`);
      continue;
    }
    const bookId = resolveBook(m[1]);
    if (!bookId) {
      errors.push(`Libro desconocido: "${m[1].trim()}"`);
      continue;
    }
    const spec = parseNumericSpec(m[2]);
    if (!spec) {
      errors.push(`No se entendió el capítulo/versículo en: "${token}"`);
      continue;
    }
    refs.push({ bookId, bookName: BOOK_BY_ID.get(bookId).name, spec, raw: token });
  }
  return { refs, errors };
}

/** Etiqueta legible de una referencia, p. ej. "Juan 3:16-19". */
function formatLabel(ref) {
  const name = ref.bookName;
  const s = ref.spec;
  if (s.type === 'chapter') return `${name} ${s.chapter}`;
  if (s.type === 'crossRange') return `${name} ${s.c1}:${s.v1}-${s.c2}:${s.v2}`;
  // verses
  const parts = s.verses.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`));
  return `${name} ${s.chapter}:${parts.join(',')}`;
}

/**
 * Devuelve la lista de versículos { chapter, verse, text } para una referencia,
 * usando una traducción cargada: book -> { name, chapters: [[v1,v2,...], ...] }.
 * 'missing' marca versículos fuera de rango.
 */
function lookupVerses(translation, ref) {
  const out = [];
  const book = translation.index.get(ref.bookId);
  if (!book) return out;
  const chapters = book.chapters;
  const getVerse = (c, v) => {
    const arr = chapters[c - 1];
    if (!arr) return null;
    const t = arr[v - 1];
    return t == null ? null : t;
  };
  const s = ref.spec;

  if (s.type === 'chapter') {
    const arr = chapters[s.chapter - 1] || [];
    for (let i = 0; i < arr.length; i++) {
      out.push({ chapter: s.chapter, verse: i + 1, text: arr[i] });
    }
  } else if (s.type === 'verses') {
    for (const [a, b] of s.verses) {
      for (let v = a; v <= b; v++) {
        const t = getVerse(s.chapter, v);
        out.push({ chapter: s.chapter, verse: v, text: t, missing: t == null });
      }
    }
  } else if (s.type === 'crossRange') {
    for (let c = s.c1; c <= s.c2; c++) {
      const arr = chapters[c - 1] || [];
      const from = c === s.c1 ? s.v1 : 1;
      const to = c === s.c2 ? s.v2 : arr.length;
      for (let v = from; v <= to; v++) {
        const t = getVerse(c, v);
        out.push({ chapter: c, verse: v, text: t, missing: t == null });
      }
    }
  }
  return out;
}

/** Construye el índice book.id -> book a partir del JSON de una traducción. */
function indexTranslation(data) {
  const index = new Map();
  for (const b of data.books || []) index.set(b.id, b);
  return {
    id: data.id,
    name: data.name || data.id,
    abbr: data.abbr || data.id,
    language: data.language || 'es',
    index,
  };
}

/* ============================================================
 *  Plugin de Obsidian
 * ============================================================ */

const PALETTE = ['', 'amarillo', 'verde', 'azul', 'rosa', 'naranja'];
const PALETTE_LABEL = {
  '': 'Sin color',
  amarillo: 'Amarillo',
  verde: 'Verde',
  azul: 'Azul',
  rosa: 'Rosa',
  naranja: 'Naranja',
};

const DEFAULT_SETTINGS = {
  defaultTranslation: '',   // id de la traducción por defecto (vacío = la primera)
  bibleFolder: '',          // carpeta de los .json (vacío = <plugin>/bibles)
  layout: 'parrafo',        // 'parrafo' | 'versiculos'
  showTranslation: true,    // mostrar la abreviatura de la versión en el encabezado
  showVerseNumbers: true,
  fontSize: 0,              // 0 = heredar del tema; si >0, px
};

class ScripturePlugin extends Plugin {
  async onload() {
    const data = (await this.loadData()) || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
    this.highlights = data.highlights || {};
    this._cache = new Map();      // id -> translation indexada
    this._saveTimer = null;

    this.addSettingTab(new ScriptureSettingTab(this.app, this));

    // Bloque de código: ```bible  / ```biblia
    const blockHandler = (source, el, ctx) => this.renderBlock(source, el, ctx);
    this.registerMarkdownCodeBlockProcessor('bible', blockHandler);
    this.registerMarkdownCodeBlockProcessor('biblia', blockHandler);

    // Referencias en línea:  `bible:Juan 3:16`  /  `b:Juan 3:16`
    this.registerMarkdownPostProcessor((el, ctx) => this.renderInline(el, ctx));

    // Comandos
    this.addCommand({
      id: 'insert-scripture-block',
      name: 'Insertar pasaje (bloque)',
      editorCallback: (editor) => {
        const tr = this.settings.defaultTranslation;
        const head = tr ? `version: ${tr}\n` : '';
        editor.replaceSelection('```bible\n' + head + 'Juan 3:16-19\n```\n');
      },
    });
    this.addCommand({
      id: 'insert-scripture-inline',
      name: 'Insertar versículo en línea',
      editorCallback: (editor) => {
        editor.replaceSelection('`bible:Juan 3:16`');
      },
    });

    if (this.settings.fontSize > 0) {
      document.body.style.setProperty('--scr-font-size', this.settings.fontSize + 'px');
    }
  }

  onunload() {
    this._cache.clear();
  }

  async saveSettings() {
    await this.persist();
    if (this.settings.fontSize > 0) {
      document.body.style.setProperty('--scr-font-size', this.settings.fontSize + 'px');
    } else {
      document.body.style.removeProperty('--scr-font-size');
    }
  }

  async persist() {
    await this.saveData({ settings: this.settings, highlights: this.highlights });
  }

  schedulePersist() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.persist(), 600);
  }

  /* -------- Base de datos -------- */

  bibleDir() {
    if (this.settings.bibleFolder) return normalizePath(this.settings.bibleFolder);
    return normalizePath(this.manifest.dir + '/bibles');
  }

  async listTranslations() {
    const dir = this.bibleDir();
    try {
      const res = await this.app.vault.adapter.list(dir);
      return (res.files || [])
        .filter((f) => f.toLowerCase().endsWith('.json'))
        .map((f) => f.split('/').pop().replace(/\.json$/i, ''));
    } catch (e) {
      return [];
    }
  }

  async getTranslation(id) {
    if (!id) {
      // por defecto: la configurada o la primera disponible
      id = this.settings.defaultTranslation;
      if (!id) {
        const all = await this.listTranslations();
        id = all[0];
      }
    }
    if (!id) return null;
    if (this._cache.has(id)) return this._cache.get(id);
    const path = normalizePath(this.bibleDir() + '/' + id + '.json');
    try {
      const raw = await this.app.vault.adapter.read(path);
      const tr = indexTranslation(JSON.parse(raw));
      this._cache.set(id, tr);
      return tr;
    } catch (e) {
      return null;
    }
  }

  /* -------- Resaltados (guardados aparte del texto) -------- */

  hlKey(trId, bookId, ch, v) {
    return `${trId}:${bookId}:${ch}:${v}`;
  }

  getHighlight(trId, bookId, ch, v) {
    return this.highlights[this.hlKey(trId, bookId, ch, v)] || '';
  }

  setHighlight(trId, bookId, ch, v, color) {
    const key = this.hlKey(trId, bookId, ch, v);
    if (color) this.highlights[key] = color;
    else delete this.highlights[key];
    this.schedulePersist();
  }

  /* -------- Render del bloque ```bible -------- */

  async renderBlock(source, el, ctx) {
    el.empty();
    const container = el.createDiv({ cls: 'scripture-block' });

    // Directivas opcionales (version:, layout:) y líneas de referencia.
    let trId = this.settings.defaultTranslation;
    let layout = this.settings.layout;
    const refLines = [];
    for (const lineRaw of source.split('\n')) {
      const line = lineRaw.trim();
      if (!line) continue;
      const d = line.match(/^(version|traduccion|translation|layout|formato)\s*:\s*(.+)$/i);
      if (d) {
        const key = d[1].toLowerCase();
        const val = d[2].trim();
        if (key === 'layout' || key === 'formato') {
          layout = /vers/i.test(val) ? 'versiculos' : 'parrafo';
        } else {
          trId = val;
        }
        continue;
      }
      refLines.push(line);
    }

    const translation = await this.getTranslation(trId);
    if (!translation) {
      this.renderError(container, trId
        ? `No se encontró la versión "${trId}". Revisa la carpeta de Biblias en los ajustes.`
        : 'No hay ninguna versión instalada. Coloca un archivo .json en la carpeta de Biblias.');
      return;
    }

    const { refs, errors } = parseReference(refLines.join('\n'));
    for (const err of errors) this.renderError(container, err);
    if (!refs.length) return;

    for (const ref of refs) {
      this.renderPassage(container, translation, ref, layout);
    }
  }

  renderPassage(container, translation, ref, layout) {
    const passage = container.createDiv({ cls: 'scr-passage' });

    const header = passage.createDiv({ cls: 'scr-ref' });
    header.setText(formatLabel(ref));
    if (this.settings.showTranslation) {
      header.createSpan({ cls: 'scr-version', text: ' ' + translation.abbr });
    }

    const verses = lookupVerses(translation, ref);
    if (!verses.length) {
      this.renderError(passage, `No hay texto para ${formatLabel(ref)} en ${translation.abbr}.`);
      return;
    }

    const body = passage.createDiv({
      cls: 'scr-body ' + (layout === 'versiculos' ? 'scr-layout-versiculos' : 'scr-layout-parrafo'),
    });

    for (const v of verses) {
      const vEl = body.createSpan({ cls: 'scr-verse' });
      vEl.dataset.t = translation.id;
      vEl.dataset.b = ref.bookId;
      vEl.dataset.c = String(v.chapter);
      vEl.dataset.v = String(v.verse);
      this.applyHighlightClass(vEl, translation.id, ref.bookId, v.chapter, v.verse);

      if (this.settings.showVerseNumbers) {
        vEl.createEl('sup', { cls: 'scr-vn', text: String(v.verse) });
      }
      vEl.createSpan({ cls: 'scr-text', text: v.missing ? '⟨versículo no disponible⟩' : v.text });
      if (v.missing) vEl.addClass('scr-missing');

      this.attachHighlightHandlers(vEl, translation.id, ref.bookId, v.chapter, v.verse);
    }
  }

  applyHighlightClass(vEl, trId, bookId, ch, v) {
    for (const c of PALETTE) if (c) vEl.removeClass('scr-hl-' + c);
    const color = this.getHighlight(trId, bookId, ch, v);
    if (color) vEl.addClass('scr-hl-' + color);
  }

  attachHighlightHandlers(vEl, trId, bookId, ch, v) {
    // Clic: cicla colores. Permite resaltar SIN editar el texto.
    vEl.addEventListener('click', (ev) => {
      if (ev.defaultPrevented) return;
      const cur = this.getHighlight(trId, bookId, ch, v);
      const next = PALETTE[(PALETTE.indexOf(cur) + 1) % PALETTE.length];
      this.setHighlight(trId, bookId, ch, v, next);
      this.applyHighlightClass(vEl, trId, bookId, ch, v);
    });
    // Clic derecho: menú para elegir color exacto o copiar.
    vEl.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      const menu = new Menu();
      for (const c of PALETTE) {
        menu.addItem((item) =>
          item
            .setTitle(PALETTE_LABEL[c])
            .setChecked(this.getHighlight(trId, bookId, ch, v) === c)
            .onClick(() => {
              this.setHighlight(trId, bookId, ch, v, c);
              this.applyHighlightClass(vEl, trId, bookId, ch, v);
            })
        );
      }
      menu.addSeparator?.();
      menu.addItem((item) =>
        item.setTitle('Copiar versículo').onClick(() => {
          const text = vEl.querySelector('.scr-text')?.textContent || '';
          navigator.clipboard?.writeText(text);
          new Notice('Versículo copiado');
        })
      );
      menu.showAtMouseEvent(ev);
    });
  }

  /* -------- Render en línea  `bible:Juan 3:16` -------- */

  async renderInline(el, ctx) {
    const codes = Array.from(el.querySelectorAll('code'));
    for (const code of codes) {
      if (code.parentElement && code.parentElement.tagName === 'PRE') continue;
      const raw = code.textContent || '';
      const m = raw.match(/^\s*(?:bible|biblia|b)\s*:\s*(.+)$/i);
      if (!m) continue;

      const { refs } = parseReference(m[1]);
      if (!refs.length) continue;
      const ref = refs[0];

      const chip = document.createElement('span');
      chip.className = 'scr-inline';
      chip.textContent = formatLabel(ref);
      code.replaceWith(chip);

      // Carga el texto para el tooltip (sin bloquear el render).
      this.getTranslation(this.settings.defaultTranslation).then((tr) => {
        if (!tr) return;
        const verses = lookupVerses(tr, ref);
        const text = verses
          .map((v) => `${v.verse} ${v.missing ? '—' : v.text}`)
          .join('  ');
        if (text) {
          chip.setAttribute('title', `${formatLabel(ref)} (${tr.abbr})\n${text}`);
          chip.setAttribute('aria-label', text);
        }
      });
    }
  }

  renderError(container, msg) {
    container.createDiv({ cls: 'scr-error', text: '⚠️ ' + msg });
  }
}

class ScriptureSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Biblia (base de datos)' });

    // Contenedor fijo en su posición; el desplegable se rellena al listar las
    // versiones (asíncrono) sin alterar el orden de los demás ajustes.
    const versionSlot = containerEl.createDiv();
    this.plugin.listTranslations().then((list) => {
      versionSlot.empty();
      new Setting(versionSlot)
        .setName('Versión por defecto')
        .setDesc(
          list.length
            ? 'Versiones encontradas: ' + list.join(', ')
            : 'No se encontraron archivos .json en la carpeta de Biblias.'
        )
        .addDropdown((dd) => {
          dd.addOption('', '(primera disponible)');
          for (const id of list) dd.addOption(id, id);
          dd.setValue(this.plugin.settings.defaultTranslation);
          dd.onChange(async (val) => {
            this.plugin.settings.defaultTranslation = val;
            await this.plugin.saveSettings();
          });
        });
    });

    new Setting(containerEl)
      .setName('Carpeta de Biblias')
      .setDesc('Vacío = se usa la carpeta del plugin (recomendado). O indica una carpeta del vault.')
      .addText((t) =>
        t
          .setPlaceholder('(carpeta del plugin)/bibles')
          .setValue(this.plugin.settings.bibleFolder)
          .onChange(async (val) => {
            this.plugin.settings.bibleFolder = val.trim();
            this.plugin._cache.clear();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Formato')
      .setDesc('Cómo se muestran los versículos.')
      .addDropdown((dd) => {
        dd.addOption('parrafo', 'Párrafo (texto corrido)');
        dd.addOption('versiculos', 'Un versículo por línea');
        dd.setValue(this.plugin.settings.layout);
        dd.onChange(async (val) => {
          this.plugin.settings.layout = val;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Mostrar número de versículo')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.showVerseNumbers).onChange(async (val) => {
          this.plugin.settings.showVerseNumbers = val;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Mostrar versión en el encabezado')
      .addToggle((t) =>
        t.setValue(this.plugin.settings.showTranslation).onChange(async (val) => {
          this.plugin.settings.showTranslation = val;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Tamaño de letra (px)')
      .setDesc('0 = usar el tamaño del tema.')
      .addText((t) =>
        t
          .setPlaceholder('0')
          .setValue(String(this.plugin.settings.fontSize || 0))
          .onChange(async (val) => {
            const n = parseInt(val, 10);
            this.plugin.settings.fontSize = isNaN(n) ? 0 : n;
            await this.plugin.saveSettings();
          })
      );

    const info = containerEl.createDiv({ cls: 'setting-item-description' });
    info.createEl('p', {
      text: 'Uso: escribe un bloque ```bible con una referencia por línea (Juan 3:16-19), ' +
        'o en línea `bible:Juan 3:16`. Haz clic en un versículo para resaltarlo; ' +
        'clic derecho para elegir color o copiar.',
    });
  }
}

module.exports = ScripturePlugin;
// Exporta las funciones puras para pruebas en Node (inofensivo dentro de Obsidian).
module.exports.__test = {
  norm,
  resolveBook,
  parseNumericSpec,
  parseReference,
  formatLabel,
  lookupVerses,
  indexTranslation,
  BOOKS,
};
