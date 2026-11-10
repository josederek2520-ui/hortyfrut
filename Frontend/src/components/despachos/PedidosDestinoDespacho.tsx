"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import Paginador from "@/components/compras/PaginadorCompras";
import EstadoConsulta from "@/components/logistica/EstadoConsultaLogistica";
import useConsulta from "./useConsultaListadoDespachos";
import FilaPedido from "./FilaPedidoCargaDespacho";
import { agruparCargaPedidos } from "./seleccionDestinosDespacho";
import type { PaginaLogistica } from "@/components/logistica/tipos";
import type { CargaPreparada, PedidoCargaDespacho } from "./tipos";

export default function PedidosDestinoDespacho({
  ruta,
  filasElegidas,
  soloElegidas,
  seleccionadas,
  bloqueado,
  alSeleccionarPedido,
  alAlternar,
  alError,
}: {
  ruta: string;
  filasElegidas: CargaPreparada[];
  soloElegidas: boolean;
  seleccionadas: CargaPreparada[];
  bloqueado: boolean;
  alSeleccionarPedido: (pedido: PedidoCargaDespacho) => void;
  alAlternar: (fila: CargaPreparada) => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("despachos");
  const [pagina, establecerPagina] = useState(1);
  const [ampliado, establecerAmpliado] = useState<number | null>(null);
  const parametros = new URLSearchParams(ruta.split("?")[1]);
  parametros.set("pagina", String(pagina));
  const consulta = useConsulta<PaginaLogistica<PedidoCargaDespacho>>(
    soloElegidas ? null : "despachos/pedidos-disponibles/?" + parametros,
    alError,
  );
  const pedidosElegidos = agruparCargaPedidos(filasElegidas);
  const total = soloElegidas
    ? pedidosElegidos.length
    : consulta.datos?.count || 0;
  const paginaActual = soloElegidas
    ? Math.min(pagina, Math.max(1, Math.ceil(total / 10)))
    : pagina;
  const filas = soloElegidas
    ? pedidosElegidos.slice((paginaActual - 1) * 10, paginaActual * 10)
    : consulta.datos?.results || [];
  if (!soloElegidas && (consulta.cargando || consulta.fallo))
    return (
      <div className="mt-3">
        <EstadoConsulta
          cargando={consulta.cargando}
          fallo={consulta.fallo}
          alRecargar={() => {
            establecerPagina(1);
            consulta.recargar();
          }}
        />
      </div>
    );
  return (
    <div className="mt-3 border-t border-gray-100 pt-1 dark:border-gray-800">
      {!filas.length && (
        <p className="py-3 text-sm text-gray-500 dark:text-gray-400">
          {t("sinPedidosDestino")}
        </p>
      )}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {filas.map((pedido) => {
          const parametrosPedido = new URLSearchParams(ruta.split("?")[1]);
          parametrosPedido.set("pedido", String(pedido.pedido));
          return (
            <FilaPedido
              key={pedido.pedido}
              pedido={pedido}
              rutaDetalle={"despachos/disponibles/?" + parametrosPedido}
              seleccionadas={seleccionadas}
              soloElegidas={soloElegidas}
              bloqueado={bloqueado}
              ampliado={ampliado === pedido.pedido}
              alAmpliar={() =>
                establecerAmpliado(
                  ampliado === pedido.pedido ? null : pedido.pedido,
                )
              }
              alSeleccionar={() => alSeleccionarPedido(pedido)}
              alAlternar={alAlternar}
              alError={alError}
            />
          );
        })}
      </div>
      {total > 10 && (
        <Paginador
          pagina={paginaActual}
          total={total}
          ocupado={bloqueado || consulta.cargando}
          alCambiar={(valor) => {
            establecerAmpliado(null);
            establecerPagina(valor);
          }}
        />
      )}
    </div>
  );
}
