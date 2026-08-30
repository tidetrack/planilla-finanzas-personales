#!/usr/bin/env python3
"""Comprueba que TODOS los .js de src/ parsean Y que la version es coherente, antes de deployar.

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

[SEGUNDA VERIFICACION: COHERENCIA DE LA VERSION]
Agregada el 2026-08-25 despues de que un merge entre las dos lineas de trabajo dejara DOS
lineas `patch:` seguidas en 01_Version.js -- `patch: 0` del release nuevo y `patch: 1` del
viejo. Git no marco conflicto: son lineas distintas, las conservo las dos. Y en un literal de
objeto JavaScript la clave repetida NO es un error, gana la ultima. El archivo termino
declarando TRES numeros a la vez: toString() devolvia 0.55.1, releaseName decia v0.55.0 y el
changelog embebido seguia encabezado por v0.54.0; targets.yaml declaraba una cuarta cosa.

Ningun parser puede agarrar esto -- ES6 permite claves duplicadas en literales incluso en modo
estricto -- asi que el chequeo tiene que ser explicito. Importa porque targets.yaml es la
referencia del drift-check: si la version que la planilla reporta no es la que el repo cree
haber desplegado, el mecanismo que usamos para no pisarnos entre sesiones queda mintiendo.

Se verifica que ninguna clave del bloque VERSION este repetida, y que major.minor.patch
coincida con lo que dicen las otras tres fuentes que declaran el numero por su cuenta:
releaseName, el changelog embebido y la entrada de arriba de ZZ_Changelog.js.

[TERCERA VERIFICACION: CERO EMOJIS]
Agregada el 2026-08-30. La Regla Estricta 6 prohibe emojis en codigo, UI, logs, commits y
docs, y ningun banco la comprobaba: en src/ sobrevivian dos, uno de ellos en codigo que CORRE
(logInfo emitia un U+FE0F suelto al principio de cada linea de log). Un emoji no rompe nada
tecnicamente -- por eso ninguna verificacion de sintaxis lo ve --, que es justamente por que
sobrevive anos. Se barren los rangos de pictogramas y dingbats mas el selector de variacion
U+FE0F; las flechas tipograficas (U+2190-U+21FF) quedan fuera a proposito: se usan en la doc
de asignacion de botones de 13_NavigationService.js y no son emojis.

USO:  python3 devtools/verificar_sintaxis.py [archivo.js ...]
      Sin argumentos revisa todos los src/*.js.
      Sale 1 si alguno no parsea: sirve como gate pre-deploy.
"""
import glob
import os
import re
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(RAIZ, 'src')

# Pictogramas, dingbats, simbolos misc y el selector de variacion emoji. NO incluye las
# flechas U+2190-U+21FF ni U+2B00-U+2BFF de bloque de flechas, que son tipografia legitima.
EMOJI = re.compile(
    '[\U0001F000-\U0001FAFF'   # pictogramas, emoticones, transporte, simbolos suplementarios
    '\U0001F004\U0001F0CF'
    '☀-➿'            # simbolos misc y dingbats
    '️'                   # variation selector-16 (presentacion emoji)
    '⭐⭕'             # estrella y circulo pesados
    '〽〰™ℹ]'
)


def verificar_emojis(objetivos):
    """Devuelve [(ruta, linea, caracter)] por cada emoji encontrado. Vacia = limpio."""
    hallados = []
    for ruta in objetivos:
        try:
            texto = open(ruta, encoding='utf-8').read()
        except (OSError, UnicodeDecodeError):
            continue
        for n, linea in enumerate(texto.split('\n'), 1):
            for m in EMOJI.finditer(linea):
                hallados.append((os.path.relpath(ruta, RAIZ), n, m.group()))
    return hallados


