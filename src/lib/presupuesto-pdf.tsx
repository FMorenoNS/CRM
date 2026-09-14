import "server-only";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";

/**
 * Genera el PDF del presupuesto siguiendo el formato de la plantilla propia
 * de Novaschool ("INTERNATIONAL STUDENTS MOBILITY PACK"): datos del colegio
 * cliente, fechas de la estancia, conceptos incluidos, total y condiciones
 * de aceptación. Selector de idioma porque la plantilla original está en
 * inglés (va a colegios internacionales) pero también se pide en español.
 */

export type DatosEmisor = {
  razonSocial: string | null;
  cif: string | null;
  oid: string | null;
  direccion: string | null;
};

export type DatosCliente = {
  nombre: string;
  direccion: string | null;
  vat: string | null;
  contactoNombre: string | null;
  contactoEmail: string | null;
  contactoTelefono: string | null;
};

export type LineaPdf = { nombre: string; cantidad: number; dias: number };

// El nombre de cada línea se guarda en español al calcular el presupuesto
// (así es como está el catálogo en src/lib/precios.ts), así que para el PDF
// en inglés hace falta esta traducción aparte, por código de concepto. Si
// aparece un código que no está aquí (no debería pasar, todas las líneas
// salen del catálogo fijo), se deja el nombre en español antes que dejarlo
// en blanco.
const NOMBRE_CONCEPTO_EN: Record<string, string> = {
  MONITORES: "Monitors",
  ALOJAMIENTO_PC: "Full board accommodation",
  ALOJAMIENTO_MP: "Half board accommodation",
  ALHAMBRA: "Alhambra",
  PAQ_CIENCIAS: "Science Park package",
  MUSEO_LORCA: "Lorca Museum",
  CATEDRAL_CAPILLA: "Cathedral and Royal Chapel",
  GINCANA: "Treasure hunt",
  GRANADA_SHOPPING: "Granada shopping",
  CUEVA_VENTANAS: "Caves Windows",
  CLASES: "Classes",
  MATERIALES: "Materials",
  JOB_SHADOWING: "Job shadowing",
  MYAGORA: "MyAgora",
  INSTALACIONES: "Facilities",
  FLAMENCO: "Flamenco show",
  RC: "Public liability insurance",
  SEGURO_ACCIDENTES: "Accident insurance",
  AEROP_MALAGA: "Málaga Airport transfer",
  BUS_CUEVA_VENTANAS: "Caves Windows",
  BUS_COSTA_TROPICAL: "Costa Tropical",
  BUS_GRANADA: "Granada",
  BUS_GIBRALTAR: "Gibraltar",
  BUS_SEVILLA: "Seville",
  TAXIS: "Taxis",
  TAXI_TRANSFER_BUS: "Taxi transfer bus",
};

export type DatosPresupuestoPdf = {
  idioma: "es" | "en";
  numero: number;
  fecha: Date;
  emisor: DatosEmisor | null;
  cliente: DatosCliente;
  numAlumnos: number;
  numProfesores: number;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  lineas: LineaPdf[];
  total: number;
};

