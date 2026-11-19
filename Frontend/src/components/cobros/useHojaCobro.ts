"use client";
import { useEffect, useRef, useState } from "react";
import { crearClaveOperacion } from "@/lib/chofer/infraestructura/crearClaveOperacion";
import { hoyBolivia } from "@/components/ventas/calculosVenta";
import useOperacionComercial from "@/components/comercial/useOperacionComercial";
import { prepararCobro, requiereComprobante } from "./calculosCobro";
import { consultarSaldosCobro } from "./consultarSaldosCobro";
import type { Cobro, FormularioCobro, RevisionCobro } from "./tipos";
import type { ClienteVenta } from "@/components/ventas/tipos";

const nuevoFormulario = (): FormularioCobro => ({
  cliente: null,
  fecha_cobro: hoyBolivia(),
  importe: "",
  medio: "efectivo",
  comprobante: null,
  aplicaciones: [],
});
export default function useHojaCobro(opciones?: {
  ruta?: "cobros" | "mis-pagos";
  cliente?: ClienteVenta | null;
}) {
  const ruta = opciones?.ruta ?? "cobros";
  const [formulario, establecerFormulario] = useState<FormularioCobro>(() => ({
      ...nuevoFormulario(),
      ...(ruta === "mis-pagos"
        ? {
            medio: "transferencia" as const,
            cliente: opciones?.cliente ?? null,
          }
        : {}),
    })),
    [modificado, establecerModificado] = useState(false);
  const [revision, establecerRevision] = useState<RevisionCobro | null>(null),
    [errores, establecerErrores] = useState<string[]>([]);
  const [actualizando, establecerActualizando] = useState(false),
    [falloActualizacion, establecerFalloActualizacion] = useState(false);
  const operacion = useOperacionComercial();
  const entrada = useRef<ReturnType<typeof prepararCobro>["cuerpo"] | null>(
      null,
    ),
    comprobanteRevisado = useRef<File | null>(null),
    vigente = useRef(true),
    controlador = useRef<AbortController | null>(null);
  useEffect(() => {
    vigente.current = true;
    const retirar = () => {
      vigente.current = false;
      controlador.current?.abort();
      entrada.current = null;
      comprobanteRevisado.current = null;
    };
    const almacenamiento = (evento: StorageEvent) => {
      if (evento.key === "hortyfru-cambio-sesion") retirar();
    };
    window.addEventListener("hortyfru:session-changed", retirar);
    window.addEventListener("storage", almacenamiento);
    return () => {
      retirar();
      window.removeEventListener("hortyfru:session-changed", retirar);
      window.removeEventListener("storage", almacenamiento);
    };
  }, []);
  const bloqueado = operacion.ocupado || operacion.incierto || actualizando;
  function cambiar(cambio: Partial<FormularioCobro>) {
    if (bloqueado || !vigente.current) return;
    establecerFormulario((anterior) => {
      const siguiente = { ...anterior, ...cambio };
      if (!requiereComprobante(siguiente.medio)) siguiente.comprobante = null;
      return siguiente;
    });
    establecerModificado(true);
    establecerRevision(null);
    entrada.current = null;
    comprobanteRevisado.current = null;
    establecerErrores([]);
  }
  async function operar(accion: "revisar" | "registrar" | "reintentar") {
    if (actualizando || !vigente.current) return null;
    let resultado;
    if (accion === "reintentar")
      resultado = await operacion.enviar<
        Pick<Cobro, "id" | "codigo"> | RevisionCobro
      >();
    else if (accion === "revisar") {
      establecerRevision(null);
      const preparado = prepararCobro(formulario, crearClaveOperacion());
      establecerErrores(preparado.errores);
      if (preparado.errores.length) return null;
      entrada.current = preparado.cuerpo;
      comprobanteRevisado.current = formulario.comprobante;
      resultado = await operacion.enviar<RevisionCobro>(
        ruta + "/revisar/",
        preparado.cuerpo,
        comprobanteRevisado.current ?? undefined,
      );
    } else {
      if (!entrada.current || !revision) return null;
      resultado = await operacion.enviar<Pick<Cobro, "id" | "codigo">>(
        ruta + "/",
        {
          ...entrada.current,
          revision: revision.revision,
        },
        comprobanteRevisado.current ?? undefined,
      );
    }
    if (!resultado || !vigente.current) {
      if (vigente.current && accion === "registrar") establecerRevision(null);
      return null;
    }
    if ("id" in resultado.datos) {
      establecerModificado(false);
      establecerRevision(null);
      return resultado.datos;
    }
    establecerRevision(resultado.datos);
    return null;
  }
  async function actualizarSaldos() {
    if (bloqueado || !formulario.cliente || !formulario.aplicaciones.length)
      return;
    establecerActualizando(true);
    establecerFalloActualizacion(false);
    establecerRevision(null);
    entrada.current = null;
    controlador.current = new AbortController();
    const signal = controlador.current.signal;
    try {
      const saldos = await consultarSaldosCobro(
        formulario.cliente.id,
        formulario.aplicaciones.map((f) => f.id),
        signal,
        ruta,
      );
      if (!vigente.current || signal.aborted) return;
      establecerFormulario((anterior) => ({
        ...anterior,
        aplicaciones: anterior.aplicaciones.map((fila) => ({
          ...saldos.find((saldo) => saldo.id === fila.id)!,
          importeAplicado: fila.importeAplicado,
        })),
      }));
    } catch {
      if (vigente.current && !signal.aborted)
        establecerFalloActualizacion(true);
    } finally {
      if (vigente.current && !signal.aborted) establecerActualizando(false);
    }
  }
  return {
    formulario,
    cambiar,
    modificado,
    revision,
    cerrarRevision: () => establecerRevision(null),
    errores,
    operacion,
    bloqueado,
    actualizando,
    falloActualizacion,
    actualizarSaldos,
    operar,
  };
}
