"use client";
import { useLocale, useTranslations } from "next-intl";
import { Trash2 as IconoQuitar } from "lucide-react";
import ImagenProducto from "@/components/productos/ImagenProducto";
import { mostrarBolivianos } from "@/lib/moneda";
import { normalizarPrecio } from "./calculosPrecio";
import { campoPrecio, type LineaPrecio } from "./tipos";

export default function TarjetaProductoPrecio({
  fila,
  editable,
  version,
  bloqueado,
  errores,
  alQuitar,
  alPrecio,
}: {
  fila: LineaPrecio;
  editable: boolean;
  version: boolean;
  bloqueado: boolean;
  errores: Record<string, string[]>;
  alQuitar?: (id: number) => void;
  alPrecio: (id: number, valor: string) => void;
}) {
  const t = useTranslations("precios"),
    idioma = useLocale();
  const clave = `${fila.producto}_precio_kg`,
    id = "precio-producto-" + fila.producto;
  return (
    <li className="flex min-w-0 flex-col gap-4 rounded-2xl border border-gray-200 bg-gray-25 p-4 dark:border-gray-700 dark:bg-gray-800/40">
      <div className="flex items-start gap-3">
        <ImagenProducto
          origen={fila.imagen ?? null}
          nombre={fila.producto_nombre}
          sinRecorte
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold break-words">{fila.producto_nombre}</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {fila.categoria_nombre}
          </p>
        </div>
        {editable && !version && alQuitar && (
          <button
            type="button"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-error-50 hover:text-error-600 focus-visible:outline-2 focus-visible:outline-error-500 dark:hover:bg-error-500/15 dark:hover:text-error-300"
            aria-label={t("quitarProducto", { producto: fila.producto_nombre })}
            disabled={bloqueado}
            onClick={() => alQuitar(fila.producto)}
          >
            <IconoQuitar className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {version && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t("precioAnterior")}:{" "}
          <span className="font-medium tabular-nums">
            {fila.precio_anterior
              ? mostrarBolivianos(fila.precio_anterior, idioma) + " / kg"
              : "—"}
          </span>
        </p>
      )}
      <div className="mt-auto">
        {editable ? (
          <>
            <label className="mb-1.5 block text-xs font-medium" htmlFor={id}>
              {t("precioPropuesto")}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute start-3 top-3 text-sm text-gray-500">
                Bs
              </span>
              <input
                id={id}
                data-campo-precio={clave}
                aria-label={t("precioProducto", {
                  producto: fila.producto_nombre,
                })}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                maxLength={14}
                className={
                  campoPrecio +
                  " ps-10 pe-12 text-end tabular-nums " +
                  (errores[clave] ? "border-error-500" : "")
                }
                placeholder="0,00"
                value={fila.precio_kg}
                disabled={bloqueado}
                aria-invalid={!!errores[clave]}
                aria-describedby={
                  errores[clave]
                    ? id + "-error " + id + "-unidad"
                    : id + "-unidad"
                }
                onChange={(evento) =>
                  alPrecio(fila.producto, evento.target.value)
                }
                onBlur={() => {
                  const normal = normalizarPrecio(fila.precio_kg);
                  if (normal && normal !== fila.precio_kg)
                    alPrecio(fila.producto, normal);
                }}
              />
              <span
                id={id + "-unidad"}
                className="pointer-events-none absolute end-3 top-3 text-sm text-gray-500"
                aria-label={t("porKilogramo")}
              >
                /kg
              </span>
            </div>
            {errores[clave] && (
              <p
                id={id + "-error"}
                className="mt-1 text-xs text-error-600 dark:text-error-300"
              >
                {t("precioValido")}
              </p>
            )}
          </>
        ) : (
          <p
            data-campo-precio={clave}
            tabIndex={-1}
            className="rounded-xl bg-brand-50 px-3 py-3 text-lg font-semibold tabular-nums dark:bg-brand-950"
          >
            {fila.precio_kg ? mostrarBolivianos(fila.precio_kg, idioma) : "—"}
            <span className="ms-1 text-xs font-normal text-gray-500 dark:text-gray-400">
              / kg
            </span>
          </p>
        )}
      </div>
    </li>
  );
}
