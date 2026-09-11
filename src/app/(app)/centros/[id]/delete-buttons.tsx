"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "@/app/(app)/confirm-dialog";

export function DeleteContactoButton({ contactoId }: { contactoId: string }) {
  const router = useRouter();
  const { confirmar, dialogo } = useConfirm();
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    if (!(await confirmar({ mensaje: "¿Eliminar este contacto?", peligro: true })))
      return;
    setIsPending(true);
    try {
      await fetch(`/api/contactos/${contactoId}`, { method: "DELETE" });
      router.refresh();
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
        Eliminar
      </button>
      {dialogo}
    </>
  );
}

export function DeleteCentroButton({ centroId }: { centroId: string }) {
  const router = useRouter();
  const { confirmar, dialogo } = useConfirm();
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    if (
      !(await confirmar({
        titulo: "Eliminar cliente",
        mensaje: "¿Eliminar este cliente? Se borrarán también sus contactos y estancias.",
        textoConfirmar: "Eliminar",
        peligro: true,
      }))
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
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-sm text-red-600 hover:underline disabled:opacity-50"
      >
        Eliminar cliente
      </button>
      {dialogo}
    </>
  );
}
