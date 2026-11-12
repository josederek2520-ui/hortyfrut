"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft as IconoVolver,
  ArrowRight as IconoSeguir,
  Check as IconoListo,
  Save as IconoGuardar,
  FileCheck2 as IconoEmitir,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import ConfirmacionLogistica from "@/components/logistica/ConfirmacionLogistica";
import ToastViewport from "@/components/ui/toast/ToastViewport";
import { useToast as useAvisos } from "@/hooks/useToast";
import { mostrarBolivianos } from "@/lib/moneda";
import type { Session as Sesion } from "@/components/users/types";
import { destinoSalidaPreparacion as destinoSalida } from "@/components/preparaciones/salidaTrabajoPreparacion";
import useGestionVenta from "./useGestionVenta";
import { sumarImportes } from "./calculosVenta";
import {
  panelVenta,
  enlaceVenta,
  type AccionVenta,
  type ClienteVenta,
} from "./tipos";
import SelectorClienteVenta from "./SelectorClienteVenta";
import SeleccionEntregasVenta from "./SeleccionEntregasVenta";
import ResumenVenta from "./ResumenVenta";
import ContextoVenta from "./ContextoVenta";
import LineasVenta from "./LineasVenta";
import EstadoVenta from "./EstadoVenta";
import DescargarVenta from "./DescargarVenta";

