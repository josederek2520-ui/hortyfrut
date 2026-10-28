"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import { useToast as useNotificaciones } from "@/hooks/useToast";
import { api, ApiError as ErrorApi } from "@/lib/api";
import EncabezadoProducto from "./EncabezadoProducto";
import GestionPresentaciones from "./presentaciones/GestionPresentaciones";
import GestionUnidadesInventario from "@/components/inventario/GestionUnidadesInventario";
import type { Producto } from "./tipos";
import type { Session as Sesion } from "@/components/users/types";

export default function VistaProducto({
  identificador,
  sesion,
}: {
  identificador: string;
  sesion: Sesion;
}) {
  const t = useTranslations("productos");
  const navegador = useRouter();
  const {
    toasts: avisos,
    notify: notificar,
    dismiss: cerrarAviso,
  } = useNotificaciones();
  const [producto, establecerProducto] = useState<Producto | null>(null);
  const [fallo, establecerFallo] = useState("");
  const [revision, establecerRevision] = useState(0);
  const alError = useCallback(
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
            : error instanceof ErrorApi && error.status === 400
              ? "validacion"
              : error instanceof ErrorApi && error.status === 409
                ? "conflicto"
                : "errorCarga",
        ),
        "error",
      );
    },
    [navegador, notificar, t],
  );
  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      const aviso = sessionStorage.getItem("catalogos:productos:aviso");
      if (aviso === "creado" || aviso === "editado") {
        sessionStorage.removeItem("catalogos:productos:aviso");
        notificar(t(aviso));
      }
    }, 0);
    return () => window.clearTimeout(temporizador);
  }, [notificar, t]);
  useEffect(() => {
    if (!sesion.permisos_productos.ver) return;
    const controlador = new AbortController();
    api<Producto>(`productos/${identificador}/`, { signal: controlador.signal })
      .then((datos) => {
        if (!controlador.signal.aborted) {
          establecerProducto(datos);
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
          alError(error);
        }
      });
    return () => controlador.abort();
  }, [identificador, sesion.permisos_productos.ver, revision, t, alError]);
  const recargar = () => {
    establecerProducto(null);
    establecerFallo("");
    establecerRevision((valor) => valor + 1);
  };
  return (
    <>
      {!sesion.permisos_productos.ver ? (
        <div
          role="alert"
          className="superficie-cristal rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-gray-900"
        >
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
          <div className="flex gap-3">
            <Button size="sm" variant="outline" onClick={recargar}>
              {t("reintentar")}
            </Button>
            <Link
              href="/productos"
              className="inline-flex items-center rounded-lg px-3 text-brand-600 dark:text-brand-300"
            >
              {t("volver")}
            </Link>
          </div>
        </div>
      ) : !producto ? (
        <div role="status" className="space-y-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("cargando")}
          </p>
          <div className="h-44 rounded-2xl bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800" />
          <div className="h-80 rounded-2xl bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800" />
        </div>
      ) : (
        <div className="space-y-7">
          <EncabezadoProducto
            producto={producto}
            editar={sesion.permisos_productos.editar}
          />
          <GestionPresentaciones
            producto={producto}
            permisos={sesion.permisos_presentaciones}
            alError={alError}
            alNotificar={notificar}
            alRecargarProducto={recargar}
          />
          <GestionUnidadesInventario
            producto={producto.id}
            puedeGestionar={!!sesion.permisos_inventario?.gestionar_unidades}
            alError={alError}
            alNotificar={notificar}
          />
        </div>
      )}
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </>
  );
}
