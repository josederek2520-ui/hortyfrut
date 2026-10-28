import PaginaAlmacenes, {
  metadatosAlmacenes,
} from "@/components/almacenes/PaginaAlmacenes";
export const generateMetadata = () => metadatosAlmacenes("editarAlmacen");
export default async function PaginaEditarAlmacen({
  params,
}: {
  params: Promise<{ locale: string; identificador: string }>;
}) {
  const { locale: idioma, identificador } = await params;
  return (
    <PaginaAlmacenes
      idioma={idioma}
      modo="editar"
      identificador={identificador}
    />
  );
}
