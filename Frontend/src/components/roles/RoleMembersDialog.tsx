"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import UserAvatar from "@/components/users/UserAvatar";
import { GroupIcon } from "@/icons";
import { api } from "@/lib/api";
import type { PaginatedUsers } from "@/components/users/types";
import type { RoleRow } from "./types";

export default function RoleMembersDialog({
  role,
  onClose,
  onError,
}: {
  role: RoleRow;
  onClose: () => void;
  onError: (error: unknown) => void;
}) {
  const t = useTranslations("roles");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedUsers | null>(null);
  const [loadedPage, setLoadedPage] = useState(0);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<PaginatedUsers>(
      `usuarios/?role=${role.id}&page=${page}&ordering=first_name`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setLoadedPage(page);
          setError(false);
        }
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setLoadedPage(page);
          setError(true);
          onError(caught);
        }
      });
    return () => controller.abort();
  }, [page, role.id, revision, onError]);
  const loading = page !== loadedPage;
  return (
    <Modal
      isOpen
      onClose={onClose}
      className="max-w-xl"
      labelledBy="role-members-title"
      closeLabel={t("close")}
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="shrink-0 border-b border-gray-100 p-6 pe-16 dark:border-gray-800">
          <h2
            id="role-members-title"
            className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
          >
            <GroupIcon className="size-5 text-brand-500" />
            {t("assignedUsers")}
          </h2>
          <p className="mt-1 text-sm break-words text-gray-500 dark:text-gray-400">
            {role.name}
          </p>
        </div>
        <div className="custom-scrollbar min-h-40 overflow-y-auto p-6">
          {loading ? (
            <p
              role="status"
              className="py-6 text-center text-sm text-gray-500 dark:text-gray-400"
            >
              {t("loading")}
            </p>
          ) : error ? (
            <div role="alert" className="space-y-3 text-center">
              <p className="text-sm text-error-500">{t("loadError")}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRevision((v) => v + 1)}
              >
                {t("retry")}
              </Button>
            </div>
          ) : !data?.results.length ? (
            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {t("noMembers")}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.results.map((user) => (
                <li key={user.id} className="flex items-center gap-3 py-3">
                  <UserAvatar user={user} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-words text-gray-800 dark:text-gray-100">
                      {user.nombre_completo || user.cedula_identidad}
                    </p>
                    <p className="text-theme-xs break-words text-gray-500 dark:text-gray-400">
                      {user.email}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-theme-xs ${user.is_active ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}
                  >
                    {t(user.is_active ? "activeUser" : "inactiveUser")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <p
            role="status"
            className="text-theme-xs text-gray-500 dark:text-gray-400"
          >
            {t("memberCount", { count: data?.count ?? role.usuarios_count })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage((v) => v - 1)}
            >
              {t("previous")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!data?.next || loading}
              onClick={() => setPage((v) => v + 1)}
            >
              {t("next")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
