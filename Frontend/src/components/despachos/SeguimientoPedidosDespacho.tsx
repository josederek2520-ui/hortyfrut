"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronDown as IconoDesplegar,
  CircleCheck as IconoConfirmado,
} from "lucide-react";
import useConsulta from "@/components/logistica/useConsultaLogistica";
import EstadoConsulta from "@/components/logistica/EstadoConsultaLogistica";
import type { PaginaLogistica } from "@/components/logistica/tipos";
import Paginador from "@/components/compras/PaginadorCompras";
import { mostrarFecha } from "@/components/compras/calculos";
import CargaDetalle from "./CargaDetalleDespacho";
import type { CargaPreparada, PedidoDescarga } from "./tipos";

interface Propiedades {
  despachoId: number;
  paradaId: number;
  alError: (error: unknown) => void;
}

function ProductosPedido({
  despachoId,
  paradaId,
  pedidoId,
  alError,
}: Propiedades & { pedidoId: number }) {
  const [pagina, establecerPagina] = useState(1);
  return (
    <PaginaProductos
      key={pagina}
      {...{
        despachoId,
        paradaId,
        pedidoId,
        alError,
        pagina,
        alPagina: establecerPagina,
      }}
    />
  );
}

function PaginaProductos({
  despachoId,
  paradaId,
  pedidoId,
  alError,
  pagina,
  alPagina,
}: Propiedades & {
  pedidoId: number;
  pagina: number;
  alPagina: (pagina: number) => void;
}) {
  const consulta = useConsulta<PaginaLogistica<CargaPreparada>>(
    `despachos/${despachoId}/productos-pedido/?parada=${paradaId}&pedido=${pedidoId}&pagina=${pagina}`,
    alError,
  );
  if (consulta.cargando || consulta.fallo || !consulta.datos)
    return (
      <EstadoConsulta
        cargando={consulta.cargando}
        fallo={consulta.fallo}
        alRecargar={consulta.recargar}
      />
    );
  return (
    <>
      <CargaDetalle cargas={consulta.datos.results} />
      {consulta.datos.count > 10 && (
        <Paginador
          pagina={pagina}
          total={consulta.datos.count}
          alCambiar={alPagina}
        />
      )}
    </>
  );
}

export function PedidoSeguimiento({
  pedido,
  despachoId,
  paradaId,
  alError,
}: Propiedades & { pedido: PedidoDescarga }) {
  const t = useTranslations("despachos");
  const idioma = useLocale();
  const [abierto, establecerAbierto] = useState(false);
  const cantidades = [
    ...(pedido.cajas ? [t("cajasCargaValor", { cantidad: pedido.cajas })] : []),
    ...(pedido.unidades
      ? [t("unidadesCargaValor", { cantidad: pedido.unidades })]
      : []),
    `${new Intl.NumberFormat(idioma, { maximumFractionDigits: 3 }).format(Number(pedido.peso_kg))} kg`,
  ].join(" · ");
  return (
    <article className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            {pedido.codigo_pedido}
          </h4>
          <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
            {t("fechaPedidoDescarga", {
              fecha: mostrarFecha(pedido.fecha_requerida, idioma),
            })}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-theme-xs font-medium ${pedido.descargada_en ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}
        >
          {pedido.descargada_en && (
            <IconoConfirmado aria-hidden="true" className="size-3.5" />
          )}
          {t(
            pedido.descargada_en
              ? "pedidoDescargado"
              : "pedidoPendienteDescarga",
          )}
        </span>
      </div>
      <p className="mt-3 text-sm text-gray-700 tabular-nums dark:text-gray-200">
        {cantidades}
      </p>
      {pedido.descargada_en && (
        <p className="mt-2 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
          {pedido.registro_anterior
            ? t("descargaHistoricaSucursal")
            : t("descargaConfirmadaPor", {
                nombre: pedido.responsable_descarga_nombre,
              })}
          {" · "}
          {new Intl.DateTimeFormat(idioma, {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "America/La_Paz",
          }).format(new Date(pedido.descargada_en))}
        </p>
      )}
      <details
        className="group/pedido mt-3 border-t border-gray-100 pt-1 dark:border-gray-800"
        onToggle={(evento) => establecerAbierto(evento.currentTarget.open)}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg text-theme-xs font-medium text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300">
          {t("productosPedidoDescarga", { cantidad: pedido.productos })}
          <IconoDesplegar
            aria-hidden="true"
            className="size-4 group-open/pedido:rotate-180 motion-safe:transition-transform motion-safe:duration-150"
          />
        </summary>
        {abierto && (
          <ProductosPedido
            {...{ despachoId, paradaId, alError, pedidoId: pedido.pedido }}
          />
        )}
      </details>
    </article>
  );
}

function PaginaPedidos({
  despachoId,
  paradaId,
  alError,
  pagina,
  alPagina,
}: Propiedades & { pagina: number; alPagina: (pagina: number) => void }) {
  const consulta = useConsulta<PaginaLogistica<PedidoDescarga>>(
    `despachos/${despachoId}/pedidos/?parada=${paradaId}&pagina=${pagina}`,
    alError,
  );
  if (consulta.cargando || consulta.fallo || !consulta.datos)
    return (
      <EstadoConsulta
        cargando={consulta.cargando}
        fallo={consulta.fallo}
        alRecargar={consulta.recargar}
      />
    );
  return (
    <div className="space-y-3">
      {consulta.datos.results.map((pedido) => (
        <PedidoSeguimiento
          key={pedido.pedido}
          {...{ pedido, despachoId, paradaId, alError }}
        />
      ))}
      {consulta.datos.count > 10 && (
        <Paginador
          pagina={pagina}
          total={consulta.datos.count}
          alCambiar={alPagina}
        />
      )}
    </div>
  );
}

export default function SeguimientoPedidosDespacho(propiedades: Propiedades) {
  const t = useTranslations("despachos");
  const [pagina, establecerPagina] = useState(1);
  return (
    <section aria-label={t("pedidosDeParada")} className="mt-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {t("pedidosDeParada")}
        </h3>
        <p className="mt-1 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
          {t("ayudaSeguimientoPedidos")}
        </p>
      </div>
      <PaginaPedidos
        key={pagina}
        {...propiedades}
        pagina={pagina}
        alPagina={establecerPagina}
      />
    </section>
  );
}
