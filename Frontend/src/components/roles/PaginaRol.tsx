import { getSession as obtenerSesion } from "@/lib/auth-server";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import { redirect } from "@/i18n/navigation";
import { setRequestLocale } from "next-intl/server";
import VistaRol from "./VistaRol";

export default async function PaginaRol({
  idioma,
  identificador,
}: {
  idioma: string;
  identificador?: string;
}) {
  setRequestLocale(idioma);
  let sesion;
  try {
    sesion = await obtenerSesion();
  } catch {
    return <ServicioNoDisponible />;
  }
  if (!sesion) redirect({ href: "/signin", locale: idioma });
  return (
    <VistaRol
      key={identificador || "nuevo"}
      sesion={sesion!}
      identificador={identificador}
    />
  );
}
