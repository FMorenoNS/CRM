"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function CambiarPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const data = new FormData(event.currentTarget);
    const nueva = (data.get("nueva") as string) ?? "";
    const repetir = (data.get("repetir") as string) ?? "";

    if (nueva !== repetir) {
      setError("Las dos contraseñas nuevas no coinciden.");
      return;
    }

    setIsPending(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actual: (data.get("actual") as string) ?? "",
          nueva,
        }),
      });
      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(result.error ?? "No se pudo cambiar la contraseña.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">Contraseña actual</span>
        <input
          name="actual"
          type="password"
          required
          autoComplete="current-password"
          className="rounded border border-gray-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">Contraseña nueva</span>
        <input
          name="nueva"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="rounded border border-gray-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">Repite la nueva</span>
        <input
          name="repetir"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="rounded border border-gray-300 px-3 py-2"
        />
      </label>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark disabled:opacity-50"
      >
        {isPending ? "Guardando..." : "Guardar contraseña"}
      </button>
    </form>
  );
}
