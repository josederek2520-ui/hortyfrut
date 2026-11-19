"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Banknote, FileCheck2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import ConfirmacionLogistica from "@/components/logistica/ConfirmacionLogistica";
import SelectorClienteVenta from "@/components/ventas/SelectorClienteVenta";
import { panelVenta, type ClienteVenta } from "@/components/ventas/tipos";
import useProteccionComercial from "@/components/comercial/useProteccionComercial";
import { mostrarBolivianos } from "@/lib/moneda";
import {
  centavosCobro,
  importeDesdeCentavos,
  sumarAplicaciones,
} from "./calculosCobro";
import useHojaCobro from "./useHojaCobro";
import DatosCobro from "./DatosCobro";
import SeleccionVentasCobro from "./SeleccionVentasCobro";
import RevisionCobro from "./RevisionCobro";

export default function HojaCobro({
  supermercado = false,
  clienteInicial,
}: {
  supermercado?: boolean;
  clienteInicial?: ClienteVenta | null;
}) {
  const t = useTranslations("cobros"),
    tp = useTranslations("pagos"),
    tc = useTranslations("comercialComun"),
    idioma = useLocale(),
    navegador = useRouter();
  const ruta = supermercado ? "mis-pagos" : "cobros";
  const gestion = useHojaCobro({ ruta, cliente: clienteInicial }),
    { formulario, operacion, bloqueado } = gestion;
  const proteccion = useProteccionComercial(
    gestion.modificado || operacion.incierto,
    operacion.ocupado || gestion.actualizando,
  );
  const [selector, establecerSelector] = useState(false),
    [clientePendiente, establecerClientePendiente] =
      useState<ClienteVenta | null>(null);
  const error = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (operacion.fallo || gestion.errores.length) error.current?.focus();
  }, [operacion.fallo, gestion.errores]);
  async function actuar(accion: "revisar" | "registrar" | "reintentar") {
    const cobro = await gestion.operar(accion);
    if (cobro) navegador.replace("/" + ruta + "/" + cobro.id);
  }
  const distribuido = sumarAplicaciones(formulario),
    pendiente = (centavosCobro(formulario.importe) ?? BigInt(0)) - distribuido;
  if (!operacion.autorizado) return <p role="alert">{tc("sinAcceso")}</p>;
  return (
    <section className="space-y-5 text-gray-900 dark:text-white">
      <header className="flex items-center gap-3">
        <button
          type="button"
          className="control-suave-hortyfru inline-flex size-11 items-center justify-center rounded-xl"
          aria-label={tc("volver")}
          disabled={operacion.ocupado}
          onClick={() => proteccion.salir("/" + ruta)}
        >
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold">
            {supermercado ? tp("informarPago") : t("nuevoCobro")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {supermercado ? tp("ayudaInformar") : t("subtituloNuevo")}
          </p>
        </div>
      </header>
      {(operacion.fallo ||
        gestion.errores.length > 0 ||
        gestion.falloActualizacion) && (
        <div
          ref={error}
          tabIndex={-1}
          role="alert"
          className="space-y-2 rounded-xl bg-error-50 p-4 text-error-700 outline-none dark:bg-error-950 dark:text-error-200"
        >
          <p className="font-medium">
            {gestion.falloActualizacion
              ? t("errorActualizar")
              : tc(operacion.fallo || "revisarErrores")}
          </p>
          {gestion.errores.map((clave) => (
            <p key={clave} className="text-sm">
              {t("errores." + clave)}
            </p>
          ))}
          {operacion.errores.map((texto, i) => (
            <p key={i} className="text-sm">
              {texto}
            </p>
          ))}
          {operacion.incierto && (
            <Button
              variant="outline"
              disabled={operacion.ocupado}
              onClick={() => void actuar("reintentar")}
            >
              {tc("reintentar")}
            </Button>
          )}
        </div>
      )}
      <DatosCobro
        supermercado={supermercado}
        clienteFijo={supermercado && !!clienteInicial}
        formulario={formulario}
        bloqueado={bloqueado}
        alCambiar={gestion.cambiar}
        alCliente={() => establecerSelector(true)}
      />
      <SeleccionVentasCobro
        ruta={ruta}
        key={formulario.cliente?.id ?? "sin-cliente"}
        cliente={formulario.cliente?.id}
        seleccion={formulario.aplicaciones}
        bloqueado={bloqueado}
        alCambiar={(aplicaciones) => gestion.cambiar({ aplicaciones })}
        alActualizar={() => void gestion.actualizarSaldos()}
      />
      <footer
        className={
          panelVenta +
          " sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-4 p-4"
        }
      >
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("distribuido")}
            </p>
            <p className="mt-1 flex items-center gap-2 font-semibold tabular-nums">
              <Banknote
                className="size-4 text-brand-700 dark:text-brand-300"
                aria-hidden="true"
              />
              {mostrarBolivianos(importeDesdeCentavos(distribuido), idioma)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t(pendiente < BigInt(0) ? "excesoAsignado" : "porAplicar")}
            </p>
            <p
              aria-live="polite"
              className={
                "mt-1 font-semibold tabular-nums " +
                (pendiente !== BigInt(0)
                  ? "text-orange-700 dark:text-orange-300"
                  : "text-brand-700 dark:text-brand-300")
              }
            >
              {mostrarBolivianos(
                importeDesdeCentavos(
                  pendiente < BigInt(0) ? -pendiente : pendiente,
                ),
                idioma,
              )}
            </p>
          </div>
        </div>
        <Button
          disabled={bloqueado}
          startIcon={<FileCheck2 className="size-4" />}
          onClick={() => void actuar("revisar")}
        >
          {operacion.ocupado
            ? tc("procesando")
            : supermercado
              ? tp("revisarPago")
              : tc("revisar")}
        </Button>
      </footer>
      {selector && (
        <SelectorClienteVenta
          ruta={ruta + "/clientes/"}
          alCerrar={() => establecerSelector(false)}
          alElegir={(cliente) => {
            establecerSelector(false);
            if (cliente.id === formulario.cliente?.id) return;
            if (formulario.aplicaciones.length)
              establecerClientePendiente(cliente);
            else gestion.cambiar({ cliente, aplicaciones: [] });
          }}
        />
      )}
      {clientePendiente && (
        <ConfirmacionLogistica
          titulo={t("cambiarCliente")}
          descripcion={t("cambiarClienteAyuda")}
          accion={tc("continuar")}
          alCerrar={() => establecerClientePendiente(null)}
          alConfirmar={() => {
            gestion.cambiar({ cliente: clientePendiente, aplicaciones: [] });
            establecerClientePendiente(null);
          }}
        />
      )}
      {gestion.revision && !operacion.incierto && (
        <RevisionCobro
          supermercado={supermercado}
          revision={gestion.revision}
          ocupado={operacion.ocupado}
          alCerrar={gestion.cerrarRevision}
          alConfirmar={() => void actuar("registrar")}
        />
      )}
      {proteccion.destino && (
        <ConfirmacionLogistica
          titulo={tc("salirTitulo")}
          descripcion={tc("salirAyuda")}
          accion={tc("salir")}
          alCerrar={proteccion.cerrar}
          alConfirmar={proteccion.confirmar}
        />
      )}
    </section>
  );
}
