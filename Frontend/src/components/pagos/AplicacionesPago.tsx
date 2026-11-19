"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import useConsultaComercial from "@/components/comercial/useConsultaComercial";
import { panelVenta } from "@/components/ventas/tipos";
import { mostrarBolivianos } from "@/lib/moneda";
import type { AplicacionPago, PaginaPagos } from "./tipos";
export default function AplicacionesPago({
  identificador,
  ruta,
}: {
  identificador: number;
  ruta: string;
}) {
  const t = useTranslations("pagos"),
    tc = useTranslations("comercialComun"),
    idioma = useLocale();
  const [pagina, establecerPagina] = useState(1);
  const consulta = useConsultaComercial<PaginaPagos<AplicacionPago>>(
    `${ruta}/${identificador}/aplicaciones/?pagina=${pagina}`,
  );
  if (!consulta.sesionValida) return null;
  return (
    <section className={panelVenta + " overflow-hidden"}>
      <h2 className="border-b border-gray-100 p-5 font-semibold dark:border-gray-800">
        {t("ventasDelPago")}
      </h2>
      {consulta.fallo ? (
        <div role="alert" className="space-y-3 p-5">
          <p>{tc("errorConsulta")}</p>
          <Button onClick={consulta.recargar}>{tc("reintentar")}</Button>
        </div>
      ) : !consulta.datos ? (
        <p role="status" className="p-8 text-center">
          {tc("cargando")}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {consulta.datos.results.map((fila) => (
              <li key={fila.venta} className="grid gap-4 p-5 sm:grid-cols-3">
                <p className="font-semibold">{fila.codigo}</p>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("abonoInformado")}
                  </p>
                  <p className="mt-1 font-semibold tabular-nums">
                    {mostrarBolivianos(fila.importe, idioma)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("saldoActual")}
                  </p>
                  <p className="mt-1 font-semibold tabular-nums">
                    {mostrarBolivianos(fila.saldo_actual, idioma)}
                  </p>
                </div>
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
    </section>
  );
}
