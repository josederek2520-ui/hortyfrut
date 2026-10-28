import PaginaClientes, {
  metadatosClientes,
} from "@/components/clientes/PaginaClientes";
export const generateMetadata = () => metadatosClientes("editarCliente");
export default async function PaginaEditarCliente({
  params,
}: {
  params: Promise<{ locale: string; identificador: string }>;
}) {
  const { locale: idioma, identificador } = await params;
  return (
    <PaginaClientes
      idioma={idioma}
      modo="formulario"
      identificador={identificador}
    />
  );
}
