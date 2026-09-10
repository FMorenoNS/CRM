import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { captacionSchema } from "@/lib/validation";
import { registrarHistorial } from "@/lib/audit";
import { canDoOperational, forbidden } from "@/lib/permissions";
import { DEMASIADO_GRANDE, readJsonBody } from "@/lib/request";
import { withApi } from "@/lib/http";

// Crea o actualiza la interacción de captación de Facebook (una por estancia).
async function handlerPUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id: estanciaId } = await params;

  const estanciaExistente = await prisma.estancia.findUnique({
    where: { id: estanciaId },
    select: { centroId: true },
  });
  if (!estanciaExistente) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }
  if (!canDoOperational(user, estanciaExistente.centroId)) return forbidden();

  const body = await readJsonBody(request, 6 * 1024 * 1024);
  if (body === DEMASIADO_GRANDE) {
    return NextResponse.json(
      { error: "Los datos enviados son demasiado grandes." },
      { status: 413 }
    );
  }
  const parsed = captacionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  const data = {
    grupoUrl: parsed.data.grupoUrl || null,
    perfilUrl: parsed.data.perfilUrl || null,
    mensajeContacto: parsed.data.mensajeContacto || null,
    capturaBase64: parsed.data.capturaBase64 || null,
    resumen: "Mensaje encontrado en un grupo de Facebook",
  };

  const existing = await prisma.interaccion.findFirst({
    where: { estanciaId, tipo: "CAPTACION_FACEBOOK" },
  });

  if (existing) {
    await prisma.interaccion.update({ where: { id: existing.id }, data });
  } else {
    await prisma.interaccion.create({
      data: {
        estanciaId,
        autorId: user.id,
        tipo: "CAPTACION_FACEBOOK",
        ...data,
      },
    });
  }

  await registrarHistorial({
    centroId: estanciaExistente.centroId,
    actorId: user.id,
    accion: "Captación de Facebook actualizada",
  });

  return NextResponse.json({ ok: true });
}

// Cada método se publica envuelto en withApi: si algo falla por dentro, el
// usuario recibe un mensaje genérico con un código de referencia y el
// detalle completo queda solo en el registro del servidor.
export const PUT = withApi("PUT /api/estancias/[id]/captacion", handlerPUT as never);
