import PaginaVentas, {
  metadatosVentas,
} from "@/components/ventas/PaginaVentas";
export const generateMetadata = metadatosVentas;
export default async function Pagina({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <PaginaVentas idioma={locale} modo="nueva" />;
}
