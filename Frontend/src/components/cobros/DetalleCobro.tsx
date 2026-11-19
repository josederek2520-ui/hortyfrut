"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import useConsultaComercial from "@/components/comercial/useConsultaComercial";
import { panelVenta, enlaceVenta } from "@/components/ventas/tipos";
import { mostrarFechaVenta } from "@/components/ventas/calculosVenta";
import { mostrarBolivianos } from "@/lib/moneda";
import type { AplicacionCobro, Cobro, PaginaCobros } from "./tipos";
import DescargarComprobanteCobro from "./DescargarComprobanteCobro";

export default function DetalleCobro({
  identificador,
  puedeVerVentas,
}: {
  identificador: number;
  puedeVerVentas: boolean;
}) {
  const t = useTranslations("cobros"),
    tc = useTranslations("comercialComun"),
    idioma = useLocale();
  const [pagina, establecerPagina] = useState(1),
    consulta = useConsultaComercial<Cobro>(`cobros/${identificador}/`);
  const aplicaciones = useConsultaComercial<PaginaCobros<AplicacionCobro>>(
    `cobros/${identificador}/aplicaciones/?pagina=${pagina}`,
  );
  if (!consulta.sesionValida) return <p role="alert">{tc("sinAcceso")}</p>;
  if (consulta.fallo)
    return (
      <div role="alert" className="space-y-3">
        <p>{tc("errorConsulta")}</p>
        <Button onClick={consulta.recargar}>{tc("reintentar")}</Button>
        <Link href="/cobros" className={enlaceVenta}>
          {tc("volver")}
        </Link>
      </div>
    );
  if (!consulta.datos) return <p role="status">{tc("cargando")}</p>;
  const cobro = consulta.datos;
  return (
    <section className="space-y-5 text-gray-900 dark:text-white">
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/cobros" className={enlaceVenta}>
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {tc("volver")}
        </Link>
        <h1 className="text-2xl font-semibold">{cobro.codigo}</h1>
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          <CheckCircle2 className="size-4" />
          {t("registrado")}
        </span>
      </header>
      <div
        className={panelVenta + " grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4"}
      >
        {[
          ["supermercado", cobro.cliente_nombre],
          ["fecha", mostrarFechaVenta(cobro.fecha_cobro, idioma)],
          ["medio", t("medios." + cobro.medio)],
          ["importeRecibido", mostrarBolivianos(cobro.importe, idioma)],
          ...(cobro.referencia ? [["referencia", cobro.referencia]] : []),
          ["registradoPor", cobro.registrado_por_nombre],
        ].map(([clave, valor]) => (
          <div key={clave}>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t(clave)}
            </p>
            <p className="mt-2 font-medium break-words">{valor}</p>
          </div>
        ))}
      </div>
      {cobro.comprobante && (
        <div
          className={
            panelVenta +
            " flex flex-wrap items-center justify-between gap-4 p-5"
          }
        >
          <div className="min-w-0">
            <h2 className="font-semibold">{t("comprobante")}</h2>
            <p className="mt-1 text-sm break-words text-gray-500 dark:text-gray-400">
              {cobro.comprobante.nombre}
            </p>
          </div>
          <DescargarComprobanteCobro key={cobro.id} cobro={cobro} />
        </div>
      )}
      <div className={panelVenta + " overflow-hidden"}>
        <h2 className="border-b border-gray-100 p-5 font-semibold dark:border-gray-800">
          {t("aplicacionesRegistradas")}
        </h2>
        {aplicaciones.fallo ? (
          <div role="alert" className="p-5">
            <p>{tc("errorConsulta")}</p>
            <Button onClick={aplicaciones.recargar}>{tc("reintentar")}</Button>
          </div>
        ) : !aplicaciones.datos ? (
          <p role="status" className="p-5">
            {tc("cargando")}
          </p>
        ) : (
          <>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {aplicaciones.datos.results.map((fila) => (
                <li key={fila.venta} className="grid gap-4 p-5 sm:grid-cols-4">
                  <div>
                    {puedeVerVentas ? (
                      <Link
                        className={enlaceVenta}
                        href={"/ventas/" + fila.venta}
                      >
                        {fila.codigo}
                      </Link>
                    ) : (
                      <p className="font-medium">{fila.codigo}</p>
                    )}
                  </div>
                  {(
                    [
                      ["aplicarImporte", fila.importe],
                      ["saldoAnterior", fila.saldo_anterior],
                      ["saldoPosterior", fila.saldo_posterior],
                    ] as const
                  ).map(([clave, valor]) => (
                    <div key={clave}>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t(clave)}
                      </p>
                      <p className="mt-1 font-semibold tabular-nums">
                        {mostrarBolivianos(valor, idioma)}
                      </p>
                    </div>
                  ))}
                </li>
              ))}
            </ul>
            {aplicaciones.datos.count > 10 && (
              <PaginadorPedidos
                pagina={pagina}
                total={aplicaciones.datos.count}
                alCambiar={establecerPagina}
              />
            )}
          </>
        )}
        <p className="border-t border-gray-100 p-5 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
          {t("historialConservado")}
        </p>
      </div>
    </section>
  );
}
