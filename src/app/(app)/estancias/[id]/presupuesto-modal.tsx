"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AUTOBUSES,
  CONCEPTOS,
  IVA_POR_DEFECTO,
  MARGEN_POR_DEFECTO,
  calcularPresupuesto,
  formatearEuros,
  redondear,
  resolverDiasNoches,
  valoresPorDefecto,
  type LineaEntrada,
} from "@/lib/precios";
import { CENTRO_ASIGNADO_LABELS } from "@/lib/labels";
import { useConfirm } from "@/app/(app)/confirm-dialog";

const CENTROS_NOVASCHOOL = ["OPENWORLD", "MEDINA_ELVIRA", "ANORETA"] as const;

// Productos fijos de la casa: entran marcados desde el principio en toda
// oferta nueva (se pueden desmarcar si no aplican).
const PRODUCTOS_FIJOS = ["MONITORES", "MATERIALES", "INSTALACIONES"];

/** Presupuesto ya guardado, tal como lo devuelve el servidor. */
export type PresupuestoGuardado = {
  numAlumnos: number;
  numProfesores: number;
  numMonitores: number;
  margenPct: number;
  ivaPct: number;
  total: number;
  notas: string | null;
  actualizadoEn: string;
  actualizadoPor: string | null;
  centrosNovaschool: string[];
  validadoPor: string | null;
  validadoEn: string | null;
  // Calculado en el servidor: si el usuario que tiene la ventana abierta
  // puede darle el visto bueno ahora mismo.
  puedeValidar: boolean;
  lineas: {
    tipo: "CONCEPTO" | "AUTOBUS";
    codigo: string;
    precioUnitario: number;
    dias: number;
    cantidad: number;
  }[];
};

type Contexto = {
  numeroAlumnos: string | null;
  numeroProfesores: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  diasManual?: number | null;
  nochesManual?: number | null;
};

/**
 * Estado editable de una línea. `incluida` es lo que decide si entra en la
 * oferta: la cantidad viene puesta con el grupo entero desde el principio,
 * así que no puede servir de marca.
 */
type Fila = {
  incluida: boolean;
  precioUnitario: number;
  dias: number;
  cantidad: number;
};

const inputNum =
  "w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm tabular-nums";

