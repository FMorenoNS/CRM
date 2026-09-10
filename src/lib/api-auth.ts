import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/session";
import { getUserFromApiKey } from "@/lib/api-keys";
import { requireSameOrigin } from "@/lib/csrf";
import { comprobarLimiteMemoria } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

function demasiadasPeticiones(segundos: number) {
  return NextResponse.json(
    { error: "Demasiadas peticiones. Espera unos segundos." },
    { status: 429, headers: { "Retry-After": String(segundos) } }
  );
}

/**
 * Límite general contra abuso: 480 peticiones por minuto y por IP. Un uso
 * normal del CRM ni se acerca; un script desbocado o un intento de sacar
 * datos a lo bruto sí.
 */
function comprobarAbuso(request: Request): NextResponse | null {
  const limite = comprobarLimiteMemoria(`api:${getClientIp(request)}`, 480, 60);
  return limite.bloqueado ? demasiadasPeticiones(limite.segundosEspera) : null;
}

/**
 * Devuelve el usuario autenticado (por sesión de navegador o por clave de
 * API en la cabecera `Authorization: Bearer <clave>`) o una respuesta lista
 * para retornar si algo falla.
 *
 * Además de autenticar, aquí se aplican de forma centralizada tres controles
 * que antes no existían, de manera que ninguna ruta de la API se los pueda
 * olvidar:
 *   - límite general de peticiones por IP;
 *   - comprobación anti-CSRF en todo lo que cambie datos (solo para sesiones
 *     de navegador: las claves de API no usan cookies y no son vulnerables);
 *   - bloqueo de quien tenga una contraseña temporal pendiente de cambiar.
 *
 * Uso en route handlers:
 *   const auth = await requireApiUser(request);
 *   if (auth instanceof NextResponse) return auth;
 *   const user = auth; // SessionUser
 */
export async function requireApiUser(
  request: Request
): Promise<SessionUser | NextResponse> {
  const abuso = comprobarAbuso(request);
  if (abuso) return abuso;

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

  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (user.debeCambiarPassword) {
    return NextResponse.json(
      { error: "Tienes que cambiar tu contraseña antes de seguir." },
      { status: 403 }
    );
  }
  return user;
}

/**
 * Igual que requireApiUser, pero exige rol de administrador y NO acepta
 * claves de API: las acciones de administración (crear usuarios, emitir
 * claves) solo se hacen desde el navegador, con una persona detrás.
 */
export async function requireApiAdmin(
  request: Request
): Promise<SessionUser | NextResponse> {
  const abuso = comprobarAbuso(request);
  if (abuso) return abuso;

  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (user.debeCambiarPassword) {
    return NextResponse.json(
      { error: "Tienes que cambiar tu contraseña antes de seguir." },
      { status: 403 }
    );
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo un administrador puede realizar esta acción." },
      { status: 403 }
    );
  }
  return user;
}
