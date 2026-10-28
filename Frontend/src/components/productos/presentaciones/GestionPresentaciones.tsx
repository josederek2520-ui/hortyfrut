"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Contenedor from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import { PlusIcon as IconoAgregar, LockIcon as IconoCandado } from "@/icons";
import { useModal } from "@/hooks/useModal";
import { api, ApiError as ErrorApi } from "@/lib/api";
import type { PermisosCatalogo } from "@/components/catalogos/tipos";
import type { Producto, Presentacion, PaginaPresentaciones } from "../tipos";
import BarraPresentaciones from "./BarraPresentaciones";
import TablaPresentaciones from "./TablaPresentaciones";
import FormularioPresentacion from "./FormularioPresentacion";
import ConfirmarEstadoPresentacion from "./ConfirmarEstadoPresentacion";

interface Propiedades {
  producto: Producto;
  permisos: PermisosCatalogo;
  alError: (error: unknown) => void;
  alNotificar: (mensaje: string) => void;
  alRecargarProducto: () => void;
}

export default function GestionPresentaciones({
  producto,
  permisos,
  alError,
  alNotificar,
  alRecargarProducto,
}: Propiedades) {
  const t = useTranslations("presentaciones");
  const modal = useModal();
  const [modo, establecerModo] = useState<"formulario" | "estado">(
    "formulario",
  );
  const [seleccionado, establecerSeleccionado] = useState<Presentacion | null>(
    null,
  );
  const [datos, establecerDatos] = useState<PaginaPresentaciones | null>(null);
  const [buscar, establecerBuscar] = useState("");
  const [uso, establecerUso] = useState("");
  const [estado, establecerEstado] = useState("");
  const [orden, establecerOrden] = useState("nombre");
  const [pagina, establecerPagina] = useState(1);
  const [revision, establecerRevision] = useState(0);
  const [cargando, establecerCargando] = useState(true);
  const [fallo, establecerFallo] = useState("");
  useEffect(() => {
    if (!permisos.ver) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(
      async () => {
        establecerCargando(true);
        establecerFallo("");
        try {
          const parametros = new URLSearchParams({
            buscar,
            orden,
            pagina: String(pagina),
          });
          if (uso) parametros.set("uso", uso);
          if (estado) parametros.set("activo", estado);
          const listado = await api<PaginaPresentaciones>(
            `productos/${producto.id}/presentaciones/?${parametros}`,
            { signal: controlador.signal },
          );
          if (!controlador.signal.aborted) establecerDatos(listado);
        } catch (error) {
          if (!controlador.signal.aborted) {
            if (error instanceof ErrorApi && error.status === 404 && pagina > 1)
              establecerPagina(1);
            else {
              establecerFallo(
                t(
                  error instanceof ErrorApi && error.status === 403
                    ? "accesoDenegado"
                    : "errorCarga",
                ),
              );
              alError(error);
            }
          }
        } finally {
          if (!controlador.signal.aborted) establecerCargando(false);
        }
      },
      buscar ? 300 : 0,
    );
    return () => {
      controlador.abort();
      window.clearTimeout(temporizador);
    };
  }, [
    producto.id,
    permisos.ver,
    buscar,
    uso,
    estado,
    orden,
    pagina,
    revision,
    t,
    alError,
  ]);
  const abrir = (
    registro: Presentacion | null,
    modo: "formulario" | "estado",
  ) => {
    establecerSeleccionado(registro);
    establecerModo(modo);
    modal.openModal();
  };
  const guardado = () => {
    modal.closeModal();
    establecerSeleccionado(null);
    alNotificar(
      t(
        modo === "estado"
          ? "estadoGuardado"
          : seleccionado
            ? "editada"
            : "creada",
      ),
    );
    establecerRevision((valor) => valor + 1);
  };
  const recargar = () => {
    modal.closeModal();
    alRecargarProducto();
  };
  const paginas = Math.max(1, Math.ceil((datos?.count || 0) / 10));
  const crear = permisos.crear && producto.activo;
  if (!permisos.ver)
    return (
      <section className="superficie-cristal rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <IconoCandado className="size-5 text-gray-400" />
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {t("titulo")}
          </h2>
        </div>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          {t("sinPermiso")}
        </p>
      </section>
    );
  return (
    <section aria-label={t("titulo")}>
      <Contenedor
        title={t("titulo")}
        header={
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t("titulo")}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t("subtitulo")}
              </p>
            </div>
            {crear && (
              <Button
                size="sm"
                endIcon={<IconoAgregar className="size-4.5" />}
                onClick={() => abrir(null, "formulario")}
              >
                {t("nueva")}
              </Button>
            )}
          </div>
        }
      >
        {!producto.activo && (
          <p className="rounded-xl bg-warning-50 p-4 text-sm leading-6 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
            {t("productoInactivo")}
          </p>
        )}
        <BarraPresentaciones
          buscar={buscar}
          uso={uso}
          estado={estado}
          orden={orden}
          alBuscar={(valor) => {
            establecerBuscar(valor);
            establecerPagina(1);
          }}
          alUso={(valor) => {
            establecerUso(valor);
            establecerPagina(1);
          }}
          alEstado={(valor) => {
            establecerEstado(valor);
            establecerPagina(1);
          }}
          alOrden={(valor) => {
            establecerOrden(valor);
            establecerPagina(1);
          }}
          alLimpiar={() => {
            establecerBuscar("");
            establecerUso("");
            establecerEstado("");
            establecerOrden("nombre");
            establecerPagina(1);
          }}
        />
        {fallo ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-xl bg-error-50 p-4 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400"
          >
            <p className="flex-1">{fallo}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => establecerRevision((valor) => valor + 1)}
            >
              {t("reintentar")}
            </Button>
          </div>
        ) : (
          <TablaPresentaciones
            registros={datos?.results || []}
            cargando={cargando}
            filtrado={!!(buscar || uso || estado)}
            permisos={permisos}
            puedeCrear={crear}
            productoActivo={producto.activo}
            alCrear={() => abrir(null, "formulario")}
            alEditar={(registro) => abrir(registro, "formulario")}
            alEstado={(registro) => abrir(registro, "estado")}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p
            role="status"
            className="text-theme-xs text-gray-500 dark:text-gray-400"
          >
            {t("paginacion", {
              desde: datos?.count ? (pagina - 1) * 10 + 1 : 0,
              hasta: Math.min(pagina * 10, datos?.count || 0),
              total: datos?.count || 0,
            })}
          </p>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              disabled={pagina <= 1 || cargando || !!fallo}
              onClick={() => establecerPagina((valor) => valor - 1)}
            >
              {t("anterior")}
            </Button>
            <span className="text-theme-xs text-gray-500 tabular-nums dark:text-gray-400">
              {pagina} / {paginas}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={pagina >= paginas || cargando || !!fallo}
              onClick={() => establecerPagina((valor) => valor + 1)}
            >
              {t("siguiente")}
            </Button>
          </div>
        </div>
      </Contenedor>
      {modal.isOpen &&
        (modo === "formulario" ? (
          <FormularioPresentacion
            producto={producto}
            presentacion={seleccionado}
            alCerrar={modal.closeModal}
            alGuardar={guardado}
            alRecargar={recargar}
            alError={alError}
          />
        ) : (
          seleccionado && (
            <ConfirmarEstadoPresentacion
              registro={seleccionado}
              alCerrar={modal.closeModal}
              alGuardar={guardado}
              alRecargar={recargar}
              alError={alError}
            />
          )
        ))}
    </section>
  );
}
