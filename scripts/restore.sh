#!/bin/sh
# ---------------------------------------------------------------------------
# Restaura una copia de seguridad del CRM.
#
# Uso:
#   ./scripts/restore.sh backups/crm-20260903-101500.dump
#
# Por defecto restaura sobre una base de datos DE PRUEBA llamada
# `crm_erasmus_restore_test`, para poder comprobar que la copia sirve sin
# tocar los datos reales. Eso es lo que hay que hacer una vez al mes.
#
# Para restaurar de verdad sobre producción (solo en un desastre):
#   CONFIRMAR_PRODUCCION=si ./scripts/restore.sh <fichero>
# ---------------------------------------------------------------------------
set -e

# Prisma añade a la URL parámetros que solo entiende él (?schema=public,
# connection_limit, pgbouncer...). pg_dump y psql los rechazan, así que se
# quitan antes de usarla.
limpiar_url() {
  printf '%s' "$1" | sed -E 's/[?&](schema|connection_limit|pool_timeout|pgbouncer|connect_timeout|socket_timeout)=[^&]*//g' | sed -E 's/[?&]$//'
}

FICHERO="$1"
if [ -z "$FICHERO" ] || [ ! -f "$FICHERO" ]; then
  echo "Uso: ./scripts/restore.sh <fichero.dump>" >&2
  exit 1
fi

if [ -z "$DATABASE_URL" ] && [ -f .env ]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  export DATABASE_URL
fi

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: falta DATABASE_URL." >&2
  exit 1
fi

DATABASE_URL=$(limpiar_url "$DATABASE_URL")

if [ "$CONFIRMAR_PRODUCCION" = "si" ]; then
  DESTINO_URL="$DATABASE_URL"
  echo "*** ATENCIÓN: vas a restaurar SOBRE LA BASE DE DATOS REAL. ***"
  echo "Se sobrescribirán los datos actuales. Ctrl+C para cancelar."
  echo "Continuando en 10 segundos..."
  sleep 10
else
  BASE_PRUEBA="crm_erasmus_restore_test"
  # Sustituye el nombre de la base de datos en la URL, conservando usuario,
  # contraseña y host.
  DESTINO_URL=$(printf '%s' "$DATABASE_URL" | sed -E "s#/[^/?]+(\?|\$)#/$BASE_PRUEBA\1#")
  ADMIN_URL=$(printf '%s' "$DATABASE_URL" | sed -E "s#/[^/?]+(\?|\$)#/postgres\1#")

  echo "Restauración DE PRUEBA sobre la base de datos '$BASE_PRUEBA'."
  echo "(los datos reales no se tocan)"
  psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $BASE_PRUEBA;"
  psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE $BASE_PRUEBA;"
fi

echo "Restaurando $FICHERO ..."
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DESTINO_URL" "$FICHERO"

echo ""
echo "Comprobando que los datos están ahí:"
psql "$DESTINO_URL" -c 'SELECT
    (SELECT count(*) FROM "User")     AS usuarios,
    (SELECT count(*) FROM "Centro")   AS clientes,
    (SELECT count(*) FROM "Estancia") AS estancias,
    (SELECT count(*) FROM "AuditLog") AS historial;'

echo ""
echo "Restauración terminada. Si los números de arriba cuadran, la copia es válida."
