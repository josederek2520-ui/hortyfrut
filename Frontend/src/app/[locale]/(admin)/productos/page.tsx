import PaginaProducto, {
  metadatosProducto,
} from "@/components/productos/PaginaProducto";
export const generateMetadata = () => metadatosProducto("titulo");
export default async function PaginaProductos({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: idioma } = await params;
  return <PaginaProducto idioma={idioma} />;
}
