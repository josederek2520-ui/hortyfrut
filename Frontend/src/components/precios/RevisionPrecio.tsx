"use client";
import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import { mostrarBolivianos } from "@/lib/moneda";
import type { FormularioPrecio } from "./tipos";

export default function RevisionPrecio({
  formulario,
  aceptar,
  ocupado,
  alCerrar,
  alConfirmar,
}: {
  formulario: FormularioPrecio;
  aceptar: boolean;
  ocupado: boolean;
  alCerrar: () => void;
  alConfirmar: () => void;
}) {
  const t = useTranslations("precios"),
    idioma = useLocale(),
    id = useId();
  const [pagina, establecerPagina] = useState(1);
  const fecha = (valor: string) =>
    new Date(valor + "T12:00:00").toLocaleDateString(idioma);
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!ocupado) alCerrar();
      }}
      labelledBy={id}
      closeLabel={t("cerrar")}
      className="max-w-2xl"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="border-b border-gray-100 p-5 pe-12 dark:border-gray-800">
          <h2
            id={id}
            className="text-xl font-semibold text-gray-900 dark:text-white"
          >
            {t(aceptar ? "aceptarPrecios" : "revisarPropuesta")}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t(aceptar ? "ayudaAceptar" : "ayudaRegistrar")}
          </p>
        </div>
        <div className="overflow-y-auto p-5 text-gray-900 dark:text-white">
          <p className="font-semibold">{formulario.cliente?.nombre}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {formulario.alcance === "periodo"
              ? fecha(formulario.desde) + " — " + fecha(formulario.hasta)
              : t("entregasSeleccionadas", {
                  total: formulario.entregas.length,
                })}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {t("productosAnotados", { total: formulario.lineas.length })}
          </p>
          <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
            {formulario.lineas
              .slice((pagina - 1) * 10, pagina * 10)
              .map((fila) => (
                <li
                  key={fila.producto}
                  className="flex items-center justify-between gap-4 py-4 text-sm"
                >
                  <span>{fila.producto_nombre}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {mostrarBolivianos(
                      fila.precio_kg.replace(",", "."),
                      idioma,
                    )}{" "}
                    / kg
                  </span>
                </li>
              ))}
          </ul>
          {formulario.lineas.length > 10 && (
            <PaginadorPedidos
              pagina={pagina}
              total={formulario.lineas.length}
              alCambiar={establecerPagina}
              ocupado={ocupado}
            />
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 p-5 dark:border-gray-800">
          <Button variant="outline" disabled={ocupado} onClick={alCerrar}>
            {t("volverRevisar")}
          </Button>
          <Button disabled={ocupado} onClick={alConfirmar}>
            {t(
              ocupado
                ? "procesando"
                : aceptar
                  ? "aceptarPrecios"
                  : "registrarPropuesta",
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
