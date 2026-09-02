import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { updateEstanciaSchema } from "@/lib/validation";
import { registrarHistorial } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateEstanciaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const estancia = await prisma.estancia.update({
    where: { id },
    data: {
      tipoPrograma: d.tipoPrograma,
      tipoParticipante: d.tipoParticipante,
      centroReceptor: d.centroReceptor || "Granada",
      edadGrupo: d.edadGrupo || null,
      fechaInicio: d.fechaInicio ? new Date(d.fechaInicio) : null,
      fechaFin: d.fechaFin ? new Date(d.fechaFin) : null,
      estado: d.estado ?? undefined,
      presupuestoImporte:
        d.presupuestoImporte !== undefined &&
        d.presupuestoImporte !== null &&
        d.presupuestoImporte !== ""
          ? d.presupuestoImporte
          : null,
      notas: d.notas || null,
    },
  });

  await registrarHistorial({
    centroId: estancia.centroId,
    actorId: user.id,
    accion: "Estancia actualizada",
    detalle: estancia.tipoPrograma,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id } = await params;

  const estancia = await prisma.estancia.delete({ where: { id } });

  await registrarHistorial({
    centroId: estancia.centroId,
    actorId: user.id,
    accion: "Estancia eliminada",
    detalle: estancia.tipoPrograma,
  });

  return NextResponse.json({ ok: true });
}
