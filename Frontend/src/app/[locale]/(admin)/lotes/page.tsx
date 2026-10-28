import PaginaInventario, {metadatosInventario} from "@/components/inventario/PaginaInventario";
export const generateMetadata = () => metadatosInventario("lotes");
export default async function PaginaLotes({params}: {params: Promise<{locale: string}>}) {
  const {locale: idioma} = await params;
  return <PaginaInventario idioma={idioma} tipo="lotes" />;
}
