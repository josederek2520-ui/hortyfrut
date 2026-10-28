import PaginaCompras, {
  metadatosCompras,
} from "@/components/compras/PaginaCompras";
export const generateMetadata = () => metadatosCompras("detalleCompra");
export default async function PaginaDetalleCompra({
  params,
}: {
  params: Promise<{ locale: string; identificador: string }>;
}) {
  const { locale: idioma, identificador } = await params;
  return (
    <PaginaCompras
      idioma={idioma}
      modo="detalle"
      identificador={identificador}
    />
  );
}
