"use client";
import { useTranslations } from "next-intl";

export default function CantidadesPedidoPreparacion({
  cajas,
  unidades,
  solicitadas,
  destacadas = false,
}: {
  cajas?: number;
  unidades?: number;
  solicitadas?: { cajas?: number; unidades?: number };
  destacadas?: boolean;
}) {
  const t = useTranslations("preparaciones");
  // El cero pendiente sigue visible cuando esa medida sí fue solicitada.
  // Una referencia desconocida conserva el dato disponible sin suponer un cero.
  const filas = (
    [
      [cajas, solicitadas ? solicitadas.cajas : cajas, "cantidadCajasClara"],
      [
        unidades,
        solicitadas ? solicitadas.unidades : unidades,
        "cantidadUnidadesClara",
      ],
    ] as const
  ).filter(([cantidad, solicitada]) =>
    solicitada === undefined ? cantidad !== undefined : solicitada > 0,
  );
  if (!filas.length)
    return <span className="text-sm text-gray-500 dark:text-gray-400">—</span>;
  return (
    <div className="space-y-1.5 text-sm tabular-nums">
      {filas.map(([cantidad, , etiqueta]) => (
        <p key={etiqueta} className="flex items-baseline gap-2">
          <span
            className={`font-medium ${destacadas ? "text-orange-700 dark:text-orange-300" : "text-gray-800 dark:text-gray-100"}`}
          >
            {cantidad === undefined ? "—" : t(etiqueta, { cantidad })}
          </span>
        </p>
      ))}
    </div>
  );
}
