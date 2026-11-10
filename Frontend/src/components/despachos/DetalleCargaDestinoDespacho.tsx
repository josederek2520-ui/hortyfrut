"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Paginador from "@/components/compras/PaginadorCompras";
import EstadoConsulta from "@/components/logistica/EstadoConsultaLogistica";
import useConsulta from "./useConsultaListadoDespachos";
import type { CargaPreparada } from "./tipos";
import type { PaginaCargaDestino } from "./seleccionDestinosDespacho";
export default function DetalleCargaDestinoDespacho({
  ruta,
  filasElegidas,
  soloElegidas,
  seleccionadas,
  bloqueado,
  alAlternar,
  alError,
}: {
  ruta: string;
  filasElegidas: CargaPreparada[];
  soloElegidas: boolean;
  seleccionadas: CargaPreparada[];
  bloqueado: boolean;
  alAlternar: (fila: CargaPreparada) => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("despachos");
  const idioma = useLocale();
  const [pagina, establecerPagina] = useState(1);
  const consulta = useConsulta<PaginaCargaDestino>(
    soloElegidas ? null : ruta + "&pagina=" + pagina,
    alError,
  );
  const total = soloElegidas
    ? filasElegidas.length
    : consulta.datos?.count || 0;
  const paginaActual = Math.min(pagina, Math.max(1, Math.ceil(total / 10)));
  const filas = soloElegidas
    ? filasElegidas.slice((paginaActual - 1) * 10, paginaActual * 10)
    : consulta.datos?.results || [];
  if (!soloElegidas && (consulta.cargando || consulta.fallo))
    return (
      <EstadoConsulta
        cargando={consulta.cargando}
        fallo={consulta.fallo}
        alRecargar={() => {
          establecerPagina(1);
          consulta.recargar();
        }}
      />
    );
  return (
    <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        {t("ajustarProductosDestino")}
      </p>
      {!filas.length && (
        <p className="py-3 text-sm text-gray-500">{t("sinProductosDestino")}</p>
      )}
      {filas.map((fila) => (
        <label
          key={fila.id}
          className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-2 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40"
        >
          <input
            type="checkbox"
            checked={seleccionadas.some((actual) => actual.id === fila.id)}
            disabled={bloqueado}
            onChange={() => alAlternar(fila)}
            className="mt-1 size-5 shrink-0 accent-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
              {fila.producto_nombre}
            </span>
            <span className="mt-1 block text-theme-xs text-gray-500 dark:text-gray-400">
              {fila.codigo_preparacion} · {fila.presentacion_nombre}
            </span>
          </span>
          <span className="text-end text-sm text-gray-700 tabular-nums dark:text-gray-200">
            {t(
              fila.columna === "cajas"
                ? "cajasCargaValor"
                : "unidadesCargaValor",
              { cantidad: fila.cantidad },
            )}
            <span className="mt-1 block text-theme-xs text-gray-500 dark:text-gray-400">
              {new Intl.NumberFormat(idioma, {
                maximumFractionDigits: 3,
              }).format(Number(fila.peso_kg))}{" "}
              kg
            </span>
          </span>
        </label>
      ))}
      {total > 10 && (
        <Paginador
          pagina={paginaActual}
          total={total}
          ocupado={bloqueado || consulta.cargando}
          alCambiar={establecerPagina}
        />
      )}
    </div>
  );
}
