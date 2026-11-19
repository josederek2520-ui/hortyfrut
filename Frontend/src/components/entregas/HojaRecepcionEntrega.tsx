"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, Layers, Search } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/ui/button/Button";
import ConfirmacionLogistica from "@/components/logistica/ConfirmacionLogistica";
import ToastViewport from "@/components/ui/toast/ToastViewport";
import { useToast } from "@/hooks/useToast";
import { useModal } from "@/hooks/useModal";
import type { Session } from "@/components/users/types";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import useHojaEntrega from "./useHojaEntrega";
import TablaRecepcionEntrega from "./TablaRecepcionEntrega";
import PanelRecepcionEntrega, {
  type TipoPanelEntrega,
} from "./PanelRecepcionEntrega";
import CabeceraRecepcionEntrega from "./CabeceraRecepcionEntrega";
import ResumenRecepcionEntrega from "./ResumenRecepcionEntrega";
import ErroresRecepcionEntrega from "./ErroresRecepcionEntrega";
import AccionesRecepcionEntrega from "./AccionesRecepcionEntrega";
import EtapasRecepcionEntrega from "./EtapasRecepcionEntrega";
import estilos from "./estilosEntregas.module.css";
import {
  diferenciaEntrega,
  pendientesConciliacionEntrega,
  progresoRecepcionEntrega,
  resumenPesosEntrega,
  destinoErrorEntrega,
} from "./calculosEntrega";
import {
  panelEntrega,
  entradaEntrega,
  type ProductoEntrega,
  type PaginaEntrega,
} from "./tipos";

