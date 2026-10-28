import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession as obtenerSesion } from "@/lib/auth-server";
import ServicioNoDisponible from "@/components/users/UsersUnavailable";
import GestionCatalogo from "./GestionCatalogo";
import EditorCatalogo from "./EditorCatalogo";
import type { TipoCatalogo } from "./tipos";

export async function metadatosCatalogo(
  tipo: TipoCatalogo,
  modo: "titulo" | "nuevo" | "editar",
) {
  const t = await getTranslations("catalogos");
  return {
    title: `${t(`tipos.${tipo}.${modo}`)} | HortyFru`,
    description: t(`tipos.${tipo}.subtitulo`),
  };
}
export default async function PaginaCatalogo({
  tipo,
  idioma,
  formulario = false,
  identificador,
}: {
  tipo: TipoCatalogo;
  idioma: string;
  formulario?: boolean;
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
  return formulario ? (
    <EditorCatalogo
      key={`${tipo}:${identificador || "nuevo"}`}
      tipo={tipo}
      sesion={sesion!}
      identificador={identificador}
    />
  ) : (
    <GestionCatalogo key={tipo} tipo={tipo} sesion={sesion!} />
  );
}
