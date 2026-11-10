"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft as IconoVolver,
  ClipboardList as IconoNecesidades,
  ShoppingBasket as IconoCompra,
  PanelLeftClose as IconoOcultar,
  PanelLeftOpen as IconoMostrar,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { useFormValidation as useValidacionFormulario } from "@/hooks/useFormValidation";
import { useModal } from "@/hooks/useModal";
import {
  focusInvalidField as enfocarCampoInvalido,
  type FieldErrors as ErroresCampos,
} from "@/lib/form-validation";
import { api, ApiError as ErrorApi } from "@/lib/api";
import { fechaLocal } from "@/components/pedidos/fechas";
import FechasCompra from "./FechasCompra";
import NecesidadesCompra from "./NecesidadesCompra";
import LineasCompra from "./LineasCompra";
import ModalAgregarProductoCompra from "./ModalAgregarProductoCompra";
import {
  incorporarProductoCompra,
  agregarOtroProveedorCompra,
  productosSeleccionadosCompra,
} from "./seleccionProductosCompra";
import BarraCompra from "./BarraCompra";
import ConfirmarDescartarCompra from "./ConfirmarDescartarCompra";
import ConfirmarAccionCompra from "./ConfirmarAccionCompra";
import { validarLineasCompra } from "./validaciones";
import {
  type Compra,
  type LineaFormularioCompra,
  type OpcionCompra,
  type DatosProductoCompra,
  type ProductoAgregarCompra,
} from "./tipos";

function lineasCompra(compra: Compra | null): LineaFormularioCompra[] {
  return (compra?.detalles || []).map((linea) => ({
    clave: `detalle-${linea.id}`,
    id: linea.id,
    producto: {
      id: linea.producto,
      nombre: linea.producto_nombre,
      unidad_nombre: linea.unidad_nombre,
      imagen: linea.producto_imagen,
    },
    presentacion: linea.presentacion
      ? { id: linea.presentacion, nombre: linea.presentacion_nombre }
      : null,
    proveedor: linea.proveedor
      ? { id: linea.proveedor, nombre: linea.proveedor_nombre }
      : null,
    cantidad: linea.cantidad,
    precioUnitario: linea.precio_unitario,
    importeTotal: linea.importe_total ?? linea.subtotal,
  }));
}

