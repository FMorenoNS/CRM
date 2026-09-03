import "server-only";
import { prisma } from "@/lib/prisma";

// Cuánto se conserva el registro de actividad. Dos años cubre de sobra
// cualquier necesidad de investigar un incidente sin acumular datos
// personales indefinidamente (principio de minimización del RGPD).
export const RETENCION_HISTORIAL_DIAS = 730;

type EntradaHistorial = {
  centroId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  accion: string;
  detalle?: string | null;
  ip?: string | null;
};

/**
 * Registra una entrada en el registro de actividad: quién hizo qué, sobre
 * qué cliente, cuándo y desde qué IP.
 *
 * No lanza si falla: que no se pueda escribir una línea de historial no debe
 * hacer que la operación principal se considere fallida.
 */
export async function registrarHistorial(params: EntradaHistorial) {
  try {
    await prisma.auditLog.create({
      data: {
        centroId: params.centroId ?? null,
        actorId: params.actorId ?? null,
        actorEmail: params.actorEmail?.slice(0, 200) ?? null,
        accion: params.accion.slice(0, 200),
        detalle: params.detalle?.slice(0, 1000) || null,
        ip: params.ip ?? null,
      },
    });
  } catch (error) {
    console.error("No se pudo registrar el historial:", error);
  }
}

/**
 * Eventos que no cuelgan de ningún cliente: inicios y cierres de sesión,
 * intentos fallidos, alta y cambios de usuarios, exportaciones de datos.
 */
export async function registrarEventoSistema(
  params: Omit<EntradaHistorial, "centroId">
) {
  return registrarHistorial({ ...params, centroId: null });
}

/** Borra las entradas de historial más antiguas que la retención fijada. */
export async function purgarHistorialAntiguo(
  dias = RETENCION_HISTORIAL_DIAS
): Promise<number> {
  const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  const { count } = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: limite } },
  });
  return count;
}
