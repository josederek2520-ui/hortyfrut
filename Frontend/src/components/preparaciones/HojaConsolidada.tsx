"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Printer as IconoImprimir,
  RefreshCw as IconoActualizar,
  ClipboardList as IconoPreparar,
} from "lucide-react";
import Button from "@/components/ui/button/Button";
import CampoFecha from "@/components/form/CampoFecha";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import Label from "@/components/form/Label";
import DesplegableCompra from "@/components/compras/DesplegableCompra";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import {
  clasePanel,
  type PaginaCompra as Pagina,
} from "@/components/compras/tipos";
import { claseEnlaceInventario } from "@/components/inventario/tipos";
import { fechaLocal } from "@/components/pedidos/fechas";
import useConsultaPreparacion from "./useConsultaPreparacion";
import MatrizConsolidada from "./MatrizConsolidada";
import type { HojaConsolidada as DatosHoja, OpcionPreparacion } from "./tipos";

export default function HojaConsolidada({
  puedeCrear,
  alError,
  clienteInicial,
  fechaInicial,
}: {
  puedeCrear: boolean;
  alError: (error: unknown) => void;
  clienteInicial?: number;
  fechaInicial?: string;
}) {
  const t = useTranslations("preparaciones");
  const [fecha, establecerFecha] = useState(fechaInicial || fechaLocal);
  const [cliente, establecerCliente] = useState<OpcionPreparacion | null>(clienteInicial ? { id: clienteInicial, nombre: t("cliente") } : null);
  const [categoria, establecerCategoria] = useState<OpcionPreparacion | null>(
    null,
  );
  const [buscar, establecerBuscar] = useState("");
  const [vista, establecerVista] = useState<"solicitado" | "pendiente">(
    "solicitado",
  );
  const [pagina, establecerPagina] = useState(1);
  const [paginaSucursales, establecerPaginaSucursales] = useState(1);
  const contexto = new URLSearchParams({
    fecha_pedidos: fecha,
    cliente: String(cliente?.id || ""),
  });
  const consulta = new URLSearchParams(contexto);
  consulta.set("pagina", String(pagina));
  consulta.set("pagina_sucursales", String(paginaSucursales));
  consulta.set("vista", vista);
  consulta.set("buscar", buscar);
  if (categoria) consulta.set("categoria", String(categoria.id));
  const { datos, cargando, fallo, recargar } =
    useConsultaPreparacion<DatosHoja>(
      cliente && fecha ? `preparaciones/consolidado/?${consulta}` : null,
      alError,
    );
  const { datos: categorias } = useConsultaPreparacion<
    Pagina<OpcionPreparacion>
  >(cliente && fecha ? `preparaciones/categorias/?${contexto}` : null, alError);
  const reiniciar = () => {
    establecerPagina(1);
    establecerPaginaSucursales(1);
  };
  return (
    <div className="space-y-6">
      <section className={`${clasePanel} p-5 sm:p-6`}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t("elegirJornada")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t("jornadaAyuda")}
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="fecha-hoja-preparacion">{t("fechaPedidos")}</Label>
            <CampoFecha
              id="fecha-hoja-preparacion"
              value={fecha}
              required
              alCambiar={(valor) => {
                establecerFecha(valor);
                establecerCliente(null);
                establecerCategoria(null);
                reiniciar();
              }}
            />
          </div>
          <DesplegableCompra<OpcionPreparacion> tipo="general"
            key={fecha}
            ruta={`preparaciones/clientes/?fecha_pedidos=${fecha}`}
            etiqueta={t("cliente")}
            valor={datos && datos.cliente.id === cliente?.id ? datos.cliente : cliente}
            deshabilitado={!fecha}
            alElegir={(valor) => {
              establecerCliente(valor);
              establecerCategoria(null);
              reiniciar();
            }}
            alError={alError}
          />
        </div>
      </section>
      {!cliente ? (
        <div
          className={`${clasePanel} p-10 text-center text-sm text-gray-500 dark:text-gray-400`}
        >
          <IconoPreparar
            className="mx-auto mb-4 size-10 text-brand-400"
            aria-hidden="true"
          />
          {t("seleccionarClienteFecha")}
        </div>
      ) : (
        <>
          {datos && (
            <dl className="grid gap-3 sm:grid-cols-3">
              {[
                ["pedidosDelDia", datos.resumen.pedidos],
                ["sucursales", datos.sucursales.count],
                ["productos", datos.resumen.productos],
              ].map(([clave, cantidad]) => (
                <div key={clave} className={`${clasePanel} p-5`}>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">
                    {t(String(clave))}
                  </dt>
                  <dd className="mt-2 text-2xl font-semibold text-gray-900 tabular-nums dark:text-white">
                    {cantidad}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <section className={`${clasePanel} space-y-5 p-5 sm:p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t("hojaConsolidada")}
                </h2>
                <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                  {t("matrizAyuda")}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cargando}
                  onClick={recargar}
                  aria-label={t("actualizarHoja")}
                  startIcon={<IconoActualizar className="size-4" />}
                >
                  {t("actualizar")}
                </Button>
                {datos && datos.count > 0 && (
                  <Link
                    href={`/preparaciones/hoja?${consulta}`}
                    target="_blank"
                    rel="noopener"
                    className={claseEnlaceInventario}
                  >
                    <IconoImprimir className="size-4" aria-hidden="true" />
                    {t("imprimirHoja")}
                  </Link>
                )}
                {puedeCrear &&
                  datos &&
                  datos.resumen.lineas_pendientes > 0 &&
                  datos.cliente.activo && (
                    <Link
                      href={`/preparaciones/nuevo?${contexto}`}
                      className="boton-principal-hortyfru inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-medium text-white focus-visible:ring-3 focus-visible:ring-brand-400"
                    >
                      <IconoPreparar className="size-4" aria-hidden="true" />
                      {t("prepararPedidos")}
                    </Link>
                  )}
              </div>
            </div>
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label={t("categorias")}
            >
              <Button
                size="sm"
                variant={!categoria ? "primary" : "outline"}
                aria-pressed={!categoria}
                onClick={() => {
                  establecerCategoria(null);
                  reiniciar();
                }}
              >
                {t("todasCategorias")}
              </Button>
              {categorias?.results.map((opcion) => (
                <Button
                  key={opcion.id}
                  size="sm"
                  variant={categoria?.id === opcion.id ? "primary" : "outline"}
                  aria-pressed={categoria?.id === opcion.id}
                  onClick={() => {
                    establecerCategoria(opcion);
                    reiniciar();
                  }}
                >
                  {opcion.nombre}
                </Button>
              ))}
              {(categorias?.count || 0) > 10 && (
                <DesplegableCompra<OpcionPreparacion> tipo="general"
                  agregar
                  ruta={`preparaciones/categorias/?${contexto}`}
                  etiqueta={t("masCategorias")}
                  valor={categoria}
                  alError={alError}
                  alElegir={(valor) => {
                    establecerCategoria(valor);
                    reiniciar();
                  }}
                />
              )}
            </div>
            <div className="grid items-start gap-4 sm:grid-cols-2">
              <CampoDirectorio
                id="buscar-producto-hoja"
                etiqueta={t("buscarProducto")}
                type="search"
                value={buscar}
                maxLength={150}
                onChange={(evento) => {
                  establecerBuscar(evento.target.value);
                  reiniciar();
                }}
              />
              <div className="self-center">
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label={t("cantidadesMostrar")}
                >
                  {(["solicitado", "pendiente"] as const).map((valor) => (
                    <Button
                      key={valor}
                      size="sm"
                      variant={vista === valor ? "primary" : "outline"}
                      aria-pressed={vista === valor}
                      onClick={() => {
                        establecerVista(valor);
                        reiniciar();
                      }}
                    >
                      {t(valor)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            {fallo ? (
              <div role="alert" className="space-y-3 py-8 text-center">
                <p>{t("errorHoja")}</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    reiniciar();
                    recargar();
                  }}
                >
                  {t("recargar")}
                </Button>
              </div>
            ) : cargando ? (
              <p
                role="status"
                className="py-12 text-center text-sm text-gray-500 dark:text-gray-400"
              >
                {t("cargando")}
              </p>
            ) : datos && datos.results.length > 0 ? (
              <>
                <div className="rounded-xl bg-brand-50 p-3 text-theme-xs leading-5 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
                  {t("leyendaCantUni")}
                </div>
                <MatrizConsolidada hoja={datos} vista={vista} />
                {datos.sucursales.count > 10 && (
                  <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                    <p className="mb-3 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("columnasSucursales")}
                    </p>
                    <PaginadorCompras
                      pagina={paginaSucursales}
                      total={datos.sucursales.count}
                      alCambiar={establecerPaginaSucursales}
                      ocupado={cargando}
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                {t("sinPedidosFiltro")}
              </p>
            )}
            <PaginadorCompras
              pagina={pagina}
              total={datos?.count || 0}
              ocupado={cargando || fallo}
              alCambiar={establecerPagina}
            />
          </section>
        </>
      )}
    </div>
  );
}
