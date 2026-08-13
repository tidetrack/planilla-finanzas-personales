#!/usr/bin/env python3
"""
diff_snapshots.py

[CONCEPTO DE NEGOCIO]
Compara dos snapshots del gemelo digital (TIDETRACK_ARQUITECTURA_ESTRICTA.json)
celda por celda y reporta que cambio en la planilla entre uno y otro: hojas
agregadas, eliminadas o renombradas, y por hoja las celdas AGREGADAS,
ELIMINADAS y MODIFICADAS, separando si lo que cambio fue la FORMULA o solo el
valor. Es la prueba de NO-DANO que se corre despues de cualquier cambio manual,
migracion o deploy que toque la planilla: re-escanear y diffear contra el
snapshot previo.

[FUNDAMENTO TEORICO / ADMINISTRATIVO]
El criterio de exito del arnes no es "quedo bien" sino, literal: "cero formulas
modificadas fuera de lo esperado Y las celdas que desaparecieron son exactamente
las esperadas, sin resto". Son DOS condiciones y las dos pesan en el veredicto:
una formula pisada es logica destruida, y una celda que desaparece es dato
destruido -- en el ledger de Registros, que es casi todo dato sin formula, la
segunda es la unica que atrapa una migracion que borro filas. Un valor que
cambia, en cambio, es ruido esperable: los valores se mueven solos con cada
carga y con cada recalculo de tipos de cambio.

@see docs/permanente/ARNES_TIDETRACK.md (seccion 4 - Fase 2, punto 5)
@see docs/permanente/ARNES_TIDETRACK.md (seccion 9 - verificacion transversal)

Uso:
    python3 devtools/diff_snapshots.py VIEJO.json NUEVO.json
    python3 devtools/diff_snapshots.py VIEJO.json NUEVO.json --markdown reporte.md
    python3 devtools/diff_snapshots.py VIEJO.json NUEVO.json --estricto
    python3 devtools/diff_snapshots.py VIEJO.json NUEVO.json --max-detalle 0

Exit codes (para usarlo como guard):
    0 = el cambio cumple el criterio del arnes: cero formulas en riesgo, cero
        celdas desaparecidas, cero celdas que pasaron a mostrar error y cero
        hojas renombradas. Los cambios de valor y las celdas nuevas sin logica
        NO bloquean.
    1 = no lo cumple -> requiere confirmacion humana una por una
        (con --estricto tambien cuentan las formulas nuevas)
    2 = error de uso (archivo inexistente, JSON invalido, estructura inesperada)

Contrato de celda que se asume (v0.8.4 del scanner), tolerando el formato viejo:
    valor          -> valor crudo si NO hay formula, null si la hay
    formula        -> string o null
    valor_mostrado -> texto tal como se ve en pantalla; unico lugar donde viven
                      los errores de runtime (#REF!, #N/A, #DIV/0!). El snapshot
                      de marzo 2026 NO lo trae y el diff degrada a 'valor'.

Limitaciones conocidas (heredadas del scanner):
    - No compara estilos: el snapshot los trae, pero un cambio de color no es
      un cambio de logica y ensuciaria la senal. Se ignoran a proposito.
    - No compara el nodo meta (es_oculta, filas/columnas congeladas, reglas de
      formato condicional) ni las validaciones de datos. Por eso el veredicto
      sin cambios dice "identicos CELDA POR CELDA" y no "identicos".

decision Franco 2026-08-13: el guard falla ante formulas modificadas, formulas
eliminadas Y ante cualquier celda que desaparezca, tenga formula o no. Borrar
una formula es tan destructivo como pisarla, y borrar una fila del ledger es
tan destructivo como borrar una formula: el criterio del arnes es "sin resto".
Contar solo las desapariciones con formula era la cicatriz 5 del arnes (un
guard que reporta exito siendo un no-op) sobre la hoja mas importante.

decision Franco 2026-08-13: el criterio del veredicto vive en UNA sola funcion
(evaluar) y los dos renders -- terminal y markdown -- consumen su salida y los
mismos textos (titular_critico, veredicto_texto, items_criticos). Antes cada
render decidia por su cuenta y el markdown llegaba a certificar "criterio del
arnes cumplido" con una hoja entera destruida. Si vuelven a existir dos
criterios, vuelve a existir el exito falso.

decision Franco 2026-08-13: las hojas se emparejan por nombre y, las que quedan
sueltas, por gid (identidad estable de la pestana que emite el scanner v0.8.4).
Sin eso un renombre se reportaba como una hoja entera destruida mas una hoja
entera nueva -- un falso positivo de 116 celdas que entrena al operador a
ignorar el guard. El renombre igual bloquea (exit 1): rompe todo codigo que
busque la hoja por nombre, que es la razon de ser del resolver de alias de
00_Config.js.

decision Franco 2026-08-13: la seccion critica NO trunca nada (ni por longitud
ni por cantidad de items) y ademas muestra el fragmento que cambio con su
posicion. El truncado a 200/120 caracteres imprimia 'antes' y 'ahora' identicos
ante un sabotaje real en las formulas largas de Tablero/CALCU/ANUAL, que son
justamente las de mayor valor. --max-detalle solo afecta a las secciones
informativas.
"""

import argparse
import json
import os
import re
import sys

# Claves toleradas del snapshot: el scanner de cobertura total (Fase 2 punto 1)
# puede renombrar campos y el diff no debe romperse por eso.
CLAVES_MAPA = ("mapa_celdas", "celdas")
CLAVES_FORMULA = ("formula", "formula_a1")
# decision Franco 2026-08-13: el valor mostrado manda sobre el crudo. En una celda
# con formula el crudo es null por contrato, asi que sin esta preferencia el diff
# quedaba ciego al resultado calculado (y a un #REF! recien aparecido). Si el campo
# no esta -- snapshot viejo -- se degrada a 'valor' sin romperse.
CLAVES_MOSTRADO = ("valor_mostrado", "valor_formateado", "formattedValue")
CLAVES_VALOR = ("valor", "value")

