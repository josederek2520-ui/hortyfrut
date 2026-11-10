"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { crearClaveOperacion } from "@/lib/chofer/infraestructura/crearClaveOperacion";
import { cargarFormularioPrecio, prepararPrecio } from "./calculosPrecio";
import type { AcuerdoPrecio, AccionPrecio, FormularioPrecio } from "./tipos";

const vacio: FormularioPrecio = {
  cliente: null,
  alcance: "periodo",
  desde: "",
  hasta: "",
  referencia_propuesta: "",
  lineas: [],
  entregas: [],
};
export default function useGestionPrecio(identificador?: number) {
  const [documento, establecerDocumento] = useState<AcuerdoPrecio | null>(null);
  const [formulario, establecerFormulario] = useState<FormularioPrecio>(vacio);
  const [ocupado, establecerOcupado] = useState(false),
    [modificado, establecerModificado] = useState(false),
    [incierto, establecerIncierto] = useState(false);
  const [fallo, establecerFallo] = useState(""),
    [errores, establecerErrores] = useState<Record<string, string[]>>({}),
    [aviso, establecerAviso] = useState("");
  const [revision, establecerRevision] = useState(0),
    [revisionErrores, establecerRevisionErrores] = useState(0);
  const vigente = useRef(true),
    ejecutando = useRef(false);
  const pendiente = useRef<{
    ruta: string;
    cuerpo: string;
    mensaje: string;
  } | null>(null);
  const aplicar = useCallback((datos: AcuerdoPrecio) => {
    establecerDocumento(datos);
    establecerFormulario(cargarFormularioPrecio(datos));
    establecerModificado(false);
  }, []);
  useEffect(() => {
    vigente.current = true;
    return () => {
      vigente.current = false;
      pendiente.current = null;
    };
  }, []);
  useEffect(() => {
    if (!identificador) return;
    const controlador = new AbortController();
    void api<AcuerdoPrecio>(`precios-acordados/${identificador}/`, {
      signal: controlador.signal,
    })
      .then((datos) => {
        if (!controlador.signal.aborted) aplicar(datos);
      })
      .catch((error) => {
        if (!controlador.signal.aborted)
          establecerFallo(
            error instanceof ApiError && [401, 403, 404].includes(error.status)
              ? "sinAcceso"
              : "errorConsulta",
          );
      });
    return () => controlador.abort();
  }, [identificador, revision, aplicar]);
  useEffect(() => {
    if (!modificado && !incierto) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [modificado, incierto]);
  const mostrarErrores = (datos: Record<string, string[]>) => {
    establecerErrores(datos);
    establecerRevisionErrores((v) => v + 1);
  };
  async function solicitar(ruta: string, cuerpo: string, mensaje: string) {
    pendiente.current = { ruta, cuerpo, mensaje };
    try {
      const resultado = await api<AcuerdoPrecio>(ruta, {
        method: "POST",
        body: cuerpo,
      });
      if (!vigente.current) return null;
      pendiente.current = null;
      establecerIncierto(false);
      aplicar(resultado);
      establecerAviso(mensaje);
      return resultado;
    } catch (error) {
      if (!vigente.current) return null;
      const dudoso =
        !(error instanceof ApiError) ||
        error.status === 0 ||
        error.status >= 500;
      establecerIncierto(dudoso);
      if (!dudoso) pendiente.current = null;
      if (error instanceof ApiError) mostrarErrores(error.errors);
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
      return null;
    }
  }
  async function operar(accion: AccionPrecio, motivo = "") {
    if (
      ejecutando.current ||
      !vigente.current ||
      (incierto && accion !== "reintentar")
    )
      return null;
    ejecutando.current = true;
    establecerOcupado(true);
    establecerFallo("");
    establecerErrores({});
    establecerAviso("");
    try {
      if (accion === "reintentar")
        return pendiente.current
          ? await solicitar(
              pendiente.current.ruta,
              pendiente.current.cuerpo,
              pendiente.current.mensaje,
            )
          : null;
      let actual = documento;
      if (accion === "guardar" || accion === "presentar") {
        const preparada = prepararPrecio(formulario, accion === "presentar");
        if (Object.keys(preparada.errores).length) {
          mostrarErrores(preparada.errores);
          establecerFallo("revisarErrores");
          return null;
        }
        if (modificado || !actual) {
          actual = await solicitar(
            actual
              ? `precios-acordados/${actual.id}/guardar/`
              : "precios-acordados/",
            JSON.stringify({
              ...preparada.datos,
              clave_operacion: crearClaveOperacion(),
              version: actual?.version ?? "",
            }),
            "guardado",
          );
          if (!actual || !vigente.current) return null;
        }
      }
      if (!actual) return null;
      if (accion !== "guardar") {
        actual = await solicitar(
          `precios-acordados/${actual.id}/${accion === "nueva_version" ? "nueva-version" : accion}/`,
          JSON.stringify({
            clave_operacion: crearClaveOperacion(),
            version: actual.version,
            motivo,
          }),
          accion === "nueva_version" ? "versionCreada" : accion + "Correcto",
        );
      }
      return actual;
    } finally {
      ejecutando.current = false;
      if (vigente.current) establecerOcupado(false);
    }
  }
  const cambiar = (
    actualizar: (anterior: FormularioPrecio) => FormularioPrecio,
  ) => {
    if (ocupado || incierto) return;
    establecerFormulario(actualizar);
    establecerModificado(true);
    establecerAviso("");
  };
  return {
    documento,
    formulario,
    ocupado,
    modificado,
    incierto,
    fallo,
    errores,
    aviso,
    revisionErrores,
    cambiar,
    operar,
    validar: () => {
      const preparada = prepararPrecio(formulario, true);
      mostrarErrores(preparada.errores);
      establecerFallo(
        Object.keys(preparada.errores).length ? "revisarErrores" : "",
      );
      return !Object.keys(preparada.errores).length;
    },
    reintentarConsulta: () => {
      establecerFallo("");
      establecerRevision((v) => v + 1);
    },
  };
}
