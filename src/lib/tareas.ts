import { prisma } from "@/lib/prisma";
import { ESTADO_LABELS, INTERACCION_LABELS, DOCUMENTO_LABELS } from "@/lib/labels";
import { centroVisibilityFilter } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";

export const DIAS_SEGUIMIENTO = 3; // a partir de aquí, "hay que hacer algo"
export const DIAS_ABANDONO = 15; // a partir de aquí, "esto probablemente está muerto"
export const DIAS_PROXIMA = 21; // 3 semanas: avisar si el viaje se acerca sin cerrar

// Estados donde tiene sentido "molestar" por inactividad: el trato sigue
// abierto y depende de que alguien responda. CONTRATO_FIRMADO y ALOJADO se
// excluyen a propósito: una vez firmado, es normal no tener contacto durante
// meses hasta la fecha del viaje, y eso no es una tarea pendiente.
const ESTADOS_EN_CURSO = [
  "CONTACTADO",
  "EN_CONVERSACION",
  "PRESUPUESTO_ENVIADO",
  "PRESUPUESTO_CONFIRMADO",
] as const;

// Estados donde, si la fecha de inicio se acerca y seguimos aquí, hay prisa.
const ESTADOS_SIN_CERRAR = [
  "INTERESADO",
  "CONTACTADO",
  "EN_CONVERSACION",
  "PRESUPUESTO_ENVIADO",
  "PRESUPUESTO_CONFIRMADO",
] as const;

const ESTADO_A_GRUPO: Record<string, "sinRespuesta" | "presupuesto" | "contrato"> = {
  CONTACTADO: "sinRespuesta",
  EN_CONVERSACION: "sinRespuesta",
  PRESUPUESTO_ENVIADO: "presupuesto",
  PRESUPUESTO_CONFIRMADO: "contrato",
};

export type Contacto =
  | { nombre: string; telefono: string | null; email: string | null }
  | undefined;

export type TareaItem = {
  key: string;
  href: string;
  centroNombre: string;
  contacto: Contacto;
  estado: string;
  detalle: string;
};

export type AlertaItem = {
  key: string;
  href: string;
  centroNombre: string;
  contacto: Contacto;
  detalle: string;
};

export type DocumentoFallidoItem = {
  key: string;
  href: string;
  centroNombre: string;
  detalle: string;
};

export type Tareas = {
  porContactar: TareaItem[];
  sinRespuesta: TareaItem[];
  presupuestoSinConfirmar: TareaItem[];
  contratoPendienteFirma: TareaItem[];
  proximas: TareaItem[];
  abandonadas: AlertaItem[];
  documentosFallidos: DocumentoFallidoItem[];
  totalTareas: number;
  totalAlertas: number;
};

function diasDesde(fecha: Date, ahora: number) {
  return Math.floor((ahora - fecha.getTime()) / 86_400_000);
}

