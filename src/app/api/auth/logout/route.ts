import { NextResponse } from "next/server";
import { deleteSession, getSession } from "@/lib/session";
import { registrarEventoSistema } from "@/lib/audit";
import { getClientIp } from "@/lib/request";
import { requireSameOrigin } from "@/lib/csrf";
import { withApi } from "@/lib/http";

async function handlerPOST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const user = await getSession();
  await deleteSession();

  if (user) {
    await registrarEventoSistema({
      actorId: user.id,
      actorEmail: user.email,
      accion: "Cierre de sesión",
      ip: getClientIp(request),
    });
  }

  return NextResponse.json({ ok: true });
}

// Cada método se publica envuelto en withApi: si algo falla por dentro, el
// usuario recibe un mensaje genérico con un código de referencia y el
// detalle completo queda solo en el registro del servidor.
export const POST = withApi("POST /api/auth/logout", handlerPOST as never);
