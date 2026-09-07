import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { updateParticipanteSchema } from "@/lib/validation";
import { registrarHistorial } from "@/lib/audit";
import { PARTICIPANTE_LABELS } from "@/lib/labels";
import { canDoOperational, forbidden } from "@/lib/permissions";
import { plazasLibres } from "@/lib/habitaciones";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id } = await params;

  const existing = await prisma.participante.findUnique({
    where: { id },
    include: {
      estancia: { select: { centroId: true, fechaInicio: true, fechaFin: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
  if (!canDoOperational(user, existing.estancia.centroId)) return forbidden();

  const body = await request.json().catch(() => null);
  const parsed = updateParticipanteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Nada que cambiar." }, { status: 400 });
  }

  const data: { nombre?: string; rol?: "ALUMNOS" | "PROFESORES"; habitacionId?: string | null } = {};
  if (parsed.data.nombre !== undefined) data.nombre = parsed.data.nombre;
  if (parsed.data.rol !== undefined) data.rol = parsed.data.rol;

  if (parsed.data.habitacionId !== undefined) {
    const nuevaHabitacionId = parsed.data.habitacionId || null;
    if (nuevaHabitacionId && nuevaHabitacionId !== existing.habitacionId) {
      const libres = await plazasLibres(
        nuevaHabitacionId,
        existing.estancia.fechaInicio,
        existing.estancia.fechaFin,
        id
      );
      if (libres <= 0) {
        return NextResponse.json(
          { error: "Esa habitación no tiene plazas libres en esas fechas." },
          { status: 409 }
        );
      }
    }
    data.habitacionId = nuevaHabitacionId;
  }

  await prisma.participante.update({ where: { id }, data });

  await registrarHistorial({
    centroId: existing.estancia.centroId,
    actorId: user.id,
    accion: `Participante actualizado: ${data.nombre ?? existing.nombre}`,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id } = await params;

  const existing = await prisma.participante.findUnique({
    where: { id },
    include: { estancia: { select: { centroId: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
  if (!canDoOperational(user, existing.estancia.centroId)) return forbidden();

  await prisma.participante.delete({ where: { id } });

  await registrarHistorial({
    centroId: existing.estancia.centroId,
    actorId: user.id,
    accion: `Participante eliminado: ${existing.nombre} (${PARTICIPANTE_LABELS[existing.rol] ?? existing.rol})`,
  });

  return NextResponse.json({ ok: true });
}
