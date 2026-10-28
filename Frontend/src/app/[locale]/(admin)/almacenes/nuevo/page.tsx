import PaginaAlmacenes, {
  metadatosAlmacenes,
} from "@/components/almacenes/PaginaAlmacenes";
export const generateMetadata = () => metadatosAlmacenes("nuevoAlmacen");
export default async function PaginaNuevoAlmacen({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: idioma } = await params;
  return <PaginaAlmacenes idioma={idioma} modo="nuevo" />;
}
