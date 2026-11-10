import { useLocalSearchParams, Redirect } from "expo-router";
import PantallaRecorrido from "@/modulos/recorrido/presentacion/PantallaRecorrido";
export default function Recorrido() {
  const parametros = useLocalSearchParams<{ identificador: string }>();
  const identificador = Number(parametros.identificador);
  return Number.isSafeInteger(identificador) && identificador > 0 ? (
    <PantallaRecorrido key={identificador} identificador={identificador} />
  ) : (
    <Redirect href="/(chofer)/viajes" />
  );
}
