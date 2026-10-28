"use client";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import { AlertIcon } from "@/icons";
export default function UsersUnavailable() {
  const t = useTranslations("users");
  const router = useRouter();
  return (
    <div
      role="alert"
      className="superficie-cristal mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-gray-900"
    >
      <AlertIcon className="mx-auto mb-4 size-10 text-warning-500" />
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
        {t("unavailable")}
      </h1>
      <p className="mt-2 mb-6 text-sm text-gray-500 dark:text-gray-400">
        {t("unavailableDescription")}
      </p>
      <Button onClick={() => router.refresh()}>{t("retry")}</Button>
    </div>
  );
}
