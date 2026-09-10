#!/bin/sh
# ---------------------------------------------------------------------------
# Instalación asistida del CRM Erasmus+ con Docker Compose.
#
# Es un ATAJO OPCIONAL para los pasos que siempre son iguales: crear la
# configuración, generar las contraseñas, levantar los contenedores y crear
# la cuenta de administrador. Todo lo que hace se puede hacer a mano, y está
# documentado paso a paso en la guía de despliegue.
#
# Lo que NO hace, a propósito, porque son decisiones que dependen de vuestra
# infraestructura y no debe tomarlas un script:
#   - configurar el proxy inverso y el certificado HTTPS;
#   - decidir dónde se guardan las copias de seguridad;
#   - ejecutar la batería de comprobación de seguridad.
#
# Uso, desde la raíz del repositorio:
#   sh scripts/instalar.sh
# ---------------------------------------------------------------------------
set -eu

ROJO='\033[0;31m'; VERDE='\033[0;32m'; AMBAR='\033[0;33m'; NEGRITA='\033[1m'; FIN='\033[0m'

titulo()  { printf "\n${NEGRITA}%s${FIN}\n" "$1"; }
ok()      { printf "  ${VERDE}OK${FIN}    %s\n" "$1"; }
aviso()   { printf "  ${AMBAR}AVISO${FIN} %s\n" "$1"; }
abortar() { printf "\n${ROJO}ERROR${FIN} %s\n\n" "$1" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Contraseñas aleatorias SOLO alfanuméricas.
#
# No es una limitación estética: la contraseña de la base de datos se inserta
# dentro de una URL de conexión (postgresql://usuario:CLAVE@db:5432/...) y
# caracteres como / + @ : o # la romperían. 32 caracteres alfanuméricos dan
# más de 190 bits de entropía: de sobra.
# ---------------------------------------------------------------------------
generar_clave() {
  longitud="${1:-32}"
  if [ -r /dev/urandom ]; then
    LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "$longitud"
  elif command -v openssl >/dev/null 2>&1; then
    # hex es alfanumérico por definición, así que también es seguro en una URL.
    openssl rand -hex "$longitud" | head -c "$longitud"
  else
    abortar "No encuentro forma de generar una contraseña aleatoria (falta /dev/urandom y openssl)."
  fi
}

# Escribe o reemplaza una variable en el fichero .env.
# Se usa | como separador de sed porque los valores pueden contener / (URLs).
set_env() {
  clave="$1"; valor="$2"
  if grep -qE "^${clave}=" .env; then
    sed -i.bak -E "s|^${clave}=.*|${clave}=\"${valor}\"|" .env && rm -f .env.bak
  else
    printf '%s="%s"\n' "$clave" "$valor" >> .env
  fi
}

# Borra una variable del .env (para quitar la contraseña temporal al final).
quitar_env() {
  sed -i.bak -E "/^$1=/d" .env && rm -f .env.bak
}

leer_env() {
  grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'"
}

# ---------------------------------------------------------------------------
# 1) Comprobaciones previas
# ---------------------------------------------------------------------------
titulo "Instalación del CRM Erasmus+"
printf "\n"
titulo "1. Comprobando el entorno"

[ -f docker-compose.yml ] || abortar "Ejecuta esto desde la raíz del repositorio (donde está docker-compose.yml)."
ok "estamos en la raíz del repositorio"

command -v docker >/dev/null 2>&1 || abortar "Docker no está instalado o no está en el PATH."
ok "docker encontrado"

docker compose version >/dev/null 2>&1 || abortar "Falta Docker Compose v2 (el subcomando 'docker compose')."
ok "docker compose v2 disponible"

docker info >/dev/null 2>&1 || abortar "El servicio de Docker no responde. Arráncalo y vuelve a intentarlo."
ok "el servicio de Docker responde"

[ -f .env.example ] || abortar "No encuentro .env.example en el repositorio."

# ---------------------------------------------------------------------------
# 2) Fichero de configuración
# ---------------------------------------------------------------------------
titulo "2. Preparando la configuración"

REUTILIZA="no"
if [ -f .env ]; then
  aviso "ya existe un fichero .env"
  printf "        No se va a sobrescribir. ¿Continuar con la configuración que ya tiene? [s/N] "
  read -r respuesta
  case "$respuesta" in
    s|S|si|SI|Si|y|Y) REUTILIZA="si" ;;
    *) abortar "Instalación cancelada. Revisa o mueve el .env actual y vuelve a ejecutarlo." ;;
  esac
else
  cp .env.example .env
  ok "creado .env a partir de la plantilla"
fi

chmod 600 .env 2>/dev/null || aviso "no he podido poner permisos 600 en .env; hazlo a mano"
ok "permisos de .env restringidos al propietario"

