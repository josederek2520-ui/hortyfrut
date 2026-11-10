"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle as IconoAviso,
  CircleCheck as IconoCorrecto,
} from "lucide-react";
import { formatearCapacidadToneladas } from "@/components/vehiculos/capacidadVehiculo";
import {
  calcularOcupacionCapacidad,
  formatearMedicionCapacidad,
  type ComprobacionCapacidad,
} from "./capacidadDespacho";

export default function AvisoCapacidadDespacho({
  resultado,
}: {
  resultado: ComprobacionCapacidad;
}) {
  const t = useTranslations("despachos");
  const idioma = useLocale();
  if (resultado.estado === "sin_carga") return null;
  const ocupacion = calcularOcupacionCapacidad(resultado);
  const capacidad = formatearCapacidadToneladas(resultado.capacidad_kg, idioma);
  if (ocupacion && capacidad && resultado.peso_kg) {
    const porcentaje = formatearMedicionCapacidad(ocupacion.porcentaje, idioma);
    const porcentajeTexto = t(
      ocupacion.cota === "menor"
        ? "porcentajeMenorCapacidad"
        : ocupacion.cota === "mayor"
          ? "porcentajeMayorCapacidad"
          : "porcentajeUsoCapacidad",
      { porcentaje },
    );
    const peso = t("cargaKgCapacidad", {
      cantidad: formatearMedicionCapacidad(resultado.peso_kg, idioma),
    });
    const margen = t(
      ocupacion.excedida ? "excesoKgCapacidad" : "disponibleKgCapacidad",
      {
        cantidad: formatearMedicionCapacidad(
          ocupacion.excedida ? ocupacion.excesoKg : ocupacion.disponibleKg,
          idioma,
        ),
      },
    );
    const estado = ocupacion.cercaDelLimite
      ? t(
          ocupacion.disponibleKg === "0.000"
            ? "limiteAlcanzadoCapacidad"
            : "cercaLimiteCapacidad",
        )
      : t(`capacidadEstados.${resultado.estado}`);
    const colorTexto = ocupacion.excedida
      ? "text-error-700 dark:text-error-300"
      : ocupacion.cercaDelLimite
        ? "text-warning-800 dark:text-warning-300"
        : "text-brand-700 dark:text-brand-300";
    const colorBarra = ocupacion.excedida
      ? "bg-error-500"
      : ocupacion.cercaDelLimite
        ? "bg-warning-500"
        : "bg-brand-500";
    const Icono =
      ocupacion.excedida || ocupacion.cercaDelLimite
        ? IconoAviso
        : IconoCorrecto;
    return (
      <div
        role="status"
        aria-atomic="true"
        className="space-y-2.5 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {t("limiteCapacidad", { capacidad })}
          </p>
          <p className={`text-sm font-semibold tabular-nums ${colorTexto}`}>
            {porcentajeTexto}
          </p>
        </div>
        <div
          role="meter"
          aria-label={t("ocupacionPesoCapacidad")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={ocupacion.porcentajeBarra}
          aria-valuetext={[
            t(`capacidadEstados.${resultado.estado}`),
            porcentajeTexto,
            peso,
            margen,
          ].join(". ")}
          className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
        >
          <div
            aria-hidden="true"
            className={`h-full rounded-full transition-[inline-size] duration-200 motion-reduce:transition-none ${colorBarra}`}
            style={{ inlineSize: `${ocupacion.porcentajeBarra}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-theme-xs text-gray-600 tabular-nums dark:text-gray-300">
          <p>{peso}</p>
          <p
            className={
              ocupacion.excedida
                ? "font-semibold text-error-700 dark:text-error-300"
                : ""
            }
          >
            {margen}
          </p>
        </div>
        <p
          className={`flex items-center gap-1.5 text-theme-xs font-medium ${colorTexto}`}
        >
          <Icono className="size-3.5 shrink-0" aria-hidden="true" />
          {estado}
        </p>
        {ocupacion.excedida && (
          <p className="text-theme-xs text-error-700 dark:text-error-300">
            {t("capacidadAyuda.excedida")}
          </p>
        )}
      </div>
    );
  }
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl bg-warning-50 px-3 py-2 text-theme-xs leading-5 text-warning-800 dark:bg-warning-500/10 dark:text-warning-300"
    >
      <IconoAviso aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-semibold">
          {t(`capacidadEstados.${resultado.estado}`)}
        </p>
        <p>{t("ocupacionNoCalculableCapacidad")}</p>
        <p>{t(`capacidadAyuda.${resultado.estado}`)}</p>
        {capacidad && (
          <p className="tabular-nums">
            {t("limiteCapacidad", {
              capacidad,
            })}
          </p>
        )}
      </div>
    </div>
  );
}
