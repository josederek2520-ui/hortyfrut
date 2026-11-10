"use client";
import { useLocale, useTranslations } from "next-intl";
import {
  CalendarDays,
  ClipboardList,
  Store,
  ArrowLeft,
  History,
} from "lucide-react";
import CampoFecha from "@/components/form/CampoFecha";
import Button from "@/components/ui/button/Button";
import EstadoPrecio from "./EstadoPrecio";
import { campoPrecio, panelPrecio } from "./tipos";
import type useGestionPrecio from "./useGestionPrecio";

export default function CabeceraPrecio({
  gestion,
  editable,
  alVolver,
  alCliente,
  alEntregas,
  alHistorial,
}: {
  gestion: ReturnType<typeof useGestionPrecio>;
  editable: boolean;
  alVolver: () => void;
  alCliente: () => void;
  alEntregas: () => void;
  alHistorial: () => void;
}) {
  const t = useTranslations("precios"),
    idioma = useLocale();
  const { documento, formulario, cambiar, ocupado, incierto, errores } =
    gestion;
  const bloqueado = ocupado || incierto,
    puedeAlcance = editable && !documento?.anterior;
  const fecha = (valor: string) =>
    valor ? new Date(valor + "T12:00:00").toLocaleDateString(idioma) : "—";
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={ocupado}
            aria-label={t("volver")}
            className="control-suave-hortyfru inline-flex size-11 items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-brand-500"
            onClick={alVolver}
          >
            <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden="true" />
          </button>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {t(documento ? "detalle" : "nuevaPropuesta")}
          </h1>
          {documento && (
            <>
              <span className="text-sm text-gray-500">{documento.codigo}</span>
              <EstadoPrecio estado={documento.estado} />
            </>
          )}
        </div>
        {documento && (
          <Button
            variant="outline"
            startIcon={<History className="size-4" />}
            onClick={alHistorial}
            disabled={ocupado || gestion.modificado || incierto}
          >
            {t("historial")}
          </Button>
        )}
      </div>
      <p className="max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">
        {t("flujoAyuda")}
      </p>
      {documento?.anterior && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
          <p className="font-medium">
            {t("version", { numero: documento.numero_version })} ·{" "}
            {t("correccionPrecios")}
          </p>
          <p className="mt-1">{documento.motivo_version}</p>
        </div>
      )}
      {documento?.estado === "aceptado" && !documento.es_actual && (
        <p className="rounded-xl bg-gray-100 p-4 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          {t("versionAnteriorAyuda")}
        </p>
      )}
      <div className={panelPrecio + " space-y-5 p-5"}>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="mb-1.5 text-sm font-medium">{t("supermercado")}</p>
            {!documento && editable ? (
              <button
                type="button"
                data-campo-precio="cliente"
                className={campoPrecio + " flex items-center gap-2 text-start"}
                disabled={bloqueado}
                onClick={alCliente}
              >
                <Store
                  className="size-4 shrink-0 text-gray-500"
                  aria-hidden="true"
                />
                <span>
                  {formulario.cliente?.nombre || t("elegirSupermercado")}
                </span>
              </button>
            ) : (
              <p className="text-base font-semibold">
                {formulario.cliente?.nombre || "—"}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {t("alcanceSupermercado")}
            </p>
          </div>
          <label className="block text-sm font-medium">
            {t("referenciaPropuesta")}
            {editable ? (
              <input
                data-campo-precio="referencia_propuesta"
                type="text"
                maxLength={150}
                className={campoPrecio + " mt-1.5"}
                value={formulario.referencia_propuesta}
                disabled={bloqueado}
                placeholder={t("referenciaEjemplo")}
                onChange={(e) =>
                  cambiar((f) => ({
                    ...f,
                    referencia_propuesta: e.target.value,
                  }))
                }
              />
            ) : (
              <span className="mt-2 block text-sm font-normal">
                {formulario.referencia_propuesta || "—"}
              </span>
            )}
          </label>
        </div>
        <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
          <h2 className="text-sm font-semibold">{t("aplicaA")}</h2>
          {puedeAlcance ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {(["periodo", "entregas"] as const).map((alcance) => (
                <button
                  type="button"
                  key={alcance}
                  aria-pressed={formulario.alcance === alcance}
                  disabled={bloqueado}
                  className={
                    "inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand-500 " +
                    (formulario.alcance === alcance
                      ? "border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-700 dark:bg-brand-500/15 dark:text-brand-200"
                      : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300")
                  }
                  onClick={() => cambiar((f) => ({ ...f, alcance }))}
                >
                  {alcance === "periodo" ? (
                    <CalendarDays className="size-4" aria-hidden="true" />
                  ) : (
                    <ClipboardList className="size-4" aria-hidden="true" />
                  )}
                  {t("alcances." + alcance)}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm">
              {t("alcances." + formulario.alcance)}
            </p>
          )}
          {formulario.alcance === "periodo" ? (
            <>
              <div className="mt-4 grid gap-4 sm:max-w-xl sm:grid-cols-2">
                {(["desde", "hasta"] as const).map((campo) => (
                  <div key={campo}>
                    <label
                      className="mb-1.5 block text-sm font-medium"
                      htmlFor={puedeAlcance ? "precio-" + campo : undefined}
                    >
                      {t(campo)}
                    </label>
                    {puedeAlcance ? (
                      <CampoFecha
                        id={"precio-" + campo}
                        data-campo-precio={campo}
                        value={formulario[campo]}
                        min={
                          campo === "hasta"
                            ? formulario.desde || undefined
                            : undefined
                        }
                        disabled={bloqueado}
                        error={!!errores[campo]}
                        alCambiar={(valor) =>
                          cambiar((f) => ({ ...f, [campo]: valor }))
                        }
                      />
                    ) : (
                      <p className="text-sm">{fecha(formulario[campo])}</p>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                {t("fechaAyuda")}
              </p>
            </>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={alEntregas}
                disabled={bloqueado || !formulario.cliente}
              >
                <span data-campo-precio="entregas">
                  {t(puedeAlcance ? "elegirEntregas" : "verEntregas")}
                </span>
              </Button>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("entregasSeleccionadas", {
                  total: formulario.entregas.length,
                })}
              </p>
            </div>
          )}
        </div>
        {documento?.propuesto_en && (
          <p className="border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
            {t("propuestaRegistradaPor", {
              nombre: documento.propuesto_por_nombre,
              fecha: new Date(documento.propuesto_en).toLocaleString(idioma),
            })}
          </p>
        )}
        {documento?.revisado_en && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t(
              documento.estado === "aceptado" ? "aceptadoPor" : "rechazadoPor",
              {
                nombre: documento.revisado_por_nombre,
                fecha: new Date(documento.revisado_en).toLocaleString(idioma),
              },
            )}
          </p>
        )}
        {documento?.motivo_rechazo && (
          <p className="rounded-xl bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/10 dark:text-error-300">
            {t("motivoRechazo")}: {documento.motivo_rechazo}
          </p>
        )}
      </div>
    </>
  );
}
