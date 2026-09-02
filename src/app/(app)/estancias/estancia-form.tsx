"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  TODOS_ESTADOS,
  ESTADO_LABELS,
  PROGRAMA_OPTIONS,
  TIPO_PROYECTO_LABELS,
} from "@/lib/labels";

export type CentroOption = { id: string; nombre: string };

type DefaultValues = {
  centroId?: string;
  tipoPrograma?: string;
  tipoProyecto?: string | null;
  tipoParticipante?: "ALUMNOS" | "PROFESORES";
  centroReceptor?: string;
  provincia?: string | null;
  numeroAlumnos?: string | null;
  edadGrupo?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  estado?: string;
  presupuestoImporte?: string | null;
  notas?: string | null;
};

function readValues(form: HTMLFormElement) {
  const data = new FormData(form);
  return {
    centroId: (data.get("centroId") as string) ?? "",
    tipoPrograma: (data.get("tipoPrograma") as string) ?? "",
    tipoProyecto: (data.get("tipoProyecto") as string) ?? "",
    tipoParticipante: (data.get("tipoParticipante") as string) ?? "ALUMNOS",
    centroReceptor: (data.get("centroReceptor") as string) || "Granada",
    provincia: (data.get("provincia") as string) ?? "",
    numeroAlumnos: (data.get("numeroAlumnos") as string) ?? "",
    edadGrupo: (data.get("edadGrupo") as string) ?? "",
    fechaInicio: (data.get("fechaInicio") as string) ?? "",
    fechaFin: (data.get("fechaFin") as string) ?? "",
    estado: (data.get("estado") as string) || undefined,
    presupuestoImporte: (data.get("presupuestoImporte") as string) ?? "",
    notas: (data.get("notas") as string) ?? "",
  };
}

// El último día del viaje no suma noche (solo se cuenta como día), p. ej.
// del 19/5 al 23/5 son 5 días y 4 noches.
function calcularDiasNoches(
  inicio: string,
  fin: string
): { dias: number; noches: number } | null {
  if (!inicio || !fin) return null;
  const d1 = new Date(`${inicio}T00:00:00`);
  const d2 = new Date(`${fin}T00:00:00`);
  const noches = Math.round((d2.getTime() - d1.getTime()) / 86_400_000);
  if (noches < 0) return null;
  return { dias: noches + 1, noches };
}

const inputCls = "rounded border border-gray-300 px-3 py-2 text-sm";

