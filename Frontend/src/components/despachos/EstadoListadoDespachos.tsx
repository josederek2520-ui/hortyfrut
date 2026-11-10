"use client";
import { useTranslations } from "next-intl";
import {
  Route as IconoViaje,
  PackageCheck as IconoCarga,
  Search as IconoBuscar,
  History as IconoHistorial,
  RefreshCw as IconoRecargar,
  Plus as IconoAgregar,
  ArrowRight as IconoAbrir,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import {
  tipoVacioListadoDespachos,
  type VistaListadoDespachos,
  type ResumenListadoDespachos,
} from "./listadoDespachos";
import estilos from "./estilosListado.module.css";

export default function EstadoListadoDespachos({
  cargando,
  fallo,
  vista,
  hayFiltros,
  resumen,
  puedeCrear,
  puedeVerPreparaciones,
  alRecargar,
  alLimpiar,
  alOtraVista,
}: {
  cargando: boolean;
  fallo: boolean;
  vista: VistaListadoDespachos;
  hayFiltros: boolean;
  resumen: ResumenListadoDespachos | null;
  puedeCrear: boolean;
  puedeVerPreparaciones: boolean;
  alRecargar: () => void;
  alLimpiar: () => void;
  alOtraVista: () => void;
}) {
  const t = useTranslations("despachos");
  const comun = useTranslations("logistica");
  if (cargando)
    return (
      <div
        role="status"
        className="space-y-3 border-t border-gray-100 p-5 dark:border-gray-800"
      >
        <span className="sr-only">{comun("cargando")}</span>
        {[0, 1, 2].map((fila) => (
          <div
            key={fila}
            aria-hidden="true"
            className="flex min-h-24 animate-pulse items-center gap-4 rounded-xl border border-gray-100 p-4 motion-reduce:animate-none dark:border-gray-800"
          >
            <span className="size-11 rounded-xl bg-gray-100 dark:bg-gray-800" />
            <div className="flex-1 space-y-2">
              <span className="block h-3 w-28 rounded bg-gray-100 dark:bg-gray-800" />
              <span className="block h-2 w-20 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
            <span className="h-9 w-24 rounded-lg bg-gray-100 dark:bg-gray-800" />
          </div>
        ))}
      </div>
    );
  const tipo = tipoVacioListadoDespachos(vista, hayFiltros, resumen);
  const Icono = fallo
    ? IconoRecargar
    : tipo === "filtros"
      ? IconoBuscar
      : tipo === "sin_carga"
        ? IconoCarga
        : tipo === "historial"
          ? IconoHistorial
          : IconoViaje;
  return (
    <div
      role={fallo ? "alert" : "status"}
      className={`${estilos.entrada} flex min-h-52 flex-col items-center justify-center gap-3 border-t border-gray-100 px-5 py-7 text-center dark:border-gray-800`}
    >
      <span
        className={`flex size-12 items-center justify-center rounded-2xl ${fallo ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" : "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"}`}
      >
        <Icono className="size-6" aria-hidden="true" />
      </span>
      <h3
        className={`${estilos.titulo} mt-1 text-lg font-semibold text-gray-900 dark:text-white`}
      >
        {t(fallo ? "errorTituloListado" : `vaciosListado.${tipo}.titulo`)}
      </h3>
      <p className="max-w-md text-sm leading-6 text-gray-600 dark:text-gray-300">
        {fallo ? comun("errorCarga") : t(`vaciosListado.${tipo}.ayuda`)}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        {fallo ? (
          <Button size="sm" variant="outline" onClick={alRecargar}>
            {comun("recargar")}
          </Button>
        ) : tipo === "filtros" ? (
          <Button size="sm" variant="outline" onClick={alLimpiar}>
            {comun("limpiarFiltros")}
          </Button>
        ) : tipo === "sin_carga" && puedeVerPreparaciones ? (
          <Link
            href="/preparaciones"
            className="boton-principal-hortyfru inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium text-white focus-visible:ring-3 focus-visible:ring-brand-400"
          >
            {t("verPreparacionesListado")}
            <IconoAbrir className="size-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
        ) : (tipo === "primero" || tipo === "sin_carga") && puedeCrear ? (
          <Link
            href="/despachos/nuevo"
            className="boton-principal-hortyfru inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium text-white focus-visible:ring-3 focus-visible:ring-brand-400"
          >
            <IconoAgregar className="size-4" aria-hidden="true" />
            {t(tipo === "primero" ? "crearPrimeroListado" : "nuevo")}
          </Link>
        ) : null}
        {!fallo && (tipo === "historial" || tipo === "activos") && (
          <Button size="sm" variant="outline" onClick={alOtraVista}>
            {t(
              tipo === "historial"
                ? "verActivosListado"
                : "verHistorialListado",
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
