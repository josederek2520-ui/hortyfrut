"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import ImagenProducto from "@/components/productos/ImagenProducto";
import PaginadorPedidos from "./PaginadorPedidos";
import type { Pedido } from "./tipos";
import { mostrarMedicion } from "@/components/entregas/calculosEntrega";

export default function ConsultaRecepcionPedido({
  pedido,
  alCerrar,
}: {
  pedido: Pedido;
  alCerrar: () => void;
}) {
  const t = useTranslations("entregas"),
    idioma = useLocale();
  const [datos, establecerDatos] = useState<Pedido | null>(null),
    [fallo, establecerFallo] = useState(false),
    [pagina, establecerPagina] = useState(1);
  useEffect(() => {
    const controlador = new AbortController();
    void api<Pedido>(`pedidos/${pedido.id}/`, { signal: controlador.signal })
      .then((datos) => {
        if (!controlador.signal.aborted) establecerDatos(datos);
      })
      .catch(() => {
        if (!controlador.signal.aborted) establecerFallo(true);
      });
    return () => controlador.abort();
  }, [pedido.id]);
  const productos = new Map<
    number,
    { nombre: string; imagen: string | null; cajas: number; unidades: number }
  >();
  for (const linea of datos?.detalles ?? []) {
    const producto = productos.get(linea.producto) ?? {
      nombre: linea.producto_nombre,
      imagen: linea.imagen,
      cajas: 0,
      unidades: 0,
    };
    producto[linea.columna] += linea.cantidad;
    productos.set(linea.producto, producto);
  }
  return (
    <Modal
      isOpen
      onClose={alCerrar}
      className="max-w-3xl"
      labelledBy="consulta-recepcion-pedido"
      closeLabel={t("salir")}
    >
      <div className="flex max-h-[88dvh] flex-col">
        <header className="border-b border-gray-100 p-5 pe-14 dark:border-gray-800">
          <h2
            id="consulta-recepcion-pedido"
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            {pedido.codigo} · {t("recibido")}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {pedido.cliente_nombre} · {pedido.sucursal_nombre}
          </p>
        </header>
        <div className="min-h-0 overflow-y-auto">
          {fallo ? (
            <p role="alert" className="p-5">
              {t("errorConsulta")}
            </p>
          ) : !datos ? (
            <p role="status" className="p-5">
              {t("cargando")}
            </p>
          ) : (
            <>
              <p className="p-5 text-xs text-gray-500 dark:text-gray-400">
                {t("recepcionConfirmadaAyuda")}
              </p>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {Array.from(productos)
                  .slice((pagina - 1) * 10, pagina * 10)
                  .map(([id, producto]) => {
                    const recibido = datos.recepcion_confirmada?.find(
                      (fila) => fila.producto === id,
                    );
                    return (
                      <div
                        key={id}
                        className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_1fr_1fr]"
                      >
                        <div className="flex items-center gap-3">
                          <ImagenProducto
                            origen={producto.imagen}
                            nombre={producto.nombre}
                            sinRecorte
                          />
                          <p className="font-medium text-gray-900 dark:text-white">
                            {producto.nombre}
                          </p>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          <p className="text-xs">{t("pedido")}</p>
                          {t("cantidadesPedido", {
                            cajas: producto.cajas,
                            unidades: producto.unidades,
                          })}
                        </div>
                        <div className="text-sm text-brand-700 dark:text-brand-300">
                          <p className="text-xs">{t("recepcionConfirmada")}</p>
                          {recibido ? (
                            <>
                              {t("cantidadesPedido", {
                                cajas: recibido.cajas,
                                unidades: recibido.unidades,
                              })}
                              <p>
                                {mostrarMedicion(recibido.peso_kg, idioma)} kg ·{" "}
                                {t("rechazado")}:{" "}
                                {mostrarMedicion(recibido.rechazado_kg, idioma)}{" "}
                                kg
                              </p>
                            </>
                          ) : (
                            <span className="text-gray-500">
                              {t("sinConfirmar")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
              {productos.size > 10 && (
                <PaginadorPedidos
                  pagina={pagina}
                  total={productos.size}
                  alCambiar={establecerPagina}
                />
              )}
            </>
          )}
        </div>
        <footer className="border-t border-gray-100 p-4 text-end dark:border-gray-800">
          <Button variant="outline" onClick={alCerrar}>
            {t("salir")}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
