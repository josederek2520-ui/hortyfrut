import PaginaRespaldos, {
  metadatosRespaldos,
} from "@/components/respaldos/PaginaRespaldos";

export const generateMetadata = metadatosRespaldos;

export default async function Pagina({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: idioma } = await params;
  return <PaginaRespaldos idioma={idioma} />;
}
