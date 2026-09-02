import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { estadoSchema } from "@/lib/validation";
import { registrarHistorial } from "@/lib/audit";
import { ESTADO_LABELS } from "@/lib/labels";
import { canDoOperational, forbidden } from "@/lib/permissions";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
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
  const parsed = estadoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Estado inválido." },
      { status: 400 }
    );
  }

  const estancia = await prisma.estancia.update({
    where: { id },
    data: { estado: parsed.data.estado },
  });

  await registrarHistorial({
    centroId: estancia.centroId,
    actorId: user.id,
    accion: "Estado de la estancia cambiado",
    detalle: ESTADO_LABELS[estancia.estado] ?? estancia.estado,
  });

  return NextResponse.json({ ok: true });
}
