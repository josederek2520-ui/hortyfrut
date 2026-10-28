import PaginaPedidos, {
  metadatosPedidos,
} from "@/components/pedidos/PaginaPedidos";
export const generateMetadata = () => metadatosPedidos("nuevo");
export default async function Pagina({
  params,
}: {
  params: Promise<{ locale: string; identificador?: string }>;
}) {
  const { locale: idioma, identificador } = await params;
  return (
    <PaginaPedidos
      idioma={idioma}
      modo="formulario"
      identificador={identificador}
    />
  );
}
