import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { centroSchema } from "@/lib/validation";
import { registrarEventoSistema, registrarHistorial } from "@/lib/audit";
import { canEditMasterData, forbidden } from "@/lib/permissions";
import { DEMASIADO_GRANDE, getClientIp, readJsonBody } from "@/lib/request";
import { withApi } from "@/lib/http";

async function handlerPATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id } = await params;

  if (!canEditMasterData(user, id)) return forbidden();

  const body = await readJsonBody(request);
  if (body === DEMASIADO_GRANDE) {
    return NextResponse.json(
      { error: "Los datos enviados son demasiado grandes." },
      { status: 413 }
    );
  }
  const parsed = centroSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  // Se comprueba que el cliente existe antes de actualizarlo: así se
  // responde "no encontrado" en lugar de dejar que reviente por dentro.
  const existe = await prisma.centro.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existe) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  await prisma.centro.update({
    where: { id },
    data: {
      nombre: parsed.data.nombre,
      tipo: parsed.data.tipo || "CENTRO",
      pais: parsed.data.pais,
      ciudad: parsed.data.ciudad || null,
      canalOrigen: parsed.data.canalOrigen || "Facebook",
      notas: parsed.data.notas || null,
    },
  });

  await registrarHistorial({
    centroId: id,
    actorId: user.id,
    accion: "Datos del centro actualizados",
  });

  return NextResponse.json({ ok: true });
}

async function handlerDELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id } = await params;

  if (!canEditMasterData(user, id)) return forbidden();

  const centro = await prisma.centro.findUnique({
    where: { id },
    select: { nombre: true, pais: true },
  });
  if (!centro) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  await prisma.centro.delete({ where: { id } });

  // El historial del cliente se borra con él (está enlazado en cascada), así
  // que el borrado se anota como evento de sistema: es justo el movimiento
  // que más interesa poder reconstruir después.
  await registrarEventoSistema({
    actorId: user.id,
    actorEmail: user.email,
    accion: "Cliente eliminado",
    detalle: `${centro.nombre || "(sin nombre)"} · ${centro.pais}`,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}

// Cada método se publica envuelto en withApi: si algo falla por dentro, el
// usuario recibe un mensaje genérico con un código de referencia y el
// detalle completo queda solo en el registro del servidor.
export const PATCH = withApi("PATCH /api/centros/[id]", handlerPATCH as never);
export const DELETE = withApi("DELETE /api/centros/[id]", handlerDELETE as never);
