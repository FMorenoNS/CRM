import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  ESTADO_LABELS,
  INTERACCION_LABELS,
  DOCUMENTO_LABELS,
} from "@/lib/labels";
import { TaskCard } from "./task-card";

const DIAS_SEGUIMIENTO = 3; // a partir de aquí, "hay que hacer algo"
const DIAS_ABANDONO = 15; // a partir de aquí, "esto probablemente está muerto"
const DIAS_PROXIMA = 21; // 3 semanas: avisar si el viaje se acerca sin cerrar

// Estados donde tiene sentido "molestar" por inactividad: el trato sigue
// abierto y depende de que alguien responda. CONTRATO_FIRMADO y ALOJADO se
// excluyen a propósito: una vez firmado, es normal no tener contacto durante
// meses hasta la fecha del viaje, y eso no es una tarea pendiente.
const ESTADOS_EN_CURSO = [
  "CONTACTADO",
  "EN_CONVERSACION",
  "PRESUPUESTO_ENVIADO",
  "PRESUPUESTO_CONFIRMADO",
] as const;

// Estados donde, si la fecha de inicio se acerca y seguimos aquí, hay prisa.
const ESTADOS_SIN_CERRAR = [
  "INTERESADO",
  "CONTACTADO",
  "EN_CONVERSACION",
  "PRESUPUESTO_ENVIADO",
  "PRESUPUESTO_CONFIRMADO",
] as const;

type Contacto = { nombre: string; telefono: string | null; email: string | null } | undefined;

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function diasDesde(fecha: Date, ahora: number) {
  return Math.floor((ahora - fecha.getTime()) / 86_400_000);
}

function contactoLinea(contacto: Contacto) {
  if (!contacto) return "Sin contacto registrado";
  return [contacto.nombre, contacto.telefono, contacto.email]
    .filter(Boolean)
    .join(" · ");
}

function StaticTaskCard({
  href,
  centroNombre,
  contacto,
  detalle,
  tone,
}: {
  href: string;
  centroNombre: string;
  contacto: Contacto;
  detalle: string;
  tone: "amber" | "rose" | "slate";
}) {
  const toneCls = {
    amber: "border-amber-200 hover:border-amber-400",
    rose: "border-rose-200 hover:border-rose-400",
    slate: "border-slate-200 hover:border-slate-400",
  }[tone];
  const detalleCls = {
    amber: "text-amber-700",
    rose: "text-rose-700",
    slate: "text-slate-600",
  }[tone];

  return (
    <Link
      href={href}
      className={`block rounded border bg-white px-3 py-2 text-sm ${toneCls}`}
    >
      <span className="font-medium text-gray-900">{centroNombre}</span>
      <span className="block text-gray-600">{contactoLinea(contacto)}</span>
      <span className={`text-xs ${detalleCls}`}>{detalle}</span>
    </Link>
  );
}

function TaskGroup({
  title,
  items,
}: {
  title: string;
  items: { key: string; node: React.ReactNode }[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-900">
        {title} ({items.length})
      </h3>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((i) => (
          <li key={i.key}>{i.node}</li>
        ))}
      </ul>
    </div>
  );
}

