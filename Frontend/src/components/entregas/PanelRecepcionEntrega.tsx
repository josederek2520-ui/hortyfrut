"use client";
import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import ImagenProducto from "@/components/productos/ImagenProducto";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import ConciliacionLotesEntrega from "./ConciliacionLotesEntrega";
import ReferenciaPedidoEntrega from "./ReferenciaPedidoEntrega";
import useConsultaEntrega from "./useConsultaEntrega";
import {
  lineaVacia,
  medirEntrega,
  mostrarMedicion,
  normalizarMedicion,
  pesoAceptado,
} from "./calculosEntrega";
import {
  entradaEntrega,
  type AporteEditable,
  type HojaEntrega,
  type LineaEditable,
  type PaginaEntrega,
  type ProductoEntrega,
} from "./tipos";
import estilos from "./estilosEntregas.module.css";

export type TipoPanelEntrega = "pedido" | "lotes";

export default function PanelRecepcionEntrega({
  abierto,
  tipo,
  productoElegido,
  ruta,
  hoja,
  lineas,
  aportes,
  oficina,
  soloLectura,
  bloqueado,
  errores,
  alProducto,
  alCambiarAportes,
  alCerrar,
}: {
  abierto: boolean;
  tipo: TipoPanelEntrega;
  productoElegido: number | null;
  ruta: string;
  hoja: HojaEntrega;
  lineas: Record<number, LineaEditable>;
  aportes: Record<string, AporteEditable>;
  oficina: boolean;
  soloLectura: boolean;
  bloqueado: boolean;
  errores: Record<string, string[]>;
  alProducto: (producto: number) => void;
  alCambiarAportes: (aportes: Record<string, AporteEditable>) => void;
  alCerrar: () => void;
}) {
  const t = useTranslations("entregas"),
    idioma = useLocale();
  const [paginaPedido, establecerPaginaPedido] = useState(1);
  const [buscarPedido, establecerBuscarPedido] = useState("");
  const [paginasAportes, establecerPaginasAportes] = useState<
    Record<number, number>
  >({});
  const productos = hoja.origen.productos;
  const indice = Math.max(
    0,
    productos.findIndex((producto) => producto.producto === productoElegido),
  );
  const producto = productos[indice];
  const visible = abierto && (tipo === "pedido" || oficina);
  const pagina = tipo === "pedido" ? paginaPedido : Math.floor(indice / 10) + 1;
  const consulta = useConsultaEntrega<PaginaEntrega<ProductoEntrega>>(
    visible
      ? ruta +
          "productos/?" +
          new URLSearchParams({
            pagina: String(pagina),
            buscar: tipo === "pedido" ? buscarPedido : "",
          })
      : null,
    tipo === "pedido" && buscarPedido.trim() ? 150 : 0,
  );
  const paginaAportes = producto ? (paginasAportes[producto.producto] ?? 1) : 1;
  const alPaginaAportes = useCallback(
    (nueva: number) => {
      if (!producto) return;
      establecerPaginasAportes((anteriores) =>
        anteriores[producto.producto] === nueva
          ? anteriores
          : { ...anteriores, [producto.producto]: nueva },
      );
    },
    [producto],
  );
  const linea = producto
    ? (lineas[producto.producto] ?? lineaVacia())
    : lineaVacia();
  const pesos = {
    recibido:
      medirEntrega(linea.peso_recibido_kg) === null
        ? null
        : normalizarMedicion(linea.peso_recibido_kg),
    rechazado:
      medirEntrega(linea.peso_rechazado_kg) === null
        ? null
        : normalizarMedicion(linea.peso_rechazado_kg),
    aceptado: pesoAceptado(linea),
  };
  const productoConsultado = consulta.datos?.results.find(
    (fila) => fila.producto === producto?.producto,
  );
  return (
    <Modal
      isOpen={visible}
      onClose={alCerrar}
      showCloseButton={false}
      posicion="derecha"
      labelledBy="titulo-panel-recepcion"
      claseFondo="bg-gray-900/20 dark:bg-black/40"
      className={`${estilos.entregas} ${estilos.panelLateral}`}
    >
      <div
        id="panel-recepcion-contenido"
        className="flex h-full min-w-0 flex-col text-gray-900 dark:text-gray-100"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 p-5 dark:border-gray-700">
          <div className="min-w-0">
            <h2
              id="titulo-panel-recepcion"
              tabIndex={-1}
              data-foco-inicial
              className="text-xl font-semibold outline-none"
            >
              {t(tipo === "pedido" ? "verPedido" : "conciliarLotes")}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t(
                tipo === "pedido"
                  ? "referenciaPanelAyuda"
                  : "conciliarPanelAyuda",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label={t("cerrarPanel")}
            className="control-suave-hortyfru inline-flex size-11 shrink-0 items-center justify-center rounded-xl focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>
        <div className="custom-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-5">
          {tipo === "pedido" ? (
            <label className="relative mb-3 block">
              <span className="sr-only">{t("buscarProducto")}</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-3.5 size-4 text-gray-500"
              />
              <input
                type="search"
                name="filtro_referencia_entrega"
                autoComplete="off"
                placeholder={t("buscarProducto")}
                className={entradaEntrega + " ps-10"}
                value={buscarPedido}
                onChange={(evento) => {
                  establecerBuscarPedido(evento.target.value);
                  establecerPaginaPedido(1);
                }}
              />
            </label>
          ) : (
            producto && (
              <div className="mb-4 flex min-w-0 items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                <ImagenProducto
                  origen={productoConsultado?.imagen ?? null}
                  nombre={producto.nombre}
                  sinRecorte
                />
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="producto-conciliacion-entrega"
                    className="text-xs text-gray-500 dark:text-gray-400"
                  >
                    {t("producto")}
                  </label>
                  <select
                    id="producto-conciliacion-entrega"
                    className={entradaEntrega + " mt-1 min-w-0"}
                    value={producto.producto}
                    disabled={!consulta.datos || !consulta.datos.results.length}
                    onChange={(evento) =>
                      alProducto(Number(evento.target.value))
                    }
                  >
                    {consulta.datos?.results.length ? (
                      consulta.datos.results.map((fila) => (
                        <option key={fila.producto} value={fila.producto}>
                          {fila.nombre}
                        </option>
                      ))
                    ) : (
                      <option value={producto.producto}>
                        {producto.nombre}
                      </option>
                    )}
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t("productoEnPanel", {
                      actual: indice + 1,
                      total: productos.length,
                    })}
                  </p>
                </div>
              </div>
            )
          )}
          {consulta.cargando ? (
            <p role="status" className="py-4">
              {t("cargando")}
            </p>
          ) : consulta.fallo ? (
            <div role="alert" className="space-y-3 py-4">
              <p>{t("errorConsulta")}</p>
              <Button variant="outline" onClick={consulta.reintentar}>
                {t("reintentarConsulta")}
              </Button>
            </div>
          ) : !consulta.datos?.count ? (
            <p className="py-4">{t("sinProductos")}</p>
          ) : tipo === "pedido" ? (
            <>
              <ReferenciaPedidoEntrega productos={consulta.datos.results} />
              {consulta.datos.count > 10 && (
                <PaginadorPedidos
                  pagina={paginaPedido}
                  total={consulta.datos.count}
                  alCambiar={establecerPaginaPedido}
                />
              )}
            </>
          ) : (
            producto && (
              <>
                <dl className="mb-5 grid grid-cols-3 gap-2 rounded-xl bg-brand-50 p-3 text-center dark:bg-brand-950">
                  {(["recibido", "rechazado", "aceptado"] as const).map(
                    (campo) => (
                      <div key={campo} className="min-w-0">
                        <dt className="text-xs text-gray-600 dark:text-gray-300">
                          {t(campo)}
                        </dt>
                        <dd className="mt-1 text-sm font-semibold break-words tabular-nums">
                          {mostrarMedicion(pesos[campo], idioma)} kg
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
                <ConciliacionLotesEntrega
                  key={producto.producto}
                  ruta={ruta}
                  producto={producto}
                  linea={linea}
                  aportes={aportes}
                  bloqueado={bloqueado}
                  soloLectura={soloLectura}
                  error={errores["lotes_" + producto.producto]}
                  alCambiar={alCambiarAportes}
                  pagina={paginaAportes}
                  alPagina={alPaginaAportes}
                />
              </>
            )
          )}
        </div>
        <footer
          className={`${estilos.piePanel} shrink-0 space-y-3 border-t border-gray-200 px-5 pt-4 dark:border-gray-700`}
        >
          {tipo === "lotes" && !!productos.length && (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={indice <= 0}
                onClick={() => alProducto(productos[indice - 1].producto)}
                startIcon={<ChevronLeft className="size-4 rtl:rotate-180" />}
              >
                {t("productoAnterior")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={indice >= productos.length - 1}
                onClick={() => alProducto(productos[indice + 1].producto)}
                endIcon={<ChevronRight className="size-4 rtl:rotate-180" />}
              >
                {t("productoSiguiente")}
              </Button>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="max-w-xs text-xs text-gray-500 dark:text-gray-400">
              {t(
                tipo === "lotes" && !soloLectura
                  ? "panelConservaAnotado"
                  : "referenciaSoloConsulta",
              )}
            </p>
            <Button size="sm" onClick={alCerrar}>
              {t("listoPanel")}
            </Button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}
