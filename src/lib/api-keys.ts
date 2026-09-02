import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";

const KEY_PREFIX = "crm_live_";

// Genera una clave nueva en texto plano (se muestra una única vez al
// crearla) y su hash, que es lo único que se guarda en la base de datos.
export function generateApiKey(): { token: string; hash: string } {
  const random = crypto.randomBytes(24).toString("hex");
  const token = `${KEY_PREFIX}${random}`;
  return { token, hash: hashApiKey(token) };
}

export function hashApiKey(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Valida una clave recibida en la cabecera Authorization y, si es válida,
// devuelve el usuario al que representa con el mismo formato que
// getSession(), para que el resto de la app (permisos incluidos) no tenga
// que distinguir entre sesión de navegador y clave de API: la clave actúa
// "como" el usuario al que está vinculada, con su mismo rol y sus mismos
// clientes asignados.
export async function getUserFromApiKey(
  token: string
): Promise<SessionUser | null> {
  const hash = hashApiKey(token);
  const apiKey = await prisma.apiKey.findUnique({
    where: { hash },
    include: { user: { include: { centros: { select: { id: true } } } } },
  });
  if (!apiKey || !apiKey.activo || !apiKey.user.activo) return null;

  await prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    id: apiKey.user.id,
    nombre: apiKey.user.nombre,
    email: apiKey.user.email,
    role: apiKey.user.role,
    centroIds: apiKey.user.centros.map((c) => c.id),
  };
}
