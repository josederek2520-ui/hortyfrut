"use client";
import { useTranslations } from "next-intl";
import {
  MapPin as IconoUbicacion,
  ExternalLink as IconoExterno,
} from "lucide-react";
import { enlaceMapa } from "./ubicacion";

export default function UbicacionAlmacen({
  nombre,
  latitud,
  longitud,
  compacta = false,
}: {
  nombre: string;
  latitud: string | null;
  longitud: string | null;
  compacta?: boolean;
}) {
  const t = useTranslations("almacenes");
  const enlace = enlaceMapa(latitud, longitud);
  if (!enlace)
    return (
      <span className="text-theme-xs text-gray-500 dark:text-gray-400">
        {t("sinUbicacion")}
      </span>
    );
  return (
    <div className="space-y-1">
      <div
        className={`text-gray-600 dark:text-gray-300 ${compacta ? "text-theme-xs" : "text-sm"}`}
      >
        <p>
          <span className="text-gray-500 dark:text-gray-400">
            {t("latitud")}:{" "}
          </span>
          <span className="font-mono tabular-nums">{latitud}</span>
        </p>
        <p>
          <span className="text-gray-500 dark:text-gray-400">
            {t("longitud")}:{" "}
          </span>
          <span className="font-mono tabular-nums">{longitud}</span>
        </p>
      </div>
      <a
        href={enlace}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("verMapaDe", { nombre })}
        className="inline-flex min-h-9 items-center gap-1.5 rounded text-theme-xs font-medium text-brand-600 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none dark:text-brand-300 dark:hover:text-brand-200"
      >
        <IconoUbicacion className="size-3.5" aria-hidden="true" />
        {t("verMapa")}
        <IconoExterno className="size-3.5" aria-hidden="true" />
      </a>
    </div>
  );
}
