import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession as obtenerSesion } from "@/lib/auth-server";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import GestionRecepciones from "./GestionRecepciones";
import FichaRecepcion from "./FichaRecepcion";

export async function metadatosRecepciones(clave = "titulo") {
  const t = await getTranslations("recepciones");
  return { title: `${t(clave)} | HortyFru`, description: t("subtitulo") };
}
export default async function PaginaRecepciones({
  idioma,
  modo = "listado",
  identificador,
  compraInicial,
}: {
  idioma: string;
  modo?: "listado" | "nuevo" | "editar" | "detalle";
  identificador?: string;
  compraInicial?: number;
}) {
  setRequestLocale(idioma);
  let sesion;
  try {
    sesion = await obtenerSesion();
  } catch {
    return <ServicioNoDisponible />;
  }
  if (!sesion) redirect({ href: "/signin", locale: idioma });
  return modo === "listado" ? (
    <GestionRecepciones sesion={sesion!} compraInicial={compraInicial} />
  ) : (
    <FichaRecepcion
      key={`${modo}-${identificador || "nueva"}`}
      sesion={sesion!}
      modo={modo}
      identificador={identificador}
      compraInicial={compraInicial}
    />
  );
}
