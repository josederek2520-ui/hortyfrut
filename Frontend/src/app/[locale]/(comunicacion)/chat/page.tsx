import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession as obtenerSesion } from "@/lib/auth-server";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import DisposicionAplicacion from "@/layout/DisposicionAplicacion";
import ModuloChat from "@/components/chat/ModuloChat";

export async function generateMetadata() {
  const t = await getTranslations("chat");
  return { title: `${t("titulo")} | HortyFru`, description: t("subtitulo") };
}
export default async function Pagina({
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
  return (
    <DisposicionAplicacion
      modoChofer={!!sesion!.acceso_publico}
      rutaInicio={sesion!.permisos_chofer?.ver ? "/mis-viajes" : "/chat"}
    >
      <ModuloChat key={sesion!.user.id} sesion={sesion!} />
    </DisposicionAplicacion>
  );
}
