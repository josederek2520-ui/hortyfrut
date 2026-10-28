"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/ui/button/Button";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import type { PaginaCompra as Pagina } from "@/components/compras/tipos";
import { claseEnlaceInventario } from "@/components/inventario/tipos";
import type { UbicacionCajillas } from "./tipos";

export default function SaldosCajillas({
  cajilla,
  tipo,
  puedeDevolver,
  alError,
}: {
  cajilla: number;
  tipo: "almacenes" | "sucursales";
  puedeDevolver: boolean;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("cajillas");
  const idioma = useLocale();
  const [pagina, establecerPagina] = useState(1);
  const [datos, establecerDatos] = useState<Pagina<UbicacionCajillas> | null>(
    null,
  );
  const [fallo, establecerFallo] = useState(false);
  const [revision, establecerRevision] = useState(0);
  useEffect(() => {
    const controlador = new AbortController();
    api<Pagina<UbicacionCajillas>>(
      `cajillas/${cajilla}/saldos-${tipo}/?pagina=${pagina}`,
      { signal: controlador.signal },
    )
      .then((respuesta) => {
        if (!controlador.signal.aborted) establecerDatos(respuesta);
      })
      .catch((error) => {
        if (!controlador.signal.aborted) {
          if (error instanceof ApiError && error.status === 404 && pagina > 1)
            establecerPagina(1);
          else {
            establecerFallo(true);
            alError(error);
          }
        }
      });
    return () => controlador.abort();
  }, [cajilla, tipo, pagina, revision, alError]);
  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
        {t(
          tipo === "almacenes"
            ? "saldosAlmacenesAyuda"
            : "saldosSucursalesAyuda",
        )}
      </p>
      {fallo ? (
        <div role="alert" className="space-y-3">
          <p>{t("errorCarga")}</p>
          <Button
            variant="outline"
            onClick={() => {
              establecerFallo(false);
              establecerDatos(null);
              establecerRevision((valor) => valor + 1);
            }}
          >
            {t("reintentar")}
          </Button>
        </div>
      ) : !datos ? (
        <p
          role="status"
          className="py-10 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          {t("cargando")}
        </p>
      ) : !datos.results.length ? (
        <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
          {t(tipo === "almacenes" ? "sinSaldosAlmacenes" : "sinPendientes")}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {datos.results.map((ubicacion) => (
            <li
              key={ubicacion.id}
              className="flex flex-wrap items-center justify-between gap-4 py-4"
            >
              <div className="min-w-0">
                <p className="font-medium break-words text-gray-900 dark:text-white">
                  {ubicacion.nombre}
                </p>
                {ubicacion.cliente && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {ubicacion.cliente}
                  </p>
                )}
                {ubicacion.activo === false && (
                  <p className="mt-1 text-theme-xs text-warning-700 dark:text-warning-400">
                    {t("referenciaInactiva")}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <p className="text-lg font-semibold text-gray-900 tabular-nums dark:text-white">
                  {t("cantidadCajillas", {
                    cantidad: new Intl.NumberFormat(idioma).format(
                      ubicacion.cantidad || 0,
                    ),
                  })}
                </p>
                {tipo === "sucursales" && puedeDevolver && (
                  <Link
                    href={`/cajillas/${cajilla}/movimiento?tipo=devolucion&sucursal=${ubicacion.id}`}
                    className={claseEnlaceInventario}
                  >
                    {t("registrarDevolucion")}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <PaginadorCompras
        pagina={pagina}
        total={datos?.count || 0}
        ocupado={!datos || fallo}
        alCambiar={(valor) => {
          establecerDatos(null);
          establecerPagina(valor);
        }}
      />
    </div>
  );
}
