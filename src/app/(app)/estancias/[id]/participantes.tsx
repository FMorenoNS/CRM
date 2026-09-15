"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PARTICIPANTE_LABELS } from "@/lib/labels";
import { useConfirm } from "@/app/(app)/confirm-dialog";

export type ParticipanteItem = {
  id: string;
  nombre: string;
  rol: string;
  habitacionId: string | null;
  habitacionNombre: string | null;
  fechaNacimiento: string | null; // ISO (solo fecha)
  alergias: string | null;
  contactoEmergenciaNombre: string | null;
  contactoEmergenciaTelefono: string | null;
  autorizacionRecibida: boolean;
  seguroRecibido: boolean;
  desayuno: boolean;
  almuerzo: boolean;
  cena: boolean;
};

// Edad que tendrá en la fecha de referencia (inicio de la estancia, no hoy):
// lo que importa para decidir si viaja como menor es la edad durante el
// viaje, no la edad actual.
function calcularEdad(fechaNacimientoISO: string, fechaReferenciaISO: string): number {
  const nacimiento = new Date(fechaNacimientoISO);
  const referencia = new Date(fechaReferenciaISO);
  let edad = referencia.getUTCFullYear() - nacimiento.getUTCFullYear();
  const antesDelCumple =
    referencia.getUTCMonth() < nacimiento.getUTCMonth() ||
    (referencia.getUTCMonth() === nacimiento.getUTCMonth() &&
      referencia.getUTCDate() < nacimiento.getUTCDate());
  if (antesDelCumple) edad--;
  return edad;
}

export type HabitacionOption = {
  id: string;
  nombre: string;
  plazasLibres: number;
  rolOcupante: "ALUMNOS" | "PROFESORES" | null;
  tieneNevera: boolean;
};

