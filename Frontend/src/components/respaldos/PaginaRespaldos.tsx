import { getTranslations, setRequestLocale } from "next-intl/server";
import { randomUUID as generarUuid } from "node:crypto";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth-server";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import GestionRespaldos from "./GestionRespaldos";

export async function metadatosRespaldos() {
  const t = await getTranslations("respaldos");
  return { title: `${t("titulo")} | HortyFru` };
}

export default async function PaginaRespaldos({ idioma }: { idioma: string }) {
  setRequestLocale(idioma);
  let sesion;
  try {
    sesion = await getSession();
  } catch {
    return <ServicioNoDisponible />;
  }
  if (!sesion) redirect({ href: "/signin", locale: idioma });
  const t = await getTranslations("respaldos");
  if (sesion!.acceso_publico || !sesion!.permisos_respaldos?.ver)
    return <p role="alert">{t("sinPermiso")}</p>;
  // Una sesión revalidada retira las solicitudes y descargas de la instancia anterior,
  // incluso cuando se volvió a iniciar sesión con la misma cuenta.
  return (
    <GestionRespaldos
      key={`${sesion!.user.id}-${generarUuid()}`}
      sesion={sesion!}
    />
  );
}
