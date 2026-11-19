"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  CheckCircle2,
  MessageSquareWarning,
  RefreshCw,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import ConfirmacionLogistica from "@/components/logistica/ConfirmacionLogistica";
import useConsultaComercial from "@/components/comercial/useConsultaComercial";
import useOperacionComercial from "@/components/comercial/useOperacionComercial";
import useProteccionComercial from "@/components/comercial/useProteccionComercial";
import RevisionCobro from "@/components/cobros/RevisionCobro";
import DescargarComprobanteCobro from "@/components/cobros/DescargarComprobanteCobro";
import { crearClaveOperacion } from "@/lib/chofer/infraestructura/crearClaveOperacion";
import { mostrarBolivianos } from "@/lib/moneda";
import { mostrarFechaVenta } from "@/components/ventas/calculosVenta";
import { panelVenta, campoVenta, enlaceVenta } from "@/components/ventas/tipos";
import EstadoPago from "./EstadoPago";
import AplicacionesPago from "./AplicacionesPago";
import type { AvisoPago, RevisionPago } from "./tipos";

export default function DetallePago({
  identificador,
  oficina,
  puedeConfirmar = false,
  puedeObservar = false,
  puedeInformar = false,
  puedeVerCobros = false,
}: {
  identificador: number;
  oficina: boolean;
  puedeConfirmar?: boolean;
  puedeObservar?: boolean;
  puedeInformar?: boolean;
  puedeVerCobros?: boolean;
}) {
  const t = useTranslations("pagos"),
    tc = useTranslations("comercialComun"),
    tb = useTranslations("cobros"),
    idioma = useLocale();
  const ruta = oficina ? "pagos-por-verificar" : "mis-pagos";
  const consulta = useConsultaComercial<AvisoPago>(`${ruta}/${identificador}/`),
    operacion = useOperacionComercial();
  const [decidido, establecerDecidido] = useState<AvisoPago | null>(null),
    [revision, establecerRevision] = useState<RevisionPago | null>(null),
    [observar, establecerObservar] = useState(false),
    [motivo, establecerMotivo] = useState("");
  const [revisionLectura, establecerRevisionLectura] = useState(0);
  const bloqueado = operacion.ocupado || operacion.incierto;
  const proteccion = useProteccionComercial(
    operacion.incierto || (observar && !!motivo.trim()),
    operacion.ocupado,
  );
  const pago = decidido ?? consulta.datos;
  const actualizar = () => {
    if (bloqueado) return;
    establecerDecidido(null);
    establecerRevisionLectura((valor) => valor + 1);
    consulta.recargar();
  };
  async function actuar(
    accion: "revisar" | "confirmar" | "observar" | "reintentar",
  ) {
    if (!pago) return;
    const revisionElegida = revision;
    if (accion === "confirmar") establecerRevision(null);
    if (accion === "observar") establecerObservar(false);
    const resultado =
      accion === "reintentar"
        ? await operacion.enviar<AvisoPago | RevisionPago>()
        : await operacion.enviar<AvisoPago | RevisionPago>(
            `${ruta}/${identificador}/${accion}/`,
            {
              clave_operacion: crearClaveOperacion(),
              version:
                accion === "confirmar"
                  ? revisionElegida?.version_aviso
                  : pago.version,
              ...(accion === "confirmar"
                ? { revision: revisionElegida?.revision ?? "" }
                : {}),
              ...(accion === "observar" ? { motivo } : {}),
            },
          );
    if (!resultado) return;
    if ("id" in resultado.datos) {
      establecerDecidido(resultado.datos);
      establecerRevision(null);
      establecerMotivo("");
      consulta.recargar();
    } else establecerRevision(resultado.datos);
  }
  if (!consulta.sesionValida || !operacion.autorizado)
    return <p role="alert">{tc("sinAcceso")}</p>;
  if (!pago)
    return (
      <div className={panelVenta + " p-8"}>
        <p role={consulta.fallo ? "alert" : "status"}>
          {tc(consulta.fallo ? "errorConsulta" : "cargando")}
        </p>
        {consulta.fallo && (
          <Button onClick={consulta.recargar}>{tc("reintentar")}</Button>
        )}
      </div>
    );
  return (
    <section className="space-y-5 text-gray-900 dark:text-white">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={tc("volver")}
            disabled={operacion.ocupado}
            className="control-suave-hortyfru inline-flex size-11 items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-brand-500"
            onClick={() => proteccion.salir("/" + ruta)}
          >
            <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden="true" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold">{pago.codigo}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("detalle")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <EstadoPago estado={pago.estado} />
          <Button
            variant="outline"
            size="sm"
            disabled={bloqueado}
            startIcon={<RefreshCw className="size-4" />}
            onClick={actualizar}
          >
            {t("actualizar")}
          </Button>
        </div>
      </header>
      {operacion.fallo && (
        <div
          role="alert"
          className="space-y-2 rounded-xl bg-error-50 p-4 text-sm text-error-700 dark:bg-error-950 dark:text-error-200"
        >
          <p>{tc(operacion.fallo)}</p>
          {operacion.errores.map((mensaje, i) => (
            <p key={i}>{mensaje}</p>
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
      <div className={panelVenta + " p-5"}>
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["supermercado", pago.cliente_nombre],
            ["fechaPago", mostrarFechaVenta(pago.fecha_cobro, idioma)],
            ["importePagado", mostrarBolivianos(pago.importe, idioma)],
            ["medio", tb("medios." + pago.medio)],
          ].map(([clave, valor]) => (
            <div key={clave}>
              <dt className="text-xs text-gray-500 dark:text-gray-400">
                {t(clave)}
              </dt>
              <dd className="mt-1 font-semibold break-words">{valor}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
          {t("informadoPor", {
            nombre: pago.informado_por_nombre,
            fecha: new Date(pago.informado_en).toLocaleString(idioma),
          })}
        </p>
        {pago.revisado_en && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {t("revisadoPor", {
              nombre: pago.revisado_por_nombre,
              fecha: new Date(pago.revisado_en).toLocaleString(idioma),
            })}
          </p>
        )}
      </div>
      <div
        className={
          "rounded-xl border p-4 text-sm " +
          (pago.estado === "observado"
            ? "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-500/10 dark:text-orange-200"
            : "border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-500/10 dark:text-brand-200")
        }
      >
        <p>
          {t(
            pago.estado === "por_verificar"
              ? oficina
                ? "comprobarBanco"
                : "pendienteAyuda"
              : pago.estado === "confirmado"
                ? "confirmadoAyuda"
                : "observadoAyuda",
          )}
        </p>
        {pago.motivo_observacion && (
          <p className="mt-2 font-medium break-words">
            {pago.motivo_observacion}
          </p>
        )}
        {pago.codigo_cobro && (
          <p className="mt-2">
            {t("cobroRegistrado")}:{" "}
            {oficina && puedeVerCobros ? (
              <Link
                className="font-semibold underline"
                href={"/cobros/" + pago.cobro}
              >
                {pago.codigo_cobro}
              </Link>
            ) : (
              <span className="font-semibold">{pago.codigo_cobro}</span>
            )}
          </p>
        )}
      </div>
      <div
        className={
          panelVenta + " flex flex-wrap items-center justify-between gap-4 p-5"
        }
      >
        <div className="min-w-0">
          <h2 className="font-semibold">{tb("comprobante")}</h2>
          <p className="mt-1 text-sm break-words text-gray-500 dark:text-gray-400">
            {pago.comprobante.nombre}
          </p>
        </div>
        <DescargarComprobanteCobro key={pago.id} cobro={pago} ruta={ruta} />
      </div>
      <AplicacionesPago
        key={pago.version + "-" + revisionLectura}
        identificador={identificador}
        ruta={ruta}
      />
      {oficina && pago.estado === "por_verificar" && (
        <footer
          className={
            panelVenta +
            " sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 p-4"
          }
        >
          <p className="max-w-md text-xs text-gray-500 dark:text-gray-400">
            {t("comprobarBanco")}
          </p>
          <div className="flex flex-wrap gap-2">
            {puedeObservar && (
              <Button
                variant="outline"
                disabled={bloqueado}
                startIcon={<MessageSquareWarning className="size-4" />}
                onClick={() => establecerObservar(true)}
              >
                {t("observar")}
              </Button>
            )}
            {puedeConfirmar && (
              <Button
                disabled={bloqueado}
                startIcon={<CheckCircle2 className="size-4" />}
                onClick={() => void actuar("revisar")}
              >
                {t("confirmarIngreso")}
              </Button>
            )}
          </div>
        </footer>
      )}
      {!oficina && puedeInformar && pago.estado === "observado" && (
        <Link href="/mis-pagos/nuevo" className={enlaceVenta}>
          {t("informarCorregido")}
        </Link>
      )}
      {revision && !operacion.incierto && (
        <RevisionCobro
          revision={revision}
          ocupado={operacion.ocupado}
          alCerrar={() => establecerRevision(null)}
          alConfirmar={() => void actuar("confirmar")}
        />
      )}
      {observar && (
        <ConfirmacionLogistica
          titulo={t("observar")}
          descripcion={t("observarAyuda")}
          accion={t("guardarObservacion")}
          ocupado={bloqueado}
          deshabilitado={!motivo.trim()}
          alCerrar={() => {
            establecerObservar(false);
            establecerMotivo("");
          }}
          alConfirmar={() => void actuar("observar")}
        >
          <label className="mt-4 block text-sm">
            {t("motivo")}
            <textarea
              className={campoVenta + " mt-2 min-h-28"}
              value={motivo}
              maxLength={1000}
              disabled={bloqueado}
              onChange={(e) => establecerMotivo(e.target.value)}
            />
          </label>
        </ConfirmacionLogistica>
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
