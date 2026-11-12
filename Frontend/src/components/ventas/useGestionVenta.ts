"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError as ErrorApi } from "@/lib/api";
import { crearClaveOperacion } from "@/lib/chofer/infraestructura/crearClaveOperacion";
import {
  formularioDesdeVenta,
  hoyBolivia,
  validarVenta,
} from "./calculosVenta";
import type { AccionVenta, FormularioVenta, Venta } from "./tipos";

function nuevoFormulario(): FormularioVenta {
  return {
    cliente: null,
    desde: hoyBolivia(),
    hasta: hoyBolivia(),
    vencimiento: "",
    entregas: [],
  };
}
export default function useGestionVenta(identificador?: number) {
  const [documento, establecerDocumento] = useState<Venta | null>(null);
  const [formulario, establecerFormulario] =
    useState<FormularioVenta>(nuevoFormulario);
  const [ocupado, establecerOcupado] = useState(false),
    [cargando, establecerCargando] = useState(!!identificador);
  const [modificado, establecerModificado] = useState(false),
    [incierto, establecerIncierto] = useState(false);
  const [fallo, establecerFallo] = useState(""),
    [errores, establecerErrores] = useState<string[]>([]),
    [aviso, establecerAviso] = useState("");
  const [paso, establecerPaso] = useState<"seleccion" | "revision">(
      "seleccion",
    ),
    [revision, establecerRevision] = useState(0);
  const generacion = useRef(0),
    vigente = useRef(true),
    ejecutando = useRef(false);
  const identificadorActual = useRef(identificador);
  const pendiente = useRef<{
    ruta: string;
    cuerpo: string;
    paso: "seleccion" | "revision";
    mensaje: string;
  } | null>(null);
  const aplicar = useCallback((datos: Venta) => {
    identificadorActual.current = datos.id;
    establecerDocumento(datos);
    establecerFormulario(formularioDesdeVenta(datos));
    establecerModificado(false);
  }, []);
  useEffect(() => {
    vigente.current = true;
    const invalidar = () => {
      generacion.current++;
      pendiente.current = null;
      vigente.current = false;
    };
    const retirar = () => {
      invalidar();
      establecerDocumento(null);
      establecerFormulario(nuevoFormulario());
      establecerIncierto(false);
      establecerOcupado(false);
      establecerFallo("sinAcceso");
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
  useEffect(() => {
    const id = identificador || identificadorActual.current;
    if (!id) return;
    const controlador = new AbortController(),
      turno = generacion.current;
    void api<Venta>(`ventas/${id}/`, { signal: controlador.signal })
      .then((datos) => {
        if (
          !controlador.signal.aborted &&
          vigente.current &&
          turno === generacion.current
        )
          aplicar(datos);
      })
      .catch((error) => {
        if (
          !controlador.signal.aborted &&
          vigente.current &&
          turno === generacion.current
        )
          establecerFallo(
            error instanceof ErrorApi && [401, 403, 404].includes(error.status)
              ? "sinAcceso"
              : "errorConsulta",
          );
      })
      .finally(() => {
        if (
          !controlador.signal.aborted &&
          vigente.current &&
          turno === generacion.current
        )
          establecerCargando(false);
      });
    return () => controlador.abort();
  }, [identificador, revision, aplicar]);

  async function solicitar(peticion: NonNullable<typeof pendiente.current>) {
    const turno = generacion.current;
    pendiente.current = peticion;
    try {
      const datos = await api<Venta>(peticion.ruta, {
        method: "POST",
        body: peticion.cuerpo,
      });
      if (!vigente.current || turno !== generacion.current) return null;
      pendiente.current = null;
      establecerIncierto(false);
      aplicar(datos);
      establecerPaso(peticion.paso);
      establecerAviso(peticion.mensaje);
      return datos;
    } catch (error) {
      if (!vigente.current || turno !== generacion.current) return null;
      const dudoso =
        !(error instanceof ErrorApi) ||
        error.status === 0 ||
        error.status >= 500;
      establecerIncierto(dudoso);
      if (!dudoso) pendiente.current = null;
      establecerFallo(
        dudoso
          ? "incierto"
          : error instanceof ErrorApi && error.status === 409
            ? "conflicto"
            : error instanceof ErrorApi &&
                [401, 403, 404].includes(error.status)
              ? "sinAcceso"
              : "revisarErrores",
      );
      if (error instanceof ErrorApi)
        establecerErrores(Object.values(error.errors).flat());
      return null;
    }
  }
  async function operar(accion: AccionVenta) {
    if (
      ejecutando.current ||
      !vigente.current ||
      (incierto && accion !== "reintentar")
    )
      return null;
    ejecutando.current = true;
    establecerOcupado(true);
    establecerFallo("");
    establecerErrores([]);
    establecerAviso("");
    try {
      if (accion === "reintentar")
        return pendiente.current ? await solicitar(pendiente.current) : null;
      let actual = documento;
      if (accion === "guardar" || accion === "revisar") {
        const problemas = validarVenta(formulario, accion === "revisar");
        if (problemas.length) {
          establecerErrores(problemas);
          establecerFallo("revisarErrores");
          return null;
        }
        if (modificado || !actual) {
          actual = await solicitar({
            ruta: actual ? `ventas/${actual.id}/guardar/` : "ventas/",
            cuerpo: JSON.stringify({
              cliente: formulario.cliente!.id,
              desde: formulario.desde,
              hasta: formulario.hasta,
              vencimiento: formulario.vencimiento || null,
              entregas: formulario.entregas.map((fila) => fila.id),
              version: actual?.version ?? "",
              clave_operacion: crearClaveOperacion(),
            }),
            paso: accion === "revisar" ? "revision" : "seleccion",
            mensaje: "guardado",
          });
        } else if (accion === "revisar") {
          const turno = generacion.current;
          actual = await api<Venta>(`ventas/${actual.id}/`);
          if (!vigente.current || turno !== generacion.current) return null;
          aplicar(actual);
          establecerPaso("revision");
        }
        return actual;
      }
      if (!actual || modificado) return null;
      return await solicitar({
        ruta: `ventas/${actual.id}/${accion}/`,
        cuerpo: JSON.stringify({
          version: actual.version,
          clave_operacion: crearClaveOperacion(),
          ...(accion === "emitir" ? { revision: actual.revision } : {}),
        }),
        paso: "revision",
        mensaje: accion === "emitir" ? "emitidaCorrecto" : "canceladaCorrecto",
      });
    } catch (error) {
      if (vigente.current)
        establecerFallo(
          error instanceof ErrorApi && [401, 403, 404].includes(error.status)
            ? "sinAcceso"
            : "errorConsulta",
        );
      return null;
    } finally {
      ejecutando.current = false;
      if (vigente.current) establecerOcupado(false);
    }
  }
  function cambiar(cambios: Partial<FormularioVenta>) {
    if (ejecutando.current || incierto || !vigente.current) return;
    establecerFormulario((actual) => ({ ...actual, ...cambios }));
    establecerModificado(true);
    establecerAviso("");
    establecerErrores([]);
    establecerFallo("");
  }
  return {
    documento,
    formulario,
    ocupado,
    cargando,
    modificado,
    incierto,
    fallo,
    errores,
    aviso,
    paso,
    cambiar,
    operar,
    volverSeleccion: () => {
      if (!ocupado && !incierto) establecerPaso("seleccion");
    },
    recargar: () => {
      if (!ocupado && !incierto) {
        establecerFallo("");
        establecerCargando(true);
        establecerRevision((valor) => valor + 1);
      }
    },
  };
}
