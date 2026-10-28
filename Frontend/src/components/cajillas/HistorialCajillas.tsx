"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api";
import { Link } from "@/i18n/navigation";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import CampoFecha from "@/components/form/CampoFecha";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import type { PaginaCompra as Pagina } from "@/components/compras/tipos";
import { claseSelectorInventario } from "@/components/inventario/tipos";
import type { MovimientoCajilla } from "./tipos";

export default function HistorialCajillas({
  cajilla,
  alError,
}: {
  cajilla?: number;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("cajillas");
  const idioma = useLocale();
  const [buscar, establecerBuscar] = useState("");
  const [tipo, establecerTipo] = useState("");
  const [fecha, establecerFecha] = useState("");
  const [pagina, establecerPagina] = useState(1);
  const [datos, establecerDatos] = useState<Pagina<MovimientoCajilla> | null>(
    null,
  );
  const [cargando, establecerCargando] = useState(true);
  const [fallo, establecerFallo] = useState(false);
  const [revision, establecerRevision] = useState(0);
  const cambiarFiltro = () => {
    establecerPagina(1);
    establecerCargando(true);
    establecerFallo(false);
  };
  useEffect(() => {
    const controlador = new AbortController();
    const temporizador = window.setTimeout(
      async () => {
        const consulta = new URLSearchParams({
          buscar,
          pagina: String(pagina),
        });
        if (cajilla) consulta.set("cajilla", String(cajilla));
        if (tipo) consulta.set("tipo", tipo);
        if (fecha) consulta.set("fecha", fecha);
        try {
          const respuesta = await api<Pagina<MovimientoCajilla>>(
            `cajillas/movimientos/?${consulta}`,
            { signal: controlador.signal },
          );
          if (!controlador.signal.aborted) establecerDatos(respuesta);
        } catch (error) {
          if (!controlador.signal.aborted) {
            if (error instanceof ApiError && error.status === 404 && pagina > 1)
              establecerPagina(1);
            else {
              establecerFallo(true);
              alError(error);
            }
          }
        } finally {
          if (!controlador.signal.aborted) establecerCargando(false);
        }
      },
      buscar ? 250 : 0,
    );
    return () => {
      controlador.abort();
      window.clearTimeout(temporizador);
    };
  }, [buscar, tipo, fecha, pagina, cajilla, revision, alError]);
  const mostrarFecha = (valor: string) =>
    new Intl.DateTimeFormat(idioma, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/La_Paz",
    }).format(new Date(valor));
  const numero = (valor: number) => new Intl.NumberFormat(idioma).format(valor);
  const etiquetaTipo = (movimiento: MovimientoCajilla) => (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-theme-xs font-medium whitespace-nowrap ${movimiento.tipo === "salida" ? "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400" : "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400"}`}
    >
      {t(`tipos.${movimiento.tipo}`)}
    </span>
  );
  const nota = (movimiento: MovimientoCajilla) =>
    movimiento.observaciones && (
      <details className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
        <summary className="min-h-8 cursor-pointer rounded py-1 focus-visible:ring-2 focus-visible:ring-brand-400">
          {t("verObservaciones")}
        </summary>
        <p className="mt-1 max-w-xs whitespace-pre-wrap">
          {movimiento.observaciones}
        </p>
      </details>
    );
  return (
    <div className="space-y-5">
      <div className="grid items-start gap-4 sm:grid-cols-3">
        <CampoDirectorio
          id="buscar-movimientos-cajillas"
          etiqueta={t("buscarMovimiento")}
          type="search"
          maxLength={150}
          value={buscar}
          onChange={(evento) => {
            establecerBuscar(evento.target.value);
            cambiarFiltro();
          }}
        />
        <div>
          <Label htmlFor="tipo-movimiento-cajilla">{t("tipoMovimiento")}</Label>
          <select
            id="tipo-movimiento-cajilla"
            className={claseSelectorInventario}
            value={tipo}
            onChange={(evento) => {
              establecerTipo(evento.target.value);
              cambiarFiltro();
            }}
          >
            <option value="">{t("todosTipos")}</option>
            {["inicial", "ingreso", "salida", "devolucion"].map((valor) => (
              <option key={valor} value={valor}>
                {t(`tipos.${valor}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="fecha-movimiento-cajilla">
            {t("fechaMovimiento")}
          </Label>
          <CampoFecha
            id="fecha-movimiento-cajilla"
            value={fecha}
            alCambiar={(valor) => {
              establecerFecha(valor);
              cambiarFiltro();
            }}
          />
        </div>
      </div>
      {fallo ? (
        <div role="alert" className="space-y-3 py-8 text-center">
          <p>{t("errorCarga")}</p>
          <Button
            variant="outline"
            onClick={() => {
              establecerFallo(false);
              establecerCargando(true);
              establecerRevision((valor) => valor + 1);
            }}
          >
            {t("reintentar")}
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
          {t("sinMovimientos")}
        </p>
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {datos.results.map((movimiento) => (
              <article
                key={movimiento.id}
                className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-gray-800 dark:text-gray-100">
                    {movimiento.codigo}
                  </p>
                  {etiquetaTipo(movimiento)}
                </div>
                <p className="mt-3 text-lg font-semibold text-gray-900 tabular-nums dark:text-white">
                  {numero(movimiento.cantidad)} · {movimiento.color}
                </p>
                <dl className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <div>
                    <dt className="inline text-gray-500 dark:text-gray-400">
                      {t("almacen")}:{" "}
                    </dt>
                    <dd className="inline">{movimiento.almacen_nombre}</dd>
                  </div>
                  {movimiento.sucursal && (
                    <div>
                      <dt className="inline text-gray-500 dark:text-gray-400">
                        {t("sucursal")}:{" "}
                      </dt>
                      <dd className="inline">
                        {movimiento.cliente_nombre} ·{" "}
                        {movimiento.sucursal_nombre}
                      </dd>
                    </div>
                  )}
                </dl>
                <p className="mt-3 text-theme-xs text-gray-500 dark:text-gray-400">
                  {mostrarFecha(movimiento.creado_en)} ·{" "}
                  {movimiento.responsable_nombre}
                </p>
                {nota(movimiento)}
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 lg:block dark:border-gray-800">
            <table className="w-full text-start text-sm">
              <thead className="bg-gray-50 text-theme-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <tr>
                  {[
                    "movimiento",
                    "color",
                    "cantidad",
                    "almacen",
                    "sucursal",
                    "fechaResponsable",
                  ].map((clave) => (
                    <th
                      key={clave}
                      scope="col"
                      className="px-4 py-3 text-start font-medium whitespace-nowrap"
                    >
                      {t(clave)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datos.results.map((movimiento) => (
                  <tr
                    key={movimiento.id}
                    className="border-t border-gray-100 text-gray-700 dark:border-gray-800 dark:text-gray-200"
                  >
                    <td className="px-4 py-4">
                      <p className="mb-2 font-medium">{movimiento.codigo}</p>
                      {etiquetaTipo(movimiento)}
                      {nota(movimiento)}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/cajillas/${movimiento.cajilla}`}
                        className="rounded text-brand-700 underline focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
                      >
                        {movimiento.color}
                      </Link>
                    </td>
                    <td className="px-4 py-4 font-semibold tabular-nums">
                      {numero(movimiento.cantidad)}
                    </td>
                    <td className="min-w-32 px-4 py-4">
                      {movimiento.almacen_nombre}
                    </td>
                    <td className="min-w-40 px-4 py-4">
                      {movimiento.sucursal_nombre || "—"}
                      {movimiento.cliente_nombre && (
                        <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                          {movimiento.cliente_nombre}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <p>{mostrarFecha(movimiento.creado_en)}</p>
                      <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                        {movimiento.responsable_nombre}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <PaginadorCompras
        pagina={pagina}
        total={datos?.count || 0}
        ocupado={cargando || fallo}
        alCambiar={(valor) => {
          establecerPagina(valor);
          establecerCargando(true);
        }}
      />
    </div>
  );
}
