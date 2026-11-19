"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";

export default function useOperacionComercial() {
  const [ocupado, establecerOcupado] = useState(false),
    [incierto, establecerIncierto] = useState(false);
  const [fallo, establecerFallo] = useState(""),
    [errores, establecerErrores] = useState<string[]>([]);
  const [autorizado, establecerAutorizado] = useState(true);
  const vigente = useRef(true),
    generacion = useRef(0),
    ejecutando = useRef(false);
  const pendiente = useRef<{
    ruta: string;
    cuerpo: string;
    archivo?: File;
  } | null>(null);
  useEffect(() => {
    vigente.current = true;
    const invalidar = () => {
      vigente.current = false;
      generacion.current++;
      pendiente.current = null;
    };
    const retirar = () => {
      invalidar();
      establecerAutorizado(false);
    };
    const almacenamiento = (evento: StorageEvent) => {
      if (evento.key === "hortyfru-cambio-sesion") retirar();
    };
    window.addEventListener("hortyfru:session-changed", retirar);
    window.addEventListener("storage", almacenamiento);
    return () => {
      invalidar();
      window.removeEventListener("hortyfru:session-changed", retirar);
      window.removeEventListener("storage", almacenamiento);
    };
  }, []);
  async function enviar<T>(
    ruta?: string,
    cuerpo?: unknown,
    archivo?: File,
  ): Promise<{ ruta: string; datos: T } | null> {
    if (!vigente.current || ejecutando.current || (incierto && ruta))
      return null;
    const peticion = ruta
      ? { ruta, cuerpo: JSON.stringify(cuerpo), archivo }
      : pendiente.current;
    if (!peticion) return null;
    ejecutando.current = true;
    establecerOcupado(true);
    establecerFallo("");
    establecerErrores([]);
    pendiente.current = peticion;
    const turno = generacion.current;
    try {
      let carga: string | FormData = peticion.cuerpo;
      if (peticion.archivo) {
        carga = new FormData();
        carga.append("datos", peticion.cuerpo);
        carga.append("comprobante", peticion.archivo, peticion.archivo.name);
      }
      const datos = await api<T>(peticion.ruta, {
        method: "POST",
        body: carga,
      });
      if (!vigente.current || turno !== generacion.current) return null;
      pendiente.current = null;
      establecerIncierto(false);
      return { ruta: peticion.ruta, datos };
    } catch (error) {
      if (!vigente.current || turno !== generacion.current) return null;
      const dudoso =
        !(error instanceof ApiError) ||
        error.status === 0 ||
        error.status >= 500;
      establecerIncierto(dudoso);
      if (error instanceof ApiError && [401, 403].includes(error.status))
        establecerAutorizado(false);
      if (!dudoso) pendiente.current = null;
      establecerFallo(
        dudoso
          ? "incierto"
          : error instanceof ApiError && error.status === 409
            ? "conflicto"
            : error instanceof ApiError &&
                [401, 403, 404].includes(error.status)
              ? "sinAcceso"
              : "revisarErrores",
      );
      if (error instanceof ApiError)
        establecerErrores(Object.values(error.errors).flat());
      return null;
    } finally {
      ejecutando.current = false;
      if (vigente.current && turno === generacion.current)
        establecerOcupado(false);
    }
  }
  return { enviar, ocupado, incierto, fallo, errores, autorizado };
}
