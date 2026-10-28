"use client";
import { useTranslations } from "next-intl";
import {
  Table as Tabla,
  TableBody as Cuerpo,
  TableCell as Celda,
  TableHeader as Cabecera,
  TableRow as Fila,
} from "@/components/ui/table";
import { IconoProducto, PencilIcon as IconoEditar, IconoEstado } from "@/icons";
import Button from "@/components/ui/button/Button";
import type { PermisosCatalogo } from "@/components/catalogos/tipos";
import type { Presentacion } from "../tipos";

interface Propiedades {
  registros: Presentacion[];
  cargando: boolean;
  filtrado: boolean;
  permisos: PermisosCatalogo;
  puedeCrear: boolean;
  productoActivo: boolean;
  alCrear: () => void;
  alEditar: (registro: Presentacion) => void;
  alEstado: (registro: Presentacion) => void;
}

export default function TablaPresentaciones({
  registros,
  cargando,
  filtrado,
  permisos,
  puedeCrear,
  productoActivo,
  alCrear,
  alEditar,
  alEstado,
}: Propiedades) {
  const t = useTranslations("presentaciones");
  if (cargando)
    return (
      <div role="status" aria-label={t("cargando")} className="space-y-3">
        {[0, 1, 2].map((indice) => (
          <div
            key={indice}
            className="h-16 rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800"
          />
        ))}
      </div>
    );
  if (!registros.length)
    return (
      <div className="py-12 text-center">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
          <IconoProducto className="size-6" />
        </span>
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {t(filtrado ? "sinResultados" : "vacio")}
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t(filtrado ? "cambiarFiltros" : "ayudaVacio")}
        </p>
        {!filtrado && puedeCrear && (
          <Button size="sm" className="mt-5" onClick={alCrear}>
            {t("nueva")}
          </Button>
        )}
      </div>
    );
  const acciones = permisos.editar || permisos.cambiar_estado;
  const claseAccion =
    "inline-flex size-10 items-center justify-center rounded-lg text-gray-500 transition hover:bg-brand-50 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none dark:text-gray-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-300";
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <Tabla>
        <Cabecera className="bg-gray-50 dark:bg-gray-800/50">
          <Fila>
            {["nombre", "uso", "estado", ...(acciones ? ["acciones"] : [])].map(
              (campo) => (
                <Celda
                  key={campo}
                  isHeader
                  className={`px-5 py-3.5 text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400 ${campo === "acciones" ? "text-end" : "text-start"}`}
                >
                  {t(campo)}
                </Celda>
              ),
            )}
          </Fila>
        </Cabecera>
        <Cuerpo>
          {registros.map((registro) => (
            <Fila
              key={registro.id}
              className="border-t border-gray-100 hover:bg-gray-50/70 dark:border-gray-800 dark:hover:bg-white/2"
            >
              <Celda className="px-5 py-4">
                <span className="text-sm font-semibold break-words text-gray-800 dark:text-gray-100">
                  {registro.nombre}
                </span>
                {registro.columna_pedido !== "otra" && (
                  <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                    {t(`columnas.${registro.columna_pedido}`)}
                  </span>
                )}
              </Celda>
              <Celda className="px-5 py-4">
                <span className="inline-flex rounded-md bg-brand-50 px-2.5 py-1 text-theme-xs font-medium whitespace-nowrap text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                  {t(`usos.${registro.uso}`)}
                </span>
              </Celda>
              <Celda className="px-5 py-4">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-theme-xs font-medium ${registro.activo ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}
                >
                  {t(registro.activo ? "activa" : "inactiva")}
                </span>
              </Celda>
              {acciones && (
                <Celda className="px-4 py-4">
                  <div className="flex justify-end gap-1">
                    {permisos.editar && (
                      <button
                        type="button"
                        className={claseAccion}
                        onClick={() => alEditar(registro)}
                        title={t("editar")}
                        aria-label={t("editarRegistro", {
                          nombre: registro.nombre,
                        })}
                      >
                        <IconoEditar className="size-4.5" />
                      </button>
                    )}
                    {permisos.cambiar_estado && (
                      <button
                        type="button"
                        className={claseAccion}
                        onClick={() => alEstado(registro)}
                        disabled={!registro.activo && !productoActivo}
                        title={t(
                          !registro.activo && !productoActivo
                            ? "requiereProductoActivo"
                            : registro.activo
                              ? "desactivar"
                              : "activar",
                        )}
                        aria-label={t(
                          registro.activo
                            ? "desactivarRegistro"
                            : "activarRegistro",
                          { nombre: registro.nombre },
                        )}
                      >
                        <IconoEstado className="size-4.5" />
                      </button>
                    )}
                  </div>
                </Celda>
              )}
            </Fila>
          ))}
        </Cuerpo>
      </Tabla>
    </div>
  );
}
