"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search as IconoBuscar } from "lucide-react";
import Paginador from "@/components/compras/PaginadorCompras";
import CampoFecha from "@/components/form/CampoFecha";
import EstadoConsulta from "@/components/logistica/EstadoConsultaLogistica";
import useConsulta from "./useConsultaListadoDespachos";
import {
  claseEntrada,
  type PaginaLogistica,
} from "@/components/logistica/tipos";
import { api } from "@/lib/api";
import FilaDestino from "./FilaDestinoCargaDespacho";
import {
  agruparCargaDestinos,
  cargaDelDestino,
  cargarDestinoCompleto,
  ErrorSeleccionDestino,
  type PaginaCargaDestino,
} from "./seleccionDestinosDespacho";
import type { CargaPreparada, DestinoCargaDespacho } from "./tipos";

export default function SeleccionCargaDespacho({
  almacen,
  despacho,
  seleccionadas,
  alCambiar,
  alError,
  deshabilitado = false,
  alCargando,
  fechaPedidosInicial = "",
  alFechaPedidos,
}: {
  fechaPedidosInicial?: string;
  alFechaPedidos?: (fecha: string) => void;
  almacen: number;
  despacho?: number;
  seleccionadas: CargaPreparada[];
  alCambiar: (filas: CargaPreparada[]) => void;
  alError: (error: unknown) => void;
  deshabilitado?: boolean;
  alCargando?: (cargando: boolean) => void;
}) {
  const t = useTranslations("despachos");
  const [buscar, establecerBuscar] = useState("");
  const [fecha, establecerFecha] = useState(fechaPedidosInicial);
  const [pagina, establecerPagina] = useState(1);
  const [soloElegidas, establecerSoloElegidas] = useState(false);
  const [seleccionando, establecerSeleccionando] = useState<number | null>(
    null,
  );
  const [fallo, establecerFallo] = useState("");
  const control = useRef<AbortController | null>(null);
  const parametros = new URLSearchParams({
    almacen: String(almacen),
    pagina: String(pagina),
    buscar,
    ...(fecha ? { fecha } : {}),
    ...(despacho ? { despacho: String(despacho) } : {}),
  });
  const consulta = useConsulta<PaginaLogistica<DestinoCargaDespacho>>(
    soloElegidas ? null : "despachos/destinos-disponibles/?" + parametros,
    alError,
  );
  useEffect(
    () => () => {
      control.current?.abort();
      control.current = null;
      alCargando?.(false);
    },
    [almacen, despacho, alCargando],
  );
  const cancelar = () => {
    control.current?.abort();
    control.current = null;
    establecerSeleccionando(null);
    alCargando?.(false);
  };
  const elegidasFiltradas = seleccionadas.filter(
    (fila) =>
      (!fecha || fila.fecha_requerida === fecha) &&
      (fila.cliente_nombre + " " + fila.sucursal_nombre)
        .toLocaleLowerCase()
        .includes(buscar.toLocaleLowerCase()),
  );
  const gruposElegidos = agruparCargaDestinos(elegidasFiltradas);
  const total = soloElegidas
    ? gruposElegidos.length
    : consulta.datos?.count || 0;
  const paginaActual = soloElegidas
    ? Math.min(pagina, Math.max(1, Math.ceil(total / 10)))
    : pagina;
  const filas = soloElegidas
    ? gruposElegidos.slice((paginaActual - 1) * 10, paginaActual * 10)
    : consulta.datos?.results || [];
  const bloqueado = deshabilitado || seleccionando !== null;
  const rutaDestino = (sucursal: number, pedido?: number) =>
    "despachos/disponibles/?" +
    new URLSearchParams({
      almacen: String(almacen),
      sucursal: String(sucursal),
      ...(pedido ? { pedido: String(pedido) } : {}),
      ...(fecha ? { fecha } : {}),
      ...(despacho ? { despacho: String(despacho) } : {}),
    });
  const alternarProducto = (fila: CargaPreparada) => {
    if (bloqueado) return;
    establecerFallo("");
    if (seleccionadas.some((actual) => actual.id === fila.id))
      alCambiar(seleccionadas.filter((actual) => actual.id !== fila.id));
    else if (seleccionadas.length >= 1000)
      establecerFallo(t("limiteCargaDestino"));
    else alCambiar([...seleccionadas, fila]);
  };
  const alternarDestino = async (
    destino: Pick<DestinoCargaDespacho, "sucursal" | "asignaciones"> & {
      pedido?: number;
    },
  ) => {
    if (bloqueado) return;
    establecerFallo("");
    const elegidas = cargaDelDestino(
      seleccionadas,
      destino.sucursal,
      fecha,
      destino.pedido,
    );
    if (elegidas.length === destino.asignaciones && elegidas.length > 0) {
      alCambiar(
        seleccionadas.filter(
          (fila) =>
            !(
              fila.sucursal === destino.sucursal &&
              (!fecha || fila.fecha_requerida === fecha) &&
              (!destino.pedido || fila.pedido === destino.pedido)
            ),
        ),
      );
      return;
    }
    const solicitud = new AbortController();
    control.current = solicitud;
    establecerSeleccionando(destino.sucursal);
    alCargando?.(true);
    try {
      const parametrosDestino = new URLSearchParams(
        rutaDestino(destino.sucursal, destino.pedido).split("?")[1],
      );
      const recibidas = await cargarDestinoCompleto(
        parametrosDestino,
        (ruta, signal) => api<PaginaCargaDestino>(ruta, { signal }),
        solicitud.signal,
      );
      if (!recibidas || solicitud.signal.aborted) return;
      if (!recibidas.length || recibidas.length !== destino.asignaciones)
        throw new ErrorSeleccionDestino("cambio");
      const unidas = new Map(seleccionadas.map((fila) => [fila.id, fila]));
      recibidas.forEach((fila) => unidas.set(fila.id, fila));
      if (unidas.size > 1000) throw new ErrorSeleccionDestino("limite");
      alCambiar([...unidas.values()]);
    } catch (error) {
      if (solicitud.signal.aborted) return;
      establecerFallo(
        t(
          error instanceof ErrorSeleccionDestino && error.codigo === "limite"
            ? "limiteCargaDestino"
            : "cargaCambioDestino",
        ),
      );
      consulta.recargar();
      if (!(error instanceof ErrorSeleccionDestino)) alError(error);
    } finally {
      if (control.current === solicitud) {
        control.current = null;
        establecerSeleccionando(null);
        alCargando?.(false);
      }
    }
  };
  const pedidosFueraFecha = fecha
    ? new Set(
        seleccionadas
          .filter((fila) => fila.fecha_requerida !== fecha)
          .map((fila) => fila.pedido),
      ).size
    : 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label={t("vistaDestinosCarga")}
          className="inline-flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
        >
          {[false, true].map((valor) => (
            <button
              key={String(valor)}
              type="button"
              aria-pressed={soloElegidas === valor}
              disabled={seleccionando !== null}
              onClick={() => {
                establecerSoloElegidas(valor);
                establecerPagina(1);
              }}
              className={
                "min-h-11 rounded-lg px-3 text-sm " +
                (soloElegidas === valor
                  ? "pestana-hortyfru font-medium"
                  : "text-gray-600 dark:text-gray-300")
              }
            >
              {t(valor ? "destinosEnEsteViaje" : "destinosDisponiblesCarga")}
              {valor
                ? " (" + agruparCargaDestinos(seleccionadas).length + ")"
                : ""}
            </button>
          ))}
        </div>
        {seleccionando !== null && (
          <button
            type="button"
            onClick={cancelar}
            className="min-h-11 rounded-lg px-3 text-sm font-medium text-gray-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-300"
          >
            {t("cancelarSeleccionDestino")}
          </button>
        )}
      </div>
      <div className="grid items-end gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label htmlFor="buscar-destino-carga" className="sr-only">
            {t("buscarDestinoCarga")}
          </label>
          <div className="relative">
            <IconoBuscar
              className="pointer-events-none absolute start-3 top-3.5 size-4 text-gray-400"
              aria-hidden="true"
            />
            <input
              id="buscar-destino-carga"
              className={claseEntrada + " ps-10"}
              value={buscar}
              maxLength={150}
              aria-label={t("buscarDestinoCarga")}
              placeholder={t("buscarDestinoCarga")}
              onChange={(evento) => {
                cancelar();
                establecerBuscar(evento.target.value);
                establecerPagina(1);
              }}
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="fecha-carga-despacho"
            className="mb-1.5 block text-theme-xs font-medium text-gray-600 dark:text-gray-300"
          >
            {t("fechaRequerida")}
          </label>
          <CampoFecha
            id="fecha-carga-despacho"
            value={fecha}
            placeholder={t("fechaRequerida")}
            aria-label={t("fechaRequerida")}
            alCambiar={(valor) => {
              cancelar();
              establecerFecha(valor);
              alFechaPedidos?.(valor);
              establecerPagina(1);
            }}
          />
        </div>
      </div>
      {pedidosFueraFecha > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-orange-50 px-3 py-2 text-theme-xs text-orange-800 dark:bg-orange-500/10 dark:text-orange-200"
        >
          <p>{t("pedidosFueraFechaCarga", { cantidad: pedidosFueraFecha })}</p>
          <button
            type="button"
            className="min-h-11 rounded-lg px-2 font-semibold focus-visible:ring-2 focus-visible:ring-brand-400"
            onClick={() => {
              cancelar();
              establecerSoloElegidas(true);
              establecerFecha("");
              alFechaPedidos?.("");
              establecerBuscar("");
              establecerPagina(1);
            }}
          >
            {t("verTodaCargaElegida")}
          </button>
        </div>
      )}
      {fallo && (
        <p
          role="alert"
          className="rounded-xl bg-error-50 p-3 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400"
        >
          {fallo}
        </p>
      )}
      {!soloElegidas && (consulta.cargando || consulta.fallo) ? (
        <EstadoConsulta
          cargando={consulta.cargando}
          fallo={consulta.fallo}
          alRecargar={() => {
            establecerPagina(1);
            consulta.recargar();
          }}
        />
      ) : !filas.length ? (
        <p
          role="status"
          className="rounded-xl bg-gray-50 p-5 text-sm text-gray-600 dark:bg-gray-800/40 dark:text-gray-300"
        >
          {t(soloElegidas ? "sinDestinosElegidos" : "sinDestinosDisponibles")}
        </p>
      ) : (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
          {filas.map((destino) => (
            <FilaDestino
              key={destino.sucursal}
              destino={destino}
              elegidas={cargaDelDestino(seleccionadas, destino.sucursal, fecha)}
              seleccionadas={seleccionadas}
              cargando={seleccionando === destino.sucursal}
              bloqueado={bloqueado}
              soloElegidas={soloElegidas}
              rutaDetalle={rutaDestino(destino.sucursal)}
              alSeleccionar={() => void alternarDestino(destino)}
              alSeleccionarPedido={(pedido) =>
                void alternarDestino({
                  sucursal: destino.sucursal,
                  pedido: pedido.pedido,
                  asignaciones: pedido.asignaciones,
                })
              }
              alAlternar={alternarProducto}
              alError={alError}
            />
          ))}
        </div>
      )}
      {total > 10 && (
        <Paginador
          pagina={paginaActual}
          total={total}
          ocupado={bloqueado || consulta.cargando}
          alCambiar={establecerPagina}
        />
      )}
    </div>
  );
}
