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
- Autenticación propia con sesión JWT (cookie httpOnly, `jose` + `bcrypt`) — sin dependencias externas
- Todo el back-office vía **Route Handlers** (`/api/...`)

## Desarrollo local

Requisitos: Node.js 20+ y PostgreSQL.

```bash
npm install
cp .env.example .env        # edita DATABASE_URL y AUTH_SECRET
npx prisma migrate dev      # crea las tablas
npm run db:seed             # crea el usuario administrador inicial
npm run dev                 # http://localhost:3000
```

Usuario inicial (definido en `.env`, cámbialo tras el primer acceso):
`admin@novaschool.es` / `CambiaEstaClave123!`

## Variables de entorno

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión PostgreSQL. |
| `AUTH_SECRET` | Secreto para firmar las sesiones. Genera uno con `openssl rand -base64 32`. |
| `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` / `AZURE_TENANT_ID` / `AZURE_SENDER_EMAIL` | Credenciales de Microsoft Graph para el envío de correo (opcionales; ver abajo). |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Credenciales del admin que crea el seed. |

## Despliegue con Docker (recomendado)

La aplicación se empaqueta como imagen autónoma (Next.js `standalone`) junto con PostgreSQL.

```bash
# 1. Crea un .env en la raíz con al menos:
#    AUTH_SECRET=...            (openssl rand -base64 32)
#    POSTGRES_PASSWORD=...      (clave de la base de datos)
# 2. Levanta los servicios:
docker compose up -d --build
# 3. Crea el usuario administrador (primera vez):
docker compose exec app node_modules/.bin/prisma db seed
```

Las migraciones se aplican automáticamente al arrancar el contenedor
(`prisma migrate deploy` en el entrypoint). La app queda en `http://<servidor>:3000`.

> Nota: aún no se conoce el entorno exacto del servidor de Novaschool. Si tiene Docker,
> este es el camino más portable. Si no, ver "Despliegue sin Docker".

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
proceso supervisado (systemd, pm2) y un proxy inverso (nginx) con HTTPS.

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

- **Administrador**: acceso total + gestión de usuarios (`/usuarios`).
- **Marketing** y **Dirección**: ven y editan centros, contactos y estancias.
  (El detalle fino de qué puede editar cada rol se afinará más adelante.)

## Fuera de alcance (fases futuras)

- Gestión de plazas/ocupación de la residencia.
- Documentación Erasmus+ (Learning Agreement, etc.).
- Automatización de la captación desde grupos de Facebook.
