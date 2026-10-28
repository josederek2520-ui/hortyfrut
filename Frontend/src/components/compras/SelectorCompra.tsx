"use client";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronDown as IconoDesplegar,
  Plus as IconoAgregar,
  Check as IconoElegido,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import { useModal } from "@/hooks/useModal";
import { api, ApiError as ErrorApi } from "@/lib/api";
import PaginadorCompras from "./PaginadorCompras";
import type { OpcionCompra, PaginaCompra } from "./tipos";

export default function SelectorCompra<T extends OpcionCompra = OpcionCompra>({
  ruta,
  etiqueta,
  valor,
  alElegir,
  alError,
  opcionVacia,
  deshabilitado = false,
  error,
  agregar = false,
  nombre,
  descripcion,
  estaDisponible,
}: {
  ruta: string;
  etiqueta: string;
  valor: T | null;
  alElegir: (opcion: T | null) => void;
  alError: (error: unknown) => void;
  opcionVacia?: string;
  deshabilitado?: boolean;
  error?: string;
  agregar?: boolean;
  nombre?: string;
  descripcion?: (opcion: T) => ReactNode;
  estaDisponible?: (opcion: T) => boolean;
}) {
  const t = useTranslations("compras");
  const identificador = useId();
  const modal = useModal();
  const [buscar, establecerBuscar] = useState("");
  const [pagina, establecerPagina] = useState(1);
  const [datos, establecerDatos] = useState<PaginaCompra<T> | null>(null);
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
          const [base, consulta] = ruta.split("?");
          const parametros = new URLSearchParams(consulta);
          parametros.set("buscar", buscar);
          parametros.set("pagina", String(pagina));
          const respuesta = await api<PaginaCompra<T>>(
            `${base}?${parametros}`,
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
  }, [modal.isOpen, buscar, pagina, ruta, revision, alError]);
  const abrir = () => {
    establecerBuscar("");
    establecerPagina(1);
    establecerCargando(true);
    modal.openModal();
  };
  const elegir = (opcion: T | null) => {
    alElegir(opcion);
    modal.closeModal();
  };
  return (
    <div className="min-w-0">
      {agregar ? (
        <Button
          size="sm"
          variant="outline"
          disabled={deshabilitado}
          startIcon={<IconoAgregar className="size-4" />}
          onClick={abrir}
        >
          {etiqueta}
        </Button>
      ) : (
        <>
          <label
            htmlFor={identificador}
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {etiqueta}
          </label>
          <button
            type="button"
            id={identificador}
            name={nombre}
            disabled={deshabilitado}
            aria-haspopup="dialog"
            aria-expanded={modal.isOpen}
            data-invalido={!!error}
            aria-describedby={error ? `${identificador}-error` : undefined}
            onClick={abrir}
            className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2.5 text-start text-sm text-gray-800 shadow-theme-xs focus-visible:ring-3 focus-visible:ring-brand-500/20 focus-visible:outline-none disabled:opacity-60 dark:bg-gray-900 dark:text-gray-100 ${error ? "border-error-500 dark:border-error-400" : "border-gray-300 dark:border-gray-700"}`}
          >
            <span className="truncate">
              {valor?.nombre || opcionVacia || t("seleccionar")}
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
        </>
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
            {etiqueta}
          </h2>
          <div className="mt-5">
            <Input
              data-foco-inicial
              type="search"
              value={buscar}
              maxLength={150}
              placeholder={t("buscarOpciones")}
              aria-label={t("buscarOpciones")}
              onChange={(evento) => {
                establecerBuscar(evento.target.value);
                establecerPagina(1);
              }}
            />
          </div>
          <div
            className="my-4 max-h-80 space-y-1 overflow-y-auto"
            aria-busy={cargando}
          >
            {opcionVacia && (
              <button
                type="button"
                onClick={() => elegir(null)}
                className="min-h-11 w-full rounded-lg px-3 py-2 text-start text-sm text-gray-500 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                {opcionVacia}
              </button>
            )}
            {fallo ? (
              <div
                role="alert"
                className="space-y-3 p-3 text-sm text-error-500 dark:text-error-400"
              >
                <p>{t("errorOpciones")}</p>
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
              datos.results.map((opcion) => (
                <button
                  type="button"
                  key={opcion.id}
                  disabled={estaDisponible ? !estaDisponible(opcion) : false}
                  aria-pressed={valor?.id === opcion.id}
                  onClick={() => elegir(opcion)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-start hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-brand-500/10"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium break-words text-gray-800 dark:text-gray-100">
                      {opcion.nombre}
                    </span>
                    {opcion.subtitulo && (
                      <span className="mt-1 block text-theme-xs text-gray-500 dark:text-gray-400">
                        {opcion.subtitulo}
                      </span>
                    )}
                    {descripcion && (
                      <span className="mt-1 block text-theme-xs text-gray-500 dark:text-gray-400">
                        {descripcion(opcion)}
                      </span>
                    )}
                  </span>
                  {valor?.id === opcion.id && (
                    <IconoElegido
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
                {t("sinOpciones")}
              </p>
            )}
          </div>
          <PaginadorCompras
            pagina={pagina}
            total={datos?.count || 0}
            alCambiar={establecerPagina}
            ocupado={cargando || fallo}
          />
        </div>
      </Modal>
    </div>
  );
}
