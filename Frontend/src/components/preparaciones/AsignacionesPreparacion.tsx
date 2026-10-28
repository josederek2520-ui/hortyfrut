"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 as IconoQuitar } from "lucide-react";
import Button from "@/components/ui/button/Button";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import SelectorCompra from "@/components/compras/SelectorCompra";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import type {
  PaginaCompra as Pagina,
  OpcionCompra,
} from "@/components/compras/tipos";
import type { FieldErrors as Errores } from "@/lib/form-validation";
import useConsultaPreparacion from "./useConsultaPreparacion";
import { desdeNecesidad, aportesConMedicion } from "./calculos";
import type {
  AsignacionEditable,
  DocumentoEditable,
  NecesidadPreparacion,
} from "./tipos";

export default function AsignacionesPreparacion({
  documento,
  contexto,
  errores,
  ocupado,
  alCambiar,
  alError,
  paginaInicial = 1,
  mostrarAsignadas = false,
}: {
  documento: DocumentoEditable;
  contexto: string;
  errores: Errores;
  ocupado: boolean;
  alCambiar: (documento: DocumentoEditable) => void;
  alError: (error: unknown) => void;
  paginaInicial?: number;
  mostrarAsignadas?: boolean;
}) {
  const t = useTranslations("preparaciones");
  const [soloAsignadas, establecerSoloAsignadas] = useState(
    mostrarAsignadas || Object.keys(documento.asignaciones).length > 0,
  );
  const [pagina, establecerPagina] = useState(paginaInicial);
  const [producto, establecerProducto] = useState<OpcionCompra | null>(null);
  const ruta = `preparaciones/necesidades/?${contexto}&pagina=${pagina}${producto ? `&producto=${producto.id}` : ""}`;
  const { datos, cargando, fallo, recargar } = useConsultaPreparacion<
    Pagina<NecesidadPreparacion>
  >(soloAsignadas ? null : ruta, alError);
  const guardadas = Object.values(documento.asignaciones);
  const registros = soloAsignadas
    ? guardadas.slice((pagina - 1) * 10, pagina * 10)
    : datos?.results.map((fuente) => {
        const asignacion =
          documento.asignaciones[String(fuente.id)] || desdeNecesidad(fuente);
        return {
          ...asignacion,
          pendiente: fuente.pendiente,
          disponible: fuente.disponible,
          solicitada: fuente.cantidad,
        };
      }) || [];
  const modificar = (asignacion: AsignacionEditable) =>
    alCambiar({
      ...documento,
      asignaciones: {
        ...documento.asignaciones,
        [asignacion.clave]: asignacion,
      },
    });
  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
        {t("repartoAyuda")}
      </p>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t("repartoVistas")}
      >
        <Button
          size="sm"
          variant={!soloAsignadas ? "primary" : "outline"}
          aria-pressed={!soloAsignadas}
          onClick={() => {
            establecerSoloAsignadas(false);
            establecerPagina(1);
          }}
        >
          {t("pendientes")}
        </Button>
        <Button
          size="sm"
          variant={soloAsignadas ? "primary" : "outline"}
          aria-pressed={soloAsignadas}
          onClick={() => {
            establecerSoloAsignadas(true);
            establecerPagina(1);
          }}
        >
          {t("asignacionesBorrador", { cantidad: guardadas.length })}
        </Button>
      </div>
      {!soloAsignadas && (
        <SelectorCompra
          ruta={`preparaciones/productos/?${contexto}`}
          etiqueta={t("filtrarProducto")}
          valor={producto}
          opcionVacia={t("todosProductos")}
          alElegir={(valor) => {
            establecerProducto(valor);
            establecerPagina(1);
          }}
          alError={alError}
        />
      )}
      {!soloAsignadas && fallo ? (
        <div role="alert" className="space-y-3">
          <p>{t("errorCarga")}</p>
          <Button
            variant="outline"
            onClick={() => {
              establecerPagina(1);
              recargar();
            }}
          >
            {t("recargar")}
          </Button>
        </div>
      ) : !soloAsignadas && cargando ? (
        <p
          role="status"
          className="py-8 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          {t("cargando")}
        </p>
      ) : !registros.length ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          {t(soloAsignadas ? "sinAsignaciones" : "sinPendientes")}
        </p>
      ) : (
        registros.map((asignacion) => {
          const indice = guardadas.findIndex(
            (actual) => actual.clave === asignacion.clave,
          );
          const prefijo = `asignaciones_${indice}`;
          const fuentes = documento.lineas.filter(
            (linea) => linea.lote.producto === asignacion.producto,
          );
          const ordenAportes = aportesConMedicion(asignacion, documento).map(
            ([id]) => Number(id),
          );
          return (
            <article
              key={asignacion.clave}
              className="rounded-xl border border-gray-200 p-4 sm:p-5 dark:border-gray-800"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {asignacion.sucursalNombre} · {asignacion.productoNombre}
                  </h3>
                  <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                    {asignacion.codigo} · {asignacion.presentacion} ·{" "}
                    {t("solicitadaPendiente", {
                      solicitada: asignacion.solicitada,
                      pendiente: asignacion.pendiente,
                    })}
                  </p>
                </div>
                {indice >= 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={ocupado}
                    aria-label={t("quitarAsignacion")}
                    onClick={() => {
                      const siguientes = { ...documento.asignaciones };
                      delete siguientes[asignacion.clave];
                      alCambiar({ ...documento, asignaciones: siguientes });
                      if (soloAsignadas)
                        establecerPagina(
                          Math.min(
                            pagina,
                            Math.max(1, Math.ceil((guardadas.length - 1) / 10)),
                          ),
                        );
                    }}
                  >
                    <IconoQuitar className="size-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
              {(!asignacion.disponible || !asignacion.detalle) && (
                <p className="mb-3 rounded-lg bg-warning-50 p-3 text-sm text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
                  {t("origenAsignacionCambio")}
                </p>
              )}
              {errores[`${prefijo}_detalle_pedido`] && (
                <p
                  role="alert"
                  className="mb-3 text-sm text-error-500 dark:text-error-400"
                >
                  {errores[`${prefijo}_detalle_pedido`].join(" ")}
                </p>
              )}
              {!fuentes.length ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("agregarLoteProducto")}
                </p>
              ) : (
                <fieldset disabled={ocupado || !asignacion.disponible}>
                  <legend className="sr-only">
                    {t("cantidadesPreparadas")}
                  </legend>
                  <div className="grid items-start gap-4 sm:grid-cols-2">
                    <CampoDirectorio
                      id={`${prefijo}_${asignacion.clave}_cantidad`}
                      name={`${prefijo}_cantidad`}
                      etiqueta={t(
                        asignacion.columna === "cajas"
                          ? "cajasPreparadas"
                          : "unidadesPreparadas",
                      )}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={asignacion.pendiente}
                      step={1}
                      value={asignacion.cantidad}
                      placeholder="0"
                      errores={errores[`${prefijo}_cantidad`]}
                      onChange={(evento) =>
                        modificar({
                          ...asignacion,
                          cantidad: evento.target.value,
                        })
                      }
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="sm:self-center"
                      onClick={() =>
                        modificar({
                          ...asignacion,
                          cantidad: String(asignacion.pendiente),
                        })
                      }
                    >
                      {t("completarPendiente")}
                    </Button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {fuentes.map((linea) => {
                      const aporte = asignacion.aportes[linea.lote.id] || {
                        cantidad: "",
                        pesoKg: "",
                      };
                      const posicion = ordenAportes.indexOf(linea.lote.id);
                      const campo = `${prefijo}_aportes_${posicion}`;
                      return (
                        <div
                          key={linea.lote.id}
                          className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/40"
                        >
                          <p className="mb-3 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                            {linea.lote.nombre} · {linea.lote.unidad_nombre}
                          </p>
                          <div className="grid items-start gap-4 sm:grid-cols-2">
                            <CampoDirectorio
                              id={`${asignacion.clave}_${linea.lote.id}_real`}
                              name={`${campo}_cantidad`}
                              etiqueta={t(
                                linea.lote.es_kg
                                  ? "pesoRealKg"
                                  : "cantidadRealUnidad",
                                { unidad: linea.lote.unidad_abreviatura },
                              )}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={99999999999.999}
                              step={0.001}
                              value={aporte.cantidad}
                              placeholder="0"
                              errores={errores[`${campo}_cantidad`]}
                              onChange={(evento) =>
                                modificar({
                                  ...asignacion,
                                  aportes: {
                                    ...asignacion.aportes,
                                    [linea.lote.id]: {
                                      ...aporte,
                                      cantidad: evento.target.value,
                                    },
                                  },
                                })
                              }
                            />
                            {!linea.lote.es_kg && (
                              <CampoDirectorio
                                id={`${asignacion.clave}_${linea.lote.id}_peso`}
                                name={`${campo}_peso_kg`}
                                etiqueta={t("pesoRealKg")}
                                type="number"
                                inputMode="decimal"
                                min={0.001}
                                max={99999999999.999}
                                step={0.001}
                                value={aporte.pesoKg}
                                ayuda={t("pesoConfirmar")}
                                errores={errores[`${campo}_peso_kg`]}
                                onChange={(evento) =>
                                  modificar({
                                    ...asignacion,
                                    aportes: {
                                      ...asignacion.aportes,
                                      [linea.lote.id]: {
                                        ...aporte,
                                        pesoKg: evento.target.value,
                                      },
                                    },
                                  })
                                }
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </article>
          );
        })
      )}
      <PaginadorCompras
        pagina={pagina}
        total={soloAsignadas ? guardadas.length : datos?.count || 0}
        ocupado={ocupado || (!soloAsignadas && (cargando || fallo))}
        alCambiar={establecerPagina}
      />
    </div>
  );
}
