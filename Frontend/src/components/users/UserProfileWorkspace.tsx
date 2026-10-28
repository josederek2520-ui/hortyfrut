"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import { LockIcon, PencilIcon } from "@/icons";
import { useModal } from "@/hooks/useModal";
import { useToast } from "@/hooks/useToast";
import ToastViewport from "@/components/ui/toast/ToastViewport";
import { api } from "@/lib/api";
import UserAvatar from "./UserAvatar";
import UserFormDialog from "./UserFormDialog";
import UserActionDialog from "./UserActionDialog";
import type { Session, UserDetail } from "./types";
export default function UserProfileWorkspace({
  session,
}: {
  session: Session;
}) {
  const t = useTranslations("users");
  const locale = useLocale();
  const router = useRouter();
  const modal = useModal();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [action, setAction] = useState<"edit" | "password">("edit");
  const [error, setError] = useState(false);
  const { toasts, notify, dismiss } = useToast();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    api<UserDetail>("auth/profile/")
      .then((data) => {
        if (alive) {
          setUser(data);
          setError(false);
        }
      })
      .catch(() => {
        if (alive) {
          setError(true);
          notify(t("loadError"), "error");
        }
      });
    return () => {
      alive = false;
    };
  }, [revision, notify, t]);
  const saved = () => {
    modal.closeModal();
    notify(t(action === "edit" ? "updatedSuccess" : "passwordSuccess"));
    setRevision((v) => v + 1);
    router.refresh();
  };
  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle={t("profileTitle")} />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t("profileSubtitle")}
      </p>
      {error && (
        <Button
          variant="outline"
          onClick={() => setRevision((value) => value + 1)}
        >
          {t("retry")}
        </Button>
      )}
      <div className="superficie-cristal rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <UserAvatar user={session.user} large />
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {session.user.nombre_completo || t("myAccount")}
              </h1>
              <p className="mt-1 mb-2 text-sm text-gray-500 dark:text-gray-400">
                {t("identityLabel", { value: session.user.cedula_identidad })}
              </p>
              <Badge size="sm" color="success">
                {t("active")}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAction("password");
                modal.openModal();
              }}
              startIcon={<LockIcon className="size-4" />}
            >
              {t("changePassword")}
            </Button>
            <Button
              size="sm"
              disabled={!user}
              onClick={() => {
                setAction("edit");
                modal.openModal();
              }}
              startIcon={<PencilIcon className="size-4" />}
            >
              {t("editProfile")}
            </Button>
          </div>
        </div>
      </div>
      <ComponentCard title={t("personalData")}>
        <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            "email",
            "cedula_identidad",
            "celular",
            "fecha_nacimiento",
            "direccion",
          ].map((key) => {
            let value = user?.[key as keyof UserDetail] as
              string | null | undefined;
            if (key === "fecha_nacimiento" && value)
              value = new Intl.DateTimeFormat(locale, {
                dateStyle: "long",
              }).format(new Date(`${value}T12:00:00`));
            return (
              <div key={key}>
                <dt className="text-theme-xs text-gray-400 dark:text-gray-500">
                  {t(`fields.${key}`)}
                </dt>
                <dd className="mt-2 text-sm break-words text-gray-700 dark:text-gray-200">
                  {value || (user ? t("notProvided") : "…")}
                </dd>
              </div>
            );
          })}
        </dl>
      </ComponentCard>
      {modal.isOpen && action === "edit" && user && (
        <UserFormDialog
          profile
          user={user}
          roles={user.roles}
          session={session}
          onClose={modal.closeModal}
          onSaved={saved}
          onError={(message) => notify(message, "error")}
        />
      )}
      {modal.isOpen && action === "password" && (
        <UserActionDialog
          profile
          user={session.user}
          self
          action="password"
          onClose={modal.closeModal}
          onSaved={saved}
          onError={(message) => notify(message, "error")}
        />
      )}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
