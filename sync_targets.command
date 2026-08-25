#!/bin/bash
# sync_targets.command - Deploy con red de seguridad para Tidetrack Finanzas Personales
#
# [CONCEPTO DE NEGOCIO]
# Este script es la UNICA via sancionada para subir codigo de src/ a la planilla
# productiva de Apps Script. Lee los targets de deploy desde targets.yaml (fuente
# unica de verdad creada en la Fase 0 del arnes), verifica drift contra el remoto
# antes de tocar nada, y exige confirmacion humana explicita. Nunca clasp push a
# ciegas: cada push queda precedido por una foto del estado remoto.
#
# [FUNDAMENTO TEORICO / ADMINISTRATIVO]
# Portado de planilla-pymes/legacy/sync_clients.command (campana Castellino
# v1.9-v1.47), donde la mecanica de backup + trap + confirmacion evito que
# .clasp.json quedara apuntando a un cliente productivo tras una interrupcion.
# La mejora local es el drift-check integrado (arnes seccion 3, pieza 8): un
# clasp pull a directorio temporal + diff contra src/ detecta que remoto y
# local difieren ANTES de sobrescribir el remoto. El diff no distingue la
# direccion del cambio: puede ser el caso normal (el repo va adelante y el push
# es el objetivo) o el peligroso (el remoto fue editado a mano); por eso ante
# drift el operador debe escribir "pisar" para ese target — es su declaracion
# de que sabe cual de los dos casos es. Cualquier otra respuesta lo saltea.
# El flag --dry-run corre todo el analisis sin pushear (exit 0 sin drift,
# exit 3 con drift o verificacion fallida: apto para CI y prueba en seco).
#
# El flag --verificado (2026-08-25) atiende un caso concreto: "pisar" existe para
# que una persona conteste UNA pregunta -- estoy sobreescribiendo trabajo que el
# repo no tiene? -- y esa pregunta es MECANICA. devtools/verificar_remoto.py la
# contesta comparando los hashes de blob del remoto contra el src/ de cada commit
# alcanzable: si el remoto ES un commit nuestro, nadie edito por afuera y pisarlo
# es simplemente desplegar. Con --verificado el script deploya sin preguntar SOLO
# si TODOS los targets quedaron en "sin drift" o en "local adelante"; si alguno
# tiene contenido que el repo nunca vio, o si la verificacion falla, ABORTA en vez
# de preguntar. Es deliberado: en modo no interactivo no hay nadie para contestar,
# y un flag que ante la duda sigue de largo seria peor que no tenerlo.
#
# @see docs/permanente/ARNES_TIDETRACK.md (seccion 3 Fase 1, seccion 9, seccion 12)
#
# decision Franco 2026-08-12: deploy solo por script con drift-check, portado de pymes sync_clients.command (Fase 1 arnes)

set -u

# --- Flags ---
DRY_RUN=0
VERIFICADO=0
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        --verificado) VERIFICADO=1 ;;
        *) echo "AVISO: argumento desconocido '$arg' (se aceptan --dry-run y --verificado). Se ignora." ;;
    esac
done

echo "Iniciando despliegue con red de seguridad de Tidetrack (finanzas personales)..."
if [ "$DRY_RUN" -eq 1 ]; then
    echo "Modo DRY RUN: se analiza todo pero no se pushea nada."
fi
if [ "$VERIFICADO" -eq 1 ]; then
    echo "Modo VERIFICADO: sin preguntas, y solo si el remoto resulta ser un commit del repo."
fi

# Navegar al directorio del propio script (vive en la RAIZ del repo).
# A diferencia del original de pymes (que vivia en /legacy/), aca src/ cuelga
# directo de la raiz: no hay que bajar a ningun subdirectorio.
cd "$(dirname "$0")" || { echo "Error: No se pudo navegar al directorio del proyecto."; exit 1; }

REPO_DIR="$(pwd)"
TARGETS_FILE="$REPO_DIR/targets.yaml"
SRC_DIR="$REPO_DIR/src"

if [ ! -f "$TARGETS_FILE" ]; then
    echo "Error: No se encontro $TARGETS_FILE (fuente de verdad de targets de deploy)."
    exit 1
fi

if [ ! -d "$SRC_DIR" ]; then
    echo "Error: No se encontro el directorio src/ junto al script."
    exit 1
fi

echo "Ubicacion: $REPO_DIR"
echo "----------------------------------------------"

# --- Leer targets activos desde targets.yaml ---
# Formato real: lista bajo "targets:", cada entrada arranca con "- nombre: ..."
# y sus campos (estado, script_id) van indentados debajo. El script_id viene
# entre comillas dobles. Parseo secuencial linea a linea (estilo del original,
# sed/grep puros, sin dependencias nuevas): agrupar por entrada evita el
# desalineado de columnas si a un target le falta un campo.
TARGET_NAMES=()
TARGET_IDS=()

