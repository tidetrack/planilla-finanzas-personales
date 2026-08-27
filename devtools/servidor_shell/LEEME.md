# Servidor local del shell

El Centro de Operaciones corriendo fuera de Google Sheets, para probarlo en un navegador de
verdad sin desplegar nada.

## Los dos archivos generados

`index.html` es el MARCO: simula el dialogo de Google Sheets donde vive el shell de verdad
-- 900x700 fijos (`src/16_ShellService.js`, `SHELL_GEOMETRIA`), barra de titulo vacia, la "x"
a la derecha -- con el shell adentro en un iframe. Si la ventana es mas chica, se escala el
dialogo entero; el area del shell no se toca nunca, porque achicarla cambiaria su layout
(breakpoint de 700px en `src/UI_Shell.html`) y se estaria mirando una pantalla que en
produccion no existe.

Sin el marco, el shell servido a pantalla completa estira la banda y el pie al ancho de la
ventana y pierde la barra de scroll que el usuario real si tiene: se juzga una pantalla que
no existe.

`shell.html` es `src/UI_Shell.html` con tres cosas resueltas:

- el `include('UI_SharedStyles')` y los scriptlets de HtmlService, ya expandidos;
- `google.script.run` reemplazado por un doble (`doble.js`) que devuelve el catalogo REAL de
  la planilla (sacado del gemelo digital) **con la latencia medida en vivo**: 537 ms para el
  catalogo, 900 ms para una escritura. Asi lo que se prueba son los tiempos de verdad, no una
  maqueta;
- nada escribe en la planilla.

## Que se edita y que no

Se editan a mano TRES archivos: `servidor.py`, `doble.js` y `marco.html`.
`index.html` y `shell.html` son GENERADOS y no se tocan: lo que se edita es
`src/UI_Shell.html` y `marco.html`.

## Correrlo

    python3 devtools/servidor_shell/servidor.py

y abrir <http://localhost:8765> para la simulacion del modal, o
<http://localhost:8765/shell.html> para el shell a pantalla completa, que es comodo para
abrir el inspector sin pelear con el iframe. Se le puede pasar otro puerto como argumento.

NO se usa `python3 -m http.server`: en Python 3.9 ese modulo llama a `os.getcwd()` al
importarse como __main__, para el default de `--directory`, y esa llamada ocurre se pase o no
el flag. Si el proceso arranca en un directorio cuyo padre no es accesible -- el caso del
sandbox de esta maquina -- muere con `PermissionError` antes de escuchar. `servidor.py` deriva
el directorio de `__file__` y no llama a getcwd() ni una vez.

## Regenerarlo despues de tocar el shell

Los dos .html son COPIAS: no se editan a mano. Cuando cambie `src/UI_Shell.html`,
`marco.html` o `doble.js` hay que volver a generarlos, o se prueba una version vieja creyendo
que es la nueva -- que es exactamente la clase de error que este repo ya pago tres veces.

    python3 devtools/regenerar_servidor_shell.py

Acepta directorios destino extra como argumentos y escribe LOS DOS archivos en cada uno. Si
el servidor corre desde el scratchpad (`.claude/launch.json`), hay que pasarle ese directorio
o la copia servida queda vieja en silencio.

El generador corta con exit 1, sin escribir nada, en tres casos: si el doble no implementa
alguna funcion que el shell llama por `google.script.run`; si `marco.html` perdio alguno de
sus huecos (`{{ANCHO}}`, `{{ALTO}}`, `{{SHELL_SRC}}`) donde corresponde, que es la forma en
que alguien hardcodearia la geometria; y si queda un scriptlet sin resolver.
