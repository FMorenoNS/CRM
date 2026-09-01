import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@novaschool.es";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "CambiaEstaClave123!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`El usuario administrador ${email} ya existe.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { nombre: "Administrador", email, passwordHash, role: "ADMIN" },
  });

  console.log(`Usuario administrador creado: ${email} / ${password}`);
  console.log("Cambia esta contraseña en cuanto inicies sesión.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