cur_nombre=""
cur_estado=""
cur_id=""

flush_target() {
    if [ -n "$cur_nombre" ]; then
        if [ "$cur_estado" != "activo" ]; then
            echo "Omitido (estado '${cur_estado:-sin estado}'): $cur_nombre"
        elif [ -z "$cur_id" ] || [ "$cur_id" = "null" ]; then
            echo "AVISO: '$cur_nombre' esta activo pero no tiene script_id. Se omite."
        else
            TARGET_NAMES+=("$cur_nombre")
            TARGET_IDS+=("$cur_id")
        fi
    fi
    cur_nombre=""
    cur_estado=""
    cur_id=""
}

while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
        \#*) continue ;;
    esac
    case "$line" in
        *"- nombre:"*)
            flush_target
            val=$(printf '%s\n' "$line" | sed -n 's/^[[:space:]]*-[[:space:]]*nombre:[[:space:]]*"\{0,1\}\([^"]*\)"\{0,1\}[[:space:]]*$/\1/p')
            if [ -n "$val" ]; then cur_nombre="$val"; fi
            ;;
        *"estado:"*)
            val=$(printf '%s\n' "$line" | sed -n 's/^[[:space:]]*estado:[[:space:]]*"\{0,1\}\([^"]*\)"\{0,1\}[[:space:]]*$/\1/p')
            if [ -n "$val" ]; then cur_estado="$val"; fi
            ;;
        *"script_id:"*)
            val=$(printf '%s\n' "$line" | sed -n 's/^[[:space:]]*script_id:[[:space:]]*"\{0,1\}\([^"]*\)"\{0,1\}[[:space:]]*$/\1/p')
            if [ -n "$val" ]; then cur_id="$val"; fi
            ;;
    esac
done < "$TARGETS_FILE"
flush_target

