"use client";
import { useTranslations } from "next-intl";
import { Search as IconoBuscar, Plus as IconoAgregar } from "lucide-react";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import type { ResumenAlmacenes } from "./tipos";

export default function BarraAlmacenes({
  resumen,
  estado,
  buscar,
  orden,
  puedeCrear,
  alEstado,
  alBuscar,
  alOrden,
  alCrear,
}: {
  resumen: ResumenAlmacenes | null;
  estado: string;
  buscar: string;
  orden: string;
  puedeCrear: boolean;
  alEstado: (valor: string) => void;
  alBuscar: (valor: string) => void;
  alOrden: (valor: string) => void;
  alCrear: () => void;
}) {
  const t = useTranslations("almacenes");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div
          role="group"
          aria-label={t("filtrarEstado")}
          className="inline-flex max-w-full overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-gray-800"
        >
          {[
            { valor: "", clave: "todos", cantidad: resumen?.total },
            { valor: "true", clave: "activos", cantidad: resumen?.activos },
            {
              valor: "false",
              clave: "inactivos",
              cantidad: resumen?.inactivos,
            },
          ].map((opcion) => (
            <button
              key={opcion.clave}
              type="button"
              aria-pressed={estado === opcion.valor}
              onClick={() => alEstado(opcion.valor)}
              className={`pestana-hortyfru inline-flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none sm:px-4 ${estado === opcion.valor ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"}`}
            >
              {t(opcion.clave)}
              <span
                className={`rounded-full px-1.5 py-0.5 text-theme-xs tabular-nums ${estado === opcion.valor ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300" : "bg-white text-gray-500 dark:bg-gray-900 dark:text-gray-400"}`}
              >
                {opcion.cantidad ?? "—"}
              </span>
            </button>
          ))}
        </div>
        {puedeCrear && (
          <Button
            size="sm"
            startIcon={<IconoAgregar className="size-4.5" />}
            onClick={alCrear}
          >
            {t("nuevoAlmacen")}
          </Button>
        )}
      </div>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="buscar-almacenes"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t("buscar")}
          </label>
          <div className="relative">
            <IconoBuscar
              className="pointer-events-none absolute start-3.5 top-3 z-1 size-5 text-gray-400"
              aria-hidden="true"
            />
            <Input
              id="buscar-almacenes"
              type="search"
              value={buscar}
              maxLength={150}
              className="ps-11"
              placeholder={t("buscarAyuda")}
              onChange={(evento) => alBuscar(evento.target.value)}
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="orden-almacenes"
            className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t("ordenar")}
          </label>
          <select
            id="orden-almacenes"
            value={orden}
            onChange={(evento) => alOrden(evento.target.value)}
            className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            {["nombre", "-nombre", "-creado_en", "creado_en"].map((valor) => (
              <option key={valor} value={valor}>
                {t(`ordenes.${valor}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
