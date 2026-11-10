import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession as obtenerSesion } from "@/lib/auth-server";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import GestionSeguimientoCamiones from "@/components/despachos/GestionSeguimientoCamiones";

export async function generateMetadata() {
  const t = await getTranslations("seguimientoCamiones");
  return { title: `${t("titulo")} | HortyFru`, description: t("subtitulo") };
}
export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ viaje?: string | string[] }>;
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
  const { viaje } = await searchParams;
  const identificador =
    typeof viaje === "string" && /^[1-9]\d{0,14}$/.test(viaje)
      ? Number(viaje)
      : null;
  return (
    <GestionSeguimientoCamiones
      key={identificador ?? "actuales"}
      sesion={sesion!}
      viajeInicial={identificador}
    />
  );
}
