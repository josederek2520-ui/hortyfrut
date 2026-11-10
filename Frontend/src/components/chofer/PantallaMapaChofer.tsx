"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  LocateFixed,
  Maximize,
  Moon,
  Sun,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Navigation,
  Smartphone,
  Map as IconoMapa,
  Route as IconoRecorrido,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useTheme } from "@/context/ThemeContext";
import Button from "@/components/ui/button/Button";
import ConfirmacionLogistica from "@/components/logistica/ConfirmacionLogistica";
import ToastViewport from "@/components/ui/toast/ToastViewport";
import { useToast } from "@/hooks/useToast";
import { useChofer, useSeguimiento } from "./ProveedorChofer";
import { useViajeChofer } from "./useViajeChofer";
import { usePantallaEncendida } from "./usePantallaEncendida";
import PanelViajeChofer from "./PanelViajeChofer";
import BotonUbicacionMapaChofer from "./BotonUbicacionMapaChofer";
import LimiteMapaChofer from "./LimiteMapaChofer";
import ComparadorCaminosChofer from "./ComparadorCaminosChofer";
import { useGuiaChofer } from "./useGuiaChofer";
import EstadoGuiaChofer from "./EstadoGuiaChofer";
import { previsualizarCamino } from "@/lib/chofer/modulos/recorrido/aplicacion/previsualizarCamino";
import type { VistaPreviaCamino } from "@/lib/chofer/modulos/recorrido/dominio/Ruta";
import {
  ordenarRuta,
  paradasRuta,
} from "@/lib/chofer/modulos/recorrido/aplicacion/ordenRuta";
import {
  siguienteAccion,
  siguienteParada,
} from "@/lib/chofer/modulos/recorrido/aplicacion/accionesViaje";
import { ErrorAplicacion } from "@/lib/chofer/compartido/dominio/Errores";
import type { DocumentoOperacion } from "@/lib/chofer/modulos/despachos/dominio/RepositorioDespachos";
import estilos from "./estilosChofer.module.css";
const MapaChofer = dynamic(() => import("./MapaChofer"), { ssr: false });