// Clasificación de tareas: cada estancia cae en UN único aviso, según su
// gravedad (15+ días siempre gana y va a "Abandonadas"). Usada tanto por el
// Panel (resumen) como por /tareas (listado completo).
export async function getTareas(session: SessionUser): Promise<Tareas> {
  const visibilidad = centroVisibilityFilter(session);
  const ahora = Date.now();
  const enTresSemanas = new Date(ahora + DIAS_PROXIMA * 86_400_000);
  const contactosSelect = { orderBy: { createdAt: "asc" as const }, take: 1 };

  const [porContactarRaw, enCursoRaw, proximasRaw, documentosFallidosRaw] =
    await Promise.all([
      // Interesados a los que aún no hemos llamado.
      prisma.estancia.findMany({
        where: { activo: true, estado: "INTERESADO", centro: visibilidad },
        include: {
          centro: { select: { id: true, nombre: true, contactos: contactosSelect } },
        },
        orderBy: { createdAt: "asc" },
      }),
      // En gestión: para detectar silencios (sin respuesta / abandono).
      prisma.estancia.findMany({
        where: {
          activo: true,
          estado: { in: [...ESTADOS_EN_CURSO] },
          centro: visibilidad,
        },
        include: {
          centro: { select: { id: true, nombre: true, contactos: contactosSelect } },
          interacciones: {
            where: { tipo: { not: "CAPTACION_FACEBOOK" } },
            orderBy: { fecha: "desc" },
            take: 1,
          },
        },
      }),
      // Fecha de inicio próxima y todavía sin contrato firmado.
      prisma.estancia.findMany({
        where: {
          activo: true,
          estado: { in: [...ESTADOS_SIN_CERRAR] },
          fechaInicio: { not: null, lte: enTresSemanas },
          centro: visibilidad,
        },
        include: {
          centro: { select: { id: true, nombre: true, contactos: contactosSelect } },
        },
        orderBy: { fechaInicio: "asc" },
      }),
      // Envíos de presupuesto/contrato que fallaron.
      prisma.documentoEnviado.findMany({
        where: { exito: false, estancia: { centro: visibilidad } },
        include: {
          estancia: { include: { centro: { select: { id: true, nombre: true } } } },
        },
        orderBy: { enviadoEn: "desc" },
      }),
    ]);

  const porContactar: TareaItem[] = [];
  const sinRespuesta: TareaItem[] = [];
  const presupuestoSinConfirmar: TareaItem[] = [];
  const contratoPendienteFirma: TareaItem[] = [];
  const abandonadas: AlertaItem[] = [];
  const idsPrincipales = new Set<string>();

  for (const e of porContactarRaw) {
    const dias = diasDesde(e.createdAt, ahora);
    const href = `/centros/${e.centro.id}?estancia=${e.id}`;
    const contacto = e.centro.contactos[0];
    if (dias >= DIAS_ABANDONO) {
      abandonadas.push({
        key: e.id,
        href,
        centroNombre: e.centro.nombre,
        contacto,
        detalle: `Nunca contactado, ${dias} días desde que llegó`,
      });
    } else {
      idsPrincipales.add(e.id);
      porContactar.push({
        key: e.id,
        href,
        centroNombre: e.centro.nombre,
        contacto,
        estado: e.estado,
        detalle:
          dias === 0
            ? "Nos ha contactado hoy, sin llamar todavía"
            : `Esperando primer contacto desde hace ${dias} día${dias === 1 ? "" : "s"}`,
      });
    }
  }

  for (const e of enCursoRaw) {
    const ultima = e.interacciones[0];
    const fechaRef = ultima?.fecha ?? e.createdAt;
    const dias = diasDesde(fechaRef, ahora);
    if (dias < DIAS_SEGUIMIENTO) continue;

    const href = `/centros/${e.centro.id}?estancia=${e.id}`;
    const contacto = e.centro.contactos[0];
    const detalleBase = ultima
      ? `Último contacto por ${INTERACCION_LABELS[ultima.tipo]?.toLowerCase()} hace ${dias} días`
      : `Sin contacto desde hace ${dias} días`;

    if (dias >= DIAS_ABANDONO) {
      abandonadas.push({
        key: e.id,
        href,
        centroNombre: e.centro.nombre,
        contacto,
        detalle: `${detalleBase} · ${ESTADO_LABELS[e.estado]}`,
      });
      continue;
    }

    idsPrincipales.add(e.id);
    const item: TareaItem = {
      key: e.id,
      href,
      centroNombre: e.centro.nombre,
      contacto,
      estado: e.estado,
      detalle: detalleBase,
    };
    const grupo = ESTADO_A_GRUPO[e.estado];
    if (grupo === "sinRespuesta") sinRespuesta.push(item);
    else if (grupo === "presupuesto") presupuestoSinConfirmar.push(item);
    else if (grupo === "contrato") contratoPendienteFirma.push(item);
  }

  const proximas: TareaItem[] = proximasRaw.map((e) => {
    const diasRestantes = Math.ceil((e.fechaInicio!.getTime() - ahora) / 86_400_000);
    idsPrincipales.add(e.id);
    return {
      key: e.id,
      href: `/centros/${e.centro.id}?estancia=${e.id}`,
      centroNombre: e.centro.nombre,
      contacto: e.centro.contactos[0],
      estado: e.estado,
      detalle:
        diasRestantes < 0
          ? `La fecha de inicio ya pasó (hace ${-diasRestantes} días) y sigue sin cerrar · ${ESTADO_LABELS[e.estado]}`
          : `Empieza en ${diasRestantes} día${diasRestantes === 1 ? "" : "s"} y sigue sin cerrar · ${ESTADO_LABELS[e.estado]}`,
    };
  });

  const documentosFallidos: DocumentoFallidoItem[] = documentosFallidosRaw.map((d) => ({
    key: d.id,
    href: `/centros/${d.estancia.centro.id}?estancia=${d.estanciaId}`,
    centroNombre: d.estancia.centro.nombre,
    detalle: `${DOCUMENTO_LABELS[d.tipo]} a ${d.destinatario}: el envío falló (${d.enviadoEn.toLocaleDateString("es-ES")})`,
  }));

  const totalTareas = idsPrincipales.size;
  const totalAlertas = totalTareas + abandonadas.length + documentosFallidos.length;

  return {
    porContactar,
    sinRespuesta,
    presupuestoSinConfirmar,
    contratoPendienteFirma,
    proximas,
    abandonadas,
    documentosFallidos,
    totalTareas,
    totalAlertas,
  };
}
