"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Plus as IconoAgregar, Trash2 as IconoQuitar } from "lucide-react";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import ImagenProducto from "@/components/productos/ImagenProducto";
import DesplegableCompra from "./DesplegableCompra";
import type { LineaFormularioCompra } from "./tipos";

export const columnasCompra =
  "lg:grid-cols-[minmax(12rem,1.3fr)_minmax(12rem,1fr)_minmax(10rem,.85fr)_6rem_9rem_2.75rem]";

export default function FilaCompra({
  linea,
  referenciaPedidos,
  indice,
  errores,
  deshabilitado,
  puedeAgregarProveedor,
  alCambiar,
  alAgregarProveedor,
  alQuitar,
  alError,
}: {
  linea: LineaFormularioCompra;
  referenciaPedidos: ReactNode;
  indice: number;
  errores: Record<string, string[]>;
  deshabilitado: boolean;
  puedeAgregarProveedor: boolean;
  alCambiar: (clave: string, cambio: Partial<LineaFormularioCompra>) => void;
  alAgregarProveedor: (linea: LineaFormularioCompra) => void;
  alQuitar: (clave: string) => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("compras");
  const campo = (nombre: string) => `detalle_${indice}_${nombre}`;
  return (
    <div
      role="row"
      className={`grid grid-cols-2 items-start gap-x-4 gap-y-4 px-5 py-4 transition-colors focus-within:bg-orange-25 lg:gap-x-3 dark:focus-within:bg-orange-500/5 ${columnasCompra}`}
    >
      <div role="cell" className="col-span-2 min-w-0 lg:col-span-1">
        <div className="flex min-h-11 items-center gap-3">
          <ImagenProducto
            origen={linea.producto.imagen || null}
            nombre={linea.producto.nombre}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-5 font-semibold break-words text-gray-900 dark:text-white">
              {linea.producto.nombre}
            </p>
            <span className="sr-only">
              {t("lineaNumero", { numero: indice + 1 })}
            </span>
            {!!errores[campo("producto")]?.length && (
              <p
                role="alert"
                className="mt-1 text-theme-xs text-error-500 dark:text-error-400"
              >
                {errores[campo("producto")].join(" ")}
              </p>
            )}
          </div>
        </div>
        <div className="ms-14 mt-1">{referenciaPedidos}</div>
      </div>
      <div
        role="cell"
        className="col-span-2 min-w-0 sm:col-span-1 lg:[&_label]:sr-only"
      >
        <DesplegableCompra
          tipo="proveedor"
          ruta={`compras/proveedores/?producto=${linea.producto.id}`}
          etiqueta={t("proveedor")}
          nombre={campo("proveedor")}
          valor={linea.proveedor}
          alElegir={(proveedor) => alCambiar(linea.clave, { proveedor })}
          alError={alError}
          deshabilitado={deshabilitado}
          opcionVacia={t("elegirProveedorHoja")}
          error={errores[campo("proveedor")]?.join(" ")}
        />
        <button
          type="button"
          disabled={deshabilitado || !puedeAgregarProveedor}
          onClick={() => alAgregarProveedor(linea)}
          aria-label={t("otroProveedor", { nombre: linea.producto.nombre })}
          className="mt-1 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-1 text-theme-xs font-medium text-brand-700 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-40 dark:text-brand-300 dark:hover:bg-brand-500/10"
        >
          <IconoAgregar className="size-3.5" aria-hidden="true" />
          {t("agregarOtroProveedor")}
        </button>
      </div>
      <div
        role="cell"
        className="col-span-2 min-w-0 sm:col-span-1 lg:col-span-1 lg:[&_label]:sr-only"
      >
        <DesplegableCompra
          tipo="presentacion"
          ruta={`compras/presentaciones/?producto=${linea.producto.id}`}
          etiqueta={t("presentacionCompra")}
          nombre={campo("presentacion")}
          valor={linea.presentacion}
          alElegir={(presentacion) => alCambiar(linea.clave, { presentacion })}
          alError={alError}
          deshabilitado={deshabilitado}
          opcionVacia={t("unidadBase", {
            unidad: linea.producto.unidad_nombre || "—",
          })}
          error={errores[campo("presentacion")]?.join(" ")}
        />
      </div>
      <div
        role="cell"
        className="min-w-0 lg:[&_label]:sr-only lg:[&_p:empty]:hidden"
      >
        <CampoDirectorio
          id={campo("cantidad")}
          name={campo("cantidad")}
          etiqueta={t("cantidadComprada")}
          inputMode="decimal"
          pattern="[0-9]{1,9}([.,][0-9]{1,3})?"
          maxLength={13}
          placeholder="—"
          value={linea.cantidad}
          disabled={deshabilitado}
          errores={errores[campo("cantidad")]}
          className="px-2! text-end tabular-nums"
          onChange={(evento) =>
            alCambiar(linea.clave, { cantidad: evento.target.value })
          }
          title={t("cantidadAyuda")}
        />
      </div>
      <div
        role="cell"
        className="min-w-0 lg:[&_label]:sr-only lg:[&_p:empty]:hidden"
      >
        <CampoDirectorio
          id={campo("importe_total")}
          name={campo("importe_total")}
          etiqueta={t("totalProductoPagado")}
          inputMode="decimal"
          pattern="[0-9]{1,12}([.,][0-9]{1,2})?"
          maxLength={15}
          placeholder="0.00"
          value={linea.importeTotal}
          disabled={deshabilitado}
          errores={errores[campo("importe_total")]}
          className="px-2! text-end tabular-nums"
          onChange={(evento) =>
            alCambiar(linea.clave, { importeTotal: evento.target.value })
          }
          title={t("ayudaTotalProducto")}
        />
      </div>
      <div role="cell" className="flex justify-end self-end lg:self-start">
        <button
          type="button"
          disabled={deshabilitado}
          onClick={() => alQuitar(linea.clave)}
          title={t("quitarProducto", { nombre: linea.producto.nombre })}
          aria-label={t("quitarProducto", { nombre: linea.producto.nombre })}
          className="inline-flex size-11 items-center justify-center rounded-xl text-gray-400 hover:bg-error-50 hover:text-error-600 focus-visible:ring-2 focus-visible:ring-error-400 disabled:opacity-40 dark:hover:bg-error-500/10 dark:hover:text-error-400"
        >
          <IconoQuitar className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
