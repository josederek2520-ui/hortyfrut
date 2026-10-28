"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import {
  ShieldIcon as IconoEscudo,
  InfoIcon as IconoInformacion,
} from "@/icons";
import { useFormValidation as useValidacionFormulario } from "@/hooks/useFormValidation";
import { api, ApiError as ErrorApi } from "@/lib/api";
import { focusInvalidField as enfocarCampoInvalido } from "@/lib/form-validation";
import MatrizPermisos from "./PermissionMatrix";
import type {
  RoleDetail as DatosRol,
  PermissionModule as ModuloPermisos,
} from "./types";

interface Propiedades {
  rol: DatosRol | null;
  modulos: ModuloPermisos[];
  alCancelar: () => void;
  alGuardar: () => void;
  alRecargar: () => void;
  alError: (error: unknown) => void;
}
export default function FormularioRol({
  rol,
  modulos,
  alCancelar,
  alGuardar,
  alRecargar,
  alError,
}: Propiedades) {
  const t = useTranslations("roles");
  const textos = useTranslations("editorRoles");
  const [nombre, establecerNombre] = useState(rol?.name || "");
  const [seleccionados, establecerSeleccionados] = useState<number[]>(
    rol?.permissions.map((permiso) => permiso.id) || [],
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
  const iniciales = rol?.permissions.map((permiso) => permiso.id) || [];
  const modificado =
    nombre !== (rol?.name || "") ||
    seleccionados.length !== iniciales.length ||
    seleccionados.some((id) => !iniciales.includes(id));
  useEffect(() => {
    if (!modificado) return;
    const avisarSalida = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
    };
    window.addEventListener("beforeunload", avisarSalida);
    return () => window.removeEventListener("beforeunload", avisarSalida);
  }, [modificado]);
  const cancelar = () => {
    if (!modificado || window.confirm(textos("descartar"))) alCancelar();
  };
  const adicionales =
    rol?.permissions.filter(
      (permiso) =>
        !modulos.some((modulo) =>
          modulo.permissions.some((elemento) => elemento.id === permiso.id),
        ),
    ) || [];
  const disponibles = adicionales.length
    ? [
        ...modulos,
        {
          key: "other",
          label: t("modules.other"),
          permissions: adicionales.map((permiso) => ({
            ...permiso,
            asignable: false,
          })),
        },
      ]
    : modulos;
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
      await api(rol ? `roles/${rol.id}/` : "roles/", {
        method: rol ? "PATCH" : "POST",
        body: JSON.stringify({
          name: nombre.trim(),
          permissions: seleccionados,
          ...(rol ? { version: rol.version } : {}),
        }),
      });
      alGuardar();
    } catch (error) {
      establecerConflicto(error instanceof ErrorApi && error.status === 409);
      if (error instanceof ErrorApi) {
        establecerErrores(error.errors);
        enfocarCampoInvalido(formulario);
      }
      establecerFallo(
        t(
          error instanceof ErrorApi && error.status === 409
            ? "conflict"
            : error instanceof ErrorApi && error.status === 400
              ? "validationError"
              : "saveError",
        ),
      );
      alError(error);
    } finally {
      establecerGuardando(false);
    }
  };
  const superficie =
    "superficie-cristal rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-800 dark:bg-gray-900";
  return (
    <form
      noValidate
      onSubmit={enviar}
      aria-busy={guardando}
      className="grid items-start gap-6 xl:grid-cols-3"
    >
      <div className="space-y-6 xl:col-span-2">
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
                  if (window.confirm(textos("confirmarRecarga"))) alRecargar();
                }}
              >
                {textos("recargar")}
              </Button>
            )}
          </div>
        )}
        <section className={superficie} aria-labelledby="datos-rol">
          <h2
            id="datos-rol"
            className="mb-1 text-base font-semibold text-gray-900 dark:text-white"
          >
            {textos("datosGenerales")}
          </h2>
          <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
            {t("formHint")}
          </p>
          <Label htmlFor="nombre-rol">
            {t("roleName")} <span className="text-error-500">*</span>
          </Label>
          <Input
            id="nombre-rol"
            name="name"
            value={nombre}
            required
            maxLength={150}
            autoComplete="off"
            placeholder={t("namePlaceholder")}
            disabled={guardando}
            onChange={(evento) => {
              establecerNombre(evento.target.value);
              cambiarCampo(evento.currentTarget);
            }}
            onBlur={(evento) => salirCampo(evento.currentTarget)}
            error={!!errores.name?.length}
            aria-invalid={!!errores.name?.length}
            aria-describedby={
              errores.name?.length ? "nombre-rol-error" : undefined
            }
          />
          {!!errores.name?.length && (
            <p
              id="nombre-rol-error"
              className="mt-1.5 text-theme-xs text-error-500"
            >
              {errores.name.join(" ")}
            </p>
          )}
        </section>
        <section className={superficie} aria-labelledby="permisos-rol">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h2
              id="permisos-rol"
              className="text-base font-semibold text-gray-900 dark:text-white"
            >
              {t("permissions")}
            </h2>
            <span
              role="status"
              className="rounded-full bg-brand-50 px-3 py-1 text-theme-xs font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"
            >
              {t("selected", { count: seleccionados.length })}
            </span>
          </div>
          <p className="mb-5 text-sm leading-6 text-gray-500 dark:text-gray-400">
            {t("permissionHint")}
          </p>
          {!!errores.permissions?.length && (
            <p role="alert" className="mb-3 text-sm text-error-500">
              {errores.permissions.join(" ")}
            </p>
          )}
          <MatrizPermisos
            modules={disponibles}
            selected={seleccionados}
            onChange={establecerSeleccionados}
            disabled={guardando}
          />
        </section>
      </div>
      <aside className="space-y-4 xl:sticky xl:top-24">
        <div className={superficie}>
          <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
            <IconoEscudo className="size-5" />
          </span>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {textos("resumen")}
          </h2>
          <dl className="mt-5 space-y-4 text-sm">
            {[
              [t("permissions"), seleccionados.length],
              [
                textos("modulos"),
                disponibles.filter((modulo) =>
                  modulo.permissions.some((permiso) =>
                    seleccionados.includes(permiso.id),
                  ),
                ).length,
              ],
              ...(rol ? [[t("members"), rol.usuarios_count]] : []),
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">{etiqueta}</dt>
                <dd className="font-semibold text-gray-900 dark:text-white">
                  {valor}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 border-t border-gray-100 pt-4 text-theme-xs leading-5 text-gray-500 dark:border-gray-800 dark:text-gray-400">
            {textos("minimoAcceso")}
          </p>
        </div>
        {rol && rol.usuarios_count > 0 && (
          <p className="flex gap-2 rounded-xl border border-warning-200 bg-warning-50 p-4 text-sm leading-6 text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-400">
            <IconoInformacion className="mt-1 size-4 shrink-0" />
            {t("affectsMembers", { count: rol.usuarios_count })}
          </p>
        )}
        {!seleccionados.length && (
          <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
            {t("emptyPermissionHint")}
          </p>
        )}
        <div className="superficie-cristal flex flex-wrap gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <Button
            size="sm"
            variant="outline"
            disabled={guardando}
            onClick={cancelar}
          >
            {t("cancel")}
          </Button>
          <Button
            size="sm"
            type="submit"
            disabled={guardando}
            className="flex-1"
          >
            {t(guardando ? "saving" : rol ? "saveChanges" : "createRole")}
          </Button>
        </div>
      </aside>
    </form>
  );
}
