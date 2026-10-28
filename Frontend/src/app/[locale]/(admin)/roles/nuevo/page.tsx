import PaginaRol from "@/components/roles/PaginaRol";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("roles");
  return { title: `${t("newRole")} | HortyFru` };
}
export default async function PaginaNuevoRol({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: idioma } = await params;
  return <PaginaRol idioma={idioma} />;
}
