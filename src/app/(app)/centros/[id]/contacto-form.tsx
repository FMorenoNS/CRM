"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ContactoForm({ centroId }: { centroId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = {
      nombre: (data.get("nombre") as string) ?? "",
      cargo: (data.get("cargo") as string) ?? "",
      telefono: (data.get("telefono") as string) ?? "",
      email: (data.get("email") as string) ?? "",
    };

    try {
      const res = await fetch(`/api/centros/${centroId}/contactos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(result.error ?? "No se pudo añadir el contacto.");
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

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded border border-gray-200 bg-white p-4"
    >
      <p className="text-sm font-medium text-gray-700">Añadir contacto</p>
      <div className="grid grid-cols-2 gap-3">
        <input
          name="nombre"
          placeholder="Nombre"
          required
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          name="cargo"
          placeholder="Cargo (opcional)"
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          name="telefono"
          placeholder="Teléfono"
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
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
        {isPending ? "Añadiendo..." : "Añadir contacto"}
      </button>
    </form>
  );
}
