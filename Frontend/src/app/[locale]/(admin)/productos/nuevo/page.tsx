import PaginaProducto, {
  metadatosProducto,
} from "@/components/productos/PaginaProducto";
export const generateMetadata = () => metadatosProducto("nuevo");
export default async function PaginaNuevoProducto({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: idioma } = await params;
  return <PaginaProducto idioma={idioma} formulario />;
}
