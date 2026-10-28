"use client";
import { useLocale, useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import { ShieldIcon, PencilIcon, GroupIcon, TimeIcon } from "@/icons";
import PermissionMatrix from "./PermissionMatrix";
import type { RoleDetail, PermissionModule } from "./types";

interface Props {
  role: RoleDetail;
  canViewUsers: boolean;
  onClose: () => void;
  onEdit: () => void;
  onMembers: () => void;
}
export default function RoleDetailsDialog({
  role,
  canViewUsers,
  onClose,
  onEdit,
  onMembers,
}: Props) {
  const t = useTranslations("roles");
  const locale = useLocale();
  const modules = role.permissions.reduce<PermissionModule[]>((items, p) => {
    let group = items.find((m) => m.key === p.module);
    if (!group) {
      group = { key: p.module, label: p.module, permissions: [] };
      items.push(group);
    }
    group.permissions.push(p);
    return items;
  }, []);
  return (
    <Modal
      isOpen
      onClose={onClose}
      className="max-w-3xl"
      labelledBy="role-detail-title"
      closeLabel={t("close")}
    >
      <div className="flex max-h-[90dvh] flex-col">
        <div className="shrink-0 border-b border-gray-100 p-6 pe-16 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
              <ShieldIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                {t("detailTitle")}
              </p>
              <h2
                id="role-detail-title"
                className="text-xl font-semibold break-words text-gray-900 dark:text-white"
              >
                {role.name}
              </h2>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            {t("detailCounts", {
              permissions: role.permisos_count,
              members: role.usuarios_count,
            })}
          </p>
        </div>
        <div className="custom-scrollbar space-y-6 overflow-y-auto p-6">
          <section>
            <h3 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
              {t("grantedPermissions")}
            </h3>
            <PermissionMatrix
              modules={modules}
              selected={role.permissions.map((p) => p.id)}
              readOnly
            />
          </section>
          {role.actividad_reciente.length > 0 && (
            <section className="border-t border-gray-100 pt-5 dark:border-gray-800">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                <TimeIcon className="size-4 text-gray-400" />
                {t("recentActivity")}
              </h3>
              <ul className="space-y-3">
                {role.actividad_reciente.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-theme-xs"
                  >
                    <span className="text-gray-600 dark:text-gray-300">
                      {t(`activity.${item.accion}`)} ·{" "}
                      {item.actor || t("system")}
                    </span>
                    <time
                      dateTime={item.fecha}
                      className="text-gray-400 dark:text-gray-500"
                    >
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "America/La_Paz",
                      }).format(new Date(item.fecha))}
                    </time>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <Button size="sm" variant="outline" onClick={onClose}>
            {t("close")}
          </Button>
          {canViewUsers && (
            <Button
              size="sm"
              variant="outline"
              onClick={onMembers}
              startIcon={<GroupIcon className="size-4" />}
            >
              {t("viewUsers")}
            </Button>
          )}
          {role.gestion.edit && (
            <Button
              size="sm"
              onClick={onEdit}
              startIcon={<PencilIcon className="size-4" />}
            >
              {t("edit")}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
