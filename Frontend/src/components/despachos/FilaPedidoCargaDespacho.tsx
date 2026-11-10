"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronDown as IconoDesplegar,
  CalendarDays as IconoFecha,
} from "lucide-react";
import { mostrarFecha } from "@/components/compras/calculos";
import DetalleCargaDestino from "./DetalleCargaDestinoDespacho";
import type { CargaPreparada, PedidoCargaDespacho } from "./tipos";
import estilos from "./estilosFormulario.module.css";
export default function FilaPedidoCargaDespacho({
  pedido,
  rutaDetalle,
  seleccionadas,
  soloElegidas,
  bloqueado,
  ampliado,
  alAmpliar,
  alSeleccionar,
  alAlternar,
  alError,
}: {
  pedido: PedidoCargaDespacho;
  rutaDetalle: string;
  seleccionadas: CargaPreparada[];
  soloElegidas: boolean;
  bloqueado: boolean;
  ampliado: boolean;
  alAmpliar: () => void;
  alSeleccionar: () => void;
  alAlternar: (fila: CargaPreparada) => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("despachos");
  const idioma = useLocale();
  const elegidas = seleccionadas.filter(
    (fila) => fila.pedido === pedido.pedido,
  );
  const completa =
    elegidas.length === pedido.asignaciones && elegidas.length > 0;
  const parcial = elegidas.length > 0 && !completa;
  const cantidades = [
    ...(pedido.cajas ? [t("cajasCargaValor", { cantidad: pedido.cajas })] : []),
    ...(pedido.unidades
      ? [t("unidadesCargaValor", { cantidad: pedido.unidades })]
      : []),
    new Intl.NumberFormat(idioma, { maximumFractionDigits: 3 }).format(
      Number(pedido.peso_kg),
    ) + " kg",
  ];
  return (
    <section className="py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-gray-50 dark:hover:bg-gray-800/40">
          <input
            type="checkbox"
            aria-label={t("incluirPedidoCarga", {
              codigo: pedido.codigo_pedido,
            })}
            aria-checked={parcial ? "mixed" : completa}
            checked={completa}
            ref={(entrada) => {
              if (entrada) entrada.indeterminate = parcial;
            }}
            disabled={bloqueado}
            onChange={alSeleccionar}
            className="mt-0.5 size-5 shrink-0 accent-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400"
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
              {pedido.codigo_pedido}
            </span>
            <span className="mt-1 flex items-center gap-1.5 text-theme-xs text-gray-600 dark:text-gray-300">
              <IconoFecha className="size-3.5 shrink-0" aria-hidden="true" />
              {t("pedidoParaFecha", {
                fecha: mostrarFecha(pedido.fecha_requerida, idioma),
              })}
            </span>
            <span className="mt-1 block text-theme-xs text-gray-500 dark:text-gray-400">
              {t("productosPreparadosDestino", { cantidad: pedido.productos })}{" "}
              · {cantidades.join(" · ")}
            </span>
            {elegidas.length > 0 && (
              <span className="mt-1 block text-theme-xs font-medium text-brand-700 dark:text-brand-300">
                {t(
                  soloElegidas
                    ? "pedidoIncluidoViaje"
                    : completa
                      ? "cargaPedidoIncluida"
                      : "destinoCargaParcial",
                  { cantidad: elegidas.length, total: pedido.asignaciones },
                )}
              </span>
            )}
          </span>
        </label>
        <button
          type="button"
          aria-expanded={ampliado}
          aria-controls={"productos-pedido-" + pedido.pedido}
          onClick={alAmpliar}
          className="ms-auto inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-theme-xs font-medium text-gray-700 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-200"
        >
          {t(ampliado ? "ocultarProductosDestino" : "verProductosDestino")}
          <IconoDesplegar
            aria-hidden="true"
            className={
              "size-4 transition-transform duration-200 motion-reduce:transition-none " +
              (ampliado ? "rotate-180" : "")
            }
          />
        </button>
      </div>
      {ampliado && (
        <div
          id={"productos-pedido-" + pedido.pedido}
          className={estilos.entrada}
        >
          <DetalleCargaDestino
            ruta={rutaDetalle}
            filasElegidas={elegidas}
            soloElegidas={soloElegidas}
            seleccionadas={seleccionadas}
            bloqueado={bloqueado}
            alAlternar={alAlternar}
            alError={alError}
          />
        </div>
      )}
    </section>
  );
}
