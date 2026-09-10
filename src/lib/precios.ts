/**
 * Tarifas y cálculo del presupuesto.
 *
 * Los precios y el cálculo salen de la hoja "precios" del Excel con el que
 * se venían haciendo los presupuestos a mano. Se han traído tal cual, con
 * dos decisiones tomadas expresamente donde la hoja no era consistente:
 *
 *  - **El IVA se aplica sobre el neto MÁS el margen**, que es lo que de
 *    verdad se factura al centro. La hoja lo calculaba sobre el neto solo,
 *    así que los totales del CRM salen alrededor de un 1,5 % por encima de
 *    los que daba el Excel. Es deliberado.
 *  - **El autobús se cobra a su precio neto.** La hoja tenía una segunda
 *    columna con un 10 % añadido que calculaba pero no sumaba en ningún
 *    sitio; se ha dejado fuera.
 *
 * Este fichero no lleva "server-only" a propósito: la ventana del
 * presupuesto necesita el mismo cálculo para ir mostrando los totales
 * mientras se rellena. Lo que se guarda en la base de datos NO es lo que
 * calcula el navegador: el servidor lo vuelve a calcular por su cuenta.
 */

/**
 * Cómo se rellenan por defecto los días y la cantidad de cada concepto al
 * abrir la ventana. Es solo una comodidad: los tres valores (precio, días y
 * cantidad) se pueden cambiar a mano en cada línea.
 */
export type Unidad =
  // Alojamiento: una plaza por persona y por noche.
  | "PERSONA_NOCHE"
  // Monitores y similares: tantos días como dure la estancia, y la cantidad
  // la pone quien presupuesta (cuántos monitores hacen falta).
  | "DIA"
  // Visitas, clases, materiales, seguro: uno por persona.
  | "PERSONA"
  // Sin tarifa fija: el importe se escribe a mano.
  | "MANUAL";

export type Concepto = {
  codigo: string;
  nombre: string;
  precio: number;
  unidad: Unidad;
  /** Aclaración que se muestra bajo el nombre, cuando hace falta. */
  nota?: string;
};

/**
 * Catálogo de conceptos, en el mismo orden que las filas del Excel para que
 * quien venía usando la hoja se reconozca.
 *
 * Cuando cambien las tarifas, se cambian aquí. Los presupuestos ya guardados
 * NO se recalculan: cada línea conserva el precio con el que se hizo (ver
 * PresupuestoLinea en el esquema), así que un presupuesto enviado sigue
 * diciendo lo que se ofreció aunque la tarifa suba después.
 */
export const CONCEPTOS: readonly Concepto[] = [
  { codigo: "MONITORES", nombre: "Monitores", precio: 130, unidad: "DIA" },
  {
    codigo: "ALOJAMIENTO_PC",
    nombre: "Alojamiento en pensión completa",
    precio: 37,
    unidad: "PERSONA_NOCHE",
  },
  {
    codigo: "ALOJAMIENTO_MP",
    nombre: "Alojamiento en media pensión",
    precio: 33,
    unidad: "PERSONA_NOCHE",
  },
  { codigo: "ALHAMBRA", nombre: "Alhambra", precio: 12, unidad: "PERSONA" },
  {
    codigo: "PAQ_CIENCIAS",
    nombre: "Paquete de ciencias",
    precio: 12,
    unidad: "PERSONA",
  },
  {
    codigo: "MUSEO_LORCA",
    nombre: "Museo Lorca",
    precio: 5,
    unidad: "PERSONA",
  },
  {
    codigo: "CATEDRAL_CAPILLA",
    nombre: "Catedral y Capilla Real",
    precio: 16,
    unidad: "PERSONA",
  },
  { codigo: "GINCANA", nombre: "Gincana", precio: 8, unidad: "PERSONA" },
  {
    codigo: "GRANADA_SHOPPING",
    nombre: "Granada shopping",
    precio: 0,
    unidad: "PERSONA",
    nota: "Sin coste en la tarifa actual",
  },
  {
    codigo: "CUEVA_VENTANAS",
    nombre: "Cueva de las Ventanas",
    precio: 21,
    unidad: "PERSONA",
  },
  { codigo: "CLASES", nombre: "Clases", precio: 21.25, unidad: "PERSONA" },
  { codigo: "MATERIALES", nombre: "Materiales", precio: 25, unidad: "PERSONA" },
  {
    codigo: "JOB_SHADOWING",
    nombre: "Job shadowing",
    precio: 44,
    unidad: "DIA",
    nota: "44 € por día, jornada de 4 horas",
  },
  { codigo: "MYAGORA", nombre: "MyAgora", precio: 75, unidad: "PERSONA" },
  {
    codigo: "INSTALACIONES",
    nombre: "Instalaciones",
    precio: 165,
    unidad: "DIA",
  },
  { codigo: "FLAMENCO", nombre: "Flamenco", precio: 40, unidad: "PERSONA" },
  {
    codigo: "RC",
    nombre: "Responsabilidad civil",
    precio: 0,
    unidad: "MANUAL",
    nota: "La hoja no traía tarifa: se escribe el importe",
  },
  {
    codigo: "SEGURO_ACCIDENTES",
    nombre: "Seguro de accidentes",
    precio: 5,
    unidad: "PERSONA",
  },
];

