import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { estanciaSchema } from "@/lib/validation";
import { registrarHistorial } from "@/lib/audit";
import { canDoOperational, forbidden } from "@/lib/permissions";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const body = await request.json().catch(() => null);
  const parsed = estanciaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  const d = parsed.data;
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