function etiquetaHabitacion(h: HabitacionOption): string {
  const plazas = h.plazasLibres > 0 ? `${h.plazasLibres} libres` : "sin plazas";
  const nevera = h.tieneNevera ? " ❄️" : "";
  if (!h.rolOcupante) return `${h.nombre}${nevera} (${plazas})`;
  return `${h.nombre}${nevera} (${plazas} · ${PARTICIPANTE_LABELS[h.rolOcupante]?.toLowerCase() ?? h.rolOcupante})`;
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

function DatosSensiblesForm({ participante }: { participante: ParticipanteItem }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);
  const [guardado, setGuardado] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setGuardado(false);
    setIsPending(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const res = await fetch(`/api/participantes/${participante.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fechaNacimiento: (data.get("fechaNacimiento") as string) || null,
          alergias: (data.get("alergias") as string) || null,
          contactoEmergenciaNombre: (data.get("contactoEmergenciaNombre") as string) || null,
          contactoEmergenciaTelefono: (data.get("contactoEmergenciaTelefono") as string) || null,
          autorizacionRecibida: data.get("autorizacionRecibida") === "on",
          seguroRecibido: data.get("seguroRecibido") === "on",
          desayuno: data.get("desayuno") === "on",
          almuerzo: data.get("almuerzo") === "on",
          cena: data.get("cena") === "on",
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(result.error ?? "No se pudo guardar.");
        return;
      }
      setGuardado(true);
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
      className="mt-2 flex flex-col gap-3 rounded border border-gray-100 bg-gray-50 p-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Fecha de nacimiento</label>
          <input
            type="date"
            name="fechaNacimiento"
            defaultValue={participante.fechaNacimiento ?? ""}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Contacto de emergencia</label>
          <div className="flex gap-1">
            <input
              type="text"
              name="contactoEmergenciaNombre"
              placeholder="Nombre"
              defaultValue={participante.contactoEmergenciaNombre ?? ""}
              className="w-1/2 rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <input
              type="text"
              name="contactoEmergenciaTelefono"
              placeholder="Teléfono"
              defaultValue={participante.contactoEmergenciaTelefono ?? ""}
              className="w-1/2 rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">
          Alergias / necesidades médicas o dietéticas
        </label>
        <textarea
          name="alergias"
          rows={2}
          defaultValue={participante.alergias ?? ""}
          placeholder="Ninguna conocida"
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </div>
      <div className="flex gap-4 text-sm text-gray-700">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="autorizacionRecibida"
            defaultChecked={participante.autorizacionRecibida}
          />
          Autorización de padres/tutores recibida
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="seguroRecibido" defaultChecked={participante.seguroRecibido} />
          Seguro médico/de viaje recibido
        </label>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-600">
          Comidas (informativo para la residencia)
        </span>
        <div className="flex gap-4 text-sm text-gray-700">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="desayuno" defaultChecked={participante.desayuno} />
            Desayuno
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="almuerzo" defaultChecked={participante.almuerzo} />
            Almuerzo
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="cena" defaultChecked={participante.cena} />
            Cena
          </label>
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {guardado && !error && <p className="text-xs text-green-700">Guardado.</p>}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
      >
        {isPending ? "Guardando..." : "Guardar datos"}
      </button>
    </form>
  );
}

function ParticipanteRow({
  participante,
  habitaciones,
  estanciaFechaInicio,
}: {
  participante: ParticipanteItem;
  habitaciones: HabitacionOption[];
  estanciaFechaInicio: string | null;
}) {
  const router = useRouter();
  const { confirmar, dialogo } = useConfirm();
  const [habitacionId, setHabitacionId] = useState(participante.habitacionId ?? "");
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  async function cambiarHabitacion(event: React.ChangeEvent<HTMLSelectElement>) {
    const anterior = habitacionId;
    const nueva = event.target.value;
    const select = event.target;

    const destino = habitaciones.find((h) => h.id === nueva);
    let forzarMezcla = false;
    if (destino?.rolOcupante && destino.rolOcupante !== participante.rol) {
      const ocupanteLabel = PARTICIPANTE_LABELS[destino.rolOcupante]?.toLowerCase() ?? destino.rolOcupante;
      const rolLabel = PARTICIPANTE_LABELS[participante.rol]?.toLowerCase() ?? participante.rol;
      const confirmado = await confirmar({
        titulo: "Compartir habitación con otro rol",
        mensaje: `${destino.nombre} ya la ocupan ${ocupanteLabel}. Vas a meter ahí a ${participante.nombre} (${rolLabel}), compartiendo habitación con el otro rol. ¿Seguro que quieres hacerlo?`,
        textoConfirmar: "Sí, meterlo ahí",
      });
      if (!confirmado) {
        select.value = anterior;
        return;
      }
      forzarMezcla = true;
    }

    setHabitacionId(nueva);
    setError(undefined);
    setIsPending(true);
    try {
      const res = await fetch(`/api/participantes/${participante.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habitacionId: nueva, forzarMezcla }),
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
    if (
      !(await confirmar({
        mensaje: `¿Quitar a ${participante.nombre} de esta estancia?`,
        textoConfirmar: "Quitar",
        peligro: true,
      }))
    )
      return;
    await fetch(`/api/participantes/${participante.id}`, { method: "DELETE" });
    router.refresh();
  }

  const [mostrarDatos, setMostrarDatos] = useState(false);
  const esMenor =
    participante.fechaNacimiento && estanciaFechaInicio
      ? calcularEdad(participante.fechaNacimiento, estanciaFechaInicio) < 18
      : null;
  const faltaDocumentacion =
    !participante.autorizacionRecibida || !participante.seguroRecibido;

  return (
    <li className="flex flex-col gap-1 rounded border border-gray-200 bg-white px-4 py-2 text-sm">
      <div className="flex items-center justify-between">
        <p className="text-gray-900">
          <span className="font-medium">{participante.nombre}</span>{" "}
          <span className="text-gray-400">
            · {PARTICIPANTE_LABELS[participante.rol] ?? participante.rol}
          </span>
          {esMenor && (
            <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              Menor de edad
            </span>
          )}
          {faltaDocumentacion && (
            <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              Faltan documentos
            </span>
          )}
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
      <button
        type="button"
        onClick={() => setMostrarDatos((v) => !v)}
        className="self-start text-xs text-gray-500 hover:text-brand-navy hover:underline"
      >
        {mostrarDatos ? "Ocultar datos sensibles ▲" : "Datos sensibles ▾"}
      </button>
      {mostrarDatos && <DatosSensiblesForm participante={participante} />}
      {dialogo}
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
  estanciaFechaInicio,
}: {
  estanciaId: string;
  participantes: ParticipanteItem[];
  habitaciones: HabitacionOption[];
  estanciaFechaInicio: string | null;
  necesarios: { alumnos: number; profesores: number };
  totalLibres: number;
}) {
  const router = useRouter();
  const { confirmar, dialogo } = useConfirm();
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const nombre = (data.get("nombre") as string) ?? "";
    const rol = (data.get("rol") as string) ?? "ALUMNOS";
    const habitacionId = (data.get("habitacionId") as string) || undefined;

    let forzarMezcla = false;
    if (habitacionId) {
      const destino = habitaciones.find((h) => h.id === habitacionId);
      if (destino?.rolOcupante && destino.rolOcupante !== rol) {
        const ocupanteLabel = PARTICIPANTE_LABELS[destino.rolOcupante]?.toLowerCase() ?? destino.rolOcupante;
        const rolLabel = PARTICIPANTE_LABELS[rol]?.toLowerCase() ?? rol;
        const confirmado = await confirmar({
          titulo: "Compartir habitación con otro rol",
          mensaje: `${destino.nombre} ya la ocupan ${ocupanteLabel}. Vas a meter ahí a ${nombre || "este participante"} (${rolLabel}), compartiendo habitación con el otro rol. ¿Seguro que quieres hacerlo?`,
          textoConfirmar: "Sí, meterlo ahí",
        });
        if (!confirmado) return;
        forzarMezcla = true;
      }
    }

    setError(undefined);
    setIsPending(true);
    const values = { nombre, rol, habitacionId, forzarMezcla };
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
          <ParticipanteRow
            key={p.id}
            participante={p}
            habitaciones={habitaciones}
            estanciaFechaInicio={estanciaFechaInicio}
          />
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
      {dialogo}
    </div>
  );
}
