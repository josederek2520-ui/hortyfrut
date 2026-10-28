"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import { useModal } from "@/hooks/useModal";
import { useToast } from "@/hooks/useToast";
import ToastViewport from "@/components/ui/toast/ToastViewport";
import { LockIcon, AlertIcon } from "@/icons";
import { api, ApiError } from "@/lib/api";
import UsersSearch from "./UsersSearch";
import UsersToolbar from "./UsersToolbar";
import UsersTable from "./UsersTable";
import UserFormDialog from "./UserFormDialog";
import UserDetailsDialog from "./UserDetailsDialog";
import UserActionDialog from "./UserActionDialog";
import type {
  Session,
  User,
  UserDetail,
  Role,
  PaginatedUsers,
  UserStats,
} from "./types";
type Dialog =
  | { type: "create" }
  | { type: "edit" | "details"; user: UserDetail }
  | { type: "status" | "password"; user: User };
export default function UsersWorkspace({ session }: { session: Session }) {
  const t = useTranslations("users");
  const router = useRouter();
  const modal = useModal();
  const [data, setData] = useState<PaginatedUsers | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { toasts, notify, dismiss } = useToast();
  const [opening, setOpening] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [ordering, setOrdering] = useState("-date_joined");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const handleError = useCallback(
    (caught: unknown, inline = false) => {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/signin");
        router.refresh();
        return;
      }
      const message =
        caught instanceof ApiError && caught.status === 403
          ? t("forbiddenDescription")
          : t("loadError");
      if (inline) setError(message);
      notify(message, "error");
    },
    [router, t, notify],
  );
  useEffect(() => {
    if (!session.capabilities.view) return;
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        setLoading(true);
        setError("");
        const query = new URLSearchParams({
          page: String(page),
          search,
          is_active: status,
          role,
          ordering,
        });
        try {
          const [list, counts, availableRoles] = await Promise.all([
            api<PaginatedUsers>(`usuarios/?${query}`, {
              signal: controller.signal,
            }),
            api<UserStats>("usuarios/resumen/", { signal: controller.signal }),
            api<Role[]>("roles/opciones/", { signal: controller.signal }),
          ]);
          if (!controller.signal.aborted) {
            setData(list);
            setStats(counts);
            setRoles(availableRoles);
          }
        } catch (caught) {
          if (!controller.signal.aborted) {
            if (caught instanceof ApiError && caught.status === 404 && page > 1)
              setPage(1);
            else handleError(caught, true);
          }
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      search ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    search,
    status,
    role,
    ordering,
    page,
    revision,
    session.capabilities.view,
    handleError,
  ]);
  const open = (next: Dialog) => {
    setDialog(next);
    modal.openModal();
  };
  const close = () => {
    modal.closeModal();
    setDialog(null);
  };
  const loadDetail = async (user: User, type: "edit" | "details") => {
    if (opening) return;
    setOpening(true);
    setError("");
    try {
      open({ type, user: await api<UserDetail>(`usuarios/${user.id}/`) });
    } catch (caught) {
      handleError(caught);
    } finally {
      setOpening(false);
    }
  };
  const saved = () => {
    const type = dialog?.type;
    if (type === "create") setPage(1);
    close();
    notify(
      t(
        type === "create"
          ? "createdSuccess"
          : type === "status"
            ? "statusSuccess"
            : type === "password"
              ? "passwordSuccess"
              : "updatedSuccess",
      ),
    );
    setRevision((v) => v + 1);
    router.refresh();
  };
  const clear = () => {
    setSearch("");
    setStatus("");
    setRole("");
    setOrdering("-date_joined");
    setPage(1);
  };
  if (!session.capabilities.view)
    return (
      <div className="superficie-cristal rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-gray-900">
        <LockIcon className="mx-auto mb-4 size-10 text-gray-400" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t("forbidden")}
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t("forbiddenDescription")}
        </p>
      </div>
    );
  const totalPages = Math.max(1, Math.ceil((data?.count || 0) / 10));
  return (
    <div className="space-y-6">
      <div>
        <PageBreadcrumb pageTitle={t("title")} />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("subtitle")}
        </p>
      </div>
      <ComponentCard
        title={t("directory")}
        header={
          <UsersToolbar
            stats={stats}
            status={status}
            role={role}
            ordering={ordering}
            roles={roles}
            canCreate={session.capabilities.create}
            onStatus={(value) => {
              setStatus(value);
              setPage(1);
            }}
            onApplyFilters={(nextRole, nextOrdering) => {
              setRole(nextRole);
              setOrdering(nextOrdering);
              setPage(1);
            }}
            onCreate={() => open({ type: "create" })}
          />
        }
      >
        <div
          id="users-panel"
          role="tabpanel"
          aria-labelledby={`users-tab-${status === "true" ? "active" : status === "false" ? "inactive" : "all"}`}
          className="space-y-6"
        >
          <UsersSearch
            search={search}
            roleName={roles.find((item) => String(item.id) === role)?.name}
            filtered={
              !!(search || status || role || ordering !== "-date_joined")
            }
            onSearch={(value) => {
              setSearch(value);
              setPage(1);
            }}
            onClear={clear}
            onClearRole={() => {
              setRole("");
              setPage(1);
            }}
          />
          {error ? (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-600 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400"
            >
              <AlertIcon className="size-5" />
              <span className="flex-1">{error}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRevision((v) => v + 1)}
              >
                {t("retry")}
              </Button>
            </div>
          ) : (
            <UsersTable
              users={data?.results || []}
              loading={loading}
              filtered={!!(search || status || role)}
              session={session}
              onView={(user) => void loadDetail(user, "details")}
              onEdit={(user) => void loadDetail(user, "edit")}
              onStatus={(user) => open({ type: "status", user })}
              onCreate={() => open({ type: "create" })}
            />
          )}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p
              className="text-theme-xs text-gray-500 dark:text-gray-400"
              aria-live="polite"
            >
              {t("pagination", {
                from: data?.count ? (page - 1) * 10 + 1 : 0,
                to: Math.min(page * 10, data?.count || 0),
                total: data?.count || 0,
              })}
            </p>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => setPage((v) => v - 1)}
              >
                {t("previous")}
              </Button>
              <span className="text-theme-xs text-gray-500 tabular-nums dark:text-gray-400">
                {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((v) => v + 1)}
              >
                {t("next")}
              </Button>
            </div>
          </div>
        </div>
      </ComponentCard>
      {opening && (
        <p
          role="status"
          className="text-center text-sm text-gray-400 dark:text-gray-500"
        >
          {t("loading")}
        </p>
      )}
      {modal.isOpen &&
        dialog &&
        (dialog.type === "create" || dialog.type === "edit") && (
          <UserFormDialog
            key={dialog.type === "edit" ? dialog.user.id : "new"}
            user={dialog.type === "edit" ? dialog.user : null}
            roles={roles}
            session={session}
            onClose={close}
            onSaved={saved}
            onError={(message) => notify(message, "error")}
          />
        )}
      {modal.isOpen && dialog?.type === "details" && (
        <UserDetailsDialog
          user={dialog.user}
          session={session}
          onClose={close}
          onEdit={() => open({ type: "edit", user: dialog.user })}
          onPassword={() => open({ type: "password", user: dialog.user })}
        />
      )}
      {modal.isOpen &&
        dialog &&
        (dialog.type === "status" || dialog.type === "password") && (
          <UserActionDialog
            user={dialog.user}
            action={dialog.type}
            self={dialog.user.id === session.user.id}
            onClose={close}
            onSaved={saved}
            onError={(message) => notify(message, "error")}
          />
        )}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
