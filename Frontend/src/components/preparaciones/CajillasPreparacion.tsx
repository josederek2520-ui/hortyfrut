"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 as IconoQuitar } from "lucide-react";
import Button from "@/components/ui/button/Button";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import DesplegableCompra from "@/components/compras/DesplegableCompra";
import PaginadorCompras from "@/components/compras/PaginadorCompras";
import ColorCajilla from "@/components/cajillas/ColorCajilla";
import type { FieldErrors as Errores } from "@/lib/form-validation";
import type { DocumentoEditable, OpcionPreparacion } from "./tipos";

export default function CajillasPreparacion({
  documento,
  contexto,
  almacen,
  ocupado,
  errores,
  alCambiar,
  alError,
  paginaInicial = 1,
}: {
  documento: DocumentoEditable;
  contexto: string;
  almacen?: number;
  ocupado: boolean;
  errores: Errores;
  alCambiar: (documento: DocumentoEditable) => void;
  alError: (error: unknown) => void;
  paginaInicial?: number;
}) {
  const t = useTranslations("preparaciones");
  const [sucursal, establecerSucursal] = useState<OpcionPreparacion | null>(
    null,
  );
  const [color, establecerColor] = useState<OpcionPreparacion | null>(null);
  const [cantidad, establecerCantidad] = useState("1");
  const [pagina, establecerPagina] = useState(paginaInicial);
  const [fallo, establecerFallo] = useState("");
  const agregar = () => {
    if (
      !sucursal ||
      !color ||
      !/^\d+$/.test(cantidad) ||
      Number(cantidad) < 1 ||
      Number(cantidad) > 2147483647
    ) {
      establecerFallo(t("revisarCajillas"));
      return;
    }
    const existente = documento.cajillas.find(
      (fila) => fila.sucursal.id === sucursal.id && fila.color.id === color.id,
    );
    const nuevoTotal = Number(existente?.cantidad || 0) + Number(cantidad);
    if (nuevoTotal > 2147483647) {
      establecerFallo(t("revisarCajillas"));
      return;
    }
    alCambiar({
      ...documento,
      cajillas: existente
        ? documento.cajillas.map((fila) =>
            fila === existente
              ? { ...fila, cantidad: String(nuevoTotal) }
              : fila,
          )
        : [
            ...documento.cajillas,
            { clave: crypto.randomUUID(), sucursal, color, cantidad },
          ],
    });
    establecerFallo("");
    establecerPagina(
      existente
        ? Math.floor(documento.cajillas.indexOf(existente) / 10) + 1
        : Math.floor(documento.cajillas.length / 10) + 1,
    );
  };
  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-brand-50 p-4 text-sm leading-6 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
        {t("cajillasAyuda")}
      </p>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <DesplegableCompra
          tipo="general"
          ruta={`preparaciones/sucursales/?${contexto}`}
          etiqueta={t("sucursal")}
          valor={sucursal}
          alElegir={establecerSucursal}
          alError={alError}
          deshabilitado={ocupado}
        />
        <DesplegableCompra<OpcionPreparacion>
          tipo="general"
          ruta={`preparaciones/colores/?almacen=${almacen || ""}`}
          etiqueta={t("colorCajilla")}
          valor={color}
          alElegir={establecerColor}
          alError={alError}
          deshabilitado={ocupado || !almacen}
          descripcion={(opcion) =>
            t("cajillasDisponibles", { cantidad: opcion.saldo || 0 })
          }
        />
        <CampoDirectorio
          id="cantidad-cajillas-previstas"
          etiqueta={t("cantidadCajillas")}
          type="number"
          inputMode="numeric"
          step={1}
          min={1}
          max={2147483647}
          value={cantidad}
          disabled={ocupado}
          onChange={(evento) => establecerCantidad(evento.target.value)}
        />
        <Button
          variant="outline"
          size="sm"
          className="sm:self-center"
          disabled={ocupado || documento.cajillas.length >= 500}
          onClick={agregar}
        >
          {t("agregarCajillas")}
        </Button>
      </div>
      {fallo && (
        <p role="alert" className="text-sm text-error-500 dark:text-error-400">
          {fallo}
        </p>
      )}
      {!documento.cajillas.length && (
        <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          {t("sinCajillasPrevistas")}
        </p>
      )}
      {documento.cajillas
        .slice((pagina - 1) * 10, pagina * 10)
        .map((fila, posicion) => {
          const indice = (pagina - 1) * 10 + posicion;
          return (
            <article
              key={fila.clave}
              className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <ColorCajilla color={fila.color.nombre} />
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    {fila.sucursal.nombre}
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <CampoDirectorio
                    id={`cajillas_${indice}_cantidad`}
                    name={`cajillas_${indice}_cantidad`}
                    etiqueta={t("cantidadCajillas")}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={2147483647}
                    step={1}
                    value={fila.cantidad}
                    disabled={ocupado}
                    errores={errores[`cajillas_${indice}_cantidad`]}
                    onChange={(evento) =>
                      alCambiar({
                        ...documento,
                        cajillas: documento.cajillas.map((actual, lugar) =>
                          lugar === indice
                            ? { ...actual, cantidad: evento.target.value }
                            : actual,
                        ),
                      })
                    }
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-7"
                    disabled={ocupado}
                    aria-label={t("quitarCajillas")}
                    onClick={() => {
                      alCambiar({
                        ...documento,
                        cajillas: documento.cajillas.filter(
                          (actual) => actual.clave !== fila.clave,
                        ),
                      });
                      establecerPagina(
                        Math.min(
                          pagina,
                          Math.max(
                            1,
                            Math.ceil((documento.cajillas.length - 1) / 10),
                          ),
                        ),
                      );
                    }}
                  >
                    <IconoQuitar className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
              {(errores[`cajillas_${indice}_sucursal`] ||
                errores[`cajillas_${indice}_cajilla`]) && (
                <p className="mt-3 text-sm text-error-500 dark:text-error-400">
                  {[
                    ...(errores[`cajillas_${indice}_sucursal`] || []),
                    ...(errores[`cajillas_${indice}_cajilla`] || []),
                  ].join(" ")}
                </p>
              )}
            </article>
          );
        })}
      <PaginadorCompras
        pagina={pagina}
        total={documento.cajillas.length}
        ocupado={ocupado}
        alCambiar={establecerPagina}
      />
    </div>
  );
}
