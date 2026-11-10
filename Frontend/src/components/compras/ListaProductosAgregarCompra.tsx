"use client";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Search as IconoBuscar,
  ChevronRight as IconoElegir,
  PackageOpen as IconoVacio,
} from "lucide-react";
import ImagenProducto from "@/components/productos/ImagenProducto";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import { api, ApiError as ErrorApi } from "@/lib/api";
import DesplegableCompra from "./DesplegableCompra";
import PaginadorCompras from "./PaginadorCompras";
import CantidadesSolicitadasCompra from "./CantidadesSolicitadasCompra";
import {
  consultaProductosCompra,
  type OrigenProductosCompra,
} from "./seleccionProductosCompra";
import type {
  OpcionCompra,
  PaginaCompra,
  ProductoAgregarCompra,
} from "./tipos";

export default function ListaProductosAgregarCompra({
  fecha,
  excluidos,
  oculta,
  deshabilitado,
  alElegir,
  alError,
}: {
  fecha: string;
  excluidos: number[];
  oculta: boolean;
  deshabilitado: boolean;
  alElegir: (producto: ProductoAgregarCompra) => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("compras");
  const identificador = useId();
  const [origen, establecerOrigen] = useState<OrigenProductosCompra>("pedidos");
  const [buscar, establecerBuscar] = useState("");
  const [categoria, establecerCategoria] = useState<OpcionCompra | null>(null);
  const [pagina, establecerPagina] = useState(1);
  const [revision, establecerRevision] = useState(0);
  const [respuesta, establecerRespuesta] = useState<{
    consulta: string;
    datos: PaginaCompra<ProductoAgregarCompra>;
  } | null>(null);
  const [consultaFallida, establecerConsultaFallida] = useState("");
  const consulta = consultaProductosCompra({
    origen,
    fecha,
    buscar,
    pagina,
    categoria,
    excluidos,
  });
  const datos = respuesta?.consulta === consulta ? respuesta.datos : null;
  const fallo = consultaFallida === consulta;
  const cargando = !datos && !fallo;
  useEffect(() => {
    if (oculta) return;
    const controlador = new AbortController();
    const temporizador = setTimeout(
      async () => {
        try {
          const datos = await api<PaginaCompra<ProductoAgregarCompra>>(
            consulta,
            { signal: controlador.signal },
          );
          if (!controlador.signal.aborted) {
            establecerRespuesta({ consulta, datos });
            establecerConsultaFallida("");
          }
        } catch (error) {
          if (controlador.signal.aborted) return;
          if (error instanceof ErrorApi && error.status === 404 && pagina > 1)
            establecerPagina(1);
          else {
            establecerConsultaFallida(consulta);
            alError(error);
          }
        }
      },
      buscar ? 250 : 0,
    );
    return () => {
      clearTimeout(temporizador);
      controlador.abort();
    };
  }, [consulta, revision, oculta, alError, buscar, pagina]);
  return (
    <div className={oculta ? "hidden" : "space-y-4"}>
      <div
        role="group"
        aria-label={t("origenProductosAgregar")}
        className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
      >
        {(["pedidos", "catalogo"] as const).map((valor) => (
          <button
            key={valor}
            type="button"
            aria-pressed={origen === valor}
            onClick={() => {
              establecerOrigen(valor);
              establecerPagina(1);
            }}
            className="pestana-hortyfru min-h-11 flex-1 rounded-lg px-3 text-sm font-medium text-gray-700 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-200"
          >
            {t(
              valor === "pedidos"
                ? "productosPedidosFecha"
                : "todosProductosAgregar",
            )}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,.7fr)]">
        <div className="relative">
          <IconoBuscar
            className="pointer-events-none absolute start-3 top-3.5 size-4 text-gray-400"
            aria-hidden="true"
          />
          <Input
            id={identificador}
            type="search"
            maxLength={150}
            value={buscar}
            aria-label={t("buscarProducto")}
            placeholder={t("buscarProducto")}
            className="ps-10"
            onChange={(evento) => {
              establecerBuscar(evento.target.value);
              establecerPagina(1);
            }}
            data-foco-inicial
          />
        </div>
        <div className="[&_label]:sr-only">
          <DesplegableCompra
            tipo="general"
            ruta="compras/categorias/"
            etiqueta={t("categoriasProductos")}
            valor={categoria}
            alElegir={(opcion) => {
              establecerCategoria(opcion);
              establecerPagina(1);
            }}
            alError={alError}
            opcionVacia={t("todasCategorias")}
          />
        </div>
      </div>
      {fallo ? (
        <div
          role="alert"
          className="space-y-3 rounded-xl bg-error-50 p-4 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400"
        >
          <p>{t("errorOpciones")}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              establecerConsultaFallida("");
              establecerRevision((valor) => valor + 1);
            }}
          >
            {t("reintentar")}
          </Button>
        </div>
      ) : cargando ? (
        <div role="status" aria-label={t("cargando")} className="space-y-2">
          {[0, 1, 2].map((indice) => (
            <div
              key={indice}
              className="h-20 rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800"
            />
          ))}
        </div>
      ) : !datos?.results.length ? (
        <div
          role="status"
          className="flex flex-col items-center gap-3 rounded-2xl bg-gray-50 px-5 py-8 text-center dark:bg-gray-800/50"
        >
          <IconoVacio className="size-8 text-gray-400" aria-hidden="true" />
          <p className="max-w-sm text-sm leading-6 text-gray-600 dark:text-gray-300">
            {t(
              buscar || categoria
                ? "sinResultadosAgregar"
                : origen === "pedidos"
                  ? "sinProductosPedidosAgregar"
                  : "sinProductosCatalogoAgregar",
            )}
          </p>
          {origen === "pedidos" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                establecerOrigen("catalogo");
                establecerPagina(1);
              }}
            >
              {t("todosProductosAgregar")}
            </Button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {datos.results
            .filter((producto) => !excluidos.includes(producto.id))
            .map((producto) => (
              <li key={producto.id}>
                <button
                  type="button"
                  disabled={deshabilitado || producto.disponible === false}
                  data-producto-compra={producto.id}
                  onClick={() => alElegir(producto)}
                  className="group grid min-h-24 w-full grid-cols-[2.75rem_minmax(0,1fr)_1rem] items-center gap-x-3 gap-y-1 rounded-xl px-3 py-4 text-start transition-colors hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-40 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto_auto] dark:hover:bg-brand-500/10"
                >
                  <ImagenProducto
                    origen={producto.imagen || null}
                    nombre={producto.nombre}
                  />
                  <span className="col-start-2 min-w-0">
                    <span className="block text-sm font-semibold break-words text-gray-900 dark:text-white">
                      {producto.nombre}
                    </span>
                    <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
                      {producto.categoria?.nombre || producto.subtitulo}
                    </span>
                  </span>
                  <span className="col-start-2 row-start-2 sm:col-start-3 sm:row-start-1 sm:max-w-52 sm:text-end">
                    {(producto.cajas || 0) > 0 ||
                    (producto.unidades || 0) > 0 ? (
                      <>
                        <span className="block text-theme-xs text-gray-500 dark:text-gray-400">
                          {t("solicitadoAgregar")}
                        </span>
                        <span className="mt-1 block text-sm text-gray-800 dark:text-gray-200">
                          <CantidadesSolicitadasCompra
                            cajas={producto.cajas}
                            unidades={producto.unidades}
                          />
                        </span>
                      </>
                    ) : (
                      <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                        {t("productoCatalogoAgregar")}
                      </span>
                    )}
                  </span>
                  <span className="col-start-3 row-start-1 inline-flex items-center gap-1 text-sm font-medium text-brand-700 sm:col-start-4 dark:text-brand-300">
                    <span className="hidden sm:inline">
                      {t("elegirProductoAccion")}
                    </span>
                    <IconoElegir
                      className="size-4 rtl:rotate-180"
                      aria-hidden="true"
                    />
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
      {!!datos?.count && !fallo && (
        <PaginadorCompras
          pagina={pagina}
          total={datos?.count || 0}
          alCambiar={establecerPagina}
          ocupado={cargando || fallo}
        />
      )}
    </div>
  );
}
