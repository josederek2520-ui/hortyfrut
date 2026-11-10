"use client";
import { useEffect } from "react";
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
import {
  iconoMapaDestino,
  iconoCamionMapa,
} from "@/components/despachos/iconosMapa";
import type { RutaViaje } from "@/lib/chofer/modulos/recorrido/dominio/Ruta";
import type { PosicionChofer } from "@/lib/chofer/modulos/seguimiento/dominio/Seguimiento";
import type {
  Parada,
  EstadoViaje,
} from "@/lib/chofer/modulos/despachos/dominio/Viaje";
import type { OpcionCamino } from "@/lib/chofer/modulos/recorrido/dominio/Ruta";
import type { EstadoGuia } from "@/lib/chofer/modulos/recorrido/dominio/GuiaChofer";
import { vistaRecorrido } from "@/lib/chofer/modulos/recorrido/aplicacion/vistaRecorrido";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import estilos from "./estilosChofer.module.css";

function ControlesVista({
  ruta,
  posicion,
  revision,
  seguir,
  alMover,
  alError,
  alCargar,
  vista,
  caminosAlternativos,
  guia,
}: PropiedadesMapa & { vista: ReturnType<typeof vistaRecorrido> }) {
  const mapa = useMap(),
    { theme } = useTheme();
  useMapEvents({ dragstart: alMover });
  useEffect(() => {
    prepararMotorMapa();
    const capa = maplibreGL({
      style: `https://tiles.openfreemap.org/styles/${theme === "dark" ? "dark" : "liberty"}`,
      attributionControl: false,
    });
    const creditos =
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://openfreemap.org/">OpenFreeMap</a> · OSRM';
    mapa.attributionControl.addAttribution(creditos);
    try {
      capa.addTo(mapa);
      const motor = capa.getMaplibreMap();
      motor.on("load", alCargar);
      motor.on("error", alError);
      const espera = setTimeout(alError, 25000);
      motor.once("load", () => clearTimeout(espera));
      return () => {
        clearTimeout(espera);
        motor.off("load", alCargar);
        motor.off("error", alError);
        capa.remove();
        mapa.attributionControl.removeAttribution(creditos);
      };
    } catch {
      if (!capa.getMaplibreMap())
        capa.onRemove = () => {
          capa.getContainer()?.remove();
          return capa;
        };
      if (mapa.hasLayer(capa)) capa.remove();
      alError();
      return () => {
        mapa.attributionControl.removeAttribution(creditos);
      };
    }
  }, [mapa, theme, alError, alCargar]);
  const clavePlan = `${vista.clave}:${ruta.estado}:${revision}`;
  useEffect(() => {
    const coordenadas = [
      ...vista.coordenadas,
      ...(posicion
        ? [[posicion.longitud, posicion.latitud] as [number, number]]
        : []),
      ...(guia?.geometria?.coordinates ?? []),
      ...(caminosAlternativos?.flatMap(
        (opcion) => opcion.geometria.coordinates,
      ) ?? []),
    ];
    if (coordenadas.length)
      mapa.fitBounds(
        latLngBounds(coordenadas.map(([lon, lat]) => [lat, lon])),
        {
          paddingTopLeft: [40, 110],
          paddingBottomRight: [70, 220],
          maxZoom: 16,
          animate: false,
        },
      );
    // El encuadre cambia con el plan o al pedirlo, nunca con cada consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa, clavePlan]);
  useEffect(() => {
    if (seguir && posicion)
      mapa.setView(
        [posicion.latitud, posicion.longitud],
        Math.max(mapa.getZoom(), 16),
        { animate: false },
      );
  }, [mapa, seguir, posicion]);
  useEffect(() => {
    const contenedor = mapa.getContainer();
    const observador = new ResizeObserver(() =>
      mapa.invalidateSize({ pan: false }),
    );
    observador.observe(contenedor);
    return () => observador.disconnect();
  }, [mapa]);
  return null;
}
export interface PropiedadesMapa {
  guia?: EstadoGuia;
  ruta: RutaViaje;
  paradas?: Parada[];
  estadoViaje?: EstadoViaje;
  mostrarCompleto?: boolean;
  caminosAlternativos?: OpcionCamino[];
  posicion: PosicionChofer | null;
  revision: number;
  seguir: boolean;
  alMover: () => void;
  alError: () => void;
  alCargar: () => void;
}
export default function MapaChofer(propiedades: PropiedadesMapa) {
  const { ruta, posicion } = propiedades,
    t = useTranslations("chofer");
  const vista = vistaRecorrido(
    ruta,
    propiedades.paradas,
    propiedades.estadoViaje,
    propiedades.mostrarCompleto,
  );
  const { puntos, tramos, lineaGlobal } = vista;
  const guia =
    !propiedades.mostrarCompleto && posicion ? propiedades.guia : undefined;
  const colorGuia =
    ruta.plan?.tramos.find((tramo) => tramo.orden === guia?.tramo)?.color ??
    "#16803C";
  const siguiente =
    propiedades.estadoViaje === "en_ruta"
      ? puntos.find(
          (punto) =>
            punto.tipo === "sucursal" &&
            propiedades.paradas?.some(
              (parada) => parada.id === punto.parada && !parada.descargadaEn,
            ),
        )
      : null;
  const primero =
    puntos.find((punto) => punto.posicion)?.posicion ??
    (posicion ? [posicion.longitud, posicion.latitud] : null);
  if (!primero)
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-gray-600 dark:text-gray-300">
        {t("sinCoordenadas")}
      </div>
    );
  return (
    <MapContainer
      center={[primero[1], primero[0]]}
      zoom={13}
      zoomControl={false}
      className={estilos.mapa}
      scrollWheelZoom
    >
      <ControlesVista {...propiedades} vista={vista} />
      {propiedades.caminosAlternativos?.map((opcion) => (
        <Polyline
          key={`opcion:${opcion.opcion}`}
          positions={opcion.geometria.coordinates.map(([lon, lat]) => [
            lat,
            lon,
          ])}
          pathOptions={{
            color: "#64748b",
            weight: 4,
            opacity: 0.65,
            dashArray: "6 6",
          }}
        />
      ))}
      {tramos
        ? tramos
            .filter((tramo) => !guia?.geometria || tramo.orden !== guia.tramo)
            .map((tramo) => (
              <Polyline
                key={tramo.orden}
                positions={tramo.geometria!.coordinates.map(([lon, lat]) => [
                  lat,
                  lon,
                ])}
                pathOptions={{
                  color: tramo.color ?? "#16803C",
                  weight: 6,
                  opacity: guia?.geometria ? 0.45 : 0.95,
                  dashArray: ruta.estado === "lista" ? undefined : "10 5",
                }}
              />
            ))
        : lineaGlobal && (
            <Polyline
              positions={lineaGlobal.coordinates.map(([lon, lat]) => [
                lat,
                lon,
              ])}
              pathOptions={{
                color: "#16803C",
                weight: 6,
                opacity: guia?.geometria ? 0.25 : 0.95,
                dashArray: ruta.estado === "lista" ? undefined : "10 5",
              }}
            />
          )}
      {guia?.geometria && (
        <Polyline
          positions={guia.geometria.coordinates.map(([lon, lat]) => [lat, lon])}
          pathOptions={{ color: colorGuia, weight: 7, opacity: 1 }}
        />
      )}
      {puntos
        .filter((punto) => punto.tipo !== "retorno" && punto.posicion)
        .map((punto) => {
          const entregada =
            punto.tipo === "sucursal" && vista.completadas.has(punto.parada!);
          const etiqueta = entregada
            ? t("destinoEntregado", { nombre: punto.nombre })
            : punto.nombre;
          return (
            <Marker
              key={`${punto.tipo}:${punto.parada ?? "almacen"}`}
              position={[punto.posicion![1], punto.posicion![0]]}
              title={etiqueta}
              alt={etiqueta}
              zIndexOffset={punto === siguiente ? 400 : 0}
              icon={divIcon({
                className: `${estilos.destino} ${punto === siguiente ? estilos.destinoSiguiente : ""}`,
                html: `<span>${iconoMapaDestino(punto.tipo === "almacen", punto.color ?? "#2563eb")}${punto.tipo === "sucursal" ? `<b style="background:${/^#[0-9a-f]{6}$/i.test(punto.color ?? "") ? punto.color : "#2563eb"}">${Number(punto.orden)}</b>` : ""}${entregada ? `<span class="${estilos.estadoEntregada}" aria-hidden="true">✓</span>` : ""}</span>`,
                iconSize: [44, 52],
                iconAnchor: [22, 48],
              })}
            >
              <Popup>
                <strong>{punto.nombre}</strong>
                <br />
                {punto.cliente}
                {entregada && (
                  <p className="mt-1 font-medium text-brand-700 dark:text-brand-300">
                    {t("sucursalEntregada")}
                  </p>
                )}
              </Popup>
            </Marker>
          );
        })}
      {posicion && (
        <>
          <Circle
            center={[posicion.latitud, posicion.longitud]}
            radius={posicion.precisionM}
            pathOptions={{
              color: "#16803C",
              fillColor: "#16803C",
              fillOpacity: 0.12,
              weight: 1,
            }}
          />
          <Marker
            position={[posicion.latitud, posicion.longitud]}
            alt={t("miUbicacion")}
            title={t("miUbicacion")}
            zIndexOffset={1000}
            icon={divIcon({
              className: estilos.camion,
              html: iconoCamionMapa,
              iconSize: [52, 52],
              iconAnchor: [26, 26],
            })}
          >
            <Popup>
              {t("precision", { metros: Math.round(posicion.precisionM) })}
            </Popup>
          </Marker>
        </>
      )}
    </MapContainer>
  );
}
