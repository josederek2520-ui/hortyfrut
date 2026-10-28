import { useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import {
  EyeIcon,
  PencilIcon,
  GroupIcon,
  PlusIcon,
  LockIcon,
  CheckCircleIcon,
} from "@/icons";
import UserAvatar from "./UserAvatar";
import type { User, Session } from "./types";
interface Props {
  users: User[];
  loading: boolean;
  filtered: boolean;
  session: Session;
  onView: (user: User) => void;
  onEdit: (user: User) => void;
  onStatus: (user: User) => void;
  onCreate: () => void;
}
export default function UsersTable({
  users,
  loading,
  filtered,
  session,
  onView,
  onEdit,
  onStatus,
  onCreate,
}: Props) {
  const t = useTranslations("users");
  if (loading)
    return (
      <div role="status" aria-label={t("loading")} className="space-y-5 py-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex animate-pulse items-center gap-4">
            <div className="size-11 rounded-xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-4 w-1/3 rounded bg-gray-100 dark:bg-gray-800" />
            <div className="ms-auto h-6 w-20 rounded bg-gray-100 dark:bg-gray-800" />
          </div>
        ))}
      </div>
    );
  if (!users.length)
    return (
      <div className="flex flex-col items-center px-4 py-14 text-center">
        <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
          <GroupIcon className="size-8" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
          {t(filtered ? "noResults" : "empty")}
        </h3>
        <p className="mt-2 mb-6 max-w-sm text-sm text-gray-500 dark:text-gray-400">
          {t(filtered ? "noResultsDescription" : "emptyDescription")}
        </p>
        {!filtered && session.capabilities.create && (
          <Button
            onClick={onCreate}
            startIcon={<PlusIcon className="size-4" />}
          >
            {t("newUser")}
          </Button>
        )}
      </div>
    );
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
      <Table>
        <TableHeader className="border-b border-gray-100 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-800/40">
          <TableRow>
            {["person", "contact", "roles", "status", "actions"].map((key) => (
              <TableCell
                key={key}
                isHeader
                className={`px-4 py-3.5 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400 ${key === "actions" ? "text-end" : ""}`}
              >
                {t(`table.${key}`)}
              </TableCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
          {users.map((user) => {
            const protectedAccount = user.protegido && !session.user.protegido;
            return (
              <TableRow
                key={user.id}
                className="transition hover:bg-gray-50/70 dark:hover:bg-white/3"
              >
                <TableCell className="px-4 py-4">
                  <button
                    type="button"
                    onClick={() => onView(user)}
                    className="flex items-center gap-3 text-start"
                  >
                    <UserAvatar user={user} />
                    <span>
                      <span className="block text-sm font-medium whitespace-nowrap text-gray-800 hover:text-brand-600 dark:text-gray-100 dark:hover:text-brand-400">
                        {user.nombre_completo || t("unnamedUser")}
                        {user.id === session.user.id && (
                          <span className="ms-1.5 text-theme-xs font-normal text-gray-400">
                            {t("you")}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
                        {t("identityLabel", { value: user.cedula_identidad })}
                      </span>
                    </span>
                  </button>
                </TableCell>
                <TableCell className="px-4 py-4">
                  <span className="block text-sm text-gray-700 dark:text-gray-300">
                    {user.email || t("notProvided")}
                  </span>
                  <span className="mt-0.5 block text-theme-xs text-gray-400 dark:text-gray-500">
                    {user.celular || t("noPhone")}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-4">
                  <div className="flex max-w-56 flex-wrap gap-1.5">
                    {user.roles.length ? (
                      user.roles.map((r) => (
                        <Badge key={r.id} size="sm" color="light">
                          {r.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-theme-xs text-gray-400 dark:text-gray-500">
                        {t(user.protegido ? "technicalAccount" : "noRoles")}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="px-4 py-4">
                  <Badge
                    size="sm"
                    color={user.is_active ? "success" : "light"}
                    startIcon={
                      <span
                        className={`size-1.5 rounded-full ${user.is_active ? "bg-success-500" : "bg-gray-400"}`}
                      />
                    }
                  >
                    {t(user.is_active ? "active" : "inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="px-4 py-4">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onView(user)}
                      title={t("view")}
                      aria-label={`${t("view")} ${user.cedula_identidad}`}
                      className="rounded-lg p-2 text-gray-400 hover:bg-brand-50 hover:text-brand-600 focus-visible:ring-3 focus-visible:ring-brand-500/20 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                    >
                      <EyeIcon className="size-5" />
                    </button>
                    {session.capabilities.edit && !protectedAccount && (
                      <button
                        type="button"
                        onClick={() => onEdit(user)}
                        title={t("edit")}
                        aria-label={`${t("edit")} ${user.cedula_identidad}`}
                        className="rounded-lg p-2 text-gray-400 hover:bg-brand-50 hover:text-brand-600 focus-visible:ring-3 focus-visible:ring-brand-500/20 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                      >
                        <PencilIcon className="size-5" />
                      </button>
                    )}
                    {session.capabilities.change_status &&
                      !protectedAccount &&
                      user.id !== session.user.id && (
                        <button
                          type="button"
                          onClick={() => onStatus(user)}
                          title={t(user.is_active ? "deactivate" : "activate")}
                          aria-label={`${t(user.is_active ? "deactivate" : "activate")} ${user.cedula_identidad}`}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-3 focus-visible:ring-brand-500/20 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                        >
                          {user.is_active ? (
                            <LockIcon className="size-5" />
                          ) : (
                            <CheckCircleIcon className="size-5" />
                          )}
                        </button>
                      )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