const TEXTOS = {
  es: {
    titulo: "PRESUPUESTO",
    mobility: "MOVILIDAD INTERNACIONAL DE ESTUDIANTES",
    subtitulo: "Inmersión educativa y lingüística",
    numPresupuesto: "Nº PRESUPUESTO",
    fecha: "Fecha",
    ivaIncluido: "IVA incluido",
    datosEmisor: "DATOS DE NOVASCHOOL",
    datosCliente: "DATOS DEL CLIENTE",
    centroEscolar: "Centro escolar",
    direccion: "Dirección",
    nifVat: "NIF/VAT",
    contacto: "Contacto",
    email: "Email",
    telefono: "Teléfono",
    totalAlumnos: "Nº total de alumnos",
    totalProfesores: "Nº total de profesores/adultos",
    fechasEstancia: "FECHAS DE LA ESTANCIA",
    entrada: "Fecha de entrada",
    salida: "Fecha de salida",
    incluye: "EL PACK INCLUYE",
    concepto: "Concepto",
    cantidad: "Cantidad",
    dias: "Días",
    total: "TOTAL",
    condicionesTitulo: "Condiciones de aceptación",
    condiciones: [
      "Tarifa válida durante los 30 días siguientes al envío del presupuesto y sujeta a disponibilidad de plazas.",
      "Las reservas de actividades deben hacerse con un mínimo de 30 días de antelación y están sujetas a disponibilidad.",
      "Transferencia del 100% del importe y del servicio contratado en el momento de la firma del presupuesto.",
      "Las actividades propuestas pueden adaptarse en los horarios según las necesidades del grupo.",
      "El centro escolar o empresa que contrata el servicio debe disponer de seguro de accidentes para todo el alumnado.",
      "La aceptación de este presupuesto implica la aceptación de las condiciones generales del contrato.",
    ],
    aceptacion: "He leído y acepto lo anterior y las condiciones del presupuesto.",
  },
  en: {
    titulo: "BUDGET",
    mobility: "INTERNATIONAL STUDENTS MOBILITY",
    subtitulo: "Educational and linguistic immersion",
    numPresupuesto: "BUDGET NO.",
    fecha: "Date",
    ivaIncluido: "VAT included",
    datosEmisor: "NOVASCHOOL DATA",
    datosCliente: "CLIENT DATA",
    centroEscolar: "School center",
    direccion: "Address",
    nifVat: "VAT",
    contacto: "Contact",
    email: "Email",
    telefono: "Phone",
    totalAlumnos: "Total number of students",
    totalProfesores: "Total number of adults",
    fechasEstancia: "DATES OF STAY",
    entrada: "Entry date",
    salida: "Departure date",
    incluye: "THE PACK INCLUDES",
    concepto: "Concept",
    cantidad: "Quantity",
    dias: "Days",
    total: "TOTAL",
    condicionesTitulo: "Acceptance conditions",
    condiciones: [
      "Rate valid for the next 30 days from the sending of the quote and subject to availability of occupancy.",
      "Activity reservations must be made a minimum of 30 days in advance and are subject to availability.",
      "Transfer of 100% of the amount and the contracted service upon signing the quote.",
      "The proposed activities can be adapted in schedules according to the needs of the group of students.",
      "The School Center or company that contracts the service must have accident insurance for all students.",
      "Acceptance of this quote entails acceptance of the general conditions of the contract.",
    ],
    aceptacion: "I have read everything above and accept the conditions of this quote.",
  },
} as const;

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#1f2937" },
  encabezado: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  tituloBloque: { flexDirection: "column" },
  titulo: { fontSize: 18, fontWeight: 700, color: "#0b1f3a" },
  mobility: { fontSize: 8, color: "#0b1f3a", textAlign: "right" },
  subtitulo: { fontSize: 8, color: "#6b7280", textAlign: "right" },
  filaMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  seccion: { marginTop: 14, borderTop: "1 solid #e5e7eb", paddingTop: 8 },
  seccionTitulo: { fontSize: 9, fontWeight: 700, color: "#0b1f3a", marginBottom: 4, textTransform: "uppercase" },
  filaDosColumnas: { flexDirection: "row", gap: 24 },
  columna: { flex: 1 },
  etiqueta: { color: "#6b7280" },
  valor: { fontWeight: 700, marginBottom: 3 },
  tabla: { marginTop: 6, borderTop: "1 solid #e5e7eb" },
  filaTabla: { flexDirection: "row", borderBottom: "1 solid #f3f4f6", paddingVertical: 3 },
  celdaConcepto: { flex: 3 },
  celdaNum: { flex: 1, textAlign: "right" },
  cabeceraTabla: { flexDirection: "row", borderBottom: "1 solid #0b1f3a", paddingBottom: 3, fontWeight: 700 },
  totalBox: { marginTop: 10, alignItems: "flex-end" },
  totalEtiqueta: { fontSize: 8, color: "#6b7280" },
  totalValor: { fontSize: 16, fontWeight: 700, color: "#0b1f3a" },
  condiciones: { marginTop: 14 },
  condicionLinea: { marginTop: 2, color: "#374151" },
  firma: { marginTop: 24, flexDirection: "row", justifyContent: "space-between" },
  firmaBox: { width: 180, borderTop: "1 solid #9ca3af", paddingTop: 4, textAlign: "center", color: "#6b7280" },
  pie: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 7, color: "#9ca3af", textAlign: "center" },
});

