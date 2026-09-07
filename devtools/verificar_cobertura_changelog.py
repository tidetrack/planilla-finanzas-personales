#!/usr/bin/env python3
"""Comprueba que TODO release del changelog embebido de 01_Version.js exista en ZZ_Changelog.js.

[CONCEPTO DE NEGOCIO]
El historial de este producto vivia DUPLICADO en dos lugares del codigo: el literal `changelog`
de src/01_Version.js (157,9 KB, 75 bloques) y src/ZZ_Changelog.js (373 KB, el canonico). Apps
Script parsea el proyecto ENTERO en cada ejecucion -- cada apertura de menu, cada onEdit, cada
boton --, asi que esa duplicacion se pagaba en cada clic del usuario. El literal es el caro de
los dos: es un template literal, o sea una constante que se ASIGNA en cada carga, mientras que
ZZ_Changelog.js es 100% comentario, que el lexer descarta sin construir AST (medido: 0,0031
ms/KB contra 0,0005 ms/KB, 6,4x mas barato por KB).

Ese par de numeros es el UNICO valido, y sale de una sola corrida con el metodo que declara
ZZ_Changelog.js: code-cache de V8 invalidado y las dos variantes ALTERNADAS. Medir cada variante
por separado da resultados contradictorios porque la deriva del proceso pesa mas que la
diferencia; hubo una primera pasada con ese metodo malo y sus cifras se descartaron.

Podar el literal solo es aceptable si ZZ es un superconjunto VERIFICADO, entrada por entrada.
Este script es esa verificacion, y su verde es la licencia para podar. Corre ANTES del recorte,
con el literal completo. Perder historia es peor que el peso: la regla es que ninguna linea sale
de un lugar sin estar comprobada en su destino.

[FUNDAMENTO TEORICO / ADMINISTRATIVO]
La identidad de un release es el par (version, fecha), NO el titulo. Cuatro releases
(v0.39.1, v0.40.0, v0.42.0, v0.42.1) tienen el titulo REESCRITO entre las dos copias sin cambio
de contenido: exigir titulo identico daba cuatro rojos falsos. Y seis numeros aparecen repetidos
en el literal por merges de ramas paralelas (v0.46.0, v0.46.1, v0.49.0, v0.50.0, v0.53.0,
v0.56.0), asi que la comparacion es por par, no por numero suelto.

No alcanza con que el rotulo exista en ZZ: un bloque presente pero vaciado (un stub) pierde la
historia igual que uno ausente, y ademas pasa desapercibido porque el indice se ve completo. Por
eso el segundo chequeo compara TAMANOS: el bloque de ZZ tiene que medir al menos la mitad que el
del literal. La mitad y no la igualdad porque las dos copias estan redactadas por separado -- ZZ
suele ser mas extenso, pero no siempre -- y lo que se busca atrapar es el vaciado, no la
diferencia de redaccion.

Despues del recorte el literal conserva un solo bloque, el del release vigente, y este script
sigue vivo como gate permanente: todo release que encabece el literal tiene que tener su entrada
en ZZ con la misma fecha y un cuerpo real. "Gate permanente" quiere decir CABLEADO, no
declarado: lo corre sync_targets.command antes de cada despliegue, junto a verificar_sintaxis.py
(un gate que nadie ejecuta no frena nada; ver la decision inline en ese script).

@see sync_targets.command (bloque de gates previos: aca es donde este script corta el deploy)
@see docs/permanente/CHANGELOG.md
@see src/ZZ_Changelog.js
@see devtools/verificar_sintaxis.py (chequeo de coherencia de version, complementario a este)
"""

import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(RAIZ, 'src')

# decision Franco 2026-09-07: los bloques del literal se reconocen por "vX.Y.Z (fecha) - titulo"
# al principio de linea, que es la forma que tienen los 75 sin excepcion; los de ZZ_Changelog.js
# por " * [fecha] vX.Y.Z - titulo", que es el formato de su cabecera de comentario y el mismo que
# ya lee verificar_sintaxis.py para el chequeo de coherencia de version.
#
# decision Franco 2026-09-07: RE_ZZ tolera lo que haya entre la version y el guion ([^\n-]*).
# La primera version exigia el guion pegado a la version y por eso indexaba 143 de los 144
# bloques que ZZ tiene de verdad: se le escapaba " * [2026-06-05] v0.8.0 (mantenimiento) - ...",
# que mete un parentesis en el medio. Hoy era inofensivo (v0.8.0 no figuraba en el literal), pero
# el modo de falla es el peor: un rojo que NOMBRA MAL LA CAUSA. Con un rotulo asi en ZZ el script
# habria impreso "FALTA X.Y.Z: sin entrada en ZZ_Changelog.js" sobre un bloque escrito y completo,
# mandando a portar historia ya portada. El guion sigue siendo obligatorio como separador del
# titulo, y la clase excluye el salto de linea para que la cabecera no se coma varias lineas.
RE_LITERAL = re.compile(r'^v([0-9]+\.[0-9]+\.[0-9]+)\s*\((\d{4}-\d{2}-\d{2})\)\s*-\s*(.*)$', re.M)
RE_ZZ = re.compile(r'^ \* \[(\d{4}-\d{2}-\d{2})\] v([0-9]+\.[0-9]+\.[0-9]+)[^\n-]*-\s*(.*)$', re.M)


