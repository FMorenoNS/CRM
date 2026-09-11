import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ESTADO_LABELS } from "@/lib/labels";
import { TaskCard, StaticTaskCard, AbandonoTaskCard, TaskGroup } from "./task-card";
import { getSession } from "@/lib/session";
import { centroVisibilityFilter } from "@/lib/permissions";
import { getTareas, DIAS_ABANDONO } from "@/lib/tareas";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const visibilidad = centroVisibilityFilter(session);

  const [centrosCount, estancias, tareas] = await Promise.all([
    prisma.centro.count({ where: visibilidad }),
    prisma.estancia.findMany({
      where: { centro: visibilidad },
      include: { centro: { select: { nombre: true, pais: true } } },
    }),
    getTareas(session),
  ]);

  const total = estancias.length;
  const ganadas = estancias.filter((e) =>
    ["CONTRATO_FIRMADO", "ALOJADO", "FINALIZADO"].includes(e.estado)
  ).length;
  const perdidas = estancias.filter((e) => e.estado === "PERDIDO").length;
  const cerradas = ganadas + perdidas;
  const conversion = cerradas > 0 ? Math.round((ganadas / cerradas) * 100) : 0;

  const porPais = new Map<string, number>();
  for (const e of estancias) {
    porPais.set(e.centro.pais, (porPais.get(e.centro.pais) ?? 0) + 1);
  }
  const paisesOrdenados = [...porPais.entries()].sort((a, b) => b[1] - a[1]);

  const toTaskCards = (items: typeof tareas.porContactar) =>
    items.map((i) => ({
      key: i.key,
      node: (
        <TaskCard
          href={i.href}
          centroNombre={i.centroNombre}
          contacto={i.contacto}
          tone="amber"
          estanciaId={i.key}
          estado={i.estado}
          detalle={i.detalle}
        />
      ),
    }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Panel</h1>
        <div className="flex gap-2">
          <Link
            href="/centros/nuevo"
            className="flex-1 rounded bg-brand-navy px-4 py-2 text-center text-sm font-medium text-white hover:bg-brand-navy-dark sm:flex-none"
          >
            Nuevo cliente
          </Link>
          <Link
            href="/estancias/nueva"
            className="flex-1 rounded border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-100 sm:flex-none"
          >
            Nueva estancia
          </Link>
        </div>
      </div>

      {tareas.totalTareas > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-amber-900">
              🔔 Tareas de hoy
              <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                {tareas.totalTareas}
              </span>
            </h2>
            <Link
              href="/tareas"
              className="text-sm font-medium text-amber-900 hover:underline"
            >
              Ver todas →
            </Link>
          </div>
          <div className="mt-4 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <TaskGroup title="🆕 Por contactar" items={toTaskCards(tareas.porContactar)} />
            <TaskGroup title="🔁 Sin respuesta" items={toTaskCards(tareas.sinRespuesta)} />
            <TaskGroup
              title="⏳ Presupuesto enviado sin confirmar"
              items={toTaskCards(tareas.presupuestoSinConfirmar)}
            />
            <TaskGroup
              title="📄 Contrato pendiente de firma"
              items={toTaskCards(tareas.contratoPendienteFirma)}
            />
            <TaskGroup title="📅 Fecha próxima sin cerrar" items={toTaskCards(tareas.proximas)} />
          </div>
        </section>
      )}

      {tareas.abandonadas.length > 0 && (
        <section className="rounded-lg border border-rose-200 bg-rose-50 p-5">
          <h2 className="text-base font-semibold text-rose-900">
            🧟 Posibles abandonos
            <span className="ml-2 rounded-full bg-rose-200 px-2 py-0.5 text-xs font-medium text-rose-800">
              {tareas.abandonadas.length}
            </span>
          </h2>
          <p className="mt-1 text-sm text-rose-800">
            Llevan {DIAS_ABANDONO}+ días sin ningún movimiento. Puede que ya
            no siga adelante. Valora marcarlas como &ldquo;Perdido&rdquo;.
          </p>
          <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {tareas.abandonadas.map((i) => (
              <li key={i.key}>
                <AbandonoTaskCard
                  href={i.href}
                  centroNombre={i.centroNombre}
                  contacto={i.contacto}
                  detalle={i.detalle}
                  estanciaId={i.key}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {tareas.documentosFallidos.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-base font-semibold text-slate-900">
            ⚠️ Envíos fallidos
            <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
              {tareas.documentosFallidos.length}
            </span>
          </h2>
          <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {tareas.documentosFallidos.map((i) => (
              <li key={i.key}>
                <StaticTaskCard
                  href={i.href}
                  centroNombre={i.centroNombre}
                  contacto={undefined}
                  detalle={i.detalle}
                  tone="slate"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Clientes captados" value={centrosCount} />
        <StatCard label="Estancias totales" value={total} />
        <StatCard label="Tasa de conversión" value={`${conversion}%`} />
        <StatCard label="Tareas pendientes" value={tareas.totalAlertas} />
      </div>

      <section className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-medium text-gray-900">
            Procedencia por país
          </h2>
          <div className="mt-3 overflow-hidden rounded border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-2">País</th>
                  <th className="px-4 py-2">Estancias</th>
                </tr>
              </thead>
              <tbody>
                {paisesOrdenados.map(([pais, n]) => (
                  <tr key={pais} className="border-t border-gray-100">
                    <td className="px-4 py-2">{pais}</td>
                    <td className="px-4 py-2">{n}</td>
                  </tr>
                ))}
                {paisesOrdenados.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-gray-500">
                      Sin datos todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-medium text-gray-900">
            Embudo por estado
          </h2>
          <div className="mt-3 overflow-hidden rounded border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(ESTADO_LABELS).map(([estado, label]) => {
                  const n = estancias.filter((e) => e.estado === estado).length;
                  return (
                    <tr key={estado} className="border-t border-gray-100">
                      <td className="px-4 py-2">{label}</td>
                      <td className="px-4 py-2 text-right">{n}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <p className="text-sm text-gray-500">
        Este es el resumen del día a día.{" "}
        <Link href="/informes" className="text-brand-navy hover:underline">
          Ver el desglose completo de ingresos y conversión en Informes →
        </Link>
      </p>
    </div>
  );
}
