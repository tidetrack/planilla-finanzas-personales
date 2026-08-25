#!/usr/bin/env python3
"""Banco de pruebas de devtools/verificar_remoto.py.

Este verificador decide si se puede pisar la planilla productiva SIN preguntarle a nadie, asi
que su unico modo de falla inaceptable es el FALSO POSITIVO: decir "es un commit nuestro"
cuando el remoto tiene contenido que el repo no vio. Por eso el banco insiste en las tres
maneras de que eso pase -- un archivo modificado, uno de mas, uno de menos -- y en que
cualquier problema devuelva 2 y nunca 0.

Las pruebas corren contra la HISTORIA REAL de este repo (git archive de commits verdaderos),
no contra un arbol inventado.

USO:  python3 devtools/probar_verificar_remoto.py     (exit 0 si pasa, 1 si algo sale mal)

@version 0.1.0
@since 2026-08-25
@see devtools/verificar_remoto.py
"""
import os
import shutil
import subprocess
import sys
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERIF = os.path.join(RAIZ, 'devtools', 'verificar_remoto.py')

fallas = 0


def ok(cond, msg):
    global fallas
    if cond:
        print('  OK  ' + msg)
    else:
        print('  !!! ' + msg)
        fallas += 1


def seccion(t):
    print('\n== ' + t + ' ==')


def correr(dir_pull):
    """Devuelve (exit_code, stdout)."""
    r = subprocess.run([sys.executable, VERIF, dir_pull],
                       capture_output=True, text=True, cwd=RAIZ)
    return r.returncode, r.stdout.strip()


def correr_con_error(dir_pull):
    """Devuelve (exit_code, stderr). El diagnostico del verificador va a stderr."""
    r = subprocess.run([sys.executable, VERIF, dir_pull],
                       capture_output=True, text=True, cwd=RAIZ)
    return r.returncode, r.stderr.strip()


def arbol_de(commit):
    """Materializa el src/ de un commit real en un directorio temporal."""
    d = tempfile.mkdtemp()
    p = subprocess.run(['git', 'archive', commit, 'src'], cwd=RAIZ, capture_output=True)
    t = subprocess.run(['tar', '-x', '-C', d, '--strip-components=1'],
                       input=p.stdout, capture_output=True)
    if t.returncode != 0:
        raise RuntimeError('no se pudo materializar ' + commit)
    return d


def commits(n):
    r = subprocess.run(['git', 'log', '--format=%H', '-n', str(n)],
                       cwd=RAIZ, capture_output=True, text=True)
    return r.stdout.split()


print('BANCO: devtools/verificar_remoto.py')
lista = commits(6)
print('  probando contra %d commits reales de la historia' % len(lista))

seccion('1. Un commit real se reconoce, y se reconoce EL correcto')
for c in lista[:4]:
    d = arbol_de(c)
    try:
        rc, salida = correr(d)
        ok(rc == 0, 'commit %s reconocido (exit 0)' % c[:7])
        # NO se exige el mismo hash: varios commits pueden compartir el mismo src/ (los
        # `chore` y los `docs` no lo tocan), y el verificador devuelve el mas reciente de
        # ellos. Lo que importa, y lo unico que el deploy necesita, es que el arbol src/
        # del commit devuelto sea IDENTICO al que se pidio reconocer.
        devuelto = salida.split()[0] if salida else ''
        mismo_arbol = devuelto and (
            subprocess.run(['git', 'rev-parse', devuelto + ':src'], cwd=RAIZ,
                           capture_output=True, text=True).stdout.strip()
            == subprocess.run(['git', 'rev-parse', c + ':src'], cwd=RAIZ,
                              capture_output=True, text=True).stdout.strip())
        ok(bool(mismo_arbol),
           '  y el commit devuelto tiene el MISMO src/ ("%s")' % salida[:52])
    finally:
        shutil.rmtree(d, ignore_errors=True)

seccion('2. FALSO POSITIVO: un archivo MODIFICADO no puede pasar')
d = arbol_de(lista[0])
try:
    with open(os.path.join(d, '00_Config.js'), 'a') as f:
        f.write('\n// alguien edito esto en el editor de Apps Script\n')
    rc, _ = correr(d)
    ok(rc == 1, 'un archivo tocado da 1 (hay trabajo ajeno), nunca 0')
finally:
    shutil.rmtree(d, ignore_errors=True)

seccion('3. FALSO POSITIVO: un archivo DE MAS no puede pasar')
d = arbol_de(lista[0])
try:
    with open(os.path.join(d, '99_HechoEnElEditor.js'), 'w') as f:
        f.write('function algoQueElRepoNoTiene() {}\n')
    rc, _ = correr(d)
    ok(rc == 1, 'un archivo que el repo no tiene da 1')
