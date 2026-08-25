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
    vistas = [{'id': m[0], 'titulo': m[1], 'listo': m[2] == 'true'}
              for m in re.findall(
                  r"id:\s*'([^']+)',\s*titulo:\s*'([^']+)',\s*listo:\s*(\w+)",
                  bloque)]
    if not vistas:
        sys.stderr.write('No se pudieron leer las vistas de SHELL_VISTAS\n')
        return 1

    shell = shell.replace('<?!= vistasJson ?>', json.dumps(vistas, ensure_ascii=False))
    shell = shell.replace('<?!= tiposRiquezaJson ?>', json.dumps(['Ahorros', 'Inversiones']))
    shell = shell.replace('<?= vistaInicial ?>', 'home')
    shell = shell.replace('<?= planilla ?>', 'PLANILLA FINANZAS_v4 .WIP | Personal')
    # El HTML ya escribe la 'v' antes del scriptlet: si aca se pone texto, sale
    # "vservidor local". Va solo el numero.
    # La version se LEE de 01_Version.js. Estuvo escrita a mano ("0.52.1 local") y quedo
    # tres releases atras: una segunda copia de un numero siempre termina mintiendo.
    v = leer('src/01_Version.js')
    partes = [re.search(r'^\s*%s:\s*(\d+)\s*,\s*$' % k, v, re.M) for k in
              ('major', 'minor', 'patch')]
    if not all(partes):
        sys.stderr.write('No se pudo leer la version de src/01_Version.js\n')
        return 1
    shell = shell.replace('<?= version ?>',
                          '.'.join(m.group(1) for m in partes) + ' local')
    if '<?' in shell:
        sys.stderr.write('Quedo un scriptlet sin resolver: revisar el generador\n')
        return 1

    doble = leer('devtools/servidor_shell/doble.js')
    shell = shell.replace('<script>', '<script>\n' + doble + '\n</script>\n<script>', 1)

    with open(SALIDA, 'w', encoding='utf-8') as f:
        f.write(shell)
    print('regenerado: %s (%d KB)' % (os.path.relpath(SALIDA, RAIZ), len(shell) // 1024))

    # El servidor de pruebas corre desde el scratchpad, no desde el repo (los archivos del
    # repo no son legibles para ese proceso). Esa copia se queda vieja en silencio y Franco
    # termina probando una pantalla que ya no existe -- paso el 2026-08-25. Pasar el
    # directorio como argumento la refresca en el mismo acto.
    for destino in sys.argv[1:]:
        if not os.path.isdir(destino):
            sys.stderr.write('No existe el directorio destino: %s\n' % destino)
            return 1
        with open(os.path.join(destino, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(shell)
        print('copiado a: %s/index.html' % destino)
    return 0


if __name__ == '__main__':
    sys.exit(main())
