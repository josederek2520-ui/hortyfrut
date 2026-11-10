"use client";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { useChofer } from "./ProveedorChofer";
import { useConsultaChofer } from "./useConsultaChofer";
import PaginacionChofer from "./PaginacionChofer";
import RevisionPedidoChofer from "./RevisionPedidoChofer";
import type {
  Parada,
  Pedido,
} from "@/lib/chofer/modulos/despachos/dominio/Viaje";
import type { RevisionPedido } from "@/lib/chofer/modulos/recorrido/aplicacion/RevisionPedido";

export default function PedidosParadaChofer({
  viaje,
  parada,
  version,
  puedeDescargar,
  ocupado,
  alConfirmar,
  alVolver,
}: {
  viaje: number;
  parada: Parada;
  version: string;
  puedeDescargar: boolean;
  ocupado: boolean;
  alConfirmar: (revision: RevisionPedido) => void;
  alVolver: () => void;
}) {
  const t = useTranslations("chofer"),
    { repositorio } = useChofer();
  const [pagina, establecerPagina] = useState(1),
    [pedido, establecerPedido] = useState<Pedido | null>(null);
  const consultar = useCallback(
    (senal: AbortSignal) =>
      repositorio.pedidos(viaje, parada.id, pagina, senal),
    [repositorio, viaje, parada.id, pagina],
  );
  const consulta = useConsultaChofer(
    `${viaje}:${parada.id}:${pagina}:${version}`,
    consultar,
  );
  if (pedido)
    return (
      <RevisionPedidoChofer
        key={`${pedido.id}:${version}`}
        viaje={viaje}
        parada={parada.id}
        pedido={pedido}
        version={version}
        puedeDescargar={puedeDescargar}
        ocupado={ocupado}
        alVolver={() => establecerPedido(null)}
        alConfirmar={alConfirmar}
      />
    );
  return (
    <section className="space-y-4">
      <Button variant="outline" size="sm" disabled={ocupado} onClick={alVolver}>
        {t("volverParadas")}
      </Button>
      <div>
        <h3 className="text-lg font-semibold">{parada.nombre}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {parada.cliente}
        </p>
        <p className="mt-1 text-sm">{parada.direccion}</p>
      </div>
      {consulta.error ? (
        <div role="alert">
          <p>{t("errorConsulta")}</p>
          <Button onClick={consulta.recargar}>{t("reintentar")}</Button>
        </div>
      ) : !consulta.datos ? (
        <p role="status">{t("cargando")}</p>
      ) : (
        <>
          <ul className="space-y-3">
            {consulta.datos.registros.map((fila) => (
              <li
                key={fila.id}
                className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700"
              >
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-semibold">{fila.codigo}</h4>
                  <span className="text-xs text-brand-700 dark:text-brand-300">
                    {t(fila.descargadaEn ? "descargado" : "pendiente")}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {[
                    fila.cajas ? t("cajas", { cantidad: fila.cajas }) : "",
                    fila.unidades
                      ? t("unidades", { cantidad: fila.unidades })
                      : "",
                    `${fila.pesoKg} kg`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  disabled={ocupado}
                  onClick={() => establecerPedido(fila)}
                >
                  {t(
                    puedeDescargar && !fila.descargadaEn
                      ? "revisarPedido"
                      : "verCarga",
                  )}
                </Button>
              </li>
            ))}
          </ul>
          <PaginacionChofer
            pagina={pagina}
            total={consulta.datos.total}
            alCambiar={establecerPagina}
            ocupado={ocupado}
          />
        </>
      )}
    </section>
  );
}
