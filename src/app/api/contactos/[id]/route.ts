import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { registrarHistorial } from "@/lib/audit";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id } = await params;

  const contacto = await prisma.contacto.delete({ where: { id } });

  await registrarHistorial({
    centroId: contacto.centroId,
    actorId: user.id,
    accion: "Contacto eliminado",
    detalle: contacto.nombre,
  });

  return NextResponse.json({ ok: true });
}
