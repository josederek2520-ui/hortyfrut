"use client";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronDown as IconoDesplegar,
  Check as IconoSeleccionado,
  Search as IconoBuscar,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import { useModal } from "@/hooks/useModal";
import { api, ApiError as ErrorApi } from "@/lib/api";
import type { CategoriaProveedor, PaginaResultados } from "./tipos";

export default function SelectorCategoriaProveedor({
  valor,
  alCambiar,
  deshabilitado = false,
  filtro = false,
  error,
  alError,
}: {
  valor: CategoriaProveedor | null;
  alCambiar: (categoria: CategoriaProveedor | null) => void;
  deshabilitado?: boolean;
  filtro?: boolean;
  error?: string;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("proveedores");
  const identificador = useId();
  const modal = useModal();
  const [buscar, establecerBuscar] = useState("");
  const [pagina, establecerPagina] = useState(1);
  const [datos, establecerDatos] =
    useState<PaginaResultados<CategoriaProveedor> | null>(null);
  const [cargando, establecerCargando] = useState(true);
  const [fallo, establecerFallo] = useState(false);
  const [revision, establecerRevision] = useState(0);
  useEffect(() => {
    if (!modal.isOpen) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(
      async () => {
        establecerCargando(true);
        establecerFallo(false);
        try {
          const parametros = new URLSearchParams({
            buscar,
            pagina: String(pagina),
            incluir_inactivos: String(filtro),
          });
          const respuesta = await api<PaginaResultados<CategoriaProveedor>>(
            `proveedores/categorias/?${parametros}`,
            { signal: controlador.signal },
          );
          if (!controlador.signal.aborted) establecerDatos(respuesta);
        } catch (problema) {
          if (!controlador.signal.aborted) {
            if (
              problema instanceof ErrorApi &&
              problema.status === 404 &&
              pagina > 1
            )
              establecerPagina(1);
            else {
              establecerFallo(true);
              alError(problema);
            }
          }
        } finally {
          if (!controlador.signal.aborted) establecerCargando(false);
        }
      },
      buscar ? 250 : 0,
    );
    return () => {
      controlador.abort();
      window.clearTimeout(temporizador);
    };
  }, [modal.isOpen, buscar, pagina, filtro, revision, alError]);
  const seleccionar = (categoria: CategoriaProveedor | null) => {
    alCambiar(categoria);
    modal.closeModal();
  };
  return (
    <div className="min-w-0">
      <label
        htmlFor={identificador}
        className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {t("categoria")}
      </label>
      <button
        id={identificador}
        type="button"
        disabled={deshabilitado}
        aria-haspopup="dialog"
        aria-expanded={modal.isOpen}
        data-invalido={!!error}
        aria-describedby={error ? `${identificador}-error` : undefined}
        onClick={() => {
          establecerBuscar("");
          establecerPagina(1);
          establecerCargando(true);
          modal.openModal();
        }}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border bg-white px-3.5 py-2.5 text-start text-sm shadow-theme-xs focus-visible:ring-3 focus-visible:ring-brand-500/20 focus-visible:outline-none disabled:opacity-60 dark:bg-gray-900 ${error ? "border-error-500 dark:border-error-400" : "border-gray-300 dark:border-gray-700"} ${valor ? "text-gray-800 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}
      >
        <span className="truncate">
          {valor
            ? `${valor.nombre}${!valor.activo ? ` · ${t("categoriaInactiva")}` : ""}`
            : t(filtro ? "todasCategorias" : "sinCategoria")}
        </span>
        <IconoDesplegar className="size-4 shrink-0" aria-hidden="true" />
      </button>
      {error && (
        <p
          id={`${identificador}-error`}
          className="mt-1.5 text-theme-xs text-error-500 dark:text-error-400"
        >
          {error}
        </p>
      )}
      <Modal
        isOpen={modal.isOpen}
        onClose={modal.closeModal}
        className="max-w-lg"
        labelledBy={`${identificador}-titulo`}
        closeLabel={t("cerrar")}
      >
        <div className="p-6 sm:p-8">
          <h2
            id={`${identificador}-titulo`}
            className="pe-8 text-xl font-semibold text-gray-900 dark:text-white"
          >
            {t("seleccionarCategoria")}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t("ayudaCategoria")}
          </p>
          <div className="relative mt-5">
            <IconoBuscar
            className="pointer-events-none absolute start-3.5 top-3 z-1 size-5 text-gray-400"
              aria-hidden="true"
            />
            <Input
              data-foco-inicial
              type="search"
              value={buscar}
              maxLength={150}
              className="ps-11"
              aria-label={t("buscarCategoria")}
              placeholder={t("buscarCategoria")}
              onChange={(evento) => {
                establecerBuscar(evento.target.value);
                establecerPagina(1);
              }}
            />
          </div>
          <div
            className="mt-4 max-h-80 space-y-1 overflow-y-auto"
            aria-busy={cargando}
          >
            <button
              type="button"
              aria-pressed={!valor}
              onClick={() => seleccionar(null)}
              className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2 text-start text-sm text-gray-600 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-300 dark:hover:bg-brand-500/10"
            >
              {t(filtro ? "todasCategorias" : "sinCategoria")}
              {!valor && (
                <IconoSeleccionado className="size-4 text-brand-500" />
              )}
            </button>
            {fallo ? (
              <div
                role="alert"
                className="space-y-3 p-3 text-sm text-error-500 dark:text-error-400"
              >
                <p>{t("errorCategorias")}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => establecerRevision((valor) => valor + 1)}
                >
                  {t("reintentar")}
                </Button>
              </div>
            ) : cargando ? (
              <p
                role="status"
                className="p-3 text-sm text-gray-500 dark:text-gray-400"
              >
                {t("cargando")}
              </p>
            ) : datos?.results.length ? (
              datos.results.map((categoria) => (
                <button
                  key={categoria.id}
                  type="button"
                  aria-pressed={valor?.id === categoria.id}
                  onClick={() => seleccionar(categoria)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-sm text-gray-800 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-100 dark:hover:bg-brand-500/10"
                >
                  <span className="break-words">
                    {categoria.nombre}
                    {!categoria.activo && (
                      <span className="ms-2 text-theme-xs text-gray-500 dark:text-gray-400">
                        {t("categoriaInactiva")}
                      </span>
                    )}
                  </span>
                  {valor?.id === categoria.id && (
                    <IconoSeleccionado
                      className="size-4 shrink-0 text-brand-500"
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))
            ) : (
              <p
                role="status"
                className="p-3 text-sm text-gray-500 dark:text-gray-400"
              >
                {t("sinCategorias")}
              </p>
            )}
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
            <Button
              size="sm"
              variant="outline"
              disabled={pagina <= 1 || cargando || fallo}
              onClick={() => establecerPagina((valor) => valor - 1)}
            >
              {t("anterior")}
            </Button>
            <span className="text-theme-xs text-gray-500 dark:text-gray-400">
              {pagina} / {Math.max(1, Math.ceil((datos?.count || 0) / 10))}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={pagina * 10 >= (datos?.count || 0) || cargando || fallo}
              onClick={() => establecerPagina((valor) => valor + 1)}
            >
              {t("siguiente")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
