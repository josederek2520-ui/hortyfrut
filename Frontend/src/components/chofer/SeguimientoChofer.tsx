"use client";
import { useTranslations } from "next-intl";
import { LocateFixed } from "lucide-react";
import Button from "@/components/ui/button/Button";
import { useChofer, useSeguimiento } from "./ProveedorChofer";
export default function SeguimientoChofer({
  viaje,
  version,
  puedeOperar,
  enRuta,
  bloqueado,
}: {
  viaje: number;
  version: string;
  puedeOperar: boolean;
  enRuta: boolean;
  bloqueado: boolean;
}) {
  const t = useTranslations("chofer"),
    { seguimiento } = useChofer(),
    estado = useSeguimiento();
  const propio = estado.viaje === viaje;
  const fase = propio ? estado.fase : "inactivo";
  const activo = ["iniciando", "buscando", "compartiendo"].includes(fase);
  return (
    <section className="space-y-3 rounded-2xl bg-gray-50 p-4 dark:bg-gray-800">
      <h3 className="flex items-center gap-2 font-semibold">
        <LocateFixed className="size-5 text-brand-600" />
        {t("ubicacion")}
      </h3>
      <p className="text-sm" role="status">
        {t(`gps.${fase}`)}
      </p>
      {propio && estado.posicion && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t("precision", { metros: Math.round(estado.posicion.precisionM) })} ·{" "}
          {new Date(estado.posicion.capturadaEn).toLocaleTimeString()}
        </p>
      )}
      {propio && estado.error && (
        <p role="alert" className="text-sm text-error-600 dark:text-error-400">
          {t(`errores.${estado.error}`)}
        </p>
      )}
      <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
        {t("gpsAyuda")}
      </p>
      {activo ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void seguimiento.detener();
          }}
        >
          {t("detenerGps")}
        </Button>
      ) : fase === "pendiente" ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void seguimiento.reintentar();
          }}
        >
          {t("comprobarGps")}
        </Button>
      ) : (
        enRuta &&
        puedeOperar && (
          <Button
            size="sm"
            disabled={bloqueado}
            onClick={() => {
              void seguimiento.iniciar(viaje, version).catch(() => {});
            }}
          >
            {t("compartirGps")}
          </Button>
        )
      )}
    </section>
  );
}
