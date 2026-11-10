import { useEffect, useState, useCallback } from "react";
export function usarConsulta<T>(
  clave: string,
  consultar: (senal: AbortSignal) => Promise<T>,
  conservarDatos = false,
) {
  const [revision, establecerRevision] = useState(0);
  const [resultado, establecer] = useState<{
    clave: string;
    datos?: T;
    error?: unknown;
    cargando: boolean;
  }>({ clave, cargando: true });
  useEffect(() => {
    const controlador = new AbortController();
    establecer((anterior) => ({
      clave,
      cargando: true,
      ...(conservarDatos && anterior.clave === clave
        ? { datos: anterior.datos }
        : {}),
    }));
    void consultar(controlador.signal)
      .then((datos) => {
        if (!controlador.signal.aborted)
          establecer({ clave, datos, cargando: false });
      })
      .catch((error: unknown) => {
        if (!controlador.signal.aborted)
          establecer((anterior) => ({
            clave,
            error,
            cargando: false,
            ...(conservarDatos && anterior.clave === clave
              ? { datos: anterior.datos }
              : {}),
          }));
      });
    return () => controlador.abort();
  }, [clave, consultar, revision, conservarDatos]);
  const recargar = useCallback(() => {
    establecer((anterior) => ({
      clave: anterior.clave,
      cargando: true,
      ...(conservarDatos ? { datos: anterior.datos } : {}),
    }));
    establecerRevision((valor) => valor + 1);
  }, [conservarDatos]);
  return {
    ...(resultado.clave === clave
      ? resultado
      : { clave, cargando: true, datos: undefined, error: undefined }),
    recargar,
  };
}
