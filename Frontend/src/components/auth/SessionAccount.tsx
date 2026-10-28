"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { ChevronDownIcon } from "@/icons";
import { Dropdown } from "@/components/ui/dropdown/Dropdown";
import UserAvatar from "@/components/users/UserAvatar";
import type { Session } from "@/components/users/types";
import { api } from "@/lib/api";
export default function SessionAccount() {
  const t = useTranslations("users");
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    api<Session>("auth/me/")
      .then((data) => {
        if (alive) setSession(data);
      })
      .catch(() => {
        if (alive) setSession(null);
      });
    return () => {
      alive = false;
    };
  }, [pathname]);
  const signOut = async () => {
    setBusy(true);
    try {
      await api("auth/logout/", { method: "POST" });
      setSession(null);
      router.replace("/signin");
      router.refresh();
    } catch {
      setBusy(false);
    }
  };
  if (!session)
    return (
      <Link
        href="/signin"
        className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
      >
        {t("auth.signIn")}
      </Link>
    );
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-3 rounded-lg text-start"
      >
        <UserAvatar user={session.user} />
        <span className="hidden sm:block">
          <span className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            {session.user.first_name || t("myAccount")}
          </span>
          <span className="text-theme-xs text-gray-400 dark:text-gray-500">
            {session.user.roles[0]?.name || t("myAccount")}
          </span>
        </span>
        <ChevronDownIcon className="size-4 text-gray-400" />
      </button>
      <Dropdown
        isOpen={open}
        onClose={() => setOpen(false)}
        className="absolute end-0 mt-3 w-64 rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="mb-2 border-b border-gray-100 px-2 pb-3 dark:border-gray-800">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {session.user.nombre_completo || t("myAccount")}
          </p>
          <p className="mt-1 truncate text-theme-xs text-gray-500 dark:text-gray-400">
            {session.user.email}
          </p>
        </div>
        <Link
          href="/profile"
          onClick={() => setOpen(false)}
          className="block rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {t("myAccount")}
        </Link>
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={busy}
          className="w-full rounded-lg px-3 py-2 text-start text-sm text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
        >
          {t("signOut")}
        </button>
      </Dropdown>
    </div>
  );
}
