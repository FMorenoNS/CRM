import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ESTADO_LABELS, TODOS_ESTADOS, ESTADOS_CONTRATADOS } from "@/lib/labels";
import { getSession } from "@/lib/session";
import { centroVisibilityFilter } from "@/lib/permissions";
import { InformesTabs } from "./informes-tabs";
import { BarraHorizontal } from "./barra-horizontal";
import { ColumnasMensuales } from "./columnas-mensuales";
import { GraficoQuesitos } from "./grafico-quesitos";
import { CANAL_OPTIONS } from "@/lib/labels";

// Ganadas/perdidas es un resultado (bien/mal), no una categoría más: colores
// de estado, no de paleta categórica. Canal de origen sí es identidad pura
// (cuatro orígenes sin jerarquía entre ellos), así que usa los 4 primeros
// tonos de la paleta categórica validada (orden fijo, distinguible en daltonismo).
const COLOR_GANADAS = "#16a34a"; // verde (Tailwind green-600, mismo que el resto de la app)
const COLOR_PERDIDAS = "#e11d48"; // rojo (Tailwind rose-600, ídem)
const COLORES_CANAL: Record<string, string> = {
  Facebook: "#2a78d6",
  Email: "#eb6834",
  Teléfono: "#1baf7a",
  Otro: "#eda100",
};

// Ya se les ha contactado (no están en INTERESADO) pero todavía no han
// contratado: incluye PERDIDO, porque siguen siendo "contactados sin
// contratar" aunque ya no vaya a avanzar.
const ESTADOS_CONTACTADOS_SIN_CONTRATAR = [
  "CONTACTADO",
  "EN_CONVERSACION",
  "PRESUPUESTO_ENVIADO",
  "PRESUPUESTO_CONFIRMADO",
  "PERDIDO",
] as const;

function TituloSeccion({ titulo, aclaracion }: { titulo: string; aclaracion?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-medium text-gray-900">{titulo}</h2>
      {aclaracion && <span className="text-xs text-gray-500">{aclaracion}</span>}
    </div>
  );
}

function StatCard({
  label,
  value,
  detalle,
}: {
  label: string;
  value: string;
  detalle?: string;
}) {
  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {detalle && <p className="mt-1 text-xs text-gray-500">{detalle}</p>}
    </div>
  );
}

