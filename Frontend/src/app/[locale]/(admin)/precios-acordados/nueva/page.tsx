import PaginaPrecios, {
  metadatosPrecios,
} from "@/components/precios/PaginaPrecios";
export const generateMetadata = metadatosPrecios;
export default async function Pagina({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <PaginaPrecios idioma={locale} modo="nueva" />;
}
