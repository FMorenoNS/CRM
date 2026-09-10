"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export type HabitacionRow = {
  id: string;
  nombre: string;
  capacidad: number;
  activa: boolean;
  ocupantes: number;
};

const inputCls = "rounded border border-gray-300 px-3 py-2 text-sm";

function CreateForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const res = await fetch("/api/habitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: data.get("nombre"),
          capacidad: data.get("capacidad"),
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(result.error ?? "No se pudo crear la habitación.");
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

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-md flex-col gap-3 rounded border border-gray-200 bg-white p-4"
    >
      <p className="text-sm font-medium text-gray-700">Nueva habitación</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="nombre" placeholder="Nombre (p. ej. 101)" required className={inputCls} />
        <input
          name="capacidad"
          type="number"
          min={1}
          max={50}
          placeholder="Capacidad"
          required
          className={inputCls}
        />
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear habitación"}
      </button>
    </form>
  );
}

function RowActions({ habitacion }: { habitacion: HabitacionRow }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();

  async function toggleActiva() {
    setIsPending(true);
    setError(undefined);
    try {
      await fetch(`/api/habitaciones/${habitacion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activa: !habitacion.activa }),
      });
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function eliminar() {
    if (!confirm(`¿Eliminar la habitación "${habitacion.nombre}"?`)) return;
    setIsPending(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/habitaciones/${habitacion.id}`, { method: "DELETE" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(result.error ?? "No se pudo eliminar.");
        return;
      }
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={toggleActiva}
          disabled={isPending}
          className="text-gray-600 hover:underline disabled:opacity-50"
        >
          {habitacion.activa ? "Desactivar" : "Activar"}
        </button>
        <button
          type="button"
          onClick={eliminar}
          disabled={isPending}
          className="text-red-600 hover:underline disabled:opacity-50"
        >
          Eliminar
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function HabitacionesClient({ habitaciones }: { habitaciones: HabitacionRow[] }) {
  return (
    <div className="flex flex-col gap-6">
      {/* En el móvil la tabla no cabe: se arrastra de lado dentro de su caja.
          Con overflow-hidden se quedaban columnas cortadas sin poder verlas. */}
      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2 text-right">Capacidad</th>
              <th className="px-4 py-2 text-right">Ocupantes actuales</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {habitaciones.map((h) => (
              <tr key={h.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{h.nombre}</td>
                <td className="px-4 py-2 text-right">{h.capacidad}</td>
                <td className="px-4 py-2 text-right">{h.ocupantes}</td>
                <td className="px-4 py-2">
                  {h.activa ? (
                    <span className="text-green-600">Activa</span>
                  ) : (
                    <span className="text-gray-400">Inactiva</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <RowActions habitacion={h} />
                </td>
              </tr>
            ))}
            {habitaciones.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  No hay habitaciones todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <CreateForm />
    </div>
  );
}
