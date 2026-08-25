#!/usr/bin/env python3
"""Decide si el remoto de Apps Script es EXACTAMENTE un commit de este repo.

[CONCEPTO DE NEGOCIO]
`sync_targets.command` pide escribir "pisar" cuando el remoto difiere de src/. Esa palabra
existe para que un humano conteste una sola pregunta: **estoy por sobreescribir trabajo que
no esta en el repo?** Es la pregunta correcta -- este repo descubrio de la peor manera que la
produccion puede ir adelante -- pero hasta hoy se contestaba mirando un diff a ojo.

Esa pregunta es mecanica y este script la contesta. Si el contenido del remoto coincide, byte
a byte, con el src/ de ALGUN commit alcanzable del repo, entonces nadie edito en el editor de
Apps Script. Pero son DOS preguntas, no una, y esa distincion costo un incidente real el
2026-08-25:

  1. El remoto es un commit de este repo? (nadie edito en el editor de Apps Script)
  2. Ese commit es ANCESTRO del HEAD local? (pushear va hacia adelante, no hacia atras)

La primera sola NO alcanza. Un commit puede ser perfectamente conocido y aun asi estar MAS
ADELANTE que el HEAD local: por ejemplo cuando OTRA RAMA del mismo repo deployo despues. Ese
dia el remoto tenia v0.51.1 desde otra rama, este script contesto "es un commit conocido,
segui", y el deploy saco de produccion tres modulos que estaban andando. Verificar identidad
sin verificar direccion es exactamente la mitad del trabajo, y la mitad que falta es la que
rompe.

Ahora se exigen las dos. Si el commit del remoto no es ancestro del HEAD, devuelve 1: no hay
trabajo ajeno, pero pushear RETROCEDERIA la produccion, y eso lo decide una persona.

[FUNDAMENTO TEORICO / ADMINISTRATIVO]
No compara contenidos: compara HASHES DE BLOB de git. Para cada archivo del pull calcula el
sha1 que git le asignaria (sha1 de "blob <largo>\\0<contenido>") y lo cruza contra lo que
`git ls-tree` reporta para src/ en cada commit. Es exacto y no requiere leer el arbol de cada
commit desde disco.

Un fallo de este script NUNCA se lee como "esta todo bien": si algo sale mal devuelve 2 y el
que lo llama tiene que tratarlo como no verificado. El unico exito es el 0.

USO:  python3 devtools/verificar_remoto.py <dir_del_pull> [--max-commits N]

SALIDA (exit code):
  0  el remoto es un commit del repo Y es ancestro del HEAD local. Deployar avanza: es seguro.
  1  no se puede deployar solo. Dos casos, y el mensaje de error los distingue:
       a) el remoto no coincide con ningun commit -> hay trabajo ajeno;
       b) coincide pero NO es ancestro del HEAD -> la produccion va ADELANTE y pushear
          la haria retroceder. Hay que mergear primero.
     En AMBOS casos el diagnostico va a stderr y nombra la rama y el comando exacto a
     correr. Un guard que bloquea sin decir que hacer manda al que lo lee a resolverlo a
     ojo, que es justo lo que este script existe para evitar.
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


def ramas_que_contienen(commit):
    """Ramas (locales y remotas) que contienen ese commit, mas legibles primero."""
    try:
        salida = git('branch', '--all', '--contains', commit, '--format=%(refname:short)')
    except RuntimeError:
        return []
    ramas = [r.strip() for r in salida.splitlines() if r.strip() and '->' not in r]
    # Preferir la rama local sobre su espejo en origin: es la que se mergea.
    locales = [r for r in ramas if not r.startswith('origin/')]
    return locales + [r for r in ramas if r.startswith('origin/')]


def sugerir_merge(commit, motivo):
    """Escribe a stderr que es lo desplegado y cual es el comando que destraba."""
    try:
        corto = git('log', '-1', '--format=%h %s', commit).strip()
    except RuntimeError:
        corto = commit[:7]
    sys.stderr.write(motivo + '\n')
    sys.stderr.write('  desplegado = ' + corto + '\n')
    ramas = ramas_que_contienen(commit)
    if ramas:
        sys.stderr.write('  vive en: ' + ', '.join(ramas[:4]) + '\n')
        destino = ramas[0]
        sys.stderr.write('  para destrabarlo:  git fetch --all && git merge ' + destino + '\n')
    else:
        sys.stderr.write('  ninguna rama lo contiene todavia (es un commit suelto).\n')
        sys.stderr.write('  para destrabarlo:  git merge ' + commit[:12] + '\n')


def diagnosticar_parecido(remoto, commits):
    """Cuando NADA coincide exacto, decir a QUE se parece y en que difiere.

    Es la diferencia entre "tiene contenido propio" -- un callejon sin salida -- y "es tal
    commit de tal rama mas un archivo cambiado". El 2026-08-25 la produccion era exactamente
    un commit de la otra rama con UN archivo de diferencia, y el mensaje generico no daba
    forma de saberlo: obligaba a bajar el remoto a mano y comparar archivo por archivo.
    """
    mejor, mejor_dif = None, None
    for commit in commits:
        try:
            h = huella_del_commit(commit)
        except RuntimeError:
            continue
        if not h:
            continue
        dif = set(n for n in set(h) | set(remoto) if h.get(n) != remoto.get(n))
        if mejor_dif is None or len(dif) < len(mejor_dif):
            mejor, mejor_dif = commit, dif
            if not dif:
                break
    if mejor is None:
        sys.stderr.write('El remoto no coincide con ningun commit del repo, y no se pudo '
                         'encontrar ninguno parecido.\n')
        return
    sugerir_merge(mejor, 'El remoto no coincide EXACTO con ningun commit, pero lo mas '
                         'parecido difiere en %d archivo(s):' % len(mejor_dif))
    for nombre in sorted(mejor_dif)[:12]:
        sys.stderr.write('    - ' + nombre + '\n')
    if len(mejor_dif) > 12:
        sys.stderr.write('    ... y %d mas\n' % (len(mejor_dif) - 12))


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

        # VARIOS commits pueden tener el MISMO src/: un commit que solo toca devtools/ o
        # docs/ no cambia el arbol que se despliega. Por eso no alcanza con quedarse con el
        # primero que coincida y preguntarle si es ancestro -- si el primero resulta ser el
        # de otra rama, se declara "la produccion va adelante" cuando el MISMO contenido
        # tambien esta en la propia historia. La pregunta correcta es si ese contenido esta
        # en algun lado de mi historia, no si el primer commit que aparecio lo esta.
        ajeno = None
        for commit in commits:
            try:
                if huella_del_commit(commit) != remoto:
                    continue
            except RuntimeError:
                # Un commit sin src/ (o cualquier otro problema puntual) no invalida la
                # busqueda: se saltea y se siguen mirando los demas.
                continue
            # SEGUNDA PREGUNTA: el remoto va hacia atras o hacia adelante? Un contenido
            # conocido que NO esta en la historia del HEAD significa que la produccion
            # esta MAS ADELANTE que lo que se quiere pushear.
            es_ancestro = subprocess.run(
                ['git', 'merge-base', '--is-ancestor', commit, 'HEAD'],
                cwd=RAIZ, capture_output=True).returncode == 0
            if es_ancestro:
                print(git('log', '-1', '--format=%h %s', commit).strip())
                return 0
            if ajeno is None:
                ajeno = commit

        if ajeno is not None:
            sugerir_merge(
                ajeno,
                'El remoto ES un commit del repo pero NO es ancestro del HEAD local: la '
                'produccion va ADELANTE y pushear la haria retroceder.')
            return 1

        diagnosticar_parecido(remoto, commits)
        return 1
    except Exception as e:
        sys.stderr.write('No se pudo verificar: %s\n' % e)
        return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv))
