"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  Download as IconoDescargar,
  LoaderCircle as IconoCargando,
  Archive as IconoZip,
} from "lucide-react";
import Button from "@/components/ui/button/Button";
import { fechaRespaldo, tamanoRespaldo, type Respaldo } from "./tipos";

export default function HistorialRespaldos({
  respaldos,
  puedeDescargar,
  descargando,
  alDescargar,
}: {
  respaldos: Respaldo[];
  puedeDescargar: boolean;
  descargando: string | null;
  alDescargar: (respaldo: Respaldo) => void;
}) {
  const t = useTranslations("respaldos"),
    idioma = useLocale();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-start text-sm">
        <thead className="hidden bg-gray-50 text-xs text-gray-500 md:table-header-group dark:bg-gray-800/60 dark:text-gray-400">
          <tr>
            {["archivo", "fecha", "tamano", "estado", "accion"].map((clave) => (
              <th
                key={clave}
                scope="col"
                className="px-4 py-3 text-start font-medium"
              >
                {t(clave)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {respaldos.map((respaldo) => (
            <tr
              key={respaldo.id}
              className="grid gap-3 py-4 md:table-row md:py-0"
            >
              <td className="px-4 md:py-4">
                <div className="flex items-start gap-2">
                  <IconoZip
                    className="mt-0.5 size-4 shrink-0 text-gray-400"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="font-medium break-all text-gray-900 dark:text-white">
                      {respaldo.nombre}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {respaldo.responsable_nombre}
                    </p>
                    {respaldo.error && (
                      <p className="mt-2 max-w-sm text-xs text-error-600 dark:text-error-400">
                        {respaldo.error}
                      </p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 text-gray-600 md:py-4 dark:text-gray-300">
                <span className="me-2 text-xs text-gray-500 md:hidden">
                  {t("fecha")}:
                </span>
                {fechaRespaldo(respaldo.creado_en, idioma)}
              </td>
              <td className="px-4 text-gray-600 tabular-nums md:py-4 dark:text-gray-300">
                <span className="me-2 text-xs text-gray-500 md:hidden">
                  {t("tamano")}:
                </span>
                {tamanoRespaldo(respaldo.tamano_bytes, idioma)}
              </td>
              <td className="px-4 md:py-4">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${respaldo.estado === "completado" ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400" : respaldo.estado === "fallido" ? "bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400" : "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400"}`}
                >
                  {respaldo.estado === "preparando" && (
                    <IconoCargando
                      className="size-3 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  )}
                  {t(respaldo.estado)}
                </span>
              </td>
              <td className="px-4 md:py-4">
                {puedeDescargar && respaldo.estado === "completado" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!!descargando}
                    onClick={() => alDescargar(respaldo)}
                    startIcon={
                      <IconoDescargar className="size-4" aria-hidden="true" />
                    }
                    aria-label={`${t("descargar")} ${respaldo.nombre}`}
                  >
                    {t(
                      descargando === respaldo.id ? "descargando" : "descargar",
                    )}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
