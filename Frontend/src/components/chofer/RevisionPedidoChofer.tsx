"use client";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import PaginacionChofer from "./PaginacionChofer";
import { useChofer } from "./ProveedorChofer";
import { useConsultaChofer } from "./useConsultaChofer";
import { RevisionPedido } from "@/lib/chofer/modulos/recorrido/aplicacion/RevisionPedido";
import type { Pedido } from "@/lib/chofer/modulos/despachos/dominio/Viaje";
import ProductoDescargaChofer from "./ProductoDescargaChofer";

export default function RevisionPedidoChofer({
  viaje,
  parada,
  pedido,
  version,
  puedeDescargar,
  ocupado,
  alVolver,
  alConfirmar,
}: {
  viaje: number;
  parada: number;
  pedido: Pedido;
  version: string;
  puedeDescargar: boolean;
  ocupado: boolean;
  alVolver: () => void;
  alConfirmar: (revision: RevisionPedido) => void;
}) {
  const t = useTranslations("chofer"),
    { repositorio } = useChofer();
  const [revision] = useState(() => new RevisionPedido(pedido.id, version));
  const [pagina, establecerPagina] = useState(1),
    [, actualizar] = useState(0);
  const consultar = useCallback(
    async (senal: AbortSignal) => {
      const datos = await repositorio.productos(
        viaje,
        parada,
        pedido.id,
        pagina,
        senal,
      );
      if (!senal.aborted) revision.incorporar(datos.registros, datos.total);
      return datos;
    },
    [repositorio, viaje, parada, pedido.id, pagina, revision],
  );
  const consulta = useConsultaChofer(
    `${pedido.id}:${pagina}:${version}`,
    consultar,
  );
  return (
    <section className="space-y-4">
      <Button size="sm" variant="outline" onClick={alVolver} disabled={ocupado}>
        {t("volverPedidos")}
      </Button>
      <div>
        <h3 className="text-lg font-semibold">{pedido.codigo}</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t(pedido.descargadaEn ? "cargaEntregada" : "revisarCarga")}
        </p>
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
            {consulta.datos.registros.map((producto) => (
              <ProductoDescargaChofer
                key={producto.id}
                producto={producto}
                verificable={puedeDescargar && !pedido.descargadaEn}
                comprobada={revision.estaComprobada(producto.id)}
                ocupado={ocupado}
                alComprobar={() => {
                  revision.alternar(producto.id);
                  actualizar((valor) => valor + 1);
                }}
              />
            ))}
          </ul>
          <PaginacionChofer
            pagina={pagina}
            total={consulta.datos.total}
            ocupado={ocupado}
            alCambiar={establecerPagina}
          />
          {puedeDescargar && !pedido.descargadaEn && (
            <div className="sticky bottom-0 border-t border-gray-200 bg-white py-4 dark:border-gray-700 dark:bg-gray-900">
              <p className="mb-3 text-sm" role="status">
                {t("comprobadas", {
                  cantidad: revision.cantidad,
                  total: consulta.datos.total,
                })}
              </p>
              <Button
                className="w-full"
                disabled={ocupado || !revision.completa}
                onClick={() => alConfirmar(revision)}
              >
                {t("confirmarDescarga")}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
