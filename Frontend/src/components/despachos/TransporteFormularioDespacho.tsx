"use client";
import { useTranslations } from "next-intl";
import Selector from "./SelectorTransporteDespacho";
import CampoFecha from "@/components/form/CampoFecha";
import { type OpcionLogistica } from "@/components/logistica/tipos";

export interface DatosTransporteDespacho {
  almacen: OpcionLogistica | null;
  vehiculo: OpcionLogistica | null;
  chofer: OpcionLogistica | null;
  fecha: string;
  observaciones: string;
}

export default function TransporteFormularioDespacho({
  datos,
  bloqueado,
  errores,
  alCambiar,
  alError,
  seccion = "todo",
}: {
  seccion?: "todo" | "origen" | "transporte";
  datos: DatosTransporteDespacho;
  bloqueado: boolean;
  errores: Record<string, string[]>;
  alCambiar: (cambios: Partial<DatosTransporteDespacho>) => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("despachos");
  const selector = (campo: "almacen" | "vehiculo" | "chofer") => (
    <div data-campo-transporte={campo}>
      <Selector<OpcionLogistica>
        nombre={campo}
        ruta={`despachos/${campo === "almacen" ? "almacenes" : campo === "vehiculo" ? "vehiculos" : "choferes"}/`}
        etiqueta={`${t(campo)} *`}
        opcionVacia={t(
          campo === "almacen"
            ? "elegirAlmacenFormulario"
            : campo === "vehiculo"
              ? "elegirVehiculoFormulario"
              : "elegirChoferFormulario",
        )}
        valor={datos[campo]}
        alElegir={(opcion) => {
          if (opcion) alCambiar({ [campo]: opcion });
        }}
        alError={alError}
        deshabilitado={bloqueado}
        error={errores[campo]?.join(" ")}
        descripcion={(opcion) => (
          <span className="flex flex-wrap items-center gap-2">
            {opcion.detalle && <span>{opcion.detalle}</span>}
            {campo !== "almacen" && opcion.ocupado !== undefined && (
              <span
                className={`inline-flex rounded-md px-2 py-0.5 text-theme-xs font-medium ${opcion.ocupado ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300" : "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"}`}
              >
                {t(
                  opcion.ocupado ? "enRutaFormulario" : "disponibleFormulario",
                )}
              </span>
            )}
          </span>
        )}
      />
    </div>
  );
  return (
    <fieldset
      disabled={bloqueado}
      className="grid gap-x-4 gap-y-3 sm:grid-cols-2"
    >
      {seccion !== "transporte" && (
        <>
          {selector("almacen")}
          <div data-campo-transporte="fecha_reparto">
            <label
              htmlFor="fecha-reparto"
              className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t("fecha_reparto")} *
            </label>
            <CampoFecha
              id="fecha-reparto"
              name="fecha_reparto"
              value={datos.fecha}
              required
              disabled={bloqueado}
              error={!!errores.fecha_reparto?.length}
              aria-describedby={
                errores.fecha_reparto?.length
                  ? "fecha-reparto-error"
                  : undefined
              }
              alCambiar={(valor) => alCambiar({ fecha: valor })}
            />
            {errores.fecha_reparto?.length ? (
              <p
                id="fecha-reparto-error"
                className="mt-2 text-theme-xs text-error-600 dark:text-error-400"
              >
                {errores.fecha_reparto.join(" ")}
              </p>
            ) : null}
          </div>
        </>
      )}
      {seccion !== "origen" && (
        <>
          {selector("vehiculo")}
          {selector("chofer")}
        </>
      )}
    </fieldset>
  );
}
