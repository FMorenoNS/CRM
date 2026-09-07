import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/api-auth";
import { updateHabitacionSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateHabitacionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Nada que cambiar." }, { status: 400 });
  }

  await prisma.habitacion.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const ocupantes = await prisma.participante.count({
    where: { habitacionId: id },
  });
  if (ocupantes > 0) {
    return NextResponse.json(
      {
        error: `No se puede borrar: tiene ${ocupantes} participante(s) asignado(s). Quítalos primero.`,
      },
      { status: 409 }
    );
  }

  await prisma.habitacion.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
