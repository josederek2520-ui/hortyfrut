"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import type { Session as Sesion } from "@/components/users/types";
import { useModal } from "@/hooks/useModal";
import { api, ApiError as ErrorApi } from "@/lib/api";
import FormularioAlmacen from "./FormularioAlmacen";
import DetalleAlmacen from "./DetalleAlmacen";
import ConfirmarEstadoAlmacen from "./ConfirmarEstadoAlmacen";
import useAvisosAlmacenes from "./useAvisosAlmacenes";
import { clasePanel, type Almacen } from "./tipos";

export default function FichaAlmacen({
  identificador,
  modo,
  sesion,
}: {
  identificador?: string;
  modo: "nuevo" | "editar" | "detalle";
  sesion: Sesion;
}) {
  const t = useTranslations("almacenes");
  const { avisos, notificar, cerrarAviso, tratarError } = useAvisosAlmacenes(
    modo === "detalle",
  );
  const [almacen, establecerAlmacen] = useState<Almacen | null>(null);
  const [fallo, establecerFallo] = useState("");
  const [cargando, establecerCargando] = useState(!!identificador);
  const [revision, establecerRevision] = useState(0);
  const modal = useModal();
  const permisos = sesion.permisos_almacenes;
  const permitido =
    permisos.ver &&
    (modo === "nuevo"
      ? permisos.crear
      : modo === "editar"
        ? permisos.editar
        : true);
  useEffect(() => {
    if (!permitido || !identificador) return;
    const controlador = new AbortController();
    void api<Almacen>(`almacenes/${identificador}/`, {
      signal: controlador.signal,
    })
      .then((datos) => {
        if (!controlador.signal.aborted) {
          establecerAlmacen(datos);
          establecerFallo("");
          establecerCargando(false);
        }
      })
      .catch((error) => {
        if (!controlador.signal.aborted) {
          establecerFallo(
            t(
              error instanceof ErrorApi && error.status === 404
                ? "noEncontrado"
                : "errorCarga",
            ),
          );
          establecerCargando(false);
          tratarError(error);
        }
      });
    return () => controlador.abort();
  }, [permitido, identificador, revision, t, tratarError]);
  const recargar = () => {
    modal.closeModal();
    establecerFallo("");
    establecerCargando(true);
    establecerRevision((valor) => valor + 1);
  };
  return (
    <>
      {!permitido ? (
        <div role="alert" className={`${clasePanel} p-8 text-center`}>
          <h1 className="font-semibold text-gray-900 dark:text-white">
            {t("restringido")}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t("accesoDenegado")}
          </p>
        </div>
      ) : fallo ? (
        <div role="alert" className={`${clasePanel} space-y-4 p-8`}>
          <p className="text-sm text-error-600 dark:text-error-400">{fallo}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm" variant="outline" onClick={recargar}>
              {t("reintentar")}
            </Button>
            <Link
              href="/almacenes"
              className="text-sm text-brand-600 dark:text-brand-300"
            >
              {t("volver")}
            </Link>
          </div>
        </div>
      ) : cargando ? (
        <div
          role="status"
          className={`${clasePanel} p-10 text-center text-sm text-gray-500 dark:text-gray-400`}
        >
          {t("cargando")}
        </div>
      ) : modo === "detalle" && almacen ? (
        <DetalleAlmacen
          almacen={almacen}
          permisos={permisos}
          alEstado={modal.openModal}
        />
      ) : (
        <FormularioAlmacen
          key={almacen?.version || "nuevo"}
          almacen={almacen}
          alError={tratarError}
          alRecargar={recargar}
        />
      )}
      {modal.isOpen && almacen && (
        <ConfirmarEstadoAlmacen
          almacen={almacen}
          alCerrar={modal.closeModal}
          alRecargar={recargar}
          alError={tratarError}
          alGuardar={() => {
            notificar(t("estadoGuardado"));
            recargar();
          }}
        />
      )}
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </>
  );
}
