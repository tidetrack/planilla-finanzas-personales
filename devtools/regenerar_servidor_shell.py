#!/usr/bin/env python3
"""Regenera el servidor local del shell desde el shell real.

Escribe DOS archivos en devtools/servidor_shell/:

  shell.html  -- COPIA de src/UI_Shell.html con el include y los scriptlets resueltos y
                 google.script.run reemplazado por un doble.
  index.html  -- el MARCO: devtools/servidor_shell/marco.html con la geometria real de
                 SHELL_GEOMETRIA resuelta. Mete a shell.html en un iframe de exactamente
                 ancho x alto, para que lo que se ve en el navegador tenga las proporciones
                 del modal de Sheets y no las de la ventana.

Ninguno de los dos se edita a mano: se editan src/UI_Shell.html y marco.html. Una copia que
se edita a mano deja de representar lo que esta desplegado, y probar una version vieja
creyendo que es la nueva es la clase de error que este repo ya pago tres veces.

USO:  python3 devtools/regenerar_servidor_shell.py [directorio destino extra ...]
"""
import json, os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARPETA = os.path.join(RAIZ, 'devtools', 'servidor_shell')

# decision Franco 2026-08-25: el MARCO se llama index.html y el shell shell.html, y no al
# reves. El servidor sirve un directorio: lo que abre http://localhost:<puerto> a secas es
# index.html, y eso tiene que ser la simulacion, que es lo que hay que mirar. El shell a
# pantalla completa -- lo que habia hasta hoy -- no se pierde: queda en /shell.html, util
# para abrir el inspector sin pelear con el iframe. Ademas el chequeo de existencia de
# servidor.py sigue apuntando al punto de entrada correcto.
NOMBRE_SHELL = 'shell.html'
NOMBRE_MARCO = 'index.html'


def leer(rel):
    with open(os.path.join(RAIZ, rel), encoding='utf-8') as f:
        return f.read()