def _bloques(texto, expresion, orden):
    """Corta el texto en bloques: cada cabecera hasta la siguiente. Devuelve (version, fecha, largo)."""
    encabezados = list(expresion.finditer(texto))
    salida = []
    for i, m in enumerate(encabezados):
        fin = encabezados[i + 1].start() if i + 1 < len(encabezados) else len(texto)
        version = m.group(orden[0])
        fecha = m.group(orden[1])
        salida.append((version, fecha, fin - m.start()))
    return salida


def _leer_literal():
    ruta = os.path.join(SRC, '01_Version.js')
    if not os.path.exists(ruta):
        return None, ['no existe src/01_Version.js']
    s = open(ruta, encoding='utf-8').read()
    ini = s.find('changelog: `')
    if ini < 0:
        return None, ['no se encontro el literal "changelog: `" en src/01_Version.js']
    fin = s.find('\n `\n};', ini)
    if fin < 0:
        return None, ['no se encontro el cierre del literal changelog en src/01_Version.js']
    return s[ini:fin], []


def main():
    literal, fallas = _leer_literal()
    if fallas:
        for f in fallas:
            print('FALLA: %s' % f)
        return 1

    ruta_zz = os.path.join(SRC, 'ZZ_Changelog.js')
    if not os.path.exists(ruta_zz):
        print('FALLA: no existe src/ZZ_Changelog.js, que es el destino de la historia')
        return 1
    zz = open(ruta_zz, encoding='utf-8').read()

    del_literal = _bloques(literal, RE_LITERAL, (1, 2))
    del_zz = _bloques(zz, RE_ZZ, (2, 1))

    if not del_literal:
        print('FALLA: el literal changelog de 01_Version.js no tiene ningun bloque de release')
        return 1
    if not del_zz:
        print('FALLA: ZZ_Changelog.js no tiene ningun bloque de release')
        return 1

    # Un mismo par (version, fecha) puede aparecer mas de una vez en ZZ (merges de ramas
    # paralelas). Se guarda el bloque MAS LARGO: es el que decide si hay cuerpo real.
    indice_zz = {}
    for version, fecha, largo in del_zz:
        clave = (version, fecha)
        indice_zz[clave] = max(indice_zz.get(clave, 0), largo)

    sin_cobertura = []
    flacos = []
    for version, fecha, largo in del_literal:
        clave = (version, fecha)
        if clave not in indice_zz:
            sin_cobertura.append((version, fecha))
        elif indice_zz[clave] < largo / 2:
            flacos.append((version, fecha, largo, indice_zz[clave]))

    print('bloques en el literal de 01_Version.js: %d (%d versiones unicas)'
          % (len(del_literal), len(set(v for v, _, _ in del_literal))))
    print('bloques en ZZ_Changelog.js: %d' % len(del_zz))
    print('sin cobertura: %d' % len(sin_cobertura))
    print('con cuerpo flaco (menos de la mitad): %d' % len(flacos))

    for version, fecha in sin_cobertura:
        print('FALTA %s (%s): sin entrada en ZZ_Changelog.js con esa version y esa fecha'
              % (version, fecha))
    for version, fecha, largo, largo_zz in flacos:
        print('FLACO %s (%s): el bloque del literal mide %d y el de ZZ %d'
              % (version, fecha, largo, largo_zz))

    if sin_cobertura or flacos:
        print('')
        print('RESULTADO: NO se puede podar. Portar primero lo que falta a ZZ_Changelog.js.')
        return 1

    print('')
    if len(del_literal) == 1:
        # Estado posterior al recorte: el literal ya conserva solo el release vigente y este
        # script pasa de ser la licencia para podar a ser el gate permanente de ese unico bloque.
        print('RESULTADO: el unico bloque del literal (el release vigente) tiene su entrada real '
              'en ZZ_Changelog.js.')
    else:
        print('RESULTADO: ZZ_Changelog.js cubre los %d bloques del literal. Se puede podar.'
              % len(del_literal))
    return 0


if __name__ == '__main__':
    sys.exit(main())
