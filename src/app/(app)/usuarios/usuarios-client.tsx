"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { CENTRO_ASIGNADO_LABELS } from "@/lib/labels";

export type UsuarioRow = {
  id: string;
  nombre: string;
  email: string;
  role: string;
  activo: boolean;
  centroIds: string[];
  centroAsignado: string | null;
};

export type ClienteOption = { id: string; nombre: string };

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  MARKETING: "Marketing",
  DIRECCION: "Dirección",
};

const inputCls = "rounded border border-gray-300 px-3 py-2 text-sm";

function CreateForm({ clientes }: { clientes: ClienteOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [ok, setOk] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setOk(false);
    setIsPending(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = {
      nombre: (data.get("nombre") as string) ?? "",
      email: (data.get("email") as string) ?? "",
      password: (data.get("password") as string) ?? "",
      role: (data.get("role") as string) ?? "MARKETING",
      centroIds: data.getAll("centroIds") as string[],
      centroAsignado: (data.get("centroAsignado") as string) || "",
    };
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(result.error ?? "No se pudo crear el usuario.");
        return;
      }
      form.reset();
      setOk(true);
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
      <p className="text-sm font-medium text-gray-700">Crear usuario</p>
      <div className="grid grid-cols-2 gap-3">
        <input name="nombre" placeholder="Nombre" required className={inputCls} />
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className={inputCls}
        />
        <input
          name="password"
          type="text"
          placeholder="Contraseña temporal (mín. 10)"
          required
          minLength={10}
          className={inputCls}
        />
        <select name="role" defaultValue="MARKETING" className={inputCls}>
          <option value="MARKETING">Marketing</option>
          <option value="DIRECCION">Dirección</option>
          <option value="ADMIN">Administrador</option>
        </select>
        <select name="centroAsignado" defaultValue="" className={inputCls}>
          <option value="">Centro asignado (sin asignar)</option>
          {Object.entries(CENTRO_ASIGNADO_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="centroIds" className="text-sm font-medium text-gray-700">
          Clientes a los que tiene acceso (solo aplica al rol Dirección)
        </label>
        <select
          id="centroIds"
          name="centroIds"
          multiple
          size={Math.min(5, Math.max(3, clientes.length))}
          className={inputCls}
        >
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {ok && <p className="text-sm text-green-600">Usuario creado.</p>}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear usuario"}
      </button>
    </form>
  );
}

function CentroAsignadoCell({ user }: { user: UsuarioRow }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    setIsPending(true);
    try {
      await fetch(`/api/usuarios/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centroAsignado: value }),
      });
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <select
      defaultValue={user.centroAsignado ?? ""}
      onChange={handleChange}
      disabled={isPending}
      className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-50"
    >
      <option value="">Sin asignar</option>
      {Object.entries(CENTRO_ASIGNADO_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

function RowActions({
  user,
  clientes,
}: {
  user: UsuarioRow;
  clientes: ClienteOption[];
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [centroIds, setCentroIds] = useState<string[]>(user.centroIds);

  async function patch(payload: Record<string, unknown>): Promise<boolean> {
    setIsPending(true);
    try {
      const res = await fetch(`/api/usuarios/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        alert(result.error ?? "No se pudo guardar el cambio.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      alert("No se pudo conectar con el servidor.");
      return false;
    } finally {
      setIsPending(false);
    }
  }

  function handleCentrosChange(event: ChangeEvent<HTMLSelectElement>) {
    const selected = Array.from(event.target.selectedOptions).map(
      (o) => o.value
    );
    setCentroIds(selected);
  }

  const centrosCambiados =
    centroIds.length !== user.centroIds.length ||
    centroIds.some((id) => !user.centroIds.includes(id));

  async function resetPassword() {
    const nueva = prompt(
      `Contraseña TEMPORAL para ${user.nombre} (mín. 10 caracteres).\n\n` +
        `${user.nombre} tendrá que cambiarla al entrar, y se cerrarán sus ` +
        `sesiones abiertas en todos los dispositivos.`
    );
    if (!nueva) return;
    if (nueva.length < 10) {
      alert("La contraseña debe tener al menos 10 caracteres.");
      return;
    }
    const ok = await patch({ password: nueva });
    if (ok) {
      alert(
        "Contraseña temporal asignada. Pásasela por un canal seguro: al " +
          "entrar, el CRM le obligará a elegir una propia."
      );
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={resetPassword}
          disabled={isPending}
          className="text-brand-navy hover:underline disabled:opacity-50"
        >
          Cambiar contraseña
        </button>
        <button
          type="button"
          onClick={() => patch({ activo: !user.activo })}
          disabled={isPending}
          className="text-gray-600 hover:underline disabled:opacity-50"
        >
          {user.activo ? "Desactivar" : "Activar"}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <select
          multiple
          size={Math.min(4, Math.max(2, clientes.length))}
          value={centroIds}
          onChange={handleCentrosChange}
          className="rounded border border-gray-300 px-2 py-1 text-xs"
        >
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        {centrosCambiados && (
          <button
            type="button"
            onClick={() => patch({ centroIds })}
            disabled={isPending}
            className="self-start text-xs text-brand-navy hover:underline disabled:opacity-50"
          >
            Guardar clientes
          </button>
        )}
      </div>
    </div>
  );
}

export function UsuariosClient({
  usuarios,
  clientes,
}: {
  usuarios: UsuarioRow[];
  clientes: ClienteOption[];
}) {
  const nombresPorId = new Map(clientes.map((c) => [c.id, c.nombre]));
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Rol</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Centro asignado</th>
              <th className="px-4 py-2">Clientes</th>
              <th className="px-4 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{u.nombre}</td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">{ROLE_LABELS[u.role] ?? u.role}</td>
                <td className="px-4 py-2">
                  {u.activo ? (
                    <span className="text-green-600">Activo</span>
                  ) : (
                    <span className="text-gray-400">Inactivo</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <CentroAsignadoCell user={u} />
                </td>
                <td className="px-4 py-2 text-xs text-gray-600">
                  {u.role === "ADMIN" || u.role === "MARKETING"
                    ? "Todos"
                    : u.centroIds.length > 0
                      ? u.centroIds
                          .map((id) => nombresPorId.get(id) ?? id)
                          .join(", ")
                      : "Ninguno"}
                </td>
                <td className="px-4 py-2">
                  <RowActions user={u} clientes={clientes} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CreateForm clientes={clientes} />
    </div>
  );
}
