#!/usr/bin/env python3
"""
generar_tsv_celdas.py

[CONCEPTO DE NEGOCIO]
Aplana el snapshot del gemelo digital (TIDETRACK_ARQUITECTURA_ESTRICTA.json,
exportado por el Scanner de Arquitectura desde la planilla) a un TSV de una
fila por celda: hoja / celda / formula / valor. Sirve para auditar la planilla
entera con awk, grep, sort y cut, SIN que el JSON entre nunca al contexto de
una sesion de Claude. El JSON pesa cientos de KB (y crecera a megas cuando el
scanner de cobertura total mapee las BDs); el TSV se consulta por linea.

[FUNDAMENTO TEORICO / ADMINISTRATIVO]
Es la capa MECANICA de la documentacion del gemelo digital: se regenera entera
en cada re-escaneo y jamas se edita a mano (la capa SEMANTICA curada vive en
MAPA_ARQUITECTURA_PLANILLA.md). El metodo viene de la auditoria Castellino en
planilla-pymes: un volcado de 8,2 MB se volvio auditable recien al aplanarlo a
un TSV indexable, porque permite responder "que hay en tal celda" y "que
formulas tocan tal hoja" con una sola pasada de texto, sin cargar el arbol.

@see docs/permanente/ARNES_TIDETRACK.md (seccion 4 - Fase 2, punto 4)
@see docs/permanente/ARNES_TIDETRACK.md (seccion 11 - correspondencia pymes)

Uso:
    python3 devtools/generar_tsv_celdas.py
    python3 devtools/generar_tsv_celdas.py --json otro_snapshot.json
    python3 devtools/generar_tsv_celdas.py --salida /tmp/celdas.tsv
    python3 devtools/generar_tsv_celdas.py --hojas-alfabetico

Lee  : docs/permanente/TIDETRACK_ARQUITECTURA_ESTRICTA.json (por defecto)
Emite: docs/permanente/celdas.tsv + celdas.tsv.meta (procedencia del volcado)

Columna 'valor': es el valor MOSTRADO de la celda (lo que se ve en pantalla)
cuando el snapshot lo trae, y el valor crudo cuando no. El scanner v0.8.4 emite
'valor_mostrado' en toda celda con formula, asi que en un snapshot nuevo la
columna 4 tiene el resultado calculado y los errores de runtime (#REF!, #N/A,
#DIV/0!) aparecen ahi. El snapshot de marzo 2026 es del scanner viejo y NO trae
ese campo: en el, las celdas con formula tienen la columna 4 vacia y la receta
de referencias rotas solo encuentra los #REF incrustados en el texto de la
formula. Al leer el TSV, mirar primero celdas.tsv.meta para saber cual de los
dos casos se esta auditando.

Recetas de auditoria sobre el TSV generado:
    # todas las celdas de una hoja
    awk -F'\\t' '$1=="Registros"' docs/permanente/celdas.tsv | head -50
    # cuantas celdas con formula tiene cada hoja
    awk -F'\\t' 'NR>1 && $3!="" {c[$1]++} END{for (h in c) print c[h], h}' \\
        docs/permanente/celdas.tsv | sort -rn
    # donde se usa QUERY
    awk -F'\\t' '$3 ~ /QUERY/ {print $1, $2}' docs/permanente/celdas.tsv
    # referencias rotas (columna 3 = texto de la formula, columna 4 = resultado)
    grep -n '#REF' docs/permanente/celdas.tsv

decision Franco 2026-08-13: el TSV es artefacto versionado junto al JSON, no
un temporal. Un diff de git sobre el TSV es legible; sobre el JSON no.
"""

import argparse
import json
import os
import re
import sys

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PATH_JSON_DEFECTO = os.path.join(
    RAIZ, "docs", "permanente", "TIDETRACK_ARQUITECTURA_ESTRICTA.json"
)
PATH_TSV_DEFECTO = os.path.join(RAIZ, "docs", "permanente", "celdas.tsv")

