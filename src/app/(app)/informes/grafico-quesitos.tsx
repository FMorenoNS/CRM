// Quesitos (pie): part-to-whole de pocas categorías. Con leyenda siempre
// (dos o más series no se distinguen solo por color) y valor + porcentaje
// al lado de cada una, en vez de etiquetas encima de cada porción.
export function GraficoQuesitos({
  items,
}: {
  items: { etiqueta: string; valor: number; color: string }[];
}) {
  const total = items.reduce((suma, i) => suma + i.valor, 0);

  let acumulado = 0;
  const stops = items
    .filter((i) => i.valor > 0)
    .map((i) => {
      const inicio = (acumulado / total) * 100;
      acumulado += i.valor;
      const fin = (acumulado / total) * 100;
      return `${i.color} ${inicio}% ${fin}%`;
    })
    .join(", ");

  return (
    <div className="flex items-center gap-6">
      <div
        className="h-32 w-32 shrink-0 rounded-full bg-gray-50"
        style={total > 0 ? { background: `conic-gradient(${stops})` } : undefined}
        role="img"
        aria-label={items.map((i) => `${i.etiqueta}: ${i.valor}`).join(", ")}
      />
      <ul className="flex flex-col gap-2 text-sm">
        {items.map((i) => (
          <li key={i.etiqueta} className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: i.color }}
              aria-hidden
            />
            <span className="text-gray-700">{i.etiqueta}</span>
            <span className="ml-auto pl-4 tabular-nums text-gray-500">
              {i.valor}
              {total > 0 ? ` (${Math.round((i.valor / total) * 100)}%)` : ""}
            </span>
          </li>
        ))}
        {total === 0 && <li className="text-gray-500">Sin datos todavía.</li>}
      </ul>
    </div>
  );
}
