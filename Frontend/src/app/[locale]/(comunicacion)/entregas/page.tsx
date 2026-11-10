import PaginaEntregas, {
  metadatosEntregas,
} from "@/components/entregas/PaginaEntregas";
export const generateMetadata = metadatosEntregas;
export default async function Pagina({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <PaginaEntregas idioma={locale} />;
}
