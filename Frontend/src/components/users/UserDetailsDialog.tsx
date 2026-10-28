import { useLocale, useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import { PencilIcon, LockIcon, TimeIcon } from "@/icons";
import UserAvatar from "./UserAvatar";
import type { Session, UserDetail } from "./types";
interface Props {
  user: UserDetail;
  session: Session;
  onClose: () => void;
  onEdit: () => void;
  onPassword: () => void;
}
export default function UserDetailsDialog({
  user,
  session,
  onClose,
  onEdit,
  onPassword,
}: Props) {
  const t = useTranslations("users");
  const locale = useLocale();
  const formatDate = (value: string | null, time = false) =>
    value
      ? new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          ...(time ? { timeStyle: "short" as const } : {}),
          timeZone: "America/La_Paz",
        }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value))
      : t("notProvided");
  const canManage = !user.protegido || session.user.protegido;
  return (
    <Modal
      isOpen
      onClose={onClose}
      className="max-w-xl"
      labelledBy="user-detail-title"
      closeLabel={t("close")}
    >
      <div className="border-b border-gray-100 p-6 pe-16 sm:p-8 dark:border-gray-800">
        <div className="flex items-center gap-4">
          <UserAvatar user={user} large />
          <div>
            <p className="mb-1 text-theme-xs font-medium tracking-wider text-gray-400 uppercase dark:text-gray-500">
              {t("detailUser")}
            </p>
            <h2
              id="user-detail-title"
              className="text-xl font-semibold text-gray-900 dark:text-white"
            >
              {user.nombre_completo || t("unnamedUser")}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("identityLabel", { value: user.cedula_identidad })}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge size="sm" color={user.is_active ? "success" : "light"}>
            {t(user.is_active ? "active" : "inactive")}
          </Badge>
          {user.roles.map((role) => (
            <Badge key={role.id} size="sm" color="primary">
              {role.name}
            </Badge>
          ))}
          {user.protegido && (
            <Badge size="sm" color="light">
              {t("technicalAccount")}
            </Badge>
          )}
        </div>
      </div>
      <div className="custom-scrollbar max-h-[55vh] space-y-6 overflow-y-auto px-6 py-6 sm:px-8">
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          {[
            ["email", user.email],
            ["celular", user.celular],
            ["cedula_identidad", user.cedula_identidad],
            ["fecha_nacimiento", formatDate(user.fecha_nacimiento)],
            ["date_joined", formatDate(user.date_joined)],
            [
              "last_login",
              user.last_login
                ? formatDate(user.last_login, true)
                : t("neverLoggedIn"),
            ],
            ["direccion", user.direccion],
          ].map(([key, value]) => (
            <div
              key={key}
              className={key === "direccion" ? "sm:col-span-2" : ""}
            >
              <dt className="text-theme-xs text-gray-400 dark:text-gray-500">
                {t(`fields.${key}`)}
              </dt>
              <dd className="mt-1 text-sm break-words text-gray-700 dark:text-gray-200">
                {value || t("notProvided")}
              </dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-gray-100 pt-5 dark:border-gray-800">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
            <TimeIcon className="size-4 text-gray-400" />
            {t("recentActivity")}
          </h3>
          {user.actividad_reciente.length ? (
            <ol className="space-y-4">
              {user.actividad_reciente.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-400" />
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {t(`activity.${item.accion}`)}
                    </p>
                    <p className="mt-0.5 text-theme-xs text-gray-400 dark:text-gray-500">
                      {item.actor || t("system")} ·{" "}
                      {formatDate(item.fecha, true)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {t("noActivity")}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-6 py-4 sm:px-8 dark:border-gray-800">
        {canManage && session.capabilities.reset_password && (
          <Button
            size="sm"
            variant="outline"
            onClick={onPassword}
            startIcon={<LockIcon className="size-4" />}
          >
            {t("resetPassword")}
          </Button>
        )}
        {canManage && session.capabilities.edit && (
          <Button
            size="sm"
            onClick={onEdit}
            startIcon={<PencilIcon className="size-4" />}
          >
            {t("edit")}
          </Button>
        )}
      </div>
    </Modal>
  );
}
