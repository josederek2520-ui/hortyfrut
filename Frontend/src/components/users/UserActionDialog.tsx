"use client";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { LockIcon, CheckCircleIcon } from "@/icons";
import { api, ApiError } from "@/lib/api";
import { useFormValidation } from "@/hooks/useFormValidation";
import { focusInvalidField } from "@/lib/form-validation";
import type { User } from "./types";
interface Props {
  user: User;
  action: "status" | "password";
  self: boolean;
  profile?: boolean;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}
export default function UserActionDialog({
  user,
  action,
  self,
  profile = false,
  onClose,
  onSaved,
  onError,
}: Props) {
  const t = useTranslations("users");
  const [busy, setBusy] = useState(false);
  const { errors, setErrors, validateForm, changeField, blurField } =
    useFormValidation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [current, setCurrent] = useState("");
  const title =
    action === "password"
      ? t("resetPassword")
      : t(user.is_active ? "deactivateTitle" : "activateTitle");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const mismatch =
      action === "password" && password && confirm && password !== confirm;
    if (
      !validateForm(form, mismatch ? { confirm: [t("passwordMismatch")] } : {})
    ) {
      onError(t("validationError"));
      return;
    }
    setBusy(true);
    try {
      await api(
        profile
          ? "auth/profile/password/"
          : `usuarios/${user.id}/${action === "password" ? "password" : "estado"}/`,
        {
          method: "POST",
          body: JSON.stringify(
            action === "password"
              ? { password, ...(self ? { current_password: current } : {}) }
              : { is_active: !user.is_active },
          ),
        },
      );
      onSaved();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrors(caught.errors);
        onError(
          caught.errors.detail?.join(" ") ||
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
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!busy) onClose();
      }}
      className="max-w-md"
      labelledBy="user-action-title"
      closeLabel={t("close")}
    >
      <form
        noValidate
        onSubmit={submit}
        className="custom-scrollbar max-h-[90dvh] overflow-y-auto p-6 sm:p-8"
      >
        <div
          className={`mb-5 flex size-12 items-center justify-center rounded-2xl ${action === "status" && !user.is_active ? "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400" : "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"}`}
        >
          {action === "status" && !user.is_active ? (
            <CheckCircleIcon className="size-6" />
          ) : (
            <LockIcon className="size-6" />
          )}
        </div>
        <h2
          id="user-action-title"
          className="text-xl font-semibold text-gray-900 dark:text-white"
        >
          {title}
        </h2>
        <p className="mt-2 mb-5 text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t(
            action === "password"
              ? "passwordDescription"
              : user.is_active
                ? "deactivateDescription"
                : "activateDescription",
            { name: user.nombre_completo || user.cedula_identidad },
          )}
        </p>
        {action === "password" && (
          <div className="mb-6 space-y-4">
            {self && (
              <div>
                <Label htmlFor="current-password">{t("currentPassword")}</Label>
                <Input
                  id="current-password"
                  name="current_password"
                  type="password"
                  value={current}
                  onChange={(e) => {
                    setCurrent(e.target.value);
                    changeField(e.currentTarget);
                  }}
                  onBlur={(e) => blurField(e.currentTarget)}
                  error={!!errors.current_password?.length}
                  aria-invalid={!!errors.current_password?.length}
                  aria-describedby={
                    errors.current_password?.length
                      ? "current-password-error"
                      : undefined
                  }
                  required
                  autoComplete="current-password"
                  disabled={busy}
                />
                {errors.current_password?.length ? (
                  <p
                    id="current-password-error"
                    className="mt-1.5 text-theme-xs text-error-500"
                  >
                    {errors.current_password.join(" ")}
                  </p>
                ) : null}
              </div>
            )}
            <div>
              <Label htmlFor="new-password">{t("fields.password")}</Label>
              <Input
                id="new-password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  changeField(e.currentTarget);
                }}
                onBlur={(e) => blurField(e.currentTarget)}
                error={!!errors.password?.length}
                aria-invalid={!!errors.password?.length}
                aria-describedby="new-password-hint"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                disabled={busy}
              />
              <p
                id="new-password-hint"
                className={`mt-2 text-theme-xs ${errors.password?.length ? "text-error-500" : "text-gray-400 dark:text-gray-500"}`}
              >
                {errors.password?.join(" ") || t("passwordHint")}
              </p>
            </div>
            <div>
              <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
              <Input
                id="confirm-password"
                name="confirm"
                type="password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  changeField(e.currentTarget);
                }}
                onBlur={(e) => blurField(e.currentTarget)}
                error={!!errors.confirm?.length}
                aria-invalid={!!errors.confirm?.length}
                aria-describedby={
                  errors.confirm?.length ? "confirm-password-error" : undefined
                }
                required
                maxLength={128}
                autoComplete="new-password"
                disabled={busy}
              />
              {errors.confirm?.length ? (
                <p
                  id="confirm-password-error"
                  className="mt-1.5 text-theme-xs text-error-500"
                >
                  {errors.confirm.join(" ")}
                </p>
              ) : null}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy
              ? t("saving")
              : action === "password"
                ? t("saveChanges")
                : t(user.is_active ? "deactivate" : "activate")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
