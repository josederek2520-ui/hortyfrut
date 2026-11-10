"use client";
import { useState } from "react";
import type { PaginaCompra } from "@/components/compras/tipos";
import useConsultaPreparacion from "./useConsultaPreparacion";
import { desdeNecesidad } from "./calculos";
import {
  errorSucursalProducto,
  sucursalesAnotadasProducto,
  type SucursalProductoPreparacion,
} from "./sucursalesProductoPreparacion";
import type {
  DocumentoEditable,
  NecesidadPreparacion,
  ProductoPreparacion,
} from "./tipos";

export default function useRepartoSucursalPreparacion({
  producto,
  documento,
  contexto,
  errores,
  ocupado,
  alError,
  paginaInicial = 1,
  mostrarAnotadas = false,
}: {
  producto: ProductoPreparacion;
  documento: DocumentoEditable;
  contexto: string;
  errores: Record<string, string[]>;
  ocupado: boolean;
  alError: (error: unknown) => void;
  paginaInicial?: number;
  mostrarAnotadas?: boolean;
}) {
  const guardadas = Object.values(documento.asignaciones);
  const delProducto = guardadas.filter((fila) => fila.producto === producto.id);
  const gruposAnotados = sucursalesAnotadasProducto(documento, producto.id);
  const destinoError = errorSucursalProducto(documento, producto.id, errores);
  const posicionError = gruposAnotados.findIndex(
    (fila) => fila.id === destinoError?.sucursal,
  );
  const filasError = delProducto.filter(
    (fila) => fila.sucursal === destinoError?.sucursal,
  );
  const [anotadas, establecerAnotadas] = useState(mostrarAnotadas);
  const [pagina, establecerPagina] = useState(
    mostrarAnotadas && posicionError >= 0
      ? Math.floor(posicionError / 10) + 1
      : paginaInicial,
  );
  const [detalle, establecerDetalle] = useState<{
    sucursal: number | null;
    pagina: number;
    ultima?: boolean;
  }>({
    sucursal: mostrarAnotadas ? (destinoError?.sucursal ?? null) : null,
    pagina:
      mostrarAnotadas && destinoError?.asignacion
        ? Math.floor(
            Math.max(
              0,
              filasError.findIndex(
                (fila) => fila.clave === destinoError.asignacion,
              ),
            ) / 10,
          ) + 1
        : 1,
  });
  const paginaActual = anotadas
    ? Math.min(pagina, Math.max(1, Math.ceil(gruposAnotados.length / 10)))
    : pagina;
  const consultaSucursales = useConsultaPreparacion<
    PaginaCompra<SucursalProductoPreparacion>
  >(
    anotadas
      ? null
      : `preparaciones/sucursales-producto/?${contexto}&producto=${producto.id}&pagina=${paginaActual}`,
    alError,
  );
  const sucursales = anotadas
    ? gruposAnotados.slice((paginaActual - 1) * 10, paginaActual * 10)
    : (consultaSucursales.datos?.results ?? []);
  const elegida =
    sucursales.find((fila) => fila.id === detalle.sucursal) ??
    (detalle.ultima ? sucursales.at(-1) : sucursales[0]) ??
    null;
  const guardadasSucursal = delProducto.filter(
    (fila) => fila.sucursal === elegida?.id,
  );
  const paginaSolicitada =
    detalle.sucursal === elegida?.id ? detalle.pagina : 1;
  const paginaPedidos = anotadas
    ? Math.min(
        paginaSolicitada,
        Math.max(1, Math.ceil(guardadasSucursal.length / 10)),
      )
    : paginaSolicitada;
  const consultaPedidos = useConsultaPreparacion<
    PaginaCompra<NecesidadPreparacion>
  >(
    !anotadas && elegida
      ? `preparaciones/necesidades/?${contexto}&producto=${producto.id}&sucursal=${elegida.id}&pagina=${paginaPedidos}`
      : null,
    alError,
  );
  const filas = anotadas
    ? guardadasSucursal.slice((paginaPedidos - 1) * 10, paginaPedidos * 10)
    : (consultaPedidos.datos?.results ?? [])
        .filter(
          (fila) =>
            fila.sucursal === elegida?.id && fila.producto === producto.id,
        )
        .map((fuente) => ({
          ...(documento.asignaciones[String(fuente.id)] ??
            desdeNecesidad(fuente)),
          pendiente: fuente.pendiente,
          solicitada: fuente.cantidad,
          disponible: fuente.disponible,
          imagen: producto.imagen,
          categoria: producto.categoria ?? undefined,
        }));
  const totalSucursales = anotadas
    ? gruposAnotados.length
    : (consultaSucursales.datos?.count ?? 0);
  const indiceSucursal = sucursales.findIndex(
    (fila) => fila.id === elegida?.id,
  );
  const posicionSucursal =
    (paginaActual - 1) * 10 + Math.max(0, indiceSucursal);
  const cambiarPagina = (nueva: number) => {
    if (!ocupado) {
      establecerPagina(nueva);
      establecerDetalle({ sucursal: null, pagina: 1 });
    }
  };
  const elegir = (id: number) => {
    if (!ocupado && sucursales.some((fila) => fila.id === id))
      establecerDetalle({ sucursal: id, pagina: 1 });
  };
  return {
    guardadas,
    delProducto,
    sucursales,
    elegida,
    filas,
    anotadas,
    pagina: paginaActual,
    paginaPedidos,
    totalSucursales,
    posicionSucursal,
    totalPedidos: anotadas
      ? guardadasSucursal.length
      : (consultaPedidos.datos?.count ?? 0),
    totalAnotadas: gruposAnotados.length,
    cargandoSucursales: !anotadas && consultaSucursales.cargando,
    falloSucursales: !anotadas && consultaSucursales.fallo,
    cargandoPedidos: !anotadas && consultaPedidos.cargando,
    falloPedidos: !anotadas && consultaPedidos.fallo,
    elegir,
    cambiarPagina,
    cambiarPaginaPedidos: (nueva: number) => {
      if (!ocupado && elegida)
        establecerDetalle({ sucursal: elegida.id, pagina: nueva });
    },
    cambiarVista: () => {
      if (!ocupado) {
        establecerAnotadas(!anotadas);
        establecerPagina(1);
        establecerDetalle({ sucursal: null, pagina: 1 });
      }
    },
    moverSucursal: (paso: number) => {
      if (
        ocupado ||
        posicionSucursal + paso < 0 ||
        posicionSucursal + paso >= totalSucursales
      )
        return;
      const siguiente = sucursales[indiceSucursal + paso];
      if (siguiente) elegir(siguiente.id);
      else {
        establecerPagina(paginaActual + paso);
        establecerDetalle({ sucursal: null, pagina: 1, ultima: paso < 0 });
      }
    },
    recargarSucursales: () => {
      cambiarPagina(1);
      consultaSucursales.recargar();
    },
    recargarPedidos: () => {
      if (elegida) establecerDetalle({ sucursal: elegida.id, pagina: 1 });
      consultaPedidos.recargar();
    },
  };
}
