import PaginaAlmacenes, {
  metadatosAlmacenes,
} from "@/components/almacenes/PaginaAlmacenes";
export const generateMetadata = () => metadatosAlmacenes("titulo");
export default async function PaginaListadoAlmacenes({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: idioma } = await params;
  return <PaginaAlmacenes idioma={idioma} />;
}
