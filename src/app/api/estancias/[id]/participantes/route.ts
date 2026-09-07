import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { participanteSchema } from "@/lib/validation";
import { registrarHistorial } from "@/lib/audit";
import { PARTICIPANTE_LABELS } from "@/lib/labels";
import { canDoOperational, forbidden } from "@/lib/permissions";
import { plazasLibres, rolQueOcupa } from "@/lib/habitaciones";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id: estanciaId } = await params;

  const estancia = await prisma.estancia.findUnique({
    where: { id: estanciaId },
    select: { centroId: true, fechaInicio: true, fechaFin: true },
  });
  if (!estancia) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }
  if (!canDoOperational(user, estancia.centroId)) return forbidden();

  const body = await request.json().catch(() => null);
  const parsed = participanteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  const habitacionId = parsed.data.habitacionId || null;
  let mezclaConfirmada = false;
  if (habitacionId) {
    const libres = await plazasLibres(
      habitacionId,
      estancia.fechaInicio,
      estancia.fechaFin
    );
    if (libres <= 0) {
      return NextResponse.json(
        { error: "Esa habitación no tiene plazas libres en esas fechas." },
        { status: 409 }
      );
    }
    // Alumnos y profesores no comparten habitación, salvo confirmación
    // explícita del usuario (forzarMezcla): la capacidad de arriba sí es un
    // límite físico y nunca se salta.
    const ocupante = await rolQueOcupa(habitacionId, estancia.fechaInicio, estancia.fechaFin);
    if (ocupante && ocupante !== parsed.data.rol) {
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

  const participante = await prisma.participante.create({
    data: {
      estanciaId,
      nombre: parsed.data.nombre,
      rol: parsed.data.rol,
      habitacionId,
    },
  });

  await registrarHistorial({
    centroId: estancia.centroId,
    actorId: user.id,
    accion: `Participante añadido: ${parsed.data.nombre} (${PARTICIPANTE_LABELS[parsed.data.rol] ?? parsed.data.rol})${
      mezclaConfirmada ? " · habitación compartida con otro rol, confirmado a mano" : ""
    }`,
  });

  return NextResponse.json({ id: participante.id });
}
