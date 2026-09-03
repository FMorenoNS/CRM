import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { createCentroSchema } from "@/lib/validation";
import { registrarHistorial } from "@/lib/audit";
import { canAccessCentro } from "@/lib/permissions";
import { DEMASIADO_GRANDE, readJsonBody } from "@/lib/request";
import { withApi } from "@/lib/http";

async function handlerPOST(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const body = await readJsonBody(request);
  if (body === DEMASIADO_GRANDE) {
    return NextResponse.json(
      { error: "Los datos enviados son demasiado grandes." },
      { status: 413 }
    );
  }
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
  //
  // Aquí hay una tensión real entre dos cosas que las dos importan:
  //
  //  - La búsqueda tiene que recorrer TODA la base. Si solo mirara los
  //    clientes que ve quien está dando el alta, alguien de Dirección
  //    duplicaría sin enterarse un centro que gestiona otra persona, y el
  //    duplicado es justo lo que este control existe para evitar.
  //  - Pero la respuesta no puede devolver la ficha de un cliente que esa
  //    persona no tiene derecho a ver. Antes devolvía nombre, país y ciudad
  //    de cualquier coincidencia, así que el formulario de alta servía de
  //    buscador de la cartera completa: se escribía un nombre y el CRM
  //    contaba si existía y dónde.
  //
  // La salida: se busca en todo, pero solo se enseña la ficha de los que la
  // persona ya podría ver por su cuenta. Del resto se devuelve únicamente
  // cuántos hay, sin un solo dato, para que sepa que tiene que preguntar en
  // vez de crear un duplicado.
  if (!d.force) {
    const coincidencias = await prisma.centro.findMany({
      where: {
        OR: [
          { nombre: { equals: d.nombre, mode: "insensitive" } },
          ...(email
            ? [{ contactos: { some: { email: { equals: email, mode: "insensitive" as const } } } }]
            : []),
        ],
      },
      select: { id: true, nombre: true, pais: true, ciudad: true },
      take: 20,
    });

    if (coincidencias.length > 0) {
      const visibles = coincidencias.filter((c) => canAccessCentro(user, c.id));
      const ocultos = coincidencias.length - visibles.length;

      return NextResponse.json(
        {
          error: "posible_duplicado",
          duplicados: visibles.slice(0, 5),
          ocultos,
        },
        { status: 409 }
      );
    }
  }

  const centro = await prisma.centro.create({
    data: {
      nombre: d.nombre,
      tipo: d.tipo || "CENTRO",
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
      // Dirección solo ve/edita sus clientes asignados: al crear uno nuevo,
      // se le asigna automáticamente para que conserve acceso a él.
      usuarios:
        user.role === "DIRECCION" ? { connect: { id: user.id } } : undefined,
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
      tipoProyecto: d.tipoProyecto || null,
      tipoParticipante: d.tipoParticipante || "ALUMNOS",
      centroReceptor: d.centroReceptor || "Granada",
      provincia: d.provincia || null,
      numeroAlumnos:
        d.numeroAlumnos !== undefined &&
        d.numeroAlumnos !== null &&
        d.numeroAlumnos !== ""
          ? Number(d.numeroAlumnos)
          : null,
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

// Cada método se publica envuelto en withApi: si algo falla por dentro, el
// usuario recibe un mensaje genérico con un código de referencia y el
// detalle completo queda solo en el registro del servidor.
export const POST = withApi("POST /api/centros", handlerPOST as never);
