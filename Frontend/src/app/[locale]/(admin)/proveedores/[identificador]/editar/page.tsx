import PaginaProveedores, {
  metadatosProveedores,
} from "@/components/proveedores/PaginaProveedores";
export const generateMetadata = () => metadatosProveedores("editarProveedor");
export default async function PaginaEditarProveedor({
  params,
}: {
  params: Promise<{ locale: string; identificador: string }>;
}) {
  const { locale: idioma, identificador } = await params;
  return (
    <PaginaProveedores
      idioma={idioma}
      modo="editar"
      identificador={identificador}
    />
  );
}
