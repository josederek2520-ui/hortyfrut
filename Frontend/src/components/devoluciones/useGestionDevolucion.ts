"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { crearClaveOperacion } from "@/lib/chofer/infraestructura/crearClaveOperacion";
import {
  cargarLineasDevolucion,
  cambiarMedicionDevolucion,
  lineaNuevaDevolucion,
  prepararDevolucion,
} from "./calculosDevolucion";
import type {
  AccionDevolucion,
  AporteDevolucion,
  CampoDevolucion,
  Devolucion,
  LineaEditableDevolucion,
  OrigenDevolucion,
} from "./tipos";

export default function useGestionDevolucion(
  identificador?: number,
  entregaInicial?: number,
) {
  const [documento, establecerDocumento] = useState<Devolucion | null>(null);
  const [entrega, establecerEntrega] = useState<number | null>(
      entregaInicial ?? null,
    ),
    [origen, establecerOrigen] = useState<OrigenDevolucion | null>(null);
  const [almacen, establecerAlmacen] = useState<{
    id: number;
    nombre: string;
  } | null>(null);
  const [fecha, establecerFecha] = useState(""),
    [motivo, establecerMotivo] = useState(""),
    [motivoRevision, establecerMotivoRevision] = useState("");
  const [lineas, establecerLineas] = useState<
    Record<number, LineaEditableDevolucion>
  >({});
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
    aviso: string;
  } | null>(null);
  const aplicar = useCallback((datos: Devolucion) => {
    establecerDocumento(datos);
    establecerEntrega(datos.entrega);
    establecerOrigen(datos.origen);
    establecerAlmacen({ id: datos.almacen, nombre: datos.almacen_nombre });
    establecerFecha(datos.fecha_recepcion ?? "");
    establecerMotivo(datos.motivo);
    establecerMotivoRevision(datos.motivo_revision);
    establecerLineas(cargarLineasDevolucion(datos));
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
    void api<Devolucion>("devoluciones/" + identificador + "/", {
      signal: controlador.signal,
    })
      .then((datos) => {
        if (!controlador.signal.aborted) aplicar(datos);
      })
      .catch((error) => {
        if (!controlador.signal.aborted)
          establecerFallo(
            error instanceof ApiError && [403, 404].includes(error.status)
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
  function mostrarErrores(datos: Record<string, string[]>) {
    establecerErrores(datos);
    establecerRevisionErrores((valor) => valor + 1);
  }
  async function solicitar(ruta: string, cuerpo: string, mensaje: string) {
    pendiente.current = { ruta, cuerpo, aviso: mensaje };
    try {
      const resultado = await api<Devolucion>(ruta, {
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
  async function operar(accion: AccionDevolucion) {
    if (ejecutando.current || !vigente.current) return null;
    if (incierto && accion !== "reintentar") return null;
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
              pendiente.current.aviso,
            )
          : null;
      let actual = documento;
      const enRevision = actual?.estado === "recibida";
      if (accion !== "cancelar") {
        const completa = accion === "recibir" || accion === "revisar";
        const preparada = prepararDevolucion(lineas, enRevision, completa);
        if (!entrega || !origen)
          preparada.errores.entrega = ["entregaObligatoria"];
        if (!almacen) preparada.errores.almacen = ["almacenObligatorio"];
        if (completa && !(enRevision ? motivoRevision : motivo).trim())
          preparada.errores[enRevision ? "motivo_revision" : "motivo"] = [
            "motivoObligatorio",
          ];
        if (accion === "recibir" && !fecha)
          preparada.errores.fecha_recepcion = ["fechaObligatoria"];
        if (Object.keys(preparada.errores).length) {
          mostrarErrores(preparada.errores);
          establecerFallo("revisarErrores");
          return null;
        }
        if (modificado || !actual) {
          const cuerpo = JSON.stringify(
            enRevision
              ? {
                  clave_operacion: crearClaveOperacion(),
                  version: actual!.version,
                  motivo_revision: motivoRevision,
                  lineas: preparada.filas,
                }
              : {
                  clave_operacion: crearClaveOperacion(),
                  version: actual?.version ?? origen!.version,
                  entrega,
                  almacen: almacen!.id,
                  fecha_recepcion: fecha || null,
                  motivo,
                  lineas: preparada.filas,
                },
          );
          const ruta = actual
            ? "devoluciones/" +
              actual.id +
              (enRevision ? "/revision/" : "/guardar/")
            : "devoluciones/";
          actual = await solicitar(ruta, cuerpo, "guardado");
          if (!actual || !vigente.current) return null;
        }
      }
      if (!actual) return null;
      if (["recibir", "revisar", "cancelar"].includes(accion)) {
        actual = await solicitar(
          "devoluciones/" + actual.id + "/" + accion + "/",
          JSON.stringify({
            clave_operacion: crearClaveOperacion(),
            version: actual.version,
          }),
          accion === "recibir"
            ? "recibida"
            : accion === "revisar"
              ? "revisada"
              : "cancelada",
        );
      }
      return actual;
    } finally {
      ejecutando.current = false;
      if (vigente.current) establecerOcupado(false);
    }
  }
  const cambiar = (actualizar: () => void, clave?: string) => {
    if (ocupado || incierto) return;
    actualizar();
    establecerModificado(true);
    establecerAviso("");
    if (fallo === "revisarErrores") establecerFallo("");
    if (clave)
      establecerErrores((anteriores) => {
        const siguientes = { ...anteriores };
        delete siguientes[clave];
        return siguientes;
      });
  };
  return {
    documento,
    entrega,
    origen,
    almacen,
    fecha,
    motivo,
    motivoRevision,
    lineas,
    ocupado,
    modificado,
    incierto,
    fallo,
    errores,
    aviso,
    revisionErrores,
    operar,
    reintentarConsulta: () => {
      establecerFallo("");
      establecerRevision((valor) => valor + 1);
    },
    establecerOrigen,
    cambiarEntrega: (valor: number) =>
      cambiar(() => {
        establecerEntrega(valor);
        establecerOrigen(null);
        establecerLineas({});
      }, "entrega"),
    cambiarAlmacen: (valor: { id: number; nombre: string }) =>
      cambiar(() => establecerAlmacen(valor), "almacen"),
    cambiarFecha: (valor: string) =>
      cambiar(() => establecerFecha(valor), "fecha_recepcion"),
    cambiarMotivo: (valor: string) =>
      cambiar(() => establecerMotivo(valor), "motivo"),
    cambiarMotivoRevision: (valor: string) =>
      cambiar(() => establecerMotivoRevision(valor), "motivo_revision"),
    agregar: (aporte: AporteDevolucion) =>
      cambiar(() =>
        establecerLineas((anteriores) => ({
          ...anteriores,
          [aporte.id]: lineaNuevaDevolucion(aporte),
        })),
      ),
    quitar: (aporte: number) =>
      cambiar(() =>
        establecerLineas((anteriores) => {
          const siguientes = { ...anteriores };
          delete siguientes[aporte];
          return siguientes;
        }),
      ),
    cambiarCampo: (aporte: number, campo: CampoDevolucion, valor: string) =>
      cambiar(
        () =>
          establecerLineas((anteriores) => ({
            ...anteriores,
            [aporte]: cambiarMedicionDevolucion(
              anteriores[aporte],
              campo,
              valor,
            ),
          })),
        aporte + "_" + campo,
      ),
  };
}
