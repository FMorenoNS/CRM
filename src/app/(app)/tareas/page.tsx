import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getTareas, DIAS_ABANDONO } from "@/lib/tareas";
import { TaskCard, StaticTaskCard, TaskGroup } from "../task-card";

export default async function TareasPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const tareas = await getTareas(session);

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

  const sinNada =
    tareas.totalTareas === 0 &&
    tareas.abandonadas.length === 0 &&
    tareas.documentosFallidos.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Mis tareas</h1>
        <p className="mt-1 text-sm text-gray-500">
          Todo lo que necesita una acción hoy, en un solo sitio: sin agrupar
          por cliente ni recortar por espacio como en el Panel.
        </p>
      </div>

      {sinNada && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          No hay nada pendiente ahora mismo. 🎉
        </div>
      )}

      {tareas.totalTareas > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-base font-semibold text-amber-900">
            🔔 Tareas de hoy
            <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
              {tareas.totalTareas}
            </span>
          </h2>
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
                <StaticTaskCard
                  href={i.href}
                  centroNombre={i.centroNombre}
                  contacto={i.contacto}
                  detalle={i.detalle}
                  tone="rose"
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
    </div>
  );
}
