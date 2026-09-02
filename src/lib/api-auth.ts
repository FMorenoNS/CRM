import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/session";
import { getUserFromApiKey } from "@/lib/api-keys";

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

/**
 * Devuelve el usuario autenticado (por sesión de navegador o por clave de
 * API en la cabecera `Authorization: Bearer <clave>`) o una respuesta
 * 401 lista para retornar. Uso en route handlers:
 *   const auth = await requireApiUser(request);
 *   if (auth instanceof NextResponse) return auth;
 *   const user = auth; // SessionUser
 */
export async function requireApiUser(
  request: Request
): Promise<SessionUser | NextResponse> {
  const token = getBearerToken(request);
  if (token) {
    const user = await getUserFromApiKey(token);
    if (!user) {
      return NextResponse.json(
        { error: "Clave de API no válida." },
        { status: 401 }
      );
    }
    return user;
  }

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
