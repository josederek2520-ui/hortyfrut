"use client";
import { useTranslations } from "next-intl";
import {
  ArrowLeft as IconoVolver,
  RefreshCw as IconoRecargar,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Session as Sesion } from "@/components/users/types";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import useAvisos from "@/components/logistica/useAvisosLogistica";
import useConsulta from "@/components/logistica/useConsultaLogistica";
import EstadoConsulta from "@/components/logistica/EstadoConsultaLogistica";
import FormularioDespacho from "./FormularioDespacho";
import DetalleDespacho from "./DetalleDespacho";
import type { DetalleDespacho as DatosDespacho } from "./tipos";

export default function FichaDespacho({
  sesion,
  modo,
  identificador,
}: {
  sesion: Sesion;
  modo: "nuevo" | "editar" | "detalle";
  identificador?: string;
}) {
  const t = useTranslations("despachos");
  const comun = useTranslations("logistica");
  const avisos = useAvisos();
  const permisos = sesion.permisos_despachos;
  const consulta = useConsulta<DatosDespacho>(
    identificador && permisos.ver ? `despachos/${identificador}/` : null,
    avisos.tratarError,
  );
  const autorizado =
    permisos.ver &&
    (modo === "nuevo"
      ? permisos.crear
      : modo === "editar"
        ? permisos.editar
        : true);
  const mostrarFormulario =
    modo !== "detalle" &&
    (!consulta.datos ||
      (consulta.datos.estado === "borrador" && !consulta.datos.enviado_en));
  return (
    <>
      <div className="space-y-4">
        {modo === "detalle" && (
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/despachos"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm text-gray-500 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-400"
            >
              <IconoVolver className="size-4 rtl:rotate-180" />
              {t("volver")}
            </Link>
            {modo === "detalle" && (
              <Button
                size="sm"
                variant="outline"
                onClick={consulta.recargar}
                disabled={consulta.cargando}
                startIcon={<IconoRecargar className="size-4" />}
              >
                {comun("recargar")}
              </Button>
            )}
          </div>
        )}
        {!mostrarFormulario && (
          <div>
            <MigasPagina
              pageTitle={
                modo === "nuevo"
                  ? t("nuevo")
                  : consulta.datos?.codigo || t("titulo")
              }
            />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("subtituloDetalle")}
            </p>
          </div>
        )}
        {!autorizado ? (
          <p role="alert">{comun("sinPermiso")}</p>
        ) : modo !== "nuevo" &&
          (consulta.cargando || consulta.fallo || !consulta.datos) ? (
          <EstadoConsulta
            cargando={consulta.cargando}
            fallo={consulta.fallo}
            alRecargar={consulta.recargar}
          />
        ) : mostrarFormulario ? (
          <FormularioDespacho
            key={consulta.datos?.version || "nuevo"}
            despacho={consulta.datos || undefined}
            permisos={permisos}
            alError={avisos.tratarError}
          />
        ) : (
          consulta.datos && (
            <DetalleDespacho
              despacho={consulta.datos}
              permisos={permisos}
              alError={avisos.tratarError}
              alActualizar={(datos) => {
                consulta.establecerDatos(datos);
                avisos.notificar(comun("guardado"));
              }}
            />
          )
        )}
      </div>
      <Notificaciones toasts={avisos.avisos} onDismiss={avisos.cerrarAviso} />
    </>
  );
}
