# CRM Erasmus+ — Residencia Novaschool Granada

CRM para gestionar la captación de centros educativos extranjeros interesados en
programas de movilidad Erasmus+ alojados en la residencia de Novaschool en Granada.

## Qué hace

- **Centros de origen** (el "interesado"): ficha del colegio/institución con sus contactos.
- **Estancias**: cada oportunidad de movilidad de un centro (un centro puede tener varias),
  con su propio pipeline, fechas, edad del grupo y etiqueta alumnos/profesores.
- **Pipeline (kanban)**: Interesado → Contactado → En conversación → Presupuesto enviado →
  Presupuesto confirmado → Contrato firmado → Alojado → Finalizado (+ Perdido).
- **Interacciones**: historial de llamadas/emails/WhatsApp/notas por estancia.
- **Panel**: nº de centros, tasa de conversión, procedencia por país, embudo por estado y
  **seguimientos pendientes** (estancias activas sin contacto en 7+ días).
- **Usuarios y roles**: Administrador (crea cuentas y cambia contraseñas), Marketing y Dirección.
- **Envío de presupuestos/contratos** por email vía Microsoft 365 (pendiente de credenciales, ver abajo).

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind
- PostgreSQL + Prisma
- Autenticación propia: contraseñas con **argon2id** y sesiones con token opaco
  guardado en base de datos (cookie `httpOnly`) — sin dependencias externas
- Todo el back-office vía **Route Handlers** (`/api/...`)

## Desarrollo local

Requisitos: Node.js 20+ y PostgreSQL.

```bash
npm install
cp .env.example .env        # edita DATABASE_URL y SEED_ADMIN_*
npx prisma migrate dev      # crea las tablas
npm run db:seed             # crea el usuario administrador inicial
npm run dev                 # http://localhost:3000
```

El usuario inicial se define **solo** en `.env` (`SEED_ADMIN_EMAIL` y
`SEED_ADMIN_PASSWORD`): el seed se niega a funcionar si faltan, para que no haya
ninguna contraseña escrita en el código. Esa contraseña nace marcada como
temporal: al primer acceso el CRM obliga a elegir otra. Después, borra
`SEED_ADMIN_PASSWORD` del `.env`.

## Variables de entorno

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión PostgreSQL. |
| `APP_ORIGIN` | Dirección pública del CRM (`https://crm.tudominio.es`, sin barra final). Se usa para la protección anti-CSRF. En desarrollo puede quedar vacía. |
| `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` / `AZURE_TENANT_ID` / `AZURE_SENDER_EMAIL` | Credenciales de Microsoft Graph para el envío de correo (opcionales; ver abajo). |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Credenciales del admin que crea el seed. |

## Despliegue con Docker (recomendado)

La aplicación se empaqueta como imagen autónoma (Next.js `standalone`) junto con PostgreSQL.

### Opción A — instalación asistida (recomendada)

```bash
sh scripts/instalar.sh
```

Pregunta el dominio y el correo del administrador, **genera solas** las
contraseñas aleatorias, levanta los contenedores, crea la cuenta de
administrador y retira la contraseña temporal al terminar. Muestra al final lo
que queda por hacer a mano.

No configura el proxy inverso, las copias de seguridad ni ejecuta la batería
de seguridad: son decisiones que dependen de la infraestructura y las hace IT.

### Opción B — paso a paso

```bash
# 1. Crea el .env a partir de la plantilla y rellénalo:
cp .env.example .env && chmod 600 .env
#    POSTGRES_PASSWORD=...      (SOLO letras y números: openssl rand -hex 24)
#    APP_ORIGIN=https://crm.tudominio.es
#    SEED_ADMIN_EMAIL=... y SEED_ADMIN_PASSWORD=...
# 2. Levanta los servicios:
docker compose up -d --build
# 3. Crea el usuario administrador (primera vez):
docker compose exec app node scripts/crear-admin.mjs
# 4. Borra SEED_ADMIN_PASSWORD del .env y recrea el contenedor:
docker compose up -d --force-recreate app
```

