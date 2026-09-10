import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { canAccessCentro, forbidden } from "@/lib/permissions";
import { registrarEventoSistema } from "@/lib/audit";
import { getClientIp } from "@/lib/request";
import { withApi } from "@/lib/http";

/**
 * Derecho de acceso (RGPD, artículo 15).
 *
 * Devuelve TODO lo que el CRM guarda sobre un cliente y sus personas de
 * contacto, en un fichero legible. Si un contacto pide "dime qué datos
 * tenéis míos", esto es lo que se le entrega.
 *
 * El derecho de supresión (artículo 17) ya está cubierto: al borrar el
 * cliente desde su ficha se borran en cascada sus contactos, estancias,
 * interacciones y documentos, y queda anotado quién lo borró y cuándo.
 */
async function handlerGET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id } = await params;

  if (!canAccessCentro(user, id)) return forbidden();

  const centro = await prisma.centro.findUnique({
    where: { id },
    include: {
      contactos: true,
      estancias: {
        include: {
          interacciones: {
            // La captura de pantalla se omite: abultaría el fichero y no
            // aporta nada al derecho de acceso (es una imagen del mensaje
            // público que originó el contacto).
            select: {
              id: true,
              tipo: true,
              fecha: true,
              resumen: true,
              grupoUrl: true,
              perfilUrl: true,
              mensajeContacto: true,
              autor: { select: { nombre: true, email: true } },
            },
            orderBy: { fecha: "asc" },
          },
          documentosEnviados: {
            select: {
              tipo: true,
              destinatario: true,
              enviadoEn: true,
              exito: true,
              enviadoPor: { select: { nombre: true, email: true } },
            },
            orderBy: { enviadoEn: "asc" },
          },
        },
      },
      historial: {
        select: {
          accion: true,
          detalle: true,
          createdAt: true,
          actorEmail: true,
          actor: { select: { nombre: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!centro) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  await registrarEventoSistema({
    actorId: user.id,
    actorEmail: user.email,
    accion: "Datos de un cliente exportados (derecho de acceso RGPD)",
    detalle: centro.nombre || centro.id,
    ip: getClientIp(request),
  });

  const salida = {
    generadoEl: new Date().toISOString(),
    generadoPor: user.email,
    aviso:
      "Copia de todos los datos que el CRM guarda sobre este cliente y sus personas de contacto.",
    cliente: centro,
  };

  const nombreFichero = `datos-cliente-${centro.id}.json`;
  return new NextResponse(JSON.stringify(salida, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreFichero}"`,
      "Cache-Control": "no-store, private",
    },
  });
}

export const GET = withApi("GET /api/centros/[id]/datos", handlerGET as never);
