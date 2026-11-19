import { useTranslations } from "next-intl";
import type { Venta } from "./tipos";

export default function EstadoCobroVenta({
  estado,
}: {
  estado: Venta["estado_cobro"];
}) {
  const t = useTranslations("ventas");
  if (!estado) return null;
  return (
    <span
      className={
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium " +
        (estado === "pagada"
          ? "bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200"
          : estado === "parcial"
            ? "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
            : "bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200")
      }
    >
      {t(estado)}
    </span>
  );
}
