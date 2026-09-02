import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { centroVisibilityFilter } from "@/lib/permissions";
import {
  TIPO_CLIENTE_LABELS,
  TIPO_PROYECTO_LABELS,
  PARTICIPANTE_LABELS,
  ESTADO_LABELS,
} from "@/lib/labels";

function formatFecha(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// El último día del viaje no suma noche (solo cuenta como día): del 19/5 al
// 23/5 son 5 días y 4 noches.
function diasNoches(inicio: Date | null, fin: Date | null): { dias: number | ""; noches: number | "" } {
  if (!inicio || !fin) return { dias: "", noches: "" };
  const noches = Math.round((fin.getTime() - inicio.getTime()) / 86_400_000);
  if (noches < 0) return { dias: "", noches: "" };
  return { dias: noches + 1, noches };
}

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const visibilidad = centroVisibilityFilter(user);

  const [centros, estancias] = await Promise.all([
    prisma.centro.findMany({
      where: visibilidad,
      include: {
        contactos: { orderBy: { createdAt: "asc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.estancia.findMany({
      where: { centro: visibilidad },
      include: {
        centro: { select: { nombre: true, pais: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CRM Erasmus+ Novaschool";
  workbook.created = new Date();

  const clientesSheet = workbook.addWorksheet("Clientes");
  clientesSheet.columns = [
    { header: "Nombre", key: "nombre", width: 28 },
    { header: "Tipo", key: "tipo", width: 12 },
    { header: "País", key: "pais", width: 18 },
    { header: "Ciudad", key: "ciudad", width: 16 },
    { header: "Fecha alta", key: "fechaAlta", width: 12 },
    { header: "Persona de contacto", key: "contacto", width: 22 },
    { header: "Cargo", key: "cargo", width: 20 },
    { header: "Teléfono", key: "telefono", width: 16 },
    { header: "Email", key: "email", width: 26 },
    { header: "Canal de origen", key: "canal", width: 16 },
    { header: "Notas", key: "notas", width: 32 },
  ];
  clientesSheet.getRow(1).font = { bold: true };
  for (const centro of centros) {
    const contacto = centro.contactos[0];
    clientesSheet.addRow({
      nombre: centro.nombre,
      tipo: TIPO_CLIENTE_LABELS[centro.tipo] ?? centro.tipo,
      pais: centro.pais,
      ciudad: centro.ciudad ?? "",
      fechaAlta: formatFecha(centro.createdAt),
      contacto: contacto?.nombre ?? "",
      cargo: contacto?.cargo ?? "",
      telefono: contacto?.telefono ?? "",
      email: contacto?.email ?? "",
      canal: centro.canalOrigen,
      notas: centro.notas ?? "",
    });
  }

  const estanciasSheet = workbook.addWorksheet("Estancias");
  estanciasSheet.columns = [
    { header: "Cliente", key: "cliente", width: 28 },
    { header: "País", key: "pais", width: 18 },
    { header: "Tipo de programa", key: "tipoPrograma", width: 20 },
    { header: "Tipo de proyecto", key: "tipoProyecto", width: 16 },
    { header: "Tipo de participante", key: "tipoParticipante", width: 18 },
    { header: "Edad del grupo", key: "edadGrupo", width: 16 },
    { header: "Número de alumnos", key: "numeroAlumnos", width: 16 },
    { header: "Fecha inicio", key: "fechaInicio", width: 12 },
    { header: "Fecha fin", key: "fechaFin", width: 12 },
    { header: "Días", key: "dias", width: 8 },
    { header: "Noches", key: "noches", width: 8 },
    { header: "Centro receptor", key: "centroReceptor", width: 16 },
    { header: "Provincia", key: "provincia", width: 14 },
    { header: "Estado", key: "estado", width: 20 },
    { header: "Activa", key: "activa", width: 8 },
    { header: "Presupuesto (€)", key: "presupuesto", width: 14 },
    { header: "Notas", key: "notas", width: 32 },
    { header: "Fecha de alta", key: "fechaAlta", width: 12 },
  ];
  estanciasSheet.getRow(1).font = { bold: true };
  for (const e of estancias) {
    const { dias, noches } = diasNoches(e.fechaInicio, e.fechaFin);
    estanciasSheet.addRow({
      cliente: e.centro.nombre,
      pais: e.centro.pais,
      tipoPrograma: e.tipoPrograma,
      tipoProyecto: e.tipoProyecto ? TIPO_PROYECTO_LABELS[e.tipoProyecto] : "",
      tipoParticipante: PARTICIPANTE_LABELS[e.tipoParticipante] ?? e.tipoParticipante,
      edadGrupo: e.edadGrupo ?? "",
      numeroAlumnos: e.numeroAlumnos ?? "",
      fechaInicio: formatFecha(e.fechaInicio),
      fechaFin: formatFecha(e.fechaFin),
      dias,
      noches,
      centroReceptor: e.centroReceptor,
      provincia: e.provincia ?? "",
      estado: ESTADO_LABELS[e.estado] ?? e.estado,
      activa: e.activo ? "Sí" : "No",
      presupuesto: e.presupuestoImporte ? Number(e.presupuestoImporte) : "",
      notas: e.notas ?? "",
      fechaAlta: formatFecha(e.createdAt),
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fecha = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="crm-erasmus-${fecha}.xlsx"`,
    },
  });
}
