"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    setIsPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
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
      className="text-gray-500 hover:text-gray-900 disabled:opacity-50"
    >
      Cerrar sesión
    </button>
  );
}

/**
 * Cierra la sesión en todos los dispositivos a la vez. Es lo que hay que
 * pulsar si se sospecha que alguien más ha entrado con tu cuenta o si te has
 * dejado la sesión abierta en otro ordenador.
 */
export function LogoutAllButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    if (
      !window.confirm(
        "Se cerrará tu sesión en todos los dispositivos, incluido este. ¿Continuar?"
      )
    ) {
      return;
    }
    setIsPending(true);
    try {
      await fetch("/api/auth/logout-all", { method: "POST" });
      router.push("/login");
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
      className="text-left text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50"
    >
      Cerrar en todos los dispositivos
    </button>
  );
}
