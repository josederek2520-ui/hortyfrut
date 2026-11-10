"use client";
import { useTranslations } from "next-intl";
import { Check as IconoAgregado, Plus as IconoAgregar } from "lucide-react";
import ImagenProducto from "@/components/productos/ImagenProducto";
import type {
  NecesidadProducto,
  NecesidadSucursal,
  OpcionCompra,
} from "./tipos";

export default function ListaNecesidadesCompra({
  filas,
  productosAgregados,
  alAgregar,
  deshabilitado,
}: {
  filas: (NecesidadProducto | NecesidadSucursal)[];
  productosAgregados: Record<number, number>;
  alAgregar?: (producto: OpcionCompra) => void;
  deshabilitado: boolean;
}) {
  const t = useTranslations("compras");
  return (
    <ul className="custom-scrollbar divide-y divide-gray-100 overflow-y-auto 2xl:max-h-[max(18rem,calc(100dvh-27rem))] dark:divide-gray-800">
      {filas.map((fila) => {
        const resumen = "cajas" in fila;
        const producto = resumen ? fila.id : fila.producto;
        const nombre = resumen ? fila.nombre : fila.producto_nombre;
        const imagen = resumen ? fila.imagen : fila.producto_imagen;
        return (
          <li key={fila.id} className="py-3 first:pt-0 last:pb-1">
            {!resumen && (
              <p className="mb-2 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
                {fila.codigo} · {fila.cliente} · {fila.sucursal}
              </p>
            )}
            <div className="flex items-start gap-3">
              <ImagenProducto origen={imagen || null} nombre={nombre} />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-5 font-semibold break-words text-gray-900 dark:text-white">
                  {nombre}
                </p>
                <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-theme-xs text-gray-600 tabular-nums dark:text-gray-300">
                  {resumen ? (
                    <>
                      <span>
                        <strong className="font-semibold">{fila.cajas}</strong>{" "}
                        CANT
                      </span>
                      <span>
                        <strong className="font-semibold">
                          {fila.unidades}
                        </strong>{" "}
                        UNI
                      </span>
                    </>
                  ) : (
                    <span>
                      {fila.cantidad} · {fila.presentacion_nombre} ·{" "}
                      {fila.columna === "cajas" ? "CANT" : "UNI"}
                    </span>
                  )}
                </p>
                {!!productosAgregados[producto] && (
                  <p className="mt-1.5 flex items-center gap-1 text-theme-xs font-medium text-brand-700 dark:text-brand-300">
                    <IconoAgregado
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    {t("enLaCompra")}
                  </p>
                )}
                {resumen && !fila.disponible && (
                  <p className="mt-1.5 text-theme-xs text-warning-600 dark:text-warning-400">
                    {t("productoNoDisponible")}
                  </p>
                )}
              </div>
              {resumen && alAgregar && (
                <button
                  type="button"
                  disabled={
                    !fila.disponible ||
                    deshabilitado ||
                    !!productosAgregados[producto]
                  }
                  aria-label={t("agregarACompra", { nombre })}
                  title={t("agregarACompra", { nombre })}
                  onClick={() => alAgregar(fila)}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-700 hover:bg-brand-100 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-40 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
                >
                  <IconoAgregar className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
