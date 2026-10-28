"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  RotateCcw as IconoLimpiar,
  Trash2 as IconoQuitar,
  ChevronDown as IconoMas,
} from "lucide-react";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import CampoFecha from "@/components/form/CampoFecha";
import Label from "@/components/form/Label";
import DesplegableCompra from "@/components/compras/DesplegableCompra";
import { aMilesRecepcion, mismaUnidadRecepcion } from "./calculos";
import type { LineaRecepcion, UnidadRecepcion } from "./tipos";

export const columnasRecepcion =
  "xl:grid-cols-[minmax(9rem,1.4fr)_7rem_8rem_minmax(12rem,1.5fr)_7rem_7rem]";
export const columnasRecepcionDirecta =
  "xl:grid-cols-[minmax(12rem,1.5fr)_minmax(16rem,2fr)_7rem]";

export default function LineaFormularioRecepcion({
  linea,
  indice,
  vinculada,
  fecha,
  ocupado,
  errores,
  alCambiar,
  alEliminar,
  alError,
  anotada = true,
}: {
  linea: LineaRecepcion;
  indice: number;
  vinculada: boolean;
  fecha: string;
  ocupado: boolean;
  errores: Record<string, string[]>;
  anotada?: boolean;
  alCambiar: (cambios: Partial<LineaRecepcion>) => void;
  alEliminar: () => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("recepciones");
  const idioma = useLocale();
  const [masDatos, establecerMasDatos] = useState(false);
  const nombre = (campo: string) =>
    indice >= 0
      ? `detalle_${indice}_${campo}`
      : `pendiente_${linea.detalleCompra}_${campo}`;
  const misma = mismaUnidadRecepcion(linea);
  const pendiente =
    linea.pendiente === undefined ? null : aMilesRecepcion(linea.pendiente, 9);
  const recibido = aMilesRecepcion(linea.cantidadCompra, 9);
  const excede =
    pendiente !== null && recibido !== null && recibido > pendiente;
  const numero = (miles: bigint | null) =>
    miles === null
      ? "—"
      : new Intl.NumberFormat(idioma, { maximumFractionDigits: 3 }).format(
          Number(miles) / 1000,
        );
  const deshabilitado = ocupado || (!anotada && linea.disponible === false);
  const errorOpcional =
    !!errores[nombre("peso_kg")]?.length ||
    !!errores[nombre("fecha_vencimiento")]?.length;
  const mostrarMas = masDatos || errorOpcional;
  const erroresInventario = [
    ...(errores[nombre("cantidad_inventario")] || []),
    ...(misma ? errores[nombre("cantidad_compra")] || [] : []),
  ];
  const campoNumero = (
    campo: string,
    etiqueta: string,
    valor: string,
    problemas: string[] = errores[nombre(campo)] || [],
  ) => (
    <CampoDirectorio
      id={nombre(campo)}
      name={nombre(campo)}
      etiqueta={etiqueta}
      inputMode="decimal"
      pattern={
        campo === "cantidad_compra"
          ? "[0-9]{1,9}([.,][0-9]{1,3})?"
          : "[0-9]{1,11}([.,][0-9]{1,3})?"
      }
      maxLength={campo === "cantidad_compra" ? 13 : 15}
      value={valor}
      placeholder="0"
      disabled={deshabilitado}
      errores={problemas}
      onChange={(evento) =>
        alCambiar(
          campo === "cantidad_compra"
            ? { cantidadCompra: evento.target.value }
            : campo === "peso_kg"
              ? { pesoKg: evento.target.value }
              : { cantidadInventario: evento.target.value },
        )
      }
    />
  );
  return (
    <article
      role="row"
      className={`grid grid-cols-2 items-start gap-4 border-t border-gray-100 p-4 focus-within:bg-orange-25 xl:gap-3 dark:border-gray-800 dark:focus-within:bg-orange-500/5 ${vinculada ? columnasRecepcion : columnasRecepcionDirecta}`}
    >
      <div role="cell" className="col-span-2 min-w-0 xl:col-span-1 xl:pt-2">
        <h3 className="text-sm font-semibold break-words text-gray-900 dark:text-white">
          {linea.producto.nombre}
        </h3>
        {linea.proveedorNombre && (
          <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
            {linea.proveedorNombre}
          </p>
        )}
        {!anotada && linea.disponible === false && (
          <p className="mt-1 text-theme-xs text-warning-600 dark:text-warning-400">
            {t("productoNoDisponible")}
          </p>
        )}
        {["producto", "detalle_compra"].map((campo) =>
          errores[nombre(campo)]?.length ? (
            <p
              role="alert"
              key={campo}
              className="mt-1 text-theme-xs text-error-500 dark:text-error-400"
            >
              {errores[nombre(campo)].join(" ")}
            </p>
          ) : null,
        )}
      </div>
      {vinculada && (
        <>
          <div role="cell" className="xl:pt-2">
            <span className="mb-1 block text-theme-xs text-gray-500 xl:sr-only dark:text-gray-400">
              {t("faltaRecibir")}
            </span>
            <p className="text-sm font-medium text-gray-700 tabular-nums dark:text-gray-200">
              {numero(pendiente)} {linea.medidaCompra}
            </p>
          </div>
          <div role="cell" className="min-w-0">
            {vinculada ? (
              <div className="xl:[&_label]:sr-only">
                {campoNumero(
                  misma ? "cantidad_inventario" : "cantidad_compra",
                  t("llegoHoyMedida", { medida: linea.medidaCompra }),
                  misma ? linea.cantidadInventario : linea.cantidadCompra,
                  misma
                    ? erroresInventario
                    : errores[nombre("cantidad_compra")],
                )}
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {linea.medidaCompra}
                </p>
              </div>
            ) : (
              <p className="text-theme-xs text-gray-500 xl:pt-3 dark:text-gray-400">
                {t("sinCompra")}
              </p>
            )}
          </div>
        </>
      )}
      <div role="cell" className="col-span-2 min-w-0 xl:col-span-1">
        <div className="flex items-start gap-2">
          {!vinculada || !misma ? (
            <div className="min-w-0 flex-1 xl:[&_label]:sr-only">
              {campoNumero(
                "cantidad_inventario",
                t(linea.unidad.es_kg ? "pesoRecibido" : "cantidadParaAlmacen"),
                linea.cantidadInventario,
                erroresInventario,
              )}
            </div>
          ) : (
            <p className="flex-1 pt-3 text-theme-xs text-gray-500 dark:text-gray-400">
              {t("mismaCantidad")}
            </p>
          )}
          <div className="w-25 min-w-0 shrink-0 xl:[&_label]:sr-only">
            <DesplegableCompra<UnidadRecepcion>
              tipo="general"
              ruta={`recepciones/unidades/?producto=${linea.producto.id}`}
              etiqueta={t("medirEn")}
              nombre={nombre("unidad_inventario")}
              valor={{ ...linea.unidad, nombre: linea.unidad.abreviatura }}
              error={errores[nombre("unidad_inventario")]?.join(" ")}
              deshabilitado={deshabilitado}
              alError={alError}
              descripcion={(unidad) => unidad.abreviatura}
              alElegir={(unidad) => {
                if (unidad) alCambiar({ unidad });
              }}
            />
          </div>
        </div>
        {!misma && vinculada && (
          <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
            {t(linea.unidad.es_kg ? "pesarCantidad" : "medirCantidad")}
          </p>
        )}
      </div>
      {vinculada && (
        <div role="cell" className="xl:pt-2">
          <span className="mb-1 block text-theme-xs text-gray-500 xl:sr-only dark:text-gray-400">
            {t("quedaPendiente")}
          </span>
          <p
            className={`text-sm font-medium tabular-nums ${excede ? "text-error-600 dark:text-error-400" : "text-gray-700 dark:text-gray-200"}`}
          >
            {excede
              ? t("superaPendiente")
              : `${numero(pendiente !== null && recibido !== null ? pendiente - recibido : null)} ${linea.medidaCompra}`}
          </p>
        </div>
      )}
      <div
        role="cell"
        className="flex flex-wrap items-center justify-end gap-1"
      >
        <button
          type="button"
          disabled={deshabilitado}
          onClick={() => establecerMasDatos(!mostrarMas)}
          aria-expanded={mostrarMas}
          aria-controls={`extras-${linea.clave}`}
          className="inline-flex min-h-10 items-center gap-1 rounded-lg px-1 text-theme-xs font-medium text-gray-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-300"
        >
          {t("masDatos")}
          {(linea.pesoKg || linea.vencimiento) && (
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-brand-500"
            />
          )}
          <IconoMas
            className={`size-3.5 ${mostrarMas ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          disabled={ocupado || !anotada}
          onClick={alEliminar}
          aria-label={t(vinculada ? "limpiarProducto" : "quitarProducto", {
            nombre: linea.producto.nombre,
          })}
          className="inline-flex size-9 items-center justify-center rounded-lg text-gray-400 hover:bg-error-50 hover:text-error-600 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-30 dark:hover:bg-error-500/10 dark:hover:text-error-400"
        >
          {vinculada ? (
            <IconoLimpiar className="size-4" aria-hidden="true" />
          ) : (
            <IconoQuitar className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {mostrarMas && (
        <div
          id={`extras-${linea.clave}`}
          className={`col-span-2 grid gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-2 ${vinculada ? "xl:col-span-6" : "xl:col-span-3"} dark:bg-gray-800/40`}
        >
          {!linea.unidad.es_kg &&
            campoNumero("peso_kg", t("pesoOpcional"), linea.pesoKg)}
          <div>
            <Label htmlFor={nombre("fecha_vencimiento")}>
              {t("vencimientoOpcional")}
            </Label>
            <CampoFecha
              id={nombre("fecha_vencimiento")}
              name={nombre("fecha_vencimiento")}
              value={linea.vencimiento}
              min={fecha || undefined}
              disabled={deshabilitado}
              error={!!errores[nombre("fecha_vencimiento")]?.length}
              aria-describedby={`${nombre("fecha_vencimiento")}-ayuda`}
              alCambiar={(vencimiento) => alCambiar({ vencimiento })}
            />
            <p
              id={`${nombre("fecha_vencimiento")}-ayuda`}
              className="mt-1.5 text-theme-xs text-error-500 dark:text-error-400"
            >
              {errores[nombre("fecha_vencimiento")]?.join(" ")}
            </p>
          </div>
        </div>
      )}
    </article>
  );
}