# Claves toleradas del snapshot. El scanner de cobertura total (Fase 2 punto 1)
# puede renombrar campos; el TSV no debe romperse por eso.
CLAVES_MAPA = ("mapa_celdas", "celdas")
CLAVES_FORMULA = ("formula", "formula_a1")
# decision Franco 2026-08-13: la columna 4 prefiere el valor MOSTRADO al crudo.
# El scanner emite 'valor: null' en toda celda con formula, asi que con el orden
# viejo (valor primero) las 1205 celdas con formula quedaban con la columna 4
# vacia y el TSV era ciego al resultado calculado y a los errores de runtime. El
# snapshot de marzo 2026 no tiene 'valor_mostrado': ahi se degrada a 'valor' sin
# romperse, y celdas.tsv.meta declara cual de los dos formatos se volco.
CLAVES_MOSTRADO = ("valor_mostrado", "valor_formateado", "formattedValue")
CLAVES_VALOR = ("valor", "value")

CABECERA = ("hoja", "celda", "formula", "valor")

# decision Franco 2026-08-13: los caracteres que romperian el TSV se escapan a
# secuencias literales de dos caracteres (\\ primero, luego \t \n \r) en vez de
# reemplazarse por espacio. Razon: el escape es REVERSIBLE (una formula
# multilinea se puede reconstruir exacta) y no inventa contenido, mientras que
# el reemplazo por espacio pierde informacion en silencio. Como \\ se escapa
# primero, no hay ambiguedad entre un backslash literal y un escape.
_ESCAPES = (
    ("\\", "\\\\"),
    ("\t", "\\t"),
    ("\r", "\\r"),
    ("\n", "\\n"),
)

RE_REF = re.compile(r"^\$?([A-Za-z]+)\$?(\d+)$")


def col_a_num(letras):
    """Convierte letras de columna a numero (A=1, Z=26, AA=27)."""
    n = 0
    for ch in letras:
        n = n * 26 + (ord(ch.upper()) - 64)
    return n


def clave_orden(ref):
    """Clave de orden estable: por columna y fila NUMERICAS (A9 antes que A10).

    Las refs que no parsean (rangos, nombres raros) van al final, ordenadas
    alfabeticamente, para que ninguna celda se pierda del volcado.
    """
    m = RE_REF.match(ref)
    if not m:
        return (10**9, 10**9, ref)
    return (col_a_num(m.group(1)), int(m.group(2)), "")


def escapar(texto):
    """Neutraliza tabs y saltos de linea para que una celda ocupe una linea."""
    for crudo, escapado in _ESCAPES:
        texto = texto.replace(crudo, escapado)
    return texto


def necesita_escape(valor):
    return isinstance(valor, str) and any(c in valor for c in ("\t", "\n", "\r", "\\"))


