#!/usr/bin/env python3
"""Verifica los modales de HtmlService ANTES de deployar.

[CONCEPTO DE NEGOCIO]
Este repo tiene verificacion adversarial para todo lo que ESCRIBE en la planilla
-- once bancos de pruebas en devtools/probar_*.js -- y hasta hoy CERO para lo que
MUESTRA. Esa asimetria costo cuatro dias con el unico modal del menu diario muerto
en produccion (v0.45.2): UI_AbmPlanCuentas.html:250 pedia un getElementById con un
id que no existia, el TypeError caia dentro de un withSuccessHandler y no dejaba
NINGUN rastro -- ni error en pantalla, ni log, ni fila mal escrita. Solo un loader
que nunca se apagaba.

[FUNDAMENTO TEORICO / ADMINISTRATIVO]
Una excepcion de cliente en Apps Script es invisible por construccion:
withFailureHandler cubre fallas del SERVIDOR, no excepciones del cliente dentro del
handler de exito. Entonces el unico momento en que se puede atrapar es ANTES de
deployar, de forma estatica. Tres chequeos, cada uno por un modo de falla real:

  1. IDS HUERFANOS -- cada getElementById('x') del JS tiene que tener su id="x" en
     el DOM. Es exactamente el bug de la v0.45.2.
  2. SINTAXIS -- el JS concatenado (resolviendo los include()) tiene que pasar
     node --check. Un error de sintaxis mata el archivo entero en silencio.
  3. HANDLERS DE FALLA -- toda cadena google.script.run que apague un loader o
     deshabilite un control en su withSuccessHandler necesita su withFailureHandler,
     o una falla del servidor deja la UI trabada para siempre.

Portado de planilla-pymes (legacy/devtools/verificar_modales.py), Fase 5 del arnes.
@see docs/permanente/ARNES_TIDETRACK.md seccion 7

USO:  python3 devtools/verificar_modales.py [archivo.html ...]
      Sin argumentos verifica todos los src/*.html.
      Sale con codigo 1 si algun chequeo falla: sirve como gate pre-deploy.
"""
import glob
import os
import re
import subprocess
import sys
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(RAIZ, 'src')

RE_ID_DOM = re.compile(r'\bid\s*=\s*["\']([^"\']+)["\']')
RE_SCRIPT = re.compile(r'<script[^>]*>(.*?)</script>', re.S)
RE_GET_BY_ID = re.compile(r'getElementById\(\s*["\']([^"\']+)["\']\s*\)')
RE_INCLUDE = re.compile(r'<\?!?=?\s*include\(\s*[\'"]([^\'"]+)[\'"]\s*\)\s*\?>')
RE_SCRIPTLET = re.compile(r'<\?[^>]*\?>')
RE_INICIO_RUN = re.compile(r'google\.script\.run\b')


def cadenas_google_script_run(js):
    """Devuelve el texto completo de cada cadena google.script.run...(...).

    No se puede hacer con una expresion regular: los cuerpos de los handlers llevan
    `;` y `)` adentro, asi que cualquier patron perezoso corta en el primer separador
    y el chequeo queda mudo. Se recorre balanceando parentesis desde cada aparicion,
    salteando strings y comentarios, hasta que la cadena termina.
    """
    salida = []
    for m in RE_INICIO_RUN.finditer(js):
        i = m.end()
        prof = 0
        n = len(js)
        while i < n:
            c = js[i]
            if c in '"\'`':                      # string: se salta entero
                comilla, i = c, i + 1
                while i < n and js[i] != comilla:
                    i += 2 if js[i] == '\\' else 1
                i += 1
                continue
            if c == '/' and i + 1 < n and js[i + 1] == '/':
                while i < n and js[i] != '\n':
                    i += 1
                continue
            if c == '/' and i + 1 < n and js[i + 1] == '*':
                fin = js.find('*/', i + 2)
                i = n if fin == -1 else fin + 2
                continue
            if c == '(':
                prof += 1
            elif c == ')':
                prof -= 1
            elif prof == 0 and c not in ' \t\r\n.' and not c.isalnum() and c != '_':
                break                             # la cadena termino (`;`, `}`, etc.)
            i += 1
        salida.append(js[m.end():i])
    return salida


def metodos_de_nivel_cero(cadena):
    """Los `.metodo(` que cuelgan de la cadena misma, no los de adentro de un handler.

    Sin esto el ultimo `.foo(` del texto suele ser un getElementById del cuerpo del
    handler, y el mensaje de error termina culpando a la funcion equivocada.
    """
    nombres, i, prof, n = [], 0, 0, len(cadena)
    while i < n:
        c = cadena[i]
        if c in '"\'`':
            comilla, i = c, i + 1
            while i < n and cadena[i] != comilla:
                i += 2 if cadena[i] == '\\' else 1
            i += 1
            continue
        if c == '(':
            prof += 1
        elif c == ')':
            prof -= 1
        elif c == '.' and prof == 0:
            m = re.match(r'\.\s*(\w+)\s*\(', cadena[i:])
            if m:
                nombres.append(m.group(1))
        i += 1
    return nombres


