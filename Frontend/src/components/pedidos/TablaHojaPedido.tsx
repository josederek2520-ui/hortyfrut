"use client";
import { useTranslations } from "next-intl";
import ImagenProducto from "@/components/productos/ImagenProducto";
import { LockIcon } from "@/icons";
import {
  claseEntrada,
  type ProductoHoja,
  type CantidadesHoja,
  type ColumnaPedido,
} from "./tipos";

export default function TablaHojaPedido({
  productos,
  cantidades,
  errores,
  ocupado,
  alCambiar,
}: {
  productos: ProductoHoja[];
  cantidades: CantidadesHoja;
  errores: Record<string, string[]>;
  ocupado: boolean;
  alCambiar: (
    producto: ProductoHoja,
    columna: ColumnaPedido,
    valor: string,
  ) => void;
}) {
  const t = useTranslations("pedidos");
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-y border-gray-100 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
          <tr>
            <th rowSpan={2} scope="col" className="px-5 py-4 text-start">
              {t("producto")}
            </th>
            <th
              colSpan={2}
              scope="colgroup"
              className="px-3 py-3 text-center font-semibold text-brand-600 dark:text-brand-400"
            >
              {t("pedido")}
            </th>
            <th
              colSpan={2}
              scope="colgroup"
              className="bg-gray-100/70 px-3 py-3 text-center font-medium dark:bg-gray-800"
            >
              <span className="inline-flex items-center gap-2">
                <LockIcon className="size-3.5" />
                {t("recepcion")}
              </span>
            </th>
          </tr>
          <tr>
            {[false, true].flatMap((recepcion) =>
              ["cajas", "unidades"].map((columna) => (
                <th
                  key={`${recepcion}-${columna}`}
                  scope="col"
                  className={`w-36 px-3 pb-3 text-center text-xs font-medium ${recepcion ? "bg-gray-100/70 dark:bg-gray-800" : ""}`}
                >
                  {t(columna)}{" "}
                  <span className="block font-normal text-gray-400">
                    {columna === "cajas" ? "CANT" : "UNI"}
                  </span>
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {productos.map((producto) => {
            const elegida = cantidades[producto.id];
            return (
              <tr
                key={producto.id}
                className={
                  elegida &&
                  (Number(elegida.cajas) > 0 || Number(elegida.unidades) > 0)
                    ? "bg-brand-50/35 dark:bg-brand-500/5"
                    : ""
                }
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <ImagenProducto
                      origen={producto.imagen}
                      nombre={producto.nombre}
                    />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {producto.nombre}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {producto.categoria.nombre}
                      </p>
                    </div>
                  </div>
                </td>
                {(["cajas", "unidades"] as ColumnaPedido[]).map((columna) => {
                  const campo = `cantidad_${producto.id}_${columna}`,
                    error = errores[campo]?.join(" ");
                  const referencia =
                    elegida?.producto[columna] || producto[columna];
                  const disponible =
                    referencia?.disponible &&
                    referencia.id === producto[columna]?.id;
                  return (
                    <td key={columna} className="px-3 py-4 align-top">
                      <input
                        id={campo}
                        name={campo}
                        aria-label={t("cantidadProducto", {
                          producto: producto.nombre,
                          columna: t(columna),
                        })}
                        aria-invalid={!!error}
                        aria-describedby={`${campo}-ayuda`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={999999}
                        step={1}
                        value={elegida?.[columna] || ""}
                        disabled={
                          ocupado || (!disponible && !elegida?.[columna])
                        }
                        onChange={(evento) =>
                          alCambiar(producto, columna, evento.target.value)
                        }
                        placeholder="0"
                        className={`${claseEntrada} text-center tabular-nums ${error ? "!border-error-500 !bg-error-50 dark:!bg-error-500/10" : ""}`}
                      />
                      <p
                        id={`${campo}-ayuda`}
                        className={`mt-1.5 text-[11px] ${error ? "text-error-500" : "text-gray-400"}`}
                      >
                        {error ||
                          (!disponible
                            ? t("noDisponible")
                            : referencia?.nombre)}
                      </p>
                    </td>
                  );
                })}
                <td
                  colSpan={2}
                  className="bg-gray-50/70 px-4 text-center text-xs text-gray-400 dark:bg-gray-800/35"
                >
                  {t("alEntregar")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