if [ ${#TARGET_NAMES[@]} -eq 0 ]; then
    echo "Error: No se encontro ningun target activo con script_id en targets.yaml."
    exit 1
fi

# --- Preparacion de limpieza garantizada ---
# El trap corre ante EXIT (normal, error o Ctrl+C): restaura .clasp.json si hay
# backup y borra el directorio temporal del drift-check. Asi .clasp.json nunca
# queda apuntando a un target por accidente ni quedan temporales huerfanos.
TMP_BASE=$(mktemp -d) || { echo "Error: No se pudo crear el directorio temporal."; exit 1; }

limpiar() {
    if [ -f "$REPO_DIR/.clasp.json.backup" ]; then
        mv "$REPO_DIR/.clasp.json.backup" "$REPO_DIR/.clasp.json"
        echo "Configuracion original de .clasp.json restaurada."
    fi
    if [ -n "${TMP_BASE:-}" ] && [ -d "$TMP_BASE" ]; then
        rm -rf "$TMP_BASE"
    fi
}
trap limpiar EXIT

# Resolucion UNICA del binario clasp para pull y push (mismo binario en ambos
# caminos: si difirieran, un drift-check y un push podrian correr versiones
# distintas de clasp). Preferencia: el paquete local del repo (@google/clasp en
# devDependencies de la raiz); fallback a npx. Sin comillas al invocar
# $CLASP_BIN: el caso npx necesita word splitting.
if [ -x "$REPO_DIR/node_modules/.bin/clasp" ]; then
    CLASP_BIN="$REPO_DIR/node_modules/.bin/clasp"
else
    CLASP_BIN="npx clasp"
fi

clasp_pull_en() {
    dir_pull="$1"
    (cd "$dir_pull" && $CLASP_BIN pull)
}

# --- Drift-check integrado (arnes seccion 3, pieza 8) ---
# Para cada target: clasp pull a un directorio temporal con su propio
# .clasp.json (mismo script_id, rootDir "src") y diff -rq contra src/ local.
# Estados posibles: ok (sin drift), drift (remoto y local difieren; la
# direccion no se conoce), error (no se pudo verificar; se trata igual que
# drift por prudencia — un pull fallido jamas se reporta como "sin drift").
DRIFT_STATUS=()

echo "Verificando drift contra el remoto (${#TARGET_NAMES[@]} target/s)..."
echo "----------------------------------------------"

for i in "${!TARGET_NAMES[@]}"; do
    name="${TARGET_NAMES[$i]}"
    script_id="${TARGET_IDS[$i]}"
    tmp_dir="$TMP_BASE/target_$i"

    echo "Drift-check: $name"
    mkdir -p "$tmp_dir/src"
    printf '{"scriptId":"%s","rootDir":"src"}\n' "$script_id" > "$tmp_dir/.clasp.json"

    if clasp_pull_en "$tmp_dir" > "$tmp_dir/pull.log" 2>&1; then
        # DONDE QUEDAN LOS ARCHIVOS PULLEADOS NO SE ASUME, SE BUSCA.
        # decision Franco 2026-08-21: clasp 3.x anida rootDir y deja el pull en
        # "$tmp_dir/src/src"; clasp 2.x lo dejaba en "$tmp_dir/src". Con la ruta fija, el diff
        # comparaba src/ local contra un directorio que solo contenia un subdirectorio "src", y
        # reportaba LOS 38 ARCHIVOS como drift en cada corrida -- un drift-check que grita
        # siempre no informa nada y entrena a tipear "pisar" sin mirar, que es justo lo que este
        # guard existe para impedir. Se resuelve por donde quedo appsscript.json (viene en todo
        # pull, en cualquier version) en vez de por una ruta supuesta.
        pulled_manifest="$(find "$tmp_dir" -name appsscript.json -print -quit 2>/dev/null)"
        if [ -z "$pulled_manifest" ]; then
            echo "  ERROR: el pull no dejo ningun appsscript.json bajo $tmp_dir; no se puede"
            echo "         ubicar lo descargado, asi que NO se declara 'sin drift'."
            DRIFT_STATUS+=("error")
            echo "----------------------------------------------"
            continue
        fi
        pulled_dir="$(dirname "$pulled_manifest")"
        diff -rq "$pulled_dir" "$SRC_DIR" > "$tmp_dir/diff.log" 2>&1
        diff_rc=$?
        if [ "$diff_rc" -eq 0 ]; then
            echo "  sin drift: el remoto coincide con src/ local."
            DRIFT_STATUS+=("ok")
        elif [ "$diff_rc" -eq 1 ]; then
            # Hay diferencia, pero eso NO dice en que direccion. La pregunta que importa --
            # el remoto tiene algo que el repo nunca vio? -- la contesta el verificador
            # comparando hashes de blob contra el src/ de cada commit alcanzable.
            commit_remoto="$(python3 "$REPO_DIR/devtools/verificar_remoto.py" "$pulled_dir" 2>/dev/null)"
            ver_rc=$?
            if [ "$ver_rc" -eq 0 ]; then
                echo "  LOCAL ADELANTE: el remoto es exactamente un commit de este repo."
                echo "    remoto = $commit_remoto"
                echo "    Nadie edito en el editor de Apps Script. Pushear solo lo actualiza."
                DRIFT_STATUS+=("adelante")
            else
                echo "  DRIFT DETECTADO: remoto y src/ local difieren (un push sobreescribe el remoto)."
                if [ "$ver_rc" -eq 1 ]; then
                    echo "    El remoto NO coincide con ningun commit del repo: tiene contenido propio."
                else
                    echo "    Ademas, no se pudo verificar contra la historia del repo."
                fi
                echo "  Archivos que difieren:"
                sed 's/^/    /' "$tmp_dir/diff.log"
                DRIFT_STATUS+=("drift")
            fi
        else
            echo "  ERROR al comparar (diff fallo):"
            sed 's/^/    /' "$tmp_dir/diff.log"
            DRIFT_STATUS+=("error")
        fi
    else
        echo "  ERROR: no se pudo verificar drift (fallo clasp pull). Detalle:"
        sed 's/^/    /' "$tmp_dir/pull.log"
        DRIFT_STATUS+=("error")
    fi
    echo "----------------------------------------------"
done

# --- Listado de targets ---
echo "Targets a desplegar (${#TARGET_NAMES[@]}):"
for i in "${!TARGET_NAMES[@]}"; do
    case "${DRIFT_STATUS[$i]}" in
        ok)       marca="sin drift" ;;
        adelante) marca="local adelante: el remoto es un commit del repo" ;;
        drift) marca="CON DRIFT: pedira confirmacion 'pisar'" ;;
        *)     marca="DRIFT NO VERIFICADO: pedira confirmacion 'pisar'" ;;
    esac
    echo "  - ${TARGET_NAMES[$i]}  (${TARGET_IDS[$i]})  [$marca]"
done
echo "----------------------------------------------"

# --- Corte de dry-run: todo el analisis hecho, nada pusheado ---
# Exit code para CI: 0 = sin drift en ningun target; 3 = al menos un target
# con drift o con verificacion fallida (un pipeline puede detectar divergencia
# sin parsear texto).
if [ "$DRY_RUN" -eq 1 ]; then
    echo "DRY RUN: no se pusheo nada"
    for st in "${DRIFT_STATUS[@]}"; do
        if [ "$st" != "ok" ]; then
            # 'adelante' tambien sale 3: no es peligroso, pero sigue habiendo algo que
            # desplegar y un pipeline que pregunta "esta la produccion al dia?" quiere saberlo.
            echo "DRY RUN: hay drift o verificacion fallida en al menos un target (exit 3)."
            exit 3
        fi
    done
    exit 0