export default function PantallaMapaChofer({
  identificador,
}: {
  identificador: number;
}) {
  const t = useTranslations("chofer"),
    { theme, toggleTheme } = useTheme();
  const navegador = useRouter();
  const { sesion, seguimiento, cliente } = useChofer(),
    captura = useSeguimiento();
  const consulta = useViajeChofer(identificador),
    { toasts, notify, dismiss } = useToast();
  const pantalla = usePantallaEncendida(() =>
    notify(t("pantallaNoCompatible"), "info"),
  );
  const [panel, establecerPanel] = useState<string | null>(null),
    [compacta, establecerCompacta] = useState(false);
  const [ordenLocal, establecerOrdenLocal] = useState<{
    version: string;
    orden: number[];
  } | null>(null);
  const [revisionEncuadre, establecerRevisionEncuadre] = useState(0),
    [revisionMapa, establecerRevisionMapa] = useState(0);
  const [falloMapa, establecerFalloMapa] = useState(false),
    [seguir, establecerSeguir] = useState(false);
  const [ahora, establecerAhora] = useState(Date.now);
  const [mostrarCompleto, establecerMostrarCompleto] = useState(false);
  const [comparandoVersion, establecerComparandoVersion] = useState<
    string | null
  >(null);
  const [vistaCamino, establecerVistaCamino] =
    useState<VistaPreviaCamino | null>(null);
  const alVistaPreviaCamino = useCallback((vista: VistaPreviaCamino | null) => {
    establecerVistaCamino(vista);
    establecerRevisionEncuadre((valor) => valor + 1);
  }, []);
  const [descartarOrden, establecerDescartarOrden] = useState(false);
  const [confirmacion, establecerConfirmacion] = useState<{
    accion: string;
    documento: Omit<DocumentoOperacion, "clave_operacion">;
  } | null>(null);
  const visor = useRef<HTMLElement>(null);
  const alErrorMapa = useCallback(
    () => establecerFalloMapa(true),
    [establecerFalloMapa],
  );
  const alCargarMapa = useCallback(
    () => establecerFalloMapa(false),
    [establecerFalloMapa],
  );
  const alMoverMapa = useCallback(
    () => establecerSeguir(false),
    [establecerSeguir],
  );
  useEffect(() => {
    const reloj = setInterval(() => establecerAhora(Date.now()), 5000);
    return () => clearInterval(reloj);
  }, []);
  const cambiosOrden =
    !!ordenLocal &&
    ordenLocal.version === consulta.datos?.viaje.version &&
    paradasRuta(consulta.datos.ruta).some(
      (punto, indice) => punto.parada !== ordenLocal.orden[indice],
    );
  useEffect(() => {
    if (!cambiosOrden) return;
    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [cambiosOrden]);
  const posicion =
    captura.viaje === identificador &&
    captura.posicion &&
    ahora - Date.parse(captura.posicion.capturadaEn) <= 30000
      ? captura.posicion
      : null;
  const guia = useGuiaChofer({
    cliente,
    usuario: sesion.user.id,
    viaje: consulta.datos?.viaje ?? null,
    ruta: consulta.datos?.ruta ?? null,
    sesion: seguimiento.identificadorSesion(identificador),
    posicion,
    mostrarCompleto,
  });
  // La captura puede continuar al consultar pedidos; ocultar la pestaña la detiene en el proveedor.
  const mensajeError = (error: unknown) =>
    error instanceof ErrorAplicacion
      ? error.detalle || t(`errores.${error.codigo}`)
      : t("errorConsulta");
  if (!consulta.datos)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-gray-900 dark:text-white">
        <Link
          href="/mis-viajes"
          className="inline-flex min-h-11 items-center gap-2"
        >
          <ArrowLeft className="size-5" />
          {t("titulo")}
        </Link>
        <p role={consulta.error ? "alert" : "status"}>
          {consulta.error ? mensajeError(consulta.error) : t("cargando")}
        </p>
        {!!consulta.error && (
          <Button onClick={consulta.recargar}>{t("reintentar")}</Button>
        )}
      </main>
    );
  const { viaje, ruta: rutaGuardada } = consulta.datos;
  const orden =
    ordenLocal?.version === viaje.version
      ? ordenLocal.orden
      : paradasRuta(rutaGuardada).map((punto) => punto.parada!);
  const ruta = ordenarRuta(rutaGuardada, orden);
  const puedeOperar = !!sesion.permisos_chofer?.operar;
  const enComparador =
    comparandoVersion === viaje.version && ruta.preparando && puedeOperar;
  const rutaMapa = previsualizarCamino(ruta, enComparador ? vistaCamino : null);
  const siguiente = siguienteParada(viaje),
    accion = siguienteAccion(viaje, puedeOperar);
  const requierePreparar =
    accion === "iniciar" &&
    (ruta.estado === "pendiente_aprobacion" ||
      ruta.estado === "obsoleta" ||
      (!!ordenLocal &&
        ordenLocal.version === viaje.version &&
        ruta !== rutaGuardada));
  const error = consulta.errorOperacion
    ? mensajeError(consulta.errorOperacion)
    : consulta.error
      ? mensajeError(consulta.error)
      : "";
  const actuar = () => {
    if (!accion) return;
    if (requierePreparar || consulta.trabajoActivo) {
      establecerPanel("ruta");
      return;
    }
    if (accion === "pedidos") {
      establecerPanel("pedidos");
      return;
    }
    if (accion === "finalizar") void seguimiento.detener();
    establecerConfirmacion({
      accion,
      documento: {
        version: viaje.version,
        ...(accion === "llegar" && siguiente ? { parada: siguiente.id } : {}),
      },
    });
  };
  const aceptar = async () => {
    if (!confirmacion) return;
    if (await consulta.operar(confirmacion.accion, confirmacion.documento)) {
      establecerConfirmacion(null);
      establecerPanel(null);
      notify(t("operacionGuardada"), "success");
    }
  };
  const respaldo = (
    <div className={`${estilos.avisoMapa} ${estilos.cristal}`} role="alert">
      <p>{t("errorMapa")}</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-2"
        onClick={() => {
          establecerFalloMapa(false);
          establecerRevisionMapa((valor) => valor + 1);
        }}
      >
        {t("reintentarMapa")}
      </Button>
    </div>
  );
  return (
    <main
      ref={visor}
      className={estilos.visor}
      aria-label={t("mapaViaje", { codigo: viaje.codigo })}
    >
      <LimiteMapaChofer key={revisionMapa} respaldo={respaldo}>
        <MapaChofer
          ruta={rutaMapa}
          caminosAlternativos={
            enComparador &&
            vistaCamino?.comparacion.versionDespacho === ruta.versionDespacho
              ? vistaCamino.comparacion.opciones
              : undefined
          }
          paradas={viaje.paradas}
          estadoViaje={viaje.estado}
          mostrarCompleto={mostrarCompleto}
          posicion={posicion}
          guia={guia.estado}
          revision={revisionEncuadre}
          seguir={seguir}
          alMover={alMoverMapa}
          alError={alErrorMapa}
          alCargar={alCargarMapa}
        />
      </LimiteMapaChofer>
      <header className={estilos.cabecera}>
        <Link
          href="/mis-viajes"
          className={estilos.botonMapa}
          aria-label={t("volverViajes")}
          onClick={(evento) => {
            if (consulta.ocupado || consulta.incierto) {
              evento.preventDefault();
              notify(t("incierto"), "info");
            } else if (cambiosOrden) {
              evento.preventDefault();
              establecerDescartarOrden(true);
            }
          }}
        >
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </Link>
        <div className={`${estilos.cristal} min-w-0 px-4 py-2`}>
          <h1 className="truncate text-sm font-semibold">{viaje.codigo}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t(`estados.${viaje.estado}`)} · {viaje.vehiculo}
          </p>
        </div>
        <button
          type="button"
          className={`${estilos.botonMapa} ms-auto`}
          aria-label={t(theme === "dark" ? "temaClaro" : "temaOscuro")}
          onClick={toggleTheme}
        >
          {theme === "dark" ? (
            <Sun className="size-5" />
          ) : (
            <Moon className="size-5" />
          )}
        </button>
      </header>
      {falloMapa && respaldo}
      <div className={estilos.herramientas} aria-label={t("controlesMapa")}>
        {viaje.estado === "en_ruta" &&
          viaje.paradas.some((parada) => parada.descargadaEn) && (
            <button
              type="button"
              className={estilos.botonMapa}
              aria-label={t(
                mostrarCompleto
                  ? "verRecorridoPendiente"
                  : "verRecorridoCompleto",
              )}
              title={t(
                mostrarCompleto
                  ? "verRecorridoPendiente"
                  : "verRecorridoCompleto",
              )}
              aria-pressed={mostrarCompleto}
              onClick={() => establecerMostrarCompleto(!mostrarCompleto)}
            >
              <IconoRecorrido
                className={`size-5 ${mostrarCompleto ? "text-brand-600" : ""}`}
              />
            </button>
          )}
        <button
          type="button"
          className={estilos.botonMapa}
          aria-label={t("encuadrar")}
          onClick={() => {
            establecerSeguir(false);
            establecerRevisionEncuadre((valor) => valor + 1);
          }}
        >
          <IconoMapa className="size-5" />
        </button>
        <button
          type="button"
          className={estilos.botonMapa}
          aria-label={t("centrar")}
          aria-pressed={seguir}
          disabled={enComparador}
          onClick={() => {
            if (posicion) establecerSeguir(true);
            else establecerPanel("ubicacion");
          }}
        >
          <LocateFixed className={`size-5 ${seguir ? "text-brand-600" : ""}`} />
        </button>
        <button
          type="button"
          className={estilos.botonMapa}
          aria-label={t("pantallaCompleta")}
          onClick={() => {
            if (document.fullscreenElement)
              void document.exitFullscreen().catch(() => {});
            else if (document.documentElement.requestFullscreen)
              void document.documentElement
                .requestFullscreen()
                .catch(() => notify(t("pantallaNoDisponible"), "info"));
            else notify(t("pantallaNoDisponible"), "info");
          }}
        >
          <Maximize className="size-5" />
        </button>
        <button
          type="button"
          className={estilos.botonMapa}
          aria-label={t(
            pantalla.activa ? "liberarPantalla" : "mantenerPantalla",
          )}
          aria-pressed={pantalla.activa}
          onClick={() => {
            void pantalla.alternar();
          }}
        >
          <Smartphone
            className={`size-5 ${pantalla.activa ? "text-brand-600" : ""}`}
          />
        </button>
      </div>
      <section
        hidden={enComparador}
        className={`${estilos.tarjeta} ${estilos.cristal} ${compacta ? estilos.tarjetaCompacta : ""}`}
        aria-label={t("resumenViaje")}
      >
        <div className="flex items-center gap-3">
          <Navigation className="size-5 shrink-0 text-brand-600 dark:text-brand-400" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t(
                viaje.estado === "en_ruta" && !siguiente
                  ? "regreso"
                  : "siguienteDestino",
              )}
            </p>
            <h2 className="truncate font-semibold">
              {siguiente?.nombre ?? viaje.almacen}
            </h2>
          </div>
          <button
            type="button"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl"
            aria-expanded={!compacta}
            aria-controls="resumen-mapa"
            aria-label={t(compacta ? "expandir" : "contraer")}
            onClick={() => establecerCompacta(!compacta)}
          >
            {compacta ? (
              <ChevronUp className="size-5" />
            ) : (
              <ChevronDown className="size-5" />
            )}
          </button>
        </div>
        {!compacta && (
          <div id="resumen-mapa">
            <p className="mt-1 truncate ps-8 text-xs text-gray-500 dark:text-gray-400">
              {siguiente?.cliente ?? t("regresoAlmacen")}
            </p>
            <EstadoGuiaChofer
              estado={guia.estado}
              alReintentar={guia.reintentar}
            />
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span>
                {t("avance", {
                  completadas: viaje.resumen.completadas,
                  total: viaje.resumen.paradas,
                })}
              </span>
              <BotonUbicacionMapaChofer
                estado={captura.viaje === identificador ? captura : null}
                conPosicion={!!posicion}
                alAbrir={() => establecerPanel("ubicacion")}
              />
            </div>
            {error && (
              <p
                role="alert"
                className="mb-3 text-xs text-error-600 dark:text-error-400"
              >
                {error}
              </p>
            )}
            {consulta.incierto && (
              <p role="status" className="mb-3 text-xs">
                {t("incierto")}
              </p>
            )}
            {viaje.estado === "borrador" && viaje.capacidad !== "apta" && (
              <p
                role="status"
                className="mb-3 text-xs text-warning-700 dark:text-warning-300"
              >
                {t("capacidadPendiente")}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                size="sm"
                onClick={() =>
                  establecerPanel(
                    viaje.estado === "borrador" ? "ruta" : "paradas",
                  )
                }
              >
                {t("detalles")}
              </Button>
              {consulta.incierto ? (
                <Button
                  className="flex-1"
                  size="sm"
                  disabled={consulta.ocupado}
                  onClick={() => {
                    void consulta.reintentar().then((ok) => {
                      if (ok) {
                        establecerConfirmacion(null);
                        establecerPanel(null);
                        notify(t("operacionGuardada"), "success");
                      }
                    });
                  }}
                >
                  {t("comprobarResultado")}
                </Button>
              ) : (
                accion && (
                  <Button
                    className="flex-1"
                    size="sm"
                    disabled={consulta.bloqueado || consulta.trabajoActivo}
                    onClick={actuar}
                  >
                    {t(
                      consulta.ocupado
                        ? "guardando"
                        : requierePreparar
                          ? "prepararRuta"
                          : `acciones.${accion}`,
                    )}
                  </Button>
                )
              )}
              {!accion && (
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t("actualizar")}
                  disabled={consulta.ocupado}
                  onClick={consulta.recargar}
                >
                  <RefreshCw className="size-5" />
                </Button>
              )}
            </div>
          </div>
        )}
      </section>
      {enComparador && (
        <ComparadorCaminosChofer
          key={`${viaje.id}:${viaje.version}`}
          ruta={ruta}
          bloqueado={consulta.bloqueado || consulta.trabajoActivo}
          ocupado={consulta.ocupado}
          incierto={consulta.incierto}
          errorOperacion={error}
          alVistaPrevia={alVistaPreviaCamino}
          alCerrar={() => {
            establecerComparandoVersion(null);
            alVistaPreviaCamino(null);
            establecerPanel("ruta");
          }}
          alActualizar={() => {
            establecerComparandoVersion(null);
            alVistaPreviaCamino(null);
            consulta.recargar();
            establecerPanel("ruta");
          }}
          alElegir={async (consultaId, opcion) => {
            const ok = await consulta.operarRuta("elegir-alternativa", {
              version: viaje.version,
              consulta: consultaId,
              opcion,
            });
            if (ok) {
              establecerComparandoVersion(null);
              alVistaPreviaCamino(null);
              establecerPanel("ruta");
              notify(t("caminoGuardado"), "success");
            }
            return ok;
          }}
          alReintentar={async () => {
            const ok = await consulta.reintentar();
            if (ok) {
              establecerComparandoVersion(null);
              alVistaPreviaCamino(null);
              establecerPanel("ruta");
              notify(t("caminoGuardado"), "success");
            }
            return ok;
          }}
        />
      )}
      {panel && !enComparador && (
        <PanelViajeChofer
          alCompararCaminos={() => {
            establecerPanel(null);
            establecerComparandoVersion(viaje.version);
            alVistaPreviaCamino(null);
          }}
          key={panel}
          viaje={viaje}
          ruta={ruta}
          orden={orden}
          seccionInicial={panel}
          puedeOperar={puedeOperar}
          bloqueado={consulta.bloqueado}
          ocupado={consulta.ocupado}
          trabajoActivo={consulta.trabajoActivo}
          error={error}
          alCerrar={() => establecerPanel(null)}
          alOrdenar={(nuevo) =>
            establecerOrdenLocal({ version: viaje.version, orden: nuevo })
          }
          alOperarRuta={(accion, documento) => {
            void consulta.operarRuta(accion, documento).then((ok) => {
              if (ok) establecerOrdenLocal(null);
            });
          }}
          alDescargar={(parada, revision) =>
            establecerConfirmacion({
              accion: "descargar-pedido",
              documento: {
                version: revision.version,
                parada,
                pedido: revision.pedido,
                cargas_comprobadas: revision.obtenerComprobadas(),
              },
            })
          }
        />
      )}
      {confirmacion && (
        <ConfirmacionLogistica
          titulo={t(`confirmaciones.${confirmacion.accion}`)}
          descripcion={
            confirmacion.accion === "iniciar" && !ruta.plan
              ? t("inicioManual")
              : t(`ayudas.${confirmacion.accion}`)
          }
          accion={t(`acciones.${confirmacion.accion}`)}
          ocupado={consulta.ocupado}
          error={
            confirmacion.documento.version !== viaje.version
              ? t("errores.conflicto")
              : error
          }
          permitirReintento
          deshabilitado={
            consulta.incierto ||
            consulta.cargando ||
            !!consulta.error ||
            confirmacion.documento.version !== viaje.version
          }
          alCerrar={() => establecerConfirmacion(null)}
          alConfirmar={() => {
            void aceptar();
          }}
        >
          {confirmacion.accion === "iniciar" && ruta.plan && (
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
              {t("regresoAlmacen")}
            </p>
          )}
          {consulta.incierto && (
            <Button
              variant="outline"
              className="mt-4"
              disabled={consulta.ocupado}
              onClick={() => {
                void consulta.reintentar().then((ok) => {
                  if (ok) {
                    establecerConfirmacion(null);
                    establecerPanel(null);
                  }
                });
              }}
            >
              {t("comprobarResultado")}
            </Button>
          )}
        </ConfirmacionLogistica>
      )}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      {descartarOrden && (
        <ConfirmacionLogistica
          titulo={t("descartarOrden")}
          descripcion={t("descartarOrdenAyuda")}
          accion={t("descartar")}
          alCerrar={() => establecerDescartarOrden(false)}
          alConfirmar={() => {
            establecerOrdenLocal(null);
            establecerDescartarOrden(false);
            navegador.push("/mis-viajes");
          }}
        />
      )}
    </main>
  );
}