if [ "$REUTILIZA" = "no" ]; then
  printf "\n"
  printf "  Dirección pública del CRM, con https:// y sin barra final.\n"
  printf "  Ejemplo: https://crm.novaschool.es\n"
  printf "  > "
  read -r ORIGEN
  [ -n "$ORIGEN" ] || abortar "La dirección pública es obligatoria."
  # Quita la barra final si la han puesto.
  ORIGEN=$(printf '%s' "$ORIGEN" | sed -E 's|/+$||')
  case "$ORIGEN" in
    https://*) : ;;
    http://*)  aviso "has puesto http://. El CRM NECESITA https:// para que se pueda iniciar sesión." ;;
    *)         abortar "La dirección debe empezar por https://" ;;
  esac

  printf "\n  Correo de la primera cuenta de administrador.\n"
  printf "  > "
  read -r ADMIN_EMAIL
  case "$ADMIN_EMAIL" in
    ?*@?*.?*) : ;;
    *) abortar "Eso no parece una dirección de correo válida." ;;
  esac

  CLAVE_BD=$(generar_clave 32)
  set_env "APP_ORIGIN" "$ORIGEN"
  set_env "POSTGRES_PASSWORD" "$CLAVE_BD"
  set_env "SEED_ADMIN_EMAIL" "$ADMIN_EMAIL"
  ok "dirección pública, contraseña de la base de datos y administrador configurados"
  printf "        (la contraseña de la base de datos se ha generado sola, 32 caracteres aleatorios)\n"
else
  ADMIN_EMAIL=$(leer_env "SEED_ADMIN_EMAIL")
  [ -n "$ADMIN_EMAIL" ] || abortar "El .env existente no tiene SEED_ADMIN_EMAIL. Rellénalo y vuelve a ejecutarlo."
fi

# La contraseña del administrador se genera aquí y es TEMPORAL: el CRM
# obligará a cambiarla en el primer acceso. Se escribe en el .env solo
# durante la instalación y se borra al terminar (paso 5).
CLAVE_ADMIN=$(generar_clave 20)
set_env "SEED_ADMIN_PASSWORD" "$CLAVE_ADMIN"

# ---------------------------------------------------------------------------
# 3) Levantar los contenedores
# ---------------------------------------------------------------------------
titulo "3. Construyendo y levantando los contenedores"
printf "        (la primera vez tarda unos minutos: descarga las imágenes base)\n\n"

docker compose up -d --build

printf "\n        Esperando a que el CRM responda"
INTENTOS=0
until docker compose exec -T app node -e \
  "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
  >/dev/null 2>&1
do
  INTENTOS=$((INTENTOS + 1))
  if [ "$INTENTOS" -gt 60 ]; then
    printf "\n"
    abortar "El CRM no responde después de 2 minutos. Mira qué pasa con: docker compose logs app"
  fi
  printf "."
  sleep 2
done
printf "\n"
ok "el CRM responde (migraciones de base de datos aplicadas)"

# ---------------------------------------------------------------------------
# 4) Cuenta de administrador
# ---------------------------------------------------------------------------
titulo "4. Creando la cuenta de administrador"
printf "\n"

docker compose exec -T app node scripts/crear-admin.mjs

# ---------------------------------------------------------------------------
# 5) Retirar la contraseña temporal
# ---------------------------------------------------------------------------
titulo "5. Limpiando la contraseña temporal"

quitar_env "SEED_ADMIN_PASSWORD"
ok "SEED_ADMIN_PASSWORD borrada del fichero .env"

# El contenedor todavía la tiene en su entorno: se recrea para que desaparezca
# también de ahí. Este es justo el paso que se olvida al hacerlo a mano.
docker compose up -d --force-recreate app >/dev/null 2>&1
ok "contenedor recreado sin la contraseña temporal en su entorno"

# ---------------------------------------------------------------------------
# Resumen
# ---------------------------------------------------------------------------
ORIGEN_FINAL=$(leer_env "APP_ORIGIN")

printf "\n"
printf "${VERDE}${NEGRITA}  El CRM está instalado y funcionando.${FIN}\n"
printf "\n"
printf "  ${NEGRITA}Datos del primer acceso${FIN} (apúntalos ahora: no se vuelven a mostrar)\n"
printf "\n"
printf "      Usuario:    %s\n" "$ADMIN_EMAIL"
printf "      Contraseña: ${NEGRITA}%s${FIN}\n" "$CLAVE_ADMIN"
printf "\n"
printf "  Es TEMPORAL. Al entrar por primera vez, el CRM obligará a cambiarla,\n"
printf "  así que si se queda en el historial de esta terminal deja de servir\n"
printf "  en cuanto esa persona entre. Pásasela por un canal seguro.\n"
printf "\n"
printf "  ${NEGRITA}Queda por hacer (esto no lo automatiza el script)${FIN}\n"
printf "\n"
printf "      1. Proxy inverso con HTTPS apuntando a 127.0.0.1:3000, con la\n"
printf "         cabecera X-Forwarded-For REEMPLAZADA (no añadida) y un límite\n"
printf "         de cuerpo de 8 MB. Configuración de nginx en la guía.\n"
printf "\n"
printf "      2. Copias de seguridad programadas:\n"
printf "         0 3 * * * cd %s && DESTINO=/mnt/copias ./scripts/backup-docker.sh\n" "$(pwd)"
printf "\n"
printf "      3. Comprobación de seguridad, una vez el dominio funcione:\n"
printf "         BASE=%s TEST_EMAIL=... TEST_PASSWORD=... sh scripts/comprobar-seguridad.sh\n" "${ORIGEN_FINAL:-https://tu-dominio}"
printf "\n"
printf "  Hasta que el paso 1 esté hecho, el CRM solo responde en el propio\n"
printf "  servidor: es correcto, no debe estar expuesto a la red sin HTTPS.\n"
printf "\n"