> `POSTGRES_PASSWORD` debe ser alfanumérica: se inserta dentro de la URL de
> conexión y un carácter `/` la rompe. Usa `openssl rand -hex 24`, **no**
> `openssl rand -base64`.

Las migraciones se aplican automáticamente al arrancar el contenedor
(`prisma migrate deploy` en el entrypoint). La app escucha en
`127.0.0.1:3000`: no queda expuesta a la red, tiene que llegarse a ella a
través del proxy inverso con HTTPS.

## Despliegue sin Docker

En un servidor con Node.js 20+ y acceso a PostgreSQL:

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm run db:seed          # solo la primera vez
node .next/standalone/server.js   # o `npm start`
```

Define las variables de entorno del sistema antes de arrancar. Se recomienda un
proceso supervisado (systemd, pm2) y se **requiere** un proxy inverso (nginx) con
HTTPS: el CRM envía `Strict-Transport-Security` y la cookie de sesión es `secure`,
así que sin HTTPS no se podrá iniciar sesión en producción.

El proxy inverso debe además:

- **sobrescribir** (no añadir) las cabeceras `X-Forwarded-For` y
  `X-Forwarded-Proto`, para que la IP que se registra no la pueda falsear el
  cliente;
- aplicar un límite de peticiones propio, que es el que funciona si algún día el
  CRM corre en varias copias a la vez.

## Envío de correo (Microsoft 365) — pendiente de IT

El envío de presupuestos/contratos usa **Microsoft Graph API**. Hasta que esté
configurado, el botón de envío aparece deshabilitado con un aviso; el resto del CRM
funciona con normalidad. Para activarlo, IT de Novaschool debe:

1. **Azure Portal → App registrations → New registration**: registrar una aplicación.
2. **API permissions**: añadir el permiso de **aplicación** `Mail.Send` (Microsoft Graph)
   y otorgar el **consentimiento de administrador**. Recomendado: limitar el envío a la
   cuenta remitente con una *Application Access Policy* (`New-ApplicationAccessPolicy`).
3. **Certificates & secrets**: crear un *client secret*.
4. Rellenar las variables de entorno y reiniciar la app:
   - `AZURE_TENANT_ID` (Directory / tenant ID)
   - `AZURE_CLIENT_ID` (Application / client ID)
   - `AZURE_CLIENT_SECRET` (valor del secreto)
   - `AZURE_SENDER_EMAIL` (buzón remitente, p. ej. `comunicacion@novaschool.es`)

Las plantillas reales de presupuesto y contrato se integrarán cuando estén disponibles.

## Roles y permisos

- **Administrador**: ve y edita todos los clientes; único rol que gestiona usuarios y claves
  de API (`/usuarios`).
- **Marketing**: ve todos los clientes y puede registrar interacciones, enviar documentos y
  mover la pipeline, pero no puede editar ni borrar clientes, contactos o estancias (datos
  maestros).
- **Dirección**: solo ve y edita (incluidos datos maestros) los clientes que tenga asignados
  en su perfil de usuario. Al crear un cliente nuevo, se le asigna automáticamente.

La lógica vive en `src/lib/permissions.ts` y se aplica tanto en las páginas (qué se lista,
qué formularios aparecen en modo lectura) como en cada ruta de API (rechaza con 403 aunque
alguien se salte la interfaz).

## Integraciones externas (claves de API)

Pensado para el bot de captación desde grupos de Facebook (o cualquier otra integración):
cualquier ruta de `/api/*` que ya usan la interfaz acepta también una clave de API en vez de
la sesión de navegador.

1. Como administrador, crea un usuario dedicado a la integración (p. ej. rol Marketing, ya
   que puede dar de alta clientes/estancias y registrar captaciones pero no toca datos
   maestros de otros).
2. En `/usuarios`, sección **Claves de API**, crea una clave "actuando como" ese usuario.
   El valor solo se muestra una vez al crearla — guárdalo en el gestor de secretos que use
   la integración, no se puede recuperar después.
3. Cada petición debe incluir la cabecera `Authorization: Bearer <clave>`. La clave hereda
   el rol y los clientes asignados del usuario al que está vinculada, así que la
   autorización no necesita ninguna lógica distinta a la de un usuario normal.
4. El endpoint principal para volcar un lead es `POST /api/centros`: crea el cliente, su
   contacto principal, su primera estancia y (si se manda `grupoUrl`) la interacción de
   captación de Facebook, todo en una sola llamada. Revocar o eliminar una clave desde la
   misma pantalla la invalida al instante.

## Seguridad

Resumen de lo que hay implementado y dónde está, para poder auditarlo o retomarlo
más adelante.

### Contraseñas y acceso

- **argon2id** (`src/lib/passwords.ts`) con los parámetros que recomienda OWASP
  (19 MiB de memoria, 2 pasadas). Los hashes antiguos de bcrypt siguen valiendo y
  se reescriben a argon2id de forma transparente en el siguiente acceso correcto.
- Mínimo **10 caracteres**, con rechazo de contraseñas previsibles y de las que
  contienen el propio email.
- **Un único mensaje de error** para cualquier fallo de acceso ("Email o
  contraseña incorrectos"), y **tiempos de respuesta igualados**: si el email no
  existe se compara contra un hash señuelo, así nadie puede averiguar qué emails
  están registrados midiendo lo que tarda el servidor.
- **Límite de intentos** (`src/lib/rate-limit.ts`), guardado en base de datos para
  que sobreviva a un reinicio: 8 fallos por email o 25 por IP en 15 minutos
  bloquean temporalmente.
- Las contraseñas que pone un administrador nacen **temporales**: el usuario está
  obligado a elegir la suya al entrar (`/cambiar-password`).
- No hay registro público ni recuperación por email: las cuentas las crea el
  administrador. Por eso tampoco hay verificación de email — el alta manual por
  un administrador cumple la misma función.

### Sesiones

- Token **aleatorio y opaco** de 32 bytes; en la base de datos solo se guarda su
  huella SHA-256 (tabla `Session`). Ni con una copia de la base de datos se
  pueden fabricar sesiones válidas.
- Cookie `httpOnly` + `secure` (en producción) + `sameSite=lax`.
- **Se pueden anular**: al cambiar la contraseña, al desactivar o cambiar de rol a
  un usuario, y desde "Cerrar en todos los dispositivos" en el menú de usuario.
- Caducan a los 7 días y las caducadas se borran solas.

### Control de acceso

- Se comprueba **en el servidor en cada acción**, no escondiendo botones.
- En cada ruta de API se busca a qué cliente pertenece el registro antes de
  tocarlo, así que cambiar un identificador en la URL no da acceso a datos de
  otro (IDOR).
- Cuando no hay permiso se responde "no encontrado" en lugar de "prohibido": así
  no se revela si un registro existe.
- Un administrador no puede quitarse a sí mismo el rol ni desactivar su cuenta, y
  nunca se puede dejar el CRM sin ningún administrador activo.

### Entradas y salida a pantalla

- Todas las consultas pasan por Prisma con parámetros: **no hay SQL escrito a
  mano**, así que no cabe inyección SQL.
- React escapa el texto por defecto y no se usa `dangerouslySetInnerHTML` en
  ningún sitio.
- Validación con Zod y **tope de longitud en todos los campos**; tope de tamaño en
  el cuerpo de cada petición (`readJsonBody`, 256 KB por defecto).
- Las capturas de la captación se validan como imagen real (`data:image/...`); no
  se acepta cualquier `data:`.

### Cabeceras y navegador

- **Content-Security-Policy** estricta con *nonce* por carga y `strict-dynamic`
  (`src/middleware.ts`): en producción no se ejecuta ningún script ni estilo en
  línea. Verificado sin errores de consola en el build de producción.
- `Strict-Transport-Security`, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy` y COOP/CORP (`next.config.ts`).
- `x-powered-by` desactivado: el servidor no anuncia con qué está hecho.
- **Anti-CSRF** (`src/lib/csrf.ts`): toda acción que cambie datos debe venir del
  propio CRM (cabecera `Origin`). Las claves de API quedan exentas porque no usan
  cookies y por definición no son vulnerables a CSRF.

### Registro de actividad y datos personales

- Tabla `AuditLog`: cambios sobre clientes, inicios y cierres de sesión, intentos
  fallidos, bloqueos, alta y modificación de usuarios, emisión y revocación de
  claves de API, y **cada exportación de datos** (quién se llevó qué y cuándo).
- **Purga automática** a los 2 años (`RETENCION_HISTORIAL_DIAS`); los intentos de
  acceso se purgan a los 30 días. La limpieza se dispara de forma oportunista al
  iniciar sesión, sin depender de tareas externas.
- **Derecho de acceso (RGPD art. 15)**: enlace "Descargar sus datos (RGPD)" en la
  ficha de cada cliente; devuelve en un fichero todo lo guardado sobre él y sus
  personas de contacto.
- **Derecho de supresión (art. 17)**: borrar el cliente elimina en cascada sus
  contactos, estancias, interacciones y documentos, y queda constancia de quién lo
  borró.
- Las exportaciones a Excel están limitadas a 20 por hora y usuario, y se
  registran.
- No hay analítica ni cookies de terceros, así que **no hace falta banner de
  cookies**: la única cookie es la de sesión, que es técnicamente necesaria.

### Errores

Cualquier fallo interno devuelve un mensaje neutro con un **código de referencia**
corto; la traza completa queda solo en el registro del servidor asociada a ese
código (`src/lib/http.ts`). Por ejemplo, el usuario ve
`"...avisa a IT con este código: 774aa8db."` y en el servidor aparece
`[CRM] Error en POST /api/estancias (ref. 774aa8db): ...`.

### Copias de seguridad

```bash
npm run db:backup
npm run db:restore-test backups/crm-AAAAMMDD-HHMMSS.dump
```

La restauración de prueba trabaja sobre una base de datos aparte
(`crm_erasmus_restore_test`) y no toca los datos reales; al terminar muestra el
recuento de filas para confirmar que la copia sirve. **Conviene hacerlo una vez al
mes.** Para restaurar de verdad en un desastre:
`CONFIRMAR_PRODUCCION=si sh scripts/restore.sh <fichero>`.

Los ficheros de copia llevan datos personales: guárdalos cifrados y **fuera** del
servidor del CRM. Están excluidos del repositorio en `.gitignore`.

### Pendiente / conocido

- `npm audit` deja 7 avisos sin arreglo no destructivo: `postcss` (vía Next),
  `deepmerge-ts` (vía la herramienta de línea de comandos de Prisma) y `uuid` (vía
  `exceljs`). Los tres están en **herramientas de compilación**, no en código que
  se ejecute atendiendo peticiones, y sus arreglos exigen subir de versión mayor
  (Next 15→16, Excel 4→3). Revisar cuando se planifique la subida a Next 16.
- El límite general de peticiones es en memoria: válido para un despliegue de una
  sola copia. Con varias instancias, ponerlo en el proxy inverso.
- Los datos del CRM no están cifrados campo a campo en la base de datos. Para el
  tipo de datos que guarda (nombre, email y teléfono de contactos profesionales)
  lo adecuado es cifrar el disco del servidor y las copias de seguridad, no cada
  columna.

## Fuera de alcance (fases futuras)

- Gestión de plazas/ocupación de la residencia.
- Documentación Erasmus+ (Learning Agreement, etc.).
- El bot que lee los grupos de Facebook en sí (el lado del CRM ya está listo para recibir
  sus datos vía clave de API; falta la parte que interpreta los posts).
