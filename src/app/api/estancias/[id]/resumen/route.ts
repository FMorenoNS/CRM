import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { ESTADO_LABELS } from "@/lib/labels";
import { canAccessCentro, forbidden } from "@/lib/permissions";

// Resumen mínimo de una estancia, para las acciones rápidas del kanban (no
// hace falta cargar toda la ficha del cliente solo para registrar una
// interacción rápida).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const estancia = await prisma.estancia.findUnique({
    where: { id },
    include: {
      centro: {
        select: {
          id: true,
          nombre: true,
          contactos: { orderBy: { createdAt: "asc" }, take: 1 },
        },
      },
    },
  });
  if (!estancia) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }
  if (!canAccessCentro(auth, estancia.centro.id)) return forbidden();

  const contacto = estancia.centro.contactos[0];

  return NextResponse.json({
    centroId: estancia.centro.id,
    centroNombre: estancia.centro.nombre,
    estado: estancia.estado,
    estadoLabel: ESTADO_LABELS[estancia.estado] ?? estancia.estado,
    contactoNombre: contacto?.nombre ?? null,
    contactoTelefono: contacto?.telefono ?? null,
    contactoEmail: contacto?.email ?? null,
  });
}
