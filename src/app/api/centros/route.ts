import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { createCentroSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const body = await request.json().catch(() => null);
  const parsed = createCentroSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const email = d.contactoEmail || null;

  // Detección de duplicados por nombre del centro (sin distinguir mayúsculas)
  // o por email de contacto ya registrado.
  if (!d.force) {
    const duplicados = await prisma.centro.findMany({
      where: {
        OR: [
          { nombre: { equals: d.nombre, mode: "insensitive" } },
          ...(email
            ? [{ contactos: { some: { email: { equals: email, mode: "insensitive" as const } } } }]
            : []),
        ],
      },
      select: { id: true, nombre: true, pais: true, ciudad: true },
      take: 5,
    });

    if (duplicados.length > 0) {
      return NextResponse.json(
        { error: "posible_duplicado", duplicados },
        { status: 409 }
      );
    }
  }

  const centro = await prisma.centro.create({
    data: {
      nombre: d.nombre,
      pais: d.pais,
      ciudad: d.ciudad || null,
      canalOrigen: d.canalOrigen || "Facebook",
      notas: d.notas || null,
      contactos:
        d.contactoNombre || email || d.contactoTelefono
          ? {
              create: {
                nombre: d.contactoNombre || "(sin nombre)",
                cargo: d.contactoCargo || null,
                email: email,
                telefono: d.contactoTelefono || null,
              },
            }
          : undefined,
    },
  });

  // Si desde el alta rápida se indicó tipo de programa y/o grupo de
  // Facebook, se crea directamente la primera estancia (con su captación).
  if (d.tipoPrograma || d.grupoUrl) {
    const estancia = await prisma.estancia.create({
      data: {
        centroId: centro.id,
        tipoPrograma: d.tipoPrograma || "Por definir",
        tipoParticipante: "ALUMNOS",
      },
    });

    if (d.grupoUrl) {
      await prisma.interaccion.create({
        data: {
          estanciaId: estancia.id,
          autorId: user.id,
          tipo: "CAPTACION_FACEBOOK",
          grupoUrl: d.grupoUrl,
          resumen: "Mensaje encontrado en un grupo de Facebook",
        },
      });
    }
  }

  return NextResponse.json({ id: centro.id });
}
