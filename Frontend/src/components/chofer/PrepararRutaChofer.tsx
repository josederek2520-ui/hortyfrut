"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp, ArrowDown, Route } from "lucide-react";
import Button from "@/components/ui/button/Button";
import PaginacionChofer from "./PaginacionChofer";
import {
  moverParada,
  paradasRuta,
} from "@/lib/chofer/modulos/recorrido/aplicacion/ordenRuta";
import type {
  RutaViaje,
  AccionRuta,
  DocumentoRuta,
} from "@/lib/chofer/modulos/recorrido/dominio/Ruta";

export default function PrepararRutaChofer({
  ruta,
  orden,
  alOrdenar,
  alOperar,
  bloqueado,
  trabajoActivo,
  puedeOperar,
  alCompararCaminos,
}: {
  ruta: RutaViaje;
  orden: number[];
  alOrdenar: (orden: number[]) => void;
  alOperar: (
    accion: AccionRuta,
    documento: Omit<DocumentoRuta, "clave_operacion">,
  ) => void;
  bloqueado: boolean;
  trabajoActivo: boolean;
  puedeOperar: boolean;
  alCompararCaminos?: () => void;
}) {
  const t = useTranslations("chofer");
  const [pagina, establecerPagina] = useState(1);
  const puntos = paradasRuta(ruta),
    porId = new Map(puntos.map((punto) => [punto.parada, punto]));
  const paginaValida = Math.min(
    pagina,
    Math.max(1, Math.ceil(orden.length / 10)),
  );
  const documento = { version: ruta.versionDespacho, orden_paradas: orden };
  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <Route className="size-5 text-brand-600" />
        {t("prepararRuta")}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t("regresoAlmacen")}
      </p>
      {ruta.faltantes.length > 0 && (
        <p
          role="status"
          className="rounded-xl bg-warning-50 p-3 text-sm text-warning-800 dark:bg-warning-950 dark:text-warning-200"
        >
          {t("faltantes", { nombres: ruta.faltantes.join(", ") })}
        </p>
      )}
      <ol start={(paginaValida - 1) * 10 + 1} className="space-y-2">
        {orden
          .slice((paginaValida - 1) * 10, paginaValida * 10)
          .map((id, indicePagina) => {
            const punto = porId.get(id),
              indice = (paginaValida - 1) * 10 + indicePagina;
            return (
              <li
                key={id}
                className="flex items-center gap-3 rounded-2xl border border-gray-200 p-3 dark:border-gray-700"
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ background: punto?.color ?? "#16803C" }}
                >
                  {indice + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{punto?.nombre}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {punto?.cliente}
                  </p>
                </div>
                {ruta.puedeOrdenar && puedeOperar && (
                  <div className="flex">
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 min-w-11"
                      aria-label={t("subir", { nombre: punto?.nombre ?? "" })}
                      disabled={bloqueado || trabajoActivo || indice === 0}
                      onClick={() => alOrdenar(moverParada(orden, indice, -1))}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 min-w-11"
                      aria-label={t("bajar", { nombre: punto?.nombre ?? "" })}
                      disabled={
                        bloqueado ||
                        trabajoActivo ||
                        indice === orden.length - 1
                      }
                      onClick={() => alOrdenar(moverParada(orden, indice, 1))}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
      </ol>
      <PaginacionChofer
        pagina={paginaValida}
        total={orden.length}
        alCambiar={establecerPagina}
      />
      {ruta.plan && (
        <div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-800 dark:bg-brand-950 dark:text-brand-200">
          <p className="font-semibold">
            {t("metricas", {
              kilometros: (ruta.plan.distanciaM / 1000).toFixed(1),
              minutos: Math.ceil(ruta.plan.duracionS / 60),
            })}
          </p>
          <p className="mt-1">{t("sinTrafico")}</p>
          {ruta.plan.optimizacion && (
            <p className="mt-1">
              {t("mejora", {
                minutos: Math.round(ruta.plan.optimizacion.mejoraS / 60),
                porcentaje: ruta.plan.optimizacion.mejoraPorcentaje.toFixed(1),
              })}
            </p>
          )}
        </div>
      )}
      {ruta.optimizacion?.error && (
        <p role="alert" className="text-sm text-error-600 dark:text-error-400">
          {ruta.optimizacion.error}
        </p>
      )}
      {alCompararCaminos &&
        puedeOperar &&
        ruta.preparando &&
        ruta.puedeCalcular &&
        ruta.plan?.tramos.every((tramo) => tramo.geometria) && (
          <Button
            variant="outline"
            disabled={bloqueado || trabajoActivo}
            onClick={alCompararCaminos}
            startIcon={<Route className="size-4" />}
          >
            {t("compararCaminos")}
          </Button>
        )}
      {puedeOperar && ruta.preparando && (
        <div className="flex flex-wrap gap-3">
          {trabajoActivo ? (
            <>
              <p role="status" className="w-full text-sm">
                {t("calculando")}
              </p>
              <Button
                variant="outline"
                disabled={bloqueado}
                onClick={() =>
                  alOperar("cancelar-optimizacion", {
                    version: ruta.versionDespacho,
                    calculo: ruta.optimizacion!.id,
                  })
                }
              >
                {t("cancelarCalculo")}
              </Button>
            </>
          ) : (
            <>
              {ruta.puedeOptimizar && (
                <Button
                  disabled={bloqueado}
                  onClick={() => alOperar("optimizar-ruta", documento)}
                >
                  {t("optimizar")}
                </Button>
              )}
              {ruta.puedeCalcular && (
                <Button
                  variant="outline"
                  disabled={bloqueado}
                  onClick={() => alOperar("calcular-ruta", documento)}
                >
                  {t("calcularOrden")}
                </Button>
              )}
              {ruta.puedeAprobar && ruta.plan && (
                <Button
                  disabled={bloqueado}
                  onClick={() =>
                    alOperar("aprobar-ruta", {
                      version: ruta.versionDespacho,
                      plan: ruta.plan!.id,
                    })
                  }
                >
                  {t("usarRuta")}
                </Button>
              )}
            </>
          )}
        </div>
      )}
      {ruta.estado === "lista" && (
        <p className="text-sm font-medium text-brand-700 dark:text-brand-300">
          {t("rutaConfirmada")}
        </p>
      )}
      {ruta.preparando && (
        <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
          {t("revisarAccesos")}
        </p>
      )}
    </section>
  );
}
