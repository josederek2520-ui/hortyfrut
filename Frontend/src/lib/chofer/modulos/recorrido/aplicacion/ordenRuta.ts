import { ErrorAplicacion } from "@/lib/chofer/compartido/dominio/Errores";
import type { RutaViaje } from "../dominio/Ruta";

export function paradasRuta(ruta: RutaViaje) {
  return ruta.puntos.filter((punto) => punto.tipo === "sucursal");
}
export function moverParada(orden: number[], indice: number, cambio: -1 | 1) {
  const destino = indice + cambio;
  if (
    !Number.isInteger(indice) ||
    indice < 0 ||
    indice >= orden.length ||
    destino < 0 ||
    destino >= orden.length
  )
    return orden;
  const nuevo = [...orden];
  [nuevo[indice], nuevo[destino]] = [nuevo[destino]!, nuevo[indice]!];
  return nuevo;
}
export function ordenarRuta(ruta: RutaViaje, orden: number[]): RutaViaje {
  const paradas = paradasRuta(ruta),
    porId = new Map(paradas.map((punto) => [punto.parada, punto]));
  if (
    orden.length !== paradas.length ||
    new Set(orden).size !== orden.length ||
    orden.some((id) => !porId.has(id))
  )
    throw new ErrorAplicacion("datos", 502);
  if (paradas.every((punto, indice) => punto.parada === orden[indice]))
    return ruta;
  const origen = ruta.puntos.find((punto) => punto.tipo === "almacen"),
    retorno = ruta.puntos.find((punto) => punto.tipo === "retorno");
  if (!origen || !retorno) throw new ErrorAplicacion("datos", 502);
  return {
    ...ruta,
    plan: null,
    estado: "sin_calcular",
    puedeAprobar: false,
    puntos: [
      origen,
      ...orden.map((id, indice) => ({ ...porId.get(id)!, orden: indice + 1 })),
      retorno,
    ],
  };
}
