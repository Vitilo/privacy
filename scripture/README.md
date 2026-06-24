# Biblia (base de datos) — plugin de Obsidian

Guarda la Biblia como **base de datos** y la muestra **renderizada**, no como
notas editables. Resuelve de raíz los problemas de tener la Biblia "suelta" en
notas con bloques `^v334455`.

## Qué resuelve

| Problema | Solución |
|---|---|
| Las referencias se ven como `v445566` en vez de `Juan 3:16` | Se renderiza el texto real con su referencia legible. |
| Marcas `^v334455` al costado; obliga a modo edición | No hay bloques ni IDs: funciona perfecto en **modo lectura**. |
| El texto de la Biblia se puede editar por error (y rompía Obsidian) | El texto es **generado desde datos**: es imposible de editar. Nunca toca el sistema de archivos. |
| Quiero resaltar / cambiar color y tamaño, pero no el texto | Resaltados con un clic, **guardados aparte** del texto. Tamaño y formato configurables. |
| Referenciar rangos como `Juan 3:17-19` | Soporta rangos, listas (`3:16,18`) y rangos entre capítulos (`3:16-4:2`). |

## Instalación

1. En tu vault, crea la carpeta:
   `<vault>/.obsidian/plugins/scripture-db/`
2. Copia ahí estos archivos: **`main.js`**, **`manifest.json`**, **`styles.css`**.
3. Copia también la carpeta **`bibles/`** (con tus `.json`) dentro de
   `scripture-db/`.
4. En Obsidian: *Ajustes → Plugins de la comunidad → Activar* y enciende
   **"Biblia (base de datos)"**.
   (Si aparece "modo restringido", desactívalo para plugins locales.)

> No requiere compilar nada. `main.js` ya está listo para usar.

## Uso

**Pasaje en bloque** — escribe en cualquier nota:

~~~markdown
```bible
Juan 3:16-19
```
~~~

Varias referencias y opciones:

~~~markdown
```bible
version: NTV
layout: versiculos
Juan 3:16-19
Salmos 23
1 Juan 2:5,10
```
~~~

- `version:` elige la versión para ese bloque (si no, usa la de los ajustes).
- `layout:` `parrafo` (texto corrido) o `versiculos` (uno por línea).

**Referencia en línea** — dentro de una frase:

```markdown
Como dice `bible:Juan 3:16`, el amor de Dios...
```

Se muestra como **Juan 3:16** (con el texto en el tooltip al pasar el cursor).

**Formatos de referencia admitidos:**

| Escribes | Significa |
|---|---|
| `Juan 3:16` | un versículo |
| `Juan 3:16-19` | rango de versículos |
| `Juan 3:16,18,20` | lista de versículos |
| `Juan 3:16-18,21` | rangos + lista combinados |
| `Juan 3:16-4:2` | rango entre capítulos |
| `Juan 3` | capítulo completo |
| `1 Juan 2:5` / `1Juan2:5` | libros con número (con o sin espacio) |

Acepta nombres y abreviaturas en español (`Juan`, `Jn`, `Salmos`, `Sal`,
`Génesis`, `Gn`, `Apocalipsis`, `Ap`, etc.) con o sin tildes.

## Resaltar (sin editar el texto)

- **Clic** sobre un versículo: cicla colores (amarillo → verde → azul → rosa →
  naranja → sin color).
- **Clic derecho**: menú para elegir un color exacto o **copiar** el versículo.

Los resaltados se guardan en los datos del plugin (`data.json`), **separados
del texto bíblico**. El texto nunca se modifica.

## Ajustes

- **Versión por defecto** — la que se usa cuando no indicas `version:`.
- **Carpeta de Biblias** — vacío = la del propio plugin (recomendado).
- **Formato** — párrafo o un versículo por línea.
- **Mostrar número de versículo / versión**.
- **Tamaño de letra (px)** — 0 = usar el del tema.

## Importar tus versiones (RV, NTV, NBV)

Ver `importer/README.md`. En resumen:

```bash
node importer/build-bible.mjs <tu-archivo> --id RV --name "Reina-Valera 1960" --abbr RV
```

Esto crea `bibles/RV.json`. Repite para NTV y NBV.

## Leer la Biblia de corrido

Para leer capítulo por capítulo (no solo citar versículos), genera las notas de
lectura: una nota por capítulo, con navegación ‹ anterior / siguiente ›, índices
por libro y un índice general.

```bash
node importer/generar-notas-lectura.mjs "/ruta/a/tu/vault/Biblia"
```

Las notas usan la **versión por defecto** del plugin, así que una sola colección
sirve para todas tus versiones: cambia la versión en los ajustes y toda la
lectura cambia. Abre `Biblia.md` para empezar. El texto se muestra en **modo
lectura**, no editable, y resaltable con clic.

## Migrar desde las notas antiguas (`v334455`)

Una vez que confirmes que tus pasajes se ven bien con el plugin, ya **no
necesitas** las notas de la Biblia llenas de bloques `^v334455`. Puedes
archivarlas o borrarlas. Tus notas de estudio siguen igual: solo cambia la
forma de **citar** los versículos (ahora con ```bible o `bible:...`).

## Probar el motor (opcional)

```bash
node test/core.test.mjs
```

## Estructura

```
scripture-db/
├── main.js            ← el plugin (listo para usar)
├── manifest.json
├── styles.css
├── bibles/            ← tus versiones en JSON (la BD)
│   ├── EJEMPLO.json   (datos de prueba; reemplázalo)
│   ├── RV.json
│   ├── NTV.json
│   └── NBV.json
├── importer/
│   ├── build-bible.mjs
│   └── README.md
└── test/core.test.mjs
```
