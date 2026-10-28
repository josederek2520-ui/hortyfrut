"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import Button from "@/components/ui/button/Button";
import MarcaHortyfru from "@/components/common/MarcaHortyfru";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import { clasePanel } from "@/components/compras/tipos";
import { claseEnlaceInventario } from "@/components/inventario/tipos";
import { mostrarFecha } from "@/components/compras/calculos";
import useAvisosPreparaciones from "./useAvisosPreparaciones";
import type {
  HojaConsolidada,
  ProductoConsolidado,
  OpcionPreparacion,
} from "./tipos";
import "./impresion.css";

export default function ImpresionConsolidada({
  consulta,
}: {
  consulta: string;
}) {
  const t = useTranslations("preparaciones");
  const { avisos, cerrarAviso, tratarError } = useAvisosPreparaciones();
  const [hoja, establecerHoja] = useState<HojaConsolidada>();
  const [fallo, establecerFallo] = useState(false);
  const [avance, establecerAvance] = useState({ actual: 0, total: 0 });
  const [revision, establecerRevision] = useState(0);
  useEffect(() => {
    document.body.classList.add("impresion-preparaciones");
    return () => document.body.classList.remove("impresion-preparaciones");
  }, []);
  useEffect(() => {
    const controlador = new AbortController();
    const cargar = async () => {
      try {
        const parametros = new URLSearchParams(consulta);
        parametros.set("pagina", "1");
        parametros.set("pagina_sucursales", "1");
        parametros.delete("version_hoja");
        const primera = await api<HojaConsolidada>(
          `preparaciones/consolidado/?${parametros}`,
          { signal: controlador.signal },
        );
        const productos = new Map<number, ProductoConsolidado>();
        const sucursales = new Map<number, OpcionPreparacion>();
        const agregar = (pagina: HojaConsolidada) => {
          pagina.results.forEach((producto) =>
            productos.set(producto.id, {
              ...producto,
              sucursales: {
                ...productos.get(producto.id)?.sucursales,
                ...producto.sucursales,
              },
            }),
          );
          pagina.sucursales.results.forEach((sucursal) =>
            sucursales.set(sucursal.id, sucursal),
          );
        };
        agregar(primera);
        const paginasProductos = Math.max(1, Math.ceil(primera.count / 10));
        const paginasSucursales = Math.max(
          1,
          Math.ceil(primera.sucursales.count / 10),
        );
        const total = paginasProductos * paginasSucursales;
        let actual = 1;
        if (!controlador.signal.aborted) establecerAvance({ actual, total });
        parametros.set("version_hoja", primera.version_hoja);
        for (let columna = 1; columna <= paginasSucursales; columna++)
          for (let fila = 1; fila <= paginasProductos; fila++) {
            if (columna === 1 && fila === 1) continue;
            if (controlador.signal.aborted) return;
            parametros.set("pagina", String(fila));
            parametros.set("pagina_sucursales", String(columna));
            agregar(
              await api<HojaConsolidada>(
                `preparaciones/consolidado/?${parametros}`,
                { signal: controlador.signal },
              ),
            );
            actual++;
            if (!controlador.signal.aborted)
              establecerAvance({ actual, total });
          }
        if (!controlador.signal.aborted)
          establecerHoja({
            ...primera,
            results: [...productos.values()],
            sucursales: {
              ...primera.sucursales,
              results: [...sucursales.values()],
            },
          });
      } catch (error) {
        if (!controlador.signal.aborted) {
          establecerFallo(true);
          tratarError(error);
        }
      }
    };
    void cargar();
    return () => controlador.abort();
  }, [consulta, revision, tratarError]);
  const pendiente = new URLSearchParams(consulta).get("vista") === "pendiente";
  return (
    <div className="space-y-6">
      <section className={`${clasePanel} space-y-4 p-5 sm:p-6`}>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t("imprimirHoja")}
        </h1>
        <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t("impresionAyuda")}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/preparaciones" className={claseEnlaceInventario}>
            {t("volverHoja")}
          </Link>
          <Button
            disabled={!hoja?.results.length || fallo}
            onClick={() => window.print()}
          >
            {t("imprimirCompleta")}
          </Button>
        </div>
        {fallo ? (
          <div role="alert" className="space-y-3">
            <p className="text-sm text-error-500 dark:text-error-400">
              {t("impresionCambio")}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                establecerFallo(false);
                establecerHoja(undefined);
                establecerAvance({ actual: 0, total: 0 });
                establecerRevision((valor) => valor + 1);
              }}
            >
              {t("recargar")}
            </Button>
          </div>
        ) : !hoja ? (
          <p role="status" className="text-sm text-gray-500 dark:text-gray-400">
            {avance.total
              ? t("cargandoPaginas", {
                  actual: avance.actual,
                  total: avance.total,
                })
              : t("cargando")}
          </p>
        ) : !hoja.results.length ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("sinPedidosFiltro")}
          </p>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("impresionCantidad", {
              productos: hoja.results.length,
              sucursales: hoja.sucursales.results.length,
            })}
          </p>
        )}
      </section>
      {hoja && !fallo && (
        <>
          <div className="overflow-x-auto rounded-xl bg-white p-6 text-gray-900 shadow-theme-xs">
            <ContenidoHoja hoja={hoja} pendiente={pendiente} />
          </div>
          {typeof document !== "undefined" &&
            createPortal(
              <div className="documento-impresion-preparaciones">
                <ContenidoHoja hoja={hoja} pendiente={pendiente} />
              </div>,
              document.body,
            )}
        </>
      )}
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </div>
  );
}
function ContenidoHoja({
  hoja,
  pendiente,
}: {
  hoja: HojaConsolidada;
  pendiente: boolean;
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  const categorias = [
    ...new Set(hoja.results.map((producto) => producto.categoria)),
  ];
  const grupos: OpcionPreparacion[][] = [];
  for (let indice = 0; indice < hoja.sucursales.results.length; indice += 4)
    grupos.push(hoja.sucursales.results.slice(indice, indice + 4));
  const medida = pendiente ? "pendiente" : "solicitada";
  return (
    <>
      {categorias.flatMap((categoria) =>
        grupos.map((sucursales, bloque) => (
          <section
            className="pagina-hoja-preparacion"
            key={`${categoria}-${bloque}`}
          >
            <header className="cabecera-hoja-preparacion">
              <MarcaHortyfru pequena />
              <div>
                <h2>
                  {t("hojaConsolidada")} · {categoria}
                </h2>
                <p>
                  {hoja.cliente.nombre} ·{" "}
                  {mostrarFecha(hoja.fecha_pedidos, idioma)}
                </p>
                <p>
                  {t(pendiente ? "pendiente" : "solicitado")} ·{" "}
                  {t("grupoSucursales", {
                    desde: bloque * 4 + 1,
                    hasta: bloque * 4 + sucursales.length,
                    total: hoja.sucursales.count,
                  })}
                </p>
              </div>
            </header>
            <p className="nota-hoja-preparacion">
              {t("leyendaCantUni")} {t("totalTodasSucursales")}
            </p>
            <table className="tabla-hoja-preparacion">
              <thead>
                <tr>
                  <th rowSpan={2}>{t("producto")}</th>
                  {sucursales.map((sucursal) => (
                    <th key={sucursal.id} colSpan={2}>
                      {sucursal.nombre}
                    </th>
                  ))}
                  <th colSpan={2}>{t("totalCliente")}</th>
                </tr>
                <tr>
                  {sucursales.map((sucursal) => (
                    <ParEncabezado key={sucursal.id} />
                  ))}
                  <ParEncabezado />
                </tr>
              </thead>
              <tbody>
                {hoja.results
                  .filter((producto) => producto.categoria === categoria)
                  .map((producto) => (
                    <tr key={producto.id}>
                      <th scope="row">{producto.nombre}</th>
                      {sucursales.map((sucursal) => (
                        <ParCantidades
                          key={sucursal.id}
                          cajas={
                            producto.sucursales[String(sucursal.id)]?.cajas?.[
                              medida
                            ] || 0
                          }
                          unidades={
                            producto.sucursales[String(sucursal.id)]
                              ?.unidades?.[medida] || 0
                          }
                        />
                      ))}
                      <ParCantidades
                        cajas={
                          pendiente ? producto.pendientes_cajas : producto.cajas
                        }
                        unidades={
                          pendiente
                            ? producto.pendientes_unidades
                            : producto.unidades
                        }
                      />
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        )),
      )}
    </>
  );
}
function ParEncabezado() {
  return (
    <>
      <th>CANT</th>
      <th>UNI</th>
    </>
  );
}
function ParCantidades({
  cajas,
  unidades,
}: {
  cajas: number;
  unidades: number;
}) {
  return (
    <>
      <td>{cajas || "—"}</td>
      <td>{unidades || "—"}</td>
    </>
  );
}
