import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { registrarHistorial } from "@/lib/audit";
import { canDoOperational, forbidden } from "@/lib/permissions";

const schema = z.object({ activo: z.boolean() });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id } = await params;

  const existing = await prisma.estancia.findUnique({
    where: { id },
    select: { centroId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }
  if (!canDoOperational(user, existing.centroId)) return forbidden();

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const estancia = await prisma.estancia.update({
    where: { id },
    data: { activo: parsed.data.activo },
  });

  await registrarHistorial({
    centroId: estancia.centroId,
    actorId: user.id,
    accion: parsed.data.activo
      ? "Estancia marcada como activa"
      : "Estancia marcada como inactiva",
    detalle: estancia.tipoPrograma,
  });

  return NextResponse.json({ ok: true });
}
