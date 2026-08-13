#!/usr/bin/env python3
"""
generar_inventario_planilla.py

[CONCEPTO DE NEGOCIO]
Convierte el snapshot TIDETRACK_ARQUITECTURA_ESTRICTA.json (exportado por el
Scanner de Arquitectura desde la planilla de finanzas personales) en
documentacion Markdown legible por humanos y por LLMs: INVENTARIO_CELDAS.md.
Es la pieza que permite que una sesion sepa que hay en cada celda sin abrir la
planilla.

[FUNDAMENTO TEORICO / ADMINISTRATIVO]
El inventario es la capa MECANICA de la documentacion del gemelo digital: se
regenera integra con este script en cada re-escaneo y por eso NO se edita a
mano. La capa SEMANTICA curada (que significa cada hoja, cuales son las celdas
de control, recetas para tareas frecuentes) vive en
MAPA_ARQUITECTURA_PLANILLA.md y se actualiza a mano cuando cambia la logica.
Separar ambas capas evita que la documentacion envejezca en silencio: si el
inventario y el MAPA se contradicen, gana el inventario porque viene de la
planilla viva.

Principio rector de este generador: un inventario que MIENTE es peor que uno
incompleto. Toda afirmacion que no se pueda derivar del JSON con certeza se
emite como incertidumbre declarada, nunca como estimacion presentada como dato.

@see docs/permanente/ARNES_TIDETRACK.md (seccion 4, Fase 2 — Gemelo digital)
@see docs/permanente/MAPA_ARQUITECTURA_PLANILLA.md (capa semantica curada)
@see src/98_DevTools_Scanner.js (productor del JSON de entrada)

Uso:
    python3 devtools/generar_inventario_planilla.py

Lee  : docs/permanente/TIDETRACK_ARQUITECTURA_ESTRICTA.json
Emite: docs/permanente/INVENTARIO_CELDAS.md

decision Franco 2026-07-06: la documentacion de arquitectura de la planilla
debe estar siempre actualizada y ser regenerable de forma mecanica.
decision Franco 2026-08-13: el generador se porta de planilla-pymes a este repo
sin perder ninguna seccion, y se extiende para tolerar los dos formatos de
JSON (scanner viejo sin cobertura / scanner nuevo cobertura total) y las dos
formas de referenciar hojas que conviven en esta planilla.
decision Franco 2026-08-13 (v0.8.4): el bloque de staging de un QUERY se deriva
PARSEANDO la llamada (primer argumento = fuente, clausula SELECT = proyeccion)
y se contrasta contra el ancho declarado de la hoja destino y contra sus
headers. Antes se asumia que todo QUERY proyectaba el rango fuente completo, lo
que produjo una afirmacion falsa sobre Cargas!R5 (12 columnas hasta AC cuando
el SELECT proyecta 7 y la hoja mide 24 columnas). Cuando la proyeccion no se
puede determinar, el documento lo dice; no estima.
decision Franco 2026-08-13 (v0.8.4): la deteccion de referencias a hojas pasa a
clases Unicode. Con clases ASCII, 'Analisis con tilde'! sin comillas se partia
en el acento e inventaba hojas rotas ('lisis'), perdiendo ademas la dependencia
real. La planilla es en espanol: una hoja acentuada nueva es esperable.
"""

import json
import re
import os
from collections import Counter, defaultdict

# Los paths se resuelven contra la ubicacion del script, no contra el cwd:
# el generador tiene que correr igual desde la raiz del repo o desde devtools/.
BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "permanente")
PATH_JSON = os.path.join(BASE, "TIDETRACK_ARQUITECTURA_ESTRICTA.json")
PATH_OUT = os.path.join(BASE, "INVENTARIO_CELDAS.md")

MAX_PATRONES_POR_HOJA = 20
MAX_LARGO_FORMULA = 400

# decision Franco 2026-08-13: en esta planilla conviven referencias a hoja con
# comillas simples ('Plan de Cuentas'!R:T, obligatorias cuando el nombre lleva
# espacios) y sin comillas (Registros!$O$3, validas cuando no las lleva). La
# deteccion cubre ambas. Para no generar falsos positivos:
#   - se vacian primero los literales de texto (una hoja nombrada dentro de un
#     string de QUERY o de un mensaje no es una dependencia real),
#   - el nombre sin comillas exige limite de palabra a izquierda, de modo que
#     la hoja "Registros" NO matchee dentro de "RegistrosViejos",
#   - se excluye el marcador de error #REF! (el "REF" no es una hoja).
# El nombre sin comillas usa clases Unicode ([^\W\d] = letra o guion bajo, no
# digito; \w incluye acentos y ñ) y el lookbehind excluye \w completo, para que
# "Analisis"! y "Diseño"! se detecten enteros en vez de partirse en el acento.
RE_LITERAL_TEXTO = re.compile(r'"(?:[^"]|"")*"')
RE_REF_CITADA = re.compile(r"'((?:[^']|'')+)'!")
RE_REF_SIMPLE = re.compile(r"(?<![\w$.'#!])([^\W\d]\w*)!", re.UNICODE)

