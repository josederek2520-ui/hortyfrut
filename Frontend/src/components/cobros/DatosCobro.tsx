"use client";
import { useTranslations } from "next-intl";
import { Store } from "lucide-react";
import Button from "@/components/ui/button/Button";
import CampoFecha from "@/components/form/CampoFecha";
import { hoyBolivia } from "@/components/ventas/calculosVenta";
import { campoVenta, panelVenta } from "@/components/ventas/tipos";
import type { FormularioCobro, MedioNuevoCobro } from "./tipos";
import AdjuntoCobro from "./AdjuntoCobro";
import { requiereComprobante } from "./calculosCobro";

export default function DatosCobro({
  formulario,
  bloqueado,
  alCambiar,
  alCliente,
  supermercado = false,
  clienteFijo = false,
}: {
  formulario: FormularioCobro;
  bloqueado: boolean;
  alCambiar: (cambio: Partial<FormularioCobro>) => void;
  alCliente: () => void;
  supermercado?: boolean;
  clienteFijo?: boolean;
}) {
  const t = useTranslations("cobros");
  const medios = supermercado
    ? (["transferencia", "deposito"] as const)
    : (["efectivo", "transferencia", "deposito", "otro"] as const);
  return (
    <div className={panelVenta + " space-y-5 p-5"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm text-gray-500 dark:text-gray-400">
            {t("supermercado")}
          </h2>
          <p className="mt-1 font-semibold">
            {formulario.cliente?.nombre ?? t("sinCliente")}
          </p>
          {formulario.cliente && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              NIT {formulario.cliente.nit}
            </p>
          )}
        </div>
        {!clienteFijo && (
          <Button
            variant="outline"
            disabled={bloqueado}
            onClick={alCliente}
            startIcon={<Store className="size-4" />}
          >
            {t(formulario.cliente ? "cambiarCliente" : "elegirCliente")}
          </Button>
        )}
      </div>
      <div
        className={
          "grid gap-4 sm:grid-cols-2 " +
          (requiereComprobante(formulario.medio)
            ? "lg:grid-cols-4"
            : "lg:grid-cols-3")
        }
      >
        <div>
          <label
            htmlFor="fecha-cobro"
            className="mb-2 block text-sm font-medium"
          >
            {t(supermercado ? "fechaPago" : "fecha")}
          </label>
          <CampoFecha
            id="fecha-cobro"
            value={formulario.fecha_cobro}
            max={hoyBolivia()}
            disabled={bloqueado}
            alCambiar={(valor) => alCambiar({ fecha_cobro: valor })}
          />
        </div>
        <div>
          <label
            htmlFor="importe-cobro"
            className="mb-2 block text-sm font-medium"
          >
            {t(supermercado ? "importePagado" : "importeRecibido")}
          </label>
          <input
            id="importe-cobro"
            className={campoVenta}
            inputMode="decimal"
            type="text"
            autoComplete="off"
            maxLength={20}
            placeholder="0,00"
            disabled={bloqueado}
            value={formulario.importe}
            onChange={(evento) => alCambiar({ importe: evento.target.value })}
          />
        </div>
        <div>
          <label
            htmlFor="medio-cobro"
            className="mb-2 block text-sm font-medium"
          >
            {t("medio")}
          </label>
          <select
            id="medio-cobro"
            className={campoVenta}
            disabled={bloqueado}
            value={formulario.medio}
            onChange={(evento) =>
              alCambiar({ medio: evento.target.value as MedioNuevoCobro })
            }
          >
            {medios.map((medio) => (
              <option key={medio} value={medio}>
                {t("medios." + medio)}
              </option>
            ))}
          </select>
        </div>
        {requiereComprobante(formulario.medio) && (
          <AdjuntoCobro
            archivo={formulario.comprobante}
            bloqueado={bloqueado}
            alCambiar={(comprobante) => alCambiar({ comprobante })}
          />
        )}
      </div>
    </div>
  );
}
