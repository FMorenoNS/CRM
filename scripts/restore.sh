#!/bin/sh
# ---------------------------------------------------------------------------
# Restaura una copia de seguridad del CRM (despliegue SIN Docker).
#
# Con Docker, usa scripts/restore-docker.sh.
#
# Acepta copias cifradas (.dump.gpg) y sin cifrar (.dump). Para las cifradas
# hace falta la CLAVE PRIVADA de copias, que a propósito no está en el
# servidor: esto se ejecuta desde el equipo de IT que la custodia.
#
# Uso, restauración DE PRUEBA (no toca los datos reales):
#   ./scripts/restore.sh backups/crm-20260903-030000.dump.gpg
#
# Uso real, solo ante un desastre (SOBRESCRIBE los datos):
#   CONFIRMAR_PRODUCCION=si ./scripts/restore.sh <fichero>
# ---------------------------------------------------------------------------
set -eu

limpiar_url() {
  printf '%s' "$1" | sed -E 's/[?&](schema|connection_limit|pool_timeout|pgbouncer|connect_timeout|socket_timeout)=[^&]*//g' | sed -E 's/[?&]$//'
}

FICHERO="${1:-}"
if [ -z "$FICHERO" ] || [ ! -f "$FICHERO" ]; then
  echo "Uso: ./scripts/restore.sh <fichero.dump.gpg | fichero.dump>" >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ] && [ -f .env ]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  export DATABASE_URL
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: falta DATABASE_URL." >&2
  exit 1
fi

URL=$(limpiar_url "$DATABASE_URL")

sin_esquema=${URL#*://}
credenciales=${sin_esquema%%@*}
servidor_y_base=${sin_esquema#*@}

DB_USER=${credenciales%%:*}
DB_PASS=${credenciales#*:}
[ "$DB_PASS" = "$credenciales" ] && DB_PASS=""

hostport=${servidor_y_base%%/*}
DB_NAME=${servidor_y_base#*/}
DB_NAME=${DB_NAME%%\?*}
DB_HOST=${hostport%%:*}
DB_PORT=${hostport#*:}
[ "$DB_PORT" = "$hostport" ] && DB_PORT=5432

PASSFILE=""
CLARO=""
limpiar() {
  [ -n "$PASSFILE" ] && rm -f "$PASSFILE"
  # El volcado descifrado se borra siempre: es el fichero con los datos
  # personales en claro y no debe quedarse por ahí.
  [ -n "$CLARO" ] && rm -f "$CLARO"
}
trap limpiar EXIT HUP INT TERM

if [ -n "$DB_PASS" ]; then
  umask 077
  PASSFILE=$(mktemp)
  # El "*" en el campo de la base de datos es intencionado: la restauración
  # necesita conectarse también a la base "postgres" para crear la de prueba,
  # y con el nombre concreto esa conexión se quedaría esperando la contraseña
  # por teclado, colgando el script.
  printf '%s:%s:*:%s:%s\n' "$DB_HOST" "$DB_PORT" "$DB_USER" "$DB_PASS" > "$PASSFILE"
  PGPASSFILE="$PASSFILE"
  export PGPASSFILE
fi

# Descifrado, si hace falta.
case "$FICHERO" in
  *.gpg)
    echo "Descifrando la copia (hará falta la clave privada de copias)..."
    umask 077
    CLARO=$(mktemp)
    # --yes es necesario: mktemp ya ha creado el fichero y gpg en modo
    # desatendido se niega a sobrescribirlo sin permiso explicito.
    gpg --batch --yes --quiet --decrypt --output "$CLARO" "$FICHERO"
    VOLCADO="$CLARO"
    ;;
  *)
    echo "AVISO: esta copia no está cifrada."
    VOLCADO="$FICHERO"
    ;;
esac

if [ "${CONFIRMAR_PRODUCCION:-}" = "si" ]; then
  DESTINO_DB="$DB_NAME"
  echo "*** ATENCIÓN: vas a restaurar SOBRE LA BASE DE DATOS REAL ($DB_NAME). ***"
  echo "Se sobrescribirán los datos actuales. Ctrl+C para cancelar."
  echo "Continuando en 10 segundos..."
  sleep 10
else
  DESTINO_DB="${DB_NAME}_restore_test"
  echo "Restauración DE PRUEBA sobre '$DESTINO_DB' (los datos reales no se tocan)."
  psql -w -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS ${DESTINO_DB};"
  psql -w -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE ${DESTINO_DB};"
fi

echo "Restaurando ..."
pg_restore -w --clean --if-exists --no-owner --no-privileges \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DESTINO_DB" "$VOLCADO"

echo ""
echo "Comprobando que los datos están ahí:"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DESTINO_DB" -c 'SELECT
    (SELECT count(*) FROM "User")     AS usuarios,
    (SELECT count(*) FROM "Centro")   AS clientes,
    (SELECT count(*) FROM "Estancia") AS estancias,
    (SELECT count(*) FROM "AuditLog") AS historial;'

if [ "${CONFIRMAR_PRODUCCION:-}" != "si" ]; then
  echo ""
  echo "Limpiando la base de datos de prueba..."
  psql -w -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS ${DESTINO_DB};" >/dev/null
fi

echo ""
echo "Terminado. Si los números de arriba cuadran, la copia es válida."
