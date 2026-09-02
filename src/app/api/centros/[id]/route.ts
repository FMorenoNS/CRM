import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { centroSchema } from "@/lib/validation";
import { registrarHistorial } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = centroSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  await prisma.centro.update({
    where: { id },
    data: {
      nombre: parsed.data.nombre,
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  await prisma.centro.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
