"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import { SearchIcon, LockIcon, EyeIcon } from "@/icons";
import { api, ApiError as ErrorApi } from "@/lib/api";
import type { Session as Sesion } from "@/components/users/types";
import SelectorPedido from "./SelectorPedido";
import EncabezadoHojaPedido from "./EncabezadoHojaPedido";
import ElegirSucursalPedido from "./ElegirSucursalPedido";
import { fechaLocal } from "./fechas";
import TablaHojaPedido from "./TablaHojaPedido";
import ResumenPedido from "./ResumenPedido";
import PaginadorPedidos from "./PaginadorPedidos";
import useAvisosPedidos from "./useAvisosPedidos";
import {
  claseEntrada,
  clasePanel,
  type Pedido,
  type ProductoHoja,
  type CantidadesHoja,
  type ColumnaPedido,
  type OpcionPedido,
  type PaginaResultados,
  type DestinosPedido,
} from "./tipos";

function cantidadesPedido(pedido: Pedido): CantidadesHoja {
  const cantidades: CantidadesHoja = {};
  for (const linea of pedido.detalles) {
    const actual = cantidades[linea.producto] || {
      producto: {
        id: linea.producto,
        nombre: linea.producto_nombre,
        imagen: linea.imagen,
        categoria: { id: 0, nombre: linea.categoria_nombre },
        cajas: null,
        unidades: null,
      },
      cajas: "",
      unidades: "",
    };
    actual[linea.columna] = String(linea.cantidad);
    actual.producto[linea.columna] = {
      id: linea.presentacion,
      nombre: linea.presentacion_nombre,
      disponible: false,
    };
    cantidades[linea.producto] = actual;
  }
  return cantidades;
}

