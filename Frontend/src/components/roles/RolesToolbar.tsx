"use client";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { PlusIcon } from "@/icons";
import type { RoleStats } from "./types";

interface Props {
  stats: RoleStats | null;
  membership: string;
  canCreate: boolean;
  onMembership: (value: string) => void;
  onCreate: () => void;
}
export default function RolesToolbar({
  stats,
  membership,
  canCreate,
  onMembership,
  onCreate,
}: Props) {
  const t = useTranslations("roles");
  const items = [
    { key: "all", value: "", count: stats?.total },
    { key: "assigned", value: "assigned", count: stats?.asignados },
    { key: "unassigned", value: "unassigned", count: stats?.sin_usuarios },
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div
        role="group"
        aria-label={t("membershipFilter")}
        className="inline-flex max-w-full overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-gray-800"
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={membership === item.value}
            onClick={() => onMembership(item.value)}
            className={`pestana-hortyfru inline-flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-theme-sm font-medium whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none sm:px-4 ${membership === item.value ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"}`}
          >
            {t(item.key)}
            <span
              className={`rounded-full px-1.5 py-0.5 text-theme-xs tabular-nums ${membership === item.value ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300" : "bg-white text-gray-500 dark:bg-gray-900 dark:text-gray-400"}`}
            >
              {item.count ?? "—"}
            </span>
          </button>
        ))}
      </div>
      {canCreate && (
        <Button
          size="sm"
          onClick={onCreate}
          endIcon={<PlusIcon className="size-4.5" />}
        >
          {t("newRole")}
        </Button>
      )}
    </div>
  );
}