def funciones_que_usa_el_shell(shell):
    """Los nombres que el shell invoca por google.script.run.

    Dos formas: la cadena directa, que termina en `})\n.nombre();` despues del ultimo
    handler, y el despacho dinamico de enviar(), que termina en `[fn](datos)` -- ese solo se
    puede leer en los literales que recibe enviar. La segunda es la que quedo fuera de la
    verificacion y por la que el doble se atraso tres releases: el shell paso a
    registrarTraspasos (plural) en v0.53.0 y el doble siguio doblando el singular.
    """
    handlers = ('withSuccessHandler', 'withFailureHandler')
    usadas = set(m for m in re.findall(r'\}\)\s*\.(\w+)\s*\(', shell) if m not in handlers)
    usadas.update(m for m in re.findall(r'google\.script\.run\s*\.(\w+)\s*\(', shell)
                  if m not in handlers)
    usadas.update(re.findall(r"enviar\(\s*'(\w+)'", shell))
    return usadas


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

    # El doble tiene que cubrir todo lo que el shell llama. Si falta una, el boton no falla
    # limpio: enviar() ya prendio el loader y armo el tope de 60 s, asi que el TypeError deja
    # la pantalla colgada un minuto y despues manda a revisar Registros por un movimiento que
    # nunca se escribio. Preferible cortar aca.
    lista_doble = re.search(r'\[([^\]]*?)\]\.forEach', doble, re.S)
    expuestas = set(re.findall(r"'(\w+)'", lista_doble.group(1))) if lista_doble else set()
    faltan = sorted(funciones_que_usa_el_shell(shell) - expuestas)
    if faltan:
        sys.stderr.write('El doble no implementa: %s\n' % ', '.join(faltan))
        sys.stderr.write('Agregarlas en devtools/servidor_shell/doble.js (metodo + whitelist).\n')
        return 1

    shell = shell.replace('<script>', '<script>\n' + doble + '\n</script>\n<script>', 1)

    # ---- EL MARCO -------------------------------------------------------------------
    # La geometria sale de SHELL_GEOMETRIA, misma tecnica que las vistas y la version: es la
    # FUENTE UNICA (src/16_ShellService.js) y el marco no puede tener una copia propia.
    geo = re.search(r'const SHELL_GEOMETRIA\s*=\s*\{\s*ancho:\s*(\d+)\s*,\s*alto:\s*(\d+)\s*\}',
                    svc)
    if not geo:
        sys.stderr.write('No se pudo leer SHELL_GEOMETRIA de src/16_ShellService.js\n')
        return 1

    marco = leer('devtools/servidor_shell/marco.html')
    # Si un hueco desaparecio es porque alguien escribio el numero a mano. Se aborta: ese es
    # exactamente el drift que este generador existe para impedir.
    #
    # decision Franco 2026-08-25: no alcanza con buscar el hueco EN CUALQUIER PARTE del
    # archivo. --sim-ancho aparece dos veces con {{ANCHO}} (la variable y la etiqueta del
    # porcentaje): si alguien clava el numero en la variable y deja la etiqueta, un
    # `'{{ANCHO}}' in marco` sigue dando verdadero y el guard no ve nada. Medido aca antes de
    # endurecerlo: paso limpio con el 900 escrito a mano en :root. Por eso cada hueco critico
    # se exige EN SU DECLARACION, no en el texto suelto.
    obligatorios = (
        ('{{ANCHO}}', r'--sim-ancho:\s*\{\{ANCHO\}\}px'),
        ('{{ALTO}}', r'--sim-alto:\s*\{\{ALTO\}\}px'),
        # El lookbehind no es cosmetico: el iframe lleva src Y data-src, y sin el, un
        # src hardcodeado pasaba el guard porque data-src todavia tenia el hueco.
        ('{{SHELL_SRC}}', r'(?<![-\w])src="\{\{SHELL_SRC\}\}"'),
        ('{{SHELL_SRC}} (data-src)', r'data-src="\{\{SHELL_SRC\}\}"'),
    )
    for hueco, patron in obligatorios:
        if not re.search(patron, marco):
            sys.stderr.write(
                'marco.html no tiene el hueco %s donde corresponde: '
                'la geometria quedo escrita a mano\n' % hueco)
            return 1
    marco = (marco.replace('{{ANCHO}}', geo.group(1))
                  .replace('{{ALTO}}', geo.group(2))
                  .replace('{{SHELL_SRC}}', NOMBRE_SHELL))
    if '{{' in marco:
        sys.stderr.write('Quedo un hueco sin resolver en el marco: revisar el generador\n')
        return 1

    # ---- ESCRITURA ------------------------------------------------------------------
    # El servidor de pruebas corre desde el scratchpad, no desde el repo (los archivos del
    # repo no son legibles para ese proceso). Esa copia se queda vieja en silencio y Franco
    # termina probando una pantalla que ya no existe -- paso el 2026-08-25. Pasar el
    # directorio como argumento la refresca en el mismo acto.
    # Van los DOS archivos a cada destino: si a un destino le llega solo el marco, el iframe
    # da 404 y el dialogo se ve vacio.
    salidas = ((NOMBRE_SHELL, shell), (NOMBRE_MARCO, marco))
    for destino in [CARPETA] + sys.argv[1:]:
        if not os.path.isdir(destino):
            sys.stderr.write('No existe el directorio destino: %s\n' % destino)
            return 1
        for nombre, texto in salidas:
            with open(os.path.join(destino, nombre), 'w', encoding='utf-8') as f:
                f.write(texto)
        etiqueta = os.path.relpath(destino, RAIZ) if destino.startswith(RAIZ) else destino
        print('escrito en %s: %s (%d KB) + %s (modal %sx%s)' % (
            etiqueta, NOMBRE_SHELL, len(shell) // 1024, NOMBRE_MARCO,
            geo.group(1), geo.group(2)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
