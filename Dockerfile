# ---- Dependencias ----
FROM node:20-slim AS deps
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build ----
FROM node:20-slim AS builder
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Genera el cliente Prisma y compila Next en modo standalone
RUN npx prisma generate
RUN npm run build

# ---- Runner ----
FROM node:20-slim AS runner
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Usuario sin privilegios
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Artefactos de la build standalone
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Scripts de operación (crear el administrador inicial). Están en JavaScript
# plano justo para poder ejecutarse aquí, donde no hay herramientas de
# desarrollo instaladas.
COPY --from=builder /app/scripts ./scripts

# Prisma: esquema, migraciones, CLI y cliente generado (para migrate deploy en el arranque)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000

# Comprobación de salud: si el CRM deja de responder, Docker lo marca como
# no sano y (con restart: unless-stopped) lo reinicia.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Aplica migraciones pendientes y arranca el servidor
ENTRYPOINT ["./docker-entrypoint.sh"]
