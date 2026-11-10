"use client";
import { memo, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { divIcon, latLngBounds } from "leaflet";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import { useTranslations } from "next-intl";
import { useTheme } from "@/context/ThemeContext";
import { prepararMotorMapa } from "@/lib/mapas/prepararMotorMapa";
import type { DocumentoRuta } from "./tiposRuta";
import estilos from "./estilosMapaRuta.module.css";
import { iconoMapaDestino, iconoCamionMapa } from "./iconosMapa";
import type { PosicionSupervision } from "./tiposSupervision";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";

function FondoMapa({
  documento,
  alError,
  alCargar,
  revisionEncuadre,
}: {
  documento: DocumentoRuta;
  alError: () => void;
  alCargar: () => void;
  revisionEncuadre: number;
}) {
  const mapa = useMap(),
    { theme: tema } = useTheme();
  const claveEncuadre = `${documento.plan?.id ?? documento.puntos.map((punto) => `${punto.latitud}:${punto.longitud}`).join("|")}:${documento.estado}:${revisionEncuadre}`;
  useEffect(() => {
    prepararMotorMapa();
    const capa = maplibreGL({
      style: `https://tiles.openfreemap.org/styles/${tema === "dark" ? "dark" : "liberty"}`,
      attributionControl: false,
    });
    const creditos =
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://openmaptiles.org/">OpenMapTiles</a> · <a href="https://openfreemap.org/">OpenFreeMap</a> · Ruta: OSRM';
    mapa.attributionControl.addAttribution(creditos);
    try {
      capa.addTo(mapa);
      const nativo = capa.getMaplibreMap();
      nativo.on("error", alError);
      nativo.on("load", alCargar);
      return () => {
        nativo.off("error", alError);
        nativo.off("load", alCargar);
        capa.remove();
        mapa.attributionControl.removeAttribution(creditos);
      };
    } catch {
      // La falta de WebGL no debe impedir consultar ni operar el despacho.
      // Leaflet debe poder retirar también una capa cuyo motor no llegó a crearse.
      if (!capa.getMaplibreMap()) {
        capa.onRemove = () => {
          capa.getContainer()?.remove();
          return capa;
        };
      }
      if (mapa.hasLayer(capa)) capa.remove();
      alError();
      return () => {
        mapa.attributionControl.removeAttribution(creditos);
      };
    }
  }, [mapa, tema, alError, alCargar]);
  useEffect(() => {
    const coordenadas =
      documento.plan && documento.estado !== "obsoleta"
        ? documento.plan.geometria.coordinates.map(
            ([lon, lat]): [number, number] => [lat, lon],
          )
        : documento.puntos
            .filter(
              (punto) => punto.latitud !== null && punto.longitud !== null,
            )
            .map((punto): [number, number] => [
              Number(punto.latitud),
              Number(punto.longitud),
            ]);
    if (coordenadas.length)
      mapa.fitBounds(latLngBounds(coordenadas), {
        padding: [32, 32],
        maxZoom: 15,
        animate: false,
      });
    // Un cambio de GPS o de avance no debe mover la cámara del operador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveEncuadre, mapa]);
  return null;
}

function CentradoSeguimiento({
  posicion,
  seguir,
  alMover,
}: {
  posicion: PosicionSupervision | null;
  seguir: boolean;
  alMover?: () => void;
}) {
  const mapa = useMap();
  useMapEvents({ dragstart: () => alMover?.() });
  useEffect(() => {
    if (seguir && posicion)
      mapa.panTo([posicion.latitud, posicion.longitud], { animate: false });
  }, [mapa, seguir, posicion]);
  return null;
}

function MapaRutaCarretera({
  documento,
  posicion = null,
  seguir = false,
  ubicacionActiva = false,
  revisionEncuadre = 0,
  alMover,
  amplio = false,
}: {
  documento: DocumentoRuta;
  posicion?: PosicionSupervision | null;
  seguir?: boolean;
  ubicacionActiva?: boolean;
  revisionEncuadre?: number;
  alMover?: () => void;
  amplio?: boolean;
}) {
  const t = useTranslations("rutas");
  const s = useTranslations("supervision");
  const [fallo, establecerFallo] = useState(false);
  const [revision, establecerRevision] = useState(0);
  const [cargando, establecerCargando] = useState(true);
  const puntos =
    documento.estado === "obsoleta" || !documento.plan
      ? documento.puntos
      : documento.plan.puntos;
  const marcadores = puntos.filter(
    (punto) =>
      punto.tipo !== "retorno" &&
      punto.latitud !== null &&
      punto.longitud !== null,
  );
  const linea = useMemo(
    () =>
      documento.plan && documento.estado !== "obsoleta"
        ? documento.plan.geometria.coordinates.map(
            ([lon, lat]): [number, number] => [lat, lon],
          )
        : [],
    [documento],
  );
  const tieneTramos = Boolean(
    documento.plan?.tramos?.length &&
    documento.plan.tramos.every((tramo) => tramo.geometria),
  );
  const [alError] = useState(() => () => {
    establecerFallo(true);
    establecerCargando(false);
  });
  const [alCargar] = useState(() => () => {
    establecerFallo(false);
    establecerCargando(false);
  });
  if (!marcadores.length && !posicion)
    return (
      <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">
        {t("sinPuntos")}
      </p>
    );
  return (
    <div
      className={`relative isolate overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 ${estilos.mapa}`}
    >
      <MapContainer
        key={revision}
        center={
          marcadores.length
            ? [Number(marcadores[0]!.latitud), Number(marcadores[0]!.longitud)]
            : [posicion!.latitud, posicion!.longitud]
        }
        zoom={12}
        className={amplio ? estilos.mapaAmplio : "h-96 w-full"}
        scrollWheelZoom={false}
      >
        <FondoMapa
          documento={documento}
          alError={alError}
          alCargar={alCargar}
          revisionEncuadre={revisionEncuadre}
        />
        {posicion && (
          <>
            <CentradoSeguimiento
              posicion={posicion}
              seguir={seguir}
              alMover={alMover}
            />
            <Circle
              center={[posicion.latitud, posicion.longitud]}
              radius={posicion.precisionM}
              pathOptions={{
                color: ubicacionActiva ? "#16803C" : "#667085",
                fillOpacity: 0.12,
                weight: 1,
              }}
            />
            <Marker
              position={[posicion.latitud, posicion.longitud]}
              title={s(ubicacionActiva ? "ubicacionChofer" : "ultimaUbicacion")}
              alt={s(ubicacionActiva ? "ubicacionChofer" : "ultimaUbicacion")}
              zIndexOffset={1000}
              icon={divIcon({
                className: "marca-camion",
                html: `<img alt="" width="48" height="48" src="data:image/svg+xml,${encodeURIComponent(iconoCamionMapa)}" />`,
                iconSize: [56, 56],
                iconAnchor: [28, 28],
              })}
            >
              <Popup>
                <strong>
                  {s(ubicacionActiva ? "ubicacionChofer" : "ultimaUbicacion")}
                </strong>
                <p>{s("precision", { metros: posicion.precisionM })}</p>
              </Popup>
            </Marker>
          </>
        )}
        {!!linea.length && !tieneTramos && (
          <Polyline
            positions={linea}
            pathOptions={{ color: "#16803C", weight: 5, opacity: 0.95 }}
          />
        )}
        {tieneTramos &&
          documento.estado !== "obsoleta" &&
          documento.plan!.tramos!.map((tramo) => (
            <Polyline
              key={tramo.orden}
              positions={tramo.geometria!.coordinates.map(
                ([lon, lat]): [number, number] => [lat, lon],
              )}
              pathOptions={{
                color: tramo.color,
                weight: 5,
                opacity: 0.95,
                dashArray: documento.estado === "lista" ? undefined : "10 5",
              }}
            />
          ))}
        {marcadores.map((punto) => (
          <Marker
            key={`${punto.tipo}:${punto.parada ?? "almacen"}`}
            position={[Number(punto.latitud), Number(punto.longitud)]}
            title={punto.nombre}
            alt={`${punto.tipo === "sucursal" ? `${punto.orden}. ` : ""}${punto.nombre}`}
            icon={divIcon({
              className: "marca-ruta",
              html: `<span class="imagen-destino-ruta" style="border-color:${/^#[0-9a-f]{6}$/i.test(punto.color ?? "") ? punto.color : "#16803c"}"><img alt="" width="36" height="36" src="data:image/svg+xml,${encodeURIComponent(iconoMapaDestino(punto.tipo === "almacen", punto.color ?? "#2563eb"))}" />${punto.tipo === "sucursal" ? `<b style="background:${/^#[0-9a-f]{6}$/i.test(punto.color ?? "") ? punto.color : "#2563eb"}">${Number(punto.orden)}</b>` : ""}</span>`,
              iconSize: [48, 48],
              iconAnchor: [24, 48],
            })}
          >
            <Popup>
              <strong>
                {punto.tipo === "sucursal" ? `${punto.orden}. ` : ""}
                {punto.nombre}
              </strong>
              {punto.cliente && <p>{punto.cliente}</p>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {cargando && !fallo && (
        <div
          role="status"
          className="absolute start-1/2 top-3 z-999 -translate-x-1/2 rounded-lg bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-sm dark:bg-gray-900 dark:text-gray-200"
        >
          {t("cargandoMapa")}
        </div>
      )}
      {fallo && (
        <div
          role="alert"
          className="absolute inset-x-3 bottom-8 z-999 rounded-xl bg-white p-4 text-sm text-gray-700 shadow-theme-sm dark:bg-gray-900 dark:text-gray-200"
        >
          <p>{t("errorMapa")}</p>
          <button
            type="button"
            onClick={() => {
              establecerFallo(false);
              establecerCargando(true);
              establecerRevision((valor) => valor + 1);
            }}
            className="mt-2 min-h-10 rounded-lg px-3 font-semibold text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
          >
            {t("reintentar")}
          </button>
        </div>
      )}
    </div>
  );
}

// La hora visible cambia cada segundo; el mapa cambia solo con sus propios datos.
export default memo(MapaRutaCarretera);
