#!/bin/sh
# ---------------------------------------------------------------------------
# Batería de comprobaciones de seguridad contra un CRM ya arrancado.
#
# Comprueba, de fuera adentro, que las defensas siguen en su sitio: cabeceras,
# acceso sin sesión, mensaje genérico de login, CSRF, topes de tamaño, reglas
# de contraseña, autoprotecciones de administrador, errores sin detalles y
# anulación de sesiones.
#
# Necesita un usuario de prueba CON ROL ADMIN y su contraseña. Nunca se
# escriben aquí: se pasan por variables de entorno.
#
# Uso (una sola línea):
#   BASE=http://localhost:3100 TEST_EMAIL=admin@novaschool.es TEST_PASSWORD='...' sh scripts/comprobar-seguridad.sh
#
# ATENCIÓN: la prueba final cierra TODAS las sesiones de ese usuario, y la
# prueba de login deja intentos fallidos registrados a su nombre. Úsalo con
# una cuenta de prueba, no con la tuya del día a día.
# ---------------------------------------------------------------------------
B="${BASE:-http://localhost:3000}"
EMAIL="$TEST_EMAIL"
PASS="$TEST_PASSWORD"

if [ -z "$EMAIL" ] || [ -z "$PASS" ]; then
  echo 'ERROR: define TEST_EMAIL y TEST_PASSWORD (cuenta admin de prueba).' >&2
  exit 1
fi
CK=/tmp/pr-ck.txt
ok=0; fallo=0

comprobar() {
  # comprobar "descripcion" "esperado" "obtenido"
  if [ "$2" = "$3" ]; then
    echo "  OK    $1  ($3)"
    ok=$((ok+1))
  else
    echo "  FALLO $1  esperaba=$2 obtuvo=$3"
    fallo=$((fallo+1))
  fi
}

codigo() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "== 1. Cabeceras de seguridad =="
H=$(curl -s -D - -o /dev/null $B/login)
for c in "Strict-Transport-Security" "X-Content-Type-Options" "X-Frame-Options" "Referrer-Policy" "Permissions-Policy" "content-security-policy"; do
  if printf '%s' "$H" | grep -qi "^$c:"; then echo "  OK    $c presente"; ok=$((ok+1));
  else echo "  FALLO $c ausente"; fallo=$((fallo+1)); fi
done
if printf '%s' "$H" | grep -qi "^x-powered-by:"; then echo "  FALLO x-powered-by expuesto"; fallo=$((fallo+1));
else echo "  OK    x-powered-by oculto"; ok=$((ok+1)); fi
CSPDIR=$(printf '%s' "$H" | grep -i "^content-security-policy" | tr ";" "
" | grep -E "script-src |style-src ")
if printf '%s' "$CSPDIR" | grep -qi "unsafe-inline"; then echo "  FALLO script-src/style-src permiten codigo en linea"; fallo=$((fallo+1));
else echo "  OK    script-src y style-src sin unsafe-inline"; ok=$((ok+1)); fi

echo "== 2. Acceso sin sesion =="
comprobar "/ redirige al login" "307" "$(codigo $B/)"
comprobar "/usuarios redirige"  "307" "$(codigo $B/usuarios)"
comprobar "API sin sesion 401"  "401" "$(codigo -X POST $B/api/centros -H 'Content-Type: application/json' -H "Origin: $B" -d '{}')"
comprobar "export sin sesion"   "401" "$(codigo $B/api/export)"
comprobar "cookie falsa"        "307" "$(codigo -H 'Cookie: session=inventada' $B/)"

echo "== 3. Mensaje de acceso identico y generico =="
M1=$(curl -s -X POST $B/api/auth/login -H 'Content-Type: application/json' -H "Origin: $B" -d '{"email":"nadie@ejemplo.com","password":"loquesea123"}')
M2=$(curl -s -X POST $B/api/auth/login -H 'Content-Type: application/json' -H "Origin: $B" -d "{\"email\":\"$EMAIL\",\"password\":\"malamalamala\"}")
comprobar "mismo mensaje para email inexistente y password mala" "$M1" "$M2"

echo "== 4. CSRF =="
comprobar "login desde otra web" "403" "$(codigo -X POST $B/api/auth/login -H 'Content-Type: application/json' -H 'Origin: https://malo.example' -d '{}')"

echo "== 5. Sesion valida =="
rm -f $CK
codigo -c $CK -X POST $B/api/auth/login -H 'Content-Type: application/json' -H "Origin: $B" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" >/dev/null
comprobar "panel accesible" "200" "$(codigo -b $CK $B/)"
comprobar "export accesible" "200" "$(codigo -b $CK $B/api/export)"
if grep -qi httponly $CK; then echo "  OK    cookie httpOnly"; ok=$((ok+1)); else echo "  FALLO cookie sin httpOnly"; fallo=$((fallo+1)); fi

# El prefijo __Host- impide que otro subdominio del dominio corporativo pueda
# fijar una cookie de sesión para el CRM (fijación de sesión). Solo se exige
# contra un despliegue por HTTPS: en local, por HTTP, se usa el nombre corto.
SETCOOKIE=$(curl -s -D - -o /dev/null -X POST $B/api/auth/login -H 'Content-Type: application/json' -H "Origin: $B" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | grep -i '^set-cookie')
case "$B" in
  https://*)
    if printf '%s' "$SETCOOKIE" | grep -q '__Host-session'; then
      echo "  OK    cookie con prefijo __Host-"; ok=$((ok+1))
    else
      echo "  FALLO la cookie de sesión no lleva el prefijo __Host-"; fallo=$((fallo+1))
    fi ;;
  *) echo "  --    prefijo __Host- no aplica sobre HTTP (solo se comprueba con https://)" ;;
