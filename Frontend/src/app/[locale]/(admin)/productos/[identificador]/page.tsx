import PaginaProducto, {
  metadatosProducto,
} from "@/components/productos/PaginaProducto";
export const generateMetadata = () => metadatosProducto("ficha");
export default async function PaginaFichaProducto({
  params,
}: {
  params: Promise<{ locale: string; identificador: string }>;
}) {
  const { locale: idioma, identificador } = await params;
  return (
    <PaginaProducto idioma={idioma} identificador={identificador} detalle />
  );
}
