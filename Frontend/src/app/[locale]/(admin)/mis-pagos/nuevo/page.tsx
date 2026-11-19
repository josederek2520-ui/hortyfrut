import PaginaPagos, { metadatosPagos } from "@/components/pagos/PaginaPagos";
export const generateMetadata = metadatosPagos;
export default async function Pagina({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <PaginaPagos idioma={locale} modo="nuevo" />;
}
