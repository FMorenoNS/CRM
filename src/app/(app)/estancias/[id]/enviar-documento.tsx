"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export type DocumentoItem = {
  id: string;
  tipo: string;
  destinatario: string;
  enviadoEn: string;
  exito: boolean;
};

export function EnviarDocumento({
  estanciaId,
  emailConfigured,
  defaultEmail,
  documentos,
}: {
  estanciaId: string;
  emailConfigured: boolean;
  defaultEmail: string;
  documentos: DocumentoItem[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [ok, setOk] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setOk(false);
    setIsPending(true);
    const data = new FormData(event.currentTarget);
    const values = {
      tipo: (data.get("tipo") as string) ?? "PRESUPUESTO",
      destinatario: (data.get("destinatario") as string) ?? "",
    };
    try {
      const res = await fetch(`/api/estancias/${estanciaId}/enviar-documento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(result.error ?? "No se pudo enviar.");
        return;
      }
      setOk(true);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {documentos.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {documentos.map((d) => (
            <li key={d.id} className="text-gray-600">
              {d.tipo === "PRESUPUESTO" ? "Presupuesto" : "Contrato"} →{" "}
              {d.destinatario} ·{" "}
              {new Date(d.enviadoEn).toLocaleDateString("es-ES")}{" "}
              {d.exito ? (
                <span className="text-green-600">enviado</span>
              ) : (
                <span className="text-red-600">falló</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {!emailConfigured ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">Envío de correo no configurado todavía.</p>
          <p className="mt-1">
            Para enviar presupuestos y contratos por email, IT debe registrar
            una aplicación en Azure AD (Microsoft 365) con permiso{" "}
            <code>Mail.Send</code> y configurar las credenciales{" "}
            <code>AZURE_CLIENT_ID</code>, <code>AZURE_CLIENT_SECRET</code>,{" "}
            <code>AZURE_TENANT_ID</code> y <code>AZURE_SENDER_EMAIL</code>. En
            cuanto estén, este botón se activará automáticamente.
          </p>
          <button
            type="button"
            disabled
            className="mt-3 cursor-not-allowed rounded bg-gray-300 px-4 py-2 text-sm font-medium text-white"
          >
            Enviar documento (no disponible)
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex max-w-md flex-col gap-3 rounded border border-gray-200 bg-white p-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <select
              name="tipo"
              defaultValue="PRESUPUESTO"
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="PRESUPUESTO">Presupuesto</option>
              <option value="CONTRATO">Contrato</option>
            </select>
            <input
              name="destinatario"
              type="email"
              required
              defaultValue={defaultEmail}
              placeholder="Email destinatario"
              className="rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {ok && <p className="text-sm text-green-600">Documento enviado.</p>}
          <button
            type="submit"
            disabled={isPending}
            className="self-start rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark disabled:opacity-50"
          >
            {isPending ? "Enviando..." : "Enviar documento"}
          </button>
        </form>
      )}
    </div>
  );
}
