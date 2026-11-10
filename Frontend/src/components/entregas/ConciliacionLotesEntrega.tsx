"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/lib/api";
import Button from "@/components/ui/button/Button";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import {
  mostrarMedicion,
  medirEntrega,
  resumenConciliacionEntrega,
  lineaVacia,
} from "./calculosEntrega";
import ErrorCampoEntrega from "./ErrorCampoEntrega";
import {
  entradaEntrega,
  type AporteEditable,
  type AporteOrigen,
  type PaginaEntrega,
  type ProductoEntrega,
  type LineaEditable,
} from "./tipos";

export default function ConciliacionLotesEntrega({
  ruta,
  producto,
  aportes,
  bloqueado,
  alCambiar,
  error,
  linea = lineaVacia(),
  soloLectura = false,
}: {
  ruta: string;
  producto: ProductoEntrega;
  aportes: Record<string, AporteEditable>;
  bloqueado: boolean;
  alCambiar: (aportes: Record<string, AporteEditable>) => void;
  error?: string[];
  linea?: LineaEditable;
  soloLectura?: boolean;
}) {
  const t = useTranslations("entregas"),
    idioma = useLocale();
  const [abierto, establecerAbierto] = useState(false),
    [pagina, establecerPagina] = useState(1),
    [revision, establecerRevision] = useState(0);
  const [consulta, establecerConsulta] = useState<{
    clave: string;
    datos?: PaginaEntrega<AporteOrigen>;
    error?: boolean;
  } | null>(null);
  const clave =
    ruta + "aportes/?producto=" + producto.producto + "&pagina=" + pagina;
  const resumen = resumenConciliacionEntrega(producto, linea, aportes);
  const unico = producto.aportes.length === 1;
  useEffect(() => {
    if (!error) return;
    const indice = producto.aportes.findIndex((aporte) => {
      const anotado = aportes[aporte.carga + "-" + aporte.lote];
      const recibido = medirEntrega(anotado?.peso_recibido_kg ?? ""),
        rechazado = medirEntrega(anotado?.peso_rechazado_kg ?? "");
      return recibido === null || rechazado === null || rechazado > recibido;
    });
    const temporizador = setTimeout(
      () => establecerPagina(Math.floor(Math.max(0, indice) / 10) + 1),
      0,
    );
    return () => clearTimeout(temporizador);
  }, [error, producto.aportes, aportes]);
  useEffect(() => {
    if (!abierto && !error) return;
    const controlador = new AbortController();
    void api<PaginaEntrega<AporteOrigen>>(clave, { signal: controlador.signal })
      .then((datos) => {
        if (!controlador.signal.aborted) establecerConsulta({ clave, datos });
      })
      .catch(() => {
        if (!controlador.signal.aborted)
          establecerConsulta({ clave, error: true });
      });
    return () => controlador.abort();
  }, [clave, abierto, error, revision]);
  const datos = consulta?.clave === clave ? consulta : null;
  const contenedor = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!error || !datos?.datos || soloLectura) return;
    const temporizador = setTimeout(() => {
      const campo = contenedor.current?.querySelector<HTMLInputElement>(
        'input[aria-invalid="true"]',
      );
      campo?.scrollIntoView({ block: "center", behavior: "auto" });
      campo?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(temporizador);
  }, [error, datos, soloLectura]);
  const cambiar = (
    aporte: AporteOrigen,
    campo: "peso_recibido_kg" | "peso_rechazado_kg",
    valor: string,
  ) => {
    const llave = aporte.carga + "-" + aporte.lote;
    const anterior = aportes[llave] ?? {
      carga: aporte.carga,
      lote: aporte.lote,
      peso_recibido_kg: "",
      peso_rechazado_kg: "",
    };
    alCambiar({ ...aportes, [llave]: { ...anterior, [campo]: valor } });
  };
  const mostrarPendiente = (valor: string | null) =>
    valor === null
      ? t("pendienteMedicion")
      : valor === "0"
        ? t("distribucionExacta")
        : t(valor.startsWith("-") ? "excesoDistribucion" : "faltaDistribuir", {
            kilos: mostrarMedicion(valor.replace(/^-/, ""), idioma),
          });
  return (
    <details
      ref={contenedor}
      open={abierto || !!error}
      onToggle={(evento) => establecerAbierto(evento.currentTarget.open)}
      className="border-t border-gray-100 px-5 py-3 dark:border-gray-800"
    >
      <summary
        data-campo-entrega={"lotes_" + producto.producto}
        className="min-h-11 cursor-pointer content-center text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        {producto.nombre} · {t("lotes")}
        {!unico && (
          <span
            className={
              "ms-3 inline-block text-xs " +
              (resumen.coincide
                ? "text-brand-700 dark:text-brand-300"
                : "text-gray-500 dark:text-gray-400")
            }
          >
            {t(resumen.coincide ? "lotesConciliados" : "aportesCompletos", {
              completos: resumen.completos,
              total: resumen.total,
            })}
          </span>
        )}
      </summary>
      <p className="my-3 text-xs text-gray-500 dark:text-gray-400">
        {t(unico ? "loteUnico" : "ayudaLotes")}
      </p>
      {!unico && (
        <div className="mb-4 grid gap-2 rounded-xl bg-gray-50 p-3 text-xs sm:grid-cols-2 dark:bg-gray-800">
          <p>
            <span className="font-semibold">
              {t("recibido")}: {mostrarMedicion(resumen.recibido, idioma)} kg
            </span>
            <span className="mt-1 block">
              {mostrarPendiente(resumen.pendienteRecibido)}
            </span>
          </p>
          <p>
            <span className="font-semibold">
              {t("rechazado")}: {mostrarMedicion(resumen.rechazado, idioma)} kg
            </span>
            <span className="mt-1 block">
              {mostrarPendiente(resumen.pendienteRechazado)}
            </span>
          </p>
          {resumen.invalido && (
            <p className="text-error-700 sm:col-span-2 dark:text-error-300">
              {t("revisarLotes")}
            </p>
          )}
        </div>
      )}
      <ErrorCampoEntrega
        mensajes={error}
        id={"error-lotes-" + producto.producto}
      />
      {!datos ? (
        <p role="status" className="py-4">
          {t("cargando")}
        </p>
      ) : datos.error ? (
        <div role="alert" className="space-y-3 py-4">
          <p>{t("errorConsulta")}</p>
          <Button
            variant="outline"
            onClick={() => {
              establecerConsulta(null);
              establecerRevision((valor) => valor + 1);
            }}
          >
            {t("reintentarConsulta")}
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {datos.datos?.results.map((aporte) => {
              const anotado = aportes[aporte.carga + "-" + aporte.lote];
              const valores = unico
                ? {
                    peso_recibido_kg: linea.peso_recibido_kg,
                    peso_rechazado_kg: linea.peso_rechazado_kg,
                  }
                : anotado;
              const recibido = medirEntrega(valores?.peso_recibido_kg ?? ""),
                rechazado = medirEntrega(valores?.peso_rechazado_kg ?? "");
              return (
                <div
                  key={aporte.carga + "-" + aporte.lote}
                  className="grid items-start gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_10rem_10rem] dark:border-gray-700"
                >
                  <div className="sm:col-span-2 lg:col-span-1">
                    <p className="text-sm font-medium">{aporte.codigo_lote}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {aporte.preparacion} · {t("enviado")}:{" "}
                      {mostrarMedicion(aporte.peso_kg, idioma)} kg
                    </p>
                  </div>
                  {(["peso_recibido_kg", "peso_rechazado_kg"] as const).map(
                    (campo, indice) => {
                      const valor = valores?.[campo] ?? "";
                      const invalido =
                        !!error &&
                        (medirEntrega(valor) === null ||
                          (!!indice &&
                            recibido !== null &&
                            rechazado !== null &&
                            rechazado > recibido));
                      return (
                        <label key={campo} className="text-xs">
                          {t(indice ? "pesoRechazado" : "pesoRecibido")}
                          {soloLectura || unico ? (
                            <span className="mt-2 block text-sm font-medium tabular-nums">
                              {mostrarMedicion(
                                medirEntrega(valor) === null ? null : valor,
                                idioma,
                              )}{" "}
                              kg
                            </span>
                          ) : (
                            <>
                              <input
                                id={
                                  "aporte-" +
                                  aporte.carga +
                                  "-" +
                                  aporte.lote +
                                  "-" +
                                  campo
                                }
                                aria-label={
                                  producto.nombre +
                                  " · " +
                                  aporte.codigo_lote +
                                  " · " +
                                  t(indice ? "pesoRechazado" : "pesoRecibido")
                                }
                                aria-invalid={invalido}
                                aria-describedby={
                                  invalido
                                    ? "error-aporte-" +
                                      aporte.carga +
                                      "-" +
                                      aporte.lote +
                                      "-" +
                                      campo
                                    : undefined
                                }
                                className={
                                  entradaEntrega +
                                  " mt-1 text-end tabular-nums " +
                                  (invalido ? "border-error-500" : "")
                                }
                                inputMode="decimal"
                                autoComplete="off"
                                value={valor}
                                disabled={bloqueado}
                                onChange={(evento) =>
                                  cambiar(aporte, campo, evento.target.value)
                                }
                              />
                              {invalido && (
                                <span
                                  id={
                                    "error-aporte-" +
                                    aporte.carga +
                                    "-" +
                                    aporte.lote +
                                    "-" +
                                    campo
                                  }
                                  className="mt-1 block text-error-700 dark:text-error-300"
                                >
                                  {t("revisarValorAporte")}
                                </span>
                              )}
                            </>
                          )}
                        </label>
                      );
                    },
                  )}
                </div>
              );
            })}
          </div>
          {!!datos.datos && datos.datos.count > 10 && (
            <PaginadorPedidos
              pagina={pagina}
              total={datos.datos.count}
              alCambiar={establecerPagina}
              ocupado={bloqueado && !soloLectura}
            />
          )}
        </>
      )}
    </details>
  );
}
