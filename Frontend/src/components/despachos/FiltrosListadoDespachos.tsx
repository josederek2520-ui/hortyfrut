"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  Search as IconoBuscar,
  X as IconoLimpiar,
  RefreshCw as IconoActualizar,
  ChevronDown as IconoDesplegar,
  Truck as IconoActivos,
  History as IconoHistorial,
} from "lucide-react";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import CampoFecha from "@/components/form/CampoFecha";
import { claseEntrada } from "@/components/logistica/tipos";
import {
  estadosPorVista,
  type FiltrosListadoDespachos as DatosFiltros,
  type ResumenListadoDespachos,
} from "./listadoDespachos";
import estilos from "./estilosListado.module.css";

export default function FiltrosListadoDespachos({
  filtros,
  resumen,
  cargando,
  hayFiltros,
  alCambiar,
  alLimpiar,
  alActualizar,
}: {
  filtros: DatosFiltros;
  resumen: ResumenListadoDespachos | null;
  cargando: boolean;
  hayFiltros: boolean;
  alCambiar: (cambios: Partial<Omit<DatosFiltros, "pagina">>) => void;
  alLimpiar: () => void;
  alActualizar: () => void;
}) {
  const t = useTranslations("despachos");
  const comun = useTranslations("logistica");
  const idioma = useLocale();
  const numero = new Intl.NumberFormat(idioma);
  return (
    <div className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label={t("vistasListado")}
          className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
        >
          {(["activos", "historial"] as const).map((vista) => {
            const cantidad = resumen
              ? vista === "activos"
                ? resumen.borrador + resumen.en_ruta
                : resumen.finalizado + resumen.cancelado
              : undefined;
            const Icono = vista === "activos" ? IconoActivos : IconoHistorial;
            return (
              <Button
                key={vista}
                size="sm"
                variant="outline"
                aria-pressed={filtros.vista === vista}
                aria-controls="resultados-despachos"
                className={estilos.pulsable}
                onClick={() => alCambiar({ vista })}
                startIcon={<Icono className="size-4" />}
              >
                {t(vista === "activos" ? "activosListado" : "historialListado")}
                <span className="rounded-md bg-gray-200/60 px-2 py-0.5 text-theme-xs tabular-nums dark:bg-gray-700/60">
                  {cantidad === undefined ? "—" : numero.format(cantidad)}
                </span>
              </Button>
            );
          })}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={cargando}
          onClick={alActualizar}
          className={`${estilos.pulsable} min-h-11`}
          startIcon={
            <IconoActualizar
              className={`size-4 ${cargando ? "animate-spin motion-reduce:animate-none" : ""}`}
            />
          }
        >
          {comun("recargar")}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 @4xl:grid-cols-[minmax(0,1fr)_12rem_14rem]">
        <div className="sm:col-span-2 @4xl:col-span-1">
          <Label htmlFor="buscar-listado-despachos">
            {t("buscarEtiquetaListado")}
          </Label>
          <div className="relative">
            <IconoBuscar
              className="pointer-events-none absolute inset-y-0 start-3.5 z-10 my-auto size-4 text-gray-400"
              aria-hidden="true"
            />
            <Input
              id="buscar-listado-despachos"
              type="search"
              maxLength={150}
              placeholder={t("buscar")}
              className="ps-10"
              value={filtros.buscar}
              onChange={(evento) => alCambiar({ buscar: evento.target.value })}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="estado-listado-despachos">{t("estadoListado")}</Label>
          <div className="relative">
            <select
              id="estado-listado-despachos"
              value={filtros.estado}
              onChange={(evento) => alCambiar({ estado: evento.target.value })}
              className={`${claseEntrada} appearance-none pe-9`}
            >
              <option value="">
                {t(
                  filtros.vista === "activos"
                    ? "todosActivosListado"
                    : "todoHistorialListado",
                )}
              </option>
              {estadosPorVista[filtros.vista].map((estado) => (
                <option key={estado} value={estado}>
                  {t(
                    estado === "borrador" ? "sinIniciar" : `estados.${estado}`,
                  )}
                </option>
              ))}
            </select>
            <IconoDesplegar
              className="pointer-events-none absolute inset-y-0 end-3 my-auto size-4 text-gray-400"
              aria-hidden="true"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="fecha-listado-despachos">{t("fecha_reparto")}</Label>
          <CampoFecha
            id="fecha-listado-despachos"
            value={filtros.fecha}
            placeholder={t("todasFechas")}
            alCambiar={(fecha) => alCambiar({ fecha })}
          />
        </div>
      </div>
      {hayFiltros && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={alLimpiar}
            className={`${estilos.pulsable} inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300`}
          >
            <IconoLimpiar className="size-4" aria-hidden="true" />
            {comun("limpiarFiltros")}
          </button>
        </div>
      )}
    </div>
  );
}
