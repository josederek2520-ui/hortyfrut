"use client";
import { useTranslations } from "next-intl";
import { ArrowRight, Save, LoaderCircle } from "lucide-react";
import Button from "@/components/ui/button/Button";
import { panelEntrega, type HojaEntrega, type PermisosEntregas } from "./tipos";
import estilos from "./estilosEntregas.module.css";

export default function AccionesRecepcionEntrega({
  hoja,
  permisos,
  editable,
  oficina,
  ocupado,
  incierto,
  modificado,
  alSalir,
  alGuardar,
  alEnviar,
  alConfirmar,
  alDevolver,
  progreso,
}: {
  hoja: HojaEntrega;
  permisos: PermisosEntregas;
  editable: boolean;
  oficina: boolean;
  ocupado: boolean;
  incierto: boolean;
  modificado: boolean;
  alSalir: () => void;
  alGuardar: () => void;
  alEnviar: () => void;
  alConfirmar: () => void;
  alDevolver: () => void;
  progreso?: { completos: number; total: number };
}) {
  const t = useTranslations("entregas");
  const mensaje = ocupado
    ? "procesando"
    : incierto
      ? "resultadoPorComprobar"
      : modificado
        ? "sinGuardar"
        : hoja.estado === "confirmada"
          ? "confirmadaSoloConsulta"
          : hoja.estado === "revision"
            ? "revisionOficina"
            : hoja.id
              ? "borradorGuardado"
              : "recepcionSinRegistrar";
  return (
    <footer
      className={
        panelEntrega +
        ` ${estilos.barra} sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 p-4`
      }
    >
      <div className="min-w-0 space-y-1.5">
        {progreso && hoja.estado !== "confirmada" && (
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
            <span>{t("progresoProductos", progreso)}</span>
            <progress
              aria-label={t("progresoProductos", progreso)}
              value={progreso.completos}
              max={Math.max(1, progreso.total)}
              className="h-1.5 w-24 accent-brand-500"
            />
          </div>
        )}
        <p
          role="status"
          className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
        >
          {ocupado && (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
          )}
          {t(mensaje)}
        </p>
      </div>
      <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
        <Button variant="outline" disabled={ocupado} onClick={alSalir}>
          {t("salir")}
        </Button>
        {editable && (
          <Button
            variant="outline"
            disabled={ocupado || incierto}
            startIcon={<Save className="size-4" />}
            onClick={alGuardar}
          >
            {t(hoja.estado === "revision" ? "guardarCambios" : "guardar")}
          </Button>
        )}
        {(hoja.acciones?.enviar ?? permisos.enviar) &&
          ["pendiente", "borrador"].includes(hoja.estado) && (
            <Button
              disabled={
                ocupado ||
                incierto ||
                (!hoja.id && !permisos.crear) ||
                (modificado && !editable)
              }
              endIcon={<ArrowRight className="size-4 rtl:rotate-180" />}
              onClick={alEnviar}
            >
              {t("enviarRevision")}
            </Button>
          )}
        {oficina && hoja.estado === "revision" && (
          <>
            <Button
              variant="outline"
              disabled={ocupado || incierto}
              onClick={alDevolver}
            >
              {t("devolver")}
            </Button>
            <Button disabled={ocupado || incierto} onClick={alConfirmar}>
              {t("confirmar")}
            </Button>
          </>
        )}
      </div>
    </footer>
  );
}
