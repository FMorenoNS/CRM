import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { createCentroSchema } from "@/lib/validation";
import { registrarHistorial } from "@/lib/audit";

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

  await registrarHistorial({
    centroId: centro.id,
    actorId: user.id,
    accion: "Centro creado",
    detalle: centro.nombre || null,
  });

  // Todo centro nace con una primera estancia (estado INTERESADO por
  // defecto) para que aparezca de inmediato en las alertas del panel y en
  // la pipeline, aunque no se haya rellenado ningún dato de la estancia.
  const estancia = await prisma.estancia.create({
    data: {
      centroId: centro.id,
      tipoPrograma: d.tipoPrograma || "Por definir",
      tipoParticipante: d.tipoParticipante || "ALUMNOS",
      centroReceptor: d.centroReceptor || "Granada",
      edadGrupo: d.edadGrupo || null,
      fechaInicio: d.fechaInicio ? new Date(d.fechaInicio) : null,
      fechaFin: d.fechaFin ? new Date(d.fechaFin) : null,
      presupuestoImporte:
        d.presupuestoImporte !== undefined &&
        d.presupuestoImporte !== null &&
        d.presupuestoImporte !== ""
          ? d.presupuestoImporte
          : null,
      notas: d.estanciaNotas || null,
    },
  });

  await registrarHistorial({
    centroId: centro.id,
    actorId: user.id,
    accion: "Estancia creada",
    detalle: estancia.tipoPrograma,
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

    await registrarHistorial({
      centroId: centro.id,
      actorId: user.id,
      accion: "Captación de Facebook registrada",
      detalle: d.grupoUrl,
    });
  }

  return NextResponse.json({ id: centro.id });
}
