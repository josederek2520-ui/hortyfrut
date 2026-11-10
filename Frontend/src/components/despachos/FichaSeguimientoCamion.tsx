"use client";
import { useTranslations } from "next-intl";
import { Truck, UserRound, Warehouse, ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import useConsulta from "@/components/logistica/useConsultaLogistica";
import EstadoConsulta from "@/components/logistica/EstadoConsultaLogistica";
import { clasePanel } from "@/components/logistica/tipos";
import { claseEstadoDespacho, type DetalleDespacho } from "./tipos";
import { esViajeActual } from "./seguimientoCamiones";
import RutaDespacho from "./RutaDespacho";

export default function FichaSeguimientoCamion({
  identificador,
  alError,
}: {
  identificador: number;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("seguimientoCamiones"),
    estados = useTranslations("despachos");
  const consulta = useConsulta<DetalleDespacho>(
    `despachos/${identificador}/`,
    alError,
  );
  const viaje = consulta.datos;
  if (consulta.cargando || consulta.fallo || !viaje)
    return (
      <section className={`${clasePanel} min-h-96`}>
        <EstadoConsulta
          cargando={consulta.cargando}
          fallo={consulta.fallo}
          alRecargar={consulta.recargar}
        />
      </section>
    );
  return (
    <div className="min-w-0 space-y-4">
      <header
        className={`${clasePanel} flex flex-wrap items-start justify-between gap-4 p-4 sm:p-5`}
      >
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {viaje.codigo}
            </h2>
            <span className={claseEstadoDespacho(viaje.estado)}>
              {estados(
                viaje.estado === "borrador" && viaje.enviado_en
                  ? "pendienteSalida"
                  : `estados.${viaje.estado}`,
              )}
            </span>
          </div>
          <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex items-center gap-2">
              <dt>
                <span className="sr-only">{t("vehiculo")}</span>
                <Truck className="size-4" />
              </dt>
              <dd>{viaje.vehiculo_placa}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt>
                <span className="sr-only">{t("chofer")}</span>
                <UserRound className="size-4" />
              </dt>
              <dd>{viaje.chofer_nombre}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt>
                <span className="sr-only">{t("almacen")}</span>
                <Warehouse className="size-4" />
              </dt>
              <dd>{viaje.almacen_nombre}</dd>
            </div>
          </dl>
        </div>
        <Link
          href={`/despachos/${viaje.id}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-brand-700 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300 dark:hover:bg-brand-500/10"
        >
          {t("verDespacho")}
          <ArrowUpRight className="size-4" />
        </Link>
      </header>
      {esViajeActual(viaje) ? (
        <RutaDespacho
          supervisar
          despacho={viaje}
          alActualizar={consulta.establecerDatos}
          alError={alError}
        />
      ) : (
        <p
          role="status"
          className={`${clasePanel} p-6 text-sm text-gray-600 dark:text-gray-300`}
        >
          {t("yaNoActual")}
        </p>
      )}
    </div>
  );
}
