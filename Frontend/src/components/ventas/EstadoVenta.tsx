import { useTranslations } from "next-intl";
import type { Venta } from "./tipos";

export default function EstadoVenta({ estado }: { estado: Venta["estado"] }) {
  const t = useTranslations("ventas");
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " +
        (estado === "emitida"
          ? "bg-orange-50 text-orange-800 dark:bg-orange-500/15 dark:text-orange-200"
          : estado === "borrador"
            ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300")
      }
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {t("estados." + estado)}
    </span>
  );
}