def resolver_includes(texto, vistos=None):
    """Reemplaza cada <?!= include('X') ?> por el contenido de src/X.html.

    Los fragmentos son el contrato de la Fase 5: una vista vive en su *_Vista.html y
    la consumen dos wrappers. Verificar el wrapper sin resolver el include mira medio
    archivo y da verde sobre el otro medio.
    """
    vistos = vistos or set()

    def _sub(m):
        nombre = m.group(1)
        if nombre in vistos:
            return ''  # ciclo: ya incluido
        vistos.add(nombre)
        ruta = os.path.join(SRC, nombre + '.html')
        if not os.path.exists(ruta):
            return '<!-- include no encontrado: %s -->' % nombre
        with open(ruta, encoding='utf-8') as f:
            return resolver_includes(f.read(), vistos)

    return RE_INCLUDE.sub(_sub, texto)


def verificar(ruta):
    """Devuelve la lista de problemas de un archivo. Vacia = sano."""
    with open(ruta, encoding='utf-8') as f:
        crudo = f.read()

    # Solo tiene sentido en un archivo que sea una pantalla: HTML con script.
    if '<script' not in crudo:
        return []

    texto = resolver_includes(crudo)
    problemas = []

    # --- 1. ids huerfanos ---
    dom = set(RE_ID_DOM.findall(texto))
    js = '\n'.join(RE_SCRIPT.findall(texto))
    # Los scriptlets de HtmlService (<?= x ?>) no son JS del cliente: se vacian para
    # que no rompan el parser. Se reemplazan por un literal para no dejar huecos
    # sintacticos donde el scriptlet ocupaba el lugar de un valor.
    js_limpio = RE_SCRIPTLET.sub('null', js)

    pedidos = set(RE_GET_BY_ID.findall(js_limpio))
    huerfanos = sorted(pedidos - dom)
    for h in huerfanos:
        problemas.append("getElementById('%s') no tiene id en el DOM" % h)

    # --- 2. sintaxis ---
    tmp = None
    try:
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False,
                                         encoding='utf-8') as f:
            f.write(js_limpio)
            tmp = f.name
        r = subprocess.run(['node', '--check', tmp],
                           capture_output=True, text=True)
        if r.returncode != 0:
            primera = (r.stderr.strip().splitlines() or ['error desconocido'])
            problemas.append('el JS no parsea: %s' % primera[-1].strip())
    except FileNotFoundError:
        problemas.append('node no esta disponible: no se pudo chequear la sintaxis')
    finally:
        if tmp and os.path.exists(tmp):
            os.unlink(tmp)

    # --- 3. cadenas google.script.run sin withFailureHandler ---
    # Solo se reporta la cadena cuyo exito APAGA algo (un loader, un disabled): si el
    # unico camino que devuelve el control al usuario esta en el success, la falla lo
    # deja trabado. Una cadena que no toca el estado de la UI puede fallar sin secuela.
    for cadena in cadenas_google_script_run(js_limpio):
        if 'withFailureHandler' in cadena:
            continue
        devuelve_control = ("classList.add('hidden')" in cadena
                            or 'classList.add("hidden")' in cadena
                            or re.search(r'disabled\s*=\s*false', cadena))
        if devuelve_control:
            # El ultimo metodo de NIVEL CERO es el endpoint del servidor; los
            # anteriores son los handlers.
            metodo = metodos_de_nivel_cero(cadena)
            nombre = metodo[-1] if metodo else '?'
            problemas.append(
                "google.script.run...%s() no tiene withFailureHandler y su exito "
                "devuelve el control al usuario: si falla, la UI queda trabada" % nombre)

    return problemas


def main(argv):
    objetivos = argv[1:] or sorted(glob.glob(os.path.join(SRC, '*.html')))
    if not objetivos:
        print('No hay archivos .html en src/')
        return 1

    fallas = 0
    for ruta in objetivos:
        problemas = verificar(ruta)
        nombre = os.path.relpath(ruta, RAIZ)
        if not problemas:
            print('  OK    %s' % nombre)
        else:
            fallas += 1
            print('  FALLA %s' % nombre)
            for p in problemas:
                print('        - %s' % p)

    print()
    if fallas:
        print('%d archivo(s) con problemas. NO deployar.' % fallas)
        return 1
    print('Todos los modales verificados.')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