function formatearFecha(fecha: Date | null, idioma: "es" | "en"): string {
  if (!fecha) return "—";
  return fecha.toLocaleDateString(idioma === "es" ? "es-ES" : "en-GB");
}

function formatearEuros(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
}

export async function generarPresupuestoPdf(datos: DatosPresupuestoPdf): Promise<Buffer> {
  const t = TEXTOS[datos.idioma];
  const numeroFormateado = `P-${String(datos.numero).padStart(6, "0")}`;

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.encabezado}>
          <View style={styles.tituloBloque}>
            <Text style={styles.titulo}>{t.titulo}</Text>
            <Text style={{ fontSize: 8, color: "#6b7280", marginTop: 2 }}>
              {t.numPresupuesto}: {numeroFormateado}
            </Text>
            <Text style={{ fontSize: 8, color: "#6b7280" }}>
              {t.fecha}: {formatearFecha(datos.fecha, datos.idioma)}
            </Text>
          </View>
          <View>
            <Text style={styles.mobility}>{t.mobility}</Text>
            <Text style={styles.subtitulo}>{t.subtitulo}</Text>
            <Text style={{ fontSize: 8, color: "#6b7280", textAlign: "right", marginTop: 4 }}>
              {t.ivaIncluido}
            </Text>
          </View>
        </View>

        <View style={styles.filaMeta}>
          <View style={[styles.columna, styles.seccion]}>
            <Text style={styles.seccionTitulo}>{t.datosEmisor}</Text>
            <Text style={styles.valor}>{datos.emisor?.razonSocial ?? "—"}</Text>
            {datos.emisor?.cif && <Text>CIF: {datos.emisor.cif}</Text>}
            {datos.emisor?.oid && <Text>OID: {datos.emisor.oid}</Text>}
            {datos.emisor?.direccion && <Text>{datos.emisor.direccion}</Text>}
          </View>
          <View style={[styles.columna, styles.seccion]}>
            <Text style={styles.seccionTitulo}>{t.datosCliente}</Text>
            <Text style={styles.etiqueta}>{t.centroEscolar}</Text>
            <Text style={styles.valor}>{datos.cliente.nombre}</Text>
            {datos.cliente.direccion && (
              <>
                <Text style={styles.etiqueta}>{t.direccion}</Text>
                <Text style={styles.valor}>{datos.cliente.direccion}</Text>
              </>
            )}
            {datos.cliente.vat && (
              <>
                <Text style={styles.etiqueta}>{t.nifVat}</Text>
                <Text style={styles.valor}>{datos.cliente.vat}</Text>
              </>
            )}
            {datos.cliente.contactoNombre && (
              <Text>
                {t.contacto}: {datos.cliente.contactoNombre}
                {datos.cliente.contactoEmail ? ` · ${datos.cliente.contactoEmail}` : ""}
                {datos.cliente.contactoTelefono ? ` · ${datos.cliente.contactoTelefono}` : ""}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.filaMeta}>
          <View style={[styles.columna, styles.seccion]}>
            <Text style={styles.seccionTitulo}>{t.fechasEstancia}</Text>
            <Text>
              {t.entrada}: {formatearFecha(datos.fechaInicio, datos.idioma)}
            </Text>
            <Text>
              {t.salida}: {formatearFecha(datos.fechaFin, datos.idioma)}
            </Text>
          </View>
          <View style={[styles.columna, styles.seccion]}>
            <Text style={styles.seccionTitulo}>&nbsp;</Text>
            <Text>
              {t.totalAlumnos}: {datos.numAlumnos}
            </Text>
            <Text>
              {t.totalProfesores}: {datos.numProfesores}
            </Text>
          </View>
        </View>

        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>{t.incluye}</Text>
          <View style={styles.tabla}>
            <View style={styles.cabeceraTabla}>
              <Text style={styles.celdaConcepto}>{t.concepto}</Text>
              <Text style={styles.celdaNum}>{t.dias}</Text>
              <Text style={styles.celdaNum}>{t.cantidad}</Text>
            </View>
            {datos.lineas.map((l, i) => (
              <View key={i} style={styles.filaTabla}>
                <Text style={styles.celdaConcepto}>{l.nombre}</Text>
                <Text style={styles.celdaNum}>{l.dias}</Text>
                <Text style={styles.celdaNum}>{l.cantidad}</Text>
              </View>
            ))}
          </View>
          <View style={styles.totalBox}>
            <Text style={styles.totalEtiqueta}>
              {t.total} ({t.ivaIncluido})
            </Text>
            <Text style={styles.totalValor}>{formatearEuros(datos.total)}</Text>
          </View>
        </View>

        <View style={styles.condiciones}>
          <Text style={styles.seccionTitulo}>{t.condicionesTitulo}</Text>
          {t.condiciones.map((c, i) => (
            <Text key={i} style={styles.condicionLinea}>
              • {c}
            </Text>
          ))}
        </View>

        <View style={styles.firma}>
          <View style={styles.firmaBox}>
            <Text>{t.aceptacion}</Text>
          </View>
          <View style={styles.firmaBox}>
            <Text>{datos.idioma === "es" ? "Firma y sello" : "Signature and stamp"}</Text>
          </View>
        </View>

        <Text style={styles.pie}>
          {datos.emisor?.razonSocial ?? "Novaschool"}
          {datos.emisor?.cif ? ` · CIF ${datos.emisor.cif}` : ""}
          {datos.emisor?.direccion ? ` · ${datos.emisor.direccion}` : ""}
        </Text>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}

