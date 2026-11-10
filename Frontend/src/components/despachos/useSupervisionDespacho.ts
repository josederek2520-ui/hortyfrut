"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ClienteSupervision } from "./ClienteSupervision";

export function useSupervisionDespacho(identificador: number, activo: boolean) {
  const cliente = useMemo(
    () => new ClienteSupervision(identificador),
    [identificador],
  );
  const estado = useSyncExternalStore(
    cliente.suscribir,
    cliente.obtenerEstado,
    cliente.obtenerEstado,
  );
  useEffect(() => {
    if (!activo) return;
    const visibilidad = () => {
      if (document.visibilityState === "visible") cliente.iniciar();
      else cliente.detener();
    };
    const cuenta = (evento: StorageEvent) => {
      if (evento.key === "hortyfru-cambio-sesion") cliente.invalidar();
    };
    const reconectar = () => {
      if (document.visibilityState === "visible") cliente.iniciar();
    };
    visibilidad();
    document.addEventListener("visibilitychange", visibilidad);
    window.addEventListener("online", reconectar);
    window.addEventListener("storage", cuenta);
    return () => {
      cliente.detener();
      document.removeEventListener("visibilitychange", visibilidad);
      window.removeEventListener("online", reconectar);
      window.removeEventListener("storage", cuenta);
    };
  }, [cliente, activo]);
  return { ...estado, reintentar: cliente.iniciar };
}
