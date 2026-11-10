"use client";
import { useTranslations } from "next-intl";
import FilaRecepcionEntrega from "./FilaRecepcionEntrega";
import { lineaVacia } from "./calculosEntrega";
import type { ProductoEntrega, LineaEditable, CampoRecepcion } from "./tipos";

export default function TablaRecepcionEntrega({
  productos,
  lineas,
  errores,
  bloqueado,
  alCambiar,
  soloLectura = false,
}: {
  productos: ProductoEntrega[];
  lineas: Record<number, LineaEditable>;
  errores: Record<string, string[]>;
  bloqueado: boolean;
  alCambiar: (producto: number, campo: CampoRecepcion, valor: string) => void;
  soloLectura?: boolean;
}) {
  const t = useTranslations("entregas");
  const propiedades = (producto: ProductoEntrega) => ({
    producto,
    linea: lineas[producto.producto] ?? lineaVacia(),
    errores,
    bloqueado,
    soloLectura,
    alCambiar: (campo: CampoRecepcion, valor: string) =>
      alCambiar(producto.producto, campo, valor),
  });
  return (
    <div className="@container/recepcion">
      <div className="hidden overflow-x-auto @5xl/recepcion:block">
        <table className="w-full text-sm">
          <caption className="sr-only">{t("ayudaRecepcion")}</caption>
          <thead className="bg-gray-50 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            <tr>
              <th rowSpan={2} className="px-4 py-3 text-start" scope="col">
                {t("producto")}
              </th>
              <th colSpan={3} scope="colgroup" className="px-2 py-3">
                {t("enviado")}
              </th>
              <th
                colSpan={3}
                scope="colgroup"
                className="border-x border-brand-100 bg-brand-50 px-2 py-3 font-semibold text-brand-800 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-200"
              >
                {t("recibido")}
              </th>
              <th scope="col" className="px-2 py-3">
                {t("rechazado")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("aceptado")}
              </th>
            </tr>
            <tr>
              {[
                "cajas",
                "unidades",
                "kg",
                "cajas",
                "unidades",
                "kg",
                "kg",
                "kg",
              ].map((campo, i) => (
                <th scope="col" key={i} className="px-2 pb-3 font-normal">
                  {campo === "kg" ? "kg" : t(campo)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {productos.map((producto) => (
              <FilaRecepcionEntrega
                key={producto.producto}
                {...propiedades(producto)}
                modo="tabla"
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="@5xl/recepcion:hidden">
        {productos.map((producto) => (
          <FilaRecepcionEntrega
            key={producto.producto}
            {...propiedades(producto)}
            modo="tarjeta"
          />
        ))}
      </div>
    </div>
  );
}