/**
 * Reúne los datos de una estancia/presupuesto ya guardados en la base de
 * datos en la forma que necesita `generarPresupuestoPdf`. Devuelve `null`
 * si la estancia no existe o todavía no tiene presupuesto calculado.
 */
export async function construirDatosPresupuestoPdf(
  estanciaId: string,
  idioma: "es" | "en"
): Promise<DatosPresupuestoPdf | null> {
  const estancia = await prisma.estancia.findUnique({
    where: { id: estanciaId },
    include: {
      centro: {
        include: { contactos: { orderBy: { createdAt: "asc" }, take: 1 } },
      },
      presupuesto: { include: { lineas: { orderBy: { orden: "asc" } } } },
    },
  });
  if (!estancia || !estancia.presupuesto) return null;

  const primerCentroNovaschool = estancia.presupuesto.centrosNovaschool[0];
  const emisorRow = primerCentroNovaschool
    ? await prisma.centroNovaschoolInfo.findUnique({
        where: { centro: primerCentroNovaschool },
      })
    : null;

  const contacto = estancia.centro.contactos[0];

  return {
    idioma,
    numero: estancia.presupuesto.numero,
    fecha: estancia.presupuesto.updatedAt,
    emisor: emisorRow
      ? {
          razonSocial: emisorRow.razonSocial,
          cif: emisorRow.cif,
          oid: emisorRow.oid,
          direccion: emisorRow.direccion,
        }
      : null,
    cliente: {
      nombre: estancia.centro.nombre,
      direccion: estancia.centro.direccion,
      vat: estancia.centro.vat,
      contactoNombre: contacto?.nombre ?? null,
      contactoEmail: contacto?.email ?? null,
      contactoTelefono: contacto?.telefono ?? null,
    },
    numAlumnos: estancia.presupuesto.numAlumnos,
    numProfesores: estancia.presupuesto.numProfesores,
    fechaInicio: estancia.fechaInicio,
    fechaFin: estancia.fechaFin,
    lineas: estancia.presupuesto.lineas.map((l) => ({
      nombre: idioma === "en" ? (NOMBRE_CONCEPTO_EN[l.codigo] ?? l.nombre) : l.nombre,
      cantidad: l.cantidad,
      dias: l.dias,
    })),
    total: Number(estancia.presupuesto.total),
  };
}
