import UserProfileWorkspace from "@/components/users/UserProfileWorkspace";
import UsersUnavailable from "@/components/users/UsersUnavailable";
import { getSession } from "@/lib/auth-server";
import { redirect } from "@/i18n/navigation";
import { setRequestLocale } from "next-intl/server";
export default async function ProfilePage({
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
  return <UserProfileWorkspace session={session!} />;
}
