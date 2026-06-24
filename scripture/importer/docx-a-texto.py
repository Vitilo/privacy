#!/usr/bin/env python3
"""
Convierte un .docx de la Biblia (estilo "NTV web") a texto normalizado que el
importador entiende (# LIBRO / ## Capítulo N / cuerpo con superíndices).

    python3 docx-a-texto.py entrada.docx salida.txt

Supone esta estructura en el .docx:
  - Título de libro  -> párrafo con estilo "Título"  (p. ej. GÉNESIS)
  - Capítulo         -> párrafo con texto "--- Capítulo N ---"
  - Versículos       -> números en superíndice Unicode (¹ ² ³ ...)

Tolerancias:
  - Marcadores de capítulo corruptos (p. ej. "--- £---") o divisores
    editoriales ("----------") se ignoran; el importador recupera el
    "Capítulo 1" implícito cuando un libro empieza directo en el versículo 1.

Luego:
    node build-bible.mjs salida.txt --id NTV --name "Nueva Traducción Viviente" --abbr NTV
"""
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
def q(t): return W + t

CHAP = re.compile(r'-{2,}\s*Cap[íi]tulo\s+(\d+)\s*-{2,}', re.I)
DIV = re.compile(r'^\s*-{2,}.*-{2,}\s*$')

def style(p):
    ppr = p.find(q('pPr'))
    if ppr is not None:
        s = ppr.find(q('pStyle'))
        if s is not None:
            return s.get(q('val'))
    return None

def ptext(p):
    return ''.join((t.text or '') for r in p.findall(q('r')) for t in r.findall(q('t')))

def main():
    if len(sys.argv) < 3:
        print('Uso: python3 docx-a-texto.py entrada.docx salida.txt')
        sys.exit(1)
    src, dst = sys.argv[1], sys.argv[2]
    with zipfile.ZipFile(src) as z:
        xml = z.read('word/document.xml')
    body = ET.fromstring(xml).find(q('body'))

    out, books, chaps, skipped = [], 0, 0, 0
    for p in body.findall(q('p')):
        st = style(p)
        tx = ptext(p).strip()
        if st == 'Título' and tx:
            out.append('# ' + tx); books += 1; continue
        m = CHAP.search(tx)
        if m:
            out.append('## Capítulo ' + m.group(1)); chaps += 1; continue
        if DIV.match(tx):
            skipped += 1; continue          # divisor editorial o corrupto
        if tx:
            out.append(tx)

    with open(dst, 'w', encoding='utf-8') as f:
        f.write('\n\n'.join(out))
    print(f'libros: {books} | capítulos: {chaps} | divisores ignorados: {skipped}')
    print(f'-> {dst}')

if __name__ == '__main__':
    main()
