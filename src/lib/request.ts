import "server-only";

/**
 * Obtiene la IP de quien hace la petición. Detrás de un proxy inverso
 * (Nginx, Cloudflare, Vercel...) la IP real llega en una cabecera.
 *
 * IMPORTANTE para producción: estas cabeceras las puede falsear el cliente
 * si el CRM está expuesto directamente a Internet. El proxy inverso debe
 * estar configurado para SOBRESCRIBIRLAS, no para añadirlas. Se usa solo
 * para limitar intentos y para el registro de actividad, nunca para decidir
 * permisos.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return (
    request.headers.get("x-real-ip")?.slice(0, 64) ??
    request.headers.get("cf-connecting-ip")?.slice(0, 64) ??
    "desconocida"
  );
}

export function getUserAgent(request: Request): string | null {
  return request.headers.get("user-agent")?.slice(0, 300) ?? null;
}

/**
 * Lee el cuerpo JSON de una petición con un tope de tamaño. Sin este tope,
 * cualquiera podría enviar un cuerpo de cientos de megas y tumbar el
 * servidor por consumo de memoria.
 *
 * Devuelve `null` si no es JSON válido, y el símbolo DEMASIADO_GRANDE si
 * excede el límite.
 */
export const DEMASIADO_GRANDE = Symbol("cuerpo-demasiado-grande");

export async function readJsonBody(
  request: Request,
  maxBytes = 256 * 1024 // 256 KB por defecto
): Promise<unknown | null | typeof DEMASIADO_GRANDE> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) return DEMASIADO_GRANDE;

  const text = await request.text().catch(() => null);
  if (text === null) return null;
  // Se mide en bytes reales, no en caracteres (un emoji ocupa 4 bytes).
  if (Buffer.byteLength(text, "utf8") > maxBytes) return DEMASIADO_GRANDE;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
