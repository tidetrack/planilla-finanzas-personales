# Servidor local del shell

El Centro de Operaciones corriendo fuera de Google Sheets, para probarlo en un navegador de
verdad sin desplegar nada.

`index.html` es `src/UI_Shell.html` con tres cosas resueltas:

- el `include('UI_SharedStyles')` y los scriptlets de HtmlService, ya expandidos;
- `google.script.run` reemplazado por un doble que devuelve el catalogo REAL de la planilla
  (sacado del gemelo digital) **con la latencia medida en vivo**: 537 ms para el catalogo,
  900 ms para una escritura. Asi lo que se prueba son los tiempos de verdad, no una maqueta;
- nada escribe en la planilla.

## Correrlo

    cd devtools/servidor_shell && python3 -m http.server 8765

y abrir http://localhost:8765

## Regenerarlo despues de tocar el shell

Este archivo es una COPIA: no se edita a mano. Cuando cambie `src/UI_Shell.html` hay que
volver a generarlo, o se prueba una version vieja creyendo que es la nueva -- que es
exactamente la clase de error que este repo ya pago tres veces.

    python3 devtools/regenerar_servidor_shell.py
