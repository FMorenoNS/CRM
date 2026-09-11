"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "@/app/(app)/confirm-dialog";

export function DeleteEstanciaButton({
  estanciaId,
  centroId,
}: {
  estanciaId: string;
  centroId?: string;
}) {
  const router = useRouter();
  const { confirmar, dialogo } = useConfirm();
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    if (
      !(await confirmar({
        titulo: "Eliminar estancia",
        mensaje: "¿Eliminar esta estancia y todo su historial?",
        textoConfirmar: "Eliminar",
        peligro: true,
      }))
    )
      return;
    setIsPending(true);
    try {
      const res = await fetch(`/api/estancias/${estanciaId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push(centroId ? `/centros/${centroId}` : "/estancias");
        router.refresh();
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-sm text-red-600 hover:underline disabled:opacity-50"
      >
        Eliminar estancia
      </button>
      {dialogo}
    </>
  );
}
