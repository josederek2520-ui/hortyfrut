import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession as obtenerSesion } from "@/lib/auth-server";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import GestionAlmacenes from "./GestionAlmacenes";
import FichaAlmacen from "./FichaAlmacen";

export async function metadatosAlmacenes(
  clave: "titulo" | "nuevoAlmacen" | "editarAlmacen" | "detalle",
) {
  const t = await getTranslations("almacenes");
  return { title: `${t(clave)} | HortyFru`, description: t("subtitulo") };
}

export default async function PaginaAlmacenes({
  idioma,
  modo = "listado",
  identificador,
}: {
  idioma: string;
  modo?: "listado" | "nuevo" | "editar" | "detalle";
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
  return modo === "listado" ? (
    <GestionAlmacenes sesion={sesion!} />
  ) : (
    <FichaAlmacen
      key={`${modo}-${identificador || "nuevo"}`}
      identificador={identificador}
      modo={modo}
      sesion={sesion!}
    />
  );
}
