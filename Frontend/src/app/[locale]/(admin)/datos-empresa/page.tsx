import PaginaDatosEmpresa from "@/components/empresa/PaginaDatosEmpresa";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("empresa");
  return { title: t("titulo") + " | HortyFru" };
}
export default async function Pagina({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <PaginaDatosEmpresa idioma={locale} />;
}
