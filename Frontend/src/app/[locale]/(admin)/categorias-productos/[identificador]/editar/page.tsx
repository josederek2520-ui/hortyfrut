import PaginaCatalogo, {
  metadatosCatalogo,
} from "@/components/catalogos/PaginaCatalogo";
export const generateMetadata = () =>
  metadatosCatalogo("categorias_productos", "editar");
export default async function PaginaEditarCategoria({
  params,
}: {
  params: Promise<{ locale: string; identificador: string }>;
}) {
  const { locale: idioma, identificador } = await params;
  return (
    <PaginaCatalogo
      tipo="categorias_productos"
      idioma={idioma}
      formulario
      identificador={identificador}
    />
  );
}
