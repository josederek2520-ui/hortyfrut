"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import CampoFecha from "@/components/form/CampoFecha";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import {
  clasePanel,
  claseEstado,
  type PaginaCompra as Pagina,
} from "@/components/compras/tipos";
import { claseSelectorInventario } from "@/components/inventario/tipos";
import { mostrarFecha } from "@/components/compras/calculos";
import useConsultaPreparacion from "./useConsultaPreparacion";
import type { ResumenPreparacion } from "./tipos";

export default function HistorialPreparaciones({
  alError,
}: {
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  const [buscar, establecerBuscar] = useState("");
  const [fecha, establecerFecha] = useState("");
  const [estado, establecerEstado] = useState("");
  const [pagina, establecerPagina] = useState(1);
  const parametros = new URLSearchParams({ buscar, pagina: String(pagina) });
  if (fecha) parametros.set("fecha_pedidos", fecha);
  if (estado) parametros.set("estado", estado);
  const { datos, cargando, fallo, recargar } = useConsultaPreparacion<
    Pagina<ResumenPreparacion>
  >(`preparaciones/?${parametros}`, alError);
  return (
    <section className={`${clasePanel} space-y-5 p-5 sm:p-6`}>
      <div className="grid items-start gap-4 sm:grid-cols-3">
        <CampoDirectorio
          id="buscar-preparacion"
          etiqueta={t("buscarPreparacion")}
          type="search"
          maxLength={150}
          value={buscar}
          onChange={(evento) => {
            establecerBuscar(evento.target.value);
            establecerPagina(1);
          }}
        />
        <div>
          <Label htmlFor="fecha-historial-preparacion">
            {t("fechaPedidos")}
          </Label>
          <CampoFecha
            id="fecha-historial-preparacion"
            value={fecha}
            alCambiar={(valor) => {
              establecerFecha(valor);
              establecerPagina(1);
            }}
          />
        </div>
        <div>
          <Label htmlFor="estado-preparacion">{t("estado")}</Label>
          <select
            id="estado-preparacion"
            className={claseSelectorInventario}
            value={estado}
            onChange={(evento) => {
              establecerEstado(evento.target.value);
              establecerPagina(1);
            }}
          >
            <option value="">{t("todosEstados")}</option>
            {["borrador", "confirmada", "cancelada"].map((valor) => (
              <option key={valor} value={valor}>
                {t(`estados.${valor}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {fallo ? (
        <div role="alert" className="space-y-3 py-8 text-center">
          <p>{t("errorCarga")}</p>
          <Button
            variant="outline"
            onClick={() => {
              establecerPagina(1);
              recargar();
            }}
          >
            {t("recargar")}
          </Button>
        </div>
      ) : cargando ? (
        <p
          role="status"
          className="py-10 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          {t("cargando")}
        </p>
      ) : !datos?.results.length ? (
        <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
          {t("sinPreparaciones")}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {datos.results.map((preparacion) => (
            <li
              key={preparacion.id}
              className="flex flex-wrap items-start justify-between gap-4 py-4"
            >
              <div>
                <Link
                  href={`/preparaciones/${preparacion.id}`}
                  className="rounded font-semibold text-brand-700 underline focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
                >
                  {preparacion.codigo} · {preparacion.cliente_nombre}
                </Link>
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
                  {preparacion.almacen_nombre} ·{" "}
                  {mostrarFecha(preparacion.fecha_pedidos, idioma)}
                </p>
                <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                  {t("creadaEl", {
                    fecha: new Intl.DateTimeFormat(idioma, {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "America/La_Paz",
                    }).format(new Date(preparacion.creado_en)),
                  })}{" "}
                  · {preparacion.responsable_nombre}
                </p>
              </div>
              <span
                className={claseEstado(
                  preparacion.estado === "confirmada"
                    ? "registrada"
                    : preparacion.estado,
                )}
              >
                {t(`estados.${preparacion.estado}`)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <PaginadorCompras
        pagina={pagina}
        total={datos?.count || 0}
        ocupado={cargando || fallo}
        alCambiar={establecerPagina}
      />
    </section>
  );
}
