#!/bin/sh
# ---------------------------------------------------------------------------
# Copia de seguridad del CRM cuando está desplegado con Docker Compose.
#
# El contenedor de la aplicación no lleva las herramientas de PostgreSQL (se
# mantiene ligero a propósito), así que la copia se hace desde el contenedor
# de la base de datos, que sí las trae.
#
# Uso, desde la carpeta donde está el docker-compose.yml:
#   ./scripts/backup-docker.sh
#   DESTINO=/mnt/copias ./scripts/backup-docker.sh
#
# Para automatizarlo, una línea de cron a las 3 de la mañana:
#   0 3 * * * cd /opt/crm && DESTINO=/mnt/copias ./scripts/backup-docker.sh >> /var/log/crm-backup.log 2>&1
#
# IMPORTANTE: el fichero resultante contiene datos personales de terceros.
# Guárdalo cifrado y fuera de este servidor.
# ---------------------------------------------------------------------------
set -e

DESTINO="${DESTINO:-./backups}"
DIAS_RETENCION="${DIAS_RETENCION:-30}"
USUARIO="${POSTGRES_USER:-crm}"
BASE="${POSTGRES_DB:-crm_erasmus}"

# Si hay un .env al lado, se toman de ahí el usuario y la base de datos.
if [ -f .env ]; then
  V=$(grep -E '^POSTGRES_USER=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  [ -n "$V" ] && USUARIO="$V"
  V=$(grep -E '^POSTGRES_DB=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  [ -n "$V" ] && BASE="$V"
fi

mkdir -p "$DESTINO"
FECHA=$(date +%Y%m%d-%H%M%S)
FICHERO="$DESTINO/crm-$FECHA.dump"

echo "Creando copia de seguridad en $FICHERO ..."
# -T evita que Docker asigne un terminal, necesario al redirigir la salida.
docker compose exec -T db \
  pg_dump --format=custom --no-owner --no-privileges -U "$USUARIO" "$BASE" > "$FICHERO"

if [ ! -s "$FICHERO" ]; then
  echo "ERROR: la copia ha salido vacía. Revisa que el contenedor 'db' esté levantado." >&2
  rm -f "$FICHERO"
  exit 1
fi

echo "Copia creada correctamente ($(du -h "$FICHERO" | cut -f1))."

echo "Borrando copias de más de $DIAS_RETENCION días..."
find "$DESTINO" -name 'crm-*.dump' -type f -mtime "+$DIAS_RETENCION" -print -delete || true

echo "Listo."
