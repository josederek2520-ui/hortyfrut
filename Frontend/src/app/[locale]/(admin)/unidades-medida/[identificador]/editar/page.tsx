import PaginaCatalogo, {
  metadatosCatalogo,
} from "@/components/catalogos/PaginaCatalogo";
export const generateMetadata = () =>
  metadatosCatalogo("unidades_medida", "editar");
export default async function PaginaEditarUnidad({
  params,
}: {
  params: Promise<{ locale: string; identificador: string }>;
}) {
  const { locale: idioma, identificador } = await params;
  return (
    <PaginaCatalogo
      tipo="unidades_medida"
      idioma={idioma}
      formulario
      identificador={identificador}
    />
  );
}