function formatEuros(valor: number) {
  return valor.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export default async function InformesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const visibilidad = centroVisibilityFilter(session);

  const [centrosCount, usuariosCount, estancias, centrosPorCanal] = await Promise.all([
    prisma.centro.count({ where: visibilidad }),
    prisma.user.count(),
    prisma.estancia.findMany({
      where: { centro: visibilidad },
      select: {
        estado: true,
        presupuestoImporte: true,
        fechaInicio: true,
        centro: { select: { pais: true } },
      },
    }),
    prisma.centro.findMany({ where: visibilidad, select: { canalOrigen: true } }),
  ]);

  const ingresosGenerados = estancias
    .filter((e) => (ESTADOS_CONTRATADOS as readonly string[]).includes(e.estado))
    .reduce((total, e) => total + (e.presupuestoImporte ? Number(e.presupuestoImporte) : 0), 0);

  const contactadosSinContratar = estancias.filter((e) =>
    (ESTADOS_CONTACTADOS_SIN_CONTRATAR as readonly string[]).includes(e.estado)
  ).length;

  const ganadas = estancias.filter((e) =>
    (ESTADOS_CONTRATADOS as readonly string[]).includes(e.estado)
  ).length;
  const perdidas = estancias.filter((e) => e.estado === "PERDIDO").length;
  const cerradas = ganadas + perdidas;
  const conversion = cerradas > 0 ? Math.round((ganadas / cerradas) * 100) : 0;

  const porEstado = TODOS_ESTADOS.map((estado) => {
    const enEsteEstado = estancias.filter((e) => e.estado === estado);
    const importe = enEsteEstado.reduce(
      (total, e) => total + (e.presupuestoImporte ? Number(e.presupuestoImporte) : 0),
      0
    );
    return { estado, cantidad: enEsteEstado.length, importe };
  });

  const porPais = new Map<string, number>();
  for (const e of estancias) {
    if (!(ESTADOS_CONTRATADOS as readonly string[]).includes(e.estado)) continue;
    const importe = e.presupuestoImporte ? Number(e.presupuestoImporte) : 0;
    porPais.set(e.centro.pais, (porPais.get(e.centro.pais) ?? 0) + importe);
  }
  const paisesOrdenados = [...porPais.entries()]
    .filter(([, importe]) => importe > 0)
    .sort((a, b) => b[1] - a[1]);

  // Estancias por país (todas, no solo las que ya han generado ingreso):
  // muestra de dónde viene el volumen, no solo el dinero.
  const estanciasPorPaisMap = new Map<string, number>();
  for (const e of estancias) {
    estanciasPorPaisMap.set(e.centro.pais, (estanciasPorPaisMap.get(e.centro.pais) ?? 0) + 1);
  }
  const estanciasPorPais = [...estanciasPorPaisMap.entries()].sort((a, b) => b[1] - a[1]);

  // Canal de origen de los clientes (de dónde llegan los leads).
  const porCanal = CANAL_OPTIONS.map((canal) => ({
    etiqueta: canal,
    valor: centrosPorCanal.filter((c) => c.canalOrigen === canal).length,
  }));

  // Tendencia de captación: estancias cuyo viaje cae en cada uno de los
  // últimos 12 meses (mes en curso incluido), por fecha de inicio de la
  // estancia (no por cuándo se dio de alta en el CRM). Ventana fija, no solo
  // los meses con datos: un mes sin nada también es información (una caída
  // se vería). Las estancias sin fecha de inicio todavía no cuentan en
  // ningún mes.
  const ahora = new Date();
  const meses = Array.from({ length: 12 }, (_, i) => {
    const offset = 11 - i;
    const inicio = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - offset, 1));
    const fin = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 0, 23, 59, 59));
    return { inicio, fin };
  });
  const porMes = meses.map(({ inicio, fin }) => ({
    etiqueta: inicio.toLocaleDateString("es-ES", { month: "short", year: "2-digit", timeZone: "UTC" }),
    valor: estancias.filter((e) => e.fechaInicio && e.fechaInicio >= inicio && e.fechaInicio <= fin)
      .length,
  }));
  // Mismo eje de tiempo (fecha de la estancia) que "Estancias captadas por
  // mes", pero solo de las que llegaron a contratarse, para poder comparar
  // volumen captado frente a ingreso captado mes a mes.
  const ingresosPorMes = meses.map(({ inicio, fin }) => ({
    etiqueta: inicio.toLocaleDateString("es-ES", { month: "short", year: "2-digit", timeZone: "UTC" }),
    valor: estancias
      .filter(
        (e) =>
          e.fechaInicio &&
          e.fechaInicio >= inicio &&
          e.fechaInicio <= fin &&
          (ESTADOS_CONTRATADOS as readonly string[]).includes(e.estado)
      )
      .reduce((total, e) => total + (e.presupuestoImporte ? Number(e.presupuestoImporte) : 0), 0),
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Informes</h1>
        <p className="mt-1 text-sm text-gray-500">
          La vista de conjunto: ingresos, captación y conversión. Para el
          día a día (qué hacer hoy) mejor el Panel.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Ingresos generados"
          value={formatEuros(ingresosGenerados)}
          detalle="Estancias con contrato firmado"
        />
        <StatCard label="Clientes captados" value={String(centrosCount)} />
        <StatCard label="Estancias totales" value={String(estancias.length)} />
        <StatCard
          label="Contactados sin contratar"
          value={String(contactadosSinContratar)}
          detalle="En gestión o perdidos, sin llegar a contrato"
        />
        <StatCard label="Tasa de conversión" value={`${conversion}%`} />
        <StatCard label="Usuarios totales" value={String(usuariosCount)} />
      </div>

      <InformesTabs
        numeros={
          <div className="flex flex-col gap-8">
            <section>
              <h2 className="text-lg font-medium text-gray-900">Embudo e ingresos por estado</h2>
              <div className="mt-3 overflow-hidden rounded border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-500">
                    <tr>
                      <th className="px-4 py-2">Estado</th>
                      <th className="px-4 py-2 text-right">Estancias</th>
                      <th className="px-4 py-2 text-right">Presupuesto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porEstado.map(({ estado, cantidad, importe }) => (
                      <tr key={estado} className="border-t border-gray-100">
                        <td className="px-4 py-2">{ESTADO_LABELS[estado]}</td>
                        <td className="px-4 py-2 text-right">{cantidad}</td>
                        <td className="px-4 py-2 text-right">
                          {importe > 0 ? formatEuros(importe) : "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-medium text-gray-900">Ingresos por país</h2>
              <div className="mt-3 overflow-hidden rounded border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-500">
                    <tr>
                      <th className="px-4 py-2">País</th>
                      <th className="px-4 py-2 text-right">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paisesOrdenados.map(([pais, importe]) => (
                      <tr key={pais} className="border-t border-gray-100">
                        <td className="px-4 py-2">{pais}</td>
                        <td className="px-4 py-2 text-right">{formatEuros(importe)}</td>
                      </tr>
                    ))}
                    {paisesOrdenados.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-4 py-6 text-center text-gray-500">
                          Todavía no hay ningún contrato firmado con presupuesto.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        }
        graficos={
          <div className="flex flex-col gap-8">
            <section>
              <TituloSeccion
                titulo="Estancias captadas por mes"
                aclaracion="Últimos 12 meses, por fecha de la estancia."
              />
              <div className="mt-3 rounded border border-gray-200 bg-white p-4">
                <ColumnasMensuales items={porMes} />
              </div>
            </section>

            <section>
              <TituloSeccion
                titulo="Ingresos por mes"
                aclaracion="Por fecha de la estancia, solo estancias contratadas."
              />
              <div className="mt-3 rounded border border-gray-200 bg-white p-4">
                <ColumnasMensuales items={ingresosPorMes} formatValor={formatEuros} />
              </div>
            </section>

            <div className="grid gap-8 md:grid-cols-2">
              <section>
                <TituloSeccion titulo="Ganadas vs. perdidas" />
                <div className="mt-3 rounded border border-gray-200 bg-white p-4">
                  <GraficoQuesitos
                    items={[
                      { etiqueta: "Ganadas", valor: ganadas, color: COLOR_GANADAS },
                      { etiqueta: "Perdidas", valor: perdidas, color: COLOR_PERDIDAS },
                    ]}
                  />
                </div>
              </section>

              <section>
                <TituloSeccion titulo="Canal de origen" />
                <div className="mt-3 rounded border border-gray-200 bg-white p-4">
                  <GraficoQuesitos
                    items={porCanal.map((c) => ({
                      etiqueta: c.etiqueta,
                      valor: c.valor,
                      color: COLORES_CANAL[c.etiqueta] ?? "#898781",
                    }))}
                  />
                </div>
              </section>
            </div>

            <section>
              <TituloSeccion titulo="Estancias por estado" />
              <div className="mt-3 rounded border border-gray-200 bg-white p-4">
                <BarraHorizontal
                  items={porEstado.map(({ estado, cantidad }) => ({
                    etiqueta: ESTADO_LABELS[estado],
                    valor: cantidad,
                  }))}
                  formatValor={(v) => String(v)}
                />
              </div>
            </section>

            <section>
              <TituloSeccion titulo="Estancias por país" aclaracion="Todas, no solo las contratadas." />
              <div className="mt-3 rounded border border-gray-200 bg-white p-4">
                <BarraHorizontal
                  items={estanciasPorPais.map(([pais, cantidad]) => ({
                    etiqueta: pais,
                    valor: cantidad,
                  }))}
                  formatValor={(v) => String(v)}
                />
              </div>
            </section>

            <section>
              <TituloSeccion titulo="Ingresos por país" />
              <div className="mt-3 rounded border border-gray-200 bg-white p-4">
                <BarraHorizontal
                  items={paisesOrdenados.map(([pais, importe]) => ({
                    etiqueta: pais,
                    valor: importe,
                  }))}
                  formatValor={formatEuros}
                />
              </div>
            </section>
          </div>
        }
      />
    </div>
  );
}