# Rango completo (Hoja!COL[fila]:COL[fila]) usado para leer la fuente de un QUERY.
RE_RANGO_COMPLETO = re.compile(
    r"^(?:'((?:[^']|'')+)'|([^\W\d]\w*))!"
    r"\$?([A-Za-z]{1,3})\$?(\d+)?:\$?([A-Za-z]{1,3})\$?(\d+)?$",
    re.UNICODE,
)

# Llamada QUERY( real (no la palabra QUERY dentro de un identificador).
RE_LLAMADA_QUERY = re.compile(r"(?<![\w$.])QUERY\s*\(", re.IGNORECASE | re.UNICODE)

# Clausulas del lenguaje de consulta de Google, para cortar la proyeccion.
RE_CLAUSULA_QUERY = re.compile(
    r"\b(where|group\s+by|pivot|order\s+by|limit|offset|label|format|options|skipping)\b",
    re.IGNORECASE,
)

# Marcador de los tramos de la cadena del QUERY que se construyen por
# concatenacion y por lo tanto no se pueden leer desde el snapshot.
SENTINELA_DINAMICO = "<dinamico>"


def col_a_num(letras):
    n = 0
    for ch in letras:
        n = n * 26 + (ord(ch.upper()) - 64)
    return n


def num_a_col(n):
    letras = ""
    while n > 0:
        letras = chr(65 + (n - 1) % 26) + letras
        n = (n - 1) // 26
    return letras


def parse_ref(ref):
    m = re.match(r"([A-Z]+)(\d+)", ref)
    return (m.group(1), int(m.group(2))) if m else (None, None)


def valor_de(celda):
    """Valor de una celda, tolerante a celdas ausentes o con forma inesperada.

    decision Franco 2026-08-13: el contrato de celda del scanner v0.8.4 agrega
    `valor_mostrado` (lo que se ve en pantalla) y deja `valor` en null cuando la
    celda tiene formula. Este lector degrada limpiamente: usa `valor` si existe
    y cae a `valor_mostrado` si no. Con el snapshot viejo (que no trae el campo)
    el resultado es identico al de antes.
    """
    if not isinstance(celda, dict):
        return ""
    v = celda.get("valor")
    if v is not None:
        return v
    v = celda.get("valor_mostrado")
    return v if v is not None else ""


def formula_de(celda):
    """Formula de una celda, tolerante a celdas ausentes o con forma inesperada."""
    if not isinstance(celda, dict):
        return ""
    return celda.get("formula") or ""


def es_negrita(celda):
    if not isinstance(celda, dict):
        return False
    estilo = celda.get("estilo") or {}
    return str(estilo.get("negrita", "")).lower() == "bold"


RE_SOLO_NUMERICO = re.compile(r"^[\s\d.,:/%$+-]+$")


def texto_de_celda(celda):
    """Texto de una celda para la heuristica de encabezados.

    Usa el valor crudo cuando es string. Si la celda tiene formula (valor null)
    cae a `valor_mostrado`, pero descarta lo que parece un numero formateado:
    con el scanner de cobertura total, cada celda calculada trae su valor
    mostrado y sin este filtro una fila de importes contaria como "texto".
    """
    if not isinstance(celda, dict):
        return ""
    v = celda.get("valor")
    if isinstance(v, str):
        return v
    if v is None:
        vm = celda.get("valor_mostrado")
        if isinstance(vm, str) and vm.strip() and not RE_SOLO_NUMERICO.match(vm):
            return vm
    return ""


def sin_literales(formula):
    """Vacia los literales de texto para que un nombre de hoja citado dentro de
    un string (por ejemplo el SELECT de un QUERY) no cuente como dependencia."""
    return RE_LITERAL_TEXTO.sub('""', formula)


def referencias_a_hojas(formula):
    """Devuelve los nombres de hoja referenciados por la formula, tal cual estan
    escritos, cubriendo la forma citada ('Hoja'!) y la simple (Hoja!)."""
    limpia = sin_literales(formula)
    nombres = []
    for m in RE_REF_CITADA.finditer(limpia):
        nombres.append(m.group(1).replace("''", "'"))
    for m in RE_REF_SIMPLE.finditer(limpia):
        nombres.append(m.group(1))
    return nombres


