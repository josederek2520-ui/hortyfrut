import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import CampoFecha from "@/components/form/CampoFecha";
import { campoPrecio, type EstadoPrecio } from "./tipos";

interface PropiedadesFiltros {
  buscar: string;
  estado: string;
  fecha: string;
  supermercado: boolean;
  alBuscar: (valor: string) => void;
  alEstado: (valor: string) => void;
  alFecha: (valor: string) => void;
}

export default function FiltrosListadoPrecios({
  buscar,
  estado,
  fecha,
  supermercado,
  alBuscar,
  alEstado,
  alFecha,
}: PropiedadesFiltros) {
  const t = useTranslations("precios");
  return (
    <div className="grid items-end gap-4 border-b border-gray-200 bg-brand-25/60 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_14rem_14rem] dark:border-gray-800 dark:bg-brand-500/5">
      <label className="block text-sm font-medium md:col-span-2 xl:col-span-1">
        {t("buscarEtiqueta")}
        <span className="relative mt-1.5 block">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            autoComplete="off"
            maxLength={150}
            className={campoPrecio + " ps-10"}
            placeholder={t(
              supermercado ? "buscarMisPropuestas" : "buscarAcuerdo",
            )}
            value={buscar}
            onChange={(evento) => alBuscar(evento.target.value)}
          />
        </span>
      </label>
      <label className="block text-sm font-medium">
        {t("estado")}
        <select
          className={campoPrecio + " mt-1.5"}
          value={estado}
          onChange={(evento) => alEstado(evento.target.value)}
        >
          <option value="">{t("todosEstados")}</option>
          {(
            [
              "borrador",
              "propuesta",
              "aceptado",
              "rechazado",
              "cancelado",
            ] as EstadoPrecio[]
          ).map((valor) => (
            <option key={valor} value={valor}>
              {t("estados." + valor)}
            </option>
          ))}
        </select>
      </label>
      <div>
        <label
          className="mb-1.5 block text-sm font-medium"
          htmlFor="vigencia-precios"
        >
          {t("vigentePara")}
        </label>
        <CampoFecha id="vigencia-precios" value={fecha} alCambiar={alFecha} />
      </div>
    </div>
  );
}
