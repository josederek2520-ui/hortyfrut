"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronDown as IconoDesplegar,
  Package as IconoLote,
} from "lucide-react";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import ImagenProducto from "@/components/productos/ImagenProducto";
import { aMiles, deMiles, asignadoLote } from "./calculos";
import { numeroRevisionPreparacion } from "./revisionPorSucursalPreparacion";
import type { DocumentoEditable } from "./tipos";
import estilos from "./estilosTrabajo.module.css";

export default function ConsumoRevisionPreparacion({
  documento,
}: {
  documento: DocumentoEditable;
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  const [pagina, establecerPagina] = useState(1);
  const paginaActual = Math.min(
    pagina,
    Math.max(1, Math.ceil(documento.lineas.length / 10)),
  );
  const haySeparacion = documento.lineas.some(
    (fila) =>
      aMiles(fila.merma) > BigInt(0) ||
      aMiles(fila.aprovechable) > BigInt(0) ||
      fila.motivo.trim(),
  );
  return (
    <details
      open={haySeparacion ? true : undefined}
      className={`${estilos.desplegable} group/consumo rounded-xl border border-gray-200 px-4 dark:border-gray-700`}
    >
      <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center gap-2 rounded text-sm font-medium text-gray-700 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-200">
        <IconoLote
          aria-hidden="true"
          className="size-4 text-gray-500 dark:text-gray-400"
        />
        {t("trazabilidadAlmacenRevision")}
        {haySeparacion && (
          <span className="rounded-lg bg-orange-50 px-2 py-1 text-theme-xs text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
            {t("haySeparacionRevision")}
          </span>
        )}
        <IconoDesplegar
          aria-hidden="true"
          className="ms-auto size-4 transition-transform group-open/consumo:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div
        className={`${estilos.contenidoOpcional} space-y-3 border-t border-gray-100 py-4 dark:border-gray-800`}
      >
        <h3 className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
          {t("lotesMediciones")}
        </h3>
        {!documento.lineas.length && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("sinLotes")}
          </p>
        )}
        {documento.lineas
          .slice((paginaActual - 1) * 10, paginaActual * 10)
          .map((linea) => {
            const asignado = asignadoLote(documento, linea.lote.id);
            const utilizada =
              asignado + aMiles(linea.merma) + aMiles(linea.aprovechable);
            return (
              <article
                key={linea.lote.id}
                className="border-b border-gray-100 pb-4 last:border-0 dark:border-gray-800"
              >
                <div className="flex items-center gap-3">
                  <ImagenProducto
                    origen={linea.lote.producto_imagen || null}
                    nombre={linea.lote.producto_nombre}
                  />
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      {linea.lote.producto_nombre}
                    </h4>
                    <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                      {linea.lote.nombre}
                    </p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  {[
                    ["utilizada", deMiles(utilizada)],
                    ["asignadoPedidos", deMiles(asignado)],
                    ["merma", linea.merma || "0"],
                    ["aprovechable", linea.aprovechable || "0"],
                  ].map(([clave, valor]) => (
                    <div key={clave}>
                      <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                        {t(clave)}
                      </dt>
                      <dd className="mt-1 font-medium text-gray-800 tabular-nums dark:text-gray-100">
                        {numeroRevisionPreparacion(valor, idioma)}{" "}
                        {linea.lote.unidad_abreviatura}
                      </dd>
                    </div>
                  ))}
                </dl>
                {linea.motivo && (
                  <p className="mt-3 text-theme-xs text-gray-500 dark:text-gray-400">
                    {linea.motivo}
                  </p>
                )}
              </article>
            );
          })}
        {documento.lineas.length > 10 && (
          <PaginadorCompras
            pagina={paginaActual}
            total={documento.lineas.length}
            alCambiar={establecerPagina}
          />
        )}
      </div>
    </details>
  );
}
