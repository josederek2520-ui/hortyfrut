"use client";
import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/hooks/useToast";
import { ApiError } from "@/lib/api";

export default function useAvisosInventario() {
  const t = useTranslations("inventario");
  const navegador = useRouter();
  const {
    toasts: avisos,
    notify: notificar,
    dismiss: cerrarAviso,
  } = useToast();
  const tratarError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        navegador.replace("/signin");
        navegador.refresh();
        return;
      }
      notificar(
        t(
          error instanceof ApiError && error.status === 409
            ? "conflicto"
            : error instanceof ApiError && error.status === 403
              ? "restringido"
              : error instanceof ApiError && error.status === 400
                ? "validacion"
                : "errorCarga",
        ),
        "error",
      );
    },
    [navegador, notificar, t],
  );
  return { avisos, notificar, cerrarAviso, tratarError };
}
