#!/bin/sh
set -e

echo "Aplicando migraciones de base de datos..."
node_modules/.bin/prisma migrate deploy

echo "Arrancando el servidor Next.js..."
exec node server.js
