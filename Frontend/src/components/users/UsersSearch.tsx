import { useTranslations } from "next-intl";
import Input from "@/components/form/input/InputField";
import { CloseIcon, SearchIcon } from "@/icons";
interface Props {
  search: string;
  roleName?: string;
  filtered: boolean;
  onSearch: (value: string) => void;
  onClear: () => void;
  onClearRole: () => void;
}
export default function UsersSearch({
  search,
  roleName,
  filtered,
  onSearch,
  onClear,
  onClearRole,
}: Props) {
  const t = useTranslations("users");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full sm:max-w-sm">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute start-3 top-1/2 z-1 size-5 -translate-y-1/2 text-gray-400 dark:text-gray-500"
        />
        <Input
          aria-label={t("filters.searchLabel")}
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={t("filters.search")}
          maxLength={150}
          className="ps-10"
        />
      </div>
      {roleName && (
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-theme-xs font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          {roleName}
          <button
            type="button"
            onClick={onClearRole}
            aria-label={t("toolbar.clearRole")}
          >
            <CloseIcon aria-hidden="true" className="size-3.5" />
          </button>
        </span>
      )}
      {filtered && (
        <button
          type="button"
          onClick={onClear}
          className="ms-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-theme-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <CloseIcon aria-hidden="true" className="size-4" />
          {t("toolbar.clearAll")}
        </button>
      )}
    </div>
  );
}
