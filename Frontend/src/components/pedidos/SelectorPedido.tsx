"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { SearchIcon, ChevronDownIcon } from "@/icons";
import PaginadorPedidos from "./PaginadorPedidos";
import {
  claseEntrada,
  type OpcionPedido,
  type PaginaResultados,
} from "./tipos";

export default function SelectorPedido({
  ruta,
  valor,
  alCambiar,
  etiqueta,
  nombre,
  deshabilitado = false,
  error,
  alError,
}: {
  ruta: string;
  valor: OpcionPedido | null;
  alCambiar: (opcion: OpcionPedido | null) => void;
  etiqueta: string;
  nombre?: string;
  deshabilitado?: boolean;
  error?: string;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("pedidos");
  const identificador = useId();
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const [abierto, establecerAbierto] = useState(false),
    [buscar, establecerBuscar] = useState(""),
    [pagina, establecerPagina] = useState(1);
  const [datos, establecerDatos] =
      useState<PaginaResultados<OpcionPedido> | null>(null),
    [cargando, establecerCargando] = useState(false),
    [fallo, establecerFallo] = useState(false);
  useEffect(() => {
    if (!abierto) return;
    const cerrarFuera = (evento: PointerEvent) => {
      if (!contenedor.current?.contains(evento.target as Node))
        establecerAbierto(false);
    };
    document.addEventListener("pointerdown", cerrarFuera);
    return () => document.removeEventListener("pointerdown", cerrarFuera);
  }, [abierto]);
  useEffect(() => {
    if (!abierto) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(async () => {
      establecerCargando(true);
      establecerFallo(false);
      try {
        const respuesta = await api<PaginaResultados<OpcionPedido>>(
          `${ruta}?${new URLSearchParams({ buscar, pagina: String(pagina) })}`,
          { signal: controlador.signal },
        );
        establecerDatos(respuesta);
      } catch (error) {
        if (!controlador.signal.aborted) {
          establecerFallo(true);
          alError(error);
        }
      } finally {
        if (!controlador.signal.aborted) establecerCargando(false);
      }
    }, 200);
    return () => {
      controlador.abort();
      window.clearTimeout(temporizador);
    };
  }, [abierto, ruta, buscar, pagina, alError]);
  return (
    <div ref={contenedor} className="relative">
      <label
        id={`${identificador}-etiqueta`}
        htmlFor={nombre || `${identificador}-control`}
        className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {etiqueta}
      </label>
      <button
        ref={boton}
        id={nombre || `${identificador}-control`}
        type="button"
        disabled={deshabilitado}
        aria-labelledby={`${identificador}-etiqueta ${identificador}-valor`}
        aria-expanded={abierto}
        aria-controls={`${identificador}-opciones`}
        data-invalido={!!error}
        aria-describedby={error ? `${identificador}-error` : undefined}
        onClick={() => establecerAbierto(!abierto)}
        className={`${claseEntrada} flex items-center justify-between gap-2 text-start ${error ? "!border-error-500 !bg-error-50 dark:!bg-error-500/10" : ""}`}
      >
        <span id={`${identificador}-valor`} className="truncate">
          {valor
            ? `${valor.cliente ? `${valor.cliente} · ` : ""}${valor.nombre}`
            : t("seleccionar")}
        </span>
        <ChevronDownIcon className="size-4 shrink-0" />
      </button>
      {error && (
        <p
          id={`${identificador}-error`}
          className="mt-1 text-xs text-error-500"
        >
          {error}
        </p>
      )}
      {abierto && !deshabilitado && (
        <div
          id={`${identificador}-opciones`}
          onKeyDown={(evento) => {
            if (evento.key === "Escape") {
              evento.stopPropagation();
              establecerAbierto(false);
              boton.current?.focus();
            }
          }}
          className="absolute start-0 top-full z-40 mt-2 w-full min-w-64 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="relative m-3">
            <SearchIcon className="absolute start-3 top-3 size-4 text-gray-400" />
            <input
              autoFocus
              aria-label={t("buscarOpciones")}
              value={buscar}
              onChange={(evento) => {
                establecerBuscar(evento.target.value);
                establecerPagina(1);
              }}
              className={`${claseEntrada} ps-9`}
              placeholder={t("buscarOpciones")}
            />
          </div>
          <div aria-busy={cargando} className="max-h-60 overflow-y-auto p-2">
            {cargando ? (
              <p className="p-3 text-sm text-gray-500">{t("cargando")}</p>
            ) : fallo ? (
              <p role="alert" className="p-3 text-sm text-error-500">
                {t("errorCarga")}
              </p>
            ) : (
              <>
                {
                  <button
                    type="button"
                    onClick={() => {
                      alCambiar(null);
                      establecerAbierto(false);
                      boton.current?.focus();
                    }}
                    className="w-full rounded-lg p-3 text-start text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    {t("sinSeleccion")}
                  </button>
                }
                {datos?.results.map((opcion) => (
                  <button
                    type="button"
                    key={opcion.id}
                    onClick={() => {
                      alCambiar(opcion);
                      establecerAbierto(false);
                      boton.current?.focus();
                    }}
                    className={`block w-full rounded-lg px-3 py-2.5 text-start text-sm hover:bg-brand-50 dark:hover:bg-brand-500/10 ${valor?.id === opcion.id ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400" : "text-gray-800 dark:text-gray-200"}`}
                  >
                    <span className="block font-medium">{opcion.nombre}</span>
                    {opcion.cliente && (
                      <span className="text-xs text-gray-500">
                        {opcion.cliente}
                      </span>
                    )}
                  </button>
                ))}
                {datos?.count === 0 && (
                  <p className="p-3 text-sm text-gray-500">
                    {t("sinOpciones")}
                  </p>
                )}
              </>
            )}
          </div>
          <PaginadorPedidos
            pagina={pagina}
            total={datos?.count || 0}
            alCambiar={establecerPagina}
            ocupado={cargando}
          />
          <button
            type="button"
            className="w-full border-t border-gray-100 py-2 text-sm text-brand-500 dark:border-gray-800"
            onClick={() => establecerAbierto(false)}
          >
            {t("cerrar")}
          </button>
        </div>
      )}
    </div>
  );
}
