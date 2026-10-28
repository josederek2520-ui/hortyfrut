"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import Input from "@/components/form/input/InputField";
import { LockIcon, SearchIcon, CheckLineIcon } from "@/icons";
import type { PermissionModule } from "./types";

interface Props {
  modules: PermissionModule[];
  selected: number[];
  onChange?: (ids: number[]) => void;
  readOnly?: boolean;
  disabled?: boolean;
}
export default function PermissionMatrix({
  modules,
  selected,
  onChange,
  readOnly = false,
  disabled = false,
}: Props) {
  const t = useTranslations("roles");
  const [search, setSearch] = useState("");
  const labelFor = (code: string, fallback: string) =>
    t.has(`permissionLabels.${code.split(".")[1]}`)
      ? t(`permissionLabels.${code.split(".")[1]}`)
      : fallback;
  const visible = modules
    .map((module) => ({
      ...module,
      permissions: module.permissions.filter(
        (p) =>
          (!readOnly || selected.includes(p.id)) &&
          `${labelFor(p.code, p.label)} ${module.label}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase().trim()),
      ),
    }))
    .filter((module) => module.permissions.length);
  const toggle = (ids: number[], checked: boolean) =>
    onChange?.(
      checked
        ? [...new Set([...selected, ...ids])]
        : selected.filter((id) => !ids.includes(id)),
    );
  return (
    <div className="space-y-4">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute start-3.5 top-3.5 size-4 text-gray-400 dark:text-gray-500" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPermissions")}
          aria-label={t("searchPermissions")}
          className="ps-10"
        />
      </div>
      {!visible.length && (
        <p className="py-5 text-center text-sm text-gray-500 dark:text-gray-400">
          {t(
            readOnly && !selected.length
              ? "noPermissions"
              : "noPermissionsFound",
          )}
        </p>
      )}
      {visible.map((module) => {
        const eligible = module.permissions
          .filter((p) => p.asignable)
          .map((p) => p.id);
        const checkedCount = eligible.filter((id) =>
          selected.includes(id),
        ).length;
        const title = t.has(`modules.${module.key}`)
          ? t(`modules.${module.key}`)
          : module.label;
        return (
          <fieldset
            key={module.key}
            className="min-w-0 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700"
          >
            <legend className="sr-only">{title}</legend>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60">
              <div className="flex items-center gap-2.5">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {title}
                </h4>
                <span className="rounded-full bg-white px-2 py-0.5 text-theme-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  {
                    module.permissions.filter((p) => selected.includes(p.id))
                      .length
                  }{" "}
                  / {module.permissions.length}
                </span>
              </div>
              {!readOnly && eligible.length > 0 && (
                <label className="flex min-h-8 cursor-pointer items-center gap-2 text-theme-xs font-medium text-brand-600 dark:text-brand-300">
                  <input
                    type="checkbox"
                    className="size-4 rounded accent-brand-500 focus-visible:ring-2 focus-visible:ring-brand-400"
                    checked={checkedCount === eligible.length}
                    ref={(el) => {
                      if (el)
                        el.indeterminate =
                          checkedCount > 0 && checkedCount < eligible.length;
                    }}
                    disabled={disabled}
                    onChange={(e) => toggle(eligible, e.target.checked)}
                  />
                  {t(search ? "selectVisible" : "selectModule")}
                </label>
              )}
            </div>
            {module.key === "presentaciones" && (
              <p className="px-4 pt-3 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
                {t("dependenciaPresentaciones")}
              </p>
            )}
            {module.key === "sucursales" && (
              <p className="px-4 pt-3 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
                {t("dependenciaSucursales")}
              </p>
            )}
            {module.key === "pedidos" && (
              <p className="px-4 pt-3 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
                {t("alcancePedidos")}
              </p>
            )}
            {module.key === "unidades_inventario" && (
              <p className="px-4 pt-3 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
                {t("dependenciaUnidadesInventario")}
              </p>
            )}
            {module.key === "cajillas" && (
              <p className="px-4 pt-3 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
                {t("permisosCajillas")}
              </p>
            )}
            {module.key === "preparaciones" && (
              <p className="px-4 pt-3 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
                {t("alcancePreparaciones")}
              </p>
            )}
            <div className="grid gap-1 p-2 sm:grid-cols-2">
              {module.permissions.map((permission) => (
                <label
                  key={permission.id}
                  className={`flex min-h-12 items-start gap-3 rounded-lg p-3 text-sm transition ${readOnly ? "text-gray-700 dark:text-gray-200" : permission.asignable ? "cursor-pointer text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800" : "cursor-not-allowed text-gray-400 dark:text-gray-500"}`}
                >
                  {readOnly ? (
                    <CheckLineIcon className="mt-0.5 size-4 shrink-0 text-success-500" />
                  ) : (
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 rounded accent-brand-500 focus-visible:ring-2 focus-visible:ring-brand-400"
                      checked={selected.includes(permission.id)}
                      disabled={disabled || !permission.asignable}
                      onChange={(e) =>
                        toggle([permission.id], e.target.checked)
                      }
                    />
                  )}
                  <span className="min-w-0 flex-1 leading-5">
                    {labelFor(permission.code, permission.label)}
                    {!readOnly && !permission.asignable && (
                      <span className="mt-0.5 block text-theme-xs">
                        {t("restrictedPermission")}
                      </span>
                    )}
                  </span>
                  {!readOnly && !permission.asignable && (
                    <LockIcon
                      className="mt-0.5 size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