export default function HojaVenta({
  sesion,
  identificador,
}: {
  sesion: Sesion;
  identificador?: number;
}) {
  const t = useTranslations("ventas"),
    idioma = useLocale(),
    navegador = useRouter();
  const gestion = useGestionVenta(identificador),
    { documento, formulario, ocupado, incierto, modificado } = gestion;
  const permisos = sesion.permisos_ventas!;
  const editable =
    (!documento || documento.estado === "borrador") &&
    (documento ? permisos.editar : permisos.crear);
  const lectura = !!documento && documento.estado !== "borrador",
    revision = gestion.paso === "revision" || lectura || !editable;
  const bloqueado = ocupado || incierto;
  const [selector, establecerSelector] = useState(false),
    [revisionDistinta, establecerRevisionDistinta] = useState(true);
  const [confirmacion, establecerConfirmacion] = useState<
    "salir" | "cancelar" | "emitir" | "cliente" | "recargar" | null
  >(null);
  const [clientePendiente, establecerClientePendiente] =
      useState<ClienteVenta | null>(null),
    [rutaSalida, establecerRutaSalida] = useState("/ventas");
  const {
    toasts: avisos,
    notify: notificar,
    dismiss: cerrarAviso,
  } = useAvisos();
  const error = useRef<HTMLDivElement>(null),
    titulo = useRef<HTMLHeadingElement>(null),
    dejarSalir = useRef(false);
  useEffect(() => {
    if (gestion.aviso) notificar(t(gestion.aviso), "success");
  }, [gestion.aviso, notificar, t]);
  useEffect(() => {
    if (gestion.fallo) error.current?.focus();
  }, [gestion.fallo, gestion.errores]);
  useEffect(() => {
    titulo.current?.focus({ preventScroll: true });
  }, [revision]);
  useEffect(() => {
    if (!modificado && !ocupado && !incierto) return;
    const avisar = (evento: BeforeUnloadEvent) => {
      if (!dejarSalir.current) evento.preventDefault();
    };
    const proteger = (evento: MouseEvent) => {
      if (dejarSalir.current) return;
      const enlace =
        evento.target instanceof Element
          ? evento.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      const destino = destinoSalida(evento, enlace, window.location);
      if (!destino) return;
      evento.preventDefault();
      evento.stopPropagation();
      if (ocupado) return;
      establecerRutaSalida(destino);
      establecerConfirmacion("salir");
    };
    window.addEventListener("beforeunload", avisar);
    document.addEventListener("click", proteger, true);
    return () => {
      window.removeEventListener("beforeunload", avisar);
      document.removeEventListener("click", proteger, true);
    };
  }, [modificado, ocupado, incierto]);

  async function actuar(accion: AccionVenta) {
    const resultado = await gestion.operar(accion);
    establecerConfirmacion(null);
    if (resultado) {
      establecerConfirmacion(null);
      if (resultado.estado !== "borrador" && resultado.id !== identificador) {
        dejarSalir.current = true;
        navegador.replace("/ventas/" + resultado.id);
      }
    }
  }
  function volver() {
    if (ocupado) return;
    if (modificado || incierto) {
      establecerRutaSalida("/ventas");
      establecerConfirmacion("salir");
    } else navegador.push("/ventas");
  }
  function elegirCliente(cliente: ClienteVenta) {
    establecerSelector(false);
    if (cliente.id === formulario.cliente?.id) return;
    if (formulario.entregas.length) {
      establecerClientePendiente(cliente);
      establecerConfirmacion("cliente");
    } else gestion.cambiar({ cliente });
  }
  const total = revision
    ? (documento?.total ?? null)
    : sumarImportes(formulario.entregas);
  const fueraPeriodo = formulario.entregas.some(
    (fila) =>
      fila.fecha_recepcion < formulario.desde ||
      fila.fecha_recepcion > formulario.hasta,
  );
  if (gestion.fallo === "sinAcceso")
    return (
      <div role="alert" className={panelVenta + " p-8"}>
        {t("sinAcceso")}
      </div>
    );
  if (gestion.cargando)
    return (
      <div role="status" className={panelVenta + " p-12 text-center"}>
        {t("cargando")}
      </div>
    );
  if (identificador && !documento)
    return (
      <div role="alert" className={panelVenta + " space-y-4 p-8"}>
        <p>{t("errorConsulta")}</p>
        <Button onClick={gestion.recargar}>{t("reintentar")}</Button>
      </div>
    );
  return (
    <section className="space-y-5 text-gray-900 dark:text-white">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={volver}
            disabled={ocupado}
            aria-label={t("volver")}
            className="control-suave-hortyfru flex size-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 dark:border-gray-700"
          >
            <IconoVolver className="size-5 rtl:rotate-180" aria-hidden="true" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1
                ref={titulo}
                tabIndex={-1}
                className="text-2xl font-semibold tracking-tight outline-none"
              >
                {t(lectura ? "detalleVenta" : "nueva")}
              </h1>
              {documento && <EstadoVenta estado={documento.estado} />}
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {documento ? documento.codigo : t("nuevaAyuda")}
            </p>
          </div>
        </div>
        {documento?.estado === "emitida" && permisos.descargar && (
          <DescargarVenta venta={documento} />
        )}
      </header>
      {gestion.fallo && (
        <div
          ref={error}
          tabIndex={-1}
          role="alert"
          className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-800 outline-none dark:border-error-800 dark:bg-error-500/10 dark:text-error-200"
        >
          <p className="font-medium">{t(gestion.fallo)}</p>
          {gestion.errores.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 ps-5">
              {gestion.errores.map((mensaje, indice) => (
                <li key={indice}>
                  {t.has(mensaje)
                    ? t(mensaje)
                    : t.has("incidencias." + mensaje)
                      ? t("incidencias." + mensaje)
                      : idioma === "es"
                        ? mensaje
                        : t("comprobarDatos")}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {incierto ? (
              <Button
                variant="outline"
                disabled={ocupado}
                onClick={() => void actuar("reintentar")}
              >
                {t("comprobarOperacion")}
              </Button>
            ) : (
              documento && (
                <Button
                  variant="outline"
                  disabled={ocupado}
                  onClick={() =>
                    modificado
                      ? establecerConfirmacion("recargar")
                      : gestion.recargar()
                  }
                >
                  {t("recargarDocumento")}
                </Button>
              )
            )}
          </div>
        </div>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className={panelVenta + " min-w-0"}>
          {!lectura && (
            <ol className="grid grid-cols-2 gap-2 border-b border-gray-100 p-3 dark:border-gray-800">
              {["elegirEntregas", "revisarVenta"].map((clave, indice) => (
                <li key={clave}>
                  <button
                    type="button"
                    disabled={
                      bloqueado ||
                      (indice === 0 && !editable) ||
                      (indice === 1 && !formulario.entregas.length)
                    }
                    aria-current={
                      (indice === 1) === revision ? "step" : undefined
                    }
                    onClick={() =>
                      indice === 0
                        ? gestion.volverSeleccion()
                        : void actuar("revisar")
                    }
                    className={
                      "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 " +
                      ((indice === 1) === revision
                        ? "bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200"
                        : "text-gray-500 dark:text-gray-400")
                    }
                  >
                    <span className="flex size-6 items-center justify-center rounded-full border border-current text-xs">
                      {indice === 0 && revision ? (
                        <IconoListo className="size-3.5" aria-hidden="true" />
                      ) : (
                        indice + 1
                      )}
                    </span>
                    {t(clave)}
                  </button>
                </li>
              ))}
            </ol>
          )}
          <ContextoVenta
            formulario={formulario}
            documento={documento}
            revision={revision}
            editable={editable}
            bloqueado={bloqueado}
            alCambiar={gestion.cambiar}
            alElegirCliente={() => establecerSelector(true)}
          />
          {revision && documento ? (
            <>
              {documento.estado === "borrador" &&
                !!documento.incidencias.length && (
                  <div
                    role="alert"
                    className="m-5 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800 dark:border-orange-800 dark:bg-orange-500/10 dark:text-orange-200"
                  >
                    <p className="font-medium">{t("antesEmitir")}</p>
                    <ul className="mt-2 list-disc space-y-1 ps-5">
                      {documento.incidencias.map((incidencia) => (
                        <li key={incidencia}>
                          {t("incidencias." + incidencia)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              {documento.estado === "borrador" && (
                <div className="flex justify-end px-5 py-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={bloqueado}
                    onClick={() => void actuar("revisar")}
                  >
                    {t("actualizarRevision")}
                  </Button>
                </div>
              )}
              <LineasVenta
                key={documento.id + "-" + documento.revision}
                venta={documento}
                alRevisionDistinta={establecerRevisionDistinta}
              />
            </>
          ) : (
            <SeleccionEntregasVenta
              key={`${formulario.cliente?.id}-${formulario.desde}-${formulario.hasta}`}
              formulario={formulario}
              bloqueado={bloqueado || !editable}
              alCambiar={(entregas) => gestion.cambiar({ entregas })}
            />
          )}
          {lectura && documento && (
            <div className="border-t border-gray-100 px-5 py-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <p>
                {t(
                  documento.estado === "emitida"
                    ? "emitidoPor"
                    : "registradoPor",
                )}
                :{" "}
                {documento.emitido_por_nombre ||
                  documento.registrado_por_nombre}
              </p>
              <p className="mt-1">{t("sinValorFiscal")}</p>
            </div>
          )}
        </div>
        <ResumenVenta
          total={total}
          cantidad={formulario.entregas.length}
          venta={revision ? documento : null}
        />
      </div>
      {!lectura && (
        <footer className="superficie-flotante-suave sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 px-4 py-3 shadow-theme-md dark:border-gray-700">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t(
                modificado
                  ? "cambiosSinGuardar"
                  : documento
                    ? "borradorGuardado"
                    : "seleccionResumen",
                { cantidad: formulario.entregas.length },
              )}
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums">
              {total === null
                ? t("totalPendiente")
                : mostrarBolivianos(total, idioma)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {documento && permisos.cancelar && (
              <button
                type="button"
                className={enlaceVenta + " text-gray-500"}
                disabled={bloqueado || modificado}
                onClick={() => establecerConfirmacion("cancelar")}
              >
                {t("cancelarBorrador")}
              </button>
            )}
            {revision && editable && (
              <Button
                variant="outline"
                disabled={bloqueado}
                onClick={gestion.volverSeleccion}
              >
                {t("anterior")}
              </Button>
            )}
            {!revision && editable && (
              <Button
                variant="outline"
                disabled={bloqueado || !formulario.cliente}
                onClick={() => void actuar("guardar")}
                startIcon={
                  <IconoGuardar className="size-4" aria-hidden="true" />
                }
              >
                {t(ocupado ? "guardando" : "guardarBorrador")}
              </Button>
            )}
            {!revision ? (
              <Button
                disabled={
                  bloqueado || !formulario.entregas.length || fueraPeriodo
                }
                onClick={() => void actuar("revisar")}
                endIcon={
                  <IconoSeguir
                    className="size-4 rtl:rotate-180"
                    aria-hidden="true"
                  />
                }
              >
                {t("revisarVenta")}
              </Button>
            ) : (
              documento &&
              permisos.emitir && (
                <Button
                  disabled={
                    bloqueado ||
                    modificado ||
                    revisionDistinta ||
                    !!documento.incidencias.length ||
                    documento.total === null
                  }
                  onClick={() => establecerConfirmacion("emitir")}
                  startIcon={
                    <IconoEmitir className="size-4" aria-hidden="true" />
                  }
                >
                  {t("emitir")}
                </Button>
              )
            )}
          </div>
        </footer>
      )}
      {selector && (
        <SelectorClienteVenta
          alElegir={elegirCliente}
          alCerrar={() => establecerSelector(false)}
        />
      )}
      {confirmacion && (
        <ConfirmacionLogistica
          titulo={t("confirmaciones." + confirmacion + ".titulo")}
          descripcion={t("confirmaciones." + confirmacion + ".descripcion", {
            total: total === null ? "—" : mostrarBolivianos(total, idioma),
          })}
          accion={t("confirmaciones." + confirmacion + ".accion")}
          ocupado={ocupado}
          alCerrar={() => establecerConfirmacion(null)}
          alConfirmar={() => {
            if (confirmacion === "salir") {
              dejarSalir.current = true;
              navegador.push(rutaSalida);
            } else if (confirmacion === "cliente") {
              gestion.cambiar({ cliente: clientePendiente, entregas: [] });
              establecerConfirmacion(null);
            } else if (confirmacion === "recargar") {
              gestion.recargar();
              establecerConfirmacion(null);
            } else void actuar(confirmacion);
          }}
        />
      )}
      <ToastViewport toasts={avisos} onDismiss={cerrarAviso} />
    </section>
  );
}
