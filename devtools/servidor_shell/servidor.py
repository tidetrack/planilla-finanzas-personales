#!/usr/bin/env python3
"""Sirve el shell en localhost, sin pasar por `python3 -m http.server`.

POR QUE NO SE USA EL MODULO DIRECTO: en Python 3.9, `http/server.py` construye su parser al
importarse como __main__ y pone `default=os.getcwd()` en el argumento --directory. Esa llamada
ocurre SIEMPRE, se pase o no el flag. Si el proceso arranca en un directorio cuyo padre no es
accesible -- el caso del sandbox de esta maquina -- `getcwd()` tira
`PermissionError: Operation not permitted` y el servidor muere antes de escuchar. Tampoco
alcanza con hacer `cd` antes: el shell falla en su propio init por la misma razon.

Aca el directorio se deriva de __file__ y se pasa explicito al handler, asi que no hay una sola
llamada a getcwd() en todo el arranque.

EL PUERTO se toma, en este orden: el argumento de linea de comandos, la variable de entorno
PORT, y si no 8765. La variable PORT existe para que el arrancador de preview de Claude Code
pueda asignar uno libre en vez de pelearse por un numero fijo.

USO:  python3 devtools/servidor_shell/servidor.py [puerto]
      Despues, abrir http://localhost:<puerto>
"""
import functools
import http.server
import os
import socketserver
import sys

PUERTO_DEFECTO = 8765

# dirname(__file__) y no abspath(): abspath llama a getcwd() cuando la ruta es relativa, que es
# exactamente lo que no se puede hacer aca. Si __file__ vino relativo, se resuelve contra la
# ruta del propio script tal como la invocaron, sin preguntarle al sistema donde estamos.
DIRECTORIO = os.path.dirname(__file__) or '.'


class Silencioso(http.server.SimpleHTTPRequestHandler):
    """Sin cache: si no, se prueba una version vieja del shell creyendo que es la nueva."""

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    def log_message(self, formato, *args):
        sys.stderr.write('  %s\n' % (formato % args))


def main(argv):
    crudo = argv[1] if len(argv) > 1 else os.environ.get('PORT') or PUERTO_DEFECTO
    try:
        puerto = int(crudo)
    except (TypeError, ValueError):
        sys.stderr.write('El puerto tiene que ser un numero, y llego "%s".\n' % crudo)
        return 2

    indice = os.path.join(DIRECTORIO, 'index.html')
    if not os.path.exists(indice):
        sys.stderr.write(
            'No existe %s.\nRegeneralo con: python3 devtools/regenerar_servidor_shell.py\n'
            % indice)
        return 1

    handler = functools.partial(Silencioso, directory=DIRECTORIO)
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(('127.0.0.1', puerto), handler) as httpd:
            sys.stderr.write('Shell servido en http://localhost:%d\n' % puerto)
            httpd.serve_forever()
    except OSError as e:
        sys.stderr.write('No se pudo abrir el puerto %d: %s\n' % (puerto, e))
        return 1
    except KeyboardInterrupt:
        sys.stderr.write('\nServidor detenido.\n')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
