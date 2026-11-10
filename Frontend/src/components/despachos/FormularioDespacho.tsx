"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft as IconoVolver,
  ArrowRight as IconoSiguiente,
  ShieldCheck as IconoInventario,
  PencilLine as IconoAjustar,
  RotateCcw as IconoRestablecer,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import Confirmacion from "@/components/logistica/ConfirmacionLogistica";
import { clasePanel, type OpcionLogistica } from "@/components/logistica/tipos";
import { api, ApiError as ErrorApi } from "@/lib/api";
import SeleccionCarga from "./SeleccionCargaDespacho";
import ParadasFormulario from "./ParadasFormularioDespacho";
import AccionesDespacho from "./AccionesDespacho";
import ResumenFormulario, {
  CapacidadFormularioDespacho,
  ContextoResumenFormularioDespacho,
} from "./ResumenFormularioDespacho";
import OrigenCarga from "./OrigenCargaDespacho";
import TransporteFormulario from "./TransporteFormularioDespacho";
import PasosFormularioDespacho from "./PasosFormularioDespacho";
import {
  erroresTransporteDespacho,
  nombresPasosDespacho,
  pasoErrorDespacho,
} from "./navegacionFormularioDespacho";
import estilos from "./estilosFormulario.module.css";
import {
  cajillasEfectivasDespacho,
  conservarCajillasManuales,
  preverCajillasCarga,
  usaCajillasAutomaticas,
} from "./cajillasPreparadasDespacho";
import type {
  CargaPreparada,
  CajillaCarga,
  DetalleDespacho,
  PermisosDespachos,
} from "./tipos";

