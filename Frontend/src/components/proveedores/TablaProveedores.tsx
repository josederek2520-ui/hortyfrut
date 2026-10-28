"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  Store as IconoProveedor,
  Eye as IconoVer,
  Pencil as IconoEditar,
  Power as IconoEstado,
  Phone as IconoTelefono,
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
import { claseAccion, claseEstado, type Proveedor } from "./tipos";

export default function TablaProveedores({
  registros,
  cargando,
  filtrado,
  permisos,
  alCrear,
  alEstado,
}: {
  registros: Proveedor[];
  cargando: boolean;
  filtrado: boolean;
  permisos: PermisosCatalogo;
  alCrear: () => void;
  alEstado: (proveedor: Proveedor) => void;
}) {
  const t = useTranslations("proveedores");
  const idioma = useLocale();
  const formatoFecha = new Intl.DateTimeFormat(idioma, {
    dateStyle: "medium",
    timeZone: "America/La_Paz",
  });
  const acciones = (proveedor: Proveedor) => (
    <div className="flex justify-end gap-1">
      <Link
        href={`/proveedores/${proveedor.id}`}
        className={claseAccion}
        title={t("detalle")}
        aria-label={t("verRegistro", { nombre: proveedor.nombre })}
      >
        <IconoVer className="size-4.5" aria-hidden="true" />
      </Link>
      {permisos.editar && (
        <Link
          href={`/proveedores/${proveedor.id}/editar`}
          className={claseAccion}
          title={t("editar")}
          aria-label={t("editarRegistro", { nombre: proveedor.nombre })}
        >
          <IconoEditar className="size-4.5" aria-hidden="true" />
        </Link>
      )}
      {permisos.cambiar_estado && (
        <button
          type="button"
          className={claseAccion}
          onClick={() => alEstado(proveedor)}
          title={t(proveedor.activo ? "desactivar" : "activar")}
          aria-label={t(
            proveedor.activo ? "desactivarRegistro" : "activarRegistro",
            { nombre: proveedor.nombre },
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
          <IconoProveedor className="size-6" aria-hidden="true" />
        </span>
        <h2 className="font-semibold text-gray-900 dark:text-white">
          {t(filtrado ? "sinResultados" : "vacio")}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t(filtrado ? "ayudaSinResultados" : "ayudaVacio")}
        </p>
        {!filtrado && permisos.crear && (
          <Button size="sm" className="mt-5" onClick={alCrear}>
            {t("nuevoProveedor")}
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
                "categoria",
                "contactoDireccion",
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
            {registros.map((proveedor) => (
              <Fila
                key={proveedor.id}
                className="border-t border-gray-100 hover:bg-gray-50/70 dark:border-gray-800 dark:hover:bg-white/2"
              >
                <Celda className="px-4 py-4">
                  <Link
                    href={`/proveedores/${proveedor.id}`}
                    className="inline-flex max-w-60 items-center gap-3 rounded-lg text-sm font-semibold break-words text-gray-800 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-100 dark:hover:text-brand-300"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                      <IconoProveedor className="size-5" aria-hidden="true" />
                    </span>
                    <span>{proveedor.nombre}</span>
                  </Link>
                </Celda>
                <Celda className="px-4 py-4">
                  <p className="max-w-40 text-sm break-words text-gray-600 dark:text-gray-300">
                    {proveedor.categoria?.nombre || t("sinCategoria")}
                  </p>
                </Celda>
                <Celda className="px-4 py-4">
                  <div className="max-w-60 space-y-1 text-sm break-words text-gray-600 dark:text-gray-300">
                    {proveedor.telefono && (
                      <a
                        href={`tel:${proveedor.telefono}`}
                        className="inline-flex items-center gap-1.5 rounded hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:hover:text-brand-300"
                      >
                        <IconoTelefono
                          className="size-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        {proveedor.telefono}
                      </a>
                    )}
                    <p
                      className={
                        proveedor.direccion
                          ? ""
                          : "text-theme-xs text-gray-400 dark:text-gray-500"
                      }
                    >
                      {proveedor.direccion || t("sinDireccion")}
                    </p>
                  </div>
                </Celda>
                <Celda className="px-4 py-4 text-sm whitespace-nowrap text-gray-600 dark:text-gray-300">
                  <time dateTime={proveedor.creado_en}>
                    {formatoFecha.format(new Date(proveedor.creado_en))}
                  </time>
                </Celda>
                <Celda className="px-4 py-4">
                  <span className={claseEstado(proveedor.activo)}>
                    {t(proveedor.activo ? "activo" : "inactivo")}
                  </span>
                </Celda>
                <Celda className="px-3 py-4">{acciones(proveedor)}</Celda>
              </Fila>
            ))}
          </Cuerpo>
        </Tabla>
      </div>
      <div className="space-y-3 md:hidden">
        {registros.map((proveedor) => (
          <article
            key={proveedor.id}
            className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/proveedores/${proveedor.id}`}
                className="min-w-0 rounded text-sm font-semibold break-words text-gray-900 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-white dark:hover:text-brand-300"
              >
                {proveedor.nombre}
              </Link>
              <span className={`${claseEstado(proveedor.activo)} shrink-0`}>
                {t(proveedor.activo ? "activo" : "inactivo")}
              </span>
            </div>
            <p className="mt-1 text-theme-xs break-words text-gray-500 dark:text-gray-400">
              {proveedor.categoria?.nombre || t("sinCategoria")}
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {t("telefono")}
                </dt>
                <dd className="mt-1 text-gray-700 dark:text-gray-200">
                  {proveedor.telefono ? (
                    <a
                      href={`tel:${proveedor.telefono}`}
                      className="rounded focus-visible:ring-2 focus-visible:ring-brand-400"
                    >
                      {proveedor.telefono}
                    </a>
                  ) : (
                    t("sinTelefono")
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {t("direccion")}
                </dt>
                <dd className="mt-1 break-words text-gray-700 dark:text-gray-200">
                  {proveedor.direccion || t("sinDireccion")}
                </dd>
              </div>
              <div>
                <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {t("fechaCreacion")}
                </dt>
                <dd className="mt-1 text-gray-700 dark:text-gray-200">
                  <time dateTime={proveedor.creado_en}>
                    {formatoFecha.format(new Date(proveedor.creado_en))}
                  </time>
                </dd>
              </div>
            </dl>
            <div className="mt-3 border-t border-gray-100 pt-2 dark:border-gray-800">
              {acciones(proveedor)}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
