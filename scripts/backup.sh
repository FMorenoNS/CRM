#!/bin/sh
# ---------------------------------------------------------------------------
# Copia de seguridad de la base de datos del CRM.
#
# Uso:
#   ./scripts/backup.sh                 -> guarda en ./backups/
#   DESTINO=/ruta ./scripts/backup.sh   -> guarda donde le digas
#
# Genera un fichero comprimido con fecha y hora, y borra automáticamente los
# que tengan más de 30 días para que la carpeta no crezca sin control.
#
# IMPORTANTE: el fichero contiene datos personales de terceros. Guárdalo
# cifrado y fuera del mismo servidor (si se pierde el servidor, se pierden
# las copias que estén en él).
# ---------------------------------------------------------------------------
set -e

# Prisma añade a la URL parámetros que solo entiende él (?schema=public,
# connection_limit, pgbouncer...). pg_dump y psql los rechazan, así que se
# quitan antes de usarla.
limpiar_url() {
  printf '%s' "$1" | sed -E 's/[?&](schema|connection_limit|pool_timeout|pgbouncer|connect_timeout|socket_timeout)=[^&]*//g' | sed -E 's/[?&]$//'
}

if [ -z "$DATABASE_URL" ]; then
  if [ -f .env ]; then
    # Lee DATABASE_URL del .env sin arrastrar el resto del fichero.
    DATABASE_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
    export DATABASE_URL
  fi
fi

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: falta DATABASE_URL (ni en el entorno ni en .env)." >&2
  exit 1
fi

DATABASE_URL=$(limpiar_url "$DATABASE_URL")

DESTINO="${DESTINO:-./backups}"
DIAS_RETENCION="${DIAS_RETENCION:-30}"
mkdir -p "$DESTINO"

FECHA=$(date +%Y%m%d-%H%M%S)
FICHERO="$DESTINO/crm-$FECHA.dump"

echo "Creando copia de seguridad en $FICHERO ..."
# Formato "custom" (-Fc): comprimido y restaurable de forma selectiva.
pg_dump --format=custom --no-owner --no-privileges --file="$FICHERO" "$DATABASE_URL"

TAMANO=$(du -h "$FICHERO" | cut -f1)
echo "Copia creada correctamente ($TAMANO)."

echo "Borrando copias de más de $DIAS_RETENCION días..."
find "$DESTINO" -name 'crm-*.dump' -type f -mtime "+$DIAS_RETENCION" -print -delete || true

echo "Listo."
