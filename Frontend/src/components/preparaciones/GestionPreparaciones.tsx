"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList as IconoPreparacion } from "lucide-react";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import { clasePanel } from "@/components/compras/tipos";
import type { Session as Sesion } from "@/components/users/types";
import useAvisosPreparaciones from "./useAvisosPreparaciones";
import HojaConsolidada from "./HojaConsolidada";
import HistorialPreparaciones from "./HistorialPreparaciones";

export default function GestionPreparaciones({
  sesion,
  historial = false,
  clienteInicial,
  fechaInicial,
}: {
  sesion: Sesion;
  historial?: boolean;
  clienteInicial?: number;
  fechaInicial?: string;
}) {
  const t = useTranslations("preparaciones");
  const { avisos, cerrarAviso, tratarError } = useAvisosPreparaciones();
  const [vista, establecerVista] = useState(historial ? "historial" : "hoja");
  if (!sesion.permisos_preparaciones?.ver)
    return (
      <p role="alert" className={`${clasePanel} p-8`}>
        {t("restringido")}
      </p>
    );
  return (
    <div className="space-y-6">
      <MigasPagina pageTitle={t("titulo")} />
      <section className={`${clasePanel} p-5 sm:p-6`}>
        <h1 className="flex items-center gap-3 text-2xl font-semibold text-gray-900 dark:text-white">
          <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <IconoPreparacion className="size-6" aria-hidden="true" />
          </span>
          {t("titulo")}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t("subtitulo")}
        </p>
        <div
          className="mt-5 flex flex-wrap gap-2"
          role="group"
          aria-label={t("vistas")}
        >
          <Button
            variant={vista === "hoja" ? "primary" : "outline"}
            size="sm"
            aria-pressed={vista === "hoja"}
            onClick={() => establecerVista("hoja")}
          >
            {t("hojaConsolidada")}
          </Button>
          <Button
            variant={vista === "historial" ? "primary" : "outline"}
            size="sm"
            aria-pressed={vista === "historial"}
            onClick={() => establecerVista("historial")}
          >
            {t("historial")}
          </Button>
        </div>
      </section>
      <div hidden={vista !== "hoja"}>
        <HojaConsolidada
          clienteInicial={clienteInicial}
          fechaInicial={fechaInicial}
          puedeCrear={sesion.permisos_preparaciones.crear}
          alError={tratarError}
        />
      </div>
      {vista === "historial" && (
        <HistorialPreparaciones alError={tratarError} />
      )}
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </div>
  );
}
