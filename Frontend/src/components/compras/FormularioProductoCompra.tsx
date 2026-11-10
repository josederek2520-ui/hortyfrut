"use client";
import { useRef, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft as IconoVolver } from "lucide-react";
import ImagenProducto from "@/components/productos/ImagenProducto";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import { useFormValidation as useValidacionFormulario } from "@/hooks/useFormValidation";
import DesplegableCompra from "./DesplegableCompra";
import { mostrarFecha } from "./calculos";
import CantidadesSolicitadasCompra from "./CantidadesSolicitadasCompra";
import { validarLineasCompra } from "./validaciones";
import type { DatosProductoCompra } from "./tipos";

export default function FormularioProductoCompra({
  datos,
  identificador,
  fecha,
  deshabilitado,
  alCambiar,
  alAgregar,
  alVolver,
  alError,
}: {
  datos: DatosProductoCompra;
  identificador: string;
  fecha: string;
  deshabilitado: boolean;
  alCambiar: (cambios: Partial<Omit<DatosProductoCompra, "producto">>) => void;
  alAgregar: () => void;
  alVolver: () => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("compras");
  const idioma = useLocale();
  const formulario = useRef<HTMLFormElement>(null);
  const {
    errors: errores,
    setErrors: establecerErrores,
    validateForm: validarFormulario,
  } = useValidacionFormulario();
  const cambiar = (cambio: Partial<Omit<DatosProductoCompra, "producto">>) => {
    alCambiar(cambio);
    establecerErrores({});
  };
  const agregar = (evento: FormEvent) => {
    evento.preventDefault();
    evento.stopPropagation();
    if (deshabilitado || !formulario.current) return;
    const problemas = validarLineasCompra(
      [{ ...datos, clave: "producto-modal" }],
      false,
      {
        cantidad: t("cantidadInvalida"),
        precio: t("importeProductoInvalido"),
        proveedor: t("proveedorObligatorio"),
        cantidadPositiva: t("cantidadPositiva"),
        precioPositivo: t("importeProductoPositivo"),
        sinLineas: t("sinLineasRegistro"),
        duplicada: t("lineaDuplicada"),
        importe: t("importeMaximo"),
        totalPositivo: t("totalPositivo"),
      },
    );
    if (validarFormulario(formulario.current, problemas)) alAgregar();
  };
  const tieneSolicitud =
    (datos.producto.cajas || 0) > 0 || (datos.producto.unidades || 0) > 0;
  return (
    <form
      id={identificador}
      ref={formulario}
      noValidate
      onSubmit={agregar}
      className="space-y-5"
    >
      <button
        type="button"
        onClick={alVolver}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
      >
        <IconoVolver className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t("volverProductosAgregar")}
      </button>
      <div className="space-y-3">
        <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-center gap-4">
            <span className="w-16 shrink-0 [&>span]:size-16">
              <ImagenProducto
                origen={datos.producto.imagen || null}
                nombre={datos.producto.nombre}
              />
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold break-words text-gray-900 dark:text-white">
                {datos.producto.nombre}
              </h3>
              <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                {datos.producto.categoria?.nombre || datos.producto.subtitulo}
              </p>
            </div>
          </div>
          <section
            aria-label={t("solicitadoAgregar")}
            className="rounded-xl border border-orange-100 bg-orange-25 px-4 py-3 sm:max-w-64 dark:border-orange-500/20 dark:bg-orange-500/5"
          >
            <p className="text-theme-xs leading-5 font-medium text-gray-600 dark:text-gray-300">
              {t("solicitadoFechaAgregar", {
                fecha: mostrarFecha(fecha, idioma),
              })}
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
              {tieneSolicitud ? (
                <CantidadesSolicitadasCompra
                  cajas={datos.producto.cajas}
                  unidades={datos.producto.unidades}
                />
              ) : (
                t("sinPedidosProductoFecha")
              )}
            </p>
          </section>
        </div>
        {tieneSolicitud && (
          <p className="text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
            {t("referenciaCantidadAgregar")}
          </p>
        )}
      </div>
      <fieldset disabled={deshabilitado} className="grid gap-5 sm:grid-cols-2">
        <DesplegableCompra
          tipo="proveedor"
          ruta={`compras/proveedores/?producto=${datos.producto.id}`}
          etiqueta={t("proveedor")}
          nombre="detalle_0_proveedor"
          valor={datos.proveedor}
          alElegir={(proveedor) => cambiar({ proveedor })}
          alError={alError}
          opcionVacia={t("elegirProveedorHoja")}
          deshabilitado={deshabilitado}
        />
        <DesplegableCompra
          tipo="presentacion"
          ruta={`compras/presentaciones/?producto=${datos.producto.id}`}
          etiqueta={t("presentacionCompra")}
          nombre="detalle_0_presentacion"
          valor={datos.presentacion}
          alElegir={(presentacion) => cambiar({ presentacion })}
          alError={alError}
          opcionVacia={t("unidadBase", {
            unidad: datos.producto.unidad_nombre || "—",
          })}
          deshabilitado={deshabilitado}
        />
        <CampoDirectorio
          id="agregar-cantidad-compra"
          name="detalle_0_cantidad"
          etiqueta={t("cantidadComprada")}
          inputMode="decimal"
          pattern="[0-9]{1,9}([.,][0-9]{1,3})?"
          maxLength={13}
          placeholder="—"
          value={datos.cantidad}
          disabled={deshabilitado}
          errores={errores.detalle_0_cantidad}
          ayuda={t("cantidadManualAgregar")}
          onChange={(evento) => cambiar({ cantidad: evento.target.value })}
        />
        <CampoDirectorio
          id="agregar-total-compra"
          name="detalle_0_importe_total"
          etiqueta={t("totalProductoPagado")}
          inputMode="decimal"
          pattern="[0-9]{1,12}([.,][0-9]{1,2})?"
          maxLength={15}
          placeholder="0.00"
          value={datos.importeTotal}
          disabled={deshabilitado}
          errores={errores.detalle_0_importe_total}
          ayuda={t("ayudaTotalProducto")}
          onChange={(evento) => cambiar({ importeTotal: evento.target.value })}
        />
      </fieldset>
      {!!errores.detalles?.length && (
        <p role="alert" className="text-sm text-error-500 dark:text-error-400">
          {errores.detalles.join(" ")}
        </p>
      )}
      <p className="text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
        {t("datosOpcionalesAgregar")}
      </p>
    </form>
  );
}
