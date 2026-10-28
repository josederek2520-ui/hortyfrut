"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import { api, ApiError as ErrorApi } from "@/lib/api";
import type { Session as Sesion } from "@/components/users/types";
import FormularioCliente from "./FormularioCliente";
import useAvisosClientes from "./useAvisosClientes";
import type { Cliente } from "./tipos";

export default function EditorCliente({
  identificador,
  sesion,
}: {
  identificador?: string;
  sesion: Sesion;
}) {
  const t = useTranslations("clientes");
  const { avisos, cerrarAviso, tratarError } = useAvisosClientes();
  const [cliente, establecerCliente] = useState<Cliente | null>(null);
  const [fallo, establecerFallo] = useState("");
  const [revision, establecerRevision] = useState(0);
  const permitido =
    sesion.permisos_clientes.ver &&
    (identificador
      ? sesion.permisos_clientes.editar
      : sesion.permisos_clientes.crear);
  useEffect(() => {
    if (!permitido || !identificador) return;
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
  }, [permitido, identificador, revision, t, tratarError]);
  return (
    <>
      {!permitido ? (
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => establecerRevision((valor) => valor + 1)}
          >
            {t("reintentar")}
          </Button>
        </div>
      ) : identificador && !cliente ? (
        <p
          role="status"
          className="py-12 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          {t("cargando")}
        </p>
      ) : (
        <FormularioCliente
          key={cliente?.version || "nuevo"}
          cliente={cliente}
          alError={tratarError}
          alRecargar={() => {
            establecerCliente(null);
            establecerRevision((valor) => valor + 1);
          }}
        />
      )}
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </>
  );
}
