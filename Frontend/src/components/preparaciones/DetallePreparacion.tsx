"use client";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import { clasePanel, claseEstado } from "@/components/compras/tipos";
import { claseEnlaceInventario } from "@/components/inventario/tipos";
import { mostrarFecha } from "@/components/compras/calculos";
import type { Session as Sesion } from "@/components/users/types";
import RevisionPreparacion from "./RevisionPreparacion";
import { desdePreparacion } from "./calculos";
import type { Preparacion } from "./tipos";

export default function DetallePreparacion({
  preparacion,
  sesion,
  alAccion,
}: {
  preparacion: Preparacion;
  sesion: Sesion;
  alAccion: (accion: "confirmar" | "cancelar") => void;
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  const permisos = sesion.permisos_preparaciones;
  return (
    <div className="space-y-6">
      <section className={`${clasePanel} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {preparacion.codigo}
              </h1>
              <span
                className={claseEstado(
                  preparacion.estado === "confirmada"
                    ? "registrada"
                    : preparacion.estado,
                )}
              >
                {t(`estados.${preparacion.estado}`)}
              </span>
            </div>
            <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
              {t("creadaEl", {
                fecha: new Intl.DateTimeFormat(idioma, {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "America/La_Paz",
                }).format(new Date(preparacion.creado_en)),
              })}{" "}
              · {preparacion.responsable_nombre}
            </p>
          </div>
          {preparacion.estado === "borrador" && (
            <div className="flex flex-wrap gap-3">
              {permisos.cancelar && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => alAccion("cancelar")}
                >
                  {t("cancelarBorrador")}
                </Button>
              )}
              {permisos.editar && (
                <Link
                  href={`/preparaciones/${preparacion.id}/editar`}
                  className={claseEnlaceInventario}
                >
                  {t("editarPreparacion")}
                </Link>
              )}
              {permisos.confirmar && (
                <Button
                  size="sm"
                  disabled={!preparacion.lineas.length}
                  onClick={() => alAccion("confirmar")}
                >
                  {t("confirmarPreparacion")}
                </Button>
              )}
            </div>
          )}
        </div>
        <dl className="mt-6 grid gap-5 sm:grid-cols-3">
          {[
            ["cliente", preparacion.cliente_nombre],
            ["fechaPedidos", mostrarFecha(preparacion.fecha_pedidos, idioma)],
            ["almacen", preparacion.almacen_nombre],
          ].map(([clave, valor]) => (
            <div key={clave}>
              <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                {t(clave)}
              </dt>
              <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                {valor}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 rounded-xl bg-brand-50 p-4 text-sm leading-6 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
          {t(
            preparacion.estado === "confirmada"
              ? "confirmadaAyuda"
              : preparacion.estado === "cancelada"
                ? "canceladaAyuda"
                : "borradorAyuda",
          )}
        </p>
        {preparacion.observaciones && (
          <p className="mt-4 text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">
            {preparacion.observaciones}
          </p>
        )}
        {preparacion.motivo_cancelacion && (
          <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
            {t("motivoCancelacion")}: {preparacion.motivo_cancelacion}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          {sesion.permisos_inventario?.ver_movimientos && (
            <>
              {preparacion.movimiento_salida && (
                <Link
                  href={`/movimientos-inventario/${preparacion.movimiento_salida}`}
                  className={claseEnlaceInventario}
                >
                  {preparacion.salida_codigo}
                </Link>
              )}
              {preparacion.movimiento_aprovechable && (
                <Link
                  href={`/movimientos-inventario/${preparacion.movimiento_aprovechable}`}
                  className={claseEnlaceInventario}
                >
                  {preparacion.aprovechable_codigo}
                </Link>
              )}
            </>
          )}
          {sesion.permisos_inventario?.ver_lotes &&
            preparacion.lineas
              .filter((linea) => linea.lote_aprovechable)
              .slice(0, 10)
              .map((linea) => (
                <Link
                  key={linea.lote}
                  href={`/lotes/${linea.lote_aprovechable}`}
                  className={claseEnlaceInventario}
                >
                  {linea.lote_aprovechable_codigo}
                </Link>
              ))}
        </div>
      </section>
      <section className={`${clasePanel} p-5 sm:p-6`}>
        <RevisionPreparacion documento={desdePreparacion(preparacion)} />
      </section>
    </div>
  );
}
