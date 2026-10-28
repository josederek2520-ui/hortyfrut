"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import type { PaginaCompra } from "@/components/compras/tipos";
import FilaSucursalPreparacion, {
  columnasSucursalPreparacion,
} from "./FilaSucursalPreparacion";
import useConsultaPreparacion from "./useConsultaPreparacion";
import { desdeNecesidad } from "./calculos";
import type {
  AsignacionEditable,
  DocumentoEditable,
  LotePreparacion,
  NecesidadPreparacion,
  ProductoPreparacion,
} from "./tipos";

export default function RepartoProductoPreparacion({
  producto,
  documento,
  contexto,
  almacen,
  ocupado,
  errores,
  alCambiar,
  alQuitar,
  alElegirLote,
  alError,
  paginaInicial = 1,
  mostrarAnotadas = false,
}: {
  producto: ProductoPreparacion;
  documento: DocumentoEditable;
  contexto: string;
  almacen?: number;
  ocupado: boolean;
  errores: Record<string, string[]>;
  alCambiar: (asignacion: AsignacionEditable) => void;
  alQuitar: (clave: string) => void;
  alElegirLote: (asignacion: AsignacionEditable, lote: LotePreparacion) => void;
  alError: (error: unknown) => void;
  paginaInicial?: number;
  mostrarAnotadas?: boolean;
}) {
  const t = useTranslations("preparaciones");
  const [pagina, establecerPagina] = useState(paginaInicial);
  const [anotadas, establecerAnotadas] = useState(mostrarAnotadas);
  const { datos, cargando, fallo, recargar } = useConsultaPreparacion<
    PaginaCompra<NecesidadPreparacion>
  >(
    anotadas
      ? null
      : `preparaciones/necesidades/?${contexto}&producto=${producto.id}&pagina=${pagina}`,
    alError,
  );
  const guardadas = Object.values(documento.asignaciones);
  const delProducto = guardadas.filter((fila) => fila.producto === producto.id);
  const paginaActual = anotadas
    ? Math.min(pagina, Math.max(1, Math.ceil(delProducto.length / 10)))
    : pagina;
  const filas = anotadas
    ? delProducto.slice((paginaActual - 1) * 10, paginaActual * 10)
    : (datos?.results || []).map((fuente) => ({
        ...(documento.asignaciones[String(fuente.id)] ||
          desdeNecesidad(fuente)),
        pendiente: fuente.pendiente,
        disponible: fuente.disponible,
        imagen: producto.imagen,
        categoria: producto.categoria || undefined,
      }));
  return (
    <section
      className="border-t border-gray-100 dark:border-gray-800"
      aria-labelledby="pedidos-producto-preparacion"
    >
      <div className="space-y-3 p-5">
        <h3
          id="pedidos-producto-preparacion"
          className="font-semibold text-gray-900 dark:text-white"
        >
          {t("quePreparasSucursalTrabajo")}
        </h3>
        <p className="text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
          {t("repartoProductoAyuda")}
        </p>
        <div
          role="group"
          aria-label={t("repartoVistas")}
          className="flex w-fit gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
        >
          <Button
            size="sm"
            variant="outline"
            className="pestana-hortyfru"
            aria-pressed={!anotadas}
            onClick={() => {
              establecerAnotadas(false);
              establecerPagina(1);
            }}
          >
            {t("pendientes")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="pestana-hortyfru"
            aria-pressed={anotadas}
            onClick={() => {
              establecerAnotadas(true);
              establecerPagina(1);
            }}
          >
            {t("sucursalesAnotadasTrabajo", { cantidad: delProducto.length })}
          </Button>
        </div>
        {!!errores.asignaciones?.length && (
          <p
            role="alert"
            className="text-sm text-error-600 dark:text-error-400"
          >
            {errores.asignaciones.join(" ")}
          </p>
        )}
      </div>
      {cargando ? (
        <p
          role="status"
          className="p-8 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          {t("cargando")}
        </p>
      ) : fallo ? (
        <div role="alert" className="space-y-3 p-5">
          <p>{t("errorCarga")}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              establecerPagina(1);
              recargar();
            }}
          >
            {t("recargar")}
          </Button>
        </div>
      ) : !filas.length ? (
        <p
          role="status"
          className="p-8 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          {t(anotadas ? "sinAsignaciones" : "sinPendientes")}
        </p>
      ) : (
        <div className="custom-scrollbar overflow-x-auto">
          <div
            role="table"
            aria-label={t("repartoSucursal")}
            className="lg:min-w-188"
          >
            <div
              role="rowgroup"
              className="hidden bg-gray-50 px-4 py-3 lg:block dark:bg-gray-800/40"
            >
              <div
                role="row"
                className={`grid gap-3 ${columnasSucursalPreparacion}`}
              >
                {[
                  "sucursal",
                  "medidaPedidoTrabajo",
                  "faltaPrepararTrabajo",
                  "prepararAhoraTrabajo",
                  "cantidadRealUsadaTrabajo",
                  "accionesTrabajo",
                ].map((campo) => (
                  <div
                    role="columnheader"
                    key={campo}
                    className="text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                  >
                    {t(campo)}
                  </div>
                ))}
              </div>
            </div>
            <div role="rowgroup">
              {filas.map((asignacion) => (
                <FilaSucursalPreparacion
                  key={asignacion.clave}
                  asignacion={asignacion}
                  documento={documento}
                  contexto={contexto}
                  almacen={almacen}
                  indice={guardadas.findIndex(
                    (fila) => fila.clave === asignacion.clave,
                  )}
                  ocupado={ocupado}
                  errores={errores}
                  alError={alError}
                  alCambiar={alCambiar}
                  alQuitar={() => alQuitar(asignacion.clave)}
                  alElegirLote={(lote) => alElegirLote(asignacion, lote)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="p-5">
        <PaginadorCompras
          pagina={paginaActual}
          total={anotadas ? delProducto.length : datos?.count || 0}
          ocupado={ocupado || cargando || fallo}
          alCambiar={establecerPagina}
        />
      </div>
    </section>
  );
}
