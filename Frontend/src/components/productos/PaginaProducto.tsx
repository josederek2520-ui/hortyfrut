import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession as obtenerSesion } from "@/lib/auth-server";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import GestionCatalogo from "@/components/catalogos/GestionCatalogo";
import EditorProducto from "./EditorProducto";
import VistaProducto from "./VistaProducto";

export async function metadatosProducto(
  modo: "titulo" | "nuevo" | "editar" | "ficha",
) {
  const t = await getTranslations("productos");
  return { title: `${t(modo)} | HortyFru`, description: t("subtitulo") };
}

export default async function PaginaProducto({
  idioma,
  formulario = false,
  detalle = false,
  identificador,
}: {
  idioma: string;
  formulario?: boolean;
  detalle?: boolean;
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
  return detalle && identificador ? (
    <VistaProducto
      key={identificador}
      identificador={identificador}
      sesion={sesion!}
    />
  ) : formulario ? (
    <EditorProducto
      key={identificador || "nuevo"}
      sesion={sesion!}
      identificador={identificador}
    />
  ) : (
    <GestionCatalogo tipo="productos" sesion={sesion!} />
  );
}
