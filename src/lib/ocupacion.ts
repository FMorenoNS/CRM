import { prisma } from "@/lib/prisma";

export type OcupacionDia = { fecha: string; ocupados: number };

export type OcupacionMensual = {
  capacidadTotal: number;
  dias: OcupacionDia[];
};

// Ocupación día a día de toda la residencia en un mes: cuenta, para cada
// día, cuántos participantes tienen una habitación asignada cuya estancia
// cubre ese día. La capacidad total es la suma de las habitaciones activas
// (no varía día a día: no hay altas/bajas de habitación por fecha).
export async function getOcupacionMensual(
  anio: number,
  mes: number // 1-12
): Promise<OcupacionMensual> {
  const habitaciones = await prisma.habitacion.findMany({
    where: { activa: true },
    select: { capacidad: true },
  });
  const capacidadTotal = habitaciones.reduce((suma, h) => suma + h.capacidad, 0);

  const numDias = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const inicioMes = new Date(Date.UTC(anio, mes - 1, 1));
  const finMes = new Date(Date.UTC(anio, mes - 1, numDias));

  // Cualquier participante con habitación cuya estancia se solape con el
  // mes (no hace falta traer los de fuera de rango).
  const participantes = await prisma.participante.findMany({
    where: {
      habitacionId: { not: null },
      estancia: { fechaInicio: { lte: finMes }, fechaFin: { gte: inicioMes } },
    },
    select: { estancia: { select: { fechaInicio: true, fechaFin: true } } },
  });

  const dias: OcupacionDia[] = [];
  for (let d = 1; d <= numDias; d++) {
    const fecha = new Date(Date.UTC(anio, mes - 1, d));
    const ocupados = participantes.filter((p) => {
      const { fechaInicio, fechaFin } = p.estancia;
      if (!fechaInicio || !fechaFin) return false;
      return fechaInicio <= fecha && fechaFin >= fecha;
    }).length;
    dias.push({ fecha: fecha.toISOString().slice(0, 10), ocupados });
  }

  return { capacidadTotal, dias };
}
