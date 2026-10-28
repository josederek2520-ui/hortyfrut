import PaginaCompras, {
  metadatosCompras,
} from "@/components/compras/PaginaCompras";
export const generateMetadata = () => metadatosCompras("nuevaCompra");
export default async function PaginaNuevaCompra({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: idioma } = await params;
  return <PaginaCompras idioma={idioma} modo="nuevo" />;
}
