"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { OcupacionMensual } from "@/lib/ocupacion";
import { SidePanel } from "@/app/(app)/side-panel";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

function mesAnterior(anio: number, mes: number) {
  return mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
}

function mesSiguiente(anio: number, mes: number) {
  return mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 };
}

// Lunes=0 ... Domingo=6, para que la primera fila del calendario empiece en lunes.
function diaSemanaISO(fecha: Date): number {
  return (fecha.getUTCDay() + 6) % 7;
}

// El color de fondo de la celda refleja solo la ocupación confirmada
// (estancias contratadas): una reserva todavía en pipeline no debe pintar
// el día de rojo, ya se ve aparte en la barrita de reservas.
function tonoOcupacion(ocupados: number, capacidad: number): string {
  if (capacidad === 0) return "bg-gray-50 text-gray-400";
  const ratio = ocupados / capacidad;
  if (ratio > 0.9) return "bg-rose-100 text-rose-800";
  if (ratio > 0.5) return "bg-amber-100 text-amber-800";
  return "bg-green-50 text-green-800";
}

function colorBarraOcupado(ocupados: number, capacidad: number): string {
  if (capacidad === 0) return "bg-gray-300";
  const ratio = ocupados / capacidad;
  if (ratio > 0.9) return "bg-rose-500";
  if (ratio > 0.5) return "bg-amber-500";
  return "bg-green-500";
}

type OcupanteDia = {
  id: string;
  nombre: string;
  rolLabel: string;
  centroId: string;
  centroNombre: string;
  estanciaId: string;
  alergias: string | null;
  confirmado: boolean;
};

function BadgeReserva({ confirmado }: { confirmado: boolean }) {
  if (confirmado) return null;
  return (
    <span className="ml-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
      Reservado
    </span>
  );
}

type HabitacionDia = {
  id: string;
  nombre: string;
  capacidad: number;
  activa: boolean;
  ocupantes: OcupanteDia[];
};

type Vista = "habitacion" | "cliente" | "comedor" | "plano";

const VISTAS: { id: Vista; label: string }[] = [
  { id: "habitacion", label: "Por habitación" },
  { id: "cliente", label: "Por cliente" },
  { id: "comedor", label: "Comedor" },
  { id: "plano", label: "Plano" },
];

