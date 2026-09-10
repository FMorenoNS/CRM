import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, requireApiAdmin } from "@/lib/api-auth";
import { habitacionSchema } from "@/lib/validation";

// Catálogo de habitaciones: cualquier usuario autenticado puede listarlo
// (hace falta para elegir habitación al asignar un participante), pero solo
// ADMIN puede crear/editar/borrar habitaciones (es configuración interna de
// la residencia, no depende de ningún cliente).
export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;

  const habitaciones = await prisma.habitacion.findMany({
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(habitaciones);
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const parsed = habitacionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  const habitacion = await prisma.habitacion.create({ data: parsed.data });
  return NextResponse.json({ id: habitacion.id });
}
