/**
 * Crea el usuario administrador inicial del CRM.
 *
 * Está escrito en JavaScript plano a propósito, sin ninguna herramienta de
 * desarrollo: así funciona igual en un portátil y DENTRO del contenedor de
 * producción, donde solo hay Node y las librerías estrictamente necesarias.
 *
 * Uso en local:
 *     npm run db:seed
 *
 * Uso en el servidor (Docker):
 *     docker compose exec app node scripts/crear-admin.mjs
 *
 * Necesita tres variables de entorno: DATABASE_URL, SEED_ADMIN_EMAIL y
 * SEED_ADMIN_PASSWORD. Si no están en el entorno, se leen del fichero .env.
 *
 * Es seguro ejecutarlo varias veces: si el usuario ya existe, no toca nada.
 */
import fs from "node:fs";
import path from "node:path";
import * as argon2 from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";

const MIN_LENGTH = 10;

/**
 * Lector mínimo de .env. En el contenedor las variables ya vienen puestas y
 * no hay fichero .env (queda fuera de la imagen a propósito, para que los
 * secretos no viajen dentro de ella), así que esto solo actúa en local.
 */
function cargarEnvSiHaceFalta() {
  const necesarias = [
    "DATABASE_URL",
    "SEED_ADMIN_EMAIL",
    "SEED_ADMIN_PASSWORD",
  ];
  if (necesarias.every((k) => process.env[k])) return;

  const ruta = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(ruta)) return;

  for (const linea of fs.readFileSync(ruta, "utf8").split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const igual = limpia.indexOf("=");
    if (igual < 1) continue;
    const clave = limpia.slice(0, igual).trim();
    let valor = limpia.slice(igual + 1).trim();
    // Quita las comillas que envuelven el valor, si las hay.
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (!(clave in process.env)) process.env[clave] = valor;
  }
}

async function main() {
  cargarEnvSiHaceFalta();

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  // No hay ningún valor por defecto a propósito: una contraseña de
  // administrador escrita en el código es una contraseña pública.
  if (!email || !password) {
    throw new Error(
      "Faltan SEED_ADMIN_EMAIL y/o SEED_ADMIN_PASSWORD.\n" +
        "Genera una contraseña larga y aleatoria (openssl rand -hex 24) y\n" +
        "ponla en el entorno o en el fichero .env antes de ejecutar esto."
    );
  }
  if (password.length < MIN_LENGTH) {
    throw new Error(
      `SEED_ADMIN_PASSWORD debe tener al menos ${MIN_LENGTH} caracteres.`
    );
  }

  const prisma = new PrismaClient();
  try {
    const existente = await prisma.user.findUnique({ where: { email } });
    if (existente) {
      console.log(`El usuario administrador ${email} ya existe. No se toca.`);
      return;
    }

    const passwordHash = await argon2.hash(password, {
      algorithm: 2, // Argon2id
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    await prisma.user.create({
      data: {
        nombre: "Administrador",
        email,
        passwordHash,
        role: "ADMIN",
        // Obliga a elegir una contraseña propia en el primer acceso, para que
        // la que está en la configuración deje de servir cuanto antes.
        debeCambiarPassword: true,
        passwordUpdatedAt: new Date(),
      },
    });

    console.log(`Usuario administrador creado: ${email}`);
    console.log(
      "Entra con la contraseña configurada: el CRM te pedirá cambiarla al momento."
    );
    console.log(
      "Después, borra SEED_ADMIN_PASSWORD de la configuración: ya no hace falta."
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
