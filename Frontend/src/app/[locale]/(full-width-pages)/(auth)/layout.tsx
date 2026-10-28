import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";
import { CheckCircleIcon } from "@/icons";
import MarcaHortyfru from "@/components/common/MarcaHortyfru";
import { getTranslations } from "next-intl/server";
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("users");
  return (
    <div className="relative min-h-screen">
      <div className="flex min-h-screen flex-col gap-4 p-4 lg:flex-row lg:p-6">
        {children}
        <aside className="superficie-cristal panel-presentacion-acceso relative hidden w-1/2 items-center justify-center overflow-hidden rounded-3xl border bg-brand-950 p-12 lg:flex dark:bg-gray-950">
          <div
            aria-hidden="true"
            className="absolute -end-32 -top-32 size-96 rounded-full border border-white/10"
          />
          <div
            aria-hidden="true"
            className="absolute -start-32 -bottom-48 size-96 rounded-full border border-white/10"
          />
          <div className="relative z-1 max-w-md">
            <div className="mb-10">
              <MarcaHortyfru sobreOscuro />
            </div>
            <p className="mb-4 text-theme-xs font-medium tracking-widest text-brand-300 uppercase">
              {t("auth.brandTag")}
            </p>
            <h2 className="text-title-md leading-tight font-semibold tracking-tight text-white">
              {t("auth.brandTitle")}
            </h2>
            <p className="mt-5 text-base leading-7 text-brand-200">
              {t("auth.brandDescription")}
            </p>
            <div className="mt-10 flex items-center gap-2 text-sm text-brand-200">
              <CheckCircleIcon className="size-5 text-success-400" />
              {t("securityHint")}
            </div>
          </div>
        </aside>
      </div>
      <div className="fixed end-6 top-6 z-50">
        <ThemeTogglerTwo />
      </div>
    </div>
  );
}
