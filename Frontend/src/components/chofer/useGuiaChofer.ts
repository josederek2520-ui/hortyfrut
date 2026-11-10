"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { crearClaveOperacion } from "@/lib/chofer/infraestructura/crearClaveOperacion";
import { RepositorioGuiaHttp } from "@/lib/chofer/modulos/recorrido/datos/RepositorioGuiaHttp";
import { GestorGuiaChofer } from "@/lib/chofer/modulos/recorrido/aplicacion/GestorGuiaChofer";
import {
  objetivoGuia,
  posicionValidaGuia,
} from "@/lib/chofer/modulos/recorrido/aplicacion/geometriaGuia";
import type { ClienteApi } from "@/lib/chofer/infraestructura/api/ClienteApi";
import type { RutaViaje } from "@/lib/chofer/modulos/recorrido/dominio/Ruta";
import type { ViajeDetalle } from "@/lib/chofer/modulos/despachos/dominio/Viaje";
import type { PosicionChofer } from "@/lib/chofer/modulos/seguimiento/dominio/Seguimiento";
import type {
  EstadoGuia,
  ContextoGuia,
} from "@/lib/chofer/modulos/recorrido/dominio/GuiaChofer";

const inactiva: EstadoGuia = {
  clave: null,
  fase: "inactiva",
  tramo: null,
  geometria: null,
  distanciaM: null,
};
export function useGuiaChofer({
  cliente,
  usuario,
  viaje,
  ruta,
  sesion,
  posicion,
  mostrarCompleto,
}: {
  cliente: ClienteApi;
  usuario: number;
  viaje: ViajeDetalle | null;
  ruta: RutaViaje | null;
  sesion: string | null;
  posicion: PosicionChofer | null;
  mostrarCompleto: boolean;
}) {
  const [gestor] = useState(
    () =>
      new GestorGuiaChofer(
        new RepositorioGuiaHttp(cliente),
        crearClaveOperacion,
      ),
  );
  const estado = useSyncExternalStore(
    gestor.suscribir,
    gestor.obtenerEstado,
    () => inactiva,
  );
  const objetivo =
    viaje?.estado === "en_ruta" ? objetivoGuia(ruta, viaje.paradas) : null;
  const clave =
    objetivo && sesion && viaje && !mostrarCompleto
      ? `${usuario}:${viaje.id}:${sesion}:${objetivo.plan}:${objetivo.tramo}`
      : null;
  useEffect(() => {
    const contexto: ContextoGuia | null =
      clave && objetivo && viaje && sesion && posicion
        ? {
            clave,
            viaje: viaje.id,
            version: viaje.version,
            sesion,
            objetivo,
            posicion,
          }
        : null;
    if (document.visibilityState === "visible") gestor.actualizar(contexto);
    else gestor.limpiar();
    // La geometría original permanece estable dentro del plan. Las lecturas cambian por UUID.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gestor, clave, viaje?.version, posicion]);
  useEffect(() => {
    const ocultar = () => {
      if (document.visibilityState !== "visible") gestor.limpiar();
    };
    document.addEventListener("visibilitychange", ocultar);
    const reloj = setInterval(() => {
      if (document.visibilityState === "visible") gestor.tic();
    }, 1000);
    return () => {
      clearInterval(reloj);
      document.removeEventListener("visibilitychange", ocultar);
      gestor.limpiar();
    };
  }, [gestor]);
  const actual =
    clave && estado.clave === clave && posicionValidaGuia(posicion, Date.now());
  return { estado: actual ? estado : inactiva, reintentar: gestor.reintentar };
}
