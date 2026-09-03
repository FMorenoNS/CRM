#!/bin/sh
# ---------------------------------------------------------------------------
# Restaura una copia de seguridad del CRM desplegado con Docker Compose.
#
# Acepta copias cifradas (.dump.gpg) y sin cifrar (.dump). Para las cifradas
# hace falta la CLAVE PRIVADA de copias, que a propósito no está en el
# servidor: esto se ejecuta desde el equipo de IT que la custodia.
#
# Por defecto restaura sobre una base de datos DE PRUEBA, para verificar que
# la copia sirve sin tocar los datos reales. Esto es lo que hay que hacer una
# vez al mes.
#
# Uso:
#   ./scripts/restore-docker.sh backups/crm-20260903-030000.dump.gpg
#
# Para restaurar de verdad (solo ante un desastre; SOBRESCRIBE los datos):
#   CONFIRMAR_PRODUCCION=si ./scripts/restore-docker.sh <fichero>
# ---------------------------------------------------------------------------
set -eu

FICHERO="${1:-}"
if [ -z "$FICHERO" ] || [ ! -f "$FICHERO" ]; then
  echo "Uso: ./scripts/restore-docker.sh <fichero.dump.gpg | fichero.dump>" >&2
  exit 1
fi

USUARIO="${POSTGRES_USER:-crm}"
BASE="${POSTGRES_DB:-crm_erasmus}"
if [ -f .env ]; then
  V=$(grep -E '^POSTGRES_USER=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  [ -n "$V" ] && USUARIO="$V"
  V=$(grep -E '^POSTGRES_DB=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  [ -n "$V" ] && BASE="$V"
fi

CLARO=""
limpiar() {
  # El volcado descifrado se borra siempre: es el fichero con los datos
  # personales en claro y no debe quedarse por ahí.
  [ -n "$CLARO" ] && rm -f "$CLARO"
}
trap limpiar EXIT HUP INT TERM

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
  DESTINO="$BASE"
  echo "*** ATENCIÓN: se va a restaurar SOBRE LA BASE DE DATOS REAL ($BASE). ***"
  echo "Los datos actuales se sobrescribirán. Ctrl+C para cancelar."
  echo "Continuando en 10 segundos..."
  sleep 10
else
  DESTINO="${BASE}_restore_test"
  echo "Restauración DE PRUEBA sobre '$DESTINO' (los datos reales no se tocan)."
  docker compose exec -T db psql -U "$USUARIO" -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS ${DESTINO};"
  docker compose exec -T db psql -U "$USUARIO" -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE ${DESTINO};"
fi

echo "Restaurando ..."
docker compose exec -T db \
  pg_restore --clean --if-exists --no-owner --no-privileges -U "$USUARIO" -d "$DESTINO" < "$VOLCADO"

echo ""
echo "Comprobando que los datos están ahí:"
docker compose exec -T db psql -U "$USUARIO" -d "$DESTINO" -c 'SELECT
    (SELECT count(*) FROM "User")     AS usuarios,
    (SELECT count(*) FROM "Centro")   AS clientes,
    (SELECT count(*) FROM "Estancia") AS estancias,
    (SELECT count(*) FROM "AuditLog") AS historial;'

if [ "${CONFIRMAR_PRODUCCION:-}" != "si" ]; then
  echo ""
  echo "Limpiando la base de datos de prueba..."
  docker compose exec -T db psql -U "$USUARIO" -d postgres \
    -c "DROP DATABASE IF EXISTS ${DESTINO};" >/dev/null
fi

echo ""
echo "Terminado. Si los números de arriba cuadran, la copia es válida."
