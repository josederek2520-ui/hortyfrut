"use client";
import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import { mostrarBolivianos } from "@/lib/moneda";
import { mostrarFechaVenta } from "@/components/ventas/calculosVenta";
import type { RevisionCobro as DatosRevision } from "./tipos";

export default function RevisionCobro({
  revision,
  ocupado,
  alCerrar,
  alConfirmar,
  supermercado = false,
}: {
  revision: DatosRevision;
  ocupado: boolean;
  alCerrar: () => void;
  alConfirmar: () => void;
  supermercado?: boolean;
}) {
  const t = useTranslations("cobros"),
    tp = useTranslations("pagos"),
    tc = useTranslations("comercialComun"),
    idioma = useLocale(),
    titulo = useId();
  const [pagina, establecerPagina] = useState(1);
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!ocupado) alCerrar();
      }}
      labelledBy={titulo}
      closeLabel={tc("cerrar")}
      className="max-w-3xl"
      showCloseButton={!ocupado}
    >
      <div className="flex max-h-[85dvh] flex-col">
        <header className="border-b border-gray-100 p-5 pe-14 dark:border-gray-800">
          <h2 id={titulo} className="text-xl font-semibold">
            {supermercado ? tp("revisarPago") : t("confirmarTitulo")}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {revision.cliente_nombre} ·{" "}
            {mostrarBolivianos(revision.importe, idioma)}
          </p>
          <p className="mt-2 text-sm">
            {supermercado ? tp("confirmarInformeAyuda") : t("confirmarAyuda")}
          </p>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">
                {t(supermercado ? "fechaPago" : "fecha")}
              </dt>
              <dd className="mt-1">
                {mostrarFechaVenta(revision.fecha_cobro, idioma)}
              </dd>
            </div>
            {revision.medio && (
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  {t("medio")}
                </dt>
                <dd className="mt-1">{t("medios." + revision.medio)}</dd>
              </div>
            )}
            {revision.comprobante && (
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">
                  {t("comprobante")}
                </dt>
                <dd className="mt-1 break-words">
                  {revision.comprobante.nombre}
                </dd>
              </div>
            )}
          </dl>
        </header>
        <div className="min-h-0 overflow-y-auto p-5">
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {revision.aplicaciones
              .slice((pagina - 1) * 10, pagina * 10)
              .map((fila) => (
                <li key={fila.venta} className="grid gap-3 py-4 sm:grid-cols-3">
                  <p className="font-semibold">{fila.codigo}</p>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t("aplicarImporte")}
                    </p>
                    <p className="mt-1 font-medium">
                      {mostrarBolivianos(fila.importe, idioma)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {supermercado
                        ? tp("saldoSiConfirma")
                        : t("saldoPosterior")}
                    </p>
                    <p className="mt-1 font-medium">
                      {mostrarBolivianos(fila.saldo_posterior, idioma)}
                    </p>
                  </div>
                </li>
              ))}
          </ul>
          {revision.aplicaciones.length > 10 && (
            <PaginadorPedidos
              pagina={pagina}
              total={revision.aplicaciones.length}
              alCambiar={establecerPagina}
              ocupado={ocupado}
            />
          )}
        </div>
        <footer className="flex flex-wrap justify-end gap-3 border-t border-gray-100 p-5 dark:border-gray-800">
          <Button variant="outline" disabled={ocupado} onClick={alCerrar}>
            {tc("volver")}
          </Button>
          <Button disabled={ocupado} onClick={alConfirmar}>
            {supermercado ? tp("enviarPago") : t("registrarCobro")}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
