import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { registrarHistorial } from "@/lib/audit";
import { canEditMasterData, forbidden } from "@/lib/permissions";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id } = await params;

  const existing = await prisma.contacto.findUnique({
    where: { id },
    select: { centroId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
  if (!canEditMasterData(user, existing.centroId)) return forbidden();

  const contacto = await prisma.contacto.delete({ where: { id } });

  await registrarHistorial({
    centroId: contacto.centroId,
    actorId: user.id,
    accion: "Contacto eliminado",
    detalle: contacto.nombre,
  });

  return NextResponse.json({ ok: true });
}
