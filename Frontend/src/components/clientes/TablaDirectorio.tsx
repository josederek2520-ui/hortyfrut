"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Table as Tabla,
  TableBody as Cuerpo,
  TableCell as Celda,
  TableHeader as Cabecera,
  TableRow as Fila,
} from "@/components/ui/table";
import Button from "@/components/ui/button/Button";
import {
  IconoCliente,
  IconoSucursal,
  IconoUbicacion,
  EyeIcon as IconoVer,
  PencilIcon as IconoEditar,
  IconoEstado,
} from "@/icons";
import type { PermisosCatalogo } from "@/components/catalogos/tipos";
import {
  nombreRegistro,
  type RegistroDirectorio,
  type TipoDirectorio,
} from "./tipos";

interface Propiedades {
  tipo: TipoDirectorio;
  registros: RegistroDirectorio[];
  cargando: boolean;
  filtrado: boolean;
  permisos: PermisosCatalogo;
  puedeCrear: boolean;
  clienteActivo: boolean;
  alCrear: () => void;
  alEditar: (registro: RegistroDirectorio) => void;
  alEstado: (registro: RegistroDirectorio) => void;
}

export default function TablaDirectorio({
  tipo,
  registros,
  cargando,
  filtrado,
  permisos,
  puedeCrear,
  clienteActivo,
  alCrear,
  alEditar,
  alEstado,
}: Propiedades) {
  const t = useTranslations("clientes");
  const Icono = tipo === "clientes" ? IconoCliente : IconoSucursal;
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
      <div className="py-12 text-center">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
          <Icono className="size-6" />
        </span>
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {t(filtrado ? "sinResultados" : `tipos.${tipo}.vacio`)}
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t(filtrado ? "cambiarFiltros" : `tipos.${tipo}.ayudaVacio`)}
        </p>
        {!filtrado && puedeCrear && (
          <Button size="sm" className="mt-5" onClick={alCrear}>
            {t(tipo === "clientes" ? "nuevoCliente" : "nuevaSucursal")}
          </Button>
        )}
      </div>
    );
  const acciones =
    tipo === "clientes" || permisos.editar || permisos.cambiar_estado;
  const claseAccion =
    "inline-flex size-10 items-center justify-center rounded-lg text-gray-500 transition hover:bg-brand-50 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-300";
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <Tabla>
        <Cabecera className="bg-gray-50 dark:bg-gray-800/50">
          <Fila>
            {[
              tipo === "clientes" ? "razonSocial" : "nombreSucursal",
              tipo === "clientes" ? "nit" : "direccion",
              "contacto",
              ...(tipo === "clientes" ? ["sucursales"] : []),
              "estado",
              ...(acciones ? ["acciones"] : []),
            ].map((campo) => (
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
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
                    <Icono className="size-5" />
                  </span>
                  {"razon_social" in registro ? (
                    <Link
                      href={`/clientes/${registro.id}`}
                      className="max-w-xs text-sm font-semibold break-words text-gray-800 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-100 dark:hover:text-brand-300"
                    >
                      {registro.razon_social}
                    </Link>
                  ) : (
                    <span className="max-w-xs text-sm font-semibold break-words text-gray-800 dark:text-gray-100">
                      {registro.nombre}
                    </span>
                  )}
                </div>
              </Celda>
              <Celda className="px-5 py-4">
                {"razon_social" in registro ? (
                  <span className="font-mono text-sm text-gray-600 dark:text-gray-300">
                    {registro.nit}
                  </span>
                ) : (
                  <div className="max-w-sm">
                    <p className="text-sm break-words text-gray-700 dark:text-gray-200">
                      {registro.direccion}
                    </p>
                    {registro.encargado_pedidos && (
                      <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">
                        {t("encargadoPedidos")}:{" "}
                        {registro.encargado_pedidos.nombre}
                      </p>
                    )}
                    {registro.referencia && (
                      <p className="mt-1 text-theme-xs break-words text-gray-400 dark:text-gray-500">
                        {registro.referencia}
                      </p>
                    )}
                    {registro.latitud !== null &&
                      registro.longitud !== null && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${registro.latitud},${registro.longitud}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded text-theme-xs text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
                          aria-label={t("verMapaSucursal", {
                            nombre: registro.nombre,
                          })}
                        >
                          <IconoUbicacion className="size-3.5" />
                          {t("verMapa")}
                        </a>
                      )}
                  </div>
                )}
              </Celda>
              <Celda className="px-5 py-4">
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  {registro.telefono && (
                    <p>
                      <a
                        href={`tel:${registro.telefono}`}
                        className="rounded hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:hover:text-brand-300"
                      >
                        {registro.telefono}
                      </a>
                    </p>
                  )}
                  {"email" in registro && registro.email && (
                    <p>
                      <a
                        href={`mailto:${registro.email}`}
                        className="max-w-xs rounded break-all hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:hover:text-brand-300"
                      >
                        {registro.email}
                      </a>
                    </p>
                  )}
                  {!registro.telefono &&
                    !("email" in registro && registro.email) && (
                      <span className="text-theme-xs text-gray-400 dark:text-gray-500">
                        {t("sinContacto")}
                      </span>
                    )}
                </div>
              </Celda>
              {"cantidad_sucursales" in registro && (
                <Celda className="px-5 py-4">
                  <Link
                    href={`/clientes/${registro.id}`}
                    className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-theme-xs font-medium text-gray-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {registro.cantidad_sucursales}
                  </Link>
                </Celda>
              )}
              <Celda className="px-5 py-4">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-theme-xs font-medium ${registro.activo ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}
                >
                  {t(
                    `tipos.${tipo}.${registro.activo ? "activo" : "inactivo"}`,
                  )}
                </span>
              </Celda>
              {acciones && (
                <Celda className="px-4 py-4">
                  <div className="flex justify-end gap-1">
                    {tipo === "clientes" && (
                      <Link
                        href={`/clientes/${registro.id}`}
                        className={claseAccion}
                        title={t("ficha")}
                        aria-label={t("verRegistro", {
                          nombre: nombreRegistro(registro),
                        })}
                      >
                        <IconoVer className="size-4.5" />
                      </Link>
                    )}
                    {permisos.editar && (
                      <button
                        type="button"
                        className={claseAccion}
                        onClick={() => alEditar(registro)}
                        title={t("editar")}
                        aria-label={t("editarRegistro", {
                          nombre: nombreRegistro(registro),
                        })}
                      >
                        <IconoEditar className="size-4.5" />
                      </button>
                    )}
                    {permisos.cambiar_estado && (
                      <button
                        type="button"
                        className={claseAccion}
                        disabled={
                          tipo === "sucursales" &&
                          !registro.activo &&
                          !clienteActivo
                        }
                        onClick={() => alEstado(registro)}
                        title={t(
                          tipo === "sucursales" &&
                            !registro.activo &&
                            !clienteActivo
                            ? "requiereClienteActivo"
                            : registro.activo
                              ? "desactivar"
                              : "activar",
                        )}
                        aria-label={t(
                          registro.activo
                            ? "desactivarRegistro"
                            : "activarRegistro",
                          { nombre: nombreRegistro(registro) },
                        )}
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
