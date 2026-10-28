import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession as obtenerSesion } from "@/lib/auth-server";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import GestionProveedores from "./GestionProveedores";
import FichaProveedor from "./FichaProveedor";

export async function metadatosProveedores(
  clave: "titulo" | "nuevoProveedor" | "editarProveedor" | "detalle",
) {
  const t = await getTranslations("proveedores");
  return { title: `${t(clave)} | HortyFru`, description: t("subtitulo") };
}

export default async function PaginaProveedores({
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
    <GestionProveedores sesion={sesion!} />
  ) : (
    <FichaProveedor
      key={`${modo}-${identificador || "nuevo"}`}
      identificador={identificador}
      modo={modo}
      sesion={sesion!}
    />
  );
}