export default function EditorPedido({
  identificador,
  sesion,
}: {
  identificador?: string;
  sesion: Sesion;
}) {
  const t = useTranslations("pedidos"),
    idioma = useLocale(),
    navegador = useRouter();
  const { avisos, notificar, cerrarAviso, tratarError } = useAvisosPedidos();
  const [pedido, establecerPedido] = useState<Pedido | null>(null),
    [cargando, establecerCargando] = useState(true),
    [fallo, establecerFallo] = useState("");
  const [sucursal, establecerSucursal] = useState<OpcionPedido | null>(null),
    [fecha, establecerFecha] = useState(fechaLocal),
    [cantidadDestinos, establecerCantidadDestinos] = useState(0);
  const [cantidades, establecerCantidades] = useState<CantidadesHoja>({}),
    [modificado, establecerModificado] = useState(false),
    [errores, establecerErrores] = useState<Record<string, string[]>>({});
  const [buscar, establecerBuscar] = useState(""),
    [productoCorregir, establecerProductoCorregir] = useState<number | null>(
      null,
    ),
    [categoria, establecerCategoria] = useState<OpcionPedido | null>(null),
    [soloSeleccionados, establecerSoloSeleccionados] = useState(false),
    [pagina, establecerPagina] = useState(1);
  const [catalogo, establecerCatalogo] =
      useState<PaginaResultados<ProductoHoja> | null>(null),
    [cargandoCatalogo, establecerCargandoCatalogo] = useState(true),
    [errorCatalogo, establecerErrorCatalogo] = useState(false);
  const [guardando, establecerGuardando] = useState(false),
    [resumen, establecerResumen] = useState(false),
    [conflicto, establecerConflicto] = useState(false),
    [revision, establecerRevision] = useState(0);
  const enviando = useRef(false),
    claveOperacion = useRef<string | null>(null),
    formulario = useRef<HTMLFormElement>(null),
    focoPendiente = useRef<string | null>(null);
  const seleccionados = Object.values(cantidades).filter(
    (linea) =>
      (!!linea.cajas && Number(linea.cajas) !== 0) ||
      (!!linea.unidades && Number(linea.unidades) !== 0),
  );
  const idsSeleccionados = soloSeleccionados
    ? seleccionados
        .map((linea) => linea.producto.id)
        .sort((a, b) => a - b)
        .join(",")
    : "";
  const permitido =
    sesion.permisos_pedidos.ver &&
    (identificador
      ? sesion.permisos_pedidos.editar
      : sesion.permisos_pedidos.crear);
  useEffect(() => {
    if (!permitido) return;
    const controlador = new AbortController();
    void (async () => {
      try {
        if (identificador) {
          const respuesta = await api<Pedido>(`pedidos/${identificador}/`, {
            signal: controlador.signal,
          });
          establecerPedido(respuesta);
          establecerSucursal({
            id: respuesta.sucursal,
            nombre: respuesta.sucursal_nombre,
            cliente: respuesta.cliente_nombre,
            responsable: respuesta.responsable_nombre,
          });
          establecerFecha(respuesta.fecha_requerida);
          establecerCantidades(cantidadesPedido(respuesta));
        } else {
          const respuesta = await api<DestinosPedido>("pedidos/sucursales/", {
            signal: controlador.signal,
          });
          establecerCantidadDestinos(respuesta.count);
          establecerSucursal(
            respuesta.sucursal_asignada ||
              (respuesta.count === 1 ? respuesta.results[0] : null),
          );
        }
        establecerCargando(false);
      } catch (error) {
        if (!controlador.signal.aborted) {
          establecerFallo(t("errorCarga"));
          establecerCargando(false);
          tratarError(error);
        }
      }
    })();
    return () => controlador.abort();
  }, [identificador, permitido, t, tratarError]);
  useEffect(() => {
    if (!permitido || cargando || !sucursal) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(async () => {
      establecerCargandoCatalogo(true);
      establecerErrorCatalogo(false);
      try {
        const parametros = new URLSearchParams({
          buscar,
          pagina: String(pagina),
          ...(categoria ? { categoria: String(categoria.id) } : {}),
          ...(soloSeleccionados ? { seleccionados: idsSeleccionados } : {}),
          ...(productoCorregir
            ? { seleccionados: String(productoCorregir) }
            : {}),
          ...(identificador ? { pedido: identificador } : {}),
        });
        const respuesta = await api<PaginaResultados<ProductoHoja>>(
          `pedidos/catalogo/?${parametros}`,
          { signal: controlador.signal },
        );
        establecerCatalogo(respuesta);
        establecerCantidades((anteriores) => {
          const nuevos = { ...anteriores };
          for (const producto of respuesta.results) {
            const actual = nuevos[producto.id];
            if (actual) {
              const actualizado = { ...producto };
              for (const columna of ["cajas", "unidades"] as ColumnaPedido[]) {
                if (
                  actual[columna] &&
                  actual.producto[columna]?.id !== producto[columna]?.id
                )
                  actualizado[columna] = actual.producto[columna]
                    ? { ...actual.producto[columna]!, disponible: false }
                    : null;
              }
              nuevos[producto.id] = { ...actual, producto: actualizado };
            }
          }
          return nuevos;
        });
      } catch (error) {
        if (!controlador.signal.aborted) {
          if (error instanceof ErrorApi && error.status === 404 && pagina > 1) {
            establecerPagina(1);
            return;
          }
          establecerErrorCatalogo(true);
          tratarError(error);
        }
      } finally {
        if (!controlador.signal.aborted) establecerCargandoCatalogo(false);
      }
    }, 200);
    return () => {
      controlador.abort();
      window.clearTimeout(temporizador);
    };
  }, [
    permitido,
    cargando,
    sucursal,
    buscar,
    categoria,
    soloSeleccionados,
    productoCorregir,
    idsSeleccionados,
    pagina,
    identificador,
    revision,
    tratarError,
  ]);
  useEffect(() => {
    if (!modificado) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [modificado]);
  useEffect(() => {
    if (!cargandoCatalogo && focoPendiente.current) {
      document.getElementById(focoPendiente.current)?.focus();
      focoPendiente.current = null;
    }
  }, [cargandoCatalogo]);
  const cambiarCantidad = useCallback(
    (producto: ProductoHoja, columna: ColumnaPedido, valor: string) => {
      establecerCantidades((anteriores) => ({
        ...anteriores,
        [producto.id]: {
          ...(anteriores[producto.id] || { producto, cajas: "", unidades: "" }),
          producto: {
            ...(anteriores[producto.id]?.producto || producto),
            ...(!valor || Number(valor) === 0
              ? { [columna]: producto[columna] }
              : {}),
          },
          [columna]: valor,
        },
      }));
      establecerErrores((anteriores) => ({
        ...anteriores,
        [`cantidad_${producto.id}_${columna}`]: [],
      }));
      establecerModificado(true);
    },
    [],
  );
  const enfocarError = (campo: string) => {
    const coincidencia = /^cantidad_(\d+)_/.exec(campo);
    if (coincidencia) {
      const linea = cantidades[Number(coincidencia[1])];
      if (linea) {
        establecerBuscar("");
        establecerProductoCorregir(linea.producto.id);
        establecerCategoria(null);
        establecerSoloSeleccionados(false);
        establecerPagina(1);
        focoPendiente.current = campo;
      }
    }
    window.requestAnimationFrame(() => document.getElementById(campo)?.focus());
  };
  const validar = () => {
    const nuevos: Record<string, string[]> = {};
    if (!sucursal) nuevos.sucursal = [t("sucursalObligatoria")];
    if (
      !fecha ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
      (fecha < fechaLocal() && fecha !== pedido?.fecha_requerida)
    )
      nuevos.fecha_requerida = [t("fechaInvalida")];
    let total = 0;
    for (const linea of Object.values(cantidades)) {
      for (const columna of ["cajas", "unidades"] as ColumnaPedido[]) {
        const valor = linea[columna];
        if (!valor || Number(valor) === 0) continue;
        total++;
        const campo = `cantidad_${linea.producto.id}_${columna}`;
        const anterior = pedido?.detalles.find(
          (detalle) =>
            detalle.producto === linea.producto.id &&
            detalle.columna === columna,
        );
        if (!/^\d+$/.test(valor) || Number(valor) > 999999 || Number(valor) < 1)
          nuevos[campo] = [t("cantidadInvalida")];
        else if (
          !linea.producto[columna]?.disponible &&
          !(
            anterior &&
            anterior.cantidad === Number(valor) &&
            anterior.presentacion === linea.producto[columna]?.id
          )
        )
          nuevos[campo] = [t("presentacionInvalida")];
      }
    }
    if (!total) nuevos.detalles = [t("seleccionarProductos")];
    if (total > 500) nuevos.detalles = [t("limiteCantidades")];
    establecerErrores(nuevos);
    if (Object.keys(nuevos).length) {
      notificar(t("validacion"), "error");
      enfocarError(Object.keys(nuevos)[0]);
      return false;
    }
    return true;
  };
  const guardar = async () => {
    if (enviando.current || conflicto || !validar()) return;
    enviando.current = true;
    establecerGuardando(true);
    establecerFallo("");
    try {
      claveOperacion.current ||= crypto.randomUUID();
      const detalles = Object.values(cantidades).flatMap((linea) =>
        (["cajas", "unidades"] as ColumnaPedido[])
          .filter((columna) => Number(linea[columna]) > 0)
          .map((columna) => ({
            producto: linea.producto.id,
            presentacion: linea.producto[columna]!.id,
            columna,
            cantidad: Number(linea[columna]),
          })),
      );
      await api<Pedido>(`pedidos/${identificador ? `${identificador}/` : ""}`, {
        method: identificador ? "PATCH" : "POST",
        body: JSON.stringify({
          fecha_requerida: fecha,
          detalles,
          ...(pedido
            ? { version: pedido.version }
            : {
                sucursal: sucursal!.id,
                clave_operacion: claveOperacion.current,
              }),
        }),
      });
      establecerModificado(false);
      try {
        sessionStorage.setItem(
          "pedidos:aviso",
          identificador ? "pedidoEditado" : "pedidoCreado",
        );
      } catch {}
      navegador.replace("/pedidos");
      navegador.refresh();
    } catch (error) {
      establecerResumen(false);
      if (error instanceof ErrorApi) {
        establecerErrores(error.errors);
        establecerConflicto(error.status === 409);
        const primerCampo = Object.keys(error.errors)[0];
        if (primerCampo) enfocarError(primerCampo);
        establecerFallo(
          error.status === 400
            ? Object.values(error.errors).flat().join(" ")
            : t(error.status === 409 ? "conflicto" : "errorCarga"),
        );
      } else establecerFallo(t("errorCarga"));
      tratarError(error);
    } finally {
      enviando.current = false;
      establecerGuardando(false);
    }
  };
  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    if (validar()) establecerResumen(true);
  };
  const cancelar = () => {
    if (!guardando && (!modificado || window.confirm(t("descartar"))))
      navegador.push("/pedidos");
  };
  const lineasValidas = seleccionados.filter(
    (linea) => Number(linea.cajas) > 0 || Number(linea.unidades) > 0,
  );
  const fechaMostrada = fecha
    ? new Intl.DateTimeFormat(idioma, { dateStyle: "full" }).format(
        new Date(`${fecha}T12:00:00`),
      )
    : "—";
  if (!permitido)
    return (
      <p className={`${clasePanel} p-8 text-gray-500`}>{t("sinPermiso")}</p>
    );
  if (cargando)
    return <p className={`${clasePanel} p-8 text-gray-500`}>{t("cargando")}</p>;
  if ((identificador && !pedido) || (!identificador && !sucursal && fallo))
    return (
      <div role="alert" className={`${clasePanel} space-y-4 p-8`}>
        <p className="text-error-500">{fallo || t("errorCarga")}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          {t("recargar")}
        </Button>
        <Button variant="outline" onClick={cancelar}>
          {t("volver")}
        </Button>
      </div>
    );
  if (!identificador && !sucursal)
    return (
      <div className="space-y-6">
        <MigasPagina pageTitle={t("nuevo")} />
        <ElegirSucursalPedido
          haySucursales={cantidadDestinos > 0}
          gestionGlobal={sesion.permisos_pedidos.gestionar_todos}
          alElegir={establecerSucursal}
          alVolver={cancelar}
          alError={tratarError}
        />
        <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
      </div>
    );
  const bloqueado =
    !!pedido && (pedido.estado !== "pendiente" || !pedido.puede_editar);
  return (
    <>
      <div className="space-y-6">
        <MigasPagina pageTitle={t(identificador ? "editar" : "nuevo")} />
        <form
          ref={formulario}
          noValidate
          onSubmit={enviar}
          aria-busy={guardando}
          className="space-y-6"
        >
          {(fallo || bloqueado) && (
            <div
              role="alert"
              className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-600 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400"
            >
              <p>{bloqueado ? t("pedidoBloqueado") : fallo}</p>
              {conflicto && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    if (window.confirm(t("descartar"))) {
                      establecerModificado(false);
                      window.location.reload();
                    }
                  }}
                >
                  {t("recargar")}
                </Button>
              )}
            </div>
          )}
          <fieldset
            disabled={
              guardando || bloqueado || (!!fallo && !pedido && !!identificador)
            }
            className="space-y-6"
          >
            <EncabezadoHojaPedido
              pedido={pedido}
              sucursal={sucursal}
              fecha={fecha}
              guardando={guardando}
              errores={errores}
              alFecha={(valor) => {
                establecerFecha(valor);
                establecerModificado(true);
                establecerErrores((actual) => ({
                  ...actual,
                  fecha_requerida: [],
                }));
              }}
            />
            <section className={clasePanel}>
              <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    {t("productos")}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {t("cantidadesAyuda")}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {t("configurarAyuda")}
                  </p>
                </div>
                <span
                  aria-live="polite"
                  className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                >
                  {t("seleccionados", { cantidad: lineasValidas.length })}
                </span>
              </div>
              {productoCorregir && (
                <div
                  role="status"
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-error-100 bg-error-50/50 px-5 py-3 text-sm text-error-600 dark:border-error-500/20 dark:bg-error-500/5 dark:text-error-400"
                >
                  <span>{t("corrigiendoProducto")}</span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        establecerCantidades((actual) => {
                          const nuevas = { ...actual };
                          delete nuevas[productoCorregir];
                          return nuevas;
                        });
                        establecerErrores((actual) => {
                          const nuevos = { ...actual };
                          delete nuevos[`cantidad_${productoCorregir}_cajas`];
                          delete nuevos[
                            `cantidad_${productoCorregir}_unidades`
                          ];
                          return nuevos;
                        });
                        establecerModificado(true);
                        establecerProductoCorregir(null);
                        establecerPagina(1);
                      }}
                    >
                      {t("quitarProducto")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        establecerProductoCorregir(null);
                        establecerPagina(1);
                      }}
                    >
                      {t("mostrarCatalogo")}
                    </Button>
                  </div>
                </div>
              )}
              <div className="grid items-end gap-4 border-t border-gray-100 px-5 py-4 md:grid-cols-[1fr_1fr_auto] dark:border-gray-800">
                <div>
                  <label
                    htmlFor="buscar-productos-pedido"
                    className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    {t("buscarProductos")}
                  </label>
                  <div className="relative">
                    <SearchIcon className="absolute start-3 top-3.5 size-4 text-gray-400" />
                    <input
                      id="buscar-productos-pedido"
                      value={buscar}
                      onChange={(evento) => {
                        establecerBuscar(evento.target.value);
                        establecerProductoCorregir(null);
                        establecerPagina(1);
                      }}
                      className={`${claseEntrada} ps-9`}
                      placeholder={t("buscarProductos")}
                    />
                  </div>
                </div>
                <SelectorPedido
                  ruta="pedidos/categorias/"
                  etiqueta={t("categoria")}
                  valor={categoria}
                  alError={tratarError}
                  alCambiar={(opcion) => {
                    establecerCategoria(opcion);
                    establecerProductoCorregir(null);
                    establecerPagina(1);
                  }}
                />
                <label className="flex h-11 cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={soloSeleccionados}
                    onChange={(evento) => {
                      establecerSoloSeleccionados(evento.target.checked);
                      establecerProductoCorregir(null);
                      establecerPagina(1);
                    }}
                    className="size-4 accent-brand-500"
                  />
                  {t("soloSeleccionados")}
                </label>
              </div>
              {errores.detalles?.length ? (
                <p role="alert" className="px-5 pb-4 text-sm text-error-500">
                  {errores.detalles.join(" ")}
                </p>
              ) : null}
              {cargandoCatalogo ? (
                <p
                  role="status"
                  className="p-10 text-center text-sm text-gray-500"
                >
                  {t("cargando")}
                </p>
              ) : errorCatalogo ? (
                <div role="alert" className="p-8 text-center">
                  <p className="mb-3 text-sm text-error-500">
                    {t("errorCarga")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => establecerRevision((valor) => valor + 1)}
                  >
                    {t("recargar")}
                  </Button>
                </div>
              ) : catalogo?.results.length ? (
                <TablaHojaPedido
                  productos={catalogo.results}
                  cantidades={cantidades}
                  errores={errores}
                  ocupado={guardando}
                  alCambiar={cambiarCantidad}
                />
              ) : (
                <p className="p-10 text-center text-sm text-gray-500">
                  {t("sinProductos")}
                </p>
              )}
              <PaginadorPedidos
                pagina={pagina}
                total={catalogo?.count || 0}
                alCambiar={establecerPagina}
                ocupado={cargandoCatalogo || guardando}
              />
              <p className="flex items-start gap-2 border-t border-gray-100 px-5 py-4 text-xs text-gray-500 dark:border-gray-800">
                <LockIcon className="size-4 shrink-0" />
                {t("recepcionAyuda")}
              </p>
            </section>
          </fieldset>
          <footer
            className={`${clasePanel} sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-4 p-4 shadow-sm`}
          >
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t("seleccionados", { cantidad: lineasValidas.length })}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={guardando}
                onClick={cancelar}
              >
                {t("volver")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                startIcon={<EyeIcon className="size-4" />}
                disabled={guardando || bloqueado || conflicto}
                type="submit"
              >
                {t("verResumen")}
              </Button>
              <Button
                size="sm"
                disabled={guardando || bloqueado || conflicto}
                onClick={() => void guardar()}
              >
                {t(guardando ? "guardando" : "guardar")}
              </Button>
            </div>
          </footer>
        </form>
      </div>
      {resumen && (
        <ResumenPedido
          lineas={lineasValidas}
          sucursal={`${sucursal?.cliente} · ${sucursal?.nombre}`}
          fecha={fechaMostrada}
          ocupado={guardando}
          alCerrar={() => establecerResumen(false)}
          alGuardar={() => void guardar()}
        />
      )}
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </>
  );
}
