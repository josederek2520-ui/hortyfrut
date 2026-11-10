"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { RefreshCw, Search } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import ConfirmacionLogistica from "@/components/logistica/ConfirmacionLogistica";
import ToastViewport from "@/components/ui/toast/ToastViewport";
import { useToast } from "@/hooks/useToast";
import { mostrarMedicion } from "@/components/entregas/calculosEntrega";
import type { Session } from "@/components/users/types";
import CabeceraDevolucion from "./CabeceraDevolucion";
import FilaDevolucion from "./FilaDevolucion";
import AccionesDevolucion from "./AccionesDevolucion";
import ErroresDevolucion from "./ErroresDevolucion";
import useGestionDevolucion from "./useGestionDevolucion";
import usePaginaDevoluciones from "./usePaginaDevoluciones";
import { totalPesoDevolucion } from "./calculosDevolucion";
import {
  panelDevolucion,
  entradaDevolucion,
  type AccionDevolucion,
  type AporteDevolucion,
} from "./tipos";

export default function HojaDevolucion({
  sesion,
  identificador,
  entregaInicial,
}: {
  sesion: Session;
  identificador?: number;
  entregaInicial?: number;
}) {
  const t = useTranslations("devoluciones"),
    idioma = useLocale(),
    navegador = useRouter();
  const gestion = useGestionDevolucion(identificador, entregaInicial);
  const { documento, ocupado, incierto, errores } = gestion;
  const permisos = sesion.permisos_devoluciones!;
  const editarRecepcion =
    (!documento || documento.estado === "borrador") &&
    (documento ? permisos.editar : permisos.crear);
  const editarRevision = documento?.estado === "recibida" && permisos.revisar;
  const mostrarOrigen =
    !documento || (documento.estado === "borrador" && editarRecepcion);
  const bloqueado = ocupado || incierto;
  const [pagina, establecerPagina] = useState(1),
    [buscar, establecerBuscar] = useState(""),
    [soloAnotados, establecerSoloAnotados] = useState(false);
  const [confirmacion, establecerConfirmacion] = useState<
    "salir" | "recibir" | "revisar" | "cancelar" | "cambiarEntrega" | null
  >(null);
  const [entregaPendiente, establecerEntregaPendiente] = useState<
      number | null
    >(null),
    [focoPendiente, establecerFocoPendiente] = useState<string | null>(null);
  const raiz = useRef<HTMLElement>(null),
    ultimaRevision = useRef(0);
  const { toasts, notify, dismiss } = useToast();
  const parametros = new URLSearchParams({
    buscar,
    pagina: String(pagina),
    ...(mostrarOrigen
      ? {
          entrega: String(gestion.entrega ?? ""),
          ...(soloAnotados
            ? {
                solo_anotados: "true",
                aportes: Object.keys(gestion.lineas).join(","),
              }
            : {}),
        }
      : {}),
  });
  const ruta = mostrarOrigen
    ? gestion.entrega
      ? "devoluciones/origen/?" + parametros
      : null
    : documento
      ? "devoluciones/" + documento.id + "/lineas/?" + parametros
      : null;
  const consulta = usePaginaDevoluciones<AporteDevolucion>(ruta, () =>
    establecerPagina(1),
  );
  const fuente = consulta.datos?.entrega;
  const {
    entrega: entregaSeleccionada,
    origen: origenSeleccionado,
    establecerOrigen,
  } = gestion;
  useEffect(() => {
    if (
      !fuente ||
      fuente.id !== entregaSeleccionada ||
      fuente.version === origenSeleccionado?.version
    )
      return;
    const reloj = setTimeout(() => establecerOrigen(fuente), 0);
    return () => clearTimeout(reloj);
  }, [
    fuente,
    entregaSeleccionada,
    origenSeleccionado?.version,
    establecerOrigen,
  ]);
  useEffect(() => {
    if (gestion.aviso) notify(t(gestion.aviso), "success");
  }, [gestion.aviso, notify, t]);
  const orden = mostrarOrigen
    ? consulta.datos?.orden_aportes
    : documento?.lineas.map((linea) => linea.aporte);
  const solicitarFoco = useCallback(
    (clave: string) => {
      const coincidencia = /^(\d+)_/.exec(clave);
      if (coincidencia) {
        const indice = orden?.indexOf(Number(coincidencia[1])) ?? -1;
        establecerBuscar("");
        establecerSoloAnotados(false);
        if (indice >= 0) establecerPagina(Math.floor(indice / 10) + 1);
      }
      establecerFocoPendiente(
        coincidencia ||
          [
            "entrega",
            "almacen",
            "fecha_recepcion",
            "motivo",
            "motivo_revision",
          ].includes(clave)
          ? clave
          : "lineas",
      );
    },
    [orden],
  );
  useEffect(() => {
    if (
      !Object.keys(errores).length ||
      ultimaRevision.current === gestion.revisionErrores
    )
      return;
    ultimaRevision.current = gestion.revisionErrores;
    const reloj = setTimeout(() => solicitarFoco(Object.keys(errores)[0]), 0);
    return () => clearTimeout(reloj);
  }, [errores, gestion.revisionErrores, solicitarFoco]);
  useEffect(() => {
    if (!focoPendiente) return;
    const reloj = setTimeout(() => {
      const objetivo = Array.from(
        raiz.current?.querySelectorAll<HTMLElement>(
          "[data-campo-devolucion]",
        ) ?? [],
      ).find(
        (elemento) =>
          elemento.dataset.campoDevolucion === focoPendiente &&
          elemento.getClientRects().length,
      );
      if (!objetivo) return;
      objetivo.scrollIntoView({ block: "center", behavior: "auto" });
      objetivo.focus({ preventScroll: true });
      establecerFocoPendiente(null);
    }, 0);
    return () => clearTimeout(reloj);
  }, [focoPendiente, consulta.datos, gestion.lineas]);
  const actuar = async (accion: AccionDevolucion) => {
    const resultado = await gestion.operar(accion);
    if (resultado && !identificador)
      navegador.replace("/devoluciones/" + resultado.id);
  };
  const volver = () => {
    if (ocupado) return;
    if (gestion.modificado || incierto) establecerConfirmacion("salir");
    else navegador.push("/devoluciones");
  };
  const cambiarEntrega = (valor: number) => {
    if (valor === gestion.entrega) return;
    if (Object.keys(gestion.lineas).length) {
      establecerEntregaPendiente(valor);
      establecerConfirmacion("cambiarEntrega");
    } else {
      gestion.cambiarEntrega(valor);
      establecerPagina(1);
      establecerBuscar("");
      establecerSoloAnotados(false);
    }
  };
  if (identificador && !documento)
    return (
      <div className={panelDevolucion + " space-y-4 p-6"}>
        <p role={gestion.fallo ? "alert" : "status"}>
          {t(gestion.fallo || "cargando")}
        </p>
        {gestion.fallo && (
          <Button variant="outline" onClick={gestion.reintentarConsulta}>
            {t("reintentar")}
          </Button>
        )}
      </div>
    );
  return (
    <section
      ref={raiz}
      className="space-y-5 pb-6 text-gray-900 dark:text-white"
    >
      <CabeceraDevolucion
        gestion={gestion}
        editarRecepcion={!!editarRecepcion}
        editarRevision={!!editarRevision}
        fechaMaxima={documento?.fecha_maxima || consulta.datos?.fecha_maxima}
        verEntrega={!!sesion.permisos_entregas?.ver}
        alVolver={volver}
        alEntrega={cambiarEntrega}
      />
      <ErroresDevolucion
        fallo={gestion.fallo}
        errores={errores}
        lineas={gestion.lineas}
        incierto={incierto}
        ocupado={ocupado}
        alElegir={solicitarFoco}
        alReintentar={() => void actuar("reintentar")}
      />
      <div className={panelDevolucion}>
        <div className="flex flex-wrap items-end justify-between gap-4 p-5">
          <div>
            <h2
              tabIndex={-1}
              data-campo-devolucion="lineas"
              className="text-lg font-semibold focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              {t(editarRevision ? "clasificacion" : "aportesRetorno")}
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t(editarRevision ? "ayudaRevision" : "ayudaRecepcion")}
            </p>
            <p className="mt-2 text-sm font-medium">
              {t("aportesAnotados", {
                total: Object.keys(gestion.lineas).length,
              })}
              <span className="ms-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                {t("todasPaginas")}
              </span>
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <label className="relative min-w-0 flex-1 sm:w-64">
              <span className="sr-only">{t("buscarAporte")}</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute start-3 top-3.5 size-4 text-gray-500"
              />
              <input
                type="search"
                autoComplete="off"
                className={entradaDevolucion + " ps-9"}
                maxLength={150}
                placeholder={t("buscarAporte")}
                value={buscar}
                onChange={(evento) => {
                  establecerBuscar(evento.target.value);
                  establecerPagina(1);
                }}
              />
            </label>
            <button
              type="button"
              disabled={!ruta || ocupado}
              aria-label={t("actualizarAportes")}
              className="control-suave-hortyfru inline-flex size-11 shrink-0 items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-brand-500"
              onClick={consulta.recargar}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        {mostrarOrigen && gestion.entrega && (
          <div className="px-5 pb-4">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={soloAnotados}
                disabled={ocupado}
                className="size-4 accent-brand-600"
                onChange={(evento) => {
                  establecerSoloAnotados(evento.target.checked);
                  establecerPagina(1);
                }}
              />
              {t("soloAnotados")}
            </label>
          </div>
        )}
        {!ruta ? (
          <p className="p-8 text-sm text-gray-500">
            {t("eligeEntregaPrimero")}
          </p>
        ) : consulta.fallo ? (
          <div role="alert" className="space-y-3 p-8">
            <p>{t("errorConsulta")}</p>
            <Button variant="outline" onClick={consulta.recargar}>
              {t("reintentar")}
            </Button>
          </div>
        ) : !consulta.datos ? (
          <p role="status" className="p-8">
            {t("cargando")}
          </p>
        ) : !consulta.datos.count ? (
          <p className="p-8 text-sm text-gray-500">{t("sinAportes")}</p>
        ) : (
          <>
            {consulta.datos.results.map((aporte) => (
              <FilaDevolucion
                key={aporte.id}
                aporte={aporte}
                linea={gestion.lineas[aporte.id]}
                registro={documento?.lineas.find(
                  (linea) => linea.aporte === aporte.id,
                )}
                modo={
                  editarRecepcion
                    ? "recepcion"
                    : editarRevision
                      ? "revision"
                      : "consulta"
                }
                recibida={
                  documento?.estado === "recibida" ||
                  documento?.estado === "revisada"
                }
                bloqueado={bloqueado}
                verLotes={!!sesion.permisos_inventario?.ver_lotes}
                errores={errores}
                alAgregar={() => {
                  gestion.agregar(aporte);
                  establecerFocoPendiente(aporte.id + "_cantidad_recibida");
                }}
                alQuitar={() => {
                  gestion.quitar(aporte.id);
                  establecerFocoPendiente("aporte_" + aporte.id);
                }}
                alCambiar={(campo, valor) =>
                  gestion.cambiarCampo(aporte.id, campo, valor)
                }
              />
            ))}
            {consulta.datos.count > 10 && (
              <PaginadorPedidos
                pagina={pagina}
                total={consulta.datos.count}
                alCambiar={establecerPagina}
                ocupado={ocupado}
              />
            )}
          </>
        )}
        <dl className="grid gap-4 border-t border-gray-100 bg-gray-50/50 p-5 sm:grid-cols-3 dark:border-gray-800 dark:bg-gray-800/40">
          {(
            [
              "peso_kg_recibido",
              "peso_kg_aprovechable",
              "peso_kg_merma",
            ] as const
          ).map((campo, indice) => (
            <div key={campo}>
              <dt className="text-xs text-gray-500 dark:text-gray-400">
                {t(
                  ["totalRecibido", "totalAprovechable", "totalMerma"][indice],
                )}
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums">
                {mostrarMedicion(
                  totalPesoDevolucion(gestion.lineas, campo),
                  idioma,
                )}{" "}
                kg
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {documento?.movimientos.length ? (
        <div className={panelDevolucion + " p-4"}>
          <h2 className="mb-2 text-sm font-semibold">
            {t("movimientosRegistrados")}
          </h2>
          <div className="flex flex-wrap gap-3">
            {documento.movimientos.map((movimiento) => (
              <span
                key={movimiento.id}
                className="text-xs text-gray-600 dark:text-gray-300"
              >
                {sesion.permisos_inventario?.ver_movimientos ? (
                  <button
                    type="button"
                    className="min-h-11 rounded px-2 text-brand-700 underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300"
                    onClick={() => {
                      if (gestion.modificado || incierto)
                        notify(t("guardarAntesConsultar"), "info");
                      else
                        navegador.push(
                          "/movimientos-inventario/" + movimiento.id,
                        );
                    }}
                  >
                    {movimiento.codigo}
                  </button>
                ) : (
                  movimiento.codigo
                )}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <AccionesDevolucion
        documento={documento}
        permisos={permisos}
        ocupado={ocupado}
        incierto={incierto}
        modificado={gestion.modificado}
        editarRecepcion={!!editarRecepcion}
        editarRevision={!!editarRevision}
        alVolver={volver}
        alGuardar={() => void actuar("guardar")}
        alRecibir={() => establecerConfirmacion("recibir")}
        alRevisar={() => establecerConfirmacion("revisar")}
        alCancelar={() => establecerConfirmacion("cancelar")}
      />
      {confirmacion && (
        <ConfirmacionLogistica
          titulo={t("confirmaciones." + confirmacion + ".titulo")}
          descripcion={t("confirmaciones." + confirmacion + ".ayuda")}
          accion={t("confirmaciones." + confirmacion + ".accion")}
          ocupado={ocupado}
          alCerrar={() => {
            if (!ocupado) establecerConfirmacion(null);
          }}
          alConfirmar={() => {
            const accion = confirmacion;
            establecerConfirmacion(null);
            if (accion === "salir") navegador.push("/devoluciones");
            else if (accion === "cambiarEntrega" && entregaPendiente) {
              gestion.cambiarEntrega(entregaPendiente);
              establecerPagina(1);
              establecerBuscar("");
              establecerSoloAnotados(false);
              establecerEntregaPendiente(null);
            } else if (
              accion === "recibir" ||
              accion === "revisar" ||
              accion === "cancelar"
            )
              void actuar(accion);
          }}
        />
      )}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </section>
  );
}
