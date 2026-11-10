"use client";
import {
  Check as IconoGuardado,
  PencilLine as IconoPendiente,
  LoaderCircle as IconoGuardando,
  AlertCircle as IconoConflicto,
  ClipboardList as IconoVacio,
} from "lucide-react";
import estilos from "./estilosTrabajo.module.css";

export type SituacionBorradorPreparacion =
  "guardando" | "modificado" | "guardado" | "vacio" | "conflicto";

export default function EstadoBorradorPreparacion({
  situacion,
  estado,
  codigo,
  ayuda,
}: {
  situacion: SituacionBorradorPreparacion;
  estado: string;
  codigo?: string;
  ayuda?: string;
}) {
  const IconoEstado = {
    guardando: IconoGuardando,
    modificado: IconoPendiente,
    guardado: IconoGuardado,
    vacio: IconoVacio,
    conflicto: IconoConflicto,
  }[situacion];
  const colorEstado =
    situacion === "conflicto"
      ? "bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-300"
      : situacion === "modificado"
        ? "bg-warning-50 text-warning-800 dark:bg-warning-500/10 dark:text-warning-300"
        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {codigo && (
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {codigo}
        </span>
      )}
      <p
        key={situacion}
        role="status"
        aria-atomic="true"
        title={ayuda}
        className={`${estilos.estado} ${colorEstado} inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-theme-xs font-medium`}
      >
        <IconoEstado
          className={`size-4 shrink-0 ${situacion === "guardando" ? "animate-spin motion-reduce:animate-none" : ""}`}
          aria-hidden="true"
        />
        {estado}
      </p>
    </div>
  );
}
