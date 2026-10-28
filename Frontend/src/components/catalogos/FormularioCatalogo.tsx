"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import {
  ChevronLeftIcon as IconoVolver,
  IconoRegla,
  IconoCategorias,
} from "@/icons";
import { useFormValidation as useValidacionFormulario } from "@/hooks/useFormValidation";
import { focusInvalidField as enfocarCampoInvalido } from "@/lib/form-validation";
import { api, ApiError as ErrorApi } from "@/lib/api";
import {
  CONFIGURACION_CATALOGOS,
  type TipoCatalogo,
  type RegistroCatalogo,
} from "./tipos";

export default function FormularioCatalogo({
  tipo,
  registro,
  alError,
  alRecargar,
}: {
  tipo: TipoCatalogo;
  registro: RegistroCatalogo | null;
  alError: (error: unknown) => void;
  alRecargar: () => void;
}) {
  const t = useTranslations("catalogos");
  const navegador = useRouter();
  const configuracion = CONFIGURACION_CATALOGOS[tipo];
  const [nombre, establecerNombre] = useState(registro?.nombre || "");
  const [abreviatura, establecerAbreviatura] = useState(
    registro?.abreviatura || "",
  );
  const [guardando, establecerGuardando] = useState(false);
  const [fallo, establecerFallo] = useState("");
  const [conflicto, establecerConflicto] = useState(false);
  const {
    errors: errores,
    setErrors: establecerErrores,
    validateForm: validarFormulario,
    changeField: cambiarCampo,
    blurField: salirCampo,
  } = useValidacionFormulario();
  const modificado =
    nombre !== (registro?.nombre || "") ||
    abreviatura !== (registro?.abreviatura || "");
  useEffect(() => {
    if (!modificado) return;
    const avisarSalida = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener("beforeunload", avisarSalida);
    return () => window.removeEventListener("beforeunload", avisarSalida);
  }, [modificado]);
  const cancelar = () => {
    if (!modificado || window.confirm(t("descartar")))
      navegador.push(`/${configuracion.ruta}`);
  };
  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    if (!validarFormulario(formulario)) {
      alError(new ErrorApi(400));
      return;
    }
    establecerGuardando(true);
    establecerFallo("");
    establecerConflicto(false);
    try {
      await api(
        registro
          ? `${configuracion.ruta}/${registro.id}/`
          : `${configuracion.ruta}/`,
        {
          method: registro ? "PATCH" : "POST",
          body: JSON.stringify({
            nombre: nombre.trim(),
            ...(configuracion.conAbreviatura
              ? { abreviatura: abreviatura.trim() }
              : {}),
            ...(registro ? { version: registro.version } : {}),
          }),
        },
      );
      sessionStorage.setItem(
        `catalogos:${tipo}:aviso`,
        registro ? "editado" : "creado",
      );
      navegador.push(`/${configuracion.ruta}`);
      navegador.refresh();
    } catch (error) {
      if (error instanceof ErrorApi) {
        establecerErrores(error.errors);
        enfocarCampoInvalido(formulario);
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
      establecerGuardando(false);
    }
  };
  const Icono = configuracion.conAbreviatura ? IconoRegla : IconoCategorias;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <button
          type="button"
          disabled={guardando}
          onClick={cancelar}
          className="mb-5 inline-flex min-h-10 items-center gap-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-400 dark:hover:text-brand-300"
        >
          <IconoVolver className="size-4 rtl:rotate-180" />
          {t(`tipos.${tipo}.volver`)}
        </button>
        <MigasPagina
          pageTitle={t(`tipos.${tipo}.${registro ? "editar" : "nuevo"}`)}
        />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t(`tipos.${tipo}.formulario`)}
        </p>
      </div>
      <form
        noValidate
        onSubmit={enviar}
        aria-busy={guardando}
        className="superficie-cristal overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-center gap-3 border-b border-gray-100 p-6 dark:border-gray-800">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
            <Icono className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {t("datosGenerales")}
            </h2>
            <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
              {t("camposObligatorios")}
            </p>
          </div>
        </div>
        <div className="space-y-6 p-6 sm:p-8">
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
                  onClick={() => {
                    if (window.confirm(t("confirmarRecarga"))) alRecargar();
                  }}
                >
                  {t("recargar")}
                </Button>
              )}
            </div>
          )}
          <div
            className={`grid gap-6 ${configuracion.conAbreviatura ? "sm:grid-cols-3" : ""}`}
          >
            <div
              className={configuracion.conAbreviatura ? "sm:col-span-2" : ""}
            >
              <Label htmlFor="catalogo-nombre">
                {t("nombre")} <span className="text-error-500">*</span>
              </Label>
              <Input
                id="catalogo-nombre"
                name="nombre"
                required
                maxLength={100}
                value={nombre}
                disabled={guardando}
                placeholder={t(`tipos.${tipo}.nombreEjemplo`)}
                onChange={(evento) => {
                  establecerNombre(evento.target.value);
                  cambiarCampo(evento.currentTarget);
                }}
                onBlur={(evento) => salirCampo(evento.currentTarget)}
                error={!!errores.nombre?.length}
                aria-invalid={!!errores.nombre?.length}
                aria-describedby={
                  errores.nombre?.length ? "catalogo-nombre-error" : undefined
                }
              />
              {!!errores.nombre?.length && (
                <p
                  id="catalogo-nombre-error"
                  className="mt-1.5 text-theme-xs text-error-500"
                >
                  {errores.nombre.join(" ")}
                </p>
              )}
            </div>
            {configuracion.conAbreviatura && (
              <div>
                <Label htmlFor="catalogo-abreviatura">
                  {t("abreviatura")} <span className="text-error-500">*</span>
                </Label>
                <Input
                  id="catalogo-abreviatura"
                  name="abreviatura"
                  required
                  maxLength={10}
                  pattern="\S+"
                  value={abreviatura}
                  disabled={guardando}
                  placeholder="kg"
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(evento) => {
                    establecerAbreviatura(evento.target.value);
                    cambiarCampo(evento.currentTarget);
                  }}
                  onBlur={(evento) => salirCampo(evento.currentTarget)}
                  error={!!errores.abreviatura?.length}
                  aria-invalid={!!errores.abreviatura?.length}
                  aria-describedby="catalogo-abreviatura-ayuda"
                />
                <p
                  id="catalogo-abreviatura-ayuda"
                  className={`mt-1.5 text-theme-xs leading-5 ${errores.abreviatura?.length ? "text-error-500" : "text-gray-500 dark:text-gray-400"}`}
                >
                  {errores.abreviatura?.length
                    ? errores.abreviatura.join(" ")
                    : t("ayudaAbreviatura")}
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
            <span
              className={`rounded-full px-2.5 py-1 text-theme-xs font-medium ${(registro?.activo ?? true) ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400" : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}
            >
              {t((registro?.activo ?? true) ? "activo" : "inactivo")}
            </span>
            <p className="text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
              {t(registro ? "estadoDesdeListado" : "nuevoActivo")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 px-6 py-5 dark:border-gray-800">
          <Button
            size="sm"
            variant="outline"
            disabled={guardando}
            onClick={cancelar}
          >
            {t("cancelar")}
          </Button>
          <Button size="sm" type="submit" disabled={guardando}>
            {t(guardando ? "guardando" : registro ? "guardarCambios" : "crear")}
          </Button>
        </div>
      </form>
    </div>
  );
}
