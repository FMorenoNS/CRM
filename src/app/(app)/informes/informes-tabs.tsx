"use client";

import { useState, type ReactNode } from "react";

export function InformesTabs({
  numeros,
  graficos,
}: {
  numeros: ReactNode;
  graficos: ReactNode;
}) {
  const [vista, setVista] = useState<"numeros" | "graficos">("numeros");

  return (
    <div>
      <div className="flex gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setVista("numeros")}
          className={`px-4 py-2 text-sm font-medium ${
            vista === "numeros"
              ? "border-b-2 border-brand-navy text-brand-navy"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Números
        </button>
        <button
          type="button"
          onClick={() => setVista("graficos")}
          className={`px-4 py-2 text-sm font-medium ${
            vista === "graficos"
              ? "border-b-2 border-brand-navy text-brand-navy"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Gráficos
        </button>
      </div>
      <div className="pt-6">
        <div hidden={vista !== "numeros"}>{numeros}</div>
        <div hidden={vista !== "graficos"}>{graficos}</div>
      </div>
    </div>
  );
}
