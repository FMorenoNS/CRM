"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";

const PLANTILLA_DEFECTO = `Hello,

We saw your message about looking for an Erasmus+ mobility placement. We are Novaschool, and we host student and teacher groups in our own residence in Granada (Spain).

We would love to tell you more about our programme. Could we arrange a quick call or exchange a few messages?

Best regards,
Novaschool`;

export type CaptacionData = {
  grupoUrl: string | null;
  perfilUrl: string | null;
  capturaBase64: string | null;
  mensajeContacto: string | null;
  exists: boolean;
};

export function CaptacionFacebook({
  estanciaId,
  data,
}: {
  estanciaId: string;
  data: CaptacionData;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(!data.exists);
  const [grupoUrl, setGrupoUrl] = useState(data.grupoUrl ?? "");
  const [perfilUrl, setPerfilUrl] = useState(data.perfilUrl ?? "");
  const [captura, setCaptura] = useState<string | null>(data.capturaBase64);
  const [mensaje, setMensaje] = useState(
    data.mensajeContacto ?? PLANTILLA_DEFECTO
  );
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [isPending, setIsPending] = useState(false);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3_500_000) {
      setError("La captura es demasiado grande (máx. 3,5 MB).");
      return;
    }
    setError(undefined);
    const reader = new FileReader();
    reader.onload = () => setCaptura(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function save() {
    setError(undefined);
    setIsPending(true);
    try {
      const res = await fetch(`/api/estancias/${estanciaId}/captacion`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grupoUrl,
          perfilUrl,
          capturaBase64: captura ?? "",
          mensajeContacto: mensaje,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(result.error ?? "No se pudo guardar.");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setIsPending(false);
    }
  }

  async function copiar() {
    await navigator.clipboard.writeText(mensaje);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const box =
    "rounded-lg border border-brand-navy/20 bg-brand-navy/5 p-4 flex flex-col gap-3";

  function LinkRow({ label, url }: { label: string; url: string }) {
    return (
      <div>
        <p className="text-xs font-medium text-gray-500">{label}</p>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-navy hover:underline break-all"
          >
            {url}
          </a>
        ) : (
          <p className="text-sm text-gray-400">Sin URL.</p>
        )}
      </div>
    );
  }

  if (!editing) {
    return (
      <div className={box}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-brand-navy">
            📌 Captación: mensaje encontrado en Facebook
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm text-brand-navy hover:underline"
          >
            Editar
          </button>
        </div>

        <LinkRow label="Grupo de Facebook" url={grupoUrl} />
        <LinkRow label="Perfil" url={perfilUrl} />

        <div>
          <p className="text-xs font-medium text-gray-500">
            Captura del mensaje
          </p>
          {captura ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={captura}
              alt="Captura del mensaje de Facebook"
              className="mt-1 max-h-80 rounded border border-gray-200"
            />
          ) : (
            <p className="text-sm text-gray-400">Sin captura.</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">
              Mensaje de contacto
            </p>
            <button
              type="button"
              onClick={copiar}
              className="text-xs text-brand-navy hover:underline"
            >
              {copied ? "¡Copiado!" : "Copiar"}
            </button>
          </div>
          <p className="mt-1 whitespace-pre-wrap rounded border border-gray-200 bg-white p-3 text-sm text-gray-700">
            {mensaje}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={box}>
      <p className="text-sm font-semibold text-brand-navy">
        📌 Captación: mensaje encontrado en Facebook
      </p>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">
          URL del grupo de Facebook
        </label>
        <input
          type="url"
          value={grupoUrl}
          onChange={(e) => setGrupoUrl(e.target.value)}
          placeholder="https://www.facebook.com/groups/..."
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">
          URL del perfil que publicó el mensaje
        </label>
        <input
          type="url"
          value={perfilUrl}
          onChange={(e) => setPerfilUrl(e.target.value)}
          placeholder="https://www.facebook.com/..."
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">
          Captura de pantalla del mensaje
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-48 w-48 flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-white text-gray-400 transition-colors hover:border-brand-navy/60 hover:text-brand-navy"
        >
          {captura ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={captura}
              alt="Vista previa de la captura"
              className="h-full w-full object-cover"
            />
          ) : (
            <>
              <span className="text-3xl leading-none">+</span>
              <span className="text-xs">Insertar imagen</span>
            </>
          )}
        </button>
        {captura && (
          <button
            type="button"
            onClick={() => setCaptura(null)}
            className="self-start text-xs text-red-600 hover:underline"
          >
            Quitar imagen
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">
          Mensaje de contacto (editable)
        </label>
        <textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          rows={8}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Guardar captación"}
        </button>
        {data.exists && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
