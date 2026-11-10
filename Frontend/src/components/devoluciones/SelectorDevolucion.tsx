"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Search } from "lucide-react";
import Button from "@/components/ui/button/Button";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import usePaginaDevoluciones from "./usePaginaDevoluciones";
import { entradaDevolucion, type OrigenDevolucion } from "./tipos";

interface Opcion {
  id: number;
  nombre?: string;
  codigo?: string;
  sucursal_nombre?: string;
  cliente_nombre?: string;
}
export default function SelectorDevolucion({
  tipo,
  valor,
  bloqueado,
  alElegir,
}: {
  tipo: "entrega" | "almacen";
  valor: { id: number; nombre: string } | null;
  bloqueado: boolean;
  alElegir: (
    opcion: { id: number; nombre: string } & Partial<OrigenDevolucion>,
  ) => void;
}) {
  const t = useTranslations("devoluciones");
  const [abierto, establecerAbierto] = useState(false),
    [buscar, establecerBuscar] = useState(""),
    [pagina, establecerPagina] = useState(1);
  const raiz = useRef<HTMLDivElement>(null),
    boton = useRef<HTMLButtonElement>(null),
    buscador = useRef<HTMLInputElement>(null);
  const consulta = usePaginaDevoluciones<Opcion>(
    abierto
      ? "devoluciones/" +
          (tipo === "entrega" ? "entregas" : "almacenes") +
          "/?" +
          new URLSearchParams({ buscar, pagina: String(pagina) })
      : null,
    () => establecerPagina(1),
  );
  useEffect(() => {
    if (!abierto) return;
    buscador.current?.focus();
    const cerrar = (evento: PointerEvent) => {
      if (!raiz.current?.contains(evento.target as Node))
        establecerAbierto(false);
    };
    document.addEventListener("pointerdown", cerrar);
    return () => document.removeEventListener("pointerdown", cerrar);
  }, [abierto]);
  return (
    <div
      ref={raiz}
      className="relative"
      onKeyDown={(evento) => {
        if (evento.key === "Escape") {
          evento.stopPropagation();
          establecerAbierto(false);
          boton.current?.focus();
        }
      }}
    >
      <button
        ref={boton}
        type="button"
        data-campo-devolucion={tipo}
        disabled={bloqueado}
        aria-expanded={abierto}
        className={
          entradaDevolucion +
          " flex items-center justify-between gap-2 text-start"
        }
        onClick={() => establecerAbierto((valor) => !valor)}
      >
        <span className="truncate">
          {valor?.nombre ||
            t(tipo === "entrega" ? "elegirEntrega" : "elegirAlmacen")}
        </span>
        <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
      </button>
      {abierto && (
        <div className="superficie-flotante-suave absolute inset-x-0 top-full z-40 mt-2 min-w-64 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <label className="relative block">
            <span className="sr-only">{t("buscarOpcion")}</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-3.5 size-4 text-gray-500"
            />
            <input
              ref={buscador}
              type="search"
              autoComplete="off"
              maxLength={150}
              className={entradaDevolucion + " ps-9"}
              value={buscar}
              placeholder={t("buscarOpcion")}
              onChange={(evento) => {
                establecerBuscar(evento.target.value);
                establecerPagina(1);
              }}
            />
          </label>
          {consulta.fallo ? (
            <div role="alert" className="space-y-2 py-3 text-sm">
              <p>{t("errorConsulta")}</p>
              <Button variant="outline" onClick={consulta.recargar}>
                {t("reintentar")}
              </Button>
            </div>
          ) : !consulta.datos ? (
            <p role="status" className="p-3 text-sm">
              {t("cargando")}
            </p>
          ) : !consulta.datos.count ? (
            <p className="p-3 text-sm text-gray-500">{t("sinOpciones")}</p>
          ) : (
            <>
              <ul className="mt-2 max-h-64 overflow-y-auto">
                {consulta.datos.results.map((opcion) => (
                  <li key={opcion.id}>
                    <button
                      type="button"
                      aria-pressed={valor?.id === opcion.id}
                      className="w-full rounded-lg p-3 text-start text-sm hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-brand-950"
                      onClick={() => {
                        alElegir({
                          ...opcion,
                          nombre:
                            opcion.nombre ||
                            opcion.codigo + " · " + opcion.sucursal_nombre,
                        });
                        establecerAbierto(false);
                        boton.current?.focus();
                      }}
                    >
                      <span className="block font-medium">
                        {opcion.nombre || opcion.sucursal_nombre}
                      </span>
                      {opcion.codigo && (
                        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                          {opcion.codigo} · {opcion.cliente_nombre}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              {consulta.datos.count > 10 && (
                <PaginadorPedidos
                  pagina={pagina}
                  total={consulta.datos.count}
                  alCambiar={establecerPagina}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
