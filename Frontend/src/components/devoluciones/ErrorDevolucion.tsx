"use client";
import { useTranslations } from "next-intl";

export default function ErrorDevolucion({
  mensajes,
  id,
}: {
  mensajes?: string[];
  id: string;
}) {
  const t = useTranslations("devoluciones");
  if (!mensajes?.length) return null;
  return (
    <p id={id} className="mt-1 text-xs text-error-700 dark:text-error-300">
      {mensajes
        .map((mensaje) =>
          t.has("errores." + mensaje) ? t("errores." + mensaje) : mensaje,
        )
        .join(" ")}
    </p>
  );
}
