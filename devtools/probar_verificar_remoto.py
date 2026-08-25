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

print('\n' + ('TODO EN VERDE (7 secciones)' if fallas == 0
              else '%d PRUEBA(S) FALLARON' % fallas))
sys.exit(0 if fallas == 0 else 1)
