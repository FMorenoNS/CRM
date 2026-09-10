import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/api-auth";
import { registrarEventoSistema } from "@/lib/audit";
import { DEMASIADO_GRANDE, getClientIp, readJsonBody } from "@/lib/request";
import { withApi } from "@/lib/http";

const updateSchema = z.object({
  activo: z.boolean(),
});

async function handlerPATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const body = await readJsonBody(request);
  if (body === DEMASIADO_GRANDE) {
    return NextResponse.json(
      { error: "Los datos enviados son demasiado grandes." },
      { status: 413 }
    );
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  // Se comprueba que la clave existe antes de tocarla, para responder 404 en
  // lugar de un error interno si el identificador es inventado.
  const clave = await prisma.apiKey.findUnique({
    where: { id },
    select: { nombre: true },
  });
  if (!clave) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }

  await prisma.apiKey.update({
    where: { id },
    data: { activo: parsed.data.activo },
  });

  await registrarEventoSistema({
    actorId: auth.id,
    actorEmail: auth.email,
    accion: parsed.data.activo
      ? "Clave de API reactivada"
      : "Clave de API desactivada",
    detalle: clave.nombre,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}

async function handlerDELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const clave = await prisma.apiKey.findUnique({
    where: { id },
    select: { nombre: true },
  });
  if (!clave) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }

  await prisma.apiKey.delete({ where: { id } });

  await registrarEventoSistema({
    actorId: auth.id,
    actorEmail: auth.email,
    accion: "Clave de API eliminada",
    detalle: clave.nombre,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}

// Cada método se publica envuelto en withApi: si algo falla por dentro, el
// usuario recibe un mensaje genérico con un código de referencia y el
// detalle completo queda solo en el registro del servidor.
export const PATCH = withApi("PATCH /api/api-keys/[id]", handlerPATCH as never);
export const DELETE = withApi("DELETE /api/api-keys/[id]", handlerDELETE as never);
