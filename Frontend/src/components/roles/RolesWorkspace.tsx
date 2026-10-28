"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ComponentCard from "@/components/common/ComponentCard";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import ToastViewport from "@/components/ui/toast/ToastViewport";
import { SearchIcon, LockIcon, AlertIcon } from "@/icons";
import { useModal } from "@/hooks/useModal";
import { useToast } from "@/hooks/useToast";
import { api, ApiError } from "@/lib/api";
import RolesToolbar from "./RolesToolbar";
import RolesTable from "./RolesTable";
import RoleDetailsDialog from "./RoleDetailsDialog";
import RoleDeleteDialog from "./RoleDeleteDialog";
import RoleMembersDialog from "./RoleMembersDialog";
import type { Session } from "@/components/users/types";
import type { RoleRow, RoleDetail, RolePage, RoleStats } from "./types";

type Dialog =
  | { type: "view"; role: RoleDetail }
  | { type: "delete" | "members"; role: RoleRow };
export default function RolesWorkspace({ session }: { session: Session }) {
  const t = useTranslations("roles");
  const router = useRouter();
  const modal = useModal();
  const { toasts, notify, dismiss } = useToast();
  const [data, setData] = useState<RolePage | null>(null);
  const [stats, setStats] = useState<RoleStats | null>(null);
  const [search, setSearch] = useState("");
  const [membership, setMembership] = useState("");
  const [ordering, setOrdering] = useState("name");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      const aviso = sessionStorage.getItem("roles:notificacion");
      if (aviso === "created" || aviso === "updated") {
        sessionStorage.removeItem("roles:notificacion");
        notify(t(aviso));
      }
    }, 0);
    return () => window.clearTimeout(temporizador);
  }, [notify, t]);
  const handleError = useCallback(
    (caught: unknown) => {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/signin");
        router.refresh();
        return;
      }
      notify(
        t(
          caught instanceof ApiError && caught.status === 403
            ? "forbiddenDescription"
            : caught instanceof ApiError && caught.status === 409
              ? "conflict"
              : caught instanceof ApiError && caught.status === 400
                ? "validationError"
                : "requestError",
        ),
        "error",
      );
    },
    [notify, router, t],
  );
  useEffect(() => {
    if (!session.role_capabilities.view) return;
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        setLoading(true);
        setError("");
        try {
          const query = new URLSearchParams({
            search,
            membership,
            ordering,
            page: String(page),
          });
          const [list, counts] = await Promise.all([
            api<RolePage>(`roles/?${query}`, { signal: controller.signal }),
            api<RoleStats>("roles/resumen/", { signal: controller.signal }),
          ]);
          if (!controller.signal.aborted) {
            setData(list);
            setStats(counts);
          }
        } catch (caught) {
          if (!controller.signal.aborted) {
            if (caught instanceof ApiError && caught.status === 404 && page > 1)
              setPage(1);
            else {
              setError(t("loadError"));
              handleError(caught);
            }
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
    membership,
    ordering,
    page,
    revision,
    session.role_capabilities.view,
    handleError,
    t,
  ]);
  const open = (next: Dialog) => {
    setDialog(next);
    modal.openModal();
  };
  const close = () => {
    modal.closeModal();
    setDialog(null);
  };
  const detail = async (role: RoleRow, type: "view") => {
    if (opening) return;
    setOpening(true);
    try {
      open({ type, role: await api<RoleDetail>(`roles/${role.id}/`) });
    } catch (caught) {
      handleError(caught);
    } finally {
      setOpening(false);
    }
  };
  const saved = () => {
    notify(t("deleted"));
    close();
    setRevision((v) => v + 1);
    router.refresh();
    window.dispatchEvent(new Event("hortyfru:session-changed"));
  };
  if (!session.role_capabilities.view)
    return (
      <div className="superficie-cristal rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-gray-900">
        <LockIcon className="mx-auto mb-4 size-10 text-gray-400" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t("forbidden")}
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t("forbiddenDescription")}
        </p>
      </div>
    );
  const pages = Math.max(1, Math.ceil((data?.count || 0) / 10));
  const filtered = !!(search || membership || ordering !== "name");
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
          <RolesToolbar
            stats={stats}
            membership={membership}
            canCreate={session.role_capabilities.create && !loading && !error}
            onMembership={(value) => {
              setMembership(value);
              setPage(1);
            }}
            onCreate={() => router.push("/roles/nuevo")}
          />
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <SearchIcon className="pointer-events-none absolute start-3.5 top-3.5 size-4 text-gray-400 dark:text-gray-500" />
            <Input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t("search")}
              aria-label={t("search")}
              className="ps-10"
            />
          </div>
          <label className="flex items-center gap-2 text-theme-xs text-gray-500 sm:ms-auto dark:text-gray-400">
            {t("orderBy")}
            <select
              value={ordering}
              onChange={(e) => {
                setOrdering(e.target.value);
                setPage(1);
              }}
              className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              {["name", "-name", "-usuarios_count", "-permisos_count"].map(
                (value) => (
                  <option key={value} value={value}>
                    {t(`ordering.${value}`)}
                  </option>
                ),
              )}
            </select>
          </label>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setMembership("");
                setOrdering("name");
                setPage(1);
              }}
              className="min-h-10 rounded-lg px-2 text-theme-xs font-medium text-brand-600 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none dark:text-brand-300 dark:hover:bg-brand-500/10"
            >
              {t("clearFilters")}
            </button>
          )}
        </div>
        {error ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-xl bg-error-50 p-4 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400"
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
          <RolesTable
            roles={data?.results || []}
            loading={loading}
            filtered={!!(search || membership)}
            canCreate={session.role_capabilities.create}
            canViewUsers={session.capabilities.view}
            busy={opening}
            onView={(role) => void detail(role, "view")}
            onEdit={(role) => router.push(`/roles/${role.id}/editar`)}
            onDelete={(role) => open({ type: "delete", role })}
            onMembers={(role) => open({ type: "members", role })}
            onCreate={() => router.push("/roles/nuevo")}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p
            role="status"
            className="text-theme-xs text-gray-500 dark:text-gray-400"
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
              {page} / {pages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pages || loading}
              onClick={() => setPage((v) => v + 1)}
            >
              {t("next")}
            </Button>
          </div>
        </div>
      </ComponentCard>
      {opening && (
        <p
          role="status"
          className="text-center text-sm text-gray-500 dark:text-gray-400"
        >
          {t("loading")}
        </p>
      )}
      {modal.isOpen && dialog?.type === "view" && (
        <RoleDetailsDialog
          role={dialog.role}
          canViewUsers={session.capabilities.view}
          onClose={close}
          onEdit={() => router.push(`/roles/${dialog.role.id}/editar`)}
          onMembers={() => open({ type: "members", role: dialog.role })}
        />
      )}
      {modal.isOpen && dialog?.type === "delete" && (
        <RoleDeleteDialog
          role={dialog.role}
          onClose={close}
          onSaved={saved}
          onError={handleError}
        />
      )}
      {modal.isOpen && dialog?.type === "members" && (
        <RoleMembersDialog
          role={dialog.role}
          onClose={close}
          onError={handleError}
        />
      )}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
