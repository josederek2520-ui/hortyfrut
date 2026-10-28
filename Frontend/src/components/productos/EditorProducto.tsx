"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import { useToast as useNotificaciones } from "@/hooks/useToast";
import { api, ApiError as ErrorApi } from "@/lib/api";
import FormularioProducto from "./FormularioProducto";
import type { Producto } from "./tipos";
import type { Session as Sesion } from "@/components/users/types";

export default function EditorProducto({
  identificador,
  sesion,
}: {
  identificador?: string;
  sesion: Sesion;
}) {
  const t = useTranslations("productos");
  const navegador = useRouter();
  const {
    toasts: avisos,
    notify: notificar,
    dismiss: cerrarAviso,
  } = useNotificaciones();
  const [registro, establecerRegistro] = useState<Producto | null>(null);
  const [fallo, establecerFallo] = useState("");
  const [revision, establecerRevision] = useState(0);
  const permisos = sesion.permisos_productos;
  const permitido =
    permisos.ver && (identificador ? permisos.editar : permisos.crear);
  const tratarError = useCallback(
    (error: unknown) => {
      if (error instanceof ErrorApi && error.status === 401) {
        navegador.replace("/signin");
        navegador.refresh();
        return;
      }
      notificar(
        t(
          error instanceof ErrorApi && error.status === 403
            ? "accesoDenegado"
            : error instanceof ErrorApi && error.status === 409
              ? "conflicto"
              : error instanceof ErrorApi && error.status === 400
                ? "validacion"
                : "errorCarga",
        ),
        "error",
      );
    },
    [navegador, notificar, t],
  );
  useEffect(() => {
    if (!permitido || !identificador) return;
    const controlador = new AbortController();
    api<Producto>(`productos/${identificador}/`, { signal: controlador.signal })
      .then((datos) => {
        if (!controlador.signal.aborted) {
          establecerRegistro(datos);
          establecerFallo("");
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
          tratarError(error);
        }
      });
    return () => controlador.abort();
  }, [permitido, identificador, revision, t, tratarError]);
  return (
    <>
      <div>
        {!permitido ? (
          <div className="superficie-cristal rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-gray-900">
            <h1 className="font-semibold text-gray-900 dark:text-white">
              {t("restringido")}
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {t("accesoDenegado")}
            </p>
          </div>
        ) : fallo ? (
          <div
            role="alert"
            className="space-y-4 rounded-2xl bg-error-50 p-6 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400"
          >
            <p>{fallo}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => establecerRevision((valor) => valor + 1)}
            >
              {t("reintentar")}
            </Button>
          </div>
        ) : identificador && !registro ? (
          <p
            role="status"
            className="py-12 text-center text-sm text-gray-500 dark:text-gray-400"
          >
            {t("cargando")}
          </p>
        ) : (
          <FormularioProducto
            key={registro?.version || "nuevo"}
            producto={registro}
            alError={tratarError}
            alRecargar={() => {
              establecerRegistro(null);
              establecerRevision((valor) => valor + 1);
            }}
          />
        )}
      </div>
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </>
  );
}
