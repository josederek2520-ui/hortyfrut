import PaginaPedidos, {
  metadatosPedidos,
} from "@/components/pedidos/PaginaPedidos";
export const generateMetadata = () => metadatosPedidos("titulo");
export default async function Pagina({
  params,
}: {
  params: Promise<{ locale: string; identificador?: string }>;
}) {
  const { locale: idioma, identificador } = await params;
  return (
    <PaginaPedidos
      idioma={idioma}
      modo="listado"
      identificador={identificador}
    />
  );
}
