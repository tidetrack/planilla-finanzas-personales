#!/usr/bin/env python3
"""Decide si el remoto de Apps Script es EXACTAMENTE un commit de este repo.

[CONCEPTO DE NEGOCIO]
`sync_targets.command` pide escribir "pisar" cuando el remoto difiere de src/. Esa palabra
existe para que un humano conteste una sola pregunta: **estoy por sobreescribir trabajo que
no esta en el repo?** Es la pregunta correcta -- este repo descubrio de la peor manera que la
produccion puede ir adelante -- pero hasta hoy se contestaba mirando un diff a ojo.

Esa pregunta es mecanica y este script la contesta. Si el contenido del remoto coincide, byte
a byte, con el src/ de ALGUN commit alcanzable del repo, entonces nadie edito en el editor de
Apps Script: el remoto es una version nuestra, mas vieja, y "pisarlo" es simplemente
desplegar. No hay nada que adjudicar. Si NO coincide con ningun commit, hay contenido que el
repo nunca vio: ahi si frena y decide una persona.

[FUNDAMENTO TEORICO / ADMINISTRATIVO]
No compara contenidos: compara HASHES DE BLOB de git. Para cada archivo del pull calcula el
sha1 que git le asignaria (sha1 de "blob <largo>\\0<contenido>") y lo cruza contra lo que
`git ls-tree` reporta para src/ en cada commit. Es exacto y no requiere leer el arbol de cada
commit desde disco.

Un fallo de este script NUNCA se lee como "esta todo bien": si algo sale mal devuelve 2 y el
que lo llama tiene que tratarlo como no verificado. El unico exito es el 0.

USO:  python3 devtools/verificar_remoto.py <dir_del_pull> [--max-commits N]

SALIDA (exit code):
  0  el remoto es exactamente un commit del repo (lo imprime). Deployar es seguro.
  1  el remoto NO coincide con ningun commit: hay trabajo ajeno. Decide una persona.
  2  no se pudo verificar. Se trata como el caso 1, por prudencia.

@version 0.1.0
@since 2026-08-25
@see sync_targets.command
"""
import hashlib
import os
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Lo que clasp deja en el pull y no es codigo del repo.
IGNORAR = {'.clasp.json', 'pull.log', 'diff.log', '.DS_Store'}


def sha_de_blob(ruta):
    """El sha1 que git le daria a este archivo. Mismo algoritmo que `git hash-object`."""
    with open(ruta, 'rb') as f:
        datos = f.read()
    h = hashlib.sha1()
    h.update(b'blob %d\0' % len(datos))
    h.update(datos)
    return h.hexdigest()


def git(*args):
    r = subprocess.run(['git'] + list(args), cwd=RAIZ,
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError('git ' + ' '.join(args) + ': ' + r.stderr.strip())
    return r.stdout


def huella_del_pull(dir_pull):
    """{nombre_de_archivo: sha_de_blob} de lo que bajo del remoto."""
    huella = {}
    for nombre in os.listdir(dir_pull):
        if nombre in IGNORAR or nombre.startswith('.'):
            continue
        ruta = os.path.join(dir_pull, nombre)
        if os.path.isfile(ruta):
            huella[nombre] = sha_de_blob(ruta)
    return huella


def huella_del_commit(commit):
    """{nombre_de_archivo: sha_de_blob} del src/ de un commit, leido de git."""
    huella = {}
    for linea in git('ls-tree', '-r', commit + ':src').splitlines():
        # formato: <modo> blob <sha>\t<nombre>
        meta, _, nombre = linea.partition('\t')
        partes = meta.split()
        if len(partes) >= 3 and partes[1] == 'blob':
            if nombre in IGNORAR or '/' in nombre:
                continue
            huella[nombre] = partes[2]
    return huella


def main(argv):
    if len(argv) < 2:
        sys.stderr.write('USO: verificar_remoto.py <dir_del_pull> [--max-commits N]\n')
        return 2

    dir_pull = argv[1]
    if not os.path.isdir(dir_pull):
        sys.stderr.write('No existe el directorio del pull: %s\n' % dir_pull)
        return 2

    tope = 400
    if '--max-commits' in argv:
        try:
            tope = int(argv[argv.index('--max-commits') + 1])
        except (IndexError, ValueError):
            sys.stderr.write('--max-commits necesita un numero\n')
            return 2

    try:
        remoto = huella_del_pull(dir_pull)
        if not remoto:
            sys.stderr.write('El pull no tiene archivos: no se verifica nada.\n')
            return 2

        # Se recorren los commits ALCANZABLES DESDE CUALQUIER RAMA (--all), no solo la actual:
        # el remoto bien puede ser un commit de otra rama que se deployo antes.
        commits = git('log', '--all', '--format=%H', '-n', str(tope)).split()
        if not commits:
            sys.stderr.write('El repo no tiene commits.\n')
            return 2

        for commit in commits:
            try:
                if huella_del_commit(commit) == remoto:
                    corto = git('log', '-1', '--format=%h %s', commit).strip()
                    print(corto)
                    return 0
            except RuntimeError:
                # Un commit sin src/ (o cualquier otro problema puntual) no invalida la
                # busqueda: se saltea y se siguen mirando los demas.
                continue

        return 1
    except Exception as e:
        sys.stderr.write('No se pudo verificar: %s\n' % e)
        return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv))
