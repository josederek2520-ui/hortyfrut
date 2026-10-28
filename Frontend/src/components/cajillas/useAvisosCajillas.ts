"use client";
import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/api";
import { useToast } from "@/hooks/useToast";

export default function useAvisosCajillas() {
  const t = useTranslations("cajillas");
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
          error instanceof ApiError && error.status === 403
            ? "restringido"
            : error instanceof ApiError && error.status === 409
              ? "conflicto"
              : error instanceof ApiError && error.status === 400
                ? "validacion"
                : "errorCarga",
        ),
        "error",
      );
    },
    [t, notificar, navegador],
  );
  return { avisos, notificar, cerrarAviso, tratarError };
}
