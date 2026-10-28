"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import { api, ApiError as ErrorApi } from "@/lib/api";
import type { Session as Sesion } from "@/components/users/types";
import EncabezadoCliente from "./EncabezadoCliente";
import GestionDirectorio from "./GestionDirectorio";
import useAvisosClientes from "./useAvisosClientes";
import type { Cliente } from "./tipos";

export default function VistaCliente({
  identificador,
  sesion,
}: {
  identificador: string;
  sesion: Sesion;
}) {
  const t = useTranslations("clientes");
  const { avisos, notificar, cerrarAviso, tratarError } =
    useAvisosClientes(true);
  const [cliente, establecerCliente] = useState<Cliente | null>(null);
  const [fallo, establecerFallo] = useState("");
  const [revision, establecerRevision] = useState(0);
  useEffect(() => {
    if (!sesion.permisos_clientes.ver) return;
    const controlador = new AbortController();
    api<Cliente>(`clientes/${identificador}/`, { signal: controlador.signal })
      .then((datos) => {
        if (!controlador.signal.aborted) {
          establecerCliente(datos);
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
  }, [identificador, sesion.permisos_clientes.ver, revision, t, tratarError]);
  const recargar = () => {
    establecerCliente(null);
    establecerFallo("");
    establecerRevision((valor) => valor + 1);
  };
  return (
    <>
      {!sesion.permisos_clientes.ver ? (
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
              href="/clientes"
              className="inline-flex items-center rounded-lg px-3 text-brand-600 dark:text-brand-300"
            >
              {t("volver")}
            </Link>
          </div>
        </div>
      ) : !cliente ? (
        <div role="status" className="space-y-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("cargando")}
          </p>
          <div className="h-44 rounded-2xl bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800" />
          <div className="h-80 rounded-2xl bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800" />
        </div>
      ) : (
        <div className="space-y-7">
          <EncabezadoCliente
            cliente={cliente}
            editar={sesion.permisos_clientes.editar}
          />
          <GestionDirectorio
            puedeAsignarEncargado={sesion.puede_asignar_encargado}
            cliente={cliente}
            permisos={sesion.permisos_sucursales}
            alError={tratarError}
            alNotificar={notificar}
            alRecargarFicha={recargar}
          />
        </div>
      )}
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </>
  );
}
