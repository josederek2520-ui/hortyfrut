"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { LineaPrecio, OpcionPrecio } from "./tipos";

export interface OrigenPedidosPrecio {
  cliente: number;
  desde: string;
  hasta: string;
  revision: number;
}
interface PaginaOrigen {
  count: number;
  results: OpcionPrecio[];
  version_origen: string;
}

export default function useProductosPedidosPrecio(
  origen: OrigenPedidosPrecio | null,
) {
  const [revision, establecerRevision] = useState(0);
  const [consulta, establecerConsulta] = useState<{
    clave: string;
    lineas?: LineaPrecio[];
    fallo?: string;
  } | null>(null);
  const cliente = origen?.cliente,
    desde = origen?.desde,
    hasta = origen?.hasta,
    solicitud = origen?.revision;
  const clave = JSON.stringify([cliente, desde, hasta, solicitud, revision]);
  const actual = origen && consulta?.clave === clave ? consulta : null;
  const reintentar = useCallback(
    () => establecerRevision((valor) => valor + 1),
    [],
  );
  useEffect(() => {
    if (!cliente || !desde || !hasta || desde > hasta) return;
    const controlador = new AbortController();
    const pagina = (numero: number) =>
      api<PaginaOrigen>(
        "precios-acordados/productos-pedidos/?" +
          new URLSearchParams({
            cliente: String(cliente),
            desde,
            hasta,
            pagina: String(numero),
          }),
        { signal: controlador.signal },
      );
    void (async () => {
      try {
        const primera = await pagina(1);
        if (primera.count > 500) {
          if (!controlador.signal.aborted)
            establecerConsulta({ clave, fallo: "demasiadosProductosPedidos" });
          return;
        }
        const filas = [...primera.results];
        for (
          let numero = 2;
          numero <= Math.ceil(primera.count / 10);
          numero += 1
        ) {
          if (controlador.signal.aborted) return;
          const siguiente = await pagina(numero);
          if (
            siguiente.count !== primera.count ||
            siguiente.version_origen !== primera.version_origen
          ) {
            if (!controlador.signal.aborted)
              establecerConsulta({ clave, fallo: "pedidosCambiaron" });
            return;
          }
          filas.push(...siguiente.results);
        }
        if (
          filas.length !== primera.count ||
          new Set(filas.map((fila) => fila.id)).size !== primera.count
        ) {
          if (!controlador.signal.aborted)
            establecerConsulta({ clave, fallo: "pedidosCambiaron" });
          return;
        }
        if (!controlador.signal.aborted)
          establecerConsulta({
            clave,
            lineas: filas.map((fila) => ({
              producto: fila.id,
              producto_nombre: fila.nombre,
              categoria_nombre: fila.categoria_nombre ?? "",
              imagen: fila.imagen ?? null,
              precio_kg: "",
              precio_anterior: null,
            })),
          });
      } catch {
        if (!controlador.signal.aborted)
          establecerConsulta({ clave, fallo: "errorProductosPedidos" });
      }
    })();
    return () => controlador.abort();
  }, [cliente, desde, hasta, solicitud, revision, clave]);
  return {
    clave,
    lineas: actual?.lineas,
    fallo: actual?.fallo,
    cargando:
      !!origen && !!cliente && !!desde && !!hasta && desde <= hasta && !actual,
    reintentar,
  };
}
