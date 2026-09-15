import { prisma } from "@/lib/prisma";

export type Rol = "ALUMNOS" | "PROFESORES";

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

export type MetodoLlenado = "DOS" | "TRES" | "MAXIMA";

export type EstadoHabitacion = {
  id: string;
  // Plazas libres en esas fechas, ya restadas las de otras asignaciones.
  libres: number;
  // Rol que ya ocupa la habitación en esas fechas (cierra la habitación al
  // otro rol aunque le sobre capacidad), "MIXTA" si por lo que sea ya tiene
  // los dos (se trata igual: cerrada para cualquier rol), o null si está
  // vacía.
  rol: Rol | "MIXTA" | null;
  tieneNevera: boolean;
};

// Cuántas plazas nuevas toma como máximo cada habitación en una pasada de
// reparto, según el método de llenado elegido.
function limitePorHabitacion(metodo: MetodoLlenado): number {
  switch (metodo) {
    case "DOS":
      return 2;
    case "TRES":
      return 3;
    case "MAXIMA":
      return Infinity;
  }
}

/**
 * Reparte `cantidad` personas de un rol entre habitaciones con plazas
 * libres: no mezcla alumnos y profesores (una habitación que ya se usó para
 * un rol en este reparto queda cerrada al otro, aunque le sobre capacidad
 * física) y respeta que las habitaciones con nevera son solo para
 * profesorado. `metodo` limita cuántas plazas nuevas toma cada habitación en
 * esta pasada (2, 3 o todas las que tenga libres).
 *
 * Modifica `habitaciones` in place (resta las plazas tomadas y marca el
 * rol) para que un reparto posterior en la misma llamada (p. ej. primero
 * alumnos y luego profesores) vea el estado ya actualizado. Devuelve el id
 * de habitación asignado a cada persona, en orden.
 */
export function repartirEnHabitaciones(
  habitaciones: EstadoHabitacion[],
  rol: Rol,
  cantidad: number,
  metodo: MetodoLlenado
): string[] {
  const limite = limitePorHabitacion(metodo);
  const asignados: string[] = [];
  for (const h of habitaciones) {
    if (asignados.length >= cantidad) break;
    if (h.rol !== null && h.rol !== rol) continue;
    if (rol === "PROFESORES" && !h.tieneNevera) continue;
    if (rol === "ALUMNOS" && h.tieneNevera) continue;
    const disponibleEnEstaPasada = Math.min(h.libres, limite);
    const toma = Math.min(disponibleEnEstaPasada, cantidad - asignados.length);
    for (let i = 0; i < toma; i++) asignados.push(h.id);
    h.libres -= toma;
    if (toma > 0) h.rol = rol;
  }
  return asignados;
}
