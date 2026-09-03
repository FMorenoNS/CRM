import { NextResponse } from "next/server";
import { deleteAllSessionsForUser, getSession } from "@/lib/session";
import { registrarEventoSistema } from "@/lib/audit";
import { getClientIp } from "@/lib/request";
import { requireSameOrigin } from "@/lib/csrf";
import { withApi } from "@/lib/http";

/**
 * Cierra la sesión en TODOS los dispositivos del usuario actual (incluido
 * este). Útil si sospecha que alguien ha usado su cuenta o si se ha dejado
 * la sesión abierta en otro ordenador.
 */
async function handlerPOST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const cerradas = await deleteAllSessionsForUser(user.id);

  await registrarEventoSistema({
    actorId: user.id,
    actorEmail: user.email,
    accion: "Cierre de sesión en todos los dispositivos",
    detalle: `${cerradas} sesión(es) cerradas`,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true, cerradas });
}

// Cada método se publica envuelto en withApi: si algo falla por dentro, el
// usuario recibe un mensaje genérico con un código de referencia y el
// detalle completo queda solo en el registro del servidor.
export const POST = withApi("POST /api/auth/logout-all", handlerPOST as never);
