import PaginaClientes, {
  metadatosClientes,
} from "@/components/clientes/PaginaClientes";
export const generateMetadata = () => metadatosClientes("titulo");
export default async function PaginaDirectorioClientes({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: idioma } = await params;
  return <PaginaClientes idioma={idioma} />;
}
