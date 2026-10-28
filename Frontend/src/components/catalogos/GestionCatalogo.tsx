"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Contenedor from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import { useToast as useNotificaciones } from "@/hooks/useToast";
import { useModal } from "@/hooks/useModal";
import { LockIcon as IconoCandado } from "@/icons";
import { api, ApiError as ErrorApi } from "@/lib/api";
import BarraCatalogo, { PestanasCatalogo } from "./BarraCatalogo";
import TablaCatalogo from "./TablaCatalogo";
import ConfirmarEstadoCatalogo from "./ConfirmarEstadoCatalogo";
import {
  CONFIGURACION_CATALOGOS,
  type TipoListado,
  type PaginaCatalogo,
  type ResumenCatalogo,
  type RegistroCatalogo,
} from "./tipos";
import type { Session as Sesion } from "@/components/users/types";
import SelectorCatalogo from "@/components/productos/SelectorCatalogo";
import type { OpcionCatalogo } from "@/components/productos/tipos";

export default function GestionCatalogo({
  tipo,
  sesion,
}: {
  tipo: TipoListado;
  sesion: Sesion;
}) {
  const t = useTranslations("catalogos");
  const navegador = useRouter();
  const modal = useModal();
  const {
    toasts: avisos,
    notify: notificar,
    dismiss: cerrarAviso,
  } = useNotificaciones();
  const permisos =
    tipo === "productos"
      ? sesion.permisos_productos
      : sesion.permisos_catalogos[tipo];
  const ruta = CONFIGURACION_CATALOGOS[tipo].ruta;
  const [datos, establecerDatos] = useState<PaginaCatalogo | null>(null);
  const [resumen, establecerResumen] = useState<ResumenCatalogo | null>(null);
  const [buscar, establecerBuscar] = useState("");
  const [estado, establecerEstado] = useState("");
  const [categoria, establecerCategoria] = useState<OpcionCatalogo | null>(
    null,
  );
  const [unidad, establecerUnidad] = useState<OpcionCatalogo | null>(null);
  const [orden, establecerOrden] = useState("nombre");
  const [pagina, establecerPagina] = useState(1);
  const [cargando, establecerCargando] = useState(true);
  const [fallo, establecerFallo] = useState("");
  const [revision, establecerRevision] = useState(0);
  const [seleccionado, establecerSeleccionado] =
    useState<RegistroCatalogo | null>(null);
  const tratarError = useCallback(
    (error: unknown) => {
      if (error instanceof ErrorApi && error.status === 401) {
        navegador.replace("/signin");
        navegador.refresh();
        return;
      }
      notificar(
        t(
          error instanceof ErrorApi && error.status === 403
            ? "accesoDenegado"
            : error instanceof ErrorApi && error.status === 409
              ? "conflicto"
              : error instanceof ErrorApi && error.status === 400
                ? "validacion"
                : "errorCarga",
        ),
        "error",
      );
    },
    [navegador, notificar, t],
  );
  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      const clave = `catalogos:${tipo}:aviso`;
      const aviso = sessionStorage.getItem(clave);
      if (aviso === "creado" || aviso === "editado") {
        sessionStorage.removeItem(clave);
        notificar(t(aviso));
      }
    }, 0);
    return () => window.clearTimeout(temporizador);
  }, [tipo, notificar, t]);
  useEffect(() => {
    if (!permisos.ver) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(
      async () => {
        establecerCargando(true);
        establecerFallo("");
        const parametros = new URLSearchParams({
          buscar,
          orden,
          pagina: String(pagina),
        });
        if (estado) parametros.set("activo", estado);
        if (categoria) parametros.set("categoria", String(categoria.id));
        if (unidad) parametros.set("unidad_medida", String(unidad.id));
        const parametrosResumen = new URLSearchParams(parametros);
        parametrosResumen.delete("activo");
        parametrosResumen.delete("pagina");
        try {
          const [listado, contadores] = await Promise.all([
            api<PaginaCatalogo>(`${ruta}/?${parametros}`, {
              signal: controlador.signal,
            }),
            api<ResumenCatalogo>(`${ruta}/resumen/?${parametrosResumen}`, {
              signal: controlador.signal,
            }),
          ]);
          if (!controlador.signal.aborted) {
            establecerDatos(listado);
            establecerResumen(contadores);
          }
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
              tratarError(error);
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
    permisos.ver,
    ruta,
    buscar,
    estado,
    categoria,
    unidad,
    orden,
    pagina,
    revision,
    t,
    tratarError,
  ]);
  const guardarEstado = () => {
    modal.closeModal();
    establecerSeleccionado(null);
    notificar(t("estadoGuardado"));
    establecerRevision((valor) => valor + 1);
  };
  if (!permisos.ver)
    return (
      <div className="superficie-cristal rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-gray-900">
        <IconoCandado className="mx-auto mb-4 size-10 text-gray-400" />
        <h1 className="font-semibold text-gray-900 dark:text-white">
          {t("restringido")}
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t("accesoDenegado")}
        </p>
      </div>
    );
  const paginas = Math.max(1, Math.ceil((datos?.count || 0) / 10));
  return (
    <div className="space-y-6">
      <div>
        <MigasPagina pageTitle={t(`tipos.${tipo}.titulo`)} />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t(`tipos.${tipo}.subtitulo`)}
        </p>
      </div>
      <Contenedor
        title={t(`tipos.${tipo}.titulo`)}
        header={
          <PestanasCatalogo
            tipo={tipo}
            resumen={resumen}
            estado={estado}
            crear={permisos.crear}
            alEstado={(valor) => {
              establecerEstado(valor);
              establecerPagina(1);
            }}
            alCrear={() => navegador.push(`/${ruta}/nuevo`)}
          />
        }
      >
        <BarraCatalogo
          tipo={tipo}
          buscar={buscar}
          orden={orden}
          alBuscar={(valor) => {
            establecerBuscar(valor);
            establecerPagina(1);
          }}
          alOrden={(valor) => {
            establecerOrden(valor);
            establecerPagina(1);
          }}
        />
        {tipo === "productos" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
            <SelectorCatalogo
              tipo="categorias_productos"
              nombre="filtro_categoria"
              incluirInactivos
              etiqueta={t("categoria")}
              valor={categoria}
              alCambiar={(valor) => {
                establecerCategoria(valor);
                establecerPagina(1);
              }}
            />
            <SelectorCatalogo
              tipo="unidades_medida"
              nombre="filtro_unidad"
              incluirInactivos
              etiqueta={t("unidadMedida")}
              valor={unidad}
              alCambiar={(valor) => {
                establecerUnidad(valor);
                establecerPagina(1);
              }}
            />
          </div>
        )}
        {(buscar || estado || categoria || unidad || orden !== "nombre") && (
          <button
            type="button"
            onClick={() => {
              establecerBuscar("");
              establecerEstado("");
              establecerOrden("nombre");
              establecerCategoria(null);
              establecerUnidad(null);
              establecerPagina(1);
            }}
            className="rounded-lg text-theme-xs font-medium text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
          >
            {t("limpiarFiltros")}
          </button>
        )}
        {fallo ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-xl bg-error-50 p-4 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400"
          >
            <span className="flex-1">{fallo}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => establecerRevision((valor) => valor + 1)}
            >
              {t("reintentar")}
            </Button>
          </div>
        ) : (
          <TablaCatalogo
            tipo={tipo}
            registros={datos?.results || []}
            cargando={cargando}
            filtrado={!!(buscar || estado || categoria || unidad)}
            permisos={permisos}
            alEditar={(registro) =>
              navegador.push(`/${ruta}/${registro.id}/editar`)
            }
            alEstado={(registro) => {
              establecerSeleccionado(registro);
              modal.openModal();
            }}
            alCrear={() => navegador.push(`/${ruta}/nuevo`)}
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
              disabled={pagina <= 1 || cargando}
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
              disabled={pagina >= paginas || cargando}
              onClick={() => establecerPagina((valor) => valor + 1)}
            >
              {t("siguiente")}
            </Button>
          </div>
        </div>
      </Contenedor>
      {modal.isOpen && seleccionado && (
        <ConfirmarEstadoCatalogo
          tipo={tipo}
          registro={seleccionado}
          alCerrar={modal.closeModal}
          alGuardar={guardarEstado}
          alError={tratarError}
          alRecargar={() => {
            modal.closeModal();
            establecerSeleccionado(null);
            establecerRevision((valor) => valor + 1);
          }}
        />
      )}
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </div>
  );
}