function aNumero(v: string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Campo de presupuesto de la estancia. Se pulsa y abre la calculadora, con
 * las tarifas de la casa ya cargadas.
 *
 * Lleva además un input oculto con el importe: el formulario de la estancia
 * envía `presupuestoImporte` en su PATCH, y sin él ese envío borraría el
 * importe cada vez que se guardan los demás datos.
 */
export function PresupuestoCampo({
  estanciaId,
  presupuesto,
  importeActual,
  contexto,
  readOnly,
}: {
  estanciaId: string;
  presupuesto: PresupuestoGuardado | null;
  importeActual: string | null;
  contexto: Contexto;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [importe, setImporte] = useState(importeActual ?? "");

  const totalMostrado = importe ? formatearEuros(Number(importe)) : null;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-gray-700">Presupuesto</span>
      <input type="hidden" name="presupuestoImporte" value={importe} />

      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex items-center justify-between gap-3 rounded border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:border-brand-navy hover:bg-gray-50"
      >
        <span>
          {totalMostrado ? (
            <>
              <span className="font-semibold tabular-nums text-gray-900">
                {totalMostrado}
              </span>
              {presupuesto && (
                <span className="ml-2 text-xs text-gray-500">
                  {presupuesto.lineas.length} concepto(s)
                  {presupuesto.actualizadoPor
                    ? ` · ${presupuesto.actualizadoPor}`
                    : ""}
                </span>
              )}
              {presupuesto && (
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                    presupuesto.validadoPor
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {presupuesto.validadoPor ? "Validado" : "Sin validar"}
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-500">Sin presupuesto todavía</span>
          )}
        </span>
        <span className="shrink-0 text-xs font-medium text-brand-navy">
          {readOnly ? "Ver detalle" : presupuesto ? "Editar" : "Calcular"}
        </span>
      </button>

      {!presupuesto && importe && (
        <p className="text-xs text-gray-500">
          Importe puesto a mano, sin desglose. Al calcularlo se sustituye.
        </p>
      )}

      {abierto && (
        <Calculadora
          estanciaId={estanciaId}
          presupuesto={presupuesto}
          contexto={contexto}
          readOnly={readOnly}
          onCerrar={() => setAbierto(false)}
          onGuardado={(total) => {
            setImporte(total === null ? "" : String(total));
            setAbierto(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Calculadora({
  estanciaId,
  presupuesto,
  contexto,
  readOnly,
  onCerrar,
  onGuardado,
}: {
  estanciaId: string;
  presupuesto: PresupuestoGuardado | null;
  contexto: Contexto;
  readOnly?: boolean;
  onCerrar: () => void;
  onGuardado: (total: number | null) => void;
}) {
  const router = useRouter();
  const { confirmar, dialogo: dialogoConfirmar } = useConfirm();
  const { dias, noches } = resolverDiasNoches({
    fechaInicio: contexto.fechaInicio,
    fechaFin: contexto.fechaFin,
    diasManual: contexto.diasManual,
    nochesManual: contexto.nochesManual,
  });

  const [numAlumnos, setNumAlumnos] = useState(
    presupuesto?.numAlumnos ?? aNumero(contexto.numeroAlumnos)
  );
  const [numProfesores, setNumProfesores] = useState(
    presupuesto?.numProfesores ?? aNumero(contexto.numeroProfesores)
  );
  const [numMonitores, setNumMonitores] = useState(
    presupuesto?.numMonitores ?? 1
  );
  // En pantalla se manejan porcentajes (20), en la API fracciones (0,2).
  const [margen, setMargen] = useState(
    (presupuesto?.margenPct ?? MARGEN_POR_DEFECTO) * 100
  );
  const [iva, setIva] = useState((presupuesto?.ivaPct ?? IVA_POR_DEFECTO) * 100);
  const [notas, setNotas] = useState(presupuesto?.notas ?? "");
  const [centrosNovaschool, setCentrosNovaschool] = useState<string[]>(
    presupuesto?.centrosNovaschool ?? []
  );
  const [guardando, setGuardando] = useState(false);
  const [validando, setValidando] = useState(false);
  const [error, setError] = useState<string>();
  const [errorValidar, setErrorValidar] = useState<string>();

  function alternarCentro(codigo: string) {
    setCentrosNovaschool((prev) =>
      prev.includes(codigo) ? prev.filter((c) => c !== codigo) : [...prev, codigo]
    );
  }

  const pax = numAlumnos + numProfesores;

  /**
   * Cantidades que se han cambiado a mano. Mientras una cantidad no se
   * toque, sigue al grupo: si se corrige el número de alumnos, todas las
   * líneas se ajustan solas. En cuanto se toca una, se respeta y deja de
   * seguirlo. Las líneas de un presupuesto ya guardado cuentan como tocadas.
   */
  // Los monitores se cuentan aparte del grupo desde el principio (empiezan
  // en 1, no en el número de personas), así que se marcan "tocados" de
  // fábrica para que el efecto de más abajo no los reescriba con el grupo.
  const [tocadas, setTocadas] = useState<Record<string, boolean>>(() => {
    const t: Record<string, boolean> = { MONITORES: true };
    for (const l of presupuesto?.lineas ?? []) t[l.codigo] = true;
    return t;
  });

  const [filas, setFilas] = useState<Record<string, Fila>>(() => {
    const inicial: Record<string, Fila> = {};
    const paxInicial =
      (presupuesto?.numAlumnos ?? aNumero(contexto.numeroAlumnos)) +
      (presupuesto?.numProfesores ?? aNumero(contexto.numeroProfesores));
    const ctx = { pax: paxInicial, dias, noches };

    for (const c of CONCEPTOS) {
      const guardada = presupuesto?.lineas.find(
        (l) => l.tipo === "CONCEPTO" && l.codigo === c.codigo
      );
      if (guardada) {
        inicial[c.codigo] = {
          incluida: true,
          precioUnitario: guardada.precioUnitario,
          dias: guardada.dias,
          cantidad: guardada.cantidad,
        };
      } else if (PRODUCTOS_FIJOS.includes(c.codigo)) {
        // Monitores, Materiales e Instalaciones entran marcados de fábrica:
        // "fijos" es que empiezan puestos, no que estén bloqueados, se
        // pueden desmarcar o tocar como cualquier otro concepto. Los
        // monitores no cuentan como personas: empiezan en 1, no en el grupo
        // entero; Materiales e Instalaciones sí siguen al grupo.
        const def = valoresPorDefecto(c.unidad, ctx);
        inicial[c.codigo] = {
          incluida: true,
          precioUnitario: c.precio,
          dias: def.dias,
          cantidad: c.codigo === "MONITORES" ? 1 : def.cantidad,
        };
      } else {
        const def = valoresPorDefecto(c.unidad, ctx);
        inicial[c.codigo] = {
          incluida: false,
          precioUnitario: c.precio,
          dias: def.dias,
          cantidad: def.cantidad,
        };
      }
    }
    for (const a of AUTOBUSES) {
      const guardada = presupuesto?.lineas.find(
        (l) => l.tipo === "AUTOBUS" && l.codigo === a.codigo
      );
      inicial[a.codigo] = guardada
        ? {
            incluida: true,
            precioUnitario: guardada.precioUnitario,
            dias: guardada.dias,
            cantidad: guardada.cantidad,
          }
        : {
            incluida: false,
            precioUnitario: a.precio,
            dias: 1,
            // El grupo también aquí, como en el resto. Ojo: en un autobús la
            // cantidad son servicios, no personas, así que casi siempre hay
            // que bajarla con las flechas.
            cantidad: ctx.pax,
          };
    }
    return inicial;
  });

  // Las cantidades sin tocar siguen al grupo.
  useEffect(() => {
    setFilas((prev) => {
      const siguiente = { ...prev };
      let cambio = false;
      for (const codigo of Object.keys(prev)) {
        if (tocadas[codigo] || codigo === "MONITORES") continue;
        if (prev[codigo].cantidad === pax) continue;
        siguiente[codigo] = { ...prev[codigo], cantidad: pax };
        cambio = true;
      }
      return cambio ? siguiente : prev;
    });
  }, [pax, tocadas]);

  const actualizar = useCallback(
    (codigo: string, campo: keyof Fila, valor: number | boolean) => {
      if (campo === "cantidad") {
        setTocadas((t) => ({ ...t, [codigo]: true }));
      }
      setFilas((prev) => {
        const nueva: Fila = {
          ...prev[codigo],
          [campo]:
            typeof valor === "boolean" ? valor : Math.max(0, valor as number),
        };
        // Tocar el precio, los días o la cantidad de una línea ya es decir
        // que entra en la oferta: se marca sola, para no obligar a hacer dos
        // gestos para una sola decisión.
        if (campo !== "incluida") nueva.incluida = true;
        return { ...prev, [codigo]: nueva };
      });
    },
    []
  );

  /** Devuelve todas las cantidades al grupo y los días a lo que toca. */
  function rellenarConElGrupo() {
    const ctx = { pax, dias, noches };
    setTocadas({ MONITORES: true });
    setFilas((prev) => {
      const siguiente = { ...prev };
      for (const c of CONCEPTOS) {
        const def = valoresPorDefecto(c.unidad, ctx);
        siguiente[c.codigo] = {
          ...prev[c.codigo],
          dias: def.dias,
          cantidad: c.codigo === "MONITORES" ? 1 : def.cantidad,
        };
      }
      for (const a of AUTOBUSES) {
        siguiente[a.codigo] = { ...prev[a.codigo], dias: 1, cantidad: ctx.pax };
      }
      return siguiente;
    });
  }

  /** Solo lo marcado entra en la oferta y en los totales. */
  const lineasIncluidas: LineaEntrada[] = useMemo(() => {
    const todas = [
      ...CONCEPTOS.map((c) => ({
        tipo: "CONCEPTO" as const,
        codigo: c.codigo,
        nombre: c.nombre,
      })),
      ...AUTOBUSES.map((a) => ({
        tipo: "AUTOBUS" as const,
        codigo: a.codigo,
        nombre: a.nombre,
      })),
    ];
    return todas
      .filter((l) => filas[l.codigo]?.incluida)
      .map((l) => ({
        ...l,
        precioUnitario: filas[l.codigo].precioUnitario,
        dias: filas[l.codigo].dias,
        cantidad: filas[l.codigo].cantidad,
      }));
  }, [filas]);

  const { totales } = useMemo(
    () =>
      calcularPresupuesto({
        numAlumnos,
        numProfesores,
        lineas: lineasIncluidas,
        margenPct: margen / 100,
        ivaPct: iva / 100,
      }),
    [numAlumnos, numProfesores, lineasIncluidas, margen, iva]
  );

  // Total de cada línea, también de las no marcadas: así se ve lo que
  // sumaría antes de meterla en la oferta.
  const totalDeFila = useCallback(
    (codigo: string) => {
      const f = filas[codigo];
      if (!f) return 0;
      return redondear(f.precioUnitario * f.dias * f.cantidad);
    },
    [filas]
  );

  const incluidas = lineasIncluidas.length;

  // Escape cierra la ventana.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  // Mientras la ventana está abierta, la página de detrás no se mueve.
  //
  // Se bloquean html y body a la vez: el layout de la app pone `h-full` en
  // html, y en ese caso bloquear solo body no siempre basta (según el
  // navegador, el que scrollea es el elemento raíz). Además se compensa el
  // ancho de la barra de scroll que desaparece, porque si no la página da un
  // salto lateral al abrir y otro al cerrar.
  useEffect(() => {
    const raiz = document.documentElement;
    const cuerpo = document.body;
    const anterior = {
      raizOverflow: raiz.style.overflow,
      cuerpoOverflow: cuerpo.style.overflow,
      cuerpoPadding: cuerpo.style.paddingRight,
    };
    const anchoBarra = window.innerWidth - raiz.clientWidth;

    raiz.style.overflow = "hidden";
    cuerpo.style.overflow = "hidden";
    if (anchoBarra > 0) {
      const actual = parseFloat(getComputedStyle(cuerpo).paddingRight) || 0;
      cuerpo.style.paddingRight = `${actual + anchoBarra}px`;
    }

    return () => {
      raiz.style.overflow = anterior.raizOverflow;
      cuerpo.style.overflow = anterior.cuerpoOverflow;
      cuerpo.style.paddingRight = anterior.cuerpoPadding;
    };
  }, []);

  async function guardar() {
    setError(undefined);
    setGuardando(true);
    try {
      const res = await fetch(`/api/estancias/${estanciaId}/presupuesto`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numAlumnos,
          numProfesores,
          numMonitores,
          margenPct: margen / 100,
          ivaPct: iva / 100,
          notas,
          lineas: lineasIncluidas,
          centrosNovaschool,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar el presupuesto.");
        return;
      }
      onGuardado(data.totales?.total ?? totales.total);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setGuardando(false);
    }
  }

  async function validar() {
    setErrorValidar(undefined);
    setValidando(true);
    try {
      const res = await fetch(`/api/estancias/${estanciaId}/presupuesto`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorValidar(data.error ?? "No se pudo validar.");
        return;
      }
      router.refresh();
    } catch {
      setErrorValidar("No se pudo conectar con el servidor.");
    } finally {
      setValidando(false);
    }
  }

  async function borrar() {
    if (
      !(await confirmar({
        titulo: "Borrar presupuesto",
        mensaje: "¿Borrar el presupuesto de esta estancia?",
        textoConfirmar: "Borrar",
        peligro: true,
      }))
    )
      return;
    setError(undefined);
    setGuardando(true);
    try {
      const res = await fetch(`/api/estancias/${estanciaId}/presupuesto`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo borrar el presupuesto.");
        return;
      }
      onGuardado(null);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-brand-navy/50 p-3 sm:p-4"
      onClick={onCerrar}
    >
      {/*
        La ventana se ajusta al alto de la pantalla y la única parte que
        scrollea es la lista de conceptos: así la cabecera y los totales de
        abajo se ven siempre, sin tener que mover la ventana entera.
      */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Calculadora de presupuesto"
        className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 px-5 py-3">
          <div>
            <h2 className="text-lg font-semibold text-brand-navy">
              Presupuesto
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {dias > 0
                ? contexto.fechaInicio && contexto.fechaFin
                  ? `${dias} día(s) y ${noches} noche(s) según las fechas de la estancia.`
                  : `${dias} día(s) y ${noches} noche(s) puestos a mano en la estancia (sin fechas).`
                : "La estancia no tiene fechas ni días puestos: pon los días a mano en cada línea."}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {/* Grupo */}
          <fieldset disabled={readOnly} className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Alumnos</span>
              <input
                type="number"
                min={0}
                value={numAlumnos}
                onChange={(e) => setNumAlumnos(Math.max(0, Number(e.target.value)))}
                className={inputNum}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Profesores</span>
              <input
                type="number"
                min={0}
                value={numProfesores}
                onChange={(e) =>
                  setNumProfesores(Math.max(0, Number(e.target.value)))
                }
                className={inputNum}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Monitores</span>
              <input
                type="number"
                min={0}
                value={numMonitores}
                onChange={(e) =>
                  setNumMonitores(Math.max(0, Number(e.target.value)))
                }
                className={inputNum}
              />
            </label>
            <p className="text-sm text-gray-500">
              <b className="tabular-nums text-gray-900">{pax}</b> persona(s):
              es la cantidad que se pone en todas las líneas. Los monitores no
              cuentan para el precio por persona.
            </p>
            {!readOnly && (
              <button
                type="button"
                onClick={rellenarConElGrupo}
                className="ml-auto rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                Devolver todas las cantidades al grupo
              </button>
            )}
          </fieldset>

          {/* Centros Novaschool que acogen el grupo */}
          <fieldset disabled={readOnly} className="mt-4">
            <span className="text-sm font-medium text-gray-700">
              Centros que acogen el grupo
            </span>
            <p className="text-xs text-gray-500">
              Solo alguien de uno de estos centros (que no sea quien lo
              preparó) puede aprobarlo antes de enviarlo.
            </p>
            <div className="mt-1.5 flex flex-wrap gap-4">
              {CENTROS_NOVASCHOOL.map((codigo) => (
                <label key={codigo} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={centrosNovaschool.includes(codigo)}
                    onChange={() => alternarCentro(codigo)}
                    className="h-4 w-4 accent-brand-navy"
                  />
                  {CENTRO_ASIGNADO_LABELS[codigo]}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Validación por una segunda persona */}
          {presupuesto && (
            <div
              className={`mt-4 rounded border px-3 py-2 text-sm ${
                presupuesto.validadoPor
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {presupuesto.validadoPor ? (
                <p>
                  ✓ Validado por <b>{presupuesto.validadoPor}</b> el{" "}
                  {new Date(presupuesto.validadoEn as string).toLocaleString("es-ES")}
                  .
                </p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    Pendiente de validar por alguien de uno de los centros
                    marcados arriba.
                  </p>
                  {/* Validar es una acción aparte de "editar el
                      presupuesto": alguien que no puede tocar el resto de la
                      estancia (p. ej. Marketing) puede seguir siendo quien
                      lo valida, si es de uno de los centros marcados. */}
                  {presupuesto.puedeValidar && (
                    <button
                      type="button"
                      onClick={validar}
                      disabled={validando}
                      className="shrink-0 rounded bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50"
                    >
                      {validando ? "Validando…" : "Dar el visto bueno"}
                    </button>
                  )}
                </div>
              )}
              {errorValidar && (
                <p className="mt-1 text-xs text-red-700" role="alert">
                  {errorValidar}
                </p>
              )}
            </div>
          )}

          {/* Conceptos */}
          <h3 className="mt-6 text-sm font-semibold text-gray-900">
            Conceptos
          </h3>
          <p className="text-xs text-gray-500">
            Marca lo que entre en la oferta. La cantidad viene con el grupo
            entero y se ajusta con las flechas; en los monitores es cuántos
            hacen falta, no personas.
          </p>
          <Tabla
            filas={CONCEPTOS.map((c) => ({
              codigo: c.codigo,
              nombre: c.nombre,
              nota: c.nota,
            }))}
            estado={filas}
            totalDeFila={totalDeFila}
            readOnly={readOnly}
            onCambio={actualizar}
          />

          {/* Autobuses */}
          <h3 className="mt-8 text-sm font-semibold text-gray-900">
            Autobuses y traslados
          </h3>
          <p className="text-xs text-gray-500">
            Precio neto por servicio. Aquí la cantidad son servicios, así que
            normalmente hay que bajarla a 1 o 2.
          </p>
          <Tabla
            filas={AUTOBUSES.map((a) => ({ codigo: a.codigo, nombre: a.nombre }))}
            estado={filas}
            totalDeFila={totalDeFila}
            readOnly={readOnly}
            sinDias
            onCambio={actualizar}
          />

          {/* Notas */}
          <label className="mt-8 flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">
              Notas del presupuesto
            </span>
            <textarea
              value={notas}
              disabled={readOnly}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Condiciones, lo que se pactó por teléfono, lo que queda fuera…"
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        {/* Totales y acciones */}
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-5 py-3">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-gray-500">Total neto</dt>
                <dd className="font-semibold tabular-nums text-gray-900">
                  {formatearEuros(totales.totalNeto)}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-gray-500">
                  Margen
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={margen}
                    disabled={readOnly}
                    onChange={(e) => setMargen(Number(e.target.value))}
                    className="w-14 rounded border border-gray-300 px-1 py-0.5 text-right text-xs tabular-nums"
                  />
                  %
                </dt>
                <dd className="font-semibold tabular-nums text-gray-900">
                  {formatearEuros(totales.margenImporte)}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-gray-500">
                  IVA
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={iva}
                    disabled={readOnly}
                    onChange={(e) => setIva(Number(e.target.value))}
                    className="w-14 rounded border border-gray-300 px-1 py-0.5 text-right text-xs tabular-nums"
                  />
                  %
                </dt>
                <dd className="font-semibold tabular-nums text-gray-900">
                  {formatearEuros(totales.ivaImporte)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Precio por persona</dt>
                <dd className="font-semibold tabular-nums text-gray-900">
                  {formatearEuros(totales.pvpPorPersona)}
                </dd>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-navy">
                  Total
                </dt>
                <dd className="text-xl font-semibold tabular-nums text-brand-navy">
                  {formatearEuros(totales.total)}
                </dd>
              </div>
            </dl>

            <div className="flex items-center gap-2">
              {presupuesto && !readOnly && (
                <button
                  type="button"
                  onClick={borrar}
                  disabled={guardando}
                  className="rounded border border-gray-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Borrar
                </button>
              )}
              <button
                type="button"
                onClick={onCerrar}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {readOnly ? "Cerrar" : "Cancelar"}
              </button>
              {!readOnly && (
                <button
                  type="button"
                  onClick={guardar}
                  disabled={guardando || incluidas === 0}
                  className="rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark disabled:opacity-50"
                  title={
                    incluidas === 0 ? "Marca al menos un concepto" : undefined
                  }
                >
                  {guardando ? "Guardando…" : "Guardar presupuesto"}
                </button>
              )}
            </div>
          </div>

          {incluidas === 0 ? (
            <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Los totales están a cero porque todavía no hay ninguna línea en
              la oferta. Marca en la tabla lo que entra, o cambia el precio,
              los días o la cantidad de una línea y se marcará sola.
            </p>
          ) : (
            <p className="mt-2 text-xs text-gray-500">
              {incluidas} línea(s) en la oferta. El IVA se aplica sobre el neto
              más el margen.
            </p>
          )}
          {error && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {presupuesto && (
            <p className="mt-1 text-xs text-gray-400">
              Última actualización:{" "}
              {new Date(presupuesto.actualizadoEn).toLocaleString("es-ES")}
              {presupuesto.actualizadoPor ? ` por ${presupuesto.actualizadoPor}` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
    {dialogoConfirmar}
    </>
  );
}

function Tabla({
  filas,
  estado,
  totalDeFila,
  readOnly,
  sinDias,
  onCambio,
}: {
  filas: { codigo: string; nombre: string; nota?: string }[];
  estado: Record<string, Fila>;
  totalDeFila: (codigo: string) => number;
  readOnly?: boolean;
  sinDias?: boolean;
  onCambio: (codigo: string, campo: keyof Fila, valor: number | boolean) => void;
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded border border-gray-200">
      <table className="w-full min-w-[38rem] text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Incluir</th>
            <th className="px-3 py-2 text-left font-medium">Concepto</th>
            <th className="px-3 py-2 text-right font-medium">Precio</th>
            {!sinDias && (
              <th className="px-3 py-2 text-right font-medium">Días</th>
            )}
            <th className="px-3 py-2 text-right font-medium">Cantidad</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const fila = estado[f.codigo];
            const incluida = fila?.incluida ?? false;
            const total = totalDeFila(f.codigo);
            return (
              <tr
                key={f.codigo}
                className={`border-t border-gray-100 ${incluida ? "bg-brand-navy/5" : ""}`}
              >
                <td className="px-3 py-1.5">
                  <input
                    type="checkbox"
                    checked={incluida}
                    disabled={readOnly}
                    onChange={(e) =>
                      onCambio(f.codigo, "incluida", e.target.checked)
                    }
                    aria-label={`Incluir ${f.nombre}`}
                    className="h-4 w-4 accent-brand-navy"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <span
                    className={incluida ? "font-medium text-gray-900" : "text-gray-700"}
                  >
                    {f.nombre}
                  </span>
                  {f.nota && (
                    <span className="block text-xs text-gray-400">{f.nota}</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={fila?.precioUnitario ?? 0}
                    disabled={readOnly}
                    onChange={(e) =>
                      onCambio(f.codigo, "precioUnitario", Number(e.target.value))
                    }
                    className={inputNum}
                    aria-label={`Precio de ${f.nombre}`}
                  />
                </td>
                {!sinDias && (
                  <td className="px-3 py-1.5 text-right">
                    <input
                      type="number"
                      min={0}
                      value={fila?.dias ?? 0}
                      disabled={readOnly}
                      onChange={(e) =>
                        onCambio(f.codigo, "dias", Math.floor(Number(e.target.value)))
                      }
                      className="w-16 rounded border border-gray-300 px-2 py-1 text-right text-sm tabular-nums"
                      aria-label={`Días de ${f.nombre}`}
                    />
                  </td>
                )}
                <td className="px-3 py-1.5 text-right">
                  <input
                    type="number"
                    min={0}
                    value={fila?.cantidad ?? 0}
                    disabled={readOnly}
                    onChange={(e) =>
                      onCambio(f.codigo, "cantidad", Math.floor(Number(e.target.value)))
                    }
                    className="w-16 rounded border border-gray-300 px-2 py-1 text-right text-sm tabular-nums"
                    aria-label={`Cantidad de ${f.nombre}`}
                  />
                </td>
                <td
                  className={`px-3 py-1.5 text-right tabular-nums ${incluida ? "font-medium text-gray-900" : "text-gray-400"}`}
                >
                  {formatearEuros(total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
