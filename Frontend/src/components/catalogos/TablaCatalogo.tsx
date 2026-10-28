"use client";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import ImagenProducto from "@/components/productos/ImagenProducto";
import {
  Table as Tabla,
  TableBody as Cuerpo,
  TableCell as Celda,
  TableHeader as Cabecera,
  TableRow as Fila,
} from "@/components/ui/table";
import Button from "@/components/ui/button/Button";
import {
  PencilIcon as IconoEditar,
  IconoRegla,
  IconoCategorias,
  IconoEstado,
  IconoProducto,
  EyeIcon as IconoVer,
} from "@/icons";
import {
  CONFIGURACION_CATALOGOS,
  type RegistroCatalogo,
  type TipoListado,
  type PermisosCatalogo,
} from "./tipos";

interface Propiedades {
  tipo: TipoListado;
  registros: RegistroCatalogo[];
  cargando: boolean;
  filtrado: boolean;
  permisos: PermisosCatalogo;
  alEditar: (registro: RegistroCatalogo) => void;
  alEstado: (registro: RegistroCatalogo) => void;
  alCrear: () => void;
}
export default function TablaCatalogo({
  tipo,
  registros,
  cargando,
  filtrado,
  permisos,
  alEditar,
  alEstado,
  alCrear,
}: Propiedades) {
  const t = useTranslations("catalogos");
  const idioma = useLocale();
  const Icono =
    tipo === "productos"
      ? IconoProducto
      : tipo === "unidades_medida"
        ? IconoRegla
        : IconoCategorias;
  const abreviatura = CONFIGURACION_CATALOGOS[tipo].conAbreviatura;
  const acciones =
    tipo === "productos" || permisos.editar || permisos.cambiar_estado;
  if (cargando)
    return (
      <div role="status" aria-label={t("cargando")} className="space-y-3">
        {[0, 1, 2, 3].map((indice) => (
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
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
          <Icono className="size-6" />
        </span>
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {t(filtrado ? "sinResultados" : `tipos.${tipo}.vacio`)}
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t(filtrado ? "cambiarFiltros" : `tipos.${tipo}.ayudaVacio`)}
        </p>
        {!filtrado && permisos.crear && (
          <Button size="sm" className="mt-5" onClick={alCrear}>
            {t(`tipos.${tipo}.nuevo`)}
          </Button>
        )}
      </div>
    );
  const cabeceras = [
    "nombre",
    ...(abreviatura ? ["abreviatura"] : []),
    ...(tipo === "productos" ? ["categoria", "unidadMedida"] : []),
    "estado",
    "fechaCreacion",
    ...(acciones ? ["acciones"] : []),
  ];
  const claseAccion =
    "inline-flex size-10 items-center justify-center rounded-lg text-gray-500 transition hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-300";
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <Tabla>
        <Cabecera className="bg-gray-50 dark:bg-gray-800/50">
          <Fila>
            {cabeceras.map((campo) => (
              <Celda
                key={campo}
                isHeader
                className={`px-5 py-3.5 text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400 ${campo === "acciones" ? "text-end" : "text-start"}`}
              >
                {t(campo)}
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
              <Celda className="px-5 py-4">
                <div className="flex items-center gap-3">
                  {tipo === "productos" ? (
                    <ImagenProducto
                      origen={registro.imagen || null}
                      nombre={registro.nombre}
                    />
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
                      <Icono className="size-5" />
                    </span>
                  )}
                  {tipo === "productos" ? (
                    <Link
                      href={`/productos/${registro.id}`}
                      className="max-w-sm text-start text-sm font-semibold break-words text-gray-800 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none dark:text-gray-100 dark:hover:text-brand-300"
                    >
                      {registro.nombre}
                    </Link>
                  ) : permisos.editar ? (
                    <button
                      type="button"
                      onClick={() => alEditar(registro)}
                      className="max-w-sm text-start text-sm font-semibold break-words text-gray-800 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none dark:text-gray-100 dark:hover:text-brand-300"
                    >
                      {registro.nombre}
                    </button>
                  ) : (
                    <span className="max-w-sm text-sm font-medium break-words text-gray-800 dark:text-gray-100">
                      {registro.nombre}
                    </span>
                  )}
                </div>
              </Celda>
              {abreviatura && (
                <Celda className="px-5 py-4">
                  <span className="font-mono rounded-md bg-gray-100 px-2.5 py-1 text-theme-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {registro.abreviatura}
                  </span>
                </Celda>
              )}
              {tipo === "productos" && (
                <>
                  <Celda className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {registro.categoria?.nombre}
                  </Celda>
                  <Celda className="px-5 py-4 text-sm whitespace-nowrap text-gray-600 dark:text-gray-300">
                    {registro.unidad_medida?.nombre}{" "}
                    <span className="ms-1 text-theme-xs text-gray-400">
                      ({registro.unidad_medida?.abreviatura})
                    </span>
                  </Celda>
                </>
              )}
              <Celda className="px-5 py-4">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-theme-xs font-medium ${registro.activo ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}
                >
                  {t(
                    tipo === "productos"
                      ? registro.activo
                        ? "estadosProductos.activo"
                        : "estadosProductos.inactivo"
                      : registro.activo
                        ? "activo"
                        : "inactivo",
                  )}
                </span>
              </Celda>
              <Celda className="px-5 py-4 text-theme-xs whitespace-nowrap text-gray-500 dark:text-gray-400">
                <time dateTime={registro.creado_en}>
                  {new Intl.DateTimeFormat(idioma, {
                    dateStyle: "medium",
                    timeZone: "America/La_Paz",
                  }).format(new Date(registro.creado_en))}
                </time>
              </Celda>
              {acciones && (
                <Celda className="px-4 py-4">
                  <div className="flex justify-end gap-1">
                    {tipo === "productos" && (
                      <Link
                        href={`/productos/${registro.id}`}
                        title={t("verProducto")}
                        aria-label={t("verRegistro", {
                          nombre: registro.nombre,
                        })}
                        className={claseAccion}
                      >
                        <IconoVer className="size-4.5" />
                      </Link>
                    )}
                    {permisos.editar && (
                      <button
                        type="button"
                        onClick={() => alEditar(registro)}
                        title={t("editar")}
                        aria-label={t("editarRegistro", {
                          nombre: registro.nombre,
                        })}
                        className={claseAccion}
                      >
                        <IconoEditar className="size-4.5" />
                      </button>
                    )}
                    {permisos.cambiar_estado && (
                      <button
                        type="button"
                        onClick={() => alEstado(registro)}
                        title={t(registro.activo ? "desactivar" : "activar")}
                        aria-label={t(
                          registro.activo
                            ? "desactivarRegistro"
                            : "activarRegistro",
                          { nombre: registro.nombre },
                        )}
                        className={claseAccion}
                      >
                        <IconoEstado className="size-4.5" />
                      </button>
                    )}
                  </div>
                </Celda>
              )}
            </Fila>
          ))}
        </Cuerpo>
      </Tabla>
    </div>
  );
}
