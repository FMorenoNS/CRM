import Link from "next/link";
import type { OcupacionMensual } from "@/lib/ocupacion";

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

export function CalendarioOcupacion({
  anio,
  mes,
  ocupacion,
}: {
  anio: number;
  mes: number;
  ocupacion: OcupacionMensual;
}) {
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
            <div
              key={dia.fecha}
              className={`rounded px-1 py-2 text-center text-xs ${tonoOcupacion(
                dia.ocupados,
                ocupacion.capacidadTotal
              )}`}
              title={`${dia.fecha}: ${dia.ocupados}/${ocupacion.capacidadTotal} ocupadas`}
            >
              <p className="font-medium">{Number(dia.fecha.slice(-2))}</p>
              <p>
                {dia.ocupados}/{ocupacion.capacidadTotal}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
