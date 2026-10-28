import PaginaInventario, {metadatosInventario} from "@/components/inventario/PaginaInventario";
export const generateMetadata = () => metadatosInventario("movimientos");
export default async function PaginaMovimientos({params}: {params: Promise<{locale: string}>}) {
  const {locale: idioma} = await params;
  return <PaginaInventario idioma={idioma} tipo="movimientos" />;
}
