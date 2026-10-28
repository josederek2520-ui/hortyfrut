import PaginaProducto, {
  metadatosProducto,
} from "@/components/productos/PaginaProducto";
export const generateMetadata = () => metadatosProducto("editar");
export default async function PaginaEditarProducto({
  params,
}: {
  params: Promise<{ locale: string; identificador: string }>;
}) {
  const { locale: idioma, identificador } = await params;
  return (
    <PaginaProducto idioma={idioma} identificador={identificador} formulario />
  );
}
