"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export default function useConsultaComercial<T>(ruta: string | null) {
  const [revision, establecerRevision] = useState(0),
    [sesionValida, establecerSesionValida] = useState(true);
  const [consulta, establecerConsulta] = useState<{
    ruta: string;
    datos?: T;
    fallo?: boolean;
  } | null>(null);
  const controlador = useRef<AbortController | null>(null);
  const recargar = useCallback(() => {
    establecerConsulta(null);
    establecerRevision((v) => v + 1);
  }, []);
  useEffect(() => {
    const retirar = () => {
      controlador.current?.abort();
      establecerSesionValida(false);
      establecerConsulta(null);
    };
    const almacenamiento = (evento: StorageEvent) => {
      if (evento.key === "hortyfru-cambio-sesion") retirar();
    };
    window.addEventListener("hortyfru:session-changed", retirar);
    window.addEventListener("storage", almacenamiento);
    return () => {
      window.removeEventListener("hortyfru:session-changed", retirar);
      window.removeEventListener("storage", almacenamiento);
    };
  }, []);
  useEffect(() => {
    if (!ruta || !sesionValida) return;
    const peticion = new AbortController();
    controlador.current = peticion;
    const reloj = setTimeout(() => {
      void api<T>(ruta, { signal: peticion.signal })
        .then((datos) => {
          if (!peticion.signal.aborted) establecerConsulta({ ruta, datos });
        })
        .catch(() => {
          if (!peticion.signal.aborted)
            establecerConsulta({ ruta, fallo: true });
        });
    }, 150);
    return () => {
      clearTimeout(reloj);
      peticion.abort();
    };
  }, [ruta, revision, sesionValida]);
  return {
    datos:
      sesionValida && consulta?.ruta === ruta ? consulta?.datos : undefined,
    fallo: consulta?.ruta === ruta && consulta?.fallo,
    recargar,
    sesionValida,
  };
}
