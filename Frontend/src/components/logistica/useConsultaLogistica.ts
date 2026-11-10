"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function useConsultaLogistica<T>(
  ruta: string | null,
  alError: (error: unknown) => void,
) {
  const [datos, establecerDatos] = useState<T | null>(null);
  const [cargando, establecerCargando] = useState(!!ruta);
  const [fallo, establecerFallo] = useState(false);
  const [revision, establecerRevision] = useState(0);
  const recargar = useCallback(
    () => establecerRevision((valor) => valor + 1),
    [],
  );
  useEffect(() => {
    if (!ruta) return;
    const controlador = new AbortController();
    const temporizador = setTimeout(() => {
      establecerCargando(true);
      establecerFallo(false);
      void api<T>(ruta, { signal: controlador.signal })
        .then((respuesta) => {
          if (!controlador.signal.aborted) establecerDatos(respuesta);
        })
        .catch((error) => {
          if (!controlador.signal.aborted) {
            establecerFallo(true);
            alError(error);
          }
        })
        .finally(() => {
          if (!controlador.signal.aborted) establecerCargando(false);
        });
    }, 200);
    return () => {
      clearTimeout(temporizador);
      controlador.abort();
    };
  }, [ruta, revision, alError]);
  return { datos, establecerDatos, cargando, fallo, recargar };
}
