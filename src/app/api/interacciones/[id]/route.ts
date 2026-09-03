import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { registrarHistorial } from "@/lib/audit";
import { INTERACCION_LABELS } from "@/lib/labels";
import { canDoOperational, forbidden } from "@/lib/permissions";
import { withApi } from "@/lib/http";

async function handlerDELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id } = await params;

  const existing = await prisma.interaccion.findUnique({
    where: { id },
    include: { estancia: { select: { centroId: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }
  if (!canDoOperational(user, existing.estancia.centroId)) return forbidden();

  const interaccion = await prisma.interaccion.delete({
    where: { id },
    include: { estancia: { select: { centroId: true } } },
  });

  await registrarHistorial({
    centroId: interaccion.estancia.centroId,
    actorId: user.id,
    accion: `Interacción eliminada: ${INTERACCION_LABELS[interaccion.tipo] ?? interaccion.tipo}`,
  });

  return NextResponse.json({ ok: true });
}

// Cada método se publica envuelto en withApi: si algo falla por dentro, el
// usuario recibe un mensaje genérico con un código de referencia y el
// detalle completo queda solo en el registro del servidor.
export const DELETE = withApi("DELETE /api/interacciones/[id]", handlerDELETE as never);
