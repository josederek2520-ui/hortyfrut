"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

/** La respuesta siempre pertenece a la ruta y al reintento actuales. */
export default function useConsultaEntrega<T>(ruta: string | null, demora = 0) {
  const [revision, establecerRevision] = useState(0);
  const [respuesta, establecerRespuesta] = useState<{
    clave: string;
    datos: T | null;
    fallo: boolean;
  } | null>(null);
  const clave = JSON.stringify([ruta, revision]);
  const actual = ruta && respuesta?.clave === clave ? respuesta : null;
  const reintentar = useCallback(
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
      } catch {
        if (!controlador.signal.aborted)
          establecerRespuesta({ clave, datos: null, fallo: true });
      }
    }, demora);
    return () => {
      clearTimeout(temporizador);
      controlador.abort();
    };
  }, [ruta, clave, demora]);
  return {
    datos: actual?.datos ?? null,
    cargando: !!ruta && !actual,
    fallo: !!actual?.fallo,
    reintentar,
  };
}
