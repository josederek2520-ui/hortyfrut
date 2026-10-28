"use client";
import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import CampoFecha from "@/components/form/CampoFecha";
import DesplegableCompra from "@/components/compras/DesplegableCompra";
import { clasePanel, type OpcionCompra } from "@/components/compras/tipos";
import { mostrarFecha } from "@/components/compras/calculos";
import { fechaLocal } from "@/components/pedidos/fechas";
import type { OrigenRecepcion } from "./tipos";

export default function DatosRecepcion({
  vinculada,
  origen,
  almacen,
  fecha,
  observaciones,
  guardada,
  ocupado,
  errores,
  alOrigen,
  alAlmacen,
  alFecha,
  alObservaciones,
  alError,
}: {
  vinculada: boolean;
  origen: OrigenRecepcion | null;
  almacen: OpcionCompra | null;
  fecha: string;
  observaciones: string;
  guardada: boolean;
  ocupado: boolean;
  errores: Record<string, string[]>;
  alOrigen: (cambio: {
    vinculada: boolean;
    compra: OrigenRecepcion | null;
  }) => void;
  alAlmacen: (almacen: OpcionCompra | null) => void;
  alFecha: (fecha: string) => void;
  alObservaciones: (observaciones: string) => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("recepciones");
  const idioma = useLocale();
  const notas = (
    <div className="mt-3">
      <Label htmlFor="observaciones">
        {t(vinculada ? "notasOpcionales" : "motivoIngreso")}
      </Label>
      <textarea
        id="observaciones"
        name="observaciones"
        maxLength={1000}
        rows={2}
        value={observaciones}
        disabled={ocupado}
        onChange={(evento) => alObservaciones(evento.target.value)}
        aria-invalid={!!errores.observaciones?.length}
        aria-describedby="notas-recepcion-ayuda"
        className={`w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-800 focus-visible:ring-3 focus-visible:ring-brand-400 dark:bg-gray-900 dark:text-gray-100 ${errores.observaciones?.length ? "border-error-500 dark:border-error-400" : "border-gray-300 dark:border-gray-700"}`}
      />
      <p
        id="notas-recepcion-ayuda"
        className={`mt-1 text-theme-xs ${errores.observaciones?.length ? "text-error-600 dark:text-error-400" : "text-gray-500 dark:text-gray-400"}`}
      >
        {errores.observaciones?.join(" ") ||
          t(vinculada ? "notasAyuda" : "motivoIngresoAyuda")}
      </p>
    </div>
  );
  return (
    <section
      className={`${clasePanel} space-y-4 p-5 sm:p-6`}
      aria-labelledby="datos-recepcion"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="datos-recepcion"
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            {t("datosIngreso")}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("datosIngresoAyuda")}
          </p>
        </div>
        <div
          role="group"
          aria-label={t("origen")}
          className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
        >
          {[true, false].map((valor) => (
            <Button
              key={String(valor)}
              size="sm"
              variant="outline"
              aria-pressed={vinculada === valor}
              disabled={ocupado || guardada}
              onClick={() => {
                if (valor !== vinculada)
                  alOrigen({ vinculada: valor, compra: null });
              }}
            >
              {t(valor ? "desdeCompra" : "sinCompra")}
            </Button>
          ))}
        </div>
      </div>
      <div
        className={`grid items-start gap-4 sm:grid-cols-2 ${vinculada ? "lg:grid-cols-3" : ""}`}
      >
        {vinculada && (
          <DesplegableCompra<OrigenRecepcion>
            tipo="general"
            ruta="recepciones/compras/"
            etiqueta={t("compra")}
            nombre="compra"
            valor={origen}
            deshabilitado={ocupado || guardada}
            error={errores.compra?.join(" ")}
            alError={alError}
            descripcion={(compra) => mostrarFecha(compra.fecha_compra, idioma)}
            alElegir={(compra) => {
              if (compra && compra.id !== origen?.id)
                alOrigen({ vinculada: true, compra });
            }}
          />
        )}
        <DesplegableCompra
          tipo="general"
          ruta="recepciones/almacenes/"
          etiqueta={t("almacen")}
          nombre="almacen"
          valor={almacen}
          deshabilitado={ocupado}
          error={errores.almacen?.join(" ")}
          alError={alError}
          alElegir={alAlmacen}
        />
        <div>
          <Label htmlFor="fecha_recepcion">
            {t("fechaRecepcion")} <span className="text-error-500">*</span>
          </Label>
          <CampoFecha
            id="fecha_recepcion"
            name="fecha_recepcion"
            value={fecha}
            required
            min={vinculada ? origen?.fecha_compra : undefined}
            max={fechaLocal()}
            disabled={ocupado}
            error={!!errores.fecha_recepcion?.length}
            aria-describedby="fecha-recepcion-error"
            alCambiar={alFecha}
          />
          <p
            id="fecha-recepcion-error"
            className="mt-1 text-theme-xs text-error-600 dark:text-error-400"
          >
            {errores.fecha_recepcion?.join(" ")}
          </p>
        </div>
      </div>
      {vinculada ? (
        <details
          open={errores.observaciones?.length ? true : undefined}
          className="border-t border-gray-100 pt-3 dark:border-gray-800"
        >
          <summary className="w-fit cursor-pointer rounded text-theme-xs font-medium text-gray-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-300">
            {t("notasOpcionales")}
            {observaciones.trim() ? " •" : ""}
          </summary>
          {notas}
        </details>
      ) : (
        notas
      )}
    </section>
  );
}
