"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import {
  ChevronDownIcon as IconoDesplegar,
  CheckLineIcon as IconoSeleccionado,
} from "@/icons";
import { api, ApiError as ErrorApi } from "@/lib/api";
import type { TipoCatalogo } from "@/components/catalogos/tipos";
import type { OpcionCatalogo } from "./tipos";

interface Propiedades {
  tipo: TipoCatalogo;
  nombre: string;
  etiqueta: string;
  valor: OpcionCatalogo | null;
  alCambiar: (valor: OpcionCatalogo | null) => void;
  error?: string;
  obligatorio?: boolean;
  deshabilitado?: boolean;
  incluirInactivos?: boolean;
}

export default function SelectorCatalogo({
  tipo,
  nombre,
  etiqueta,
  valor,
  alCambiar,
  error,
  obligatorio,
  deshabilitado,
  incluirInactivos = false,
}: Propiedades) {
  const t = useTranslations("productos");
  const identificador = useId();
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const busqueda = useRef<HTMLInputElement | null>(null);
  const [abierto, establecerAbierto] = useState(false);
  const [buscar, establecerBuscar] = useState("");
  const [pagina, establecerPagina] = useState(1);
  const [datos, establecerDatos] = useState<{
    count: number;
    results: OpcionCatalogo[];
  } | null>(null);
  const [cargando, establecerCargando] = useState(false);
  const [fallo, establecerFallo] = useState("");
  const [revision, establecerRevision] = useState(0);
  useEffect(() => {
    if (!abierto) return;
    busqueda.current =
      contenedor.current?.querySelector<HTMLInputElement>(
        'input[type="search"]',
      ) || null;
    busqueda.current?.focus();
    const cerrar = (evento: PointerEvent) => {
      if (!contenedor.current?.contains(evento.target as Node))
        establecerAbierto(false);
    };
    document.addEventListener("pointerdown", cerrar);
    return () => document.removeEventListener("pointerdown", cerrar);
  }, [abierto]);
  useEffect(() => {
    if (!abierto) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(
      async () => {
        establecerCargando(true);
        establecerFallo("");
        try {
          const parametros = new URLSearchParams({
            tipo,
            buscar,
            pagina: String(pagina),
            incluir_inactivos: String(incluirInactivos),
          });
          const resultado = await api<{
            count: number;
            results: OpcionCatalogo[];
          }>(`productos/opciones/?${parametros}`, {
            signal: controlador.signal,
          });
          if (!controlador.signal.aborted) establecerDatos(resultado);
        } catch (error) {
          if (!controlador.signal.aborted) {
            if (error instanceof ErrorApi && error.status === 404 && pagina > 1)
              establecerPagina(1);
            else establecerFallo(t("errorOpciones"));
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
  }, [abierto, buscar, pagina, tipo, t, revision, incluirInactivos]);
  const elegir = (opcion: OpcionCatalogo | null) => {
    alCambiar(opcion);
    establecerAbierto(false);
    boton.current?.focus();
  };
  return (
    <div
      ref={contenedor}
      className="relative min-w-0"
      onBlur={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget as Node))
          establecerAbierto(false);
      }}
      onKeyDown={(evento) => {
        if (evento.key === "Escape" && abierto) {
          evento.preventDefault();
          evento.stopPropagation();
          establecerAbierto(false);
          boton.current?.focus();
        }
      }}
    >
      <label
        htmlFor={identificador}
        className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {etiqueta} {obligatorio && <span className="text-error-500">*</span>}
      </label>
      <select
        name={nombre}
        value={valor?.id || ""}
        onChange={() => undefined}
        required={obligatorio}
        disabled={deshabilitado}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      >
        <option value="" />
        {valor && <option value={valor.id}>{valor.nombre}</option>}
      </select>
      <button
        ref={boton}
        id={identificador}
        type="button"
        role="combobox"
        aria-required={obligatorio}
        aria-expanded={abierto}
        aria-controls={`${identificador}-opciones`}
        aria-haspopup="dialog"
        aria-invalid={!!error}
        aria-describedby={error ? `${identificador}-error` : undefined}
        disabled={deshabilitado}
        onClick={() => {
          if (!abierto) establecerCargando(true);
          establecerAbierto(!abierto);
          establecerBuscar("");
          establecerPagina(1);
        }}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-start text-sm shadow-theme-xs focus-visible:ring-3 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${error ? "border-error-500 bg-error-50 focus-visible:ring-error-500/20 dark:border-error-400 dark:bg-error-500/10" : "border-gray-300 bg-white focus-visible:border-brand-300 focus-visible:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900"} ${valor ? "text-gray-800 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}`}
      >
        <span className="truncate">
          {valor
            ? `${valor.nombre}${valor.abreviatura ? ` (${valor.abreviatura})` : ""}${!valor.activo ? ` · ${t("inactivo")}` : ""}`
            : t("seleccionar")}
        </span>
        <IconoDesplegar className="size-4 shrink-0" />
      </button>
      {error && (
        <p
          id={`${identificador}-error`}
          className="mt-1.5 text-theme-xs text-error-500 dark:text-error-400"
        >
          {error}
        </p>
      )}
      {abierto && (
        <div
          id={`${identificador}-opciones`}
          role="dialog"
          aria-label={etiqueta}
          className="absolute start-0 top-full z-30 mt-2 w-full min-w-60 rounded-xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <Input
            type="search"
            value={buscar}
            maxLength={100}
            aria-label={t("buscarOpciones", { etiqueta })}
            placeholder={t("buscar")}
            onChange={(evento) => {
              establecerBuscar(evento.target.value);
              establecerPagina(1);
              establecerCargando(true);
            }}
            onKeyDown={(evento) => {
              if (evento.key === "ArrowDown") {
                evento.preventDefault();
                contenedor.current
                  ?.querySelector<HTMLButtonElement>("[data-opcion]")
                  ?.focus();
              }
            }}
          />
          <div
            aria-busy={cargando}
            className="mt-2 custom-scrollbar max-h-60 space-y-1 overflow-y-auto"
          >
            {!obligatorio && (
              <button
                type="button"
                className="w-full rounded-lg p-2 text-start text-sm text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                onClick={() => elegir(null)}
              >
                {t("todas")}
              </button>
            )}
            {fallo ? (
              <div role="alert" className="p-3 text-sm text-error-500">
                <p>{fallo}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
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
                  key={opcion.id}
                  type="button"
                  data-opcion
                  aria-pressed={valor?.id === opcion.id}
                  onClick={() => elegir(opcion)}
                  onKeyDown={(evento) => {
                    const opciones = Array.from(
                      contenedor.current?.querySelectorAll<HTMLButtonElement>(
                        "[data-opcion]",
                      ) || [],
                    );
                    const indice = opciones.indexOf(evento.currentTarget);
                    if (
                      evento.key === "ArrowDown" ||
                      evento.key === "ArrowUp"
                    ) {
                      evento.preventDefault();
                      opciones[
                        (indice +
                          (evento.key === "ArrowDown"
                            ? 1
                            : opciones.length - 1)) %
                          opciones.length
                      ]?.focus();
                    }
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-start text-sm text-gray-700 hover:bg-brand-50 focus-visible:bg-brand-50 focus-visible:outline-none dark:text-gray-200 dark:hover:bg-brand-500/10 dark:focus-visible:bg-brand-500/10"
                >
                  <span>
                    {opcion.nombre}
                    {opcion.abreviatura && (
                      <span className="ms-2 text-gray-400">
                        {opcion.abreviatura}
                      </span>
                    )}
                  </span>
                  {valor?.id === opcion.id && (
                    <IconoSeleccionado className="size-4 shrink-0 text-brand-500" />
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
          {!!datos?.count && (
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
              <Button
                size="sm"
                variant="outline"
                disabled={pagina <= 1 || cargando}
                onClick={() => establecerPagina((valor) => valor - 1)}
              >
                {t("anterior")}
              </Button>
              <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                {pagina}/{Math.ceil(datos.count / 10)}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={pagina * 10 >= datos.count || cargando}
                onClick={() => establecerPagina((valor) => valor + 1)}
              >
                {t("siguiente")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
