import "server-only";
import { SignJWT, jwtVerify } from "jose";
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
};

const COOKIE_NAME = "session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días

function getKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET no está configurado.");
  return new TextEncoder().encode(secret);
}

export async function encryptSession(user: SessionUser): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getKey());
}

export async function decryptSession(
  token: string | undefined
): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getKey(), {
      algorithms: ["HS256"],
    });
    return (payload.user as SessionUser) ?? null;
  } catch {
    return null;
  }
}

// Para Server Components / Route Handlers.
// Verifica la sesión contra la base de datos en cada petición: si la cuenta ya
// no existe o ha sido desactivada, la sesión deja de ser válida de inmediato
// (el usuario es expulsado en su siguiente navegación). Además mantiene el rol
// y el nombre siempre sincronizados con la BD.
export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const decoded = await decryptSession(token);
  if (!decoded) return null;

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    include: { centros: { select: { id: true } } },
  });
  if (!user || !user.activo) return null;

  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    role: user.role,
    centroIds: user.centros.map((c) => c.id),
  };
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await encryptSession(user);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
