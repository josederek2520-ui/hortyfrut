"use client";
import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, RefreshCw, Truck, MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import { useChofer, useSeguimiento } from "./ProveedorChofer";
import { useConsultaChofer } from "./useConsultaChofer";
import PaginacionChofer from "./PaginacionChofer";
import { ErrorAplicacion } from "@/lib/chofer/compartido/dominio/Errores";

export default function ListaViajesChofer() {
  const t = useTranslations("chofer"),
    idioma = useLocale();
  const {
    repositorio,
    sesion,
    seguimiento,
    filtroViajes: filtro,
    establecerFiltroViajes: establecerFiltro,
  } = useChofer();
  const captura = useSeguimiento();
  const consultar = useCallback(
    (senal: AbortSignal) =>
      repositorio.listar(filtro.pagina, filtro.vista, senal),
    [repositorio, filtro],
  );
  const consulta = useConsultaChofer(
    `${filtro.vista}:${filtro.pagina}`,
    consultar,
  );
  const reintentar = () => {
    if (
      filtro.pagina > 1 &&
      consulta.error instanceof ErrorAplicacion &&
      consulta.error.estado === 404
    )
      establecerFiltro({ ...filtro, pagina: 1 });
    else consulta.recargar();
  };
  return (
    <main className="w-full text-gray-900 dark:text-white">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
            {sesion.user.nombre_completo}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("titulo")}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {t("subtitulo")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          aria-label={t("actualizar")}
          onClick={consulta.recargar}
        >
          <RefreshCw className="size-5" />
        </Button>
      </div>
      {captura.viaje &&
        ["buscando", "compartiendo", "pendiente"].includes(captura.fase) && (
          <div className="mb-5 rounded-2xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-950">
            <Link href={`/mis-viajes/${captura.viaje}`} className="font-medium">
              {t("volverMapa")}
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void seguimiento.detener();
              }}
            >
              {t("detenerGps")}
            </Button>
          </div>
        )}
      <div className="mb-5 flex gap-2" aria-label={t("vistas")}>
        {["en_curso", "historial"].map((vista) => (
          <Button
            key={vista}
            size="sm"
            aria-pressed={filtro.vista === vista}
            onClick={() => establecerFiltro({ vista, pagina: 1 })}
          >
            {t(vista)}
          </Button>
        ))}
      </div>
      {consulta.error ? (
        <div role="alert" className="superficie-cristal rounded-2xl p-6">
          <p>{t("errorConsulta")}</p>
          <Button className="mt-4" onClick={reintentar}>
            {t("reintentar")}
          </Button>
        </div>
      ) : !consulta.datos ? (
        <p role="status" className="py-10">
          {t("cargando")}
        </p>
      ) : !consulta.datos.total ? (
        <div className="superficie-cristal rounded-3xl px-6 py-12 text-center">
          <Truck className="mx-auto mb-4 size-10 text-brand-500" />
          <h2 className="text-lg font-semibold">
            {t(filtro.vista === "historial" ? "sinHistorial" : "sinViajes")}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t("avisoAsignacion")}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {consulta.datos.registros.map((viaje) => (
              <Link
                href={`/mis-viajes/${viaje.id}`}
                key={viaje.id}
                className="superficie-cristal block rounded-3xl border border-gray-200 p-5 focus-visible:outline-3 focus-visible:outline-brand-500 dark:border-gray-800"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-lg font-semibold">{viaje.codigo}</span>
                  <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-200">
                    {t(`estados.${viaje.estado}`)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {new Intl.DateTimeFormat(idioma, {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  }).format(new Date(`${viaje.fechaReparto}T12:00:00Z`))}{" "}
                  · {viaje.vehiculo}
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <MapPin className="size-5 shrink-0 text-brand-600 dark:text-brand-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t("siguienteDestino")}
                    </p>
                    <p className="truncate font-medium">
                      {viaje.siguienteDestino
                        ? `${viaje.siguienteDestino.cliente} · ${viaje.siguienteDestino.sucursal}`
                        : viaje.almacen}
                    </p>
                  </div>
                  <ArrowUpRight className="size-5" />
                </div>
                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{
                      width: `${viaje.resumen.paradas ? (viaje.resumen.completadas / viaje.resumen.paradas) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {t("avance", {
                    completadas: viaje.resumen.completadas,
                    total: viaje.resumen.paradas,
                  })}
                </p>
              </Link>
            ))}
          </div>
          <PaginacionChofer
            pagina={filtro.pagina}
            total={consulta.datos.total}
            alCambiar={(pagina) => establecerFiltro({ ...filtro, pagina })}
          />
        </>
      )}
    </main>
  );
}
