"use client";

/**
 * Pantalla que se muestra cuando algo falla al cargar una página. Enseña un
 * mensaje neutro y el código de referencia que Next.js genera (`digest`),
 * que es el que permite a IT encontrar el error completo en el registro del
 * servidor. Nunca se muestra el mensaje técnico del error.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-brand-navy">
          Algo no ha ido bien
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          No hemos podido cargar esta pantalla. Vuelve a intentarlo.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-gray-400">
            Si sigue pasando, avisa a IT con este código: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
