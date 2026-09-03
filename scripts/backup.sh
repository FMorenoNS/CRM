#!/bin/sh
# ---------------------------------------------------------------------------
# Copia de seguridad de la base de datos del CRM (despliegue SIN Docker).
#
# Con Docker, usa scripts/backup-docker.sh.
#
# Uso:
#   BACKUP_GPG_RECIPIENT=copias@novaschool.es ./scripts/backup.sh
#   DESTINO=/mnt/copias BACKUP_GPG_RECIPIENT=... ./scripts/backup.sh
#
# El fichero resultante va CIFRADO, y a propósito con clave pública:
# el servidor puede cifrar copias pero NO puede descifrarlas. Así, quien
# entre en el servidor no se lleva el histórico de datos personales. La
# clave privada la custodia IT fuera de esta máquina.
#
# Preparación, una sola vez en el servidor:
#   gpg --import clave-publica-copias.asc
#   gpg --list-keys                # para ver el identificador
#   BACKUP_GPG_RECIPIENT=<ese identificador o su email>
#
# Si se pierde la clave privada, las copias no valen nada. Guardadla en el
# gestor de contraseñas de la empresa, no en este servidor.
# ---------------------------------------------------------------------------
set -eu

# Prisma añade a la URL parámetros que solo entiende él (?schema=public,
# connection_limit, pgbouncer...). pg_dump y psql los rechazan, así que se
# quitan antes de usarla.
limpiar_url() {
  printf '%s' "$1" | sed -E 's/[?&](schema|connection_limit|pool_timeout|pgbouncer|connect_timeout|socket_timeout)=[^&]*//g' | sed -E 's/[?&]$//'
}

if [ -z "${DATABASE_URL:-}" ] && [ -f .env ]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  export DATABASE_URL
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: falta DATABASE_URL (ni en el entorno ni en .env)." >&2
  exit 1
fi

URL=$(limpiar_url "$DATABASE_URL")

# ---------------------------------------------------------------------------
# La contraseña NO se pasa como argumento de pg_dump.
#
# Antes se le entregaba la URL completa, y los argumentos de un proceso los
# ve cualquiera en la máquina con un simple "ps": la contraseña de la base de
# datos quedaba a la vista. Se pasa por un fichero temporal con permisos
# 600, que es el mecanismo que PostgreSQL tiene para esto (PGPASSFILE), y se
# borra al terminar pase lo que pase.
#
# Tampoco se usa la variable PGPASSWORD: esa se puede leer en el entorno del
# proceso, así que solo es media solución.
# ---------------------------------------------------------------------------
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
limpiar() { [ -n "$PASSFILE" ] && rm -f "$PASSFILE"; }
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

DESTINO="${DESTINO:-./backups}"
DIAS_RETENCION="${DIAS_RETENCION:-30}"
mkdir -p "$DESTINO"

FECHA=$(date +%Y%m%d-%H%M%S)
DESTINATARIO="${BACKUP_GPG_RECIPIENT:-}"

if [ -z "$DESTINATARIO" ]; then
  if [ "${PERMITIR_SIN_CIFRAR:-}" = "si" ]; then
    echo "AVISO: BACKUP_GPG_RECIPIENT no está definida y se ha pedido"
    echo "       PERMITIR_SIN_CIFRAR=si. La copia saldrá EN CLARO."
    echo "       Solo para pruebas locales, nunca en el servidor."
    FICHERO="$DESTINO/crm-$FECHA.dump"
    CIFRAR="no"
  else
    echo "ERROR: falta BACKUP_GPG_RECIPIENT." >&2
    echo "" >&2
    echo "La copia contiene datos personales de terceros y no se genera sin" >&2
    echo "cifrar. Importa la clave pública de copias en este servidor y pon" >&2
    echo "su identificador en esa variable. Ver la cabecera de este script." >&2
    echo "" >&2
    echo "Solo para una prueba local, y a sabiendas:" >&2
    echo "    PERMITIR_SIN_CIFRAR=si ./scripts/backup.sh" >&2
    exit 1
  fi
else
  FICHERO="$DESTINO/crm-$FECHA.dump.gpg"
  CIFRAR="si"
fi

echo "Creando copia de seguridad en $FICHERO ..."

# El volcado nunca toca el disco sin cifrar: sale de pg_dump y entra en gpg
# por una tubería, en el mismo paso.
if [ "$CIFRAR" = "si" ]; then
  pg_dump -w --format=custom --no-owner --no-privileges \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    | gpg --batch --yes --encrypt --trust-model always \
        --recipient "$DESTINATARIO" --output "$FICHERO"
else
  pg_dump -w --format=custom --no-owner --no-privileges \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --file="$FICHERO"
fi

if [ ! -s "$FICHERO" ]; then
  echo "ERROR: la copia ha salido vacía." >&2
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
