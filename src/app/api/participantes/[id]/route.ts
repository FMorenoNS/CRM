import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { updateParticipanteSchema } from "@/lib/validation";
import { registrarHistorial } from "@/lib/audit";
import { PARTICIPANTE_LABELS } from "@/lib/labels";
import { canDoOperational, forbidden } from "@/lib/permissions";
import { plazasLibres, rolQueOcupa } from "@/lib/habitaciones";

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
    data.habitacionId = parsed.data.habitacionId || null;
  }

  // Si al terminar el cambio el participante queda en una habitación (ya
  // sea porque se le asigna una nueva o porque cambia de rol quedándose en
  // la que tenía), hay que revalidar capacidad y que alumnos/profesores no
  // se mezclen: cualquiera de los dos cambios puede romperlo.
  const habitacionFinal =
    parsed.data.habitacionId !== undefined ? data.habitacionId : existing.habitacionId;
  const rolFinal = data.rol ?? existing.rol;
  const cambiaHabitacion =
    parsed.data.habitacionId !== undefined && habitacionFinal !== existing.habitacionId;
  const cambiaRol = parsed.data.rol !== undefined && rolFinal !== existing.rol;

  let mezclaConfirmada = false;
  if (habitacionFinal && (cambiaHabitacion || cambiaRol)) {
    if (cambiaHabitacion) {
      const libres = await plazasLibres(
        habitacionFinal,
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
    // Alumnos y profesores no comparten habitación, salvo confirmación
    // explícita del usuario (forzarMezcla): la capacidad de arriba sí es un
    // límite físico y nunca se salta.
    const ocupante = await rolQueOcupa(
      habitacionFinal,
      existing.estancia.fechaInicio,
      existing.estancia.fechaFin,
      id
    );
    if (ocupante && ocupante !== rolFinal) {
      if (!parsed.data.forzarMezcla) {
        return NextResponse.json(
          {
            error:
              "Esa habitación ya la ocupan personas de otro rol en esas fechas (alumnos y profesores no pueden compartir habitación).",
            codigo: "MEZCLA_ROLES",
          },
          { status: 409 }
        );
      }
      mezclaConfirmada = true;
    }
  }

  await prisma.participante.update({ where: { id }, data });

  await registrarHistorial({
    centroId: existing.estancia.centroId,
    actorId: user.id,
    accion: `Participante actualizado: ${data.nombre ?? existing.nombre}${
      mezclaConfirmada ? " · habitación compartida con otro rol, confirmado a mano" : ""
    }`,
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
