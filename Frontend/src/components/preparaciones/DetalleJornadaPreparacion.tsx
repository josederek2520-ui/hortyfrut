"use client";
import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import { useModal } from "@/hooks/useModal";
import Button from "@/components/ui/button/Button";
import { clasePanel, type PaginaCompra } from "@/components/compras/tipos";
import { mostrarFecha } from "@/components/compras/calculos";
import useConsultaPreparacion from "./useConsultaPreparacion";
import HistorialPreparaciones from "./HistorialPreparaciones";
import HojaConsolidada from "./HojaConsolidada";
import { claseEstadoJornada } from "./accionesJornadaPreparacion";
import type {
  JornadaAgrupadaPreparacion,
  PermisosPreparaciones,
} from "./tipos";

export default function DetalleJornadaPreparacion({
  cliente,
  fecha,
  permisos,
  alPreparar,
  alError,
}: {
  cliente: number;
  fecha: string;
  permisos: PermisosPreparaciones;
  alPreparar: (grupo: JornadaAgrupadaPreparacion) => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  const identificador = useId();
  const resumen = useModal();
  const { datos, cargando, fallo, recargar } = useConsultaPreparacion<
    PaginaCompra<JornadaAgrupadaPreparacion>
  >(
    `preparaciones/jornadas/?${new URLSearchParams({ cliente: String(cliente), fecha_pedidos: fecha })}`,
    alError,
  );
  const grupo = datos?.results[0];
  return (
    <div className="space-y-5">
      <section className={`${clasePanel} space-y-5 p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2
              id="titulo-grupo-preparacion"
              tabIndex={-1}
              className="text-xl font-semibold tracking-tight text-gray-900 outline-none dark:text-white"
            >
              {grupo?.cliente_nombre || t("grupoJornada")}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {mostrarFecha(fecha, idioma)} · {t("todasSucursalesGrupo")}
            </p>
          </div>
          {grupo && (
            <span
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${claseEstadoJornada(grupo.estado)}`}
            >
              {t(`situacionesJornada.${grupo.estado}`)}
            </span>
          )}
        </div>
        {fallo ? (
          <div role="alert" className="space-y-3">
            <p>{t("errorCarga")}</p>
            <Button size="sm" variant="outline" onClick={recargar}>
              {t("recargar")}
            </Button>
          </div>
        ) : cargando ? (
          <p role="status" className="text-sm text-gray-500 dark:text-gray-400">
            {t("cargando")}
          </p>
        ) : grupo ? (
          <>
            <dl className="grid grid-cols-3 gap-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/40">
              {[
                ["sucursalesJornada", grupo.sucursales],
                ["pedidosJornada", grupo.pedidos],
                ["productosJornada", grupo.productos],
              ].map(([clave, cantidad]) => (
                <div key={clave}>
                  <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {t(String(clave))}
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums dark:text-white">
                    {cantidad}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
                {t("estadoConfirmadoJornadaAyuda")}
              </p>
              <div className="flex flex-wrap gap-2">
                {grupo.pedidos > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={resumen.openModal}
                  >
                    {t("verResumenPedidos")}
                  </Button>
                )}
                {permisos.crear &&
                  grupo.cliente_activo &&
                  ["pendiente", "parcial"].includes(grupo.estado) && (
                    <Button size="sm" onClick={() => alPreparar(grupo)}>
                      {t(
                        grupo.borradores
                          ? "prepararOtraTanda"
                          : "prepararGrupo",
                      )}
                    </Button>
                  )}
              </div>
            </div>
          </>
        ) : (
          <p role="status" className="text-sm text-gray-500 dark:text-gray-400">
            {t("sinJornadas")}
          </p>
        )}
      </section>
      {grupo && (
        <section className="space-y-3" aria-labelledby="titulo-tandas-jornada">
          <div className="px-1">
            <h3
              id="titulo-tandas-jornada"
              className="font-semibold text-gray-900 dark:text-white"
            >
              {t("tandasJornada")}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("tandasJornadaAyuda")}
            </p>
          </div>
          <HistorialPreparaciones
            clienteFijo={cliente}
            fechaFija={fecha}
            permisos={permisos}
            alError={alError}
          />
        </section>
      )}
      {resumen.isOpen && grupo && (
        <Modal
          isOpen
          onClose={resumen.closeModal}
          className="max-w-7xl"
          labelledBy={identificador}
          closeLabel={t("cerrar")}
        >
          <div className="p-5 pe-16">
            <h2
              id={identificador}
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              {t("resumenPedidosJornada")} · {grupo.cliente_nombre}
            </h2>
          </div>
          <div className="custom-scrollbar max-h-[70dvh] overflow-y-auto px-5 pb-5">
            <HojaConsolidada
              soloConsulta
              puedeCrear={false}
              clienteInicial={cliente}
              fechaInicial={fecha}
              alError={alError}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
