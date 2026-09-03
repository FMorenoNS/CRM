import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { interaccionSchema } from "@/lib/validation";
import { registrarHistorial } from "@/lib/audit";
import { INTERACCION_LABELS } from "@/lib/labels";
import { canAccessCentro, canDoOperational, forbidden, noEncontrado } from "@/lib/permissions";
import { DEMASIADO_GRANDE, readJsonBody } from "@/lib/request";
import { withApi } from "@/lib/http";

async function handlerPOST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id: estanciaId } = await params;

  const estancia = await prisma.estancia.findUnique({
    where: { id: estanciaId },
    select: { centroId: true },
  });
  if (!estancia) {
    return noEncontrado();
  }
  // Si no puede ver ese cliente, se responde igual que si no existiera:
  // un 403 aquí confirmaría que el registro existe (ver noEncontrado).
  if (!canAccessCentro(user, estancia.centroId)) return noEncontrado();
  if (!canDoOperational(user, estancia.centroId)) return forbidden();

  const body = await readJsonBody(request);
  if (body === DEMASIADO_GRANDE) {
    return NextResponse.json(
      { error: "Los datos enviados son demasiado grandes." },
      { status: 413 }
    );
  }
  const parsed = interaccionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  const interaccion = await prisma.interaccion.create({
    data: {
      estanciaId,
      autorId: user.id,
      tipo: parsed.data.tipo,
      resumen: parsed.data.resumen,
      fecha: parsed.data.fecha ? new Date(parsed.data.fecha) : new Date(),
    },
  });

  await registrarHistorial({
    centroId: estancia.centroId,
    actorId: user.id,
    accion: `Interacción registrada: ${INTERACCION_LABELS[parsed.data.tipo] ?? parsed.data.tipo}`,
    detalle: parsed.data.resumen,
  });

  return NextResponse.json({ id: interaccion.id });
}

// Cada método se publica envuelto en withApi: si algo falla por dentro, el
// usuario recibe un mensaje genérico con un código de referencia y el
// detalle completo queda solo en el registro del servidor.
export const POST = withApi("POST /api/estancias/[id]/interacciones", handlerPOST as never);
