# Importador de Biblias

Convierte un archivo de una versión bíblica al formato JSON que usa el plugin.

```bash
node build-bible.mjs <entrada> --id RV --name "Reina-Valera 1960" --abbr RV [--out <archivo>]
```

- `--id` identificador corto y único (nombre del archivo: `RV.json`).
- `--name` nombre completo para mostrar.
- `--abbr` abreviatura mostrada junto a las referencias (`RV`, `NTV`, `NBV`).
- `--out` ruta de salida (por defecto `../bibles/<id>.json`).

El resultado va a `bibles/<id>.json`. Repite el comando para cada versión.

## Formatos de entrada admitidos (autodetectados)

### 0) Markdown con superíndices (`.md` / `.txt`) — "Biblia en Obsidian"
Títulos de libro con `# GÉNESIS`, capítulos con `## Capítulo 1` y números de
versículo en superíndice Unicode (¹ ² ³ …), incluyendo combinados `¹¹-¹²`.
Es el formato típico exportado para Obsidian. Se detecta solo.

```
# JUAN

## Capítulo 3

¹⁶ Dios amó tanto al mundo, que dio a su único Hijo...
```

**Desde un `.docx` (estilo NTV web):** primero conviértelo con el ayudante:

```bash
python3 docx-a-texto.py "biblia_ntv.docx" ntv.txt
node build-bible.mjs ntv.txt --id NTV --name "Nueva Traducción Viviente" --abbr NTV
```

### 1) VPL — texto por versículo (`.txt`)
Una línea por versículo: `Libro Capítulo:Versículo` y luego el texto.

```
Juan 3:16  Porque de tal manera amó Dios al mundo...
Juan 3:17  Porque no envió Dios a su Hijo al mundo...
1 Juan 2:5 Pero el que guarda su palabra...
Salmos 23:1 El Señor es mi pastor; nada me faltará.
```

### 2) CSV / TSV (`.csv` / `.tsv`)
Columnas `libro, capitulo, versiculo, texto` (con o sin encabezado).
Separador `,`, `;` o tabulación (autodetectado).

```csv
libro,capitulo,versiculo,texto
Juan,3,16,"Porque de tal manera amó Dios al mundo..."
Juan,3,17,"Porque no envió Dios a su Hijo..."
```

### 3) JSON anidado (`.json`)
Objeto `{ libro: { capítulo: { versículo: "texto" } } }`:

```json
{
  "Juan": { "3": { "16": "Porque de tal manera...", "17": "Porque no envió..." } },
  "Salmos": { "23": { "1": "El Señor es mi pastor..." } }
}
```

### 4) JSON ya en formato del plugin
Si el archivo ya tiene `books[].id`, se valida y reordena según el canon.

## Notas

- Los nombres de libro se reconocen en español con o sin tildes y en
  abreviatura (`Juan`/`Jn`, `Salmos`/`Sal`, `1 Juan`/`1Jn`, etc.). El mapeo es
  el mismo que usa el plugin, así que nunca se desincronizan.
- Los libros no reconocidos se informan al final y se omiten.
- Los versículos faltantes dentro de un capítulo se rellenan (el plugin los
  muestra como "no disponible"). Con una versión completa no debería haber.

## Derechos de autor

RV1909 / Reina-Valera antiguas son de dominio público. **NTV** y **NBV** (y
RV1960) están bajo derechos de autor; usa únicamente archivos que ya poseas
para tu uso personal. No se incluye texto bíblico con derechos en este
repositorio.
