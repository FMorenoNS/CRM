"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { CANAL_OPTIONS, PAIS_OPTIONS, PROGRAMA_OPTIONS } from "@/lib/labels";

type DefaultValues = {
  nombre?: string;
  pais?: string;
  ciudad?: string | null;
  canalOrigen?: string | null;
  notas?: string | null;
};

type Duplicado = {
  id: string;
  nombre: string;
  pais: string;
  ciudad: string | null;
};

const inputCls = "rounded border border-gray-300 px-3 py-2 text-sm";

function CentroFields({ defaultValues }: { defaultValues?: DefaultValues }) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor="nombre" className="text-sm font-medium text-gray-700">
          Nombre del centro
        </label>
        <input
          id="nombre"
          name="nombre"
          defaultValue={defaultValues?.nombre}
          className={inputCls}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="pais" className="text-sm font-medium text-gray-700">
            País
          </label>
          <select
            id="pais"
            name="pais"
            defaultValue={defaultValues?.pais ?? ""}
            className={inputCls}
          >
            <option value="">Selecciona un país</option>
            {PAIS_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ciudad" className="text-sm font-medium text-gray-700">
            Ciudad
          </label>
          <input
            id="ciudad"
            name="ciudad"
            defaultValue={defaultValues?.ciudad ?? ""}
            className={inputCls}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="canalOrigen" className="text-sm font-medium text-gray-700">
          Canal de origen
        </label>
        <select
          id="canalOrigen"
          name="canalOrigen"
          defaultValue={defaultValues?.canalOrigen ?? "Facebook"}
          className={inputCls}
        >
          {CANAL_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="notas" className="text-sm font-medium text-gray-700">
          Notas
        </label>
        <textarea
          id="notas"
          name="notas"
          rows={3}
          defaultValue={defaultValues?.notas ?? ""}
          className={inputCls}
        />
      </div>
    </>
  );
}

export function CentroCreateForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [duplicados, setDuplicados] = useState<Duplicado[] | null>(null);
  const [isPending, setIsPending] = useState(false);

  function readValues(form: HTMLFormElement, force: boolean) {
    const d = new FormData(form);
    return {
      nombre: (d.get("nombre") as string) ?? "",
      pais: (d.get("pais") as string) ?? "",
      ciudad: (d.get("ciudad") as string) ?? "",
      canalOrigen: (d.get("canalOrigen") as string) || "Facebook",
      notas: (d.get("notas") as string) ?? "",
      contactoNombre: (d.get("contactoNombre") as string) ?? "",
      contactoCargo: (d.get("contactoCargo") as string) ?? "",
      contactoEmail: (d.get("contactoEmail") as string) ?? "",
      contactoTelefono: (d.get("contactoTelefono") as string) ?? "",
      tipoPrograma: (d.get("tipoPrograma") as string) ?? "",
      tipoParticipante: (d.get("tipoParticipante") as string) || "ALUMNOS",
      edadGrupo: (d.get("edadGrupo") as string) ?? "",
      fechaInicio: (d.get("fechaInicio") as string) ?? "",
      presupuestoImporte: (d.get("presupuestoImporte") as string) ?? "",
      grupoUrl: (d.get("grupoUrl") as string) ?? "",
      force,
    };
  }

  const formRef = useRef<HTMLFormElement | null>(null);

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
      router.push(`/centros/${data.id}`);
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
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex max-w-md flex-col gap-4"
    >
      <CentroFields />

      <fieldset className="flex flex-col gap-3 rounded border border-gray-200 p-3">
        <legend className="px-1 text-sm font-medium text-gray-700">
          Persona de contacto (opcional)
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <input
            name="contactoNombre"
            placeholder="Nombre"
            className={inputCls}
          />
          <input
            name="contactoCargo"
            placeholder="Cargo"
            className={inputCls}
          />
          <input
            name="contactoEmail"
            type="email"
            placeholder="Email"
            className={inputCls}
          />
          <input
            name="contactoTelefono"
            placeholder="Teléfono"
            className={inputCls}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded border border-gray-200 p-3">
        <legend className="px-1 text-sm font-medium text-gray-700">
          Primera estancia (opcional)
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <select name="tipoPrograma" defaultValue="" className={inputCls}>
            <option value="">Tipo de programa</option>
            {PROGRAMA_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            name="tipoParticipante"
            defaultValue="ALUMNOS"
            className={inputCls}
          >
            <option value="ALUMNOS">Alumnos</option>
            <option value="PROFESORES">Profesores</option>
          </select>
          <input name="edadGrupo" placeholder="Edad del grupo" className={inputCls} />
          <input name="fechaInicio" type="date" className={inputCls} />
          <input
            name="presupuestoImporte"
            type="number"
            step="0.01"
            placeholder="Presupuesto (€)"
            className={inputCls}
          />
          <input
            name="grupoUrl"
            type="url"
            placeholder="URL del grupo de Facebook"
            className={inputCls}
          />
        </div>
      </fieldset>

      {duplicados && duplicados.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
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
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={crearDeTodasFormas}
              disabled={isPending}
              className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              Crear uno nuevo de todas formas
            </button>
            <span className="self-center text-xs text-amber-700">
              …o pulsa un centro de la lista para ir al existente.
            </span>
          </div>
        </div>
      )}

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
        {isPending ? "Guardando..." : "Crear centro"}
      </button>
    </form>
  );
}

export function CentroEditForm({
  centroId,
  defaultValues,
}: {
  centroId: string;
  defaultValues: DefaultValues;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSaved(false);
    setIsPending(true);
    const d = new FormData(event.currentTarget);
    const values = {
      nombre: (d.get("nombre") as string) ?? "",
      pais: (d.get("pais") as string) ?? "",
      ciudad: (d.get("ciudad") as string) ?? "",
      canalOrigen: (d.get("canalOrigen") as string) || "Facebook",
      notas: (d.get("notas") as string) ?? "",
    };
    try {
      const res = await fetch(`/api/centros/${centroId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar el centro.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <CentroFields defaultValues={defaultValues} />
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {saved && <p className="text-sm text-green-600">Cambios guardados.</p>}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark disabled:opacity-50"
      >
        {isPending ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