def formatear(valor):
    """Serializa un valor de celda a texto plano fiel a como lo muestra Sheets."""
    if valor is None:
        return ""
    if isinstance(valor, bool):
        return "TRUE" if valor else "FALSE"
    if isinstance(valor, float):
        # 1000.0 se escribe 1000; los decimales reales se preservan enteros.
        return str(int(valor)) if valor.is_integer() else repr(valor)
    if isinstance(valor, (int, str)):
        return str(valor)
    # Valores no escalares del scanner (ej. {"valueType": "IMAGE"}): JSON compacto.
    return json.dumps(valor, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def primera_clave(celda, claves):
    for k in claves:
        if k in celda:
            return celda[k]
    return None


def valor_de_celda(celda):
    """Texto de la columna 4: el valor mostrado si aporta, si no el crudo.

    Un valor_mostrado vacio NO pisa a un valor crudo con contenido: una celda
    puede estar oculta por formato (';;;') y seguir teniendo dato.
    """
    mostrado = formatear(primera_clave(celda, CLAVES_MOSTRADO))
    if mostrado:
        return mostrado
    return formatear(primera_clave(celda, CLAVES_VALOR))


def mapa_de_hoja(hoja):
    for k in CLAVES_MAPA:
        if isinstance(hoja, dict) and isinstance(hoja.get(k), dict):
            return hoja[k]
    return None


def main():
    ap = argparse.ArgumentParser(
        description="Aplana el snapshot JSON del gemelo digital a celdas.tsv"
    )
    ap.add_argument("--json", dest="ruta_json", default=PATH_JSON_DEFECTO,
                    help="snapshot de entrada (por defecto el versionado en docs/permanente)")
    ap.add_argument("--salida", dest="ruta_tsv", default=None,
                    help="TSV de salida (por defecto docs/permanente/celdas.tsv cuando"
                         " se lee el snapshot versionado, y <entrada>.tsv cuando se lee otro)")
    ap.add_argument("--hojas-alfabetico", action="store_true",
                    help="ordena las hojas alfabeticamente en vez de por orden de pestana")
    args = ap.parse_args()

    # decision Franco 2026-08-13: la salida se deriva de la entrada. Con el default
    # fijo, un 'generar_tsv_celdas.py --json /tmp/prueba.json' pisaba en silencio el
    # celdas.tsv versionado con contenido de otro snapshot.
    ruta_tsv = args.ruta_tsv
    if ruta_tsv is None:
        if os.path.abspath(args.ruta_json) == os.path.abspath(PATH_JSON_DEFECTO):
            ruta_tsv = PATH_TSV_DEFECTO
        else:
            base = os.path.splitext(os.path.abspath(args.ruta_json))[0]
            ruta_tsv = base + ".tsv"

    if not os.path.isfile(args.ruta_json):
        print("ERROR: no existe el snapshot " + args.ruta_json, file=sys.stderr)
        return 2
    try:
        with open(args.ruta_json, encoding="utf-8") as f:
            arq = json.load(f)
    except (ValueError, OSError) as e:
        print("ERROR: no se pudo leer el JSON: " + str(e), file=sys.stderr)
        return 2

    hojas = arq.get("hojas")
    if not isinstance(hojas, dict):
        print("ERROR: el JSON no tiene el nodo 'hojas'", file=sys.stderr)
        return 2

    nombres = list(hojas.keys())
    if args.hojas_alfabetico:
        nombres.sort()

    filas = []
    con_formula = 0
    con_valor_mostrado = 0
    escapadas = 0
    hojas_vacias = []      # mapa_celdas presente pero sin celdas: hoja vacia legitima
    hojas_sin_mapa = []    # falta el nodo o no es un dict: anomalia del snapshot

    for nombre in nombres:
        mapa = mapa_de_hoja(hojas[nombre])
        # decision Franco 2026-08-13: se distingue "hoja vacia" de "snapshot roto".
        # Antes las dos caian en el mismo mensaje y un mapa_celdas perdido por un
        # timeout del scanner se leia igual que una pestana legitimamente vacia.
        if mapa is None:
            hojas_sin_mapa.append(nombre)
            continue
        if not mapa:
            hojas_vacias.append(nombre)
            continue
        for ref in sorted(mapa.keys(), key=clave_orden):
            celda = mapa[ref] if isinstance(mapa[ref], dict) else {"valor": mapa[ref]}
            formula = primera_clave(celda, CLAVES_FORMULA)
            if any(k in celda for k in CLAVES_MOSTRADO):
                con_valor_mostrado += 1
            valor = valor_de_celda(celda)
            if necesita_escape(formula) or necesita_escape(valor):
                escapadas += 1
            txt_formula = escapar(formatear(formula))
            txt_valor = escapar(valor)
            if txt_formula:
                con_formula += 1
            # El ref tambien se escapa: es la unica de las cuatro columnas que
            # antes viajaba cruda, y el TSV no puede depender de que el scanner
            # nunca emita una clave rara.
            filas.append((escapar(nombre), escapar(ref), txt_formula, txt_valor))

    ruta_tsv_abs = os.path.abspath(ruta_tsv)
    os.makedirs(os.path.dirname(ruta_tsv_abs), exist_ok=True)
    with open(ruta_tsv_abs, "w", encoding="utf-8", newline="\n") as f:
        f.write("\t".join(CABECERA) + "\n")
        for fila in filas:
            f.write("\t".join(fila) + "\n")

    # decision Franco 2026-08-13: la procedencia va en un archivo lateral .meta y no
    # en una linea de comentario del TSV. Un '#' inicial correria el header y
    # romperia las recetas awk que usan NR>1; el TSV leido solo era indistinguible
    # de uno fresco, que es falsa confianza para una sesion futura.
    ruta_meta = ruta_tsv_abs + ".meta"
    formato = ("scanner v0.8.4 o posterior (con valor_mostrado)"
               if con_valor_mostrado else
               "scanner viejo (SIN valor_mostrado: las celdas con formula no traen"
               " su resultado calculado)")
    # Ruta relativa a la raiz del repo cuando el snapshot vive adentro: el .meta se
    # versiona y no puede depender del home de quien lo corrio.
    origen = os.path.abspath(args.ruta_json)
    if origen.startswith(RAIZ + os.sep):
        origen = os.path.relpath(origen, RAIZ)
    meta_lineas = [
        "# Procedencia de celdas.tsv - generado por devtools/generar_tsv_celdas.py",
        "# Archivo GENERADO. No editar a mano: se reescribe en cada regeneracion.",
        "snapshot_origen: " + origen,
        "fecha_exportacion: " + str(arq.get("fecha_exportacion", "(sin dato)")),
        "id_planilla: " + str(arq.get("id_planilla", "(sin dato)")),
        "nombre_planilla: " + str(arq.get("nombre_planilla", "(sin dato)")),
        "cobertura: " + str(arq.get("cobertura", "(sin dato)")),
        "formato_celda: " + formato,
        "filas: " + str(len(filas)),
        "celdas_con_formula: " + str(con_formula),
        "celdas_con_valor_mostrado: " + str(con_valor_mostrado),
        "hojas_volcadas: " + str(len(nombres) - len(hojas_vacias) - len(hojas_sin_mapa)),
        "hojas_vacias: " + (", ".join(hojas_vacias) if hojas_vacias else "(ninguna)"),
        "hojas_sin_nodo_mapa_celdas: " + (", ".join(hojas_sin_mapa) if hojas_sin_mapa else "(ninguna)"),
    ]
    with open(ruta_meta, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(meta_lineas) + "\n")

    print("TSV de celdas generado")
    print("  snapshot        : " + args.ruta_json)
    print("  fecha_exportacion: " + str(arq.get("fecha_exportacion", "(sin dato)")))
    print("  salida          : " + ruta_tsv_abs)
    print("  procedencia     : " + ruta_meta)
    print("Resumen")
    print("  filas escritas (sin contar cabecera): " + str(len(filas)))
    print("  hojas volcadas                     : "
          + str(len(nombres) - len(hojas_vacias) - len(hojas_sin_mapa)))
    print("  celdas con formula                 : " + str(con_formula))
    print("  celdas solo valor                  : " + str(len(filas) - con_formula))
    print("  celdas con valor_mostrado          : " + str(con_valor_mostrado)
          + "  (formato: " + formato + ")")
    print("  celdas con escape (tab/salto/backslash): " + str(escapadas))
    if hojas_vacias:
        print("  hojas vacias (mapa_celdas sin celdas): " + ", ".join(hojas_vacias))
    if hojas_sin_mapa:
        print("  ANOMALIA - hojas SIN nodo mapa_celdas (el snapshot puede estar"
              " incompleto): " + ", ".join(hojas_sin_mapa))
    return 0


if __name__ == "__main__":
    sys.exit(main())