esac
if printf '%s' "$SETCOOKIE" | grep -qi 'domain='; then
  echo "  FALLO la cookie fija un Domain: la compartiría con otros subdominios"; fallo=$((fallo+1))
else
  echo "  OK    cookie sin Domain (no se comparte con otros subdominios)"; ok=$((ok+1))
fi

echo "== 6. CSRF con sesion abierta =="
comprobar "borrado desde otra web" "403" "$(codigo -b $CK -X DELETE $B/api/centros/cualquiera -H 'Origin: https://malo.example')"
comprobar "alta desde otra web"    "403" "$(codigo -b $CK -X POST $B/api/usuarios -H 'Content-Type: application/json' -H 'Origin: https://malo.example' -d '{}')"

echo "== 7. Limites de entrada =="
node -e "console.log(JSON.stringify({nombre:'x'.repeat(900000)}))" > /tmp/pr-huge.json
comprobar "cuerpo de 900 KB" "413" "$(codigo -b $CK -X POST $B/api/centros -H 'Content-Type: application/json' -H "Origin: $B" -d @/tmp/pr-huge.json)"
node -e "console.log(JSON.stringify({nombre:'t',pais:'p',notas:'y'.repeat(20000),force:true}))" > /tmp/pr-big.json
comprobar "notas de 20.000 chars" "400" "$(codigo -b $CK -X POST $B/api/centros -H 'Content-Type: application/json' -H "Origin: $B" -d @/tmp/pr-big.json)"
EST=$(node -e '
const {PrismaClient}=require("@prisma/client");
new PrismaClient().estancia.findFirst({select:{id:true}}).then(e=>{console.log(e.id);process.exit(0)});
')
comprobar "captura que no es imagen" "400" "$(codigo -b $CK -X PUT $B/api/estancias/$EST/captacion -H 'Content-Type: application/json' -H "Origin: $B" -d '{"capturaBase64":"data:text/html;base64,PHNjcmlwdD4x"}')"

# Un cuerpo enorme que NO declara su tamaño (envío "chunked"). Es el caso que
# se cuela si el tope se comprueba solo mirando la cabecera Content-Length:
# el servidor se traga el cuerpo entero en memoria antes de poder medirlo.
node -e "require('fs').writeFileSync('$TMPDIR/pr-chunked.json', JSON.stringify({nombre:'x'.repeat(5*1024*1024)}))" 2>/dev/null \
  || node -e "require('fs').writeFileSync(require('os').tmpdir()+'/pr-chunked.json', JSON.stringify({nombre:'x'.repeat(5*1024*1024)}))"
CHUNKED=$(node -e "console.log(require('os').tmpdir()+'/pr-chunked.json')")
comprobar "cuerpo de 5 MB sin declarar tamaño" "413" "$(codigo -b $CK -X POST $B/api/centros -H 'Content-Type: application/json' -H "Origin: $B" -H 'Transfer-Encoding: chunked' --data-binary @"$CHUNKED")"
rm -f "$CHUNKED"

echo "== 8. Contrasenas debiles =="
comprobar "menos de 10 caracteres" "400" "$(codigo -b $CK -X POST $B/api/auth/password -H 'Content-Type: application/json' -H "Origin: $B" -d "{\"actual\":\"$PASS\",\"nueva\":\"corta12\"}")"
# Se construye una contraseña que contiene la parte del email anterior a la @,
# que es justo lo que la validación debe rechazar.
LOCAL=$(printf '%s' "$EMAIL" | cut -d@ -f1)
comprobar "contiene el email"      "400" "$(codigo -b $CK -X POST $B/api/auth/password -H 'Content-Type: application/json' -H "Origin: $B" -d "{\"actual\":\"$PASS\",\"nueva\":\"${LOCAL}99XyZ\"}")"

echo "== 9. Autoprotecciones de administrador =="
UID_ACTUAL=$(node -e "
const {PrismaClient}=require('@prisma/client');
new PrismaClient().user.findUnique({where:{email:'$EMAIL'},select:{id:true}}).then(u=>{console.log(u.id);process.exit(0)});
")
comprobar "no puede desactivarse a si mismo" "400" "$(codigo -b $CK -X PATCH $B/api/usuarios/$UID_ACTUAL -H 'Content-Type: application/json' -H "Origin: $B" -d '{"activo":false}')"
comprobar "no puede quitarse el rol admin"   "400" "$(codigo -b $CK -X PATCH $B/api/usuarios/$UID_ACTUAL -H 'Content-Type: application/json' -H "Origin: $B" -d '{"role":"MARKETING"}')"

echo "== 10. Errores genericos =="
R=$(curl -s -b $CK -X POST $B/api/estancias -H 'Content-Type: application/json' -H "Origin: $B" -d '{"centroId":"noexiste","tipoPrograma":"x","tipoParticipante":"ALUMNOS"}')
if printf '%s' "$R" | grep -qiE "prisma|constraint|node_modules|\.js:"; then
  echo "  FALLO el error filtra detalles internos: $R"; fallo=$((fallo+1))
else
  echo "  OK    error sin detalles internos"; ok=$((ok+1))
fi

echo "== 11. Cerrar todas las sesiones =="
codigo -b $CK -X POST $B/api/auth/logout-all -H "Origin: $B" >/dev/null
comprobar "la cookie deja de valer" "307" "$(codigo -b $CK $B/)"

echo ""
echo "RESULTADO: $ok correctas, $fallo fallidas"
[ "$fallo" -eq 0 ] || exit 1
