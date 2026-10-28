import PaginaProveedores, {
  metadatosProveedores,
} from "@/components/proveedores/PaginaProveedores";
export const generateMetadata = () => metadatosProveedores("titulo");
export default async function PaginaListadoProveedores({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: idioma } = await params;
  return <PaginaProveedores idioma={idioma} />;
}
