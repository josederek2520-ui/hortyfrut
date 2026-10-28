import PaginaProveedores, {
  metadatosProveedores,
} from "@/components/proveedores/PaginaProveedores";
export const generateMetadata = () => metadatosProveedores("nuevoProveedor");
export default async function PaginaNuevoProveedor({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: idioma } = await params;
  return <PaginaProveedores idioma={idioma} modo="nuevo" />;
}
