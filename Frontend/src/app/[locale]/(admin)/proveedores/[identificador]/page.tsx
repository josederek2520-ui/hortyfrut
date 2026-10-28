import PaginaProveedores, {
  metadatosProveedores,
} from "@/components/proveedores/PaginaProveedores";
export const generateMetadata = () => metadatosProveedores("detalle");
export default async function PaginaDetalleProveedor({
  params,
}: {
  params: Promise<{ locale: string; identificador: string }>;
}) {
  const { locale: idioma, identificador } = await params;
  return (
    <PaginaProveedores
      idioma={idioma}
      modo="detalle"
      identificador={identificador}
    />
  );
}
