"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PARTICIPANTE_LABELS } from "@/lib/labels";

export type ParticipanteItem = {
  id: string;
  nombre: string;
  rol: string;
  habitacionId: string | null;
  habitacionNombre: string | null;
};

export type HabitacionOption = {
  id: string;
  nombre: string;
  plazasLibres: number;
  rolOcupante: "ALUMNOS" | "PROFESORES" | null;
};

function etiquetaHabitacion(h: HabitacionOption): string {
  const plazas = h.plazasLibres > 0 ? `${h.plazasLibres} libres` : "sin plazas";
  if (!h.rolOcupante) return `${h.nombre} (${plazas})`;
  return `${h.nombre} (${plazas} · ${PARTICIPANTE_LABELS[h.rolOcupante]?.toLowerCase() ?? h.rolOcupante})`;
}

function HabitacionSelect({
  name,
  habitaciones,
  defaultValue,
  onChange,
  disabled,
}: {
  name: string;
  habitaciones: HabitacionOption[];
  defaultValue?: string;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      onChange={onChange}
      disabled={disabled}
      className="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
    >
      <option value="">Sin habitación asignada</option>
      {habitaciones.map((h) => (
        <option key={h.id} value={h.id}>
          {etiquetaHabitacion(h)}
        </option>
      ))}
    </select>
  );
}

function ParticipanteRow({
  participante,
  habitaciones,
}: {
  participante: ParticipanteItem;
  habitaciones: HabitacionOption[];
}) {
  const router = useRouter();
  const [habitacionId, setHabitacionId] = useState(participante.habitacionId ?? "");
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  async function cambiarHabitacion(event: React.ChangeEvent<HTMLSelectElement>) {
    const anterior = habitacionId;
    const nueva = event.target.value;
    setHabitacionId(nueva);
    setError(undefined);
    setIsPending(true);
    try {
      const res = await fetch(`/api/participantes/${participante.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habitacionId: nueva }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHabitacionId(anterior);
        setError(result.error ?? "No se pudo cambiar la habitación.");
        return;
      }
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function eliminar() {
    if (!confirm(`¿Quitar a ${participante.nombre} de esta estancia?`)) return;
    await fetch(`/api/participantes/${participante.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <li className="flex flex-col gap-1 rounded border border-gray-200 bg-white px-4 py-2 text-sm">
      <div className="flex items-center justify-between">
        <p className="text-gray-900">
          <span className="font-medium">{participante.nombre}</span>{" "}
          <span className="text-gray-400">
            · {PARTICIPANTE_LABELS[participante.rol] ?? participante.rol}
          </span>
        </p>
        <button
          type="button"
          onClick={eliminar}
          className="text-xs text-red-600 hover:underline"
        >
          Quitar
        </button>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={habitacionId}
          onChange={cambiarHabitacion}
          disabled={isPending}
          className="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="">Sin habitación asignada</option>
          {habitaciones.map((h) => (
            <option key={h.id} value={h.id}>
              {etiquetaHabitacion(h)}
            </option>
          ))}
        </select>
        {isPending && <span className="text-xs text-gray-400">Guardando…</span>}
      </div>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

function AutocompletarPanel({
  estanciaId,
  necesarios,
  totalLibres,
}: {
  estanciaId: string;
  necesarios: { alumnos: number; profesores: number };
  totalLibres: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);
  const total = necesarios.alumnos + necesarios.profesores;

  async function autocompletar() {
    setError(undefined);
    setIsPending(true);
    try {
      const res = await fetch(`/api/estancias/${estanciaId}/participantes/autocompletar`, {
        method: "POST",
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(result.error ?? "No se pudo autocompletar.");
        return;
      }
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="mb-3 flex flex-col gap-2 rounded border border-dashed border-gray-300 bg-gray-50 p-3 text-sm">
      <p className="text-gray-700">
        La estancia pide {necesarios.alumnos} alumno(s) y {necesarios.profesores}{" "}
        profesor(es) ({total} en total). Hay {totalLibres} plaza(s) libre(s) en
        esas fechas.
      </p>
      <button
        type="button"
        onClick={autocompletar}
        disabled={isPending}
        className="self-start rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
      >
        {isPending ? "Generando..." : "Autocompletar y repartir en habitaciones"}
      </button>
      {error && (
        <p className="text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Participantes({
  estanciaId,
  participantes,
  habitaciones,
  necesarios,
  totalLibres,
}: {
  estanciaId: string;
  participantes: ParticipanteItem[];
  habitaciones: HabitacionOption[];
  necesarios: { alumnos: number; profesores: number };
  totalLibres: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = {
      nombre: (data.get("nombre") as string) ?? "",
      rol: (data.get("rol") as string) ?? "ALUMNOS",
      habitacionId: (data.get("habitacionId") as string) || undefined,
    };
    try {
      const res = await fetch(`/api/estancias/${estanciaId}/participantes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(result.error ?? "No se pudo añadir el participante.");
        return;
      }
      form.reset();
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setIsPending(false);
    }
  }

  const necesitaAutocompletar =
    participantes.length === 0 && necesarios.alumnos + necesarios.profesores > 0;

  return (
    <div>
      {necesitaAutocompletar && (
        <AutocompletarPanel
          estanciaId={estanciaId}
          necesarios={necesarios}
          totalLibres={totalLibres}
        />
      )}
      <ul className="flex flex-col gap-2">
        {participantes.map((p) => (
          <ParticipanteRow key={p.id} participante={p} habitaciones={habitaciones} />
        ))}
        {participantes.length === 0 && (
          <p className="text-sm text-gray-500">Sin participantes registrados.</p>
        )}
      </ul>

      <form
        onSubmit={handleSubmit}
        className="mt-4 flex flex-col gap-3 rounded border border-gray-200 bg-white p-4"
      >
        <p className="text-sm font-medium text-gray-700">Añadir participante</p>
        <div className="grid grid-cols-3 gap-3">
          <input
            name="nombre"
            placeholder="Nombre"
            required
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            name="rol"
            defaultValue="ALUMNOS"
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="ALUMNOS">Alumno</option>
            <option value="PROFESORES">Profesor</option>
          </select>
          <HabitacionSelect name="habitacionId" habitaciones={habitaciones} />
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Añadir"}
        </button>
      </form>
    </div>
  );
}
