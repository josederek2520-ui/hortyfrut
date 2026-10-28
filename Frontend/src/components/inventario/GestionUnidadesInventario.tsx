"use client";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Ruler as IconoUnidad } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import SelectorCompra from "@/components/compras/SelectorCompra";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import {
  clasePanel,
  type OpcionCompra,
  type PaginaCompra,
} from "@/components/compras/tipos";
import type { UnidadInventario } from "./tipos";

export default function GestionUnidadesInventario({
  producto,
  puedeGestionar,
  alError,
  alNotificar,
}: {
  producto: number;
  puedeGestionar: boolean;
  alError: (error: unknown) => void;
  alNotificar: (mensaje: string) => void;
}) {
  const t = useTranslations("inventario");
  const identificador = useId();
  const modal = useModal();
  const [pagina, establecerPagina] = useState(1);
  const [datos, establecerDatos] =
    useState<PaginaCompra<UnidadInventario> | null>(null);
  const [revision, establecerRevision] = useState(0);
  const [ocupado, establecerOcupado] = useState(false);
  const [fallo, establecerFallo] = useState(false);
  const [mensaje, establecerMensaje] = useState("");
  const [elegida, establecerElegida] = useState<UnidadInventario | null>(null);
  const ruta = `inventario/productos/${producto}/unidades/`;
  const recargar = () => {
    establecerDatos(null);
    establecerFallo(false);
    establecerRevision((valor) => valor + 1);
  };
  useEffect(() => {
    const controlador = new AbortController();
    api<PaginaCompra<UnidadInventario>>(`${ruta}?pagina=${pagina}`, {
      signal: controlador.signal,
    })
      .then((respuesta) => {
        if (!controlador.signal.aborted) establecerDatos(respuesta);
      })
      .catch((error) => {
        if (!controlador.signal.aborted) {
          if (error instanceof ApiError && error.status === 404 && pagina > 1)
            establecerPagina(1);
          else {
            establecerFallo(true);
            alError(error);
          }
        }
      });
    return () => controlador.abort();
  }, [ruta, pagina, revision, alError]);
  const agregar = async (opcion: OpcionCompra | null) => {
    if (!opcion || ocupado) return;
    establecerOcupado(true);
    try {
      await api(ruta, {
        method: "POST",
        body: JSON.stringify({ unidad: opcion.id }),
      });
      alNotificar(t("unidadGuardada"));
      recargar();
    } catch (error) {
      alError(error);
    } finally {
      establecerOcupado(false);
    }
  };
  const cambiar = async () => {
    if (!elegida || ocupado) return;
    establecerOcupado(true);
    establecerMensaje("");
    try {
      await api(`${ruta}${elegida.id}/estado/`, {
        method: "POST",
        body: JSON.stringify({
          activo: !elegida.activo,
          version: elegida.version,
        }),
      });
      modal.closeModal();
      alNotificar(t("unidadGuardada"));
      recargar();
    } catch (error) {
      establecerMensaje(
        error instanceof ApiError && error.status === 409
          ? t("conflicto")
          : t("validacion"),
      );
      alError(error);
    } finally {
      establecerOcupado(false);
    }
  };
  return (
    <section className={`${clasePanel} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <IconoUnidad className="size-5 text-brand-500" aria-hidden="true" />
            {t("unidadesTitulo")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            {t("unidadesAyuda")}
          </p>
        </div>
        {puedeGestionar && (
          <SelectorCompra
            agregar
            ruta={`${ruta}opciones/`}
            etiqueta={t("habilitarUnidad")}
            valor={null}
            alElegir={agregar}
            alError={alError}
            deshabilitado={ocupado}
          />
        )}
      </div>
      {fallo ? (
        <div role="alert" className="mt-5">
          <p>{t("errorCarga")}</p>
          <Button variant="outline" size="sm" onClick={recargar}>
            {t("reintentar")}
          </Button>
        </div>
      ) : !datos ? (
        <p
          role="status"
          className="py-6 text-sm text-gray-500 dark:text-gray-400"
        >
          {t("cargando")}
        </p>
      ) : (
        <>
          <ul className="mt-5 divide-y divide-gray-100 dark:divide-gray-800">
            {datos.results.map((unidad) => (
              <li
                key={unidad.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-100">
                    {unidad.nombre}{" "}
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      ({unidad.abreviatura})
                    </span>
                  </p>
                  <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                    {t(
                      unidad.es_base
                        ? "unidadBase"
                        : unidad.activo
                          ? "habilitada"
                          : "inhabilitada",
                    )}
                    {!unidad.vigente && ` · ${t("catalogoInactivo")}`}
                  </p>
                </div>
                {puedeGestionar && !unidad.es_base && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={ocupado}
                    onClick={() => {
                      establecerElegida(unidad);
                      establecerMensaje("");
                      modal.openModal();
                    }}
                  >
                    {t(unidad.activo ? "inhabilitar" : "habilitar")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <PaginadorCompras
            pagina={pagina}
            total={datos.count}
            ocupado={ocupado}
            alCambiar={(valor) => {
              establecerPagina(valor);
              establecerDatos(null);
            }}
          />
        </>
      )}
      <Modal
        isOpen={modal.isOpen}
        onClose={() => {
          if (!ocupado) modal.closeModal();
        }}
        className="max-w-lg"
        labelledBy={identificador}
        closeLabel={t("cerrar")}
      >
        <div className="space-y-5 p-6">
          <h2
            id={identificador}
            className="pe-8 text-xl font-semibold text-gray-900 dark:text-white"
          >
            {t(elegida?.activo ? "inhabilitar" : "habilitar")} ·{" "}
            {elegida?.nombre}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t("cambiarUnidadAyuda")}
          </p>
          {mensaje && (
            <p
              role="alert"
              className="text-sm text-error-500 dark:text-error-400"
            >
              {mensaje}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="outline"
              disabled={ocupado}
              onClick={modal.closeModal}
            >
              {t("cerrar")}
            </Button>
            <Button disabled={ocupado} onClick={cambiar}>
              {t(ocupado ? "guardando" : "confirmar")}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
