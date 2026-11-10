"use client";
import { useTranslations } from "next-intl";
import {
  LoaderCircle as IconoCargando,
  PackageOpen as IconoVacio,
  RefreshCw as IconoRecargar,
} from "lucide-react";
import Button from "@/components/ui/button/Button";

export default function EstadoConsultaLogistica({
  cargando,
  fallo,
  vacio,
  alRecargar,
}: {
  cargando?: boolean;
  fallo?: boolean;
  vacio?: string;
  alRecargar?: () => void;
}) {
  const t = useTranslations("logistica");
  const Icono = cargando ? IconoCargando : fallo ? IconoRecargar : IconoVacio;
  return (
    <div
      className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center"
      role={fallo ? "alert" : "status"}
    >
      <span className="rounded-2xl bg-gray-50 p-4 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
        <Icono
          aria-hidden="true"
          className={`size-7 ${cargando ? "animate-spin motion-reduce:animate-none" : ""}`}
        />
      </span>
      <p className="max-w-sm text-sm leading-6 text-gray-500 dark:text-gray-400">
        {t(cargando ? "cargando" : fallo ? "errorCarga" : vacio || "vacio")}
      </p>
      {fallo && alRecargar && (
        <Button size="sm" variant="outline" onClick={alRecargar}>
          {t("recargar")}
        </Button>
      )}
    </div>
  );
}
