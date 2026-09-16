/**
 * Año fiscal de Novaschool: empieza el 1 de julio y acaba el 30 de junio
 * siguiente (no coincide con el año natural). Se usa en Informes para
 * poder ver los números de un año fiscal concreto, y para saber si un
 * ingreso se cobró dentro de su propio año fiscal o en el anterior.
 */

export type PeriodoFiscal = {
  /** "2025-2026": empieza el 1 de julio de 2025, acaba el 30 de junio de 2026. */
  etiqueta: string;
  inicio: Date;
  fin: Date;
};

/** Año fiscal al que pertenece una fecha (julio a junio). */
export function periodoFiscalDe(fecha: Date): PeriodoFiscal {
  const anio = fecha.getUTCMonth() >= 6 ? fecha.getUTCFullYear() : fecha.getUTCFullYear() - 1;
  return {
    etiqueta: `${anio}-${anio + 1}`,
    inicio: new Date(Date.UTC(anio, 6, 1)),
    fin: new Date(Date.UTC(anio + 1, 5, 30, 23, 59, 59, 999)),
  };
}

/** El periodo con esa etiqueta ("2025-2026"), o null si no tiene ese formato. */
export function periodoFiscalPorEtiqueta(etiqueta: string): PeriodoFiscal | null {
  const m = /^(\d{4})-(\d{4})$/.exec(etiqueta);
  if (!m) return null;
  const anio = Number(m[1]);
  if (Number(m[2]) !== anio + 1) return null;
  return periodoFiscalDe(new Date(Date.UTC(anio, 6, 1)));
}

/**
 * Lista de periodos fiscales a ofrecer en el selector de Informes: desde el
 * del dato más antiguo hasta el del más nuevo (o el actual, si no hay
 * estancias más allá de hoy), de más reciente a más antiguo.
 */
export function periodosDisponibles(fechas: Date[]): PeriodoFiscal[] {
  const actual = periodoFiscalDe(new Date());
  let masAntiguo = actual;
  let masNuevo = actual;
  for (const fecha of fechas) {
    const p = periodoFiscalDe(fecha);
    if (p.inicio < masAntiguo.inicio) masAntiguo = p;
    if (p.inicio > masNuevo.inicio) masNuevo = p;
  }
  const anioDesde = Number(masAntiguo.etiqueta.slice(0, 4));
  const anioHasta = Number(masNuevo.etiqueta.slice(0, 4));
  const periodos: PeriodoFiscal[] = [];
  for (let anio = anioHasta; anio >= anioDesde; anio--) {
    periodos.push(periodoFiscalDe(new Date(Date.UTC(anio, 6, 1))));
  }
  return periodos;
}