def construir_indice(nombres):
    """Indice de resolucion por minusculas: Google Sheets resuelve el nombre de
    hoja de una formula sin distinguir mayusculas (TABLERO! apunta a Tablero).
    Si dos hojas solo difieren en la caja, gana la primera y el match exacto
    tiene prioridad (ver resolver_hoja)."""
    indice = {}
    for n in nombres:
        indice.setdefault(n.lower(), n)
    return indice


def resolver_hoja(nombre, indice, exactos=None):
    """decision Franco 2026-08-13: el match exacto manda. Esta planilla tiene
    documentado el caso de dos hojas que conviven difiriendo solo en la caja
    ('Tipos de cambio' vs 'Tipos de Cambio', ver _resolverNombreHoja en
    src/00_Config.js): resolver por minusculas sin preferir el exacto atribuia
    las formulas a la hoja equivocada."""
    if exactos and nombre in exactos:
        return nombre
    return indice.get(nombre.lower())


# ----------------------------------------------------------------------
# Analisis de llamadas QUERY: fuente real + proyeccion real
# ----------------------------------------------------------------------


def _posiciones_en_literal(texto):
    """Marca que posiciones del texto caen dentro de un literal de comillas
    dobles ("" escapa la comilla). Sirve para no confundir la palabra QUERY(
    escrita dentro de un string con una llamada real."""
    dentro = [False] * len(texto)
    i, n = 0, len(texto)
    while i < n:
        if texto[i] == '"':
            j = i + 1
            while j < n:
                if texto[j] == '"':
                    if j + 1 < n and texto[j + 1] == '"':
                        j += 2
                        continue
                    break
                j += 1
            for k in range(i, min(j + 1, n)):
                dentro[k] = True
            i = j + 1
        else:
            i += 1
    return dentro


def llamadas_query(formula):
    """Posiciones del parentesis que abre cada llamada QUERY( de la formula."""
    dentro = _posiciones_en_literal(formula)
    salida = []
    for m in RE_LLAMADA_QUERY.finditer(formula):
        if m.start() < len(dentro) and dentro[m.start()]:
            continue
        salida.append(m.end() - 1)
    return salida


def argumentos_llamada(formula, i_open):
    """Argumentos de la llamada cuyo parentesis de apertura esta en i_open.

    Respeta literales de texto, nombres de hoja entre comillas simples y el
    anidamiento de (), {} y []. El separador de argumentos depende del locale de
    la planilla (';' en es-AR, ',' en en-US): se detecta cual se uso en el nivel
    superior de ESTA llamada, de modo que un decimal con coma (0,5) no parta un
    argumento en dos.
    """
    n = len(formula)
    i = i_open + 1
    prof = 1
    seps = []
    i_cierre = None
    while i < n:
        ch = formula[i]
        if ch == '"':
            i += 1
            while i < n:
                if formula[i] == '"':
                    if i + 1 < n and formula[i + 1] == '"':
                        i += 2
                        continue
                    break
                i += 1
        elif ch == "'":
            i += 1
            while i < n:
                if formula[i] == "'":
                    if i + 1 < n and formula[i + 1] == "'":
                        i += 2
                        continue
                    break
                i += 1
        elif ch in "({[":
            prof += 1
        elif ch in ")}]":
            prof -= 1
            if prof == 0:
                i_cierre = i
                break
        elif prof == 1 and ch in ";,":
            seps.append((i, ch))
        i += 1
    if i_cierre is None:
        return None
    sep = ";" if any(c == ";" for _, c in seps) else ","
    cortes = [p for p, c in seps if c == sep]
    args = []
    ini = i_open + 1
    for p in cortes:
        args.append(formula[ini:p])
        ini = p + 1
    args.append(formula[ini:i_cierre])
    return [a.strip() for a in args]


def fuente_del_argumento(arg, hojas, indice):
    """Lee el PRIMER argumento de un QUERY y devuelve el rango fuente si (y solo
    si) es un unico rango de una hoja existente, opcionalmente envuelto en {}.
    Devuelve (fuente, motivo): fuente es (hoja, col_ini, fila_ini|None, col_fin,
    en_llaves) o None, y motivo explica por que no se pudo determinar."""
    txt = " ".join(arg.split())
    en_llaves = False
    if txt.startswith("{") and txt.endswith("}"):
        txt = txt[1:-1].strip()
        en_llaves = True
    m = RE_RANGO_COMPLETO.match(txt)
    if not m:
        crudo_txt = " ".join(arg.split())
        recorte = crudo_txt[:80] + ("..." if len(crudo_txt) > 80 else "")
        return None, (f"el primer argumento del QUERY no es un rango simple de una hoja "
                      f"(es `{recorte}`)")
    crudo = m.group(1).replace("''", "'") if m.group(1) else m.group(2)
    canon = resolver_hoja(crudo, indice, hojas)
    if not canon or canon not in hojas:
        return None, (f"el primer argumento del QUERY apunta a la hoja `{crudo}`, "
                      f"que no figura en este snapshot")
    fila_ini = int(m.group(4)) if m.group(4) else None
    fila_fin = int(m.group(6)) if m.group(6) else None
    return (canon, m.group(3).upper(), fila_ini, m.group(5).upper(), en_llaves, fila_fin), None


