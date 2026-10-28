import PaginaCatalogo, {
  metadatosCatalogo,
} from "@/components/catalogos/PaginaCatalogo";
export const generateMetadata = () =>
  metadatosCatalogo("unidades_medida", "titulo");
export default async function PaginaUnidades({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: idioma } = await params;
  return <PaginaCatalogo tipo="unidades_medida" idioma={idioma} />;
}
