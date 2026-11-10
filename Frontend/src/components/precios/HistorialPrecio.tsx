"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import Button from "@/components/ui/button/Button";
import useConsultaPaginada from "@/hooks/useConsultaPaginada";
import EstadoPrecio from "./EstadoPrecio";
import { panelPrecio, type AcuerdoPrecio } from "./tipos";
export default function HistorialPrecio({
  identificador,
}: {
  identificador: number;
}) {
  const t = useTranslations("precios"),
    idioma = useLocale();
  const [pagina, establecerPagina] = useState(1);
  const consulta = useConsultaPaginada<AcuerdoPrecio>(
    `precios-acordados/${identificador}/historial/?pagina=${pagina}`,
    () => establecerPagina(1),
  );
  return (
    <div className={panelPrecio + " p-5"}>
      <h2 className="text-lg font-semibold">{t("historial")}</h2>
      {consulta.fallo ? (
        <div role="alert" className="mt-3 space-y-2">
          <p>{t("errorConsulta")}</p>
          <Button variant="outline" onClick={consulta.recargar}>
            {t("reintentar")}
          </Button>
        </div>
      ) : !consulta.datos ? (
        <p role="status" className="py-5">
          {t("cargando")}
        </p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
            {consulta.datos.results.map((fila) => (
              <li
                key={fila.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <Link
                    className="inline-flex min-h-11 items-center rounded font-medium text-brand-700 underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300"
                    href={"/precios-acordados/" + fila.id}
                  >
                    {fila.codigo} ·{" "}
                    {t("version", { numero: fila.numero_version })}
                  </Link>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(fila.creado_en).toLocaleString(idioma)} ·{" "}
                    {fila.registrado_por_nombre}
                  </p>
                  {fila.motivo_version && (
                    <p className="mt-1 max-w-xl text-sm">
                      {fila.motivo_version}
                    </p>
                  )}
                </div>
                <EstadoPrecio estado={fila.estado} />
              </li>
            ))}
          </ul>
          {consulta.datos.count > 10 && (
            <PaginadorPedidos
              pagina={pagina}
              total={consulta.datos.count}
              alCambiar={establecerPagina}
            />
          )}
        </>
      )}
    </div>
  );
}
