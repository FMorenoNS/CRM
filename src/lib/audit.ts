import { prisma } from "@/lib/prisma";

// Registra una entrada en el historial de cambios de un centro. No lanza si
// falla: una entrada de historial no debe hacer que la operación principal
// se considere fallida.
export async function registrarHistorial(params: {
  centroId: string;
  actorId: string;
  accion: string;
  detalle?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        centroId: params.centroId,
        actorId: params.actorId,
        accion: params.accion,
        detalle: params.detalle || null,
      },
    });
  } catch (error) {
    console.error("No se pudo registrar el historial:", error);
  }
}
