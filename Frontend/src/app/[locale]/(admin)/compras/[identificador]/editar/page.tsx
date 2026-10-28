import PaginaCompras, {
  metadatosCompras,
} from "@/components/compras/PaginaCompras";
export const generateMetadata = () => metadatosCompras("editarCompra");
export default async function PaginaEditarCompra({
  params,
}: {
  params: Promise<{ locale: string; identificador: string }>;
}) {
  const { locale: idioma, identificador } = await params;
  return (
    <PaginaCompras
      idioma={idioma}
      modo="editar"
      identificador={identificador}
    />
  );
}
