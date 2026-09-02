import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { registrarHistorial } from "@/lib/audit";
import { INTERACCION_LABELS } from "@/lib/labels";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id } = await params;

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
