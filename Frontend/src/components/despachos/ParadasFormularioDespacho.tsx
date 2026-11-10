"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import Paginador from "@/components/compras/PaginadorCompras";
import FilaParada from "./FilaParadaFormularioDespacho";
import type { CargaPreparada, CajillaCarga } from "./tipos";

export default function ParadasFormularioDespacho({
  orden,
  cargas,
  cajillas,
  almacen,
  alCajillas,
  alError,
  deshabilitado = false,
  revision = false,
  automaticas = false,
}: {
  orden: number[];
  cargas: CargaPreparada[];
  cajillas: CajillaCarga[];
  almacen: number;
  alCajillas: (filas: CajillaCarga[]) => void;
  alError: (error: unknown) => void;
  deshabilitado?: boolean;
  revision?: boolean;
  automaticas?: boolean;
}) {
  const t = useTranslations("despachos");
  const [pagina, establecerPagina] = useState(1);
  const paginaActual = Math.min(
    pagina,
    Math.max(1, Math.ceil(orden.length / 10)),
  );
  return (
    <div className="space-y-3">
      <div
        role="table"
        aria-label={t("rutaYCajillas")}
        className="@container/destinos divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-700"
      >
        <div
          role="rowgroup"
          className="hidden bg-gray-50 @2xl/destinos:block dark:bg-gray-800/40"
        >
          <div
            role="row"
            className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,.8fr)_minmax(0,1.2fr)] gap-5 px-4 py-2.5 text-theme-xs font-medium text-gray-500 dark:text-gray-400"
          >
            {[
              "destinoTransporteCompacto",
              "carga",
              "cajillasPrevistasTransporte",
            ].map((clave) => (
              <div role="columnheader" key={clave}>
                {t(clave)}
              </div>
            ))}
          </div>
        </div>
        {orden
          .slice((paginaActual - 1) * 10, paginaActual * 10)
          .map((sucursal) => (
            <FilaParada
              key={sucursal}
              sucursal={sucursal}
              cargas={cargas}
              cajillas={cajillas}
              almacen={almacen}
              alCajillas={alCajillas}
              alError={alError}
              deshabilitado={deshabilitado}
              revision={revision}
              automaticas={automaticas}
            />
          ))}
      </div>
      {orden.length > 10 && (
        <Paginador
          pagina={paginaActual}
          total={orden.length}
          alCambiar={establecerPagina}
        />
      )}
    </div>
  );
}
