import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { estanciaSchema } from "@/lib/validation";
import { registrarHistorial } from "@/lib/audit";
import { canAccessCentro, canDoOperational, forbidden, noEncontrado } from "@/lib/permissions";
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
  const parsed = estanciaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  const d = parsed.data;
  // Si no puede ver ese cliente, se responde igual que si no existiera:
  // un 403 aquí confirmaría que el registro existe (ver noEncontrado).
  if (!canAccessCentro(user, d.centroId)) return noEncontrado();
  if (!canDoOperational(user, d.centroId)) return forbidden();
  const estancia = await prisma.estancia.create({
    data: {
      centroId: d.centroId,
      tipoPrograma: d.tipoPrograma,
      tipoProyecto: d.tipoProyecto || null,
      tipoParticipante: d.tipoParticipante,
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
      estado: d.estado ?? "INTERESADO",
      presupuestoImporte:
        d.presupuestoImporte !== undefined &&
        d.presupuestoImporte !== null &&
        d.presupuestoImporte !== ""
          ? d.presupuestoImporte
          : null,
      notas: d.notas || null,
    },
  });

  await registrarHistorial({
    centroId: d.centroId,
    actorId: user.id,
    accion: "Estancia creada",
    detalle: estancia.tipoPrograma,
  });

  return NextResponse.json({ id: estancia.id });
}

// Cada método se publica envuelto en withApi: si algo falla por dentro, el
// usuario recibe un mensaje genérico con un código de referencia y el
// detalle completo queda solo en el registro del servidor.
export const POST = withApi("POST /api/estancias", handlerPOST as never);
