"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  Table as Tabla,
  TableBody as Cuerpo,
  TableCell as Celda,
  TableHeader as Cabecera,
  TableRow as Fila,
} from "@/components/ui/table";
import { TimeIcon as IconoHistorial, EyeIcon as IconoVer } from "@/icons";
import type { RegistroActividad } from "./tipos";

export default function TablaActividad({
  registros,
  cargando,
  abriendo,
  alVer,
}: {
  registros: RegistroActividad[];
  cargando: boolean;
  abriendo: boolean;
  alVer: (registro: RegistroActividad) => void;
}) {
  const t = useTranslations("actividad");
  const idioma = useLocale();
  if (cargando)
    return (
      <div role="status" aria-label={t("cargando")} className="space-y-3">
        {[0, 1, 2, 3, 4].map((indice) => (
          <div
            key={indice}
            className="h-16 rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800"
          />
        ))}
      </div>
    );
  if (!registros.length)
    return (
      <div className="py-14 text-center">
        <IconoHistorial className="mx-auto mb-4 size-10 text-gray-400 dark:text-gray-500" />
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {t("sinRegistros")}
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t("sinRegistrosAyuda")}
        </p>
      </div>
    );
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <Tabla>
        <Cabecera className="bg-gray-50 dark:bg-gray-800/50">
          <Fila>
            {[
              "fecha",
              "responsable",
              "evento",
              "registro",
              "resultado",
              "detalle",
            ].map((clave) => (
              <Celda
                key={clave}
                isHeader
                className="px-4 py-3.5 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400"
              >
                {t(clave)}
              </Celda>
            ))}
          </Fila>
        </Cabecera>
        <Cuerpo>
          {registros.map((registro) => (
            <Fila
              key={registro.id}
              className="border-t border-gray-100 hover:bg-gray-50/70 dark:border-gray-800 dark:hover:bg-white/2"
            >
              <Celda className="px-4 py-4 whitespace-nowrap">
                <time
                  dateTime={registro.fecha}
                  className="text-theme-xs text-gray-600 dark:text-gray-300"
                >
                  {new Intl.DateTimeFormat(idioma, {
                    dateStyle: "medium",
                    timeZone: "America/La_Paz",
                  }).format(new Date(registro.fecha))}
                  <span className="mt-1 block text-gray-400 dark:text-gray-500">
                    {new Intl.DateTimeFormat(idioma, {
                      timeStyle: "medium",
                      timeZone: "America/La_Paz",
                    }).format(new Date(registro.fecha))}
                  </span>
                </time>
              </Celda>
              <Celda className="px-4 py-4">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {registro.responsable}
                </span>
                <span className="mt-1 block text-theme-xs text-gray-500 dark:text-gray-400">
                  {t.has(`origenes.${registro.origen}`)
                    ? t(`origenes.${registro.origen}`)
                    : registro.origen}
                </span>
              </Celda>
              <Celda className="px-4 py-4">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {t.has(`acciones.${registro.accion}`)
                    ? t(`acciones.${registro.accion}`)
                    : registro.accion.replaceAll("_", " ")}
                </span>
                <span className="mt-1 block text-theme-xs text-gray-500 dark:text-gray-400">
                  {t.has(`modulos.${registro.modulo}`)
                    ? t(`modulos.${registro.modulo}`)
                    : registro.modulo.replaceAll("_", " ")}
                </span>
              </Celda>
              <Celda className="px-4 py-4">
                <span
                  className="block max-w-48 truncate text-sm text-gray-600 dark:text-gray-300"
                  title={registro.objeto_nombre || registro.objeto_tipo}
                >
                  {registro.objeto_nombre ||
                    registro.objeto_tipo ||
                    t("sinObjeto")}
                </span>
                {registro.objeto_id && (
                  <span className="mt-1 block text-theme-xs text-gray-400 dark:text-gray-500">
                    #{registro.objeto_id}
                  </span>
                )}
              </Celda>
              <Celda className="px-4 py-4">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-theme-xs font-medium whitespace-nowrap ${registro.resultado === "exito" ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400" : registro.resultado === "rechazado" ? "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400" : "bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400"}`}
                >
                  {t(`resultados.${registro.resultado}`)}
                </span>
              </Celda>
              <Celda className="px-4 py-4">
                <button
                  type="button"
                  disabled={abriendo}
                  onClick={() => alVer(registro)}
                  aria-label={t("verEvento", { id: registro.id })}
                  title={t("detalle")}
                  className="inline-flex size-10 items-center justify-center rounded-lg text-gray-500 hover:bg-brand-50 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none disabled:opacity-40 dark:text-gray-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                >
                  <IconoVer className="size-4.5" />
                </button>
              </Celda>
            </Fila>
          ))}
        </Cuerpo>
      </Tabla>
    </div>
  );
}
