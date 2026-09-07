import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/api-auth";
import { PARTICIPANTE_LABELS } from "@/lib/labels";

// Detalle completo de un día concreto para el calendario de ocupación de
// /habitaciones (solo ADMIN, igual que esa página): qué habitaciones hay,
// quién ocupa cada una ese día y de qué cliente/estancia es.
export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const fechaStr = searchParams.get("fecha");
  if (!fechaStr || !/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
    return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
  }
  const fecha = new Date(`${fechaStr}T00:00:00.000Z`);

  const [habitaciones, participantes] = await Promise.all([
    prisma.habitacion.findMany({
      where: { activa: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, capacidad: true },
    }),
    prisma.participante.findMany({
      where: {
        habitacionId: { not: null },
        estancia: { fechaInicio: { lte: fecha }, fechaFin: { gte: fecha } },
      },
      select: {
        id: true,
        nombre: true,
        rol: true,
        habitacionId: true,
        estanciaId: true,
        estancia: { select: { centro: { select: { id: true, nombre: true } } } },
      },
    }),
  ]);

  const porHabitacion = habitaciones.map((h) => ({
    id: h.id,
    nombre: h.nombre,
    capacidad: h.capacidad,
    ocupantes: participantes
      .filter((p) => p.habitacionId === h.id)
      .map((p) => ({
        id: p.id,
        nombre: p.nombre,
        rol: p.rol,
        rolLabel: PARTICIPANTE_LABELS[p.rol] ?? p.rol,
        centroId: p.estancia.centro.id,
        centroNombre: p.estancia.centro.nombre,
        estanciaId: p.estanciaId,
      })),
  }));

  return NextResponse.json({ fecha: fechaStr, habitaciones: porHabitacion });
}
