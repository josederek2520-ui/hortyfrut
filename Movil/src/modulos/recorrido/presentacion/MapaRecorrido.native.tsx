import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import { SvgXml } from "react-native-svg";
import { Texto } from "@/compartido/componentes/Elementos";
import { usarInterfaz } from "@/compartido/tema/ProveedorInterfaz";
import { limitesRuta } from "../aplicacion/geometriaRuta";
import { colorPuntoRuta, lineasColoreadas } from "../aplicacion/coloresRuta";
import { iconoMapaDestino, iconoCamionMapa } from "./iconosMapa";
import { areaPrecision } from "@/modulos/seguimiento/aplicacion/geometriaUbicacion";
import type { PropiedadesMapa } from "./tiposMapa";

export default function MapaRecorrido({
  ruta,
  siguiente,
  espacioSuperior,
  espacioInferior,
  revisionEncuadre,
  posicionChofer,
  centroUbicacion,
  alIniciarCarga,
  alError,
  alCargar,
}: PropiedadesMapa) {
  const { colores, oscuro, reducirMovimiento, t } = usarInterfaz();
  const camara = useRef<CameraRef>(null);
  const [listo, establecerListo] = useState(false);
  const [altosEtiquetas, establecerAltosEtiquetas] = useState<
    Record<string, number>
  >({});
  const planVigente = ruta.estado !== "obsoleta" ? ruta.plan : null;
  const posiciones = useMemo(
    () =>
      planVigente?.geometria.coordinates ??
      ruta.puntos.flatMap((punto) => (punto.posicion ? [punto.posicion] : [])),
    [ruta, planVigente],
  );
  const limites = useMemo(() => limitesRuta(posiciones), [posiciones]);
  useEffect(() => {
    if (listo && limites)
      camara.current?.fitBounds(limites, {
        padding: {
          top: espacioSuperior + 40,
          bottom: espacioInferior + 35,
          left: 45,
          right: 45,
        },
        duration: reducirMovimiento ? 0 : 280,
      });
  }, [
    listo,
    limites,
    espacioSuperior,
    espacioInferior,
    revisionEncuadre,
    reducirMovimiento,
  ]);
  const puntos = planVigente?.puntos ?? ruta.puntos;
  const lineas = useMemo(
    () => (planVigente ? lineasColoreadas(planVigente) : null),
    [planVigente],
  );
  const precision = useMemo(
    () => (posicionChofer ? areaPrecision(posicionChofer) : null),
    [posicionChofer],
  );
  useEffect(() => {
    if (listo && centroUbicacion)
      camara.current?.easeTo({
        center: centroUbicacion,
        zoom: 15,
        duration: reducirMovimiento ? 0 : 280,
      });
  }, [centroUbicacion, listo, reducirMovimiento]);
  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={`https://tiles.openfreemap.org/styles/${oscuro ? "dark" : "liberty"}`}
      attribution
      attributionPosition={{ top: espacioSuperior + 8, left: 12 }}
      logo={false}
      compass={false}
      onWillStartLoadingMap={alIniciarCarga}
      onDidFinishLoadingStyle={() => {
        establecerListo(true);
      }}
      onDidFinishLoadingMap={() => {
        establecerListo(true);
        alCargar();
      }}
      onDidFinishRenderingMapFully={alCargar}
      onDidFailLoadingMap={alError}
    >
      <Camera
        ref={camara}
        initialViewState={
          limites
            ? {
                bounds: limites,
                padding: {
                  top: espacioSuperior + 40,
                  bottom: espacioInferior + 35,
                  left: 45,
                  right: 45,
                },
              }
            : posicionChofer
              ? {
                  center: [posicionChofer.longitud, posicionChofer.latitud],
                  zoom: 14,
                }
              : undefined
        }
      />
      {planVigente && (
        <GeoJSONSource id="recorrido-aprobado" data={lineas!}>
          <Layer
            id="borde-recorrido"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": colores.tarjeta,
              "line-width": 8,
              "line-opacity": 0.85,
            }}
          />
          <Layer
            id="linea-recorrido"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": ["get", "color"],
              "line-width": 5,
              "line-dasharray": ruta.estado === "lista" ? [1, 0] : [3, 1],
            }}
          />
        </GeoJSONSource>
      )}
      {precision && (
        <GeoJSONSource id="precision-chofer" data={precision}>
          <Layer
            id="area-precision-chofer"
            type="fill"
            paint={{
              "fill-color": colores.pendienteTexto,
              "fill-opacity": 0.15,
            }}
          />
          <Layer
            id="borde-precision-chofer"
            type="line"
            paint={{ "line-color": colores.pendienteTexto, "line-width": 1 }}
          />
        </GeoJSONSource>
      )}
      {posicionChofer && (
        <Marker
          lngLat={[posicionChofer.longitud, posicionChofer.latitud]}
          anchor="center"
        >
          <View
            accessible
            accessibilityLabel={t("gpsTuUbicacion")}
            style={[
              estilos.marcador,
              {
                width: 56,
                height: 56,
                backgroundColor: colores.tarjeta,
                borderColor: colores.pendienteTexto,
              },
            ]}
          >
            <SvgXml xml={iconoCamionMapa} width={44} height={44} />
          </View>
        </Marker>
      )}
      {puntos
        .filter((punto) => punto.tipo !== "retorno" && punto.posicion)
        .map((punto) => (
          <Marker
            key={`${punto.tipo}:${punto.parada ?? "origen"}`}
            lngLat={punto.posicion!}
            anchor="bottom"
            offset={[
              0,
              (altosEtiquetas[String(punto.parada ?? "almacen")] ?? 18) + 4,
            ]}
          >
            <View
              accessible
              accessibilityLabel={`${punto.tipo === "almacen" ? t("almacen") : punto.orden}: ${punto.nombre}`}
              style={{ alignItems: "center", maxWidth: 180 }}
            >
              <View
                style={[
                  estilos.marcador,
                  {
                    backgroundColor: colores.tarjeta,
                    borderColor: colorPuntoRuta(punto),
                    borderWidth: punto.parada === siguiente ? 3 : 1,
                  },
                ]}
              >
                <SvgXml
                  xml={iconoMapaDestino(
                    punto.tipo === "almacen",
                    colorPuntoRuta(punto),
                  )}
                  width={36}
                  height={36}
                />
                {punto.tipo === "sucursal" && (
                  <View
                    style={{
                      position: "absolute",
                      right: -8,
                      top: -8,
                      borderRadius: 10,
                      minWidth: 21,
                      backgroundColor: colorPuntoRuta(punto),
                      borderWidth: 2,
                      borderColor: colores.tarjeta,
                      alignItems: "center",
                    }}
                  >
                    <Texto
                      color={colores.blanco}
                      style={{
                        fontWeight: "700",
                        fontSize: 11,
                        lineHeight: 17,
                      }}
                    >
                      {punto.orden}
                    </Texto>
                  </View>
                )}
              </View>
              <View
                onLayout={(evento) => {
                  const clave = String(punto.parada ?? "almacen"),
                    alto = evento.nativeEvent.layout.height;
                  establecerAltosEtiquetas((anteriores) =>
                    anteriores[clave] === alto
                      ? anteriores
                      : { ...anteriores, [clave]: alto },
                  );
                }}
                style={{
                  backgroundColor: colores.tarjeta,
                  borderRadius: 9,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  marginTop: 4,
                }}
              >
                <Texto
                  tipo="pequeno"
                  style={{ textAlign: "center", fontWeight: "600" }}
                >
                  {punto.nombre}
                </Texto>
              </View>
            </View>
          </Marker>
        ))}
    </Map>
  );
}
const estilos = StyleSheet.create({
  marcador: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
});
