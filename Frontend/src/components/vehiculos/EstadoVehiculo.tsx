import { useTranslations } from "next-intl";

export default function EstadoVehiculo({ activo }: { activo: boolean }) {
  const t = useTranslations("vehiculos");
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-theme-xs font-medium ${activo ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {t(activo ? "activo" : "inactivo")}
    </span>
  );
}
