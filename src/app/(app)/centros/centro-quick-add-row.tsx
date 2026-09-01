"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { CANAL_OPTIONS, PROGRAMA_OPTIONS } from "@/lib/labels";

type Duplicado = {
  id: string;
  nombre: string;
  pais: string;
  ciudad: string | null;
};

const cellInputCls =
  "w-full rounded border border-gray-300 px-2 py-1.5 text-sm";

function readValues(form: HTMLFormElement, force: boolean) {
  const d = new FormData(form);
  return {
    nombre: (d.get("nombre") as string) ?? "",
    pais: (d.get("pais") as string) ?? "",
    contactoNombre: (d.get("contactoNombre") as string) ?? "",
    contactoCargo: (d.get("contactoCargo") as string) ?? "",
    canalOrigen: (d.get("canalOrigen") as string) || "Facebook",
    tipoPrograma: (d.get("tipoPrograma") as string) ?? "",
    grupoUrl: (d.get("grupoUrl") as string) ?? "",
    force,
  };
}

export function CentroQuickAddRow({ colSpan }: { colSpan: number }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [error, setError] = useState<string>();
  const [duplicados, setDuplicados] = useState<Duplicado[] | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function submit(values: ReturnType<typeof readValues>) {
    setError(undefined);
    setIsPending(true);
    try {
      const res = await fetch("/api/centros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.error === "posible_duplicado") {
        setDuplicados(data.duplicados ?? []);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "No se pudo crear el centro.");
        return;
      }
      formRef.current?.reset();
      setDuplicados(null);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDuplicados(null);
    await submit(readValues(event.currentTarget, false));
  }

  async function crearDeTodasFormas() {
    const form = formRef.current;
    if (!form) return;
    await submit(readValues(form, true));
  }

  return (
    <>
      <tr className="border-t border-gray-200 bg-gray-50/60">
        <td colSpan={colSpan} className="p-0">
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="grid grid-cols-8 gap-2 px-4 py-2"
          >
            <input
              name="nombre"
              required
              placeholder="Nombre del centro"
              className={cellInputCls}
            />
            <input name="pais" required placeholder="País" className={cellInputCls} />
            <div className={`${cellInputCls} flex items-center border-dashed text-gray-400`}>
              Hoy
            </div>
            <input
              name="contactoNombre"
              placeholder="Persona de contacto"
              className={cellInputCls}
            />
            <input name="contactoCargo" placeholder="Cargo" className={cellInputCls} />
            <select name="canalOrigen" defaultValue="Facebook" className={cellInputCls}>
              {CANAL_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select name="tipoPrograma" defaultValue="" className={cellInputCls}>
              <option value="">Sin definir</option>
              {PROGRAMA_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <div className="flex gap-1">
              <input
                name="grupoUrl"
                type="url"
                placeholder="URL del grupo"
                className={cellInputCls}
              />
              <button
                type="submit"
                disabled={isPending}
                className="shrink-0 rounded bg-brand-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-navy-dark disabled:opacity-50"
              >
                {isPending ? "..." : "Añadir"}
              </button>
            </div>
          </form>
        </td>
      </tr>

      {error && (
        <tr>
          <td colSpan={colSpan} className="px-4 py-2 text-sm text-red-600">
            {error}
          </td>
        </tr>
      )}

      {duplicados && duplicados.length > 0 && (
        <tr>
          <td colSpan={colSpan} className="px-4 py-3">
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">
                Puede que este centro ya exista. Coincidencias:
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {duplicados.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/centros/${d.id}`}
                      className="font-medium text-brand-navy hover:underline"
                    >
                      {d.nombre}
                    </Link>{" "}
                    <span className="text-amber-700">
                      ({[d.ciudad, d.pais].filter(Boolean).join(", ")})
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={crearDeTodasFormas}
                  disabled={isPending}
                  className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  Crear uno nuevo de todas formas
                </button>
                <span className="text-xs text-amber-700">
                  …o pulsa un centro de la lista para ir al existente.
                </span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
