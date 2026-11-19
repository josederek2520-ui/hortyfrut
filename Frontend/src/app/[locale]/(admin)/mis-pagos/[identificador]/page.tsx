import PaginaPagos, { metadatosPagos } from "@/components/pagos/PaginaPagos";
export const generateMetadata = metadatosPagos;
export default async function Pagina({
  params,
}: {
  params: Promise<{ locale: string; identificador: string }>;
}) {
  const { locale, identificador } = await params;
  return (
    <PaginaPagos idioma={locale} modo="detalle" identificador={identificador} />
  );
}
