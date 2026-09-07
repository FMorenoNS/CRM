// Barra horizontal simple para comparar magnitudes entre categorías (un
// único valor por categoría: un solo color basta, no hace falta paleta
// categórica). Sin ejes ni cuadrícula: el valor va directo en la punta de
// la barra, que es más legible que un eje para una lista corta como esta.
export function BarraHorizontal({
  items,
  formatValor,
}: {
  items: { etiqueta: string; valor: number }[];
  formatValor: (v: number) => string;
}) {
  const max = Math.max(...items.map((i) => i.valor), 1);

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((i) => (
        <div key={i.etiqueta} className="flex items-center gap-3">
          <span className="w-36 shrink-0 truncate text-xs text-gray-600" title={i.etiqueta}>
            {i.etiqueta}
          </span>
          <div className="h-3.5 flex-1 rounded-sm bg-gray-50">
            <div
              className="h-full rounded-r-[4px] bg-brand-navy"
              style={{ width: `${Math.max((i.valor / max) * 100, i.valor > 0 ? 2 : 0)}%` }}
              title={`${i.etiqueta}: ${formatValor(i.valor)}`}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-xs font-medium tabular-nums text-gray-900">
            {formatValor(i.valor)}
          </span>
        </div>
      ))}
      {items.length === 0 && <p className="text-sm text-gray-500">Sin datos todavía.</p>}
    </div>
  );
}
