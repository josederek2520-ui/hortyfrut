"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import { FilterLinesIcon, PlusIcon } from "@/icons";
import { useClickOutside } from "@/hooks/useClickOutside";
import type { Role, UserStats } from "./types";

interface Props {
  stats: UserStats | null;
  status: string;
  role: string;
  ordering: string;
  roles: Role[];
  canCreate: boolean;
  onStatus: (value: string) => void;
  onApplyFilters: (role: string, ordering: string) => void;
  onCreate: () => void;
}

export default function UsersToolbar({
  stats,
  status,
  role,
  ordering,
  roles,
  canCreate,
  onStatus,
  onApplyFilters,
  onCreate,
}: Props) {
  const t = useTranslations("users");
  const [open, setOpen] = useState(false);
  const [draftRole, setDraftRole] = useState(role);
  const [draftOrdering, setDraftOrdering] = useState(ordering);
  const popover = useRef<HTMLDivElement>(null);
  const filterButton = useRef<HTMLButtonElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  useClickOutside(popover, () => setOpen(false));
  const items = [
    { key: "all", value: "", count: stats?.total },
    { key: "active", value: "true", count: stats?.activos },
    { key: "inactive", value: "false", count: stats?.inactivos },
  ];
  const navigateTabs = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft")
      next = (index + items.length - 1) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    onStatus(items[next].value);
    tabs.current[next]?.focus();
  };
  const toggleFilters = () => {
    setDraftRole(role);
    setDraftOrdering(ordering);
    setOpen(!open);
  };
  const selectClass =
    "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200";
  const hasFilters = !!role || ordering !== "-date_joined";
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div
        role="tablist"
        aria-label={t("toolbar.statusTabs")}
        className="inline-flex max-w-full overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-gray-800"
      >
        {items.map((item, index) => {
          const selected = status === item.value;
          return (
            <button
              key={item.key}
              ref={(element) => {
                tabs.current[index] = element;
              }}
              id={`users-tab-${item.key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="users-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => onStatus(item.value)}
              onKeyDown={(event) => navigateTabs(event, index)}
              className={`pestana-hortyfru inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 py-2 text-theme-sm font-medium whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none sm:px-4 ${selected ? "bg-white text-gray-900 shadow-theme-xs ring-1 ring-gray-200/70 ring-inset dark:bg-gray-900 dark:text-white dark:ring-gray-700" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"}`}
            >
              {t(`toolbar.${item.key}`)}
              <span
                className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-theme-xs font-medium tabular-nums ${selected ? "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-300" : "bg-white text-gray-500 dark:bg-gray-900 dark:text-gray-400"}`}
              >
                {item.count ?? "—"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div
          ref={popover}
          className="relative"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              filterButton.current?.focus();
            }
          }}
        >
          <Button
            ref={filterButton}
            size="sm"
            variant="outline"
            onClick={toggleFilters}
            aria-expanded={open}
            aria-controls="users-filter-panel"
            startIcon={
              <FilterLinesIcon aria-hidden="true" className="size-5 shrink-0" />
            }
            className={hasFilters ? "text-brand-600 dark:text-brand-300" : ""}
          >
            {t("toolbar.filterSort")}
            {hasFilters && (
              <span
                className="size-1.5 rounded-full bg-brand-500"
                aria-label={t("toolbar.filtersApplied")}
              />
            )}
          </Button>
          {open && (
            <div
              id="users-filter-panel"
              className="superficie-cristal absolute end-0 top-full z-30 mt-3 w-72 max-w-[85vw] rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
            >
              <p className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t("toolbar.filterSort")}
              </p>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="users-filter-role">{t("filters.role")}</Label>
                  <select
                    id="users-filter-role"
                    className={selectClass}
                    value={draftRole}
                    onChange={(event) => setDraftRole(event.target.value)}
                  >
                    <option value="">{t("filters.allRoles")}</option>
                    {roles.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="users-filter-order">
                    {t("toolbar.orderBy")}
                  </Label>
                  <select
                    id="users-filter-order"
                    className={selectClass}
                    value={draftOrdering}
                    onChange={(event) => setDraftOrdering(event.target.value)}
                  >
                    {["newest", "oldest", "nameAsc", "nameDesc"].map(
                      (key, index) => (
                        <option
                          key={key}
                          value={
                            [
                              "-date_joined",
                              "date_joined",
                              "first_name",
                              "-first_name",
                            ][index]
                          }
                        >
                          {t(`toolbar.${key}`)}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>
              <div className="mt-5 flex justify-between gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setDraftRole("");
                    setDraftOrdering("-date_joined");
                  }}
                  className="text-theme-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {t("toolbar.reset")}
                </button>
                <Button
                  size="sm"
                  onClick={() => {
                    onApplyFilters(draftRole, draftOrdering);
                    setOpen(false);
                    filterButton.current?.focus();
                  }}
                >
                  {t("toolbar.apply")}
                </Button>
              </div>
            </div>
          )}
        </div>
        {canCreate && (
          <Button
            size="sm"
            onClick={onCreate}
            endIcon={
              <PlusIcon aria-hidden="true" className="size-5 shrink-0" />
            }
          >
            {t("newUser")}
          </Button>
        )}
      </div>
    </div>
  );
}
