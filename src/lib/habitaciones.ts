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
  nombre: string;
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

// Planta a la que pertenece una habitación, a partir de su número (101 →
// planta 1, 215 → planta 2...): mismo criterio que en el plano del
// calendario.
function plantaDe(nombre: string): number {
  const n = Number(nombre);
  return Number.isFinite(n) ? Math.floor(n / 100) : 0;
}

// Reordena las habitaciones para que un grupo (los de una misma estancia)
// quede junto en la misma planta, siempre empezando a intentarlo desde la
// primera planta hacia arriba: se calcula, planta por planta, cuántas
// plazas nuevas podría tomar cada una en esta pasada (según el método de
// llenado), contando solo las compatibles con el rol; la primera planta
// (de más baja a más alta) que sume plazas suficientes para "cantidad" se
// prioriza entera. Si ninguna llega sola, se prioriza la que más plazas
// tenga y se sigue por el resto de plantas en orden para lo que no quepa,
// en vez de dejar el grupo sin ningún sitio.
function priorizarPlanta(
  habitaciones: EstadoHabitacion[],
  rol: Rol,
  cantidad: number,
  metodo: MetodoLlenado
): EstadoHabitacion[] {
  const limite = limitePorHabitacion(metodo);
  const compatible = (h: EstadoHabitacion) =>
    (h.rol === null || h.rol === rol) &&
    (rol === "PROFESORES" ? h.tieneNevera : !h.tieneNevera);

  const porPlanta = new Map<number, EstadoHabitacion[]>();
  for (const h of habitaciones) {
    if (!compatible(h)) continue;
    const planta = plantaDe(h.nombre);
    const grupo = porPlanta.get(planta);
    if (grupo) grupo.push(h);
    else porPlanta.set(planta, [h]);
  }

  const plantas = [...porPlanta.entries()].sort((a, b) => a[0] - b[0]);
  const capacidad = (grupo: EstadoHabitacion[]) =>
    grupo.reduce((suma, h) => suma + Math.min(h.libres, limite), 0);

  let elegida = plantas.find(([, grupo]) => capacidad(grupo) >= cantidad);
  if (!elegida && plantas.length > 0) {
    elegida = plantas.reduce((mejor, actual) =>
      capacidad(actual[1]) > capacidad(mejor[1]) ? actual : mejor
    );
  }
  if (!elegida) return habitaciones;

  const grupoElegido = elegida[1];
  const resto = habitaciones.filter((h) => !grupoElegido.includes(h));
  return [...grupoElegido, ...resto];
}

/**
 * Reparte `cantidad` personas de un rol entre habitaciones con plazas
 * libres: no mezcla alumnos y profesores (una habitación que ya se usó para
 * un rol en este reparto queda cerrada al otro, aunque le sobre capacidad
 * física) y respeta que las habitaciones con nevera son solo para
 * profesorado. `metodo` limita cuántas plazas nuevas toma cada habitación en
 * esta pasada (2, 3 o todas las que tenga libres). Intenta meter a todo el
 * grupo en la misma planta (empezando por la primera hacia arriba); si no
 * cabe entero en ninguna, reparte lo que no quepa en las siguientes.
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
  if (cantidad <= 0) return [];
  const limite = limitePorHabitacion(metodo);
  const orden = priorizarPlanta(habitaciones, rol, cantidad, metodo);
  const asignados: string[] = [];
  for (const h of orden) {
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