function formatFechaLarga(fechaISO: string): string {
  const d = new Date(`${fechaISO}T00:00:00.000Z`);
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function EnlaceOcupante({ o }: { o: OcupanteDia }) {
  return (
    <Link
      href={`/centros/${o.centroId}?estancia=${o.estanciaId}&tab=participantes`}
      className="font-medium text-brand-navy hover:underline"
    >
      {o.nombre}
    </Link>
  );
}

function VistaPorHabitacion({ habitaciones }: { habitaciones: HabitacionDia[] }) {
  // Las bloqueadas no se pueden ocupar, así que aquí no aportan nada: esta
  // vista es para gestionar quién está hoy, no para ver la planta entera
  // (eso lo hace la pestaña Plano).
  const activas = habitaciones.filter((h) => h.activa);
  return (
    <div className="flex flex-col gap-3">
      {activas.map((h) => (
        <div key={h.id} className="rounded border border-gray-200 p-3">
          <p className="text-sm font-medium text-gray-900">
            {h.nombre}{" "}
            <span className="font-normal text-gray-400">
              ({h.ocupantes.length}/{h.capacidad})
            </span>
          </p>
          {h.ocupantes.length === 0 ? (
            <p className="mt-1 text-xs text-gray-400">Libre.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {h.ocupantes.map((o) => (
                <li key={o.id} className="text-xs text-gray-600">
                  <EnlaceOcupante o={o} />
                  <BadgeReserva confirmado={o.confirmado} /> · {o.rolLabel} · {o.centroNombre}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {activas.length === 0 && (
        <p className="text-sm text-gray-500">No hay habitaciones activas.</p>
      )}
    </div>
  );
}

function VistaPorCliente({ ocupantes }: { ocupantes: OcupanteDia[] }) {
  const porCliente = new Map<string, { centroNombre: string; items: OcupanteDia[] }>();
  for (const o of ocupantes) {
    const grupo = porCliente.get(o.centroId);
    if (grupo) grupo.items.push(o);
    else porCliente.set(o.centroId, { centroNombre: o.centroNombre, items: [o] });
  }
  const grupos = [...porCliente.values()].sort((a, b) =>
    a.centroNombre.localeCompare(b.centroNombre)
  );

  return (
    <div className="flex flex-col gap-3">
      {grupos.map((g) => (
        <div key={g.centroNombre} className="rounded border border-gray-200 p-3">
          <p className="text-sm font-medium text-gray-900">
            {g.centroNombre}{" "}
            <span className="font-normal text-gray-400">({g.items.length})</span>
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {g.items.map((o) => (
              <li key={o.id} className="text-xs text-gray-600">
                <EnlaceOcupante o={o} />
                <BadgeReserva confirmado={o.confirmado} /> · {o.rolLabel}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {grupos.length === 0 && <p className="text-sm text-gray-500">Nadie ese día.</p>}
    </div>
  );
}

function VistaComedor({ ocupantes }: { ocupantes: OcupanteDia[] }) {
  const conNecesidades = ocupantes.filter((o) => o.alergias);
  const sinNecesidades = ocupantes.filter((o) => !o.alergias);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-gray-900">Total para comer hoy: {ocupantes.length}</p>

      <div>
        <h3 className="text-sm font-medium text-rose-700">
          Con alergias o necesidades especiales ({conNecesidades.length})
        </h3>
        {conNecesidades.length === 0 ? (
          <p className="mt-1 text-xs text-gray-400">Ninguna registrada.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {conNecesidades.map((o) => (
              <li key={o.id} className="rounded border border-rose-100 bg-rose-50 p-2 text-xs">
                <p className="text-gray-800">
                  <EnlaceOcupante o={o} /> · {o.rolLabel} · {o.centroNombre}
                </p>
                <p className="mt-0.5 font-medium text-rose-800">{o.alergias}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700">
          Sin necesidades registradas ({sinNecesidades.length})
        </h3>
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
          {sinNecesidades.map((o) => (
            <li key={o.id}>
              <EnlaceOcupante o={o} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Planta a la que pertenece una habitación, a partir de su número (101 →
// planta 1, 215 → planta 2...): es el mismo criterio que ya se usa al
// nombrar las habitaciones, no hace falta guardarlo aparte.
function plantaDe(nombre: string): number {
  const n = Number(nombre);
  return Number.isFinite(n) ? Math.floor(n / 100) : 0;
}

function rango(desde: number, hasta: number): string[] {
  const paso = desde <= hasta ? 1 : -1;
  const out: string[] = [];
  for (let n = desde; paso > 0 ? n <= hasta : n >= hasta; n += paso) out.push(String(n));
  return out;
}

// Orden real de las habitaciones a un lado del pasillo, de arriba abajo,
// tal como está en el plano de la residencia:
//  - orden: la secuencia de números, incluidos los que no existen como
//    habitación en el CRM (p. ej. 207-209 y 222 en la 2ª planta: están
//    cerradas, sin llave maestra) para que la planta se vea completa.
//  - saltoTrasNumero: justo después de esta habitación el pasillo da un
//    salto hacia la derecha en el plano (marcado ahí con una línea de
//    puntos).
//  - escaleraTrasNumeros: huecos de la escalera de incendios, justo
//    después de estas habitaciones.
type LadoLayout = {
  orden: string[];
  saltoTrasNumero: string;
  escaleraTrasNumeros?: string[];
};

const PLANTA_LAYOUT: Record<number, { izquierda: LadoLayout; derecha: LadoLayout }> = {
  1: {
    derecha: { orden: rango(101, 120), saltoTrasNumero: "112", escaleraTrasNumeros: ["104", "118"] },
    izquierda: { orden: rango(144, 121), saltoTrasNumero: "131" },
  },
  2: {
    derecha: { orden: rango(201, 220), saltoTrasNumero: "212", escaleraTrasNumeros: ["204", "218"] },
    izquierda: { orden: rango(244, 221), saltoTrasNumero: "231" },
  },
  3: {
    derecha: { orden: rango(301, 320), saltoTrasNumero: "312", escaleraTrasNumeros: ["304", "318"] },
    izquierda: { orden: rango(344, 321), saltoTrasNumero: "331" },
  },
};

// Una habitación real (con datos de ocupación) o un hueco del plano que no
// existe como fila en el CRM (cerrada, sin llave maestra): se dibuja igual,
// en gris, para no dejar un vacío raro en la planta.
type CajaData = HabitacionDia | { nombre: string; inexistente: true };

function esInexistente(h: CajaData): h is { nombre: string; inexistente: true } {
  return "inexistente" in h;
}

function agruparPorPlanta(habitaciones: HabitacionDia[]): {
  planta: number;
  izquierda: CajaData[];
  derecha: CajaData[];
  layout: { izquierda: LadoLayout; derecha: LadoLayout };
  sobrantes: HabitacionDia[];
}[] {
  const porNombre = new Map(habitaciones.map((h) => [h.nombre, h]));
  const usados = new Set<string>();
  const resolver = (nombres: string[]): CajaData[] =>
    nombres.map((nombre) => {
      usados.add(nombre);
      return porNombre.get(nombre) ?? { nombre, inexistente: true as const };
    });

  const plantas = Object.entries(PLANTA_LAYOUT)
    .map(([planta, layout]) => ({
      planta: Number(planta),
      izquierda: resolver(layout.izquierda.orden),
      derecha: resolver(layout.derecha.orden),
      layout,
      sobrantes: [] as HabitacionDia[],
    }))
    .sort((a, b) => a.planta - b.planta);

  // Por si algún día hay una habitación cuyo número no está en el esquema
  // de arriba (una ampliación, una planta nueva...): no desaparece, se
  // añade suelta al final de su planta en vez de perderse.
  for (const h of habitaciones) {
    if (usados.has(h.nombre)) continue;
    const planta = plantaDe(h.nombre);
    let grupo = plantas.find((p) => p.planta === planta);
    if (!grupo) {
      grupo = {
        planta,
        izquierda: [],
        derecha: [],
        layout: { izquierda: { orden: [], saltoTrasNumero: "" }, derecha: { orden: [], saltoTrasNumero: "" } },
        sobrantes: [],
      };
      plantas.push(grupo);
      plantas.sort((a, b) => a.planta - b.planta);
    }
    grupo.sobrantes.push(h);
  }

  return plantas;
}

// Caja de una habitación en el plano: gris con "No disponible" cuando está
// bloqueada o cuando el número ni siquiera existe como habitación en el
// CRM (cerrada, sin llave maestra); el resto lleva el mismo código de
// color que ya usa el calendario (verde/ámbar/rojo según ocupación).
function CajaHabitacion({ habitacion }: { habitacion: CajaData }) {
  if (esInexistente(habitacion) || !habitacion.activa) {
    return (
      <div
        title="No disponible"
        className="flex flex-col items-center justify-center gap-0.5 rounded border border-dashed border-gray-300 bg-gray-100 px-1 py-1.5 text-center text-gray-400"
      >
        <p className="text-xs font-semibold">{habitacion.nombre}</p>
        <p className="text-[11px] leading-tight">No disponible</p>
      </div>
    );
  }

  const ocupados = habitacion.ocupantes.filter((o) => o.confirmado).length;
  const reservados = habitacion.ocupantes.length - ocupados;
  const nombres = habitacion.ocupantes.map((o) => o.nombre).join(", ");
  return (
    <div
      title={nombres || "Libre"}
      className={`flex flex-col items-center justify-center gap-0.5 rounded border border-black/5 px-1 py-1.5 text-center ${tonoOcupacion(
        ocupados,
        habitacion.capacidad
      )}`}
    >
      <p className="text-xs font-semibold">{habitacion.nombre}</p>
      <p className="text-[11px] leading-tight">
        {ocupados}/{habitacion.capacidad}
        {reservados > 0 && <span className="text-sky-700"> +{reservados}</span>}
      </p>
    </div>
  );
}

// Hueco de la escalera de incendios: no es una habitación, se dibuja en el
// sitio del plano donde de verdad hay una, entre dos habitaciones.
function EscaleraIncendios() {
  return (
    <div
      title="Escalera de incendios"
      className="rounded border border-dashed border-gray-300 bg-gray-100 px-1 py-1 text-center text-[9px] font-medium uppercase leading-tight tracking-wide text-gray-400"
    >
      Escalera
    </div>
  );
}

// Una columna de habitaciones con, si le tocan, los huecos de la escalera
// de incendios intercalados justo después de la habitación que corresponda.
function ColumnaHabitaciones({
  habitaciones,
  escaleraTrasNumeros,
}: {
  habitaciones: CajaData[];
  escaleraTrasNumeros?: string[];
}) {
  return (
    <>
      {habitaciones.flatMap((h) => {
        const nodos = [<CajaHabitacion key={h.nombre} habitacion={h} />];
        if (escaleraTrasNumeros?.includes(h.nombre)) {
          nodos.push(<EscaleraIncendios key={`escalera-${h.nombre}`} />);
        }
        return nodos;
      })}
    </>
  );
}

// Plano de una planta: dos columnas (los dos lados del pasillo real, de
// arriba abajo) con un hueco en medio a modo de pasillo. No están a la
// misma altura porque cada lado tiene su propio número de habitaciones,
// igual que en el edificio de verdad. Justo después de la habitación
// marcada como "saltoTrasNumero" el pasillo real da un salto hacia la
// derecha: se refleja con un margen (sin llegar a la distancia exagerada
// del plano de papel) y una línea de puntos, igual que en el plano.
function PlanoPlanta({
  izquierda,
  derecha,
  layout,
  sobrantes,
}: {
  izquierda: CajaData[];
  derecha: CajaData[];
  layout: { izquierda: LadoLayout; derecha: LadoLayout };
  sobrantes: HabitacionDia[];
}) {
  const cortarTras = (orden: string[], numero: string) => {
    const i = orden.indexOf(numero);
    return i === -1 ? orden.length : i + 1;
  };
  const corteIzq = cortarTras(layout.izquierda.orden, layout.izquierda.saltoTrasNumero);
  const corteDer = cortarTras(layout.derecha.orden, layout.derecha.saltoTrasNumero);
  const [izqArriba, izqAbajo] = [izquierda.slice(0, corteIzq), izquierda.slice(corteIzq)];
  const [derArriba, derAbajo] = [derecha.slice(0, corteDer), derecha.slice(corteDer)];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <ColumnaHabitaciones
            habitaciones={izqArriba}
            escaleraTrasNumeros={layout.izquierda.escaleraTrasNumeros}
          />
          {izqAbajo.length > 0 && (
            <div className="ml-4 flex flex-col gap-1 border-t-2 border-dashed border-gray-300 pt-1">
              <ColumnaHabitaciones
                habitaciones={izqAbajo}
                escaleraTrasNumeros={layout.izquierda.escaleraTrasNumeros}
              />
            </div>
          )}
        </div>
        <div className="w-4 shrink-0 rounded bg-gray-50" title="Pasillo" />
        <div className="flex flex-1 flex-col gap-1">
          <ColumnaHabitaciones
            habitaciones={derArriba}
            escaleraTrasNumeros={layout.derecha.escaleraTrasNumeros}
          />
          {derAbajo.length > 0 && (
            <div className="ml-4 flex flex-col gap-1 border-t-2 border-dashed border-gray-300 pt-1">
              <ColumnaHabitaciones
                habitaciones={derAbajo}
                escaleraTrasNumeros={layout.derecha.escaleraTrasNumeros}
              />
            </div>
          )}
        </div>
      </div>
      {sobrantes.length > 0 && (
        <div className="mt-1 grid grid-cols-5 gap-1.5 border-t border-dashed border-gray-200 pt-2 sm:grid-cols-7">
          {sobrantes.map((h) => (
            <CajaHabitacion key={h.id} habitacion={h} />
          ))}
        </div>
      )}
    </div>
  );
}

// Plazas de una planta: solo las habitaciones activas cuentan (una
// bloqueada o inexistente no aloja a nadie, aunque tuviera una capacidad
// guardada).
function capacidadPlanta(...grupos: CajaData[][]): number {
  let total = 0;
  for (const grupo of grupos) {
    for (const h of grupo) {
      if (!esInexistente(h) && h.activa) total += h.capacidad;
    }
  }
  return total;
}

function VistaPlano({ habitaciones }: { habitaciones: HabitacionDia[] }) {
  const plantas = agruparPorPlanta(habitaciones);
  return (
    <div className="flex flex-col gap-6">
      {plantas.map((p) => (
        <div key={p.planta}>
          <h3 className="text-sm font-medium text-gray-700">
            Planta {p.planta}{" "}
            <span className="font-normal text-gray-400">
              ({capacidadPlanta(p.izquierda, p.derecha, p.sobrantes)} plazas)
            </span>
          </h3>
          <div className="mt-2">
            <PlanoPlanta
              izquierda={p.izquierda}
              derecha={p.derecha}
              layout={p.layout}
              sobrantes={p.sobrantes}
            />
          </div>
        </div>
      ))}
      {plantas.length === 0 && (
        <p className="text-sm text-gray-500">No hay habitaciones activas.</p>
      )}
    </div>
  );
}

function DetalleDia({ fecha }: { fecha: string }) {
  const [habitaciones, setHabitaciones] = useState<HabitacionDia[] | null>(null);
  const [error, setError] = useState<string>();
  const [vista, setVista] = useState<Vista>("habitacion");

  useEffect(() => {
    setHabitaciones(null);
    setError(undefined);
    setVista("habitacion");
    fetch(`/api/ocupacion/dia?fecha=${fecha}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setHabitaciones(data.habitaciones))
      .catch(() => setError("No se pudo cargar el detalle de ese día."));
  }, [fecha]);

  const ocupantes = habitaciones?.flatMap((h) => h.ocupantes) ?? [];
  const totalOcupados = ocupantes.filter((o) => o.confirmado).length;
  const totalReservados = ocupantes.filter((o) => !o.confirmado).length;
  // Las bloqueadas no cuentan para el total: aunque tengan una capacidad
  // guardada, hoy no se puede ocupar ninguna plaza suya.
  const totalCapacidad =
    habitaciones?.filter((h) => h.activa).reduce((s, h) => s + h.capacidad, 0) ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm capitalize text-gray-600">{formatFechaLarga(fecha)}</p>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {!habitaciones && !error && <p className="text-sm text-gray-500">Cargando…</p>}
      {habitaciones && (
        <>
          <p className="text-sm font-medium text-gray-900">
            {totalOcupados}/{totalCapacidad} plazas ocupadas
            {totalReservados > 0 && (
              <span className="ml-1.5 font-normal text-sky-700">
                (+{totalReservados} reservada{totalReservados === 1 ? "" : "s"})
              </span>
            )}
          </p>

          <div className="flex gap-1 border-b border-gray-200">
            {VISTAS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVista(v.id)}
                className={`px-3 py-1.5 text-xs font-medium ${
                  vista === v.id
                    ? "border-b-2 border-brand-navy text-brand-navy"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {vista === "habitacion" && <VistaPorHabitacion habitaciones={habitaciones} />}
          {vista === "cliente" && <VistaPorCliente ocupantes={ocupantes} />}
          {vista === "comedor" && <VistaComedor ocupantes={ocupantes} />}
          {vista === "plano" && <VistaPlano habitaciones={habitaciones} />}
        </>
      )}
    </div>
  );
}

export function CalendarioOcupacion({
  anio,
  mes,
  ocupacion,
}: {
  anio: number;
  mes: number;
  ocupacion: OcupacionMensual;
}) {
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const primerDia = new Date(Date.UTC(anio, mes - 1, 1));
  const huecosIniciales = diaSemanaISO(primerDia);
  const celdas: (typeof ocupacion.dias[number] | null)[] = [
    ...Array(huecosIniciales).fill(null),
    ...ocupacion.dias,
  ];

  const anterior = mesAnterior(anio, mes);
  const siguiente = mesSiguiente(anio, mes);

  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/habitaciones?mes=${anterior.anio}-${String(anterior.mes).padStart(2, "0")}`}
          className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
        >
          ← Anterior
        </Link>
        <p className="text-sm font-medium text-gray-900">
          {MESES[mes - 1]} {anio} · capacidad total {ocupacion.capacidadTotal}
        </p>
        <Link
          href={`/habitaciones?mes=${siguiente.anio}-${String(siguiente.mes).padStart(2, "0")}`}
          className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
        >
          Siguiente →
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
        {DIAS_SEMANA.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {celdas.map((dia, i) => {
          if (dia === null) return <div key={`vacio-${i}`} />;
          const capacidad = ocupacion.capacidadTotal;
          const pctOcupado = capacidad > 0 ? Math.min((dia.ocupados / capacidad) * 100, 100) : 0;
          const pctReservado =
            capacidad > 0
              ? Math.min((dia.reservados / capacidad) * 100, 100 - pctOcupado)
              : 0;
          return (
            <button
              key={dia.fecha}
              type="button"
              onClick={() => setDiaSeleccionado(dia.fecha)}
              className={`rounded px-1 py-2 text-center text-xs hover:ring-2 hover:ring-brand-navy/40 ${tonoOcupacion(
                dia.ocupados,
                capacidad
              )}`}
              title={`${dia.fecha}: ${dia.ocupados} ocupadas + ${dia.reservados} reservadas / ${capacidad}`}
            >
              <p className="font-medium">{Number(dia.fecha.slice(-2))}</p>
              {capacidad > 0 && (
                <div className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-black/10">
                  <div
                    className={colorBarraOcupado(dia.ocupados, capacidad)}
                    style={{ width: `${pctOcupado}%` }}
                  />
                  <div className="bg-sky-500" style={{ width: `${pctReservado}%` }} />
                </div>
              )}
              <p className="mt-0.5 leading-tight">
                {dia.ocupados}/{capacidad}
                {dia.reservados > 0 && <span className="text-sky-700"> +{dia.reservados}</span>}
              </p>
            </button>
          );
        })}
      </div>

      <SidePanel
        open={diaSeleccionado !== null}
        onClose={() => setDiaSeleccionado(null)}
        title="Ocupación del día"
      >
        {diaSeleccionado && <DetalleDia fecha={diaSeleccionado} />}
      </SidePanel>
    </div>
  );
}
