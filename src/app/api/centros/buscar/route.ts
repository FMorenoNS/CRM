import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { centroVisibilityFilter } from "@/lib/permissions";

// Buscador rápido de la cabecera: solo nombre, hasta 8 resultados, respeta
// la visibilidad por rol de siempre (Dirección solo ve los suyos).
export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const visibilidad = centroVisibilityFilter(auth);
  const centros = await prisma.centro.findMany({
    where: {
      ...(visibilidad ?? {}),
      nombre: { contains: q, mode: "insensitive" },
    },
    select: { id: true, nombre: true, pais: true },
    orderBy: { nombre: "asc" },
    take: 8,
  });

  return NextResponse.json(centros);
}
