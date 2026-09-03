import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { updateEstanciaSchema } from "@/lib/validation";
import { registrarHistorial } from "@/lib/audit";
import { canAccessCentro, canEditMasterData, forbidden, noEncontrado } from "@/lib/permissions";
import { DEMASIADO_GRANDE, readJsonBody } from "@/lib/request";
import { withApi } from "@/lib/http";

async function handlerPATCH(
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
    return noEncontrado();
  }
  // Si no puede ver ese cliente, se responde igual que si no existiera:
  // un 403 aquí confirmaría que el registro existe (ver noEncontrado).
  if (!canAccessCentro(user, existing.centroId)) return noEncontrado();
  if (!canEditMasterData(user, existing.centroId)) return forbidden();

  const body = await readJsonBody(request);
  if (body === DEMASIADO_GRANDE) {
    return NextResponse.json(
      { error: "Los datos enviados son demasiado grandes." },
      { status: 413 }
    );
  }
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
      tipoProyecto: d.tipoProyecto || null,
      tipoParticipante: d.tipoParticipante,
      centroReceptor: d.centroReceptor || "Granada",
      provincia: d.provincia || null,
      numeroAlumnos:
        d.numeroAlumnos !== undefined &&
        d.numeroAlumnos !== null &&
        d.numeroAlumnos !== ""
          ? Number(d.numeroAlumnos)
          : null,
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

async function handlerDELETE(
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
    return noEncontrado();
  }
  // Si no puede ver ese cliente, se responde igual que si no existiera:
  // un 403 aquí confirmaría que el registro existe (ver noEncontrado).
  if (!canAccessCentro(user, existing.centroId)) return noEncontrado();
  if (!canEditMasterData(user, existing.centroId)) return forbidden();

  const estancia = await prisma.estancia.delete({ where: { id } });

  await registrarHistorial({
    centroId: estancia.centroId,
    actorId: user.id,
    accion: "Estancia eliminada",
    detalle: estancia.tipoPrograma,
  });

  return NextResponse.json({ ok: true });
}

// Cada método se publica envuelto en withApi: si algo falla por dentro, el
// usuario recibe un mensaje genérico con un código de referencia y el
// detalle completo queda solo en el registro del servidor.
export const PATCH = withApi("PATCH /api/estancias/[id]", handlerPATCH as never);
export const DELETE = withApi("DELETE /api/estancias/[id]", handlerDELETE as never);
