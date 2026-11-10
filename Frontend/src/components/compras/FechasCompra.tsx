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
import AvisoPedidosFechaCompra from "./AvisoPedidosFechaCompra";

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
      className={clasePanel + " grid gap-4 p-4 sm:grid-cols-2 sm:gap-6 sm:px-5"}
      aria-labelledby="titulo-fechas-compra"
    >
      <h2 id="titulo-fechas-compra" className="sr-only">
        {t("fechasTitulo")}
      </h2>
      {[
        {
          nombre: "fecha_pedidos",
          valor: fechaPedidos,
          etiqueta: "fechaPedidosEntrega",
          ayuda: "fechaPedidosBreve",
          Icono: IconoPedidos,
          cambiar: alPedidos,
        },
        {
          nombre: "fecha_compra",
          valor: fechaCompra,
          etiqueta: "fechaCompra",
          ayuda: "fechaCompraBreve",
          Icono: IconoCompra,
          cambiar: alCompra,
        },
      ].map(({ nombre, valor, etiqueta, ayuda, Icono, cambiar }) => (
        <div key={nombre} className="min-w-0">
          <div className="space-y-2">
            <div>
              <div className="flex items-center gap-2">
                <Icono
                  className="size-4 shrink-0 text-brand-600 dark:text-brand-400"
                  aria-hidden="true"
                />
                <Label htmlFor={"compra-" + nombre} className="mb-0">
                  {t(etiqueta)} <span className="text-error-500">*</span>
                </Label>
              </div>
            </div>
            <div>
              <CampoFecha
                id={"compra-" + nombre}
                name={nombre}
                value={valor}
                max={nombre === "fecha_compra" ? fechaLocal() : undefined}
                required
                disabled={deshabilitado}
                error={!!errores[nombre]?.length}
                alCambiar={cambiar}
                alSalir={alSalir}
                aria-describedby={
                  "compra-" +
                  nombre +
                  "-ayuda" +
                  (nombre === "fecha_pedidos" && fechaPedidos
                    ? " compra-pedidos-disponibilidad"
                    : "")
                }
              />
              <p
                id={"compra-" + nombre + "-ayuda"}
                className={
                  "mt-1.5 text-theme-xs " +
                  (errores[nombre]?.length
                    ? "text-error-500 dark:text-error-400"
                    : "text-gray-500 dark:text-gray-400")
                }
              >
                {errores[nombre]?.join(" ") || t(ayuda)}
              </p>
              {nombre === "fecha_pedidos" && (
                <AvisoPedidosFechaCompra
                  key={fechaPedidos}
                  fecha={fechaPedidos}
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
