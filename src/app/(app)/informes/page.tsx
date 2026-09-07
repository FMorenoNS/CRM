import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ESTADO_LABELS, TODOS_ESTADOS } from "@/lib/labels";
import { getSession } from "@/lib/session";
import { centroVisibilityFilter } from "@/lib/permissions";

// Una estancia cuenta como "contratada" (genera ingreso) a partir de que se
// firma el contrato, inclusive las fases posteriores del viaje. Decisión de
// producto: el disparador del ingreso es CONTRATO_FIRMADO, no el presupuesto
// confirmado ni la fecha del viaje.
const ESTADOS_CONTRATADOS = ["CONTRATO_FIRMADO", "ALOJADO", "FINALIZADO"] as const;

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

  const [centrosCount, estancias] = await Promise.all([
    prisma.centro.count({ where: visibilidad }),
    prisma.estancia.findMany({
      where: { centro: visibilidad },
      select: { estado: true, presupuestoImporte: true, centro: { select: { pais: true } } },
    }),
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

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Informes</h1>
        <p className="mt-1 text-sm text-gray-500">
          La vista de conjunto: ingresos, captación y conversión. Para el
          día a día (qué hacer hoy) mejor el Panel.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Ingresos generados"
          value={formatEuros(ingresosGenerados)}
          detalle="Estancias con contrato firmado"
        />
        <StatCard label="Clientes captados" value={String(centrosCount)} />
        <StatCard
          label="Contactados sin contratar"
          value={String(contactadosSinContratar)}
          detalle="En gestión o perdidos, sin llegar a contrato"
        />
        <StatCard label="Tasa de conversión" value={`${conversion}%`} />
      </div>

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
  );
}
