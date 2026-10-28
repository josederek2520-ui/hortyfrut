import PaginaCatalogo, {
  metadatosCatalogo,
} from "@/components/catalogos/PaginaCatalogo";
export const generateMetadata = () =>
  metadatosCatalogo("unidades_medida", "nuevo");
export default async function PaginaNuevaUnidad({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: idioma } = await params;
  return <PaginaCatalogo tipo="unidades_medida" idioma={idioma} formulario />;
}
