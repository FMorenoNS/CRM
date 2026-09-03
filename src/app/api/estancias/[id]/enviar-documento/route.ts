import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { isEmailConfigured, sendDocumentEmail } from "@/lib/email";
import { registrarHistorial } from "@/lib/audit";
import { canAccessCentro, canDoOperational, forbidden, noEncontrado } from "@/lib/permissions";
import { comprobarLimiteMemoria } from "@/lib/rate-limit";
import { DEMASIADO_GRANDE, readJsonBody } from "@/lib/request";
import { withApi } from "@/lib/http";

const schema = z.object({
  tipo: z.enum(["PRESUPUESTO", "CONTRATO"]),
  destinatario: z
    .string()
    .trim()
    .max(320)
    .email("Email de destinatario inválido."),
});

async function handlerPOST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id: estanciaId } = await params;

  // Máximo 40 envíos por hora y usuario: el correo sale del buzón de
  // Novaschool y un uso abusivo dañaría la reputación del dominio.
  const limite = comprobarLimiteMemoria(`email:${user.id}`, 40, 3600);
  if (limite.bloqueado) {
    return NextResponse.json(
      { error: "Has enviado demasiados documentos seguidos. Prueba dentro de un rato." },
      { status: 429 }
    );
  }

  const body = await readJsonBody(request);
  if (body === DEMASIADO_GRANDE) {
    return NextResponse.json(
      { error: "Los datos enviados son demasiado grandes." },
      { status: 413 }
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  const estancia = await prisma.estancia.findUnique({
    where: { id: estanciaId },
    select: { centroId: true },
  });
  if (!estancia) {
    return noEncontrado();
  }
  // Si no puede ver ese cliente, se responde igual que si no existiera:
  // un 403 aquí confirmaría que el registro existe (ver noEncontrado).
  if (!canAccessCentro(user, estancia.centroId)) return noEncontrado();
  if (!canDoOperational(user, estancia.centroId)) return forbidden();

  // El destinatario tiene que ser una persona de contacto de ESE cliente.
  //
  // Antes valía cualquier dirección con formato correcto, así que cualquiera
  // con una cuenta podía hacer que el buzón de Novaschool escribiera a quien
  // quisiera. El texto del correo es una plantilla fija, así que no servía
  // para suplantar a nadie, pero sí para usar el dominio de la empresa como
  // remitente hacia fuera, cuarenta veces por hora.
  //
  // La comprobación se hace aquí y no solo en el desplegable de la pantalla
  // porque el desplegable no es una barrera: cualquiera puede enviar la
  // petición a mano.
  const esContactoDelCliente = await prisma.contacto.findFirst({
    where: {
      centroId: estancia.centroId,
      email: { equals: parsed.data.destinatario, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (!esContactoDelCliente) {
    return NextResponse.json(
      {
        error:
          "Solo se puede enviar a una persona de contacto de este cliente. Añádela en su ficha y vuelve a intentarlo.",
      },
      { status: 400 }
    );
  }

  // El aviso de que el correo no está configurado va DESPUÉS de los permisos:
  // antes iba primero y se lo llevaba cualquiera, incluso quien no tenía
  // derecho a tocar esa estancia.
  if (!isEmailConfigured()) {
    return NextResponse.json(
      {
        error:
          "El envío de correo aún no está configurado. IT debe registrar la app en Azure AD (Microsoft Graph).",
      },
      { status: 503 }
    );
  }

  const label =
    parsed.data.tipo === "PRESUPUESTO" ? "presupuesto" : "contrato";

  try {
    await sendDocumentEmail({
      to: parsed.data.destinatario,
      subject: `Novaschool Granada: ${label}`,
      bodyHtml: `<p>Estimado/a,</p><p>Adjuntamos el ${label} para su programa de movilidad Erasmus+ en nuestra residencia de Granada.</p><p>Un saludo,<br/>Novaschool</p>`,
    });

    await prisma.documentoEnviado.create({
      data: {
        estanciaId,
        tipo: parsed.data.tipo,
        enviadoPorId: user.id,
        destinatario: parsed.data.destinatario,
        exito: true,
      },
    });

    if (estancia) {
      await registrarHistorial({
        centroId: estancia.centroId,
        actorId: user.id,
        accion: `Documento enviado: ${label}`,
        detalle: parsed.data.destinatario,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    await prisma.documentoEnviado.create({
      data: {
        estanciaId,
        tipo: parsed.data.tipo,
        enviadoPorId: user.id,
        destinatario: parsed.data.destinatario,
        exito: false,
        detalle: error instanceof Error ? error.message : "Error desconocido",
      },
    });

    if (estancia) {
      await registrarHistorial({
        centroId: estancia.centroId,
        actorId: user.id,
        accion: `Envío de documento fallido: ${label}`,
        detalle: parsed.data.destinatario,
      });
    }

    return NextResponse.json(
      { error: "No se pudo enviar el correo." },
      { status: 500 }
    );
  }
}

// Cada método se publica envuelto en withApi: si algo falla por dentro, el
// usuario recibe un mensaje genérico con un código de referencia y el
// detalle completo queda solo en el registro del servidor.
export const POST = withApi("POST /api/estancias/[id]/enviar-documento", handlerPOST as never);
