import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { contactoSchema } from "@/lib/validation";
import { registrarHistorial } from "@/lib/audit";
import { canAccessCentro, canEditMasterData, forbidden, noEncontrado } from "@/lib/permissions";
import { DEMASIADO_GRANDE, readJsonBody } from "@/lib/request";
import { withApi } from "@/lib/http";

async function handlerPOST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id: centroId } = await params;

  // Si no puede ver ese cliente, se responde igual que si no existiera:
  // un 403 aquí confirmaría que el registro existe (ver noEncontrado).
  if (!canAccessCentro(user, centroId)) return noEncontrado();
  if (!canEditMasterData(user, centroId)) return forbidden();

  const body = await readJsonBody(request);
  if (body === DEMASIADO_GRANDE) {
    return NextResponse.json(
      { error: "Los datos enviados son demasiado grandes." },
      { status: 413 }
    );
  }
  const parsed = contactoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  const contacto = await prisma.contacto.create({
    data: {
      centroId,
      nombre: parsed.data.nombre,
      telefono: parsed.data.telefono || null,
      email: parsed.data.email || null,
      cargo: parsed.data.cargo || null,
    },
  });

  await registrarHistorial({
    centroId,
    actorId: user.id,
    accion: "Contacto añadido",
    detalle: contacto.nombre,
  });

  return NextResponse.json({ id: contacto.id });
}

// Cada método se publica envuelto en withApi: si algo falla por dentro, el
// usuario recibe un mensaje genérico con un código de referencia y el
// detalle completo queda solo en el registro del servidor.
export const POST = withApi("POST /api/centros/[id]/contactos", handlerPOST as never);
