import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getOcupacionMensual } from "@/lib/ocupacion";
import { HabitacionesClient, type HabitacionRow } from "./habitaciones-client";
import { CalendarioOcupacion } from "./calendario-ocupacion";

function mesActual(): { anio: number; mes: number } {
  const ahora = new Date();
  return { anio: ahora.getUTCFullYear(), mes: ahora.getUTCMonth() + 1 };
}

export default async function HabitacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const { mes: mesParam } = await searchParams;
  const defecto = mesActual();
  let anio = defecto.anio;
  let mes = defecto.mes;
  if (mesParam && /^\d{4}-\d{2}$/.test(mesParam)) {
    const [a, m] = mesParam.split("-").map(Number);
    if (m >= 1 && m <= 12) {
      anio = a;
      mes = m;
    }
  }

  const [habitacionesRaw, ocupacion] = await Promise.all([
    prisma.habitacion.findMany({
      orderBy: { nombre: "asc" },
      include: { _count: { select: { participantes: true } } },
    }),
    getOcupacionMensual(anio, mes),
  ]);

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

      <section>
        <h2 className="text-lg font-medium text-gray-900">Ocupación</h2>
        <div className="mt-3">
          <CalendarioOcupacion anio={anio} mes={mes} ocupacion={ocupacion} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-gray-900">Catálogo</h2>
        <div className="mt-3">
          <HabitacionesClient habitaciones={habitaciones} />
        </div>
      </section>
    </div>
  );
}
