"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  Warehouse as IconoAlmacen,
  Eye as IconoVer,
  Pencil as IconoEditar,
  Power as IconoEstado,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  Table as Tabla,
  TableBody as Cuerpo,
  TableCell as Celda,
  TableHeader as Cabecera,
  TableRow as Fila,
} from "@/components/ui/table";
import Button from "@/components/ui/button/Button";
import type { PermisosCatalogo } from "@/components/catalogos/tipos";
import UbicacionAlmacen from "./UbicacionAlmacen";
import { claseAccion, claseEstado, type Almacen } from "./tipos";

export default function TablaAlmacenes({
  registros,
  cargando,
  filtrado,
  permisos,
  alCrear,
  alEstado,
}: {
  registros: Almacen[];
  cargando: boolean;
  filtrado: boolean;
  permisos: PermisosCatalogo;
  alCrear: () => void;
  alEstado: (almacen: Almacen) => void;
}) {
  const t = useTranslations("almacenes"),
    idioma = useLocale();
  const formatoFecha = new Intl.DateTimeFormat(idioma, {
    dateStyle: "medium",
    timeZone: "America/La_Paz",
  });
  const acciones = (almacen: Almacen) => (
    <div className="flex justify-end gap-1">
      <Link
        href={`/almacenes/${almacen.id}`}
        className={claseAccion}
        title={t("detalle")}
        aria-label={t("verRegistro", { nombre: almacen.nombre })}
      >
        <IconoVer className="size-4.5" aria-hidden="true" />
      </Link>
      {permisos.editar && (
        <Link
          href={`/almacenes/${almacen.id}/editar`}
          className={claseAccion}
          title={t("editar")}
          aria-label={t("editarRegistro", { nombre: almacen.nombre })}
        >
          <IconoEditar className="size-4.5" aria-hidden="true" />
        </Link>
      )}
      {permisos.cambiar_estado && (
        <button
          type="button"
          className={claseAccion}
          onClick={() => alEstado(almacen)}
          title={t(almacen.activo ? "desactivar" : "activar")}
          aria-label={t(
            almacen.activo ? "desactivarRegistro" : "activarRegistro",
            { nombre: almacen.nombre },
          )}
        >
          <IconoEstado className="size-4.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
  if (cargando)
    return (
      <div role="status" aria-label={t("cargando")} className="space-y-3">
        {[0, 1, 2, 3].map((indice) => (
          <div
            key={indice}
            className="h-20 rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800"
          />
        ))}
      </div>
    );
  if (!registros.length)
    return (
      <div role="status" className="py-12 text-center">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
          <IconoAlmacen className="size-6" aria-hidden="true" />
        </span>
        <h2 className="font-semibold text-gray-900 dark:text-white">
          {t(filtrado ? "sinResultados" : "vacio")}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t(filtrado ? "ayudaSinResultados" : "ayudaVacio")}
        </p>
        {!filtrado && permisos.crear && (
          <Button size="sm" className="mt-5" onClick={alCrear}>
            {t("nuevoAlmacen")}
          </Button>
        )}
      </div>
    );
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 md:block dark:border-gray-800">
        <Tabla>
          <Cabecera className="bg-gray-50 dark:bg-gray-800/50">
            <Fila>
              {[
                "nombreCorto",
                "ubicacionGeografica",
                "fechaCreacion",
                "estado",
                "acciones",
              ].map((campo) => (
                <Celda
                  key={campo}
                  isHeader
                  className={`px-4 py-3.5 text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400 ${campo === "acciones" ? "text-end" : "text-start"}`}
                >
                  {t(campo)}
                </Celda>
              ))}
            </Fila>
          </Cabecera>
          <Cuerpo>
            {registros.map((almacen) => (
              <Fila
                key={almacen.id}
                className="border-t border-gray-100 hover:bg-gray-50/70 dark:border-gray-800 dark:hover:bg-white/2"
              >
                <Celda className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                      <IconoAlmacen className="size-5" aria-hidden="true" />
                    </span>
                    <div className="max-w-xs">
                      <Link
                        href={`/almacenes/${almacen.id}`}
                        className="rounded text-sm font-semibold break-words text-gray-800 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-100 dark:hover:text-brand-300"
                      >
                        {almacen.nombre}
                      </Link>
                      <p className="mt-1 text-theme-xs leading-5 break-words text-gray-500 dark:text-gray-400">
                        {almacen.direccion}
                      </p>
                    </div>
                  </div>
                </Celda>
                <Celda className="min-w-44 px-4 py-4">
                  <UbicacionAlmacen
                    nombre={almacen.nombre}
                    latitud={almacen.latitud}
                    longitud={almacen.longitud}
                    compacta
                  />
                </Celda>
                <Celda className="px-4 py-4 text-sm whitespace-nowrap text-gray-600 dark:text-gray-300">
                  <time dateTime={almacen.creado_en}>
                    {formatoFecha.format(new Date(almacen.creado_en))}
                  </time>
                </Celda>
                <Celda className="px-4 py-4">
                  <span className={claseEstado(almacen.activo)}>
                    {t(almacen.activo ? "activo" : "inactivo")}
                  </span>
                </Celda>
                <Celda className="px-3 py-4">{acciones(almacen)}</Celda>
              </Fila>
            ))}
          </Cuerpo>
        </Tabla>
      </div>
      <div className="space-y-3 md:hidden">
        {registros.map((almacen) => (
          <article
            key={almacen.id}
            className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/almacenes/${almacen.id}`}
                className="min-w-0 rounded text-sm font-semibold break-words text-gray-900 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-white dark:hover:text-brand-300"
              >
                {almacen.nombre}
              </Link>
              <span className={`${claseEstado(almacen.activo)} shrink-0`}>
                {t(almacen.activo ? "activo" : "inactivo")}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 break-words text-gray-600 dark:text-gray-300">
              {almacen.direccion}
            </p>
            <div className="mt-4">
              <UbicacionAlmacen
                nombre={almacen.nombre}
                latitud={almacen.latitud}
                longitud={almacen.longitud}
                compacta
              />
            </div>
            <p className="mt-3 text-theme-xs text-gray-500 dark:text-gray-400">
              {t("fechaCreacion")}:{" "}
              <time dateTime={almacen.creado_en}>
                {formatoFecha.format(new Date(almacen.creado_en))}
              </time>
            </p>
            <div className="mt-3 border-t border-gray-100 pt-2 dark:border-gray-800">
              {acciones(almacen)}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