def cadena_del_query(arg):
    """Reconstruye la cadena de consulta del segundo argumento.

    Los tramos que se arman por concatenacion (& variable &) no estan en el
    snapshot: se reemplazan por un sentinela en vez de ignorarlos, para que el
    analisis sepa que hay texto que no puede leer. Devuelve (texto, dinamico).
    """
    partes = []
    literales = 0
    pos = 0
    dinamico = False
    for m in RE_LITERAL_TEXTO.finditer(arg):
        hueco = arg[pos:m.start()]
        if hueco.replace("&", " ").strip():
            partes.append(SENTINELA_DINAMICO)
            dinamico = True
        partes.append(m.group(0)[1:-1].replace('""', '"'))
        literales += 1
        pos = m.end()
    resto = arg[pos:]
    if resto.replace("&", " ").strip():
        partes.append(SENTINELA_DINAMICO)
        dinamico = True
    if literales == 0:
        return None, True
    return "".join(partes), dinamico


def sentinela_fuera_de_comillas(texto):
    """True si algun tramo dinamico cae FUERA de un literal entre comillas
    simples de la consulta. Un valor dinamico dentro de comillas (date '<...>')
    es un dato y no puede cambiar las clausulas; uno fuera, si."""
    dentro = False
    i = 0
    while i < len(texto):
        if texto[i] == "'":
            dentro = not dentro
            i += 1
            continue
        if texto.startswith(SENTINELA_DINAMICO, i):
            if not dentro:
                return True
            i += len(SENTINELA_DINAMICO)
            continue
        i += 1
    return False


def identificadores_del_select(texto_query):
    """Identificadores proyectados por la clausula SELECT.

    Devuelve (lista, motivo). La lista es ["*"] para SELECT *, o una lista de
    tuplas ("col", n) / ("letra", "B"). Si no se puede determinar con certeza,
    devuelve (None, motivo) y el inventario declara la incertidumbre.
    """
    m = re.search(r"\bselect\b", texto_query, re.IGNORECASE)
    if not m:
        # Sin clausula SELECT, QUERY devuelve todas las columnas de la fuente.
        return ["*"], None
    resto = texto_query[m.end():]
    fin = RE_CLAUSULA_QUERY.search(resto)
    seleccion = (resto[:fin.start()] if fin else resto).strip()
    if SENTINELA_DINAMICO in seleccion:
        return None, "la clausula SELECT se construye por concatenacion y no esta completa en el snapshot"
    if seleccion == "*":
        return ["*"], None
    if not seleccion:
        return None, "la clausula SELECT esta vacia en el snapshot"
    ident = []
    for crudo in seleccion.split(","):
        item = crudo.strip()
        if not item:
            continue
        mm = re.fullmatch(r"[Cc]ol(\d+)", item)
        if mm:
            ident.append(("col", int(mm.group(1))))
            continue
        mm = re.fullmatch(r"\$?([A-Za-z]{1,3})", item)
        if mm:
            ident.append(("letra", mm.group(1).upper()))
            continue
        return None, f"el SELECT proyecta `{item}`, que no es una columna simple (agregacion o expresion)"
    if not ident:
        return None, "no se pudo leer ninguna columna en la clausula SELECT"
    return ident, None


