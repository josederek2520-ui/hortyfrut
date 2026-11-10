"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useChofer } from "./ProveedorChofer";
import { useConsultaChofer } from "./useConsultaChofer";
import { ErrorAplicacion } from "@/lib/chofer/compartido/dominio/Errores";
import type {
  AccionRuta,
  DocumentoRuta,
} from "@/lib/chofer/modulos/recorrido/dominio/Ruta";
import type { DocumentoOperacion } from "@/lib/chofer/modulos/despachos/dominio/RepositorioDespachos";

export function useViajeChofer(identificador: number) {
  const servicios = useChofer();
  const [ocupado, establecerOcupado] = useState(false);
  const [error, establecerError] = useState<unknown>();
  const candado = useRef(false),
    montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  const consultar = useCallback(
    async (senal: AbortSignal) => {
      for (let intento = 0; intento < 2; intento++) {
        const [viaje, ruta] = await Promise.all([
          servicios.repositorio.detalle(identificador, senal),
          servicios.rutas.consultar(identificador, senal),
        ]);
        if (
          viaje.id === ruta.despacho &&
          viaje.version === ruta.versionDespacho
        )
          return { viaje, ruta };
      }
      throw new ErrorAplicacion("conflicto", 409);
    },
    [identificador, servicios.repositorio, servicios.rutas],
  );
  const consulta = useConsultaChofer(String(identificador), consultar, true);
  const { recargar } = consulta;
  useEffect(() => {
    const actualizarAlVolver = () => {
      if (document.visibilityState === "visible" && !candado.current)
        recargar();
    };
    document.addEventListener("visibilitychange", actualizarAlVolver);
    window.addEventListener("online", actualizarAlVolver);
    return () => {
      document.removeEventListener("visibilitychange", actualizarAlVolver);
      window.removeEventListener("online", actualizarAlVolver);
    };
  }, [recargar]);
  const trabajoActivo = ["pendiente", "calculando"].includes(
    consulta.datos?.ruta.optimizacion?.estado ?? "",
  );
  useEffect(() => {
    if (
      !trabajoActivo ||
      ocupado ||
      consulta.cargando ||
      consulta.error ||
      document.visibilityState !== "visible"
    )
      return;
    const espera = setTimeout(consulta.recargar, 2000);
    return () => clearTimeout(espera);
  }, [
    trabajoActivo,
    ocupado,
    consulta.cargando,
    consulta.error,
    consulta.recargar,
  ]);
  const incierto = !!(
    servicios.operaciones.pendiente(identificador) ||
    servicios.gestorRutas.pendiente(identificador)
  );
  useEffect(() => {
    if (!ocupado && !incierto) return;
    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [ocupado, incierto]);
  const ejecutar = async (operacion: () => Promise<unknown>) => {
    if (candado.current) return false;
    candado.current = true;
    establecerOcupado(true);
    establecerError(undefined);
    try {
      await operacion();
      if (montado.current) consulta.recargar();
      return true;
    } catch (error) {
      if (montado.current) {
        establecerError(error);
        if (error instanceof ErrorAplicacion && error.estado === 409)
          consulta.recargar();
      }
      return false;
    } finally {
      candado.current = false;
      if (montado.current) establecerOcupado(false);
    }
  };
  const operar = (
    accion: string,
    documento: Omit<DocumentoOperacion, "clave_operacion">,
  ) =>
    ejecutar(() =>
      servicios.operaciones.ejecutar(identificador, accion, documento),
    );
  const operarRuta = (
    accion: AccionRuta,
    documento: Omit<DocumentoRuta, "clave_operacion">,
  ) =>
    ejecutar(() =>
      servicios.gestorRutas.ejecutar(identificador, accion, documento),
    );
  const reintentar = () =>
    ejecutar(() =>
      servicios.operaciones.pendiente(identificador)
        ? servicios.operaciones.reintentar(identificador)
        : servicios.gestorRutas.reintentar(identificador),
    );
  return {
    ...consulta,
    ocupado,
    errorOperacion: error,
    incierto,
    trabajoActivo,
    operar,
    operarRuta,
    reintentar,
    bloqueado: ocupado || incierto || consulta.cargando || !!consulta.error,
  };
}
