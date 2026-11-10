"use client";

import { LoaderCircle, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import type { EstadoSeguimiento } from "@/lib/chofer/modulos/seguimiento/dominio/Seguimiento";

export default function BotonUbicacionMapaChofer({
  estado,
  conPosicion,
  alAbrir,
}: {
  estado: EstadoSeguimiento | null;
  conPosicion: boolean;
  alAbrir: () => void;
}) {
  const t = useTranslations("chofer");
  const fase = estado?.fase;
  const buscando =
    !conPosicion && (fase === "iniciando" || fase === "buscando");
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-1 font-medium text-brand-700 dark:text-brand-300"
      aria-label={buscando ? t(`gps.${fase}`) : undefined}
      onClick={alAbrir}
    >
      {buscando ? (
        <LoaderCircle
          className="size-4 shrink-0 motion-safe:animate-spin"
          aria-hidden="true"
        />
      ) : (
        <MapPin className="size-4 shrink-0" aria-hidden="true" />
      )}
      <span role="status">
        {t(
          conPosicion
            ? "gpsActivo"
            : buscando
              ? "buscandoUbicacion"
              : "ubicacion",
        )}
      </span>
    </button>
  );
}