def verificar_version():
    """Devuelve la lista de incoherencias del bloque VERSION. Vacia = todo dice lo mismo."""
    ruta = os.path.join(SRC, '01_Version.js')
    if not os.path.exists(ruta):
        return ['no existe src/01_Version.js']
    s = open(ruta, encoding='utf-8').read()

    ini = s.find('const VERSION = {')
    fin = s.find('changelog:', ini)
    if ini < 0 or fin < 0:
        return ['no se encontro el bloque VERSION en src/01_Version.js']

    fallas = []

    # 1. Claves repetidas. Es EL caso que motivo este chequeo: JavaScript no se queja.
    claves = re.findall(r'^\s*([A-Za-z_]\w*)\s*:', s[ini:fin], re.M)
    for k in sorted(set(c for c in claves if claves.count(c) > 1)):
        fallas.append('la clave "%s" esta repetida en el bloque VERSION '
                      '(JavaScript no lo rechaza: gana la ultima)' % k)

    partes = {}
    for k in ('major', 'minor', 'patch'):
        m = re.search(r'^\s*%s:\s*(\d+)\s*,\s*$' % k, s[ini:fin], re.M)
        if not m:
            fallas.append('no se pudo leer "%s" del bloque VERSION' % k)
        partes[k] = m.group(1) if m else '?'
    version = '%s.%s.%s' % (partes['major'], partes['minor'], partes['patch'])

    # 2. releaseName.
    m = re.search(r"releaseName:\s*'v([0-9.]+)", s)
    if not m:
        fallas.append('no se pudo leer releaseName')
    elif m.group(1) != version:
        fallas.append('releaseName dice v%s pero major.minor.patch dan %s'
                      % (m.group(1), version))

    # 3. Cabecera del changelog embebido.
    m = re.search(r'changelog:\s*`\s*\nv([0-9.]+)\s', s)
    if not m:
        fallas.append('el changelog embebido no arranca con una linea de version')
    elif m.group(1) != version:
        fallas.append('el changelog embebido encabeza v%s pero la version es %s'
                      % (m.group(1), version))

    # 4. Entrada de arriba de ZZ_Changelog.js.
    zz = os.path.join(SRC, 'ZZ_Changelog.js')
    if os.path.exists(zz):
        m = re.search(r'^ \* \[\d{4}-\d{2}-\d{2}\] v([0-9.]+)',
                      open(zz, encoding='utf-8').read(), re.M)
        if not m:
            fallas.append('ZZ_Changelog.js no tiene una entrada de version arriba')
        elif m.group(1) != version:
            fallas.append('ZZ_Changelog.js encabeza v%s pero la version es %s'
                          % (m.group(1), version))

    return fallas


def verificar_despliegue():
    """Incoherencias entre lo que el repo DICE que hay desplegado y lo que su codigo ES.

    [POR QUE EXISTE]
    Agregado el 2026-08-30. Las otras verificaciones comparan las cuatro fuentes de la version
    ENTRE SI, y por eso no pudieron ver la cicatriz del dia anterior: se desployo v0.63.1, y
    despues entraron al repo un merge y un fix. Las cuatro fuentes seguian de acuerdo -- todas
    decian "0.63.1" -- pero el repo ya no era el 0.63.1 de la planilla. DOS ARBOLES DISTINTOS
    CON EL MISMO NUMERO. Ninguna de esas cuatro mira produccion, asi que ninguna podia verlo.

    EL INVARIANTE:
        si version_desplegada == la version del repo  =>  el src/ desplegado == el src/ actual
    Leido por el contrapositivo, que es como se usa: si el codigo cambio desde el deploy, el
    numero TIENE que haber cambiado tambien.

    LA FORMULACION POR HEAD NO SIRVE, y conviene dejarlo dicho porque es la primera que se le
    ocurre a cualquiera (fue la propuesta original de la sesion paralela, que encontro el
    defecto): "commit_desplegado == HEAD" da FALSO ROJO en el estado correcto, porque el
    propio commit que registra el deploy en targets.yaml ya mueve HEAD sin tocar una sola
    linea de codigo desplegable. Lo que hay que comparar es el ARBOL de src/, no la identidad
    del commit: asi los commits de docs, de bancos o del propio targets.yaml no molestan.
    """
    ruta = os.path.join(RAIZ, 'targets.yaml')
    if not os.path.exists(ruta):
        return [], False
    t = open(ruta, encoding='utf-8').read()

    mv = re.search(r'^\s*version_desplegada:\s*"([0-9.]+)"', t, re.M)
    mc = re.search(r'^\s*commit_desplegado:\s*"([0-9a-f]{7,40})"', t, re.M)
    if not mv:
        return [], False
    if not mc:
        # targets.yaml sin commit_desplegado: es el formato viejo, no se puede verificar.
        # No se falla -- se avisa, porque un chequeo que no puede correr tiene que decirlo en
        # vez de pasar por verde.
        print('  AVISO: targets.yaml no declara commit_desplegado; el invariante de despliegue')
        print('         no se puede verificar. Agregalo en el proximo deploy.')
        return [], False

    version_repo = _version_del_repo()
    if version_repo is None:
        return [], False
    if mv.group(1) != version_repo:
        # Los numeros difieren: el repo ya declara que no es lo desplegado. El invariante se
        # cumple por su antecedente, y eso SI es una verificacion que corrio.
        return [], True

    r = subprocess.run(['git', 'diff', '--name-only', mc.group(1), '--', 'src/'],
                       cwd=RAIZ, capture_output=True, text=True)
    if r.returncode != 0:
        return (['no se pudo comparar contra el commit %s declarado en targets.yaml (%s)'
                 % (mc.group(1), r.stderr.strip().splitlines()[0] if r.stderr.strip() else '?')],
                False)

    difieren = [l for l in r.stdout.split('\n') if l.strip()]
    if not difieren:
        return [], True
    fallas = ['targets.yaml declara v%s desplegada en %s, y el repo tambien dice v%s -- pero '
              'su src/ YA NO es ese: difieren %d archivo(s).'
              % (mv.group(1), mc.group(1), version_repo, len(difieren))]
    for f in difieren[:8]:
        fallas.append('    %s' % f)
    if len(difieren) > 8:
        fallas.append('    ... y %d mas' % (len(difieren) - 8))
    fallas.append('Dos codigos distintos con el mismo numero. O subis la version del repo, o '
                  'deployas y actualizas targets.yaml.')
    return fallas, True


