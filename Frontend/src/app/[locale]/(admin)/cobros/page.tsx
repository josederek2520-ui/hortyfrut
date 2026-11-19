import PaginaCobros, {
  metadatosCobros,
} from "@/components/cobros/PaginaCobros";
export const generateMetadata = metadatosCobros;
export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ venta?: string }>;
}) {
  const { locale } = await params,
    { venta } = await searchParams;
  return <PaginaCobros idioma={locale} venta={venta} />;
}
