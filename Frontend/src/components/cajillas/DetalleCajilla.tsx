"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Plus as IconoIngreso,
  ArrowUpRight as IconoSalida,
  CornerDownLeft as IconoDevolucion,
} from "lucide-react";
import Button from "@/components/ui/button/Button";
import { clasePanel } from "@/components/compras/tipos";
import { claseEnlaceInventario } from "@/components/inventario/tipos";
import ColorCajilla from "./ColorCajilla";
import ResumenCajillas from "./ResumenCajillas";
import SaldosCajillas from "./SaldosCajillas";
import HistorialCajillas from "./HistorialCajillas";
import {
  puedeMoverCajillas,
  type Cajilla,
  type PermisosCajillas,
} from "./tipos";

export default function DetalleCajilla({
  cajilla,
  permisos,
  alError,
}: {
  cajilla: Cajilla;
  permisos: PermisosCajillas;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("cajillas");
  const idioma = useLocale();
  const [vista, establecerVista] = useState<
    "almacenes" | "sucursales" | "historial"
  >("almacenes");
  return (
    <div className="space-y-6">
      <section className={`${clasePanel} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <ColorCajilla color={cajilla.color} />
            <h1 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
              {t("controlColor", { color: cajilla.color })}
            </h1>
            <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
              {t("creadaEl", {
                fecha: new Intl.DateTimeFormat(idioma, {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "America/La_Paz",
                }).format(new Date(cajilla.creado_en)),
              })}{" "}
              · {cajilla.responsable_nombre}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {(
              [
                {
                  tipo: "ingreso",
                  Icono: IconoIngreso,
                  etiqueta: "registrarIngreso",
                  deshabilitado: false,
                },
                {
                  tipo: "salida",
                  Icono: IconoSalida,
                  etiqueta: "registrarSalida",
                  deshabilitado: cajilla.en_almacen <= 0,
                },
                {
                  tipo: "devolucion",
                  Icono: IconoDevolucion,
                  etiqueta: "registrarDevolucion",
                  deshabilitado: cajilla.en_sucursales <= 0,
                },
              ] as const
            )
              .filter((accion) => puedeMoverCajillas(permisos, accion.tipo))
              .map(({ tipo, Icono, etiqueta, deshabilitado }) =>
                deshabilitado ? (
                  <Button
                    key={tipo}
                    variant="outline"
                    size="sm"
                    disabled
                    title={t(
                      tipo === "salida" ? "sinExistencias" : "sinPendientes",
                    )}
                    startIcon={<Icono className="size-4" />}
                  >
                    {t(etiqueta)}
                  </Button>
                ) : (
                  <Link
                    key={tipo}
                    href={`/cajillas/${cajilla.id}/movimiento?tipo=${tipo}`}
                    className={claseEnlaceInventario}
                  >
                    <Icono className="size-4" aria-hidden="true" />
                    {t(etiqueta)}
                  </Link>
                ),
              )}
          </div>
        </div>
      </section>
      <ResumenCajillas resumen={cajilla} />
      <section className={`${clasePanel} space-y-5 p-5 sm:p-6`}>
        <div
          role="group"
          aria-label={t("vistas")}
          className="flex flex-wrap gap-2"
        >
          {(["almacenes", "sucursales", "historial"] as const).map((valor) => (
            <Button
              key={valor}
              size="sm"
              variant={vista === valor ? "primary" : "outline"}
              aria-pressed={vista === valor}
              onClick={() => establecerVista(valor)}
            >
              {t(
                valor === "almacenes"
                  ? "porAlmacen"
                  : valor === "sucursales"
                    ? "porSucursal"
                    : "historial",
              )}
            </Button>
          ))}
        </div>
        {vista === "historial" ? (
          <HistorialCajillas cajilla={cajilla.id} alError={alError} />
        ) : (
          <SaldosCajillas
            key={vista}
            cajilla={cajilla.id}
            tipo={vista}
            puedeDevolver={permisos.devolver}
            alError={alError}
          />
        )}
      </section>
    </div>
  );
}
