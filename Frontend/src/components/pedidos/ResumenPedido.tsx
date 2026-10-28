"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import ImagenProducto from "@/components/productos/ImagenProducto";
import PaginadorPedidos from "./PaginadorPedidos";
import type { CantidadHoja } from "./tipos";

export default function ResumenPedido({
  lineas,
  sucursal,
  fecha,
  ocupado,
  alCerrar,
  alGuardar,
}: {
  lineas: CantidadHoja[];
  sucursal: string;
  fecha: string;
  ocupado: boolean;
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const t = useTranslations("pedidos");
  const [pagina, establecerPagina] = useState(1);
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!ocupado) alCerrar();
      }}
      labelledBy="titulo-resumen-pedido"
      closeLabel={t("cerrar")}
      className="max-w-3xl"
    >
      <div className="flex max-h-[90dvh] flex-col">
        <header className="border-b border-gray-100 p-6 pe-16 dark:border-gray-800">
          <h2
            id="titulo-resumen-pedido"
            className="text-xl font-semibold text-gray-900 dark:text-white"
          >
            {t("resumen")}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {sucursal} · {fecha}
          </p>
        </header>
        <div className="overflow-y-auto p-6">
          <p className="mb-4 text-sm text-gray-500">{t("resumenAyuda")}</p>
          <div className="space-y-2">
            {lineas.slice((pagina - 1) * 10, pagina * 10).map((linea) => (
              <div
                key={linea.producto.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800"
              >
                <ImagenProducto
                  nombre={linea.producto.nombre}
                  origen={linea.producto.imagen}
                />
                <span className="min-w-28 flex-1 text-sm font-medium text-gray-800 dark:text-white">
                  {linea.producto.nombre}
                </span>
                <span className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                  {t("cantidadCajas", { cantidad: Number(linea.cajas) || 0 })}
                </span>
                <span className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {t("cantidadUnidades", {
                    cantidad: Number(linea.unidades) || 0,
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
        <PaginadorPedidos
          pagina={pagina}
          total={lineas.length}
          alCambiar={establecerPagina}
          ocupado={ocupado}
        />
        <footer className="flex justify-end gap-3 border-t border-gray-100 p-5 dark:border-gray-800">
          <Button
            variant="outline"
            size="sm"
            disabled={ocupado}
            onClick={alCerrar}
          >
            {t("seguirEditando")}
          </Button>
          <Button size="sm" disabled={ocupado} onClick={alGuardar}>
            {t(ocupado ? "guardando" : "guardar")}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
