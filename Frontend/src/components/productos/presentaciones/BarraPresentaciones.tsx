"use client";
import { useTranslations } from "next-intl";
import Input from "@/components/form/input/InputField";
import { SearchIcon as IconoBuscar } from "@/icons";

interface Propiedades {
  buscar: string;
  uso: string;
  estado: string;
  orden: string;
  alBuscar: (valor: string) => void;
  alUso: (valor: string) => void;
  alEstado: (valor: string) => void;
  alOrden: (valor: string) => void;
  alLimpiar: () => void;
}

export default function BarraPresentaciones({
  buscar,
  uso,
  estado,
  orden,
  alBuscar,
  alUso,
  alEstado,
  alOrden,
  alLimpiar,
}: Propiedades) {
  const t = useTranslations("presentaciones");
  const claseSelector =
    "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200";
  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label={t("filtrarUso")}
        className="inline-flex max-w-full overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-gray-800"
      >
        {["", "compra", "pedido", "ambos"].map((valor) => (
          <button
            key={valor}
            type="button"
            aria-pressed={uso === valor}
            onClick={() => alUso(valor)}
            className={`pestana-hortyfru inline-flex min-h-10 items-center rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none sm:px-4 ${uso === valor ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"}`}
          >
            {t(valor ? `filtrosUso.${valor}` : "todas")}
          </button>
        ))}
      </div>
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-2">
          <label
            htmlFor="buscar-presentaciones"
            className="mb-1.5 block text-theme-xs text-gray-500 dark:text-gray-400"
          >
            {t("buscarEtiqueta")}
          </label>
          <div className="relative">
            <IconoBuscar className="pointer-events-none absolute start-3.5 top-3.5 z-1 size-4 text-gray-400" />
            <Input
              id="buscar-presentaciones"
              type="search"
              value={buscar}
              maxLength={100}
              onChange={(evento) => alBuscar(evento.target.value)}
              placeholder={t("buscar")}
              className="ps-10"
            />
          </div>
        </div>
        <label className="space-y-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
          <span>{t("estado")}</span>
          <select
            value={estado}
            onChange={(evento) => alEstado(evento.target.value)}
            className={claseSelector}
          >
            <option value="">{t("todas")}</option>
            <option value="true">{t("activas")}</option>
            <option value="false">{t("inactivas")}</option>
          </select>
        </label>
        <label className="space-y-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
          <span>{t("ordenar")}</span>
          <select
            value={orden}
            onChange={(evento) => alOrden(evento.target.value)}
            className={claseSelector}
          >
            {["nombre", "-nombre", "-creado_en", "creado_en"].map((valor) => (
              <option key={valor} value={valor}>
                {t(`ordenes.${valor}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {(buscar || uso || estado || orden !== "nombre") && (
        <button
          type="button"
          onClick={alLimpiar}
          className="rounded-lg text-theme-xs font-medium text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
        >
          {t("limpiarFiltros")}
        </button>
      )}
    </div>
  );
}
