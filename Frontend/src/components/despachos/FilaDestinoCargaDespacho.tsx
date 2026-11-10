"use client";
import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Store as IconoDestino,
  ChevronDown as IconoDesplegar,
} from "lucide-react";
import PedidosDestino from "./PedidosDestinoDespacho";
import type {
  CargaPreparada,
  DestinoCargaDespacho,
  PedidoCargaDespacho,
} from "./tipos";
export default function FilaDestinoCargaDespacho({
  destino,
  elegidas,
  seleccionadas,
  cargando,
  bloqueado,
  soloElegidas,
  rutaDetalle,
  alSeleccionar,
  alSeleccionarPedido,
  alAlternar,
  alError,
}: {
  destino: DestinoCargaDespacho;
  elegidas: CargaPreparada[];
  seleccionadas: CargaPreparada[];
  cargando: boolean;
  bloqueado: boolean;
  soloElegidas: boolean;
  rutaDetalle: string;
  alSeleccionar: () => void;
  alSeleccionarPedido: (pedido: PedidoCargaDespacho) => void;
  alAlternar: (fila: CargaPreparada) => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("despachos");
  const idioma = useLocale();
  const identificador = useId();
  const [abierto, establecerAbierto] = useState(false);
  const completa =
    elegidas.length === destino.asignaciones && elegidas.length > 0;
  const parcial = elegidas.length > 0 && !completa;
  return (
    <article
      className={
        "px-4 py-3 transition-colors duration-150 motion-reduce:transition-none " +
        (completa
          ? "bg-brand-50 dark:bg-brand-500/15"
          : parcial
            ? "bg-brand-25 dark:bg-brand-500/5"
            : "bg-white dark:bg-gray-900")
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-start gap-3">
          <IconoDestino
            className="mt-0.5 size-5 shrink-0 text-gray-500 dark:text-gray-400"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {destino.cliente_nombre} · {destino.sucursal_nombre}
            </h3>
            <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
              {t("pedidosCargaCantidad", { cantidad: destino.pedidos })} ·{" "}
              {t("productosPreparadosDestino", { cantidad: destino.productos })}{" "}
              ·{" "}
              {!!destino.cajas && (
                <>{t("cajasCargaValor", { cantidad: destino.cajas })} · </>
              )}
              {!!destino.unidades && (
                <>
                  {t("unidadesCargaValor", { cantidad: destino.unidades })}{" "}
                  ·{" "}
                </>
              )}
              {new Intl.NumberFormat(idioma, {
                maximumFractionDigits: 3,
              }).format(Number(destino.peso_kg))}{" "}
              kg
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            aria-expanded={abierto}
            aria-controls={identificador}
            aria-label={t("verPedidosSucursalCarga", {
              sucursal: destino.sucursal_nombre,
            })}
            onClick={() => establecerAbierto(!abierto)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-theme-xs font-medium text-gray-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-300"
          >
            {t("verPedidosCarga")}
            <IconoDesplegar
              aria-hidden="true"
              className={`size-4 transition-transform motion-reduce:transition-none ${abierto ? "rotate-180" : ""}`}
            />
          </button>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-theme-xs font-medium text-gray-700 hover:bg-white/60 dark:text-gray-200 dark:hover:bg-gray-800/40">
            <input
              type="checkbox"
              aria-label={t("seleccionarDestinoCompleto", {
                sucursal: destino.sucursal_nombre,
              })}
              aria-checked={parcial ? "mixed" : completa}
              checked={completa}
              ref={(entrada) => {
                if (entrada) entrada.indeterminate = parcial;
              }}
              disabled={bloqueado}
              onChange={alSeleccionar}
              className="size-5 accent-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400"
            />
            {t("incluirTodaCargaSucursal")}
          </label>
        </div>
      </div>
      {cargando && (
        <p
          role="status"
          className="mt-2 text-theme-xs text-gray-600 dark:text-gray-300"
        >
          {t("cargandoDestinoCompleto")}
        </p>
      )}
      <div id={identificador} hidden={!abierto}>
        {abierto && (
          <>
            {destino.direccion && (
              <p className="mt-3 text-theme-xs text-gray-500 dark:text-gray-400">
                {destino.direccion}
              </p>
            )}
            <PedidosDestino
              key={rutaDetalle}
              ruta={rutaDetalle}
              filasElegidas={elegidas}
              soloElegidas={soloElegidas}
              seleccionadas={seleccionadas}
              bloqueado={bloqueado}
              alSeleccionarPedido={alSeleccionarPedido}
              alAlternar={alAlternar}
              alError={alError}
            />
          </>
        )}
      </div>
    </article>
  );
}
