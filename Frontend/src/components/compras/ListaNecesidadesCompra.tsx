"use client";
import { useTranslations } from "next-intl";
import { Check as IconoAgregado, Plus as IconoAgregar } from "lucide-react";
import Button from "@/components/ui/button/Button";
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
    <ul className="custom-scrollbar divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200 2xl:max-h-[max(16rem,calc(100dvh-34rem))] dark:divide-gray-800 dark:border-gray-800">
      {filas.map((fila) => (
        <li key={fila.id} className="space-y-3 p-3">
          {"cajas" in fila ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold break-words text-gray-900 dark:text-white">
                  {fila.nombre}
                </p>
                {alAgregar && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!fila.disponible || deshabilitado}
                    className="shrink-0 px-2.5!"
                    aria-label={t("agregarACompra", { nombre: fila.nombre })}
                    startIcon={<IconoAgregar className="size-4" />}
                    onClick={() => alAgregar(fila)}
                  >
                    {t("agregar")}
                  </Button>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/50">
                <div>
                  <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {t("cajas")}
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-800 tabular-nums dark:text-gray-100">
                    {fila.cajas}
                  </dd>
                </div>
                <div>
                  <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {t("unidades")}
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-800 tabular-nums dark:text-gray-100">
                    {fila.unidades}
                  </dd>
                </div>
              </dl>
              {!!productosAgregados[fila.id] && (
                <p className="flex items-center gap-1.5 text-theme-xs text-brand-700 dark:text-brand-300">
                  <IconoAgregado
                    className="size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  {t("yaAgregado", { cantidad: productosAgregados[fila.id] })}
                </p>
              )}
              {!fila.disponible && (
                <p className="text-theme-xs text-warning-600 dark:text-warning-400">
                  {t("productoNoDisponible")}
                </p>
              )}
            </>
          ) : (
            <>
              <div>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {fila.codigo} · {fila.cliente} · {fila.sucursal}
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                  {fila.producto_nombre}
                </p>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {fila.cantidad} · {fila.presentacion_nombre} ·{" "}
                {t(fila.columna === "cajas" ? "cajas" : "unidades")}
              </p>
              {!!productosAgregados[fila.producto] && (
                <p className="flex items-center gap-1.5 text-theme-xs text-brand-700 dark:text-brand-300">
                  <IconoAgregado className="size-3.5" aria-hidden="true" />
                  {t("yaAgregado", {
                    cantidad: productosAgregados[fila.producto],
                  })}
                </p>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