export default async function DashboardPage() {
  const ahora = Date.now();
  const enTresSemanas = new Date(ahora + DIAS_PROXIMA * 86_400_000);
  const contactosSelect = {
    orderBy: { createdAt: "asc" as const },
    take: 1,
  };

  const [
    centrosCount,
    estancias,
    porContactarRaw,
    enCursoRaw,
    proximasRaw,
    documentosFallidosRaw,
  ] = await Promise.all([
    prisma.centro.count(),
    prisma.estancia.findMany({
      include: {
        centro: { select: { nombre: true, pais: true } },
        interacciones: { orderBy: { fecha: "desc" }, take: 1 },
      },
    }),
    // Interesados a los que aún no hemos llamado.
    prisma.estancia.findMany({
      where: { activo: true, estado: "INTERESADO" },
      include: {
        centro: {
          select: { id: true, nombre: true, contactos: contactosSelect },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    // En gestión: para detectar silencios (sin respuesta / abandono).
    prisma.estancia.findMany({
      where: { activo: true, estado: { in: [...ESTADOS_EN_CURSO] } },
      include: {
        centro: {
          select: { id: true, nombre: true, contactos: contactosSelect },
        },
        interacciones: {
          where: { tipo: { not: "CAPTACION_FACEBOOK" } },
          orderBy: { fecha: "desc" },
          take: 1,
        },
      },
    }),
    // Fecha de inicio próxima y todavía sin contrato firmado.
    prisma.estancia.findMany({
      where: {
        activo: true,
        estado: { in: [...ESTADOS_SIN_CERRAR] },
        fechaInicio: { not: null, lte: enTresSemanas },
      },
      include: {
        centro: {
          select: { id: true, nombre: true, contactos: contactosSelect },
        },
      },
      orderBy: { fechaInicio: "asc" },
    }),
    // Envíos de presupuesto/contrato que fallaron.
    prisma.documentoEnviado.findMany({
      where: { exito: false },
      include: {
        estancia: { include: { centro: { select: { id: true, nombre: true } } } },
      },
      orderBy: { enviadoEn: "desc" },
    }),
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

  // --- Clasificación de tareas: cada estancia cae en UN único aviso, según
  // su gravedad (15+ días siempre gana y va a "Abandonadas"). ---
  type Item = {
    key: string;
    node: React.ReactNode;
  };
  const porContactar: Item[] = [];
  const sinRespuesta: Item[] = [];
  const presupuestoSinConfirmar: Item[] = [];
  const contratoPendienteFirma: Item[] = [];
  const abandonadas: Item[] = [];
  const idsPrincipales = new Set<string>();

  for (const e of porContactarRaw) {
    const dias = diasDesde(e.createdAt, ahora);
    const href = `/centros/${e.centro.id}?estancia=${e.id}`;
    const contacto = e.centro.contactos[0];
    if (dias >= DIAS_ABANDONO) {
      abandonadas.push({
        key: e.id,
        node: (
          <StaticTaskCard
            href={href}
            centroNombre={e.centro.nombre}
            contacto={contacto}
            tone="rose"
            detalle={`Nunca contactado, ${dias} días desde que llegó`}
          />
        ),
      });
    } else {
      idsPrincipales.add(e.id);
      porContactar.push({
        key: e.id,
        node: (
          <TaskCard
            href={href}
            centroNombre={e.centro.nombre}
            contacto={contacto}
            tone="amber"
            estanciaId={e.id}
            estado={e.estado}
            detalle={
              dias === 0
                ? "Nos ha contactado hoy, sin llamar todavía"
                : `Esperando primer contacto desde hace ${dias} día${dias === 1 ? "" : "s"}`
            }
          />
        ),
      });
    }
  }

  const ESTADO_A_GRUPO: Record<string, "sinRespuesta" | "presupuesto" | "contrato"> = {
    CONTACTADO: "sinRespuesta",
    EN_CONVERSACION: "sinRespuesta",
    PRESUPUESTO_ENVIADO: "presupuesto",
    PRESUPUESTO_CONFIRMADO: "contrato",
  };

  for (const e of enCursoRaw) {
    const ultima = e.interacciones[0];
    const fechaRef = ultima?.fecha ?? e.createdAt;
    const dias = diasDesde(fechaRef, ahora);
    if (dias < DIAS_SEGUIMIENTO) continue;

    const href = `/centros/${e.centro.id}?estancia=${e.id}`;
    const contacto = e.centro.contactos[0];
    const detalleBase = ultima
      ? `Último contacto por ${INTERACCION_LABELS[ultima.tipo]?.toLowerCase()} hace ${dias} días`
      : `Sin contacto desde hace ${dias} días`;

    if (dias >= DIAS_ABANDONO) {
      abandonadas.push({
        key: e.id,
        node: (
          <StaticTaskCard
            href={href}
            centroNombre={e.centro.nombre}
            contacto={contacto}
            tone="rose"
            detalle={`${detalleBase} · ${ESTADO_LABELS[e.estado]}`}
          />
        ),
      });
      continue;
    }

    idsPrincipales.add(e.id);
    const card = (
      <TaskCard
        href={href}
        centroNombre={e.centro.nombre}
        contacto={contacto}
        tone="amber"
        estanciaId={e.id}
        estado={e.estado}
        detalle={detalleBase}
      />
    );
    const grupo = ESTADO_A_GRUPO[e.estado];
    if (grupo === "sinRespuesta") sinRespuesta.push({ key: e.id, node: card });
    else if (grupo === "presupuesto") presupuestoSinConfirmar.push({ key: e.id, node: card });
    else if (grupo === "contrato") contratoPendienteFirma.push({ key: e.id, node: card });
  }

  const proximas: Item[] = proximasRaw.map((e) => {
    const diasRestantes = Math.ceil(
      (e.fechaInicio!.getTime() - ahora) / 86_400_000
    );
    idsPrincipales.add(e.id);
    return {
      key: e.id,
      node: (
        <TaskCard
          href={`/centros/${e.centro.id}?estancia=${e.id}`}
          centroNombre={e.centro.nombre}
          contacto={e.centro.contactos[0]}
          tone="amber"
          estanciaId={e.id}
          estado={e.estado}
          detalle={
            diasRestantes < 0
              ? `La fecha de inicio ya pasó (hace ${-diasRestantes} días) y sigue sin cerrar · ${ESTADO_LABELS[e.estado]}`
              : `Empieza en ${diasRestantes} día${diasRestantes === 1 ? "" : "s"} y sigue sin cerrar · ${ESTADO_LABELS[e.estado]}`
          }
        />
      ),
    };
  });

  const documentosFallidos: Item[] = documentosFallidosRaw.map((d) => ({
    key: d.id,
    node: (
      <StaticTaskCard
        href={`/centros/${d.estancia.centro.id}?estancia=${d.estanciaId}`}
        centroNombre={d.estancia.centro.nombre}
        contacto={undefined}
        tone="slate"
        detalle={`${DOCUMENTO_LABELS[d.tipo]} a ${d.destinatario}: el envío falló (${d.enviadoEn.toLocaleDateString("es-ES")})`}
      />
    ),
  }));

  const totalTareas = idsPrincipales.size;
  const totalAlertas = totalTareas + abandonadas.length + documentosFallidos.length;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Panel</h1>
        <div className="flex gap-2">
          <Link
            href="/centros/nuevo"
            className="rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark"
          >
            Nuevo centro
          </Link>
          <Link
            href="/estancias/nueva"
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Nueva estancia
          </Link>
        </div>
      </div>

      {totalTareas > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-amber-900">
              🔔 Tareas de hoy
              <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                {totalTareas}
              </span>
            </h2>
            <Link
              href="/estancias"
              className="text-sm font-medium text-amber-900 hover:underline"
            >
              Ir a pipeline →
            </Link>
          </div>
          <div className="mt-4 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <TaskGroup title="🆕 Por contactar" items={porContactar} />
            <TaskGroup title="🔁 Sin respuesta" items={sinRespuesta} />
            <TaskGroup
              title="⏳ Presupuesto enviado sin confirmar"
              items={presupuestoSinConfirmar}
            />
            <TaskGroup
              title="📄 Contrato pendiente de firma"
              items={contratoPendienteFirma}
            />
            <TaskGroup title="📅 Fecha próxima sin cerrar" items={proximas} />
          </div>
        </section>
      )}

      {abandonadas.length > 0 && (
        <section className="rounded-lg border border-rose-200 bg-rose-50 p-5">
          <h2 className="text-base font-semibold text-rose-900">
            🧟 Posibles abandonos
            <span className="ml-2 rounded-full bg-rose-200 px-2 py-0.5 text-xs font-medium text-rose-800">
              {abandonadas.length}
            </span>
          </h2>
          <p className="mt-1 text-sm text-rose-800">
            Llevan {DIAS_ABANDONO}+ días sin ningún movimiento. Puede que ya
            no siga adelante. Valora marcarlas como &ldquo;Perdido&rdquo;.
          </p>
          <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {abandonadas.map((i) => (
              <li key={i.key}>{i.node}</li>
            ))}
          </ul>
        </section>
      )}

      {documentosFallidos.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-base font-semibold text-slate-900">
            ⚠️ Envíos fallidos
            <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
              {documentosFallidos.length}
            </span>
          </h2>
          <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {documentosFallidos.map((i) => (
              <li key={i.key}>{i.node}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Centros captados" value={centrosCount} />
        <StatCard label="Estancias totales" value={total} />
        <StatCard label="Tasa de conversión" value={`${conversion}%`} />
        <StatCard label="Tareas pendientes" value={totalAlertas} />
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
    </div>
  );
}
