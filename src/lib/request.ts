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
  // Primer filtro, el barato: si la petición ya declara un tamaño excesivo,
  // se rechaza sin leer ni un byte.
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) return DEMASIADO_GRANDE;

  if (!request.body) return null;

  // Segundo filtro, el que de verdad protege: se lee a trozos y se corta en
  // cuanto se pasa del tope.
  //
  // Es importante NO usar request.text() aquí. Una petición puede no declarar
  // su tamaño (envío "chunked"), y en ese caso text() se traga el cuerpo
  // entero en memoria ANTES de que se pueda medir: bastaría con enviar unos
  // cientos de megas para tumbar el servidor, justo lo que este tope quiere
  // evitar. Leyendo por trozos, el consumo nunca pasa del tope.
  const lector = request.body.getReader();
  const trozos: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        // Se corta la conexión: no se sigue leyendo lo que no vamos a usar.
        await lector.cancel().catch(() => {});
        return DEMASIADO_GRANDE;
      }
      trozos.push(value);
    }
  } catch {
    return null;
  }

  try {
    return JSON.parse(Buffer.concat(trozos).toString("utf8"));
  } catch {
    return null;
  }
}
