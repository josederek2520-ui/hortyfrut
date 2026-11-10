"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { consultaReferenciasPedidosCompra } from "./seleccionProductosCompra";
import type {
  LineaFormularioCompra,
  NecesidadProducto,
  PaginaCompra,
} from "./tipos";

export default function useReferenciasPedidosCompra(
  fecha: string,
  lineas: LineaFormularioCompra[],
  alError: (error: unknown) => void,
) {
  const [revision, establecerRevision] = useState(0);
  const [respuesta, establecerRespuesta] = useState<{
    clave: string;
    necesidades: Record<number, NecesidadProducto>;
  } | null>(null);
  const [consultaFallida, establecerConsultaFallida] = useState("");
  const consulta = consultaReferenciasPedidosCompra(fecha, lineas);
  const clave = consulta ? `${consulta}|${revision}` : "";
  const necesidades = respuesta?.clave === clave ? respuesta.necesidades : null;
  const fallo = !!consulta && !necesidades && consultaFallida === clave;
  useEffect(() => {
    if (!consulta) return;
    const controlador = new AbortController();
    const consultar = async () => {
      try {
        const datos = await api<PaginaCompra<NecesidadProducto>>(consulta, {
          signal: controlador.signal,
        });
        if (!controlador.signal.aborted) {
          establecerRespuesta({
            clave,
            necesidades: Object.fromEntries(
              datos.results.map((producto) => [producto.id, producto]),
            ),
          });
        }
      } catch (error) {
        if (!controlador.signal.aborted) {
          establecerConsultaFallida(clave);
          alError(error);
        }
      }
    };
    void consultar();
    return () => controlador.abort();
  }, [consulta, clave, alError]);
  return {
    necesidades,
    cargando: !!consulta && !necesidades && !fallo,
    fallo,
    reintentar: () => establecerRevision((valor) => valor + 1),
  };
}
