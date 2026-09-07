import { prisma } from "@/lib/prisma";

// Cuenta las plazas libres de una habitación en un rango de fechas: resta de
// su capacidad los participantes ya asignados cuya estancia se solapa con
// ese rango. Una estancia sin fechas conocidas se cuenta siempre como
// ocupando la plaza (no infravalorar la ocupación por falta de dato).
export async function plazasLibres(
  habitacionId: string,
  fechaInicio: Date | null,
  fechaFin: Date | null,
  excluirParticipanteId?: string
): Promise<number> {
  const habitacion = await prisma.habitacion.findUnique({
    where: { id: habitacionId },
  });
  if (!habitacion) return 0;

  const ocupantes = await prisma.participante.findMany({
    where: {
      habitacionId,
      id: excluirParticipanteId ? { not: excluirParticipanteId } : undefined,
    },
    include: { estancia: { select: { fechaInicio: true, fechaFin: true } } },
  });

  const seSolapan = (
    otraInicio: Date | null,
    otraFin: Date | null
  ): boolean => {
    // Si cualquiera de las dos estancias no tiene fechas, no se puede
    // descartar el solape: se cuenta como ocupando la plaza.
    if (!fechaInicio || !fechaFin || !otraInicio || !otraFin) return true;
    return fechaInicio <= otraFin && fechaFin >= otraInicio;
  };

  const ocupadas = ocupantes.filter((p) =>
    seSolapan(p.estancia.fechaInicio, p.estancia.fechaFin)
  ).length;

  return habitacion.capacidad - ocupadas;
}
