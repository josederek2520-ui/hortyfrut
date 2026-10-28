"use client";
import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useToast as useNotificaciones } from "@/hooks/useToast";
import { ApiError as ErrorApi } from "@/lib/api";

export default function useAvisosPedidos() {
  const t = useTranslations("pedidos");
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
            ? "sinPermiso"
            : error instanceof ErrorApi && error.status === 409
              ? "conflicto"
              : error instanceof ErrorApi && error.status === 400
                ? "validacion"
                : "errorCarga",
        ),
        "error",
      );
    },
    [t, navegador, notificar],
  );
  return { avisos, notificar, cerrarAviso, tratarError };
}
