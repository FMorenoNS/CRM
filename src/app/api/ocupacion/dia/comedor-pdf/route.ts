import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/api-auth";
import { PARTICIPANTE_LABELS } from "@/lib/labels";
import { generarComedorPdf, type ParticipanteComedor } from "@/lib/comedor-pdf";

// Descarga del informe de comedor de un día concreto: para monitores
// (necesidades de cada niño en excursiones) y para cocina (resumen de
// categorías dietéticas y quién come cada servicio).
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const fechaStr = searchParams.get("fecha");
  if (!fechaStr || !/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
    return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
  }
  const fecha = new Date(`${fechaStr}T00:00:00.000Z`);

  const participantes = await prisma.participante.findMany({
    where: {
      habitacionId: { not: null },
      estancia: {
        fechaInicio: { lte: fecha },
        fechaFin: { gte: fecha },
        estado: { not: "PERDIDO" },
      },
    },
    select: {
      nombre: true,
      rol: true,
      alergias: true,
      celiaco: true,
      intoleranteLactosa: true,
      vegetariano: true,
      desayuno: true,
      almuerzo: true,
      cena: true,
      habitacion: { select: { nombre: true } },
      estancia: { select: { centro: { select: { nombre: true } } } },
    },
    orderBy: { nombre: "asc" },
  });

  const datos: ParticipanteComedor[] = participantes.map((p) => ({
    nombre: p.nombre,
    rolLabel: PARTICIPANTE_LABELS[p.rol] ?? p.rol,
    centroNombre: p.estancia.centro.nombre,
    habitacionNombre: p.habitacion?.nombre ?? null,
    alergias: p.alergias,
    celiaco: p.celiaco,
    intoleranteLactosa: p.intoleranteLactosa,
    vegetariano: p.vegetariano,
    desayuno: p.desayuno,
    almuerzo: p.almuerzo,
    cena: p.cena,
  }));

  const fechaLabel = fecha.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const pdf = await generarComedorPdf({ fechaLabel, participantes: datos });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="comedor-${fechaStr}.pdf"`,
    },
  });
}
