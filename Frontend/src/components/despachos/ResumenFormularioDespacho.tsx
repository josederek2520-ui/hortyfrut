"use client";
import { useLocale, useTranslations } from "next-intl";
import { Truck as IconoCarga } from "lucide-react";
import { clasePanel, type OpcionLogistica } from "@/components/logistica/tipos";
import { mostrarFecha } from "@/components/compras/calculos";
import { comprobarCapacidadDespacho } from "./capacidadDespacho";
import AvisoCapacidadDespacho from "./AvisoCapacidadDespacho";
import type { CargaPreparada, CajillaCarga, DetalleDespacho } from "./tipos";

export function ContextoResumenFormularioDespacho({
  almacen,
  vehiculo,
  chofer,
  fecha,
}: {
  almacen: OpcionLogistica | null;
  vehiculo: OpcionLogistica | null;
  chofer: OpcionLogistica | null;
  fecha: string;
}) {
  const t = useTranslations("despachos");
  const idioma = useLocale();
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-2 text-theme-xs">
      {[
        [t("almacen"), almacen?.nombre],
        [t("fecha_reparto"), fecha ? mostrarFecha(fecha, idioma) : null],
        [t("vehiculo"), vehiculo?.nombre],
        [t("chofer"), chofer?.nombre],
      ]
        .filter(([, valor]) => valor)
        .map(([etiqueta, valor]) => (
          <div key={etiqueta} className="flex flex-wrap gap-1.5">
            <dt className="text-gray-500 dark:text-gray-400">{etiqueta}:</dt>
            <dd className="font-medium text-gray-800 dark:text-gray-100">
              {valor}
            </dd>
          </div>
        ))}
    </dl>
  );
}

export function CapacidadFormularioDespacho({
  vehiculo,
  cargas,
}: {
  vehiculo: OpcionLogistica | null;
  cargas: CargaPreparada[];
}) {
  if (!vehiculo || !cargas.length) return null;
  return (
    <AvisoCapacidadDespacho
      resultado={comprobarCapacidadDespacho(vehiculo.capacidad_kg, cargas)}
    />
  );
}

export default function ResumenFormularioDespacho({
  almacen,
  vehiculo,
  chofer,
  fecha,
  paso,
  cargas,
  orden,
  cajillas,
  compacto = false,
}: {
  documento?: DetalleDespacho;
  almacen: OpcionLogistica | null;
  vehiculo: OpcionLogistica | null;
  chofer: OpcionLogistica | null;
  fecha: string;
  paso: number;
  cargas: CargaPreparada[];
  orden: number[];
  cajillas: CajillaCarga[];
  modificado: boolean;
  compacto?: boolean;
}) {
  const t = useTranslations("despachos");
  const idioma = useLocale();
  if (!cargas.length) return null;
  const numero = new Intl.NumberFormat(idioma, { maximumFractionDigits: 3 });
  const capacidad = comprobarCapacidadDespacho(vehiculo?.capacidad_kg, cargas);
  const cajas = cargas.reduce(
    (suma, fila) => suma + (fila.columna === "cajas" ? fila.cantidad : 0),
    0,
  );
  const unidades = cargas.reduce(
    (suma, fila) => suma + (fila.columna === "unidades" ? fila.cantidad : 0),
    0,
  );
  const recipientes = cajillas
    .filter((fila) => orden.includes(fila.sucursal))
    .reduce((suma, fila) => suma + fila.cantidad, 0);
  const cantidades = [
    t("cantidadDestinosListado", { cantidad: orden.length }),
    ...(cajas ? [t("cajasCargaValor", { cantidad: cajas })] : []),
    ...(unidades ? [t("unidadesCargaValor", { cantidad: unidades })] : []),
    ...(capacidad.peso_kg
      ? [numero.format(Number(capacidad.peso_kg)) + " kg"]
      : []),
    ...(paso > 0 && recipientes
      ? [t("cajillasCargaValor", { cantidad: recipientes })]
      : []),
  ];
  if (compacto)
    return (
      <aside
        aria-label={t("resumenViaje")}
        className="flex min-w-0 items-center gap-3"
      >
        <IconoCarga
          className="size-5 shrink-0 text-gray-500 dark:text-gray-400"
          aria-hidden="true"
        />
        <p className="text-sm font-semibold text-gray-900 tabular-nums dark:text-white">
          {cantidades.join(" · ")}
        </p>
      </aside>
    );
  return (
    <aside aria-label={t("resumenViaje")} className={clasePanel + " px-5 py-4"}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {t("cargaSeleccionadaResumenFormulario")}
        </h2>
        <p className="text-sm font-medium text-gray-800 tabular-nums dark:text-gray-100">
          {cantidades.join(" · ")}
        </p>
      </div>
      {paso === 2 && (
        <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
          <ContextoResumenFormularioDespacho
            almacen={almacen}
            vehiculo={vehiculo}
            chofer={chofer}
            fecha={fecha}
          />
        </div>
      )}
      {vehiculo && paso > 0 && (
        <div className="mt-3">
          <AvisoCapacidadDespacho resultado={capacidad} />
        </div>
      )}
    </aside>
  );
}
