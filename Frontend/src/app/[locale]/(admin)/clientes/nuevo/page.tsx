import PaginaClientes, {
  metadatosClientes,
} from "@/components/clientes/PaginaClientes";
export const generateMetadata = () => metadatosClientes("nuevoCliente");
export default async function PaginaNuevoCliente({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: idioma } = await params;
  return <PaginaClientes idioma={idioma} modo="formulario" />;
}
