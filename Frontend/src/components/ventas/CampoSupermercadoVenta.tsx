import { useTranslations } from "next-intl";
import { ChevronDown, Store } from "lucide-react";
import type { ClienteVenta } from "./tipos";

export default function CampoSupermercadoVenta({
  cliente,
  editable,
  bloqueado,
  alElegir,
}: {
  cliente: ClienteVenta | null;
  editable: boolean;
  bloqueado: boolean;
  alElegir: () => void;
}) {
  const t = useTranslations("ventas");
  if (editable)
    return (
      <button
        type="button"
        disabled={bloqueado}
        onClick={alElegir}
        title={cliente?.nombre}
        aria-label={
          cliente
            ? t("cambiar") + " " + t("supermercado") + ": " + cliente.nombre
            : t("elegirSupermercado")
        }
        className="control-suave-hortyfru inline-flex h-11 max-w-full min-w-0 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-medium text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-64 dark:border-gray-700 dark:text-brand-300"
      >
        <Store className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {cliente?.nombre ?? t("elegirSupermercado")}
        </span>
        <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
      </button>
    );
  if (!cliente) return null;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="shrink-0 rounded-xl bg-brand-50 p-2.5 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
        <Store className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t("supermercado")}
        </p>
        <p className="font-semibold break-words">{cliente.nombre}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          NIT {cliente.nit}
        </p>
      </div>
    </div>
  );
}