def analizar_query(formula, hojas, indice):
    """Analiza la primera llamada QUERY de la formula cuyo primer argumento sea
    un rango de una hoja existente. Devuelve un dict con lo que se pudo
    establecer y el motivo de lo que no."""
    posiciones = llamadas_query(formula)
    if not posiciones:
        return {"fuente": None, "motivo": "no se localizo una llamada QUERY parseable"}

    primer_motivo = None
    for i_open in posiciones:
        args = argumentos_llamada(formula, i_open)
        if not args:
            continue
        fuente, motivo = fuente_del_argumento(args[0], hojas, indice)
        if fuente is None:
            if primer_motivo is None:
                primer_motivo = motivo
            continue

        hoja_src, c_ini, fila_ini, c_fin, en_llaves, fila_fin = fuente
        # el ancla de fila se conserva en el texto: en esta planilla la fila de
        # arranque de Registros es justamente el dato en disputa (CLAUDE.md, "Disputa de filas").
        ref_fuente = (f"{hoja_src}!{c_ini}{fila_ini if fila_ini else ''}"
                      f":{c_fin}{fila_fin if fila_fin else ''}")
        ancho_fuente = col_a_num(c_fin) - col_a_num(c_ini) + 1
        res = {
            "fuente": fuente,
            "ref_fuente": ref_fuente,
            "ancho_fuente": ancho_fuente,
            "llamadas": len(posiciones),
            "columnas": None,
            "motivo": None,
            "limite": None,
            "dinamico": False,
            "proyeccion_txt": None,
        }
        if ancho_fuente <= 0:
            res["motivo"] = "el rango fuente tiene ancho invalido"
            return res

        arg_consulta = args[1] if len(args) > 1 else ""
        texto_query, dinamico = cadena_del_query(arg_consulta)
        res["dinamico"] = dinamico
        if texto_query is None:
            res["motivo"] = "la cadena de consulta no es un literal en el snapshot (viene de otra celda o expresion)"
            return res
        if sentinela_fuera_de_comillas(texto_query):
            res["motivo"] = "la consulta se arma por concatenacion fuera de los literales de datos: las clausulas no se pueden leer completas"
            return res
        if re.search(r"\bpivot\b", texto_query, re.IGNORECASE):
            res["motivo"] = "la consulta usa PIVOT: el ancho del resultado depende de los datos"
            return res

        ident, motivo = identificadores_del_select(texto_query)
        if ident is None:
            res["motivo"] = motivo
            return res

        num_ini, num_fin = col_a_num(c_ini), col_a_num(c_fin)
        columnas = []
        if ident == ["*"]:
            columnas = [num_a_col(n) for n in range(num_ini, num_fin + 1)]
            res["proyeccion_txt"] = "SELECT * (todas las columnas de la fuente)"
        else:
            etiquetas = []
            for tipo, valor in ident:
                if tipo == "col":
                    n = num_ini + valor - 1
                    if n > num_fin:
                        res["motivo"] = (f"el SELECT pide Col{valor} pero la fuente solo tiene "
                                         f"{ancho_fuente} columnas")
                        return res
                    columnas.append(num_a_col(n))
                    etiquetas.append(f"Col{valor}")
                else:
                    if en_llaves:
                        res["motivo"] = ("el SELECT usa letras de columna sobre una fuente entre llaves "
                                         "(deberia usar ColN): no se puede mapear")
                        return res
                    n = col_a_num(valor)
                    if n < num_ini or n > num_fin:
                        res["motivo"] = (f"el SELECT pide la columna {valor}, fuera del rango fuente "
                                         f"{c_ini}:{c_fin}")
                        return res
                    columnas.append(valor)
                    etiquetas.append(valor)
            res["proyeccion_txt"] = "SELECT " + ", ".join(etiquetas)
        res["columnas"] = columnas

        m_lim = re.search(r"\blimit\s+(\d+)\b", texto_query, re.IGNORECASE)
        if m_lim:
            res["limite"] = int(m_lim.group(1))
        return res

    return {"fuente": None,
            "motivo": primer_motivo or "no se pudieron leer los argumentos del QUERY"}


