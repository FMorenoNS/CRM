import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { HabitacionesClient, type HabitacionRow } from "./habitaciones-client";

export default async function HabitacionesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const habitacionesRaw = await prisma.habitacion.findMany({
    orderBy: { nombre: "asc" },
    include: { _count: { select: { participantes: true } } },
  });

  const habitaciones: HabitacionRow[] = habitacionesRaw.map((h) => ({
    id: h.id,
    nombre: h.nombre,
    capacidad: h.capacidad,
    activa: h.activa,
    ocupantes: h._count.participantes,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Habitaciones</h1>
        <p className="mt-1 text-sm text-gray-500">
          Catálogo de habitaciones de la residencia. Solo el administrador lo
          gestiona; se usa para asignar participantes desde la ficha de cada
          estancia.
        </p>
      </div>
      <HabitacionesClient habitaciones={habitaciones} />
    </div>
  );
}
