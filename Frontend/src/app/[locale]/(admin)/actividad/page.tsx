import GestionActividad from "@/components/actividad/GestionActividad";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import { getSession as obtenerSesion } from "@/lib/auth-server";
import { redirect } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("actividad");
  return { title: `${t("titulo")} | HortyFru`, description: t("subtitulo") };
}
export default async function PaginaActividad({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: idioma } = await params;
  setRequestLocale(idioma);
  let sesion;
  try {
    sesion = await obtenerSesion();
  } catch {
    return <ServicioNoDisponible />;
  }
  if (!sesion) redirect({ href: "/signin", locale: idioma });
  return <GestionActividad sesion={sesion!} />;
}
