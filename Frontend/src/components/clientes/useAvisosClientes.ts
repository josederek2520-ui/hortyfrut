"use client";
import { useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useToast as useNotificaciones } from "@/hooks/useToast";
import { ApiError as ErrorApi } from "@/lib/api";

export default function useAvisosClientes(consumir = false) {
  const t = useTranslations("clientes");
  const navegador = useRouter();
  const {
    toasts: avisos,
    notify: notificar,
    dismiss: cerrarAviso,
  } = useNotificaciones();
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
    if (!consumir) return;
    const temporizador = window.setTimeout(() => {
      try {
        const aviso = sessionStorage.getItem("clientes:aviso");
        if (aviso === "clienteCreado" || aviso === "clienteEditado") {
          sessionStorage.removeItem("clientes:aviso");
          notificar(t(aviso));
        }
      } catch {
        /* La navegación sigue disponible si el almacenamiento está bloqueado. */
      }
    }, 0);
    return () => window.clearTimeout(temporizador);
  }, [consumir, notificar, t]);
  return { avisos, notificar, cerrarAviso, tratarError };
}
