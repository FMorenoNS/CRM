"use client";

import { useState, type ReactNode } from "react";

type TabId = "resumen" | "estancia" | "participantes" | "historial";

const TABS: { id: TabId; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "estancia", label: "Estancia" },
  { id: "participantes", label: "Participantes" },
  { id: "historial", label: "Historial" },
];

// Cambia de pestaña sin volver a pedir datos al servidor (todo llega ya
// renderizado desde el server component padre, aquí solo se decide cuál se
// ve). La URL se actualiza con history.replaceState (no con el router de
// Next) para que se pueda enlazar/recargar en la misma pestaña sin que
// cada clic dispare una nueva carga de la página.
export function CentroTabs({
  tabInicial,
  resumen,
  estancia,
  participantes,
  historial,
}: {
  tabInicial: string;
  resumen: ReactNode;
  estancia: ReactNode;
  participantes: ReactNode;
  historial: ReactNode;
}) {
  const inicial = TABS.some((t) => t.id === tabInicial) ? (tabInicial as TabId) : "resumen";
  const [activa, setActiva] = useState<TabId>(inicial);

  function seleccionar(tab: TabId) {
    setActiva(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url);
  }

  const contenido: Record<TabId, ReactNode> = { resumen, estancia, participantes, historial };

  return (
    <div>
      {/* Las pestañas no caben en una pantalla de móvil: se desplazan de
          lado en su propia franja, sin arrastrar la página. */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => seleccionar(tab.id)}
            aria-current={activa === tab.id}
            className={`shrink-0 whitespace-nowrap rounded-t px-3 py-2 text-sm font-medium sm:px-4 ${
              activa === tab.id
                ? "border-b-2 border-brand-navy text-brand-navy"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-6">
        {TABS.map((tab) => (
          <div key={tab.id} hidden={activa !== tab.id}>
            {contenido[tab.id]}
          </div>
        ))}
      </div>
    </div>
  );
}
