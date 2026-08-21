#!/usr/bin/env python3
"""Convierte el JSON del scanner (gemelo digital) a docs/permanente/celdas.tsv.

Formato de salida, identico al historico: hoja \t celda \t formula \t valor
(saltos de linea dentro de formulas escapados como \\n literal, backslash como \\\\).

USO: python3 devtools/gemelo_a_tsv.py <ruta_al_json> [ruta_tsv_salida]
"""
import io, json, sys

def esc(s):
    if s is None:
        return ''
    return str(s).replace('\\', '\\\\').replace('\n', '\\n').replace('\t', ' ')

def main():
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else 'docs/permanente/celdas.tsv'
    d = json.load(io.open(src, encoding='utf-8'))
    filas = ['hoja\tcelda\tformula\tvalor']
    total = 0
    for nombre, hoja in d['hojas'].items():
        mapa = hoja.get('mapa_celdas', {})
        for celda, c in mapa.items():
            if isinstance(c, dict):
                formula = c.get('formula', '') or ''
                valor = c.get('valor', c.get('valor_mostrado', '')) or ''
            else:
                formula, valor = '', c
            if formula == '' and valor == '':
                continue
            filas.append(f"{esc(nombre)}\t{celda}\t{esc(formula)}\t{esc(valor)}")
            total += 1
    io.open(dst, 'w', encoding='utf-8').write('\n'.join(filas) + '\n')
    print(f"{total} celdas -> {dst}  (export del {d.get('fecha_exportacion','?')})")

if __name__ == '__main__':
    main()
