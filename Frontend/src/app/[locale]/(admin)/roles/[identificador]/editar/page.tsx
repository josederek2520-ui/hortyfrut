import PaginaRol from "@/components/roles/PaginaRol";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("roles");
  return { title: `${t("editTitle")} | HortyFru` };
}
export default async function PaginaEditarRol({
  params,
}: {
  params: Promise<{ locale: string; identificador: string }>;
}) {
  const { locale: idioma, identificador } = await params;
  return <PaginaRol idioma={idioma} identificador={identificador} />;
}