export function EstanciaForm({
  mode,
  centros,
  estanciaId,
  defaultValues,
  readOnly,
}: {
  mode: "create" | "edit";
  centros?: CentroOption[];
  estanciaId?: string;
  defaultValues?: DefaultValues;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(defaultValues?.fechaInicio ?? "");
  const [fechaFin, setFechaFin] = useState(defaultValues?.fechaFin ?? "");
  const diasNoches = calcularDiasNoches(fechaInicio, fechaFin);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setSaved(false);
    setIsPending(true);
    const values = readValues(event.currentTarget);
    try {
      const url =
        mode === "create" ? "/api/estancias" : `/api/estancias/${estanciaId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar la estancia.");
        return;
      }
      if (mode === "create") {
        router.push(`/centros/${values.centroId}?estancia=${data.id}`);
      } else {
        setSaved(true);
      }
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      {mode === "create" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="centroId" className="text-sm font-medium text-gray-700">
            Cliente de origen
          </label>
          <select
            id="centroId"
            name="centroId"
            required
            disabled={readOnly}
            defaultValue={defaultValues?.centroId ?? ""}
            className={inputCls}
          >
            <option value="" disabled>
              Selecciona un cliente…
            </option>
            {centros?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="tipoPrograma" className="text-sm font-medium text-gray-700">
            Tipo de programa
          </label>
          <select
            id="tipoPrograma"
            name="tipoPrograma"
            required
            disabled={readOnly}
            defaultValue={defaultValues?.tipoPrograma ?? ""}
            className={inputCls}
          >
            <option value="" disabled>
              Selecciona un programa…
            </option>
            {PROGRAMA_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            {/* Conserva un valor antiguo que no esté en la lista actual */}
            {defaultValues?.tipoPrograma &&
              !PROGRAMA_OPTIONS.includes(
                defaultValues.tipoPrograma as (typeof PROGRAMA_OPTIONS)[number]
              ) && (
                <option value={defaultValues.tipoPrograma}>
                  {defaultValues.tipoPrograma} (antiguo)
                </option>
              )}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tipoProyecto" className="text-sm font-medium text-gray-700">
            Tipo de proyecto
          </label>
          <select
            id="tipoProyecto"
            name="tipoProyecto"
            disabled={readOnly}
            defaultValue={defaultValues?.tipoProyecto ?? ""}
            className={inputCls}
          >
            <option value="">Sin definir</option>
            {Object.entries(TIPO_PROYECTO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="tipoParticipante"
            className="text-sm font-medium text-gray-700"
          >
            Tipo de participante
          </label>
          <select
            id="tipoParticipante"
            name="tipoParticipante"
            disabled={readOnly}
            defaultValue={defaultValues?.tipoParticipante ?? "ALUMNOS"}
            className={inputCls}
          >
            <option value="ALUMNOS">Alumnos</option>
            <option value="PROFESORES">Profesores</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="edadGrupo" className="text-sm font-medium text-gray-700">
            Edad del grupo
          </label>
          <input
            id="edadGrupo"
            name="edadGrupo"
            placeholder="Ej. 15-17 años"
            disabled={readOnly}
            defaultValue={defaultValues?.edadGrupo ?? ""}
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="numeroAlumnos" className="text-sm font-medium text-gray-700">
          Número de alumnos
        </label>
        <input
          id="numeroAlumnos"
          name="numeroAlumnos"
          type="number"
          min="0"
          step="1"
          disabled={readOnly}
          defaultValue={defaultValues?.numeroAlumnos ?? ""}
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="fechaInicio" className="text-sm font-medium text-gray-700">
            Fecha de inicio
          </label>
          <input
            id="fechaInicio"
            name="fechaInicio"
            type="date"
            disabled={readOnly}
            value={fechaInicio}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setFechaInicio(event.target.value)
            }
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="fechaFin" className="text-sm font-medium text-gray-700">
            Fecha de fin
          </label>
          <input
            id="fechaFin"
            name="fechaFin"
            type="date"
            disabled={readOnly}
            value={fechaFin}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setFechaFin(event.target.value)
            }
            className={inputCls}
          />
        </div>
      </div>
      {diasNoches && (
        <p className="-mt-2 text-xs text-gray-500">
          {diasNoches.dias} día{diasNoches.dias === 1 ? "" : "s"} ·{" "}
          {diasNoches.noches} noche{diasNoches.noches === 1 ? "" : "s"}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="centroReceptor"
            className="text-sm font-medium text-gray-700"
          >
            Centro receptor (Novaschool)
          </label>
          <input
            id="centroReceptor"
            name="centroReceptor"
            disabled={readOnly}
            defaultValue={defaultValues?.centroReceptor ?? "Granada"}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="provincia" className="text-sm font-medium text-gray-700">
            Provincia
          </label>
          <input
            id="provincia"
            name="provincia"
            disabled={readOnly}
            defaultValue={defaultValues?.provincia ?? "Granada"}
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="presupuestoImporte"
          className="text-sm font-medium text-gray-700"
        >
          Presupuesto (€)
        </label>
        <input
          id="presupuestoImporte"
          name="presupuestoImporte"
          type="number"
          step="0.01"
          disabled={readOnly}
          defaultValue={defaultValues?.presupuestoImporte ?? ""}
          className={inputCls}
        />
      </div>

      {mode === "edit" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="estado" className="text-sm font-medium text-gray-700">
            Estado
          </label>
          <select
            id="estado"
            name="estado"
            disabled={readOnly}
            defaultValue={defaultValues?.estado ?? "INTERESADO"}
            className={inputCls}
          >
            {TODOS_ESTADOS.map((e) => (
              <option key={e} value={e}>
                {ESTADO_LABELS[e]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="notas" className="text-sm font-medium text-gray-700">
          Notas
        </label>
        <textarea
          id="notas"
          name="notas"
          rows={3}
          disabled={readOnly}
          defaultValue={defaultValues?.notas ?? ""}
          className={inputCls}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {saved && <p className="text-sm text-green-600">Cambios guardados.</p>}

      {readOnly ? (
        <p className="text-xs text-gray-500">
          No tienes permiso para editar esta estancia.
        </p>
      ) : (
        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark disabled:opacity-50"
        >
          {isPending
            ? "Guardando..."
            : mode === "create"
              ? "Crear estancia"
              : "Guardar cambios"}
        </button>
      )}
    </form>
  );
}
