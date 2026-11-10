import PaginaEntregas, {
  metadatosEntregas,
} from "@/components/entregas/PaginaEntregas";
export const generateMetadata = metadatosEntregas;
export default async function Pagina({
  params,
}: {
  params: Promise<{ locale: string; despacho: string; pedido: string }>;
}) {
  const { locale, despacho, pedido } = await params;
  return <PaginaEntregas idioma={locale} despacho={despacho} pedido={pedido} />;
}
