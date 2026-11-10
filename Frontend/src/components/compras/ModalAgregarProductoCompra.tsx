"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ShoppingBasket as IconoCompra,
  Check as IconoAgregado,
  Plus as IconoAgregar,
  ArrowRight as IconoVerCompra,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import ListaProductos from "./ListaProductosAgregarCompra";
import FormularioProducto from "./FormularioProductoCompra";
import VistaAgregarCompra from "./VistaAgregarCompra";
import { mostrarFecha, mostrarCentavos, importeCentavos } from "./calculos";
import estilos from "./estilosAgregarCompra.module.css";
import type { DatosProductoCompra, ProductoAgregarCompra } from "./tipos";

export default function ModalAgregarProductoCompra({
  fecha,
  excluidos,
  productoInicial,
  deshabilitado,
  alCerrar,
  alAgregar,
  alError,
}: {
  fecha: string;
  excluidos: number[];
  productoInicial: ProductoAgregarCompra | null;
  deshabilitado: boolean;
  alCerrar: () => void;
  alAgregar: (datos: DatosProductoCompra) => boolean;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("compras");
  const idioma = useLocale();
  const identificador = useId();
  const [producto, establecerProducto] = useState(productoInicial);
  const [borradores, establecerBorradores] = useState<
    Record<number, DatosProductoCompra>
  >({});
  const [agregado, establecerAgregado] = useState("");
  const agregando = useRef(false);
  const contenido = useRef<HTMLDivElement>(null);
  const posicionLista = useRef(0);
  const productoOrigen = useRef<number | null>(null);
  const productoId = producto?.id;
  useEffect(() => {
    const cuadro = requestAnimationFrame(() => {
      const panel = contenido.current;
      if (!panel) return;
      panel.scrollTop = productoId ? 0 : posicionLista.current;
      const selector = productoId
        ? '[name="detalle_0_proveedor"]'
        : productoOrigen.current
          ? `[data-producto-compra="${productoOrigen.current}"]`
          : 'input[type="search"]';
      (
        panel.querySelector<HTMLElement>(selector) ||
        panel.querySelector<HTMLElement>('input[type="search"]')
      )?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(cuadro);
  }, [productoId]);
  const datos = producto
    ? borradores[producto.id] || {
        producto,
        presentacion: null,
        proveedor: null,
        cantidad: "",
        importeTotal: "",
      }
    : null;
  const confirmar = () => {
    if (
      !datos ||
      agregando.current ||
      deshabilitado ||
      excluidos.includes(datos.producto.id)
    )
      return;
    agregando.current = true;
    try {
      if (!alAgregar(datos)) return;
      establecerAgregado(datos.producto.nombre);
      productoOrigen.current = null;
      establecerBorradores((anteriores) => {
        const nuevos = { ...anteriores };
        delete nuevos[datos.producto.id];
        return nuevos;
      });
      establecerProducto(null);
    } finally {
      agregando.current = false;
    }
  };
  const elegir = (elegido: ProductoAgregarCompra) => {
    posicionLista.current = contenido.current?.scrollTop || 0;
    productoOrigen.current = elegido.id;
    establecerProducto(elegido);
  };
  const cantidadProductos = new Set(excluidos).size;
  const subtotal = datos?.importeTotal.trim()
    ? importeCentavos(datos.importeTotal)
    : null;
  const identificadorFormulario = `${identificador}-producto`;
  return (
    <Modal
      isOpen
      onClose={alCerrar}
      className={`max-w-2xl ${estilos.modalCompra}`}
      labelledBy={identificador}
      closeLabel={t("cerrar")}
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 p-5 pe-20 sm:p-6 sm:pe-20 dark:border-gray-800">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
          <IconoCompra className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2
            id={identificador}
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            {t(producto ? "completarProductoAgregar" : "elegirProductoAgregar")}
          </h2>
          <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
            {t("solicitadoFechaAgregar", {
              fecha: mostrarFecha(fecha, idioma),
            })}
          </p>
        </div>
      </div>
      <div
        ref={contenido}
        className={`custom-scrollbar ${estilos.contenidoModal} px-5 py-4 sm:px-6 sm:py-5`}
      >
        <VistaAgregarCompra visible={!producto} clave="lista">
          <ListaProductos
            fecha={fecha}
            excluidos={excluidos}
            oculta={!!producto}
            deshabilitado={deshabilitado}
            alError={alError}
            alElegir={elegir}
          />
        </VistaAgregarCompra>
        <VistaAgregarCompra
          visible={!!producto}
          clave={producto?.id || "producto"}
        >
          {producto && datos && (
            <FormularioProducto
              key={producto.id}
              identificador={identificadorFormulario}
              datos={datos}
              fecha={fecha}
              deshabilitado={deshabilitado || excluidos.includes(producto.id)}
              alCambiar={(cambios) =>
                establecerBorradores((anteriores) => ({
                  ...anteriores,
                  [producto.id]: { ...datos, ...cambios },
                }))
              }
              alAgregar={confirmar}
              alVolver={() => establecerProducto(null)}
              alError={alError}
            />
          )}
        </VistaAgregarCompra>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-25 px-5 py-4 sm:px-6 dark:border-gray-800 dark:bg-gray-900">
        {producto ? (
          <>
            <div>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                {t("totalProductoPagado")}
              </p>
              <p className="mt-1 text-lg font-semibold text-gray-900 tabular-nums dark:text-white">
                {mostrarCentavos(subtotal, idioma)}
              </p>
            </div>
            <Button
              type="submit"
              form={identificadorFormulario}
              size="sm"
              disabled={deshabilitado || excluidos.includes(producto.id)}
              startIcon={<IconoAgregar className="size-4" aria-hidden="true" />}
            >
              {t("agregarAHojaCompra")}
            </Button>
          </>
        ) : (
          <>
            <p
              role="status"
              className={`flex min-w-0 flex-1 items-center gap-2 text-theme-xs ${agregado ? "text-brand-700 dark:text-brand-300" : "text-gray-500 dark:text-gray-400"}`}
            >
              {agregado && (
                <IconoAgregado className="size-4 shrink-0" aria-hidden="true" />
              )}
              <span className="break-words">
                {agregado
                  ? t("productoAgregadoBreve", { producto: agregado })
                  : t("puedesSeguirAgregando")}
              </span>
            </p>
            <Button
              size="sm"
              variant={cantidadProductos ? "primary" : "outline"}
              onClick={alCerrar}
              endIcon={
                <IconoVerCompra
                  className="size-4 rtl:rotate-180"
                  aria-hidden="true"
                />
              }
            >
              {t("verCompraProductos", { cantidad: cantidadProductos })}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
