"use client";
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ClipboardList as IconoJornada,
  TableProperties as IconoResumen,
} from "lucide-react";
import CampoFecha from "@/components/form/CampoFecha";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import DesplegableCompra from "@/components/compras/DesplegableCompra";
import { clasePanel } from "@/components/compras/tipos";
import { fechaLocal } from "@/components/pedidos/fechas";
import { useModal } from "@/hooks/useModal";
import useConsultaPreparacion from "./useConsultaPreparacion";
import FormularioPreparacion from "./FormularioPreparacion";
import HojaConsolidada from "./HojaConsolidada";
import DialogoTrabajoPreparacion from "./DialogoTrabajoPreparacion";
import {
  primerProductoPendiente,
  decisionCambioJornada,
} from "./seleccionJornadaPreparacion";
import type {
  EstadoTrabajoPreparacion,
  HojaConsolidada as DatosHoja,
  OpcionPreparacion,
} from "./tipos";

export default function JornadaPreparacion({
  clienteInicial,
  fechaInicial,
  puedeCrear,
  puedeEditar,
  puedeConfirmar,
  alError,
  alEstadoTrabajo,
  alConfirmada,
  alVolverListado,
}: {
  clienteInicial?: number;
  fechaInicial?: string;
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedeConfirmar: boolean;
  alError: (error: unknown) => void;
  alEstadoTrabajo?: (estado: EstadoTrabajoPreparacion) => void;
  alConfirmada?: () => void;
  alVolverListado?: () => void;
}) {
  const t = useTranslations("preparaciones");
  const identificador = useId();
  const [fecha, establecerFecha] = useState(fechaInicial || fechaLocal);
  const [cliente, establecerCliente] = useState<OpcionPreparacion | null>(
    clienteInicial ? { id: clienteInicial, nombre: t("cliente") } : null,
  );
  const [revision, establecerRevision] = useState(0);
  const [revisionControles, establecerRevisionControles] = useState(0);
  const [estado, establecerEstado] = useState<EstadoTrabajoPreparacion>({
    modificado: false,
    guardando: false,
  });
  useEffect(() => {
    alEstadoTrabajo?.(estado);
  }, [alEstadoTrabajo, estado]);
  const [propuesta, establecerPropuesta] = useState<{
    fecha: string;
    cliente: OpcionPreparacion | null;
  } | null>(null);
  const modalCambio = useModal();
  const modalResumen = useModal();
  const parametros = new URLSearchParams({
    fecha_pedidos: fecha,
    cliente: String(cliente?.id || ""),
    vista: "pendiente",
  });
  const { datos, cargando, fallo, recargar } =
    useConsultaPreparacion<DatosHoja>(
      cliente && fecha ? `preparaciones/consolidado/?${parametros}` : null,
      alError,
    );
  const aplicar = (nueva: {
    fecha: string;
    cliente: OpcionPreparacion | null;
  }) => {
    establecerFecha(nueva.fecha);
    establecerCliente(nueva.cliente);
    establecerRevision((valor) => valor + 1);
    establecerEstado({ modificado: false, guardando: false });
    modalCambio.closeModal();
  };
  const proponer = (nueva: {
    fecha: string;
    cliente: OpcionPreparacion | null;
  }) => {
    const decision = decisionCambioJornada(
      estado,
      { fecha, cliente: cliente?.id || null },
      { fecha: nueva.fecha, cliente: nueva.cliente?.id || null },
    );
    if (decision === "ignorar") return;
    if (decision === "confirmar") {
      establecerRevisionControles((valor) => valor + 1);
      establecerPropuesta(nueva);
      modalCambio.openModal();
    } else aplicar(nueva);
  };
  const controles = (
    <>
      <div>
        <Label htmlFor={`fecha-jornada-${identificador}`}>
          {t("fechaPedidosCompacta")}
        </Label>
        <CampoFecha
          key={revisionControles}
          id={`fecha-jornada-${identificador}`}
          value={fecha}
          required
          disabled={estado.guardando}
          alCambiar={(valor) => proponer({ fecha: valor, cliente: null })}
        />
      </div>
      <DesplegableCompra<OpcionPreparacion>
        key={fecha}
        tipo="general"
        ruta={`preparaciones/clientes/?fecha_pedidos=${fecha}`}
        etiqueta={t("cliente")}
        valor={datos?.cliente || cliente}
        deshabilitado={!fecha || estado.guardando}
        alError={alError}
        alElegir={(elegido) => proponer({ fecha, cliente: elegido })}
      />
    </>
  );
  const resumen = datos && (
    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1">
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        {t("resumenJornadaCompacto", {
          pedidos: datos.resumen.pedidos,
          sucursales: datos.sucursales.count,
          productos: datos.resumen.productos,
        })}
      </p>
      <button
        type="button"
        onClick={modalResumen.openModal}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-theme-xs font-medium text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
      >
        <IconoResumen className="size-4" aria-hidden="true" />
        {t("verResumenPedidos")}
      </button>
    </div>
  );
  const capturar =
    datos &&
    puedeCrear &&
    datos.cliente.activo &&
    datos.resumen.lineas_pendientes > 0;
  return (
    <div className="space-y-4">
      {capturar ? (
        <FormularioPreparacion
          key={`${cliente!.id}-${fecha}-${revision}`}
          integrado
          cliente={datos.cliente}
          fecha={fecha}
          controlesJornada={controles}
          resumenJornada={resumen}
          productoInicial={primerProductoPendiente(datos)}
          puedeEditar={puedeEditar}
          puedeConfirmar={puedeConfirmar}
          alError={alError}
          alEstadoTrabajo={establecerEstado}
          alConfirmada={alConfirmada}
          alVolverListado={alVolverListado}
          alRecargar={() => {
            establecerRevision((valor) => valor + 1);
            recargar();
          }}
        />
      ) : (
        <>
          <section
            className={`${clasePanel} space-y-2 px-5 py-4`}
            aria-label={t("elegirJornada")}
          >
            <div className="grid gap-4 sm:grid-cols-2">{controles}</div>
            {resumen}
          </section>
          {!cliente ? (
            <div
              className={`${clasePanel} flex min-h-56 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-gray-500 dark:text-gray-400`}
            >
              <IconoJornada
                className="size-9 text-brand-500"
                aria-hidden="true"
              />
              <p>{t("seleccionarClienteFecha")}</p>
            </div>
          ) : fallo ? (
            <div
              role="alert"
              className={`${clasePanel} space-y-3 p-6 text-center`}
            >
              <p className="text-sm text-error-600 dark:text-error-400">
                {t("errorHoja")}
              </p>
              <Button size="sm" variant="outline" onClick={recargar}>
                {t("recargar")}
              </Button>
            </div>
          ) : cargando ? (
            <p
              role="status"
              className={`${clasePanel} p-8 text-center text-sm text-gray-500 dark:text-gray-400`}
            >
              {t("cargando")}
            </p>
          ) : (
            datos && (
              <>
                <p
                  role="status"
                  className="px-1 text-sm text-gray-500 dark:text-gray-400"
                >
                  {t(
                    !datos.cliente.activo
                      ? "clienteInactivoTrabajo"
                      : datos.resumen.lineas_pendientes
                        ? "consultaSinCreacionTrabajo"
                        : "sinPendientesJornada",
                  )}
                </p>
                <HojaConsolidada
                  key={`${cliente.id}-${fecha}`}
                  soloConsulta
                  puedeCrear={false}
                  clienteInicial={cliente.id}
                  fechaInicial={fecha}
                  alError={alError}
                />
              </>
            )
          )}
        </>
      )}
      {modalCambio.isOpen && propuesta && (
        <DialogoTrabajoPreparacion
          tipo="jornada"
          ocupado={estado.guardando}
          alCerrar={() => {
            modalCambio.closeModal();
            if (propuesta.fecha !== fecha)
              requestAnimationFrame(() =>
                document
                  .getElementById(`fecha-jornada-${identificador}`)
                  ?.focus(),
              );
          }}
          alConfirmar={() => aplicar(propuesta)}
        />
      )}
      {modalResumen.isOpen && cliente && (
        <Modal
          isOpen
          onClose={modalResumen.closeModal}
          className="max-w-7xl"
          labelledBy={`resumen-jornada-${identificador}`}
          closeLabel={t("cerrar")}
        >
          <div className="p-5 pe-16">
            <h2
              id={`resumen-jornada-${identificador}`}
              className="text-lg font-semibold text-gray-900 dark:text-white"
            >
              {t("resumenPedidosJornada")}
            </h2>
          </div>
          <div className="custom-scrollbar max-h-[70dvh] overflow-y-auto px-5 pb-5">
            <HojaConsolidada
              key={`${cliente.id}-${fecha}`}
              soloConsulta
              puedeCrear={false}
              clienteInicial={cliente.id}
              fechaInicial={fecha}
              alError={alError}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