fi

# --- Confirmacion explicita: esto empuja codigo a la planilla productiva ---
if [ "$VERIFICADO" -eq 1 ]; then
    # En modo verificado no se pregunta, pero TAMPOCO se sigue de largo ante la duda:
    # si algun target no quedo en 'ok' o 'adelante', se aborta. No hay nadie del otro
    # lado para contestar, y un flag que ante la duda avanza no es una automatizacion,
    # es un guard desactivado.
    NO_VERIFICADOS=()
    for i in "${!TARGET_NAMES[@]}"; do
        st="${DRIFT_STATUS[$i]}"
        if [ "$st" != "ok" ] && [ "$st" != "adelante" ]; then
            NO_VERIFICADOS+=("${TARGET_NAMES[$i]} [$st]")
        fi
    done
    if [ ${#NO_VERIFICADOS[@]} -gt 0 ]; then
        echo "ABORTADO. --verificado exige que TODOS los targets esten verificados, y estos no lo estan:"
        for n in "${NO_VERIFICADOS[@]}"; do echo "  - $n"; done
        echo "El remoto tiene contenido que este repo no conoce, o no se pudo comprobar."
        echo "Corre el script SIN --verificado y decidilo a mano."
        exit 4
    fi
    echo "Todos los targets verificados. Se deploya sin preguntar."
else
    read -r -p "Confirmas el push a estos ${#TARGET_NAMES[@]} target/s productivos? (s/n): " respuesta
    if [ "$respuesta" != "s" ] && [ "$respuesta" != "S" ]; then
        echo "Despliegue cancelado por el usuario."
        exit 0
    fi
fi

# --- Backup de .clasp.json con restauracion garantizada por el trap ---
if [ -f "$REPO_DIR/.clasp.json" ]; then
    cp "$REPO_DIR/.clasp.json" "$REPO_DIR/.clasp.json.backup"
fi

# --- Push a cada target ---
FALLIDOS=()
SALTEADOS=()

for i in "${!TARGET_NAMES[@]}"; do
    name="${TARGET_NAMES[$i]}"
    script_id="${TARGET_IDS[$i]}"

    # Confirmacion adicional para targets con drift (o drift no verificable):
    # solo la palabra exacta "pisar" autoriza sobrescribir el remoto.
    # 'adelante' NO pregunta: ya se comprobo que el remoto es un commit de este repo, que es
    # exactamente lo que "pisar" existia para que una persona confirmara mirando un diff.
    if [ "${DRIFT_STATUS[$i]}" != "ok" ] && [ "${DRIFT_STATUS[$i]}" != "adelante" ]; then
        echo "ATENCION: '$name' difiere del remoto (o no se pudo verificar). El push sobreescribe el estado remoto."
        read -r -p "Escribi 'pisar' para continuar con '$name' (cualquier otra cosa lo saltea): " resp_drift
        if [ "$resp_drift" != "pisar" ]; then
            echo "Salteado por el usuario: $name (queda NO deployado)."
            SALTEADOS+=("$name")
            echo "----------------------------------------------"
            continue
        fi
    fi

    echo "Sincronizando: $name"
    echo "  Script ID: $script_id"

    # rootDir "src" (no "./src"): igual al .clasp.json real del repo.
    printf '{"scriptId":"%s","rootDir":"src"}\n' "$script_id" > "$REPO_DIR/.clasp.json"

    # push -f (forzado): sin -f, clasp pregunta interactivamente al detectar
    # cambios en appsscript.json y la corrida se rompe a mitad del loop
    # (cicatriz heredada del deploy v1.11.0 de pymes). La confirmacion humana
    # ya ocurrio arriba, antes de tocar ningun target.
    $CLASP_BIN push -f

    if [ $? -eq 0 ]; then
        echo "Sincronizado correctamente: $name."
    else
        echo "Error al sincronizar: $name."
        FALLIDOS+=("$name")
    fi
    echo "----------------------------------------------"
done

# --- Cierre ---
if [ ${#SALTEADOS[@]} -gt 0 ]; then
    echo "ATENCION: targets salteados por drift no confirmado (NO deployados): ${SALTEADOS[*]}."
fi

if [ ${#FALLIDOS[@]} -gt 0 ]; then
    echo "ATENCION: fallo el push a: ${FALLIDOS[*]}. Revisar antes de asumir despliegue completo."
    exit 1
fi

if [ ${#SALTEADOS[@]} -gt 0 ]; then
    echo "Despliegue parcial: hubo targets sin deployar."
    exit 1
fi

echo "Todos los targets en cola fueron procesados."
