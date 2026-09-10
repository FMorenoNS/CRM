import "server-only";
import crypto from "crypto";
import { NextResponse } from "next/server";

/**
 * Envoltura para las rutas de la API.
 *
 * Si algo se rompe por dentro (la base de datos no responde, un dato
 * inesperado, un fallo de red...), al usuario se le devuelve SIEMPRE el
 * mismo mensaje genérico junto a un código de referencia corto. El detalle
 * completo del error —con su traza— se escribe únicamente en el registro del
 * servidor, asociado a ese mismo código.
 *
 * Así, si alguien llama diciendo "me sale el error 3f9a21c4", se puede
 * localizar exactamente qué pasó, sin que el mensaje de la pantalla haya
 * revelado nada de cómo está hecho el CRM por dentro (nombres de tablas,
 * rutas de ficheros, versiones...), que es justo lo que busca quien intenta
 * atacarlo.
 */

const MENSAJE_GENERICO =
  "Se ha producido un error. Vuelve a intentarlo; si sigue pasando, avisa a IT con este código";

type Contexto = { params: Promise<Record<string, string>> };
type Handler = (request: Request, contexto: Contexto) => Promise<Response>;

export function withApi(nombre: string, handler: Handler): Handler {
  return async function rutaProtegida(request, contexto) {
    try {
      return await handler(request, contexto);
    } catch (error) {
      const referencia = crypto.randomBytes(4).toString("hex");
      console.error(
        `[CRM] Error en ${nombre} (ref. ${referencia}):`,
        error instanceof Error ? error.stack || error.message : error
      );
      return NextResponse.json(
        { error: `${MENSAJE_GENERICO}: ${referencia}.` },
        { status: 500 }
      );
    }
  };
}
