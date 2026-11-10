import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getSession } from "@/lib/auth-server";
import ProveedorChofer from "@/components/chofer/ProveedorChofer";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
export default async function DisposicionChofer({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("chofer");
  let sesion;
  try {
    sesion = await getSession();
  } catch {
    return <ServicioNoDisponible />;
  }
  if (!sesion) return redirect({ href: "/signin", locale });
  if (!sesion.permisos_chofer?.ver)
    return (
      <main className="mx-auto max-w-lg p-8 text-gray-900 dark:text-white">
        <h1 className="text-2xl font-semibold">{t("sinPermiso")}</h1>
        <Link href="/profile">{t("cuenta")}</Link>
      </main>
    );
  return <ProveedorChofer sesion={sesion}>{children}</ProveedorChofer>;
}
