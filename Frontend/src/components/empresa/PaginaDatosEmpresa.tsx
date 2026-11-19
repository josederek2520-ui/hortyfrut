import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSession } from "@/lib/auth-server";
import { redirect } from "@/i18n/navigation";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import GestionDatosEmpresa from "./GestionDatosEmpresa";

export default async function PaginaDatosEmpresa({
  idioma,
}: {
  idioma: string;
}) {
  setRequestLocale(idioma);
  let sesion;
  try {
    sesion = await getSession();
  } catch {
    return <ServicioNoDisponible />;
  }
  if (!sesion) redirect({ href: "/signin", locale: idioma });
  const t = await getTranslations("comercialComun");
  if (sesion!.acceso_publico || !sesion!.permisos_empresa?.ver)
    return <p role="alert">{t("sinAcceso")}</p>;
  return (
    <GestionDatosEmpresa
      key={sesion!.user.id}
      editable={!!sesion!.permisos_empresa?.editar}
    />
  );
}