def lineas_de_staging(ref, formula, hoja_destino, hojas, indice):
    """Lineas markdown que describen el bloque de staging de un QUERY.

    decision Franco 2026-08-13: el bloque se afirma solo si (a) la fuente es el
    PRIMER argumento del QUERY, (b) la proyeccion del SELECT se pudo leer entera
    y (c) el ancho resultante entra en la hoja destino. Ademas se contrasta
    contra los headers de la fila anterior al ancla. Si algo no cierra, se dice.
    """
    an = analizar_query(formula, hojas, indice)
    if an.get("fuente") is None:
        return [f"- Staging: no estimado — {an.get('motivo')}."]

    hoja_src, c_ini, fila_ini, c_fin, _, _ = an["fuente"]
    lineas = []
    detalle_fila = (f", headers leidos de la fila {fila_ini} de la fuente"
                    if fila_ini else ", sin fila de anclaje (rango de columna entera)")
    extra = ""
    if an.get("llamadas", 1) > 1:
        extra = f" [la formula tiene {an['llamadas']} llamadas QUERY; se analiza la primera con fuente en otra hoja]"
    lineas.append(f"- Fuente del QUERY (primer argumento): `{an['ref_fuente']}` "
                  f"({an['ancho_fuente']} columnas{detalle_fila}).{extra}")

    if not an.get("columnas"):
        lineas.append(f"- Staging: NO DETERMINABLE — {an.get('motivo')}. "
                      f"Verificar el bloque en la planilla antes de usarlo.")
        return lineas

    columnas = an["columnas"]
    ancho = len(columnas)
    col_ancla, fila_ancla = parse_ref(ref)
    if not col_ancla:
        lineas.append("- Staging: NO DETERMINABLE — no se pudo leer la celda ancla.")
        return lineas

    num_ancla = col_a_num(col_ancla)
    col_fin_stg = num_a_col(num_ancla + ancho - 1)
    meta_dest = (hojas.get(hoja_destino) or {}).get("meta") or {}
    ancho_dest = meta_dest.get("columnas_totales")
    if isinstance(ancho_dest, int) and num_ancla + ancho - 1 > ancho_dest:
        lineas.append(
            f"- Staging: NO DETERMINABLE — el bloque derivado (`{ref}:{col_fin_stg}`, {ancho} columnas) "
            f"excede el ancho declarado de la hoja ({ancho_dest} columnas). "
            f"Hay una inconsistencia entre la formula y el snapshot: no se afirma el bloque.")
        return lineas

    proy = an.get("proyeccion_txt") or ""
    lim = f"; LIMIT {an['limite']} filas" if an.get("limite") else ""
    lineas.append(f"- Proyeccion: {proy} — {ancho} columnas{lim}.")
    if an.get("dinamico"):
        lineas.append("- Nota: la cadena de la consulta se arma por concatenacion. Los tramos "
                      "dinamicos caen dentro de literales de datos (entre comillas simples), "
                      "asi que no pueden alterar las clausulas ni la proyeccion.")
    lineas.append(f"- Staging: `{ref}:{col_fin_stg}` (espeja `{an['ref_fuente']}`, "
                  f"columnas proyectadas {', '.join(columnas)}).")

    celdas_src = (hojas.get(hoja_src) or {}).get("mapa_celdas") or {}
    celdas_dest = (hojas.get(hoja_destino) or {}).get("mapa_celdas") or {}
    pares = []
    coinciden = 0
    discrepan = []
    sin_dato = 0
    for i, col_src in enumerate(columnas):
        col_stg = num_a_col(num_ancla + i)
        h_src = ""
        if fila_ini:
            h_src = str(valor_de(celdas_src.get(f"{col_src}{fila_ini}"))).strip()
        pares.append(f"{col_src}({h_src})->{col_stg}" if h_src else f"{col_src}->{col_stg}")
        h_dest = ""
        if fila_ancla and fila_ancla > 1:
            h_dest = str(valor_de(celdas_dest.get(f"{col_stg}{fila_ancla - 1}"))).strip()
        if h_src and h_dest:
            if h_src.casefold() == h_dest.casefold():
                coinciden += 1
            else:
                discrepan.append((col_src, h_src, col_stg, h_dest))
        else:
            sin_dato += 1
    lineas.append(f"- Mapeo columnas: {', '.join(pares)}")

    if fila_ancla and fila_ancla > 1:
        total_comparados = coinciden + len(discrepan)
        if discrepan:
            detalle = "; ".join(f"{cs}='{hs}' vs destino {cd}='{hd}'" for cs, hs, cd, hd in discrepan)
            lineas.append(f"- ATENCION: los headers de la fila {fila_ancla - 1} de `{hoja_destino}` NO "
                          f"confirman el mapeo ({len(discrepan)} de {total_comparados} discrepan: {detalle}). "
                          f"El bloque queda SIN confirmar.")
        elif total_comparados:
            resto = f"; {sin_dato} sin header comparable" if sin_dato else ""
            lineas.append(f"- Verificacion: los headers de la fila {fila_ancla - 1} de `{hoja_destino}` "
                          f"confirman {coinciden}/{total_comparados} columnas del mapeo{resto}.")
        else:
            lineas.append(f"- Verificacion: la fila {fila_ancla - 1} de `{hoja_destino}` no tiene headers "
                          f"en el snapshot, asi que el mapeo no se pudo contrastar.")
    return lineas


