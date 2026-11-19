import PaginaCobros, {
  metadatosCobros,
} from "@/components/cobros/PaginaCobros";
export const generateMetadata = metadatosCobros;
export default async function Pagina({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <PaginaCobros idioma={locale} modo="nuevo" />;
}
