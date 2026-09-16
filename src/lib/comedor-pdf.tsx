import "server-only";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

/**
 * Informe de comedor de un día concreto: quién come, qué necesidades tiene
 * cada uno (para monitores en excursiones y para cocina al preparar la
 * comida) y un resumen final por categoría para agilizar la tarea de
 * cocina.
 */

export type ParticipanteComedor = {
  nombre: string;
  rolLabel: string;
  centroNombre: string;
  habitacionNombre: string | null;
  alergias: string | null;
  celiaco: boolean;
  intoleranteLactosa: boolean;
  vegetariano: boolean;
  desayuno: boolean;
  almuerzo: boolean;
  cena: boolean;
};

export type DatosComedorPdf = {
  fechaLabel: string;
  participantes: ParticipanteComedor[];
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica" },
  titulo: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitulo: { fontSize: 10, color: "#555", marginBottom: 14 },
  tabla: { display: "flex", flexDirection: "column", borderTop: "1 solid #ccc" },
  fila: {
    display: "flex",
    flexDirection: "row",
    borderBottom: "1 solid #eee",
    paddingVertical: 4,
    alignItems: "flex-start",
  },
  filaCabecera: { fontFamily: "Helvetica-Bold", backgroundColor: "#f3f4f6" },
  colNombre: { width: "20%", paddingRight: 4 },
  col: { width: "9%", paddingRight: 4 },
  colNecesidades: { width: "35%" },
  resumen: {
    marginTop: 20,
    padding: 10,
    border: "1 solid #ccc",
    borderRadius: 4,
  },
  resumenTitulo: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 6 },
  resumenLinea: { marginBottom: 2 },
});

function contar(participantes: ParticipanteComedor[], filtro: (p: ParticipanteComedor) => boolean) {
  return participantes.filter(filtro).length;
}

export async function generarComedorPdf(datos: DatosComedorPdf): Promise<Buffer> {
  const { participantes } = datos;
  const total = participantes.length;

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.titulo}>Informe de comedor</Text>
        <Text style={styles.subtitulo}>
          {datos.fechaLabel} · {total} comensal{total === 1 ? "" : "es"}
        </Text>

        <View style={styles.tabla}>
          <View style={[styles.fila, styles.filaCabecera]}>
            <Text style={styles.colNombre}>Nombre</Text>
            <Text style={styles.col}>Rol</Text>
            <Text style={styles.col}>Habitación</Text>
            <Text style={styles.col}>Desay.</Text>
            <Text style={styles.col}>Almue.</Text>
            <Text style={styles.col}>Cena</Text>
            <Text style={styles.colNecesidades}>Necesidades</Text>
          </View>
          {participantes.map((p, i) => {
            const necesidades = [
              p.celiaco && "Celiaco",
              p.intoleranteLactosa && "Intolerante a la lactosa",
              p.vegetariano && "Vegetariano",
              p.alergias,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <View key={i} style={styles.fila}>
                <Text style={styles.colNombre}>{p.nombre}</Text>
                <Text style={styles.col}>{p.rolLabel}</Text>
                <Text style={styles.col}>{p.habitacionNombre ?? "—"}</Text>
                <Text style={styles.col}>{p.desayuno ? "Sí" : "No"}</Text>
                <Text style={styles.col}>{p.almuerzo ? "Sí" : "No"}</Text>
                <Text style={styles.col}>{p.cena ? "Sí" : "No"}</Text>
                <Text style={styles.colNecesidades}>{necesidades || "—"}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.resumen}>
          <Text style={styles.resumenTitulo}>Resumen para cocina</Text>
          <Text style={styles.resumenLinea}>Total comensales: {total}</Text>
          <Text style={styles.resumenLinea}>
            Celiaco: {contar(participantes, (p) => p.celiaco)}
          </Text>
          <Text style={styles.resumenLinea}>
            Intolerante a la lactosa: {contar(participantes, (p) => p.intoleranteLactosa)}
          </Text>
          <Text style={styles.resumenLinea}>
            Vegetariano: {contar(participantes, (p) => p.vegetariano)}
          </Text>
          <Text style={styles.resumenLinea}>
            Con otras necesidades registradas (ver detalle arriba):{" "}
            {contar(participantes, (p) => Boolean(p.alergias))}
          </Text>
          <Text style={styles.resumenLinea}>
            Desayunan: {contar(participantes, (p) => p.desayuno)} · Almuerzan:{" "}
            {contar(participantes, (p) => p.almuerzo)} · Cenan:{" "}
            {contar(participantes, (p) => p.cena)}
          </Text>
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
