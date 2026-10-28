import PaginaCatalogo, {
  metadatosCatalogo,
} from "@/components/catalogos/PaginaCatalogo";
export const generateMetadata = () =>
  metadatosCatalogo("categorias_productos", "titulo");
export default async function PaginaCategorias({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: idioma } = await params;
  return <PaginaCatalogo tipo="categorias_productos" idioma={idioma} />;
}