RE_REF = re.compile(r"^\$?([A-Za-z]+)\$?(\d+)$")

# Contexto (en caracteres) alrededor del tramo que cambio dentro de una formula.
CONTEXTO_FRAGMENTO = 48

# Errores de runtime tal como los muestra la planilla. Heuristica de texto, no de
# tipo: el scanner no trae errorValue, solo la cadena mostrada. El patron pide que
# empiece con '#' y termine en '!' o '?' para no confundir un color hexadecimal
# ('#a9bca1', que la hoja Inicio usa a montones) con un error.
LARGO_MAX_ERROR = 24


def es_error(texto):
    """True si el texto mostrado por la celda es un error de calculo."""
    txt = texto.strip()
    if not txt.startswith("#") or len(txt) > LARGO_MAX_ERROR:
        return False
    return txt.endswith("!") or txt.endswith("?") or txt == "#N/A"

# decision Franco 2026-08-13: este script NO importa helpers de
# generar_tsv_celdas.py. Son dos herramientas independientes que se corren
# desde cualquier CWD; duplicar veinte lineas de normalizacion sale mas barato
# que un import roto en medio de una verificacion de no-dano.


def col_a_num(letras):
    n = 0
    for ch in letras:
        n = n * 26 + (ord(ch.upper()) - 64)
    return n


def clave_orden(ref):
    """Orden estable por columna y fila numericas (A9 antes que A10)."""
    m = RE_REF.match(ref)
    if not m:
        return (10**9, 10**9, ref)
    return (col_a_num(m.group(1)), int(m.group(2)), "")


