"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";

export interface PaginaNegocio<T> {
  count: number;
  results: T[];
  next: string | null;
  previous: string | null;
}

export default function useConsultaPaginada<T>(
  ruta: string | null,
  alPaginaInvalida?: () => void,
) {
  const paginaInvalida = useRef(alPaginaInvalida);
  useEffect(() => {
    paginaInvalida.current = alPaginaInvalida;
  }, [alPaginaInvalida]);
  const [consulta, establecerConsulta] = useState<{
    ruta: string;
    datos?: PaginaNegocio<T>;
    fallo?: boolean;
  } | null>(null);
  const [revision, establecerRevision] = useState(0);
  const recargar = useCallback(() => {
    establecerConsulta(null);
    establecerRevision((v) => v + 1);
  }, []);
  useEffect(() => {
    if (!ruta) return;
    const controlador = new AbortController();
    const reloj = setTimeout(() => {
      void api<PaginaNegocio<T>>(ruta, { signal: controlador.signal })
        .then((datos) => {
          if (!controlador.signal.aborted) establecerConsulta({ ruta, datos });
        })
        .catch((error) => {
          if (controlador.signal.aborted) return;
          if (
            error instanceof ApiError &&
            error.status === 404 &&
            Number(
              new URLSearchParams(ruta.split("?")[1] ?? "").get("pagina"),
            ) > 1 &&
            paginaInvalida.current
          ) {
            paginaInvalida.current();
            return;
          }
          establecerConsulta({ ruta, fallo: true });
        });
    }, 150);
    return () => {
      clearTimeout(reloj);
      controlador.abort();
    };
  }, [ruta, revision]);
  return {
    datos: consulta?.ruta === ruta ? consulta.datos : undefined,
    fallo: consulta?.ruta === ruta && consulta.fallo,
    recargar,
  };
}
