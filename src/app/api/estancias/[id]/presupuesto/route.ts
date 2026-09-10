import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { presupuestoSchema } from "@/lib/validation";
import { registrarHistorial } from "@/lib/audit";
import { canDoOperational } from "@/lib/permissions";
import { calcularPresupuesto, formatearEuros } from "@/lib/precios";

/**
 * Cuando el rechazo es por visibilidad (una estancia que no es de este
 * usuario) se responde igual que si no existiera, para no confirmar por el
 * código de respuesta qué estancias hay. Presupuestar es una acción
 * operativa: la puede hacer quien puede mover la estancia.
 */
function noEncontrada() {
  return NextResponse.json({ error: "No encontrada." }, { status: 404 });
}

/** Crea o actualiza el presupuesto de una estancia (uno por estancia). */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id: estanciaId } = await params;

  const estancia = await prisma.estancia.findUnique({
    where: { id: estanciaId },
    select: { centroId: true },
  });
  if (!estancia) return noEncontrada();
  if (!canDoOperational(user, estancia.centroId)) return noEncontrada();

  const body = await request.json().catch(() => null);
  const parsed = presupuestoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }
  const d = parsed.data;

  // El cálculo se hace aquí, no se acepta el del navegador: es el importe
  // que se le va a ofrecer a un cliente.
  const { lineas, totales } = calcularPresupuesto({
    numAlumnos: d.numAlumnos,
    numProfesores: d.numProfesores,
    lineas: d.lineas,
    margenPct: d.margenPct,
    ivaPct: d.ivaPct,
  });

  // Llegan ya solo las líneas marcadas en la ventana, así que se guardan
  // todas. No se filtra por importe a propósito: hay conceptos que van a
  // cero (Granada shopping) y siguen formando parte de lo ofrecido.
  const lineasAGuardar = lineas.map((l, i) => ({
    tipo: l.tipo,
    codigo: l.codigo,
    nombre: l.nombre,
    precioUnitario: l.precioUnitario,
    dias: l.dias,
    cantidad: l.cantidad,
    total: l.total,
    orden: i,
  }));

  const datosPresupuesto = {
    numAlumnos: d.numAlumnos,
    numProfesores: d.numProfesores,
    numMonitores: d.numMonitores,
    margenPct: d.margenPct,
    ivaPct: d.ivaPct,
    totalNeto: totales.totalNeto,
    margenImporte: totales.margenImporte,
    ivaImporte: totales.ivaImporte,
    total: totales.total,
    pvpPorPersona: totales.pvpPorPersona,
    notas: d.notas || null,
    actualizadoPorId: user.id,
  };

  // Todo junto o nada: sería peor quedarse con las líneas nuevas y el total
  // viejo (o al revés) que fallar y que se vuelva a intentar.
  await prisma.$transaction([
    prisma.presupuesto.upsert({
      where: { estanciaId },
      create: { estanciaId, ...datosPresupuesto },
      update: datosPresupuesto,
    }),
    prisma.presupuestoLinea.deleteMany({
      where: { presupuesto: { estanciaId } },
    }),
    prisma.presupuesto.update({
      where: { estanciaId },
      data: { lineas: { create: lineasAGuardar } },
    }),
    // El total se copia al campo de la estancia, que es de donde leen el
    // kanban, los informes y la exportación a Excel.
    prisma.estancia.update({
      where: { id: estanciaId },
      data: { presupuestoImporte: totales.total },
    }),
  ]);

  await registrarHistorial({
    centroId: estancia.centroId,
    actorId: user.id,
    accion: "Presupuesto calculado",
    detalle: `${formatearEuros(totales.total)} · ${lineasAGuardar.length} concepto(s) · ${totales.pax} persona(s)`,
  });

  return NextResponse.json({ ok: true, totales });
}

/** Borra el presupuesto y deja la estancia sin importe. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const user = auth;
  const { id: estanciaId } = await params;

  const estancia = await prisma.estancia.findUnique({
    where: { id: estanciaId },
    select: { centroId: true, presupuesto: { select: { id: true } } },
  });
  if (!estancia) return noEncontrada();
  if (!canDoOperational(user, estancia.centroId)) return noEncontrada();
  if (!estancia.presupuesto) {
    return NextResponse.json(
      { error: "Esta estancia no tiene presupuesto." },
      { status: 404 }
    );
  }

  await prisma.$transaction([
    prisma.presupuesto.delete({ where: { estanciaId } }),
    prisma.estancia.update({
      where: { id: estanciaId },
      data: { presupuestoImporte: null },
    }),
  ]);

  await registrarHistorial({
    centroId: estancia.centroId,
    actorId: user.id,
    accion: "Presupuesto eliminado",
  });

  return NextResponse.json({ ok: true });
}
