import { Redirect, useLocalSearchParams } from "expo-router";
import PantallaMapaViaje from "@/modulos/recorrido/presentacion/PantallaMapaViaje";

export default function MapaViaje() {
  const parametros = useLocalSearchParams<{ identificador: string }>();
  const identificador = Number(parametros.identificador);
  return Number.isSafeInteger(identificador) && identificador > 0 ? (
    <PantallaMapaViaje key={identificador} identificador={identificador} />
  ) : (
    <Redirect href="/(chofer)/viajes" />
  );
}
