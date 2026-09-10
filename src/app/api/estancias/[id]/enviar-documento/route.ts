import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { isEmailConfigured, sendDocumentEmail } from "@/lib/email";
import { registrarHistorial } from "@/lib/audit";
import { canDoOperational, forbidden } from "@/lib/permissions";
import { comprobarLimiteMemoria } from "@/lib/rate-limit";
import { DEMASIADO_GRANDE, readJsonBody } from "@/lib/request";
import { withApi } from "@/lib/http";

const schema = z.object({
  tipo: z.enum(["PRESUPUESTO", "CONTRATO"]),
  destinatario: z.string().email("Email de destinatario inválido."),
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

  const estancia = await prisma.estancia.findUnique({
    where: { id: estanciaId },
    select: { centroId: true },
  });
  if (!estancia) {
    return NextResponse.json({ error: "No encontrada." }, { status: 404 });
  }
  if (!canDoOperational(user, estancia.centroId)) return forbidden();

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
