import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { registrarHistorial } from "@/lib/audit";
import { canAccessCentro, canDoOperational, forbidden, noEncontrado } from "@/lib/permissions";
import { DEMASIADO_GRANDE, readJsonBody } from "@/lib/request";
import { withApi } from "@/lib/http";

const schema = z.object({ activo: z.boolean() });

async function handlerPATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id } = await params;

  const existing = await prisma.estancia.findUnique({
    where: { id },
    select: { centroId: true },
  });
  if (!existing) {
    return noEncontrado();
  }
  // Si no puede ver ese cliente, se responde igual que si no existiera:
  // un 403 aquí confirmaría que el registro existe (ver noEncontrado).
  if (!canAccessCentro(user, existing.centroId)) return noEncontrado();
  if (!canDoOperational(user, existing.centroId)) return forbidden();

  const body = await readJsonBody(request);
  if (body === DEMASIADO_GRANDE) {
    return NextResponse.json(
      { error: "Los datos enviados son demasiado grandes." },
      { status: 413 }
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const estancia = await prisma.estancia.update({
    where: { id },
    data: { activo: parsed.data.activo },
  });

  await registrarHistorial({
    centroId: estancia.centroId,
    actorId: user.id,
    accion: parsed.data.activo
      ? "Estancia marcada como activa"
      : "Estancia marcada como inactiva",
    detalle: estancia.tipoPrograma,
  });

  return NextResponse.json({ ok: true });
}

// Cada método se publica envuelto en withApi: si algo falla por dentro, el
// usuario recibe un mensaje genérico con un código de referencia y el
// detalle completo queda solo en el registro del servidor.
export const PATCH = withApi("PATCH /api/estancias/[id]/activo", handlerPATCH as never);
