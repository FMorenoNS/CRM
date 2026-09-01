import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/session";

/**
 * Devuelve la sesión o lanza una respuesta 401/403 lista para retornar.
 * Uso en route handlers:
 *   const auth = await requireApiUser();
 *   if (auth instanceof NextResponse) return auth;
 *   const user = auth; // SessionUser
 */
export async function requireApiUser(): Promise<SessionUser | NextResponse> {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  return user;
}

export async function requireApiAdmin(): Promise<SessionUser | NextResponse> {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo un administrador puede realizar esta acción." },
      { status: 403 }
    );
  }
  return user;
}
