"use client";
import dynamic from "next/dynamic";
import { useEffect, useState, useRef, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  LocateFixed,
  Map as IconoMapa,
  Maximize2,
  X,
  RefreshCw,
  Radio,
} from "lucide-react";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";
import { useSupervisionDespacho } from "./useSupervisionDespacho";
import { estadoUbicacion } from "./tiposSupervision";
import type { DocumentoRuta } from "./tiposRuta";
import type { DetalleDespacho } from "./tipos";
const MapaCarretera = dynamic(() => import("./MapaRutaCarretera"), {
  ssr: false,
});

export default function SeguimientoEnVivoDespacho({
  documento,
  despacho,
  alActualizar,
  alError,
}: {
  documento: DocumentoRuta;
  despacho: DetalleDespacho;
  alActualizar?: (datos: DetalleDespacho) => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("supervision"),
    idioma = useLocale();
  const supervision = useSupervisionDespacho(despacho.id, true);
  const [ampliado, establecerAmpliado] = useState(false),
    [seguir, establecerSeguir] = useState(false);
  const [encuadre, establecerEncuadre] = useState(0),
    [ahora, establecerAhora] = useState(Date.now);
  const versionConsultada = useRef("");
  const actualizarRef = useRef(alActualizar),
    errorRef = useRef(alError);
  useEffect(() => {
    actualizarRef.current = alActualizar;
    errorRef.current = alError;
  }, [alActualizar, alError]);
  useEffect(() => {
    const reloj = setInterval(() => establecerAhora(Date.now()), 1000);
    return () => clearInterval(reloj);
  }, []);
  const nuevaVersion = supervision.datos?.version;
  useEffect(() => {
    if (
      !nuevaVersion ||
      nuevaVersion === despacho.version ||
      versionConsultada.current === nuevaVersion ||
      !actualizarRef.current
    )
      return;
    const controlador = new AbortController();
    versionConsultada.current = nuevaVersion;
    void api<DetalleDespacho>(`despachos/${despacho.id}/`, {
      signal: controlador.signal,
    })
      .then((datos) => {
        if (!controlador.signal.aborted) actualizarRef.current?.(datos);
      })
      .catch((error) => {
        if (!controlador.signal.aborted) {
          versionConsultada.current = "";
          errorRef.current(error);
        }
      });
    return () => controlador.abort();
  }, [nuevaVersion, despacho.id, despacho.version]);
  const alMover = useCallback(
    () => establecerSeguir(false),
    [establecerSeguir],
  );
  const datos = supervision.datos;
  const estadoGps = estadoUbicacion(
    datos,
    ahora + (supervision.desfaseReloj ?? 0),
  );
  const posicion = datos?.seguimiento?.posicion ?? null;
  const vigente =
    estadoGps === "compartiendo" && supervision.fase === "en_vivo";
  const progreso = datos?.progreso;
  const siguiente = progreso?.siguiente;
  const hora = posicion
    ? new Intl.DateTimeFormat(idioma, {
        dateStyle: "short",
        timeStyle: "medium",
        timeZone: "America/La_Paz",
      }).format(new Date(posicion.capturadaEn))
    : null;
  const mapa = (
    <MapaCarretera
      documento={documento}
      posicion={posicion}
      seguir={seguir}
      ubicacionActiva={vigente}
      revisionEncuadre={encuadre}
      alMover={alMover}
      amplio
    />
  );
  const controles = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        startIcon={<IconoMapa className="size-4" />}
        onClick={() => {
          establecerSeguir(false);
          establecerEncuadre((valor) => valor + 1);
        }}
      >
        {t("verRecorrido")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!posicion}
        aria-pressed={seguir}
        startIcon={<LocateFixed className="size-4" />}
        onClick={() => establecerSeguir(!seguir)}
      >
        {t(seguir ? "siguiendo" : "centrar")}
      </Button>
      <button
        type="button"
        aria-label={t(ampliado ? "cerrarMapa" : "ampliarMapa")}
        onClick={() => establecerAmpliado(!ampliado)}
        className="inline-flex size-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
      >
        {ampliado ? <X className="size-5" /> : <Maximize2 className="size-5" />}
      </button>
    </div>
  );
  const contenido = (
    <div className="space-y-4 text-gray-900 dark:text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${supervision.fase === "en_vivo" ? "bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200" : "bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200"}`}
            role="status"
          >
            <Radio className="size-3.5" />
            {t(`conexion.${supervision.fase}`)}
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {t(`ubicacion.${estadoGps}`)}
          </span>
        </div>
        {controles}
      </div>
      {supervision.fase === "sin_permiso" ? (
        <p
          role="alert"
          className="rounded-2xl bg-error-50 p-4 text-sm text-error-700 dark:bg-error-950 dark:text-error-200"
        >
          {t("accesoTerminado")}
        </p>
      ) : (
        ["sin_conexion", "reconectando"].includes(supervision.fase) && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-950 dark:text-orange-200">
            <p>{t("conexionPerdida")}</p>
            <Button
              variant="outline"
              size="sm"
              disabled={supervision.fase === "reconectando"}
              onClick={supervision.reintentar}
              startIcon={<RefreshCw className="size-4" />}
            >
              {t("reintentar")}
            </Button>
          </div>
        )
      )}
      {mapa}
      <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
        <div>
          <p className="font-medium">
            {t("avance", {
              completadas:
                progreso?.completadas ?? despacho.resumen.completadas,
              total: progreso?.total ?? despacho.resumen.paradas,
            })}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {siguiente
              ? t("siguiente", {
                  destino: `${siguiente.cliente} · ${siguiente.sucursal}`,
                })
              : despacho.estado === "en_ruta" && progreso
                ? t("regreso", { almacen: despacho.almacen_nombre })
                : despacho.almacen_nombre}
          </p>
        </div>
        {posicion && (
          <div className="text-xs text-gray-500 sm:text-end dark:text-gray-400">
            <p>{t(vigente ? "medicion" : "ultimaMedicion", { hora: hora! })}</p>
            <p className="mt-1">
              {t("precision", {
                metros: new Intl.NumberFormat(idioma, {
                  maximumFractionDigits: 2,
                }).format(posicion.precisionM),
              })}
            </p>
          </div>
        )}
      </div>
      {estadoGps === "desactualizada" && (
        <p
          role="status"
          className="text-xs text-orange-700 dark:text-orange-300"
        >
          {t("sinMediciones")}
        </p>
      )}
    </div>
  );
  return ampliado ? (
    <Modal
      isOpen
      isFullscreen
      showCloseButton={false}
      labelledBy="titulo-supervision-ampliada"
      onClose={() => establecerAmpliado(false)}
      className="overflow-y-auto bg-white p-4 sm:p-6 dark:bg-gray-900"
    >
      <h2
        id="titulo-supervision-ampliada"
        className="mb-4 text-lg font-semibold text-gray-900 dark:text-white"
      >
        {despacho.codigo} · {despacho.chofer_nombre}
      </h2>
      {contenido}
    </Modal>
  ) : (
    contenido
  );
}
