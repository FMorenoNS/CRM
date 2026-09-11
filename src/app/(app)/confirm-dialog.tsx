"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Opciones = {
  titulo?: string;
  mensaje: string;
  textoConfirmar?: string;
  /** Rojo en vez del azul de marca: para acciones que borran algo. */
  peligro?: boolean;
};

/**
 * Sustituto propio de `window.confirm()`: los diálogos nativos del
 * navegador rompen el estilo de la app (y en algunos navegadores ni
 * siquiera se pueden personalizar). Se usa igual que un `confirm()`
 * normal, pero async y devolviendo una promesa:
 *
 *   const { confirmar, dialogo } = useConfirm();
 *   if (!(await confirmar("¿Eliminar esto?"))) return;
 *   // ...
 *   return <>{contenido}{dialogo}</>;
 */
export function useConfirm() {
  const [opciones, setOpciones] = useState<Opciones | null>(null);
  const resolverRef = useRef<(valor: boolean) => void>(null);

  const confirmar = useCallback((opcionesOMensaje: Opciones | string) => {
    const o =
      typeof opcionesOMensaje === "string"
        ? { mensaje: opcionesOMensaje }
        : opcionesOMensaje;
    setOpciones(o);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const responder = useCallback((valor: boolean) => {
    setOpciones(null);
    resolverRef.current?.(valor);
  }, []);

  const dialogo = opciones ? (
    <ConfirmDialogUI
      {...opciones}
      onCancelar={() => responder(false)}
      onConfirmar={() => responder(true)}
    />
  ) : null;

  return { confirmar, dialogo };
}

function ConfirmDialogUI({
  titulo,
  mensaje,
  textoConfirmar = "Confirmar",
  peligro,
  onCancelar,
  onConfirmar,
}: Opciones & { onCancelar: () => void; onConfirmar: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancelar();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancelar]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-navy/50 p-4"
      onClick={onCancelar}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={titulo ?? "Confirmar"}
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {titulo && (
          <h2 className="text-base font-semibold text-gray-900">{titulo}</h2>
        )}
        <p className="mt-1 text-sm text-gray-700">{mensaje}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            autoFocus
            className={`rounded px-3 py-1.5 text-sm font-medium text-white ${
              peligro
                ? "bg-red-600 hover:bg-red-700"
                : "bg-brand-navy hover:bg-brand-navy-dark"
            }`}
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
