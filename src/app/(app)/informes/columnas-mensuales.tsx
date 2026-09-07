// Tendencia en el tiempo: columnas, no barras horizontales (el tiempo va de
// izquierda a derecha). Un solo color, mismo criterio que BarraHorizontal:
// una sola serie no necesita paleta categórica.
export function ColumnasMensuales({
  items,
  formatValor = (v) => String(v),
}: {
  items: { etiqueta: string; valor: number }[];
  formatValor?: (v: number) => string;
}) {
  const max = Math.max(...items.map((i) => i.valor), 1);

  return (
    <div className="flex items-end gap-2" style={{ height: 160 }}>
      {items.map((i) => (
        <div key={i.etiqueta} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs font-medium tabular-nums text-gray-700">
            {formatValor(i.valor)}
          </span>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-[4px] bg-brand-navy"
              style={{
                height: `${Math.max((i.valor / max) * 100, i.valor > 0 ? 3 : 0)}%`,
              }}
              title={`${i.etiqueta}: ${formatValor(i.valor)}`}
            />
          </div>
          <span className="text-[10px] capitalize text-gray-500">{i.etiqueta}</span>
        </div>
      ))}
    </div>
  );
}
