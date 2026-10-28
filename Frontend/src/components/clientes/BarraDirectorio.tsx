"use client";
import { useTranslations } from "next-intl";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import { SearchIcon as IconoBuscar, PlusIcon as IconoAgregar } from "@/icons";
import type { TipoDirectorio, ResumenDirectorio } from "./tipos";

interface Propiedades {
  tipo: TipoDirectorio;
  resumen: ResumenDirectorio | null;
  estado: string;
  buscar: string;
  orden: string;
  crear: boolean;
  alEstado: (valor: string) => void;
  alBuscar: (valor: string) => void;
  alOrden: (valor: string) => void;
  alCrear: () => void;
}

export function CabeceraDirectorio({
  tipo,
  resumen,
  estado,
  crear,
  alEstado,
  alCrear,
}: Pick<
  Propiedades,
  "tipo" | "resumen" | "estado" | "crear" | "alEstado" | "alCrear"
>) {
  const t = useTranslations("clientes");
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div
        role="group"
        aria-label={t("filtrarEstado")}
        className="inline-flex max-w-full overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-gray-800"
      >
        {[
          { valor: "", clave: "todos", cantidad: resumen?.total },
          { valor: "true", clave: "activos", cantidad: resumen?.activos },
          { valor: "false", clave: "inactivos", cantidad: resumen?.inactivos },
        ].map((opcion) => (
          <button
            key={opcion.clave}
            type="button"
            aria-pressed={estado === opcion.valor}
            onClick={() => alEstado(opcion.valor)}
            className={`pestana-hortyfru inline-flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none sm:px-4 ${estado === opcion.valor ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"}`}
          >
            {t(`tipos.${tipo}.${opcion.clave}`)}
            <span
              className={`rounded-full px-1.5 py-0.5 text-theme-xs tabular-nums ${estado === opcion.valor ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300" : "bg-white text-gray-500 dark:bg-gray-900 dark:text-gray-400"}`}
            >
              {opcion.cantidad ?? "—"}
            </span>
          </button>
        ))}
      </div>
      {crear && (
        <Button
          size="sm"
          endIcon={<IconoAgregar className="size-4.5" />}
          onClick={alCrear}
        >
          {t(tipo === "clientes" ? "nuevoCliente" : "nuevaSucursal")}
        </Button>
      )}
    </div>
  );
}

export default function BarraDirectorio({
  tipo,
  buscar,
  orden,
  alBuscar,
  alOrden,
}: Pick<Propiedades, "tipo" | "buscar" | "orden" | "alBuscar" | "alOrden">) {
  const t = useTranslations("clientes");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-0 flex-1 sm:max-w-sm">
        <IconoBuscar className="pointer-events-none absolute start-3.5 top-3.5 z-1 size-4 text-gray-400 dark:text-gray-500" />
        <Input
          type="search"
          maxLength={150}
          value={buscar}
          onChange={(evento) => alBuscar(evento.target.value)}
          placeholder={t(`tipos.${tipo}.buscar`)}
          aria-label={t(`tipos.${tipo}.buscar`)}
          className="ps-10"
        />
      </div>
      <label className="flex items-center gap-2 text-theme-xs text-gray-500 sm:ms-auto dark:text-gray-400">
        {t("ordenar")}
        <select
          value={orden}
          onChange={(evento) => alOrden(evento.target.value)}
          className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          {["nombre", "-nombre", "-creado_en", "creado_en"].map((valor) => (
            <option key={valor} value={valor}>
              {t(`ordenes.${valor}`)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