export default function HojaRecepcionEntrega({
  sesion,
  despacho,
  pedido,
}: {
  sesion: Session;
  despacho: number;
  pedido: number;
}) {
  const t = useTranslations("entregas"),
    tDevoluciones = useTranslations("devoluciones"),
    navegador = useRouter();
  const gestion = useHojaEntrega(despacho, pedido, sesion);
  const { hoja, ocupado, errores, aviso } = gestion;
  const { toasts, notify, dismiss } = useToast();
  const {
    isOpen: panelAbierto,
    openModal: abrirPanel,
    closeModal: cerrarPanel,
  } = useModal();
  const [tipoPanel, establecerTipoPanel] = useState<TipoPanelEntrega>("pedido");
  const [productoPanel, establecerProductoPanel] = useState<number | null>(
    null,
  );
  const [pagina, establecerPagina] = useState(1),
    [buscar, establecerBuscar] = useState(""),
    [revision, establecerRevision] = useState(0);
  const [consulta, establecerConsulta] = useState<{
    clave: string;
    datos?: PaginaEntrega<ProductoEntrega>;
    fallo?: boolean;
  } | null>(null);
  const [confirmacion, establecerConfirmacion] = useState<
    "salir" | "confirmar" | "devolver" | null
  >(null);
  const [focoPendiente, establecerFocoPendiente] = useState<string | null>(
    null,
  );
  const raiz = useRef<HTMLElement>(null),
    ultimaRevision = useRef(0);
  const clave =
    gestion.ruta +
    "productos/?" +
    new URLSearchParams({ buscar, pagina: String(pagina) });
  const actual = consulta?.clave === clave ? consulta : null;
  useEffect(() => {
    if (!sesion.permisos_entregas?.ver) return;
    const controlador = new AbortController();
    const reloj = setTimeout(() => {
      void api<PaginaEntrega<ProductoEntrega>>(clave, {
        signal: controlador.signal,
      })
        .then((datos) => {
          if (!controlador.signal.aborted) establecerConsulta({ clave, datos });
        })
        .catch((error) => {
          if (controlador.signal.aborted) return;
          if (error instanceof ApiError && error.status === 404 && pagina > 1) {
            establecerPagina(1);
            return;
          }
          establecerConsulta({ clave, fallo: true });
        });
    }, 150);
    return () => {
      clearTimeout(reloj);
      controlador.abort();
    };
  }, [clave, revision, pagina, sesion.permisos_entregas?.ver]);
  useEffect(() => {
    if (aviso) notify(t(aviso), "success");
  }, [aviso, notify, t]);
  const solicitarFoco = useCallback(
    (campo: string) => {
      if (!hoja) return;
      const destino = destinoErrorEntrega(hoja, campo);
      const lotes = /^lotes_(\d+)$/.exec(destino.campo);
      if (lotes && gestion.oficina) {
        establecerProductoPanel(Number(lotes[1]));
        establecerTipoPanel("lotes");
        establecerFocoPendiente(null);
        abrirPanel();
        return;
      }
      cerrarPanel();
      if (destino.pagina !== null) {
        establecerBuscar("");
        establecerPagina(destino.pagina);
      }
      establecerFocoPendiente(destino.campo);
    },
    [hoja, gestion.oficina, abrirPanel, cerrarPanel],
  );
  useEffect(() => {
    if (
      !Object.keys(errores).length ||
      ultimaRevision.current === gestion.revisionErrores
    )
      return;
    ultimaRevision.current = gestion.revisionErrores;
    const temporizador = setTimeout(
      () => solicitarFoco(Object.keys(errores)[0]),
      0,
    );
    return () => clearTimeout(temporizador);
  }, [errores, gestion.revisionErrores, solicitarFoco]);
  useEffect(() => {
    if (!focoPendiente) return;
    const temporizador = setTimeout(() => {
      const objetivo = Array.from(
        raiz.current?.querySelectorAll<HTMLElement>("[data-campo-entrega]") ??
          [],
      ).find(
        (elemento) =>
          elemento.dataset.campoEntrega === focoPendiente &&
          elemento.getClientRects().length,
      );
      if (!objetivo) return;
      objetivo.scrollIntoView({ block: "center", behavior: "auto" });
      objetivo.focus({ preventScroll: true });
      establecerFocoPendiente(null);
    }, 0);
    return () => clearTimeout(temporizador);
  }, [focoPendiente, actual, errores]);
  if (!sesion.permisos_entregas?.ver)
    return <p role="alert">{t("sinPermiso")}</p>;
  if (!hoja)
    return (
      <div className={panelEntrega + " space-y-4 p-6"}>
        <p role={gestion.fallo ? "alert" : "status"}>
          {t(gestion.fallo || "cargando")}
        </p>
        {gestion.fallo && (
          <Button variant="outline" onClick={gestion.reintentarConsulta}>
            {t("reintentarConsulta")}
          </Button>
        )}
      </div>
    );
  const permisos = sesion.permisos_entregas;
  const editable =
    hoja.estado !== "confirmada" &&
    (hoja.estado !== "revision" || gestion.oficina) &&
    (hoja.id
      ? (hoja.acciones?.editar ?? permisos.editar)
      : (hoja.acciones?.registrar ?? permisos.crear));
  const bloqueado = !editable || ocupado || gestion.incierto;
  const progreso = progresoRecepcionEntrega(hoja, gestion.lineas);
  const pendientesLotes = pendientesConciliacionEntrega(
    hoja.origen.productos,
    gestion.lineas,
    gestion.aportes,
  );
  const abrirConciliacion = () => {
    if (
      !hoja.origen.productos.some(
        (producto) => producto.producto === productoPanel,
      )
    )
      establecerProductoPanel(
        (pendientesLotes[0] ?? hoja.origen.productos[0])?.producto ?? null,
      );
    establecerTipoPanel("lotes");
    abrirPanel();
  };
  const volver = () => {
    if (ocupado) return;
    if (gestion.modificado || gestion.incierto) establecerConfirmacion("salir");
    else navegador.push("/entregas");
  };
  return (
    <section
      ref={raiz}
      className={`${estilos.entregas} space-y-5 pb-6 text-gray-900 dark:text-white`}
    >
      <CabeceraRecepcionEntrega
        hoja={hoja}
        fecha={gestion.fecha}
        recibidoPor={gestion.recibidoPor}
        editable={!!editable}
        bloqueado={bloqueado}
        ocupado={ocupado}
        errores={errores}
        volver={volver}
        alFecha={gestion.cambiarFecha}
        registradoPor={sesion.user?.nombre_completo}
      />
      <EtapasRecepcionEntrega estado={hoja.estado} oficina={gestion.oficina} />
      {hoja.estado === "confirmada" &&
        !sesion.acceso_publico &&
        sesion.permisos_devoluciones?.ver && (
          <div className="flex flex-wrap gap-3">
            {sesion.permisos_devoluciones.crear && (
              <Link
                href={"/devoluciones/nueva?entrega=" + hoja.id}
                className="boton-principal-hortyfru inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                {tDevoluciones("registrarDesdeEntrega")}
              </Link>
            )}
            <Link
              href={"/devoluciones?entrega=" + hoja.id}
              className="boton-secundario-hortyfru inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              {tDevoluciones("verDesdeEntrega")}
            </Link>
          </div>
        )}
      <ErroresRecepcionEntrega
        fallo={gestion.fallo}
        errores={errores}
        productos={hoja.origen.productos}
        incierto={gestion.incierto}
        ocupado={ocupado}
        alElegir={solicitarFoco}
        alReintentar={() => void gestion.operar("reintentar")}
      />
      <div className={panelEntrega + " @container"}>
        <div className="flex flex-wrap items-center gap-2 p-4 sm:p-5 @4xl:flex-nowrap @4xl:gap-3">
          <h2
            tabIndex={-1}
            data-campo-entrega="lineas"
            className="w-full shrink-0 text-lg font-semibold focus-visible:outline-2 focus-visible:outline-brand-500 @4xl:w-auto"
          >
            {t("productosEntrega")}
          </h2>
          <Button
            size="sm"
            variant="outline"
            disabled={ocupado}
            className="shrink-0 whitespace-nowrap"
            startIcon={<FileText className="size-4" />}
            aria-haspopup="dialog"
            aria-controls="panel-recepcion-contenido"
            aria-expanded={panelAbierto && tipoPanel === "pedido"}
            onClick={() => {
              establecerTipoPanel("pedido");
              abrirPanel();
            }}
          >
            {t("verPedido")}
          </Button>
          {gestion.oficina && (
            <Button
              size="sm"
              variant="outline"
              disabled={ocupado || !hoja.origen.productos.length}
              className="max-w-full min-w-0 @4xl:shrink-0 @4xl:whitespace-nowrap"
              startIcon={<Layers className="size-4" />}
              aria-haspopup="dialog"
              aria-controls="panel-recepcion-contenido"
              aria-expanded={panelAbierto && tipoPanel === "lotes"}
              onClick={abrirConciliacion}
            >
              {t("conciliarLotes")}
              {!!pendientesLotes.length && editable && (
                <span className="rounded-full bg-warning-100 px-2 py-0.5 text-theme-xs whitespace-nowrap text-warning-800 dark:bg-warning-950 dark:text-warning-200">
                  {t("productosPendientesLotes", {
                    total: pendientesLotes.length,
                  })}
                </span>
              )}
            </Button>
          )}
          <label className="relative block w-full min-w-0 @4xl:ms-auto @4xl:w-auto @4xl:max-w-64 @4xl:min-w-40 @4xl:flex-1">
            <span className="sr-only">{t("buscarProducto")}</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-3.5 size-4 text-gray-500"
            />
            <input
              type="search"
              name="filtro_productos_entrega"
              autoComplete="off"
              className={entradaEntrega + " ps-10"}
              placeholder={t("buscarProducto")}
              value={buscar}
              onChange={(evento) => {
                establecerBuscar(evento.target.value);
                establecerPagina(1);
              }}
            />
          </label>
        </div>
        {!actual ? (
          <p role="status" className="p-8">
            {t("cargando")}
          </p>
        ) : actual.fallo ? (
          <div role="alert" className="space-y-3 p-8">
            <p>{t("errorConsulta")}</p>
            <Button
              variant="outline"
              onClick={() => {
                establecerConsulta(null);
                establecerRevision((valor) => valor + 1);
              }}
            >
              {t("reintentarConsulta")}
            </Button>
          </div>
        ) : !actual.datos?.count ? (
          <p className="p-8">{t("sinProductos")}</p>
        ) : (
          <>
            <TablaRecepcionEntrega
              productos={actual.datos.results}
              lineas={gestion.lineas}
              errores={errores}
              bloqueado={bloqueado}
              soloLectura={!editable}
              alCambiar={gestion.cambiarCampo}
            />
            {actual.datos.count > 10 && (
              <PaginadorPedidos
                pagina={pagina}
                total={actual.datos.count}
                alCambiar={establecerPagina}
                ocupado={ocupado}
              />
            )}
          </>
        )}
        <ResumenRecepcionEntrega
          resumen={resumenPesosEntrega(hoja, gestion.lineas)}
          diferencia={diferenciaEntrega(hoja, gestion.lineas)}
        />
      </div>
      <PanelRecepcionEntrega
        abierto={panelAbierto}
        tipo={tipoPanel}
        productoElegido={productoPanel}
        ruta={gestion.ruta}
        hoja={hoja}
        lineas={gestion.lineas}
        aportes={gestion.aportes}
        oficina={gestion.oficina}
        soloLectura={!editable}
        bloqueado={bloqueado}
        errores={errores}
        alProducto={establecerProductoPanel}
        alCambiarAportes={gestion.cambiarAportes}
        alCerrar={cerrarPanel}
      />
      <AccionesRecepcionEntrega
        hoja={hoja}
        permisos={permisos}
        progreso={progreso}
        editable={!!editable}
        oficina={gestion.oficina}
        ocupado={ocupado}
        incierto={gestion.incierto}
        modificado={gestion.modificado}
        alSalir={volver}
        alGuardar={() => void gestion.operar("guardar")}
        alEnviar={() => void gestion.operar("enviar")}
        alConfirmar={() => establecerConfirmacion("confirmar")}
        alDevolver={() => establecerConfirmacion("devolver")}
      />
      {confirmacion && (
        <ConfirmacionLogistica
          titulo={t(
            confirmacion === "salir"
              ? "descartarTitulo"
              : confirmacion === "confirmar"
                ? "confirmar"
                : "devolver",
          )}
          descripcion={t(
            confirmacion === "salir"
              ? "descartarAyuda"
              : confirmacion === "confirmar"
                ? "confirmarAyuda"
                : "devolverAyuda",
          )}
          accion={t(
            confirmacion === "salir"
              ? "descartar"
              : confirmacion === "confirmar"
                ? "confirmar"
                : "devolver",
          )}
          ocupado={ocupado}
          alCerrar={() => {
            if (!ocupado) establecerConfirmacion(null);
          }}
          alConfirmar={() => {
            if (confirmacion === "salir") navegador.push("/entregas");
            else {
              void gestion.operar(confirmacion);
              establecerConfirmacion(null);
            }
          }}
        />
      )}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </section>
  );
}
