"use client";
import { useState, type FormEvent } from "react";
import MarcaHortyfru from "@/components/common/MarcaHortyfru";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { EyeIcon, EyeCloseIcon, ArrowRightIcon } from "@/icons";
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
    <div className="flex w-full min-w-0 items-center justify-center px-6 py-7 sm:px-10 sm:py-8 lg:px-12">
      <div className="w-full max-w-sm">
        <div className="mb-5">
          <MarcaHortyfru pequena />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
          {t("auth.title")}
        </h1>
        <p className="mt-2 mb-6 text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t("auth.subtitle")}
        </p>
        <form
          noValidate
          onSubmit={enviar}
          aria-busy={enviando}
          className="space-y-4"
        >
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
                disabled={enviando}
                className="absolute end-0 top-0 inline-flex size-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-200"
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
        <p className="mt-6 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
          {t("auth.help")}
        </p>
      </div>
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </div>
  );
}
