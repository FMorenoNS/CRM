import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { interaccionSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id: estanciaId } = await params;

  const body = await request.json().catch(() => null);
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

  return NextResponse.json({ id: interaccion.id });
}
