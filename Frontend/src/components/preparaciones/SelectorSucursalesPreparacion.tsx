"use client";
import { useTranslations } from "next-intl";
import {
  MapPin as IconoSucursal,
  CircleCheck as IconoSeleccionada,
} from "lucide-react";
import type { SucursalProductoPreparacion } from "./sucursalesProductoPreparacion";
import estilos from "./estilosTrabajo.module.css";

export default function SelectorSucursalesPreparacion({
  sucursales,
  elegida,
  anotadas,
  ocupado,
  alElegir,
}: {
  sucursales: SucursalProductoPreparacion[];
  elegida: number | null;
  anotadas: Set<number>;
  ocupado: boolean;
  alElegir: (sucursal: number) => void;
}) {
  const t = useTranslations("preparaciones");
  return (
    <div
      className="grid grid-cols-1 gap-2 xsm:grid-cols-2 xl:grid-cols-3"
      role="group"
      aria-label={t("elegirSucursalProducto")}
    >
      {sucursales.map((sucursal) => (
        <button
          key={sucursal.id}
          type="button"
          aria-pressed={elegida === sucursal.id}
          aria-controls="ficha-sucursal-producto"
          disabled={ocupado}
          onClick={() => alElegir(sucursal.id)}
          className={`${estilos.selectorSucursal} pestana-hortyfru flex min-h-18 items-start gap-3 rounded-xl border p-3 text-start disabled:opacity-50`}
        >
          <IconoSucursal
            className="mt-0.5 size-4 shrink-0 text-gray-500 dark:text-gray-400"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span
              className={`block text-sm break-words ${elegida === sucursal.id ? "font-semibold" : "font-medium"}`}
            >
              {sucursal.nombre}
            </span>
            <span
              className={`${estilos.ayudaSucursal} mt-1.5 block text-theme-xs`}
            >
              <span
                className={
                  anotadas.has(sucursal.id) ? estilos.estadoSucursal : undefined
                }
              >
                {t(
                  anotadas.has(sucursal.id)
                    ? "sucursalAnotadaProducto"
                    : "sucursalSinAnotarProducto",
                )}
              </span>
            </span>
          </span>
          {elegida === sucursal.id && (
            <IconoSeleccionada
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
          )}
        </button>
      ))}
    </div>
  );
}
