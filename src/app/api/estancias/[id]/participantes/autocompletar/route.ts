import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { registrarHistorial } from "@/lib/audit";
import { canDoOperational, forbidden } from "@/lib/permissions";
import { plazasLibres } from "@/lib/habitaciones";

// Genera de golpe la lista de participantes de una estancia (uno por cada
// alumno y cada profesor de "Número de alumnos"/"Número de profesores") y
// los reparte en habitaciones con plazas libres en esas fechas. Todo o
// nada: si no caben todos, no se crea ni se asigna a nadie (decisión de
// producto), para no dejar la lista a medias.
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
    include: { _count: { select: { participantes: true } } },
  });
  if (!estancia) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }
  if (!canDoOperational(user, estancia.centroId)) return forbidden();

  if (estancia._count.participantes > 0) {
    return NextResponse.json(
      {
        error:
          "Esta estancia ya tiene participantes. Bórralos primero si quieres autocompletar la lista de nuevo.",
      },
      { status: 409 }
    );
  }

  const nAlumnos = estancia.numeroAlumnos ?? 0;
  const nProfesores = estancia.numeroProfesores ?? 0;
  const total = nAlumnos + nProfesores;
  if (total <= 0) {
    return NextResponse.json(
      {
        error:
          "La estancia no tiene número de alumnos ni de profesores. Rellénalo antes de autocompletar.",
      },
      { status: 400 }
    );
  }

  const habitaciones = await prisma.habitacion.findMany({
    where: { activa: true },
    orderBy: { nombre: "asc" },
  });
  const libresPorHabitacion = await Promise.all(
    habitaciones.map(async (h) => ({
      id: h.id,
      libres: await plazasLibres(h.id, estancia.fechaInicio, estancia.fechaFin),
    }))
  );
  const totalLibres = libresPorHabitacion.reduce(
    (suma, h) => suma + Math.max(0, h.libres),
    0
  );

  if (totalLibres < total) {
    return NextResponse.json(
      {
        error: `No hay plazas suficientes en esas fechas: hacen falta ${total} y hay ${totalLibres} libres. Añade habitaciones o libera plazas antes de autocompletar.`,
      },
      { status: 409 }
    );
  }

  // Reparto: llena las habitaciones en orden hasta agotar cada una.
  const nuevos: { nombre: string; rol: "ALUMNOS" | "PROFESORES"; habitacionId: string }[] = [];
  for (let i = 1; i <= nAlumnos; i++) {
    nuevos.push({ nombre: `Alumno ${i}`, rol: "ALUMNOS", habitacionId: "" });
  }
  for (let i = 1; i <= nProfesores; i++) {
    nuevos.push({ nombre: `Profesor ${i}`, rol: "PROFESORES", habitacionId: "" });
  }

  let cursor = 0;
  for (const h of libresPorHabitacion) {
    let disponibles = Math.max(0, h.libres);
    while (disponibles > 0 && cursor < nuevos.length) {
      nuevos[cursor].habitacionId = h.id;
      cursor++;
      disponibles--;
    }
    if (cursor >= nuevos.length) break;
  }

  await prisma.$transaction(
    nuevos.map((p) =>
      prisma.participante.create({
        data: { estanciaId, nombre: p.nombre, rol: p.rol, habitacionId: p.habitacionId },
      })
    )
  );

  await registrarHistorial({
    centroId: estancia.centroId,
    actorId: user.id,
    accion: `Lista de participantes autocompletada: ${nAlumnos} alumno(s) y ${nProfesores} profesor(es), repartidos en ${
      new Set(nuevos.map((p) => p.habitacionId)).size
    } habitación(es)`,
  });

  return NextResponse.json({ creados: nuevos.length });
}