export type Autobus = { codigo: string; nombre: string; precio: number };

/** Autobuses y traslados, con su precio neto por servicio. */
export const AUTOBUSES: readonly Autobus[] = [
  { codigo: "AEROP_MALAGA", nombre: "Aeropuerto de Málaga", precio: 1100 },
  { codigo: "BUS_CUEVA_VENTANAS", nombre: "Cueva de las Ventanas", precio: 500 },
  { codigo: "BUS_COSTA_TROPICAL", nombre: "Costa Tropical", precio: 475 },
  { codigo: "BUS_GRANADA", nombre: "Granada", precio: 400 },
  { codigo: "BUS_GIBRALTAR", nombre: "Gibraltar", precio: 840 },
  { codigo: "BUS_SEVILLA", nombre: "Sevilla", precio: 700 },
  { codigo: "TAXIS", nombre: "Taxis", precio: 50 },
  { codigo: "TAXI_TRANSFER_BUS", nombre: "Taxi transfer bus", precio: 48 },
];

export const MARGEN_POR_DEFECTO = 0.2; // 20 %
export const IVA_POR_DEFECTO = 0.1; // 10 %

export function buscarConcepto(codigo: string): Concepto | undefined {
  return CONCEPTOS.find((c) => c.codigo === codigo);
}

export function buscarAutobus(codigo: string): Autobus | undefined {
  return AUTOBUSES.find((a) => a.codigo === codigo);
}

/** Redondeo a céntimos. Sin esto, los decimales acumulan restos absurdos. */
export function redondear(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

export type LineaEntrada = {
  tipo: "CONCEPTO" | "AUTOBUS";
  codigo: string;
  nombre: string;
  precioUnitario: number;
  dias: number;
  cantidad: number;
};

export type LineaCalculada = LineaEntrada & { total: number };

export type Totales = {
  pax: number;
  totalNeto: number;
  margenImporte: number;
  baseIva: number;
  ivaImporte: number;
  total: number;
  pvpPorPersona: number;
};

/**
 * Cálculo del presupuesto. Es la única fuente de verdad: la usan igual la
 * ventana (para ir mostrando los totales) y el servidor (para guardar).
 *
 * Cada línea es precio × días × cantidad, como en el Excel. Los monitores no
 * cuentan como personas para el precio por persona: solo alumnos y
 * profesores, que son quienes viajan.
 */
export function calcularPresupuesto(params: {
  numAlumnos: number;
  numProfesores: number;
  lineas: LineaEntrada[];
  margenPct: number;
  ivaPct: number;
}): { lineas: LineaCalculada[]; totales: Totales } {
  const lineas: LineaCalculada[] = params.lineas.map((l) => ({
    ...l,
    total: redondear(l.precioUnitario * l.dias * l.cantidad),
  }));

  const totalNeto = redondear(lineas.reduce((suma, l) => suma + l.total, 0));
  const margenImporte = redondear(totalNeto * params.margenPct);
  // El IVA va sobre lo que se factura, que es el neto más el margen.
  const baseIva = redondear(totalNeto + margenImporte);
  const ivaImporte = redondear(baseIva * params.ivaPct);
  const total = redondear(baseIva + ivaImporte);

  const pax = Math.max(0, params.numAlumnos) + Math.max(0, params.numProfesores);
  const pvpPorPersona = pax > 0 ? redondear(total / pax) : 0;

  return {
    lineas,
    totales: {
      pax,
      totalNeto,
      margenImporte,
      baseIva,
      ivaImporte,
      total,
      pvpPorPersona,
    },
  };
}

/** Días y noches de la estancia. El último día no suma noche. */
export function diasYNoches(
  inicio: string | null,
  fin: string | null
): { dias: number; noches: number } {
  if (!inicio || !fin) return { dias: 0, noches: 0 };
  const d1 = new Date(`${inicio}T00:00:00`);
  const d2 = new Date(`${fin}T00:00:00`);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) {
    return { dias: 0, noches: 0 };
  }
  const noches = Math.round((d2.getTime() - d1.getTime()) / 86_400_000);
  if (noches < 0) return { dias: 0, noches: 0 };
  return { dias: noches + 1, noches };
}

/**
 * Días y cantidad con los que aparece cada línea la primera vez.
 *
 * La cantidad es SIEMPRE el grupo entero (alumnos más profesores): es lo que
 * vale para casi todo el catálogo y evita teclear el mismo número veinte
 * veces. Donde la cantidad no son personas (los monitores, que son cuántos
 * hacen falta, y los autobuses, que son cuántos servicios) hay que bajarla a
 * mano con las flechas.
 *
 * Los días sí dependen de la unidad: el alojamiento va por noches, lo que se
 * cobra por jornada va por días, y una visita es un día.
 */
export function valoresPorDefecto(
  unidad: Unidad,
  contexto: { pax: number; dias: number; noches: number }
): { dias: number; cantidad: number } {
  switch (unidad) {
    case "PERSONA_NOCHE":
      return { dias: contexto.noches, cantidad: contexto.pax };
    case "DIA":
      return { dias: contexto.dias, cantidad: contexto.pax };
    case "PERSONA":
      return { dias: 1, cantidad: contexto.pax };
    case "MANUAL":
      return { dias: 1, cantidad: contexto.pax };
  }
}

export function formatearEuros(n: number): string {
  return n.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
