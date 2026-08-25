#!/usr/bin/env python3
"""Regenera devtools/servidor_shell/index.html desde el shell real.

El archivo servido es una COPIA de src/UI_Shell.html con el include y los scriptlets
resueltos y google.script.run reemplazado por un doble. Una copia que se edita a mano deja de
representar lo que esta desplegado, y probar una version vieja creyendo que es la nueva es la
clase de error que este repo ya pago tres veces. Por eso se regenera, no se toca.

USO:  python3 devtools/regenerar_servidor_shell.py
"""
import json, os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'devtools', 'servidor_shell', 'index.html')


def leer(rel):
    with open(os.path.join(RAIZ, rel), encoding='utf-8') as f:
        return f.read()


def main():
    shell = leer('src/UI_Shell.html')
    shell = shell.replace("<?!= include('UI_SharedStyles'); ?>", leer('src/UI_SharedStyles.html'))

    # Las vistas salen del backend real: no se retipean.
    svc = leer('src/16_ShellService.js')
    bloque = re.search(r'const SHELL_VISTAS = \[(.*?)\];', svc, re.S).group(1)
    vistas = [{'id': m[0], 'titulo': m[1], 'subtitulo': m[2], 'listo': m[3] == 'true'}
              for m in re.findall(
                  r"id:\s*'([^']+)',\s*titulo:\s*'([^']+)',\s*subtitulo:\s*'([^']+)',\s*listo:\s*(\w+)",
                  bloque)]
    if not vistas:
        sys.stderr.write('No se pudieron leer las vistas de SHELL_VISTAS\n')
        return 1

    shell = shell.replace('<?!= vistasJson ?>', json.dumps(vistas, ensure_ascii=False))
    shell = shell.replace('<?!= tiposRiquezaJson ?>', json.dumps(['Ahorros', 'Inversiones']))
    shell = shell.replace('<?= vistaInicial ?>', 'home')
    shell = shell.replace('<?= planilla ?>', 'PLANILLA FINANZAS_v4 .WIP | Personal')
    shell = shell.replace('<?= version ?>', 'servidor local')
    if '<?' in shell:
        sys.stderr.write('Quedo un scriptlet sin resolver: revisar el generador\n')
        return 1

    doble = leer('devtools/servidor_shell/doble.js')
    shell = shell.replace('<script>', '<script>\n' + doble + '\n</script>\n<script>', 1)

    with open(SALIDA, 'w', encoding='utf-8') as f:
        f.write(shell)
    print('regenerado: %s (%d KB)' % (os.path.relpath(SALIDA, RAIZ), len(shell) // 1024))
    return 0


if __name__ == '__main__':
    sys.exit(main())
