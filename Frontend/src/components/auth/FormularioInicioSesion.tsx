"use client";
import { useState, type FormEvent } from "react";
import MarcaHortyfru from "@/components/common/MarcaHortyfru";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { EyeIcon, EyeCloseIcon, LockIcon, ArrowRightIcon } from "@/icons";
import { api, ApiError as ErrorApi } from "@/lib/api";
import { rutaInicial } from "@/lib/navegacion-sesion";
import { useToast as useNotificaciones } from "@/hooks/useToast";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import { useFormValidation as useValidacionFormulario } from "@/hooks/useFormValidation";
import type { Session as Sesion } from "@/components/users/types";
export default function FormularioInicioSesion() {
  const t = useTranslations("users");
  const navegador = useRouter();
  const [correo, establecerCorreo] = useState("");
  const [contrasena, establecerContrasena] = useState("");
  const [recordar, establecerRecordar] = useState(false);
  const [visible, establecerVisible] = useState(false);
  const [enviando, establecerEnviando] = useState(false);
  const {
    toasts: avisos,
    notify: notificar,
    dismiss: cerrarAviso,
  } = useNotificaciones();
  const {
    errors: errores,
    validateForm: validarFormulario,
    changeField: cambiarCampo,
    blurField: salirCampo,
  } = useValidacionFormulario();
  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!validarFormulario(evento.currentTarget)) {
      notificar(t("validationError"), "error");
      return;
    }
    establecerEnviando(true);
    try {
      const sesion = await api<Sesion>("auth/login/", {
        method: "POST",
        body: JSON.stringify({
          email: correo.trim(),
          password: contrasena,
          remember: recordar,
        }),
      });
      navegador.replace(rutaInicial(sesion));
      navegador.refresh();
    } catch (error) {
      notificar(
        error instanceof ErrorApi && error.status === 429
          ? t("auth.rateLimited")
          : error instanceof ErrorApi && error.status === 400
            ? t("auth.invalidCredentials")
            : t("auth.connectionError"),
        "error",
      );
    } finally {
      establecerEnviando(false);
    }
  };
  return (
    <div className="flex w-full flex-1 items-center justify-center px-6 py-12 lg:w-1/2 lg:px-12">
      <div className="superficie-cristal superficie-acceso w-full max-w-md p-6 sm:p-8">
        <div className="mb-7">
          <MarcaHortyfru />
        </div>
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1 text-theme-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
          <LockIcon className="size-3.5" />
          {t("auth.secureAccess")}
        </span>
        <h1 className="text-title-sm font-semibold tracking-tight text-gray-900 dark:text-white">
          {t("auth.title")}
        </h1>
        <p className="mt-3 mb-8 text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t("auth.subtitle")}
        </p>
        <form noValidate onSubmit={enviar} className="space-y-5">
          <div>
            <Label htmlFor="inicio-correo">{t("fields.email")}</Label>
            <Input
              id="inicio-correo"
              name="email"
              type="email"
              value={correo}
              onChange={(e) => {
                establecerCorreo(e.target.value);
                cambiarCampo(e.currentTarget);
              }}
              onBlur={(e) => salirCampo(e.currentTarget)}
              error={!!errores.email?.length}
              aria-invalid={!!errores.email?.length}
              aria-describedby={
                errores.email?.length ? "inicio-correo-error" : undefined
              }
              autoComplete="username"
              required
              maxLength={254}
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              disabled={enviando}
              placeholder={t("auth.correoPlaceholder")}
            />
            {!!errores.email?.length && (
              <p
                id="inicio-correo-error"
                className="mt-1.5 text-theme-xs text-error-500"
              >
                {errores.email.join(" ")}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="login-password">{t("fields.password")}</Label>
            <div className="relative">
              <Input
                id="login-password"
                name="password"
                type={visible ? "text" : "password"}
                value={contrasena}
                onChange={(e) => {
                  establecerContrasena(e.target.value);
                  cambiarCampo(e.currentTarget);
                }}
                onBlur={(e) => salirCampo(e.currentTarget)}
                error={!!errores.password?.length}
                aria-invalid={!!errores.password?.length}
                aria-describedby={
                  errores.password?.length ? "login-password-error" : undefined
                }
                autoComplete="current-password"
                required
                maxLength={128}
                disabled={enviando}
                className="pe-12"
                placeholder={t("auth.passwordPlaceholder")}
              />
              <button
                type="button"
                aria-label={t(visible ? "hidePassword" : "showPassword")}
                onClick={() => establecerVisible(!visible)}
                className="absolute end-1.5 top-1.5 inline-flex size-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                {visible ? (
                  <EyeCloseIcon aria-hidden="true" className="size-4.5" />
                ) : (
                  <EyeIcon aria-hidden="true" className="size-4.5" />
                )}
              </button>
            </div>
            {!!errores.password?.length && (
              <p
                id="login-password-error"
                className="mt-1.5 text-theme-xs text-error-500"
              >
                {errores.password.join(" ")}
              </p>
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={recordar}
              onChange={(e) => establecerRecordar(e.target.checked)}
              className="size-4 accent-brand-500"
              disabled={enviando}
            />
            {t("auth.remember")}
          </label>
          <Button
            type="submit"
            disabled={enviando}
            className="w-full"
            endIcon={
              !enviando && <ArrowRightIcon className="size-4 rtl:rotate-180" />
            }
          >
            {t(enviando ? "auth.signingIn" : "auth.signIn")}
          </Button>
        </form>
        <p className="mt-8 text-center text-theme-xs leading-5 text-gray-400 dark:text-gray-500">
          {t("auth.help")}
        </p>
      </div>
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </div>
  );
}