export default function FormularioCompra({
  compra,
  alError,
  alRecargar,
  puedeRegistrar,
  puedeEditar,
}: {
  compra: Compra | null;
  alError: (error: unknown) => void;
  alRecargar: () => void;
  puedeRegistrar: boolean;
  puedeEditar: boolean;
}) {
  const t = useTranslations("compras");
  const navegador = useRouter();
  const [compraActual, establecerCompraActual] = useState(compra);
  const [fechaInicial] = useState(fechaLocal);
  const [fechaPedidos, establecerFechaPedidos] = useState(
    compra?.fecha_pedidos || "",
  );
  const [fechaCompra, establecerFechaCompra] = useState(
    compra?.fecha_compra || fechaInicial,
  );
  const [lineas, establecerLineas] = useState<LineaFormularioCompra[]>(() =>
    lineasCompra(compra),
  );
  const [paginaLineas, establecerPaginaLineas] = useState(1);
  const [vista, establecerVista] = useState<"necesidades" | "compra">("compra");
  const [necesidadesVisibles, establecerNecesidadesVisibles] = useState(false);
  const [productoInicial, establecerProductoInicial] =
    useState<ProductoAgregarCompra | null>(null);
  const [claveOperacion] = useState(() => crypto.randomUUID());
  const [guardando, establecerGuardando] = useState(false);
  const [fallo, establecerFallo] = useState("");
  const [conflicto, establecerConflicto] = useState(false);
  const [descartar, establecerDescartar] = useState<
    "salir" | "recargar" | null
  >(null);
  const formulario = useRef<HTMLFormElement>(null);
  const enviando = useRef(false);
  const modalSalida = useModal();
  const modalRevision = useModal();
  const modalProducto = useModal();
  const {
    errors: errores,
    setErrors: establecerErrores,
    validateForm: validarFormulario,
    changeField: cambiarCampo,
    blurField: salirCampo,
  } = useValidacionFormulario();
  const modificado =
    fechaPedidos !== (compraActual?.fecha_pedidos || "") ||
    fechaCompra !== (compraActual?.fecha_compra || fechaInicial) ||
    JSON.stringify(lineas) !== JSON.stringify(lineasCompra(compraActual));
  const puedeModificar = !compraActual || puedeEditar;
  const deshabilitado = guardando || conflicto || !puedeModificar;
  const productosAgregados = lineas.reduce<Record<number, number>>(
    (cuentas, linea) => {
      cuentas[linea.producto.id] = (cuentas[linea.producto.id] || 0) + 1;
      return cuentas;
    },
    {},
  );
  useEffect(() => {
    if (!modificado) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [modificado]);
  const volver = () =>
    navegador.push(compraActual ? `/compras/${compraActual.id}` : "/compras");
  const confirmarDescartar = (modo: "salir" | "recargar") => {
    establecerDescartar(modo);
    modalSalida.openModal();
  };
  const cancelar = () => {
    if (guardando) return;
    if (modificado) confirmarDescartar("salir");
    else volver();
  };
  const mostrarLinea = (indice: number) => {
    establecerVista("compra");
    establecerPaginaLineas(Math.floor(indice / 10) + 1);
    window.requestAnimationFrame(() => {
      const control = formulario.current?.querySelector<HTMLElement>(
        `[name="detalle_${indice}_proveedor"]`,
      );
      control?.focus({ preventScroll: true });
      control?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    });
  };
  const abrirAgregarProducto = (producto: OpcionCompra | null = null) => {
    if (deshabilitado || !fechaPedidos) return;
    const existente = producto
      ? lineas.findIndex((linea) => linea.producto.id === producto.id)
      : -1;
    if (existente >= 0) {
      mostrarLinea(existente);
      return;
    }
    if (lineas.length >= 500) {
      establecerFallo(t("limiteLineas"));
      alError(new ErrorApi(400));
      return;
    }
    establecerProductoInicial(producto);
    modalProducto.openModal();
  };
  const agregarProducto = (datos: DatosProductoCompra) => {
    if (
      deshabilitado ||
      lineas.length >= 500 ||
      lineas.some((linea) => linea.producto.id === datos.producto.id)
    )
      return false;
    const clave = crypto.randomUUID();
    establecerLineas((anteriores) =>
      incorporarProductoCompra(anteriores, datos, clave),
    );
    establecerErrores((anteriores) => ({ ...anteriores, detalles: [] }));
    establecerVista("compra");
    establecerPaginaLineas(Math.floor(lineas.length / 10) + 1);
    return true;
  };
  const agregarProveedor = (linea: LineaFormularioCompra) => {
    if (deshabilitado || !fechaPedidos || lineas.length >= 500) return;
    const clave = crypto.randomUUID();
    establecerLineas((anteriores) =>
      agregarOtroProveedorCompra(anteriores, linea.clave, clave),
    );
    establecerErrores((anteriores) => ({ ...anteriores, detalles: [] }));
    mostrarLinea(lineas.length);
  };
  const cambiarLinea = (
    clave: string,
    cambio: Partial<LineaFormularioCompra>,
  ) => {
    if (deshabilitado) return;
    const indice = lineas.findIndex((linea) => linea.clave === clave);
    establecerLineas((anteriores) =>
      anteriores.map((linea) =>
        linea.clave === clave ? { ...linea, ...cambio } : linea,
      ),
    );
    establecerErrores((anteriores) => {
      const nuevos: ErroresCampos = { ...anteriores, detalles: [] };
      for (const campo of Object.keys(cambio))
        nuevos[
          `detalle_${indice}_${campo === "importeTotal" ? "importe_total" : campo === "precioUnitario" ? "precio_unitario" : campo}`
        ] = [];
      // Una presentación distinta también resuelve una combinación repetida.
      if ("presentacion" in cambio) nuevos[`detalle_${indice}_proveedor`] = [];
      return nuevos;
    });
  };
  const quitar = (clave: string) => {
    if (deshabilitado) return;
    const nuevas = lineas.filter((linea) => linea.clave !== clave);
    establecerLineas(nuevas);
    establecerPaginaLineas(
      Math.min(paginaLineas, Math.max(1, Math.ceil(nuevas.length / 10))),
    );
    establecerErrores((anteriores) =>
      Object.fromEntries(
        Object.entries(anteriores).filter(
          ([campo]) => !campo.startsWith("detalle_") && campo !== "detalles",
        ),
      ),
    );
  };
  const enfocarError = (problemas: ErroresCampos) => {
    const clave = Object.keys(problemas).find(
      (campo) => campo.startsWith("detalle_") && problemas[campo]?.length,
    );
    if (clave || problemas.detalles?.length) establecerVista("compra");
    if (clave)
      establecerPaginaLineas(Math.floor(Number(clave.split("_")[1]) / 10) + 1);
    if (formulario.current) enfocarCampoInvalido(formulario.current);
  };
  const aplicarCompra = (guardada: Compra) => {
    establecerCompraActual(guardada);
    establecerFechaPedidos(guardada.fecha_pedidos);
    establecerFechaCompra(guardada.fecha_compra);
    establecerLineas(lineasCompra(guardada));
  };
  const terminar = (
    guardada: Compra,
    aviso: "creado" | "editado" | "registrada",
  ) => {
    aplicarCompra(guardada);
    try {
      sessionStorage.setItem("compras:aviso", aviso);
    } catch {
      /* El guardado no depende del almacenamiento local. */
    }
    navegador.push(`/compras/${guardada.id}`);
    navegador.refresh();
  };
  const guardar = async (
    evento?: FormEvent<HTMLFormElement>,
    revisar = false,
  ) => {
    evento?.preventDefault();
    if (
      enviando.current ||
      guardando ||
      conflicto ||
      !formulario.current ||
      (revisar && !puedeRegistrar)
    )
      return;
    if (!puedeModificar && modificado) return;
    const problemas = validarLineasCompra(lineas, revisar, {
      cantidad: t("cantidadInvalida"),
      precio: t("importeProductoInvalido"),
      proveedor: t("proveedorObligatorio"),
      cantidadPositiva: t("cantidadPositiva"),
      precioPositivo: t("importeProductoPositivo"),
      sinLineas: t("sinLineasRegistro"),
      duplicada: t("lineaDuplicada"),
      importe: t("importeMaximo"),
      totalPositivo: t("totalPositivo"),
    });
    if (!validarFormulario(formulario.current, problemas)) {
      establecerFallo(t("validacion"));
      enfocarError(problemas);
      alError(new ErrorApi(400));
      return;
    }
    establecerFallo("");
    if (compraActual && !modificado) {
      if (revisar) modalRevision.openModal();
      else terminar(compraActual, "editado");
      return;
    }
    enviando.current = true;
    establecerGuardando(true);
    try {
      const guardada = await api<Compra>(
        compraActual ? `compras/${compraActual.id}/` : "compras/",
        {
          method: compraActual ? "PATCH" : "POST",
          body: JSON.stringify({
            fecha_pedidos: fechaPedidos,
            fecha_compra: fechaCompra,
            ...(compraActual
              ? { version: compraActual.version }
              : { clave_operacion: claveOperacion }),
            detalles: lineas.map((linea) => ({
              ...(linea.id ? { id: linea.id } : {}),
              producto: linea.producto.id,
              presentacion: linea.presentacion?.id || null,
              proveedor: linea.proveedor?.id || null,
              cantidad: linea.cantidad.trim().replace(",", ".") || "0",
              precio_unitario:
                (linea.precioUnitario || "").trim().replace(",", ".") || "0",
              importe_total: linea.importeTotal.trim().replace(",", ".") || "0",
            })),
          }),
        },
      );
      aplicarCompra(guardada);
      if (revisar) modalRevision.openModal();
      else terminar(guardada, compraActual ? "editado" : "creado");
    } catch (error) {
      if (error instanceof ErrorApi) {
        establecerErrores(error.errors);
        enfocarError(error.errors);
      }
      establecerConflicto(error instanceof ErrorApi && error.status === 409);
      establecerFallo(
        t(
          error instanceof ErrorApi && error.status === 409
            ? "conflicto"
            : error instanceof ErrorApi && error.status === 400
              ? "validacion"
              : "errorGuardar",
        ),
      );
      alError(error);
    } finally {
      enviando.current = false;
      establecerGuardando(false);
    }
  };
  const recargarActual = async () => {
    if (!compraActual) {
      alRecargar();
      return;
    }
    if (enviando.current) return;
    enviando.current = true;
    establecerGuardando(true);
    try {
      const actual = await api<Compra>(`compras/${compraActual.id}/`);
      if (actual.estado !== "borrador") {
        terminar(actual, "editado");
        return;
      }
      aplicarCompra(actual);
      establecerPaginaLineas(1);
      establecerErrores({});
      establecerFallo("");
      establecerConflicto(false);
      modalRevision.closeModal();
      modalSalida.closeModal();
    } catch (error) {
      alError(error);
    } finally {
      enviando.current = false;
      establecerGuardando(false);
    }
  };
  return (
    <div className="space-y-5">
      <div>
        <button
          type="button"
          disabled={guardando}
          onClick={cancelar}
          className="mb-2 inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-medium text-gray-500 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-400 dark:hover:text-brand-300"
        >
          <IconoVolver className="size-4 rtl:rotate-180" aria-hidden="true" />
          {t("volver")}
        </button>
        <MigasPagina
          pageTitle={t(compraActual ? "editarCompra" : "nuevaCompra")}
        />
        <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t("formularioAyuda")}
        </p>
      </div>
      <form
        ref={formulario}
        noValidate
        onSubmit={(evento) => void guardar(evento)}
        aria-busy={guardando}
        className="space-y-5"
      >
        {fallo && (
          <div
            role="alert"
            className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-600 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400"
          >
            <p>{fallo}</p>
            {conflicto && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => confirmarDescartar("recargar")}
              >
                {t("recargar")}
              </Button>
            )}
          </div>
        )}
        <FechasCompra
          fechaPedidos={fechaPedidos}
          fechaCompra={fechaCompra}
          alPedidos={(fecha, control) => {
            establecerFechaPedidos(fecha);
            cambiarCampo(control);
          }}
          alCompra={(fecha, control) => {
            establecerFechaCompra(fecha);
            cambiarCampo(control);
          }}
          alSalir={salirCampo}
          errores={errores}
          deshabilitado={deshabilitado}
        />
        {compraActual && (
          <p
            role="status"
            className="px-1 text-theme-xs text-gray-500 dark:text-gray-400"
          >
            {modificado
              ? `${compraActual.codigo} · ${t("cambiosSinGuardar")}`
              : t(
                  puedeModificar
                    ? "borradorGuardadoHoja"
                    : "borradorSinEdicion",
                  { codigo: compraActual.codigo },
                )}
          </p>
        )}
        <div
          role="group"
          aria-label={t("seccionesHoja")}
          className="flex w-fit max-w-full gap-1 rounded-xl bg-gray-100 p-1 2xl:hidden dark:bg-gray-800"
        >
          <Button
            size="sm"
            variant="outline"
            aria-pressed={vista === "necesidades"}
            aria-controls="panel-necesidades-compra"
            onClick={() => establecerVista("necesidades")}
            startIcon={<IconoNecesidades className="size-4" />}
          >
            {t("necesidadesDia")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-pressed={vista === "compra"}
            aria-controls="panel-hoja-compra"
            onClick={() => establecerVista("compra")}
            startIcon={<IconoCompra className="size-4" />}
          >
            {t("miCompra")}{" "}
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-theme-xs text-gray-800 dark:bg-gray-700 dark:text-gray-100">
              {lineas.length}
            </span>
          </Button>
        </div>
        <div className="hidden items-center justify-between gap-4 2xl:flex">
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            {t("hojaTrabajoBreve")}
          </p>
          <button
            type="button"
            aria-expanded={necesidadesVisibles}
            aria-controls="panel-necesidades-compra"
            onClick={() => establecerNecesidadesVisibles((valor) => !valor)}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-theme-xs font-medium text-brand-700 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300 dark:hover:bg-brand-500/10"
          >
            {necesidadesVisibles ? (
              <IconoOcultar className="size-4" aria-hidden="true" />
            ) : (
              <IconoMostrar className="size-4" aria-hidden="true" />
            )}
            {t(
              necesidadesVisibles ? "ocultarNecesidades" : "mostrarNecesidades",
            )}
          </button>
        </div>
        <div
          className={`grid items-start gap-5 ${necesidadesVisibles ? "2xl:grid-cols-[20rem_minmax(0,1fr)]" : ""}`}
        >
          <div
            id="panel-necesidades-compra"
            className={`min-w-0 ${necesidadesVisibles ? "2xl:sticky 2xl:top-28 2xl:block" : "2xl:hidden"} ${vista === "necesidades" ? "" : "hidden"}`}
          >
            <NecesidadesCompra
              key={fechaPedidos || "sin-fecha"}
              fecha={fechaPedidos}
              alAgregar={abrirAgregarProducto}
              alError={alError}
              deshabilitado={deshabilitado}
              compacta
              productosAgregados={productosAgregados}
            />
          </div>
          <div
            id="panel-hoja-compra"
            className={`min-w-0 space-y-4 2xl:block ${vista === "compra" ? "" : "hidden"}`}
          >
            <LineasCompra
              lineas={lineas}
              fechaPedidos={fechaPedidos}
              alCambiar={cambiarLinea}
              alAbrirAgregar={() => abrirAgregarProducto()}
              alAgregarProveedor={agregarProveedor}
              alQuitar={quitar}
              pagina={paginaLineas}
              alPagina={establecerPaginaLineas}
              errores={errores}
              deshabilitado={deshabilitado}
              puedeAgregar={!!fechaPedidos}
              alError={alError}
            />
          </div>
        </div>
        <BarraCompra
          lineas={lineas}
          guardando={guardando}
          conflicto={conflicto}
          puedeGuardar={puedeModificar}
          puedeRegistrar={puedeRegistrar}
          alSalir={cancelar}
          alRevisar={() => void guardar(undefined, true)}
        />
      </form>
      {modalProducto.isOpen && fechaPedidos && (
        <ModalAgregarProductoCompra
          key={fechaPedidos}
          fecha={fechaPedidos}
          excluidos={productosSeleccionadosCompra(lineas)}
          productoInicial={productoInicial}
          deshabilitado={deshabilitado || lineas.length >= 500}
          alCerrar={modalProducto.closeModal}
          alAgregar={agregarProducto}
          alError={alError}
        />
      )}
      {modalRevision.isOpen && compraActual && (
        <ConfirmarAccionCompra
          key={compraActual.version}
          compra={compraActual}
          accion="registrar"
          mostrarRevision
          alCerrar={modalRevision.closeModal}
          alError={alError}
          alRecargar={() => void recargarActual()}
          alGuardar={(registrada) => {
            modalRevision.closeModal();
            terminar(registrada, "registrada");
          }}
        />
      )}
      {modalSalida.isOpen && descartar && (
        <ConfirmarDescartarCompra
          recargar={descartar === "recargar"}
          alCerrar={modalSalida.closeModal}
          alConfirmar={() => {
            if (descartar === "recargar") void recargarActual();
            else volver();
          }}
        />
      )}
    </div>
  );
}
