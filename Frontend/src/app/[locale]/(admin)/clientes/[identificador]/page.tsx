import PaginaClientes, {
  metadatosClientes,
} from "@/components/clientes/PaginaClientes";
export const generateMetadata = () => metadatosClientes("ficha");
export default async function PaginaFichaCliente({
  params,
}: {
  params: Promise<{ locale: string; identificador: string }>;
}) {
  const { locale: idioma, identificador } = await params;
  return (
    <PaginaClientes
      idioma={idioma}
      modo="detalle"
      identificador={identificador}
    />
  );
}
