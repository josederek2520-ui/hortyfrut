"use client";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Input from "@/components/form/input/InputField";
import CampoFecha from "@/components/form/CampoFecha";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import {
  UserCircleIcon,
  PencilIcon,
  LockIcon,
  EyeIcon,
  EyeCloseIcon,
} from "@/icons";
import { api, ApiError } from "@/lib/api";
import { useFormValidation } from "@/hooks/useFormValidation";
import { focusInvalidField, type FormControl } from "@/lib/form-validation";
import type { Role, Session, UserDetail, UserPayload } from "./types";
interface Props {
  user: UserDetail | null;
  roles: Role[];
  session: Session;
  profile?: boolean;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}
export default function UserFormDialog({
  user,
  roles,
  session,
  profile = false,
  onClose,
  onSaved,
  onError,
}: Props) {
  const t = useTranslations("users");
  const [values, setValues] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
    cedula_identidad: user?.cedula_identidad || "",
    celular: user?.celular || "",
    fecha_nacimiento: user?.fecha_nacimiento || "",
    direccion: user?.direccion || "",
    password: "",
  });
  const [selected, setSelected] = useState<number[]>(
    user?.roles.map((r) => r.id) || [],
  );
  const { errors, setErrors, validateForm, changeField, blurField } =
    useFormValidation();
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const canAssign =
    session.capabilities.assign_roles && user?.id !== session.user.id;
  const update = (
    key: keyof typeof values,
    value: string,
    control: FormControl,
  ) => {
    setValues((old) => ({ ...old, [key]: value }));
    changeField(control);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!validateForm(form)) {
      onError(t("validationError"));
      return;
    }
    setBusy(true);
    setErrors({});
    const payload: Partial<UserPayload> = {
      ...values,
      fecha_nacimiento: values.fecha_nacimiento || null,
    };
    if (user) delete payload.password;
    const changedRoles =
      !user ||
      [...selected].sort().join() !==
        user.roles
          .map((r) => r.id)
          .sort()
          .join();
    if (canAssign && changedRoles && !profile) payload.roles = selected;
    try {
      await api(
        profile ? "auth/profile/" : user ? `usuarios/${user.id}/` : "usuarios/",
        { method: user ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
      onSaved();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrors(caught.errors);
        onError(
          caught.errors.detail?.join(" ") ||
            caught.errors.non_field_errors?.join(" ") ||
            (caught.status === 400
              ? t("validationError")
              : caught.message || t("saveError")),
        );
      } else onError(t("saveError"));
      focusInvalidField(form);
    } finally {
      setBusy(false);
    }
  };
  const field = (
    key: keyof typeof values,
    options: {
      type?: string;
      required?: boolean;
      max?: number;
      hint?: string;
    } = {},
  ) => (
    <div>
      <Label htmlFor={`user-${key}`}>
        {t(`fields.${key}`)}
        {options.required && <span className="ms-1 text-error-500">*</span>}
      </Label>
      {key === "fecha_nacimiento" ? (
        <CampoFecha
          id={`user-${key}`}
          name={key}
          value={values[key]}
          max={new Date().toLocaleDateString("sv-SE")}
          disabled={busy}
          autoComplete="bday"
          alCambiar={(fecha, control) => update(key, fecha, control)}
          alSalir={blurField}
          error={!!errors[key]?.length}
          aria-describedby={errors[key]?.length ? `error-${key}` : undefined}
        />
      ) : (
        <Input
          id={`user-${key}`}
          name={key}
          type={options.type || "text"}
          value={values[key]}
          required={options.required}
          maxLength={options.max}
          disabled={busy}
          onChange={(e) => update(key, e.target.value, e.currentTarget)}
          onBlur={(e) => blurField(e.currentTarget)}
          error={!!errors[key]?.length}
          aria-invalid={!!errors[key]?.length}
          aria-describedby={errors[key]?.length ? `error-${key}` : undefined}
          inputMode={
            key === "cedula_identidad" || key === "celular"
              ? "numeric"
              : undefined
          }
          pattern={
            key === "cedula_identidad" || key === "celular"
              ? "[0-9]*"
              : undefined
          }
          autoComplete={
            key === "email"
              ? "email"
              : key === "first_name"
                ? "given-name"
                : key === "last_name"
                  ? "family-name"
                  : key === "celular"
                    ? "tel"
                    : undefined
          }
        />
      )}
      {errors[key]?.length ? (
        <p id={`error-${key}`} className="mt-1.5 text-theme-xs text-error-500">
          {errors[key].join(" ")}
        </p>
      ) : (
        options.hint && (
          <p className="mt-1.5 text-theme-xs text-gray-400 dark:text-gray-500">
            {options.hint}
          </p>
        )
      )}
    </div>
  );
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!busy) onClose();
      }}
      className="max-w-2xl"
      labelledBy="user-form-title"
      closeLabel={t("close")}
    >
      <form
        noValidate
        onSubmit={submit}
        className="flex max-h-[90dvh] flex-col"
      >
        <div className="shrink-0 border-b border-gray-100 px-6 py-5 pe-16 sm:px-8 dark:border-gray-800">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-600 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
              {user ? (
                <PencilIcon aria-hidden="true" className="size-5" />
              ) : (
                <UserCircleIcon aria-hidden="true" className="size-5" />
              )}
            </span>
            <div className="min-w-0">
              <h2
                id="user-form-title"
                className="text-xl font-semibold text-gray-900 dark:text-white"
              >
                {t(user ? "editUser" : "newUser")}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t(user ? "editDescription" : "createDescription")}
              </p>
            </div>
          </div>
        </div>
        <div className="custom-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6 sm:px-8">
          <div>
            <h3 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-200">
              {t("personalData")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("first_name", { required: true, max: 150 })}
              {field("last_name", { required: true, max: 150 })}
              {field("cedula_identidad", {
                required: true,
                max: 30,
                hint: t("identityHint"),
              })}
              {field("fecha_nacimiento")}
              {field("email", {
                type: "email",
                required: true,
                max: 254,
                hint: t("correoAccesoAyuda"),
              })}
              {field("celular", { max: 25, hint: t("digitsHint") })}
              <div className="sm:col-span-2">
                <Label htmlFor="user-direccion">{t("fields.direccion")}</Label>
                <textarea
                  id="user-direccion"
                  name="direccion"
                  value={values.direccion}
                  maxLength={500}
                  rows={2}
                  disabled={busy}
                  onChange={(e) =>
                    update("direccion", e.target.value, e.currentTarget)
                  }
                  onBlur={(e) => blurField(e.currentTarget)}
                  autoComplete="street-address"
                  aria-invalid={!!errors.direccion?.length}
                  aria-describedby={
                    errors.direccion?.length ? "error-direccion" : undefined
                  }
                  className="w-full resize-y rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 transition-colors outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 aria-invalid:border-error-500 aria-invalid:bg-error-50 aria-invalid:ring-1 aria-invalid:ring-error-500/10 aria-invalid:focus:border-error-600 aria-invalid:focus:ring-error-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:aria-invalid:border-error-400 dark:aria-invalid:bg-error-500/10"
                />
                {!!errors.direccion?.length && (
                  <p
                    id="error-direccion"
                    className="mt-1.5 text-theme-xs text-error-500"
                  >
                    {errors.direccion.join(" ")}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div
            className={
              user
                ? "hidden"
                : "border-t border-gray-100 pt-5 dark:border-gray-800"
            }
          >
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
              <LockIcon className="size-4 text-gray-400" />
              {t("accountAccess")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {!user && (
                <div className="sm:col-span-2">
                  <Label htmlFor="user-password">
                    {t("fields.password")}{" "}
                    <span className="text-error-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="user-password"
                      name="password"
                      type={visible ? "text" : "password"}
                      value={values.password}
                      onChange={(e) =>
                        update("password", e.target.value, e.currentTarget)
                      }
                      onBlur={(e) => blurField(e.currentTarget)}
                      required
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      disabled={busy}
                      error={!!errors.password?.length}
                      aria-invalid={!!errors.password?.length}
                      aria-describedby="user-password-hint"
                      className="pe-12"
                    />
                    <button
                      type="button"
                      onClick={() => setVisible(!visible)}
                      aria-label={t(visible ? "hidePassword" : "showPassword")}
                      className="absolute end-1.5 top-1.5 inline-flex size-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    >
                      {visible ? (
                        <EyeCloseIcon aria-hidden="true" className="size-4.5" />
                      ) : (
                        <EyeIcon aria-hidden="true" className="size-4.5" />
                      )}
                    </button>
                  </div>
                  <p
                    id="user-password-hint"
                    className={`mt-1.5 text-theme-xs ${errors.password?.length ? "text-error-500" : "text-gray-400 dark:text-gray-500"}`}
                  >
                    {errors.password?.join(" ") || t("passwordHint")}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div
            className={
              profile
                ? "hidden"
                : "border-t border-gray-100 pt-5 dark:border-gray-800"
            }
          >
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {t("table.roles")}
            </h3>
            <p className="mt-1 mb-3 text-theme-xs text-gray-500 dark:text-gray-400">
              {t(canAssign ? "rolesHint" : "rolesRestricted")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {roles.map((role) => (
                <label
                  key={role.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition ${selected.includes(role.id) ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400"}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(role.id)}
                    disabled={busy || !canAssign || !role.asignable}
                    onChange={(e) =>
                      setSelected((old) =>
                        e.target.checked
                          ? [...old, role.id]
                          : old.filter((id) => id !== role.id),
                      )
                    }
                    className="size-4 accent-brand-500"
                  />
                  {role.name}
                </label>
              ))}
            </div>
            {!roles.length && (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                {t("noRolesAvailable")}
              </p>
            )}
            {errors.roles && (
              <p className="mt-2 text-theme-xs text-error-500">
                {errors.roles.join(" ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 sm:px-8 dark:border-gray-800">
          <span className="hidden text-theme-xs text-gray-400 sm:block dark:text-gray-500">
            {t("requiredFields")}
          </span>
          <div className="ms-auto flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {t(busy ? "saving" : user ? "saveChanges" : "createUser")}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
