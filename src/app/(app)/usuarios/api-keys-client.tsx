"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ROLE_LABELS } from "@/lib/labels";

export type ApiKeyRow = {
  id: string;
  nombre: string;
  activo: boolean;
  usuarioNombre: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export type UsuarioOption = { id: string; nombre: string; role: string };

const inputCls = "rounded border border-gray-300 px-3 py-2 text-sm";

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CreateForm({ usuarios }: { usuarios: UsuarioOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [nuevaClave, setNuevaClave] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setNuevaClave(undefined);
    setIsPending(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = {
      nombre: (data.get("nombre") as string) ?? "",
      userId: (data.get("userId") as string) ?? "",
    };
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(result.error ?? "No se pudo crear la clave.");
        return;
      }
      form.reset();
      setNuevaClave(result.token);
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
      className="flex max-w-lg flex-col gap-3 rounded border border-gray-200 bg-white p-4"
    >
      <p className="text-sm font-medium text-gray-700">Crear clave de API</p>
      <div className="grid grid-cols-2 gap-3">
        <input
          name="nombre"
          placeholder="Nombre (p. ej. Bot Facebook)"
          required
          className={inputCls}
        />
        <select name="userId" required defaultValue="" className={inputCls}>
          <option value="" disabled>
            Actúa como...
          </option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre} ({ROLE_LABELS[u.role] ?? u.role})
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {nuevaClave && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">
            Copia esta clave ahora: no se volverá a mostrar.
          </p>
          <code className="mt-1 block break-all rounded bg-white px-2 py-1 text-xs">
            {nuevaClave}
          </code>
        </div>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear clave"}
      </button>
    </form>
  );
}

function RowActions({ apiKey }: { apiKey: ApiKeyRow }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function toggleActivo() {
    setIsPending(true);
    try {
      await fetch(`/api/api-keys/${apiKey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !apiKey.activo }),
      });
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function eliminar() {
    if (!confirm(`¿Eliminar la clave "${apiKey.nombre}"? Dejará de funcionar de inmediato.`)) return;
    setIsPending(true);
    try {
      await fetch(`/api/api-keys/${apiKey.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={toggleActivo}
        disabled={isPending}
        className="text-gray-600 hover:underline disabled:opacity-50"
      >
        {apiKey.activo ? "Revocar" : "Reactivar"}
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
  );
}

export function ApiKeysClient({
  apiKeys,
  usuarios,
}: {
  apiKeys: ApiKeyRow[];
  usuarios: UsuarioOption[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Actúa como</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Creada</th>
              <th className="px-4 py-2">Último uso</th>
              <th className="px-4 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {apiKeys.map((k) => (
              <tr key={k.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{k.nombre}</td>
                <td className="px-4 py-2">{k.usuarioNombre}</td>
                <td className="px-4 py-2">
                  {k.activo ? (
                    <span className="text-green-600">Activa</span>
                  ) : (
                    <span className="text-gray-400">Revocada</span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">
                  {formatFechaHora(k.createdAt)}
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">
                  {k.lastUsedAt ? formatFechaHora(k.lastUsedAt) : "Nunca"}
                </td>
                <td className="px-4 py-2">
                  <RowActions apiKey={k} />
                </td>
              </tr>
            ))}
            {apiKeys.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No hay claves de API todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <CreateForm usuarios={usuarios} />
    </div>
  );
}
