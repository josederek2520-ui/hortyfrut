"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function useConsultaPreparacion<T>(
  ruta: string | null,
  alError: (error: unknown) => void,
) {
  const [revision, establecerRevision] = useState(0);
  const clave = JSON.stringify([ruta, revision]);
  const [resultado, establecerResultado] = useState<{
    clave: string;
    datos: T | null;
    fallo: boolean;
  }>({ clave: "", datos: null, fallo: false });
  useEffect(() => {
    if (!ruta) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(
      () => {
        api<T>(ruta, { signal: controlador.signal })
          .then((datos) => {
            if (!controlador.signal.aborted)
              establecerResultado({ clave, datos, fallo: false });
          })
          .catch((error) => {
            if (!controlador.signal.aborted) {
              establecerResultado({ clave, datos: null, fallo: true });
              alError(error);
            }
          });
      },
      ruta.includes("buscar=") ? 220 : 0,
    );
    return () => {
      controlador.abort();
      window.clearTimeout(temporizador);
    };
  }, [ruta, clave, alError]);
  return {
    datos: resultado.clave === clave ? resultado.datos : null,
    cargando: !!ruta && resultado.clave !== clave,
    fallo: resultado.clave === clave && resultado.fallo,
    recargar: () => establecerRevision((valor) => valor + 1),
  };
}
