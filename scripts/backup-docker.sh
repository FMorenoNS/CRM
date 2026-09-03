#!/bin/sh
# ---------------------------------------------------------------------------
# Copia de seguridad del CRM desplegado con Docker Compose.
#
# Es el script que se usa en el servidor. El contenedor de la aplicación no
# lleva las herramientas de PostgreSQL (se mantiene ligero a propósito), así
# que el volcado se pide al contenedor de la base de datos, que sí las trae.
# La contraseña no viaja por ninguna parte: se habla con el contenedor
# directamente.
#
# El fichero resultante va CIFRADO con clave pública: el servidor puede
# cifrar copias pero NO puede descifrarlas. Quien entre en el servidor no se
# lleva el histórico de datos personales. La clave privada la custodia IT
# fuera de esta máquina.
#
# Preparación, una sola vez en el servidor:
#   gpg --import clave-publica-copias.asc
#   gpg --list-keys                      # para ver el identificador
#
# Uso, desde la carpeta donde está el docker-compose.yml:
#   BACKUP_GPG_RECIPIENT=copias@novaschool.es ./scripts/backup-docker.sh
#
# Cron diario a las 3:00, guardando fuera del servidor:
#   0 3 * * * cd /opt/crm && BACKUP_GPG_RECIPIENT=copias@novaschool.es DESTINO=/mnt/copias ./scripts/backup-docker.sh >> /var/log/crm-backup.log 2>&1
#
# Si se pierde la clave privada, las copias no valen nada. Guardadla en el
# gestor de contraseñas de la empresa, no en este servidor.
# ---------------------------------------------------------------------------
set -eu

DESTINO="${DESTINO:-./backups}"
DIAS_RETENCION="${DIAS_RETENCION:-30}"
USUARIO="${POSTGRES_USER:-crm}"
BASE="${POSTGRES_DB:-crm_erasmus}"
DESTINATARIO="${BACKUP_GPG_RECIPIENT:-}"

# Si hay un .env al lado, se toman de ahí el usuario, la base y, si está, el
# destinatario de cifrado.
if [ -f .env ]; then
  V=$(grep -E '^POSTGRES_USER=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  [ -n "$V" ] && USUARIO="$V"
  V=$(grep -E '^POSTGRES_DB=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  [ -n "$V" ] && BASE="$V"
  if [ -z "$DESTINATARIO" ]; then
    V=$(grep -E '^BACKUP_GPG_RECIPIENT=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
    [ -n "$V" ] && DESTINATARIO="$V"
  fi
fi

mkdir -p "$DESTINO"
FECHA=$(date +%Y%m%d-%H%M%S)

if [ -z "$DESTINATARIO" ]; then
  if [ "${PERMITIR_SIN_CIFRAR:-}" = "si" ]; then
    echo "AVISO: BACKUP_GPG_RECIPIENT no está definida y se ha pedido"
    echo "       PERMITIR_SIN_CIFRAR=si. La copia saldrá EN CLARO."
    echo "       Solo para pruebas, nunca como copia de verdad."
    FICHERO="$DESTINO/crm-$FECHA.dump"
    CIFRAR="no"
  else
    echo "ERROR: falta BACKUP_GPG_RECIPIENT." >&2
    echo "" >&2
    echo "La copia contiene datos personales de terceros y no se genera sin" >&2
    echo "cifrar. Importa la clave pública de copias en este servidor y pon" >&2
    echo "su identificador en esa variable o en el .env. Ver la cabecera de" >&2
    echo "este script." >&2
    echo "" >&2
    echo "Solo para una prueba, y a sabiendas:" >&2
    echo "    PERMITIR_SIN_CIFRAR=si ./scripts/backup-docker.sh" >&2
    exit 1
  fi
else
  FICHERO="$DESTINO/crm-$FECHA.dump.gpg"
  CIFRAR="si"
fi

echo "Creando copia de seguridad en $FICHERO ..."

# -T evita que Docker asigne un terminal, necesario al encadenar la salida.
# El volcado nunca toca el disco sin cifrar: sale del contenedor y entra en
# gpg por una tubería, en el mismo paso.
if [ "$CIFRAR" = "si" ]; then
  docker compose exec -T db \
    pg_dump --format=custom --no-owner --no-privileges -U "$USUARIO" "$BASE" \
    | gpg --batch --yes --encrypt --trust-model always \
        --recipient "$DESTINATARIO" --output "$FICHERO"
else
  docker compose exec -T db \
    pg_dump --format=custom --no-owner --no-privileges -U "$USUARIO" "$BASE" > "$FICHERO"
fi

if [ ! -s "$FICHERO" ]; then
  echo "ERROR: la copia ha salido vacía. Revisa que el contenedor 'db' esté levantado." >&2
  rm -f "$FICHERO"
  exit 1
fi

echo "Copia creada correctamente ($(du -h "$FICHERO" | cut -f1))."
[ "$CIFRAR" = "si" ] && echo "Cifrada para: $DESTINATARIO"

echo "Borrando copias de más de $DIAS_RETENCION días..."
find "$DESTINO" -name 'crm-*.dump' -o -name 'crm-*.dump.gpg' \
  | while read -r f; do
      [ -n "$(find "$f" -mtime "+$DIAS_RETENCION" 2>/dev/null)" ] && rm -f "$f" && echo "  borrada $f"
    done || true

echo "Listo."
echo ""
echo "RECORDATORIO: esta copia tiene que salir del servidor. Si se pierde la"
echo "máquina, se pierde también lo que quede guardado en ella."
