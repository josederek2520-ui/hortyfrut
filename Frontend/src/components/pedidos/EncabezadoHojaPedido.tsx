"use client";
import { useLocale, useTranslations } from "next-intl";
import { IconoPedidos, LockIcon } from "@/icons";
import CampoFecha from "@/components/form/CampoFecha";
import { fechaLocal } from "./fechas";
import {
  clasePanel,
  claseEntrada,
  type Pedido,
  type OpcionPedido,
} from "./tipos";
export default function EncabezadoHojaPedido({
  pedido,
  sucursal,
  fecha,
  guardando,
  errores,
  alFecha,
}: {
  pedido: Pedido | null;
  sucursal: OpcionPedido | null;
  fecha: string;
  guardando: boolean;
  errores: Record<string, string[]>;
  alFecha: (fecha: string) => void;
}) {
  const t = useTranslations("pedidos"),
    idioma = useLocale();
  return (
    <section className={`${clasePanel} p-5 sm:p-6`}>
      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
          <IconoPedidos className="size-5" />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {pedido?.codigo || t("hojaTitulo")}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("hojaSubtitulo")}
          </p>
        </div>
      </div>
      <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <span
            id="etiqueta-sucursal-pedido"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t("sucursal")}
          </span>
          <p
            id="sucursal"
            tabIndex={-1}
            aria-labelledby="etiqueta-sucursal-pedido"
            aria-describedby="ayuda-sucursal-pedido error-sucursal-pedido"
            aria-invalid={!!errores.sucursal?.length}
            className={`${claseEntrada} flex items-center gap-2 bg-gray-50 dark:bg-gray-800`}
          >
            <LockIcon
              className="size-4 shrink-0 text-gray-400"
              aria-hidden="true"
            />
            <span className="truncate">
              {sucursal
                ? `${sucursal.cliente ? `${sucursal.cliente} · ` : ""}${sucursal.nombre}`
                : "—"}
            </span>
          </p>
          <p
            id="ayuda-sucursal-pedido"
            className="mt-1.5 text-xs text-gray-500 dark:text-gray-400"
          >
            {t("sucursalFijaAyuda")}
          </p>
          <p id="error-sucursal-pedido" className="mt-1 text-xs text-error-500">
            {errores.sucursal?.join(" ")}
          </p>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("responsable")}
          </span>
          <p
            className={`${claseEntrada} flex items-center bg-gray-50 dark:bg-gray-800`}
          >
            {sucursal?.responsable || "—"}
          </p>
        </div>
        <div>
          <label
            htmlFor="fecha_requerida"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t("fechaRequerida")} <span className="text-error-500">*</span>
          </label>
          <CampoFecha
            id="fecha_requerida"
            name="fecha_requerida"
            required
            value={fecha}
            min={
              pedido?.fecha_requerida && pedido.fecha_requerida < fechaLocal()
                ? pedido.fecha_requerida
                : fechaLocal()
            }
            alCambiar={alFecha}
            disabled={guardando}
            aria-invalid={!!errores.fecha_requerida?.length}
            error={!!errores.fecha_requerida?.length}
            aria-describedby={
              errores.fecha_requerida?.length
                ? "error-fecha-requerida"
                : undefined
            }
          />
          <p
            id="error-fecha-requerida"
            className="mt-1.5 text-xs text-error-500"
          >
            {errores.fecha_requerida?.join(" ")}
          </p>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("fechaPedido")}
          </span>
          <p
            className={`${claseEntrada} flex items-center bg-gray-50 dark:bg-gray-800`}
          >
            {new Intl.DateTimeFormat(idioma, {
              dateStyle: "medium",
              timeZone: "America/La_Paz",
            }).format(pedido ? new Date(pedido.creado_en) : new Date())}
          </p>
        </div>
      </div>
    </section>
  );
}