finally:
    shutil.rmtree(d, ignore_errors=True)

seccion('4. FALSO POSITIVO: un archivo DE MENOS no puede pasar')
d = arbol_de(lista[0])
try:
    os.remove(os.path.join(d, '02_Utils.js'))
    rc, _ = correr(d)
    ok(rc == 1, 'un archivo borrado del remoto da 1')
finally:
    shutil.rmtree(d, ignore_errors=True)

seccion('5. Ante cualquier problema devuelve 2, jamas 0')
rc, _ = correr('/directorio/que/no/existe')
ok(rc == 2, 'directorio inexistente -> 2')
d = tempfile.mkdtemp()
try:
    rc, _ = correr(d)
    ok(rc == 2, 'directorio vacio -> 2 (no se verifica nada, no se declara nada)')
finally:
    shutil.rmtree(d, ignore_errors=True)

seccion('6. El .clasp.json del pull no cuenta como contenido')
d = arbol_de(lista[0])
try:
    with open(os.path.join(d, '.clasp.json'), 'w') as f:
        f.write('{"scriptId":"loQueSea","rootDir":"src"}')
    rc, _ = correr(d)
    ok(rc == 0, 'el archivo que deja clasp se ignora y el commit igual se reconoce')
finally:
    shutil.rmtree(d, ignore_errors=True)

seccion('7. sync_targets.command usa el verificador y no pregunta ante "adelante"')
sync = open(os.path.join(RAIZ, 'sync_targets.command'), encoding='utf-8').read()
ok('verificar_remoto.py' in sync, 'el script de deploy invoca al verificador')
ok('adelante' in sync, 'existe el estado "adelante"')
ok('!= "adelante"' in sync,
   'el prompt de "pisar" se saltea cuando el remoto es un commit del repo')
ok('--verificado' in sync, 'existe el flag --verificado')
ok('exit 4' in sync,
   '--verificado ABORTA (exit 4) si algun target no verifica, en vez de seguir de largo')

seccion('8. Si el mismo src/ vive en varios commits, gana el que ESTA en mi historia')
# Un commit que solo toca devtools/ o docs/ deja el src/ IDENTICO al anterior, asi que
# varios commits comparten arbol -- y algunos son de la otra rama. Quedarse con el primero
# que coincida y preguntarle si es ancestro declara "la produccion va adelante" cuando el
# mismo contenido tambien esta en la propia historia, y bloquea un deploy legitimo. Paso de
# verdad el 2026-08-25: el src/ del HEAD propio no se reconocia porque un commit ajeno con
# el mismo arbol aparecia antes en `git log --all`.
d = arbol_de('HEAD')
try:
    rc, salida = correr(d)
    ok(rc == 0, 'el src/ del propio HEAD se reconoce (exit 0), no importa cuantos commits '
                'compartan ese arbol')
    if rc == 0 and salida:
        sha = salida.split()[0]
        es_ancestro = subprocess.run(['git', 'merge-base', '--is-ancestor', sha, 'HEAD'],
                                     cwd=RAIZ, capture_output=True).returncode == 0
        ok(es_ancestro, '  y el commit que devuelve ES ancestro del HEAD ("%s")' % salida[:60])
    else:
        ok(False, '  y el commit que devuelve ES ancestro del HEAD')
finally:
    shutil.rmtree(d, ignore_errors=True)

seccion('9. Cuando NADA coincide, el diagnostico dice a que se parece y que comando corre')
# Bloquear sin decir que hacer manda a resolverlo a ojo, que es justo lo que este script
# existe para evitar. El mensaje generico "tiene contenido propio" fue un callejon sin
# salida el 2026-08-25, cuando la produccion era un commit de la otra rama con UN archivo
# de diferencia y no habia forma de saberlo sin comparar a mano.
d = arbol_de('HEAD')
try:
    with open(os.path.join(d, '01_Version.js'), 'a', encoding='utf-8') as f:
        f.write('\n// editado a mano en el editor de Apps Script\n')
    rc, err = correr_con_error(d)
    ok(rc == 1, 'un remoto que no coincide con nada da 1')
    ok('difiere en 1 archivo' in err, '  y dice EN CUANTOS archivos difiere')
    ok('01_Version.js' in err, '  y nombra el archivo que difiere')
    ok('git merge' in err, '  y da el comando exacto que destraba')
finally:
    shutil.rmtree(d, ignore_errors=True)

print('\n' + ('TODO EN VERDE (9 secciones)' if fallas == 0
              else '%d PRUEBA(S) FALLARON' % fallas))
sys.exit(0 if fallas == 0 else 1)
