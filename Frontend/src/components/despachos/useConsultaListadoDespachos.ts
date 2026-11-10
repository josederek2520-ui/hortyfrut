"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

/** Solo expone la respuesta que pertenece a los filtros y revisión actuales. */
export default function useConsultaListadoDespachos<T>(
  ruta: string | null,
  alError: (error: unknown) => void,
  demora = 0,
) {
  const [revision, establecerRevision] = useState(0);
  const [respuesta, establecerRespuesta] = useState<{
    clave: string;
    datos: T | null;
    fallo: boolean;
  } | null>(null);
  const clave = JSON.stringify([ruta, revision]);
  const actual = respuesta?.clave === clave ? respuesta : null;
  const recargar = useCallback(
    () => establecerRevision((valor) => valor + 1),
    [],
  );
  useEffect(() => {
    if (!ruta) return;
    const controlador = new AbortController();
    const temporizador = setTimeout(async () => {
      try {
        const datos = await api<T>(ruta, { signal: controlador.signal });
        if (!controlador.signal.aborted)
          establecerRespuesta({ clave, datos, fallo: false });
      } catch (error) {
        if (!controlador.signal.aborted) {
          establecerRespuesta({ clave, datos: null, fallo: true });
          alError(error);
        }
      }
    }, demora);
    return () => {
      clearTimeout(temporizador);
      controlador.abort();
    };
  }, [ruta, clave, demora, alError]);
  return {
    clave,
    datos: actual?.datos || null,
    cargando: !!ruta && !actual,
    fallo: !!actual?.fallo,
    recargar,
  };
}
