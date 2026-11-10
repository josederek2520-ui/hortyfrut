"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus as IconoAgregar, Trash2 as IconoQuitar } from "lucide-react";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import ColorCajilla from "@/components/cajillas/ColorCajilla";
import DesplegableCompra from "@/components/compras/DesplegableCompra";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import {
  anotarCajillasProducto,
  cajillasDelProducto,
  sugerenciaCajillasProducto,
  saldoPrevistoColor,
} from "./planCajillasPreparacion";
import type { DocumentoEditable, OpcionPreparacion } from "./tipos";
import estilos from "./estilosTrabajo.module.css";

export interface EntradaCajillasProducto {
  cantidadManual: string | null;
  agregando: boolean;
}

export default function CajillasProductoPreparacion({
  documento,
  producto,
  sucursal,
  almacen,
  ocupado,
  errores,
  alCambiar,
  alError,
  entrada,
  alEntrada,
}: {
  documento: DocumentoEditable;
  producto: OpcionPreparacion;
  sucursal: OpcionPreparacion;
  almacen?: number;
  ocupado: boolean;
  errores: Record<string, string[]>;
  alCambiar: (documento: DocumentoEditable) => void;
  alError: (error: unknown) => void;
  entrada?: EntradaCajillasProducto;
  alEntrada?: (cambio: Partial<EntradaCajillasProducto>) => void;
}) {
  const t = useTranslations("preparaciones");
  const identificador = useId();
  const filas = cajillasDelProducto(documento, producto.id, sucursal.id);
  const indiceError = filas.findIndex((fila) =>
    Object.keys(errores).some(
      (campo) =>
        campo.startsWith(
          "cajillas_" + documento.cajillas.indexOf(fila) + "_",
        ) && errores[campo]?.length,
    ),
  );
  const [pagina, establecerPagina] = useState(
    indiceError < 0 ? 1 : Math.floor(indiceError / 10) + 1,
  );
  const [cantidadLocal, establecerCantidadLocal] = useState<string | null>(
    null,
  );
  const [agregandoLocal, establecerAgregandoLocal] = useState(false);
  const cantidadManual = entrada ? entrada.cantidadManual : cantidadLocal;
  const agregando = entrada ? entrada.agregando : agregandoLocal;
  const establecerCantidadManual = (cantidadManual: string | null) =>
    alEntrada
      ? alEntrada({ cantidadManual })
      : establecerCantidadLocal(cantidadManual);
  const establecerAgregando = (agregando: boolean) =>
    alEntrada ? alEntrada({ agregando }) : establecerAgregandoLocal(agregando);
  const [fallo, establecerFallo] = useState("");
  const sugerida = sugerenciaCajillasProducto(
    documento,
    producto.id,
    sucursal.id,
  );
  const cantidad = cantidadManual ?? (sugerida > 0 ? String(sugerida) : "");
  const paginaActual = Math.min(
    pagina,
    Math.max(1, Math.ceil(filas.length / 10)),
  );
  const agregar = (color: OpcionPreparacion | null) => {
    if (!color || ocupado) return;
    const repetida = filas.findIndex((fila) => fila.color.id === color.id);
    if (repetida >= 0) {
      establecerPagina(Math.floor(repetida / 10) + 1);
      establecerAgregando(false);
      establecerFallo(t("colorYaAnotadoPanel"));
      return;
    }
    if (documento.cajillas.length >= 500) {
      establecerFallo(t("limiteFilasTrabajo"));
      return;
    }
    const nuevo = cantidad
      ? anotarCajillasProducto(
          documento,
          producto,
          sucursal,
          color,
          cantidad,
          crypto.randomUUID(),
        )
      : {
          ...documento,
          cajillas: [
            ...documento.cajillas,
            {
              clave: crypto.randomUUID(),
              producto,
              sucursal,
              color,
              cantidad: "",
            },
          ],
        };
    if (!nuevo) {
      establecerFallo(t("revisarCajillas"));
      return;
    }
    alCambiar(nuevo);
    const indiceNuevo = nuevo.cajillas.findIndex(
      (fila) =>
        fila.producto?.id === producto.id &&
        fila.sucursal.id === sucursal.id &&
        fila.color.id === color.id,
    );
    if (typeof requestAnimationFrame === "function")
      requestAnimationFrame(() =>
        document
          .getElementById("cajillas_" + indiceNuevo + "_cantidad")
          ?.focus({ preventScroll: true }),
      );
    establecerCantidadManual(null);
    establecerAgregando(false);
    establecerFallo("");
    establecerPagina(
      Math.floor(
        cajillasDelProducto(nuevo, producto.id, sucursal.id).findIndex(
          (fila) => fila.color.id === color.id,
        ) / 10,
      ) + 1,
    );
  };
  const cambiarColor = (clave: string, color: OpcionPreparacion | null) => {
    if (!color) return;
    const fila = documento.cajillas.find((actual) => actual.clave === clave)!;
    const existente = filas.find(
      (actual) => actual.color.id === color.id && actual.clave !== clave,
    );
    if (existente) {
      const base = {
        ...documento,
        cajillas: documento.cajillas.filter((actual) => actual.clave !== clave),
      };
      const nuevo = anotarCajillasProducto(
        base,
        producto,
        sucursal,
        color,
        fila.cantidad,
        clave,
      );
      if (nuevo) alCambiar(nuevo);
      else establecerFallo(t("revisarCajillas"));
    } else
      alCambiar({
        ...documento,
        cajillas: documento.cajillas.map((actual) =>
          actual.clave === clave ? { ...actual, color } : actual,
        ),
      });
  };
  const descripcion = (color: OpcionPreparacion) =>
    t("cajillasDisponibles", { cantidad: color.saldo ?? 0 });
  return (
    <section
      className="min-w-0 space-y-3"
      aria-label={t("cajillasProductoTitulo")}
    >
      <div>
        <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {t("cajillasCompactasPanel")}
        </h5>
        <p className="mt-1 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
          {t("previsionCajillasPanel")}
        </p>
      </div>
      {filas.slice((paginaActual - 1) * 10, paginaActual * 10).map((fila) => {
        const indice = documento.cajillas.indexOf(fila);
        const saldo = saldoPrevistoColor(documento, fila.color);
        return (
          <div key={fila.clave} className={`${estilos.filaCajillas} space-y-2`}>
            <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_2.75rem] items-start gap-2">
              <DesplegableCompra<OpcionPreparacion>
                tipo="general"
                ruta={"preparaciones/colores/?almacen=" + (almacen || "")}
                etiqueta={t("colorCajilla")}
                valor={fila.color}
                alElegir={(color) => cambiarColor(fila.clave, color)}
                alError={alError}
                deshabilitado={ocupado || !almacen}
                descripcion={descripcion}
                representarOpcion={(color) => (
                  <ColorCajilla color={color.nombre} punto />
                )}
              />
              <CampoDirectorio
                id={"cajillas_" + indice + "_cantidad"}
                name={"cajillas_" + indice + "_cantidad"}
                etiqueta={t("cantidadCajillas")}
                aria-label={t("cantidadCajillasProductoColor", {
                  color: fila.color.nombre,
                  producto: producto.nombre,
                  sucursal: sucursal.nombre,
                })}
                value={fila.cantidad}
                className="text-end font-medium tabular-nums"
                inputMode="numeric"
                pattern="[0-9]{1,10}"
                maxLength={10}
                disabled={ocupado}
                errores={errores["cajillas_" + indice + "_cantidad"]}
                onChange={(evento) =>
                  alCambiar({
                    ...documento,
                    cajillas: documento.cajillas.map((actual) =>
                      actual === fila
                        ? { ...actual, cantidad: evento.target.value }
                        : actual,
                    ),
                  })
                }
              />
              <button
                type="button"
                disabled={ocupado}
                aria-label={t("quitarCajillas")}
                onClick={() =>
                  alCambiar({
                    ...documento,
                    cajillas: documento.cajillas.filter(
                      (actual) => actual !== fila,
                    ),
                  })
                }
                className="mt-6 flex size-11 items-center justify-center rounded-lg text-gray-500 hover:bg-error-50 hover:text-error-600 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-40 dark:hover:bg-error-500/10 dark:hover:text-error-400"
              >
                <IconoQuitar className="size-4" aria-hidden="true" />
              </button>
            </div>
            <p
              className={
                "text-theme-xs leading-5 tabular-nums " +
                (saldo !== undefined && saldo < 0
                  ? "text-error-600 dark:text-error-400"
                  : "text-gray-600 dark:text-gray-300")
              }
            >
              {fila.color.saldo === undefined
                ? t("saldoCajillasAlDespacharPanel")
                : t("saldoCajillasPrevistoPanel", {
                    disponibles: fila.color.saldo,
                    restantes: saldo!,
                  })}
            </p>
            {["sucursal", "producto", "cajilla"].map((campo) =>
              errores["cajillas_" + indice + "_" + campo]?.length ? (
                <p
                  key={campo}
                  role="alert"
                  tabIndex={-1}
                  data-invalido="true"
                  className="text-theme-xs text-error-600 dark:text-error-400"
                >
                  {errores["cajillas_" + indice + "_" + campo].join(" ")}
                </p>
              ) : null,
            )}
          </div>
        );
      })}
      {filas.length > 10 && (
        <PaginadorCompras
          pagina={paginaActual}
          total={filas.length}
          ocupado={ocupado}
          alCambiar={establecerPagina}
        />
      )}
      {!filas.length || agregando ? (
        <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-3">
            <CampoDirectorio
              id={"nuevas-cajillas-" + identificador}
              etiqueta={t("cantidadCajillas")}
              value={cantidad}
              className="text-end font-medium tabular-nums"
              placeholder="0"
              inputMode="numeric"
              pattern="[0-9]{1,10}"
              maxLength={10}
              disabled={ocupado}
              onChange={(evento) =>
                establecerCantidadManual(evento.target.value)
              }
            />
            <DesplegableCompra<OpcionPreparacion>
              tipo="general"
              ruta={"preparaciones/colores/?almacen=" + (almacen || "")}
              etiqueta={t("colorCajilla")}
              valor={null}
              alElegir={agregar}
              alError={alError}
              deshabilitado={ocupado || !almacen}
              descripcion={descripcion}
              representarOpcion={(color) => (
                <ColorCajilla color={color.nombre} punto />
              )}
            />
          </div>
          <p className="mt-1 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
            {t(
              sugerida > 0
                ? "sugerenciaCajillasPanel"
                : "cantidadCajillasManualPanel",
            )}
          </p>
        </div>
      ) : (
        <button
          type="button"
          disabled={ocupado}
          onClick={() => establecerAgregando(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-40 dark:text-brand-300"
        >
          <IconoAgregar className="size-4" aria-hidden="true" />
          {t("otroColorCajillasPanel")}
        </button>
      )}
      {filas.length > 0 && sugerida > 0 && (
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          {t("cajillasSugeridasRestantesPanel", { cantidad: sugerida })}
        </p>
      )}
      {fallo && (
        <p role="alert" className="text-sm text-error-600 dark:text-error-400">
          {fallo}
        </p>
      )}
    </section>
  );
}
