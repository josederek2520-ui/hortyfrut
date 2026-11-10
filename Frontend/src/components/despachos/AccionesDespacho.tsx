"use client";
import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Send, Ban } from "lucide-react";
import Button from "@/components/ui/button/Button";
import Confirmacion from "@/components/logistica/ConfirmacionLogistica";
import { api, ApiError as ErrorApi } from "@/lib/api";
import type { DetalleDespacho, PermisosDespachos } from "./tipos";
import { comprobarCapacidadDespacho } from "./capacidadDespacho";

export default function AccionesDespacho({
  despacho,
  permisos,
  alActualizar,
  alError,
  soloEnvio = false,
  deshabilitado = false,
}: {
  soloEnvio?: boolean;
  deshabilitado?: boolean;
  despacho: DetalleDespacho;
  permisos: PermisosDespachos;
  alActualizar: (despacho: DetalleDespacho) => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("despachos"),
    comun = useTranslations("logistica"),
    idioma = useLocale();
  const [accion, establecerAccion] = useState<"enviar" | "cancelar" | null>(
    null,
  );
  const [ocupado, establecerOcupado] = useState(false),
    [error, establecerError] = useState("");
  const [permitirReintento, establecerPermitirReintento] = useState(false);
  const cuerpo = useRef<{ version: string; clave_operacion: string } | null>(
    null,
  );
  const candado = useRef(false);
  const capacidad =
    despacho.comprobacion_capacidad ??
    comprobarCapacidadDespacho(despacho.vehiculo_capacidad_kg, despacho.cargas);
  const puedeEnviar =
    despacho.estado === "borrador" && !despacho.enviado_en && permisos.enviar;
  const puedeCancelar =
    despacho.estado === "borrador" && permisos.cancelar && !soloEnvio;
  const elegir = (valor: "enviar" | "cancelar") => {
    cuerpo.current = {
      version: despacho.version,
      clave_operacion: crypto.randomUUID(),
    };
    establecerError("");
    establecerPermitirReintento(false);
    establecerAccion(valor);
  };
  const ejecutar = async () => {
    if (
      deshabilitado ||
      candado.current ||
      !accion ||
      !cuerpo.current ||
      (error && !permitirReintento)
    )
      return;
    candado.current = true;
    establecerOcupado(true);
    try {
      const actualizado = await api<DetalleDespacho>(
        `despachos/${despacho.id}/${accion}/`,
        {
          method: "POST",
          body: JSON.stringify(cuerpo.current),
        },
      );
      cuerpo.current = null;
      establecerAccion(null);
      alActualizar(actualizado);
    } catch (problema) {
      establecerPermitirReintento(
        problema instanceof ErrorApi &&
          (problema.status === 0 || problema.status >= 500),
      );
      const detalle =
        problema instanceof ErrorApi &&
        idioma === "es" &&
        problema.status === 400
          ? Object.values(problema.errors).flat().join(" ")
          : "";
      establecerError(
        detalle ||
          comun(
            problema instanceof ErrorApi && problema.status === 409
              ? "conflicto"
              : "errorOperacion",
          ),
      );
      alError(problema);
    } finally {
      candado.current = false;
      establecerOcupado(false);
    }
  };
  if (!puedeEnviar && !puedeCancelar) return null;
  return (
    <>
      <div className="flex flex-wrap gap-3">
        {puedeEnviar && (
          <Button
            size="sm"
            disabled={deshabilitado || ocupado || capacidad.estado !== "apta"}
            startIcon={<Send className="size-4" />}
            onClick={() => elegir("enviar")}
          >
            {t("acciones.enviar")}
          </Button>
        )}
        {puedeCancelar && (
          <Button
            size="sm"
            variant="outline"
            disabled={deshabilitado || ocupado}
            startIcon={<Ban className="size-4" />}
            onClick={() => elegir("cancelar")}
          >
            {t("acciones.cancelar")}
          </Button>
        )}
      </div>
      {accion && (
        <Confirmacion
          titulo={t(`acciones.${accion}`)}
          descripcion={t(`confirmaciones.${accion}`, {
            chofer: despacho.chofer_nombre,
          })}
          accion={t(`acciones.${accion}`)}
          ocupado={ocupado || deshabilitado}
          error={error}
          permitirReintento={permitirReintento}
          alCerrar={() => establecerAccion(null)}
          alConfirmar={() => void ejecutar()}
        />
      )}
    </>
  );
}
