import "server-only";
import { NextResponse } from "next/server";

/**
 * Defensa contra CSRF ("falsificación de petición entre sitios").
 *
 * El ataque consiste en que una web maliciosa que tú visitas haga, sin que
 * te enteres, una petición al CRM aprovechando que tu navegador guarda la
 * cookie de sesión (por ejemplo, un formulario oculto que borra un cliente).
 *
 * Aquí hay dos barreras:
 *  1. La cookie es `sameSite: "lax"`: el navegador no la envía en peticiones
 *     POST/PATCH/DELETE que vengan de otro sitio.
 *  2. Esta comprobación: toda petición que cambie datos debe declarar que
 *     viene del propio CRM (cabecera `Origin`). El navegador rellena esa
 *     cabecera solo y una web atacante no la puede falsear.
 *
 * Las peticiones que se autentican con una clave de API (el bot de Facebook)
 * no llevan `Origin` y no usan cookies, así que este control no les aplica:
 * no son vulnerables a CSRF por definición.
 */

const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

function origenEsperado(request: Request): string | null {
  // Si se configura APP_ORIGIN (recomendado en producción) se exige ese
  // origen exacto; si no, se acepta el host por el que ha entrado la
  // petición, que es lo válido en desarrollo.
  const configurado = process.env.APP_ORIGIN?.trim();
  if (configurado) return configurado.replace(/\/$/, "");

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return null;
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/**
 * Devuelve una respuesta 403 si la petición no viene del propio CRM, o null
 * si todo está en orden.
 */
export function requireSameOrigin(request: Request): NextResponse | null {
  if (METODOS_SEGUROS.has(request.method)) return null;

  const origin = request.headers.get("origin");
  const esperado = origenEsperado(request);

  if (origin && esperado) {
    if (origin.replace(/\/$/, "") === esperado) return null;
    return NextResponse.json(
      { error: "Petición rechazada por seguridad." },
      { status: 403 }
    );
  }

  // Sin cabecera Origin: algunos navegadores antiguos no la envían en
  // formularios normales. Se acepta el Referer como alternativa.
  //
  // Aquí no basta con comprobar que el Referer EMPIECE por la dirección
  // esperada. Si la esperada es "https://crm.novaschool.es", una web
  // atacante que se registre el dominio "crm.novaschool.es.atacante.com"
  // tendría un Referer que empieza igual y pasaría el control. El host
  // tiene que ACABAR ahí: o coincide exacto, o lo siguiente es la barra
  // que separa la ruta.
  const referer = request.headers.get("referer");
  if (referer && esperado) {
    if (referer === esperado || referer.startsWith(`${esperado}/`)) return null;
  }

  return NextResponse.json(
    { error: "Petición rechazada por seguridad." },
    { status: 403 }
  );
}