def main():
    with open(PATH_JSON, encoding="utf-8") as f:
        arq = json.load(f)

    hojas = arq.get("hojas") or {}
    if not hojas:
        raise SystemExit(f"ERROR: {PATH_JSON} no tiene la clave 'hojas' o esta vacia.")

    nombres = list(hojas.keys())
    indice = construir_indice(nombres)
    out = []
    w = out.append

    w("# Inventario de celdas de la planilla de finanzas personales")
    w("")
    w("> Documento AUTO-GENERADO por `devtools/generar_inventario_planilla.py`")
    w("> a partir de `docs/permanente/TIDETRACK_ARQUITECTURA_ESTRICTA.json`.")
    w("> NO editar a mano: regenerar tras cada re-escaneo. La capa semantica")
    w("> curada vive en `docs/permanente/MAPA_ARQUITECTURA_PLANILLA.md`.")
    w("")
    w(f"- Planilla: **{arq.get('nombre_planilla', '?')}** (`{arq.get('id_planilla', '?')}`)")
    w(f"- Snapshot: {arq.get('fecha_exportacion', '?')} — cobertura: {arq.get('cobertura', '?')}")
    if not arq.get("cobertura"):
        w("")
        w("> ADVERTENCIA: el JSON de origen no declara `cobertura`. Corresponde al")
        w("> scanner viejo (solo formulas y las primeras filas de cada hoja), asi")
        w("> que las bases de datos figuran casi vacias. Regenerar este inventario")
        w("> despues del primer escaneo con el scanner de cobertura total.")
    w("")
    w("> ALCANCE: todo lo que este documento afirma sale del snapshot de la fecha")
    w("> indicada arriba. Hojas creadas o renombradas despues de esa fecha no")
    w("> figuran aca. Las dependencias se leen de las formulas: una referencia")
    w("> construida en runtime (INDIRECT, IMPORTRANGE con URL armada) no es")
    w("> detectable, asi que la matriz de la seccion 2 es un piso, no un techo.")
    w("")

    # ------------------------------------------------------------------
    # 1. Resumen global de hojas
    # ------------------------------------------------------------------
    w("## 1. Hojas de la planilla")
    w("")
    w("| Hoja | Filas | Cols | Oculta | Congeladas (f/c) | Celdas con dato | Formulas | Reglas cond. |")
    w("|---|---|---|---|---|---|---|---|")
    for nombre, h in hojas.items():
        m = h.get("meta") or {}
        celdas = h.get("mapa_celdas") or {}
        nform = sum(1 for c in celdas.values() if formula_de(c))
        w(f"| {nombre} | {m.get('filas_totales', '?')} | {m.get('columnas_totales', '?')} | "
          f"{'si' if m.get('es_oculta') else 'no'} | "
          f"{m.get('filas_congeladas', '?')}/{m.get('columnas_congeladas', '?')} | "
          f"{m.get('celdas_con_dato', len(celdas))} | {nform} | "
          f"{m.get('reglas_condicionales_qty', '?')} |")
    w("")

    # ------------------------------------------------------------------
    # 2. Matriz de dependencias entre hojas
    # ------------------------------------------------------------------
    w("## 2. Dependencias entre hojas (formulas que leen otra hoja)")
    w("")
    dep = defaultdict(Counter)
    rotas = []          # referencias a hojas que no figuran en el snapshot
    distinta_caja = []  # referencias que resuelven pero con otra caja de letras
    for nombre, h in hojas.items():
        for ref, c in (h.get("mapa_celdas") or {}).items():
            f = formula_de(c)
            if not f:
                continue
            # una formula suma como maximo 1 a cada hoja fuente, aunque la
            # referencie varias veces: la matriz cuenta formulas, no menciones.
            vistas = set()
            rotas_celda = set()
            caja_celda = set()
            for crudo in referencias_a_hojas(f):
                canon = resolver_hoja(crudo, indice, hojas)
                if canon is None:
                    # dedup por celda: dos menciones a la misma hoja rota en una
                    # misma formula son UNA formula rota, no dos.
                    if crudo not in rotas_celda:
                        rotas_celda.add(crudo)
                        rotas.append((nombre, ref, crudo))
                    continue
                if crudo != canon and (crudo, canon) not in caja_celda:
                    caja_celda.add((crudo, canon))
                    distinta_caja.append((nombre, ref, crudo, canon))
                if canon == nombre or canon in vistas:
                    continue
                vistas.add(canon)
                dep[nombre][canon] += 1
    w("| Hoja que lee | Hojas fuente (cantidad de formulas) |")
    w("|---|---|")
    for nombre in nombres:
        if nombre in dep:
            fuentes = ", ".join(f"{k} ({v})" for k, v in dep[nombre].most_common())
            w(f"| {nombre} | {fuentes} |")
    w("")
    if rotas:
        w("**Referencias a hojas que NO figuran en el snapshot (posibles rotas):**")
        w("")
        conteo = Counter((hoja, destino) for hoja, _, destino in rotas)
        primera = {}
        for hoja, ref, destino in rotas:
            primera.setdefault((hoja, destino), ref)
        for (hoja, destino), cnt in conteo.most_common():
            w(f"- `{hoja}` referencia la hoja `{destino}`, que no figura en este snapshot "
              f"({cnt} formulas; primera: `{hoja}!{primera[(hoja, destino)]}`).")
        w("")
    if distinta_caja:
        w("**Referencias con el nombre de hoja escrito en otra caja de letras** "
          "(Google Sheets las resuelve igual, pero el nombre real es el de la derecha):")
        w("")
        conteo = Counter((hoja, crudo, canon) for hoja, _, crudo, canon in distinta_caja)
        for (hoja, crudo, canon), cnt in conteo.most_common():
            w(f"- `{hoja}`: `{crudo}!` -> hoja real `{canon}` ({cnt} formulas).")
        w("")

    # ------------------------------------------------------------------
    # 3. Detalle por hoja
    # ------------------------------------------------------------------
    w("## 3. Detalle por hoja")
    w("")

    for nombre, h in hojas.items():
        celdas = h.get("mapa_celdas") or {}
        m = h.get("meta") or {}
        w(f"### {nombre}")
        w("")
        estado = "OCULTA" if m.get("es_oculta") else "visible"
        w(f"- Dimensiones: {m.get('filas_totales', '?')} filas x "
          f"{m.get('columnas_totales', '?')} columnas ({estado}). "
          f"Celdas con dato: {m.get('celdas_con_dato', len(celdas))}.")
        w("")

        # -- Filas 1-10 con 3+ celdas de texto. El formato desambigua encabezado
        # de dato: en esta planilla los headers van en negrita y los datos no.
        filas_texto = defaultdict(list)
        negritas = Counter()
        for ref, c in celdas.items():
            col, fila = parse_ref(ref)
            v = texto_de_celda(c)
            if fila and fila <= 10 and isinstance(v, str) and v.strip():
                filas_texto[fila].append((col_a_num(col), col, v.strip()))
                if es_negrita(c):
                    negritas[fila] += 1
        filas_header = [f for f, items in sorted(filas_texto.items()) if len(items) >= 3]
        if filas_header:
            # El conteo de negritas es una PISTA, no un criterio: hay headers reales sin
            # negrita ('CARGAS (Forest.)' fila 4) y filas de datos con negritas
            # (DATA-ENTRY filas 4-5). Se informa el hecho verificable y no se afirma la causal.
            w("**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en "
              "negrita, como pista para distinguir un header de una fila de datos; NO es un "
              "criterio fiable: hay headers sin negrita y filas de datos con negritas):")
            w("")
            for fila in filas_header:
                items = sorted(filas_texto[fila])
                linea = " | ".join(f"{col}={val}" for _, col, val in items)
                if len(linea) > 500:
                    linea = linea[:500] + " (...)"
                w(f"- Fila {fila} ({len(items)} celdas de texto, {negritas[fila]} en negrita): {linea}")
            w("")

        # -- QUERYs completas con el bloque de staging derivado de la llamada
        queries = []
        for ref, c in sorted(celdas.items(), key=lambda kv: (parse_ref(kv[0])[1] or 0, kv[0])):
            f = formula_de(c)
            if "QUERY(" in f.upper():
                queries.append((ref, f))
        if queries:
            w("**Llamadas QUERY (staging de datos):**")
            w("")
            for ref, f in queries:
                w(f"- `{ref}`:")
                w("  ```")
                w("  " + f.replace("\n", " ")[:MAX_LARGO_FORMULA])
                w("  ```")
                for linea in lineas_de_staging(ref, f, nombre, hojas, indice):
                    w("  " + linea)
            w("")

        # -- Patrones de formulas (dedup por estructura)
        pats = Counter()
        ejemplo = {}
        refs_por_pat = defaultdict(list)
        for ref, c in celdas.items():
            f = formula_de(c)
            if not f:
                continue
            pat = re.sub(r"\d+", "#", f.replace("\n", " "))
            pats[pat] += 1
            ejemplo.setdefault(pat, (ref, f.replace("\n", " ")))
            if len(refs_por_pat[pat]) < 8:
                refs_por_pat[pat].append(ref)
        if pats:
            w(f"**Patrones de formulas ({sum(pats.values())} formulas, "
              f"{len(pats)} patrones unicos; top {MAX_PATRONES_POR_HOJA}):**")
            w("")
            for pat, cnt in pats.most_common(MAX_PATRONES_POR_HOJA):
                ref, f = ejemplo[pat]
                celdas_txt = ", ".join(refs_por_pat[pat])
                if cnt > len(refs_por_pat[pat]):
                    celdas_txt += ", ..."
                w(f"- **{cnt}x** en [{celdas_txt}] — ejemplo `{ref}`:")
                w("  ```")
                w("  " + f[:MAX_LARGO_FORMULA])
                w("  ```")
            w("")

    with open(PATH_OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")

    print(f"OK: {PATH_OUT} generado ({len(out)} lineas).")


if __name__ == "__main__":
    main()
