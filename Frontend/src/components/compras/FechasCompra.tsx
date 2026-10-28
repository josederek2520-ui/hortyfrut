"use client";
import { useTranslations } from "next-intl";
import {
  CalendarDays as IconoPedidos,
  CalendarCheck as IconoCompra,
} from "lucide-react";
import CampoFecha from "@/components/form/CampoFecha";
import Label from "@/components/form/Label";
import { fechaLocal } from "@/components/pedidos/fechas";
import { clasePanel } from "./tipos";

export default function FechasCompra({
  fechaPedidos,
  fechaCompra,
  alPedidos,
  alCompra,
  alSalir,
  errores,
  deshabilitado,
}: {
  fechaPedidos: string;
  fechaCompra: string;
  alPedidos: (fecha: string, control: HTMLInputElement) => void;
  alCompra: (fecha: string, control: HTMLInputElement) => void;
  alSalir: (control: HTMLInputElement) => void;
  errores: Record<string, string[]>;
  deshabilitado: boolean;
}) {
  const t = useTranslations("compras");
  return (
    <section
      className={`${clasePanel} grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(12rem,1fr)_minmax(0,2fr)] xl:items-start`}
      aria-labelledby="titulo-fechas-compra"
    >
      <div>
        <h2
          id="titulo-fechas-compra"
          className="text-lg font-semibold text-gray-900 dark:text-white"
        >
          {t("fechasTitulo")}
        </h2>
        <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t("fechasAyuda")}
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {[
          {
            nombre: "fecha_pedidos",
            valor: fechaPedidos,
            etiqueta: "fechaPedidos",
            ayuda: "fechaPedidosAyuda",
            Icono: IconoPedidos,
            cambiar: alPedidos,
          },
          {
            nombre: "fecha_compra",
            valor: fechaCompra,
            etiqueta: "fechaCompra",
            ayuda: "fechaCompraAyuda",
            Icono: IconoCompra,
            cambiar: alCompra,
          },
        ].map(({ nombre, valor, etiqueta, ayuda, Icono, cambiar }) => (
          <div key={nombre} className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-brand-600 dark:text-brand-400">
              <Icono className="size-4.5" aria-hidden="true" />
              <Label htmlFor={`compra-${nombre}`} className="mb-0">
                {t(etiqueta)} <span className="text-error-500">*</span>
              </Label>
            </div>
            <CampoFecha
              id={`compra-${nombre}`}
              name={nombre}
              value={valor}
              max={nombre === "fecha_compra" ? fechaLocal() : undefined}
              required
              disabled={deshabilitado}
              error={!!errores[nombre]?.length}
              alCambiar={cambiar}
              alSalir={alSalir}
              aria-describedby={`compra-${nombre}-ayuda`}
            />
            <p
              id={`compra-${nombre}-ayuda`}
              className={`mt-2 text-theme-xs leading-5 ${errores[nombre]?.length ? "text-error-500 dark:text-error-400" : "text-gray-500 dark:text-gray-400"}`}
            >
              {errores[nombre]?.join(" ") || t(ayuda)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
