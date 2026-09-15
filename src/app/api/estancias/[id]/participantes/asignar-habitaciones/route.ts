import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { metodoLlenadoSchema } from "@/lib/validation";
import { registrarHistorial } from "@/lib/audit";
import { canDoOperational, forbidden } from "@/lib/permissions";
import {
  plazasLibres,
  repartirEnHabitaciones,
  rolQueOcupa,
  type EstadoHabitacion,
} from "@/lib/habitaciones";

// Asigna habitación a los participantes de la estancia que todavía no
// tienen una (habitacionId null), sin tocar a los que ya la tienen. A
// diferencia de /participantes/autocompletar, no es todo-o-nada: los que no
// quepan (por ejemplo, profesores cuando no quedan habitaciones con nevera
// libres) se quedan sin asignar y se informa cuántos.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id: estanciaId } = await params;

  const estancia = await prisma.estancia.findUnique({ where: { id: estanciaId } });
  if (!estancia) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }
  if (!canDoOperational(user, estancia.centroId)) return forbidden();

  const body = await request.json().catch(() => ({}));
  const parsed = metodoLlenadoSchema.safeParse(body ?? {});
  const metodo = parsed.success ? parsed.data.metodo : "MAXIMA";

  const sinAsignar = await prisma.participante.findMany({
    where: { estanciaId, habitacionId: null },
    orderBy: { createdAt: "asc" },
  });
  if (sinAsignar.length === 0) {
    return NextResponse.json(
      { error: "No hay participantes sin habitación asignada." },
      { status: 400 }
    );
  }

  const habitacionesActivas = await prisma.habitacion.findMany({
    where: { activa: true },
    orderBy: { nombre: "asc" },
  });
  const habitaciones: EstadoHabitacion[] = await Promise.all(
    habitacionesActivas.map(async (h) => ({
      id: h.id,
      libres: Math.max(
        0,
        await plazasLibres(h.id, estancia.fechaInicio, estancia.fechaFin)
      ),
      rol: await rolQueOcupa(h.id, estancia.fechaInicio, estancia.fechaFin),
      tieneNevera: h.tieneNevera,
    }))
  );

  const alumnos = sinAsignar.filter((p) => p.rol === "ALUMNOS");
  const profesores = sinAsignar.filter((p) => p.rol === "PROFESORES");

  const habitacionesAlumnos = repartirEnHabitaciones(
    habitaciones,
    "ALUMNOS",
    alumnos.length,
    metodo
  );
  const habitacionesProfesores = repartirEnHabitaciones(
    habitaciones,
    "PROFESORES",
    profesores.length,
    metodo
  );

  const asignaciones: { participanteId: string; habitacionId: string }[] = [
    ...alumnos.slice(0, habitacionesAlumnos.length).map((p, i) => ({
      participanteId: p.id,
      habitacionId: habitacionesAlumnos[i],
    })),
    ...profesores.slice(0, habitacionesProfesores.length).map((p, i) => ({
      participanteId: p.id,
      habitacionId: habitacionesProfesores[i],
    })),
  ];

  if (asignaciones.length === 0) {
    return NextResponse.json(
      {
        error:
          "No hay plazas libres en esas fechas para asignar a ningún participante (revisa también que haya habitaciones con nevera libres para los profesores).",
      },
      { status: 409 }
    );
  }

  await prisma.$transaction(
    asignaciones.map((a) =>
      prisma.participante.update({
        where: { id: a.participanteId },
        data: { habitacionId: a.habitacionId },
      })
    )
  );

  await registrarHistorial({
    centroId: estancia.centroId,
    actorId: user.id,
    accion: `Habitaciones asignadas automáticamente a ${asignaciones.length} participante(s) sin habitación (método: ${metodo})`,
  });

  return NextResponse.json({
    asignados: asignaciones.length,
    sinAsignar: sinAsignar.length - asignaciones.length,
  });
}
