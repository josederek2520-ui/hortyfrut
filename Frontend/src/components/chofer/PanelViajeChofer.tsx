"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import PrepararRutaChofer from "./PrepararRutaChofer";
import SeguimientoChofer from "./SeguimientoChofer";
import PedidosParadaChofer from "./PedidosParadaChofer";
import PaginacionChofer from "./PaginacionChofer";
import type { ViajeDetalle } from "@/lib/chofer/modulos/despachos/dominio/Viaje";
import type {
  RutaViaje,
  AccionRuta,
  DocumentoRuta,
} from "@/lib/chofer/modulos/recorrido/dominio/Ruta";
import type { RevisionPedido } from "@/lib/chofer/modulos/recorrido/aplicacion/RevisionPedido";
import { siguienteParada } from "@/lib/chofer/modulos/recorrido/aplicacion/accionesViaje";
import estilos from "./estilosChofer.module.css";

export default function PanelViajeChofer({
  viaje,
  ruta,
  orden,
  seccionInicial,
  alCerrar,
  alOrdenar,
  alOperarRuta,
  alDescargar,
  puedeOperar,
  bloqueado,
  ocupado,
  trabajoActivo,
  error,
  alCompararCaminos,
}: {
  viaje: ViajeDetalle;
  ruta: RutaViaje;
  orden: number[];
  seccionInicial: string;
  alCerrar: () => void;
  alOrdenar: (orden: number[]) => void;
  alOperarRuta: (
    accion: AccionRuta,
    documento: Omit<DocumentoRuta, "clave_operacion">,
  ) => void;
  alDescargar: (parada: number, revision: RevisionPedido) => void;
  puedeOperar: boolean;
  bloqueado: boolean;
  ocupado: boolean;
  trabajoActivo: boolean;
  error: string;
  alCompararCaminos?: () => void;
}) {
  const t = useTranslations("chofer");
  const [seccion, establecerSeccion] = useState(
    seccionInicial === "pedidos" ? "paradas" : seccionInicial,
  );
  const [pagina, establecerPagina] = useState(1),
    [paradaId, establecerParadaId] = useState<number | null>(() =>
      seccionInicial === "pedidos"
        ? (siguienteParada(viaje)?.id ?? null)
        : null,
    );
  const siguiente = siguienteParada(viaje);
  const parada = viaje.paradas.find((fila) => fila.id === paradaId);
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!ocupado) alCerrar();
      }}
      className="max-w-xl"
      labelledBy="titulo-panel-viaje"
      closeLabel={t("cerrar")}
    >
      <div className={estilos.contenidoPanel}>
        <h2
          id="titulo-panel-viaje"
          className="pe-10 text-xl font-semibold text-gray-900 dark:text-white"
        >
          {viaje.codigo}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {viaje.vehiculo} · {viaje.almacen}
        </p>
        {error && (
          <p
            role="alert"
            className="my-3 text-sm text-error-600 dark:text-error-400"
          >
            {error}
          </p>
        )}
        {!parada && (
          <div
            className="my-5 flex gap-2 overflow-x-auto pb-1"
            aria-label={t("secciones")}
          >
            {["ruta", "paradas", "ubicacion"].map((clave) => (
              <Button
                key={clave}
                size="sm"
                aria-pressed={seccion === clave}
                disabled={ocupado}
                onClick={() => establecerSeccion(clave)}
              >
                {t(clave)}
              </Button>
            ))}
          </div>
        )}
        <div className="mt-5 text-gray-900 dark:text-white">
          {parada ? (
            <PedidosParadaChofer
              key={parada.id}
              viaje={viaje.id}
              parada={parada}
              version={viaje.version}
              puedeDescargar={
                puedeOperar &&
                viaje.estado === "en_ruta" &&
                siguiente?.id === parada.id &&
                !!parada.llegadaEn &&
                !parada.descargadaEn
              }
              ocupado={bloqueado}
              alVolver={() => establecerParadaId(null)}
              alConfirmar={(revision) => alDescargar(parada.id, revision)}
            />
          ) : seccion === "ruta" ? (
            <PrepararRutaChofer
              alCompararCaminos={alCompararCaminos}
              ruta={ruta}
              orden={orden}
              alOrdenar={alOrdenar}
              alOperar={alOperarRuta}
              bloqueado={bloqueado}
              trabajoActivo={trabajoActivo}
              puedeOperar={puedeOperar}
            />
          ) : seccion === "ubicacion" ? (
            <SeguimientoChofer
              viaje={viaje.id}
              version={viaje.version}
              enRuta={viaje.estado === "en_ruta"}
              puedeOperar={puedeOperar}
              bloqueado={bloqueado}
            />
          ) : (
            <section>
              <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                {t("avance", {
                  completadas: viaje.resumen.completadas,
                  total: viaje.resumen.paradas,
                })}
              </p>
              <ol start={(pagina - 1) * 10 + 1} className="space-y-3">
                {[...viaje.paradas]
                  .sort((a, b) => a.orden - b.orden)
                  .slice((pagina - 1) * 10, pagina * 10)
                  .map((fila) => (
                    <li
                      key={fila.id}
                      className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700"
                    >
                      <h3 className="font-semibold">
                        {fila.orden}. {fila.nombre}
                      </h3>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {fila.cliente}
                      </p>
                      <p className="mt-2 text-sm">
                        {t("avancePedidos", {
                          completados: fila.pedidosDescargados,
                          total: fila.pedidos,
                        })}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                        disabled={ocupado}
                        onClick={() => establecerParadaId(fila.id)}
                      >
                        {t("verPedidos")}
                      </Button>
                    </li>
                  ))}
              </ol>
              <PaginacionChofer
                pagina={pagina}
                total={viaje.paradas.length}
                alCambiar={establecerPagina}
                ocupado={ocupado}
              />
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                {t("regresoAlmacen")} · {viaje.almacen}
              </p>
              {viaje.cajillas.length > 0 && (
                <details className="mt-5 rounded-2xl bg-gray-50 p-4 dark:bg-gray-800">
                  <summary className="cursor-pointer font-medium">
                    {t("cajillas")}
                  </summary>
                  <ul className="mt-3 space-y-1 text-sm">
                    {viaje.cajillas.map((fila, indice) => (
                      <li key={indice}>
                        {
                          viaje.paradas.find(
                            (destino) => destino.sucursal === fila.sucursal,
                          )?.nombre
                        }{" "}
                        · {fila.color}: {fila.cantidad}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          )}
        </div>
      </div>
    </Modal>
  );
}
