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

function tonoOcupacion(ocupados: number, capacidad: number): string {
  if (capacidad === 0) return "bg-gray-50 text-gray-400";
  const ratio = ocupados / capacidad;
  if (ratio > 0.9) return "bg-rose-100 text-rose-800";
  if (ratio > 0.5) return "bg-amber-100 text-amber-800";
  return "bg-green-50 text-green-800";
}

type OcupanteDia = {
  id: string;
  nombre: string;
  rolLabel: string;
  centroId: string;
  centroNombre: string;
  estanciaId: string;
  alergias: string | null;
};

type HabitacionDia = {
  id: string;
  nombre: string;
  capacidad: number;
  ocupantes: OcupanteDia[];
};

type Vista = "habitacion" | "cliente" | "comedor";

const VISTAS: { id: Vista; label: string }[] = [
  { id: "habitacion", label: "Por habitación" },
  { id: "cliente", label: "Por cliente" },
  { id: "comedor", label: "Comedor" },
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
  return (
    <div className="flex flex-col gap-3">
      {habitaciones.map((h) => (
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
                  <EnlaceOcupante o={o} /> · {o.rolLabel} · {o.centroNombre}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {habitaciones.length === 0 && (
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
                <EnlaceOcupante o={o} /> · {o.rolLabel}
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

  const totalOcupados = habitaciones?.reduce((s, h) => s + h.ocupantes.length, 0) ?? 0;
  const totalCapacidad = habitaciones?.reduce((s, h) => s + h.capacidad, 0) ?? 0;
  const ocupantes = habitaciones?.flatMap((h) => h.ocupantes) ?? [];

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
        {celdas.map((dia, i) =>
          dia === null ? (
            <div key={`vacio-${i}`} />
          ) : (
            <button
              key={dia.fecha}
              type="button"
              onClick={() => setDiaSeleccionado(dia.fecha)}
              className={`rounded px-1 py-2 text-center text-xs hover:ring-2 hover:ring-brand-navy/40 ${tonoOcupacion(
                dia.ocupados,
                ocupacion.capacidadTotal
              )}`}
              title={`${dia.fecha}: ${dia.ocupados}/${ocupacion.capacidadTotal} ocupadas`}
            >
              <p className="font-medium">{Number(dia.fecha.slice(-2))}</p>
              <p>
                {dia.ocupados}/{ocupacion.capacidadTotal}
              </p>
            </button>
          )
        )}
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
