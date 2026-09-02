import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { contactoSchema } from "@/lib/validation";
import { registrarHistorial } from "@/lib/audit";
import { canEditMasterData, forbidden } from "@/lib/permissions";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id: centroId } = await params;

  if (!canEditMasterData(user, centroId)) return forbidden();

  const body = await request.json().catch(() => null);
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
