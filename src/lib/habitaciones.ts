import { prisma } from "@/lib/prisma";

type Rol = "ALUMNOS" | "PROFESORES";

function seSolapan(
  fechaInicio: Date | null,
  fechaFin: Date | null,
  otraInicio: Date | null,
  otraFin: Date | null
): boolean {
  // Si cualquiera de las dos estancias no tiene fechas, no se puede
  // descartar el solape: se cuenta como ocupando la plaza.
  if (!fechaInicio || !fechaFin || !otraInicio || !otraFin) return true;
  return fechaInicio <= otraFin && fechaFin >= otraInicio;
}

// Participantes ya asignados a esa habitación cuya estancia se solapa con
// el rango de fechas dado (excluyendo, si se indica, un participante
// concreto: se usa al reasignar la habitación de alguien que ya la tenía).
async function ocupantesSolapados(
  habitacionId: string,
  fechaInicio: Date | null,
  fechaFin: Date | null,
  excluirParticipanteId?: string
) {
  const ocupantes = await prisma.participante.findMany({
    where: {
      habitacionId,
      id: excluirParticipanteId ? { not: excluirParticipanteId } : undefined,
    },
    include: { estancia: { select: { fechaInicio: true, fechaFin: true } } },
  });
  return ocupantes.filter((p) =>
    seSolapan(fechaInicio, fechaFin, p.estancia.fechaInicio, p.estancia.fechaFin)
  );
}

// Cuenta las plazas libres de una habitación en un rango de fechas: resta de
// su capacidad los participantes ya asignados cuya estancia se solapa con
// ese rango.
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

  const ocupadas = await ocupantesSolapados(
    habitacionId,
    fechaInicio,
    fechaFin,
    excluirParticipanteId
  );
  return habitacion.capacidad - ocupadas.length;
}

// Alumnos y profesores no comparten habitación (regla de negocio). Devuelve
// el único rol que ocupa la habitación en esas fechas, o null si está
// vacía (cualquier rol puede entrar). Si por lo que sea hubiera los dos
// roles a la vez (no debería pasar yendo por esta librería), se trata como
// "no compatible con nada" para no empeorar la mezcla.
export async function rolQueOcupa(
  habitacionId: string,
  fechaInicio: Date | null,
  fechaFin: Date | null,
  excluirParticipanteId?: string
): Promise<Rol | "MIXTA" | null> {
  const ocupantes = await ocupantesSolapados(
    habitacionId,
    fechaInicio,
    fechaFin,
    excluirParticipanteId
  );
  const roles = new Set(ocupantes.map((o) => o.rol));
  if (roles.size === 0) return null;
  if (roles.size > 1) return "MIXTA";
  return [...roles][0] as Rol;
}
