"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Map as IconoMapa, Route, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import { useChofer } from "./ProveedorChofer";
import PaginacionChofer from "./PaginacionChofer";
import { crearClaveOperacion } from "@/lib/chofer/infraestructura/crearClaveOperacion";
import {
  ErrorAplicacion,
  resultadoIncierto,
} from "@/lib/chofer/compartido/dominio/Errores";
import type {
  RutaViaje,
  ComparacionCaminos,
  DocumentoConsultaCaminos,
  VistaPreviaCamino,
} from "@/lib/chofer/modulos/recorrido/dominio/Ruta";
import estilos from "./estilosChofer.module.css";

export default function ComparadorCaminosChofer({
  ruta,
  bloqueado,
  ocupado,
  incierto,
  errorOperacion,
  alCerrar,
  alVistaPrevia,
  alElegir,
  alReintentar,
  alActualizar,
}: {
  ruta: RutaViaje;
  bloqueado: boolean;
  ocupado: boolean;
  incierto: boolean;
  errorOperacion: string;
  alCerrar: () => void;
  alVistaPrevia: (vista: VistaPreviaCamino | null) => void;
  alElegir: (consulta: number, opcion: number) => Promise<boolean>;
  alReintentar: () => Promise<boolean>;
  alActualizar: () => void;
}) {
  const t = useTranslations("chofer"),
    { rutas } = useChofer();
  const [pagina, establecerPagina] = useState(1),
    [tramo, establecerTramo] = useState<number | null>(null);
  const [datos, establecerDatos] = useState<ComparacionCaminos | null>(null);
  const [seleccion, establecerSeleccion] = useState(0),
    [enMapa, establecerEnMapa] = useState(false);
  const [cargando, establecerCargando] = useState(false),
    [error, establecerError] = useState("");
  const [vencida, establecerVencida] = useState(false);
  const controlador = useRef<AbortController | null>(null);
  const solicitud = useRef<DocumentoConsultaCaminos | null>(null);
  const vigente = useRef(true),
    turno = useRef(0);
  useEffect(() => {
    const controlTurnos = turno;
    vigente.current = true;
    return () => {
      vigente.current = false;
      ++controlTurnos.current;
      controlador.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!datos) return;
    const espera = setTimeout(
      () => establecerVencida(true),
      Math.max(0, Date.parse(datos.venceEn) - Date.now()),
    );
    return () => clearTimeout(espera);
  }, [datos]);
  const plan = ruta.plan!;
  const origen = tramo ? plan.puntos[tramo - 1] : null,
    destino = tramo ? plan.puntos[tramo] : null;
  const consultar = async (orden: number) => {
    if (cargando || bloqueado || incierto) return;
    const actual = ++turno.current;
    controlador.current?.abort();
    const control = new AbortController();
    controlador.current = control;
    if (!solicitud.current || solicitud.current.tramo !== orden)
      solicitud.current = {
        version: ruta.versionDespacho,
        plan: plan.id,
        tramo: orden,
        clave_operacion: crearClaveOperacion(),
      };
    establecerTramo(orden);
    establecerDatos(null);
    establecerError("");
    establecerCargando(true);
    alVistaPrevia(null);
    try {
      const respuesta = await rutas.consultarAlternativas(
        ruta.despacho,
        solicitud.current,
        control.signal,
      );
      if (
        !vigente.current ||
        actual !== turno.current ||
        control.signal.aborted
      )
        return;
      if (
        respuesta.plan !== plan.id ||
        respuesta.tramo !== orden ||
        respuesta.versionDespacho !== ruta.versionDespacho
      )
        throw new ErrorAplicacion("datos", 502);
      establecerDatos(respuesta);
      establecerSeleccion(0);
      establecerVencida(false);
      alVistaPrevia({ comparacion: respuesta, opcion: 0 });
    } catch (error) {
      if (
        !vigente.current ||
        actual !== turno.current ||
        control.signal.aborted
      )
        return;
      if (!resultadoIncierto(error)) solicitud.current = null;
      establecerError(
        error instanceof ErrorAplicacion && error.detalle
          ? error.detalle
          : t("errorAlternativas"),
      );
    } finally {
      if (vigente.current && actual === turno.current)
        establecerCargando(false);
    }
  };
  const elegirVista = (opcion: number) => {
    establecerSeleccion(opcion);
    if (datos) alVistaPrevia({ comparacion: datos, opcion });
  };
  const volverTramos = () => {
    ++turno.current;
    controlador.current?.abort();
    solicitud.current = null;
    establecerTramo(null);
    establecerDatos(null);
    establecerError("");
    establecerCargando(false);
    alVistaPrevia(null);
  };
  const opcion = datos?.opciones[seleccion];
  const menor = datos
    ? Math.min(...datos.opciones.map((fila) => fila.duracionS))
    : 0;
  const botones = opcion && datos && (
    <div className="flex flex-wrap gap-2">
      {incierto ? (
        <Button
          className="flex-1"
          disabled={ocupado}
          onClick={() => {
            void alReintentar();
          }}
        >
          {t("comprobarResultado")}
        </Button>
      ) : (
        <Button
          className="flex-1"
          disabled={bloqueado || vencida || opcion.actual || cargando}
          onClick={() => {
            void alElegir(datos.consulta, seleccion);
          }}
        >
          {t(ocupado ? "guardando" : "elegirCamino")}
        </Button>
      )}
      <Button
        variant="outline"
        disabled={ocupado}
        onClick={() => establecerEnMapa(!enMapa)}
        startIcon={<IconoMapa className="size-4" />}
      >
        {t(enMapa ? "verOpcionesCamino" : "verCaminoMapa")}
      </Button>
    </div>
  );
  if (enMapa && datos && opcion)
    return (
      <section
        className={`${estilos.tarjeta} ${estilos.cristal}`}
        aria-label={t("vistaPreviaCamino")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("vistaPreviaCamino")}
            </p>
            <h2 className="mt-1 text-sm font-semibold">
              {origen?.nombre} → {destino?.nombre}
            </h2>
          </div>
          <button
            type="button"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl focus-visible:outline-brand-500"
            aria-label={t("cerrar")}
            disabled={ocupado}
            onClick={alCerrar}
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="my-3 flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="outline"
            aria-label={t("caminoAnterior")}
            disabled={seleccion === 0 || ocupado || incierto}
            onClick={() => elegirVista(seleccion - 1)}
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
          </Button>
          <p className="text-sm font-semibold">
            {t("numeroCamino", { numero: seleccion + 1 })} ·{" "}
            {Math.ceil(opcion.duracionS / 60)} min ·{" "}
            {(opcion.distanciaM / 1000).toFixed(1)} km
          </p>
          <Button
            size="sm"
            variant="outline"
            aria-label={t("caminoSiguiente")}
            disabled={
              seleccion >= datos.opciones.length - 1 || ocupado || incierto
            }
            onClick={() => elegirVista(seleccion + 1)}
          >
            <ArrowLeft className="size-4 rotate-180 rtl:rotate-0" />
          </Button>
        </div>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          {t("sinTrafico")}
        </p>
        {vencida && (
          <p
            role="status"
            className="mb-2 text-xs text-warning-700 dark:text-warning-300"
          >
            {t("comparacionVencida")}
          </p>
        )}
        {errorOperacion && (
          <p
            role="alert"
            className="mb-2 text-xs text-error-600 dark:text-error-400"
          >
            {errorOperacion}
          </p>
        )}
        {botones}
      </section>
    );
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!ocupado) alCerrar();
      }}
      className="max-w-xl"
      labelledBy="titulo-comparador-caminos"
      closeLabel={t("cerrar")}
    >
      <div className={estilos.contenidoPanel}>
        <h2
          id="titulo-comparador-caminos"
          className="pe-10 text-xl font-semibold"
        >
          {t("compararCaminos")}
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t("ayudaCompararCaminos")}
        </p>
        {tramo !== null && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={ocupado || incierto}
            onClick={volverTramos}
            startIcon={<ArrowLeft className="size-4 rtl:rotate-180" />}
          >
            {t("volverTramos")}
          </Button>
        )}
        {tramo === null ? (
          <>
            <ol className="my-5 space-y-2" start={(pagina - 1) * 10 + 1}>
              {plan.tramos
                .slice((pagina - 1) * 10, pagina * 10)
                .map((parte) => (
                  <li key={parte.orden}>
                    <button
                      type="button"
                      disabled={bloqueado || cargando || incierto}
                      onClick={() => {
                        void consultar(parte.orden);
                      }}
                      className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-gray-200 p-4 text-start focus-visible:outline-brand-500 disabled:opacity-50 dark:border-gray-700"
                    >
                      <Route
                        className="size-5 shrink-0"
                        style={{ color: parte.color }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {plan.puntos[parte.orden - 1].nombre} →{" "}
                          {plan.puntos[parte.orden].nombre}
                        </span>
                        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                          {Math.ceil(parte.duracionS / 60)} min ·{" "}
                          {(parte.distanciaM / 1000).toFixed(1)} km
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
            </ol>
            <PaginacionChofer
              pagina={pagina}
              total={plan.tramos.length}
              alCambiar={establecerPagina}
            />
          </>
        ) : (
          <>
            <h3 className="my-4 font-semibold">
              {origen?.nombre} → {destino?.nombre}
            </h3>
            {cargando && (
              <p role="status" className="py-8 text-center text-sm">
                {t("consultandoCaminos")}
              </p>
            )}
            {error && (
              <div role="alert" className="space-y-3 py-4">
                <p className="text-sm text-error-600 dark:text-error-400">
                  {error}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      void consultar(tramo);
                    }}
                  >
                    {t("reintentar")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={alActualizar}>
                    {t("actualizar")}
                  </Button>
                </div>
              </div>
            )}
            {datos && (
              <>
                {datos.opciones.length === 1 && (
                  <p
                    role="status"
                    className="mb-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {t("sinCaminosAlternativos")}
                  </p>
                )}
                <div
                  className="space-y-3"
                  role="group"
                  aria-label={t("opcionesCamino")}
                >
                  {datos.opciones.map((fila) => (
                    <button
                      type="button"
                      key={fila.opcion}
                      aria-pressed={fila.opcion === seleccion}
                      disabled={ocupado || incierto}
                      onClick={() => elegirVista(fila.opcion)}
                      className={`w-full rounded-2xl border p-4 text-start focus-visible:outline-brand-500 ${fila.opcion === seleccion ? "border-brand-500 bg-brand-50 dark:bg-brand-950" : "border-gray-200 dark:border-gray-700"}`}
                    >
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">
                          {t("numeroCamino", { numero: fila.opcion + 1 })}
                        </span>
                        <span className="text-sm font-semibold">
                          {Math.ceil(fila.duracionS / 60)} min ·{" "}
                          {(fila.distanciaM / 1000).toFixed(1)} km
                        </span>
                      </span>
                      <span className="mt-2 flex flex-wrap gap-2 text-xs text-brand-700 dark:text-brand-300">
                        {fila.actual && <span>{t("caminoActual")}</span>}
                        {fila.duracionS === menor && (
                          <span>{t("menorTiempoEstimado")}</span>
                        )}
                      </span>
                      {!!fila.calles.length && (
                        <span className="mt-2 block text-xs text-gray-500 dark:text-gray-400">
                          {fila.calles.join(" · ")}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <p className="my-4 text-xs leading-5 text-gray-500 dark:text-gray-400">
                  {t("elegirCaminoAyuda")}
                </p>
                {vencida && (
                  <div role="status" className="mb-3">
                    <p className="text-sm text-warning-700 dark:text-warning-300">
                      {t("comparacionVencida")}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      disabled={ocupado || incierto}
                      onClick={() => {
                        solicitud.current = null;
                        void consultar(tramo);
                      }}
                    >
                      {t("consultarDeNuevo")}
                    </Button>
                  </div>
                )}
                {errorOperacion && (
                  <p
                    role="alert"
                    className="mb-3 text-sm text-error-600 dark:text-error-400"
                  >
                    {errorOperacion}
                  </p>
                )}
                {botones}
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