def _version_del_repo():
    """major.minor.patch de src/01_Version.js, o None si no se puede leer."""
    ruta = os.path.join(SRC, '01_Version.js')
    if not os.path.exists(ruta):
        return None
    s = open(ruta, encoding='utf-8').read()
    ini = s.find('const VERSION = {')
    if ini < 0:
        return None
    partes = []
    for k in ('major', 'minor', 'patch'):
        m = re.search(r'^\s*%s:\s*(\d+)\s*,\s*$' % k, s[ini:s.find('changelog:', ini)], re.M)
        if not m:
            return None
        partes.append(m.group(1))
    return '.'.join(partes)


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

    emojis = verificar_emojis(objetivos)
    if emojis:
        print('Los %d archivo(s) parsean, PERO hay %d emoji(s) en src/ (Regla Estricta 6).'
              % (len(objetivos), len(emojis)))
        print('')
        for ruta, linea, ch in emojis:
            print('  %s:%d  %r (U+%04X)' % (ruta, linea, ch, ord(ch)))
        print('')
        print('La regla vale para codigo, UI, logs, commits y docs. Un emoji en un Logger.log')
        print('viaja a la consola de Apps Script en cada ejecucion.')
        return 1

    # La segunda verificacion solo tiene sentido sobre src/ entero, no sobre
    # una lista suelta de archivos pasada a mano.
    if len(argv) > 1:
        print('Los %d archivos indicados parsean, y sin emojis.' % len(objetivos))
        return 0

    fallas_despliegue, despliegue_verificado = verificar_despliegue()
    incoherencias = verificar_version() + fallas_despliegue
    if incoherencias:
        print('Los %d archivos de src/ parsean, PERO la version es incoherente.' % len(objetivos))
        print('')
        for f in incoherencias:
            print('  %s' % f)
        print('')
        print('NO DEPLOYAR: targets.yaml es la referencia del drift-check. Si la version que')
        print('la planilla reporta no es la que el repo cree haber desplegado, el mecanismo')
        print('que evita que dos sesiones se pisen queda mintiendo.')
        return 1

    cierre = (', y el repo no se llama igual que lo desplegado.' if despliegue_verificado
              else '. El invariante de despliegue NO se pudo verificar (ver aviso).')
    print('Los %d archivos de src/ parsean, sin emojis, la version es coherente en las cuatro '
          'fuentes%s' % (len(objetivos), cierre))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
