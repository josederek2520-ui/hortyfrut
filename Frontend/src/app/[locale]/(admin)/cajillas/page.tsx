import PaginaCajillas, {metadatosCajillas} from "@/components/cajillas/PaginaCajillas";
export const generateMetadata = () => metadatosCajillas();
export default async function PaginaListadoCajillas({params}: {params: Promise<{locale: string}>}) {
  const {locale: idioma} = await params;
  return <PaginaCajillas idioma={idioma} />;
}
