"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/ui/button/Button";
import ConfirmacionLogistica from "@/components/logistica/ConfirmacionLogistica";
import ToastViewport from "@/components/ui/toast/ToastViewport";
import { useToast } from "@/hooks/useToast";
import type { Session } from "@/components/users/types";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import useHojaEntrega from "./useHojaEntrega";
import TablaRecepcionEntrega from "./TablaRecepcionEntrega";
import ConciliacionLotesEntrega from "./ConciliacionLotesEntrega";
import CabeceraRecepcionEntrega from "./CabeceraRecepcionEntrega";
import ComprobanteEntrega from "./ComprobanteEntrega";
import ResumenRecepcionEntrega from "./ResumenRecepcionEntrega";
import ErroresRecepcionEntrega from "./ErroresRecepcionEntrega";
import AccionesRecepcionEntrega from "./AccionesRecepcionEntrega";
import EtapasRecepcionEntrega from "./EtapasRecepcionEntrega";
import estilos from "./estilosEntregas.module.css";
import {
  diferenciaEntrega,
  lineaVacia,
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
      if (destino.pagina !== null) {
        establecerBuscar("");
        establecerPagina(destino.pagina);
      }
      establecerFocoPendiente(destino.campo);
    },
    [hoja],
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
  const volver = () => {
    if (ocupado) return;
    if (gestion.modificado || gestion.archivo || gestion.incierto)
      establecerConfirmacion("salir");
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
      <div className={panelEntrega}>
        <div className="flex flex-wrap items-end justify-between gap-4 p-5">
          <div>
            <h2
              tabIndex={-1}
              data-campo-entrega="lineas"
              className="text-lg font-semibold focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              {t("productosEntrega")}
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-gray-500 dark:text-gray-400">
              {t(editable ? "ayudaRecepcion" : "ayudaConsultaRecepcion")}
            </p>
          </div>
          <label className="relative block w-full sm:w-64">
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
        {actual?.datos && (
          <details className="border-t border-gray-100 px-5 py-3 text-sm dark:border-gray-800">
            <summary className="min-h-11 cursor-pointer content-center font-medium focus-visible:outline-2 focus-visible:outline-brand-500">
              {t("referenciaPedido")}
            </summary>
            <p className="my-2 text-xs text-gray-500 dark:text-gray-400">
              {t("referenciaAyuda")}
            </p>
            {actual.datos.results.map((producto) => (
              <p key={producto.producto} className="py-1">
                {producto.nombre} ·{" "}
                {t("cantidadesPedido", {
                  cajas: producto.pedido_cajas ?? 0,
                  unidades: producto.pedido_unidades ?? 0,
                })}
              </p>
            ))}
          </details>
        )}
        <ResumenRecepcionEntrega
          resumen={resumenPesosEntrega(hoja, gestion.lineas)}
          diferencia={diferenciaEntrega(hoja, gestion.lineas)}
        />
        {gestion.oficina &&
          (actual?.datos?.results ?? []).map((producto) => (
            <ConciliacionLotesEntrega
              key={producto.producto}
              ruta={gestion.ruta}
              producto={producto}
              linea={gestion.lineas[producto.producto] ?? lineaVacia()}
              aportes={gestion.aportes}
              bloqueado={bloqueado}
              soloLectura={!editable}
              alCambiar={gestion.cambiarAportes}
              error={errores["lotes_" + producto.producto]}
            />
          ))}
      </div>
      <ComprobanteEntrega
        ruta={gestion.ruta}
        existe={hoja.comprobante}
        archivo={gestion.archivo}
        soloLectura={!editable}
        bloqueado={bloqueado}
        alCambiar={gestion.cambiarArchivo}
        alError={(mensaje) => notify(mensaje, "error")}
      />
      <AccionesRecepcionEntrega
        hoja={hoja}
        permisos={permisos}
        progreso={progreso}
        editable={!!editable}
        oficina={gestion.oficina}
        ocupado={ocupado}
        incierto={gestion.incierto}
        modificado={!!(gestion.modificado || gestion.archivo)}
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
