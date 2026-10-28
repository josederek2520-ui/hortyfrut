"use client";
import { useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShieldIcon,
  EyeIcon,
  PencilIcon,
  DeleteIcon,
  GroupIcon,
} from "@/icons";
import Button from "@/components/ui/button/Button";
import type { RoleRow } from "./types";

interface Props {
  roles: RoleRow[];
  loading: boolean;
  filtered: boolean;
  canCreate: boolean;
  canViewUsers: boolean;
  busy: boolean;
  onView: (role: RoleRow) => void;
  onEdit: (role: RoleRow) => void;
  onDelete: (role: RoleRow) => void;
  onMembers: (role: RoleRow) => void;
  onCreate: () => void;
}
export default function RolesTable(props: Props) {
  const t = useTranslations("roles");
  if (props.loading)
    return (
      <div role="status" aria-label={t("loading")} className="space-y-3 py-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 rounded-xl bg-gray-100 motion-safe:animate-pulse dark:bg-gray-800"
          />
        ))}
      </div>
    );
  if (!props.roles.length)
    return (
      <div className="py-14 text-center">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
          <ShieldIcon className="size-6" />
        </span>
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {t(props.filtered ? "noResults" : "emptyTitle")}
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
          {t(props.filtered ? "noResultsHint" : "emptyHint")}
        </p>
        {!props.filtered && props.canCreate && (
          <Button size="sm" className="mt-5" onClick={props.onCreate}>
            {t("newRole")}
          </Button>
        )}
      </div>
    );
  const actionClass =
    "inline-flex size-10 items-center justify-center rounded-lg text-gray-500 transition hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-35 dark:text-gray-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-300";
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <Table>
        <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
          <TableRow>
            {["roleName", "permissions", "members", "actions"].map((key) => (
              <TableCell
                key={key}
                isHeader
                className={`px-5 py-3.5 text-theme-xs font-medium text-gray-500 dark:text-gray-400 ${key === "actions" ? "text-end" : "text-start"}`}
              >
                {t(key)}
              </TableCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.roles.map((role) => (
            <TableRow
              key={role.id}
              className="border-t border-gray-100 transition hover:bg-gray-50/70 dark:border-gray-800 dark:hover:bg-white/2"
            >
              <TableCell className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
                    <ShieldIcon className="size-5" />
                  </span>
                  <div>
                    <button
                      type="button"
                      disabled={props.busy}
                      onClick={() => props.onView(role)}
                      className="text-start text-sm font-semibold break-words text-gray-800 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none dark:text-gray-100 dark:hover:text-brand-300"
                    >
                      {role.name}
                    </button>
                    {role.gestion.reason && (
                      <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                        {t(`reasons.${role.gestion.reason}`)}
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-5 py-4">
                <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-theme-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {t("permissionCount", { count: role.permisos_count })}
                </span>
              </TableCell>
              <TableCell className="px-5 py-4">
                {props.canViewUsers ? (
                  <button
                    type="button"
                    onClick={() => props.onMembers(role)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm text-brand-600 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none dark:text-brand-300 dark:hover:bg-brand-500/10"
                    aria-label={t("viewMembersOf", { name: role.name })}
                  >
                    <GroupIcon className="size-4" />
                    {role.usuarios_count}
                  </button>
                ) : (
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {role.usuarios_count}
                  </span>
                )}
              </TableCell>
              <TableCell className="px-4 py-4">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    className={actionClass}
                    disabled={props.busy}
                    aria-label={t("viewRole", { name: role.name })}
                    title={t("view")}
                    onClick={() => props.onView(role)}
                  >
                    <EyeIcon className="size-4.5" />
                  </button>
                  <button
                    type="button"
                    className={actionClass}
                    disabled={props.busy || !role.gestion.edit}
                    aria-label={t("editRole", { name: role.name })}
                    title={
                      role.gestion.edit
                        ? t("edit")
                        : t(
                            role.gestion.reason &&
                              role.gestion.reason !== "assigned_users"
                              ? `reasons.${role.gestion.reason}`
                              : "noEditPermission",
                          )
                    }
                    onClick={() => props.onEdit(role)}
                  >
                    <PencilIcon className="size-4.5" />
                  </button>
                  <button
                    type="button"
                    className={`${actionClass} hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10 dark:hover:text-error-400`}
                    disabled={props.busy || !role.gestion.delete}
                    aria-label={t("deleteRole", { name: role.name })}
                    title={
                      role.gestion.delete
                        ? t("delete")
                        : t(
                            role.gestion.reason
                              ? `reasons.${role.gestion.reason}`
                              : "noDeletePermission",
                          )
                    }
                    onClick={() => props.onDelete(role)}
                  >
                    <DeleteIcon className="size-4.5" />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
