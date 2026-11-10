import PaginaLogistica, {
  metadatosLogistica,
} from "@/components/logistica/PaginaLogistica";
export const generateMetadata = () => metadatosLogistica("vehiculos");
export default async function Pagina({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: idioma } = await params;
  return <PaginaLogistica idioma={idioma} modulo="vehiculos" modo="listado" />;
}
