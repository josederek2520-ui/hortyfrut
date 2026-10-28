"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Boxes as IconoLotes,
  ArrowDownToLine as IconoMovimiento,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import MigasPagina from "@/components/common/PageBreadCrumb";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import CampoFecha from "@/components/form/CampoFecha";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import SelectorCompra from "@/components/compras/SelectorCompra";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import {
  clasePanel,
  type OpcionCompra,
  type PaginaCompra,
} from "@/components/compras/tipos";
import type { Session as Sesion } from "@/components/users/types";
import {
  claseSelectorInventario,
  type Lote,
  type MovimientoInventario,
} from "./tipos";
import useAvisosInventario from "./useAvisosInventario";
import ListaInventario from "./ListaInventario";

export default function GestionInventario({
  sesion,
  tipo,
}: {
  sesion: Sesion;
  tipo: "lotes" | "movimientos";
}) {
  const t = useTranslations("inventario");
  const { avisos, cerrarAviso, tratarError } = useAvisosInventario();
  const lotes = tipo === "lotes";
  const permitido = lotes
    ? sesion.permisos_inventario?.ver_lotes
    : sesion.permisos_inventario?.ver_movimientos;
  const [buscar, establecerBuscar] = useState("");
  const [fecha, establecerFecha] = useState("");
  const [estado, establecerEstado] = useState("");
  const [almacen, establecerAlmacen] = useState<OpcionCompra | null>(null);
  const [pagina, establecerPagina] = useState(1);
  const [datos, establecerDatos] = useState<PaginaCompra<
    Lote | MovimientoInventario
  > | null>(null);
  const [cargando, establecerCargando] = useState(true);
  const [fallo, establecerFallo] = useState(false);
  const [revision, establecerRevision] = useState(0);
  const cambiarFiltro = () => {
    establecerPagina(1);
    establecerCargando(true);
    establecerFallo(false);
  };
  useEffect(() => {
    if (!permitido) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(
      async () => {
        const parametros = new URLSearchParams({
          buscar,
          pagina: String(pagina),
        });
        if (fecha) parametros.set("fecha", fecha);
        if (estado && lotes) parametros.set("estado", estado);
        if (almacen) parametros.set("almacen", String(almacen.id));
        try {
          const respuesta = await api<
            PaginaCompra<Lote | MovimientoInventario>
          >(`inventario/${tipo}/?${parametros}`, {
            signal: controlador.signal,
          });
          if (!controlador.signal.aborted) establecerDatos(respuesta);
        } catch (error) {
          if (!controlador.signal.aborted) {
            if (error instanceof ApiError && error.status === 404 && pagina > 1)
              establecerPagina(1);
            else {
              establecerFallo(true);
              tratarError(error);
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
  }, [
    buscar,
    fecha,
    estado,
    almacen,
    lotes,
    tipo,
    pagina,
    permitido,
    revision,
    tratarError,
  ]);
  const Icono = lotes ? IconoLotes : IconoMovimiento;
  if (!permitido)
    return (
      <p role="alert" className={`${clasePanel} p-8`}>
        {t("restringido")}
      </p>
    );
  return (
    <div className="space-y-6">
      <MigasPagina pageTitle={t(lotes ? "lotesTitulo" : "movimientosTitulo")} />
      <section className={`${clasePanel} p-5 sm:p-6`}>
        <h1 className="flex items-center gap-3 text-2xl font-semibold text-gray-900 dark:text-white">
          <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <Icono className="size-6" aria-hidden="true" />
          </span>
          {t(lotes ? "lotesTitulo" : "movimientosTitulo")}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t(lotes ? "lotesAyuda" : "movimientosAyuda")}
        </p>
      </section>
      <section className={`${clasePanel} p-5 sm:p-6`}>
        <div
          className={`mb-5 grid items-start gap-4 sm:grid-cols-2 ${lotes ? "xl:grid-cols-4" : "lg:grid-cols-3"}`}
        >
          <CampoDirectorio
            id="buscar-inventario"
            etiqueta={t("buscar")}
            type="search"
            value={buscar}
            maxLength={150}
            onChange={(evento) => {
              establecerBuscar(evento.target.value);
              cambiarFiltro();
            }}
          />
          <SelectorCompra
            ruta={`inventario/${tipo}/almacenes/`}
            etiqueta={t("almacen")}
            valor={almacen}
            opcionVacia={t("todosAlmacenes")}
            alError={tratarError}
            alElegir={(valor) => {
              establecerAlmacen(valor);
              cambiarFiltro();
            }}
          />
          <div>
            <Label htmlFor="fecha-inventario">
              {t(lotes ? "fechaIngreso" : "fecha")}
            </Label>
            <CampoFecha
              id="fecha-inventario"
              value={fecha}
              alCambiar={(valor) => {
                establecerFecha(valor);
                cambiarFiltro();
              }}
            />
          </div>
          {lotes && (
            <div>
              <Label htmlFor="estado-inventario">{t("estado")}</Label>
              <select
                id="estado-inventario"
                value={estado}
                className={claseSelectorInventario}
                onChange={(evento) => {
                  establecerEstado(evento.target.value);
                  cambiarFiltro();
                }}
              >
                <option value="">{t("todosEstados")}</option>
                {["disponible", "bloqueado", "vencido"].map((valor) => (
                  <option key={valor} value={valor}>
                    {t(valor)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {fallo ? (
          <div role="alert" className="space-y-4 py-8 text-center">
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
            className="py-12 text-center text-sm text-gray-500 dark:text-gray-400"
          >
            {t("cargando")}
          </p>
        ) : !datos?.results.length ? (
          <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            {t("sinResultados")}
          </p>
        ) : (
          <ListaInventario registros={datos.results} lotes={lotes} />
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
      </section>
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </div>
  );
}
