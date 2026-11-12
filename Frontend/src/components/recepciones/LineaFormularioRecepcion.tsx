"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  RotateCcw as IconoLimpiar,
  Trash2 as IconoQuitar,
  ChevronDown as IconoMas,
} from "lucide-react";
import Input from "@/components/form/input/InputField";
import CampoFecha from "@/components/form/CampoFecha";
import Label from "@/components/form/Label";
import ImagenProducto from "@/components/productos/ImagenProducto";
import DesplegableCompra from "@/components/compras/DesplegableCompra";
import {
  aMilesRecepcion,
  mismaUnidadRecepcion,
  compactarCantidadRecepcion,
  entradaCantidadRecepcion,
  esMedicionGuardadaRecepcion,
} from "./calculos";
import type { LineaRecepcion, UnidadRecepcion } from "./tipos";
import { textosUnidadRecepcion } from "./textosUnidadRecepcion";

export const columnasRecepcion =
  "xl:grid-cols-[minmax(11rem,1.3fr)_minmax(10rem,1fr)_minmax(15rem,1.3fr)_11.5rem_6rem]";
export const columnasRecepcionDirecta =
  "xl:grid-cols-[minmax(12rem,1.5fr)_minmax(16rem,2fr)_11rem_7rem]";

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
  const textosMedicion = textosUnidadRecepcion(linea.unidad);
  const unidadVisible = linea.unidad.abreviatura || linea.unidad.nombre;
  const etiquetaInventario = t(textosMedicion.etiqueta, {
    unidad: unidadVisible,
  });
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
  const tieneMasDatos = !linea.unidad.es_kg;
  const mostrarMas =
    tieneMasDatos && (masDatos || !!errores[nombre("peso_kg")]?.length);
  const erroresInventario = [
    ...(errores[nombre("cantidad_inventario")] || []),
    ...(misma ? errores[nombre("cantidad_compra")] || [] : []),
  ];
  const campoNumero = (
    campo: string,
    etiqueta: string,
    valor: string,
    problemas: string[] = errores[nombre(campo)] || [],
    sufijo = "",
  ) => {
    const campoLinea =
      campo === "cantidad_compra"
        ? "cantidadCompra"
        : campo === "peso_kg"
          ? "pesoKg"
          : "cantidadInventario";
    const enteros = campo === "cantidad_compra" ? 9 : 11;
    const decimales =
      esMedicionGuardadaRecepcion(linea, campoLinea, valor) &&
      (compactarCantidadRecepcion(valor).split(".")[1]?.length || 0) > 1
        ? 3
        : 1;
    return (
      <div className="group min-w-0">
        <Label htmlFor={nombre(campo)}>{etiqueta}</Label>
        <div className="relative">
          <Input
            id={nombre(campo)}
            name={nombre(campo)}
            inputMode="decimal"
            pattern={`[0-9]{1,${enteros}}([.,][0-9]{1,${decimales}})?`}
            maxLength={enteros + decimales + 1}
            title={`${etiqueta}. ${t("precisionCantidadesAyuda")}`}
            value={valor}
            placeholder={t("cantidadCampo")}
            className={sufijo ? "pe-24!" : undefined}
            disabled={deshabilitado}
            error={!!problemas.length}
            aria-describedby={`${nombre(campo)}-precision${problemas.length ? ` ${nombre(campo)}-ayuda` : ""}`}
            onChange={(evento) => {
              const entrada = entradaCantidadRecepcion(
                evento.target.value,
                valor,
                enteros,
              );
              if (entrada !== null) alCambiar({ [campoLinea]: entrada });
            }}
            onBlur={(evento) => {
              const compacto = compactarCantidadRecepcion(evento.target.value);
              if (compacto !== evento.target.value)
                alCambiar({ [campoLinea]: compacto });
            }}
          />
          {sufijo && (
            <span
              aria-hidden="true"
              title={sufijo}
              className="pointer-events-none absolute inset-y-2.5 end-0 flex w-22 items-center border-s border-gray-200 px-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300"
            >
              <span className="truncate">{sufijo}</span>
            </span>
          )}
        </div>
        {!!problemas.length && (
          <p
            id={`${nombre(campo)}-ayuda`}
            role="alert"
            className="mt-1.5 text-theme-xs text-error-500 dark:text-error-400"
          >
            {problemas.join(" ")}
          </p>
        )}
        <p
          id={`${nombre(campo)}-precision`}
          className="mt-1 hidden text-theme-xs text-gray-500 group-focus-within:block dark:text-gray-400"
        >
          {t("precisionCantidadesAyuda")}
        </p>
      </div>
    );
  };
  return (
    <article
      role="row"
      className={`grid grid-cols-2 items-start gap-4 border-t border-gray-100 p-4 focus-within:bg-orange-25 xl:gap-3 dark:border-gray-800 dark:focus-within:bg-orange-500/5 ${vinculada ? columnasRecepcion : columnasRecepcionDirecta}`}
    >
      <div role="cell" className="col-span-2 min-w-0 xl:col-span-1">
        <div className="flex min-h-11 items-center gap-3">
          <ImagenProducto
            origen={linea.producto.imagen || null}
            nombre={linea.producto.nombre}
            sinRecorte
          />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold break-words text-gray-900 dark:text-white">
              {linea.producto.nombre}
            </h3>
            {linea.proveedorNombre && (
              <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                {linea.proveedorNombre}
              </p>
            )}
            {vinculada && (
              <p className="mt-1 text-theme-xs text-gray-600 dark:text-gray-300">
                {t("pendienteMedida", {
                  cantidad: numero(pendiente),
                  medida: linea.medidaCompra,
                })}
              </p>
            )}
          </div>
        </div>
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
        <div role="cell" className="col-span-2 min-w-0 sm:col-span-1">
          <div className="xl:[&_label]:sr-only">
            {campoNumero(
              misma ? "cantidad_inventario" : "cantidad_compra",
              t("llegoHoyMedida", { medida: linea.medidaCompra }),
              misma ? linea.cantidadInventario : linea.cantidadCompra,
              misma ? erroresInventario : errores[nombre("cantidad_compra")],
              linea.medidaCompra,
            )}
            {linea.cantidadCompra.trim() &&
              recibido !== null &&
              pendiente !== null && (
                <p
                  role={excede ? "alert" : "status"}
                  className={`mt-1 text-theme-xs tabular-nums ${excede ? "text-error-600 dark:text-error-400" : "text-gray-500 dark:text-gray-400"}`}
                >
                  {excede
                    ? t("superaPendiente")
                    : t("quedaraPendienteMedida", {
                        cantidad: numero(pendiente - recibido),
                        medida: linea.medidaCompra,
                      })}
                </p>
              )}
          </div>
        </div>
      )}
      <div role="cell" className="col-span-2 min-w-0 sm:col-span-1">
        <div className="flex items-start">
          {!vinculada || !misma ? (
            <div className="min-w-0 flex-1 [&_input]:rounded-e-none xl:[&_label]:sr-only">
              {campoNumero(
                "cantidad_inventario",
                etiquetaInventario,
                linea.cantidadInventario,
                erroresInventario,
              )}
            </div>
          ) : (
            <p className="flex min-h-11 flex-1 items-center pe-2 text-theme-xs text-gray-500 dark:text-gray-400">
              {t("mismaCantidad")}
            </p>
          )}
          <div
            className={`w-22 min-w-0 shrink-0 xl:[&_label]:sr-only ${!vinculada || !misma ? "[&>div>button]:rounded-s-none [&>div>button]:border-s-0" : ""}`}
          >
            <DesplegableCompra<UnidadRecepcion>
              tipo="general"
              mostrarBuscador={false}
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
      </div>
      <div
        role="cell"
        className="col-span-2 min-w-0 sm:col-span-1 xl:col-span-1 xl:[&_label]:sr-only"
      >
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
          aria-describedby={
            errores[nombre("fecha_vencimiento")]?.length
              ? `${nombre("fecha_vencimiento")}-ayuda`
              : undefined
          }
          alCambiar={(vencimiento) => alCambiar({ vencimiento })}
        />
        {!!errores[nombre("fecha_vencimiento")]?.length && (
          <p
            id={`${nombre("fecha_vencimiento")}-ayuda`}
            role="alert"
            className="mt-1.5 text-theme-xs text-error-500 dark:text-error-400"
          >
            {errores[nombre("fecha_vencimiento")]?.join(" ")}
          </p>
        )}
      </div>
      <div
        role="cell"
        className="col-span-2 flex flex-wrap items-center justify-end gap-1 sm:col-span-1"
      >
        {tieneMasDatos && (
          <button
            type="button"
            disabled={deshabilitado}
            onClick={() => establecerMasDatos(!mostrarMas)}
            aria-expanded={mostrarMas}
            aria-controls={`extras-${linea.clave}`}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg px-1 text-theme-xs font-medium text-gray-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-300"
          >
            {t("masDatos")}
            {linea.pesoKg && (
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
        )}
        <button
          type="button"
          disabled={ocupado || !anotada}
          onClick={alEliminar}
          aria-label={t(vinculada ? "limpiarProducto" : "quitarProducto", {
            nombre: linea.producto.nombre,
          })}
          className="inline-flex size-11 items-center justify-center rounded-lg text-gray-400 hover:bg-error-50 hover:text-error-600 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-30 dark:hover:bg-error-500/10 dark:hover:text-error-400"
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
          className={`col-span-2 rounded-xl bg-gray-50 p-4 ${vinculada ? "xl:col-span-5" : "xl:col-span-4"} dark:bg-gray-800/40`}
        >
          {!linea.unidad.es_kg &&
            campoNumero(
              "peso_kg",
              t("pesoOpcional"),
              linea.pesoKg,
              undefined,
              "kg",
            )}
        </div>
      )}
    </article>
  );
}
