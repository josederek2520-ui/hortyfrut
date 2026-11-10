"use client";
import { useTranslations } from "next-intl";

export default function CantidadesSolicitadasCompra({
  cajas = 0,
  unidades = 0,
}: {
  cajas?: number;
  unidades?: number;
}) {
  const t = useTranslations("compras");
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 font-medium tabular-nums">
      {cajas > 0 && (
        <span>{t("cajasSolicitadasLegibles", { cantidad: cajas })}</span>
      )}
      {cajas > 0 && unidades > 0 && <span aria-hidden="true">·</span>}
      {unidades > 0 && (
        <span>{t("unidadesSolicitadasLegibles", { cantidad: unidades })}</span>
      )}
    </span>
  );
}
