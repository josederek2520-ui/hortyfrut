"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import ColorCajilla from "@/components/cajillas/ColorCajilla";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import type { CajillaEditable } from "./tipos";
import { numeroRevisionPreparacion } from "./revisionPorSucursalPreparacion";

export default function CajillasRevisionPreparacion({
  filas,
}: {
  filas: CajillaEditable[];
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  const [pagina, establecerPagina] = useState(1);
  const paginaActual = Math.min(
    pagina,
    Math.max(1, Math.ceil(filas.length / 10)),
  );
  if (!filas.length)
    return (
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {t("sinPrevisionRevision")}
      </span>
    );
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-2">
        {filas.slice((paginaActual - 1) * 10, paginaActual * 10).map((fila) => (
          <li
            key={fila.clave}
            className="inline-flex flex-wrap items-center gap-x-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-theme-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            <ColorCajilla color={fila.color.nombre} punto />
            <span>
              ·{" "}
              {/^\d+$/.test(fila.cantidad)
                ? t("conteoCajillasRevision", {
                    cantidad: Number(fila.cantidad),
                  })
                : numeroRevisionPreparacion(fila.cantidad, idioma)}
            </span>
          </li>
        ))}
      </ul>
      {filas.length > 10 && (
        <PaginadorCompras
          pagina={paginaActual}
          total={filas.length}
          alCambiar={establecerPagina}
        />
      )}
    </div>
  );
}
