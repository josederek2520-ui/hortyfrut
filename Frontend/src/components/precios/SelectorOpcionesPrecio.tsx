"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Plus, Search } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import useConsultaPaginada from "@/hooks/useConsultaPaginada";
import { campoPrecio, type OpcionPrecio } from "./tipos";

export default function SelectorOpcionesPrecio({
  tipo,
  cliente,
  seleccionados,
  bloqueado,
  soloConsulta = false,
  alElegir,
  alCerrar,
}: {
  tipo: "clientes" | "productos" | "entregas";
  cliente?: number;
  seleccionados: number[];
  bloqueado: boolean;
  soloConsulta?: boolean;
  alElegir: (opcion: OpcionPrecio) => void;
  alCerrar: () => void;
}) {
  const t = useTranslations("precios"),
    identificador = useId();
  const [buscar, establecerBuscar] = useState(""),
    [pagina, establecerPagina] = useState(1);
  const consulta = useConsultaPaginada<OpcionPrecio>(
    "precios-acordados/" +
      tipo +
      "/?" +
      new URLSearchParams({
        buscar,
        pagina: String(pagina),
        ...(cliente ? { cliente: String(cliente) } : {}),
        ...(soloConsulta ? { seleccion: seleccionados.join(",") } : {}),
      }),
    () => establecerPagina(1),
  );
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!bloqueado) alCerrar();
      }}
      labelledBy={identificador}
      closeLabel={t("cerrar")}
      className="max-w-2xl"
    >
      <div className="p-5 sm:p-6">
        <h2
          id={identificador}
          className="pe-8 text-xl font-semibold text-gray-900 dark:text-white"
        >
          {t("selectores." + tipo)}
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t(
            tipo === "productos"
              ? "ayudaProductos"
              : tipo === "entregas"
                ? "ayudaEntregas"
                : "ayudaClientes",
          )}
        </p>
        <label className="relative mt-5 block">
          <span className="sr-only">{t("buscarOpciones")}</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-3.5 size-4 text-gray-500"
          />
          <input
            type="search"
            autoFocus
            autoComplete="off"
            maxLength={150}
            className={campoPrecio + " ps-9"}
            placeholder={t("buscarOpciones")}
            value={buscar}
            onChange={(e) => {
              establecerBuscar(e.target.value);
              establecerPagina(1);
            }}
          />
        </label>
        <div className="mt-3 max-h-80 min-h-48 overflow-y-auto">
          {consulta.fallo ? (
            <div role="alert" className="space-y-3 p-5">
              <p>{t("errorConsulta")}</p>
              <Button variant="outline" onClick={consulta.recargar}>
                {t("reintentar")}
              </Button>
            </div>
          ) : !consulta.datos ? (
            <p role="status" className="p-6">
              {t("cargando")}
            </p>
          ) : !consulta.datos.count ? (
            <p className="p-6 text-sm text-gray-500">{t("sinOpciones")}</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {consulta.datos.results.map((opcion) => {
                const elegido = seleccionados.includes(opcion.id);
                return (
                  <li key={opcion.id}>
                    <button
                      type="button"
                      disabled={
                        bloqueado ||
                        soloConsulta ||
                        (tipo === "productos" && elegido) ||
                        (tipo !== "clientes" &&
                          !elegido &&
                          seleccionados.length >= 500)
                      }
                      aria-pressed={elegido}
                      className="flex min-h-16 w-full items-center justify-between gap-4 rounded-lg p-3 text-start hover:bg-brand-25 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-60 dark:hover:bg-gray-800"
                      onClick={() => {
                        alElegir(opcion);
                        if (tipo === "clientes") alCerrar();
                      }}
                    >
                      <span>
                        <span className="block text-sm font-medium">
                          {opcion.nombre}
                          {opcion.sucursal_nombre
                            ? " · " + opcion.sucursal_nombre
                            : ""}
                        </span>
                        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                          {opcion.categoria_nombre ?? opcion.codigo_pedido}
                        </span>
                      </span>
                      {elegido ? (
                        <Check
                          className="size-5 text-brand-600 dark:text-brand-300"
                          aria-hidden="true"
                        />
                      ) : (
                        <Plus
                          className="size-4 text-gray-500"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {consulta.datos && consulta.datos.count > 10 && (
          <PaginadorPedidos
            pagina={pagina}
            total={consulta.datos.count}
            alCambiar={establecerPagina}
            ocupado={bloqueado}
          />
        )}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <p className="text-xs text-gray-500">
            {tipo !== "clientes" &&
              t("seleccionados", { total: seleccionados.length })}
          </p>
          <Button onClick={alCerrar} disabled={bloqueado}>
            {t("listo")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
