import PaginaAlmacenes, {
  metadatosAlmacenes,
} from "@/components/almacenes/PaginaAlmacenes";
export const generateMetadata = () => metadatosAlmacenes("detalle");
export default async function PaginaDetalleAlmacen({
  params,
}: {
  params: Promise<{ locale: string; identificador: string }>;
}) {
  const { locale: idioma, identificador } = await params;
  return (
    <PaginaAlmacenes
      idioma={idioma}
      modo="detalle"
      identificador={identificador}
    />
  );
}
