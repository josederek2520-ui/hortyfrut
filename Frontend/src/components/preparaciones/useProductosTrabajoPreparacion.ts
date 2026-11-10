"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { api, ApiError as ErrorApi } from "@/lib/api";
import type { OpcionCompra, PaginaCompra } from "@/components/compras/tipos";
import { productosDelDocumento } from "./calculos";
import {
  pasoProductoPreparacion,
  type DireccionProductoPreparacion,
} from "./navegacionProductosPreparacion";
import type { DocumentoEditable, ProductoPreparacion } from "./tipos";

type VistaProductos = "pendientes" | "todos" | "anotados";

export default function useProductosTrabajoPreparacion(
  contexto: string,
  documento: DocumentoEditable,
  seleccionado: ProductoPreparacion | null,
  alAbrir: (producto: ProductoPreparacion) => void,
  alError: (error: unknown) => void,
) {
  const idioma = useLocale();
  const [vista, establecerVista] = useState<VistaProductos>("todos");
  const [pagina, establecerPagina] = useState(1);
  const [buscar, establecerBuscar] = useState("");
  const [categoria, establecerCategoria] = useState<OpcionCompra | null>(null);
  const [revision, establecerRevision] = useState(0);
  const [navegando, establecerNavegando] = useState(false);
  const [respuesta, establecerRespuesta] = useState<{
    clave: string;
    datos: PaginaCompra<ProductoPreparacion>;
    referencias: Record<number, ProductoPreparacion>;
  } | null>(null);
  const [consultaFallida, establecerConsultaFallida] = useState("");
  const navegacion = useRef<{
    pagina: number;
    origen: number;
    direccion: DireccionProductoPreparacion;
  } | null>(null);
  const parametros = new URLSearchParams(contexto);
  parametros.set("pagina", String(pagina));
  parametros.set("buscar", buscar);
  parametros.set("solo_pendientes", String(vista === "pendientes"));
  if (categoria) parametros.set("categoria", String(categoria.id));
  const consulta =
    vista === "anotados" ? null : `preparaciones/productos/?${parametros}`;
  const clave = JSON.stringify([consulta, revision]);
  const datos = respuesta?.clave === clave ? respuesta.datos : null;
  const fallo = !!consulta && !datos && consultaFallida === clave;
  const cargando = !!consulta && !datos && !fallo;
  const anotados = productosDelDocumento(documento)
    .map((producto) => ({
      ...respuesta?.referencias[producto.id],
      ...producto,
      categoria:
        producto.categoria || respuesta?.referencias[producto.id]?.categoria,
    }))
    .filter(
      (producto) =>
        (!categoria || producto.categoria?.id === categoria.id) &&
        producto.nombre
          .toLocaleLowerCase(idioma)
          .includes(buscar.toLocaleLowerCase(idioma)),
    );
  const paginaActual =
    vista === "anotados"
      ? Math.min(pagina, Math.max(1, Math.ceil(anotados.length / 10)))
      : pagina;
  const total = vista === "anotados" ? anotados.length : datos?.count || 0;
  const filas =
    vista === "anotados"
      ? anotados.slice((paginaActual - 1) * 10, paginaActual * 10)
      : datos?.results || [];
  useEffect(() => {
    if (!consulta) return;
    const controlador = new AbortController();
    const temporizador = setTimeout(
      async () => {
        try {
          const datos = await api<PaginaCompra<ProductoPreparacion>>(consulta, {
            signal: controlador.signal,
          });
          if (controlador.signal.aborted) return;
          establecerRespuesta((anterior) => ({
            clave,
            datos,
            referencias: {
              ...anterior?.referencias,
              ...Object.fromEntries(
                datos.results.map((producto) => [producto.id, producto]),
              ),
            },
          }));
          const pendiente = navegacion.current;
          if (pendiente?.pagina === pagina) {
            navegacion.current = null;
            establecerNavegando(false);
            const producto =
              pendiente.direccion === 1
                ? datos.results[0]
                : datos.results.at(-1);
            if (producto) alAbrir(producto);
          }
        } catch (error) {
          if (controlador.signal.aborted) return;
          establecerNavegando(false);
          if (error instanceof ErrorApi && error.status === 404 && pagina > 1) {
            navegacion.current = null;
            establecerPagina(1);
          } else {
            establecerConsultaFallida(clave);
            alError(error);
          }
        }
      },
      buscar ? 220 : 0,
    );
    return () => {
      clearTimeout(temporizador);
      controlador.abort();
    };
  }, [consulta, clave, pagina, buscar, alAbrir, alError]);
  const cancelarNavegacion = () => {
    const pendiente = navegacion.current;
    navegacion.current = null;
    establecerNavegando(false);
    if (pendiente) establecerPagina(pendiente.origen);
  };
  const mover = (direccion: DireccionProductoPreparacion) => {
    if (cargando || fallo || navegando) return;
    const paso = pasoProductoPreparacion(
      filas,
      seleccionado?.id,
      paginaActual,
      total,
      direccion,
    );
    if (!paso) return;
    if ("producto" in paso) alAbrir(paso.producto);
    else if (vista === "anotados") {
      const destino =
        anotados[(paso.pagina - 1) * 10 + (direccion === 1 ? 0 : 9)];
      if (destino) {
        establecerPagina(paso.pagina);
        alAbrir(destino);
      }
    } else {
      navegacion.current = {
        pagina: paso.pagina,
        origen: paginaActual,
        direccion,
      };
      establecerNavegando(true);
      establecerPagina(paso.pagina);
    }
  };
  return {
    contexto,
    vista,
    pagina: paginaActual,
    buscar,
    categoria,
    filas,
    total,
    cargando,
    fallo,
    navegando,
    puedeAnterior: !!pasoProductoPreparacion(
      filas,
      seleccionado?.id,
      paginaActual,
      total,
      -1,
    ),
    puedeSiguiente: !!pasoProductoPreparacion(
      filas,
      seleccionado?.id,
      paginaActual,
      total,
      1,
    ),
    mover,
    cancelarNavegacion,
    recargar: () => {
      if (navegacion.current) establecerNavegando(true);
      establecerRevision((valor) => valor + 1);
    },
    alVista: (valor: VistaProductos) => {
      cancelarNavegacion();
      establecerVista(valor);
      establecerPagina(1);
    },
    alBuscar: (valor: string) => {
      cancelarNavegacion();
      establecerBuscar(valor);
      establecerPagina(1);
    },
    alCategoria: (valor: OpcionCompra | null) => {
      cancelarNavegacion();
      establecerCategoria(valor);
      establecerPagina(1);
    },
    alPagina: (valor: number) => {
      cancelarNavegacion();
      establecerPagina(valor);
    },
  };
}

export type ConsultaProductosTrabajoPreparacion = ReturnType<
  typeof useProductosTrabajoPreparacion
>;
