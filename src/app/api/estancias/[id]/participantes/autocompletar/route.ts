import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { registrarHistorial } from "@/lib/audit";
import { canDoOperational, forbidden } from "@/lib/permissions";
import { plazasLibres, rolQueOcupa } from "@/lib/habitaciones";

// Genera de golpe la lista de participantes de una estancia (uno por cada
// alumno y cada profesor de "Número de alumnos"/"Número de profesores") y
// los reparte en habitaciones con plazas libres en esas fechas, sin mezclar
// alumnos y profesores en la misma habitación (regla de negocio). Todo o
// nada: si no caben todos respetando esa separación, no se crea ni se
// asigna a nadie, para no dejar la lista a medias.
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
  if (nAlumnos + nProfesores <= 0) {
    return NextResponse.json(
      {
        error:
          "La estancia no tiene número de alumnos ni de profesores. Rellénalo antes de autocompletar.",
      },
      { status: 400 }
    );
  }

  const habitacionesActivas = await prisma.habitacion.findMany({
    where: { activa: true },
    orderBy: { nombre: "asc" },
  });

  // Estado de partida de cada habitación: plazas libres y, si ya tiene
  // ocupantes en esas fechas, de qué rol son (esa habitación queda cerrada
  // al otro rol aunque le sobre capacidad).
  const habitaciones = await Promise.all(
    habitacionesActivas.map(async (h) => ({
      id: h.id,
      libres: Math.max(
        0,
        await plazasLibres(h.id, estancia.fechaInicio, estancia.fechaFin)
      ),
      rol: await rolQueOcupa(h.id, estancia.fechaInicio, estancia.fechaFin),
    }))
  );

  // Reparto en dos pasadas (alumnos y luego profesores) para no mezclar:
  // una habitación que ya se usó para un rol en esta simulación deja de
  // estar disponible para el otro, aunque le quede sitio físico.
  function repartir(rol: "ALUMNOS" | "PROFESORES", cantidad: number) {
    const asignados: string[] = [];
    for (const h of habitaciones) {
      if (asignados.length >= cantidad) break;
      if (h.rol !== null && h.rol !== rol) continue; // ocupada por el otro rol
      const toma = Math.min(h.libres, cantidad - asignados.length);
      for (let i = 0; i < toma; i++) asignados.push(h.id);
      h.libres -= toma;
      if (toma > 0) h.rol = rol;
    }
    return asignados;
  }

  const habitacionesAlumnos = repartir("ALUMNOS", nAlumnos);
  const habitacionesProfesores = repartir("PROFESORES", nProfesores);

  if (habitacionesAlumnos.length < nAlumnos || habitacionesProfesores.length < nProfesores) {
    return NextResponse.json(
      {
        error: `No hay suficientes habitaciones separadas por rol en esas fechas: hacen falta ${nAlumnos} plaza(s) de alumnos (hay ${habitacionesAlumnos.length}) y ${nProfesores} de profesores (hay ${habitacionesProfesores.length}). Añade habitaciones o libera plazas antes de autocompletar.`,
      },
      { status: 409 }
    );
  }

  const nuevos: { nombre: string; rol: "ALUMNOS" | "PROFESORES"; habitacionId: string }[] = [
    ...habitacionesAlumnos.map((habitacionId, i) => ({
      nombre: `Alumno ${i + 1}`,
      rol: "ALUMNOS" as const,
      habitacionId,
    })),
    ...habitacionesProfesores.map((habitacionId, i) => ({
      nombre: `Profesor ${i + 1}`,
      rol: "PROFESORES" as const,
      habitacionId,
    })),
  ];

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