def formatear(valor):
    """Normaliza un valor de celda a texto, para comparar y para mostrar."""
    if valor is None:
        return ""
    if isinstance(valor, bool):
        return "TRUE" if valor else "FALSE"
    if isinstance(valor, float):
        return str(int(valor)) if valor.is_integer() else repr(valor)
    if isinstance(valor, (int, str)):
        return str(valor)
    return json.dumps(valor, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def una_linea(texto, limite=0, colapsar=False):
    """Deja el texto en una sola linea para que el reporte sea grepeable.

    limite=0 no trunca (es el default: la seccion critica no puede truncar).
    colapsar=False conserva las corridas de espacios, para que un cambio de
    indentacion dentro de una formula siga siendo visible.
    """
    txt = texto.replace("\\", "\\\\").replace("\t", "\\t")
    txt = txt.replace("\r\n", "\\n").replace("\n", "\\n").replace("\r", "\\n")
    if colapsar:
        txt = re.sub(r"\s{2,}", " ", txt)
    if limite and len(txt) > limite:
        txt = txt[:limite] + " [...]"
    return txt if txt else "(vacio)"


def fragmento_cambiado(antes, ahora, contexto=CONTEXTO_FRAGMENTO):
    """Aisla el tramo que difiere entre dos textos.

    Devuelve (posicion_1indexada, fragmento_antes, fragmento_ahora) o None si
    son iguales. Sirve para que una formula de 1200 caracteres muestre EN QUE
    cambio y no dos parrafos que a simple vista parecen el mismo.
    """
    if antes == ahora:
        return None
    n = min(len(antes), len(ahora))
    i = 0
    while i < n and antes[i] == ahora[i]:
        i += 1
    j = 0
    while j < n - i and antes[len(antes) - 1 - j] == ahora[len(ahora) - 1 - j]:
        j += 1
    ini = max(0, i - contexto)
    fin_a = min(len(antes), len(antes) - j + contexto)
    fin_b = min(len(ahora), len(ahora) - j + contexto)
    frag_a = ("[...]" if ini > 0 else "") + antes[ini:fin_a] + ("[...]" if fin_a < len(antes) else "")
    frag_b = ("[...]" if ini > 0 else "") + ahora[ini:fin_b] + ("[...]" if fin_b < len(ahora) else "")
    return i + 1, frag_a, frag_b


def primera_clave(celda, claves):
    for k in claves:
        if k in celda:
            return celda[k]
    return None


def valor_de_celda(celda):
    """Texto del valor de una celda: el mostrado si aporta, si no el crudo.

    Un valor_mostrado vacio no pisa a un valor crudo con contenido (una celda
    puede estar oculta por formato ';;;' y seguir teniendo dato).
    """
    mostrado = formatear(primera_clave(celda, CLAVES_MOSTRADO))
    if mostrado:
        return mostrado
    return formatear(primera_clave(celda, CLAVES_VALOR))


def mapa_de_hoja(hoja):
    for k in CLAVES_MAPA:
        if isinstance(hoja, dict) and isinstance(hoja.get(k), dict):
            return hoja[k]
    return {}


def gid_de_hoja(hoja):
    """gid de la pestana: identidad estable ante renombres (scanner v0.8.4)."""
    if not isinstance(hoja, dict):
        return None
    meta = hoja.get("meta")
    if isinstance(meta, dict) and isinstance(meta.get("gid"), int):
        return meta["gid"]
    return None


def cargar(ruta):
    """Devuelve (meta, {hoja: {'gid': int|None, 'celdas': {ref: (formula, valor)}}})."""
    if not os.path.isfile(ruta):
        raise SystemExit("ERROR: no existe el snapshot " + ruta)
    try:
        with open(ruta, encoding="utf-8") as f:
            arq = json.load(f)
    except (ValueError, OSError) as e:
        raise SystemExit("ERROR: no se pudo leer " + ruta + ": " + str(e))
    if not isinstance(arq.get("hojas"), dict):
        raise SystemExit("ERROR: " + ruta + " no tiene el nodo 'hojas'")

    hojas = {}
    con_mostrado = False
    for nombre, hoja in arq["hojas"].items():
        celdas = {}
        for ref, celda in mapa_de_hoja(hoja).items():
            if not isinstance(celda, dict):
                celda = {"valor": celda}
            if not con_mostrado and any(k in celda for k in CLAVES_MOSTRADO):
                con_mostrado = True
            celdas[ref] = (
                formatear(primera_clave(celda, CLAVES_FORMULA)),
                valor_de_celda(celda),
            )
        hojas[nombre] = {"gid": gid_de_hoja(hoja), "celdas": celdas}
    meta = {
        "ruta": ruta,
        "fecha": arq.get("fecha_exportacion", "(sin dato)"),
        "id_planilla": arq.get("id_planilla", "(sin dato)"),
        "con_valor_mostrado": con_mostrado,
    }
    return meta, hojas


def _detalle_hoja(celdas):
    """(cantidad de celdas, formulas, [(ref, formula)] de las que tienen formula)."""
    con_formula = [(ref, f) for ref, (f, _) in celdas.items() if f]
    con_formula.sort(key=lambda x: clave_orden(x[0]))
    return len(celdas), len(con_formula), con_formula


def emparejar(hojas_v, hojas_n):
    """Empareja hojas entre snapshots: primero por nombre, el resto por gid.

    El gid es la identidad estable de la pestana. Sin el, un renombre es
    indistinguible de un borrado mas una creacion y el reporte acusa una hoja
    entera destruida que en realidad sigue viva. Los snapshots viejos no traen
    gid: ahi el emparejamiento degrada a solo-nombre y un renombre se reporta,
    conservadoramente, como hoja eliminada + hoja agregada.
    """
    pares = [(n, n) for n in hojas_n if n in hojas_v]
    solo_v = [n for n in hojas_v if n not in hojas_n]
    solo_n = [n for n in hojas_n if n not in hojas_v]

    por_gid = {}
    for n in solo_v:
        g = hojas_v[n]["gid"]
        if g is not None:
            por_gid.setdefault(g, []).append(n)

    renombradas = []
    usados_v = set()
    for n in solo_n:
        g = hojas_n[n]["gid"]
        if g is None:
            continue
        candidatos = [x for x in por_gid.get(g, []) if x not in usados_v]
        if len(candidatos) == 1:
            usados_v.add(candidatos[0])
            renombradas.append((candidatos[0], n, g))
            pares.append((candidatos[0], n))

    renombradas_n = set(x[1] for x in renombradas)
    solo_v = [n for n in solo_v if n not in usados_v]
    solo_n = [n for n in solo_n if n not in renombradas_n]
    return pares, renombradas, solo_v, solo_n


def comparar(hojas_v, hojas_n, valores_comparables=True):
    """Produce la estructura de resultado del diff.

    valores_comparables=False cuando un snapshot trae valor_mostrado y el otro no:
    ahi los valores no se pueden confrontar y la deteccion de errores nuevos se
    apaga para no inundar el reporte con falsos positivos de formato.
    """
    pares, renombradas, solo_v, solo_n = emparejar(hojas_v, hojas_n)

    res = {
        "hojas_agregadas": [],
        "hojas_eliminadas": [],
        "hojas_renombradas": renombradas,
        "errores_nuevos": [],
        "valores_comparables": valores_comparables,
        "por_hoja": {},
        "orden_hojas": [],
        "cont": {
            "formulas_modificadas": 0,
            "formulas_eliminadas": 0,   # celda que sigue existiendo, se quedo sin formula
            "formulas_agregadas": 0,    # celda que ya existia, ahora tiene formula
            "celdas_agregadas": 0,
            "celdas_eliminadas": 0,
            "celdas_eliminadas_con_formula": 0,
            "celdas_agregadas_con_formula": 0,
            "valores_modificados": 0,
            "valores_modificados_con_formula_cambiada": 0,
            "errores_nuevos": 0,
            "formulas_en_hojas_eliminadas": 0,
            "celdas_en_hojas_eliminadas": 0,
            "formulas_en_hojas_agregadas": 0,
            "celdas_en_hojas_agregadas": 0,
            "celdas_viejo": sum(len(h["celdas"]) for h in hojas_v.values()),
            "celdas_nuevo": sum(len(h["celdas"]) for h in hojas_n.values()),
        },
    }

    for nombre in sorted(solo_n):
        total, formulas, detalle = _detalle_hoja(hojas_n[nombre]["celdas"])
        res["hojas_agregadas"].append({
            "nombre": nombre, "gid": hojas_n[nombre]["gid"],
            "celdas": total, "formulas": formulas, "detalle_formulas": detalle,
        })
        res["cont"]["formulas_en_hojas_agregadas"] += formulas
        res["cont"]["celdas_en_hojas_agregadas"] += total

    for nombre in sorted(solo_v):
        total, formulas, detalle = _detalle_hoja(hojas_v[nombre]["celdas"])
        res["hojas_eliminadas"].append({
            "nombre": nombre, "gid": hojas_v[nombre]["gid"],
            "celdas": total, "formulas": formulas, "detalle_formulas": detalle,
        })
        res["cont"]["formulas_en_hojas_eliminadas"] += formulas
        res["cont"]["celdas_en_hojas_eliminadas"] += total

    renombre_de = dict((n, v) for v, n, _ in renombradas)
    for nombre_v, nombre_n in pares:
        viejo = hojas_v[nombre_v]["celdas"]
        nuevo = hojas_n[nombre_n]["celdas"]
        d = {"agregadas": [], "eliminadas": [], "formulas": [], "valores": [],
             "renombrada_de": renombre_de.get(nombre_n)}

        for ref in sorted(set(nuevo) - set(viejo), key=clave_orden):
            f, v = nuevo[ref]
            d["agregadas"].append((ref, f, v))
            res["cont"]["celdas_agregadas"] += 1
            if f:
                res["cont"]["celdas_agregadas_con_formula"] += 1

        for ref in sorted(set(viejo) - set(nuevo), key=clave_orden):
            f, v = viejo[ref]
            d["eliminadas"].append((ref, f, v))
            res["cont"]["celdas_eliminadas"] += 1
            if f:
                res["cont"]["celdas_eliminadas_con_formula"] += 1

        for ref in sorted(set(viejo) & set(nuevo), key=clave_orden):
            fv, vv = viejo[ref]
            fn, vn = nuevo[ref]
            # decision Franco 2026-08-13: una celda que ANTES calculaba y AHORA muestra
            # #REF!/#N/A/#DIV/0! es dano, aunque su formula este intacta -- es la forma
            # tipica en que una migracion rompe una vista sin tocar una sola formula.
            # Recien es detectable desde v0.8.4 del scanner (valor_mostrado); por eso
            # se apaga cuando los dos snapshots no tienen el mismo formato.
            if valores_comparables and vn != vv and es_error(vn) and not es_error(vv):
                res["errores_nuevos"].append((nombre_n, ref, vv, vn, fn))
                res["cont"]["errores_nuevos"] += 1
            if fv != fn:
                if fv and fn:
                    tipo = "FORMULA MODIFICADA"
                    res["cont"]["formulas_modificadas"] += 1
                elif fv and not fn:
                    tipo = "FORMULA ELIMINADA (la celda sigue existiendo)"
                    res["cont"]["formulas_eliminadas"] += 1
                else:
                    tipo = "FORMULA AGREGADA"
                    res["cont"]["formulas_agregadas"] += 1
                d["formulas"].append((ref, tipo, fv, fn))
                # decision Franco 2026-08-13: el cambio de valor se cuenta aunque la
                # formula tambien haya cambiado. Antes el 'elif' lo perdia y el
                # contador de valores subcontaba en silencio.
                if vv != vn:
                    res["cont"]["valores_modificados"] += 1
                    res["cont"]["valores_modificados_con_formula_cambiada"] += 1
            elif vv != vn:
                d["valores"].append((ref, vv, vn))
                res["cont"]["valores_modificados"] += 1

        if any(v for k, v in d.items() if k != "renombrada_de") or d["renombrada_de"]:
            res["por_hoja"][nombre_n] = d
            res["orden_hojas"].append(nombre_n)

    return res


def hay_cambios(res):
    c = res["cont"]
    return bool(
        res["hojas_agregadas"]
        or res["hojas_eliminadas"]
        or res["hojas_renombradas"]
        or c["celdas_agregadas"]
        or c["celdas_eliminadas"]
        or c["formulas_modificadas"]
        or c["formulas_eliminadas"]
        or c["formulas_agregadas"]
        or c["valores_modificados"]
    )


def evaluar(res, estricto):
    """UNICA fuente del criterio del arnes. La consumen el exit code y los dos renders.

    Devuelve los conteos que bloquean, el booleano 'sano' y los motivos en texto.
    Nada fuera de esta funcion decide si un cambio cumple el criterio.
    """
    c = res["cont"]
    formulas_riesgo = (
        c["formulas_modificadas"]
        + c["formulas_eliminadas"]
        + c["celdas_eliminadas_con_formula"]
        + c["formulas_en_hojas_eliminadas"]
    )
    desaparecidas = c["celdas_eliminadas"] + c["celdas_en_hojas_eliminadas"]
    desaparecidas_con_formula = c["celdas_eliminadas_con_formula"] + c["formulas_en_hojas_eliminadas"]
    renombradas = len(res["hojas_renombradas"])
    errores = c["errores_nuevos"]
    agregadas_riesgo = 0
    if estricto:
        agregadas_riesgo = (
            c["formulas_agregadas"]
            + c["celdas_agregadas_con_formula"]
            + c["formulas_en_hojas_agregadas"]
        )

    motivos = []
    if c["formulas_modificadas"]:
        motivos.append(str(c["formulas_modificadas"]) + " formula(s) MODIFICADA(s)")
    if c["formulas_eliminadas"]:
        motivos.append(str(c["formulas_eliminadas"]) + " formula(s) ELIMINADA(s) en celdas que siguen existiendo")
    if desaparecidas:
        motivos.append(str(desaparecidas) + " celda(s) DESAPARECIDA(s) ("
                       + str(desaparecidas_con_formula) + " con formula, "
                       + str(desaparecidas - desaparecidas_con_formula) + " solo dato)")
    if errores:
        motivos.append(str(errores) + " celda(s) que AHORA MUESTRAN ERROR (#REF!, #N/A, #DIV/0!...)")
    if renombradas:
        motivos.append(str(renombradas) + " hoja(s) RENOMBRADA(s)")
    if agregadas_riesgo:
        motivos.append(str(agregadas_riesgo) + " formula(s) NUEVA(s) (cuentan por --estricto)")

    bloqueante = formulas_riesgo + desaparecidas + errores + renombradas + agregadas_riesgo
    # Una desaparicion con formula suma por los dos lados; el total solo se usa
    # como booleano de bloqueo, los numeros que se leen son los de 'motivos'.
    # Red de seguridad: si un dia se suma un contador al total y se olvida su motivo,
    # el reporte tiene que decir que algo bloquea igual, nunca quedarse mudo.
    if bloqueante and not motivos:
        motivos.append(str(bloqueante) + " evento(s) estructural(es) sin clasificar")
    return {
        "formulas_riesgo": formulas_riesgo,
        "desaparecidas": desaparecidas,
        "desaparecidas_con_formula": desaparecidas_con_formula,
        "errores_nuevos": errores,
        "renombradas": renombradas,
        "agregadas_riesgo": agregadas_riesgo,
        "bloqueante": bloqueante,
        "sano": bloqueante == 0,
        "motivos": motivos,
    }


def titular_critico(ev):
    """Titular de la seccion critica. Mismo texto en terminal y en markdown."""
    if ev["sano"]:
        return ("CERO formulas en riesgo y CERO celdas desaparecidas. "
                "Criterio del arnes cumplido.")
    return ("CRITERIO DEL ARNES NO CUMPLIDO: " + "; ".join(ev["motivos"]) + ".")


def veredicto_texto(ev, res):
    """Veredicto final. Mismo texto en terminal y en markdown."""
    if not ev["sano"]:
        return ("VEREDICTO: REVISAR. " + "; ".join(ev["motivos"])
                + ". Confirmar una por una que estaban en lo esperado antes de dar"
                + " el cambio por bueno.")
    if hay_cambios(res):
        return ("VEREDICTO: OK estructural. Cero formulas en riesgo y cero celdas"
                + " desaparecidas; lo que cambio son valores o celdas nuevas sin logica.")
    return ("VEREDICTO: OK. Snapshots identicos CELDA POR CELDA (el diff no compara"
            + " meta, estilos ni validaciones de datos).")


def items_criticos(res):
    """Lista completa de eventos criticos, en orden. La consumen los dos renders.

    Incluye las formulas modificadas/eliminadas/agregadas in-place, las celdas con
    formula que desaparecieron y las formulas que se fueron con una hoja entera.
    Nunca se recorta: es la evidencia del "sin resto".
    """
    items = []
    for hoja in res["orden_hojas"]:
        d = res["por_hoja"][hoja]
        for ref, tipo, antes, ahora in d["formulas"]:
            items.append({"hoja": hoja, "ref": ref, "tipo": tipo,
                          "antes": antes, "ahora": ahora})
        for ref, f, _v in d["eliminadas"]:
            if f:
                items.append({"hoja": hoja, "ref": ref,
                              "tipo": "CELDA CON FORMULA ELIMINADA",
                              "antes": f, "ahora": ""})
    for h in res["hojas_eliminadas"]:
        for ref, f in h["detalle_formulas"]:
            items.append({"hoja": h["nombre"], "ref": ref,
                          "tipo": "FORMULA PERDIDA CON LA HOJA ELIMINADA",
                          "antes": f, "ahora": ""})
    return items


def lineas_desapariciones(res):
    """Resumen de lo que desaparecio. Mismos textos en los dos renders."""
    c = res["cont"]
    L = []
    if c["celdas_eliminadas"]:
        L.append("Celdas desaparecidas en hojas que siguen existiendo: "
                 + str(c["celdas_eliminadas"]) + " (con formula: "
                 + str(c["celdas_eliminadas_con_formula"]) + ", solo dato: "
                 + str(c["celdas_eliminadas"] - c["celdas_eliminadas_con_formula"]) + ")")
    if c["celdas_en_hojas_eliminadas"]:
        L.append("Celdas perdidas con hojas eliminadas enteras: "
                 + str(c["celdas_en_hojas_eliminadas"]) + " (con formula: "
                 + str(c["formulas_en_hojas_eliminadas"]) + ", solo dato: "
                 + str(c["celdas_en_hojas_eliminadas"] - c["formulas_en_hojas_eliminadas"]) + ")")
    return L


def lineas_errores(res):
    """Celdas que pasaron a mostrar error. Mismos textos en los dos renders.

    Nunca se recorta: si una vista se rompio, hay que ver todas las celdas rotas.
    """
    L = []
    for hoja, ref, antes, ahora, formula in res["errores_nuevos"]:
        linea = ("[" + hoja + "] " + ref + "  mostraba " + una_linea(antes, 60, True)
                 + "  ->  ahora muestra " + ahora)
        if formula:
            linea += "   | formula intacta: " + una_linea(formula)
        L.append(linea)
    return L


def _recortar(items, maximo):
    if not maximo or len(items) <= maximo:
        return items, 0
    return items[:maximo], len(items) - maximo


def _partir_eliminadas(items):
    con_formula = [x for x in items if x[1]]
    solo_dato = [x for x in items if not x[1]]
    return con_formula, solo_dato


def render_terminal(res, meta_v, meta_n, maximo, estricto):
    ev = evaluar(res, estricto)
    c = res["cont"]
    L = []
    regla = "=" * 78
    L.append(regla)
    L.append("DIFF DE SNAPSHOTS - prueba de no-dano (arnes Fase 2, punto 5)")
    L.append(regla)
    L.append("  viejo : " + meta_v["ruta"])
    L.append("          exportado " + str(meta_v["fecha"]) + " | "
             + str(c["celdas_viejo"]) + " celdas")
    L.append("  nuevo : " + meta_n["ruta"])
    L.append("          exportado " + str(meta_n["fecha"]) + " | "
             + str(c["celdas_nuevo"]) + " celdas")
    if meta_v["id_planilla"] != meta_n["id_planilla"]:
        L.append("  AVISO: los snapshots son de PLANILLAS DISTINTAS ("
                 + str(meta_v["id_planilla"]) + " vs " + str(meta_n["id_planilla"]) + ")")
    if meta_v["con_valor_mostrado"] != meta_n["con_valor_mostrado"]:
        L.append("  AVISO: un snapshot trae valor_mostrado y el otro no (formatos de"
                 " scanner distintos). Los cambios de VALOR de este reporte no son"
                 " comparables; las formulas si.")
    L.append("")

    L.append("-" * 78)
    L.append("RESUMEN")
    L.append("-" * 78)
    L.append("  hojas agregadas            : " + str(len(res["hojas_agregadas"])))
    L.append("  hojas eliminadas           : " + str(len(res["hojas_eliminadas"])))
    L.append("  hojas renombradas          : " + str(len(res["hojas_renombradas"])))
    L.append("  celdas agregadas           : " + str(c["celdas_agregadas"])
             + " (con formula: " + str(c["celdas_agregadas_con_formula"]) + ")")
    L.append("  CELDAS DESAPARECIDAS       : " + str(ev["desaparecidas"])
             + " (con formula: " + str(ev["desaparecidas_con_formula"])
             + ", solo dato: " + str(ev["desaparecidas"] - ev["desaparecidas_con_formula"]) + ")")
    L.append("  FORMULAS MODIFICADAS       : " + str(c["formulas_modificadas"]))
    L.append("  FORMULAS ELIMINADAS        : " + str(c["formulas_eliminadas"]))
    L.append("  formulas agregadas         : " + str(c["formulas_agregadas"]))
    L.append("  CELDAS QUE AHORA DAN ERROR : " + str(c["errores_nuevos"])
             + ("" if res["valores_comparables"] else "  (sin verificar: formatos distintos)"))
    L.append("  valores modificados        : " + str(c["valores_modificados"])
             + "  (ruido esperable: los valores cambian con cada carga)")
    if c["valores_modificados_con_formula_cambiada"]:
        L.append("    de esos, en celdas cuya formula tambien cambio: "
                 + str(c["valores_modificados_con_formula_cambiada"]))
    L.append("")

    if not hay_cambios(res):
        L.append("SIN CAMBIOS: los dos snapshots describen la misma planilla, celda por celda.")
        L.append("")

    # Seccion critica primero: es la que decide si el cambio fue sano.
    L.append(regla)
    L.append("SECCION CRITICA - FORMULAS Y DESAPARICIONES")
    L.append(regla)
    L.append("  " + titular_critico(ev))
    criticos = items_criticos(res)
    desapariciones = lineas_desapariciones(res)
    errores = lineas_errores(res)
    if criticos or desapariciones or errores:
        L.append("  Esta seccion NUNCA se trunca: ni el texto de las formulas ni la"
                 " cantidad de items (--max-detalle no la afecta).")
        L.append("")
        for linea in desapariciones:
            L.append("  " + linea)
        if desapariciones:
            L.append("")
        if errores:
            L.append("  CELDAS QUE AHORA MUESTRAN ERROR (la formula puede estar intacta):")
            for linea in errores:
                L.append("    " + linea)
            L.append("")
        hoja_actual = None
        for it in criticos:
            if it["hoja"] != hoja_actual:
                hoja_actual = it["hoja"]
                L.append("  [" + hoja_actual + "]")
            L.append("    " + it["ref"] + "  " + it["tipo"])
            antes = una_linea(it["antes"]) if it["antes"] else ""
            ahora = una_linea(it["ahora"]) if it["ahora"] else ""
            if antes and ahora:
                L.append("      longitud: " + str(len(antes)) + " -> " + str(len(ahora))
                         + " caracteres")
                frag = fragmento_cambiado(antes, ahora)
                if frag:
                    pos, fa, fb = frag
                    L.append("      cambio desde el caracter " + str(pos) + ":")
                    L.append("        antes : " + fa)
                    L.append("        ahora : " + fb)
                L.append("      completo (sin truncar):")
                L.append("        antes : " + antes)
                L.append("        ahora : " + ahora)
            elif antes:
                L.append("      formula perdida (sin truncar): " + antes)
            else:
                L.append("      formula nueva (sin truncar): " + ahora)
    L.append("")

    if res["hojas_agregadas"] or res["hojas_eliminadas"] or res["hojas_renombradas"]:
        L.append(regla)
        L.append("HOJAS")
        L.append(regla)
        for h in res["hojas_eliminadas"]:
            L.append("  ELIMINADA   " + h["nombre"] + "  (" + str(h["celdas"]) + " celdas, "
                     + str(h["formulas"]) + " con formula)  [detalle completo en la seccion critica]")
        for nombre_v, nombre_n, gid in res["hojas_renombradas"]:
            L.append("  RENOMBRADA  " + nombre_v + "  ->  " + nombre_n
                     + "  (mismo gid " + str(gid) + "; sus celdas SI se compararon)")
        for h in res["hojas_agregadas"]:
            L.append("  AGREGADA    " + h["nombre"] + "  (" + str(h["celdas"]) + " celdas, "
                     + str(h["formulas"]) + " con formula)")
        L.append("")

    if res["orden_hojas"]:
        L.append(regla)
        L.append("DETALLE POR HOJA")
        L.append(regla)
    for hoja in res["orden_hojas"]:
        d = res["por_hoja"][hoja]
        L.append("")
        titulo = "[" + hoja + "]"
        if d["renombrada_de"]:
            titulo += " (antes: " + d["renombrada_de"] + ")"
        L.append(titulo + "  agregadas=" + str(len(d["agregadas"]))
                 + " eliminadas=" + str(len(d["eliminadas"]))
                 + " formulas=" + str(len(d["formulas"]))
                 + " valores=" + str(len(d["valores"])))
        if d["eliminadas"]:
            con_f, solo_dato = _partir_eliminadas(d["eliminadas"])
            if con_f:
                L.append("  ELIMINADAS CON FORMULA (" + str(len(con_f))
                         + ", listado completo, no se trunca)")
                for ref, f, _v in con_f:
                    L.append("    " + ref + "  " + una_linea(f))
            if solo_dato:
                L.append("  ELIMINADAS SOLO DATO (" + str(len(solo_dato)) + ")")
                items, resto = _recortar(solo_dato, maximo)
                for ref, _f, v in items:
                    L.append("    " + ref + "  " + una_linea(v, 120, True))
                if resto:
                    L.append("    ... y " + str(resto) + " celda(s) de dato mas SIN LISTAR"
                             + " (correr con --max-detalle 0 para verlas todas)")
        if d["agregadas"]:
            L.append("  AGREGADAS")
            items, resto = _recortar(d["agregadas"], maximo)
            for ref, f, v in items:
                marca = "formula" if f else "valor"
                L.append("    " + ref + "  (" + marca + ") " + una_linea(f or v, 120, True))
            if resto:
                L.append("    ... y " + str(resto) + " mas SIN LISTAR (usar --max-detalle 0)")
        if d["formulas"]:
            L.append("  FORMULAS (texto completo en la seccion critica)")
            for ref, tipo, _fv, _fn in d["formulas"]:
                L.append("    " + ref + "  " + tipo)
        if d["valores"]:
            L.append("  VALORES (solo cambio el dato, la formula quedo igual)")
            items, resto = _recortar(d["valores"], maximo)
            for ref, vv, vn in items:
                L.append("    " + ref + "  " + una_linea(vv, 60, True) + "  ->  "
                         + una_linea(vn, 60, True))
            if resto:
                L.append("    ... y " + str(resto) + " mas SIN LISTAR (usar --max-detalle 0)")

    L.append("")
    L.append(regla)
    L.append(veredicto_texto(ev, res))
    L.append(regla)
    return "\n".join(L)


def _cerca(texto):
    """Fence de markdown con backticks suficientes para el contenido dado."""
    largo = 3
    for corrida in re.findall(r"`+", texto):
        largo = max(largo, len(corrida) + 1)
    return "`" * largo


def render_markdown(res, meta_v, meta_n, maximo, estricto):
    ev = evaluar(res, estricto)
    c = res["cont"]
    L = []
    L.append("# Diff de snapshots - prueba de no-dano")
    L.append("")
    L.append("| | snapshot | exportado | celdas |")
    L.append("|---|---|---|---|")
    L.append("| viejo | `" + meta_v["ruta"] + "` | " + str(meta_v["fecha"]) + " | "
             + str(c["celdas_viejo"]) + " |")
    L.append("| nuevo | `" + meta_n["ruta"] + "` | " + str(meta_n["fecha"]) + " | "
             + str(c["celdas_nuevo"]) + " |")
    L.append("")
    if meta_v["id_planilla"] != meta_n["id_planilla"]:
        L.append("AVISO: los snapshots son de PLANILLAS DISTINTAS ("
                 + str(meta_v["id_planilla"]) + " vs " + str(meta_n["id_planilla"]) + ").")
        L.append("")
    if meta_v["con_valor_mostrado"] != meta_n["con_valor_mostrado"]:
        L.append("AVISO: un snapshot trae `valor_mostrado` y el otro no (formatos de"
                 " scanner distintos). Los cambios de VALOR de este reporte no son"
                 " comparables; las formulas si.")
        L.append("")
    L.append("## Resumen")
    L.append("")
    L.append("| metrica | cantidad |")
    L.append("|---|---|")
    L.append("| hojas agregadas | " + str(len(res["hojas_agregadas"])) + " |")
    L.append("| hojas eliminadas | " + str(len(res["hojas_eliminadas"])) + " |")
    L.append("| hojas renombradas | " + str(len(res["hojas_renombradas"])) + " |")
    L.append("| celdas agregadas | " + str(c["celdas_agregadas"]) + " |")
    L.append("| **celdas desaparecidas** | **" + str(ev["desaparecidas"])
             + "** (con formula: " + str(ev["desaparecidas_con_formula"]) + ") |")
    L.append("| **formulas modificadas** | **" + str(c["formulas_modificadas"]) + "** |")
    L.append("| **formulas eliminadas** | **" + str(c["formulas_eliminadas"]) + "** |")
    L.append("| formulas agregadas | " + str(c["formulas_agregadas"]) + " |")
    L.append("| **celdas que ahora dan error** | **" + str(c["errores_nuevos"]) + "**"
             + ("" if res["valores_comparables"] else " (sin verificar: formatos distintos)") + " |")
    L.append("| valores modificados | " + str(c["valores_modificados"]) + " |")
    L.append("")
    L.append("## Seccion critica - formulas y desapariciones")
    L.append("")
    L.append(titular_critico(ev))
    L.append("")
    criticos = items_criticos(res)
    desapariciones = lineas_desapariciones(res)
    errores = lineas_errores(res)
    if criticos or desapariciones or errores:
        L.append("Esta seccion NUNCA se trunca: ni el texto de las formulas ni la"
                 " cantidad de items (`--max-detalle` no la afecta).")
        L.append("")
        for linea in desapariciones:
            L.append("- " + linea)
        if desapariciones:
            L.append("")
        if errores:
            L.append("CELDAS QUE AHORA MUESTRAN ERROR (la formula puede estar intacta):")
            L.append("")
            for linea in errores:
                L.append("- " + linea)
            L.append("")
        for it in criticos:
            L.append("### [" + it["hoja"] + "] " + it["ref"] + " - " + it["tipo"])
            L.append("")
            antes = una_linea(it["antes"]) if it["antes"] else ""
            ahora = una_linea(it["ahora"]) if it["ahora"] else ""
            if antes and ahora:
                linea_meta = "longitud: " + str(len(antes)) + " -> " + str(len(ahora)) + " caracteres"
                frag = fragmento_cambiado(antes, ahora)
                if frag:
                    pos, fa, fb = frag
                    L.append(linea_meta + " | cambio desde el caracter " + str(pos) + ":")
                    L.append("")
                    cuerpo = "- " + fa + "\n+ " + fb
                    cerca = _cerca(cuerpo)
                    L.append(cerca + "diff")
                    L.append(cuerpo)
                    L.append(cerca)
                    L.append("")
                else:
                    L.append(linea_meta)
                    L.append("")
                cuerpo = "antes: " + antes + "\nahora: " + ahora
                cerca = _cerca(cuerpo)
                L.append("Completo (sin truncar):")
                L.append("")
                L.append(cerca + "text")
                L.append(cuerpo)
                L.append(cerca)
                L.append("")
            else:
                cuerpo = antes or ahora
                cerca = _cerca(cuerpo)
                L.append(("Formula perdida" if antes else "Formula nueva") + " (sin truncar):")
                L.append("")
                L.append(cerca + "text")
                L.append(cuerpo)
                L.append(cerca)
                L.append("")

    if res["hojas_agregadas"] or res["hojas_eliminadas"] or res["hojas_renombradas"]:
        L.append("## Hojas")
        L.append("")
        for h in res["hojas_eliminadas"]:
            L.append("- ELIMINADA `" + h["nombre"] + "` (" + str(h["celdas"]) + " celdas, "
                     + str(h["formulas"]) + " con formula; detalle completo en la seccion critica)")
        for nombre_v, nombre_n, gid in res["hojas_renombradas"]:
            L.append("- RENOMBRADA `" + nombre_v + "` -> `" + nombre_n + "` (mismo gid "
                     + str(gid) + "; sus celdas si se compararon)")
        for h in res["hojas_agregadas"]:
            L.append("- AGREGADA `" + h["nombre"] + "` (" + str(h["celdas"]) + " celdas, "
                     + str(h["formulas"]) + " con formula)")
        L.append("")

    for hoja in res["orden_hojas"]:
        d = res["por_hoja"][hoja]
        titulo = "## Hoja: " + hoja
        if d["renombrada_de"]:
            titulo += " (antes: " + d["renombrada_de"] + ")"
        L.append(titulo)
        L.append("")
        if d["eliminadas"]:
            con_f, solo_dato = _partir_eliminadas(d["eliminadas"])
            if con_f:
                L.append("### Celdas eliminadas con formula (" + str(len(con_f))
                         + ", listado completo)")
                L.append("")
                for ref, f, _v in con_f:
                    L.append("- `" + ref + "` `" + una_linea(f).replace("|", "\\|") + "`")
                L.append("")
            if solo_dato:
                L.append("### Celdas eliminadas solo dato (" + str(len(solo_dato)) + ")")
                L.append("")
                items, resto = _recortar(solo_dato, maximo)
                for ref, _f, v in items:
                    L.append("- `" + ref + "` `" + una_linea(v, 120, True).replace("|", "\\|") + "`")
                if resto:
                    L.append("- ... y " + str(resto) + " celda(s) de dato mas SIN LISTAR"
                             + " (correr con `--max-detalle 0`)")
                L.append("")
        if d["agregadas"]:
            L.append("### Celdas agregadas")
            L.append("")
            items, resto = _recortar(d["agregadas"], maximo)
            for ref, f, v in items:
                marca = "formula" if f else "valor"
                L.append("- `" + ref + "` (" + marca + ") `"
                         + una_linea(f or v, 120, True).replace("|", "\\|") + "`")
            if resto:
                L.append("- ... y " + str(resto) + " mas SIN LISTAR (usar `--max-detalle 0`)")
            L.append("")
        if d["formulas"]:
            L.append("### Formulas (texto completo en la seccion critica)")
            L.append("")
            for ref, tipo, _fv, _fn in d["formulas"]:
                L.append("- `" + ref + "` " + tipo)
            L.append("")
        if d["valores"]:
            L.append("### Valores modificados")
            L.append("")
            items, resto = _recortar(d["valores"], maximo)
            for ref, vv, vn in items:
                L.append("- `" + ref + "`: " + una_linea(vv, 60, True) + " -> "
                         + una_linea(vn, 60, True))
            if resto:
                L.append("- ... y " + str(resto) + " mas SIN LISTAR (usar `--max-detalle 0`)")
            L.append("")

    L.append("## Veredicto")
    L.append("")
    L.append(veredicto_texto(ev, res))
    L.append("")
    return "\n".join(L)


def main():
    ap = argparse.ArgumentParser(
        description="Compara dos snapshots del gemelo digital celda por celda"
    )
    ap.add_argument("viejo", help="snapshot previo (JSON del scanner)")
    ap.add_argument("nuevo", help="snapshot posterior (JSON del scanner)")
    ap.add_argument("--markdown", dest="ruta_md", default=None,
                    help="ademas del reporte en terminal, vuelca el diff a un .md")
    ap.add_argument("--max-detalle", dest="maximo", type=int, default=40,
                    help="maximo de items listados por seccion INFORMATIVA (0 = sin"
                         " limite). La seccion critica nunca se trunca.")
    ap.add_argument("--estricto", action="store_true",
                    help="tambien falla si aparecieron formulas nuevas (in-place,"
                         " en celdas nuevas o en hojas nuevas enteras)")
    args = ap.parse_args()

    meta_v, hojas_v = cargar(args.viejo)
    meta_n, hojas_n = cargar(args.nuevo)
    res = comparar(hojas_v, hojas_n,
                   meta_v["con_valor_mostrado"] == meta_n["con_valor_mostrado"])

    print(render_terminal(res, meta_v, meta_n, args.maximo, args.estricto))

    if args.ruta_md:
        destino = os.path.abspath(args.ruta_md)
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        with open(destino, "w", encoding="utf-8", newline="\n") as f:
            f.write(render_markdown(res, meta_v, meta_n, args.maximo, args.estricto))
        print("Reporte markdown escrito en: " + destino)

    return 1 if evaluar(res, args.estricto)["bloqueante"] else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit as e:
        # SystemExit con mensaje = error de uso -> exit 2 (distinto del guard).
        if isinstance(e.code, str):
            print(e.code, file=sys.stderr)
            sys.exit(2)
        raise
