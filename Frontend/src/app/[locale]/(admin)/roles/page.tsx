import RolesWorkspace from "@/components/roles/RolesWorkspace";
import UsersUnavailable from "@/components/users/UsersUnavailable";
import { getSession } from "@/lib/auth-server";
import { redirect } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("roles");
  return { title: `${t("title")} | HortyFru`, description: t("subtitle") };
}

export default async function RolesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  let session;
  try {
    session = await getSession();
  } catch {
    return <UsersUnavailable />;
  }
  if (!session) redirect({ href: "/signin", locale });
  return <RolesWorkspace session={session!} />;
}
