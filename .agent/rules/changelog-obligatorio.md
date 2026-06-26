# Regla Obligatoria: Actualizacion de Changelog Iterativo

## Contexto
Por solicitud y diseno estricto de Franco, toda modificacion o iteracion realizada sobre los documentos del proyecto (particularmente codigo en `src/` o redaccion de documentos principales) DEBE quedar registrada.

## Obligacion de los Agentes
1. Al terminar de programar, editar o refactorizar los cambios de una iteracion, el agente a cargo tiene el DEBER OBLIGATORIO de actualizar dos archivos simultaneamente:
   - `src/ZZ_Changelog.js` (registrando tecnica y concisamente los cambios al tope de los comentarios, autoincrementando la version usando reglas de SemVer para features o bugs, e iteraciones simples cuando sean ajustes menores).
   - `docs/permanente/HISTORIAL_DESARROLLO.md` (anadiendo el resumen cronologico global y extendido para su lectura rapida).

2. Esta actualizacion debe ocurrir PREVIO a cerrar el requerimiento o cederle el control final a Franco o al skill de Github para su despliegue.

3. Se debe recurrir internamente a las logicas del skill `@auto-changelog` para respetar al 100% los formatos dictaminados. No se da por validada una respuesta final a Franco sin que los changelogs se encuentren modificados en la misma intervencion.

4. En el ecosistema Claude Code, el agente responsable directo de esta regla es `docs-keeper`. Cualquier otro agente que cierre una tarea con cambios en `src/` debe invocarlo o ejecutar el doble registro antes de reportar.
