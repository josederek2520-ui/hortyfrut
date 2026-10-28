import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession as obtenerSesion } from "@/lib/auth-server";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import GestionPedidos from "./GestionPedidos";
import EditorPedido from "./EditorPedido";

export async function metadatosPedidos(modo: "titulo" | "nuevo" | "editar") {
  const t = await getTranslations("pedidos");
  return { title: `${t(modo)} | HortyFru`, description: t("hojaSubtitulo") };
}
export default async function PaginaPedidos({
  idioma,
  modo = "listado",
  identificador,
}: {
  idioma: string;
  modo?: "listado" | "formulario";
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
  if (modo === "formulario")
    return <EditorPedido identificador={identificador} sesion={sesion!} />;
  return <GestionPedidos sesion={sesion!} />;
}
