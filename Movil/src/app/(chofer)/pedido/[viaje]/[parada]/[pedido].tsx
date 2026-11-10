import { useLocalSearchParams, Redirect } from "expo-router";
import PantallaPedido from "@/modulos/recorrido/presentacion/PantallaPedido";
export default function Pedido() {
  const parametros = useLocalSearchParams<{
    viaje: string;
    parada: string;
    pedido: string;
  }>();
  const [viajeId, paradaId, pedidoId] = [
    Number(parametros.viaje),
    Number(parametros.parada),
    Number(parametros.pedido),
  ];
  return [viajeId, paradaId, pedidoId].every(
    (valor) => Number.isSafeInteger(valor) && valor! > 0,
  ) ? (
    <PantallaPedido
      key={`${viajeId}:${paradaId}:${pedidoId}`}
      viajeId={viajeId!}
      paradaId={paradaId!}
      pedidoId={pedidoId!}
    />
  ) : (
    <Redirect href="/(chofer)/viajes" />
  );
}