export default function FormularioDespacho({
  despacho,
  permisos,
  alError,
}: {
  despacho?: DetalleDespacho;
  permisos: PermisosDespachos;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("despachos");
  const comun = useTranslations("logistica");
  const navegador = useRouter();
  const [documento, establecerDocumento] = useState(despacho);
  const [almacen, establecerAlmacen] = useState<OpcionLogistica | null>(
    despacho ? { id: despacho.almacen, nombre: despacho.almacen_nombre } : null,
  );
  const [vehiculo, establecerVehiculo] = useState<OpcionLogistica | null>(
    despacho
      ? {
          id: despacho.vehiculo,
          nombre: despacho.vehiculo_placa,
          capacidad_kg: despacho.vehiculo_capacidad_kg,
        }
      : null,
  );
  const [chofer, establecerChofer] = useState<OpcionLogistica | null>(
    despacho ? { id: despacho.chofer, nombre: despacho.chofer_nombre } : null,
  );
  const [fecha, establecerFecha] = useState(
    despacho?.fecha_reparto ||
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/La_Paz",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
  );
  const observaciones = documento?.observaciones ?? "";
  const [cargas, establecerCargas] = useState<CargaPreparada[]>(
    despacho?.cargas.map((fila) => ({
      ...fila,
      id: fila.asignacion!,
      direccion: despacho.paradas.find(
        (parada) => parada.sucursal === fila.sucursal,
      )?.direccion,
    })) || [],
  );
  const [orden, establecerOrden] = useState<number[]>(
    despacho?.paradas.map((fila) => fila.sucursal) || [],
  );
  const [cajillas, establecerCajillas] = useState<CajillaCarga[]>(
    despacho ? cajillasEfectivasDespacho(despacho) : [],
  );
  const [cajillasAutomaticas, establecerCajillasAutomaticas] = useState(() =>
    usaCajillasAutomaticas(despacho),
  );
  const [fechaPedidos, establecerFechaPedidos] = useState("");
  const [paso, establecerPaso] = useState(0);
  const [visitado, establecerVisitado] = useState(0);
  const [modificado, establecerModificado] = useState(false);
  const [cargandoCarga, establecerCargandoCarga] = useState(false);
  const [guardando, establecerGuardando] = useState(false);
  const [errores, establecerErrores] = useState<Record<string, string[]>>({});
  const [fallo, establecerFallo] = useState("");
  const [conflicto, establecerConflicto] = useState(false);
  const [salir, establecerSalir] = useState(false);
  const [cambioAlmacen, establecerCambioAlmacen] =
    useState<OpcionLogistica | null>(null);
  const [clave] = useState(() => crypto.randomUUID());
  const referencia = useRef<HTMLDivElement>(null);
  const enviando = useRef(false);
  const bloqueado =
    guardando ||
    cargandoCarga ||
    conflicto ||
    (!!documento && !permisos.editar);
  const puedeGuardar = documento ? permisos.editar : permisos.crear;
  const volverAlListado = () =>
    modificado ? establecerSalir(true) : navegador.push("/despachos");
  const cambiarModoCajillas = () => {
    if (bloqueado) return;
    if (!cajillasAutomaticas) establecerCajillas(preverCajillasCarga(cargas));
    establecerCajillasAutomaticas(!cajillasAutomaticas);
    cambiar();
  };
  const mostrarPaso = (destino: number, enfocarError = false) => {
    establecerPaso(destino);
    establecerVisitado((anterior) => Math.max(anterior, destino));
    requestAnimationFrame(() => {
      const control = enfocarError
        ? referencia.current?.querySelector<HTMLElement>(
            '[aria-invalid="true"], [data-invalido="true"]',
          ) ||
          referencia.current?.querySelector<HTMLElement>(
            "[data-alerta-despacho]",
          )
        : referencia.current?.querySelector<HTMLElement>(
            "#titulo-paso-despacho",
          );
      control?.focus({ preventScroll: true });
      control?.scrollIntoView({
        behavior: "instant",
        block: enfocarError ? "center" : "start",
      });
    });
  };
  useEffect(() => {
    const proteger = (evento: BeforeUnloadEvent) => {
      if (modificado) evento.preventDefault();
    };
    window.addEventListener("beforeunload", proteger);
    return () => window.removeEventListener("beforeunload", proteger);
  }, [modificado]);
  const cambiar = () => {
    establecerModificado(true);
    establecerErrores({});
    establecerFallo("");
  };
  const cambiarCarga = (filas: CargaPreparada[]) => {
    const destinos = [...new Set(filas.map((fila) => fila.sucursal))];
    establecerOrden([
      ...orden.filter((id) => destinos.includes(id)),
      ...destinos.filter((id) => !orden.includes(id)),
    ]);
    establecerCargas(filas);
    establecerCajillas(
      cajillasAutomaticas
        ? preverCajillasCarga(filas)
        : conservarCajillasManuales(cargas, filas, cajillas),
    );
    cambiar();
  };
  const problemasTransporte = erroresTransporteDespacho(
    { almacen, vehiculo, chofer, fecha, observaciones },
    comun("requerido"),
    t("fechaInvalidaFormulario"),
  );
  const transporteValido = !Object.keys(problemasTransporte).length;
  const origenValido =
    !problemasTransporte.almacen && !problemasTransporte.fecha_reparto;
  const cambiarTransporte = (
    cambios: Partial<
      import("./TransporteFormularioDespacho").DatosTransporteDespacho
    >,
  ) => {
    if (cambios.almacen) {
      if (almacen && cambios.almacen.id !== almacen.id && cargas.length) {
        establecerCambioAlmacen(cambios.almacen);
        return;
      }
      establecerAlmacen(cambios.almacen);
      if (cambios.almacen.id !== almacen?.id) {
        establecerCajillasAutomaticas(true);
        establecerCajillas([]);
      }
    }
    if (cambios.vehiculo) establecerVehiculo(cambios.vehiculo);
    if (cambios.chofer) establecerChofer(cambios.chofer);
    if (cambios.fecha !== undefined) establecerFecha(cambios.fecha);
    cambiar();
  };
  const avanzar = () => {
    if (guardando || cargandoCarga || conflicto) return;
    if (!origenValido || !cargas.length) {
      establecerErrores(
        Object.fromEntries(
          Object.entries(problemasTransporte).filter(([campo]) =>
            ["almacen", "fecha_reparto"].includes(campo),
          ),
        ),
      );
      establecerFallo(!origenValido ? comun("validacion") : t("elegirCarga"));
      mostrarPaso(0, true);
      return;
    }
    establecerErrores({});
    establecerFallo("");
    mostrarPaso(1);
  };
  const guardar = async (revisar = false) => {
    if (
      enviando.current ||
      guardando ||
      cargandoCarga ||
      conflicto ||
      (!puedeGuardar && (!documento || modificado))
    )
      return;
    if (!transporteValido || (revisar && !cargas.length)) {
      establecerFallo(
        t(!cargas.length && revisar ? "elegirCarga" : "completarTransporte"),
      );
      if (!transporteValido) establecerErrores(problemasTransporte);
      mostrarPaso(!origenValido || (revisar && !cargas.length) ? 0 : 1, true);
      return;
    }
    if (
      cajillas.some(
        (fila) =>
          orden.includes(fila.sucursal) &&
          (!Number.isInteger(fila.cantidad) ||
            fila.cantidad < 1 ||
            fila.cantidad > 2147483647),
      )
    ) {
      establecerFallo(t("revisarCajillas"));
      mostrarPaso(1, true);
      return;
    }
    if (documento && !modificado) {
      if (revisar) mostrarPaso(2);
      else navegador.push(`/despachos/${documento.id}`);
      return;
    }
    enviando.current = true;
    establecerGuardando(true);
    establecerFallo("");
    try {
      const guardado = await api<DetalleDespacho>(
        documento ? `despachos/${documento.id}/` : "despachos/",
        {
          method: documento ? "PATCH" : "POST",
          body: JSON.stringify({
            almacen: almacen!.id,
            vehiculo: vehiculo!.id,
            chofer: chofer!.id,
            fecha_reparto: fecha,
            observaciones,
            asignaciones: cargas.map((fila) => fila.id),
            orden_sucursales: orden,
            cajillas_automaticas: cajillasAutomaticas,
            cajillas: cajillas
              .filter((fila) => orden.includes(fila.sucursal))
              .map(({ sucursal, cajilla, cantidad }) => ({
                sucursal,
                cajilla,
                cantidad,
              })),
            ...(documento
              ? { version: documento.version }
              : { clave_operacion: clave }),
          }),
        },
      );
      establecerDocumento(guardado);
      establecerCajillas(cajillasEfectivasDespacho(guardado));
      establecerCajillasAutomaticas(usaCajillasAutomaticas(guardado));
      establecerVehiculo((actual) =>
        actual?.id === guardado.vehiculo
          ? { ...actual, capacidad_kg: guardado.vehiculo_capacidad_kg }
          : actual,
      );
      establecerModificado(false);
      establecerErrores({});
      if (revisar) {
        mostrarPaso(2);
      } else {
        navegador.push(`/despachos/${guardado.id}`);
        navegador.refresh();
      }
    } catch (error) {
      if (error instanceof ErrorApi) {
        establecerErrores(error.errors);
        establecerConflicto(error.status === 409);
        mostrarPaso(pasoErrorDespacho(error.errors, paso), true);
      }
      establecerFallo(
        comun(
          error instanceof ErrorApi && error.status === 409
            ? "conflicto"
            : error instanceof ErrorApi && error.status === 400
              ? "validacion"
              : "errorOperacion",
        ),
      );
      alError(error);
    } finally {
      enviando.current = false;
      establecerGuardando(false);
    }
  };

  return (
    <>
      <div ref={referencia} className={estilos.formulario + " space-y-4"}>
        <header className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-label={t("volver")}
            onClick={volverAlListado}
            disabled={guardando || cargandoCarga}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <IconoVolver className="size-4 rtl:rotate-180" aria-hidden="true" />
          </button>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
            {documento?.codigo || t("nuevo")}
          </h1>
        </header>
        <div className={clasePanel + " overflow-hidden"}>
          <PasosFormularioDespacho
            paso={paso}
            visitado={visitado}
            origenValido={origenValido}
            transporteValido={transporteValido}
            tieneCarga={!!cargas.length}
            revisionGuardada={!!documento && !modificado}
            guardando={guardando || cargandoCarga}
            alElegir={mostrarPaso}
          />
          {fallo && (
            <div
              role="alert"
              tabIndex={-1}
              data-alerta-despacho
              className="mx-5 mt-4 rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-600 sm:mx-6 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400"
            >
              <p>{fallo}</p>
              {Object.entries(errores)
                .filter(
                  ([campo]) =>
                    ![
                      "almacen",
                      "vehiculo",
                      "chofer",
                      "fecha_reparto",
                    ].includes(campo),
                )
                .map(([campo, mensajes]) => (
                  <p key={campo} className="mt-1">
                    {mensajes.join(" ")}
                  </p>
                ))}
              {conflicto && documento && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => navegador.push("/despachos/" + documento.id)}
                >
                  {comun("recargar")}
                </Button>
              )}
            </div>
          )}
          <section
            key={paso}
            id="panel-paso-despacho"
            aria-labelledby="titulo-paso-despacho"
            className={estilos.entrada + " relative min-w-0"}
          >
            <h2
              id="titulo-paso-despacho"
              tabIndex={-1}
              className="sr-only scroll-mt-32"
            >
              {t(nombresPasosDespacho[paso])}
            </h2>
            <div className="space-y-4 p-5 sm:p-6">
              {paso === 0 && (
                <>
                  <OrigenCarga
                    datos={{ almacen, vehiculo, chofer, fecha, observaciones }}
                    bloqueado={bloqueado}
                    errores={errores}
                    alError={alError}
                    alCambiar={cambiarTransporte}
                  />
                  {almacen ? (
                    <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
                      <SeleccionCarga
                        almacen={almacen.id}
                        despacho={documento?.id}
                        seleccionadas={cargas}
                        alCambiar={cambiarCarga}
                        alError={alError}
                        deshabilitado={bloqueado}
                        alCargando={establecerCargandoCarga}
                        fechaPedidosInicial={fechaPedidos}
                        alFechaPedidos={establecerFechaPedidos}
                      />
                    </div>
                  ) : (
                    <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-600 dark:bg-gray-800/40 dark:text-gray-300">
                      {t("elegirOrigenCarga")}
                    </p>
                  )}
                </>
              )}
              {paso === 1 && almacen && (
                <>
                  <TransporteFormulario
                    seccion="transporte"
                    datos={{ almacen, vehiculo, chofer, fecha, observaciones }}
                    bloqueado={bloqueado}
                    errores={errores}
                    alError={alError}
                    alCambiar={cambiarTransporte}
                  />
                  <CapacidadFormularioDespacho
                    vehiculo={vehiculo}
                    cargas={cargas}
                  />
                  <div className="border-t border-gray-100 pt-3 dark:border-gray-800">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {t("rutaYCajillas")}
                        </h3>
                        <span
                          className={`rounded-lg px-2 py-1 text-theme-xs font-medium ${cajillasAutomaticas ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300"}`}
                        >
                          {t(
                            cajillasAutomaticas
                              ? "cajillasDePreparaciones"
                              : "cajillasAjustadas",
                          )}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={bloqueado}
                        onClick={cambiarModoCajillas}
                        startIcon={
                          cajillasAutomaticas ? (
                            <IconoAjustar className="size-4" />
                          ) : (
                            <IconoRestablecer className="size-4" />
                          )
                        }
                      >
                        {t(
                          cajillasAutomaticas
                            ? "ajustarCajillas"
                            : "restablecerCajillas",
                        )}
                      </Button>
                    </div>
                    <ParadasFormulario
                      orden={orden}
                      cargas={cargas}
                      cajillas={cajillas}
                      almacen={almacen.id}
                      alCajillas={(valor) => {
                        establecerCajillas(valor);
                        cambiar();
                      }}
                      alError={alError}
                      deshabilitado={bloqueado}
                      automaticas={cajillasAutomaticas}
                    />
                  </div>
                </>
              )}
              {paso === 2 && almacen && (
                <>
                  <ContextoResumenFormularioDespacho
                    almacen={almacen}
                    vehiculo={vehiculo}
                    chofer={chofer}
                    fecha={fecha}
                  />
                  <CapacidadFormularioDespacho
                    vehiculo={vehiculo}
                    cargas={cargas}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      {t("borradorGuardado")} · {documento?.codigo}
                    </p>
                    {permisos.editar && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => mostrarPaso(1)}
                      >
                        {t("editarViaje")}
                      </Button>
                    )}
                  </div>
                  <ParadasFormulario
                    orden={orden}
                    cargas={cargas}
                    cajillas={cajillas}
                    almacen={almacen.id}
                    alCajillas={() => {}}
                    alError={alError}
                    deshabilitado
                    revision
                    automaticas={cajillasAutomaticas}
                  />
                  <p className="flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-sm leading-6 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
                    <IconoInventario
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    {t("ayudaInventario")}
                  </p>
                </>
              )}
            </div>
          </section>
        </div>
        <div
          className={
            estilos.barra +
            " sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-md dark:border-gray-700 dark:bg-gray-900"
          }
        >
          <ResumenFormulario
            compacto
            documento={documento}
            almacen={almacen}
            vehiculo={vehiculo}
            chofer={chofer}
            fecha={fecha}
            paso={paso}
            cargas={cargas}
            orden={orden}
            cajillas={cajillas}
            modificado={modificado}
          />
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:ms-auto sm:w-auto">
            <Button
              size="sm"
              variant="outline"
              disabled={guardando || cargandoCarga}
              onClick={volverAlListado}
            >
              {t("salirFormularioDespacho")}
            </Button>
            {paso > 0 && (
              <Button
                size="sm"
                variant="outline"
                disabled={guardando || cargandoCarga}
                onClick={() => mostrarPaso(paso - 1)}
                startIcon={<IconoVolver className="size-4 rtl:rotate-180" />}
              >
                {comun("anterior")}
              </Button>
            )}
            {paso < 2 && puedeGuardar && transporteValido && (
              <Button
                size="sm"
                variant="outline"
                disabled={
                  guardando || cargandoCarga || conflicto || !transporteValido
                }
                onClick={() => void guardar()}
              >
                {comun(guardando ? "guardando" : "guardarBorrador")}
              </Button>
            )}
            {paso === 0 ? (
              <Button
                size="sm"
                disabled={guardando || cargandoCarga || conflicto}
                onClick={avanzar}
                endIcon={<IconoSiguiente className="size-4 rtl:rotate-180" />}
              >
                {t("continuarViaje")}
              </Button>
            ) : paso === 1 ? (
              <Button
                size="sm"
                disabled={guardando || conflicto}
                onClick={() => void guardar(true)}
                endIcon={<IconoSiguiente className="size-4 rtl:rotate-180" />}
              >
                {guardando
                  ? comun("guardando")
                  : t("revisarDespachoFormulario")}
              </Button>
            ) : (
              documento &&
              !guardando &&
              !conflicto && (
                <AccionesDespacho
                  soloEnvio
                  despacho={documento}
                  permisos={permisos}
                  alError={alError}
                  alActualizar={(actualizado) => {
                    establecerModificado(false);
                    navegador.push("/despachos/" + actualizado.id);
                    navegador.refresh();
                  }}
                />
              )
            )}
          </div>
        </div>
      </div>
      {salir && (
        <Confirmacion
          titulo={comun("descartarTitulo")}
          descripcion={comun("descartarAyuda")}
          accion={comun("descartar")}
          alCerrar={() => establecerSalir(false)}
          alConfirmar={() => navegador.push("/despachos")}
        />
      )}
      {cambioAlmacen && (
        <Confirmacion
          titulo={t("cambiarAlmacen")}
          descripcion={t("cambiarAlmacenAyuda")}
          accion={comun("continuar")}
          alCerrar={() => establecerCambioAlmacen(null)}
          alConfirmar={() => {
            establecerAlmacen(cambioAlmacen);
            establecerCargas([]);
            establecerOrden([]);
            establecerCajillas([]);
            establecerCajillasAutomaticas(true);
            establecerCambioAlmacen(null);
            cambiar();
          }}
        />
      )}
    </>
  );
}
