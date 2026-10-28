"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PackagePlus as IconoProductos } from "lucide-react";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import DesplegableCompra from "@/components/compras/DesplegableCompra";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import { clasePanel, type PaginaCompra } from "@/components/compras/tipos";
import { api, ApiError as ErrorApi } from "@/lib/api";
import LineaFormularioRecepcion, {
  columnasRecepcion,
  columnasRecepcionDirecta,
} from "./LineaFormularioRecepcion";
import { lineaDesdeOpcion } from "./calculos";
import type { LineaRecepcion, OpcionProductoRecepcion } from "./tipos";

export default function ProductosRecepcion({
  compra,
  vinculada,
  lineas,
  fecha,
  ocupado,
  errores,
  vista,
  alVista,
  pagina,
  alPagina,
  alCambiar,
  alEliminar,
  alAgregar,
  alError,
}: {
  compra?: number;
  vinculada: boolean;
  lineas: LineaRecepcion[];
  fecha: string;
  ocupado: boolean;
  errores: Record<string, string[]>;
  vista: "pendientes" | "anotados";
  alVista: (vista: "pendientes" | "anotados") => void;
  pagina: number;
  alPagina: (pagina: number) => void;
  alCambiar: (linea: LineaRecepcion, cambios: Partial<LineaRecepcion>) => void;
  alEliminar: (clave: string) => void;
  alAgregar: (opcion: OpcionProductoRecepcion) => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("recepciones");
  const [paginaPendientes, establecerPaginaPendientes] = useState(1);
  const [buscar, establecerBuscar] = useState("");
  const [revision, establecerRevision] = useState(0);
  const consulta = `${compra}|${paginaPendientes}|${buscar}|${revision}`;
  const [respuesta, establecerRespuesta] = useState<{
    clave: string;
    datos: PaginaCompra<OpcionProductoRecepcion>;
  } | null>(null);
  const [consultaFallida, establecerConsultaFallida] = useState("");
  const datos = respuesta?.clave === consulta ? respuesta.datos : null;
  const fallo = !datos && consultaFallida === consulta;
  const cargando = !!compra && !datos && !fallo;
  useEffect(() => {
    if (!compra || !vinculada) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(
      async () => {
        establecerConsultaFallida("");
        try {
          const parametros = new URLSearchParams({
            compra: String(compra),
            solo_pendientes: "true",
            pagina: String(paginaPendientes),
            buscar,
          });
          const pendientes = await api<PaginaCompra<OpcionProductoRecepcion>>(
            `recepciones/compra-detalles/?${parametros}`,
            { signal: controlador.signal },
          );
          if (!controlador.signal.aborted)
            establecerRespuesta({ clave: consulta, datos: pendientes });
        } catch (error) {
          if (controlador.signal.aborted) return;
          if (
            error instanceof ErrorApi &&
            error.status === 404 &&
            paginaPendientes > 1
          )
            establecerPaginaPendientes(1);
          else {
            establecerConsultaFallida(consulta);
            alError(error);
          }
        }
      },
      buscar ? 250 : 0,
    );
    return () => {
      controlador.abort();
      window.clearTimeout(temporizador);
    };
  }, [compra, vinculada, paginaPendientes, buscar, consulta, alError]);
  const mostrarPendientes = vinculada && vista === "pendientes";
  const filas = mostrarPendientes
    ? (datos?.results || []).map((opcion) => {
        const base = lineaDesdeOpcion(opcion);
        const guardada = lineas.find(
          (linea) => linea.detalleCompra === opcion.id,
        );
        return guardada
          ? {
              ...guardada,
              pendiente: base.pendiente,
              proveedorNombre: base.proveedorNombre,
              unidadCompra: base.unidadCompra,
            }
          : base;
      })
    : lineas.slice((pagina - 1) * 10, pagina * 10);
  return (
    <section
      className={`${clasePanel} min-w-0 overflow-hidden`}
      aria-labelledby="productos-recepcion"
    >
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="productos-recepcion"
              className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
            >
              <IconoProductos
                className="size-5 text-brand-600 dark:text-brand-400"
                aria-hidden="true"
              />
              {t("queLlego")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
              {t(vinculada ? "anotarLlegadaAyuda" : "directoProductosAyuda")}
            </p>
          </div>
          {!vinculada && (
            <DesplegableCompra<OpcionProductoRecepcion>
              tipo="general"
              ruta="recepciones/productos/"
              etiqueta={t("agregarProducto")}
              valor={null}
              agregar
              alElegir={(opcion) => {
                if (opcion) alAgregar(opcion);
              }}
              alError={alError}
              deshabilitado={ocupado || lineas.length >= 500}
            />
          )}
        </div>
        {vinculada && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label={t("vistaProductos")}
              className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
            >
              <Button
                size="sm"
                variant="outline"
                aria-pressed={vista === "pendientes"}
                onClick={() => alVista("pendientes")}
              >
                {t("productosCompra")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                aria-pressed={vista === "anotados"}
                onClick={() => alVista("anotados")}
              >
                {t("anotados", { cantidad: lineas.length })}
              </Button>
            </div>
            {mostrarPendientes && (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="search"
                  value={buscar}
                  maxLength={150}
                  placeholder={t("buscarProducto")}
                  aria-label={t("buscarProducto")}
                  onChange={(evento) => {
                    establecerBuscar(evento.target.value);
                    establecerPaginaPendientes(1);
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cargando || ocupado}
                  onClick={() => establecerRevision((actual) => actual + 1)}
                >
                  {t("actualizar")}
                </Button>
              </div>
            )}
          </div>
        )}
        {!!errores.detalles?.length && (
          <p
            role="alert"
            className="text-sm text-error-600 dark:text-error-400"
          >
            {errores.detalles.join(" ")}
          </p>
        )}
      </div>
      {vinculada && !compra ? (
        <p
          role="status"
          className="m-5 mt-0 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
        >
          {t("eligeCompraPrimero")}
        </p>
      ) : mostrarPendientes && cargando ? (
        <p
          role="status"
          className="p-8 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          {t("cargandoProductos")}
        </p>
      ) : mostrarPendientes && fallo ? (
        <div role="alert" className="space-y-3 p-5">
          <p className="text-sm text-error-600 dark:text-error-400">
            {t("errorProductos")}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => establecerRevision((actual) => actual + 1)}
          >
            {t("reintentar")}
          </Button>
        </div>
      ) : !filas.length ? (
        <p
          role="status"
          className="p-8 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          {t(mostrarPendientes ? "sinPendientesFiltro" : "sinAnotados")}
        </p>
      ) : (
        <div className="custom-scrollbar overflow-x-auto">
          <div
            role="table"
            aria-label={t("productosRecibidos")}
            className={vinculada ? "xl:min-w-232" : ""}
          >
            <div
              role="rowgroup"
              className="hidden bg-gray-50 px-4 py-3 xl:block dark:bg-gray-800/40"
            >
              <div
                role="row"
                className={`grid gap-3 ${vinculada ? columnasRecepcion : columnasRecepcionDirecta}`}
              >
                {(vinculada
                  ? [
                      "producto",
                      "faltaRecibir",
                      "llegoHoy",
                      "paraAlmacen",
                      "quedaPendiente",
                      "opciones",
                    ]
                  : ["producto", "paraAlmacen", "opciones"]
                ).map((clave) => (
                  <div
                    key={clave}
                    role="columnheader"
                    className="text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                  >
                    {t(clave)}
                  </div>
                ))}
              </div>
            </div>
            <div role="rowgroup">
              {filas.map((linea) => (
                <LineaFormularioRecepcion
                  key={linea.clave}
                  linea={linea}
                  indice={lineas.findIndex(
                    (actual) => actual.clave === linea.clave,
                  )}
                  vinculada={vinculada}
                  fecha={fecha}
                  ocupado={ocupado}
                  errores={errores}
                  anotada={lineas.some(
                    (actual) => actual.clave === linea.clave,
                  )}
                  alError={alError}
                  alCambiar={(cambios) => alCambiar(linea, cambios)}
                  alEliminar={() => alEliminar(linea.clave)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="p-5">
        <PaginadorCompras
          pagina={mostrarPendientes ? paginaPendientes : pagina}
          total={mostrarPendientes ? datos?.count || 0 : lineas.length}
          ocupado={ocupado || (mostrarPendientes && (cargando || fallo))}
          alCambiar={mostrarPendientes ? establecerPaginaPendientes : alPagina}
        />
      </div>
    </section>
  );
}
