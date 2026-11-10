"use client";
import { useEffect, useRef, useState } from "react";

export function usePantallaEncendida(alError: () => void) {
  const bloqueo = useRef<WakeLockSentinel | null>(null);
  const montado = useRef(true),
    solicitud = useRef(0);
  const [activa, establecerActiva] = useState(false);
  useEffect(() => {
    montado.current = true;
    const peticiones = solicitud;
    return () => {
      montado.current = false;
      ++peticiones.current;
      void bloqueo.current?.release();
      bloqueo.current = null;
    };
  }, []);
  const alternar = async () => {
    const turno = ++solicitud.current;
    if (bloqueo.current) {
      await bloqueo.current.release();
      return;
    }
    try {
      if (!navigator.wakeLock) {
        alError();
        return;
      }
      const nuevo = await navigator.wakeLock.request("screen");
      if (
        !montado.current ||
        turno !== solicitud.current ||
        document.visibilityState !== "visible"
      ) {
        await nuevo.release();
        return;
      }
      bloqueo.current = nuevo;
      establecerActiva(true);
      nuevo.addEventListener("release", () => {
        if (bloqueo.current === nuevo) {
          bloqueo.current = null;
          if (montado.current) establecerActiva(false);
        }
      });
    } catch {
      if (montado.current) alError();
    }
  };
  return { activa, alternar };
}
