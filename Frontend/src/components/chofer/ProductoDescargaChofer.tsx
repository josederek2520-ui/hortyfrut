"use client";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import ImagenProducto from "@/components/productos/ImagenProducto";
import ColorCajilla from "@/components/cajillas/ColorCajilla";
import type { ProductoPedido } from "@/lib/chofer/modulos/despachos/dominio/Viaje";
import { compactarMedida } from "./presentacionCarga";

export default function ProductoDescargaChofer({
  producto,
  verificable,
  comprobada,
  ocupado,
  alComprobar,
}: {
  producto: ProductoPedido;
  verificable: boolean;
  comprobada: boolean;
  ocupado: boolean;
  alComprobar: () => void;
}) {
  const t = useTranslations("chofer");
  const presentacion = producto.presentacion.trim();
  const mostrarPresentacion = ![
    "",
    "caja",
    "cajas",
    "unidad",
    "unidades",
  ].includes(presentacion.toLocaleLowerCase());
  return (
    <li
      className={`overflow-hidden rounded-2xl border ${comprobada ? "border-brand-300 bg-brand-25 dark:border-brand-700 dark:bg-brand-950/40" : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"}`}
    >
      <label
        className={`flex min-h-11 items-center gap-3 p-4 ${verificable && !ocupado ? "cursor-pointer" : ""}`}
      >
        <ImagenProducto
          origen={producto.imagen ?? null}
          nombre={producto.nombre}
          sinRecorte
        />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-gray-900 dark:text-white">
            {producto.nombre}
          </span>
          <span className="mt-1 block text-sm text-gray-600 dark:text-gray-300">
            {t(
              producto.columna === "cajas"
                ? "cantidadCajas"
                : "cantidadUnidades",
              { cantidad: producto.cantidad },
            )}
            {" · "}
            {compactarMedida(producto.pesoKg)} kg
          </span>
          {mostrarPresentacion && (
            <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              {presentacion}
            </span>
          )}
        </span>
        {verificable && (
          <input
            type="checkbox"
            className="size-6 shrink-0 accent-brand-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
            aria-label={t("comprobarProducto", { nombre: producto.nombre })}
            disabled={ocupado}
            checked={comprobada}
            onChange={alComprobar}
          />
        )}
      </label>
      {!!producto.cajillasPreparacion?.length && (
        <div className="px-4 pb-3">
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            {t("cajillasPreparacion")}
          </p>
          <ul className="flex flex-wrap gap-2">
            {producto.cajillasPreparacion.map((cajilla) => (
              <li
                key={cajilla.cajilla}
                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <ColorCajilla color={cajilla.color} compacta />
                <span className="pe-1 font-semibold text-gray-900 dark:text-white">
                  × {cajilla.cantidad}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <details className="group border-t border-gray-100 dark:border-gray-800">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-xs font-medium text-gray-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 [&::-webkit-details-marker]:hidden">
          {t("verTrazabilidad")}
          <ChevronDown
            className="size-4 group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="space-y-2 px-4 pb-4 text-xs text-gray-500 dark:text-gray-400">
          <p>{t("preparacionCarga", { codigo: producto.codigoPreparacion })}</p>
          {!!producto.cajillasPreparacion?.length && (
            <p className="leading-5">{t("alcanceCajillasPreparacion")}</p>
          )}
          <ul className="space-y-2">
            {producto.aportes.map((aporte, indice) => {
              const cantidad = compactarMedida(aporte.cantidad),
                peso = compactarMedida(aporte.pesoKg);
              const unidad =
                aporte.unidad.trim().toLocaleLowerCase() === "kg"
                  ? "kg"
                  : aporte.unidad;
              const repetirPeso =
                peso && !(unidad === "kg" && cantidad === peso);
              return (
                <li
                  key={`${aporte.lote}:${indice}`}
                  className="flex flex-wrap justify-between gap-x-3 gap-y-1"
                >
                  <span>{aporte.codigo}</span>
                  <span>
                    {cantidad} {unidad}
                    {repetirPeso ? ` · ${peso} kg` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </details>
    </li>
  );
}
