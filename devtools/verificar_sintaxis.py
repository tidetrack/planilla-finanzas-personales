#!/usr/bin/env python3
"""Comprueba que TODOS los .js de src/ parsean, antes de deployar.

[CONCEPTO DE NEGOCIO]
Apps Script no carga archivo por archivo: parsea el proyecto ENTERO en cada ejecucion. Un solo
error de sintaxis en cualquiera de los 42 archivos deja la planilla sin menu, sin triggers y
sin custom functions -- no falla la funcion que se toco, falla todo. Ya paso dos veces:
v0.50.1 ("el proyecto entero no cargaba: un const leia otro archivo") y el 2026-08-25, cuando
un changelog escrito con backticks adentro de un template literal delimitado por backticks
cerro el literal a la mitad y se commiteo y pusheo sin que nada avisara.

[FUNDAMENTO TEORICO / ADMINISTRATIVO]
El costo de este chequeo es un `node --check` por archivo -- menos de un segundo en total --
contra el costo de la falla, que es la planilla entera muerta hasta el proximo deploy. Va como
gate de `sync_targets.command`: ningun deploy sale con un archivo que no parsea.

Se usa `node --check` y no un parser propio porque el runtime de Apps Script es V8, el mismo
motor: lo que node rechaza, Apps Script tambien.

USO:  python3 devtools/verificar_sintaxis.py [archivo.js ...]
      Sin argumentos revisa todos los src/*.js.
      Sale 1 si alguno no parsea: sirve como gate pre-deploy.
"""
import glob
import os
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(RAIZ, 'src')


def main(argv):
    objetivos = argv[1:] or sorted(glob.glob(os.path.join(SRC, '*.js')))
    if not objetivos:
        print('No hay archivos .js en src/')
        return 1

    fallas = []
    for ruta in objetivos:
        try:
            r = subprocess.run(['node', '--check', ruta], capture_output=True, text=True)
        except FileNotFoundError:
            print('node no esta disponible: NO se pudo verificar la sintaxis.')
            return 1
        if r.returncode != 0:
            # La linea util de node --check es la que dice el error, no el stack.
            detalle = ''
            for linea in r.stderr.splitlines():
                if 'Error' in linea and 'at ' not in linea:
                    detalle = linea.strip()
                    break
            fallas.append((os.path.relpath(ruta, RAIZ), detalle or 'no parsea'))

    if fallas:
        print('NO DEPLOYAR: %d archivo(s) no parsean. Apps Script parsea el proyecto entero,'
              % len(fallas))
        print('asi que con uno solo roto la planilla queda sin menu, sin triggers y sin')
        print('custom functions.')
        print('')
        for ruta, detalle in fallas:
            print('  %s' % ruta)
            print('      %s' % detalle)
        return 1

    print('Los %d archivos de src/ parsean.' % len(objetivos))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
