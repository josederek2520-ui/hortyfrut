"use client";
import { useCallback, useEffect, useState } from "react";
export function useConsultaChofer<T>(
  clave: string,
  consultar: (senal: AbortSignal) => Promise<T>,
  conservar = false,
) {
  const [revision, establecerRevision] = useState(0);
  const [estado, establecerEstado] = useState<{
    clave: string;
    revision: number;
    datos?: T;
    error?: unknown;
  }>({ clave, revision: -1 });
  useEffect(() => {
    const controlador = new AbortController();
    void consultar(controlador.signal).then(
      (datos) => {
        if (!controlador.signal.aborted)
          establecerEstado({ clave, revision, datos });
      },
      (error: unknown) => {
        if (!controlador.signal.aborted)
          establecerEstado((anterior) => ({
            clave,
            revision,
            datos:
              conservar && anterior.clave === clave
                ? anterior.datos
                : undefined,
            error,
          }));
      },
    );
    return () => controlador.abort();
  }, [clave, consultar, revision, conservar]);
  const recargar = useCallback(
    () => establecerRevision((valor) => valor + 1),
    [establecerRevision],
  );
  const vigente = estado.clave === clave && estado.revision === revision;
  return {
    datos:
      estado.clave === clave && (conservar || vigente)
        ? estado.datos
        : undefined,
    error: vigente ? estado.error : undefined,
    cargando: !vigente,
    recargar,
  };
}
