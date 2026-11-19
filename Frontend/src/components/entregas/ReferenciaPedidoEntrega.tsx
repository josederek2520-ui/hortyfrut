"use client";
import { useLocale, useTranslations } from "next-intl";
import ImagenProducto from "@/components/productos/ImagenProducto";
import type { ProductoEntrega } from "./tipos";

export default function ReferenciaPedidoEntrega({
  productos,
}: {
  productos: ProductoEntrega[];
}) {
  const t = useTranslations("entregas"),
    idioma = useLocale();
  const numero = new Intl.NumberFormat(idioma);
  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
      {productos.map((producto) => (
        <li key={producto.producto} className="flex items-center gap-3 py-4">
          <ImagenProducto
            origen={producto.imagen ?? null}
            nombre={producto.nombre}
            sinRecorte
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">{producto.nombre}</h3>
            <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
              {(["pedido_cajas", "pedido_unidades"] as const).map(
                (campo, indice) => (
                  <div key={campo}>
                    <dt className="text-xs text-gray-500 dark:text-gray-400">
                      {t(indice ? "unidades" : "cajas")}
                    </dt>
                    <dd className="mt-1 font-medium tabular-nums">
                      {producto[campo] === undefined
                        ? "—"
                        : numero.format(producto[campo])}
                    </dd>
                  </div>
                ),
              )}
            </dl>
          </div>
        </li>
      ))}
    </ul>
  );
}
