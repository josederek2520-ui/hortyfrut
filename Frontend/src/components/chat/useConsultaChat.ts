"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export function useConsultaChat<T>(
  ruta: string | null,
  usuario: number,
  revision = 0,
) {
  const [intento, establecerIntento] = useState(0);
  const [respuesta, establecerRespuesta] = useState<{
    clave: string;
    datos: T | null;
    error: boolean;
  } | null>(null);
  const clave = `${usuario}:${ruta}:${revision}:${intento}`;
  const actual = respuesta?.clave === clave ? respuesta : null;
  const recargar = useCallback(
    () => establecerIntento((valor) => valor + 1),
    [],
  );
  useEffect(() => {
    if (!ruta) return;
    const controlador = new AbortController();
    const limite = setTimeout(() => {
      controlador.abort();
      establecerRespuesta({ clave, datos: null, error: true });
    }, 15000);
    void api<T>(ruta, {
      signal: controlador.signal,
      headers: { "X-Usuario-Chat": String(usuario) },
    })
      .then((datos) => {
        if (!controlador.signal.aborted)
          establecerRespuesta({ clave, datos, error: false });
      })
      .catch(() => {
        if (!controlador.signal.aborted)
          establecerRespuesta({ clave, datos: null, error: true });
      })
      .finally(() => clearTimeout(limite));
    return () => {
      clearTimeout(limite);
      controlador.abort();
    };
  }, [ruta, usuario, clave]);
  // Al refrescar la misma ruta se conservan los mensajes para evitar saltos.
  const previa = respuesta?.clave.startsWith(`${usuario}:${ruta}:`)
    ? respuesta.datos
    : null;
  return {
    datos: actual?.datos ?? previa,
    cargando: !!ruta && !actual,
    error: !!actual?.error,
    recargar,
  };
}
