import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;
  nombre: string;
  email: string;
  role: "ADMIN" | "MARKETING" | "DIRECCION";
  // Clientes asignados a este usuario. Solo restringe de verdad el acceso
  // cuando role === "DIRECCION"; ADMIN y MARKETING ven todos los clientes.
  centroIds: string[];
  // true si un administrador le puso una contraseña temporal: hasta que la
  // cambie, el CRM le lleva siempre a la pantalla de cambio de contraseña.
  debeCambiarPassword: boolean;
};

const COOKIE_NAME = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días
// Cada cuánto se refresca "última vez visto" (para no escribir en la base de
// datos en cada clic).
const LAST_SEEN_REFRESH_MS = 5 * 60 * 1000;

/**
 * El token de sesión es una tira de 32 bytes al azar, sin ningún significado
 * ("opaco"): no se puede deducir nada de él ni modificarlo para hacerse
 * pasar por otro. En la base de datos solo se guarda su huella SHA-256, de
 * forma que ni con una copia de la base de datos se pueden fabricar sesiones.
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Devuelve el usuario de la sesión actual, o null. Consulta la base de datos
 * en cada petición, así que si la sesión se anula, caduca, o la cuenta se
 * desactiva, el efecto es inmediato.
 */
export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { include: { centros: { select: { id: true } } } },
    },
  });

  if (!session) return null;

  // Sesión caducada: se borra al detectarla (limpieza perezosa).
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (!session.user.activo) return null;

  if (Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_REFRESH_MS) {
    await prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }

  return {
    id: session.user.id,
    nombre: session.user.nombre,
    email: session.user.email,
    role: session.user.role,
    centroIds: session.user.centros.map((c) => c.id),
    debeCambiarPassword: session.user.debeCambiarPassword,
  };
}

/** Abre una sesión nueva para un usuario y deja la cookie en el navegador. */
export async function createSession(
  userId: string,
  meta?: { ip?: string | null; userAgent?: string | null }
): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + MAX_AGE_SECONDS * 1000);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent?.slice(0, 300) ?? null,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    // El JavaScript de la página no puede leerla: si alguna vez hubiera un
    // XSS, no podría robar la sesión.
    httpOnly: true,
    // En producción solo viaja por HTTPS.
    secure: process.env.NODE_ENV === "production",
    // No se envía en peticiones que vengan de otra web (defensa CSRF).
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Cierra la sesión actual (borra la fila y la cookie). */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => {});
  }
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Cierra TODAS las sesiones de un usuario en todos sus dispositivos. Se usa
 * al cambiar la contraseña, al desactivar una cuenta y desde el botón
 * "cerrar sesión en todos los dispositivos".
 */
export async function deleteAllSessionsForUser(userId: string): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { userId } });
  return count;
}

/** Borra de la base de datos las sesiones ya caducadas. */
export async function purgeExpiredSessions(): Promise<number> {
  const { count } = await prisma.session.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  return count;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
