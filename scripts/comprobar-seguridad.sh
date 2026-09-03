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
# El bloque 12 (frontera de visibilidad de Dirección) necesita además una
# cuenta con rol DIRECCION y los datos de un cliente que NO tenga asignado.
# Si no se pasan, ese bloque se salta avisando:
#
#   TEST_DIR_EMAIL=direccion.prueba@novaschool.es
#   TEST_DIR_PASSWORD='...'
#   TEST_AJENO_CENTRO=<id de un cliente que esa cuenta no gestiona>
#   TEST_AJENA_ESTANCIA=<id de una estancia de ese cliente>
#   TEST_AJENO_NOMBRE=<nombre exacto de ese cliente>
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

echo "== 12. Frontera de visibilidad de Direccion =="
if [ -z "${TEST_DIR_EMAIL:-}" ] || [ -z "${TEST_DIR_PASSWORD:-}" ] || [ -z "${TEST_AJENO_CENTRO:-}" ]; then
  echo "  --    saltado: faltan TEST_DIR_* (ver la cabecera de este script)"
else
  CKD=/tmp/cs-direccion.txt
  rm -f $CKD
  codigo -c $CKD -X POST $B/api/auth/login -H 'Content-Type: application/json' -H "Origin: $B" \
    -d "{\"email\":\"$TEST_DIR_EMAIL\",\"password\":\"$TEST_DIR_PASSWORD\"}" >/dev/null

  if [ "$(codigo -b $CKD $B/)" != "200" ]; then
    echo "  FALLO no he podido entrar con la cuenta de Direccion de prueba"
    fallo=$((fallo+1))
  else
    # Un cliente ajeno tiene que responder igual que uno inventado: si uno
    # diera 403 y el otro 404, se podria enumerar la cartera de los demas
    # probando identificadores.
    INVENTADO="cxxxxxxxxxxxxxxxxxxxxxxxx"
    A=$(curl -s -o /tmp/cs-a.txt -w '%{http_code}' -b $CKD -X PATCH "$B/api/centros/$TEST_AJENO_CENTRO" \
      -H 'Content-Type: application/json' -H "Origin: $B" -d '{"nombre":"x","pais":"y","canalOrigen":"Facebook"}')
    A="$A|$(cat /tmp/cs-a.txt)"
    I=$(curl -s -o /tmp/cs-i.txt -w '%{http_code}' -b $CKD -X PATCH "$B/api/centros/$INVENTADO" \
      -H 'Content-Type: application/json' -H "Origin: $B" -d '{"nombre":"x","pais":"y","canalOrigen":"Facebook"}')
    I="$I|$(cat /tmp/cs-i.txt)"
    if [ "$A" = "$I" ]; then
      echo "  OK    cliente ajeno indistinguible de uno inexistente ($A)"
      ok=$((ok+1))
    else
      echo "  FALLO cliente ajeno: $A | inexistente: $I"
      fallo=$((fallo+1))
    fi

    comprobar "descarga RGPD de un cliente ajeno" "404" "$(codigo -b $CKD "$B/api/centros/$TEST_AJENO_CENTRO/datos")"

    if [ -n "${TEST_AJENA_ESTANCIA:-}" ]; then
      A=$(curl -s -o /tmp/cs-a.txt -w '%{http_code}' -b $CKD -X PATCH "$B/api/estancias/$TEST_AJENA_ESTANCIA/estado" \
        -H 'Content-Type: application/json' -H "Origin: $B" -d '{"estado":"CONTACTADO"}')
      A="$A|$(cat /tmp/cs-a.txt)"
      I=$(curl -s -o /tmp/cs-i.txt -w '%{http_code}' -b $CKD -X PATCH "$B/api/estancias/$INVENTADO/estado" \
        -H 'Content-Type: application/json' -H "Origin: $B" -d '{"estado":"CONTACTADO"}')
      I="$I|$(cat /tmp/cs-i.txt)"
      if [ "$A" = "$I" ]; then
        echo "  OK    estancia ajena indistinguible de una inexistente ($A)"
        ok=$((ok+1))
      else
        echo "  FALLO estancia ajena: $A | inexistente: $I"
        fallo=$((fallo+1))
      fi
    fi

    # El alta de clientes busca duplicados en TODA la base, asi que no puede
    # devolver la ficha de uno que esta cuenta no gestiona.
    if [ -n "${TEST_AJENO_NOMBRE:-}" ]; then
      DUP=$(curl -s -b $CKD -X POST $B/api/centros -H 'Content-Type: application/json' -H "Origin: $B" \
        -d "{\"nombre\":\"$TEST_AJENO_NOMBRE\",\"pais\":\"Italia\"}")
      if printf '%s' "$DUP" | grep -q '"duplicados":\[\]'; then
        echo "  OK    duplicados no revela la ficha del cliente ajeno"
        ok=$((ok+1))
      else
        echo "  FALLO duplicados filtra datos del cliente ajeno: $DUP"
        fallo=$((fallo+1))
      fi

      # La exportacion a Excel es la via mas facil de sacar datos en bloque:
      # tiene que respetar la misma frontera. Se abre el fichero de verdad,
      # porque un xlsx va comprimido y buscar el texto a pelo no sirve.
      # La ruta se pide a Node en lugar de escribirla a mano: en Git Bash
      # sobre Windows, /tmp no significa lo mismo para el shell que para
      # Node, y el fichero se escribiria en un sitio y se leeria en otro.
      EXPORTADO=$(node -e "console.log(require('os').tmpdir()+'/cs-export.xlsx')")
      curl -s -b $CKD -o "$EXPORTADO" "$B/api/export"
      FUGA=$(node -e "
const ExcelJS=require('exceljs');
(async()=>{
  const wb=new ExcelJS.Workbook();
  await wb.xlsx.readFile(process.argv[2]);
  const nombres=[];
  for (const hoja of wb.worksheets) {
    hoja.eachRow((fila,n)=>{ if(n>1) nombres.push(String(fila.getCell(1).value ?? '')); });
  }
  console.log(nombres.includes(process.argv[1]) ? 'SI' : 'NO');
})().catch(()=>console.log('ERROR'));
" "$TEST_AJENO_NOMBRE" "$EXPORTADO" 2>/dev/null)
      case "$FUGA" in
        NO) echo "  OK    la exportacion a Excel no incluye el cliente ajeno"; ok=$((ok+1)) ;;
        SI) echo "  FALLO la exportacion a Excel incluye el cliente ajeno"; fallo=$((fallo+1)) ;;
        *)  echo "  --    no he podido leer el Excel exportado (falta exceljs o node)" ;;
      esac
      rm -f "$EXPORTADO"
    fi
  fi
fi

echo "== 13. Bloqueo por intentos fallidos =="
# Va al final a proposito: deja intentos registrados y bloquea ese email 15
# minutos. Se usa un email que no existe, para no dejar fuera a nadie real.
EMAIL_BLOQUEO="bloqueo-prueba@ejemplo-invalido.test"
ULTIMO=""
i=1
while [ $i -le 9 ]; do
  ULTIMO=$(codigo -X POST $B/api/auth/login -H 'Content-Type: application/json' -H "Origin: $B" \
    -d "{\"email\":\"$EMAIL_BLOQUEO\",\"password\":\"contrasena-equivocada-$i\"}")
  i=$((i+1))
done
comprobar "al noveno intento fallido responde 429" "429" "$ULTIMO"

echo ""
echo "RESULTADO: $ok correctas, $fallo fallidas"
[ "$fallo" -eq 0 ] || exit 1
