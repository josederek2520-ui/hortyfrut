import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession as obtenerSesion } from "@/lib/auth-server";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import GestionClientes from "./GestionClientes";
import EditorCliente from "./EditorCliente";
import VistaCliente from "./VistaCliente";

export async function metadatosClientes(
  modo: "titulo" | "nuevoCliente" | "editarCliente" | "ficha",
) {
  const t = await getTranslations("clientes");
  return { title: `${t(modo)} | HortyFru`, description: t("subtitulo") };
}

export default async function PaginaClientes({
  idioma,
  modo = "listado",
  identificador,
}: {
  idioma: string;
  modo?: "listado" | "formulario" | "detalle";
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
  if (modo === "detalle" && identificador)
    return (
      <VistaCliente
        key={identificador}
        identificador={identificador}
        sesion={sesion!}
      />
    );
  if (modo === "formulario")
    return (
      <EditorCliente
        key={identificador || "nuevo"}
        identificador={identificador}
        sesion={sesion!}
      />
    );
  return <GestionClientes sesion={sesion!} />;
}
