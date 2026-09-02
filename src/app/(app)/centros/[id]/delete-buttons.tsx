"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteContactoButton({ contactoId }: { contactoId: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    if (!confirm("¿Eliminar este contacto?")) return;
    setIsPending(true);
    try {
      await fetch(`/api/contactos/${contactoId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      Eliminar
    </button>
  );
}

export function DeleteCentroButton({ centroId }: { centroId: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    if (
      !confirm(
        "¿Eliminar este cliente? Se borrarán también sus contactos y estancias."
      )
    )
      return;
    setIsPending(true);
    try {
      const res = await fetch(`/api/centros/${centroId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/centros");
        router.refresh();
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      Eliminar cliente
    </button>
  );
}
