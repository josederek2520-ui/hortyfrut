import { useLocale, useTranslations } from "next-intl";
import {
  ShieldCheck as IconoConfirmado,
  ReceiptText as IconoResumen,
} from "lucide-react";
import { mostrarBolivianos } from "@/lib/moneda";
import { mostrarPesoVenta } from "./calculosVenta";
import { panelVenta, type Venta } from "./tipos";

export default function ResumenVenta({
  total,
  cantidad,
  venta,
}: {
  total: string | null;
  cantidad: number;
  venta: Venta | null;
}) {
  const t = useTranslations("ventas"),
    idioma = useLocale(),
    emitida = venta?.estado === "emitida";
  return (
    <aside
      className={panelVenta + " p-5 xl:sticky xl:top-24"}
      aria-label={t("resumen")}
    >
      <span className="mb-4 inline-flex rounded-xl bg-brand-50 p-2.5 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
        <IconoResumen className="size-5" aria-hidden="true" />
      </span>
      <h2 className="font-semibold">{t("resumen")}</h2>
      <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
        {t(emitida ? "datosConservados" : "resumenAyuda")}
      </p>
      <dl className="mt-6 space-y-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500 dark:text-gray-400">{t("entregas")}</dt>
          <dd className="font-medium tabular-nums">{cantidad}</dd>
        </div>
        {venta?.peso_aceptado_kg && (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500 dark:text-gray-400">
              {t("kgAceptados")}
            </dt>
            <dd className="font-medium tabular-nums">
              {mostrarPesoVenta(venta.peso_aceptado_kg)} kg
            </dd>
          </div>
        )}
      </dl>
      <div className="mt-5 rounded-2xl bg-brand-50 p-4 dark:bg-brand-500/10">
        <p className="text-xs font-medium text-brand-800 dark:text-brand-200">
          {t("totalVenta")}
        </p>
        <p className="mt-2 text-2xl font-semibold tracking-tight break-words text-brand-900 tabular-nums dark:text-brand-100">
          {total === null ? "—" : mostrarBolivianos(total, idioma)}
        </p>
      </div>
      {emitida && (
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500 dark:text-gray-400">{t("cobrado")}</dt>
            <dd>{mostrarBolivianos(venta.cobrado ?? "0", idioma)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-medium">{t("saldo")}</dt>
            <dd className="font-semibold">
              {mostrarBolivianos(venta.saldo!, idioma)}
            </dd>
          </div>
        </dl>
      )}
      <div className="mt-5 flex items-start gap-2 border-t border-gray-100 pt-4 text-xs leading-5 text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <IconoConfirmado
          className="mt-0.5 size-4 shrink-0"
          aria-hidden="true"
        />
        <p>{t(emitida ? "sinValorFiscal" : "sinDuplicados")}</p>
      </div>
    </aside>
  );
}
