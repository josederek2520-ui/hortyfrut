"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { crearClaveOperacion } from "@/lib/chofer/infraestructura/crearClaveOperacion";
import type { Session } from "@/components/users/types";
import {
  cargarLineas,
  prepararLineas,
  normalizarMedicion,
  medirEntrega,
  validarRecepcionEntrega,
  lineaVacia,
  resumenConciliacionEntrega,
} from "./calculosEntrega";
import type {
  HojaEntrega,
  LineaEditable,
  AporteEditable,
  CampoRecepcion,
} from "./tipos";

type SolicitudPendiente = {
  ruta: string;
  cuerpo: string | FormData;
  archivo?: boolean;
};
export default function useHojaEntrega(
  despacho: number,
  pedido: number,
  sesion: Session,
) {
  const ruta = `entregas/${despacho}/pedidos/${pedido}/`;
  const [hoja, establecerHoja] = useState<HojaEntrega | null>(null);
  const [fecha, establecerFecha] = useState(""),
    [recibidoPor, establecerRecibidoPor] = useState("");
  const [lineas, establecerLineas] = useState<Record<number, LineaEditable>>(
    {},
  );
  const [aportes, establecerAportes] = useState<Record<string, AporteEditable>>(
    {},
  );
  const [archivo, establecerArchivo] = useState<File | null>(null);
  const [modificado, establecerModificado] = useState(false),
    [ocupado, establecerOcupado] = useState(false);
  const [fallo, establecerFallo] = useState(""),
    [errores, establecerErrores] = useState<Record<string, string[]>>({});
  const [aviso, establecerAviso] = useState("");
  const [incierto, establecerIncierto] = useState(false);
  const [revisionConsulta, establecerRevisionConsulta] = useState(0);
  const [revisionErrores, establecerRevisionErrores] = useState(0);
  const mostrarErrores = (datos: Record<string, string[]>) => {
    establecerErrores(datos);
    establecerRevisionErrores((valor) => valor + 1);
  };
  const pendiente = useRef<SolicitudPendiente | null>(null),
    ejecutando = useRef(false),
    vigente = useRef(true);
  const oficina =
    !sesion.acceso_publico &&
    !!sesion.permisos_entregas?.confirmar &&
    (hoja?.acciones?.revisar ?? true);
  const aplicar = useCallback((datos: HojaEntrega) => {
    establecerHoja(datos);
    establecerFecha(datos.fecha_recepcion ?? "");
    establecerRecibidoPor(datos.recibido_por);
    establecerLineas(cargarLineas(datos));
    establecerAportes(
      Object.fromEntries(
        datos.aportes.map((a) => [
          `${a.carga}-${a.lote}`,
          {
            ...a,
            peso_recibido_kg: String(a.peso_recibido_kg),
            peso_rechazado_kg: String(a.peso_rechazado_kg),
          },
        ]),
      ),
    );
    establecerModificado(false);
  }, []);
  useEffect(() => {
    vigente.current = true;
    const controlador = new AbortController();
    void api<HojaEntrega>(ruta, { signal: controlador.signal })
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
    return () => {
      vigente.current = false;
      controlador.abort();
    };
  }, [ruta, aplicar, revisionConsulta]);
  useEffect(() => {
    if (!modificado && !archivo && !incierto) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [modificado, archivo, incierto]);
  async function solicitar(solicitud: SolicitudPendiente) {
    pendiente.current = solicitud;
    try {
      const datos = await api<HojaEntrega>(solicitud.ruta, {
        method: "POST",
        body: solicitud.cuerpo,
      });
      if (!vigente.current) return null;
      pendiente.current = null;
      establecerIncierto(false);
      aplicar(datos);
      if (solicitud.archivo) establecerArchivo(null);
      return datos;
    } catch (error) {
      if (!vigente.current) return null;
      if (error instanceof ApiError) {
        mostrarErrores(error.errors);
        const incierta = error.status === 0 || error.status >= 500;
        establecerIncierto(incierta);
        if (!incierta) pendiente.current = null;
        establecerFallo(
          incierta
            ? "incierto"
            : error.status === 409
              ? "conflicto"
              : [401, 403, 404].includes(error.status)
                ? "sinAcceso"
                : "revisarErrores",
        );
      } else {
        establecerFallo("incierto");
        establecerIncierto(true);
      }
      return null;
    }
  }
  async function operar(
    accion: "guardar" | "enviar" | "confirmar" | "devolver" | "reintentar",
  ) {
    if (!hoja || ejecutando.current) return;
    ejecutando.current = true;
    establecerOcupado(true);
    establecerFallo("");
    establecerErrores({});
    establecerAviso("");
    try {
      if (accion === "reintentar") {
        if (pendiente.current) {
          const resultado = await solicitar(pendiente.current);
          if (resultado)
            establecerAviso(
              resultado.estado === "confirmada"
                ? "confirmada"
                : resultado.estado === "revision"
                  ? "enviada"
                  : "guardado",
            );
        }
        return;
      }
      let actual = hoja;
      if (accion === "enviar" || accion === "confirmar") {
        const erroresRecepcion = validarRecepcionEntrega(
          hoja,
          lineas,
          fecha,
          recibidoPor,
        );
        if (accion === "confirmar" && oficina) {
          for (const producto of hoja.origen.productos) {
            if (
              producto.aportes.length !== 1 &&
              !resumenConciliacionEntrega(
                producto,
                lineas[producto.producto] ?? lineaVacia(),
                aportes,
              ).coincide
            )
              erroresRecepcion[`lotes_${producto.producto}`] = [
                "conciliacionIncompleta",
              ];
          }
        }
        if (Object.keys(erroresRecepcion).length) {
          mostrarErrores(erroresRecepcion);
          establecerFallo("revisarErrores");
          return;
        }
      }
      if (
        accion !== "devolver" &&
        (modificado || !hoja.id || hoja.receptor_por_registrar)
      ) {
        const preparada = prepararLineas(lineas);
        if (Object.keys(preparada.errores).length) {
          mostrarErrores(preparada.errores);
          establecerFallo("revisarErrores");
          return;
        }
        const elegidos = Object.values(aportes).filter(
          (a) => a.peso_recibido_kg !== "" || a.peso_rechazado_kg !== "",
        );
        const aporteInvalido = (aporte: AporteEditable) => {
          const recibido = medirEntrega(aporte.peso_recibido_kg);
          const rechazado = medirEntrega(aporte.peso_rechazado_kg);
          return (
            recibido === null || rechazado === null || rechazado > recibido
          );
        };
        if (oficina && elegidos.some(aporteInvalido)) {
          establecerFallo("revisarLotes");
          mostrarErrores(
            Object.fromEntries(
              hoja.origen.productos
                .filter((producto) =>
                  producto.aportes.some((aporte) => {
                    const elegido = elegidos.find(
                      (fila) =>
                        fila.carga === aporte.carga &&
                        fila.lote === aporte.lote,
                    );
                    return elegido && aporteInvalido(elegido);
                  }),
                )
                .map((producto) => [
                  `lotes_${producto.producto}`,
                  ["conciliacionIncompleta"],
                ]),
            ),
          );
          return;
        }
        const resultado = await solicitar({
          ruta,
          cuerpo: JSON.stringify({
            version: actual.version,
            clave_operacion: crearClaveOperacion(),
            fecha_recepcion: fecha || null,
            recibido_por: recibidoPor,
            lineas: preparada.filas,
            aportes: oficina
              ? elegidos.map((a) => ({
                  ...a,
                  peso_recibido_kg: normalizarMedicion(a.peso_recibido_kg),
                  peso_rechazado_kg: normalizarMedicion(a.peso_rechazado_kg),
                }))
              : [],
          }),
        });
        if (!resultado) return;
        actual = resultado;
      }
      if (archivo && accion !== "devolver") {
        const formulario = new FormData();
        formulario.set("version", actual.version);
        formulario.set("clave_operacion", crearClaveOperacion());
        formulario.set("comprobante", archivo);
        const resultado = await solicitar({
          ruta: `${ruta}comprobante/`,
          cuerpo: formulario,
          archivo: true,
        });
        if (!resultado) return;
        actual = resultado;
      }
      if (accion !== "guardar") {
        const resultado = await solicitar({
          ruta: `${ruta}${accion}/`,
          cuerpo: JSON.stringify({
            version: actual.version,
            clave_operacion: crearClaveOperacion(),
          }),
        });
        if (!resultado) return;
      }
      establecerAviso(
        accion === "guardar"
          ? "guardado"
          : accion === "enviar"
            ? "enviada"
            : accion === "confirmar"
              ? "confirmada"
              : "devuelta",
      );
    } finally {
      ejecutando.current = false;
      if (vigente.current) establecerOcupado(false);
    }
  }
  const cambiar = (accion: () => void) => {
    accion();
    establecerModificado(true);
    establecerAviso("");
    if (["revisarErrores", "revisarLotes"].includes(fallo)) establecerFallo("");
  };
  const limpiarError = (clave: string) =>
    establecerErrores((anteriores) => {
      const siguientes = { ...anteriores };
      delete siguientes[clave];
      return siguientes;
    });
  return {
    ruta,
    hoja,
    fecha,
    recibidoPor,
    lineas,
    aportes,
    archivo,
    modificado,
    ocupado,
    fallo,
    errores,
    revisionErrores,
    aviso,
    incierto,
    oficina,
    operar,
    reintentarConsulta: () => {
      establecerFallo("");
      establecerRevisionConsulta((valor) => valor + 1);
    },
    cambiarFecha: (valor: string) =>
      cambiar(() => {
        establecerFecha(valor);
        limpiarError("fecha_recepcion");
      }),
    cambiarRecibidoPor: (valor: string) =>
      cambiar(() => {
        establecerRecibidoPor(valor);
        limpiarError("recibido_por");
      }),
    cambiarCampo: (producto: number, campo: CampoRecepcion, valor: string) =>
      cambiar(() => {
        establecerLineas((anteriores) => ({
          ...anteriores,
          [producto]: {
            ...(anteriores[producto] ?? lineaVacia()),
            [campo]: valor,
          },
        }));
        limpiarError(`${producto}_${campo}`);
      }),
    cambiarLineas: (valor: Record<number, LineaEditable>) =>
      cambiar(() => establecerLineas(valor)),
    cambiarAportes: (valor: Record<string, AporteEditable>) =>
      cambiar(() => {
        establecerAportes(valor);
        for (const producto of hoja?.origen.productos ?? []) {
          if (
            producto.aportes.some(
              (aporte) =>
                valor[`${aporte.carga}-${aporte.lote}`] !==
                aportes[`${aporte.carga}-${aporte.lote}`],
            )
          )
            limpiarError(`lotes_${producto.producto}`);
        }
      }),
    cambiarArchivo: (valor: File | null) => establecerArchivo(valor),
  };
}
